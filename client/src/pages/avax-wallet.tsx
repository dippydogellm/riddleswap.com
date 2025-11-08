import { useState, useEffect } from 'react';
import '@/styles/avax-wallet.css';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  Wallet, 
  RefreshCw, 
  ExternalLink, 
  Copy, 
  Send, 
  QrCode,
  ArrowRightLeft,
  TrendingUp,
  Shield,
  Zap,
  Activity,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle,
  Clock,
  Globe
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import ProfessionalEVMSwap from '@/components/professional-evm-swap';
import { Link } from 'wouter';
import * as QRCode from 'qrcode.react';
import avaxLogoPath from "@assets/image_1756173052570.png";

interface Transaction {
  hash: string;
  type: 'send' | 'receive' | 'swap' | 'contract';
  amount: string;
  token: string;
  to?: string;
  from?: string;
  timestamp: number;
  status: 'confirmed' | 'pending' | 'failed';
  gasUsed?: string;
  gasPrice?: string;
  value?: string;
}

interface AvaxBalance {
  balance: string;
  balanceUsd: string;
  address: string;
}

const formatAddress = (address: string): string => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const formatAmount = (amount: string | number): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(2)}M`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(2)}K`;
  } else if (num >= 1) {
    return num.toFixed(4);
  } else {
    return num.toFixed(8);
  }
};

const formatUsd = (amount: number): string => {
  return new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2 
  }).format(amount);
};

const copyToClipboard = async (text: string, toast: any) => {
  try {
    await navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Address copied to clipboard",
      duration: 2000
    });
  } catch (err) {
    toast({
      title: "Copy failed",
      description: "Please copy manually",
      variant: "destructive",
      duration: 3000
    });
  }
};

