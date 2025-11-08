/**
 * REWARDS DASHBOARD
 * Comprehensive rewards tracking and distribution interface
 * - Daily activity tracking
 * - 25% trading fee rewards in RDL tokens  
 * - NFT collection rewards with listing penalties
 * - 50% of monthly royalties per collection
 */

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  TrendingUp, 
  DollarSign, 
  Calendar, 
  Coins,
  Trophy,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Wallet,
  Activity
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const RewardsDashboard = () => {
  const { toast } = useToast();
  const [targetWallet] = useState('rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH');
  const [sessionWallet, setSessionWallet] = useState<string>('');

  // Get current session wallet
  useEffect(() => {
    try {
      const sessionData = localStorage.getItem('sessionData');
      if (sessionData) {
        const session = JSON.parse(sessionData);
        const address = session.wallet?.xrpAddress || session.xrpAddress || '';
        setSessionWallet(address);
      }
    } catch (error) {
      console.error('Error getting session wallet:', error);
    }
  }, []);

  // Fetch comprehensive dashboard data
  const { data: dashboardData, isLoading, refetch } = useQuery<any>({
    queryKey: ['/api/rewards/dashboard'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch claimable rewards
  const { data: claimableRewards } = useQuery<any>({
    queryKey: ['/api/rewards/claimable'],
    refetchInterval: 30000,
  });

  // Fetch earning opportunities
  const { data: earningOpportunities } = useQuery<any>({
    queryKey: ['/api/rewards/opportunities'],
    refetchInterval: 60000, // Refresh every minute
  });

  // Enhanced activity tracking
  const updateActivityMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/rewards/activity/update', {
        method: 'POST'
      });
    },
    onSuccess: () => {
      toast({
        title: 'Activity Updated',
        description: 'Comprehensive activity tracking updated successfully',
      });
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: 'Update Failed',
        description: error?.message || 'Failed to update activity tracking',
        variant: 'destructive'
      });
    }
  });

  // Real blockchain claiming
  const claimRewardsMutation = useMutation({
    mutationFn: async (rewardIds: string[]) => {
      return await apiRequest('/api/rewards/claim/initiate', {
        method: 'POST',
        body: JSON.stringify({ 
          rewardIds,
          batchClaim: rewardIds.length > 1 
        })
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: 'Claim Initiated',
        description: `Blockchain transaction initiated. Hash: ${data?.data?.transactionHash || 'Processing...'}`,
      });
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: 'Claim Failed',
        description: error?.message || 'Failed to initiate reward claim',
        variant: 'destructive'
      });
    }
  });

  // Track social engagement
  const trackSocialMutation = useMutation({
    mutationFn: async (engagementType: string) => {
      return await apiRequest('/api/rewards/social/track', {
        method: 'POST',
        body: JSON.stringify({ 
          engagementType,
          engagementData: { source: 'dashboard' }
        })
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: 'Engagement Tracked',
        description: data?.message || 'Social engagement tracked successfully',
      });
      refetch();
    }
  });

  // Extract comprehensive dashboard data
  const activityData = dashboardData?.data?.activityData;
  const rewardSummary = dashboardData?.data?.rewardSummary || [];
  const claimableRewardsList = dashboardData?.data?.claimableRewards || [];
  const recentClaims = dashboardData?.data?.recentClaims || [];
  const connectedProjects = dashboardData?.data?.connectedProjects || [];
  const collectionsData = dashboardData?.data?.collectionsData || {};
  const dashboard = dashboardData?.data || {};

  // Calculate totals from claimable rewards
  const totalPendingUsd = claimableRewardsList.reduce((sum: number, reward: any) => 
    sum + parseFloat(reward.usd_value || '0'), 0);

  const groupedClaimableRewards = claimableRewards?.data?.grouped || [];
  const opportunities = earningOpportunities?.data || {};

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Enhanced Header with Project Navigation */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
              Enhanced Rewards Dashboard
            </h1>
            <Badge 
              variant="outline" 
              className="text-lg px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white border-none"
            >
              🎯 Real Blockchain Rewards
            </Badge>
          </div>
          
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-4">
            Track real user activity, earn rewards across chains, and claim with blockchain transactions
          </p>

          {/* Connected Projects Navigation */}
          {connectedProjects.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Connected DevTools Projects
              </h3>
              <div className="flex flex-wrap gap-2">
                {connectedProjects.map((connection: any) => (
                  <Badge 
                    key={connection.project.id}
                    variant="secondary"
                    className="cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900"
                    data-testid={`project-link-${connection.project.id}`}
                  >
                    <Trophy className="w-3 h-3 mr-1" />
                    {connection.project.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Session Info */}
          <div className="flex flex-wrap gap-3 items-center">
            {sessionWallet && (
              <Badge variant="outline" className="text-sm px-3 py-1">
                <Wallet className="w-3 h-3 mr-1" />
                {sessionWallet.slice(0, 8)}...{sessionWallet.slice(-8)}
              </Badge>
            )}
            <Badge variant="secondary" className="text-sm px-3 py-1">
              Last Updated: {new Date().toLocaleTimeString()}
            </Badge>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mb-6 flex flex-wrap gap-3">
          <Button
            onClick={() => updateActivityMutation.mutate()}
            disabled={updateActivityMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700"
            data-testid="button-update-activity"
          >
            {updateActivityMutation.isPending ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Activity className="w-4 h-4 mr-2" />
            )}
            Update Activity Tracking
          </Button>
          
          <Button
            onClick={() => trackSocialMutation.mutate('daily_login')}
            disabled={trackSocialMutation.isPending}
            variant="outline"
            data-testid="button-daily-login"
          >
            <Calendar className="w-4 h-4 mr-2" />
            Claim Daily Login
          </Button>

          {claimableRewardsList.length > 0 && (
            <Button
              onClick={() => claimRewardsMutation.mutate(claimableRewardsList.map((r: any) => r.id))}
              disabled={claimRewardsMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
              data-testid="button-claim-all-rewards"
            >
              {claimRewardsMutation.isPending ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Coins className="w-4 h-4 mr-2" />
              )}
              Claim All Rewards (${totalPendingUsd.toFixed(2)})
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <RefreshCw className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-lg text-gray-600 dark:text-gray-300">Loading comprehensive rewards dashboard...</p>
          </div>
        ) : (
          <>
            {/* Enhanced Activity Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <Card className="bg-gradient-to-r from-green-500 to-emerald-600 text-white">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <DollarSign className="h-8 w-8" />
                    <div>
                      <h3 className="font-semibold">Total Volume</h3>
                      <p className="text-2xl font-bold">
                        ${parseFloat(activityData?.total_volume_usd || '0').toLocaleString()}
                      </p>
                      <p className="text-sm opacity-90">
                        {activityData?.total_swaps || 0} swaps, {activityData?.total_bridges || 0} bridges
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-purple-500 to-violet-600 text-white">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <Trophy className="h-8 w-8" />
                    <div>
                      <h3 className="font-semibold">Social Engagement</h3>
                      <p className="text-2xl font-bold">
                        {activityData?.posts_created || 0} posts
                      </p>
                      <p className="text-sm opacity-90">
                        {activityData?.likes_given || 0} likes, {activityData?.comments_made || 0} comments
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <Coins className="h-8 w-8" />
                    <div>
                      <h3 className="font-semibold">Pending Rewards</h3>
                      <p className="text-2xl font-bold">
                        ${parseFloat(activityData?.pending_rewards_usd || '0').toFixed(2)}
                      </p>
                      <p className="text-sm opacity-90">Ready to claim</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-orange-500 to-red-600 text-white">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <Wallet className="h-8 w-8" />
                    <div>
                      <h3 className="font-semibold">Total Earned</h3>
                      <p className="text-2xl font-bold">
                        ${parseFloat(activityData?.total_rewards_earned_usd || '0').toFixed(2)}
                      </p>
                      <p className="text-sm opacity-90">
                        ${parseFloat(activityData?.total_rewards_claimed_usd || '0').toFixed(2)} claimed
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Claimable Rewards Section */}
            {groupedClaimableRewards.length > 0 && (
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Coins className="h-5 w-5 text-green-600" />
                    Claimable Rewards ({groupedClaimableRewards.length} tokens)
                  </CardTitle>
                  <CardDescription>
                    Your rewards are ready for blockchain claiming. Click to initiate real transactions.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groupedClaimableRewards.map((group: any) => (
                      <div 
                        key={group.token}
                        className="border rounded-lg p-4 bg-green-50 dark:bg-green-900/10 hover:bg-green-100 dark:hover:bg-green-900/20 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                              {group.token.charAt(0)}
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-900 dark:text-white">{group.token}</h4>
                              <p className="text-xs text-gray-500 capitalize">{group.chain} chain</p>
                            </div>
                          </div>
                          <Badge variant="default" className="bg-green-600">
                            {group.rewards.length} rewards
                          </Badge>
                        </div>
                        
                        <div className="space-y-2 mb-4">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Amount:</span>
                            <span className="font-semibold">{group.totalAmount.toFixed(4)} {group.token}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">USD Value:</span>
                            <span className="font-semibold text-green-600">${group.totalUsdValue.toFixed(2)}</span>
                          </div>
                        </div>
                        
                        <Button
                          onClick={() => claimRewardsMutation.mutate(group.rewards.map((r: any) => r.id))}
                          disabled={claimRewardsMutation.isPending}
                          className="w-full bg-green-600 hover:bg-green-700"
                          size="sm"
                          data-testid={`button-claim-${group.token.toLowerCase()}`}
                        >
                          {claimRewardsMutation.isPending ? (
                            <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                          ) : (
                            <Coins className="w-3 h-3 mr-1" />
                          )}
                          Claim {group.token}
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* NFT Collections Holdings */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5" />
                    NFT Collection Holdings
                  </CardTitle>
                  <CardDescription>
                    Collections held by target wallet with listing status
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {Object.keys(collectionsData).length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No NFT collections found</p>
                  ) : (
                    <div className="space-y-4">
                      {Object.entries(collectionsData).map(([collection, data]: [string, any]) => (
                        <div key={collection} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-semibold text-gray-900 dark:text-white">{collection}</h4>
                            {data.listed > 0 ? (
                              <Badge variant="destructive" className="flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Penalty Applied
                              </Badge>
                            ) : (
                              <Badge variant="default" className="flex items-center gap-1">
                                <CheckCircle className="h-3 w-3" />
                                Eligible
                              </Badge>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">NFTs Held:</span>
                              <span className="ml-2 font-semibold">{data.total}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Listed:</span>
                              <span className="ml-2 font-semibold text-red-600">{data.listed}</span>
                            </div>
                          </div>
                          {data.listed > 0 && (
                            <Alert className="mt-3">
                              <AlertTriangle className="h-4 w-4" />
                              <AlertDescription className="text-xs">
                                Rewards forfeited due to listing {data.listed} NFT(s) during reward period
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Trading Rewards History */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Recent Trading Rewards
                  </CardTitle>
                  <CardDescription>
                    Daily 25% fee rewards in RDL tokens
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!dashboard?.trading_rewards || dashboard.trading_rewards.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No trading rewards yet</p>
                  ) : (
                    <div className="space-y-3">
                      {dashboard.trading_rewards.slice(0, 5).map((reward: any, index: number) => (
                        <div key={reward.id || index} className="border rounded-lg p-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-500">{reward.reward_date}</span>
                            <Badge 
                              variant={reward.status === 'pending' ? 'secondary' : 'default'}
                            >
                              {reward.status}
                            </Badge>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-gray-500">Fees Generated:</span>
                              <span className="ml-2 font-semibold">
                                ${parseFloat(reward.fees_generated_usd || '0').toFixed(4)}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500">Reward (25%):</span>
                              <span className="ml-2 font-semibold text-green-600">
                                ${parseFloat(reward.reward_amount_usd || '0').toFixed(4)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Daily Activity Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Daily Platform Activity (Last 30 Days)
                </CardTitle>
                <CardDescription>
                  Trading volume, swaps, and new wallets
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!dashboard?.daily_activity || dashboard.daily_activity.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No daily activity data</p>
                ) : (
                  <div className="space-y-3">
                    {dashboard.daily_activity.slice(0, 7).map((day: any, index: number) => (
                      <div key={day.id || index} className="border rounded-lg p-4">
                        <div className="grid grid-cols-4 gap-4">
                          <div>
                            <span className="text-sm text-gray-500">Date:</span>
                            <p className="font-semibold">{day.date}</p>
                          </div>
                          <div>
                            <span className="text-sm text-gray-500">Swaps:</span>
                            <p className="font-semibold text-blue-600">{day.total_swaps}</p>
                          </div>
                          <div>
                            <span className="text-sm text-gray-500">Volume:</span>
                            <p className="font-semibold text-green-600">
                              ${parseFloat(day.total_volume_usd || '0').toFixed(0)}
                            </p>
                          </div>
                          <div>
                            <span className="text-sm text-gray-500">New Wallets:</span>
                            <p className="font-semibold text-purple-600">{day.new_wallets}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default RewardsDashboard;
