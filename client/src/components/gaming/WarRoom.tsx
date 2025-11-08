import { Swords, Trophy, Users, TrendingUp, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Battle {
  id: string;
  battle_type: string;
  status: string;
  opponent_handle?: string;
  created_at: string;
}

interface Alliance {
  id: string;
  name: string;
  member_count: number;
  total_power: number;
}

interface WarRoomProps {
  activeBattles: Battle[];
  battleStats: {
    total_battles: number;
    battles_won: number;
    battles_lost: number;
  };
  alliance: Alliance | null;
  theme: 'light' | 'dark';
  onCreateBattle: () => void;
  onViewLeaderboards: () => void;
  onManageAlliance: () => void;
}

export function WarRoom({ 
  activeBattles, 
  battleStats, 
  alliance, 
  theme,
  onCreateBattle,
  onViewLeaderboards,
  onManageAlliance
}: WarRoomProps) {
  const winRate = battleStats.total_battles > 0 
    ? ((battleStats.battles_won / battleStats.total_battles) * 100).toFixed(1)
    : "0.0";

  return (
    <Card className={`${theme === 'dark' ? 'bg-slate-900/95 border-blue-500/30' : 'bg-white border-blue-300'} backdrop-blur-sm transition-all duration-300 hover:shadow-2xl`}>
      <CardHeader className="pb-3">
        <CardTitle className={`text-lg sm:text-xl ${theme === 'dark' ? 'text-white' : 'text-gray-900'} flex items-center justify-between`}>
          <div className="flex items-center gap-2">
            <Swords className="w-5 h-5 text-blue-400" />
            War Room
          </div>
          <Badge variant="outline" className="border-red-500 text-red-400">
            {activeBattles.length} Active
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Battle Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className={`${theme === 'dark' ? 'bg-blue-900/20 border-blue-500/30' : 'bg-blue-50 border-blue-200'} border rounded-lg p-2 text-center`}>
            <Trophy className="w-4 h-4 text-blue-400 mx-auto mb-1" />
            <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Wins</p>
            <p className="text-sm font-bold text-blue-400">{battleStats.battles_won}</p>
          </div>
          <div className={`${theme === 'dark' ? 'bg-red-900/20 border-red-500/30' : 'bg-red-50 border-red-200'} border rounded-lg p-2 text-center`}>
            <Swords className="w-4 h-4 text-red-400 mx-auto mb-1" />
            <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Losses</p>
            <p className="text-sm font-bold text-red-400">{battleStats.battles_lost}</p>
          </div>
          <div className={`${theme === 'dark' ? 'bg-green-900/20 border-green-500/30' : 'bg-green-50 border-green-200'} border rounded-lg p-2 text-center`}>
            <TrendingUp className="w-4 h-4 text-green-400 mx-auto mb-1" />
            <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Win Rate</p>
            <p className="text-sm font-bold text-green-400">{winRate}%</p>
          </div>
        </div>

        {/* Active Battles */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Active Battles ({activeBattles.length})
            </h3>
            <Button
              onClick={onCreateBattle}
              size="sm"
              variant="outline"
              className="border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white h-7 text-xs"
            >
              + New Battle
            </Button>
          </div>
          
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {activeBattles.length === 0 ? (
              <div className={`text-center py-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                <Swords className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No active battles</p>
              </div>
            ) : (
              activeBattles.map((battle) => (
                <div
                  key={battle.id}
                  className={`${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-gray-50 border-gray-200'} border rounded-lg p-3 hover:border-blue-500/50 transition-all cursor-pointer`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        {battle.battle_type === '1v1' ? '1v1' : 'Group'} Battle
                      </p>
                      <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                        vs {battle.opponent_handle || 'AI'} • {battle.status}
                      </p>
                    </div>
                    <Clock className="w-5 h-5 text-blue-400" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Alliance Info */}
        {alliance && (
          <div className={`${theme === 'dark' ? 'bg-purple-900/20 border-purple-500/30' : 'bg-purple-50 border-purple-200'} border rounded-lg p-3`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-400" />
                <div>
                  <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{alliance.name}</p>
                  <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    {alliance.member_count} members • {alliance.total_power.toFixed(0)} power
                  </p>
                </div>
              </div>
              <Button
                onClick={onManageAlliance}
                size="sm"
                variant="outline"
                className="border-purple-500 text-purple-400 hover:bg-purple-500 hover:text-white h-7 text-xs"
              >
                Manage
              </Button>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-700">
          <Badge 
            variant="outline" 
            className="cursor-pointer hover:bg-amber-500/20 border-amber-500 text-amber-400"
            onClick={onViewLeaderboards}
          >
            <Trophy className="w-3 h-3 mr-1" />
            Leaderboards
          </Badge>
          {!alliance && (
            <Badge 
              variant="outline" 
              className="cursor-pointer hover:bg-purple-500/20 border-purple-500 text-purple-400"
              onClick={onManageAlliance}
            >
              <Users className="w-3 h-3 mr-1" />
              Join Alliance
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
