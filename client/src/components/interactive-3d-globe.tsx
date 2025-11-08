/**
 * Interactive 3D Globe Component - NO FALLBACKS
 * Features: Spinning, zooming, click interactions, plot markers, responsive design, FULLSCREEN
 */

import React, { useRef, useState, useEffect, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  MapPin, 
  Coins, 
  Sparkles,
  Mountain,
  Trees,
  Waves,
  Crown,
  Store,
  Castle,
  Maximize,
  Minimize,
  Filter,
  X,
  Search,
  ChevronDown,
  DollarSign,
  User,
  Calendar
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
  yieldRange: [number, number];
  hasResources: boolean;
  searchTerm: string;
  sizePremium: boolean;
  sizeMultiplier: 'all' | 'small' | 'medium' | 'large' | 'premium';
}

interface GlobeProps {
  plots: LandPlot[];
  onPlotClick?: (plot: LandPlot) => void;
  isResponsive?: boolean;
  showYields?: boolean;
}

// Convert flat 2D coordinates to REAL geographic coordinates
const convertToSphericalCoords = (x: number, y: number, gridWidth: number = 40, gridHeight: number = 25) => {
  // Map gaming grid to real geographic coordinates (Iceland region)
  // 40x25 grid mapped to Iceland (64.9°N, 19.0°W to 63.0°N, 13.0°W)
  const longitude = (-19.0 + (x / (gridWidth - 1)) * 6.0) * (Math.PI / 180); // Convert to radians
  const latitude = (64.9 - (y / (gridHeight - 1)) * 1.9) * (Math.PI / 180); // Convert to radians
  
  // Convert to 3D coordinates on unit sphere
  const radius = 5; // Globe radius
  const sphereX = radius * Math.cos(latitude) * Math.cos(longitude);
  const sphereY = radius * Math.sin(latitude);
  const sphereZ = radius * Math.cos(latitude) * Math.sin(longitude);
  
  return { x: sphereX, y: sphereY, z: sphereZ, longitude, latitude };
};

