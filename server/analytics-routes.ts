import { Router } from "express";
import { z } from "zod";
import { getXRPLTokenBySymbol, type DexScreenerPair } from "./dexscreener-api";
import { cacheManager, CACHE_TYPES } from "./unified-cache-manager";
import { sessionAuth, type AuthenticatedRequest } from "./middleware/session-auth";
import { requireAdminAccess } from "./middleware/admin-auth";

const router = Router();

// Validation schema for token analytics request
const tokenAnalyticsSchema = z.object({
  symbol: z.string().min(1, "Token symbol is required"),
  issuer: z.string().optional()
});

// Function to transform DexScreener pair data to analytics response format
async function transformPairToAnalytics(pair: DexScreenerPair, symbol: string, issuer?: string) {
  // Priority: DexScreener logo first (better quality), then Bithomp fallback
  let logoUrl = pair.info?.imageUrl || null;
  
  if (issuer && symbol) {
    // XRPL tokens: Check DexScreener first, use Bithomp as fallback
    if (logoUrl) {
      console.log(`🎨 [ANALYTICS] Using DexScreener logo for ${symbol}: ${logoUrl}`);
    } else {
      // Fallback to Bithomp CDN - extract hex currency from DexScreener pairAddress
      // Format: {currency}.{issuer}
      let hexCurrency = symbol; // fallback to symbol
      
      if (pair.pairAddress && pair.pairAddress.includes('.')) {
        const [currency] = pair.pairAddress.split('.');
        if (currency) {
          hexCurrency = currency;
          console.log(`🎨 [ANALYTICS] Extracted hex currency from pairAddress for ${symbol}: ${hexCurrency}`);
        }
      }
      
      // If we didn't get hex from pairAddress, try xrpl.to API
      if (hexCurrency === symbol) {
        try {
          const xrplResponse = await fetch(`https://api.xrpl.to/api/tokens?issuer=${issuer}&limit=20`);
          if (xrplResponse.ok) {
            const xrplData = await xrplResponse.json() as any;
            const matchingToken = xrplData.tokens?.find((t: any) => 
              t.name?.toUpperCase() === symbol.toUpperCase()
            );
            if (matchingToken?.currency) {
              hexCurrency = matchingToken.currency;
              console.log(`🎨 [ANALYTICS] Found hex currency from xrpl.to for ${symbol}: ${hexCurrency}`);
            }
          }
        } catch (error) {
          console.log(`⚠️ [ANALYTICS] Failed to get hex currency from xrpl.to, using pairAddress/symbol`);
        }
      }
      
      logoUrl = `https://cdn.bithomp.com/issued-token/${issuer}/${hexCurrency}`;
      console.log(`🎨 [ANALYTICS] Fallback to Bithomp CDN logo for XRPL token ${symbol}: ${logoUrl}`);
    }
  }
  
  return {
    success: true,
    symbol: symbol.toUpperCase(),
    issuer: issuer || '',
    data: {
      priceUsd: parseFloat(pair.priceUsd || '0'),
      priceChange: {
        m5: pair.priceChange.m5,
        h1: pair.priceChange.h1,
        h24: pair.priceChange.h24
      },
      txns: {
        m5: pair.txns.m5.buys + pair.txns.m5.sells,
        h1: pair.txns.h1.buys + pair.txns.h1.sells,
        h6: pair.txns.h6.buys + pair.txns.h6.sells,
        h24: pair.txns.h24.buys + pair.txns.h24.sells
      },
      volume: {
        h24: pair.volume.h24,
        h6: pair.volume.h6,
        h1: pair.volume.h1,
        m5: pair.volume.m5
      },
      liquidity: pair.liquidity ? {
        usd: pair.liquidity.usd || 0,
        base: pair.liquidity.base,
        quote: pair.liquidity.quote
      } : undefined,
      fdv: pair.fdv,
      marketCap: pair.marketCap,
      pairUrl: pair.url,
      logoUrl: logoUrl
    }
  };
}

