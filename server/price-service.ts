// Token Price Service - AUTHENTIC DATA ONLY
// Uses CoinGecko for XRP and DexScreener for RDL pricing

import { db } from './db.js';
import { tokens } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

interface TokenPrice {
  symbol: string;
  issuer: string;
  price_usd: number;
  price_xrp: number;
  volume_24h: number;
  change_24h: number;
  last_updated: string;
}

interface XRPLTokenPrice {
  currency: string;
  issuer: string;
  price_usd: number;
  volume_24h: number;
  change_24h: number;
}

// Cache for price data to avoid excessive API calls
const priceCache = new Map<string, { data: TokenPrice; timestamp: number }>();
const CACHE_DURATION = 10000; // 10 second cache for fresh authentic data

// Rate limiting tracking
const lastApiCall = new Map<string, number>();
const API_RATE_LIMIT = 2000; // 2 seconds between API calls for fresher data

// Get authentic XRP price from CoinGecko
async function getAuthenticXRPPrice(): Promise<{ price: number; change: number } | null> {
  const cacheKey = 'xrp_price';
  const now = Date.now();
  
  // Check cache first
  const cached = priceCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    return {
      price: cached.data.price_usd,
      change: cached.data.change_24h
    };
  }
  
  // Rate limiting check
  const lastCall = lastApiCall.get('coingecko');
  if (lastCall && (now - lastCall) < API_RATE_LIMIT) {
    // Return cached data or force fresh API call
    if (cached) {
      return {
        price: cached.data.price_usd,
        change: cached.data.change_24h
      };
    }
    // Force fresh API call instead of fallback
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd&include_24hr_change=true');
      const data = await response.json() as any;
      if (data.ripple && data.ripple.usd) {
        return { price: data.ripple.usd, change: data.ripple.usd_24h_change || 0 };
      }
    } catch (e) {}
    return null; // Return null instead of fallback to force error handling
  }
  
  try {
    lastApiCall.set('coingecko', now);
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd&include_24hr_change=true');
    
    if (response.status === 429) {
      // Rate limited, return cached or fallback
      if (cached) {
        return {
          price: cached.data.price_usd,
          change: cached.data.change_24h
        };
      }
      // Force fresh API call instead of fallback
      try {
        const freshResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd&include_24hr_change=true');
        const freshData = await freshResponse.json();
        if (freshData.ripple && freshData.ripple.usd) {
          return { price: freshData.ripple.usd, change: freshData.ripple.usd_24h_change || 0 };
        }
      } catch (e) {}
      return null;
    }
    
    const data = await response.json() as any;
    
    if (data.ripple && data.ripple.usd) {
      // Cache the result
      const priceData: TokenPrice = {
        symbol: 'XRP',
        issuer: '',
        price_usd: data.ripple.usd,
        price_xrp: 1,
        volume_24h: 0,
        change_24h: data.ripple.usd_24h_change || 0,
        last_updated: new Date().toISOString()
      };
      priceCache.set(cacheKey, { data: priceData, timestamp: now });
      
      return {
        price: data.ripple.usd,
        change: data.ripple.usd_24h_change || 0
      };
    }
    
    return null;
  } catch (error) {
    // Return cached data if available
    if (cached) {
      return {
        price: cached.data.price_usd,
        change: cached.data.change_24h
      };
    }
    // Force fresh API call instead of fallback
    try {
      const freshResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd&include_24hr_change=true');
      const freshData = await freshResponse.json();
      if (freshData.ripple && freshData.ripple.usd) {
        return { price: freshData.ripple.usd, change: freshData.ripple.usd_24h_change || 0 };
      }
    } catch (e) {}
    return null; // Return null instead of fallback to force error handling
  }
}

