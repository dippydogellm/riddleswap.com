/**
 * ULTRA-SIMPLE 3D Globe - NO CRASHES
 * Minimal WebGL usage to prevent context loss
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  MapPin, 
  Coins, 
  Maximize,
  Minimize,
  Filter,
  X,
  Trees,
  Mountain,
  Waves,
  Crown,
  Store,
  Castle
} from 'lucide-react';

interface LandPlot {
  id: number;
  x: number;
  y: number;
  terrain_type: 'forest' | 'mountain' | 'plains' | 'water' | 'castle' | 'village';
  owner?: string;
  description: string;
  image_url?: string;
  resources: string[];
  claimed_at?: string;
  value: number;
  xrp_price: number;
  yearly_yield?: number;
  yield_percentage?: number;
  size_multiplier?: number;
}

interface LandFilters {
  terrainTypes: string[];
  ownershipStatus: 'all' | 'available' | 'owned';
  priceRange: [number, number];
  hasResources: boolean;
  searchTerm: string;
  sizePremium: boolean;
}

interface GlobeProps {
  plots: LandPlot[];
  onPlotClick?: (plot: LandPlot) => void;
  isResponsive?: boolean;
  showYields?: boolean;
}

// Convert plot coordinates to 3D sphere positions using REAL geographic coordinates
const convertToSphericalCoords = (x: number, y: number, gridWidth: number = 40, gridHeight: number = 25) => {
  // Map gaming grid to real geographic coordinates (Iceland region)
  // 40x25 grid mapped to Iceland (64.9°N, 19.0°W to 63.0°N, 13.0°W)
  const longitude = (-19.0 + (x / (gridWidth - 1)) * 6.0) * (Math.PI / 180); // Convert to radians
  const latitude = (64.9 - (y / (gridHeight - 1)) * 1.9) * (Math.PI / 180); // Convert to radians
  const radius = 5.2;
  
  return {
    x: radius * Math.cos(latitude) * Math.cos(longitude),
    y: radius * Math.sin(latitude),
    z: radius * Math.cos(latitude) * Math.sin(longitude)
  };
};

// Get terrain color
const getTerrainColor = (terrain: string): string => {
  switch (terrain) {
    case 'forest': return '#22c55e';
    case 'mountain': return '#6b7280';
    case 'plains': return '#eab308';
    case 'water': return '#3b82f6';
    case 'village': return '#f97316';
    case 'castle': return '#a855f7';
    default: return '#64748b';
  }
};

// Get terrain icon
const getTerrainIcon = (terrain: string) => {
  switch (terrain) {
    case 'forest': return Trees;
    case 'mountain': return Mountain;
    case 'plains': return Crown;
    case 'water': return Waves;
    case 'village': return Store;
    case 'castle': return Castle;
    default: return MapPin;
  }
};

// ULTRA-SIMPLE Plot Marker - No animations, minimal materials
function SimplePlotMarker({ plot, position, onClick }: { 
  plot: LandPlot; 
  position: [number, number, number]; 
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const color = plot.owner ? '#ef4444' : getTerrainColor(plot.terrain_type);
  const scale = hovered ? 1.3 : (plot.owner ? 0.8 : 1.0);

  return (
    <group position={position}>
      <mesh
        scale={[scale, scale, scale]}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHovered(false);
        }}
      >
        <sphereGeometry args={[0.05, 4, 3]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

// ULTRA-SIMPLE Globe - Just wireframe, no textures
function SimpleGlobe({ autoRotate }: { autoRotate: boolean }) {
  const globeRef = useRef<THREE.Mesh>(null);
  
  useFrame(() => {
    if (autoRotate && globeRef.current) {
      globeRef.current.rotation.y += 0.003;
    }
  });

  return (
    <mesh ref={globeRef}>
      <sphereGeometry args={[5, 12, 8]} />
      <meshBasicMaterial color="#1e40af" wireframe />
    </mesh>
  );
}

// Simple Scene
function SimpleGlobeScene({ plots, onPlotClick, autoRotate, controlsRef }: { 
  plots: LandPlot[]; 
  onPlotClick: (plot: LandPlot) => void;
  autoRotate: boolean;
  controlsRef: React.MutableRefObject<any>;
}) {
  const plotPositions = useMemo(() => {
    return plots.slice(0, 100).map(plot => { // Limit to 100 plots max
      const coords = convertToSphericalCoords(plot.x, plot.y);
      return {
        plot,
        position: [coords.x, coords.y, coords.z] as [number, number, number]
      };
    });
  }, [plots]);

  return (
    <>
      {/* Minimal lighting */}
      <ambientLight intensity={1} />
      
      {/* Simple Globe */}
      <SimpleGlobe autoRotate={autoRotate} />
      
      {/* Limited Plot Markers */}
      {plotPositions.map(({ plot, position }) => (
        <SimplePlotMarker
          key={plot.id}
          plot={plot}
          position={position}
          onClick={() => onPlotClick(plot)}
        />
      ))}
      
      {/* Simple Controls */}
      <OrbitControls
        ref={controlsRef}
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        zoomSpeed={0.5}
        panSpeed={0.3}
        rotateSpeed={0.3}
        minDistance={8}
        maxDistance={15}
        enableDamping={false}
      />
    </>
  );
}

