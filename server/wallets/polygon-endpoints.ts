// Polygon Endpoints - MATIC native token
import { Router, Request, Response } from 'express';

const router = Router();

// Polygon Balance - Real RPC data (MATIC token)
router.get('/polygon/balance/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    console.log(`🔍 [POLYGON] Getting balance for: ${address}`);
    
    const polygonResponse = await fetch('https://polygon-rpc.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getBalance',
        params: [address, 'latest'],
        id: 1
      })
    });
    
    const polygonData = await polygonResponse.json();
    
    if (polygonData.error) {
      throw new Error(`Polygon RPC Error: ${polygonData.error.message}`);
    }
    
    // Convert wei to MATIC (18 decimals)
    const balance = polygonData.result ? parseInt(polygonData.result, 16) / Math.pow(10, 18) : 0;
    
    console.log(`💰 [POLYGON] Balance: ${balance.toFixed(6)} MATIC`);
    
    // Get MATIC price for USD value
    let usdValue = 0;
    try {
      const priceResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=matic-network&vs_currencies=usd');
      const priceData = await priceResponse.json();
      const maticPrice = priceData['matic-network']?.usd || 0.8;
      usdValue = parseFloat((balance * maticPrice).toFixed(2));
    } catch (priceError) {
      console.log('⚠️ [POLYGON] Price fetch failed, using 0');
    }
    
    res.json({
      success: true,
      address,
      balance: balance.toFixed(6),
      balanceUsd: usdValue,
      chain: 'polygon',
      symbol: 'MATIC'
    });
    
  } catch (error) {
    console.error(`❌ [POLYGON] Balance fetch failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Polygon balance fetch failed'
    });
  }
});

// Other endpoints
router.get('/polygon/tokens/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    console.log(`🪙 [POLYGON] Getting tokens for: ${address}`);
    
    res.json({
      success: true,
      address,
      tokens: []
    });
    
  } catch (error) {
    console.error(`❌ [POLYGON] Tokens fetch failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Polygon tokens fetch failed'
    });
  }
});

router.get('/polygon/transactions/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    console.log(`📊 [POLYGON] Getting transactions for: ${address}`);
    
    res.json({
      success: true,
      address,
      transactions: []
    });
    
  } catch (error) {
    console.error(`❌ [POLYGON] Transactions fetch failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Polygon transactions fetch failed'
    });
  }
});

export default router;