import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Coins, 
  Image, 
  Camera, 
  Download, 
  Gift, 
  ArrowRight, 
  Zap, 
  TrendingUp, 
  Users, 
  Shield,
  Star,
  Sparkles,
  Code,
  Database,
  FolderOpen,
  ExternalLink,
  Layers,
  Globe,
  Search,
  CheckCircle,
  Plus,
  Wallet
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import '../styles/devtools-dashboard.css';

interface DiscoveredProject {
  id: string;
  chain: string;
  issuerAddress: string;
  taxon?: number;
  assetType: 'token' | 'nft';
  name: string;
  description: string;
  logoUrl?: string;
  nftCount?: number;
  sampleNFTs?: any[];
  discoverySource: 'onchain' | 'manual';
  claimedInDatabase: boolean;
  existingProjectId?: string;
}

interface OnChainDiscoverResponse {
  success: boolean;
  discoveredProjects: DiscoveredProject[];
  searchedWallets: string[];
  stats: {
    totalWalletsScanned: number;
    projectsDiscovered: number;
    unclaimed: number;
    claimed: number;
  };
}

interface IssuerSearchResponse {
  success: boolean;
  issuerAddress: string;
  chain: string;
  discoveredProjects: DiscoveredProject[];
  count: number;
}

const DevToolsDashboard = () => {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [, setLocation] = useLocation();
  const [issuerSearch, setIssuerSearch] = useState('');
  const [searchResults, setSearchResults] = useState<DiscoveredProject[]>([]);
  const queryClient = useQueryClient();

  // Discover projects on-chain
  const { data: onChainData, isLoading: projectsLoading, refetch: refetchOnChain } = useQuery<OnChainDiscoverResponse>({
    queryKey: ['/api/wallet-project-links/discover-onchain-projects'],
    enabled: isAuthenticated,
    retry: 1,
    staleTime: 60000, // Cache for 1 minute
  });

  // Search by issuer mutation
  const searchByIssuer = useMutation({
    mutationFn: async (issuer: string) => {
      const response = await apiRequest('/api/wallet-project-links/search-by-issuer', {
        method: 'POST',
        body: JSON.stringify({ issuerAddress: issuer, chain: 'xrpl' })
      });
      return response.json();
    },
    onSuccess: (data: IssuerSearchResponse) => {
      setSearchResults(data.discoveredProjects);
      toast({
        title: "Search Complete",
        description: `Found ${data.count} project(s) for issuer ${data.issuerAddress}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Search Failed",
        description: error.message || "Failed to search by issuer",
        variant: "destructive",
      });
    }
  });

  // Claim project mutation
  const claimProject = useMutation({
    mutationFn: async (project: DiscoveredProject) => {
      const response = await apiRequest('/api/wallet-project-links/claim-project', {
        method: 'POST',
        body: JSON.stringify({
          issuerAddress: project.issuerAddress,
          taxon: project.taxon,
          chain: project.chain,
          projectName: project.name,
          projectDescription: project.description
        })
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Project Claimed!",
        description: "Project has been linked to your account",
      });
      // Refresh on-chain discovery
      queryClient.invalidateQueries({ queryKey: ['/api/wallet-project-links/discover-onchain-projects'] });
      refetchOnChain();
    },
    onError: (error: any) => {
      toast({
        title: "Claim Failed",
        description: error.message || "Failed to claim project",
        variant: "destructive",
      });
    }
  });

  // IMPORTANT: All hooks must be called BEFORE any conditional returns
  // Fetch user's claimed projects
  const { data: userProjects } = useQuery<{ projects: Array<any> }>({
    queryKey: ['/api/devtools/projects'],
    enabled: isAuthenticated,
  });

  const [activeTab, setActiveTab] = useState<'search' | 'create'>('search');

  const handleIssuerSearch = () => {
    if (!issuerSearch.trim()) {
      toast({
        title: "Invalid Input",
        description: "Please enter an issuer address",
        variant: "destructive",
      });
      return;
    }
    searchByIssuer.mutate(issuerSearch.trim());
  };

  // Don't redirect - just show login UI if not authenticated
  // This allows the page to load and show tools even when not logged in

  // Show loading state while checking auth (AFTER all hooks are called)
  if (isLoading) {
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

  return (
    <div className="devtools-dashboard">
      {/* Hero Section */}
      <div className="devtools-hero">
        <div className="hero-content">
          <div className="hero-badge">
            <Sparkles className="w-4 h-4" />
            <span>Multi-Chain DevTools Suite</span>
          </div>
          
          <h1 className="hero-title">
            Blockchain Developer Tools
          </h1>
          
          <p className="hero-subtitle">
            Professional-grade tools for token creation, NFT deployment, data snapshots, and airdrops across multiple blockchains. Build, deploy, and manage your Web3 projects with ease.
          </p>

          {/* Tab Navigation for Search vs Create */}
          {isAuthenticated && (
            <div className="flex justify-center mb-6">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'search' | 'create')} className="w-full max-w-md">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="search" className="flex items-center gap-2">
                    <Search className="w-4 h-4" />
                    Search & Discover
                  </TabsTrigger>
                  <TabsTrigger value="create" className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Create New
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          )}

          <div className="hero-stats">
            <div className="stat-item">
              <Zap className="w-5 h-5" />
              <div>
                <div className="stat-number">5+</div>
                <div className="stat-label">Dev Tools</div>
              </div>
            </div>
            <div className="stat-item">
              <TrendingUp className="w-5 h-5" />
              <div>
                <div className="stat-number">6</div>
                <div className="stat-label">Blockchains</div>
              </div>
            </div>
            <div className="stat-item">
              <Users className="w-5 h-5" />
              <div>
                <div className="stat-number">10k+</div>
                <div className="stat-label">Deployments</div>
              </div>
            </div>
            <div className="stat-item">
              <Shield className="w-5 h-5" />
              <div>
                <div className="stat-number">100%</div>
                <div className="stat-label">Secure</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Content Sections */}
      {isAuthenticated && activeTab === 'search' && (
        <div className="devtools-content">
          {/* Wallet Information Section */}
          {user && (
            <Card className="mb-8 border-slate-200 dark:border-slate-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="w-5 h-5" />
                  Connected Wallets
                </CardTitle>
                <CardDescription>
                  Your multi-chain wallet addresses - projects will be scanned from these wallets
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {user.xrpAddress && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                        <span className="text-blue-600 dark:text-blue-400 font-bold">XRP</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-500 dark:text-slate-400">XRP Ledger</p>
                        <p className="text-sm font-mono truncate">{user.xrpAddress}</p>
                      </div>
                    </div>
                  )}
                  {user.ethAddress && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                        <span className="text-purple-600 dark:text-purple-400 font-bold">ETH</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-500 dark:text-slate-400">Ethereum</p>
                        <p className="text-sm font-mono truncate">{user.ethAddress}</p>
                      </div>
                    </div>
                  )}
                  {user.solAddress && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                        <span className="text-green-600 dark:text-green-400 font-bold">SOL</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-500 dark:text-slate-400">Solana</p>
                        <p className="text-sm font-mono truncate">{user.solAddress}</p>
                      </div>
                    </div>
                  )}
                  {user.btcAddress && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                        <span className="text-orange-600 dark:text-orange-400 font-bold">BTC</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-500 dark:text-slate-400">Bitcoin</p>
                        <p className="text-sm font-mono truncate">{user.btcAddress}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Issuer Search Section */}
          <Card className="mb-8 border-slate-200 dark:border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                Search NFT/Token Projects by Issuer
              </CardTitle>
              <CardDescription>
                Enter an issuer address to discover NFT collections and token projects
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Enter issuer address (e.g., rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH)"
                  value={issuerSearch}
                  onChange={(e) => setIssuerSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleIssuerSearch()}
                  className="flex-1"
                />
                <Button 
                  onClick={handleIssuerSearch}
                  disabled={searchByIssuer.isPending || !issuerSearch.trim()}
                >
                  {searchByIssuer.isPending ? 'Searching...' : 'Search'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Search Results */}
          {searchResults.length > 0 ? (
            <div className="tools-section mb-8">
              <div className="section-header">
                <h2 className="section-title flex items-center gap-2">
                  <Search className="w-6 h-6" />
                  Search Results
                </h2>
                <p className="section-subtitle">
                  Found {searchResults.length} project(s)
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {searchResults.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onClaim={() => claimProject.mutate(project)}
                    isClaimingProject={claimProject.isPending}
                  />
                ))}
              </div>
            </div>
          ) : issuerSearch && !searchByIssuer.isPending ? (
            <Card className="mb-8 border-slate-200 dark:border-slate-800">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Search className="w-12 h-12 text-slate-400 mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No Projects Found</h3>
                <p className="text-slate-600 dark:text-slate-400 text-center max-w-md">
                  No projects found for this issuer address. Try searching with a different address or create a new project instead.
                </p>
              </CardContent>
            </Card>
          ) : null}

          {/* Discovered Projects */}
          {onChainData && onChainData.discoveredProjects && onChainData.discoveredProjects.length > 0 ? (
            <div className="tools-section">
              <div className="section-header">
                <div className="flex items-center justify-between w-full">
                  <div>
                    <h2 className="section-title flex items-center gap-2">
                      <FolderOpen className="w-6 h-6" />
                      Discovered Projects
                    </h2>
                    <p className="section-subtitle">
                      {onChainData.stats.projectsDiscovered} project(s) discovered on-chain from {onChainData.searchedWallets.length} wallet(s)
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1">
                      <Layers className="w-4 h-4" />
                      <span>{onChainData.stats.unclaimed} unclaimed</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span>{onChainData.stats.claimed} claimed</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
                {onChainData.discoveredProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onClaim={() => claimProject.mutate(project)}
                    isClaimingProject={claimProject.isPending}
                  />
                ))}
              </div>
            </div>
          ) : !projectsLoading && (onChainData?.discoveredProjects?.length ?? 0) === 0 ? (
            <Card className="mb-8 border-slate-200 dark:border-slate-800">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FolderOpen className="w-12 h-12 text-slate-400 mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No Projects Discovered</h3>
                <p className="text-slate-600 dark:text-slate-400 text-center max-w-md">
                  We couldn't find any NFT or Token projects from your connected wallets. Search by issuer address above or create a new project.
                </p>
              </CardContent>
            </Card>
          ) : null}

          {/* Loading state for projects */}
          {projectsLoading && (
            <div className="tools-section">
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
                  <p className="text-slate-600 dark:text-slate-400">Discovering your NFT collections on-chain...</p>
                </div>
              </div>
            </div>
          )}

          {/* Already Claimed Projects */}
          {userProjects && userProjects.projects && userProjects.projects.length > 0 && (
            <div className="tools-section">
              <div className="section-header">
                <h2 className="section-title flex items-center gap-2">
                  <CheckCircle className="w-6 h-6 text-green-500" />
                  Already Claimed Projects
                </h2>
                <p className="section-subtitle">
                  {userProjects.projects.length} project(s) you've already claimed
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {userProjects.projects.map((project: any) => (
                  <Card key={project.id} className="border-slate-200 dark:border-slate-800 hover:border-green-500/50 dark:hover:border-green-500/50 transition-all duration-200 hover:shadow-lg">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{project.name}</CardTitle>
                          <CardDescription className="text-xs mt-1">
                            <Badge variant="outline" className="text-xs mr-1">
                              {project.chain?.toUpperCase() || 'Multi-chain'}
                            </Badge>
                            {project.projectType && (
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${project.projectType === 'nft' ? 'border-purple-500 text-purple-600' : 'border-blue-500 text-blue-600'}`}
                              >
                                {project.projectType === 'nft' ? 'NFT' : 'Token'}
                              </Badge>
                            )}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 line-clamp-2">
                        {project.description || 'No description provided'}
                      </p>
                      <Button 
                        className="w-full" 
                        onClick={() => setLocation(`/devtools/project/${project.id}`)}
                      >
                        <ArrowRight className="w-4 h-4 mr-2" />
                        Open Dashboard
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CREATE NEW TAB CONTENT */}
      {isAuthenticated && activeTab === 'create' && (
        <div className="devtools-content">
          <div className="tools-section">
            <div className="section-header">
              <h2 className="section-title">Create New Project</h2>
              <p className="section-subtitle">
                Choose the type of project you want to create
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {/* NFT Project */}
              <Card className="border-purple-200 dark:border-purple-800 hover:border-purple-500 dark:hover:border-purple-500 transition-all duration-200 hover:shadow-xl cursor-pointer group">
                <CardHeader>
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900 group-hover:scale-110 transition-transform">
                      <Image className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                    </div>
                    <Badge className="bg-purple-500 text-white">NFT</Badge>
                  </div>
                  <CardTitle className="text-2xl">NFT Project</CardTitle>
                  <CardDescription className="text-base">
                    Create and manage NFT collections with minting, airdrops, and marketplace integration
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 mb-6">
                    <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <CheckCircle className="w-4 h-4 text-purple-500" />
                      NFT Collection Creator
                    </li>
                    <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <CheckCircle className="w-4 h-4 text-purple-500" />
                      NFT Snapshot Tool
                    </li>
                    <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <CheckCircle className="w-4 h-4 text-purple-500" />
                      NFT Airdrop Manager
                    </li>
                    <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <CheckCircle className="w-4 h-4 text-purple-500" />
                      Marketplace Integration
                    </li>
                  </ul>
                  <Button 
                    className="w-full bg-purple-600 hover:bg-purple-700" 
                    onClick={() => setLocation('/devtools/project-wizard?type=nft')}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create NFT Project
                  </Button>
                </CardContent>
              </Card>

              {/* Token Project */}
              <Card className="border-blue-200 dark:border-blue-800 hover:border-blue-500 dark:hover:border-blue-500 transition-all duration-200 hover:shadow-xl cursor-pointer group">
                <CardHeader>
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900 group-hover:scale-110 transition-transform">
                      <Coins className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <Badge className="bg-blue-500 text-white">Token</Badge>
                  </div>
                  <CardTitle className="text-2xl">Token Project</CardTitle>
                  <CardDescription className="text-base">
                    Deploy and manage custom tokens with advanced features and market making
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 mb-6">
                    <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <CheckCircle className="w-4 h-4 text-blue-500" />
                      Token Creator & Deployer
                    </li>
                    <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <CheckCircle className="w-4 h-4 text-blue-500" />
                      Token Snapshot Tool
                    </li>
                    <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <CheckCircle className="w-4 h-4 text-blue-500" />
                      Token Airdrop Manager
                    </li>
                    <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <CheckCircle className="w-4 h-4 text-blue-500" />
                      Automated Market Maker
                    </li>
                  </ul>
                  <Button 
                    className="w-full bg-blue-600 hover:bg-blue-700" 
                    onClick={() => setLocation('/devtools/project-wizard?type=token')}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Token Project
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

// Project Card Component for NFT Collections
interface ProjectCardProps {
  project: DiscoveredProject;
  onClaim: () => void;
  isClaimingProject: boolean;
}

const ProjectCard = ({ project, onClaim, isClaimingProject }: ProjectCardProps) => {
  return (
    <Card className="border-slate-200 dark:border-slate-800 hover:border-blue-500/50 dark:hover:border-blue-500/50 transition-all duration-200 hover:shadow-lg overflow-hidden">
      {/* NFT Image */}
      {project.logoUrl && (
        <div className="w-full h-48 overflow-hidden bg-slate-100 dark:bg-slate-800">
          <img 
            src={project.logoUrl} 
            alt={project.name}
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
          />
        </div>
      )}

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg truncate">{project.name}</CardTitle>
            <CardDescription className="text-xs mt-1 space-x-1">
              <Badge variant="outline" className="text-xs">{project.chain.toUpperCase()}</Badge>
              <Badge variant="outline" className="text-xs">NFT</Badge>
              {project.claimedInDatabase && (
                <Badge className="text-xs bg-green-500">Claimed</Badge>
              )}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
          {project.description}
        </p>

        {/* NFT Count & Taxon */}
        <div className="flex gap-2 text-xs text-slate-500 dark:text-slate-400">
          {project.nftCount !== undefined && (
            <div className="flex items-center gap-1">
              <Image className="w-3 h-3" />
              <span>{project.nftCount} NFTs</span>
            </div>
          )}
          {project.taxon !== undefined && (
            <div className="flex items-center gap-1">
              <Code className="w-3 h-3" />
              <span>Taxon: {project.taxon}</span>
            </div>
          )}
        </div>

        {/* Issuer Address */}
        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">
          Issuer: {project.issuerAddress.slice(0, 8)}...{project.issuerAddress.slice(-6)}
        </div>

        {/* Sample NFTs Preview */}
        {project.sampleNFTs && project.sampleNFTs.length > 0 && (
          <div className="flex gap-1 overflow-hidden">
            {project.sampleNFTs.slice(0, 3).map((nft: any, idx: number) => (
              <div key={idx} className="w-12 h-12 rounded overflow-hidden bg-slate-100 dark:bg-slate-800">
                {(nft.image || nft.thumbnail) && (
                  <img 
                    src={nft.image || nft.thumbnail} 
                    alt={`NFT ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          {!project.claimedInDatabase ? (
            <Button 
              size="sm" 
              className="w-full" 
              onClick={onClaim}
              disabled={isClaimingProject}
            >
              <Plus className="w-3 h-3 mr-1" />
              {isClaimingProject ? 'Claiming...' : 'Claim Project'}
            </Button>
          ) : (
            <>
              <Link 
                href={`/marketplace/collection/${project.issuerAddress}/${project.taxon}`}
                className="flex-1"
              >
                <Button size="sm" className="w-full" variant="outline">
                  <ExternalLink className="w-3 h-3 mr-1" />
                  View Collection
                </Button>
              </Link>
              <Link 
                href={`/devtools/nft/${project.existingProjectId}`}
                className="flex-1"
              >
                <Button size="sm" className="w-full" variant="default">
                  <Star className="w-3 h-3 mr-1" />
                  Manage
                </Button>
              </Link>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default DevToolsDashboard;
