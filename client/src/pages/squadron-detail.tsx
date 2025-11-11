import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Plus, Trash2, Sword, Shield, Users, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function SquadronDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState("overview");

  // Fetch squadron details
  const { data: squadron, isLoading } = useQuery<any>({
    queryKey: [`/api/squadrons/${id}`],
    enabled: !!id,
  });

  // Fetch available NFTs to add
  const { data: availableNFTs } = useQuery<any>({
    queryKey: ['/api/inquisition-audit/player/nfts'],
    enabled: selectedTab === "add-nfts",
  });

  // Remove NFT from squadron
  const removeNFTMutation = useMutation({
    mutationFn: async (nftId: string) => {
      const response = await fetch(`/api/squadrons/${id}/nfts/${nftId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to remove NFT');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/squadrons/${id}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/squadrons/player'] });
      toast({ title: "NFT removed from squadron", variant: "default" });
    },
    onError: () => {
      toast({ title: "Failed to remove NFT", variant: "destructive" });
    },
  });

  // Add NFT to squadron
  const addNFTMutation = useMutation({
    mutationFn: async (nftId: string) => {
      const response = await fetch(`/api/squadrons/${id}/nfts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ nft_id: nftId }),
      });
      if (!response.ok) throw new Error('Failed to add NFT');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/squadrons/${id}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/squadrons/player'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inquisition-audit/player/nfts'] });
      toast({ title: "NFT added to squadron", variant: "default" });
      setSelectedTab("overview");
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to add NFT", 
        description: error.message || "Squadron may be at maximum capacity",
        variant: "destructive" 
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading squadron...</p>
        </div>
      </div>
    );
  }

  const squadData = squadron?.data || squadron?.squadron;
  const members = squadData?.members || [];

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <Button
        variant="ghost"
        onClick={() => setLocation('/gaming-dashboard-v3')}
        className="mb-6"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Dashboard
      </Button>

      <div className="grid gap-6">
        {/* Squadron Header */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-3xl">{squadData?.name || "Squadron"}</CardTitle>
                <p className="text-muted-foreground mt-2">{squadData?.description}</p>
              </div>
              <Badge variant="secondary">{squadData?.squadron_type || "Standard"}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                <Sword className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Army Power</p>
                  <p className="text-xl font-bold">{squadData?.total_army_power || 0}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Religion Power</p>
                  <p className="text-xl font-bold">{squadData?.total_religion_power || 0}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Civilization</p>
                  <p className="text-xl font-bold">{squadData?.total_civilization_power || 0}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">NFTs</p>
                  <p className="text-xl font-bold">{members.length}/{squadData?.max_nft_capacity || 10}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Squadron Management Tabs */}
        <Card>
          <CardContent className="pt-6">
            <Tabs value={selectedTab} onValueChange={setSelectedTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="overview">Squadron Members</TabsTrigger>
                <TabsTrigger value="add-nfts">Add NFTs</TabsTrigger>
              </TabsList>

              {/* Current Squadron Members */}
              <TabsContent value="overview" className="space-y-4 mt-6">
                {members.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <p className="text-lg font-semibold">No NFTs in squadron</p>
                    <p className="text-muted-foreground mb-4">Add NFTs to increase your squadron's power</p>
                    <Button onClick={() => setSelectedTab("add-nfts")}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add NFTs
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {members.map((member: any) => (
                      <Card key={member.id} className="relative">
                        <CardContent className="pt-6">
                          <div className="aspect-square relative mb-4 rounded-lg overflow-hidden bg-muted">
                            {member.nft_image ? (
                              <img 
                                src={member.nft_image} 
                                alt={member.nft_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Shield className="h-16 w-16 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <h3 className="font-semibold text-lg mb-2">{member.nft_name}</h3>
                          <div className="space-y-1 text-sm mb-4">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Power:</span>
                              <span className="font-medium">{member.nft_power || 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Position:</span>
                              <span className="font-medium">{member.position + 1}</span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => setLocation(`/gaming/nft-detail/${member.nft_id}`)}
                            >
                              View Details
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => removeNFTMutation.mutate(member.nft_id)}
                              disabled={removeNFTMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Available NFTs to Add */}
              <TabsContent value="add-nfts" className="space-y-4 mt-6">
                {availableNFTs?.data?.length === 0 ? (
                  <div className="text-center py-12">
                    <Shield className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <p className="text-lg font-semibold">No available NFTs</p>
                    <p className="text-muted-foreground">All your NFTs are already assigned</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {availableNFTs?.data?.map((nft: any) => (
                      <Card key={nft.nft_id}>
                        <CardContent className="pt-6">
                          <div className="aspect-square relative mb-4 rounded-lg overflow-hidden bg-muted">
                            {nft.image_url ? (
                              <img 
                                src={nft.image_url} 
                                alt={nft.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Shield className="h-16 w-16 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <h3 className="font-semibold text-lg mb-2">{nft.name}</h3>
                          <div className="space-y-1 text-sm mb-4">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Total Power:</span>
                              <span className="font-medium">{nft.total_power || 0}</span>
                            </div>
                          </div>
                          <Button
                            className="w-full"
                            onClick={() => addNFTMutation.mutate(nft.nft_id)}
                            disabled={addNFTMutation.isPending || members.length >= (squadData?.max_nft_capacity || 10)}
                          >
                            {addNFTMutation.isPending ? "Adding..." : "Add to Squadron"}
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
