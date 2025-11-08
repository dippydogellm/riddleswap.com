import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useOptimizedWalletData } from '@/lib/wallet-query-optimizer';
import { BalanceData } from '@/lib/balance-fetcher';
import '@/styles/sol-wallet.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, 
  RefreshCw, 
  Send, 
  Download,
  ArrowUpDown,
  Copy,
  Check,
  Coins,
  Clock
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { QuickSwap } from '@/components/wallet/QuickSwap';
import { PaymentQRCode } from '@/components/wallet/PaymentQRCode';
import { SendModal } from '@/components/wallet/SendModal';
import { ReceiveModal } from '@/components/wallet/ReceiveModal';

export default function SolWallet() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Use unified authentication
  const { authData, isLoading: authLoading, isAuthenticated, sessionToken } = useAuth();
  
  // State declarations after hooks
  const [copied, setCopied] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);

  // Get the wallet address from auth data
  const solAddress = authData?.walletAddresses?.sol || authData?.walletData?.solAddress;
  
  console.log('🔍 [SOL WALLET] authData:', authData);
  console.log('🔍 [SOL WALLET] walletAddresses:', authData?.walletAddresses);
  console.log('🔍 [SOL WALLET] solAddress:', solAddress);
  
  // Use optimized wallet data hook with proper authentication guards
  const walletDataQuery = useOptimizedWalletData('sol', solAddress, {
    includeTokens: true,
    includeNFTs: true,
    includeTransactions: true,
    includePortfolio: true
  });

  const { isLoading, error, refetchAll } = walletDataQuery;
  const balanceData = walletDataQuery.balance.data as BalanceData | undefined;
  const tokensData = walletDataQuery.tokens.data as any;
  const nftsData = walletDataQuery.nfts.data as any;
  const transactionsData = walletDataQuery.transactions.data as any;

  const walletData = balanceData ? { 
    address: solAddress,
    balance: balanceData.balance,
    balanceUsd: balanceData.balanceUsd,
    tokens: tokensData?.tokens || [],
    nfts: nftsData?.nfts || [],
    transactions: transactionsData?.transactions || []
  } : null;

  // Check authentication first
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 sol-loading-spinner mx-auto mb-4"></div>
          <p className="sol-loading-text">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !sessionToken) {
    return null; // useAuth will handle redirect
  }

  const handleCopyAddress = () => {
    if (walletData?.address) {
      navigator.clipboard.writeText(walletData.address);
      setCopied(true);
      toast({
        title: "Address Copied",
        description: "Solana address copied to clipboard"
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRefresh = async () => {
    try {
      await refetchAll();
      toast({
        title: "Refreshed!",
        description: "Solana wallet data updated"
      });
    } catch (error) {
      toast({
        title: "Refresh failed",
        description: "Please try again",
        variant: "destructive"
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 sol-loading-spinner mx-auto mb-4"></div>
          <p className="sol-loading-text">Loading Solana wallet...</p>
        </div>
      </div>
    );
  }

  if (!walletData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-bold mb-4 sol-balance-text">Solana Wallet Error</h2>
            <p className="sol-error mb-4">Failed to load wallet data</p>
            <Button onClick={() => setLocation('/wallet-login')}>
              Return to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="sol-wallet-container py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => setLocation('/wallet-dashboard')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <div className="sol-header-icon">
                  🟣
                </div>
                Solana Wallet
              </h1>
              <p className="sol-loading-text">
                Solana Mainnet • Live Balance
              </p>
            </div>
          </div>
          <Button onClick={handleRefresh} className="sol-refresh-button">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Wallet Overview */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="sol-balance-card">
              <CardHeader>
                <CardTitle className="sol-balance-text">Wallet Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Address */}
                  <div>
                    <label className="text-sm font-medium sol-balance-text">Wallet Address</label>
                    <div className="sol-address-container">
                      <input
                        value={walletData.address}
                        readOnly
                        className="sol-address-text"
                      />
                      <Button size="icon" variant="outline" onClick={handleCopyAddress}>
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Balance */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="sol-balance-card p-4">
                      <label className="text-sm font-medium sol-balance-text">SOL Balance</label>
                      <p className="text-3xl font-bold sol-balance-text mt-1">
                        {walletData.balance} SOL
                      </p>
                    </div>
                    <div className="sol-balance-card p-4">
                      <label className="text-sm font-medium sol-balance-text">USD Value</label>
                      <p className="text-3xl font-bold sol-price-text mt-1">
                        ${balanceData?.balanceUsd || '0.00'}
                      </p>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="sol-action-buttons">
                    <Button 
                      className="sol-send-button"
                      onClick={() => setShowSendModal(true)}
                      disabled={!walletData.address}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Send
                    </Button>
                    <Button 
                      className="sol-receive-button"
                      onClick={() => setShowReceiveModal(true)}
                      disabled={!walletData.address}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Receive
                    </Button>
                    <Button className="sol-swap-button">
                      <ArrowUpDown className="w-4 h-4 mr-2" />
                      Swap
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* SPL Tokens */}
            <Card className="sol-balance-card">
              <CardHeader>
                <CardTitle className="sol-balance-text">SPL Tokens ({walletData.tokens?.length || 0})</CardTitle>
              </CardHeader>
              <CardContent>
                {walletData.tokens && walletData.tokens.length > 0 ? (
                  <div className="space-y-3">
                    {walletData.tokens.map((token: any, index: number) => (
                      <div key={index} className="sol-spl-token-card">
                        <div className="flex items-center gap-3">
                          {token.logo ? (
                            <img 
                              src={token.logo} 
                              alt={`${token.symbol} logo`} 
                              className="w-8 h-8 rounded-full object-cover"
                              onError={(e) => {
                                // Fallback to generic icon if logo fails to load
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const fallback = target.nextElementSibling as HTMLElement;
                                if (fallback) fallback.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div 
                            className="w-8 h-8 bg-purple-200 dark:bg-purple-800 rounded-full flex items-center justify-center sol-spl-token-icon"
                            style={{ display: token.logo ? 'none' : 'flex' }}
                          >
                            <Coins className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-semibold">{token.symbol}</p>
                            <p className="text-xs text-gray-500">{token.name || 'Unknown Token'}</p>
                            <p className="text-xs text-gray-400 font-mono">{token.mint?.slice(0, 10)}...</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{parseFloat(token.balance).toLocaleString()}</p>
                          <p className="text-xs text-green-600 font-semibold">${token.usdValue}</p>
                          <p className="text-xs text-gray-500">{token.decimals} decimals</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center sol-loading-text py-8">No SPL tokens found</p>
                )}
              </CardContent>
            </Card>

            {/* Transaction History */}
            <Card className="sol-balance-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 sol-balance-text">
                  <Clock className="w-5 h-5" />
                  Recent Transactions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {walletData.transactions?.length > 0 ? (
                    walletData.transactions.slice(0, 5).map((tx: any, index: number) => (
                      <div key={index} className="sol-transaction-item">
                        <div className="flex items-center gap-4">
                          <div className={`sol-transaction-icon ${
                            tx.type === 'receive' ? 'receive' : 'send'
                          }`}>
                            {tx.type === 'receive' ? <Download className="w-5 h-5" /> : <Send className="w-5 h-5" />}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-sm">
                              {tx.type === 'receive' ? `Received ${tx.token || 'SOL'}` : `Sent ${tx.token || 'SOL'}`}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(tx.timestamp || tx.date || Date.now()).toLocaleDateString()} • {tx.status || 'Confirmed'}
                            </p>
                            <p className="text-xs text-gray-400 font-mono mt-1">
                              {(tx.signature || tx.txid)?.slice(0, 20)}...
                            </p>
                            {tx.fee && (
                              <p className="text-xs text-gray-400 mt-1">
                                Fee: {tx.fee} SOL
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold text-sm ${
                            tx.type === 'receive' ? 'text-green-600' : 'text-purple-600'
                          }`}>
                            {tx.amount || '0.000000'} {tx.token || 'SOL'}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            ${tx.usd_value || '0.00'}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p className="font-medium sol-balance-text">No recent transactions</p>
                      <p className="text-sm mt-1 sol-loading-text">
                        Transaction history will appear here
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="space-y-6">
            {/* Quick Swap */}
            <QuickSwap
              chain="sol"
              onSwapComplete={handleRefresh}
            />

            {/* Payment QR Code */}
            <PaymentQRCode
              chain="sol"
              address={walletData.address}
            />

            {/* Wallet Stats */}
            <Card className="sol-stats-card">
              <CardHeader>
                <CardTitle className="sol-balance-text">Wallet Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Total Tokens</span>
                    <span className="font-semibold">{walletData.tokens?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Network</span>
                    <span className="font-semibold">Solana Mainnet</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Rent Exempt</span>
                    <span className="font-semibold">~0.002 SOL</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Modals */}
      <SendModal
        isOpen={showSendModal}
        onClose={() => setShowSendModal(false)}
        chain="sol"
        fromAddress={walletData?.address || ''}
        onSendComplete={() => {
          // Refresh wallet data after successful send
          refetchAll();
        }}
      />
      
      <ReceiveModal
        isOpen={showReceiveModal}
        onClose={() => setShowReceiveModal(false)}
        chain="sol"
        address={walletData?.address || ''}
      />
    </div>
  );
}
