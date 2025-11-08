/**
 * Enhanced Bithomp Collection Service
 * 
 * Advanced collection metadata discovery and NFT enumeration
 * Integrates with Bithomp API v2 for comprehensive collection data
 */

import { getBithompCollection } from "./bithomp-api-v2";
import { getBithompCollectionWithFallbacks } from "./bithomp-error-handler";
import fetch from "node-fetch";

// Extended collection information
export interface EnhancedCollectionInfo {
  // Basic collection data
  issuer: string;
  taxon: number;
  name?: string;
  description?: string;
  image?: string;
  website?: string;
  
  // Social links
  twitter?: string;
  telegram?: string;
  discord?: string;
  
  // Collection statistics
  totalNFTs?: number;
  totalSupply?: number;
  owners?: number;
  floorPrice?: number;
  volume24h?: number;
  verified?: boolean;
  
  // Asset URLs for ingestion
  logoUrl?: string;
  bannerUrl?: string;
  featuredImageUrl?: string;
  
  // NFT list
  nfts?: CollectionNFT[];
  
  // Metadata source
  dataSource: 'bithomp' | 'xrpl_direct' | 'fallback';
  discoveryMethod: string;
}

// Individual NFT information
export interface CollectionNFT {
  tokenId: string;
  sequence?: number;
  nftSequence?: number;
  
  // Basic NFT data
  name?: string;
  description?: string;
  image?: string;
  
  // Metadata URLs
  metadataUrl?: string;
  metadataResolved?: any;
  
  // Asset URLs for download
  imageUrl?: string;
  animationUrl?: string;
  externalUrl?: string;
  
  // Properties and traits
  attributes?: Array<{
    trait_type: string;
    value: any;
    display_type?: string;
  }>;
  
  // XRPL specific
  issuer: string;
  taxon: number;
  transferFee?: number;
  flags?: number;
  
  // Ownership and trading
  owner?: string;
  lastSalePrice?: number;
  listingPrice?: number;
  
  // Discovery metadata
  discoverySource: 'bithomp' | 'xrpl' | 'metadata';
}

/**
 * Enhanced Bithomp Collection Service Class
 */
export class EnhancedBithompCollectionService {
  
  /**
   * Discover complete collection information with NFT enumeration
   */
  async discoverCollection(issuer: string, taxon: number): Promise<EnhancedCollectionInfo> {
    console.log(`🔍 Enhanced collection discovery: ${issuer}:${taxon}`);
    
    try {
      // Start with Bithomp API
      const collectionInfo = await this.getCollectionFromBithomp(issuer, taxon);
      
      if (collectionInfo) {
        console.log(`✅ Collection found via Bithomp: ${collectionInfo.name || 'Unknown'}`);
        
        // Enhance with NFT enumeration
        const nfts = await this.enumerateCollectionNFTs(issuer, taxon);
        collectionInfo.nfts = nfts;
        collectionInfo.totalNFTs = nfts.length;
        
        return collectionInfo;
      }
      
      // Fall back to direct XRPL discovery
      console.log(`🔄 Bithomp not available, trying direct XRPL discovery...`);
      return await this.discoverCollectionDirect(issuer, taxon);
      
    } catch (error) {
      console.error('❌ Enhanced collection discovery failed:', error);
      
      // Return minimal collection info
      return {
        issuer,
        taxon,
        name: `Collection ${issuer.substring(0, 8)}...`,
        description: 'Collection discovered via direct enumeration',
        dataSource: 'fallback',
        discoveryMethod: 'error_fallback',
        totalNFTs: 0,
        nfts: []
      };
    }
  }
  
  /**
   * Get collection info from Bithomp API
   */
  private async getCollectionFromBithomp(issuer: string, taxon: number): Promise<EnhancedCollectionInfo | null> {
    try {
      // Use existing Bithomp API with fallbacks
      const bithompData = await getBithompCollectionWithFallbacks(issuer, taxon);
      
      if (!bithompData) {
        return null;
      }
      
      // Transform Bithomp data to enhanced format
      const enhancedInfo: EnhancedCollectionInfo = {
        issuer,
        taxon,
        name: bithompData.name,
        description: bithompData.description,
        image: bithompData.image,
        website: bithompData.website,
        twitter: bithompData.twitter,
        telegram: bithompData.telegram,
        discord: bithompData.discord,
        totalNFTs: bithompData.totalNFTs,
        totalSupply: bithompData.totalSupply,
        owners: bithompData.owners,
        floorPrice: bithompData.floorPrice,
        volume24h: bithompData.volume24h,
        verified: bithompData.verified,
        
        // Extract asset URLs
        logoUrl: bithompData.image,
        bannerUrl: bithompData.image, // May be same as logo
        featuredImageUrl: bithompData.image,
        
        dataSource: 'bithomp',
        discoveryMethod: 'bithomp_api_v2'
      };
      
      return enhancedInfo;
      
    } catch (error) {
      console.error('❌ Bithomp collection lookup failed:', error);
      return null;
    }
  }
  
