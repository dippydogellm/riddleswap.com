import { RouteInventorySystem, type RouteInfo, type UsageStats } from './route-inventory-system';
import fs from 'fs/promises';
import path from 'path';

export interface UnusedRouteAnalysis {
  analysisDate: string;
  analysisWindow: number; // days
  totalRoutes: number;
  routesWithUsage: number;
  unusedRoutes: RouteInfo[];
  lowUsageRoutes: Array<{
    route: RouteInfo;
    totalHits: number;
    avgHitsPerDay: number;
  }>;
  recommendations: RemovalRecommendation[];
}

export interface RemovalRecommendation {
  route: RouteInfo;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
  riskLevel: 'SAFE' | 'CAUTION' | 'RISKY';
  daysUnused: number;
}

export interface FrontendUsageMap {
  queryKeys: string[];
  fetchPatterns: string[];
  routeMatches: Array<{
    frontendPattern: string;
    matchedRoutes: string[];
  }>;
}

/**
 * Advanced route analysis tools for identifying removal candidates
 */
export class RouteAnalysisTools {
  private inventorySystem = RouteInventorySystem.getInstance();

  /**
   * Perform comprehensive analysis of unused routes
   */
  async analyzeUnusedRoutes(windowDays: number = 14): Promise<UnusedRouteAnalysis> {
    console.log(`🔍 [ROUTE ANALYSIS] Starting unused route analysis for ${windowDays} days window...`);
    
    const inventory = this.inventorySystem.getCurrentInventory();
    if (!inventory) {
      throw new Error('Route inventory not available. Run route discovery first.');
    }

    // Load recent usage statistics
    const recentStats = await this.loadRecentStats(windowDays);
    const usageMap = this.buildUsageMap(recentStats);
    
    // Identify unused routes
    const unusedRoutes = inventory.routes.filter(route => {
      const routeKey = `${route.method}:${route.fullPath}`;
      return !usageMap.has(routeKey);
    });

    // Identify low usage routes
    const lowUsageRoutes = inventory.routes
      .map(route => {
        const routeKey = `${route.method}:${route.fullPath}`;
        const totalHits = usageMap.get(routeKey) || 0;
        return {
          route,
          totalHits,
          avgHitsPerDay: totalHits / windowDays
        };
      })
      .filter(item => item.totalHits > 0 && item.avgHitsPerDay < 1) // Less than 1 hit per day
      .sort((a, b) => a.avgHitsPerDay - b.avgHitsPerDay);

    // Generate removal recommendations
    const recommendations = this.generateRemovalRecommendations(unusedRoutes, windowDays);

    const analysis: UnusedRouteAnalysis = {
      analysisDate: new Date().toISOString(),
      analysisWindow: windowDays,
      totalRoutes: inventory.routes.length,
      routesWithUsage: inventory.routes.length - unusedRoutes.length,
      unusedRoutes,
      lowUsageRoutes,
      recommendations
    };

    // Save analysis results
    await this.saveAnalysisResults(analysis);

    console.log(`✅ [ROUTE ANALYSIS] Found ${unusedRoutes.length} unused routes and ${lowUsageRoutes.length} low-usage routes`);
    console.log(`📊 [ROUTE ANALYSIS] Generated ${recommendations.length} removal recommendations`);

    return analysis;
  }

  /**
   * Generate smart removal recommendations with confidence scoring
   */
  private generateRemovalRecommendations(unusedRoutes: RouteInfo[], windowDays: number): RemovalRecommendation[] {
    return unusedRoutes.map(route => {
      const recommendation = this.evaluateRouteForRemoval(route, windowDays);
      return recommendation;
    }).sort((a, b) => {
      // Sort by confidence and risk level
      const confidenceOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      const riskOrder = { SAFE: 3, CAUTION: 2, RISKY: 1 };
      
      const aScore = confidenceOrder[a.confidence] * riskOrder[a.riskLevel];
      const bScore = confidenceOrder[b.confidence] * riskOrder[b.riskLevel];
      
      return bScore - aScore;
    });
  }

