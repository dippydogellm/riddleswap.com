import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Shield, 
  Trophy, 
  Swords,
  Sparkles,
  Search,
  ArrowLeft,
  Crown,
  RefreshCw,
  Filter,
  ArrowUpDown,
  User
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Link, useParams } from "wouter";
import { InquisitionNFTCard, InquisitionNFT } from "@/components/inquisition-nft-card";
import { BackButton } from "@/components/gaming/BackButton";

interface NFT {
  nft_id: string;
  name: string;
  description: string;
  image_url: string;
  collection_name: string;
  game_role: string;
  rarity_score: string;
  owned_at: string;
  total_power: number | null;
  army_power: number | null;
  religion_power: number | null;
  civilization_power: number | null;
  economic_power: number | null;
  wallet_address?: string;
  user_handle?: string;
  id?: number;
  nft_token_id?: string;
  collection_id?: number;
  total_points?: number;
  power_strength?: number;
  power_defense?: number;
  power_magic?: number;
  power_speed?: number;
  traits?: Record<string, any>;
  
  // NEW FIELDS: Character classification
  material_type?: string | null;
  character_class?: string | null;
  battle_specialization?: string | null;
}

const InquisitionPlayerProfile = () => {
  const { handle } = useParams<{ handle: string }>();
  const [searchQuery, setSearchQuery] = useState("");
  const [collectionFilter, setCollectionFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"power" | "name" | "recent">("power");
  const [selectedNFT, setSelectedNFT] = useState<NFT | null>(null);

  // Helper function to extract token number from image URL
  const getTokenNumber = (imageUrl: string): string => {
    const match = imageUrl.match(/\/(\d+)\.png/);
    return match ? match[1] : 'Unknown';
  };

  // Helper function to get NFT display name
  const getNFTName = (nft: NFT): string => {
    if (nft.name && !nft.name.includes('undefined')) {
      return nft.name;
    }
    const tokenNumber = getTokenNumber(nft.image_url);
    return `${nft.collection_name} #${tokenNumber}`;
  };

  // Fetch player's NFT data with auto-refresh for new images
  const { data: nftsData, isLoading, error } = useQuery<NFT[]>({
    queryKey: [`/api/gaming/player/nfts?user_handle=${handle}`],
    enabled: !!handle,
    retry: 2,
    staleTime: 30000,
    refetchInterval: 10000, // Auto-refresh every 10 seconds to check for new images
    refetchIntervalInBackground: false, // Only refetch when tab is active
  });

  // Transform data to profile format
  const profile = nftsData ? {
    total_nfts: nftsData.length,
    total_points: nftsData.reduce((sum, nft) => {
      const power = nft.total_power ?? parseFloat(nft.rarity_score);
      return sum + (Number.isFinite(power) ? power : 0);
    }, 0),
    nfts: nftsData
  } : undefined;

  // Fetch leaderboard for rank
  const { data: leaderboardData } = useQuery<{ success: boolean; data: any[] }>({
    queryKey: ['/api/inquisition-audit/leaderboard?limit=100'],
  });

  // Find player's wallet address from their first NFT
  const playerWallet = nftsData?.[0]?.wallet_address || '';

  const userRank = leaderboardData?.data && playerWallet
    ? leaderboardData.data.findIndex(entry => entry.wallet_address === playerWallet) + 1
    : null;

  // Get unique collections
  const collections = profile?.nfts 
    ? Array.from(new Set(profile.nfts.map(nft => nft.collection_name))).sort()
    : [];

  // Filter and sort NFTs
  const filteredNfts = (profile?.nfts || [])
    .filter(nft => {
      const matchesSearch = searchQuery === "" || 
        nft.name?.toLowerCase()?.includes(searchQuery.toLowerCase()) ||
        nft.nft_id?.includes(searchQuery) ||
        getNFTName(nft).toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCollection = collectionFilter === "all" || 
        nft.collection_name === collectionFilter;
      
      return matchesSearch && matchesCollection;
    })
    .sort((a, b) => {
      if (sortBy === "power") {
        const powerA = a.total_power ?? parseFloat(a.rarity_score);
        const powerB = b.total_power ?? parseFloat(b.rarity_score);
        const validA = Number.isFinite(powerA) ? powerA : 0;
        const validB = Number.isFinite(powerB) ? powerB : 0;
        return validB - validA;
      } else if (sortBy === "name") {
        return getNFTName(a).localeCompare(getNFTName(b));
      } else if (sortBy === "recent") {
        return new Date(b.owned_at).getTime() - new Date(a.owned_at).getTime();
      }
      return 0;
    });

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="bg-slate-900 border-b-2 border-purple-600">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <BackButton to="/inquisition" label="Back to Dashboard" theme="dark" />
              <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                  <User className="w-8 h-8 text-purple-500" />
                  {handle}'s Profile
                </h1>
                {playerWallet && (
                  <p className="text-slate-400 text-sm mt-1 font-mono">
                    {playerWallet.slice(0, 12)}...{playerWallet.slice(-8)}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Stats */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-purple-900 border-2 border-purple-600">
            <CardContent className="p-6 text-center">
              <Shield className="w-8 h-8 text-purple-300 mx-auto mb-2" />
              <div className="text-3xl font-bold text-purple-300">
                {isLoading ? "..." : profile?.total_nfts || 0}
              </div>
              <div className="text-sm text-slate-300 mt-1">NFTs Owned</div>
            </CardContent>
          </Card>

          <Card className="bg-amber-900 border-2 border-amber-600">
            <CardContent className="p-6 text-center">
              <Sparkles className="w-8 h-8 text-amber-300 mx-auto mb-2" />
              <div className="text-3xl font-bold text-amber-300">
                {isLoading ? "..." : (profile?.total_points || 0).toLocaleString()}
              </div>
              <div className="text-sm text-slate-300 mt-1">Total Power</div>
            </CardContent>
          </Card>

          <Card className="bg-green-900 border-2 border-green-600">
            <CardContent className="p-6 text-center">
              <Trophy className="w-8 h-8 text-green-300 mx-auto mb-2" />
              <div className="text-3xl font-bold text-green-300">
                {userRank ? `#${userRank}` : 'Unranked'}
              </div>
              <div className="text-sm text-slate-300 mt-1">Global Rank</div>
            </CardContent>
          </Card>

          <Card className="bg-blue-900 border-2 border-blue-600">
            <CardContent className="p-6 text-center">
              <Crown className="w-8 h-8 text-blue-300 mx-auto mb-2" />
              <div className="text-3xl font-bold text-blue-300">
                {profile?.nfts ? new Set(profile.nfts.map(n => n.collection_name)).size : 0}
              </div>
              <div className="text-sm text-slate-300 mt-1">Collections</div>
            </CardContent>
          </Card>
        </div>

        {/* NFT Gallery */}
        <Card className="bg-slate-900 border-2 border-purple-600">
          <CardHeader>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-purple-400 flex items-center gap-2">
                  <Swords className="w-6 h-6" />
                  {handle}'s NFT Army ({filteredNfts.length})
                </CardTitle>
              </div>
              
              {/* Filters and Search Row */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-purple-400" />
                  <Select value={collectionFilter} onValueChange={setCollectionFilter}>
                    <SelectTrigger className="w-[200px] bg-slate-800 border-2 border-purple-600 text-white">
                      <SelectValue placeholder="All Collections" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-2 border-purple-600">
                      <SelectItem value="all" className="text-white hover:bg-purple-600">All Collections</SelectItem>
                      {collections.map(collection => (
                        <SelectItem key={collection} value={collection} className="text-white hover:bg-purple-600">
                          {collection}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <ArrowUpDown className="w-4 h-4 text-purple-400" />
                  <Select value={sortBy} onValueChange={(value: "power" | "name" | "recent") => setSortBy(value)}>
                    <SelectTrigger className="w-[180px] bg-slate-800 border-2 border-purple-600 text-white">
                      <SelectValue placeholder="Sort By" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-2 border-purple-600">
                      <SelectItem value="power" className="text-white hover:bg-purple-600">Highest Power</SelectItem>
                      <SelectItem value="name" className="text-white hover:bg-purple-600">Name (A-Z)</SelectItem>
                      <SelectItem value="recent" className="text-white hover:bg-purple-600">Recently Added</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search NFTs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-slate-800 border-2 border-purple-600 text-white w-full"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12 space-y-4">
                <RefreshCw className="w-12 h-12 text-purple-500 mx-auto animate-spin" />
                <div className="text-slate-400">
                  <p className="font-bold">Loading player NFTs...</p>
                  <p className="text-sm mt-2">This may take a few moments</p>
                </div>
              </div>
            ) : error ? (
              <div className="text-center py-12 space-y-4">
                <Shield className="w-16 h-16 text-red-500 mx-auto" />
                <div className="text-slate-400">
                  <p className="font-bold text-red-400">Failed to load player NFTs</p>
                  <p className="text-sm mt-2">{(error as any)?.message || 'Player not found or has no NFTs'}</p>
                </div>
              </div>
            ) : filteredNfts.length > 0 ? (
              <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredNfts.map((nft) => (
                  <InquisitionNFTCard
                    key={nft.nft_id}
                    nft={nft as InquisitionNFT}
                    onClick={() => setSelectedNFT(nft)}
                    showPowerBars={true}
                    compact={false}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 space-y-4">
                <Shield className="w-16 h-16 text-slate-600 mx-auto" />
                <p className="text-slate-400">
                  {searchQuery ? "No NFTs match your search" : "This player doesn't own any Inquisition NFTs yet"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* NFT Details Modal */}
      {selectedNFT && (
        <Dialog open={!!selectedNFT} onOpenChange={() => setSelectedNFT(null)}>
          <DialogContent className="bg-slate-900 border-2 border-purple-600 text-white max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-purple-400">
                {getNFTName(selectedNFT)}
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                {selectedNFT.collection_name}
              </DialogDescription>
            </DialogHeader>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="rounded-lg overflow-hidden border-2 border-purple-600">
                  <img 
                    src={selectedNFT.image_url.replace('ipfs://', 'https://ipfs.io/ipfs/')} 
                    alt={getNFTName(selectedNFT)}
                    className="w-full h-auto"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-gradient-to-br from-amber-900/50 to-amber-800/50 border-2 border-amber-600 rounded-lg p-4">
                  <div className="text-sm text-amber-300 mb-1">Total Power</div>
                  <div className="text-3xl font-bold text-amber-400">
                    {selectedNFT.total_power || selectedNFT.total_points}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-bold text-purple-400 mb-2">Power Attributes</div>
                  
                  <div className="flex items-center justify-between bg-red-950 border border-red-800 rounded p-3">
                    <div className="flex items-center gap-2">
                      <Swords className="w-5 h-5 text-red-500" />
                      <span className="font-semibold text-red-400">Army Power</span>
                    </div>
                    <span className="text-xl font-bold text-red-500">
                      {selectedNFT.army_power || selectedNFT.power_strength || 0}
                    </span>
                  </div>

                  <div className="flex items-center justify-between bg-blue-950 border border-blue-800 rounded p-3">
                    <div className="flex items-center gap-2">
                      <Shield className="w-5 h-5 text-blue-500" />
                      <span className="font-semibold text-blue-400">Civilization</span>
                    </div>
                    <span className="text-xl font-bold text-blue-500">
                      {selectedNFT.civilization_power || selectedNFT.power_defense || 0}
                    </span>
                  </div>

                  <div className="flex items-center justify-between bg-purple-950 border border-purple-800 rounded p-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-purple-500" />
                      <span className="font-semibold text-purple-400">Religion</span>
                    </div>
                    <span className="text-xl font-bold text-purple-500">
                      {selectedNFT.religion_power || selectedNFT.power_magic || 0}
                    </span>
                  </div>

                  <div className="flex items-center justify-between bg-green-950 border border-green-800 rounded p-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-green-500" />
                      <span className="font-semibold text-green-400">Economic</span>
                    </div>
                    <span className="text-xl font-bold text-green-500">
                      {selectedNFT.economic_power || selectedNFT.power_speed || 0}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-800 border border-slate-700 rounded p-3">
                  <div className="text-xs text-slate-400 mb-1">NFT Token ID</div>
                  <code className="text-xs text-purple-400 break-all">
                    {selectedNFT.nft_id}
                  </code>
                </div>

                <Button
                  variant="outline"
                  className="border-2 border-purple-600 hover:bg-purple-600 w-full"
                  onClick={() => setSelectedNFT(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default InquisitionPlayerProfile;
