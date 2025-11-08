import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Calendar, DollarSign, Gift, TrendingUp } from "lucide-react";
import { format } from "date-fns";

export default function RewardsDistributionPanel() {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch current month's distribution status
  const { data: distributionData, isLoading } = useQuery({
    queryKey: ["/api/rewards/distribution/current"],
  });

  // Fetch bank wallet stats
  const { data: bankStats } = useQuery({
    queryKey: ["/api/rewards/bank-stats"],
  });

  // Process monthly distribution
  const processDistribution = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/rewards/distribution/process", {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to process distribution");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Distribution Complete",
        description: "Monthly rewards have been calculated and distributed.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/rewards"] });
      setIsProcessing(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to process distribution. Please try again.",
        variant: "destructive",
      });
      setIsProcessing(false);
    },
  });

  // Take snapshot
  const takeSnapshot = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/rewards/snapshot", {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to take snapshot");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Snapshot Complete",
        description: "Holdings snapshot has been taken successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/rewards"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to take snapshot. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleProcessDistribution = async () => {
    setIsProcessing(true);
    // First take snapshot, then process distribution
    await takeSnapshot.mutateAsync();
    await processDistribution.mutate();
  };

  const currentMonth = format(new Date(), "MMMM yyyy");
  const isFirstOfMonth = new Date().getDate() === 1;

  return (
    <div className="distribution-panel">
      <div className="distribution-header">
        <div>
          <h2 className="text-2xl font-bold mb-2">Monthly Distribution</h2>
          <p className="text-muted-foreground">
            Distribute 25% of monthly revenue as RDL rewards
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Current Month</p>
          <p className="text-xl font-semibold">{currentMonth}</p>
        </div>
      </div>

      <div className="distribution-stats">
        <div className="distribution-stat">
          <div className="distribution-stat-label">
            <DollarSign size={16} className="inline mr-1" />
            Total Revenue (XRP)
          </div>
          <div className="distribution-stat-value">
            {bankStats?.monthlyRevenue || "0"} XRP
          </div>
        </div>

        <div className="distribution-stat">
          <div className="distribution-stat-label">
            <Gift size={16} className="inline mr-1" />
            Rewards Pool (25%)
          </div>
          <div className="distribution-stat-value text-green-500">
            {((bankStats?.monthlyRevenue || 0) * 0.25).toFixed(2)} XRP
          </div>
        </div>

        <div className="distribution-stat">
          <div className="distribution-stat-label">
            <TrendingUp size={16} className="inline mr-1" />
            RDL to Distribute
          </div>
          <div className="distribution-stat-value text-purple-500">
            {distributionData?.rdlToDistribute || "0"} RDL
          </div>
        </div>

        <div className="distribution-stat">
          <div className="distribution-stat-label">
            <Calendar size={16} className="inline mr-1" />
            Distribution Status
          </div>
          <div className="distribution-stat-value">
            {distributionData?.status || "Pending"}
          </div>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Distribution Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Step 1: Take Holdings Snapshot</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Capture current token and NFT holdings for all users
            </p>
            <Button
              onClick={() => takeSnapshot.mutate()}
              disabled={takeSnapshot.isPending}
              variant="outline"
            >
              {takeSnapshot.isPending ? "Taking Snapshot..." : "Take Snapshot"}
            </Button>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Step 2: Process Distribution</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Calculate points and distribute RDL rewards to all eligible users
            </p>
            <Button
              onClick={handleProcessDistribution}
              disabled={isProcessing || !isFirstOfMonth}
              className="distribution-button"
            >
              {isProcessing ? "Processing..." : "Process Monthly Distribution"}
            </Button>
            {!isFirstOfMonth && (
              <p className="text-sm text-yellow-500 mt-2">
                Distribution can only be processed on the 1st of each month
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent Distributions</CardTitle>
        </CardHeader>
        <CardContent>
          {distributionData?.recentDistributions?.map((dist: any) => (
            <div key={dist.id} className="flex justify-between items-center py-3 border-b">
              <div>
                <p className="font-semibold">{dist.distributionMonth}</p>
                <p className="text-sm text-muted-foreground">
                  {dist.totalUsers} users rewarded
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{dist.rdlDistributed} RDL</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(dist.distributionDate), "MMM d, yyyy")}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
