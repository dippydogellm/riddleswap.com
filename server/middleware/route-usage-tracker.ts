import type { Request, Response, NextFunction } from 'express';
import { RouteInventorySystem } from '../route-inventory-system';

/**
 * Lightweight route usage tracking middleware
 * Increments per-route counters for analyzing endpoint usage patterns
 */

let requestCount = 0;
const startTime = Date.now();

export function createRouteUsageTracker() {
  const inventorySystem = RouteInventorySystem.getInstance();
  
  return (req: Request, res: Response, next: NextFunction): void => {
    requestCount++;
    
    // Extract normalized route info
    const method = req.method;
    const originalUrl = req.originalUrl || req.url;
    
    // Clean up query params and fragments for consistent tracking
    const cleanPath = originalUrl.split('?')[0].split('#')[0];
    
    // Skip tracking for certain patterns to reduce noise
    if (shouldSkipTracking(cleanPath, method)) {
      return next();
    }
    
    // Track the route access
    inventorySystem.trackAccess(method, cleanPath);
    
    // Continue with request processing
    next();
  };
}

/**
 * Determine if route should be skipped from tracking
 */
function shouldSkipTracking(path: string, method: string): boolean {
  // Skip static assets and common noise
  const skipPatterns = [
    /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|webp|map)(\?.*)?$/,
    /^\/favicon\.ico/,
    /^\/robots\.txt/,
    /^\/sitemap\.xml/,
    /^\/manifest\.json/,
    /^\/sw\.js/,
    /^\/service-worker\.js/,
    /^\/__vite/,  // Vite HMR
    /^\/node_modules/,
    /^\/\.well-known/,
    /^\/health$/,  // Skip health checks to reduce noise
  ];
  
  // Skip if matches any pattern
  if (skipPatterns.some(pattern => pattern.test(path))) {
    return true;
  }
  
  // Skip preflight requests
  if (method === 'OPTIONS') {
    return true;
  }
  
  return false;
}

/**
 * Get basic usage statistics for logging
 */
export function getUsageStats() {
  const inventorySystem = RouteInventorySystem.getInstance();
  const usage = inventorySystem.getUsageStats();
  const uptime = Date.now() - startTime;
  
  return {
    totalRequests: requestCount,
    uniqueRoutes: Object.keys(usage).length,
    uptimeMs: uptime,
    uptimeHours: Math.round(uptime / (1000 * 60 * 60) * 100) / 100,
    mostUsedRoutes: Object.entries(usage)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([route, count]) => ({ route, count }))
  };
}

/**
 * Enhanced route usage tracker that also captures route patterns
 * This version normalizes parameterized routes (e.g., /api/user/:id -> /api/user/[id])
 */
export function createEnhancedRouteUsageTracker() {
  const inventorySystem = RouteInventorySystem.getInstance();
  
  return (req: Request, res: Response, next: NextFunction): void => {
    requestCount++;
    
    const method = req.method;
    const originalUrl = req.originalUrl || req.url;
    const cleanPath = originalUrl.split('?')[0].split('#')[0];
    
    if (shouldSkipTracking(cleanPath, method)) {
      return next();
    }
    
    // Track both exact path and normalized pattern
    inventorySystem.trackAccess(method, cleanPath);
    
    // Also track normalized route pattern if available
    const normalizedPath = normalizeRoutePath(cleanPath, req.route?.path);
    if (normalizedPath && normalizedPath !== cleanPath) {
      inventorySystem.trackAccess(method, normalizedPath);
    }
    
    next();
  };
}

/**
 * Normalize route path by replacing parameters with placeholders
 */
function normalizeRoutePath(actualPath: string, routePattern?: string): string | null {
  if (!routePattern) return null;
  
  // Replace common parameter patterns
  let normalized = actualPath;
  
  // Replace UUIDs with [uuid]
  normalized = normalized.replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/[uuid]');
  
  // Replace numeric IDs with [id]  
  normalized = normalized.replace(/\/\d+(?=\/|$)/g, '/[id]');
  
  // Replace wallet addresses (common patterns)
  normalized = normalized.replace(/\/r[A-Za-z0-9]{25,35}(?=\/|$)/g, '/[wallet]');
  normalized = normalized.replace(/\/0x[a-fA-F0-9]{40}(?=\/|$)/g, '/[address]');
  
  // Replace long hex strings with [hash]
  normalized = normalized.replace(/\/[a-fA-F0-9]{32,}(?=\/|$)/g, '/[hash]');
  
  return normalized !== actualPath ? normalized : null;
}

/**
 * Route usage summary for admin endpoints
 */
export function getRouteUsageSummary() {
  const inventorySystem = RouteInventorySystem.getInstance();
  const usage = inventorySystem.getUsageStats();
  const inventory = inventorySystem.getCurrentInventory();
  
  if (!inventory) {
    return {
      error: 'Route inventory not available',
      suggestion: 'Server may still be initializing route discovery'
    };
  }
  
  const usageEntries = Object.entries(usage);
  const totalRequests = usageEntries.reduce((sum, [, count]) => sum + count, 0);
  
  return {
    totalRoutes: inventory.totalRoutes,
    totalRequests,
    uniqueRoutesAccessed: usageEntries.length,
    routesByCategory: inventory.routesByCategory,
    topRoutes: usageEntries
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([route, count]) => ({
        route,
        count,
        percentage: Math.round((count / totalRequests) * 100 * 100) / 100
      })),
    unusedRoutes: inventory.routes.length - usageEntries.length,
    uptime: {
      ms: Date.now() - startTime,
      hours: Math.round((Date.now() - startTime) / (1000 * 60 * 60) * 100) / 100
    }
  };
}