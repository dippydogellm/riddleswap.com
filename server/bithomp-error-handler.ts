/**
 * Bithomp API Error Handler and Fallback System
 * 
 * Provides comprehensive error handling, retry logic, caching, and fallback mechanisms
 * for Bithomp API integration to ensure robust project claim processing.
 */

interface BithompCacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
  threshold: number;
  timeout: number;
}

class BithompErrorHandler {
  private cache = new Map<string, BithompCacheEntry>();
  private circuitBreaker: CircuitBreakerState = {
    failures: 0,
    lastFailure: 0,
    state: 'closed',
    threshold: 3, // Open circuit after 3 failures
    timeout: 30000 // 30 seconds
  };

  private defaultRetryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 10000, // 10 seconds
    backoffMultiplier: 2
  };

  /**
   * Execute Bithomp API call with comprehensive error handling
   */
  async executeWithFallbacks<T>(
    operation: () => Promise<T>,
    fallbackOperations: Array<() => Promise<T>>,
    cacheKey?: string,
    cacheTTL: number = 300000 // 5 minutes default
  ): Promise<{ success: boolean; data?: T; error?: string; source: string }> {
    
    // Check cache first
    if (cacheKey) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        console.log(`✅ Bithomp data served from cache: ${cacheKey}`);
        return { success: true, data: cached, source: 'cache' };
      }
    }

    // Check circuit breaker
    if (this.isCircuitOpen()) {
      console.log(`🔴 Bithomp circuit breaker is open, using fallbacks immediately`);
      return await this.executeFallbacks(fallbackOperations);
    }

    // Try main operation with retries
    try {
      const result = await this.executeWithRetry(operation);
      
      // Reset circuit breaker on success
      this.resetCircuitBreaker();
      
      // Cache successful result
      if (cacheKey && result) {
        this.setCache(cacheKey, result, cacheTTL);
      }
      
      return { success: true, data: result, source: 'bithomp_api' };
      
    } catch (error) {
      console.error(`❌ Bithomp API failed after retries:`, error);
      
      // Record failure in circuit breaker
      this.recordFailure();
      
      // Try fallback operations
      const fallbackResult = await this.executeFallbacks(fallbackOperations);
      
      if (fallbackResult.success) {
        return fallbackResult;
      }
      
      // All operations failed
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: 'failed_all'
      };
    }
  }

  /**
   * Execute operation with exponential backoff retry
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: RetryConfig = this.defaultRetryConfig
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        const result = await operation();
        
        if (attempt > 0) {
          console.log(`✅ Bithomp API succeeded on attempt ${attempt + 1}`);
        }
        
        return result;
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt === config.maxRetries) {
          console.error(`❌ Bithomp API failed on final attempt ${attempt + 1}:`, lastError.message);
          throw lastError;
        }
        
        // Calculate delay with exponential backoff
        const delay = Math.min(
          config.baseDelay * Math.pow(config.backoffMultiplier, attempt),
          config.maxDelay
        );
        
        console.log(`⚠️ Bithomp API failed on attempt ${attempt + 1}, retrying in ${delay}ms:`, lastError.message);
        
        await this.sleep(delay);
      }
    }
    
    throw lastError!;
  }

  /**
   * Execute fallback operations in sequence
   */
  private async executeFallbacks<T>(
    fallbackOperations: Array<() => Promise<T>>
  ): Promise<{ success: boolean; data?: T; error?: string; source: string }> {
    
    for (let i = 0; i < fallbackOperations.length; i++) {
      try {
        console.log(`🔄 Attempting fallback operation ${i + 1}/${fallbackOperations.length}`);
        
        const result = await fallbackOperations[i]();
        
        console.log(`✅ Fallback operation ${i + 1} succeeded`);
        
        return { 
          success: true, 
          data: result, 
          source: `fallback_${i + 1}` 
        };
        
      } catch (error) {
        console.error(`❌ Fallback operation ${i + 1} failed:`, error);
        
        if (i === fallbackOperations.length - 1) {
          return {
            success: false,
            error: `All fallback operations failed. Last error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            source: 'failed_fallbacks'
          };
        }
      }
    }
    
    return {
      success: false,
      error: 'No fallback operations provided',
      source: 'no_fallbacks'
    };
  }

  /**
   * Circuit breaker logic
   */
  private isCircuitOpen(): boolean {
    const now = Date.now();
    
    if (this.circuitBreaker.state === 'open') {
      if (now - this.circuitBreaker.lastFailure > this.circuitBreaker.timeout) {
        this.circuitBreaker.state = 'half-open';
        console.log(`🟡 Bithomp circuit breaker moved to half-open state`);
        return false;
      }
      return true;
    }
    
    return false;
  }

  private recordFailure(): void {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailure = Date.now();
    
    if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
      this.circuitBreaker.state = 'open';
      console.log(`🔴 Bithomp circuit breaker opened after ${this.circuitBreaker.failures} failures`);
    }
  }

  private resetCircuitBreaker(): void {
    if (this.circuitBreaker.state === 'half-open' || this.circuitBreaker.failures > 0) {
      console.log(`🟢 Bithomp circuit breaker reset - service recovered`);
    }
    
    this.circuitBreaker.failures = 0;
    this.circuitBreaker.state = 'closed';
  }

  /**
   * Cache management
   */
  private getFromCache(key: string): any | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  private setCache(key: string, data: any, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
    
    // Clean up old cache entries periodically
    if (this.cache.size > 100) {
      this.cleanupCache();
    }
  }

  private cleanupCache(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 Cleaned ${cleaned} expired cache entries`);
    }
  }

  /**
   * Utility methods
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get circuit breaker status for monitoring
   */
  getStatus() {
    return {
      circuitBreaker: { ...this.circuitBreaker },
      cacheSize: this.cache.size,
      cacheKeys: Array.from(this.cache.keys())
    };
  }

  /**
   * Clear cache manually (for testing/debugging)
   */
  clearCache(): void {
    this.cache.clear();
    console.log(`🧹 Bithomp cache cleared manually`);
  }
}

// Export singleton instance
export const bithompErrorHandler = new BithompErrorHandler();

/**
 * Enhanced Bithomp collection fetcher with fallbacks
 */
export async function getBithompCollectionWithFallbacks(issuer: string, taxon: number) {
  const cacheKey = `collection:${issuer}:${taxon}`;
  
  // Import here to avoid circular dependencies
  const { getBithompCollection } = await import('./bithomp-api-v2');
  
  // Main operation
  const mainOperation = async () => {
    const result = await getBithompCollection(issuer, taxon);
    if (!result.success) {
      throw new Error(result.error || 'Bithomp API failed');
    }
    return result;
  };

  // Fallback operations
  const fallbackOperations = [
    // Fallback 1: Try with different API parameters
    async () => {
      console.log(`🔄 Fallback 1: Trying Bithomp with minimal parameters`);
      const { bithompAPI } = await import('./bithomp-api-v2');
      const collection = await bithompAPI.getCollectionInfo(issuer, taxon);
      if (collection) {
        return { success: true, collection, hasData: true };
      }
      throw new Error('Bithomp minimal fetch failed');
    },

    // Fallback 2: Create basic collection from known data
    async () => {
      console.log(`🔄 Fallback 2: Creating basic collection structure`);
      return {
        success: true,
        collection: {
          issuer,
          taxon,
          name: `Collection ${taxon}`,
          description: `NFT Collection from issuer ${issuer}`,
          verified: false,
          totalNFTs: 0,
          owners: 0,
          floorPrice: 0,
          floorPriceUsd: 0,
          volume24h: 0,
          volume24hUsd: 0
        },
        hasData: true,
        source: 'fallback_basic'
      };
    }
  ];

  return await bithompErrorHandler.executeWithFallbacks(
    mainOperation,
    fallbackOperations,
    cacheKey,
    300000 // 5 minutes cache
  );
}

/**
 * Rate limiting protection wrapper
 */
export class RateLimitProtection {
  private static requests = new Map<string, number[]>();
  private static readonly WINDOW_SIZE = 60000; // 1 minute
  private static readonly MAX_REQUESTS = 30; // 30 requests per minute

  static async checkRateLimit(identifier: string): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - this.WINDOW_SIZE;
    
    // Get or create request history for this identifier
    if (!this.requests.has(identifier)) {
      this.requests.set(identifier, []);
    }
    
    const requestHistory = this.requests.get(identifier)!;
    
    // Remove old requests outside the window
    const validRequests = requestHistory.filter(timestamp => timestamp > windowStart);
    this.requests.set(identifier, validRequests);
    
    // Check if we're under the limit
    if (validRequests.length >= this.MAX_REQUESTS) {
      console.log(`🚫 Rate limit exceeded for ${identifier}: ${validRequests.length}/${this.MAX_REQUESTS} requests`);
      return false;
    }
    
    // Record this request
    validRequests.push(now);
    return true;
  }
}

export default {
  bithompErrorHandler,
  getBithompCollectionWithFallbacks,
  RateLimitProtection
};