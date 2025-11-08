import { Router } from 'express';
import { eq, desc, and } from 'drizzle-orm';
import { db } from './db.js';
import { featuredTokens, type FeaturedToken } from '../shared/schema';
import { sessionAuth } from './middleware/session-auth';
import { requireAdminAccess } from './middleware/admin-auth';

const router = Router();

// Helper: Map chain name to chain ID
const CHAIN_IDS: Record<string, number> = {
  'ethereum': 1,
  'bsc': 56,
  'polygon': 137,
  'arbitrum': 42161,
  'optimism': 10,
  'base': 8453,
  'avalanche': 43114,
  'fantom': 250,
  'solana': 0 // Solana doesn't use chain IDs
};

// Helper: Fetch live price data for tokens
async function fetchTokenPriceData(chain: string, address: string, chainId?: number) {
  try {
    // For Solana, use Jupiter/DexScreener
    if (chain === 'solana') {
      const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`);
      const data = await response.json() as any;
      if (data.pairs && data.pairs.length > 0) {
        const pair = data.pairs[0];
        return {
          price_usd: parseFloat(pair.priceUsd) || 0,
          volume_24h: pair.volume?.h24 || 0,
          price_change_24h: pair.priceChange?.h24 || 0,
        };
      }
    }
    
    // For EVM chains, use 1inch price API
    if (chainId && chainId > 0) {
      const response = await fetch(
        `https://api.1inch.dev/price/v1.1/${chainId}/${address}`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.ONEINCH_API_KEY}`,
            'accept': 'application/json'
          }
        }
      );
      
      if (response.ok) {
        const data: any = await response.json() as any;
        // 1inch v1.1 returns format: { "address": "price" } or newer format with price field
        const priceValue = data[address] || data.price || 0;
        return {
          price_usd: parseFloat(priceValue) || 0,
          volume_24h: 0,
          price_change_24h: 0,
        };
      }
    }
  } catch (error) {
    console.log(`⚠️ Price data unavailable for ${chain}:${address}:`, error);
  }
  
  return { price_usd: 0, volume_24h: 0, price_change_24h: 0 };
}

// PUBLIC: Get featured tokens for specific chain
router.get('/api/featured-tokens/:chain', async (req, res) => {
  try {
    const { chain } = req.params;
    const chainId = CHAIN_IDS[chain.toLowerCase()];
    
    const tokens = await db.select()
      .from(featuredTokens)
      .where(and(
        eq(featuredTokens.chain, chain.toLowerCase()),
        eq(featuredTokens.is_active, true)
      ))
      .orderBy(desc(featuredTokens.display_order));

    // Enrich with live price data
    const enrichedTokens = await Promise.all(
      tokens.map(async (t: FeaturedToken) => {
        const priceData = await fetchTokenPriceData(t.chain, t.address, chainId);
        
        return {
          symbol: t.symbol,
          name: t.name,
          address: t.address,
          decimals: t.decimals,
          chainId: t.chain_id,
          logoURI: t.logo_uri || '',
          logo_url: t.logo_uri || '',
          icon_url: t.logo_uri || '',
          price_usd: priceData.price_usd,
          volume_24h: priceData.volume_24h,
          price_change_24h: priceData.price_change_24h,
          verified: true,
          source: 'featured'
        };
      })
    );

    console.log(`✅ Loaded ${enrichedTokens.length} featured tokens for ${chain} with live price data`);

    res.json({
      success: true,
      tokens: enrichedTokens,
      count: enrichedTokens.length,
      chain
    });
  } catch (error) {
    console.error('Failed to fetch featured tokens:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch featured tokens' });
  }
});

// PUBLIC: Get featured tokens for chain ID (EVM only)
router.get('/api/featured-tokens/chainId/:chainId', async (req, res) => {
  try {
    const chainId = parseInt(req.params.chainId);
    
    const tokens = await db.select()
      .from(featuredTokens)
      .where(and(
        eq(featuredTokens.chain_id, chainId),
        eq(featuredTokens.is_active, true)
      ))
      .orderBy(desc(featuredTokens.display_order));

    // Enrich with live price data
    const enrichedTokens = await Promise.all(
      tokens.map(async (t: FeaturedToken) => {
        const priceData = await fetchTokenPriceData(t.chain, t.address, chainId);
        
        return {
          symbol: t.symbol,
          name: t.name,
          address: t.address,
          decimals: t.decimals,
          chainId: t.chain_id,
          logoURI: t.logo_uri || '',
          logo_url: t.logo_uri || '',
          icon_url: t.logo_uri || '',
          price_usd: priceData.price_usd,
          volume_24h: priceData.volume_24h,
          price_change_24h: priceData.price_change_24h,
          verified: true,
          source: 'featured'
        };
      })
    );

    console.log(`✅ Loaded ${enrichedTokens.length} featured tokens for chain ${chainId} with live price data`);

    res.json({
      success: true,
      tokens: enrichedTokens,
      count: enrichedTokens.length,
      chainId
    });
  } catch (error) {
    console.error('Failed to fetch featured tokens:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch featured tokens' });
  }
});

