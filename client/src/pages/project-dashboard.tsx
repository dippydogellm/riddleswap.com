import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, 
  Coins, 
  Image, 
  Gift, 
  Camera, 
  Download, 
  TrendingUp, 
  Activity,
  Settings,
  Shield,
  Plus,
  Star
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ProjectDashboard() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Login Required",
        description: "You need to be logged in to access DevTools. Redirecting to login...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/wallet-login";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, toast]);

  // Fetch project details
  const { data: projectData, isLoading: projectLoading } = useQuery<{ project: any; stats: any }>({
    queryKey: [`/api/devtools/projects/${projectId}`],
    enabled: isAuthenticated && !!projectId,
  });

  // Fetch project revenue data
  const { data: revenueData } = useQuery<{ breakdown: any; recentPayments: any[]; monthlyRevenue: any }>({
    queryKey: [`/api/devtools/projects/${projectId}/revenue`],
    enabled: isAuthenticated && !!projectId,
  });

  // Fetch project stats
  const { data: statsData } = useQuery<{ stats: any }>({
    queryKey: [`/api/devtools/projects/${projectId}/stats`],
    enabled: isAuthenticated && !!projectId,
  });

  const project = projectData?.project;
  const projectStats = projectData?.stats;
  const revenue = revenueData?.breakdown || { total: 0, airdrops: 0, snapshots: 0, promotions: 0 };
  const activityStats = statsData?.stats || {};

  // Show loading state
  if (authLoading || projectLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-400">Loading project...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // All available tools with type categorization
  const allTools = [
    {
      id: 'token-creator',
      title: 'Token Creator',
      description: 'Deploy custom tokens for this project',
      icon: Coins,
      color: 'bg-blue-500',
      route: `/devtools/project/${projectId}/token-creator`,
      metrics: { deployed: 0, pending: 0 },
      type: 'token' // Only for token projects
    },
    {
      id: 'nft-creator',
      title: 'NFT Creator',
      description: 'Launch NFT collections for this project',
      icon: Image,
      color: 'bg-purple-500',
      route: `/devtools/project/${projectId}/nft-creator`,
      metrics: { collections: 0, minted: 0 },
      type: 'nft' // Only for NFT projects
    },
    {
      id: 'airdrop',
      title: 'Airdrop Manager',
      description: 'Distribute tokens and NFTs to your community',
      icon: Gift,
      color: 'bg-red-500',
      route: `/devtools/project/${projectId}/airdrop`,
      metrics: { active: 0, completed: 0 },
      type: 'both' // Available for both types
    },
    {
      id: 'snapshot-token',
      title: 'Token Snapshot',
      description: 'Capture token holder data',
      icon: Download,
      color: 'bg-orange-500',
      route: `/devtools/project/${projectId}/snapshot-token`,
      metrics: { snapshots: 0 },
      type: 'token' // Only for token projects
    },
    {
      id: 'snapshot-nft',
      title: 'NFT Snapshot',
      description: 'Capture NFT holder data',
      icon: Camera,
      color: 'bg-green-500',
      route: `/devtools/project/${projectId}/snapshot-nft`,
      metrics: { snapshots: 0 },
      type: 'nft' // Only for NFT projects
    },
    {
      id: 'market-maker',
      title: 'Market Maker',
      description: 'Automated trading for liquidity',
      icon: TrendingUp,
      color: 'bg-indigo-500',
      route: `/devtools/project/${projectId}/market-maker`,
      metrics: { active: false },
      type: 'token' // Only for token projects
    }
  ];

  // Filter tools based on project type
  const projectType = project?.projectType || 'nft'; // Default to NFT if not specified
  const tools = allTools.filter(tool => 
    tool.type === 'both' || tool.type === projectType
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-black">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <Button 
            onClick={() => navigate('/devtools')} 
            variant="ghost" 
            className="mb-4 flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Projects
          </Button>
          
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                {project?.name || 'Project Dashboard'}
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                {project?.description || 'Manage all tools and services for this project'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {project?.projectType && (
                <Badge 
                  variant="outline" 
                  className={`text-sm ${
                    project.projectType === 'nft' 
                      ? 'border-purple-500 text-purple-600 dark:text-purple-400' 
                      : 'border-blue-500 text-blue-600 dark:text-blue-400'
                  }`}
                >
                  {project.projectType === 'nft' ? '🖼️ NFT Project' : '🪙 Token Project'}
                </Badge>
              )}
              <Badge 
                variant={project?.status === 'active' ? 'default' : 'secondary'}
                className="text-sm"
              >
                {project?.status || 'Active'}
              </Badge>
              {project?.subscriptionTier && (
                <Badge variant="outline" className="text-sm">
                  {project.subscriptionTier === 'bronze' ? '🥉 Bronze' : '🥇 Gold'}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Project Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                ${projectStats?.totalRevenue || '0.00'}
              </p>
              <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                {projectStats?.paidPayments || 0} completed payments
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">Chain</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{project?.chain || 'Multi-chain'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">Active Airdrops</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{activityStats.activeAirdrops || 0}</p>
              <p className="text-xs text-slate-500 mt-1">
                {activityStats.totalAirdrops || 0} total
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">Snapshots</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{activityStats.totalSnapshots || 0}</p>
              <p className="text-xs text-slate-500 mt-1">
                Total captured
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tools Grid */}
        <Tabs defaultValue="tools" className="w-full">
          <TabsList className="grid w-full max-w-2xl grid-cols-4">
            <TabsTrigger value="tools">Tools</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          
          <TabsContent value="tools" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <Card 
                    key={tool.id} 
                    className="hover:shadow-lg transition-all duration-200 cursor-pointer border-2 hover:border-blue-500/50"
                    onClick={() => navigate(tool.route)}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className={`p-3 rounded-lg ${tool.color} bg-opacity-10`}>
                          <Icon className={`w-6 h-6 text-white ${tool.color} bg-opacity-100 rounded p-1`} />
                        </div>
                        <Button size="sm" variant="ghost">
                          <ArrowLeft className="w-4 h-4 rotate-180" />
                        </Button>
                      </div>
                      <CardTitle className="mt-4">{tool.title}</CardTitle>
                      <CardDescription>{tool.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
                        {Object.entries(tool.metrics).map(([key, value]) => (
                          <div key={key}>
                            <span className="capitalize">{key}:</span>
                            <span className="ml-1 font-semibold">
                              {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
          
          <TabsContent value="revenue" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Revenue Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle>Income Breakdown</CardTitle>
                  <CardDescription>Revenue by service type</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Gift className="w-4 h-4 text-purple-500" />
                      <span className="text-sm">Airdrops</span>
                    </div>
                    <span className="font-bold">${revenue.airdrops?.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Camera className="w-4 h-4 text-blue-500" />
                      <span className="text-sm">Snapshots</span>
                    </div>
                    <span className="font-bold">${revenue.snapshots?.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-500" />
                      <span className="text-sm">Promotions</span>
                    </div>
                    <span className="font-bold">${revenue.promotions?.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4 text-yellow-500" />
                      <span className="text-sm">Subscriptions</span>
                    </div>
                    <span className="font-bold">${revenue.subscriptions?.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="pt-4 border-t">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">Total Revenue</span>
                      <span className="text-2xl font-bold text-green-600">${revenue.total?.toFixed(2) || '0.00'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Payments */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Payments</CardTitle>
                  <CardDescription>Latest transactions</CardDescription>
                </CardHeader>
                <CardContent>
                  {revenueData?.recentPayments && revenueData.recentPayments.length > 0 ? (
                    <div className="space-y-3">
                      {revenueData.recentPayments.slice(0, 5).map((payment: any) => (
                        <div key={payment.id} className="flex justify-between items-center text-sm border-b pb-2">
                          <div>
                            <p className="font-medium capitalize">{payment.service_type}</p>
                            <p className="text-xs text-slate-500">
                              {new Date(payment.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">${payment.amount}</p>
                            <Badge variant={payment.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
                              {payment.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-600 dark:text-slate-400">No payments yet</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Monthly Revenue Chart */}
            {revenueData?.monthlyRevenue && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Monthly Revenue Trend</CardTitle>
                  <CardDescription>Last 12 months</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {revenueData.monthlyRevenue.slice(-6).map((month: any) => (
                      <div key={month.month} className="flex items-center gap-4">
                        <span className="text-sm w-24">{month.month}</span>
                        <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-8 relative">
                          <div 
                            className="bg-green-500 h-8 rounded-full flex items-center justify-end px-3"
                            style={{ width: `${Math.min((parseFloat(month.revenue) / Math.max(...revenueData.monthlyRevenue.map((m: any) => parseFloat(m.revenue)))) * 100, 100)}%` }}
                          >
                            <span className="text-white text-sm font-medium">${month.revenue}</span>
                          </div>
                        </div>
                        <span className="text-xs text-slate-500 w-16">{month.transactions} txns</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="activity" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Project Statistics</CardTitle>
                  <CardDescription>Activity overview</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm">Total Airdrops:</span>
                    <span className="font-semibold">{activityStats.totalAirdrops || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Active Airdrops:</span>
                    <span className="font-semibold">{activityStats.activeAirdrops || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Completed Airdrops:</span>
                    <span className="font-semibold">{activityStats.completedAirdrops || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Total Snapshots:</span>
                    <span className="font-semibold">{activityStats.totalSnapshots || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Active Promotions:</span>
                    <span className="font-semibold">{activityStats.activePromotions || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">AMM Configurations:</span>
                    <span className="font-semibold">{activityStats.ammConfigs || 0}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                  <CardDescription>Common tasks</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button variant="outline" className="w-full justify-start" onClick={() => navigate(`/devtools/project/${projectId}/airdrop`)}>
                    <Gift className="w-4 h-4 mr-2" />
                    Create Airdrop
                  </Button>
                  <Button variant="outline" className="w-full justify-start" onClick={() => navigate(`/devtools/project/${projectId}/snapshot-token`)}>
                    <Download className="w-4 h-4 mr-2" />
                    Take Snapshot
                  </Button>
                  <Button variant="outline" className="w-full justify-start" onClick={() => navigate(`/devtools/project/${projectId}/market-maker`)}>
                    <Activity className="w-4 h-4 mr-2" />
                    Setup AMM
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="settings" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Project Settings</CardTitle>
                <CardDescription>Configure your project preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Project Name</label>
                  <p className="text-slate-600 dark:text-slate-400">{project?.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">API Keys</label>
                  <p className="text-slate-600 dark:text-slate-400">Configure external service integrations</p>
                </div>
                <Button variant="outline" className="w-full">
                  <Settings className="w-4 h-4 mr-2" />
                  Advanced Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
