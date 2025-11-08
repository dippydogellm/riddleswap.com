import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Droplets, Plus, Minus, TrendingUp, Wallet, RefreshCw, Loader2, AlertTriangle, Search, ChevronDown } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface TokenSearchResult {
  symbol: string;
  name: string;
  issuer: string;
  currency_code: string;
  logo_url?: string;
  icon_url?: string;
  price_usd?: number;
  volume_24h?: number;
  market_cap?: number;
  price_change_24h?: number;
  verified: boolean;
  source: string;
}

interface LiquidityPool {
  id: string;
  tokenA: TokenSearchResult;
  tokenB: TokenSearchResult;
  reserveA: string;
  reserveB: string;
  totalLiquidity: string;
  apy: string;
  volume24h: string;
  myPosition?: {
    liquidity: string;
    tokenA: string;
    tokenB: string;
  };
}

const TokenLogo = ({ token, size = 32, className = "" }: { 
  token: TokenSearchResult; 
  size?: number; 
  className?: string; 
}) => {
  const logoUrl = token.logo_url || token.icon_url;
  
  if (logoUrl) {
    return (
      <img 
        src={logoUrl} 
        alt={token.symbol}
        width={size}
        height={size}
        className={`${className} bg-secondary rounded-full`}
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
        }}
      />
    );
  }
  
  return (
    <div 
      className={`${className} bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm rounded-full`}
      style={{ width: size, height: size }}
    >
      {token.symbol.substring(0, 2)}
    </div>
  );
};

const formatUsd = (amount: number): string => {
  return new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2 
  }).format(amount);
};

