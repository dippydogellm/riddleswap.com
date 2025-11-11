import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Coins, Lock, TrendingUp, Calendar, Award, DollarSign, Plus, Minus, Wallet, ShoppingCart, RefreshCw, ExternalLink, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useSession } from '@/utils/sessionManager';
import { SessionRenewalModal } from '@/components/SessionRenewalModal';

interface StakingPool {
  id: string;
  name: string;
  token: string;
  apy: string;
  lockPeriod: string;
  minStake: string;
  totalStaked: string;
  userStaked: string;
  pendingRewards: string;
  nextRewardDate: string;
  status: 'active' | 'paused' | 'ended';
  rewardSource: 'trading_fees' | 'platform_revenue' | 'partner_rewards';
}

interface UserStaking {
  id: string;
  poolName: string;
  stakedAmount: string;
  rewardsEarned: string;
  currentApy: string;
  stakeDate: string;
  unlockDate: string;
  status: 'active' | 'cooling_down' | 'ready_to_withdraw';
}

interface WalletBalance {
  chain: string;
  token: string;
  balance: string;
  usdValue: string;
}

interface QuickBuyData {
  poolId: string;
  tokenSymbol: string;
  buyAmount: string;
  estimatedTokens: string;
  swapRoute: string;
}

export default function TokenStakingPage() {
  const session = useSession();
  const [stakingPools, setStakingPools] = useState<StakingPool[]>([]);
  const [userStakings, setUserStakings] = useState<UserStaking[]>([]);
  const [stakeAmount, setStakeAmount] = useState('');
  const [selectedPool, setSelectedPool] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [totalRewardsEarned, setTotalRewardsEarned] = useState('0');
  const [totalStaked, setTotalStaked] = useState('0');
  const [walletBalances, setWalletBalances] = useState<WalletBalance[]>([]);
  const [showBuyDialog, setShowBuyDialog] = useState(false);
  const [selectedBuyPool, setSelectedBuyPool] = useState<StakingPool | null>(null);
  const [buyAmount, setBuyAmount] = useState('');
  const [quickBuyData, setQuickBuyData] = useState<QuickBuyData | null>(null);
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Check if session needs renewal
  useEffect(() => {
    if ((session as any).needsRenewal) {
      setShowRenewalModal(true);
    } else {
      setShowRenewalModal(false);
    }
  }, [(session as any).needsRenewal]);

  // Real API pools data structure
  const poolNames = {
    'rdl-basic': 'RDL Basic Staking',
    'rdl-premium': 'RDL Premium Staking', 
    'rdl-diamond': 'RDL Diamond Staking'
  };

  const rewardSources = {
    'rdl-basic': 'trading_fees',
    'rdl-premium': 'platform_revenue',
    'rdl-diamond': 'partner_rewards'
  } as const;

  // Fetch staking pools with TanStack Query
  const { data: stakingPoolsData, isLoading: poolsLoading } = useQuery({
    queryKey: ['staking-pools'],
    queryFn: async () => {
      const response = await fetch('/api/staking/pools');
      const data = await response.json() as any;
      return data;
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Fetch wallet balances for staking tokens
  const { data: walletBalanceData } = useQuery({
    queryKey: ['wallet-balances-staking'],
    queryFn: async () => {
      const response = await fetch('/api/wallet/balances?tokens=RDL,SRDL,BNBRDL,BASRDL,ERDL');
      const data = await response.json() as any;
      return data;
    },
    refetchInterval: 10000 // Refresh every 10 seconds
  });

  // Fetch user staking positions
  const { data: userStakingData } = useQuery({
    queryKey: ['user-staking-positions'],
    queryFn: async () => {
      const response = await fetch('/api/staking/positions', {
        headers: {
          'Authorization': `Bearer ${session.sessionToken || ''}`
        }
      });
      const data = await response.json() as any;
      return data;
    },
    enabled: !!session.sessionToken
  });

  // Quick buy mutation
  const quickBuyMutation = useMutation({
    mutationFn: async (buyData: QuickBuyData) => {
      const response = await apiRequest('/api/trading/quick-buy', {
        method: 'POST',
        body: JSON.stringify(buyData)
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Purchase Successful",
        description: "Tokens have been purchased and are ready for staking"
      });
      queryClient.invalidateQueries({ queryKey: ['wallet-balances-staking'] });
      setShowBuyDialog(false);
      setBuyAmount('');
    },
    onError: () => {
      toast({
        title: "Purchase Failed",
        description: "Failed to purchase tokens. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Update state when data is fetched
  useEffect(() => {
    if (stakingPoolsData?.success) {
      const transformedPools = stakingPoolsData.pools.map((pool: any) => ({
        id: pool.id,
        name: poolNames[pool.id as keyof typeof poolNames] || pool.chain + ' Staking',
        token: pool.chain,
        apy: `${pool.apy_percentage || pool.estimatedAPY || 0}%`,
        lockPeriod: `${pool.lock_period_days || pool.lockupDays || 0} days`,
        minStake: pool.min_stake_amount || pool.minStakeAmount || '0',
        totalStaked: pool.total_staked || pool.totalStaked || '0',
        userStaked: '0',
        pendingRewards: '0',
        nextRewardDate: '2025-01-30',
        status: pool.is_active ? 'active' : 'paused',
        rewardSource: rewardSources[pool.id as keyof typeof rewardSources] || 'trading_fees'
      }));
      setStakingPools(transformedPools);
    }
  }, [stakingPoolsData]);

  // Update wallet balances when data is fetched
  useEffect(() => {
    if (walletBalanceData?.success) {
      setWalletBalances(walletBalanceData.balances || []);
    }
  }, [walletBalanceData]);

  // Update user stakings when data is fetched
  useEffect(() => {
    if (userStakingData?.success) {
      setUserStakings(userStakingData.positions || []);
      
      // Calculate totals
      const positions = userStakingData.positions || [];
      const totalStaked = positions.reduce((sum: number, stake: any) => 
        sum + parseFloat(stake.stakedAmount || '0'), 0
      );
      const totalRewards = positions.reduce((sum: number, stake: any) => 
        sum + parseFloat(stake.rewardsEarned || '0'), 0
      );
      
      setTotalStaked(totalStaked.toFixed(2));
      setTotalRewardsEarned(totalRewards.toFixed(2));
    }
  }, [userStakingData]);

  // Buy tokens handlers
  const handleBuyTokens = (pool: StakingPool) => {
    setSelectedBuyPool(pool);
    setShowBuyDialog(true);
    setBuyAmount('');
  };

  const handleQuickBuy = () => {
    if (!selectedBuyPool || !buyAmount || parseFloat(buyAmount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid purchase amount",
        variant: "destructive"
      });
      return;
    }

    const buyData: QuickBuyData = {
      poolId: selectedBuyPool.id,
      tokenSymbol: selectedBuyPool.token,
      buyAmount: buyAmount,
      estimatedTokens: (parseFloat(buyAmount) * 0.95).toString(), // Estimate with 5% slippage
      swapRoute: 'uniswap-v3'
    };

    quickBuyMutation.mutate(buyData);
  };

  const getWalletBalance = (tokenSymbol: string): string => {
    const balance = walletBalances.find(b => b.token === tokenSymbol);
    return balance ? parseFloat(balance.balance).toFixed(2) : '0.00';
  };

  const handleStake = async (poolId: string) => {
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid stake amount",
        variant: "destructive"
      });
      return;
    }

    const pool = stakingPools.find(p => p.id === poolId);
    if (!pool) return;

    if (parseFloat(stakeAmount) < parseFloat(pool.minStake)) {
      toast({
        title: "Below Minimum",
        description: `Minimum stake amount is ${pool.minStake} ${pool.token}`,
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      // Mock staking transaction
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const newStaking: UserStaking = {
        id: Date.now().toString(),
        poolName: pool.name,
        stakedAmount: stakeAmount,
        rewardsEarned: '0',
        currentApy: pool.apy,
        stakeDate: new Date().toISOString().split('T')[0],
        unlockDate: new Date(Date.now() + (pool.lockPeriod.includes('30') ? 30 : pool.lockPeriod.includes('90') ? 90 : 180) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'active'
      };

      setUserStakings(prev => [newStaking, ...prev]);
      setStakeAmount('');
      
      toast({
        title: "Staking Successful",
        description: `Successfully staked ${stakeAmount} ${pool.token} in ${pool.name}`
      });

      // Update totals
      setTotalStaked(prev => (parseFloat(prev) + parseFloat(stakeAmount)).toFixed(2));
      
    } catch (error) {
      toast({
        title: "Staking Failed",
        description: "Failed to stake tokens. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleWithdraw = async (stakingId: string) => {
    const staking = userStakings.find(s => s.id === stakingId);
    if (!staking) return;

    if (staking.status !== 'ready_to_withdraw') {
      toast({
        title: "Cannot Withdraw",
        description: "Tokens are still locked. Please wait until unlock date.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setUserStakings(prev => prev.filter(s => s.id !== stakingId));
      
      toast({
        title: "Withdrawal Successful",
        description: `Withdrew ${staking.stakedAmount} RDL plus ${staking.rewardsEarned} RDL rewards`
      });

      // Update totals
      setTotalStaked(prev => Math.max(0, parseFloat(prev) - parseFloat(staking.stakedAmount)).toFixed(2));
      
    } catch (error) {
      toast({
        title: "Withdrawal Failed",
        description: "Failed to withdraw tokens. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'ready_to_withdraw': return 'bg-blue-500';
      case 'cooling_down': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getRewardSourceText = (source: string) => {
    switch (source) {
      case 'trading_fees': return 'Trading Fees';
      case 'platform_revenue': return 'Platform Revenue';
      case 'partner_rewards': return 'Partner Rewards';
      default: return 'Unknown';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getDaysUntilUnlock = (unlockDate: string) => {
    const now = new Date();
    const unlock = new Date(unlockDate);
    const diffTime = unlock.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-lg flex items-center justify-center">
            <Coins className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Token Staking</h1>
            <p className="text-muted-foreground">Stake RDL tokens to earn rewards from platform income</p>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Staked</p>
                  <p className="text-2xl font-bold">{parseFloat(totalStaked).toLocaleString()} RDL</p>
                </div>
                <Lock className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Rewards</p>
                  <p className="text-2xl font-bold text-green-600">{parseFloat(totalRewardsEarned).toLocaleString()} RDL</p>
                </div>
                <Award className="h-8 w-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Stakes</p>
                  <p className="text-2xl font-bold">{userStakings.filter(s => s.status === 'active').length}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg APY</p>
                  <p className="text-2xl font-bold">21.8%</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs defaultValue="pools" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="pools">Staking Pools</TabsTrigger>
          <TabsTrigger value="mystakes">My Stakes</TabsTrigger>
        </TabsList>

        <TabsContent value="pools" data-testid="tab-content-pools">
          <div className="space-y-6">
            {poolsLoading ? (
              <div className="flex items-center justify-center py-12" data-testid="loading-pools">
                <RefreshCw className="h-8 w-8 animate-spin mr-3" />
                <span>Loading staking pools...</span>
              </div>
            ) : stakingPools.length === 0 ? (
              <Card data-testid="no-pools-available">
                <CardContent className="text-center py-12">
                  <AlertCircle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Staking Pools Available</h3>
                  <p className="text-muted-foreground">Staking pools will appear here when available.</p>
                </CardContent>
              </Card>
            ) : (
              stakingPools.map((pool) => {
                const walletBalance = getWalletBalance(pool.token);
                const hasEnoughBalance = parseFloat(walletBalance) >= parseFloat(pool.minStake);
                
                return (
                  <Card key={pool.id} data-testid={`pool-card-${pool.id}`}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-xl" data-testid={`pool-name-${pool.id}`}>{pool.name}</CardTitle>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge 
                              className={pool.status === 'active' ? 'bg-green-500' : 'bg-gray-500'}
                              data-testid={`pool-status-${pool.id}`}
                            >
                              {pool.status.toUpperCase()}
                            </Badge>
                            <Badge variant="outline" data-testid={`pool-reward-source-${pool.id}`}>
                              Rewards: {getRewardSourceText(pool.rewardSource)}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-3xl font-bold text-green-600" data-testid={`pool-apy-${pool.id}`}>{pool.apy}</div>
                          <div className="text-sm text-muted-foreground">APY</div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {/* Wallet Balance Section */}
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-6" data-testid={`wallet-balance-${pool.id}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Wallet className="h-5 w-5 text-blue-600" />
                            <span className="font-medium">Your {pool.token} Balance</span>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold" data-testid={`balance-amount-${pool.id}`}>{walletBalance} {pool.token}</p>
                            <div className="flex items-center gap-2">
                              {hasEnoughBalance ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-orange-500" />
                              )}
                              <span className={`text-xs ${hasEnoughBalance ? 'text-green-600' : 'text-orange-600'}`}>
                                {hasEnoughBalance ? 'Sufficient balance' : 'Insufficient balance'}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {!hasEnoughBalance && (
                          <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-blue-700 dark:text-blue-300">
                                Need {(parseFloat(pool.minStake) - parseFloat(walletBalance)).toFixed(2)} more {pool.token}
                              </span>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleBuyTokens(pool)}
                                className="text-blue-600 border-blue-600 hover:bg-blue-50"
                                data-testid={`buy-tokens-${pool.id}`}
                              >
                                <ShoppingCart className="h-4 w-4 mr-1" />
                                Buy {pool.token}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" data-testid={`pool-details-${pool.id}`}>
                        <div>
                          <p className="text-sm text-muted-foreground">Lock Period</p>
                          <p className="font-semibold flex items-center gap-1" data-testid={`lock-period-${pool.id}`}>
                            <Calendar className="h-4 w-4" />
                            {pool.lockPeriod}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Min Stake</p>
                          <p className="font-semibold" data-testid={`min-stake-${pool.id}`}>{parseFloat(pool.minStake).toLocaleString()} {pool.token}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Total Staked</p>
                          <p className="font-semibold" data-testid={`total-staked-${pool.id}`}>{pool.totalStaked} {pool.token}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Your Stake</p>
                          <p className="font-semibold" data-testid={`user-staked-${pool.id}`}>{parseFloat(pool.userStaked).toLocaleString()} {pool.token}</p>
                        </div>
                      </div>

                      {pool.status === 'active' && (
                        <div className="mt-6 pt-6 border-t" data-testid={`staking-section-${pool.id}`}>
                          <div className="flex gap-4 items-end">
                            <div className="flex-1">
                              <label className="text-sm font-medium">Stake Amount ({pool.token})</label>
                              <Input
                                type="number"
                                placeholder={`Min: ${pool.minStake}`}
                                value={stakeAmount}
                                onChange={(e) => setStakeAmount(e.target.value)}
                                data-testid={`stake-amount-input-${pool.id}`}
                              />
                            </div>
                            <div className="flex gap-2">
                              {!hasEnoughBalance && (
                                <Button 
                                  variant="outline"
                                  onClick={() => handleBuyTokens(pool)}
                                  disabled={quickBuyMutation.isPending}
                                  className="min-w-[140px]"
                                  data-testid={`buy-more-tokens-${pool.id}`}
                                >
                                  <ShoppingCart className="w-4 h-4 mr-2" />
                                  Buy & Stake
                                </Button>
                              )}
                              <Button 
                                onClick={() => handleStake(pool.id)}
                                disabled={isLoading || !hasEnoughBalance}
                                className="min-w-[120px]"
                                data-testid={`stake-button-${pool.id}`}
                              >
                                {isLoading ? (
                                  <>
                                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                                    Staking...
                                  </>
                                ) : (
                                  <>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Stake Tokens
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="mystakes">
          <div className="space-y-4">
            {userStakings.length > 0 ? (
              userStakings.map((stake) => (
                <Card key={stake.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div>
                          <h3 className="font-semibold text-lg">{stake.poolName}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className={getStatusColor(stake.status)}>
                              {stake.status.replace('_', ' ').toUpperCase()}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              APY: {stake.currentApy}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-center">
                        <div>
                          <p className="text-sm text-muted-foreground">Staked Amount</p>
                          <p className="font-semibold">{parseFloat(stake.stakedAmount).toLocaleString()} RDL</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Rewards Earned</p>
                          <p className="font-semibold text-green-600">{parseFloat(stake.rewardsEarned).toLocaleString()} RDL</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Unlock Date</p>
                          <p className="font-semibold">{formatDate(stake.unlockDate)}</p>
                          {stake.status === 'active' && (
                            <p className="text-xs text-muted-foreground">
                              {getDaysUntilUnlock(stake.unlockDate)} days left
                            </p>
                          )}
                        </div>
                        <div>
                          {stake.status === 'ready_to_withdraw' ? (
                            <Button
                              onClick={() => handleWithdraw(stake.id)}
                              disabled={isLoading}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <Minus className="w-4 h-4 mr-2" />
                              Withdraw
                            </Button>
                          ) : (
                            <Button variant="outline" disabled>
                              <Lock className="w-4 h-4 mr-2" />
                              Locked
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {stake.status === 'active' && (
                      <div className="mt-4">
                        <div className="flex justify-between text-sm mb-1">
                          <span>Lock Progress</span>
                          <span>{100 - Math.round((getDaysUntilUnlock(stake.unlockDate) / 180) * 100)}%</span>
                        </div>
                        <Progress 
                          value={100 - Math.round((getDaysUntilUnlock(stake.unlockDate) / 180) * 100)} 
                          className="h-2"
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <Coins className="h-12 w-12 text-muted-foreground" />
                    <div>
                      <h3 className="font-semibold">No Active Stakes</h3>
                      <p className="text-sm text-muted-foreground">Start staking RDL tokens to earn rewards from platform income</p>
                    </div>
                    <Button onClick={() => (document.querySelector('[value="pools"]') as HTMLElement)?.click()}>
                      View Staking Pools
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Buy Tokens Dialog */}
      <Dialog open={showBuyDialog} onOpenChange={setShowBuyDialog}>
        <DialogContent className="max-w-md" data-testid="buy-tokens-dialog">
          <DialogHeader>
            <DialogTitle data-testid="buy-dialog-title">
              Buy {selectedBuyPool?.token} Tokens
            </DialogTitle>
            <DialogDescription data-testid="buy-dialog-description">
              Purchase {selectedBuyPool?.token} tokens quickly to start staking and earning rewards
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {selectedBuyPool && (
              <>
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg" data-testid="pool-info">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">{selectedBuyPool.name}</span>
                    <Badge className="bg-green-500" data-testid="pool-apy-display">{selectedBuyPool.apy} APY</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Min stake: {selectedBuyPool.minStake} {selectedBuyPool.token}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Your balance: {getWalletBalance(selectedBuyPool.token)} {selectedBuyPool.token}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="buy-amount" data-testid="buy-amount-label">Purchase Amount (USD)</Label>
                  <Input
                    id="buy-amount"
                    type="number"
                    placeholder="Enter USD amount"
                    value={buyAmount}
                    onChange={(e) => setBuyAmount(e.target.value)}
                    data-testid="buy-amount-input"
                  />
                  <div className="text-xs text-muted-foreground" data-testid="estimated-tokens">
                    ≈ {buyAmount ? (parseFloat(buyAmount) * 0.95).toFixed(2) : '0.00'} {selectedBuyPool.token} 
                    <span className="text-yellow-600 ml-1">(~5% slippage)</span>
                  </div>
                </div>

                <div className="border border-blue-200 dark:border-blue-800 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20" data-testid="quick-buy-info">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-blue-900 dark:text-blue-100">Quick Buy Features:</p>
                      <ul className="text-blue-700 dark:text-blue-300 mt-1 space-y-1">
                        <li>• Instant token purchase using best available route</li>
                        <li>• Automatic wallet balance refresh</li>
                        <li>• Ready to stake immediately after purchase</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowBuyDialog(false)}
                    className="flex-1"
                    data-testid="cancel-buy-button"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleQuickBuy}
                    disabled={quickBuyMutation.isPending || !buyAmount || parseFloat(buyAmount) <= 0}
                    className="flex-1"
                    data-testid="confirm-buy-button"
                  >
                    {quickBuyMutation.isPending ? (
                      <>
                        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                        Purchasing...
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        Buy Tokens
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Session Renewal Modal */}
      <SessionRenewalModal 
        open={showRenewalModal} 
        onOpenChange={setShowRenewalModal}
      />
    </div>
  );
}
