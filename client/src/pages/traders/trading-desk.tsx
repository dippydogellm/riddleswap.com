import React, { useState, useEffect } from 'react';
import { BarChart3, DollarSign, TrendingUp, TrendingDown, RefreshCw, Zap, ArrowUpDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';

interface TokenData {
  symbol: string;
  name: string;
  price: string;
  change24h: string;
  volume24h: string;
  marketCap: string;
  chain: string;
  address: string;
}

interface QuickTradeOrder {
  id: string;
  pair: string;
  type: 'buy' | 'sell';
  amount: string;
  price: string;
  total: string;
  status: 'pending' | 'completed' | 'failed';
  chain: string;
}

export default function TradingDeskPage() {
  const [watchlist, setWatchlist] = useState<TokenData[]>([]);
  const [selectedChain, setSelectedChain] = useState('ethereum');
  const [quickTradeAmount, setQuickTradeAmount] = useState('100');
  const [slippage, setSlippage] = useState([0.5]);
  const [recentOrders, setRecentOrders] = useState<QuickTradeOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const supportedChains = [
    { id: 'ethereum', name: 'Ethereum', native: 'ETH' },
    { id: 'bsc', name: 'BSC', native: 'BNB' },
    { id: 'polygon', name: 'Polygon', native: 'MATIC' },
    { id: 'arbitrum', name: 'Arbitrum', native: 'ETH' },
    { id: 'base', name: 'Base', native: 'ETH' },
    { id: 'xrpl', name: 'XRPL', native: 'XRP' },
    { id: 'solana', name: 'Solana', native: 'SOL' }
  ];

  // Mock watchlist data
  const mockWatchlist: TokenData[] = [
    {
      symbol: 'USDC',
      name: 'USD Coin',
      price: '1.00',
      change24h: '0.01',
      volume24h: '2,345,678,901',
      marketCap: '32,456,789,012',
      chain: 'ethereum',
      address: '0xA0b86a33E6441d0f93C0eaa21c130BA65E4A9a2b'
    },
    {
      symbol: 'WETH',
      name: 'Wrapped Ether',
      price: '3,245.67',
      change24h: '-2.34',
      volume24h: '1,234,567,890',
      marketCap: '15,678,901,234',
      chain: 'ethereum',
      address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
    },
    {
      symbol: 'UNI',
      name: 'Uniswap',
      price: '12.45',
      change24h: '5.67',
      volume24h: '456,789,012',
      marketCap: '7,890,123,456',
      chain: 'ethereum',
      address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984'
    }
  ];

  useEffect(() => {
    setWatchlist(mockWatchlist);
    loadRecentOrders();
  }, []);

  const loadRecentOrders = () => {
    // Mock recent orders
    const orders: QuickTradeOrder[] = [
      {
        id: '1',
        pair: 'USDC/ETH',
        type: 'buy',
        amount: '100',
        price: '3245.67',
        total: '0.0308',
        status: 'completed',
        chain: 'ethereum'
      },
      {
        id: '2',
        pair: 'UNI/ETH',
        type: 'sell',
        amount: '50',
        price: '12.45',
        total: '0.1924',
        status: 'pending',
        chain: 'ethereum'
      }
    ];
    setRecentOrders(orders);
  };

  const handleQuickTrade = async (token: TokenData, action: 'buy' | 'sell') => {
    setIsLoading(true);
    try {
      // Get the appropriate swap endpoint based on chain
      const swapEndpoint = token.chain === 'xrpl' ? '/api/xrpl/swap' :
                          token.chain === 'solana' ? '/api/solana/swap' :
                          '/api/ethereum/swap';

      const response = await fetch(swapEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenIn: action === 'buy' ? 'NATIVE' : token.address,
          tokenOut: action === 'buy' ? token.address : 'NATIVE',
          amount: quickTradeAmount,
          slippage: slippage[0],
          chain: token.chain
        })
      });

      if (response.ok) {
        const result = await response.json() as any;
        
        // Add to recent orders
        const newOrder: QuickTradeOrder = {
          id: Date.now().toString(),
          pair: `${token.symbol}/${supportedChains.find(c => c.id === token.chain)?.native || 'ETH'}`,
          type: action,
          amount: quickTradeAmount,
          price: token.price,
          total: (parseFloat(quickTradeAmount) / parseFloat(token.price)).toFixed(6),
          status: 'pending',
          chain: token.chain
        };
        setRecentOrders(prev => [newOrder, ...prev.slice(0, 9)]);

        toast({
          title: "Trade Initiated",
          description: `${action.toUpperCase()} order for ${token.symbol} has been submitted`
        });

        // Redirect to appropriate swap page with pre-filled data
        const swapPath = token.chain === 'xrpl' ? '/xrpl-swap' :
                        token.chain === 'solana' ? '/solana-swap' :
                        '/evm-swap';
        
        // Store trade data for the swap page
        localStorage.setItem('quickTradeData', JSON.stringify({
          tokenAddress: token.address,
          amount: quickTradeAmount,
          action: action,
          slippage: slippage[0]
        }));
        
        window.location.href = swapPath;
      } else {
        throw new Error('Trade failed');
      }
    } catch (error) {
      toast({
        title: "Trade Error",
        description: "Failed to initiate trade. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const refreshWatchlist = async () => {
    setIsLoading(true);
    try {
      // In production, fetch real market data
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update prices with mock data
      const updatedWatchlist = watchlist.map(token => ({
        ...token,
        price: (parseFloat(token.price) * (0.98 + Math.random() * 0.04)).toFixed(2),
        change24h: (Math.random() * 20 - 10).toFixed(2)
      }));
      
      setWatchlist(updatedWatchlist);
      
      toast({
        title: "Watchlist Updated",
        description: "Market data has been refreshed"
      });
    } catch (error) {
      toast({
        title: "Update Error",
        description: "Failed to refresh market data",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Trading Desk</h1>
            <p className="text-muted-foreground">Advanced trading interface with quick trade execution</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Trade Panel */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Quick Trade
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Chain</label>
                <Select value={selectedChain} onValueChange={setSelectedChain}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {supportedChains.map(chain => (
                      <SelectItem key={chain.id} value={chain.id}>
                        {chain.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Amount (USD)</label>
                <Input
                  value={quickTradeAmount}
                  onChange={(e) => setQuickTradeAmount(e.target.value)}
                  placeholder="100"
                  type="number"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Slippage: {slippage[0]}%</label>
                <Slider
                  value={slippage}
                  onValueChange={setSlippage}
                  max={10}
                  min={0.1}
                  step={0.1}
                  className="mt-2"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>0.1%</span>
                  <span>10%</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setSlippage([0.5])}
                >
                  0.5%
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setSlippage([1.0])}
                >
                  1%
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setSlippage([2.0])}
                >
                  2%
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Orders */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Recent Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentOrders.length > 0 ? (
                  recentOrders.slice(0, 5).map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-2 bg-muted rounded">
                      <div>
                        <p className="text-sm font-medium">{order.pair}</p>
                        <p className="text-xs text-muted-foreground">
                          {order.type.toUpperCase()} ${order.amount}
                        </p>
                      </div>
                      <Badge
                        variant={
                          order.status === 'completed' ? 'default' :
                          order.status === 'pending' ? 'secondary' :
                          'destructive'
                        }
                      >
                        {order.status}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground py-4">No recent trades</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Market Data & Watchlist */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Watchlist</CardTitle>
                <Button variant="outline" size="sm" onClick={refreshWatchlist} disabled={isLoading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {watchlist.map((token, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-semibold">{token.symbol}</p>
                        <p className="text-sm text-muted-foreground">{token.name}</p>
                        <Badge variant="outline" className="text-xs mt-1">
                          {token.chain.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="font-semibold">${token.price}</p>
                      <div className={`text-sm flex items-center gap-1 ${
                        parseFloat(token.change24h) >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {parseFloat(token.change24h) >= 0 ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        {token.change24h}%
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => handleQuickTrade(token, 'buy')}
                        disabled={isLoading}
                      >
                        Buy
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleQuickTrade(token, 'sell')}
                        disabled={isLoading}
                      >
                        Sell
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {watchlist.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Your watchlist is empty</p>
                  <Button className="mt-4" variant="outline">
                    Add Tokens to Watchlist
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Market Overview */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Market Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">$2.1T</p>
                  <p className="text-sm text-muted-foreground">Total Market Cap</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">$89.2B</p>
                  <p className="text-sm text-muted-foreground">24h Volume</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-600">47.3%</p>
                  <p className="text-sm text-muted-foreground">BTC Dominance</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-orange-600">16.8%</p>
                  <p className="text-sm text-muted-foreground">ETH Dominance</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
