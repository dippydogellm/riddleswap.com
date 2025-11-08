import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Shield, 
  Trophy, 
  Swords,
  Target,
  Zap,
  Heart,
  Sparkles,
  Search,
  ArrowLeft,
  Crown,
  RefreshCw,
  Upload,
  Camera,
  Edit,
  Save,
  X,
  ExternalLink,
  Filter,
  ArrowUpDown
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSession } from "@/utils/sessionManager";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { InquisitionNFTCard, InquisitionNFT } from "@/components/inquisition-nft-card";
import { BackButton } from "@/components/gaming/BackButton";

interface NFT {
  nft_id: string; // Changed from id to match API
  name: string;
  description: string;
  image_url: string;
  collection_name: string; // Changed from collection_id
  game_role: string;
  rarity_score: string; // Comes as string from DB
  owned_at: string;
  total_power: number | null;
  army_power: number | null;
  religion_power: number | null;
  civilization_power: number | null;
  economic_power: number | null;
  
  // Computed fields for compatibility
  id?: number;
  nft_token_id?: string;
  collection_id?: number;
  total_points?: number;
  power_strength?: number;
  power_defense?: number;
  power_magic?: number;
  power_speed?: number;
  traits?: Record<string, any>;
}

interface UserProfile {
  wallet_address: string;
  total_nfts: number;
  total_points: number;
  nfts: NFT[];
}

