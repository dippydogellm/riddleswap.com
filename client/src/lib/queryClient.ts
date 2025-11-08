// @ts-ignore - TS server needs restart, package is installed
import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { sessionManager } from "@/utils/sessionManager";

// Track consecutive 401 errors to avoid clearing session too aggressively
let consecutiveUnauthorized = 0;
let lastUnauthorizedTime = 0;
let lastClearTime = 0;

// Clear ALL session and wallet data when unauthorized
export function clearAllWalletData() {
  // Throttle clearing to prevent spam - only allow clearing once every 30 seconds
  const now = Date.now();
  if (now - lastClearTime < 30000) {
    console.log('🔒 Skipping wallet data clear - too recent (throttled)');
    return;
  }
  
  lastClearTime = now;
  console.log('🧹 Clearing ALL wallet and session data...');
  
  // Use sessionManager to clear session data consistently
  sessionManager.clearSession();
  
  // Clear additional wallet data not handled by sessionManager
  localStorage.removeItem('riddle_wallet_data');
  localStorage.removeItem('riddle_wallet_addresses');
  localStorage.removeItem('riddleWallet');
  
  // Clear all riddle_wallet_* keys
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('riddle_wallet_')) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
  
  // Clear Xaman/XRPL wallet data
  localStorage.removeItem('xrpl_wallet_connected');
  localStorage.removeItem('xrpl_wallet_address');
  localStorage.removeItem('xrpl_wallet_type');
  localStorage.removeItem('xaman_pending_uuid');
  localStorage.removeItem('xaman_pending_timestamp');
  
  // Clear WalletConnect/AppKit data
  localStorage.removeItem('wagmi.store');
  localStorage.removeItem('wc@2:core:0.3//keychain');
  localStorage.removeItem('wc@2:client:0.3//session');
  localStorage.removeItem('@w3m/wallet_id');
  
  // Clear temporary password if any
  sessionStorage.removeItem('riddle_temp_password');
  
  // Clear all cached queries (they may contain stale auth data)
  if (typeof window !== 'undefined') {
    // Only access queryClient if we're in browser context
    setTimeout(() => {
      queryClient.clear();
    }, 0);
  }
  
  // Reset unauthorized counter
  consecutiveUnauthorized = 0;
  console.log('✅ All wallet and session data cleared');
}

// Legacy function for backward compatibility
function clearSessionData() {
  clearAllWalletData();
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    if (res.status === 401) {
      console.log('🔓 Got 401 error - NOT clearing session data automatically');
      // Don't clear session data automatically - let user logout manually
      // This prevents the cascade of 401 errors from clearing valid sessions
    }
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  url: string,
  options?: {
    method?: string;
    body?: string;
    headers?: Record<string, string>;
  }
): Promise<Response> {
  // Get session token for authentication using sessionManager
  const sessionToken = sessionManager.getSessionToken();
  console.log('🔍 SessionManager sessionToken:', sessionToken ? 'FOUND' : 'NOT FOUND');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options?.headers
  };

  // Add authorization header if session token is available
  if (sessionToken) {
    headers['Authorization'] = `Bearer ${sessionToken}`;
  }

  const res = await fetch(url, {
    method: options?.method || 'GET',
    headers,
    body: options?.body,
    credentials: "include",
  });

  // Handle 401 errors - DON'T clear session data automatically to prevent auth loops
  // Let AuthGuard handle session validation instead
  if (res.status === 401) {
    console.log('🔓 apiRequest got 401 - NOT clearing session data (AuthGuard will handle)');
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Get session token for authentication using sessionManager
    let sessionToken = sessionManager.getSessionToken();
    // Only log for non-notification requests to reduce spam
    const isNotificationRequest = (queryKey[0] as string).includes('messaging/notifications');
    
    if (!isNotificationRequest) {
      console.log('🔍 getQueryFn - SessionManager sessionToken:', sessionToken ? 'FOUND' : 'NOT FOUND');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    // Add authorization header if session token is available
    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }

    // Build URL with query parameters if provided
    let url = queryKey[0] as string;
    if (queryKey[1] && typeof queryKey[1] === 'object' && !Array.isArray(queryKey[1])) {
      const params = new URLSearchParams();
      Object.entries(queryKey[1] as Record<string, any>).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
    }

    let res = await fetch(url, {
      credentials: "include",
      headers,
    });

    // If 401 and we have a session token, try renewing the session automatically
    if (res.status === 401 && sessionToken) {
      console.log('🔄 [QUERY] Got 401 - attempting automatic session renewal');
      
      try {
        // Attempt session renewal using the old token
        const renewResponse = await fetch('/api/riddle-wallet/renew-session', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (renewResponse.ok) {
          const renewData = await renewResponse.json();
          if (renewData.success && renewData.sessionToken) {
            console.log('✅ [QUERY] Session renewed successfully - retrying request');
            
            // Update session token in sessionManager and storage
            sessionManager.setSessionToken(renewData.sessionToken);
            
            // Retry the original request with new token
            const newHeaders = { ...headers };
            newHeaders['Authorization'] = `Bearer ${renewData.sessionToken}`;
            
            res = await fetch(url, {
              credentials: "include",
              headers: newHeaders,
            });
          }
        }
      } catch (renewError) {
        console.error('⚠️  [QUERY] Session renewal failed:', renewError);
        // Continue with original 401 response
      }
    }

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      // Only log 401 errors for non-notification requests to reduce spam
      if (!isNotificationRequest) {
        console.log('🔓 Got 401 error - allowing public/unauthenticated response');
      }
      return null;
    }

    await throwIfResNotOk(res);
    const data = await res.json() as any;
    
    // Check if the response indicates session renewal is needed
    if (data && typeof data === 'object' && data.needsRenewal === true) {
      console.log('⚠️ [QUERY] API response indicates session renewal needed');
      // Trigger a session check to update the needsRenewal flag
      // The sessionManager will handle the renewal modal automatically
      sessionManager.checkSession();
    }
    
    return data;
  };

