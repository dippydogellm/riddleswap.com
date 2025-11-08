import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDynamicMetadata, GAMING_METADATA } from "@/hooks/use-dynamic-metadata";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { 
  Search, 
  SlidersHorizontal, 
  MapPin, 
  Globe,
  RefreshCw,
  Filter,
  Eye,
  ShoppingCart,
  Wallet,
  LogIn
} from "lucide-react";
import EnhancedGlobeView from "@/components/enhanced-globe-view";
import { sessionManager } from "@/utils/sessionManager";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

interface LandPlot {
  id: string;
  x: number;
  y: number;
  terrain_type: 'forest' | 'mountain' | 'plains' | 'water' | 'castle' | 'village' | 'desert' | 'swamp' | 'tundra';
  owner?: string;
  description?: string;
  image_url?: string;
  resources: string[];
  claimed_at?: string;
  value?: number;
  xrp_price: number;
  yearly_yield?: number;
  yield_percentage?: number;
  size_multiplier: number;
  latitude?: number;
  longitude?: number;
  ownership_status?: string;
}

interface SearchFilters {
  searchText: string;
  terrain: string;
  ownershipStatus: string;
  priceRange: [number, number];
  yieldRange: [number, number];
  sizeMultiplier: string;
}

interface LandExplorerProps {
  landPlots: LandPlot[];
  isLoading: boolean;
  onPlotSelect: (plot: LandPlot) => void;
}

