import express from 'express';
import { Client } from 'xrpl';
import { db } from '../db';
import { walletData } from '../db/schema';
import { eq } from 'drizzle-orm';

const router = express.Router();

const RDL_ISSUER = 'r9xvnzUWZJpDu3NA6MKHmKhKJQTRqCRgu9';

/**
 * GET /api/rdl/balance/handle/:handle
 * Get RDL token balance by Riddle handle
 */
router.get('/balance/handle/:handle', async (req, res) => {
  try {
    const { handle } = req.params;
    
    console.log(`🔍 [RDL] Looking up wallet for handle: ${handle}`);
    
    // Get wallet address from database
    const wallet = await db.query.walletData.findFirst({
      where: eq(walletData.riddleHandle, handle)
    });
    
    if (!wallet || !wallet.xrpAddress) {
      return res.status(404).json({
        success: false,
        error: 'Wallet not found for this handle'
      });
    }
    
    const walletAddress = wallet.xrpAddress;
    console.log(`✅ [RDL] Found wallet: ${walletAddress}`);
    
    // Connect to XRPL
    const client = new Client('wss://s1.ripple.com');
    await client.connect();
    
    try {
      // Get account lines (trustlines)
      const accountLines = await client.request({
        command: 'account_lines',
        account: walletAddress,
        ledger_index: 'validated'
      });
      
      // Find RDL trustline
      const rdlLine = accountLines.result.lines.find((line: any) => 
        line.currency === 'RDL' && line.account === RDL_ISSUER
      );
      
      const balance = rdlLine ? parseFloat(rdlLine.balance) : 0;
      
      console.log(`✅ [RDL] Balance for @${handle} (${walletAddress}): ${balance} RDL`);
      
      await client.disconnect();
      
      res.json({
        success: true,
        balance: balance.toFixed(6),
        walletAddress,
        handle,
        issuer: RDL_ISSUER,
        hasTrustline: !!rdlLine
      });
      
    } catch (error) {
      await client.disconnect();
      throw error;
    }
    
  } catch (error) {
    console.error('❌ [RDL] Error fetching balance:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch RDL balance'
    });
  }
});

/**
 * GET /api/rdl/balance/:walletAddress
 * Get RDL token balance for a specific XRPL wallet address
 */
router.get('/balance/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    
    console.log(`🪙 [RDL] Fetching RDL balance for: ${walletAddress}`);
    
    // Validate address format
    if (!walletAddress || !walletAddress.startsWith('r')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid XRPL wallet address'
      });
    }
    
    // Connect to XRPL
    const client = new Client('wss://s1.ripple.com');
    await client.connect();
    
    try {
      // Get account lines (trustlines)
      const accountLines = await client.request({
        command: 'account_lines',
        account: walletAddress,
        ledger_index: 'validated'
      });
      
      // Find RDL trustline
      const rdlLine = accountLines.result.lines.find((line: any) => 
        line.currency === 'RDL' && line.account === RDL_ISSUER
      );
      
      const balance = rdlLine ? parseFloat(rdlLine.balance) : 0;
      
      console.log(`✅ [RDL] Balance for ${walletAddress}: ${balance} RDL`);
      
      await client.disconnect();
      
      res.json({
        success: true,
        balance: balance.toFixed(6),
        walletAddress,
        issuer: RDL_ISSUER,
        hasTrustline: !!rdlLine
      });
      
    } catch (error) {
      await client.disconnect();
      throw error;
    }
    
  } catch (error) {
    console.error('❌ [RDL] Error fetching balance:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch RDL balance'
    });
  }
});

export default router;
