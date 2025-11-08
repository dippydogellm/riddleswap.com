import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  TrendingUp, 
  Flame, 
  Search, 
  RefreshCw,
  ExternalLink,
  Zap,
  Rocket,
  Star,
  ArrowUpRight,
  DollarSign,
  Volume2,
  Users
} from 'lucide-react';

interface PumpToken {
  mint: string;
  name: string;
  symbol: string;
  description: string;
  image_uri: string;
  created_timestamp: number;
  market_cap: number;
  usd_market_cap: number;
  price: number;
  volume_24h: number;
  last_trade_timestamp: number;
  king_of_the_hill_timestamp?: number;
  is_complete: boolean;
  associated_bonding_curve: string;
  creator: string;
  twitter?: string;
  telegram?: string;
  website?: string;
}

export default function PumpFun() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedToken, setSelectedToken] = useState<PumpToken | null>(null);
  const [buyAmount, setBuyAmount] = useState('');
  const [sellAmount, setSellAmount] = useState('');

  // Fetch trending tokens from Pump.fun API
  const { data: trendingTokens, isLoading: trendingLoading, refetch: refetchTrending } = useQuery({
    queryKey: ['pump-fun-trending'],
    queryFn: async () => {
      const response = await fetch('/api/pump-fun/trending');
      if (!response.ok) throw new Error('Failed to fetch trending tokens');
      return response.json();
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Search tokens
  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ['pump-fun-search', searchTerm],
    queryFn: async () => {
      if (!searchTerm.trim()) return null;
      const response = await fetch(`/api/pump-fun/search?q=${encodeURIComponent(searchTerm)}`);
      if (!response.ok) throw new Error('Failed to search tokens');
      return response.json();
    },
    enabled: searchTerm.trim().length > 2
  });

  // Buy token mutation
  const buyMutation = useMutation({
    mutationFn: async ({ mint, amount }: { mint: string; amount: string }) => {
      const response = await fetch('/api/pump-fun/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mint, amount, slippage: 5 })
      });
      if (!response.ok) throw new Error('Failed to buy token');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Purchase Successful",
        description: "Your token purchase has been completed!",
      });
      setBuyAmount('');
    },
    onError: (error) => {
      toast({
        title: "Purchase Failed",
        description: error instanceof Error ? error.message : "Failed to complete purchase",
        variant: "destructive"
      });
    }
  });

  // Sell token mutation
  const sellMutation = useMutation({
    mutationFn: async ({ mint, amount }: { mint: string; amount: string }) => {
      const response = await fetch('/api/pump-fun/sell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mint, amount, slippage: 5 })
      });
      if (!response.ok) throw new Error('Failed to sell token');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sale Successful",
        description: "Your token sale has been completed!",
      });
      setSellAmount('');
    },
    onError: (error) => {
      toast({
        title: "Sale Failed",
        description: error instanceof Error ? error.message : "Failed to complete sale",
        variant: "destructive"
      });
    }
  });

  const formatPrice = (price: number) => {
    if (price < 0.001) return price.toExponential(3);
    return price.toFixed(6);
  };

  const formatMarketCap = (marketCap: number) => {
    if (marketCap >= 1000000) return `$${(marketCap / 1000000).toFixed(2)}M`;
    if (marketCap >= 1000) return `$${(marketCap / 1000).toFixed(1)}K`;
    return `$${marketCap.toFixed(0)}`;
  };

  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now() / 1000;
    const diff = now - timestamp;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-red-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-r from-pink-500 to-purple-500 rounded-xl">
              <Rocket className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
              Pump.fun
            </h1>
          </div>
          <p className="text-gray-300 text-lg">
            Trade the hottest Solana meme tokens with zero fees
          </p>
        </div>

        {/* Search Bar */}
        <div className="max-w-md mx-auto mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search tokens by name or symbol..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-black/50 border-purple-500/30 text-white placeholder-gray-400"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Token List */}
          <div className="lg:col-span-2">
            <Card className="bg-black/50 border-purple-500/30">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white flex items-center gap-2">
                    <Flame className="w-5 h-5 text-orange-500" />
                    {searchTerm ? 'Search Results' : 'Trending Tokens'}
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchTrending()}
                    className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(searchResults?.tokens || trendingTokens?.tokens || []).map((token: PumpToken) => (
                    <div
                      key={token.mint}
                      className={`p-4 rounded-lg border transition-all cursor-pointer ${
                        selectedToken?.mint === token.mint
                          ? 'bg-purple-500/20 border-purple-500'
                          : 'bg-gray-800/50 border-gray-700 hover:bg-gray-700/50'
                      }`}
                      onClick={() => setSelectedToken(token)}
                    >
                      <div className="flex items-center gap-4">
                        <img
                          src={token.image_uri || '/api/placeholder/48/48'}
                          alt={token.name}
                          className="w-12 h-12 rounded-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = '/api/placeholder/48/48';
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-white font-semibold truncate">{token.name}</h3>
                            <Badge variant="secondary" className="text-xs">
                              ${token.symbol}
                            </Badge>
                            {token.is_complete && (
                              <Badge className="bg-green-500 text-white text-xs">
                                <Star className="w-3 h-3 mr-1" />
                                Graduated
                              </Badge>
                            )}
                          </div>
                          <p className="text-gray-400 text-sm truncate">{token.description}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-300">
                            <span className="flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              {formatMarketCap(token.usd_market_cap)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Volume2 className="w-3 h-3" />
                              ${(token.volume_24h / 1000).toFixed(1)}K
                            </span>
                            <span>{formatTimeAgo(token.created_timestamp)}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-green-400 font-semibold">
                            ${formatPrice(token.price)}
                          </div>
                          <div className="text-xs text-gray-400">
                            {formatMarketCap(token.market_cap)} SOL
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {(trendingLoading || searchLoading) && (
                    <div className="text-center py-8">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-400" />
                      <p className="text-gray-400">Loading tokens...</p>
                    </div>
                  )}
                  
                  {!trendingLoading && !searchLoading && 
                   !(searchResults?.tokens || trendingTokens?.tokens)?.length && (
                    <div className="text-center py-8">
                      <p className="text-gray-400">No tokens found</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Trading Panel */}
          <div>
            <Card className="bg-black/50 border-purple-500/30 sticky top-4">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-500" />
                  Quick Trade
                </CardTitle>
                {selectedToken && (
                  <CardDescription className="text-gray-300">
                    Trading {selectedToken.symbol}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedToken ? (
                  <>
                    {/* Token Info */}
                    <div className="p-3 bg-gray-800/50 rounded-lg">
                      <div className="flex items-center gap-3 mb-2">
                        <img
                          src={selectedToken.image_uri || '/api/placeholder/32/32'}
                          alt={selectedToken.name}
                          className="w-8 h-8 rounded-full"
                        />
                        <div>
                          <div className="text-white font-semibold">{selectedToken.name}</div>
                          <div className="text-xs text-gray-400">${selectedToken.symbol}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-400">Price:</span>
                          <div className="text-green-400 font-semibold">
                            ${formatPrice(selectedToken.price)}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-400">Market Cap:</span>
                          <div className="text-white">
                            {formatMarketCap(selectedToken.usd_market_cap)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Buy Section */}
                    <div className="space-y-3">
                      <h4 className="text-white font-medium">Buy {selectedToken.symbol}</h4>
                      <Input
                        placeholder="Amount in SOL"
                        value={buyAmount}
                        onChange={(e) => setBuyAmount(e.target.value)}
                        type="number"
                        step="0.01"
                        className="bg-gray-800/50 border-gray-600 text-white"
                      />
                      <Button
                        onClick={() => buyMutation.mutate({ mint: selectedToken.mint, amount: buyAmount })}
                        disabled={!buyAmount || buyMutation.isPending}
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        {buyMutation.isPending ? 'Buying...' : `Buy ${selectedToken.symbol}`}
                      </Button>
                    </div>

                    {/* Sell Section */}
                    <div className="space-y-3">
                      <h4 className="text-white font-medium">Sell {selectedToken.symbol}</h4>
                      <Input
                        placeholder={`Amount in ${selectedToken.symbol}`}
                        value={sellAmount}
                        onChange={(e) => setSellAmount(e.target.value)}
                        type="number"
                        step="0.01"
                        className="bg-gray-800/50 border-gray-600 text-white"
                      />
                      <Button
                        onClick={() => sellMutation.mutate({ mint: selectedToken.mint, amount: sellAmount })}
                        disabled={!sellAmount || sellMutation.isPending}
                        variant="outline"
                        className="w-full border-red-500 text-red-400 hover:bg-red-500/10"
                      >
                        {sellMutation.isPending ? 'Selling...' : `Sell ${selectedToken.symbol}`}
                      </Button>
                    </div>

                    {/* External Links */}
                    {(selectedToken.website || selectedToken.twitter || selectedToken.telegram) && (
                      <div className="pt-3 border-t border-gray-700">
                        <div className="flex gap-2">
                          {selectedToken.website && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 border-purple-500/30 text-purple-400"
                              onClick={() => window.open(selectedToken.website, '_blank')}
                            >
                              <ExternalLink className="w-3 h-3 mr-1" />
                              Website
                            </Button>
                          )}
                          {selectedToken.twitter && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 border-blue-500/30 text-blue-400"
                              onClick={() => window.open(selectedToken.twitter, '_blank')}
                            >
                              <ExternalLink className="w-3 h-3 mr-1" />
                              Twitter
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8">
                    <Rocket className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400">Select a token to start trading</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
