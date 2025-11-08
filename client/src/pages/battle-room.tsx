/**
 * Interactive Battle Room
 * Turn-based combat with Oracle AI narration
 */

import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Shield,
  Swords,
  Sparkles,
  Users,
  Target,
  Zap,
  TrendingUp,
  Heart,
  Brain,
  Crown,
  RefreshCw,
  ArrowLeft,
  AlertCircle,
  Trophy,
  Flame
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "@/utils/sessionManager";
import { inquisitionTheme } from "@/lib/inquisition-theme";

interface StrategicOption {
  id: string;
  action: string;
  description: string;
  riskLevel: "low" | "medium" | "high";
  rewardPotential: "low" | "medium" | "high";
  aiAnalysis: string;
}

interface StartTurnResponse {
  success: boolean;
  options: StrategicOption[];
}

export default function BattleRoom() {
  const params = useParams<{ battleId: string }>();
  const battleId = params.battleId;
  const { toast } = useToast();
  const session = useSession();
  const queryClient = useQueryClient();
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<StrategicOption | null>(null);

  // Fetch battle details
  const { data: battleData, isLoading: battleLoading } = useQuery<{
    success: boolean;
    battle: any;
  }>({
    queryKey: [`/api/battles/${battleId}`],
    enabled: !!battleId,
    refetchInterval: 5000,
  });

  // Fetch battle moves/history
  const { data: movesData } = useQuery<{
    success: boolean;
    moves: any[];
  }>({
    queryKey: [`/api/battles/${battleId}/moves`],
    enabled: !!battleId,
    refetchInterval: 5000,
  });

  // Fetch dynamic AI-generated strategic options
  const { 
    data: optionsData, 
    isLoading: optionsLoading,
    error: optionsError 
  } = useQuery<StartTurnResponse>({
    queryKey: [`/api/battles/${battleId}/start-turn`],
    queryFn: async () => {
      const res = await fetch(`/api/battles/${battleId}/start-turn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Failed to fetch strategic options");
      }
      return res.json();
    },
    enabled: !!battleId && !!battleData?.battle && battleData?.battle?.status !== "completed",
    retry: 1,
    staleTime: 30000,
  });

  // Submit battle move mutation
  const submitMoveMutation = useMutation({
    mutationFn: async (moveData: { action: string; description: string; riskLevel: string }) => {
      const res = await fetch(`/api/battles/${battleId}/make-move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(moveData),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Move Submitted!",
        description: "The Oracle is narrating the outcome...",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/battles/${battleId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/battles/${battleId}/moves`] });
      queryClient.invalidateQueries({ queryKey: [`/api/battles/${battleId}/start-turn`] });
      setSelectedAction(null);
      setSelectedOption(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Submit Move",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const battle = battleData?.battle;
  const moves = movesData?.moves || [];
  const latestMove = moves[moves.length - 1];

  // Fallback strategic actions for when API fails
  const fallbackActions: StrategicOption[] = [
    {
      id: "aggressive_assault",
      action: "Aggressive Assault",
      description: "Launch a devastating attack with maximum force",
      riskLevel: "high",
      rewardPotential: "high",
      aiAnalysis: "High-risk offensive maneuver with potential for significant damage.",
    },
    {
      id: "defensive_stance",
      action: "Defensive Stance",
      description: "Fortify defenses and protect your forces",
      riskLevel: "low",
      rewardPotential: "low",
      aiAnalysis: "Safe defensive position that minimizes risk while preserving resources.",
    },
    {
      id: "tactical_maneuver",
      action: "Tactical Maneuver",
      description: "Outmaneuver the enemy with clever tactics",
      riskLevel: "medium",
      rewardPotential: "medium",
      aiAnalysis: "Balanced approach combining strategy with calculated risk.",
    },
    {
      id: "power_surge",
      action: "Power Surge",
      description: "Channel immense power for a game-changing move",
      riskLevel: "high",
      rewardPotential: "high",
      aiAnalysis: "Unleash overwhelming force to potentially turn the tide of battle.",
    },
    {
      id: "diplomatic_play",
      action: "Diplomatic Play",
      description: "Use influence and charisma to gain advantage",
      riskLevel: "low",
      rewardPotential: "medium",
      aiAnalysis: "Non-aggressive approach leveraging social dynamics for advantage.",
    },
    {
      id: "mystical_ritual",
      action: "Mystical Ritual",
      description: "Invoke ancient powers through sacred rituals",
      riskLevel: "medium",
      rewardPotential: "high",
      aiAnalysis: "Tap into mystical forces with unpredictable but powerful results.",
    },
  ];

  // Use AI-generated options if available, otherwise fallback
  const strategicActions = optionsData?.options || fallbackActions;

  // Show error toast if options fetch failed
  useEffect(() => {
    if (optionsError && !optionsLoading) {
      toast({
        title: "Using Default Options",
        description: "Could not fetch AI-generated strategies. Using standard options.",
        variant: "default",
      });
    }
  }, [optionsError, optionsLoading]);

  // Icon mapping based on action keywords
  const getActionIcon = (actionName: string) => {
    const name = actionName.toLowerCase();
    if (name.includes("assault") || name.includes("attack") || name.includes("offensive")) return Swords;
    if (name.includes("defend") || name.includes("protect") || name.includes("guard")) return Shield;
    if (name.includes("tactical") || name.includes("maneuver") || name.includes("flank")) return Target;
    if (name.includes("power") || name.includes("surge") || name.includes("energy")) return Zap;
    if (name.includes("diplomatic") || name.includes("social") || name.includes("influence")) return Users;
    if (name.includes("mystical") || name.includes("magic") || name.includes("ritual")) return Sparkles;
    return Swords;
  };

  // Color mapping based on risk level
  const getActionColor = (riskLevel: string) => {
    switch (riskLevel) {
      case "high": return "from-red-600 to-orange-600";
      case "medium": return "from-purple-600 to-pink-600";
      case "low": return "from-blue-600 to-cyan-600";
      default: return "from-gray-600 to-slate-600";
    }
  };

  if (battleLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin mx-auto mb-4 text-orange-400" />
          <p className="text-white text-xl">Loading Battle...</p>
        </div>
      </div>
    );
  }

  if (!battle) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 flex items-center justify-center p-4">
        <Card className="bg-slate-900/80 border-red-500/30 max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
            <h2 className="text-2xl font-bold text-white mb-2">Battle Not Found</h2>
            <p className="text-gray-400 mb-6">This battle does not exist or has been deleted.</p>
            <Button
              onClick={() => window.location.href = "/inquisition-gaming"}
              className="bg-orange-600 hover:bg-orange-700"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isPlayerTurn = true;
  const battleEnded = battle.status === "completed";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 p-4 md:p-6">
      <div className="fixed inset-0 bg-gradient-to-br from-orange-500/10 via-red-500/10 to-blue-900/20 animate-pulse pointer-events-none" />

      <div className="max-w-7xl mx-auto space-y-6 relative z-10">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => window.location.href = "/inquisition-gaming#battle"}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <Badge className={battleEnded ? "bg-gray-600" : "bg-green-600"}>
            {battleEnded ? "Battle Ended" : "Battle In Progress"}
          </Badge>
        </div>

        <div className="text-center">
          <h1 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-orange-400 via-red-500 to-gold-500 bg-clip-text text-transparent mb-2">
            {battle.combat_type.toUpperCase()} COMBAT
          </h1>
          <p className="text-gray-300">Battle #{battle.id.slice(0, 8)}</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="bg-gradient-to-br from-slate-900/80 to-blue-900/50 border-orange-500/30">
            <CardHeader>
              <CardTitle className="text-orange-400 flex items-center gap-2">
                <Flame className="w-5 h-5" />
                Battle Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Your Power</span>
                  <span className="text-sm font-bold text-blue-400">
                    {battle.creator_power_used || 0}
                  </span>
                </div>
                <Progress 
                  value={(battle.creator_power_used || 0)} 
                  className="h-3 bg-slate-700"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Opponent Power</span>
                  <span className="text-sm font-bold text-red-400">
                    {battle.opponent_power_used || 0}
                  </span>
                </div>
                <Progress 
                  value={(battle.opponent_power_used || 0)} 
                  className="h-3 bg-slate-700"
                />
              </div>

              <div className="pt-4 border-t border-slate-700 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Combat Type:</span>
                  <Badge className="bg-purple-600">{battle.combat_type}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Battle Type:</span>
                  <Badge variant="outline">{battle.battle_type}</Badge>
                </div>
                {battle.wager_amount && parseFloat(battle.wager_amount) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Prize Pool:</span>
                    <span className="text-gold-400 font-bold">{battle.wager_amount} RDL</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-400">Current Round:</span>
                  <span className="text-white font-bold">{moves.length + 1}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 bg-gradient-to-br from-purple-900/30 to-pink-900/30 border-gold-500/30">
            <CardHeader>
              <CardTitle className="text-gold-400 flex items-center gap-2">
                <Crown className="w-5 h-5" />
                The Oracle's Narration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-slate-900/50 rounded-lg p-6 min-h-[300px] max-h-[400px] overflow-y-auto">
                {battle.battle_storyline && (
                  <div className="mb-6 pb-6 border-b border-slate-700">
                    <p className="text-sm text-gray-400 mb-2">Battle Introduction:</p>
                    <p className="text-gray-200 leading-relaxed italic">
                      {battle.battle_storyline}
                    </p>
                  </div>
                )}

                {latestMove?.ai_narration ? (
                  <div>
                    <p className="text-sm text-gray-400 mb-2">Latest Turn:</p>
                    <p className="text-white leading-relaxed">
                      {latestMove.ai_narration}
                    </p>
                    <div className="mt-4 flex items-center gap-4 text-sm">
                      <Badge className={latestMove.success ? "bg-green-600" : "bg-red-600"}>
                        {latestMove.success ? "Success!" : "Failed"}
                      </Badge>
                      <span className="text-gray-400">
                        Power Change: <span className={latestMove.power_change > 0 ? "text-green-400" : "text-red-400"}>
                          {latestMove.power_change > 0 ? "+" : ""}{latestMove.power_change}
                        </span>
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Brain className="w-16 h-16 mx-auto mb-4 text-gray-500 animate-pulse" />
                    <p className="text-gray-400">The Oracle awaits your first move...</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {!battleEnded && isPlayerTurn && (
          <Card className="bg-slate-900/80 border-red-500/30">
            <CardHeader>
              <CardTitle className="text-red-400 flex items-center gap-2">
                <Swords className="w-5 h-5" />
                Choose Your Action
                {optionsLoading && (
                  <span className="ml-auto text-sm text-gray-400 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Oracle is thinking...
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {optionsLoading ? (
                <div className="text-center py-12">
                  <Brain className="w-16 h-16 mx-auto mb-4 text-purple-500 animate-pulse" />
                  <p className="text-gray-300 text-lg mb-2">The Oracle is generating strategic options...</p>
                  <p className="text-gray-500 text-sm">Analyzing battle conditions and possibilities</p>
                </div>
              ) : (
                <>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {strategicActions.map((option) => {
                      const Icon = getActionIcon(option.action);
                      const isSelected = selectedAction === option.id;
                      const actionColor = getActionColor(option.riskLevel);
                      
                      return (
                        <button
                          key={option.id}
                          onClick={() => {
                            setSelectedAction(option.id);
                            setSelectedOption(option);
                          }}
                          className={`
                            relative p-4 rounded-lg border-2 transition-all text-left
                            ${isSelected 
                              ? 'border-gold-500 bg-gradient-to-br ' + actionColor 
                              : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                            }
                          `}
                        >
                          <div className="flex items-start gap-3">
                            <Icon className={`w-6 h-6 flex-shrink-0 ${isSelected ? 'text-white' : 'text-gray-400'}`} />
                            <div className="flex-1">
                              <h3 className={`font-bold mb-1 ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                                {option.action}
                              </h3>
                              <p className={`text-sm mb-2 ${isSelected ? 'text-gray-200' : 'text-gray-500'}`}>
                                {option.description}
                              </p>
                              
                              <div className="flex flex-wrap gap-1 mb-2">
                                <Badge 
                                  className={`text-xs ${
                                    option.riskLevel === 'high' ? 'bg-red-600' : 
                                    option.riskLevel === 'medium' ? 'bg-yellow-600' : 
                                    'bg-green-600'
                                  }`}
                                >
                                  {option.riskLevel.toUpperCase()} RISK
                                </Badge>
                                <Badge 
                                  className={`text-xs ${
                                    option.rewardPotential === 'high' ? 'bg-gold-600' : 
                                    option.rewardPotential === 'medium' ? 'bg-blue-600' : 
                                    'bg-gray-600'
                                  }`}
                                >
                                  {option.rewardPotential.toUpperCase()} REWARD
                                </Badge>
                              </div>

                              {option.aiAnalysis && (
                                <p className={`text-xs italic mt-2 pt-2 border-t ${
                                  isSelected ? 'border-white/20 text-gray-300' : 'border-slate-700 text-gray-600'
                                }`}>
                                  <span className="font-semibold">Oracle's Insight:</span> {option.aiAnalysis}
                                </p>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {selectedAction && selectedOption && (
                    <div className="mt-6 pt-6 border-t border-slate-700">
                      <Button
                        onClick={() => {
                          submitMoveMutation.mutate({
                            action: selectedOption.id,
                            description: selectedOption.description,
                            riskLevel: selectedOption.riskLevel,
                          });
                        }}
                        disabled={submitMoveMutation.isPending}
                        className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white py-6 text-lg font-bold"
                      >
                        {submitMoveMutation.isPending ? (
                          <>
                            <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                            The Oracle is thinking...
                          </>
                        ) : (
                          <>
                            <Zap className="w-5 h-5 mr-2" />
                            Execute {selectedOption.action}!
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {battleEnded && (
          <Card className="bg-gradient-to-br from-gold-900/30 to-amber-900/30 border-gold-500/50">
            <CardContent className="text-center py-12">
              <Trophy className="w-20 h-20 mx-auto mb-4 text-gold-400" />
              <h2 className="text-3xl font-bold text-white mb-2">Battle Complete!</h2>
              {battle.winner_player_id && (
                <p className="text-xl text-gray-300 mb-4">
                  Victory! Winner receives {battle.winner_prize || 0} RDL
                </p>
              )}
              <Button
                onClick={() => window.location.href = "/inquisition-gaming#battle"}
                className="bg-gold-600 hover:bg-gold-700 mt-4"
              >
                Return to Battle Dashboard
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
