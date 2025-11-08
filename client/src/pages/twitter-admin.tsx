/**
 * Twitter Admin Interface - THE ORACLE Tweet Management
 * Allows admins to manage automatic tweets and promotional tweet orders
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Twitter, 
  Clock, 
  DollarSign, 
  Send, 
  TrendingUp,
  Calendar,
  Zap,
  Coins
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function TwitterAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [manualTweetContent, setManualTweetContent] = useState("");
  const [promotionalTweet, setPromotionalTweet] = useState({
    project_name: "",
    description: "",
    website: "",
    tagline: "",
    payment_wallet: ""
  });

  // Get Twitter stats
  const { data: twitterStats, isLoading: loadingStats } = useQuery({
    queryKey: ['/api/twitter/stats'],
    queryFn: async () => {
      const response = await apiRequest('/api/twitter/stats');
      return await response.json() as any;
    }
  });

  // Manual tweet posting mutation
  const postManualTweetMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await apiRequest('/api/twitter/post-tweet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, type: 'manual' })
      });
      return await response.json() as any;
    },
    onSuccess: () => {
      toast({
        title: "Tweet Posted",
        description: "Manual tweet has been posted successfully",
        variant: "default"
      });
      setManualTweetContent("");
      queryClient.invalidateQueries({ queryKey: ['/api/twitter/stats'] });
    },
    onError: (error: any) => {
      toast({
        title: "Tweet Failed",
        description: error.message || "Failed to post tweet",
        variant: "destructive"
      });
    }
  });

  // Promotional tweet order mutation
  const createPromotionalTweetMutation = useMutation({
    mutationFn: async (orderData: any) => {
      const response = await apiRequest('/api/twitter/promotional-tweet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...orderData,
          payment_amount: 30
        })
      });
      return await response.json() as any;
    },
    onSuccess: (data) => {
      toast({
        title: "Promotional Tweet Order Created",
        description: `Payment required: 30 XRP to ${data.bank_wallet}. Destination tag: ${data.destination_tag}`,
        variant: "default"
      });
      setPromotionalTweet({
        project_name: "",
        description: "",
        website: "",
        tagline: "",
        payment_wallet: ""
      });
    },
    onError: (error: any) => {
      toast({
        title: "Order Failed",
        description: error.message || "Failed to create promotional tweet order",
        variant: "destructive"
      });
    }
  });

  const handleManualTweet = () => {
    if (!manualTweetContent.trim() || manualTweetContent.length > 280) {
      toast({
        title: "Invalid Tweet",
        description: "Tweet must be between 1-280 characters",
        variant: "destructive"
      });
      return;
    }
    postManualTweetMutation.mutate(manualTweetContent);
  };

  const handlePromotionalTweet = () => {
    if (!promotionalTweet.project_name || !promotionalTweet.description || !promotionalTweet.payment_wallet) {
      toast({
        title: "Missing Information",
        description: "Project name, description, and payment wallet are required",
        variant: "destructive"
      });
      return;
    }
    createPromotionalTweetMutation.mutate(promotionalTweet);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Twitter className="h-10 w-10 text-blue-500" />
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            THE ORACLE Twitter Management
          </h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Automated tweets every 2 hours • Promotional tweets for 30 XRP
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Tweets</p>
                <p className="text-2xl font-bold">{twitterStats?.stats?.total_tweets || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Auto Tweets</p>
                <p className="text-2xl font-bold">{twitterStats?.stats?.automatic_tweets || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Promotional</p>
                <p className="text-2xl font-bold">{twitterStats?.stats?.promotional_tweets || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Coins className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-sm text-muted-foreground">Revenue</p>
                <p className="text-2xl font-bold">{twitterStats?.stats?.total_revenue || 0} XRP</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Twitter Configuration Status */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className="h-6 w-6 text-blue-500" />
              <div>
                <h3 className="font-semibold">Twitter API Status</h3>
                <p className="text-sm text-muted-foreground">
                  {twitterStats?.stats?.twitter_configured ? "Connected and operational" : "API keys not configured"}
                </p>
              </div>
            </div>
            <Badge variant={twitterStats?.stats?.twitter_configured ? "default" : "destructive"}>
              {twitterStats?.stats?.twitter_configured ? "Configured" : "Not Configured"}
            </Badge>
          </div>
          
          {twitterStats?.stats?.next_scheduled && (
            <div className="mt-4 p-3 bg-muted rounded">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-500" />
                <span className="text-sm">
                  Next automatic tweet: {new Date(twitterStats.stats.next_scheduled).toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Management Tabs */}
      <Tabs defaultValue="manual" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="manual" data-testid="tab-manual">
            <Send className="h-4 w-4 mr-2" />
            Manual Tweet
          </TabsTrigger>
          <TabsTrigger value="promotional" data-testid="tab-promotional">
            <Coins className="h-4 w-4 mr-2" />
            Promotional Tweets
          </TabsTrigger>
        </TabsList>

        {/* Manual Tweet Tab */}
        <TabsContent value="manual" data-testid="content-manual">
          <Card>
            <CardHeader>
              <CardTitle>Post Manual Tweet</CardTitle>
              <CardDescription>
                Compose and post a tweet immediately using THE ORACLE voice
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="manual-tweet">Tweet Content</Label>
                <Textarea
                  id="manual-tweet"
                  placeholder="What's happening in the RiddleSwap ecosystem?"
                  value={manualTweetContent}
                  onChange={(e) => setManualTweetContent(e.target.value)}
                  maxLength={280}
                  rows={4}
                  data-testid="textarea-manual-tweet"
                />
                <div className="flex justify-between items-center mt-2">
                  <span className="text-sm text-muted-foreground">
                    {manualTweetContent.length}/280 characters
                  </span>
                  <Badge variant={manualTweetContent.length > 280 ? "destructive" : "secondary"}>
                    {280 - manualTweetContent.length} remaining
                  </Badge>
                </div>
              </div>
              
              <Button
                onClick={handleManualTweet}
                disabled={!manualTweetContent.trim() || manualTweetContent.length > 280 || postManualTweetMutation.isPending}
                className="w-full"
                data-testid="button-post-manual-tweet"
              >
                <Send className="h-4 w-4 mr-2" />
                {postManualTweetMutation.isPending ? "Posting..." : "Post Tweet"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Promotional Tweet Tab */}
        <TabsContent value="promotional" data-testid="content-promotional">
          <Card>
            <CardHeader>
              <CardTitle>Create Promotional Tweet Order</CardTitle>
              <CardDescription>
                Accept 30 XRP payment for promotional tweet about your project
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="project-name">Project Name *</Label>
                  <Input
                    id="project-name"
                    placeholder="Your Project Name"
                    value={promotionalTweet.project_name}
                    onChange={(e) => setPromotionalTweet(prev => ({ ...prev, project_name: e.target.value }))}
                    data-testid="input-project-name"
                  />
                </div>
                
                <div>
                  <Label htmlFor="website">Website URL</Label>
                  <Input
                    id="website"
                    placeholder="https://yourproject.com"
                    value={promotionalTweet.website}
                    onChange={(e) => setPromotionalTweet(prev => ({ ...prev, website: e.target.value }))}
                    data-testid="input-website"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Project Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of your project..."
                  value={promotionalTweet.description}
                  onChange={(e) => setPromotionalTweet(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  data-testid="textarea-description"
                />
              </div>

              <div>
                <Label htmlFor="tagline">Tagline</Label>
                <Input
                  id="tagline"
                  placeholder="Your project's catchy tagline"
                  value={promotionalTweet.tagline}
                  onChange={(e) => setPromotionalTweet(prev => ({ ...prev, tagline: e.target.value }))}
                  data-testid="input-tagline"
                />
              </div>

              <div>
                <Label htmlFor="payment-wallet">Your XRP Wallet Address *</Label>
                <Input
                  id="payment-wallet"
                  placeholder="rYourXRPWalletAddress..."
                  value={promotionalTweet.payment_wallet}
                  onChange={(e) => setPromotionalTweet(prev => ({ ...prev, payment_wallet: e.target.value }))}
                  data-testid="input-payment-wallet"
                />
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Payment Information</h4>
                <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                  <li>• Cost: 30 XRP per promotional tweet</li>
                  <li>• Payment wallet: rH1zJSuP4CQtPeTzGp4gCzPpW6J1L9JHWt</li>
                  <li>• You'll receive a destination tag for tracking</li>
                  <li>• Tweet will be posted after payment confirmation</li>
                </ul>
              </div>

              <Button
                onClick={handlePromotionalTweet}
                disabled={createPromotionalTweetMutation.isPending}
                className="w-full"
                data-testid="button-create-promotional-order"
              >
                <Coins className="h-4 w-4 mr-2" />
                {createPromotionalTweetMutation.isPending ? "Creating Order..." : "Create 30 XRP Tweet Order"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
