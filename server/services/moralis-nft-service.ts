import Moralis from 'moralis';
import { EvmChain } from '@moralisweb3/common-evm-utils';

// Chain configuration for Moralis (EVM chains)
export const MORALIS_CHAINS = {
  eth: { chain: EvmChain.ETHEREUM, name: 'Ethereum', symbol: 'ETH', icon: 'https://token-icons.s3.amazonaws.com/eth.png', color: '#627EEA', isEvm: true },
  bnb: { chain: EvmChain.BSC, name: 'BNB Chain', symbol: 'BNB', icon: 'https://token-icons.s3.amazonaws.com/0x0000000000000000000000000000000000000000.png', color: '#F3BA2F', isEvm: true },
  polygon: { chain: EvmChain.POLYGON, name: 'Polygon', symbol: 'MATIC', icon: 'https://token-icons.s3.amazonaws.com/matic.png', color: '#8247E5', isEvm: true },
  arbitrum: { chain: EvmChain.ARBITRUM, name: 'Arbitrum', symbol: 'ARB', icon: 'https://token-icons.s3.amazonaws.com/arb.png', color: '#28A0F0', isEvm: true },
  optimism: { chain: EvmChain.OPTIMISM, name: 'Optimism', symbol: 'OP', icon: 'https://token-icons.s3.amazonaws.com/op.png', color: '#FF0420', isEvm: true },
  base: { chain: EvmChain.BASE, name: 'Base', symbol: 'ETH', icon: 'https://token-icons.s3.amazonaws.com/base.png', color: '#0052FF', isEvm: true },
  avalanche: { chain: EvmChain.AVALANCHE, name: 'Avalanche', symbol: 'AVAX', icon: 'https://token-icons.s3.amazonaws.com/avax.png', color: '#E84142', isEvm: true },
  linea: { chain: EvmChain.LINEA, name: 'Linea', symbol: 'ETH', icon: 'https://token-icons.s3.amazonaws.com/linea.png', color: '#121212', isEvm: true },
  // Non-EVM chains
  sol: { network: 'mainnet', name: 'Solana', symbol: 'SOL', icon: 'https://token-icons.s3.amazonaws.com/sol.png', color: '#14F195', isEvm: false },
} as const;

export type MoralisChainId = keyof typeof MORALIS_CHAINS;

interface NFTCollection {
  contractAddress: string;
  name: string;
  symbol?: string;
  description?: string;
  image: string;
  bannerImage?: string;
  verified: boolean;
  volume24h?: string;
  floorPrice?: string;
  sales24h?: number;
  owners?: number;
  items?: number;
  chain: string;
  chainMetadata: typeof MORALIS_CHAINS[MoralisChainId];
}

class MoralisNFTService {
  private isInitialized = false;
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.MORALIS_API_KEY || '';
    
