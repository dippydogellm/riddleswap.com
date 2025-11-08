// @ts-ignore - nftscan-api types not properly resolved
import { NftscanEvm, NftscanSolana, EvmChain, ErcType } from 'nftscan-api';

// Chain configuration
export const SUPPORTED_CHAINS = {
  ETH: 'eth',
  BNB: 'bnb',
  POLYGON: 'polygon',
  ARBITRUM: 'arbitrum',
  OPTIMISM: 'optimism',
  BASE: 'base',
  MANTLE: 'mantle',
  SOLANA: 'solana',
  AVALANCHE: 'avax',
  ZKSYNC: 'zksync',
  LINEA: 'linea',
  SCROLL: 'scroll',
} as const;

export type SupportedChain = typeof SUPPORTED_CHAINS[keyof typeof SUPPORTED_CHAINS];

// Chain metadata for UI
export const CHAIN_METADATA = {
  eth: {
    name: 'Ethereum',
    icon: 'https://token-icons.s3.amazonaws.com/eth.png',
    symbol: 'ETH',
    color: '#627EEA'
  },
  bnb: {
    name: 'BNB Chain',
    icon: 'https://token-icons.s3.amazonaws.com/0x0000000000000000000000000000000000000000.png',
    symbol: 'BNB',
    color: '#F3BA2F'
  },
  polygon: {
    name: 'Polygon',
    icon: 'https://token-icons.s3.amazonaws.com/matic.png',
    symbol: 'MATIC',
    color: '#8247E5'
  },
  arbitrum: {
    name: 'Arbitrum',
    icon: 'https://token-icons.s3.amazonaws.com/arb.png',
    symbol: 'ARB',
    color: '#28A0F0'
  },
  optimism: {
    name: 'Optimism',
    icon: 'https://token-icons.s3.amazonaws.com/op.png',
    symbol: 'OP',
    color: '#FF0420'
  },
  base: {
    name: 'Base',
    icon: 'https://token-icons.s3.amazonaws.com/base.png',
    symbol: 'ETH',
    color: '#0052FF'
  },
  mantle: {
    name: 'Mantle',
    icon: 'https://token-icons.s3.amazonaws.com/mantle.png',
    symbol: 'MNT',
    color: '#000000'
  },
  solana: {
    name: 'Solana',
    icon: 'https://token-icons.s3.amazonaws.com/sol.png',
    symbol: 'SOL',
    color: '#14F195'
  },
  avax: {
    name: 'Avalanche',
    icon: 'https://token-icons.s3.amazonaws.com/avax.png',
    symbol: 'AVAX',
    color: '#E84142'
  },
  zksync: {
    name: 'zkSync',
    icon: 'https://token-icons.s3.amazonaws.com/zksync.png',
    symbol: 'ETH',
    color: '#8C8DFC'
  },
  linea: {
    name: 'Linea',
    icon: 'https://token-icons.s3.amazonaws.com/linea.png',
    symbol: 'ETH',
    color: '#121212'
  },
  scroll: {
    name: 'Scroll',
    icon: 'https://token-icons.s3.amazonaws.com/scroll.png',
    symbol: 'ETH',
    color: '#EBBEA0'
  }
};

// NFTScan Service
class NFTScanService {
  private evmClients: Map<string, NftscanEvm>;
  private solanaClient: NftscanSolana | null;
  private apiKey: string;

  constructor() {
    this.evmClients = new Map();
    this.solanaClient = null;
    this.apiKey = process.env.NFTSCAN_API_KEY || '';

    if (!this.apiKey) {
      console.warn('⚠️ [NFTScan] API key not found in environment variables');
    } else {
      console.log('✅ [NFTScan] Service initialized with API key');
      this.initializeClients();
    }
  }