const InquisitionProfile = () => {
  const session = useSession();
  const [searchQuery, setSearchQuery] = useState("");
  const [collectionFilter, setCollectionFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"power" | "name" | "recent">("power");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [displayName, setDisplayName] = useState(session.walletData?.username || session.walletData?.handle || "");
  const [bio, setBio] = useState("");
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);
  const [selectedNFT, setSelectedNFT] = useState<NFT | null>(null);
  
  const profileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Helper function to extract token number from image URL
  const getTokenNumber = (imageUrl: string): string => {
    const match = imageUrl.match(/\/(\d+)\.png/);
    return match ? match[1] : 'Unknown';
  };

  // Helper function to get NFT display name
  const getNFTName = (nft: NFT): string => {
    if (nft.name && !nft.name.includes('undefined')) {
      return nft.name;
    }
    const tokenNumber = getTokenNumber(nft.image_url);
    return `The Inquisition #${tokenNumber}`;
  };

  // Fetch user's complete NFT profile from gaming API
  const { data: nftsData, isLoading: profileLoading, error: nftError } = useQuery<NFT[]>({
    queryKey: session.walletData?.handle 
      ? [`/api/gaming/player/nfts?user_handle=${session.walletData.handle}`]
      : ['no-wallet'],
    enabled: !!session.walletData?.handle,
    retry: 2,
    staleTime: 30000, // Cache for 30 seconds
  });

  // Log NFT loading state for debugging
  console.log('🎮 [Inquisition Profile] NFT Loading State:', {
    isLoading: profileLoading,
    hasData: !!nftsData,
    nftCount: nftsData?.length || 0,
    error: nftError,
    handle: session.walletData?.handle
  });

  // Transform the NFT data to match the expected profile format
  const profile: UserProfile | undefined = nftsData ? {
    wallet_address: session.walletData?.addresses?.xrpAddress || '',
    total_nfts: nftsData.length,
    total_points: nftsData.reduce((sum, nft) => {
      const power = nft.total_power ?? parseFloat(nft.rarity_score);
      return sum + (Number.isFinite(power) ? power : 0);
    }, 0),
    nfts: nftsData.map(nft => ({
      ...nft,
      id: 0, // Placeholder
      nft_token_id: nft.nft_id,
      total_points: parseFloat(nft.rarity_score) || 0,
      power_strength: nft.army_power || 0,
      power_defense: nft.civilization_power || 0,
      power_magic: nft.religion_power || 0,
      power_speed: nft.economic_power || 0,
      collection_id: 0 // Placeholder
    }))
  } : undefined;

  // Fetch leaderboard for rank
  const { data: leaderboardData } = useQuery<{ success: boolean; data: any[] }>({
    queryKey: ['/api/inquisition-audit/leaderboard?limit=100'],
  });

  const userRank = profile && leaderboardData?.data
    ? leaderboardData.data.findIndex(entry => entry.wallet_address === session.walletData?.addresses?.xrpAddress) + 1
    : null;

  // Upload profile photo mutation
  const uploadProfilePhotoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'profile');
      
      // Get session token from session object (which is already available)
      const sessionToken = session.sessionToken || session.token;
      console.log('📸 [PHOTO UPLOAD] Session token present:', !!sessionToken);
      
      const response = await fetch('/api/upload-photo', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken || ''}`,
        },
        body: formData,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('📸 [PHOTO UPLOAD] Upload failed:', response.status, errorText);
        throw new Error('Failed to upload profile photo');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: "Success", description: "Profile photo updated!" });
      setProfileImagePreview(null);
      queryClient.invalidateQueries({ queryKey: ['/api/social/profile'] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to upload profile photo", 
        variant: "destructive" 
      });
    },
  });

  // Upload cover photo mutation
  const uploadCoverPhotoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'cover');
      
      // Get session token from session object
      const sessionToken = session.sessionToken || session.token;
      const response = await fetch('/api/upload-photo', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken || ''}`,
        },
        body: formData,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('📸 [PHOTO UPLOAD] Upload failed:', response.status, errorText);
        throw new Error('Failed to upload cover photo');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: "Success", description: "Cover photo updated!" });
      setCoverImagePreview(null);
      queryClient.invalidateQueries({ queryKey: ['/api/social/profile'] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to upload cover photo", 
        variant: "destructive" 
      });
    },
  });

  // Generate NFT image mutation
  const generateImageMutation = useMutation({
    mutationFn: async (nftId: string) => {
      // Get session token from session object
      const sessionToken = session.sessionToken || session.token;
      const response = await fetch(`/api/gaming/generate-player-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken || ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nft_id: nftId }),
      });
      if (!response.ok) throw new Error('Failed to generate image');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "New image generated and saved permanently!" });
      queryClient.invalidateQueries({ queryKey: [`/api/gaming/player/nfts?user_handle=${session.walletData?.handle}`] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate image", variant: "destructive" });
    },
  });

  // Handle file selection for profile photo
  const handleProfilePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Show preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      
      // Upload immediately
      uploadProfilePhotoMutation.mutate(file);
    }
  };

  // Handle file selection for cover photo
  const handleCoverPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Show preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      
      // Upload immediately
      uploadCoverPhotoMutation.mutate(file);
    }
  };

  // Get unique collections for filter dropdown
  const collections = profile?.nfts 
    ? Array.from(new Set(profile.nfts.map(nft => nft.collection_name))).sort()
    : [];

  // Filter and sort NFTs
  const filteredNfts = (profile?.nfts || [])
    .filter(nft => {
      // Search filter
      const matchesSearch = searchQuery === "" || 
        nft.name?.toLowerCase()?.includes(searchQuery.toLowerCase()) ||
        nft.nft_id?.includes(searchQuery) ||
        getNFTName(nft).toLowerCase().includes(searchQuery.toLowerCase());
      
      // Collection filter
      const matchesCollection = collectionFilter === "all" || 
        nft.collection_name === collectionFilter;
      
      return matchesSearch && matchesCollection;
    })
    .sort((a, b) => {
      if (sortBy === "power") {
        const powerA = a.total_power ?? parseFloat(a.rarity_score);
        const powerB = b.total_power ?? parseFloat(b.rarity_score);
        const validA = Number.isFinite(powerA) ? powerA : 0;
        const validB = Number.isFinite(powerB) ? powerB : 0;
        return validB - validA; // Highest power first
      } else if (sortBy === "name") {
        return getNFTName(a).localeCompare(getNFTName(b));
      } else if (sortBy === "recent") {
        return new Date(b.owned_at).getTime() - new Date(a.owned_at).getTime();
      }
      return 0;
    });

  if (!session.isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Card className="bg-slate-900 border-purple-600 border-2 max-w-md">
          <CardContent className="text-center py-12 space-y-4">
            <Shield className="w-16 h-16 text-slate-600 mx-auto" />
            <h2 className="text-2xl font-bold text-white">Login Required</h2>
            <p className="text-slate-400">You need to login to view your profile</p>
            <Link href="/login">
              <Button className="bg-purple-600 hover:bg-purple-700">
                Login Now
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="bg-slate-900 border-b-2 border-purple-600">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <BackButton to="/inquisition" label="Back to Dashboard" theme="dark" />
              <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                  <Shield className="w-8 h-8 text-purple-500" />
                  {session.walletData?.handle || 'Warrior Profile'}
                </h1>
                <p className="text-slate-400 text-sm mt-1 font-mono">
                  {session.walletData?.addresses?.xrpAddress?.slice(0, 12)}...{session.walletData?.addresses?.xrpAddress?.slice(-8)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Editor Section */}
      <div className="container mx-auto px-4 py-6">
        <Card className="bg-slate-900 border-2 border-purple-600 mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-purple-400 flex items-center gap-2">
                <Edit className="w-5 h-5" />
                Profile Settings
              </CardTitle>
              <Button
                variant={isEditingProfile ? "outline" : "default"}
                size="sm"
                onClick={() => setIsEditingProfile(!isEditingProfile)}
                className={isEditingProfile ? "border-purple-600" : "bg-purple-600 hover:bg-purple-700"}
              >
                {isEditingProfile ? (
                  <>
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </>
                ) : (
                  <>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Profile
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          {isEditingProfile && (
            <CardContent className="space-y-6">
              {/* Display Name */}
              <div>
                <label className="block text-sm font-bold text-purple-300 mb-2">
                  Display Name
                </label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your display name"
                  className="bg-slate-800 border-2 border-purple-600 text-white"
                />
              </div>

              {/* Bio */}
              <div>
                <label className="block text-sm font-bold text-purple-300 mb-2">
                  Bio
                </label>
                <Textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell us about yourself..."
                  rows={3}
                  className="bg-slate-800 border-2 border-purple-600 text-white resize-none"
                />
              </div>

              {/* Profile Picture Upload */}
              <div>
                <label className="block text-sm font-bold text-purple-300 mb-2">
                  Profile Picture
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 rounded-full bg-slate-800 border-2 border-purple-600 flex items-center justify-center overflow-hidden">
                    {profileImagePreview ? (
                      <img src={profileImagePreview} alt="Profile preview" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-8 h-8 text-purple-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      ref={profileInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                      onChange={handleProfilePhotoChange}
                      className="hidden"
                    />
                    <Button
                      onClick={() => profileInputRef.current?.click()}
                      disabled={uploadProfilePhotoMutation.isPending}
                      className="bg-purple-600 hover:bg-purple-700 w-full"
                    >
                      {uploadProfilePhotoMutation.isPending ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Upload Profile Picture
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-slate-400 mt-2">
                      JPG, PNG, GIF, or WEBP • Max 10MB
                    </p>
                  </div>
                </div>
              </div>

              {/* Cover Photo Upload */}
              <div>
                <label className="block text-sm font-bold text-purple-300 mb-2">
                  Cover Photo
                </label>
                <div className="space-y-4">
                  <div className="w-full h-32 rounded-lg bg-slate-800 border-2 border-purple-600 flex items-center justify-center overflow-hidden">
                    {coverImagePreview ? (
                      <img src={coverImagePreview} alt="Cover preview" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-8 h-8 text-purple-400" />
                    )}
                  </div>
                  <div>
                    <input
                      ref={coverInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                      onChange={handleCoverPhotoChange}
                      className="hidden"
                    />
                    <Button
                      onClick={() => coverInputRef.current?.click()}
                      disabled={uploadCoverPhotoMutation.isPending}
                      className="bg-purple-600 hover:bg-purple-700 w-full"
                    >
                      {uploadCoverPhotoMutation.isPending ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Upload Cover Photo
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-slate-400 mt-2">
                      JPG, PNG, GIF, or WEBP • Max 10MB • Recommended: 1500x500px
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      {/* Profile Stats */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-purple-900 border-2 border-purple-600">
            <CardContent className="p-6 text-center">
              <Shield className="w-8 h-8 text-purple-300 mx-auto mb-2" />
              <div className="text-3xl font-bold text-purple-300">
                {profileLoading ? "..." : profile?.total_nfts || 0}
              </div>
              <div className="text-sm text-slate-300 mt-1">NFTs Owned</div>
            </CardContent>
          </Card>

          <Card className="bg-amber-900 border-2 border-amber-600">
            <CardContent className="p-6 text-center">
              <Sparkles className="w-8 h-8 text-amber-300 mx-auto mb-2" />
              <div className="text-3xl font-bold text-amber-300">
                {profileLoading ? "..." : (profile?.total_points || 0).toLocaleString()}
              </div>
              <div className="text-sm text-slate-300 mt-1">Total Power</div>
            </CardContent>
          </Card>

          <Card className="bg-green-900 border-2 border-green-600">
            <CardContent className="p-6 text-center">
              <Trophy className="w-8 h-8 text-green-300 mx-auto mb-2" />
              <div className="text-3xl font-bold text-green-300">
                {userRank ? `#${userRank}` : 'Unranked'}
              </div>
              <div className="text-sm text-slate-300 mt-1">Global Rank</div>
            </CardContent>
          </Card>

          <Card className="bg-blue-900 border-2 border-blue-600">
            <CardContent className="p-6 text-center">
              <Crown className="w-8 h-8 text-blue-300 mx-auto mb-2" />
              <div className="text-3xl font-bold text-blue-300">
                {profile?.nfts ? new Set(profile.nfts.map(n => n.collection_name)).size : 0}
              </div>
              <div className="text-sm text-slate-300 mt-1">Collections</div>
            </CardContent>
          </Card>
        </div>

        {/* NFT Gallery */}
        <Card className="bg-slate-900 border-2 border-purple-600">
          <CardHeader>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-purple-400 flex items-center gap-2">
                  <Swords className="w-6 h-6" />
                  Your NFT Army ({filteredNfts.length})
                </CardTitle>
              </div>
              
              {/* Filters and Search Row */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Collection Filter */}
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-purple-400" />
                  <Select value={collectionFilter} onValueChange={setCollectionFilter}>
                    <SelectTrigger className="w-[200px] bg-slate-800 border-2 border-purple-600 text-white">
                      <SelectValue placeholder="All Collections" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-2 border-purple-600">
                      <SelectItem value="all" className="text-white hover:bg-purple-600">All Collections</SelectItem>
                      {collections.map(collection => (
                        <SelectItem key={collection} value={collection} className="text-white hover:bg-purple-600">
                          {collection}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Sort By */}
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="w-4 h-4 text-purple-400" />
                  <Select value={sortBy} onValueChange={(value: "power" | "name" | "recent") => setSortBy(value)}>
                    <SelectTrigger className="w-[180px] bg-slate-800 border-2 border-purple-600 text-white">
                      <SelectValue placeholder="Sort By" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-2 border-purple-600">
                      <SelectItem value="power" className="text-white hover:bg-purple-600">Highest Power</SelectItem>
                      <SelectItem value="name" className="text-white hover:bg-purple-600">Name (A-Z)</SelectItem>
                      <SelectItem value="recent" className="text-white hover:bg-purple-600">Recently Added</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search NFTs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-slate-800 border-2 border-purple-600 text-white w-full"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {profileLoading ? (
              <div className="text-center py-12 space-y-4">
                <RefreshCw className="w-12 h-12 text-purple-500 mx-auto animate-spin" />
                <div className="text-slate-400">
                  <p className="font-bold">Scanning blockchain for your NFTs...</p>
                  <p className="text-sm mt-2">This may take a few moments</p>
                </div>
              </div>
            ) : nftError ? (
              <div className="text-center py-12 space-y-4">
                <Shield className="w-16 h-16 text-red-500 mx-auto" />
                <div className="text-slate-400">
                  <p className="font-bold text-red-400">Failed to load NFTs</p>
                  <p className="text-sm mt-2">{(nftError as any)?.message || 'Unknown error occurred'}</p>
                  <Button 
                    onClick={() => queryClient.invalidateQueries({ queryKey: [`/api/gaming/player/nfts?user_handle=${session.walletData?.handle}`] })}
                    className="bg-purple-600 hover:bg-purple-700 mt-4"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Try Again
                  </Button>
                </div>
              </div>
            ) : filteredNfts.length > 0 ? (
              <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredNfts.map((nft) => (
                  <InquisitionNFTCard
                    key={nft.nft_id}
                    nft={nft as InquisitionNFT}
                    onClick={() => setSelectedNFT(nft)}
                    showPowerBars={true}
                    compact={false}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 space-y-4">
                <Shield className="w-16 h-16 text-slate-600 mx-auto" />
                <p className="text-slate-400">
                  {searchQuery ? "No NFTs match your search" : "You don't own any Inquisition NFTs yet"}
                </p>
                {!searchQuery && (
                  <Link href="/nft-marketplace">
                    <Button className="bg-purple-600 hover:bg-purple-700 font-bold">
                      Browse Marketplace
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* NFT Details Modal */}
      {selectedNFT && (
        <Dialog open={!!selectedNFT} onOpenChange={() => setSelectedNFT(null)}>
          <DialogContent className="bg-slate-900 border-2 border-purple-600 text-white max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-purple-400">
                {getNFTName(selectedNFT)}
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                {selectedNFT.collection_name}
              </DialogDescription>
            </DialogHeader>

            <div className="grid md:grid-cols-2 gap-6">
              {/* NFT Image */}
              <div className="space-y-4">
                <div className="rounded-lg overflow-hidden border-2 border-purple-600">
                  <img 
                    src={selectedNFT.image_url.replace('ipfs://', 'https://ipfs.io/ipfs/')} 
                    alt={getNFTName(selectedNFT)}
                    className="w-full h-auto"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => generateImageMutation.mutate(selectedNFT.nft_id)}
                    disabled={generateImageMutation.isPending}
                    className="flex-1 bg-purple-600 hover:bg-purple-700"
                  >
                    {generateImageMutation.isPending ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate New Image
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    className="border-2 border-purple-600 hover:bg-purple-600"
                    onClick={() => window.open(selectedNFT.image_url.replace('ipfs://', 'https://ipfs.io/ipfs/'), '_blank')}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* NFT Details */}
              <div className="space-y-4">
                {/* Total Power */}
                <div className="bg-gradient-to-br from-amber-900/50 to-amber-800/50 border-2 border-amber-600 rounded-lg p-4">
                  <div className="text-sm text-amber-300 mb-1">Total Power</div>
                  <div className="text-3xl font-bold text-amber-400">
                    {selectedNFT.total_power || selectedNFT.total_points}
                  </div>
                </div>

                {/* Power Breakdown */}
                <div className="space-y-2">
                  <div className="text-sm font-bold text-purple-400 mb-2">Power Attributes</div>
                  
                  <div className="flex items-center justify-between bg-red-950 border border-red-800 rounded p-3">
                    <div className="flex items-center gap-2">
                      <Swords className="w-5 h-5 text-red-500" />
                      <span className="font-semibold text-red-400">Army Power</span>
                    </div>
                    <span className="text-xl font-bold text-red-500">
                      {selectedNFT.army_power || selectedNFT.power_strength || 0}
                    </span>
                  </div>

                  <div className="flex items-center justify-between bg-blue-950 border border-blue-800 rounded p-3">
                    <div className="flex items-center gap-2">
                      <Shield className="w-5 h-5 text-blue-500" />
                      <span className="font-semibold text-blue-400">Civilization</span>
                    </div>
                    <span className="text-xl font-bold text-blue-500">
                      {selectedNFT.civilization_power || selectedNFT.power_defense || 0}
                    </span>
                  </div>

                  <div className="flex items-center justify-between bg-purple-950 border border-purple-800 rounded p-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-purple-500" />
                      <span className="font-semibold text-purple-400">Religion</span>
                    </div>
                    <span className="text-xl font-bold text-purple-500">
                      {selectedNFT.religion_power || selectedNFT.power_magic || 0}
                    </span>
                  </div>

                  <div className="flex items-center justify-between bg-green-950 border border-green-800 rounded p-3">
                    <div className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-green-500" />
                      <span className="font-semibold text-green-400">Economic</span>
                    </div>
                    <span className="text-xl font-bold text-green-500">
                      {selectedNFT.economic_power || selectedNFT.power_speed || 0}
                    </span>
                  </div>
                </div>

                {/* NFT ID */}
                <div className="bg-slate-800 border border-slate-700 rounded p-3">
                  <div className="text-xs text-slate-400 mb-1">NFT Token ID</div>
                  <code className="text-xs text-purple-400 break-all">
                    {selectedNFT.nft_id}
                  </code>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <Button
                    className="bg-purple-600 hover:bg-purple-700"
                    onClick={() => {
                      // Navigate to NFT marketplace or details page
                      toast({ title: "Feature Coming Soon", description: "NFT trading will be available soon!" });
                    }}
                  >
                    <Trophy className="w-4 h-4 mr-2" />
                    Use in Battle
                  </Button>
                  <Button
                    variant="outline"
                    className="border-2 border-purple-600 hover:bg-purple-600"
                    onClick={() => setSelectedNFT(null)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default InquisitionProfile;
