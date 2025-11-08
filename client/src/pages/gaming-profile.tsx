import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  User, 
  Castle, 
  Camera, 
  Wand2, 
  Crown, 
  Shield, 
  Palette, 
  Scroll,
  Upload,
  Eye,
  Save,
  RefreshCw,
  Edit,
  Loader2,
  Scan,
  Search,
  Users,
  Handshake,
  ArrowLeft,
  Heart,
  Star,
  Zap,
  Target
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "@/utils/sessionManager";
import { BackButton } from "@/components/gaming/BackButton";

// Validation schemas
const profileSchema = z.object({
  player_name: z.string().min(1, "Player name required").max(50, "Name too long"),
  commander_class: z.enum(["warrior", "mage", "rogue", "paladin"], {
    errorMap: () => ({ message: "Please select a commander class" })
  }),
  religion: z.enum(["Christianity", "Islam", "Buddhism", "Hinduism", "Paganism", "Secular"], {
    errorMap: () => ({ message: "Please select a religion" })
  })
});

interface GamingProfile {
  id: string;
  user_handle: string;
  player_name?: string;
  commander_class?: string;
  religion?: string;
  commander_profile_image?: string;
  crest_image?: string;
  total_power_level: number;
  gaming_rank: string;
  army_power: number;
  religion_power: number;
  civilization_power: number;
  economic_power: number;
  total_nfts_owned: number;
  is_gaming_verified: boolean;
  verification_completed_at?: string;
  created_at: string;
  updated_at: string;
}

interface OtherPlayer {
  user_handle: string;
  player_name?: string;
  total_power_level: number;
  gaming_rank: string;
  commander_profile_image?: string;
  is_gaming_verified: boolean;
}

