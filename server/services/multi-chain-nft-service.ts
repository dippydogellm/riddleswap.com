import { ethers } from 'ethers';
import { Connection, PublicKey } from '@solana/web3.js';
import { CHAIN_CONFIGS, type ChainKey } from '../bridge/multi-chain-bridge-routes';

// ERC-721 Standard ABI for NFT metadata
const ERC721_METADATA_ABI = [
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function balanceOf(address owner) view returns (uint256)'
];

// ERC-1155 Standard ABI
const ERC1155_METADATA_ABI = [
  'function uri(uint256 tokenId) view returns (string)',
  'function balanceOf(address account, uint256 id) view returns (uint256)'
];

export interface NFTMetadata {
  name?: string;
  description?: string;
  image?: string;
  animation_url?: string;
  external_url?: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
}

export interface MultiChainNFT {
  chain: string;
  chainId?: number;
  contractAddress: string;
  tokenId: string;
  owner: string;
  tokenURI?: string;
  metadata?: NFTMetadata;
  standard?: 'ERC721' | 'ERC1155' | 'SPL' | 'XRPL';
}

export class MultiChainNFTService {
  
  /**
   * Fetch NFT metadata from tokenURI (handles IPFS, HTTP, data URIs)
   */
  private async fetchMetadataFromURI(uri: string): Promise<NFTMetadata | null> {
    try {
      // Handle IPFS URIs
      if (uri.startsWith('ipfs://')) {
        const ipfsHash = uri.replace('ipfs://', '');
        uri = `https://ipfs.io/ipfs/${ipfsHash}`;
      }
      
      // Handle Arweave URIs
      if (uri.startsWith('ar://')) {
        const arweaveId = uri.replace('ar://', '');
        uri = `https://arweave.net/${arweaveId}`;
      }
      
      // Handle data URIs (base64 encoded JSON)
      if (uri.startsWith('data:application/json;base64,')) {
        const base64Data = uri.split(',')[1];
        const jsonString = Buffer.from(base64Data, 'base64').toString('utf-8');
        return JSON.parse(jsonString);
      }
      
      // Fetch from HTTP/HTTPS
      const response = await fetch(uri, {
        headers: {
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(10000) // 10s timeout
      });
      
      if (!response.ok) {
        console.error(`❌ Failed to fetch metadata from ${uri}: ${response.status}`);
        return null;
      }
      
      const metadata = await response.json() as any;
      
      // Process image URL if it's IPFS
      if (metadata.image && metadata.image.startsWith('ipfs://')) {
        const ipfsHash = metadata.image.replace('ipfs://', '');
        metadata.image = `https://ipfs.io/ipfs/${ipfsHash}`;
      }
      
      return metadata;
    } catch (error) {
      console.error(`❌ Error fetching metadata from ${uri}:`, error);
      return null;
    }
  }

  /**
   * Get EVM NFT data (ERC-721 or ERC-1155)
   */
  async getEVMNFT(
    chainKey: ChainKey,
    contractAddress: string,
    tokenId: string,
    owner?: string
  ): Promise<MultiChainNFT | null> {
    try {
      const chainConfig = CHAIN_CONFIGS[chainKey];
      if (!('chainId' in chainConfig)) {
        throw new Error(`${chainKey} is not an EVM chain`);
      }

      const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);
      
      // Try ERC-721 first
      try {
        const nftContract = new ethers.Contract(contractAddress, ERC721_METADATA_ABI, provider);
        
        const [tokenURI, nftOwner, name, symbol] = await Promise.all([
          nftContract.tokenURI(tokenId).catch(() => null),
          nftContract.ownerOf(tokenId).catch(() => null),
          nftContract.name().catch(() => 'Unknown'),
          nftContract.symbol().catch(() => 'NFT')
        ]);

        let metadata: NFTMetadata | null = null;
        if (tokenURI) {
          metadata = await this.fetchMetadataFromURI(tokenURI);
        }

        // Use collection name + token ID if no metadata name
        if (metadata && !metadata.name) {
          metadata.name = `${name} #${tokenId}`;
        }

        return {
          chain: chainConfig.name,
          chainId: chainConfig.chainId,
          contractAddress,
          tokenId,
          owner: nftOwner || owner || '',
          tokenURI: tokenURI || undefined,
          metadata: metadata || { name: `${name} #${tokenId}` },
          standard: 'ERC721'
        };
      } catch (erc721Error) {
        // Try ERC-1155
        try {
          const nftContract = new ethers.Contract(contractAddress, ERC1155_METADATA_ABI, provider);
          
          const uri = await nftContract.uri(tokenId);
          let metadata: NFTMetadata | null = null;
          
          if (uri) {
            // Replace {id} placeholder with actual token ID (ERC-1155 standard)
            const tokenURI = uri.replace('{id}', tokenId.toString().padStart(64, '0'));
            metadata = await this.fetchMetadataFromURI(tokenURI);
          }

          return {
            chain: chainConfig.name,
            chainId: chainConfig.chainId,
            contractAddress,
            tokenId,
            owner: owner || '',
            tokenURI: uri || undefined,
            metadata: metadata || { name: `NFT #${tokenId}` },
            standard: 'ERC1155'
          };
        } catch (erc1155Error) {
          console.error(`❌ Failed to fetch NFT as ERC-721 or ERC-1155:`, erc1155Error);
          return null;
        }
      }
    } catch (error) {
      console.error(`❌ Error fetching EVM NFT on ${chainKey}:`, error);
      return null;
    }
  }

