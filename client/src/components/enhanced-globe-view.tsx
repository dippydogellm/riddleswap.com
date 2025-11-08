import React, { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  RotateCcw, 
  Maximize2, 
  Minimize2,
  Filter,
  Search,
  Eye,
  EyeOff,
  ShoppingCart
} from "lucide-react";
import Globe from "@/components/magicui-globe";
import { LandPlotPaymentDialog } from "./land-plot-payment-dialog";
import "../styles/globe-fix.css";
import "../styles/gaming-globe.css";

interface Plot {
  id: string;
  x: number;
  y: number;
  terrain_type: string;
  owner?: string;
  xrp_price?: number;
  size_multiplier?: number;
  resources?: string[];
  ownership_status?: string;
  latitude?: number;
  longitude?: number;
}

interface EnhancedGlobeViewProps {
  plots: Plot[];
  onPlotClick?: (plot: Plot) => void;
  className?: string;
  showControls?: boolean;
  showFilters?: boolean;
  showStats?: boolean;
  showYields?: boolean;
  size?: 'small' | 'large';
  selectedPlotId?: string;
  onPlotSelect?: (plot: Plot) => void;
}

const TERRAIN_COLORS = {
  'forest': '#16a34a', 
  'mountain': '#64748b',
  'plains': '#22c55e',
  'water': '#3b82f6',
  'village': '#f59e0b',
  'castle': '#8b5cf6',
  'desert': '#eab308',
  'swamp': '#059669',
  'tundra': '#e0e7ff',
  'default': '#6b7280'
};

const TERRAIN_TYPES = [
  'All Terrain',
  'forest', 
  'mountain', 
  'plains',
  'water', 
  'village',
  'castle',
  'desert', 
  'swamp',
  'tundra'
];

const OWNERSHIP_STATUS = [
  'All Status',
  'available',
  'owned',
  'premium'
];

