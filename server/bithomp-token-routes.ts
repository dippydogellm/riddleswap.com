// Bithomp Token Routes - Official XRPL Token Data
import { Router } from 'express';
import { bithompAPI, type BithompToken, type BithompXRP } from './bithomp-api-v2.js';

const router = Router();

// Cache for tokens
let tokenCache: {
  xrp: BithompXRP | null;
  tokens: BithompToken[];
  lastUpdated: number;
} = {
  xrp: null,
  tokens: [],
  lastUpdated: 0
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Helper to refresh token cache
async function refreshTokenCache() {
  const now = Date.now();
  
  if (now - tokenCache.lastUpdated < CACHE_DURATION) {
    return; // Cache still valid
  }

  try {
    console.log('🔄 Refreshing Bithomp token cache...');
    
    // Get XRP separately
    tokenCache.xrp = bithompAPI.getXRPToken();
    
    // Get all other tokens from Bithomp
    const allTokens = await bithompAPI.getAllTokens(1000); // Get up to 1000 tokens
    tokenCache.tokens = allTokens.filter(token => token.currency !== 'XRP');
    
    tokenCache.lastUpdated = now;
    
    console.log(`✅ Bithomp cache refreshed: XRP + ${tokenCache.tokens.length} tokens`);
    
  } catch (error) {
    console.error('❌ Failed to refresh Bithomp cache:', error);
  }
}

// GET /api/bithomp/tokens/all - Get all tokens (XRP separate + all Bithomp tokens)
router.get('/tokens/all', async (req, res) => {
  try {
    await refreshTokenCache();
    
    const response = {
      success: true,
      source: 'bithomp',
      xrp: tokenCache.xrp,
      tokens: tokenCache.tokens,
      count: tokenCache.tokens.length,
      cache_updated: new Date(tokenCache.lastUpdated).toISOString()
    };
    
    res.json(response);
    
  } catch (error) {
    console.error('❌ Error fetching all Bithomp tokens:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tokens from Bithomp'
    });
  }
});

// GET /api/bithomp/tokens/search - Search tokens on Bithomp
router.get('/tokens/search', async (req, res) => {
  try {
    const { query, limit } = req.query;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    console.log(`🔍 Bithomp token search: "${query}"`);
    
    // Search tokens on Bithomp
    const searchResults = await bithompAPI.searchTokens(query, limit ? parseInt(limit as string) : 50);
    
    // Always include XRP if searching
    const results = [];
    if ('XRP'.toLowerCase().includes(query.toLowerCase())) {
      results.push(bithompAPI.getXRPToken());
    }
    
    // Add Bithomp search results
    results.push(...searchResults);
    
    res.json({
      success: true,
      source: 'bithomp',
      query,
      tokens: results,
      count: results.length
    });
    
  } catch (error) {
    console.error('❌ Error searching Bithomp tokens:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search tokens on Bithomp'
    });
  }
});

// GET /api/bithomp/token/:issuer/:currency - Get specific token
router.get('/token/:issuer/:currency', async (req, res) => {
  try {
    const { issuer, currency } = req.params;
    
    if (currency.toUpperCase() === 'XRP') {
      return res.json({
        success: true,
        source: 'native',
        token: bithompAPI.getXRPToken()
      });
    }
    
    const token = await bithompAPI.getToken(issuer, currency);
    
    if (token) {
      res.json({
        success: true,
        source: 'bithomp',
        token
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Token not found on Bithomp'
      });
    }
    
  } catch (error) {
    console.error('❌ Error fetching specific Bithomp token:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch token from Bithomp'
    });
  }
});

// GET /api/bithomp/address/:address/tokens - Get token balances for address
router.get('/address/:address/tokens', async (req, res) => {
  try {
    const { address } = req.params;
    
    const balances = await bithompAPI.getAddressTokenBalances(address);
    
    res.json({
      success: true,
      source: 'bithomp',
      address,
      balances,
      count: balances.length
    });
    
  } catch (error) {
    console.error('❌ Error fetching address token balances from Bithomp:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch address token balances from Bithomp'
    });
  }
});

// GET /api/bithomp/xrp - Get XRP token info
router.get('/xrp', (req, res) => {
  try {
    const xrpToken = bithompAPI.getXRPToken();
    
    res.json({
      success: true,
      source: 'native',
      token: xrpToken
    });
    
  } catch (error) {
    console.error('❌ Error getting XRP token:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get XRP token'
    });
  }
});

// GET /api/bithomp/token/logo - Get token logo from Bithomp API
router.get('/token/logo/:symbol/:issuer', async (req, res) => {
  try {
    const { symbol, issuer } = req.params;
    
    if (!symbol || !issuer) {
      return res.status(400).json({
        success: false,
        error: 'Symbol and issuer are required'
      });
    }
    
    console.log(`🎯 [BITHOMP LOGO] Fetching logo for ${symbol} (${issuer})`);
    
    // Use authenticated Bithomp API to get token details with assets
    const apiKey = process.env.BITHOMP_API_KEY || process.env.BITHOMP_TOKEN;
    if (!apiKey) {
      throw new Error('Bithomp API key not configured');
    }
    
    // Try the trustlines/tokens endpoint with statistics=true to get assets
    const url = `https://bithomp.com/api/v2/trustlines/tokens?currency=${encodeURIComponent(symbol)}&issuer=${encodeURIComponent(issuer)}&statistics=true&limit=1`;
    
    console.log(`🔍 [BITHOMP LOGO] Calling: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'x-bithomp-token': apiKey,
        'User-Agent': 'RiddleSwap/1.0'
      }
    });
    
    if (!response.ok) {
      console.log(`❌ [BITHOMP LOGO] API error: ${response.status}`);
      return res.status(404).json({
        success: false,
        error: 'Token not found or API error'
      });
    }
    
    const data = await response.json() as any;
    console.log(`📊 [BITHOMP LOGO] Response data:`, JSON.stringify(data, null, 2));
    
    // Extract logo from response
    if (data && data.tokens && data.tokens.length > 0) {
      const token = data.tokens[0];
      
      // Check for logo in various fields
      const logoUrl = token.assets?.image || token.image || token.logo || token.icon || null;
      
      if (logoUrl) {
        console.log(`✅ [BITHOMP LOGO] Found logo: ${logoUrl}`);
        return res.json({
          success: true,
          logo: logoUrl,
          source: 'bithomp-api'
        });
      }
    }
    
    console.log(`❌ [BITHOMP LOGO] No logo found for ${symbol}`);
    res.status(404).json({
      success: false,
      error: 'No logo found for this token'
    });
    
  } catch (error) {
    console.error('❌ [BITHOMP LOGO] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch token logo'
    });
  }
});

export default router;