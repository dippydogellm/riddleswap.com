import { User, Shield, Crown, Sparkles, Award, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { sessionManager } from "@/utils/sessionManager";

interface ProfileHubProps {
  player: {
    player_name?: string;
    handle: string;
    level: number;
    commander_profile_image?: string;
    commander_class?: string;
    play_type?: string;
  };
  civilization: {
    civilization_name?: string;
    motto?: string;
    crest_image?: string;
  };
  stats: {
    total_power: number;
    total_battles: number;
    battles_won: number;
    battles_lost: number;
  };
  theme: 'light' | 'dark';
  onEditProfile: () => void;
  onSyncComplete?: () => void; // Callback to refresh data after sync
}

export function ProfileHub({ player, civilization, stats, theme, onEditProfile, onSyncComplete }: ProfileHubProps) {
  const { toast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  
  const winRate = stats.total_battles > 0 
    ? ((stats.battles_won / stats.total_battles) * 100).toFixed(1)
    : "0.0";

  const handleWalletScan = async () => {
    try {
      setIsScanning(true);
      
      // Get session token for authentication
      const sessionToken = sessionManager.getSessionToken();
      if (!sessionToken) {
        throw new Error("Please log in to scan your wallet");
      }
      
      toast({
        title: "Scanning Wallet...",
        description: "Fetching all NFTs from your wallet on-chain. This may take a moment.",
      });
      
      const response = await fetch('/api/gaming/player/scan-wallet-nfts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        credentials: 'include'
      });

      const data = await response.json() as any;
      
      if (data.success) {
        const collections = Object.keys(data.scan_result?.collections || {}).length;
        toast({
          title: "Wallet Scan Complete!",
          description: `Found ${data.scan_result.total_nfts} NFTs from ${collections} collections with ${data.scan_result.total_power} total power`,
        });
        
        // Trigger callback to refresh parent component data
        if (onSyncComplete) {
          onSyncComplete();
        }
      } else {
        throw new Error(data.error || "Failed to scan wallet");
      }
    } catch (error: any) {
      console.error('Wallet scan error:', error);
      toast({
        title: "Scan Failed",
        description: error.message || "Failed to scan wallet. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleManualSync = async () => {
    try {
      setIsSyncing(true);
      
      // Get session token for authentication
      const sessionToken = sessionManager.getSessionToken();
      if (!sessionToken) {
        throw new Error("Please log in to sync NFTs");
      }
      
      const response = await fetch('/api/gaming/player/sync-nfts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        credentials: 'include'
      });

      const data = await response.json() as any;
      
      if (data.success) {
        toast({
          title: "NFT Sync Complete!",
          description: `Synced ${data.data.total_nfts} NFTs with ${data.data.total_power.toFixed(0)} total power`,
        });
        
        // Trigger callback to refresh parent component data
        if (onSyncComplete) {
          onSyncComplete();
        }
      } else {
        throw new Error(data.error || "Failed to sync NFTs");
      }
    } catch (error: any) {
      console.error('NFT sync error:', error);
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync NFT power. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Card className={`${theme === 'dark' ? 'bg-slate-900/95 border-orange-500/30' : 'bg-white border-orange-300'} backdrop-blur-sm transition-all duration-300 hover:shadow-2xl`}>
      <CardContent className="p-4 sm:p-6">
        {/* Mobile-first header */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
          {/* Profile Picture */}
          <div className="relative flex-shrink-0">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-orange-500 to-red-600 p-1 shadow-[0_0_20px_rgba(255,140,0,0.4)]">
              <div className={`w-full h-full rounded-full ${theme === 'dark' ? 'bg-slate-800' : 'bg-gray-100'} flex items-center justify-center overflow-hidden`}>
                {player.commander_profile_image ? (
                  <img 
                    src={player.commander_profile_image} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-10 h-10 sm:w-12 sm:h-12 text-orange-400" />
                )}
              </div>
            </div>
            <div className="absolute -bottom-1 -right-1 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full px-2 py-0.5 text-xs font-bold text-white shadow-lg">
              Lv {player.level}
            </div>
          </div>

          {/* Civilization Crest */}
          {civilization.crest_image && (
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 p-1 shadow-[0_0_15px_rgba(147,51,234,0.3)]">
              <div className={`w-full h-full rounded-lg ${theme === 'dark' ? 'bg-slate-800' : 'bg-gray-100'} flex items-center justify-center overflow-hidden`}>
                <img 
                  src={civilization.crest_image} 
                  alt="Crest" 
                  className="w-full h-full object-contain p-1"
                />
              </div>
            </div>
          )}

          {/* Player Info */}
          <div className="flex-1 text-center sm:text-left">
            <h2 className={`text-xl sm:text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'} mb-1`}>
              {player.player_name || `@${player.handle}`}
            </h2>
            {civilization.civilization_name && (
              <p className="text-base sm:text-lg text-amber-400 font-semibold mb-1">
                {civilization.civilization_name}
              </p>
            )}
            {civilization.motto && (
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'} italic mb-2`}>
                "{civilization.motto}"
              </p>
            )}
            
            {/* Badges */}
            <div className="flex flex-wrap justify-center sm:justify-start gap-2">
              {player.commander_class && (
                <Badge variant="outline" className="border-orange-500 text-orange-400">
                  <Shield className="w-3 h-3 mr-1" />
                  {player.commander_class}
                </Badge>
              )}
              {player.play_type && (
                <Badge variant="outline" className="border-purple-500 text-purple-400">
                  <Crown className="w-3 h-3 mr-1" />
                  {player.play_type.replace('_', ' ')}
                </Badge>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={onEditProfile}
              variant="outline"
              size="sm"
              className="border-orange-500 text-orange-400 hover:bg-orange-500 hover:text-white"
            >
              Edit Profile
            </Button>
            <Button
              onClick={handleWalletScan}
              disabled={isScanning}
              variant="outline"
              size="sm"
              className="border-purple-500 text-purple-400 hover:bg-purple-500 hover:text-white"
            >
              {isScanning ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Scan My Wallet
                </>
              )}
            </Button>
            <Button
              onClick={handleManualSync}
              disabled={isSyncing}
              variant="outline"
              size="sm"
              className="border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Sync NFT Power
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Stats Grid - Mobile Optimized */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className={`${theme === 'dark' ? 'bg-orange-900/20 border-orange-500/30' : 'bg-orange-50 border-orange-200'} border rounded-lg p-3 text-center`}>
            <Sparkles className="w-5 h-5 text-orange-400 mx-auto mb-1" />
            <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} mb-1`}>Total Power</p>
            <p className="text-lg font-bold text-orange-400">{stats.total_power.toFixed(0)}</p>
          </div>
          <div className={`${theme === 'dark' ? 'bg-green-900/20 border-green-500/30' : 'bg-green-50 border-green-200'} border rounded-lg p-3 text-center`}>
            <Award className="w-5 h-5 text-green-400 mx-auto mb-1" />
            <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} mb-1`}>Win Rate</p>
            <p className="text-lg font-bold text-green-400">{winRate}%</p>
          </div>
          <div className={`${theme === 'dark' ? 'bg-blue-900/20 border-blue-500/30' : 'bg-blue-50 border-blue-200'} border rounded-lg p-3 text-center`}>
            <Shield className="w-5 h-5 text-blue-400 mx-auto mb-1" />
            <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} mb-1`}>Victories</p>
            <p className="text-lg font-bold text-blue-400">{stats.battles_won}</p>
          </div>
          <div className={`${theme === 'dark' ? 'bg-red-900/20 border-red-500/30' : 'bg-red-50 border-red-200'} border rounded-lg p-3 text-center`}>
            <Shield className="w-5 h-5 text-red-400 mx-auto mb-1" />
            <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} mb-1`}>Defeats</p>
            <p className="text-lg font-bold text-red-400">{stats.battles_lost}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
