import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ProfileHub } from "@/components/gaming/ProfileHub";
import { CivilizationCommand } from "@/components/gaming/CivilizationCommand";
import { ArmyManagement } from "@/components/gaming/ArmyManagement";
import { WarRoom } from "@/components/gaming/WarRoom";
import { ActionBar } from "@/components/gaming/ActionBar";
import { SquadronCreationModal } from "@/components/gaming/SquadronCreationModal";
import { BattleCreationModal } from "@/components/gaming/BattleCreationModal";
import { NFTCollectionDropdown } from "@/components/gaming/NFTCollectionDropdown";
import { EnhancedStatsPanel } from "@/components/gaming/EnhancedStatsPanel";
import { SetupWizard } from "@/components/gaming/SetupWizard";
import { useSession } from "@/utils/sessionManager";
import { SessionRenewalModal } from "@/components/SessionRenewalModal";
import { Loader2, Shield, Castle, AlertTriangle, X, Search, SortAsc } from "lucide-react";
import { normalizeNftImage, getFallbackImage } from "@/utils/imageNormalizer";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useLocation } from "wouter";

// Import existing modals/dialogs
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import GamingNavigation from "@/components/GamingNavigation";

export default function GamingDashboardV3() {
  console.log('🎮 [GAMING DASHBOARD] GamingDashboardV3 component is rendering');
  
  const session = useSession();
  const [location, navigate] = useLocation();
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  
  useEffect(() => {
    console.log('🎮 [GAMING DASHBOARD] Component mounted, session:', session?.handle);
  }, [session]);
  
  // Check if session needs renewal
  useEffect(() => {
    if ((session as any).needsRenewal) {
      console.log('⚠️ [GAMING DASHBOARD] Session needs renewal, showing modal');
      setShowRenewalModal(true);
    } else {
      setShowRenewalModal(false);
    }
  }, [(session as any).needsRenewal]);
  
  // Modal states
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [createSquadronOpen, setCreateSquadronOpen] = useState(false);
  const [createBattleOpen, setCreateBattleOpen] = useState(false);
  const [weaponsArsenalOpen, setWeaponsArsenalOpen] = useState(false);
  const [leaderboardsOpen, setLeaderboardsOpen] = useState(false);
  const [allianceManagementOpen, setAllianceManagementOpen] = useState(false);
  const [viewAllNFTsOpen, setViewAllNFTsOpen] = useState(false);
  const [selectedNFTId, setSelectedNFTId] = useState<string | null>(null);
  const [filteredNFTsForDisplay, setFilteredNFTsForDisplay] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<'power' | 'name' | 'collection'>('power');
  const [collectionFilter, setCollectionFilter] = useState<string>('all');
  
  // Handle query parameters for NFT detail popup
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nftId = params.get('nft_id');
    if (nftId) {
      setSelectedNFTId(nftId);
    }
  }, [location]);

  // Load theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('gaming-theme') as 'light' | 'dark';
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  // Save theme to localStorage
  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('gaming-theme', newTheme);
  };

  // Fetch ALL game NFTs - PUBLIC ENDPOINT (no authentication required)
  const { data: allNftsData, isLoading: nftLoading } = useQuery<any>({
    queryKey: ['/api/inquisition-audit/nfts?limit=5000'], // Fetch all NFTs
    retry: 1,
    retryDelay: 1000,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
  });

  // Fetch single NFT detail when nft_id is in query params
  const { data: selectedNFTData } = useQuery<any>({
    queryKey: [`/api/inquisition-audit/nfts/${selectedNFTId}`],
    enabled: !!selectedNFTId,
    retry: 1,
    retryDelay: 1000,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Fetch player profile data with timeout - ONLY IF LOGGED IN
  const { data: profileData, isLoading: profileLoading, error: profileError } = useQuery<any>({
    queryKey: ['/api/gaming/player/profile'],
    enabled: !!session.handle,
    retry: 1,
    retryDelay: 1000,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
  });

  // Fetch player-specific NFTs - ONLY IF LOGGED IN
  const { data: playerNftData } = useQuery<any>({
    queryKey: [`/api/inquisition-audit/player/nfts?handle=${session.handle}`],
    enabled: !!session.handle,
    retry: 1,
    retryDelay: 1000,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
  });

  // Fetch squadrons with timeout - REDUCED RATE LIMITING
  const { data: squadronsData } = useQuery<any>({
    queryKey: ['/api/squadrons/player'],
    enabled: !!session.handle,
    retry: 1,
    retryDelay: 1000,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
  });

  // Fetch battles with timeout - REDUCED RATE LIMITING
  const { data: battlesData } = useQuery<any>({
    queryKey: ['/api/battles/player'],
    enabled: !!session.handle,
    retry: 1,
    retryDelay: 1000,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
  });

  // Fetch battle stats with timeout - REDUCED RATE LIMITING
  const { data: battleStatsData } = useQuery<any>({
    queryKey: [`/api/battles/player/${session.handle}/history?limit=100`],
    enabled: !!session.handle,
    retry: 1,
    retryDelay: 1000,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
  });

  // Fetch alliance data with timeout - REDUCED RATE LIMITING
  const { data: allianceData } = useQuery<any>({
    queryKey: ['/api/alliances/player'],
    enabled: !!session.handle,
    retry: 1,
    retryDelay: 1000,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
  });

  // Fetch XRP balance with timeout - REDUCED RATE LIMITING
  const { data: balanceData } = useQuery<any>({
    queryKey: ['/api/xrpl/balance'],
    enabled: !!session.isLoggedIn,
    retry: 1,
    retryDelay: 1000,
    staleTime: 2 * 60 * 1000, // 2 minutes for balance (slightly more frequent)
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
  });

  // Fetch enhanced stats with timeout - REDUCED RATE LIMITING
  const { data: enhancedStatsData } = useQuery<any>({
    queryKey: ['/api/gaming/player/enhanced-stats'],
    enabled: !!session.handle,
    retry: 1,
    retryDelay: 1000,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
  });

  // Track initial load time to show timeout message
  const [initialLoadTime] = useState(Date.now());
  const [showTimeoutMessage, setShowTimeoutMessage] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (nftLoading) {
        setShowTimeoutMessage(true);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [nftLoading]);

  // Process and filter all NFTs
  const allNfts = allNftsData?.data || [];
  
  // Apply filters and search
  const filteredNfts = allNfts.filter((nft: any) => {
    // Search filter
    if (searchQuery && !nft.name?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    // Collection filter
    if (collectionFilter !== 'all') {
      const collectionId = parseInt(collectionFilter);
      if (nft.collection_id !== collectionId) {
        return false;
      }
    }
    
    return true;
  });

  // Sort NFTs
  const sortedNfts = [...filteredNfts].sort((a: any, b: any) => {
    switch (sortBy) {
      case 'power':
        return (b.total_points || 0) - (a.total_points || 0);
      case 'name':
        return (a.name || '').localeCompare(b.name || '');
      case 'collection':
        return (a.collection_id || 0) - (b.collection_id || 0);
      default:
        return 0;
    }
  });

  // Get unique collections for filter dropdown
  const uniqueCollections = Array.from(
    new Set(allNfts.map((nft: any) => nft.collection_id))
  ).map(id => {
    const nft = allNfts.find((n: any) => n.collection_id === id);
    return {
      id,
      name: nft?.collection?.collection_name || `Collection ${id}`,
    };
  });

  // Prepare data for logged-in users
  const nftData = playerNftData; // Use player-specific NFTs when logged in
  
  const defaultProfileData = {
    success: true,
    data: {
      player: {
        player_name: session.handle || 'Guest',
        level: 1,
        commander_profile_image: null,
        commander_class: 'Novice',
        play_type: 'Balanced'
      },
      civilization: {
        civilization_name: session.handle ? `${session.handle}'s Kingdom` : 'Guest Kingdom',
        motto: 'Building greatness...',
        crest_image: null,
        military_strength: 0,
        culture_level: 0,
        research_level: 0,
        total_wealth: "0",
        reputation: 0,
        wonders_built: 0
      }
    }
  };

  const activeProfileData = profileData?.success ? profileData : defaultProfileData;

  const powerDistribution = nftData?.data && nftData.data.length > 0
    ? nftData.data.reduce((acc: any, nft: any) => {
        acc.army += Number(nft.army_power || 0);
        acc.religion += Number(nft.religion_power || 0);
        acc.civilization += Number(nft.civilization_power || 0);
        acc.economic += Number(nft.economic_power || 0);
        return acc;
      }, { army: 0, religion: 0, civilization: 0, economic: 0 })
    : { army: 0, religion: 0, civilization: 0, economic: 0 };

  const totalPower = powerDistribution.army + powerDistribution.religion + powerDistribution.civilization + powerDistribution.economic;

  const player = {
    player_name: activeProfileData.data.player.player_name,
    handle: session.handle || '',
    level: activeProfileData.data.player.level,
    commander_profile_image: activeProfileData.data.player.commander_profile_image,
    commander_class: activeProfileData.data.player.commander_class,
    play_type: activeProfileData.data.player.play_type,
    isLoading: profileLoading,
    hasError: !!profileError
  };

  const shouldShowWizard = session.handle && profileData?.success === true && profileData?.data?.civilization === null;
  
  const civilization = (profileData?.success && profileData.data.civilization) ? {
    civilization_name: profileData.data.civilization.civilization_name,
    motto: profileData.data.civilization.motto,
    crest_image: profileData.data.civilization.crest_image,
    military_strength: profileData.data.civilization.military_strength,
    culture_level: profileData.data.civilization.culture_level,
    research_level: profileData.data.civilization.research_level,
    total_wealth: profileData.data.civilization.total_wealth,
    reputation: profileData.data.civilization.reputation,
    wonders_built: profileData.data.civilization.wonders_built,
    isLoading: profileLoading
  } : {
    civilization_name: 'New Civilization',
    motto: 'Your motto here',
    crest_image: null,
    military_strength: 0,
    culture_level: 0,
    research_level: 0,
    total_wealth: '0',
    reputation: 0,
    wonders_built: 0,
    isLoading: profileLoading
  };

  const stats = {
    total_power: totalPower,
    total_battles: battleStatsData?.stats?.total_battles || 0,
    battles_won: battleStatsData?.stats?.battles_won || 0,
    battles_lost: battleStatsData?.stats?.battles_lost || 0,
  };

  const squadrons = squadronsData?.squadrons || [];
  const activeBattles = battlesData?.battles?.filter((b: any) => b.status === 'in_progress') || [];
  const alliance = allianceData?.alliance || null;

  const notifications = [
    { id: '1', message: 'New battle challenge from @warrior123!', type: 'battle' as const, timestamp: new Date().toISOString() },
    { id: '2', message: 'Your squadron gained +50 power!', type: 'system' as const, timestamp: new Date().toISOString() },
  ];

  if (shouldShowWizard && !profileLoading && session.handle) {
    return (
      <div className={`min-h-screen ${theme === 'dark' ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white' : 'bg-gradient-to-br from-gray-50 via-white to-gray-50 text-gray-900'} transition-colors duration-300`}>
        <SetupWizard 
          userHandle={session.handle} 
          onComplete={() => {
            // Wizard will invalidate the query, so no action needed
          }}
        />
      </div>
    );
  }

  // PUBLIC VIEW: Show all game NFTs if user is not logged in
  if (!session.handle) {
    return (
      <div className={`min-h-screen ${theme === 'dark' ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white' : 'bg-gradient-to-br from-gray-50 via-white to-gray-50 text-gray-900'} transition-colors duration-300`}>
        <ActionBar
          notifications={[]}
          xrpBalance="0"
          theme={theme}
          onToggleTheme={toggleTheme}
          onToggleMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
        />

        <div className="container mx-auto px-4 py-6 sm:py-8">
          <div className="mb-6">
            <h1 className={`text-3xl sm:text-4xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              🎮 Inquisition Gaming - All NFTs
            </h1>
            <p className={`text-lg ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
              Browse all NFTs in the Inquisition gaming ecosystem
            </p>
            <Button
              onClick={() => window.location.href = '/wallet-login'}
              className="mt-4 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700"
            >
              Login to Access Your Dashboard
            </Button>
          </div>

          {/* Filters and Search */}
          <div className={`mb-6 p-4 rounded-lg ${theme === 'dark' ? 'bg-slate-800/50 border border-slate-700' : 'bg-white border border-gray-200'}`}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="mb-2 block">Search NFTs</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search by name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <Label className="mb-2 block">Sort By</Label>
                <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="power">Power (Highest)</SelectItem>
                    <SelectItem value="name">Name (A-Z)</SelectItem>
                    <SelectItem value="collection">Collection</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-2 block">Filter by Collection</Label>
                <Select value={collectionFilter} onValueChange={setCollectionFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Collections</SelectItem>
                    {uniqueCollections.map((col: any) => (
                      <SelectItem key={col.id} value={String(col.id)}>{col.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className={`mt-3 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              Showing {sortedNfts.length} of {allNfts.length} NFTs
            </div>
          </div>

          {/* Loading State */}
          {nftLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
              <span className="ml-3 text-lg">Loading NFTs...</span>
            </div>
          )}

          {/* NFT Grid */}
          {!nftLoading && sortedNfts.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {sortedNfts.map((nft: any) => (
                <div
                  key={nft.nft_token_id}
                  onClick={() => setSelectedNFTId(nft.nft_token_id)}
                  className={`${theme === 'dark' ? 'bg-slate-800/50 border-slate-700 hover:border-purple-500' : 'bg-white border-gray-200 hover:border-purple-400'} border rounded-lg p-3 transition-all cursor-pointer hover:scale-105 hover:shadow-lg`}
                >
                  <img
                    src={nft.image_url || getFallbackImage()}
                    alt={nft.name || 'NFT'}
                    className="w-full h-48 object-cover rounded-md mb-3"
                    onError={(e) => {
                      e.currentTarget.src = getFallbackImage();
                    }}
                  />
                  <h5 className={`font-bold text-sm mb-2 truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {nft.name || 'Unnamed NFT'}
                  </h5>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className={`${theme === 'dark' ? 'bg-purple-900/20' : 'bg-purple-50'} rounded px-2 py-1 text-center`}>
                      <p className="text-purple-400 font-bold">⚡ {Number(nft.total_points || 0).toFixed(0)}</p>
                    </div>
                    <div className={`${theme === 'dark' ? 'bg-blue-900/20' : 'bg-blue-50'} rounded px-2 py-1 text-center text-xs`}>
                      <p className="text-blue-400 truncate">{nft.collection?.collection_name || 'Unknown'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!nftLoading && sortedNfts.length === 0 && (
            <div className={`text-center py-12 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              <Shield className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium mb-2">No NFTs Found</p>
              <p className="text-sm">Try adjusting your search or filters</p>
            </div>
          )}
        </div>

        {/* NFT Detail Popup */}
        <Dialog open={!!selectedNFTId} onOpenChange={(open) => !open && setSelectedNFTId(null)}>
          <DialogContent className={`${theme === 'dark' ? 'bg-slate-900 text-white border-purple-500/30' : 'bg-white text-gray-900 border-purple-300'} max-w-4xl md:max-w-5xl lg:max-w-7xl max-h-[90vh] overflow-y-auto`}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-2xl">
                <Shield className="w-6 h-6 text-purple-400" />
                {selectedNFTData?.data?.name || 'NFT Details'}
              </DialogTitle>
              <DialogDescription>
                View detailed information about this NFT
              </DialogDescription>
            </DialogHeader>
            {selectedNFTData?.data && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <img
                      src={selectedNFTData.data.image_url || getFallbackImage()}
                      alt={selectedNFTData.data.name}
                      className="w-full rounded-lg"
                      onError={(e) => {
                        e.currentTarget.src = getFallbackImage();
                      }}
                    />
                  </div>
                  <div className="space-y-4">
                    <div>
                      <h3 className={`text-lg font-bold mb-2 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`}>
                        Power Stats
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div className={`${theme === 'dark' ? 'bg-red-900/20' : 'bg-red-50'} rounded p-3`}>
                          <p className="text-xs text-gray-400 mb-1">Strength</p>
                          <p className="text-red-400 font-bold text-xl">{Number(selectedNFTData.data.power_strength || 0).toFixed(0)}</p>
                        </div>
                        <div className={`${theme === 'dark' ? 'bg-blue-900/20' : 'bg-blue-50'} rounded p-3`}>
                          <p className="text-xs text-gray-400 mb-1">Defense</p>
                          <p className="text-blue-400 font-bold text-xl">{Number(selectedNFTData.data.power_defense || 0).toFixed(0)}</p>
                        </div>
                        <div className={`${theme === 'dark' ? 'bg-purple-900/20' : 'bg-purple-50'} rounded p-3`}>
                          <p className="text-xs text-gray-400 mb-1">Magic</p>
                          <p className="text-purple-400 font-bold text-xl">{Number(selectedNFTData.data.power_magic || 0).toFixed(0)}</p>
                        </div>
                        <div className={`${theme === 'dark' ? 'bg-green-900/20' : 'bg-green-50'} rounded p-3`}>
                          <p className="text-xs text-gray-400 mb-1">Speed</p>
                          <p className="text-green-400 font-bold text-xl">{Number(selectedNFTData.data.power_speed || 0).toFixed(0)}</p>
                        </div>
                      </div>
                      <div className={`${theme === 'dark' ? 'bg-amber-900/20' : 'bg-amber-50'} rounded p-3 mt-3`}>
                        <p className="text-xs text-gray-400 mb-1">Total Power</p>
                        <p className="text-amber-400 font-bold text-2xl">{Number(selectedNFTData.data.total_points || 0).toFixed(0)}</p>
                      </div>
                    </div>
                    <div>
                      <h3 className={`text-lg font-bold mb-2 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>
                        Details
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-gray-400">Collection:</span>
                          <span className="ml-2 font-medium">{selectedNFTData.data.collection?.collection_name || 'Unknown'}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Owner:</span>
                          <span className="ml-2 font-medium text-xs break-all">{selectedNFTData.data.current_owner}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">NFT ID:</span>
                          <span className="ml-2 font-mono text-xs break-all">{selectedNFTData.data.nft_token_id}</span>
                        </div>
                        {selectedNFTData.data.description && (
                          <div>
                            <span className="text-gray-400">Description:</span>
                            <p className="mt-1 text-sm">{selectedNFTData.data.description}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white' : 'bg-gradient-to-br from-gray-50 via-white to-gray-50 text-gray-900'} transition-colors duration-300`}>
      {/* Rendering main dashboard view */}
      
      {/* Action Bar */}
      <ActionBar
        notifications={notifications}
        xrpBalance={balanceData?.balance || "0"}
        theme={theme}
        onToggleTheme={toggleTheme}
        onToggleMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
      />

      {/* Status Banner - Show when data is loading or has errors */}
      {(profileLoading || nftLoading || profileError) && (
        <div className="container mx-auto px-4 pt-4">
          <div className={`rounded-lg p-4 ${
            profileError 
              ? 'bg-yellow-500/10 border border-yellow-500/30' 
              : 'bg-blue-500/10 border border-blue-500/30'
          }`}>
            <div className="flex items-center gap-3">
              {profileLoading || nftLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
              ) : (
                <Shield className="w-5 h-5 text-yellow-400" />
              )}
              <div className="flex-1">
                <p className={`text-sm font-medium ${
                  profileError 
                    ? theme === 'dark' ? 'text-yellow-200' : 'text-yellow-800'
                    : theme === 'dark' ? 'text-blue-200' : 'text-blue-800'
                }`}>
                  {profileError 
                    ? '⚠️ Using default profile data - scanner is still processing your NFTs'
                    : showTimeoutMessage
                    ? '⏳ Loading is taking longer than expected - NFT scanner is processing partner collections'
                    : '🔄 Loading your gaming profile and NFT data...'
                  }
                </p>
                {showTimeoutMessage && !profileError && (
                  <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    Your data will appear automatically when ready. You can use the dashboard with default values in the meantime.
                  </p>
                )}
              </div>
              {showTimeoutMessage && (
                <Button
                  onClick={() => window.location.reload()}
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                >
                  Refresh
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6 sm:py-8">
        {/* Gaming Navigation - Shows all available features */}
        <div className="mb-6">
          <GamingNavigation theme={theme} />
        </div>

        {/* Show welcome message for users without NFTs */}
        {(!nftData?.data || nftData.data.length === 0) && !nftLoading && (
          <div className={`mb-6 p-6 rounded-lg border ${
            theme === 'dark' 
              ? 'bg-purple-900/20 border-purple-500/30 text-purple-300' 
              : 'bg-purple-50 border-purple-300 text-purple-800'
          }`}>
            <h3 className="text-lg font-bold mb-2">🎮 Welcome to Inquisition Gaming!</h3>
            <p className="mb-4">
              You don't have any NFTs yet, but you can still:
            </p>
            <ul className="space-y-2 list-disc list-inside">
              <li>Purchase land and build your empire</li>
              <li>Browse the NFT marketplace</li>
              <li>Join or create alliances</li>
              <li>Explore Riddle City</li>
              <li>Customize your gaming profile</li>
            </ul>
            <div className="mt-4 flex gap-3 flex-wrap">
              <Button 
                onClick={() => window.location.href = '/nft-marketplace'}
                className="bg-gradient-to-r from-purple-500 to-pink-600"
              >
                Browse NFT Marketplace
              </Button>
              <Button 
                onClick={() => window.location.href = '/land-purchase'}
                variant="outline"
                className={theme === 'dark' ? 'border-green-500 text-green-400' : 'border-green-600 text-green-700'}
              >
                Purchase Land
              </Button>
            </div>
          </div>
        )}

        {/* 4-Component Grid Layout - Mobile First */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Component 1: Profile Hub */}
          <div className="lg:col-span-2">
            <ProfileHub
              player={player}
              civilization={civilization}
              stats={stats}
              theme={theme}
              onEditProfile={() => setEditProfileOpen(true)}
              onSyncComplete={() => {
                // Refetch profile and NFT data after successful sync
                window.location.reload(); // Simple reload to refresh all data
              }}
            />
          </div>

          {/* Component 2: Civilization Command or Enhanced Stats */}
          <div>
            <CivilizationCommand
              civilization={civilization}
              theme={theme}
            />
            
            {/* Enhanced Stats Panel - Show if data is available */}
            {enhancedStatsData?.success && (
              <div className="mt-4">
                <EnhancedStatsPanel stats={enhancedStatsData.data} theme={theme} />
              </div>
            )}
            
            {/* RiddleCity Button */}
            <div className="mt-4">
              <Button
                onClick={() => window.location.href = '/riddlecity'}
                className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-semibold py-6"
              >
                <Castle className="w-5 h-5 mr-2" />
                🏰 Upgrade City - Build Your Medieval Empire!
              </Button>
            </div>
          </div>

          {/* Component 3: Army Management */}
          <div>
            <ArmyManagement
              squadrons={squadrons}
              totalNFTs={nftData?.data?.length || 0}
              powerDistribution={powerDistribution}
              theme={theme}
              onCreateSquadron={() => setCreateSquadronOpen(true)}
              onManageWeapons={() => setWeaponsArsenalOpen(true)}
              onViewAllNFTs={() => window.location.href = '/gaming/my-nfts'}
            />
          </div>

          {/* Component 4: War Room */}
          <div className="lg:col-span-2">
            <WarRoom
              activeBattles={activeBattles}
              battleStats={{
                total_battles: stats.total_battles,
                battles_won: stats.battles_won,
                battles_lost: stats.battles_lost,
              }}
              alliance={alliance}
              theme={theme}
              onCreateBattle={() => setCreateBattleOpen(true)}
              onViewLeaderboards={() => setLeaderboardsOpen(true)}
              onManageAlliance={() => setAllianceManagementOpen(true)}
            />
          </div>
        </div>
      </div>

      {/* Modals */}
      <Dialog open={editProfileOpen} onOpenChange={setEditProfileOpen}>
        <DialogContent className={theme === 'dark' ? 'bg-slate-900 text-white border-purple-500/30' : 'bg-white text-gray-900 border-purple-300'}>
          <DialogHeader>
            <DialogTitle>⚙️ Edit Gaming Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-400">Customize your commander and civilization profile</p>
            <Button 
              className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700"
              onClick={() => {
                setEditProfileOpen(false);
                window.location.href = '/edit-gaming-profile';
              }}
            >
              Open Profile Editor
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <SquadronCreationModal
        open={createSquadronOpen}
        onOpenChange={setCreateSquadronOpen}
        nfts={nftData?.data || []}
        theme={theme}
      />

      <Dialog open={weaponsArsenalOpen} onOpenChange={setWeaponsArsenalOpen}>
        <DialogContent className={theme === 'dark' ? 'bg-slate-900 text-white border-orange-500/30' : 'bg-white text-gray-900 border-orange-300'}>
          <DialogHeader>
            <DialogTitle>⚔️ Weapons Arsenal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-400">Manage your weapons from The Lost Emporium collection</p>
            <div className="grid gap-3">
              <Button 
                className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
                onClick={() => {
                  setWeaponsArsenalOpen(false);
                  window.location.href = '/weapons-arsenal';
                }}
              >
                ⚔️ Manage Weapons Arsenal
              </Button>
              <Button 
                variant="outline"
                className="w-full border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                onClick={() => {
                  setWeaponsArsenalOpen(false);
                  window.location.href = '/gaming-nfts';
                }}
              >
                🎨 View All My NFTs
              </Button>
              <Button 
                variant="outline"
                className="w-full border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
                onClick={() => {
                  setWeaponsArsenalOpen(false);
                  window.location.href = '/nft-marketplace?collection=The Lost Emporium';
                }}
              >
                🛒 Browse Marketplace
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <BattleCreationModal
        open={createBattleOpen}
        onOpenChange={setCreateBattleOpen}
        squadrons={squadrons}
        theme={theme}
      />

      <Dialog open={leaderboardsOpen} onOpenChange={setLeaderboardsOpen}>
        <DialogContent className={theme === 'dark' ? 'bg-slate-900 text-white border-amber-500/30' : 'bg-white text-gray-900 border-amber-300'}>
          <DialogHeader>
            <DialogTitle>🏆 Global Leaderboards</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-400">View rankings for players, alliances, and civilizations</p>
            <div className="grid gap-3">
              <Button 
                className="w-full bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700"
                onClick={() => {
                  setLeaderboardsOpen(false);
                  window.location.href = '/inquisition-gaming#leaderboards';
                }}
              >
                👤 Player Leaderboards
              </Button>
              <Button 
                variant="outline"
                className="w-full border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
                onClick={() => {
                  setLeaderboardsOpen(false);
                  window.location.href = '/inquisition-gaming#alliances';
                }}
              >
                🛡️ Alliance Rankings
              </Button>
              <Button 
                variant="outline"
                className="w-full border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                onClick={() => {
                  setLeaderboardsOpen(false);
                  window.location.href = '/inquisition-gaming#battles';
                }}
              >
                ⚔️ Battle History
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={allianceManagementOpen} onOpenChange={setAllianceManagementOpen}>
        <DialogContent className={theme === 'dark' ? 'bg-slate-900 text-white border-purple-500/30' : 'bg-white text-gray-900 border-purple-300'}>
          <DialogHeader>
            <DialogTitle>🛡️ Alliance Management</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              {alliance ? `Managing ${alliance.alliance_name}` : 'Join or create an alliance to dominate the battlefield'}
            </p>
            <div className="grid gap-3">
              {alliance ? (
                <>
                  <Button 
                    className="w-full bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700"
                    onClick={() => {
                      setAllianceManagementOpen(false);
                      window.location.href = '/inquisition-alliances';
                    }}
                  >
                    ⚙️ Manage My Alliance
                  </Button>
                  <Button 
                    variant="outline"
                    className="w-full border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                    onClick={() => {
                      setAllianceManagementOpen(false);
                      window.location.href = '/inquisition-alliances?tab=treasury';
                    }}
                  >
                    💰 Alliance Treasury
                  </Button>
                </>
              ) : (
                <>
                  <Button 
                    className="w-full bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700"
                    onClick={() => {
                      setAllianceManagementOpen(false);
                      window.location.href = '/inquisition-alliances?action=create';
                    }}
                  >
                    ✨ Create New Alliance
                  </Button>
                  <Button 
                    variant="outline"
                    className="w-full border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
                    onClick={() => {
                      setAllianceManagementOpen(false);
                      window.location.href = '/inquisition-alliances';
                    }}
                  >
                    🔍 Browse Alliances
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={viewAllNFTsOpen} onOpenChange={setViewAllNFTsOpen}>
        <DialogContent className={`${theme === 'dark' ? 'bg-slate-900 text-white border-red-500/30' : 'bg-white text-gray-900 border-red-300'} max-w-4xl md:max-w-5xl lg:max-w-7xl max-h-[85vh]`}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-red-400" />
              All My NFTs ({nftData?.data?.length || 0})
            </DialogTitle>
          </DialogHeader>
          
          {/* NFT Collection Filter */}
          {nftData?.data && nftData.data.length > 0 && (
            <div className="px-1 mb-2">
              <NFTCollectionDropdown
                nfts={nftData.data}
                onFilterChange={setFilteredNFTsForDisplay}
                theme={theme}
                showLabel={true}
                persistKey="dashboard-nft-collection-filter"
              />
            </div>
          )}

          <div className="space-y-6 overflow-y-auto max-h-[60vh] pr-2">
            {!nftData?.data || nftData.data.length === 0 ? (
              <div className={`text-center py-12 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                <Shield className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium mb-2">No NFTs Found</p>
                <p className="text-sm">You don't own any Inquisition NFTs yet</p>
                <Button 
                  className="mt-4 bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700"
                  onClick={() => {
                    setViewAllNFTsOpen(false);
                    window.location.href = '/nft-marketplace';
                  }}
                >
                  Browse NFT Marketplace
                </Button>
              </div>
            ) : (
              <>
                {/* INQUISITION COLLECTIONS */}
                {(() => {
                  // Use filtered NFTs from dropdown if available, otherwise show all
                  const displayNFTs = filteredNFTsForDisplay.length > 0 ? filteredNFTsForDisplay : nftData.data;
                  const inquisitionCollections = ['The Inquisition', 'Under the Bridge: Troll', 'The Lost Emporium', 'The Inquiry', 'DANTES AURUM'];
                  const inquisitionNFTs = displayNFTs.filter((nft: any) => 
                    inquisitionCollections.includes(nft.collection_name)
                  );
                  
                  if (inquisitionNFTs.length === 0) return null;
                  
                  // Group by collection
                  const grouped: Record<string, any[]> = {};
                  inquisitionNFTs.forEach((nft: any) => {
                    if (!grouped[nft.collection_name]) {
                      grouped[nft.collection_name] = [];
                    }
                    grouped[nft.collection_name].push(nft);
                  });
                  
                  return (
                    <div>
                      <h3 className={`text-lg font-bold mb-4 pb-2 border-b ${theme === 'dark' ? 'text-orange-400 border-orange-500/30' : 'text-orange-600 border-orange-300'}`}>
                        🎮 Inquisition Collections ({inquisitionNFTs.length})
                      </h3>
                      <div className="space-y-6">
                        {Object.entries(grouped).map(([collectionName, nfts]) => (
                          <div key={collectionName}>
                            <h4 className={`text-md font-semibold mb-3 ${theme === 'dark' ? 'text-red-300' : 'text-red-700'}`}>
                              {collectionName} ({nfts.length})
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                              {nfts.map((nft: any) => (
                                <div
                                  key={nft.nft_id}
                                  onClick={() => window.location.href = `/inquisition-gaming?nft_id=${nft.nft_id}`}
                                  className={`${theme === 'dark' ? 'bg-slate-800/50 border-slate-700 hover:border-red-500' : 'bg-gray-50 border-gray-200 hover:border-red-400'} border rounded-lg p-2 transition-all cursor-pointer hover:scale-105`}
                                >
                                  <img 
                                    src={normalizeNftImage({ image_url: nft.image_url }) || getFallbackImage()} 
                                    alt={nft.name || 'NFT'} 
                                    className="w-full h-32 object-cover rounded-md mb-2"
                                    onError={(e) => {
                                      e.currentTarget.src = getFallbackImage();
                                    }}
                                  />
                                  <h5 className={`font-semibold text-xs mb-1 truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                    {nft.name || 'Unnamed NFT'}
                                  </h5>
                                  <div className="grid grid-cols-2 gap-1 text-xs">
                                    <div className={`${theme === 'dark' ? 'bg-red-900/20' : 'bg-red-50'} rounded px-1 py-0.5 text-center`}>
                                      <p className="text-red-400 font-bold">{Number(nft.army_power || 0).toFixed(0)}</p>
                                    </div>
                                    <div className={`${theme === 'dark' ? 'bg-purple-900/20' : 'bg-purple-50'} rounded px-1 py-0.5 text-center`}>
                                      <p className="text-purple-400 font-bold">{Number(nft.religion_power || 0).toFixed(0)}</p>
                                    </div>
                                    <div className={`${theme === 'dark' ? 'bg-blue-900/20' : 'bg-blue-50'} rounded px-1 py-0.5 text-center`}>
                                      <p className="text-blue-400 font-bold">{Number(nft.civilization_power || 0).toFixed(0)}</p>
                                    </div>
                                    <div className={`${theme === 'dark' ? 'bg-green-900/20' : 'bg-green-50'} rounded px-1 py-0.5 text-center`}>
                                      <p className="text-green-400 font-bold">{Number(nft.economic_power || 0).toFixed(0)}</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* PARTNER NFTs */}
                {(() => {
                  const inquisitionCollections = ['The Inquisition', 'Under the Bridge: Troll', 'The Lost Emporium', 'The Inquiry'];
                  const partnerNFTs = nftData.data.filter((nft: any) => 
                    !inquisitionCollections.includes(nft.collection_name)
                  );
                  
                  if (partnerNFTs.length === 0) return null;
                  
                  // Group by collection
                  const grouped: Record<string, any[]> = {};
                  partnerNFTs.forEach((nft: any) => {
                    const collectionName = nft.collection_name || 'Unknown Collection';
                    if (!grouped[collectionName]) {
                      grouped[collectionName] = [];
                    }
                    grouped[collectionName].push(nft);
                  });
                  
                  return (
                    <div>
                      <h3 className={`text-lg font-bold mb-4 pb-2 border-b ${theme === 'dark' ? 'text-blue-400 border-blue-500/30' : 'text-blue-600 border-blue-300'}`}>
                        🤝 Partner NFTs ({partnerNFTs.length})
                      </h3>
                      <div className="space-y-6">
                        {Object.entries(grouped).map(([collectionName, nfts]) => (
                          <div key={collectionName}>
                            <h4 className={`text-md font-semibold mb-3 ${theme === 'dark' ? 'text-blue-300' : 'text-blue-700'}`}>
                              {collectionName} ({nfts.length})
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                              {nfts.map((nft: any) => (
                                <div
                                  key={nft.nft_id}
                                  onClick={() => window.location.href = `/gaming/nft-detail/${nft.nft_id}`}
                                  className={`${theme === 'dark' ? 'bg-slate-800/50 border-slate-700 hover:border-blue-500' : 'bg-gray-50 border-gray-200 hover:border-blue-400'} border rounded-lg p-2 transition-all cursor-pointer hover:scale-105`}
                                >
                                  <img 
                                    src={normalizeNftImage({ image_url: nft.image_url }) || getFallbackImage()} 
                                    alt={nft.name || 'NFT'} 
                                    className="w-full h-32 object-cover rounded-md mb-2"
                                    onError={(e) => {
                                      e.currentTarget.src = getFallbackImage();
                                    }}
                                  />
                                  <h5 className={`font-semibold text-xs mb-1 truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                    {nft.name || 'Unnamed NFT'}
                                  </h5>
                                  <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'} truncate`}>
                                    NFT ID: {nft.nft_id?.slice(0, 8)}...
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Session Renewal Modal */}
      <SessionRenewalModal 
        open={showRenewalModal} 
        onOpenChange={setShowRenewalModal}
      />
    </div>
  );
}
