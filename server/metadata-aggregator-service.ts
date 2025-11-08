/**
 * Unified Metadata Aggregator Service
 * 
 * Centralizes metadata fetching and merging from multiple sources with proper precedence:
 * 1. project_content_overrides (published, verified gets highest priority)
 * 2. token_configurations / nft_configurations (project-specific settings)
 * 3. nft_metadata_cache / collection_metadata_cache (cached external data)
 * 4. Bithomp API / DexScreener (live external APIs)
 */

import { storage } from "./storage";
import { cacheInvalidationService } from "./cache-invalidation-service";
import { SubscriptionService } from "./subscription-service";

// Unified metadata interfaces
export interface UnifiedTokenMetadata {
  // Entity identification
  issuer: string;
  currency: string;
  
  // Core metadata
  name?: string;
  description?: string;
  icon?: string;
  logo_url?: string;
  
  // Links
  website?: string;
  socials?: {
    twitter?: string;
    discord?: string;
    telegram?: string;
    instagram?: string;
    github?: string;
    linkedin?: string;
    youtube?: string;
    medium?: string;
    reddit?: string;
  };
  
  // Financial data (from external APIs)
  price_usd?: number;
  volume_24h?: number;
  volume_7d?: number;
  volume_30d?: number;
  change_24h?: number;
  change_7d?: number;
  change_30d?: number;
  market_cap?: number;
  holders?: number;
  
  // Verification and categorization
  verification_status?: string;
  verified?: boolean;
  tags?: string[];
  categories?: string[];
  
  // Metadata source tracking
  metadata_sources: {
    override?: boolean;
    project_config?: boolean;
    cache?: boolean;
    bithomp?: boolean;
    dexscreener?: boolean;
  };
  last_updated?: string;
  cache_expires_at?: string;
}

export interface UnifiedCollectionMetadata {
  // Entity identification
  issuer: string;
  taxon: number;
  
  // Core metadata
  name?: string;
  description?: string;
  image?: string;
  banner_url?: string;
  
  // Links
  website?: string;
  socials?: {
    twitter?: string;
    discord?: string;
    telegram?: string;
    instagram?: string;
    github?: string;
    linkedin?: string;
    youtube?: string;
    medium?: string;
    reddit?: string;
  };
  
  // Collection statistics (from external APIs)
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
  
  // NFT metadata
  royalty?: number;
  transferFee?: number;
  flags?: number;
  
  // Verification and categorization
  verified?: boolean;
  verification_status?: string;
  tags?: string[];
  categories?: string[];
  
  // Project-specific data
  project_id?: string;
  vanity_slug?: string;
  
  // Metadata source tracking
  metadata_sources: {
    override?: boolean;
    project_config?: boolean;
    cache?: boolean;
    bithomp?: boolean;
  };
  last_updated?: string;
  cache_expires_at?: string;
}

export interface UnifiedNFTMetadata {
  // Entity identification
  token_id: string;
  issuer?: string;
  taxon?: number;
  sequence?: number;
  
  // Core metadata
  name?: string;
  description?: string;
  image?: string;
  animation_url?: string;
  external_url?: string;
  
  // NFT-specific data
  attributes?: Array<{
    trait_type: string;
    value: any;
    display_type?: string;
    max_value?: number;
  }>;
  
  // Collection reference
  collection?: {
    name?: string;
    issuer?: string;
    taxon?: number;
    verified?: boolean;
  };
  
  // Links
  website?: string;
  socials?: {
    twitter?: string;
    discord?: string;
    telegram?: string;
    instagram?: string;
  };
  
  // Market data
  current_price?: number;
  last_sale?: number;
  floor_price?: number;
  
  // Technical metadata
  royalty?: number;
  transferFee?: number;
  flags?: number;
  
  // Verification
  verified?: boolean;
  tags?: string[];
  categories?: string[];
  
  // Metadata source tracking
  metadata_sources: {
    override?: boolean;
    project_config?: boolean;
    cache?: boolean;
    bithomp?: boolean;
  };
  last_updated?: string;
  cache_expires_at?: string;
}

