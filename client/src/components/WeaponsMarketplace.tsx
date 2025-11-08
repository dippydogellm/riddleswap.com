import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { 
  Search, 
  Swords, 
  Shield, 
  Zap, 
  Crown, 
  RefreshCw,
  Star,
  Coins,
  TrendingUp,
  ShoppingCart
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface Weapon {
  id: string;
  name: string;
  category: string;
  weaponType: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  description: string;
  baseImageUrl?: string;
  baseDamage: number;
  baseDefense: number;
  baseSpeed: number;
  baseDurability: number;
  maxSupply: number;
  currentSupply: number;
  isActive: boolean;
  techLevels: string[];
}

interface WeaponListing {
  id: string;
  weaponId: string;
  sellerId: string;
  priceDrops: number;
  originalPrice: number;
  status: string;
  expiresAt: string;
  weapon: {
    name: string;
    category: string;
    weaponType: string;
    rarity: string;
    description: string;
    imageUrl?: string;
    techLevel: string;
    colorScheme: string;
    baseDamage: number;
    baseDefense: number;
  };
}

const WeaponCard = ({ weapon, type, onPurchase, isPurchasing }: { 
  weapon: Weapon | WeaponListing; 
  type: 'definition' | 'listing';
  onPurchase?: (listing: WeaponListing) => void;
  isPurchasing?: boolean;
}) => {
  const getRarityColor = (rarity: string) => {
    switch (rarity.toLowerCase()) {
      case 'common': return 'bg-gray-500';
      case 'rare': return 'bg-blue-500';
      case 'epic': return 'bg-purple-500';
      case 'legendary': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  const getWeaponIcon = (weaponType: string) => {
    switch (weaponType.toLowerCase()) {
      case 'sword': return <Swords className="h-4 w-4" />;
      case 'shield': 
      case 'armor': return <Shield className="h-4 w-4" />;
      case 'bow':
      case 'staff': return <Zap className="h-4 w-4" />;
      default: return <Swords className="h-4 w-4" />;
    }
  };

  if (type === 'definition') {
    const weaponDef = weapon as Weapon;
    return (
      <Card className="bg-gradient-to-br from-slate-700/90 to-slate-800/90 border-orange-500/30 hover:border-orange-400/50 transition-all duration-300 hover:scale-105">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getWeaponIcon(weaponDef.weaponType)}
              <CardTitle className="text-orange-300 text-lg font-mono">
                {weaponDef.name}
              </CardTitle>
            </div>
            <Badge className={`${getRarityColor(weaponDef.rarity)} text-white text-xs`}>
              {weaponDef.rarity.toUpperCase()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Weapon Image Placeholder */}
          <div className="aspect-square bg-slate-600/50 rounded-lg flex items-center justify-center border border-orange-500/20">
            {weaponDef.baseImageUrl ? (
              <img 
                src={weaponDef.baseImageUrl} 
                alt={weaponDef.name}
                className="w-full h-full object-cover rounded-lg"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
              />
            ) : null}
            <div className={`text-orange-400 text-4xl ${weaponDef.baseImageUrl ? 'hidden' : ''}`}>
              {getWeaponIcon(weaponDef.weaponType)}
            </div>
          </div>

          {/* Weapon Stats */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">ATK:</span>
              <span className="text-red-400 font-mono">{weaponDef.baseDamage}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">DEF:</span>
              <span className="text-blue-400 font-mono">{weaponDef.baseDefense}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">SPD:</span>
              <span className="text-green-400 font-mono">{weaponDef.baseSpeed}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">DUR:</span>
              <span className="text-yellow-400 font-mono">{weaponDef.baseDurability}</span>
            </div>
          </div>

          {/* Supply Info */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Supply:</span>
              <span className="text-cyan-400 font-mono">
                {weaponDef.currentSupply}/{weaponDef.maxSupply}
              </span>
            </div>
            <div className="w-full bg-slate-600 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-orange-500 to-red-500 h-2 rounded-full transition-all"
                style={{ width: `${(weaponDef.currentSupply / weaponDef.maxSupply) * 100}%` }}
              />
            </div>
          </div>

          {/* Description */}
          <p className="text-slate-300 text-xs line-clamp-2">
            {weaponDef.description}
          </p>

          {/* Action Button */}
          <Button 
            className="w-full bg-orange-600 hover:bg-orange-700 text-white"
            size="sm"
            data-testid={`button-mint-${weaponDef.id}`}
          >
            <Crown className="h-3 w-3 mr-2" />
            Forge Weapon
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Marketplace listing card
  const listing = weapon as WeaponListing;
  return (
    <Card className="bg-gradient-to-br from-slate-700/90 to-slate-800/90 border-green-500/30 hover:border-green-400/50 transition-all duration-300 hover:scale-105">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getWeaponIcon(listing.weapon.weaponType)}
            <CardTitle className="text-green-300 text-lg font-mono">
              {listing.weapon.name}
            </CardTitle>
          </div>
          <Badge className={`${getRarityColor(listing.weapon.rarity)} text-white text-xs`}>
            {listing.weapon.rarity.toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Weapon Image Placeholder */}
        <div className="aspect-square bg-slate-600/50 rounded-lg flex items-center justify-center border border-green-500/20">
          {listing.weapon.imageUrl ? (
            <img 
              src={listing.weapon.imageUrl} 
              alt={listing.weapon.name}
              className="w-full h-full object-cover rounded-lg"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : null}
          <div className={`text-green-400 text-4xl ${listing.weapon.imageUrl ? 'hidden' : ''}`}>
            {getWeaponIcon(listing.weapon.weaponType)}
          </div>
        </div>

        {/* Weapon Stats */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-400">ATK:</span>
            <span className="text-red-400 font-mono">{listing.weapon.baseDamage}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">DEF:</span>
            <span className="text-blue-400 font-mono">{listing.weapon.baseDefense}</span>
          </div>
        </div>

        {/* Price Info */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Price:</span>
            <span className="text-green-400 font-mono">
              {listing.priceDrops} XRP
            </span>
          </div>
          {listing.originalPrice !== listing.priceDrops && (
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Original:</span>
              <span className="text-slate-500 line-through font-mono">
                {listing.originalPrice} XRP
              </span>
            </div>
          )}
        </div>

        {/* Description */}
        <p className="text-slate-300 text-xs line-clamp-2">
          {listing.weapon.description}
        </p>

        {/* Action Button */}
        <Button 
          className="w-full bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
          size="sm"
          data-testid={`button-buy-${listing.id}`}
          onClick={() => onPurchase?.(listing)}
          disabled={isPurchasing}
        >
          {isPurchasing ? (
            <RefreshCw className="h-3 w-3 mr-2 animate-spin" />
          ) : (
            <ShoppingCart className="h-3 w-3 mr-2" />
          )}
          {isPurchasing ? 'Processing...' : `Buy Now - ${listing.priceDrops} XRP`}
        </Button>
      </CardContent>
    </Card>
  );
};

export const WeaponsMarketplace = () => {
  const [activeTab, setActiveTab] = useState('definitions');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'rarity' | 'price' | 'damage'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [purchasingWeapon, setPurchasingWeapon] = useState<string | null>(null);
  const { toast } = useToast();

  // Handle weapon purchase - simple payment to bank wallet to mint NFT
  const handleWeaponPurchase = async (listing: WeaponListing) => {
    if (purchasingWeapon) return; // Prevent double clicks
    
    try {
      setPurchasingWeapon(listing.id);
      
      toast({
        title: "Processing Payment",
        description: `Purchasing ${listing.weapon.name} for ${listing.priceDrops} XRP...`
      });

      // Call backend to process payment to bank wallet and mint weapon NFT
      // Backend validates listing and price server-side for security
      const response = await apiRequest('/api/nft-gaming/purchase-weapon', {
        method: 'POST',
        body: JSON.stringify({
          listing_id: listing.id
        })
      });

      if (!response.ok) {
        const errorData = await response.json() as any;
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to process purchase`);
      }

      const result = await response.json() as any;
      
      if (result.success) {
        toast({
          title: "Weapon Purchased!",
          description: `${listing.weapon.name} has been minted to your wallet. Transaction: ${result.txHash || 'Processing'}`,
          duration: 5000
        });
        
        // Invalidate and refetch weapon listings to remove purchased item
        queryClient.invalidateQueries({ queryKey: ['weapons', 'marketplace'] });
      } else {
        throw new Error(result.error || 'Purchase failed');
      }
    } catch (error) {
      console.error('Weapon purchase failed:', error);
      toast({
        title: "Purchase Failed",
        description: error instanceof Error ? error.message : 'Failed to purchase weapon',
        variant: "destructive",
        duration: 5000
      });
    } finally {
      setPurchasingWeapon(null);
    }
  };

  // Fetch weapon definitions
  const { data: weaponDefinitions, isLoading: loadingDefinitions, refetch: refetchDefinitions } = useQuery({
    queryKey: ['weapons', 'definitions'],
    queryFn: async () => {
      const response = await fetch('/api/gaming/weapons/definitions');
      if (!response.ok) throw new Error('Failed to fetch weapon definitions');
      return response.json();
    }
  });

  // Fetch weapon marketplace listings
  const { data: weaponListings, isLoading: loadingListings, refetch: refetchListings } = useQuery({
    queryKey: ['weapons', 'marketplace'],
    queryFn: async () => {
      const response = await fetch('/api/gaming/weapons/marketplace');
      if (!response.ok) throw new Error('Failed to fetch weapon listings');
      return response.json();
    }
  });

  const handleRefresh = () => {
    refetchDefinitions();
    refetchListings();
  };

  // Rarity ordering for sorting
  const rarityOrder = { common: 1, rare: 2, epic: 3, legendary: 4 };

  // Sort and filter definitions
  const filteredDefinitions = (weaponDefinitions?.weapons?.filter((weapon: Weapon) =>
    weapon.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    weapon.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    weapon.weaponType.toLowerCase().includes(searchQuery.toLowerCase()) ||
    weapon.rarity.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []).sort((a: Weapon, b: Weapon) => {
    let comparison = 0;
    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'rarity':
        comparison = rarityOrder[a.rarity] - rarityOrder[b.rarity];
        break;
      case 'damage':
        comparison = a.baseDamage - b.baseDamage;
        break;
      default:
        comparison = 0;
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  // Sort and filter listings
  const filteredListings = (weaponListings?.listings?.filter((listing: WeaponListing) =>
    listing.weapon.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    listing.weapon.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    listing.weapon.weaponType.toLowerCase().includes(searchQuery.toLowerCase()) ||
    listing.weapon.rarity.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []).sort((a: WeaponListing, b: WeaponListing) => {
    let comparison = 0;
    switch (sortBy) {
      case 'name':
        comparison = a.weapon.name.localeCompare(b.weapon.name);
        break;
      case 'rarity':
        comparison = rarityOrder[a.weapon.rarity.toLowerCase() as keyof typeof rarityOrder] - 
                     rarityOrder[b.weapon.rarity.toLowerCase() as keyof typeof rarityOrder];
        break;
      case 'price':
        comparison = a.priceDrops - b.priceDrops;
        break;
      case 'damage':
        comparison = a.weapon.baseDamage - b.weapon.baseDamage;
        break;
      default:
        comparison = 0;
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  return (
    <div className="space-y-4">
      {/* Search and Controls */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
            <Input
              placeholder="Search weapons, armor, categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-slate-800/50 border-slate-600 text-slate-200 placeholder-slate-400"
              data-testid="input-weapon-search"
            />
          </div>
          <Button
            onClick={handleRefresh}
            variant="outline"
            size="sm"
            className="border-orange-500/30 text-orange-300 hover:bg-orange-500/10"
            data-testid="button-refresh-weapons"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Sort Controls */}
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-300 text-sm mb-2 block">Sort By</Label>
              <Select 
                value={activeTab === 'definitions' && sortBy === 'price' ? 'name' : sortBy} 
                onValueChange={(value: any) => setSortBy(value)}
              >
                <SelectTrigger className="bg-slate-800/50 border-slate-600 text-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="rarity">Rarity</SelectItem>
                  <SelectItem value="damage">Damage</SelectItem>
                  {activeTab === 'marketplace' && <SelectItem value="price">Price</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-300 text-sm mb-2 block">Order</Label>
              <Select value={sortOrder} onValueChange={(value: any) => setSortOrder(value)}>
                <SelectTrigger className="bg-slate-800/50 border-slate-600 text-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Ascending</SelectItem>
                  <SelectItem value="desc">Descending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 bg-slate-800/50 border-slate-600/30">
          <TabsTrigger 
            value="definitions" 
            className="data-[state=active]:bg-orange-600 text-slate-200"
            data-testid="tab-weapon-definitions"
          >
            <Swords className="h-4 w-4 mr-2" />
            Weapon Forge
          </TabsTrigger>
          <TabsTrigger 
            value="marketplace" 
            className="data-[state=active]:bg-green-600 text-slate-200"
            data-testid="tab-weapon-marketplace"
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            Marketplace
          </TabsTrigger>
        </TabsList>

        {/* Weapon Definitions Tab */}
        <TabsContent value="definitions" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-mono text-orange-300">Available Weapon Blueprints</h3>
            <Badge variant="outline" className="border-orange-500/30 text-orange-300">
              {filteredDefinitions.length} weapons
            </Badge>
          </div>

          {loadingDefinitions ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Card key={i} className="bg-slate-800/50">
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4 bg-slate-600" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="aspect-square bg-slate-600 mb-4" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full bg-slate-600" />
                      <Skeleton className="h-4 w-2/3 bg-slate-600" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredDefinitions.map((weapon: Weapon) => (
                <WeaponCard key={weapon.id} weapon={weapon} type="definition" />
              ))}
            </div>
          )}

          {!loadingDefinitions && filteredDefinitions.length === 0 && (
            <div className="text-center py-8">
              <Swords className="h-12 w-12 text-slate-500 mx-auto mb-4" />
              <p className="text-slate-400">No weapons found matching your search</p>
            </div>
          )}
        </TabsContent>

        {/* Marketplace Tab */}
        <TabsContent value="marketplace" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-mono text-green-300">Weapons for Sale</h3>
            <Badge variant="outline" className="border-green-500/30 text-green-300">
              {filteredListings.length} listings
            </Badge>
          </div>

          {loadingListings ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="bg-slate-800/50">
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4 bg-slate-600" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="aspect-square bg-slate-600 mb-4" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full bg-slate-600" />
                      <Skeleton className="h-4 w-2/3 bg-slate-600" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredListings.map((listing: WeaponListing) => (
                <WeaponCard 
                  key={listing.id} 
                  weapon={listing} 
                  type="listing" 
                  onPurchase={handleWeaponPurchase}
                  isPurchasing={purchasingWeapon === listing.id}
                />
              ))}
            </div>
          )}

          {!loadingListings && filteredListings.length === 0 && (
            <div className="text-center py-8">
              <ShoppingCart className="h-12 w-12 text-slate-500 mx-auto mb-4" />
              <p className="text-slate-400">No weapons currently for sale</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WeaponsMarketplace;
