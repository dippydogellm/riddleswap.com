// DexScreener API for XRPL token data (Bithomp fallback)
import fetch from 'node-fetch';

export interface DexScreenerPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd?: string;
  txns: {
    m5: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  volume: {
    h24: number;
    h6: number;
    h1: number;
    m5: number;
  };
  priceChange: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  liquidity?: {
    usd?: number;
    base: number;
    quote: number;
  };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  info?: {
    imageUrl?: string;
    header?: string;
    openGraph?: string;
    websites?: Array<{
      label: string;
      url: string;
    }>;
    socials?: Array<{
      type: string;
      url: string;
    }>;
  };
}

let tokenCache: {
  tokens: DexScreenerPair[];
  lastUpdated: number;
} = {
  tokens: [],
  lastUpdated: 0
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function loadAllXRPLTokens(forceRefresh = false): Promise<DexScreenerPair[]> {
  const now = Date.now();
  
  if (!forceRefresh && now - tokenCache.lastUpdated < CACHE_DURATION && tokenCache.tokens.length > 0) {
    console.log(`✅ Using cached XRPL tokens: ${tokenCache.tokens.length}`);
    return tokenCache.tokens;
  }

  try {
    console.log('🔍 Loading ALL XRPL tokens from DexScreener API (authentic market data)...');
    
    // Try multiple queries to get comprehensive XRPL token coverage
    const queries = ['xrpl', 'XRP', 'ripple'];
    const allPairs: DexScreenerPair[] = [];
    const seenPairs = new Set<string>();
    
    for (const query of queries) {
      try {
        const response = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${query}`);
        
        if (response.ok) {
          const data = await response.json() as any;
          
          if (data && data.pairs && Array.isArray(data.pairs)) {
            // Filter for XRPL pairs only
            const xrplPairs = data.pairs.filter((pair: any) => 
              pair.chainId === 'xrpl' || 
              pair.quoteToken?.symbol === 'XRP' ||
              pair.baseToken?.symbol === 'XRP' ||
              pair.url?.includes('xrpl')
            );
            
            // Add unique pairs
            for (const pair of xrplPairs) {
              const pairId = `${pair.baseToken.symbol}-${pair.baseToken.address}`;
              if (!seenPairs.has(pairId)) {
                seenPairs.add(pairId);
                allPairs.push(pair);
              }
            }
          }
        }
      } catch (err) {
        console.log(`⚠️ Failed to fetch DexScreener data for query '${query}'`);
      }
    }
    
    if (allPairs.length > 0) {
      tokenCache.tokens = allPairs;
      tokenCache.lastUpdated = now;
      console.log(`📊 Found ${allPairs.length} XRPL pairs on DexScreener`);
      return allPairs;
    }
    
    console.log('❌ No XRPL pairs found on DexScreener');
    return tokenCache.tokens; // Return cached data if available
    
  } catch (error) {
    console.error('❌ Failed to load XRPL tokens from DexScreener:', error);
    return tokenCache.tokens; // Return cached data on error
  }
}

export async function searchXRPLTokens(query: string): Promise<DexScreenerPair[]> {
  const allTokens = await loadAllXRPLTokens();
  
  if (!query || query.length < 2) {
    return [];
  }
  
  const searchTerm = query.toLowerCase();
  
  return allTokens.filter(pair => 
    pair.baseToken.symbol.toLowerCase().includes(searchTerm) ||
    pair.baseToken.name?.toLowerCase().includes(searchTerm) ||
    pair.baseToken.address?.toLowerCase().includes(searchTerm)
  );
}

export async function getXRPLTokenBySymbol(symbol: string, issuer?: string): Promise<DexScreenerPair | null> {
  // First try cached tokens
  let allTokens = await loadAllXRPLTokens();
  
  let matches = allTokens.filter(pair => 
    pair.baseToken.symbol.toLowerCase() === symbol.toLowerCase() &&
    (!issuer || pair.baseToken.address?.includes(issuer) || pair.pairAddress?.includes(issuer))
  );
  
  // If no matches found, try searching DexScreener directly
  if (matches.length === 0 && symbol) {
    try {
      const searchResponse = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${symbol}`);
      if (searchResponse.ok) {
        const searchData = await searchResponse.json() as any;
        if (searchData && searchData.pairs) {
          // Find XRPL pairs matching this token
          const xrplPairs = searchData.pairs.filter((pair: any) => {
            if (pair.chainId !== 'xrpl') return false;
            const symbolMatch = pair.baseToken.symbol.toLowerCase() === symbol.toLowerCase();
            if (!symbolMatch) return false;
            
            if (!issuer) return true;
            
            // Check if issuer matches in various formats
            const pairAddress = pair.baseToken.address || '';
            const pairAddressLower = pairAddress.toLowerCase();
            const issuerLower = issuer.toLowerCase();
            
            return pairAddressLower.includes(issuerLower) || 
                   pairAddress.split('.').some((part: string) => part.toLowerCase() === issuerLower);
          });
          
          if (xrplPairs.length > 0) {
            matches = xrplPairs;
          }
        }
      }
    } catch (err) {
      console.log(`⚠️ Failed to search DexScreener for ${symbol}`);
    }
  }
  
  // Return the pair with highest liquidity if multiple matches
  return matches.length > 0 
    ? matches.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0]
    : null;
}