export class MetadataAggregatorService {
  constructor() {
    // Bithomp API will be imported dynamically when needed
    
    // Initialize cache invalidation integration
    this.setupCacheInvalidationTriggers();
  }
  
  /**
   * Setup automatic cache invalidation when data changes
   */
  private setupCacheInvalidationTriggers(): void {
    console.log('🔄 [METADATA-AGGREGATOR] Setting up cache invalidation triggers');
    
    // Cache invalidation service is already set up as singleton
    // The triggers will be called by external systems when data changes
  }

  /**
   * Get unified token metadata with proper precedence
   */
  async getMergedTokenMetadata(issuer: string, currency: string): Promise<UnifiedTokenMetadata> {
    console.log(`🔄 [METADATA-AGGREGATOR] Fetching unified token metadata for ${currency}:${issuer}`);
    
    const result: UnifiedTokenMetadata = {
      issuer,
      currency,
      metadata_sources: {},
      last_updated: new Date().toISOString()
    };

    try {
      // 1. Check for project content overrides (highest priority)
      console.log('📝 [PRIORITY-1] Checking project content overrides...');
      const overrides = await storage.getProjectContentOverridesByEntity(
        'token',
        issuer,
        currency
      );
      
      const publishedOverride = overrides.find(o => o.status === 'published');
      if (publishedOverride) {
        console.log('✅ [OVERRIDE] Found published project content override');
        this.mergeOverrideData(result, publishedOverride);
        result.metadata_sources.override = true;
      }

      // 2. Check token configurations (project-specific settings)
      console.log('⚙️ [PRIORITY-2] Checking token configurations...');
      const tokenConfigs = await storage.getTokenConfigurationByToken(issuer, currency);
      if (tokenConfigs.length > 0) {
        console.log('✅ [CONFIG] Found token configurations');
        this.mergeTokenConfigData(result, tokenConfigs);
        result.metadata_sources.project_config = true;
      }

      // 3. Check cached metadata
      console.log('💾 [PRIORITY-3] Checking cached metadata...');
      const cached = await storage.getCachedTokenMetadata(issuer, currency);
      if (cached && !this.isCacheExpired(cached.cachedAt)) {
        console.log('✅ [CACHE] Found valid cached metadata');
        this.mergeCachedTokenData(result, cached);
        result.metadata_sources.cache = true;
        result.cache_expires_at = cached.cachedAt?.toISOString();
      }

      // 4. Fetch from external APIs (Bithomp/DexScreener)
      console.log('🌐 [PRIORITY-4] Fetching from external APIs...');
      try {
        // Import Bithomp API dynamically to avoid circular dependencies
        const { BithompAPI } = await import('./bithomp-api-v2.js');
        const bithompAPI = new BithompAPI();
        const bithompData = await bithompAPI.getToken(issuer, currency);
        if (bithompData) {
          console.log('✅ [BITHOMP] Found Bithomp token data');
          this.mergeBithompTokenData(result, bithompData);
          result.metadata_sources.bithomp = true;
          
          // Cache the external data
          await this.cacheTokenMetadata(issuer, currency, bithompData);
        }
      } catch (error) {
        console.log('⚠️ [BITHOMP] Failed to fetch from Bithomp, trying DexScreener fallback...');
        
        // Try DexScreener fallback
        try {
          const dexData = await this.fetchFromDexScreener('token', issuer, currency);
          if (dexData) {
            console.log('✅ [DEXSCREENER] Found DexScreener token data');
            this.mergeDexScreenerTokenData(result, dexData);
            result.metadata_sources.dexscreener = true;
          }
        } catch (dexError) {
          console.log('⚠️ [DEXSCREENER] Failed to fetch from DexScreener fallback');
        }
      }

      // 5. Check verification badge status from subscription service
      console.log('✓ [PRIORITY-5] Checking verification badge status...');
      try {
        const project = await storage.getProjectByToken(issuer, currency);
        if (project) {
          console.log('🔗 [PROJECT-LINK] Found associated project for token');
          result.project_id = project.id;
          result.vanity_slug = project.vanity_slug || undefined;
          
          // Check subscription verification status
          const isVerified = await SubscriptionService.isVerified(project.id);
          result.verified = isVerified;
          
          console.log(`✓ [VERIFICATION] Token ${currency}:${issuer} verification status: ${isVerified}`);
        }
      } catch (error) {
        console.log('⚠️ [VERIFICATION] Failed to check verification badge status:', error);
      }

      console.log(`✅ [METADATA-AGGREGATOR] Token metadata aggregation complete for ${currency}:${issuer}`);
      console.log(`📊 Sources used:`, result.metadata_sources);
      console.log(`✓ Verified badge: ${result.verified}`);
      
      return result;

    } catch (error) {
      console.error('❌ [METADATA-AGGREGATOR] Error aggregating token metadata:', error);
      return result;
    }
  }

