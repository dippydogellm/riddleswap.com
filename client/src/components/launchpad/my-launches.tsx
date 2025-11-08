import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Settings, 
  Users, 
  Clock, 
  TrendingUp, 
  Edit, 
  Eye,
  Calendar,
  Plus,
  Timer,
  Target,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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

interface MyLaunchesProps {
  walletAddress: string;
}

export function MyLaunches({ walletAddress }: MyLaunchesProps) {
  const [selectedLaunch, setSelectedLaunch] = useState<TokenLaunch | null>(null);
  const [newWhitelistAddress, setNewWhitelistAddress] = useState("");
  const [whitelistStage, setWhitelistStage] = useState("whitelist");
  const [stageTimings, setStageTimings] = useState({
    whitelistStart: "",
    whitelistEnd: "",
    nftHoldersStart: "",
    nftHoldersEnd: "",
    openWlStart: "",
    openWlEnd: "",
    openSaleStart: "",
    openSaleEnd: "",
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch user's launches
  const { data: launches = [], isLoading } = useQuery<TokenLaunch[]>({
    queryKey: ['/api/launchpad/my-launches', walletAddress],
    queryFn: () => apiRequest(`/api/launchpad/my-launches/${walletAddress}`),
  });

  // Fetch whitelist for selected launch
  const { data: whitelist = [] } = useQuery({
    queryKey: ['/api/launchpad/whitelist', selectedLaunch?.id],
    queryFn: () => apiRequest(`/api/launchpad/whitelist/${selectedLaunch?.id}`),
    enabled: !!selectedLaunch,
  });

  // Update stage mutation
  const updateStageMutation = useMutation({
    mutationFn: async ({ launchId, stage, timings }: { launchId: number; stage: string; timings: any }) => {
      return apiRequest(`/api/launchpad/launch/${launchId}/stage`, {
        method: 'PUT',
        body: JSON.stringify({ stage, timings })
      });
    },
    onSuccess: () => {
      toast({
        title: "Stage Updated",
        description: "Launch stage has been updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/launchpad/my-launches'] });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update stage",
        variant: "destructive",
      });
    }
  });

  // Add to whitelist mutation
  const addToWhitelistMutation = useMutation({
    mutationFn: async ({ launchId, walletAddress, stage }: { launchId: number; walletAddress: string; stage: string }) => {
      return apiRequest(`/api/launchpad/whitelist/${launchId}`, {
        method: 'POST',
        body: JSON.stringify({
          walletAddress,
          stage,
          addedBy: walletAddress
        })
      });
    },
    onSuccess: () => {
      toast({
        title: "Added to Whitelist",
        description: "Address has been added to the whitelist",
      });
      setNewWhitelistAddress("");
      queryClient.invalidateQueries({ queryKey: ['/api/launchpad/whitelist'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Add",
        description: error.message || "Failed to add to whitelist",
        variant: "destructive",
      });
    }
  });

  const getStageInfo = (stage: string) => {
    const stages = {
      setup: { label: "Setup", color: "bg-gray-500", next: "whitelist" },
      whitelist: { label: "Whitelist", color: "bg-blue-500", next: "nft_holders" },
      nft_holders: { label: "NFT Holders", color: "bg-purple-500", next: "open_wl" },
      open_wl: { label: "Open WL", color: "bg-orange-500", next: "open_sale" },
      open_sale: { label: "Open Sale", color: "bg-green-500", next: "completed" },
      completed: { label: "Completed", color: "bg-green-600", next: null }
    };
    return stages[stage as keyof typeof stages] || stages.setup;
  };

  const handleStageUpdate = (launch: TokenLaunch, newStage: string) => {
    updateStageMutation.mutate({
      launchId: launch.id,
      stage: newStage,
      timings: stageTimings
    });
  };

  const handleAddToWhitelist = () => {
    if (!selectedLaunch || !newWhitelistAddress) return;
    
    addToWhitelistMutation.mutate({
      launchId: selectedLaunch.id,
      walletAddress: newWhitelistAddress,
      stage: whitelistStage
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-300 rounded w-1/3 mb-4"></div>
          <div className="grid gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-300 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (launches.length === 0) {
    return (
      <div className="text-center py-12">
        <TrendingUp className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">No Launches Yet</h3>
        <p className="text-muted-foreground mb-6">
          You haven't created any token launches yet. Create your first launch to get started!
        </p>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Your First Launch
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">My Token Launches</h2>
        <Badge variant="secondary">{launches.length} Launches</Badge>
      </div>

      <div className="grid gap-6">
        {launches.map((launch) => {
          const stageInfo = getStageInfo(launch.currentStage);
          const progressPercentage = Math.min(
            (parseFloat(launch.totalRaised) / parseFloat(launch.hardCap)) * 100,
            100
          );

          return (
            <Card key={launch.id} className="overflow-hidden">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {launch.tokenLogo && (
                      <img 
                        src={launch.tokenLogo} 
                        alt={`${launch.tokenName} logo`} 
                        className="w-12 h-12 rounded-full"
                      />
                    )}
                    <div>
                      <CardTitle className="text-xl">{launch.tokenName} (${launch.tokenSymbol})</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="capitalize">{launch.chainType}</Badge>
                        <Badge className={stageInfo.color}>{stageInfo.label}</Badge>
                        {launch.setupFeePaid ? (
                          <div className="flex items-center gap-1 text-green-600 text-sm">
                            <CheckCircle className="h-4 w-4" />
                            Verified
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-orange-600 text-sm">
                            <AlertCircle className="h-4 w-4" />
                            Setup Fee Pending
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedLaunch(selectedLaunch?.id === launch.id ? null : launch)}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Manage
                  </Button>
                </div>
              </CardHeader>

              <CardContent>
                {/* Launch Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {parseFloat(launch.totalRaised).toFixed(0)}
                    </div>
                    <div className="text-sm text-muted-foreground">XRP Raised</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {launch.participantCount}
                    </div>
                    <div className="text-sm text-muted-foreground">Participants</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {progressPercentage.toFixed(1)}%
                    </div>
                    <div className="text-sm text-muted-foreground">Progress</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {launch.hardCap}
                    </div>
                    <div className="text-sm text-muted-foreground">Hard Cap</div>
                  </div>
                </div>

                {/* Management Panel */}
                {selectedLaunch?.id === launch.id && (
                  <Tabs defaultValue="stage-management" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="stage-management">Stage Management</TabsTrigger>
                      <TabsTrigger value="whitelist">Whitelist</TabsTrigger>
                      <TabsTrigger value="analytics">Analytics</TabsTrigger>
                    </TabsList>

                    <TabsContent value="stage-management" className="space-y-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Clock className="h-5 w-5" />
                            Current Stage: {stageInfo.label}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {stageInfo.next && (
                            <div className="space-y-3">
                              <Label>Advance to Next Stage</Label>
                              <Button
                                onClick={() => handleStageUpdate(launch, stageInfo.next!)}
                                disabled={updateStageMutation.isPending}
                                className="w-full"
                              >
                                {updateStageMutation.isPending ? "Updating..." : `Move to ${getStageInfo(stageInfo.next).label}`}
                              </Button>
                            </div>
                          )}

                          {/* Stage Timing Configuration */}
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Whitelist Start</Label>
                              <Input
                                type="datetime-local"
                                value={stageTimings.whitelistStart}
                                onChange={(e) => setStageTimings(prev => ({ ...prev, whitelistStart: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Whitelist End</Label>
                              <Input
                                type="datetime-local"
                                value={stageTimings.whitelistEnd}
                                onChange={(e) => setStageTimings(prev => ({ ...prev, whitelistEnd: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>NFT Holders Start</Label>
                              <Input
                                type="datetime-local"
                                value={stageTimings.nftHoldersStart}
                                onChange={(e) => setStageTimings(prev => ({ ...prev, nftHoldersStart: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>NFT Holders End</Label>
                              <Input
                                type="datetime-local"
                                value={stageTimings.nftHoldersEnd}
                                onChange={(e) => setStageTimings(prev => ({ ...prev, nftHoldersEnd: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Open WL Start</Label>
                              <Input
                                type="datetime-local"
                                value={stageTimings.openWlStart}
                                onChange={(e) => setStageTimings(prev => ({ ...prev, openWlStart: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Open WL End</Label>
                              <Input
                                type="datetime-local"
                                value={stageTimings.openWlEnd}
                                onChange={(e) => setStageTimings(prev => ({ ...prev, openWlEnd: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Open Sale Start</Label>
                              <Input
                                type="datetime-local"
                                value={stageTimings.openSaleStart}
                                onChange={(e) => setStageTimings(prev => ({ ...prev, openSaleStart: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Open Sale End</Label>
                              <Input
                                type="datetime-local"
                                value={stageTimings.openSaleEnd}
                                onChange={(e) => setStageTimings(prev => ({ ...prev, openSaleEnd: e.target.value }))}
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="whitelist" className="space-y-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            Whitelist Management
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex gap-2">
                            <Input
                              placeholder="Wallet address"
                              value={newWhitelistAddress}
                              onChange={(e) => setNewWhitelistAddress(e.target.value)}
                              className="flex-1"
                            />
                            <select
                              value={whitelistStage}
                              onChange={(e) => setWhitelistStage(e.target.value)}
                              className="px-3 py-2 border border-input rounded-md bg-background"
                            >
                              <option value="whitelist">Whitelist</option>
                              <option value="nft_holders">NFT Holders</option>
                              <option value="open_wl">Open WL</option>
                            </select>
                            <Button 
                              onClick={handleAddToWhitelist}
                              disabled={addToWhitelistMutation.isPending}
                            >
                              Add
                            </Button>
                          </div>

                          <div className="space-y-2">
                            <Label>Current Whitelist ({whitelist.length})</Label>
                            <div className="max-h-40 overflow-y-auto space-y-1">
                              {whitelist.map((entry: any) => (
                                <div key={entry.id} className="flex items-center justify-between p-2 bg-muted rounded">
                                  <span className="font-mono text-sm">{entry.walletAddress}</span>
                                  <Badge variant="outline">{entry.stage}</Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="analytics" className="space-y-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <TrendingUp className="h-5 w-5" />
                            Launch Analytics
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-center py-8">
                            <Eye className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-muted-foreground">
                              Detailed analytics coming soon...
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </Tabs>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
