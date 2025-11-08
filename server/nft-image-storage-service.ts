// @ts-nocheck
/**
 * NFT Image Storage & History Service
 * Handles downloading, storing, and tracking all generated NFT images
 */

import { db } from './db';
import { nftImageGenerationHistory, nftAiImageRequests } from '../shared/nft-gaming-enhanced';
import { gamingNfts } from '../shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';

// Storage backend selection
const USE_GCS = process.env.USE_GCS === 'true' || process.env.STORAGE_BACKEND === 'gcs';

interface StoredImageResult {
  success: boolean;
  historyId?: string;
  storedUrl?: string;
  storagePath?: string;
  fileSize?: number;
  imageHash?: string;
  error?: string;
}

interface ImageHistoryRecord {
  id: string;
  nftId: string;
  nftTokenId: string;
  promptUsed: string;
  openaiImageUrl: string;
  storedImageUrl: string | null;
  storagePath: string | null;
  isCurrent: boolean;
  generatedAt: Date;
  storedAt: Date | null;
  metadataSnapshot: any;
  traitsSnapshot: any;
  powerLevelsSnapshot: any;
}

export class NFTImageStorageService {
  private logsDir: string;

  constructor() {
    this.logsDir = path.join(process.cwd(), 'logs', 'nft-images');
    this.initializeLogging();
  }

  /**
   * Initialize logging directories
   */
  private async initializeLogging(): Promise<void> {
    try {
      await fs.mkdir(this.logsDir, { recursive: true });
      console.log(`📁 [NFT Image Storage] Logs directory: ${this.logsDir}`);
    } catch (error) {
      console.error(`❌ [NFT Image Storage] Failed to create logs directory:`, error);
    }
  }

