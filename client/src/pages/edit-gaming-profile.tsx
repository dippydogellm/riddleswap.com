import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/utils/sessionManager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { User, Shield, Sparkles, Save, Upload, X } from "lucide-react";
import { Link } from "wouter";
import { BackButton } from "@/components/gaming/BackButton";
import { SessionRenewalModal } from "@/components/SessionRenewalModal";

export default function EditGamingProfile() {
  const session = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showRenewalModal, setShowRenewalModal] = useState(false);

  // Watch for session renewal needs
  useEffect(() => {
    if ((session as any).needsRenewal) {
      setShowRenewalModal(true);
    } else {
      setShowRenewalModal(false);
    }
  }, [(session as any).needsRenewal]);

  const [playerName, setPlayerName] = useState("");
  const [commanderClass, setCommanderClass] = useState("");
  const [playType, setPlayType] = useState("");
  const [civilizationName, setCivilizationName] = useState("");
  const [motto, setMotto] = useState("");
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [crestImageFile, setCrestImageFile] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState("");
  const [crestImagePreview, setCrestImagePreview] = useState("");

  const { data: profileData, isLoading } = useQuery<any>({
    queryKey: ['/api/gaming/player/profile'],
    enabled: !!session.handle,
  });

  // Load profile data when it's available
  useEffect(() => {
    if (profileData?.data?.player) {
      setPlayerName(profileData.data.player.player_name || "");
      setCommanderClass(profileData.data.player.commander_class || "");
      setPlayType(profileData.data.player.play_type || "");
      setProfileImagePreview(profileData.data.player.commander_profile_image || "");
    }
    if (profileData?.data?.civilization) {
      setCivilizationName(profileData.data.civilization.civilization_name || "");
      setMotto(profileData.data.civilization.motto || "");
      setCrestImagePreview(profileData.data.civilization.crest_image || "");
    }
  }, [profileData]);

  const updateProfileMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch('/api/gaming/player/profile', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('sessionToken')}`,
        },
        body: formData,
      });
      if (!response.ok) throw new Error('Failed to update profile');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gaming/player/profile'] });
      toast({
        title: "✅ Profile Updated",
        description: "Your gaming profile has been successfully updated!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Update Failed",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  const handleProfileImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfileImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCrestImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCrestImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCrestImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append('player_name', playerName);
    formData.append('commander_class', commanderClass);
    formData.append('play_type', playType);
    formData.append('civilization_name', civilizationName);
    formData.append('motto', motto);
    
    if (profileImageFile) {
      formData.append('profile_image', profileImageFile);
    }
    if (crestImageFile) {
      formData.append('crest_image', crestImageFile);
    }

    updateProfileMutation.mutate(formData);
  };

  if (!session.handle) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 flex items-center justify-center p-4">
        <Card className="bg-slate-900/80 border-purple-500/30 max-w-md">
          <CardContent className="p-8 text-center">
            <User className="w-16 h-16 text-purple-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Login Required</h2>
            <p className="text-gray-400 mb-4">Please login to edit your profile</p>
            <Link href="/wallet-login">
              <Button className="bg-gradient-to-r from-purple-500 to-pink-600">
                Login Now
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Back Button */}
        <BackButton to="/inquisition" label="Back to Dashboard" theme="dark" />
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent mb-2">
              ⚙️ Edit Gaming Profile
            </h1>
            <p className="text-gray-400">Customize your commander and civilization</p>
          </div>
          <Link href="/gaming-dashboard">
            <Button variant="outline" className="border-purple-500/50 text-purple-400">
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <Card className="bg-slate-900/80 border-purple-500/30">
            <CardContent className="p-12 text-center">
              <div className="animate-spin w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-gray-400">Loading profile...</p>
            </CardContent>
          </Card>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Commander Profile */}
            <Card className="bg-slate-900/80 border-purple-500/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <User className="w-5 h-5 text-purple-400" />
                  Commander Profile
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="playerName" className="text-gray-300">Commander Name *</Label>
                    <Input
                      id="playerName"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      placeholder="Enter your commander name"
                      className="bg-slate-800 border-slate-700 text-white mt-2"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="commanderClass" className="text-gray-300">Commander Class</Label>
                    <Select value={commanderClass} onValueChange={setCommanderClass}>
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-2">
                        <SelectValue placeholder="Select class" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="warrior">⚔️ Warrior</SelectItem>
                        <SelectItem value="strategist">🧠 Strategist</SelectItem>
                        <SelectItem value="diplomat">🤝 Diplomat</SelectItem>
                        <SelectItem value="merchant">💰 Merchant</SelectItem>
                        <SelectItem value="mystic">✨ Mystic</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="playType" className="text-gray-300">Play Style</Label>
                  <Select value={playType} onValueChange={setPlayType}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-2">
                      <SelectValue placeholder="Select play style" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aggressive">⚡ Aggressive</SelectItem>
                      <SelectItem value="defensive">🛡️ Defensive</SelectItem>
                      <SelectItem value="balanced">⚖️ Balanced</SelectItem>
                      <SelectItem value="diplomatic">🕊️ Diplomatic</SelectItem>
                      <SelectItem value="economic">💎 Economic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-gray-300 mb-2 block">Profile Image</Label>
                  <div className="flex items-center gap-4">
                    {profileImagePreview && (
                      <img 
                        src={profileImagePreview} 
                        alt="Profile preview"
                        className="w-24 h-24 rounded-full object-cover border-2 border-purple-500"
                      />
                    )}
                    <div>
                      <input
                        type="file"
                        id="profileImage"
                        accept="image/*"
                        onChange={handleProfileImageChange}
                        className="hidden"
                      />
                      <label htmlFor="profileImage">
                        <Button type="button" variant="outline" className="border-purple-500/50 text-purple-400" onClick={() => document.getElementById('profileImage')?.click()}>
                          <Upload className="w-4 h-4 mr-2" />
                          Upload Image
                        </Button>
                      </label>
                      <p className="text-xs text-gray-500 mt-2">PNG, JPG up to 5MB</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Civilization Profile */}
            <Card className="bg-slate-900/80 border-blue-500/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Shield className="w-5 h-5 text-blue-400" />
                  Civilization
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label htmlFor="civilizationName" className="text-gray-300">Civilization Name *</Label>
                  <Input
                    id="civilizationName"
                    value={civilizationName}
                    onChange={(e) => setCivilizationName(e.target.value)}
                    placeholder="Enter your civilization name"
                    className="bg-slate-800 border-slate-700 text-white mt-2"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="motto" className="text-gray-300">Motto / Battle Cry</Label>
                  <Textarea
                    id="motto"
                    value={motto}
                    onChange={(e) => setMotto(e.target.value)}
                    placeholder="Enter your civilization's motto"
                    className="bg-slate-800 border-slate-700 text-white mt-2 min-h-[100px]"
                  />
                </div>

                <div>
                  <Label className="text-gray-300 mb-2 block">Civilization Crest</Label>
                  <div className="flex items-center gap-4">
                    {crestImagePreview && (
                      <img 
                        src={crestImagePreview} 
                        alt="Crest preview"
                        className="w-24 h-24 rounded-lg object-cover border-2 border-blue-500"
                      />
                    )}
                    <div>
                      <input
                        type="file"
                        id="crestImage"
                        accept="image/*"
                        onChange={handleCrestImageChange}
                        className="hidden"
                      />
                      <label htmlFor="crestImage">
                        <Button type="button" variant="outline" className="border-blue-500/50 text-blue-400" onClick={() => document.getElementById('crestImage')?.click()}>
                          <Upload className="w-4 h-4 mr-2" />
                          Upload Crest
                        </Button>
                      </label>
                      <p className="text-xs text-gray-500 mt-2">PNG, JPG up to 5MB</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Submit */}
            <div className="flex justify-end gap-4">
              <Link href="/gaming-dashboard">
                <Button type="button" variant="outline" className="border-gray-500/50 text-gray-400">
                  Cancel
                </Button>
              </Link>
              <Button 
                type="submit" 
                className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700"
                disabled={updateProfileMutation.isPending}
              >
                {updateProfileMutation.isPending ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>

      <SessionRenewalModal 
        open={showRenewalModal}
        onOpenChange={setShowRenewalModal}
      />
    </div>
  );
}
