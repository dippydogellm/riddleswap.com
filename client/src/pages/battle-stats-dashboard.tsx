import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Swords, TrendingUp, Users, Zap, Coins, MessageSquare, Clock } from "lucide-react";

interface PlayerStats {
  handle: string;
  wallet_address: string;
  total_power: number;
  power_breakdown: {
    army_power: number;
    religion_power: number;
    civilization_power: number;
    economic_power: number;
  };
  battle_stats: {
    total_battles: number;
    battles_won: number;
    battles_lost: number;
    win_rate: string;
  };
  nfts_owned: number;
  recent_battles: any[];
}

interface LeaderboardEntry {
  user_handle: string;
  total_power?: number;
  battles_won?: number;
  total_battles?: number;
}

export default function BattleStatsDashboard() {
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardType, setLeaderboardType] = useState<'power' | 'wins'>('power');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Get current user handle from session
      const userRes = await fetch('/api/users/me');
      if (!userRes.ok) return;
      
      const userData = await userRes.json();
      const handle = userData.user?.handle || userData.user?.userHandle;
      
      if (handle) {
        // Load player stats
        const statsRes = await fetch(`/api/players/${handle}/stats`);
        if (statsRes.ok) {
          const data = await statsRes.json();
          setPlayerStats(data.player);
        }
      }

      // Load leaderboard
      await loadLeaderboard('power');
    } catch (error) {
      console.error("Error loading dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadLeaderboard = async (type: 'power' | 'wins') => {
    try {
      const res = await fetch(`/api/leaderboards?type=${type}&limit=10`);
      if (res.ok) {
        const data = await res.json() as any;
        setLeaderboard(data.leaderboard || []);
        setLeaderboardType(type);
      }
    } catch (error) {
      console.error("Error loading leaderboard:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading battle statistics...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-white flex items-center justify-center gap-3">
            <Swords className="h-10 w-10 text-yellow-400" />
            Battle Command Center
            <Swords className="h-10 w-10 text-yellow-400" />
          </h1>
          <p className="text-blue-200">Complete battle statistics and leaderboards</p>
        </div>

        {/* Player Overview Cards */}
        {playerStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Power */}
            <Card className="bg-white/10 backdrop-blur border-white/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-blue-200 flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Total Power
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-white">{playerStats.total_power.toLocaleString()}</div>
                <Progress value={Math.min((playerStats.total_power / 10000) * 100, 100)} className="mt-2" />
              </CardContent>
            </Card>

            {/* NFT Collection */}
            <Card className="bg-white/10 backdrop-blur border-white/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-blue-200 flex items-center gap-2">
                  <Trophy className="h-4 w-4" />
                  NFT Collection
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-white">{playerStats.nfts_owned}</div>
                <p className="text-xs text-blue-200 mt-1">NFTs Owned</p>
              </CardContent>
            </Card>

            {/* Win Rate */}
            <Card className="bg-white/10 backdrop-blur border-white/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-blue-200 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Win Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-white">{playerStats.battle_stats.win_rate}%</div>
                <p className="text-xs text-blue-200 mt-1">
                  {playerStats.battle_stats.battles_won}W / {playerStats.battle_stats.battles_lost}L
                </p>
              </CardContent>
            </Card>

            {/* Total Battles */}
            <Card className="bg-white/10 backdrop-blur border-white/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-blue-200 flex items-center gap-2">
                  <Swords className="h-4 w-4" />
                  Battles
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-white">{playerStats.battle_stats.total_battles}</div>
                <p className="text-xs text-blue-200 mt-1">Total Participated</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Power Breakdown */}
        {playerStats && (
          <Card className="bg-white/10 backdrop-blur border-white/20">
            <CardHeader>
              <CardTitle className="text-white">Power Breakdown</CardTitle>
              <CardDescription className="text-blue-200">
                Your power across different categories
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-blue-200">⚔️ Army Power</span>
                  <span className="text-sm font-bold text-white">{playerStats.power_breakdown.army_power}</span>
                </div>
                <Progress value={(playerStats.power_breakdown.army_power / playerStats.total_power) * 100} className="h-2" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-blue-200">🙏 Religion Power</span>
                  <span className="text-sm font-bold text-white">{playerStats.power_breakdown.religion_power}</span>
                </div>
                <Progress value={(playerStats.power_breakdown.religion_power / playerStats.total_power) * 100} className="h-2" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-blue-200">🏛️ Civilization Power</span>
                  <span className="text-sm font-bold text-white">{playerStats.power_breakdown.civilization_power}</span>
                </div>
                <Progress value={(playerStats.power_breakdown.civilization_power / playerStats.total_power) * 100} className="h-2" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-blue-200">💰 Economic Power</span>
                  <span className="text-sm font-bold text-white">{playerStats.power_breakdown.economic_power}</span>
                </div>
                <Progress value={(playerStats.power_breakdown.economic_power / playerStats.total_power) * 100} className="h-2" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Leaderboards */}
        <Card className="bg-white/10 backdrop-blur border-white/20">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-400" />
              Leaderboards
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={leaderboardType} onValueChange={(v) => loadLeaderboard(v as 'power' | 'wins')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="power">Top Power</TabsTrigger>
                <TabsTrigger value="wins">Top Wins</TabsTrigger>
              </TabsList>

              <TabsContent value="power" className="space-y-2 mt-4">
                {leaderboard.map((entry, index) => (
                  <div
                    key={entry.user_handle}
                    className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`text-2xl font-bold ${
                        index === 0 ? 'text-yellow-400' :
                        index === 1 ? 'text-gray-300' :
                        index === 2 ? 'text-orange-400' :
                        'text-blue-200'
                      }`}>
                        #{index + 1}
                      </div>
                      <div>
                        <div className="text-white font-semibold">{entry.user_handle}</div>
                        <div className="text-xs text-blue-200">{entry.total_power?.toLocaleString()} Total Power</div>
                      </div>
                    </div>
                    {index < 3 && <Trophy className="h-5 w-5 text-yellow-400" />}
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="wins" className="space-y-2 mt-4">
                {leaderboard.map((entry, index) => (
                  <div
                    key={entry.user_handle}
                    className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`text-2xl font-bold ${
                        index === 0 ? 'text-yellow-400' :
                        index === 1 ? 'text-gray-300' :
                        index === 2 ? 'text-orange-400' :
                        'text-blue-200'
                      }`}>
                        #{index + 1}
                      </div>
                      <div>
                        <div className="text-white font-semibold">{entry.user_handle}</div>
                        <div className="text-xs text-blue-200">
                          {entry.battles_won} Wins / {entry.total_battles} Battles
                        </div>
                      </div>
                    </div>
                    {index < 3 && <Trophy className="h-5 w-5 text-yellow-400" />}
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