export default function GamingProfile() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const crestInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadType, setUploadType] = useState<'commander' | 'crest'>('commander');
  const [searchQuery, setSearchQuery] = useState("");
  const [showPlayerSearch, setShowPlayerSearch] = useState(false);
  
  const { isLoggedIn, handle } = useSession();

  // Fetch gaming profile with auto-refresh for new images
  const { data: profile, isLoading: profileLoading, refetch: refetchProfile } = useQuery<GamingProfile>({
    queryKey: ['/api/gaming/player/profile'],
    enabled: isLoggedIn && !!handle,
    refetchInterval: 10000, // Auto-refresh every 10 seconds to check for new images
    refetchIntervalInBackground: false, // Only refetch when tab is active
  });

  // Fetch other players for search
  const { data: otherPlayers = [], isLoading: playersLoading } = useQuery<OtherPlayer[]>({
    queryKey: ['/api/nft-gaming/riddle-wallet-users'],
    enabled: showPlayerSearch
  });

  // Profile form
  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      player_name: profile?.player_name || "",
      commander_class: (profile?.commander_class as any) || "warrior",
      religion: (profile?.religion as any) || "Christianity"
    }
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: z.infer<typeof profileSchema>) => {
      return apiRequest('/api/gaming/player/profile', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "Your gaming profile has been updated successfully!"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/gaming/player/profile'] });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update profile",
        variant: "destructive"
      });
    }
  });

  // Rescan NFTs mutation
  const rescanMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/gaming/rescan-nfts', {
        method: 'POST'
      });
    },
    onSuccess: () => {
      toast({
        title: "NFT Rescan Complete",
        description: "Your NFTs have been rescanned and power levels updated!"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/gaming/player/profile'] });
      refetchProfile();
    },
    onError: (error: any) => {
      toast({
        title: "Rescan Failed",
        description: error.message || "Failed to rescan NFTs",
        variant: "destructive"
      });
    }
  });

  // Image upload handler
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please select an image file",
        variant: "destructive"
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File Too Large", 
        description: "Image must be smaller than 10MB",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);

    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Data = reader.result as string;
        
        // Update gaming profile image
        const updateData = uploadType === 'commander' 
          ? { commander_profile_image: base64Data }
          : { crest_image: base64Data };

        const response = await apiRequest('/api/gaming/player/images', {
          method: 'PUT',
          body: JSON.stringify(updateData)
        });

        toast({
          title: "Image Uploaded",
          description: `${uploadType === 'commander' ? 'Profile' : 'Crest'} image updated successfully!`
        });

        queryClient.invalidateQueries({ queryKey: ['/api/gaming/player/profile'] });
        setIsUploading(false);
      };
      
      reader.readAsDataURL(file);
    } catch (error: any) {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload image",
        variant: "destructive"
      });
      setIsUploading(false);
    }
  };

  const onSubmit = (data: z.infer<typeof profileSchema>) => {
    updateProfileMutation.mutate(data);
  };

  const filteredPlayers = otherPlayers.filter(player => 
    player.user_handle.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (player.player_name && player.player_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">Authentication Required</CardTitle>
            <CardDescription className="text-center">
              Please log in to access your gaming profile
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation('/wallet-login')} className="w-full">
              Log In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Back Button */}
        <BackButton to="/inquisition" label="Back to Dashboard" theme="dark" />
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div>
              <h1 className="text-3xl font-bold text-white">Gaming Profile</h1>
              <p className="text-slate-300">Manage your medieval gaming identity</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              onClick={() => rescanMutation.mutate()}
              disabled={rescanMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="button-rescan-nfts"
            >
              {rescanMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Scan className="w-4 h-4 mr-2" />
              )}
              Rescan NFTs
            </Button>
            
            <Button
              onClick={() => setShowPlayerSearch(!showPlayerSearch)}
              variant="outline"
              className="border-purple-500 text-purple-300 hover:bg-purple-500/10"
              data-testid="button-search-players"
            >
              <Search className="w-4 h-4 mr-2" />
              Find Players
            </Button>
          </div>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-slate-800/50">
            <TabsTrigger value="profile" className="data-[state=active]:bg-purple-600">
              <User className="w-4 h-4 mr-2" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="images" className="data-[state=active]:bg-purple-600">
              <Camera className="w-4 h-4 mr-2" />
              Images
            </TabsTrigger>
            <TabsTrigger value="players" className="data-[state=active]:bg-purple-600">
              <Users className="w-4 h-4 mr-2" />
              Players
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Profile Overview */}
              <Card className="lg:col-span-1 bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Crown className="w-5 h-5 text-yellow-400" />
                    Profile Overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col items-center space-y-4">
                    <Avatar className="w-20 h-20">
                      <AvatarImage 
                        src={profile?.commander_profile_image} 
                        alt={profile?.player_name || handle || "Player"}
                      />
                      <AvatarFallback className="bg-purple-600 text-white text-lg">
                        {(profile?.player_name || handle || "P").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="text-center">
                      <h3 className="text-xl font-bold text-white">
                        {profile?.player_name || handle}
                      </h3>
                      <p className="text-slate-300">@{handle}</p>
                      <Badge variant={profile?.is_gaming_verified ? "default" : "secondary"} className="mt-2">
                        {profile?.is_gaming_verified ? "Verified" : "Unverified"}
                      </Badge>
                    </div>
                  </div>

                  <Separator className="bg-slate-700" />

                  {/* Power Stats */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-yellow-400" />
                        Total Power
                      </span>
                      <span className="text-white font-bold">{profile?.total_power_level || 0}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300 flex items-center gap-2">
                        <Shield className="w-4 h-4 text-red-400" />
                        Army
                      </span>
                      <span className="text-white">{profile?.army_power || 0}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300 flex items-center gap-2">
                        <Star className="w-4 h-4 text-blue-400" />
                        Religion
                      </span>
                      <span className="text-white">{profile?.religion_power || 0}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300 flex items-center gap-2">
                        <Castle className="w-4 h-4 text-green-400" />
                        Civilization
                      </span>
                      <span className="text-white">{profile?.civilization_power || 0}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300 flex items-center gap-2">
                        <Target className="w-4 h-4 text-purple-400" />
                        Economic
                      </span>
                      <span className="text-white">{profile?.economic_power || 0}</span>
                    </div>
                  </div>

                  <Separator className="bg-slate-700" />

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Rank</span>
                      <Badge variant="outline" className="text-white border-slate-600">
                        {profile?.gaming_rank || "Novice"}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">NFTs Owned</span>
                      <span className="text-white">{profile?.total_nfts_owned || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Profile Form */}
              <Card className="lg:col-span-2 bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Edit Profile</CardTitle>
                  <CardDescription className="text-slate-300">
                    Update your gaming profile information
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      <FormField
                        control={form.control}
                        name="player_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white">Player Name</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                className="bg-slate-700 border-slate-600 text-white"
                                data-testid="input-player-name"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="commander_class"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white">Commander Class</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="bg-slate-700 border-slate-600 text-white" data-testid="select-commander-class">
                                  <SelectValue placeholder="Select a class" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="bg-slate-700 border-slate-600">
                                <SelectItem value="warrior" className="text-white">Warrior</SelectItem>
                                <SelectItem value="mage" className="text-white">Mage</SelectItem>
                                <SelectItem value="rogue" className="text-white">Rogue</SelectItem>
                                <SelectItem value="paladin" className="text-white">Paladin</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="religion"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white">Religion</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="bg-slate-700 border-slate-600 text-white" data-testid="select-religion">
                                  <SelectValue placeholder="Select a religion" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="bg-slate-700 border-slate-600">
                                <SelectItem value="Christianity" className="text-white">Christianity</SelectItem>
                                <SelectItem value="Islam" className="text-white">Islam</SelectItem>
                                <SelectItem value="Buddhism" className="text-white">Buddhism</SelectItem>
                                <SelectItem value="Hinduism" className="text-white">Hinduism</SelectItem>
                                <SelectItem value="Paganism" className="text-white">Paganism</SelectItem>
                                <SelectItem value="Secular" className="text-white">Secular</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button 
                        type="submit" 
                        disabled={updateProfileMutation.isPending}
                        className="w-full bg-purple-600 hover:bg-purple-700"
                        data-testid="button-save-profile"
                      >
                        {updateProfileMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4 mr-2" />
                        )}
                        Save Profile
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Images Tab */}
          <TabsContent value="images" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Commander Profile Image */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Commander Portrait
                  </CardTitle>
                  <CardDescription className="text-slate-300">
                    Upload your commander's portrait image
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col items-center space-y-4">
                    <Avatar className="w-32 h-32">
                      <AvatarImage 
                        src={profile?.commander_profile_image} 
                        alt="Commander Portrait"
                      />
                      <AvatarFallback className="bg-purple-600 text-white text-2xl">
                        <User className="w-16 h-16" />
                      </AvatarFallback>
                    </Avatar>
                    
                    <Button
                      onClick={() => {
                        setUploadType('commander');
                        fileInputRef.current?.click();
                      }}
                      disabled={isUploading}
                      className="bg-blue-600 hover:bg-blue-700"
                      data-testid="button-upload-commander-image"
                    >
                      {isUploading && uploadType === 'commander' ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4 mr-2" />
                      )}
                      Upload Portrait
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Crest Image */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Family Crest
                  </CardTitle>
                  <CardDescription className="text-slate-300">
                    Upload your family or clan crest
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col items-center space-y-4">
                    <div className="w-32 h-32 border-2 border-slate-600 rounded-lg flex items-center justify-center bg-slate-700">
                      {profile?.crest_image ? (
                        <img 
                          src={profile.crest_image} 
                          alt="Family Crest"
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <Shield className="w-16 h-16 text-slate-400" />
                      )}
                    </div>
                    
                    <Button
                      onClick={() => {
                        setUploadType('crest');
                        crestInputRef.current?.click();
                      }}
                      disabled={isUploading}
                      className="bg-green-600 hover:bg-green-700"
                      data-testid="button-upload-crest-image"
                    >
                      {isUploading && uploadType === 'crest' ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4 mr-2" />
                      )}
                      Upload Crest
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Players Tab */}
          <TabsContent value="players" className="space-y-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Find Other Players
                </CardTitle>
                <CardDescription className="text-slate-300">
                  Search for other players to form alliances and trade
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <Input
                      placeholder="Search players by handle or name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 bg-slate-700 border-slate-600 text-white"
                      data-testid="input-search-players"
                    />
                  </div>
                  <Button
                    onClick={() => setShowPlayerSearch(true)}
                    variant="outline"
                    className="border-purple-500 text-purple-300 hover:bg-purple-500/10"
                    data-testid="button-load-players"
                  >
                    Load Players
                  </Button>
                </div>

                {showPlayerSearch && (
                  <div className="space-y-4">
                    {playersLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                        <span className="ml-2 text-slate-300">Loading players...</span>
                      </div>
                    ) : filteredPlayers.length === 0 ? (
                      <div className="text-center py-8 text-slate-400">
                        {searchQuery ? `No players found matching "${searchQuery}"` : "No other players found"}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredPlayers.map((player) => (
                          <Card key={player.user_handle} className="bg-slate-700/50 border-slate-600">
                            <CardContent className="p-4">
                              <div className="flex items-center space-x-3">
                                <Avatar className="w-12 h-12">
                                  <AvatarImage 
                                    src={player.commander_profile_image} 
                                    alt={player.player_name || player.user_handle}
                                  />
                                  <AvatarFallback className="bg-purple-600 text-white">
                                    {(player.player_name || player.user_handle).charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-white font-medium truncate">
                                    {player.player_name || player.user_handle}
                                  </h4>
                                  <p className="text-slate-400 text-sm">@{player.user_handle}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="outline" className="text-xs border-slate-500 text-slate-300">
                                      {player.gaming_rank}
                                    </Badge>
                                    <span className="text-yellow-400 text-xs font-medium">
                                      {player.total_power_level} power
                                    </span>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2 mt-3">
                                <Button 
                                  size="sm" 
                                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                                  data-testid={`button-alliance-${player.user_handle}`}
                                >
                                  <Handshake className="w-3 h-3 mr-1" />
                                  Alliance
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="flex-1 border-slate-500 text-slate-300 hover:bg-slate-600"
                                  data-testid={`button-trade-${player.user_handle}`}
                                >
                                  <Heart className="w-3 h-3 mr-1" />
                                  Trade
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          style={{ display: 'none' }}
          data-testid="input-commander-file"
        />
        <input
          ref={crestInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          style={{ display: 'none' }}
          data-testid="input-crest-file"
        />
      </div>
    </div>
  );
}