const EnhancedGlobeView: React.FC<EnhancedGlobeViewProps> = ({
  plots,
  onPlotClick,
  className = "",
  showControls = true,
  showFilters = true,
  showStats = true,
  showYields = true,
  size = 'large',
  selectedPlotId,
  onPlotSelect
}) => {
  const [selectedPlot, setSelectedPlot] = useState<Plot | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [terrainFilter, setTerrainFilter] = useState("All Terrain");
  const [ownershipFilter, setOwnershipFilter] = useState("All Status");
  const [priceRange, setPriceRange] = useState({ min: "", max: "" });
  const [showMarkersOverlay, setShowMarkersOverlay] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [searchPopup, setSearchPopup] = useState<{plot: Plot, visible: boolean} | null>(null);
  const [highlightedPlot, setHighlightedPlot] = useState<string | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [plotToPurchase, setPlotToPurchase] = useState<Plot | null>(null);

  // Filter plots based on current filters and validate data
  const filteredPlots = useMemo(() => {
    // Validate and clean plot data
    const validPlots = plots.filter(plot => {
      // Ensure required fields exist
      return plot && typeof plot.x === 'number' && typeof plot.y === 'number';
    });
    
    return validPlots.filter(plot => {
      // Search filter
      if (searchTerm && !plot.terrain_type.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !plot.owner?.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }

      // Terrain filter
      if (terrainFilter !== "All Terrain" && plot.terrain_type !== terrainFilter) {
        return false;
      }

      // Ownership filter
      if (ownershipFilter !== "All Status" && plot.ownership_status !== ownershipFilter) {
        return false;
      }

      // Price range filter
      if (plot.xrp_price) {
        if (priceRange.min && plot.xrp_price < parseFloat(priceRange.min)) return false;
        if (priceRange.max && plot.xrp_price > parseFloat(priceRange.max)) return false;
      }

      return true;
    });
  }, [plots, searchTerm, terrainFilter, ownershipFilter, priceRange]);

  // Handle plot search and selection
  const handlePlotSearch = useCallback((searchTerm: string) => {
    if (!searchTerm.trim()) {
      setSearchPopup(null);
      setHighlightedPlot(null);
      return;
    }

    const foundPlot = filteredPlots.find(plot => 
      plot.terrain_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plot.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plot.owner?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (foundPlot) {
      setSearchPopup({ plot: foundPlot, visible: true });
      setHighlightedPlot(foundPlot.id);
      onPlotSelect?.(foundPlot);
    }
  }, [filteredPlots, onPlotSelect]);

  // Handle plot purchase
  const handlePlotPurchase = useCallback((plot: Plot) => {
    if (plot.ownership_status === 'available' && !plot.owner) {
      setPlotToPurchase(plot);
      setPaymentDialogOpen(true);
    }
  }, []);

  // Handle enhanced plot click - combines selection and purchase
  const handleEnhancedPlotClick = useCallback((plot: Plot) => {
    // First call the original onPlotClick handler if provided
    onPlotClick?.(plot);
    
    // Set the selected plot for visual feedback
    setSelectedPlot(plot);
    
    // If plot is available for purchase, show purchase option
    if (plot.ownership_status === 'available' && !plot.owner) {
      // Add a small delay to show the selection first
      setTimeout(() => {
        setPlotToPurchase(plot);
        setPaymentDialogOpen(true);
      }, 300);
    }
  }, [onPlotClick]);

  // Handle purchase completion
  const handlePurchaseComplete = useCallback(() => {
    // Close payment dialog
    setPaymentDialogOpen(false);
    setPlotToPurchase(null);
    
    // Refresh plot data if needed (this would typically trigger a re-fetch)
    // The parent component should handle refreshing the plots data
  }, []);

  // Auto-search when search term changes
  React.useEffect(() => {
    if (searchTerm && searchTerm.length > 2) {
      handlePlotSearch(searchTerm);
    } else {
      setSearchPopup(null);
      setHighlightedPlot(null);
    }
  }, [searchTerm, handlePlotSearch]);

  // Convert plots to globe markers using REAL geographic coordinates
  const globeMarkers = useMemo(() => {
    return filteredPlots.map(plot => {
      const isSelected = selectedPlotId === plot.id || highlightedPlot === plot.id;
      const isOwned = plot.owner;
      
      // Map gaming grid to real geographic coordinates (Iceland region)
      // 40x25 grid mapped to Iceland (64.9°N, 19.0°W to 63.0°N, 13.0°W)
      const lng = typeof plot.longitude === 'number' && !isNaN(plot.longitude) 
        ? plot.longitude 
        : -19.0 + (plot.x / 39) * 6.0; // Real longitude: -19°W to -13°W
      
      const lat = typeof plot.latitude === 'number' && !isNaN(plot.latitude) 
        ? plot.latitude 
        : 64.9 - (plot.y / 24) * 1.9; // Real latitude: 64.9°N to 63.0°N
      
      return {
        location: [
          Math.max(-180, Math.min(180, lng)),  // Clamp longitude to valid range
          Math.max(-90, Math.min(90, lat))     // Clamp latitude to valid range
        ] as [number, number],
        size: isSelected ? 0.04 : 0.02, // Larger size for selected plots
        color: isSelected 
          ? [1, 0.8, 0] // Gold for selected plots
          : isOwned 
            ? [1, 0.2, 0.2] // Red for owned plots
            : [0.2, 0.8, 0.2], // Green for available plots
        plotId: plot.id
      };
    });
  }, [filteredPlots, selectedPlotId, highlightedPlot]);

  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev + 0.2, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev - 0.2, 0.5));
  }, []);

  const handleRotateLeft = useCallback(() => {
    setRotation(prev => prev - 15);
  }, []);

  const handleRotateRight = useCallback(() => {
    setRotation(prev => prev + 15);
  }, []);

  const handlePlotClick = useCallback((plot: Plot) => {
    setSelectedPlot(plot);
    onPlotClick?.(plot);
  }, [onPlotClick]);

  const globeConfig = useMemo(() => ({
    width: 600,
    height: 600,
    devicePixelRatio: 2,
    phi: rotation * (Math.PI / 180),
    theta: 0.3,
    dark: 1,
    diffuse: 0.4,
    mapSamples: 16000,
    mapBrightness: 1.2,
    baseColor: [0.3, 0.3, 0.3] as [number, number, number],
    markerColor: [0.1, 0.8, 1] as [number, number, number],
    glowColor: [1, 1, 1] as [number, number, number],
    markers: [],
    onRender: (state: any) => {
      state.phi += 0.01;
    }
  }), [rotation]);

  return (
    <div className={`${className} ${isFullscreen ? 'fixed inset-0 z-50 bg-slate-900' : ''}`}>
      <Card className="h-full bg-slate-800/50 backdrop-blur-sm border-slate-700">
        <CardContent className="p-4 h-full flex flex-col">
          {/* Header Controls */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-white">Interactive Globe</h3>
              <Badge variant="outline" className="text-green-400 border-green-400">
                {filteredPlots.length} plots
              </Badge>
            </div>
            
            <div className="flex items-center gap-2">
              {showControls && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleZoomOut}
                    className="h-8 w-8 p-0 text-white hover:bg-slate-700"
                    data-testid="button-zoom-out"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleZoomIn}
                    className="h-8 w-8 p-0 text-white hover:bg-slate-700"
                    data-testid="button-zoom-in"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleRotateLeft}
                    className="h-8 w-8 p-0 text-white hover:bg-slate-700"
                    data-testid="button-rotate-left"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleRotateRight}
                    className="h-8 w-8 p-0 text-white hover:bg-slate-700"
                    data-testid="button-rotate-right"
                  >
                    <RotateCw className="h-4 w-4" />
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowMarkersOverlay(!showMarkersOverlay)}
                className="h-8 w-8 p-0 text-white hover:bg-slate-700"
                data-testid="button-toggle-markers"
              >
                {showMarkersOverlay ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="h-8 w-8 p-0 text-white hover:bg-slate-700"
                data-testid="button-fullscreen"
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Enhanced Search & Land Information Section */}
          <Card className="mb-4 bg-slate-800/50 border-slate-600">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Search className="h-5 w-5 text-blue-400" />
                  Land Plot Search & Discovery
                </h3>
                <Badge variant="outline" className="text-green-400 border-green-400">
                  {filteredPlots.length} of {plots.length} plots
                </Badge>
              </div>
              
              {/* Main Search Bar */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by terrain, coordinates (e.g. 15,20), plot ID, or owner..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-slate-700/50 border-slate-600 text-white placeholder-slate-400 text-sm"
                  data-testid="input-search"
                />
                {searchTerm && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-slate-400">
                    Press Enter to search
                  </div>
                )}
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="bg-green-600/20 border border-green-600/30 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-green-400">
                    {plots.filter(p => p.ownership_status === 'available').length}
                  </div>
                  <div className="text-xs text-slate-300">Available</div>
                </div>
                <div className="bg-red-600/20 border border-red-600/30 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-red-400">
                    {plots.filter(p => p.ownership_status === 'owned').length}
                  </div>
                  <div className="text-xs text-slate-300">Owned</div>
                </div>
                <div className="bg-blue-600/20 border border-blue-600/30 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-blue-400">
                    {Math.round(plots.reduce((sum, p) => sum + (p.xrp_price || 0), 0) / plots.length)}
                  </div>
                  <div className="text-xs text-slate-300">Avg XRP</div>
                </div>
                <div className="bg-purple-600/20 border border-purple-600/30 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-purple-400">
                    {plots.filter(p => (p.size_multiplier || 0) > 1).length}
                  </div>
                  <div className="text-xs text-slate-300">Large Plots</div>
                </div>
              </div>

              {/* Filters */}
              {showFilters && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div></div>
              
              <Select value={terrainFilter} onValueChange={setTerrainFilter}>
                <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white" data-testid="select-terrain">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  {TERRAIN_TYPES.map(type => (
                    <SelectItem key={type} value={type} className="text-white hover:bg-slate-700">
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={ownershipFilter} onValueChange={setOwnershipFilter}>
                <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white" data-testid="select-ownership">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  {OWNERSHIP_STATUS.map(status => (
                    <SelectItem key={status} value={status} className="text-white hover:bg-slate-700">
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex gap-1">
                <Input
                  placeholder="Min XRP"
                  value={priceRange.min}
                  onChange={(e) => setPriceRange(prev => ({ ...prev, min: e.target.value }))}
                  className="bg-slate-700/50 border-slate-600 text-white placeholder-slate-400"
                  data-testid="input-price-min"
                />
                <Input
                  placeholder="Max XRP"
                  value={priceRange.max}
                  onChange={(e) => setPriceRange(prev => ({ ...prev, max: e.target.value }))}
                  className="bg-slate-700/50 border-slate-600 text-white placeholder-slate-400"
                  data-testid="input-price-max"
                />
              </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Globe Container - Responsive with Search Pop-up */}
          <div className={`gaming-globe-container ${size === 'small' ? 'gaming-globe-small' : 'gaming-globe-large'}`}>
            <div 
              className="relative w-full h-full"
              style={{
                transform: `scale(${zoom})`,
                transition: 'transform 0.3s ease-out'
              }}
            >
              <div className="gaming-globe-content">
                <Globe
                  className="globe-override w-full h-full"
                  config={{
                    ...globeConfig,
                    width: size === 'small' ? 300 : 500,
                    height: size === 'small' ? 300 : 500,
                    devicePixelRatio: 2,
                    phi: 0,
                    theta: 0.3,
                    dark: 1,
                    diffuse: 0.4,
                    mapSamples: 16000,
                    mapBrightness: 1.2,
                    baseColor: [1, 1, 1],
                    markerColor: [251/255, 100/255, 21/255],
                    glowColor: [1, 1, 1]
                  }}
                  markers={globeMarkers}
                  onMarkerClick={(plotId) => {
                    const plot = filteredPlots.find(p => p.id === plotId);
                    if (plot) {
                      handleEnhancedPlotClick(plot);
                    }
                  }}
                />
              </div>

              {/* Search Pop-up */}
              {searchPopup?.visible && searchPopup.plot && (
                <div className="search-popup">
                  <button
                    className="search-popup-close"
                    onClick={() => setSearchPopup(null)}
                    aria-label="Close search popup"
                  >
                    ×
                  </button>
                  <div className="search-popup-title">
                    Plot Found: {searchPopup.plot.id}
                  </div>
                  <div className="search-popup-details">
                    <div className="search-popup-row">
                      <span className="search-popup-label">Terrain:</span>
                      <span className={`search-popup-value terrain-${searchPopup.plot.terrain_type}`}>
                        {searchPopup.plot.terrain_type}
                      </span>
                    </div>
                    <div className="search-popup-row">
                      <span className="search-popup-label">Status:</span>
                      <span className={`search-popup-value ${searchPopup.plot.owner ? 'status-owned' : 'status-available'}`}>
                        {searchPopup.plot.owner ? 'Owned' : 'Available'}
                      </span>
                    </div>
                    {searchPopup.plot.owner && (
                      <div className="search-popup-row">
                        <span className="search-popup-label">Owner:</span>
                        <span className="search-popup-value">{searchPopup.plot.owner}</span>
                      </div>
                    )}
                    {searchPopup.plot.xrp_price && (
                      <div className="search-popup-row">
                        <span className="search-popup-label">Price:</span>
                        <span className="search-popup-value">{searchPopup.plot.xrp_price} XRP</span>
                      </div>
                    )}
                    <div className="search-popup-row">
                      <span className="search-popup-label">Grid Coordinates:</span>
                      <span className="search-popup-value">
                        ({searchPopup.plot.x}, {searchPopup.plot.y})
                      </span>
                    </div>
                    {searchPopup.plot.latitude && searchPopup.plot.longitude && (
                      <div className="search-popup-row">
                        <span className="search-popup-label">Globe Position:</span>
                        <span className="search-popup-value text-slate-400 text-xs">
                          {searchPopup.plot.latitude.toFixed(2)}°, {searchPopup.plot.longitude.toFixed(2)}°
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* Purchase Button for Available Plots */}
            {selectedPlot && selectedPlot.ownership_status === 'available' && !selectedPlot.owner && (
              <div className="absolute top-4 right-4 z-10">
                <Button
                  onClick={() => handlePlotPurchase(selectedPlot)}
                  className="bg-green-600 hover:bg-green-700 text-white shadow-lg"
                  size="sm"
                  data-testid="button-purchase-plot"
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Purchase Plot
                </Button>
              </div>
            )}
          </div>

          {/* Statistics */}
          {showStats && (
            <div className="mt-4 p-3 bg-slate-700/30 rounded-lg border border-slate-600">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div className="text-slate-300">
                  <span className="text-white">Zoom:</span> {Math.round(zoom * 100)}%
                </div>
                <div className="text-slate-300">
                  <span className="text-white">Rotation:</span> {rotation}°
                </div>
                <div className="text-slate-300">
                  <span className="text-white">Mode:</span> MagicUI Globe
                </div>
                <div className="text-slate-300">
                  <span className="text-white">Status:</span> <span className="text-green-400">Interactive</span>
                </div>
              </div>
              
              {showYields && (
                <div className="mt-2 text-xs text-slate-400">
                  Drag to rotate • Scroll to zoom • Click markers for details
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Land Plot Payment Dialog */}
      <LandPlotPaymentDialog
        plot={plotToPurchase ? {
          id: plotToPurchase.id,
          plotNumber: plotToPurchase.x, // Using x as plot number for now
          terrainType: plotToPurchase.terrain_type,
          plotSize: plotToPurchase.size_multiplier ? 'large' : 'standard',
          currentPrice: plotToPurchase.xrp_price || 0,
          latitude: plotToPurchase.latitude,
          longitude: plotToPurchase.longitude,
          status: plotToPurchase.ownership_status || 'available'
        } : null}
        isOpen={paymentDialogOpen}
        onClose={() => {
          setPaymentDialogOpen(false);
          setPlotToPurchase(null);
        }}
        onPurchaseComplete={handlePurchaseComplete}
      />
    </div>
  );
};

export default EnhancedGlobeView;
