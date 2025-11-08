import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Shield,
  Search,
  Star,
  Camera,
  Scan,
  RefreshCw,
  Loader2,
  Zap,
  Eye,
  Wand2,
  Plus,
  Image as ImageIcon,
  Crown,
  Swords,
  Church,
  Castle,
  Filter,
  Grid3X3,
  List,
  ExternalLink
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useDynamicMetadata, GAMING_METADATA } from "@/hooks/use-dynamic-metadata";
import { useSession } from "@/utils/sessionManager";

interface NFTData {
  id: string;
  name: string;
  description: string;
  image_url: string;
  collection_id: string;
  collection_name: string;
  token_id: string;
  nft_id: string;
  power_level: number;
  game_role: string;
  special_abilities?: Record<string, any>;
  rarity: string;
  metadata?: {
    name?: string;
    description?: string;
    image?: string;
    attributes?: Array<{ trait_type: string; value: any }>;
  };
  wallet_address: string;
  issuer: string;
  nfTokenTaxon: number;
  owner: string;
  acquisition_date: string;
  last_transaction: string;
}

interface CollectionData {
  collection_id: string;
  collection_name: string;
  nft_count: number;
  total_power: number;
  average_power: number;
  nfts: NFTData[];
}

const NFTManagement = () => {
  useDynamicMetadata(GAMING_METADATA.dashboard);
  
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCollection, setSelectedCollection] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedNFT, setSelectedNFT] = useState<NFTData | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isLoggedIn, handle } = useSession();

  // Fetch user's NFTs
  const { data: userNFTs = [], isLoading: nftsLoading, refetch: refetchNFTs } = useQuery<NFTData[]>({
    queryKey: ['/api/gaming/player/nfts'],
    enabled: isLoggedIn && !!handle
  });

  // Group NFTs by collection
  const collections: CollectionData[] = userNFTs.reduce((acc: CollectionData[], nft) => {
    const existing = acc.find(c => c.collection_id === nft.collection_id);
    if (existing) {
      existing.nfts.push(nft);
      existing.nft_count++;
      existing.total_power += nft.power_level;
      existing.average_power = existing.total_power / existing.nft_count;
    } else {
      acc.push({
        collection_id: nft.collection_id,
        collection_name: nft.collection_name,
        nft_count: 1,
        total_power: nft.power_level,
        average_power: nft.power_level,
        nfts: [nft]
      });
    }
    return acc;
  }, []);

  // Filter NFTs based on search and collection
  const filteredNFTs = userNFTs.filter(nft => {
    const matchesSearch = !searchQuery || 
      nft.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      nft.collection_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      nft.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCollection = selectedCollection === "all" || nft.collection_id === selectedCollection;
    
    return matchesSearch && matchesCollection;
  });

  // Rescan NFTs mutation
  const rescanMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/gaming/rescan-nfts', {
        method: 'POST'
      });
    },
    onSuccess: () => {
      toast({
        title: "NFT Rescan Complete!",
        description: "Your NFTs have been rescanned and power levels updated.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/gaming/player/nfts'] });
      refetchNFTs();
    },
    onError: (error: any) => {
      toast({
        title: "Rescan Failed",
        description: error.message || "Failed to rescan NFTs",
        variant: "destructive"
      });
    }
  });

  // Generate Inquisition player image mutation
  const generateImageMutation = useMutation({
    mutationFn: async (nftId: string) => {
      return apiRequest('/api/gaming/generate-player-image', {
        method: 'POST',
        body: JSON.stringify({ nft_id: nftId })
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Player Image Generated!",
        description: "Inquisition member image has been created with AI.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/gaming/player/nfts'] });
    },
    onError: (error: any) => {
      toast({
        title: "Image Generation Failed",
        description: error.message || "Failed to generate player image",
        variant: "destructive"
      });
    }
  });

  const handleGeneratePlayerImage = async (nft: NFTData) => {
    if (!nft.collection_name.toLowerCase().includes('inquisition')) {
      toast({
        title: "Invalid NFT",
        description: "Player image generation is only available for Inquisition NFTs",
        variant: "destructive"
      });
      return;
    }

    setIsGeneratingImage(true);
    try {
      await generateImageMutation.mutateAsync(nft.id);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">Authentication Required</CardTitle>
            <CardDescription className="text-center">
              Please log in to access NFT management
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.href = '/wallet-login'} className="w-full">
              Log In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-white">NFT Management</h1>
            <p className="text-slate-300">Manage your Trolls Inquisition NFTs and metadata</p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              onClick={() => rescanMutation.mutate()}
              disabled={rescanMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="button-rescan-nfts"
            >
              {rescanMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Scan className="w-4 h-4 mr-2" />
              )}
              Rescan NFTs
            </Button>
            
            <Button
              onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
              variant="outline"
              className="border-purple-500 text-purple-300 hover:bg-purple-500/10"
            >
              {viewMode === "grid" ? <List className="w-4 h-4" /> : <Grid3X3 className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Filters and Search */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Search NFTs by name, collection, or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-slate-700 border-slate-600 text-white"
                  data-testid="input-search-nfts"
                />
              </div>
              
              <div className="flex items-center gap-3">
                <select
                  value={selectedCollection}
                  onChange={(e) => setSelectedCollection(e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white rounded-md px-3 py-2"
                  data-testid="select-collection-filter"
                >
                  <option value="all">All Collections</option>
                  {collections.map(collection => (
                    <option key={collection.collection_id} value={collection.collection_id}>
                      {collection.collection_name} ({collection.nft_count})
                    </option>
                  ))}
                </select>
                
                <Badge variant="outline" className="text-white border-slate-600">
                  {filteredNFTs.length} NFTs
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-slate-800/50">
            <TabsTrigger value="overview" className="data-[state=active]:bg-purple-600">
              <Eye className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="collections" className="data-[state=active]:bg-purple-600">
              <Shield className="w-4 h-4 mr-2" />
              Collections
            </TabsTrigger>
            <TabsTrigger value="gallery" className="data-[state=active]:bg-purple-600">
              <ImageIcon className="w-4 h-4 mr-2" />
              Gallery
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-400" />
                    Total NFTs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-white">{userNFTs.length}</div>
                  <p className="text-slate-300 text-sm">Across {collections.length} collections</p>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Zap className="w-5 h-5 text-yellow-400" />
                    Total Power
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-yellow-400">
                    {userNFTs.reduce((sum, nft) => sum + nft.power_level, 0).toLocaleString()}
                  </div>
                  <p className="text-slate-300 text-sm">Combined power level</p>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Crown className="w-5 h-5 text-purple-400" />
                    Inquisition NFTs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-purple-400">
                    {userNFTs.filter(nft => nft.collection_name.toLowerCase().includes('inquisition')).length}
                  </div>
                  <p className="text-slate-300 text-sm">Player image eligible</p>
                </CardContent>
              </Card>
            </div>

            {/* Recent NFTs */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Recently Acquired NFTs</CardTitle>
                <CardDescription className="text-slate-300">
                  Your most recently acquired gaming NFTs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {userNFTs.slice(0, 6).map((nft) => (
                    <Card key={nft.id} className="bg-slate-700/50 border-slate-600 cursor-pointer hover:bg-slate-700/70 transition-colors" onClick={() => setSelectedNFT(nft)}>
                      <CardContent className="p-4">
                        <div className="aspect-square bg-slate-600 rounded-lg mb-3 overflow-hidden">
                          {nft.image_url ? (
                            <img 
                              src={nft.image_url} 
                              alt={nft.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="w-8 h-8 text-slate-400" />
                            </div>
                          )}
                        </div>
                        
                        <h4 className="text-white font-medium truncate mb-1">{nft.name}</h4>
                        <p className="text-slate-400 text-xs truncate mb-2">{nft.collection_name}</p>
                        
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs border-slate-500 text-slate-300">
                            {nft.game_role}
                          </Badge>
                          <span className="text-yellow-400 text-sm font-medium">
                            {nft.power_level} power
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Collections Tab */}
          <TabsContent value="collections" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {collections.map((collection) => (
                <Card key={collection.collection_id} className="bg-slate-800/50 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center justify-between">
                      <span>{collection.collection_name}</span>
                      <Badge variant="outline" className="border-slate-500 text-slate-300">
                        {collection.nft_count} NFTs
                      </Badge>
                    </CardTitle>
                    <CardDescription className="text-slate-300">
                      Total Power: {collection.total_power.toLocaleString()} | 
                      Avg: {Math.round(collection.average_power)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-2">
                      {collection.nfts.slice(0, 6).map((nft) => (
                        <div 
                          key={nft.id} 
                          className="aspect-square bg-slate-600 rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => setSelectedNFT(nft)}
                        >
                          {nft.image_url ? (
                            <img 
                              src={nft.image_url} 
                              alt={nft.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="w-4 h-4 text-slate-400" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    
                    {collection.nft_count > 6 && (
                      <Button 
                        variant="outline" 
                        className="w-full mt-3 border-slate-600 text-slate-300 hover:bg-slate-700"
                        onClick={() => {
                          setSelectedCollection(collection.collection_id);
                          setActiveTab("gallery");
                        }}
                      >
                        View All {collection.nft_count} NFTs
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Gallery Tab */}
          <TabsContent value="gallery" className="space-y-6">
            {nftsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                <span className="ml-2 text-slate-300">Loading NFTs...</span>
              </div>
            ) : filteredNFTs.length === 0 ? (
              <div className="text-center py-12">
                <ImageIcon className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">No NFTs Found</h3>
                <p className="text-slate-400">
                  {searchQuery ? `No NFTs match your search "${searchQuery}"` : "You don't have any NFTs yet"}
                </p>
              </div>
            ) : (
              <div className={viewMode === "grid" 
                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" 
                : "space-y-4"
              }>
                {filteredNFTs.map((nft) => (
                  <Card 
                    key={nft.id} 
                    className="bg-slate-800/50 border-slate-700 cursor-pointer hover:bg-slate-800/70 transition-colors"
                    onClick={() => setSelectedNFT(nft)}
                    data-testid={`nft-card-${nft.id}`}
                  >
                    <CardContent className="p-4">
                      {viewMode === "grid" ? (
                        <>
                          <div className="aspect-square bg-slate-600 rounded-lg mb-3 overflow-hidden">
                            {nft.image_url ? (
                              <img 
                                src={nft.image_url} 
                                alt={nft.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ImageIcon className="w-8 h-8 text-slate-400" />
                              </div>
                            )}
                          </div>
                          
                          <h4 className="text-white font-medium truncate mb-1">{nft.name}</h4>
                          <p className="text-slate-400 text-xs truncate mb-2">{nft.collection_name}</p>
                          
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant="outline" className="text-xs border-slate-500 text-slate-300">
                              {nft.game_role}
                            </Badge>
                            <span className="text-yellow-400 text-sm font-medium">
                              {nft.power_level} power
                            </span>
                          </div>

                          {nft.collection_name.toLowerCase().includes('inquisition') && (
                            <Button
                              size="sm"
                              className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleGeneratePlayerImage(nft);
                              }}
                              disabled={isGeneratingImage}
                              data-testid={`button-generate-image-${nft.id}`}
                            >
                              {isGeneratingImage ? (
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              ) : (
                                <Wand2 className="w-3 h-3 mr-1" />
                              )}
                              Generate Player Image
                            </Button>
                          )}
                        </>
                      ) : (
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 bg-slate-600 rounded-lg overflow-hidden flex-shrink-0">
                            {nft.image_url ? (
                              <img 
                                src={nft.image_url} 
                                alt={nft.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ImageIcon className="w-4 h-4 text-slate-400" />
                              </div>
                            )}
                          </div>
                          
                          <div className="flex-1">
                            <h4 className="text-white font-medium">{nft.name}</h4>
                            <p className="text-slate-400 text-sm">{nft.collection_name}</p>
                            <div className="flex items-center gap-3 mt-1">
                              <Badge variant="outline" className="text-xs border-slate-500 text-slate-300">
                                {nft.game_role}
                              </Badge>
                              <span className="text-yellow-400 text-sm">
                                {nft.power_level} power
                              </span>
                            </div>
                          </div>

                          {nft.collection_name.toLowerCase().includes('inquisition') && (
                            <Button
                              size="sm"
                              className="bg-purple-600 hover:bg-purple-700 text-white"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleGeneratePlayerImage(nft);
                              }}
                              disabled={isGeneratingImage}
                              data-testid={`button-generate-image-${nft.id}`}
                            >
                              {isGeneratingImage ? (
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              ) : (
                                <Wand2 className="w-3 h-3 mr-1" />
                              )}
                              Generate Image
                            </Button>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* NFT Detail Modal */}
        <Dialog open={!!selectedNFT} onOpenChange={() => setSelectedNFT(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-white">{selectedNFT?.name}</DialogTitle>
            </DialogHeader>
            
            {selectedNFT && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="aspect-square bg-slate-600 rounded-lg overflow-hidden">
                    {selectedNFT.image_url ? (
                      <img 
                        src={selectedNFT.image_url} 
                        alt={selectedNFT.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-16 h-16 text-slate-400" />
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-white font-semibold mb-2">Details</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Collection:</span>
                          <span className="text-white">{selectedNFT.collection_name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Token ID:</span>
                          <span className="text-white font-mono text-sm">{selectedNFT.token_id}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Power Level:</span>
                          <span className="text-yellow-400 font-semibold">{selectedNFT.power_level}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Game Role:</span>
                          <Badge variant="outline" className="border-slate-500 text-slate-300">
                            {selectedNFT.game_role}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Rarity:</span>
                          <span className="text-white">{selectedNFT.rarity}</span>
                        </div>
                      </div>
                    </div>

                    {selectedNFT.metadata?.attributes && (
                      <div>
                        <h3 className="text-white font-semibold mb-2">Attributes</h3>
                        <div className="space-y-2">
                          {selectedNFT.metadata.attributes.map((attr, index) => (
                            <div key={index} className="flex justify-between">
                              <span className="text-slate-400">{attr.trait_type}:</span>
                              <span className="text-white">{attr.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedNFT.collection_name.toLowerCase().includes('inquisition') && (
                      <Button
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                        onClick={() => handleGeneratePlayerImage(selectedNFT)}
                        disabled={isGeneratingImage}
                        data-testid="button-generate-image-modal"
                      >
                        {isGeneratingImage ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Wand2 className="w-4 h-4 mr-2" />
                        )}
                        Generate Inquisition Player Image
                      </Button>
                    )}
                  </div>
                </div>

                {selectedNFT.description && (
                  <div>
                    <h3 className="text-white font-semibold mb-2">Description</h3>
                    <p className="text-slate-300">{selectedNFT.description}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default NFTManagement;
