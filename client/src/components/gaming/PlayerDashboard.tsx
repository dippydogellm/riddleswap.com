import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { sessionManager } from "@/utils/sessionManager";
import FirstTimeWizard from "@/components/first-time-wizard";
import { DatabaseImageUploader } from "@/components/DatabaseImageUploader";
import { 
  Crown, 
  Shield, 
  Coins, 
  Trophy, 
  Users, 
  Zap,
  Star,
  Sparkles,
  Settings,
  Image as ImageIcon,
  Swords,
  User,
  Target,
  TrendingUp,
  Skull,
  Heart,
  Package
} from "lucide-react";

interface PlayerStats {
  user_handle: string;
  player_name?: string;
  total_nfts_owned: number;
  army_power: number;
  bank_power: number;
  merchant_power: number;
  special_power: number;
  total_power_level: number;
  gaming_rank: string;
  achievements: string[];
  verification_completed_at?: string;
  first_time_setup_completed?: boolean;
  civilization_founded?: boolean;
  current_round?: number;
  crest_image?: string;
  commander_profile_image?: string;
}

interface DashboardData {
  player: PlayerStats | null;
  nft_collections: any;
  recent_events: any[];
  stats: {
    collections_owned: number;
    total_nfts: number;
    power_breakdown: {
      army: number;
      bank: number;
      merchant: number;
      special: number;
    };
    total_power: number;
    rank: string;
  };
}

interface PlayerDashboardProps {
  dashboard?: DashboardData;
  isLoading: boolean;
  liveNftData?: {
    collections: Record<string, { count: number; power: number; name: string }>;
    total_nfts: number;
    total_power: number;
  };
  nftDataLoading?: boolean;
}

// Player Registration Form Component
const PlayerRegistrationForm = () => {
  // Get Riddle wallet session data
  const session = sessionManager.getSession();
  const [showWizard, setShowWizard] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Close wizard and refresh dashboard
  const handleWizardClose = () => {
    setShowWizard(false);
    queryClient.invalidateQueries({ queryKey: ['/api/gaming/player/dashboard'] });
  };

  return (
    <>
      <Card className="gaming-component-card border-blue-500/30">
        <CardHeader>
          <CardTitle className="text-blue-400 font-mono flex items-center gap-2">
            <Crown className="h-5 w-5" />
            JOIN THE MEDIEVAL CONQUEST
          </CardTitle>
          <CardDescription className="text-slate-400">
            Enter the realm and begin your legendary quest in "Trolls Inquisition Multi-Chain Medieval Mayhem"
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Riddle Handle - Read Only */}
          <div className="bg-slate-700/30 p-4 rounded border border-blue-500/30">
            <Label className="text-slate-300 text-sm font-medium">Linked Riddle Wallet</Label>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="border-blue-500/30 text-blue-300 bg-blue-500/10">
                🔗 @{session.handle || 'Unknown'}
              </Badge>
              <span className="text-xs text-slate-400">Your gamer profile will be linked to this wallet</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              This ensures secure ownership of your in-game assets and prevents account theft
            </p>
          </div>

          {/* Legend Preview */}
          <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 p-6 rounded-lg border border-purple-500/30">
            <div className="text-center space-y-4">
              <Sparkles className="h-12 w-12 mx-auto text-purple-400" />
              <h3 className="text-xl font-bold text-purple-300">🏰 Your Legend Awaits</h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                Step into a world where your NFTs become mighty armies, where civilizations rise and fall, 
                and where every decision shapes the fate of kingdoms. Begin your journey as a legendary ruler!
              </p>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded">
                  <Crown className="h-5 w-5 text-amber-400 mx-auto mb-1" />
                  <p className="text-amber-300">Found Civilization</p>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 p-3 rounded">
                  <Shield className="h-5 w-5 text-red-400 mx-auto mb-1" />
                  <p className="text-red-300">Command Armies</p>
                </div>
                <div className="bg-green-500/10 border border-green-500/20 p-3 rounded">
                  <Users className="h-5 w-5 text-green-400 mx-auto mb-1" />
                  <p className="text-green-300">Forge Alliances</p>
                </div>
                <div className="bg-purple-500/10 border border-purple-500/20 p-3 rounded">
                  <Trophy className="h-5 w-5 text-purple-400 mx-auto mb-1" />
                  <p className="text-purple-300">Claim Victory</p>
                </div>
              </div>
            </div>
          </div>

          <Button 
            onClick={() => setShowWizard(true)}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-lg py-6"
            data-testid="button-begin-legend"
          >
            <Crown className="h-5 w-5 mr-2" />
            Begin Your Legend
          </Button>
          
          <p className="text-xs text-slate-500 text-center">
            ⚡ This will launch the civilization setup wizard where you'll name your kingdom, choose colors, and seek allies
          </p>
        </CardContent>
      </Card>

      {/* First Time Wizard */}
      <FirstTimeWizard
        isOpen={showWizard}
        onClose={handleWizardClose}
        userHandle={session.handle || 'Unknown'}
        currentRound={1} // You can make this dynamic later
        onCompleted={(playerData: any) => {
          console.log('Player setup completed:', playerData);
          handleWizardClose();
        }}
      />
    </>
  );
};