export const LandExplorer = ({ landPlots, isLoading, onPlotSelect }: LandExplorerProps) => {
  // Set SEO metadata for land explorer
  useDynamicMetadata(GAMING_METADATA.landExplorer);
  
  const [selectedPlot, setSelectedPlot] = useState<LandPlot | null>(null);
  const [searchActive, setSearchActive] = useState(true); // FIXED: Open search by default
  const [viewMode, setViewMode] = useState<'grid' | 'globe'>('globe');
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  
  // sessionManager is imported as a singleton instance
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    searchText: '',
    terrain: 'all',
    ownershipStatus: 'all',
    priceRange: [0, 1000],
    yieldRange: [0, 20],
    sizeMultiplier: 'all'
  });

  // Filter land plots based on search criteria
  const filteredPlots = landPlots.filter(plot => {
    if (searchFilters.searchText) {
      const searchLower = searchFilters.searchText.toLowerCase();
      
      // Enhanced search: Include coordinate searching
      const coordinateMatch = 
        // Match formats like "(10,15)", "(10, 15)", "10,15"
        searchLower.includes(`(${plot.x},${plot.y})`) ||
        searchLower.includes(`(${plot.x}, ${plot.y})`) ||
        searchLower.includes(`${plot.x},${plot.y}`) ||
        // Match formats like "x:10", "y:15", "x:10 y:15"
        searchLower.includes(`x:${plot.x}`) ||
        searchLower.includes(`y:${plot.y}`) ||
        // Match individual coordinates as numbers
        searchLower.includes(plot.x.toString()) ||
        searchLower.includes(plot.y.toString());
      
      const basicMatch = 
        plot.id.toLowerCase().includes(searchLower) ||
        plot.terrain_type.toLowerCase().includes(searchLower) ||
        (plot.owner?.toLowerCase().includes(searchLower));
      
      if (!coordinateMatch && !basicMatch) {
        return false;
      }
    }
    
    if (searchFilters.terrain !== 'all' && plot.terrain_type !== searchFilters.terrain) {
      return false;
    }
    
    if (searchFilters.ownershipStatus !== 'all') {
      const isOwned = !!plot.owner;
      if (searchFilters.ownershipStatus === 'owned' && !isOwned) return false;
      if (searchFilters.ownershipStatus === 'available' && isOwned) return false;
    }
    
    if (plot.xrp_price < searchFilters.priceRange[0] || plot.xrp_price > searchFilters.priceRange[1]) {
      return false;
    }
    
    const yieldPercent = plot.yield_percentage || 0;
    if (yieldPercent < searchFilters.yieldRange[0] || yieldPercent > searchFilters.yieldRange[1]) {
      return false;
    }
    
    if (searchFilters.sizeMultiplier !== 'all' && 
        plot.size_multiplier.toString() !== searchFilters.sizeMultiplier) {
      return false;
    }
    
    return true;
  });

  const handlePlotSelect = useCallback((plot: LandPlot) => {
    setSelectedPlot(plot);
    onPlotSelect(plot);
  }, [onPlotSelect]);

  // Handle purchase flow with authentication check
  const handlePurchasePlot = useCallback(async (plot: LandPlot) => {
    // Check if user is logged in
    const session = sessionManager.getSession();
    
    if (!session.isLoggedIn) {
      // Redirect to authentication setup
      toast({
        title: "Authentication Required",
        description: "Please set up your Riddle wallet to purchase land plots.",
        duration: 4000,
      });
      
      // Save the intended purchase for after login
      localStorage.setItem('pendingLandPurchase', JSON.stringify({
        plotId: plot.id,
        coordinates: { x: plot.x, y: plot.y },
        price: plot.xrp_price,
        terrain: plot.terrain_type
      }));
      
      // Redirect to authentication
      setLocation('/');
      return;
    }

    // User is logged in - proceed with purchase
    setPurchaseLoading(true);
    
    try {
      // Here we would integrate with payment system
      toast({
        title: "Purchase Processing",
        description: `Processing purchase of ${plot.terrain_type} plot at (${plot.x},${plot.y}) for ${plot.xrp_price} XRP...`,
        duration: 3000,
      });
      
      // Simulate purchase process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: "Purchase Successful!",
        description: `You now own plot ${plot.id} at coordinates (${plot.x},${plot.y})!`,
        duration: 5000,
      });
      
      // Clear any pending purchase
      localStorage.removeItem('pendingLandPurchase');
      
    } catch (error) {
      console.error('Purchase failed:', error);
      toast({
        title: "Purchase Failed",
        description: "There was an error processing your purchase. Please try again.",
        variant: "destructive",
        duration: 4000,
      });
    } finally {
      setPurchaseLoading(false);
    }
  }, [sessionManager, toast, setLocation]);

  // Check for pending purchase on component mount/session change
  useEffect(() => {
    const pendingPurchase = localStorage.getItem('pendingLandPurchase');
    const session = sessionManager.getSession();
    
    if (pendingPurchase && session.isLoggedIn) {
      try {
        const purchase = JSON.parse(pendingPurchase);
        const plot = landPlots.find(p => p.id === purchase.plotId);
        
        if (plot) {
          // Auto-select the plot they wanted to buy
          setSelectedPlot(plot);
          
          toast({
            title: "Ready to Complete Purchase",
            description: `Welcome back! You can now purchase ${purchase.terrain} plot at (${purchase.coordinates.x},${purchase.coordinates.y}) for ${purchase.price} XRP.`,
            duration: 6000,
          });
        }
      } catch (error) {
        console.error('Error parsing pending purchase:', error);
        localStorage.removeItem('pendingLandPurchase');
      }
    }
  }, [sessionManager, landPlots, toast]);

  // Generate coordinate grid for grid view
  const CoordinateGrid = () => {
    const grid = [];
    for (let y = 0; y < 25; y++) {
      for (let x = 0; x < 40; x++) {
        const plot = landPlots.find(p => p.x === x && p.y === y);
        const isFiltered = plot ? filteredPlots.includes(plot) : false;
        
        grid.push(
          <div
            key={`${x}-${y}`}
            className={`
              coordinate-cell 
              ${plot?.owner ? 'owned' : 'available'}
              ${plot?.terrain_type || 'empty'}
              ${selectedPlot?.x === x && selectedPlot?.y === y ? 'selected' : ''}
              ${!isFiltered && plot ? 'filtered-out' : ''}
            `}
            style={{
              opacity: !plot || isFiltered ? 1 : 0.3
            }}
            onClick={() => plot && handlePlotSelect(plot)}
            title={plot ? 
              `Plot ${plot.id} (${x},${y}) - ${plot.terrain_type} - ${plot.owner ? 'Owned' : 'Available'} - ${plot.xrp_price} XRP`
              : `Empty (${x},${y})`
            }
            data-testid={`coordinate-${x}-${y}`}
          />
        );
      }
    }
    return grid;
  };

  return (
    <div className="space-y-4">
      {/* Search and Filter Interface */}
      <Card className="gaming-component-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-green-300 font-mono flex items-center gap-2">
                <Search className="h-5 w-5" />
                LAND RECONNAISSANCE
              </CardTitle>
              <CardDescription className="text-slate-400 text-sm">
                🔍 Search and filter land plots by terrain, ownership, price, and yield criteria. Globe search enabled!
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchActive(!searchActive)}
                data-testid="toggle-search"
                className="border-green-500/30 text-green-300 hover:bg-green-500/10"
              >
                <Search className="h-4 w-4 mr-2" />
                {searchActive ? 'Hide Search' : 'Open Search'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode(viewMode === 'grid' ? 'globe' : 'grid')}
                data-testid="toggle-view-mode"
                className="border-blue-500/30 text-blue-300 hover:bg-blue-500/10"
              >
                {viewMode === 'grid' ? <Globe className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>
        
        {searchActive && (
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Text Search */}
              <div className="space-y-2">
                <Label htmlFor="search-text" className="text-green-300 text-sm font-mono">Text Search</Label>
                <Input
                  id="search-text"
                  placeholder="Plot ID, terrain, owner, (10,15), x:10, y:15..."
                  value={searchFilters.searchText}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, searchText: e.target.value }))}
                  data-testid="input-search-text"
                  className="bg-slate-800/50 border-slate-600 text-slate-200"
                />
              </div>

              {/* Terrain Filter */}
              <div className="space-y-2">
                <Label className="text-green-300 text-sm font-mono">Terrain Type</Label>
                <Select 
                  value={searchFilters.terrain} 
                  onValueChange={(value) => setSearchFilters(prev => ({ ...prev, terrain: value }))}
                >
                  <SelectTrigger className="bg-slate-800/50 border-slate-600" data-testid="select-terrain">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Terrains</SelectItem>
                    <SelectItem value="forest">Forest</SelectItem>
                    <SelectItem value="mountain">Mountain</SelectItem>
                    <SelectItem value="plains">Plains</SelectItem>
                    <SelectItem value="water">Water</SelectItem>
                    <SelectItem value="castle">Castle</SelectItem>
                    <SelectItem value="village">Village</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Ownership Status */}
              <div className="space-y-2">
                <Label className="text-green-300 text-sm font-mono">Ownership</Label>
                <Select 
                  value={searchFilters.ownershipStatus} 
                  onValueChange={(value) => setSearchFilters(prev => ({ ...prev, ownershipStatus: value }))}
                >
                  <SelectTrigger className="bg-slate-800/50 border-slate-600" data-testid="select-ownership">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Plots</SelectItem>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="owned">Owned</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Price Range */}
              <div className="space-y-2">
                <Label className="text-green-300 text-sm font-mono">
                  Price Range: {searchFilters.priceRange[0]} - {searchFilters.priceRange[1]} XRP
                </Label>
                <Slider
                  value={searchFilters.priceRange}
                  onValueChange={(value) => setSearchFilters(prev => ({ ...prev, priceRange: value as [number, number] }))}
                  max={1000}
                  min={0}
                  step={10}
                  className="mt-2"
                  data-testid="slider-price-range"
                />
              </div>

              {/* Yield Range */}
              <div className="space-y-2">
                <Label className="text-green-300 text-sm font-mono">
                  Yield Range: {searchFilters.yieldRange[0]}% - {searchFilters.yieldRange[1]}%
                </Label>
                <Slider
                  value={searchFilters.yieldRange}
                  onValueChange={(value) => setSearchFilters(prev => ({ ...prev, yieldRange: value as [number, number] }))}
                  max={20}
                  min={0}
                  step={1}
                  className="mt-2"
                  data-testid="slider-yield-range"
                />
              </div>

              {/* Size Multiplier */}
              <div className="space-y-2">
                <Label className="text-green-300 text-sm font-mono">Size Multiplier</Label>
                <Select 
                  value={searchFilters.sizeMultiplier} 
                  onValueChange={(value) => setSearchFilters(prev => ({ ...prev, sizeMultiplier: value }))}
                >
                  <SelectTrigger className="bg-slate-800/50 border-slate-600" data-testid="select-size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sizes</SelectItem>
                    <SelectItem value="1">1x Standard</SelectItem>
                    <SelectItem value="2">2x Large</SelectItem>
                    <SelectItem value="3">3x Massive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Results Summary */}
            <div className="mt-4 flex items-center justify-between">
              <Badge variant="outline" className="border-green-500/30 text-green-300">
                {filteredPlots.length} of {landPlots.length} plots
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchFilters({
                  searchText: '',
                  terrain: 'all',
                  ownershipStatus: 'all',
                  priceRange: [0, 1000],
                  yieldRange: [0, 20],
                  sizeMultiplier: 'all'
                })}
                data-testid="button-clear-filters"
                className="border-slate-500/30 text-slate-300 hover:bg-slate-500/10"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Clear Filters
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Land Visualization */}
      <Card className="gaming-component-card">
        <CardHeader>
          <CardTitle className="text-blue-300 font-mono flex items-center gap-2">
            {viewMode === 'globe' ? <Globe className="h-5 w-5" /> : <MapPin className="h-5 w-5" />}
            {viewMode === 'globe' ? '3D GLOBE VIEW' : 'COORDINATE GRID'}
          </CardTitle>
          <CardDescription className="text-slate-400">
            {viewMode === 'globe' 
              ? 'Interactive 3D globe with land plot visualization and purchase system'
              : 'Grid-based coordinate system showing all 1000 land plots (40x25 grid)'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {viewMode === 'globe' ? (
            <div className="min-h-[600px] flex items-center justify-center">
              <EnhancedGlobeView 
                plots={landPlots} 
                showFilters={false}
                onPlotSelect={handlePlotSelect}
                selectedPlotId={selectedPlot?.id}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="coordinate-grid" data-testid="coordinate-grid">
                <CoordinateGrid />
              </div>
              
              {/* Grid Legend */}
              <div className="flex flex-wrap gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-400/60 border border-green-400 rounded"></div>
                  <span className="text-slate-300">Available</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-400/60 border border-red-400 rounded"></div>
                  <span className="text-slate-300">Owned</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-yellow-400/80 border border-yellow-400 rounded"></div>
                  <span className="text-slate-300">Selected</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected Plot Details */}
      {selectedPlot && (
        <Card className="gaming-component-card border-yellow-500/30">
          <CardHeader>
            <CardTitle className="text-yellow-300 font-mono flex items-center gap-2">
              <Eye className="h-5 w-5" />
              PLOT INTELLIGENCE REPORT
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Plot ID:</span>
                  <span className="text-cyan-400 font-mono">{selectedPlot.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Coordinates:</span>
                  <span className="text-cyan-400 font-mono">({selectedPlot.x}, {selectedPlot.y})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Terrain:</span>
                  <span className="text-green-400 capitalize">{selectedPlot.terrain_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Owner:</span>
                  <span className={selectedPlot.owner ? "text-red-400" : "text-green-400"}>
                    {selectedPlot.owner || 'Available'}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Price:</span>
                  <span className="text-yellow-400 font-mono">{selectedPlot.xrp_price} XRP</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Size:</span>
                  <span className="text-purple-400">{selectedPlot.size_multiplier}x</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Yield:</span>
                  <span className="text-blue-400">{selectedPlot.yield_percentage || 0}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Resources:</span>
                  <span className="text-orange-400">{selectedPlot.resources.length}</span>
                </div>
              </div>
            </div>
            
            {/* Purchase Actions */}
            <div className="mt-6 border-t border-slate-600 pt-4">
              {selectedPlot.owner ? (
                <div className="text-center">
                  <Badge variant="destructive" className="bg-red-500/20 text-red-300 border-red-500/30">
                    Plot Already Owned by {selectedPlot.owner}
                  </Badge>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  {sessionManager.getSession().isLoggedIn ? (
                    <Button
                      onClick={() => handlePurchasePlot(selectedPlot)}
                      disabled={purchaseLoading}
                      className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white border-0"
                      data-testid="button-purchase-plot"
                    >
                      {purchaseLoading ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Processing Purchase...
                        </>
                      ) : (
                        <>
                          <ShoppingCart className="h-4 w-4 mr-2" />
                          Purchase for {selectedPlot.xrp_price} XRP
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handlePurchasePlot(selectedPlot)}
                      className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white border-0"
                      data-testid="button-setup-to-purchase"
                    >
                      <LogIn className="h-4 w-4 mr-2" />
                      Set Up Wallet & Purchase
                    </Button>
                  )}
                  
                  <div className="text-center">
                    <div className="text-xs text-slate-400">
                      🔒 Secure XRPL Transaction
                    </div>
                    <div className="text-xs text-slate-500">
                      Connected to RiddleSwap Bank
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
