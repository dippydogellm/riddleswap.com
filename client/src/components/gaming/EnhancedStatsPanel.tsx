import { Star, Coins, Castle, TrendingUp, Trophy, Sparkles, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { normalizeNftImage } from "@/utils/imageNormalizer";
import { useState, useEffect } from "react";

interface EnhancedStatsPanelProps {
  stats: {
    player: any;
    nftStats: {
      totalNfts: number;
      byCollection: Record<string, {
        count: number;
        totalPower: number;
        avgPower: number;
        collection_name: string;
      }>;
      topNfts: Array<{
        nfttoken_id: string;
        nft_name: string;
        collection_name: string;
        image_url: string;
        totalPower: number;
      }>;
    };
    riddleCity: {
      landPlotsOwned: number;
      landPlots: any[];
    };
    powerBreakdown: {
      army: number;
      religion: number;
      civilization: number;
      economic: number;
      total: number;
    };
  };
  theme: 'light' | 'dark';
}

export function EnhancedStatsPanel({ stats, theme }: EnhancedStatsPanelProps) {
  const { nftStats, riddleCity, powerBreakdown } = stats;
  const [currentLandIndex, setCurrentLandIndex] = useState(0);

  // CRITICAL FIX: Reset index if land plots array shrinks (user sells land or data refreshes)
  useEffect(() => {
    if (riddleCity.landPlots && riddleCity.landPlots.length > 0) {
      // Clamp currentLandIndex to valid range
      if (currentLandIndex >= riddleCity.landPlots.length) {
        setCurrentLandIndex(Math.max(0, riddleCity.landPlots.length - 1));
      }
    } else {
      // No land plots, reset to 0
      setCurrentLandIndex(0);
    }
  }, [riddleCity.landPlots?.length]);

  // Navigation handlers for land plots
  const nextLand = () => {
    if (currentLandIndex < riddleCity.landPlots.length - 1) {
      setCurrentLandIndex(currentLandIndex + 1);
    }
  };

  const prevLand = () => {
    if (currentLandIndex > 0) {
      setCurrentLandIndex(currentLandIndex - 1);
    }
  };

  // Safe access to current land plot with fallback
  const currentLand = riddleCity.landPlots && riddleCity.landPlots.length > 0 
    ? riddleCity.landPlots[currentLandIndex] 
    : null;

  return (
    <div className="space-y-4">
      {/* Collection Breakdown */}
      <Card className={`${theme === 'dark' ? 'bg-slate-900/95 border-purple-500/30' : 'bg-white border-purple-300'} backdrop-blur-sm`}>
        <CardHeader className="pb-3">
          <CardTitle className={`text-lg ${theme === 'dark' ? 'text-white' : 'text-gray-900'} flex items-center gap-2`}>
            <Sparkles className="w-5 h-5 text-purple-400" />
            NFT Collection Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(nftStats.byCollection).map(([collectionId, collection]) => (
              <div
                key={collectionId}
                className={`${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-gray-50 border-gray-200'} border rounded-lg p-3`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      {collection.collection_name}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <Badge variant="outline" className="border-purple-500 text-purple-400">
                        {collection.count} NFTs
                      </Badge>
                      <span className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                        Total: {collection.totalPower.toFixed(0)} • Avg: {collection.avgPower.toFixed(0)}
                      </span>
                    </div>
                  </div>
                  <TrendingUp className="w-5 h-5 text-purple-400" />
                </div>
              </div>
            ))}
            {Object.keys(nftStats.byCollection).length === 0 && (
              <div className={`text-center py-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No NFTs found</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Top 5 Most Powerful NFTs */}
      <Card className={`${theme === 'dark' ? 'bg-slate-900/95 border-orange-500/30' : 'bg-white border-orange-300'} backdrop-blur-sm`}>
        <CardHeader className="pb-3">
          <CardTitle className={`text-lg ${theme === 'dark' ? 'text-white' : 'text-gray-900'} flex items-center gap-2`}>
            <Trophy className="w-5 h-5 text-orange-400" />
            Top 5 Most Powerful NFTs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {nftStats.topNfts.map((nft, index) => (
              <div
                key={nft.nfttoken_id}
                className={`${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-gray-50 border-gray-200'} border rounded-lg p-3 flex items-center gap-3`}
              >
                {/* Rank Badge */}
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  index === 0 ? 'bg-gradient-to-br from-yellow-400 to-orange-500' :
                  index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400' :
                  index === 2 ? 'bg-gradient-to-br from-orange-300 to-orange-400' :
                  'bg-gradient-to-br from-slate-600 to-slate-700'
                }`}>
                  <span className="text-white font-bold text-sm">#{index + 1}</span>
                </div>

                {/* NFT Image */}
                <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-slate-800">
                  <img
                    src={normalizeNftImage(nft.image_url || '')}
                    alt={nft.nft_name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = '/placeholder-nft.png';
                    }}
                  />
                </div>

                {/* NFT Info */}
                <div className="flex-1 min-w-0">
                  <p className={`font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {nft.nft_name || 'Unknown NFT'}
                  </p>
                  <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    {nft.collection_name}
                  </p>
                </div>

                {/* Power */}
                <div className="flex-shrink-0">
                  <Badge className="bg-gradient-to-r from-orange-500 to-red-500 text-white border-0">
                    ⚡ {nft.totalPower.toFixed(0)}
                  </Badge>
                </div>
              </div>
            ))}
            {nftStats.topNfts.length === 0 && (
              <div className={`text-center py-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                <Trophy className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No NFTs yet</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* RiddleCity Land */}
      <Card className={`${theme === 'dark' ? 'bg-slate-900/95 border-green-500/30' : 'bg-white border-green-300'} backdrop-blur-sm`}>
        <CardHeader className="pb-3">
          <CardTitle className={`text-lg ${theme === 'dark' ? 'text-white' : 'text-gray-900'} flex items-center justify-between`}>
            <div className="flex items-center gap-2">
              <Castle className="w-5 h-5 text-green-400" />
              RiddleCity Land Holdings
            </div>
            {riddleCity.landPlotsOwned > 1 && (
              <Badge variant="outline" className="border-green-500 text-green-400">
                {currentLandIndex + 1} / {riddleCity.landPlotsOwned}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {riddleCity.landPlotsOwned === 0 ? (
            <div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div key="land-count" className={`${theme === 'dark' ? 'bg-green-900/20 border-green-500/30' : 'bg-green-50 border-green-200'} border rounded-lg p-3 text-center`}>
                  <Castle className="w-6 h-6 text-green-400 mx-auto mb-1" />
                  <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Land Plots</p>
                  <p className="text-xl font-bold text-green-400">0</p>
                </div>
                <div key="land-value" className={`${theme === 'dark' ? 'bg-yellow-900/20 border-yellow-500/30' : 'bg-yellow-50 border-yellow-200'} border rounded-lg p-3 text-center`}>
                  <Star className="w-6 h-6 text-yellow-400 mx-auto mb-1" />
                  <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Est. Value</p>
                  <p className="text-xl font-bold text-yellow-400">0 XRP</p>
                </div>
              </div>
              <div className={`text-center py-3 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} text-sm`}>
                <p>No land plots owned yet</p>
                <p className="text-xs mt-1">Visit RiddleCity to claim your territory!</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Land Plot Image */}
              {currentLand?.ai_generated_image_url && (
                <div key="land-image" className="relative rounded-lg overflow-hidden bg-slate-800 aspect-video">
                  <img
                    src={normalizeNftImage(currentLand.ai_generated_image_url)}
                    alt={`Land Plot ${currentLand.plot_number}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = '/placeholder-land.png';
                    }}
                  />
                  <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm px-2 py-1 rounded-md">
                    <p className="text-xs text-white font-semibold flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      Plot #{currentLand.plot_number}
                    </p>
                  </div>
                </div>
              )}

              {/* Land Plot Details */}
              <div className="grid grid-cols-2 gap-2">
                <div key="terrain" className={`${theme === 'dark' ? 'bg-green-900/20 border-green-500/30' : 'bg-green-50 border-green-200'} border rounded-lg p-2 text-center`}>
                  <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Terrain</p>
                  <p className="text-sm font-bold text-green-400">{currentLand?.terrain_type || 'Unknown'}</p>
                </div>
                <div key="size" className={`${theme === 'dark' ? 'bg-blue-900/20 border-blue-500/30' : 'bg-blue-50 border-blue-200'} border rounded-lg p-2 text-center`}>
                  <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Size</p>
                  <p className="text-sm font-bold text-blue-400">{currentLand?.size || 'Medium'}</p>
                </div>
                <div key="feature" className={`${theme === 'dark' ? 'bg-purple-900/20 border-purple-500/30' : 'bg-purple-50 border-purple-200'} border rounded-lg p-2 text-center`}>
                  <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Feature</p>
                  <p className="text-sm font-bold text-purple-400">{currentLand?.special_feature || 'None'}</p>
                </div>
                <div key="value" className={`${theme === 'dark' ? 'bg-yellow-900/20 border-yellow-500/30' : 'bg-yellow-50 border-yellow-200'} border rounded-lg p-2 text-center`}>
                  <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Value</p>
                  <p className="text-sm font-bold text-yellow-400">100 XRP</p>
                </div>
              </div>

              {/* Navigation for Multiple Lands */}
              {riddleCity.landPlotsOwned > 1 && (
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-700">
                  <Button
                    onClick={prevLand}
                    disabled={currentLandIndex === 0}
                    size="sm"
                    variant="outline"
                    className={`${theme === 'dark' ? 'border-green-500 text-green-400' : 'border-green-600 text-green-600'} hover:bg-green-500/20`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </Button>
                  <span className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    Swipe to explore your lands
                  </span>
                  <Button
                    onClick={nextLand}
                    disabled={currentLandIndex === riddleCity.landPlots.length - 1}
                    size="sm"
                    variant="outline"
                    className={`${theme === 'dark' ? 'border-green-500 text-green-400' : 'border-green-600 text-green-600'} hover:bg-green-500/20`}
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}

              {/* Visit RiddleCity Button */}
              <Button
                onClick={() => window.location.href = '/riddlecity'}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
              >
                <Castle className="w-4 h-4 mr-2" />
                Manage in RiddleCity
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
