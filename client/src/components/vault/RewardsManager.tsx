/**
 * Vault Rewards Manager
 * Shows claimable rewards and claim history
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Gift, TrendingUp, Clock, CheckCircle, ArrowUpRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Reward {
  id: number;
  chain: string;
  reward_amount: string;
  reward_amount_usd: string;
  period_start: string;
  period_end: string;
  apy_applied: string;
  claim_status: string;
  claimed_at: string | null;
  claim_tx_hash: string | null;
  withdrawal_wallet_address: string | null;
  withdrawal_wallet_type: string | null;
  calculated_at: string;
}

interface RewardsSummary {
  claim_status: string;
  chain: string;
  total_amount: string;
  total_amount_usd: string;
  count: number;
}

export default function RewardsManager() {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [aggregated, setAggregated] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadRewards();
  }, []);

  const loadRewards = async () => {
    try {
      const response = await fetch('/api/vault/rewards/my-rewards', {
        credentials: 'include'
      });
      const data = await response.json() as any;
      
      if (data.success) {
        setRewards(data.rewards);
        setAggregated(data.aggregated);
        setSummary(data.summary);
      }
    } catch (error) {
      console.error('Error loading rewards:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClaimRewards = async (rewardIds: number[], walletAddress?: string, walletType?: string) => {
    setClaiming(true);
    try {
      const response = await fetch('/api/vault/rewards/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          reward_ids: rewardIds,
          wallet_address: walletAddress,
          wallet_type: walletType
        })
      });

      const data = await response.json() as any;
      if (data.success) {
        toast({
          title: 'Success',
          description: data.message
        });
        loadRewards();
      } else {
        toast({
          title: 'Error',
          description: data.error,
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setClaiming(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
      case 'claimed':
        return <Badge className="bg-blue-500"><Gift className="h-3 w-3 mr-1" /> Claimed</Badge>;
      case 'withdrawn':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" /> Withdrawn</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const pendingRewards = rewards.filter(r => r.claim_status === 'pending');
  const claimedRewards = rewards.filter(r => r.claim_status !== 'pending');

  if (loading) {
    return (
      <Card className="bg-gray-800/50 border-gray-700">
        <CardContent className="pt-6 text-center">
          <TrendingUp className="h-8 w-8 animate-pulse mx-auto mb-2 text-blue-400" />
          <p className="text-gray-400">Loading your rewards...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border-yellow-500/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Pending Rewards</p>
                <p className="text-2xl font-bold text-yellow-400">{summary?.total_pending || 0}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-blue-500/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Claimed</p>
                <p className="text-2xl font-bold text-blue-400">{summary?.total_claimed || 0}</p>
              </div>
              <Gift className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-green-500/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Withdrawn</p>
                <p className="text-2xl font-bold text-green-400">{summary?.total_withdrawn || 0}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rewards Tables */}
      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="pending">
            Claimable ({pendingRewards.length})
          </TabsTrigger>
          <TabsTrigger value="history">
            History ({claimedRewards.length})
          </TabsTrigger>
        </TabsList>

        {/* Pending Rewards */}
        <TabsContent value="pending">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle>Claimable Rewards</CardTitle>
              <CardDescription>
                Rewards ready to be claimed from your vault contributions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingRewards.length === 0 ? (
                <div className="text-center py-8">
                  <Gift className="h-12 w-12 mx-auto mb-4 text-gray-600" />
                  <p className="text-gray-400">No pending rewards</p>
                  <p className="text-sm text-gray-500 mt-2">
                    Keep contributing to earn rewards!
                  </p>
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <Button
                      onClick={() => handleClaimRewards(pendingRewards.map(r => r.id))}
                      disabled={claiming}
                      className="bg-gradient-to-r from-blue-500 to-purple-600"
                    >
                      <Gift className="h-4 w-4 mr-2" />
                      Claim All Pending Rewards
                    </Button>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Chain</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead>APY</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingRewards.map((reward) => (
                        <TableRow key={reward.id}>
                          <TableCell className="capitalize font-medium">{reward.chain}</TableCell>
                          <TableCell>
                            {parseFloat(reward.reward_amount).toFixed(6)}
                            {reward.reward_amount_usd && (
                              <p className="text-xs text-gray-500">
                                ${parseFloat(reward.reward_amount_usd).toFixed(2)}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {new Date(reward.period_start).toLocaleDateString()} -
                            <br />
                            {new Date(reward.period_end).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-green-400">{reward.apy_applied}%</TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              onClick={() => handleClaimRewards([reward.id])}
                              disabled={claiming}
                            >
                              Claim
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Claimed/Withdrawn History */}
        <TabsContent value="history">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle>Claim History</CardTitle>
              <CardDescription>
                Your claimed and withdrawn rewards
              </CardDescription>
            </CardHeader>
            <CardContent>
              {claimedRewards.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-gray-600" />
                  <p className="text-gray-400">No claim history yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Chain</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Claimed</TableHead>
                      <TableHead>TX Hash</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {claimedRewards.map((reward) => (
                      <TableRow key={reward.id}>
                        <TableCell className="capitalize font-medium">{reward.chain}</TableCell>
                        <TableCell>
                          {parseFloat(reward.reward_amount).toFixed(6)}
                          {reward.reward_amount_usd && (
                            <p className="text-xs text-gray-500">
                              ${parseFloat(reward.reward_amount_usd).toFixed(2)}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(reward.claim_status)}</TableCell>
                        <TableCell className="text-sm">
                          {reward.claimed_at
                            ? new Date(reward.claimed_at).toLocaleDateString()
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {reward.claim_tx_hash ? (
                            <a
                              href={`#`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:underline flex items-center"
                            >
                              {reward.claim_tx_hash.slice(0, 10)}...
                              <ArrowUpRight className="h-3 w-3 ml-1" />
                            </a>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
