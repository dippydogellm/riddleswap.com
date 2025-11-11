import type { Express, Router } from 'express';
import fs from 'fs/promises';
import path from 'path';

export interface RouteInfo {
  method: string;
  path: string;
  fullPath: string;
  handler: string;
  middleware: string[];
  registeredAt: string;
  lastAccessed?: string;
  accessCount: number;
  authRequired: boolean;
  category: string;
}

export interface RouteInventory {
  generatedAt: string;
  totalRoutes: number;
  routesByCategory: Record<string, number>;
  routesByMethod: Record<string, number>;
  routes: RouteInfo[];
}

export interface UsageStats {
  date: string;
  routeUsage: Record<string, number>;
  totalRequests: number;
  uniqueRoutes: number;
}

/**
 * Automated Route Inventory System
 * Introspects Express app router stack to map all registered endpoints
 */
export class RouteInventorySystem {
  private static instance: RouteInventorySystem;
  private routeInventory: RouteInventory | null = null;
  private usageCounters = new Map<string, number>();
  private dailyStats: UsageStats[] = [];
  
  private constructor() {}
  
  static getInstance(): RouteInventorySystem {
    if (!RouteInventorySystem.instance) {
      RouteInventorySystem.instance = new RouteInventorySystem();
    }
    return RouteInventorySystem.instance;
  }

  /**
   * Extract all routes from Express app using router stack introspection
   */
  async generateInventory(app: Express): Promise<RouteInventory> {
    console.log('🔍 [ROUTE INVENTORY] Starting route discovery...');
    
    const routes: RouteInfo[] = [];
    const startTime = Date.now();

    // Extract routes from app router stack
    this.extractRoutesFromStack(app._router?.stack || [], '', routes);

    // Categorize routes
    const routesByCategory = this.categorizeRoutes(routes);
    const routesByMethod = this.groupByMethod(routes);

    const inventory: RouteInventory = {
      generatedAt: new Date().toISOString(),
      totalRoutes: routes.length,
      routesByCategory,
      routesByMethod,
      routes: routes.sort((a, b) => a.fullPath.localeCompare(b.fullPath))
    };

    this.routeInventory = inventory;
    
    // Persist to JSON file
    await this.saveInventoryToFile(inventory);
    
    const duration = Date.now() - startTime;
    console.log(`✅ [ROUTE INVENTORY] Discovered ${routes.length} routes in ${duration}ms`);
    console.log(`📊 [ROUTE INVENTORY] Categories: ${Object.keys(routesByCategory).join(', ')}`);
    console.log(`🔢 [ROUTE INVENTORY] Methods: ${Object.entries(routesByMethod).map(([method, count]) => `${method}(${count})`).join(', ')}`);
    
    return inventory;
  }

