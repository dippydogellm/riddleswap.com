// DexScreener API Routes - Comprehensive token price endpoints
import { Router, Request, Response } from 'express';
import { dexScreenerService, TokenPrice } from './dexscreener-price-service';

const router = Router();

/**
 * Search tokens by query (symbol, name, or address)
 * GET /api/dexscreener/search?q=ethereum&chain=ethereum&limit=20
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { q: query, chain: chainId, limit = '20' } = req.query;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid query parameter',
        message: 'Please provide a valid search query (q parameter)'
      });
    }

    console.log(`🔍 [DEXSCREENER-API] Search request: "${query}" on chain: ${chainId || 'all'}`);
    
    const results = await dexScreenerService.searchTokens(
      query, 
      chainId as string
    );

    const limitNum = parseInt(limit as string, 10);
    const limitedResults = results.slice(0, limitNum);

    res.json({
      success: true,
      query,
      chain: chainId || 'all',
      count: limitedResults.length,
      total: results.length,
      tokens: limitedResults,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('❌ [DEXSCREENER-API] Search error:', error);
    res.status(500).json({
      error: 'Search failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: Date.now()
    });
  }
});

/**
 * Get token price by address and chain
 * GET /api/dexscreener/price/:chain/:address
 */
router.get('/price/:chain/:address', async (req: Request, res: Response) => {
  try {
    const { chain, address } = req.params;
    
    if (!chain || !address) {
      return res.status(400).json({
        error: 'Missing parameters',
        message: 'Both chain and address parameters are required'
      });
    }

    console.log(`💰 [DEXSCREENER-API] Price request: ${address} on ${chain}`);
    
    const tokenPrice = await dexScreenerService.getTokenPrice(address, chain);

    if (!tokenPrice) {
      return res.status(404).json({
        error: 'Token not found',
        message: `No price data found for ${address} on ${chain}`,
        chain,
        address,
        timestamp: Date.now()
      });
    }

    res.json({
      success: true,
      token: tokenPrice,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('❌ [DEXSCREENER-API] Price error:', error);
    res.status(500).json({
      error: 'Price fetch failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: Date.now()
    });
  }
});

/**
 * Get multiple token prices in batch
 * POST /api/dexscreener/prices/batch
 * Body: { tokens: [{ address: "0x...", chain: "ethereum" }, ...] }
 */
router.post('/prices/batch', async (req: Request, res: Response) => {
  try {
    const { tokens } = req.body;
    
    if (!tokens || !Array.isArray(tokens)) {
      return res.status(400).json({
        error: 'Invalid request body',
        message: 'Please provide an array of tokens with address and chain properties'
      });
    }

    // Validate token requests
    for (const token of tokens) {
      if (!token.address || !token.chain) {
        return res.status(400).json({
          error: 'Invalid token request',
          message: 'Each token must have address and chain properties',
          example: { address: '0x...', chain: 'ethereum' }
        });
      }
    }

    if (tokens.length > 50) {
      return res.status(400).json({
        error: 'Too many tokens',
        message: 'Maximum 50 tokens per batch request'
      });
    }

    console.log(`📊 [DEXSCREENER-API] Batch price request: ${tokens.length} tokens`);
    
    const requests = tokens.map(token => ({
      address: token.address,
      chainId: token.chain
    }));

    const results = await dexScreenerService.getBatchPrices(requests);
    
    const responseTokens = results.map((result, index) => ({
      request: tokens[index],
      price: result,
      success: result !== null
    }));

    const successCount = results.filter(r => r !== null).length;

    res.json({
      success: true,
      requested: tokens.length,
      successful: successCount,
      failed: tokens.length - successCount,
      tokens: responseTokens,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('❌ [DEXSCREENER-API] Batch error:', error);
    res.status(500).json({
      error: 'Batch price fetch failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: Date.now()
    });
  }
});

/**
 * Get trending tokens by chain
 * GET /api/dexscreener/trending?chain=ethereum&limit=20
 */
router.get('/trending', async (req: Request, res: Response) => {
  try {
    const { chain, limit = '20' } = req.query;
    const limitNum = Math.min(parseInt(limit as string, 10) || 20, 50);
    
    console.log(`📈 [DEXSCREENER-API] Trending tokens request: ${chain || 'all chains'}, limit: ${limitNum}`);
    
    const trendingTokens = await dexScreenerService.getTrendingTokens(
      chain as string, 
      limitNum
    );

    res.json({
      success: true,
      chain: chain || 'all',
      count: trendingTokens.length,
      limit: limitNum,
      tokens: trendingTokens,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('❌ [DEXSCREENER-API] Trending error:', error);
    res.status(500).json({
      error: 'Failed to fetch trending tokens',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: Date.now()
    });
  }
});

/**
 * Get supported chains
 * GET /api/dexscreener/chains
 */
router.get('/chains', async (req: Request, res: Response) => {
  try {
    const supportedChains = dexScreenerService.getSupportedChains();
    
    res.json({
      success: true,
      chains: supportedChains,
      count: supportedChains.length,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('❌ [DEXSCREENER-API] Chains error:', error);
    res.status(500).json({
      error: 'Failed to get supported chains',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: Date.now()
    });
  }
});

/**
 * Get cache statistics (admin endpoint)
 * GET /api/dexscreener/cache/stats
 */
router.get('/cache/stats', async (req: Request, res: Response) => {
  try {
    const stats = dexScreenerService.getCacheStats();
    
    res.json({
      success: true,
      cache: stats,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('❌ [DEXSCREENER-API] Cache stats error:', error);
    res.status(500).json({
      error: 'Failed to get cache statistics',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: Date.now()
    });
  }
});

/**
 * Clear price cache (admin endpoint)
 * POST /api/dexscreener/cache/clear
 */
router.post('/cache/clear', async (req: Request, res: Response) => {
  try {
    dexScreenerService.clearCache();
    
    res.json({
      success: true,
      message: 'Price cache cleared successfully',
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('❌ [DEXSCREENER-API] Cache clear error:', error);
    res.status(500).json({
      error: 'Failed to clear cache',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: Date.now()
    });
  }
});

/**
 * Health check endpoint
 * GET /api/dexscreener/health
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    // Test DexScreener API connectivity
    const testResult = await dexScreenerService.searchTokens('ethereum').catch(() => null);
    const isHealthy = testResult !== null;
    
    res.status(isHealthy ? 200 : 503).json({
      success: isHealthy,
      status: isHealthy ? 'healthy' : 'unhealthy',
      message: isHealthy ? 'DexScreener API is accessible' : 'DexScreener API is not accessible',
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('❌ [DEXSCREENER-API] Health check error:', error);
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: Date.now()
    });
  }
});

export default router;