/**
 * MONTHLY NFT SNAPSHOT ROUTES
 * API endpoints for managing monthly NFT ownership snapshots
 * - Trigger monthly snapshots (admin only)
 * - View snapshot data and statistics  
 * - Get wallet-specific holdings per month
 * - Track reward eligibility based on NFT ownership
 */

import express from 'express';
import { monthlyNftSnapshotService } from './monthly-nft-snapshot-service';
import { sessionAuth, AuthenticatedRequest } from './middleware/session-auth';
import { requireAdminAccess } from './middleware/admin-auth';

const router = express.Router();

// Trigger monthly snapshot (admin only)
router.post('/api/monthly-snapshot/run', sessionAuth, requireAdminAccess, async (req: AuthenticatedRequest, res) => {
  try {
    const userHandle = req.user?.userHandle;
    console.log(`📸 [MONTHLY-SNAPSHOT-API] Admin ${userHandle} triggering monthly snapshot...`);
    
    const result = await monthlyNftSnapshotService.runMonthlySnapshot();
    
    console.log(`✅ [MONTHLY-SNAPSHOT-API] Snapshot completed by admin ${userHandle}:`, result.snapshot_id);
    res.json({
      success: true,
      data: result,
      triggered_by: userHandle,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [MONTHLY-SNAPSHOT-API] Error running snapshot:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run monthly snapshot',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get monthly snapshot data
router.get('/api/monthly-snapshot/:month?', sessionAuth, async (req, res) => {
  try {
    const month = req.params.month; // Format: YYYY-MM
    
    const data = await monthlyNftSnapshotService.getMonthlySnapshot(month);
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('❌ [MONTHLY-SNAPSHOT-API] Error getting snapshot:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get monthly snapshot data'
    });
  }
});

// Get specific wallet's monthly NFT holdings
router.get('/api/monthly-snapshot/wallet/:walletAddress/:month?', sessionAuth, async (req, res) => {
  try {
    const walletAddress = req.params.walletAddress;
    const month = req.params.month; // Format: YYYY-MM
    
    const data = await monthlyNftSnapshotService.getWalletMonthlyHoldings(walletAddress, month);
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('❌ [MONTHLY-SNAPSHOT-API] Error getting wallet holdings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get wallet monthly holdings'
    });
  }
});

// Get current month snapshot status
router.get('/api/monthly-snapshot/status', sessionAuth, async (req, res) => {
  try {
    const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    
    const data = await monthlyNftSnapshotService.getMonthlySnapshot(currentMonth);
    
    res.json({
      success: true,
      data,
      current_month: currentMonth
    });
  } catch (error) {
    console.error('❌ [MONTHLY-SNAPSHOT-API] Error getting snapshot status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get snapshot status'
    });
  }
});

export default router;