// Export getXRPLTokenPrice for compatibility
export async function getXRPLTokenPrice(symbol: string, issuer?: string): Promise<number> {
  try {
    console.log(`🔍 Getting live price for ${symbol} ${issuer ? `(${issuer})` : ''}`);
    
    // Handle XRP with live CoinGecko price
    if (symbol === 'XRP' && !issuer) {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd');
      const data = await response.json() as any;
      const xrpPrice = data.ripple?.usd;
      if (xrpPrice) {
        console.log(`✅ Live XRP price from CoinGecko: $${xrpPrice}`);
        return parseFloat(xrpPrice);
      }
    }
    
    // For other tokens, search DexScreener
    const searchResponse = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${symbol}`);
    const searchData = await searchResponse.json() as any;
    
    if (searchData && searchData.pairs && Array.isArray(searchData.pairs)) {
      // Find XRPL pair matching this token
      const xrplPair = searchData.pairs.find((pair: any) => {
        if (pair.chainId !== 'xrpl') return false;
        
        // Check if symbol matches (case-insensitive)
        const symbolMatch = pair.baseToken.symbol.toLowerCase() === symbol.toLowerCase();
        if (!symbolMatch) return false;
        
        // If no issuer specified, just match by symbol
        if (!issuer) return true;
        
        // Check if issuer matches - DexScreener uses format like "584D454D45000000000000000000000000000000.r4UPddYeGeZgDhSGPkooURsQtmGda4oYQW"
        const pairAddress = pair.baseToken.address || '';
        
        // Check if issuer is part of the address (case-insensitive)
        if (pairAddress.toLowerCase().includes(issuer.toLowerCase())) {
          return true;
        }
        
        // Also check if the address ends with the issuer
        const addressParts = pairAddress.split('.');
        if (addressParts.length === 2 && addressParts[1].toLowerCase() === issuer.toLowerCase()) {
          return true;
        }
        
        return false;
      });
      
      if (xrplPair && xrplPair.priceUsd) {
        const price = parseFloat(xrplPair.priceUsd);
        console.log(`✅ Live ${symbol} price from DexScreener: $${price}`);
        return price;
      }
    }
    
    // No hardcoded prices - use only live API data
    
    console.log(`❌ No live price found for ${symbol} on XRPL`);
    return 0;
    
  } catch (error) {
    console.error(`❌ Failed to get live price for ${symbol}:`, error);
    return 0;
  }
}