  /**
   * Get Solana NFT data (Metaplex standard)
   */
  async getSolanaNFT(mintAddress: string): Promise<MultiChainNFT | null> {
    try {
      const connection = new Connection(CHAIN_CONFIGS.solana.rpcUrl);
      const mintPubkey = new PublicKey(mintAddress);
      
      // Get account info
      const accountInfo = await connection.getAccountInfo(mintPubkey);
      if (!accountInfo) {
        console.error(`❌ No account found for mint: ${mintAddress}`);
        return null;
      }

      // For Metaplex NFTs, we need to fetch metadata account
      // Metadata PDA is derived from: [metadata, program_id, mint_address]
      const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
      const [metadataPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('metadata'),
          METADATA_PROGRAM_ID.toBuffer(),
          mintPubkey.toBuffer()
        ],
        METADATA_PROGRAM_ID
      );

      const metadataAccount = await connection.getAccountInfo(metadataPDA);
      if (!metadataAccount) {
        console.error(`❌ No metadata account found for mint: ${mintAddress}`);
        return null;
      }

      // Parse Metaplex metadata (simplified - full implementation would use @metaplex-foundation/mpl-token-metadata)
      // The URI is typically at bytes 65-165 (after header and name/symbol)
      const data = metadataAccount.data;
      let uri = '';
      try {
        // Extract URI from metadata account data (simplified parsing)
        const uriStart = 4 + 32 + 32 + 4; // Skip header fields
        const uriLength = data.readUInt32LE(uriStart);
        uri = data.slice(uriStart + 4, uriStart + 4 + uriLength).toString('utf-8');
      } catch (parseError) {
        console.error('❌ Failed to parse Solana metadata:', parseError);
      }

      let metadata: NFTMetadata | null = null;
      if (uri) {
        metadata = await this.fetchMetadataFromURI(uri);
      }

      return {
        chain: 'Solana',
        contractAddress: mintAddress,
        tokenId: '0', // Solana NFTs don't have token IDs, just mint addresses
        owner: '', // Would need additional query to get current owner
        tokenURI: uri || undefined,
        metadata: metadata || { name: `Solana NFT ${mintAddress.slice(0, 8)}...` },
        standard: 'SPL'
      };
    } catch (error) {
      console.error(`❌ Error fetching Solana NFT:`, error);
      return null;
    }
  }

  /**
   * Get NFT data for any supported chain
   */
  async getNFT(
    chain: string,
    contractAddress: string,
    tokenId: string,
    owner?: string
  ): Promise<MultiChainNFT | null> {
    const chainKey = chain.toLowerCase() as ChainKey;
    
    if (chainKey === 'solana') {
      return this.getSolanaNFT(contractAddress);
    } else if (chainKey === 'xrpl') {
      // XRPL NFTs are handled by the existing nft-service.ts
      return null;
    } else {
      return this.getEVMNFT(chainKey, contractAddress, tokenId, owner);
    }
  }

  /**
   * Batch fetch NFTs for a wallet across a specific chain
   */
  async getWalletNFTs(chain: string, walletAddress: string): Promise<MultiChainNFT[]> {
    const chainKey = chain.toLowerCase() as ChainKey;
    const nfts: MultiChainNFT[] = [];

    if (chainKey === 'solana') {
      // For Solana, we'd need to query all token accounts and filter for NFTs
      // This requires additional Metaplex SDK integration
      console.log('⚠️ Solana wallet NFT fetching requires Metaplex SDK');
      return [];
    } else if (chainKey === 'xrpl') {
      // XRPL is handled separately
      return [];
    } else {
      // For EVM chains, we'd need to use indexing services like:
      // - Alchemy NFT API
      // - Moralis NFT API
      // - OpenSea API
      // - Reservoir API
      console.log('⚠️ EVM wallet NFT fetching requires indexing service (Alchemy/Moralis/OpenSea)');
      return [];
    }
  }
}

export const multiChainNFTService = new MultiChainNFTService();
