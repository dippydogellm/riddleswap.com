// Scroll Wallet Endpoints - EVM Compatible  
import { Router, Request, Response } from 'express';
import { ethers } from 'ethers';

const router = Router();

const SCROLL_RPC_ENDPOINTS = [
  'https://rpc.scroll.io',
  'https://scroll.public-rpc.com'
];

// ETH Balance on Scroll
router.get('/scroll/balance/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    console.log(`🔍 [SCROLL] Getting balance for: ${address}`);
    
    if (!ethers.isAddress(address)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Ethereum address format'
      });
    }
    
    let balance = 0;
    let rpcSuccess = false;
    
    for (const rpcUrl of SCROLL_RPC_ENDPOINTS) {
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
          break;
        }
      } catch (error) {
        continue;
      }
    }
    
    if (!rpcSuccess) {
      throw new Error('All Scroll RPC endpoints failed');
    }
    
    // Use ETH price since Scroll uses ETH
    let usdValue = 0;
    try {
      const priceResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
      if (priceResponse.ok) {
        const priceData = await priceResponse.json();
        const ethPrice = priceData.ethereum?.usd || 3500;
        usdValue = parseFloat((balance * ethPrice).toFixed(2));
      }
    } catch (e) {
      console.log('⚠️ [SCROLL] Price fetch failed');
    }
    
    res.json({
      success: true,
      address,
      balance: balance.toFixed(6),
      balanceUsd: usdValue
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Scroll balance fetch failed'
    });
  }
});

// Helper function to get balance data directly (internal use)
async function getScrollBalanceData(address: string) {
  console.log(`🔍 [SCROLL] Getting balance for: ${address}`);
  
  if (!ethers.isAddress(address)) {
    throw new Error('Invalid Ethereum address format');
  }
  
  let balance = 0;
  let rpcSuccess = false;
  
  for (const rpcUrl of SCROLL_RPC_ENDPOINTS) {
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
        break;
      }
    } catch (error) {
      continue;
    }
  }
  
  if (!rpcSuccess) {
    throw new Error('All Scroll RPC endpoints failed');
  }
  
  // Use ETH price since Scroll uses ETH
  let usdValue = 0;
  try {
    const priceResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
    if (priceResponse.ok) {
      const priceData = await priceResponse.json();
      const ethPrice = priceData.ethereum?.usd || 3500;
      usdValue = parseFloat((balance * ethPrice).toFixed(2));
    }
  } catch (e) {
    console.log('⚠️ [SCROLL] Price fetch failed');
  }
  
  return {
    success: true,
    address,
    balance: balance.toFixed(6),
    balanceUsd: usdValue
  };
}

// Scroll Portfolio - Using direct function calls instead of HTTP
router.get('/scroll/portfolio/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    
    // Get balance data directly (no HTTP call needed)
    const balanceData = await getScrollBalanceData(address);
    
    res.json({
      success: true,
      chain: 'scroll',
      address,
      balance: balanceData.balance,
      usdValue: balanceData.balanceUsd.toString(),
      tokens: [],
      nfts: []
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Scroll portfolio fetch failed' });
  }
});

router.get('/scroll/tokens/:address', async (req: Request, res: Response) => {
  res.json({ success: true, address: req.params.address, tokens: [] });
});

router.get('/scroll/nfts/:address', async (req: Request, res: Response) => {
  res.json({ success: true, address: req.params.address, nfts: [] });
});

router.get('/scroll/transactions/:address', async (req: Request, res: Response) => {
  res.json({ success: true, address: req.params.address, transactions: [] });
});

export default router;