import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  Shield, 
  Database, 
  Users, 
  TrendingUp, 
  BarChart3, 
  Wallet, 
  ArrowRightLeft,
  DollarSign,
  Activity,
  RefreshCw,
  Search,
  Clock
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";

interface AdminPageProps {
  walletAddress?: string | null;
}

interface PlatformOverview {
  users: number;
  wallets: number;
  swaps: number;
  bridges: number;
  feeTransactions: number;
  totalFeesCollectedUSD: number;
  totalRewardsDistributedUSD: number;
  netPlatformRevenueUSD: number;
}

interface SwapMetrics {
  totalVolumeUSD: number;
  swapsByStatus: { status: string; count: number }[];
  swapsByChain: { chain: string; count: number; volumeUSD: number }[];
  recentSwaps: any[];
}

interface BridgeMetrics {
  totalBridgeVolume: number;
  bridgesByStatus: { status: string; count: number }[];
  bridgesByChainPair: { sourceChain: string; destinationChain: string; count: number; totalVolume: number }[];
  recentBridges: any[];
}

interface WalletMetrics {
  totalRiddleWallets: number;
  activeWalletConnections: number;
  walletsByChain: { chain: string; count: number }[];
  recentActivity: any[];
  newWallets24h: number;
}

interface RevenueMetrics {
  revenueByChain: { chain: string; totalFeesUSD: number; totalRewardsUSD: number; netRevenueUSD: number; transactionCount: number }[];
  revenueByOperation: { operationType: string; totalFeesUSD: number; transactionCount: number }[];
  dailyRevenue: { date: string; totalFeesUSD: number; transactionCount: number }[];
}

interface ActivityMetrics {
  serverUptime: string;
  memoryUsageMB: string;
  lastActivity?: string;
  activity24h: {
    swaps: number;
    bridges: number;
    newWalletConnections: number;
    newRiddleWallets: number;
    socialPosts: number;
    feesCollectedUSD: number;
  };
}

interface ApiStatus {
  name: string;
  chain: string;
  status: 'online' | 'offline' | 'error';
  responseTime: number | null;
  statusCode: number | null;
  error: string | null;
  lastChecked: string;
}

interface ApiMonitorData {
  apis: ApiStatus[];
  summary: {
    total: number;
    online: number;
    offline: number;
    errors: number;
  };
  timestamp: string;
}

interface AdminMetrics {
  overview: PlatformOverview;
  swaps: SwapMetrics;
  bridges: BridgeMetrics;
  wallets: WalletMetrics;
  revenue: RevenueMetrics;
  activity: ActivityMetrics;
  timestamp: string;
}

