import React, { useState, useEffect } from 'react';
import { Copy, Users, TrendingUp, Star, Eye, Play, Pause, Settings, Wallet, CheckCircle, AlertCircle, Info, Shield, Zap, HelpCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useSession } from '@/utils/sessionManager';
import { SessionRenewalModal } from '@/components/SessionRenewalModal';

interface Trader {
  id: string;
  username: string;
  displayName: string;
  verified: boolean;
  followers: number;
  winRate: number;
  totalTrades: number;
  avgReturn: string;
  totalPnl: string;
  chains: string[];
  lastActive: string;
  copiers: number;
  minCopyAmount: string;
  description: string;
  avatar?: string;
}

interface CopyPosition {
  id: string;
  traderId: string;
  traderName: string;
  pair: string;
  type: 'buy' | 'sell';
  amount: string;
  entryPrice: string;
  currentPrice: string;
  pnl: string;
  pnlPercent: string;
  chain: string;
  status: 'active' | 'closed';
  openTime: string;
}

interface WalletStatus {
  isConnected: boolean;
  address?: string;
  chain?: string;
  balance?: string;
  isCompatible: boolean;
  supportedChains: string[];
  readyForCopyTrading: boolean;
  missingRequirements: string[];
}

interface CopyTradingSetup {
  hasApiKeys: boolean;
  hasRiskSettings: boolean;
  hasFundingSource: boolean;
  hasAgreedToTerms: boolean;
  setupComplete: boolean;
}