  private initializeClients() {
    try {
      // Initialize EVM chain clients
      this.evmClients.set('eth', new NftscanEvm({ apiKey: this.apiKey, chain: EvmChain.ETH }));
      this.evmClients.set('bnb', new NftscanEvm({ apiKey: this.apiKey, chain: EvmChain.BNB }));
      this.evmClients.set('polygon', new NftscanEvm({ apiKey: this.apiKey, chain: EvmChain.POLYGON }));
      this.evmClients.set('arbitrum', new NftscanEvm({ apiKey: this.apiKey, chain: EvmChain.ARBITRUM }));
      this.evmClients.set('optimism', new NftscanEvm({ apiKey: this.apiKey, chain: EvmChain.OPTIMISM }));
      this.evmClients.set('base', new NftscanEvm({ apiKey: this.apiKey, chain: EvmChain.BASE }));
      this.evmClients.set('mantle', new NftscanEvm({ apiKey: this.apiKey, chain: EvmChain.MANTLE }));
      
      // Initialize Solana client
      this.solanaClient = new NftscanSolana({ apiKey: this.apiKey });

      console.log(`✅ [NFTScan] Initialized clients for ${this.evmClients.size} EVM chains + Solana`);
    } catch (error) {
      console.error('❌ [NFTScan] Failed to initialize clients:', error);
    }
  }

  private getClient(chain: string): NftscanEvm | NftscanSolana | null {
    if (chain === 'solana') {
      return this.solanaClient;
    }
    return this.evmClients.get(chain) || null;
  }

  // Get trending collections (by volume)
  async getTrendingCollections(chain: string, limit: number = 20) {
    try {
      const client = this.getClient(chain);
      if (!client) {
        throw new Error(`Chain ${chain} not supported`);
      }

      console.log(`📊 [NFTScan] Fetching trending collections for ${chain}...`);

      if (chain === 'solana') {
        // Solana API
        const response = await (client as NftscanSolana).statistic.getCollectionRanking({
          time: '24h',
          sort_field: 'volume',
          sort_direction: 'desc',
          limit: limit.toString()
        });
        
        return this.transformSolanaCollections(response.data || []);
      } else {
        // EVM chains API
        const response = await (client as NftscanEvm).statistic.getCollectionRanking({
          time: '24h',
          sort_field: 'volume',
          sort_direction: 'desc',
          limit: limit.toString()
        });
        
        return this.transformEvmCollections(response.data || [], chain);
      }
    } catch (error) {
      console.error(`❌ [NFTScan] Error fetching trending collections for ${chain}:`, error);
      return [];
    }
  }

  // Get collections by sales
  async getTopSalesCollections(chain: string, limit: number = 20) {
    try {
      const client = this.getClient(chain);
      if (!client) {
        throw new Error(`Chain ${chain} not supported`);
      }

      console.log(`📈 [NFTScan] Fetching top sales collections for ${chain}...`);

      if (chain === 'solana') {
        const response = await (client as NftscanSolana).statistic.getCollectionRanking({
          time: '24h',
          sort_field: 'sales',
          sort_direction: 'desc',
          limit: limit.toString()
        });
        
        return this.transformSolanaCollections(response.data || []);
      } else {
        const response = await (client as NftscanEvm).statistic.getCollectionRanking({
          time: '24h',
          sort_field: 'sales',
          sort_direction: 'desc',
          limit: limit.toString()
        });
        
        return this.transformEvmCollections(response.data || [], chain);
      }
    } catch (error) {
      console.error(`❌ [NFTScan] Error fetching top sales collections for ${chain}:`, error);
      return [];
    }
  }

  // Search collections
  async searchCollections(chain: string, query: string, limit: number = 10) {
    try {
      const client = this.getClient(chain);
      if (!client) {
        throw new Error(`Chain ${chain} not supported`);
      }

      console.log(`🔍 [NFTScan] Searching collections for "${query}" on ${chain}...`);

      if (chain === 'solana') {
        const response = await (client as NftscanSolana).collection.searchCollection({
          collection: query,
          limit: limit.toString()
        });
        
        return this.transformSolanaCollections(response.data || []);
      } else {
        const response = await (client as NftscanEvm).collection.searchCollection({
          collection: query,
          limit: limit.toString()
        });
        
        return this.transformEvmCollections(response.data || [], chain);
      }
    } catch (error) {
      console.error(`❌ [NFTScan] Error searching collections for ${chain}:`, error);
      return [];
    }
  }

  // Get collection details
  async getCollectionDetails(chain: string, contractAddress: string) {
    try {
      const client = this.getClient(chain);
      if (!client) {
        throw new Error(`Chain ${chain} not supported`);
      }

      console.log(`📖 [NFTScan] Fetching collection details for ${contractAddress} on ${chain}...`);

      if (chain === 'solana') {
        const response = await (client as NftscanSolana).collection.getCollectionsByContract(contractAddress);
        return response.data;
      } else {
        const response = await (client as NftscanEvm).collection.getCollectionsByContract(contractAddress);
        return response.data;
      }
    } catch (error) {
      console.error(`❌ [NFTScan] Error fetching collection details for ${chain}:`, error);
      return null;
    }
  }

