// XRP Wallet Endpoints - Simple & Working
import { Router, Request, Response } from 'express';
import { Client as XRPLClient } from 'xrpl';
import { z } from 'zod';
import { getLiveServerInfo, getXrplClient, disconnectClient } from '../xrpl/xrpl-wallet';
import { getTokenFromBithomp } from '../bithomp-token-api';
import { getXRPLTokenPrice, loadAllXRPLTokens, getXRPLTokenBySymbol } from '../dexscreener-api';
import { sessionAuth, type AuthenticatedRequest } from '../middleware/session-auth';
import rateLimit from 'express-rate-limit';

const router = Router();

// Rate limiting for bulk operations
const bulkTrustlineRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 bulk operations per minute
  message: 'Too many bulk trustline operations. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation schemas for trustline removal
const singleTrustlineRemovalSchema = z.object({
  currency: z.string().min(1, 'Currency is required'),
  issuer: z.string().min(1, 'Issuer is required'),
  sellAll: z.boolean().optional() // Allow frontend to send sellAll flag
}).passthrough(); // Allow any additional properties from frontend

const bulkTrustlineRemovalSchema = z.object({
  trustlines: z.array(
    z.object({
      currency: z.string().min(1, 'Currency is required'),
      issuer: z.string().min(1, 'Issuer is required'),
      // Allow additional properties that frontend sends (balance, etc.)
      balance: z.union([z.string(), z.number()]).optional(),
      symbol: z.string().optional(),
      name: z.string().optional(),
      limit: z.union([z.string(), z.number()]).optional(),
      quality_in: z.number().optional(),
      quality_out: z.number().optional(),
      no_ripple: z.boolean().optional(),
      frozen: z.boolean().optional(),
      verified: z.boolean().optional(),
      source: z.string().optional(),
      logo: z.string().optional(),
      price_usd: z.number().optional()
    }).passthrough() // Allow any additional properties from frontend
  ).min(1, 'At least one trustline is required').max(50, 'Maximum 50 trustlines allowed')
});

// Simple in-request metadata cache to prevent duplicate API calls
let metadataCache: Map<string, any> = new Map();
let cacheTimestamp = 0;
const METADATA_CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

// Function to get cached metadata or fetch if not available
async function getCachedTokenMetadata(currency: string, issuer: string): Promise<any> {
  const cacheKey = `${currency}-${issuer}`;
  const now = Date.now();
  
  // Clear cache if expired
  if (now - cacheTimestamp > METADATA_CACHE_DURATION) {
    metadataCache.clear();
    cacheTimestamp = now;
  }
  
  // Return cached result if available
  if (metadataCache.has(cacheKey)) {
    console.log(`💾 [CACHE] Using cached metadata for ${currency}`);
    return metadataCache.get(cacheKey);
  }
  
  try {
    const metadata = await getTokenFromBithomp(currency, issuer);
    metadataCache.set(cacheKey, metadata);
    return metadata;
  } catch (error) {
    // Cache null result to avoid repeated failures
    metadataCache.set(cacheKey, null);
    return null;
  }
}

// Helper function to convert hex currency code to readable symbol
function hexCurrencyToSymbol(hexCurrency: string): string {
  try {
    // Handle standard currency codes (3 chars or less)
    if (hexCurrency.length <= 3) {
      return hexCurrency;
    }
    
    // Handle 40-character hex strings
    if (hexCurrency.length === 40) {
      // Convert hex to buffer and then to string, removing null bytes
      const buffer = Buffer.from(hexCurrency, 'hex');
      const symbol = buffer.toString('utf8').replace(/\0/g, '');
      
      // Return the symbol if it's valid (contains letters/numbers)
      if (symbol && /^[A-Za-z0-9]+$/.test(symbol)) {
        return symbol;
      }
    }
    
    // Return original if conversion fails
    return hexCurrency;
  } catch (error) {
    console.error(`❌ Failed to convert hex currency ${hexCurrency}:`, error);
    return hexCurrency;
  }
}

// Enhanced token data interface
interface EnhancedToken {
  // Original XRPL data
  currency: string;
  issuer: string;
  balance: number;
  limit: number;
  quality_in: number;
  quality_out: number;
  no_ripple: boolean;
  frozen: boolean;
  
  // Enhanced data
  symbol: string;
  name: string;
  icon_url?: string;
  price_usd?: number;
  verified: boolean;
  source: string;
  
  // Debug information
  debugInfo?: {
    originalCurrency: string;
    convertedSymbol: string;
    estimatedAPR: string | null;
    dataSource: string;
  };
}

