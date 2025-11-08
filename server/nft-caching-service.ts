import { storage } from './storage';
import type { InsertNftMetadataCache, InsertCollectionMetadataCache } from '../shared/schema';

export class NFTCachingService {
  private static readonly CACHE_DURATION_HOURS = 24; // Cache for 24 hours
  private static readonly COLLECTION_CACHE_DURATION_HOURS = 12; // Collections change more frequently

  // NFT Metadata Caching
  static async getCachedOrFetchNFTMetadata(nftId: string, fetchFn: () => Promise<any>): Promise<any> {
    try {
      // Check cache first
      const cached = await storage.getCachedNftMetadata(nftId);
      if (cached) {
        console.log(`✅ NFT metadata cache hit for ${nftId}`);
        return {
          ...cached.metadata,
          traits: cached.traits,
          imageUrl: cached.imageUrl,
          uri: cached.uri,
          cached: true,
          cachedAt: cached.cachedAt
        };
      }

      // Cache miss - fetch fresh data
      console.log(`⏳ NFT metadata cache miss for ${nftId}, fetching fresh data...`);
      const freshData = await fetchFn();
      
      if (freshData) {
        // Cache the fresh data
        await this.cacheNFTMetadata(nftId, freshData);
        return {
          ...freshData,
          cached: false,
          cachedAt: new Date()
        };
      }

      return null;
    } catch (error) {
      console.error(`❌ Error in NFT metadata caching for ${nftId}:`, error);
      // Fallback to fresh fetch if caching fails
      try {
        return await fetchFn();
      } catch (fetchError) {
        console.error(`❌ Fallback fetch also failed for ${nftId}:`, fetchError);
        return null;
      }
    }
  }

  // Collection Metadata Caching
  static async getCachedOrFetchCollectionMetadata(collectionId: string, fetchFn: () => Promise<any>): Promise<any> {
    try {
      // Check cache first
      const cached = await storage.getCachedCollectionMetadata(collectionId);
      if (cached) {
        console.log(`✅ Collection metadata cache hit for ${collectionId}`);
        return {
          ...cached.metadata,
          name: cached.name,
          description: cached.description,
          imageUrl: cached.imageUrl,
          totalItems: cached.totalItems,
          floorPrice: cached.floorPrice,
          volume24h: cached.volume24h,
          cached: true,
          cachedAt: cached.cachedAt
        };
      }

      // Cache miss - fetch fresh data
      console.log(`⏳ Collection metadata cache miss for ${collectionId}, fetching fresh data...`);
      const freshData = await fetchFn();
      
      if (freshData) {
        // Cache the fresh data
        await this.cacheCollectionMetadata(collectionId, freshData);
        return {
          ...freshData,
          cached: false,
          cachedAt: new Date()
        };
      }

      return null;
    } catch (error) {
      console.error(`❌ Error in collection metadata caching for ${collectionId}:`, error);
      // Fallback to fresh fetch if caching fails
      try {
        return await fetchFn();
      } catch (fetchError) {
        console.error(`❌ Fallback fetch also failed for ${collectionId}:`, fetchError);
        return null;
      }
    }
  }

  // Cache NFT metadata
  private static async cacheNFTMetadata(nftId: string, metadata: any): Promise<void> {
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + this.CACHE_DURATION_HOURS);

      const cacheData: InsertNftMetadataCache = {
        nftId,
        uri: metadata.uri || null,
        metadata: metadata,
        traits: metadata.traits || [],
        imageUrl: metadata.imageUrl || metadata.image || null,
        expiresAt
      };

      await storage.setCachedNftMetadata(cacheData);
      console.log(`💾 Cached NFT metadata for ${nftId} until ${expiresAt.toISOString()}`);
    } catch (error) {
      console.error(`❌ Failed to cache NFT metadata for ${nftId}:`, error);
    }
  }

  // Cache collection metadata
  private static async cacheCollectionMetadata(collectionId: string, metadata: any): Promise<void> {
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + this.COLLECTION_CACHE_DURATION_HOURS);

      const cacheData: InsertCollectionMetadataCache = {
        collectionId,
        name: metadata.name || null,
        description: metadata.description || null,
        imageUrl: metadata.imageUrl || metadata.image || null,
        metadata: metadata,
        totalItems: metadata.totalItems || metadata.total_items || 0,
        floorPrice: metadata.floorPrice || metadata.floor_price || null,
        volume24h: metadata.volume24h || metadata.volume_24h || null,
        expiresAt
      };

      await storage.setCachedCollectionMetadata(cacheData);
      console.log(`💾 Cached collection metadata for ${collectionId} until ${expiresAt.toISOString()}`);
    } catch (error) {
      console.error(`❌ Failed to cache collection metadata for ${collectionId}:`, error);
    }
  }

  // Clear expired cache entries (can be called periodically)
  static async clearExpiredCache(): Promise<void> {
    try {
      await storage.clearExpiredCache();
      console.log(`🧹 Cleared expired NFT and collection metadata cache entries`);
    } catch (error) {
      console.error(`❌ Failed to clear expired cache:`, error);
    }
  }

  // Force refresh cache for specific NFT
  static async refreshNFTCache(nftId: string, fetchFn: () => Promise<any>): Promise<any> {
    try {
      console.log(`🔄 Force refreshing cache for NFT ${nftId}`);
      const freshData = await fetchFn();
      
      if (freshData) {
        await this.cacheNFTMetadata(nftId, freshData);
      }
      
      return freshData;
    } catch (error) {
      console.error(`❌ Failed to refresh NFT cache for ${nftId}:`, error);
      throw error;
    }
  }

  // Force refresh cache for specific collection
  static async refreshCollectionCache(collectionId: string, fetchFn: () => Promise<any>): Promise<any> {
    try {
      console.log(`🔄 Force refreshing cache for collection ${collectionId}`);
      const freshData = await fetchFn();
      
      if (freshData) {
        await this.cacheCollectionMetadata(collectionId, freshData);
      }
      
      return freshData;
    } catch (error) {
      console.error(`❌ Failed to refresh collection cache for ${collectionId}:`, error);
      throw error;
    }
  }

  // Batch cache multiple NFTs
  static async batchCacheNFTs(nfts: Array<{id: string, metadata: any}>): Promise<void> {
    console.log(`💾 Batch caching ${nfts.length} NFTs...`);
    
    const promises = nfts.map(nft => this.cacheNFTMetadata(nft.id, nft.metadata));
    
    try {
      await Promise.allSettled(promises);
      console.log(`✅ Batch cache completed for ${nfts.length} NFTs`);
    } catch (error) {
      console.error(`❌ Batch cache failed:`, error);
    }
  }

  // Get cache statistics
  static async getCacheStats(): Promise<{nftCacheCount: number, collectionCacheCount: number}> {
    try {
      // This would need additional storage methods to get counts
      // For now, return estimated stats
      return {
        nftCacheCount: 0, // Would need storage.getNFTCacheCount()
        collectionCacheCount: 0 // Would need storage.getCollectionCacheCount()
      };
    } catch (error) {
      console.error(`❌ Failed to get cache stats:`, error);
      return { nftCacheCount: 0, collectionCacheCount: 0 };
    }
  }
}

// Export default
export default NFTCachingService;