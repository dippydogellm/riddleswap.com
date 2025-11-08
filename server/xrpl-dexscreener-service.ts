import fetch from 'node-fetch';

export interface DexScreenerToken {
  symbol: string;
  name?: string;
  issuer?: string;
  logo_url?: string;
  icon_url?: string;
  price_usd?: number;
  volume_24h?: number;
  price_change_24h?: number;
}

export class XRPLDexScreenerService {
  private static readonly BASE_URL = 'https://api.dexscreener.com/latest/dex';
  private static readonly REQUEST_TIMEOUT = 5000;
  
  // Cache for logo URLs to avoid repeated API calls
  private static logoCache = new Map<string, string>();
  
  /**
   * Search for XRPL tokens using DexScreener API
   */
  static async searchTokens(query: string, limit: number = 50): Promise<DexScreenerToken[]> {
    try {
      const searchUrl = `${this.BASE_URL}/search?q=${encodeURIComponent(query)}`;
      
      console.log(`🔍 Searching DexScreener for: "${query}"`);
      
      const response = await fetch(searchUrl, {
        signal: AbortSignal.timeout(this.REQUEST_TIMEOUT),
        headers: {
          'User-Agent': 'RiddleSwap/1.0',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`DexScreener API error: ${response.status}`);
      }

      const data = await response.json() as any;
      
      if (!data.pairs || !Array.isArray(data.pairs)) {
        console.log(`⚠️ No pairs found for query: ${query}`);
        return [];
      }

      // Filter for XRPL tokens only and extract relevant information
      const xrplTokens = data.pairs
        .filter((pair: any) => 
          pair.chainId === 'xrpl' || 
          pair.dexId === 'xrpl' ||
          (pair.baseToken && pair.baseToken.symbol) ||
          (pair.quoteToken && pair.quoteToken.symbol)
        )
        .slice(0, limit)
        .flatMap((pair: any) => {
          const tokens: DexScreenerToken[] = [];
          
          // Add base token if it matches query
          if (pair.baseToken?.symbol?.toLowerCase().includes(query.toLowerCase())) {
            tokens.push({
              symbol: pair.baseToken.symbol,
              name: pair.baseToken.name || pair.baseToken.symbol,
              issuer: pair.baseToken.address,
              logo_url: pair.info?.imageUrl || pair.baseToken.logo,
              icon_url: pair.info?.imageUrl || pair.baseToken.logo,
              price_usd: parseFloat(pair.priceUsd || '0'),
              volume_24h: parseFloat(pair.volume?.h24 || '0'),
              price_change_24h: parseFloat(pair.priceChange?.h24 || '0')
            });
          }
          
          // Add quote token if it matches query and is different from base
          if (pair.quoteToken?.symbol?.toLowerCase().includes(query.toLowerCase()) &&
              pair.quoteToken?.symbol !== pair.baseToken?.symbol) {
            tokens.push({
              symbol: pair.quoteToken.symbol,
              name: pair.quoteToken.name || pair.quoteToken.symbol,
              issuer: pair.quoteToken.address,
              logo_url: pair.info?.imageUrl || pair.quoteToken.logo,
              icon_url: pair.info?.imageUrl || pair.quoteToken.logo,
              price_usd: parseFloat(pair.priceUsd || '0'),
              volume_24h: parseFloat(pair.volume?.h24 || '0'),
              price_change_24h: parseFloat(pair.priceChange?.h24 || '0')
            });
          }
          
          return tokens;
        })
        // Remove duplicates based on symbol + issuer
        .reduce((unique: DexScreenerToken[], token: DexScreenerToken) => {
          const key = `${token.symbol}-${token.issuer}`;
          if (!unique.some(t => `${t.symbol}-${t.issuer}` === key)) {
            unique.push(token);
          }
          return unique;
        }, []);

      console.log(`✅ Found ${xrplTokens.length} XRPL tokens on DexScreener`);
      return xrplTokens;
      
    } catch (error) {
      console.error('❌ DexScreener search error:', error);
      return [];
    }
  }

  /**
   * Get token logo from DexScreener API with caching
   */
  static async getTokenLogo(symbol: string, issuer?: string): Promise<string | null> {
    const cacheKey = `${symbol}-${issuer || 'none'}`;
    
    // Check cache first
    if (this.logoCache.has(cacheKey)) {
      return this.logoCache.get(cacheKey) || null;
    }

    // Hardcoded logos for reliable display
    const commonLogos: Record<string, string> = {
      'XRP': '/images/chains/xrp-logo.png',
      'RDL': 'https://dd.dexscreener.com/ds-data/tokens/xrpl/rdl.r9xvnzuwzjpdu3na6mkhmkhkjqtrqcrgu9.png?key=7c1c6a',
      'GRIM': 'https://pbs.twimg.com/profile_images/1732488607740833792/u5Z5Tz0A_400x400.jpg',
      'ARMY': 'https://pbs.twimg.com/profile_images/1700900028901588992/QJsOKfQ__400x400.jpg'
    };

    if (commonLogos[symbol]) {
      const logoUrl = commonLogos[symbol];
      this.logoCache.set(cacheKey, logoUrl);
      return logoUrl;
    }

    // Search DexScreener for logo
    try {
      const tokens = await this.searchTokens(symbol, 10);
      const exactMatch = tokens.find(t => 
        t.symbol === symbol && 
        (!issuer || t.issuer === issuer) && 
        (t.logo_url || t.icon_url)
      );

      if (exactMatch && (exactMatch.logo_url || exactMatch.icon_url)) {
        const logoUrl = exactMatch.logo_url || exactMatch.icon_url || null;
        if (logoUrl) {
          this.logoCache.set(cacheKey, logoUrl);
        }
        return logoUrl;
      }
    } catch (error) {
      console.error(`❌ Logo fetch error for ${symbol}:`, error);
    }

    // Cache null result to avoid repeated failed requests
    this.logoCache.set(cacheKey, '');
    return null;
  }

  /**
   * Get current price for a token from DexScreener
   */
  static async getTokenPrice(symbol: string, issuer?: string): Promise<number> {
    try {
      if (symbol === 'XRP') {
        // Use CoinGecko for XRP price
        const { getLiveXRPPrice } = await import('./xrpl/swap-exchange-rates');
        return await getLiveXRPPrice() || 0;
      }

      const tokens = await this.searchTokens(symbol, 5);
      const exactMatch = tokens.find(t => 
        t.symbol === symbol && 
        (!issuer || t.issuer === issuer) &&
        t.price_usd && t.price_usd > 0
      );

      return exactMatch?.price_usd || 0;
    } catch (error) {
      console.error(`❌ Price fetch error for ${symbol}:`, error);
      return 0;
    }
  }

  /**
   * Clear logo cache (useful for testing or periodic cleanup)
   */
  static clearCache(): void {
    this.logoCache.clear();
    console.log('✅ DexScreener cache cleared');
  }
}