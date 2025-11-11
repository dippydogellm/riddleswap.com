/**
 * UNIFIED ADMIN DASHBOARD
 * Consolidates all admin functionality for dippydoge and hermesthrice589
 * Includes: Platform Metrics, Twitter Management, RiddleSwap Reports, Error Logs, Traders Tools
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { 
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
  Clock,
  Twitter,
  Send,
  Coins,
  Zap,
  Calendar,
  Download,
  FileText,
  Trophy,
  CheckCircle,
  AlertTriangle,
  Bug,
  XCircle,
  AlertCircle,
  Eye,
  Edit,
  Filter,
  Bot,
  Play,
  Pause,
  X,
  Settings
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface AdminPageProps {
  walletAddress?: string | null;
}

export default function UnifiedAdminPage({ walletAddress }: AdminPageProps) {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null); // null = loading, false = denied, true = allowed
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check admin status and load metrics
  useEffect(() => {
    checkAdminStatus();
  }, []);

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

  // Show loading state while checking admin status
  if (isAdmin === null) {
    return (
      <div className="container mx-auto p-6 max-w-2xl text-center">
        <div className="flex items-center justify-center min-h-96">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <span className="ml-2">Checking admin access...</span>
        </div>
      </div>
    );
  }

  // Show unauthorized message if not admin
  if (isAdmin === false) {
    return (
      <div className="container mx-auto p-6 max-w-2xl text-center">
        <h1 className="text-3xl font-bold mb-4 flex items-center justify-center gap-2">
          <Shield className="h-8 w-8" />
          Unified Admin Dashboard
        </h1>
        <p className="text-muted-foreground">Access restricted to authorized admin users only.</p>
        <p className="text-sm text-muted-foreground mt-2">Please log in with an authorized admin account.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2 mb-2">
          <Shield className="h-8 w-8" />
          Unified Admin Dashboard
        </h1>
        <p className="text-muted-foreground">
          Comprehensive administrative control panel for RiddleSwap platform
        </p>
        
        <div className="flex items-center justify-center gap-4 mt-4">
          <div className="text-sm text-muted-foreground">
            {lastUpdated && `Last updated: ${lastUpdated.toLocaleTimeString()}`}
          </div>
          <Button 
            onClick={() => {
              setLastUpdated(new Date());
              // Targeted cache invalidation for admin-related queries
              queryClient.invalidateQueries({ queryKey: ['/api/admin'] });
              queryClient.invalidateQueries({ queryKey: ['/api/twitter'] });
              queryClient.invalidateQueries({ queryKey: ['/api/errors'] });
              queryClient.invalidateQueries({ queryKey: ['/api/riddleswap-collections'] });
            }} 
            variant="outline" 
            size="sm"
            data-testid="button-refresh-all"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh All
          </Button>
        </div>
      </div>

      {/* Admin Tabs */}
      <Tabs defaultValue="platform" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="platform" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Platform
          </TabsTrigger>
          <TabsTrigger value="twitter" className="flex items-center gap-2">
            <Twitter className="h-4 w-4" />
            Twitter
          </TabsTrigger>
          <TabsTrigger value="riddleswap" className="flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            RiddleSwap
          </TabsTrigger>
          <TabsTrigger value="errors" className="flex items-center gap-2">
            <Bug className="h-4 w-4" />
            Error Logs
          </TabsTrigger>
          <TabsTrigger value="trading" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Trading Tools
          </TabsTrigger>
          <TabsTrigger value="scanners" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Scanners
          </TabsTrigger>
        </TabsList>

        {/* Platform Metrics Tab */}
        <TabsContent value="platform">
          <PlatformMetricsSection />
        </TabsContent>

        {/* Twitter Management Tab */}
        <TabsContent value="twitter">
          <TwitterManagementSection />
        </TabsContent>

        {/* RiddleSwap Reports Tab */}
        <TabsContent value="riddleswap">
          <RiddleSwapReportsSection />
        </TabsContent>

        {/* Error Logs Tab */}
        <TabsContent value="errors">
          <ErrorLogsSection />
        </TabsContent>

        {/* Trading Tools Tab */}
        <TabsContent value="trading">
          <TradingToolsSection />
        </TabsContent>

        {/* Scanners Tab */}
        <TabsContent value="scanners">
          <div className="space-y-6">
            <AdminScannerDashboard />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Lazy-loaded Scanner Dashboard Component
