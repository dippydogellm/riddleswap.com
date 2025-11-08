import { Trophy, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { RewardsDashboard } from "@/components/rewards-dashboard";

export default function UserRewards() {
  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Trophy className="h-8 w-8 text-primary" />
            Platform Rewards
          </h1>
          <p className="text-muted-foreground mt-2">
            Earn RDL rewards from platform usage - swaps, bridges, NFT trading, and social activities
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin">
            <Button variant="outline" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Admin Panel
            </Button>
          </Link>
        </div>
      </div>

      <RewardsDashboard walletAddress="rEVrTKUKSLx5nxdfV8SAFTxS9FGFrfHRLo" />
    </div>
  );
}
