import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ArrowLeft, Copy, ExternalLink, Wallet, ImageIcon, TrendingUp, 
  Database, User, Award, Clock, MessageCircle, UserCheck,
  ArrowUpRight, ArrowDownLeft, Send, Receipt, Coins, UserPlus, UserMinus
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatXRP, formatTokenAmount } from '@/utils/formatting';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { ChainLogo } from '@/components/ui/chain-logo';

interface WalletProfile {
  address: string;
  displayName?: string;
  bio?: string;
  profileImage?: string;
  verified?: boolean;
  createdAt?: string;
}

interface WalletNFT {
  nft_id: string;
  nftokenID?: string; // Add this for offer compatibility
  name: string;
  image?: string;
  collection?: string;
  issuer?: string;
  taxon?: number;
  rarity?: string;
  floor_price?: number;
  last_sale_price?: number;
}

interface WalletToken {
  currency: string;
  issuer?: string;
  balance: string;
  value?: number;
  logo?: string;
}

interface NFTOffer {
  offerIndex: string;
  nftokenID: string;
  account: string;
  amount: string;
  amountXRP?: number;
  flags?: any;
  valid?: boolean;
  nftoken?: any;
}

interface WalletMetrics {
  address: string;
  tx_count_30d: number;
  volume_xrp_30d: string;
  volume_usd_30d: string;
  active_days_30d: number;
  unique_counterparties_30d: number;
  nfts_held: number;
  nft_trades_30d: number;
  offers_made_30d: number;
  offers_received_30d: number;
  activity_score: string;
  trading_score: string;
  nft_score: string;
  overall_score: string;
  rank_percentile: string;
  rank_position: number;
  wallet_tier: string;
  is_riddle_wallet: boolean;
  is_verified: boolean;
  computed_at: string;
  expires_at: string;
}

interface LinkedWallet {
  id: string;
  address: string;
  chain: string;
  wallet_type: string;
  verified: boolean;
  wallet_label?: string;
  created_at: string;
}

interface RiddleWalletInfo {
  success: boolean;
  isRiddleWallet: boolean;
  handle?: string;
  primaryWallet?: {
    address: string;
    chain: string;
  };
  linkedWallets?: LinkedWallet[];
}

interface WalletTransaction {
  hash: string;
  type: string;
  account: string;
  destination?: string;
  amount?: string | any;
  delivered_amount?: string | any;
  fee?: string;
  sequence?: number;
  ledgerIndex?: number;
  date?: string;
  timestamp?: number;
  result?: string;
  validated?: boolean;
  memos?: any[];
  destinationTag?: string;
  link?: string;
  details?: any;
}

