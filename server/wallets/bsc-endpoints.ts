// BSC Endpoints - BNB native token
import { Router, Request, Response } from 'express';

const router = Router();

// Add middleware to set JSON content type for all responses
router.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

// BSC Balance - Real RPC data (BNB token)
router.get('/bsc/balance/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    console.log(`🔍 [BSC] Getting balance for: ${address}`);
    
    const bscResponse = await fetch('https://bsc-dataseed.binance.org/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getBalance',
        params: [address, 'latest'],
        id: 1
      })
    });
    
    const bscData = await bscResponse.json();
    
    if (bscData.error) {
      throw new Error(`BSC RPC Error: ${bscData.error.message}`);
    }
    
    // Convert wei to BNB (18 decimals)
    const balance = bscData.result ? parseInt(bscData.result, 16) / Math.pow(10, 18) : 0;
    
    console.log(`💰 [BSC] Balance: ${balance.toFixed(6)} BNB`);
    
    // Get BNB price for USD value
    let usdValue = 0;
    try {
      const priceResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd');
      const priceData = await priceResponse.json();
      const bnbPrice = priceData.binancecoin?.usd || 600;
      usdValue = parseFloat((balance * bnbPrice).toFixed(2));
    } catch (priceError) {
      console.log('⚠️ [BSC] Price fetch failed, using 0');
    }
    
    res.json({
      success: true,
      address,
      balance: balance.toFixed(6),
      balanceUsd: usdValue,
      chain: 'bsc',
      symbol: 'BNB'
    });
    
  } catch (error) {
    console.error(`❌ [BSC] Balance fetch failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'BSC balance fetch failed'
    });
  }
});

// Other endpoints
router.get('/bsc/tokens/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    console.log(`🪙 [BSC] Getting tokens for: ${address}`);
    
    res.json({
      success: true,
      address,
      tokens: []
    });
    
  } catch (error) {
    console.error(`❌ [BSC] Tokens fetch failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'BSC tokens fetch failed'
    });
  }
});

router.get('/bsc/transactions/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    console.log(`📊 [BSC] Getting transactions for: ${address}`);
    
    res.json({
      success: true,
      address,
      transactions: []
    });
    
  } catch (error) {
    console.error(`❌ [BSC] Transactions fetch failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'BSC transactions fetch failed'
    });
  }
});

export default router;