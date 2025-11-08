import { useState } from 'react';
import '@/styles/zksync-wallet.css';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { useAuth } from '@/hooks/useAuth';
import { QuickSwap } from '@/components/wallet/QuickSwap';
import { PaymentQRCode } from '@/components/wallet/PaymentQRCode';

export default function ZkSyncWallet() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  
  // Use unified authentication - ALWAYS call hooks at top level
  const { authData, isLoading: authLoading, isAuthenticated, walletData, walletAddresses } = useAuth();
  
  // Get ETH address from walletAddresses (server response format)
  const walletAddress = walletAddresses?.eth || walletData?.eth || walletData?.ethAddress;

  console.log('🔍 [ZKSYNC PAGE] Debugging:', {
    authLoading,
    isAuthenticated,
    walletAddress,
    hasAuthData: !!authData,
    hasSessionToken: !!authData?.sessionToken,
    walletAddresses
  });

  // Fetch zkSync balance using direct endpoint
  const { data: balanceData, isLoading, refetch, error } = useQuery({
    queryKey: ['/api/wallets/zksync/balance', walletAddress],
    queryFn: async () => {
      console.log('🚀 [ZKSYNC QUERY] Starting balance fetch for:', walletAddress);
      const response = await fetch(`/api/wallets/zksync/balance/${walletAddress}`, {
        headers: { 'Authorization': `Bearer ${authData?.sessionToken}` }
      });
      console.log('📥 [ZKSYNC QUERY] Response status:', response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [ZKSYNC QUERY] Error response:', errorText);
        throw new Error(`Failed to fetch balance: ${response.status}`);
      }
      const data = await response.json() as any;
      console.log('✅ [ZKSYNC QUERY] Balance data received:', data);
      return data;
    },
    enabled: !!walletAddress,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  console.log('📊 [ZKSYNC PAGE] Query state:', {
    isLoading,
    hasBalanceData: !!balanceData,
    error: error?.message,
    enabled: !!walletAddress
  });

  const handleCopyAddress = () => {
    if (balanceData?.address) {
      navigator.clipboard.writeText(balanceData.address);
      setCopied(true);
      toast({
        title: "Address Copied",
        description: "zkSync address copied to clipboard"
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRefresh = () => {
    refetch();
    toast({
      title: "Refreshing",
      description: "Updating zkSync wallet data..."
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-700 mx-auto mb-4"></div>
          <p>Loading zkSync wallet...</p>
        </div>
      </div>
    );
  }

  if (!balanceData && !isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-bold mb-4">zkSync Wallet Error</h2>
            <p className="text-gray-600 mb-4">Failed to load wallet data</p>
            <Button onClick={() => setLocation('/wallet-dashboard')}>
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="zksync-wallet-container min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-black py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => setLocation('/wallet-dashboard')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center text-white text-xl">
                  ⚡
                </div>
                zkSync Wallet
              </h1>
              <p className="text-gray-600 dark:text-gray-400">Ethereum Layer 2 zkEVM</p>
            </div>
          </div>
          <Button onClick={handleRefresh} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>

        {/* Wallet Balance Card */}
        <Card className="balance-card mb-8">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Wallet Overview</span>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>zkSync Era</span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Total Balance</p>
                <p className="text-3xl font-bold">{balanceData?.balance || '0.000000'} ETH</p>
                <p className="text-green-600 mt-1">≈ ${balanceData?.balanceUsd || '0.00'} USD</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Wallet Address</p>
                <div className="action-buttons flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <code className="text-sm flex-1 break-all">{balanceData?.address || walletAddress || 'Loading...'}</code>
                  <Button size="sm" variant="ghost" onClick={handleCopyAddress}>
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Tabs */}
        <Tabs defaultValue="transactions" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="send">Send</TabsTrigger>
            <TabsTrigger value="receive">Receive</TabsTrigger>
            <TabsTrigger value="swap">Swap</TabsTrigger>
          </TabsList>

          <TabsContent value="transactions">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Recent Transactions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-gray-500">
                  <Coins className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No recent transactions</p>
                  <p className="text-sm">Transactions will appear here once you start using your zkSync wallet</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="send">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="w-5 h-5" />
                  Send ETH
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-gray-500">
                  <p>Send functionality coming soon</p>
                  <p className="text-sm">You'll be able to send ETH on zkSync Era network</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="receive">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="w-5 h-5" />
                  Receive ETH
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PaymentQRCode 
                  address={walletData?.address || ''} 
                  chain="zkSync Era"
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="swap">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowUpDown className="w-5 h-5" />
                  Swap Tokens
                </CardTitle>
              </CardHeader>
              <CardContent>
                <QuickSwap 
                  chain="eth" 
                  onSwapComplete={handleRefresh}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
