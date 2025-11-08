import { useState } from "react";
import '@/styles/optimism-wallet.css';
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import * as QRCode from "qrcode.react";
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
  Eye, 
  EyeOff, 
  Copy, 
  QrCode, 
  RefreshCw, 
  TrendingUp, 
  Send,
  Coins,
  History
} from 'lucide-react';

// Import the Optimism logo
const optimismLogoPath = '/images/chains/optimism-logo.png';

const formatAddress = (address: string): string => {
  if (!address) return '';
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
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

export default function OptimismWallet() {
  const { toast } = useToast();
  const [showBalance, setShowBalance] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Use unified authentication - ALWAYS call hooks at top level
  const { authData, isLoading: authLoading, isAuthenticated, walletData, walletAddresses } = useAuth();

  const walletAddress = walletAddresses?.eth || walletData?.eth || walletData?.ethAddress;
  const walletHandle = authData?.handle;

  // Fetch Optimism balance using correct API endpoint
  const { data: balanceData, isLoading: balanceLoading, refetch: refetchBalance } = useQuery({
    queryKey: ['/api/wallets/optimism/balance', walletAddress],
    queryFn: async () => {
      const response = await fetch(`/api/wallets/optimism/balance/${walletAddress}`, {
        headers: { 'Authorization': `Bearer ${authData?.sessionToken}` }
      });
      if (!response.ok) throw new Error('Failed to fetch balance');
      return response.json();
    },
    enabled: !!walletAddress,
    refetchInterval: 30000,
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
        description: "Optimism wallet data updated",
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
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-pink-50 to-rose-50 dark:from-gray-900 dark:via-gray-800 dark:to-black p-4">
        <div className="max-w-md mx-auto pt-20">
          <Card className="border-red-200 dark:border-red-800 shadow-xl">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-500 rounded-full flex items-center justify-center">
                <img src={optimismLogoPath} alt="Optimism" className="w-10 h-10" />
              </div>
              <CardTitle className="text-2xl font-bold text-red-900 dark:text-red-100">
                Optimism Wallet Access Required
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Please log in to your Riddle Wallet to access your Optimism wallet
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
    <div className="optimism-wallet-container min-h-screen bg-gradient-to-br from-red-50 via-pink-50 to-rose-50 dark:from-gray-900 dark:via-gray-800 dark:to-black">
      {/* Header */}
      <div className="header-card bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-red-200 dark:border-red-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                <img src={optimismLogoPath} alt="Optimism" className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-red-900 dark:text-red-100">
                  Optimism Wallet
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  @{walletHandle}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                OP Mainnet
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Balance Card */}
          <div className="lg:col-span-2">
            <Card className="balance-card bg-gradient-to-br from-red-500 via-pink-500 to-rose-500 text-white border-0 shadow-xl">
              <CardHeader>
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
                    <p className="text-red-100 text-sm mb-1">Available Balance</p>
                    <div className="text-3xl font-bold text-white">
                      {balanceLoading ? (
                        <div className="animate-pulse bg-white/20 h-8 w-32 rounded"></div>
                      ) : showBalance ? (
                        `${formatAmount(balance)} ETH`
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
                            <DialogTitle>Optimism Wallet QR Code</DialogTitle>
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
                    <span className="font-medium">OP Mainnet</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Chain ID</span>
                    <span className="font-medium">10</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Native Token</span>
                    <span className="font-medium">ETH</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">1inch Supported</span>
                    <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50">✓ Yes</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Transaction History */}
            <Card className="border-red-200 dark:border-red-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-900 dark:text-red-100">
                  <History className="w-5 h-5" />
                  Recent Transactions
                </CardTitle>
              </CardHeader>
              <CardContent>
                {transactionsLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2"></div>
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                      </div>
                    ))}
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="text-center py-6">
                    <div className="text-gray-400 mb-2">
                      <History className="w-8 h-8 mx-auto" />
                    </div>
                    <p className="text-gray-500 dark:text-gray-400">No transactions found</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500">
                      Your transaction history will appear here
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {transactions.slice(0, 5).map((tx: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-800">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                            <ArrowUpRight className="w-4 h-4 text-red-600 dark:text-red-400" />
                          </div>
                          <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {tx.type || 'Transaction'}
                            </p>
                            <p className="font-medium">
                              {formatAmount(tx.amount)} ETH
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {new Date(tx.timestamp).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Token Holdings */}
            <Card className="border-red-200 dark:border-red-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-900 dark:text-red-100">
                  <Coins className="w-5 h-5" />
                  Token Holdings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-6">
                  <div className="text-gray-400 mb-2">
                    <Coins className="w-8 h-8 mx-auto" />
                  </div>
                  <p className="text-gray-500 dark:text-gray-400">Token portfolio coming soon</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500">
                    ERC-20 tokens will be displayed here
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