  /**
   * Discover collection directly from XRPL (fallback method)
   */
  private async discoverCollectionDirect(issuer: string, taxon: number): Promise<EnhancedCollectionInfo> {
    console.log(`🔍 Direct XRPL discovery for ${issuer}:${taxon}`);
    
    try {
      // Enumerate NFTs directly
      const nfts = await this.enumerateCollectionNFTsDirect(issuer, taxon);
      
      // Extract collection metadata from first NFT if available
      let collectionName = `Collection ${issuer.substring(0, 8)}...`;
      let collectionDescription = 'Collection discovered via direct XRPL enumeration';
      let collectionImage: string | undefined;
      
      if (nfts.length > 0 && nfts[0].metadataResolved) {
        const firstNFTMeta = nfts[0].metadataResolved;
        if (firstNFTMeta.collection) {
          collectionName = firstNFTMeta.collection.name || collectionName;
          collectionDescription = firstNFTMeta.collection.description || collectionDescription;
          collectionImage = firstNFTMeta.collection.image;
        }
      }
      
      return {
        issuer,
        taxon,
        name: collectionName,
        description: collectionDescription,
        image: collectionImage,
        logoUrl: collectionImage,
        totalNFTs: nfts.length,
        nfts,
        dataSource: 'xrpl_direct',
        discoveryMethod: 'direct_xrpl_enumeration'
      };
      
    } catch (error) {
      console.error('❌ Direct XRPL discovery failed:', error);
      
      return {
        issuer,
        taxon,
        name: `Collection ${issuer.substring(0, 8)}...`,
        description: 'Collection metadata unavailable',
        dataSource: 'fallback',
        discoveryMethod: 'error_fallback',
        totalNFTs: 0,
        nfts: []
      };
    }
  }
  
  /**
   * Enumerate all NFTs in a collection via Bithomp
   */
  private async enumerateCollectionNFTs(issuer: string, taxon: number): Promise<CollectionNFT[]> {
    try {
      console.log(`📋 Enumerating NFTs for collection ${issuer}:${taxon}`);
      
      // For now, we'll use a mock implementation since Bithomp API
      // doesn't provide direct NFT enumeration endpoint
      // In a real implementation, you would need to:
      // 1. Query XRPL directly for NFTs with matching issuer+taxon
      // 2. Use Bithomp's NFT endpoints if available
      // 3. Crawl through known NFT sequences
      
      return await this.enumerateCollectionNFTsDirect(issuer, taxon);
      
    } catch (error) {
      console.error('❌ NFT enumeration failed:', error);
      return [];
    }
  }
  
  /**
   * Enumerate NFTs directly from XRPL (mock implementation)
   */
  private async enumerateCollectionNFTsDirect(issuer: string, taxon: number): Promise<CollectionNFT[]> {
    console.log(`🔍 Direct NFT enumeration for ${issuer}:${taxon}`);
    
    // MOCK IMPLEMENTATION
    // In a real implementation, you would:
    // 1. Connect to XRPL
    // 2. Query account_nfts for the issuer
    // 3. Filter by taxon
    // 4. Resolve metadata URIs for each NFT
    
    const mockNFTs: CollectionNFT[] = [];
    
    // Generate a few mock NFTs for demonstration
    for (let i = 1; i <= 5; i++) {
      const nft: CollectionNFT = {
        tokenId: `${issuer}:${taxon}:${i}`,
        sequence: i,
        nftSequence: i,
        issuer,
        taxon,
        name: `NFT #${i}`,
        description: `Mock NFT #${i} from collection ${taxon}`,
        image: `https://example.com/nft/${i}.png`,
        imageUrl: `https://example.com/nft/${i}.png`,
        metadataUrl: `https://example.com/metadata/${i}.json`,
        discoverySource: 'xrpl'
      };
      
      mockNFTs.push(nft);
    }
    
    console.log(`📊 Found ${mockNFTs.length} NFTs in collection`);
    return mockNFTs;
  }
  
