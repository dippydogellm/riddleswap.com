import type { Express, Request, Response } from 'express';
import { apiLimiter } from './middleware/security';
import { sanitizeStrings, validateRequestSize } from './middleware/validation';
import { z } from 'zod';

// Validation schemas for scanner endpoints
const scannerSchemas = {
  trending: z.object({
    timeFrame: z.enum(['6h', '24h']).optional().default('24h')
  }),
  newPairs: z.object({
    hours: z.string().regex(/^\d+$/).optional().default('24')
  }),
  search: z.object({
    q: z.string().min(1).max(100)
  }),
  chain: z.object({
    chainId: z.string().min(1).max(50)
  })
};

// Validation middleware helper for query params
const validateQuery = (schema: z.ZodSchema) => {
  return async (req: Request, res: Response, next: Function) => {
    try {
      req.query = await schema.parseAsync(req.query);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      return res.status(400).json({
        error: 'Invalid request data'
      });
    }
  };
};

// Validation middleware helper for path params
const validateParams = (schema: z.ZodSchema) => {
  return async (req: Request, res: Response, next: Function) => {
    try {
      req.params = await schema.parseAsync(req.params);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      return res.status(400).json({
        error: 'Invalid request data'
      });
    }
  };
};

// Simple in-memory cache for DexScreener API responses
interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

const scannerCache = new Map<string, CacheEntry>();

// Cache helper functions
const cacheGet = (key: string): any | null => {
  const entry = scannerCache.get(key);
  if (!entry) return null;
  
  const now = Date.now();
  if (now - entry.timestamp > entry.ttl) {
    scannerCache.delete(key);
    return null;
  }
  
  return entry.data;
};

const cacheSet = (key: string, data: any, ttl: number = 120000) => { // Default 2 minutes
  scannerCache.set(key, {
    data,
    timestamp: Date.now(),
    ttl
  });
};

// Rate limiter specifically for scanner endpoints - higher limits for public data
import rateLimit from 'express-rate-limit';

const scannerLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: {
    error: 'Too many scanner requests',
    retryAfter: '1 minute'
  },
  validate: {
    trustProxy: true,
    xForwardedForHeader: false
  }
});

