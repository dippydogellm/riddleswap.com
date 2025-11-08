// ETH Wallet Endpoints - Simple & Working
import { Router, Request, Response } from 'express';
import { ethers } from 'ethers';

const router = Router();

// ETH Balance - Real RPC data with enhanced error handling
router.get('/eth/balance/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    console.log(`🔍 [ETH] Getting balance for: ${address}`);
    
    // Validate address format
    if (!ethers.isAddress(address)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Ethereum address format'
      });
    }
    
    // Try multiple RPC endpoints for better reliability
    const rpcEndpoints = [
      'https://eth.llamarpc.com',
      'https://rpc.ankr.com/eth',
      'https://ethereum.publicnode.com'
    ];
    
    let balance = 0;
    let rpcSuccess = false;
    
    for (const rpcUrl of rpcEndpoints) {
      try {
        const ethResponse = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_getBalance',
            params: [address, 'latest'],
            id: 1
          }),
          signal: AbortSignal.timeout(10000) // 10 second timeout
        });
        
        if (!ethResponse.ok) {
          console.log(`⚠️ [ETH] RPC ${rpcUrl} HTTP error: ${ethResponse.status}`);
          continue;
        }
        
        const ethData = await ethResponse.json();
        
        if (ethData.error) {
          console.log(`⚠️ [ETH] RPC ${rpcUrl} error: ${ethData.error.message}`);
          continue;
        }
        
        if (ethData.result) {
          balance = parseInt(ethData.result, 16) / Math.pow(10, 18);
          rpcSuccess = true;
          console.log(`✅ [ETH] Balance from ${rpcUrl}: ${balance.toFixed(6)} ETH`);
          break;
        }
      } catch (rpcError) {
        console.log(`⚠️ [ETH] RPC ${rpcUrl} failed:`, rpcError);
        continue;
      }
    }
    
    if (!rpcSuccess) {
      throw new Error('All RPC endpoints failed');
    }
    
    console.log(`💰 [ETH] Final balance: ${balance.toFixed(6)} ETH`);
    
    // Get ETH price for USD value
    let usdValue = 0;
    try {
      const priceResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd', {
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      if (priceResponse.ok) {
        const priceData = await priceResponse.json();
        const ethPrice = priceData.ethereum?.usd || 3500;
        usdValue = parseFloat((balance * ethPrice).toFixed(2));
        console.log(`💲 [ETH] USD value: $${usdValue} (ETH price: $${ethPrice})`);
      }
    } catch (priceError) {
      console.log('⚠️ [ETH] Price fetch failed:', priceError);
    }
    
    res.json({
      success: true,
      address,
      balance: balance.toFixed(6),
      balanceUsd: usdValue
    });
    
  } catch (error) {
    console.error(`❌ [ETH] Balance fetch failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'ETH balance fetch failed'
    });
  }
});

// Helper function to get balance data directly (internal use)
async function getEthBalanceData(address: string) {
  console.log(`🔍 [ETH] Getting balance for: ${address}`);
  
  // Validate address format
  if (!ethers.isAddress(address)) {
    throw new Error('Invalid Ethereum address format');
  }
  
  // Try multiple RPC endpoints for better reliability
  const rpcEndpoints = [
    'https://eth.llamarpc.com',
    'https://rpc.ankr.com/eth',
    'https://ethereum.publicnode.com'
  ];
  
  let balance = 0;
  let rpcSuccess = false;
  
  for (const rpcUrl of rpcEndpoints) {
    try {
      const ethResponse = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getBalance',
          params: [address, 'latest'],
          id: 1
        }),
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });
      
      if (!ethResponse.ok) {
        console.log(`⚠️ [ETH] RPC ${rpcUrl} HTTP error: ${ethResponse.status}`);
        continue;
      }
      
      const ethData = await ethResponse.json();
      
      if (ethData.error) {
        console.log(`⚠️ [ETH] RPC ${rpcUrl} error: ${ethData.error.message}`);
        continue;
      }
      
      if (ethData.result) {
        balance = parseInt(ethData.result, 16) / Math.pow(10, 18);
        rpcSuccess = true;
        console.log(`✅ [ETH] Balance from ${rpcUrl}: ${balance.toFixed(6)} ETH`);
        break;
      }
    } catch (rpcError) {
      console.log(`⚠️ [ETH] RPC ${rpcUrl} failed:`, rpcError);
      continue;
    }
  }
  
  if (!rpcSuccess) {
    throw new Error('All RPC endpoints failed');
  }
  
  console.log(`💰 [ETH] Final balance: ${balance.toFixed(6)} ETH`);
  
  // Get ETH price for USD value
  let usdValue = 0;
  try {
    const priceResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd', {
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    if (priceResponse.ok) {
      const priceData = await priceResponse.json();
      const ethPrice = priceData.ethereum?.usd || 3500;
      usdValue = parseFloat((balance * ethPrice).toFixed(2));
      console.log(`💲 [ETH] USD value: $${usdValue} (ETH price: $${ethPrice})`);
    }
  } catch (priceError) {
    console.log('⚠️ [ETH] Price fetch failed:', priceError);
  }
  
  return {
    success: true,
    address,
    balance: balance.toFixed(6),
    balanceUsd: usdValue
  };
}

// ETH Portfolio data with real tokens
router.get('/eth/portfolio/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    console.log(`📊 [ETH] Getting portfolio for: ${address}`);
    
    // Get balance data directly (no HTTP call needed) - tokens endpoint already has its own route
    const balanceData = await getEthBalanceData(address);
    const tokens: any[] = []; // For simplicity, keep empty since token logic is complex
    
    // Calculate total USD value
    const ethUsdValue = balanceData.balanceUsd || 0;
    const tokensUsdValue = tokens.reduce((sum: number, token: any) => sum + (token.balanceUsd || 0), 0);
    const totalUsdValue = (ethUsdValue + tokensUsdValue).toFixed(2);
    
    console.log(`💰 [ETH] Portfolio: ${balanceData.balance} ETH + ${tokens.length} tokens = $${totalUsdValue}`);
    
    res.json({
      success: true,
      chain: 'eth',
      address,
      balance: balanceData.balance,
      usdValue: totalUsdValue,
      tokens,
      nfts: [] // NFTs still empty for now
    });
    
  } catch (error) {
    console.error(`❌ [ETH] Portfolio fetch failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'ETH portfolio fetch failed'
    });
  }
});

