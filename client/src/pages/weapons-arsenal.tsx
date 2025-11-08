import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/utils/sessionManager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sword, Shield, Hammer, Search, Filter, SortAsc, ExternalLink, ShoppingBag } from "lucide-react";
import { Link } from "wouter";

export default function WeaponsArsenal() {
  const session = useSession();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("power");
  const [filterRarity, setFilterRarity] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const { data: nftData, isLoading } = useQuery<any>({
    queryKey: [`/api/inquisition-audit/player/nfts?handle=${session.handle}`],
    enabled: !!session.handle,
  });

  // Filter weapons (The Lost Emporium collection)
  const weapons = nftData?.data?.filter((nft: any) => 
    nft.collection_name === "The Lost Emporium" || 
    nft.game_role === "merchant" ||
    nft.game_role === "weapons"
  ) || [];

  // Apply search and filters
  const filteredWeapons = weapons
    .filter((weapon: any) => {
      const matchesSearch = weapon.nft_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           weapon.nft_id?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRarity = filterRarity === "all" || weapon.rarity?.toLowerCase() === filterRarity.toLowerCase();
      return matchesSearch && matchesRarity;
    })
    .sort((a: any, b: any) => {
      if (sortBy === "power") return (b.total_power || 0) - (a.total_power || 0);
      if (sortBy === "name") return (a.nft_name || "").localeCompare(b.nft_name || "");
      if (sortBy === "rarity") return (b.rarity_score || 0) - (a.rarity_score || 0);
      return 0;
    });

  const totalPower = weapons.reduce((sum: number, w: any) => sum + (w.total_power || 0), 0);
  const averagePower = weapons.length > 0 ? Math.round(totalPower / weapons.length) : 0;

  if (!session.handle) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-orange-950 to-slate-950 flex items-center justify-center p-4">
        <Card className="bg-slate-900/80 border-orange-500/30 max-w-md">
          <CardContent className="p-8 text-center">
            <Hammer className="w-16 h-16 text-orange-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Login Required</h2>
            <p className="text-gray-400 mb-4">Please login to access your weapons arsenal</p>
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-orange-950 to-slate-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent mb-2">
              ⚔️ Weapons Arsenal
            </h1>
            <p className="text-gray-400">
              Manage your weapons and arsenal items from all gaming collections
            </p>
          </div>
          <Link href="/nft-marketplace?collection=The Lost Emporium">
            <Button className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700">
              <ShoppingBag className="w-4 h-4 mr-2" />
              Browse Marketplace
            </Button>
          </Link>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-slate-900/80 border-orange-500/30">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                  <Sword className="w-6 h-6 text-orange-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Total Weapons</p>
                  <p className="text-2xl font-bold text-white">{weapons.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-orange-500/30">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-red-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Total Power</p>
                  <p className="text-2xl font-bold text-white">{totalPower.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-orange-500/30">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <Hammer className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Avg Power</p>
                  <p className="text-2xl font-bold text-white">{averagePower}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-orange-500/30">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <span className="text-2xl">✨</span>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Equipped</p>
                  <p className="text-2xl font-bold text-white">
                    {weapons.filter((w: any) => w.equipped).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card className="bg-slate-900/80 border-orange-500/30">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search weapons by name or ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-slate-800 border-slate-700 text-white"
                  />
                </div>
              </div>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SortAsc className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="power">Sort by Power</SelectItem>
                  <SelectItem value="name">Sort by Name</SelectItem>
                  <SelectItem value="rarity">Sort by Rarity</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterRarity} onValueChange={setFilterRarity}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Rarities</SelectItem>
                  <SelectItem value="common">Common</SelectItem>
                  <SelectItem value="uncommon">Uncommon</SelectItem>
                  <SelectItem value="rare">Rare</SelectItem>
                  <SelectItem value="epic">Epic</SelectItem>
                  <SelectItem value="legendary">Legendary</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 mt-4">
              <Button
                variant={viewMode === "grid" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("grid")}
                className={viewMode === "grid" ? "bg-orange-500" : ""}
              >
                Grid View
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("list")}
                className={viewMode === "list" ? "bg-orange-500" : ""}
              >
                List View
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Weapons Display */}
        {isLoading ? (
          <Card className="bg-slate-900/80 border-orange-500/30">
            <CardContent className="p-12 text-center">
              <div className="animate-spin w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-gray-400">Loading your arsenal...</p>
            </CardContent>
          </Card>
        ) : filteredWeapons.length === 0 ? (
          <Card className="bg-slate-900/80 border-orange-500/30">
            <CardContent className="p-12 text-center">
              <Hammer className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">No Weapons Found</h3>
              <p className="text-gray-400 mb-6">
                {weapons.length === 0 
                  ? "You don't have any weapons yet. Visit the marketplace to acquire some!"
                  : "No weapons match your search criteria."}
              </p>
              {weapons.length === 0 && (
                <Link href="/nft-marketplace?collection=The Lost Emporium">
                  <Button className="bg-gradient-to-r from-orange-500 to-red-600">
                    Browse Weapons
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className={viewMode === "grid" 
            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            : "space-y-4"
          }>
            {filteredWeapons.map((weapon: any) => (
              <WeaponCard key={weapon.nft_id} weapon={weapon} viewMode={viewMode} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface WeaponCardProps {
  weapon: any;
  viewMode: "grid" | "list";
}

function WeaponCard({ weapon, viewMode }: WeaponCardProps) {
  const getRarityColor = (rarity: string) => {
    const r = rarity?.toLowerCase();
    if (r === "legendary") return "from-amber-500 to-yellow-500";
    if (r === "epic") return "from-purple-500 to-pink-500";
    if (r === "rare") return "from-blue-500 to-cyan-500";
    if (r === "uncommon") return "from-green-500 to-emerald-500";
    return "from-gray-500 to-slate-500";
  };

  if (viewMode === "list") {
    return (
      <Card className="bg-slate-900/80 border-orange-500/30 hover:border-orange-500/60 transition-all">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <img 
              src={weapon.image_url || "/inquisition-logo.png"} 
              alt={weapon.nft_name}
              className="w-24 h-24 rounded-lg object-cover"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-bold text-white">{weapon.nft_name}</h3>
                {weapon.rarity && (
                  <Badge className={`bg-gradient-to-r ${getRarityColor(weapon.rarity)} text-white text-xs`}>
                    {weapon.rarity}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-gray-400 mb-2">ID: {weapon.nft_id?.slice(0, 16)}...</p>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-orange-400">⚔️ Power: {weapon.total_power || 0}</span>
                <span className="text-red-400">💥 Attack: {weapon.army_power || 0}</span>
                <span className="text-blue-400">🛡️ Defense: {weapon.religion_power || 0}</span>
              </div>
            </div>
            <Link href={`/gaming/nft-detail/${weapon.nft_id}`}>
              <Button variant="outline" className="border-orange-500/50 text-orange-400">
                View Details
                <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-900/80 border-orange-500/30 hover:border-orange-500/60 transition-all overflow-hidden group">
      <div className="relative aspect-square overflow-hidden">
        <img 
          src={weapon.image_url || "/inquisition-logo.png"} 
          alt={weapon.nft_name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
        />
        {weapon.rarity && (
          <Badge className={`absolute top-2 right-2 bg-gradient-to-r ${getRarityColor(weapon.rarity)} text-white`}>
            {weapon.rarity}
          </Badge>
        )}
        {weapon.equipped && (
          <Badge className="absolute top-2 left-2 bg-green-500 text-white">
            Equipped
          </Badge>
        )}
      </div>
      <CardContent className="p-4">
        <h3 className="text-lg font-bold text-white mb-1 truncate">{weapon.nft_name}</h3>
        <p className="text-xs text-gray-400 mb-3 truncate">ID: {weapon.nft_id}</p>
        
        <div className="space-y-2 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Total Power</span>
            <span className="text-orange-400 font-bold">{weapon.total_power || 0}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">⚔️ Attack</span>
            <span className="text-red-400">{weapon.army_power || 0}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">🛡️ Defense</span>
            <span className="text-blue-400">{weapon.religion_power || 0}</span>
          </div>
        </div>

        <Link href={`/gaming/nft-detail/${weapon.nft_id}`}>
          <Button className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700">
            View Details
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
