import { Router } from 'express';
import { eq, desc, and } from 'drizzle-orm';
import { db } from './db.js';
import { featuredXrplTokens, type FeaturedXrplToken } from '../shared/schema';
import { sessionAuth } from './middleware/session-auth';
import { requireAdminAccess } from './middleware/admin-auth';

const router = Router();

// Helper: Fetch live DexScreener data AND logo for a token
async function fetchDexScreenerData(symbol: string, issuer: string) {
  try {
    // For native XRP, use CoinGecko for accurate price
    if (symbol === 'XRP' && !issuer) {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true');
      const data = await response.json() as any;
      if (data.ripple) {
        return {
          price_usd: data.ripple.usd || 0,
          volume_24h: data.ripple.usd_24h_vol || 0,
          price_change_24h: data.ripple.usd_24h_change || 0,
          logo_url: '/images/chains/xrp-logo.png'
        };
      }
    }
    
    // For other tokens, search DexScreener and match by issuer (same as search/rewards logic)
    const searchUrl = `https://api.dexscreener.com/latest/dex/search?q=${symbol}`;
    const response = await fetch(searchUrl);
    const data = await response.json() as any;
    
    if (data.pairs && data.pairs.length > 0) {
      // XRPL tokens in DexScreener use format "SYMBOL.issuer" 
      const xrplFormat = `${symbol}.${issuer}`;
      
      // Find pair matching the issuer (supports both formats)
      const matchingPair = data.pairs.find((p: any) => 
        p.baseToken?.address === issuer || 
        p.quoteToken?.address === issuer ||
        p.baseToken?.address === xrplFormat || 
        p.quoteToken?.address === xrplFormat
      );
      
      if (matchingPair) {
        console.log(`✅ Found DexScreener pair for ${symbol} (${issuer})`);
        
        // Determine which token is ours and get its logo
        const isBaseToken = matchingPair.baseToken?.address === issuer || matchingPair.baseToken?.address === xrplFormat;
        const tokenInfo = isBaseToken ? matchingPair.baseToken : matchingPair.quoteToken;
        
        // Get logo from token icon OR pair info imageUrl (for XRPL tokens)
        const logoUrl = tokenInfo?.icon || matchingPair.info?.imageUrl || '';
        
        return {
          price_usd: parseFloat(matchingPair.priceUsd) || 0,
          volume_24h: matchingPair.volume?.h24 || 0,
          price_change_24h: matchingPair.priceChange?.h24 || 0,
          logo_url: logoUrl
        };
      } else {
        console.log(`⚠️ No DexScreener pair found for ${symbol} (tried ${issuer} and ${xrplFormat})`);
      }
    }
  } catch (error) {
    console.log(`⚠️ DexScreener data unavailable for ${symbol}:`, error);
  }
  
  return { price_usd: 0, volume_24h: 0, price_change_24h: 0, logo_url: '' };
}

// PUBLIC: Get all featured tokens for swap interface with live DexScreener data
router.get('/api/xrpl/featured-tokens', async (req, res) => {
  try {
    const tokens = await db.select()
      .from(featuredXrplTokens)
      .where(eq(featuredXrplTokens.is_active, true))
      .orderBy(desc(featuredXrplTokens.display_order));

    // Enrich with live DexScreener data and logos
    const enrichedTokens = await Promise.all(
      tokens.map(async (t: FeaturedXrplToken) => {
        const liveData = await fetchDexScreenerData(t.symbol, t.issuer);
        
        return {
          symbol: t.symbol,
          currency_code: t.currency_code,
          name: t.name || t.symbol,
          issuer: t.issuer,
          icon_url: liveData.logo_url || t.icon_url || '',
          logo_url: liveData.logo_url || t.icon_url || '',
          logoURI: liveData.logo_url || t.icon_url || '',
          price_usd: liveData.price_usd,
          volume_24h: liveData.volume_24h,
          price_change_24h: liveData.price_change_24h,
          verified: true,
          source: 'featured'
        };
      })
    );

    console.log(`✅ Loaded ${enrichedTokens.length} featured tokens with live DexScreener data`);

    res.json({
      success: true,
      tokens: enrichedTokens,
      count: enrichedTokens.length
    });
  } catch (error) {
    console.error('Failed to fetch featured tokens:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch featured tokens' });
  }
});

// ADMIN ONLY: Add featured token
router.post('/api/admin/xrpl/featured-tokens', sessionAuth, requireAdminAccess, async (req, res) => {
  try {
    const { symbol, currency_code, issuer, name, icon_url, display_order } = req.body;
    const session = (req as any).session;

    if (!symbol || !currency_code || !issuer) {
      return res.status(400).json({ 
        success: false, 
        error: 'symbol, currency_code, and issuer are required' 
      });
    }

    // Check if already exists
    const existing = await db.select()
      .from(featuredXrplTokens)
      .where(and(
        eq(featuredXrplTokens.symbol, symbol),
        eq(featuredXrplTokens.issuer, issuer)
      ))
      .limit(1);

    if (existing.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Token already featured' 
      });
    }

    const [inserted] = await db.insert(featuredXrplTokens).values({
      symbol,
      currency_code,
      issuer,
      name: name || symbol,
      icon_url: icon_url || null,
      display_order: display_order || 0,
      added_by: session?.handle || 'admin',
      is_active: true
    } as any).returning();

    console.log(`✅ Admin ${session?.handle} added featured token: ${symbol}`);

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
router.delete('/api/admin/xrpl/featured-tokens/:id', sessionAuth, requireAdminAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const session = (req as any).session;

    await db.delete(featuredXrplTokens)
      .where(eq(featuredXrplTokens.id, parseInt(id)));

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

// ADMIN ONLY: Update featured token order
router.patch('/api/admin/xrpl/featured-tokens/:id', sessionAuth, requireAdminAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const { display_order, is_active } = req.body;
    const session = (req as any).session;

    const updateData: any = { updated_at: new Date() };
    if (display_order !== undefined) updateData.display_order = display_order;
    if (is_active !== undefined) updateData.is_active = is_active;

    const [updated] = await db.update(featuredXrplTokens)
      .set(updateData)
      .where(eq(featuredXrplTokens.id, parseInt(id)))
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

// ADMIN ONLY: List all featured tokens (including inactive)
router.get('/api/admin/xrpl/featured-tokens', sessionAuth, requireAdminAccess, async (req, res) => {
  try {
    const tokens = await db.select()
      .from(featuredXrplTokens)
      .orderBy(desc(featuredXrplTokens.display_order));

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
