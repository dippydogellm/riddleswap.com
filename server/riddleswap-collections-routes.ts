/**
 * RIDDLESWAP COLLECTIONS ROUTES
 * API endpoints for managing RiddleSwap NFT collections and rewards
 * Target: rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH with taxons 0,1,2,3,9
 */

import express from 'express';
import { riddleSwapCollectionsService } from './riddleswap-collections-service';
import { sessionAuth } from './middleware/session-auth';

const router = express.Router();

// Download and process RiddleSwap collections (admin only)
router.post('/api/riddleswap-collections/download', sessionAuth, async (req, res) => {
  try {
    console.log('🎨 [RIDDLESWAP-COLLECTIONS-API] Downloading RiddleSwap collections...');
    
    const collections = await riddleSwapCollectionsService.downloadRiddleSwapCollections();
    
    res.json({
      success: true,
      data: {
        collections_processed: collections.length,
        total_nfts: collections.reduce((sum, c) => sum + c.nfts.length, 0),
        collections: collections.map(c => ({
          collection_name: c.collection_name,
          taxon: c.taxon,
          nft_count: c.nfts.length
        }))
      }
    });
  } catch (error) {
    console.error('❌ [RIDDLESWAP-COLLECTIONS-API] Error downloading collections:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download RiddleSwap collections'
    });
  }
});

// Calculate volume-based rewards
router.get('/api/riddleswap-collections/rewards', sessionAuth, async (req, res) => {
  try {
    const targetWallet = req.query.wallet as string;
    
    console.log('💰 [RIDDLESWAP-COLLECTIONS-API] Calculating volume-based rewards...');
    
    const rewards = await riddleSwapCollectionsService.calculateVolumeBasedRewards(targetWallet);
    
    res.json({
      success: true,
      data: rewards
    });
  } catch (error) {
    console.error('❌ [RIDDLESWAP-COLLECTIONS-API] Error calculating rewards:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate volume-based rewards'
    });
  }
});

// Generate monthly RDL allocation report
router.get('/api/riddleswap-collections/report/:month?', sessionAuth, async (req, res) => {
  try {
    const month = req.params.month; // Format: YYYY-MM
    
    console.log(`📋 [RIDDLESWAP-COLLECTIONS-API] Generating monthly RDL report for ${month || 'current month'}...`);
    
    const report = await riddleSwapCollectionsService.generateMonthlyRDLReport(month);
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('❌ [RIDDLESWAP-COLLECTIONS-API] Error generating report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate monthly RDL report'
    });
  }
});

// Get wallet rewards data
router.get('/api/riddleswap-collections/wallet/:walletAddress', sessionAuth, async (req, res) => {
  try {
    const walletAddress = req.params.walletAddress;
    
    console.log(`🔍 [RIDDLESWAP-COLLECTIONS-API] Getting rewards data for wallet: ${walletAddress}`);
    
    const data = await riddleSwapCollectionsService.getWalletRewardsData(walletAddress);
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('❌ [RIDDLESWAP-COLLECTIONS-API] Error getting wallet data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get wallet rewards data'
    });
  }
});

export default router;