import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";

export default function RewardsHistory() {
  const { toast } = useToast();

  // Fetch rewards history
  const { data: history, isLoading } = useQuery<Array<{
    id: string;
    distributionMonth: string;
    swapPoints: number;
    bridgePoints: number;
    nftPoints: number;
    rdlHoldingPoints: number;
    socialPoints: number;
    totalPoints: number;
    rdlReward: number;
    status: string;
    claimedDate?: string;
  }>>({
    queryKey: ["/api/rewards/history"],
  });

  // Claim rewards mutation
  const claimReward = useMutation({
    mutationFn: async (rewardId: string) => {
      const response = await fetch(`/api/rewards/claim/${rewardId}`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to claim reward");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Reward Claimed",
        description: "Your RDL rewards have been sent to your wallet.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/rewards/history"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to claim reward. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return <div>Loading rewards history...</div>;
  }

  const rewards = history || [];

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Rewards History</h2>
      
      {rewards.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No rewards history yet. Start trading and interacting to earn rewards!
        </div>
      ) : (
        <table className="history-table">
          <thead>
            <tr>
              <th>Month</th>
              <th>Swap Points</th>
              <th>Bridge Points</th>
              <th>NFT Points</th>
              <th>RDL Points</th>
              <th>Social Points</th>
              <th>Total Points</th>
              <th>RDL Reward</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rewards.map((reward: any) => (
              <tr key={reward.id}>
                <td>{reward.distributionMonth}</td>
                <td>{reward.swapPoints.toLocaleString()}</td>
                <td>{reward.bridgePoints.toLocaleString()}</td>
                <td>{reward.nftPoints.toLocaleString()}</td>
                <td>{reward.rdlHoldingPoints.toLocaleString()}</td>
                <td>{reward.socialPoints.toLocaleString()}</td>
                <td className="font-semibold">{reward.totalPoints.toLocaleString()}</td>
                <td className="font-bold text-green-500">{reward.rdlReward} RDL</td>
                <td>
                  {reward.claimStatus === "claimed" ? (
                    <span className="claimed-badge">Claimed</span>
                  ) : (
                    <span className="text-yellow-500">Unclaimed</span>
                  )}
                </td>
                <td>
                  {reward.claimStatus === "unclaimed" ? (
                    <Button
                      className="claim-button"
                      size="sm"
                      onClick={() => claimReward.mutate(reward.id)}
                      disabled={claimReward.isPending}
                    >
                      Claim
                    </Button>
                  ) : (
                    <span className="text-muted-foreground text-sm">
                      {formatDistanceToNow(new Date(reward.claimedAt), { addSuffix: true })}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
