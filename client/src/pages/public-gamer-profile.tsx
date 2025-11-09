import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Shield, 
  Trophy, 
  Users, 
  Swords,
  Crown,
  Sparkles,
  Scroll,
  Target,
  Zap,
  Coins,
  Axe,
  Hammer,
  MapPin,
  Search,
  User,
  ArrowLeft,
  Gamepad2,
  Calendar,
  TrendingUp,
  TrendingDown,
  X
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Link, useRoute } from "wouter";
import { InquisitionNFTCard } from "@/components/inquisition-nft-card";
import { apiRequest } from "@/lib/queryClient";

// Collection configuration with roles and colors
const COLLECTION_CONFIG = {
  "The Inquiry": {
    icon: Crown,
    color: "from-yellow-600 to-amber-600",
    role: "God-like",
    description: "Divine powers and ultimate authority",
    power_type: "special"
  },
  "Under the Bridge: Troll": {
    icon: Coins,
    color: "from-green-600 to-teal-600", 
    role: "Economic",
    description: "Control wealth and trade routes",
    power_type: "bank"
  },
  "The Lost Emporium": {
    icon: Hammer,
    color: "from-amber-600 to-orange-600",
    role: "Weapons",
    description: "Forge legendary weapons to boost your army",
    power_type: "merchant"
  },
  "DANTES AURUM": {
    icon: Sparkles,
    color: "from-purple-600 to-pink-600",
    role: "Religion",
    description: "Harness spiritual power and faith",
    power_type: "special"
  },
  "The Inquisition": {
    icon: Shield,
    color: "from-purple-600 to-blue-600",
    role: "Army",
    description: "Military might and battlefield dominance",
    power_type: "army"
  },
};

interface Collection {
  id: number;
  collection_name: string;
  issuer_address: string;
  taxon: number;
  expected_supply: number;
  actual_supply: number;
  game_role: string;
  base_power_level: number;
  stats?: {
    total_nfts: number;
    total_points: number;
    avg_points: string;
  };
}

interface LeaderboardEntry {
  rank: number;
  wallet_address: string;
  total_nfts: number;
  total_points: number;
  player_handle?: string | null;
  player_name?: string | null;
  civilization_name?: string | null;
  play_type?: string | null;
}

interface PlayerNFT {
  nft_id: string;
  name: string;
  description: string;
  collection_name: string;
  image_url: string;
  game_role: string;
  total_power: number | null;
  rarity_score: string;
  army_power: number | null;
  religion_power: number | null;
  civilization_power: number | null;
  economic_power: number | null;
  traits?: Record<string, any>;
  owned_at: string;
  
  // NEW FIELDS: Character classification
  material_type?: string | null;
  character_class?: string | null;
  battle_specialization?: string | null;
}

