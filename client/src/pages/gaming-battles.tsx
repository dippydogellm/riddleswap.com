import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Swords, Users, Trophy, Plus, Play, Shield, Zap, AlertCircle } from "lucide-react";
import { useSession } from "@/utils/sessionManager";
import { useToast } from "@/hooks/use-toast";
import { normalizeNftImage, getFallbackImage } from "@/utils/imageNormalizer";
import { SessionRenewalModal } from "@/components/SessionRenewalModal";

export default function GamingBattlesPage() {
  const session = useSession();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("squadrons");
  const [createSquadronOpen, setCreateSquadronOpen] = useState(false);
  const [showRenewalModal, setShowRenewalModal] = useState(false);

  // Watch for session renewal needs
  useEffect(() => {
    if ((session as any).needsRenewal) {
      setShowRenewalModal(true);
    } else {
      setShowRenewalModal(false);
    }
  }, [(session as any).needsRenewal]);
  const [createBattleOpen, setCreateBattleOpen] = useState(false);
  const [squadronName, setSquadronName] = useState("");
  const [selectedNFTs, setSelectedNFTs] = useState<string[]>([]);

  // Fetch user's squadrons
  const { data: squadronsData, isLoading: squadronsLoading } = useQuery<any>({
    queryKey: ['/api/gaming/squadrons'],
    enabled: session?.isLoggedIn,
  });

  // Fetch active battles
  const { data: battlesData, isLoading: battlesLoading } = useQuery<any>({
    queryKey: ['/api/gaming/battles/active'],
    enabled: session?.isLoggedIn,
  });

  // Fetch available battles to join
  const { data: availableBattlesData } = useQuery<any>({
    queryKey: ['/api/gaming/battles/available'],
    enabled: session?.isLoggedIn,
  });

  // Fetch user's NFTs for squadron creation
  const { data: userNFTsData } = useQuery<any>({
    queryKey: ['/api/inquisition-audit/user-nfts'],
    enabled: session?.isLoggedIn && (createSquadronOpen || createBattleOpen),
  });

  // Create squadron mutation
  const createSquadronMutation = useMutation({
    mutationFn: async (data: { name: string; nft_ids: string[] }) => {
      const response = await fetch('/api/gaming/squadrons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create squadron');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gaming/squadrons'] });
      toast({
        title: "Squadron Created",
        description: "Your squadron is ready for battle!",
      });
      setCreateSquadronOpen(false);
      setSquadronName("");
      setSelectedNFTs([]);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create squadron",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Create battle mutation
  const createBattleMutation = useMutation({
    mutationFn: async (data: { squadron_id: string; wager?: number }) => {
      const response = await fetch('/api/gaming/battles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create battle');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gaming/battles/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gaming/battles/available'] });
      toast({
        title: "Battle Created",
        description: "Waiting for an opponent!",
      });
      setCreateBattleOpen(false);
    },
  });

  // Join battle mutation
  const joinBattleMutation = useMutation({
    mutationFn: async (data: { battle_id: string; squadron_id: string }) => {
      const response = await fetch(`/api/gaming/battles/${data.battle_id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ squadron_id: data.squadron_id }),
      });
      if (!response.ok) throw new Error('Failed to join battle');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/gaming/battles/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gaming/battles/available'] });
      toast({
        title: "Joined Battle",
        description: "Battle has started!",
      });
      navigate(`/gaming/battle/${data.battle_id}`);
    },
  });

  const handleCreateSquadron = () => {
    if (!squadronName.trim()) {
      toast({
        title: "Squadron name required",
        variant: "destructive",
      });
      return;
    }
    if (selectedNFTs.length < 1) {
      toast({
        title: "Select at least 1 NFT",
        variant: "destructive",
      });
      return;
    }
    createSquadronMutation.mutate({
      name: squadronName,
      nft_ids: selectedNFTs,
    });
  };

  const toggleNFTSelection = (nftId: string) => {
    setSelectedNFTs(prev =>
      prev.includes(nftId)
        ? prev.filter(id => id !== nftId)
        : [...prev, nftId]
    );
  };

  if (!session?.isLoggedIn) {
    return (
      <div className="container mx-auto px-4 py-16">
        <Card>
          <CardContent className="text-center py-16">
            <Shield className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-2">Login Required</h2>
            <p className="text-muted-foreground mb-6">
              You need to log in to access the battle arena
            </p>
            <Button onClick={() => navigate('/wallet-login')}>
              Log In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold flex items-center gap-3">
                <Swords className="w-10 h-10 text-destructive" />
                Battle Arena
              </h1>
              <p className="text-muted-foreground mt-2">
                Manage squadrons and engage in battles
              </p>
            </div>
            <Button onClick={() => navigate('/gaming')} variant="outline">
              ← Back to Gaming Hub
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="squadrons">
              <Users className="w-4 h-4 mr-2" />
              Squadrons
            </TabsTrigger>
            <TabsTrigger value="active">
              <Swords className="w-4 h-4 mr-2" />
              Active Battles
            </TabsTrigger>
            <TabsTrigger value="available">
              <Trophy className="w-4 h-4 mr-2" />
              Available Battles
            </TabsTrigger>
          </TabsList>

          {/* Squadrons Tab */}
          <TabsContent value="squadrons" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Your Squadrons</h2>
              <Dialog open={createSquadronOpen} onOpenChange={setCreateSquadronOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Squadron
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create New Squadron</DialogTitle>
                    <DialogDescription>
                      Select your NFTs to form a battle squadron
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="squadron-name">Squadron Name</Label>
                      <Input
                        id="squadron-name"
                        placeholder="Enter squadron name..."
                        value={squadronName}
                        onChange={(e) => setSquadronName(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Select NFTs ({selectedNFTs.length} selected)</Label>
                      <div className="grid grid-cols-3 md:grid-cols-4 gap-3 mt-2">
                        {userNFTsData?.nfts?.map((nft: any) => (
                          <div
                            key={nft.nft_id}
                            className={`cursor-pointer border-2 rounded-lg overflow-hidden transition-all ${
                              selectedNFTs.includes(nft.nft_id)
                                ? 'border-primary shadow-lg scale-105'
                                : 'border-transparent hover:border-muted'
                            }`}
                            onClick={() => toggleNFTSelection(nft.nft_id)}
                          >
                            <div className="aspect-square relative">
                              <img
                                src={normalizeNftImage(nft.image_url || nft.image)}
                                alt={nft.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.src = getFallbackImage();
                                }}
                              />
                              {nft.power && (
                                <div className="absolute top-1 right-1 bg-black/70 text-white text-xs px-2 py-1 rounded">
                                  ⚡ {nft.power}
                                </div>
                              )}
                              {selectedNFTs.includes(nft.nft_id) && (
                                <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                  <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center">
                                    ✓
                                  </div>
                                </div>
                              )}
                            </div>
                            <p className="text-xs p-1 truncate">{nft.name}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <Button
                      onClick={handleCreateSquadron}
                      disabled={createSquadronMutation.isPending}
                      className="w-full"
                    >
                      {createSquadronMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        'Create Squadron'
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {squadronsLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : squadronsData?.squadrons?.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {squadronsData.squadrons.map((squadron: any) => (
                  <Card key={squadron.id} className="cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => navigate(`/gaming/squadrons/${squadron.id}`)}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        {squadron.name}
                      </CardTitle>
                      <CardDescription>
                        {squadron.nft_count} NFTs • Power: {squadron.total_power || 0}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-4 gap-2">
                        {squadron.nfts?.slice(0, 4).map((nft: any) => (
                          <div key={nft.nft_id} className="aspect-square rounded overflow-hidden">
                            <img
                              src={normalizeNftImage(nft.image_url || nft.image)}
                              alt={nft.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.src = getFallbackImage();
                              }}
                            />
                          </div>
                        ))}
                      </div>
                      <Button className="w-full mt-4" variant="outline">
                        View Details
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="text-center py-16">
                  <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-xl font-semibold mb-2">No Squadrons Yet</h3>
                  <p className="text-muted-foreground mb-6">
                    Create your first squadron to start battling
                  </p>
                  <Button onClick={() => setCreateSquadronOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Squadron
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Active Battles Tab */}
          <TabsContent value="active" className="space-y-6">
            <h2 className="text-2xl font-bold">Your Active Battles</h2>
            {battlesLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : battlesData?.battles?.length > 0 ? (
              <div className="space-y-4">
                {battlesData.battles.map((battle: any) => (
                  <Card key={battle.id} className="cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => navigate(`/gaming/battle/${battle.id}`)}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Swords className="w-10 h-10 text-destructive" />
                          <div>
                            <h3 className="font-bold text-lg">{battle.name || `Battle #${battle.id}`}</h3>
                            <p className="text-sm text-muted-foreground">
                              {battle.status} • {battle.opponent_name || 'Waiting for opponent...'}
                            </p>
                          </div>
                        </div>
                        <Button>
                          <Play className="w-4 h-4 mr-2" />
                          View Battle
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="text-center py-16">
                  <Swords className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-xl font-semibold mb-2">No Active Battles</h3>
                  <p className="text-muted-foreground mb-6">
                    Create a new battle or join an available one
                  </p>
                  <Button onClick={() => setCreateBattleOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Battle
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Available Battles Tab */}
          <TabsContent value="available" className="space-y-6">
            <h2 className="text-2xl font-bold">Join a Battle</h2>
            {availableBattlesData?.battles?.length > 0 ? (
              <div className="space-y-4">
                {availableBattlesData.battles.map((battle: any) => (
                  <Card key={battle.id}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Trophy className="w-10 h-10 text-primary" />
                          <div>
                            <h3 className="font-bold text-lg">{battle.creator_name}'s Challenge</h3>
                            <p className="text-sm text-muted-foreground">
                              Wager: {battle.wager || 0} RDL • Power: {battle.total_power}
                            </p>
                          </div>
                        </div>
                        <Button
                          onClick={() => {
                            // Open squadron selector
                            toast({
                              title: "Select Squadron",
                              description: "Choose a squadron to join the battle",
                            });
                          }}
                          variant="destructive"
                        >
                          <Zap className="w-4 h-4 mr-2" />
                          Join Battle
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="text-center py-16">
                  <AlertCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-xl font-semibold mb-2">No Available Battles</h3>
                  <p className="text-muted-foreground mb-6">
                    Be the first to create a battle challenge
                  </p>
                  <Button onClick={() => setCreateBattleOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Battle
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <SessionRenewalModal 
        open={showRenewalModal}
        onOpenChange={setShowRenewalModal}
      />
    </div>
  );
}
