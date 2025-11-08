/**
 * Land Marketplace Component
 * Displays 1000 purchasable land plots with:
 * - Full metadata display
 * - Image generation on first view
 * - Payment with XRP or RDL (25% discount)
 * - Real-time pricing
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, MapPin, Coins, Sparkles, Mountain, Trees, Waves, Info, ShoppingCart, CheckCircle2, Shield, Cross, Building, DollarSign, Gem, Sword, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { sessionManager } from '@/utils/sessionManager';
import { SessionRenewalModal } from '@/components/session-renewal-modal';
import { normalizeImagePath } from '@/utils/imageNormalizer';

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
  sizeMultiplier: number;
  currentPrice: string;
  rdlPrice: string;
  rdlDiscountPercent: number;
  status: 'available' | 'owned' | 'reserved';
  specialFeatures: string[];
  resourceNodes: string[];
  plotResources?: Record<string, any>;
  description: string;
  lore: string;
  ownerHandle?: string;
  generatedImageUrl?: string;
}

interface LandMarketplaceProps {
  theme: 'dark' | 'light';
  onPurchase?: (plotNumber: number) => void;
}

export function LandMarketplace({ theme, onPurchase }: LandMarketplaceProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPlot, setSelectedPlot] = useState<LandPlot | null>(null);
  const [filter, setFilter] = useState<'all' | 'available' | 'owned'>('available');
  const [terrainFilter, setTerrainFilter] = useState<string>('all');
  const [paymentMethod, setPaymentMethod] = useState<'XRP' | 'RDL'>('RDL');
  const [page, setPage] = useState(1);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const [pendingOperation, setPendingOperation] = useState<{type: 'purchase' | 'image', data: any} | null>(null);

  const session = sessionManager.getSession();
  const userHandle = session.handle;

  // Fetch land plots - use different endpoint for "My Lands"
  const apiPath = filter === 'owned' && userHandle 
    ? `/api/land/my-plots/${userHandle}`
    : '/api/land/plots';
    
  const { data: plotsData, isLoading } = useQuery<any>({
    queryKey: [apiPath, { status: filter !== 'owned' ? filter : undefined, terrainType: terrainFilter, page, limit: 20 }],
    retry: 2,
  });

  // Purchase mutation
  const purchaseMutation = useMutation({
    mutationFn: async ({ plotNumber, method }: { plotNumber: number; method: 'XRP' | 'RDL' }) => {
      const session = sessionManager.getSession();
      if (!session.isLoggedIn) {
        throw new Error('Please login to purchase land');
      }

      return apiRequest('/api/land/purchase', {
        method: 'POST',
        body: JSON.stringify({
          plotNumber,
          paymentMethod: method,
        }),
      });
    },
    onSuccess: (data, variables) => {
      toast({
        title: '✅ Land Purchased!',
        description: `Plot #${variables.plotNumber} is now yours!`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/land/plots'] });
      setSelectedPlot(null);
      onPurchase?.(variables.plotNumber);
    },
    onError: (error: any, variables: { plotNumber: number; method: 'XRP' | 'RDL' }) => {
      const errorMessage = error.message || 'Could not complete purchase';
      const isSessionExpired = errorMessage.includes('Session expired') || errorMessage.includes('renew');
      
      if (isSessionExpired) {
        // Show renewal modal with actual mutation variables (not nullable state)
        setPendingOperation({ type: 'purchase', data: { plotNumber: variables.plotNumber, method: variables.method } });
        setShowRenewalModal(true);
      } else {
        toast({
          title: '❌ Purchase Failed',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    },
  });

  // Generate image for plot on first view
  const generatePlotImage = async (plot: LandPlot) => {
    if (plot.generatedImageUrl || generatingImage) return;
    
    setGeneratingImage(true);
    try {
      const response: any = await apiRequest(`/api/land/plot/${plot.plotNumber}/generate-image`, {
        method: 'POST',
      });
      
      if (response?.imageUrl) {
        // Update plot with generated image
        setSelectedPlot({ ...plot, generatedImageUrl: response.imageUrl });
        
        // Force refresh all land plot queries to show new image
        queryClient.invalidateQueries({ queryKey: ['/api/land/plots'] });
        queryClient.invalidateQueries({ queryKey: [`/api/land/my-plots/${userHandle}`] });
        
        toast({
          title: '🎨 Image Generated!',
          description: 'Your land plot visualization is ready',
        });
      }
    } catch (error: any) {
      console.error('Failed to generate image:', error);
      const errorMessage = error.message || 'Failed to generate image';
      if (errorMessage.includes('Session expired') || errorMessage.includes('renew')) {
        // Show renewal modal for image generation
        setPendingOperation({ type: 'image', data: plot });
        setShowRenewalModal(true);
      }
    } finally {
      setGeneratingImage(false);
    }
  };

  const plots = plotsData?.plots || [];
  const total = plotsData?.total || 0;
  const totalPages = plotsData?.totalPages || 1;

  const getTerrainIcon = (type: string) => {
    const icons: Record<string, any> = {
      mountain: Mountain,
      forest: Trees,
      water: Waves,
      plains: MapPin,
    };
    const Icon = icons[type] || MapPin;
    return <Icon className="w-4 h-4" />;
  };

  const getTerrainColor = (type: string) => {
    const colors: Record<string, string> = {
      mountain: 'bg-gray-600',
      forest: 'bg-green-600',
      water: 'bg-blue-600',
      plains: 'bg-yellow-600',
      swamp: 'bg-emerald-800',
      desert: 'bg-orange-600',
      tundra: 'bg-cyan-600',
    };
    return colors[type] || 'bg-gray-500';
  };

  // Placeholder images for terrain types
  const getPlaceholderImage = (terrainType: string): string => {
    const placeholders: Record<string, string> = {
      plains: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=400&h=300&fit=crop',
      forest: 'https://images.unsplash.com/photo-1511497584788-876760111969?w=400&h=300&fit=crop',
      mountain: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop',
      water: 'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=400&h=300&fit=crop',
      swamp: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=400&h=300&fit=crop',
      desert: 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=400&h=300&fit=crop',
      tundra: 'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?w=400&h=300&fit=crop'
    };
    return placeholders[terrainType] || placeholders.plains;
  };

  // Get material icon and color based on type
  const getMaterialIcon = (materialName: string) => {
    const name = materialName.toLowerCase();
    
    // Army materials
    if (name.includes('soldier') || name.includes('warrior') || name.includes('knight') || name.includes('army')) {
      return { Icon: Sword, color: 'text-red-500' };
    }
    // Religion materials
    if (name.includes('priest') || name.includes('monk') || name.includes('faith') || name.includes('religion')) {
      return { Icon: Cross, color: 'text-blue-500' };
    }
    // Civilization materials
    if (name.includes('builder') || name.includes('architect') || name.includes('civilization') || name.includes('culture')) {
      return { Icon: Building, color: 'text-purple-500' };
    }
    // Economic materials
    if (name.includes('merchant') || name.includes('trader') || name.includes('economic') || name.includes('gold') || name.includes('silver')) {
      return { Icon: DollarSign, color: 'text-yellow-500' };
    }
    // Precious materials
    if (name.includes('crystal') || name.includes('gem') || name.includes('diamond')) {
      return { Icon: Gem, color: 'text-cyan-500' };
    }
    // Default
    return { Icon: Shield, color: 'text-orange-500' };
  };

  // Get material category for grouping
  const getMaterialCategory = (materialName: string) => {
    const name = materialName.toLowerCase();
    if (name.includes('soldier') || name.includes('warrior') || name.includes('knight') || name.includes('army')) return 'Army';
    if (name.includes('priest') || name.includes('monk') || name.includes('faith') || name.includes('religion')) return 'Religion';
    if (name.includes('builder') || name.includes('architect') || name.includes('civilization') || name.includes('culture')) return 'Civilization';
    if (name.includes('merchant') || name.includes('trader') || name.includes('economic') || name.includes('gold') || name.includes('silver')) return 'Economic';
    return 'Other';
  };

  // Retry handler after session renewal
  const handleRenewalSuccess = async () => {
    if (!pendingOperation) return;

    if (pendingOperation.type === 'purchase') {
      // Retry purchase
      const { plotNumber, method } = pendingOperation.data;
      purchaseMutation.mutate({ plotNumber, method });
    } else if (pendingOperation.type === 'image') {
      // Retry image generation
      await generatePlotImage(pendingOperation.data);
    }

    // Clear pending operation
    setPendingOperation(null);
  };

  return (
    <div className={`space-y-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
      {/* Header Stats */}
      <div className={`p-6 rounded-xl ${theme === 'dark' ? 'bg-slate-800/50 border border-slate-700' : 'bg-white border border-gray-200'}`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <MapPin className="w-6 h-6 text-orange-500" />
              Medieval Land Marketplace
            </h2>
            <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              {plotsData?.availableCount || 0} available of {plotsData?.totalSupply || 1000} • 25% discount with RDL
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-orange-500">{total}</div>
            <div className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              {filter === 'available' ? 'Available' : filter === 'owned' ? 'My Lands' : 'Total'} Plots
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className={`px-4 py-2 rounded-lg ${theme === 'dark' ? 'bg-slate-700 text-white' : 'bg-gray-100 text-gray-900'}`}
          >
            <option value="all">All Status</option>
            <option value="available">Available</option>
            <option value="owned">My Lands</option>
          </select>

          <select
            value={terrainFilter}
            onChange={(e) => setTerrainFilter(e.target.value)}
            className={`px-4 py-2 rounded-lg ${theme === 'dark' ? 'bg-slate-700 text-white' : 'bg-gray-100 text-gray-900'}`}
          >
            <option value="all">All Terrain</option>
            <option value="plains">Plains</option>
            <option value="forest">Forest</option>
            <option value="mountain">Mountain</option>
            <option value="water">Water</option>
            <option value="swamp">Swamp</option>
            <option value="desert">Desert</option>
            <option value="tundra">Tundra</option>
          </select>
        </div>
      </div>

      {/* Plot Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plots.map((plot: LandPlot) => (
              <div
                key={plot.id}
                onClick={() => {
                  setSelectedPlot(plot);
                  if (!plot.generatedImageUrl) {
                    generatePlotImage(plot);
                  }
                }}
                className={`rounded-xl cursor-pointer transition-all hover:scale-105 overflow-hidden ${
                  theme === 'dark'
                    ? 'bg-slate-800/50 border border-slate-700 hover:border-orange-500'
                    : 'bg-white border border-gray-200 hover:border-orange-500'
                }`}
              >
                {/* Plot Image */}
                <div className="relative h-40 w-full overflow-hidden">
                  <img
                    src={normalizeImagePath(plot.generatedImageUrl) || getPlaceholderImage(plot.terrainType)}
                    alt={`Plot #${plot.plotNumber}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = getPlaceholderImage(plot.terrainType);
                    }}
                  />
                  <div className="absolute top-2 right-2">
                    <Badge className={`${getTerrainColor(plot.terrainType)} text-white font-bold`}>
                      {plot.terrainType}
                    </Badge>
                  </div>
                  {!plot.generatedImageUrl && (
                    <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded font-bold">
                      🎨 Placeholder
                    </div>
                  )}
                </div>

                {/* Plot Details */}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="text-lg font-bold">Plot #{plot.plotNumber}</div>
                      <div className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                        {plot.gridSection}
                      </div>
                    </div>
                  </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    {getTerrainIcon(plot.terrainType)}
                    <span>{plot.terrainSubtype.replace('_', ' ')}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-green-400" />
                    <span className="font-semibold">{plot.currentPrice} XRP</span>
                  </div>

                  {plot.rdlPrice && (
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-yellow-400" />
                      <span className="font-semibold text-yellow-400">
                        {plot.rdlPrice} RDL
                      </span>
                      <Badge className="bg-green-600 text-white text-xs">-25%</Badge>
                    </div>
                  )}

                  {plot.specialFeatures.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {plot.specialFeatures.slice(0, 2).map((feature) => (
                        <Badge key={feature} className="bg-purple-600 text-white text-xs font-bold">
                          {feature.replace('_', ' ')}
                        </Badge>
                      ))}
                      {plot.specialFeatures.length > 2 && (
                        <Badge className="bg-purple-600 text-white text-xs font-bold">
                          +{plot.specialFeatures.length - 2}
                        </Badge>
                      )}
                    </div>
                  )}

                  {plot.status === 'owned' && (
                    <div className="mt-3 flex items-center gap-2 text-green-500">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-xs font-semibold">Owned by {plot.ownerHandle}</span>
                    </div>
                  )}
                </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </>
      )}

      {/* Plot Details Modal */}
      {selectedPlot && (
        <Dialog open={!!selectedPlot} onOpenChange={() => setSelectedPlot(null)}>
          <DialogContent className={`w-[95vw] sm:w-[90%] sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 ${theme === 'dark' ? 'bg-slate-900 text-white border-slate-700' : 'bg-white text-gray-900'}`}>
            <DialogHeader>
              <DialogTitle className="text-2xl flex items-center gap-2">
                <MapPin className="w-6 h-6 text-orange-500" />
                Plot #{selectedPlot.plotNumber} - {selectedPlot.gridSection}
              </DialogTitle>
              <DialogDescription className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                {selectedPlot.description}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Generated Image */}
              {generatingImage ? (
                <div className="aspect-video bg-gradient-to-br from-orange-900/20 to-red-900/20 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto mb-2" />
                    <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                      Generating your land visualization...
                    </p>
                  </div>
                </div>
              ) : selectedPlot.generatedImageUrl ? (
                <img
                  src={normalizeImagePath(selectedPlot.generatedImageUrl) || getPlaceholderImage(selectedPlot.terrainType)}
                  alt={`Plot #${selectedPlot.plotNumber}`}
                  className="w-full aspect-video object-cover rounded-lg"
                />
              ) : (
                <div className="aspect-video bg-gradient-to-br from-orange-900/20 to-red-900/20 rounded-lg flex items-center justify-center">
                  <Button onClick={() => generatePlotImage(selectedPlot)} variant="outline">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Visualization
                  </Button>
                </div>
              )}

              {/* Plot Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Terrain Type</div>
                  <div className="font-semibold flex items-center gap-2">
                    {getTerrainIcon(selectedPlot.terrainType)}
                    {selectedPlot.terrainType}
                  </div>
                </div>
                <div>
                  <div className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Plot Size</div>
                  <div className="font-semibold">{selectedPlot.plotSize} ({selectedPlot.sizeMultiplier}x)</div>
                </div>
                <div>
                  <div className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Coordinates</div>
                  <div className="font-semibold">{selectedPlot.latitude}, {selectedPlot.longitude}</div>
                </div>
                <div>
                  <div className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Map Position</div>
                  <div className="font-semibold">X:{selectedPlot.mapX} Y:{selectedPlot.mapY}</div>
                </div>
              </div>

              {/* Special Features */}
              {selectedPlot.specialFeatures.length > 0 && (
                <div>
                  <div className={`text-sm mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    Special Features
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedPlot.specialFeatures.map((feature) => (
                      <Badge key={feature} className="bg-purple-600 text-white font-bold">
                        {feature.replace('_', ' ')}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Resource Nodes */}
              {selectedPlot.resourceNodes.length > 0 && (
                <div>
                  <div className={`text-sm mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    Resources
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedPlot.resourceNodes.map((resource) => (
                      <Badge key={resource} className="bg-green-600 text-white font-bold">
                        {resource.replace('_', ' ')}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Inquisition Materials from NFTs */}
              {selectedPlot.plotResources && Object.keys(selectedPlot.plotResources).length > 0 && (
                <div className={`p-4 rounded-lg border-2 ${theme === 'dark' ? 'bg-orange-900/20 border-orange-500/30' : 'bg-orange-50 border-orange-300'}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-5 h-5 text-orange-500" />
                    <span className={`font-bold text-lg ${theme === 'dark' ? 'text-orange-400' : 'text-orange-700'}`}>
                      Inquisition Materials
                    </span>
                    <Badge className="bg-orange-600 text-white text-xs">From NFTs</Badge>
                  </div>
                  <div className={`text-xs mb-3 ${theme === 'dark' ? 'text-orange-300/80' : 'text-orange-600'}`}>
                    Materials from Trolls Inquisition NFTs placed on this land
                  </div>
                  
                  {/* Group materials by category */}
                  {['Army', 'Religion', 'Civilization', 'Economic', 'Other'].map((category) => {
                    const categoryMaterials = Object.entries(selectedPlot.plotResources || {})
                      .filter(([name]) => getMaterialCategory(name) === category);
                    
                    if (categoryMaterials.length === 0) return null;
                    
                    return (
                      <div key={category} className="mb-3 last:mb-0">
                        <div className={`text-xs font-semibold mb-2 ${theme === 'dark' ? 'text-orange-300' : 'text-orange-700'}`}>
                          {category}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {categoryMaterials.map(([materialName, materialData]: [string, any]) => {
                            const { Icon, color } = getMaterialIcon(materialName);
                            return (
                              <div
                                key={materialName}
                                className={`p-2 rounded-lg flex items-center gap-2 ${
                                  theme === 'dark' ? 'bg-slate-800/50 border border-slate-700' : 'bg-white border border-orange-200'
                                }`}
                              >
                                <Icon className={`w-4 h-4 ${color}`} />
                                <div className="flex-1 min-w-0">
                                  <div className={`text-xs font-semibold truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                    {materialName.replace(/_/g, ' ')}
                                  </div>
                                  {materialData?.level && (
                                    <div className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                                      Level {materialData.level}
                                    </div>
                                  )}
                                  {materialData?.quantity && (
                                    <div className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                                      Qty: {materialData.quantity}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Lore */}
              {selectedPlot.lore && (
                <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-50'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="w-4 h-4 text-orange-500" />
                    <span className="font-semibold">Lore</span>
                  </div>
                  <p className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    {selectedPlot.lore}
                  </p>
                </div>
              )}

              {/* Purchase Section */}
              {selectedPlot.status === 'available' && (
                <div className={`p-6 rounded-xl ${theme === 'dark' ? 'bg-gradient-to-br from-orange-900/20 to-red-900/20 border border-orange-500/30' : 'bg-gradient-to-br from-orange-50 to-red-50 border border-orange-200'}`}>
                  <div className="mb-4">
                    <div className="text-lg font-bold mb-2">Purchase This Land</div>
                    <div className="flex gap-4">
                      <button
                        onClick={() => setPaymentMethod('XRP')}
                        className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                          paymentMethod === 'XRP'
                            ? 'border-orange-500 bg-orange-500/10'
                            : theme === 'dark'
                            ? 'border-slate-700 hover:border-orange-500/50'
                            : 'border-gray-300 hover:border-orange-500/50'
                        }`}
                      >
                        <div className="font-bold">{selectedPlot.currentPrice} XRP</div>
                        <div className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                          Standard Price
                        </div>
                      </button>
                      <button
                        onClick={() => setPaymentMethod('RDL')}
                        className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                          paymentMethod === 'RDL'
                            ? 'border-yellow-500 bg-yellow-500/10'
                            : theme === 'dark'
                            ? 'border-slate-700 hover:border-yellow-500/50'
                            : 'border-gray-300 hover:border-yellow-500/50'
                        }`}
                      >
                        <div className="font-bold text-yellow-400 flex items-center justify-center gap-1">
                          {selectedPlot.rdlPrice} RDL
                          <Badge className="bg-green-600 text-white text-xs">-25%</Badge>
                        </div>
                        <div className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                          Discounted Price
                        </div>
                      </button>
                    </div>
                  </div>

                  <Button
                    onClick={() => purchaseMutation.mutate({ plotNumber: selectedPlot.plotNumber, method: paymentMethod })}
                    disabled={purchaseMutation.isPending}
                    className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold py-6"
                  >
                    {purchaseMutation.isPending ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Processing Purchase...
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="w-5 h-5 mr-2" />
                        Purchase with {paymentMethod}
                      </>
                    )}
                  </Button>
                </div>
              )}

              {selectedPlot.status === 'owned' && (
                <div className="p-6 rounded-xl bg-gradient-to-br from-green-900/20 to-emerald-900/20 border border-green-500/30">
                  <div className="flex items-center gap-2 text-green-500 font-bold">
                    <CheckCircle2 className="w-6 h-6" />
                    This land is owned by {selectedPlot.ownerHandle}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Session Renewal Modal */}
      <SessionRenewalModal
        isOpen={showRenewalModal}
        onClose={() => {
          setShowRenewalModal(false);
          setPendingOperation(null);
        }}
        onSuccess={handleRenewalSuccess}
      />
    </div>
  );
}