    if (!this.apiKey) {
      console.warn('⚠️ [Moralis] API key not found in environment variables');
    } else {
      console.log('✅ [Moralis] Service initializing...');
      this.initialize();
    }
  }

  private async initialize() {
    if (this.isInitialized) return;

    try {
      await Moralis.start({
        apiKey: this.apiKey,
      });
      this.isInitialized = true;
      console.log('✅ [Moralis] Service initialized successfully');
    } catch (error) {
      console.error('❌ [Moralis] Failed to initialize:', error);
    }
  }

  private async ensureInitialized() {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  // Get trending NFT collections (uses curated popular list)
  async getTrendingCollections(chainId: MoralisChainId, limit: number = 20): Promise<NFTCollection[]> {
    await this.ensureInitialized();

    try {
      const chainConfig = MORALIS_CHAINS[chainId];
      console.log(`📊 [Moralis] Fetching trending collections for ${chainConfig.name}...`);

      // Use popular collections method (curated list)
      return await this.getPopularCollections(chainId, limit);
    } catch (error) {
      console.error(`❌ [Moralis] Error fetching trending for ${chainId}:`, error);
      return [];
    }
  }

  // Search NFT collections by name (simplified - returns popular collections for now)
  async searchCollections(chainId: MoralisChainId, query: string, limit: number = 10): Promise<NFTCollection[]> {
    await this.ensureInitialized();

    try {
      const chainConfig = MORALIS_CHAINS[chainId];
      console.log(`🔍 [Moralis] Searching for "${query}" on ${chainConfig.name}...`);

      // Simplified search: filter popular collections by name
      const popularCollections = await this.getPopularCollections(chainId, 20);
      const filtered = popularCollections.filter(col => 
        col.name.toLowerCase().includes(query.toLowerCase()) ||
        col.symbol?.toLowerCase().includes(query.toLowerCase())
      );

      console.log(`✅ [Moralis] Found ${filtered.length} matching collections`);
      return filtered.slice(0, limit);
    } catch (error) {
      console.error(`❌ [Moralis] Search error for ${chainId}:`, error);
      return [];
    }
  }

  // Get NFTs from a specific wallet (useful for trending/popular)
  async getWalletNFTs(chainId: MoralisChainId, walletAddress: string, limit: number = 20): Promise<any[]> {
    await this.ensureInitialized();

    try {
      const chainConfig = MORALIS_CHAINS[chainId];
      console.log(`👤 [Moralis] Fetching NFTs for wallet on ${chainConfig.name}...`);

      if (chainConfig.isEvm) {
        const response = await Moralis.EvmApi.nft.getWalletNFTs({
          chain: chainConfig.chain,
          address: walletAddress,
          limit,
        });
        return response.raw.result || [];
      } else {
        // Solana
        const response = await Moralis.SolApi.account.getNFTs({
          network: 'mainnet' as any, // Solana uses mainnet network
          address: walletAddress,
        });
        const result = response.toJSON();
        return (Array.isArray(result) ? result : []).slice(0, limit);
      }
    } catch (error) {
      console.error(`❌ [Moralis] Error fetching wallet NFTs:`, error);
      return [];
    }
  }

  // Get NFT collection metadata
  async getCollectionMetadata(chainId: MoralisChainId, contractAddress: string): Promise<any> {
    await this.ensureInitialized();

    try {
      const chainConfig = MORALIS_CHAINS[chainId];
      console.log(`📖 [Moralis] Fetching collection metadata for ${contractAddress}...`);

      if (chainConfig.isEvm) {
        const response = await Moralis.EvmApi.nft.getNFTContractMetadata({
          chain: chainConfig.chain,
          address: contractAddress,
        });
        return response ? response.raw : null;
      } else {
        // Solana - return basic metadata
        return {
          name: contractAddress.slice(0, 8),
          symbol: 'SOL',
          contractType: 'SOLANA',
        };
      }
    } catch (error) {
      console.error(`❌ [Moralis] Error fetching collection metadata:`, error);
      return null;
    }
  }

  // Get NFTs from a collection
  async getCollectionNFTs(chainId: MoralisChainId, contractAddress: string, cursor?: string, limit: number = 20): Promise<{ nfts: any[], cursor: string | null }> {
    await this.ensureInitialized();

    try {
      const chainConfig = MORALIS_CHAINS[chainId];
      console.log(`🎨 [Moralis] Fetching NFTs for collection ${contractAddress}...`);

      if (chainConfig.isEvm) {
        const response = await Moralis.EvmApi.nft.getContractNFTs({
          chain: chainConfig.chain,
          address: contractAddress,
          limit,
          cursor: cursor || undefined,
        });

        return {
          nfts: response.raw.result || [],
          cursor: response.raw.cursor || null,
        };
      } else {
        // Solana - not directly supported for collection-specific queries
        return { nfts: [], cursor: null };
      }
    } catch (error) {
      console.error(`❌ [Moralis] Error fetching collection NFTs:`, error);
      return { nfts: [], cursor: null };
    }
  }

  // Get NFT transfers (useful for sales data)
  async getNFTTransfers(chainId: MoralisChainId, contractAddress: string, limit: number = 20): Promise<any[]> {
    await this.ensureInitialized();

    try {
      const chainConfig = MORALIS_CHAINS[chainId];
      console.log(`📊 [Moralis] Fetching transfers for ${contractAddress}...`);

      if (chainConfig.isEvm) {
        const response = await Moralis.EvmApi.nft.getNFTContractTransfers({
          chain: chainConfig.chain,
          address: contractAddress,
          limit,
        });
        return response.raw.result || [];
      } else {
        // Solana - not directly supported for transfer queries
        return [];
      }
    } catch (error) {
      console.error(`❌ [Moralis] Error fetching transfers:`, error);
      return [];
    }
  }

  // Get NFT trades (marketplace activity)
  async getNFTTrades(chainId: MoralisChainId, contractAddress: string, limit: number = 20): Promise<any[]> {
    await this.ensureInitialized();

    try {
      const chainConfig = MORALIS_CHAINS[chainId];
      console.log(`💰 [Moralis] Fetching trades for ${contractAddress}...`);

      if (chainConfig.isEvm) {
        const response = await Moralis.EvmApi.nft.getNFTTrades({
          chain: chainConfig.chain,
          address: contractAddress,
          limit,
          marketplace: 'opensea', // Can also use 'blur', 'looksrare', etc.
        });

        const result = response.toJSON();
        return Array.isArray(result) ? result : (result.result || []);
      } else {
        // Solana - not directly supported
        return [];
      }
    } catch (error) {
      console.error(`❌ [Moralis] Error fetching trades:`, error);
      return [];
    }
  }

  // Helper: Extract image URL from NFT metadata
  private extractImageUrl(metadata: any): string {
    if (!metadata) return '';
    
    const metadataObj = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
    
    return metadataObj?.image || 
           metadataObj?.image_url || 
           metadataObj?.imageUrl || 
           '';
  }

  // Get popular collections (curated list for now - can be enhanced with caching)
  async getPopularCollections(chainId: MoralisChainId, limit: number = 20): Promise<NFTCollection[]> {
    // For now, return empty - we'll populate this with well-known collection addresses
    // In production, you'd maintain a list of popular collections per chain
    console.log(`📈 [Moralis] Getting popular collections for ${chainId}...`);
    
    const chainConfig = MORALIS_CHAINS[chainId];
    const popularContracts = this.getPopularContractAddresses(chainId);
    
    const collections: NFTCollection[] = [];
    
    for (const contractAddress of popularContracts.slice(0, limit)) {
      try {
        const response = await this.getCollectionMetadata(chainId, contractAddress);
        if (response) {
          // Extract image from Moralis actual response structure
          // Moralis getNFTContractMetadata returns data in contract_metadata field
          const imageUrl = response.contract_metadata?.image ||
                          response.contract_metadata?.image_url ||
                          response.contract_metadata?.logo ||
                          response.contract_metadata?.banner_image ||
                          '';
          
          collections.push({
            contractAddress,
            name: response.name || response.contract_metadata?.name || 'Unknown',
            symbol: response.symbol || response.contract_metadata?.symbol || '',
            description: response.contract_metadata?.description || '',
            image: imageUrl,
            verified: response.verified_collection || false,
            chain: chainId,
            chainMetadata: chainConfig,
          });
        }
      } catch (error) {
        console.error(`Error fetching collection ${contractAddress}:`, error);
      }
    }
    
    return collections;
  }

  // Helper: Get popular contract addresses per chain (verified curated list)
  // NOTE: In production, these should be fetched dynamically from Moralis' trending collections API
  // or maintained in a database. Only verified contracts from web search are included.
  private getPopularContractAddresses(chainId: MoralisChainId): string[] {
    const popularContracts: Record<MoralisChainId, string[]> = {
      // Ethereum - Well-known verified collections
      eth: [
        '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D', // BAYC (Bored Ape Yacht Club)
        '0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB', // CryptoPunks
        '0x60E4d786628Fea6478F785A6d7e704777c86a7c6', // MAYC (Mutant Ape Yacht Club)
        '0xED5AF388653567Af2F388E6224dC7C4b3241C544', // Azuki
        '0x49cF6f5d44E70224e2E23fDcdd2C053F30aDA28B', // CloneX
        '0x23581767a106ae21c074b2276D25e5C3e136a68b', // Moonbirds
        '0x8a90CAb2b38dba80c64b7734e58Ee1dB38B8992e', // Doodles
      ],
      // BNB Chain - Verified from web search
      bnb: [
        '0x0a8901b0e25deb55a87524f0cc164e9644020eba', // Pancake Squad (verified on BscScan)
      ],
      // Polygon - Popular collections
      polygon: [
        '0x2953399124F0cBB46d2CbACD8A89cF0599974963', // OpenSea Polygon Collections
        '0x76BE3b62873462d2142405439777e971754E8E77', // Aavegotchi
      ],
      // Arbitrum - Popular from Treasure ecosystem (addresses need verification via Arbiscan)
      arbitrum: [],
      // Optimism - Limited ecosystem, needs verification
      optimism: [],
      // Base - Newer chain, needs community verification  
      base: [],
      // Avalanche - Needs verification via Snowtrace
      avalanche: [],
      // Linea - Newer chain, official collections need verification
      linea: [],
      // Solana - Popular collections (wallet addresses for now)
      sol: [],
    };

    return popularContracts[chainId] || [];
  }
}

// Export singleton instance
export const moralisNFTService = new MoralisNFTService();
