import { z } from 'zod';

// Token search result schema
export const tokenSearchResultSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  issuer: z.string(),
  currency_code: z.string(),
  icon_url: z.string().optional(),
  price_usd: z.number().optional(),
  volume_24h: z.number().optional(),
  market_cap: z.number().optional(),
  verified: z.boolean().default(false),
  source: z.string()
});

export type TokenSearchResult = z.infer<typeof tokenSearchResultSchema>;

// Disable all caching - force fresh data always
const tokenCache = new Map<string, { data: TokenSearchResult[]; timestamp: number }>();
const CACHE_DURATION = 0; // No caching

function hexToAscii(hex: string): string {
  if (!hex || hex.length === 0) return hex;
  if (hex.length === 40 && hex.match(/^[0-9A-F]+$/i)) {
    try {
      let result = '';
      for (let i = 0; i < hex.length; i += 2) {
        const byte = parseInt(hex.substr(i, 2), 16);
        if (byte === 0) break;
        result += String.fromCharCode(byte);
      }
      return result || hex;
    } catch (e) {
      return hex;
    }
  }
  return hex;
}

async function searchXRPLMeta(query: string): Promise<TokenSearchResult[]> {
  try {
    const response = await fetch(`https://xrplmeta.org/api/tokens/search?q=${encodeURIComponent(query)}&limit=50`);
    if (!response.ok) return [];
    
    const data = await response.json() as any;
    if (!data.tokens || !Array.isArray(data.tokens)) return [];
    
    return data.tokens.map((token: any) => {
      const symbol = hexToAscii(token.currency) || token.symbol || token.currency;
      
      // Use DexScreener URLs for all tokens (no XUMM URLs)
      const symbolLower = symbol.toLowerCase();
      const issuerLower = token.issuer.toLowerCase();
      const icon_url = `https://dd.dexscreener.com/ds-data/tokens/xrpl/${symbolLower}.${issuerLower}.png?key=7c1c6a`;
      
      return {
        symbol: symbol,
        name: token.name || symbol,
        issuer: token.issuer,
        currency_code: token.currency,
        icon_url: icon_url,
        verified: token.verified || false,
        source: 'XRPLMeta'
      };
    });
  } catch (error) {
    return [];
  }
}

async function searchBithomp(query: string): Promise<TokenSearchResult[]> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    if (process.env.BITHOMP_API_KEY) {
      headers['Authorization'] = `Bearer ${process.env.BITHOMP_API_KEY}`;
    }
    
    const response = await fetch(`https://bithomp.com/api/v2/tokens?search=${encodeURIComponent(query)}&limit=50`, {
      headers
    });
    
    if (!response.ok) return [];
    
    const data = await response.json() as any;
    if (!data.tokens || !Array.isArray(data.tokens)) return [];
    
    return data.tokens.map((token: any) => ({
      symbol: hexToAscii(token.currency) || token.symbol || token.currency,
      name: token.name || hexToAscii(token.currency) || token.symbol,
      issuer: token.issuer,
      currency_code: token.currency,
      icon_url: token.icon,
      verified: token.verified || false,
      source: 'Bithomp'
    }));
  } catch (error) {
    return [];
  }
}

