// Linea Wallet Endpoints - EVM Compatible
import { Router, Request, Response } from 'express';
import { ethers } from 'ethers';

const router = Router();

// Linea RPC endpoints
const LINEA_RPC_ENDPOINTS = [
  'https://rpc.linea.build',
  'https://linea.rpc.grove.city/v1/a7a7c8e2',
  'https://linea.public-rpc.com'
];

// ETH Balance on Linea - Real RPC data
router.get('/linea/balance/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    console.log(`🔍 [LINEA] Getting balance for: ${address}`);
    
    // Validate address format
    if (!ethers.isAddress(address)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Ethereum address format'
      });
    }
    
    let balance = 0;
    let rpcSuccess = false;
    
    for (const rpcUrl of LINEA_RPC_ENDPOINTS) {
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
          console.log(`✅ [LINEA] Balance from ${rpcUrl}: ${balance.toFixed(6)} ETH`);
          break;
        }
      } catch (rpcError) {
        console.log(`⚠️ [LINEA] RPC ${rpcUrl} failed:`, rpcError);
        continue;
      }
    }
    
    if (!rpcSuccess) {
      throw new Error('All Linea RPC endpoints failed');
    }
    
    // Get ETH price for USD value (Linea uses ETH)
    let usdValue = 0;
    try {
      const priceResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd', {
        signal: AbortSignal.timeout(5000)
      });
      if (priceResponse.ok) {
        const priceData = await priceResponse.json();
        const ethPrice = priceData.ethereum?.usd || 3500;
        usdValue = parseFloat((balance * ethPrice).toFixed(2));
      }
    } catch (priceError) {
      console.log('⚠️ [LINEA] Price fetch failed:', priceError);
    }
    
    res.json({
      success: true,
      address,
      balance: balance.toFixed(6),
      balanceUsd: usdValue
    });
    
  } catch (error) {
    console.error(`❌ [LINEA] Balance fetch failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Linea balance fetch failed'
    });
  }
});

// Helper function to get balance data directly (internal use)
async function getLineaBalanceData(address: string) {
  console.log(`🔍 [LINEA] Getting balance for: ${address}`);
  
  // Validate address format
  if (!ethers.isAddress(address)) {
    throw new Error('Invalid Ethereum address format');
  }
  
  let balance = 0;
  let rpcSuccess = false;
  
  for (const rpcUrl of LINEA_RPC_ENDPOINTS) {
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
        console.log(`✅ [LINEA] Balance from ${rpcUrl}: ${balance.toFixed(6)} ETH`);
        break;
      }
    } catch (rpcError) {
      console.log(`⚠️ [LINEA] RPC ${rpcUrl} failed:`, rpcError);
      continue;
    }
  }
  
  if (!rpcSuccess) {
    throw new Error('All Linea RPC endpoints failed');
  }
  
  // Get ETH price for USD value (Linea uses ETH)
  let usdValue = 0;
  try {
    const priceResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd', {
      signal: AbortSignal.timeout(5000)
    });
    if (priceResponse.ok) {
      const priceData = await priceResponse.json();
      const ethPrice = priceData.ethereum?.usd || 3500;
      usdValue = parseFloat((balance * ethPrice).toFixed(2));
    }
  } catch (priceError) {
    console.log('⚠️ [LINEA] Price fetch failed:', priceError);
  }
  
  return {
    success: true,
    address,
    balance: balance.toFixed(6),
    balanceUsd: usdValue
  };
}

// Linea Portfolio data - Using direct function calls instead of HTTP
router.get('/linea/portfolio/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    
    // Get balance data directly (no HTTP call needed)
    const balanceData = await getLineaBalanceData(address);
    const tokens: any[] = []; // Tokens endpoint returns empty array anyway
    
    const ethUsdValue = parseFloat(balanceData.balanceUsd.toString()) || 0;
    const tokensUsdValue = tokens.reduce((sum: number, token: any) => sum + (token.balanceUsd || 0), 0);
    const totalUsdValue = (ethUsdValue + tokensUsdValue).toFixed(2);
    
    res.json({
      success: true,
      chain: 'linea',
      address,
      balance: balanceData.balance,
      usdValue: totalUsdValue,
      tokens,
      nfts: []
    });
    
  } catch (error) {
    console.error(`❌ [LINEA] Portfolio fetch failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Linea portfolio fetch failed'
    });
  }
});

// Linea Tokens - Basic implementation
router.get('/linea/tokens/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    console.log(`🪙 [LINEA] Getting tokens for: ${address}`);
    
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
    console.error(`❌ [LINEA] Tokens fetch failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Linea tokens fetch failed'
    });
  }
});

// Linea NFTs
router.get('/linea/nfts/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    
    res.json({
      success: true,
      address,
      nfts: []
    });
    
  } catch (error) {
    console.error(`❌ [LINEA] NFTs fetch failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Linea NFTs fetch failed'
    });
  }
});

// Linea Transactions
router.get('/linea/transactions/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    
    res.json({
      success: true,
      address,
      transactions: []
    });
    
  } catch (error) {
    console.error(`❌ [LINEA] Transactions fetch failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Linea transactions fetch failed'
    });
  }
});

export default router;