// Fetch RDL price from DexScreener (XRPL chain)
async function fetchRDLPriceFromDexScreener(): Promise<number | null> {
  const cacheKey = 'rdl_dexscreener';
  const now = Date.now();
  
  // Check cache first
  const cached = priceCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    return cached.data.price_usd;
  }
  
  // Rate limiting check
  const lastCall = lastApiCall.get('dexscreener');
  if (lastCall && (now - lastCall) < API_RATE_LIMIT) {
    if (cached) {
      return cached.data.price_usd;
    }
    return null;
  }
  
  try {
    lastApiCall.set('dexscreener', now);
    
    // Fetch RDL token from DexScreener XRPL chain
    const response = await fetch('https://api.dexscreener.com/latest/dex/search/?q=RDL');
    
    if (response.status === 429) {
      if (cached) {
        return cached.data.price_usd;
      }
      return null;
    }
    
    const data = await response.json() as any;
    
    if (data.pairs && data.pairs.length > 0) {
      // Find the XRPL RDL pair with the highest liquidity
      const xrplPairs = data.pairs.filter((pair: any) => 
        pair.chainId === 'xrpl' && 
        (pair.baseToken?.symbol === 'RDL' || pair.quoteToken?.symbol === 'RDL')
      );
      
      if (xrplPairs.length > 0) {
        // Sort by liquidity and take the highest
        xrplPairs.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
        const topPair = xrplPairs[0];
        
        // Determine which token is RDL and get its price
        let rdlPriceUsd = 0;
        if (topPair.baseToken?.symbol === 'RDL') {
          rdlPriceUsd = parseFloat(topPair.priceUsd || '0');
        } else if (topPair.quoteToken?.symbol === 'RDL') {
          // If RDL is quote token, calculate inverse
          const basePrice = parseFloat(topPair.priceUsd || '0');
          if (basePrice > 0) {
            rdlPriceUsd = 1 / basePrice;
          }
        }
        
        if (rdlPriceUsd > 0) {
          // Cache the result
          const priceData: TokenPrice = {
            symbol: 'RDL',
            issuer: 'rGxf4qhNAXPCMq2xbEsXvHWpvzUhtbLjXF',
            price_usd: rdlPriceUsd,
            price_xrp: 0,
            volume_24h: parseFloat(topPair.volume?.h24 || '0'),
            change_24h: parseFloat(topPair.priceChange?.h24 || '0'),
            last_updated: new Date().toISOString()
          };
          priceCache.set(cacheKey, { data: priceData, timestamp: now });
          
          return rdlPriceUsd;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('DexScreener RDL price fetch error:', error);
    if (cached) {
      return cached.data.price_usd;
    }
    return null;
  }
}

// Fetch authentic token price from xrpl.to API
async function fetchAuthenticXrplToTokenPrice(symbol: string, issuer?: string): Promise<XRPLTokenPrice | null> {
  const cacheKey = `xrpl_token_${symbol}_${issuer || 'no_issuer'}`;
  const now = Date.now();
  
  // Check cache first
  const cached = priceCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    return {
      currency: cached.data.symbol,
      issuer: cached.data.issuer,
      price_usd: cached.data.price_usd,
      volume_24h: cached.data.volume_24h,
      change_24h: cached.data.change_24h
    };
  }
  
  // Rate limiting check
  const lastCall = lastApiCall.get('xrpl_to');
  if (lastCall && (now - lastCall) < API_RATE_LIMIT) {
    // Return cached data if available
    if (cached) {
      return {
        currency: cached.data.symbol,
        issuer: cached.data.issuer,
        price_usd: cached.data.price_usd,
        volume_24h: cached.data.volume_24h,
        change_24h: cached.data.change_24h
      };
    }
    return null; // No fallback for specific tokens
  }
  
  try {
    lastApiCall.set('xrpl_to', now);
    // For tokens with $ prefix, search without the $ symbol
    let searchTerm = symbol;
    if (symbol.startsWith('$')) {
      searchTerm = symbol.substring(1);
    }
    
    const response = await fetch(`https://api.xrpl.to/api/tokens?filter=${encodeURIComponent(searchTerm)}&limit=50&sortBy=vol24hxrp&sortType=desc`);
    
    if (response.status === 429) {
      // Rate limited, return cached data if available
      if (cached) {
        return {
          currency: cached.data.symbol,
          issuer: cached.data.issuer,
          price_usd: cached.data.price_usd,
          volume_24h: cached.data.volume_24h,
          change_24h: cached.data.change_24h
        };
      }
      return null;
    }
    const data = await response.json() as any;
    
    if (data.tokens && data.tokens.length > 0) {
      for (const token of data.tokens) {
        let currencySymbol = token.currency;
        
        // Convert hex currency to ASCII if needed
        if (currencySymbol && currencySymbol.length > 3) {
          try {
            const hexMatch = currencySymbol.match(/^[0-9A-F]+$/i);
            if (hexMatch) {
              currencySymbol = Buffer.from(currencySymbol, 'hex').toString('utf8').replace(/\0/g, '');
            }
          } catch (e) {
            // Keep original if conversion fails
          }
        }
        
        // Match by symbol and optionally by issuer
        const symbolMatch = (currencySymbol === symbol || token.currency === symbol || 
                           currencySymbol === searchTerm || token.currency === searchTerm);
        
        if (symbolMatch) {
          if (!issuer || token.issuer === issuer) {
            // Use price from 'usd' field if available
            if (token.usd && token.usd > 0) {
              return {
                currency: token.currency,
                issuer: token.issuer,
                price_usd: parseFloat(token.usd),
                volume_24h: parseFloat(token.vol24hxrp || '0'),
                change_24h: parseFloat(token.change24h || '0')
              };
            }
            
            // Also check priceUsd field as fallback
            if (token.priceUsd && token.priceUsd > 0) {
              return {
                currency: token.currency,
                issuer: token.issuer,
                price_usd: parseFloat(token.priceUsd),
                volume_24h: parseFloat(token.vol24hxrp || '0'),
                change_24h: parseFloat(token.change24h || '0')
              };
            }
            
            // If no direct price but has market cap and supply, calculate authentic price using actual supply
            if (token.marketcap && parseFloat(token.marketcap) > 0 && token.supply && parseFloat(token.supply) > 0) {
              const marketCapUSD = parseFloat(token.marketcap);
              const actualSupply = parseFloat(token.supply);
              
              const authenticPrice = marketCapUSD / actualSupply;
              return {
                currency: token.currency,
                issuer: token.issuer,
                price_usd: authenticPrice,
                volume_24h: parseFloat(token.vol24hxrp || '0'),
                change_24h: parseFloat(token.change24h || '0')
              };
            }
          }
        }
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

export async function fetchTokenPrices(): Promise<TokenPrice[]> {
  try {
    const prices: TokenPrice[] = [];

    // Get authentic XRP price
    const xrpData = await getAuthenticXRPPrice();
    if (xrpData) {
      prices.push({
        symbol: 'XRP',
        issuer: '',
        price_usd: xrpData.price,
        price_xrp: 1,
        volume_24h: 0,
        change_24h: xrpData.change,
        last_updated: new Date().toISOString()
      });
    }

    // Get all tokens from database
    const allTokens = await db.select().from(tokens);
    
    // Fetch authentic prices from xrpl.to for each token
    for (const token of allTokens) {
      try {
        const xrplToPrice = await fetchAuthenticXrplToTokenPrice(token.symbol, token.issuer ?? undefined);
        if (xrplToPrice && xrpData) {
          prices.push({
            symbol: token.symbol,
            issuer: token.issuer || '',
            price_usd: xrplToPrice.price_usd,
            price_xrp: xrplToPrice.price_usd / xrpData.price,
            volume_24h: xrplToPrice.volume_24h || 0,
            change_24h: xrplToPrice.change_24h || 0,
            last_updated: new Date().toISOString()
          });
        }
      } catch (error) {
        // Continue with next token - NO fallbacks
      }
    }

      return prices;
  } catch (error) {
    return [];
  }
}

// Export function for external use
export async function getAuthenticTokenPrice(symbol: string, issuer?: string): Promise<{
  symbol: string;
  issuer: string;
  price_usd: number;
  volume_24h: number;
  change_24h: number;
} | null> {
  try {
    if (symbol === 'XRP') {
      const xrpData = await getAuthenticXRPPrice();
      if (xrpData) {
        return {
          symbol: 'XRP',
          issuer: '',
          price_usd: xrpData.price,
          volume_24h: 0,
          change_24h: xrpData.change
        };
      }
    } else if (symbol === 'RDL' || symbol === '$RDL') {
      // Use DexScreener for RDL pricing
      const rdlPrice = await fetchRDLPriceFromDexScreener();
      if (rdlPrice) {
        return {
          symbol: 'RDL',
          issuer: 'rGxf4qhNAXPCMq2xbEsXvHWpvzUhtbLjXF',
          price_usd: rdlPrice,
          volume_24h: 0,
          change_24h: 0
        };
      }
    } else {
      const tokenData = await fetchAuthenticXrplToTokenPrice(symbol, issuer);
      if (tokenData) {
        return {
          symbol: tokenData.currency,
          issuer: tokenData.issuer || '',
          price_usd: tokenData.price_usd,
          volume_24h: tokenData.volume_24h || 0,
          change_24h: tokenData.change_24h || 0
        };
      }
    }
    return null;
  } catch (error) {
    console.error(`Price fetch error for ${symbol}:`, error);
    return null;
  }
}

export async function getTokenPrice(symbol: string, issuer?: string): Promise<TokenPrice | null> {
  const cacheKey = `${symbol}:${issuer || ''}`;
  const cached = priceCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    if (symbol === 'XRP') {
      const xrpData = await getAuthenticXRPPrice();
      if (xrpData) {
        const tokenPrice: TokenPrice = {
          symbol: 'XRP',
          issuer: '',
          price_usd: xrpData.price,
          price_xrp: 1,
          volume_24h: 0,
          change_24h: xrpData.change,
          last_updated: new Date().toISOString()
        };
        priceCache.set(cacheKey, { data: tokenPrice, timestamp: Date.now() });
        return tokenPrice;
      }
    } else if (symbol === 'RDL' || symbol === '$RDL') {
      // Use DexScreener for RDL pricing
      const rdlPrice = await fetchRDLPriceFromDexScreener();
      const xrpData = await getAuthenticXRPPrice();
      
      if (rdlPrice && xrpData) {
        const tokenPrice: TokenPrice = {
          symbol: 'RDL',
          issuer: 'rGxf4qhNAXPCMq2xbEsXvHWpvzUhtbLjXF',
          price_usd: rdlPrice,
          price_xrp: rdlPrice / xrpData.price,
          volume_24h: 0,
          change_24h: 0,
          last_updated: new Date().toISOString()
        };
        priceCache.set(cacheKey, { data: tokenPrice, timestamp: Date.now() });
        return tokenPrice;
      }
    } else {
      const xrplToPrice = await fetchAuthenticXrplToTokenPrice(symbol, issuer);
      const xrpData = await getAuthenticXRPPrice();
      
      if (xrplToPrice && xrpData) {
        const tokenPrice: TokenPrice = {
          symbol,
          issuer: issuer || '',
          price_usd: xrplToPrice.price_usd,
          price_xrp: xrplToPrice.price_usd / xrpData.price,
          volume_24h: xrplToPrice.volume_24h || 0,
          change_24h: xrplToPrice.change_24h || 0,
          last_updated: new Date().toISOString()
        };
        priceCache.set(cacheKey, { data: tokenPrice, timestamp: Date.now() });
        return tokenPrice;
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}