/**
 * Token Metadata Service
 * 
 * Provides cached access to token metadata (names, symbols, logos)
 * from various sources including DexScreener, Bithomp, and XRPLMeta.
 * Uses the unified cache manager with 2-minute TTL.
 */

import { cacheManager, CACHE_TYPES } from './unified-cache-manager';
import { getTokenFromBithomp, getAllXRPLTokensFromBithomp } from './bithomp-token-api';
import { getXRPLTokenBySymbol, DexScreenerPair } from './dexscreener-api';
import fetch from 'node-fetch';

export interface TokenMetadata {
  symbol: string;
  name: string;
  issuer: string;
  currency_code: string;
  logo_url?: string;
  icon_url?: string;
  description?: string;
  website?: string;
  verified: boolean;
  source: 'dexscreener' | 'bithomp' | 'xrplmeta' | 'native';
  last_updated: number;
}

export interface PopularTokensMetadata {
  tokens: TokenMetadata[];
  count: number;
  last_updated: number;
  source: string;
}

export class TokenMetadataService {
  private static instance: TokenMetadataService | null = null;

  public static getInstance(): TokenMetadataService {
    if (!TokenMetadataService.instance) {
      TokenMetadataService.instance = new TokenMetadataService();
    }
    return TokenMetadataService.instance;
  }

  /**
   * Get token metadata with caching
   */
  public async getTokenMetadata(symbol: string, issuer?: string): Promise<TokenMetadata | null> {
    const cacheKey = `${symbol}:${issuer || 'native'}`;
    
    return await cacheManager.get(
      CACHE_TYPES.TOKEN_METADATA,
      cacheKey,
      async () => {
        console.log(`🔍 [TOKEN-METADATA] Fetching fresh metadata for ${symbol}${issuer ? ` (${issuer})` : ''}`);
        return await this.fetchTokenMetadata(symbol, issuer);
      }
    );
  }

  /**
   * Get popular tokens metadata with caching
   */
  public async getPopularTokensMetadata(): Promise<PopularTokensMetadata | null> {
    const cacheKey = 'popular_tokens_list';
    
    return await cacheManager.get(
      CACHE_TYPES.POPULAR_TOKENS,
      cacheKey,
      async () => {
        console.log(`🔥 [TOKEN-METADATA] Fetching popular tokens metadata`);
        return await this.fetchPopularTokensMetadata();
      }
    );
  }

  /**
   * Get all XRPL tokens metadata with caching
   */
  public async getAllXRPLTokensMetadata(): Promise<TokenMetadata[]> {
    const cacheKey = 'all_xrpl_tokens_metadata';
    
    const cached = await cacheManager.get(
      CACHE_TYPES.XRPL_TOKEN_LIST,
      cacheKey,
      async () => {
        console.log(`📊 [TOKEN-METADATA] Fetching all XRPL tokens metadata`);
        return await this.fetchAllXRPLTokensMetadata();
      }
    );

    return cached || [];
  }

  /**
   * Search tokens metadata with caching
   */
  public async searchTokensMetadata(query: string): Promise<TokenMetadata[]> {
    if (!query || query.length < 2) {
      return [];
    }

    const cacheKey = `search:${query.toLowerCase().trim()}`;
    
    const cached = await cacheManager.get(
      CACHE_TYPES.TOKEN_METADATA,
      cacheKey,
      async () => {
        console.log(`🔍 [TOKEN-METADATA] Searching for tokens: "${query}"`);
        return await this.performTokenSearch(query);
      }
    );

    return cached || [];
  }

  /**
   * Batch fetch metadata for multiple tokens
   */
  public async batchGetTokenMetadata(tokens: Array<{symbol: string, issuer?: string}>): Promise<TokenMetadata[]> {
    const batchKey = `batch:${tokens.map(t => `${t.symbol}:${t.issuer || 'native'}`).join(',')}`;
    
    const cached = await cacheManager.get(
      CACHE_TYPES.TOKEN_METADATA,
      batchKey,
      async () => {
        console.log(`📦 [TOKEN-METADATA] Batch fetching metadata for ${tokens.length} tokens`);
        return await this.fetchBatchTokenMetadata(tokens);
      }
    );

    return cached || [];
  }

