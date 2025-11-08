// XRPL Swap Exchange Rates Service
// Dedicated exchange rate service for swap operations

import fetch from 'node-fetch';

interface ExchangeRateResult {
  success: boolean;
  rate: number;
  fromPrice: number;
  toPrice: number;
  error?: string;
  slippage?: number;
  fee?: number;
}

interface TokenPrice {
  price_usd: number;
  symbol: string;
  name: string;
  logo?: string;
  source: string;
}

// Cache for token prices (5 minute cache)
const priceCache = new Map<string, { price: TokenPrice; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get live XRP price from authentic sources
 */
export async function getLiveXRPPrice(): Promise<number> {
  try {
    console.log('🎯 Fetching live XRP price...');
    
    // Primary: CoinGecko API
    const cgResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd', {
      headers: {
        'User-Agent': 'RiddleSwap/1.0',
        'Accept': 'application/json'
      }
    });
    
    if (cgResponse.ok) {
      const cgData = await cgResponse.json() as any;
      if (cgData.ripple?.usd) {
        const price = parseFloat(cgData.ripple.usd);
        console.log(`🎯 Live XRP price from CoinGecko: $${price}`);
        return price;
      }
    }
    
    // Fallback: CoinPaprika
    const cpResponse = await fetch('https://api.coinpaprika.com/v1/tickers/xrp-xrp', {
      headers: {
        'User-Agent': 'RiddleSwap/1.0',
        'Accept': 'application/json'
      }
    });
    
    if (cpResponse.ok) {
      const cpData = await cpResponse.json() as any;
      if (cpData.quotes?.USD?.price) {
        const price = parseFloat(cpData.quotes.USD.price);
        console.log(`🎯 Live XRP price from CoinPaprika: $${price}`);
        return price;
      }
    }
    
    throw new Error('No authentic XRP price sources available');
    
  } catch (error) {
    console.error('❌ Error fetching live XRP price:', error);
    throw new Error('Failed to fetch live XRP price');
  }
}

/**
 * Get live token price from DexScreener with caching
 */
