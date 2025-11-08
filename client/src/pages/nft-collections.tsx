import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useLocation } from 'wouter';
import { Search, Grid, List, TrendingUp, Users, ImageIcon, Eye, DollarSign, Sparkles, Clock, BarChart } from 'lucide-react';

interface Collection {
  id: string;
  name: string;
  issuer: string;
  taxon: number;
  description?: string;
  image?: string;
  floorPrice: number;
  totalSupply: number;
  owners: number;
  volume24h: number;
  salesCount: number;
  verified: boolean;
}

export default function NFTCollections() {
  const [, setLocation] = useLocation();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('trending'); // Default to trending (highest volume)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterVerified, setFilterVerified] = useState(false);
  const [minVolume, setMinVolume] = useState(0);

  useEffect(() => {
    fetchCollections();
  }, [sortBy]);

  const fetchCollections = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/nft/collections?sort=${sortBy}&limit=50&t=${Date.now()}`, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      
      if (response.ok) {
        const data = await response.json() as any;
        setCollections(data.collections || []);
      }
    } catch (error) {
      console.error('Failed to fetch collections:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCollections = collections.filter(collection => {
    const matchesSearch = collection.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      collection.issuer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesVerified = !filterVerified || collection.verified;
    const matchesVolume = collection.volume24h >= minVolume;
    return matchesSearch && matchesVerified && matchesVolume;
  });

  const formatXRP = (amount: number) => {
    if (!amount || amount === 0) return '0 XRP';
    return `${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} XRP`;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <div className="container mx-auto px-4 py-8 bg-white dark:bg-gray-900 min-h-screen text-gray-900 dark:text-white">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">
          NFT Marketplace
        </h1>
        <p className="text-muted-foreground dark:text-gray-400">
          Explore trending NFT collections on XRPL sorted by 24h trading volume
        </p>
      </div>

      {/* Trending Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <TrendingUp className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-sm text-muted-foreground">Total Collections</p>
              <p className="text-xl font-bold">{collections.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <DollarSign className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-sm text-muted-foreground">Total Volume (24h)</p>
              <p className="text-xl font-bold">
                {formatXRP(collections.reduce((sum, c) => sum + c.volume24h, 0))}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <BarChart className="h-8 w-8 text-purple-500" />
            <div>
              <p className="text-sm text-muted-foreground">Verified Collections</p>
              <p className="text-xl font-bold">{collections.filter(c => c.verified).length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search collections..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="trending">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Trending (24h Volume)
              </div>
            </SelectItem>
            <SelectItem value="sales">
              <div className="flex items-center gap-2">
                <BarChart className="h-4 w-4" />
                Most Sales
              </div>
            </SelectItem>
            <SelectItem value="floor">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Highest Floor
              </div>
            </SelectItem>
            <SelectItem value="owners">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Most Owners
              </div>
            </SelectItem>
            <SelectItem value="recent">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Recently Listed
              </div>
            </SelectItem>
            <SelectItem value="supply">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Largest Supply
              </div>
            </SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant={filterVerified ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterVerified(!filterVerified)}
        >
          <Badge className="mr-2" variant="secondary">✓</Badge>
          Verified Only
        </Button>

        <div className="flex gap-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Collections Grid/List */}
      {loading ? (
        <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
          {Array.from({ length: 9 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <Skeleton className="h-8" />
                  <Skeleton className="h-8" />
                  <Skeleton className="h-8" />
                  <Skeleton className="h-8" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
          {filteredCollections.map((collection) => (
            <Card 
              key={`${collection.issuer}-${collection.taxon}`}
              className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => setLocation(`/nft-collection/${collection.issuer}/${collection.taxon}`)}
            >
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center overflow-hidden relative">
                    {collection.image ? (
                      <img 
                        src={collection.image?.includes('bithomp.com') ? collection.image : `https://bithomp.com/api/v2/nft/${collection.issuer}/${collection.taxon}/image`} 
                        alt={collection.name}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          // Fallback to Bithomp CDN
                          e.currentTarget.src = `https://bithomp.com/api/v2/nft/${collection.issuer}/${collection.taxon}/image?fallback=true`;
                        }}
                      />
                    ) : null}
                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    {/* Show trending badge for top collections */}
                    {filteredCollections.indexOf(collection) < 3 && sortBy === 'trending' && (
                      <div className="absolute -top-1 -right-1 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full p-1">
                        <TrendingUp className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">{collection.name}</h3>
                      {collection.verified && (
                        <Badge variant="secondary" className="text-xs">✓</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {collection.issuer.slice(0, 6)}...{collection.issuer.slice(-4)}
                    </p>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Floor Price</p>
                    <p className="font-semibold">{formatXRP(collection.floorPrice)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Volume (24h)</p>
                    <p className="font-semibold">{formatXRP(collection.volume24h)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Supply</p>
                    <p className="font-semibold">{formatNumber(collection.totalSupply)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Owners</p>
                    <p className="font-semibold">{formatNumber(collection.owners)}</p>
                  </div>
                </div>

                {collection.description && (
                  <div className="mt-4">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {collection.description}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="flex items-center gap-2 text-sm">
                    {collection.volume24h > 0 && (
                      <Badge variant={collection.volume24h > 10000 ? "default" : "secondary"} className="text-xs">
                        <TrendingUp className="h-3 w-3 mr-1" />
                        {collection.salesCount} sales
                      </Badge>
                    )}
                  </div>
                  <Button variant="outline" size="sm">
                    <Eye className="h-4 w-4 mr-2" />
                    View Collection
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && filteredCollections.length === 0 && (
        <div className="text-center py-12">
          <ImageIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No collections found</h3>
          <p className="text-muted-foreground">
            {searchQuery ? 'Try adjusting your search criteria' : 'Collections will appear here once they are available'}
          </p>
        </div>
      )}
    </div>
  );
}
