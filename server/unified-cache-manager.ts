/**
 * Unified Cache Manager
 * 
 * Provides centralized cache management for all token-related data with:
 * - Different TTL strategies for different data types
 * - Cache warming and prefetching capabilities  
 * - Performance monitoring and statistics
 * - Event-driven cache invalidation
 * - Memory management and size limits
 */

import { EventEmitter } from 'events';
import { cacheInvalidationService } from './cache-invalidation-service';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
  source: string;
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number; // Approximate size in bytes
  hitCount: number;
  missCount: number;
  evictionCount: number;
  cachesByType: {
    [cacheType: string]: {
      entries: number;
      size: number;
      hitRate: number;
      avgTtl: number;
    };
  };
  memoryUsage: {
    used: number;
    limit: number;
    utilizationPercent: number;
  };
}

export interface CacheConfig {
  maxEntries?: number;
  maxSizeBytes?: number;
  defaultTtl?: number;
  enableWarming?: boolean;
  enableStats?: boolean;
  cleanupInterval?: number;
}

export class UnifiedCacheManager extends EventEmitter {
  private static instance: UnifiedCacheManager | null = null;
  
  // Cache storage with type-based separation
  private caches: Map<string, Map<string, CacheEntry<any>>> = new Map();
  
  // Cache type configurations
  private readonly cacheTypes = {
    TOKEN_METADATA: { ttl: 2 * 60 * 1000, maxEntries: 10000 }, // 2 minutes
    DEXSCREENER_ANALYTICS: { ttl: 3 * 60 * 1000, maxEntries: 5000 }, // 3 minutes  
    XRPL_TOKEN_LIST: { ttl: 5 * 60 * 1000, maxEntries: 100 }, // 5 minutes
    TRUSTLINE_DATA: { ttl: 1 * 60 * 1000, maxEntries: 5000 }, // 1 minute
    TOKEN_PRICES: { ttl: 30 * 1000, maxEntries: 1000 }, // 30 seconds
    POPULAR_TOKENS: { ttl: 10 * 60 * 1000, maxEntries: 10 }, // 10 minutes
  } as const;

  // Statistics tracking
  private stats = {
    hitCount: 0,
    missCount: 0,
    evictionCount: 0,
    totalSizeBytes: 0,
  };

  private config: CacheConfig;
  private cleanupTimer?: NodeJS.Timeout;
  private warmingInProgress = new Set<string>();

  constructor(config: CacheConfig = {}) {
    super();
    
    this.config = {
      maxEntries: 50000,
      maxSizeBytes: 100 * 1024 * 1024, // 100MB
      defaultTtl: 5 * 60 * 1000, // 5 minutes
      enableWarming: true,
      enableStats: true,
      cleanupInterval: 60 * 1000, // 1 minute
      ...config,
    };

    this.initialize();
  }

  public static getInstance(config?: CacheConfig): UnifiedCacheManager {
    if (!UnifiedCacheManager.instance) {
      UnifiedCacheManager.instance = new UnifiedCacheManager(config);
    }
    return UnifiedCacheManager.instance;
  }

  private initialize(): void {
    // Initialize cache stores for each type
    Object.keys(this.cacheTypes).forEach(type => {
      this.caches.set(type, new Map());
    });

    // Setup cleanup timer
    if (this.config.cleanupInterval) {
      this.cleanupTimer = setInterval(() => {
        this.cleanupExpiredEntries();
      }, this.config.cleanupInterval);
    }

    // Setup cache invalidation listeners
    cacheInvalidationService.on('cache_invalidation', (event) => {
      this.handleInvalidationEvent(event);
    });

    console.log('🗄️ [CACHE-MANAGER] Unified cache manager initialized');
    console.log(`   - Max entries: ${this.config.maxEntries}`);
    console.log(`   - Max size: ${(this.config.maxSizeBytes! / 1024 / 1024).toFixed(1)}MB`);
    console.log(`   - Cache types: ${Object.keys(this.cacheTypes).join(', ')}`);
  }

