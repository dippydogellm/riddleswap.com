import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sword, Users, Trophy, Coins, Bot } from "lucide-react";

interface Squadron {
  id: string;
  name: string;
  total_power: string;
  nft_count: number;
  members?: any[];
}

interface BattleCreationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  squadrons: Squadron[];
  theme: 'light' | 'dark';
}

export function BattleCreationModal({ open, onOpenChange, squadrons, theme }: BattleCreationModalProps) {
  const [battleType, setBattleType] = useState<'1v1' | 'group' | '1vAI'>('1vAI');
  const [selectedSquadron, setSelectedSquadron] = useState<string>('');
  const [opponentHandle, setOpponentHandle] = useState('');
  const [wagerType, setWagerType] = useState<'none' | 'xrp' | 'rdl' | 'nft'>('none');
  const [wagerAmount, setWagerAmount] = useState('');
  const [description, setDescription] = useState('');
  const queryClient = useQueryClient();

  const createBattleMutation = useMutation({
    mutationFn: async (data: any) => {
      const token = sessionStorage.getItem('sessionToken');
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const res = await fetch("/api/battles/create", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/battles/player'] });
      onOpenChange(false);
      resetForm();
    },
  });

  const resetForm = () => {
    setBattleType('1vAI');
    setSelectedSquadron('');
    setOpponentHandle('');
    setWagerType('none');
    setWagerAmount('');
    setDescription('');
  };

  const handleCreate = () => {
    if (!selectedSquadron) {
      alert("Please select a squadron");
      return;
    }

    if (battleType === '1v1' && !opponentHandle.trim()) {
      alert("Please enter opponent's handle");
      return;
    }

    if (wagerType !== 'none' && !wagerAmount) {
      alert("Please enter wager amount");
      return;
    }

    const isAiBattle = battleType === '1vAI';

    createBattleMutation.mutate({
      creator_squadron_id: selectedSquadron,
      battle_type: battleType,
      combat_type: 'military', // Default to military
      land_type: 'plains', // Default to plains
      response_timeout_minutes: 60,
      wager_amount: wagerType !== 'none' ? wagerAmount : "0",
      is_friendly: true,
      is_ai_battle: isAiBattle,
      ai_difficulty: isAiBattle ? 'medium' : null,
      creator_wallet_address: null, // Will be set by backend from session
      custom_prompt: description || null,
    });
  };

  const selectedSquadronData = squadrons.find(s => s.id === selectedSquadron);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-w-2xl ${theme === 'dark' ? 'bg-slate-900 text-white border-blue-500/30' : 'bg-white text-gray-900 border-blue-300'}`}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
            Create Battle
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-6 pr-4">
            {/* Battle Type */}
            <div>
              <Label className="text-lg mb-3 block">Battle Type</Label>
              <RadioGroup value={battleType} onValueChange={(val: any) => setBattleType(val)}>
                <div className={`flex items-center space-x-3 p-4 rounded-lg cursor-pointer transition-all ${
                  battleType === '1v1'
                    ? 'bg-blue-500/20 border-2 border-blue-500'
                    : theme === 'dark'
                    ? 'bg-slate-800 border border-slate-700'
                    : 'bg-gray-100 border border-gray-300'
                }`}
                onClick={() => setBattleType('1v1')}>
                  <RadioGroupItem value="1v1" id="1v1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Sword className="w-5 h-5 text-blue-500" />
                      <Label htmlFor="1v1" className="font-semibold cursor-pointer">1v1 Duel</Label>
                    </div>
                    <p className="text-sm text-gray-400 mt-1">Challenge a specific opponent to a one-on-one battle</p>
                  </div>
                </div>
                
                <div className={`flex items-center space-x-3 p-4 rounded-lg cursor-pointer transition-all ${
                  battleType === 'group'
                    ? 'bg-purple-500/20 border-2 border-purple-500'
                    : theme === 'dark'
                    ? 'bg-slate-800 border border-slate-700'
                    : 'bg-gray-100 border border-gray-300'
                }`}
                onClick={() => setBattleType('group')}>
                  <RadioGroupItem value="group" id="group" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-purple-500" />
                      <Label htmlFor="group" className="font-semibold cursor-pointer">Open Battle</Label>
                    </div>
                    <p className="text-sm text-gray-400 mt-1">Create an open battle that anyone can join</p>
                  </div>
                </div>
                
                <div className={`flex items-center space-x-3 p-4 rounded-lg cursor-pointer transition-all ${
                  battleType === '1vAI'
                    ? 'bg-green-500/20 border-2 border-green-500'
                    : theme === 'dark'
                    ? 'bg-slate-800 border border-slate-700'
                    : 'bg-gray-100 border border-gray-300'
                }`}
                onClick={() => setBattleType('1vAI')}>
                  <RadioGroupItem value="1vAI" id="1vAI" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Bot className="w-5 h-5 text-green-500" />
                      <Label htmlFor="1vAI" className="font-semibold cursor-pointer">AI Battle</Label>
                    </div>
                    <p className="text-sm text-gray-400 mt-1">Battle against the AI Oracle for experience and rewards</p>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* Squadron Selection */}
            <div>
              <Label>Select Your Squadron *</Label>
              <Select value={selectedSquadron} onValueChange={setSelectedSquadron}>
                <SelectTrigger className={theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-300'}>
                  <SelectValue placeholder="Choose a squadron..." />
                </SelectTrigger>
                <SelectContent>
                  {squadrons.length === 0 ? (
                    <SelectItem value="none" disabled>No squadrons available - create one first</SelectItem>
                  ) : (
                    squadrons.map((squad) => (
                      <SelectItem key={squad.id} value={squad.id}>
                        {squad.name} (Power: {Number(squad.total_power || 0).toLocaleString()}, NFTs: {squad.nft_count})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              
              {selectedSquadronData && (
                <div className={`mt-2 p-3 rounded-lg ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100'}`}>
                  <div className="flex items-center justify-between text-sm">
                    <span>Squadron Power:</span>
                    <span className="font-bold text-blue-500">{Number(selectedSquadronData.total_power || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span>NFTs in Squadron:</span>
                    <span className="font-semibold">{selectedSquadronData.nft_count}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Opponent Selection (1v1 only) */}
            {battleType === '1v1' && (
              <div>
                <Label>Opponent Handle *</Label>
                <Input
                  value={opponentHandle}
                  onChange={(e) => setOpponentHandle(e.target.value)}
                  placeholder="Enter opponent's RiddleSwap handle"
                  className={theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-300'}
                />
                <p className="text-xs text-gray-400 mt-1">
                  They will receive a battle challenge notification
                </p>
              </div>
            )}

            {/* Wager Selection */}
            <div>
              <Label>Battle Wager (Optional)</Label>
              <Select value={wagerType} onValueChange={(val: any) => setWagerType(val)}>
                <SelectTrigger className={theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-300'}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Wager (Practice)</SelectItem>
                  <SelectItem value="xrp">💰 XRP</SelectItem>
                  <SelectItem value="rdl">🪙 RDL Tokens</SelectItem>
                  <SelectItem value="nft">🎨 NFT (Winner takes NFT)</SelectItem>
                </SelectContent>
              </Select>

              {wagerType !== 'none' && (
                <div className="mt-2">
                  <Input
                    type="number"
                    value={wagerAmount}
                    onChange={(e) => setWagerAmount(e.target.value)}
                    placeholder={`Amount in ${wagerType.toUpperCase()}`}
                    className={theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-300'}
                    step="0.01"
                    min="0"
                  />
                  <p className="text-xs text-amber-400 mt-1">
                    ⚠️ Winner receives 80% of total wager pool. Platform fee: 20%
                  </p>
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <Label>Battle Description (Optional)</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a challenge message..."
                maxLength={200}
                className={theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-300'}
              />
            </div>

            {/* Summary */}
            {selectedSquadron && (
              <div className={`p-4 rounded-lg border-2 ${
                theme === 'dark'
                  ? 'bg-gradient-to-r from-blue-900/30 to-purple-900/30 border-blue-500/30'
                  : 'bg-gradient-to-r from-blue-50 to-purple-50 border-blue-300'
              }`}>
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  <h3 className="font-bold">Battle Summary</h3>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Type:</span>
                    <span className="font-semibold">{battleType === '1v1' ? '1v1 Duel' : 'Open Battle'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Your Squadron:</span>
                    <span className="font-semibold">{selectedSquadronData?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Your Power:</span>
                    <span className="font-bold text-blue-500">{Number(selectedSquadronData?.total_power || 0).toLocaleString()}</span>
                  </div>
                  {wagerType !== 'none' && (
                    <div className="flex justify-between border-t border-gray-500 pt-1 mt-2">
                      <span>Wager:</span>
                      <span className="font-bold text-amber-500">{wagerAmount} {wagerType.toUpperCase()}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex gap-3 mt-4">
          <Button
            onClick={handleCreate}
            disabled={createBattleMutation.isPending || !selectedSquadron}
            className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
          >
            {createBattleMutation.isPending ? "Creating..." : "Create Battle"}
          </Button>
          <Button
            onClick={() => onOpenChange(false)}
            variant="outline"
            className={theme === 'dark' ? 'border-slate-700' : 'border-gray-300'}
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