export async function getLiveTokenPrice(symbol: string, issuer?: string): Promise<TokenPrice | null> {
  try {
    const cacheKey = issuer ? `${symbol}-${issuer}` : symbol;
    
    // Check cache first
    const cached = priceCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      console.log(`📋 Using cached price for ${symbol}: $${cached.price.price_usd}`);
      return cached.price;
    }
    
    console.log(`🔍 Fetching live price for ${symbol}${issuer ? ` (${issuer})` : ''}`);
    
    // RDL token gets same treatment as other tokens - no special handling
    
    // Search DexScreener for XRPL token
    const searchResponse = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(symbol)}`, {
      headers: {
        'User-Agent': 'RiddleSwap/1.0',
        'Accept': 'application/json'
      }
    });
    
    if (searchResponse.ok) {
      const searchData = await searchResponse.json() as any;
      
      if (searchData.pairs && searchData.pairs.length > 0) {
        // Find XRPL pair matching the token - same logic as owned tokens endpoint
        const xrplPair = searchData.pairs.find((pair: any) => {
          if (pair.chainId !== 'xrpl') return false;
          
          // DexScreener format: baseToken.address is "SYMBOL.issuer" or just issuer
          const baseAddr = pair.baseToken?.address || '';
          const quoteAddr = pair.quoteToken?.address || '';
          
          // Match by issuer (handle both direct issuer and "SYMBOL.issuer" format)
          if (issuer) {
            return baseAddr === issuer || 
                   baseAddr.endsWith(`.${issuer}`) ||
                   quoteAddr === issuer ||
                   quoteAddr.endsWith(`.${issuer}`);
          }
          
          // If no issuer provided, match by symbol only
          return pair.baseToken.symbol === symbol || pair.baseToken.symbol === symbol.toUpperCase();
        });
        
        if (xrplPair && xrplPair.priceUsd) {
          const tokenPrice: TokenPrice = {
            price_usd: parseFloat(xrplPair.priceUsd),
            symbol: xrplPair.baseToken.symbol,
            name: xrplPair.baseToken.name || symbol,
            logo: xrplPair.info?.imageUrl || null,
            source: 'DexScreener'
          };
          
          // Cache the result
          priceCache.set(cacheKey, { price: tokenPrice, timestamp: Date.now() });
          
          console.log(`✅ Live price for ${symbol}: $${tokenPrice.price_usd}`);
          return tokenPrice;
        }
      }
    }
    
    console.log(`⚠️ No live price available for ${symbol}`);
    return null;
    
  } catch (error) {
    console.error(`❌ Error fetching price for ${symbol}:`, error);
    return null;
  }
}

/**
 * Calculate exchange rate between two tokens for swaps
 */
export async function getSwapExchangeRate(
  fromSymbol: string, 
  toSymbol: string, 
  fromIssuer?: string, 
  toIssuer?: string,
  amount?: number
): Promise<ExchangeRateResult> {
  try {
    console.log(`💱 Calculating swap rate: ${fromSymbol} → ${toSymbol}${amount ? ` (${amount})` : ''}`);
    
    let fromPrice: number;
    let toPrice: number;
    
    // Handle XRP as special case
    if (fromSymbol === 'XRP' || fromSymbol.toUpperCase() === 'XRP') {
      fromPrice = await getLiveXRPPrice();
    } else {
      const fromTokenPrice = await getLiveTokenPrice(fromSymbol, fromIssuer);
      if (!fromTokenPrice) {
        throw new Error(`No live price available for ${fromSymbol}`);
      }
      fromPrice = fromTokenPrice.price_usd;
    }
    
    if (toSymbol === 'XRP' || toSymbol.toUpperCase() === 'XRP') {
      toPrice = await getLiveXRPPrice();
    } else {
      const toTokenPrice = await getLiveTokenPrice(toSymbol, toIssuer);
      if (!toTokenPrice) {
        return {
          success: false,
          rate: 0,
          fromPrice: 0,
          toPrice: 0,
          error: `Price not available for ${toSymbol}`
        };
      }
      toPrice = toTokenPrice.price_usd;
    }
    
    // Calculate exchange rate
    const rate = fromPrice / toPrice;
    
    // Calculate 1% fee in USD value
    const feePercentage = 0.01; // 1%
    const fee = amount ? (amount * fromPrice * feePercentage) : 0;
    
    console.log(`✅ Exchange rate calculated: 1 ${fromSymbol} = ${rate} ${toSymbol}`);
    console.log(`💰 Prices: ${fromSymbol} = $${fromPrice}, ${toSymbol} = $${toPrice}`);
    
    return {
      success: true,
      rate,
      fromPrice,
      toPrice,
      slippage: 0.005, // 0.5% estimated slippage
      fee: feePercentage
    };
    
  } catch (error) {
    console.error('❌ Exchange rate calculation failed:', error);
    return {
      success: false,
      rate: 0,
      fromPrice: 0,
      toPrice: 0,
      error: 'Failed to calculate exchange rate'
    };
  }
}

/**
 * Get swap quote with fees and slippage
 */
export async function getSwapQuote(
  fromSymbol: string,
  toSymbol: string,
  amount: number,
  fromIssuer?: string,
  toIssuer?: string,
  fromPrice?: number,
  toPrice?: number
): Promise<{
  success: boolean;
  estimatedOutput: number;
  minimumReceived: number;
  feeAmount: number;
  feeToken: string;
  rate: number;
  priceImpact: number;
  error?: string;
}> {
  try {
    // If prices are provided from frontend (which already loaded them), use them directly
    let exchangeRate: any;
    
    if (fromPrice && toPrice) {
      // Use prices from frontend that already has them from token search/owned tokens
      const rate = fromPrice / toPrice;
      console.log(`✅ Using frontend prices: ${fromSymbol}=$${fromPrice}, ${toSymbol}=$${toPrice}, rate=${rate}`);
      
      exchangeRate = {
        success: true,
        rate,
        fromPrice,
        toPrice,
        slippage: 0.005,
        fee: 0.01
      };
    } else {
      // Fallback to fetching prices (shouldn't happen if frontend works correctly)
      exchangeRate = await getSwapExchangeRate(fromSymbol, toSymbol, fromIssuer, toIssuer, amount);
      
      if (!exchangeRate.success) {
        return {
          success: false,
          estimatedOutput: 0,
          minimumReceived: 0,
          feeAmount: 0,
          feeToken: 'XRP',
          rate: 0,
          priceImpact: 0,
          error: exchangeRate.error
        };
      }
    }
    
    // Calculate output amount before fees
    const grossOutput = amount * exchangeRate.rate;
    
    // Calculate 1% fee in XRP equivalent
    const feeUSD = amount * exchangeRate.fromPrice * 0.01; // 1% of USD value
    const xrpPrice = await getLiveXRPPrice();
    const feeInXRP = feeUSD / xrpPrice;
    
    // Calculate expected output (no slippage applied here - that's for the route)
    const estimatedOutput = grossOutput; // Pure output without slippage
    const minimumReceived = estimatedOutput; // Will be overridden by route with user's slippage
    
    console.log(`💰 Swap quote: ${amount} ${fromSymbol} → ${estimatedOutput.toFixed(5)} ${toSymbol}`);
    console.log(`💸 Fee: ${feeInXRP.toFixed(5)} XRP (1% of USD value)`);
    
    return {
      success: true,
      estimatedOutput,
      minimumReceived,
      feeAmount: feeInXRP,
      feeToken: 'XRP',
      rate: exchangeRate.rate,
      priceImpact: 0.005, // Estimated 0.5% price impact
    };
    
  } catch (error) {
    console.error('❌ Swap quote calculation failed:', error);
    return {
      success: false,
      estimatedOutput: 0,
      minimumReceived: 0,
      feeAmount: 0,
      feeToken: 'XRP',
      rate: 0,
      priceImpact: 0,
      error: 'Failed to calculate swap quote'
    };
  }
}

/**
 * Clear price cache (useful for testing or forced refresh)
 */
export function clearPriceCache(): void {
  priceCache.clear();
  console.log('🧹 Price cache cleared');
}

export default {
  getLiveXRPPrice,
  getLiveTokenPrice,
  getSwapExchangeRate,
  getSwapQuote,
  clearPriceCache
};