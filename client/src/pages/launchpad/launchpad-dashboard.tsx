import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Rocket, 
  Plus, 
  TrendingUp, 
  Users, 
  Timer,
  Coins,
  Star,
  Globe,
  Filter,
  Search,
  Clock
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { TokenCreationForm } from "@/components/launchpad/token-creation-form";
import { LaunchpadCard } from "@/components/launchpad/launchpad-card";
import { MyLaunches } from "@/components/launchpad/my-launches";

interface TokenLaunch {
  id: number;
  creatorWallet: string;
  chainType: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDescription: string;
  tokenLogo: string;
  totalSupply: string;
  presaleAmount: string;
  presalePrice: string;
  liquidityThreshold: string;
  softCap: string;
  hardCap: string;
  setupFeePaid: boolean;
  status: string;
  currentStage: string;
  totalRaised: string;
  participantCount: number;
  whitelistStartTime: string;
  whitelistEndTime: string;
  nftHoldersStartTime: string;
  nftHoldersEndTime: string;
  openWlStartTime: string;
  openWlEndTime: string;
  openSaleStartTime: string;
  openSaleEndTime: string;
  createdAt: string;
}

export default function LaunchpadDashboard() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedChain, setSelectedChain] = useState<string>("all");
  const [selectedStage, setSelectedStage] = useState<string>("all");
  const [showCreateForm, setShowCreateForm] = useState(false);

  const userWallet = "rEVrTKUKSLx5nxdfV8SAFTxS9FGFrfHRLo"; // Current user wallet

  // Fetch all active launches
  const { data: launches = [], isLoading: loadingLaunches } = useQuery<TokenLaunch[]>({
    queryKey: ['/api/launchpad/launches'],
    queryFn: () => apiRequest('/api/launchpad/launches'),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Filter launches based on search and filters
  const filteredLaunches = launches.filter(launch => {
    const matchesSearch = launch.tokenName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         launch.tokenSymbol.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesChain = selectedChain === "all" || launch.chainType === selectedChain;
    const matchesStage = selectedStage === "all" || launch.currentStage === selectedStage;
    
    return matchesSearch && matchesChain && matchesStage;
  });

  const getStageProgress = (launch: TokenLaunch) => {
    const stages = ["setup", "whitelist", "nft_holders", "open_wl", "open_sale", "completed"];
    const currentIndex = stages.indexOf(launch.currentStage);
    return Math.max(0, (currentIndex / (stages.length - 1)) * 100);
  };

  const getChainColor = (chain: string) => {
    const colors: Record<string, string> = {
      // Layer 1 Blockchains
      ethereum: "bg-purple-500",
      bitcoin: "bg-orange-500",
      solana: "bg-green-500",
      xrpl: "bg-blue-500",
      avalanche: "bg-red-500",
      
      // Layer 2 & Side Chains
      polygon: "bg-indigo-500",
      arbitrum: "bg-blue-700",
      optimism: "bg-red-600",
      base: "bg-blue-600",
      mantle: "bg-amber-700",
      metis: "bg-cyan-500",
      scroll: "bg-emerald-600",
      zksync: "bg-slate-600",
      linea: "bg-green-600",
      taiko: "bg-pink-500",
      
      // BSC & Alternative EVM
      bsc: "bg-yellow-500",
      fantom: "bg-blue-400",
      unichain: "bg-pink-600",
      soneium: "bg-purple-600"
    };
    return colors[chain] || "bg-gray-500";
  };

  const getStageColor = (stage: string) => {
    const colors: Record<string, string> = {
      setup: "bg-gray-500",
      whitelist: "bg-blue-500",
      nft_holders: "bg-purple-500",
      open_wl: "bg-orange-500",
      open_sale: "bg-green-500",
      completed: "bg-green-600"
    };
    return colors[stage] || "bg-gray-500";
  };

  if (loadingLaunches) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="animate-pulse space-y-6">
          <div className="h-12 bg-gray-300 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-64 bg-gray-300 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold flex items-center gap-3">
            <Rocket className="h-10 w-10 text-primary" />
            Token Launchpad
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Create and discover the next generation of tokens across all major blockchains
          </p>
        </div>
        <Button 
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 text-lg px-6 py-3"
          size="lg"
        >
          <Plus className="h-5 w-5" />
          Create Token
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Active Launches
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{launches.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Coins className="h-4 w-4" />
              Total Raised
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {launches.reduce((sum, launch) => sum + parseFloat(launch.totalRaised || "0"), 0).toFixed(0)} XRP
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Total Participants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {launches.reduce((sum, launch) => sum + (launch.participantCount || 0), 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Multi-Chain
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {new Set(launches.map(l => l.chainType)).size}
            </div>
            <p className="text-sm text-muted-foreground">Networks</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="all-launches" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all-launches">All Launches</TabsTrigger>
          <TabsTrigger value="my-launches">My Launches</TabsTrigger>
          <TabsTrigger value="my-contributions">My Contributions</TabsTrigger>
        </TabsList>

        <TabsContent value="all-launches" className="space-y-6">
          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tokens..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <select
                value={selectedChain}
                onChange={(e) => setSelectedChain(e.target.value)}
                className="px-3 py-2 border border-input rounded-md bg-background"
              >
                <option value="all">All Chains</option>
                <optgroup label="Layer 1">
                  <option value="ethereum">Ethereum</option>
                  <option value="bitcoin">Bitcoin</option>
                  <option value="solana">Solana</option>
                  <option value="xrpl">XRPL</option>
                  <option value="avalanche">Avalanche</option>
                </optgroup>
                <optgroup label="Layer 2 & Sidechains">
                  <option value="polygon">Polygon</option>
                  <option value="arbitrum">Arbitrum</option>
                  <option value="optimism">Optimism</option>
                  <option value="base">Base</option>
                  <option value="mantle">Mantle</option>
                  <option value="metis">Metis</option>
                  <option value="scroll">Scroll</option>
                  <option value="zksync">zkSync</option>
                  <option value="linea">Linea</option>
                  <option value="taiko">Taiko</option>
                </optgroup>
                <optgroup label="Alternative EVM">
                  <option value="bsc">BSC</option>
                  <option value="fantom">Fantom</option>
                  <option value="unichain">Unichain</option>
                  <option value="soneium">Soneium</option>
                </optgroup>
              </select>

              <select
                value={selectedStage}
                onChange={(e) => setSelectedStage(e.target.value)}
                className="px-3 py-2 border border-input rounded-md bg-background"
              >
                <option value="all">All Stages</option>
                <option value="whitelist">Whitelist</option>
                <option value="nft_holders">NFT Holders</option>
                <option value="open_wl">Open WL</option>
                <option value="open_sale">Open Sale</option>
              </select>
            </div>
          </div>

          {/* Launch Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLaunches.map((launch) => (
              <LaunchpadCard key={launch.id} launch={launch} />
            ))}
          </div>

          {filteredLaunches.length === 0 && (
            <div className="text-center py-12">
              <Rocket className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No launches found</h3>
              <p className="text-muted-foreground mb-6">
                {launches.length === 0 
                  ? "Be the first to create a token launch!" 
                  : "Try adjusting your search or filters"}
              </p>
              <Button onClick={() => setShowCreateForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Launch
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="my-launches">
          <MyLaunches walletAddress={userWallet} />
        </TabsContent>

        <TabsContent value="my-contributions">
          <div className="text-center py-12">
            <Coins className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Your Contributions</h3>
            <p className="text-muted-foreground">
              Track your participation in token launches
            </p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Token Creation Modal */}
      {showCreateForm && (
        <TokenCreationForm 
          onClose={() => setShowCreateForm(false)} 
          userWallet={userWallet}
        />
      )}
    </div>
  );
}
