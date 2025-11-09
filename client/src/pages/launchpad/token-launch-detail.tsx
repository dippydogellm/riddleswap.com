import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft,
  Clock, 
  Users, 
  Target, 
  Coins, 
  TrendingUp,
  Timer,
  Star,
  Shield,
  CheckCircle,
  AlertCircle,
  Share2,
  Heart,
  MessageCircle,
  ExternalLink,
  Copy
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

interface TokenLaunch {
  id: number;
  creatorWallet: string;
  chainType: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDescription: string;
  tokenLogo: string;
  totalSupply: string;
  presaleAmount: string;
  presalePrice: string;
  liquidityThreshold: string;
  softCap: string;
  hardCap: string;
  setupFeePaid: boolean;
  status: string;
  currentStage: string;
  totalRaised: string;
  participantCount: number;
  whitelistStartTime: string;
  whitelistEndTime: string;
  nftHoldersStartTime: string;
  nftHoldersEndTime: string;
  openWlStartTime: string;
  openWlEndTime: string;
  openSaleStartTime: string;
  openSaleEndTime: string;
  createdAt: string;
}

interface LaunchDetailData {
  launch: TokenLaunch;
  stats: {
    totalContributions: string;
    contributorCount: number;
  };
  recentContributions: Array<{
    contributorWallet: string;
    amount: string;
    tokenAmount: string;
    stage: string;
    createdAt: string;
  }>;
}

