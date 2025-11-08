// Resilient Exchange Rate Service for Bridge Transactions
// Features: LRU caching, USD triangulation, multi-source fallbacks, exponential backoff

import { db } from '../db';
import { sql } from 'drizzle-orm';
import { tokenLoader } from './tokens/token-loader.js';

interface TokenPrice {
  usd: number;
  source: 'dexscreener' | 'coingecko' | 'combined' | 'triangulation';
  confidence: 'high' | 'medium' | 'low';
  timestamp: number;
  isStale?: boolean;
}

interface ExchangeRate {
  fromToken: string;
  toToken: string;
  rate: number;
  usdPrice: {
    from: number;
    to: number;
  };
  platformFee: number;
  totalFee: number;
  source: string;
  timestamp: number;
  confidence: 'high' | 'medium' | 'low';
}

interface CacheEntry {
  price: TokenPrice;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
}

interface PendingRequest {
  promise: Promise<TokenPrice | null>;
  timestamp: number;
}

// Enhanced token mappings with multiple sources
const TOKEN_MAPPINGS: Record<string, any> = {
  // XRPL tokens
  XRP: { 
    coingeckoId: 'ripple',
    dexScreener: 'xrp',
    decimals: 6,
    isMajor: true
  },
  RDL: {
    issuer: 'r9xvnzUWZJpDu3NA6MKHmKhKJQTRqCRgu9',
    currency: '52444C0000000000000000000000000000000000',
    dexScreener: 'RDL.r9xvnzUWZJpDu3NA6MKHmKhKJQTRqCRgu9_XRP',
    decimals: 15,
    isMajor: false
  },
  
  MATIC: { 
    coingeckoId: 'matic-network',
    binanceSymbol: 'MATICUSDT',
    dexScreener: 'polygon',
    decimals: 18,
    isMajor: true
  },
  
  SRDL: {
    mint: '4tPL1ZPT4uy36VYjoDvoCpvNYurscS324D8P9Ap32AzE',
    dexScreener: 'solana/4tPL1ZPT4uy36VYjoDvoCpvNYurscS324D8P9Ap32AzE',
    decimals: 6,
    isMajor: false
  },
  
  // Bitcoin
  BTC: { 
    coingeckoId: 'bitcoin',
    binanceSymbol: 'BTCUSDT', // Primary source - most accurate
    dexScreener: 'bitcoin', // Fallback only
    decimals: 8,
    isMajor: true
  },
  
  // Add all major tokens with Binance support
  ETH: { 
    coingeckoId: 'ethereum',
    binanceSymbol: 'ETHUSDT',
    dexScreener: 'ethereum',
    decimals: 18,
    isMajor: true
  },
  BNB: { 
    coingeckoId: 'binancecoin',
    binanceSymbol: 'BNBUSDT',
    dexScreener: 'binancecoin',
    decimals: 18,
    isMajor: true
  },
  SOL: { 
    coingeckoId: 'solana',
    binanceSymbol: 'SOLUSDT',
    dexScreener: 'solana',
    decimals: 9,
    isMajor: true
  }
};

class ExchangeRateService {
  private static PLATFORM_FEE = 0.01; // 1% platform fee
  
  // Enhanced LRU cache with stale-if-error support
  private static priceCache = new Map<string, CacheEntry>();
  private static MAX_CACHE_SIZE = 100;
  private static CACHE_DURATION = 90 * 1000; // 90 seconds fresh
  private static STALE_DURATION = 5 * 60 * 1000; // 5 minutes stale fallback
  
  // Request deduplication
  private static pendingRequests = new Map<string, PendingRequest>();
  private static REQUEST_TIMEOUT = 15 * 1000; // 15 seconds timeout
  
  // Exponential backoff tracking
  private static backoffData = new Map<string, { attempts: number; nextRetryTime: number }>();
  private static MAX_BACKOFF_ATTEMPTS = 5;
  private static BASE_BACKOFF_MS = 1000; // Start with 1 second

  // Get token mapping with configuration
  private static getTokenMapping(token: string): any {
    return TOKEN_MAPPINGS[token.toUpperCase()] || null;
  }
  
