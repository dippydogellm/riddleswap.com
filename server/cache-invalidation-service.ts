/**
 * Cache Invalidation Service
 * 
 * Provides event-driven cache invalidation that triggers when:
 * - Project content overrides are created/updated/deleted
 * - Token/NFT configurations are modified
 * - Project metadata is updated
 * 
 * This ensures the unified metadata aggregator always returns fresh data
 * when source data changes.
 */

import { EventEmitter } from 'events';
import { storage } from './storage';

export interface CacheInvalidationEvent {
  type: 'override_updated' | 'config_updated' | 'project_updated';
  entityType?: 'token' | 'collection' | 'nft';
  entityKey?: string;
  affectedEntities?: {
    tokens?: Array<{ issuer: string; currency: string }>;
    collections?: Array<{ issuer: string; taxon: number }>;
    nfts?: Array<{ tokenId: string }>;
  };
  projectId?: string;
  reason?: string;
  timestamp: Date;
}

export class CacheInvalidationService extends EventEmitter {
  private static instance: CacheInvalidationService | null = null;

  constructor() {
    super();
    this.setupEventListeners();
  }

  public static getInstance(): CacheInvalidationService {
    if (!CacheInvalidationService.instance) {
      CacheInvalidationService.instance = new CacheInvalidationService();
    }
    return CacheInvalidationService.instance;
  }

  /**
   * Set up event listeners for automatic cache invalidation
   */
  private setupEventListeners(): void {
    // Listen for our own invalidation events
    this.on('cache_invalidation', this.handleCacheInvalidation.bind(this));
    
    console.log('🔄 [CACHE-INVALIDATION] Service initialized with event listeners');
  }

  /**
   * Emit a cache invalidation event
   */
  public emitInvalidation(event: CacheInvalidationEvent): void {
    console.log(`🗑️ [CACHE-INVALIDATION] Emitting invalidation event:`, event);
    this.emit('cache_invalidation', event);
  }

  /**
   * Handle cache invalidation events
   */
  private async handleCacheInvalidation(event: CacheInvalidationEvent): Promise<void> {
    try {
      console.log(`🔄 [CACHE-INVALIDATION] Processing invalidation: ${event.type}`);
      
      switch (event.type) {
        case 'override_updated':
          await this.handleOverrideUpdate(event);
          break;
          
        case 'config_updated':
          await this.handleConfigUpdate(event);
          break;
          
        case 'project_updated':
          await this.handleProjectUpdate(event);
          break;
          
        default:
          console.warn(`⚠️ [CACHE-INVALIDATION] Unknown event type: ${event.type}`);
      }
      
      console.log(`✅ [CACHE-INVALIDATION] Processed ${event.type} successfully`);
      
    } catch (error) {
      console.error(`❌ [CACHE-INVALIDATION] Failed to process ${event.type}:`, error);
    }
  }

  /**
   * Handle project content override updates
   */
  private async handleOverrideUpdate(event: CacheInvalidationEvent): Promise<void> {
    if (!event.affectedEntities) {
      console.warn('⚠️ [CACHE-INVALIDATION] Override update without affected entities');
      return;
    }

    const promises: Promise<void>[] = [];

    // Invalidate affected tokens
    if (event.affectedEntities.tokens) {
      for (const token of event.affectedEntities.tokens) {
        promises.push(storage.deleteCachedTokenMetadata(token.issuer, token.currency));
        console.log(`🔄 [CACHE-INVALIDATION] Invalidating token: ${token.currency}:${token.issuer}`);
      }
    }

    // Invalidate affected collections
    if (event.affectedEntities.collections) {
      for (const collection of event.affectedEntities.collections) {
        promises.push(storage.deleteCachedCollectionMetadata(collection.issuer, collection.taxon));
        console.log(`🔄 [CACHE-INVALIDATION] Invalidating collection: ${collection.issuer}:${collection.taxon}`);
      }
    }

    // Invalidate affected NFTs
    if (event.affectedEntities.nfts) {
      for (const nft of event.affectedEntities.nfts) {
        promises.push(storage.deleteCachedNFTMetadata(nft.tokenId));
        console.log(`🔄 [CACHE-INVALIDATION] Invalidating NFT: ${nft.tokenId}`);
      }
    }

    await Promise.all(promises);
    console.log(`✅ [CACHE-INVALIDATION] Override invalidation completed`);
  }