  /**
   * Log to file with timestamp
   */
  private async log(type: 'info' | 'error' | 'storage', message: string, data?: any): Promise<void> {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}\n`;
    
    const fileName = `${type}-${new Date().toISOString().split('T')[0]}.log`;
    const filePath = path.join(this.logsDir, fileName);
    
    try {
      await fs.appendFile(filePath, logEntry);
    } catch (error) {
      console.error(`❌ Failed to write log:`, error);
    }
    
    // Also console log
    console.log(`[NFT Image Storage] ${message}`, data || '');
  }

  /**
   * Calculate SHA256 hash of image data
   */
  private calculateHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Download image from OpenAI URL
   */
  private async downloadImage(url: string): Promise<{ buffer: Buffer; duration: number }> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(url, {
        // timeout: 30000, // 30 second timeout - removed as not supported in RequestInit
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const duration = Date.now() - startTime;

      this.log('info', `✅ Downloaded image from OpenAI`, {
        url: url.substring(0, 50) + '...',
        size: buffer.length,
        duration_ms: duration
      });

      return { buffer, duration };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.log('error', `❌ Failed to download image`, {
        url: url.substring(0, 50) + '...',
        error: error.message,
        duration_ms: duration
      });
      throw error;
    }
  }

  /**
   * Upload image to storage backend (GCS or Replit)
   */
  private async uploadImage(
    buffer: Buffer,
    nftTokenId: string,
    collectionId: string | null
  ): Promise<{ storedUrl: string; storagePath: string; duration: number }> {
    const startTime = Date.now();
    
    try {
      // Generate unique filename
      const timestamp = Date.now();
      const randomId = crypto.randomUUID().split('-')[0];
      const fileName = `${timestamp}_${randomId}.png`;
      
      // Build storage path: /nft-images/{collection}/{nft_token_id}/{filename}
      const collectionPath = collectionId || 'unknown-collection';
      const storagePath = `nft-images/${collectionPath}/${nftTokenId}/${fileName}`;

      let storedUrl: string;

      if (USE_GCS) {
        // Upload to Google Cloud Storage
        const { unifiedStorage } = await import('./unified-storage');
        storedUrl = await unifiedStorage.uploadFile(buffer, storagePath, 'image/png');
        
        this.log('storage', `✅ Uploaded to GCS`, {
          storagePath,
          size: buffer.length,
          backend: 'gcs'
        });
      } else {
        // Upload to Replit Object Storage
        const { ReplitObjectStorageService } = await import('./replit-object-storage');
        const replitStorage = new ReplitObjectStorageService();
        storedUrl = await replitStorage.uploadImage(buffer, storagePath);
        
        this.log('storage', `✅ Uploaded to Replit Storage`, {
          storagePath,
          size: buffer.length,
          backend: 'replit'
        });
      }

      const duration = Date.now() - startTime;

      return {
        storedUrl,
        storagePath,
        duration
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.log('error', `❌ Failed to upload image`, {
        nftTokenId,
        error: error.message,
        duration_ms: duration
      });
      throw error;
    }
  }

  /**
   * Download and store an image, creating history record
   */
  async downloadAndStore(
    openaiUrl: string,
    nftId: string,
    nftTokenId: string,
    collectionId: string | null,
    generationRequestId: string | null,
    promptUsed: string,
    metadataSnapshot: any,
    traitsSnapshot: any,
    powerLevelsSnapshot: any,
    playerInfoSnapshot: any = {},
    rarityScore: string | null = null,
    modelUsed: string = 'dall-e-3',
    quality: string = 'standard'
  ): Promise<StoredImageResult> {
    const totalStartTime = Date.now();

    try {
      this.log('info', `🎨 Starting image download and storage`, {
        nftId,
        nftTokenId,
        collectionId,
        promptLength: promptUsed.length
      });

      // Calculate OpenAI URL expiration (60 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 60);

      // Download image from OpenAI
      const { buffer, duration: downloadDuration } = await this.downloadImage(openaiUrl);

      // Calculate image hash for deduplication
      const imageHash = this.calculateHash(buffer);

      // Check if we already have this exact image
      const existingImage = await db.select()
        .from(nftImageGenerationHistory)
        .where(
          and(
            eq(nftImageGenerationHistory.nft_token_id, nftTokenId),
            eq(nftImageGenerationHistory.image_hash, imageHash)
          )
        )
        .limit(1);

      if (existingImage.length > 0) {
        this.log('info', `♻️ Duplicate image detected, skipping storage`, {
          nftTokenId,
          imageHash,
          existingHistoryId: existingImage[0].id
        });

        return {
          success: true,
          historyId: existingImage[0].id,
          storedUrl: existingImage[0].stored_image_url || undefined,
          storagePath: existingImage[0].storage_path || undefined,
          fileSize: buffer.length,
          imageHash
        };
      }

      // Upload to storage
      const { storedUrl, storagePath, duration: storageDuration } = await this.uploadImage(
        buffer,
        nftTokenId,
        collectionId
      );

      // Mark all previous images for this NFT as not current
      await db.update(nftImageGenerationHistory)
        .set({  
          is_current_image: false,
          updated_at: new Date()
         } as any)
        .where(
          and(
            eq(nftImageGenerationHistory.nft_token_id, nftTokenId),
            eq(nftImageGenerationHistory.is_current_image, true)
          )
        );

      // Create history record
      const [historyRecord] = await db.insert(nftImageGenerationHistory)
        .values({
          nft_id: nftId,
          nft_token_id: nftTokenId,
          collection_id: collectionId,
          generation_request_id: generationRequestId,
          prompt_used: promptUsed,
          model_used: modelUsed,
          quality: quality,
          openai_image_url: openaiUrl,
          stored_image_url: storedUrl,
          storage_path: storagePath,
          storage_backend: USE_GCS ? 'gcs' : 'replit',
          file_size_bytes: buffer.length,
          image_hash: imageHash,
          nft_metadata_snapshot: metadataSnapshot,
          nft_traits_snapshot: traitsSnapshot,
          power_levels_snapshot: powerLevelsSnapshot,
          player_info_snapshot: playerInfoSnapshot,
          rarity_score_snapshot: rarityScore,
          is_current_image: true,
          storage_status: 'stored',
          download_status: 'downloaded',
          generated_at: new Date(),
          downloaded_at: new Date(),
          stored_at: new Date(),
          openai_url_expires_at: expiresAt,
          marked_current_at: new Date(),
          generation_duration_ms: 0, // Will be updated by caller
          download_duration_ms: downloadDuration,
          storage_duration_ms: storageDuration,
        })
        .returning();

      const totalDuration = Date.now() - totalStartTime;

      this.log('info', `✅ Image stored successfully`, {
        nftTokenId,
        historyId: historyRecord.id,
        storedUrl,
        fileSize: buffer.length,
        imageHash,
        totalDuration_ms: totalDuration
      });

      return {
        success: true,
        historyId: historyRecord.id,
        storedUrl,
        storagePath,
        fileSize: buffer.length,
        imageHash
      };

    } catch (error: any) {
      const totalDuration = Date.now() - totalStartTime;

      this.log('error', `❌ Failed to download and store image`, {
        nftId,
        nftTokenId,
        error: error.message,
        stack: error.stack,
        totalDuration_ms: totalDuration
      });

      // Create failed history record
      try {
        await db.insert(nftImageGenerationHistory)
          .values({
            nft_id: nftId,
            nft_token_id: nftTokenId,
            collection_id: collectionId,
            generation_request_id: generationRequestId,
            prompt_used: promptUsed,
            model_used: modelUsed,
            quality: quality,
            openai_image_url: openaiUrl,
            storage_status: 'failed',
            download_status: 'failed',
            nft_metadata_snapshot: metadataSnapshot,
            nft_traits_snapshot: traitsSnapshot,
            power_levels_snapshot: powerLevelsSnapshot,
            generated_at: new Date(),
          });
      } catch (dbError) {
        this.log('error', `❌ Failed to create error history record`, {
          nftTokenId,
          error: (dbError as Error).message
        });
      }

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get all image history for an NFT (newest first)
   */
  async getImageHistory(nftTokenId: string): Promise<ImageHistoryRecord[]> {
    try {
      const history = await db.select()
        .from(nftImageGenerationHistory)
        .where(eq(nftImageGenerationHistory.nft_token_id, nftTokenId))
        .orderBy(desc(nftImageGenerationHistory.generated_at));

      return history.map(h => ({
        id: h.id,
        nftId: h.nft_id,
        nftTokenId: h.nft_token_id,
        promptUsed: h.prompt_used,
        openaiImageUrl: h.openai_image_url,
        storedImageUrl: h.stored_image_url,
        storagePath: h.storage_path,
        isCurrent: h.is_current_image,
        generatedAt: h.generated_at,
        storedAt: h.stored_at,
        metadataSnapshot: h.nft_metadata_snapshot,
        traitsSnapshot: h.nft_traits_snapshot,
        powerLevelsSnapshot: h.power_levels_snapshot,
      }));
    } catch (error: any) {
      this.log('error', `❌ Failed to get image history`, {
        nftTokenId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get current image for an NFT
   */
  async getCurrentImage(nftTokenId: string): Promise<ImageHistoryRecord | null> {
    try {
      const [current] = await db.select()
        .from(nftImageGenerationHistory)
        .where(
          and(
            eq(nftImageGenerationHistory.nft_token_id, nftTokenId),
            eq(nftImageGenerationHistory.is_current_image, true)
          )
        )
        .limit(1);

      if (!current) return null;

      return {
        id: current.id,
        nftId: current.nft_id,
        nftTokenId: current.nft_token_id,
        promptUsed: current.prompt_used,
        openaiImageUrl: current.openai_image_url,
        storedImageUrl: current.stored_image_url,
        storagePath: current.storage_path,
        isCurrent: current.is_current_image,
        generatedAt: current.generated_at,
        storedAt: current.stored_at,
        metadataSnapshot: current.nft_metadata_snapshot,
        traitsSnapshot: current.nft_traits_snapshot,
        powerLevelsSnapshot: current.power_levels_snapshot,
      };
    } catch (error: any) {
      this.log('error', `❌ Failed to get current image`, {
        nftTokenId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Mark a specific image as current
   */
  async markImageAsCurrent(historyId: string, nftTokenId: string): Promise<void> {
    try {
      // Mark all images for this NFT as not current
      await db.update(nftImageGenerationHistory)
        .set({  
          is_current_image: false,
          updated_at: new Date()
         } as any)
        .where(
          and(
            eq(nftImageGenerationHistory.nft_token_id, nftTokenId),
            eq(nftImageGenerationHistory.is_current_image, true)
          )
        );

      // Mark the specified image as current
      await db.update(nftImageGenerationHistory)
        .set({  
          is_current_image: true,
          marked_current_at: new Date(),
          updated_at: new Date()
         } as any)
        .where(eq(nftImageGenerationHistory.id, historyId));

      this.log('info', `✅ Marked image as current`, {
        historyId,
        nftTokenId
      });
    } catch (error: any) {
      this.log('error', `❌ Failed to mark image as current`, {
        historyId,
        nftTokenId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{
    total_images: number;
    total_size_mb: number;
    by_collection: Array<{ collection_id: string; count: number; size_mb: number }>;
    by_status: Array<{ status: string; count: number }>;
  }> {
    try {
      // This would require more complex aggregation queries
      // For now, return basic stats
      const allImages = await db.select()
        .from(nftImageGenerationHistory);

      const total_images = allImages.length;
      const total_size_bytes = allImages.reduce((sum, img) => sum + (img.file_size_bytes || 0), 0);
      const total_size_mb = total_size_bytes / (1024 * 1024);

      return {
        total_images,
        total_size_mb: Math.round(total_size_mb * 100) / 100,
        by_collection: [],
        by_status: []
      };
    } catch (error: any) {
      this.log('error', `❌ Failed to get storage stats`, {
        error: error.message
      });
      throw error;
    }
  }
}

// Export singleton instance
export const nftImageStorageService = new NFTImageStorageService();