export function registerScannerRoutes(app: Express) {
  console.log('📊 Registering Scanner API routes with middleware protection...');

  // GET /api/scanner/trending - Get trending tokens
  app.get('/api/scanner/trending', sanitizeStrings, validateRequestSize, scannerLimiter, validateQuery(scannerSchemas.trending), async (req: Request, res: Response) => {
    try {
      const { timeFrame = '24h' } = req.query;
      const cacheKey = `trending_${timeFrame}`;

      // Check cache first
      const cached = cacheGet(cacheKey);
      if (cached) {
        console.log(`✅ Cache hit for scanner trending (${timeFrame})`);
        return res.json(cached);
      }

      // Fetch from DexScreener API
      const response = await fetch('https://api.dexscreener.com/latest/dex/search?q=');
      if (!response.ok) {
        throw new Error(`DexScreener API error: ${response.status}`);
      }

      const data = await response.json() as any;
      
      // Sort by volume and filter
      const trending = data.pairs
        ?.filter((p: any) => p.volume?.h24 > 0)
        .sort((a: any, b: any) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))
        .slice(0, 50) || [];

      const result = {
        pairs: trending,
        timestamp: Date.now()
      };

      // Cache the result
      cacheSet(cacheKey, result);
      console.log(`📊 Fetched ${trending.length} trending tokens (${timeFrame})`);

      res.json(result);
    } catch (error: any) {
      console.error('❌ Error fetching trending tokens:', error.message);
      res.status(500).json({
        error: 'Failed to fetch trending tokens',
        message: error.message
      });
    }
  });

  // GET /api/scanner/new-pairs - Get newly created pairs
  app.get('/api/scanner/new-pairs', sanitizeStrings, validateRequestSize, scannerLimiter, validateQuery(scannerSchemas.newPairs), async (req: Request, res: Response) => {
    try {
      const { hours = '24' } = req.query;
      const cacheKey = `new_pairs_${hours}h`;

      // Check cache
      const cached = cacheGet(cacheKey);
      if (cached) {
        console.log(`✅ Cache hit for new pairs (${hours}h)`);
        return res.json(cached);
      }

      // Fetch from DexScreener
      const response = await fetch('https://api.dexscreener.com/latest/dex/search?q=');
      if (!response.ok) {
        throw new Error(`DexScreener API error: ${response.status}`);
      }

      const data = await response.json() as any;
      const hoursNum = parseInt(hours as string);
      const cutoffTime = Date.now() / 1000 - (hoursNum * 3600);

      // Filter for new pairs
      const newPairs = data.pairs
        ?.filter((p: any) => p.pairCreatedAt && p.pairCreatedAt > cutoffTime)
        .sort((a: any, b: any) => b.pairCreatedAt - a.pairCreatedAt)
        .slice(0, 50) || [];

      const result = {
        pairs: newPairs,
        timestamp: Date.now(),
        hours: hoursNum
      };

      cacheSet(cacheKey, result);
      console.log(`📊 Found ${newPairs.length} new pairs (${hours}h)`);

      res.json(result);
    } catch (error: any) {
      console.error('❌ Error fetching new pairs:', error.message);
      res.status(500).json({
        error: 'Failed to fetch new pairs',
        message: error.message
      });
    }
  });

  // GET /api/scanner/top-marketcap - Get tokens by market cap
  app.get('/api/scanner/top-marketcap', sanitizeStrings, validateRequestSize, scannerLimiter, async (req: Request, res: Response) => {
    try {
      const cacheKey = 'top_marketcap';

      // Check cache
      const cached = cacheGet(cacheKey);
      if (cached) {
        console.log('✅ Cache hit for top market cap');
        return res.json(cached);
      }

      // Fetch from DexScreener
      const response = await fetch('https://api.dexscreener.com/latest/dex/search?q=');
      if (!response.ok) {
        throw new Error(`DexScreener API error: ${response.status}`);
      }

      const data = await response.json() as any;

      // Filter and sort by market cap
      const topMarketCap = data.pairs
        ?.filter((p: any) => p.marketCap && p.marketCap > 0)
        .sort((a: any, b: any) => (b.marketCap || 0) - (a.marketCap || 0))
        .slice(0, 50) || [];

      const result = {
        pairs: topMarketCap,
        timestamp: Date.now()
      };

      cacheSet(cacheKey, result);
      console.log(`📊 Fetched ${topMarketCap.length} top market cap tokens`);

      res.json(result);
    } catch (error: any) {
      console.error('❌ Error fetching top market cap:', error.message);
      res.status(500).json({
        error: 'Failed to fetch top market cap tokens',
        message: error.message
      });
    }
  });

  // GET /api/scanner/search - Search tokens
  app.get('/api/scanner/search', sanitizeStrings, validateRequestSize, scannerLimiter, validateQuery(scannerSchemas.search), async (req: Request, res: Response) => {
    try {
      const { q } = req.query;

      if (!q || typeof q !== 'string') {
        return res.status(400).json({
          error: 'Missing or invalid query parameter',
          message: 'Please provide a search query'
        });
      }

      const cacheKey = `search_${q.toLowerCase()}`;

      // Check cache
      const cached = cacheGet(cacheKey);
      if (cached) {
        console.log(`✅ Cache hit for search: ${q}`);
        return res.json(cached);
      }

      // Fetch from DexScreener
      const response = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`);
      if (!response.ok) {
        throw new Error(`DexScreener API error: ${response.status}`);
      }

      const data = await response.json() as any;

      const result = {
        pairs: data.pairs || [],
        timestamp: Date.now(),
        query: q
      };

      cacheSet(cacheKey, result, 300000); // Cache search results for 5 minutes
      console.log(`📊 Search results for "${q}": ${data.pairs?.length || 0} pairs`);

      res.json(result);
    } catch (error: any) {
      console.error('❌ Error searching tokens:', error.message);
      res.status(500).json({
        error: 'Failed to search tokens',
        message: error.message
      });
    }
  });

  // GET /api/scanner/chain/:chainId - Get tokens for specific chain
  app.get('/api/scanner/chain/:chainId', sanitizeStrings, validateRequestSize, scannerLimiter, validateParams(scannerSchemas.chain), async (req: Request, res: Response) => {
    try {
      const { chainId } = req.params;
      const cacheKey = `chain_${chainId}`;

      // Check cache
      const cached = cacheGet(cacheKey);
      if (cached) {
        console.log(`✅ Cache hit for chain: ${chainId}`);
        return res.json(cached);
      }

      // Fetch from DexScreener
      const response = await fetch('https://api.dexscreener.com/latest/dex/search?q=');
      if (!response.ok) {
        throw new Error(`DexScreener API error: ${response.status}`);
      }

      const data = await response.json() as any;

      // Filter by chain
      const chainTokens = data.pairs
        ?.filter((p: any) => p.chainId === chainId)
        .sort((a: any, b: any) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))
        .slice(0, 100) || [];

      const result = {
        pairs: chainTokens,
        timestamp: Date.now(),
        chainId
      };

      cacheSet(cacheKey, result);
      console.log(`📊 Fetched ${chainTokens.length} tokens for chain ${chainId}`);

      res.json(result);
    } catch (error: any) {
      console.error(`❌ Error fetching chain ${req.params.chainId}:`, error.message);
      res.status(500).json({
        error: 'Failed to fetch chain tokens',
        message: error.message
      });
    }
  });

  // Health check endpoint
  app.get('/api/scanner/health', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      cache: {
        size: scannerCache.size,
        keys: Array.from(scannerCache.keys())
      },
      timestamp: Date.now()
    });
  });

  console.log('✅ Scanner API routes registered successfully with caching and rate limiting');
}