  /**
   * Get data from cache
   */
  public async get<T>(
    cacheType: keyof typeof this.cacheTypes,
    key: string,
    fallbackFn?: () => Promise<T>
  ): Promise<T | null> {
    const cache = this.caches.get(cacheType);
    if (!cache) {
      console.warn(`⚠️ [CACHE-MANAGER] Unknown cache type: ${cacheType}`);
      return null;
    }

    const entry = cache.get(key);
    const now = Date.now();

    // Check if entry exists and is not expired
    if (entry && (now - entry.timestamp) < entry.ttl) {
      // Update access statistics
      entry.accessCount++;
      entry.lastAccessed = now;
      this.stats.hitCount++;

      console.log(`💾 [CACHE-MANAGER] Cache HIT: ${cacheType}:${key}`);
      return entry.data as T;
    }

    // Cache miss
    this.stats.missCount++;
    console.log(`❌ [CACHE-MANAGER] Cache MISS: ${cacheType}:${key}`);

    // If we have a fallback function, use it to populate the cache
    if (fallbackFn) {
      try {
        console.log(`🔄 [CACHE-MANAGER] Fetching fresh data for ${cacheType}:${key}`);
        const freshData = await fallbackFn();
        await this.set(cacheType, key, freshData);
        return freshData;
      } catch (error) {
        console.error(`❌ [CACHE-MANAGER] Fallback failed for ${cacheType}:${key}:`, error);
        return null;
      }
    }

    return null;
  }

  /**
   * Set data in cache
   */
  public async set<T>(
    cacheType: keyof typeof this.cacheTypes,
    key: string,
    data: T,
    customTtl?: number
  ): Promise<void> {
    const cache = this.caches.get(cacheType);
    if (!cache) {
      console.warn(`⚠️ [CACHE-MANAGER] Unknown cache type: ${cacheType}`);
      return;
    }

    const typeConfig = this.cacheTypes[cacheType];
    const ttl = customTtl || typeConfig.ttl;
    const now = Date.now();

    // Check if we need to evict entries before adding new one
    await this.ensureCapacity(cacheType);

    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      ttl,
      accessCount: 1,
      lastAccessed: now,
      source: 'api',
    };

    cache.set(key, entry);

    // Update size statistics (approximate)
    const entrySize = this.estimateEntrySize(entry);
    this.stats.totalSizeBytes += entrySize;

    console.log(`✅ [CACHE-MANAGER] Cache SET: ${cacheType}:${key} (TTL: ${ttl}ms)`);

