import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/utils/sessionManager";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sword, Shield, Search, Filter, SortAsc, ShoppingBag, Tag, AlertCircle, CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

export default function WeaponsMarketplace() {
  const session = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [filterRarity, setFilterRarity] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [listDialogOpen, setListDialogOpen] = useState(false);

  // Fetch marketplace listings
  const { data: marketplaceData, isLoading } = useQuery<any>({
    queryKey: ['/api/weapons/marketplace'],
  });

  // Fetch user's arsenal for selling
  const { data: arsenalData } = useQuery<any>({
    queryKey: ['/api/weapons/my-arsenal'],
    enabled: !!session.handle,
  });

  // Fetch user's active listings
  const { data: myListingsData } = useQuery<any>({
    queryKey: ['/api/weapons/marketplace/my-listings'],
    enabled: !!session.handle,
  });

  const listings = marketplaceData?.listings || [];
  const myWeapons = arsenalData?.weapons || [];
  const myListings = myListingsData?.listings || [];

  // Filter and sort listings
  const filteredListings = listings
    .filter((listing: any) => {
      const matchesSearch = listing.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           listing.customName?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRarity = filterRarity === "all" || listing.weaponRarity?.toLowerCase() === filterRarity.toLowerCase();
      const matchesType = filterType === "all" || listing.weaponType?.toLowerCase() === filterType.toLowerCase();
      return matchesSearch && matchesRarity && matchesType;
    })
    .sort((a: any, b: any) => {
      if (sortBy === "price-low") return (Number(a.priceDrops) / 1_000_000) - (Number(b.priceDrops) / 1_000_000);
      if (sortBy === "price-high") return (Number(b.priceDrops) / 1_000_000) - (Number(a.priceDrops) / 1_000_000);
      if (sortBy === "power") return (b.finalAttack + b.finalDefense) - (a.finalAttack + a.finalDefense);
      return new Date(b.listedAt).getTime() - new Date(a.listedAt).getTime(); // newest
    });

  const getRarityColor = (rarity: string) => {
    const r = rarity?.toLowerCase();
    if (r === "legendary") return "from-amber-500 to-yellow-500";
    if (r === "epic") return "from-purple-500 to-pink-500";
    if (r === "rare") return "from-blue-500 to-cyan-500";
    if (r === "uncommon") return "from-green-500 to-emerald-500";
    return "from-gray-500 to-slate-500";
  };

  if (!session.handle) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-orange-950 to-slate-950 flex items-center justify-center p-4">
        <Card className="bg-slate-900/80 border-orange-500/30 max-w-md">
          <CardContent className="p-8 text-center">
            <ShoppingBag className="w-16 h-16 text-orange-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Login Required</h2>
            <p className="text-gray-400 mb-4">Please login to access the weapons marketplace</p>
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
              ⚔️ Weapons Marketplace
            </h1>
            <p className="text-gray-400">
              Buy and sell legendary weapons and armor
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/weapons-arsenal">
              <Button variant="outline" className="border-orange-500/50 text-orange-400">
                <Shield className="w-4 h-4 mr-2" />
                My Arsenal
              </Button>
            </Link>
            <Dialog open={listDialogOpen} onOpenChange={setListDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700">
                  <Tag className="w-4 h-4 mr-2" />
                  Sell Weapon
                </Button>
              </DialogTrigger>
              <SellWeaponDialog 
                weapons={myWeapons}
                activeListings={myListings}
                onClose={() => setListDialogOpen(false)} 
              />
            </Dialog>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-slate-900/80 border-orange-500/30">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                  <ShoppingBag className="w-6 h-6 text-orange-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Total Listings</p>
                  <p className="text-2xl font-bold text-white">{listings.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-orange-500/30">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Tag className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">My Listings</p>
                  <p className="text-2xl font-bold text-white">{myListings.filter((l: any) => l.status === 'active').length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-orange-500/30">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <Sword className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Available to Sell</p>
                  <p className="text-2xl font-bold text-white">{myWeapons.length}</p>
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
                    placeholder="Search weapons..."
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
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                  <SelectItem value="power">Highest Power</SelectItem>
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
          </CardContent>
        </Card>

        {/* Marketplace Listings */}
        {isLoading ? (
          <Card className="bg-slate-900/80 border-orange-500/30">
            <CardContent className="p-12 text-center">
              <Loader2 className="w-12 h-12 border-4 text-orange-500 animate-spin mx-auto mb-4" />
              <p className="text-gray-400">Loading marketplace...</p>
            </CardContent>
          </Card>
        ) : filteredListings.length === 0 ? (
          <Card className="bg-slate-900/80 border-orange-500/30">
            <CardContent className="p-12 text-center">
              <ShoppingBag className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">No Weapons Found</h3>
              <p className="text-gray-400">
                {listings.length === 0 
                  ? "No weapons are currently listed on the marketplace"
                  : "No weapons match your search criteria"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredListings.map((listing: any) => (
              <WeaponListingCard key={listing.listingId} listing={listing} rarityColor={getRarityColor(listing.weaponRarity)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface WeaponListingCardProps {
  listing: any;
  rarityColor: string;
}

function WeaponListingCard({ listing, rarityColor }: WeaponListingCardProps) {
  const { toast } = useToast();
  const [showBuyDialog, setShowBuyDialog] = useState(false);
  const session = useSession();

  const priceXrp = Number(listing.priceDrops) / 1_000_000;
  const totalPower = (listing.finalAttack || 0) + (listing.finalDefense || 0);

  const buyMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/weapons/marketplace/buy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionToken}`
        },
        credentials: 'include',
        body: JSON.stringify({
          listingId: listing.listingId,
          buyerXrplAddress: session.handle // You'll need to get actual XRPL address
        })
      });

      if (!res.ok) {
        const error = await res.json() as any;
        throw new Error(error.error || 'Failed to initiate purchase');
      }

      return res.json();
    },
    onSuccess: (data) => {
      if (data.paymentRequired) {
        toast({
          title: "Payment Required",
          description: data.instruction,
          duration: 10000,
        });
        setShowBuyDialog(true);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Purchase Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  return (
    <Card className="bg-slate-900/80 border-orange-500/30 hover:border-orange-500/60 transition-all overflow-hidden group">
      <div className="relative aspect-square overflow-hidden">
        <img 
          src={listing.imageUrl || "/inquisition-logo.png"} 
          alt={listing.customName || listing.name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
        />
        {listing.weaponRarity && (
          <Badge className={`absolute top-2 right-2 bg-gradient-to-r ${rarityColor} text-white`}>
            {listing.weaponRarity}
          </Badge>
        )}
        <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full">
          <span className="text-amber-400 font-bold">
            {priceXrp} XRP
          </span>
        </div>
        {listing.techLevel && (
          <Badge className="absolute bottom-2 left-2 bg-purple-500/80 text-white">
            Tech Level {listing.techLevel}
          </Badge>
        )}
      </div>
      <CardContent className="p-4">
        <h3 className="text-lg font-bold text-white mb-1 truncate">
          {listing.customName || listing.name}
        </h3>
        <p className="text-sm text-gray-400 mb-3 truncate">
          {listing.weaponType} • Seller: {listing.sellerHandle}
        </p>
        
        <div className="space-y-2 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Total Power</span>
            <span className="text-orange-400 font-bold">{totalPower}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">⚔️ Attack</span>
            <span className="text-red-400">{listing.finalAttack || 0}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">🛡️ Defense</span>
            <span className="text-blue-400">{listing.finalDefense || 0}</span>
          </div>
        </div>

        {listing.description && (
          <p className="text-xs text-gray-500 mb-3 line-clamp-2">
            {listing.description}
          </p>
        )}

        <div className="flex gap-2">
          <Link href={`/weapon-detail/${listing.nftTokenId}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full border-orange-500/50 text-orange-400">
              <ExternalLink className="w-3 h-3 mr-1" />
              Details
            </Button>
          </Link>
          <Button 
            size="sm" 
            className="flex-1 bg-gradient-to-r from-orange-500 to-red-600"
            onClick={() => buyMutation.mutate()}
            disabled={buyMutation.isPending}
          >
            {buyMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>Buy Now</>
            )}
          </Button>
        </div>
      </CardContent>

      {/* Buy Payment Dialog */}
      <Dialog open={showBuyDialog} onOpenChange={setShowBuyDialog}>
        <DialogContent className="bg-slate-900 border-orange-500/30">
          <DialogHeader>
            <DialogTitle className="text-white">Complete Purchase</DialogTitle>
            <DialogDescription>
              Send payment to complete your weapon purchase
            </DialogDescription>
          </DialogHeader>
          {buyMutation.data?.paymentDetails && (
            <div className="space-y-4">
              <div className="bg-slate-800 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Amount:</span>
                  <span className="text-white font-bold">
                    {buyMutation.data.paymentDetails.amount} {buyMutation.data.paymentDetails.currency}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Recipient:</span>
                  <span className="text-white text-sm font-mono">
                    {buyMutation.data.paymentDetails.recipient}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Weapon:</span>
                  <span className="text-white">
                    {buyMutation.data.paymentDetails.weaponName}
                  </span>
                </div>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                <p className="text-amber-400 text-sm">
                  <AlertCircle className="w-4 h-4 inline mr-2" />
                  {buyMutation.data.instruction}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

interface SellWeaponDialogProps {
  weapons: any[];
  activeListings: any[];
  onClose: () => void;
}

function SellWeaponDialog({ weapons, activeListings, onClose }: SellWeaponDialogProps) {
  const session = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedWeapon, setSelectedWeapon] = useState("");
  const [priceXrp, setPriceXrp] = useState("");
  const [description, setDescription] = useState("");

  // Filter out weapons that are already listed
  const listedWeaponIds = new Set(activeListings.filter((l: any) => l.status === 'active').map((l: any) => l.weaponId));
  const availableWeapons = weapons.filter(w => !listedWeaponIds.has(w.weaponId));

  const listMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/weapons/marketplace/list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionToken}`
        },
        credentials: 'include',
        body: JSON.stringify({
          weaponId: selectedWeapon,
          priceXrp: parseFloat(priceXrp),
          description: description.trim() || undefined
        })
      });

      if (!res.ok) {
        const error = await res.json() as any;
        throw new Error(error.error || 'Failed to list weapon');
      }

      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "Your weapon has been listed on the marketplace",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/weapons/marketplace'] });
      queryClient.invalidateQueries({ queryKey: ['/api/weapons/marketplace/my-listings'] });
      onClose();
      setSelectedWeapon("");
      setPriceXrp("");
      setDescription("");
    },
    onError: (error: Error) => {
      toast({
        title: "Listing Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  return (
    <DialogContent className="bg-slate-900 border-orange-500/30 max-w-md">
      <DialogHeader>
        <DialogTitle className="text-white">List Weapon for Sale</DialogTitle>
        <DialogDescription>
          Choose a weapon from your arsenal to sell on the marketplace
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div>
          <Label htmlFor="weapon" className="text-white">Select Weapon</Label>
          <Select value={selectedWeapon} onValueChange={setSelectedWeapon}>
            <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
              <SelectValue placeholder="Choose a weapon..." />
            </SelectTrigger>
            <SelectContent>
              {availableWeapons.length === 0 ? (
                <SelectItem value="none" disabled>No weapons available</SelectItem>
              ) : (
                availableWeapons.map((weapon: any) => (
                  <SelectItem key={weapon.weaponId} value={weapon.weaponId}>
                    {weapon.customName || weapon.name} (Tech {weapon.techLevel})
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="price" className="text-white">Price (XRP)</Label>
          <Input
            id="price"
            type="number"
            step="0.01"
            min="0.01"
            value={priceXrp}
            onChange={(e) => setPriceXrp(e.target.value)}
            className="bg-slate-800 border-slate-700 text-white"
            placeholder="0.00"
          />
        </div>

        <div>
          <Label htmlFor="description" className="text-white">Description (Optional)</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="bg-slate-800 border-slate-700 text-white"
            placeholder="Add details about your weapon..."
            rows={3}
          />
        </div>

        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <p className="text-blue-400 text-sm">
            <AlertCircle className="w-4 h-4 inline mr-2" />
            Listings expire after 30 days. You can delist your weapon anytime.
          </p>
        </div>

        <Button
          className="w-full bg-gradient-to-r from-orange-500 to-red-600"
          onClick={() => listMutation.mutate()}
          disabled={!selectedWeapon || !priceXrp || listMutation.isPending}
        >
          {listMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Listing...
            </>
          ) : (
            <>
              <Tag className="w-4 h-4 mr-2" />
              List for {priceXrp || '0'} XRP
            </>
          )}
        </Button>
      </div>
    </DialogContent>
  );
}
