import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { normalizeNftImage } from "@/utils/imageNormalizer";
import { 
  Sparkles, 
  Swords, 
  Crown, 
  Heart, 
  Star, 
  Eye, 
  Target, 
  User,
  Wand2,
  Scroll,
  Shield,
  Loader2,
  RefreshCw,
  Zap,
  ChevronDown,
  ChevronUp,
  Coins
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

// Types for XRPL NFTs from gaming endpoint
interface XRPLNft {
  nft_db_id: number;
  nft_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  ai_generated_image_url: string | null;
  collection_name: string;
  game_role: string;
  rarity_score: number | null;
  traits: Record<string, any> | null;
  owned_at: string;
  total_power: number | null;
  army_power: number | null;
  religion_power: number | null;
  civilization_power: number | null;
  economic_power: number | null;
}

// Types for generated inquisition members
interface GeneratedMember {
  id: string;
  name: string;
  material: string;
  player_type: string;
  role: string;
  rarity: string;
  traits: Record<string, any>;
  abilities: Record<string, any>;
  stats: {
    base_power: number;
    combat_effectiveness: number;
    leadership_value: number;
    magical_power: number;
    division_boost: number;
    religion_control: number;
  };
  image_url: string | null;
  popup_story: string | null;
  oracle_job_id?: string | null;
  created_at: string;
}

interface GenerationOptions {
  material?: string;
  playerType?: string;
  rarity?: string;
}

// Helper functions from ForceManager (reused)
const getRoleIcon = (role: string) => {
  const playerType = role?.split(' ')[1] || role;
  switch (playerType?.toLowerCase()) {
    case 'priest': return <Heart className="h-3 w-3" />;
    case 'knight': return <Crown className="h-3 w-3" />;
    case 'commander': return <Star className="h-3 w-3" />;
    case 'mage': case 'wizard': return <Sparkles className="h-3 w-3" />;
    case 'archer': case 'ranger': return <Target className="h-3 w-3" />;
    case 'rogue': return <Eye className="h-3 w-3" />;
    default: return <Swords className="h-3 w-3" />; // warrior
  }
};

const getAbilityIcon = (ability: string) => {
  if (ability.includes('heal') || ability.includes('religion')) return '💚';
  if (ability.includes('division_boost') || ability.includes('knight')) return '🛡️';
  if (ability.includes('leadership') || ability.includes('command')) return '👑';
  if (ability.includes('magic') || ability.includes('spell')) return '✨';
  if (ability.includes('dragon')) return '🐉';
  if (ability.includes('legendary')) return '⭐';
  if (ability.includes('stealth') || ability.includes('rogue')) return '👤';
  if (ability.includes('fire') || ability.includes('flame')) return '🔥';
  if (ability.includes('undead')) return '💀';
  if (ability.includes('holy') || ability.includes('divine')) return '☀️';
  if (ability.includes('cursed') || ability.includes('dark')) return '🌙';
  if (ability.includes('precision') || ability.includes('archer')) return '🎯';
  return '⚔️';
};

const formatAbilityName = (ability: string) => {
  return ability.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const getRarityColor = (rarity: string) => {
  switch (rarity.toLowerCase()) {
    case 'legendary': return 'text-yellow-400 border-yellow-400/50';
    case 'epic': return 'text-purple-400 border-purple-400/50';
    case 'rare': return 'text-blue-400 border-blue-400/50';
    case 'common': default: return 'text-gray-400 border-gray-400/50';
  }
};

const getMaterialColor = (material: string) => {
  switch (material.toLowerCase()) {
    case 'gold': return 'text-yellow-500';
    case 'silver': return 'text-gray-300';
    case 'steel': return 'text-blue-400';
    case 'iron': return 'text-gray-500';
    case 'bronze': return 'text-orange-400';
    case 'mythril': return 'text-cyan-400';
    case 'adamant': return 'text-purple-500';
    case 'dragon_scale': return 'text-red-500';
    case 'holy': return 'text-yellow-300';
    case 'cursed': return 'text-red-600';
    default: return 'text-gray-400';
  }
};

export const InquisitionGenerator = () => {
  const [selectedOptions, setSelectedOptions] = useState<GenerationOptions>({});
  const [selectedMember, setSelectedMember] = useState<GeneratedMember | null>(null);
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { handle, user } = useAuth(false);

  // Fetch generation options
  const { data: generationOptions } = useQuery<{success: boolean; data: {materials: string[]; playerTypes: string[]; rarities: string[]}}>({
    queryKey: ['/api/gaming/inquisition-members/generation-options'],
  });

  // Fetch user's XRPL NFTs from gaming collections
  const { data: userNfts, isLoading: nftsLoading, error: nftsError } = useQuery<XRPLNft[]>({
    queryKey: ['/api/gaming/player/nfts', handle],
    queryFn: async () => {
      if (!handle) return [];
      const response = await fetch(`/api/gaming/player/nfts?handle=${handle}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch NFTs: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!handle,
    retry: 2,
  });

  // Fetch user's generated members
  const { data: userMembers, isLoading: membersLoading } = useQuery<{success: boolean; data: GeneratedMember[]; count: number}>({
    queryKey: ['/api/gaming/inquisition-members/my-members'],
  });

  // Group NFTs by collection
  const nftsByCollection = useMemo(() => {
    if (!userNfts) return {};
    
    const grouped: Record<string, XRPLNft[]> = {};
    userNfts.forEach(nft => {
      if (!grouped[nft.collection_name]) {
        grouped[nft.collection_name] = [];
      }
      grouped[nft.collection_name].push(nft);
    });
    
    return grouped;
  }, [userNfts]);

  const toggleCollection = (collectionName: string) => {
    setExpandedCollections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(collectionName)) {
        newSet.delete(collectionName);
      } else {
        newSet.add(collectionName);
      }
      return newSet;
    });
  };

  // Generate new member mutation
  const generateMemberMutation = useMutation<{success: boolean; data: GeneratedMember; message: string}, Error, GenerationOptions>({
    mutationFn: async (options: GenerationOptions) => {
      const response = await apiRequest('/api/gaming/inquisition-members/generate', {
        method: 'POST',
        body: JSON.stringify(options),
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Inquisition Member Generated!",
        description: `${data.data.name} has joined your inquisition with ${data.data.stats.base_power} base power.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/gaming/inquisition-members/my-members'] });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate inquisition member",
        variant: "destructive",
      });
    },
  });

  const handleGenerate = () => {
    generateMemberMutation.mutate(selectedOptions);
  };

  const members = userMembers?.data || [];

  return (
    <Card className="gaming-component-card border-yellow-500/30">
      <CardHeader>
        <CardTitle className="text-yellow-300 font-mono flex items-center gap-2">
          <Wand2 className="h-5 w-5" />
          INQUISITION GENERATOR
        </CardTitle>
        <CardDescription className="text-slate-400">
          Generate AI-powered inquisition members with unique abilities and backstories
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Your NFTs Section - Organized by Collection */}
          {user && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-cyan-300 flex items-center gap-2">
                  <Coins className="h-5 w-5" />
                  Your NFTs ({userNfts?.length || 0})
                </h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/gaming/player/nfts'] })}
                  data-testid="button-refresh-nfts"
                >
                  <RefreshCw className="h-3 w-3 mr-2" />
                  Refresh
                </Button>
              </div>

              {nftsLoading ? (
                <Card className="bg-slate-800/50 border-slate-600 animate-pulse">
                  <CardContent className="p-8 text-center">
                    <Loader2 className="h-8 w-8 text-slate-500 mx-auto mb-4 animate-spin" />
                    <p className="text-slate-400">Scanning blockchain for your NFTs...</p>
                  </CardContent>
                </Card>
              ) : nftsError ? (
                <Card className="bg-red-900/20 border-red-500/50">
                  <CardContent className="text-center py-8">
                    <Shield className="h-12 w-12 text-red-400 mx-auto mb-4" />
                    <p className="text-red-300 mb-2 font-semibold">Failed to load your NFTs</p>
                    <p className="text-slate-400 text-sm mb-4">
                      {nftsError instanceof Error ? nftsError.message : 'Unable to connect to the blockchain scanner'}
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/gaming/player/nfts'] })}
                      className="border-red-500/50 hover:bg-red-900/30"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Retry
                    </Button>
                  </CardContent>
                </Card>
              ) : !userNfts || userNfts.length === 0 ? (
                <Card className="bg-slate-800/50 border-slate-600">
                  <CardContent className="text-center py-8">
                    <Coins className="h-12 w-12 text-slate-500 mx-auto mb-4" />
                    <p className="text-slate-400 mb-2">No gaming NFTs found in your wallet</p>
                    <p className="text-slate-500 text-sm">
                      Purchase NFTs from The Inquisition, Lost Emporium, Under the Bridge: Troll, or DANTES AURUM collections to start playing
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {Object.entries(nftsByCollection).map(([collectionName, nfts]) => (
                    <Card key={collectionName} className="bg-slate-800/50 border-cyan-500/30">
                      <Collapsible
                        open={expandedCollections.has(collectionName)}
                        onOpenChange={() => toggleCollection(collectionName)}
                      >
                        <CollapsibleTrigger asChild>
                          <CardHeader className="cursor-pointer hover:bg-slate-700/30 transition-colors">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Badge variant="outline" className="text-cyan-400 border-cyan-400/50">
                                  {nfts.length}
                                </Badge>
                                <CardTitle className="text-cyan-300 text-lg">
                                  {collectionName}
                                </CardTitle>
                                {nfts[0]?.game_role && (
                                  <Badge variant="secondary" className="text-xs">
                                    {nfts[0].game_role}
                                  </Badge>
                                )}
                              </div>
                              {expandedCollections.has(collectionName) ? (
                                <ChevronUp className="h-5 w-5 text-slate-400" />
                              ) : (
                                <ChevronDown className="h-5 w-5 text-slate-400" />
                              )}
                            </div>
                            <CardDescription className="text-slate-400 text-sm">
                              Total Power: {nfts.reduce((sum, nft) => sum + (nft.total_power || 0), 0).toLocaleString()}
                            </CardDescription>
                          </CardHeader>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {nfts.map((nft) => (
                                <Dialog key={nft.nft_id}>
                                  <DialogTrigger asChild>
                                    <Card className="bg-slate-700/50 border-slate-600 hover:border-cyan-500/50 cursor-pointer transition-colors">
                                      <CardContent className="p-4">
                                        {/* NFT Image */}
                                        <div className="relative mb-3">
                                          <img
                                            src={normalizeNftImage({ image_url: nft.ai_generated_image_url || nft.image_url })}
                                            alt={nft.name}
                                            className="w-full h-32 object-cover rounded border-2 border-cyan-500/30"
                                            onError={(e) => {
                                              const target = e.target as HTMLImageElement;
                                              target.src = `https://via.placeholder.com/200x128/1a1a1a/ffffff?text=${encodeURIComponent(nft.name)}`;
                                            }}
                                          />
                                          {nft.rarity_score && nft.rarity_score > 0 && (
                                            <Badge className="absolute top-2 right-2 bg-purple-600 text-white">
                                              Rarity: {nft.rarity_score}
                                            </Badge>
                                          )}
                                        </div>

                                        {/* NFT Info */}
                                        <div className="space-y-2">
                                          <h4 className="font-semibold text-cyan-300 text-sm truncate">
                                            {nft.name}
                                          </h4>
                                          
                                          <div className="flex justify-between text-xs">
                                            <span className="text-slate-400">Total Power:</span>
                                            <span className="text-red-400 font-bold">
                                              {nft.total_power?.toLocaleString() || 0}
                                            </span>
                                          </div>

                                          {/* Power Category Preview */}
                                          <div className="grid grid-cols-2 gap-1 text-xs">
                                            {nft.army_power && nft.army_power > 0 && (
                                              <div className="flex justify-between">
                                                <span className="text-slate-500">Army:</span>
                                                <span className="text-orange-400">{nft.army_power}</span>
                                              </div>
                                            )}
                                            {nft.religion_power && nft.religion_power > 0 && (
                                              <div className="flex justify-between">
                                                <span className="text-slate-500">Religion:</span>
                                                <span className="text-green-400">{nft.religion_power}</span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </CardContent>
                                    </Card>
                                  </DialogTrigger>

                                  {/* NFT Detail Modal */}
                                  <DialogContent className="w-[95vw] sm:w-[90%] sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
                                    <DialogHeader>
                                      <DialogTitle className="text-cyan-300 flex items-center gap-2">
                                        <Coins className="h-5 w-5" />
                                        {nft.name}
                                      </DialogTitle>
                                    </DialogHeader>

                                    <div className="space-y-6">
                                      {/* NFT Image & Basic Info */}
                                      <div className="flex gap-4">
                                        <img
                                          src={normalizeNftImage({ image_url: nft.ai_generated_image_url || nft.image_url })}
                                          alt={nft.name}
                                          className="w-32 h-32 object-cover rounded border-2 border-cyan-500/50"
                                          onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            target.src = `https://via.placeholder.com/128x128/1a1a1a/ffffff?text=${encodeURIComponent(nft.name)}`;
                                          }}
                                        />
                                        <div className="flex-1 space-y-2">
                                          <Badge className="bg-cyan-600 text-white">
                                            {nft.collection_name}
                                          </Badge>
                                          {nft.game_role && (
                                            <Badge variant="outline">
                                              {nft.game_role}
                                            </Badge>
                                          )}
                                          {nft.rarity_score && nft.rarity_score > 0 && (
                                            <Badge variant="outline" className="text-purple-400">
                                              Rarity Score: {nft.rarity_score}
                                            </Badge>
                                          )}
                                          
                                          {/* Power Stats Grid */}
                                          <div className="grid grid-cols-2 gap-2 text-sm mt-3">
                                            <div className="flex justify-between">
                                              <span className="text-slate-400">Total Power:</span>
                                              <span className="text-red-400 font-bold">{nft.total_power?.toLocaleString() || 0}</span>
                                            </div>
                                            {nft.army_power && nft.army_power > 0 && (
                                              <div className="flex justify-between">
                                                <span className="text-slate-400">Army:</span>
                                                <span className="text-orange-400">{nft.army_power.toLocaleString()}</span>
                                              </div>
                                            )}
                                            {nft.religion_power && nft.religion_power > 0 && (
                                              <div className="flex justify-between">
                                                <span className="text-slate-400">Religion:</span>
                                                <span className="text-green-400">{nft.religion_power.toLocaleString()}</span>
                                              </div>
                                            )}
                                            {nft.civilization_power && nft.civilization_power > 0 && (
                                              <div className="flex justify-between">
                                                <span className="text-slate-400">Civilization:</span>
                                                <span className="text-yellow-400">{nft.civilization_power.toLocaleString()}</span>
                                              </div>
                                            )}
                                            {nft.economic_power && nft.economic_power > 0 && (
                                              <div className="flex justify-between">
                                                <span className="text-slate-400">Economic:</span>
                                                <span className="text-blue-400">{nft.economic_power.toLocaleString()}</span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      <Separator />

                                      {/* Description */}
                                      {nft.description && (
                                        <div>
                                          <h4 className="font-semibold text-cyan-300 mb-2 flex items-center gap-2">
                                            <Scroll className="h-4 w-4" />
                                            Description
                                          </h4>
                                          <p className="text-slate-300 text-sm">
                                            {nft.description}
                                          </p>
                                        </div>
                                      )}

                                      {/* Traits */}
                                      {nft.traits && Object.keys(nft.traits).length > 0 && (
                                        <div>
                                          <h4 className="font-semibold text-cyan-300 mb-2 flex items-center gap-2">
                                            <Star className="h-4 w-4" />
                                            Traits
                                          </h4>
                                          <div className="grid grid-cols-2 gap-2">
                                            {Object.entries(nft.traits).map(([traitName, traitValue]) => (
                                              <div key={traitName} className="bg-slate-700/50 p-2 rounded border border-slate-600">
                                                <p className="text-xs text-slate-400">{traitName}</p>
                                                <p className="text-sm text-slate-200">{String(traitValue)}</p>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {/* NFT ID & Ownership Info */}
                                      <div className="text-xs text-slate-500 space-y-1">
                                        <p>NFT ID: {nft.nft_id}</p>
                                        {nft.owned_at && (
                                          <p>Owned since: {new Date(nft.owned_at).toLocaleDateString()}</p>
                                        )}
                                      </div>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              ))}
                            </div>
                          </CardContent>
                        </CollapsibleContent>
                      </Collapsible>
                    </Card>
                  ))}
                </div>
              )}

              <Separator className="my-6" />
            </div>
          )}

          {/* Generation Controls */}
          <Card className="bg-slate-800/50 border-yellow-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-yellow-300 text-lg flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Generate New Member
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {/* Material Selection */}
                <div>
                  <label className="text-sm text-slate-300 mb-2 block">Material (Optional)</label>
                  <Select 
                    value={selectedOptions.material || ""} 
                    onValueChange={(value) => 
                      setSelectedOptions(prev => ({ ...prev, material: value || undefined }))
                    }
                  >
                    <SelectTrigger data-testid="select-material">
                      <SelectValue placeholder="Random Material" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Random Material</SelectItem>
                      {generationOptions?.data?.materials?.map((material: string) => (
                        <SelectItem key={material} value={material}>
                          <span className={getMaterialColor(material)}>
                            {material.replace('_', ' ')}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Player Type Selection */}
                <div>
                  <label className="text-sm text-slate-300 mb-2 block">Class (Optional)</label>
                  <Select 
                    value={selectedOptions.playerType || ""} 
                    onValueChange={(value) => 
                      setSelectedOptions(prev => ({ ...prev, playerType: value || undefined }))
                    }
                  >
                    <SelectTrigger data-testid="select-player-type">
                      <SelectValue placeholder="Random Class" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Random Class</SelectItem>
                      {generationOptions?.data?.playerTypes?.map((type: string) => (
                        <SelectItem key={type} value={type}>
                          <span className="flex items-center gap-2">
                            {getRoleIcon(type)}
                            {type}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Rarity Selection */}
                <div>
                  <label className="text-sm text-slate-300 mb-2 block">Rarity (Optional)</label>
                  <Select 
                    value={selectedOptions.rarity || ""} 
                    onValueChange={(value) => 
                      setSelectedOptions(prev => ({ ...prev, rarity: value || undefined }))
                    }
                  >
                    <SelectTrigger data-testid="select-rarity">
                      <SelectValue placeholder="Random Rarity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Random Rarity</SelectItem>
                      {generationOptions?.data?.rarities?.map((rarity: string) => (
                        <SelectItem key={rarity} value={rarity}>
                          <span className={getRarityColor(rarity)}>
                            {rarity}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button 
                onClick={handleGenerate}
                disabled={generateMemberMutation.isPending}
                className="w-full bg-yellow-600 hover:bg-yellow-700 text-black font-bold"
                data-testid="button-generate-member"
              >
                {generateMemberMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating AI Member...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4 mr-2" />
                    Generate Inquisition Member
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Generated Members Gallery */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-yellow-300 flex items-center gap-2">
                <Scroll className="h-5 w-5" />
                Your Generated Members ({members.length})
              </h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/gaming/inquisition-members/my-members'] })}
                data-testid="button-refresh-members"
              >
                <RefreshCw className="h-3 w-3 mr-2" />
                Refresh
              </Button>
            </div>

            {membersLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i} className="bg-slate-800/50 border-slate-600 animate-pulse">
                    <CardContent className="p-4">
                      <div className="h-32 bg-slate-600 rounded mb-4"></div>
                      <div className="h-4 bg-slate-600 rounded mb-2"></div>
                      <div className="h-3 bg-slate-700 rounded"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : members.length === 0 ? (
              <Card className="bg-slate-800/50 border-slate-600">
                <CardContent className="text-center py-8">
                  <User className="h-12 w-12 text-slate-500 mx-auto mb-4" />
                  <p className="text-slate-400 mb-4">No inquisition members generated yet</p>
                  <p className="text-slate-500 text-sm">
                    Use the generator above to create your first AI-powered inquisition member
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {members.map((member: GeneratedMember) => (
                  <Dialog key={member.id}>
                    <DialogTrigger asChild>
                      <Card className="bg-slate-800/50 border-slate-600 hover:border-yellow-500/50 cursor-pointer transition-colors">
                        <CardContent className="p-4">
                          {/* Member Image */}
                          <div className="relative mb-4">
                            <img
                              src={normalizeNftImage({ image_url: member.image_url })}
                              alt={member.name}
                              className="w-full h-32 object-cover rounded border-2"
                              style={{ borderColor: `hsl(var(--${member.rarity === 'legendary' ? 'yellow' : member.rarity === 'epic' ? 'purple' : member.rarity === 'rare' ? 'blue' : 'gray'}-500) / 0.5)` }}
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = `https://via.placeholder.com/200x128/1a1a1a/ffffff?text=${encodeURIComponent(member.name)}`;
                              }}
                            />
                            <Badge 
                              className={`absolute top-2 right-2 ${getRarityColor(member.rarity)}`}
                              data-testid={`badge-rarity-${member.id}`}
                            >
                              {member.rarity}
                            </Badge>
                          </div>

                          {/* Member Info */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              {getRoleIcon(member.role)}
                              <h4 className="font-semibold text-cyan-300 truncate" data-testid={`text-member-name-${member.id}`}>
                                {member.name}
                              </h4>
                            </div>
                            
                            <div className="flex gap-2">
                              <Badge variant="outline" className="text-xs">
                                <span className={getMaterialColor(member.material)}>
                                  {member.material}
                                </span>
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {member.player_type}
                              </Badge>
                            </div>

                            <div className="flex justify-between text-xs">
                              <span className="text-slate-400">Power:</span>
                              <span className="text-red-400" data-testid={`text-power-${member.id}`}>
                                {member.stats.base_power}
                              </span>
                            </div>

                            {/* Special stats preview */}
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-400">Combat:</span>
                              <span className="text-orange-400">{member.stats.combat_effectiveness}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </DialogTrigger>

                    {/* Member Detail Modal */}
                    <DialogContent className="w-[95vw] sm:w-[90%] sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
                      <DialogHeader>
                        <DialogTitle className="text-yellow-300 flex items-center gap-2">
                          {getRoleIcon(member.role)}
                          {member.name} - {member.role}
                        </DialogTitle>
                      </DialogHeader>

                      <div className="space-y-6">
                        {/* Character Image & Basic Info */}
                        <div className="flex gap-4">
                          <img
                            src={normalizeNftImage({ image_url: member.image_url })}
                            alt={member.name}
                            className="w-32 h-32 object-cover rounded border-2 border-yellow-500/50"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = `https://via.placeholder.com/128x128/1a1a1a/ffffff?text=${encodeURIComponent(member.name)}`;
                            }}
                          />
                          <div className="flex-1 space-y-2">
                            <div className="flex gap-2">
                              <Badge className={getRarityColor(member.rarity)}>
                                {member.rarity}
                              </Badge>
                              <Badge variant="outline">
                                <span className={getMaterialColor(member.material)}>
                                  {member.material}
                                </span>
                              </Badge>
                              <Badge variant="outline">
                                {member.player_type}
                              </Badge>
                            </div>
                            
                            {/* Stats Grid */}
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-slate-400">Base Power:</span>
                                <span className="text-red-400 font-bold">{member.stats.base_power}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Combat:</span>
                                <span className="text-orange-400">{member.stats.combat_effectiveness}</span>
                              </div>
                              {member.stats.leadership_value > 0 && (
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Leadership:</span>
                                  <span className="text-yellow-400">{member.stats.leadership_value}</span>
                                </div>
                              )}
                              {member.stats.magical_power > 0 && (
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Magic:</span>
                                  <span className="text-purple-400">{member.stats.magical_power}</span>
                                </div>
                              )}
                              {member.stats.division_boost > 0 && (
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Division Boost:</span>
                                  <span className="text-blue-400">{member.stats.division_boost}</span>
                                </div>
                              )}
                              {member.stats.religion_control > 0 && (
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Religion Control:</span>
                                  <span className="text-green-400">{member.stats.religion_control}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <Separator />

                        {/* Character Story */}
                        <div>
                          <h4 className="font-semibold text-yellow-300 mb-2 flex items-center gap-2">
                            <Scroll className="h-4 w-4" />
                            Character Story
                          </h4>
                          <ScrollArea className="h-32 rounded border border-slate-600 p-3">
                            <p className="text-slate-300 text-sm leading-relaxed">
                              {member.popup_story}
                            </p>
                          </ScrollArea>
                        </div>

                        {/* Abilities */}
                        {member.abilities && Object.keys(member.abilities).length > 0 && (
                          <div>
                            <h4 className="font-semibold text-yellow-300 mb-2 flex items-center gap-2">
                              <Zap className="h-4 w-4" />
                              Special Abilities
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(member.abilities)
                                .filter(([_, enabled]) => enabled)
                                .map(([ability, _]) => (
                                  <TooltipProvider key={ability}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Badge variant="secondary" className="cursor-help">
                                          {getAbilityIcon(ability)}
                                          {formatAbilityName(ability)}
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>{formatAbilityName(ability)}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                ))
                              }
                            </div>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-2 pt-4">
                          <Button 
                            className="flex-1 bg-purple-600 hover:bg-purple-700"
                            disabled
                            data-testid={`button-mint-${member.id}`}
                          >
                            <Shield className="h-4 w-4 mr-2" />
                            Mint as NFT (Coming Soon)
                          </Button>
                          <Button 
                            variant="outline" 
                            className="flex-1"
                            disabled
                            data-testid={`button-deploy-${member.id}`}
                          >
                            <Swords className="h-4 w-4 mr-2" />
                            Deploy to Force (Coming Soon)
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