  /**
   * Evaluate individual route for removal with smart heuristics
   */
  private evaluateRouteForRemoval(route: RouteInfo, windowDays: number): RemovalRecommendation {
    let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
    let riskLevel: 'SAFE' | 'CAUTION' | 'RISKY' = 'CAUTION';
    let reason = `No usage detected in ${windowDays} days`;

    // High confidence removal candidates
    if (route.category === 'DevTools' || route.fullPath.includes('/test')) {
      confidence = 'HIGH';
      riskLevel = 'SAFE';
      reason = 'Development/testing endpoint - safe to remove in production';
    }

    // Legacy or deprecated patterns
    if (route.fullPath.includes('legacy') || route.fullPath.includes('deprecated') || route.fullPath.includes('old')) {
      confidence = 'HIGH';
      riskLevel = 'SAFE';
      reason = 'Legacy endpoint marked for removal';
    }

    // Caution for critical systems
    if (route.category === 'Authentication' || route.category === 'Wallet' || route.authRequired) {
      confidence = 'LOW';
      riskLevel = 'RISKY';
      reason = 'Critical system component - exercise extreme caution';
    }

    // Admin endpoints with no usage
    if (route.category === 'Admin') {
      confidence = 'MEDIUM';
      riskLevel = 'CAUTION';
      reason = 'Admin endpoint - verify not needed for operations';
    }

    // API endpoints that might be called externally
    if (route.method === 'POST' || route.method === 'PUT' || route.method === 'DELETE') {
      confidence = 'LOW';
      riskLevel = 'CAUTION';
      reason = 'Write operation - verify no external integrations depend on this';
    }

    // Static/GET endpoints are generally safer to remove
    if (route.method === 'GET' && !route.authRequired) {
      confidence = 'HIGH';
      riskLevel = 'SAFE';
      reason = 'Read-only endpoint with no authentication - safe to remove';
    }

    return {
      route,
      confidence,
      reason,
      riskLevel,
      daysUnused: windowDays
    };
  }

  /**
   * Cross-reference with frontend usage patterns
   */
  async analyzeFrontendUsage(): Promise<FrontendUsageMap> {
    console.log('🔍 [FRONTEND ANALYSIS] Scanning frontend code for API usage patterns...');
    
    try {
      // Scan frontend files for fetch/query patterns
      const queryKeys = await this.extractQueryKeys();
      const fetchPatterns = await this.extractFetchPatterns();
      
      // Match frontend patterns to backend routes
      const inventory = this.inventorySystem.getCurrentInventory();
      const routeMatches = this.matchFrontendToRoutes(fetchPatterns, inventory?.routes || []);

      return {
        queryKeys,
        fetchPatterns,
        routeMatches
      };
    } catch (error) {
      console.error('❌ [FRONTEND ANALYSIS] Failed to analyze frontend usage:', error);
      return {
        queryKeys: [],
        fetchPatterns: [],
        routeMatches: []
      };
    }
  }

