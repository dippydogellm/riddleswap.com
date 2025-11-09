import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Coins, 
  RefreshCw, 
  TrendingUp, 
  Send, 
  ArrowUpDown,
  Wallet,
  DollarSign,
  Globe
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { ChainLogo } from '@/components/ui/chain-logo';

// Helper function to get chain icon URLs
const getChainIconUrl = (chain: string): string => {
  const chainIcons: { [key: string]: string } = {
    'ethereum': '/images/chains/ethereum.svg',
    'eth': '/images/chains/ethereum.svg',
    'solana': '/images/chains/solana.svg',
    'sol': '/images/chains/solana.svg',
    'xrpl': '/images/chains/xrp-logo.png',
    'xrp': '/images/chains/xrp-logo.png',
    'bitcoin': '/images/chains/bitcoin.svg',
    'btc': '/images/chains/bitcoin.svg'
  };

  return chainIcons[chain.toLowerCase()] || '/images/chains/default.svg';
};

interface RDLBalance {
  chain: string;
  tokenSymbol: string;
  tokenName: string;
  balance: number;
  usdValue: number;
  contractAddress?: string;
  decimals: number;
  icon: string;
  chainColor: string;
}

const RDL_TOKENS = {
  xrp: {
    symbol: 'RDL',
    name: 'RiddleSwap Token (XRPL)',
    icon: '/images/chains/xrp-logo.png',
    chainColor: 'bg-blue-500',
    description: 'Native RDL token on XRP Ledger'
  },
  sol: {
    symbol: 'SRDL',
    name: 'Solana RiddleSwap Token',
    icon: '/images/chains/solana-logo.png',
    chainColor: 'bg-purple-500',
    description: 'RDL token on Solana blockchain'
  },
  bnb: {
    symbol: 'BNBRDL',
    name: 'BSC RiddleSwap Token',
    icon: '/images/chains/bnb-logo.png',
    chainColor: 'bg-yellow-500',
    description: 'RDL token on BNB Smart Chain'
  },
  eth: {
    symbol: 'ERDL',
    name: 'Ethereum RiddleSwap Token',
    icon: '/images/chains/ethereum-logo.png',
    chainColor: 'bg-green-500',
    description: 'RDL token on Ethereum blockchain'
  }
};

