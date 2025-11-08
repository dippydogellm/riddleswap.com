// Arbitrum Endpoints - ETH on Arbitrum One
import { Router, Request, Response } from 'express';

const router = Router();

// Arbitrum Balance - Real RPC data
router.get('/arbitrum/balance/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    console.log(`🔍 [ARBITRUM] Getting balance for: ${address}`);
    
    const arbResponse = await fetch('https://arb1.arbitrum.io/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getBalance',
        params: [address, 'latest'],
        id: 1
      })
    });
    
    const arbData = await arbResponse.json();
    
    if (arbData.error) {
      throw new Error(`Arbitrum RPC Error: ${arbData.error.message}`);
    }
    
    // Convert wei to ETH
    const balance = arbData.result ? parseInt(arbData.result, 16) / Math.pow(10, 18) : 0;
    
    console.log(`💰 [ARBITRUM] Balance: ${balance.toFixed(6)} ETH`);
    
    // Get ETH price for USD value
    let usdValue = 0;
    try {
      const priceResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
      const priceData = await priceResponse.json();
      const ethPrice = priceData.ethereum?.usd || 3500;
      usdValue = parseFloat((balance * ethPrice).toFixed(2));
    } catch (priceError) {
      console.log('⚠️ [ARBITRUM] Price fetch failed, using 0');
    }
    
    res.json({
      success: true,
      address,
      balance: balance.toFixed(6),
      balanceUsd: usdValue,
      chain: 'arbitrum',
      symbol: 'ETH'
    });
    
  } catch (error) {
    console.error(`❌ [ARBITRUM] Balance fetch failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Arbitrum balance fetch failed'
    });
  }
});

// Other endpoints
router.get('/arbitrum/tokens/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    console.log(`🪙 [ARBITRUM] Getting tokens for: ${address}`);
    
    res.json({
      success: true,
      address,
      tokens: []
    });
    
  } catch (error) {
    console.error(`❌ [ARBITRUM] Tokens fetch failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Arbitrum tokens fetch failed'
    });
  }
});

router.get('/arbitrum/transactions/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    console.log(`📊 [ARBITRUM] Getting transactions for: ${address}`);
    
    res.json({
      success: true,
      address,
      transactions: []
    });
    
  } catch (error) {
    console.error(`❌ [ARBITRUM] Transactions fetch failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Arbitrum transactions fetch failed'
    });
  }
});

export default router;