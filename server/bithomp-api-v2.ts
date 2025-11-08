// Bithomp API v2 Integration - Official Token Data Source
import fetch from 'node-fetch';

const BITHOMP_BASE_URL = 'https://bithomp.com/api/v2';

export interface BithompToken {
  currency: string;
  issuer: string;
  name?: string;
  description?: string;
  icon?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  discord?: string;
  reddit?: string;
  verification_status?: string;
  holders?: number;
  volume_24h?: number;
  volume_7d?: number;
  volume_30d?: number;
  change_24h?: number;
  change_7d?: number;
  change_30d?: number;
  created?: string;
  updated?: string;
}

export interface BithompXRP {
  currency: 'XRP';
  name: 'XRP';
  price_usd?: number;
  volume_24h?: number;
  change_24h?: number;
  market_cap?: number;
}

export interface BithompCollection {
  issuer: string;
  taxon: number;
  name?: string;
  description?: string;
  image?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  discord?: string;
  verified?: boolean;
  family?: string;
  
  // Statistics
  floorPrice?: number;
  floorPriceUsd?: number;
  volume24h?: number;
  volume24hUsd?: number;
  volume7d?: number;
  volume7dUsd?: number;
  volume30d?: number;
  volume30dUsd?: number;
  change24h?: number;
  
  // Collection info
  totalNFTs?: number;
  totalSupply?: number;
  owners?: number;
  sales24h?: number;
  sales7d?: number;
  sales30d?: number;
  
  // Metadata
  royalty?: number;
  transferFee?: number;
  flags?: number;
  taxonKey?: string;
  
  // Timestamps
  created?: string;
  updated?: string;
  firstNFT?: string;
  lastNFT?: string;
}