export function RDLBank() {
  const { toast } = useToast();
  const { authData, isAuthenticated, walletAddresses } = useAuth(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedChain, setSelectedChain] = useState<string | null>(null);

  // Fetch RDL balances from all chains
  const { data: rdlBalances, isLoading, refetch, error } = useQuery<RDLBalance[]>({
    queryKey: ['/api/rdl-balances'],
    enabled: !!isAuthenticated && !!authData?.sessionToken,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });

  // Calculate total portfolio value
  const rdlBalanceArray = Array.isArray(rdlBalances) ? rdlBalances : [];
  const totalUsdValue = rdlBalanceArray.reduce((sum, balance) => sum + balance.usdValue, 0);
  const totalRdlTokens = rdlBalanceArray.reduce((sum, balance) => sum + balance.balance, 0);

  // Handle manual refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      toast({
        title: "Balances Updated",
        description: "RDL token balances have been refreshed across all chains",
      });
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: "Failed to refresh balances. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle token transfer (placeholder for future implementation)
  const handleTransfer = (chain: string, tokenSymbol: string) => {
    toast({
      title: "Transfer Feature",
      description: `Transfer functionality for ${tokenSymbol} will be available soon`,
    });
  };

  // Handle token swap (placeholder for future implementation)
  const handleSwap = (chain: string, tokenSymbol: string) => {
    toast({
      title: "Swap Feature",
      description: `Cross-chain swap for ${tokenSymbol} will be available soon`,
    });
  };

  if (!isAuthenticated) {
    return (
      <Card className="w-full">
        <CardContent className="p-6 text-center">
          <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">RDL Bank Access Required</h3>
          <p className="text-muted-foreground mb-4">
            Please log in to view your RDL token balances across all chains
          </p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardContent className="p-6 text-center">
          <div className="text-red-500 mb-4">
            <Globe className="h-12 w-12 mx-auto mb-2" />
            <h3 className="text-lg font-semibold">Connection Error</h3>
            <p className="text-sm text-muted-foreground">
              Failed to load RDL balances. Please check your connection.
            </p>
          </div>
          <Button onClick={handleRefresh} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Coins className="h-6 w-6 text-yellow-500" />
                RDL Bank
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                  In-Game Currency
                </Badge>
              </CardTitle>
              <CardDescription>
                Your RiddleSwap token balances across all supported blockchains
              </CardDescription>
            </div>
            <Button 
              onClick={handleRefresh} 
              variant="outline" 
              size="sm"
              disabled={isRefreshing}
              data-testid="button-refresh-rdl-balances"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Portfolio Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-5 w-5 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">Total Value</span>
              </div>
              <div className="text-2xl font-bold text-yellow-800 dark:text-yellow-200">
                ${totalUsdValue.toFixed(2)}
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Coins className="h-5 w-5 text-blue-600" />
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Total RDL Tokens</span>
              </div>
              <div className="text-2xl font-bold text-blue-800 dark:text-blue-200">
                {totalRdlTokens.toLocaleString()}
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium text-green-700 dark:text-green-300">Active Chains</span>
              </div>
              <div className="text-2xl font-bold text-green-800 dark:text-green-200">
                {rdlBalanceArray.filter(b => b.balance > 0).length || 0} / 4
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* RDL Token Balances */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Chain Balances</CardTitle>
          <CardDescription>
            RDL token balances across all supported blockchain networks
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Object.entries(RDL_TOKENS).map(([chain, token]) => (
                <div key={chain} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border animate-pulse">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-muted rounded-lg" />
                    <div className="space-y-2">
                      <div className="w-32 h-4 bg-muted rounded" />
                      <div className="w-24 h-3 bg-muted rounded" />
                    </div>
                  </div>
                  <div className="text-right space-y-2">
                    <div className="w-20 h-4 bg-muted rounded" />
                    <div className="w-16 h-3 bg-muted rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(RDL_TOKENS).map(([chain, tokenInfo]) => {
                const balance = rdlBalanceArray.find(b => b.chain === chain);
                const hasBalance = balance && balance.balance > 0;
                
                return (
                  <div 
                    key={chain} 
                    className={`flex items-center justify-between p-4 rounded-lg border transition-all hover:shadow-md ${
                      hasBalance 
                        ? 'bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800' 
                        : 'bg-muted/30 border-muted'
                    }`}
                    data-testid={`rdl-balance-${chain}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <ChainLogo
                          chain={chain}
                          iconUrl={getChainIconUrl(chain)}
                          size="lg"
                          className="w-12 h-12"
                        />
                        {hasBalance && (
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-gray-800" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-lg">{tokenInfo.symbol}</span>
                          <Badge variant="outline" className={`text-xs ${tokenInfo.chainColor} text-white`}>
                            {chain.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{tokenInfo.description}</p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-lg font-bold">
                        {balance ? balance.balance.toLocaleString() : '0'} {tokenInfo.symbol}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        ${balance ? balance.usdValue.toFixed(2) : '0.00'} USD
                      </div>
                      
                      {hasBalance && (
                        <div className="flex gap-2 mt-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleTransfer(chain, tokenInfo.symbol)}
                            data-testid={`button-transfer-${chain}`}
                          >
                            <Send className="h-3 w-3 mr-1" />
                            Send
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleSwap(chain, tokenInfo.symbol)}
                            data-testid={`button-swap-${chain}`}
                          >
                            <ArrowUpDown className="h-3 w-3 mr-1" />
                            Swap
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common operations for your RDL tokens
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button 
              variant="outline" 
              className="h-20 flex-col gap-2"
              onClick={() => toast({ title: "Feature Coming Soon", description: "Cross-chain bridge will be available soon" })}
              data-testid="button-bridge-rdl"
            >
              <ArrowUpDown className="h-6 w-6" />
              <span>Bridge RDL</span>
            </Button>
            
            <Button 
              variant="outline" 
              className="h-20 flex-col gap-2"
              onClick={() => toast({ title: "Feature Coming Soon", description: "Staking rewards will be available soon" })}
              data-testid="button-stake-rdl"
            >
              <TrendingUp className="h-6 w-6" />
              <span>Stake RDL</span>
            </Button>
            
            <Button 
              variant="outline" 
              className="h-20 flex-col gap-2"
              onClick={() => toast({ title: "Feature Coming Soon", description: "Trading features will be available soon" })}
              data-testid="button-trade-rdl"
            >
              <ArrowUpDown className="h-6 w-6" />
              <span>Trade RDL</span>
            </Button>
            
            <Button 
              variant="outline" 
              className="h-20 flex-col gap-2"
              onClick={handleRefresh}
              disabled={isRefreshing}
              data-testid="button-refresh-all"
            >
              <RefreshCw className={`h-6 w-6 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh All</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
