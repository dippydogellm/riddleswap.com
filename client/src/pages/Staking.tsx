import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Coins, TrendingUp, Clock, Zap, Lock, Gift, AlertTriangle, Info } from "lucide-react";
import { apiRequest } from '@/lib/queryClient';

interface StakingPool {
  id: string;
  chain: string;
  tokenSymbol: string;
  poolName: string;
  apr: string;
  tvl: string;
  minStakeAmount: string;
  maxStakeAmount: string | null;
  lockupPeriodDays: number | null;
  isActive: boolean;
  poolDescription: string | null;
  rewardTokenSymbol: string;
  createdAt: Date;
  updatedAt: Date;
}

interface StakingPosition {
  id: string;
  chain: string;
  walletAddress: string;
  userHandle: string;
  poolId: string;
  stakedAmount: string;
  rewardDebt: string;
  pendingRewards: string;
  lockupEndDate: Date | null;
  stakeTransactionHash: string | null;
  withdrawTransactionHash: string | null;
  withdrawnAt: Date | null;
  status: string;
  createdAt: Date;
}

export default function Staking() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedChain, setSelectedChain] = useState<string>('all');
  const [stakeDialog, setStakeDialog] = useState<{ open: boolean; pool: StakingPool | null }>({ open: false, pool: null });
  const [unstakeDialog, setUnstakeDialog] = useState<{ open: boolean; position: StakingPosition | null }>({ open: false, position: null });
  const [stakeAmount, setStakeAmount] = useState<string>('');
  const [unstakeAmount, setUnstakeAmount] = useState<string>('');

  // Fetch staking pools
  const { data: pools = [], isLoading: poolsLoading } = useQuery<StakingPool[]>({
    queryKey: ['/api/staking/pools'],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fetch user's staking positions
  const { data: positions = [], isLoading: positionsLoading } = useQuery<StakingPosition[]>({
    queryKey: ['/api/staking/positions'],
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  // Stake mutation
  const stakeMutation = useMutation({
    mutationFn: async (data: { poolId: string; amount: string; chain: string }) => {
      return apiRequest('/api/staking/stake', {
        method: 'POST',
        body: data,
      });
    },
    onSuccess: (response) => {
      toast({
        title: "Stake Successful!",
        description: `Successfully staked ${stakeAmount} tokens. Transaction: ${response.transactionHash?.substring(0, 10)}...`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/staking'] });
      setStakeDialog({ open: false, pool: null });
      setStakeAmount('');
    },
    onError: (error: any) => {
      toast({
        title: "Staking Failed",
        description: error.message || "Failed to stake tokens. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Unstake mutation
  const unstakeMutation = useMutation({
    mutationFn: async (data: { positionId: string; amount: string }) => {
      return apiRequest('/api/staking/unstake', {
        method: 'POST',
        body: data,
      });
    },
    onSuccess: (response) => {
      toast({
        title: "Unstake Successful!",
        description: `Successfully unstaked ${unstakeAmount} tokens.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/staking'] });
      setUnstakeDialog({ open: false, position: null });
      setUnstakeAmount('');
    },
    onError: (error: any) => {
      toast({
        title: "Unstaking Failed",
        description: error.message || "Failed to unstake tokens. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Claim rewards mutation
  const claimRewardsMutation = useMutation({
    mutationFn: async (positionId: string) => {
      return apiRequest('/api/staking/claim', {
        method: 'POST',
        body: { positionId },
      });
    },
    onSuccess: (response) => {
      toast({
        title: "Rewards Claimed!",
        description: `Successfully claimed ${response.amount} rewards!`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/staking'] });
    },
    onError: (error: any) => {
      toast({
        title: "Claim Failed",
        description: error.message || "Failed to claim rewards. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Filter pools by selected chain
  const filteredPools = pools.filter(pool => 
    selectedChain === 'all' || pool.chain === selectedChain
  );

  // Calculate total staked and rewards
  const totalStaked = positions.reduce((sum, pos) => sum + parseFloat(pos.stakedAmount), 0);
  const totalRewards = positions.reduce((sum, pos) => sum + parseFloat(pos.pendingRewards), 0);

  const handleStake = () => {
    if (!stakeDialog.pool || !stakeAmount) return;
    
    const amount = parseFloat(stakeAmount);
    const minAmount = parseFloat(stakeDialog.pool.minStakeAmount);
    const maxAmount = stakeDialog.pool.maxStakeAmount ? parseFloat(stakeDialog.pool.maxStakeAmount) : null;

    if (amount < minAmount) {
      toast({
        title: "Amount Too Low",
        description: `Minimum stake amount is ${minAmount} ${stakeDialog.pool.tokenSymbol}`,
        variant: "destructive",
      });
      return;
    }

    if (maxAmount && amount > maxAmount) {
      toast({
        title: "Amount Too High",
        description: `Maximum stake amount is ${maxAmount} ${stakeDialog.pool.tokenSymbol}`,
        variant: "destructive",
      });
      return;
    }

    stakeMutation.mutate({
      poolId: stakeDialog.pool.id,
      amount: stakeAmount,
      chain: stakeDialog.pool.chain
    });
  };

  const handleUnstake = () => {
    if (!unstakeDialog.position || !unstakeAmount) return;
    
    const amount = parseFloat(unstakeAmount);
    const stakedAmount = parseFloat(unstakeDialog.position.stakedAmount);

    if (amount > stakedAmount) {
      toast({
        title: "Amount Too High",
        description: `You can only unstake up to ${stakedAmount} tokens`,
        variant: "destructive",
      });
      return;
    }

    unstakeMutation.mutate({
      positionId: unstakeDialog.position.id,
      amount: unstakeAmount
    });
  };

  const formatNumber = (num: string | number) => {
    const value = typeof num === 'string' ? parseFloat(num) : num;
    if (value >= 1000000) return (value / 1000000).toFixed(2) + 'M';
    if (value >= 1000) return (value / 1000).toFixed(2) + 'K';
    return value.toFixed(2);
  };

  const isPositionLocked = (position: StakingPosition) => {
    return position.lockupEndDate && new Date() < new Date(position.lockupEndDate);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            RiddleSwap Staking
          </h1>
          <p className="text-lg text-muted-foreground">
            Earn rewards by staking your crypto across multiple chains
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800" data-testid="card-total-staked">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Total Staked</p>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                    ${formatNumber(totalStaked)}
                  </p>
                </div>
                <Coins className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800" data-testid="card-pending-rewards">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">Pending Rewards</p>
                  <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                    ${formatNumber(totalRewards)}
                  </p>
                </div>
                <Gift className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800" data-testid="card-active-pools">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Active Pools</p>
                  <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                    {pools.filter(p => p.isActive).length}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800" data-testid="card-my-positions">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-600 dark:text-orange-400">My Positions</p>
                  <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                    {positions.filter(p => p.status === 'active').length}
                  </p>
                </div>
                <Lock className="h-8 w-8 text-orange-600 dark:text-orange-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="pools" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto" data-testid="tabs-staking">
            <TabsTrigger value="pools" data-testid="tab-pools">Available Pools</TabsTrigger>
            <TabsTrigger value="positions" data-testid="tab-positions">My Positions</TabsTrigger>
          </TabsList>

          <TabsContent value="pools" className="space-y-6">
            {/* Chain Filter */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="chain-filter">Filter by Chain:</Label>
                <Select value={selectedChain} onValueChange={setSelectedChain} data-testid="select-chain-filter">
                  <SelectTrigger className="w-[180px]" id="chain-filter">
                    <SelectValue placeholder="Select chain" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Chains</SelectItem>
                    <SelectItem value="xrp">XRP Ledger</SelectItem>
                    <SelectItem value="eth">Ethereum</SelectItem>
                    <SelectItem value="sol">Solana</SelectItem>
                    <SelectItem value="bnb">BNB Chain</SelectItem>
                    <SelectItem value="base">Base</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Alert className="max-w-md" data-testid="alert-staking-info">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Rewards are auto-compounded and can be claimed anytime. Some pools have lockup periods.
                </AlertDescription>
              </Alert>
            </div>

            {/* Staking Pools */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {poolsLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="animate-pulse" data-testid="card-pool-skeleton">
                    <CardContent className="p-6">
                      <div className="space-y-3">
                        <div className="h-4 bg-muted rounded w-3/4"></div>
                        <div className="h-6 bg-muted rounded w-1/2"></div>
                        <div className="h-4 bg-muted rounded w-full"></div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : filteredPools.length === 0 ? (
                <Card className="col-span-full" data-testid="card-no-pools">
                  <CardContent className="text-center py-8">
                    <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Pools Available</h3>
                    <p className="text-muted-foreground">
                      {selectedChain === 'all' 
                        ? 'No staking pools are currently active.' 
                        : `No pools available for ${selectedChain.toUpperCase()}.`}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                filteredPools.map((pool) => (
                  <Card key={pool.id} className="hover:shadow-lg transition-shadow duration-200 border-2 hover:border-primary/20" data-testid={`card-pool-${pool.id}`}>
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            {pool.poolName}
                            <Badge variant="secondary" className="text-xs" data-testid={`badge-chain-${pool.chain}`}>
                              {pool.chain.toUpperCase()}
                            </Badge>
                          </CardTitle>
                          <CardDescription>{pool.poolDescription}</CardDescription>
                        </div>
                        {!pool.isActive && (
                          <Badge variant="destructive" className="text-xs" data-testid="badge-inactive">
                            Inactive
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">APR</p>
                          <p className="font-semibold text-green-600 dark:text-green-400 text-lg" data-testid={`text-apr-${pool.id}`}>
                            {pool.apr}%
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">TVL</p>
                          <p className="font-semibold" data-testid={`text-tvl-${pool.id}`}>
                            ${formatNumber(pool.tvl)}
                          </p>
                        </div>
                      </div>

                      <div className="text-sm space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Min Stake:</span>
                          <span data-testid={`text-min-stake-${pool.id}`}>
                            {formatNumber(pool.minStakeAmount)} {pool.tokenSymbol}
                          </span>
                        </div>
                        {pool.maxStakeAmount && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Max Stake:</span>
                            <span data-testid={`text-max-stake-${pool.id}`}>
                              {formatNumber(pool.maxStakeAmount)} {pool.tokenSymbol}
                            </span>
                          </div>
                        )}
                        {pool.lockupPeriodDays && (
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Lockup:</span>
                            <span className="flex items-center gap-1" data-testid={`text-lockup-${pool.id}`}>
                              <Clock className="h-3 w-3" />
                              {pool.lockupPeriodDays} days
                            </span>
                          </div>
                        )}
                      </div>

                      <Button 
                        className="w-full" 
                        disabled={!pool.isActive}
                        onClick={() => setStakeDialog({ open: true, pool })}
                        data-testid={`button-stake-${pool.id}`}
                      >
                        <Zap className="h-4 w-4 mr-2" />
                        Stake {pool.tokenSymbol}
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="positions" className="space-y-6">
            {/* My Positions */}
            <div className="space-y-4">
              {positionsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i} className="animate-pulse" data-testid="card-position-skeleton">
                    <CardContent className="p-6">
                      <div className="space-y-3">
                        <div className="h-4 bg-muted rounded w-1/4"></div>
                        <div className="h-6 bg-muted rounded w-1/2"></div>
                        <div className="h-4 bg-muted rounded w-full"></div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : positions.length === 0 ? (
                <Card data-testid="card-no-positions">
                  <CardContent className="text-center py-8">
                    <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Staking Positions</h3>
                    <p className="text-muted-foreground mb-4">
                      You haven't staked any tokens yet. Start earning rewards today!
                    </p>
                    <Button onClick={() => {}} data-testid="button-browse-pools">
                      Browse Staking Pools
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                positions.map((position) => {
                  const pool = pools.find(p => p.id === position.poolId);
                  const isLocked = isPositionLocked(position);
                  const lockupProgress = position.lockupEndDate ? 
                    Math.min(100, (Date.now() - new Date(position.createdAt).getTime()) / 
                    (new Date(position.lockupEndDate).getTime() - new Date(position.createdAt).getTime()) * 100) : 100;

                  return (
                    <Card key={position.id} className="hover:shadow-lg transition-shadow duration-200" data-testid={`card-position-${position.id}`}>
                      <CardHeader className="pb-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                              {pool?.poolName || 'Unknown Pool'}
                              <Badge variant="secondary" className="text-xs" data-testid={`badge-position-chain-${position.chain}`}>
                                {position.chain.toUpperCase()}
                              </Badge>
                              <Badge variant={position.status === 'active' ? 'default' : 'secondary'} className="text-xs" data-testid={`badge-position-status-${position.status}`}>
                                {position.status}
                              </Badge>
                            </CardTitle>
                            <CardDescription>
                              Staked on {new Date(position.createdAt).toLocaleDateString()}
                            </CardDescription>
                          </div>
                          {isLocked && (
                            <Badge variant="outline" className="text-xs flex items-center gap-1" data-testid="badge-locked">
                              <Lock className="h-3 w-3" />
                              Locked
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Staked Amount</p>
                            <p className="font-semibold text-lg" data-testid={`text-position-staked-${position.id}`}>
                              {formatNumber(position.stakedAmount)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Pending Rewards</p>
                            <p className="font-semibold text-green-600 dark:text-green-400 text-lg" data-testid={`text-position-rewards-${position.id}`}>
                              {formatNumber(position.pendingRewards)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Pool APR</p>
                            <p className="font-semibold" data-testid={`text-position-apr-${position.id}`}>
                              {pool?.apr || '—'}%
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Status</p>
                            <p className="font-semibold capitalize" data-testid={`text-position-detailed-status-${position.id}`}>
                              {isLocked ? 'Locked' : 'Available'}
                            </p>
                          </div>
                        </div>

                        {position.lockupEndDate && (
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Lockup Progress</span>
                              <span data-testid={`text-lockup-end-${position.id}`}>
                                Unlocks {new Date(position.lockupEndDate).toLocaleDateString()}
                              </span>
                            </div>
                            <Progress value={lockupProgress} className="h-2" data-testid={`progress-lockup-${position.id}`} />
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={parseFloat(position.pendingRewards) <= 0 || claimRewardsMutation.isPending}
                            onClick={() => claimRewardsMutation.mutate(position.id)}
                            data-testid={`button-claim-${position.id}`}
                          >
                            {claimRewardsMutation.isPending ? 'Claiming...' : 'Claim Rewards'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isLocked || position.status !== 'active'}
                            onClick={() => setUnstakeDialog({ open: true, position })}
                            data-testid={`button-unstake-${position.id}`}
                          >
                            Unstake
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Stake Dialog */}
        <Dialog open={stakeDialog.open} onOpenChange={(open) => setStakeDialog({ open, pool: stakeDialog.pool })}>
          <DialogContent className="sm:max-w-md" data-testid="dialog-stake">
            <DialogHeader>
              <DialogTitle>Stake {stakeDialog.pool?.tokenSymbol}</DialogTitle>
              <DialogDescription>
                Stake your {stakeDialog.pool?.tokenSymbol} tokens to earn {stakeDialog.pool?.apr}% APR
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {stakeDialog.pool?.lockupPeriodDays && (
                <Alert data-testid="alert-lockup-warning">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    This pool has a {stakeDialog.pool.lockupPeriodDays} day lockup period. 
                    You won't be able to unstake until the lockup expires.
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="stake-amount">Amount to Stake</Label>
                <Input
                  id="stake-amount"
                  type="number"
                  placeholder="0.00"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  data-testid="input-stake-amount"
                />
                <p className="text-sm text-muted-foreground">
                  Min: {stakeDialog.pool?.minStakeAmount} {stakeDialog.pool?.tokenSymbol}
                  {stakeDialog.pool?.maxStakeAmount && ` • Max: ${stakeDialog.pool.maxStakeAmount} ${stakeDialog.pool.tokenSymbol}`}
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setStakeDialog({ open: false, pool: null })}
                data-testid="button-cancel-stake"
              >
                Cancel
              </Button>
              <Button
                onClick={handleStake}
                disabled={!stakeAmount || stakeMutation.isPending}
                data-testid="button-confirm-stake"
              >
                {stakeMutation.isPending ? 'Staking...' : 'Stake Tokens'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Unstake Dialog */}
        <Dialog open={unstakeDialog.open} onOpenChange={(open) => setUnstakeDialog({ open, position: unstakeDialog.position })}>
          <DialogContent className="sm:max-w-md" data-testid="dialog-unstake">
            <DialogHeader>
              <DialogTitle>Unstake Tokens</DialogTitle>
              <DialogDescription>
                Withdraw your staked tokens. Available to unstake: {unstakeDialog.position?.stakedAmount || '0'} tokens
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="unstake-amount">Amount to Unstake</Label>
                <Input
                  id="unstake-amount"
                  type="number"
                  placeholder="0.00"
                  value={unstakeAmount}
                  onChange={(e) => setUnstakeAmount(e.target.value)}
                  max={unstakeDialog.position?.stakedAmount}
                  data-testid="input-unstake-amount"
                />
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    Max: {unstakeDialog.position?.stakedAmount} tokens
                  </p>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0"
                    onClick={() => setUnstakeAmount(unstakeDialog.position?.stakedAmount || '0')}
                    data-testid="button-unstake-max"
                  >
                    Use Max
                  </Button>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setUnstakeDialog({ open: false, position: null })}
                data-testid="button-cancel-unstake"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUnstake}
                disabled={!unstakeAmount || unstakeMutation.isPending}
                data-testid="button-confirm-unstake"
              >
                {unstakeMutation.isPending ? 'Unstaking...' : 'Unstake Tokens'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
