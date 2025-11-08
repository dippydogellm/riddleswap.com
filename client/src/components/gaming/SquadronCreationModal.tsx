import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sword, Shield, Users, Coins } from "lucide-react";
import { NFTCollectionDropdown } from "./NFTCollectionDropdown";
import { normalizeImagePath, getFallbackImage } from "@/utils/imageNormalizer";

interface NFT {
  nft_id: string;
  name: string;
  image_url: string;
  army_power: string;
  religion_power: string;
  civilization_power: string;
  economic_power: string;
  total_power: string;
}

interface SquadronCreationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nfts: NFT[];
  theme: 'light' | 'dark';
}

export function SquadronCreationModal({ open, onOpenChange, nfts, theme }: SquadronCreationModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [squadronType, setSquadronType] = useState("balanced");
  const [selectedNFTs, setSelectedNFTs] = useState<Set<string>>(new Set());
  const [filteredNFTs, setFilteredNFTs] = useState<NFT[]>(nfts);
  const queryClient = useQueryClient();

  const createSquadronMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/gaming/squadrons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gaming/squadrons'] });
      onOpenChange(false);
      resetForm();
    },
  });

  const resetForm = () => {
    setName("");
    setDescription("");
    setSquadronType("balanced");
    setSelectedNFTs(new Set());
  };

  const toggleNFT = (nftId: string) => {
    const newSelected = new Set(selectedNFTs);
    if (newSelected.has(nftId)) {
      newSelected.delete(nftId);
    } else {
      if (newSelected.size >= 10) {
        alert("Maximum 10 NFTs per squadron");
        return;
      }
      newSelected.add(nftId);
    }
    setSelectedNFTs(newSelected);
  };

  const handleCreate = () => {
    if (!name.trim()) {
      alert("Please enter a squadron name");
      return;
    }
    if (selectedNFTs.size === 0) {
      alert("Please select at least one NFT");
      return;
    }

    const selectedNFTData = nfts.filter(nft => selectedNFTs.has(nft.nft_id));
    
    const totalPower = {
      army: selectedNFTData.reduce((sum, nft) => sum + Number(nft.army_power || 0), 0),
      religion: selectedNFTData.reduce((sum, nft) => sum + Number(nft.religion_power || 0), 0),
      civilization: selectedNFTData.reduce((sum, nft) => sum + Number(nft.civilization_power || 0), 0),
      economic: selectedNFTData.reduce((sum, nft) => sum + Number(nft.economic_power || 0), 0),
      total: selectedNFTData.reduce((sum, nft) => sum + Number(nft.total_power || 0), 0),
    };

    createSquadronMutation.mutate({
      name,
      description,
      squadron_type: squadronType,
      nfts: selectedNFTData.map((nft, index) => ({
        nft_id: nft.nft_id,
        nft_name: nft.name,
        nft_image: normalizeImagePath(nft.image_url) || '',
        nft_power: nft.total_power,
        position: index,
      })),
      power: totalPower,
    });
  };

  const calculatePower = () => {
    const selectedNFTData = nfts.filter(nft => selectedNFTs.has(nft.nft_id));
    return {
      army: selectedNFTData.reduce((sum, nft) => sum + Number(nft.army_power || 0), 0),
      religion: selectedNFTData.reduce((sum, nft) => sum + Number(nft.religion_power || 0), 0),
      civilization: selectedNFTData.reduce((sum, nft) => sum + Number(nft.civilization_power || 0), 0),
      economic: selectedNFTData.reduce((sum, nft) => sum + Number(nft.economic_power || 0), 0),
      total: selectedNFTData.reduce((sum, nft) => sum + Number(nft.total_power || 0), 0),
    };
  };

  const power = calculatePower();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`w-[95vw] sm:w-[90%] sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 ${theme === 'dark' ? 'bg-slate-900 text-white border-red-500/30' : 'bg-white text-gray-900 border-red-300'}`}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
            Create Squadron
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left side: Form */}
          <div className="space-y-4">
            <div>
              <Label>Squadron Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Dragon Legion"
                maxLength={50}
                className={theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-300'}
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your squadron's purpose..."
                maxLength={200}
                className={theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-300'}
                rows={3}
              />
            </div>

            <div>
              <Label>Squadron Type</Label>
              <Select value={squadronType} onValueChange={setSquadronType}>
                <SelectTrigger className={theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-300'}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="balanced">⚖️ Balanced - All-around performance</SelectItem>
                  <SelectItem value="offensive">⚔️ Offensive - High attack power</SelectItem>
                  <SelectItem value="defensive">🛡️ Defensive - Strong protection</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Power Stats */}
            <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100'}`}>
              <h3 className="text-sm font-semibold mb-3">Squadron Power</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Sword className="w-4 h-4 text-red-500" />
                  <span>Army: {power.army.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-500" />
                  <span>Religion: {power.religion.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-500" />
                  <span>Civilization: {power.civilization.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-amber-500" />
                  <span>Economic: {power.economic.toLocaleString()}</span>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-gray-600">
                <div className="font-bold text-lg">
                  Total Power: {power.total.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="text-sm text-gray-400">
              Selected: {selectedNFTs.size} / 10 NFTs
            </div>
          </div>

          {/* Right side: NFT Selection */}
          <div>
            <Label className="mb-2 block">Select NFTs (Max 10) *</Label>
            
            {/* Collection Filter Dropdown */}
            <div className="mb-3">
              <NFTCollectionDropdown
                nfts={nfts}
                onFilterChange={setFilteredNFTs}
                theme={theme}
                showLabel={false}
                persistKey="squadron-creation-collection-filter"
              />
            </div>

            <ScrollArea className={`h-[400px] rounded-lg border ${theme === 'dark' ? 'border-slate-700 bg-slate-800/30' : 'border-gray-300 bg-gray-50'}`}>
              <div className="p-4 space-y-2">
                {filteredNFTs.map((nft) => (
                  <div
                    key={nft.nft_id}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                      selectedNFTs.has(nft.nft_id)
                        ? 'bg-red-500/20 border-2 border-red-500'
                        : theme === 'dark'
                        ? 'bg-slate-700/50 hover:bg-slate-700 border border-slate-600'
                        : 'bg-white hover:bg-gray-100 border border-gray-300'
                    }`}
                    onClick={() => toggleNFT(nft.nft_id)}
                  >
                    <Checkbox
                      checked={selectedNFTs.has(nft.nft_id)}
                      onCheckedChange={() => toggleNFT(nft.nft_id)}
                    />
                    <img
                      src={normalizeImagePath(nft.image_url) || getFallbackImage()}
                      alt={nft.name}
                      className="w-12 h-12 rounded object-cover"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-sm">{nft.name}</div>
                      <div className="text-xs text-gray-400">
                        Power: {Number(nft.total_power || 0).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <Button
            onClick={handleCreate}
            disabled={createSquadronMutation.isPending}
            className="flex-1 bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700"
          >
            {createSquadronMutation.isPending ? "Creating..." : "Create Squadron"}
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
