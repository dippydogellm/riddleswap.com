import { Express, Request, Response } from 'express';
import { z } from 'zod';
import { sanitizeStrings, validateRequestSize } from './middleware/validation';
import { scannerLimiter } from './middleware/security';

/**
 * EVM Chains Token Scanner Routes
 * Individual endpoints for each EVM chain with DexScreener integration
 * 
 * Supported chains: ethereum, bsc, polygon, arbitrum, base, optimism,
 * avalanche, fantom, cronos, gnosis, celo, moonbeam, zksync, linea
 */

// Validation schemas
const evmSchemas = {
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

const EVM_CHAINS = [
  { id: 'ethereum', name: 'Ethereum' },
  { id: 'bsc', name: 'BNB Smart Chain' },
  { id: 'polygon', name: 'Polygon' },
  { id: 'arbitrum', name: 'Arbitrum' },
  { id: 'base', name: 'Base' },
  { id: 'optimism', name: 'Optimism' },
  { id: 'avalanche', name: 'Avalanche' },
  { id: 'fantom', name: 'Fantom' },
  { id: 'cronos', name: 'Cronos' },
  { id: 'gnosis', name: 'Gnosis' },
  { id: 'celo', name: 'Celo' },
  { id: 'moonbeam', name: 'Moonbeam' },
  { id: 'zksync', name: 'zkSync' },
  { id: 'linea', name: 'Linea' }
];

export function registerEVMScannerRoutes(app: Express) {
  console.log('📊 Registering EVM Scanner routes for all chains...');

  // Create routes for each EVM chain
  EVM_CHAINS.forEach(chain => {
    const chainId = chain.id;
    const chainName = chain.name;

    // GET /api/scanner/:chain/trending
    app.get(`/api/scanner/${chainId}/trending`, sanitizeStrings, validateRequestSize, scannerLimiter, validateQuery(evmSchemas.trending), async (req: Request, res: Response) => {
      try {
        const { timeFrame = '24h' } = req.query;
        const cacheKey = `${chainId}_trending_${timeFrame}`;

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
        
        // Filter for this chain - no limit to get all available tokens
        const chainBoosts = boosts.filter((token: any) => 
          token.chainId === chainId || token.chainId?.toLowerCase() === chainId.toLowerCase()
        );

        if (chainBoosts.length === 0) {
          // Fallback: Search for USDC pairs on this chain (most liquid)
          const searchResponse = await fetch(`https://api.dexscreener.com/latest/dex/search?q=USDC`);
          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            const chainPairs = (searchData.pairs || [])
              .filter((p: any) => p.chainId === chainId)
              .sort((a: any, b: any) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0));
            
            if (chainPairs.length > 0) {
              setCache(cacheKey, chainPairs);
              return res.json({ success: true, pairs: chainPairs, chain: chainName, chainId, cached: false });
            }
          }
          setCache(cacheKey, []);
          return res.json({ success: true, pairs: [], chain: chainName, chainId, cached: false });
        }

        // CALL 2: Batch fetch trading data for all tokens (comma-separated)
        const tokenAddresses = chainBoosts.map((b: any) => b.tokenAddress).join(',');
        const pairsResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddresses}`);
        if (!pairsResponse.ok) {
          throw new Error(`DexScreener pairs API failed: ${pairsResponse.status}`);
        }
        const pairsData = await pairsResponse.json();
        
        // Extract pairs for this chain - no limit to get all available tokens
        const pairs = (pairsData.pairs || []).filter((p: any) => p.chainId === chainId);

        setCache(cacheKey, pairs);

        return res.json({
          success: true,
          pairs,
          chain: chainName,
          chainId,
          timeFrame,
          cached: false
        });
      } catch (error) {
        console.error(`❌ [${chainName} Scanner] Trending fetch failed:`, error);
        return res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch trending tokens'
        });
      }
    });

    // GET /api/scanner/:chain/new-pairs
    app.get(`/api/scanner/${chainId}/new-pairs`, sanitizeStrings, validateRequestSize, scannerLimiter, validateQuery(evmSchemas.newPairs), async (req: Request, res: Response) => {
      try {
        const { hours = '24' } = req.query;
        const cacheKey = `${chainId}_new_pairs_${hours}h`;

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
        
        // Filter for this chain - no limit to get all available tokens
        const chainProfiles = profiles.filter((token: any) => 
          token.chainId === chainId || token.chainId?.toLowerCase() === chainId.toLowerCase()
        );

        if (chainProfiles.length === 0) {
          // Fallback: Search for USDC pairs and filter by recent creation
          const searchResponse = await fetch(`https://api.dexscreener.com/latest/dex/search?q=USDC`);
          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            const hoursAgo = Date.now() / 1000 - (parseInt(hours as string) * 60 * 60);
            const chainPairs = (searchData.pairs || [])
              .filter((p: any) => {
                const matchesChain = p.chainId === chainId;
                const isNew = p.pairCreatedAt && p.pairCreatedAt >= hoursAgo;
                return matchesChain && isNew;
              })
              .sort((a: any, b: any) => (b.pairCreatedAt || 0) - (a.pairCreatedAt || 0));
            
            if (chainPairs.length > 0) {
              setCache(cacheKey, chainPairs);
              return res.json({ success: true, pairs: chainPairs, chain: chainName, chainId, hours, cached: false });
            }
          }
          setCache(cacheKey, []);
          return res.json({ success: true, pairs: [], chain: chainName, chainId, hours, cached: false });
        }

        // CALL 2: Batch fetch trading data for new tokens
        const tokenAddresses = chainProfiles.map((p: any) => p.tokenAddress).join(',');
        const pairsResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddresses}`);
        if (!pairsResponse.ok) {
          throw new Error(`DexScreener pairs API failed: ${pairsResponse.status}`);
        }
        const pairsData = await pairsResponse.json();
        
        // Filter by creation time and chain
        const hoursAgo = Date.now() / 1000 - (parseInt(hours as string) * 60 * 60);
        const newPairs = (pairsData.pairs || []).filter((p: any) => {
          const matchesChain = p.chainId === chainId;
          const isNew = p.pairCreatedAt && p.pairCreatedAt >= hoursAgo;
          return matchesChain && isNew;
        });

        setCache(cacheKey, newPairs);

        return res.json({
          success: true,
          pairs: newPairs,
          chain: chainName,
          chainId,
          hours,
          cached: false
        });
      } catch (error) {
        console.error(`❌ [${chainName} Scanner] New pairs fetch failed:`, error);
        return res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch new pairs'
        });
      }
    });

    // GET /api/scanner/:chain/search
    app.get(`/api/scanner/${chainId}/search`, sanitizeStrings, validateRequestSize, scannerLimiter, validateQuery(evmSchemas.search), async (req: Request, res: Response) => {
      try {
        const { q } = req.query;
        const cacheKey = `${chainId}_search_${q}`;

        const cached = getCached(cacheKey);
        if (cached) {
          return res.json({ success: true, pairs: cached, cached: true });
        }

        const response = await fetch(`https://api.dexscreener.com/latest/dex/search/?q=${encodeURIComponent(q as string)}`);
        
        if (!response.ok) {
          throw new Error(`DexScreener API failed: ${response.status}`);
        }

        const data = await response.json() as any;
        
        // Filter for this specific chain
        const chainResults = data.pairs?.filter((pair: any) => 
          pair.chainId === chainId || pair.chainId?.toLowerCase() === chainId.toLowerCase()
        ) || [];

        setCache(cacheKey, chainResults);

        return res.json({
          success: true,
          pairs: chainResults,
          chain: chainName,
          chainId,
          query: q,
          cached: false
        });
      } catch (error) {
        console.error(`❌ [${chainName} Scanner] Search failed:`, error);
        return res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Search failed'
        });
      }
    });

    // GET /api/scanner/:chain/top-marketcap
    app.get(`/api/scanner/${chainId}/top-marketcap`, sanitizeStrings, validateRequestSize, scannerLimiter, async (req: Request, res: Response) => {
      try {
        const cacheKey = `${chainId}_top_marketcap`;

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
        
        // Filter for this chain - no limit to get all available tokens
        const chainProfiles = profiles.filter((token: any) => 
          token.chainId === chainId || token.chainId?.toLowerCase() === chainId.toLowerCase()
        );

        if (chainProfiles.length === 0) {
          setCache(cacheKey, []);
          return res.json({ success: true, pairs: [], chain: chainName, chainId, cached: false });
        }

        // CALL 2: Batch fetch trading data with market caps
        const tokenAddresses = chainProfiles.map((p: any) => p.tokenAddress).join(',');
        const pairsResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddresses}`);
        if (!pairsResponse.ok) {
          throw new Error(`DexScreener pairs API failed: ${pairsResponse.status}`);
        }
        const pairsData = await pairsResponse.json();
        
        // Filter for this chain and sort by market cap - no limit to get all available tokens
        const chainTokens = (pairsData.pairs || [])
          .filter((p: any) => p.chainId === chainId)
          .sort((a: any, b: any) => {
            const aMarketCap = a.marketCap || a.fdv || 0;
            const bMarketCap = b.marketCap || b.fdv || 0;
            return bMarketCap - aMarketCap;
          });

        setCache(cacheKey, chainTokens);

        return res.json({
          success: true,
          pairs: chainTokens,
          chain: chainName,
          chainId,
          cached: false
        });
      } catch (error) {
        console.error(`❌ [${chainName} Scanner] Top marketcap fetch failed:`, error);
        return res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch top tokens'
        });
      }
    });

    console.log(`✅ ${chainName} scanner routes registered`);
  });

  console.log('✅ All EVM Scanner routes registered successfully');
}
