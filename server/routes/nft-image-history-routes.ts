// @ts-nocheck
/**
 * NFT Image History API Routes
 * Endpoints for viewing and managing generated image history
 */

import { Router } from 'express';
import { sessionAuth } from '../middleware/session-auth';
import { db } from '../db';
import { nftImageGenerationHistory, gamingNfts } from '../../shared/nft-gaming-enhanced';
import { eq, and, desc } from 'drizzle-orm';
import { nftImageStorageService } from '../nft-image-storage-service';

const router = Router();

/**
 * GET /api/gaming/nft/:nftTokenId/image-history
 * Get all generated images for an NFT
 */
router.get('/nft/:nftTokenId/image-history', async (req, res) => {
  try {
    const { nftTokenId } = req.params;

    const history = await nftImageStorageService.getImageHistory(nftTokenId);

    res.json({
      success: true,
      nftTokenId,
      count: history.length,
      history: history.map(h => ({
        id: h.id,
        nftId: h.nftId,
        nftTokenId: h.nftTokenId,
        promptUsed: h.promptUsed,
        openaiImageUrl: h.openaiImageUrl,
        storedImageUrl: h.storedImageUrl,
        storagePath: h.storagePath,
        isCurrent: h.isCurrent,
        generatedAt: h.generatedAt,
        storedAt: h.storedAt,
        // Include snapshot data for historical reference
        metadataSnapshot: h.metadataSnapshot,
        traitsSnapshot: h.traitsSnapshot,
        powerLevelsSnapshot: h.powerLevelsSnapshot,
      })),
    });
  } catch (error: any) {
    console.error('❌ [Image History] Failed to get history:', error);
    res.status(500).json({
      error: 'Failed to get image history',
      message: error.message,
    });
  }
});

/**
 * GET /api/gaming/nft/:nftTokenId/current-image
 * Get the current active image for an NFT
 */
router.get('/nft/:nftTokenId/current-image', async (req, res) => {
  try {
    const { nftTokenId } = req.params;

    const currentImage = await nftImageStorageService.getCurrentImage(nftTokenId);

    if (!currentImage) {
      return res.status(404).json({
        error: 'No current image found',
      });
    }

    res.json({
      success: true,
      nftTokenId,
      currentImage: {
        id: currentImage.id,
        nftId: currentImage.nftId,
        nftTokenId: currentImage.nftTokenId,
        promptUsed: currentImage.promptUsed,
        openaiImageUrl: currentImage.openaiImageUrl,
        storedImageUrl: currentImage.storedImageUrl,
        storagePath: currentImage.storagePath,
        isCurrent: currentImage.isCurrent,
        generatedAt: currentImage.generatedAt,
        storedAt: currentImage.storedAt,
      },
    });
  } catch (error: any) {
    console.error('❌ [Current Image] Failed to get current image:', error);
    res.status(500).json({
      error: 'Failed to get current image',
      message: error.message,
    });
  }
});

/**
 * POST /api/gaming/nft/:nftTokenId/set-current-image
 * Switch which image is the current one
 */
router.post('/nft/:nftTokenId/set-current-image', sessionAuth, async (req, res) => {
  try {
    const { nftTokenId } = req.params;
    const { historyId } = req.body;

    if (!historyId) {
      return res.status(400).json({
        error: 'History ID is required',
      });
    }

    // Verify the history record exists and belongs to this NFT
    const [historyRecord] = await db
      .select()
      .from(nftImageGenerationHistory)
      .where(
        and(
          eq(nftImageGenerationHistory.id, historyId),
          eq(nftImageGenerationHistory.nft_token_id, nftTokenId)
        )
      )
      .limit(1);

    if (!historyRecord) {
      return res.status(404).json({
        error: 'Image history record not found',
      });
    }

    // Mark as current
    await nftImageStorageService.markImageAsCurrent(historyId, nftTokenId);

    res.json({
      success: true,
      message: 'Current image updated successfully',
      historyId,
    });
  } catch (error: any) {
    console.error('❌ [Set Current Image] Failed:', error);
    res.status(500).json({
      error: 'Failed to set current image',
      message: error.message,
    });
  }
});

/**
 * GET /api/gaming/nft/:nftTokenId/ownership-history
 * Get ownership transfer history for an NFT
 */
router.get('/nft/:nftTokenId/ownership-history', async (req, res) => {
  try {
    const { nftTokenId } = req.params;

    // Query nftOwnershipHistory table
    const { nftOwnershipHistory } = await import('../../shared/nft-gaming-enhanced');
    
    const history = await db
      .select()
      .from(nftOwnershipHistory)
      .where(eq(nftOwnershipHistory.nft_token_id, nftTokenId))
      .orderBy(desc(nftOwnershipHistory.changed_at));

    res.json({
      success: true,
      nftTokenId,
      count: history.length,
      history: history.map(h => ({
        id: h.id,
        nftId: h.nft_id,
        nftTokenId: h.nft_token_id,
        previousOwner: h.previous_owner,
        newOwner: h.new_owner,
        changeReason: h.change_reason,
        changedAt: h.changed_at,
        transactionHash: h.transaction_hash,
        powerLevel: h.power_level,
        status: h.status,
      })),
    });
  } catch (error: any) {
    console.error('❌ [Ownership History] Failed:', error);
    res.status(500).json({
      error: 'Failed to get ownership history',
      message: error.message,
    });
  }
});

/**
 * GET /api/admin/nft-images/stats
 * Get storage statistics (admin only)
 */
router.get('/admin/nft-images/stats', sessionAuth, async (req, res) => {
  try {
    // TODO: Add admin check
    const stats = await nftImageStorageService.getStorageStats();

    res.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    console.error('❌ [Storage Stats] Failed:', error);
    res.status(500).json({
      error: 'Failed to get storage stats',
      message: error.message,
    });
  }
});

export default router;
