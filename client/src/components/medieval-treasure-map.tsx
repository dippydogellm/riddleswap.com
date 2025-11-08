/**
 * Tactical Operations Map Component - The Trolls Inquisition Multi-Chain Mayhem Edition
 * Interactive 1000-plot strategic territory map with tactical command aesthetics
 */

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { 
  Mountain, 
  Trees, 
  Waves, 
  Hammer, 
  MapPin,
  Sparkles,
  Coins,
  Crown,
  Scroll
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import tacticalMapImage from "@assets/stock_images/medieval_fantasy_map_7bbcb5f0.jpg";

interface TacticalLandPlot {
  id: string;
  plot_number: number;
  map_x: number;
  map_y: number;
  grid_section: string;
  terrain_type: string;
  terrain_subtype: string;
  base_price: number;
  current_price: number;
  plot_size: string;
  size_multiplier: number;
  yield_rate: number;
  owner_id?: string;
  owner_handle?: string;
  owner_address?: string;
  status: string;
  special_features: string[];
  description: string;
  lore: string;
  has_visual_indicators: boolean;
}

interface TacticalMapData {
  total_plots: number;
  available_plots: number;
  owned_plots: number;
  plots: TacticalLandPlot[];
}

function getTerrainColor(terrain: string): string {
  switch (terrain) {
    case 'plains': return 'bg-yellow-600 hover:bg-yellow-500';
    case 'forest': return 'bg-green-700 hover:bg-green-600';
    case 'mountain': return 'bg-gray-600 hover:bg-gray-500';
    case 'water': return 'bg-blue-600 hover:bg-blue-500';
    case 'swamp': return 'bg-green-900 hover:bg-green-800';
    case 'desert': return 'bg-orange-600 hover:bg-orange-500';
    case 'tundra': return 'bg-blue-200 hover:bg-blue-100';
    default: return 'bg-gray-500 hover:bg-gray-400';
  }
}

function getTerrainIcon(terrain: string) {
  switch (terrain) {
    case 'plains': return MapPin;
    case 'forest': return Trees;
    case 'mountain': return Mountain;
    case 'water': return Waves;
    case 'swamp': return Trees;
    case 'desert': return Hammer;
    case 'tundra': return Sparkles;
    default: return MapPin;
  }
}

function getTerrainEmoji(terrain: string): string {
  switch (terrain) {
    case 'plains': return '🌾';
    case 'forest': return '🌲';
    case 'mountain': return '⛰️';
    case 'water': return '🌊';
    case 'swamp': return '🐸';
    case 'desert': return '🏜️';
    case 'tundra': return '❄️';
    default: return '🗺️';
  }
}

export default function TacticalOperationsMap() {
  const { toast } = useToast();
  const [selectedPlot, setSelectedPlot] = useState<TacticalLandPlot | null>(null);
  const [showPlotDialog, setShowPlotDialog] = useState(false);
  const [hoveredPlot, setHoveredPlot] = useState<number | null>(null);

  // Fetch tactical land plots
  const { data: mapData, isLoading } = useQuery({
    queryKey: ['/api/gaming/medieval-land-plots'],
    queryFn: async () => {
      const response = await apiRequest('/api/gaming/medieval-land-plots');
      return await response.json() as any;
    }
  });

  // Fetch RDL exchange rate
  const { data: exchangeRates } = useQuery({
    queryKey: ['/api/bridge/exchange-rate', 'XRP', 'RDL'],
    queryFn: async () => {
      const response = await apiRequest('/api/bridge/exchange-rate?from=XRP&to=RDL');
      return await response.json() as any;
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Calculate RDL pricing with discount
  const calculateRDLPrice = (xrpPrice: number) => {
    if (!exchangeRates?.rate) return null;
    const rdlPrice = xrpPrice * exchangeRates.rate;
    const discountedPrice = rdlPrice * 0.25; // 75% discount for RDL payments
    return {
      fullPrice: rdlPrice,
      discountedPrice: discountedPrice,
      discountPercent: 75
    };
  };

  const handlePlotClick = useCallback((plot: TacticalLandPlot) => {
    setSelectedPlot(plot);
    setShowPlotDialog(true);
  }, []);

  const handlePurchasePlot = useCallback(async (plot: TacticalLandPlot) => {
    toast({
      title: "Territory Acquisition Initiated",
      description: `Initiating territorial acquisition of Sector #${plot.plot_number} for ${plot.current_price} XRP`,
      variant: "default"
    });
    
    // Here you would integrate with XRP payment system
    console.log("Acquire territory:", plot);
  }, [toast]);

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-slate-800/90 to-gray-800/90 border-slate-600/50">
        <CardContent className="p-8 text-center">
          <div className="animate-spin h-8 w-8 mx-auto mb-4 border-4 border-blue-500 border-t-transparent rounded-full" />
          <p className="text-slate-300">Loading Tactical Map...</p>
        </CardContent>
      </Card>
    );
  }

  const plots = mapData?.plots || [];

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Map Header */}
      <Card className="bg-gradient-to-br from-slate-800/90 to-gray-800/90 border-slate-600/50">
        <CardHeader className="border-b border-slate-600/30">
          <CardTitle className="text-slate-300 flex items-center gap-2 text-2xl font-mono">
            <MapPin className="h-8 w-8 text-blue-500" />
            TACTICAL OPERATIONS MAP - SECTOR CONTROL
          </CardTitle>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center mt-4">
            <div className="bg-black/30 p-3 rounded border border-slate-600/30">
              <div className="text-2xl font-bold text-cyan-400">{mapData?.total_plots || 0}</div>
              <div className="text-slate-300 text-sm font-mono">TOTAL SECTORS</div>
            </div>
            <div className="bg-black/30 p-3 rounded border border-green-600/30">
              <div className="text-2xl font-bold text-green-400">{mapData?.available_plots || 0}</div>
              <div className="text-green-300 text-sm font-mono">AVAILABLE</div>
            </div>
            <div className="bg-black/30 p-3 rounded border border-red-600/30">
              <div className="text-2xl font-bold text-red-400">{mapData?.owned_plots || 0}</div>
              <div className="text-red-300 text-sm font-mono">OCCUPIED</div>
            </div>
            <div className="bg-black/30 p-3 rounded border border-purple-600/30">
              <div className="text-2xl font-bold text-purple-400">
                {plots.filter((p: TacticalLandPlot) => p.has_visual_indicators).length}
              </div>
              <div className="text-purple-300 text-sm font-mono">STRATEGIC</div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Legend */}
      <Card className="bg-gradient-to-br from-slate-800/80 to-gray-800/80 border-slate-600/30">
        <CardContent className="p-4">
          <h3 className="text-slate-300 font-bold mb-3 text-center font-mono">TERRAIN CLASSIFICATION</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 text-center">
            {[
              { type: 'plains', name: 'PLAINS', emoji: '🌾', color: 'bg-yellow-600' },
              { type: 'forest', name: 'FOREST', emoji: '🌲', color: 'bg-green-700' },
              { type: 'mountain', name: 'MOUNTAIN', emoji: '⛰️', color: 'bg-gray-600' },
              { type: 'water', name: 'WATER', emoji: '🌊', color: 'bg-blue-600' },
              { type: 'swamp', name: 'SWAMP', emoji: '🐸', color: 'bg-green-900' },
              { type: 'desert', name: 'DESERT', emoji: '🏜️', color: 'bg-orange-600' },
              { type: 'tundra', name: 'TUNDRA', emoji: '❄️', color: 'bg-blue-200' }
            ].map((terrain: any) => (
              <div key={terrain.type} className="flex flex-col items-center gap-2">
                <div className={`w-6 h-6 ${terrain.color} rounded-sm border border-slate-500/50`}></div>
                <div className="text-xs text-slate-300 font-mono">
                  {terrain.emoji} {terrain.name}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Interactive Tactical Map */}
      <Card className="bg-gradient-to-br from-slate-800/90 to-gray-800/90 border-slate-600/50">
        <CardContent className="p-6 flex justify-center">
          <div className="relative rounded-lg border-4 border-slate-600 shadow-2xl overflow-hidden w-full max-w-5xl">
            {/* Tactical Corner Elements */}
            <div className="absolute top-4 left-4 text-slate-300 opacity-80 z-30">
              <MapPin className="h-6 w-6" />
            </div>
            <div className="absolute top-4 right-4 text-slate-300 opacity-80 z-30">
              <Mountain className="h-6 w-6" />
            </div>
            <div className="absolute bottom-4 left-4 text-slate-300 opacity-80 z-30">
              <Trees className="h-6 w-6" />
            </div>
            <div className="absolute bottom-4 right-4 text-slate-300 opacity-80 z-30">
              <Waves className="h-6 w-6" />
            </div>

            {/* Tactical Map Background with Responsive Aspect Ratio */}
            <AspectRatio ratio={16 / 10} className="relative">
              <img 
                src={tacticalMapImage} 
                alt="Tactical Operations Theater Map" 
                className="w-full h-full object-cover opacity-70 filter contrast-75 brightness-50"
              />
              
              {/* Land Plot Overlays */}
              <div className="absolute inset-0">
                {plots.map((plot: TacticalLandPlot) => {
                  // Convert 50x20 grid to normalized coordinates (u,v) ∈ [0,1]
                  const u = (plot.map_x - 0.5) / 50;
                  const v = (plot.map_y - 0.5) / 20;
                  
                  return (
                    <div
                      key={plot.id}
                      className={`
                        absolute cursor-default transition-all duration-200 rounded-sm border-2 border-slate-700/60 shadow-lg
                        ${getTerrainColor(plot.terrain_type)}
                        ${plot.status === 'owned' ? 'ring-2 ring-red-500' : ''}
                        ${plot.has_visual_indicators ? 'ring-2 ring-purple-500 animate-pulse' : ''}
                        ${plot.size_multiplier > 1 ? 'ring-2 ring-cyan-400' : ''}
                        ${hoveredPlot === plot.plot_number ? 'scale-150 z-20 shadow-2xl ring-3 ring-cyan-300' : 'z-10'}
                      `}
                      style={{
                        left: `${u * 100}%`,
                        top: `${v * 100}%`,
                        transform: 'translate(-50%, -50%)',
                        width: `clamp(8px, 1.2vmin, ${plot.size_multiplier > 1 ? 16 : 12}px)`,
                        height: `clamp(8px, 1.2vmin, ${plot.size_multiplier > 1 ? 16 : 12}px)`,
                        willChange: hoveredPlot === plot.plot_number ? 'transform' : 'auto'
                      }}
                      onMouseEnter={() => setHoveredPlot(plot.plot_number)}
                      onMouseLeave={() => setHoveredPlot(null)}
                      data-testid={`map-plot-${plot.plot_number}`}
                    >
                      {/* Size Multiplier Indicator */}
                      {plot.size_multiplier > 1 && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-purple-600 rounded-full text-xs font-bold flex items-center justify-center text-white">
                          <span className="text-[8px]">{plot.size_multiplier}</span>
                        </div>
                      )}
                      
                      {/* Special indicator for premium plots */}
                      {plot.has_visual_indicators && (
                        <div className="absolute -top-1 -left-1">
                          <Sparkles className="h-3 w-3 text-purple-300" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </AspectRatio>

            {/* Enhanced Hover Info Panel */}
            {hoveredPlot && (
              <div className="absolute top-8 left-1/2 transform -translate-x-1/2 bg-gradient-to-br from-slate-900/95 to-gray-900/95 backdrop-blur-sm text-white px-4 py-3 rounded-lg text-sm border-2 border-slate-500 z-30 shadow-2xl min-w-64">
                {(() => {
                  const plot = plots.find((p: TacticalLandPlot) => p.plot_number === hoveredPlot);
                  const rdlPricing = plot ? calculateRDLPrice(plot.current_price) : null;
                  return plot ? (
                    <div className="text-center space-y-2">
                      <div className="font-bold text-cyan-300 text-base font-mono">SECTOR #{plot.plot_number}</div>
                      <div className="text-sm font-mono">{getTerrainEmoji(plot.terrain_type)} {plot.terrain_type.toUpperCase()} TERRAIN</div>
                      
                      {/* XRP Price */}
                      <div className="text-lg font-bold text-blue-400">{plot.current_price} XRP</div>
                      
                      {/* RDL Price with Discount */}
                      {rdlPricing && (
                        <div className="space-y-1">
                          <div className="text-xs text-gray-400 line-through">
                            {rdlPricing.fullPrice.toFixed(2)} RDL
                          </div>
                          <div className="text-sm font-bold text-purple-400">
                            {rdlPricing.discountedPrice.toFixed(2)} RDL
                            <span className="text-xs text-green-400 ml-1">(-{rdlPricing.discountPercent}%)</span>
                          </div>
                        </div>
                      )}
                      
                      <div className="text-xs text-green-400 font-mono">{plot.yield_rate}% STRATEGIC VALUE</div>
                      <div className="text-xs text-slate-300 font-mono">GRID: {plot.grid_section}</div>
                      {plot.status === 'available' ? (
                        <Button 
                          size="sm" 
                          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold mt-2 font-mono"
                          onClick={() => handlePlotClick(plot)}
                          data-testid="button-quick-purchase"
                        >
                          <MapPin className="h-3 w-3 mr-1" />
                          SECURE SECTOR
                        </Button>
                      ) : (
                        <div className="text-xs text-red-400 mt-2 font-mono">
                          🛑 OCCUPIED BY {plot.owner_handle?.toUpperCase()}
                        </div>
                      )}
                    </div>
                  ) : null;
                })()}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sector Details Dialog */}
      <Dialog open={showPlotDialog} onOpenChange={setShowPlotDialog}>
        <DialogContent className="bg-gradient-to-br from-slate-800 to-gray-800 border-slate-600 text-slate-100 sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-cyan-300 text-xl font-mono">
              {selectedPlot && (
                <>
                  {(() => {
                    const TerrainIcon = getTerrainIcon(selectedPlot.terrain_type);
                    return <TerrainIcon className="h-6 w-6" />;
                  })()}
                  {getTerrainEmoji(selectedPlot.terrain_type)} SECTOR #{selectedPlot.plot_number} - {selectedPlot.terrain_type.toUpperCase()}
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-slate-300 text-base font-mono">
              {selectedPlot?.description}
            </DialogDescription>
          </DialogHeader>
          {selectedPlot && (
            <div className="space-y-6">
              {/* Plot Information Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="bg-black/20 p-4 rounded border border-amber-600/30">
                    <h4 className="font-bold text-amber-300 mb-3">Location & Terrain</h4>
                    <div className="space-y-2 text-sm">
                      <p>Coordinates: ({selectedPlot.map_x}, {selectedPlot.map_y})</p>
                      <p>Grid Section: {selectedPlot.grid_section}</p>
                      <p>Terrain: {selectedPlot.terrain_subtype}</p>
                      {selectedPlot.size_multiplier > 1 && (
                        <Badge className="bg-purple-600 text-purple-100">
                          {selectedPlot.size_multiplier}x Sizeable Domain
                        </Badge>
                      )}
                    </div>
                  </div>

                  {selectedPlot.special_features.length > 0 && (
                    <div className="bg-black/20 p-4 rounded border border-purple-600/30">
                      <h4 className="font-bold text-purple-300 mb-3">Special Features</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedPlot.special_features.map((feature, index) => (
                          <Badge key={index} className="bg-purple-700 text-purple-100">
                            {feature.replace(/_/g, ' ')}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="bg-black/20 p-4 rounded border border-blue-600/30">
                    <h4 className="font-bold text-blue-300 mb-3">Investment Options</h4>
                    <div className="space-y-3">
                      {/* XRP Pricing */}
                      <div className="border-b border-gray-600/30 pb-2">
                        <div className="flex justify-between items-center">
                          <span className="text-blue-300">XRP Price:</span>
                          <span className="font-bold text-blue-400">{selectedPlot.current_price} XRP</span>
                        </div>
                      </div>
                      
                      {/* RDL Pricing with Discount */}
                      {(() => {
                        const rdlPricing = calculateRDLPrice(selectedPlot.current_price);
                        return rdlPricing ? (
                          <div className="border-b border-gray-600/30 pb-2">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-purple-300">RDL Price:</span>
                              <div className="text-right">
                                <div className="text-xs text-gray-400 line-through">
                                  {rdlPricing.fullPrice.toFixed(2)} RDL
                                </div>
                                <div className="font-bold text-purple-400">
                                  {rdlPricing.discountedPrice.toFixed(2)} RDL
                                </div>
                              </div>
                            </div>
                            <div className="text-xs text-green-400 text-right">
                              Save {rdlPricing.discountPercent}% with RDL!
                            </div>
                            {exchangeRates && (
                              <div className="text-xs text-gray-400 text-right mt-1">
                                Rate: 1 XRP = {exchangeRates.rate?.toFixed(4)} RDL
                              </div>
                            )}
                          </div>
                        ) : null;
                      })()}
                      
                      <div className="flex justify-between">
                        <span>Yearly Yield:</span>
                        <span className="font-bold text-green-400">{selectedPlot.yield_rate}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Plot Size:</span>
                        <span className="font-bold text-yellow-400">{selectedPlot.plot_size}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-black/20 p-4 rounded border border-amber-600/30">
                    <h4 className="font-bold text-amber-300 mb-3">Ancient Lore</h4>
                    <p className="text-sm text-amber-200 italic">{selectedPlot.lore}</p>
                  </div>
                </div>
              </div>

              {/* Purchase Section */}
              {selectedPlot.status === 'available' ? (
                <div className="space-y-3">
                  <div className="p-4 bg-green-900/50 rounded border border-green-600">
                    <p className="text-green-300 font-bold">⚔️ This domain awaits a worthy lord!</p>
                    <p className="text-sm text-green-400">Purchase with XRP and earn {selectedPlot.yield_rate}% yearly returns</p>
                  </div>
                  <div className="space-y-2">
                    <Button 
                      className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold text-lg py-3"
                      onClick={() => handlePurchasePlot(selectedPlot)}
                      data-testid="button-purchase-plot-xrp"
                    >
                      <Coins className="h-5 w-5 mr-2" />
                      Claim for {selectedPlot.current_price} XRP
                    </Button>
                    {(() => {
                      const rdlPricing = calculateRDLPrice(selectedPlot.current_price);
                      return rdlPricing ? (
                        <Button 
                          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold text-lg py-3"
                          onClick={() => handlePurchasePlot(selectedPlot)}
                          data-testid="button-purchase-plot-rdl"
                        >
                          <Sparkles className="h-5 w-5 mr-2" />
                          Claim for {rdlPricing.discountedPrice.toFixed(2)} RDL 
                          <span className="text-green-300 ml-2">(-{rdlPricing.discountPercent}%)</span>
                        </Button>
                      ) : null;
                    })()}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-red-900/50 rounded border border-red-600">
                  <p className="text-red-300 font-bold">🏰 This domain is claimed by Lord {selectedPlot.owner_handle}</p>
                  <p className="text-sm text-red-400">This territory is under the protection of another ruler</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
