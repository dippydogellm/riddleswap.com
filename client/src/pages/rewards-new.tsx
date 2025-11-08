import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Coins, Gift, History, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface RewardSummary {
  chain: string;
  token: string;
  totalEarned: string;
  totalClaimed: string;
  pendingAmount: string;
  usdValue: string;
}

interface RewardHistory {
  id: string;
  operationType: string;
  sourceChain: string;
  feeAmount: string;
  feeToken: string;
  rewardAmount: string;
  rewardToken: string;
  status: string;
  createdAt: string;
  transactionHash: string;
}

interface ClaimableReward {
  id: string;
  amount: string;
  token: string;
  chain: string;
  feeUsdValue: string;
  operationType: string;
  createdAt: string;
  canClaim: boolean;
}

export default function Rewards() {
  const { toast } = useToast();

  const { data: summary, isLoading: summaryLoading } = useQuery<RewardSummary[]>({
    queryKey: ['/api/rewards/summary'],
  });

  const { data: history, isLoading: historyLoading } = useQuery<RewardHistory[]>({
    queryKey: ['/api/rewards/history'],
  });

  const { data: claimable, isLoading: claimableLoading, refetch: refetchClaimable } = useQuery<ClaimableReward[]>({
    queryKey: ['/api/rewards/claimable'],
  });

  const handleClaim = async (rewardId: string) => {
    try {
      const response = await fetch(`/api/rewards/claim/${rewardId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json() as any;

      if (result.success) {
        toast({
          title: 'Reward Claimed Successfully',
          description: `Claimed ${result.amount} ${result.token}`,
        });
        refetchClaimable();
      } else {
        toast({
          title: 'Claim Failed',
          description: result.error || 'Unable to claim reward',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to claim reward',
        variant: 'destructive',
      });
    }
  };

  const getChainColor = (chain: string) => {
    const colors: Record<string, string> = {
      xrp: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      eth: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      sol: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      bnb: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
      base: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
    };
    return colors[chain] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  };

  const getTokenIcon = (token: string) => {
    const tokens: Record<string, string> = {
      RDL: '🔴',
      ERDL: '⚡',
      SRDL: '🟣',
      BNBRDL: '🟡',
      BASRDL: '🔵',
    };
    return tokens[token] || '💎';
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Rewards Center</h1>
        <p className="text-muted-foreground">
          Earn 25% cashback on all platform fees in chain-specific RDL tokens
        </p>
      </div>

      <Tabs defaultValue="summary" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="summary" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Summary
          </TabsTrigger>
          <TabsTrigger value="claimable" className="flex items-center gap-2">
            <Gift className="h-4 w-4" />
            Claimable
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {summaryLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader className="pb-3">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-8 bg-gray-200 rounded w-full mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                  </CardContent>
                </Card>
              ))
            ) : summary && summary.length > 0 ? (
              summary.map((reward) => (
                <Card key={`${reward.chain}-${reward.token}`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        {getTokenIcon(reward.token)} {reward.token}
                      </span>
                      <Badge className={getChainColor(reward.chain)}>
                        {reward.chain.toUpperCase()}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      Cashback rewards from {reward.chain} operations
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Total Earned:</span>
                        <span className="font-medium">{parseFloat(reward.totalEarned).toFixed(6)} {reward.token}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Claimed:</span>
                        <span className="text-muted-foreground">{parseFloat(reward.totalClaimed).toFixed(6)} {reward.token}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Pending:</span>
                        <span className="font-medium text-green-600">{parseFloat(reward.pendingAmount).toFixed(6)} {reward.token}</span>
                      </div>
                      <div className="flex justify-between text-sm pt-2 border-t">
                        <span>USD Value:</span>
                        <span className="font-medium">${parseFloat(reward.usdValue).toFixed(4)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="col-span-full">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Coins className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Rewards Yet</h3>
                  <p className="text-muted-foreground text-center">
                    Start trading to earn 25% cashback on platform fees!
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="claimable" className="space-y-4">
          {claimableLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                    <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
                    <div className="h-8 bg-gray-200 rounded w-24"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : claimable && claimable.length > 0 ? (
            <div className="space-y-4">
              {claimable.map((reward) => (
                <Card key={reward.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-medium">
                            {getTokenIcon(reward.token)} {parseFloat(reward.amount).toFixed(6)} {reward.token}
                          </span>
                          <Badge className={getChainColor(reward.chain)}>
                            {reward.chain.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          From {reward.operationType} fee (~${parseFloat(reward.feeUsdValue).toFixed(4)})
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(reward.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Button 
                        onClick={() => handleClaim(reward.id)}
                        disabled={!reward.canClaim}
                        className="ml-4"
                      >
                        {reward.canClaim ? 'Claim' : 'Claimed'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Gift className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Claimable Rewards</h3>
                <p className="text-muted-foreground text-center">
                  Complete trades to earn rewards that can be claimed
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {historyLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : history && history.length > 0 ? (
            <div className="space-y-4">
              {history.map((entry) => (
                <Card key={entry.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {getTokenIcon(entry.rewardToken)} {parseFloat(entry.rewardAmount).toFixed(6)} {entry.rewardToken}
                          </span>
                          <Badge className={getChainColor(entry.sourceChain)}>
                            {entry.sourceChain.toUpperCase()}
                          </Badge>
                          <Badge variant={entry.status === 'claimed' ? 'default' : 'secondary'}>
                            {entry.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {entry.operationType} fee: {parseFloat(entry.feeAmount).toFixed(6)} {entry.feeToken}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(entry.createdAt).toLocaleDateString()} • 
                          <a 
                            href={`#`} 
                            className="ml-1 hover:underline"
                            title={entry.transactionHash}
                          >
                            TX: {entry.transactionHash.slice(0, 8)}...
                          </a>
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <History className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No History</h3>
                <p className="text-muted-foreground text-center">
                  Your reward history will appear here after trading
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
