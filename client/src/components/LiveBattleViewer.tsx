import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Swords, Users, Trophy, Shield, Clock, Eye } from "lucide-react";

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
  battle_storyline: string | null;
  creator_power_used: number;
  opponent_power_used: number;
}

interface Squadron {
  id: string;
  name: string;
  total_power: number;
  total_army_power: number;
  total_religion_power: number;
  total_civilization_power: number;
  total_economic_power: number;
}

interface BattleMove {
  id: string;
  round_number: number;
  player_id: string;
  move_type: string;
  strategic_choice: string;
  risk_level: string;
  success: boolean;
  power_change: number;
  result_description: string | null;
  ai_narration: string | null;
  ai_image_url: string | null;
  made_at: string;
}

interface LiveBattleViewerProps {
  battleId: string;
  onClose?: () => void;
}

export function LiveBattleViewer({ battleId, onClose }: LiveBattleViewerProps) {
  const [battle, setBattle] = useState<Battle | null>(null);
  const [creatorSquadron, setCreatorSquadron] = useState<Squadron | null>(null);
  const [opponentSquadron, setOpponentSquadron] = useState<Squadron | null>(null);
  const [moves, setMoves] = useState<BattleMove[]>([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const icons = {
    army: '⚔️',
    religion: '⛪',
    civilization: '🏰',
    economic: '💰'
  };

  useEffect(() => {
    loadBattleDetails();
    
    // Poll for updates every 5 seconds
    const interval = setInterval(loadBattleDetails, 5000);
    
    return () => clearInterval(interval);
  }, [battleId]);

  async function loadBattleDetails() {
    try {
      const res = await fetch(`/api/battles/${battleId}/view`);
      
      if (!res.ok) {
        throw new Error("Failed to load battle details");
      }
      
      const data = await res.json() as any;
      
      setBattle(data.battle || null);
      setCreatorSquadron(data.creatorSquadron || null);
      setOpponentSquadron(data.opponentSquadron || null);
      setMoves(data.moves || []);
      setCurrentRound(data.currentRound || 0);
      setSpectatorCount(data.spectatorCount || 0);
      setLoading(false);
      setError(null);
    } catch (err) {
      console.error("Error loading battle:", err);
      setError("Failed to load battle details");
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <Card className="bg-slate-900 border-2 border-purple-600">
        <CardContent className="p-12 text-center">
          <div className="text-white text-xl">Loading battle...</div>
        </CardContent>
      </Card>
    );
  }

  if (error || !battle) {
    return (
      <Card className="bg-slate-900 border-2 border-red-600">
        <CardContent className="p-12 text-center">
          <div className="text-red-400 text-xl">{error || "Battle not found"}</div>
          {onClose && (
            <Button onClick={onClose} className="mt-4 bg-slate-700 border-2 border-slate-500">
              Close
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const getCombatTypeColor = (type: string) => {
    switch (type) {
      case 'military': return 'border-red-600 bg-red-900';
      case 'religious': return 'border-blue-600 bg-blue-900';
      case 'social': return 'border-purple-600 bg-purple-900';
      default: return 'border-slate-600 bg-slate-900';
    }
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'high': return 'border-red-600 text-red-400';
      case 'medium': return 'border-yellow-600 text-yellow-400';
      case 'low': return 'border-green-600 text-green-400';
      default: return 'border-slate-600 text-slate-400';
    }
  };

  return (
    <div className="space-y-4">
      {/* Battle Header */}
      <Card className={`border-2 ${getCombatTypeColor(battle.combat_type)}`}>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <Swords className="w-6 h-6" />
                {battle.combat_type.charAt(0).toUpperCase() + battle.combat_type.slice(1)} Battle
              </CardTitle>
              <div className="flex gap-2 mt-2">
                <Badge className="bg-slate-700 border-2 border-slate-500 text-white">
                  {battle.battle_type}
                </Badge>
                <Badge className="bg-slate-700 border-2 border-slate-500 text-white">
                  Round {currentRound}
                </Badge>
                <Badge className="bg-slate-700 border-2 border-slate-500 text-white flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  {spectatorCount || 0} watching
                </Badge>
              </div>
            </div>
            
            {onClose && (
              <Button onClick={onClose} variant="outline" className="bg-slate-700 border-2 border-slate-500">
                Close
              </Button>
            )}
          </div>
        </CardHeader>
        
        <CardContent>
          {battle.battle_storyline && (
            <div className="bg-slate-800 border-2 border-slate-600 p-4 rounded-lg mb-4">
              <p className="text-white italic">{battle.battle_storyline}</p>
            </div>
          )}
          
          {!battle.is_friendly && (
            <div className="flex items-center gap-2 text-yellow-400">
              <Trophy className="w-5 h-5" />
              <span className="font-bold">{battle.wager_amount} XRP Wager</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Combatants */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Creator */}
        <Card className="bg-blue-900 border-2 border-blue-600">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Shield className="w-5 h-5" />
              {battle.creator_player_id}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {creatorSquadron ? (
              <div className="space-y-2">
                <div className="text-lg font-bold text-white">{creatorSquadron.name}</div>
                <div className="grid grid-cols-4 gap-2">
                  <div className="text-center">
                    <div className="text-sm text-gray-300">{icons.army}</div>
                    <div className="font-bold text-red-400">{creatorSquadron.total_army_power}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-300">{icons.religion}</div>
                    <div className="font-bold text-blue-400">{creatorSquadron.total_religion_power}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-300">{icons.civilization}</div>
                    <div className="font-bold text-purple-400">{creatorSquadron.total_civilization_power}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-300">{icons.economic}</div>
                    <div className="font-bold text-yellow-400">{creatorSquadron.total_economic_power}</div>
                  </div>
                </div>
                <div className="text-center mt-2">
                  <div className="text-2xl font-bold text-green-400">{creatorSquadron.total_power}</div>
                  <div className="text-sm text-gray-300">Total Power</div>
                </div>
              </div>
            ) : (
              <div className="text-gray-400">Squadron details unavailable</div>
            )}
          </CardContent>
        </Card>

        {/* Opponent */}
        <Card className="bg-red-900 border-2 border-red-600">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Shield className="w-5 h-5" />
              {battle.opponent_player_id || "Waiting for opponent..."}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {opponentSquadron ? (
              <div className="space-y-2">
                <div className="text-lg font-bold text-white">{opponentSquadron.name}</div>
                <div className="grid grid-cols-4 gap-2">
                  <div className="text-center">
                    <div className="text-sm text-gray-300">{icons.army}</div>
                    <div className="font-bold text-red-400">{opponentSquadron.total_army_power}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-300">{icons.religion}</div>
                    <div className="font-bold text-blue-400">{opponentSquadron.total_religion_power}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-300">{icons.civilization}</div>
                    <div className="font-bold text-purple-400">{opponentSquadron.total_civilization_power}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-300">{icons.economic}</div>
                    <div className="font-bold text-yellow-400">{opponentSquadron.total_economic_power}</div>
                  </div>
                </div>
                <div className="text-center mt-2">
                  <div className="text-2xl font-bold text-green-400">{opponentSquadron.total_power}</div>
                  <div className="text-sm text-gray-300">Total Power</div>
                </div>
              </div>
            ) : (
              <div className="text-gray-400">Squadron details unavailable</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Battle Moves */}
      <Card className="bg-slate-900 border-2 border-slate-600">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Battle Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          {moves.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              Battle hasn't started yet. Waiting for first move...
            </div>
          ) : (
            <div className="space-y-4">
              {moves.map((move) => (
                <div key={move.id} className="bg-slate-800 border-2 border-slate-600 p-4 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-white font-bold">Round {move.round_number}</span>
                      <span className="text-gray-400 ml-2">- {move.player_id}</span>
                    </div>
                    <div className="flex gap-2">
                      <Badge className={`border-2 ${getRiskLevelColor(move.risk_level)}`}>
                        {move.risk_level} risk
                      </Badge>
                      <Badge className={move.success ? "bg-green-700 border-2 border-green-500 text-white" : "bg-red-700 border-2 border-red-500 text-white"}>
                        {move.success ? "Success" : "Failed"}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="text-white mb-2">
                    <strong>Action:</strong> {move.strategic_choice}
                  </div>
                  
                  {move.result_description && (
                    <div className="text-gray-300 mb-2">
                      {move.result_description}
                    </div>
                  )}
                  
                  {move.ai_narration && (
                    <div className="bg-purple-900 border-2 border-purple-600 p-3 rounded-lg mb-2">
                      <div className="text-purple-300 italic">{move.ai_narration}</div>
                    </div>
                  )}
                  
                  {move.ai_image_url && (
                    <div className="mt-2">
                      <img 
                        src={move.ai_image_url} 
                        alt="Battle scene" 
                        className="rounded-lg w-full max-w-md border-2 border-slate-600"
                      />
                    </div>
                  )}
                  
                  <div className={`text-sm font-bold ${move.power_change > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    Power Change: {move.power_change > 0 ? '+' : ''}{move.power_change}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
