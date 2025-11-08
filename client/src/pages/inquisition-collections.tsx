import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Shield, 
  Swords,
  Target,
  Zap,
  Sparkles,
  Search,
  ArrowLeft,
  Filter,
  RefreshCw,
  Eye
} from "lucide-react";
import { Link } from "wouter";
import { BackButton } from "@/components/gaming/BackButton";

interface NFT {
  id: number;
  nft_token_id: string;
  name: string;
  description: string;
  image_url: string;
  collection_id: number;
  total_points: number;
  power_strength: number;
  power_defense: number;
  power_magic: number;
  power_speed: number;
  traits: Record<string, any>;
  current_owner: string;
  full_metadata: any;
}

interface Collection {
  id: number;
  collection_name: string;
  issuer_address: string;
  taxon: number;
  expected_supply: number;
  game_role: string;
  base_power_level: number;
  scan_status: string;
  total_mints_tracked: number;
}

const COLLECTION_COLORS = {
  1: "from-purple-600 to-blue-600", // The Inquisition
  2: "from-green-600 to-teal-600", // Under the Bridge: Troll
  3: "from-amber-600 to-orange-600", // The Lost Emporium
  4: "from-yellow-600 to-amber-600", // DANTES AURUM
};

const InquisitionCollections = () => {
  const params = useParams();
  const collectionId = params.id ? parseInt(params.id) : null;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("points");
  const [selectedNft, setSelectedNft] = useState<NFT | null>(null);

  // Fetch all collections
  const { data: collectionsData, isLoading: collectionsLoading } = useQuery<{ success: boolean; data: Collection[] }>({
    queryKey: ['/api/inquisition-audit/collections'],
  });

  // Fetch NFTs for specific collection or all
  const { data: nftsData, isLoading: nftsLoading } = useQuery<{ success: boolean; data: NFT[] }>({
    queryKey: collectionId 
      ? [`/api/inquisition-audit/collection/${collectionId}/nfts`]
      : ['/api/inquisition-audit/nfts?limit=100'],
  });

  // Mutation to trigger scan
  const scanMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/inquisition-audit/scan-all', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to start scan');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Scan Started",
        description: "Scanning all verified NFT projects in the background. This may take a few minutes.",
      });
      
      // Refetch data after a delay to show updated results
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/inquisition-audit/collections'] });
        queryClient.invalidateQueries({ queryKey: ['/api/inquisition-audit/nfts?limit=100'] });
      }, 5000);
    },
    onError: (error: Error) => {
      toast({
        title: "Scan Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const collections = collectionsData?.data || [];
  const nfts = nftsData?.data || [];

  // Filter and sort NFTs
  const filteredNfts = nfts
    .filter(nft => 
      nft.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      nft.nft_token_id?.includes(searchQuery) ||
      nft.current_owner?.includes(searchQuery)
    )
    .sort((a, b) => {
      switch (sortBy) {
        case "points":
          return b.total_points - a.total_points;
        case "name":
          return (a.name || '').localeCompare(b.name || '');
        case "strength":
          return b.power_strength - a.power_strength;
        case "defense":
          return b.power_defense - a.power_defense;
        default:
          return 0;
      }
    });

  const selectedCollection = collectionId 
    ? collections.find(c => c.id === collectionId)
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950">
      {/* Header */}
      <div className="bg-slate-900/50 border-b border-purple-500/30">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <BackButton to="/inquisition" label="Back to Dashboard" theme="dark" />
              <div>
                <h1 className="text-3xl font-bold text-white">
                  {selectedCollection ? selectedCollection.collection_name : 'All Collections'}
                </h1>
                <p className="text-gray-400 text-sm mt-1">
                  {selectedCollection 
                    ? `${selectedCollection.total_mints_tracked} NFTs tracked`
                    : `${collections.length} collections • ${nfts.length} NFTs`
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                onClick={() => scanMutation.mutate()}
                disabled={scanMutation.isPending}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${scanMutation.isPending ? 'animate-spin' : ''}`} />
                {scanMutation.isPending ? 'Scanning...' : 'Scan All Collections'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Collection Selector (if viewing all) */}
        {!collectionId && (
          <div className="grid md:grid-cols-4 gap-4 mb-8">
            {collections.map((collection) => (
              <Link key={collection.id} href={`/inquisition/collections/${collection.id}`}>
                <Card className={`bg-gradient-to-br ${COLLECTION_COLORS[collection.id as keyof typeof COLLECTION_COLORS]} border-2 hover:scale-105 transition-transform cursor-pointer`}>
                  <CardContent className="p-6 text-center">
                    <h3 className="font-bold text-white mb-2">{collection.collection_name}</h3>
                    <div className="text-3xl font-bold text-white mb-2">
                      {collection.total_mints_tracked}
                    </div>
                    <div className="text-sm text-white/80">NFTs Tracked</div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {/* Filters & Search */}
        <Card className="bg-slate-900/50 border-purple-500/30 mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by name, token ID, or owner..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-slate-800 border-purple-500/30"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-40 bg-slate-800 border-purple-500/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="points">Sort by Points</SelectItem>
                    <SelectItem value="name">Sort by Name</SelectItem>
                    <SelectItem value="strength">Sort by Strength</SelectItem>
                    <SelectItem value="defense">Sort by Defense</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* NFT Grid */}
        <Card className="bg-slate-900/50 border-purple-500/30">
          <CardHeader>
            <CardTitle className="text-purple-400">
              {filteredNfts.length} NFTs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {nftsLoading ? (
              <div className="text-center py-12 text-gray-400">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
                Loading NFTs...
              </div>
            ) : filteredNfts.length > 0 ? (
              <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredNfts.map((nft) => (
                  <Card 
                    key={nft.id} 
                    className="bg-slate-800 border-purple-500/30 hover:border-purple-500 transition-all cursor-pointer group"
                    onClick={() => setSelectedNft(nft)}
                  >
                    <div className="relative overflow-hidden rounded-t-lg">
                      {nft.image_url && (
                        <img 
                          src={nft.image_url.replace('ipfs://', 'https://ipfs.io/ipfs/')} 
                          alt={nft.name}
                          className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                      )}
                      <div className="absolute top-2 right-2">
                        <Badge className="bg-amber-600 text-white">
                          {nft.total_points} pts
                        </Badge>
                      </div>
                    </div>
                    <CardContent className="p-4 space-y-3">
                      <div>
                        <h3 className="font-bold text-white mb-1 line-clamp-1">{nft.name || 'Unknown NFT'}</h3>
                        <p className="text-xs text-gray-400 line-clamp-1">
                          Owner: {nft.current_owner?.slice(0, 8)}...
                        </p>
                      </div>

                      {/* Power Attributes */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-1 text-red-400">
                          <Swords className="w-3 h-3" />
                          <span>{nft.power_strength} STR</span>
                        </div>
                        <div className="flex items-center gap-1 text-blue-400">
                          <Shield className="w-3 h-3" />
                          <span>{nft.power_defense} DEF</span>
                        </div>
                        <div className="flex items-center gap-1 text-purple-400">
                          <Sparkles className="w-3 h-3" />
                          <span>{nft.power_magic} MAG</span>
                        </div>
                        <div className="flex items-center gap-1 text-green-400">
                          <Zap className="w-3 h-3" />
                          <span>{nft.power_speed} SPD</span>
                        </div>
                      </div>

                      <Button className="w-full bg-purple-600 hover:bg-purple-700 text-xs">
                        <Eye className="w-3 h-3 mr-2" />
                        View Details
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <Shield className="w-16 h-16 text-gray-600 mx-auto mb-2" />
                <p>No NFTs found matching your search</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* NFT Detail Modal */}
      <Dialog open={!!selectedNft} onOpenChange={() => setSelectedNft(null)}>
        <DialogContent className="bg-slate-900 border-purple-500/50 max-w-3xl">
          {selectedNft && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl text-purple-400">
                  {selectedNft.name}
                </DialogTitle>
              </DialogHeader>
              <div className="grid md:grid-cols-2 gap-6">
                {/* Image */}
                <div>
                  {selectedNft.image_url && (
                    <img 
                      src={selectedNft.image_url.replace('ipfs://', 'https://ipfs.io/ipfs/')} 
                      alt={selectedNft.name}
                      className="w-full rounded-lg"
                    />
                  )}
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Token ID:</span>
                      <span className="text-white font-mono text-xs">
                        {selectedNft.nft_token_id?.slice(0, 16)}...
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Owner:</span>
                      <span className="text-white font-mono text-xs">
                        {selectedNft.current_owner?.slice(0, 12)}...
                      </span>
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-400 mb-2">Description</h4>
                    <p className="text-white text-sm">{selectedNft.description || 'No description'}</p>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-gray-400 mb-3">Power Attributes</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-800 p-3 rounded-lg">
                        <div className="flex items-center gap-2 text-red-400 mb-1">
                          <Swords className="w-4 h-4" />
                          <span className="text-xs">Strength</span>
                        </div>
                        <div className="text-2xl font-bold text-white">{selectedNft.power_strength}</div>
                      </div>
                      <div className="bg-slate-800 p-3 rounded-lg">
                        <div className="flex items-center gap-2 text-blue-400 mb-1">
                          <Shield className="w-4 h-4" />
                          <span className="text-xs">Defense</span>
                        </div>
                        <div className="text-2xl font-bold text-white">{selectedNft.power_defense}</div>
                      </div>
                      <div className="bg-slate-800 p-3 rounded-lg">
                        <div className="flex items-center gap-2 text-purple-400 mb-1">
                          <Sparkles className="w-4 h-4" />
                          <span className="text-xs">Magic</span>
                        </div>
                        <div className="text-2xl font-bold text-white">{selectedNft.power_magic}</div>
                      </div>
                      <div className="bg-slate-800 p-3 rounded-lg">
                        <div className="flex items-center gap-2 text-green-400 mb-1">
                          <Zap className="w-4 h-4" />
                          <span className="text-xs">Speed</span>
                        </div>
                        <div className="text-2xl font-bold text-white">{selectedNft.power_speed}</div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-gray-400 mb-2">Total Power</h4>
                    <div className="bg-gradient-to-r from-amber-600 to-yellow-600 p-4 rounded-lg text-center">
                      <div className="text-3xl font-bold text-white">{selectedNft.total_points}</div>
                      <div className="text-sm text-white/80">Power Points</div>
                    </div>
                  </div>

                  {/* Traits */}
                  {selectedNft.traits && Object.keys(selectedNft.traits).length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-400 mb-2">Traits</h4>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {Object.entries(selectedNft.traits).map(([key, value]) => (
                          <div key={key} className="flex items-center justify-between bg-slate-800 p-2 rounded">
                            <span className="text-xs text-gray-400">{key}</span>
                            <Badge variant="outline" className="text-xs">{String(value)}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InquisitionCollections;
