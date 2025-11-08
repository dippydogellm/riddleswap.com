import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, MapPin, ShoppingCart, Wallet, Coins, Sparkles, Info, CheckCircle } from "lucide-react";
import { sessionManager } from "@/utils/sessionManager";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";

interface LandPlot {
  id: string;
  plotNumber: number;
  gridSection: string;
  mapX: number;
  mapY: number;
  latitude: string;
  longitude: string;
  terrainType: string;
  terrainSubtype: string;
  plotSize: string;
  sizeMultiplier: string;
  currentPrice: string;
  rdlPrice: string;
  rdlDiscountPercent: number;
  status: string;
  specialFeatures: string[];
  resourceNodes: Record<string, any>;
  plotResources?: Record<string, any>;
  description: string;
  lore: string;
  ownerHandle?: string;
  generatedImageUrl?: string;
}

// Placeholder image based on terrain type
const getPlaceholderImage = (terrainType: string): string => {
  const placeholders: Record<string, string> = {
    plains: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=400&h=400&fit=crop',
    forest: 'https://images.unsplash.com/photo-1511497584788-876760111969?w=400&h=400&fit=crop',
    mountain: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=400&fit=crop',
    water: 'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=400&h=400&fit=crop',
    swamp: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=400&h=400&fit=crop',
    desert: 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=400&h=400&fit=crop',
    tundra: 'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?w=400&h=400&fit=crop'
  };
  return placeholders[terrainType] || placeholders.plains;
};

