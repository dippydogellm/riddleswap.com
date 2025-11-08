import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Sword, Mountain, Trees, Droplets, Flame, Snowflake, Waves, Sun, Zap, Users, Trophy, Bot } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

interface Squadron {
  id: string;
  name: string;
  squadron_type: string;
  total_power: number;
  total_army_power: number;
  total_religion_power: number;
  total_civilization_power: number;
  total_economic_power: number;
  nft_count: number;
  in_battle: boolean;
}

interface BattleCreateDialogProps {
  squadrons: Squadron[];
  onBattleCreated: () => void;
  userWalletAddress?: string;
  battleType?: '1v1' | 'ai' | 'group';
}

const landTypes = [
  { 
    value: "plains", 
    label: "Plains", 
    icon: Sun, 
    description: "Open grasslands with balanced terrain",
    strategy: "Cavalry and ranged units excel. No terrain penalties. Best for balanced armies.",
    bonus: "±0% to all stats",
    color: "text-yellow-600",
    bgColor: "bg-yellow-50"
  },
  { 
    value: "mountains", 
    label: "Mountains", 
    icon: Mountain, 
    description: "High altitude terrain with defensive advantage",
    strategy: "Defenders gain +15% power. Slower movement. Ambush points available.",
    bonus: "+15% Defense, -10% Movement",
    color: "text-gray-600",
    bgColor: "bg-gray-50"
  },
  { 
    value: "forest", 
    label: "Forest", 
    icon: Trees, 
    description: "Dense woods perfect for ambush tactics",
    strategy: "Stealth units +20% effectiveness. Ranged units -10%. Perfect for guerrilla warfare.",
    bonus: "+20% Stealth, -10% Ranged",
    color: "text-green-600",
    bgColor: "bg-green-50"
  },
  { 
    value: "desert", 
    label: "Desert", 
    icon: Sun, 
    description: "Arid wasteland testing endurance",
    strategy: "Stamina drain over time. Light units +15%. Water supplies critical.",
    bonus: "+15% Light Units, -5% Stamina/Turn",
    color: "text-orange-600",
    bgColor: "bg-orange-50"
  },
  { 
    value: "swamp", 
    label: "Swamp", 
    icon: Droplets, 
    description: "Muddy terrain that slows all movement",
    strategy: "All units -20% movement. Disease risk. Heavy units struggle. Poison available.",
    bonus: "-20% Movement for all",
    color: "text-emerald-700",
    bgColor: "bg-emerald-50"
  },
  { 
    value: "coastal", 
    label: "Coastal", 
    icon: Waves, 
    description: "Shoreline battles with naval options",
    strategy: "Naval units can be deployed. High ground on cliffs. Amphibious assault tactics.",
    bonus: "+30% Naval Units if available",
    color: "text-blue-600",
    bgColor: "bg-blue-50"
  },
  { 
    value: "volcanic", 
    label: "Volcanic", 
    icon: Flame, 
    description: "Extreme heat and lava hazards",
    strategy: "Fire resistance critical. Random lava flows. +25% fire attacks. Heat exhaustion.",
    bonus: "+25% Fire Damage, Heat Hazards",
    color: "text-red-600",
    bgColor: "bg-red-50"
  },
  { 
    value: "tundra", 
    label: "Tundra", 
    icon: Snowflake, 
    description: "Frozen wasteland requiring cold resistance",
    strategy: "Cold damage over time. Ice units +30%. Frostbite mechanics. Blizzards possible.",
    bonus: "+30% Ice Units, Cold Hazards",
    color: "text-cyan-600",
    bgColor: "bg-cyan-50"
  }
];

const battleTypes = [
  { 
    value: "1vAI", 
    label: "🤖 1 vs AI", 
    icon: Bot,
    description: "Battle against The Oracle's AI opponent",
    minNFTs: 1,
    maxNFTs: 1000,
    details: "Perfect for practice and testing strategies. AI adapts to your play style."
  },
  { 
    value: "1v1", 
    label: "⚔️ 1 vs 1 Duel", 
    icon: Zap,
    description: "Single squadron combat against another player",
    minNFTs: 10,
    maxNFTs: 1000,
    details: "Classic head-to-head battle. Winner takes all. Honor and glory on the line."
  },
  { 
    value: "group", 
    label: "👥 Mass War", 
    icon: Users,
    description: "Large-scale alliance vs alliance warfare",
    minNFTs: 10,
    maxNFTs: 1000,
    details: "Epic battles between alliances. Multiple squadrons. Team coordination critical."
  },
  { 
    value: "tournament", 
    label: "🏆 Tournament", 
    icon: Trophy,
    description: "Organized bracket competition with prizes",
    minNFTs: 10,
    maxNFTs: 1000,
    details: "Elimination brackets. Automatic prize distribution. Leaderboard rewards."
  }
];

