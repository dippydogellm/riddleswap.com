import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  Calendar, 
  Twitter, 
  Instagram, 
  MessageCircle, 
  Users, 
  Trophy, 
  Zap,
  Clock,
  Gift,
  Target,
  TrendingUp
} from "lucide-react";

interface EngagementSummary {
  engagements: Array<{
    platform: string;
    engagement_type: string;
    count: number;
    total_points: number;
  }>;
  loginStats: {
    total_logins: number;
    max_streak: number;
  };
}

interface RaidCampaign {
  id: string;
  title: string;
  description: string;
  target_url: string;
  platform: string;
  reward_per_engagement: number;
  max_participants?: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_by: string;
}

export default function SocialEngagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newPostUrl, setNewPostUrl] = useState("");
  const [newRaidProof, setNewRaidProof] = useState("");
  const [selectedCampaign, setSelectedCampaign] = useState<RaidCampaign | null>(null);
  
  // Get engagement summary
  const { data: summary, isLoading: summaryLoading } = useQuery<{ success: boolean; engagements: any[]; loginStats: any }>({
    queryKey: ["/api/social-engagement/summary"],
    retry: false,
  });
  
  // Get active raid campaigns
  const { data: raidsData, isLoading: raidsLoading } = useQuery<{ success: boolean; campaigns: RaidCampaign[] }>({
    queryKey: ["/api/social-engagement/raids"],
    retry: false,
  });
  
  // Daily login mutation
  const dailyLoginMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/social-engagement/daily-login", {
        method: "POST",
      });
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast({
          title: "Daily Login Reward!",
          description: data.reward ? 
            `Earned ${data.reward.amount} ${data.reward.token} for ${data.consecutiveDays} consecutive days!` :
            "Already logged in today!",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/social-engagement/summary"] });
        queryClient.invalidateQueries({ queryKey: ["/api/rewards/summary"] });
      }
    },
    onError: (error) => {
      toast({
        title: "Login Failed",
        description: "Failed to record daily login",
        variant: "destructive",
      });
    },
  });
  
  // Social engagement mutation
  const engagementMutation = useMutation({
    mutationFn: async (data: { platform: string; engagementType: string; postUrl?: string }) => {
      return await apiRequest("/api/social-engagement/engagement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast({
          title: "Engagement Recorded!",
          description: `Earned ${data.rewardPoints} points!`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/social-engagement/summary"] });
      }
    },
    onError: (error) => {
      toast({
        title: "Failed to Record",
        description: "Failed to record engagement",
        variant: "destructive",
      });
    },
  });
  
  // Raid participation mutation
  const raidMutation = useMutation({
    mutationFn: async (data: { campaignId: string; engagementProof: string }) => {
      return await apiRequest(`/api/social-engagement/raids/${data.campaignId}/participate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engagementProof: data.engagementProof }),
      });
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast({
          title: "Raid Completed!",
          description: `Earned ${data.reward.amount} ${data.reward.token}!`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/social-engagement/summary"] });
        queryClient.invalidateQueries({ queryKey: ["/api/rewards/summary"] });
        setNewRaidProof("");
        setSelectedCampaign(null);
      }
    },
    onError: (error) => {
      toast({
        title: "Raid Failed",
        description: "Failed to participate in raid",
        variant: "destructive",
      });
    },
  });
  
  // Auto claim daily login on page load
  useEffect(() => {
    const claimDailyLogin = async () => {
      const lastLogin = localStorage.getItem('lastDailyLogin');
      const today = new Date().toDateString();
      
      if (lastLogin !== today) {
        dailyLoginMutation.mutate();
        localStorage.setItem('lastDailyLogin', today);
      }
    };
    
    claimDailyLogin();
  }, []);
  
  const handleEngagement = (platform: string, type: string) => {
    engagementMutation.mutate({ platform, engagementType: type, postUrl: newPostUrl || undefined });
    setNewPostUrl("");
  };
  
  const totalPoints = summary?.engagements?.reduce((sum, eng) => sum + eng.total_points, 0) || 0;
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Social Engagement Rewards</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Earn RDL tokens by engaging on social media and logging in daily
        </p>
      </div>
      
      <div className="grid gap-6 mb-8">
        {/* Daily Login Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Daily Login Rewards
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Login daily to earn bonus RDL tokens
                </p>
                <div className="flex items-center gap-4">
                  <Badge variant="secondary">
                    Total Logins: {summary?.loginStats?.total_logins || 0}
                  </Badge>
                  <Badge variant="secondary">
                    Max Streak: {summary?.loginStats?.max_streak || 0} days
                  </Badge>
                </div>
              </div>
              <Button 
                onClick={() => dailyLoginMutation.mutate()}
                disabled={dailyLoginMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                <Gift className="w-4 h-4 mr-2" />
                {dailyLoginMutation.isPending ? "Claiming..." : "Claim Daily Bonus"}
              </Button>
            </div>
          </CardContent>
        </Card>
        
        {/* Points Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              Engagement Points: {totalPoints.toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {summary?.engagements?.map((eng, idx) => (
                <div key={idx} className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{eng.total_points}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {eng.platform} {eng.engagement_type}s
                  </div>
                  <div className="text-xs text-gray-500">{eng.count} actions</div>
                </div>
              )) || (
                <div className="col-span-full text-center py-8 text-gray-500">
                  No engagement recorded yet. Start earning points below!
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Tabs defaultValue="engage" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="engage">Record Engagement</TabsTrigger>
          <TabsTrigger value="raids">Raid Campaigns</TabsTrigger>
        </TabsList>
        
        <TabsContent value="engage" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Record Your Social Media Engagement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">Post URL (optional)</label>
                <Input
                  placeholder="https://twitter.com/yourpost or https://instagram.com/p/yourpost"
                  value={newPostUrl}
                  onChange={(e) => setNewPostUrl(e.target.value)}
                />
              </div>
              
              <div className="grid gap-4">
                <h3 className="font-semibold">Twitter/X Engagement</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => handleEngagement('twitter', 'post')}
                    className="flex items-center gap-2"
                  >
                    <Twitter className="w-4 h-4" />
                    Post (50 pts)
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => handleEngagement('twitter', 'retweet')}
                    className="flex items-center gap-2"
                  >
                    <Twitter className="w-4 h-4" />
                    Retweet (20 pts)
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => handleEngagement('twitter', 'like')}
                    className="flex items-center gap-2"
                  >
                    <Twitter className="w-4 h-4" />
                    Like (5 pts)
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => handleEngagement('twitter', 'comment')}
                    className="flex items-center gap-2"
                  >
                    <Twitter className="w-4 h-4" />
                    Comment (15 pts)
                  </Button>
                </div>
              </div>
              
              <div className="grid gap-4">
                <h3 className="font-semibold">Instagram Engagement</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => handleEngagement('instagram', 'post')}
                    className="flex items-center gap-2"
                  >
                    <Instagram className="w-4 h-4" />
                    Post (50 pts)
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => handleEngagement('instagram', 'story')}
                    className="flex items-center gap-2"
                  >
                    <Instagram className="w-4 h-4" />
                    Story (40 pts)
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => handleEngagement('instagram', 'reel')}
                    className="flex items-center gap-2"
                  >
                    <Instagram className="w-4 h-4" />
                    Reel (60 pts)
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => handleEngagement('instagram', 'like')}
                    className="flex items-center gap-2"
                  >
                    <Instagram className="w-4 h-4" />
                    Like (5 pts)
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="raids" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                Active Raid Campaigns
              </CardTitle>
            </CardHeader>
            <CardContent>
              {raidsLoading ? (
                <div className="text-center py-8">Loading campaigns...</div>
              ) : raidsData?.campaigns?.length ? (
                <div className="grid gap-4">
                  {raidsData.campaigns.map((campaign) => (
                    <div key={campaign.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold">{campaign.title}</h3>
                        <Badge className="bg-green-100 text-green-800">
                          {campaign.reward_per_engagement} RDL
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        {campaign.description}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                        <span>Platform: {campaign.platform}</span>
                        <span>Ends: {new Date(campaign.end_date).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(campaign.target_url, '_blank')}
                        >
                          View Target
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setSelectedCampaign(campaign)}
                          className="bg-purple-600 hover:bg-purple-700"
                        >
                          Participate
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No active raid campaigns at the moment
                </div>
              )}
            </CardContent>
          </Card>
          
          {selectedCampaign && (
            <Card>
              <CardHeader>
                <CardTitle>Participate in: {selectedCampaign.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Proof of Engagement (Post URL or Screenshot URL)
                  </label>
                  <Input
                    placeholder="https://twitter.com/yourpost or image URL"
                    value={newRaidProof}
                    onChange={(e) => setNewRaidProof(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => raidMutation.mutate({ 
                      campaignId: selectedCampaign.id, 
                      engagementProof: newRaidProof 
                    })}
                    disabled={!newRaidProof || raidMutation.isPending}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {raidMutation.isPending ? "Submitting..." : "Submit Participation"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedCampaign(null);
                      setNewRaidProof("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