export const PlayerDashboard = ({ dashboard, isLoading, liveNftData, nftDataLoading }: PlayerDashboardProps) => {

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card className="gaming-component-card">
          <CardHeader>
            <div className="animate-pulse">
              <div className="h-6 bg-slate-600 rounded w-1/3 mb-2"></div>
              <div className="h-4 bg-slate-700 rounded w-1/2"></div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse space-y-4">
              <div className="h-20 bg-slate-600 rounded"></div>
              <div className="h-4 bg-slate-700 rounded w-3/4"></div>
              <div className="h-4 bg-slate-700 rounded w-1/2"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!dashboard?.player) {
    return <PlayerRegistrationForm />;
  }

  const { player, stats } = dashboard;

  return (
    <div className="space-y-6">
      {/* Commander Profile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="gaming-component-card border-red-500/30">
          <CardHeader>
            <CardTitle className="text-red-300 font-mono flex items-center gap-2">
              <Crown className="h-5 w-5" />
              COMMANDER PROFILE
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 border-2 border-red-500/30 flex-shrink-0">
                  <AvatarImage 
                    src={player.commander_profile_image || `https://api.dicebear.com/7.x/adventurer/svg?seed=${player.user_handle}`} 
                  />
                  <AvatarFallback className="bg-red-900/30 text-red-300 text-lg font-bold">
                    {player.user_handle.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-red-300 font-mono">
                    {player.player_name || player.user_handle}
                  </h3>
                  <Badge className="bg-red-600 text-white">
                    {player.gaming_rank}
                  </Badge>
                  <p className="text-slate-400 text-sm">@{player.user_handle}</p>
                </div>
              </div>
              {player.crest_image && (
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <img
                    src={player.crest_image}
                    alt="Civilization Crest"
                    className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded border-2 border-yellow-500/50"
                  />
                  <span className="text-xs text-yellow-400">Crest</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Total Power:</span>
                <span className="text-red-400 font-mono font-bold">
                  {nftDataLoading ? '...' : (liveNftData?.total_power || player.total_power_level).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">NFT Holdings:</span>
                <span className="text-cyan-400 font-mono">
                  {nftDataLoading ? '...' : (liveNftData?.total_nfts || player.total_nfts_owned)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Collections:</span>
                <span className="text-purple-400 font-mono">
                  {nftDataLoading ? '...' : (Object.keys(liveNftData?.collections || {}).length || stats?.collections_owned || 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Achievements:</span>
                <span className="text-yellow-400 font-mono">{player.achievements?.length || 0}</span>
              </div>
            </div>

            {player.achievements && player.achievements.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-yellow-300 font-mono text-sm flex items-center gap-2">
                  <Trophy className="h-4 w-4" />
                  RECENT ACHIEVEMENTS
                </h4>
                <div className="flex flex-wrap gap-1">
                  {player.achievements.slice(0, 3).map((achievement, index) => (
                    <Badge key={index} variant="outline" className="border-yellow-500/30 text-yellow-300 text-xs">
                      <Star className="h-3 w-3 mr-1" />
                      {achievement}
                    </Badge>
                  ))}
                  {player.achievements.length > 3 && (
                    <Badge variant="outline" className="border-slate-500/30 text-slate-400 text-xs">
                      +{player.achievements.length - 3} more
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Power Breakdown */}
        <Card className="gaming-component-card border-purple-500/30">
          <CardHeader>
            <CardTitle className="text-purple-300 font-mono flex items-center gap-2">
              <Zap className="h-5 w-5" />
              POWER ANALYSIS
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {/* Army Power */}
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400 flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Army Power
                  </span>
                  <span className="text-red-400 font-mono">{stats?.power_breakdown?.army || player.army_power}</span>
                </div>
                <Progress 
                  value={(stats?.power_breakdown?.army || player.army_power) / player.total_power_level * 100} 
                  className="h-2 bg-slate-700" 
                />
              </div>

              {/* Bank Power */}
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400 flex items-center gap-2">
                    <Coins className="h-4 w-4" />
                    Bank Power
                  </span>
                  <span className="text-green-400 font-mono">{stats?.power_breakdown?.bank || player.bank_power}</span>
                </div>
                <Progress 
                  value={(stats?.power_breakdown?.bank || player.bank_power) / player.total_power_level * 100} 
                  className="h-2 bg-slate-700" 
                />
              </div>

              {/* Merchant Power */}
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Merchant Power
                  </span>
                  <span className="text-blue-400 font-mono">{stats?.power_breakdown?.merchant || player.merchant_power}</span>
                </div>
                <Progress 
                  value={(stats?.power_breakdown?.merchant || player.merchant_power) / player.total_power_level * 100} 
                  className="h-2 bg-slate-700" 
                />
              </div>

              {/* Special Power */}
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400 flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Special Power
                  </span>
                  <span className="text-purple-400 font-mono">{stats?.power_breakdown?.special || player.special_power}</span>
                </div>
                <Progress 
                  value={(stats?.power_breakdown?.special || player.special_power) / player.total_power_level * 100} 
                  className="h-2 bg-slate-700" 
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-600">
              <div className="flex justify-between">
                <span className="text-slate-300 font-medium">Total Power Level:</span>
                <span className="text-yellow-400 font-mono font-bold text-lg">
                  {player.total_power_level.toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Indicators */}
      <Card className="gaming-component-card border-cyan-500/30">
        <CardHeader>
          <CardTitle className="text-cyan-300 font-mono flex items-center gap-2">
            <Shield className="h-5 w-5" />
            COMMANDER STATUS
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50">
              <span className="text-slate-400">Setup Complete</span>
              <Badge className={player.first_time_setup_completed ? "bg-green-600" : "bg-red-600"}>
                {player.first_time_setup_completed ? "Yes" : "No"}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50">
              <span className="text-slate-400">Civilization</span>
              <Badge className={player.civilization_founded ? "bg-green-600" : "bg-yellow-600"}>
                {player.civilization_founded ? "Founded" : "Pending"}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50">
              <span className="text-slate-400">Current Round</span>
              <Badge variant="outline" className="border-cyan-500/30 text-cyan-300">
                #{player.current_round || 1}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile Controls */}
      <ProfileControlsSection player={player} />

      {/* Army Profile Section */}
      <ArmyProfileSection player={player} />

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-4">
        <Button className="bg-red-600 hover:bg-red-700" data-testid="button-view-profile">
          <Crown className="h-4 w-4 mr-2" />
          View Full Profile
        </Button>
        <Button variant="outline" className="border-purple-500/30 text-purple-300" data-testid="button-edit-profile">
          Edit Profile
        </Button>
        <Button variant="outline" className="border-cyan-500/30 text-cyan-300" data-testid="button-view-achievements">
          <Trophy className="h-4 w-4 mr-2" />
          View Achievements
        </Button>
      </div>
    </div>
  );
};

