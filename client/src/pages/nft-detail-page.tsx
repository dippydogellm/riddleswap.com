import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Eye, Lock, Zap, Star, Shield, Coins, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NFTDetail {
  nft_token_id: string;
  collection_name: string;
  nft_name: string;
  image_url: string;
  current_owner: string;
  issuer_address: string;
  taxon: number;
  
  // Trait data from inquisition_nft_audit
  all_traits: Record<string, any>;
  special_powers: string[];
  materials_found: string[];
  rarities_found: string[];
  
  // Power attributes from nft_power_attributes
  army_power: number;
  religion_power: number;
  civilization_power: number;
  economic_power: number;
  total_power: number;
  material_multiplier: number;
  rarity_multiplier: number;
  trait_mapping: Record<string, number>;
}

export default function NFTDetailPage() {
  const [, params] = useRoute("/nft/:tokenId");
  const [nft, setNft] = useState<NFTDetail | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    if (params?.tokenId) {
      loadNFTDetail(params.tokenId);
      loadCurrentUser();
    }
  }, [params?.tokenId]);

  const loadCurrentUser = async () => {
    try {
      const res = await fetch('/api/users/me');
      if (res.ok) {
        const data = await res.json() as any;
        setCurrentUser(data.user);
      }
    } catch (error) {
      console.error("Error loading user:", error);
    }
  };

  const loadNFTDetail = async (tokenId: string) => {
    try {
      const res = await fetch(`/api/nfts/${tokenId}/details`);
      if (res.ok) {
        const data = await res.json() as any;
        setNft(data.nft);
        
        // Check if current user owns this NFT
        const userRes = await fetch('/api/users/me');
        if (userRes.ok) {
          const userData = await userRes.json();
          const userWallet = userData.user?.walletAddress;
          setIsOwner(userWallet && userWallet.toLowerCase() === data.nft.current_owner?.toLowerCase());
        }
      }
    } catch (error) {
      console.error("Error loading NFT:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading NFT details...</div>
      </div>
    );
  }

  if (!nft) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">NFT not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/10"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          
          {isOwner && (
            <Badge className="bg-yellow-500 text-black">
              <Lock className="h-3 w-3 mr-1" />
              You Own This
            </Badge>
          )}
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Image and Basic Info */}
          <div className="space-y-4">
            <Card className="bg-white/10 backdrop-blur border-white/20 overflow-hidden">
              <img
                src={nft.image_url || '/placeholder-nft.png'}
                alt={nft.nft_name}
                className="w-full aspect-square object-cover"
              />
            </Card>

            <Card className="bg-white/10 backdrop-blur border-white/20">
              <CardHeader>
                <CardTitle className="text-white text-2xl">{nft.nft_name}</CardTitle>
                <CardDescription className="text-blue-200">{nft.collection_name}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-blue-200">Token ID</span>
                  <span className="text-white font-mono text-sm">{nft.nft_token_id.slice(0, 16)}...</span>
                </div>
                <Separator className="bg-white/20" />
                <div className="flex items-center justify-between">
                  <span className="text-blue-200">Owner</span>
                  <span className="text-white font-mono text-sm">{nft.current_owner.slice(0, 12)}...</span>
                </div>
                <Separator className="bg-white/20" />
                <div className="flex items-center justify-between">
                  <span className="text-blue-200">Collection Taxon</span>
                  <span className="text-white">#{nft.taxon}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Power Stats and Traits */}
          <div className="space-y-4">
            {/* Power Overview */}
            <Card className="bg-gradient-to-br from-yellow-900/40 to-orange-900/40 backdrop-blur border-yellow-500/30">
              <CardHeader>
                <CardTitle className="text-yellow-300 flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Total Power: {nft.total_power?.toLocaleString() || 0}
                </CardTitle>
                <CardDescription className="text-yellow-200">
                  Battle power from traits and multipliers
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <div className="bg-black/20 p-3 rounded-lg">
                  <div className="text-xs text-yellow-200">Army</div>
                  <div className="text-2xl font-bold text-white">{nft.army_power || 0}</div>
                </div>
                <div className="bg-black/20 p-3 rounded-lg">
                  <div className="text-xs text-yellow-200">Religion</div>
                  <div className="text-2xl font-bold text-white">{nft.religion_power || 0}</div>
                </div>
                <div className="bg-black/20 p-3 rounded-lg">
                  <div className="text-xs text-yellow-200">Civilization</div>
                  <div className="text-2xl font-bold text-white">{nft.civilization_power || 0}</div>
                </div>
                <div className="bg-black/20 p-3 rounded-lg">
                  <div className="text-xs text-yellow-200">Economic</div>
                  <div className="text-2xl font-bold text-white">{nft.economic_power || 0}</div>
                </div>
              </CardContent>
            </Card>

            {/* Multipliers */}
            <Card className="bg-white/10 backdrop-blur border-white/20">
              <CardHeader>
                <CardTitle className="text-white text-lg">Power Multipliers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-blue-200 flex items-center gap-2">
                    <Star className="h-4 w-4" />
                    Rarity Multiplier
                  </span>
                  <Badge variant="secondary" className="bg-purple-500/20 text-purple-200">
                    {nft.rarity_multiplier?.toFixed(2) || 1}x
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-blue-200 flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Material Multiplier
                  </span>
                  <Badge variant="secondary" className="bg-blue-500/20 text-blue-200">
                    {nft.material_multiplier?.toFixed(2) || 1}x
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Special Powers (Owner Only) */}
            {isOwner && nft.special_powers && nft.special_powers.length > 0 && (
              <Card className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 backdrop-blur border-purple-500/30">
                <CardHeader>
                  <CardTitle className="text-purple-300 flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Special Powers (Owner Only)
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {nft.special_powers.map((power, idx) => (
                    <Badge key={idx} className="bg-purple-500/30 text-purple-100">
                      ⚡ {power}
                    </Badge>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Detailed Traits Tabs */}
        <Card className="bg-white/10 backdrop-blur border-white/20">
          <Tabs defaultValue="traits" className="w-full">
            <CardHeader>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="traits">
                  <Eye className="h-4 w-4 mr-2" />
                  All Traits
                </TabsTrigger>
                <TabsTrigger value="materials">
                  <Coins className="h-4 w-4 mr-2" />
                  Materials
                </TabsTrigger>
                <TabsTrigger value="rarities">
                  <Star className="h-4 w-4 mr-2" />
                  Rarities
                </TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent>
              <TabsContent value="traits" className="space-y-2 mt-0">
                {nft.all_traits && Object.keys(nft.all_traits).length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Object.entries(nft.all_traits).map(([key, value]) => (
                      <div key={key} className="bg-white/5 p-3 rounded-lg hover:bg-white/10 transition-colors">
                        <div className="text-xs text-blue-300 uppercase tracking-wide">{key}</div>
                        <div className="text-white font-semibold mt-1">{String(value)}</div>
                        {nft.trait_mapping && nft.trait_mapping[key] && (
                          <Badge variant="outline" className="mt-2 text-xs">
                            +{nft.trait_mapping[key]} power
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-blue-200 py-8">No trait data available</div>
                )}
              </TabsContent>

              <TabsContent value="materials" className="space-y-2 mt-0">
                {nft.materials_found && nft.materials_found.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {nft.materials_found.map((material, idx) => (
                      <Badge key={idx} className="bg-amber-500/20 text-amber-200 text-sm py-2 px-4">
                        🔨 {material}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-blue-200 py-8">No materials detected</div>
                )}
              </TabsContent>

              <TabsContent value="rarities" className="space-y-2 mt-0">
                {nft.rarities_found && nft.rarities_found.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {nft.rarities_found.map((rarity, idx) => (
                      <Badge key={idx} className="bg-purple-500/20 text-purple-200 text-sm py-2 px-4">
                        ⭐ {rarity}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-blue-200 py-8">No rarity information</div>
                )}
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