  // Get NFTs from collection
  async getCollectionNFTs(chain: string, contractAddress: string, cursor: string = '', limit: number = 20) {
    try {
      const client = this.getClient(chain);
      if (!client) {
        throw new Error(`Chain ${chain} not supported`);
      }

      console.log(`🎨 [NFTScan] Fetching NFTs for collection ${contractAddress} on ${chain}...`);

      if (chain === 'solana') {
        const response = await (client as NftscanSolana).asset.getAssetsByCollection({
          collection: contractAddress,
          cursor,
          limit: limit.toString()
        });
        
        return {
          nfts: response.data || [],
          next: response.next || null
        };
      } else {
        const response = await (client as NftscanEvm).asset.queryAssetsInCollection({
          contract_address: contractAddress,
          cursor,
          limit: limit.toString()
        });
        
        return {
          nfts: response.data || [],
          next: response.next || null
        };
      }
    } catch (error) {
      console.error(`❌ [NFTScan] Error fetching NFTs for collection ${chain}:`, error);
      return { nfts: [], next: null };
    }
  }

  // Get account NFTs
  async getAccountNFTs(chain: string, accountAddress: string, cursor: string = '', limit: number = 20) {
    try {
      const client = this.getClient(chain);
      if (!client) {
        throw new Error(`Chain ${chain} not supported`);
      }

      console.log(`👤 [NFTScan] Fetching NFTs for account ${accountAddress} on ${chain}...`);

      if (chain === 'solana') {
        const response = await (client as NftscanSolana).asset.getAssetsByAccount({
          account_address: accountAddress,
          cursor,
          limit: limit.toString()
        });
        
        return {
          nfts: response.data || [],
          next: response.next || null
        };
      } else {
        const response = await (client as NftscanEvm).asset.getAssetsByAccount(accountAddress, {
          erc_type: ErcType.ERC_721,
          cursor,
          limit: limit.toString()
        });
        
        return {
          nfts: response.data || [],
          next: response.next || null
        };
      }
    } catch (error) {
      console.error(`❌ [NFTScan] Error fetching account NFTs for ${chain}:`, error);
      return { nfts: [], next: null };
    }
  }

  // Transform EVM collection data to match UI format
  private transformEvmCollections(collections: any[], chain: string) {
    return collections.map((col: any) => ({
      contractAddress: col.contract_address,
      name: col.name || col.collection,
      symbol: col.symbol || '',
      description: col.description || '',
      image: col.logo_url || col.image_url || col.banner_url || '',
      bannerImage: col.banner_url || col.image_url || '',
      verified: col.verified || false,
      volume: col.volume_24h || col.volume || '0',
      volume_usd: col.volume_24h_usd || '0',
      floorPrice: col.floor_price || '0',
      sales24h: col.sales_24h || 0,
      sales_count: col.sales_24h || 0,
      owners: col.owners_count || 0,
      items: col.items_total || 0,
      chain: chain,
      chainMetadata: CHAIN_METADATA[chain as keyof typeof CHAIN_METADATA]
    }));
  }

  // Transform Solana collection data to match UI format
  private transformSolanaCollections(collections: any[]) {
    return collections.map((col: any) => ({
      contractAddress: col.collection || col.contract_address,
      name: col.name || col.collection,
      symbol: col.symbol || '',
      description: col.description || '',
      image: col.logo_url || col.image_url || '',
      bannerImage: col.banner_url || col.image_url || '',
      verified: col.verified || false,
      volume: col.volume_24h || col.volume || '0',
      volume_usd: col.volume_24h_usd || '0',
      floorPrice: col.floor_price || '0',
      sales24h: col.sales_24h || 0,
      sales_count: col.sales_24h || 0,
      owners: col.owners_count || 0,
      items: col.items_total || 0,
      chain: 'solana',
      chainMetadata: CHAIN_METADATA.solana
    }));
  }
}

// Export singleton instance
export const nftScanService = new NFTScanService();