export default function WalletProfile() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const [profile, setProfile] = useState<WalletProfile | null>(null);
  const [nfts, setNfts] = useState<WalletNFT[]>([]);
  const [tokens, setTokens] = useState<WalletToken[]>([]);
  const [offers, setOffers] = useState<NFTOffer[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [metrics, setMetrics] = useState<WalletMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [nftsLoading, setNftsLoading] = useState(true);
  const [tokensLoading, setTokensLoading] = useState(true);
  const [offersLoading, setOffersLoading] = useState(true);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [isRiddleWallet, setIsRiddleWallet] = useState(false);
  const [riddleWalletInfo, setRiddleWalletInfo] = useState<RiddleWalletInfo | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const walletAddress = params.address;

  // Query to get trader handle for this wallet address
  const { data: traderInfo, isLoading: traderInfoLoading } = useQuery({
    queryKey: ['trader-handle', walletAddress],
    queryFn: async () => {
      if (!walletAddress) return { canFollow: false };
      
      const response = await fetch(`/api/copy-trading/trader-handle/${walletAddress}`);
      if (!response.ok) {
        return { canFollow: false, handle: null };
      }
      
      const data = await response.json() as any;
      return { 
        canFollow: data.success, 
        handle: data.handle,
        address: data.address
      };
    },
    enabled: !!walletAddress,
    refetchInterval: 60000 // Refresh every minute
  });

  // Query to check if current user is following this wallet
  const { data: followStatus, isLoading: followStatusLoading } = useQuery({
    queryKey: ['copy-trading-follow-status', traderInfo?.handle],
    queryFn: async () => {
      const sessionToken = localStorage.getItem('sessionToken');
      if (!sessionToken || !traderInfo?.handle) return { isFollowing: false };
      
      const response = await fetch('/api/copy-trading/subscriptions', {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });
      
      if (!response.ok) return { isFollowing: false };
      
      const data = await response.json() as any;
      const isFollowing = data.subscriptions?.some((sub: any) => 
        sub.traderId === traderInfo.handle && sub.isActive
      );
      
      return { isFollowing: !!isFollowing };
    },
    enabled: !!localStorage.getItem('sessionToken') && !!traderInfo?.handle,
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Mutation to follow/unfollow a trader
  const followMutation = useMutation({
    mutationFn: async ({ action, traderHandle }: { action: 'follow' | 'unfollow', traderHandle: string }) => {
      const sessionToken = localStorage.getItem('sessionToken');
      if (!sessionToken) throw new Error('Authentication required');
      
      if (action === 'follow') {
        const response = await apiRequest('/api/copy-trading/subscriptions', {
          method: 'POST',
          body: JSON.stringify({
            traderId: traderHandle, // Use handle instead of address
            copyAmount: '1000', // Default copy amount
            maxPercentage: 10,   // Default 10% of portfolio
            stopLossPercentage: 20,
            takeProfitPercentage: 50
          }),
          headers: {
            'Authorization': `Bearer ${sessionToken}`
          }
        });
        return response;
      } else {
        // For unfollow, we need to find the subscription ID first
        const subscriptionsResponse = await fetch('/api/copy-trading/subscriptions', {
          headers: { 'Authorization': `Bearer ${sessionToken}` }
        });
        const subscriptionsData = await subscriptionsResponse.json();
        const subscription = subscriptionsData.subscriptions?.find((sub: any) => 
          sub.traderId === traderHandle && sub.isActive
        );
        
        if (subscription) {
          // Delete/deactivate subscription (unfollow)
          const response = await apiRequest(`/api/copy-trading/subscriptions/${subscription.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${sessionToken}` }
          });
          return response;
        }
        throw new Error('Active subscription not found');
      }
    },
    onSuccess: (data, variables) => {
      toast({
        title: variables.action === 'follow' ? 'Now Following!' : 'Unfollowed',
        description: variables.action === 'follow' 
          ? `You are now copying trades from @${variables.traderHandle}` 
          : `You are no longer copying trades from @${variables.traderHandle}`
      });
      
      // Invalidate queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['copy-trading-follow-status', variables.traderHandle] });
      queryClient.invalidateQueries({ queryKey: ['copy-trading-subscriptions'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update follow status',
        variant: 'destructive'
      });
    }
  });

  // Function to load Riddle wallet information and linked wallets
  const loadRiddleWalletInfo = async (address: string) => {
    try {
      console.log(`🔍 Loading Riddle wallet info for: ${address}`);
      const response = await fetch(`/api/linked-wallets/by-address/${address}`);
      
      if (response.ok) {
        const data: RiddleWalletInfo = await response.json() as any;
        setRiddleWalletInfo(data);
        console.log(`📋 Riddle wallet info loaded:`, data);
      } else {
        // Not a Riddle wallet or no linked wallets
        setRiddleWalletInfo({ 
          success: false, 
          isRiddleWallet: false 
        });
      }
    } catch (error) {
      console.error('❌ Failed to load Riddle wallet info:', error);
      setRiddleWalletInfo({ 
        success: false, 
        isRiddleWallet: false 
      });
    }
  };

  const handleFollowToggle = () => {
    if (!localStorage.getItem('sessionToken')) {
      toast({
        title: 'Authentication Required',
        description: 'Please log in to follow traders',
        variant: 'destructive'
      });
      return;
    }
    
    if (!traderInfo?.handle) {
      toast({
        title: 'Cannot Follow',
        description: 'This wallet is not registered for copy trading',
        variant: 'destructive'
      });
      return;
    }
    
    const action = followStatus?.isFollowing ? 'unfollow' : 'follow';
    followMutation.mutate({ action, traderHandle: traderInfo.handle });
  };

  useEffect(() => {
    if (walletAddress) {
      console.log(`Loading wallet profile for: ${walletAddress}`);
      fetchWalletProfile(walletAddress);
      fetchWalletNFTs(walletAddress);
      fetchWalletTokens(walletAddress);
      fetchWalletOffers(walletAddress);
      fetchWalletTransactions(walletAddress);
      fetchWalletMetrics(walletAddress);
      checkRiddleWallet(walletAddress);
      loadRiddleWalletInfo(walletAddress);
    }
  }, [walletAddress]);

  const checkRiddleWallet = async (address: string) => {
    try {
      const sessionData = localStorage.getItem('sessionData');
      if (sessionData) {
        const session = JSON.parse(sessionData);
        if (session.wallets?.xrp?.address === address) {
          setIsRiddleWallet(true);
        }
      }
      // Could also check database for registered Riddle wallets
    } catch (e) {
      console.log('Error checking Riddle wallet:', e);
    }
  };

  const fetchWalletProfile = async (address: string) => {
    setLoading(true);
    try {
      // Try to get profile from database first
      const response = await fetch(`/api/wallet/profile/${address}`);
      if (response.ok) {
        const data = await response.json() as any;
        setProfile(data);
      } else {
        // Create basic profile if not found
        setProfile({
          address,
          displayName: `${address.slice(0, 8)}...${address.slice(-8)}`,
          verified: false
        });
      }
    } catch (error) {
      console.error('Error fetching wallet profile:', error);
      setProfile({
        address,
        displayName: `${address.slice(0, 8)}...${address.slice(-8)}`,
        verified: false
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchWalletNFTs = async (address: string) => {
    setNftsLoading(true);
    try {
      // Use public endpoint - no authentication required
      const response = await fetch(`/api/wallet/nfts-public/${address}`);
      if (response.ok) {
        const data = await response.json() as any;
        console.log(`✅ [WALLET PROFILE] Fetched ${data.nfts?.length || 0} NFTs for ${address}`);
        setNfts(data.nfts || []);
      } else {
        console.error('❌ [WALLET PROFILE] Failed to fetch wallet NFTs:', response.status);
        setNfts([]);
      }
    } catch (error) {
      console.error('❌ [WALLET PROFILE] Error fetching wallet NFTs:', error);
      setNfts([]);
    } finally {
      setNftsLoading(false);
    }
  };

  const fetchWalletTokens = async (address: string) => {
    setTokensLoading(true);
    try {
      // Fetch XRP balance first
      const xrpResponse = await fetch(`/api/xrpl/balance/${address}`);
      const tokensData: WalletToken[] = [];
      
      if (xrpResponse.ok) {
        const xrpData = await xrpResponse.json();
        // Add XRP balance as primary token
        if (xrpData.success && xrpData.balance) {
          tokensData.push({
            currency: 'XRP',
            balance: xrpData.balance,
            value: xrpData.usdValue || 0,
            logo: '/images/chains/xrp.png'
          });
        }
      }
      
      // Try to fetch additional tokens/trustlines
      try {
        const response = await fetch(`/api/xrpl/tokens/${address}`);
        if (response.ok) {
          const data = await response.json() as any;
          if (data.tokens) {
            tokensData.push(...data.tokens);
          }
        }
      } catch (e) {
        console.log('Additional tokens not available:', e);
      }
      
      setTokens(tokensData);
      
    } catch (error) {
      console.error('Error fetching wallet tokens:', error);
    } finally {
      setTokensLoading(false);
    }
  };

  const fetchWalletOffers = async (address: string) => {
    setOffersLoading(true);
    try {
      const response = await fetch(`/api/nft-offers-public/${address}`);
      if (response.ok) {
        const data = await response.json() as any;
        console.log(`Fetched ${data.length || 0} offers for wallet`);
        setOffers(data || []);
      }
    } catch (error) {
      console.error('Error fetching wallet offers:', error);
      setOffers([]);
    } finally {
      setOffersLoading(false);
    }
  };

  const fetchWalletTransactions = async (address: string) => {
    setTransactionsLoading(true);
    try {
      const response = await fetch(`/api/wallets/xrp/transactions/${address}?limit=15`);
      if (response.ok) {
        const data = await response.json() as any;
        console.log(`✅ [WALLET TRANSACTIONS] Fetched ${data.transactions?.length || 0} transactions for ${address}`);
        // Handle different response formats from Bithomp API
        const transactionsList = data.transactions || data.items || data || [];
        setTransactions(transactionsList);
      } else {
        console.error('❌ [WALLET TRANSACTIONS] Failed to fetch transactions:', response.status);
        setTransactions([]);
      }
    } catch (error) {
      console.error('❌ [WALLET TRANSACTIONS] Error fetching transactions:', error);
      setTransactions([]);
    } finally {
      setTransactionsLoading(false);
    }
  };

  const fetchWalletMetrics = async (address: string) => {
    setMetricsLoading(true);
    try {
      const response = await fetch(`/api/wallet/${address}/metrics`);
      if (response.ok) {
        const data = await response.json() as any;
        console.log(`✅ [WALLET METRICS] Fetched metrics for ${address}:`, data.metrics);
        setMetrics(data.metrics);
        if (data.metrics?.is_riddle_wallet) {
          setIsRiddleWallet(true);
        }
      } else {
        console.error('❌ [WALLET METRICS] Failed to fetch metrics:', response.status);
        setMetrics(null);
      }
    } catch (error) {
      console.error('❌ [WALLET METRICS] Error fetching metrics:', error);
      setMetrics(null);
    } finally {
      setMetricsLoading(false);
    }
  };

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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Address copied to clipboard"
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
            <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!profile || !walletAddress) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="p-6 text-center">
              <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">Wallet Not Found</h2>
              <p className="text-gray-600 dark:text-gray-400">The requested wallet could not be loaded.</p>
              <Button onClick={() => setLocation('/nft-marketplace')} className="mt-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Marketplace
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header with Back Button */}
        <div className="flex items-center justify-between mb-8">
          <Button 
            variant="ghost" 
            onClick={() => setLocation('/nft-marketplace')}
            className="flex items-center gap-2 text-gray-700 dark:text-gray-300"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Marketplace
          </Button>
        </div>

        {/* Profile Header */}
        <Card className="mb-8 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                {profile.profileImage ? (
                  <img
                    src={profile.profileImage}
                    alt="Profile"
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  <User className="h-8 w-8 text-white" />
                )}
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {profile.displayName || `${walletAddress.slice(0, 8)}...${walletAddress.slice(-8)}`}
                  </h1>
                  {profile.verified && (
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      <Award className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-mono text-sm text-gray-600 dark:text-gray-400">
                    {walletAddress}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(walletAddress)}
                    className="h-6 w-6 p-0"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                
                {profile.bio && (
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    {profile.bio}
                  </p>
                )}
              </div>
              
              <div className="flex gap-2 flex-wrap">
                {isRiddleWallet && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setLocation(`/social/@${walletAddress}`)}
                      className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                    >
                      <UserCheck className="h-4 w-4 mr-2" />
                      Profile
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => toast({ title: 'Messaging coming soon', description: 'This feature is under development' })}
                      className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Message
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  onClick={() => window.open(`https://xrpl.org/accounts/${walletAddress}`, '_blank')}
                  className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  XRPL
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Wallet Activity & Ranking Metrics */}
        {metrics && (
          <Card className="mb-8 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Wallet Performance & Ranking
                {metrics.is_verified && (
                  <Badge variant="secondary" className="ml-2">
                    <UserCheck className="h-3 w-3 mr-1" />
                    Verified
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                
                {/* Wallet Tier */}
                <div className="text-center">
                  <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${metrics.wallet_tier === 'legend' ? 'bg-purple-500/20' : 
                    metrics.wallet_tier === 'diamond' ? 'bg-cyan-500/20' : 
                    metrics.wallet_tier === 'gold' ? 'bg-yellow-500/20' : 
                    metrics.wallet_tier === 'silver' ? 'bg-gray-500/20' : 'bg-orange-500/20'} mb-2`}>
                    <span className="text-2xl">
                      {metrics.wallet_tier === 'legend' ? '🏆' : 
                       metrics.wallet_tier === 'diamond' ? '💎' : 
                       metrics.wallet_tier === 'gold' ? '🥇' : 
                       metrics.wallet_tier === 'silver' ? '🥈' : '🥉'}
                    </span>
                  </div>
                  <div className={`font-semibold ${metrics.wallet_tier === 'legend' ? 'text-purple-400' : 
                    metrics.wallet_tier === 'diamond' ? 'text-cyan-400' : 
                    metrics.wallet_tier === 'gold' ? 'text-yellow-400' : 
                    metrics.wallet_tier === 'silver' ? 'text-gray-400' : 'text-orange-400'}`}>
                    {metrics.wallet_tier.charAt(0).toUpperCase() + metrics.wallet_tier.slice(1)} Tier
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Score: {metrics.overall_score}
                  </div>
                </div>

                {/* Activity Score */}
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-400 mb-1">{metrics.activity_score}</div>
                  <div className="font-semibold text-gray-900 dark:text-white">Activity Score</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {metrics.tx_count_30d} transactions
                  </div>
                </div>

                {/* Trading Score */}
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-400 mb-1">{metrics.trading_score}</div>
                  <div className="font-semibold text-gray-900 dark:text-white">Trading Score</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {parseFloat(metrics.volume_xrp_30d).toFixed(2)} XRP volume
                  </div>
                </div>

                {/* NFT Score */}
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-400 mb-1">{metrics.nft_score}</div>
                  <div className="font-semibold text-gray-900 dark:text-white">NFT Score</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {metrics.nfts_held} NFTs owned
                  </div>
                </div>

              </div>

              {/* Activity Statistics */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">30-Day Activity Summary</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                    <div className="text-gray-600 dark:text-gray-400">Active Days</div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">{metrics.active_days_30d}</div>
                  </div>
                  
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                    <div className="text-gray-600 dark:text-gray-400">Counterparties</div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">{metrics.unique_counterparties_30d}</div>
                  </div>
                  
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                    <div className="text-gray-600 dark:text-gray-400">NFT Trades</div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">{metrics.nft_trades_30d}</div>
                  </div>
                  
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                    <div className="text-gray-600 dark:text-gray-400">Offers Made</div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">{metrics.offers_made_30d}</div>
                  </div>

                </div>
              </div>

              {/* Copy Trading Button - Show for registered traders that aren't the current user */}
              {walletAddress && !isRiddleWallet && traderInfo?.canFollow && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                  <Button 
                    className={`w-full ${
                      followStatus?.isFollowing 
                        ? 'bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700' 
                        : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'
                    } text-white transition-all duration-200`}
                    data-testid="button-copy-trading"
                    onClick={handleFollowToggle}
                    disabled={followMutation.isPending || followStatusLoading}
                  >
                    {followMutation.isPending ? (
                      <>
                        <Clock className="h-4 w-4 mr-2 animate-spin" />
                        {followStatus?.isFollowing ? 'Unfollowing...' : 'Following...'}
                      </>
                    ) : followStatus?.isFollowing ? (
                      <>
                        <UserMinus className="h-4 w-4 mr-2" />
                        Unfollow Trader
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Follow & Copy Trades
                      </>
                    )}
                  </Button>
                  
                  <p className="text-xs text-center text-gray-600 dark:text-gray-400 mt-2">
                    {followStatus?.isFollowing 
                      ? 'Currently copying this wallet\'s trading strategies' 
                      : 'Copy this wallet\'s successful trading strategies automatically'
                    }
                  </p>
                  
                  {followStatus?.isFollowing && (
                    <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <p className="text-xs text-blue-600 dark:text-blue-400 text-center">
                        ✓ Active copy trading • Default: $1,000 per trade • Max 10% portfolio
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Linked Wallets - Show for Riddle wallets */}
              {riddleWalletInfo?.isRiddleWallet && riddleWalletInfo.linkedWallets && riddleWalletInfo.linkedWallets.length > 0 && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                    <Wallet className="h-4 w-4 mr-2" />
                    Linked Wallets {riddleWalletInfo.handle && `(@${riddleWalletInfo.handle})`}
                  </h4>
                  <div className="space-y-3">
                    {riddleWalletInfo.linkedWallets.map((wallet) => (
                      <div
                        key={wallet.id}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <ChainLogo
                            chain={wallet.chain}
                            iconUrl={getChainIconUrl(wallet.chain)}
                            size="sm"
                          />
                          <div>
                            <div className="font-mono text-sm text-gray-900 dark:text-white">
                              {wallet.address.length > 20 
                                ? `${wallet.address.slice(0, 8)}...${wallet.address.slice(-8)}`
                                : wallet.address
                              }
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {wallet.wallet_label || `${wallet.chain.toUpperCase()} • ${wallet.wallet_type}`}
                              {wallet.verified && <span className="text-green-500 ml-1">✓</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setLocation(`/wallet/${wallet.address}`)}
                            data-testid={`link-wallet-${wallet.chain}`}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            View
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(wallet.address)}
                            data-testid={`copy-wallet-${wallet.chain}`}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    These wallets are verified as owned by the same user across different blockchain networks.
                  </p>
                </div>
              )}

            </CardContent>
          </Card>
        )}

        {/* Loading State for Metrics */}
        {metricsLoading && (
          <Card className="mb-8 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Loading Wallet Performance...
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="text-center">
                    <Skeleton className="w-16 h-16 rounded-full mx-auto mb-2" />
                    <Skeleton className="h-4 w-20 mx-auto mb-1" />
                    <Skeleton className="h-3 w-16 mx-auto" />
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <Skeleton className="h-5 w-40 mb-3" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                      <Skeleton className="h-3 w-16 mb-2" />
                      <Skeleton className="h-6 w-8" />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Wallet Content Tabs */}
        <Tabs defaultValue="nfts" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-white dark:bg-gray-800">
            <TabsTrigger value="nfts" className="text-gray-700 dark:text-gray-300">NFTs</TabsTrigger>
            <TabsTrigger value="tokens" className="text-gray-700 dark:text-gray-300">Tokens</TabsTrigger>
            <TabsTrigger value="transactions" className="text-gray-700 dark:text-gray-300">Transactions</TabsTrigger>
          </TabsList>
          
          <TabsContent value="nfts" className="space-y-4 mt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Owned NFTs ({nfts.length})
              </h2>
            </div>
            
            {nftsLoading ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Card key={i} className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                    <CardContent className="p-0">
                      <Skeleton className="aspect-square w-full" />
                      <div className="p-3">
                        <Skeleton className="h-4 w-3/4 mb-2" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : nfts.length === 0 ? (
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardContent className="p-8 text-center">
                  <ImageIcon className="h-16 w-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
                  <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">No NFTs Found</h3>
                  <p className="text-gray-600 dark:text-gray-400">This wallet doesn't own any NFTs yet.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {nfts.map((nft, index) => (
                  <Card 
                    key={nft.nft_id || `nft-${index}`}
                    className="hover:shadow-lg transition-all hover:scale-105 cursor-pointer bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 overflow-hidden group"
                    onClick={() => {
                      const nftId = nft.nft_id || nft.nftokenID;
                      if (nftId) {
                        console.log(`Navigating to NFT: ${nftId}`);
                        setLocation(`/nft/${nftId}`);
                      }
                    }}
                  >
                    <CardContent className="p-0 h-full flex flex-col">
                      <div className="relative w-full aspect-square overflow-hidden bg-gray-100 dark:bg-gray-700">
                        {(nft.nft_id || nft.nftokenID) ? (
                          <img
                            src={`/api/nft-images/${nft.nft_id || nft.nftokenID}`}
                            alt={nft.name || 'NFT'}
                            className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                            onLoad={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.opacity = '1';
                            }}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              console.log(`❌ NFT image failed to load: ${target.src}`);
                              // Fallback to simple icon
                              target.style.display = 'none';
                            }}
                            style={{ opacity: '0', transition: 'opacity 0.3s ease' }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="h-12 w-12 text-gray-400 dark:text-gray-600" />
                          </div>
                        )}
                        
                        {nft.rarity && (
                          <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
                            {nft.rarity}
                          </div>
                        )}
                      </div>
                      
                      <div className="p-3 flex-1 flex flex-col">
                        <h3 className="font-semibold text-sm mb-1 truncate text-gray-900 dark:text-white">
                          {nft.name || `NFT #${(nft.nft_id || '').slice(-6) || index}`}
                        </h3>
                        {nft.collection && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 truncate">
                            {nft.collection.includes(':') ? 
                              `${nft.issuer?.slice(0, 8)}...${nft.issuer?.slice(-4)} #${nft.taxon || '0'}` : 
                              nft.collection
                            }
                          </p>
                        )}
                        
                        {(nft.floor_price || nft.last_sale_price) && (
                          <div className="space-y-1 mt-auto">
                            {nft.floor_price && nft.floor_price > 0 && (
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-600 dark:text-gray-400">Floor:</span>
                                <span className="font-semibold text-gray-900 dark:text-white">{formatXRP(nft.floor_price)} XRP</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="tokens" className="space-y-4 mt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Token Holdings ({tokens.length})
              </h2>
            </div>
            
            {tokensLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Card key={i} className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-1/3" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                        <Skeleton className="h-6 w-20" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : tokens.length === 0 ? (
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardContent className="p-8 text-center">
                  <Wallet className="h-16 w-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
                  <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">No Tokens Found</h3>
                  <p className="text-gray-600 dark:text-gray-400">This wallet doesn't hold any tokens yet.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {tokens.map((token, index) => (
                  <Card 
                    key={`${token.currency}-${token.issuer || 'native'}-${index}`} 
                    className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all cursor-pointer"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                            {token.logo ? (
                              <img src={token.logo} alt={token.currency} className="h-full w-full rounded-full object-cover" />
                            ) : (
                              <span className="text-white font-bold text-sm">
                                {token.currency.slice(0, 2).toUpperCase()}
                              </span>
                            )}
                          </div>
                          
                          <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white">{token.currency}</h3>
                            {token.issuer && (
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                {token.issuer.slice(0, 8)}...{token.issuer.slice(-6)}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {formatTokenAmount(token.balance)} {token.currency}
                          </div>
                          {token.value && token.value > 0 && (
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              ≈ ${token.value.toFixed(2)}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="transactions" className="space-y-4 mt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Recent Transactions ({transactions.length})
              </h2>
            </div>
            
            {transactionsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Card key={i} className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-8 w-8 rounded-full" />
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-3 w-32" />
                          </div>
                        </div>
                        <div className="text-right space-y-1">
                          <Skeleton className="h-4 w-16" />
                          <Skeleton className="h-3 w-12" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : transactions.length === 0 ? (
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardContent className="p-8 text-center">
                  <Clock className="h-16 w-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
                  <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">No Transactions Found</h3>
                  <p className="text-gray-600 dark:text-gray-400">This wallet hasn't made any transactions yet.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {transactions.map((tx, index) => {
                  const isOutgoing = tx.account === walletAddress;
                  const counterparty = isOutgoing ? tx.destination : tx.account;
                  const txType = tx.type || 'Payment';
                  
                  // Handle both XRP drops (string) and currency objects
                  const formatAmount = (amt: any) => {
                    if (!amt) return null;
                    
                    if (typeof amt === 'string') {
                      // XRP in drops - convert to XRP
                      const xrpAmount = parseFloat(amt) / 1000000;
                      return { value: xrpAmount, currency: 'XRP', formatted: `${xrpAmount.toFixed(6)} XRP` };
                    } else if (typeof amt === 'object' && amt.currency && amt.value) {
                      // Issued currency object
                      return { 
                        value: parseFloat(amt.value), 
                        currency: amt.currency, 
                        issuer: amt.issuer,
                        formatted: `${parseFloat(amt.value).toFixed(6)} ${amt.currency}`
                      };
                    }
                    return null;
                  };
                  
                  const amount = formatAmount(tx.delivered_amount || tx.amount);
                  const fee = tx.fee ? parseFloat(tx.fee) / 1000000 : 0;
                  
                  return (
                    <Card 
                      key={tx.hash || `tx-${index}`} 
                      className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all cursor-pointer"
                      onClick={() => {
                        if (tx.link) {
                          window.open(tx.link, '_blank');
                        }
                      }}
                      data-testid={`transaction-${tx.hash}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {/* Transaction Type Icon */}
                            <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                              txType.toLowerCase().includes('payment') ? 'bg-blue-100 dark:bg-blue-900' :
                              txType.toLowerCase().includes('offer') ? 'bg-green-100 dark:bg-green-900' :
                              txType.toLowerCase().includes('nft') ? 'bg-purple-100 dark:bg-purple-900' :
                              txType.toLowerCase().includes('trustset') ? 'bg-yellow-100 dark:bg-yellow-900' :
                              'bg-gray-100 dark:bg-gray-700'
                            }`}>
                              {txType.toLowerCase().includes('payment') ? (
                                isOutgoing ? (
                                  <ArrowUpRight className="h-4 w-4 text-red-600 dark:text-red-400" />
                                ) : (
                                  <ArrowDownLeft className="h-4 w-4 text-green-600 dark:text-green-400" />
                                )
                              ) : txType.toLowerCase().includes('offer') ? (
                                <Database className="h-4 w-4 text-green-600 dark:text-green-400" />
                              ) : txType.toLowerCase().includes('nft') ? (
                                <ImageIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                              ) : txType.toLowerCase().includes('trustset') ? (
                                <Coins className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                              ) : (
                                <Receipt className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                              )}
                            </div>
                            
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-900 dark:text-white">
                                  {txType}
                                </span>
                                {tx.validated === false && (
                                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 text-xs">
                                    Pending
                                  </Badge>
                                )}
                              </div>
                              
                              {counterparty && (
                                <p className="text-xs text-gray-600 dark:text-gray-400">
                                  {isOutgoing ? 'To: ' : 'From: '}
                                  {counterparty.length > 20 ? 
                                    `${counterparty.slice(0, 8)}...${counterparty.slice(-6)}` : 
                                    counterparty
                                  }
                                </p>
                              )}
                              
                              {tx.date && (
                                <p className="text-xs text-gray-500 dark:text-gray-500">
                                  {new Date(tx.date).toLocaleDateString()} {new Date(tx.date).toLocaleTimeString()}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          <div className="text-right">
                            {amount && (
                              <div>
                                <div className={`font-semibold ${
                                  isOutgoing ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                                }`}>
                                  {isOutgoing ? '-' : '+'}{amount.formatted}
                                </div>
                                
                                {amount.issuer && amount.currency !== 'XRP' && (
                                  <p className="text-xs text-gray-500 dark:text-gray-500">
                                    Issuer: {amount.issuer.slice(0, 8)}...{amount.issuer.slice(-4)}
                                  </p>
                                )}
                              </div>
                            )}
                            
                            {fee > 0 && (
                              <p className="text-xs text-gray-500 dark:text-gray-500">
                                Fee: {fee.toFixed(6)} XRP
                              </p>
                            )}
                            
                            {tx.result && tx.result !== 'tesSUCCESS' && (
                              <p className="text-xs text-red-500 dark:text-red-400">
                                {tx.result}
                              </p>
                            )}
                            
                            {tx.sequence && (
                              <p className="text-xs text-gray-400 dark:text-gray-600">
                                #{tx.sequence}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        {/* Transaction Hash */}
                        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono text-gray-500 dark:text-gray-500">
                              {tx.hash ? `${tx.hash.slice(0, 12)}...${tx.hash.slice(-8)}` : 'No hash'}
                            </span>
                            <div className="flex items-center gap-2">
                              {tx.hash && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyToClipboard(tx.hash);
                                  }}
                                  className="h-6 w-6 p-0"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              )}
                              {tx.link && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(tx.link, '_blank');
                                  }}
                                  className="h-6 w-6 p-0"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