  /**
   * Get unified collection metadata with proper precedence
   */
  async getMergedCollectionMetadata(issuer: string, taxon: number): Promise<UnifiedCollectionMetadata> {
    console.log(`🔄 [METADATA-AGGREGATOR] Fetching unified collection metadata for ${issuer}:${taxon}`);
    
    const result: UnifiedCollectionMetadata = {
      issuer,
      taxon,
      metadata_sources: {},
      last_updated: new Date().toISOString()
    };

    try {
      // 1. Check for project content overrides (highest priority)
      console.log('📝 [PRIORITY-1] Checking project content overrides...');
      const overrides = await storage.getProjectContentOverridesByEntity(
        'collection',
        issuer,
        undefined,
        taxon
      );
      
      const publishedOverride = overrides.find(o => o.status === 'published');
      if (publishedOverride) {
        console.log('✅ [OVERRIDE] Found published project content override');
        this.mergeOverrideData(result, publishedOverride);
        result.metadata_sources.override = true;
      }

      // 2. Check NFT configurations (project-specific settings)
      console.log('⚙️ [PRIORITY-2] Checking NFT configurations...');
      const nftConfigs = await storage.getNftConfigurationByCollection(issuer, taxon);
      if (nftConfigs.length > 0) {
        console.log('✅ [CONFIG] Found NFT configurations');
        this.mergeNftConfigData(result, nftConfigs);
        result.metadata_sources.project_config = true;
      }

      // 3. Check cached collection metadata
      console.log('💾 [PRIORITY-3] Checking cached collection metadata...');
      const cached = await storage.getCachedCollectionMetadata(issuer, taxon);
      if (cached && !this.isCacheExpired(cached.cachedAt)) {
        console.log('✅ [CACHE] Found valid cached collection metadata');
        this.mergeCachedCollectionData(result, cached);
        result.metadata_sources.cache = true;
        result.cache_expires_at = cached.cachedAt?.toISOString();
      }

      // 4. Fetch from external APIs (Bithomp)
      console.log('🌐 [PRIORITY-4] Fetching from Bithomp API...');
      try {
        // Import Bithomp API dynamically to avoid circular dependencies
        const { BithompAPI } = await import('./bithomp-api-v2.js');
        const bithompAPI = new BithompAPI();
        const bithompData = await bithompAPI.getCollection(issuer, taxon);
        if (bithompData) {
          console.log('✅ [BITHOMP] Found Bithomp collection data');
          this.mergeBithompCollectionData(result, bithompData);
          result.metadata_sources.bithomp = true;
          
          // Cache the external data
          await this.cacheCollectionMetadata(issuer, taxon, bithompData);
        }
      } catch (error) {
        console.log('⚠️ [BITHOMP] Failed to fetch collection from Bithomp:', error);
      }

      // 5. Check if this collection is linked to any project and verification badge status
      console.log('🔗 [PROJECT-LINK] Checking project associations...');
      const project = await storage.getProjectByCollection(issuer, taxon);
      if (project) {
        console.log('✅ [PROJECT-LINK] Found associated project');
        result.project_id = project.id;
        result.vanity_slug = project.vanity_slug || undefined;
        
        // Check subscription verification status (more accurate than just claim status)
        try {
          const isVerified = await SubscriptionService.isVerified(project.id);
          result.verified = isVerified;
          console.log(`✓ [VERIFICATION] Collection ${issuer}:${taxon} verification status: ${isVerified}`);
        } catch (error) {
          console.log('⚠️ [VERIFICATION] Failed to check verification badge, fallback to claim status');
          result.verified = project.claim_status === 'claimed';
        }
      }

      console.log(`✅ [METADATA-AGGREGATOR] Collection metadata aggregation complete for ${issuer}:${taxon}`);
      console.log(`📊 Sources used:`, result.metadata_sources);
      
      return result;

    } catch (error) {
      console.error('❌ [METADATA-AGGREGATOR] Error aggregating collection metadata:', error);
      return result;
    }
  }

