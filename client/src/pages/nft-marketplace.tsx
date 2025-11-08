import { useState, useEffect } from 'react';
import { useMetadata } from '@/hooks/use-metadata';
import { useDynamicMetadata, GAMING_METADATA } from '@/hooks/use-dynamic-metadata';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { useLocation } from 'wouter';
import { Search, TrendingUp, Eye, ShoppingCart, Filter, Grid, List, ChevronLeft, ChevronRight, Star, Flame, Zap, BarChart3, Activity, DollarSign, Heart, CheckCircle, Sun, Moon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';



// NFT Collection Card Component with Material UI design
const CollectionCard = ({ collection, activeTab, onFavoriteToggle, isDark }: { 
  collection: any; 
  activeTab: string;
  onFavoriteToggle?: (collection: any, isFavorited: boolean) => void;
  isDark: boolean;
}) => {
  const [, setLocation] = useLocation();
  const [isFavorited, setIsFavorited] = useState(collection.isFavorite || false);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);
  
  const handleCardClick = () => {
    // Navigate based on chain type
    if (collection.chain && collection.chain !== 'xrpl') {
      // Multi-chain collection (Moralis) - navigate to multi-chain collection page
      if (collection.contractAddress) {
        setLocation(`/nft-collection/${collection.chain}/${collection.contractAddress}`);
      }
    } else {
      // XRPL collection (existing) - navigate to XRPL collection page
      if (collection.issuer && collection.taxon !== undefined) {
        setLocation(`/nft-collection/${collection.issuer}/${collection.taxon}`);
      }
    }
  };
  
  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only allow favorites for XRPL collections (no database changes needed for multi-chain)
    const isXRPL = !collection.chain || collection.chain === 'xrpl';
    if (!isXRPL) {
      console.log('⚠️ Favorites not yet supported for multi-chain collections');
      return;
    }
    
    setIsTogglingFavorite(true);
    
    try {
      const sessionToken = localStorage.getItem('sessionToken') || sessionStorage.getItem('sessionToken');
      
      if (!sessionToken) {
        alert('Please login to add favorites');
        return;
      }
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-session-token': sessionToken
      };
      
      if (isFavorited) {
        // Remove from favorites (XRPL only)
        const url = `/api/user-favorites/${collection.issuer}/${collection.taxon}`;
        
        const response = await fetch(url, {
          method: 'DELETE',
          headers
        });
        
        if (response.ok) {
          setIsFavorited(false);
          onFavoriteToggle?.(collection, false);
          console.log(`💔 Removed ${collection.name} from favorites`);
        }
      } else {
        // Add to favorites (XRPL only)
        const url = `/api/user-favorites/${collection.issuer}/${collection.taxon}`;
        const body = {
          name: collection.name,
          image: collection.image
        };
        
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        });
        
        if (response.ok) {
          setIsFavorited(true);
          onFavoriteToggle?.(collection, true);
          console.log(`⭐ Added ${collection.name} to favorites`);
        }
      }
    } catch (error) {
      console.error('❌ Failed to toggle favorite:', error);
    } finally {
      setIsTogglingFavorite(false);
    }
  };
  
  // Check if collection has valid data for navigation
  const hasValidData = collection.chain && collection.chain !== 'xrpl' 
    ? !!collection.contractAddress 
    : (collection.issuer && collection.taxon !== undefined);
  
  return (
    <Card 
      className={`group overflow-hidden transition-all duration-300 transform hover:scale-[1.02] ${
        hasValidData ? 'cursor-pointer' : 'cursor-default opacity-75'
      } ${
        isDark 
          ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 hover:shadow-2xl hover:shadow-purple-500/20' 
          : 'bg-gradient-to-br from-white to-gray-50 border-gray-200 hover:shadow-2xl hover:shadow-blue-500/20'
      }`}
      onClick={handleCardClick}
    >
      <div className="relative">
        <div className={`absolute inset-0 bg-gradient-to-t ${
          isDark ? 'from-gray-900/90 via-gray-900/20 to-transparent' : 'from-white/90 via-white/20 to-transparent'
        } opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`} />
        <img
          src={collection.image}
          alt={collection.name}
          className="w-full h-64 object-cover group-hover:scale-110 transition-transform duration-500"
          onError={(e) => {
            console.log('❌ Image failed to load:', collection.image);
            e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiM2MTYxNjEiLz48dGV4dCB4PSIxMDAiIHk9IjEwNSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5ORlQ8L3RleHQ+PC9zdmc+';
          }}
        />
        {collection.verified && (
          <Badge className={`absolute top-3 left-3 ${
            isDark ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'
          } shadow-lg backdrop-blur-sm`}>
            <Star className="h-3 w-3 mr-1 fill-current" />
            Verified
          </Badge>
        )}
        {/* Favorite Heart Button with Material Design */}
        <Button
          variant="ghost"
          size="sm"
          className={`absolute top-3 right-3 p-2.5 rounded-full backdrop-blur-md transition-all shadow-lg ${
            isFavorited 
              ? 'bg-red-500/90 text-white hover:bg-red-600 hover:scale-110' 
              : isDark
              ? 'bg-gray-800/90 text-gray-300 hover:bg-gray-700 hover:scale-110'
              : 'bg-white/90 text-gray-600 hover:bg-white hover:scale-110'
          }`}
          onClick={handleFavoriteClick}
          disabled={isTogglingFavorite}
        >
          <Heart className={`h-4 w-4 ${isFavorited ? 'fill-current' : ''}`} />
        </Button>
        
        {/* Tab-specific badges with Material Design */}
        {activeTab === 'volumes' && parseFloat(collection.volume) > 100 && (
          <Badge className="absolute top-14 right-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg backdrop-blur-sm">
            <BarChart3 className="h-3 w-3 mr-1" />
            High Volume
          </Badge>
        )}
        {activeTab === 'sales' && collection.sales_count > 10 && (
          <Badge className="absolute top-14 right-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg backdrop-blur-sm">
            🔥 Hot Sales
          </Badge>
        )}
        {activeTab === 'mints' && collection.isActive && (
          <Badge className="absolute top-14 right-3 bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg backdrop-blur-sm animate-pulse">
            <Activity className="h-3 w-3 mr-1" />
            Live Mint
          </Badge>
        )}
        {activeTab === 'mints' && !collection.isActive && collection.mintStatus === 'completed' && (
          <Badge className="absolute top-14 right-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg backdrop-blur-sm">
            <CheckCircle className="h-3 w-3 mr-1 fill-current" />
            Completed
          </Badge>
        )}
        {/* Offers Badge for all tabs */}
        {collection.activeOffers > 0 && (
          <Badge className="absolute bottom-3 right-3 bg-gradient-to-r from-yellow-400 to-orange-400 text-gray-900 shadow-lg backdrop-blur-sm font-semibold">
            <DollarSign className="h-3 w-3 mr-1" />
            {collection.activeOffers} Offers
          </Badge>
        )}
      </div>
      
      <CardContent className="p-5">
        <CardTitle className={`text-xl mb-4 truncate font-bold ${
          isDark ? 'text-white' : 'text-gray-900'
        }`}>
          {collection.name || `Collection ${collection.taxon}`}
        </CardTitle>
        
        {/* Live Mints Progress Bar with Material Design */}
        {activeTab === 'mints' && collection.progress !== undefined && (
          <div className={`mb-4 p-3 rounded-lg ${
            isDark ? 'bg-gray-800/50' : 'bg-gray-100/50'
          }`}>
            <div className={`flex justify-between text-sm mb-2 ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}>
              <span className="font-medium">Mint Progress</span>
              <span className="font-semibold">{collection.mintedCount || 0} / {collection.totalSupply || 'Unknown'}</span>
            </div>
            <Progress value={collection.progress} className={`h-2.5 ${
              isDark ? 'bg-gray-700' : 'bg-gray-200'
            }`} />
            <div className="flex justify-between text-xs mt-2">
              <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                {collection.progress.toFixed(1)}% minted
              </span>
              <span className={`font-semibold ${
                collection.isActive 
                  ? 'text-green-500' 
                  : isDark ? 'text-blue-400' : 'text-blue-600'
              }`}>
                {collection.timeRemaining}
              </span>
            </div>
          </div>
        )}
        
        <div className={`space-y-2.5 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
          {/* Tab-specific data display with Material Design */}
          {activeTab === 'volumes' && (
            <>
              <div className="flex justify-between items-center">
                <span className="font-medium">Volume:</span>
                <span className={`font-bold text-base ${
                  isDark ? 'text-green-400' : 'text-green-600'
                }`}>
                  {parseFloat(collection.volume || '0').toFixed(2)} XRP
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">Volume (USD):</span>
                <span className={`font-semibold ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                  ${parseFloat(collection.volume_usd || '0').toFixed(2)}
                </span>
              </div>
            </>
          )}
          
          {activeTab === 'sales' && (
            <>
              <div className="flex justify-between items-center">
                <span className="font-medium">24h Sales:</span>
                <span className={`font-bold text-base ${
                  isDark ? 'text-blue-400' : 'text-blue-600'
                }`}>
                  {collection.day_traded || collection.sales24h || collection.sales_count || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">Volume:</span>
                <span className={`font-semibold ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                  {parseFloat(collection.volume || '0').toFixed(2)} XRP
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">Volume (USD):</span>
                <span className={`font-semibold ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                  ${parseFloat(collection.volume_usd || '0').toFixed(2)}
                </span>
              </div>
            </>
          )}
          
          {activeTab === 'mints' && (
            <>
              <div className="flex justify-between items-center">
                <span className="font-medium">24h Sales:</span>
                <span className={`font-bold text-base ${
                  isDark ? 'text-orange-400' : 'text-orange-600'
                }`}>
                  {collection.day_traded || collection.sales24h || collection.sales_count || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">Mint Price:</span>
                <span className={`font-semibold ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                  {collection.mintPrice > 0 ? `${collection.mintPrice} XRP` : 'TBA'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">Status:</span>
                <span className={`font-semibold ${
                  collection.isActive 
                    ? (isDark ? 'text-green-400' : 'text-green-600')
                    : (isDark ? 'text-blue-400' : 'text-blue-600')
                }`}>
                  {collection.isActive ? 'Live Minting' : 'Complete'}
                </span>
              </div>
            </>
          )}
          
          {/* Common data for all tabs with Material Design */}
          <div className="flex justify-between items-center">
            <span className="font-medium">Floor Price:</span>
            <span className={`font-semibold ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
              {collection.floorPrice > 0 ? `${collection.floorPrice} XRP` : 'Not Listed'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-medium">Items:</span>
            <span className={`font-semibold ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
              {collection.totalNFTs || collection.totalSupply || collection.mintedCount || 0}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-medium">Owners:</span>
            <span className={`font-semibold ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
              {collection.owners || 0}
            </span>
          </div>
        </div>
        
        <div className="flex gap-2 mt-5">
          <Button 
            size="sm" 
            className={`w-full font-semibold shadow-lg transition-all hover:scale-105 ${
              activeTab === 'mints' && collection.isActive
                ? isDark 
                  ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white'
                  : 'bg-gradient-to-r from-orange-400 to-red-400 hover:from-orange-500 hover:to-red-500 text-white'
                : isDark
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white'
                : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white'
            }`}
          >
            <Eye className="h-4 w-4 mr-2" />
            {activeTab === 'mints' && collection.isActive ? 'Mint Now' : 'View Collection'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default function NFTMarketplacePage() {
  // Set SEO metadata for NFT marketplace page
  useDynamicMetadata(GAMING_METADATA.marketplace);
  
  const [, setLocation] = useLocation();
  const [collections, setCollections] = useState<any[]>([]);
  const [filteredCollections, setFilteredCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('volumes');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedPeriod, setSelectedPeriod] = useState('24h');
  const [volumeFilter, setVolumeFilter] = useState(0); // Minimum volume filter
  const [favoritesData, setFavoritesData] = useState<any[]>([]);
  const [selectedChain, setSelectedChain] = useState('XRPL'); // Chain selector state
  const [isDark, setIsDark] = useState(false); // Dark mode state
  
  // Dark mode effect
  useEffect(() => {
    const savedTheme = localStorage.getItem('nft-marketplace-theme');
    if (savedTheme === 'dark') {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }
  }, []);
  
  const toggleDarkMode = () => {
    setIsDark(!isDark);
    if (!isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('nft-marketplace-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('nft-marketplace-theme', 'light');
    }
  };
  
  // Infinite scroll state
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCollections, setTotalCollections] = useState(0);
  
  // All supported chains - ONLY XRPL, ETH, SOL
  const supportedChains = [
    { name: 'XRPL', id: 'xrpl', logo: '/images/chains/xrp-logo.png', enabled: true },
    { name: 'Ethereum', id: 'eth', logo: '/images/chains/eth-logo.png', enabled: true },
    { name: 'Solana', id: 'sol', logo: '/images/chains/sol-logo.png', enabled: true }
  ];
  
  // Get chain ID for API calls
  const getChainId = (chainName: string): string => {
    const chain = supportedChains.find(c => c.name === chainName);
    return chain?.id || 'xrpl';
  };
  
  // Handle favorite toggle
  const handleFavoriteToggle = (collection: any, isFavorited: boolean) => {
    // If we're in favorites tab and item was removed, remove it from the list
    if (activeTab === 'favorites' && !isFavorited) {
      setCollections(prev => prev.filter(item => 
        !(item.issuer === collection.issuer && item.taxon === collection.taxon)
      ));
      setFilteredCollections(prev => prev.filter(item => 
        !(item.issuer === collection.issuer && item.taxon === collection.taxon)
      ));
    }
    
    // Update favorite status in other tabs
    setCollections(prev => prev.map(item => 
      (item.issuer === collection.issuer && item.taxon === collection.taxon)
        ? { ...item, isFavorite: isFavorited }
        : item
    ));
    setFilteredCollections(prev => prev.map(item => 
      (item.issuer === collection.issuer && item.taxon === collection.taxon)
        ? { ...item, isFavorite: isFavorited }
        : item
    ));
  };

  // Separate data fetching for each tab using new Bithomp endpoints with infinite scroll
  const fetchMarketplaceData = async (page = 1, append = false) => {
    if (page === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    
    try {
      const chainId = getChainId(selectedChain);
      let endpoint = '';
      
      // XRPL uses existing Bithomp API, other chains use Moralis
      if (chainId === 'xrpl') {
        // Route to appropriate Bithomp endpoint based on active tab and period
        const period = selectedPeriod === '7d' ? 'week' : selectedPeriod === '30d' ? 'month' : '24h';
        
        switch (activeTab) {
          case 'volumes':
            endpoint = `/api/nft-marketplace/volumes/${period}`;
            break;
          case 'sales':
            endpoint = `/api/nft-marketplace/sales/${period}`;
            break;
          case 'mints':
            endpoint = `/api/nft-marketplace/live-mints?period=${selectedPeriod}&page=${page}&limit=20`;
            break;
          case 'favorites':
            endpoint = '/api/user-favorites?chain=xrpl';
            break;
          default:
            endpoint = `/api/nft-marketplace/volumes/${period}`;
        }
      } else {
        // Moralis multi-chain endpoints
        switch (activeTab) {
          case 'volumes':
            endpoint = `/api/nftscan/${chainId}/trending?limit=20`;
            break;
          case 'sales':
            endpoint = `/api/nftscan/${chainId}/top-sales?limit=20`;
            break;
          case 'mints':
            endpoint = `/api/nftscan/${chainId}/trending?limit=20`;
            break;
          case 'favorites':
            // Skip favorites for multi-chain (no database support yet)
            console.log('⚠️ Favorites not supported for multi-chain yet');
            setLoading(false);
            setLoadingMore(false);
            setCollections([]);
            setFilteredCollections([]);
            return;
          default:
            endpoint = `/api/nftscan/${chainId}/trending?limit=20`;
        }
      }
      
      console.log(`🚀 [${activeTab.toUpperCase()}] [${selectedChain}] Fetching: ${endpoint}`);
      
      // Prepare headers for the request
      const headers: Record<string, string> = {
        'Cache-Control': 'no-cache'
      };
      
      // Add session token for favorites (if available)
      if (activeTab === 'favorites') {
        const sessionToken = localStorage.getItem('riddle_session_token') || sessionStorage.getItem('riddle_session_data');
        if (sessionToken) {
          headers['x-session-token'] = sessionToken;
        }
      }
      
      const response = await fetch(endpoint, { headers });
      
      let data = null;
      let paginationInfo = null;
      
      if (response.ok) {
        const result = await response.json() as any;
        
        if (activeTab === 'favorites') {
          // Handle favorites response format
          const rawData = result.favorites || [];
          console.log(`⭐ Loaded ${rawData.length} favorites from user favorites`);
          
          // Transform favorites to collection format
          data = rawData.map((fav: any) => ({
            issuer: fav.issuer,
            taxon: fav.taxon,
            name: fav.name || `Collection ${fav.taxon}`,
            image: fav.image || `/api/nft/image/${fav.issuer}:${fav.taxon}`,
            isFavorite: true
          }));
        } else {
          // Extract collections from marketplace endpoint format
          const rawData = result.collections || [];
          console.log(`📊 Loaded ${rawData.length} collections from ${activeTab} endpoint`);
          
          // Handle pagination info for mints tab
          if (activeTab === 'mints' && result.hasMore !== undefined) {
            paginationInfo = {
              hasMore: result.hasMore,
              total: result.total,
              page: result.page
            };
          }
          
          // Filter out collections with invalid issuer/taxon data
          data = rawData.filter((collection: any) => 
            collection.issuer && 
            collection.issuer !== null && 
            collection.issuer !== 'undefined' &&
            collection.taxon !== undefined &&
            collection.taxon !== null
          );
          console.log(`🧹 Filtered ${rawData.length - data.length} invalid collections (null/undefined issuer)`);
        }
      }
      
      if (data && data.length > 0) {
        if (append && page > 1) {
          // Append to existing collections for infinite scroll
          setCollections(prev => [...prev, ...data]);
          setFilteredCollections(prev => [...prev, ...data]);
        } else {
          // Replace collections for new tab/period
          setCollections(data);
          setFilteredCollections(data);
        }
        
        // Update pagination state
        if (paginationInfo) {
          setHasMore(paginationInfo.hasMore);
          setTotalCollections(paginationInfo.total);
          setCurrentPage(paginationInfo.page);
        } else {
          setHasMore(false);
          setTotalCollections(data.length);
        }
        
        console.log(`✅ Loaded ${data.length} collections for ${activeTab} tab (Page ${page})`);
      } else {
        // Show empty state but don't crash
        if (!append) {
          setCollections([]);
          setFilteredCollections([]);
        }
        setHasMore(false);
        console.log(`⚠️ No data available for ${activeTab} tab`);
      }
      
    } catch (error) {
      console.error(`${activeTab} data fetch failed:`, error);
      // Show empty state but don't crash
      if (!append) {
        setCollections([]);
        setFilteredCollections([]);
      }
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Load more function for infinite scroll
  const loadMoreCollections = () => {
    if (!loadingMore && hasMore && activeTab === 'mints') {
      fetchMarketplaceData(currentPage + 1, true);
    }
  };

  useEffect(() => {
    // Reset pagination when tab, period, or chain changes
    setCurrentPage(1);
    setHasMore(true);
    fetchMarketplaceData(1, false);
  }, [activeTab, selectedPeriod, selectedChain]); // Re-fetch when tab, period, or chain changes

  // Infinite scroll effect
  useEffect(() => {
    const handleScroll = () => {
      if (activeTab !== 'mints' || !hasMore || loadingMore) return;
      
      const scrollTop = document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = document.documentElement.clientHeight;
      
      if (scrollTop + clientHeight >= scrollHeight - 1000) { // Load when 1000px from bottom
        loadMoreCollections();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeTab, hasMore, loadingMore, currentPage]);

  // Search API function
  const performSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    setSearchLoading(true);
    try {
      const response = await fetch(`/api/nft-marketplace/search?query=${encodeURIComponent(query)}&limit=10`);
      const data = await response.json() as any;
      
      if (data.success) {
        setSearchResults(data.collections || []);
        console.log(`🔍 [SEARCH] Found ${data.collections?.length || 0} results for "${query}"`);
      } else {
        setSearchResults([]);
        console.error('Search failed:', data.error);
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  // Debounced search effect
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    
    const timeoutId = setTimeout(() => {
      performSearch(searchQuery);
    }, 500); // Debounce for 500ms
    
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Search and tab filtering (simplified - trust Bithomp API data)
  useEffect(() => {
    let filtered = [...collections];
    
    // Basic filtering - only remove truly null/undefined items
    filtered = filtered.filter(item => 
      item && 
      item.issuer && 
      item.taxon !== undefined
    );
    
    console.log(`🔍 Search: "${searchQuery}", Tab: ${activeTab}, Results: ${filtered.length}/${collections.length}`);
    
    // Apply search filter (only on current collections, not search results)
    if (searchQuery.trim() && searchResults.length === 0) {
      filtered = filtered.filter(item => 
        item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.collection?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.issuer?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.family?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Apply tab-specific filtering and sorting
    switch (activeTab) {
      case 'volumes':
        // Apply volume filter first
        if (volumeFilter > 0) {
          filtered = filtered.filter(item => (parseFloat(item.volume) || 0) >= volumeFilter);
        }
        // Sort by highest volume (already sorted from endpoint)
        filtered = filtered.sort((a, b) => (parseFloat(b.volume) || 0) - (parseFloat(a.volume) || 0));
        break;
      case 'sales':
        // Sort by HIGHEST NUMBER OF SALES at the top
        filtered = filtered.sort((a, b) => {
          const bSalesCount = b.sales_count || b.sales24h || 0;
          const aSalesCount = a.sales_count || a.sales24h || 0;
          return bSalesCount - aSalesCount;
        });
        break;
      case 'mints':
        // Sort by HIGHEST SELLING MINT at the top (highest price/volume first)
        filtered = filtered.sort((a, b) => {
          // First, prioritize active mints
          if (a.isActive && !b.isActive) return -1;
          if (!a.isActive && b.isActive) return 1;
          
          // Then sort by highest selling price/volume
          const bPrice = parseFloat(b.floorPrice || b.mintPrice || b.volume || '0');
          const aPrice = parseFloat(a.floorPrice || a.mintPrice || a.volume || '0');
          return bPrice - aPrice;
        });
        break;
      default:
        // No additional sorting
        break;
    }
    
    console.log(`🔍 Search: "${searchQuery}", Tab: ${activeTab}, Results: ${filtered.length}/${collections.length}`);
    setFilteredCollections(filtered);
  }, [activeTab, collections, searchQuery, volumeFilter]);

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      isDark 
        ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' 
        : 'bg-gradient-to-br from-blue-50 via-white to-purple-50'
    }`}>
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8">
        
        {/* Page Header with Dark Mode Toggle */}
        <div className="text-center mb-6 relative">
          {/* Dark Mode Toggle - Top Right */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleDarkMode}
            className={`absolute right-0 top-0 rounded-full p-3 transition-all hover:scale-110 ${
              isDark 
                ? 'bg-gray-800 text-yellow-400 hover:bg-gray-700' 
                : 'bg-white text-gray-700 hover:bg-gray-100 shadow-md'
            }`}
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
          
          <h1 className={`text-2xl sm:text-3xl lg:text-5xl font-bold mb-2 sm:mb-4 bg-clip-text text-transparent bg-gradient-to-r ${
            isDark 
              ? 'from-blue-400 via-purple-400 to-pink-400' 
              : 'from-blue-600 via-purple-600 to-pink-600'
          }`}>
            NFT Marketplace
          </h1>
          <p className={`text-sm sm:text-base lg:text-lg max-w-2xl mx-auto mb-4 ${
            isDark ? 'text-gray-300' : 'text-gray-600'
          }`}>
            Discover, trade, and collect unique NFTs across multiple blockchains
          </p>
          
          {/* Quick Chain Navigation with Material Design */}
          <div className="flex justify-center gap-3 mb-6">
            <Button
              variant="default"
              className={`shadow-lg transition-all hover:scale-105 ${
                isDark
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white'
                  : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white'
              }`}
            >
              XRPL
            </Button>
            <Button
              variant="outline"
              onClick={() => setLocation('/eth')}
              className={`shadow-md transition-all hover:scale-105 ${
                isDark 
                  ? 'border-gray-600 hover:bg-gray-800 text-gray-300' 
                  : 'border-gray-300 hover:bg-gray-100 text-gray-700'
              }`}
            >
              Ethereum
            </Button>
            <Button
              variant="outline"
              onClick={() => setLocation('/sol')}
              className={`shadow-md transition-all hover:scale-105 ${
                isDark 
                  ? 'border-gray-600 hover:bg-gray-800 text-gray-300' 
                  : 'border-gray-300 hover:bg-gray-100 text-gray-700'
              }`}
            >
              Solana
            </Button>
          </div>
          
          {/* Chain Selector with Material Design - Horizontal Scroll on Mobile */}
          <div className="overflow-x-auto pb-2 -mx-2 px-2">
            <div className="flex gap-3 justify-start sm:justify-center min-w-max sm:min-w-0">
              {supportedChains.map((chain) => (
                <div key={chain.name} className="relative flex-shrink-0">
                  <Button
                    variant={selectedChain === chain.name ? "default" : "outline"}
                    disabled={!chain.enabled}
                    onClick={() => chain.enabled && setSelectedChain(chain.name)}
                    size="sm"
                    className={`flex items-center gap-2 h-10 px-4 shadow-md transition-all hover:scale-105 ${
                      selectedChain === chain.name
                        ? isDark
                          ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white border-none'
                          : 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white border-none'
                        : chain.enabled
                        ? isDark
                          ? 'bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-200'
                          : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-700'
                        : isDark
                        ? 'bg-gray-900 border-gray-800 opacity-50 cursor-not-allowed text-gray-600'
                        : 'bg-gray-100 border-gray-200 opacity-50 cursor-not-allowed text-gray-400'
                    }`}
                  >
                    <img 
                      src={chain.logo} 
                      alt={chain.name}
                      className="w-5 h-5 rounded-full"
                      onError={(e) => {
                        e.currentTarget.src = '/images/chains/xrp-logo.png';
                      }}
                    />
                    <span className="text-xs sm:text-sm font-semibold whitespace-nowrap">{chain.name}</span>
                  </Button>
                  {!chain.enabled && (
                    <Badge className="absolute -top-1 -right-1 bg-gradient-to-r from-orange-500 to-red-500 text-white text-[10px] px-1.5 py-0.5 shadow-lg">
                      Soon
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          {/* Chain Notice with Material Design */}
          {selectedChain !== 'XRPL' && (
            <div className={`mt-4 p-3 rounded-xl text-xs sm:text-sm shadow-lg ${
              isDark
                ? 'bg-gradient-to-r from-blue-900/40 to-purple-900/40 border border-blue-700/50'
                : 'bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200'
            }`}>
              <p className={`font-medium ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                🔥 Now showing {selectedChain} NFT collections powered by Moralis!
              </p>
            </div>
          )}
        </div>


        {/* Search and Filters with Material Design */}
        <div className="space-y-4 mb-8">
          {/* Search Bar with Material Design */}
          <div className="w-full">
            <Button
              variant="outline"
              className={`w-full justify-start h-12 sm:h-14 px-4 sm:px-5 text-left shadow-lg transition-all hover:scale-[1.01] ${
                isDark 
                  ? 'bg-gradient-to-r from-gray-800 to-gray-900 border-gray-700 hover:border-purple-500' 
                  : 'bg-white border-gray-200 hover:border-blue-500'
              }`}
              onClick={() => setSearchOpen(true)}
            >
              <Search className={`h-5 w-5 mr-3 flex-shrink-0 ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`} />
              <span className={`text-sm sm:text-base truncate ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}>
                {searchQuery || "Search collections, creators, or NFTs..."}
              </span>
            </Button>
          </div>
          
          {/* Filters Row with Material Design */}
          <div className="flex gap-3 items-center overflow-x-auto pb-2">
            {/* Period selector with Material Design */}
            {(activeTab === 'volumes' || activeTab === 'sales' || activeTab === 'mints') && (
              <div className={`flex gap-1 rounded-xl p-1.5 flex-shrink-0 shadow-md ${
                isDark ? 'bg-gray-800/80' : 'bg-gray-100/80'
              }`}>
                {['24h', '7d', '30d'].map((period) => (
                  <Button
                    key={period}
                    variant={selectedPeriod === period ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setSelectedPeriod(period)}
                    className={`h-9 px-4 text-xs font-semibold transition-all ${
                      selectedPeriod === period
                        ? isDark
                          ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700'
                          : 'bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600'
                        : isDark
                        ? 'hover:bg-gray-700 text-gray-300'
                        : 'hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    {period}
                  </Button>
                ))}
              </div>
            )}
            
            {/* Volume filter with Material Design */}
            {activeTab === 'volumes' && (
              <div className={`flex gap-1 rounded-xl p-1.5 flex-shrink-0 overflow-x-auto shadow-md ${
                isDark ? 'bg-gray-800/80' : 'bg-gray-100/80'
              }`}>
                {[
                  { label: 'All', min: 0 },
                  { label: '10+', min: 10 },
                  { label: '100+', min: 100 },
                  { label: '1K+', min: 1000 }
                ].map((filter) => (
                  <Button
                    key={filter.label}
                    variant={volumeFilter === filter.min ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setVolumeFilter(filter.min)}
                    className={`h-9 px-3 text-xs font-semibold whitespace-nowrap transition-all ${
                      volumeFilter === filter.min
                        ? isDark
                          ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700'
                          : 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600'
                        : isDark
                        ? 'hover:bg-gray-700 text-gray-300'
                        : 'hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>
            )}
            
            {/* View Mode Toggle with Material Design */}
            <div className={`flex gap-1 ml-auto flex-shrink-0 rounded-xl p-1.5 shadow-md ${
              isDark ? 'bg-gray-800/80' : 'bg-gray-100/80'
            }`}>
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="icon"
                onClick={() => setViewMode('grid')}
                className={`h-9 w-9 transition-all ${
                  viewMode === 'grid'
                    ? isDark
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700'
                      : 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600'
                    : isDark
                    ? 'hover:bg-gray-700 text-gray-400'
                    : 'hover:bg-gray-200 text-gray-600'
                }`}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('list')}
                className={`h-9 w-9 transition-all ${
                  viewMode === 'list'
                    ? isDark
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700'
                      : 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600'
                    : isDark
                    ? 'hover:bg-gray-700 text-gray-400'
                    : 'hover:bg-gray-200 text-gray-600'
                }`}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs with Material Design - 4 marketplace sections including favorites */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
          <TabsList className={`grid w-full grid-cols-4 h-auto p-1.5 shadow-lg ${
            isDark ? 'bg-gray-800/80' : 'bg-gray-100/80'
          }`}>
            <TabsTrigger 
              value="volumes" 
              className={`text-xs sm:text-sm py-3 font-semibold transition-all ${
                activeTab === 'volumes'
                  ? isDark
                    ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white'
                    : 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
                  : isDark
                  ? 'text-gray-400 hover:text-gray-200'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className="hidden sm:inline">📊 Volume</span>
              <span className="sm:hidden">📊</span>
            </TabsTrigger>
            <TabsTrigger 
              value="sales" 
              className={`text-xs sm:text-sm py-3 font-semibold transition-all ${
                activeTab === 'sales'
                  ? isDark
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white'
                    : 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
                  : isDark
                  ? 'text-gray-400 hover:text-gray-200'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className="hidden sm:inline">💰 Sales</span>
              <span className="sm:hidden">💰</span>
            </TabsTrigger>
            <TabsTrigger 
              value="mints" 
              className={`text-xs sm:text-sm py-3 font-semibold transition-all ${
                activeTab === 'mints'
                  ? isDark
                    ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white'
                    : 'bg-gradient-to-r from-orange-500 to-red-500 text-white'
                  : isDark
                  ? 'text-gray-400 hover:text-gray-200'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className="hidden sm:inline">🚀 Mints</span>
              <span className="sm:hidden">🚀</span>
            </TabsTrigger>
            <TabsTrigger 
              value="favorites" 
              className={`text-xs sm:text-sm py-3 font-semibold transition-all ${
                activeTab === 'favorites'
                  ? isDark
                    ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white'
                    : 'bg-gradient-to-r from-pink-500 to-rose-500 text-white'
                  : isDark
                  ? 'text-gray-400 hover:text-gray-200'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className="hidden sm:inline">⭐ Faves</span>
              <span className="sm:hidden">⭐</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-8">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[...Array(12)].map((_, i) => (
                  <Card 
                    key={i} 
                    className={`animate-pulse overflow-hidden ${
                      isDark 
                        ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700' 
                        : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'
                    }`}
                  >
                    <Skeleton className={`h-64 w-full ${
                      isDark ? 'bg-gray-700' : 'bg-gray-300'
                    }`} />
                    <CardContent className="p-5">
                      <Skeleton className={`h-6 w-3/4 mb-4 ${
                        isDark ? 'bg-gray-700' : 'bg-gray-300'
                      }`} />
                      <div className="space-y-3">
                        <Skeleton className={`h-4 w-full ${
                          isDark ? 'bg-gray-700' : 'bg-gray-300'
                        }`} />
                        <Skeleton className={`h-4 w-full ${
                          isDark ? 'bg-gray-700' : 'bg-gray-300'
                        }`} />
                        <Skeleton className={`h-4 w-2/3 ${
                          isDark ? 'bg-gray-700' : 'bg-gray-300'
                        }`} />
                      </div>
                      <Skeleton className={`h-10 w-full mt-5 ${
                        isDark ? 'bg-gray-700' : 'bg-gray-300'
                      }`} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredCollections.length > 0 ? (
              <div className={
                viewMode === 'grid' 
                  ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                  : "space-y-6"
              }>
                {filteredCollections.map((collection, index) => (
                  <CollectionCard 
                    key={collection.id || `${collection.issuer || `invalid-${index}`}-${collection.taxon || 0}-${index}`} 
                    collection={collection}
                    activeTab={activeTab}
                    onFavoriteToggle={handleFavoriteToggle}
                    isDark={isDark}
                  />
                ))}
              </div>
            ) : (
              <div className={`text-center py-20 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                <div className="text-7xl mb-6">🎨</div>
                <h3 className={`text-2xl font-bold mb-3 ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}>
                  No Collections Found
                </h3>
                <p className={`mb-8 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {searchQuery ? 'Try adjusting your search terms' : 'Collections are loading or temporarily unavailable'}
                </p>
                <Button 
                  onClick={() => fetchMarketplaceData(1, false)}
                  className={`shadow-lg transition-all hover:scale-105 ${
                    isDark
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white'
                      : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white'
                  }`}
                >
                  Refresh Collections
                </Button>
              </div>
            )}

            {/* Infinite Scroll Loading Indicator with Material Design */}
            {loadingMore && activeTab === 'mints' && (
              <div className="flex justify-center py-12">
                <div className="flex items-center space-x-4">
                  <div className={`animate-spin rounded-full h-8 w-8 border-b-3 ${
                    isDark ? 'border-purple-500' : 'border-blue-600'
                  }`}></div>
                  <span className={`font-medium ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Loading more collections...
                  </span>
                </div>
              </div>
            )}

            {/* Load More Button with Material Design */}
            {!loadingMore && hasMore && activeTab === 'mints' && filteredCollections.length > 0 && (
              <div className="flex justify-center py-12">
                <Button 
                  variant="outline" 
                  onClick={loadMoreCollections}
                  className={`px-10 py-4 text-base font-semibold shadow-lg transition-all hover:scale-105 ${
                    isDark
                      ? 'bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-200'
                      : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  Load More Collections
                </Button>
              </div>
            )}

            {/* End of results indicator with Material Design */}
            {!hasMore && activeTab === 'mints' && filteredCollections.length > 0 && (
              <div className="flex justify-center py-12">
                <p className={`text-sm font-medium ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  You've reached the end of {activeTab === 'mints' ? 'minting' : ''} collections
                  {totalCollections > 0 && ` (${totalCollections} total)`}
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Search Popup Dialog */}
      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandInput
          placeholder="Search collections, creators, or NFTs..."
          value={searchQuery}
          onValueChange={setSearchQuery}
        />
        <CommandList>
          <CommandEmpty>
            {searchLoading ? 'Searching...' : 'No results found.'}
          </CommandEmpty>
          <CommandGroup heading="Search Results">
            {(searchResults.length > 0 ? searchResults : collections.slice(0, 8))
              .map((collection) => (
                <CommandItem
                  key={`${collection.issuer}:${collection.taxon}`}
                  onSelect={() => {
                    setSearchQuery(collection.name || collection.collection || 'Unknown');
                    setSearchOpen(false);
                    // Navigate to collection
                    window.location.href = `/nft-collection/${collection.issuer}/${collection.taxon}`;
                  }}
                  className="flex items-center gap-3 p-3"
                >
                  <img
                    src={collection.cdnImage || collection.image}
                    alt={collection.name || 'Collection'}
                    className="w-8 h-8 rounded object-cover"
                    onError={(e) => {
                      e.currentTarget.src = '/images/placeholder-nft.png';
                    }}
                  />
                  <div className="flex-1">
                    <div className="font-medium">{collection.name || collection.collection || 'Unknown Collection'}</div>
                    <div className="text-sm text-gray-500">
                      {collection.totalNFTs || 0} items • Floor: {collection.floorPrice > 0 ? `${collection.floorPrice} XRP` : 'Not listed'}
                    </div>
                  </div>
                  <Badge variant="secondary">{collection.owners || 0} owners</Badge>
                </CommandItem>
              ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}