// Simple Controls
function SimpleControls({ onZoomIn, onZoomOut, onReset, onFullscreen, isFullscreen }: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onFullscreen: () => void;
  isFullscreen: boolean;
}) {
  return (
    <div className="absolute top-4 right-4 z-50 flex flex-col gap-2">
      <Button size="sm" variant="outline" className="bg-slate-800/90 border-slate-600 text-white" onClick={onFullscreen}>
        {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
      </Button>
      <Button size="sm" variant="outline" className="bg-slate-800/90 border-slate-600 text-white" onClick={onZoomIn}>
        <ZoomIn className="h-4 w-4" />
      </Button>
      <Button size="sm" variant="outline" className="bg-slate-800/90 border-slate-600 text-white" onClick={onZoomOut}>
        <ZoomOut className="h-4 w-4" />
      </Button>
      <Button size="sm" variant="outline" className="bg-slate-800/90 border-slate-600 text-white" onClick={onReset}>
        <RotateCcw className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function Simple3DGlobe({ plots, onPlotClick, isResponsive = true, showYields = false }: GlobeProps) {
  const [selectedPlot, setSelectedPlot] = useState<LandPlot | null>(null);
  const [showPlotDialog, setShowPlotDialog] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<any>(null);

  // Fullscreen functionality
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handlePlotClick = (plot: LandPlot) => {
    setSelectedPlot(plot);
    setShowPlotDialog(true);
    onPlotClick?.(plot);
  };

  const handleZoomIn = () => {
    if (controlsRef.current) {
      controlsRef.current.dollyIn(1.2);
      controlsRef.current.update();
    }
  };

  const handleZoomOut = () => {
    if (controlsRef.current) {
      controlsRef.current.dollyOut(1.2);
      controlsRef.current.update();
    }
  };

  const handleReset = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

  const handleFullscreen = async () => {
    if (!containerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.warn('Fullscreen failed:', error);
    }
  };

  const containerHeight = isFullscreen ? 'h-screen' : 'h-[600px]';

  return (
    <div className="w-full relative">
      {/* Globe Container */}
      <div 
        ref={containerRef}
        className={`${isFullscreen ? 'fixed inset-0 z-[9999]' : 'relative'}`}
      >
        <Card className={`bg-gradient-to-br from-slate-900/95 to-gray-900/95 border-slate-600/50 overflow-hidden ${isFullscreen ? 'h-full border-0 rounded-none' : ''}`}>
          <CardContent className="p-0 relative">
            <div 
              className={`relative bg-black/60 ${containerHeight}`}
              data-testid="globe-container"
            >
              {/* ULTRA-SIMPLE Canvas */}
              <Canvas
                camera={{ position: [0, 0, 12], fov: 50 }}
                gl={{ 
                  alpha: false,
                  antialias: false,
                  powerPreference: "default",
                  preserveDrawingBuffer: false,
                  failIfMajorPerformanceCaveat: true,
                  precision: 'lowp'
                }}
                dpr={1}
                frameloop="demand"
              >
                <SimpleGlobeScene 
                  plots={plots} 
                  onPlotClick={handlePlotClick}
                  autoRotate={autoRotate}
                  controlsRef={controlsRef}
                />
              </Canvas>
            
              {/* Simple Controls */}
              <SimpleControls
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                onReset={handleReset}
                onFullscreen={handleFullscreen}
                isFullscreen={isFullscreen}
              />
            
              {/* Auto-rotate toggle */}
              <div className="absolute bottom-4 left-4 z-40">
                <Button
                  size="sm"
                  variant={autoRotate ? "default" : "outline"}
                  className={autoRotate ? 'bg-blue-600' : 'bg-slate-800 border-slate-600 text-white'}
                  onClick={() => setAutoRotate(!autoRotate)}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  {autoRotate ? 'Stop' : 'Spin'}
                </Button>
              </div>
              
              {/* Simple Stats */}
              <div className="absolute top-4 left-4 z-40">
                <div className="bg-slate-900/95 text-white px-4 py-3 rounded-lg text-sm">
                  <div className="font-bold text-cyan-300 mb-1">🌍 Globe (Simplified)</div>
                  <div className="text-xs space-y-1">
                    <div className="text-green-400">Available: {plots.filter(p => !p.owner).length}</div>
                    <div className="text-red-400">Claimed: {plots.filter(p => p.owner).length}</div>
                    <div className="text-blue-400">Total: {plots.length}</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plot Details Dialog */}
      <Dialog open={showPlotDialog} onOpenChange={setShowPlotDialog}>
        <DialogContent className="bg-gradient-to-br from-slate-800 to-gray-800 border-slate-600 text-slate-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-cyan-300">
              {selectedPlot && (
                <>
                  {(() => {
                    const TerrainIcon = getTerrainIcon(selectedPlot.terrain_type);
                    return <TerrainIcon className="h-5 w-5" />;
                  })()}
                  Plot #{selectedPlot.id} - {selectedPlot.terrain_type}
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-slate-300">
              {selectedPlot?.description}
            </DialogDescription>
          </DialogHeader>
          
          {selectedPlot && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-400">Coordinates:</span>
                  <div className="font-mono">({selectedPlot.x}, {selectedPlot.y})</div>
                </div>
                <div>
                  <span className="text-slate-400">Price:</span>
                  <div className="text-blue-400 font-bold">{selectedPlot.xrp_price} XRP</div>
                </div>
              </div>
              
              {!selectedPlot.owner && (
                <Button 
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600"
                  onClick={() => setShowPlotDialog(false)}
                >
                  <Coins className="h-4 w-4 mr-2" />
                  Claim for {selectedPlot.xrp_price} XRP
                </Button>
              )}
              
              {selectedPlot.owner && (
                <div className="bg-red-900/20 p-3 rounded border border-red-600/30 text-center">
                  <div className="text-red-300 font-bold">Owned by {selectedPlot.owner}</div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