  /**
   * Warm popular tokens cache
   */
  public async warmPopularTokensCache(): Promise<number> {
    return await cacheManager.warmCache(
      CACHE_TYPES.TOKEN_METADATA,
      async () => {
        console.log(`🔥 [TOKEN-METADATA] Warming popular tokens cache`);
        const popularTokens = await this.fetchPopularTokensMetadata();
        
        if (!popularTokens) {
          return [];
        }

        return popularTokens.tokens.map(token => ({
          key: `${token.symbol}:${token.issuer || 'native'}`,
          data: token
        }));
      }
    );
  }

  /**
   * Invalidate token metadata cache
   */
  public async invalidateTokenMetadata(symbol: string, issuer?: string): Promise<boolean> {
    const cacheKey = `${symbol}:${issuer || 'native'}`;
    return await cacheManager.delete(CACHE_TYPES.TOKEN_METADATA, cacheKey);
  }

  /**
   * Clear all token metadata caches
   */
  public async clearAllTokenMetadata(): Promise<number> {
    return await cacheManager.clear(CACHE_TYPES.TOKEN_METADATA);
  }

  // Private methods for fetching data

  private async fetchTokenMetadata(symbol: string, issuer?: string): Promise<TokenMetadata | null> {
    try {
      // Handle XRP specially
      if (symbol === 'XRP' && !issuer) {
        return {
          symbol: 'XRP',
          name: 'XRP',
          issuer: '',
          currency_code: 'XRP',
          logo_url: '/images/chains/xrp-logo.png',
          icon_url: '/images/chains/xrp-logo.png',
          description: 'XRP is the native cryptocurrency of the XRP Ledger',
          website: 'https://xrpl.org',
          verified: true,
          source: 'native',
          last_updated: Date.now()
        };
      }

      // Try DexScreener first for active trading tokens
      try {
        const dexPair = await getXRPLTokenBySymbol(symbol, issuer);
        if (dexPair) {
          return this.transformDexScreenerToMetadata(dexPair, symbol, issuer);
        }
      } catch (error) {
        console.log(`⚠️ [TOKEN-METADATA] DexScreener lookup failed for ${symbol}: ${error}`);
      }

      // Try Bithomp/XRPLMeta as fallback
      if (issuer) {
        try {
          const bithompToken = await getTokenFromBithomp(symbol, issuer);
          if (bithompToken) {
            return {
              symbol: bithompToken.symbol,
              name: bithompToken.name,
              issuer: bithompToken.issuer,
              currency_code: bithompToken.currency_code,
              logo_url: bithompToken.logo_url || '',
              icon_url: bithompToken.icon_url || bithompToken.logo_url || '',
              description: '',
              website: '',
              verified: bithompToken.verified,
              source: 'bithomp',
              last_updated: Date.now()
            };
          }
        } catch (error) {
          console.log(`⚠️ [TOKEN-METADATA] Bithomp lookup failed for ${symbol}: ${error}`);
        }
      }

      console.log(`❌ [TOKEN-METADATA] No metadata found for ${symbol}${issuer ? ` (${issuer})` : ''}`);
      return null;

    } catch (error) {
      console.error(`❌ [TOKEN-METADATA] Error fetching metadata for ${symbol}:`, error);
      return null;
    }
  }

