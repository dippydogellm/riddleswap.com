// Base Endpoints - ETH on Base L2
import { Router, Request, Response } from 'express';

const router = Router();

// Base Balance - Real RPC data
router.get('/base/balance/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    console.log(`🔍 [BASE] Getting balance for: ${address}`);
    
    const baseResponse = await fetch('https://mainnet.base.org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getBalance',
        params: [address, 'latest'],
        id: 1
      })
    });
    
    const baseData = await baseResponse.json();
    
    if (baseData.error) {
      throw new Error(`Base RPC Error: ${baseData.error.message}`);
    }
    
    // Convert wei to ETH
    const balance = baseData.result ? parseInt(baseData.result, 16) / Math.pow(10, 18) : 0;
    
    console.log(`💰 [BASE] Balance: ${balance.toFixed(6)} ETH`);
    
    // Get ETH price for USD value
    let usdValue = 0;
    try {
      const priceResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
      const priceData = await priceResponse.json();
      const ethPrice = priceData.ethereum?.usd || 3500;
      usdValue = parseFloat((balance * ethPrice).toFixed(2));
    } catch (priceError) {
      console.log('⚠️ [BASE] Price fetch failed, using 0');
    }
    
    res.json({
      success: true,
      address,
      balance: balance.toFixed(6),
      balanceUsd: usdValue,
      chain: 'base',
      symbol: 'ETH'
    });
    
  } catch (error) {
    console.error(`❌ [BASE] Balance fetch failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Base balance fetch failed'
    });
  }
});

// Other endpoints
router.get('/base/tokens/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    console.log(`🪙 [BASE] Getting tokens for: ${address}`);
    
    res.json({
      success: true,
      address,
      tokens: []
    });
    
  } catch (error) {
    console.error(`❌ [BASE] Tokens fetch failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Base tokens fetch failed'
    });
  }
});

router.get('/base/transactions/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    console.log(`📊 [BASE] Getting transactions for: ${address}`);
    
    res.json({
      success: true,
      address,
      transactions: []
    });
    
  } catch (error) {
    console.error(`❌ [BASE] Transactions fetch failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Base transactions fetch failed'
    });
  }
});

export default router;