const AdminScannerDashboard = () => {
  const [scanners, setScanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchScanners();
    const interval = setInterval(fetchScanners, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchScanners = async () => {
    try {
      const response = await fetch('/api/admin/scanners/status');
      const data = await response.json();
      if (data.success) {
        setScanners(data.scanners);
      }
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch scanners:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {scanners.map((scanner) => (
          <Card key={scanner.type}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{scanner.name}</span>
                <Badge variant={scanner.status === 'running' ? 'default' : 'secondary'}>
                  {scanner.status}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Last Run</div>
                  <div className="font-semibold">
                    {scanner.lastRun ? formatDistanceToNow(new Date(scanner.lastRun), { addSuffix: true }) : 'Never'}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Next Run</div>
                  <div className="font-semibold">
                    {scanner.nextRun ? formatDistanceToNow(new Date(scanner.nextRun), { addSuffix: true }) : 'Not scheduled'}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Items Processed</div>
                  <div className="font-semibold">{scanner.itemsProcessed.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Duration</div>
                  <div className="font-semibold">
                    {scanner.duration ? `${(scanner.duration / 1000).toFixed(2)}s` : 'N/A'}
                  </div>
                </div>
              </div>

              {scanner.status === 'running' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Progress</span>
                    <span>{scanner.progress}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${scanner.progress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => fetch(`/api/admin/scanners/run/${scanner.type}`, { method: 'POST' })}
                  disabled={scanner.status === 'running'}
                >
                  <Play className="h-4 w-4 mr-1" />
                  Run Now
                </Button>
                {scanner.nextRun ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fetch(`/api/admin/scanners/stop/${scanner.type}`, { method: 'POST' })}
                  >
                    <Pause className="h-4 w-4 mr-1" />
                    Stop Schedule
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fetch(`/api/admin/scanners/start/${scanner.type}`, { method: 'POST' })}
                  >
                    <Play className="h-4 w-4 mr-1" />
                    Start Schedule
                  </Button>
                )}
              </div>

              {scanner.error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{scanner.error}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Platform Metrics Section Component
function PlatformMetricsSection() {
  const [metrics, setMetrics] = useState<any>(null);
  const [apiStatus, setApiStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchAddress, setSearchAddress] = useState('');
  const [walletData, setWalletData] = useState<any>(null);
  const [walletQueryLoading, setWalletQueryLoading] = useState(false);
  const [sessionData, setSessionData] = useState<any>(null);
  const [leaderboardData, setLeaderboardData] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
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
  }, []);

  const loadMetrics = async () => {
    try {
      setIsLoading(true);
      const response = await apiRequest('/api/admin/metrics/overview');
      const data = await response.json() as any;
      setMetrics(data.data || data);
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading platform metrics...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Platform Overview Cards */}
      {metrics && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-blue-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                    <p className="text-2xl font-bold">{formatNumber(metrics.overview?.users || 0)}</p>
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
                    <p className="text-2xl font-bold">{formatNumber(metrics.overview?.wallets || 0)}</p>
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
                    <p className="text-2xl font-bold">{formatNumber(metrics.overview?.swaps || 0)}</p>
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
                    <p className="text-2xl font-bold">{formatNumber(metrics.overview?.bridges || 0)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Revenue Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <DollarSign className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Fees Collected</p>
                    <p className="text-2xl font-bold">{formatCurrency(metrics.overview?.totalFeesCollectedUSD || 0)}</p>
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
                    <p className="text-2xl font-bold">{formatCurrency(metrics.overview?.totalRewardsDistributedUSD || 0)}</p>
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
                    <p className="text-2xl font-bold">{formatCurrency(metrics.overview?.netPlatformRevenueUSD || 0)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Wallet Query Tool */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Wallet Query Tool
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter wallet address..."
              value={searchAddress}
              onChange={(e) => setSearchAddress(e.target.value)}
              className="flex-1"
              data-testid="input-wallet-search"
            />
            <Button
              onClick={searchWallet}
              disabled={walletQueryLoading}
              data-testid="button-search-wallet"
            >
              {walletQueryLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Search
            </Button>
          </div>
          
          {walletData && (
            <div className="mt-4 p-4 border rounded-lg">
              <h4 className="font-semibold mb-2">Wallet Data:</h4>
              <pre className="text-sm bg-muted p-2 rounded overflow-auto">
                {JSON.stringify(walletData, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Status Monitor */}
      {apiStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              API Status Monitor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {apiStatus.apis?.map((api: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <p className="font-medium">{api.name}</p>
                    <p className="text-sm text-muted-foreground">{api.chain}</p>
                  </div>
                  <Badge variant={api.status === 'online' ? 'default' : 'destructive'}>
                    {api.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Twitter Management Section Component
function TwitterManagementSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [manualTweetContent, setManualTweetContent] = useState("");
  const [promotionalTweet, setPromotionalTweet] = useState({
    project_name: "",
    description: "",
    website: "",
    tagline: "",
    payment_wallet: ""
  });

  // Get Twitter stats
  const { data: twitterStats, isLoading: loadingStats } = useQuery({
    queryKey: ['/api/twitter/stats'],
    queryFn: async () => {
      const response = await apiRequest('/api/twitter/stats');
      return await response.json() as any;
    }
  });

  // Manual tweet posting mutation
  const postManualTweetMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await apiRequest('/api/twitter/post-tweet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, type: 'manual' })
      });
      return await response.json() as any;
    },
    onSuccess: () => {
      toast({
        title: "Tweet Posted",
        description: "Manual tweet has been posted successfully",
        variant: "default"
      });
      setManualTweetContent("");
      queryClient.invalidateQueries({ queryKey: ['/api/twitter/stats'] });
    },
    onError: (error: any) => {
      toast({
        title: "Tweet Failed",
        description: error.message || "Failed to post tweet",
        variant: "destructive"
      });
    }
  });

  // Promotional tweet order mutation
  const createPromotionalTweetMutation = useMutation({
    mutationFn: async (orderData: any) => {
      const response = await apiRequest('/api/twitter/promotional-tweet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...orderData,
          payment_amount: 30
        })
      });
      return await response.json() as any;
    },
    onSuccess: (data) => {
      toast({
        title: "Promotional Tweet Order Created",
        description: `Payment required: 30 XRP to ${data.bank_wallet}. Destination tag: ${data.destination_tag}`,
        variant: "default"
      });
      setPromotionalTweet({
        project_name: "",
        description: "",
        website: "",
        tagline: "",
        payment_wallet: ""
      });
    },
    onError: (error: any) => {
      toast({
        title: "Order Failed",
        description: error.message || "Failed to create promotional tweet order",
        variant: "destructive"
      });
    }
  });

  const handleManualTweet = () => {
    if (!manualTweetContent.trim() || manualTweetContent.length > 280) {
      toast({
        title: "Invalid Tweet",
        description: "Tweet must be between 1-280 characters",
        variant: "destructive"
      });
      return;
    }
    postManualTweetMutation.mutate(manualTweetContent);
  };

  const handlePromotionalTweet = () => {
    if (!promotionalTweet.project_name || !promotionalTweet.description || !promotionalTweet.payment_wallet) {
      toast({
        title: "Missing Information",
        description: "Project name, description, and payment wallet are required",
        variant: "destructive"
      });
      return;
    }
    createPromotionalTweetMutation.mutate(promotionalTweet);
  };

  return (
    <div className="space-y-6">
      {/* Twitter Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Tweets</p>
                <p className="text-2xl font-bold">{twitterStats?.stats?.total_tweets || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Auto Tweets</p>
                <p className="text-2xl font-bold">{twitterStats?.stats?.automatic_tweets || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Promotional</p>
                <p className="text-2xl font-bold">{twitterStats?.stats?.promotional_tweets || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Coins className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-sm text-muted-foreground">Revenue</p>
                <p className="text-2xl font-bold">{twitterStats?.stats?.total_revenue || 0} XRP</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Twitter API Status */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className="h-6 w-6 text-blue-500" />
              <div>
                <h3 className="font-semibold">Twitter API Status</h3>
                <p className="text-sm text-muted-foreground">
                  {twitterStats?.stats?.twitter_configured ? "Connected and operational" : "API keys not configured"}
                </p>
              </div>
            </div>
            <Badge variant={twitterStats?.stats?.twitter_configured ? "default" : "destructive"}>
              {twitterStats?.stats?.twitter_configured ? "Configured" : "Not Configured"}
            </Badge>
          </div>
          
          {twitterStats?.stats?.next_scheduled && (
            <div className="mt-4 p-3 bg-muted rounded">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-500" />
                <span className="text-sm">
                  Next automatic tweet: {new Date(twitterStats.stats.next_scheduled).toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tweet Management */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Manual Tweet */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Manual Tweet
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="manual-tweet">Tweet Content</Label>
              <Textarea
                id="manual-tweet"
                placeholder="What's happening in the RiddleSwap ecosystem?"
                value={manualTweetContent}
                onChange={(e) => setManualTweetContent(e.target.value)}
                maxLength={280}
                rows={4}
                data-testid="textarea-manual-tweet"
              />
              <div className="flex justify-between items-center mt-2">
                <span className="text-sm text-muted-foreground">
                  {manualTweetContent.length}/280 characters
                </span>
                <Badge variant={manualTweetContent.length > 280 ? "destructive" : "secondary"}>
                  {280 - manualTweetContent.length} remaining
                </Badge>
              </div>
            </div>
            
            <Button
              onClick={handleManualTweet}
              disabled={!manualTweetContent.trim() || manualTweetContent.length > 280 || postManualTweetMutation.isPending}
              className="w-full"
              data-testid="button-post-manual-tweet"
            >
              <Send className="h-4 w-4 mr-2" />
              {postManualTweetMutation.isPending ? "Posting..." : "Post Tweet"}
            </Button>
          </CardContent>
        </Card>

        {/* Promotional Tweet */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5" />
              Promotional Tweet Order
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="project-name">Project Name *</Label>
                <Input
                  id="project-name"
                  placeholder="Your Project Name"
                  value={promotionalTweet.project_name}
                  onChange={(e) => setPromotionalTweet(prev => ({ ...prev, project_name: e.target.value }))}
                  data-testid="input-project-name"
                />
              </div>
              
              <div>
                <Label htmlFor="website">Website URL</Label>
                <Input
                  id="website"
                  placeholder="https://yourproject.com"
                  value={promotionalTweet.website}
                  onChange={(e) => setPromotionalTweet(prev => ({ ...prev, website: e.target.value }))}
                  data-testid="input-website"
                />
              </div>

              <div>
                <Label htmlFor="description">Project Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of your project..."
                  value={promotionalTweet.description}
                  onChange={(e) => setPromotionalTweet(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  data-testid="textarea-description"
                />
              </div>

              <div>
                <Label htmlFor="payment-wallet">Your XRP Wallet Address *</Label>
                <Input
                  id="payment-wallet"
                  placeholder="rYourXRPWalletAddress..."
                  value={promotionalTweet.payment_wallet}
                  onChange={(e) => setPromotionalTweet(prev => ({ ...prev, payment_wallet: e.target.value }))}
                  data-testid="input-payment-wallet"
                />
              </div>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Payment Information</h4>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <li>• Cost: 30 XRP per promotional tweet</li>
                <li>• Payment wallet: rH1zJSuP4CQtPeTzGp4gCzPpW6J1L9JHWt</li>
                <li>• You'll receive a destination tag for tracking</li>
                <li>• Tweet will be posted after payment confirmation</li>
              </ul>
            </div>

            <Button
              onClick={handlePromotionalTweet}
              disabled={createPromotionalTweetMutation.isPending}
              className="w-full"
              data-testid="button-create-promotional-order"
            >
              <Coins className="h-4 w-4 mr-2" />
              {createPromotionalTweetMutation.isPending ? "Creating Order..." : "Create 30 XRP Tweet Order"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// RiddleSwap Reports Section Component
function RiddleSwapReportsSection() {
  const { toast } = useToast();
  const [selectedMonth, setSelectedMonth] = useState('');
  const [targetWallet, setTargetWallet] = useState('rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH');

  const queryClient = useQueryClient();

  // Download RiddleSwap collections
  const downloadCollectionsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/riddleswap-collections/download', {
        method: 'POST'
      });
      return await response.json() as any;
    },
    onSuccess: (data) => {
      toast({
        title: 'Collections Downloaded',
        description: `Successfully processed ${data.collections_processed || 0} collections with ${data.total_nfts || 0} NFTs`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/riddleswap-collections'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Download Failed',
        description: error?.message || 'Failed to download RiddleSwap collections',
        variant: 'destructive'
      });
    }
  });

  // Fetch volume-based rewards
  const { data: rewardsData, isLoading: rewardsLoading, refetch: refetchRewards } = useQuery<{ data: any }>({
    queryKey: ['/api/riddleswap-collections/rewards', targetWallet],
    enabled: !!targetWallet,
    refetchInterval: 60000, // Refresh every minute
  });

  // Generate monthly report
  const generateReportMutation = useMutation({
    mutationFn: async (month: string) => {
      const url = month 
        ? `/api/riddleswap-collections/report/${month}`
        : '/api/riddleswap-collections/report';
      const response = await apiRequest(url, { method: 'GET' });
      return await response.json() as any;
    },
    onSuccess: (data) => {
      toast({
        title: 'Report Generated',
        description: `Monthly RDL allocation report created: ${data.report_id || 'Unknown'}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Report Generation Failed',
        description: error?.message || 'Failed to generate monthly report',
        variant: 'destructive'
      });
    }
  });

  const rewards = rewardsData?.data || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="text-sm px-3 py-1">
            Target Issuer: rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH
          </Badge>
          <Badge variant="secondary" className="text-sm px-3 py-1">
            Taxons: 0, 1, 2, 3, 9
          </Badge>
        </div>
      </div>

      {/* Action Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Collection Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={() => downloadCollectionsMutation.mutate()}
              disabled={downloadCollectionsMutation.isPending}
              className="w-full"
              data-testid="download-collections-button"
            >
              {downloadCollectionsMutation.isPending ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Download Collections
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Report Generation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="month">Month (YYYY-MM)</Label>
              <Input
                id="month"
                type="text"
                placeholder="2025-01"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                data-testid="month-input"
              />
            </div>
            <Button
              onClick={() => generateReportMutation.mutate(selectedMonth)}
              disabled={generateReportMutation.isPending}
              className="w-full"
              data-testid="generate-report-button"
            >
              {generateReportMutation.isPending ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <BarChart3 className="w-4 h-4 mr-2" />
              )}
              Generate Report
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Wallet Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="wallet">Target Wallet</Label>
              <Input
                id="wallet"
                type="text"
                value={targetWallet}
                onChange={(e) => setTargetWallet(e.target.value)}
                placeholder="Enter wallet address"
                data-testid="wallet-input"
              />
            </div>
            <Button
              onClick={() => refetchRewards()}
              disabled={rewardsLoading}
              variant="outline"
              className="w-full"
              data-testid="refresh-rewards-button"
            >
              {rewardsLoading ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Refresh Analysis
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Volume-Based Rewards Summary */}
      {rewards && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-gradient-to-r from-green-500 to-emerald-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-8 w-8" />
                <div>
                  <h3 className="font-semibold">30-Day Volume</h3>
                  <p className="text-2xl font-bold" data-testid="total-volume">
                    ${rewards.total_volume_usd?.toFixed(2) || '0.00'}
                  </p>
                  <p className="text-sm opacity-90">Platform trading volume</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-500 to-violet-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <Coins className="h-8 w-8" />
                <div>
                  <h3 className="font-semibold">Reward Pool</h3>
                  <p className="text-2xl font-bold" data-testid="reward-pool">
                    ${rewards.total_reward_pool?.toFixed(2) || '0.00'}
                  </p>
                  <p className="text-sm opacity-90">5% of volume (RDL)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <Trophy className="h-8 w-8" />
                <div>
                  <h3 className="font-semibold">Eligible Wallets</h3>
                  <p className="text-2xl font-bold" data-testid="eligible-wallets">
                    {rewards.reward_data?.length || 0}
                  </p>
                  <p className="text-sm opacity-90">NFT holders</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// Error Logs Section Component
function ErrorLogsSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [selectedError, setSelectedError] = useState<any>(null);
  const [filters, setFilters] = useState({
    search: '',
    severity: '',
    error_type: '',
    resolved: '',
    start_date: '',
    end_date: ''
  });

  // Fetch error logs
  const { data: logsData, isLoading, refetch } = useQuery({
    queryKey: ['/api/errors/admin/logs', page, filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v))
      });
      
      const response = await apiRequest(`/api/errors/admin/logs?${params}`, {
        method: 'GET'
      });
      return response.json();
    }
  });

  // Fetch error statistics
  const { data: stats } = useQuery({
    queryKey: ['/api/errors/admin/stats'],
    queryFn: async () => {
      const response = await apiRequest('/api/errors/admin/stats?days=7', {
        method: 'GET'
      });
      return response.json();
    }
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1); // Reset to first page when filters change
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      severity: '',
      error_type: '',
      resolved: '',
      start_date: '',
      end_date: ''
    });
    setPage(1);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-black';
      case 'low': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return XCircle;
      case 'high': return AlertTriangle;
      case 'medium': return AlertCircle;
      case 'low': return Clock;
      default: return Bug;
    }
  };

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Total Errors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {stats.total}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                All time total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Recent Errors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {stats.recent}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {stats.period}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Unresolved
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                {stats.unresolved}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Needs attention
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  id="search"
                  placeholder="Search error messages..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="pl-10"
                  data-testid="input-search-errors"
                />
              </div>
            </div>

            <div>
              <Label>Severity</Label>
              <Select value={filters.severity} onValueChange={(value) => handleFilterChange('severity', value)}>
                <SelectTrigger data-testid="select-severity-filter">
                  <SelectValue placeholder="All severities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All severities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Error Type</Label>
              <Select value={filters.error_type} onValueChange={(value) => handleFilterChange('error_type', value)}>
                <SelectTrigger data-testid="select-type-filter">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All types</SelectItem>
                  <SelectItem value="react_error">React Error</SelectItem>
                  <SelectItem value="api_error">API Error</SelectItem>
                  <SelectItem value="network_error">Network Error</SelectItem>
                  <SelectItem value="validation_error">Validation Error</SelectItem>
                  <SelectItem value="auth_error">Auth Error</SelectItem>
                  <SelectItem value="user_report">User Report</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Status</Label>
              <Select value={filters.resolved} onValueChange={(value) => handleFilterChange('resolved', value)}>
                <SelectTrigger data-testid="select-status-filter">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All statuses</SelectItem>
                  <SelectItem value="false">Unresolved</SelectItem>
                  <SelectItem value="true">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={clearFilters} variant="outline" size="sm" data-testid="button-clear-filters">
              Clear Filters
            </Button>
            <Button onClick={() => refetch()} disabled={isLoading} size="sm" data-testid="button-refresh-logs">
              <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error Logs List */}
      <Card>
        <CardHeader>
          <CardTitle>Error Logs</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600 dark:text-gray-400">Loading error logs...</p>
            </div>
          ) : logsData?.logs?.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="w-8 h-8 mx-auto mb-4 text-green-500" />
              <p className="text-gray-600 dark:text-gray-400">No errors found with current filters</p>
            </div>
          ) : (
            <div className="space-y-4">
              {logsData?.logs?.map((log: any) => {
                const SeverityIcon = getSeverityIcon(log.severity);
                
                return (
                  <div
                    key={log.id}
                    className={cn(
                      "border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors",
                      !log.resolved && "border-l-4 border-l-red-500"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <SeverityIcon className="w-4 h-4 flex-shrink-0" />
                          <Badge className={getSeverityColor(log.severity)}>
                            {log.severity.toUpperCase()}
                          </Badge>
                          <Badge variant={log.resolved ? "default" : "destructive"}>
                            {log.resolved ? "RESOLVED" : "OPEN"}
                          </Badge>
                        </div>
                        
                        <h3 className="font-medium text-gray-900 dark:text-white mb-1 truncate">
                          {log.error_message}
                        </h3>
                        
                        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                          {log.component_name && (
                            <p>Component: {log.component_name}</p>
                          )}
                          {log.user_handle && (
                            <p>User: {log.user_handle}</p>
                          )}
                          <p>URL: {log.page_url}</p>
                          <p>Time: {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}</p>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 flex-shrink-0 ml-4">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedError(log)}
                              data-testid={`button-view-error-${log.id}`}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Error Details</DialogTitle>
                            </DialogHeader>
                            {selectedError && (
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label>Error ID</Label>
                                    <p className="text-sm font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded">
                                      {selectedError.id}
                                    </p>
                                  </div>
                                  <div>
                                    <Label>Severity</Label>
                                    <Badge className={getSeverityColor(selectedError.severity)}>
                                      {selectedError.severity.toUpperCase()}
                                    </Badge>
                                  </div>
                                </div>
                                
                                <div>
                                  <Label>Error Message</Label>
                                  <p className="text-sm bg-gray-100 dark:bg-gray-800 p-3 rounded">
                                    {selectedError.error_message}
                                  </p>
                                </div>
                                
                                {selectedError.stack_trace && (
                                  <div>
                                    <Label>Stack Trace</Label>
                                    <ScrollArea className="h-40 bg-gray-100 dark:bg-gray-800 p-3 rounded">
                                      <pre className="text-xs">{selectedError.stack_trace}</pre>
                                    </ScrollArea>
                                  </div>
                                )}
                                
                                {selectedError.error_context && (
                                  <div>
                                    <Label>Context</Label>
                                    <ScrollArea className="h-32 bg-gray-100 dark:bg-gray-800 p-3 rounded">
                                      <pre className="text-xs">
                                        {JSON.stringify(selectedError.error_context, null, 2)}
                                      </pre>
                                    </ScrollArea>
                                  </div>
                                )}
                                
                                {selectedError.resolution_notes && (
                                  <div>
                                    <Label>Resolution Notes</Label>
                                    <p className="text-sm bg-green-50 dark:bg-green-900/20 p-3 rounded">
                                      {selectedError.resolution_notes}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Trading Tools Section Component
function TradingToolsSection() {
  const [sniperBots, setSniperBots] = useState<any[]>([]);
  const [copyTrades, setCopyTrades] = useState<any[]>([]);
  const [recentTrades, setRecentTrades] = useState<any[]>([]);
  const [selectedBot, setSelectedBot] = useState('all');
  const [selectedTrader, setSelectedTrader] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Mock data - replace with real API calls
  const mockSniperBots = [
    {
      id: 'sniper-1',
      name: 'Alpha Hunter Bot',
      status: 'running',
      targetToken: 'XRPL-NewTokens',
      participants: 45,
      totalInvestment: '$12,450',
      successRate: 78.5,
      activeSnipes: 3,
      profitsToday: '+$2,847'
    },
    {
      id: 'sniper-2',
      name: 'Quick Strike Bot',
      status: 'paused',
      targetToken: 'ETH-Gems',
      participants: 23,
      totalInvestment: '$8,920',
      successRate: 65.2,
      activeSnipes: 0,
      profitsToday: '+$1,234'
    }
  ];

  const mockCopyTrades = [
    {
      id: 'copy-1',
      traderId: 'trader-1',
      traderName: 'CryptoWizard',
      followers: 156,
      status: 'active',
      totalVolume: '$45,678',
      profitsToday: '+$3,456',
      activeTrades: 7
    },
    {
      id: 'copy-2',
      traderId: 'trader-2',
      traderName: 'DeFiMaster',
      followers: 89,
      status: 'active',
      totalVolume: '$23,890',
      profitsToday: '+$1,567',
      activeTrades: 4
    }
  ];

  const mockTrades = [
    {
      id: 'trade-1',
      type: 'snipe',
      token: 'RMOON',
      amount: '$5,430',
      status: 'success',
      participants: 45,
      profit: '+$1,247',
      timestamp: '2 minutes ago',
      botId: 'sniper-1'
    },
    {
      id: 'trade-2',
      type: 'copy',
      token: 'USDC',
      amount: '$12,000',
      status: 'distributed',
      participants: 156,
      profit: '+$892',
      timestamp: '15 minutes ago',
      traderId: 'trader-1'
    }
  ];

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    setIsLoading(true);
    try {
      // In production, load real data from API
      setSniperBots(mockSniperBots);
      setCopyTrades(mockCopyTrades);
      setRecentTrades(mockTrades);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load trading tools data",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBotAction = async (botId: string, action: 'start' | 'stop' | 'pause') => {
    try {
      setSniperBots(prev => prev.map(bot => 
        bot.id === botId 
          ? { ...bot, status: action === 'start' ? 'running' : action === 'stop' ? 'stopped' : 'paused' }
          : bot
      ));

      toast({
        title: `Bot ${action}ed`,
        description: `Sniper bot has been ${action}ed successfully`
      });
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to ${action} bot`,
        variant: "destructive"
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
      case 'active':
      case 'success':
      case 'completed':
        return 'bg-green-500';
      case 'paused':
      case 'pending':
        return 'bg-yellow-500';
      case 'stopped':
      case 'failed':
        return 'bg-red-500';
      case 'distributed':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  const filteredTrades = recentTrades.filter(trade => {
    if (selectedBot !== 'all' && trade.botId !== selectedBot) return false;
    if (selectedTrader !== 'all' && trade.traderId !== selectedTrader) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Bots</p>
                <p className="text-2xl font-bold">{sniperBots.filter(b => b.status === 'running').length}</p>
              </div>
              <Bot className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Copy Traders</p>
                <p className="text-2xl font-bold">{copyTrades.filter(c => c.status === 'active').length}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Participants</p>
                <p className="text-2xl font-bold">{sniperBots.reduce((sum, bot) => sum + bot.participants, 0) + copyTrades.reduce((sum, trade) => sum + trade.followers, 0)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Profits Today</p>
                <p className="text-2xl font-bold text-green-600">+$8,104</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sniper Bots Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Sniper Bots Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sniperBots.map((bot) => (
              <div key={bot.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(bot.status)}`} />
                    <h3 className="font-semibold">{bot.name}</h3>
                    <Badge variant="outline">{bot.targetToken}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {bot.status === 'running' ? (
                      <>
                        <Button size="sm" variant="outline" onClick={() => handleBotAction(bot.id, 'pause')}>
                          <Pause className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleBotAction(bot.id, 'stop')}>
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" onClick={() => handleBotAction(bot.id, 'start')}>
                        <Play className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Participants</p>
                    <p className="font-semibold">{bot.participants}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Investment</p>
                    <p className="font-semibold">{bot.totalInvestment}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Success Rate</p>
                    <p className="font-semibold">{bot.successRate}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Profits Today</p>
                    <p className="font-semibold text-green-600">{bot.profitsToday}</p>
                  </div>
                </div>
                
                {bot.activeSnipes > 0 && (
                  <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                    <p className="text-sm font-medium text-yellow-800">
                      {bot.activeSnipes} active snipes in progress
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Trades */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Trades
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredTrades.map((trade) => (
              <div key={trade.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(trade.status)}`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant={trade.type === 'snipe' ? 'default' : 'secondary'}>
                          {trade.type}
                        </Badge>
                        <span className="font-semibold">{trade.token}</span>
                        <span className="text-muted-foreground">{trade.amount}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {trade.participants} participants • {trade.timestamp}
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className={`font-semibold ${trade.profit.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                      {trade.profit}
                    </p>
                    <p className="text-sm text-muted-foreground capitalize">{trade.status}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
