// DexScreener Price Service - Comprehensive token price fetching
import fetch from 'node-fetch';

export interface TokenPrice {
  address: string;
  symbol: string;
  name: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  fdv: number;
  chainId: string;
  dexId: string;
  pairAddress: string;
  lastUpdated: number;
  source: 'dexscreener';
}

export interface PairData {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd: string;
  txns: {
    m5: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  volume: {
    h24: number;
    h6: number;
    h1: number;
    m5: number;
  };
  priceChange: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  liquidity?: {
    usd?: number;
    base?: number;
    quote?: number;
  };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
}

class DexScreenerPriceService {
  private readonly BASE_URL = 'https://api.dexscreener.com';
  private readonly cache = new Map<string, { data: TokenPrice; timestamp: number }>();
  private readonly CACHE_TTL = 30000; // 30 seconds cache

  // Chain mappings for DexScreener
  private readonly SUPPORTED_CHAINS = {
    ethereum: 'ethereum',
    bsc: 'bsc',
    polygon: 'polygon',
    arbitrum: 'arbitrum',
    optimism: 'optimism',
    base: 'base',
    avalanche: 'avalanche',
    fantom: 'fantom',
    solana: 'solana',
    xrpl: 'xrpl'
  };

  /**
   * Search for token prices by query (symbol, name, or address)
   */
  async searchTokens(query: string, chainId?: string): Promise<TokenPrice[]> {
    try {
      console.log(`🔍 [DEXSCREENER] Searching tokens: "${query}" on chain: ${chainId || 'all'}`);
      
      const url = `${this.BASE_URL}/latest/dex/search?q=${encodeURIComponent(query)}`;
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        throw new Error(`DexScreener API error: ${response.status}`);
      }

      const data = await response.json() as { pairs: PairData[] };
      const prices: TokenPrice[] = [];

      if (data.pairs && Array.isArray(data.pairs)) {
        for (const pair of data.pairs) {
          // Filter by chain if specified
          if (chainId && pair.chainId !== chainId) continue;

          const tokenPrice: TokenPrice = {
            address: pair.baseToken.address,
            symbol: pair.baseToken.symbol,
            name: pair.baseToken.name,
            price: parseFloat(pair.priceUsd || '0'),
            priceChange24h: pair.priceChange?.h24 || 0,
            volume24h: pair.volume?.h24 || 0,
            marketCap: pair.marketCap || 0,
            fdv: pair.fdv || 0,
            chainId: pair.chainId,
            dexId: pair.dexId,
            pairAddress: pair.pairAddress,
            lastUpdated: Date.now(),
            source: 'dexscreener'
          };

          prices.push(tokenPrice);
        }
      }

      console.log(`✅ [DEXSCREENER] Found ${prices.length} token prices for "${query}"`);
      return prices;

    } catch (error) {
      console.error(`❌ [DEXSCREENER] Search failed for "${query}":`, error);
      throw new Error(`Failed to search tokens: ${error.message}`);
    }
  }

  /**
   * Get token price by specific address and chain
   */
  async getTokenPrice(address: string, chainId: string): Promise<TokenPrice | null> {
    try {
      const cacheKey = `${chainId}-${address}`;
      
      // Check cache first
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        console.log(`📈 [DEXSCREENER] Cache hit for ${address} on ${chainId}`);
        return cached.data;
      }

      console.log(`🔍 [DEXSCREENER] Fetching price for ${address} on ${chainId}`);
      
      const url = `${this.BASE_URL}/latest/dex/tokens/${address}`;
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(8000)
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.log(`⚠️ [DEXSCREENER] Token not found: ${address} on ${chainId}`);
          return null;
        }
        throw new Error(`DexScreener API error: ${response.status}`);
      }

      const data = await response.json() as { pairs: PairData[] };
      
      if (!data.pairs || data.pairs.length === 0) {
        console.log(`⚠️ [DEXSCREENER] No pairs found for ${address} on ${chainId}`);
        return null;
      }

      // Find the best pair (highest liquidity or volume)
      const bestPair = data.pairs
        .filter(pair => pair.chainId === chainId)
        .sort((a, b) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))[0];

      if (!bestPair) {
        console.log(`⚠️ [DEXSCREENER] No pairs found for chain ${chainId}`);
        return null;
      }

      const tokenPrice: TokenPrice = {
        address: bestPair.baseToken.address,
        symbol: bestPair.baseToken.symbol,
        name: bestPair.baseToken.name,
        price: parseFloat(bestPair.priceUsd || '0'),
        priceChange24h: bestPair.priceChange?.h24 || 0,
        volume24h: bestPair.volume?.h24 || 0,
        marketCap: bestPair.marketCap || 0,
        fdv: bestPair.fdv || 0,
        chainId: bestPair.chainId,
        dexId: bestPair.dexId,
        pairAddress: bestPair.pairAddress,
        lastUpdated: Date.now(),
        source: 'dexscreener'
      };

      // Cache the result
      this.cache.set(cacheKey, { data: tokenPrice, timestamp: Date.now() });
      
      console.log(`✅ [DEXSCREENER] Got price for ${bestPair.baseToken.symbol}: $${tokenPrice.price}`);
      return tokenPrice;

    } catch (error) {
      console.error(`❌ [DEXSCREENER] Failed to get price for ${address} on ${chainId}:`, error);
      return null;
    }
  }

  /**
   * Get multiple token prices in batch
   */
  async getBatchPrices(requests: { address: string; chainId: string }[]): Promise<(TokenPrice | null)[]> {
    console.log(`🔍 [DEXSCREENER] Batch fetching ${requests.length} token prices`);
    
    const promises = requests.map(req => 
      this.getTokenPrice(req.address, req.chainId).catch(error => {
        console.error(`❌ [DEXSCREENER] Batch error for ${req.address}:`, error);
        return null;
      })
    );

    const results = await Promise.all(promises);
    const successCount = results.filter(r => r !== null).length;
    
    console.log(`✅ [DEXSCREENER] Batch complete: ${successCount}/${requests.length} successful`);
    return results;
  }

  /**
   * Get trending tokens by chain
   */
  async getTrendingTokens(chainId?: string, limit: number = 20): Promise<TokenPrice[]> {
    try {
      console.log(`📈 [DEXSCREENER] Fetching trending tokens for chain: ${chainId || 'all'}`);
      
      // Use search with popular terms to get trending tokens
      const trendingQueries = ['eth', 'usdc', 'usdt', 'wbtc', 'bnb'];
      const allResults: TokenPrice[] = [];

      for (const query of trendingQueries) {
        const results = await this.searchTokens(query, chainId);
        allResults.push(...results);
      }

      // Remove duplicates and sort by volume
      const uniqueTokens = Array.from(
        new Map(allResults.map(token => [`${token.chainId}-${token.address}`, token])).values()
      );

      const trending = uniqueTokens
        .sort((a, b) => b.volume24h - a.volume24h)
        .slice(0, limit);

      console.log(`✅ [DEXSCREENER] Found ${trending.length} trending tokens`);
      return trending;

    } catch (error) {
      console.error(`❌ [DEXSCREENER] Failed to get trending tokens:`, error);
      return [];
    }
  }

  /**
   * Get supported chains
   */
  getSupportedChains(): string[] {
    return Object.values(this.SUPPORTED_CHAINS as any);
  }

  /**
   * Clear price cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('🧹 [DEXSCREENER] Price cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }
}

// Export singleton instance
export const dexScreenerService = new DexScreenerPriceService();
export default dexScreenerService;