export default function CopyTradingPage() {
  const session = useSession();
  const [selectedChains, setSelectedChains] = useState<string[]>(['ethereum']);
  const [copyAmount, setCopyAmount] = useState([1000]);
  const [riskLevel, setRiskLevel] = useState([50]);
  const [autoCopyEnabled, setAutoCopyEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showWalletSetup, setShowWalletSetup] = useState(false);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [setupStep, setSetupStep] = useState(1);
  const [topTraders, setTopTraders] = useState<Trader[]>([]);
  const [myPositions, setMyPositions] = useState<CopyPosition[]>([]);
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Check if session needs renewal
  useEffect(() => {
    if ((session as any).needsRenewal) {
      setShowRenewalModal(true);
    } else {
      setShowRenewalModal(false);
    }
  }, [(session as any).needsRenewal]);

  // Fetch wallet status with TanStack Query
  const { data: walletStatus, isLoading: walletLoading } = useQuery({
    queryKey: ['wallet-status-copy-trading'],
    queryFn: async (): Promise<WalletStatus> => {
      const response = await fetch('/api/wallet/status');
      const data = await response.json() as any;
      return data.status || {
        isConnected: false,
        isCompatible: false,
        supportedChains: ['ethereum', 'bsc', 'polygon', 'arbitrum', 'base', 'solana'],
        readyForCopyTrading: false,
        missingRequirements: ['wallet_connection', 'api_setup', 'risk_settings']
      };
    },
    refetchInterval: 5000 // Refresh every 5 seconds
  });

  // Fetch copy trading setup status
  const { data: setupStatus } = useQuery({
    queryKey: ['copy-trading-setup'],
    queryFn: async (): Promise<CopyTradingSetup> => {
      const response = await fetch('/api/copy-trading/setup-status', {
        headers: {
          'Authorization': `Bearer ${session.sessionToken || ''}`
        }
      });
      const data = await response.json() as any;
      return data.setup || {
        hasApiKeys: false,
        hasRiskSettings: false,
        hasFundingSource: false,
        hasAgreedToTerms: false,
        setupComplete: false
      };
    },
    enabled: !!session.sessionToken
  });

  // Fetch top traders with TanStack Query
  const { data: tradersData, isLoading: tradersLoading } = useQuery({
    queryKey: ['top-traders', selectedChains],
    queryFn: async () => {
      const response = await fetch(`/api/copy-trading/traders?chains=${selectedChains.join(',')}`);
      const data = await response.json() as any;
      return data;
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Fetch user copy positions
  const { data: positionsData } = useQuery({
    queryKey: ['copy-trading-positions'],
    queryFn: async () => {
      const response = await fetch('/api/copy-trading/positions', {
        headers: {
          'Authorization': `Bearer ${session.sessionToken || ''}`
        }
      });
      const data = await response.json() as any;
      return data;
    },
    enabled: !!session.sessionToken,
    refetchInterval: 10000 // Refresh every 10 seconds
  });

  // Sync state with query data
  useEffect(() => {
    if (tradersData?.traders) {
      setTopTraders(tradersData.traders);
    }
  }, [tradersData]);

  useEffect(() => {
    if (positionsData?.positions) {
      setMyPositions(positionsData.positions);
    }
  }, [positionsData]);

  // Wallet connection mutation
  const connectWalletMutation = useMutation({
    mutationFn: async (chainId: string) => {
      const response = await apiRequest('/api/wallet/connect', {
        method: 'POST',
        body: JSON.stringify({ chainId })
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Wallet Connected",
        description: "Your wallet has been successfully connected"
      });
      queryClient.invalidateQueries({ queryKey: ['wallet-status-copy-trading'] });
    },
    onError: () => {
      toast({
        title: "Connection Failed",
        description: "Failed to connect wallet. Please try again.",
        variant: "destructive"
      });
    }
  });

  const supportedChains = [
    { id: 'ethereum', name: 'Ethereum', icon: '⟠' },
    { id: 'bsc', name: 'BSC', icon: '⟨' },
    { id: 'polygon', name: 'Polygon', icon: '⬟' },
    { id: 'arbitrum', name: 'Arbitrum', icon: '🔵' },
    { id: 'base', name: 'Base', icon: '🔷' },
    { id: 'xrpl', name: 'XRPL', icon: '◈' },
    { id: 'solana', name: 'Solana', icon: '◉' }
  ];

  // Transform API data

  // Helper functions
  const getWalletStatusColor = () => {
    if (!walletStatus?.isConnected) return 'text-red-600';
    if (!walletStatus?.readyForCopyTrading) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getWalletStatusText = () => {
    if (walletLoading) return 'Checking wallet...';
    if (!walletStatus?.isConnected) return 'Wallet not connected';
    if (!walletStatus?.isCompatible) return 'Wallet incompatible';
    if (!walletStatus?.readyForCopyTrading) return 'Setup incomplete';
    return 'Ready for copy trading';
  };

  const getSetupProgress = () => {
    if (!setupStatus) return 0;
    const steps = [
      setupStatus.hasApiKeys,
      setupStatus.hasRiskSettings,
      setupStatus.hasFundingSource,
      setupStatus.hasAgreedToTerms
    ];
    return (steps.filter(Boolean).length / steps.length) * 100;
  };

  const handleStartSetup = () => {
    if (!walletStatus?.isConnected) {
      setShowWalletSetup(true);
    } else {
      setShowSetupWizard(true);
      setSetupStep(1);
    }
  };

  const handleConnectWallet = (chainId: string) => {
    connectWalletMutation.mutate(chainId);
  };

  // Show setup wizard if wallet is connected but setup is incomplete
  useEffect(() => {
    if (walletStatus?.isConnected && setupStatus && !setupStatus.setupComplete) {
      const hasShownWizard = localStorage.getItem('copy-trading-wizard-shown');
      if (!hasShownWizard) {
        setShowSetupWizard(true);
        localStorage.setItem('copy-trading-wizard-shown', 'true');
      }
    }
  }, [walletStatus, setupStatus]);

  // Mock data for top traders
  const mockTraders: Trader[] = [
    {
      id: '1',
      username: 'cryptowizard',
      displayName: 'Crypto Wizard',
      verified: true,
      followers: 15420,
      winRate: 78.5,
      totalTrades: 1247,
      avgReturn: '23.4%',
      totalPnl: '+$234,567',
      chains: ['ethereum', 'bsc', 'polygon'],
      lastActive: '2 hours ago',
      copiers: 892,
      minCopyAmount: '100',
      description: 'Professional DeFi trader with 5+ years experience. Focus on blue-chip tokens and yield farming strategies.'
    },
    {
      id: '2',
      username: 'defi_master',
      displayName: 'DeFi Master',
      verified: true,
      followers: 12830,
      winRate: 71.2,
      totalTrades: 2156,
      avgReturn: '18.7%',
      totalPnl: '+$189,234',
      chains: ['ethereum', 'arbitrum', 'base'],
      lastActive: '1 hour ago',
      copiers: 743,
      minCopyAmount: '250',
      description: 'Specialized in Layer 2 trading and MEV strategies. Conservative risk management approach.'
    },
    {
      id: '3',
      username: 'sol_sniper',
      displayName: 'Sol Sniper',
      verified: false,
      followers: 8945,
      winRate: 65.8,
      totalTrades: 892,
      avgReturn: '31.2%',
      totalPnl: '+$156,789',
      chains: ['solana'],
      lastActive: '30 minutes ago',
      copiers: 456,
      minCopyAmount: '50',
      description: 'Solana ecosystem specialist. Early token detection and momentum trading.'
    }
  ];

  // Mock copy positions
  const mockPositions: CopyPosition[] = [
    {
      id: '1',
      traderId: '1',
      traderName: 'Crypto Wizard',
      pair: 'USDC/ETH',
      type: 'buy',
      amount: '1000',
      entryPrice: '3245.67',
      currentPrice: '3289.45',
      pnl: '+43.78',
      pnlPercent: '+4.38%',
      chain: 'ethereum',
      status: 'active',
      openTime: '2 hours ago'
    },
    {
      id: '2',
      traderId: '2',
      traderName: 'DeFi Master',
      pair: 'ARB/USDC',
      type: 'buy',
      amount: '500',
      entryPrice: '1.23',
      currentPrice: '1.18',
      pnl: '-20.34',
      pnlPercent: '-4.07%',
      chain: 'arbitrum',
      status: 'active',
      openTime: '4 hours ago'
    }
  ];

  useEffect(() => {
    setTopTraders(mockTraders);
    setMyPositions(mockPositions);
  }, []);

  const handleCopyTrader = async (trader: Trader) => {
    setIsLoading(true);
    try {
      // In production, this would set up copy trading for the selected trader
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast({
        title: "Copy Trading Started",
        description: `Now copying trades from ${trader.displayName}`
      });

      // Mock adding a new position
      const newPosition: CopyPosition = {
        id: Date.now().toString(),
        traderId: trader.id,
        traderName: trader.displayName,
        pair: 'MOCK/USDC',
        type: 'buy',
        amount: copyAmount[0].toString(),
        entryPrice: '1.00',
        currentPrice: '1.00',
        pnl: '0.00',
        pnlPercent: '0.00%',
        chain: trader.chains[0],
        status: 'active',
        openTime: 'Just now'
      };
      
      setMyPositions(prev => [newPosition, ...prev]);
      
    } catch (error) {
      toast({
        title: "Copy Error",
        description: "Failed to start copy trading",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopCopying = async (positionId: string) => {
    try {
      // In production, this would close the copy position
      setMyPositions(prev => prev.filter(p => p.id !== positionId));
      
      toast({
        title: "Position Closed",
        description: "Copy trading position has been closed"
      });
    } catch (error) {
      toast({
        title: "Close Error",
        description: "Failed to close position",
        variant: "destructive"
      });
    }
  };

  const getRiskLevelColor = (level: number) => {
    if (level < 30) return 'text-green-600';
    if (level < 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getRiskLevelText = (level: number) => {
    if (level < 30) return 'Conservative';
    if (level < 70) return 'Moderate';
    return 'Aggressive';
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-600 rounded-lg flex items-center justify-center">
            <Copy className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Copy Trading Desk</h1>
            <p className="text-muted-foreground">Follow and copy successful traders across all supported chains</p>
          </div>
        </div>
      </div>

      {/* Wallet Status and Setup Section */}
      <TooltipProvider>
        <Card className="mb-6" data-testid="wallet-status-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    walletStatus?.readyForCopyTrading ? 'bg-green-500' : 
                    walletStatus?.isConnected ? 'bg-yellow-500' : 'bg-red-500'
                  }`} data-testid="wallet-status-indicator" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold" data-testid="wallet-status-text">
                        {getWalletStatusText()}
                      </span>
                      <Tooltip>
                        <TooltipTrigger>
                          <HelpCircle className="h-4 w-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="max-w-xs">
                            <p className="font-medium mb-2">Wallet Status Guide:</p>
                            <ul className="space-y-1 text-sm">
                              <li>🔴 Not Connected: Connect your wallet first</li>
                              <li>🟡 Setup Incomplete: Complete copy trading setup</li>
                              <li>🟢 Ready: Start copying traders</li>
                            </ul>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    {walletStatus?.isConnected && (
                      <div className="text-sm text-muted-foreground">
                        <span data-testid="wallet-address">
                          {walletStatus.address?.slice(0, 8)}...{walletStatus.address?.slice(-6)}
                        </span>
                        {walletStatus.chain && (
                          <Badge variant="outline" className="ml-2" data-testid="wallet-chain">
                            {supportedChains.find(c => c.id === walletStatus.chain)?.name}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Setup Progress */}
                {walletStatus?.isConnected && setupStatus && !setupStatus.setupComplete && (
                  <div className="flex items-center gap-3" data-testid="setup-progress">
                    <div className="text-sm">
                      <span className="font-medium">Setup Progress:</span>
                      <span className="ml-2">{Math.round(getSetupProgress())}%</span>
                    </div>
                    <div className="w-24 h-2 bg-gray-200 rounded-full">
                      <div 
                        className="h-2 bg-blue-500 rounded-full transition-all duration-300"
                        style={{ width: `${getSetupProgress()}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {!walletStatus?.isConnected ? (
                  <Button 
                    onClick={() => setShowWalletSetup(true)}
                    className="bg-blue-600 hover:bg-blue-700"
                    data-testid="connect-wallet-button"
                  >
                    <Wallet className="h-4 w-4 mr-2" />
                    Connect Wallet
                  </Button>
                ) : !setupStatus?.setupComplete ? (
                  <Button 
                    onClick={handleStartSetup}
                    variant="outline"
                    data-testid="complete-setup-button"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Complete Setup
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="text-green-600 font-medium" data-testid="ready-indicator">
                      Ready to Copy Trade
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Requirements Status */}
            {walletStatus?.isConnected && !walletStatus?.readyForCopyTrading && (
              <div className="mt-4 pt-4 border-t" data-testid="requirements-status">
                <div className="flex items-center gap-2 mb-3">
                  <Info className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-blue-900 dark:text-blue-100">Setup Requirements:</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { key: 'hasApiKeys', label: 'API Configuration', icon: Shield },
                    { key: 'hasRiskSettings', label: 'Risk Management', icon: TrendingUp },
                    { key: 'hasFundingSource', label: 'Funding Source', icon: Wallet },
                    { key: 'hasAgreedToTerms', label: 'Terms Agreement', icon: CheckCircle }
                  ].map(({ key, label, icon: Icon }) => {
                    const isComplete = setupStatus?.[key as keyof CopyTradingSetup];
                    return (
                      <div 
                        key={key}
                        className={`flex items-center gap-2 p-2 rounded ${
                          isComplete ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-800'
                        }`}
                        data-testid={`requirement-${key}`}
                      >
                        <Icon className={`h-4 w-4 ${isComplete ? 'text-green-600' : 'text-gray-400'}`} />
                        <span className={`text-sm ${isComplete ? 'text-green-700 dark:text-green-300' : 'text-muted-foreground'}`}>
                          {label}
                        </span>
                        {isComplete && <CheckCircle className="h-3 w-3 text-green-500 ml-auto" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </TooltipProvider>

      <Tabs defaultValue="discover" className="space-y-6" data-testid="copy-trading-tabs">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="discover">Discover Traders</TabsTrigger>
          <TabsTrigger value="positions">My Positions</TabsTrigger>
          <TabsTrigger value="settings">Copy Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="discover">
          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-medium">Chains</label>
                  <Select value={selectedChains[0]} onValueChange={(value) => setSelectedChains([value])}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select chain" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Chains</SelectItem>
                      {supportedChains.map(chain => (
                        <SelectItem key={chain.id} value={chain.id}>
                          {chain.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Min Win Rate</label>
                  <Select defaultValue="60">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="50">50%+</SelectItem>
                      <SelectItem value="60">60%+</SelectItem>
                      <SelectItem value="70">70%+</SelectItem>
                      <SelectItem value="80">80%+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Min Followers</label>
                  <Select defaultValue="1000">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="100">100+</SelectItem>
                      <SelectItem value="1000">1,000+</SelectItem>
                      <SelectItem value="5000">5,000+</SelectItem>
                      <SelectItem value="10000">10,000+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Sort By</label>
                  <Select defaultValue="winrate">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="winrate">Win Rate</SelectItem>
                      <SelectItem value="followers">Followers</SelectItem>
                      <SelectItem value="pnl">Total PnL</SelectItem>
                      <SelectItem value="trades">Total Trades</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Top Traders */}
          <div className="space-y-4">
            {topTraders.map((trader) => (
              <Card key={trader.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback>
                          {trader.displayName.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg">{trader.displayName}</h3>
                          {trader.verified && <Star className="h-4 w-4 text-yellow-500" />}
                        </div>
                        <p className="text-sm text-muted-foreground">@{trader.username}</p>
                        <p className="text-sm mt-2 max-w-md">{trader.description}</p>
                        
                        {/* Supported chains */}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {trader.chains.map(chain => (
                            <Badge key={chain} variant="outline" className="text-xs">
                              {chain.toUpperCase()}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-2xl font-bold text-green-600">{trader.winRate}%</p>
                          <p className="text-xs text-muted-foreground">Win Rate</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{trader.totalPnl}</p>
                          <p className="text-xs text-muted-foreground">Total PnL</p>
                        </div>
                        <div>
                          <p className="text-lg font-semibold">{trader.followers.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Followers</p>
                        </div>
                        <div>
                          <p className="text-lg font-semibold">{trader.copiers}</p>
                          <p className="text-xs text-muted-foreground">Copiers</p>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-2" />
                          View Profile
                        </Button>
                        <Button 
                          size="sm"
                          onClick={() => handleCopyTrader(trader)}
                          disabled={isLoading}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Trader
                        </Button>
                      </div>
                      
                      <p className="text-xs text-muted-foreground mt-2">
                        Min: ${trader.minCopyAmount} • Last active: {trader.lastActive}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="positions">
          <div className="space-y-4">
            {myPositions.length > 0 ? (
              myPositions.map((position) => (
                <Card key={position.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="font-semibold">{position.pair}</p>
                          <p className="text-sm text-muted-foreground">
                            Copying {position.traderName} • {position.openTime}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant={position.type === 'buy' ? 'default' : 'destructive'}>
                              {position.type.toUpperCase()}
                            </Badge>
                            <Badge variant="outline">{position.chain.toUpperCase()}</Badge>
                          </div>
                        </div>
                      </div>

                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Amount</p>
                        <p className="font-semibold">${position.amount}</p>
                      </div>

                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Entry Price</p>
                        <p className="font-semibold">${position.entryPrice}</p>
                      </div>

                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Current Price</p>
                        <p className="font-semibold">${position.currentPrice}</p>
                      </div>

                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">PnL</p>
                        <p className={`font-semibold ${
                          parseFloat(position.pnl) >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          ${position.pnl} ({position.pnlPercent})
                        </p>
                      </div>

                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => handleStopCopying(position.id)}
                      >
                        <Pause className="h-4 w-4 mr-2" />
                        Close
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">No active copy positions</p>
                  <Button className="mt-4">Start Copy Trading</Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="settings">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Copy Trading Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <label className="text-sm font-medium">Default Copy Amount: ${copyAmount[0]}</label>
                  <Slider
                    value={copyAmount}
                    onValueChange={setCopyAmount}
                    max={10000}
                    min={50}
                    step={50}
                    className="mt-2"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>$50</span>
                    <span>$10,000</span>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">
                    Risk Level: {getRiskLevelText(riskLevel[0])} ({riskLevel[0]}%)
                  </label>
                  <Slider
                    value={riskLevel}
                    onValueChange={setRiskLevel}
                    max={100}
                    min={0}
                    step={1}
                    className="mt-2"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span className="text-green-600">Conservative</span>
                    <span className="text-yellow-600">Moderate</span>
                    <span className="text-red-600">Aggressive</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Auto Copy</p>
                    <p className="text-sm text-muted-foreground">
                      Automatically copy trades from followed traders
                    </p>
                  </div>
                  <Switch
                    checked={autoCopyEnabled}
                    onCheckedChange={setAutoCopyEnabled}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Preferred Chains</label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {supportedChains.map(chain => (
                      <label key={chain.id} className="flex items-center space-x-2">
                        <input 
                          type="checkbox" 
                          defaultChecked={selectedChains.includes(chain.id)}
                        />
                        <span className="text-sm">{chain.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Risk Management</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Max Daily Loss</label>
                  <Input placeholder="$500" />
                </div>

                <div>
                  <label className="text-sm font-medium">Max Position Size</label>
                  <Input placeholder="$2000" />
                </div>

                <div>
                  <label className="text-sm font-medium">Stop Loss %</label>
                  <Input placeholder="10" />
                </div>

                <div>
                  <label className="text-sm font-medium">Take Profit %</label>
                  <Input placeholder="20" />
                </div>

                <Button className="w-full">
                  <Settings className="h-4 w-4 mr-2" />
                  Save Settings
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Wallet Setup Dialog */}
      <Dialog open={showWalletSetup} onOpenChange={setShowWalletSetup}>
        <DialogContent className="max-w-md" data-testid="wallet-setup-dialog">
          <DialogHeader>
            <DialogTitle data-testid="wallet-setup-title">Connect Your Wallet</DialogTitle>
            <DialogDescription data-testid="wallet-setup-description">
              Choose your preferred blockchain to start copy trading
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert data-testid="wallet-security-info">
              <Shield className="h-4 w-4" />
              <AlertDescription>
                Your wallet remains fully under your control. We only read transaction data for copying trades.
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <h4 className="font-medium">Select Blockchain:</h4>
              {supportedChains.map((chain) => (
                <button
                  key={chain.id}
                  onClick={() => handleConnectWallet(chain.id)}
                  disabled={connectWalletMutation.isPending}
                  className="w-full p-3 text-left border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                  data-testid={`connect-${chain.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{chain.icon}</span>
                      <div>
                        <p className="font-medium">{chain.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Connect to {chain.name} network
                        </p>
                      </div>
                    </div>
                    {connectWalletMutation.isPending ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="text-xs text-muted-foreground" data-testid="compatibility-info">
              <p className="font-medium mb-1">Supported Wallets:</p>
              <p>MetaMask, WalletConnect, Phantom (Solana), and more</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Copy Trading Setup Wizard */}
      <Dialog open={showSetupWizard} onOpenChange={setShowSetupWizard}>
        <DialogContent className="max-w-2xl" data-testid="setup-wizard-dialog">
          <DialogHeader>
            <DialogTitle data-testid="setup-wizard-title">Complete Copy Trading Setup</DialogTitle>
            <DialogDescription data-testid="setup-wizard-description">
              Set up your copy trading preferences to start following successful traders
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Setup Steps Progress */}
            <div className="flex items-center gap-4" data-testid="setup-steps-progress">
              {[1, 2, 3, 4].map((step) => (
                <div key={step} className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step <= setupStep ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {step}
                  </div>
                  {step < 4 && <div className="w-8 h-px bg-gray-200" />}
                </div>
              ))}
            </div>

            {/* Step Content */}
            {setupStep === 1 && (
              <div className="space-y-4" data-testid="setup-step-1">
                <h3 className="text-lg font-semibold">Risk Management Settings</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Maximum Daily Loss Limit</label>
                    <Input placeholder="$500" className="mt-1" data-testid="max-daily-loss-input" />
                    <p className="text-xs text-muted-foreground mt-1">
                      Automatically stop copying when daily losses reach this amount
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Maximum Position Size</label>
                    <Input placeholder="$2000" className="mt-1" data-testid="max-position-input" />
                    <p className="text-xs text-muted-foreground mt-1">
                      Limit the maximum amount for any single copy trade
                    </p>
                  </div>
                </div>
              </div>
            )}

            {setupStep === 2 && (
              <div className="space-y-4" data-testid="setup-step-2">
                <h3 className="text-lg font-semibold">Funding Source</h3>
                <div className="space-y-3">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Wallet className="h-5 w-5 text-blue-600" />
                      <div>
                        <p className="font-medium">Connected Wallet</p>
                        <p className="text-sm text-muted-foreground">
                          Use funds directly from your connected wallet
                        </p>
                      </div>
                    </div>
                  </div>
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Funds remain in your wallet. Copy trades will only execute when you have sufficient balance.
                    </AlertDescription>
                  </Alert>
                </div>
              </div>
            )}

            {setupStep === 3 && (
              <div className="space-y-4" data-testid="setup-step-3">
                <h3 className="text-lg font-semibold">Copy Trading Preferences</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Default Copy Amount: ${copyAmount[0]}</label>
                    <Slider
                      value={copyAmount}
                      onValueChange={setCopyAmount}
                      max={5000}
                      min={50}
                      step={50}
                      className="mt-2"
                      data-testid="copy-amount-slider"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>$50</span>
                      <span>$5,000</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Auto Copy Mode</p>
                      <p className="text-sm text-muted-foreground">
                        Automatically copy trades from followed traders
                      </p>
                    </div>
                    <Switch
                      checked={autoCopyEnabled}
                      onCheckedChange={setAutoCopyEnabled}
                      data-testid="auto-copy-switch"
                    />
                  </div>
                </div>
              </div>
            )}

            {setupStep === 4 && (
              <div className="space-y-4" data-testid="setup-step-4">
                <h3 className="text-lg font-semibold">Terms & Agreement</h3>
                <div className="space-y-3">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Important:</strong> Copy trading involves financial risk. Past performance does not guarantee future results.
                    </AlertDescription>
                  </Alert>
                  <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800 max-h-40 overflow-y-auto">
                    <p className="text-sm">
                      By enabling copy trading, you acknowledge that:
                    </p>
                    <ul className="text-xs mt-2 space-y-1 text-muted-foreground">
                      <li>• You understand the risks involved in cryptocurrency trading</li>
                      <li>• Copy trading decisions are made automatically based on followed traders</li>
                      <li>• You maintain full control of your wallet and funds</li>
                      <li>• Past performance of traders does not guarantee future results</li>
                      <li>• You can stop copying or modify settings at any time</li>
                    </ul>
                  </div>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="checkbox" data-testid="terms-agreement-checkbox" />
                    <span className="text-sm">I agree to the copy trading terms and conditions</span>
                  </label>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-between pt-4" data-testid="setup-actions">
              <Button
                variant="outline"
                onClick={() => setSetupStep(Math.max(1, setupStep - 1))}
                disabled={setupStep === 1}
                data-testid="setup-back-button"
              >
                Back
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowSetupWizard(false)}
                  data-testid="setup-cancel-button"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (setupStep < 4) {
                      setSetupStep(setupStep + 1);
                    } else {
                      // Complete setup
                      toast({
                        title: "Setup Complete",
                        description: "Copy trading is now enabled for your account"
                      });
                      setShowSetupWizard(false);
                      queryClient.invalidateQueries({ queryKey: ['copy-trading-setup'] });
                    }
                  }}
                  data-testid="setup-next-button"
                >
                  {setupStep === 4 ? 'Complete Setup' : 'Next'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Session Renewal Modal */}
      <SessionRenewalModal 
        open={showRenewalModal} 
        onOpenChange={setShowRenewalModal}
      />
    </div>
  );
}
