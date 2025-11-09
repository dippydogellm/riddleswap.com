import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { 
  Map, 
  MapPin, 
  Navigation, 
  Compass, 
  Mountain, 
  Trees, 
  Camera,
  Eye,
  Activity,
  Target,
  Globe,
  Layers,
  Route,
  Settings,
  Image,
  Clock,
  Users,
  Zap,
  Star,
  AlertTriangle,
  Shield,
  Crosshair,
  RefreshCw,
  Plus,
  Search,
  Filter,
  ChevronRight,
  MapIcon,
  Sparkles
} from 'lucide-react';
import EnhancedGlobeView from "@/components/enhanced-globe-view";

// Type definitions for mapping system
interface Location {
  id: string;
  name: string;
  description?: string;
  zone: string;
  coordinates: {
    x: number;
    y: number;
    z?: number;
  };
  latitude?: number;
  longitude?: number;
  elevation: number;
  location_type: string;
  status: string;
  danger_level: number;
  resources: Record<string, any>;
  accessibility: string;
  special_properties: Record<string, any>;
  discovered_by: string;
  discovery_date: string;
  last_visited?: string;
  visit_count: number;
  riddleauthor_notes?: string;
  map_image_url?: string;
  created_at: string;
  updated_at: string;
}

interface Zone {
  id: string;
  zone_name: string;
  description?: string;
  boundaries: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  center_lat?: number;
  center_lng?: number;
  radius_km?: number;
  zone_type: string;
  control_faction?: string;
  security_level: string;
  climate: string;
  terrain_type: string;
  population: number;
  resources: Record<string, any>;
  events_active: Record<string, any>;
  riddleauthor_lore?: string;
  map_generated: boolean;
  map_image_url?: string;
  created_at: string;
  updated_at: string;
}

interface MapAsset {
  id: string;
  asset_name: string;
  asset_type: string;
  zone_id?: string;
  location_id?: string;
  image_url: string;
  prompt_used: string;
  generation_metadata: Record<string, any>;
  coordinates?: any;
  asset_tags: string[];
  usage_context: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

const MappingSystemPage = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [currentFilter, setCurrentFilter] = useState('');
  const [coordinateInput, setCoordinateInput] = useState({ x: 0, y: 0, z: 0 });
  const [newLocationData, setNewLocationData] = useState({
    name: '',
    description: '',
    zone: '',
    coordinates: { x: 0, y: 0, z: 0 },
    latitude: 0,
    longitude: 0,
    elevation: 0,
    location_type: 'waypoint',
    danger_level: 0,
    accessibility: 'public'
  });
  const [newZoneData, setNewZoneData] = useState({
    zone_name: '',
    description: '',
    boundaries: { north: 0, south: 0, east: 0, west: 0 },
    zone_type: 'exploration',
    security_level: 'neutral',
    climate: 'temperate',
    terrain_type: 'mixed',
    population: 0
  });

  // Get all locations
  const { data: locations, isLoading: locationsLoading, refetch: refetchLocations } = useQuery<Location[]>({
    queryKey: ['/api/mapping/locations'],
    retry: 3,
  });

  // Get all zones
  const { data: zones, isLoading: zonesLoading, refetch: refetchZones } = useQuery<Zone[]>({
    queryKey: ['/api/mapping/zones'],
    retry: 3,
  });

  // Get map assets
  const { data: mapAssets, isLoading: assetsLoading } = useQuery<MapAsset[]>({
    queryKey: ['/api/mapping/assets'],
    retry: 3,
  });