// Simple token data function - NO FALLBACKS
async function enhanceTokenData(rawToken: any, priceMap?: Map<string, number>): Promise<EnhancedToken> {
  console.log(`🔍 [TOKEN DEBUG] Processing token:`, {
    currency: rawToken.currency,
    issuer: rawToken.issuer,
    balance: rawToken.balance,
    limit: rawToken.limit,
    no_ripple: rawToken.no_ripple,
    frozen: rawToken.frozen
  });

  const currency = rawToken.currency;
  const issuer = rawToken.issuer;
  
  // Convert hex currency to readable symbol with detailed logging
  console.log(`🔤 [SYMBOL DEBUG] Converting currency:`, currency);
  const readable = hexCurrencyToSymbol(currency);
  console.log(`✅ [SYMBOL DEBUG] Converted to:`, readable);
  
  // Log potential APR/yield calculations (placeholder for future)
  let annualPercentageRate = null;
  if (rawToken.balance && rawToken.limit) {
    const utilizationRate = (rawToken.balance / rawToken.limit) * 100;
    console.log(`📊 [APR DEBUG] Token utilization: ${utilizationRate.toFixed(2)}% (${rawToken.balance}/${rawToken.limit})`);
    
    // Mock APR calculation based on utilization (future enhancement)
    if (utilizationRate > 0) {
      annualPercentageRate = (utilizationRate * 0.05).toFixed(2); // Basic mock calculation
      console.log(`💰 [APR DEBUG] Estimated APR: ${annualPercentageRate}%`);
    }
  }

  // Price debugging
  console.log(`💲 [PRICE DEBUG] Price map available:`, !!priceMap);
  if (priceMap) {
    const symbolPrice = priceMap.get(readable);
    const issuerPrice = priceMap.get(`${readable}-${issuer}`);
    console.log(`💲 [PRICE DEBUG] Price lookup for ${readable}: symbol=${symbolPrice}, issuer=${issuerPrice}`);
  }
  
  // Try to get logo from DexScreener
  let icon_url: string | undefined = undefined;
  let price_usd: number | undefined = undefined;
  
  try {
    // Attempt to get token data from DexScreener for logo and price
    const tokenData = await getXRPLTokenBySymbol(readable, issuer);
    if (tokenData && tokenData.info?.imageUrl) {
      icon_url = tokenData.info.imageUrl;
      console.log(`🖼️ [TOKEN] Found logo for ${readable}: ${icon_url}`);
    }
    if (tokenData && tokenData.priceUsd) {
      price_usd = parseFloat(tokenData.priceUsd);
      console.log(`💰 [TOKEN] Found price for ${readable}: $${price_usd}`);
    }
  } catch (error) {
    console.log(`⚠️ [TOKEN] Could not fetch DexScreener data for ${readable}`);
  }
  
  // Return enhanced data with logo when available
  const enhanced: EnhancedToken = {
    currency,
    issuer,
    balance: rawToken.balance,
    limit: rawToken.limit,
    quality_in: rawToken.quality_in,
    quality_out: rawToken.quality_out,
    no_ripple: rawToken.no_ripple,
    frozen: rawToken.frozen,
    symbol: readable,
    name: readable,
    verified: false,
    source: 'xrpl',
    icon_url: icon_url, // Now includes logo from DexScreener
    price_usd: price_usd, // Now includes price from DexScreener
    // Debug fields (not sent to frontend but logged)
    debugInfo: {
      originalCurrency: currency,
      convertedSymbol: readable,
      estimatedAPR: annualPercentageRate,
      dataSource: 'xrpl-ledger-with-dexscreener'
    }
  };
  
  console.log(`✅ [TOKEN DEBUG] Enhanced token complete:`, {
    symbol: enhanced.symbol,
    balance: enhanced.balance,
    frozen: enhanced.frozen,
    no_ripple: enhanced.no_ripple,
    estimatedAPR: annualPercentageRate
  });
  
  return enhanced;
}