class BithompAPI {
  private async makeRequest(endpoint: string, params?: Record<string, any>): Promise<any> {
    try {
      const url = new URL(`${BITHOMP_BASE_URL}${endpoint}`);
      
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            url.searchParams.append(key, value.toString());
          }
        });
      }

      console.log(`🔍 Bithomp API request: ${url.toString()}`);
      
      // Get API key from environment
      const apiKey = process.env.BITHOMP_API_KEY;
      
      const response = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'RiddleSwap/1.0',
          'Accept': 'application/json',
          'x-bithomp-token': apiKey || '', // Add Bithomp API token header
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`❌ Bithomp API error: ${response.status} ${response.statusText} - ${errorText}`);
        throw new Error(`Bithomp API error: ${response.status}`);
      }

      const data = await response.json() as any;
      
      // Check if error response
      if (data?.error) {
        console.log(`❌ Bithomp API error: ${data.error}`);
        throw new Error(data.error);
      }
      
      console.log(`✅ Bithomp API success: ${endpoint}`);
      return data;
      
    } catch (error) {
      console.error('❌ Bithomp API request failed:', error);
      // For tokens, try direct XRPL fallback
      if (endpoint.includes('/balances') || endpoint.includes('/address')) {
        const addressMatch = endpoint.match(/address\/([^/]+)/);
        if (addressMatch) {
          return await this.getTokensViaXRPL(addressMatch[1]);
        }
      }
      throw error;
    }
  }

  // Fallback to DexScreener for authentic XRPL token data
  private async useDexScreenerFallback(endpoint: string, params?: Record<string, any>): Promise<any> {
    try {
      console.log('🔄 Using DexScreener fallback for XRPL tokens...');
      
      // Import DexScreener API
      const { loadAllXRPLTokens } = await import('./dexscreener-api.js');
      
      const tokens = await loadAllXRPLTokens();
      
      if (endpoint.includes('/tokens/search') && params?.q) {
        const query = params.q.toLowerCase();
        const filtered = tokens.filter(token => 
          token.baseToken.symbol.toLowerCase().includes(query) ||
          token.baseToken.name?.toLowerCase().includes(query) ||
          token.baseToken.address?.toLowerCase().includes(query)
        );
        
        return filtered.map(pair => ({
          currency: pair.baseToken.symbol,
          issuer: pair.baseToken.address || '',
          name: pair.baseToken.name,
          price_usd: parseFloat(pair.priceUsd || '0') || 0,
          volume_24h: pair.volume?.h24 || 0,
          change_24h: pair.priceChange?.h24 || 0,
          verification_status: 'dexscreener',
          source: 'dexscreener_fallback'
        }));
      }
      
      if (endpoint.includes('/tokens')) {
        return tokens.map(pair => ({
          currency: pair.baseToken.symbol,
          issuer: pair.baseToken.address || '',
          name: pair.baseToken.name,
          price_usd: parseFloat(pair.priceUsd || '0') || 0,
          volume_24h: pair.volume?.h24 || 0,
          change_24h: pair.priceChange?.h24 || 0,
          verification_status: 'dexscreener',
          source: 'dexscreener_fallback'
        }));
      }
      
      return null;
      
    } catch (error) {
      console.error('❌ DexScreener fallback failed:', error);
      return null;
    }
  }

  // Get all XRPL tokens from Bithomp
  async getAllTokens(limit?: number, offset?: number): Promise<BithompToken[]> {
    try {
      console.log('📊 Fetching all tokens from Bithomp...');
      
      const params: Record<string, any> = {};
      if (limit) params.limit = limit;
      if (offset) params.offset = offset;
      
      const data = await this.makeRequest('/tokens', params);
      
      if (data && Array.isArray(data)) {
        console.log(`✅ Bithomp tokens loaded: ${data.length}`);
        return data.map(token => this.formatToken(token));
      }
      
      console.log('❌ No tokens data from Bithomp');
      return [];
      
    } catch (error) {
      console.error('❌ Failed to fetch tokens from Bithomp:', error);
      return [];
    }
  }

  // Get specific token information
  async getToken(issuer: string, currency: string): Promise<BithompToken | null> {
    try {
      console.log(`📊 Fetching token ${currency}:${issuer} from Bithomp...`);
      
      const data = await this.makeRequest(`/token/${issuer}:${currency}`);
      
      if (data) {
        console.log(`✅ Bithomp token found: ${currency}`);
        return this.formatToken(data);
      }
      
      return null;
      
    } catch (error) {
      console.error('❌ Failed to fetch specific token from Bithomp:', error);
      return null;
    }
  }

  // Search tokens by query
  async searchTokens(query: string, limit?: number): Promise<BithompToken[]> {
    try {
      console.log(`🔍 Searching tokens on Bithomp: "${query}"`);
      
      const params: Record<string, any> = { q: query };
      if (limit) params.limit = limit;
      
      const data = await this.makeRequest('/tokens/search', params);
      
      if (data && Array.isArray(data)) {
        console.log(`✅ Bithomp search results: ${data.length}`);
        return data.map(token => this.formatToken(token));
      }
      
      return [];
      
    } catch (error) {
      console.error('❌ Failed to search tokens on Bithomp:', error);
      return [];
    }
  }

  // Get token balances for an address using XRPL direct (Bithomp unreliable)
  async getAddressTokenBalances(address: string): Promise<any[]> {
    try {
      console.log(`📊 Fetching token balances for ${address}...`);
      
      // Try Bithomp first
      try {
        const data = await this.makeRequest(`/address/${address}`, { assets: 'all' });
        
        // Extract lines/trustlines from address info
        if (data?.lines && Array.isArray(data.lines)) {
          console.log(`✅ Bithomp balances found: ${data.lines.length}`);
          return data.lines.filter((line: any) => parseFloat(line.balance || '0') > 0);
        }
      } catch (bithompError) {
        console.log('⚠️ Bithomp failed, using XRPL direct...');
      }
      
      // Fallback to XRPL direct
      return await this.getTokensViaXRPL(address);
      
    } catch (error) {
      console.error('❌ Failed to fetch address token balances:', error);
      return [];
    }
  }

  // Get address NFTs from Bithomp
  async getAddressNFTs(address: string): Promise<any[]> {
    try {
      console.log(`🎨 Fetching NFTs for ${address} from Bithomp...`);
      
      const data = await this.makeRequest(`/address/${address}`, { nfts: true, assets: 'all' });
      const nfts = data?.nfts || [];
      
      console.log(`✅ Found ${nfts.length} NFTs for ${address}`);
      
      return nfts.map((nft: any) => ({
        tokenID: nft.nftokenID || nft.id,
        flags: nft.flags || {},
        issuer: nft.issuer || '',
        nftokenTaxon: nft.nftokenTaxon || 0,
        transferFee: nft.transferFee || 0,
        sequence: nft.sequence || 0,
        nftSerial: nft.nftSerial || 0,
        owner: nft.owner || address,
        uri: nft.uri || '',
        url: nft.url || '',
        // Use CDN images from assets (no IPFS parsing)
        image: nft.assets?.image || `https://bithomp.com/api/v2/nft/${nft.nftokenID || nft.id}/image`,
        preview: nft.assets?.preview || '',
        thumbnail: nft.assets?.thumbnail || '',
        name: nft.name || nft.metadata?.name || `NFT #${(nft.nftokenID || nft.id)?.slice(-6)}`,
        description: nft.description || nft.metadata?.description || 'XRPL NFT Token',
        collection: nft.collection || nft.metadata?.collection || {},
        attributes: nft.attributes || nft.metadata?.attributes || [],
        metadata: nft.metadata || {},
        // Additional fields from Bithomp
        issuedAt: nft.issuedAt || null,
        ownerChangedAt: nft.ownerChangedAt || null,
        deletedAt: nft.deletedAt || null,
        mintedByMarketplace: nft.mintedByMarketplace || '',
        issuerDetails: nft.issuerDetails || {},
        ownerDetails: nft.ownerDetails || {},
        jsonMeta: nft.jsonMeta || false
      }));
      
    } catch (error) {
      console.error('❌ Failed to fetch address NFTs from Bithomp:', error);
      return [];
    }
  }

  // Get NFT collection information by issuer and taxon
  async getCollectionInfo(issuer: string, taxon: number): Promise<any> {
    try {
      console.log(`🎨 Fetching collection ${issuer}:${taxon} from Bithomp...`);
      
      const data = await this.makeRequest(`/nft-collection/${issuer}:${taxon}`, { 
        statistics: 'true', 
        floorPrice: 'true', 
        assets: 'true' 
      });
      
      if (data) {
        console.log(`✅ Bithomp collection found: ${data.name || `Collection ${taxon}`}`);
        // Return raw data to preserve floorPrices array
        return data;
      }
      
      return null;
      
    } catch (error) {
      console.error(`❌ Failed to fetch collection ${issuer}:${taxon} from Bithomp:`, error);
      return null;
    }
  }

  // Search NFT collections
  async searchCollections(query: string, limit?: number): Promise<BithompCollection[]> {
    try {
      console.log(`🔍 Searching collections on Bithomp: "${query}"`);
      
      const params: Record<string, any> = { search: query };
      if (limit) params.limit = limit;
      
      const data = await this.makeRequest('/nft-collections', params);
      
      if (data && Array.isArray(data)) {
        console.log(`✅ Bithomp collection search results: ${data.length}`);
        return data.map(collection => this.formatCollection(collection));
      }
      
      return [];
      
    } catch (error) {
      console.error('❌ Failed to search collections on Bithomp:', error);
      return [];
    }
  }

  // Get NFT collection data with floor prices and statistics - EXACT match to user request
  async getNFTCollectionPrice(collectionId: string, options?: {
    floorPrice?: boolean;
    statistics?: boolean;
    assets?: boolean;
  }): Promise<any> {
    try {
      console.log(`🔍 Fetching NFT collection price data for: ${collectionId}`);
      
      const params: Record<string, any> = {};
      if (options?.floorPrice) params.floorPrice = 'true';
      if (options?.statistics) params.statistics = 'true'; 
      if (options?.assets) params.assets = 'true';
      
      // Use the exact endpoint format from user's example
      const data = await this.makeRequest(`/nft-collection/${collectionId}`, params);
      
      if (data) {
        console.log(`✅ Bithomp NFT collection price data found for: ${collectionId}`);
        
        // Return the raw Bithomp API response exactly as user requested
        return data;
      }
      
      return null;
      
    } catch (error) {
      console.error(`❌ Failed to fetch NFT collection price from Bithomp: ${collectionId}`, error);
      return null;
    }
  }

  // Fallback to XRPL direct API for tokens
  private async getTokensViaXRPL(address: string): Promise<any[]> {
    try {
      console.log(`🔄 Using XRPL direct API for ${address}...`);
      
      const response = await fetch('https://xrplcluster.com/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          method: 'account_lines',
          params: [{
            account: address,
            ledger_index: 'validated'
          }]
        })
      });
      
      if (!response.ok) {
        throw new Error(`XRPL API failed: ${response.status}`);
      }
      
      const data: any = await response.json() as any;
      const lines = data?.result?.lines || [];
      
      console.log(`✅ XRPL Direct: Found ${lines.length} trustlines for ${address}`);
      
      // Convert XRPL format to Bithomp-like format
      return lines.filter((line: any) => parseFloat(line.balance || '0') > 0).map((line: any) => ({
        currency: line.currency,
        counterparty: line.account,
        issuer: line.account,
        value: line.balance,
        balance: line.balance,
        limit: line.limit,
        quality_in: line.quality_in,
        quality_out: line.quality_out,
        no_ripple: line.no_ripple
      }));
      
    } catch (error) {
      console.error('❌ Failed to fetch from XRPL direct:', error);
      return [];
    }
  }

  // Get XRP as separate native token
  getXRPToken(): BithompXRP {
    return {
      currency: 'XRP',
      name: 'XRP',
      price_usd: undefined, // Will be filled from external price API
      volume_24h: undefined,
      change_24h: undefined,
      market_cap: undefined
    };
  }

  private formatToken(rawToken: any): BithompToken {
    return {
      currency: rawToken.currency || rawToken.code,
      issuer: rawToken.issuer || rawToken.address,
      name: rawToken.name,
      description: rawToken.description,
      icon: rawToken.icon,
      website: rawToken.website,
      twitter: rawToken.twitter,
      telegram: rawToken.telegram,
      discord: rawToken.discord,
      reddit: rawToken.reddit,
      verification_status: rawToken.verification_status,
      holders: rawToken.holders,
      volume_24h: rawToken.volume_24h,
      volume_7d: rawToken.volume_7d,
      volume_30d: rawToken.volume_30d,
      change_24h: rawToken.change_24h,
      change_7d: rawToken.change_7d,
      change_30d: rawToken.change_30d,
      created: rawToken.created,
      updated: rawToken.updated
    };
  }

  private formatCollection(rawCollection: any): BithompCollection {
    return {
      issuer: rawCollection.issuer,
      taxon: rawCollection.taxon || rawCollection.nftokenTaxon || 0,
      name: rawCollection.name || rawCollection.family || rawCollection.title,
      description: rawCollection.description,
      image: rawCollection.image || rawCollection.assets?.image || rawCollection.assets?.preview,
      website: rawCollection.website,
      twitter: rawCollection.twitter,
      telegram: rawCollection.telegram,
      discord: rawCollection.discord,
      verified: rawCollection.verified || false,
      family: rawCollection.family,
      
      // Statistics
      floorPrice: parseFloat(rawCollection.floorPrice || '0') || 0,
      floorPriceUsd: parseFloat(rawCollection.floorPriceUsd || '0') || 0,
      volume24h: parseFloat(rawCollection.volume24h || '0') || 0,
      volume24hUsd: parseFloat(rawCollection.volume24hUsd || '0') || 0,
      volume7d: parseFloat(rawCollection.volume7d || '0') || 0,
      volume7dUsd: parseFloat(rawCollection.volume7dUsd || '0') || 0,
      volume30d: parseFloat(rawCollection.volume30d || '0') || 0,
      volume30dUsd: parseFloat(rawCollection.volume30dUsd || '0') || 0,
      change24h: parseFloat(rawCollection.change24h || '0') || 0,
      
      // Collection info
      totalNFTs: parseInt(rawCollection.totalNFTs || rawCollection.total || '0') || 0,
      totalSupply: parseInt(rawCollection.totalSupply || rawCollection.supply || '0') || 0,
      owners: parseInt(rawCollection.owners || '0') || 0,
      sales24h: parseInt(rawCollection.sales24h || '0') || 0,
      sales7d: parseInt(rawCollection.sales7d || '0') || 0,
      sales30d: parseInt(rawCollection.sales30d || '0') || 0,
      
      // Metadata
      royalty: parseFloat(rawCollection.royalty || '0') || 0,
      transferFee: parseInt(rawCollection.transferFee || '0') || 0,
      flags: rawCollection.flags,
      taxonKey: rawCollection.taxonKey,
      
      // Timestamps
      created: rawCollection.created,
      updated: rawCollection.updated,
      firstNFT: rawCollection.firstNFT,
      lastNFT: rawCollection.lastNFT
    };
  }
}

export const bithompAPI = new BithompAPI();

// Convenience functions for batch processing
export async function getBithompTokens(address: string) {
  try {
    const tokens = await bithompAPI.getAddressTokenBalances(address);
    return {
      success: true,
      tokens: tokens || [],
      count: (tokens || []).length
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch tokens',
      tokens: []
    };
  }
}

export async function getBithompNFTs(address: string) {
  try {
    const nfts = await bithompAPI.getAddressNFTs(address);
    return {
      success: true,
      nfts: nfts || [],
      count: (nfts || []).length
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch NFTs',
      nfts: []
    };
  }
}

export async function getBithompCollection(issuer: string, taxon: number) {
  try {
    const collection = await bithompAPI.getCollectionInfo(issuer, taxon);
    return {
      success: true,
      collection,
      hasData: !!collection
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch collection',
      collection: null
    };
  }
}