  private async fetchPopularTokensMetadata(): Promise<PopularTokensMetadata | null> {
    try {
      // Start with XRP
      const popularTokens: TokenMetadata[] = [{
        symbol: 'XRP',
        name: 'XRP',
        issuer: '',
        currency_code: 'XRP',
        logo_url: '/images/chains/xrp-logo.png',
        icon_url: '/images/chains/xrp-logo.png',
        description: 'XRP is the native cryptocurrency of the XRP Ledger',
        website: 'https://xrpl.org',
        verified: true,
        source: 'native',
        last_updated: Date.now()
      }];

      // Fetch popular tokens from DexScreener
      try {
        const response = await fetch('https://api.dexscreener.com/latest/dex/search?q=xrpl');
        if (response.ok) {
          const data = await response.json() as any;
          
          if (data?.pairs?.length > 0) {
            const xrplPairs = data.pairs
              .filter((pair: any) => pair.chainId === 'xrpl' && pair.priceUsd && parseFloat(pair.priceUsd) > 0)
              .sort((a: any, b: any) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))
              .slice(0, 20); // Top 20 by volume

            for (const pair of xrplPairs) {
              const metadata = this.transformDexScreenerToMetadata(pair, pair.baseToken.symbol, pair.baseToken.address);
              if (metadata) {
                popularTokens.push(metadata);
              }
            }
          }
        }
      } catch (error) {
        console.error('❌ [TOKEN-METADATA] Failed to fetch popular tokens from DexScreener:', error);
      }

      return {
        tokens: popularTokens,
        count: popularTokens.length,
        last_updated: Date.now(),
        source: 'dexscreener'
      };

    } catch (error) {
      console.error('❌ [TOKEN-METADATA] Error fetching popular tokens metadata:', error);
      return null;
    }
  }

  private async fetchAllXRPLTokensMetadata(): Promise<TokenMetadata[]> {
    try {
      const allTokens = await getAllXRPLTokensFromBithomp();
      
      return allTokens.map(token => ({
        symbol: token.symbol,
        name: token.name,
        issuer: token.issuer,
        currency_code: token.currency_code,
        logo_url: token.logo_url || '',
        icon_url: token.icon_url || token.logo_url || '',
        description: '',
        website: '',
        verified: token.verified,
        source: token.source as any,
        last_updated: Date.now()
      }));

    } catch (error) {
      console.error('❌ [TOKEN-METADATA] Error fetching all XRPL tokens metadata:', error);
      return [];
    }
  }

  private async performTokenSearch(query: string): Promise<TokenMetadata[]> {
    try {
      const results: TokenMetadata[] = [];
      
      // Always include XRP if it matches the search
      if ('XRP'.toLowerCase().includes(query.toLowerCase()) || 'ripple'.toLowerCase().includes(query.toLowerCase())) {
        results.push({
          symbol: 'XRP',
          name: 'XRP',
          issuer: '',
          currency_code: 'XRP',
          logo_url: '/images/chains/xrp-logo.png',
          icon_url: '/images/chains/xrp-logo.png',
          description: 'XRP is the native cryptocurrency of the XRP Ledger',
          website: 'https://xrpl.org',
          verified: true,
          source: 'native',
          last_updated: Date.now()
        });
      }

      // Search DexScreener
      try {
        const response = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`);
        if (response.ok) {
          const data = await response.json() as any;
          
          if (data?.pairs?.length > 0) {
            const xrplPairs = data.pairs
              .filter((pair: any) => pair.chainId === 'xrpl')
              .slice(0, 50); // Limit search results

            for (const pair of xrplPairs) {
              if (pair.baseToken.symbol.toLowerCase().includes(query.toLowerCase()) || 
                  pair.baseToken.name?.toLowerCase().includes(query.toLowerCase())) {
                const metadata = this.transformDexScreenerToMetadata(pair, pair.baseToken.symbol, pair.baseToken.address);
                if (metadata) {
                  results.push(metadata);
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('❌ [TOKEN-METADATA] DexScreener search failed:', error);
      }

      return results;

    } catch (error) {
      console.error('❌ [TOKEN-METADATA] Error performing token search:', error);
      return [];
    }
  }

  private async fetchBatchTokenMetadata(tokens: Array<{symbol: string, issuer?: string}>): Promise<TokenMetadata[]> {
    const results: TokenMetadata[] = [];
    
    for (const token of tokens) {
      try {
        const metadata = await this.fetchTokenMetadata(token.symbol, token.issuer);
        if (metadata) {
          results.push(metadata);
        }
      } catch (error) {
        console.error(`❌ [TOKEN-METADATA] Error fetching metadata for ${token.symbol}:`, error);
      }
    }

    return results;
  }

  private transformDexScreenerToMetadata(pair: DexScreenerPair, symbol: string, issuer?: string): TokenMetadata {
    return {
      symbol: symbol,
      name: pair.baseToken.name || symbol,
      issuer: issuer || pair.baseToken.address || '',
      currency_code: symbol,
      logo_url: (pair as any).info?.imageUrl || '',
      icon_url: (pair as any).info?.imageUrl || '',
      description: '',
      website: '',
      verified: true,
      source: 'dexscreener',
      last_updated: Date.now()
    };
  }
}

// Export singleton instance
export const tokenMetadataService = TokenMetadataService.getInstance();