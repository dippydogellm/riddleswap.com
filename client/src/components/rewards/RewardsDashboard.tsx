import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, TrendingUp, Gift, Users, Wallet, Settings } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import "./rewards.css";
import RewardsOverview from "./RewardsOverview";
import RewardsConfig from "./RewardsConfig";
import RewardsHistory from "./RewardsHistory";
import RewardsDistributionPanel from "./RewardsDistributionPanel";

export default function RewardsDashboard() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch user's rewards data
  const { data: rewardsData, isLoading } = useQuery({
    queryKey: ["/api/rewards/user-stats"],
    enabled: true,
  });

  // Fetch bank wallet balance
  const { data: bankBalance } = useQuery<{ xrpBalance: number; monthlyIncome: number }>({
    queryKey: ["/api/rewards/bank-balance"],
    enabled: true,
  });

  return (
    <div className="rewards-dashboard">
      <div className="rewards-header">
        <div className="rewards-title-section">
          <Trophy className="rewards-icon" size={32} />
          <div>
            <h1 className="rewards-title">RDL Rewards System</h1>
            <p className="rewards-subtitle">Earn rewards for trading, holding, and social interactions</p>
          </div>
        </div>
        
        {bankBalance && (
          <Card className="bank-balance-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Wallet size={20} />
                <div>
                  <p className="text-sm text-muted-foreground">Bank Wallet Balance</p>
                  <p className="text-xl font-bold">{bankBalance.xrpBalance} XRP</p>
                  <p className="text-sm text-green-500">+{bankBalance.monthlyIncome} XRP this month</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="rewards-tabs">
        <TabsList className="rewards-tabs-list">
          <TabsTrigger value="overview" className="rewards-tab">
            <Trophy size={16} />
            Overview
          </TabsTrigger>
          <TabsTrigger value="history" className="rewards-tab">
            <TrendingUp size={16} />
            History
          </TabsTrigger>
          <TabsTrigger value="distribution" className="rewards-tab">
            <Gift size={16} />
            Distribution
          </TabsTrigger>
          <TabsTrigger value="config" className="rewards-tab">
            <Settings size={16} />
            Configuration
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="rewards-content">
          <RewardsOverview data={rewardsData} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="history" className="rewards-content">
          <RewardsHistory />
        </TabsContent>

        <TabsContent value="distribution" className="rewards-content">
          <RewardsDistributionPanel />
        </TabsContent>

        <TabsContent value="config" className="rewards-content">
          <RewardsConfig />
        </TabsContent>
      </Tabs>
    </div>
  );
}