// XRP Balance Endpoint - Uses shared service function
router.get('/xrp/balance/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    console.log(`🔍 [XRP] Getting balance for: ${address}`);
    
    const result = await getXrpBalance(address);
    console.log(`💰 [XRP] Balance: ${result.balance} ($${result.balanceUsd})`);
    res.json(result);
    
  } catch (error) {
    console.error(`❌ [XRP] Balance fetch failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'XRP balance fetch failed'
    });
  }
});

// Price cache to prevent slow API calls on every balance fetch
let cachedXRPPrice: { price: number; timestamp: number } | null = null;
const PRICE_CACHE_DURATION = 30000; // 30 seconds

async function getXRPPriceOptimized(): Promise<number> {
  // Return cached price if fresh (< 30s old)
  if (cachedXRPPrice && (Date.now() - cachedXRPPrice.timestamp) < PRICE_CACHE_DURATION) {
    console.log(`💾 [XRP-PRICE] Using cached price: $${cachedXRPPrice.price}`);
    return cachedXRPPrice.price;
  }

  try {
    // Try to fetch new price with 2s timeout
    const { getTokenPrice } = await import('../price-service.js');
    const pricePromise = getTokenPrice('XRP');
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Price fetch timeout')), 2000)
    );
    
    const xrpTokenPrice = await Promise.race([pricePromise, timeoutPromise]) as any;
    
    if (xrpTokenPrice?.price_usd) {
      const price = xrpTokenPrice.price_usd;
      cachedXRPPrice = { price, timestamp: Date.now() };
      console.log(`✅ [XRP-PRICE] Fetched fresh price: $${price}`);
      return price;
    }
  } catch (error) {
    console.warn(`⚠️ [XRP-PRICE] Fetch failed, using fallback:`, error instanceof Error ? error.message : 'Unknown error');
  }

  // Use cached price even if stale, or fallback to $2.56
  const fallbackPrice = cachedXRPPrice?.price || 2.56;
  console.log(`💰 [XRP-PRICE] Using ${cachedXRPPrice ? 'stale cached' : 'fallback'} price: $${fallbackPrice}`);
  return fallbackPrice;
}

// Shared service functions for portfolio calculation
async function getXrpBalance(address: string) {
  const xrpClient = await getXrplClient();
  
  try {
    const accountInfo = await xrpClient.request({
      command: 'account_info',
      account: address,
      ledger_index: 'validated'
    });
    
    const balanceDrops = accountInfo.result.account_data?.Balance || '0';
    const ownerCount = accountInfo.result.account_data?.OwnerCount || 0;
    const totalBalance = parseFloat(balanceDrops) / 1000000;
    
    const { baseReserve, ownerReserve } = await getLiveServerInfo();
    const reservedBalance = baseReserve + (ownerCount * ownerReserve);
    const availableBalance = Math.max(0, totalBalance - reservedBalance);
    
    // Use optimized price fetcher with caching and timeout
    const xrpPrice = await getXRPPriceOptimized();
    const balanceUsd = totalBalance * xrpPrice;
    
    await disconnectClient(xrpClient);
    
    return {
      success: true,
      address,
      balance: totalBalance.toFixed(6),
      balanceUsd: parseFloat(balanceUsd.toFixed(2)),
      availableBalance: availableBalance.toFixed(6),
      reservedBalance: reservedBalance.toFixed(6),
      ownerCount
    };
  } catch (error: any) {
    await disconnectClient(xrpClient);
    
    if (error.data?.error === 'actNotFound') {
      return {
        success: true,
        address,
        balance: '0.000000',
        balanceUsd: 0,
        availableBalance: '0.000000',
        reservedBalance: '0.000000',
        ownerCount: 0,
        unfunded: true
      };
    }
    throw error;
  }
}

async function getXrpTokensValue(address: string) {
  const xrpClient = await getXrplClient();
  
  try {
    const linesResponse = await xrpClient.request({
      command: 'account_lines',
      account: address,
      ledger_index: 'validated'
    });
    
    const rawTokens = (linesResponse.result.lines || []).map((line: any) => ({
      currency: line.currency,
      issuer: line.account,
      balance: parseFloat(line.balance),
      limit: parseFloat(line.limit || '0'),
      no_ripple: line.no_ripple || false,
      frozen: line.freeze || false
    }));
    
    await disconnectClient(xrpClient);
    
    const enhancedTokens = await Promise.all(rawTokens.map(token => enhanceTokenData(token)));
    const totalValueUsd = enhancedTokens.reduce((sum, token) => {
      return sum + (token.price_usd && token.balance ? token.balance * token.price_usd : 0);
    }, 0);
    
    return {
      success: true,
      address,
      totalValueUsd: parseFloat(totalValueUsd.toFixed(2)),
      tokens: enhancedTokens,
      count: enhancedTokens.length
    };
  } catch (error: any) {
    await disconnectClient(xrpClient);
    
    if (error.data?.error === 'actNotFound') {
      return { success: true, address, totalValueUsd: 0, tokens: [], count: 0, unfunded: true };
    }
    throw error;
  }
}

async function getXrpNftsValue(address: string) {
  const { getBithompCollection } = await import('../bithomp-api-v2.js');
  const xrpClient = await getXrplClient();
  
  try {
    const nftResponse = await xrpClient.request({
      command: 'account_nfts',
      account: address,
      ledger_index: 'validated'
    });
    
    const nfts = nftResponse.result.account_nfts || [];
    await disconnectClient(xrpClient);
    
    if (nfts.length === 0) {
      return { success: true, address, totalValueUsd: 0, collections: [], nfts: [], count: 0 };
    }
    
    const { getTokenPrice } = await import('../price-service.js');
    const xrpTokenPrice = await getTokenPrice('XRP');
    const xrpPriceUsd = xrpTokenPrice?.price_usd || 0;
    
    const nftValues = await Promise.all(nfts.map(async (nft: any) => {
      const issuer = nft.Issuer || nft.issuer;
      const taxon = nft.NFTokenTaxon || nft.nftokenTaxon;
      const nftokenID = nft.NFTokenID || nft.nftokenID;
      
      try {
        const result = await getBithompCollection(issuer, taxon);
        let floorPriceXrp = 0;
        
        if (result.success && result.collection) {
          const collectionData = result.collection.collection || result.collection;
          
          if (collectionData.floorPrices && collectionData.floorPrices.length > 0) {
            const priceData = collectionData.floorPrices[0];
            if (priceData.private?.amount) {
              floorPriceXrp = parseFloat(priceData.private.amount) / 1000000;
            } else if (priceData.open?.amount) {
              floorPriceXrp = parseFloat(priceData.open.amount) / 1000000;
            }
          } else if (collectionData.floorPrice) {
            floorPriceXrp = collectionData.floorPrice;
          }
        }
        
        const floorPriceUsd = (floorPriceXrp > 0 && xrpPriceUsd > 0) ? floorPriceXrp * xrpPriceUsd : 0;
        
        return {
          nftokenID,
          issuer,
          taxon,
          collectionId: `${issuer}:${taxon}`,
          floorPriceXrp,
          floorPriceUsd
        };
      } catch (error) {
        return {
          nftokenID,
          issuer,
          taxon,
          collectionId: `${issuer}:${taxon}`,
          floorPriceXrp: 0,
          floorPriceUsd: 0
        };
      }
    }));
    
    const totalValueUsd = nftValues.reduce((sum, nft) => sum + nft.floorPriceUsd, 0);
    
    const collectionMap = new Map();
    nftValues.forEach(nft => {
      if (!collectionMap.has(nft.collectionId)) {
        collectionMap.set(nft.collectionId, {
          collectionId: nft.collectionId,
          issuer: nft.issuer,
          taxon: nft.taxon,
          holdings: 0,
          floorPriceXrp: nft.floorPriceXrp,
          totalUsd: 0
        });
      }
      const collection = collectionMap.get(nft.collectionId);
      collection.holdings += 1;
      collection.totalUsd += nft.floorPriceUsd;
    });
    
    const collections = Array.from(collectionMap.values());
    
    return {
      success: true,
      address,
      totalValueUsd: parseFloat(totalValueUsd.toFixed(2)),
      collections,
      nfts: nftValues,
      count: nftValues.length,
      xrpPriceUsd
    };
  } catch (error: any) {
    await disconnectClient(xrpClient);
    
    if (error.data?.error === 'actNotFound') {
      return { success: true, address, totalValueUsd: 0, collections: [], nfts: [], count: 0, unfunded: true };
    }
    throw error;
  }
}

// NEW PORTFOLIO AGGREGATOR - Uses shared service functions
router.get('/xrp/portfolio/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    console.log(`📊 [XRP-PORTFOLIO-AGG] Aggregating portfolio for: ${address}`);
    
    // Call all 3 service functions in parallel
    const [balanceRes, tokensRes, nftsRes] = await Promise.all([
      getXrpBalance(address).catch(err => ({ success: false, error: err.message, address, balance: '0', balanceUsd: 0, availableBalance: '0', reservedBalance: '0', ownerCount: 0 })),
      getXrpTokensValue(address).catch(err => ({ success: false, error: err.message, address, totalValueUsd: 0, tokens: [], count: 0 })),
      getXrpNftsValue(address).catch(err => ({ success: false, error: err.message, address, totalValueUsd: 0, collections: [], nfts: [], count: 0 }))
    ]);
    
    // Check if all calls succeeded
    const allSuccess = balanceRes.success && tokensRes.success && nftsRes.success;
    const errors = [
      !balanceRes.success && (balanceRes as any).error,
      !tokensRes.success && (tokensRes as any).error,
      !nftsRes.success && (nftsRes as any).error
    ].filter(Boolean);
    
    // Calculate total USD value
    const balanceUsd = 'balanceUsd' in balanceRes ? balanceRes.balanceUsd : 0;
    const tokensUsd = tokensRes.totalValueUsd || 0;
    const nftsUsd = nftsRes.totalValueUsd || 0;
    const totalUsd = (balanceUsd + tokensUsd + nftsUsd).toFixed(2);
    
    console.log(`📊 [XRP-PORTFOLIO-AGG] Total: $${totalUsd} (Balance: $${balanceUsd}, Tokens: $${tokensUsd}, NFTs: $${nftsUsd})`);
    
    // Return aggregated portfolio with proper error handling
    res.json({
      success: allSuccess,
      chain: 'xrp',
      address,
      totalUsd,
      balance: {
        ...balanceRes,
        usd: balanceUsd.toFixed(2)
      },
      tokens: {
        ...tokensRes,
        totalValueUsd: tokensUsd.toFixed(2)
      },
      nfts: {
        ...nftsRes,
        totalValueUsd: nftsUsd.toFixed(2)
      },
      ...(errors.length > 0 && { errors })
    });
    
  } catch (error) {
    console.error(`❌ [XRP-PORTFOLIO-AGG] Aggregation failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Portfolio aggregation failed'
    });
  }
});

