// XRPL Token Search V2 - Clean implementation with proper filtering
import { Router } from 'express';
import fetch from 'node-fetch';

const router = Router();

interface XRPLToken {
  symbol: string;
  name: string;
  issuer: string;
  currency_code?: string;
  icon_url?: string;
  verified?: boolean;
  source: string;
  price_usd?: number;
  volume_24h?: number;
}

// Helper to clean issuer addresses (remove prefixes like "RDL.")
function cleanIssuer(issuer: string): string {
  if (!issuer) return '';
  // Remove any prefix before the actual address
  const parts = issuer.split('.');
  const address = parts[parts.length - 1]; // Get the last part (the actual address)
  return address.startsWith('r') ? address : issuer;
}

// Check if token is XRPL native (issuer starts with 'r' or is empty for XRP)
function isXRPLNative(issuer: string): boolean {
  if (!issuer) return true; // Native XRP has no issuer
  const cleaned = cleanIssuer(issuer);
  return cleaned.startsWith('r');
}

// Search DexScreener for XRPL tokens only
async function searchDexScreener(query: string): Promise<XRPLToken[]> {
  try {
    const url = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`;
    console.log(`🔍 DexScreener search: ${query}`);
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) return [];
    
    const data = await response.json() as any;
    const tokens: XRPLToken[] = [];
    const seen = new Set<string>();

    if (data.pairs && Array.isArray(data.pairs)) {
      // Filter ONLY XRPL chain tokens
      const xrplPairs = data.pairs.filter((p: any) => p.chainId === 'xrpl');
      
      for (const pair of xrplPairs) {
        // Process base token
        if (pair.baseToken?.symbol?.toLowerCase().includes(query.toLowerCase())) {
          const issuer = cleanIssuer(pair.baseToken.address || '');
          const key = `${pair.baseToken.symbol}-${issuer}`;
          
          if (!seen.has(key) && isXRPLNative(issuer)) {
            seen.add(key);
            tokens.push({
              symbol: pair.baseToken.symbol,
              name: pair.baseToken.name || pair.baseToken.symbol,
              issuer: issuer,
              icon_url: pair.baseToken?.info?.imageUrl || (pair.baseToken.symbol === 'XRP' ? 'https://s2.coinmarketcap.com/static/img/coins/64x64/52.png' : '/images/tokens/default-token.png'),
              verified: true,
              source: 'DexScreener',
              price_usd: parseFloat(pair.priceUsd || '0'),
              volume_24h: parseFloat(pair.volume?.h24 || '0')
            });
          }
        }
        
        // Process quote token if different
        if (pair.quoteToken?.symbol?.toLowerCase().includes(query.toLowerCase())) {
          const issuer = cleanIssuer(pair.quoteToken.address || '');
          const key = `${pair.quoteToken.symbol}-${issuer}`;
          
          if (!seen.has(key) && isXRPLNative(issuer)) {
            seen.add(key);
            tokens.push({
              symbol: pair.quoteToken.symbol,
              name: pair.quoteToken.name || pair.quoteToken.symbol,
              issuer: issuer,
              icon_url: pair.quoteToken?.info?.imageUrl || (pair.quoteToken.symbol === 'XRP' ? 'https://s2.coinmarketcap.com/static/img/coins/64x64/52.png' : '/images/tokens/default-token.png'),
              verified: false,
              source: 'DexScreener',
              price_usd: 0,
              volume_24h: 0
            });
          }
        }
      }
    }

    console.log(`✅ DexScreener found ${tokens.length} XRPL tokens`);
    return tokens;
  } catch (error) {
    console.error('DexScreener error:', error);
    return [];
  }
}

// Search XRPL Meta for tokens
async function searchXRPLMeta(query: string): Promise<XRPLToken[]> {
  try {
    const url = `https://api.xrplmeta.org/tokens/search/${encodeURIComponent(query)}`;
    console.log(`🔍 XRPL Meta search: ${query}`);
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) return [];
    
    const data = await response.json() as any;
    const tokens: XRPLToken[] = [];

    if (Array.isArray(data)) {
      for (const token of data) {
        const issuer = cleanIssuer(token.issuer || '');
        if (isXRPLNative(issuer)) {
          tokens.push({
            symbol: token.code || token.currency,
            name: token.name || token.code,
            issuer: issuer,
            currency_code: token.currency,
            icon_url: token.icon || (token.code === 'XRP' || token.currency === 'XRP' ? 'https://s2.coinmarketcap.com/static/img/coins/64x64/52.png' : ''),
            verified: token.verified || false,
            source: 'XRPL Meta'
          });
        }
      }
    }

    console.log(`✅ XRPL Meta found ${tokens.length} tokens`);
    return tokens;
  } catch (error) {
    console.error('XRPL Meta error:', error);
    return [];
  }
}