export default function AvaxWallet() {
  const { toast } = useToast();
  const [showBalance, setShowBalance] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Use unified authentication - ALWAYS call hooks at top level
  const { authData, isLoading: authLoading, isAuthenticated, walletData } = useAuth();

  const walletAddress = walletData?.ethAddress; // EVM chains use same address as ETH
  const walletHandle = authData?.handle;
  
  // Define wallet connection status
  const isConnected = isAuthenticated && !!walletAddress;

  // Fetch Avalanche balance using ETH endpoints (EVM compatible)
  const { data: balanceData, isLoading: balanceLoading, refetch: refetchBalance } = useQuery({
    queryKey: ['/eth/balance', walletAddress],
    queryFn: async () => {
      const response = await fetch(`/eth/balance/${walletAddress}`, {
        headers: { 'Authorization': `Bearer ${authData?.sessionToken}` }
      });
      if (!response.ok) throw new Error('Failed to fetch balance');
      return response.json();
    },
    enabled: !!walletAddress,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch transaction history using ETH endpoints
  const { data: transactionsData, isLoading: transactionsLoading, refetch: refetchTransactions } = useQuery({
    queryKey: ['/eth/transactions', walletAddress],
    queryFn: async () => {
      const response = await fetch(`/eth/transactions/${walletAddress}`, {
        headers: { 'Authorization': `Bearer ${authData?.sessionToken}` }
      });
      if (!response.ok) throw new Error('Failed to fetch transactions');
      return response.json();
    },
    enabled: !!walletAddress,
    refetchInterval: 60000, // Refresh every minute
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchBalance(), refetchTransactions()]);
      toast({
        title: "Refreshed!",
        description: "Avalanche wallet data updated",
        duration: 2000
      });
    } catch (error) {
      toast({
        title: "Refresh failed",
        description: "Please try again",
        variant: "destructive",
        duration: 3000
      });
    } finally {
      setRefreshing(false);
    }
  };

  const balance = (balanceData as any)?.balance || '0';
  const balanceUsd = (balanceData as any)?.balanceUsd || '0';
  const transactions = (transactionsData as any)?.transactions || [];

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-red-100 dark:from-gray-900 dark:via-gray-800 dark:to-black p-4">
        <div className="max-w-md mx-auto pt-20">
          <Card className="border-red-200 dark:border-red-800 shadow-xl">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-500 rounded-full flex items-center justify-center">
                <img src={avaxLogoPath} alt="Avalanche" className="w-10 h-10" />
              </div>
              <CardTitle className="text-2xl font-bold text-red-900 dark:text-red-100">
                Avalanche Wallet Access Required
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Please log in to your Riddle Wallet to access your Avalanche C-Chain wallet
              </p>
              <div className="space-y-3">
                <Link href="/wallet-login">
                  <Button className="w-full bg-red-500 hover:bg-red-600 text-white">
                    <Wallet className="w-4 h-4 mr-2" />
                    Login to Wallet
                  </Button>
                </Link>
                <Link href="/create-wallet">
                  <Button variant="outline" className="w-full border-red-300 text-red-700 hover:bg-red-50">
                    Create New Wallet
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="avax-wallet-container min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-red-100 dark:from-gray-900 dark:via-gray-800 dark:to-black">
      {/* Header */}
      <div className="header-card bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-red-200 dark:border-red-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                <img src={avaxLogoPath} alt="Avalanche" className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-red-900 dark:text-red-100">
                  Avalanche C-Chain Wallet
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  @{walletHandle}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                Avalanche
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="border-red-300 text-red-700 hover:bg-red-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Balance Card */}
          <div className="lg:col-span-1">
            <Card className="balance-card border-red-200 dark:border-red-800 shadow-lg bg-gradient-to-br from-red-500 to-orange-600 text-white">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Wallet className="w-5 h-5" />
                    AVAX Balance
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowBalance(!showBalance)}
                    className="text-white hover:bg-white/10"
                  >
                    {showBalance ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-red-100 text-sm mb-1">Available Balance</p>
                    <div className="text-3xl font-bold text-white">
                      {balanceLoading ? (
                        <div className="animate-pulse bg-white/20 h-8 w-32 rounded"></div>
                      ) : showBalance ? (
                        `${formatAmount(balance)} AVAX`
                      ) : (
                        '•••••••'
                      )}
                    </div>
                    <div className="text-red-100 text-lg">
                      {balanceLoading ? (
                        <div className="animate-pulse bg-white/20 h-6 w-24 rounded"></div>
                      ) : showBalance ? (
                        formatUsd(parseFloat(balanceUsd))
                      ) : (
                        '••••••'
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/20">
                    <p className="text-red-100 text-sm mb-2">Wallet Address</p>
                    <div className="flex items-center gap-2">
                      <code className="text-sm bg-white/10 px-2 py-1 rounded text-white">
                        {formatAddress(walletAddress || '')}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(walletAddress || '', toast)}
                        className="text-white hover:bg-white/10 p-1"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 p-1">
                            <QrCode className="w-4 h-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-sm">
                          <DialogHeader>
                            <DialogTitle>Avalanche Wallet QR Code</DialogTitle>
                          </DialogHeader>
                          <div className="flex justify-center p-4">
                            <QRCode.QRCodeSVG value={walletAddress || ''} size={200} />
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>

                  <div className="action-buttons grid grid-cols-2 gap-2 pt-4">
                    <Link href="/send">
                      <Button className="w-full bg-white text-red-600 hover:bg-gray-100">
                        <Send className="w-4 h-4 mr-2" />
                        Send
                      </Button>
                    </Link>
                    <Link href="/receive">
                      <Button className="w-full bg-white/10 text-white hover:bg-white/20 border border-white/20">
                        <ArrowDownLeft className="w-4 h-4 mr-2" />
                        Receive
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card className="mt-6 border-red-200 dark:border-red-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-900 dark:text-red-100">
                  <TrendingUp className="w-5 h-5" />
                  Network Info
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Network</span>
                    <span className="font-medium text-red-700 dark:text-red-300">Avalanche C-Chain</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Chain ID</span>
                    <span className="font-medium">43114</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Currency</span>
                    <span className="font-medium">AVAX</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Explorer</span>
                    <a 
                      href={`https://snowtrace.io/address/${walletAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-red-600 hover:text-red-700 flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Snowtrace
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="swap" className="space-y-6">
              <TabsList className="grid w-full grid-cols-3 bg-red-100 dark:bg-gray-800">
                <TabsTrigger value="swap" className="data-[state=active]:bg-red-500 data-[state=active]:text-white">
                  <ArrowRightLeft className="w-4 h-4 mr-2" />
                  AVAX DEX
                </TabsTrigger>
                <TabsTrigger value="transactions" className="data-[state=active]:bg-red-500 data-[state=active]:text-white">
                  <Activity className="w-4 h-4 mr-2" />
                  Transactions
                </TabsTrigger>
                <TabsTrigger value="tokens" className="data-[state=active]:bg-red-500 data-[state=active]:text-white">
                  <Zap className="w-4 h-4 mr-2" />
                  ERC-20 Tokens
                </TabsTrigger>
              </TabsList>

              <TabsContent value="swap">
                <Card className="border-red-200 dark:border-red-800">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-900 dark:text-red-100">
                      <ArrowRightLeft className="w-5 h-5" />
                      Avalanche DEX Aggregator
                    </CardTitle>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Swap AVAX and ERC-20 tokens with best rates across Avalanche DEXs
                    </p>
                  </CardHeader>
                  <CardContent>
                    <ProfessionalEVMSwap
                      isWalletConnected={isConnected}
                      walletAddress={walletAddress}
                      walletHandle={walletHandle}
                      balance={balance}
                      totalBalance={balanceUsd}
                      reserve="0"
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="transactions">
                <Card className="border-red-200 dark:border-red-800">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-900 dark:text-red-100">
                      <Activity className="w-5 h-5" />
                      Transaction History
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {transactionsLoading ? (
                      <div className="space-y-4">
                        {[...Array(5)].map((_, i) => (
                          <div key={i} className="animate-pulse flex items-center gap-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
                            <div className="w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                            <div className="flex-1 space-y-2">
                              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/3"></div>
                              <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
                            </div>
                            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/4"></div>
                          </div>
                        ))}
                      </div>
                    ) : transactions.length === 0 ? (
                      <div className="text-center py-12">
                        <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500 dark:text-gray-400">No transactions found</p>
                        <p className="text-sm text-gray-400 dark:text-gray-500">
                          Your Avalanche transactions will appear here
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {transactions.map((tx: Transaction, index: number) => (
                          <div
                            key={tx.hash || index}
                            className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          >
                            <div className="w-10 h-10 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                              {tx.type === 'send' && <ArrowUpRight className="w-5 h-5 text-red-600" />}
                              {tx.type === 'receive' && <ArrowDownLeft className="w-5 h-5 text-green-600" />}
                              {tx.type === 'swap' && <ArrowRightLeft className="w-5 h-5 text-purple-600" />}
                              {tx.type === 'contract' && <Zap className="w-5 h-5 text-orange-600" />}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium capitalize">{tx.type}</span>
                                {tx.status === 'confirmed' && <CheckCircle className="w-4 h-4 text-green-500" />}
                                {tx.status === 'pending' && <Clock className="w-4 h-4 text-yellow-500" />}
                                {tx.status === 'failed' && <AlertTriangle className="w-4 h-4 text-red-500" />}
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {tx.to && `To: ${formatAddress(tx.to)}`}
                                {tx.from && `From: ${formatAddress(tx.from)}`}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium">
                                {tx.type === 'receive' ? '+' : '-'}{formatAmount(tx.amount)} {tx.token}
                              </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {new Date(tx.timestamp * 1000).toLocaleDateString()}
                              </p>
                            </div>
                            <a
                              href={`https://snowtrace.io/tx/${tx.hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-red-600 hover:text-red-700 p-1"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="tokens">
                <Card className="border-red-200 dark:border-red-800">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-900 dark:text-red-100">
                      <Zap className="w-5 h-5" />
                      ERC-20 Token Holdings
                    </CardTitle>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Your Avalanche C-Chain token portfolio
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-12">
                      <Zap className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500 dark:text-gray-400">Token portfolio coming soon</p>
                      <p className="text-sm text-gray-400 dark:text-gray-500">
                        ERC-20 token balances and management features are in development
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