export default function PublicGamerProfile() {
  const { toast } = useToast();
  const [, params] = useRoute<{ handle: string }>("/gamerprofile/:handle");
  const handle = params?.handle || "";
  
  const [activeCollection, setActiveCollection] = useState<string>("The Inquiry");
  const [activeSubTab, setActiveSubTab] = useState<string>("gallery");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNFT, setSelectedNFT] = useState<PlayerNFT | null>(null);
  const [nftDetailOpen, setNFTDetailOpen] = useState(false);

  // Reset sub-tab when collection changes
  useEffect(() => {
    setActiveSubTab("gallery");
  }, [activeCollection]);

  // Fetch collections data
  const { data: collectionsData, isLoading: collectionsLoading } = useQuery<{
    success: boolean;
    data: Collection[];
  }>({
    queryKey: ['/api/inquisition-audit/collections'],
    retry: 2,
  });

  // Fetch player's NFTs and civilization data with auto-refresh for new images
  const { data: playerNFTsData, isLoading: nftsLoading } = useQuery<{
    success: boolean;
    data: PlayerNFT[];
    civilization: {
      name: string;
      type: string | null;
      motto: string | null;
      crest_image: string | null;
      color_primary: string | null;
      color_secondary: string | null;
      color_accent: string | null;
    } | null;
    player: {
      handle: string;
      name: string | null;
      level: number | null;
      play_type: string | null;
      profile_picture: string | null;
    } | null;
  }>({
    queryKey: [`/api/inquisition-audit/player/nfts?handle=${handle}`],
    enabled: !!handle,
    retry: 2,
    refetchInterval: 10000, // Auto-refresh every 10 seconds to check for new images
    refetchIntervalInBackground: false, // Only refetch when tab is active
  });

  // Fetch global leaderboard
  const { data: leaderboardData, isLoading: leaderboardLoading } = useQuery<{
    success: boolean;
    data: LeaderboardEntry[];
  }>({
    queryKey: ['/api/inquisition-audit/leaderboard'],
    retry: 2,
  });

  // Fetch battle history
  const { data: battleHistoryData, isLoading: battlesLoading } = useQuery<{
    success: boolean;
    battles: any[];
    stats: {
      total_battles: number;
      battles_won: number;
      battles_lost: number;
    };
  }>({
    queryKey: [`/api/battles/player/${handle}/history?limit=20`],
    enabled: !!handle,
    retry: 2,
  });

  // Get player's leaderboard entry directly by handle
  const playerLeaderboardEntry = leaderboardData?.data?.find(e => 
    e.player_handle === handle
  );
  
  // Get wallet address for this player
  const playerWalletAddress = playerLeaderboardEntry?.wallet_address;

  // Filter NFTs by active collection
  const filteredNFTs = playerNFTsData?.data?.filter(nft => {
    // For Partner NFTs tab, show all partner collections
    if (activeCollection === "Partner NFTs") {
      const isPartner = !Object.keys(COLLECTION_CONFIG).includes(nft.collection_name);
      return isPartner && (searchQuery === "" || 
        nft.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        nft.nft_id?.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    // For other tabs, show specific collection
    return nft.collection_name === activeCollection &&
      (searchQuery === "" || 
       nft.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
       nft.nft_id?.toLowerCase().includes(searchQuery.toLowerCase()));
  }) || [];

  // Group NFTs by collection for stats
  const nftsByCollection = playerNFTsData?.data?.reduce((acc, nft) => {
    if (!acc[nft.collection_name]) {
      acc[nft.collection_name] = [];
    }
    acc[nft.collection_name].push(nft);
    return acc;
  }, {} as Record<string, PlayerNFT[]>) || {};

  // Get player rank (use direct entry or calculate from wallet)
  const playerRank = playerLeaderboardEntry?.rank || 
    (playerWalletAddress && leaderboardData?.data
      ? leaderboardData.data.find(e => e.wallet_address === playerWalletAddress)?.rank
      : undefined);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header with Back Button */}
        <div className="mb-6">
          <Link href="/gaming">
            <Button variant="ghost" className="text-white hover:bg-white/10">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Gaming Dashboard
            </Button>
          </Link>
        </div>

        {/* Player Profile Card */}
        <Card className="bg-slate-800/50 border-purple-500/30 mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              <div className="flex items-center gap-4 flex-1">
                {/* Player Avatar */}
                {playerNFTsData?.player?.profile_picture ? (
                  <img 
                    src={playerNFTsData.player.profile_picture} 
                    alt={handle}
                    className="w-20 h-20 rounded-full object-cover shadow-lg border-2 border-purple-500"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-3xl font-bold text-white shadow-lg">
                    {handle.charAt(0).toUpperCase()}
                  </div>
                )}
                
                {/* Civilization Crest */}
                {playerNFTsData?.civilization?.crest_image && (
                  <div className="relative">
                    <img 
                      src={playerNFTsData.civilization.crest_image} 
                      alt={`${playerNFTsData.civilization.name} Crest`}
                      className="w-16 h-16 object-contain"
                      title={playerNFTsData.civilization.name}
                    />
                  </div>
                )}
                
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-white mb-2">{handle}</h1>
                  {playerNFTsData?.civilization && (
                    <div className="mb-2">
                      <p className="text-sm text-purple-300 flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        {playerNFTsData.civilization.name}
                        {playerNFTsData.civilization.type && (
                          <span className="text-gray-400">({playerNFTsData.civilization.type})</span>
                        )}
                      </p>
                      {playerNFTsData.civilization.motto && (
                        <p className="text-xs text-gray-400 italic mt-1 line-clamp-2">
                          "{playerNFTsData.civilization.motto}"
                        </p>
                      )}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Badge className="bg-purple-600 text-white">
                      <Gamepad2 className="w-3 h-3 mr-1" />
                      Level {playerNFTsData?.player?.level || 1}
                    </Badge>
                    <Badge className="bg-amber-600 text-white">
                      <Zap className="w-3 h-3 mr-1" />
                      Power: {playerNFTsData?.data?.reduce((sum, nft) => {
                        const power = nft.total_power ?? parseFloat(nft.rarity_score || "0");
                        return sum + (Number.isFinite(power) ? power : 0);
                      }, 0)?.toFixed(0) || 0}
                    </Badge>
                    <Badge className="bg-blue-600 text-white">
                      <Trophy className="w-3 h-3 mr-1" />
                      NFTs: {playerNFTsData?.data?.length || 0}
                    </Badge>
                    {playerNFTsData?.player?.play_type && (
                      <Badge className="bg-green-600 text-white">
                        <Swords className="w-3 h-3 mr-1" />
                        {playerNFTsData.player.play_type}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Stats Grid */}
              <div className="grid grid-cols-2 gap-3 w-full md:w-auto">
                <div className="bg-slate-800/70 rounded-lg p-3 text-center">
                  <p className="text-gray-400 text-xs mb-1">Collections</p>
                  <p className="text-xl font-bold text-purple-400">
                    {nftsLoading ? '...' : (new Set(playerNFTsData?.data?.map(n => n.collection_name)).size || 0)}
                  </p>
                </div>
                <div className="bg-slate-800/70 rounded-lg p-3 text-center">
                  <p className="text-gray-400 text-xs mb-1">Rank</p>
                  <p className="text-xl font-bold text-amber-400">
                    {leaderboardLoading ? '...' : (playerRank ? `#${playerRank}` : '#?')}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Player Stats Card */}
        <Card className="bg-slate-800/50 border-purple-500/30 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-400" />
              Power Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-gray-400 text-sm">Total NFTs</p>
                <p className="text-2xl font-bold text-white">
                  {nftsLoading ? '...' : (playerNFTsData?.data?.length || 0)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-gray-400 text-sm">Total Power</p>
                <p className="text-2xl font-bold text-purple-400">
                  {nftsLoading ? '...' : (() => {
                    const totalPower = playerNFTsData?.data?.reduce((sum, nft) => {
                      const power = nft.total_power ?? parseFloat(nft.rarity_score || "0");
                      return sum + (Number.isFinite(power) ? power : 0);
                    }, 0);
                    return totalPower !== undefined ? totalPower.toFixed(0) : 0;
                  })()}
                </p>
              </div>
              <div className="text-center">
                <p className="text-gray-400 text-sm">Collections</p>
                <p className="text-2xl font-bold text-amber-400">
                  {nftsLoading ? '...' : Object.keys(nftsByCollection).length}
                </p>
              </div>
              <div className="text-center">
                <p className="text-gray-400 text-sm">Avg Power</p>
                <p className="text-2xl font-bold text-green-400">
                  {nftsLoading ? '...' : (playerNFTsData?.data?.length 
                    ? (playerNFTsData.data.reduce((sum, nft) => {
                        const power = nft.total_power ?? parseFloat(nft.rarity_score || "0");
                        return sum + (Number.isFinite(power) ? power : 0);
                      }, 0) / playerNFTsData.data.length).toFixed(0)
                    : 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Collections Tabs */}
        <Card className="bg-slate-800/50 border-purple-500/30">
          <CardContent className="p-6">
            <Tabs value={activeCollection} onValueChange={setActiveCollection}>
              <TabsList className="grid grid-cols-3 lg:grid-cols-6 gap-2 bg-transparent h-auto p-0 mb-6">
                {Object.entries(COLLECTION_CONFIG).map(([name, config]) => {
                  const Icon = config.icon;
                  const nftCount = nftsByCollection[name]?.length || 0;
                  
                  return (
                    <TabsTrigger
                      key={name}
                      value={name}
                      className={`
                        flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all
                        ${activeCollection === name 
                          ? `bg-gradient-to-r ${config.color} border-white shadow-lg` 
                          : 'bg-slate-700/30 border-slate-600 hover:border-slate-500'}
                      `}
                    >
                      <Icon className="w-6 h-6" />
                      <div className="text-xs font-medium text-center leading-tight">
                        {name}
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {nftCount} NFT{nftCount !== 1 ? 's' : ''}
                      </Badge>
                    </TabsTrigger>
                  );
                })}
                
                {/* Partner NFTs Tab */}
                <TabsTrigger
                  value="Partner NFTs"
                  className={`
                    flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all
                    ${activeCollection === 'Partner NFTs'
                      ? 'bg-gradient-to-r from-pink-500 to-rose-500 border-white shadow-lg' 
                      : 'bg-slate-700/30 border-slate-600 hover:border-slate-500'}
                  `}
                >
                  <Users className="w-6 h-6" />
                  <div className="text-xs font-medium text-center leading-tight">
                    Partner NFTs
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {Object.entries(nftsByCollection).filter(([name]) => 
                      !Object.keys(COLLECTION_CONFIG).includes(name)
                    ).reduce((sum, [, nfts]) => sum + nfts.length, 0)} NFT
                  </Badge>
                </TabsTrigger>
              </TabsList>

              {/* Search Bar */}
              <div className="mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    type="text"
                    placeholder="Search NFTs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-gray-400"
                  />
                </div>
              </div>

              {/* Sub-Tabs */}
              <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
                <TabsList className="grid grid-cols-4 w-full max-w-lg mx-auto mb-6 bg-slate-700/30">
                  <TabsTrigger value="gallery">Gallery</TabsTrigger>
                  <TabsTrigger value="battle">Battle</TabsTrigger>
                  <TabsTrigger value="powers">Powers</TabsTrigger>
                  <TabsTrigger value="arsenal">Arsenal</TabsTrigger>
                </TabsList>

                <TabsContent value="gallery">
                  {nftsLoading ? (
                    <div className="text-center py-12">
                      <p className="text-gray-400">Loading NFTs...</p>
                    </div>
                  ) : filteredNFTs.length === 0 ? (
                    <div className="text-center py-12">
                      <Target className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-400 text-lg mb-2">No NFTs in this collection</p>
                      <p className="text-gray-500 text-sm">{handle} hasn't acquired any {activeCollection} NFTs yet</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {filteredNFTs.map((nft) => (
                        <InquisitionNFTCard 
                          key={nft.nft_id} 
                          nft={nft}
                          onClick={() => {
                            setSelectedNFT(nft);
                            setNFTDetailOpen(true);
                          }}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="battle">
                  {battlesLoading ? (
                    <div className="text-center py-12">
                      <p className="text-gray-400">Loading battle history...</p>
                    </div>
                  ) : battleHistoryData?.stats ? (
                    <div className="space-y-6">
                      {/* Battle Stats Summary */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="bg-slate-700/30 border-slate-600">
                          <CardContent className="p-4 text-center">
                            <Swords className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                            <p className="text-2xl font-bold text-white">
                              {battleHistoryData.stats.total_battles}
                            </p>
                            <p className="text-sm text-gray-400">Total Battles</p>
                          </CardContent>
                        </Card>
                        <Card className="bg-slate-700/30 border-slate-600">
                          <CardContent className="p-4 text-center">
                            <TrendingUp className="w-8 h-8 text-green-400 mx-auto mb-2" />
                            <p className="text-2xl font-bold text-green-400">
                              {battleHistoryData.stats.battles_won}
                            </p>
                            <p className="text-sm text-gray-400">Victories</p>
                          </CardContent>
                        </Card>
                        <Card className="bg-slate-700/30 border-slate-600">
                          <CardContent className="p-4 text-center">
                            <TrendingDown className="w-8 h-8 text-red-400 mx-auto mb-2" />
                            <p className="text-2xl font-bold text-red-400">
                              {battleHistoryData.stats.battles_lost}
                            </p>
                            <p className="text-sm text-gray-400">Defeats</p>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Win Rate */}
                      {battleHistoryData.stats.total_battles > 0 && (
                        <Card className="bg-slate-700/30 border-slate-600">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-gray-400">Win Rate</span>
                              <span className="text-white font-bold">
                                {((battleHistoryData.stats.battles_won / battleHistoryData.stats.total_battles) * 100).toFixed(1)}%
                              </span>
                            </div>
                            <div className="w-full bg-slate-800 rounded-full h-3">
                              <div 
                                className="bg-gradient-to-r from-green-500 to-green-400 h-3 rounded-full transition-all"
                                style={{ 
                                  width: `${(battleHistoryData.stats.battles_won / battleHistoryData.stats.total_battles) * 100}%` 
                                }}
                              />
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Battle History List */}
                      {battleHistoryData?.battles && battleHistoryData.battles.length > 0 ? (
                        <div className="space-y-3">
                          <h3 className="text-lg font-semibold text-white">Recent Battles</h3>
                          {battleHistoryData.battles.map((battle: any) => (
                            <Card key={battle.id} className="bg-slate-700/30 border-slate-600 hover:border-purple-500/50 transition-colors">
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Badge className={
                                        battle.status === 'completed' 
                                          ? battle.winner_player_id 
                                            ? 'bg-green-600 text-white' 
                                            : 'bg-gray-600 text-white'
                                          : battle.status === 'in_progress'
                                            ? 'bg-yellow-600 text-white'
                                            : 'bg-blue-600 text-white'
                                      }>
                                        {battle.status === 'completed' ? 'Completed' : battle.status === 'in_progress' ? 'In Progress' : 'Waiting'}
                                      </Badge>
                                      <Badge variant="outline" className="text-purple-400 border-purple-400">
                                        {battle.combat_type}
                                      </Badge>
                                    </div>
                                    <p className="text-white font-medium">
                                      {battle.is_ai_battle ? 'vs AI Opponent' : 'vs Player'}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1 text-sm text-gray-400">
                                      <Calendar className="w-3 h-3" />
                                      {new Date(battle.created_at).toLocaleDateString()}
                                    </div>
                                  </div>
                                  {battle.status === 'in_progress' && (
                                    <Link href={`/inquisition/battles`}>
                                      <Button variant="outline" size="sm" className="border-purple-500 text-purple-400 hover:bg-purple-500/10">
                                        View Battle
                                      </Button>
                                    </Link>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <Swords className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                          <p className="text-gray-400">No battles yet</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Swords className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-400 text-lg mb-2">No Battle Data</p>
                      <p className="text-gray-500 text-sm">{handle} hasn't participated in any battles yet</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="powers">
                  <div className="grid gap-4">
                    {filteredNFTs.map((nft) => (
                      <Card key={nft.nft_id} className="bg-slate-700/30 border-slate-600">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-4">
                            <img 
                              src={nft.image_url} 
                              alt={nft.name || "NFT"} 
                              className="w-20 h-20 rounded-lg object-cover"
                            />
                            <div className="flex-1">
                              <h3 className="text-white font-semibold mb-2">{nft.name || "Unnamed NFT"}</h3>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <p className="text-xs text-gray-400">Army</p>
                                  <p className="text-sm font-bold text-red-400">{nft.army_power || 0}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-400">Religion</p>
                                  <p className="text-sm font-bold text-yellow-400">{nft.religion_power || 0}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-400">Civilization</p>
                                  <p className="text-sm font-bold text-blue-400">{nft.civilization_power || 0}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-400">Economic</p>
                                  <p className="text-sm font-bold text-green-400">{nft.economic_power || 0}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="arsenal">
                  <div className="text-center py-12">
                    <Axe className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400 text-lg mb-2">Arsenal</p>
                    <p className="text-gray-500 text-sm">View {handle}'s weapons and equipment</p>
                  </div>
                </TabsContent>
              </Tabs>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* NFT Detail Modal */}
      <Dialog open={nftDetailOpen} onOpenChange={setNFTDetailOpen}>
        <DialogContent className="bg-slate-900 border-purple-500/30 text-white max-w-[95vw] sm:max-w-5xl max-h-[90vh] overflow-y-auto">
          {selectedNFT && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl text-purple-400 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Shield className="w-6 h-6" />
                    {selectedNFT.name}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setNFTDetailOpen(false)}
                    className="text-gray-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </DialogTitle>
              </DialogHeader>

              <div className="grid md:grid-cols-2 gap-6 py-4">
                {/* Left: Image */}
                <div className="space-y-4">
                  <div className="relative aspect-square rounded-lg overflow-hidden border-2 border-purple-500/30">
                    <img 
                      src={(selectedNFT as any).ai_generated_image_url || selectedNFT.image_url} 
                      alt={selectedNFT.name}
                      className="w-full h-full object-cover"
                    />
                    {(selectedNFT as any).ai_generated_image_url && (
                      <div className="absolute top-2 right-2 bg-purple-600 text-white px-2 py-1 rounded-md text-xs font-semibold flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        AI Enhanced
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Details */}
                <div className="space-y-4">
                  {/* Collection & Role */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-400 mb-2">Collection</h3>
                    <Badge className="bg-blue-600">
                      {selectedNFT.collection_name}
                    </Badge>
                    <Badge className="ml-2 bg-purple-600">
                      {selectedNFT.game_role}
                    </Badge>
                  </div>

                  {/* Material & Class (if Inquisition) */}
                  {selectedNFT.collection_name === "The Inquisition" && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-400 mb-2">Character Info</h3>
                      <div className="flex gap-2">
                        {selectedNFT.material_type && (
                          <Badge className="bg-amber-600">
                            {selectedNFT.material_type}
                          </Badge>
                        )}
                        {selectedNFT.character_class && (
                          <Badge className="bg-teal-600">
                            {selectedNFT.character_class}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Power Stats */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-400 mb-2">Power Stats</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-slate-800/50 p-2 rounded">
                        <p className="text-xs text-gray-400">Total Power</p>
                        <p className="text-lg font-bold text-purple-400">{selectedNFT.total_power || 0}</p>
                      </div>
                      <div className="bg-slate-800/50 p-2 rounded">
                        <p className="text-xs text-gray-400">Rarity</p>
                        <p className="text-lg font-bold text-gold-400">{selectedNFT.rarity_score}</p>
                      </div>
                      <div className="bg-slate-800/50 p-2 rounded">
                        <p className="text-xs text-gray-400">Army</p>
                        <p className="text-lg font-bold text-red-400">{selectedNFT.army_power || 0}</p>
                      </div>
                      <div className="bg-slate-800/50 p-2 rounded">
                        <p className="text-xs text-gray-400">Religion</p>
                        <p className="text-lg font-bold text-amber-400">{selectedNFT.religion_power || 0}</p>
                      </div>
                      <div className="bg-slate-800/50 p-2 rounded">
                        <p className="text-xs text-gray-400">Civilization</p>
                        <p className="text-lg font-bold text-blue-400">{selectedNFT.civilization_power || 0}</p>
                      </div>
                      <div className="bg-slate-800/50 p-2 rounded">
                        <p className="text-xs text-gray-400">Economic</p>
                        <p className="text-lg font-bold text-green-400">{selectedNFT.economic_power || 0}</p>
                      </div>
                    </div>
                  </div>

                  {/* Traits */}
                  {selectedNFT.traits && Object.keys(selectedNFT.traits).length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-400 mb-2">Traits & Attributes</h3>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {Object.entries(selectedNFT.traits).map(([key, value]) => (
                          <div key={key} className="bg-slate-800/50 p-2 rounded flex justify-between">
                            <span className="text-gray-300 text-sm">{key}</span>
                            <span className="text-white text-sm font-medium">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  {selectedNFT.description && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-400 mb-2">Description</h3>
                      <p className="text-gray-300 text-sm">{selectedNFT.description}</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