  /**
   * Extract React Query keys from frontend code
   */
  private async extractQueryKeys(): Promise<string[]> {
    const queryKeys: string[] = [];
    
    try {
      const clientDir = path.join(process.cwd(), 'client', 'src');
      const files = await this.scanDirectoryForFiles(clientDir, ['.tsx', '.ts', '.js']);
      
      for (const file of files) {
        const content = await fs.readFile(file, 'utf-8');
        
        // Extract queryKey patterns
        const queryKeyMatches = Array.from(content.matchAll(/queryKey:\s*\[(.*?)\]/g));
        for (const match of queryKeyMatches) {
          const keys = match[1].split(',').map((k: string) => k.trim().replace(/['"]/g, ''));
          queryKeys.push(...keys.filter((k: string) => k.startsWith('/api')));
        }
      }
    } catch (error) {
      console.error('Error extracting query keys:', error);
    }
    
    return Array.from(new Set(queryKeys));
  }

  /**
   * Extract fetch patterns from frontend code
   */
  private async extractFetchPatterns(): Promise<string[]> {
    const patterns: string[] = [];
    
    try {
      const clientDir = path.join(process.cwd(), 'client', 'src');
      const files = await this.scanDirectoryForFiles(clientDir, ['.tsx', '.ts', '.js']);
      
      for (const file of files) {
        const content = await fs.readFile(file, 'utf-8');
        
        // Extract fetch/apiRequest patterns
        const fetchMatches = [
          ...Array.from(content.matchAll(/fetch\(['"`]([^'"`]+)['"`]\)/g)),
          ...Array.from(content.matchAll(/apiRequest\(['"`]([^'"`]+)['"`]\)/g)),
          ...Array.from(content.matchAll(/\.get\(['"`]([^'"`]+)['"`]\)/g)),
          ...Array.from(content.matchAll(/\.post\(['"`]([^'"`]+)['"`]\)/g)),
          ...Array.from(content.matchAll(/\.put\(['"`]([^'"`]+)['"`]\)/g)),
          ...Array.from(content.matchAll(/\.delete\(['"`]([^'"`]+)['"`]\)/g))
        ];
        
        for (const match of fetchMatches) {
          if (match[1].startsWith('/api')) {
            patterns.push(match[1]);
          }
        }
      }
    } catch (error) {
      console.error('Error extracting fetch patterns:', error);
    }
    
    return Array.from(new Set(patterns));
  }

  /**
   * Match frontend patterns to backend routes
   */
  private matchFrontendToRoutes(patterns: string[], routes: RouteInfo[]) {
    return patterns.map(pattern => {
      const matchedRoutes = routes
        .filter(route => {
          // Exact match
          if (route.fullPath === pattern) return true;
          
          // Pattern match (with parameters)
          const routePattern = route.fullPath.replace(/:\w+/g, '[^/]+');
          const regex = new RegExp(`^${routePattern}$`);
          return regex.test(pattern);
        })
        .map(route => `${route.method}:${route.fullPath}`);
      
      return {
        frontendPattern: pattern,
        matchedRoutes
      };
    });
  }

  /**
   * Recursively scan directory for files with specific extensions
   */
  private async scanDirectoryForFiles(dir: string, extensions: string[]): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          files.push(...await this.scanDirectoryForFiles(fullPath, extensions));
        } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip directories that can't be read
    }
    
    return files;
  }

  /**
   * Build usage map from recent statistics
   */
  private buildUsageMap(stats: UsageStats[]): Map<string, number> {
    const usageMap = new Map<string, number>();
    
    stats.forEach(stat => {
      Object.entries(stat.routeUsage).forEach(([routeKey, count]) => {
        const current = usageMap.get(routeKey) || 0;
        usageMap.set(routeKey, current + count);
      });
    });
    
    return usageMap;
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
      console.error('Failed to load recent stats:', error);
      return [];
    }
  }

  /**
   * Save analysis results to file
   */
  private async saveAnalysisResults(analysis: UnusedRouteAnalysis): Promise<void> {
    try {
      const analysisDir = path.join(process.cwd(), 'debug_logs', 'route_analysis');
      await fs.mkdir(analysisDir, { recursive: true });
      
      const filename = `analysis-${new Date().toISOString().split('T')[0]}.json`;
      const filepath = path.join(analysisDir, filename);
      
      await fs.writeFile(filepath, JSON.stringify(analysis, null, 2));
      
      // Also save as latest for easy access
      await fs.writeFile(path.join(analysisDir, 'latest-analysis.json'), JSON.stringify(analysis, null, 2));
      
      console.log(`💾 [ROUTE ANALYSIS] Saved analysis to ${filepath}`);
    } catch (error) {
      console.error('❌ [ROUTE ANALYSIS] Failed to save analysis:', error);
    }
  }

  /**
   * Generate removal script for safe endpoint removal
   */
  async generateRemovalScript(recommendations: RemovalRecommendation[]): Promise<string> {
    const safeToRemove = recommendations.filter(r => 
      r.confidence === 'HIGH' && r.riskLevel === 'SAFE'
    );
    
    let script = '#!/bin/bash\n';
    script += '# Auto-generated route removal script\n';
    script += `# Generated on: ${new Date().toISOString()}\n`;
    script += `# Safe to remove routes: ${safeToRemove.length}\n\n`;
    
    script += 'echo "🗑️  Starting safe route removal..."\n\n';
    
    for (const rec of safeToRemove) {
      script += `# Remove: ${rec.route.method} ${rec.route.fullPath}\n`;
      script += `# Reason: ${rec.reason}\n`;
      script += `# TODO: Review and remove from route file\n\n`;
    }
    
    script += 'echo "✅ Route removal complete"\n';
    
    return script;
  }
}