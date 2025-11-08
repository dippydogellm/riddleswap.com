/**
 * Shared XRP Price Utilities
 * Provides live XRP pricing across client and server
 */

export interface XRPPrice {
  price: number;
  change: number;
  timestamp: number;
}

// Cache for client-side price fetching
let priceCache: { data: XRPPrice; timestamp: number } | null = null;
const CACHE_DURATION = 10000; // 10 seconds cache

/**
 * Fetches live XRP price from CoinGecko API
 * Used on client-side when price service is not available
 */
export async function fetchLiveXRPPrice(): Promise<XRPPrice | null> {
  const now = Date.now();
  
  // Check cache first
  if (priceCache && (now - priceCache.timestamp) < CACHE_DURATION) {
    return priceCache.data;
  }
  
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd&include_24hr_change=true');
    
    if (!response.ok) {
      console.warn('XRP price API error:', response.status);
      return priceCache?.data || null;
    }
    
    const data = await response.json();
    
    if (data.ripple && data.ripple.usd) {
      const priceData: XRPPrice = {
        price: data.ripple.usd,
        change: data.ripple.usd_24h_change || 0,
        timestamp: now
      };
      
      // Cache the result
      priceCache = { data: priceData, timestamp: now };
      
      console.log(`💲 [XRP] Live price: $${priceData.price}`);
      return priceData;
    }
    
    console.warn('XRP price API returned invalid data');
    return priceCache?.data || null;
    
  } catch (error) {
    console.error('Failed to fetch XRP price:', error);
    return priceCache?.data || null;
  }
}

/**
 * Server-side XRP price fetching using the price service
 * Returns the price data from the existing price service
 */
export async function getServerXRPPrice(): Promise<{ price: number; change: number } | null> {
  try {
    // Import the price service function dynamically for server use
    const { getTokenPrice } = await import('../server/price-service.js');
    const xrpTokenPrice = await getTokenPrice('XRP');
    
    if (xrpTokenPrice) {
      return {
        price: xrpTokenPrice.price_usd,
        change: xrpTokenPrice.change_24h
      };
    }
    
    return null;
  } catch (error) {
    console.error('Server XRP price fetch failed:', error);
    return null;
  }
}

/**
 * Universal XRP price fetcher - works on both client and server
 * Automatically detects environment and uses appropriate method
 */
export async function getXRPPrice(): Promise<{ price: number; change: number } | null> {
  // Check if we're on the server
  if (typeof window === 'undefined') {
    return await getServerXRPPrice();
  } else {
    // Client-side
    const priceData = await fetchLiveXRPPrice();
    return priceData ? { price: priceData.price, change: priceData.change } : null;
  }
}

/**
 * Get XRP price with error handling and no fallbacks
 * Returns null if price cannot be fetched to force proper error handling
 */
export async function getXRPPriceStrict(): Promise<number | null> {
  const priceData = await getXRPPrice();
  return priceData?.price || null;
}

/**
 * Calculate USD value from XRP amount using live price
 */
export async function calculateXRPValueUSD(xrpAmount: number): Promise<number | null> {
  const price = await getXRPPriceStrict();
  return price ? xrpAmount * price : null;
}

/**
 * Calculate XRP amount from USD value using live price
 */
export async function calculateUSDValueXRP(usdAmount: number): Promise<number | null> {
  const price = await getXRPPriceStrict();
  return price ? usdAmount / price : null;
}