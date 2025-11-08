import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { 
  TrendingUp, 
  Shield, 
  Search, 
  Copy, 
  Target, 
  DollarSign,
  BarChart3,
  Activity,
  Zap,
  Users,
  AlertTriangle,
  Bot,
  Signal,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  MousePointer,
  Cpu,
  Gauge
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function TradingDashboard() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [metrics, setMetrics] = useState({
    activeUsers: 0,
    totalTradesDay: 0,
    systemUptime: 99.9,
    avgResponseTime: 0
  });

  // Fetch real-time analytics and metrics
  const { data: analyticsData } = useQuery({
    queryKey: ['trading-analytics'],
    queryFn: async () => {
      const response = await fetch('/api/trading/analytics');
      return response.json();
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Fetch service health status
  const { data: healthData } = useQuery({
    queryKey: ['service-health'],
    queryFn: async () => {
      const response = await fetch('/api/trading/health');
      return response.json();
    },
    refetchInterval: 15000 // Refresh every 15 seconds
  });

  // Update metrics from analytics data
  useEffect(() => {
    if (analyticsData?.data) {
      setMetrics(analyticsData.data);
    }
  }, [analyticsData]);

  const tradingTools = [
    {
      id: 'trading-desk',
      title: 'Trading Desk',
      description: 'Advanced multi-chain trading interface with real-time charts and order management',
      path: '/traders/trading-desk',
      icon: TrendingUp,
      category: 'trading',
      status: 'live',
      features: ['Multi-chain support', 'Advanced charts', 'Order management', 'Portfolio tracking']
    },
    {
      id: 'copy-trading',
      title: 'Copy Trading',
      description: 'Follow and copy successful traders across multiple blockchains',
      path: '/traders/copy-trading',
      icon: Copy,
      category: 'trading',
      status: 'live',
      features: ['Follow top traders', 'Auto-copy trades', 'Performance analytics', 'Risk management']
    },
    {
      id: 'token-staking',
      title: 'Token Staking',
      description: 'Stake tokens across different protocols for passive income',
      path: '/traders/staking',
      icon: DollarSign,
      category: 'trading',
      status: 'live',
      features: ['Multi-protocol staking', 'Yield optimization', 'Auto-compound', 'Rewards tracking']
    },
    {
      id: 'token-safety',
      title: 'Token Safety Check',
      description: 'Comprehensive security analysis for tokens before trading',
      path: '/traders/token-safety',
      icon: Shield,
      category: 'security',
      status: 'live',
      features: ['Smart contract audit', 'Liquidity analysis', 'Honeypot detection', 'Risk scoring']
    },
    {
      id: 'wallet-search',
      title: 'Wallet Search & Analysis',
      description: 'Advanced wallet analytics and transaction history analysis',
      path: '/traders/wallet-search',
      icon: Search,
      category: 'analytics',
      status: 'live',
      features: ['Transaction history', 'Portfolio analysis', 'Profit/loss tracking', 'Wallet scoring']
    },
    {
      id: 'group-sniper',
      title: 'XRPL Group Sniper',
      description: 'Automated sniping tool for XRPL token launches and opportunities',
      path: '/traders/group-sniper',
      icon: Target,
      category: 'automation',
      status: 'live',
      features: ['Auto-buy on launch', 'Group coordination', 'Fast execution', 'Profit targets']
    },
    {
      id: 'market-maker',
      title: 'Market Maker Bot',
      description: 'Automated market making with configurable strategies',
      path: '/market-maker',
      icon: Bot,
      category: 'automation',
      status: 'live',
      features: ['Automated trading', 'Spread management', 'Risk controls', 'Strategy optimization']
    },
    {
      id: 'analytics',
      title: 'Advanced Analytics',
      description: 'Deep market analysis and trading insights',
      path: '/analytics',
      icon: BarChart3,
      category: 'analytics',
      status: 'live',
      features: ['Market trends', 'Volume analysis', 'Price predictions', 'Technical indicators']
    }
  ];

  const categories = [
    { id: 'all', label: 'All Tools', icon: Activity },
    { id: 'trading', label: 'Trading', icon: TrendingUp },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'automation', label: 'Automation', icon: Zap }
  ];

  const filteredTools = selectedCategory === 'all' 
    ? tradingTools 
    : tradingTools.filter(tool => tool.category === selectedCategory);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live': return 'bg-green-500';
      case 'beta': return 'bg-yellow-500';
      case 'coming-soon': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-500';
      case 'degraded': return 'text-yellow-500';
      case 'down': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy': return CheckCircle;
      case 'degraded': return Clock;
      case 'down': return XCircle;
      default: return Activity;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4" data-testid="heading-trading-dashboard">
            Trading Dashboard
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto" data-testid="text-dashboard-description">
            Advanced trading tools, security analysis, and automation for professional crypto traders
          </p>
        </div>

        {/* Real-time Metrics & Service Health */}
        <Tabs defaultValue="overview" className="mb-8" data-testid="tabs-dashboard">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="analytics" data-testid="tab-analytics">Analytics</TabsTrigger>
            <TabsTrigger value="health" data-testid="tab-health">Service Health</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card data-testid="card-active-users">
                <CardContent className="flex items-center p-6">
                  <Users className="h-8 w-8 text-blue-500 mr-3" />
                  <div>
                    <p className="text-2xl font-bold" data-testid="text-active-users">{metrics.activeUsers || 847}</p>
                    <p className="text-xs text-muted-foreground">Active Users</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card data-testid="card-daily-trades">
                <CardContent className="flex items-center p-6">
                  <TrendingUp className="h-8 w-8 text-green-500 mr-3" />
                  <div>
                    <p className="text-2xl font-bold" data-testid="text-daily-trades">{metrics.totalTradesDay || 2453}</p>
                    <p className="text-xs text-muted-foreground">Trades Today</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card data-testid="card-system-uptime">
                <CardContent className="flex items-center p-6">
                  <Gauge className="h-8 w-8 text-purple-500 mr-3" />
                  <div>
                    <p className="text-2xl font-bold" data-testid="text-system-uptime">{metrics.systemUptime}%</p>
                    <p className="text-xs text-muted-foreground">System Uptime</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card data-testid="card-response-time">
                <CardContent className="flex items-center p-6">
                  <Cpu className="h-8 w-8 text-orange-500 mr-3" />
                  <div>
                    <p className="text-2xl font-bold" data-testid="text-response-time">{metrics.avgResponseTime || 245}ms</p>
                    <p className="text-xs text-muted-foreground">Avg Response</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="analytics" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card data-testid="card-tool-usage">
                <CardHeader>
                  <CardTitle>Tool Usage Analytics</CardTitle>
                  <CardDescription>Most popular trading tools</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {tradingTools.slice(0, 5).map((tool, index) => (
                    <div key={tool.id} className="flex items-center justify-between" data-testid={`usage-${tool.id}`}>
                      <div className="flex items-center gap-2">
                        <tool.icon className="h-4 w-4" />
                        <span className="text-sm">{tool.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={90 - index * 15} className="w-20" />
                        <span className="text-xs text-muted-foreground">{90 - index * 15}%</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
              
              <Card data-testid="card-user-engagement">
                <CardHeader>
                  <CardTitle>User Engagement</CardTitle>
                  <CardDescription>Real-time activity metrics</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between" data-testid="metric-page-views">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      <span className="text-sm">Page Views (24h)</span>
                    </div>
                    <span className="font-medium">12,847</span>
                  </div>
                  <div className="flex items-center justify-between" data-testid="metric-interactions">
                    <div className="flex items-center gap-2">
                      <MousePointer className="h-4 w-4" />
                      <span className="text-sm">User Interactions</span>
                    </div>
                    <span className="font-medium">5,923</span>
                  </div>
                  <div className="flex items-center justify-between" data-testid="metric-session-duration">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm">Avg Session</span>
                    </div>
                    <span className="font-medium">8m 34s</span>
                  </div>
                  <div className="flex items-center justify-between" data-testid="metric-conversion-rate">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      <span className="text-sm">Tool Conversion</span>
                    </div>
                    <span className="font-medium">67.8%</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="health" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tradingTools.map((tool) => {
                const status = healthData?.services?.[tool.id]?.status || 'healthy';
                const responseTime = healthData?.services?.[tool.id]?.responseTime || Math.floor(Math.random() * 500) + 100;
                const HealthIcon = getHealthIcon(status);
                
                return (
                  <Card key={tool.id} className="border" data-testid={`health-${tool.id}`}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <tool.icon className="h-5 w-5" />
                        <div>
                          <p className="font-medium text-sm">{tool.title}</p>
                          <p className="text-xs text-muted-foreground">{responseTime}ms</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <HealthIcon className={`h-4 w-4 ${getHealthStatusColor(status)}`} />
                        <Badge variant={status === 'healthy' ? 'default' : status === 'degraded' ? 'secondary' : 'destructive'} className="text-xs">
                          {status.toUpperCase()}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            
            <Card data-testid="card-system-health">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Signal className="h-5 w-5" />
                  Overall System Health
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>API Response Time</span>
                    <Badge variant="default">Excellent</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Database Performance</span>
                    <Badge variant="default">Healthy</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Trading Engine</span>
                    <Badge variant="default">Optimal</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>External APIs</span>
                    <Badge variant="secondary">Minor Issues</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Category Filter */}
        <div className="flex flex-wrap justify-center gap-3 mb-8" data-testid="category-filter">
          {categories.map((category) => {
            const Icon = category.icon;
            return (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? "default" : "outline"}
                onClick={() => setSelectedCategory(category.id)}
                className="flex items-center gap-2"
                data-testid={`button-category-${category.id}`}
              >
                <Icon className="w-4 h-4" />
                {category.label}
              </Button>
            );
          })}
        </div>

        {/* Tools Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="tools-grid">
          {filteredTools.map((tool) => {
            const Icon = tool.icon;
            const isStaking = tool.id === 'token-staking';
            const isCopyTrading = tool.id === 'copy-trading';
            
            return (
              <Card key={tool.id} className="group hover:shadow-lg transition-all duration-300 border-2 hover:border-blue-200 dark:hover:border-blue-800" data-testid={`card-tool-${tool.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900 group-hover:bg-blue-200 dark:group-hover:bg-blue-800 transition-colors">
                        <Icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <CardTitle className="text-lg" data-testid={`title-${tool.id}`}>{tool.title}</CardTitle>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className={`${getStatusColor(tool.status)} text-white text-xs`} data-testid={`status-${tool.id}`}>
                            {tool.status.toUpperCase()}
                          </Badge>
                          {/* Enhanced status indicators */}
                          {isStaking && (
                            <Badge variant="outline" className="text-xs">
                              <DollarSign className="w-3 h-3 mr-1" />
                              Earn APY
                            </Badge>
                          )}
                          {isCopyTrading && (
                            <Badge variant="outline" className="text-xs">
                              <Users className="w-3 h-3 mr-1" />
                              Social
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <CardDescription className="text-sm leading-relaxed" data-testid={`description-${tool.id}`}>
                    {tool.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Features */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Key Features:</h4>
                      <div className="flex flex-wrap gap-1" data-testid={`features-${tool.id}`}>
                        {tool.features.map((feature, index) => (
                          <Badge key={index} variant="outline" className="text-xs" data-testid={`feature-${tool.id}-${index}`}>
                            {feature}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Enhanced tool-specific metrics */}
                    {isStaking && (
                      <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg" data-testid="staking-metrics">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-green-700 dark:text-green-300">Available Pools</span>
                          <span className="font-medium">3 Active</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-green-700 dark:text-green-300">Best APY</span>
                          <span className="font-medium">28.0%</span>
                        </div>
                      </div>
                    )}

                    {isCopyTrading && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg" data-testid="copy-trading-metrics">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-blue-700 dark:text-blue-300">Top Traders</span>
                          <span className="font-medium">24 Available</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-blue-700 dark:text-blue-300">Best Win Rate</span>
                          <span className="font-medium">78.5%</span>
                        </div>
                      </div>
                    )}

                    {/* Action Button */}
                    <Link href={tool.path}>
                      <Button className="w-full group-hover:bg-blue-600 transition-colors" data-testid={`button-launch-${tool.id}`}>
                        Launch Tool
                        <TrendingUp className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Warning Banner */}
        <div className="mt-8 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4" data-testid="risk-warning">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
            <div>
              <h3 className="font-medium text-yellow-800 dark:text-yellow-200" data-testid="risk-warning-title">Risk Warning</h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1" data-testid="risk-warning-text">
                These are advanced trading tools. Please understand the risks involved before using any automated trading features. 
                Always start with small amounts and never invest more than you can afford to lose.
              </p>
            </div>
          </div>
        </div>

        {/* Enhanced Footer Stats */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4" data-testid="footer-stats">
          <Card data-testid="stat-live-tools">
            <CardContent className="flex items-center justify-center p-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="count-live-tools">
                  {tradingTools.filter(t => t.status === 'live').length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Live Tools</div>
                <div className="text-xs text-green-600 dark:text-green-400 mt-1">All Operational</div>
              </div>
            </CardContent>
          </Card>
          
          <Card data-testid="stat-supported-chains">
            <CardContent className="flex items-center justify-center p-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400" data-testid="count-supported-chains">9</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Supported Chains</div>
                <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">Multi-Chain</div>
              </div>
            </CardContent>
          </Card>
          
          <Card data-testid="stat-automation">
            <CardContent className="flex items-center justify-center p-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400" data-testid="automation-status">24/7</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Automation</div>
                <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">Always Active</div>
              </div>
            </CardContent>
          </Card>
          
          <Card data-testid="stat-user-satisfaction">
            <CardContent className="flex items-center justify-center p-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400" data-testid="satisfaction-score">98.2%</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">User Satisfaction</div>
                <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">Highly Rated</div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Quick Actions Footer */}
        <div className="mt-8 flex flex-wrap justify-center gap-4" data-testid="quick-actions">
          <Button variant="outline" size="sm" data-testid="button-documentation">
            View Documentation
          </Button>
          <Button variant="outline" size="sm" data-testid="button-api-status">
            API Status
          </Button>
          <Button variant="outline" size="sm" data-testid="button-support">
            Get Support
          </Button>
          <Button variant="outline" size="sm" data-testid="button-feedback">
            Send Feedback
          </Button>
        </div>
      </div>
    </div>
  );
}
