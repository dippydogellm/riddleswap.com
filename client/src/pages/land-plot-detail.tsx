import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { sessionManager } from "@/utils/sessionManager";
import { apiRequest } from "@/lib/queryClient";
import {
  MapPin,
  Coins,
  Sparkles,
  Map,
  ArrowLeft,
  ShoppingCart,
  CheckCircle,
  Info,
  Loader2,
  Mountain,
  Trees,
  Waves,
  Globe
} from "lucide-react";

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
    plains: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800&h=600&fit=crop',
    forest: 'https://images.unsplash.com/photo-1511497584788-876760111969?w=800&h=600&fit=crop',
    mountain: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop',
    water: 'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=800&h=600&fit=crop',
    swamp: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=800&h=600&fit=crop',
    desert: 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=800&h=600&fit=crop',
    tundra: 'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?w=800&h=600&fit=crop'
  };
  return placeholders[terrainType] || placeholders.plains;
};

// Terrain icon helper
const getTerrainIcon = (terrainType: string) => {
  const icons: Record<string, any> = {
    plains: Globe,
    forest: Trees,
    mountain: Mountain,
    water: Waves,
    swamp: Waves,
    desert: Mountain,
    tundra: Mountain
  };
  const IconComponent = icons[terrainType] || Globe;
  return <IconComponent className="h-5 w-5" />;
};