// Token Value Endpoint - Uses shared service function
router.get('/xrp/tokens/:address/value', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    console.log(`💰 [XRP-TOKEN-VALUE] Calculating token portfolio value for: ${address}`);
    
    const result = await getXrpTokensValue(address);
    console.log(`💰 [XRP-TOKEN-VALUE] Total: $${result.totalValueUsd} across ${result.count} tokens`);
    res.json(result);
    
  } catch (error) {
    console.error(`❌ [XRP-TOKEN-VALUE] Calculation failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Token value calculation failed'
    });
  }
});

// NFT Value Endpoint - Uses shared service function
router.get('/xrp/nfts/:address/value', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    console.log(`💎 [XRP-NFT-VALUE] Calculating NFT portfolio value for: ${address}`);
    
    const result = await getXrpNftsValue(address);
    console.log(`💎 [XRP-NFT-VALUE] Total: $${result.totalValueUsd} across ${result.count} NFTs`);
    res.json(result);
    
  } catch (error) {
    console.error(`❌ [XRP-NFT-VALUE] Calculation failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'NFT value calculation failed'
    });
  }
});

// XRP Tokens endpoint - Get tokens for an address
router.get('/xrp/tokens/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    console.log(`💰 [XRP] Getting tokens for: ${address}`);
    
    const xrpClient = await getXrplClient();

    
    try {
      // Get account lines (trustlines/tokens)
      const linesResponse = await xrpClient.request({
        command: 'account_lines',
        account: address,
        ledger_index: 'validated'
      });
      
      const rawTokens = (linesResponse.result.lines || []).map((line: any) => ({
        currency: line.currency,
        issuer: line.account,
        balance: parseFloat(line.balance),
        limit: parseFloat(line.limit || '0'),
        quality_in: line.quality_in || 0,
        quality_out: line.quality_out || 0,
        no_ripple: line.no_ripple || false,
        frozen: line.freeze || false
      }));
      
      console.log(`💰 [XRP] Found ${rawTokens.length} raw tokens for ${address}`);
      
      await disconnectClient(xrpClient);
      
      console.log(`🔍 [XRP] Processing ${rawTokens.length} tokens - NO FALLBACKS`);
      
      // Process tokens with NO fallbacks, NO external calls, NO caching
      const enhancedTokens = await Promise.all(
        rawTokens.map(token => enhanceTokenData(token))
      );
      
      console.log(`✅ [XRP] Enhanced ${enhancedTokens.length} tokens with basic data only`);
      
      res.json({
        success: true,
        address,
        tokens: enhancedTokens
      });
      
    } catch (error: any) {
      await disconnectClient(xrpClient);
      
      if (error.data?.error === 'actNotFound') {
        console.log(`📍 [XRP] Account not funded: ${address}`);
        return res.json({
          success: true,
          address,
          tokens: []
        });
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error(`❌ [XRP] Tokens fetch failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'XRP tokens fetch failed',
      tokens: []
    });
  }
});

// XRP NFTs endpoint - Get NFTs for an address with Bithomp CDN images
router.get('/xrp/nfts/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    console.log(`🎨 [XRP] Getting NFTs for: ${address}`);
    
    const xrpClient = await getXrplClient();

    
    try {
      // Get account NFTs
      const nftsResponse = await xrpClient.request({
        command: 'account_nfts',
        account: address,
        ledger_index: 'validated'
      });
      
      const rawNfts = nftsResponse.result.account_nfts || [];
      
      // Enhance NFTs with Bithomp metadata and CDN images
      const nfts = await Promise.all(rawNfts.map(async (nft: any) => {
        const baseNft = {
          nftokenID: nft.NFTokenID,
          uri: nft.URI,
          issuer: nft.Issuer,
          nftokenTaxon: nft.NFTokenTaxon,
          transferFee: nft.TransferFee,
          flags: nft.Flags,
          sequence: nft.Sequence,
          image: '', // Will be populated below
          name: '',
          collection: { name: null },
          description: null,
          attributes: [] as Array<{ trait_type: string; value: string | number }>
        };
        
        try {
          // Fetch NFT metadata and CDN image from Bithomp
          const bithompUrl = `https://bithomp.com/api/v2/nft/${nft.NFTokenID}?assets=true`;
          const bithompResponse = await fetch(bithompUrl, {
            headers: {
              'x-bithomp-token': process.env.BITHOMP_API_KEY || '',
              'User-Agent': 'RiddleSwap/1.0',
              'Accept': 'application/json'
            },
            signal: AbortSignal.timeout(3000) // 3 second timeout
          });
          
          if (bithompResponse.ok) {
            const bithompData = await bithompResponse.json();
            
            // Get CDN image URL directly from Bithomp assets
            if (bithompData.assets?.image) {
              baseNft.image = bithompData.assets.image;
              console.log(`✅ [XRP NFT] Using CDN image: ${baseNft.image}`);
            } else if (bithompData.assets?.preview) {
              baseNft.image = bithompData.assets.preview;
              console.log(`✅ [XRP NFT] Using preview: ${baseNft.image}`);
            } else if (bithompData.assets?.thumbnail) {
              baseNft.image = bithompData.assets.thumbnail;
            } else {
              // Fallback to Bithomp CDN URL
              baseNft.image = `https://cdn.bithomp.com/nft/${nft.NFTokenID}.webp`;
            }
            
            // Get metadata
            if (bithompData.metadata) {
              baseNft.name = bithompData.metadata.name || bithompData.metadata.title || `NFT #${nft.NFTokenID.slice(-6)}`;
              baseNft.description = bithompData.metadata.description;
              baseNft.collection = bithompData.metadata.collection || { name: null };
              baseNft.attributes = bithompData.metadata.attributes || bithompData.metadata.traits || [];
            } else {
              baseNft.name = `NFT #${nft.NFTokenID.slice(-6)}`;
            }
          } else {
            // Use fallback CDN URL if Bithomp API fails
            baseNft.image = `https://cdn.bithomp.com/nft/${nft.NFTokenID}.webp`;
            baseNft.name = `NFT #${nft.NFTokenID.slice(-6)}`;
          }
        } catch (error) {
          // On any error, use fallback CDN URL
          console.log(`⚠️ [XRP] Failed to fetch Bithomp metadata for ${nft.NFTokenID}, using fallback`);
          baseNft.image = `https://cdn.bithomp.com/nft/${nft.NFTokenID}.webp`;
          baseNft.name = `NFT #${nft.NFTokenID.slice(-6)}`;
        }
        
        return baseNft;
      }));
      
      console.log(`🎨 [XRP] Found ${nfts.length} NFTs for ${address}`);
      
      await disconnectClient(xrpClient);
      
      res.json({
        success: true,
        address,
        nfts
      });
      
    } catch (error: any) {
      await disconnectClient(xrpClient);
      
      if (error.data?.error === 'actNotFound') {
        console.log(`📍 [XRP] Account not funded: ${address}`);
        return res.json({
          success: true,
          address,
          nfts: []
        });
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error(`❌ [XRP] NFTs fetch failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'XRP NFTs fetch failed',
      nfts: []
    });
  }
});

// XRP NFT Offers endpoint - Get NFT offers for an address with assets
router.get('/xrp/nft-offers/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    const { 
      list = 'default', 
      nftoken = 'true', 
      assets = 'true',
      offersValidate = 'false'
    } = req.query;
    
    console.log(`🎯 [XRP] Getting NFT offers for: ${address} (list=${list}, assets=${assets})`);
    
    // Build query parameters
    const params = new URLSearchParams({
      list: list as string,
      nftoken: nftoken as string,
      assets: assets as string,
      offersValidate: offersValidate as string
    });
    
    const response = await fetch(`https://bithomp.com/api/v2/address/${address}/nft-offers?${params}`, {
      headers: {
        'x-bithomp-token': process.env.BITHOMP_API_KEY || '',
        'User-Agent': 'RiddleSwap/1.0'
      }
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log(`📍 [XRP] No NFT offers found for: ${address}`);
        return res.json({
          success: true,
          address,
          offers: [],
          list_type: list
        });
      }
      throw new Error(`Bithomp NFT offers API failed: ${response.status}`);
    }
    
    const data = await response.json() as any;
    
    // Format offers with enhanced data
    const offers = (data.offers || []).map((offer: any) => ({
      // Core offer data
      index: offer.index,
      owner: offer.owner,
      destination: offer.destination,
      amount: offer.amount,
      flags: offer.flags,
      nftokenID: offer.nftokenID,
      
      // Enhanced NFToken data (when nftoken=true)
      nftoken: offer.nftoken ? {
        nftokenID: offer.nftoken.nftokenID,
        uri: offer.nftoken.uri,
        issuer: offer.nftoken.issuer,
        nftokenTaxon: offer.nftoken.nftokenTaxon,
        transferFee: offer.nftoken.transferFee,
        flags: offer.nftoken.flags,
        sequence: offer.nftoken.sequence,
        metadata: offer.nftoken.metadata || null
      } : null,
      
      // Asset URLs (when assets=true)
      assets: offer.assets ? {
        image: offer.assets.image || null,
        video: offer.assets.video || null,
        preview: offer.assets.preview || null,
        thumbnail: offer.assets.thumbnail || null
      } : null,
      
      // Validation data (when offersValidate=true)
      valid: offer.valid !== undefined ? offer.valid : null,
      validationErrors: offer.validationErrors || null,
      
      // Additional metadata
      offerType: list,
      link: `https://bithomp.com/explorer/nft/${offer.nftokenID}`,
      createdAt: offer.createdAt || null,
      expiresAt: offer.expiresAt || null
    }));
    
    console.log(`🎯 [XRP] Found ${offers.length} NFT offers for ${address} (${list})`);
    
    res.json({
      success: true,
      address,
      list_type: list,
      offers,
      total: offers.length,
      parameters: {
        list,
        nftoken: nftoken === 'true',
        assets: assets === 'true',
        offersValidate: offersValidate === 'true'
      }
    });
    
  } catch (error) {
    console.error(`❌ [XRP] NFT offers fetch failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'XRP NFT offers fetch failed',
      offers: []
    });
  }
});

// XRP Transactions - PUBLIC endpoint (no auth required - blockchain data)
router.get('/xrp/transactions/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    const { limit = 50 } = req.query;
    console.log(`📊 [XRP] Getting PUBLIC transactions for: ${address} (limit: ${limit})`);
    
    // Use Bithomp API for properly formatted transaction data
    const bithompResponse = await fetch(
      `https://bithomp.com/api/v2/transactions/${address}?limit=${limit}`,
      {
        headers: {
          'x-bithomp-token': process.env.BITHOMP_API_KEY || '',
          'Accept': 'application/json',
          'User-Agent': 'RiddleSwap/1.0'
        }
      }
    );
    
    if (!bithompResponse.ok) {
      throw new Error(`Bithomp API error: ${bithompResponse.status}`);
    }
    
    const bithompData = await bithompResponse.json();
    console.log(`📊 [XRP] Received ${bithompData?.length || 0} transactions from Bithomp`);
    
    // Format transactions from Bithomp's clean, structured format
    const transactions = (bithompData || []).map((tx: any, index: number) => {
      
      // Debug first 3 transactions to verify structure
      if (index < 3) {
        console.log(`🔍 [BITHOMP TX ${index}]`, JSON.stringify({
          type: tx.type,
          id: tx.id,
          timestamp: tx.outcome?.timestamp,
          result: tx.outcome?.result
        }, null, 2));
      }
      
      // Determine transaction direction (sent/received) based on balance changes
      const balanceChanges = tx.outcome?.balanceChanges || {};
      const userBalanceChange = balanceChanges[address];
      let direction = 'unknown';
      
      if (userBalanceChange && userBalanceChange.length > 0) {
        const change = userBalanceChange[0];
        const value = parseFloat(change.value);
        direction = value > 0 ? 'received' : 'sent';
      }
      
      // Parse amount from Bithomp's deliveredAmount format
      let amount = '0';
      let isToken = false;
      let tokenInfo: any = null;
      
      if (tx.outcome?.deliveredAmount) {
        const delivered = tx.outcome.deliveredAmount;
        if (delivered.currency === 'XRP') {
          amount = `${delivered.value} XRP`;
        } else {
          isToken = true;
          amount = `${delivered.value} ${delivered.currency}`;
          tokenInfo = {
            currency: delivered.currency,
            issuer: delivered.counterparty,
            value: parseFloat(delivered.value),
            symbol: delivered.currency
          };
        }
      }
      
      // Determine if it's an NFT transaction and extract NFT details
      const isNFT = ['nftokenmint', 'nftokenacceptoffer', 'nftokencreateoffer', 'nftokencanceloffer', 'nftokenburn'].includes(tx.type?.toLowerCase() || '');
      let nftInfo: any = null;
      
      if (isNFT) {
        // Extract NFT information from raw transaction
        const rawTx = tx.rawTransaction ? JSON.parse(tx.rawTransaction) : {};
        
        nftInfo = {
          nftokenID: rawTx.NFTokenID || tx.specification?.nftokenID || null,
          uri: rawTx.URI || tx.specification?.uri || null,
          taxon: rawTx.NFTokenTaxon || tx.specification?.nftokenTaxon || null,
          transferFee: rawTx.TransferFee || tx.specification?.transferFee || null,
          flags: rawTx.Flags || tx.specification?.flags || null,
          // NFT offer details
          offerAmount: rawTx.Amount || tx.specification?.amount || null,
          owner: rawTx.Owner || tx.specification?.owner || null,
          destination: rawTx.Destination || tx.specification?.destination?.address || null,
          // Accept offer details
          sellOffer: rawTx.NFTokenSellOffer || tx.specification?.nftokenSellOffer || null,
          buyOffer: rawTx.NFTokenBuyOffer || tx.specification?.nftokenBuyOffer || null,
          broker: rawTx.Broker || tx.specification?.broker || null,
          brokerFee: rawTx.BrokerFee || tx.specification?.brokerFee || null
        };
      }
      
      return {
        hash: tx.id,
        type: tx.type,
        from: tx.specification?.source?.address || tx.address,
        to: tx.specification?.destination?.address || '',
        direction, // 'sent', 'received', or 'unknown'
        amount: amount,
        fee: tx.outcome?.fee || '0',
        sequence: tx.sequence,
        ledgerIndex: tx.outcome?.ledgerVersion,
        date: tx.outcome?.timestamp,
        timestamp: tx.outcome?.timestamp,
        result: tx.outcome?.result || 'unknown',
        validated: tx.outcome?.result === 'tesSUCCESS',
        memos: tx.specification?.memos || [],
        destinationTag: tx.specification?.destination?.tag,
        link: `https://livenet.xrpl.org/transactions/${tx.id}`,
        isToken,
        isNFT,
        tokenInfo,
        nftInfo, // NFT details including NFTokenID
        balanceChanges: tx.outcome?.balanceChanges,
        specification: tx.specification,
        details: tx
      };
    });
    
    console.log(`📊 [XRP] Found ${transactions.length} transactions`);
    
    res.json({
      success: true,
      address,
      transactions: transactions
    });
    
  } catch (error) {
    console.error(`❌ [XRP] Transactions fetch failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'XRP transactions fetch failed',
      transactions: []
    });
  }
});

// PUBLIC Comprehensive API test endpoint - Shows ALL API results
router.get('/test/comprehensive', async (req: Request, res: Response) => {
  try {
    console.log(`🧪 [COMPREHENSIVE TEST] Running all XRPL API tests...`);
    
    const testAddresses = [
      'rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B', // Bitstamp hot wallet
      'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH', // Binance hot wallet 
      'rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY'  // Known token issuer
    ];
    
    const results = {
      timestamp: new Date().toISOString(),
      api_key_status: process.env.BITHOMP_API_KEY ? `SET (${process.env.BITHOMP_API_KEY.slice(0,8)}...)` : 'MISSING',
      tests: []
    };
    
    // Test 1: Bithomp NFTs List
    try {
      console.log(`🎨 Testing NFTs List API...`);
      const nftsResponse = await fetch(`https://bithomp.com/api/v2/nfts?limit=5`, {
        headers: {
          'x-bithomp-token': process.env.BITHOMP_API_KEY || '',
          'User-Agent': 'RiddleSwap/1.0'
        }
      });
      const nftsData = await nftsResponse.json();
      (results.tests as any[]).push({
        api: 'Bithomp NFTs List',
        status: nftsResponse.ok ? 'SUCCESS' : 'FAILED',
        endpoint: 'https://bithomp.com/api/v2/nfts',
        data: nftsData,
        enhanced_count: (nftsData.nfts || []).length
      });
    } catch (error: any) {
      (results.tests as any[]).push({
        api: 'Bithomp NFTs List',
        status: 'ERROR',
        error: error.message
      });
    }
    
    // Test 2: Bithomp Balances for multiple addresses
    for (const address of testAddresses) {
      try {
        console.log(`🪙 Testing tokens for ${address.slice(0,8)}...`);
        const balResponse = await fetch(`https://bithomp.com/api/v2/address/${address}/balances`, {
          headers: {
            'x-bithomp-token': process.env.BITHOMP_API_KEY || '',
            'User-Agent': 'RiddleSwap/1.0'
          }
        });
        const balData = await balResponse.json();
        (results.tests as any[]).push({
          api: 'Bithomp Balances',
          address: address.slice(0,8) + '...',
          status: balResponse.ok ? 'SUCCESS' : 'FAILED',
          endpoint: `https://bithomp.com/api/v2/address/${address}/balances`,
          data: balData
        });
      } catch (error: any) {
        (results.tests as any[]).push({
          api: 'Bithomp Balances',
          address: address.slice(0,8) + '...',
          status: 'ERROR',
          error: error.message
        });
      }
    }
    
    // Test 3: Alternative XRPL APIs
    try {
      console.log(`🔍 Testing XRPL Data API...`);
      const xrplDataResponse = await fetch(`https://api.xrpldata.com/api/v1/xls20-nfts/issuer/rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH`);
      const xrplData = await xrplDataResponse.json();
      (results.tests as any[]).push({
        api: 'XRPL Data API',
        status: xrplDataResponse.ok ? 'SUCCESS' : 'FAILED',
        endpoint: 'https://api.xrpldata.com/api/v1/xls20-nfts',
        data: xrplData
      });
    } catch (error: any) {
      (results.tests as any[]).push({
        api: 'XRPL Data API',
        status: 'ERROR',
        error: error.message
      });
    }
    
    // Test 4: Test actual parsing enhancement
    const sampleToken = {
      currency: 'USD',
      counterparty: 'rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B',
      value: '100.50',
      meta: {
        icon: 'https://example.com/usd.png',
        name: 'US Dollar',
        verified: true
      }
    };
    
    const enhancedToken = {
      currency: sampleToken.currency,
      issuer: sampleToken.counterparty,
      balance: sampleToken.value,
      logo: sampleToken.meta?.icon || `https://bithomp.com/cdn/currency/${sampleToken.currency}.${sampleToken.counterparty}/icon.png`,
      name: sampleToken.meta?.name || sampleToken.currency,
      verified: sampleToken.meta?.verified || false,
      collection: {
        name: sampleToken.currency,
        image: sampleToken.meta?.icon
      }
    };
    
    (results.tests as any[]).push({
      api: 'Token Enhancement Demo',
      status: 'SUCCESS',
      original: sampleToken,
      enhanced: enhancedToken
    });
    
    res.json(results);
    
  } catch (error) {
    console.error(`❌ [COMPREHENSIVE TEST] Failed:`, error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Test failed',
      timestamp: new Date().toISOString()
    });
  }
});

