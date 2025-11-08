import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { useMetadata } from '@/hooks/use-metadata';
import { apiRequest } from '@/lib/queryClient';
import type { DevtoolsProject } from '@shared/schema';

// API Response Types
interface DiscoveredProjectsResponse {
  projects: DevtoolsProject[];
}

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { 
  Plus, Crown, ArrowLeft, ChevronRight, Link, Search, Users, 
  Wallet, Settings, Code2, ExternalLink, AlertTriangle, 
  CheckCircle2, FolderPlus, Zap, TrendingUp, Copy, Target, Activity
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import WalletLinkingCard from '@/components/devtools/wallet-linking-card';
import WalletConnectionModal from '@/components/devtools/wallet-connection-modal';
import ProjectDiscoveryCard from '@/components/devtools/project-discovery-card';
import ClaimingWizard from '@/components/devtools/claiming-wizard';
import ClaimedProjectsDashboard from '@/components/devtools/claimed-projects-dashboard';
import TokenAnalyticsConfig from '@/components/devtools/token-analytics-config';
import { CacheMonitoringDashboard } from '@/components/devtools/cache-monitoring-dashboard';
import AuthorizedMinter from '@/components/devtools/authorized-minter';
import AllWalletsDashboard from '@/components/devtools/all-wallets-dashboard';
import BatchClaiming from '@/components/devtools/batch-claiming';

export default function DevTools() {
  // Set SEO metadata for DevTools page
  useMetadata();
  
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoading, user, walletData, walletAddresses } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const queryClient = useQueryClient();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
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
  }, [isAuthenticated, isLoading, toast]);

  // Fetch user's DevTools projects - ALWAYS call hook, control with enabled
  const { data: projects = [], isLoading: projectsLoading } = useQuery<DevtoolsProject[]>({
    queryKey: ['/api/devtools/projects'],
    enabled: !isLoading && isAuthenticated,
  });

  // Fetch linked external wallets - ALWAYS call hook, control with enabled  
  const { data: linkedWalletsData, refetch: refetchWallets } = useQuery({
    queryKey: ['/api/devtools/wallets'],
    queryFn: async () => {
      const response = await fetch('/api/devtools/wallets?userId=' + user?.walletAddress, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch wallets');
      return response.json();
    },
    enabled: !isLoading && isAuthenticated && !!user?.walletAddress,
  });

  // Fetch external wallets for enhanced display - ALWAYS call hook, control with enabled
  const { data: externalWalletsData = [], isLoading: isLoadingExternalWallets } = useQuery({
    queryKey: ['/api/external-wallets/list'],
    enabled: !isLoading && isAuthenticated,
  });

  // Fetch projects linked to all connected wallets - ALWAYS call hook, control with enabled
  const { data: discoveredProjectsData } = useQuery<DiscoveredProjectsResponse>({
    queryKey: ['/api/wallet-project-links/auto-detect-projects'],
    enabled: !isLoading && isAuthenticated,
  });

  // React Query mutation for blockchain search - MOVED ABOVE ALL EARLY RETURNS
  const blockchainSearchMutation = useMutation({
    mutationFn: async () => {
      const walletInfo = walletAddresses || walletData || {};
      const addresses: { chain: string; address: string; type: string }[] = [];
      
      if (walletInfo.ethAddress) {
        addresses.push({ chain: 'Ethereum', address: walletInfo.ethAddress, type: 'ETH' });
      }
      if (walletInfo.xrpAddress) {
        addresses.push({ chain: 'XRP Ledger', address: walletInfo.xrpAddress, type: 'XRP' });
      }
      if (walletInfo.solAddress) {
        addresses.push({ chain: 'Solana', address: walletInfo.solAddress, type: 'SOL' });
      }
      if (walletInfo.btcAddress) {
        addresses.push({ chain: 'Bitcoin', address: walletInfo.btcAddress, type: 'BTC' });
      }
      
      const searchPromises = addresses.map(async ({ address, type }) => {
        const response = await apiRequest(`/api/blockchain/search-projects?address=${address}&chain=${type}`);
        const data = await response.json() as any;
        return { address, type, projects: data.projects || [] };
      });
      
      return await Promise.all(searchPromises);
    },
    onSuccess: (results) => {
      // Cache the results using React Query
      queryClient.setQueryData(['blockchain-search-results'], results);
      toast({
        title: "Search Complete",
        description: `Found ${results.reduce((total, result) => total + result.projects.length, 0)} projects across ${results.length} addresses`,
      });
    },
    onError: (error) => {
      console.error('Blockchain search failed:', error);
      toast({
        title: "Search Failed",
        description: "Failed to search blockchain projects",
        variant: "destructive",
      });
    },
  });

  // Get blockchain search results from React Query cache - MOVED ABOVE ALL EARLY RETURNS
  const { data: blockchainSearchResults = [] } = useQuery<any[]>({
    queryKey: ['blockchain-search-results'],
    enabled: false, // Only fetch when explicitly searched
    initialData: [],
  });

  // Prepare all data variables AFTER all hooks are declared
  const linkedWallets = linkedWalletsData?.wallets || [];
  const discoveredProjects = discoveredProjectsData?.projects || [];
  const externalWallets = (externalWalletsData as { wallets?: any[] })?.wallets || externalWalletsData || [];

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (date: string | Date | null) => {
    if (!date) return 'Unknown';
    return new Date(date).toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'inactive':
        return 'bg-red-500/10 text-red-600 border-red-500/20';
      default:
        return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
    }
  };

  const handleWalletConnected = () => {
    refetchWallets();
  };

  // Get all available wallet addresses
  const getAllWalletAddresses = () => {
    const addresses: { chain: string; address: string; type: string }[] = [];
    const walletInfo = walletAddresses || walletData || {};
    
    if (walletInfo.ethAddress) {
      addresses.push({ chain: 'Ethereum', address: walletInfo.ethAddress, type: 'ETH' });
    }
    if (walletInfo.xrpAddress) {
      addresses.push({ chain: 'XRP Ledger', address: walletInfo.xrpAddress, type: 'XRP' });
    }
    if (walletInfo.solAddress) {
      addresses.push({ chain: 'Solana', address: walletInfo.solAddress, type: 'SOL' });
    }
    if (walletInfo.btcAddress) {
      addresses.push({ chain: 'Bitcoin', address: walletInfo.btcAddress, type: 'BTC' });
    }
    
    return addresses;
  };

  // Chain color utility function
  const getChainColor = (chain: string) => {
    const colors: Record<string, string> = {
      evm: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      eth: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', // Ethereum
      sol: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      xrp: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      btc: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200', // Bitcoin
      arbitrum: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      optimism: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      polygon: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      bsc: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
    };
    return colors[chain?.toLowerCase()] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  };

  // Show loading state while checking auth or projects - MOVED AFTER ALL HOOKS
  if (isLoading || projectsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-400">Loading DevTools...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Copy address to clipboard
  const copyToClipboard = async (address: string, type: string) => {
    try {
      await navigator.clipboard.writeText(address);
      toast({
        title: "Address Copied",
        description: `${type} address copied to clipboard`,
      });
    } catch (err) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy address to clipboard",
        variant: "destructive",
      });
    }
  };
  
  // Get total projects found across all addresses
  const getTotalBlockchainProjects = () => {
    return blockchainSearchResults.reduce((total, result) => total + result.projects.length, 0);
  };

  const walletAddressList = getAllWalletAddresses();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2" data-testid="devtools-title">
                DevTools Dashboard
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                Manage your blockchain projects, link external wallets, and discover new opportunities
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <Button 
                variant="outline" 
                onClick={() => setIsWalletModalOpen(true)}
                data-testid="connect-wallet-button"
              >
                <Wallet className="w-4 h-4 mr-2" />
                Connect Wallet
              </Button>
              <Button onClick={() => navigate('/devtools/new-project')} data-testid="new-project-button">
                <Plus className="w-4 h-4 mr-2" />
                New Project
              </Button>
            </div>
          </div>

          {/* Wallet Addresses Section */}
          {walletAddressList.length > 0 && (
            <Card className="mb-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-blue-200 dark:border-blue-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Your Wallet Addresses</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Active addresses used for project discovery
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => blockchainSearchMutation.mutate()}
                    disabled={blockchainSearchMutation.isPending}
                    data-testid="search-blockchain-projects"
                  >
                    {blockchainSearchMutation.isPending ? (
                      <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full mr-2" />
                    ) : (
                      <Target className="w-4 h-4 mr-2" />
                    )}
                    {blockchainSearchMutation.isPending ? 'Searching...' : 'Find My Projects'}
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {walletAddressList.map(({ chain, address, type }) => (
                    <div 
                      key={`${type}-${address}`} 
                      className="bg-white dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="secondary" className="text-xs font-medium">
                          {type}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(address, type)}
                          className="h-6 w-6 p-0"
                          data-testid={`copy-${type.toLowerCase()}-address`}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">{chain}</p>
                      <code className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded block truncate" data-testid={`${type.toLowerCase()}-address`}>
                        {address}
                      </code>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <FolderPlus className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" data-testid="projects-count">{projects.length}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Projects</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <Wallet className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" data-testid="wallets-count">{linkedWallets.length}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Linked Wallets</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-cyan-500/10 rounded-lg">
                    <Link className="w-5 h-5 text-cyan-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" data-testid="external-wallets-count">
                      {isLoadingExternalWallets ? (
                        <div className="animate-pulse bg-slate-200 dark:bg-slate-700 rounded w-8 h-8"></div>
                      ) : (
                        externalWallets.length
                      )}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">External Wallets</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <Search className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" data-testid="discovered-count">{discoveredProjects.length}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Discovered</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-orange-500/10 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {projects.filter(p => p.status === 'active').length}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Active</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-pink-500/10 rounded-lg">
                    <Target className="w-5 h-5 text-pink-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" data-testid="blockchain-projects-count">
                      {getTotalBlockchainProjects()}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Blockchain</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* External Wallet Connections Overview */}
          {(isLoadingExternalWallets || externalWallets.length > 0) && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Link className="h-5 w-5 text-cyan-600" />
                    <span>External Wallet Connections</span>
                    <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      {isLoadingExternalWallets ? '...' : externalWallets.length} Active
                    </Badge>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setActiveTab('wallets')} data-testid="view-all-external-wallets">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View All
                  </Button>
                </CardTitle>
                <CardDescription>
                  External wallets connected for cross-chain operations and project management
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingExternalWallets ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(3)].map((_, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border">
                        <div className="animate-pulse">
                          <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-2/3 animate-pulse"></div>
                        </div>
                        <div className="animate-pulse">
                          <div className="h-6 w-12 bg-slate-200 dark:bg-slate-700 rounded"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {externalWallets.slice(0, 6).map((wallet: any) => (
                    <div 
                      key={wallet.id} 
                      className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border"
                      data-testid={`devtools-external-wallet-${wallet.id}`}
                    >
                      <div className="relative">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                          <Wallet className="w-4 h-4 text-white" />
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium capitalize text-sm">{wallet.wallet_type}</span>
                          <Badge variant="outline" className={`text-xs px-1.5 py-0 ${getChainColor(wallet.chain)}`}>
                            {wallet.chain.toUpperCase()}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground font-mono truncate">
                          {wallet.address.slice(0, 8)}...{wallet.address.slice(-6)}
                        </div>
                      </div>
                      <div className="flex items-center">
                        <Badge variant="secondary" className="text-xs bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300">
                          <Activity className="w-2.5 h-2.5 mr-1" />
                          Active
                        </Badge>
                      </div>
                    </div>
                    ))}
                  </div>
                )}
                {!isLoadingExternalWallets && externalWallets.length > 6 && (
                  <div className="mt-4 text-center">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setActiveTab('wallets')}
                      data-testid="view-more-external-wallets"
                    >
                      View {externalWallets.length - 6} More Connections
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="devtools-tabs">
          <TabsList className="grid w-full grid-cols-8">
            <TabsTrigger value="overview" data-testid="overview-tab">
              <Zap className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="projects" data-testid="projects-tab">
              <Code2 className="w-4 h-4 mr-2" />
              Projects
            </TabsTrigger>
            <TabsTrigger value="authorized-minter" data-testid="authorized-minter-tab">
              <Crown className="w-4 h-4 mr-2" />
              Auth Minter
            </TabsTrigger>
            <TabsTrigger value="claim" data-testid="claim-tab">
              <Crown className="w-4 h-4 mr-2" />
              Claim
            </TabsTrigger>
            <TabsTrigger value="blockchain" data-testid="blockchain-tab">
              <Target className="w-4 h-4 mr-2" />
              Blockchain
            </TabsTrigger>
            <TabsTrigger value="wallets" data-testid="wallets-tab">
              <Wallet className="w-4 h-4 mr-2" />
              Wallets
            </TabsTrigger>
            <TabsTrigger value="discover" data-testid="discover-tab">
              <Search className="w-4 h-4 mr-2" />
              Discover
            </TabsTrigger>
            <TabsTrigger value="settings" data-testid="settings-tab">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab - All Wallets & Projects */}
          <TabsContent value="overview" className="space-y-6">
            <AllWalletsDashboard />
          </TabsContent>

          {/* Projects Tab */}
          <TabsContent value="projects" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Your Projects</h2>
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search projects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-64"
                    data-testid="search-projects"
                  />
                </div>
              </div>
            </div>

            {filteredProjects.length === 0 ? (
              <Card className="border-2 border-dashed border-slate-300 dark:border-slate-600">
                <CardContent className="py-12 text-center">
                  <div className="mx-auto w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
                    <FolderPlus className="w-8 h-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No projects found</h3>
                  <p className="text-slate-600 dark:text-slate-400 mb-6">
                    {searchQuery ? 'No projects match your search.' : 'Create your first DevTools project to get started.'}
                  </p>
                  {!searchQuery && (
                    <Button onClick={() => navigate('/devtools/new-project')} data-testid="create-first-project">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Your First Project
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProjects.map((project) => (
                  <Card 
                    key={project.id}
                    className="hover:shadow-lg transition-all duration-200 cursor-pointer border hover:border-blue-500/50"
                    onClick={() => navigate(`/devtools/project/${project.id}`)}
                    data-testid={`project-card-${project.id}`}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg truncate">{project.name}</CardTitle>
                          {project.description && (
                            <CardDescription className="mt-1">{project.description}</CardDescription>
                          )}
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0 ml-2" />
                      </div>
                      <div className="flex items-center space-x-2 mt-2">
                        <Badge variant="secondary" className="text-xs">
                          {project.projectType}
                        </Badge>
                        <Badge className={getStatusColor(project.status)}>
                          {project.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-400">Chains</span>
                          <span className="font-medium">{project.selectedChains?.length || 0}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-400">Created</span>
                          <span className="font-medium">{formatDate(project.createdAt)}</span>
                        </div>
                        {project.vanity_slug && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-600 dark:text-slate-400">URL</span>
                            <code className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                              /{project.vanity_slug}
                            </code>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Authorized Minter Tab */}
          <TabsContent value="authorized-minter" className="space-y-6">
            <AuthorizedMinter />
          </TabsContent>

          {/* Project Claiming Tab */}
          <TabsContent value="claim" className="space-y-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Claim Your Projects</h2>
                  <p className="text-slate-600 dark:text-slate-400">
                    Claim ownership of your XRPL NFT collections and manage your project dashboard
                  </p>
                </div>
              </div>

              {/* Sub-tabs for Claim section */}
              <Tabs defaultValue="batch" className="space-y-6">
                <TabsList className="grid w-full grid-cols-3 max-w-2xl">
                  <TabsTrigger value="batch" data-testid="claim-batch-tab">
                    <Zap className="w-4 h-4 mr-2" />
                    Batch Claim
                  </TabsTrigger>
                  <TabsTrigger value="wizard" data-testid="claim-wizard-tab">
                    <Crown className="w-4 h-4 mr-2" />
                    Single Claim
                  </TabsTrigger>
                  <TabsTrigger value="dashboard" data-testid="claim-dashboard-tab">
                    <Settings className="w-4 h-4 mr-2" />
                    My Claims
                  </TabsTrigger>
                </TabsList>

                {/* Batch Claiming */}
                <TabsContent value="batch">
                  <BatchClaiming
                    onComplete={() => {
                      toast({
                        title: "Batch Claim Complete",
                        description: "Your project claims have been submitted successfully.",
                      });
                    }}
                    data-testid="batch-claiming"
                  />
                </TabsContent>

                {/* Claiming Wizard */}
                <TabsContent value="wizard">
                  <ClaimingWizard
                    onComplete={() => {
                      toast({
                        title: "Claim Process Complete",
                        description: "Your project claim has been submitted successfully.",
                      });
                    }}
                    onCancel={() => {
                      // Could navigate back to projects or show a confirmation dialog
                    }}
                    data-testid="claiming-wizard"
                  />
                </TabsContent>

                {/* Claimed Projects Dashboard */}
                <TabsContent value="dashboard">
                  <ClaimedProjectsDashboard data-testid="claimed-projects-dashboard" />
                </TabsContent>
              </Tabs>
            </div>
          </TabsContent>

          {/* Blockchain Search Tab */}
          <TabsContent value="blockchain" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Blockchain Project Search</h2>
                <p className="text-slate-600 dark:text-slate-400">
                  Search for projects deployed by your wallet addresses across different blockchains
                </p>
              </div>
              <Button 
                onClick={() => blockchainSearchMutation.mutate()}
                disabled={blockchainSearchMutation.isPending || walletAddressList.length === 0}
                data-testid="manual-blockchain-search"
              >
                {blockchainSearchMutation.isPending ? (
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                ) : (
                  <Target className="w-4 h-4 mr-2" />
                )}
                {blockchainSearchMutation.isPending ? 'Searching...' : 'Search All Chains'}
              </Button>
            </div>

            {walletAddressList.length === 0 ? (
              <Card className="border-2 border-dashed border-slate-300 dark:border-slate-600">
                <CardContent className="py-12 text-center">
                  <div className="mx-auto w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
                    <Wallet className="w-8 h-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No wallet addresses found</h3>
                  <p className="text-slate-600 dark:text-slate-400 mb-6">
                    Please login with your Riddle wallet to search for projects deployed by your addresses
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Search Results by Address */}
                {blockchainSearchResults.length > 0 ? (
                  <div className="space-y-6">
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                      <span className="text-sm font-medium">
                        Found {getTotalBlockchainProjects()} projects across {blockchainSearchResults.length} addresses
                      </span>
                    </div>
                    
                    {blockchainSearchResults.map(({ address, type, projects }, index) => (
                      <Card key={`${type}-${address}-${index}`} className="border-l-4 border-l-blue-500">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <Badge variant="secondary">{type}</Badge>
                              <div>
                                <CardTitle className="text-lg">{type} Address</CardTitle>
                                <code className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                                  {address}
                                </code>
                              </div>
                            </div>
                            <Badge variant="outline">
                              {projects.length} {projects.length === 1 ? 'project' : 'projects'}
                            </Badge>
                          </div>
                        </CardHeader>
                        {projects.length > 0 && (
                          <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {projects.map((project: any, projectIndex: number) => (
                                <div 
                                  key={`project-${projectIndex}`}
                                  className="border rounded-lg p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                >
                                  <div className="flex items-start justify-between mb-2">
                                    <h4 className="font-medium text-sm">
                                      {project.name || project.contractAddress || 'Unnamed Project'}
                                    </h4>
                                    <Badge variant="outline" className="text-xs">
                                      {project.type || 'Contract'}
                                    </Badge>
                                  </div>
                                  {project.description && (
                                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                                      {project.description}
                                    </p>
                                  )}
                                  <div className="flex items-center justify-between text-xs text-slate-500">
                                    <span>Created: {formatDate(project.createdAt || project.timestamp)}</span>
                                    {project.txHash && (
                                      <Button variant="ghost" size="sm" className="h-6 text-xs">
                                        <ExternalLink className="w-3 h-3 mr-1" />
                                        View
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="border-2 border-dashed border-slate-300 dark:border-slate-600">
                    <CardContent className="py-12 text-center">
                      <div className="mx-auto w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
                        <Target className="w-8 h-8 text-slate-400" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">
                        {blockchainSearchMutation.isPending ? 'Searching blockchains...' : 'Ready to search'}
                      </h3>
                      <p className="text-slate-600 dark:text-slate-400 mb-6">
                        {blockchainSearchMutation.isPending 
                          ? 'Searching across multiple blockchains for projects deployed by your addresses...'
                          : 'Click "Search All Chains" to find projects deployed by your wallet addresses'
                        }
                      </p>
                      {!blockchainSearchMutation.isPending && (
                        <Button onClick={() => blockchainSearchMutation.mutate()} data-testid="start-blockchain-search">
                          <Target className="w-4 h-4 mr-2" />
                          Start Search
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}
                
                {/* Wallet Addresses Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Your Wallet Addresses</CardTitle>
                    <CardDescription>Addresses being searched across different blockchains</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {walletAddressList.map(({ chain, address, type }) => (
                        <div 
                          key={`${type}-${address}`}
                          className="border rounded-lg p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <Badge variant="secondary" className="text-xs">{type}</Badge>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                              {address}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(address, type)}
                            className="h-8 w-8 p-0 ml-2"
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Wallets Tab */}
          <TabsContent value="wallets" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Linked Wallets</h2>
                <p className="text-slate-600 dark:text-slate-400">
                  Connect external wallets to discover and manage your projects
                </p>
              </div>
              <Button onClick={() => setIsWalletModalOpen(true)} data-testid="add-wallet-button">
                <Plus className="w-4 h-4 mr-2" />
                Link Wallet
              </Button>
            </div>

            {linkedWallets.length === 0 ? (
              <Card className="border-2 border-dashed border-slate-300 dark:border-slate-600">
                <CardContent className="py-12 text-center">
                  <div className="mx-auto w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
                    <Wallet className="w-8 h-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No wallets linked</h3>
                  <p className="text-slate-600 dark:text-slate-400 mb-6">
                    Link your external wallets to automatically discover and manage blockchain projects
                  </p>
                  <Button onClick={() => setIsWalletModalOpen(true)} data-testid="link-first-wallet">
                    <Wallet className="w-4 h-4 mr-2" />
                    Link Your First Wallet
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {linkedWallets.map((wallet: any) => (
                  <WalletLinkingCard
                    key={wallet.id}
                    wallet={wallet}
                    onWalletUnlinked={() => refetchWallets()}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Discover Tab */}
          <TabsContent value="discover" className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold">Project Discovery</h2>
              <p className="text-slate-600 dark:text-slate-400">
                Projects automatically discovered from your linked wallets
              </p>
            </div>

            {discoveredProjects.length === 0 ? (
              <Card className="border-2 border-dashed border-slate-300 dark:border-slate-600">
                <CardContent className="py-12 text-center">
                  <div className="mx-auto w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
                    <Search className="w-8 h-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No projects discovered</h3>
                  <p className="text-slate-600 dark:text-slate-400 mb-6">
                    {linkedWallets.length === 0 
                      ? "Link your external wallets to automatically discover projects you're involved with"
                      : "We'll automatically detect projects associated with your linked wallets"
                    }
                  </p>
                  {linkedWallets.length === 0 && (
                    <Button onClick={() => setIsWalletModalOpen(true)} data-testid="link-wallet-to-discover">
                      <Wallet className="w-4 h-4 mr-2" />
                      Link Wallet to Discover Projects
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {discoveredProjects.map((project: any) => (
                  <ProjectDiscoveryCard
                    key={project.id}
                    project={project}
                    canClaim={project.claimStatus === 'unclaimed'}
                    onProjectClaimed={() => {
                      // Refresh discovered projects
                    }}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold">DevTools Settings</h2>
              <p className="text-slate-600 dark:text-slate-400">
                Configure your DevTools preferences and account settings
              </p>
            </div>

            {/* Token Analytics Configuration - Full Width */}
            <TokenAnalyticsConfig />

            {/* Cache Monitoring Dashboard - Full Width */}
            <CacheMonitoringDashboard />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Developer Tools</CardTitle>
                  <CardDescription>Access individual development tools</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => navigate('/devtools-dashboard')}
                    data-testid="tools-dashboard-link"
                  >
                    <Code2 className="w-4 h-4 mr-2" />
                    Tools Dashboard
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => navigate('/devtools/token-creator')}
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    Token Creator
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => navigate('/devtools/nft-creator')}
                  >
                    <Crown className="w-4 h-4 mr-2" />
                    NFT Creator
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Account & Billing</CardTitle>
                  <CardDescription>Manage your subscription and billing</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Current Plan</span>
                    <Badge variant="outline">Free Tier</Badge>
                  </div>
                  <Button variant="outline" className="w-full" data-testid="upgrade-plan-button">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Upgrade Plan
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Wallet Connection Modal */}
        <WalletConnectionModal
          isOpen={isWalletModalOpen}
          onClose={() => setIsWalletModalOpen(false)}
          onWalletConnected={handleWalletConnected}
        />
      </div>
    </div>
  );
}