// Profile Controls Section Component
const ProfileControlsSection = ({ player }: { player: PlayerStats }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Image update mutation
  const updateImagesMutation = useMutation({
    mutationFn: async (imageData: { crest_image?: string; commander_profile_image?: string }) => {
      return apiRequest('/api/gaming/player/images', {
        method: 'PUT',
        body: JSON.stringify(imageData),
        headers: {
          'Content-Type': 'application/json',
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gaming/player/dashboard'] });
      toast({
        title: "Profile Updated",
        description: "Your profile images have been updated successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update profile images. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCrestUpload = (base64Data: string) => {
    updateImagesMutation.mutate({ crest_image: base64Data });
  };

  const handleCommanderUpload = (base64Data: string) => {
    updateImagesMutation.mutate({ commander_profile_image: base64Data });
  };

  const handleUploadError = (error: string) => {
    toast({
      title: "Upload Failed",
      description: error,
      variant: "destructive",
    });
  };

  return (
    <Card className="gaming-component-card border-green-500/30">
      <CardHeader>
        <CardTitle className="text-green-300 font-mono flex items-center gap-2">
          <Settings className="h-5 w-5" />
          PROFILE CONTROLS
        </CardTitle>
        <CardDescription className="text-slate-400">
          Customize your civilization crest and commander profile picture
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Image Upload Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Civilization Crest Upload */}
          <div className="space-y-3">
            <h4 className="text-green-300 font-mono text-sm flex items-center gap-2">
              <Crown className="h-4 w-4" />
              CIVILIZATION CREST
            </h4>
            <p className="text-slate-400 text-xs">
              Upload your civilization's heraldic symbol and coat of arms
            </p>
            <DatabaseImageUploader
              type="crest"
              currentImage={player.crest_image}
              onUploadSuccess={handleCrestUpload}
              onUploadError={handleUploadError}
              className="w-full"
            />
          </div>

          {/* Commander Profile Picture Upload */}
          <div className="space-y-3">
            <h4 className="text-green-300 font-mono text-sm flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              COMMANDER PORTRAIT
            </h4>
            <p className="text-slate-400 text-xs">
              Upload your commander's official portrait for diplomatic meetings
            </p>
            <DatabaseImageUploader
              type="commander"
              currentImage={player.commander_profile_image}
              onUploadSuccess={handleCommanderUpload}
              onUploadError={handleUploadError}
              className="w-full"
            />
          </div>
        </div>

        {/* Upload Guidelines */}
        <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-600/50">
          <h5 className="text-slate-300 font-mono text-sm mb-2">📋 UPLOAD GUIDELINES</h5>
          <ul className="text-xs text-slate-400 space-y-1">
            <li>• Maximum file size: 5MB</li>
            <li>• Supported formats: JPG, PNG, GIF, WebP</li>
            <li>• Images are stored securely in your gaming profile</li>
            <li>• Square aspect ratio recommended for best display</li>
          </ul>
        </div>

        {/* Action Status */}
        {updateImagesMutation.isPending && (
          <div className="flex items-center gap-2 text-blue-400 text-sm">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
            Updating profile...
          </div>
        )}

      </CardContent>
    </Card>
  );
};

// Army Profile Section Component - Shows army details, crest, and soldier counts
const ArmyProfileSection = ({ player }: { player: PlayerStats }) => {
  const [armyData, setArmyData] = useState<any>(null);
  const [isLoadingArmy, setIsLoadingArmy] = useState(false);
  
  // Mock army data for display - in real implementation would fetch from API
  const mockArmyData = {
    name: "Iron Guard Legion", 
    totalStrength: 850,
    morale: 85,
    supply: 92,
    upkeepCost: "125.50",
    units: {
      "Warriors": 45,
      "Archers": 30,
      "Cavalry": 15, 
      "Siege Engines": 5,
      "Mages": 8,
      "Scouts": 12
    },
    balances: {
      "XRP": 1250.75,
      "RDL": 2890.50,
      "Gold": 567
    }
  };

  const unitIcons: Record<string, any> = {
    "Warriors": Swords,
    "Archers": Target, 
    "Cavalry": TrendingUp,
    "Siege Engines": Package,
    "Mages": Sparkles,
    "Scouts": User
  };

  return (
    <Card className="gaming-component-card border-red-500/30">
      <CardHeader>
        <CardTitle className="text-red-300 font-mono flex items-center gap-2">
          <Shield className="h-5 w-5" />
          ARMY PROFILE
        </CardTitle>
        <CardDescription className="text-slate-400">
          Military forces, unit composition, and army treasury
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Army Crest and Basic Info */}
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="w-20 h-20 rounded-lg border-2 border-red-500/30 bg-slate-800/50 flex items-center justify-center overflow-hidden">
              {player.crest_image ? (
                <img 
                  src={player.crest_image} 
                  alt="Army Crest" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <Shield className="h-8 w-8 text-red-400" />
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1 text-center">Army Crest</p>
          </div>
          
          <div className="flex-1 space-y-3">
            <div>
              <h3 className="text-red-300 font-mono text-lg">{mockArmyData.name}</h3>
              <p className="text-slate-400 text-sm">Elite Military Formation</p>
            </div>
            
            {/* Army Stats Grid */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-800/30 p-3 rounded-lg border border-red-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <Swords className="h-4 w-4 text-red-400" />
                  <span className="text-xs text-red-300 font-mono">STRENGTH</span>
                </div>
                <p className="text-red-300 font-bold text-lg">{mockArmyData.totalStrength}</p>
              </div>
              
              <div className="bg-slate-800/30 p-3 rounded-lg border border-yellow-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <Heart className="h-4 w-4 text-yellow-400" />
                  <span className="text-xs text-yellow-300 font-mono">MORALE</span>
                </div>
                <p className="text-yellow-300 font-bold text-lg">{mockArmyData.morale}%</p>
              </div>
              
              <div className="bg-slate-800/30 p-3 rounded-lg border border-green-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <Package className="h-4 w-4 text-green-400" />
                  <span className="text-xs text-green-300 font-mono">SUPPLY</span>
                </div>
                <p className="text-green-300 font-bold text-lg">{mockArmyData.supply}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Unit Composition */}
        <div className="space-y-3">
          <h4 className="text-red-300 font-mono text-sm flex items-center gap-2">
            <Users className="h-4 w-4" />
            UNIT COMPOSITION
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(mockArmyData.units).map(([unitType, count]) => {
              const IconComponent = unitIcons[unitType] || Skull;
              return (
                <div key={unitType} className="bg-slate-800/30 p-3 rounded-lg border border-slate-600/50">
                  <div className="flex items-center gap-2 mb-2">
                    <IconComponent className="h-4 w-4 text-slate-400" />
                    <span className="text-xs text-slate-300 font-mono">{unitType.toUpperCase()}</span>
                  </div>
                  <p className="text-cyan-300 font-bold text-xl">{count}</p>
                  <p className="text-slate-400 text-xs">soldiers</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Army Treasury */}
        <div className="space-y-3">
          <h4 className="text-red-300 font-mono text-sm flex items-center gap-2">
            <Coins className="h-4 w-4" />
            ARMY TREASURY
          </h4>
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(mockArmyData.balances).map(([currency, amount]) => (
              <div key={currency} className="bg-slate-800/30 p-3 rounded-lg border border-yellow-500/20">
                <p className="text-yellow-300 font-mono text-xs mb-1">{currency}</p>
                <p className="text-yellow-300 font-bold text-lg">{amount.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Army Economics */}
        <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-600/50">
          <div className="flex items-center justify-between">
            <span className="text-slate-300 font-mono text-sm">Daily Upkeep Cost</span>
            <span className="text-red-300 font-bold">{mockArmyData.upkeepCost} XRP/day</span>
          </div>
          <p className="text-slate-400 text-xs mt-1">
            Includes soldier wages, equipment maintenance, and supply logistics
          </p>
        </div>

      </CardContent>
    </Card>
  );
};
