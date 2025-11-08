// Separate Token Systems for Each Chain - No Conflicts
// Each chain has its own independent token management

import { fetchBalanceV2, formatBalanceV2, formatUSDV2 } from './balance-api-v2';

interface ChainToken {
  symbol: string;
  name: string;
  price: number;
  balance?: string;
  balanceUSD?: number;
  logo?: string;
  issuer?: string;
  currency?: string;
}

// XRP/XRPL Token System
export async function getXRPTokens(address: string): Promise<ChainToken[]> {
  try {
    const tokens: ChainToken[] = [];
    
    // Fetch XRP balance first
    const xrpData = await fetchBalanceV2('XRP', address);
    tokens.push({
      symbol: 'XRP',
      name: 'XRP',
      price: xrpData.balanceUSD / (parseFloat(xrpData.balance) || 1),
      balance: xrpData.balance,
      balanceUSD: xrpData.balanceUSD,
      logo: '/icons/xrp.svg'
    });
    
    // Fetch XRPL tokens from trustlines
    try {
      const response = await fetch(`/api/xrpl/account/${address}/balances`);
      if (response.ok) {
        const data = await response.json() as any;
        if (data.balances && Array.isArray(data.balances)) {
          for (const token of data.balances) {
            if (token.currency !== 'XRP') {
              tokens.push({
                symbol: token.currency,
                name: token.currency,
                price: token.price_usd || 0,
                balance: token.value || '0',
                balanceUSD: parseFloat(token.value || 0) * (token.price_usd || 0),
                logo: token.logo,
                issuer: token.issuer,
                currency: token.currency
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching XRPL tokens:', error);
    }
    
    return tokens;
  } catch (error) {
    console.error('XRP tokens fetch error:', error);
    return [];
  }
}

// Ethereum Token System  
export async function getETHTokens(address: string): Promise<ChainToken[]> {
  try {
    const tokens: ChainToken[] = [];
    
    // Fetch ETH balance first
    const ethData = await fetchBalanceV2('ETH', address);
    tokens.push({
      symbol: 'ETH',
      name: 'Ethereum',
      price: ethData.balanceUSD / (parseFloat(ethData.balance) || 1),
      balance: ethData.balance,
      balanceUSD: ethData.balanceUSD,
      logo: '/icons/eth.svg'
    });
    
    // Popular ERC-20 tokens to check
    const erc20Tokens = [
      { symbol: 'USDT', contract: '0xdac17f958d2ee523a2206206994597c13d831ec7', name: 'Tether' },
      { symbol: 'USDC', contract: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', name: 'USD Coin' },
      { symbol: 'WETH', contract: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', name: 'Wrapped ETH' },
      { symbol: 'DAI', contract: '0x6b175474e89094c44da98b954eedeac495271d0f', name: 'Dai' }
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
              name: token.name,
              price: data.price || 0,
              balance: data.balance,
              balanceUSD: data.balanceUSD || 0,
              logo: `/icons/${token.symbol.toLowerCase()}.svg`
            });
          }
        }
      } catch (error) {
        console.error(`Error fetching ${token.symbol} balance:`, error);
      }
    }
    
    return tokens;
  } catch (error) {
    console.error('ETH tokens fetch error:', error);
    return [];
  }
}

// Solana Token System
export async function getSOLTokens(address: string): Promise<ChainToken[]> {
  try {
    const tokens: ChainToken[] = [];
    
    // Fetch SOL balance first
    const solData = await fetchBalanceV2('SOL', address);
    tokens.push({
      symbol: 'SOL',
      name: 'Solana',
      price: solData.balanceUSD / (parseFloat(solData.balance) || 1),
      balance: solData.balance,
      balanceUSD: solData.balanceUSD,
      logo: '/icons/sol.svg'
    });
    
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
              price: token.price || 0,
              balance: token.balance || '0',
              balanceUSD: token.balanceUSD || 0,
              logo: token.logo || `/icons/${token.symbol?.toLowerCase()}.svg`
            });
          }
        }
      }
    } catch (error) {
      console.error('Error fetching SPL tokens:', error);
    }
    
    return tokens;
  } catch (error) {
    console.error('SOL tokens fetch error:', error);
    return [];
  }
}

// Bitcoin System (no tokens, just BTC)
export async function getBTCData(address: string): Promise<ChainToken[]> {
  try {
    const btcData = await fetchBalanceV2('BTC', address);
    return [{
      symbol: 'BTC',
      name: 'Bitcoin',
      price: btcData.balanceUSD / (parseFloat(btcData.balance) || 1),
      balance: btcData.balance,
      balanceUSD: btcData.balanceUSD,
      logo: '/icons/btc.svg'
    }];
  } catch (error) {
    console.error('BTC data fetch error:', error);
    return [];
  }
}

// Get all tokens for a specific chain
export async function getChainTokens(chain: string, address: string): Promise<ChainToken[]> {
  switch (chain.toUpperCase()) {
    case 'XRP':
    case 'XRPL':
      return getXRPTokens(address);
    case 'ETH':
    case 'ETHEREUM':
      return getETHTokens(address);
    case 'SOL':
    case 'SOLANA':
      return getSOLTokens(address);
    case 'BTC':
    case 'BITCOIN':
      return getBTCData(address);
    default:
      return [];
  }
}

// Calculate total USD value for a chain
export function calculateChainTotalUSD(tokens: ChainToken[]): number {
  return tokens.reduce((total, token) => total + (token.balanceUSD || 0), 0);
}

// Format token balance with proper decimals
export function formatTokenBalance(balance: string, symbol: string): string {
  const num = parseFloat(balance);
  if (isNaN(num)) return '0';
  
  // For stablecoins, show 2 decimals
  if (['USDT', 'USDC', 'DAI', 'BUSD'].includes(symbol)) {
    return num.toFixed(2);
  }
  
  // For BTC, show 8 decimals if small amount
  if (symbol === 'BTC' && num < 0.01) {
    return num.toFixed(8);
  }
  
  // For other tokens, show appropriate decimals
  if (num < 0.0001) return num.toExponential(2);
  if (num < 1) return num.toFixed(6);
  if (num < 100) return num.toFixed(4);
  return num.toFixed(2);
}
