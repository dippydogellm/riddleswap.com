import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Swords, Eye, Trophy, Clock, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { LiveBattleViewer } from "@/components/LiveBattleViewer";

interface Battle {
  id: string;
  battle_type: string;
  combat_type: string;
  wager_amount: string;
  is_friendly: boolean;
  creator_player_id: string;
  opponent_player_id: string | null;
  status: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export default function SpectateBattles() {
  const [activeBattles, setActiveBattles] = useState<Battle[]>([]);
  const [completedBattles, setCompletedBattles] = useState<Battle[]>([]);
  const [selectedBattle, setSelectedBattle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBattles();
    
    // Auto-refresh every 10 seconds
    const interval = setInterval(loadBattles, 10000);
    
    return () => clearInterval(interval);
  }, []);

  async function loadBattles() {
    try {
      // Load active battles
      const activeRes = await fetch('/api/battles/active');
      if (activeRes.ok) {
        const activeData = await activeRes.json();
        setActiveBattles(activeData.battles || []);
      }
      
      // Load completed battles
      const completedRes = await fetch('/api/battles/completed');
      if (completedRes.ok) {
        const completedData = await completedRes.json();
        setCompletedBattles(completedData.battles || []);
      }
      
      setLoading(false);
    } catch (error) {
      console.error("Error loading battles:", error);
      setLoading(false);
    }
  }

  const getCombatTypeColor = (type: string) => {
    switch (type) {
      case 'military': return 'border-red-600 bg-red-900';
      case 'religious': return 'border-blue-600 bg-blue-900';
      case 'social': return 'border-purple-600 bg-purple-900';
      default: return 'border-slate-600 bg-slate-900';
    }
  };

  if (selectedBattle) {
    return (
      <div className="min-h-screen bg-slate-950 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-4">
            <Button 
              onClick={() => setSelectedBattle(null)} 
              variant="outline" 
              className="bg-slate-700 border-2 border-slate-500"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Battle List
            </Button>
          </div>
          
          <LiveBattleViewer 
            battleId={selectedBattle} 
            onClose={() => setSelectedBattle(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="bg-slate-900 border-b-2 border-purple-600">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/inquisition">
                <Button variant="outline" className="bg-slate-700 border-2 border-slate-500">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                  <Eye className="w-8 h-8 text-purple-400" />
                  Spectate Battles
                </h1>
                <p className="text-gray-400 text-sm mt-1">
                  Watch epic battles unfold in real-time
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="active" className="space-y-6">
          <TabsList className="bg-slate-800 border-2 border-purple-600">
            <TabsTrigger value="active" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
              Live Battles ({activeBattles.length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
              Completed ({completedBattles.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            {loading ? (
              <Card className="bg-slate-900 border-2 border-slate-600">
                <CardContent className="p-8 text-center">
                  <div className="text-white">Loading battles...</div>
                </CardContent>
              </Card>
            ) : activeBattles.length === 0 ? (
              <Card className="bg-slate-900 border-2 border-slate-600">
                <CardContent className="p-8 text-center">
                  <Clock className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <div className="text-gray-400">No active battles right now. Check back later!</div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeBattles.map((battle) => (
                  <Card key={battle.id} className={`border-2 ${getCombatTypeColor(battle.combat_type)}`}>
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <Swords className="w-5 h-5" />
                        {battle.combat_type.charAt(0).toUpperCase() + battle.combat_type.slice(1)} Battle
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-400">Type:</span>
                          <Badge className="bg-slate-700 border-2 border-slate-500 text-white">
                            {battle.battle_type}
                          </Badge>
                        </div>
                        
                        {!battle.is_friendly && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-400">Wager:</span>
                            <span className="text-yellow-400 font-bold">{battle.wager_amount} XRP</span>
                          </div>
                        )}
                        
                        <div className="bg-slate-800 border-2 border-slate-600 p-3 rounded-lg space-y-1">
                          <div className="text-blue-400 text-sm">
                            {battle.creator_player_id}
                          </div>
                          <div className="text-gray-500 text-center text-xs">VS</div>
                          <div className="text-red-400 text-sm">
                            {battle.opponent_player_id || "Waiting..."}
                          </div>
                        </div>
                      </div>
                      
                      <Button 
                        onClick={() => setSelectedBattle(battle.id)}
                        className="w-full bg-purple-600 border-2 border-purple-400 hover:bg-purple-700"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Watch Live
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {loading ? (
              <Card className="bg-slate-900 border-2 border-slate-600">
                <CardContent className="p-8 text-center">
                  <div className="text-white">Loading battles...</div>
                </CardContent>
              </Card>
            ) : completedBattles.length === 0 ? (
              <Card className="bg-slate-900 border-2 border-slate-600">
                <CardContent className="p-8 text-center">
                  <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <div className="text-gray-400">No completed battles yet</div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {completedBattles.map((battle) => (
                  <Card key={battle.id} className="bg-slate-900 border-2 border-slate-600">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-yellow-400" />
                        {battle.combat_type.charAt(0).toUpperCase() + battle.combat_type.slice(1)} Battle
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-400">Type:</span>
                          <Badge className="bg-slate-700 border-2 border-slate-500 text-white">
                            {battle.battle_type}
                          </Badge>
                        </div>
                        
                        <div className="bg-slate-800 border-2 border-slate-600 p-3 rounded-lg space-y-1">
                          <div className="text-blue-400 text-sm">
                            {battle.creator_player_id}
                          </div>
                          <div className="text-gray-500 text-center text-xs">VS</div>
                          <div className="text-red-400 text-sm">
                            {battle.opponent_player_id || "N/A"}
                          </div>
                        </div>
                        
                        {battle.completed_at && (
                          <div className="text-xs text-gray-400 text-center">
                            Completed {new Date(battle.completed_at).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      
                      <Button 
                        onClick={() => setSelectedBattle(battle.id)}
                        className="w-full bg-slate-700 border-2 border-slate-500 hover:bg-slate-600"
                      >
                        View Replay
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
