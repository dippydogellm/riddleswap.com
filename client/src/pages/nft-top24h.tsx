import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, Flame, Users, Coins, ExternalLink, RefreshCw, Clock, BarChart3, ShoppingCart, Activity } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CollectionStats {
  volume: string;
  sales: number;
  mints: number;
}

interface TopCollection {
  id: string;
  name: string;
  image: string | null;
  floorPrice: string;
  changePercent?: number;
  totalSupply?: number;
  uniqueHolders?: number;
  stats24h: CollectionStats;
  stats7d: CollectionStats;
  stats30d: CollectionStats;
}

interface Bithomp24hData {
  sales: Array<{
    nftokenId: string;
    price: string;
    currency: string;
    sellerAddress: string;
    buyerAddress: string;
    timestamp: number;
    collection?: {
      name: string;
      image?: string;
    };
  }>;
}

export default function NFTTop24h() {
  const { toast } = useToast();
  const [topCollections, setTopCollections] = useState<TopCollection[]>([]);
  const [bithompData, setBithompData] = useState<Bithomp24hData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [timeInterval, setTimeInterval] = useState<'24h' | '7d' | '30d'>('24h');
  
  // Get wallet connection state from localStorage
  const [connectedChain, setConnectedChain] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  useEffect(() => {
    // Check for connected wallets from all chains
    const chains = ['xrpl', 'ethereum', 'solana'];
    for (const chain of chains) {
      const isConnected = localStorage.getItem(`${chain}_wallet_connected`) === 'true';
      if (isConnected) {
        const address = localStorage.getItem(`${chain}_wallet_address`);
        setConnectedChain(chain);
        setWalletAddress(address);
        break;
      }
    }
  }, []);

  useEffect(() => {
    fetchData();
    
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [connectedChain]); // Re-fetch when chain changes

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Only fetch data if a wallet is connected
      if (!connectedChain || !walletAddress) {
        toast({
          title: "No wallet connected",
          description: "Please connect your wallet to view NFT collections",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      
      // Fetch NFT collections based on connected chain and wallet
      // For now, we'll use mock data but this should call the appropriate API
      // based on the connectedChain (xrpl, ethereum, solana)

      // TODO: Replace with actual API call based on chain
      // const response = await fetch(`/api/nft/top-collections/${connectedChain}?wallet=${walletAddress}&interval=${timeInterval}`);
      // const data = await response.json() as any;
      
      // Mock data for now - would be replaced by actual API response
      // Fetch REAL collections data from our updated API
      const response = await fetch(`/api/nft/marketplace/top-collections?period=day&limit=10`);
      if (response.ok) {
        const realCollections = await response.json() as any;
        
        // Transform into TopCollection format
        const transformedCollections: TopCollection[] = realCollections
          .filter((col: any) => col.totalNFTs > 0 || col.floorPrice > 0 || col.volume24h > 0)
          .map((col: any, index: number) => ({
            id: col.collectionId,
            name: col.name,
            image: col.image || `/api/nft/image/${col.issuer}:${col.taxon}`,
            floorPrice: col.floorPrice.toString(),
            changePercent: col.volumeChange24h,
            totalSupply: col.totalNFTs,
            uniqueHolders: col.owners,
            stats24h: { 
              volume: col.volume24h.toString(), 
              sales: col.sales24h, 
              mints: 0 
            },
            stats7d: { 
              volume: (col.volume24h * 7).toString(), // Estimate 7d from 24h 
              sales: col.sales24h * 7, 
              mints: 0 
            },
            stats30d: { 
              volume: (col.volume24h * 30).toString(), // Estimate 30d from 24h
              sales: col.sales24h * 30, 
              mints: 0 
            }
          }));
        
        console.log(`✅ [TOP24H] Loaded ${transformedCollections.length} real collections with activity`);
        setTopCollections(transformedCollections);
      } else {
        console.error(`❌ [TOP24H] Failed to fetch collections: ${response.status}`);
        setTopCollections([]); // No fallback data
      }

      // Fetch Bithomp 24h sales data
      const bithompResponse = await fetch('/api/nft/bithomp/sales/24h');
      if (bithompResponse.ok) {
        const bithompSalesData = await bithompResponse.json();
        setBithompData(bithompSalesData);
      }

      setLastUpdated(new Date());
    } catch (error) {

      toast({
        title: "Failed to load data",
        description: "Some data may be outdated. Please try refreshing.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatVolume = (volume: string) => {
    const num = parseFloat(volume);
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toFixed(2);
  };

  const getChangeColor = (change?: number) => {
    if (!change) return 'text-gray-500';
    return change >= 0 ? 'text-green-500' : 'text-red-500';
  };

  const getChangeIcon = (change?: number) => {
    if (!change) return '—';
    return change >= 0 ? '↗' : '↘';
  };

  const getStats = (collection: TopCollection) => {
    switch (timeInterval) {
      case '7d':
        return collection.stats7d;
      case '30d':
        return collection.stats30d;
      default:
        return collection.stats24h;
    }
  };

  if (loading && topCollections.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-8">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64 mx-auto"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(9)].map((_, i) => (
                <div key={i} className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
      
      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Advertisement Placeholder Card */}
        <Card className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
          <CardContent className="p-8 text-center">
            <h2 className="text-2xl font-bold mb-2">🎯 Advertise Here</h2>
            <p className="text-lg mb-4">Reach thousands of NFT collectors and traders</p>
            <Button variant="secondary" size="lg" className="bg-white text-blue-600 hover:bg-gray-100">
              Contact for Inquiries
            </Button>
          </CardContent>
        </Card>

        {/* Header Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                  🔥 Top NFT Collections
                </h1>
                <p className="text-gray-600 dark:text-gray-300">
                  Discover the hottest XRPL NFT collections by volume, sales, and mints
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <Select value={timeInterval} onValueChange={(value: '24h' | '7d' | '30d') => setTimeInterval(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24h">24 Hours</SelectItem>
                    <SelectItem value="7d">7 Days</SelectItem>
                    <SelectItem value="30d">30 Days</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-4">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <Clock className="w-4 h-4 inline mr-1" />
                    {lastUpdated.toLocaleTimeString()}
                  </div>
                  <Button onClick={fetchData} variant="outline" size="sm" disabled={loading}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Volume</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatVolume(topCollections.reduce((sum, col) => sum + parseFloat(getStats(col).volume), 0).toString())} XRP
                  </p>
                </div>
                <Coins className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Sales</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {topCollections.reduce((sum, col) => sum + getStats(col).sales, 0).toLocaleString()}
                  </p>
                </div>
                <ShoppingCart className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Mints</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {topCollections.reduce((sum, col) => sum + getStats(col).mints, 0).toLocaleString()}
                  </p>
                </div>
                <Activity className="w-8 h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="trending" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8">
            <TabsTrigger value="trending">🔥 Trending</TabsTrigger>
            <TabsTrigger value="volume">💰 Volume</TabsTrigger>
            <TabsTrigger value="sales">📈 Sales</TabsTrigger>
            <TabsTrigger value="bithomp">⚡ Live Sales</TabsTrigger>
          </TabsList>

          <TabsContent value="trending" className="space-y-6">
            {topCollections.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <div className="text-6xl mb-4">🔥</div>
                  <h3 className="text-xl font-semibold mb-2">No Trending Collections</h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Check back later for trending NFT collections.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {topCollections.slice(0, 9).map((collection, index) => (
                  <Card key={collection.id} className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="text-2xl font-bold text-gray-400 w-8">
                            #{index + 1}
                          </div>
                          <Avatar className="w-12 h-12">
                            <AvatarImage src={collection.image || ''} />
                            <AvatarFallback>{collection.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <h3 className="font-semibold text-lg">{collection.name}</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Floor: {collection.floorPrice} XRP
                            </p>
                          </div>
                        </div>
                        <Badge className="bg-orange-500 text-white">
                          <Flame className="w-3 h-3 mr-1" />
                          Hot
                        </Badge>
                      </div>

                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-green-600">
                            {formatVolume(getStats(collection).volume)}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">Volume XRP</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-blue-600">
                            {getStats(collection).sales}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">Sales</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-purple-600">
                            {getStats(collection).mints}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">Mints</p>
                        </div>
                      </div>

                      <div className="flex justify-between items-center">
                        <div className={`text-sm font-medium ${getChangeColor(collection.changePercent)}`}>
                          {getChangeIcon(collection.changePercent)} {collection.changePercent?.toFixed(1) || '0.0'}%
                        </div>
                        <Button size="sm" variant="outline">
                          <ExternalLink className="w-4 h-4 mr-2" />
                          View
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="volume" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Coins className="w-5 h-5" />
                  Top Collections by 24h Volume
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topCollections
                    .sort((a, b) => parseFloat(getStats(b).volume) - parseFloat(getStats(a).volume))
                    .slice(0, 10)
                    .map((collection, index) => (
                      <div key={collection.id} className="flex items-center gap-4 p-4 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <div className="text-2xl font-bold text-gray-400 w-8">
                          #{index + 1}
                        </div>
                        <Avatar className="w-12 h-12">
                          <AvatarImage src={collection.image || ''} />
                          <AvatarFallback>{collection.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <h3 className="font-semibold">{collection.name}</h3>
                          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                            <span>Floor: {collection.floorPrice} XRP</span>
                            <span>Sales: {getStats(collection).sales}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-green-600">
                            {formatVolume(getStats(collection).volume)} XRP
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{timeInterval} Volume</p>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sales" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Most Active Collections (24h Sales)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topCollections
                    .sort((a, b) => getStats(b).sales - getStats(a).sales)
                    .slice(0, 10)
                    .map((collection, index) => (
                      <div key={collection.id} className="flex items-center gap-4 p-4 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <div className="text-2xl font-bold text-gray-400 w-8">
                          #{index + 1}
                        </div>
                        <Avatar className="w-12 h-12">
                          <AvatarImage src={collection.image || ''} />
                          <AvatarFallback>{collection.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <h3 className="font-semibold">{collection.name}</h3>
                          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                            <span>Volume: {formatVolume(getStats(collection).volume)} XRP</span>
                            <span>Floor: {collection.floorPrice} XRP</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-blue-600">
                            {getStats(collection).sales}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Sales</p>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bithomp" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Live XRPL NFT Sales (Bithomp Data)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!bithompData || bithompData.sales.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-4">⚡</div>
                    <h3 className="text-lg font-semibold mb-2">No Recent Sales</h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      {!bithompData 
                        ? "Unable to fetch live sales data from Bithomp API."
                        : "No NFT sales in the last 24 hours."
                      }
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {bithompData.sales.slice(0, 15).map((sale, index) => (
                      <div key={`${sale.nftokenId}-${sale.timestamp}`} className="flex items-center gap-4 p-4 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={sale.collection?.image || ''} />
                          <AvatarFallback>NFT</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <h4 className="font-medium">
                            {sale.collection?.name || 'Unknown Collection'}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            From {sale.sellerAddress.slice(0, 6)}...{sale.sellerAddress.slice(-4)} to{' '}
                            {sale.buyerAddress.slice(0, 6)}...{sale.buyerAddress.slice(-4)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">
                            {sale.price} {sale.currency}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {new Date(sale.timestamp * 1000).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer Info */}
        <Card className="mt-8">
          <CardContent className="p-4">
            <div className="text-center text-sm text-gray-600 dark:text-gray-400">
              <p>
                Data powered by Bithomp API and XRPL Ledger. Updates every 5 minutes.
                {' '}
                <Button variant="link" size="sm" className="h-auto p-0">
                  <ExternalLink className="w-3 h-3 mr-1" />
                  View on Bithomp
                </Button>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
      
    </div>
  );
}