const combatTypes = [
  { 
    value: "military", 
    label: "⚔️ Military", 
    description: "Army power is the decisive factor",
    details: "Raw military strength determines victory. Tactics and formations matter most."
  },
  { 
    value: "religious", 
    label: "⛪ Religious", 
    description: "Faith and religion power decisive",
    details: "Divine favor and religious power. Miracles and blessings can turn the tide."
  },
  { 
    value: "social", 
    label: "🏰 Social", 
    description: "Civilization power decisive",
    details: "Culture, diplomacy, and social influence. Win hearts and minds."
  }
];

const timeoutOptions = [
  { value: 15, label: "15 minutes - Quick Response" },
  { value: 30, label: "30 minutes - Standard" },
  { value: 60, label: "1 hour - Flexible" },
  { value: 120, label: "2 hours - Extended" },
  { value: 240, label: "4 hours - Very Extended" },
  { value: 1440, label: "24 hours - Maximum" }
];

export default function BattleCreateDialog({ squadrons, onBattleCreated, userWalletAddress, battleType: initialBattleType = '1v1' }: BattleCreateDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Determine initial battle type based on prop
  const getInitialBattleType = () => {
    if (initialBattleType === 'ai') return '1vAI';
    if (initialBattleType === 'group') return 'group';
    return '1v1';
  };

  // Form state
  const [selectedSquadron, setSelectedSquadron] = useState<string>("");
  const [battleType, setBattleType] = useState<string>(getInitialBattleType());
  const [combatType, setCombatType] = useState<string>("military");
  const [landType, setLandType] = useState<string>("plains");
  const [responseTimeout, setResponseTimeout] = useState<number>(60);
  const [wagerAmount, setWagerAmount] = useState<string>("0");
  const [wagerEnabled, setWagerEnabled] = useState<boolean>(false);
  const [isFriendly, setIsFriendly] = useState<boolean>(true);
  const [aiDifficulty, setAiDifficulty] = useState<string>("medium");
  const [customPrompt, setCustomPrompt] = useState<string>("");
  const [battleReason, setBattleReason] = useState<string>("");
  const [additionalInfo, setAdditionalInfo] = useState<string>("");
  const [maxNftsLimit, setMaxNftsLimit] = useState<number>(1000);
  const [requiredSpecialization, setRequiredSpecialization] = useState<string>("");
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number>(0);

  const availableSquadrons = squadrons.filter(s => !s.in_battle);
  const selectedSquadronData = squadrons.find(s => s.id === selectedSquadron);
  const selectedBattleType = battleTypes.find(bt => bt.value === battleType);
  const selectedLand = landTypes.find(l => l.value === landType);
  const selectedCombat = combatTypes.find(ct => ct.value === combatType);
  const LandIcon = selectedLand?.icon || Sun;
  const BattleIcon = selectedBattleType?.icon || Sword;

  // Validate NFT count against battle type requirements
  const nftCountValid = selectedSquadronData 
    ? selectedSquadronData.nft_count >= (selectedBattleType?.minNFTs || 0) &&
      selectedSquadronData.nft_count <= (selectedBattleType?.maxNFTs || 1000)
    : true;

  async function handleCreateBattle() {
    if (!selectedSquadron) {
      toast({
        title: "Squadron Required",
        description: "Please select a squadron to battle with",
        variant: "destructive"
      });
      return;
    }

    if (!nftCountValid) {
      toast({
        title: "Invalid Squadron Size",
        description: `This battle type requires ${selectedBattleType?.minNFTs}-${selectedBattleType?.maxNFTs} NFTs. Your squadron has ${selectedSquadronData?.nft_count} NFTs.`,
        variant: "destructive"
      });
      return;
    }

    if (wagerEnabled && (!wagerAmount || parseFloat(wagerAmount) <= 0)) {
      toast({
        title: "Invalid Wager",
        description: "Please enter a wager amount or disable wagering",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);

      const token = sessionStorage.getItem('sessionToken');
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const isAiBattle = battleType === "1vAI";

      const response = await fetch('/api/battles/create', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          creator_squadron_id: selectedSquadron,
          battle_type: battleType,
          combat_type: combatType,
          land_type: landType,
          response_timeout_minutes: responseTimeout,
          wager_enabled: wagerEnabled,
          wager_amount: wagerEnabled ? wagerAmount : "0",
          wager_currency: wagerEnabled ? "XRP" : null,
          is_friendly: isFriendly,
          is_ai_battle: isAiBattle,
          ai_difficulty: isAiBattle ? aiDifficulty : null,
          creator_wallet_address: userWalletAddress || null,
          custom_prompt: customPrompt || null,
          battle_reason: battleReason || null,
          additional_info: additionalInfo || null,
          max_nfts_limit: maxNftsLimit,
          required_specialization: requiredSpecialization || null,
          time_limit_minutes: timeLimitMinutes > 0 ? timeLimitMinutes : null
        })
      });

      if (!response.ok) {
        const error = await response.json() as any;
        throw new Error(error.error || 'Failed to create battle');
      }

      const data = await response.json() as any;

      toast({
        title: "⚔️ Battle Created!",
        description: `Battle ID: ${data.battle.id.substring(0, 8)}... Your squadron is now ready for combat!`
      });

      setOpen(false);
      onBattleCreated();
      
      // Reset form
      setSelectedSquadron("");
      setWagerAmount("0");
      setWagerEnabled(false);
      setIsFriendly(true);
      setCustomPrompt("");
      setBattleReason("");
      setAdditionalInfo("");
    } catch (error: any) {
      console.error('Error creating battle:', error);
      toast({
        title: "Battle Creation Failed",
        description: error.message || "Failed to create battle",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 border-2 border-orange-400">
          <Sword className="mr-2 h-5 w-5" />
          Create Battle
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[95vw] sm:w-[90%] sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-orange-600">⚔️ Create New Battle</DialogTitle>
          <p className="text-sm text-gray-600">Configure your battle parameters and issue a challenge</p>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Battle Type Selection */}
          <div className="space-y-3">
            <Label className="text-lg font-semibold flex items-center gap-2">
              <Sword className="h-5 w-5" />
              Battle Type
            </Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {battleTypes.map(type => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.value}
                    onClick={() => setBattleType(type.value)}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      battleType === type.value
                        ? 'border-orange-600 bg-orange-50 shadow-lg'
                        : 'border-gray-200 hover:border-orange-300'
                    }`}
                  >
                    <Icon className={`h-6 w-6 mx-auto mb-2 ${battleType === type.value ? 'text-orange-600' : 'text-gray-600'}`} />
                    <p className="font-semibold text-xs text-center">{type.label}</p>
                    <p className="text-xs text-gray-600 text-center mt-1">{type.description}</p>
                  </button>
                );
              })}
            </div>
            {selectedBattleType && (
              <Card className="p-4 bg-gradient-to-r from-orange-50 to-red-50 border-orange-200">
                <div className="flex items-start gap-3">
                  <BattleIcon className="h-8 w-8 text-orange-600 flex-shrink-0 mt-1" />
                  <div>
                    <p className="font-semibold text-orange-900">{selectedBattleType.label}</p>
                    <p className="text-sm text-gray-700 mt-1">{selectedBattleType.details}</p>
                    <Badge variant="outline" className="mt-2">
                      NFT Requirement: {selectedBattleType.minNFTs}-{selectedBattleType.maxNFTs} NFTs
                    </Badge>
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* Squadron Selection */}
          <div className="space-y-2">
            <Label className="text-lg font-semibold">Select Your Squadron</Label>
            <Select value={selectedSquadron} onValueChange={setSelectedSquadron}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a squadron..." />
              </SelectTrigger>
              <SelectContent>
                {availableSquadrons.length === 0 ? (
                  <div className="p-4 text-sm text-gray-500">No available squadrons</div>
                ) : (
                  availableSquadrons.map(squadron => (
                    <SelectItem key={squadron.id} value={squadron.id}>
                      <div className="flex items-center justify-between w-full">
                        <span className="font-medium">{squadron.name}</span>
                        <div className="flex items-center gap-2 ml-4">
                          <Badge variant="outline">{squadron.nft_count} NFTs</Badge>
                          <Badge className="bg-blue-600">{squadron.total_power} ⚡</Badge>
                        </div>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {selectedSquadronData && (
              <Card className={`p-4 ${nftCountValid ? 'bg-gradient-to-r from-blue-50 to-purple-50' : 'bg-red-50 border-red-300'}`}>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-lg">{selectedSquadronData.name}</p>
                      <p className="text-sm text-gray-600">{selectedSquadronData.nft_count} NFTs | Type: {selectedSquadronData.squadron_type}</p>
                      {!nftCountValid && (
                        <p className="text-xs text-red-600 font-semibold mt-1">
                          ⚠️ This squadron doesn't meet the NFT requirements for this battle type
                        </p>
                      )}
                    </div>
                    <Badge className="bg-blue-600 text-lg px-4 py-2">⚡ {selectedSquadronData.total_power}</Badge>
                  </div>
                  
                  {/* Power Breakdown */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-300">
                    <div className="bg-white/50 p-2 rounded">
                      <p className="text-xs text-gray-600">⚔️ Army</p>
                      <p className="font-bold text-red-600">{selectedSquadronData.total_army_power || 0}</p>
                    </div>
                    <div className="bg-white/50 p-2 rounded">
                      <p className="text-xs text-gray-600">⛪ Religion</p>
                      <p className="font-bold text-purple-600">{selectedSquadronData.total_religion_power || 0}</p>
                    </div>
                    <div className="bg-white/50 p-2 rounded">
                      <p className="text-xs text-gray-600">🏰 Civilization</p>
                      <p className="font-bold text-blue-600">{selectedSquadronData.total_civilization_power || 0}</p>
                    </div>
                    <div className="bg-white/50 p-2 rounded">
                      <p className="text-xs text-gray-600">💰 Economic</p>
                      <p className="font-bold text-green-600">{selectedSquadronData.total_economic_power || 0}</p>
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* Battle Reason */}
          <div className="space-y-2">
            <Label className="text-lg font-semibold">📜 Reason for Battle</Label>
            <Input
              value={battleReason}
              onChange={(e) => setBattleReason(e.target.value)}
              placeholder="e.g., Territory dispute, Honor duel, Resource conflict..."
              maxLength={200}
            />
            <p className="text-xs text-gray-600">
              Explain why you're initiating this battle (shown to opponents)
            </p>
          </div>

          {/* Battlefield Terrain with Full Info and Map Preview */}
          <div className="space-y-3">
            <Label className="text-lg font-semibold flex items-center gap-2">
              <Mountain className="h-5 w-5" />
              Battlefield Terrain
            </Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {landTypes.map(land => {
                const Icon = land.icon;
                return (
                  <button
                    key={land.value}
                    onClick={() => setLandType(land.value)}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      landType === land.value
                        ? 'border-orange-600 bg-orange-50 shadow-md'
                        : 'border-gray-200 hover:border-orange-300'
                    }`}
                  >
                    <Icon className={`h-6 w-6 mx-auto ${land.color}`} />
                    <p className="text-xs font-semibold mt-1">{land.label}</p>
                  </button>
                );
              })}
            </div>
            {selectedLand && (
              <Card className={`p-4 ${selectedLand.bgColor} border-2`}>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <LandIcon className={`h-6 w-6 ${selectedLand.color}`} />
                    <h4 className="font-bold text-lg">{selectedLand.label}</h4>
                  </div>
                  
                  {/* Battle Map Visualization Placeholder */}
                  <div className="relative w-full h-32 bg-gradient-to-b from-gray-800 to-gray-900 rounded-lg border-2 border-gray-700 overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <LandIcon className={`h-12 w-12 mx-auto ${selectedLand.color} opacity-50`} />
                        <p className="text-xs text-gray-400 mt-2">Battle Map: {selectedLand.label}</p>
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-700">{selectedLand.description}</p>
                  <div className="bg-white/50 p-3 rounded-lg space-y-1">
                    <p className="text-xs font-semibold text-gray-900">🎯 Strategy:</p>
                    <p className="text-xs text-gray-700">{selectedLand.strategy}</p>
                    <p className="text-xs font-semibold text-orange-600 mt-2">⚡ Combat Bonus:</p>
                    <p className="text-xs text-orange-700">{selectedLand.bonus}</p>
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* Combat Type */}
          <div className="space-y-2">
            <Label className="text-lg font-semibold">Combat Style</Label>
            <div className="grid grid-cols-3 gap-3">
              {combatTypes.map(type => (
                <button
                  key={type.value}
                  onClick={() => setCombatType(type.value)}
                  className={`p-4 rounded-lg border-2 text-center transition-all ${
                    combatType === type.value
                      ? 'border-orange-600 bg-orange-50 shadow-md'
                      : 'border-gray-200 hover:border-orange-300'
                  }`}
                >
                  <p className="font-semibold text-sm">{type.label}</p>
                  <p className="text-xs text-gray-600 mt-1">{type.description}</p>
                </button>
              ))}
            </div>
            {selectedCombat && (
              <p className="text-sm text-gray-700 bg-blue-50 p-3 rounded-lg border border-blue-200">
                💡 <span className="font-semibold">{selectedCombat.label}:</span> {selectedCombat.details}
              </p>
            )}
          </div>

          {/* AI Difficulty (only for 1vAI) */}
          {battleType === "1vAI" && (
            <div className="space-y-2">
              <Label className="text-lg font-semibold">🤖 AI Difficulty Level</Label>
              <Select value={aiDifficulty} onValueChange={setAiDifficulty}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">🟢 Easy - Learning Mode (AI: 70% power)</SelectItem>
                  <SelectItem value="medium">🟡 Medium - Balanced Challenge (AI: 100% power)</SelectItem>
                  <SelectItem value="hard">🔴 Hard - Tough Opponent (AI: 130% power)</SelectItem>
                  <SelectItem value="expert">💀 Expert - Nearly Unbeatable (AI: 160% power)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Custom Battle Prompt */}
          <div className="space-y-2">
            <Label className="text-lg font-semibold">🔮 Battle Scenario Prompt (Optional)</Label>
            <Textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Describe your battle scenario... The Oracle will use this to create an epic storyline! (e.g., 'A desperate last stand against overwhelming forces in a volcanic wasteland')"
              className="min-h-[80px]"
              maxLength={500}
            />
            <p className="text-xs text-gray-600">
              ✨ The Oracle AI will use your prompt to generate an immersive battle narrative
            </p>
          </div>

          {/* Additional Information */}
          <div className="space-y-2">
            <Label className="text-lg font-semibold">📋 Additional Information (Optional)</Label>
            <Textarea
              value={additionalInfo}
              onChange={(e) => setAdditionalInfo(e.target.value)}
              placeholder="Any additional rules, notes, or context for this battle..."
              className="min-h-[60px]"
              maxLength={300}
            />
          </div>

          {/* Max NFTs Limit */}
          <div className="space-y-2">
            <Label className="text-lg font-semibold">🎯 Maximum NFTs Per Squadron</Label>
            <Input
              type="number"
              min={selectedBattleType?.minNFTs || 1}
              max={selectedBattleType?.maxNFTs || 1000}
              value={maxNftsLimit}
              onChange={(e) => setMaxNftsLimit(parseInt(e.target.value) || 1000)}
            />
            <p className="text-xs text-gray-600">
              Limit NFTs to {maxNftsLimit} per squadron (Range: {selectedBattleType?.minNFTs}-{selectedBattleType?.maxNFTs})
            </p>
          </div>

          {/* Required Specialization Bonus */}
          <div className="space-y-2">
            <Label className="text-lg font-semibold">⭐ Specialization Bonus (Optional)</Label>
            <Select value={requiredSpecialization} onValueChange={setRequiredSpecialization}>
              <SelectTrigger>
                <SelectValue placeholder="No specific bonus" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No Bonus</SelectItem>
                <SelectItem value="army">⚔️ Army Specialization (+20% Army Power)</SelectItem>
                <SelectItem value="religion">⛪ Religion Specialization (+20% Religion Power)</SelectItem>
                <SelectItem value="civilization">🏰 Civilization Specialization (+20% Civ Power)</SelectItem>
                <SelectItem value="economic">💰 Economic Specialization (+20% Economic Power)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-600">
              NFTs with this specialization get a 20% power bonus in this battle
            </p>
          </div>

          {/* Time Limit */}
          <div className="space-y-2">
            <Label className="text-lg font-semibold">⏳ Battle Time Limit (Optional)</Label>
            <Select value={timeLimitMinutes.toString()} onValueChange={(v) => setTimeLimitMinutes(parseInt(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">No Time Limit</SelectItem>
                <SelectItem value="30">30 minutes - Fast Battle</SelectItem>
                <SelectItem value="60">1 hour - Standard</SelectItem>
                <SelectItem value="120">2 hours - Extended</SelectItem>
                <SelectItem value="240">4 hours - Long Campaign</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-600">
              {timeLimitMinutes > 0 
                ? `Battle must be completed within ${timeLimitMinutes} minutes or it's a draw` 
                : "No time limit - battle continues until victory"}
            </p>
          </div>

          {/* Response Timeout */}
          <div className="space-y-2">
            <Label className="text-lg font-semibold">⏱️ Response Timeout</Label>
            <Select value={responseTimeout.toString()} onValueChange={(v) => setResponseTimeout(parseInt(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timeoutOptions.map(option => (
                  <SelectItem key={option.value} value={option.value.toString()}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-600">Opponents have {responseTimeout} minutes to respond to your battle request</p>
          </div>

          {/* Wagering Section */}
          <div className="space-y-3 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border-2 border-yellow-200">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="wager-enabled"
                checked={wagerEnabled}
                onCheckedChange={(checked) => setWagerEnabled(checked as boolean)}
              />
              <Label htmlFor="wager-enabled" className="cursor-pointer font-semibold text-lg">
                💰 Enable Wagering (Stakes)
              </Label>
            </div>
            
            {wagerEnabled && (
              <div className="space-y-2 ml-6">
                <Label>Wager Amount (XRP)</Label>
                <Input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={wagerAmount}
                  onChange={(e) => setWagerAmount(e.target.value)}
                  placeholder="0.0"
                />
                <div className="bg-white p-3 rounded border border-yellow-300">
                  <p className="text-xs text-gray-700">
                    <span className="font-semibold">💵 Payout Structure:</span>
                  </p>
                  <ul className="text-xs text-gray-700 mt-1 space-y-1">
                    <li>• Winner receives: {wagerAmount ? (parseFloat(wagerAmount) * 0.8 * 2).toFixed(2) : '0'} XRP (80% of pool)</li>
                    <li>• Platform fee: {wagerAmount ? (parseFloat(wagerAmount) * 0.2 * 2).toFixed(2) : '0'} XRP (20%)</li>
                    <li>• Total pot: {wagerAmount ? (parseFloat(wagerAmount) * 2).toFixed(2) : '0'} XRP</li>
                  </ul>
                </div>
              </div>
            )}
            
            {!wagerEnabled && (
              <p className="text-xs text-gray-600 ml-6">
                Battle will be free with no stakes. Perfect for practice and friendly matches.
              </p>
            )}
          </div>

          {/* Battle Options */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="friendly"
                checked={isFriendly}
                onCheckedChange={(checked) => setIsFriendly(checked as boolean)}
              />
              <Label htmlFor="friendly" className="cursor-pointer">
                🤝 Friendly Battle (No rank changes or leaderboard effects)
              </Label>
            </div>
          </div>

          {/* Create Button */}
          <div className="pt-4 border-t">
            <Button
              onClick={handleCreateBattle}
              disabled={loading || !selectedSquadron || !nftCountValid}
              className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 h-12 text-lg font-bold"
              size="lg"
            >
              {loading ? "Creating Battle..." : "⚔️ Create Battle & Issue Challenge"}
            </Button>
            {!nftCountValid && selectedSquadron && (
              <p className="text-xs text-red-600 text-center mt-2">
                ⚠️ Selected squadron doesn't meet battle type requirements
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