// Main search endpoint - combines and deduplicates results
router.get('/search', async (req, res) => {
  try {
    const { query = '', limit = 50 } = req.query;
    const searchTerm = String(query).toLowerCase();
    
    if (!searchTerm) {
      return res.json({ success: true, tokens: [], count: 0 });
    }

    console.log(`\n🔄 XRPL Token Search V2: "${searchTerm}"`);

    // Special handling for XRP
    if (searchTerm === 'xrp') {
      // Fetch live XRP price from CoinGecko
      let liveXrpPrice = 0;
      try {
        const priceResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd');
        if (priceResponse.ok) {
          const priceData = await priceResponse.json() as any;
          liveXrpPrice = priceData.ripple?.usd || 0;
          console.log(`🎯 Live XRP price from CoinGecko: $${liveXrpPrice}`);
        }
      } catch (error) {
        console.error('Failed to fetch live XRP price:', error);
        // NO FALLBACKS - throw error if live data unavailable
        throw new Error('Live XRP price data unavailable');
      }

      if (!liveXrpPrice || liveXrpPrice <= 0) {
        throw new Error('Invalid live XRP price data');
      }

      const nativeXRP: XRPLToken = {
        symbol: 'XRP',
        name: 'XRP',
        issuer: '',
        icon_url: 'https://s2.coinmarketcap.com/static/img/coins/64x64/52.png',
        verified: true,
        source: 'Native',
        price_usd: liveXrpPrice // LIVE DATA ONLY
      };

      return res.json({
        success: true,
        tokens: [nativeXRP],
        count: 1,
        message: 'Native XRP token'
      });
    }

    // Search both sources in parallel
    const [dexScreenerTokens, xrplMetaTokens] = await Promise.all([
      searchDexScreener(searchTerm),
      searchXRPLMeta(searchTerm)
    ]);

    // Combine and deduplicate
    const tokenMap = new Map<string, XRPLToken>();
    
    // Add DexScreener tokens (prioritized for price data)
    for (const token of dexScreenerTokens) {
      const key = `${token.symbol}-${token.issuer}`;
      tokenMap.set(key, token);
    }
    
    // Add XRPL Meta tokens (only if not already present)
    for (const token of xrplMetaTokens) {
      const key = `${token.symbol}-${token.issuer}`;
      if (!tokenMap.has(key)) {
        tokenMap.set(key, token);
      }
    }

    // Convert to array and limit
    const uniqueTokens = Array.from(tokenMap.values()).slice(0, Number(limit));
    
    console.log(`✅ Found ${uniqueTokens.length} unique XRPL tokens (${tokenMap.size} before limit)`);

    res.json({
      success: true,
      tokens: uniqueTokens,
      count: uniqueTokens.length,
      sources: ['DexScreener', 'XRPL Meta']
    });

  } catch (error) {
    console.error('❌ Token search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search tokens',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get token details by symbol and issuer
router.get('/details/:symbol/:issuer?', async (req, res) => {
  try {
    const { symbol, issuer } = req.params;
    
    console.log(`📊 Getting details for ${symbol} (issuer: ${issuer || 'native'})`);

    // For native XRP
    if (symbol === 'XRP' && !issuer) {
      return res.json({
        success: true,
        token: {
          symbol: 'XRP',
          name: 'XRP',
          issuer: '',
          icon_url: 'https://s2.coinmarketcap.com/static/img/coins/64x64/52.png',
          verified: true,
          source: 'Native'
        }
      });
    }

    // Search for specific token
    const tokens = await searchDexScreener(symbol);
    const cleanedIssuer = issuer ? cleanIssuer(issuer) : '';
    
    const matchedToken = tokens.find(t => 
      t.symbol === symbol && 
      (cleanedIssuer ? t.issuer === cleanedIssuer : true)
    );

    if (matchedToken) {
      res.json({
        success: true,
        token: matchedToken
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Token not found'
      });
    }

  } catch (error) {
    console.error('❌ Token details error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get token details'
    });
  }
});

// Export the search function for use in other modules
export { searchDexScreener };

export default router;