const getTerrainColor = (terrain: LandPlot['terrain_type']): string => {
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

const getTerrainIcon = (terrain: LandPlot['terrain_type']) => {
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

// Stable WebGL setup to prevent context loss
const setupWebGL = (gl: THREE.WebGLRenderer) => {
  try {
    // Conservative settings to prevent context loss
    gl.setPixelRatio(1); // Fixed to 1 for stability
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.shadowMap.enabled = false; // Disable shadows to prevent context loss
    
    // Handle context loss events
    const canvas = gl.domElement;
    
    canvas.addEventListener('webglcontextlost', (event) => {
      console.warn('⚠️ WebGL context lost, preventing default');
      event.preventDefault();
    });
    
    canvas.addEventListener('webglcontextrestored', () => {
      console.log('✅ WebGL context restored, reloading...');
      window.location.reload();
    });
    
    console.log('✅ Stable WebGL setup completed');
    return true;
  } catch (error) {
    console.warn('WebGL setup warning:', error);
    return true;
  }
};

// Enhanced Plot marker component for 3D space
function PlotMarker({ plot, position, onClick, isHovered, onHover }: { 
  plot: LandPlot; 
  position: [number, number, number]; 
  onClick: () => void;
  isHovered: boolean;
  onHover: (hover: boolean) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const color = getTerrainColor(plot.terrain_type);
  
  useFrame((state) => {
    if (!meshRef.current || !isHovered) return;
    
    // Smooth pulsing animation for hovered plots
    const scale = 1.3 + Math.sin(state.clock.elapsedTime * 4) * 0.1;
    meshRef.current.scale.setScalar(scale);
  });

  // Reset scale when not hovered
  useEffect(() => {
    if (!isHovered && meshRef.current) {
      meshRef.current.scale.setScalar(1);
    }
  }, [isHovered]);

  // Ensure valid position
  const safePosition: [number, number, number] = [
    isFinite(position[0]) ? position[0] : 0,
    isFinite(position[1]) ? position[1] : 0,
    isFinite(position[2]) ? position[2] : 0
  ];

  return (
    <group position={safePosition}>
      <mesh
        ref={meshRef}
        onClick={onClick}
        onPointerEnter={() => onHover(true)}
        onPointerLeave={() => onHover(false)}
      >
        <sphereGeometry args={[0.08, 12, 12]} />
        <meshStandardMaterial 
          color={color} 
          transparent 
          opacity={isHovered ? 0.9 : 0.7}
          emissive={isHovered ? color : '#000000'}
          emissiveIntensity={isHovered ? 0.2 : 0}
          roughness={0.4}
          metalness={0.1}
        />
      </mesh>
      
      {/* Size multiplier indicator */}
      {plot.size_multiplier && plot.size_multiplier > 1 && (
        <mesh position={[0.1, 0.1, 0]}>
          <sphereGeometry args={[0.03, 8, 8]} />
          <meshStandardMaterial color="#a855f7" emissive="#a855f7" emissiveIntensity={0.3} />
        </mesh>
      )}
      
      {/* Owned plot indicator */}
      {plot.owner && (
        <mesh position={[0, 0.15, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.1]} />
          <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.4} />
        </mesh>
      )}
      
      {/* Enhanced hover info */}
      {isHovered && (
        <Html distanceFactor={10} position={[0, 0.3, 0]} center>
          <div className="bg-slate-900/95 text-white px-3 py-2 rounded-lg text-sm border border-slate-600 backdrop-blur-sm shadow-lg">
            <div className="font-bold text-cyan-300">Plot #{plot.id}</div>
            <div className="text-slate-300">{plot.terrain_type}</div>
            <div className="text-blue-400 font-semibold">{plot.xrp_price} XRP</div>
          </div>
        </Html>
      )}
    </group>
  );
}

// Animated Earth Globe
function EarthGlobe({ earthRef }: { earthRef: React.RefObject<THREE.Mesh> }) {
  // Create earth-like texture using gradient
  const earthTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    
    // Create ocean base
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, '#1e40af'); // Deep blue
    gradient.addColorStop(0.3, '#3b82f6'); // Ocean blue
    gradient.addColorStop(0.7, '#22c55e'); // Land green
    gradient.addColorStop(1, '#16a34a'); // Dark green
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1024, 512);
    
    // Add some continent-like patterns
    ctx.fillStyle = '#16a34a';
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * 1024;
      const y = Math.random() * 512;
      const size = 50 + Math.random() * 100;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    
    return new THREE.CanvasTexture(canvas);
  }, []);

  return (
    <mesh ref={earthRef}>
      <sphereGeometry args={[5, 64, 32]} />
      <meshLambertMaterial map={earthTexture} />
    </mesh>
  );
}