  // Create sample data mutation
  const createSampleData = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/mapping/sample-data', {
        method: 'POST',
        body: JSON.stringify({}),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mapping/locations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/mapping/zones'] });
      toast({
        title: "Sample Data Created",
        description: "Sample locations and zones have been added to the map.",
      });
    },
    onError: (error) => {
      toast({
        title: "Creation Failed",
        description: "Failed to create sample data. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Create location mutation
  const createLocation = useMutation({
    mutationFn: async (locationData: any) => {
      return await apiRequest('/api/mapping/locations', {
        method: 'POST',
        body: JSON.stringify(locationData),
      });
    },
    onSuccess: () => {
      refetchLocations();
      setNewLocationData({
        name: '',
        description: '',
        zone: '',
        coordinates: { x: 0, y: 0, z: 0 },
        latitude: 0,
        longitude: 0,
        elevation: 0,
        location_type: 'waypoint',
        danger_level: 0,
        accessibility: 'public'
      });
      toast({
        title: "Location Created",
        description: "New location has been added to the map.",
      });
    },
    onError: (error) => {
      toast({
        title: "Creation Failed",
        description: "Failed to create location. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Create zone mutation
  const createZone = useMutation({
    mutationFn: async (zoneData: any) => {
      return await apiRequest('/api/mapping/zones', {
        method: 'POST',
        body: JSON.stringify(zoneData),
      });
    },
    onSuccess: () => {
      refetchZones();
      setNewZoneData({
        zone_name: '',
        description: '',
        boundaries: { north: 0, south: 0, east: 0, west: 0 },
        zone_type: 'exploration',
        security_level: 'neutral',
        climate: 'temperate',
        terrain_type: 'mixed',
        population: 0
      });
      toast({
        title: "Zone Created",
        description: "New zone has been added to the map.",
      });
    },
    onError: (error) => {
      toast({
        title: "Creation Failed",
        description: "Failed to create zone. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Generate image mutations
  const generateLocationImage = useMutation({
    mutationFn: async ({ locationId, prompt, style }: { locationId: string, prompt?: string, style?: string }) => {
      return await apiRequest(`/api/mapping/locations/${locationId}/generate-image`, {
        method: 'POST',
        body: JSON.stringify({ prompt, style }),
      });
    },
    onSuccess: () => {
      refetchLocations();
      queryClient.invalidateQueries({ queryKey: ['/api/mapping/assets'] });
      toast({
        title: "Image Generated",
        description: "AI-generated image has been created for the location.",
      });
    },
    onError: (error) => {
      toast({
        title: "Generation Failed",
        description: "Failed to generate image. Please try again.",
        variant: "destructive",
      });
    },
  });

  const generateZoneImage = useMutation({
    mutationFn: async ({ zoneId, prompt, style }: { zoneId: string, prompt?: string, style?: string }) => {
      return await apiRequest(`/api/mapping/zones/${zoneId}/generate-image`, {
        method: 'POST',
        body: JSON.stringify({ prompt, style }),
      });
    },
    onSuccess: () => {
      refetchZones();
      queryClient.invalidateQueries({ queryKey: ['/api/mapping/assets'] });
      toast({
        title: "Map Generated",
        description: "AI-generated map has been created for the zone.",
      });
    },
    onError: (error) => {
      toast({
        title: "Generation Failed",
        description: "Failed to generate map. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Filter locations based on current filter
  const filteredLocations = locations?.filter(location => 
    !currentFilter || 
    location.name.toLowerCase().includes(currentFilter.toLowerCase()) ||
    location.zone.toLowerCase().includes(currentFilter.toLowerCase()) ||
    location.location_type.toLowerCase().includes(currentFilter.toLowerCase())
  ) || [];

  const getDangerLevelColor = (level: number) => {
    if (level <= 2) return 'text-green-400 border-green-500';
    if (level <= 5) return 'text-yellow-400 border-yellow-500';
    if (level <= 7) return 'text-orange-400 border-orange-500';
    return 'text-red-400 border-red-500';
  };

  const getSecurityLevelColor = (level: string) => {
    switch (level) {
      case 'safe': return 'text-green-400 border-green-500';
      case 'neutral': return 'text-blue-400 border-blue-500';
      case 'moderate': return 'text-yellow-400 border-yellow-500';
      case 'high_danger': return 'text-red-400 border-red-500';
      default: return 'text-gray-400 border-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-r from-blue-500 to-green-500 rounded-full">
              <Map className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-green-400 bg-clip-text text-transparent">
              Mapping & Coordinate System
            </h1>
          </div>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto">
            Comprehensive mapping system with coordinate tracking, location management, AI-generated visuals, and THE ORACLE integration.
          </p>
        </div>

        {/* Main Interface Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-7 bg-slate-800/50">
            <TabsTrigger value="overview" className="flex items-center gap-2" data-testid="tab-overview">
              <Globe className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="globe" className="flex items-center gap-2" data-testid="tab-globe">
              <Sparkles className="h-4 w-4" />
              3D Globe
            </TabsTrigger>
            <TabsTrigger value="locations" className="flex items-center gap-2" data-testid="tab-locations">
              <MapPin className="h-4 w-4" />
              Locations
            </TabsTrigger>
            <TabsTrigger value="zones" className="flex items-center gap-2" data-testid="tab-zones">
              <Layers className="h-4 w-4" />
              Zones
            </TabsTrigger>
            <TabsTrigger value="coordinates" className="flex items-center gap-2" data-testid="tab-coordinates">
              <Compass className="h-4 w-4" />
              Coordinates
            </TabsTrigger>
            <TabsTrigger value="assets" className="flex items-center gap-2" data-testid="tab-assets">
              <Image className="h-4 w-4" />
              Assets
            </TabsTrigger>
            <TabsTrigger value="create" className="flex items-center gap-2" data-testid="tab-create">
              <Plus className="h-4 w-4" />
              Create
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Statistics Cards */}
              <Card className="bg-slate-800/50 border-blue-500/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-blue-300">Total Locations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-blue-400" />
                    <span className="text-2xl font-bold">{locations?.length || 0}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-green-500/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-green-300">Active Zones</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Layers className="h-5 w-5 text-green-400" />
                    <span className="text-2xl font-bold">{zones?.length || 0}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-purple-500/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-purple-300">Generated Assets</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Image className="h-5 w-5 text-purple-400" />
                    <span className="text-2xl font-bold">{mapAssets?.length || 0}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-yellow-500/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-yellow-300">Coordinate Range</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-yellow-400" />
                    <span className="text-2xl font-bold">∞</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card className="bg-slate-800/50 border-blue-500/20">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>
                  Get started with the mapping system
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button
                    onClick={() => createSampleData.mutate()}
                    disabled={createSampleData.isPending}
                    className="bg-green-600 hover:bg-green-700"
                    data-testid="button-create-sample"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Create Sample Data
                  </Button>
                  
                  <Button
                    onClick={() => setActiveTab('create')}
                    className="bg-blue-600 hover:bg-blue-700"
                    data-testid="button-add-location"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add New Location
                  </Button>
                  
                  <Button
                    onClick={() => setActiveTab('coordinates')}
                    className="bg-purple-600 hover:bg-purple-700"
                    data-testid="button-coordinate-tools"
                  >
                    <Navigation className="h-4 w-4 mr-2" />
                    Coordinate Tools
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="bg-slate-800/50 border-blue-500/20">
              <CardHeader>
                <CardTitle>System Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">Mapping System</span>
                      <Badge variant="outline" className="border-green-500 text-green-400">
                        Operational
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">Image Generation</span>
                      <Badge variant="outline" className="border-green-500 text-green-400">
                        Available
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">Coordinate Tracking</span>
                      <Badge variant="outline" className="border-green-500 text-green-400">
                        Active
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">THE ORACLE Integration</span>
                      <Badge variant="outline" className="border-blue-500 text-blue-400">
                        Connected
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">Database</span>
                      <Badge variant="outline" className="border-green-500 text-green-400">
                        Connected
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">API Routes</span>
                      <Badge variant="outline" className="border-green-500 text-green-400">
                        942 Active
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 3D Globe Tab */}
          <TabsContent value="globe" className="space-y-6">
            <Card className="bg-slate-800/50 border-purple-500/20">
              <CardHeader>
                <CardTitle className="text-purple-300 flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Interactive 3D Globe Visualization
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Explore locations and zones in an immersive 3D globe environment with real-time coordinates and interactive navigation.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {locations && locations.length > 0 ? (
                  <EnhancedGlobeView 
                    plots={locations.map((location, index) => ({
                      id: String(index), // Use index as stable string ID
                      x: location.coordinates.x,
                      y: location.coordinates.y,
                      terrain_type: location.location_type as any || 'plains',
                      owner: location.discovered_by,
                      description: location.description || `${location.name} - ${location.location_type}`,
                      resources: location.resources ? Object.keys(location.resources) : ['Unknown'],
                      xrp_price: location.danger_level * 10,
                      size_multiplier: location.elevation > 1000 ? 2 : 1
                    }))}
                    onPlotClick={(plot) => {
                      const location = locations[parseInt(plot.id)]; // Parse string ID back to index
                      if (location) {
                        setSelectedLocation(location);
                        setActiveTab('locations');
                      }
                    }}
                    showYields={false}
                  />
                ) : (
                  <div className="flex items-center justify-center h-[400px] text-slate-400">
                    <div className="text-center">
                      <Globe className="h-16 w-16 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium mb-2">No Locations to Display</p>
                      <p className="text-sm">Create some locations to see them on the 3D globe</p>
                      <Button
                        onClick={() => setActiveTab('create')}
                        className="mt-4 bg-purple-600 hover:bg-purple-700"
                        data-testid="button-create-location-from-globe"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Create First Location
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Locations Tab */}
          <TabsContent value="locations" className="space-y-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
                <Input
                  placeholder="Search locations, zones, or types..."
                  value={currentFilter}
                  onChange={(e) => setCurrentFilter(e.target.value)}
                  className="pl-10 bg-slate-700 border-slate-600"
                  data-testid="input-location-search"
                />
              </div>
              <Button onClick={() => refetchLocations()} variant="outline" data-testid="button-refresh-locations">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Locations List */}
              <Card className="bg-slate-800/50 border-blue-500/20">
                <CardHeader>
                  <CardTitle>Locations ({filteredLocations.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[600px]">
                    {locationsLoading ? (
                      <div className="flex items-center justify-center h-full">
                        <RefreshCw className="h-6 w-6 animate-spin text-blue-400" />
                      </div>
                    ) : filteredLocations.length > 0 ? (
                      <div className="space-y-3">
                        {filteredLocations.map((location) => (
                          <div
                            key={location.id}
                            className={`p-4 bg-slate-700 rounded-lg cursor-pointer transition-colors hover:bg-slate-600 ${
                              selectedLocation?.id === location.id ? 'ring-2 ring-blue-500' : ''
                            }`}
                            onClick={() => setSelectedLocation(location)}
                            data-testid={`location-card-${location.id}`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-blue-400" />
                                <h3 className="font-medium text-white">{location.name}</h3>
                              </div>
                              <Badge 
                                variant="outline" 
                                className={getDangerLevelColor(location.danger_level)}
                              >
                                Danger: {location.danger_level}/10
                              </Badge>
                            </div>
                            <p className="text-sm text-slate-300 mb-2">{location.description}</p>
                            <div className="flex items-center gap-4 text-xs text-slate-400">
                              <span>Zone: {location.zone}</span>
                              <span>Type: {location.location_type}</span>
                              <span>Status: {location.status}</span>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-slate-400 mt-1">
                              <span>Coords: ({location.coordinates.x}, {location.coordinates.y}, {location.coordinates.z || 0})</span>
                              <span>Elevation: {location.elevation}m</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full text-slate-400">
                        <div className="text-center">
                          <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No locations found</p>
                        </div>
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Location Details */}
              <Card className="bg-slate-800/50 border-blue-500/20">
                <CardHeader>
                  <CardTitle>
                    {selectedLocation ? `Location Details: ${selectedLocation.name}` : 'Select a Location'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedLocation ? (
                    <div className="space-y-4">
                      {selectedLocation.map_image_url && (
                        <div className="mb-4">
                          <img
                            src={selectedLocation.map_image_url}
                            alt={selectedLocation.name}
                            className="w-full h-48 object-cover rounded-lg"
                          />
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm text-slate-400">Zone</Label>
                          <p className="text-white">{selectedLocation.zone}</p>
                        </div>
                        <div>
                          <Label className="text-sm text-slate-400">Type</Label>
                          <p className="text-white">{selectedLocation.location_type}</p>
                        </div>
                        <div>
                          <Label className="text-sm text-slate-400">Danger Level</Label>
                          <p className="text-white">{selectedLocation.danger_level}/10</p>
                        </div>
                        <div>
                          <Label className="text-sm text-slate-400">Accessibility</Label>
                          <p className="text-white">{selectedLocation.accessibility}</p>
                        </div>
                        <div>
                          <Label className="text-sm text-slate-400">Coordinates</Label>
                          <p className="text-white">
                            ({selectedLocation.coordinates.x}, {selectedLocation.coordinates.y}, {selectedLocation.coordinates.z || 0})
                          </p>
                        </div>
                        <div>
                          <Label className="text-sm text-slate-400">Elevation</Label>
                          <p className="text-white">{selectedLocation.elevation}m</p>
                        </div>
                      </div>

                      {selectedLocation.latitude && selectedLocation.longitude && (
                        <div>
                          <Label className="text-sm text-slate-400">Real-World Coordinates</Label>
                          <p className="text-white">
                            {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
                          </p>
                        </div>
                      )}

                      <div>
                        <Label className="text-sm text-slate-400">Description</Label>
                        <p className="text-white">{selectedLocation.description}</p>
                      </div>

                      <div>
                        <Label className="text-sm text-slate-400">Discovery Info</Label>
                        <p className="text-white">
                          Discovered by {selectedLocation.discovered_by} on{' '}
                          {new Date(selectedLocation.discovery_date).toLocaleDateString()}
                        </p>
                        <p className="text-slate-400 text-sm">
                          Visit count: {selectedLocation.visit_count}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          onClick={() => generateLocationImage.mutate({ 
                            locationId: selectedLocation.id,
                            style: 'detailed fantasy landscape'
                          })}
                          disabled={generateLocationImage.isPending}
                          className="bg-purple-600 hover:bg-purple-700"
                          data-testid="button-generate-location-image"
                        >
                          <Camera className="h-4 w-4 mr-2" />
                          Generate Image
                        </Button>
                        
                        <Button
                          onClick={() => {
                            setCoordinateInput({ ...selectedLocation.coordinates, z: selectedLocation.coordinates.z || 0 });
                            setActiveTab('coordinates');
                          }}
                          variant="outline"
                          data-testid="button-view-coordinates"
                        >
                          <Compass className="h-4 w-4 mr-2" />
                          View Coordinates
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-[400px] text-slate-400">
                      <div className="text-center">
                        <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Select a location to view details</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Zones Tab */}
          <TabsContent value="zones" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Zones List */}
              <Card className="bg-slate-800/50 border-green-500/20">
                <CardHeader>
                  <CardTitle>Zones ({zones?.length || 0})</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[600px]">
                    {zonesLoading ? (
                      <div className="flex items-center justify-center h-full">
                        <RefreshCw className="h-6 w-6 animate-spin text-green-400" />
                      </div>
                    ) : zones && zones.length > 0 ? (
                      <div className="space-y-3">
                        {zones.map((zone) => (
                          <div
                            key={zone.id}
                            className={`p-4 bg-slate-700 rounded-lg cursor-pointer transition-colors hover:bg-slate-600 ${
                              selectedZone?.id === zone.id ? 'ring-2 ring-green-500' : ''
                            }`}
                            onClick={() => setSelectedZone(zone)}
                            data-testid={`zone-card-${zone.id}`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Layers className="h-4 w-4 text-green-400" />
                                <h3 className="font-medium text-white">{zone.zone_name}</h3>
                              </div>
                              <Badge 
                                variant="outline" 
                                className={getSecurityLevelColor(zone.security_level)}
                              >
                                {zone.security_level}
                              </Badge>
                            </div>
                            <p className="text-sm text-slate-300 mb-2">{zone.description}</p>
                            <div className="flex items-center gap-4 text-xs text-slate-400">
                              <span>Type: {zone.zone_type}</span>
                              <span>Climate: {zone.climate}</span>
                              <span>Terrain: {zone.terrain_type}</span>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-slate-400 mt-1">
                              <span>Population: {zone.population}</span>
                              <span>Control: {zone.control_faction || 'None'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full text-slate-400">
                        <div className="text-center">
                          <Layers className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No zones found</p>
                        </div>
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Zone Details */}
              <Card className="bg-slate-800/50 border-green-500/20">
                <CardHeader>
                  <CardTitle>
                    {selectedZone ? `Zone Details: ${selectedZone.zone_name}` : 'Select a Zone'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedZone ? (
                    <div className="space-y-4">
                      {selectedZone.map_image_url && (
                        <div className="mb-4">
                          <img
                            src={selectedZone.map_image_url}
                            alt={selectedZone.zone_name}
                            className="w-full h-48 object-cover rounded-lg"
                          />
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm text-slate-400">Zone Type</Label>
                          <p className="text-white">{selectedZone.zone_type}</p>
                        </div>
                        <div>
                          <Label className="text-sm text-slate-400">Security Level</Label>
                          <p className="text-white">{selectedZone.security_level}</p>
                        </div>
                        <div>
                          <Label className="text-sm text-slate-400">Climate</Label>
                          <p className="text-white">{selectedZone.climate}</p>
                        </div>
                        <div>
                          <Label className="text-sm text-slate-400">Terrain</Label>
                          <p className="text-white">{selectedZone.terrain_type}</p>
                        </div>
                        <div>
                          <Label className="text-sm text-slate-400">Population</Label>
                          <p className="text-white">{selectedZone.population.toLocaleString()}</p>
                        </div>
                        <div>
                          <Label className="text-sm text-slate-400">Control Faction</Label>
                          <p className="text-white">{selectedZone.control_faction || 'None'}</p>
                        </div>
                      </div>

                      <div>
                        <Label className="text-sm text-slate-400">Boundaries</Label>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <p className="text-white">North: {selectedZone.boundaries.north}</p>
                          <p className="text-white">South: {selectedZone.boundaries.south}</p>
                          <p className="text-white">East: {selectedZone.boundaries.east}</p>
                          <p className="text-white">West: {selectedZone.boundaries.west}</p>
                        </div>
                      </div>

                      {selectedZone.center_lat && selectedZone.center_lng && (
                        <div>
                          <Label className="text-sm text-slate-400">Center Coordinates</Label>
                          <p className="text-white">
                            {selectedZone.center_lat.toFixed(6)}, {selectedZone.center_lng.toFixed(6)}
                          </p>
                          {selectedZone.radius_km && (
                            <p className="text-slate-400 text-sm">Radius: {selectedZone.radius_km} km</p>
                          )}
                        </div>
                      )}

                      <div>
                        <Label className="text-sm text-slate-400">Description</Label>
                        <p className="text-white">{selectedZone.description}</p>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          onClick={() => generateZoneImage.mutate({ 
                            zoneId: selectedZone.id,
                            style: 'fantasy map'
                          })}
                          disabled={generateZoneImage.isPending}
                          className="bg-purple-600 hover:bg-purple-700"
                          data-testid="button-generate-zone-image"
                        >
                          <MapIcon className="h-4 w-4 mr-2" />
                          Generate Map
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-[400px] text-slate-400">
                      <div className="text-center">
                        <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Select a zone to view details</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Coordinates Tab */}
          <TabsContent value="coordinates" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Coordinate Tools */}
              <Card className="bg-slate-800/50 border-purple-500/20">
                <CardHeader>
                  <CardTitle>Coordinate Tools</CardTitle>
                  <CardDescription>
                    Navigate and manage coordinates in the mapping system
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label className="text-sm text-slate-400">X Coordinate</Label>
                      <Input
                        type="number"
                        value={coordinateInput.x}
                        onChange={(e) => setCoordinateInput(prev => ({ ...prev, x: parseFloat(e.target.value) || 0 }))}
                        className="bg-slate-700 border-slate-600"
                        data-testid="input-coord-x"
                      />
                    </div>
                    <div>
                      <Label className="text-sm text-slate-400">Y Coordinate</Label>
                      <Input
                        type="number"
                        value={coordinateInput.y}
                        onChange={(e) => setCoordinateInput(prev => ({ ...prev, y: parseFloat(e.target.value) || 0 }))}
                        className="bg-slate-700 border-slate-600"
                        data-testid="input-coord-y"
                      />
                    </div>
                    <div>
                      <Label className="text-sm text-slate-400">Z Coordinate</Label>
                      <Input
                        type="number"
                        value={coordinateInput.z}
                        onChange={(e) => setCoordinateInput(prev => ({ ...prev, z: parseFloat(e.target.value) || 0 }))}
                        className="bg-slate-700 border-slate-600"
                        data-testid="input-coord-z"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        // Find locations near these coordinates
                        const nearbyLocations = locations?.filter(loc => {
                          const distance = Math.sqrt(
                            Math.pow(loc.coordinates.x - coordinateInput.x, 2) +
                            Math.pow(loc.coordinates.y - coordinateInput.y, 2) +
                            Math.pow((loc.coordinates.z || 0) - coordinateInput.z, 2)
                          );
                          return distance <= 100; // Within 100 units
                        }) || [];
                        
                        toast({
                          title: "Nearby Locations",
                          description: `Found ${nearbyLocations.length} locations within 100 units.`,
                        });
                      }}
                      className="bg-blue-600 hover:bg-blue-700"
                      data-testid="button-find-nearby"
                    >
                      <Target className="h-4 w-4 mr-2" />
                      Find Nearby
                    </Button>
                    
                    <Button
                      onClick={() => {
                        setNewLocationData(prev => ({
                          ...prev,
                          coordinates: coordinateInput
                        }));
                        setActiveTab('create');
                      }}
                      variant="outline"
                      data-testid="button-create-here"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Location Here
                    </Button>
                  </div>

                  <div className="pt-4 border-t border-slate-600">
                    <Label className="text-sm text-slate-400 mb-2 block">Current Position</Label>
                    <div className="bg-slate-700 p-3 rounded-lg">
                      <p className="text-white">
                        Position: ({coordinateInput.x}, {coordinateInput.y}, {coordinateInput.z})
                      </p>
                      {selectedLocation && (
                        <p className="text-slate-400 text-sm mt-1">
                          Distance to {selectedLocation.name}: {Math.sqrt(
                            Math.pow(selectedLocation.coordinates.x - coordinateInput.x, 2) +
                            Math.pow(selectedLocation.coordinates.y - coordinateInput.y, 2) +
                            Math.pow((selectedLocation.coordinates.z || 0) - coordinateInput.z, 2)
                          ).toFixed(2)} units
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Navigation Info */}
              <Card className="bg-slate-800/50 border-purple-500/20">
                <CardHeader>
                  <CardTitle>Navigation Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedLocation ? (
                    <div className="space-y-3">
                      <div className="bg-slate-700 p-3 rounded-lg">
                        <h4 className="font-medium text-white mb-2">Selected Location</h4>
                        <p className="text-slate-300">{selectedLocation.name}</p>
                        <p className="text-slate-400 text-sm">
                          ({selectedLocation.coordinates.x}, {selectedLocation.coordinates.y}, {selectedLocation.coordinates.z || 0})
                        </p>
                      </div>
                      
                      <div className="bg-slate-700 p-3 rounded-lg">
                        <h4 className="font-medium text-white mb-2">Current Position</h4>
                        <p className="text-slate-300">
                          ({coordinateInput.x}, {coordinateInput.y}, {coordinateInput.z})
                        </p>
                      </div>
                      
                      <div className="bg-slate-700 p-3 rounded-lg">
                        <h4 className="font-medium text-white mb-2">Distance</h4>
                        <p className="text-slate-300">
                          {Math.sqrt(
                            Math.pow(selectedLocation.coordinates.x - coordinateInput.x, 2) +
                            Math.pow(selectedLocation.coordinates.y - coordinateInput.y, 2) +
                            Math.pow((selectedLocation.coordinates.z || 0) - coordinateInput.z, 2)
                          ).toFixed(2)} units
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-slate-400">
                      <div className="text-center">
                        <Navigation className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Select a location for navigation info</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Assets Tab */}
          <TabsContent value="assets" className="space-y-6">
            <Card className="bg-slate-800/50 border-purple-500/20">
              <CardHeader>
                <CardTitle>Generated Map Assets ({mapAssets?.length || 0})</CardTitle>
                <CardDescription>
                  AI-generated images and map assets for locations and zones
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  {assetsLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <RefreshCw className="h-6 w-6 animate-spin text-purple-400" />
                    </div>
                  ) : mapAssets && mapAssets.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {mapAssets.map((asset) => (
                        <div key={asset.id} className="bg-slate-700 rounded-lg overflow-hidden">
                          <img
                            src={asset.image_url}
                            alt={asset.asset_name}
                            className="w-full h-48 object-cover"
                          />
                          <div className="p-4">
                            <h3 className="font-medium text-white mb-2">{asset.asset_name}</h3>
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline" className="border-purple-500 text-purple-400">
                                {asset.asset_type}
                              </Badge>
                              <Badge variant="outline" className="border-blue-500 text-blue-400">
                                {asset.created_by}
                              </Badge>
                            </div>
                            <p className="text-sm text-slate-400 mb-3">
                              {asset.prompt_used}
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {asset.asset_tags.map((tag, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                            <p className="text-xs text-slate-500 mt-2">
                              {new Date(asset.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-400">
                      <div className="text-center">
                        <Image className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No generated assets yet</p>
                      </div>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Create Tab */}
          <TabsContent value="create" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Create Location */}
              <Card className="bg-slate-800/50 border-green-500/20">
                <CardHeader>
                  <CardTitle>Create New Location</CardTitle>
                  <CardDescription>
                    Add a new location to the mapping system
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm text-slate-400">Name</Label>
                    <Input
                      placeholder="Location name"
                      value={newLocationData.name}
                      onChange={(e) => setNewLocationData(prev => ({ ...prev, name: e.target.value }))}
                      className="bg-slate-700 border-slate-600"
                      data-testid="input-new-location-name"
                    />
                  </div>

                  <div>
                    <Label className="text-sm text-slate-400">Description</Label>
                    <Textarea
                      placeholder="Describe this location..."
                      value={newLocationData.description}
                      onChange={(e) => setNewLocationData(prev => ({ ...prev, description: e.target.value }))}
                      className="bg-slate-700 border-slate-600"
                      data-testid="input-new-location-description"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-slate-400">Zone</Label>
                      <Input
                        placeholder="Zone name"
                        value={newLocationData.zone}
                        onChange={(e) => setNewLocationData(prev => ({ ...prev, zone: e.target.value }))}
                        className="bg-slate-700 border-slate-600"
                        data-testid="input-new-location-zone"
                      />
                    </div>
                    <div>
                      <Label className="text-sm text-slate-400">Location Type</Label>
                      <Input
                        placeholder="waypoint, landmark, dungeon..."
                        value={newLocationData.location_type}
                        onChange={(e) => setNewLocationData(prev => ({ ...prev, location_type: e.target.value }))}
                        className="bg-slate-700 border-slate-600"
                        data-testid="input-new-location-type"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label className="text-sm text-slate-400">X Coordinate</Label>
                      <Input
                        type="number"
                        value={newLocationData.coordinates.x}
                        onChange={(e) => setNewLocationData(prev => ({ 
                          ...prev, 
                          coordinates: { ...prev.coordinates, x: parseFloat(e.target.value) || 0 }
                        }))}
                        className="bg-slate-700 border-slate-600"
                        data-testid="input-new-location-x"
                      />
                    </div>
                    <div>
                      <Label className="text-sm text-slate-400">Y Coordinate</Label>
                      <Input
                        type="number"
                        value={newLocationData.coordinates.y}
                        onChange={(e) => setNewLocationData(prev => ({ 
                          ...prev, 
                          coordinates: { ...prev.coordinates, y: parseFloat(e.target.value) || 0 }
                        }))}
                        className="bg-slate-700 border-slate-600"
                        data-testid="input-new-location-y"
                      />
                    </div>
                    <div>
                      <Label className="text-sm text-slate-400">Z Coordinate</Label>
                      <Input
                        type="number"
                        value={newLocationData.coordinates.z}
                        onChange={(e) => setNewLocationData(prev => ({ 
                          ...prev, 
                          coordinates: { ...prev.coordinates, z: parseFloat(e.target.value) || 0 }
                        }))}
                        className="bg-slate-700 border-slate-600"
                        data-testid="input-new-location-z"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-slate-400">Danger Level (0-10)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="10"
                        value={newLocationData.danger_level}
                        onChange={(e) => setNewLocationData(prev => ({ ...prev, danger_level: parseInt(e.target.value) || 0 }))}
                        className="bg-slate-700 border-slate-600"
                        data-testid="input-new-location-danger"
                      />
                    </div>
                    <div>
                      <Label className="text-sm text-slate-400">Elevation (meters)</Label>
                      <Input
                        type="number"
                        value={newLocationData.elevation}
                        onChange={(e) => setNewLocationData(prev => ({ ...prev, elevation: parseInt(e.target.value) || 0 }))}
                        className="bg-slate-700 border-slate-600"
                        data-testid="input-new-location-elevation"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={() => createLocation.mutate(newLocationData)}
                    disabled={!newLocationData.name || createLocation.isPending}
                    className="w-full bg-green-600 hover:bg-green-700"
                    data-testid="button-create-location"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Location
                  </Button>
                </CardContent>
              </Card>

              {/* Create Zone */}
              <Card className="bg-slate-800/50 border-blue-500/20">
                <CardHeader>
                  <CardTitle>Create New Zone</CardTitle>
                  <CardDescription>
                    Add a new zone to the mapping system
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm text-slate-400">Zone Name</Label>
                    <Input
                      placeholder="Zone name"
                      value={newZoneData.zone_name}
                      onChange={(e) => setNewZoneData(prev => ({ ...prev, zone_name: e.target.value }))}
                      className="bg-slate-700 border-slate-600"
                      data-testid="input-new-zone-name"
                    />
                  </div>

                  <div>
                    <Label className="text-sm text-slate-400">Description</Label>
                    <Textarea
                      placeholder="Describe this zone..."
                      value={newZoneData.description}
                      onChange={(e) => setNewZoneData(prev => ({ ...prev, description: e.target.value }))}
                      className="bg-slate-700 border-slate-600"
                      data-testid="input-new-zone-description"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-slate-400">North Boundary</Label>
                      <Input
                        type="number"
                        value={newZoneData.boundaries.north}
                        onChange={(e) => setNewZoneData(prev => ({ 
                          ...prev, 
                          boundaries: { ...prev.boundaries, north: parseFloat(e.target.value) || 0 }
                        }))}
                        className="bg-slate-700 border-slate-600"
                        data-testid="input-new-zone-north"
                      />
                    </div>
                    <div>
                      <Label className="text-sm text-slate-400">South Boundary</Label>
                      <Input
                        type="number"
                        value={newZoneData.boundaries.south}
                        onChange={(e) => setNewZoneData(prev => ({ 
                          ...prev, 
                          boundaries: { ...prev.boundaries, south: parseFloat(e.target.value) || 0 }
                        }))}
                        className="bg-slate-700 border-slate-600"
                        data-testid="input-new-zone-south"
                      />
                    </div>
                    <div>
                      <Label className="text-sm text-slate-400">East Boundary</Label>
                      <Input
                        type="number"
                        value={newZoneData.boundaries.east}
                        onChange={(e) => setNewZoneData(prev => ({ 
                          ...prev, 
                          boundaries: { ...prev.boundaries, east: parseFloat(e.target.value) || 0 }
                        }))}
                        className="bg-slate-700 border-slate-600"
                        data-testid="input-new-zone-east"
                      />
                    </div>
                    <div>
                      <Label className="text-sm text-slate-400">West Boundary</Label>
                      <Input
                        type="number"
                        value={newZoneData.boundaries.west}
                        onChange={(e) => setNewZoneData(prev => ({ 
                          ...prev, 
                          boundaries: { ...prev.boundaries, west: parseFloat(e.target.value) || 0 }
                        }))}
                        className="bg-slate-700 border-slate-600"
                        data-testid="input-new-zone-west"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-slate-400">Zone Type</Label>
                      <Input
                        placeholder="exploration, dangerous, safe..."
                        value={newZoneData.zone_type}
                        onChange={(e) => setNewZoneData(prev => ({ ...prev, zone_type: e.target.value }))}
                        className="bg-slate-700 border-slate-600"
                        data-testid="input-new-zone-type"
                      />
                    </div>
                    <div>
                      <Label className="text-sm text-slate-400">Security Level</Label>
                      <Input
                        placeholder="safe, neutral, moderate, high_danger"
                        value={newZoneData.security_level}
                        onChange={(e) => setNewZoneData(prev => ({ ...prev, security_level: e.target.value }))}
                        className="bg-slate-700 border-slate-600"
                        data-testid="input-new-zone-security"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label className="text-sm text-slate-400">Climate</Label>
                      <Input
                        placeholder="temperate, arctic, tropical..."
                        value={newZoneData.climate}
                        onChange={(e) => setNewZoneData(prev => ({ ...prev, climate: e.target.value }))}
                        className="bg-slate-700 border-slate-600"
                        data-testid="input-new-zone-climate"
                      />
                    </div>
                    <div>
                      <Label className="text-sm text-slate-400">Terrain</Label>
                      <Input
                        placeholder="forest, mountains, desert..."
                        value={newZoneData.terrain_type}
                        onChange={(e) => setNewZoneData(prev => ({ ...prev, terrain_type: e.target.value }))}
                        className="bg-slate-700 border-slate-600"
                        data-testid="input-new-zone-terrain"
                      />
                    </div>
                    <div>
                      <Label className="text-sm text-slate-400">Population</Label>
                      <Input
                        type="number"
                        value={newZoneData.population}
                        onChange={(e) => setNewZoneData(prev => ({ ...prev, population: parseInt(e.target.value) || 0 }))}
                        className="bg-slate-700 border-slate-600"
                        data-testid="input-new-zone-population"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={() => createZone.mutate(newZoneData)}
                    disabled={!newZoneData.zone_name || createZone.isPending}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    data-testid="button-create-zone"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Zone
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default MappingSystemPage;