  /**
   * Recursively extract routes from Express router stack
   */
  private extractRoutesFromStack(stack: any[], basePath: string, routes: RouteInfo[]): void {
    for (const layer of stack) {
      if (layer.route) {
        // Direct route
        const route = layer.route;
        const methods = Object.keys(route.methods);
        
        for (const method of methods) {
          const fullPath = basePath + (route.path === '/' ? '' : route.path);
          const routeInfo: RouteInfo = {
            method: method.toUpperCase(),
            path: route.path,
            fullPath,
            handler: this.getHandlerName(route.stack?.[0]?.handle),
            middleware: this.extractMiddlewareNames(route.stack || []),
            registeredAt: new Date().toISOString(),
            accessCount: 0,
            authRequired: this.detectAuthRequirement(route.stack || []),
            category: this.categorizeRoute(fullPath, method.toUpperCase())
          };
          routes.push(routeInfo);
        }
      } else if (layer.name === 'router' && layer.handle?.stack) {
        // Nested router
        const routerPath = layer.regexp.source
          .replace('\\', '')
          .replace('(?=\\/|$)', '')
          .replace('^', '')
          .replace('$', '')
          .replace(/\\\//g, '/')
          .replace(/\(\?\:\[\^\\\/\]\+\)\?\$/, '')
          .replace(/\(\?\:\[\^\\\/\]\+\)\?\?\$/, '');
        
        const cleanPath = basePath + this.cleanRegexpPath(routerPath);
        this.extractRoutesFromStack(layer.handle.stack, cleanPath, routes);
      } else if (layer.regexp && layer.handle) {
        // Middleware or single route handler
        const pathPattern = this.extractPathFromRegexp(layer.regexp);
        if (pathPattern && !pathPattern.includes('*')) {
          const fullPath = basePath + pathPattern;
          
          // Only add if it looks like a meaningful route
          if (this.isValidRoute(fullPath)) {
            const routeInfo: RouteInfo = {
              method: 'ALL',
              path: pathPattern,
              fullPath,
              handler: this.getHandlerName(layer.handle),
              middleware: [],
              registeredAt: new Date().toISOString(),
              accessCount: 0,
              authRequired: this.detectAuthRequirement([layer]),
              category: this.categorizeRoute(fullPath, 'ALL')
            };
            routes.push(routeInfo);
          }
        }
      }
    }
  }

  /**
   * Clean regexp path for router mounting points
   */
  private cleanRegexpPath(regexpSource: string): string {
    return regexpSource
      .replace(/^\^\\?/, '')
      .replace(/\$.*$/, '')
      .replace(/\\\//g, '/')
      .replace(/\(\?\=.*$/, '')
      .replace(/\?\$$/, '')
      .replace(/\(\?\:\[/, '')
      .replace(/\]\+\)\?\$$/, '');
  }

  /**
   * Extract path pattern from Express layer regexp
   */
  private extractPathFromRegexp(regexp: RegExp): string | null {
    const source = regexp.source;
    
    // Skip overly complex patterns
    if (source.includes('(?:') && source.length > 100) {
      return null;
    }
    
    // Clean up common Express patterns
    let path = source
      .replace(/^\^\\?/, '')
      .replace(/\$.*$/, '')
      .replace(/\\\//g, '/')
      .replace(/\(\?\=.*$/, '')
      .replace(/\?\$$/, '');
    
    // Remove parameter patterns
    path = path.replace(/\(\[\^\\\/\]\+\)/g, ':param');
    
    if (path === '' || path === '/') {
      return '/';
    }
    
    return path.startsWith('/') ? path : '/' + path;
  }

  /**
   * Check if extracted path represents a valid API route
   */
  private isValidRoute(fullPath: string): boolean {
    // Skip static file patterns and overly generic patterns
    const skipPatterns = [
      /\.\w+$/,  // File extensions
      /\*\*/,    // Wildcard patterns
      /^\s*$/,   // Empty paths
      /favicon/, // Favicon
      /\.(js|css|png|jpg|gif|svg|ico|woff|woff2|ttf|eot)(\?|$)/
    ];
    
    return !skipPatterns.some(pattern => pattern.test(fullPath)) && 
           fullPath.length > 1 && 
           fullPath !== '/';
  }

  /**
   * Categorize route based on path and method
   */
  private categorizeRoute(path: string, method: string): string {
    if (path.includes('/api/auth')) return 'Authentication';
    if (path.includes('/api/wallet')) return 'Wallet';
    if (path.includes('/api/nft')) return 'NFT';
    if (path.includes('/api/bridge')) return 'Bridge';
    if (path.includes('/api/trading')) return 'Trading';
    if (path.includes('/api/staking')) return 'Staking';
    if (path.includes('/api/rewards')) return 'Rewards';
    if (path.includes('/api/admin')) return 'Admin';
    if (path.includes('/api/devtools')) return 'DevTools';
    if (path.includes('/api/xrpl')) return 'XRPL';
    if (path.includes('/api/sol')) return 'Solana';
    if (path.includes('/api/eth')) return 'Ethereum';
    if (path.includes('/api/btc')) return 'Bitcoin';
    if (path.includes('/api/')) return 'API';
    if (method === 'GET' && !path.includes('/api/')) return 'Static';
    return 'Other';
  }

  /**
   * Group routes by HTTP method
   */
  private groupByMethod(routes: RouteInfo[]): Record<string, number> {
    return routes.reduce((acc, route) => {
      acc[route.method] = (acc[route.method] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Categorize all routes
   */
  private categorizeRoutes(routes: RouteInfo[]): Record<string, number> {
    return routes.reduce((acc, route) => {
      acc[route.category] = (acc[route.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Extract handler function name
   */
  private getHandlerName(handler: any): string {
    if (!handler) return 'unknown';
    if (handler.name) return handler.name;
    if (handler.constructor?.name) return handler.constructor.name;
    return 'anonymous';
  }

  /**
   * Extract middleware names from route stack
   */
  private extractMiddlewareNames(stack: any[]): string[] {
    return stack
      .map(layer => this.getHandlerName(layer.handle))
      .filter(name => name !== 'unknown' && name !== 'anonymous');
  }

  /**
   * Detect if route requires authentication
   */
  private detectAuthRequirement(stack: any[]): boolean {
    return stack.some(layer => {
      const handlerName = this.getHandlerName(layer.handle);
      return handlerName.includes('auth') || 
             handlerName.includes('requireAuthentication') ||
             handlerName.includes('validateSession');
    });
  }

  /**
   * Track route access
   */
  trackAccess(method: string, path: string): void {
    const routeKey = `${method}:${path}`;
    const currentCount = this.usageCounters.get(routeKey) || 0;
    this.usageCounters.set(routeKey, currentCount + 1);
  }

  /**
   * Get current usage statistics
   */
  getUsageStats(): Record<string, number> {
    return Object.fromEntries(this.usageCounters);
  }

  /**
   * Generate daily usage report
   */
  async generateDailyReport(): Promise<UsageStats> {
    const today = new Date().toISOString().split('T')[0];
    const routeUsage = this.getUsageStats();
    
    const stats: UsageStats = {
      date: today,
      routeUsage,
      totalRequests: Object.values(routeUsage as any).reduce((sum: number, count: any) => sum + (count as number), 0) as number,
      uniqueRoutes: Object.keys(routeUsage).length
    };

    // Save daily stats
    await this.saveDailyStats(stats);
    
    // Reset counters for next day
    this.usageCounters.clear();
    
    return stats;
  }

  /**
   * Identify unused routes over specified days
   */
  async getUnusedRoutes(days: number = 14): Promise<RouteInfo[]> {
    if (!this.routeInventory) return [];

    const recentStats = await this.loadRecentStats(days);
    const usedRoutes = new Set<string>();

    // Collect all used routes from recent stats
    recentStats.forEach(stats => {
      Object.keys(stats.routeUsage).forEach(routeKey => {
        usedRoutes.add(routeKey);
      });
    });

    // Find routes that haven't been used
    return this.routeInventory.routes.filter(route => {
      const routeKey = `${route.method}:${route.fullPath}`;
      return !usedRoutes.has(routeKey);
    });
  }

  /**
   * Save inventory to JSON file
   */
  private async saveInventoryToFile(inventory: RouteInventory): Promise<void> {
    try {
      const inventoryDir = path.join(process.cwd(), 'debug_logs', 'route_inventory');
      await fs.mkdir(inventoryDir, { recursive: true });
      
      const filename = `route-inventory-${new Date().toISOString().split('T')[0]}.json`;
      const filepath = path.join(inventoryDir, filename);
      
      await fs.writeFile(filepath, JSON.stringify(inventory, null, 2));
      
      // Also save as latest.json for easy access
      await fs.writeFile(path.join(inventoryDir, 'latest.json'), JSON.stringify(inventory, null, 2));
      
      console.log(`💾 [ROUTE INVENTORY] Saved to ${filepath}`);
    } catch (error) {
      console.error('❌ [ROUTE INVENTORY] Failed to save inventory:', error);
    }
  }

  /**
   * Save daily usage statistics
   */
  private async saveDailyStats(stats: UsageStats): Promise<void> {
    try {
      const statsDir = path.join(process.cwd(), 'debug_logs', 'route_usage');
      await fs.mkdir(statsDir, { recursive: true });
      
      const filename = `usage-${stats.date}.json`;
      const filepath = path.join(statsDir, filename);
      
      await fs.writeFile(filepath, JSON.stringify(stats, null, 2));
      console.log(`📊 [ROUTE USAGE] Saved daily stats to ${filepath}`);
    } catch (error) {
      console.error('❌ [ROUTE USAGE] Failed to save stats:', error);
    }
  }

  /**
   * Load recent usage statistics
   */
  private async loadRecentStats(days: number): Promise<UsageStats[]> {
    try {
      const statsDir = path.join(process.cwd(), 'debug_logs', 'route_usage');
      const files = await fs.readdir(statsDir);
      
      const recentFiles = files
        .filter(file => file.startsWith('usage-') && file.endsWith('.json'))
        .sort()
        .slice(-days);
      
      const stats: UsageStats[] = [];
      for (const file of recentFiles) {
        const content = await fs.readFile(path.join(statsDir, file), 'utf-8');
        stats.push(JSON.parse(content));
      }
      
      return stats;
    } catch (error) {
      console.error('❌ [ROUTE USAGE] Failed to load recent stats:', error);
      return [];
    }
  }

  /**
   * Get current inventory
   */
  getCurrentInventory(): RouteInventory | null {
    return this.routeInventory;
  }
}