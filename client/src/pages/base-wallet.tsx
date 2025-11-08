import { useState } from 'react';
import '@/styles/base-wallet.css';
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
import baseLogoPath from "@assets/image_1756172918048.png";

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

interface BaseBalance {
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

export default function BaseWallet() {
  const { toast } = useToast();
  const [showBalance, setShowBalance] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Use unified authentication - ALWAYS call hooks at top level
  const { authData, isLoading: authLoading, isAuthenticated, walletData, walletAddresses } = useAuth();
  
  const walletAddress = walletAddresses?.eth || walletData?.eth || walletData?.ethAddress;
  const walletHandle = authData?.handle || null;
  
  // Define wallet connection status
  const isConnected = isAuthenticated && !!walletAddress;

  // Fetch Base balance using correct API endpoint
  const { data: balanceData, isLoading: balanceLoading, refetch: refetchBalance } = useQuery({
    queryKey: ['/api/wallets/base/balance', walletAddress],
    queryFn: async () => {
      const response = await fetch(`/api/wallets/base/balance/${walletAddress}`, {
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
        description: "Base wallet data updated",
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

  // Check authentication after all hooks are called
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-100 dark:from-gray-900 dark:via-gray-800 dark:to-black p-4">
        <div className="max-w-md mx-auto pt-20">
          <Card className="border-blue-200 dark:border-blue-800 shadow-xl">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 mx-auto mb-4 bg-blue-500 rounded-full flex items-center justify-center">
                <img src={baseLogoPath} alt="Base" className="w-10 h-10" />
              </div>
              <CardTitle className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                Base Wallet Access Required
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Please log in to your Riddle Wallet to access your Base network wallet
              </p>
              <div className="space-y-3">
                <Link href="/wallet-login">
                  <Button className="w-full bg-blue-500 hover:bg-blue-600 text-white">
                    <Wallet className="w-4 h-4 mr-2" />
                    Login to Wallet
                  </Button>
                </Link>
                <Link href="/create-wallet">
                  <Button variant="outline" className="w-full border-blue-300 text-blue-700 hover:bg-blue-50">
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
    <div className="base-wallet-container min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-100 dark:from-gray-900 dark:via-gray-800 dark:to-black">
      {/* Header */}
      <div className="header-card bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-blue-200 dark:border-blue-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <img src={baseLogoPath} alt="Base" className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-blue-900 dark:text-blue-100">
                  Base Network Wallet
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  @{walletHandle}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                Base Mainnet
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="border-blue-300 text-blue-700 hover:bg-blue-50"
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
            <Card className="balance-card border-blue-200 dark:border-blue-800 shadow-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Wallet className="w-5 h-5" />
                    ETH Balance
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
                    <p className="text-blue-100 text-sm mb-1">Available Balance</p>
                    <div className="text-3xl font-bold text-white">
                      {balanceLoading ? (
                        <div className="animate-pulse bg-white/20 h-8 w-32 rounded"></div>
                      ) : showBalance ? (
                        `${formatAmount(balance)} ETH`
                      ) : (
                        '•••••••'
                      )}
                    </div>
                    <div className="text-blue-100 text-lg">
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
                    <p className="text-blue-100 text-sm mb-2">Wallet Address</p>
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
                            <DialogTitle>Base Wallet QR Code</DialogTitle>
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
                      <Button className="w-full bg-white text-blue-600 hover:bg-gray-100">
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
            <Card className="mt-6 border-blue-200 dark:border-blue-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
                  <TrendingUp className="w-5 h-5" />
                  Network Info
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Network</span>
                    <span className="font-medium text-blue-700 dark:text-blue-300">Base</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Chain ID</span>
                    <span className="font-medium">8453</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Currency</span>
                    <span className="font-medium">ETH</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Explorer</span>
                    <a 
                      href={`https://basescan.org/address/${walletAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      BaseScan
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="swap" className="space-y-6">
              <TabsList className="grid w-full grid-cols-3 bg-blue-100 dark:bg-gray-800">
                <TabsTrigger value="swap" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                  <ArrowRightLeft className="w-4 h-4 mr-2" />
                  Base DEX
                </TabsTrigger>
                <TabsTrigger value="transactions" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                  <Activity className="w-4 h-4 mr-2" />
                  Transactions
                </TabsTrigger>
                <TabsTrigger value="tokens" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                  <Zap className="w-4 h-4 mr-2" />
                  ERC-20 Tokens
                </TabsTrigger>
              </TabsList>

              <TabsContent value="swap">
                <Card className="border-blue-200 dark:border-blue-800">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
                      <ArrowRightLeft className="w-5 h-5" />
                      Base Network DEX
                    </CardTitle>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Swap ETH and ERC-20 tokens with best rates across Base DEXs
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
                <Card className="border-blue-200 dark:border-blue-800">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
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
                          Your Base transactions will appear here
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {transactions.map((tx: Transaction, index: number) => (
                          <div
                            key={tx.hash || index}
                            className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          >
                            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                              {tx.type === 'send' && <ArrowUpRight className="w-5 h-5 text-blue-600" />}
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
                              href={`https://basescan.org/tx/${tx.hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-700 p-1"
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
                <Card className="border-blue-200 dark:border-blue-800">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
                      <Zap className="w-5 h-5" />
                      ERC-20 Token Holdings
                    </CardTitle>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Your Base network token portfolio
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