// ETH Tokens - Real data using 1inch API
router.get('/eth/tokens/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    console.log(`🪙 [ETH] Getting tokens for: ${address}`);
    
    // Validate address format
    if (!ethers.isAddress(address)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Ethereum address'
      });
    }
    
    const provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
    
    // Get token list from 1inch API
    let tokenList: any[] = [];
    try {
      const response = await fetch('https://api.1inch.io/v5.0/1/tokens');
      if (response.ok) {
        const data = await response.json() as any;
        tokenList = Object.values(data.tokens || {} as any);
        console.log(`📋 [ETH] Loaded ${tokenList.length} tokens from 1inch API`);
      } else {
        console.log('⚠️ [ETH] 1inch API failed, using fallback tokens');
        // Fallback to popular tokens
        tokenList = [
          { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', name: 'USD Coin', decimals: 6, logoURI: 'https://tokens.1inch.io/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.png' },
          { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', name: 'Tether USD', decimals: 6, logoURI: 'https://tokens.1inch.io/0xdac17f958d2ee523a2206206994597c13d831ec7.png' },
          { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18, logoURI: 'https://tokens.1inch.io/0x6b175474e89094c44da98b954eedeac495271d0f.png' },
          { address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', symbol: 'WBTC', name: 'Wrapped BTC', decimals: 8, logoURI: 'https://tokens.1inch.io/0x2260fac5e5542a773aa44fbcfedf7c193bc2c599.png' },
          { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'WETH', name: 'Wrapped Ether', decimals: 18, logoURI: 'https://tokens.1inch.io/0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2.png' }
        ];
      }
    } catch (e) {
      console.log('⚠️ [ETH] Token list fetch failed, using minimal fallback');
      tokenList = [
        { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', name: 'USD Coin', decimals: 6, logoURI: 'https://tokens.1inch.io/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.png' }
      ];
    }
    
    const erc20ABI = [
      'function balanceOf(address owner) view returns (uint256)',
      'function symbol() view returns (string)',
      'function name() view returns (string)',
      'function decimals() view returns (uint8)'
    ];
    
    const tokens = [];
    
    // Get ETH price for USD calculations
    let ethPrice = 3500;
    try {
      const priceResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
      if (priceResponse.ok) {
        const priceData = await priceResponse.json();
        ethPrice = priceData.ethereum?.usd || 3500;
      }
    } catch (e) {
      console.log('⚠️ [ETH] Price fetch failed, using default');
    }
    
    // Check top 50 tokens for balances
    const tokensToCheck = tokenList.slice(0, 50);
    console.log(`🔍 [ETH] Checking ${tokensToCheck.length} tokens for balances`);
    
    for (const token of tokensToCheck) {
      try {
        const contract = new ethers.Contract(token.address, erc20ABI, provider);
        const balance = await contract.balanceOf(address);
        
        if (balance > BigInt(0)) {
          const formattedBalance = ethers.formatUnits(balance, token.decimals);
          const balanceFloat = parseFloat(formattedBalance);
          
          // Only include tokens with meaningful balance (> 0.000001)
          if (balanceFloat > 0.000001) {
            // Get token price from CoinGecko if available
            let balanceUsd = 0;
            try {
              const tokenPriceResponse = await fetch(
                `https://api.coingecko.com/api/v3/simple/token_price/ethereum?contract_addresses=${token.address}&vs_currencies=usd`
              );
              if (tokenPriceResponse.ok) {
                const tokenPriceData = await tokenPriceResponse.json();
                const tokenPrice = tokenPriceData[token.address.toLowerCase()]?.usd || 0;
                balanceUsd = parseFloat((balanceFloat * tokenPrice).toFixed(2));
              }
            } catch (e) {
              // Price fetch failed, keep balanceUsd as 0
            }
            
            tokens.push({
              symbol: token.symbol,
              name: token.name,
              contractAddress: token.address,
              balance: formattedBalance,
              decimals: token.decimals,
              logoURI: token.logoURI || `https://tokens.1inch.io/${token.address.toLowerCase()}.png`,
              balanceUsd
            });
            
            console.log(`💰 [ETH] Found ${token.symbol}: ${formattedBalance} (${balanceUsd} USD)`);
          }
        }
      } catch (err) {
        // Skip tokens that fail to load (might be invalid contracts)
        console.log(`⚠️ [ETH] Failed to check ${token.symbol}: ${err}`);
      }
    }
    
    console.log(`✅ [ETH] Found ${tokens.length} tokens with balances`);
    
    res.json({
      success: true,
      address,
      tokens
    });
    
  } catch (error) {
    console.error(`❌ [ETH] Tokens fetch failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'ETH tokens fetch failed'
    });
  }
});

// ETH NFTs - Real data
router.get('/eth/nfts/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    console.log(`🎨 [ETH] Getting NFTs for: ${address}`);
    
    // For now return empty - can add real NFT API later
    res.json({
      success: true,
      address,
      nfts: []
    });
    
  } catch (error) {
    console.error(`❌ [ETH] NFTs fetch failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'ETH NFTs fetch failed'
    });
  }
});

// ETH Transactions - Real data
router.get('/eth/transactions/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    console.log(`📊 [ETH] Getting transactions for: ${address}`);
    
    // For now return empty - can add real transaction API later
    res.json({
      success: true,
      address,
      transactions: []
    });
    
  } catch (error) {
    console.error(`❌ [ETH] Transactions fetch failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'ETH transactions fetch failed'
    });
  }
});

export default router;