export default function LiquidityPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('pools');
  const [pools, setPools] = useState<LiquidityPool[]>([]);
  const [loading, setLoading] = useState(false);
  const [riddleWalletData, setRiddleWalletData] = useState<{ 
    address: string | null; 
    isConnected: boolean; 
    handle: string | null;
    balance: string;
    totalBalance: string;
    reserve: string;
  }>({ 
    address: null, 
    isConnected: false,
    handle: null,
    balance: '0.00',
    totalBalance: '0.00',
    reserve: '0.00'
  });

  // Add liquidity form state
  const [tokenA, setTokenA] = useState<TokenSearchResult>({
    symbol: 'XRP',
    name: 'XRP',
    issuer: '',
    currency_code: 'XRP',
    verified: true,
    source: 'native',
    price_usd: 2.91
  });

  const [tokenB, setTokenB] = useState<TokenSearchResult>({
    symbol: 'RDL',
    name: 'RiddleSwap Token',
    issuer: 'r9xvnzUWZJpDu3NA6MKHmKhKJQTRqCRgu9',
    currency_code: 'RDL',
    verified: true,
    source: 'issuer',
    price_usd: 0.1
  });

  const [amountA, setAmountA] = useState('');
  const [amountB, setAmountB] = useState('');
  const [showTokenSearch, setShowTokenSearch] = useState<'A' | 'B' | null>(null);
  const [tokenSearchQuery, setTokenSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TokenSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Load wallet data
  useEffect(() => {
    const loadRiddleWallet = async () => {
      try {
        const sessionData = sessionStorage.getItem('riddle_wallet_session');

        if (!sessionData) {
          setRiddleWalletData({ 
            address: null, 
            isConnected: false, 
            handle: null,
            balance: '0.00',
            totalBalance: '0.00',
            reserve: '0.00'
          });
          return;
        }

        const session = JSON.parse(sessionData);
        const xrpAddress = session.walletData?.xrpAddress || 
                          session.walletData?.xrp || 
                          session.walletData?.addresses?.xrp ||
                          session.xrpAddress ||
                          session.linkedWalletAddress;
                          
        const hasValidAuth = session.sessionToken || session.handle || session.walletData;
        if (!hasValidAuth || !xrpAddress) {
          setRiddleWalletData({ 
            address: null, 
            isConnected: false, 
            handle: null,
            balance: '0.00',
            totalBalance: '0.00',
            reserve: '0.00'
          });
          return;
        }

        if (session.expiresAt && Date.now() > session.expiresAt) {
          sessionStorage.removeItem('riddle_wallet_session');
          setRiddleWalletData({ 
            address: null, 
            isConnected: false, 
            handle: null,
            balance: '0.00',
            totalBalance: '0.00',
            reserve: '0.00'
          });
          return;
        }

        // Fetch balance
        let balanceData = { balance: '0.00', totalBalance: '0.00', reserve: '10.00' };
        try {
          const balanceResponse = await fetch(`/api/balance-v2/XRP/${xrpAddress}`);
          if (balanceResponse.ok) {
            const rawBalanceData = await balanceResponse.json();
            if (rawBalanceData.success) {
              balanceData = {
                balance: rawBalanceData.balance || '0.00',
                totalBalance: rawBalanceData.balance || '0.00',
                reserve: '10.00'
              };
            }
          }
        } catch (error) {
          balanceData = { balance: '0.00', totalBalance: '0.00', reserve: '10.00' };
        }

        setRiddleWalletData({
          address: xrpAddress,
          isConnected: true,
          handle: session.handle || session.walletData?.handle,
          balance: balanceData.balance || '0.00',
          totalBalance: balanceData.totalBalance || '0.00',
          reserve: balanceData.reserve || '10.00'
        });

      } catch (error) {
        setRiddleWalletData({ 
          address: null, 
          isConnected: false, 
          handle: null,
          balance: '0.00',
          totalBalance: '0.00',
          reserve: '0.00'
        });
      }
    };

    loadRiddleWallet();
    const interval = setInterval(loadRiddleWallet, 30000);
    return () => clearInterval(interval);
  }, []);

  // Token search functionality
  const searchTokens = async (query: string) => {
    if (!query.trim()) return;
    
    setIsSearching(true);
    try {
      const response = await fetch(`/api/xrpl/tokens/search?q=${encodeURIComponent(query)}`);
      const data = await response.json() as any;
      
      if (data.success && data.tokens) {
        setSearchResults(data.tokens);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Token search failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (tokenSearchQuery) {
      const timeoutId = setTimeout(() => searchTokens(tokenSearchQuery), 300);
      return () => clearTimeout(timeoutId);
    } else {
      setSearchResults([]);
    }
  }, [tokenSearchQuery]);

  // Load liquidity pools
  const loadPools = async () => {
    if (!riddleWalletData.isConnected) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/xrpl/liquidity/pools/${riddleWalletData.address}`);
      const data = await response.json() as any;
      
      if (data.success) {
        setPools(data.pools || []);
      }
    } catch (error) {
      console.error('Failed to load pools:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (riddleWalletData.isConnected) {
      loadPools();
    }
  }, [riddleWalletData.isConnected]);

  const handleAddLiquidity = async () => {
    if (!riddleWalletData.isConnected || !amountA || !amountB) {
      toast({
        title: "Missing Information",
        description: "Please connect wallet and enter valid amounts",
        variant: "destructive"
      });
      return;
    }

    const password = prompt('Enter your Riddle wallet password to add liquidity:');
    if (!password) return;

    setLoading(true);

    try {
      const response = await fetch('/api/xrpl/liquidity/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenA: {
            symbol: tokenA.symbol,
            issuer: tokenA.issuer,
            amount: amountA
          },
          tokenB: {
            symbol: tokenB.symbol,
            issuer: tokenB.issuer,
            amount: amountB
          },
          walletAddress: riddleWalletData.address,
          walletType: 'riddle',
          riddleWalletId: riddleWalletData.handle,
          password
        })
      });

      const data = await response.json() as any;
      
      if (data.success) {
        toast({
          title: "Liquidity Added!",
          description: `Added ${amountA} ${tokenA.symbol} + ${amountB} ${tokenB.symbol} to liquidity pool`,
        });
        
        setAmountA('');
        setAmountB('');
        loadPools();
      } else {
        throw new Error(data.error || 'Failed to add liquidity');
      }
      
    } catch (error) {
      console.error('Add liquidity failed:', error);
      toast({
        title: "Failed to Add Liquidity",
        description: error instanceof Error ? error.message : 'Transaction failed',
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const selectToken = (token: TokenSearchResult, type: 'A' | 'B') => {
    if (type === 'A') {
      setTokenA(token);
    } else {
      setTokenB(token);
    }
    setShowTokenSearch(null);
    setTokenSearchQuery('');
    setSearchResults([]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent mb-4">
            XRPL Liquidity Pools
          </h1>
          <p className="text-lg text-muted-foreground mb-2">
            Provide liquidity and earn rewards on XRPL decentralized exchange
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            <Badge variant="outline" className="flex items-center gap-2">
              <Droplets className="h-4 w-4" />
              Automated Market Making
            </Badge>
            <Badge variant="outline" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Earn Trading Fees
            </Badge>
            <Badge variant="outline" className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              XRPL Native Pools
            </Badge>
          </div>
        </div>

        <div className="max-w-4xl mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-8">
              <TabsTrigger value="pools">Available Pools</TabsTrigger>
              <TabsTrigger value="add">Add Liquidity</TabsTrigger>
              <TabsTrigger value="positions">My Positions</TabsTrigger>
            </TabsList>

            <TabsContent value="pools" className="space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Droplets className="h-5 w-5 text-blue-500" />
                    Available Liquidity Pools
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadPools}
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </CardHeader>
                <CardContent>
                  {pools.length === 0 ? (
                    <div className="text-center py-8">
                      <Droplets className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        {loading ? 'Loading pools...' : 'No liquidity pools found'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {pools.map((pool) => (
                        <div key={pool.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="flex -space-x-2">
                                <TokenLogo token={pool.tokenA} size={40} className="border-2 border-background" />
                                <TokenLogo token={pool.tokenB} size={40} className="border-2 border-background" />
                              </div>
                              <div>
                                <div className="font-semibold">
                                  {pool.tokenA.symbol}/{pool.tokenB.symbol}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  TVL: ${pool.totalLiquidity} • 24h Volume: ${pool.volume24h}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold text-green-500">
                                {pool.apy}% APY
                              </div>
                              <Button variant="outline" size="sm" className="mt-2">
                                Add Liquidity
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="add" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="h-5 w-5 text-green-500" />
                    Add Liquidity to Pool
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Token A */}
                  <div className="space-y-2">
                    <Label>First Token</Label>
                    <Card className="p-4">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setShowTokenSearch('A')}
                          className="flex items-center gap-2 hover:bg-secondary/50 rounded-lg p-2 transition-colors"
                        >
                          <TokenLogo token={tokenA} size={32} className="rounded-full" />
                          <div className="text-left">
                            <div className="font-semibold">{tokenA.symbol}</div>
                          </div>
                          <ChevronDown className="h-4 w-4" />
                        </button>
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={amountA}
                          onChange={(e) => setAmountA(e.target.value)}
                          className="text-right text-lg font-semibold border-0 shadow-none bg-transparent"
                        />
                      </div>
                    </Card>
                  </div>

                  {/* Token B */}
                  <div className="space-y-2">
                    <Label>Second Token</Label>
                    <Card className="p-4">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setShowTokenSearch('B')}
                          className="flex items-center gap-2 hover:bg-secondary/50 rounded-lg p-2 transition-colors"
                        >
                          <TokenLogo token={tokenB} size={32} className="rounded-full" />
                          <div className="text-left">
                            <div className="font-semibold">{tokenB.symbol}</div>
                          </div>
                          <ChevronDown className="h-4 w-4" />
                        </button>
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={amountB}
                          onChange={(e) => setAmountB(e.target.value)}
                          className="text-right text-lg font-semibold border-0 shadow-none bg-transparent"
                        />
                      </div>
                    </Card>
                  </div>

                  <Button 
                    onClick={handleAddLiquidity}
                    disabled={!riddleWalletData.isConnected || loading || !amountA || !amountB}
                    className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding Liquidity...
                      </>
                    ) : !riddleWalletData.isConnected ? (
                      'Connect Riddle Wallet'
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Liquidity
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="positions">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-purple-500" />
                    My Liquidity Positions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <Wallet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">No liquidity positions found</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {!riddleWalletData.isConnected && (
          <Alert className="max-w-2xl mx-auto mt-8">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Connect your Riddle wallet to participate in XRPL liquidity pools.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Token Search Modal */}
      <Dialog open={showTokenSearch !== null} onOpenChange={() => setShowTokenSearch(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Token</DialogTitle>
            <DialogDescription>
              Search and select a token for your liquidity position
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tokens (e.g., RDL, SOLO, USD)"
                value={tokenSearchQuery}
                onChange={(e) => setTokenSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="max-h-60 overflow-y-auto space-y-2">
              {isSearching ? (
                <div className="text-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Searching tokens...</p>
                </div>
              ) : searchResults.length > 0 ? (
                searchResults.map((token, index) => (
                  <button
                    key={`${token.symbol}-${token.issuer}-${index}`}
                    onClick={() => selectToken(token, showTokenSearch!)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-secondary rounded-lg transition-colors"
                  >
                    <TokenLogo token={token} size={32} className="rounded-full" />
                    <div className="flex-1 text-left">
                      <div className="font-semibold">{token.symbol}</div>
                      <div className="text-xs text-muted-foreground">
                        {token.name} • {token.verified ? 'Verified' : 'Unverified'}
                      </div>
                    </div>
                    {token.price_usd && (
                      <div className="text-right">
                        <div className="font-semibold">{formatUsd(token.price_usd)}</div>
                      </div>
                    )}
                  </button>
                ))
              ) : tokenSearchQuery ? (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">No tokens found</p>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">Start typing to search tokens</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
