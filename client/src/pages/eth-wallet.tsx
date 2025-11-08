import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import * as QRCode from "qrcode.react";
import '@/styles/eth-wallet.css';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { useOptimizedWalletData } from '@/lib/wallet-query-optimizer';
import { 
  ArrowUpRight, 
  ArrowDownLeft,
  ArrowUpDown, 
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
import { TokenLogo } from '@/components/ui/token-logo';

// Import the Ethereum logo
const ethereumLogoPath = '/images/chains/ethereum-logo.png';

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

const formatTokenBalance = (balance: string, decimals: number): string => {
  const balanceNum = parseFloat(balance);
  const divisor = Math.pow(10, decimals);
  const formattedBalance = balanceNum / divisor;
  return formatAmount(formattedBalance);
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

export default function ETHWallet() {
  const { toast } = useToast();
  const [showBalance, setShowBalance] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Use unified authentication - ALWAYS call hooks at top level
  const { authData, isLoading: authLoading, isAuthenticated, walletData: authWalletData } = useAuth();
  
  const walletAddress = authWalletData?.ethAddress;
  const walletHandle = authData?.handle;

  // Use optimized wallet data hook with proper authentication guards
  const walletData = useOptimizedWalletData('eth', walletAddress, {
    includeTokens: true,
    includeNFTs: true,
    includeTransactions: true,
    includePortfolio: true
  });

  const { isLoading, error, refetchAll } = walletData;
  const balanceData = walletData.balance.data;
  const tokensData = walletData.tokens.data;
  const tokensLoading = walletData.tokens.isLoading;
  const nftsData = walletData.nfts.data;
  const transactionsData = walletData.transactions.data;
  const transactionsLoading = walletData.transactions.isLoading;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetchAll();
      toast({
        title: "Refreshed!",
        description: "Ethereum wallet data updated",
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

  // Debug logging
  console.log('🔍 [ETH WALLET] balanceData:', balanceData);
  console.log('🔍 [ETH WALLET] tokensData:', tokensData);
  console.log('🔍 [ETH WALLET] isAuthenticated:', isAuthenticated);
  console.log('🔍 [ETH WALLET] walletAddress:', walletAddress);
  
  const balance = (balanceData as any)?.balance || '0';
  const balanceUsd = (balanceData as any)?.balanceUsd || '0';
  const transactions = (transactionsData as any)?.transactions || [];
  const tokens = (tokensData as any)?.tokens || [];

  // Check authentication after all hooks are called
  if (authLoading) {
    return (
      <div className="eth-wallet-container flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4 eth-loading-spinner"></div>
          <p className="eth-loading-text">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="eth-wallet-container p-4">
        <div className="max-w-md mx-auto pt-20">
          <Card className="eth-balance-card shadow-xl">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 mx-auto mb-4 eth-header-icon">
                <img src={ethereumLogoPath} alt="Ethereum" className="w-10 h-10" />
              </div>
              <CardTitle className="text-2xl font-bold eth-balance-text">
                Ethereum Wallet Access Required
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-white/70 mb-6">
                Please log in to your Riddle Wallet to access your Ethereum wallet
              </p>
              <div className="space-y-3">
                <Link href="/wallet-login">
                  <Button className="w-full eth-send-button">
                    <Wallet className="w-4 h-4 mr-2" />
                    Login to Wallet
                  </Button>
                </Link>
                <Link href="/create-wallet">
                  <Button className="w-full eth-quick-action-button">
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
    <div className="eth-wallet-container">
      {/* Header */}
      <div className="eth-header-card backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="eth-header-icon">
                <img src={ethereumLogoPath} alt="Ethereum" className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">
                  Ethereum Wallet
                </h1>
                <p className="text-sm text-white/70">
                  @{walletHandle}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="eth-network-badge">
                <div className="eth-network-status-dot mr-2"></div>
                Ethereum Mainnet
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="eth-refresh-button"
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
            <Card className="eth-balance-card">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="eth-header-icon">
                      <img src={ethereumLogoPath} alt="Ethereum" className="w-8 h-8" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl eth-balance-text">
                        Ethereum Balance
                      </CardTitle>
                      <p className="text-white/70">
                        Mainnet • {formatAddress(walletAddress || '')}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowBalance(!showBalance)}
                    className="text-white/70 hover:text-white hover:bg-white/10"
                  >
                    {showBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Main Balance Display */}
                  <div className="text-center py-6">
                    <div className="text-4xl font-bold eth-balance-text mb-2">
                      {showBalance ? `${formatAmount(balance)} ETH` : '••••••'}
                    </div>
                    <div className="text-2xl eth-price-text">
                      {showBalance ? formatUsd(parseFloat(balanceUsd)) : '••••••'}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="eth-action-buttons">
                    <Button className="eth-send-button">
                      <Send className="w-4 h-4 mr-2" />
                      Send
                    </Button>
                    <Button className="eth-receive-button">
                      <ArrowDownLeft className="w-4 h-4 mr-2" />
                      Receive
                    </Button>
                    <Button className="eth-swap-button">
                      <ArrowUpDown className="w-4 h-4 mr-2" />
                      Swap
                    </Button>
                  </div>

                  {/* Wallet Address */}
                  <div className="eth-address-container">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white/90 mb-1">
                          Wallet Address
                        </p>
                        <p className="eth-address-text">
                          {formatAddress(walletAddress || '')}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(walletAddress || '', toast)}
                          className="text-white/70 hover:text-white hover:bg-white/10"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10">
                              <QrCode className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="eth-modal-content">
                            <DialogHeader className="eth-modal-header">
                              <DialogTitle className="eth-modal-title">Ethereum Address QR Code</DialogTitle>
                            </DialogHeader>
                            <div className="eth-qr-container">
                              <QRCode.QRCodeSVG value={walletAddress || ''} size={200} />
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions Sidebar */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <Card className="eth-stats-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg eth-balance-text">
                  Quick Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="eth-stats-item flex items-center justify-between">
                  <span className="text-white/70">Network</span>
                  <Badge variant="outline" className="eth-network-badge">
                    Ethereum
                  </Badge>
                </div>
                <div className="eth-stats-item flex items-center justify-between">
                  <span className="text-white/70">Balance</span>
                  <span className="font-medium eth-balance-text">
                    {formatAmount(balance)} ETH
                  </span>
                </div>
                <div className="eth-stats-item flex items-center justify-between">
                  <span className="text-white/70">USD Value</span>
                  <span className="font-medium eth-balance-text">
                    {formatUsd(parseFloat(balanceUsd))}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="eth-stats-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg eth-balance-text">
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="eth-quick-actions">
                <Button className="w-full eth-send-button justify-start">
                  <Send className="w-4 h-4 mr-2" />
                  Send ETH
                </Button>
                <Button className="w-full eth-receive-button justify-start">
                  <ArrowDownLeft className="w-4 h-4 mr-2" />
                  Receive ETH
                </Button>
                <Button className="w-full eth-swap-button justify-start">
                  <ArrowUpDown className="w-4 h-4 mr-2" />
                  Swap Tokens
                </Button>
                <Button className="w-full eth-quick-action-button">
                  <History className="w-4 h-4 mr-2" />
                  Transaction History
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Tokens Section */}
        <Card className="mt-6 eth-balance-card" data-testid="tokens-section">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 eth-balance-text">
              <Coins className="w-5 h-5" />
              ERC-20 Tokens
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tokensLoading ? (
              <div className="text-center py-8" data-testid="tokens-loading">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4 eth-loading-spinner"></div>
                <p className="eth-loading-text">Loading tokens...</p>
              </div>
            ) : tokens.length === 0 ? (
              <div className="text-center py-8" data-testid="tokens-empty">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{background: 'rgba(98, 126, 234, 0.1)'}}>
                  <Coins className="w-8 h-8" style={{color: 'var(--eth-accent)'}} />
                </div>
                <p className="text-white/70 mb-2">No tokens yet</p>
                <p className="text-sm text-white/50">
                  Your ERC-20 tokens will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-3" data-testid="tokens-list">
                {tokens.map((token: any, index: number) => (
                  <div key={`${token.contractAddress}-${index}`} className="eth-token-card p-3" data-testid={`token-item-${token.symbol}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{background: 'var(--eth-primary)'}} data-testid={`token-logo-${token.symbol}`}>
                        {token.symbol?.substring(0, 2)?.toUpperCase() || 'TK'}
                      </div>
                      <div>
                        <p className="font-medium eth-balance-text" data-testid={`token-symbol-${token.symbol}`}>
                          {token.symbol}
                        </p>
                        <p className="text-sm text-white/70" data-testid={`token-name-${token.symbol}`}>
                          {token.name || formatAddress(token.contractAddress)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium eth-balance-text" data-testid={`token-balance-${token.symbol}`}>
                        {formatTokenBalance(token.balance, token.decimals)} {token.symbol}
                      </p>
                      {token.balanceUsd && parseFloat(token.balanceUsd) > 0 && (
                        <p className="text-sm text-white/70" data-testid={`token-usd-${token.symbol}`}>
                          {formatUsd(parseFloat(token.balanceUsd))}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Transaction History */}
        <Card className="mt-6 eth-balance-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 eth-balance-text">
              <History className="w-5 h-5" />
              Recent Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {transactionsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4 eth-loading-spinner"></div>
                <p className="eth-loading-text">Loading transactions...</p>
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{background: 'rgba(98, 126, 234, 0.1)'}}>
                  <History className="w-8 h-8" style={{color: 'var(--eth-accent)'}} />
                </div>
                <p className="text-white/70 mb-2">No transactions yet</p>
                <p className="text-sm text-white/50">
                  Your Ethereum transaction history will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.map((tx: any, index: number) => (
                  <div key={index} className="eth-token-card p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{background: 'var(--eth-primary)'}}>
                        <ArrowUpRight className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="font-medium eth-balance-text">
                          {tx.type || 'Transaction'}
                        </p>
                        <p className="text-sm text-white/70">
                          {formatAddress(tx.hash || '')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium eth-balance-text">
                        {formatAmount(tx.amount || '0')} ETH
                      </p>
                      <p className="text-sm text-white/70">
                        {tx.timestamp ? new Date(tx.timestamp).toLocaleDateString() : 'Recent'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