async function searchDexScreener(query: string): Promise<TokenSearchResult[]> {
  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/search/?q=${encodeURIComponent(query)}`);
    if (!response.ok) return [];
    
    const data = await response.json() as any;
    if (!data.pairs || !Array.isArray(data.pairs)) return [];
    
    return data.pairs
      .filter((pair: any) => pair.chainId === 'xrpl')
      .map((pair: any) => {
        // Parse DexScreener address format: "HEX_CURRENCY.ISSUER_ADDRESS"
        let issuer = '';
        let currency_code = pair.baseToken.symbol;
        
        if (pair.baseToken.address && pair.baseToken.address.includes('.')) {
          const parts = pair.baseToken.address.split('.');
          if (parts.length === 2) {
            currency_code = parts[0]; // Hex currency code (e.g., 534F4C4F...)
            issuer = parts[1]; // Clean issuer address (e.g., rsoLo2S1...)
          }
        } else if (pair.baseToken.address && pair.baseToken.address.startsWith('r')) {
          issuer = pair.baseToken.address;
          currency_code = pair.baseToken.symbol;
        }
        
        return {
          symbol: pair.baseToken.symbol,
          name: pair.baseToken.name,
          issuer: issuer,
          currency_code: currency_code,
          icon_url: pair.info?.imageUrl, // Use authentic DexScreener logo directly
          logo_url: pair.info?.imageUrl, // Set both for compatibility
          price_usd: parseFloat(pair.priceUsd) || 0,
          volume_24h: pair.volume?.h24 || 0,
          market_cap: pair.fdv || 0,
          verified: false,
          source: 'DexScreener'
        };
      });
  } catch (error) {
    return [];
  }
}

export async function searchTokens(query: string): Promise<TokenSearchResult[]> {
  const cacheKey = `search:${query.toLowerCase()}`;
  
  // Clear ALL cache to force fresh data with fixed logos
  tokenCache.clear();

  try {
    // Search across multiple sources
    const [xrplMetaResults, bithompResults, dexScreenerResults] = await Promise.all([
      searchXRPLMeta(query),
      searchBithomp(query),
      searchDexScreener(query)
    ]);
    
    // Filter out cross-chain XRP tokens from all sources - only allow XRPL native tokens
    const filterXRPLOnly = (results: TokenSearchResult[]) => 
      results.filter((token) => {
        // For XRP, only allow native XRP (no issuer) or XRPL issuer addresses (start with 'r')
        if (token.symbol === 'XRP') {
          return !token.issuer || token.issuer.startsWith('r');
        }
        // For other tokens, only allow XRPL issuer addresses
        return !token.issuer || token.issuer.startsWith('r');
      });
    
    const filteredResults = [
      ...filterXRPLOnly(xrplMetaResults),
      ...filterXRPLOnly(bithompResults),
      ...filterXRPLOnly(dexScreenerResults)
    ];
    
    // Always include native XRP if searching for XRP
    if (query.toLowerCase().includes('xrp')) {
      filteredResults.unshift({
        symbol: "XRP",
        name: "XRP",
        issuer: "",
        currency_code: "XRP",
        icon_url: "/xrp-logo.png",
        verified: true,
        source: 'Native'
      });
    }
    
    // Combine and deduplicate results
    const allResults = filteredResults;
    const uniqueResults = new Map<string, TokenSearchResult>();
    
    for (const result of allResults) {
      const key = `${result.currency_code}:${result.issuer}`;
      if (!uniqueResults.has(key) || result.verified) {
        uniqueResults.set(key, result);
      }
    }
    
    const finalResults = Array.from(uniqueResults.values())
      .map(token => {
        // Add XRP logo for XRP tokens
        if (token.symbol === "XRP" && token.currency_code === "XRP") {
          token.icon_url = "/xrp-logo.png";
        }
        
        // Keep authentic DexScreener URLs (no hardcoded overrides)
        
        return token;
      })
      .sort((a, b) => {
        // Sort by verified status first, then by name
        if (a.verified !== b.verified) return b.verified ? 1 : -1;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 100); // Limit results
    
    // Disable caching to force fresh URLs
    // tokenCache.set(cacheKey, { data: finalResults, timestamp: Date.now() });
    
    return finalResults;
  } catch (error) {
    return [];
  }
}

export async function getTokenByIssuer(issuer: string, currency?: string): Promise<TokenSearchResult | null> {
  const cacheKey = `token:${issuer}:${currency || ''}`;
  const cached = tokenCache.get(cacheKey);
  
  if (cached && cached.data.length > 0 && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data[0];
  }
  
  try {
    // Try XRPLMeta first
    const xrplMetaResponse = await fetch(`https://xrplmeta.org/api/token/${issuer}${currency ? `/${currency}` : ''}`);
    if (xrplMetaResponse.ok) {
      const token = await xrplMetaResponse.json();
      const result: TokenSearchResult = {
        symbol: hexToAscii(token.currency) || token.symbol || token.currency,
        name: token.name || hexToAscii(token.currency) || token.symbol,
        issuer: token.issuer,
        currency_code: token.currency,
        icon_url: token.icon || token.logo,
        verified: token.verified || false,
        source: 'XRPLMeta'
      };
      
      tokenCache.set(cacheKey, { data: [result], timestamp: Date.now() });
      return result;
    }
    
    // Fallback to Bithomp
    const bithompResponse = await fetch(`https://bithomp.com/api/v2/token/${issuer}${currency ? `/${currency}` : ''}`);
    if (bithompResponse.ok) {
      const token = await bithompResponse.json();
      const result: TokenSearchResult = {
        symbol: hexToAscii(token.currency) || token.symbol || token.currency,
        name: token.name || hexToAscii(token.currency) || token.symbol,
        issuer: token.issuer,
        currency_code: token.currency,
        icon_url: token.icon,
        verified: token.verified || false,
        source: 'Bithomp'
      };
      
      tokenCache.set(cacheKey, { data: [result], timestamp: Date.now() });
      return result;
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

// Clear expired cache entries periodically
setInterval(() => {
  const now = Date.now();
  const keysToDelete: string[] = [];
  
  tokenCache.forEach((value, key) => {
    if (now - value.timestamp > CACHE_DURATION) {
      keysToDelete.push(key);
    }
  });
  
  keysToDelete.forEach(key => tokenCache.delete(key));
}, 60000); // Clean up every minute