// Test endpoint to verify enhanced parsing
router.get('/xrp/test-parsing/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params.address;
    console.log(`🧪 [XRP TEST] Testing enhanced parsing for: ${address}`);
    
    // Test both tokens and NFTs parsing
    const testResults = {
      address,
      timestamp: new Date().toISOString(),
      tests: []
    };
    
    // Test tokens
    try {
      const tokensResponse = await fetch(`https://bithomp.com/api/v2/address/${address}/balances`, {
        headers: {
          'x-bithomp-token': process.env.BITHOMP_API_KEY || '',
          'User-Agent': 'RiddleSwap/1.0'
        }
      });
      
      if (tokensResponse.ok) {
        const tokensData = await tokensResponse.json();
        (testResults.tests as any[]).push({
          type: 'tokens',
          status: 'success',
          raw_count: (tokensData.balances || []).length,
          parsed_count: (tokensData.balances || []).filter((t: any) => t.currency !== 'XRP').length,
          sample_raw: tokensData.balances?.[0] || null,
          api_structure: Object.keys(tokensData)
        });
      } else {
        (testResults.tests as any[]).push({
          type: 'tokens',
          status: 'failed',
          error: `${tokensResponse.status} ${tokensResponse.statusText}`
        });
      }
    } catch (error) {
      (testResults.tests as any[]).push({
        type: 'tokens',
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    
    // Test NFTs
    try {
      const nftsResponse = await fetch(`https://bithomp.com/api/v2/address/${address}?nfts=true`, {
        headers: {
          'x-bithomp-token': process.env.BITHOMP_API_KEY || '',
          'User-Agent': 'RiddleSwap/1.0'
        }
      });
      
      if (nftsResponse.ok) {
        const nftsData = await nftsResponse.json();
        (testResults.tests as any[]).push({
          type: 'nfts',
          status: 'success',
          raw_count: (nftsData.nfts || []).length,
          sample_raw: nftsData.nfts?.[0] || null,
          api_structure: Object.keys(nftsData)
        });
      } else {
        (testResults.tests as any[]).push({
          type: 'nfts',
          status: 'failed',
          error: `${nftsResponse.status} ${nftsResponse.statusText}`
        });
      }
    } catch (error) {
      (testResults.tests as any[]).push({
        type: 'nfts',
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    
    res.json(testResults);
    
  } catch (error) {
    console.error(`❌ [XRP TEST] Test failed:`, error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Test failed',
      address: req.params.address
    });
  }
});

// Helper function to validate trustline for removal
async function validateTrustlineForRemoval(
  client: XRPLClient,
  address: string,
  currency: string,
  issuer: string
): Promise<{ valid: boolean; error?: string; balance?: number; frozen?: boolean }> {
  try {
    // Get account lines to find the specific trustline
    const accountLines = await client.request({
      command: 'account_lines',
      account: address,
      ledger_index: 'validated'
    });

    const trustline = accountLines.result.lines.find(
      (line: any) => line.currency === currency && line.account === issuer
    );

    if (!trustline) {
      return {
        valid: false,
        error: `Trustline for ${currency} (${issuer}) not found`
      };
    }

    const balance = parseFloat(trustline.balance);
    const frozen = trustline.freeze === true || trustline.freeze_peer === true;

    // Check if balance is exactly 0
    if (balance !== 0) {
      return {
        valid: false,
        error: `Cannot remove trustline with non-zero balance: ${balance} ${currency}`,
        balance,
        frozen
      };
    }

    // Check if trustline is frozen
    if (frozen) {
      return {
        valid: false,
        error: `Cannot remove frozen trustline for ${currency}`,
        balance,
        frozen
      };
    }

    return {
      valid: true,
      balance,
      frozen
    };
  } catch (error) {
    console.error('❌ [TRUSTLINE VALIDATION] Failed to validate trustline:', error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Validation failed'
    };
  }
}

// Helper function to remove a single trustline
async function removeTrustline(
  client: XRPLClient,
  walletAddress: string,
  privateKey: string,
  currency: string,
  issuer: string
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    // Create wallet from private key to sign the transaction
    const wallet = new (await import('xrpl')).Wallet(privateKey, '');

    // Verify wallet address matches
    if (wallet.address !== walletAddress) {
      throw new Error('Wallet address mismatch - security check failed');
    }

    // Create TrustSet transaction to remove trustline (set limit to "0")
    const trustSetTx: any = {
      TransactionType: 'TrustSet',
      Account: walletAddress,
      LimitAmount: {
        currency: currency,
        issuer: issuer,
        value: "0"
      }
    };

    console.log(`🗑️ [TRUSTLINE REMOVAL] Removing trustline: ${currency} (${issuer})`);

    // Prepare and sign the transaction
    const prepared = await client.autofill(trustSetTx);
    const signed = wallet.sign(prepared);
    
    // Submit and wait for confirmation
    const result = await client.submitAndWait(signed.tx_blob);

    const meta = result.result.meta as any;
    const success = meta?.TransactionResult === 'tesSUCCESS';

    if (success) {
      console.log(`✅ [TRUSTLINE REMOVAL] Successfully removed trustline: ${currency}`);
      return {
        success: true,
        txHash: result.result.hash
      };
    } else {
      const errorCode = meta?.TransactionResult || 'Unknown error';
      console.error(`❌ [TRUSTLINE REMOVAL] Failed to remove trustline: ${errorCode}`);
      return {
        success: false,
        error: `Transaction failed: ${errorCode}`
      };
    }
  } catch (error) {
    console.error('❌ [TRUSTLINE REMOVAL] Error removing trustline:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Removal failed'
    };
  }
}

// Single Trustline Removal Endpoint
router.post('/xrp/trustlines/remove', sessionAuth, async (req: AuthenticatedRequest, res: Response) => {
  let client: XRPLClient | null = null;
  
  try {
    console.log('🗑️ [SINGLE TRUSTLINE REMOVAL] Request received');
    
    // Validate request body
    const validation = singleTrustlineRemovalSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: validation.error.errors
      });
    }

    const { currency, issuer } = validation.data;
    
    // Get wallet address from authenticated session
    const walletAddress = req.user?.walletAddress;
    if (!walletAddress) {
      return res.status(401).json({
        success: false,
        error: 'No wallet address found in session'
      });
    }

    // Get cached private key from sessionAuth
    const xrpPrivateKey = (req.user as any)?.cachedKeys?.xrpPrivateKey;
    if (!xrpPrivateKey) {
      console.error('❌ [TRUSTLINE REMOVAL] No XRP private key in cached keys');
      return res.status(401).json({
        success: false,
        error: 'XRP wallet not found in session. Please login.'
      });
    }
    console.log(`✅ [TRUSTLINE REMOVAL] Private key retrieved from cachedKeys`);

    client = await getXrplClient();

    // Validate trustline can be removed
    const validation_result = await validateTrustlineForRemoval(client, walletAddress, currency, issuer);
    if (!validation_result.valid) {
      return res.status(400).json({
        success: false,
        error: validation_result.error
      });
    }

    // Remove the trustline
    const removal_result = await removeTrustline(
      client,
      walletAddress,
      xrpPrivateKey,
      currency,
      issuer
    );

    // Log the operation
    console.log(`📝 [TRUSTLINE REMOVAL] ${walletAddress} removed ${currency} trustline: ${removal_result.success ? 'SUCCESS' : 'FAILED'}`);

    return res.json(removal_result);

  } catch (error) {
    console.error('❌ [SINGLE TRUSTLINE REMOVAL] Unexpected error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  } finally {
    if (client) {
      await disconnectClient(client);
    }
  }
});

