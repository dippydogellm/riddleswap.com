import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, Swords, Heart, Zap, Sparkles, Crown, Target, Wand2 } from "lucide-react";
import { useState } from "react";

export interface InquisitionNFT {
  nft_id: string;
  name: string;
  description: string;
  image_url: string;
  collection_name: string;
  game_role: string;
  rarity_score: string;
  owned_at: string;
  total_power: number | null;
  army_power: number | null;
  religion_power: number | null;
  civilization_power: number | null;
  economic_power: number | null;
  
  // Character classification (Inquisition only)
  material_type?: string | null;
  character_class?: string | null;
  battle_specialization?: string | null;
  
  // AI Image Generation
  ai_generated_image_url?: string | null;
  ai_image_generated_at?: Date | null;
  
  // Backward compatibility
  id?: number;
  nft_token_id?: string;
  collection_id?: number;
  total_points?: number;
  power_strength?: number;
  power_defense?: number;
  power_magic?: number;
  power_speed?: number;
  traits?: Record<string, any>;
}

interface InquisitionNFTCardProps {
  nft: InquisitionNFT;
  onClick?: () => void;
  showPowerBars?: boolean;
  compact?: boolean;
}

export const InquisitionNFTCard = ({ 
  nft, 
  onClick, 
  showPowerBars = true,
  compact = false 
}: InquisitionNFTCardProps) => {
  const [imageError, setImageError] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  // Helper function to extract token number from image URL
  const getTokenNumber = (imageUrl: string): string => {
    const match = imageUrl.match(/\/(\d+)\.png/);
    return match ? match[1] : 'Unknown';
  };

  // Helper function to get NFT display name
  const getNFTName = (nft: InquisitionNFT): string => {
    if (nft.name && !nft.name.includes('undefined')) {
      return nft.name;
    }
    const tokenNumber = getTokenNumber(nft.image_url);
    return `${nft.collection_name} #${tokenNumber}`;
  };

  // Get rarity tier based on score
  const getRarityTier = (score: string | number): { label: string; color: string; bgColor: string } => {
    const scoreNum = typeof score === 'string' ? parseFloat(score) : score;
    if (scoreNum >= 1000) return { label: 'Legendary', color: 'text-yellow-300', bgColor: 'bg-yellow-900' };
    if (scoreNum >= 750) return { label: 'Epic', color: 'text-purple-300', bgColor: 'bg-purple-900' };
    if (scoreNum >= 500) return { label: 'Rare', color: 'text-blue-300', bgColor: 'bg-blue-900' };
    if (scoreNum >= 250) return { label: 'Uncommon', color: 'text-green-300', bgColor: 'bg-green-900' };
    return { label: 'Common', color: 'text-slate-300', bgColor: 'bg-slate-700' };
  };

  const rarity = getRarityTier(nft.rarity_score);
  const displayName = getNFTName(nft);
  const totalPower = nft.total_power || parseFloat(nft.rarity_score) || 0;

  // Power attributes
  const powerAttrs = [
    { 
      icon: Swords, 
      label: 'Army', 
      value: nft.army_power || nft.power_strength || 0,
      color: 'text-red-400',
      bgColor: 'bg-red-500'
    },
    { 
      icon: Shield, 
      label: 'Civilization', 
      value: nft.civilization_power || nft.power_defense || 0,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500'
    },
    { 
      icon: Sparkles, 
      label: 'Religion', 
      value: nft.religion_power || nft.power_magic || 0,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500'
    },
    { 
      icon: Zap, 
      label: 'Economic', 
      value: nft.economic_power || nft.power_speed || 0,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500'
    },
  ];

  // Get max power for scaling bars
  const maxPower = Math.max(...powerAttrs.map(p => p.value), 1);

  // Handle image URL transformation
  const getImageUrl = (url: string): string => {
    if (!url) return '';
    if (url.startsWith('ipfs://')) {
      return url.replace('ipfs://', 'https://ipfs.io/ipfs/');
    }
    return url;
  };

  // Get the display image URL (AI-generated if available, otherwise original)
  const displayImageUrl = (nft as any).ai_generated_image_url || nft.image_url;
  const hasAIImage = !!(nft as any).ai_generated_image_url;

  return (
    <Card 
      className={`bg-slate-800 border-2 border-purple-600 hover:border-purple-500 cursor-pointer transition-all hover:scale-105 overflow-hidden ${
        compact ? 'h-auto' : 'h-full'
      }`}
      onClick={onClick}
    >
      {/* NFT Image */}
      <div 
        className="relative overflow-hidden bg-slate-900"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {!imageError && displayImageUrl ? (
          <img 
            src={getImageUrl(displayImageUrl)}
            alt={displayName}
            className={`w-full object-cover ${compact ? 'h-32' : 'h-48'}`}
            onError={() => setImageError(true)}
          />
        ) : (
          <div className={`w-full ${compact ? 'h-32' : 'h-48'} flex items-center justify-center bg-slate-900`}>
            <Shield className="w-16 h-16 text-slate-700" />
          </div>
        )}
        
        {/* Generate Your Image Overlay (when no AI image) */}
        {!hasAIImage && (isHovering || compact) && (
          <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center">
            <div className="text-center px-4">
              <Wand2 className="w-8 h-8 mx-auto mb-2 text-purple-400 animate-pulse" />
              <p className="text-white font-bold text-sm mb-1">Generate Your Image</p>
              <p className="text-slate-300 text-xs">Click to create AI art</p>
            </div>
          </div>
        )}
        
        {/* AI Enhanced Badge (top-left) */}
        {hasAIImage && (
          <div className="absolute top-2 left-2">
            <Badge className="bg-purple-900 text-purple-300 border border-purple-500 font-bold text-xs">
              <Sparkles className="w-3 h-3 mr-1" />
              AI Enhanced
            </Badge>
          </div>
        )}

        {/* Rarity Badge */}
        <div className={`absolute top-2 ${hasAIImage ? 'right-2' : 'right-2'}`}>
          <Badge className={`${rarity.bgColor} ${rarity.color} border-0 font-bold`}>
            <Crown className="w-3 h-3 mr-1" />
            {rarity.label}
          </Badge>
        </div>

        {/* Total Power Badge */}
        <div className={`absolute ${hasAIImage ? 'bottom-2 left-2' : 'top-12 left-2'}`}>
          <Badge className="bg-amber-900 text-amber-300 border-0 font-bold">
            <Sparkles className="w-3 h-3 mr-1" />
            {totalPower.toLocaleString()}
          </Badge>
        </div>
      </div>

      <CardContent className="p-4 space-y-3">
        {/* NFT Name */}
        <div>
          <h3 className="text-white font-bold text-lg truncate" title={displayName}>
            {displayName}
          </h3>
          <p className="text-slate-400 text-xs truncate" title={nft.collection_name}>
            {nft.collection_name}
          </p>
        </div>

        {/* Game Role */}
        {nft.game_role && (
          <Badge variant="outline" className="border-purple-500 text-purple-300 capitalize">
            <Target className="w-3 h-3 mr-1" />
            {nft.game_role}
          </Badge>
        )}

        {/* Character Classification (All Collections) */}
        {(nft.material_type || nft.character_class || nft.battle_specialization) && (
          <div className="flex flex-wrap gap-2">
            {nft.material_type && (
              <Badge variant="outline" className="border-amber-600 text-amber-400 capitalize text-xs">
                <Crown className="w-3 h-3 mr-1" />
                {nft.material_type}
              </Badge>
            )}
            {nft.character_class && (
              <Badge variant="outline" className="border-cyan-600 text-cyan-400 capitalize text-xs">
                <Shield className="w-3 h-3 mr-1" />
                {nft.character_class}
              </Badge>
            )}
            {nft.battle_specialization && (
              <Badge variant="outline" className="border-rose-600 text-rose-400 capitalize text-xs">
                <Swords className="w-3 h-3 mr-1" />
                {nft.battle_specialization}
              </Badge>
            )}
          </div>
        )}

        {/* Power Attributes */}
        {showPowerBars && !compact && (
          <div className="space-y-2">
            {powerAttrs.map((attr) => (
              <div key={attr.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1">
                    <attr.icon className={`w-3 h-3 ${attr.color}`} />
                    <span className={attr.color}>{attr.label}</span>
                  </div>
                  <span className="text-white font-bold">{attr.value}</span>
                </div>
                <div className="h-2 bg-slate-900 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${attr.bgColor} rounded-full transition-all duration-300`}
                    style={{ width: `${(attr.value / maxPower) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Compact Power Display */}
        {showPowerBars && compact && (
          <div className="flex items-center justify-around gap-2">
            {powerAttrs.map((attr) => (
              <div key={attr.label} className="flex items-center gap-1">
                <attr.icon className={`w-3 h-3 ${attr.color}`} />
                <span className={`text-xs ${attr.color} font-bold`}>{attr.value}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