export default function AdminPage({ walletAddress }: AdminPageProps) {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [apiStatus, setApiStatus] = useState<ApiMonitorData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [searchAddress, setSearchAddress] = useState('');
  const [walletData, setWalletData] = useState<any>(null);
  const [walletQueryLoading, setWalletQueryLoading] = useState(false);
  const [sessionData, setSessionData] = useState<any>(null);
  const [leaderboardData, setLeaderboardData] = useState<any>(null);
  const { toast } = useToast();

  // Check admin status and load metrics
  useEffect(() => {
    checkAdminStatus();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadMetrics();
      loadApiStatus();
      loadSessions();
      loadLeaderboard();
      // Auto-refresh metrics every 30 seconds
      const interval = setInterval(() => {
        loadMetrics();
        loadApiStatus();
        loadSessions();
        loadLeaderboard();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [isAdmin]);

  const checkAdminStatus = async () => {
    try {
      const response = await apiRequest('/api/admin/check');
      const data = await response.json() as any;
      setIsAdmin(data.isAdmin === true);
    } catch (error: any) {
      console.error('Admin access check failed:', error);
      setIsAdmin(false);
    }
  };

  const loadMetrics = async () => {
    try {
      setIsLoading(true);
      const response = await apiRequest('/api/admin/metrics/overview');
      const data = await response.json() as any;
      setMetrics(data.data || data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to load admin metrics:', error);
      toast({
        title: "Error Loading Metrics",
        description: "Failed to fetch platform metrics",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadApiStatus = async () => {
    try {
      const response = await apiRequest('/api/admin/api/status');
      const data = await response.json() as any;
      setApiStatus(data);
    } catch (error) {
      console.error('Failed to load API status:', error);
    }
  };

  const searchWallet = async () => {
    if (!searchAddress.trim()) {
      toast({
        title: "Enter Wallet Address",
        description: "Please enter a wallet address to search",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setWalletQueryLoading(true);
      const response = await apiRequest(`/api/admin/wallet/query?address=${encodeURIComponent(searchAddress.trim())}`);
      const data = await response.json() as any;
      setWalletData(data);
    } catch (error) {
      console.error('Failed to query wallet:', error);
      toast({
        title: "Query Failed",
        description: "Failed to fetch wallet data",
        variant: "destructive",
      });
    } finally {
      setWalletQueryLoading(false);
    }
  };

  const loadSessions = async () => {
    try {
      const response = await apiRequest('/api/admin/sessions');
      const data = await response.json() as any;
      setSessionData(data);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  const loadLeaderboard = async () => {
    try {
      const response = await apiRequest('/api/admin/leaderboard');
      const data = await response.json() as any;
      setLeaderboardData(data);
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    }
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };

  // Show unauthorized message if not admin (don't require wallet connection for admin)
  if (!isAdmin) {
    return (
      <div className="container mx-auto p-6 max-w-2xl text-center">
        <h1 className="text-3xl font-bold mb-4 flex items-center justify-center gap-2">
          <Shield className="h-8 w-8" />
          Admin Dashboard
        </h1>
        <p className="text-muted-foreground">Access restricted to dippydoge user only.</p>
        <p className="text-sm text-muted-foreground mt-2">Please log in with the dippydoge account.</p>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="flex items-center justify-center min-h-96">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading admin metrics...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground mt-2">
            RiddleSwap Platform Analytics for {walletAddress}
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            {lastUpdated && `Last updated: ${lastUpdated.toLocaleTimeString()}`}
          </div>
          <Button 
            onClick={() => {
              loadMetrics();
              loadApiStatus();
              loadSessions();
              loadLeaderboard();
            }} 
            variant="outline" 
            size="sm"
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {!metrics ? (
        <div className="text-center py-12">
          <p>No metrics data available</p>
        </div>
      ) : (
        <>
          {/* Platform Overview Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-blue-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                    <p className="text-2xl font-bold">{formatNumber(metrics.overview.users)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Wallet className="h-8 w-8 text-green-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Connected Wallets</p>
                    <p className="text-2xl font-bold">{formatNumber(metrics.overview.wallets)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <TrendingUp className="h-8 w-8 text-purple-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Total Swaps</p>
                    <p className="text-2xl font-bold">{formatNumber(metrics.overview.swaps)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <ArrowRightLeft className="h-8 w-8 text-orange-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Bridge Transactions</p>
                    <p className="text-2xl font-bold">{formatNumber(metrics.overview.bridges)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Revenue Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <DollarSign className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Fees Collected</p>
                    <p className="text-2xl font-bold">{formatCurrency(metrics.overview.totalFeesCollectedUSD)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <TrendingUp className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Rewards Distributed</p>
                    <p className="text-2xl font-bold">{formatCurrency(metrics.overview.totalRewardsDistributedUSD)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <BarChart3 className="h-8 w-8 text-yellow-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Net Revenue</p>
                    <p className="text-2xl font-bold">{formatCurrency(metrics.overview.netPlatformRevenueUSD)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Metrics Tabs */}
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-9">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="swaps" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Swaps
              </TabsTrigger>
              <TabsTrigger value="bridges" className="flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4" />
                Bridges
              </TabsTrigger>
              <TabsTrigger value="wallets" className="flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Wallets
              </TabsTrigger>
              <TabsTrigger value="query" className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                Query
              </TabsTrigger>
              <TabsTrigger value="sessions" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Sessions
              </TabsTrigger>
              <TabsTrigger value="leaderboard" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Leaderboard
              </TabsTrigger>
              <TabsTrigger value="apis" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                API Monitor
              </TabsTrigger>
              <TabsTrigger value="revenue" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Revenue
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>System Health</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span>Server Uptime:</span>
                      <Badge variant="outline">{metrics.activity.serverUptime}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Memory Usage:</span>
                      <Badge variant="outline">{metrics.activity.memoryUsageMB} MB</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Fee Transactions:</span>
                      <Badge variant="outline">{formatNumber(metrics.overview.feeTransactions)}</Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>24h Activity</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span>New Swaps:</span>
                      <Badge variant="secondary">{formatNumber(metrics.activity.activity24h.swaps)}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>New Bridges:</span>
                      <Badge variant="secondary">{formatNumber(metrics.activity.activity24h.bridges)}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Wallet Connections:</span>
                      <Badge variant="secondary">{formatNumber(metrics.activity.activity24h.newWalletConnections)}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>New Riddle Wallets:</span>
                      <Badge variant="secondary">{formatNumber(metrics.activity.activity24h.newRiddleWallets)}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Social Posts:</span>
                      <Badge variant="secondary">{formatNumber(metrics.activity.activity24h.socialPosts)}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Fees Collected:</span>
                      <Badge variant="secondary">{formatCurrency(metrics.activity.activity24h.feesCollectedUSD)}</Badge>
                    </div>
                    {metrics.activity.lastActivity && typeof metrics.activity.lastActivity === 'object' && (
                      <div className="mt-4 p-3 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          {(metrics.activity.lastActivity as any).lastSwap 
                            ? `Last swap: ${new Date((metrics.activity.lastActivity as any).lastSwap).toLocaleDateString()}` 
                            : 'No swaps recorded'
                          }
                          {(metrics.activity.lastActivity as any).lastBridge 
                            ? ` | Last bridge: ${new Date((metrics.activity.lastActivity as any).lastBridge).toLocaleDateString()}` 
                            : ' | No bridges recorded'
                          }
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Swaps Tab */}
            <TabsContent value="swaps">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Swap Volume by Chain</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {metrics.swaps.swapsByChain.map(chain => (
                        <div key={chain.chain} className="flex justify-between items-center">
                          <span className="font-medium capitalize">{chain.chain}</span>
                          <div className="text-right">
                            <p className="font-bold">{formatNumber(chain.count)} swaps</p>
                            <p className="text-sm text-muted-foreground">{formatCurrency(chain.volumeUSD)}</p>
                          </div>
                        </div>
                      ))}
                      {metrics.swaps.swapsByChain.length === 0 && (
                        <p className="text-muted-foreground text-center py-4">No swap data available</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Swap Status Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {metrics.swaps.swapsByStatus.map(status => (
                        <div key={status.status} className="flex justify-between items-center">
                          <span className="capitalize">{status.status}</span>
                          <Badge variant={
                            status.status === 'completed' ? 'default' : 
                            status.status === 'pending' ? 'secondary' : 'destructive'
                          }>
                            {formatNumber(status.count)}
                          </Badge>
                        </div>
                      ))}
                      {metrics.swaps.swapsByStatus.length === 0 && (
                        <p className="text-muted-foreground text-center py-4">No swap status data available</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Recent Swap Transactions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {metrics.swaps.recentSwaps.slice(0, 10).map((swap, index) => (
                      <div key={index} className="flex justify-between items-center p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{swap.from_token_symbol} → {swap.to_token_symbol}</p>
                          <p className="text-sm text-muted-foreground">{swap.chain}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{parseFloat(swap.from_amount).toFixed(4)} {swap.from_token_symbol}</p>
                          <Badge variant="outline">{swap.status}</Badge>
                        </div>
                      </div>
                    ))}
                    {metrics.swaps.recentSwaps.length === 0 && (
                      <p className="text-muted-foreground text-center py-4">No recent swaps</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Bridges Tab */}
            <TabsContent value="bridges">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Bridge Status Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {metrics.bridges.bridgesByStatus.map(status => (
                        <div key={status.status} className="flex justify-between items-center">
                          <span className="capitalize">{status.status}</span>
                          <Badge variant={
                            status.status === 'completed' ? 'default' : 
                            status.status === 'pending' ? 'secondary' : 'destructive'
                          }>
                            {formatNumber(status.count)}
                          </Badge>
                        </div>
                      ))}
                      {metrics.bridges.bridgesByStatus.length === 0 && (
                        <p className="text-muted-foreground text-center py-4">No bridge status data available</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Cross-Chain Volume</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {metrics.bridges.bridgesByChainPair.map((pair, index) => (
                        <div key={index} className="flex justify-between items-center">
                          <span className="font-medium">{pair.sourceChain} → {pair.destinationChain}</span>
                          <div className="text-right">
                            <p className="font-bold">{formatNumber(pair.count)} bridges</p>
                            <p className="text-sm text-muted-foreground">Vol: {pair.totalVolume.toFixed(4)}</p>
                          </div>
                        </div>
                      ))}
                      {metrics.bridges.bridgesByChainPair.length === 0 && (
                        <p className="text-muted-foreground text-center py-4">No bridge pair data available</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Recent Bridge Transactions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {metrics.bridges.recentBridges.slice(0, 10).map((bridge) => (
                      <div key={bridge.id} className="flex justify-between items-center p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{bridge.input_token} → {bridge.output_token}</p>
                          <p className="text-sm text-muted-foreground">{bridge.source_chain} → {bridge.destination_chain}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{parseFloat(bridge.input_amount).toFixed(6)} {bridge.input_token}</p>
                          <Badge variant="outline">{bridge.status}</Badge>
                        </div>
                      </div>
                    ))}
                    {metrics.bridges.recentBridges.length === 0 && (
                      <p className="text-muted-foreground text-center py-4">No recent bridges</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Wallets Tab */}
            <TabsContent value="wallets">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Wallets by Chain</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {metrics.wallets.walletsByChain.map(chain => (
                        <div key={chain.chain} className="flex justify-between items-center">
                          <span className="font-medium capitalize">{chain.chain}</span>
                          <Badge variant="outline">{formatNumber(chain.count)}</Badge>
                        </div>
                      ))}
                      {metrics.wallets.walletsByChain.length === 0 && (
                        <p className="text-muted-foreground text-center py-4">No wallet data available</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Wallet Statistics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span>Total Unique Wallets:</span>
                      <Badge variant="outline">{formatNumber(metrics.wallets.totalRiddleWallets)}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Active Wallets:</span>
                      <Badge variant="secondary">{formatNumber(metrics.wallets.activeWalletConnections)}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Recent Connections:</span>
                      <Badge variant="outline">{formatNumber(metrics.wallets.recentActivity.length)}</Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Activity Tab */}
            <TabsContent value="activity">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Revenue by Chain</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {metrics.revenue.revenueByChain.map(chain => (
                        <div key={chain.chain} className="border rounded-lg p-3">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium capitalize">{chain.chain}</span>
                            <Badge variant="outline">{formatNumber(chain.transactionCount)} txns</Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>Fees: {formatCurrency(chain.totalFeesUSD)}</div>
                            <div>Net: {formatCurrency(chain.netRevenueUSD)}</div>
                          </div>
                        </div>
                      ))}
                      {metrics.revenue.revenueByChain.length === 0 && (
                        <p className="text-muted-foreground text-center py-4">No revenue data available</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Revenue by Operation</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {metrics.revenue.revenueByOperation.map(operation => (
                        <div key={operation.operationType} className="flex justify-between items-center">
                          <span className="font-medium capitalize">{operation.operationType.replace('_', ' ')}</span>
                          <div className="text-right">
                            <p className="font-bold">{formatCurrency(operation.totalFeesUSD)}</p>
                            <p className="text-sm text-muted-foreground">{formatNumber(operation.transactionCount)} txns</p>
                          </div>
                        </div>
                      ))}
                      {metrics.revenue.revenueByOperation.length === 0 && (
                        <p className="text-muted-foreground text-center py-4">No operation data available</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Daily Revenue (Last 7 Days)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {metrics.revenue.dailyRevenue.map((day, index) => (
                      <div key={index} className="flex justify-between items-center p-2 border rounded">
                        <span>{new Date(day.date).toLocaleDateString()}</span>
                        <div className="text-right">
                          <p className="font-bold">{formatCurrency(day.totalFeesUSD)}</p>
                          <p className="text-sm text-muted-foreground">{formatNumber(day.transactionCount)} txns</p>
                        </div>
                      </div>
                    ))}
                    {metrics.revenue.dailyRevenue.length === 0 && (
                      <p className="text-muted-foreground text-center py-4">No daily revenue data available</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Wallet Query Tab */}
            <TabsContent value="query">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Search className="h-5 w-5" />
                      Wallet Transaction Query
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-4 mb-6">
                      <div className="flex-1">
                        <Label htmlFor="wallet-search">Wallet Address</Label>
                        <Input
                          id="wallet-search"
                          value={searchAddress}
                          onChange={(e) => setSearchAddress(e.target.value)}
                          placeholder="Enter wallet address (any chain)"
                          className="mt-2"
                          onKeyPress={(e) => e.key === 'Enter' && searchWallet()}
                        />
                      </div>
                      <div className="flex items-end">
                        <Button 
                          onClick={searchWallet}
                          disabled={walletQueryLoading}
                          className="mb-0"
                        >
                          {walletQueryLoading ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Search className="h-4 w-4 mr-2" />
                          )}
                          Search
                        </Button>
                      </div>
                    </div>

                    {walletData && (
                      <div className="space-y-4">
                        {/* Wallet Summary */}
                        <Card>
                          <CardHeader>
                            <CardTitle>Wallet Summary: {walletData.address}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div className="text-center">
                                <p className="text-2xl font-bold">{formatNumber(walletData.summary.totalSwaps)}</p>
                                <p className="text-sm text-muted-foreground">Total Swaps</p>
                              </div>
                              <div className="text-center">
                                <p className="text-2xl font-bold">{formatNumber(walletData.summary.totalBridges)}</p>
                                <p className="text-sm text-muted-foreground">Bridge Transactions</p>
                              </div>
                              <div className="text-center">
                                <p className="text-2xl font-bold">{formatCurrency(walletData.summary.totalVolumeUSD)}</p>
                                <p className="text-sm text-muted-foreground">Total Volume</p>
                              </div>
                              <div className="text-center">
                                <p className="text-2xl font-bold">{formatCurrency(walletData.summary.totalFeesUSD)}</p>
                                <p className="text-sm text-muted-foreground">Fees Paid</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Transaction History */}
                        <Card>
                          <CardHeader>
                            <CardTitle>Transaction History</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              {walletData.transactions.map((tx, index) => (
                                <div key={index} className="border rounded-lg p-4">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <div className="flex items-center gap-2 mb-2">
                                        <Badge variant={
                                          tx.type === 'swap' ? 'default' : 
                                          tx.type === 'bridge' ? 'secondary' : 'outline'
                                        }>
                                          {tx.type.toUpperCase()}
                                        </Badge>
                                        <Badge variant="outline">{tx.chain}</Badge>
                                        <Badge variant={
                                          tx.status === 'completed' ? 'default' :
                                          tx.status === 'pending' ? 'secondary' : 'destructive'
                                        }>
                                          {tx.status}
                                        </Badge>
                                      </div>
                                      <p className="font-medium">
                                        {tx.type === 'swap' ? `${tx.from_token_symbol} → ${tx.to_token_symbol}` : 
                                         tx.type === 'bridge' ? `${tx.source_chain} → ${tx.destination_chain}` : 
                                         'Transaction'}
                                      </p>
                                      <p className="text-sm text-muted-foreground">
                                        {new Date(tx.created_at).toLocaleDateString()} at {new Date(tx.created_at).toLocaleTimeString()}
                                      </p>
                                      {tx.transaction_hash && (
                                        <p className="text-xs text-muted-foreground font-mono mt-1">
                                          Hash: {tx.transaction_hash}
                                        </p>
                                      )}
                                    </div>
                                    <div className="text-right">
                                      <p className="font-bold">{formatCurrency(tx.value_usd || 0)}</p>
                                      {tx.fee_usd && (
                                        <p className="text-sm text-muted-foreground">Fee: {formatCurrency(tx.fee_usd)}</p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                              {walletData.transactions.length === 0 && (
                                <p className="text-muted-foreground text-center py-8">No transactions found for this wallet</p>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )}

                    {!walletData && searchAddress && !walletQueryLoading && (
                      <div className="text-center py-12">
                        <p className="text-muted-foreground">Enter a wallet address and click search to view transaction details</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* User Sessions Tab */}
            <TabsContent value="sessions">
              <div className="grid grid-cols-1 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Active User Sessions
                      {sessionData && (
                        <Badge variant="outline">
                          {sessionData.summary.activeSessions} Active
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {sessionData ? (
                      <div className="space-y-4">
                        {/* Session Summary */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
                          <div className="text-center">
                            <p className="text-2xl font-bold">{sessionData.summary.activeSessions}</p>
                            <p className="text-sm text-muted-foreground">Total Sessions</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold">{sessionData.summary.authenticatedUsers}</p>
                            <p className="text-sm text-muted-foreground">Authenticated</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold">{sessionData.sessions.filter(s => s.userHandle === 'dippydoge').length}</p>
                            <p className="text-sm text-muted-foreground">Admin Sessions</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold">{sessionData.sessions.filter(s => s.walletAddress !== 'Not connected').length}</p>
                            <p className="text-sm text-muted-foreground">Wallet Connected</p>
                          </div>
                        </div>

                        {/* Session Details */}
                        <div className="space-y-3">
                          {sessionData.sessions.map((session, index) => (
                            <div key={index} className="border rounded-lg p-4">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-medium">{session.userHandle}</p>
                                  <p className="text-sm text-muted-foreground">
                                    Wallet: {session.walletAddress === 'Not connected' ? 'Not connected' : `${session.walletAddress.slice(0, 8)}...${session.walletAddress.slice(-6)}`}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Session ID: {session.sessionId.slice(0, 12)}...
                                  </p>
                                </div>
                                <div className="text-right">
                                  <Badge variant={
                                    session.userHandle === 'dippydoge' ? 'destructive' : 'default'
                                  }>
                                    {session.userHandle === 'dippydoge' ? 'ADMIN' : 'USER'}
                                  </Badge>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Expires: {new Date(session.expires).toLocaleTimeString()}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Last active: {new Date(session.lastActive).toLocaleTimeString()}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                          {sessionData.sessions.length === 0 && (
                            <p className="text-muted-foreground text-center py-8">No active sessions</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                        <p>Loading session data...</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Leaderboard Tab */}
            <TabsContent value="leaderboard">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Social Media Leaderboard */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Social Media Leaders
                      <Badge variant="secondary">Coming Soon</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8">
                      <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">Social media leaderboard coming soon</p>
                      <p className="text-xs text-muted-foreground mt-2">Will track likes, shares, and engagement</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Top Traders Leaderboard */}
                <Card>
                  <CardHeader>
                    <CardTitle>Top Bridge/Swap Users</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {leaderboardData?.topTraders ? (
                      <div className="space-y-3">
                        {leaderboardData.topTraders.map((user, index) => (
                          <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                                {index + 1}
                              </div>
                              <div>
                                <p className="font-medium">{user.userHandle || `${user.wallet_address.slice(0, 8)}...${user.wallet_address.slice(-6)}`}</p>
                                <p className="text-sm text-muted-foreground">{formatNumber(user.totalTransactions)} transactions</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold">{formatCurrency(user.totalVolumeUSD)}</p>
                              <p className="text-sm text-muted-foreground">{formatNumber(user.swapCount)} swaps, {formatNumber(user.bridgeCount)} bridges</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground">Loading top traders...</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Time Spent Leaderboard */}
                <Card>
                  <CardHeader>
                    <CardTitle>Most Active Users</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {leaderboardData?.timeSpent ? (
                      <div className="space-y-3">
                        {leaderboardData.timeSpent.map((user, index) => (
                          <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-6 h-6 rounded-full bg-gradient-to-r from-green-500 to-blue-500 flex items-center justify-center text-white text-sm font-bold">
                                {index + 1}
                              </div>
                              <div>
                                <p className="font-medium">{user.userHandle}</p>
                                <p className="text-sm text-muted-foreground">{formatNumber(user.sessionCount)} sessions</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold">{user.totalTimeFormatted}</p>
                              <p className="text-sm text-muted-foreground">Last active: {new Date(user.lastActive).toLocaleDateString()}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground">Loading activity data...</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* API Monitor Tab */}
            <TabsContent value="apis">
              <div className="grid grid-cols-1 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      API Status Monitor
                      {apiStatus && (
                        <Badge variant={
                          apiStatus.summary.offline > 0 || apiStatus.summary.errors > 0 ? "destructive" : "default"
                        }>
                          {apiStatus.summary.online}/{apiStatus.summary.total} Online
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {apiStatus ? (
                      <div className="space-y-3">
                        {apiStatus.apis.map((api, index) => (
                          <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <p className="font-medium">{api.name}</p>
                              <p className="text-sm text-muted-foreground">{api.chain}</p>
                              {api.error && (
                                <p className="text-xs text-red-500 mt-1">{api.error}</p>
                              )}
                            </div>
                            <div className="text-right space-y-1">
                              <Badge variant={
                                api.status === 'online' ? 'default' : 
                                api.status === 'error' ? 'destructive' : 'secondary'
                              }>
                                {api.status.toUpperCase()}
                              </Badge>
                              {api.responseTime && (
                                <p className="text-xs text-muted-foreground">{api.responseTime}ms</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                        <p>Loading API status...</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