  /**
   * Handle token/NFT configuration updates
   */
  private async handleConfigUpdate(event: CacheInvalidationEvent): Promise<void> {
    if (!event.entityType || !event.entityKey) {
      console.warn('⚠️ [CACHE-INVALIDATION] Config update without entity info');
      return;
    }

    switch (event.entityType) {
      case 'token':
        const [issuer, currency] = event.entityKey.split(':');
        if (issuer && currency) {
          await storage.deleteCachedTokenMetadata(issuer, currency);
          console.log(`🔄 [CACHE-INVALIDATION] Invalidated token config: ${currency}:${issuer}`);
        }
        break;

      case 'collection':
        const [collectionIssuer, taxonStr] = event.entityKey.split(':');
        const taxon = parseInt(taxonStr);
        if (collectionIssuer && !isNaN(taxon)) {
          await storage.deleteCachedCollectionMetadata(collectionIssuer, taxon);
          console.log(`🔄 [CACHE-INVALIDATION] Invalidated collection config: ${collectionIssuer}:${taxon}`);
        }
        break;

      case 'nft':
        await storage.deleteCachedNFTMetadata(event.entityKey);
        console.log(`🔄 [CACHE-INVALIDATION] Invalidated NFT config: ${event.entityKey}`);
        break;
    }
  }

  /**
   * Handle project-wide updates
   */
  private async handleProjectUpdate(event: CacheInvalidationEvent): Promise<void> {
    if (!event.projectId) {
      console.warn('⚠️ [CACHE-INVALIDATION] Project update without project ID');
      return;
    }

    try {
      // Get all project content overrides for this project
      const overrides = await storage.getProjectContentOverridesByEntity(event.projectId);
      
      console.log(`🔄 [CACHE-INVALIDATION] Found ${overrides.length} overrides for project ${event.projectId}`);

      // Invalidate cache for all entities with overrides in this project
      const promises: Promise<void>[] = [];
      
      for (const override of overrides) {
        switch (override.entity_type) {
          case 'token':
            if (override.issuer && override.currency_code) {
              promises.push(storage.deleteCachedTokenMetadata(override.issuer, override.currency_code));
            }
            break;
            
          case 'collection':
            if (override.issuer && override.taxon !== null && override.taxon !== undefined) {
              promises.push(storage.deleteCachedCollectionMetadata(override.issuer, override.taxon));
            }
            break;
            
          case 'nft':
            if (override.token_id) {
              promises.push(storage.deleteCachedNFTMetadata(override.token_id));
            }
            break;
        }
      }

      await Promise.all(promises);
      console.log(`✅ [CACHE-INVALIDATION] Project update invalidation completed for ${event.projectId}`);
      
    } catch (error) {
      console.error(`❌ [CACHE-INVALIDATION] Failed to handle project update:`, error);
    }
  }

  /**
   * Manually invalidate cache for specific entity
   */
  public async invalidateEntity(
    type: 'token' | 'collection' | 'nft', 
    params: { issuer?: string; currency?: string; taxon?: number; tokenId?: string }
  ): Promise<void> {
    console.log(`🔄 [CACHE-INVALIDATION] Manual invalidation for ${type}:`, params);

    try {
      switch (type) {
        case 'token':
          if (params.issuer && params.currency) {
            await storage.deleteCachedTokenMetadata(params.issuer, params.currency);
            console.log(`✅ [CACHE-INVALIDATION] Manually invalidated token: ${params.currency}:${params.issuer}`);
          }
          break;

        case 'collection':
          if (params.issuer && params.taxon !== undefined) {
            await storage.deleteCachedCollectionMetadata(params.issuer, params.taxon);
            console.log(`✅ [CACHE-INVALIDATION] Manually invalidated collection: ${params.issuer}:${params.taxon}`);
          }
          break;

        case 'nft':
          if (params.tokenId) {
            await storage.deleteCachedNFTMetadata(params.tokenId);
            console.log(`✅ [CACHE-INVALIDATION] Manually invalidated NFT: ${params.tokenId}`);
          }
          break;
      }
    } catch (error) {
      console.error(`❌ [CACHE-INVALIDATION] Manual invalidation failed:`, error);
    }
  }

