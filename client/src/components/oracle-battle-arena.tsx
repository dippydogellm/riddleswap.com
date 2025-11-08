/**
 * Oracle Battle Arena Component
 * 
 * Turn-based battle system with The Oracle AI narration
 * Features 6 strategic options per turn and real-time AI commentary
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Swords, 
  Shield, 
  Zap, 
  Brain, 
  Eye, 
  Target,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Crown,
  Loader2
} from "lucide-react";
import { useSession } from "@/utils/sessionManager";

interface StrategicOption {
  id: string;
  action: string;
  description: string;
  riskLevel: "low" | "medium" | "high";
  rewardPotential: "low" | "medium" | "high";
  aiAnalysis: string;
}

interface BattleMove {
  round: number;
  player_id: string;
  action: string;
  result: string;
  power_change: number;
  ai_narration: string;
}

interface Battle {
  id: string;
  battle_type: string;
  combat_type: string;
  status: string;
  creator_power_used: number;
  opponent_power_used: number;
  battle_storyline: string;
  is_ai_battle: boolean;
  ai_difficulty: string;
}

interface OracleBattleArenaProps {
  battleId: string;
  onExit: () => void;
}

export function OracleBattleArena({ battleId, onExit }: OracleBattleArenaProps) {
  const session = useSession();
  const [battle, setBattle] = useState<Battle | null>(null);
  const [moves, setMoves] = useState<BattleMove[]>([]);
  const [options, setOptions] = useState<StrategicOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<StrategicOption | null>(null);
  const [currentRound, setCurrentRound] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isExecutingMove, setIsExecutingMove] = useState(false);
  const [lastNarration, setLastNarration] = useState("");

  // Load battle data
  useEffect(() => {
    loadBattle();
  }, [battleId]);

  const loadBattle = async () => {
    try {
      setIsLoading(true);
      const sessionToken = localStorage.getItem("sessionToken");
      
      const response = await fetch(`/api/battles/${battleId}`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load battle");
      }

      const data = await response.json() as any;
      setBattle(data.battle);
      setMoves(data.moves);
      
      // Load strategic options for current turn
      await loadStrategicOptions();
    } catch (error) {
      console.error("❌ Failed to load battle:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStrategicOptions = async () => {
    try {
      const sessionToken = localStorage.getItem("sessionToken");
      
      const response = await fetch(`/api/battles/${battleId}/start-turn`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load options");
      }

      const data = await response.json() as any;
      setOptions(data.options);
      setCurrentRound(data.round);
    } catch (error) {
      console.error("❌ Failed to load strategic options:", error);
    }
  };

  const executeMove = async () => {
    if (!selectedOption) return;

    try {
      setIsExecutingMove(true);
      const sessionToken = localStorage.getItem("sessionToken");
      
      const response = await fetch(`/api/battles/${battleId}/make-move`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          optionId: selectedOption.id,
          action: selectedOption.action,
          description: selectedOption.description,
          riskLevel: selectedOption.riskLevel,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to execute move");
      }

      const data = await response.json() as any;
      
      // Update battle state
      setBattle(data.battle);
      setLastNarration(data.narration);
      setMoves([data.move, ...moves]);
      setSelectedOption(null);

      // Check if battle ended
      if (data.battleEnded) {
        setTimeout(() => {
          onExit();
        }, 5000);
      } else {
        // Load next turn options
        await loadStrategicOptions();
      }
    } catch (error) {
      console.error("❌ Failed to execute move:", error);
    } finally {
      setIsExecutingMove(false);
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "low": return "text-green-400 bg-green-900/30 border-green-600";
      case "medium": return "text-yellow-400 bg-yellow-900/30 border-yellow-600";
      case "high": return "text-red-400 bg-red-900/30 border-red-600";
      default: return "text-gray-400 bg-gray-900/30 border-gray-600";
    }
  };

  const getRewardColor = (reward: string) => {
    switch (reward) {
      case "low": return "text-blue-400";
      case "medium": return "text-purple-400";
      case "high": return "text-gold-400";
      default: return "text-gray-400";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-purple-400 mx-auto" />
          <p className="text-gray-400">Loading battle arena...</p>
        </div>
      </div>
    );
  }

  if (!battle) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <Card className="bg-slate-900 border-2 border-red-600 max-w-md">
          <CardContent className="text-center py-12 space-y-4">
            <Swords className="w-16 h-16 text-red-600 mx-auto" />
            <h2 className="text-2xl font-bold text-white">Battle Not Found</h2>
            <Button onClick={onExit} variant="outline">
              Return to Battles
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const playerPower = battle.creator_power_used || 0;
  const opponentPower = battle.opponent_power_used || 0;
  const totalPower = Math.max(playerPower + opponentPower, 1);
  const playerPercentage = (playerPower / totalPower) * 100;
  const opponentPercentage = (opponentPower / totalPower) * 100;

  return (
    <div className="min-h-screen bg-slate-950 pb-8">
      {/* Header */}
      <div className="bg-slate-900 border-b-2 border-purple-600">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                <Sparkles className="w-8 h-8 text-purple-400" />
                The Oracle Battle Arena
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                Round {currentRound} • {battle.combat_type} Combat
              </p>
            </div>
            <Button onClick={onExit} variant="outline" className="bg-slate-700 border-2 border-slate-500">
              Exit Battle
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Battle Status & Narration */}
          <div className="lg:col-span-1 space-y-6">
            {/* Power Status */}
            <Card className="bg-slate-900 border-2 border-purple-600">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Target className="w-5 h-5 text-purple-400" />
                  Battle Power
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-blue-400">You</span>
                    <span className="text-white font-bold">{playerPower}</span>
                  </div>
                  <Progress value={playerPercentage} className="h-3 bg-slate-700" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-red-400">Opponent</span>
                    <span className="text-white font-bold">{opponentPower}</span>
                  </div>
                  <Progress value={opponentPercentage} className="h-3 bg-slate-700" />
                </div>
              </CardContent>
            </Card>

            {/* Oracle Narration */}
            <Card className="bg-purple-900/30 border-2 border-purple-600">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-gold-400" />
                  The Oracle Speaks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48 pr-4">
                  {battle.battle_storyline && (
                    <div className="mb-4 p-3 bg-slate-900/50 rounded-lg border border-purple-500">
                      <p className="text-gray-200 text-sm italic">
                        {battle.battle_storyline}
                      </p>
                    </div>
                  )}
                  {lastNarration && (
                    <div className="p-3 bg-purple-900/50 rounded-lg border border-purple-400">
                      <p className="text-purple-100 text-sm font-medium">
                        {lastNarration}
                      </p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Move History */}
            <Card className="bg-slate-900 border-2 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Eye className="w-5 h-5 text-slate-400" />
                  Move History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64 pr-4">
                  <div className="space-y-2">
                    {moves.map((move, idx) => (
                      <div key={idx} className="p-2 bg-slate-800 rounded-lg border border-slate-700">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-gray-400">Round {move.round}</span>
                          <Badge 
                            variant="outline" 
                            className={move.result === "success" ? "text-green-400 border-green-600" : "text-red-400 border-red-600"}
                          >
                            {move.result}
                          </Badge>
                        </div>
                        <p className="text-sm text-white">{move.action}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Power: {move.power_change > 0 ? "+" : ""}{move.power_change}
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Strategic Options */}
          <div className="lg:col-span-2">
            <Card className="bg-slate-900 border-2 border-purple-600">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Brain className="w-6 h-6 text-purple-400" />
                  Strategic Options - Choose Your Move
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Select a strategic action. Each option has different risk and reward levels.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  {options.map((option) => (
                    <Card
                      key={option.id}
                      className={`cursor-pointer transition-all ${
                        selectedOption?.id === option.id
                          ? "bg-purple-900/50 border-2 border-purple-400 shadow-lg shadow-purple-500/50"
                          : "bg-slate-800 border-2 border-slate-700 hover:border-purple-600 hover:shadow-md"
                      }`}
                      onClick={() => setSelectedOption(option)}
                    >
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg text-white flex items-center justify-between">
                          <span>{option.action}</span>
                          {selectedOption?.id === option.id && (
                            <Crown className="w-5 h-5 text-gold-400" />
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm text-gray-300">{option.description}</p>
                        
                        <div className="flex gap-2">
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${getRiskColor(option.riskLevel)}`}
                          >
                            Risk: {option.riskLevel}
                          </Badge>
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${getRewardColor(option.rewardPotential)}`}
                          >
                            Reward: {option.rewardPotential}
                          </Badge>
                        </div>

                        <div className="p-2 bg-slate-900 rounded-md border border-slate-700">
                          <p className="text-xs text-gray-400 italic">
                            <Sparkles className="w-3 h-3 inline mr-1" />
                            {option.aiAnalysis}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Separator className="my-6" />

                {/* Execute Move Button */}
                <div className="flex justify-center">
                  <Button
                    onClick={executeMove}
                    disabled={!selectedOption || isExecutingMove}
                    className="px-12 py-6 text-lg bg-purple-600 hover:bg-purple-700 border-2 border-purple-400"
                  >
                    {isExecutingMove ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Executing Move...
                      </>
                    ) : (
                      <>
                        <Zap className="w-5 h-5 mr-2" />
                        Execute {selectedOption?.action || "Move"}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OracleBattleArena;
