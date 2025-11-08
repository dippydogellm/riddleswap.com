// Separate Balance Systems for Each Chain - No Conflicts
// Each chain has its own independent implementation
// BATCH PROCESSING ONLY - NO INDIVIDUAL API CALLS

import { fetchBalanceV2, formatBalanceV2, formatUSDV2 } from './balance-api-v2';

interface ChainBalance {
  address: string;
  balance: string;
  balanceUSD: number;
  formattedBalance: string;
  formattedUSD: string;
  tokens?: TokenBalance[];
  lastUpdated: number;
}

interface TokenBalance {
  symbol: string;
  name: string;
  balance: string;
  balanceUSD: number;
  price: number;
  logo?: string;
}

// XRP/XRPL Balance System
export async function getXRPBalanceData(address: string): Promise<ChainBalance> {
  try {
    // Fetch XRP balance
    const xrpData = await fetchBalanceV2('XRP', address);
    
    // Fetch XRPL tokens (RDL, etc)
    const tokens: TokenBalance[] = [];
    
    // Use batch endpoint for tokens - NO individual API calls
    try {
      console.log(`🪙 [XRP BATCH] Fetching tokens via batch endpoint for: ${address}`);
      const response = await fetch('/api/v2/tokens/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(window as any).sessionToken || ''}`
        },
        body: JSON.stringify({
          addresses: [{ chain: 'xrp', address }]
        })
      });

      if (response.ok) {
        const data = await response.json() as any;
        console.log(`🪙 [XRP BATCH] Tokens response:`, data);
        
        if (data.success && data.results && data.results.length > 0) {
          const xrpResult = data.results[0];
          if (xrpResult.success && xrpResult.tokens && Array.isArray(xrpResult.tokens)) {
            for (const token of xrpResult.tokens) {
              tokens.push({
                symbol: token.currency || token.symbol,
                name: token.name || token.currency,
                balance: token.balance || token.amount || '0',
                balanceUSD: parseFloat(token.balance || 0) * (token.price_usd || 0),
                price: token.price_usd || 0,
                logo: token.logo
              });
            }
            console.log(`✅ [XRP BATCH] Found ${tokens.length} tokens from batch endpoint`);
          }
        }
      } else {
        console.log(`📍 [XRP BATCH] No tokens response from batch: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ [XRP BATCH] Error fetching tokens via batch:', error);
    }
    
    return {
      address,
      balance: xrpData.balance,
      balanceUSD: xrpData.balanceUSD,
      formattedBalance: formatBalanceV2(xrpData.balance),
      formattedUSD: formatUSDV2(xrpData.balanceUSD),
      tokens,
      lastUpdated: Date.now()
    };
  } catch (error) {
    console.error('XRP balance fetch error:', error);
    return {
      address,
      balance: '0',
      balanceUSD: 0,
      formattedBalance: '0',
      formattedUSD: '$0.00',
      tokens: [],
      lastUpdated: Date.now()
    };
  }
}

// Ethereum Balance System
export async function getETHBalanceData(address: string): Promise<ChainBalance> {
  try {
    // Fetch ETH balance
    const ethData = await fetchBalanceV2('ETH', address);
    
    // Fetch ERC-20 tokens
    const tokens: TokenBalance[] = [];
    
    // Popular ERC-20 tokens to check
    const erc20Tokens = [
      { symbol: 'USDT', contract: '0xdac17f958d2ee523a2206206994597c13d831ec7' },
      { symbol: 'USDC', contract: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' },
      { symbol: 'WETH', contract: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' }
    ];
    
    // Try to fetch token balances
    for (const token of erc20Tokens) {
      try {
        const response = await fetch(`/api/eth/token-balance/${address}/${token.contract}`);
        if (response.ok) {
          const data = await response.json() as any;
          if (data.balance && parseFloat(data.balance) > 0) {
            tokens.push({
              symbol: token.symbol,
              name: token.symbol,
              balance: data.balance,
              balanceUSD: data.balanceUSD || 0,
              price: data.price || 0,
              logo: data.logo
            });
          }
        }
      } catch (error) {
        console.error(`Error fetching ${token.symbol} balance:`, error);
      }
    }
    
    return {
      address,
      balance: ethData.balance,
      balanceUSD: ethData.balanceUSD,
      formattedBalance: formatBalanceV2(ethData.balance),
      formattedUSD: formatUSDV2(ethData.balanceUSD),
      tokens,
      lastUpdated: Date.now()
    };
  } catch (error) {
    console.error('ETH balance fetch error:', error);
    return {
      address,
      balance: '0',
      balanceUSD: 0,
      formattedBalance: '0',
      formattedUSD: '$0.00',
      tokens: [],
      lastUpdated: Date.now()
    };
  }
}

// Solana Balance System
export async function getSOLBalanceData(address: string): Promise<ChainBalance> {
  try {
    // Fetch SOL balance
    const solData = await fetchBalanceV2('SOL', address);
    
    // Fetch SPL tokens
    const tokens: TokenBalance[] = [];
    
    // Try to fetch SPL token accounts
    try {
      const response = await fetch(`/api/sol/tokens/${address}`);
      if (response.ok) {
        const data = await response.json() as any;
        if (data.tokens && Array.isArray(data.tokens)) {
          for (const token of data.tokens) {
            tokens.push({
              symbol: token.symbol || 'Unknown',
              name: token.name || token.symbol || 'Unknown Token',
              balance: token.balance || '0',
              balanceUSD: token.balanceUSD || 0,
              price: token.price || 0,
              logo: token.logo
            });
          }
        }
      }
    } catch (error) {
      console.error('Error fetching SPL tokens:', error);
    }
    
    return {
      address,
      balance: solData.balance,
      balanceUSD: solData.balanceUSD,
      formattedBalance: formatBalanceV2(solData.balance),
      formattedUSD: formatUSDV2(solData.balanceUSD),
      tokens,
      lastUpdated: Date.now()
    };
  } catch (error) {
    console.error('SOL balance fetch error:', error);
    return {
      address,
      balance: '0',
      balanceUSD: 0,
      formattedBalance: '0',
      formattedUSD: '$0.00',
      tokens: [],
      lastUpdated: Date.now()
    };
  }
}

// Bitcoin Balance System
export async function getBTCBalanceData(address: string): Promise<ChainBalance> {
  try {
    // Fetch BTC balance
    const btcData = await fetchBalanceV2('BTC', address);
    
    // Bitcoin doesn't have tokens, just the main balance
    return {
      address,
      balance: btcData.balance,
      balanceUSD: btcData.balanceUSD,
      formattedBalance: formatBalanceV2(btcData.balance),
      formattedUSD: formatUSDV2(btcData.balanceUSD),
      tokens: [], // No tokens on Bitcoin
      lastUpdated: Date.now()
    };
  } catch (error) {
    console.error('BTC balance fetch error:', error);
    return {
      address,
      balance: '0',
      balanceUSD: 0,
      formattedBalance: '0',
      formattedUSD: '$0.00',
      tokens: [],
      lastUpdated: Date.now()
    };
  }
}

// Fetch all chain balances at once
export async function getAllChainBalances(addresses: {
  eth?: string;
  xrp?: string;
  sol?: string;
  btc?: string;
}): Promise<{
  eth?: ChainBalance;
  xrp?: ChainBalance;
  sol?: ChainBalance;
  btc?: ChainBalance;
  totalUSD: number;
}> {
  const results: any = {};
  let totalUSD = 0;

  // Fetch all balances in parallel
  const promises = [];
  
  if (addresses.eth) {
    promises.push(
      getETHBalanceData(addresses.eth).then(data => {
        results.eth = data;
        totalUSD += data.balanceUSD;
        if (data.tokens) {
          totalUSD += data.tokens.reduce((sum, t) => sum + t.balanceUSD, 0);
        }
      })
    );
  }
  
  if (addresses.xrp) {
    promises.push(
      getXRPBalanceData(addresses.xrp).then(data => {
        results.xrp = data;
        totalUSD += data.balanceUSD;
        if (data.tokens) {
          totalUSD += data.tokens.reduce((sum, t) => sum + t.balanceUSD, 0);
        }
      })
    );
  }
  
  if (addresses.sol) {
    promises.push(
      getSOLBalanceData(addresses.sol).then(data => {
        results.sol = data;
        totalUSD += data.balanceUSD;
        if (data.tokens) {
          totalUSD += data.tokens.reduce((sum, t) => sum + t.balanceUSD, 0);
        }
      })
    );
  }
  
  if (addresses.btc) {
    promises.push(
      getBTCBalanceData(addresses.btc).then(data => {
        results.btc = data;
        totalUSD += data.balanceUSD;
      })
    );
  }
  
  await Promise.all(promises);
  
  return {
    ...results,
    totalUSD
  };
}