export default function LandMarketplace() {
  const [plots, setPlots] = useState<LandPlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlot, setSelectedPlot] = useState<LandPlot | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [modalImageFallback, setModalImageFallback] = useState(false);
  const [filters, setFilters] = useState({
    terrainType: 'all',
    plotSize: 'all',
    status: 'all',
    minPrice: '',
    maxPrice: '',
    plotNumber: '',
    hasSpecialFeatures: false,
    resourceType: 'all'
  });
  
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const session = sessionManager.getSession();

  // Reset fallback state when switching between plots
  useEffect(() => {
    setModalImageFallback(false);
    console.log(`🖼️ [LAND MODAL] Reset image fallback state for plot #${selectedPlot?.plotNumber || 'none'}`);
  }, [selectedPlot]);

  // Fetch land plots - Show ALL 1000 plots
  useEffect(() => {
    fetchPlots();
  }, [filters]);

  const fetchPlots = async () => {
    try {
      console.log('🏞️ [LAND] Fetching land plots with filters:', filters);
      setLoading(true);
      
      const params = new URLSearchParams();
      if (filters.status !== 'all') params.append('status', filters.status);
      if (filters.terrainType !== 'all') params.append('terrainType', filters.terrainType);
      if (filters.plotSize !== 'all') params.append('plotSize', filters.plotSize);
      if (filters.minPrice) params.append('minPrice', filters.minPrice);
      if (filters.maxPrice) params.append('maxPrice', filters.maxPrice);
      
      // Increase limit to show all available plots (no authentication required)
      params.append('limit', '1000');
      
      console.log('🔍 [LAND] API Request: /api/land/plots?' + params.toString());
      
      const response = await fetch(`/api/land/plots?${params.toString()}`);
      const data = await response.json() as any;
      
      console.log('📊 [LAND] API Response:', {
        success: data.success,
        plotsCount: data.plots?.length || 0,
        total: data.total
      });
      
      if (data.success) {
        console.log(`✅ [LAND] Loaded ${data.plots.length} plots out of ${data.total} total`);
        
        // Apply client-side filters for advanced filtering
        let filteredPlots = data.plots;
        
        // Filter by plot number
        if (filters.plotNumber) {
          const searchNum = parseInt(filters.plotNumber);
          filteredPlots = filteredPlots.filter((p: LandPlot) => p.plotNumber === searchNum);
        }
        
        // Filter by special features
        if (filters.hasSpecialFeatures) {
          filteredPlots = filteredPlots.filter((p: LandPlot) => 
            p.specialFeatures && p.specialFeatures.length > 0
          );
        }
        
        // Filter by resource type
        if (filters.resourceType !== 'all') {
          filteredPlots = filteredPlots.filter((p: LandPlot) => {
            if (!p.resourceNodes || typeof p.resourceNodes !== 'object') return false;
            const resources = Object.keys(p.resourceNodes).map(r => r.toLowerCase());
            return resources.some(r => r.includes(filters.resourceType.toLowerCase()));
          });
        }
        
        console.log(`🔍 [LAND] Applied client filters: ${filteredPlots.length} plots match`);
        setPlots(filteredPlots);
      } else {
        console.error('❌ [LAND] Failed to load plots:', data.error);
        toast({
          title: "Error",
          description: "Failed to load land plots",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('❌ [LAND] Network error fetching plots:', error);
      toast({
        title: "Error",
        description: "Failed to load land plots",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (plot: LandPlot, paymentMethod: 'XRP' | 'RDL') => {
    console.log(`🛒 [LAND PURCHASE] Starting purchase for plot #${plot.plotNumber} with ${paymentMethod}`);
    
    if (!session.isLoggedIn) {
      console.warn('⚠️ [LAND PURCHASE] User not logged in');
      toast({
        title: "Login Required",
        description: "Please login to purchase land",
        variant: "destructive"
      });
      setLocation('/login');
      return;
    }

    try {
      setPurchasing(true);
      console.log('🔐 [LAND PURCHASE] Retrieving session data...');
      
      const walletData = sessionManager.getWalletData();
      const buyerAddress = walletData?.xrpAddress;
      const buyerHandle = session.handle;

      console.log('👤 [LAND PURCHASE] Buyer info:', {
        handle: buyerHandle,
        address: buyerAddress,
        hasWallet: !!buyerAddress
      });

      if (!buyerAddress || !buyerHandle) {
        console.error('❌ [LAND PURCHASE] Missing wallet data');
        toast({
          title: "Wallet Required",
          description: "Please connect your XRPL wallet first",
          variant: "destructive"
        });
        setPurchasing(false);
        return;
      }

      console.log('💰 [LAND PURCHASE] Processing payment with cached keys...');
      console.log('📍 [LAND PURCHASE] Plot details:', {
        plotNumber: plot.plotNumber,
        price: paymentMethod === 'XRP' ? plot.currentPrice : plot.rdlPrice,
        currency: paymentMethod
      });

      // Execute purchase with cached wallet keys
      const purchaseResponse = await apiRequest('/api/land/purchase-with-cached-keys', {
        method: 'POST',
        body: JSON.stringify({
          plotNumber: plot.plotNumber,
          paymentMethod,
          buyerAddress,
          buyerHandle
        })
      });

      const purchaseData = await purchaseResponse.json();

      console.log('📦 [LAND PURCHASE] Purchase response:', purchaseData);

      if (!purchaseData.success) {
        console.error('❌ [LAND PURCHASE] Purchase failed:', purchaseData.error);
        toast({
          title: "Purchase Failed",
          description: purchaseData.error || "Failed to complete purchase",
          variant: "destructive"
        });
        setPurchasing(false);
        return;
      }

      console.log('✅ [LAND PURCHASE] Purchase successful!');
      console.log('🧾 [LAND PURCHASE] Transaction hash:', purchaseData.transactionHash);

      toast({
        title: "Land Purchased!",
        description: `You now own Plot #${plot.plotNumber}! Transaction: ${purchaseData.transactionHash?.slice(0, 10)}...`,
      });

      // Refresh plots to show updated ownership
      console.log('🔄 [LAND PURCHASE] Refreshing plot list...');
      await fetchPlots();
      setSelectedPlot(null);

    } catch (error: any) {
      console.error('❌ [LAND PURCHASE] Critical error:', error);
      console.error('📋 [LAND PURCHASE] Error details:', {
        message: error.message,
        stack: error.stack
      });
      
      toast({
        title: "Purchase Error",
        description: error.message || "Failed to process purchase",
        variant: "destructive"
      });
    } finally {
      setPurchasing(false);
      console.log('🏁 [LAND PURCHASE] Purchase flow complete');
    }
  };

  const getTerrainIcon = (terrain: string) => {
    const icons: Record<string, string> = {
      plains: '🌾',
      forest: '🌲',
      mountain: '⛰️',
      water: '🌊',
      swamp: '🌿',
      desert: '🏜️',
      tundra: '❄️'
    };
    return icons[terrain] || '🗺️';
  };

  return (
    <div className="min-h-screen bg-blue-950">
      {/* Header - Bold Blue */}
      <div className="bg-blue-900 border-b-4 border-blue-500 py-8">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white flex items-center gap-2 md:gap-3">
                🏰 Medieval Land Marketplace
              </h1>
              <p className="text-blue-200 mt-2 md:mt-3 text-sm md:text-base lg:text-lg font-semibold">
                Purchase land plots for The Trolls Inquisition game
              </p>
            </div>
            <div className="text-center md:text-right bg-yellow-600 p-4 md:p-6 rounded-lg border-4 border-yellow-400">
              <p className="text-xs md:text-sm text-yellow-100 font-bold">Available Plots</p>
              <p className="text-2xl md:text-4xl font-bold text-white">{plots.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8 space-y-6">
        {/* Filters - Bold Purple */}
        <Card className="bg-purple-900 border-purple-500 border-4">
          <CardHeader className="bg-purple-800 border-b-4 border-purple-500">
            <CardTitle className="flex items-center gap-2 text-white text-2xl font-bold">
              <Search className="w-6 h-6 text-yellow-400" />
              Search & Filter
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div>
                <Label className="text-purple-200 font-bold">Plot Number</Label>
                <Input
                  type="number"
                  placeholder="Search by #"
                  value={filters.plotNumber}
                  onChange={(e) => setFilters({...filters, plotNumber: e.target.value})}
                  className="bg-purple-800 border-purple-500 text-white font-semibold placeholder:text-purple-400"
                />
              </div>
              
              <div>
                <Label className="text-purple-200 font-bold">Terrain Type</Label>
                <Select 
                  value={filters.terrainType} 
                  onValueChange={(value) => setFilters({...filters, terrainType: value})}
                >
                  <SelectTrigger className="bg-purple-800 border-purple-500 text-white font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-purple-800 border-purple-500 text-white">
                    <SelectItem value="all">All Terrains</SelectItem>
                    <SelectItem value="plains">🌾 Plains</SelectItem>
                    <SelectItem value="forest">🌲 Forest</SelectItem>
                    <SelectItem value="mountain">⛰️ Mountain</SelectItem>
                    <SelectItem value="water">🌊 Water</SelectItem>
                    <SelectItem value="swamp">🌿 Swamp</SelectItem>
                    <SelectItem value="desert">🏜️ Desert</SelectItem>
                    <SelectItem value="tundra">❄️ Tundra</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-purple-200 font-bold">Plot Size</Label>
                <Select 
                  value={filters.plotSize} 
                  onValueChange={(value) => setFilters({...filters, plotSize: value})}
                >
                  <SelectTrigger className="bg-purple-800 border-purple-500 text-white font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-purple-800 border-purple-500 text-white">
                    <SelectItem value="all">All Sizes</SelectItem>
                    <SelectItem value="standard">Standard (1x)</SelectItem>
                    <SelectItem value="large">Large (1.5x)</SelectItem>
                    <SelectItem value="massive">Massive (2x)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-purple-200 font-bold">Status</Label>
                <Select 
                  value={filters.status} 
                  onValueChange={(value) => setFilters({...filters, status: value})}
                >
                  <SelectTrigger className="bg-purple-800 border-purple-500 text-white font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-purple-800 border-purple-500 text-white">
                    <SelectItem value="all">All Plots</SelectItem>
                    <SelectItem value="available">✅ Available Only</SelectItem>
                    <SelectItem value="owned">🏠 Owned</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-purple-200 font-bold">Min Price (XRP)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={filters.minPrice}
                  onChange={(e) => setFilters({...filters, minPrice: e.target.value})}
                  className="bg-purple-800 border-purple-500 text-white font-semibold placeholder:text-purple-400"
                />
              </div>

              <div>
                <Label className="text-purple-200 font-bold">Max Price (XRP)</Label>
                <Input
                  type="number"
                  placeholder="1000"
                  value={filters.maxPrice}
                  onChange={(e) => setFilters({...filters, maxPrice: e.target.value})}
                  className="bg-purple-800 border-purple-500 text-white font-semibold placeholder:text-purple-400"
                />
              </div>
            </div>

            {/* Secondary Filter Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div>
                <Label className="text-purple-200 font-bold">Resource Type</Label>
                <Select 
                  value={filters.resourceType} 
                  onValueChange={(value) => setFilters({...filters, resourceType: value})}
                >
                  <SelectTrigger className="bg-purple-800 border-purple-500 text-white font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-purple-800 border-purple-500 text-white">
                    <SelectItem value="all">All Resources</SelectItem>
                    <SelectItem value="wood">🪵 Wood</SelectItem>
                    <SelectItem value="stone">🪨 Stone</SelectItem>
                    <SelectItem value="iron">⚒️ Iron</SelectItem>
                    <SelectItem value="gold">💰 Gold</SelectItem>
                    <SelectItem value="food">🌾 Food</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <label className="flex items-center gap-2 bg-purple-800 p-3 rounded-lg border-2 border-purple-500 cursor-pointer hover:bg-purple-700 transition-colors">
                  <input
                    type="checkbox"
                    checked={filters.hasSpecialFeatures}
                    onChange={(e) => setFilters({...filters, hasSpecialFeatures: e.target.checked})}
                    className="w-4 h-4 accent-yellow-500"
                  />
                  <span className="text-white font-bold flex items-center gap-1">
                    <Sparkles className="w-4 h-4 text-yellow-400" />
                    Special Features Only
                  </span>
                </label>
              </div>

              <div className="flex items-end">
                <Button
                  onClick={() => setFilters({
                    terrainType: 'all',
                    plotSize: 'all',
                    status: 'all',
                    minPrice: '',
                    maxPrice: '',
                    plotNumber: '',
                    hasSpecialFeatures: false,
                    resourceType: 'all'
                  })}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold border-2 border-red-400"
                >
                  Clear All Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Land Plots Grid */}
        {loading ? (
          <div className="text-center py-12 bg-blue-900 border-4 border-blue-500 rounded-lg">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-yellow-400 mx-auto"></div>
            <p className="text-white mt-4 font-bold text-xl">Loading land plots...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plots.map((plot) => (
              <Card key={plot.id} className="bg-blue-900 border-blue-500 border-4 hover:border-yellow-400 transition-all overflow-hidden">
                {/* Land Plot Image */}
                <div className="relative h-48 w-full overflow-hidden bg-blue-950">
                  <img
                    src={plot.generatedImageUrl || getPlaceholderImage(plot.terrainType)}
                    alt={`Plot #${plot.plotNumber} - ${plot.terrainType}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = getPlaceholderImage(plot.terrainType);
                    }}
                  />
                  {!plot.generatedImageUrl && (
                    <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded font-bold">
                      Placeholder
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                    <p className="text-white font-bold text-lg">Plot #{plot.plotNumber}</p>
                  </div>
                </div>
                
                <CardHeader className="bg-blue-800 border-b-4 border-blue-500">
                  <CardTitle className="flex items-center justify-between text-white font-bold">
                    <span className="flex items-center gap-2">
                      <span className="text-3xl">{getTerrainIcon(plot.terrainType)}</span>
                      <span>{plot.gridSection}</span>
                    </span>
                    <Badge className={plot.status === 'available' ? 'bg-green-600 text-white font-bold' : 'bg-gray-600 text-white font-bold'}>
                      {plot.status}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-blue-200 font-semibold">{plot.terrainSubtype || plot.terrainType}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 p-6">
                  <div>
                    <p className="text-sm text-blue-100 font-semibold">{plot.description}</p>
                    {plot.lore && (
                      <p className="text-xs text-blue-300 mt-2 italic font-semibold">
                        📜 {plot.lore.slice(0, 100)}...
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm bg-blue-800 p-4 rounded-lg border-2 border-blue-600">
                    <div>
                      <p className="text-blue-200 font-bold">Terrain</p>
                      <p className="font-bold text-yellow-400">{plot.terrainSubtype || plot.terrainType}</p>
                    </div>
                    <div>
                      <p className="text-blue-200 font-bold">Size</p>
                      <p className="font-bold text-yellow-400">{plot.plotSize} ({plot.sizeMultiplier}x)</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-blue-200 font-bold">Coordinates</p>
                      <p className="font-bold text-purple-400">Map: ({plot.mapX}, {plot.mapY}) | Geo: {plot.latitude}°, {plot.longitude}°</p>
                    </div>
                  </div>

                  {/* Special Features */}
                  {plot.specialFeatures && plot.specialFeatures.length > 0 && (
                    <div className="bg-purple-800 p-3 rounded-lg border-2 border-purple-600">
                      <p className="text-sm text-purple-200 mb-2 font-bold">Special Features:</p>
                      <div className="flex flex-wrap gap-1">
                        {plot.specialFeatures.map((feature, idx) => (
                          <Badge key={idx} className="text-xs bg-yellow-600 text-white font-bold">
                            <Sparkles className="w-3 h-3 mr-1" />
                            {feature.replace(/_/g, ' ')}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Inquisition Materials */}
                  {plot.plotResources && Object.keys(plot.plotResources).length > 0 && (
                    <div className="bg-orange-800 p-3 rounded-lg border-2 border-orange-600">
                      <p className="text-sm text-orange-200 mb-2 font-bold">⚔️ Inquisition Materials:</p>
                      <div className="grid grid-cols-2 gap-1 text-xs">
                        {Object.entries(plot.plotResources).slice(0, 6).map(([name, data]: [string, any], idx) => (
                          <div key={idx} className="bg-orange-900/50 p-1.5 rounded border border-orange-700">
                            <span className="text-orange-100 font-bold">{name.replace(/_/g, ' ')}</span>
                            <span className="text-yellow-400 ml-1">Lv{data.level}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Resources */}
                  {plot.resourceNodes && Object.keys(plot.resourceNodes).length > 0 && (
                    <div className="bg-green-800 p-3 rounded-lg border-2 border-green-600">
                      <p className="text-sm text-green-200 mb-2 font-bold">Resources:</p>
                      <div className="flex flex-wrap gap-1">
                        {Object.keys(plot.resourceNodes).map((resource, idx) => (
                          <Badge key={idx} className="text-xs bg-green-600 text-white font-bold">
                            {resource.replace(/_/g, ' ')}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pricing - NO YIELD SECTION */}
                  <div className="border-t-4 border-yellow-500 pt-4">
                    <div className="bg-yellow-600 p-4 rounded-lg border-2 border-yellow-400 mb-3">
                      <div className="flex items-center justify-between">
                        <span className="text-yellow-100 font-bold">XRP Price:</span>
                        <span className="text-3xl font-bold text-white">{parseFloat(plot.currentPrice).toFixed(2)} XRP</span>
                      </div>
                    </div>
                    
                    <div className="bg-green-600 p-4 rounded-lg border-2 border-green-400 mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-green-100 font-bold">Pay with RDL Token:</span>
                        <span className="text-3xl font-bold text-white">{parseFloat(plot.rdlPrice).toFixed(2)} RDL</span>
                      </div>
                      <Badge className="bg-yellow-500 text-black font-bold">
                        <Sparkles className="w-3 h-3 mr-1 inline" />
                        {plot.rdlDiscountPercent}% Discount
                      </Badge>
                    </div>

                    {plot.status === 'available' && (
                      <div className="flex gap-2">
                        <Button
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold border-2 border-blue-400"
                          onClick={() => handlePurchase(plot, 'XRP')}
                          disabled={purchasing}
                        >
                          <Wallet className="w-4 h-4 mr-2" />
                          {purchasing ? 'Processing...' : 'Buy with XRP'}
                        </Button>
                        <Button
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold border-2 border-green-400"
                          onClick={() => handlePurchase(plot, 'RDL')}
                          disabled={purchasing}
                        >
                          <Coins className="w-4 h-4 mr-2" />
                          {purchasing ? 'Processing...' : 'Buy with RDL'}
                        </Button>
                      </div>
                    )}

                    {plot.status === 'owned' && plot.ownerHandle && (
                      <div className="text-center bg-gray-700 p-3 rounded-lg">
                        <p className="text-gray-200 font-bold">Owned by @{plot.ownerHandle}</p>
                      </div>
                    )}
                  </div>

                  <Button
                    variant="outline"
                    className="w-full bg-purple-800 border-purple-500 text-white hover:bg-purple-700 font-bold"
                    onClick={() => setLocation(`/land/${plot.plotNumber}`)}
                  >
                    <Info className="w-4 h-4 mr-2" />
                    View Full Details
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {plots.length === 0 && !loading && (
          <Card className="bg-blue-900 border-blue-500 border-4">
            <CardContent className="text-center py-12">
              <MapPin className="w-16 h-16 mx-auto text-blue-400 mb-4" />
              <p className="text-2xl text-white font-bold">No land plots found</p>
              <p className="text-sm text-blue-200 mt-2 font-semibold">Try adjusting your filters</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Plot Details Dialog */}
      <Dialog open={!!selectedPlot} onOpenChange={() => {
        setSelectedPlot(null);
        setModalImageFallback(false);
      }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto bg-blue-900 border-blue-500 border-4">
          <DialogHeader>
            <DialogTitle className="text-3xl font-bold text-white">
              {selectedPlot && (
                <span className="flex items-center gap-2">
                  <span className="text-4xl">{getTerrainIcon(selectedPlot.terrainType)}</span>
                  Land Plot #{selectedPlot.plotNumber}
                </span>
              )}
            </DialogTitle>
            <DialogDescription className="text-blue-200 font-semibold text-lg">
              {selectedPlot?.gridSection}
            </DialogDescription>
          </DialogHeader>

          {selectedPlot && (
            <div className="space-y-6">
              {/* Plot Image */}
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border-4 border-blue-500">
                <img
                  src={modalImageFallback || !selectedPlot.generatedImageUrl 
                    ? getPlaceholderImage(selectedPlot.terrainType) 
                    : selectedPlot.generatedImageUrl
                  }
                  alt={`Plot #${selectedPlot.plotNumber} - ${selectedPlot.terrainType}`}
                  className="w-full h-full object-cover"
                  onError={() => {
                    console.warn(`⚠️ [LAND MODAL] Image failed to load for plot #${selectedPlot.plotNumber}, using placeholder`);
                    setModalImageFallback(true);
                  }}
                />
                {(modalImageFallback || !selectedPlot.generatedImageUrl) && (
                  <div className="absolute top-3 right-3 bg-black/80 text-white text-xs px-3 py-1.5 rounded-full font-bold border-2 border-yellow-400">
                    🎨 Placeholder
                  </div>
                )}
              </div>

              {/* Status */}
              <div className="flex items-center justify-between">
                <Badge className={selectedPlot.status === 'available' ? 'text-lg px-4 py-2 bg-green-600 text-white font-bold' : 'text-lg px-4 py-2 bg-gray-600 text-white font-bold'}>
                  {selectedPlot.status}
                </Badge>
                {selectedPlot.ownerHandle && (
                  <p className="text-blue-200 font-bold">Owned by <span className="text-yellow-400">@{selectedPlot.ownerHandle}</span></p>
                )}
              </div>

              {/* Description */}
              <Card className="bg-blue-800 border-blue-500 border-2">
                <CardHeader className="bg-blue-700 border-b-2 border-blue-500">
                  <CardTitle className="text-yellow-400 font-bold">Description</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 p-6">
                  <p className="text-white font-semibold">{selectedPlot.description}</p>
                  {selectedPlot.lore && (
                    <div className="border-t-2 border-blue-600 pt-3">
                      <p className="text-sm font-bold text-blue-200 mb-2">📜 Historical Lore:</p>
                      <p className="text-sm text-blue-100 italic font-semibold">{selectedPlot.lore}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Statistics */}
              <Card className="bg-purple-900 border-purple-500 border-2">
                <CardHeader className="bg-purple-800 border-b-2 border-purple-500">
                  <CardTitle className="text-yellow-400 font-bold">Plot Statistics</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-purple-800 p-3 rounded-lg">
                      <p className="text-purple-200 text-sm font-bold">Terrain Type</p>
                      <p className="font-bold text-white">{selectedPlot.terrainType}</p>
                    </div>
                    <div className="bg-purple-800 p-3 rounded-lg">
                      <p className="text-purple-200 text-sm font-bold">Terrain Subtype</p>
                      <p className="font-bold text-white">{selectedPlot.terrainSubtype}</p>
                    </div>
                    <div className="bg-purple-800 p-3 rounded-lg">
                      <p className="text-purple-200 text-sm font-bold">Plot Size</p>
                      <p className="font-bold text-white">{selectedPlot.plotSize}</p>
                    </div>
                    <div className="bg-purple-800 p-3 rounded-lg">
                      <p className="text-purple-200 text-sm font-bold">Size Multiplier</p>
                      <p className="font-bold text-white">{selectedPlot.sizeMultiplier}x</p>
                    </div>
                    <div className="bg-purple-800 p-3 rounded-lg">
                      <p className="text-purple-200 text-sm font-bold">Map Coordinates</p>
                      <p className="font-bold text-white">({selectedPlot.mapX}, {selectedPlot.mapY})</p>
                    </div>
                    <div className="bg-purple-800 p-3 rounded-lg">
                      <p className="text-purple-200 text-sm font-bold">Geographic Location</p>
                      <p className="font-bold text-white">{selectedPlot.latitude}°, {selectedPlot.longitude}°</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Purchase Buttons */}
              {selectedPlot.status === 'available' && (
                <div className="flex gap-3">
                  <Button
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold border-2 border-blue-400 text-lg py-6"
                    onClick={() => handlePurchase(selectedPlot, 'XRP')}
                    disabled={purchasing}
                  >
                    <Wallet className="w-5 h-5 mr-2" />
                    Buy for {parseFloat(selectedPlot.currentPrice).toFixed(2)} XRP
                  </Button>
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold border-2 border-green-400 text-lg py-6"
                    onClick={() => handlePurchase(selectedPlot, 'RDL')}
                    disabled={purchasing}
                  >
                    <Coins className="w-5 h-5 mr-2" />
                    Buy for {parseFloat(selectedPlot.rdlPrice).toFixed(2)} RDL
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
