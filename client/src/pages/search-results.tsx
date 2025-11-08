import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useLocation, useRoute, Link } from 'wouter';
import { 
  Search, 
  ArrowLeft, 
  Loader2,
  AlertCircle,
  Hash,
  User,
  FolderOpen,
  FileText,
  Coins,
  Image,
  ExternalLink,
  Filter
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { debounce } from 'lodash';

interface SearchResult {
  id: string;
  type: 'profile' | 'project' | 'page' | 'token' | 'nft';
  title: string;
  description: string;
  url: string;
  image?: string;
  metadata?: Record<string, any>;
}

interface SearchResponse {
  query: string;
  results: SearchResult[];
  total: number;
  type: string;
  page: number;
  hasMore: boolean;
}

const typeConfig = {
  profile: {
    icon: User,
    label: 'Profile',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    bgColor: 'hover:bg-blue-50 dark:hover:bg-blue-950'
  },
  project: {
    icon: FolderOpen,
    label: 'Project',
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    bgColor: 'hover:bg-purple-50 dark:hover:bg-purple-950'
  },
  page: {
    icon: FileText,
    label: 'Page',
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    bgColor: 'hover:bg-green-50 dark:hover:bg-green-950'
  },
  token: {
    icon: Coins,
    label: 'Token',
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    bgColor: 'hover:bg-orange-50 dark:hover:bg-orange-950'
  },
  nft: {
    icon: Image,
    label: 'NFT',
    color: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
    bgColor: 'hover:bg-pink-50 dark:hover:bg-pink-950'
  }
};

const SearchResults: React.FC = () => {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute('/search');
  
  // Get URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const initialQuery = urlParams.get('q') || '';
  const initialType = (urlParams.get('type') as keyof typeof typeConfig) || 'all';
  const initialChain = urlParams.get('chain') || 'all';
  
  const [query, setQuery] = useState(initialQuery);
  const [searchType, setSearchType] = useState<'all' | 'profile' | 'project' | 'page' | 'token' | 'nft'>(initialType);
  const [selectedChain, setSelectedChain] = useState<string>(initialChain);
  const [inputValue, setInputValue] = useState(initialQuery);
  
  const observerTarget = useRef<HTMLDivElement>(null);

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce((searchQuery: string) => {
      if (searchQuery.trim()) {
        setQuery(searchQuery);
        // Update URL
        const chainParam = selectedChain !== 'all' ? `&chain=${selectedChain}` : '';
        const newUrl = `/search?q=${encodeURIComponent(searchQuery)}&type=${searchType}${chainParam}`;
        window.history.replaceState({}, '', newUrl);
      }
    }, 300),
    [searchType, selectedChain]
  );

  // Cleanup debounced function on unmount
  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  // Infinite query for search results
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error
  } = useInfiniteQuery<SearchResponse>({
    queryKey: ['/api/search/unified', { q: query, type: searchType, chain: selectedChain }],
    queryFn: async ({ pageParam = 0 }) => {
      if (!query.trim()) return { results: [], total: 0, hasMore: false, page: 0, query: '', type: searchType };
      
      // Use higher limit for "All" tab to show more variety of results
      const limit = searchType === 'all' ? 40 : 20;
      const chainParam = selectedChain !== 'all' ? `&chain=${selectedChain}` : '';
      const response = await fetch(
        `/api/search/unified?q=${encodeURIComponent(query)}&type=${searchType}&offset=${pageParam}&limit=${limit}${chainParam}`
      );
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }
      
      const data = await response.json() as any;
      return data as SearchResponse;
    },
    getNextPageParam: (lastPage: SearchResponse, allPages: SearchResponse[]) => {
      const limit = searchType === 'all' ? 40 : 20;
      return lastPage?.hasMore ? allPages.length * limit : undefined;
    },
    initialPageParam: 0,
    enabled: query.trim().length >= 2,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    refetchOnWindowFocus: false,
  });

  // Intersection observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  // Handle search input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    
    if (value.trim().length >= 2) {
      debouncedSearch(value);
    }
  };

  // Handle filter change
  const handleTypeChange = (newType: typeof searchType) => {
    setSearchType(newType);
    if (query.trim()) {
      const chainParam = selectedChain !== 'all' ? `&chain=${selectedChain}` : '';
      const newUrl = `/search?q=${encodeURIComponent(query)}&type=${newType}${chainParam}`;
      window.history.replaceState({}, '', newUrl);
    }
  };

  // Handle chain change
  const handleChainChange = (newChain: string) => {
    setSelectedChain(newChain);
    if (query.trim()) {
      const chainParam = newChain !== 'all' ? `&chain=${newChain}` : '';
      const newUrl = `/search?q=${encodeURIComponent(query)}&type=${searchType}${chainParam}`;
      window.history.replaceState({}, '', newUrl);
    }
  };

  // Handle result click
  const handleResultClick = (result: SearchResult) => {
    // Track analytics
    if (query && result.id) {
      fetch('/api/search/analytics/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          result_id: result.id,
          result_type: result.type,
          search_session_id: `search_${Date.now()}`
        })
      }).catch(console.warn);
    }
  };

  // Get all results from pages
  const allResults = data?.pages?.flatMap(page => page.results) || [];
  const totalResults = data?.pages?.[0]?.total || 0;

  const filterButtons = [
    { key: 'all' as const, label: 'All', icon: Hash },
    { key: 'token' as const, label: 'Tokens', icon: Coins },
    { key: 'profile' as const, label: 'Profiles', icon: User },
    { key: 'nft' as const, label: 'NFTs', icon: Image },
    { key: 'page' as const, label: 'Pages', icon: FileText }
  ];

  return (
    <div className="min-h-screen bg-background" data-testid="search-results-page">
      {/* Header */}
      <div className="bg-background border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/')}
              className="flex items-center space-x-2"
              data-testid="button-back-home"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </Button>
            
            <div className="flex-1 max-w-2xl">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search tokens, profiles, projects, pages..."
                  className="pl-10 pr-4 h-10 bg-background border border-border"
                  value={inputValue}
                  onChange={handleInputChange}
                  data-testid="input-search-main"
                />
              </div>
            </div>
          </div>

          {/* Filter Buttons */}
          <div className="flex flex-wrap gap-2 mt-4">
            <div className="flex flex-wrap gap-2 flex-1">
              {filterButtons.map(({ key, label, icon: Icon }) => (
                <Button
                  key={key}
                  variant={searchType === key ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "flex items-center space-x-1 h-8 text-xs",
                    searchType === key && "shadow-sm"
                  )}
                  onClick={() => handleTypeChange(key)}
                  data-testid={`button-filter-${key}`}
                >
                  <Icon className="h-3 w-3" />
                  <span>{label}</span>
                </Button>
              ))}
            </div>
            
            {/* Chain Dropdown with Logos */}
            <div className="relative">
              <select
                value={selectedChain}
                onChange={(e) => handleChainChange(e.target.value)}
                className="h-8 pl-8 pr-3 text-xs border rounded-md bg-background hover:bg-accent transition-colors cursor-pointer appearance-none"
                data-testid="chain-selector"
                style={{
                  backgroundImage: selectedChain !== 'all' ? (() => {
                    const chainLogos: Record<string, string> = {
                      xrpl: 'https://dd.dexscreener.com/ds-data/chains/xrpl.png',
                      ethereum: 'https://dd.dexscreener.com/ds-data/chains/ethereum.png',
                      bsc: 'https://dd.dexscreener.com/ds-data/chains/bsc.png',
                      polygon: 'https://dd.dexscreener.com/ds-data/chains/polygon.png',
                      arbitrum: 'https://dd.dexscreener.com/ds-data/chains/arbitrum.png',
                      optimism: 'https://dd.dexscreener.com/ds-data/chains/optimism.png',
                      base: 'https://dd.dexscreener.com/ds-data/chains/base.png',
                      avalanche: 'https://dd.dexscreener.com/ds-data/chains/avalanche.png',
                      fantom: 'https://dd.dexscreener.com/ds-data/chains/fantom.png',
                      cronos: 'https://dd.dexscreener.com/ds-data/chains/cronos.png',
                      gnosis: 'https://dd.dexscreener.com/ds-data/chains/gnosis.png',
                      celo: 'https://dd.dexscreener.com/ds-data/chains/celo.png',
                      moonbeam: 'https://dd.dexscreener.com/ds-data/chains/moonbeam.png',
                      zksync: 'https://dd.dexscreener.com/ds-data/chains/zksync.png',
                      linea: 'https://dd.dexscreener.com/ds-data/chains/linea.png',
                      solana: 'https://dd.dexscreener.com/ds-data/chains/solana.png',
                      bitcoin: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png'
                    };
                    return `url(${chainLogos[selectedChain] || ''})`;
                  })() : 'none',
                  backgroundPosition: '6px center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '16px 16px'
                }}
              >
                <option value="all">All Chains</option>
                <option value="xrpl">XRPL</option>
                <option value="ethereum">Ethereum</option>
                <option value="bsc">BSC</option>
                <option value="polygon">Polygon</option>
                <option value="arbitrum">Arbitrum</option>
                <option value="optimism">Optimism</option>
                <option value="base">Base</option>
                <option value="avalanche">Avalanche</option>
                <option value="fantom">Fantom</option>
                <option value="cronos">Cronos</option>
                <option value="gnosis">Gnosis</option>
                <option value="celo">Celo</option>
                <option value="moonbeam">Moonbeam</option>
                <option value="zksync">zkSync</option>
                <option value="linea">Linea</option>
                <option value="solana">Solana</option>
                <option value="bitcoin">Bitcoin</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Results Content */}
      <div className="container mx-auto px-4 py-6">
        {/* Search Info */}
        {query && (
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Search Results
            </h1>
            <p className="text-muted-foreground">
              {isLoading ? (
                "Searching..."
              ) : (
                `${totalResults} result${totalResults !== 1 ? 's' : ''} for "${query}"`
              )}
            </p>
          </div>
        )}

        {/* Loading State */}
        {isLoading && allResults.length === 0 && (
          <div className="flex items-center justify-center py-12" data-testid="search-loading">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-3 text-muted-foreground">Searching...</span>
          </div>
        )}

        {/* Error State */}
        {isError && (
          <div className="flex flex-col items-center justify-center py-12" data-testid="search-error">
            <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Search Error</h3>
            <p className="text-muted-foreground text-center max-w-md">
              {error instanceof Error ? error.message : 'Search service is temporarily unavailable. Please try again.'}
            </p>
          </div>
        )}

        {/* No Results */}
        {!isLoading && !isError && query && allResults.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12" data-testid="search-no-results">
            <Search className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No results found</h3>
            <p className="text-muted-foreground text-center max-w-md">
              No results found for "{query}". Try different keywords or check spelling.
            </p>
          </div>
        )}

        {/* Results List */}
        {allResults.length > 0 && (
          <div className="space-y-4">
            {allResults.map((result, index) => {
              const config = typeConfig[result.type as keyof typeof typeConfig];
              const Icon = config?.icon || Hash;
              
              return (
                <Card key={`${result.type}-${result.id}-${index}`} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-0">
                    <Link
                      href={result.url}
                      onClick={() => handleResultClick(result)}
                      data-testid={`search-result-${result.type}-${index}`}
                    >
                      <div className={cn(
                        "flex items-start space-x-4 p-6 cursor-pointer transition-colors",
                        config?.bgColor || "hover:bg-muted"
                      )}>
                        {/* Result Image or Icon */}
                        <div className="flex-shrink-0">
                          {result.image ? (
                            <img
                              src={result.image}
                              alt={result.title}
                              className="w-12 h-12 rounded-lg object-cover bg-muted"
                              onError={(e) => {
                                const target = e.currentTarget;
                                target.style.display = 'none';
                                const iconDiv = target.nextElementSibling as HTMLElement;
                                if (iconDiv) {
                                  iconDiv.classList.remove('hidden');
                                }
                              }}
                              loading="lazy"
                              crossOrigin="anonymous"
                            />
                          ) : null}
                          <div className={cn(
                            "w-12 h-12 rounded-lg bg-muted flex items-center justify-center",
                            result.image ? "hidden" : ""
                          )}>
                            <Icon className="h-6 w-6 text-muted-foreground" />
                          </div>
                        </div>

                        {/* Result Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 className="text-lg font-semibold text-foreground truncate">
                              {result.title}
                            </h3>
                            <Badge className={cn("text-xs", config?.color || "bg-gray-100 text-gray-800")}>
                              {config?.label || result.type}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground mb-3 line-clamp-2">
                            {result.description}
                          </p>
                          
                          {/* Metadata */}
                          {result.metadata && (
                            <div className="flex flex-wrap gap-2">
                              {result.type === 'token' && (
                                <>
                                  {result.metadata.chain && (
                                    <Badge variant="outline" className="text-xs">
                                      {result.metadata.chain.toUpperCase()}
                                    </Badge>
                                  )}
                                  {result.metadata.price_usd && result.metadata.price_usd > 0 && (
                                    <Badge variant="outline" className="text-xs">
                                      ${typeof result.metadata.price_usd === 'number' 
                                        ? (result.metadata.price_usd < 0.01 
                                          ? result.metadata.price_usd.toFixed(6) 
                                          : result.metadata.price_usd.toFixed(2)
                                        ) 
                                        : result.metadata.price_usd}
                                    </Badge>
                                  )}
                                  {result.metadata.volume_24h && result.metadata.volume_24h > 0 && (
                                    <Badge variant="outline" className="text-xs text-blue-400">
                                      Vol: ${result.metadata.volume_24h >= 1000000 
                                        ? `${(result.metadata.volume_24h / 1000000).toFixed(2)}M` 
                                        : result.metadata.volume_24h >= 1000 
                                        ? `${(result.metadata.volume_24h / 1000).toFixed(2)}K` 
                                        : result.metadata.volume_24h.toFixed(2)}
                                    </Badge>
                                  )}
                                </>
                              )}
                              {result.type === 'nft' && (
                                <>
                                  {result.metadata.chain && (
                                    <Badge variant="outline" className="text-xs">
                                      {result.metadata.chain.toUpperCase()}
                                    </Badge>
                                  )}
                                  {result.metadata.floor_price && (
                                    <Badge variant="outline" className="text-xs">
                                      Floor: {result.metadata.floor_price}
                                    </Badge>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        {/* External Link Icon */}
                        <div className="flex-shrink-0">
                          <ExternalLink className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </div>
                    </Link>
                  </CardContent>
                </Card>
              );
            })}

            {/* Loading More Indicator */}
            {isFetchingNextPage && (
              <div className="flex items-center justify-center py-8" data-testid="loading-more">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading more results...</span>
              </div>
            )}

            {/* Intersection Observer Target */}
            <div ref={observerTarget} className="h-10" />

            {/* Show All Results Button for "All" tab */}
            {searchType === 'all' && allResults.length >= 20 && hasNextPage && (
              <div className="text-center py-6" data-testid="see-all-results">
                <Button 
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3"
                  data-testid="button-see-all-results"
                >
                  {isFetchingNextPage ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading more results...
                    </>
                  ) : (
                    <>
                      See All Results ({totalResults > allResults.length ? `${totalResults - allResults.length}+ more` : 'more'})
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* End of Results */}
            {!hasNextPage && allResults.length > 0 && (
              <div className="text-center py-8" data-testid="end-of-results">
                <p className="text-muted-foreground">
                  You've reached the end of the results.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Empty Search State */}
        {!query && (
          <div className="flex flex-col items-center justify-center py-12" data-testid="search-empty">
            <Search className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Start your search
            </h2>
            <p className="text-muted-foreground text-center max-w-md">
              Enter a search term above to find tokens, profiles, projects, pages, and NFTs.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchResults;