/**
 * GET /api/analytics/xrpl/token
 * Get comprehensive token analytics data from DexScreener
 * Query Parameters: symbol (required), issuer (optional)
 */
router.get("/xrpl/token", async (req, res) => {
  try {
    const { symbol, issuer } = tokenAnalyticsSchema.parse(req.query);
    
    console.log(`📊 [ANALYTICS] Getting analytics for ${symbol}${issuer ? ` (${issuer})` : ''}`);
    
    // Create cache key
    const cacheKey = `${symbol.toLowerCase()}-${issuer || 'no-issuer'}`;
    
    // Use unified cache manager
    const cachedData = await cacheManager.get(
      CACHE_TYPES.DEXSCREENER_ANALYTICS,
      cacheKey,
      async () => {
        console.log(`🔄 [ANALYTICS] Fetching fresh analytics data for ${symbol}`);
        
        // Fetch fresh data from DexScreener
        const pair = await getXRPLTokenBySymbol(symbol, issuer);
        
        if (!pair) {
          console.log(`❌ [ANALYTICS] No data found for ${symbol}${issuer ? ` (${issuer})` : ''}`);
          
          const errorResponse = {
            success: false,
            symbol: symbol.toUpperCase(),
            issuer: issuer || '',
            error: `No analytics data found for token ${symbol.toUpperCase()}${issuer ? ` with issuer ${issuer}` : ''}. Token may not be actively traded or may not exist.`
          };
          
          // Cache error response with shorter TTL (30 seconds)
          await cacheManager.set(CACHE_TYPES.DEXSCREENER_ANALYTICS, cacheKey, errorResponse, 30000);
          return errorResponse;
        }
        
        // Transform pair data to analytics format
        const analyticsData = await transformPairToAnalytics(pair, symbol, issuer);
        console.log(`✅ [ANALYTICS] Successfully retrieved analytics for ${symbol}, price: $${analyticsData.data.priceUsd}`);
        
        return analyticsData;
      }
    );
    
    // Return cached or fresh data
    if (cachedData) {
      if (!cachedData.success) {
        return res.status(404).json(cachedData);
      }
      res.json(cachedData);
    } else {
      throw new Error('Failed to fetch analytics data');
    }
    
  } catch (error) {
    console.error("❌ [ANALYTICS] Error fetching token analytics:", error);
    
    let errorMessage = "Failed to fetch token analytics";
    let statusCode = 500;
    
    if (error instanceof z.ZodError) {
      errorMessage = error.errors.map(e => e.message).join(', ');
      statusCode = 400;
    }
    
    res.status(statusCode).json({
      success: false,
      symbol: req.query.symbol?.toString().toUpperCase() || '',
      issuer: req.query.issuer?.toString() || '',
      error: errorMessage
    });
  }
});

/**
 * GET /api/analytics/token
 * Get comprehensive token analytics data from DexScreener for any chain
 * Query Parameters: address (required), chain (required)
 */
