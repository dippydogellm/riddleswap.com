import { Express, Request, Response } from 'express';
import { z } from 'zod';
import { sanitizeStrings, validateRequestSize } from './middleware/validation';
import { scannerLimiter } from './middleware/security';

/**
 * Solana Token Scanner Routes
 * DexScreener API integration for Solana chain token data
 */

// Validation schemas
const solanaSchemas = {
  trending: z.object({
    timeFrame: z.enum(['6h', '24h']).optional().default('24h')
  }),
  newPairs: z.object({
    hours: z.string().regex(/^\d+$/).optional().default('24')
  }),
  search: z.object({
    q: z.string().min(1).max(100)
  })
};

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

// Cache system
interface CacheEntry {
  data: any;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

function getCached(key: string): any | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data;
  }
  cache.delete(key);
  return null;
}

function setCache(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() });
}

export function registerSolanaScannerRoutes(app: Express) {
  console.log('📊 Registering Solana Scanner routes...');

  // GET /api/scanner/solana/trending - Trending Solana tokens
  app.get('/api/scanner/solana/trending', sanitizeStrings, validateRequestSize, scannerLimiter, validateQuery(solanaSchemas.trending), async (req: Request, res: Response) => {
    try {
      const { timeFrame = '24h' } = req.query;
      const cacheKey = `solana_trending_${timeFrame}`;

      const cached = getCached(cacheKey);
      if (cached) {
        return res.json({ success: true, pairs: cached, cached: true });
      }

      // CALL 1: Get trending token IDs
      const boostsResponse = await fetch(`https://api.dexscreener.com/token-boosts/top/v1`);
      if (!boostsResponse.ok) {
        throw new Error(`DexScreener API failed: ${boostsResponse.status}`);
      }
      const boosts = await boostsResponse.json();
      
      // Filter for Solana - no limit to get all available tokens
      const solanaBoosts = boosts.filter((token: any) => 
        token.chainId === 'solana' || token.chainId?.toLowerCase() === 'solana'
      );

      if (solanaBoosts.length === 0) {
        setCache(cacheKey, []);
        return res.json({ success: true, pairs: [], chain: 'Solana', timeFrame, cached: false });
      }

      // CALL 2: Batch fetch trading data
      const tokenAddresses = solanaBoosts.map((b: any) => b.tokenAddress).join(',');
      const pairsResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddresses}`);
      if (!pairsResponse.ok) {
        throw new Error(`DexScreener pairs API failed: ${pairsResponse.status}`);
      }
      const pairsData = await pairsResponse.json();
      
      // Extract Solana pairs - no limit to get all available tokens
      const solanaTokens = (pairsData.pairs || []).filter((p: any) => p.chainId === 'solana');

      setCache(cacheKey, solanaTokens);

      return res.json({
        success: true,
        pairs: solanaTokens,
        chain: 'Solana',
        timeFrame,
        cached: false
      });
    } catch (error) {
      console.error('❌ [Solana Scanner] Trending fetch failed:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch trending tokens'
      });
    }
  });

  // GET /api/scanner/solana/new-pairs - New Solana pairs
  app.get('/api/scanner/solana/new-pairs', sanitizeStrings, validateRequestSize, scannerLimiter, validateQuery(solanaSchemas.newPairs), async (req: Request, res: Response) => {
    try {
      const { hours = '24' } = req.query;
      const cacheKey = `solana_new_pairs_${hours}h`;

      const cached = getCached(cacheKey);
      if (cached) {
        return res.json({ success: true, pairs: cached, cached: true });
      }

      // CALL 1: Get new token IDs from profiles
      const profilesResponse = await fetch(`https://api.dexscreener.com/token-profiles/latest/v1`);
      if (!profilesResponse.ok) {
        throw new Error(`DexScreener API failed: ${profilesResponse.status}`);
      }
      const profiles = await profilesResponse.json();
      
      // Filter for Solana - no limit to get all available tokens
      const solanaProfiles = profiles.filter((token: any) => 
        token.chainId === 'solana' || token.chainId?.toLowerCase() === 'solana'
      );

      if (solanaProfiles.length === 0) {
        setCache(cacheKey, []);
        return res.json({ success: true, pairs: [], chain: 'Solana', hours, cached: false });
      }

      // CALL 2: Batch fetch trading data for new tokens
      const tokenAddresses = solanaProfiles.map((p: any) => p.tokenAddress).join(',');
      const pairsResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddresses}`);
      if (!pairsResponse.ok) {
        throw new Error(`DexScreener pairs API failed: ${pairsResponse.status}`);
      }
      const pairsData = await pairsResponse.json();
      
      // Filter by creation time and chain
      const hoursAgo = Date.now() / 1000 - (parseInt(hours as string) * 60 * 60);
      const newPairs = (pairsData.pairs || []).filter((p: any) => {
        const matchesChain = p.chainId === 'solana';
        const isNew = p.pairCreatedAt && p.pairCreatedAt >= hoursAgo;
        return matchesChain && isNew;
      });

      setCache(cacheKey, newPairs);

      return res.json({
        success: true,
        pairs: newPairs,
        chain: 'Solana',
        hours,
        cached: false
      });
    } catch (error) {
      console.error('❌ [Solana Scanner] New pairs fetch failed:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch new pairs'
      });
    }
  });

  // GET /api/scanner/solana/search - Search Solana tokens
  app.get('/api/scanner/solana/search', sanitizeStrings, validateRequestSize, scannerLimiter, validateQuery(solanaSchemas.search), async (req: Request, res: Response) => {
    try {
      const { q } = req.query;
      const cacheKey = `solana_search_${q}`;

      const cached = getCached(cacheKey);
      if (cached) {
        return res.json({ success: true, pairs: cached, cached: true });
      }

      const response = await fetch(`https://api.dexscreener.com/latest/dex/search/?q=${encodeURIComponent(q as string)}`);
      
      if (!response.ok) {
        throw new Error(`DexScreener API failed: ${response.status}`);
      }

      const data = await response.json() as any;
      
      // Filter for Solana results only
      const solanaResults = data.pairs?.filter((pair: any) => 
        pair.chainId === 'solana' || pair.chainId?.toLowerCase() === 'solana'
      ) || [];

      setCache(cacheKey, solanaResults);

      return res.json({
        success: true,
        pairs: solanaResults,
        chain: 'Solana',
        query: q,
        cached: false
      });
    } catch (error) {
      console.error('❌ [Solana Scanner] Search failed:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Search failed'
      });
    }
  });

  // GET /api/scanner/solana/top-marketcap - Top Solana tokens by market cap
  app.get('/api/scanner/solana/top-marketcap', sanitizeStrings, validateRequestSize, scannerLimiter, async (req: Request, res: Response) => {
    try {
      const cacheKey = `solana_top_marketcap`;

      const cached = getCached(cacheKey);
      if (cached) {
        return res.json({ success: true, pairs: cached, cached: true });
      }

      // CALL 1: Get token IDs from profiles
      const profilesResponse = await fetch(`https://api.dexscreener.com/token-profiles/latest/v1`);
      if (!profilesResponse.ok) {
        throw new Error(`DexScreener API failed: ${profilesResponse.status}`);
      }
      const profiles = await profilesResponse.json();
      
      // Filter for Solana - no limit to get all available tokens
      const solanaProfiles = profiles.filter((token: any) => 
        token.chainId === 'solana' || token.chainId?.toLowerCase() === 'solana'
      );

      if (solanaProfiles.length === 0) {
        setCache(cacheKey, []);
        return res.json({ success: true, pairs: [], chain: 'Solana', cached: false });
      }

      // CALL 2: Batch fetch trading data with market caps
      const tokenAddresses = solanaProfiles.map((p: any) => p.tokenAddress).join(',');
      const pairsResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddresses}`);
      if (!pairsResponse.ok) {
        throw new Error(`DexScreener pairs API failed: ${pairsResponse.status}`);
      }
      const pairsData = await pairsResponse.json();
      
      // Filter for Solana and sort by market cap - no limit to get all available tokens
      const solanaTokens = (pairsData.pairs || [])
        .filter((p: any) => p.chainId === 'solana')
        .sort((a: any, b: any) => {
          const aMarketCap = a.marketCap || a.fdv || 0;
          const bMarketCap = b.marketCap || b.fdv || 0;
          return bMarketCap - aMarketCap;
        });

      setCache(cacheKey, solanaTokens);

      return res.json({
        success: true,
        pairs: solanaTokens,
        chain: 'Solana',
        cached: false
      });
    } catch (error) {
      console.error('❌ [Solana Scanner] Top marketcap fetch failed:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch top tokens'
      });
    }
  });

  console.log('✅ Solana Scanner routes registered successfully');
}