// Advanced Land Filters Component
function LandFilters({ filters, onFiltersChange, plotCount, totalPlots, searchResults, showSearchResults, onSelectSearchResult }: {
  filters: LandFilters;
  onFiltersChange: (filters: LandFilters) => void;
  plotCount: number;
  totalPlots: number;
  searchResults: LandPlot[];
  showSearchResults: boolean;
  onSelectSearchResult: (plot: LandPlot) => void;
}) {
  const terrainOptions = [
    { value: 'forest', label: 'Forest', icon: Trees, color: '#22c55e' },
    { value: 'mountain', label: 'Mountain', icon: Mountain, color: '#6b7280' },
    { value: 'plains', label: 'Plains', icon: Crown, color: '#eab308' },
    { value: 'water', label: 'Water', icon: Waves, color: '#3b82f6' },
    { value: 'village', label: 'Village', icon: Store, color: '#f97316' },
    { value: 'castle', label: 'Castle', icon: Castle, color: '#a855f7' }
  ];

  const handleTerrainToggle = (terrain: string) => {
    const newTerrainTypes = filters.terrainTypes.includes(terrain)
      ? filters.terrainTypes.filter(t => t !== terrain)
      : [...filters.terrainTypes, terrain];
    
    onFiltersChange({ ...filters, terrainTypes: newTerrainTypes });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      terrainTypes: [],
      ownershipStatus: 'all',
      priceRange: [0, 1000],
      yieldRange: [0, 20],
      hasResources: false,
      searchTerm: '',
      sizePremium: false,
      sizeMultiplier: 'all'
    });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="bg-slate-800/90 border-slate-600 text-white hover:bg-slate-700 backdrop-blur-sm"
          data-testid="button-land-filters"
        >
          <Filter className="h-4 w-4 mr-1" />
          Filters
          {(filters.terrainTypes.length > 0 || filters.ownershipStatus !== 'all' || filters.searchTerm) && (
            <Badge className="ml-2 bg-blue-600 text-white text-xs px-1.5 py-0.5">
              {plotCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 bg-slate-900/95 border-slate-600 text-white backdrop-blur-sm" 
        side="left" 
        align="start"
      >
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-cyan-300">🌍 Land Filters</h3>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={clearAllFilters}
              className="text-slate-400 hover:text-white"
              data-testid="button-clear-filters"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>

          {/* Results Count */}
          <div className="text-sm text-slate-400">
            Showing {plotCount} of {totalPlots} plots
          </div>

          {/* Search with Results Popup */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">🔍 Search</Label>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
              <Input
                placeholder="Search by ID, resources..."
                value={filters.searchTerm}
                onChange={(e) => onFiltersChange({ ...filters, searchTerm: e.target.value })}
                className="pl-10 bg-slate-800 border-slate-600 text-white"
                data-testid="input-search-plots"
              />
              
              {/* Search Results Popup */}
              {showSearchResults && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
                  {searchResults.map((plot) => (
                    <button
                      key={plot.id}
                      onClick={() => onSelectSearchResult(plot)}
                      className="w-full text-left px-3 py-2 hover:bg-slate-700 border-b border-slate-700 last:border-b-0 text-sm"
                      data-testid={`search-result-${plot.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-white">
                            Plot #{plot.id} - {plot.terrain_type}
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            {plot.description}
                            {plot.owner && (
                              <span className="text-red-400 ml-2">• Owned</span>
                            )}
                          </div>
                          {plot.resources.length > 0 && (
                            <div className="text-xs text-blue-400 mt-1">
                              Resources: {plot.resources.join(', ')}
                            </div>
                          )}
                        </div>
                        <div className="text-right text-xs text-slate-400">
                          <div>{plot.xrp_price} XRP</div>
                          {plot.yield_percentage && (
                            <div className="text-green-400">{plot.yield_percentage}% yield</div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Terrain Types */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">🏔️ Terrain Types</Label>
            <div className="grid grid-cols-2 gap-2">
              {terrainOptions.map(({ value, label, icon: Icon, color }) => {
                const isSelected = filters.terrainTypes.includes(value);
                return (
                  <Button
                    key={value}
                    size="sm"
                    variant={isSelected ? "default" : "outline"}
                    onClick={() => handleTerrainToggle(value)}
                    className={`justify-start text-xs ${
                      isSelected 
                        ? 'bg-blue-600 border-blue-500 text-white' 
                        : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'
                    }`}
                    data-testid={`filter-terrain-${value}`}
                  >
                    <Icon className="h-3 w-3 mr-1" style={{ color: isSelected ? 'white' : color }} />
                    {label}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Ownership Status */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">👤 Ownership</Label>
            <Select 
              value={filters.ownershipStatus} 
              onValueChange={(value: 'all' | 'available' | 'owned') => 
                onFiltersChange({ ...filters, ownershipStatus: value })
              }
            >
              <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                <SelectItem value="all" className="text-white">All Plots</SelectItem>
                <SelectItem value="available" className="text-green-400">Available Only</SelectItem>
                <SelectItem value="owned" className="text-red-400">Owned Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Price Range */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">💰 Price Range (XRP)</Label>
            <div className="px-2">
              <Slider
                value={filters.priceRange}
                onValueChange={(value) => onFiltersChange({ ...filters, priceRange: value as [number, number] })}
                max={1000}
                min={0}
                step={10}
                className="w-full"
                data-testid="slider-price-range"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>{filters.priceRange[0]} XRP</span>
                <span>{filters.priceRange[1]} XRP</span>
              </div>
            </div>
          </div>

          {/* Additional Filters */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="has-resources"
                checked={filters.hasResources}
                onCheckedChange={(checked) => 
                  onFiltersChange({ ...filters, hasResources: checked as boolean })
                }
                data-testid="checkbox-has-resources"
              />
              <Label htmlFor="has-resources" className="text-sm">🎯 Has Resources</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="size-premium"
                checked={filters.sizePremium}
                onCheckedChange={(checked) => 
                  onFiltersChange({ ...filters, sizePremium: checked as boolean })
                }
                data-testid="checkbox-size-premium"
              />
              <Label htmlFor="size-premium" className="text-sm">⭐ Premium Size</Label>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Enhanced Controls component with fullscreen
function GlobeControls({ onZoomIn, onZoomOut, onReset, onFullscreen, isFullscreen, filters, onFiltersChange, plotCount, totalPlots, searchResults, showSearchResults, onSelectSearchResult }: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onFullscreen: () => void;
  isFullscreen: boolean;
  filters: LandFilters;
  onFiltersChange: (filters: LandFilters) => void;
  plotCount: number;
  totalPlots: number;
  searchResults: LandPlot[];
  showSearchResults: boolean;
  onSelectSearchResult: (plot: LandPlot) => void;
}) {
  return (
    <div className="absolute top-4 right-4 z-50 flex flex-col gap-2">
      <LandFilters 
        filters={filters}
        onFiltersChange={onFiltersChange}
        plotCount={plotCount}
        totalPlots={totalPlots}
        searchResults={searchResults}
        showSearchResults={showSearchResults}
        onSelectSearchResult={onSelectSearchResult}
      />
      <Button
        size="sm"
        variant="outline"
        className="bg-slate-800/90 border-slate-600 text-white hover:bg-slate-700 backdrop-blur-sm"
        onClick={onFullscreen}
        data-testid="button-fullscreen"
      >
        {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="bg-slate-800/90 border-slate-600 text-white hover:bg-slate-700 backdrop-blur-sm"
        onClick={onZoomIn}
        data-testid="button-zoom-in"
      >
        <ZoomIn className="h-4 w-4" />
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="bg-slate-800/90 border-slate-600 text-white hover:bg-slate-700 backdrop-blur-sm"
        onClick={onZoomOut}
        data-testid="button-zoom-out"
      >
        <ZoomOut className="h-4 w-4" />
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="bg-slate-800/90 border-slate-600 text-white hover:bg-slate-700 backdrop-blur-sm"
        onClick={onReset}
        data-testid="button-reset-view"
      >
        <RotateCcw className="h-4 w-4" />
      </Button>
    </div>
  );
}

// Main scene component
function GlobeScene({ plots, onPlotClick, autoRotate, controlsRef, isMobile }: { 
  plots: LandPlot[]; 
  onPlotClick?: (plot: LandPlot) => void;
  autoRotate: boolean;
  controlsRef: React.MutableRefObject<any>;
  isMobile: boolean;
}) {
  const [hoveredPlot, setHoveredPlot] = useState<number | null>(null);
  const earthRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    // Only rotate earth directly when autoRotate is on and OrbitControls autoRotate is disabled
    if (autoRotate && earthRef.current) {
      earthRef.current.rotation.y = state.clock.elapsedTime * 0.1;
    }
  });

  const plotPositions = useMemo(() => {
    return plots.map(plot => {
      const coords = convertToSphericalCoords(plot.x, plot.y);
      return {
        plot,
        position: [coords.x, coords.y, coords.z] as [number, number, number]
      };
    });
  }, [plots]);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <pointLight position={[-10, -10, -5]} intensity={0.5} />
      
      {/* Earth Globe */}
      <EarthGlobe earthRef={earthRef} />
      
      {/* Plot Markers */}
      {plotPositions.map(({ plot, position }) => (
        <PlotMarker
          key={plot.id}
          plot={plot}
          position={position}
          onClick={() => onPlotClick?.(plot)}
          isHovered={hoveredPlot === plot.id}
          onHover={(hover) => setHoveredPlot(hover ? plot.id : null)}
        />
      ))}
      
      {/* Camera Controls - Mobile optimized */}
      <OrbitControls
        ref={controlsRef}
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={6}
        maxDistance={25}
        autoRotate={false}
        autoRotateSpeed={0.5}
        rotateSpeed={isMobile ? 0.5 : 1.0}
        zoomSpeed={isMobile ? 0.8 : 1.2}
        panSpeed={isMobile ? 0.5 : 0.8}
        enableDamping={true}
        dampingFactor={0.05}
        makeDefault={true}
        touches={{
          ONE: THREE.TOUCH.ROTATE,  // Use constant instead of number
          TWO: THREE.TOUCH.DOLLY_PAN // Use constant instead of number
        }}
      />
    </>
  );
}

export default function Interactive3DGlobe({ plots, onPlotClick, isResponsive = true, showYields = false }: GlobeProps) {
  const [selectedPlot, setSelectedPlot] = useState<LandPlot | null>(null);
  const [showPlotDialog, setShowPlotDialog] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [touchStartTime, setTouchStartTime] = useState(0);
  const [searchResults, setSearchResults] = useState<LandPlot[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<any>(null);
  
  // Land Filters State
  const [filters, setFilters] = useState<LandFilters>({
    terrainTypes: [],
    ownershipStatus: 'all',
    priceRange: [0, 1000],
    yieldRange: [0, 20],
    hasResources: false,
    searchTerm: '',
    sizePremium: false,
    sizeMultiplier: 'all'
  });

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      
      // Optimize performance for mobile
      if (mobile && controlsRef.current) {
        // Reduce sensitivity for mobile touch
        controlsRef.current.rotateSpeed = 0.3;
        controlsRef.current.zoomSpeed = 0.8;
        controlsRef.current.panSpeed = 0.5;
        controlsRef.current.enableDamping = true;
        controlsRef.current.dampingFactor = 0.1;
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fullscreen functionality
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handlePlotClick = (plot: LandPlot) => {
    // Prevent accidental clicks during mobile scrolling/dragging
    if (isMobile && Date.now() - touchStartTime > 300) {
      return; // Ignore long touches (likely drag gestures)
    }
    
    setSelectedPlot(plot);
    setShowPlotDialog(true);
    onPlotClick?.(plot);
  };

  const handleTouchStart = () => {
    setTouchStartTime(Date.now());
  };

  // Camera fly-to functionality
  const flyToPlot = (plot: LandPlot) => {
    if (!controlsRef.current) return;
    
    const coords = convertToSphericalCoords(plot.x, plot.y);
    const camera = controlsRef.current.object;
    const controls = controlsRef.current;
    
    // Calculate target position (slightly zoomed out from plot)
    const distance = 12;
    const direction = new THREE.Vector3(coords.x, coords.y, coords.z).normalize();
    const targetPosition = direction.multiplyScalar(distance);
    
    // Animate camera to target
    controls.target.set(coords.x, coords.y, coords.z);
    camera.position.copy(targetPosition);
    controls.update();
  };

  // Enhanced plot click with camera movement
  const handlePlotClickWithFlyTo = (plot: LandPlot) => {
    flyToPlot(plot);
    handlePlotClick(plot);
  };

  // Search functionality
  const handleSearch = (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    const results = filteredPlots.filter(plot => {
      const searchLower = searchTerm.toLowerCase();
      return (
        plot.id.toString().includes(searchLower) ||
        plot.terrain_type.toLowerCase().includes(searchLower) ||
        plot.description.toLowerCase().includes(searchLower) ||
        plot.owner?.toLowerCase().includes(searchLower) ||
        plot.resources.some(resource => resource.toLowerCase().includes(searchLower))
      );
    }).slice(0, 10); // Limit to 10 results

    setSearchResults(results);
    setShowSearchResults(results.length > 0);
  };

  const selectSearchResult = (plot: LandPlot) => {
    setShowSearchResults(false);
    flyToPlot(plot);
    setSelectedPlot(plot);
    setShowPlotDialog(true);
  };

  // Update search when filters change
  useEffect(() => {
    if (filters.searchTerm) {
      handleSearch(filters.searchTerm);
    } else {
      setSearchResults([]);
      setShowSearchResults(false);
    }
  }, [filters.searchTerm, filteredPlots]);

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

  // Filter plots based on current filters
  const filteredPlots = useMemo(() => {
    return plots.filter(plot => {
      // Terrain type filter
      if (filters.terrainTypes.length > 0 && !filters.terrainTypes.includes(plot.terrain_type)) {
        return false;
      }

      // Ownership filter
      if (filters.ownershipStatus === 'available' && plot.owner) {
        return false;
      }
      if (filters.ownershipStatus === 'owned' && !plot.owner) {
        return false;
      }

      // Price range filter
      if (plot.xrp_price < filters.priceRange[0] || plot.xrp_price > filters.priceRange[1]) {
        return false;
      }

      // Yield range filter
      if (plot.yield_percentage !== undefined) {
        if (plot.yield_percentage < filters.yieldRange[0] || plot.yield_percentage > filters.yieldRange[1]) {
          return false;
        }
      }

      // Size multiplier filter
      if (filters.sizeMultiplier !== 'all') {
        const sizeValue = plot.size_multiplier || 1;
        switch (filters.sizeMultiplier) {
          case 'small':
            if (sizeValue >= 1.5) return false;
            break;
          case 'medium':
            if (sizeValue < 1.5 || sizeValue >= 2.0) return false;
            break;
          case 'large':
            if (sizeValue < 2.0 || sizeValue >= 2.5) return false;
            break;
          case 'premium':
            if (sizeValue < 2.5) return false;
            break;
        }
      }

      // Resources filter
      if (filters.hasResources && (!plot.resources || plot.resources.length === 0)) {
        return false;
      }

      // Size premium filter (legacy)
      if (filters.sizePremium && (!plot.size_multiplier || plot.size_multiplier <= 1)) {
        return false;
      }

      // Search term filter
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const matchesId = plot.id.toString().includes(searchLower);
        const matchesDescription = plot.description.toLowerCase().includes(searchLower);
        const matchesResources = plot.resources.some(resource => 
          resource.toLowerCase().includes(searchLower)
        );
        const matchesTerrain = plot.terrain_type.toLowerCase().includes(searchLower);
        const matchesOwner = plot.owner?.toLowerCase().includes(searchLower);
        
        if (!matchesId && !matchesDescription && !matchesResources && !matchesTerrain && !matchesOwner) {
          return false;
        }
      }

      return true;
    });
  }, [plots, filters]);

  const containerHeight = isFullscreen 
    ? 'h-screen' 
    : isMobile 
      ? 'h-[400px]' 
      : 'h-[600px]';

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
              onTouchStart={handleTouchStart}
            >
              {/* Enhanced 3D Canvas - NO FALLBACKS */}
              <Canvas
                camera={{ 
                  position: [0, 0, 15], 
                  fov: isMobile ? 60 : 50 
                }}
                gl={{ 
                  alpha: false, // Disable alpha for stability
                  antialias: false, // Disable antialiasing to prevent context loss
                  powerPreference: "default", // Use default instead of high-performance
                  preserveDrawingBuffer: false,
                  failIfMajorPerformanceCaveat: true, // Fail gracefully if performance is poor
                  precision: 'mediump', // Use medium precision for stability
                  stencil: false, // Disable stencil buffer
                  depth: true
                }}
                onCreated={(state) => {
                  setupWebGL(state.gl);
                  state.gl.setClearColor(0x000011, 1.0);
                }}
                dpr={1} // Fixed pixel ratio for stability
                performance={{ min: 0.5 }} // More conservative performance threshold
                frameloop="always" // Always render for smooth rotation
              >
                <Suspense fallback={null}>
                  <GlobeScene 
                    plots={filteredPlots} 
                    onPlotClick={handlePlotClick}
                    autoRotate={autoRotate}
                    controlsRef={controlsRef}
                    isMobile={isMobile}
                  />
                </Suspense>
              </Canvas>
            
              {/* Enhanced Controls with Fullscreen and Filters */}
              <GlobeControls
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                onReset={handleReset}
                onFullscreen={handleFullscreen}
                isFullscreen={isFullscreen}
                filters={filters}
                onFiltersChange={setFilters}
                plotCount={filteredPlots.length}
                totalPlots={plots.length}
                searchResults={searchResults}
                showSearchResults={showSearchResults}
                onSelectSearchResult={selectSearchResult}
              />
            
              {/* Auto-rotate toggle */}
              <div className="absolute bottom-4 left-4 z-40">
                <Button
                  size="sm"
                  variant={autoRotate ? "default" : "outline"}
                  className={`backdrop-blur-sm ${
                    autoRotate 
                      ? 'bg-blue-600/90 hover:bg-blue-700/90' 
                      : 'bg-slate-800/90 border-slate-600 text-white hover:bg-slate-700/90'
                  }`}
                  onClick={() => setAutoRotate(!autoRotate)}
                  data-testid="button-auto-rotate"
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  {autoRotate ? 'Stop' : 'Spin'}
                </Button>
              </div>
              
              {/* Enhanced Plot Info Panel with Filter Stats */}
              <div className={`absolute ${isMobile || isFullscreen ? 'bottom-4 right-20' : 'top-4 left-4'} z-40`}>
                <div className="bg-slate-900/95 text-white px-4 py-3 rounded-lg text-sm border border-slate-600/70 backdrop-blur-sm shadow-lg">
                  <div className="font-bold text-cyan-300 mb-1">🌍 Globe Stats</div>
                  <div className="text-xs space-y-1">
                    {/* Active filter indicator */}
                    {(filters.terrainTypes.length > 0 || filters.ownershipStatus !== 'all' || filters.searchTerm) && (
                      <div className="text-yellow-400 mb-2 pb-1 border-b border-slate-700">
                        📍 Filtered: {filteredPlots.length} / {plots.length}
                      </div>
                    )}
                    <div className="text-green-400">Available: {filteredPlots.filter(p => !p.owner).length}</div>
                    <div className="text-red-400">Claimed: {filteredPlots.filter(p => p.owner).length}</div>
                    <div className="text-blue-400">Showing: {filteredPlots.length}</div>
                    {isFullscreen && (
                      <div className="text-yellow-400 mt-2 text-xs">
                        🔍 Fullscreen Mode
                      </div>
                    )}
                    {/* Filter summary */}
                    {filters.terrainTypes.length > 0 && (
                      <div className="text-purple-400 text-xs mt-1">
                        🏔️ {filters.terrainTypes.join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plot Details Dialog */}
      <Dialog open={showPlotDialog} onOpenChange={setShowPlotDialog}>
        <DialogContent className="bg-gradient-to-br from-slate-800 to-gray-800 border-slate-600 text-slate-100 max-w-md">
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
              {/* Plot Information */}
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
              
              {/* Resources */}
              <div>
                <span className="text-slate-400 text-sm">Resources:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedPlot.resources.map((resource, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {resource}
                    </Badge>
                  ))}
                </div>
              </div>
              
              {/* Yield Information - Only show if enabled */}
              {showYields && selectedPlot.yearly_yield && (
                <div className="bg-green-900/20 p-3 rounded border border-green-600/30">
                  <div className="text-green-300 font-bold text-sm">Yearly Yield</div>
                  <div className="text-green-400">{selectedPlot.yield_percentage}% ({selectedPlot.yearly_yield} XRP/year)</div>
                </div>
              )}
              
              {/* Purchase Button */}
              {!selectedPlot.owner && (
                <Button 
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  onClick={() => {
                    setShowPlotDialog(false);
                    // Handle purchase logic
                  }}
                  data-testid="button-purchase-plot"
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
