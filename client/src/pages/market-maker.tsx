import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  TrendingUp, 
  Wallet, 
  Activity,
  Settings,
  Play,
  Pause,
  RefreshCw,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle,
  DollarSign,
  BarChart3,
  Users,
  Zap,
  Shield,
  Clock
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

interface MarketMakerWallet {
  id: string;
  address: string;
  chain: 'XRP' | 'ETH' | 'SOL' | 'BSC' | 'MATIC' | 'BASE' | 'ARB' | 'OP' | 'BTC';
  balance: number;
  active: boolean;
  orders: number;
  volume24h: number;
  profit24h: number;
  rdlBalance?: number;
  nativeBalance?: number;
}

interface MarketMakerConfig {
  pair: string;
  spreadPercentage: number;
  orderSize: number;
  maxOrders: number;
  refreshInterval: number;
  enabled: boolean;
  strategy: 'aggressive' | 'balanced' | 'conservative';
}

export default function MarketMaker() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isRunning, setIsRunning] = useState(false);
  const [selectedWallets, setSelectedWallets] = useState<string[]>([]);
  const [walletCount, setWalletCount] = useState(10);
  const [selectedChain, setSelectedChain] = useState('xrpl');
  const [config, setConfig] = useState<MarketMakerConfig>({
    pair: 'RDL/XRP',
    spreadPercentage: 0.5,
    orderSize: 100,
    maxOrders: 10,
    refreshInterval: 30,
    enabled: false,
    strategy: 'balanced'
  });

  // Multichain support
  const chains = [
    { id: 'xrpl', name: 'XRPL', symbol: 'XRP', color: 'bg-blue-400', pairs: ['RDL/XRP', 'XRP/USD'] },
    { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', color: 'bg-gray-700', pairs: ['RDL/ETH', 'ETH/USDT', 'ETH/USDC'] },
    { id: 'solana', name: 'Solana', symbol: 'SOL', color: 'bg-purple-500', pairs: ['RDL/SOL', 'SOL/USDT', 'SOL/USDC'] },
    { id: 'bsc', name: 'BSC', symbol: 'BNB', color: 'bg-yellow-500', pairs: ['RDL/BNB', 'BNB/USDT', 'BNB/BUSD'] },
    { id: 'polygon', name: 'Polygon', symbol: 'MATIC', color: 'bg-purple-600', pairs: ['RDL/MATIC', 'MATIC/USDT', 'MATIC/USDC'] },
    { id: 'base', name: 'Base', symbol: 'ETH', color: 'bg-blue-600', pairs: ['RDL/ETH', 'ETH/USDC'] },
    { id: 'arbitrum', name: 'Arbitrum', symbol: 'ETH', color: 'bg-blue-500', pairs: ['RDL/ETH', 'ETH/USDT', 'ETH/USDC'] },
    { id: 'optimism', name: 'Optimism', symbol: 'ETH', color: 'bg-red-500', pairs: ['RDL/ETH', 'ETH/USDT', 'ETH/USDC'] }
  ];

  const selectedChainData = chains.find(c => c.id === selectedChain) || chains[0];

  // Fetch market maker wallets
  const { data: wallets = [], refetch: refetchWallets } = useQuery<MarketMakerWallet[]>({
    queryKey: ['/api/market-maker/wallets'],
    refetchInterval: isRunning ? 5000 : false
  });

  // Fetch market maker stats
  const { data: stats = {} } = useQuery({
    queryKey: ['/api/market-maker/stats'],
    refetchInterval: isRunning ? 10000 : false
  });

  // Create wallets mutation
  const createWalletsMutation = useMutation({
    mutationFn: async (count: number) => {
      const response = await fetch('/api/market-maker/create-wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count })
      });
      if (!response.ok) throw new Error('Failed to create wallets');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Wallets Created',
        description: `Successfully created ${walletCount} market maker wallets`
      });
      refetchWallets();
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create wallets',
        variant: 'destructive'
      });
    }
  });

  // Start/Stop market maker
  const toggleMarketMaker = useMutation({
    mutationFn: async (start: boolean) => {
      const response = await fetch('/api/market-maker/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: start ? 'start' : 'stop',
          config,
          wallets: selectedWallets
        })
      });
      if (!response.ok) throw new Error('Failed to toggle market maker');
      return response.json();
    },
    onSuccess: (_, start) => {
      setIsRunning(start);
      toast({
        title: start ? 'Market Maker Started' : 'Market Maker Stopped',
        description: start ? 'Market making operations are now active' : 'Market making operations have been stopped'
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to toggle market maker',
        variant: 'destructive'
      });
    }
  });

  // Update configuration
  const updateConfigMutation = useMutation({
    mutationFn: async (newConfig: MarketMakerConfig) => {
      const response = await fetch('/api/market-maker/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig)
      });
      if (!response.ok) throw new Error('Failed to update configuration');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Configuration Updated',
        description: 'Market maker settings have been updated'
      });
    }
  });

  const handleCreateWallets = () => {
    if (walletCount > 100) {
      toast({
        title: 'Invalid Input',
        description: 'Maximum 100 wallets allowed',
        variant: 'destructive'
      });
      return;
    }
    createWalletsMutation.mutate(walletCount);
  };

  const handleToggleWallet = (walletId: string) => {
    setSelectedWallets(prev => 
      prev.includes(walletId) 
        ? prev.filter(id => id !== walletId)
        : [...prev, walletId]
    );
  };

  const handleSelectAllWallets = () => {
    if (selectedWallets.length === wallets.length) {
      setSelectedWallets([]);
    } else {
      setSelectedWallets(wallets.map((w: MarketMakerWallet) => w.id));
    }
  };

  const mockWallets: MarketMakerWallet[] = Array.from({ length: 5 }, (_, i) => ({
    id: `wallet-${i + 1}`,
    address: `r${Math.random().toString(36).substring(2, 15)}...`,
    chain: ['XRP', 'ETH', 'SOL', 'BSC'][i % 4] as any,
    balance: Math.floor(Math.random() * 10000),
    active: i < 3,
    orders: Math.floor(Math.random() * 20),
    volume24h: Math.floor(Math.random() * 50000),
    profit24h: Math.floor(Math.random() * 1000) - 200
  }));

  const displayWallets: MarketMakerWallet[] = wallets.length > 0 ? wallets : mockWallets;

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
          Market Maker Tool
        </h1>
        <p className="text-muted-foreground">Automated market making with up to 100 wallets</p>
      </div>

      {/* Status Bar */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {isRunning ? (
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                ) : (
                  <div className="w-3 h-3 bg-gray-400 rounded-full" />
                )}
                <span className="font-semibold">
                  {isRunning ? 'Market Maker Active' : 'Market Maker Inactive'}
                </span>
              </div>
              <Badge variant="outline">
                {selectedWallets.length} / {displayWallets.length} wallets selected
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => toggleMarketMaker.mutate(!isRunning)}
                disabled={selectedWallets.length === 0}
                variant={isRunning ? 'destructive' : 'default'}
              >
                {isRunning ? (
                  <>
                    <Pause className="w-4 h-4 mr-2" />
                    Stop
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Start
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={() => refetchWallets()}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Wallet className="w-4 h-4 text-muted-foreground" />
              <Badge variant="outline">Total</Badge>
            </div>
            <div className="text-2xl font-bold">{displayWallets.length}</div>
            <div className="text-xs text-muted-foreground">Active Wallets</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Activity className="w-4 h-4 text-muted-foreground" />
              <Badge variant="outline">24h</Badge>
            </div>
            <div className="text-2xl font-bold">
              {(stats as any)?.totalOrders || displayWallets.reduce((sum: number, w: MarketMakerWallet) => sum + w.orders, 0)}
            </div>
            <div className="text-xs text-muted-foreground">Open Orders</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <Badge variant="outline">24h</Badge>
            </div>
            <div className="text-2xl font-bold">
              ${(stats as any)?.volume24h || displayWallets.reduce((sum: number, w: MarketMakerWallet) => sum + w.volume24h, 0).toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">Trading Volume</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              <Badge variant="outline">24h</Badge>
            </div>
            <div className={`text-2xl font-bold ${
              displayWallets.reduce((sum: number, w: MarketMakerWallet) => sum + w.profit24h, 0) >= 0 ? 'text-green-500' : 'text-red-500'
            }`}>
              ${Math.abs((stats as any)?.profit24h || displayWallets.reduce((sum: number, w: MarketMakerWallet) => sum + w.profit24h, 0)).toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">Total Profit/Loss</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="wallets">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="wallets">Wallets</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="wallets" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Market Maker Wallets</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleSelectAllWallets}>
                    {selectedWallets.length === displayWallets.length ? 'Deselect All' : 'Select All'}
                  </Button>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={walletCount}
                      onChange={(e) => setWalletCount(parseInt(e.target.value) || 0)}
                      className="w-20"
                      max={100}
                      min={1}
                    />
                    <Button onClick={handleCreateWallets} disabled={createWalletsMutation.isPending}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Wallets
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {displayWallets.map((wallet) => (
                  <div key={wallet.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedWallets.includes(wallet.id)}
                        onChange={() => handleToggleWallet(wallet.id)}
                        className="rounded"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">{wallet.address}</span>
                          <Badge variant="outline">{wallet.chain}</Badge>
                          {wallet.active && <Badge className="bg-green-500 text-white">Active</Badge>}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                          <span>Balance: ${wallet.balance.toLocaleString()}</span>
                          <span>Orders: {wallet.orders}</span>
                          <span>Volume: ${wallet.volume24h.toLocaleString()}</span>
                          <span className={wallet.profit24h >= 0 ? 'text-green-500' : 'text-red-500'}>
                            P/L: ${wallet.profit24h >= 0 ? '+' : ''}{wallet.profit24h}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="configuration" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Market Making Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Trading Pair</Label>
                  <Select value={config.pair} onValueChange={(value) => setConfig({...config, pair: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RDL/XRP">RDL/XRP</SelectItem>
                      <SelectItem value="RDL/ETH">RDL/ETH</SelectItem>
                      <SelectItem value="RDL/USDT">RDL/USDT</SelectItem>
                      <SelectItem value="XRP/USDT">XRP/USDT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Strategy</Label>
                  <Select value={config.strategy} onValueChange={(value: any) => setConfig({...config, strategy: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aggressive">Aggressive (High Risk/Reward)</SelectItem>
                      <SelectItem value="balanced">Balanced (Medium Risk/Reward)</SelectItem>
                      <SelectItem value="conservative">Conservative (Low Risk/Reward)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Spread Percentage: {config.spreadPercentage}%</Label>
                  <Slider
                    value={[config.spreadPercentage]}
                    onValueChange={([value]) => setConfig({...config, spreadPercentage: value})}
                    max={5}
                    min={0.1}
                    step={0.1}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Order Size (RDL)</Label>
                  <Input
                    type="number"
                    value={config.orderSize}
                    onChange={(e) => setConfig({...config, orderSize: parseInt(e.target.value) || 0})}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Max Orders per Wallet</Label>
                  <Input
                    type="number"
                    value={config.maxOrders}
                    onChange={(e) => setConfig({...config, maxOrders: parseInt(e.target.value) || 0})}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Refresh Interval (seconds)</Label>
                  <Input
                    type="number"
                    value={config.refreshInterval}
                    onChange={(e) => setConfig({...config, refreshInterval: parseInt(e.target.value) || 0})}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <Label>Enable Auto-Rebalancing</Label>
                  <p className="text-xs text-muted-foreground">Automatically rebalance funds between wallets</p>
                </div>
                <Switch />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <Label>Enable Stop-Loss</Label>
                  <p className="text-xs text-muted-foreground">Stop trading if losses exceed threshold</p>
                </div>
                <Switch />
              </div>

              <Button 
                className="w-full" 
                onClick={() => updateConfigMutation.mutate(config)}
                disabled={updateConfigMutation.isPending}
              >
                Save Configuration
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Trades (24h)</span>
                    <span className="font-semibold">{(stats as any)?.totalTrades || '1,234'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Success Rate</span>
                    <span className="font-semibold text-green-500">{(stats as any)?.successRate || '92.5%'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Average Spread Captured</span>
                    <span className="font-semibold">{(stats as any)?.avgSpread || '0.45%'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Fees Paid</span>
                    <span className="font-semibold">${(stats as any)?.totalFees || '234.56'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Net Profit (24h)</span>
                    <span className="font-semibold text-green-500">+${(stats as any)?.netProfit || '1,234.56'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Risk Management</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Max Drawdown</span>
                    <span className="font-semibold">{(stats as any)?.maxDrawdown || '-2.3%'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Risk Score</span>
                    <Badge className="bg-yellow-500 text-white">Medium</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Exposure</span>
                    <span className="font-semibold">${(stats as any)?.exposure || '45,678'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Liquidity Available</span>
                    <span className="font-semibold">${(stats as any)?.liquidity || '234,567'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Health Score</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="w-3/4 h-full bg-green-500" />
                      </div>
                      <span className="text-sm font-semibold">75%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
