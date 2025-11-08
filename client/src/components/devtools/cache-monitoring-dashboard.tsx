/**
 * DevTools Cache Monitoring Component
 * 
 * Provides comprehensive cache monitoring and management interface
 * for the DevTools dashboard.
 */

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Trash2, 
  RefreshCw, 
  Activity, 
  Database, 
  Clock, 
  TrendingUp,
  BarChart3,
  Settings,
  Zap,
  AlertCircle
} from 'lucide-react';
import { getCacheStats, clearAllCaches, warmCache, CACHE_CONFIG } from '@/lib/queryClient';

interface BackendCacheStats {
  stats: {
    totalEntries: number;
    totalSize: number;
    cachesByType: Record<string, {
      entries: number;
      size: number;
      hitRate: number;
      avgTtl: number;
    }>;
    overallHitRate: number;
  };
  health: {
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    uptime: number;
  };
  timestamp: number;
}

interface FrontendCacheStats {
  totalQueries: number;
  staleQueries: number;
  activeQueries: number;
  errorQueries: number;
  cacheSize: number;
  queryTypes: Record<string, number>;
}

export function CacheMonitoringDashboard() {
  const queryClient = useQueryClient();
  const [isClearing, setIsClearing] = useState(false);
  const [isWarming, setIsWarming] = useState(false);
  const [clearResult, setClearResult] = useState<string | null>(null);

  // Fetch backend cache statistics
  const { data: backendStats, refetch: refetchBackendStats, isLoading: backendLoading } = useQuery<BackendCacheStats>({
    queryKey: ['/api/analytics/xrpl/token/cache-stats'],
    refetchInterval: 5000, // Refresh every 5 seconds
    staleTime: 2000, // 2 seconds stale time for monitoring data
  });

  // Frontend cache statistics
  const [frontendStats, setFrontendStats] = useState<FrontendCacheStats>(() => getCacheStats());

  // Update frontend stats periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setFrontendStats(getCacheStats());
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const handleClearAllCaches = async () => {
    setIsClearing(true);
    try {
      // Clear frontend caches
      clearAllCaches();
      
      // Clear backend caches
      const response = await fetch('/api/analytics/cache/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      
      const result = await response.json() as any;
      setClearResult(`Cleared ${result.clearedCount || 0} backend cache entries`);
      
      // Refresh stats
      refetchBackendStats();
      setFrontendStats(getCacheStats());
      
      // Clear result message after 3 seconds
      setTimeout(() => setClearResult(null), 3000);
    } catch (error) {
      setClearResult('Failed to clear caches');
      console.error('Cache clear error:', error);
    }
    setIsClearing(false);
  };

  const handleWarmCache = async () => {
    setIsWarming(true);
    try {
      // Warm frontend cache
      await warmCache();
      
      setClearResult('Cache warming completed');
      refetchBackendStats();
      setFrontendStats(getCacheStats());
      
      setTimeout(() => setClearResult(null), 3000);
    } catch (error) {
      setClearResult('Cache warming failed');
      console.error('Cache warm error:', error);
    }
    setIsWarming(false);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatUptime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-6" data-testid="cache-monitoring-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Cache Monitoring</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Monitor and manage both frontend and backend caching systems
          </p>
        </div>
        
        <div className="flex space-x-2">
          <Button
            onClick={handleWarmCache}
            disabled={isWarming}
            variant="outline"
            size="sm"
            data-testid="button-warm-cache"
          >
            <Zap className="h-4 w-4 mr-2" />
            {isWarming ? 'Warming...' : 'Warm Cache'}
          </Button>
          
          <Button
            onClick={handleClearAllCaches}
            disabled={isClearing}
            variant="destructive"
            size="sm"
            data-testid="button-clear-all-caches"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {isClearing ? 'Clearing...' : 'Clear All'}
          </Button>
        </div>
      </div>

      {/* Clear Result Alert */}
      {clearResult && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{clearResult}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="backend">Backend</TabsTrigger>
          <TabsTrigger value="frontend">Frontend</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Health Status */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">System Health</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getHealthColor(backendStats?.health.status || 'healthy')}`}>
                  {backendStats?.health.status || 'Healthy'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Uptime: {backendStats ? formatUptime(backendStats.health.uptime) : 'N/A'}
                </p>
              </CardContent>
            </Card>

            {/* Backend Cache Entries */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Backend Entries</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {backendLoading ? '...' : (backendStats?.stats.totalEntries || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {backendStats ? formatBytes(backendStats.stats.totalSize) : 'N/A'} total size
                </p>
              </CardContent>
            </Card>

            {/* Frontend Queries */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Frontend Queries</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {frontendStats.totalQueries}
                </div>
                <p className="text-xs text-muted-foreground">
                  {frontendStats.activeQueries} active, {frontendStats.staleQueries} stale
                </p>
              </CardContent>
            </Card>

            {/* Hit Rate */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Hit Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {backendStats ? `${(backendStats.stats.overallHitRate * 100).toFixed(1)}%` : 'N/A'}
                </div>
                <Progress 
                  value={backendStats ? backendStats.stats.overallHitRate * 100 : 0} 
                  className="mt-2" 
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Backend Tab */}
        <TabsContent value="backend" className="space-y-4">
          {backendLoading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p>Loading backend cache statistics...</p>
            </div>
          ) : backendStats ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {Object.entries(backendStats.stats.cachesByType).map(([type, stats]) => (
                <Card key={type}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{type.replace('_', ' ').toUpperCase()}</span>
                      <Badge variant={stats.hitRate > 0.8 ? 'default' : 'secondary'}>
                        {(stats.hitRate * 100).toFixed(1)}% hit rate
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium">Entries</p>
                        <p className="text-2xl font-bold">{stats.entries}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Size</p>
                        <p className="text-2xl font-bold">{formatBytes(stats.size)}</p>
                      </div>
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium mb-2">Average TTL</p>
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>{Math.round(stats.avgTtl / 1000)}s</span>
                      </div>
                    </div>
                    
                    <Progress value={stats.hitRate * 100} className="mt-4" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No backend cache data available</p>
            </div>
          )}
        </TabsContent>

        {/* Frontend Tab */}
        <TabsContent value="frontend" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Query Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium">Total Queries</p>
                    <p className="text-2xl font-bold">{frontendStats.totalQueries}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Active</p>
                    <p className="text-2xl font-bold text-green-600">{frontendStats.activeQueries}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Stale</p>
                    <p className="text-2xl font-bold text-yellow-600">{frontendStats.staleQueries}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Errors</p>
                    <p className="text-2xl font-bold text-red-600">{frontendStats.errorQueries}</p>
                  </div>
                </div>
                
                <div>
                  <p className="text-sm font-medium mb-2">Cache Size</p>
                  <p className="text-lg font-semibold">{formatBytes(frontendStats.cacheSize)}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Query Types</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(frontendStats.queryTypes).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="text-sm font-medium capitalize">{type}</span>
                      <Badge variant="outline">{count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Configuration Tab */}
        <TabsContent value="configuration" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Object.entries(CACHE_CONFIG).map(([type, config]) => (
              <Card key={type}>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Settings className="h-4 w-4" />
                    <span>{type.replace('_', ' ')}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-medium">Stale Time</p>
                      <p className="text-muted-foreground">
                        {Math.round(config.staleTime / 1000)}s
                      </p>
                    </div>
                    <div>
                      <p className="font-medium">GC Time</p>
                      <p className="text-muted-foreground">
                        {Math.round(config.gcTime / 1000 / 60)}m
                      </p>
                    </div>
                    <div>
                      <p className="font-medium">Refetch Interval</p>
                      <p className="text-muted-foreground">
                        {config.refetchInterval ? `${Math.round(config.refetchInterval / 1000)}s` : 'Disabled'}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium">Refetch on Focus</p>
                      <p className="text-muted-foreground">
                        {config.refetchOnWindowFocus ? 'Enabled' : 'Disabled'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
