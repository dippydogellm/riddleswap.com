/**
 * Bithomp Image Cache API Routes
 * Endpoints for caching Bithomp CDN images to GCS
 */

import { Router } from 'express';
import { bithompImageCache } from '../services/bithomp-image-cache';

const router = Router();

/**
 * POST /api/admin/cache-bithomp/single
 * Cache a single Bithomp image
 */
router.post('/cache-bithomp/single', async (req, res) => {
  try {
    const { url, category } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const result = await bithompImageCache.cacheImage(url, category || 'nft');

    res.json(result);
  } catch (error: any) {
    console.error('❌ [Bithomp Cache API] Single cache failed:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/cache-bithomp/batch
 * Cache multiple Bithomp images
 */
router.post('/cache-bithomp/batch', async (req, res) => {
  try {
    const { urls, category, concurrency } = req.body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ error: 'URLs array is required' });
    }

    const results = await bithompImageCache.cacheBatch(
      urls,
      category || 'nft',
      concurrency || 5
    );

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    res.json({
      total: results.length,
      successful,
      failed,
      results,
    });
  } catch (error: any) {
    console.error('❌ [Bithomp Cache API] Batch cache failed:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/cache-bithomp/nfts
 * Cache NFT images by token IDs
 */
router.post('/cache-bithomp/nfts', async (req, res) => {
  try {
    const { nftTokenIds } = req.body;

    if (!nftTokenIds || !Array.isArray(nftTokenIds) || nftTokenIds.length === 0) {
      return res.status(400).json({ error: 'nftTokenIds array is required' });
    }

    const results = [];
    
    for (const tokenId of nftTokenIds) {
      const result = await bithompImageCache.cacheNFTImage(tokenId);
      results.push({ tokenId, ...result });
    }

    const successful = results.filter(r => r.success).length;

    res.json({
      total: results.length,
      successful,
      failed: results.length - successful,
      results,
    });
  } catch (error: any) {
    console.error('❌ [Bithomp Cache API] NFT cache failed:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/cache-bithomp/tokens
 * Cache token logos
 */
router.post('/cache-bithomp/tokens', async (req, res) => {
  try {
    const { tokens } = req.body;

    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      return res.status(400).json({ 
        error: 'tokens array is required: [{ issuer, currency }, ...]' 
      });
    }

    const results = [];
    
    for (const token of tokens) {
      if (!token.issuer || !token.currency) {
        results.push({
          token,
          success: false,
          error: 'issuer and currency are required',
        });
        continue;
      }

      const result = await bithompImageCache.cacheTokenLogo(
        token.issuer,
        token.currency
      );
      results.push({ token, ...result });
    }

    const successful = results.filter(r => r.success).length;

    res.json({
      total: results.length,
      successful,
      failed: results.length - successful,
      results,
    });
  } catch (error: any) {
    console.error('❌ [Bithomp Cache API] Token cache failed:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/cache-bithomp/collections
 * Cache collection images
 */
router.post('/cache-bithomp/collections', async (req, res) => {
  try {
    const { collections } = req.body;

    if (!collections || !Array.isArray(collections) || collections.length === 0) {
      return res.status(400).json({ 
        error: 'collections array is required: [{ issuer, taxon }, ...]' 
      });
    }

    const results = [];
    
    for (const collection of collections) {
      if (!collection.issuer || collection.taxon === undefined) {
        results.push({
          collection,
          success: false,
          error: 'issuer and taxon are required',
        });
        continue;
      }

      const result = await bithompImageCache.cacheCollectionImage(
        collection.issuer,
        collection.taxon
      );
      results.push({ collection, ...result });
    }

    const successful = results.filter(r => r.success).length;

    res.json({
      total: results.length,
      successful,
      failed: results.length - successful,
      results,
    });
  } catch (error: any) {
    console.error('❌ [Bithomp Cache API] Collection cache failed:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/cache-bithomp/stats
 * Get cache statistics
 */
router.get('/cache-bithomp/stats', async (req, res) => {
  try {
    const stats = bithompImageCache.getCacheStats();
    res.json(stats);
  } catch (error: any) {
    console.error('❌ [Bithomp Cache API] Stats failed:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/cache-bithomp/clear
 * Clear cache (in-memory only, does not delete GCS files)
 */
router.post('/cache-bithomp/clear', async (req, res) => {
  try {
    bithompImageCache.clearCache();
    res.json({ message: 'Cache cleared successfully' });
  } catch (error: any) {
    console.error('❌ [Bithomp Cache API] Clear failed:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
