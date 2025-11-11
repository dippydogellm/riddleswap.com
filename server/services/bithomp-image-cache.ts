/**
 * Bithomp Image Caching Service
 * Downloads images from Bithomp CDN and saves them to Vercel Blob for permanent storage
 */

import { unifiedStorage } from '../unified-storage';
import fetch from 'node-fetch';
import crypto from 'crypto';

interface CachedImageResult {
  success: boolean;
  gcsUrl?: string;
  originalUrl?: string;
  cached?: boolean;
  fileSize?: number;
  error?: string;
}

export class BithompImageCacheService {
  private cache: Map<string, string> = new Map(); // originalUrl -> gcsUrl
  private processing: Set<string> = new Set(); // URLs currently being processed

  /**
   * Download and cache a Bithomp CDN image to GCS
   * @param bithompUrl - The Bithomp CDN URL
   * @param category - Category for GCS storage (nft, token, collection)
   * @returns Result with GCS URL
   */
  async cacheImage(bithompUrl: string, category: 'nft' | 'token' | 'collection' = 'nft'): Promise<CachedImageResult> {
    try {
      // Check if already cached
      if (this.cache.has(bithompUrl)) {
        return {
          success: true,
          gcsUrl: this.cache.get(bithompUrl)!,
          originalUrl: bithompUrl,
          cached: true,
        };
      }

      // Check if currently processing
      if (this.processing.has(bithompUrl)) {
        console.log(`⏳ [Bithomp Cache] Already processing: ${bithompUrl}`);
        // Wait for processing to complete
        await this.waitForProcessing(bithompUrl);
        return {
          success: true,
          gcsUrl: this.cache.get(bithompUrl)!,
          originalUrl: bithompUrl,
          cached: true,
        };
      }

      this.processing.add(bithompUrl);

      console.log(`📥 [Bithomp Cache] Downloading: ${bithompUrl}`);

      // Download image from Bithomp CDN
      const response = await fetch(bithompUrl, {
        headers: {
          'User-Agent': 'RiddleSwap/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      const imageBuffer = Buffer.from(buffer);

      // Get content type
      const contentType = response.headers.get('content-type') || 'image/png';

      // Generate unique filename based on content hash
      const hash = crypto.createHash('sha256').update(imageBuffer).digest('hex').substring(0, 16);
      const extension = contentType.includes('webp') ? 'webp' : contentType.includes('png') ? 'png' : 'jpg';
      const filename = `${hash}.${extension}`;

      console.log(`💾 [Bithomp Cache] Uploading to Vercel Blob: ${filename} (${imageBuffer.length} bytes)`);

      // Upload to Vercel Blob
      const blobUrl = await unifiedStorage.uploadFile(
        imageBuffer,
        'generated', // Use 'generated' type for Bithomp cached images
        contentType,
        true
      );

      // Cache the result
      this.cache.set(bithompUrl, blobUrl);
      this.processing.delete(bithompUrl);

      console.log(`✅ [Bithomp Cache] Cached successfully: ${blobUrl}`);

      return {
        success: true,
        gcsUrl: blobUrl, // Keep property name for compatibility
        originalUrl: bithompUrl,
        cached: false,
        fileSize: imageBuffer.length,
      };

    } catch (error: any) {
      this.processing.delete(bithompUrl);
      console.error(`❌ [Bithomp Cache] Failed to cache ${bithompUrl}:`, error.message);
      
      return {
        success: false,
        originalUrl: bithompUrl,
        error: error.message,
      };
    }
  }

  /**
   * Wait for an image to finish processing
   */
  private async waitForProcessing(url: string, timeout: number = 30000): Promise<void> {
    const startTime = Date.now();
    
    while (this.processing.has(url)) {
      if (Date.now() - startTime > timeout) {
        throw new Error('Timeout waiting for image processing');
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Batch cache multiple images
   * @param urls - Array of Bithomp URLs
   * @param category - Category for storage
   * @param concurrency - Max concurrent downloads (default: 5)
   */
  async cacheBatch(
    urls: string[],
    category: 'nft' | 'token' | 'collection' = 'nft',
    concurrency: number = 5
  ): Promise<CachedImageResult[]> {
    const results: CachedImageResult[] = [];
    const queue = [...urls];

    console.log(`📦 [Bithomp Cache] Batch caching ${urls.length} images (concurrency: ${concurrency})`);

    while (queue.length > 0) {
      const batch = queue.splice(0, concurrency);
      const batchResults = await Promise.all(
        batch.map(url => this.cacheImage(url, category))
      );
      results.push(...batchResults);
    }

    const successful = results.filter(r => r.success).length;
    console.log(`✅ [Bithomp Cache] Batch complete: ${successful}/${urls.length} successful`);

    return results;
  }

  /**
   * Cache NFT image from token ID
   * @param nftTokenId - The NFT token ID
   */
  async cacheNFTImage(nftTokenId: string): Promise<CachedImageResult> {
    const bithompUrl = `https://cdn.bithomp.com/nft/${nftTokenId}.webp`;
    return this.cacheImage(bithompUrl, 'nft');
  }

  /**
   * Cache token logo
   * @param issuer - Token issuer address
   * @param currency - Token currency code
   */
  async cacheTokenLogo(issuer: string, currency: string): Promise<CachedImageResult> {
    const bithompUrl = `https://cdn.bithomp.com/issued-token/${issuer}/${currency}`;
    return this.cacheImage(bithompUrl, 'token');
  }

  /**
   * Cache collection image
   * @param issuer - Collection issuer
   * @param taxon - Collection taxon
   */
  async cacheCollectionImage(issuer: string, taxon: number): Promise<CachedImageResult> {
    const bithompUrl = `https://cdn.bithomp.com/nft/${issuer}/${taxon}.png`;
    return this.cacheImage(bithompUrl, 'collection');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      cachedImages: this.cache.size,
      processing: this.processing.size,
    };
  }

  /**
   * Clear cache (useful for testing or memory management)
   */
  clearCache() {
    this.cache.clear();
    console.log(`🗑️ [Bithomp Cache] Cache cleared`);
  }
}

// Export singleton instance
export const bithompImageCache = new BithompImageCacheService();