export default function TokenLaunchDetail() {
  const [, params] = useRoute<{ id: string }>("/launchpad/:id");
  const launchId = params?.id;
  const [contributionAmount, setContributionAmount] = useState("");
  const [showContributeForm, setShowContributeForm] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch launch details
  const { data: launchData, isLoading } = useQuery<LaunchDetailData>({
    queryKey: ['/api/launchpad/launch', launchId],
    queryFn: async () => {
      const response = await apiRequest(`/api/launchpad/launch/${launchId}`);
      return response.json();
    },
    enabled: !!launchId,
  });

  const launch = launchData?.launch;

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-300 rounded w-1/4"></div>
          <div className="h-64 bg-gray-300 rounded"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="h-40 bg-gray-300 rounded"></div>
            <div className="h-40 bg-gray-300 rounded"></div>
            <div className="h-40 bg-gray-300 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!launch) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="text-center py-12">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Launch Not Found</h2>
          <p className="text-muted-foreground mb-6">
            The token launch you're looking for doesn't exist or has been removed.
          </p>
          <Link href="/launchpad">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Launchpad
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const getChainColor = (chain: string) => {
    const colors: Record<string, string> = {
      xrpl: "bg-blue-500",
      ethereum: "bg-purple-500",
      solana: "bg-green-500",
      bsc: "bg-yellow-500",
      base: "bg-blue-600",
      polygon: "bg-indigo-500"
    };
    return colors[chain] || "bg-gray-500";
  };

  const getStageInfo = (stage: string) => {
    const stages = {
      setup: { label: "Setup", color: "bg-gray-500", description: "Initial setup phase" },
      whitelist: { label: "Whitelist", color: "bg-blue-500", description: "Whitelist members only" },
      nft_holders: { label: "NFT Holders", color: "bg-purple-500", description: "NFT holders priority" },
      open_wl: { label: "Open WL", color: "bg-orange-500", description: "Open whitelist" },
      open_sale: { label: "Open Sale", color: "bg-green-500", description: "Public sale" },
      completed: { label: "Completed", color: "bg-green-600", description: "Launch completed" }
    };
    return stages[stage as keyof typeof stages] || stages.setup;
  };

  const progressPercentage = Math.min(
    (parseFloat(launch.totalRaised) / parseFloat(launch.hardCap)) * 100,
    100
  );

  const stageInfo = getStageInfo(launch.currentStage);
  const isLive = ["whitelist", "nft_holders", "open_wl", "open_sale"].includes(launch.currentStage);
  const canContribute = isLive && parseFloat(launch.totalRaised) < parseFloat(launch.hardCap);

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/launchpad">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-4">
            {launch.tokenLogo && (
              <img 
                src={launch.tokenLogo} 
                alt={`${launch.tokenName} logo`} 
                className="w-16 h-16 rounded-full"
              />
            )}
            <div>
              <h1 className="text-3xl font-bold">{launch.tokenName}</h1>
              <div className="flex items-center gap-3 mt-2">
                <Badge variant="secondary" className="text-lg">${launch.tokenSymbol}</Badge>
                <div className={`w-4 h-4 rounded-full ${getChainColor(launch.chainType)}`} />
                <span className="text-muted-foreground capitalize">{launch.chainType}</span>
                <Badge className={stageInfo.color}>{stageInfo.label}</Badge>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
          <Button variant="outline" size="sm">
            <Heart className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Description */}
      {launch.tokenDescription && (
        <Card className="mb-6">
          <CardContent className="p-6">
            <p className="text-lg leading-relaxed">{launch.tokenDescription}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Progress Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Presale Progress</span>
                <Badge variant={canContribute ? "default" : "secondary"}>
                  {canContribute ? "Live" : "Ended"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Raised</span>
                  <span className="font-medium">
                    {parseFloat(launch.totalRaised).toFixed(2)} / {parseFloat(launch.hardCap).toFixed(0)} XRP
                  </span>
                </div>
                <Progress value={progressPercentage} className="h-3" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{progressPercentage.toFixed(1)}% completed</span>
                  <span>Soft Cap: {launch.softCap} XRP</span>
                </div>
              </div>

              {canContribute && (
                <div className="pt-4">
                  <Button 
                    onClick={() => setShowContributeForm(!showContributeForm)}
                    className="w-full"
                    size="lg"
                  >
                    <TrendingUp className="h-5 w-5 mr-2" />
                    Contribute to {launch.tokenName}
                  </Button>

                  {showContributeForm && (
                    <div className="mt-4 p-4 bg-muted/50 rounded-lg space-y-3">
                      <div className="flex gap-3">
                        <Input
                          type="number"
                          placeholder="Amount in XRP"
                          value={contributionAmount}
                          onChange={(e) => setContributionAmount(e.target.value)}
                        />
                        <Button disabled>
                          Buy Tokens
                        </Button>
                      </div>
                      {contributionAmount && (
                        <div className="text-sm text-muted-foreground">
                          You'll receive ~{(parseFloat(contributionAmount) / parseFloat(launch.presalePrice)).toFixed(0)} {launch.tokenSymbol}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Token Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Total Supply</span>
                      <div className="font-medium">{parseFloat(launch.totalSupply).toLocaleString()}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Presale Amount</span>
                      <div className="font-medium">{parseFloat(launch.presaleAmount).toLocaleString()}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Price per Token</span>
                      <div className="font-medium">{launch.presalePrice} XRP</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Liquidity Threshold</span>
                      <div className="font-medium">{launch.liquidityThreshold} XRP</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Creator</span>
                      <div className="font-medium font-mono text-xs">{launch.creatorWallet}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Created</span>
                      <div className="font-medium">{new Date(launch.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="activity" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Contributions</CardTitle>
                </CardHeader>
                <CardContent>
                  {launchData?.recentContributions?.length > 0 ? (
                    <div className="space-y-3">
                      {launchData.recentContributions.map((contribution, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded">
                          <div>
                            <div className="font-mono text-sm">{contribution.contributorWallet}</div>
                            <div className="text-xs text-muted-foreground">{contribution.stage}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">{contribution.amount} XRP</div>
                            <div className="text-xs text-muted-foreground">
                              {contribution.tokenAmount} {launch.tokenSymbol}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No contributions yet
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="timeline" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Launch Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { stage: "setup", label: "Setup Complete", time: launch.createdAt },
                      { stage: "whitelist", label: "Whitelist Phase", time: launch.whitelistStartTime },
                      { stage: "nft_holders", label: "NFT Holders Phase", time: launch.nftHoldersStartTime },
                      { stage: "open_wl", label: "Open Whitelist", time: launch.openWlStartTime },
                      { stage: "open_sale", label: "Open Sale", time: launch.openSaleStartTime },
                    ].map((phase, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${
                          phase.stage === launch.currentStage ? 'bg-primary' : 
                          index < ["setup", "whitelist", "nft_holders", "open_wl", "open_sale"].indexOf(launch.currentStage) 
                            ? 'bg-green-500' : 'bg-gray-300'
                        }`} />
                        <div className="flex-1">
                          <div className="font-medium">{phase.label}</div>
                          <div className="text-sm text-muted-foreground">
                            {phase.time ? new Date(phase.time).toLocaleString() : "Not scheduled"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">
                  {launch.participantCount}
                </div>
                <div className="text-sm text-muted-foreground">Participants</div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="text-center">
                  <div className="font-bold">{launch.softCap}</div>
                  <div className="text-muted-foreground">Soft Cap</div>
                </div>
                <div className="text-center">
                  <div className="font-bold">{launch.hardCap}</div>
                  <div className="text-muted-foreground">Hard Cap</div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center gap-2 text-sm">
                  {launch.setupFeePaid && (
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      Verified
                    </div>
                  )}
                  {parseFloat(launch.totalRaised) >= parseFloat(launch.softCap) && (
                    <div className="flex items-center gap-1 text-blue-600">
                      <Shield className="h-4 w-4" />
                      Soft Cap Met
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Share */}
          <Card>
            <CardHeader>
              <CardTitle>Share This Launch</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start">
                <Copy className="h-4 w-4 mr-2" />
                Copy Link
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <MessageCircle className="h-4 w-4 mr-2" />
                Share on Social
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <ExternalLink className="h-4 w-4 mr-2" />
                View on Explorer
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