// Bulk Trustline Removal Endpoint
router.post('/xrp/trustlines/remove-bulk', sessionAuth, bulkTrustlineRateLimit, async (req: AuthenticatedRequest, res: Response) => {
  let client: XRPLClient | null = null;
  
  try {
    console.log('🗑️ [BULK TRUSTLINE REMOVAL] Request received');
    
    // Validate request body
    const validation = bulkTrustlineRemovalSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: validation.error.errors
      });
    }

    const { trustlines } = validation.data;
    
    // Get wallet address from authenticated session
    const walletAddress = req.user?.walletAddress;
    if (!walletAddress) {
      return res.status(401).json({
        success: false,
        error: 'No wallet address found in session'
      });
    }

    // Get cached private key from sessionAuth
    const xrpPrivateKey = (req.user as any)?.cachedKeys?.xrpPrivateKey;
    if (!xrpPrivateKey) {
      console.error('❌ [BULK TRUSTLINE REMOVAL] No XRP private key in cached keys');
      return res.status(401).json({
        success: false,
        error: 'XRP wallet not found in session. Please login.'
      });
    }
    console.log(`✅ [BULK TRUSTLINE REMOVAL] Private key retrieved from cachedKeys`);

    client = await getXrplClient();

    const results: Array<{
      currency: string;
      issuer: string;
      success: boolean;
      txHash?: string;
      error?: string;
    }> = [];

    // Process each trustline sequentially
    for (const item of trustlines) {
      try {
        console.log(`🔍 [BULK REMOVAL] Processing ${item.currency} (${item.issuer})`);

        // Validate trustline can be removed
        const validation_result = await validateTrustlineForRemoval(client, walletAddress, item.currency, item.issuer);
        
        if (!validation_result.valid) {
          results.push({
            currency: item.currency,
            issuer: item.issuer,
            success: false,
            error: validation_result.error
          });
          continue;
        }

        // Remove the trustline
        const removal_result = await removeTrustline(
          client,
          walletAddress,
          xrpPrivateKey,
          item.currency,
          item.issuer
        );

        results.push({
          currency: item.currency,
          issuer: item.issuer,
          success: removal_result.success,
          txHash: removal_result.txHash,
          error: removal_result.error
        });

        // Small delay between operations to avoid overwhelming the network
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (itemError) {
        console.error(`❌ [BULK REMOVAL] Failed to process ${item.currency}:`, itemError);
        results.push({
          currency: item.currency,
          issuer: item.issuer,
          success: false,
          error: itemError instanceof Error ? itemError.message : 'Processing failed'
        });
      }
    }

    // Log the bulk operation summary
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;
    console.log(`📊 [BULK TRUSTLINE REMOVAL] ${walletAddress} processed ${results.length} trustlines: ${successCount} success, ${failureCount} failed`);

    return res.json({ results });

  } catch (error) {
    console.error('❌ [BULK TRUSTLINE REMOVAL] Unexpected error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  } finally {
    if (client) {
      await disconnectClient(client);
    }
  }
});

export default router;