  /**
   * Get unified NFT metadata with proper precedence
   */
  async getMergedNFTMetadata(tokenId: string): Promise<UnifiedNFTMetadata> {
    console.log(`🔄 [METADATA-AGGREGATOR] Fetching unified NFT metadata for ${tokenId}`);
    
    const result: UnifiedNFTMetadata = {
      token_id: tokenId,
      metadata_sources: {},
      last_updated: new Date().toISOString()
    };

    try {
      // 1. Check for project content overrides (highest priority)
      console.log('📝 [PRIORITY-1] Checking project content overrides...');
      const overrides = await storage.getProjectContentOverridesByEntity(
        'nft',
        undefined,
        undefined,
        undefined,
        tokenId
      );
      
      const publishedOverride = overrides.find(o => o.status === 'published');
      if (publishedOverride) {
        console.log('✅ [OVERRIDE] Found published project content override');
        this.mergeOverrideData(result, publishedOverride);
        result.metadata_sources.override = true;
      }

      // 2. Check cached NFT metadata
      console.log('💾 [PRIORITY-2] Checking cached NFT metadata...');
      const cached = await storage.getCachedNFTMetadata(tokenId);
      if (cached && !this.isCacheExpired(cached.cachedAt)) {
        console.log('✅ [CACHE] Found valid cached NFT metadata');
        this.mergeCachedNFTData(result, cached);
        result.metadata_sources.cache = true;
        result.cache_expires_at = cached.cachedAt?.toISOString();
      }

      // 3. Fetch from external APIs (Bithomp)
      console.log('🌐 [PRIORITY-3] Fetching from Bithomp API...');
      try {
        // Import Bithomp API dynamically to avoid circular dependencies
        const { BithompAPI } = await import('./bithomp-api-v2.js');
        const bithompAPI = new BithompAPI();
        const bithompData = await bithompAPI.getNFT(tokenId);
        if (bithompData) {
          console.log('✅ [BITHOMP] Found Bithomp NFT data');
          this.mergeBithompNFTData(result, bithompData);
          result.metadata_sources.bithomp = true;
          
          // Cache the external data
          await this.cacheNFTMetadata(tokenId, bithompData);
        }
      } catch (error) {
        console.log('⚠️ [BITHOMP] Failed to fetch NFT from Bithomp:', error);
      }

      // 4. Fetch collection metadata if we have issuer/taxon
      if (result.issuer && result.taxon !== undefined) {
        console.log('📚 [COLLECTION-REF] Fetching collection reference...');
        try {
          const collectionMeta = await this.getMergedCollectionMetadata(result.issuer, result.taxon);
          result.collection = {
            name: collectionMeta.name,
            issuer: collectionMeta.issuer,
            taxon: collectionMeta.taxon,
            verified: collectionMeta.verified
          };
        } catch (error) {
          console.log('⚠️ [COLLECTION-REF] Failed to fetch collection reference:', error);
        }
      }

      console.log(`✅ [METADATA-AGGREGATOR] NFT metadata aggregation complete for ${tokenId}`);
      console.log(`📊 Sources used:`, result.metadata_sources);
      
      return result;

    } catch (error) {
      console.error('❌ [METADATA-AGGREGATOR] Error aggregating NFT metadata:', error);
      return result;
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Merge data from project content overrides
   */
  private mergeOverrideData(result: any, override: any): void {
    if (override.title) result.name = override.title;
    if (override.description) result.description = override.description;
    if (override.logo_url) result.icon = override.logo_url;
    if (override.logo_url) result.logo_url = override.logo_url;
    if (override.banner_url) result.banner_url = override.banner_url;
    if (override.website) result.website = override.website;
    if (override.socials) result.socials = { ...result.socials, ...override.socials };
    if (override.tags?.length) result.tags = override.tags;
    if (override.categories?.length) result.categories = override.categories;
    if (override.verified_override !== undefined) result.verified = override.verified_override;
  }

  /**
   * Merge data from token configurations
   */
  private mergeTokenConfigData(result: any, configs: any[]): void {
    // Merge configuration data - higher priority configs override lower ones
    const sortedConfigs = configs.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    
    for (const config of sortedConfigs) {
      if (config.display_name && !result.name) result.name = config.display_name;
      if (config.description && !result.description) result.description = config.description;
      if (config.icon_url && !result.icon) result.icon = config.icon_url;
      if (config.website && !result.website) result.website = config.website;
      if (config.verified !== undefined && result.verified === undefined) result.verified = config.verified;
    }
  }

  /**
   * Merge data from NFT configurations
   */
  private mergeNftConfigData(result: any, configs: any[]): void {
    const sortedConfigs = configs.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    
    for (const config of sortedConfigs) {
      if (config.collection_name && !result.name) result.name = config.collection_name;
      if (config.collection_description && !result.description) result.description = config.collection_description;
      if (config.collection_image && !result.image) result.image = config.collection_image;
      if (config.royalty_percentage !== undefined && !result.royalty) result.royalty = config.royalty_percentage;
      if (config.verified !== undefined && result.verified === undefined) result.verified = config.verified;
    }
  }

  /**
   * Merge data from cached token metadata
   */
  private mergeCachedTokenData(result: UnifiedTokenMetadata, cached: any): void {
    const metadata = cached.metadata || {};
    if (metadata.name && !result.name) result.name = metadata.name;
    if (metadata.description && !result.description) result.description = metadata.description;
    if (metadata.icon && !result.icon) result.icon = metadata.icon;
    if (metadata.website && !result.website) result.website = metadata.website;
    if (metadata.price_usd && !result.price_usd) result.price_usd = metadata.price_usd;
    if (metadata.volume_24h && !result.volume_24h) result.volume_24h = metadata.volume_24h;
    if (metadata.change_24h && !result.change_24h) result.change_24h = metadata.change_24h;
    if (metadata.verification_status && !result.verification_status) result.verification_status = metadata.verification_status;
  }

  /**
   * Merge data from cached collection metadata
   */
  private mergeCachedCollectionData(result: UnifiedCollectionMetadata, cached: any): void {
    const metadata = cached.metadata || {};
    if (metadata.name && !result.name) result.name = metadata.name;
    if (metadata.description && !result.description) result.description = metadata.description;
    if (metadata.image && !result.image) result.image = metadata.image;
    if (metadata.floorPrice && !result.floorPrice) result.floorPrice = metadata.floorPrice;
    if (metadata.volume24h && !result.volume24h) result.volume24h = metadata.volume24h;
    if (metadata.totalNFTs && !result.totalNFTs) result.totalNFTs = metadata.totalNFTs;
    if (metadata.verified !== undefined && result.verified === undefined) result.verified = metadata.verified;
  }

  /**
   * Merge data from cached NFT metadata
   */
  private mergeCachedNFTData(result: UnifiedNFTMetadata, cached: any): void {
    const metadata = cached.metadata || {};
    if (metadata.name && !result.name) result.name = metadata.name;
    if (metadata.description && !result.description) result.description = metadata.description;
    if (metadata.image && !result.image) result.image = metadata.image;
    if (metadata.animation_url && !result.animation_url) result.animation_url = metadata.animation_url;
    if (metadata.external_url && !result.external_url) result.external_url = metadata.external_url;
    if (metadata.attributes && !result.attributes) result.attributes = metadata.attributes;
    if (metadata.issuer && !result.issuer) result.issuer = metadata.issuer;
    if (metadata.taxon !== undefined && result.taxon === undefined) result.taxon = metadata.taxon;
    if (metadata.sequence !== undefined && result.sequence === undefined) result.sequence = metadata.sequence;
  }

  /**
   * Merge data from Bithomp token API
   */
  private mergeBithompTokenData(result: UnifiedTokenMetadata, bithomp: any): void {
    if (bithomp.name && !result.name) result.name = bithomp.name;
    if (bithomp.description && !result.description) result.description = bithomp.description;
    if (bithomp.icon && !result.icon) result.icon = bithomp.icon;
    if (bithomp.website && !result.website) result.website = bithomp.website;
    if (bithomp.price_usd !== undefined && result.price_usd === undefined) result.price_usd = bithomp.price_usd;
    if (bithomp.volume_24h !== undefined && result.volume_24h === undefined) result.volume_24h = bithomp.volume_24h;
    if (bithomp.change_24h !== undefined && result.change_24h === undefined) result.change_24h = bithomp.change_24h;
    if (bithomp.verification_status && !result.verification_status) result.verification_status = bithomp.verification_status;
    if (bithomp.holders !== undefined && result.holders === undefined) result.holders = bithomp.holders;
    
    // Merge social links
    if (bithomp.twitter || bithomp.telegram || bithomp.discord) {
      result.socials = result.socials || {};
      if (bithomp.twitter && !result.socials.twitter) result.socials.twitter = bithomp.twitter;
      if (bithomp.telegram && !result.socials.telegram) result.socials.telegram = bithomp.telegram;
      if (bithomp.discord && !result.socials.discord) result.socials.discord = bithomp.discord;
    }
  }

  /**
   * Merge data from Bithomp collection API
   */
  private mergeBithompCollectionData(result: UnifiedCollectionMetadata, bithomp: any): void {
    if (bithomp.name && !result.name) result.name = bithomp.name;
    if (bithomp.description && !result.description) result.description = bithomp.description;
    if (bithomp.image && !result.image) result.image = bithomp.image;
    if (bithomp.website && !result.website) result.website = bithomp.website;
    if (bithomp.verified !== undefined && result.verified === undefined) result.verified = bithomp.verified;
    
    // Statistics
    if (bithomp.floorPrice !== undefined && result.floorPrice === undefined) result.floorPrice = bithomp.floorPrice;
    if (bithomp.volume24h !== undefined && result.volume24h === undefined) result.volume24h = bithomp.volume24h;
    if (bithomp.totalNFTs !== undefined && result.totalNFTs === undefined) result.totalNFTs = bithomp.totalNFTs;
    if (bithomp.owners !== undefined && result.owners === undefined) result.owners = bithomp.owners;
    if (bithomp.royalty !== undefined && result.royalty === undefined) result.royalty = bithomp.royalty;
    if (bithomp.transferFee !== undefined && result.transferFee === undefined) result.transferFee = bithomp.transferFee;
    
    // Merge social links
    if (bithomp.twitter || bithomp.telegram || bithomp.discord) {
      result.socials = result.socials || {};
      if (bithomp.twitter && !result.socials.twitter) result.socials.twitter = bithomp.twitter;
      if (bithomp.telegram && !result.socials.telegram) result.socials.telegram = bithomp.telegram;
      if (bithomp.discord && !result.socials.discord) result.socials.discord = bithomp.discord;
    }
  }

  /**
   * Merge data from Bithomp NFT API
   */
  private mergeBithompNFTData(result: UnifiedNFTMetadata, bithomp: any): void {
    if (bithomp.name && !result.name) result.name = bithomp.name;
    if (bithomp.description && !result.description) result.description = bithomp.description;
    if (bithomp.image && !result.image) result.image = bithomp.image;
    if (bithomp.animation_url && !result.animation_url) result.animation_url = bithomp.animation_url;
    if (bithomp.external_url && !result.external_url) result.external_url = bithomp.external_url;
    if (bithomp.attributes && !result.attributes) result.attributes = bithomp.attributes;
    if (bithomp.issuer && !result.issuer) result.issuer = bithomp.issuer;
    if (bithomp.taxon !== undefined && result.taxon === undefined) result.taxon = bithomp.taxon;
    if (bithomp.sequence !== undefined && result.sequence === undefined) result.sequence = bithomp.sequence;
    if (bithomp.royalty !== undefined && result.royalty === undefined) result.royalty = bithomp.royalty;
    if (bithomp.transferFee !== undefined && result.transferFee === undefined) result.transferFee = bithomp.transferFee;
    if (bithomp.flags !== undefined && result.flags === undefined) result.flags = bithomp.flags;
  }

  /**
   * Merge data from DexScreener fallback
   */
  private mergeDexScreenerTokenData(result: UnifiedTokenMetadata, dexData: any): void {
    if (dexData.name && !result.name) result.name = dexData.name;
    if (dexData.symbol && !result.currency) result.currency = dexData.symbol;
    if (dexData.price_usd !== undefined && result.price_usd === undefined) result.price_usd = dexData.price_usd;
    if (dexData.volume_24h !== undefined && result.volume_24h === undefined) result.volume_24h = dexData.volume_24h;
    if (dexData.change_24h !== undefined && result.change_24h === undefined) result.change_24h = dexData.change_24h;
    if (dexData.verification_status && !result.verification_status) result.verification_status = dexData.verification_status;
  }

  /**
   * Check if cached data is expired
   */
  private isCacheExpired(cachedAt: Date | null | undefined): boolean {
    if (!cachedAt) return true;
    
    const cacheExpiryHours = 1; // Cache for 1 hour
    const expiryTime = new Date(cachedAt);
    expiryTime.setHours(expiryTime.getHours() + cacheExpiryHours);
    
    return new Date() > expiryTime;
  }

  /**
   * Cache token metadata
   */
  private async cacheTokenMetadata(issuer: string, currency: string, data: any): Promise<void> {
    try {
      await storage.upsertCachedTokenMetadata(issuer, currency, data);
    } catch (error) {
      console.error('Failed to cache token metadata:', error);
    }
  }

  /**
   * Cache collection metadata
   */
  private async cacheCollectionMetadata(issuer: string, taxon: number, data: any): Promise<void> {
    try {
      await storage.upsertCachedCollectionMetadata(issuer, taxon, data);
    } catch (error) {
      console.error('Failed to cache collection metadata:', error);
    }
  }

  /**
   * Cache NFT metadata
   */
  private async cacheNFTMetadata(tokenId: string, data: any): Promise<void> {
    try {
      await storage.upsertCachedNFTMetadata(tokenId, data);
    } catch (error) {
      console.error('Failed to cache NFT metadata:', error);
    }
  }

  /**
   * Fetch data from DexScreener fallback
   */
  private async fetchFromDexScreener(entityType: string, ...params: any[]): Promise<any> {
    // Import DexScreener API dynamically
    try {
      const { loadAllXRPLTokens } = await import('./dexscreener-api.js');
      const tokens = await loadAllXRPLTokens();
      
      if (entityType === 'token' && params.length >= 2) {
        const [issuer, currency] = params;
        const found = tokens.find(t => 
          t.baseToken.address === issuer || 
          (t.baseToken.symbol === currency && t.baseToken.address === issuer)
        );
        
        if (found) {
          return {
            name: found.baseToken.name,
            symbol: found.baseToken.symbol,
            issuer: found.baseToken.address,
            price_usd: parseFloat(found.priceUsd || '0') || 0,
            volume_24h: found.volume?.h24 || 0,
            change_24h: found.priceChange?.h24 || 0,
            verification_status: 'dexscreener'
          };
        }
      }
      
      return null;
    } catch (error) {
      console.error('DexScreener fallback failed:', error);
      return null;
    }
  }

  /**
   * Invalidate all caches for a specific entity
   */
  async invalidateEntityCache(entityType: 'token' | 'collection' | 'nft', ...identifiers: any[]): Promise<void> {
    console.log(`🗑️ [CACHE-INVALIDATION] Invalidating ${entityType} cache for:`, identifiers);
    
    try {
      if (entityType === 'token' && identifiers.length >= 2) {
        const [issuer, currency] = identifiers;
        await storage.deleteCachedTokenMetadata(issuer, currency);
        // Notify cache invalidation service
        await cacheInvalidationService.invalidateEntity('token', { issuer, currency });
      } else if (entityType === 'collection' && identifiers.length >= 2) {
        const [issuer, taxon] = identifiers;
        await storage.deleteCachedCollectionMetadata(issuer, taxon);
        // Notify cache invalidation service
        await cacheInvalidationService.invalidateEntity('collection', { issuer, taxon });
      } else if (entityType === 'nft' && identifiers.length >= 1) {
        const [tokenId] = identifiers;
        await storage.deleteCachedNFTMetadata(tokenId);
        // Notify cache invalidation service
        await cacheInvalidationService.invalidateEntity('nft', { tokenId });
      }
      
      console.log(`✅ [CACHE-INVALIDATION] Cache invalidated for ${entityType}`);
    } catch (error) {
      console.error(`❌ [CACHE-INVALIDATION] Failed to invalidate ${entityType} cache:`, error);
    }
  }

  /**
   * Notify when project content override changes
   */
  async notifyOverrideChange(
    overrideId: string,
    entityType: 'token' | 'collection' | 'nft',
    entityData: { issuer?: string; currency?: string; taxon?: number; tokenId?: string },
    action: 'created' | 'updated' | 'deleted'
  ): Promise<void> {
    console.log(`🔄 [METADATA-AGGREGATOR] Override ${action}:`, { overrideId, entityType, entityData });
    
    // Notify cache invalidation service
    cacheInvalidationService.notifyOverrideChanged(overrideId, entityType, entityData, action);
    
    // Immediately invalidate any cached metadata for this entity
    switch (entityType) {
      case 'token':
        if (entityData.issuer && entityData.currency) {
          await this.invalidateEntityCache('token', entityData.issuer, entityData.currency);
        }
        break;
      case 'collection':
        if (entityData.issuer && entityData.taxon !== undefined) {
          await this.invalidateEntityCache('collection', entityData.issuer, entityData.taxon);
        }
        break;
      case 'nft':
        if (entityData.tokenId) {
          await this.invalidateEntityCache('nft', entityData.tokenId);
        }
        break;
    }
  }

  /**
   * Notify when token/NFT configuration changes
   */
  async notifyConfigChange(
    entityType: 'token' | 'collection' | 'nft',
    entityKey: string,
    action: 'created' | 'updated' | 'deleted'
  ): Promise<void> {
    console.log(`🔧 [METADATA-AGGREGATOR] Config ${action}:`, { entityType, entityKey });
    
    // Notify cache invalidation service
    cacheInvalidationService.notifyConfigChanged(entityType, entityKey, action);
    
    // Immediately invalidate cached metadata for this entity
    const [issuer, secondParam] = entityKey.split(':');
    
    switch (entityType) {
      case 'token':
        if (issuer && secondParam) {
          await this.invalidateEntityCache('token', issuer, secondParam);
        }
        break;
      case 'collection':
        if (issuer && secondParam) {
          const taxon = parseInt(secondParam);
          if (!isNaN(taxon)) {
            await this.invalidateEntityCache('collection', issuer, taxon);
          }
        }
        break;
      case 'nft':
        await this.invalidateEntityCache('nft', entityKey);
        break;
    }
  }

  /**
   * Notify when project metadata changes
   */
  async notifyProjectChange(projectId: string, reason?: string): Promise<void> {
    console.log(`📂 [METADATA-AGGREGATOR] Project changed:`, { projectId, reason });
    
    // Notify cache invalidation service
    cacheInvalidationService.notifyProjectChanged(projectId, reason);
  }
}

// Export singleton instance
export const metadataAggregator = new MetadataAggregatorService();