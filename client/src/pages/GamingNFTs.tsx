import { useMemo, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Filter, Sword, Shield, Sparkles, Coins } from 'lucide-react';

interface GamingNFT {
  id: string;
  nft_token_id: string;
  nft_name: string;
  collection_name: string;
  original_image_url: string;
  battle_image_url?: string;
  current_owner?: string;
  army_power: number;
  religion_power: number;
  civilization_power: number;
  economic_power: number;
  total_power: number;
  character_class?: string;
  rarity_score?: number;
}

interface GamingNFTResponse {
  data: GamingNFT[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  sort: string;
  direction: string;
}

export default function GamingNFTs() {
  const [searchTerm, setSearchTerm] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [civilizationFilter, setCivilizationFilter] = useState('all');
  const [selectedNFT, setSelectedNFT] = useState<GamingNFT | null>(null);
  const { toast } = useToast();
  // Server-driven sorting & pagination state
  const [sortBy, setSortBy] = useState<'total_power' | 'rarity_score' | 'army_power' | 'nft_name'>('total_power');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [pageNum, setPageNum] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Fetch gaming NFTs (server-side sorting & pagination)
  const { data: response, isLoading, refetch, isFetching } = useQuery<GamingNFTResponse, Error, GamingNFTResponse>({
    queryKey: ['gaming-nfts', ownerFilter, civilizationFilter, sortBy, sortDir, pageNum, pageSize],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (ownerFilter) params.append('owner', ownerFilter);
      if (civilizationFilter !== 'all') params.append('civilization', civilizationFilter);
      params.append('sort', sortBy);
      params.append('dir', sortDir);
      params.append('page', String(pageNum));
      params.append('pageSize', String(pageSize));
      const res = await fetch(`/api/gaming/nfts?${params}`);
      if (!res.ok) throw new Error('Failed to fetch gaming NFTs');
      const json = await res.json();
      return json as GamingNFTResponse;
    },
  });

  // Filter NFTs by search term
  const filteredNFTs = useMemo(() => {
    const list = response?.data ?? [];
    const term = searchTerm.trim().toLowerCase();
    if (!term) return list;
    return list.filter(nft =>
      nft.nft_name?.toLowerCase().includes(term) ||
      nft.collection_name?.toLowerCase().includes(term) ||
      nft.nft_token_id?.toLowerCase().includes(term)
    );
  }, [response, searchTerm]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            Gaming NFT Collection
          </h1>
          <p className="text-muted-foreground mt-2">
            Browse all gaming NFTs with power attributes and battle-ready stats
          </p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          {response?.total ?? 0} NFTs
        </Badge>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or token ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Owner Filter */}
            <Input
              placeholder="Filter by owner address..."
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
            />

