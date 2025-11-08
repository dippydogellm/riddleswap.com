import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Maximize2, 
  Minimize2,
  MapPin,
  Globe
} from 'lucide-react';

interface Plot {
  id: number;
  x: number;
  y: number;
  terrain_type: string;
  owner?: string;
  description?: string;
  resources?: string[];
  value?: number;
  xrp_price?: number;
  size_multiplier?: number;
}

interface StableGlobeViewProps {
  plots: Plot[];
  onPlotClick?: (plot: Plot) => void;
  isResponsive?: boolean;
  showYields?: boolean;
}

const StableGlobeView: React.FC<StableGlobeViewProps> = ({
  plots,
  onPlotClick,
  isResponsive = true,
  showYields = true
}) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedPlot, setSelectedPlot] = useState<Plot | null>(null);

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.2, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.2, 0.5));
  };

  const handleReset = () => {
    setZoom(1);
    setRotation(0);
  };

  const handlePlotClick = (plot: Plot) => {
    setSelectedPlot(plot);
    onPlotClick?.(plot);
  };

  const getTerrainColor = (terrain: string) => {
    const colors: Record<string, string> = {
      plains: '#90EE90',
      forest: '#228B22',
      mountain: '#8B4513',
      desert: '#F4A460',
      water: '#4169E1',
      tundra: '#E0E0E0',
      jungle: '#006400',
      swamp: '#2F4F4F',
      volcanic: '#DC143C',
      arctic: '#F0F8FF'
    };
    return colors[terrain] || '#808080';
  };

  // Convert plot coordinates to globe positions
  const convertToGlobePosition = (x: number, y: number) => {
    // Map coordinates to a circular globe representation
    const centerX = 150;
    const centerY = 150;
    const radius = 120;
    
    // Convert x,y to polar coordinates
    const angle = (x / 1000) * 2 * Math.PI + (rotation * Math.PI / 180);
    const distance = Math.min((y / 1000) * radius, radius);
    
    const plotX = centerX + Math.cos(angle) * distance;
    const plotY = centerY + Math.sin(angle) * distance;
    
    return { x: plotX, y: plotY };
  };

  const filteredPlots = plots.slice(0, 50); // Limit for performance

  return (
    <div className={`relative ${isFullscreen ? 'fixed inset-0 z-50 bg-slate-900' : 'w-full h-full'}`}>
      {/* Controls */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        <div className="bg-slate-800/90 backdrop-blur-sm rounded-lg p-2 flex flex-col gap-1">
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
            onClick={handleZoomOut}
            className="h-8 w-8 p-0 text-white hover:bg-slate-700"
            data-testid="button-zoom-out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleReset}
            className="h-8 w-8 p-0 text-white hover:bg-slate-700"
            data-testid="button-reset"
          >
            <RotateCcw className="h-4 w-4" />
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

      {/* Globe Container */}
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <div 
          className="relative"
          style={{
            transform: `scale(${zoom}) rotate(${rotation}deg)`,
            transition: 'transform 0.3s ease-out'
          }}
        >
          {/* Globe Base */}
          <div className="relative w-[300px] h-[300px] rounded-full bg-gradient-to-br from-blue-800 via-green-700 to-blue-900 border-4 border-blue-500/30 shadow-2xl">
            {/* Globe Shine Effect */}
            <div className="absolute top-8 left-8 w-16 h-16 rounded-full bg-white/20 blur-xl"></div>
            
            {/* Land Masses (decorative) */}
            <div className="absolute top-12 left-16 w-20 h-12 rounded-full bg-green-600/50 rotate-12"></div>
            <div className="absolute top-20 right-12 w-16 h-8 rounded-full bg-green-600/50 -rotate-6"></div>
            <div className="absolute bottom-16 left-8 w-24 h-10 rounded-full bg-green-600/50 rotate-45"></div>
            
            {/* Plot Markers */}
            {filteredPlots.map((plot) => {
              const position = convertToGlobePosition(plot.x, plot.y);
              return (
                <div
                  key={plot.id}
                  className="absolute cursor-pointer transform -translate-x-1/2 -translate-y-1/2 transition-all hover:scale-125"
                  style={{
                    left: `${position.x}px`,
                    top: `${position.y}px`
                  }}
                  onClick={() => handlePlotClick(plot)}
                  data-testid={`plot-marker-${plot.id}`}
                >
                  <div
                    className="w-3 h-3 rounded-full border-2 border-white shadow-lg"
                    style={{
                      backgroundColor: getTerrainColor(plot.terrain_type),
                      transform: `scale(${(plot.size_multiplier || 1) * 0.8})`
                    }}
                  ></div>
                  
                  {selectedPlot?.id === plot.id && (
                    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-slate-800/95 backdrop-blur-sm text-white text-xs rounded px-2 py-1 whitespace-nowrap z-20">
                      <div className="font-medium">{plot.terrain_type}</div>
                      {plot.owner && <div className="text-slate-300">Owner: {plot.owner}</div>}
                      {plot.xrp_price && <div className="text-green-400">{plot.xrp_price} XRP</div>}
                    </div>
                  )}
                </div>
              );
            })}
            
            {/* Center Globe Icon */}
            <div className="absolute inset-0 flex items-center justify-center">
              <Globe className="w-8 h-8 text-white/30" />
            </div>
          </div>
        </div>
      </div>

      {/* Info Panel */}
      <div className="absolute bottom-4 left-4 right-4 z-10">
        <div className="bg-slate-800/90 backdrop-blur-sm rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Globe Visualization
            </h3>
            <Badge variant="outline" className="text-white border-white/30">
              {filteredPlots.length} Plots
            </Badge>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div className="text-slate-300">
              <span className="text-white">Zoom:</span> {Math.round(zoom * 100)}%
            </div>
            <div className="text-slate-300">
              <span className="text-white">Rotation:</span> {rotation}°
            </div>
            <div className="text-slate-300">
              <span className="text-white">Mode:</span> Stable View
            </div>
            <div className="text-slate-300">
              <span className="text-white">Status:</span> <span className="text-green-400">Active</span>
            </div>
          </div>
          
          {showYields && (
            <div className="mt-2 text-xs text-slate-400">
              Click any plot marker to view details • Use controls to zoom and navigate
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default StableGlobeView;