export default function LandPlotDetail() {
  const [match, params] = useRoute("/land/:plotNumber");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const session = sessionManager.getSession();

  const [plot, setPlot] = useState<LandPlot | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [imageFallback, setImageFallback] = useState(false);

  const plotNumber = params?.plotNumber ? parseInt(params.plotNumber) : null;

  useEffect(() => {
    if (plotNumber) {
      fetchPlotDetails();
      setImageFallback(false); // Reset fallback when loading new plot
    }
  }, [plotNumber]);

  const fetchPlotDetails = async () => {
    if (!plotNumber) return;

    try {
      setLoading(true);
      console.log(`🏞️ [LAND DETAIL] Fetching plot #${plotNumber}`);

      const response = await fetch(`/api/land/plot/${plotNumber}`);
      const data = await response.json() as any;

      if (data.success) {
        console.log(`✅ [LAND DETAIL] Loaded plot #${plotNumber}`, data.plot);
        setPlot(data.plot);
      } else {
        console.error(`❌ [LAND DETAIL] Failed to load plot:`, data.error);
        toast({
          title: "Error",
          description: data.error || "Failed to load land plot",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error(`❌ [LAND DETAIL] Network error:`, error);
      toast({
        title: "Error",
        description: "Failed to load land plot details",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!plot || !session.isLoggedIn) {
      toast({
        title: "Login Required",
        description: "Please login to generate images",
        variant: "destructive"
      });
      return;
    }

    try {
      setGeneratingImage(true);
      console.log(`🎨 [IMAGE GEN] Generating image for plot #${plot.plotNumber}`);

      const response = await apiRequest(`/api/land/plot/${plot.plotNumber}/generate-image`, {
        method: 'POST'
      });

      const data = await response.json() as any;

      if (data.success && data.imageUrl) {
        console.log(`✅ [IMAGE GEN] Image generated successfully`);
        setPlot({ ...plot, generatedImageUrl: data.imageUrl });
        toast({
          title: "Image Generated!",
          description: "Your land plot now has a unique AI-generated visualization",
        });
      } else {
        throw new Error(data.error || "Failed to generate image");
      }
    } catch (error: any) {
      console.error(`❌ [IMAGE GEN] Error:`, error);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate image",
        variant: "destructive"
      });
    } finally {
      setGeneratingImage(false);
    }
  };

  const handlePurchase = async (paymentMethod: 'XRP' | 'RDL') => {
    if (!plot) return;

    console.log(`🛒 [LAND PURCHASE] Starting purchase for plot #${plot.plotNumber} with ${paymentMethod}`);
    
    if (!session.isLoggedIn) {
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
      const walletData = sessionManager.getWalletData();
      const buyerAddress = walletData?.xrpAddress;
      const buyerHandle = session.handle;

      if (!buyerAddress || !buyerHandle) {
        toast({
          title: "Wallet Required",
          description: "Please connect your XRPL wallet first",
          variant: "destructive"
        });
        setPurchasing(false);
        return;
      }

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

      if (!purchaseData.success) {
        toast({
          title: "Purchase Failed",
          description: purchaseData.error || "Failed to complete purchase",
          variant: "destructive"
        });
        setPurchasing(false);
        return;
      }

      toast({
        title: "Land Purchased!",
        description: `You now own Plot #${plot.plotNumber}! Transaction: ${purchaseData.transactionHash?.slice(0, 10)}...`,
      });

      // Refresh plot details
      await fetchPlotDetails();

    } catch (error: any) {
      console.error('❌ [LAND PURCHASE] Critical error:', error);
      toast({
        title: "Purchase Error",
        description: error.message || "Failed to process purchase",
        variant: "destructive"
      });
    } finally {
      setPurchasing(false);
    }
  };

  if (!match || !plotNumber) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-slate-400">Plot not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="h-96 rounded-lg" />
          <div className="space-y-4">
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-48 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (!plot) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-slate-400">Plot not found</p>
            <div className="flex justify-center mt-4">
              <Button onClick={() => setLocation('/land-marketplace')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Marketplace
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isAvailable = plot.status === 'available';
  const imageUrl = (imageFallback || !plot.generatedImageUrl) 
    ? getPlaceholderImage(plot.terrainType) 
    : plot.generatedImageUrl;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <Button 
            variant="outline" 
            onClick={() => setLocation('/land-marketplace')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Marketplace
          </Button>

          <div className="flex items-center gap-2">
            <Badge variant={isAvailable ? "default" : "secondary"}>
              {plot.status}
            </Badge>
            {plot.ownerHandle && (
              <Badge variant="outline" className="gap-1">
                <CheckCircle className="h-3 w-3" />
                Owned by {plot.ownerHandle}
              </Badge>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Image Section */}
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="relative aspect-[4/3]">
                <img
                  src={imageUrl}
                  alt={`Land Plot #${plot.plotNumber}`}
                  className="w-full h-full object-cover"
                  onError={() => {
                    console.warn(`⚠️ [LAND IMAGE] Failed to load image for plot #${plot.plotNumber}, using placeholder`);
                    setImageFallback(true);
                  }}
                />
                {(imageFallback || !plot.generatedImageUrl) && (
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-6">
                    <Button
                      onClick={handleGenerateImage}
                      disabled={generatingImage}
                      className="bg-purple-600 hover:bg-purple-700 gap-2"
                    >
                      {generatingImage ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          Generate AI Image
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>

              {/* Plot Metadata */}
              <div className="p-6 space-y-4 bg-gradient-to-br from-slate-900/50 to-slate-800/30">
                <div className="flex items-center gap-2 text-slate-300">
                  <MapPin className="h-5 w-5 text-blue-400" />
                  <span className="text-sm">Grid: {plot.gridSection}</span>
                  <span className="text-xs text-slate-500">
                    ({plot.mapX}, {plot.mapY})
                  </span>
                </div>

                {plot.latitude && plot.longitude && (
                  <div className="flex items-center gap-2 text-slate-300">
                    <Globe className="h-5 w-5 text-green-400" />
                    <span className="text-sm">
                      {parseFloat(plot.latitude).toFixed(4)}, {parseFloat(plot.longitude).toFixed(4)}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Details Section */}
          <div className="space-y-6">
            {/* Title */}
            <Card>
              <CardHeader>
                <CardTitle className="text-3xl flex items-center gap-3">
                  {getTerrainIcon(plot.terrainType)}
                  Plot #{plot.plotNumber}
                </CardTitle>
                <CardDescription className="text-lg capitalize">
                  {plot.terrainSubtype || plot.terrainType} {plot.plotSize && `• ${plot.plotSize} size`}
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Pricing & Purchase */}
            <Card className="border-2 border-blue-500/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Coins className="h-5 w-5 text-yellow-400" />
                  Pricing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <div className="text-sm text-slate-400 mb-1">XRP Price</div>
                    <div className="text-2xl font-bold text-blue-400">
                      {plot.currentPrice} XRP
                    </div>
                  </div>

                  <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/20">
                    <div className="text-sm text-slate-400 mb-1">
                      RDL Price
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {plot.rdlDiscountPercent}% off
                      </Badge>
                    </div>
                    <div className="text-2xl font-bold text-purple-400">
                      {plot.rdlPrice} RDL
                    </div>
                  </div>
                </div>

                {isAvailable && (
                  <div className="space-y-2 pt-4 border-t border-slate-700">
                    <Button
                      onClick={() => handlePurchase('XRP')}
                      disabled={purchasing}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      {purchasing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <ShoppingCart className="mr-2 h-4 w-4" />
                          Buy with XRP
                        </>
                      )}
                    </Button>

                    <Button
                      onClick={() => handlePurchase('RDL')}
                      disabled={purchasing}
                      className="w-full bg-purple-600 hover:bg-purple-700"
                    >
                      {purchasing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          Buy with RDL ({plot.rdlDiscountPercent}% discount)
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {!isAvailable && plot.ownerHandle && (
                  <div className="flex items-center gap-2 text-sm text-slate-400 pt-4 border-t border-slate-700">
                    <Info className="h-4 w-4" />
                    This plot is owned by {plot.ownerHandle}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Description & Lore */}
            {(plot.description || plot.lore) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">About This Land</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {plot.description && (
                    <p className="text-slate-300 leading-relaxed">{plot.description}</p>
                  )}
                  {plot.lore && (
                    <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                      <p className="text-sm text-amber-200/80 italic leading-relaxed">
                        {plot.lore}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Special Features */}
            {plot.specialFeatures && plot.specialFeatures.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-purple-400" />
                    Special Features
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {plot.specialFeatures.map((feature, index) => (
                      <Badge key={index} variant="outline" className="capitalize">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Resources */}
            {plot.plotResources && Object.keys(plot.plotResources).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Map className="h-5 w-5 text-green-400" />
                    Plot Resources
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(plot.plotResources).map(([key, value]) => (
                      <div key={key} className="p-3 bg-slate-800/50 rounded-lg">
                        <div className="text-xs text-slate-400 capitalize mb-1">
                          {key.replace(/_/g, ' ')}
                        </div>
                        <div className="text-sm font-medium text-slate-200">
                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