  // LRU cache management
  private static evictLRU(): void {
    if (this.priceCache.size < this.MAX_CACHE_SIZE) return;
    
    // Find least recently accessed entry
    let lruKey = '';
    let oldestAccess = Date.now();
    
    for (const [key, entry] of Array.from(this.priceCache.entries())) {
      if (entry.lastAccessed < oldestAccess) {
        oldestAccess = entry.lastAccessed;
        lruKey = key;
      }
    }
    
    if (lruKey) {
      this.priceCache.delete(lruKey);
      console.log(`💾 Evicted LRU cache entry: ${lruKey}`);
    }
  }
  
  // Enhanced cache operations
  private static getCachedPrice(token: string): TokenPrice | null {
    const cached = this.priceCache.get(token);
    if (!cached) return null;
    
    const now = Date.now();
    const age = now - cached.timestamp;
    
    // Update access stats for LRU
    cached.lastAccessed = now;
    cached.accessCount++;
    
    // Return fresh cache
    if (age <= this.CACHE_DURATION) {
      console.log(`📦 Fresh cache hit for ${token}: $${cached.price.usd} (${Math.round(age / 1000)}s old)`);
      return cached.price;
    }
    
    // Return stale cache if within stale duration
    if (age <= this.STALE_DURATION) {
      console.log(`⏰ Stale cache hit for ${token}: $${cached.price.usd} (${Math.round(age / 1000)}s old)`);
      return { ...cached.price, isStale: true, confidence: 'low' };
    }
    
    // Too old, remove from cache
    this.priceCache.delete(token);
    console.log(`🗑️ Expired cache entry removed for ${token}`);
    return null;
  }
  
  private static setCachedPrice(token: string, price: TokenPrice): void {
    this.evictLRU();
    this.priceCache.set(token, {
      price,
      timestamp: Date.now(),
      accessCount: 1,
      lastAccessed: Date.now()
    });
    console.log(`💾 Cached price for ${token}: $${price.usd} (${price.source})`);
  }
  
  // Exponential backoff management
  private static shouldBackoff(key: string): boolean {
    const backoff = this.backoffData.get(key);
    if (!backoff) return false;
    
    return Date.now() < backoff.nextRetryTime;
  }
  
  private static recordFailure(key: string): void {
    const current = this.backoffData.get(key) || { attempts: 0, nextRetryTime: 0 };
    current.attempts++;
    
    if (current.attempts <= this.MAX_BACKOFF_ATTEMPTS) {
      // Exponential backoff with jitter: base * 2^attempts + random(0, 1000)ms
      const backoffMs = this.BASE_BACKOFF_MS * Math.pow(2, current.attempts - 1) + Math.random() * 1000;
      current.nextRetryTime = Date.now() + backoffMs;
      
      this.backoffData.set(key, current);
      console.log(`⏳ Backoff for ${key}: ${Math.round(backoffMs)}ms (attempt ${current.attempts})`);
    }
  }
  
  private static recordSuccess(key: string): void {
    this.backoffData.delete(key);
  }
  
  // Request deduplication
  private static getOrCreateRequest(key: string, requestFn: () => Promise<TokenPrice | null>): Promise<TokenPrice | null> {
    // Clean expired pending requests
    for (const [pendingKey, pending] of Array.from(this.pendingRequests.entries())) {
      if (Date.now() - pending.timestamp > this.REQUEST_TIMEOUT) {
        this.pendingRequests.delete(pendingKey);
      }
    }
    
    // Return existing request if pending
    const existing = this.pendingRequests.get(key);
    if (existing) {
      console.log(`🔄 Deduplicating request for ${key}`);
      return existing.promise;
    }
    
    // Create new request
    const promise = requestFn().finally(() => {
      this.pendingRequests.delete(key);
    });
    
    this.pendingRequests.set(key, {
      promise,
      timestamp: Date.now()
    });
    
    return promise;
  }

