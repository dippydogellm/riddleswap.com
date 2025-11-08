// Optimism Endpoints - ETH on Optimism L2
import { Router, Request, Response } from 'express';

const router = Router();

// Optimism Balance - Real RPC data
router.get('/optimism/balance/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    console.log(`🔍 [OPTIMISM] Getting balance for: ${address}`);
    
    const opResponse = await fetch('https://mainnet.optimism.io', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getBalance',
        params: [address, 'latest'],
        id: 1
      })
    });
    
    const opData = await opResponse.json();
    
    if (opData.error) {
      throw new Error(`Optimism RPC Error: ${opData.error.message}`);
    }
    
    // Convert wei to ETH
    const balance = opData.result ? parseInt(opData.result, 16) / Math.pow(10, 18) : 0;
    
    console.log(`💰 [OPTIMISM] Balance: ${balance.toFixed(6)} ETH`);
    
    // Get ETH price for USD value
    let usdValue = 0;
    try {
      const priceResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
      const priceData = await priceResponse.json();
      const ethPrice = priceData.ethereum?.usd || 3500;
      usdValue = parseFloat((balance * ethPrice).toFixed(2));
    } catch (priceError) {
      console.log('⚠️ [OPTIMISM] Price fetch failed, using 0');
    }
    
    res.json({
      success: true,
      address,
      balance: balance.toFixed(6),
      balanceUsd: usdValue,
      chain: 'optimism',
      symbol: 'ETH'
    });
    
  } catch (error) {
    console.error(`❌ [OPTIMISM] Balance fetch failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Optimism balance fetch failed'
    });
  }
});

// Other endpoints
router.get('/optimism/tokens/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    console.log(`🪙 [OPTIMISM] Getting tokens for: ${address}`);
    
    res.json({
      success: true,
      address,
      tokens: []
    });
    
  } catch (error) {
    console.error(`❌ [OPTIMISM] Tokens fetch failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Optimism tokens fetch failed'
    });
  }
});

router.get('/optimism/transactions/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    console.log(`📊 [OPTIMISM] Getting transactions for: ${address}`);
    
    res.json({
      success: true,
      address,
      transactions: []
    });
    
  } catch (error) {
    console.error(`❌ [OPTIMISM] Transactions fetch failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Optimism transactions fetch failed'
    });
  }
});

export default router;