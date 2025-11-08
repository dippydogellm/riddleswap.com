import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getQueryOptions } from '@/lib/queryClient';
import { useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  TrendingUp,
  TrendingDown,
  Flame,
  Clock,
  BarChart3,
  Zap,
  ArrowUpRight,
  Eye,
  Users,
  Activity,
  DollarSign
} from 'lucide-react';

interface TokenPair {
  chainId: string;
  dexId?: string;
  url?: string;
  pairAddress?: string;
  baseToken?: {
    address: string;
    name: string;
    symbol: string;
  };
  // Top-level properties (DexScreener token profiles)
  address?: string;
  name?: string;
  symbol?: string;
  priceUsd?: string;
  priceChange?: {
    m5?: number;
    h1?: number;
    h6?: number;
    h24?: number;
  };
  txns?: {
    h24?: { buys: number; sells: number };
  };
  volume?: {
    h24?: number;
  };
  liquidity?: {
    usd?: number;
  };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  info?: {
    imageUrl?: string;
  };
}

// Chain configuration with real logos - XRPL, BSC, Ethereum, and Solana have DexScreener data
const SUPPORTED_CHAINS = [
  { value: 'xrpl', label: 'XRPL', logo: '/images/chains/xrp-logo.png' },
  { value: 'ethereum', label: 'Ethereum', logo: '/images/chains/ethereum-logo.png' },
  { value: 'bsc', label: 'BSC', logo: '/images/chains/bnb-logo.png' },
  { value: 'solana', label: 'Solana', logo: '/images/chains/solana-logo.png' }
];

