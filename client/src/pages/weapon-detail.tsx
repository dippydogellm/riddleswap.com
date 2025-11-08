import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { useSession } from "@/utils/sessionManager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Sword, Shield, Zap, TrendingUp, Image as ImageIcon, Loader2, Sparkles, ArrowLeft, ExternalLink, ShoppingBag } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

export default function WeaponDetail() {
  const [, params] = useRoute("/weapon-detail/:nftTokenId");
  const [, setLocation] = useLocation();
  const session = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [generatingImage, setGeneratingImage] = useState(false);

  const nftTokenId = params?.nftTokenId;

  // Fetch weapon details from marketplace detail endpoint (with auth for ownership verification)
  const { data: weaponData, isLoading } = useQuery<any>({
    queryKey: [`/api/weapons/marketplace/detail/${nftTokenId}`],
    enabled: !!nftTokenId,
    queryFn: async () => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // Add bearer token if user is logged in
      if (session.sessionToken) {
        headers['Authorization'] = `Bearer ${session.sessionToken}`;
      }
      
      const res = await fetch(`/api/weapons/marketplace/detail/${nftTokenId}`, {
        headers,
        credentials: 'include'
      });
      
      if (!res.ok) {
        const error = await res.json() as any;
        throw new Error(error.error || 'Failed to fetch weapon details');
      }
      
      return res.json();
    }
  });

  const weapon = weaponData?.weapon;
  const isListed = weaponData?.isListed;
  const isOwner = weaponData?.isOwner;

  // Generate AI image mutation
  const generateImageMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/weapons/oracle/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionToken}`
        },
        credentials: 'include',
        body: JSON.stringify({
          weaponDefinitionId: weapon.definitionId,
          color: weapon.color,
          techLevel: weapon.techLevel
        })
      });

      if (!res.ok) {
        const error = await res.json() as any;
        throw new Error(error.error || 'Failed to generate image');
      }

      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Image Generated!",
        description: "The Oracle has created a unique image for your weapon",
      });
      // Refresh weapon data to get updated image
      queryClient.invalidateQueries({ queryKey: [`/api/weapons/marketplace/detail/${nftTokenId}`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Image Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleGenerateImage = () => {
    setGeneratingImage(true);
    generateImageMutation.mutate();
    setTimeout(() => setGeneratingImage(false), 3000);
  };

  if (!session.handle) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-orange-950 to-slate-950 flex items-center justify-center p-4">
        <Card className="bg-slate-900/80 border-orange-500/30 max-w-md">
          <CardContent className="p-8 text-center">
            <Sword className="w-16 h-16 text-orange-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Login Required</h2>
            <p className="text-gray-400 mb-4">Please login to view weapon details</p>
            <Link href="/wallet-login">
              <Button className="bg-gradient-to-r from-orange-500 to-red-600">
                Login Now
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-orange-950 to-slate-950 flex items-center justify-center p-4">
        <Card className="bg-slate-900/80 border-orange-500/30">
          <CardContent className="p-12 text-center">
            <Loader2 className="w-12 h-12 text-orange-500 animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Loading weapon details...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!weapon) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-orange-950 to-slate-950 flex items-center justify-center p-4">
        <Card className="bg-slate-900/80 border-orange-500/30 max-w-md">
          <CardContent className="p-8 text-center">
            <Sword className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Weapon Not Available</h2>
            <p className="text-gray-400 mb-4">This weapon is not currently available on the marketplace</p>
            <Link href="/weapons-marketplace">
              <Button className="bg-gradient-to-r from-orange-500 to-red-600">
                Back to Marketplace
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getRarityColor = (rarity: string) => {
    const r = rarity?.toLowerCase();
    if (r === "legendary") return "from-amber-500 to-yellow-500";
    if (r === "epic") return "from-purple-500 to-pink-500";
    if (r === "rare") return "from-blue-500 to-cyan-500";
    if (r === "uncommon") return "from-green-500 to-emerald-500";
    return "from-gray-500 to-slate-500";
  };

  const totalPower = (weapon.finalAttack || 0) + (weapon.finalDefense || 0);
  const maxPower = (weapon.baseAttack + weapon.baseDefense) * 2; // Approximate max
  const powerPercentage = (totalPower / maxPower) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-orange-950 to-slate-950 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Back Button */}
        <Link href="/weapons-arsenal">
          <Button variant="outline" className="border-orange-500/50 text-orange-400">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Arsenal
          </Button>
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Image Section */}
          <Card className="bg-slate-900/80 border-orange-500/30">
            <CardContent className="p-6">
              <div className="relative aspect-square rounded-lg overflow-hidden mb-4 group">
                <img 
                  src={weapon.imageUrl || "/inquisition-logo.png"}
                  alt={weapon.customName || weapon.name}
                  className="w-full h-full object-cover"
                />
                {weapon.rarity && (
                  <Badge className={`absolute top-4 right-4 bg-gradient-to-r ${getRarityColor(weapon.rarity)} text-white text-lg px-4 py-2`}>
                    {weapon.rarity}
                  </Badge>
                )}
                {weapon.techLevel && (
                  <Badge className="absolute top-4 left-4 bg-purple-500/90 text-white text-lg px-4 py-2">
                    Tech Level {weapon.techLevel}
                  </Badge>
                )}
                {weapon.isEquipped && (
                  <Badge className="absolute bottom-4 left-4 bg-green-500/90 text-white text-lg px-4 py-2">
                    Equipped
                  </Badge>
                )}
              </div>

              {/* Generate Image Button - Only for owners */}
              {isOwner && (
                <Button
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700"
                  onClick={handleGenerateImage}
                  disabled={generateImageMutation.isPending || generatingImage}
                >
                  {generateImageMutation.isPending || generatingImage ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating with Oracle AI...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate New Image (DALL-E)
                    </>
                  )}
                </Button>
              )}
              
              {/* Buy Button - Only for listings */}
              {isListed && !isOwner && (
                <div className="space-y-2">
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-2">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-400">Listed Price:</span>
                      <span className="text-2xl font-bold text-amber-400">
                        {(Number(weapon.priceDrops) / 1_000_000).toFixed(2)} XRP
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">Seller:</span>
                      <span className="text-white">{weapon.sellerHandle}</span>
                    </div>
                  </div>
                  <Link href="/weapons-marketplace">
                    <Button className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700">
                      <ShoppingBag className="w-4 h-4 mr-2" />
                      Buy on Marketplace
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Details Section */}
          <div className="space-y-6">
            <Card className="bg-slate-900/80 border-orange-500/30">
              <CardHeader>
                <CardTitle className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">
                  {weapon.customName || weapon.weaponName || weapon.name}
                </CardTitle>
                <p className="text-gray-400">{weapon.weaponType} • {weapon.weaponCategory || weapon.category}</p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Description */}
                {weapon.description && (
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Description</h3>
                    <p className="text-gray-400">{weapon.description}</p>
                  </div>
                )}

                {/* Power Stats */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold text-white">Total Power</h3>
                    <span className="text-2xl font-bold text-orange-400">{totalPower}</span>
                  </div>
                  <Progress value={powerPercentage} className="h-3 mb-4" />

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-800/50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Sword className="w-5 h-5 text-red-400" />
                        <span className="text-gray-400 text-sm">Attack</span>
                      </div>
                      <p className="text-2xl font-bold text-red-400">{weapon.finalAttack || 0}</p>
                      <p className="text-xs text-gray-500">Base: {weapon.baseAttack}</p>
                    </div>

                    <div className="bg-slate-800/50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Shield className="w-5 h-5 text-blue-400" />
                        <span className="text-gray-400 text-sm">Defense</span>
                      </div>
                      <p className="text-2xl font-bold text-blue-400">{weapon.finalDefense || 0}</p>
                      <p className="text-xs text-gray-500">Base: {weapon.baseDefense}</p>
                    </div>
                  </div>
                </div>

                {/* Customization */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Customization</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center bg-slate-800/50 rounded-lg p-3">
                      <span className="text-gray-400">Color Scheme</span>
                      <Badge className="bg-gradient-to-r from-orange-500 to-red-600 text-white">
                        {weapon.color || 'Default'}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center bg-slate-800/50 rounded-lg p-3">
                      <span className="text-gray-400">Tech Level</span>
                      <Badge className="bg-purple-500 text-white">
                        Level {weapon.techLevel || 1}/5
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* NFT Details */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">NFT Details</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Token ID</span>
                      <span className="text-white font-mono text-xs">{weapon.nftTokenId.slice(0, 16)}...</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Created</span>
                      <span className="text-white">{new Date(weapon.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Additional Tabs */}
        <Card className="bg-slate-900/80 border-orange-500/30">
          <CardContent className="p-6">
            <Tabs defaultValue="stats" className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-slate-800">
                <TabsTrigger value="stats">Stats</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
                <TabsTrigger value="upgrade">Upgrade</TabsTrigger>
              </TabsList>

              <TabsContent value="stats" className="space-y-4 mt-6">
                <h3 className="text-lg font-semibold text-white mb-4">Detailed Statistics</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard label="Base Attack" value={weapon.baseAttack} icon={<Sword className="w-5 h-5 text-red-400" />} />
                  <StatCard label="Base Defense" value={weapon.baseDefense} icon={<Shield className="w-5 h-5 text-blue-400" />} />
                  <StatCard label="Final Attack" value={weapon.finalAttack || 0} icon={<Zap className="w-5 h-5 text-orange-400" />} />
                  <StatCard label="Final Defense" value={weapon.finalDefense || 0} icon={<TrendingUp className="w-5 h-5 text-green-400" />} />
                </div>
              </TabsContent>

              <TabsContent value="history" className="mt-6">
                <div className="text-center py-12">
                  <p className="text-gray-400">Transaction history coming soon</p>
                </div>
              </TabsContent>

              <TabsContent value="upgrade" className="mt-6">
                <div className="text-center py-12">
                  <p className="text-gray-400">Weapon upgrades coming soon</p>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
}

function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <div className="bg-slate-800/50 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-gray-400 text-sm">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
