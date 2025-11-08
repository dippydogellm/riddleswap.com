/**
 * REWARDS DASHBOARD API ROUTES
 * Comprehensive rewards tracking and distribution endpoints
 */

import { Router } from 'express';
import { rewardsDashboardService } from './rewards-dashboard-service';
import { sessionAuth } from './middleware/session-auth';

const router = Router();

// Initialize daily tracking (run once on startup)
router.post('/api/rewards/initialize-daily-tracking', sessionAuth, async (req, res) => {
  try {
    console.log('🚀 [REWARDS API] Initializing daily tracking...');
    const result = await rewardsDashboardService.initializeDailyTracking();
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('❌ [REWARDS API] Failed to initialize daily tracking:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update daily activity with real-time data
router.post('/api/rewards/update-daily-activity', sessionAuth, async (req, res) => {
  try {
    console.log('📊 [REWARDS API] Updating daily activity...');
    const result = await rewardsDashboardService.updateDailyActivity();
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('❌ [REWARDS API] Failed to update daily activity:', error);
    res.status(500).json({ error: error.message });
  }
});

// Calculate trading rewards for a specific wallet
router.post('/api/rewards/calculate-trading-rewards', sessionAuth, async (req, res) => {
  try {
    const { walletAddress, dateRange } = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address is required' });
    }
    
    console.log(`💰 [REWARDS API] Calculating trading rewards for: ${walletAddress}`);
    const result = await rewardsDashboardService.calculateTradingRewards(walletAddress, dateRange);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('❌ [REWARDS API] Failed to calculate trading rewards:', error);
    res.status(500).json({ error: error.message });
  }
});

// Track NFT collection holdings for a wallet
router.post('/api/rewards/track-nft-holdings', sessionAuth, async (req, res) => {
  try {
    const { walletAddress } = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address is required' });
    }
    
    console.log(`🎨 [REWARDS API] Tracking NFT holdings for: ${walletAddress}`);
    const result = await rewardsDashboardService.trackNftCollectionHoldings(walletAddress);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('❌ [REWARDS API] Failed to track NFT holdings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Calculate NFT collection rewards
router.post('/api/rewards/calculate-collection-rewards', sessionAuth, async (req, res) => {
  try {
    const { walletAddress, collectionName } = req.body;
    
    if (!walletAddress || !collectionName) {
      return res.status(400).json({ error: 'Wallet address and collection name are required' });
    }
    
    console.log(`🎨 [REWARDS API] Calculating collection rewards for ${collectionName}`);
    const result = await rewardsDashboardService.calculateCollectionRewards(walletAddress, collectionName);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('❌ [REWARDS API] Failed to calculate collection rewards:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get comprehensive rewards dashboard
router.get('/api/rewards/dashboard/:walletAddress', sessionAuth, async (req, res) => {
  try {
    const { walletAddress } = req.params;
    
    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address is required' });
    }
    
    console.log(`📊 [REWARDS API] Fetching dashboard for: ${walletAddress}`);
    const result = await rewardsDashboardService.getRewardsDashboard(walletAddress);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('❌ [REWARDS API] Failed to fetch dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

// Initialize rewards for target wallet (rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH)
router.post('/api/rewards/initialize-target-wallet', sessionAuth, async (req, res) => {
  try {
    const targetWallet = 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH';
    console.log(`🎯 [REWARDS API] Initializing rewards for target wallet: ${targetWallet}`);
    
    // Initialize daily tracking
    await rewardsDashboardService.initializeDailyTracking();
    
    // Update today's activity
    await rewardsDashboardService.updateDailyActivity();
    
    // Track NFT holdings
    const nftResult = await rewardsDashboardService.trackNftCollectionHoldings(targetWallet);
    
    // Calculate trading rewards
    const tradingResult = await rewardsDashboardService.calculateTradingRewards(targetWallet);
    
    // Get dashboard data
    const dashboardResult = await rewardsDashboardService.getRewardsDashboard(targetWallet);
    
    res.json({ 
      success: true, 
      data: {
        target_wallet: targetWallet,
        nft_tracking: nftResult,
        trading_rewards: tradingResult,
        dashboard: dashboardResult
      }
    });
  } catch (error: any) {
    console.error('❌ [REWARDS API] Failed to initialize target wallet:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get real-time statistics for admin
router.get('/api/rewards/platform-stats', sessionAuth, async (req, res) => {
  try {
    console.log('📊 [REWARDS API] Fetching platform statistics...');
    
    // Update daily activity first
    await rewardsDashboardService.updateDailyActivity();
    
    // Get comprehensive dashboard for the target wallet
    const targetWallet = 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH';
    const targetDashboard = await rewardsDashboardService.getRewardsDashboard(targetWallet);
    
    res.json({ 
      success: true, 
      data: {
        target_wallet_dashboard: targetDashboard,
        last_updated: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('❌ [REWARDS API] Failed to fetch platform stats:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;