// ADMIN ONLY: Add featured token
router.post('/api/admin/featured-tokens', sessionAuth, requireAdminAccess, async (req, res) => {
  try {
    const { chain, symbol, name, address, decimals, logo_uri, display_order } = req.body;
    const session = (req as any).session;

    if (!chain || !symbol || !address || !name) {
      return res.status(400).json({ 
        success: false, 
        error: 'chain, symbol, name, and address are required' 
      });
    }

    // Check if already exists
    const existing = await db.select()
      .from(featuredTokens)
      .where(and(
        eq(featuredTokens.chain, chain.toLowerCase()),
        eq(featuredTokens.address, address.toLowerCase())
      ))
      .limit(1);

    if (existing.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Token already featured on this chain' 
      });
    }

    const chainId = CHAIN_IDS[chain.toLowerCase()];

    const [inserted] = await db.insert(featuredTokens).values({
      chain: chain.toLowerCase(),
      chain_id: chainId || null,
      symbol,
      name,
      address: address.toLowerCase(),
      decimals: decimals || 18,
      logo_uri: logo_uri || null,
      display_order: display_order || 0,
      added_by: session?.handle || 'admin',
      is_active: true
    }).returning();

    console.log(`✅ Admin ${session?.handle} added featured token: ${symbol} on ${chain}`);

    res.json({
      success: true,
      token: inserted
    });
  } catch (error) {
    console.error('Failed to add featured token:', error);
    res.status(500).json({ success: false, error: 'Failed to add featured token' });
  }
});

// ADMIN ONLY: Remove featured token
router.delete('/api/admin/featured-tokens/:id', sessionAuth, requireAdminAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const session = (req as any).session;

    await db.delete(featuredTokens)
      .where(eq(featuredTokens.id, parseInt(id)));

    console.log(`✅ Admin ${session?.handle} removed featured token ID: ${id}`);

    res.json({
      success: true,
      message: 'Featured token removed'
    });
  } catch (error) {
    console.error('Failed to remove featured token:', error);
    res.status(500).json({ success: false, error: 'Failed to remove featured token' });
  }
});

// ADMIN ONLY: Update featured token
router.patch('/api/admin/featured-tokens/:id', sessionAuth, requireAdminAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const { display_order, is_active, logo_uri } = req.body;
    const session = (req as any).session;

    const updateData: any = { updated_at: new Date() };
    if (display_order !== undefined) updateData.display_order = display_order;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (logo_uri !== undefined) updateData.logo_uri = logo_uri;

    const [updated] = await db.update(featuredTokens)
      .set(updateData)
      .where(eq(featuredTokens.id, parseInt(id)))
      .returning();

    console.log(`✅ Admin ${session?.handle} updated featured token ID: ${id}`);

    res.json({
      success: true,
      token: updated
    });
  } catch (error) {
    console.error('Failed to update featured token:', error);
    res.status(500).json({ success: false, error: 'Failed to update featured token' });
  }
});

// ADMIN ONLY: List all featured tokens (including inactive) with optional chain filter
router.get('/api/admin/featured-tokens', sessionAuth, requireAdminAccess, async (req, res) => {
  try {
    const { chain } = req.query;
    
    let query = db.select().from(featuredTokens);
    
    if (chain && typeof chain === 'string') {
      query = query.where(eq(featuredTokens.chain, chain.toLowerCase())) as any;
    }
    
    const tokens = await query.orderBy(desc(featuredTokens.display_order));

    res.json({
      success: true,
      tokens,
      count: tokens.length
    });
  } catch (error) {
    console.error('Failed to fetch admin featured tokens:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch featured tokens' });
  }
});

export default router;
