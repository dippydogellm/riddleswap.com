import express from 'express';
import { nftRewardsService } from './nft-rewards-service';
import { requireAuthentication, type AuthenticatedRequest } from './middleware/session-auth';
import { requireAdminAccess } from './middleware/admin-auth';

export const router = express.Router();

/**
 * Check NFT holdings for a wallet (PUBLIC - No authentication required for checking)
 */
router.post('/check-holdings', async (req, res) => {
  try {
    const { walletAddress, userHandle } = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({ error: 'walletAddress is required' });
    }

    console.log(`🔍 [NFT REWARDS API] Checking holdings for wallet: ${walletAddress}`);
    
    const result = await nftRewardsService.checkAndUpdateNFTHoldings(walletAddress, userHandle);
    
    res.json(result);

  } catch (error) {
    console.error('❌ [NFT REWARDS API] Error checking holdings:', error);
    res.status(500).json({ 
      error: 'Failed to check NFT holdings',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get rewards summary for authenticated user's wallet
 */
router.get('/summary', requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const userHandle = req.session?.handle;
    if (!userHandle) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get user's wallet from session or database
    const walletAddress = req.query.walletAddress as string;
    if (!walletAddress) {
      return res.status(400).json({ error: 'walletAddress is required' });
    }

    console.log(`📊 [NFT REWARDS API] Getting summary for wallet: ${walletAddress}`);
    
    const summary = await nftRewardsService.getWalletRewardsSummary(walletAddress);
    
    res.json(summary);

  } catch (error) {
    console.error('❌ [NFT REWARDS API] Error getting rewards summary:', error);
    res.status(500).json({ 
      error: 'Failed to get rewards summary',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get public rewards summary for any wallet (no authentication)
 */
router.get('/summary/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    
    if (!walletAddress) {
      return res.status(400).json({ error: 'walletAddress is required' });
    }

    console.log(`📊 [NFT REWARDS API] Getting public summary for wallet: ${walletAddress}`);
    
    const summary = await nftRewardsService.getWalletRewardsSummary(walletAddress);
    
    res.json(summary);

  } catch (error) {
    console.error('❌ [NFT REWARDS API] Error getting public rewards summary:', error);
    res.status(500).json({ 
      error: 'Failed to get rewards summary',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// =============================================================================
// ADMIN ENDPOINTS (Admin authentication required)
// =============================================================================

/**
 * Get all NFT holders for admin review
 */
router.get('/admin/holders', requireAuthentication, requireAdminAccess, async (req: AuthenticatedRequest, res) => {
  try {
    console.log(`🔧 [NFT REWARDS ADMIN] Getting all holders for admin review`);
    
    const holders = await nftRewardsService.getAllHoldersForAdmin();
    
    res.json(holders);

  } catch (error) {
    console.error('❌ [NFT REWARDS ADMIN] Error getting holders:', error);
    res.status(500).json({ 
      error: 'Failed to get NFT holders',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Calculate monthly rewards (Admin only)
 */
router.post('/admin/calculate-monthly', requireAuthentication, requireAdminAccess, async (req: AuthenticatedRequest, res) => {
  try {
    const { month } = req.body; // Format: YYYY-MM
    
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'Valid month in YYYY-MM format is required' });
    }

    console.log(`💰 [NFT REWARDS ADMIN] Calculating monthly rewards for ${month}`);
    
    const calculation = await nftRewardsService.calculateMonthlyRewards(month);
    
    res.json(calculation);

  } catch (error) {
    console.error('❌ [NFT REWARDS ADMIN] Error calculating monthly rewards:', error);
    res.status(500).json({ 
      error: 'Failed to calculate monthly rewards',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Open collection window (Admin only) - Called on 1st of month
 */
router.post('/admin/open-collection-window', requireAuthentication, requireAdminAccess, async (req: AuthenticatedRequest, res) => {
  try {
    const { distributionId } = req.body;
    
    if (!distributionId) {
      return res.status(400).json({ error: 'distributionId is required' });
    }

    console.log(`🕐 [NFT REWARDS ADMIN] Opening collection window: ${distributionId}`);
    
    const result = await nftRewardsService.openCollectionWindow(distributionId);
    
    res.json(result);

  } catch (error) {
    console.error('❌ [NFT REWARDS ADMIN] Error opening collection window:', error);
    res.status(500).json({ 
      error: 'Failed to open collection window',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Close collection window and burn uncollected rewards (Admin only) - Called after 24 hours
 */
router.post('/admin/close-collection-window', requireAuthentication, requireAdminAccess, async (req: AuthenticatedRequest, res) => {
  try {
    const { distributionId } = req.body;
    
    if (!distributionId) {
      return res.status(400).json({ error: 'distributionId is required' });
    }

    console.log(`🔥 [NFT REWARDS ADMIN] Closing collection window: ${distributionId}`);
    
    const result = await nftRewardsService.closeCollectionWindow(distributionId);
    
    res.json(result);

  } catch (error) {
    console.error('❌ [NFT REWARDS ADMIN] Error closing collection window:', error);
    res.status(500).json({ 
      error: 'Failed to close collection window',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Bulk update NFT holdings for all known wallets (Admin only)
 */
router.post('/admin/update-all-holdings', requireAuthentication, requireAdminAccess, async (req: AuthenticatedRequest, res) => {
  try {
    console.log(`🔄 [NFT REWARDS ADMIN] Bulk updating all NFT holdings`);
    
    // This would iterate through all existing reward wallets and update their holdings
    // For now, return success message - implementation would be added based on requirements
    
    res.json({
      success: true,
      message: 'Bulk update initiated - this is a placeholder for the full implementation'
    });

  } catch (error) {
    console.error('❌ [NFT REWARDS ADMIN] Error bulk updating holdings:', error);
    res.status(500).json({ 
      error: 'Failed to bulk update holdings',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// =============================================================================
// PUBLIC COLLECTION ENDPOINTS (24-hour collection window)
// =============================================================================

/**
 * Get available rewards for a wallet (PUBLIC - No authentication required)
 */
router.get('/available/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    
    if (!walletAddress) {
      return res.status(400).json({ error: 'walletAddress is required' });
    }

    console.log(`⏰ [NFT REWARDS API] Getting available rewards for ${walletAddress}`);
    
    const availableRewards = await nftRewardsService.getAvailableRewards(walletAddress);
    
    res.json({
      success: true,
      data: availableRewards,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [NFT REWARDS API] Error getting available rewards:', error);
    res.status(500).json({ 
      error: 'Failed to get available rewards',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Collect specific reward (PUBLIC - No authentication required, 24-hour window only)
 */
router.post('/collect', async (req, res) => {
  try {
    const { walletAddress, rewardId } = req.body;
    
    if (!walletAddress || !rewardId) {
      return res.status(400).json({ 
        error: 'walletAddress and rewardId are required'
      });
    }

    console.log(`💰 [NFT REWARDS API] Collecting reward ${rewardId} for ${walletAddress}`);
    
    const result = await nftRewardsService.collectReward(walletAddress, rewardId);
    
    res.json({
      success: true,
      data: result,
      message: `Successfully collected ${result.rdlAmount} RDL from ${result.collectionName}! Reward expires in 24 hours from the 1st of each month.`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [NFT REWARDS API] Error collecting reward:', error);
    const statusCode = error instanceof Error && error.message.includes('expired') ? 410 : 400;
    res.status(statusCode).json({ 
      error: 'Failed to collect reward',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;