import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Trophy, 
  Coins, 
  TrendingUp, 
  Calendar, 
  Gift,
  Star,
  Activity,
  DollarSign,
  Percent,
  ArrowUp
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface RewardSummary {
  totalFeesPaid: number;
  totalFeesPaidUsd: number;
  expectedRdlReward: number;
  currentMonthFees: number;
  swapCount: number;
  bridgeCount: number;
  nextDistributionDate: string;
}

interface FeeHistoryItem {
  id: number;
  swapType: string;
  fromToken: string;
  toToken: string;
  swapAmount: string;
  feeAmount: string;
  feeInUsd: string;
  transactionHash: string;
  createdAt: string;
}

interface RewardsDashboardProps {
  walletAddress?: string;
}

export function RewardsDashboard({ walletAddress = "rEVrTKUKSLx5nxdfV8SAFTxS9FGFrfHRLo" }: RewardsDashboardProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'all'>('month');

  // Fetch reward summary
  const { data: rewardSummary, isLoading: loadingSummary } = useQuery<RewardSummary>({
    queryKey: ['/api/rewards/summary', walletAddress],
    queryFn: async () => {
      const response = await apiRequest(`/api/rewards/summary?wallet=${walletAddress}`);
      return await response.json() as any;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch fee history
  const { data: feeHistory, isLoading: loadingHistory } = useQuery<FeeHistoryItem[]>({
    queryKey: ['/api/rewards/fee-history', walletAddress],
    queryFn: async () => {
      const response = await apiRequest(`/api/rewards/fee-history?wallet=${walletAddress}&limit=10`);
      return await response.json() as any;
    },
    refetchInterval: 30000,
  });

  if (loadingSummary) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-300 rounded mb-2"></div>
                  <div className="h-6 bg-gray-300 rounded"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const nextDistribution = rewardSummary?.nextDistributionDate 
    ? new Date(rewardSummary.nextDistributionDate).toLocaleDateString()
    : 'TBD';

  const monthlyProgress = rewardSummary?.currentMonthFees || 0;
  const maxMonthly = 100; // $100 for visual progress
  const progressPercent = Math.min((monthlyProgress / maxMonthly) * 100, 100);

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Fees Paid</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(rewardSummary?.totalFeesPaidUsd || 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              {rewardSummary?.swapCount || 0} swaps completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expected RDL Rewards</CardTitle>
            <Gift className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {(rewardSummary?.expectedRdlReward || 0).toFixed(2)} RDL
            </div>
            <p className="text-xs text-muted-foreground">
              25% of fees paid
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(rewardSummary?.currentMonthFees || 0).toFixed(2)}
            </div>
            <Progress value={progressPercent} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Distribution</CardTitle>
            <Calendar className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{nextDistribution}</div>
            <p className="text-xs text-muted-foreground">
              Monthly RDL rewards
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Platform Revenue Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            RDL Rewards Program
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg">
              <h3 className="font-semibold text-lg mb-2">How Platform Rewards Work</h3>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="h-4 w-4 text-blue-500" />
                    <strong>Earning Fees</strong>
                  </div>
                  <ul className="space-y-1 text-gray-600">
                    <li>• XRPL Swaps: 1% platform fee</li>
                    <li>• Bridge Transactions: 1% platform fee</li>
                    <li>• NFT Trading: 2.5% marketplace fee</li>
                    <li>• Social Features: Bonus points</li>
                  </ul>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Coins className="h-4 w-4 text-green-500" />
                    <strong>RDL Distribution</strong>
                  </div>
                  <ul className="space-y-1 text-gray-600">
                    <li>• 25% of all platform fees → RDL rewards</li>
                    <li>• Monthly distribution to active users</li>
                    <li>• Proportional to fees contributed</li>
                    <li>• Additional bonuses for RDL holders</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Percent className="h-4 w-4 text-amber-600" />
                <span className="font-medium">Current Reward Rate: 25% of fees paid</span>
              </div>
              <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                Active
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Fee History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-500" />
            Recent Platform Usage
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse flex items-center space-x-4">
                  <div className="h-4 bg-gray-300 rounded w-1/4"></div>
                  <div className="h-4 bg-gray-300 rounded w-1/3"></div>
                  <div className="h-4 bg-gray-300 rounded w-1/4"></div>
                </div>
              ))}
            </div>
          ) : feeHistory && feeHistory.length > 0 ? (
            <div className="space-y-3">
              {feeHistory.map((fee, index) => (
                <div key={fee.id || index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <Activity className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-medium">
                        {fee.fromToken} → {fee.toToken}
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(fee.createdAt).toLocaleDateString()} • {fee.swapType.toUpperCase()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">
                      ${parseFloat(fee.feeInUsd || '0').toFixed(2)}
                    </div>
                    <div className="text-sm text-green-600">
                      +{(parseFloat(fee.feeInUsd || '0') * 0.25).toFixed(2)} RDL
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Platform Activity Yet</h3>
              <p className="text-gray-600 mb-4">Start using the platform to earn RDL rewards!</p>
              <div className="flex justify-center gap-2">
                <Button variant="outline" size="sm">
                  <ArrowUp className="h-4 w-4 mr-2" />
                  Make a Swap
                </Button>
                <Button variant="outline" size="sm">
                  <Trophy className="h-4 w-4 mr-2" />
                  Bridge Assets
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
