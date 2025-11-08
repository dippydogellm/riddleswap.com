import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, TrendingDown, Search, Filter, DollarSign, BarChart3, Volume2, Star, Eye, ArrowUpDown, Activity, Clock, RefreshCw, Moon, Sun } from 'lucide-react';

interface Token {
  address: string;
  symbol: string;
  name: string;
  logoURI?: string;
  price?: number;
  price_usd?: number;
  marketCap?: number;
  market_cap?: number;
  volume24h?: number;
  volume_24h?: number;
  change24h?: number;
  priceChange24h?: number;
  change7d?: number;
  liquidity?: number;
  holders?: number;
  chainId: string | number;
  chain?: string;
  issuer?: string;
  currency?: string;
  // Additional fields from APIs
  fdv?: number; // Fully Diluted Valuation
  totalSupply?: number;
  circulatingSupply?: number;
  txns24h?: number;
  buys24h?: number;
  sells24h?: number;
  priceUsd?: string;
  volumeUsd24h?: string;
  verified?: boolean;
  tags?: string[];
}

const chains = [
  { id: 'all', name: 'All Chains', logo: '🌐', color: 'border-gray-300' },
  { id: 'xrpl', name: 'XRPL', logo: '⚡', color: 'border-blue-300' },
  { id: '1', name: 'Ethereum', logo: '🔷', color: 'border-blue-300' },
  { id: '0', name: 'Solana', logo: '🟢', color: 'border-green-300' }
];

const timeframes = [
  { id: '5m', name: '5m', label: '5 minutes' },
  { id: '1h', name: '1h', label: '1 hour' },
  { id: '6h', name: '6h', label: '6 hours' },
  { id: '24h', name: '24h', label: '24 hours' },
  { id: '7d', name: '7d', label: '7 days' }
];

interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  tokenSymbol: string;
  timestamp: number;
  type: 'buy' | 'sell' | 'swap';
}