  // Enhanced DexScreener price fetching with timeout and backoff
  private static async getDexScreenerPrice(token: string): Promise<TokenPrice | null> {
    const backoffKey = `dexscreener_${token}`;
    
    // Check backoff
    if (this.shouldBackoff(backoffKey)) {
      console.log(`⏳ DexScreener backing off for ${token}`);
      return null;
    }

    try {
      const mapping = this.getTokenMapping(token);
      if (!mapping?.dexScreener) {
        console.log(`⚠️ No DexScreener mapping found for ${token}`);
        return null;
      }

      let url: string;
      
      // Dynamic XRPL token detection and API handling
      if (mapping?.issuer && mapping?.currency) {
        // XRPL token with issuer - use direct pair if available, otherwise search
        if (mapping.dexScreener && mapping.dexScreener.includes('_')) {
          console.log(`🔍 Using direct XRPL pair for ${token}: ${mapping.dexScreener}`);
          url = `https://api.dexscreener.com/latest/dex/pairs/xrpl/${mapping.dexScreener}`;
        } else {
          console.log(`🔍 Searching XRPL pairs for ${token}`);
          url = `https://api.dexscreener.com/latest/dex/search?q=${token}`;
        }
      } else if (token === 'XRP') {
        // XRP has multiple pairs across chains
        url = 'https://api.dexscreener.com/latest/dex/search?q=XRP';
      } else if (token.toUpperCase() === 'SRDL') {
        // SRDL by mint address search - direct API approach
        const srdlMint = '4tPL1ZPT4uy36VYjoDvoCpvNYurscS324D8P9Ap32AzE';
        url = `https://api.dexscreener.com/latest/dex/search?q=${srdlMint}`;
      } else {
        // General search for all other tokens
        url = `https://api.dexscreener.com/latest/dex/search?q=${token}`;
      }

      console.log(`📊 Fetching DexScreener price for ${token}: ${url}`);
      
      // Enhanced timeout with configurable duration
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      try {
        const response = await fetch(url, { 
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'RiddleSwap/1.0'
          }
        });
        clearTimeout(timeout);
        
        if (!response.ok) {
          console.error(`❌ DexScreener API error for ${token}: ${response.status}`);
          this.recordFailure(backoffKey);
          return null;
        }
        
        const data = await response.json() as any;
        
        let price: number | null = null;
      
        // Extract price based on response format
        if (data.pair) {
          // Direct pair response
          price = parseFloat(data.pair.priceUsd);
          console.log(`🎯 Direct ${token} pair price: $${price}`);
        } else if (data.pairs && data.pairs.length > 0) {
          // Search response - prioritize exact symbol matches and chain-specific logic
          let targetPair;
          
          // SRDL direct matching by mint address
          if (token.toUpperCase() === 'SRDL') {
            // Use exact mint address match only
            const srdlMint = mapping.mint; // Use mint address from TOKEN_MAPPINGS
            targetPair = data.pairs.find((p: any) => 
              (p.baseToken?.address === srdlMint || p.quoteToken?.address === srdlMint) && 
              p.chainId === 'solana'
            );
            if (targetPair) {
              console.log(`🎯 SRDL direct match: $${parseFloat(targetPair.priceUsd)}`);
            }
          }
          
          // Check if this is an XRPL token (has issuer mapping)
          const isXRPLToken = mapping?.issuer && mapping?.currency;
          
          if (!targetPair && isXRPLToken) {
            // For XRPL tokens, prioritize XRPL chain pairs
            const xrplPairs = data.pairs.filter((p: any) => p.chainId === 'xrpl');
            if (xrplPairs.length > 0) {
              targetPair = xrplPairs.sort((a: any, b: any) => 
                (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
              )[0];
              console.log(`🎯 Selected XRPL pair for ${token}: $${parseFloat(targetPair.priceUsd)} (liquidity: $${targetPair.liquidity?.usd || 0})`);
            }
          }
          
          // Special handling for XRP to avoid wrapped/bridged tokens
          if (token.toUpperCase() === 'XRP' && !targetPair) {
            // Filter out obviously low-value pairs (< $1 for XRP)
            const validPairs = data.pairs.filter((p: any) => {
              const pairPrice = parseFloat(p.priceUsd);
              return pairPrice > 1.0; // XRP should be > $1
            });
            
            if (validPairs.length > 0) {
              // Sort by liquidity among valid pairs
              targetPair = validPairs.sort((a: any, b: any) => 
                (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
              )[0];
              console.log(`🎯 Selected valid XRP pair: ${targetPair.chainId} - $${parseFloat(targetPair.priceUsd)} (liquidity: $${targetPair.liquidity?.usd || 0})`);
            }
          }
          
          // Fallback selection if no specific match found
          if (!targetPair) {
            // Select highest liquidity pair for general tokens
            targetPair = data.pairs.sort((a: any, b: any) => 
              (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
            )[0];
            
            if (targetPair) {
              console.log(`🎯 Selected highest liquidity pair for ${token}: $${parseFloat(targetPair.priceUsd)}`);
            }
          }
          
          if (targetPair) {
            price = parseFloat(targetPair.priceUsd);
          }
        }

        if (price && price > 0) {
          const result = { usd: price, source: 'dexscreener' as const, confidence: 'high' as const, timestamp: Date.now() };
          console.log(`✅ DexScreener price for ${token}: $${price}`);
          this.recordSuccess(backoffKey);
          return result;
        }

        console.log(`❌ Invalid price data for ${token}: ${price}`);
        this.recordFailure(backoffKey);
        return null;
      } catch (fetchError) {
        console.error(`⚠️ DexScreener fetch error for ${token}:`, fetchError);
        this.recordFailure(backoffKey);
        return null;
      }
    } catch (error) {
      console.error(`❌ DexScreener error for ${token}:`, error);
      this.recordFailure(backoffKey);
      return null;
    }
  }

  // Enhanced CoinGecko price fetching with resilient error handling
  private static async getCoinGeckoPrice(token: string): Promise<TokenPrice | null> {
    const backoffKey = `coingecko_${token}`;
    
    // Check backoff
    if (this.shouldBackoff(backoffKey)) {
      console.log(`⏳ CoinGecko backing off for ${token}`);
      return null;
    }
    
    const mapping = this.getTokenMapping(token);
    if (!mapping?.coingeckoId) return null;
    
    return this.getOrCreateRequest(`coingecko_${token}`, async () => {
      try {
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${mapping.coingeckoId}&vs_currencies=usd`;
        console.log(`📊 Fetching CoinGecko price for ${token}: ${url}`);
        
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        try {
          const response = await fetch(url, { 
            signal: controller.signal,
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'RiddleSwap-Bridge/1.0',
              'Accept-Encoding': 'gzip'
            }
          });
          clearTimeout(timeout);
          
          if (response.status === 429) {
            console.log(`⏳ CoinGecko rate limited for ${token}`);
            this.recordFailure(backoffKey);
            return null;
          }
          
          if (!response.ok) {
            console.error(`❌ CoinGecko API error for ${token}: ${response.status} ${response.statusText}`);
            this.recordFailure(backoffKey);
            return null;
          }
          
          const data = await response.json() as any;
          const price = data[mapping.coingeckoId]?.usd;

          if (price && typeof price === 'number' && price > 0) {
            const result = { usd: price, source: 'coingecko' as const, confidence: 'high' as const, timestamp: Date.now() };
            console.log(`✅ CoinGecko price for ${token}: $${price}`);
            this.recordSuccess(backoffKey);
            return result;
          }

          console.log(`⚠️ Invalid CoinGecko price data for ${token}:`, price);
          this.recordFailure(backoffKey);
          return null;
        } catch (fetchError) {
          if ((fetchError as Error).name === 'AbortError') {
            console.error(`⏰ CoinGecko request timeout for ${token}`);
          } else {
            console.error(`⚠️ CoinGecko fetch error for ${token}:`, fetchError);
          }
          this.recordFailure(backoffKey);
          return null;
        }
      } catch (error) {
        console.error(`❌ CoinGecko error for ${token}:`, error);
        this.recordFailure(backoffKey);
        return null;
      }
    });
  }

  // Binance API fallback for major tokens (BTC, ETH, etc.)
  private static async getBinancePrice(token: string): Promise<TokenPrice | null> {
    const backoffKey = `binance_${token}`;
    
    // Check backoff
    if (this.shouldBackoff(backoffKey)) {
      console.log(`⏳ Binance backing off for ${token}`);
      return null;
    }
    
    const mapping = this.getTokenMapping(token);
    if (!mapping?.binanceSymbol) {
      return null;
    }
    
    return this.getOrCreateRequest(`binance_${token}`, async () => {
      try {
        const url = `https://api.binance.com/api/v3/ticker/price?symbol=${mapping.binanceSymbol}`;
        console.log(`📊 Fetching Binance price for ${token}: ${url}`);
        
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        
        try {
          const response = await fetch(url, { 
            signal: controller.signal,
            headers: {
              'Accept': 'application/json'
            }
          });
          clearTimeout(timeout);
          
          if (!response.ok) {
            console.error(`❌ Binance API error for ${token}: ${response.status}`);
            this.recordFailure(backoffKey);
            return null;
          }
          
          const data = await response.json() as any;
          const price = parseFloat(data.price);

          if (price && price > 0) {
            const result = { 
              usd: price, 
              source: 'coingecko' as const, // Label as coingecko for consistency
              confidence: 'high' as const, 
              timestamp: Date.now() 
            };
            console.log(`✅ Binance price for ${token}: $${price}`);
            this.recordSuccess(backoffKey);
            return result;
          }

          console.log(`⚠️ Invalid Binance price data for ${token}:`, price);
          this.recordFailure(backoffKey);
          return null;
        } catch (fetchError) {
          if ((fetchError as Error).name === 'AbortError') {
            console.error(`⏰ Binance request timeout for ${token}`);
          } else {
            console.error(`⚠️ Binance fetch error for ${token}:`, fetchError);
          }
          this.recordFailure(backoffKey);
          return null;
        }
      } catch (error) {
        console.error(`❌ Binance error for ${token}:`, error);
        this.recordFailure(backoffKey);
        return null;
      }
    });
  }

  // USD Triangulation: Calculate indirect rate through USD
  private static async getTriangulatedPrice(token: string, baseTokens: string[]): Promise<TokenPrice | null> {
    console.log(`🔺 Attempting USD triangulation for ${token} via [${baseTokens.join(', ')}]`);
    
    for (const baseToken of baseTokens) {
      try {
        // Get base token USD price (cached only for speed)
        const basePrice = this.getCachedPrice(baseToken);
        if (!basePrice || basePrice.isStale) continue;
        
        // Try direct DEX pair lookup for token/base
        const dexPrice = await this.getDexScreenerPrice(token);
        if (dexPrice) {
          // For simplicity, use the DEX price directly since it's already in USD
          // In a more complex system, we could try to find token/base pairs specifically
          console.log(`🎯 Found direct USD price for ${token} during triangulation: $${dexPrice.usd}`);
          return {
            usd: dexPrice.usd,
            source: 'triangulation' as const,
            confidence: 'medium' as const,
            timestamp: Date.now()
          };
        }
      } catch (error) {
        console.log(`⚠️ Triangulation failed for ${token} via ${baseToken}:`, error);
        continue;
      }
    }
    
    console.log(`❌ USD triangulation failed for ${token}`);
    return null;
  }
  
  // Enhanced price fetching with multiple sources and fallbacks
  public static async getBridgeTokenPrice(token: string): Promise<TokenPrice> {
    console.log(`🔍 Getting resilient price for ${token}...`);
    
    // Check cache first (including stale)
    const cached = this.getCachedPrice(token);
    if (cached && !cached.isStale) {
      return cached;
    }
    
    const mapping = this.getTokenMapping(token);
    let finalPrice: TokenPrice | null = null;
    const attempts: string[] = [];
    
    // Strategy 1: Primary source based on token type
    if (mapping?.isMajor) {
      // Major tokens: Try Binance first for most accurate prices
      if (mapping.binanceSymbol) {
        const binancePrice = await this.getBinancePrice(token);
        if (binancePrice) {
          finalPrice = binancePrice;
          attempts.push('binance-primary');
        }
      }
      
      // Fallback to CoinGecko if Binance fails
      if (!finalPrice) {
        const cgPrice = await this.getCoinGeckoPrice(token);
        if (cgPrice) {
          finalPrice = cgPrice;
          attempts.push('coingecko-primary');
        }
      }
    } else {
      // Alt tokens: DexScreener first
      const dexPrice = await this.getDexScreenerPrice(token);
      if (dexPrice) {
        finalPrice = dexPrice;
        attempts.push('dexscreener-primary');
      }
    }
    
    // Strategy 2: Secondary source fallback
    if (!finalPrice) {
      if (mapping?.isMajor) {
        // Try DexScreener as fallback for major tokens
        const dexPrice = await this.getDexScreenerPrice(token);
        if (dexPrice) {
          finalPrice = dexPrice;
          attempts.push('dexscreener-fallback');
        }
      } else if (mapping?.coingeckoId) {
        // Try CoinGecko as fallback for alt tokens
        const cgPrice = await this.getCoinGeckoPrice(token);
        if (cgPrice) {
          finalPrice = cgPrice;
          attempts.push('coingecko-fallback');
        }
      }
    }
    
    // Strategy 3: Binance fallback for major tokens (BTC, ETH, etc.)
    if (!finalPrice && mapping?.binanceSymbol) {
      const binancePrice = await this.getBinancePrice(token);
      if (binancePrice) {
        finalPrice = binancePrice;
        attempts.push('binance-fallback');
      }
    }
    
    // Strategy 4: USD Triangulation
    if (!finalPrice) {
      const majorBases = ['XRP', 'ETH', 'BTC', 'SOL'];
      const triangulated = await this.getTriangulatedPrice(token, majorBases);
      if (triangulated) {
        finalPrice = triangulated;
        attempts.push('triangulation');
      }
    }
    
    // Strategy 5: Stale cache as last resort
    if (!finalPrice && cached?.isStale) {
      console.log(`🚨 Using stale cache for ${token} as last resort`);
      finalPrice = cached;
      attempts.push('stale-cache');
    }
    
    // Cache and return if successful
    if (finalPrice) {
      if (!finalPrice.isStale) {
        this.setCachedPrice(token, finalPrice);
      }
      console.log(`✅ ${token} price: $${finalPrice.usd} via [${attempts.join(' → ')}] (${finalPrice.confidence})`);
      return finalPrice;
    }
    
    // Total failure
    console.error(`❌ All price sources failed for ${token} after [${attempts.join(', ')}]`);
    throw new Error(`Unable to fetch ${token} price from any source. All providers unavailable.`);
  }

  // Enhanced exchange rate calculation with confidence scoring
  public static async getExchangeRate(
    fromToken: string, 
    toToken: string, 
    amount: number = 1
  ): Promise<ExchangeRate> {
    console.log(`💱 Calculating resilient exchange rate: ${amount} ${fromToken} -> ${toToken}`);
    
    try {
      // Get prices for both tokens with resilient fallbacks
      const [fromPrice, toPrice] = await Promise.all([
        this.getBridgeTokenPrice(fromToken),
        this.getBridgeTokenPrice(toToken)
      ]);

      // Calculate raw exchange rate
      const rate = fromPrice.usd / toPrice.usd;
      
      // Determine overall confidence level
      const overallConfidence = this.calculateConfidence(fromPrice, toPrice);
      
      // For XRP bridge: fee is added to input, not deducted from output
      if (fromToken.toUpperCase() === 'XRP') {
        const outputAmount = amount * rate;
        const feeAmountInXRP = amount * this.PLATFORM_FEE;
        
        console.log(`📊 XRP Bridge Exchange Rate:`);
        console.log(`  - Rate: 1 ${fromToken} = ${rate.toFixed(6)} ${toToken}`);
        console.log(`  - Output: ${outputAmount.toFixed(6)} ${toToken}`);
        console.log(`  - Fee: ${feeAmountInXRP.toFixed(6)} ${fromToken}`);
        console.log(`  - Confidence: ${overallConfidence} (${fromPrice.source}/${toPrice.source})`);
        
        return {
          fromToken,
          toToken,
          rate: rate,
          usdPrice: { from: fromPrice.usd, to: toPrice.usd },
          platformFee: this.PLATFORM_FEE,
          totalFee: feeAmountInXRP,
          source: `${fromPrice.source}/${toPrice.source}`,
          timestamp: Date.now(),
          confidence: overallConfidence
        };
      } else {
        const outputAmount = amount * rate;
        const feeAmount = amount * rate * this.PLATFORM_FEE;
        
        console.log(`📊 Bridge Exchange Rate:`);
        console.log(`  - Rate: 1 ${fromToken} = ${rate.toFixed(6)} ${toToken}`);
        console.log(`  - Output: ${outputAmount.toFixed(6)} ${toToken}`);
        console.log(`  - Fee: ${feeAmount.toFixed(6)} ${toToken}`);
        console.log(`  - Confidence: ${overallConfidence} (${fromPrice.source}/${toPrice.source})`);
        
        return {
          fromToken,
          toToken,
          rate: rate,
          usdPrice: { from: fromPrice.usd, to: toPrice.usd },
          platformFee: this.PLATFORM_FEE,
          totalFee: feeAmount,
          source: `${fromPrice.source}/${toPrice.source}`,
          timestamp: Date.now(),
          confidence: overallConfidence
        };
      }
    } catch (error) {
      console.error(`❌ Exchange rate calculation failed for ${fromToken} -> ${toToken}:`, error);
      throw error;
    }
  }
  
  // Calculate confidence level based on price sources
  private static calculateConfidence(fromPrice: TokenPrice, toPrice: TokenPrice): 'high' | 'medium' | 'low' {
    const confidenceScores = { high: 3, medium: 2, low: 1 };
    const fromScore = confidenceScores[fromPrice.confidence];
    const toScore = confidenceScores[toPrice.confidence];
    
    // Use stale data or triangulation reduces confidence
    if (fromPrice.isStale || toPrice.isStale) return 'low';
    if (fromPrice.source === 'triangulation' || toPrice.source === 'triangulation') return 'medium';
    
    const avgScore = (fromScore + toScore) / 2;
    if (avgScore >= 2.5) return 'high';
    if (avgScore >= 1.5) return 'medium';
    return 'low';
  }

  // Get all supported exchange rates with resilient error handling
  public static async getAllExchangeRates(): Promise<any> {
    const tokens = ['XRP', 'RDL', 'ETH', 'SOL', 'BTC', 'SRDL'];
    const rates: any = {};
    const errors: string[] = [];

    // Pre-warm cache with major token prices
    const majorTokens = tokens.filter(token => this.getTokenMapping(token)?.isMajor);
    console.log(`🔥 Pre-warming cache for major tokens: [${majorTokens.join(', ')}]`);
    
    const cachePromises = majorTokens.map(async token => {
      try {
        await this.getBridgeTokenPrice(token);
      } catch (error) {
        console.log(`⚠️ Failed to pre-warm ${token}:`, error);
      }
    });
    
    await Promise.allSettled(cachePromises);

    // Calculate all exchange rates
    for (const from of tokens) {
      rates[from] = {};
      for (const to of tokens) {
        if (from !== to) {
          try {
            const rate = await this.getExchangeRate(from, to);
            rates[from][to] = rate;
          } catch (error) {
            const errorMsg = `Failed to get rate for ${from} -> ${to}: ${error}`;
            console.error(errorMsg);
            errors.push(errorMsg);
            rates[from][to] = null;
          }
        }
      }
    }
    
    // Log cache statistics
    console.log(`📊 Cache statistics: ${this.priceCache.size}/${this.MAX_CACHE_SIZE} entries`);
    if (errors.length > 0) {
      console.log(`⚠️ ${errors.length} rate calculation errors occurred`);
    }

    return rates;
  }
  
  // Get cache status for monitoring
  public static getCacheStatus(): any {
    const entries = Array.from(this.priceCache.entries()).map(([token, entry]) => ({
      token,
      price: entry.price.usd,
      source: entry.price.source,
      confidence: entry.price.confidence,
      age: Math.round((Date.now() - entry.timestamp) / 1000),
      accessCount: entry.accessCount,
      isStale: entry.price.isStale || false
    }));
    
    return {
      cacheSize: this.priceCache.size,
      maxSize: this.MAX_CACHE_SIZE,
      pendingRequests: this.pendingRequests.size,
      backoffEntries: this.backoffData.size,
      entries: entries.sort((a, b) => b.accessCount - a.accessCount)
    };
  }
}

export { ExchangeRateService };
const BridgeExchangeRates = ExchangeRateService;
export { BridgeExchangeRates };
export type { TokenPrice, ExchangeRate };