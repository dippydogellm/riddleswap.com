import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, User, Mail, Phone, MapPin, Globe, Github, Twitter, Instagram } from "lucide-react";
import { ObjectUploader } from "@/components/ObjectUploader";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface SocialProfile {
  id: string;
  walletAddress: string;
  displayName: string;
  bio?: string;
  profileImageUrl?: string;
  coverImageUrl?: string;
  location?: string;
  website?: string;
  twitter?: string;
  instagram?: string;
  github?: string;
  email?: string;
  phone?: string;
  isPublic: boolean;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ProfileUploaderProps {
  walletAddress: string;
}

export function SocialProfileUploader({ walletAddress }: ProfileUploaderProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState({
    displayName: "",
    bio: "",
    location: "",
    website: "",
    twitter: "",
    instagram: "",
    github: "",
    email: "",
    phone: "",
    isPublic: true,
  });

  // Fetch profile data
  const { data: profile, isLoading } = useQuery<SocialProfile>({
    queryKey: ["social-profile", walletAddress],
    queryFn: async (): Promise<SocialProfile> => {
      const response = await fetch(`/api/social/profile/${walletAddress}`);
      if (!response.ok) throw new Error("Failed to fetch profile");
      return response.json();
    },
    enabled: !!walletAddress,
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (updates: any) => {
      const response = await fetch("/api/social/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": walletAddress,
        },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error("Failed to update profile");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-profile", walletAddress] });
      setIsEditing(false);
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Image upload mutations
  const updateImageMutation = useMutation({
    mutationFn: async ({ profileImageUrl, coverImageUrl }: { profileImageUrl?: string; coverImageUrl?: string }) => {
      const response = await fetch("/api/social/profile/update-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletAddress,
          profileImageUrl,
          coverImageUrl,
        }),
      });
      if (!response.ok) throw new Error("Failed to update image");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-profile", walletAddress] });
      toast({
        title: "Image Updated",
        description: "Your profile image has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleProfileImageUpload = async () => {
    try {
      const response = await fetch("/api/social/upload/profile-picture");
      const { uploadUrl } = await response.json() as any;
      return { method: "PUT" as const, url: uploadUrl };
    } catch (error) {
      toast({
        title: "Upload Error",
        description: "Failed to get upload URL",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleCoverImageUpload = async () => {
    try {
      const response = await fetch("/api/social/upload/cover-photo");
      const { uploadUrl } = await response.json() as any;
      return { method: "PUT" as const, url: uploadUrl };
    } catch (error) {
      toast({
        title: "Upload Error",
        description: "Failed to get upload URL",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleProfileImageComplete = (result: any) => {
    if (result.successful && result.successful[0]) {
      const uploadUrl = result.successful[0].uploadURL;
      updateImageMutation.mutate({ profileImageUrl: uploadUrl });
    }
  };

  const handleCoverImageComplete = (result: any) => {
    if (result.successful && result.successful[0]) {
      const uploadUrl = result.successful[0].uploadURL;
      updateImageMutation.mutate({ coverImageUrl: uploadUrl });
    }
  };

  const handleSave = () => {
    updateProfileMutation.mutate(profileData);
  };

  const handleEdit = () => {
    if (profile) {
      setProfileData({
        displayName: profile.displayName || "",
        bio: profile.bio || "",
        location: profile.location || "",
        website: profile.website || "",
        twitter: profile.twitter || "",
        instagram: profile.instagram || "",
        github: profile.github || "",
        email: profile.email || "",
        phone: profile.phone || "",
        isPublic: profile.isPublic ?? true,
      });
    }
    setIsEditing(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Cover Image Section */}
      <Card>
        <div className="relative h-48 bg-gradient-to-r from-blue-500 to-purple-600 rounded-t-lg">
          {profile?.coverImageUrl && (
            <img
              src={profile.coverImageUrl}
              alt="Cover"
              className="w-full h-full object-cover rounded-t-lg"
            />
          )}
          <div className="absolute bottom-4 right-4">
            <ObjectUploader
              maxNumberOfFiles={1}
              maxFileSize={5242880} // 5MB
              onGetUploadParameters={handleCoverImageUpload}
              onComplete={handleCoverImageComplete}
              buttonClassName="bg-black/50 hover:bg-black/70 text-white"
            >
              <Camera className="w-4 h-4 mr-2" />
              Cover Photo
            </ObjectUploader>
          </div>
          
          {/* Profile Picture */}
          <div className="absolute -bottom-16 left-6">
            <div className="relative">
              <Avatar className="w-32 h-32 border-4 border-white">
                <AvatarImage src={profile?.profileImageUrl} />
                <AvatarFallback className="text-2xl">
                  {profile?.displayName?.charAt(0)?.toUpperCase() || <User />}
                </AvatarFallback>
              </Avatar>
              <div className="absolute bottom-2 right-2">
                <ObjectUploader
                  maxNumberOfFiles={1}
                  maxFileSize={2097152} // 2MB
                  onGetUploadParameters={handleProfileImageUpload}
                  onComplete={handleProfileImageComplete}
                  buttonClassName="w-8 h-8 p-0 rounded-full bg-blue-600 hover:bg-blue-700"
                >
                  <Camera className="w-4 h-4" />
                </ObjectUploader>
              </div>
            </div>
          </div>
        </div>
        
        <CardContent className="pt-20">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold">{profile?.displayName || "Anonymous User"}</h1>
              <p className="text-gray-600 mt-2">{profile?.bio || "No bio available"}</p>
              <div className="flex items-center gap-4 mt-4 text-sm text-gray-500">
                <span>{profile?.followersCount || 0} Followers</span>
                <span>{profile?.followingCount || 0} Following</span>
                <span>{profile?.postsCount || 0} Posts</span>
              </div>
            </div>
            
            <Button onClick={isEditing ? handleSave : handleEdit} disabled={updateProfileMutation.isPending}>
              {isEditing ? "Save Changes" : "Edit Profile"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Edit Profile Form */}
      {isEditing && (
        <Card>
          <CardHeader>
            <CardTitle>Edit Profile</CardTitle>
            <CardDescription>Update your profile information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  value={profileData.displayName}
                  onChange={(e) => setProfileData({ ...profileData, displayName: e.target.value })}
                  placeholder="Your display name"
                />
              </div>
              
              <div>
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    className="pl-9"
                    value={profileData.email}
                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                    placeholder="your@email.com"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="phone">Phone</Label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                  <Input
                    id="phone"
                    className="pl-9"
                    value={profileData.phone}
                    onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="location">Location</Label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                  <Input
                    id="location"
                    className="pl-9"
                    value={profileData.location}
                    onChange={(e) => setProfileData({ ...profileData, location: e.target.value })}
                    placeholder="City, Country"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="website">Website</Label>
                <div className="relative">
                  <Globe className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                  <Input
                    id="website"
                    className="pl-9"
                    value={profileData.website}
                    onChange={(e) => setProfileData({ ...profileData, website: e.target.value })}
                    placeholder="https://yourwebsite.com"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="twitter">Twitter</Label>
                <div className="relative">
                  <Twitter className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                  <Input
                    id="twitter"
                    className="pl-9"
                    value={profileData.twitter}
                    onChange={(e) => setProfileData({ ...profileData, twitter: e.target.value })}
                    placeholder="@yourusername"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="instagram">Instagram</Label>
                <div className="relative">
                  <Instagram className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                  <Input
                    id="instagram"
                    className="pl-9"
                    value={profileData.instagram}
                    onChange={(e) => setProfileData({ ...profileData, instagram: e.target.value })}
                    placeholder="@yourusername"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="github">GitHub</Label>
                <div className="relative">
                  <Github className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                  <Input
                    id="github"
                    className="pl-9"
                    value={profileData.github}
                    onChange={(e) => setProfileData({ ...profileData, github: e.target.value })}
                    placeholder="yourusername"
                  />
                </div>
              </div>
            </div>
            
            <div>
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={profileData.bio}
                onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                placeholder="Tell us about yourself..."
                rows={3}
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isPublic"
                checked={profileData.isPublic}
                onChange={(e) => setProfileData({ ...profileData, isPublic: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="isPublic">Make profile public</Label>
            </div>
            
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={updateProfileMutation.isPending}>
                {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Profile Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{profile?.postsCount || 0}</div>
              <div className="text-sm text-gray-600">Posts</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{profile?.followersCount || 0}</div>
              <div className="text-sm text-gray-600">Followers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{profile?.followingCount || 0}</div>
              <div className="text-sm text-gray-600">Following</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {profile?.createdAt ? Math.floor((Date.now() - new Date(profile.createdAt).getTime()) / (1000 * 60 * 60 * 24)) : 0}
              </div>
              <div className="text-sm text-gray-600">Days Active</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