            {/* Character Class Filter */}
            <Select value={civilizationFilter} onValueChange={(value) => {
              setCivilizationFilter(value);
              toast({
                title: "Filter Applied",
                description: `Filtering class: ${value === 'all' ? 'All Classes' : value}`,
              });
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by character class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                <SelectItem value="warrior">Warrior</SelectItem>
                <SelectItem value="priest">Priest</SelectItem>
                <SelectItem value="knight">Knight</SelectItem>
                <SelectItem value="merchant">Merchant</SelectItem>
                <SelectItem value="sage">Sage</SelectItem>
                <SelectItem value="lord">Lord</SelectItem>
                <SelectItem value="champion">Champion</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort By */}
            <div className="grid grid-cols-2 gap-2">
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="total_power">Sort: Total Power</SelectItem>
                  <SelectItem value="rarity_score">Sort: Rarity Score</SelectItem>
                  <SelectItem value="army_power">Sort: Army Power</SelectItem>
                  <SelectItem value="nft_name">Sort: Name</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortDir} onValueChange={(v) => setSortDir(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Direction" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Desc</SelectItem>
                  <SelectItem value="asc">Asc</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Page Size */}
            <div className="flex items-center gap-2 col-span-1 md:col-span-4">
              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(parseInt(v, 10)); setPageNum(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Page Size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="150">150</SelectItem>
                </SelectContent>
              </Select>
              {isFetching && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* NFT Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
          {filteredNFTs.map((nft) => (
            <Dialog key={nft.id}>
              <DialogTrigger asChild>
                <Card className="cursor-pointer hover:shadow-lg transition-shadow duration-200 group">
                  <CardHeader className="p-0">
                    <div className="relative aspect-square overflow-hidden rounded-t-lg bg-gradient-to-br from-slate-900 to-slate-800">
                      <img
                        src={nft.original_image_url}
                        alt={nft.nft_name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '/inquisition-card.png';
                        }}
                      />
                      <div className="absolute top-2 right-2">
                        <Badge variant="secondary" className="backdrop-blur-md bg-black/70 border-white/20">
                          {nft.collection_name}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    <div>
                      <h3 className="font-bold text-lg truncate">{nft.nft_name}</h3>
                      {nft.character_class && (
                        <p className="text-sm text-muted-foreground">{nft.character_class}</p>
                      )}
                    </div>

                    {/* Power Stats */}
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-1">
                        <Sword className="h-4 w-4 text-red-500" />
                        <span className="font-semibold">{Number(nft.army_power).toFixed(0)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Shield className="h-4 w-4 text-blue-500" />
                        <span className="font-semibold">{Number(nft.religion_power).toFixed(0)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Sparkles className="h-4 w-4 text-purple-500" />
                        <span className="font-semibold">{Number(nft.civilization_power).toFixed(0)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Coins className="h-4 w-4 text-yellow-500" />
                        <span className="font-semibold">{Number(nft.economic_power).toFixed(0)}</span>
                      </div>
                    </div>

                    {/* Total Power */}
                    <div className="pt-2 border-t">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Total Power</span>
                        <span className="text-lg font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                          {Number(nft.total_power).toFixed(0)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </DialogTrigger>

              {/* Detailed NFT Dialog */}
              <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-2xl">{nft.nft_name}</DialogTitle>
                </DialogHeader>
                
                <div className="space-y-6">
                  {/* Images */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Original Image */}
                    <div>
                      <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Original NFT</h3>
                      <div className="aspect-square rounded-lg overflow-hidden border-2 border-purple-500/20 shadow-lg">
                        <img
                          src={nft.original_image_url}
                          alt={`${nft.nft_name} - Original`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = '/inquisition-card.png';
                          }}
                        />
                      </div>
                    </div>

                    {/* AI Battle Image */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">AI Battle Image</h3>
                        {!nft.battle_image_url && (
                          <Button 
                            size="sm" 
                            onClick={async () => {
                              toast({
                                title: "Generating Battle Image",
                                description: "Creating AI-powered battle image...",
                              });
                              await generateBattleImage(nft.id, toast);
                              refetch();
                            }}
                            disabled={isLoading}
                          >
                            Generate
                          </Button>
                        )}
                      </div>
                      <div className="aspect-square rounded-lg overflow-hidden border-2 border-blue-500/20 bg-gradient-to-br from-purple-500/10 to-blue-500/10 shadow-lg">
                        {nft.battle_image_url ? (
                          <img
                            src={nft.battle_image_url}
                            alt={`${nft.nft_name} - Battle`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            No battle image generated
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Detailed Stats */}
                  <div className="space-y-6">
                    <div>
                      <h3 className="font-semibold mb-4 text-lg uppercase tracking-wide">Power Attributes</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <StatBar label="Army Power" value={nft.army_power} max={500} color="red" icon={<Sword className="h-4 w-4" />} />
                        <StatBar label="Religion Power" value={nft.religion_power} max={500} color="blue" icon={<Shield className="h-4 w-4" />} />
                        <StatBar label="Civilization Power" value={nft.civilization_power} max={500} color="purple" icon={<Sparkles className="h-4 w-4" />} />
                        <StatBar label="Economic Power" value={nft.economic_power} max={500} color="yellow" icon={<Coins className="h-4 w-4" />} />
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                      <div>
                        <p className="text-sm text-muted-foreground">Collection</p>
                        <p className="font-medium">{nft.collection_name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Character Class</p>
                        <p className="font-medium">{nft.character_class || 'Unknown'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Rarity Score</p>
                        <p className="font-medium">{nft.rarity_score ? Number(nft.rarity_score).toFixed(2) : 'N/A'}</p>
                      </div>
                      {nft.current_owner && (
                        <div className="col-span-2">
                          <p className="text-sm text-muted-foreground">Owner</p>
                          <p className="font-mono text-xs break-all">{nft.current_owner}</p>
                        </div>
                      )}
                      <div className="col-span-2">
                        <p className="text-sm text-muted-foreground">Token ID</p>
                        <p className="font-mono text-xs break-all">{nft.nft_token_id}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      <div className="flex items-center justify-between mt-8">
        <div className="text-sm text-muted-foreground">
          Page {response?.page ?? pageNum} of {response?.totalPages ?? 1}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={pageNum === 1} onClick={() => setPageNum(p => Math.max(1, p - 1))}>Prev</Button>
          <Button variant="outline" size="sm" disabled={response && pageNum >= (response.totalPages)} onClick={() => setPageNum(p => p + 1)}>Next</Button>
        </div>
      </div>

      {filteredNFTs.length === 0 && !isLoading && (
        <Card className="border-dashed border-2">
          <CardContent className="py-12 text-center">
            <Filter className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-xl font-semibold text-muted-foreground">No NFTs found</p>
            <p className="text-sm text-muted-foreground mt-2">Try adjusting your search filters</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Stat Bar Component
function StatBar({ label, value, max, color, icon }: { 
  label: string; 
  value: number; 
  max: number; 
  color: string;
  icon: React.ReactNode;
}) {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  const percentage = Math.min((numValue / max) * 100, 100);
  const colorClasses = {
    red: 'bg-red-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    yellow: 'bg-yellow-500',
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium">{label}</span>
        </div>
        <span className="text-sm font-bold">{value}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className={`h-full ${colorClasses[color as keyof typeof colorClasses]} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// Generate Battle Image Function
async function generateBattleImage(nftId: string, toast: any) {
  try {
    toast({
      title: "Processing",
      description: "Generating AI battle image with DALL-E 3...",
    });
    
    const response = await fetch(`/api/gaming/nfts/${nftId}/generate-battle-image`, {
      method: 'POST',
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || 'Failed to generate battle image');
    }
    
    const data = await response.json();
    toast({
      title: "Success!",
      description: "Battle image generated and uploaded to cloud storage",
    });
    
    return data;
  } catch (error) {
    console.error('Error generating battle image:', error);
    toast({
      title: "Generation Failed",
      description: error instanceof Error ? error.message : "Failed to generate battle image",
      variant: "destructive",
    });
    throw error;
  }
}
