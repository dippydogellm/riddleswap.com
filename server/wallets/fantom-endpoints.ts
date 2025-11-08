// Fantom Wallet Endpoints - EVM Compatible
import { Router, Request, Response } from 'express';
import { ethers } from 'ethers';

const router = Router();

// Fantom RPC endpoints
const FANTOM_RPC_ENDPOINTS = [
  'https://rpc.ftm.tools/',
  'https://rpc.ankr.com/fantom',
  'https://fantom.public-rpc.com'
];

// FTM Balance - Real RPC data
router.get('/fantom/balance/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    console.log(`🔍 [FTM] Getting balance for: ${address}`);
    
    // Validate address format
    if (!ethers.isAddress(address)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Ethereum address format'
      });
    }
    
    let balance = 0;
    let rpcSuccess = false;
    
    for (const rpcUrl of FANTOM_RPC_ENDPOINTS) {
      try {
        const response = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_getBalance',
            params: [address, 'latest'],
            id: 1
          }),
          signal: AbortSignal.timeout(10000)
        });
        
        if (!response.ok) continue;
        
        const data = await response.json() as any;
        if (data.error) continue;
        
        if (data.result) {
          balance = parseInt(data.result, 16) / Math.pow(10, 18);
          rpcSuccess = true;
          console.log(`✅ [FTM] Balance from ${rpcUrl}: ${balance.toFixed(6)} FTM`);
          break;
        }
      } catch (rpcError) {
        console.log(`⚠️ [FTM] RPC ${rpcUrl} failed:`, rpcError);
        continue;
      }
    }
    
    if (!rpcSuccess) {
      throw new Error('All FTM RPC endpoints failed');
    }
    
    // Get FTM price for USD value
    let usdValue = 0;
    try {
      const priceResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=fantom&vs_currencies=usd', {
        signal: AbortSignal.timeout(5000)
      });
      if (priceResponse.ok) {
        const priceData = await priceResponse.json();
        const ftmPrice = priceData.fantom?.usd || 0.7;
        usdValue = parseFloat((balance * ftmPrice).toFixed(2));
      }
    } catch (priceError) {
      console.log('⚠️ [FTM] Price fetch failed:', priceError);
    }
    
    res.json({
      success: true,
      address,
      balance: balance.toFixed(6),
      balanceUsd: usdValue
    });
    
  } catch (error) {
    console.error(`❌ [FTM] Balance fetch failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'FTM balance fetch failed'
    });
  }
});

// Helper function to get balance data directly (internal use)
async function getFantomBalanceData(address: string) {
  console.log(`🔍 [FTM] Getting balance for: ${address}`);
  
  // Validate address format
  if (!ethers.isAddress(address)) {
    throw new Error('Invalid Ethereum address format');
  }
  
  let balance = 0;
  let rpcSuccess = false;
  
  for (const rpcUrl of FANTOM_RPC_ENDPOINTS) {
    try {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getBalance',
          params: [address, 'latest'],
          id: 1
        }),
        signal: AbortSignal.timeout(10000)
      });
      
      if (!response.ok) continue;
      
      const data = await response.json() as any;
      if (data.error) continue;
      
      if (data.result) {
        balance = parseInt(data.result, 16) / Math.pow(10, 18);
        rpcSuccess = true;
        console.log(`✅ [FTM] Balance from ${rpcUrl}: ${balance.toFixed(6)} FTM`);
        break;
      }
    } catch (rpcError) {
      console.log(`⚠️ [FTM] RPC ${rpcUrl} failed:`, rpcError);
      continue;
    }
  }
  
  if (!rpcSuccess) {
    throw new Error('All FTM RPC endpoints failed');
  }
  
  // Get FTM price for USD value
  let usdValue = 0;
  try {
    const priceResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=fantom&vs_currencies=usd', {
      signal: AbortSignal.timeout(5000)
    });
    if (priceResponse.ok) {
      const priceData = await priceResponse.json();
      const ftmPrice = priceData.fantom?.usd || 0.7;
      usdValue = parseFloat((balance * ftmPrice).toFixed(2));
    }
  } catch (priceError) {
    console.log('⚠️ [FTM] Price fetch failed:', priceError);
  }
  
  return {
    success: true,
    address,
    balance: balance.toFixed(6),
    balanceUsd: usdValue
  };
}

// FTM Portfolio data - Using direct function calls instead of HTTP
router.get('/fantom/portfolio/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    
    // Get balance data directly (no HTTP call needed)
    const balanceData = await getFantomBalanceData(address);
    const tokens: any[] = []; // Tokens endpoint returns empty array anyway
    
    const ftmUsdValue = parseFloat(balanceData.balanceUsd.toString()) || 0;
    const tokensUsdValue = tokens.reduce((sum: number, token: any) => sum + (token.balanceUsd || 0), 0);
    const totalUsdValue = (ftmUsdValue + tokensUsdValue).toFixed(2);
    
    res.json({
      success: true,
      chain: 'fantom',
      address,
      balance: balanceData.balance,
      usdValue: totalUsdValue,
      tokens,
      nfts: []
    });
    
  } catch (error) {
    console.error(`❌ [FTM] Portfolio fetch failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'FTM portfolio fetch failed'
    });
  }
});

// FTM Tokens - Basic implementation
router.get('/fantom/tokens/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    console.log(`🪙 [FTM] Getting tokens for: ${address}`);
    
    if (!ethers.isAddress(address)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Ethereum address'
      });
    }
    
    // For now return empty - can add real token detection later
    res.json({
      success: true,
      address,
      tokens: []
    });
    
  } catch (error) {
    console.error(`❌ [FTM] Tokens fetch failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'FTM tokens fetch failed'
    });
  }
});

// FTM NFTs
router.get('/fantom/nfts/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    
    res.json({
      success: true,
      address,
      nfts: []
    });
    
  } catch (error) {
    console.error(`❌ [FTM] NFTs fetch failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'FTM NFTs fetch failed'
    });
  }
});

// FTM Transactions
router.get('/fantom/transactions/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    
    res.json({
      success: true,
      address,
      transactions: []
    });
    
  } catch (error) {
    console.error(`❌ [FTM] Transactions fetch failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'FTM transactions fetch failed'
    });
  }
});

export default router;