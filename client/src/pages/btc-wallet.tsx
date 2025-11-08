import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import '@/styles/btc-wallet.css';
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
  Activity,
  Clock
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PaymentQRCode } from '@/components/wallet/PaymentQRCode';

export default function BtcWallet() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Use unified authentication
  const { authData, isLoading: authLoading, isAuthenticated, sessionToken } = useAuth();
  
  // State declarations after hooks
  const [copied, setCopied] = useState(false);

  // Get the wallet address from auth data
  const btcAddress = authData?.walletAddresses?.btc || authData?.walletData?.btcAddress;
  
  console.log('🔍 [BTC WALLET] authData:', authData);
  console.log('🔍 [BTC WALLET] walletAddresses:', authData?.walletAddresses);
  console.log('🔍 [BTC WALLET] btcAddress:', btcAddress);
  
  // Fetch BTC balance
  const { data: balanceData, isLoading: balanceLoading, error: balanceError, refetch: refetchBalance } = useQuery({
    queryKey: ['/btc/balance', btcAddress],
    queryFn: async () => {
      console.log('🔍 [BTC WALLET] Fetching balance for:', btcAddress);
      const response = await fetch(`/api/wallets/btc/balance/${btcAddress}`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });
      if (!response.ok) {
        console.error('❌ [BTC WALLET] Balance fetch failed:', response.status);
        throw new Error('Failed to fetch balance');
      }
      const data = await response.json() as any;
      console.log('✅ [BTC WALLET] Balance data:', data);
      return data;
    },
    enabled: !!btcAddress && !!sessionToken && isAuthenticated,
    refetchInterval: 30000
  });

  // Fetch BTC transactions
  const { data: transactionsData, isLoading: transactionsLoading, error: transactionsError, refetch: refetchTransactions } = useQuery({
    queryKey: ['/btc/transactions', btcAddress],
    queryFn: async () => {
      console.log('🔍 [BTC WALLET] Fetching transactions for:', btcAddress);
      const response = await fetch(`/api/wallets/btc/transactions/${btcAddress}`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });
      if (!response.ok) {
        console.error('❌ [BTC WALLET] Transactions fetch failed:', response.status);
        throw new Error('Failed to fetch transactions');
      }
      const data = await response.json() as any;
      console.log('✅ [BTC WALLET] Transactions data:', data);
      return data;
    },
    enabled: !!btcAddress && !!sessionToken && isAuthenticated,
    refetchInterval: false
  });

  const isLoading = balanceLoading || transactionsLoading;
  const walletData = balanceData ? { 
    address: btcAddress,
    balance: balanceData.balance,
    balanceUsd: balanceData.balanceUsd,
    transactions: balanceData.transactions || 0,
    recentTransactions: transactionsData?.transactions || []
  } : null;

  const handleCopyAddress = () => {
    if (walletData?.address) {
      navigator.clipboard.writeText(walletData.address);
      setCopied(true);
      toast({
        title: "Address Copied",
        description: "Bitcoin address copied to clipboard"
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRefresh = () => {
    refetchBalance();
    refetchTransactions();
    toast({
      title: "Refreshing",
      description: "Updating Bitcoin wallet data..."
    });
  };

  // Check authentication first
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 btc-loading-spinner mx-auto mb-4"></div>
          <p className="btc-loading-text">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !sessionToken) {
    return null; // useAuth will handle redirect
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 btc-loading-spinner mx-auto mb-4"></div>
          <p className="btc-loading-text">Loading Bitcoin wallet...</p>
        </div>
      </div>
    );
  }

  if (!walletData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-bold mb-4 btc-balance-text">Bitcoin Wallet Error</h2>
            <p className="btc-error mb-4">Failed to load wallet data</p>
            <Button onClick={() => setLocation('/wallet-login')}>
              Return to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="btc-wallet-container py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => setLocation('/wallet-dashboard')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <div className="btc-header-icon">
                  🟠
                </div>
                Bitcoin Wallet
              </h1>
              <p className="btc-loading-text">
                Bitcoin Mainnet • Live Balance
              </p>
            </div>
          </div>
          <Button onClick={handleRefresh} className="btc-refresh-button">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Wallet Overview */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="btc-balance-card">
              <CardHeader>
                <CardTitle className="btc-balance-text">Wallet Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Address */}
                  <div>
                    <label className="text-sm font-medium btc-balance-text">Wallet Address</label>
                    <div className="btc-address-container">
                      <input
                        value={walletData.address}
                        readOnly
                        className="btc-address-text"
                      />
                      <Button size="icon" variant="outline" onClick={handleCopyAddress}>
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Balance */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="btc-balance-card p-4">
                      <label className="text-sm font-medium btc-balance-text">BTC Balance</label>
                      <p className="text-3xl font-bold btc-balance-text mt-1">
                        {walletData.balance} BTC
                      </p>
                    </div>
                    <div className="btc-balance-card p-4">
                      <label className="text-sm font-medium btc-balance-text">USD Value</label>
                      <p className="text-3xl font-bold btc-price-text mt-1">
                        ${walletData.balanceUsd || '0.00'}
                      </p>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="btc-action-buttons">
                    <Button className="btc-send-button">
                      <Send className="w-4 h-4 mr-2" />
                      Send
                    </Button>
                    <Button className="btc-receive-button">
                      <Download className="w-4 h-4 mr-2" />
                      Receive
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Transaction History */}
            <Card className="btc-balance-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 btc-balance-text">
                  <Activity className="w-5 h-5" />
                  Transaction History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {walletData.recentTransactions?.length > 0 ? (
                    walletData.recentTransactions.slice(0, 5).map((tx: any, index: number) => (
                      <div key={index} className="btc-transaction-item">
                        <div className="flex items-center gap-3">
                          <div className={`btc-transaction-icon ${
                            tx.type === 'receive' ? 'receive' : 'send'
                          }`}>
                            {tx.type === 'receive' ? <Download className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                          </div>
                          <div className="btc-transaction-details">
                            <p className="btc-transaction-type">
                              {tx.type === 'receive' ? 'Received' : 'Sent'}
                            </p>
                            <p className="text-xs btc-loading-text">
                              {new Date(tx.date || Date.now()).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="btc-transaction-amount">
                          <p className={`btc-transaction-amount-value ${
                            tx.type === 'receive' ? 'positive' : 'negative'
                          }`}>
                            {tx.type === 'receive' ? '+' : '-'}{tx.amount} BTC
                          </p>
                          <p className="btc-transaction-amount-usd">
                            ${tx.usd_value || '0.00'}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 btc-loading-text">
                      <p>Total Transactions: {walletData.transactions || 0}</p>
                      <p className="text-sm mt-2">
                        Recent transactions will appear here
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="space-y-6">
            {/* Payment QR Code */}
            <PaymentQRCode
              chain="btc"
              address={walletData.address}
            />

            {/* Wallet Stats */}
            <Card className="btc-stats-card">
              <CardHeader>
                <CardTitle className="btc-balance-text">Wallet Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Total Transactions</span>
                    <span className="font-semibold">{walletData.transactions || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Network</span>
                    <span className="font-semibold">Bitcoin Mainnet</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Address Type</span>
                    <span className="font-semibold">P2PKH</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Network Info */}
            <Card className="btc-stats-card">
              <CardHeader>
                <CardTitle className="btc-balance-text">Network Info</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Network Fee</span>
                    <span className="font-semibold">~10 sat/vB</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Confirmations</span>
                    <span className="font-semibold">6 recommended</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Block Time</span>
                    <span className="font-semibold">~10 minutes</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