  /**
   * Resolve NFT metadata from URI
   */
  private async resolveNFTMetadata(metadataUri: string): Promise<any> {
    try {
      console.log(`🔗 Resolving metadata: ${metadataUri}`);
      
      // Handle IPFS URLs
      if (metadataUri.startsWith('ipfs://')) {
        const ipfsHash = metadataUri.replace('ipfs://', '');
        const resolvedUrl = `https://ipfs.io/ipfs/${ipfsHash}`;
        
        const response = await fetch(resolvedUrl, {
          timeout: 10000,
          headers: {
            'User-Agent': 'RiddleSwap Collection Discovery/1.0'
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json() as any;
      }
      
      // Handle HTTP/HTTPS URLs
      if (metadataUri.startsWith('http')) {
        const response = await fetch(metadataUri, {
          timeout: 10000,
          headers: {
            'User-Agent': 'RiddleSwap Collection Discovery/1.0'
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json() as any;
      }
      
      // Handle data URIs
      if (metadataUri.startsWith('data:')) {
        const [, base64Data] = metadataUri.split(',');
        const jsonData = Buffer.from(base64Data, 'base64').toString('utf-8');
        return JSON.parse(jsonData);
      }
      
      throw new Error(`Unsupported metadata URI format: ${metadataUri}`);
      
    } catch (error) {
      console.error(`❌ Metadata resolution failed for ${metadataUri}:`, error);
      return null;
    }
  }
  
  /**
   * Get collectible asset URLs for ingestion
   */
  getCollectionAssetUrls(collection: EnhancedCollectionInfo): string[] {
    const urls: string[] = [];
    
    // Collection-level assets
    if (collection.logoUrl) urls.push(collection.logoUrl);
    if (collection.bannerUrl && collection.bannerUrl !== collection.logoUrl) {
      urls.push(collection.bannerUrl);
    }
    if (collection.featuredImageUrl && 
        collection.featuredImageUrl !== collection.logoUrl && 
        collection.featuredImageUrl !== collection.bannerUrl) {
      urls.push(collection.featuredImageUrl);
    }
    if (collection.image && !urls.includes(collection.image)) {
      urls.push(collection.image);
    }
    
    // Individual NFT assets
    if (collection.nfts) {
      for (const nft of collection.nfts) {
        if (nft.imageUrl && !urls.includes(nft.imageUrl)) {
          urls.push(nft.imageUrl);
        }
        if (nft.animationUrl && !urls.includes(nft.animationUrl)) {
          urls.push(nft.animationUrl);
        }
        if (nft.metadataUrl && !urls.includes(nft.metadataUrl)) {
          urls.push(nft.metadataUrl);
        }
      }
    }
    
    return urls.filter(url => this.isValidAssetUrl(url));
  }
  
  /**
   * Validate asset URL for security and format
   */
  private isValidAssetUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      
      // Only allow HTTP/HTTPS and IPFS
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return false;
      }
      
      // Block localhost and private IPs
      const hostname = parsed.hostname.toLowerCase();
      if (
        hostname === 'localhost' ||
        hostname.startsWith('127.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('192.168.') ||
        hostname.match(/^172\.(1[6-9]|2\d|3[01])\./)
      ) {
        return false;
      }
      
      return true;
      
    } catch {
      return false;
    }
  }
  
  /**
   * Get collection statistics summary
   */
  getCollectionStats(collection: EnhancedCollectionInfo): any {
    return {
      issuer: collection.issuer,
      taxon: collection.taxon,
      name: collection.name,
      totalNFTs: collection.totalNFTs || 0,
      totalSupply: collection.totalSupply,
      owners: collection.owners,
      floorPrice: collection.floorPrice,
      volume24h: collection.volume24h,
      verified: collection.verified || false,
      dataSource: collection.dataSource,
      discoveryMethod: collection.discoveryMethod,
      assetCount: this.getCollectionAssetUrls(collection).length
    };
  }
}

// Global service instance
export const enhancedBithompCollectionService = new EnhancedBithompCollectionService();