export function DexScreener() {
  const [selectedChain, setSelectedChain] = useState('all');
  const [selectedTimeframe, setSelectedTimeframe] = useState('24h');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('volume24h');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [activeTab, setActiveTab] = useState('tokens');
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);

  // Apply dark mode to document
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Fetch recent transactions (simulated for demo)
  useEffect(() => {
    const generateMockTransactions = (): Transaction[] => {
      const symbols = ['XRP', 'RDL', 'ETH', 'SOL', 'USDC', 'USDT'];
      const types: ('buy' | 'sell' | 'swap')[] = ['buy', 'sell', 'swap'];
      
      return Array.from({ length: 20 }, (_, i) => ({
        hash: `0x${Math.random().toString(16).substring(2, 42)}`,
        from: `0x${Math.random().toString(16).substring(2, 42)}`,
        to: `0x${Math.random().toString(16).substring(2, 42)}`,
        value: (Math.random() * 10000).toFixed(2),
        tokenSymbol: symbols[Math.floor(Math.random() * symbols.length)],
        timestamp: Date.now() - (i * 60000),
        type: types[Math.floor(Math.random() * types.length)]
      }));
    };

    setRecentTransactions(generateMockTransactions());
    
    // Refresh transactions every 30 seconds
    const interval = setInterval(() => {
      setRecentTransactions(generateMockTransactions());
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Fetch tokens from working chains only
  const { data: xrplTokens } = useQuery({
    queryKey: ['/api/tokens/xrpl'],
    enabled: selectedChain === 'all' || selectedChain === 'xrpl'
  });

  const { data: ethTokens } = useQuery({
    queryKey: ['/api/tokens/evm/1'],
    enabled: selectedChain === 'all' || selectedChain === '1'
  });

  const { data: solanaTokens } = useQuery({
    queryKey: ['/api/tokens/solana'],
    enabled: selectedChain === 'all' || selectedChain === '0'
  });

  // Normalize token data from different API formats
  const normalizeToken = (token: any): Token => {
    return {
      ...token,
      price: token.price || token.price_usd || parseFloat(token.priceUsd || '0'),
      marketCap: token.marketCap || token.market_cap || parseFloat(token.fdv || '0'),
      volume24h: token.volume24h || token.volume_24h || parseFloat(token.volumeUsd24h || '0'),
      change24h: token.change24h || token.priceChange24h || 0,
      chainId: token.chainId || token.chain || 'unknown'
    };
  };

  // Combine all tokens based on selected chain using useMemo to prevent infinite loops
  const combinedTokens = useMemo(() => {
    const combined: Token[] = [];
    
    if (selectedChain === 'all') {
      // Add tokens from all working chains with normalization
      if (Array.isArray(xrplTokens)) {
        combined.push(...xrplTokens.slice(0, 100).map(normalizeToken));
      }
      if (Array.isArray(ethTokens)) {
        combined.push(...ethTokens.slice(0, 50).map(normalizeToken));
      }
      if (Array.isArray(solanaTokens)) {
        combined.push(...solanaTokens.slice(0, 200).map(normalizeToken));
      }
    } else {
      // Show all tokens for specific chain with normalization
      if (selectedChain === 'xrpl' && Array.isArray(xrplTokens)) {
        combined.push(...xrplTokens.map(normalizeToken));
      } else if (selectedChain === '1' && Array.isArray(ethTokens)) {
        combined.push(...ethTokens.map(normalizeToken));
      } else if (selectedChain === '0' && Array.isArray(solanaTokens)) {
        combined.push(...solanaTokens.map(normalizeToken));
      }
    }

    return combined;
  }, [xrplTokens, ethTokens, solanaTokens, selectedChain]);

  // Filter and sort tokens
  const filteredTokens = combinedTokens
    .filter(token => 
      token.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      token.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let valueA: number, valueB: number;
      
      switch (sortBy) {
        case 'marketCap':
          valueA = a.marketCap || 0;
          valueB = b.marketCap || 0;
          break;
        case 'volume24h':
          valueA = a.volume24h || 0;
          valueB = b.volume24h || 0;
          break;
        case 'price':
          valueA = a.price || 0;
          valueB = b.price || 0;
          break;
        case 'change24h':
          valueA = a.change24h || 0;
          valueB = b.change24h || 0;
          break;
        case 'holders':
          valueA = a.holders || 0;
          valueB = b.holders || 0;
          break;
        default:
          return 0;
      }
      
      return sortOrder === 'desc' ? valueB - valueA : valueA - valueB;
    });

  const formatNumber = (num?: number) => {
    if (!num) return '$0';
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  const formatPrice = (price?: number) => {
    if (!price) return '$0';
    if (price < 0.000001) return `$${price.toExponential(2)}`;
    if (price < 0.01) return `$${price.toFixed(6)}`;
    if (price < 1) return `$${price.toFixed(4)}`;
    return `$${price.toFixed(2)}`;
  };

  const getChainInfo = (chainId: string | number) => {
    const chain = chains.find(c => c.id === chainId.toString());
    return chain || { id: 'unknown', name: 'Unknown', logo: '🔗', color: 'from-gray-500 to-gray-600' };
  };

  const toggleFavorite = (tokenAddress: string) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(tokenAddress)) {
      newFavorites.delete(tokenAddress);
    } else {
      newFavorites.add(tokenAddress);
    }
    setFavorites(newFavorites);
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="container mx-auto px-4 py-8">
        {/* Header with Dark Mode Toggle */}
        <div className="text-center mb-10 animate-fade-in">
          <div className="flex justify-end mb-4">
            <Button
              onClick={() => setIsDarkMode(!isDarkMode)}
              variant="outline"
              size="icon"
              className={`rounded-full ${
                isDarkMode 
                  ? 'bg-gray-800 border-gray-700 text-yellow-400 hover:bg-gray-700' 
                  : 'bg-white border-gray-300 text-gray-900 hover:bg-gray-100'
              }`}
            >
              {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
          </div>
          
          <h1 className={`text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 bg-gradient-to-r ${
            isDarkMode 
              ? 'from-blue-400 via-purple-400 to-pink-400' 
              : 'from-blue-600 via-purple-600 to-pink-600'
          } bg-clip-text text-transparent`}>
            RIDDLE DEX
          </h1>
          
          <p className={`text-xl max-w-2xl mx-auto mb-6 ${
            isDarkMode ? 'text-gray-300' : 'text-gray-600'
          }`}>
            Multi-Chain Token Analytics & Real-Time Trading Data
          </p>
          
          <div className="flex justify-center gap-4 flex-wrap">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border ${
              isDarkMode 
                ? 'bg-gray-800 border-blue-800/50 shadow-lg shadow-blue-900/20' 
                : 'bg-white border-blue-200 shadow-md'
            }`}>
              <Activity className={`h-4 w-4 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} />
              <span className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                Live Data: 
              </span>
              <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                XRPL • Ethereum • Solana
              </span>
            </div>
            
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border ${
              isDarkMode 
                ? 'bg-gray-800 border-purple-800/50 shadow-lg shadow-purple-900/20' 
                : 'bg-white border-purple-200 shadow-md'
            }`}>
              <BarChart3 className={`h-4 w-4 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`} />
              <span className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                {filteredTokens.length.toLocaleString()} Tokens
              </span>
            </div>
          </div>
        </div>

        {/* Filters & Controls */}
        <Card className={`mb-8 shadow-2xl border-0 ${
          isDarkMode 
            ? 'bg-gradient-to-br from-gray-800 to-gray-900' 
            : 'bg-gradient-to-br from-white to-gray-50'
        }`}>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Chain Selection */}
              <div className="lg:col-span-3">
                <label className={`text-sm font-semibold mb-2 block ${
                  isDarkMode ? 'text-gray-200' : 'text-gray-700'
                }`}>
                  Chain Network
                </label>
                <Select value={selectedChain} onValueChange={setSelectedChain}>
                  <SelectTrigger className={`transition-all ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white hover:bg-gray-600' 
                      : 'bg-white border-gray-300 text-gray-900 hover:border-blue-400'
                  }`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}>
                    {chains.map(chain => (
                      <SelectItem key={chain.id} value={chain.id} className={isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{chain.logo}</span>
                          <span className="font-medium">{chain.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Timeframe */}
              <div className="lg:col-span-2">
                <label className={`text-sm font-semibold mb-2 block ${
                  isDarkMode ? 'text-gray-200' : 'text-gray-700'
                }`}>
                  Timeframe
                </label>
                <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
                  <SelectTrigger className={`transition-all ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white hover:bg-gray-600' 
                      : 'bg-white border-gray-300 text-gray-900 hover:border-blue-400'
                  }`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}>
                    {timeframes.map(tf => (
                      <SelectItem key={tf.id} value={tf.id} className={isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}>
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          {tf.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Search */}
              <div className="lg:col-span-4">
                <label className={`text-sm font-semibold mb-2 block ${
                  isDarkMode ? 'text-gray-200' : 'text-gray-700'
                }`}>
                  Search Tokens
                </label>
                <div className="relative">
                  <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`} />
                  <Input
                    placeholder="Search by symbol or name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`pl-10 transition-all ${
                      isDarkMode 
                        ? 'bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 focus:border-blue-500' 
                        : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-blue-400'
                    }`}
                  />
                </div>
              </div>

              {/* Results Count */}
              <div className="lg:col-span-3 flex items-end">
                <div className={`flex items-center gap-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-600'
                }`}>
                  <Badge variant="outline" className={`px-3 py-1 ${
                    isDarkMode 
                      ? 'bg-blue-900/30 border-blue-700 text-blue-300' 
                      : 'bg-blue-50 border-blue-300 text-blue-700'
                  }`}>
                    {filteredTokens.length} tokens
                  </Badge>
                  <span className="text-sm">• 3 live chains</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className={`border-0 shadow-2xl transform transition-all duration-300 hover:scale-105 ${
            isDarkMode 
              ? 'bg-gradient-to-br from-blue-900/50 to-blue-800/30' 
              : 'bg-gradient-to-br from-blue-50 to-blue-100'
          }`}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl shadow-lg ${
                  isDarkMode 
                    ? 'bg-blue-600' 
                    : 'bg-blue-500'
                }`}>
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
                <div>
                  <div className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {formatNumber(filteredTokens.reduce((sum, token) => sum + (token.marketCap || 0), 0))}
                  </div>
                  <div className={`text-sm font-medium ${isDarkMode ? 'text-blue-300' : 'text-blue-700'}`}>
                    Total Market Cap
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`border-0 shadow-2xl transform transition-all duration-300 hover:scale-105 ${
            isDarkMode 
              ? 'bg-gradient-to-br from-green-900/50 to-green-800/30' 
              : 'bg-gradient-to-br from-green-50 to-green-100'
          }`}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl shadow-lg ${
                  isDarkMode 
                    ? 'bg-green-600' 
                    : 'bg-green-500'
                }`}>
                  <Volume2 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <div className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {formatNumber(filteredTokens.reduce((sum, token) => sum + (token.volume24h || 0), 0))}
                  </div>
                  <div className={`text-sm font-medium ${isDarkMode ? 'text-green-300' : 'text-green-700'}`}>
                    24h Volume
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`border-0 shadow-2xl transform transition-all duration-300 hover:scale-105 ${
            isDarkMode 
              ? 'bg-gradient-to-br from-purple-900/50 to-purple-800/30' 
              : 'bg-gradient-to-br from-purple-50 to-purple-100'
          }`}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl shadow-lg ${
                  isDarkMode 
                    ? 'bg-purple-600' 
                    : 'bg-purple-500'
                }`}>
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <div className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {filteredTokens.length}
                  </div>
                  <div className={`text-sm font-medium ${isDarkMode ? 'text-purple-300' : 'text-purple-700'}`}>
                    Active Tokens
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`border-0 shadow-2xl transform transition-all duration-300 hover:scale-105 ${
            isDarkMode 
              ? 'bg-gradient-to-br from-orange-900/50 to-orange-800/30' 
              : 'bg-gradient-to-br from-orange-50 to-orange-100'
          }`}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl shadow-lg ${
                  isDarkMode 
                    ? 'bg-orange-600' 
                    : 'bg-orange-500'
                }`}>
                  <Activity className="h-6 w-6 text-white" />
                </div>
                <div>
                  <div className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    3
                  </div>
                  <div className={`text-sm font-medium ${isDarkMode ? 'text-orange-300' : 'text-orange-700'}`}>
                    Live Chains
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for Tokens and Transactions */}
        <Card className={`border-0 shadow-2xl ${
          isDarkMode 
            ? 'bg-gradient-to-br from-gray-800 to-gray-900' 
            : 'bg-white'
        }`}>
          <CardHeader className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className={`w-full grid grid-cols-2 ${
                isDarkMode 
                  ? 'bg-gray-700' 
                  : 'bg-gray-100'
              }`}>
                <TabsTrigger 
                  value="tokens" 
                  className={`flex items-center gap-2 ${
                    activeTab === 'tokens' 
                      ? isDarkMode 
                        ? 'bg-gray-800 text-white' 
                        : 'bg-white text-gray-900' 
                      : isDarkMode 
                        ? 'text-gray-400' 
                        : 'text-gray-600'
                  }`}
                >
                  <BarChart3 className="h-4 w-4" />
                  Token Analytics
                </TabsTrigger>
                <TabsTrigger 
                  value="transactions" 
                  className={`flex items-center gap-2 ${
                    activeTab === 'transactions' 
                      ? isDarkMode 
                        ? 'bg-gray-800 text-white' 
                        : 'bg-white text-gray-900' 
                      : isDarkMode 
                        ? 'text-gray-400' 
                        : 'text-gray-600'
                  }`}
                >
                  <Activity className="h-4 w-4" />
                  Recent Transactions
                  <Badge className={`ml-2 ${
                    isDarkMode 
                      ? 'bg-green-900 text-green-300' 
                      : 'bg-green-100 text-green-700'
                  }`}>
                    Live
                  </Badge>
                </TabsTrigger>
              </TabsList>
              
              {/* Tokens Tab */}
              <TabsContent value="tokens" className="mt-0">
                {/* Mobile Card View */}
                <div className="block lg:hidden p-4">
                  <div className="space-y-3">
                    {filteredTokens.slice(0, 50).map((token, index) => {
                      const chainInfo = getChainInfo(token.chainId);
                      return (
                        <Card
                          key={`${token.address}-${index}`}
                          className={`transform transition-all hover:scale-[1.02] ${
                            isDarkMode
                              ? 'bg-gray-800/50 border-gray-700'
                              : 'bg-white border-gray-200'
                          }`}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => toggleFavorite(token.address)}
                                  className={`p-1 rounded ${
                                    favorites.has(token.address)
                                      ? 'text-yellow-500'
                                      : isDarkMode ? 'text-gray-500' : 'text-gray-400'
                                  }`}
                                >
                                  <Star className="h-4 w-4" fill={favorites.has(token.address) ? 'currentColor' : 'none'} />
                                </button>
                                {token.logoURI && (
                                  <img
                                    src={token.logoURI}
                                    alt={token.symbol}
                                    className="w-10 h-10 rounded-full"
                                    onError={(e) => e.currentTarget.style.display = 'none'}
                                  />
                                )}
                                <div>
                                  <div className={`font-bold text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                    {token.symbol}
                                  </div>
                                  <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {token.name}
                                  </div>
                                </div>
                              </div>
                              <Badge variant="outline" className={isDarkMode ? 'border-gray-600' : 'border-gray-300'}>
                                <span className="mr-1">{chainInfo.logo}</span>
                                {chainInfo.name}
                              </Badge>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Price</div>
                                <div className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                  {formatPrice(token.price)}
                                </div>
                              </div>
                              <div>
                                <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>24h Change</div>
                                <div className={`text-lg font-bold flex items-center gap-1 ${
                                  token.change24h && token.change24h >= 0
                                    ? 'text-green-500'
                                    : 'text-red-500'
                                }`}>
                                  {token.change24h && token.change24h >= 0 ? (
                                    <TrendingUp className="h-4 w-4" />
                                  ) : (
                                    <TrendingDown className="h-4 w-4" />
                                  )}
                                  {token.change24h ? `${Math.abs(token.change24h).toFixed(2)}%` : '-'}
                                </div>
                              </div>
                              <div>
                                <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Volume 24h</div>
                                <div className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                  {formatNumber(token.volume24h)}
                                </div>
                              </div>
                              <div>
                                <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Market Cap</div>
                                <div className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                  {formatNumber(token.marketCap)}
                                </div>
                              </div>
                            </div>
                            
                            {/* Additional Info */}
                            {(token.liquidity || token.holders || token.txns24h) && (
                              <div className={`mt-3 pt-3 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                                <div className="grid grid-cols-3 gap-2 text-xs">
                                  {token.liquidity && (
                                    <div>
                                      <div className={isDarkMode ? 'text-gray-500' : 'text-gray-500'}>Liquidity</div>
                                      <div className={`font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                        {formatNumber(token.liquidity)}
                                      </div>
                                    </div>
                                  )}
                                  {token.holders && (
                                    <div>
                                      <div className={isDarkMode ? 'text-gray-500' : 'text-gray-500'}>Holders</div>
                                      <div className={`font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                        {token.holders.toLocaleString()}
                                      </div>
                                    </div>
                                  )}
                                  {token.txns24h && (
                                    <div>
                                      <div className={isDarkMode ? 'text-gray-500' : 'text-gray-500'}>Txns 24h</div>
                                      <div className={`font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                        {token.txns24h.toLocaleString()}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            {/* Token Address */}
                            <div className={`mt-2 text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                              {token.address.substring(0, 10)}...{token.address.substring(token.address.length - 8)}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>

                {/* Desktop Table View */}
                <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead className={isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}>
                  <tr>
                    <th className={`text-left p-4 font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4" />
                        Token
                      </div>
                    </th>
                    <th className={`text-left p-4 font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>Chain</th>
                    <th 
                      className={`text-right p-4 font-semibold cursor-pointer transition-colors ${
                        isDarkMode ? 'text-gray-200 hover:text-white' : 'text-gray-700 hover:text-gray-900'
                      }`}
                      onClick={() => handleSort('price')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Price
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                    <th 
                      className={`text-right p-4 font-semibold cursor-pointer transition-colors ${
                        isDarkMode ? 'text-gray-200 hover:text-white' : 'text-gray-700 hover:text-gray-900'
                      }`}
                      onClick={() => handleSort('change24h')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        24h %
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                    <th 
                      className={`text-right p-4 font-semibold cursor-pointer transition-colors ${
                        isDarkMode ? 'text-gray-200 hover:text-white' : 'text-gray-700 hover:text-gray-900'
                      }`}
                      onClick={() => handleSort('volume24h')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Volume 24h
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                    <th 
                      className={`text-right p-4 font-semibold cursor-pointer transition-colors ${
                        isDarkMode ? 'text-gray-200 hover:text-white' : 'text-gray-700 hover:text-gray-900'
                      }`}
                      onClick={() => handleSort('marketCap')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Market Cap
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                    <th className={`text-right p-4 font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                      Liquidity
                    </th>
                    <th className={`text-center p-4 font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTokens.slice(0, 200).map((token, index) => {
                    const chainInfo = getChainInfo(token.chainId);
                    return (
                      <tr 
                        key={`${token.address}-${index}`} 
                        className={`border-b transition-all duration-200 ${
                          isDarkMode 
                            ? 'border-gray-700 hover:bg-gray-700/50' 
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => toggleFavorite(token.address)}
                              className={`p-1 rounded transition-colors ${
                                favorites.has(token.address) 
                                  ? 'text-yellow-500 hover:text-yellow-400' 
                                  : isDarkMode 
                                    ? 'text-gray-500 hover:text-gray-400' 
                                    : 'text-gray-400 hover:text-gray-600'
                              }`}
                            >
                              <Star className="h-4 w-4" fill={favorites.has(token.address) ? 'currentColor' : 'none'} />
                            </button>
                            {token.logoURI && (
                              <img 
                                src={token.logoURI} 
                                alt={token.symbol}
                                className="w-10 h-10 rounded-full shadow-md"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            )}
                            <div>
                              <div className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                {token.symbol}
                                {token.verified && (
                                  <Badge className="ml-2 text-xs bg-blue-500 text-white">
                                    ✓
                                  </Badge>
                                )}
                              </div>
                              <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                {token.name}
                              </div>
                              <div className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'} font-mono`}>
                                {token.address.substring(0, 6)}...{token.address.substring(token.address.length - 4)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge 
                            variant="outline" 
                            className={`${
                              isDarkMode 
                                ? 'border-gray-600 text-gray-300 bg-gray-700/50' 
                                : 'border-gray-300 text-gray-700 bg-white/50'
                            }`}
                          >
                            <span className="mr-1">{chainInfo.logo}</span>
                            {chainInfo.name}
                          </Badge>
                        </td>
                        <td className="p-4 text-right">
                          <div className={`font-bold text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            {formatPrice(token.price)}
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          {token.change24h !== undefined ? (
                            <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg font-bold ${
                              token.change24h >= 0 
                                ? isDarkMode 
                                  ? 'bg-green-900/30 text-green-400' 
                                  : 'bg-green-100 text-green-700'
                                : isDarkMode 
                                  ? 'bg-red-900/30 text-red-400' 
                                  : 'bg-red-100 text-red-700'
                            }`}>
                              {token.change24h >= 0 ? (
                                <TrendingUp className="h-4 w-4" />
                              ) : (
                                <TrendingDown className="h-4 w-4" />
                              )}
                              {Math.abs(token.change24h).toFixed(2)}%
                            </div>
                          ) : (
                            <span className={isDarkMode ? 'text-gray-500' : 'text-gray-400'}>-</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <div className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            {formatNumber(token.volume24h)}
                          </div>
                          {token.txns24h && (
                            <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                              {token.txns24h.toLocaleString()} txns
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <div className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            {formatNumber(token.marketCap)}
                          </div>
                          {token.fdv && token.fdv !== token.marketCap && (
                            <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                              FDV: {formatNumber(token.fdv)}
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <div className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            {token.liquidity ? formatNumber(token.liquidity) : '-'}
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            className={`${
                              isDarkMode 
                                ? 'bg-blue-900/30 border-blue-700 text-blue-400 hover:bg-blue-900/50' 
                                : 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100'
                            }`}
                            onClick={() => {
                              // Open token details or external link
                              const url = chainInfo.id === 'xrpl' 
                                ? `https://xrpl.to/token/${token.address}`
                                : chainInfo.id === '1'
                                ? `https://etherscan.io/token/${token.address}`
                                : `https://solscan.io/token/${token.address}`;
                              window.open(url, '_blank');
                            }}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
              </TabsContent>
              
              {/* Transactions Tab */}
              <TabsContent value="transactions" className="mt-0">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      Recent Transactions
                    </h3>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className={isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : ''}
                      onClick={() => {
                        // Refresh transactions
                        const symbols = ['XRP', 'RDL', 'ETH', 'SOL', 'USDC', 'USDT'];
                        const types: ('buy' | 'sell' | 'swap')[] = ['buy', 'sell', 'swap'];
                        setRecentTransactions(Array.from({ length: 20 }, (_, i) => ({
                          hash: `0x${Math.random().toString(16).substring(2, 42)}`,
                          from: `0x${Math.random().toString(16).substring(2, 42)}`,
                          to: `0x${Math.random().toString(16).substring(2, 42)}`,
                          value: (Math.random() * 10000).toFixed(2),
                          tokenSymbol: symbols[Math.floor(Math.random() * symbols.length)],
                          timestamp: Date.now() - (i * 60000),
                          type: types[Math.floor(Math.random() * types.length)]
                        })));
                      }}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    {recentTransactions.map((tx, index) => (
                      <div
                        key={tx.hash}
                        className={`p-4 rounded-lg border transition-all duration-200 hover:scale-[1.02] ${
                          isDarkMode 
                            ? 'bg-gray-800/50 border-gray-700 hover:bg-gray-700/50' 
                            : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${
                              tx.type === 'buy' 
                                ? isDarkMode ? 'bg-green-900/50 text-green-400' : 'bg-green-100 text-green-700'
                                : tx.type === 'sell'
                                ? isDarkMode ? 'bg-red-900/50 text-red-400' : 'bg-red-100 text-red-700'
                                : isDarkMode ? 'bg-blue-900/50 text-blue-400' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {tx.type === 'buy' && <TrendingUp className="h-4 w-4" />}
                              {tx.type === 'sell' && <TrendingDown className="h-4 w-4" />}
                              {tx.type === 'swap' && <Activity className="h-4 w-4" />}
                            </div>
                            
                            <div>
                              <div className="flex items-center gap-2">
                                <Badge className={`uppercase text-xs ${
                                  tx.type === 'buy' 
                                    ? isDarkMode ? 'bg-green-900 text-green-300' : 'bg-green-100 text-green-700'
                                    : tx.type === 'sell'
                                    ? isDarkMode ? 'bg-red-900 text-red-300' : 'bg-red-100 text-red-700'
                                    : isDarkMode ? 'bg-blue-900 text-blue-300' : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {tx.type}
                                </Badge>
                                <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                  {tx.tokenSymbol}
                                </span>
                              </div>
                              <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                {tx.hash.substring(0, 10)}...{tx.hash.substring(tx.hash.length - 8)}
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <div className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              ${parseFloat(tx.value).toLocaleString()}
                            </div>
                            <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              {new Date(tx.timestamp).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}

export default DexScreener;