// Cache configuration type for consistent typing
type CacheConfig = {
  staleTime: number;
  gcTime: number;
  refetchInterval: number | false;
  refetchOnWindowFocus: boolean;
};

// Cache configurations for different data types aligned with backend TTLs
const CACHE_CONFIG: Record<string, CacheConfig> = {
  // Token prices and live data - frequent updates needed
  TOKEN_PRICES: {
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 60 * 1000, // 1 minute background refresh
    refetchOnWindowFocus: true,
  },
  
  // Token metadata (names, symbols, logos) - matches backend 2-minute TTL
  TOKEN_METADATA: {
    staleTime: 2 * 60 * 1000, // 2 minutes (matches backend cache)
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchInterval: false,
    refetchOnWindowFocus: false,
  },
  
  // Analytics data - matches backend 3-minute TTL
  ANALYTICS_DATA: {
    staleTime: 3 * 60 * 1000, // 3 minutes (matches backend cache)
    gcTime: 15 * 60 * 1000, // 15 minutes
    refetchInterval: false,
    refetchOnWindowFocus: true,
  },
  
  // Token lists - matches backend 5-minute TTL
  TOKEN_LISTS: {
    staleTime: 5 * 60 * 1000, // 5 minutes (matches backend cache)
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchInterval: false,
    refetchOnWindowFocus: false,
  },
  
  // Popular tokens - matches backend 10-minute TTL
  POPULAR_TOKENS: {
    staleTime: 10 * 60 * 1000, // 10 minutes (matches backend cache)
    gcTime: 2 * 60 * 60 * 1000, // 2 hours
    refetchInterval: false,
    refetchOnWindowFocus: false,
  },
  
  // Trustline data - matches backend 1-minute TTL
  TRUSTLINE_DATA: {
    staleTime: 1 * 60 * 1000, // 1 minute (matches backend cache)
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: false,
    refetchOnWindowFocus: true,
  },
  
  // User account data - needs to be relatively fresh
  ACCOUNT_DATA: {
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: false,
    refetchOnWindowFocus: true,
  },
  
  // Static or rarely changing data
  STATIC_DATA: {
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
    refetchInterval: false,
    refetchOnWindowFocus: false,
  },
  
  // Default for unknown query types
  DEFAULT: {
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchInterval: false,
    refetchOnWindowFocus: false,
  }
};

