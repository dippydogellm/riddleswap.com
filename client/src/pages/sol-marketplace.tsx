import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, Package, TrendingUp, Sparkles, Clock, 
  Shield, Filter, ChevronRight, ExternalLink, 
  DollarSign, Users 
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface NFTCollection {
  address: string;
  name: string;
  symbol?: string;
  image?: string;
  logo?: string;
  banner_image?: string;
  description?: string;
  floor_price?: number;
  floor_price_usd?: number;
  volume_24h?: number;
  verified?: boolean;
  items_total?: number;
  owners_total?: number;
  market_cap?: number;
  sales_24h?: number;
  average_price_24h?: number;
  chain?: string;
}

function CollectionCard({ collection }: { collection: NFTCollection }) {
  const displayImage = collection.image || collection.logo || collection.banner_image;
  
  return (
    <Link href={`/nft-collection/sol/${collection.address}`}>
      <Card className="hover:shadow-lg transition-shadow cursor-pointer bg-white/5 backdrop-blur border-white/10 group">
        <CardContent className="p-4">
          <div className="flex items-start space-x-4">
            {/* Collection Image */}
            <div className="w-20 h-20 rounded-lg overflow-hidden bg-gradient-to-br from-gray-200 to-gray-300 flex-shrink-0">
              {displayImage ? (
                <img 
                  src={displayImage} 
                  alt={collection.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500/20 to-pink-500/20">
                  <Package className="w-8 h-8 text-purple-400" />
                </div>
              )}
            </div>
            
            {/* Collection Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-white truncate">
                  {collection.name || 'Unnamed Collection'}
                </h3>
                {collection.verified && (
                  <Shield className="w-4 h-4 text-purple-400 flex-shrink-0" />
                )}
              </div>
              
              {collection.symbol && (
                <p className="text-sm text-gray-400 mb-2">{collection.symbol}</p>
              )}
              
              {/* Stats */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {collection.floor_price !== undefined && (
                  <div className="flex items-center gap-1">
                    <DollarSign className="w-3 h-3 text-gray-400" />
                    <span className="text-gray-300">
                      {collection.floor_price.toFixed(2)} SOL
                    </span>
                  </div>
                )}
                {collection.items_total && (
                  <div className="flex items-center gap-1">
                    <Package className="w-3 h-3 text-gray-400" />
                    <span className="text-gray-300">
                      {collection.items_total.toLocaleString()} items
                    </span>
                  </div>
                )}
                {collection.volume_24h !== undefined && (
                  <div className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-gray-400" />
                    <span className="text-gray-300">
                      {collection.volume_24h.toFixed(2)} SOL/24h
                    </span>
                  </div>
                )}
                {collection.owners_total && (
                  <div className="flex items-center gap-1">
                    <Users className="w-3 h-3 text-gray-400" />
                    <span className="text-gray-300">
                      {collection.owners_total.toLocaleString()} owners
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors flex-shrink-0" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function SolMarketplace() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'verified' | 'trending' | 'new'>('all');
  
  // Fetch SOL collections
  const { data: collectionsData, isLoading } = useQuery({
    queryKey: ['/api/nftscan/sol/collections'],
    queryFn: async () => {
      const response = await fetch('/api/nftscan/sol/collections');
      if (!response.ok) {
        throw new Error('Failed to fetch collections');
      }
      return response.json();
    },
    staleTime: 60000, // Cache for 1 minute
  });

  const collections: NFTCollection[] = collectionsData?.collections || [];
  
  // Filter collections
  const filteredCollections = collections.filter(collection => {
    const matchesSearch = !searchQuery || 
      collection.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      collection.symbol?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || 
      (selectedCategory === 'verified' && collection.verified) ||
      (selectedCategory === 'trending' && collection.volume_24h && collection.volume_24h > 0) ||
      (selectedCategory === 'new' && collection.items_total && collection.items_total < 1000);
    
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/50 to-pink-900/50">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/30 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">
                Solana NFT Marketplace
              </h1>
              <p className="text-gray-400">
                Explore and trade NFTs on Solana blockchain
              </p>
            </div>
            
            {/* Chain Navigation */}
            <div className="flex items-center gap-2">
              <Link href="/nft-marketplace">
                <Button variant="ghost" className="text-white hover:bg-white/10">
                  XRPL
                </Button>
              </Link>
              <Link href="/eth">
                <Button variant="ghost" className="text-white hover:bg-white/10">
                  ETH
                </Button>
              </Link>
              <Button variant="default" className="bg-purple-600 text-white">
                SOL
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Search and Filters */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  placeholder="Search collections..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-400"
                />
              </div>
            </div>
            
            <Tabs value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as any)}>
              <TabsList className="bg-white/5 border-white/10">
                <TabsTrigger value="all" className="data-[state=active]:bg-white/10">
                  All
                </TabsTrigger>
                <TabsTrigger value="verified" className="data-[state=active]:bg-white/10">
                  <Shield className="w-4 h-4 mr-1" />
                  Verified
                </TabsTrigger>
                <TabsTrigger value="trending" className="data-[state=active]:bg-white/10">
                  <TrendingUp className="w-4 h-4 mr-1" />
                  Trending
                </TabsTrigger>
                <TabsTrigger value="new" className="data-[state=active]:bg-white/10">
                  <Sparkles className="w-4 h-4 mr-1" />
                  New
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-white/5 backdrop-blur border-white/10">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Total Collections</p>
                  <p className="text-2xl font-bold text-white">{collections.length}</p>
                </div>
                <Package className="w-8 h-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white/5 backdrop-blur border-white/10">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">24h Volume</p>
                  <p className="text-2xl font-bold text-white">
                    {collections.reduce((sum, c) => sum + (c.volume_24h || 0), 0).toFixed(2)} SOL
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white/5 backdrop-blur border-white/10">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Verified Collections</p>
                  <p className="text-2xl font-bold text-white">
                    {collections.filter(c => c.verified).length}
                  </p>
                </div>
                <Shield className="w-8 h-8 text-pink-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white/5 backdrop-blur border-white/10">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Active Listings</p>
                  <p className="text-2xl font-bold text-white">
                    {collections.reduce((sum, c) => sum + (c.items_total || 0), 0).toLocaleString()}
                  </p>
                </div>
                <Clock className="w-8 h-8 text-orange-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Collections Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="bg-white/5 backdrop-blur border-white/10">
                <CardContent className="p-4">
                  <div className="flex items-start space-x-4">
                    <Skeleton className="w-20 h-20 rounded-lg" />
                    <div className="flex-1">
                      <Skeleton className="h-5 w-32 mb-2" />
                      <Skeleton className="h-4 w-24 mb-2" />
                      <div className="grid grid-cols-2 gap-2">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredCollections.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredCollections.map((collection, index) => (
              <CollectionCard key={`${collection.address}-${index}`} collection={collection} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No collections found</p>
            <p className="text-gray-500 text-sm mt-2">
              Try adjusting your search or filters
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
