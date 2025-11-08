import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Coins, Image, Users, Wallet } from "lucide-react";

interface RewardsOverviewProps {
  data: any;
  isLoading: boolean;
}

export default function RewardsOverview({ data, isLoading }: RewardsOverviewProps) {
  if (isLoading) {
    return (
      <div className="rewards-stats-grid">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="rewards-stat-card">
            <CardContent className="p-0">
              <div className="animate-pulse">
                <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const stats = data || {
    swapPoints: 0,
    bridgePoints: 0,
    nftPoints: 0,
    rdlHoldingPoints: 0,
    socialPoints: 0,
    totalPoints: 0,
    pendingRewards: 0,
    claimedRewards: 0,
  };

  return (
    <div>
      <div className="rewards-stats-grid">
        <Card className="rewards-stat-card">
          <CardContent className="p-0">
            <div className="stat-header">
              <div>
                <div className="stat-value">{stats.swapPoints.toLocaleString()}</div>
                <div className="stat-label">Swap Points</div>
              </div>
              <div className="stat-icon swap">
                <TrendingUp size={24} />
              </div>
            </div>
            <div className="stat-change positive">
              +12% from last month
            </div>
          </CardContent>
        </Card>

        <Card className="rewards-stat-card">
          <CardContent className="p-0">
            <div className="stat-header">
              <div>
                <div className="stat-value">{stats.bridgePoints.toLocaleString()}</div>
                <div className="stat-label">Bridge Points</div>
              </div>
              <div className="stat-icon bridge">
                <Wallet size={24} />
              </div>
            </div>
            <div className="stat-change positive">
              +8% from last month
            </div>
          </CardContent>
        </Card>

        <Card className="rewards-stat-card">
          <CardContent className="p-0">
            <div className="stat-header">
              <div>
                <div className="stat-value">{stats.nftPoints.toLocaleString()}</div>
                <div className="stat-label">NFT Holding Points</div>
              </div>
              <div className="stat-icon nft">
                <Image size={24} />
              </div>
            </div>
            <div className="stat-change positive">
              +15% from last month
            </div>
          </CardContent>
        </Card>

        <Card className="rewards-stat-card">
          <CardContent className="p-0">
            <div className="stat-header">
              <div>
                <div className="stat-value">{stats.rdlHoldingPoints.toLocaleString()}</div>
                <div className="stat-label">RDL Holding Points</div>
              </div>
              <div className="stat-icon rdl">
                <Coins size={24} />
              </div>
            </div>
            <div className="stat-change positive">
              +25% from last month
            </div>
          </CardContent>
        </Card>

        <Card className="rewards-stat-card">
          <CardContent className="p-0">
            <div className="stat-header">
              <div>
                <div className="stat-value">{stats.socialPoints.toLocaleString()}</div>
                <div className="stat-label">Social Points</div>
              </div>
              <div className="stat-icon social">
                <Users size={24} />
              </div>
            </div>
            <div className="stat-change positive">
              +30% from last month
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardContent className="p-6">
          <h3 className="text-xl font-semibold mb-4">Your Rewards Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Points</p>
              <p className="text-2xl font-bold">{stats.totalPoints.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending RDL Rewards</p>
              <p className="text-2xl font-bold text-green-500">{stats.pendingRewards} RDL</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Claimed</p>
              <p className="text-2xl font-bold">{stats.claimedRewards} RDL</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