// Helper function to get cache config based on query key - improved robustness
function getCacheConfig(queryKey: unknown[]): CacheConfig {
  if (!Array.isArray(queryKey) || queryKey.length === 0) {
    return CACHE_CONFIG.DEFAULT;
  }
  
  // Handle both string keys and URL-with-params keys
  const key = (queryKey[0] as string).toLowerCase();
  
  // Extract base path from query string if present
  const basePath = key.split('?')[0];
  
  // Token prices and live data - more comprehensive matching
  if (basePath.includes('/token-price') || basePath.includes('/price') || 
      basePath.includes('/live') || key.includes('price')) {
    return CACHE_CONFIG.TOKEN_PRICES;
  }
  
  // Analytics data - improved matching for DexScreener and analytics endpoints
  if (basePath.includes('/analytics') || basePath.includes('/dexscreener') ||
      basePath.includes('/token') && (key.includes('analytics') || key.includes('dexscreener'))) {
    return CACHE_CONFIG.ANALYTICS_DATA;
  }
  
  // Token metadata - enhanced pattern matching
  if ((basePath.includes('/token') || basePath.includes('/tokens')) && 
      (key.includes('metadata') || key.includes('search') || key.includes('info') || 
       key.includes('details') || key.includes('symbol'))) {
    return CACHE_CONFIG.TOKEN_METADATA;
  }
  
  // Popular tokens - specific handling for popular token endpoints
  if (basePath.includes('/popular-tokens') || key.includes('popular')) {
    return CACHE_CONFIG.POPULAR_TOKENS;
  }
  
  // Token lists - comprehensive list endpoint matching
  if (basePath.includes('/tokens/all') || basePath.includes('/tokens/search') || 
      basePath.includes('/token-list') || (basePath.includes('/tokens') && key.includes('list'))) {
    return CACHE_CONFIG.TOKEN_LISTS;
  }
  
  // Trustline data - enhanced trustline detection
  if (basePath.includes('/trustline') || basePath.includes('/account-lines') ||
      basePath.includes('/account_lines') || key.includes('trustline')) {
    return CACHE_CONFIG.TRUSTLINE_DATA;
  }
  
  // Account/wallet data - broader matching
  if (basePath.includes('/account') || basePath.includes('/wallet') || 
      basePath.includes('/balance') || basePath.includes('/balances')) {
    return CACHE_CONFIG.ACCOUNT_DATA;
  }
  
  // Static data (chains, configurations, etc.)
  if (basePath.includes('/chains') || basePath.includes('/config') || 
      basePath.includes('/static') || basePath.includes('/constants')) {
    return CACHE_CONFIG.STATIC_DATA;
  }
  
  return CACHE_CONFIG.DEFAULT;
}

/**
 * Get query options with appropriate cache configuration
 * Use this helper in components instead of hardcoding cache values
 */
export function getQueryOptions<T>(queryKey: unknown[], additionalOptions?: any) {
  const config = getCacheConfig(queryKey);
  
  const baseOptions = {
    queryKey,
    staleTime: config.staleTime,
    gcTime: config.gcTime,
    refetchInterval: config.refetchInterval,
    refetchOnWindowFocus: config.refetchOnWindowFocus,
    ...additionalOptions,
  };
  
  console.log(`💾 [CACHE] Query configured with ${
    config === CACHE_CONFIG.TOKEN_PRICES ? 'PRICE' : 
    config === CACHE_CONFIG.ANALYTICS_DATA ? 'ANALYTICS' :
    config === CACHE_CONFIG.TOKEN_METADATA ? 'METADATA' :
    config === CACHE_CONFIG.TOKEN_LISTS ? 'TOKEN_LIST' :
    config === CACHE_CONFIG.POPULAR_TOKENS ? 'POPULAR_TOKENS' :
    config === CACHE_CONFIG.TRUSTLINE_DATA ? 'TRUSTLINE' :
    config === CACHE_CONFIG.ACCOUNT_DATA ? 'ACCOUNT' :
    config === CACHE_CONFIG.STATIC_DATA ? 'STATIC' : 'DEFAULT'
  } config: ${queryKey[0]}`);
  
  return baseOptions;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      retry: false, // DISABLE automatic retries - prevents hammering server
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
      // DISABLE all automatic refetching to prevent unnecessary server requests
      staleTime: Infinity, // Never mark queries as stale automatically
      gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
      refetchInterval: false, // NEVER automatically refetch in background
      refetchOnWindowFocus: false, // NEVER refetch when window gains focus
      refetchOnMount: false, // NEVER refetch when component mounts if data exists
      refetchOnReconnect: false, // NEVER refetch when network reconnects
    },
    mutations: {
      retry: false, // DISABLE mutation retries too
      onSuccess: () => {
        console.log('🔄 [CACHE] Mutation succeeded, considering cache invalidation');
      },
    },
  },
});

