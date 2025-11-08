import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { 
  Search, 
  Filter, 
  User, 
  FolderOpen, 
  FileText, 
  Coins,
  Calendar,
  Tag,
  Hash,
  ExternalLink,
  Loader2,
  ChevronDown,
  ChevronUp,
  X,
  Clock,
  TrendingUp
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface SearchResult {
  id: string;
  type: 'profile' | 'project' | 'page' | 'token' | 'nft';
  title: string;
  description: string;
  url: string;
  image?: string;
  metadata?: Record<string, any>;
  relevance_score?: number;
  created_at?: string;
  updated_at?: string;
}

interface AdvancedSearchFilters {
  query: string;
  searchType: 'all' | 'profile' | 'project' | 'page' | 'token' | 'nft';
  dateRange: 'all' | '24h' | '7d' | '30d' | '90d' | '1y';
  sortBy: 'relevance' | 'date' | 'popularity' | 'alphabetical';
  includeArchived: boolean;
  minRelevanceScore: number;
  specificFilters: {
    // Profile filters
    walletType: 'all' | 'riddle' | 'external';
    hasNFTs: boolean;
    hasTokens: boolean;
    
    // Token filters
    tokenType: 'all' | 'currency' | 'nft' | 'stablecoin';
    hasIssuer: 'all' | 'native' | 'issued';
    priceRange: { min: number; max: number };
    
    // Page filters
    pageType: 'all' | 'swap' | 'nft' | 'bridge' | 'defi' | 'social';
    
    // Project filters
    projectStatus: 'all' | 'active' | 'completed' | 'archived';
    assetType: 'all' | 'token' | 'nft' | 'defi';
  };
}

const typeConfig = {
  profile: {
    icon: User,
    label: 'Profiles',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    description: 'User profiles and wallet addresses'
  },
  project: {
    icon: FolderOpen,
    label: 'Projects',
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    description: 'DeFi projects and collections'
  },
  page: {
    icon: FileText,
    label: 'Pages',
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    description: 'Application pages and content'
  },
  token: {
    icon: Coins,
    label: 'Tokens',
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    description: 'Cryptocurrencies and tokens'
  },
  nft: {
    icon: Hash,
    label: 'NFTs',
    color: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
    description: 'Non-fungible tokens and collections'
  }
};

export default function AdvancedSearch() {
  const [, setLocation] = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [filters, setFilters] = useState<AdvancedSearchFilters>({
    query: '',
    searchType: 'all',
    dateRange: 'all',
    sortBy: 'relevance',
    includeArchived: false,
    minRelevanceScore: 0,
    specificFilters: {
      walletType: 'all',
      hasNFTs: false,
      hasTokens: false,
      tokenType: 'all',
      hasIssuer: 'all',
      priceRange: { min: 0, max: 1000000 },
      pageType: 'all',
      projectStatus: 'all',
      assetType: 'all'
    }
  });

  // Load search history from localStorage
  useEffect(() => {
    const history = localStorage.getItem('advancedSearchHistory');
    if (history) {
      setSearchHistory(JSON.parse(history));
    }
  }, []);

  // Save search to history
  const saveToHistory = (query: string) => {
    if (query.trim() && !searchHistory.includes(query)) {
      const newHistory = [query, ...searchHistory.slice(0, 9)]; // Keep last 10 searches
      setSearchHistory(newHistory);
      localStorage.setItem('advancedSearchHistory', JSON.stringify(newHistory));
    }
  };

  // Advanced search query
  const { data: searchResults, isLoading, error, refetch } = useQuery({
    queryKey: ['advanced-search', filters],
    enabled: filters.query.trim().length >= 2,
    staleTime: 1000 * 60 * 2, // Cache for 2 minutes
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('q', filters.query);
      params.append('type', filters.searchType);
      params.append('sort', filters.sortBy);
      params.append('date_range', filters.dateRange);
      params.append('include_archived', filters.includeArchived.toString());
      params.append('min_relevance', filters.minRelevanceScore.toString());
      
      // Add specific filters based on search type
      if (filters.searchType === 'profile' || filters.searchType === 'all') {
        params.append('wallet_type', filters.specificFilters.walletType);
        params.append('has_nfts', filters.specificFilters.hasNFTs.toString());
        params.append('has_tokens', filters.specificFilters.hasTokens.toString());
      }
      
      if (filters.searchType === 'token' || filters.searchType === 'all') {
        params.append('token_type', filters.specificFilters.tokenType);
        params.append('has_issuer', filters.specificFilters.hasIssuer);
        params.append('price_min', filters.specificFilters.priceRange.min.toString());
        params.append('price_max', filters.specificFilters.priceRange.max.toString());
      }
      
      if (filters.searchType === 'page' || filters.searchType === 'all') {
        params.append('page_type', filters.specificFilters.pageType);
      }
      
      if (filters.searchType === 'project' || filters.searchType === 'all') {
        params.append('project_status', filters.specificFilters.projectStatus);
        params.append('asset_type', filters.specificFilters.assetType);
      }

      const response = await fetch(`/api/search/unified?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Search failed');
      }
      
      return response.json();
    }
  });

  // Handle search execution
  const handleSearch = () => {
    if (filters.query.trim().length >= 2) {
      saveToHistory(filters.query);
      refetch();
    }
  };

  // Handle filter updates
  const updateFilters = (newFilters: Partial<AdvancedSearchFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  // Handle specific filter updates
  const updateSpecificFilters = (newSpecificFilters: Partial<AdvancedSearchFilters['specificFilters']>) => {
    setFilters(prev => ({
      ...prev,
      specificFilters: { ...prev.specificFilters, ...newSpecificFilters }
    }));
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      query: '',
      searchType: 'all',
      dateRange: 'all',
      sortBy: 'relevance',
      includeArchived: false,
      minRelevanceScore: 0,
      specificFilters: {
        walletType: 'all',
        hasNFTs: false,
        hasTokens: false,
        tokenType: 'all',
        hasIssuer: 'all',
        priceRange: { min: 0, max: 1000000 },
        pageType: 'all',
        projectStatus: 'all',
        assetType: 'all'
      }
    });
  };

  const results = searchResults?.results || [];
  const hasResults = results.length > 0;
  const showResults = filters.query.trim().length >= 2;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Advanced Search
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Find exactly what you're looking for with powerful search filters and options
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Search Filters Sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Search Filters
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                
                {/* Search Type */}
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Search Type
                  </label>
                  <Select 
                    value={filters.searchType} 
                    onValueChange={(value) => updateFilters({ searchType: value as any })}
                  >
                    <SelectTrigger data-testid="select-search-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="token">Tokens</SelectItem>
                      <SelectItem value="profile">Profiles</SelectItem>
                      <SelectItem value="project">Projects</SelectItem>
                      <SelectItem value="page">Pages</SelectItem>
                      <SelectItem value="nft">NFTs</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Date Range */}
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Date Range
                  </label>
                  <Select 
                    value={filters.dateRange} 
                    onValueChange={(value) => updateFilters({ dateRange: value as any })}
                  >
                    <SelectTrigger data-testid="select-date-range">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="24h">Last 24 Hours</SelectItem>
                      <SelectItem value="7d">Last 7 Days</SelectItem>
                      <SelectItem value="30d">Last 30 Days</SelectItem>
                      <SelectItem value="90d">Last 90 Days</SelectItem>
                      <SelectItem value="1y">Last Year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Sort By */}
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Sort By
                  </label>
                  <Select 
                    value={filters.sortBy} 
                    onValueChange={(value) => updateFilters({ sortBy: value as any })}
                  >
                    <SelectTrigger data-testid="select-sort-by">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="relevance">Relevance</SelectItem>
                      <SelectItem value="date">Date</SelectItem>
                      <SelectItem value="popularity">Popularity</SelectItem>
                      <SelectItem value="alphabetical">Alphabetical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Advanced Options Toggle */}
                <div>
                  <Button
                    variant="ghost"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-full justify-between p-0 h-auto font-medium"
                    data-testid="button-toggle-advanced"
                  >
                    Advanced Options
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                  
                  {isExpanded && (
                    <div className="mt-4 space-y-4 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
                      
                      {/* Include Archived */}
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="include-archived"
                          checked={filters.includeArchived}
                          onCheckedChange={(checked) => updateFilters({ includeArchived: !!checked })}
                          data-testid="checkbox-include-archived"
                        />
                        <label htmlFor="include-archived" className="text-sm text-gray-700 dark:text-gray-300">
                          Include archived content
                        </label>
                      </div>

                      {/* Minimum Relevance Score */}
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                          Min. Relevance Score: {filters.minRelevanceScore}%
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="10"
                          value={filters.minRelevanceScore}
                          onChange={(e) => updateFilters({ minRelevanceScore: parseInt(e.target.value) })}
                          className="w-full"
                          data-testid="slider-relevance"
                        />
                      </div>

                      {/* Type-specific filters */}
                      {(filters.searchType === 'profile' || filters.searchType === 'all') && (
                        <div className="space-y-3">
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Profile Filters</h4>
                          
                          <Select 
                            value={filters.specificFilters.walletType} 
                            onValueChange={(value) => updateSpecificFilters({ walletType: value as any })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Wallet Type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Wallets</SelectItem>
                              <SelectItem value="riddle">Riddle Wallets</SelectItem>
                              <SelectItem value="external">External Wallets</SelectItem>
                            </SelectContent>
                          </Select>

                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="has-nfts"
                              checked={filters.specificFilters.hasNFTs}
                              onCheckedChange={(checked) => updateSpecificFilters({ hasNFTs: !!checked })}
                            />
                            <label htmlFor="has-nfts" className="text-sm">Has NFTs</label>
                          </div>

                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="has-tokens"
                              checked={filters.specificFilters.hasTokens}
                              onCheckedChange={(checked) => updateSpecificFilters({ hasTokens: !!checked })}
                            />
                            <label htmlFor="has-tokens" className="text-sm">Has Tokens</label>
                          </div>
                        </div>
                      )}

                      {/* Token-specific filters */}
                      {(filters.searchType === 'token' || filters.searchType === 'all') && (
                        <div className="space-y-3">
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Token Filters</h4>
                          
                          <Select 
                            value={filters.specificFilters.tokenType} 
                            onValueChange={(value) => updateSpecificFilters({ tokenType: value as any })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Token Type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Tokens</SelectItem>
                              <SelectItem value="currency">Currency</SelectItem>
                              <SelectItem value="stablecoin">Stablecoin</SelectItem>
                              <SelectItem value="nft">NFT Token</SelectItem>
                            </SelectContent>
                          </Select>

                          <Select 
                            value={filters.specificFilters.hasIssuer} 
                            onValueChange={(value) => updateSpecificFilters({ hasIssuer: value as any })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Issuer Status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All</SelectItem>
                              <SelectItem value="native">Native Only</SelectItem>
                              <SelectItem value="issued">Issued Only</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                    </div>
                  )}
                </div>

                <Separator />

                {/* Clear Filters Button */}
                <Button 
                  variant="outline" 
                  onClick={clearFilters} 
                  className="w-full"
                  data-testid="button-clear-filters"
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear All Filters
                </Button>

              </CardContent>
            </Card>
          </div>

          {/* Main Search Area */}
          <div className="lg:col-span-3">
            
            {/* Search Input */}
            <Card className="mb-6">
              <CardContent className="p-6">
                <div className="flex gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Enter your search query..."
                      value={filters.query}
                      onChange={(e) => updateFilters({ query: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      className="pl-10 h-12 text-base"
                      data-testid="input-advanced-search"
                    />
                  </div>
                  <Button 
                    onClick={handleSearch} 
                    disabled={filters.query.trim().length < 2}
                    className="h-12 px-8"
                    data-testid="button-advanced-search"
                  >
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </Button>
                </div>

                {/* Search History */}
                {searchHistory.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">Recent searches:</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {searchHistory.slice(0, 5).map((historyQuery, index) => (
                        <Button
                          key={index}
                          variant="ghost"
                          size="sm"
                          onClick={() => updateFilters({ query: historyQuery })}
                          className="text-xs h-7"
                          data-testid={`button-history-${index}`}
                        >
                          {historyQuery}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Search Results */}
            {showResults && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Search className="h-5 w-5" />
                      Search Results
                      {!isLoading && (
                        <Badge variant="secondary" className="ml-2">
                          {results.length} results
                        </Badge>
                      )}
                    </CardTitle>
                    {hasResults && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <TrendingUp className="h-4 w-4" />
                        Sorted by {filters.sortBy}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12" data-testid="search-loading">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                      <span className="ml-3 text-gray-600 dark:text-gray-400">Searching...</span>
                    </div>
                  ) : error ? (
                    <div className="text-center py-12" data-testid="search-error">
                      <div className="text-red-500 font-medium">Search Error</div>
                      <div className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                        Unable to complete search. Please try again.
                      </div>
                    </div>
                  ) : hasResults ? (
                    <div className="space-y-4">
                      {results.map((result: SearchResult, index: number) => {
                        const config = typeConfig[result.type as keyof typeof typeConfig] || typeConfig.page;
                        const Icon = config.icon;
                        
                        return (
                          <Link
                            key={`${result.type}-${result.id}-${index}`}
                            href={result.url}
                            data-testid={`advanced-search-result-${index}`}
                          >
                            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all cursor-pointer">
                              <div className="flex items-start gap-4">
                                
                                {/* Result Icon/Image with Chain Indicator */}
                                <div className="flex-shrink-0 relative">
                                  {result.image ? (
                                    <img
                                      src={result.image}
                                      alt={result.title}
                                      className="w-12 h-12 rounded-lg object-cover bg-gray-100 dark:bg-gray-800"
                                      onError={(e) => {
                                        const target = e.currentTarget;
                                        target.style.display = 'none';
                                        target.nextElementSibling?.classList.remove('hidden');
                                      }}
                                    />
                                  ) : null}
                                  <div className={cn(
                                    "w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center",
                                    result.image ? "hidden" : ""
                                  )}>
                                    <Icon className="h-6 w-6 text-gray-500" />
                                  </div>
                                  
                                  {/* Chain indicator for tokens */}
                                  {result.type === 'token' && result.metadata?.chain && (
                                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center">
                                      {result.metadata.chain === 'xrpl' && (
                                        <div className="w-4 h-4 bg-black rounded-full flex items-center justify-center">
                                          <span className="text-white text-xs font-bold">X</span>
                                        </div>
                                      )}
                                      {result.metadata.chain === 'solana' && (
                                        <div className="w-4 h-4 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                                          <span className="text-white text-xs font-bold">S</span>
                                        </div>
                                      )}
                                      {(result.metadata.chain === 'ethereum' || result.metadata.chain === 'eth') && (
                                        <div className="w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center">
                                          <span className="text-white text-xs font-bold">E</span>
                                        </div>
                                      )}
                                      {result.metadata.chain === 'bsc' && (
                                        <div className="w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
                                          <span className="text-white text-xs font-bold">B</span>
                                        </div>
                                      )}
                                      {result.metadata.chain === 'polygon' && (
                                        <div className="w-4 h-4 bg-purple-600 rounded-full flex items-center justify-center">
                                          <span className="text-white text-xs font-bold">P</span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* Result Content */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-2">
                                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                                      {result.title}
                                    </h3>
                                    <Badge className={cn("text-xs", config.color)}>
                                      {config.label.slice(0, -1)} {/* Remove 's' from plural */}
                                    </Badge>
                                    {result.relevance_score && (
                                      <Badge variant="outline" className="text-xs">
                                        {result.relevance_score}% match
                                      </Badge>
                                    )}
                                  </div>
                                  
                                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-2 line-clamp-2">
                                    {result.description}
                                  </p>
                                  
                                  {/* Result Metadata */}
                                  {result.metadata && (
                                    <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                                      {result.type === 'token' && result.metadata.price_usd && (
                                        <span>Price: ${result.metadata.price_usd.toFixed(4)}</span>
                                      )}
                                      {result.metadata.created_at && (
                                        <span className="flex items-center gap-1">
                                          <Calendar className="h-3 w-3" />
                                          {new Date(result.metadata.created_at).toLocaleDateString()}
                                        </span>
                                      )}
                                      {result.metadata.issuer && (
                                        <span>Issuer: {result.metadata.issuer.substring(0, 8)}...</span>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* External Link Icon */}
                                <div className="flex-shrink-0">
                                  <ExternalLink className="h-5 w-5 text-gray-400" />
                                </div>

                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12" data-testid="search-no-results">
                      <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        No results found
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                        Try adjusting your search terms or filters to find what you're looking for.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Search Tips */}
            {!showResults && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Hash className="h-5 w-5" />
                    Search Tips
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  
                  <Tabs defaultValue="profiles" className="w-full">
                    <TabsList className="grid w-full grid-cols-5">
                      <TabsTrigger value="profiles">Profiles</TabsTrigger>
                      <TabsTrigger value="tokens">Tokens</TabsTrigger>
                      <TabsTrigger value="nfts">NFTs</TabsTrigger>
                      <TabsTrigger value="pages">Pages</TabsTrigger>
                      <TabsTrigger value="projects">Projects</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="profiles" className="space-y-2">
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        <p className="mb-2">Search for user profiles and wallet addresses:</p>
                        <ul className="list-disc list-inside space-y-1 ml-4">
                          <li>Username: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">dippydoge</code></li>
                          <li>Handle: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">@dippydoge</code></li>
                          <li>XRPL Address: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">rG...</code></li>
                          <li>Ethereum Address: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">0x...</code></li>
                        </ul>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="tokens" className="space-y-2">
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        <p className="mb-2">Search for tokens and cryptocurrencies:</p>
                        <ul className="list-disc list-inside space-y-1 ml-4">
                          <li>Token Symbol: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">XRP</code>, <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">USD</code></li>
                          <li>Token Name: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">Ripple</code></li>
                          <li>Issuer Address: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq</code></li>
                        </ul>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="nfts" className="space-y-2">
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        <p className="mb-2">Search for NFTs and collections:</p>
                        <ul className="list-disc list-inside space-y-1 ml-4">
                          <li>Collection Name: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">CryptoPunks</code></li>
                          <li>NFT ID: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">000800001E5F...</code></li>
                          <li>Taxon Number: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">taxon:12345</code></li>
                        </ul>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="pages" className="space-y-2">
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        <p className="mb-2">Search for application pages and content:</p>
                        <ul className="list-disc list-inside space-y-1 ml-4">
                          <li>Feature: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">swap</code>, <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">bridge</code></li>
                          <li>Page Title: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">NFT Marketplace</code></li>
                          <li>Content: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">DeFi</code>, <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">trading</code></li>
                        </ul>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="projects" className="space-y-2">
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        <p className="mb-2">Search for projects and collections:</p>
                        <ul className="list-disc list-inside space-y-1 ml-4">
                          <li>Project Name: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">RiddleSwap</code></li>
                          <li>Category: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">DeFi</code>, <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">NFT</code></li>
                          <li>Status: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">active</code>, <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">completed</code></li>
                        </ul>
                      </div>
                    </TabsContent>
                    
                  </Tabs>
                  
                </CardContent>
              </Card>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
