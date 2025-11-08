/**
 * Image Storage Admin Routes
 * Admin-only endpoints for managing AI-generated images and storage
 */

import { Router } from 'express';
import { runImagePathMigration } from './fix-image-paths-migration';
import { populateAllWalletProfiles } from './populate-wallet-profiles';
import { db } from './db';
import { gamingNfts } from '../shared/schema';
import { eq, sql } from 'drizzle-orm';
import { isExpiredDalleUrl } from './image-path-utils';
import { generateCharacterFromNFT } from './inquisition-image-generator';

const router = Router();

/**
 * POST /api/admin/image-storage/run-migration
 * Run the image path migration to fix any broken URLs
 * Admin only
 */
router.post('/admin/image-storage/run-migration', async (req, res) => {
  try {
    console.log('🚀 [ADMIN] Running image path migration...');
    
    // Run migration in background
    runImagePathMigration()
      .then(() => {
        console.log('✅ [ADMIN] Image path migration completed');
      })
      .catch((error) => {
        console.error('❌ [ADMIN] Image path migration failed:', error);
      });
    
    res.json({
      success: true,
      message: 'Image path migration started in background. Check server logs for progress.',
    });
  } catch (error: any) {
    console.error('❌ [ADMIN] Error starting migration:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to start migration',
    });
  }
});

/**
 * GET /api/admin/image-storage/stats
 * Get statistics about image storage
 * Admin only
 */
router.get('/admin/image-storage/stats', async (req, res) => {
  try {
    // Count images by storage type
    const nfts = await db.select().from(gamingNfts);
    
    let permanentStorage = 0;
    let expiredDalleUrls = 0;
    let ipfsUrls = 0;
    let externalUrls = 0;
    let missingImages = 0;
    
    for (const nft of nfts) {
      const imageUrl = nft.ai_generated_image_url || nft.image_url;
      
      if (!imageUrl) {
        missingImages++;
      } else if (imageUrl.startsWith('/api/storage/')) {
        permanentStorage++;
      } else if (isExpiredDalleUrl(imageUrl)) {
        expiredDalleUrls++;
      } else if (imageUrl.startsWith('ipfs://')) {
        ipfsUrls++;
      } else if (imageUrl.startsWith('http')) {
        externalUrls++;
      }
    }
    
    res.json({
      success: true,
      stats: {
        totalNfts: nfts.length,
        permanentStorage,
        expiredDalleUrls,
        ipfsUrls,
        externalUrls,
        missingImages,
      },
      breakdown: {
        'Permanent Replit Storage': `${permanentStorage} (${((permanentStorage / nfts.length) * 100).toFixed(1)}%)`,
        'Expired DALL-E URLs': `${expiredDalleUrls} (${((expiredDalleUrls / nfts.length) * 100).toFixed(1)}%)`,
        'IPFS URLs': `${ipfsUrls} (${((ipfsUrls / nfts.length) * 100).toFixed(1)}%)`,
        'External URLs': `${externalUrls} (${((externalUrls / nfts.length) * 100).toFixed(1)}%)`,
        'Missing Images': `${missingImages} (${((missingImages / nfts.length) * 100).toFixed(1)}%)`,
      },
    });
  } catch (error: any) {
    console.error('❌ [ADMIN] Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch stats',
    });
  }
});

/**
 * POST /api/admin/image-storage/regenerate-expired
 * Regenerate all expired DALL-E images
 * Admin only - this will regenerate AI images for NFTs with expired URLs
 */
router.post('/admin/image-storage/regenerate-expired', async (req, res) => {
  try {
    const { batchSize = 10 } = req.body;
    
    console.log('🔄 [ADMIN] Finding NFTs with expired DALL-E images...');
    
    // Find all NFTs with expired DALL-E URLs
    const nfts = await db.select().from(gamingNfts);
    const expiredNfts = nfts.filter(
      (nft) => isExpiredDalleUrl(nft.ai_generated_image_url || '')
    );
    
    if (expiredNfts.length === 0) {
      return res.json({
        success: true,
        message: 'No expired images found',
        count: 0,
      });
    }
    
    console.log(`🎨 [ADMIN] Found ${expiredNfts.length} NFTs with expired images. Starting regeneration...`);
    
    let regenerated = 0;
    let failed = 0;
    
    // Process in batches to avoid overwhelming OpenAI API
    for (let i = 0; i < expiredNfts.length; i += batchSize) {
      const batch = expiredNfts.slice(i, i + batchSize);
      
      console.log(`📦 [ADMIN] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(expiredNfts.length / batchSize)}`);
      
      const promises = batch.map(async (nft) => {
        try {
          // Ensure NFT has a name before processing
          if (!nft.name) {
            failed++;
            console.warn(`⚠️ Skipping NFT without name: ${nft.nft_id}`);
            return;
          }
          
          const result = await generateCharacterFromNFT(nft as any);
          if (result.success) {
            regenerated++;
            console.log(`✅ Regenerated image for ${nft.name}`);
          } else {
            failed++;
            console.error(`❌ Failed to regenerate image for ${nft.name}:`, result.error);
          }
        } catch (error: any) {
          failed++;
          console.error(`❌ Exception regenerating image for ${nft.name}:`, error);
        }
      });
      
      await Promise.all(promises);
      
      // Rate limiting delay between batches
      if (i + batchSize < expiredNfts.length) {
        console.log('⏳ Waiting 2 seconds before next batch...');
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
    
    res.json({
      success: true,
      message: `Regeneration complete: ${regenerated} successful, ${failed} failed`,
      stats: {
        total: expiredNfts.length,
        regenerated,
        failed,
      },
    });
  } catch (error: any) {
    console.error('❌ [ADMIN] Error regenerating expired images:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to regenerate expired images',
    });
  }
});

/**
 * POST /api/admin/wallet-profiles/populate
 * Ensure all Riddle wallets have complete profiles (gamer profiles and NFT data)
 * Admin only
 */
router.post('/admin/wallet-profiles/populate', async (req, res) => {
  try {
    console.log('🚀 [ADMIN] Populating wallet profiles...');
    
    // Run population in background
    populateAllWalletProfiles()
      .then((stats) => {
        console.log('✅ [ADMIN] Wallet profile population completed:', stats);
      })
      .catch((error) => {
        console.error('❌ [ADMIN] Wallet profile population failed:', error);
      });
    
    res.json({
      success: true,
      message: 'Wallet profile population started in background. Check server logs for progress.',
    });
  } catch (error: any) {
    console.error('❌ [ADMIN] Error starting wallet profile population:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to start wallet profile population',
    });
  }
});

export default router;