router.get("/token", async (req, res) => {
  try {
    const address = req.query.address?.toString();
    const chain = req.query.chain?.toString();
    
    if (!address || !chain) {
      return res.status(400).json({
        success: false,
        error: "Address and chain parameters are required"
      });
    }
    
    console.log(`📊 [MULTI-CHAIN ANALYTICS] Getting analytics for ${address} on ${chain}`);
    
    // Create cache key
    const cacheKey = `${chain}-${address}`.toLowerCase();
    
    // Use unified cache manager
    const cachedData = await cacheManager.get(
      CACHE_TYPES.DEXSCREENER_ANALYTICS,
      cacheKey,
      async () => {
        console.log(`🔄 [MULTI-CHAIN ANALYTICS] Fetching fresh analytics data for ${address} on ${chain}`);
        
        try {
          // Search DexScreener for token on specified chain
          const response = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${address}`);
          
          if (!response.ok) {
            throw new Error(`DexScreener API error: ${response.status}`);
          }
          
          const data = await response.json() as any;
          
          if (!data || !data.pairs || !Array.isArray(data.pairs)) {
            throw new Error('Invalid DexScreener response format');
          }
          
          // Map chain names to DexScreener chain IDs
          const chainMappings: { [key: string]: string[] } = {
            'ethereum': ['ethereum'],
            'base': ['base'],
            'bsc': ['bsc'],
            'polygon': ['polygon'],
            'arbitrum': ['arbitrum'],
            'optimism': ['optimism'],
            'avalanche': ['avalanche'],
            'solana': ['solana']
          };
          
          const targetChains = chainMappings[chain.toLowerCase()] || [chain.toLowerCase()];
          
          // Find the best matching pair for this chain and address
          const matchingPairs = data.pairs.filter((pair: any) => {
            const chainMatch = targetChains.includes(pair.chainId?.toLowerCase());
            const addressMatch = 
              pair.baseToken?.address?.toLowerCase() === address.toLowerCase() ||
              pair.quoteToken?.address?.toLowerCase() === address.toLowerCase();
            
            return chainMatch && addressMatch;
          });
          
          if (matchingPairs.length === 0) {
            throw new Error(`No trading pairs found for token ${address} on ${chain}`);
          }
          
          // Use the pair with highest liquidity
          const bestPair = matchingPairs.sort((a: any, b: any) => 
            (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
          )[0];
          
          // Determine if our token is the base or quote token
          const isBaseToken = bestPair.baseToken?.address?.toLowerCase() === address.toLowerCase();
          const tokenInfo = isBaseToken ? bestPair.baseToken : bestPair.quoteToken;
          
          const analyticsData = {
            success: true,
            symbol: tokenInfo.symbol,
            name: tokenInfo.name,
            address: address,
            chain: chain,
            data: {
              priceUsd: parseFloat(bestPair.priceUsd || '0'),
              priceChange: {
                m5: bestPair.priceChange?.m5,
                h1: bestPair.priceChange?.h1,
                h24: bestPair.priceChange?.h24
              },
              txns: {
                m5: bestPair.txns?.m5 ? bestPair.txns.m5.buys + bestPair.txns.m5.sells : 0,
                h1: bestPair.txns?.h1 ? bestPair.txns.h1.buys + bestPair.txns.h1.sells : 0,
                h6: bestPair.txns?.h6 ? bestPair.txns.h6.buys + bestPair.txns.h6.sells : 0,
                h24: bestPair.txns?.h24 ? bestPair.txns.h24.buys + bestPair.txns.h24.sells : 0
              },
              volume: {
                h24: bestPair.volume?.h24 || 0,
                h6: bestPair.volume?.h6 || 0,
                h1: bestPair.volume?.h1 || 0,
                m5: bestPair.volume?.m5 || 0
              },
              liquidity: bestPair.liquidity ? {
                usd: bestPair.liquidity.usd || 0,
                base: bestPair.liquidity.base,
                quote: bestPair.liquidity.quote
              } : undefined,
              fdv: bestPair.fdv,
              marketCap: bestPair.marketCap,
              pairUrl: bestPair.url,
              logoUrl: bestPair.info?.imageUrl || null,
              description: `${tokenInfo.name} is a token on ${chain} with address ${address}. Real-time data powered by DexScreener.`
            }
          };
          
          console.log(`✅ [MULTI-CHAIN ANALYTICS] Successfully retrieved analytics for ${tokenInfo.symbol} on ${chain}, price: $${analyticsData.data.priceUsd}`);
          
          return analyticsData;
          
        } catch (error) {
          console.log(`❌ [MULTI-CHAIN ANALYTICS] Error fetching data for ${address} on ${chain}:`, error);
          
          const errorResponse = {
            success: false,
            symbol: '',
            address: address,
            chain: chain,
            error: `No analytics data found for token ${address} on ${chain}. Token may not be actively traded or may not exist.`
          };
          
          // Cache error response with shorter TTL (30 seconds)
          await cacheManager.set(CACHE_TYPES.DEXSCREENER_ANALYTICS, cacheKey, errorResponse, 30000);
          return errorResponse;
        }
      }
    );
    
    // Return cached or fresh data
    if (cachedData) {
      if (!cachedData.success) {
        return res.status(404).json(cachedData);
      }
      res.json(cachedData);
    } else {
      throw new Error('Failed to fetch analytics data');
    }
    
  } catch (error) {
    console.error("❌ [MULTI-CHAIN ANALYTICS] Error fetching token analytics:", error);
    
    res.status(500).json({
      success: false,
      symbol: '',
      address: req.query.address?.toString() || '',
      chain: req.query.chain?.toString() || '',
      error: "Failed to fetch token analytics"
    });
  }
});

/**
 * GET /api/analytics/xrpl/token/cache-stats
 * Get comprehensive cache statistics from unified cache manager
 */
router.get("/xrpl/token/cache-stats", async (req, res) => {
  try {
    const stats = cacheManager.getStats();
    const healthCheck = await cacheManager.healthCheck();
    
    res.json({
      success: true,
      stats,
      health: healthCheck,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error("❌ [ANALYTICS] Error getting cache stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get cache statistics"
    });
  }
});

/**
 * POST /api/analytics/cache/clear
 * Clear analytics cache manually (Admin only)
 */
router.post("/cache/clear", sessionAuth, requireAdminAccess, async (req: AuthenticatedRequest, res) => {
  try {
    const { cacheType } = req.body;
    
    let clearedCount = 0;
    if (cacheType && cacheType in CACHE_TYPES) {
      clearedCount = await cacheManager.clear(cacheType as keyof typeof CACHE_TYPES);
      console.log(`🧹 [ANALYTICS] Manually cleared ${cacheType} cache: ${clearedCount} entries`);
    } else {
      clearedCount = await cacheManager.clearAll();
      console.log(`🧹 [ANALYTICS] Manually cleared all caches: ${clearedCount} entries`);
    }
    
    res.json({
      success: true,
      message: `Cleared ${clearedCount} cache entries`,
      clearedCount
    });
  } catch (error) {
    console.error("❌ [ANALYTICS] Error clearing cache:", error);
    res.status(500).json({
      success: false,
      error: "Failed to clear cache"
    });
  }
});

/**
 * POST /api/analytics/cache/warm
 * Warm cache with popular tokens and data (Admin only)
 */
router.post("/cache/warm", sessionAuth, requireAdminAccess, async (req: AuthenticatedRequest, res) => {
  try {
    console.log('🔥 [ANALYTICS] Starting cache warming process...');
    
    // Popular XRPL tokens to warm cache for
    const popularTokens = [
      { symbol: 'XRP', issuer: '' },
      { symbol: 'CSC', issuer: 'rCSCManTZ8ME9EoLrSHHYKW8PPwWMgkwr' },
      { symbol: 'USD', issuer: 'rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq' },
      { symbol: 'SOLO', issuer: 'rsoLo2S1kiGeCcn6hCUXVrCpGMWLrRrLZz' }
    ];

    let warmedCount = 0;
    
    // Warm analytics cache for popular tokens
    for (const token of popularTokens) {
      try {
        const cacheKey = `${token.symbol.toLowerCase()}-${token.issuer || 'no-issuer'}`;
        
        // This will trigger cache population if not already cached
        const cachedData = await cacheManager.get(
          CACHE_TYPES.DEXSCREENER_ANALYTICS,
          cacheKey,
          async () => {
            console.log(`🔄 [ANALYTICS] Warming cache for ${token.symbol}`);
            const pair = await getXRPLTokenBySymbol(token.symbol, token.issuer);
            
            if (pair) {
              return transformPairToAnalytics(pair, token.symbol, token.issuer);
            }
            return null;
          }
        );
        
        if (cachedData) {
          warmedCount++;
          console.log(`✅ [ANALYTICS] Warmed cache for ${token.symbol}`);
        }
        
        // Small delay between requests to avoid overwhelming external APIs
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.error(`❌ [ANALYTICS] Failed to warm cache for ${token.symbol}:`, error);
      }
    }
    
    // Warm token metadata cache (optional)
    let metadataWarmed = 0;
    try {
      const { tokenMetadataService } = await import('./token-metadata-service');
      if (tokenMetadataService && typeof tokenMetadataService.warmMetadataCache === 'function') {
        metadataWarmed = await tokenMetadataService.warmMetadataCache(popularTokens.map(t => t.symbol));
        console.log(`✅ [ANALYTICS] Warmed ${metadataWarmed} metadata entries`);
      }
    } catch (error) {
      console.log(`ℹ️ [ANALYTICS] Token metadata service not available, skipping metadata warming`);
    }
    
    // Warm trustline cache for common addresses (optional)
    let trustlineWarmed = 0;
    if (req.body.addresses && Array.isArray(req.body.addresses)) {
      try {
        const { trustlineCacheService } = await import('./trustline-cache-service');
        if (trustlineCacheService && typeof trustlineCacheService.warmTrustlineCache === 'function') {
          trustlineWarmed = await trustlineCacheService.warmTrustlineCache(req.body.addresses);
          console.log(`✅ [ANALYTICS] Warmed ${trustlineWarmed} trustline entries`);
        }
      } catch (error) {
        console.log(`ℹ️ [ANALYTICS] Trustline cache service not available, skipping trustline warming`);
      }
    }

    console.log(`✅ [ANALYTICS] Cache warming completed: ${warmedCount} analytics, ${metadataWarmed} metadata, ${trustlineWarmed} trustlines`);
    
    res.json({
      success: true,
      message: `Cache warming completed`,
      warmedCounts: {
        analytics: warmedCount,
        metadata: metadataWarmed,
        trustlines: trustlineWarmed,
        total: warmedCount + metadataWarmed + trustlineWarmed
      }
    });
  } catch (error) {
    console.error("❌ [ANALYTICS] Error warming cache:", error);
    res.status(500).json({
      success: false,
      error: "Failed to warm cache"
    });
  }
});

/**
 * GET /api/analytics/cache/health
 * Get comprehensive cache health check
 */
router.get("/cache/health", async (req, res) => {
  try {
    const health = await cacheManager.healthCheck();
    const stats = cacheManager.getStats();
    
    // Check individual cache type health
    const cacheTypeHealth = {};
    for (const cacheType of Object.keys(CACHE_TYPES)) {
      const typeStats = stats.cachesByType[cacheType];
      if (typeStats) {
        cacheTypeHealth[cacheType] = {
          healthy: typeStats.hitRate > 0.7, // 70% hit rate threshold
          hitRate: typeStats.hitRate,
          entries: typeStats.entries,
          avgTtl: typeStats.avgTtl,
          status: typeStats.hitRate > 0.8 ? 'excellent' : typeStats.hitRate > 0.6 ? 'good' : 'poor'
        };
      }
    }
    
    res.json({
      success: true,
      health,
      stats,
      cacheTypeHealth,
      recommendations: generateCacheRecommendations(stats),
      timestamp: Date.now()
    });
  } catch (error) {
    console.error("❌ [ANALYTICS] Error getting cache health:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get cache health"
    });
  }
});

// Helper function to generate cache recommendations
function generateCacheRecommendations(stats: any): string[] {
  const recommendations: string[] = [];
  
  if (stats.overallHitRate < 0.7) {
    recommendations.push("Consider warming cache or increasing TTL values for better hit rates");
  }
  
  if (stats.totalEntries > 10000) {
    recommendations.push("Cache size is large - consider implementing cleanup policies");
  }
  
  for (const [cacheType, typeStats] of Object.entries(stats.cachesByType)) {
    const cacheStats = typeStats as any;
    if (cacheStats.hitRate < 0.5) {
      recommendations.push(`${cacheType} cache has low hit rate - review TTL and access patterns`);
    }
  }
  
  if (recommendations.length === 0) {
    recommendations.push("Cache system is performing optimally");
  }
  
  return recommendations;
}

export default router;