export default function RiddleScanner() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'trending' | 'new' | 'top'>('trending');
  const [timeFrame, setTimeFrame] = useState<'6h' | '24h'>('6h');
  const [selectedChain, setSelectedChain] = useState<string>('ethereum');

  // Fetch trending tokens from backend API (proxies DexScreener with caching)
  const { data: trendingData, isLoading: trendingLoading } = useQuery({
    queryKey: ['/api/scanner/trending', selectedChain, timeFrame],
    enabled: activeTab === 'trending',
    queryFn: async () => {
      const response = await fetch(`/api/scanner/${selectedChain}/trending?timeFrame=${timeFrame}`);
      if (!response.ok) throw new Error('Failed to fetch trending tokens');
      const data = await response.json() as any;
      return data.pairs || [];
    }
  });

  // Fetch new pairs from backend API
  const { data: newPairsData, isLoading: newPairsLoading } = useQuery({
    queryKey: ['/api/scanner/new-pairs', selectedChain, timeFrame],
    enabled: activeTab === 'new',
    queryFn: async () => {
      const hours = timeFrame === '6h' ? '6' : '24';
      const response = await fetch(`/api/scanner/${selectedChain}/new-pairs?hours=${hours}`);
      if (!response.ok) throw new Error('Failed to fetch new pairs');
      const data = await response.json() as any;
      return data.pairs || [];
    }
  });

  // Fetch top market cap tokens from backend API
  const { data: topMarketCapData, isLoading: topMarketCapLoading } = useQuery({
    queryKey: ['/api/scanner/top-marketcap', selectedChain],
    enabled: activeTab === 'top',
    queryFn: async () => {
      const response = await fetch(`/api/scanner/${selectedChain}/top-marketcap`);
      if (!response.ok) throw new Error('Failed to fetch top market cap');
      const data = await response.json() as any;
      return data.pairs || [];
    }
  });

  const isLoading = trendingLoading || newPairsLoading || topMarketCapLoading;

  const formatNumber = (value?: number | string) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (!num || num === 0) return '0';
    
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return num.toFixed(2);
  };

  const formatPrice = (value?: string | number) => {
    const price = typeof value === 'string' ? parseFloat(value) : value;
    if (!price) return '$0.00';
    
    if (price < 0.000001) return `$${price.toExponential(2)}`;
    if (price < 0.01) return `$${price.toFixed(6)}`;
    if (price < 1) return `$${price.toFixed(4)}`;
    return `$${price.toFixed(2)}`;
  };

  const getChainLogo = (chainId: string) => {
    // Use local chain logos
    const logoMap: Record<string, string> = {
      'xrpl': '/images/chains/xrp-logo.png',
      'ethereum': '/images/chains/ethereum-logo.png',
      'bsc': '/images/chains/bnb-logo.png',
      'polygon': '/images/chains/polygon-logo.png',
      'arbitrum': '/images/chains/arbitrum-logo.png',
      'base': '/images/chains/base-logo.png',
      'optimism': '/images/chains/optimism-logo.png',
      'avalanche': '/images/chains/avalanche-logo.png',
      'fantom': '/images/chains/fantom-logo.png',
      'zksync': '/images/chains/zksync-logo.png',
      'linea': '/images/chains/linea-logo.png',
      'solana': '/images/chains/solana-logo.png'
    };
    return logoMap[chainId] || `https://dd.dexscreener.com/ds-data/chains/${chainId}.png`;
  };

  const handleQuickBuy = (token: TokenPair) => {
    const tokenSymbol = token.baseToken?.symbol || token.symbol || 'UNKNOWN';
    const tokenAddress = token.baseToken?.address || token.address || '';
    
    toast({
      title: "Quick Buy",
      description: `Opening swap for ${tokenSymbol}...`,
    });
    
    // Navigate directly to swap pages with pre-filled token
    if (token.chainId === 'xrpl') {
      // XRPL swap with currency.issuer format
      setLocation(`/xrpl-swap?token=${tokenSymbol}.${tokenAddress}`);
    } else if (token.chainId === 'solana') {
      // Solana swap
      setLocation(`/solana-swap?token=${tokenAddress}`);
    } else {
      // EVM chains swap (ethereum, bsc, etc)
      setLocation(`/swap?chain=${token.chainId}&token=${tokenAddress}`);
    }
  };

  const getTokenAge = (timestamp?: number) => {
    if (!timestamp) return 'N/A';
    const now = Date.now() / 1000;
    const ageInSeconds = now - timestamp;
    
    if (ageInSeconds < 3600) return `${Math.floor(ageInSeconds / 60)}m`;
    if (ageInSeconds < 86400) return `${Math.floor(ageInSeconds / 3600)}h`;
    return `${Math.floor(ageInSeconds / 86400)}d`;
  };

  const TokenCard = ({ token, index }: { token: TokenPair; index: number }) => {
    const priceChange = timeFrame === '6h' ? token.priceChange?.h6 : token.priceChange?.h24;
    const isPositive = (priceChange || 0) > 0;
    const age = getTokenAge(token.pairCreatedAt);
    const isNew = token.pairCreatedAt && (Date.now() / 1000 - token.pairCreatedAt) < 86400;
    
    // Safe accessors for token data
    const tokenSymbol = token.baseToken?.symbol || token.symbol || 'UNKNOWN';
    const tokenName = token.baseToken?.name || token.name || 'Unknown Token';
    const tokenAddress = token.baseToken?.address || token.address || '';

    return (
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 p-3 sm:p-3 bg-gradient-to-r from-gray-900/50 to-blue-900/20 border border-blue-500/20 hover:border-blue-500/40 rounded-lg transition-all hover:bg-gray-900/70">
        {/* Mobile: Top Row - Rank, Token, Price, Buy */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Rank */}
          <div className="flex flex-col items-center min-w-[35px] sm:min-w-[40px]">
            <div className="text-gray-400 text-xs sm:text-sm font-mono">#{index + 1}</div>
            <img
              src={getChainLogo(token.chainId)}
              alt={token.chainId}
              className="w-3 h-3 sm:w-4 sm:h-4 mt-1"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
          
          {/* Token Logo & Info */}
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border-2 border-blue-500/30 flex items-center justify-center overflow-hidden flex-shrink-0">
              {token.info?.imageUrl ? (
                <img
                  src={token.info.imageUrl}
                  alt={tokenSymbol}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <span className="text-xs sm:text-sm font-bold text-white">
                  {tokenSymbol?.charAt(0) || '?'}
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 sm:gap-2">
                <h3 className="text-white font-bold text-sm sm:text-base truncate">{tokenSymbol}</h3>
                {isNew && (
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                    NEW
                  </Badge>
                )}
              </div>
              <p className="text-gray-400 text-xs truncate hidden sm:block">{tokenName}</p>
            </div>
          </div>

          {/* Mobile: Price (always visible) */}
          <div className="text-right sm:min-w-[100px]">
            <div className="text-white font-bold text-xs sm:text-sm">{formatPrice(token.priceUsd)}</div>
            <div className={`text-xs font-semibold flex items-center justify-end gap-1 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
              {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(priceChange || 0).toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Desktop: Additional Stats (hidden on mobile to save space) */}
        <div className="hidden md:flex items-center gap-3 sm:gap-4">
          {/* Age */}
          <div className="text-center min-w-[50px]">
            <div className="text-xs text-gray-500">Age</div>
            <div className="text-sm text-white font-semibold">{age}</div>
          </div>

          {/* Volume */}
          <div className="text-right min-w-[80px]">
            <div className="text-xs text-gray-500">Vol 24h</div>
            <div className="text-sm text-white font-semibold">${formatNumber(token.volume?.h24)}</div>
          </div>

          {/* Market Cap */}
          <div className="text-right min-w-[80px]">
            <div className="text-xs text-gray-500">MCap</div>
            <div className="text-sm text-white font-semibold">${formatNumber(token.marketCap)}</div>
          </div>
        </div>

        {/* Mobile: Bottom Row - Stats */}
        <div className="flex sm:hidden items-center justify-between w-full text-xs text-gray-400 border-t border-gray-700/50 pt-2">
          <div>
            <span className="text-gray-500">Age:</span> <span className="text-white font-semibold">{age}</span>
          </div>
          <div>
            <span className="text-gray-500">Vol:</span> <span className="text-white font-semibold">${formatNumber(token.volume?.h24)}</span>
          </div>
          <div>
            <span className="text-gray-500">MCap:</span> <span className="text-white font-semibold">${formatNumber(token.marketCap)}</span>
          </div>
        </div>

        {/* Buy Button - Always visible */}
        <Button
          size="sm"
          onClick={() => handleQuickBuy(token)}
          className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white w-full sm:w-auto sm:min-w-[70px] mt-2 sm:mt-0"
        >
          <Zap className="w-3 h-3 mr-1" />
          Buy
        </Button>
      </div>
    );
  };

  // Get the correct data based on active tab
  const getCurrentTokens = (): TokenPair[] => {
    if (activeTab === 'new') {
      return (newPairsData as TokenPair[] || []);
    } else if (activeTab === 'top') {
      return (topMarketCapData as TokenPair[] || []);
    }
    return (trendingData as TokenPair[] || []);
  };

  const filteredTokens = getCurrentTokens();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-blue-950 to-gray-950 p-3 sm:p-4 md:p-6">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <Flame className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white truncate">Riddle Scanner</h1>
              <p className="text-xs sm:text-sm md:text-base text-gray-400 truncate">Discover trending tokens across all chains</p>
            </div>
          </div>

          {/* Chain Selector - Buttons with Logos */}
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm font-medium">Chain:</span>
              <div className="flex flex-wrap gap-2">
                {SUPPORTED_CHAINS.map((chain) => (
                  <Button
                    key={chain.value}
                    size="sm"
                    variant={selectedChain === chain.value ? 'default' : 'outline'}
                    onClick={() => setSelectedChain(chain.value)}
                    className={`flex items-center gap-2 ${
                      selectedChain === chain.value 
                        ? 'bg-blue-500 hover:bg-blue-600 border-blue-400' 
                        : 'bg-gray-900/50 border-gray-700 hover:bg-gray-800/80 text-gray-300'
                    }`}
                  >
                    <img 
                      src={chain.logo} 
                      alt={chain.label} 
                      className="w-4 h-4 rounded-full"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <span>{chain.label}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Time Frame Selector */}
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm font-medium">Time Frame:</span>
              <Button
                size="sm"
                variant={timeFrame === '6h' ? 'default' : 'outline'}
                onClick={() => setTimeFrame('6h')}
                className={timeFrame === '6h' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-900/50 border-gray-700 hover:bg-gray-800/80'}
              >
                6H
              </Button>
              <Button
                size="sm"
                variant={timeFrame === '24h' ? 'default' : 'outline'}
                onClick={() => setTimeFrame('24h')}
                className={timeFrame === '24h' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-900/50 border-gray-700 hover:bg-gray-800/80'}
              >
                24H
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="mb-6">
          <TabsList className="bg-gray-900/50 border-gray-700">
            <TabsTrigger value="trending" className="data-[state=active]:bg-blue-500">
              <Flame className="w-4 h-4 mr-2" />
              Trending
            </TabsTrigger>
            <TabsTrigger value="new" className="data-[state=active]:bg-green-500">
              <Clock className="w-4 h-4 mr-2" />
              New Pairs (24h)
            </TabsTrigger>
            <TabsTrigger value="top" className="data-[state=active]:bg-purple-500">
              <BarChart3 className="w-4 h-4 mr-2" />
              Top Market Cap
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(9)].map((_, i) => (
                  <div key={i} className="h-20 bg-gray-900/50 border border-gray-700 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTokens?.slice(0, 30).map((token: TokenPair, index: number) => (
                  <TokenCard key={`${token.pairAddress}-${index}`} token={token} index={index} />
                ))}
              </div>
            )}

            {!isLoading && (!filteredTokens || filteredTokens.length === 0) && (
              <Card className="bg-gray-900/50 border-gray-700">
                <CardContent className="p-12 text-center">
                  <Eye className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">No tokens found</h3>
                  <p className="text-gray-400">Try a different filter or time frame</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