// Note: Removed fetchQuery override as it doesn't affect useQuery calls.
// Components should use getQueryOptions() helper function instead for proper cache configuration.

// Helper functions for cache management

/**
 * Invalidate token-related caches
 */
export function invalidateTokenCaches(tokenSymbol?: string, issuer?: string) {
  console.log(`🧹 [CACHE] Invalidating token caches for ${tokenSymbol || 'all tokens'}`);
  
  if (tokenSymbol) {
    // Invalidate specific token data
    queryClient.invalidateQueries({ 
      queryKey: ['/api/analytics/xrpl/token'],
      predicate: (query) => {
        const [, params] = query.queryKey;
        if (params && typeof params === 'object') {
          return (params as any).symbol === tokenSymbol && 
                 (!issuer || (params as any).issuer === issuer);
        }
        return false;
      }
    });
  } else {
    // Invalidate all token-related data
    queryClient.invalidateQueries({ 
      predicate: (query) => {
        const key = query.queryKey[0] as string;
        return key.includes('/token') || key.includes('/analytics');
      }
    });
  }
}

/**
 * Invalidate trustline-related caches
 */
export function invalidateTrustlineCaches(address?: string) {
  console.log(`🧹 [CACHE] Invalidating trustline caches for ${address || 'all addresses'}`);
  
  queryClient.invalidateQueries({ 
    predicate: (query): boolean => {
      const key = query.queryKey[0] as string;
      if (!key.includes('/trustline')) return false;
      
      if (address) {
        // Check if this query is for the specific address
        const queryData = query.queryKey[1];
        return Boolean(queryData && typeof queryData === 'object' && 
               (queryData as any).address === address);
      }
      
      return true;
    }
  });
}

/**
 * Warm up cache with commonly used data
 */
export async function warmCache() {
  console.log('🔥 [CACHE] Warming up frontend cache...');
  
  try {
    // Pre-fetch popular tokens with appropriate cache config
    const popularTokensConfig = CACHE_CONFIG.TOKEN_LISTS;
    queryClient.prefetchQuery({
      queryKey: ['/api/xrpl/popular-tokens'],
      staleTime: popularTokensConfig.staleTime,
      gcTime: popularTokensConfig.gcTime,
    });
    
    // Pre-fetch XRP price data
    const analyticsConfig = CACHE_CONFIG.ANALYTICS_DATA;
    queryClient.prefetchQuery({
      queryKey: ['/api/analytics/xrpl/token', { symbol: 'XRP' }],
      staleTime: analyticsConfig.staleTime,
      gcTime: analyticsConfig.gcTime,
    });
    
    console.log('✅ [CACHE] Frontend cache warming completed');
  } catch (error) {
    console.error('❌ [CACHE] Cache warming failed:', error);
  }
}

/**
 * Get cache statistics for monitoring
 */
export function getCacheStats() {
  const queryCache = queryClient.getQueryCache();
  const queries = queryCache.getAll();
  
  const stats = {
    totalQueries: queries.length,
    staleQueries: queries.filter(q => q.isStale()).length,
    activeQueries: queries.filter(q => q.getObserversCount() > 0).length,
    errorQueries: queries.filter(q => q.state.status === 'error').length,
    cacheSize: JSON.stringify(queries).length, // Rough estimate
    queryTypes: {} as Record<string, number>,
  };
  
  // Count queries by type
  queries.forEach(query => {
    const key = query.queryKey[0] as string;
    const type = key.split('/')[2] || 'unknown';
    stats.queryTypes[type] = (stats.queryTypes[type] || 0) + 1;
  });
  
  return stats;
}

/**
 * Clear all caches (for debugging/reset)
 */
export function clearAllCaches() {
  console.log('🧹 [CACHE] Clearing all frontend caches...');
  queryClient.clear();
  console.log('✅ [CACHE] All frontend caches cleared');
}

// Export cache configurations for external use
export { CACHE_CONFIG };
