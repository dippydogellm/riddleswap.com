import { Express, Request, Response } from 'express';
import { z } from 'zod';
import { sanitizeStrings, validateRequestSize } from './middleware/validation';
import { scannerLimiter } from './middleware/security';

/**
 * XRPL Token Scanner Routes
 * DexScreener API integration for XRPL chain token data
 */

// Validation schemas
const xrplSchemas = {
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

// Validation middleware
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

export function registerXRPLScannerRoutes(app: Express) {
  console.log('📊 Registering XRPL Scanner routes...');

  // GET /api/scanner/xrpl/trending - Trending XRPL tokens
  app.get('/api/scanner/xrpl/trending', sanitizeStrings, validateRequestSize, scannerLimiter, validateQuery(xrplSchemas.trending), async (req: Request, res: Response) => {
    try {
      const { timeFrame = '24h' } = req.query;
      const cacheKey = `xrpl_trending_${timeFrame}`;

      const cached = getCached(cacheKey);
      if (cached) {
        return res.json({ success: true, pairs: cached, chain: 'xrpl', cached: true });
      }

      // Use xrpl.to API for XRPL data (sorted by 24h volume)
      const response = await fetch(`https://api.xrpl.to/api/tokens?limit=500&sortBy=vol24hxrp&sortType=desc`);
      if (!response.ok) {
        throw new Error(`XRPL.to API failed: ${response.status}`);
      }
      const data = await response.json() as any;
      
      // Transform to DexScreener-like format for frontend compatibility
      const xrplTokens = (data.tokens || []).map((token: any) => {
        const tokenTimestamp = token.dateon ? Number(token.dateon) : (token.date ? new Date(token.date).getTime() : Date.now());
        
        // Construct logo URL from Bithomp CDN
        const logoUrl = `https://cdn.bithomp.com/issued-token/${token.issuer}/${token.currency}`;
        
        return {
          chainId: 'xrpl',
          dexId: 'xrpl',
          url: `https://xrpl.to/${token.slug || token.currency}`,
          pairAddress: token.currency + '.' + token.issuer,
          baseToken: {
            address: token.issuer,
            name: token.name || token.currency,
            symbol: token.name || token.currency
          },
          quoteToken: {
            symbol: 'XRP'
          },
          info: {
            imageUrl: logoUrl
          },
          priceNative: token.exch || '0',
          priceUsd: token.usd || '0',
          txns: {
            h24: { buys: token.offers || 0, sells: token.offers || 0 }
          },
          volume: {
            h24: token.vol24hxrp && token.usd && token.exch 
              ? (token.vol24hxrp * (parseFloat(token.usd) / token.exch)) 
              : 0
          },
          priceChange: {
            h24: token.p24h ? token.p24h * 100 : 0
          },
          liquidity: {
            usd: token.marketcap && token.usd && token.exch 
              ? (token.marketcap * (parseFloat(token.usd) / token.exch)) 
              : 0,
            base: token.amount || 0,
            quote: 0
          },
          fdv: token.marketcap && token.usd && token.exch 
            ? (token.marketcap * (parseFloat(token.usd) / token.exch)) 
            : 0,
          marketCap: token.marketcap && token.usd && token.exch 
            ? (token.marketcap * (parseFloat(token.usd) / token.exch)) 
            : 0,
          pairCreatedAt: tokenTimestamp / 1000
        };
      });

      setCache(cacheKey, xrplTokens);

      return res.json({
        success: true,
        pairs: xrplTokens,
        chain: 'XRPL',
        timeFrame,
        cached: false
      });
    } catch (error) {
      console.error('❌ [XRPL Scanner] Trending fetch failed:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch trending tokens'
      });
    }
  });

  // GET /api/scanner/xrpl/new-pairs - New XRPL pairs
  app.get('/api/scanner/xrpl/new-pairs', sanitizeStrings, validateRequestSize, scannerLimiter, validateQuery(xrplSchemas.newPairs), async (req: Request, res: Response) => {
    try {
      const { hours = '24' } = req.query;
      const cacheKey = `xrpl_new_pairs_${hours}h`;

      const cached = getCached(cacheKey);
      if (cached) {
        return res.json({ success: true, pairs: cached, chain: 'xrpl', cached: true });
      }

      // Use xrpl.to API (sorted by newest tokens based on dateon) - get all available tokens
      const response = await fetch(`https://api.xrpl.to/api/tokens?limit=500&sortBy=dateon&sortType=desc`);
      if (!response.ok) {
        throw new Error(`XRPL.to API failed: ${response.status}`);
      }
      const data = await response.json() as any;
      
      // Get all newest tokens (already sorted by API)
      const newTokens = (data.tokens || []);
      
      // Transform to DexScreener-like format
      const newPairs = newTokens.map((token: any) => {
        const tokenTimestamp = token.dateon ? Number(token.dateon) : (token.date ? new Date(token.date).getTime() : Date.now());
        
        // Construct logo URL from Bithomp CDN
        const logoUrl = `https://cdn.bithomp.com/issued-token/${token.issuer}/${token.currency}`;
        
        return {
          chainId: 'xrpl',
          dexId: 'xrpl',
          url: `https://xrpl.to/${token.slug || token.currency}`,
          pairAddress: token.currency + '.' + token.issuer,
          baseToken: {
            address: token.issuer,
            name: token.name || token.currency,
            symbol: token.name || token.currency
          },
          quoteToken: {
            symbol: 'XRP'
          },
          info: {
            imageUrl: logoUrl
          },
          priceNative: token.exch || '0',
          priceUsd: token.usd || '0',
          txns: {
            h24: { buys: token.offers || 0, sells: token.offers || 0 }
          },
          volume: {
            h24: token.vol24hxrp && token.usd && token.exch 
              ? (token.vol24hxrp * (parseFloat(token.usd) / token.exch)) 
              : 0
          },
          priceChange: {
            h24: token.p24h ? token.p24h * 100 : 0
          },
          liquidity: {
            usd: token.marketcap && token.usd && token.exch 
              ? (token.marketcap * (parseFloat(token.usd) / token.exch)) 
              : 0,
            base: token.amount || 0,
            quote: 0
          },
          fdv: token.marketcap && token.usd && token.exch 
            ? (token.marketcap * (parseFloat(token.usd) / token.exch)) 
            : 0,
          marketCap: token.marketcap && token.usd && token.exch 
            ? (token.marketcap * (parseFloat(token.usd) / token.exch)) 
            : 0,
          pairCreatedAt: tokenTimestamp / 1000
        };
      });

      setCache(cacheKey, newPairs);

      return res.json({
        success: true,
        pairs: newPairs,
        chain: 'XRPL',
        hours,
        cached: false
      });
    } catch (error) {
      console.error('❌ [XRPL Scanner] New pairs fetch failed:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch new pairs'
      });
    }
  });

  // GET /api/scanner/xrpl/search - Search XRPL tokens
  app.get('/api/scanner/xrpl/search', sanitizeStrings, validateRequestSize, scannerLimiter, validateQuery(xrplSchemas.search), async (req: Request, res: Response) => {
    try {
      const { q } = req.query;
      const cacheKey = `xrpl_search_${q}`;

      const cached = getCached(cacheKey);
      if (cached) {
        return res.json({ success: true, pairs: cached, chain: 'xrpl', cached: true });
      }

      const response = await fetch(`https://api.dexscreener.com/latest/dex/search/?q=${encodeURIComponent(q as string)}`);
      
      if (!response.ok) {
        throw new Error(`DexScreener API failed: ${response.status}`);
      }

      const data = await response.json() as any;
      
      // Filter for XRPL results only
      const xrplResults = data.pairs?.filter((pair: any) => 
        pair.chainId === 'xrpl' || pair.chainId?.toLowerCase() === 'xrpl'
      ) || [];

      setCache(cacheKey, xrplResults);

      return res.json({
        success: true,
        pairs: xrplResults,
        chain: 'XRPL',
        query: q,
        cached: false
      });
    } catch (error) {
      console.error('❌ [XRPL Scanner] Search failed:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Search failed'
      });
    }
  });

  // GET /api/scanner/xrpl/top-marketcap - Top XRPL tokens by market cap
  app.get('/api/scanner/xrpl/top-marketcap', sanitizeStrings, validateRequestSize, scannerLimiter, async (req: Request, res: Response) => {
    try {
      const cacheKey = `xrpl_top_marketcap`;

      const cached = getCached(cacheKey);
      if (cached) {
        return res.json({ success: true, pairs: cached, chain: 'xrpl', cached: true });
      }

      // Use xrpl.to API (sorted by market cap)
      const response = await fetch(`https://api.xrpl.to/api/tokens?limit=500&sortBy=marketcap&sortType=desc`);
      if (!response.ok) {
        throw new Error(`XRPL.to API failed: ${response.status}`);
      }
      const data = await response.json() as any;
      
      // Transform to DexScreener-like format
      const xrplTokens = (data.tokens || []).map((token: any) => {
        const tokenTimestamp = token.dateon ? Number(token.dateon) : (token.date ? new Date(token.date).getTime() : Date.now());
        
        // Construct logo URL from Bithomp CDN
        const logoUrl = `https://cdn.bithomp.com/issued-token/${token.issuer}/${token.currency}`;
        
        return {
          chainId: 'xrpl',
          dexId: 'xrpl',
          url: `https://xrpl.to/${token.slug || token.currency}`,
          pairAddress: token.currency + '.' + token.issuer,
          baseToken: {
            address: token.issuer,
            name: token.name || token.currency,
            symbol: token.name || token.currency
          },
          quoteToken: {
            symbol: 'XRP'
          },
          info: {
            imageUrl: logoUrl
          },
          priceNative: token.exch || '0',
          priceUsd: token.usd || '0',
          txns: {
            h24: { buys: token.offers || 0, sells: token.offers || 0 }
          },
          volume: {
            h24: token.vol24hxrp && token.usd && token.exch 
              ? (token.vol24hxrp * (parseFloat(token.usd) / token.exch)) 
              : 0
          },
          priceChange: {
            h24: token.p24h ? token.p24h * 100 : 0
          },
          liquidity: {
            usd: token.marketcap && token.usd && token.exch 
              ? (token.marketcap * (parseFloat(token.usd) / token.exch)) 
              : 0,
            base: token.amount || 0,
            quote: 0
          },
          fdv: token.marketcap && token.usd && token.exch 
            ? (token.marketcap * (parseFloat(token.usd) / token.exch)) 
            : 0,
          marketCap: token.marketcap && token.usd && token.exch 
            ? (token.marketcap * (parseFloat(token.usd) / token.exch)) 
            : 0,
          pairCreatedAt: tokenTimestamp / 1000
        };
      });

      setCache(cacheKey, xrplTokens);

      return res.json({
        success: true,
        pairs: xrplTokens,
        chain: 'XRPL',
        cached: false
      });
    } catch (error) {
      console.error('❌ [XRPL Scanner] Top marketcap fetch failed:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch top tokens'
      });
    }
  });

  // GET /api/scanner/xrpl/nfts/:address - Fetch NFTs by issuer address
  app.get('/api/scanner/xrpl/nfts/:address', sanitizeStrings, validateRequestSize, scannerLimiter, async (req: Request, res: Response) => {
    try {
      const { address } = req.params;
      const limit = parseInt(req.query.limit as string || '100');
      const cacheKey = `xrpl_nfts_${address}_${limit}`;

      const cached = getCached(cacheKey);
      if (cached) {
        return res.json({ success: true, nfts: cached, address, cached: true });
      }

      // Fetch NFTs from Bithomp API with authentication
      const bithompApiKey = process.env.BITHOMP_API_KEY;
      const headers: Record<string, string> = {};
      if (bithompApiKey) {
        headers['x-bithomp-token'] = bithompApiKey;
      }

      const response = await fetch(`https://bithomp.com/api/v2/nft-issuer/${address}?limit=${limit}`, {
        headers
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [XRPL NFT Scanner] Bithomp API error (${response.status}):`, errorText);
        throw new Error(`Bithomp API failed: ${response.status}`);
      }
      const data = await response.json() as any;
      
      const nfts = (data.nfts || []).map((nft: any) => ({
        NFTokenID: nft.nftokenID,
        NFTokenTaxon: nft.nftokenTaxon || 0,
        Issuer: nft.issuer,
        image: nft.image || nft.metadata?.image,
        thumbnail: nft.thumbnail || nft.metadata?.thumbnail,
        name: nft.metadata?.name || `NFT #${nft.nftokenTaxon}`,
        description: nft.metadata?.description,
        metadata: nft.metadata
      }));

      setCache(cacheKey, nfts);

      return res.json({
        success: true,
        nfts,
        address,
        total: nfts.length,
        cached: false
      });
    } catch (error) {
      console.error('❌ [XRPL NFT Scanner] Fetch failed:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch NFTs'
      });
    }
  });

  console.log('✅ XRPL Scanner routes registered successfully');
}
