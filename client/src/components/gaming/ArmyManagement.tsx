import { Users, Sword, Shield, Crown, Sparkles, Coins } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

interface Squadron {
  id: string;
  name: string;
  total_power: number;
  nft_count: number;
}

interface ArmyManagementProps {
  squadrons: Squadron[];
  totalNFTs: number;
  powerDistribution: {
    army: number;
    religion: number;
    civilization: number;
    economic: number;
  };
  theme: 'light' | 'dark';
  onCreateSquadron: () => void;
  onManageWeapons: () => void;
  onViewAllNFTs: () => void;
}

export function ArmyManagement({ 
  squadrons, 
  totalNFTs, 
  powerDistribution, 
  theme, 
  onCreateSquadron,
  onManageWeapons,
  onViewAllNFTs
}: ArmyManagementProps) {
  const [, setLocation] = useLocation();
  
  return (
    <Card className={`${theme === 'dark' ? 'bg-slate-900/95 border-red-500/30' : 'bg-white border-red-300'} backdrop-blur-sm transition-all duration-300 hover:shadow-2xl`}>
      <CardHeader className="pb-3">
        <CardTitle className={`text-lg sm:text-xl ${theme === 'dark' ? 'text-white' : 'text-gray-900'} flex items-center justify-between`}>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-red-400" />
            Army Management
          </div>
          <Badge variant="outline" className="border-orange-500 text-orange-400">
            {totalNFTs} NFTs
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Power Distribution */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className={`${theme === 'dark' ? 'bg-red-900/20 border-red-500/30' : 'bg-red-50 border-red-200'} border rounded-lg p-2 text-center`}>
            <Shield className="w-4 h-4 text-red-400 mx-auto mb-1" />
            <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Army</p>
            <p className="text-sm font-bold text-red-400">{Number(powerDistribution.army || 0).toFixed(0)}</p>
          </div>
          <div className={`${theme === 'dark' ? 'bg-purple-900/20 border-purple-500/30' : 'bg-purple-50 border-purple-200'} border rounded-lg p-2 text-center`}>
            <Sparkles className="w-4 h-4 text-purple-400 mx-auto mb-1" />
            <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Religion</p>
            <p className="text-sm font-bold text-purple-400">{Number(powerDistribution.religion || 0).toFixed(0)}</p>
          </div>
          <div className={`${theme === 'dark' ? 'bg-blue-900/20 border-blue-500/30' : 'bg-blue-50 border-blue-200'} border rounded-lg p-2 text-center`}>
            <Crown className="w-4 h-4 text-blue-400 mx-auto mb-1" />
            <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Civilization</p>
            <p className="text-sm font-bold text-blue-400">{Number(powerDistribution.civilization || 0).toFixed(0)}</p>
          </div>
          <div className={`${theme === 'dark' ? 'bg-green-900/20 border-green-500/30' : 'bg-green-50 border-green-200'} border rounded-lg p-2 text-center`}>
            <Coins className="w-4 h-4 text-green-400 mx-auto mb-1" />
            <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Economic</p>
            <p className="text-sm font-bold text-green-400">{Number(powerDistribution.economic || 0).toFixed(0)}</p>
          </div>
        </div>

        {/* Squadrons List */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Squadrons ({squadrons.length})
            </h3>
            <Button
              onClick={onCreateSquadron}
              size="sm"
              variant="outline"
              className="border-red-500 text-red-400 hover:bg-red-500 hover:text-white h-7 text-xs"
            >
              + Create
            </Button>
          </div>
          
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {squadrons.length === 0 ? (
              <div className={`text-center py-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No squadrons yet</p>
              </div>
            ) : (
              squadrons.map((squadron) => (
                <div
                  key={squadron.id}
                  onClick={() => setLocation(`/gaming/squadrons/${squadron.id}`)}
                  className={`${theme === 'dark' ? 'bg-slate-800/50 border-slate-700 hover:bg-slate-800' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'} border rounded-lg p-3 hover:border-red-500/50 transition-all cursor-pointer`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{squadron.name}</p>
                      <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                        {squadron.nft_count} NFTs • Power: {Number(squadron.total_power || 0).toFixed(0)}
                      </p>
                    </div>
                    <Users className="w-5 h-5 text-red-400" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-700">
          <Badge 
            variant="outline" 
            className="cursor-pointer hover:bg-orange-500/20 border-orange-500 text-orange-400"
            onClick={onManageWeapons}
          >
            <Sword className="w-3 h-3 mr-1" />
            Weapons Arsenal
          </Badge>
          <Badge 
            variant="outline" 
            className="cursor-pointer hover:bg-red-500/20 border-red-500 text-red-400"
            onClick={onViewAllNFTs}
          >
            <Shield className="w-3 h-3 mr-1" />
            View All NFTs
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
