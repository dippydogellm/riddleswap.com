import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLocation } from 'wouter';
import { Search, TrendingUp, Eye, ShoppingCart, Filter, Grid, List, ChevronLeft, ChevronRight, Star, Flame, Zap, BarChart3, Activity, DollarSign, Heart, CheckCircle, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

// Multi-Chain NFT Collection Card Component
const MultiChainCollectionCard = ({ collection, activeTab, chain, onFavoriteToggle }: { 
  collection: any; 
  activeTab: string;
  chain: string;
  onFavoriteToggle?: (collection: any, isFavorited: boolean) => void;
}) => {
  const [, setLocation] = useLocation();
  const [isFavorited, setIsFavorited] = useState(collection.isFavorite || false);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);
  
  const handleCardClick = () => {
    // Navigate to collection detail page (future implementation)
    if (collection.contractAddress) {
      console.log(`Viewing collection: ${collection.name} on ${chain}`);
      // setLocation(`/nft-collection/${chain}/${collection.contractAddress}`);
    }
  };
  
  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsTogglingFavorite(true);
    
    try {
      const sessionToken = localStorage.getItem('sessionToken') || sessionStorage.getItem('sessionToken');
      
      if (!sessionToken) {
        alert('Please login to add favorites');
        return;
      }
      
      // TODO: Implement multi-chain favorites API
      const isFavoritedNow = !isFavorited;
      setIsFavorited(isFavoritedNow);
      onFavoriteToggle?.(collection, isFavoritedNow);
      console.log(`${isFavoritedNow ? '⭐ Added' : '💔 Removed'} ${collection.name} ${isFavoritedNow ? 'to' : 'from'} favorites`);
    } catch (error) {
      console.error('❌ Failed to toggle favorite:', error);
    } finally {
      setIsTogglingFavorite(false);
    }
  };
  
  return (
    <Card 
      className={`group hover:shadow-xl transition-all duration-300 overflow-hidden ${
        collection.contractAddress ? 'cursor-pointer' : 'cursor-default opacity-75'
      }`}
      onClick={handleCardClick}
    >
      <div className="relative">
        <img
          src={collection.image || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiM2MTYxNjEiLz48dGV4dCB4PSIxMDAiIHk9IjEwNSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5ORlQ8L3RleHQ+PC9zdmc+'}
          alt={collection.name}
          className="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiM2MTYxNjEiLz48dGV4dCB4PSIxMDAiIHk9IjEwNSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5ORlQ8L3RleHQ+PC9zdmc+';
          }}
        />
        
        {/* Chain Badge */}
        {collection.chainMetadata && (
          <Badge className="absolute top-2 left-2" style={{ backgroundColor: collection.chainMetadata.color }}>
            <img src={collection.chainMetadata.icon} alt={collection.chainMetadata.name} className="w-4 h-4 mr-1" />
            {collection.chainMetadata.name}
          </Badge>
        )}
        
        {collection.verified && (
          <Badge className="absolute top-12 left-2 bg-blue-600">
            <Star className="h-3 w-3 mr-1" />
            Verified
          </Badge>
        )}
        
        {/* Favorite Heart Button */}
        <Button
          variant="ghost"
          size="sm"
          className={`absolute top-2 right-2 p-2 rounded-full backdrop-blur-sm transition-all ${
            isFavorited 
              ? 'bg-red-500/80 text-white hover:bg-red-600/80' 
              : 'bg-white/80 text-gray-600 hover:bg-white/90'
          }`}
          onClick={handleFavoriteClick}
          disabled={isTogglingFavorite}
        >
          <Heart className={`h-4 w-4 ${isFavorited ? 'fill-current' : ''}`} />
        </Button>
        
        {/* Tab-specific badges */}
        {activeTab === 'volumes' && parseFloat(collection.volume || '0') > 100 && (
          <Badge className="absolute top-12 right-2 bg-green-600">
            <BarChart3 className="h-3 w-3 mr-1" />
            High Volume
          </Badge>
        )}
        {activeTab === 'sales' && collection.sales24h > 10 && (
          <Badge className="absolute top-12 right-2 bg-purple-600">
            🔥 Hot Sales
          </Badge>
        )}
      </div>
      
      <CardContent className="p-6">
        <CardTitle className="text-xl mb-3 truncate">
          {collection.name || `Collection`}
        </CardTitle>
        
        <div className="space-y-3 text-base text-gray-600">
          {/* Tab-specific data display */}
          {activeTab === 'volumes' && (
            <>
              <div className="flex justify-between">
                <span>Volume (24h):</span>
                <span className="font-medium text-green-600">
                  {parseFloat(collection.volume || '0').toFixed(2)} {collection.chainMetadata?.symbol || 'ETH'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Volume (USD):</span>
                <span className="font-medium">
                  ${parseFloat(collection.volume_usd || '0').toLocaleString()}
                </span>
              </div>
            </>
          )}
          
          {activeTab === 'sales' && (
            <>
              <div className="flex justify-between">
                <span>24h Sales:</span>
                <span className="font-medium text-blue-600">{collection.sales24h || collection.sales_count || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Volume:</span>
                <span className="font-medium text-green-600">
                  {parseFloat(collection.volume || '0').toFixed(2)} {collection.chainMetadata?.symbol || 'ETH'}
                </span>
              </div>
            </>
          )}
          
          {activeTab === 'trending' && (
            <>
              <div className="flex justify-between">
                <span>Floor Price:</span>
                <span className="font-medium">
                  {parseFloat(collection.floorPrice || '0').toFixed(4)} {collection.chainMetadata?.symbol || 'ETH'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>24h Sales:</span>
                <span className="font-medium text-blue-600">{collection.sales24h || 0}</span>
              </div>
            </>
          )}
          
          {/* Common data for all tabs */}
          <div className="flex justify-between">
            <span>Items:</span>
            <span className="font-medium">{collection.items?.toLocaleString() || 0}</span>
          </div>
          <div className="flex justify-between">
            <span>Owners:</span>
            <span className="font-medium">{collection.owners?.toLocaleString() || 0}</span>
          </div>
        </div>
        
        <div className="flex gap-2 mt-4">
          <Button size="sm" className="w-full bg-gradient-to-br from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800">
            <Eye className="h-4 w-4 mr-1" />
            View
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default function MultiChainNFTMarketplace() {
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('trending');
  const [selectedChain, setSelectedChain] = useState('eth');
  const [availableChains, setAvailableChains] = useState<any[]>([]);
  
  // Fetch available chains on mount
  useEffect(() => {
    const fetchChains = async () => {
      try {
        const response = await fetch('/api/nftscan/chains');
        const data = await response.json() as any;
        if (data.success) {
          setAvailableChains(data.chains);
        }
      } catch (error) {
        console.error('❌ Error fetching chains:', error);
      }
    };
    fetchChains();
  }, []);
  
  // Fetch collections based on active tab and chain
  const fetchCollections = async () => {
    setLoading(true);
    try {
      let endpoint = '';
      
      switch (activeTab) {
        case 'trending':
          endpoint = `/api/nftscan/${selectedChain}/trending`;
          break;
        case 'sales':
          endpoint = `/api/nftscan/${selectedChain}/top-sales`;
          break;
        case 'volumes':
          endpoint = `/api/nftscan/${selectedChain}/trending`; // Same as trending (sorted by volume)
          break;
        default:
          endpoint = `/api/nftscan/${selectedChain}/trending`;
      }
      
      console.log(`📊 Fetching ${activeTab} collections for ${selectedChain}...`);
      const response = await fetch(endpoint);
      const data = await response.json() as any;
      
      if (data.success) {
        setCollections(data.collections || []);
        console.log(`✅ Loaded ${data.collections?.length || 0} collections`);
      } else {
        console.error('❌ API error:', data.error);
        setCollections([]);
      }
    } catch (error) {
      console.error(`❌ Error fetching collections:`, error);
      setCollections([]);
    } finally {
      setLoading(false);
    }
  };
  
  // Perform search
  const performSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    setSearchLoading(true);
    try {
      const response = await fetch(`/api/nftscan/${selectedChain}/search?q=${encodeURIComponent(query)}&limit=10`);
      const data = await response.json() as any;
      
      if (data.success) {
        setSearchResults(data.collections || []);
        console.log(`🔍 Found ${data.collections?.length || 0} search results`);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('❌ Search error:', error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };
  
  // Fetch collections when tab or chain changes
  useEffect(() => {
    if (selectedChain) {
      fetchCollections();
    }
  }, [activeTab, selectedChain]);
  
  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        performSearch(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [searchQuery, selectedChain]);
  
  const displayCollections = searchQuery && searchResults.length > 0 ? searchResults : collections;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
            <Flame className="w-10 h-10 text-orange-500" />
            Multi-Chain NFT Marketplace
          </h1>
          <p className="text-gray-400">Discover trending NFT collections across multiple blockchains</p>
        </div>
        
        {/* Chain Selector */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <label className="text-white font-medium">Select Chain:</label>
            <Select value={selectedChain} onValueChange={setSelectedChain}>
              <SelectTrigger className="w-[250px] bg-gray-800 border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                {availableChains.map((chain) => (
                  <SelectItem key={chain.id} value={chain.id} className="text-white hover:bg-gray-700">
                    <div className="flex items-center gap-2">
                      <img src={chain.icon} alt={chain.name} className="w-5 h-5" />
                      <span>{chain.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Search collections..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-gray-800 border-gray-700 text-white placeholder-gray-400"
            />
            {searchLoading && (
              <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 animate-spin text-gray-400" />
            )}
          </div>
        </div>
        
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="bg-gray-800 border-gray-700">
            <TabsTrigger value="trending" className="data-[state=active]:bg-orange-600">
              <TrendingUp className="w-4 h-4 mr-2" />
              Trending
            </TabsTrigger>
            <TabsTrigger value="volumes" className="data-[state=active]:bg-orange-600">
              <BarChart3 className="w-4 h-4 mr-2" />
              Top Volume
            </TabsTrigger>
            <TabsTrigger value="sales" className="data-[state=active]:bg-orange-600">
              <ShoppingCart className="w-4 h-4 mr-2" />
              Top Sales
            </TabsTrigger>
          </TabsList>
        </Tabs>
        
        {/* Collections Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="w-full h-64" />
                <CardContent className="p-6">
                  <Skeleton className="w-full h-6 mb-4" />
                  <Skeleton className="w-full h-4 mb-2" />
                  <Skeleton className="w-full h-4 mb-2" />
                  <Skeleton className="w-full h-4" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : displayCollections.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayCollections.map((collection) => (
                <MultiChainCollectionCard
                  key={collection.contractAddress}
                  collection={collection}
                  activeTab={activeTab}
                  chain={selectedChain}
                />
              ))}
            </div>
            {searchQuery && (
              <p className="text-center text-gray-400 mt-4">
                Showing {displayCollections.length} search result{displayCollections.length !== 1 ? 's' : ''} for "{searchQuery}"
              </p>
            )}
          </>
        ) : (
          <Card className="bg-gray-800/50 border-gray-700 p-12">
            <div className="text-center">
              <Search className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">
                {searchQuery ? 'No Results Found' : 'No Collections Available'}
              </h3>
              <p className="text-gray-400">
                {searchQuery 
                  ? `Try adjusting your search query or selecting a different chain` 
                  : `No NFT collections found for ${selectedChain.toUpperCase()} chain`}
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
