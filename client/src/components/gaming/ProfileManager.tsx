/**
 * ProfileManager - Comprehensive profile management for gaming dashboard
 * Allows editing of player info, civilization details, and images
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
  Loader2
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import PlayerImageGenerator from "./PlayerImageGenerator";

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

const civilizationSchema = z.object({
  civilization_name: z.string().min(1, "Civilization name required").max(50, "Name too long"),
  motto: z.string().max(200, "Motto too long").optional(),
  color_primary: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid color format"),
  color_secondary: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid color format"),
  color_accent: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid color format")
});

interface ProfileData {
  player: {
    player_name?: string;
    commander_class?: string;
    religion?: string;
    commander_profile_image?: string;
    crest_image?: string;
  };
  civilization: {
    civilization_name?: string;
    motto?: string;
    color_primary?: string;
    color_secondary?: string;
    color_accent?: string;
    crest_image?: string;
  } | null;
}

export default function ProfileManager() {
  const [activeImageType, setActiveImageType] = useState<'player' | 'crest' | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch profile data
  const { data: profile, isLoading } = useQuery<{ success: boolean; data: ProfileData }>({
    queryKey: ['/api/gaming/player/profile']
  });

  // Profile form
  const profileForm = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      player_name: profile?.data?.player?.player_name || '',
      commander_class: (profile?.data?.player?.commander_class as any) || 'warrior',
      religion: (profile?.data?.player?.religion as any) || 'Secular'
    }
  });

  // Civilization form  
  const civilizationForm = useForm({
    resolver: zodResolver(civilizationSchema),
    defaultValues: {
      civilization_name: profile?.data?.civilization?.civilization_name || '',
      motto: profile?.data?.civilization?.motto || '',
      color_primary: profile?.data?.civilization?.color_primary || '#8B4513',
      color_secondary: profile?.data?.civilization?.color_secondary || '#DAA520',
      color_accent: profile?.data?.civilization?.color_accent || '#DC143C'
    }
  });

  // Update forms when data loads
  if (profile?.data && !profileForm.formState.isDirty) {
    profileForm.reset({
      player_name: profile.data.player?.player_name || '',
      commander_class: (profile.data.player?.commander_class as any) || 'warrior',
      religion: (profile.data.player?.religion as any) || 'Secular'
    });
    
    if (profile.data.civilization) {
      civilizationForm.reset({
        civilization_name: profile.data.civilization.civilization_name || '',
        motto: profile.data.civilization.motto || '',
        color_primary: profile.data.civilization.color_primary || '#8B4513',
        color_secondary: profile.data.civilization.color_secondary || '#DAA520',
        color_accent: profile.data.civilization.color_accent || '#DC143C'
      });
    }
  }

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('/api/gaming/player/profile', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      return await response.json() as any;
    },
    onSuccess: () => {
      toast({
        title: "✅ Profile Updated",
        description: "Your player profile has been saved successfully."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/gaming/player/profile'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gaming/player/dashboard'] });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Update Failed",
        description: error.message || "Failed to update profile",
        variant: "destructive"
      });
    }
  });

  // Update civilization mutation
  const updateCivilizationMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('/api/gaming/player/civilization', {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      return await response.json() as any;
    },
    onSuccess: () => {
      toast({
        title: "🏰 Civilization Updated",
        description: "Your civilization details have been saved successfully."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/gaming/player/profile'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gaming/player/dashboard'] });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Update Failed", 
        description: error.message || "Failed to update civilization",
        variant: "destructive"
      });
    }
  });

  // Image upload mutation
  const uploadImageMutation = useMutation({
    mutationFn: async ({ file, type }: { file: File, type: string }) => {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('type', type);
      
      // Use fetch directly for file uploads since apiRequest expects JSON
      const response = await fetch('/api/gaming/player/image-upload', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      return await response.json() as any;
    },
    onSuccess: (data, variables) => {
      toast({
        title: "📸 Image Uploaded",
        description: `Your ${variables.type} image has been uploaded successfully.`
      });
      queryClient.invalidateQueries({ queryKey: ['/api/gaming/player/profile'] });
      setSelectedFile(null);
    },
    onError: (error: any) => {
      toast({
        title: "❌ Upload Failed",
        description: error.message || "Failed to upload image",
        variant: "destructive"
      });
    }
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>, type: 'player' | 'crest') => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          title: "File Too Large",
          description: "Please select an image smaller than 5MB",
          variant: "destructive"
        });
        return;
      }
      setSelectedFile(file);
      setActiveImageType(type);
    }
  };

  const handleUpload = () => {
    if (selectedFile && activeImageType) {
      uploadImageMutation.mutate({ 
        file: selectedFile, 
        type: activeImageType === 'player' ? 'commander_profile_image' : 'crest_image'
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading profile...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="profile-manager">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-purple-600 dark:text-purple-400">
          👑 Profile Management
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Customize your player profile, civilization, and images
        </p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Player Profile
          </TabsTrigger>
          <TabsTrigger value="civilization" className="flex items-center gap-2">
            <Castle className="h-4 w-4" />
            Civilization
          </TabsTrigger>
          <TabsTrigger value="images" className="flex items-center gap-2">
            <Camera className="h-4 w-4" />
            Images
          </TabsTrigger>
        </TabsList>

        {/* Player Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5" />
                Player Information
              </CardTitle>
              <CardDescription>
                Update your basic player details and commander settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...profileForm}>
                <form 
                  onSubmit={profileForm.handleSubmit((data) => updateProfileMutation.mutate(data))}
                  className="space-y-4"
                >
                  <FormField
                    control={profileForm.control}
                    name="player_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Player Name</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="Enter your player name" 
                            data-testid="input-player-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={profileForm.control}
                    name="commander_class"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Commander Class</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                          data-testid="select-commander-class"
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Choose your class" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="warrior">⚔️ Warrior</SelectItem>
                            <SelectItem value="mage">🔮 Mage</SelectItem>
                            <SelectItem value="rogue">🗡️ Rogue</SelectItem>
                            <SelectItem value="paladin">🛡️ Paladin</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={profileForm.control}
                    name="religion"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Religion</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                          data-testid="select-religion"
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Choose your faith" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Christianity">✝️ Christianity</SelectItem>
                            <SelectItem value="Islam">☪️ Islam</SelectItem>
                            <SelectItem value="Buddhism">☸️ Buddhism</SelectItem>
                            <SelectItem value="Hinduism">🕉️ Hinduism</SelectItem>
                            <SelectItem value="Paganism">🌙 Paganism</SelectItem>
                            <SelectItem value="Secular">⚖️ Secular</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    disabled={updateProfileMutation.isPending}
                    className="w-full"
                    data-testid="button-save-profile"
                  >
                    {updateProfileMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Profile
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Civilization Tab */}
        <TabsContent value="civilization">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Civilization Details
              </CardTitle>
              <CardDescription>
                Customize your civilization's identity and colors
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...civilizationForm}>
                <form 
                  onSubmit={civilizationForm.handleSubmit((data) => updateCivilizationMutation.mutate(data))}
                  className="space-y-4"
                >
                  <FormField
                    control={civilizationForm.control}
                    name="civilization_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Civilization Name</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="Enter civilization name" 
                            data-testid="input-civilization-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={civilizationForm.control}
                    name="motto"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Motto (Optional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            placeholder="Enter your civilization's motto or battle cry"
                            className="min-h-[80px]"
                            data-testid="textarea-motto"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={civilizationForm.control}
                      name="color_primary"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Primary Color</FormLabel>
                          <FormControl>
                            <div className="flex items-center gap-2">
                              <Input 
                                type="color" 
                                {...field} 
                                className="w-16 h-10 p-1 border rounded"
                                data-testid="input-color-primary"
                              />
                              <Input 
                                {...field} 
                                placeholder="#8B4513"
                                className="flex-1"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={civilizationForm.control}
                      name="color_secondary"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Secondary Color</FormLabel>
                          <FormControl>
                            <div className="flex items-center gap-2">
                              <Input 
                                type="color" 
                                {...field} 
                                className="w-16 h-10 p-1 border rounded"
                                data-testid="input-color-secondary"
                              />
                              <Input 
                                {...field} 
                                placeholder="#DAA520"
                                className="flex-1"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={civilizationForm.control}
                      name="color_accent"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Accent Color</FormLabel>
                          <FormControl>
                            <div className="flex items-center gap-2">
                              <Input 
                                type="color" 
                                {...field} 
                                className="w-16 h-10 p-1 border rounded"
                                data-testid="input-color-accent"
                              />
                              <Input 
                                {...field} 
                                placeholder="#DC143C"
                                className="flex-1"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button 
                    type="submit" 
                    disabled={updateCivilizationMutation.isPending}
                    className="w-full"
                    data-testid="button-save-civilization"
                  >
                    {updateCivilizationMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Civilization
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Images Tab */}
        <TabsContent value="images">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Player Image */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Player Portrait
                </CardTitle>
                <CardDescription>
                  Your character's official portrait
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-center">
                  <Avatar className="w-24 h-24">
                    <AvatarImage 
                      src={profile?.data?.player?.commander_profile_image} 
                      alt="Player portrait" 
                    />
                    <AvatarFallback>
                      <User className="h-12 w-12" />
                    </AvatarFallback>
                  </Avatar>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="player-image-upload">Upload New Image</Label>
                  <Input
                    id="player-image-upload"
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileSelect(e, 'player')}
                    data-testid="input-upload-player-image"
                  />
                </div>

                {selectedFile && activeImageType === 'player' && (
                  <Button
                    onClick={handleUpload}
                    disabled={uploadImageMutation.isPending}
                    className="w-full"
                    data-testid="button-upload-player-image"
                  >
                    {uploadImageMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Portrait
                      </>
                    )}
                  </Button>
                )}

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setActiveImageType('player')}
                  data-testid="button-generate-player-image"
                >
                  <Wand2 className="h-4 w-4 mr-2" />
                  Generate with AI
                </Button>
              </CardContent>
            </Card>

            {/* Crest Image */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Civilization Crest
                </CardTitle>
                <CardDescription>
                  Your kingdom's heraldic emblem
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-center">
                  <Avatar className="w-24 h-24">
                    <AvatarImage 
                      src={profile?.data?.civilization?.crest_image || profile?.data?.player?.crest_image} 
                      alt="Civilization crest" 
                    />
                    <AvatarFallback>
                      <Shield className="h-12 w-12" />
                    </AvatarFallback>
                  </Avatar>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="crest-image-upload">Upload New Crest</Label>
                  <Input
                    id="crest-image-upload"
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileSelect(e, 'crest')}
                    data-testid="input-upload-crest-image"
                  />
                </div>

                {selectedFile && activeImageType === 'crest' && (
                  <Button
                    onClick={handleUpload}
                    disabled={uploadImageMutation.isPending}
                    className="w-full"
                    data-testid="button-upload-crest-image"
                  >
                    {uploadImageMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Crest
                      </>
                    )}
                  </Button>
                )}

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setActiveImageType('crest')}
                  data-testid="button-generate-crest-image"
                >
                  <Wand2 className="h-4 w-4 mr-2" />
                  Generate with AI
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* AI Image Generator (when activated) */}
      {activeImageType && profile?.data && (
        <PlayerImageGenerator
          isOpen={Boolean(activeImageType)}
          onClose={() => setActiveImageType(null)}
          onContinue={() => setActiveImageType(null)}
          userHandle={profile.data.player?.player_name || "player"}
          playerData={{
            player_name: profile.data.player?.player_name || '',
            civilization_name: profile.data.civilization?.civilization_name || '',
            primary_color: profile.data.civilization?.color_primary || '#8B4513',
            secondary_color: profile.data.civilization?.color_secondary || '#DAA520',
            religion: profile.data.player?.religion || 'Secular',
            commander_class: profile.data.player?.commander_class || 'warrior'
          }}
        />
      )}
    </div>
  );
}
