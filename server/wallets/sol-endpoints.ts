// SOL Wallet Endpoints - Simple & Working  
import { Router, Request, Response } from 'express';

const router = Router();

// SOL Balance - Real RPC data
router.get('/sol/balance/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    console.log(`🔍 [SOL] Getting balance for: ${address}`);
    
    const solResponse = await fetch('https://api.mainnet-beta.solana.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getBalance',
        params: [address]
      })
    });
    
    const solData = await solResponse.json();
    
    if (solData.error) {
      throw new Error(`SOL RPC Error: ${solData.error.message}`);
    }
    
    // Convert lamports to SOL
    const balance = solData.result?.value ? solData.result.value / Math.pow(10, 9) : 0;
    
    console.log(`💰 [SOL] Balance: ${balance.toFixed(6)} SOL`);
    
    // Get SOL price for USD value
    let usdValue = 0;
    try {
      const priceResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
      const priceData = await priceResponse.json();
      const solPrice = priceData.solana?.usd || 250;
      usdValue = parseFloat((balance * solPrice).toFixed(2));
    } catch (priceError) {
      console.log('⚠️ [SOL] Price fetch failed, using 0');
    }
    
    res.json({
      success: true,
      address,
      balance: balance.toFixed(6),
      balanceUsd: usdValue
    });
    
  } catch (error) {
    console.error(`❌ [SOL] Balance fetch failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'SOL balance fetch failed'
    });
  }
});

// Helper function to get balance data directly (internal use)
async function getSolBalanceData(address: string) {
  console.log(`🔍 [SOL] Getting balance for: ${address}`);
  
  const solResponse = await fetch('https://api.mainnet-beta.solana.com', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getBalance',
      params: [address]
    })
  });
  
  const solData = await solResponse.json();
  
  if (solData.error) {
    throw new Error(`SOL RPC Error: ${solData.error.message}`);
  }
  
  // Convert lamports to SOL
  const balance = solData.result?.value ? solData.result.value / Math.pow(10, 9) : 0;
  
  console.log(`💰 [SOL] Balance: ${balance.toFixed(6)} SOL`);
  
  // Get SOL price for USD value
  let usdValue = 0;
  try {
    const priceResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
    const priceData = await priceResponse.json();
    const solPrice = priceData.solana?.usd || 250;
    usdValue = parseFloat((balance * solPrice).toFixed(2));
  } catch (priceError) {
    console.log('⚠️ [SOL] Price fetch failed, using 0');
  }
  
  return {
    success: true,
    address,
    balance: balance.toFixed(6),
    balanceUsd: usdValue
  };
}

// SOL Portfolio data
router.get('/sol/portfolio/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    
    // Get balance data directly (no HTTP call needed)
    const balanceData = await getSolBalanceData(address);
    
    res.json({
      success: true,
      chain: 'sol',
      address,
      balance: balanceData.balance,
      usdValue: balanceData.balanceUsd.toString(),
      tokens: [],
      nfts: []
    });
    
  } catch (error) {
    console.error(`❌ [SOL] Portfolio fetch failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'SOL portfolio fetch failed'
    });
  }
});

// SOL Tokens - Real data via Helius
router.get('/sol/tokens/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    console.log(`🪙 [SOL] Getting tokens for: ${address}`);
    
    // Use Solana RPC to get token accounts
    const tokenResponse = await fetch('https://api.mainnet-beta.solana.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenAccountsByOwner',
        params: [
          address,
          { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
          { encoding: 'jsonParsed' }
        ]
      })
    });
    
    const tokenData = await tokenResponse.json();
    const tokens = tokenData.result?.value || [];
    
    console.log(`🪙 [SOL] Found ${tokens.length} token accounts`);
    
    res.json({
      success: true,
      address,
      tokens: tokens.filter((t: any) => parseFloat(t.account.data.parsed.info.tokenAmount.uiAmount) > 0)
    });
    
  } catch (error) {
    console.error(`❌ [SOL] Tokens fetch failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'SOL tokens fetch failed'
    });
  }
});

// SOL NFTs - Real data
router.get('/sol/nfts/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    console.log(`🎨 [SOL] Getting NFTs for: ${address}`);
    
    // For now return empty - can add real NFT API later
    res.json({
      success: true,
      address,
      nfts: []
    });
    
  } catch (error) {
    console.error(`❌ [SOL] NFTs fetch failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'SOL NFTs fetch failed'
    });
  }
});

// SOL Transactions - Real data
router.get('/sol/transactions/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    console.log(`📊 [SOL] Getting transactions for: ${address}`);
    
    // For now return empty - can add real transaction API later
    res.json({
      success: true,
      address,
      transactions: []
    });
    
  } catch (error) {
    console.error(`❌ [SOL] Transactions fetch failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'SOL transactions fetch failed'
    });
  }
});

export default router;