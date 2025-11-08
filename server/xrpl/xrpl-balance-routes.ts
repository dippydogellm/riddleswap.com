import { Router } from 'express';
import { Client } from 'xrpl';
import { requireAuthentication } from '../middleware/session-auth';

const router = Router();

// GET /api/xrpl/balance - Get user's XRP balance
router.get('/balance', requireAuthentication, async (req: any, res) => {
  try {
    const xrpAddress = req.user?.xrpAddress || req.session?.xrpAddress;
    
    if (!xrpAddress) {
      return res.json({
        success: true,
        balance: "0",
        address: null,
        message: "No XRP address connected"
      });
    }
    
    // Connect to XRPL
    const client = new Client('wss://s1.ripple.com');
    await client.connect();
    
    try {
      // Get account info
      const accountInfo = await client.request({
        command: 'account_info',
        account: xrpAddress,
        ledger_index: 'validated'
      });
      
      // Convert drops to XRP
      const balanceDrops = accountInfo.result.account_data.Balance;
      const balanceXRP = (Number(balanceDrops) / 1000000).toFixed(6);
      
      await client.disconnect();
      
      res.json({
        success: true,
        balance: balanceXRP,
        address: xrpAddress
      });
    } catch (error: any) {
      await client.disconnect();
      throw error;
    }
  } catch (error: any) {
    console.error('❌ [XRP BALANCE] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch XRP balance'
    });
  }
});

export default router;