    this.emit('cache_set', { cacheType, key, data, ttl });
  }

  /**
   * Delete specific cache entry
   */
  public async delete(cacheType: keyof typeof this.cacheTypes, key: string): Promise<boolean> {
    const cache = this.caches.get(cacheType);
    if (!cache) {
      return false;
    }

    const entry = cache.get(key);
    if (entry) {
      const entrySize = this.estimateEntrySize(entry);
      this.stats.totalSizeBytes -= entrySize;
      cache.delete(key);
      console.log(`🗑️ [CACHE-MANAGER] Cache DELETED: ${cacheType}:${key}`);
      this.emit('cache_delete', { cacheType, key });
      return true;
    }

    return false;
  }

  /**
   * Clear entire cache type
   */
  public async clear(cacheType: keyof typeof this.cacheTypes): Promise<number> {
    const cache = this.caches.get(cacheType);
    if (!cache) {
      return 0;
    }

    const count = cache.size;
    cache.clear();
    console.log(`🗑️ [CACHE-MANAGER] Cache CLEARED: ${cacheType} (${count} entries)`);
    
    this.emit('cache_clear', { cacheType, count });
    return count;
  }

  /**
   * Clear all caches
   */
  public async clearAll(): Promise<number> {
    let totalCount = 0;
    
    for (const [cacheType, cache] of this.caches.entries()) {
      totalCount += cache.size;
      cache.clear();
    }
    
    this.stats.totalSizeBytes = 0;
    this.stats.evictionCount += totalCount;
    
    console.log(`🗑️ [CACHE-MANAGER] ALL caches CLEARED (${totalCount} entries)`);
    this.emit('cache_clear_all', { count: totalCount });
    
    return totalCount;
  }

  /**
   * Warm cache with frequently accessed data
   */
  public async warmCache(cacheType: keyof typeof this.cacheTypes, warmingFn: () => Promise<Array<{key: string, data: any}>>): Promise<number> {
    if (!this.config.enableWarming) {
      console.log(`⚠️ [CACHE-MANAGER] Cache warming disabled`);
      return 0;
    }

    const warmingKey = `${cacheType}`;
    if (this.warmingInProgress.has(warmingKey)) {
      console.log(`⏳ [CACHE-MANAGER] Cache warming already in progress for ${cacheType}`);
      return 0;
    }

    this.warmingInProgress.add(warmingKey);
    
    try {
      console.log(`🔥 [CACHE-MANAGER] Warming cache: ${cacheType}`);
      const entries = await warmingFn();
      
      let warmedCount = 0;
      for (const { key, data } of entries) {
        await this.set(cacheType, key, data);
        warmedCount++;
      }
      
      console.log(`✅ [CACHE-MANAGER] Cache warmed: ${cacheType} (${warmedCount} entries)`);
      this.emit('cache_warmed', { cacheType, count: warmedCount });
      
      return warmedCount;
    } catch (error) {
      console.error(`❌ [CACHE-MANAGER] Cache warming failed for ${cacheType}:`, error);
      return 0;
    } finally {
      this.warmingInProgress.delete(warmingKey);
    }
  }

  /**
   * Get comprehensive cache statistics
   */
  public getStats(): CacheStats {
    const cachesByType: CacheStats['cachesByType'] = {};
    
    // Calculate per-cache-type statistics
    for (const [cacheType, cache] of this.caches.entries()) {
      const entries = Array.from(cache.values());
      const totalHits = entries.reduce((sum, entry) => sum + entry.accessCount, 0);
      const totalTtl = entries.reduce((sum, entry) => sum + entry.ttl, 0);
      const size = entries.reduce((sum, entry) => sum + this.estimateEntrySize(entry), 0);

      cachesByType[cacheType] = {
        entries: cache.size,
        size,
        hitRate: totalHits > 0 ? (this.stats.hitCount / (this.stats.hitCount + this.stats.missCount)) * 100 : 0,
        avgTtl: cache.size > 0 ? totalTtl / cache.size : 0,
      };
    }

    const totalEntries = Array.from(this.caches.values()).reduce((sum, cache) => sum + cache.size, 0);

    return {
      totalEntries,
      totalSize: this.stats.totalSizeBytes,
      hitCount: this.stats.hitCount,
      missCount: this.stats.missCount,
      evictionCount: this.stats.evictionCount,
      cachesByType,
      memoryUsage: {
        used: this.stats.totalSizeBytes,
        limit: this.config.maxSizeBytes!,
        utilizationPercent: (this.stats.totalSizeBytes / this.config.maxSizeBytes!) * 100,
      },
    };
  }

  /**
   * Check cache health and performance
   */
  public async healthCheck(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    recommendations: string[];
    stats: CacheStats;
  }> {
    const stats = this.getStats();
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Check memory usage
    if (stats.memoryUsage.utilizationPercent > 90) {
      issues.push('Cache memory usage above 90%');
      recommendations.push('Consider increasing cache size limit or reducing TTLs');
    } else if (stats.memoryUsage.utilizationPercent > 75) {
      recommendations.push('Monitor memory usage - approaching limit');
    }

    // Check hit rate
    const totalRequests = stats.hitCount + stats.missCount;
    const hitRate = totalRequests > 0 ? (stats.hitCount / totalRequests) * 100 : 0;
    
    if (hitRate < 50 && totalRequests > 100) {
      issues.push(`Low cache hit rate: ${hitRate.toFixed(1)}%`);
      recommendations.push('Consider adjusting TTLs or cache warming strategies');
    }

    // Check for excessive entries in any cache type  
    for (const [cacheType, cacheStats] of Object.entries(stats.cachesByType)) {
      const typeConfig = this.cacheTypes[cacheType as keyof typeof this.cacheTypes];
      if (cacheStats.entries > typeConfig.maxEntries * 0.9) {
        issues.push(`Cache type ${cacheType} near capacity`);
        recommendations.push(`Consider increasing maxEntries for ${cacheType}`);
      }
    }

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (issues.length > 2) {
      status = 'critical';
    } else if (issues.length > 0 || recommendations.length > 1) {
      status = 'warning';
    }

    return {
      status,
      issues,
      recommendations,
      stats,
    };
  }

  /**
   * Clean up expired cache entries
   */
  private async cleanupExpiredEntries(): Promise<number> {
    const now = Date.now();
    let totalCleaned = 0;

    for (const [cacheType, cache] of this.caches.entries()) {
      const expiredKeys: string[] = [];
      
      for (const [key, entry] of cache.entries()) {
        if (now - entry.timestamp > entry.ttl) {
          expiredKeys.push(key);
        }
      }

      for (const key of expiredKeys) {
        const entry = cache.get(key);
        if (entry) {
          const entrySize = this.estimateEntrySize(entry);
          this.stats.totalSizeBytes -= entrySize;
          this.stats.evictionCount++;
        }
        cache.delete(key);
        totalCleaned++;
      }

      if (expiredKeys.length > 0) {
        console.log(`🧹 [CACHE-MANAGER] Cleaned ${expiredKeys.length} expired entries from ${cacheType}`);
      }
    }

    if (totalCleaned > 0) {
      console.log(`🧹 [CACHE-MANAGER] Total cleanup: ${totalCleaned} expired entries`);
      this.emit('cache_cleanup', { cleaned: totalCleaned });
    }

    return totalCleaned;
  }

  /**
   * Ensure cache capacity before adding new entries
   */
  private async ensureCapacity(cacheType: keyof typeof this.cacheTypes): Promise<void> {
    const cache = this.caches.get(cacheType);
    const typeConfig = this.cacheTypes[cacheType];
    
    if (!cache) return;

    // Check cache type specific limits
    if (cache.size >= typeConfig.maxEntries) {
      await this.evictLeastRecentlyUsed(cache, Math.floor(typeConfig.maxEntries * 0.1)); // Evict 10%
    }

    // Check global memory limits
    if (this.stats.totalSizeBytes > this.config.maxSizeBytes!) {
      await this.evictByMemoryPressure();
    }
  }

  /**
   * Evict least recently used entries
   */
  private async evictLeastRecentlyUsed(cache: Map<string, CacheEntry<any>>, count: number): Promise<void> {
    const entries = Array.from(cache.entries())
      .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed)
      .slice(0, count);

    for (const [key, entry] of entries) {
      const entrySize = this.estimateEntrySize(entry);
      this.stats.totalSizeBytes -= entrySize;
      this.stats.evictionCount++;
      cache.delete(key);
    }

    if (count > 0) {
      console.log(`🗑️ [CACHE-MANAGER] Evicted ${count} LRU entries`);
    }
  }

  /**
   * Evict entries based on memory pressure
   */
  private async evictByMemoryPressure(): Promise<void> {
    // Collect all entries across all caches, sorted by access pattern
    const allEntries: Array<{ cacheType: string; key: string; entry: CacheEntry<any> }> = [];
    
    for (const [cacheType, cache] of this.caches.entries()) {
      for (const [key, entry] of cache.entries()) {
        allEntries.push({ cacheType, key, entry });
      }
    }

    // Sort by least recently used
    allEntries.sort((a, b) => a.entry.lastAccessed - b.entry.lastAccessed);

    // Evict until we're under the memory limit
    const targetSize = this.config.maxSizeBytes! * 0.8; // Target 80% of max
    let evicted = 0;

    for (const { cacheType, key, entry } of allEntries) {
      if (this.stats.totalSizeBytes <= targetSize) break;

      const cache = this.caches.get(cacheType);
      if (cache) {
        const entrySize = this.estimateEntrySize(entry);
        this.stats.totalSizeBytes -= entrySize;
        this.stats.evictionCount++;
        cache.delete(key);
        evicted++;
      }
    }

    if (evicted > 0) {
      console.log(`🗑️ [CACHE-MANAGER] Memory pressure eviction: ${evicted} entries`);
    }
  }

  /**
   * Estimate entry size in bytes (rough approximation)
   */
  private estimateEntrySize(entry: CacheEntry<any>): number {
    try {
      const jsonString = JSON.stringify(entry);
      return jsonString.length * 2; // Approximate Unicode overhead
    } catch {
      return 1024; // Default estimate if serialization fails
    }
  }

  /**
   * Handle cache invalidation events from the invalidation service
   */
  private async handleInvalidationEvent(event: any): Promise<void> {
    console.log(`🔄 [CACHE-MANAGER] Processing invalidation event: ${event.type}`);
    
    // For now, we'll invalidate all related token caches when any invalidation event occurs
    // This can be made more specific based on the event details
    
    if (event.affectedEntities?.tokens) {
      for (const token of event.affectedEntities.tokens) {
        const tokenKey = `${token.issuer}:${token.currency}`;
        await this.delete('TOKEN_METADATA', tokenKey);
        await this.delete('DEXSCREENER_ANALYTICS', tokenKey);
      }
    }

    // Invalidate trustline caches if needed
    if (event.type === 'trustline_updated' || event.type === 'override_updated') {
      await this.clear('TRUSTLINE_DATA');
      console.log('🗑️ [CACHE-MANAGER] Cleared trustline caches due to invalidation event');
    }
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.removeAllListeners();
    this.caches.clear();
    console.log('🗄️ [CACHE-MANAGER] Cache manager destroyed');
  }
}

// Export singleton instance
export const cacheManager = UnifiedCacheManager.getInstance();

// Export cache type constants for external use
export const CACHE_TYPES = {
  TOKEN_METADATA: 'TOKEN_METADATA' as const,
  DEXSCREENER_ANALYTICS: 'DEXSCREENER_ANALYTICS' as const,
  XRPL_TOKEN_LIST: 'XRPL_TOKEN_LIST' as const,
  TRUSTLINE_DATA: 'TRUSTLINE_DATA' as const,
  TOKEN_PRICES: 'TOKEN_PRICES' as const,
  POPULAR_TOKENS: 'POPULAR_TOKENS' as const,
};