  /**
   * Invalidate all cached metadata (use with caution)
   */
  public async invalidateAll(): Promise<void> {
    console.log('🗑️ [CACHE-INVALIDATION] Performing full cache invalidation');
    
    try {
      // Clear expired cache (which should clear most/all cache entries)
      await storage.clearExpiredCache();
      console.log('✅ [CACHE-INVALIDATION] Full cache invalidation completed');
    } catch (error) {
      console.error('❌ [CACHE-INVALIDATION] Full cache invalidation failed:', error);
    }
  }

  /**
   * Helper method to trigger invalidation when project content override changes
   */
  public notifyOverrideChanged(
    overrideId: string,
    entityType: 'token' | 'collection' | 'nft',
    entityData: { issuer?: string; currency?: string; taxon?: number; tokenId?: string },
    action: 'created' | 'updated' | 'deleted'
  ): void {
    const affectedEntities: CacheInvalidationEvent['affectedEntities'] = {};

    switch (entityType) {
      case 'token':
        if (entityData.issuer && entityData.currency) {
          affectedEntities.tokens = [{ issuer: entityData.issuer, currency: entityData.currency }];
        }
        break;
      case 'collection':
        if (entityData.issuer && entityData.taxon !== undefined) {
          affectedEntities.collections = [{ issuer: entityData.issuer, taxon: entityData.taxon }];
        }
        break;
      case 'nft':
        if (entityData.tokenId) {
          affectedEntities.nfts = [{ tokenId: entityData.tokenId }];
        }
        break;
    }

    this.emitInvalidation({
      type: 'override_updated',
      entityType,
      affectedEntities,
      reason: `Project content override ${action}: ${overrideId}`,
      timestamp: new Date()
    });
  }

  /**
   * Helper method to trigger invalidation when configuration changes
   */
  public notifyConfigChanged(
    entityType: 'token' | 'collection' | 'nft',
    entityKey: string,
    action: 'created' | 'updated' | 'deleted'
  ): void {
    this.emitInvalidation({
      type: 'config_updated',
      entityType,
      entityKey,
      reason: `Configuration ${action}: ${entityKey}`,
      timestamp: new Date()
    });
  }

  /**
   * Helper method to trigger invalidation when project metadata changes
   */
  public notifyProjectChanged(projectId: string, reason?: string): void {
    this.emitInvalidation({
      type: 'project_updated',
      projectId,
      reason: reason || `Project metadata updated: ${projectId}`,
      timestamp: new Date()
    });
  }

  /**
   * Get cache invalidation statistics
   */
  public getStats(): { [key: string]: number } {
    return {
      override_updates: this.listenerCount('override_updated'),
      config_updates: this.listenerCount('config_updated'),
      project_updates: this.listenerCount('project_updated'),
      total_listeners: this.listenerCount('cache_invalidation')
    };
  }
}

// Export singleton instance
export const cacheInvalidationService = CacheInvalidationService.getInstance();

// Export helper functions for easy use
export const invalidateCache = {
  override: (overrideId: string, entityType: 'token' | 'collection' | 'nft', entityData: any, action: 'created' | 'updated' | 'deleted') => {
    cacheInvalidationService.notifyOverrideChanged(overrideId, entityType, entityData, action);
  },
  
  config: (entityType: 'token' | 'collection' | 'nft', entityKey: string, action: 'created' | 'updated' | 'deleted') => {
    cacheInvalidationService.notifyConfigChanged(entityType, entityKey, action);
  },
  
  project: (projectId: string, reason?: string) => {
    cacheInvalidationService.notifyProjectChanged(projectId, reason);
  },
  
  entity: async (type: 'token' | 'collection' | 'nft', params: any) => {
    await cacheInvalidationService.invalidateEntity(type, params);
  },
  
  all: async () => {
    await cacheInvalidationService.invalidateAll();
  }
};