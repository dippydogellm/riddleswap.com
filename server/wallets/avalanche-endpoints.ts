// Avalanche Wallet Endpoints - EVM Compatible
import { Router, Request, Response } from 'express';
import { ethers } from 'ethers';

const router = Router();

// Avalanche RPC endpoints
const AVALANCHE_RPC_ENDPOINTS = [
  'https://api.avax.network/ext/bc/C/rpc',
  'https://rpc.ankr.com/avalanche',
  'https://avalanche.public-rpc.com'
];

// AVAX Balance - Real RPC data
router.get('/avalanche/balance/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    console.log(`🔍 [AVAX] Getting balance for: ${address}`);
    
    // Validate address format
    if (!ethers.isAddress(address)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Ethereum address format'
      });
    }
    
    let balance = 0;
    let rpcSuccess = false;
    
    for (const rpcUrl of AVALANCHE_RPC_ENDPOINTS) {
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
          console.log(`✅ [AVAX] Balance from ${rpcUrl}: ${balance.toFixed(6)} AVAX`);
          break;
        }
      } catch (rpcError) {
        console.log(`⚠️ [AVAX] RPC ${rpcUrl} failed:`, rpcError);
        continue;
      }
    }
    
    if (!rpcSuccess) {
      throw new Error('All AVAX RPC endpoints failed');
    }
    
    // Get AVAX price for USD value
    let usdValue = 0;
    try {
      const priceResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=avalanche-2&vs_currencies=usd', {
        signal: AbortSignal.timeout(5000)
      });
      if (priceResponse.ok) {
        const priceData = await priceResponse.json();
        const avaxPrice = priceData['avalanche-2']?.usd || 35;
        usdValue = parseFloat((balance * avaxPrice).toFixed(2));
      }
    } catch (priceError) {
      console.log('⚠️ [AVAX] Price fetch failed:', priceError);
    }
    
    res.json({
      success: true,
      address,
      balance: balance.toFixed(6),
      balanceUsd: usdValue
    });
    
  } catch (error) {
    console.error(`❌ [AVAX] Balance fetch failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'AVAX balance fetch failed'
    });
  }
});

// Helper function to get balance data directly (internal use)
async function getAvaxBalanceData(address: string) {
  console.log(`🔍 [AVAX] Getting balance for: ${address}`);
  
  // Validate address format
  if (!ethers.isAddress(address)) {
    throw new Error('Invalid Ethereum address format');
  }
  
  let balance = 0;
  let rpcSuccess = false;
  
  for (const rpcUrl of AVALANCHE_RPC_ENDPOINTS) {
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
        console.log(`✅ [AVAX] Balance from ${rpcUrl}: ${balance.toFixed(6)} AVAX`);
        break;
      }
    } catch (rpcError) {
      console.log(`⚠️ [AVAX] RPC ${rpcUrl} failed:`, rpcError);
      continue;
    }
  }
  
  if (!rpcSuccess) {
    throw new Error('All AVAX RPC endpoints failed');
  }
  
  // Get AVAX price for USD value
  let usdValue = 0;
  try {
    const priceResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=avalanche-2&vs_currencies=usd', {
      signal: AbortSignal.timeout(5000)
    });
    if (priceResponse.ok) {
      const priceData = await priceResponse.json();
      const avaxPrice = priceData['avalanche-2']?.usd || 35;
      usdValue = parseFloat((balance * avaxPrice).toFixed(2));
    }
  } catch (priceError) {
    console.log('⚠️ [AVAX] Price fetch failed:', priceError);
  }
  
  return {
    success: true,
    address,
    balance: balance.toFixed(6),
    balanceUsd: usdValue
  };
}

// AVAX Portfolio data - Using direct function calls instead of HTTP
router.get('/avalanche/portfolio/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    
    // Get balance data directly (no HTTP call needed)
    const balanceData = await getAvaxBalanceData(address);
    const tokens: any[] = []; // Tokens endpoint returns empty array anyway
    
    const avaxUsdValue = parseFloat(balanceData.balanceUsd.toString()) || 0;
    const tokensUsdValue = tokens.reduce((sum: number, token: any) => sum + (token.balanceUsd || 0), 0);
    const totalUsdValue = (avaxUsdValue + tokensUsdValue).toFixed(2);
    
    res.json({
      success: true,
      chain: 'avalanche',
      address,
      balance: balanceData.balance,
      usdValue: totalUsdValue,
      tokens,
      nfts: []
    });
    
  } catch (error) {
    console.error(`❌ [AVAX] Portfolio fetch failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'AVAX portfolio fetch failed'
    });
  }
});

// AVAX Tokens - Basic implementation
router.get('/avalanche/tokens/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    console.log(`🪙 [AVAX] Getting tokens for: ${address}`);
    
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
    console.error(`❌ [AVAX] Tokens fetch failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'AVAX tokens fetch failed'
    });
  }
});

// AVAX NFTs
router.get('/avalanche/nfts/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    
    res.json({
      success: true,
      address,
      nfts: []
    });
    
  } catch (error) {
    console.error(`❌ [AVAX] NFTs fetch failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'AVAX NFTs fetch failed'
    });
  }
});

// AVAX Transactions
router.get('/avalanche/transactions/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    
    res.json({
      success: true,
      address,
      transactions: []
    });
    
  } catch (error) {
    console.error(`❌ [AVAX] Transactions fetch failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'AVAX transactions fetch failed'
    });
  }
});

export default router;