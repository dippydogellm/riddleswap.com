import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useLocation, useRoute } from "wouter";
import { PhotoUploader } from "@/components/PhotoUploader";
import { 
  ArrowLeft, 
  CalendarDays, 
  MapPin, 
  Link as LinkIcon,
  Camera,
  Search,
  User,
  MessageSquare,
  Heart,
  Repeat2,
  MoreHorizontal,
  X,
  Plus,
  Moon,
  Sun,
  Twitter,
  Instagram,
  Youtube,
  MessageCircle,
  Facebook,
  Linkedin,
  Github,
  Tv,
  Bell
} from "lucide-react";
import "@/styles/social-profile.css";
// Removed legacy NotificationBell per cleanup directive

interface SocialProfile {
  id?: number;
  handle?: string;
  displayName?: string;
  bio?: string;
  location?: string;
  website?: string;
  profileImageUrl?: string;
  coverImageUrl?: string;
  // Social media links
  twitterUsername?: string;
  instagramUsername?: string;
  facebookUsername?: string;
  linkedinUsername?: string;
  youtubeChannel?: string;
  tiktokUsername?: string;
  telegramUsername?: string;
  discordUsername?: string;
  githubUsername?: string;
  twitchUsername?: string;
  twitterVerified?: boolean;
  instagramVerified?: boolean;
  // Follow counts
  followingCount?: number;
  followersCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface ProfileResponse {
  success: boolean;
  profile: SocialProfile;
  session?: {
    handle: string;
    connected: boolean;
  };
}

export default function SocialProfilePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  
  // Extract userId from URL - check both possible routes
  const [socialProfileMatch, socialProfileParams] = useRoute("/social-profile/:userId");
  const [ownProfileMatch] = useRoute("/social/profile");
  const targetUserId: string | undefined = socialProfileParams ? (socialProfileParams as any).userId : undefined;
  
  // Determine if viewing own profile or someone else's based on route
  const isViewingOwnProfile = ownProfileMatch;
  const [editMode, setEditMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });
  
  // Post creation state
  const [postContent, setPostContent] = useState("");
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  
  // Message button state
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  
  // Quote dialog state
  const [quoteDialogOpen, setQuoteDialogOpen] = useState<{ open: boolean; postId?: string; originalPost?: any }>({ open: false });
  const [quoteContent, setQuoteContent] = useState('');
  
  // Use unified authentication to ensure proper session handling
  const { authData, isLoading: authLoading, isAuthenticated } = useAuth();
  
  // Session and profile state
  const [sessionData, setSessionData] = useState<any>(null);
  const [profileData, setProfileData] = useState<SocialProfile>({});

  // Check and fix session storage issue - MUST be before conditional returns
  useEffect(() => {
    const sessionToken = localStorage.getItem('sessionToken');
    const sessionData = sessionStorage.getItem('riddle_wallet_session');
    
    
    // If we have sessionToken but no sessionStorage, create it
    if (sessionToken && !sessionData) {
      const mockSession = {
        sessionToken: sessionToken,
        handle: 'riddlebank', // Default based on logs
        authenticated: true,
        username: 'riddlebank'
      };
      sessionStorage.setItem('riddle_wallet_session', JSON.stringify(mockSession));
      // Force a page refresh to re-run auth check
      window.location.reload();
    }
  }, []);

  // Fetch profile data - must be called before any conditional returns
  const { data: profileResponse, isLoading } = useQuery<ProfileResponse>({
    queryKey: ["/api/social/profile", targetUserId || "own"],
    queryFn: async () => {
      // For own profile, use /api/social/profile, for others use /api/social/profile/:userId
      const url = isViewingOwnProfile || !targetUserId
        ? "/api/social/profile"
        : `/api/social/profile/${targetUserId}`;
      
      console.log('🔍 [PROFILE FETCH] URL:', url, 'isViewingOwnProfile:', isViewingOwnProfile);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }
      
      return response.json();
    },
    retry: false,
    enabled: isAuthenticated, // Only fetch when authenticated
  });

  // Create post mutation
  const createPostMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await apiRequest("/api/social/posts", {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      return response.json();
    },
    onSuccess: () => {
      setPostContent("");
      setIsCreatingPost(false);
      refetchProfilePosts();
      toast({
        title: "✓ Riddle Created!",
        description: "Your riddle has been published successfully!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Create Riddle",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Fetch posts for the specific user being viewed - no caching for real-time updates
  const { data: posts, isLoading: postsLoading, refetch: refetchProfilePosts } = useQuery({
    queryKey: ["/api/social/posts", targetUserId || "own"],
    queryFn: async () => {
      // For own profile, fetch current user's posts, for others fetch specific user's posts
      const url = isViewingOwnProfile || !targetUserId
        ? `/api/social/posts?author_handle=${authData?.handle}` // Gets current user's posts only
        : `/api/social/posts?author_handle=${targetUserId}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch posts');
      }
      
      const result = await response.json() as any;
      return result;
    },
    enabled: isAuthenticated,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Fetch user's liked posts  
  const { data: likedPosts, isLoading: likedPostsLoading, refetch: refetchLikedPosts } = useQuery({
    queryKey: ["/api/posts/liked", targetUserId || authData?.handle],
    queryFn: async () => {
      const response = await fetch("/api/posts/liked", {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch liked posts');
      }
      
      const result = await response.json() as any;
      return result.posts || [];
    },
    enabled: isAuthenticated,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Fetch user's replies/comments
  const { data: userReplies, isLoading: repliesLoading, refetch: refetchReplies } = useQuery({
    queryKey: ["/api/posts/replies", targetUserId || authData?.handle],
    queryFn: async () => {
      const response = await fetch("/api/posts/replies", {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch replies');
      }
      
      const result = await response.json() as any;
      return result.replies || [];
    },
    enabled: isAuthenticated,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Like post mutation
  const likePostMutation = useMutation({
    mutationFn: async (postId: number) => {
      return await apiRequest(`/api/social/posts/${postId}/like`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      refetchProfilePosts();
      toast({
        title: "✓ Liked!",
        description: "Riddle liked successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Like",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Retweet post mutation
  const retweetPostMutation = useMutation({
    mutationFn: async (postId: number) => {
      return await apiRequest(`/api/social/posts/${postId}/retweet`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      refetchProfilePosts();
      toast({
        title: "✓ Retweeted!",
        description: "Riddle shared successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Retweet",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Start conversation mutation
  const startConversationMutation = useMutation({
    mutationFn: async (participantHandle: string) => {
      console.log('💬 [START CONVERSATION] Creating conversation with:', participantHandle);
      const response = await apiRequest("/api/messaging/start-conversation", {
        method: "POST",
        body: JSON.stringify({ participantHandle }),
      });
      return response.json();
    },
    onSuccess: (conversation) => {
      console.log('✅ [START CONVERSATION] Conversation created/found:', conversation);
      // Navigate to messaging system with the conversation selected
      const conversationId = conversation.id || conversation.conversationId;
      if (conversationId) {
        setLocation(`/social/messages?conversation=${conversationId}`);
        toast({
          title: "✓ Conversation Started!",
          description: "Redirecting to messages...",
        });
      } else {
        console.error('❌ [START CONVERSATION] No conversation ID in response');
        throw new Error('Invalid conversation response');
      }
    },
    onError: (error: Error) => {
      console.error('❌ [START CONVERSATION] Error:', error);
      toast({
        title: "Failed to Start Conversation",
        description: error.message || 'Unable to start conversation. Please try again.',
        variant: "destructive",
      });
    },
  });

  // Quote tweet mutation
  const quoteTweetMutation = useMutation({
    mutationFn: async ({ postId, content }: { postId: string; content: string }) => {
      return await apiRequest(`/api/social/posts/${postId}/quote`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
    },
    onSuccess: () => {
      refetchProfilePosts();
      setQuoteDialogOpen({ open: false });
      setQuoteContent('');
      toast({
        title: "✓ Quote Riddle Created!",
        description: "Your quote riddle has been published",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Quote Tweet",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle quote submit
  const handleQuoteSubmit = () => {
    if (quoteContent.trim() && quoteDialogOpen.postId) {
      quoteTweetMutation.mutate({ 
        postId: quoteDialogOpen.postId, 
        content: quoteContent.trim() 
      });
    }
  };

  // Handle message user functionality
  const handleMessageUser = (userHandle: string) => {
    if (!userHandle) {
      toast({
        title: "Unable to Message User",
        description: "User handle not found",
        variant: "destructive",
      });
      return;
    }
    
    console.log('💬 [MESSAGE USER] Starting conversation with:', userHandle);
    setIsCreatingConversation(true);
    startConversationMutation.mutate(userHandle);
    // Reset state on completion (success/error handled by mutation)
    setTimeout(() => setIsCreatingConversation(false), 2000);
  };

  // Update profile mutation with comprehensive error handling and data preservation - MUST be before conditional returns
  const updateProfileMutation = useMutation({
    mutationFn: async (data: SocialProfile) => {
      console.log('💾 Attempting to save profile with data:', data);
      
      try {
        console.log('🔍 Making PUT request to /api/social/profile...');
        const response = await apiRequest("/api/social/profile", {
          method: "PUT",
          body: JSON.stringify(data),
        });
        console.log('✅ Profile save API response received:', response);
        const result = await response.json() as any;
        console.log('✅ Profile save API call successful:', result);
        return result;
      } catch (error) {
        console.error('💾 Profile save failed:', error);
        // Preserve the data in localStorage as backup (including images)
        const backup = {
          timestamp: new Date().toISOString(),
          profileData: data,
          originalProfile: profileResponse?.profile,
          error: error instanceof Error ? error.message : 'Unknown error',
          hasImages: !!(data.profileImageUrl || data.coverImageUrl)
        };
        localStorage.setItem('profile_backup', JSON.stringify(backup));
        console.log('💾 Complete profile data (including images) backed up to localStorage');
        throw error;
      }
    },
    onSuccess: (result) => {
      console.log('✅ Profile saved successfully:', result);
      queryClient.invalidateQueries({ queryKey: ["/api/social/profile"] });
      setEditMode(false);
      // Update local profile data with successful result
      if (result && typeof result === 'object') {
        setProfileData(prev => ({ ...prev, ...result }));
      }
      // Clear all backups on successful save
      localStorage.removeItem('profile_backup');
      localStorage.removeItem('profile_auto_backup');
      localStorage.removeItem('profile_image_backup');
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully! All changes saved.",
      });
    },
    onError: (error: Error) => {
      console.error('❌ Profile update failed - preserving user changes:', error);
      // Keep edit mode active to preserve user changes
      // Don't exit edit mode so user doesn't lose their changes
      toast({
        title: "Save Failed - Data Preserved",
        description: `Failed to save profile: ${error.message}. Your changes are preserved in the form. Please try saving again.`,
        variant: "destructive",
        duration: 6000, // Show longer for important error message
      });
    },
  });

  // Follow/Unfollow mutation
  const followMutation = useMutation({
    mutationFn: async (targetHandle: string) => {
      const response = await apiRequest('/api/social/follow', {
        method: 'POST',
        body: JSON.stringify({ targetHandle }),
      });
      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate ALL profile and follow queries to force refresh
      queryClient.invalidateQueries({ queryKey: ['/api/social/profile'] });
      queryClient.invalidateQueries({ queryKey: ['/api/social/posts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/social/follow-status'] });
      
      // Force refetch specific profiles
      if (targetUserId) {
        queryClient.refetchQueries({ queryKey: ['/api/social/profile', targetUserId] });
      }
      queryClient.refetchQueries({ queryKey: ['/api/social/profile', authData?.handle] });
      
      const action = data.following ? "followed" : "unfollowed";
      toast({
        title: "Success",
        description: `User ${action} successfully!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Follow",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Check if current user is following target user - BEFORE any conditional returns
  const isFollowingQuery = useQuery({
    queryKey: ['/api/social/follow-status', targetUserId],
    queryFn: async () => {
      if (!targetUserId) return { isFollowing: false };
      // Check if viewing own profile
  const isViewingOwn = targetUserId === authData?.handle || (!targetUserId && !socialProfileMatch);
      if (isViewingOwn) return { isFollowing: false };
      
      const response = await apiRequest(`/api/social/follow-status/${targetUserId}`, { method: 'GET' });
      return response.json();
    },
    enabled: !!targetUserId && !!authData?.handle && isAuthenticated && targetUserId !== authData?.handle
  });

  // Handle follow user functionality
  const handleFollowUser = (userId: string) => {
    followMutation.mutate(userId);
  };

  // Apply dark mode - must be called before any conditional returns
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    if (profileResponse) {
      setProfileData(profileResponse.profile);
      setSessionData(profileResponse.session || null);
    }
  }, [profileResponse]);

  // Check for backup on component load
  useEffect(() => {
    const checkForBackup = () => {
      const hasBackup = localStorage.getItem('profile_backup') || 
                        localStorage.getItem('profile_auto_backup') || 
                        localStorage.getItem('profile_image_backup');
      if (hasBackup && !editMode) {
        toast({
          title: "Unsaved Changes Found",
          description: "You have unsaved profile changes. Click 'Edit Profile' and then 'Recover Data' to restore them.",
          duration: 8000,
        });
      }
    };
    
    setTimeout(checkForBackup, 1000); // Check after initial load
  }, [profileResponse?.profile, editMode]);

  // Search functionality
  useEffect(() => {
    const searchTimer = setTimeout(async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const url = `/api/social/search/users?q=${encodeURIComponent(searchQuery.trim())}&limit=10`;
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }).then(res => res.json() as any);
        setSearchResults(Array.isArray(response) ? response : []);
      } catch (error) {
        console.error('Search failed:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(searchTimer);
  }, [searchQuery]);

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }
  
  // Debug authentication state
  console.log('🔐 [AUTH DEBUG] authData:', authData);
  console.log('🔐 [AUTH DEBUG] isAuthenticated:', isAuthenticated);
  console.log('🔐 [AUTH DEBUG] authLoading:', authLoading);
  
  // Return early if not authenticated (useAuth will handle redirect)
  if (!isAuthenticated) {
    console.log('🔐 [AUTH DEBUG] Not authenticated, returning null');
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">Loading profile...</div>
      </div>
    );
  }

  const profile = profileResponse?.profile;
  
  // Determine if viewing own profile based on route and user match
  const isOwnProfile = isViewingOwnProfile || (!targetUserId && !isViewingOwnProfile);
  
  // Debug profile detection
  console.log('🔍 [PROFILE DEBUG] isViewingOwnProfile (route-based):', isViewingOwnProfile);
  console.log('🔍 [PROFILE DEBUG] targetUserId:', targetUserId);
  console.log('🔍 [PROFILE DEBUG] authData.handle:', authData?.handle);
  console.log('🔍 [PROFILE DEBUG] isOwnProfile (final):', isOwnProfile);
  console.log('🔍 [PROFILE DEBUG] profile data:', profile);

  // Handle profile updates with auto-backup
  const handleInputChange = (field: keyof SocialProfile, value: string) => {
    const newData = { ...profileData, [field]: value };
    setProfileData(newData);
    
    // Auto-backup changes to prevent data loss
    const autoBackup = {
      timestamp: new Date().toISOString(),
      profileData: newData,
      type: 'auto-backup'
    };
    localStorage.setItem('profile_auto_backup', JSON.stringify(autoBackup));
  };

  // Enhanced image upload handling with preservation and cache invalidation
  const handleImageUpdate = (field: 'profileImageUrl' | 'coverImageUrl', url: string) => {
    console.log(`🖼️ Updating ${field} with URL:`, url);
    
    // Add cache buster to force image refresh
    const urlWithCacheBuster = `${url}?t=${Date.now()}`;
    const newData = { ...profileData, [field]: urlWithCacheBuster };
    setProfileData(newData);
    
    // Invalidate query cache to refetch profile data
    queryClient.invalidateQueries({ queryKey: ["/api/social/profile"] });
    
    // Backup image updates immediately
    const imageBackup = {
      timestamp: new Date().toISOString(),
      profileData: newData,
      imageField: field,
      imageUrl: urlWithCacheBuster,
      type: 'image-update'
    };
    localStorage.setItem('profile_image_backup', JSON.stringify(imageBackup));
    
    toast({
      title: "Image Updated",
      description: `${field === 'profileImageUrl' ? 'Profile' : 'Cover'} image updated. The image should appear shortly!`,
    });
  };

  const handleSaveProfile = () => {
    // Validate profile data before saving
    const dataToSave = {
      ...profileData,
      // Ensure all fields are properly formatted
      displayName: profileData.displayName?.trim() || '',
      bio: profileData.bio?.trim() || '',
      location: profileData.location?.trim() || '',
      website: profileData.website?.trim() || '',
      handle: profileData.handle?.trim() || '',
    };
    
    console.log('💾 Saving profile with validated data:', dataToSave);
    updateProfileMutation.mutate(dataToSave);
  };

  // Enhanced recovery function with multiple backup sources
  const recoverFromBackup = () => {
    try {
      // Try main backup first
      let backup = localStorage.getItem('profile_backup');
      let backupType = 'manual';
      
      // If no main backup, try auto-backup
      if (!backup) {
        backup = localStorage.getItem('profile_auto_backup');
        backupType = 'auto';
      }
      
      // If no auto-backup, try image backup
      if (!backup) {
        backup = localStorage.getItem('profile_image_backup');
        backupType = 'image';
      }
      
      if (backup) {
        const parsed = JSON.parse(backup);
        setProfileData(parsed.profileData);
        setEditMode(true);
        
        const imageInfo = parsed.hasImages || parsed.imageField ? ' (including images)' : '';
        toast({
          title: "Data Recovered",
          description: `Restored your unsaved ${backupType} changes${imageInfo} from ${new Date(parsed.timestamp).toLocaleString()}`,
          duration: 5000,
        });
        return true;
      }
    } catch (error) {
      console.error('Failed to recover backup:', error);
      toast({
        title: "Recovery Failed",
        description: "Could not recover backup data. Please try again.",
        variant: "destructive",
      });
    }
    return false;
  };


  return (
    <div className="min-h-screen bg-white dark:bg-black">
      {/* Twitter-style Header */}
      <div className="sticky top-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur border-b dark:border-gray-800">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              className="rounded-full hover:bg-gray-100 dark:hover:bg-gray-900 text-gray-700 dark:text-gray-200"
              onClick={() => window.history.back()}
            >
              <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-200" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {profile?.displayName || profile?.handle || 'Profile'}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                {profile?.handle ? `@${profile.handle}` : 'No posts yet'}
                {sessionData?.connected && (
                  <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                    Connected
                  </span>
                )}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full hover:bg-gray-100 dark:hover:bg-gray-900 text-gray-700 dark:text-gray-200"
              onClick={() => setDarkMode(!darkMode)}
            >
              {darkMode ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5 text-gray-700" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="border-b dark:border-gray-800 bg-white dark:bg-black px-4 py-3">
        <div className="relative max-w-xl mx-auto">{/* Container for search input and dropdown */}
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
          <Input
            type="text"
            placeholder="Search members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10 rounded-full bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 rounded-full h-8 w-8"
              onClick={() => setSearchQuery("")}
            >
              <X className="w-4 h-4" />
            </Button>
          )}

          {/* Search Results Dropdown */}
          {searchQuery.trim() && searchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
            {searchResults.map((user: any) => (
              <div
                key={user.id}
                className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                onClick={() => {
                  setLocation(`/social-profile/${user.handle}`);
                  setSearchQuery("");
                  setSearchResults([]);
                }}
              >
                <Avatar className="w-10 h-10">
                  <AvatarImage src={user.profileImageUrl} />
                  <AvatarFallback>{user.displayName?.[0] || user.handle?.[0] || '?'}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="font-semibold">{user.displayName || user.handle}</div>
                  <div className="text-sm text-gray-500">@{user.handle}</div>
                  {user.bio && (
                    <div className="text-sm text-gray-600 truncate">{user.bio}</div>
                  )}
                </div>
              </div>
            ))}
            </div>
          )}

          {isSearching && searchQuery.trim() && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-lg shadow-lg z-50 p-4 text-center text-gray-500 dark:text-gray-400">
              Searching...
            </div>
          )}
          
          {/* Debug search results */}
          {searchQuery.trim() && !isSearching && searchResults.length === 0 && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-lg shadow-lg z-50 p-4 text-center text-gray-500 dark:text-gray-400">
              No users found for "{searchQuery}"
            </div>
          )}
        </div>
      </div>

      {/* Profile Section - Enhanced Prominence */}
      <div className="bg-white dark:bg-gray-900 border dark:border-gray-700 shadow-lg">{/* Make profile section more prominent */}
        {/* Cover Photo */}
        <div className="relative h-48 bg-gray-300 dark:bg-gray-800">
          {profile?.coverImageUrl ? (
            <img 
              src={profile.coverImageUrl} 
              alt="Cover" 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-blue-400 via-purple-500 to-indigo-600" />
          )}
          
          {editMode && (
            <div className="absolute top-4 right-4">
              <PhotoUploader
                type="cover"
                onUploadSuccess={(url: string) => {
                  handleImageUpdate("coverImageUrl", url);
                }}
                onUploadError={(error: string) => {
                  toast({
                    title: "Upload Failed",
                    description: error,
                    variant: "destructive",
                  });
                }}
                buttonStyle={{
                  background: 'rgba(0, 0, 0, 0.5)',
                  color: 'white',
                  border: 'none',
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                <Camera className="w-4 h-4" />
                Change Cover
              </PhotoUploader>
            </div>
          )}
        </div>

        {/* Profile Info Section - Enhanced Box */}
        <div className="px-6 py-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">{/* More prominent info box */}
          {/* Profile Picture - Twitter style positioning */}
          <div className="relative -mt-16 mb-4">
            <div className="relative inline-block">
              <Avatar className="w-32 h-32 border-4 border-white dark:border-black">
                <AvatarImage src={profileData.profileImageUrl || profile?.profileImageUrl} />
                <AvatarFallback className="text-3xl bg-gradient-to-r from-blue-400 to-purple-500 text-white">
                  {profileData.displayName || profile?.displayName?.[0] || profile?.handle?.[0] || <User className="w-12 h-12" />}
                </AvatarFallback>
              </Avatar>
              
              {editMode && (
                <div className="absolute bottom-0 right-0">
                  <PhotoUploader
                    type="profile"
                    onUploadSuccess={(url: string) => {
                      handleImageUpdate("profileImageUrl", url);
                    }}
                    onUploadError={(error: string) => {
                      toast({
                        title: "Upload Failed",
                        description: error,
                        variant: "destructive",
                      });
                    }}
                    buttonStyle={{
                      width: '2.5rem',
                      height: '2.5rem',
                      borderRadius: '50%',
                      background: 'white',
                      border: '2px solid #e5e7eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    }}
                  >
                    <Camera className="w-4 h-4 text-gray-600" />
                  </PhotoUploader>
                </div>
              )}
            </div>

            {/* Edit Profile Button / Follow Button */}
            <div className="absolute right-0 top-4">
              {isOwnProfile ? (
                // Show edit profile options for own profile
                !editMode ? (
                  <Button
                    onClick={() => setEditMode(true)}
                    variant="outline"
                    className="rounded-full font-semibold bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Edit profile
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      onClick={recoverFromBackup}
                      variant="outline"
                      size="sm"
                      className="rounded-full text-xs px-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Recover
                    </Button>
                    <Button
                      onClick={() => {
                        setEditMode(false);
                        setProfileData(profile || {});
                        // Clear auto-backup when user explicitly cancels
                        localStorage.removeItem('profile_auto_backup');
                      }}
                      variant="outline"
                      className="rounded-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveProfile}
                      className="rounded-full bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-600 dark:hover:bg-blue-700"
                      disabled={updateProfileMutation.isPending}
                    >
                      {updateProfileMutation.isPending ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                )
              ) : (
                // Show follow/unfollow button for other users' profiles
                <div className="flex gap-2">
                  <Button
                    variant={isFollowingQuery.data?.isFollowing ? "outline" : "default"}
                    onClick={() => {
                      if (targetUserId) {
                        handleFollowUser(targetUserId);
                      }
                    }}
                    disabled={followMutation.isPending}
                    className={`rounded-full font-semibold transition-all ${
                      isFollowingQuery.data?.isFollowing 
                        ? 'bg-red-500 hover:bg-red-600 text-white border-red-500 hover:border-red-600' 
                        : 'bg-blue-500 hover:bg-blue-600 text-white border-blue-500 hover:border-blue-600'
                    }`}
                  >
                    {followMutation.isPending 
                      ? 'Loading...' 
                      : isFollowingQuery.data?.isFollowing 
                        ? 'Unfollow' 
                        : 'Follow'
                    }
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (targetUserId) {
                        console.log('💬 [MESSAGE BUTTON] Clicked for user:', targetUserId);
                        handleMessageUser(targetUserId);
                      } else {
                        console.error('💬 [MESSAGE BUTTON] No target user ID');
                        toast({
                          title: "Unable to Message",
                          description: "User information not available",
                          variant: "destructive",
                        });
                      }
                    }}
                    disabled={startConversationMutation.isPending || isCreatingConversation}
                    className="rounded-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 px-4"
                    data-testid="button-message-user"
                  >
                    <MessageCircle className="w-4 h-4" />
                    {startConversationMutation.isPending || isCreatingConversation ? 'Starting...' : 'Message'}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Profile Details - Enhanced Contrast Box */}
          <div className="pb-4 px-4 py-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm mt-4">{/* Prominent details box */}
            {editMode ? (
              <div className="space-y-4">
                <Input
                  placeholder="Display Name"
                  value={profileData.displayName || ''}
                  onChange={(e) => handleInputChange('displayName', e.target.value)}
                  className="text-xl font-bold"
                />
                {/* Handle input - disabled if from session */}
                <div className="space-y-1">
                  <Input
                    placeholder="@handle"
                    value={sessionData?.handle || profileData.handle || ''}
                    disabled={!!sessionData?.connected}
                    onChange={(e) => handleInputChange('handle', e.target.value)}
                    className="text-gray-500 disabled:opacity-70 disabled:cursor-not-allowed"
                  />
                  {sessionData?.connected && (
                    <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      Connected session - handle cannot be changed
                    </p>
                  )}
                </div>
                <Textarea
                  placeholder="Bio"
                  value={profileData.bio || ''}
                  onChange={(e) => handleInputChange('bio', e.target.value)}
                  rows={3}
                />
                <Input
                  placeholder="Location"
                  value={profileData.location || ''}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                />
                <Input
                  placeholder="Website"
                  value={profileData.website || ''}
                  onChange={(e) => handleInputChange('website', e.target.value)}
                />
                
                {/* Social Media Links Section */}
                <div className="space-y-3 pt-4 border-t">
                  <h4 className="font-semibold text-gray-700 dark:text-gray-300">Social Media Links</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input
                      placeholder="Twitter Username (without @)"
                      value={profileData.twitterUsername || ''}
                      onChange={(e) => handleInputChange('twitterUsername', e.target.value)}
                    />
                    <Input
                      placeholder="Instagram Username (without @)"
                      value={profileData.instagramUsername || ''}
                      onChange={(e) => handleInputChange('instagramUsername', e.target.value)}
                    />
                    <Input
                      placeholder="Telegram Username (without @)"
                      value={profileData.telegramUsername || ''}
                      onChange={(e) => handleInputChange('telegramUsername', e.target.value)}
                    />
                    <Input
                      placeholder="Discord Username"
                      value={profileData.discordUsername || ''}
                      onChange={(e) => handleInputChange('discordUsername', e.target.value)}
                    />
                    <Input
                      placeholder="YouTube Channel URL"
                      value={profileData.youtubeChannel || ''}
                      onChange={(e) => handleInputChange('youtubeChannel', e.target.value)}
                    />
                    <Input
                      placeholder="TikTok Username (without @)"
                      value={profileData.tiktokUsername || ''}
                      onChange={(e) => handleInputChange('tiktokUsername', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-bold text-black dark:text-white">
                  {profile?.displayName || 'Anonymous User'}
                </h2>
                <p className="text-gray-600 dark:text-gray-300">@{profile?.handle || 'anonymous'}</p>
                
                {/* Follower/Following Counts */}
                <div className="flex gap-4 mt-3 text-sm">
                  <span className="text-gray-900 dark:text-gray-100">
                    <span className="font-bold">{profile?.followingCount || 0}</span>
                    <span className="text-gray-500 ml-1">Following</span>
                  </span>
                  <span className="text-gray-900 dark:text-gray-100">
                    <span className="font-bold">{profile?.followersCount || 0}</span>
                    <span className="text-gray-500 ml-1">Followers</span>
                  </span>
                </div>
                
                {profile?.bio && (
                  <p className="mt-3 text-black dark:text-white font-medium">{profile.bio}</p>
                )}
                
                <div className="flex flex-wrap gap-3 mt-3 text-sm text-gray-700 dark:text-gray-200 font-medium">{/* Better contrast */}
                  {profile?.location && (
                    <div className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {profile.location}
                    </div>
                  )}
                  {profile?.website && (
                    <div className="flex items-center gap-1">
                      <LinkIcon className="w-4 h-4" />
                      <a href={profile.website} className="text-blue-500 hover:underline">
                        {profile.website}
                      </a>
                    </div>
                  )}
                  
                  {/* Social Media Cards Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-4">
                    {profile?.twitterUsername && (
                      <a 
                        href={`https://twitter.com/${profile.twitterUsername}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-3 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg border border-blue-200 dark:border-blue-700 hover:shadow-md transition-all duration-200 hover:scale-105"
                      >
                        <Twitter className="w-5 h-5 text-blue-500" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs text-gray-600 dark:text-gray-400">Twitter</span>
                          <span className="text-sm font-medium text-blue-600 dark:text-blue-400 truncate">@{profile.twitterUsername}</span>
                        </div>
                      </a>
                    )}
                    
                    {profile?.instagramUsername && (
                      <a 
                        href={`https://instagram.com/${profile.instagramUsername}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-3 bg-gradient-to-r from-pink-50 to-purple-100 dark:from-pink-900/20 dark:to-purple-800/20 rounded-lg border border-pink-200 dark:border-pink-700 hover:shadow-md transition-all duration-200 hover:scale-105"
                      >
                        <Instagram className="w-5 h-5 text-pink-500" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs text-gray-600 dark:text-gray-400">Instagram</span>
                          <span className="text-sm font-medium text-pink-600 dark:text-pink-400 truncate">@{profile.instagramUsername}</span>
                        </div>
                      </a>
                    )}
                    
                    {profile?.facebookUsername && (
                      <a 
                        href={`https://facebook.com/${profile.facebookUsername}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-3 bg-gradient-to-r from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-800/20 rounded-lg border border-blue-200 dark:border-blue-700 hover:shadow-md transition-all duration-200 hover:scale-105"
                      >
                        <Facebook className="w-5 h-5 text-blue-600" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs text-gray-600 dark:text-gray-400">Facebook</span>
                          <span className="text-sm font-medium text-blue-700 dark:text-blue-400 truncate">{profile.facebookUsername}</span>
                        </div>
                      </a>
                    )}
                    
                    {profile?.linkedinUsername && (
                      <a 
                        href={`https://linkedin.com/in/${profile.linkedinUsername}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-3 bg-gradient-to-r from-blue-50 to-cyan-100 dark:from-blue-900/20 dark:to-cyan-800/20 rounded-lg border border-blue-200 dark:border-blue-700 hover:shadow-md transition-all duration-200 hover:scale-105"
                      >
                        <Linkedin className="w-5 h-5 text-blue-700" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs text-gray-600 dark:text-gray-400">LinkedIn</span>
                          <span className="text-sm font-medium text-blue-700 dark:text-blue-400 truncate">{profile.linkedinUsername}</span>
                        </div>
                      </a>
                    )}
                    
                    {profile?.youtubeChannel && (
                      <a 
                        href={profile.youtubeChannel} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-3 bg-gradient-to-r from-red-50 to-orange-100 dark:from-red-900/20 dark:to-orange-800/20 rounded-lg border border-red-200 dark:border-red-700 hover:shadow-md transition-all duration-200 hover:scale-105"
                      >
                        <Youtube className="w-5 h-5 text-red-500" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs text-gray-600 dark:text-gray-400">YouTube</span>
                          <span className="text-sm font-medium text-red-600 dark:text-red-400 truncate">Channel</span>
                        </div>
                      </a>
                    )}
                    
                    {profile?.tiktokUsername && (
                      <a 
                        href={`https://tiktok.com/@${profile.tiktokUsername}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-3 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900/20 dark:to-gray-800/20 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-200 hover:scale-105"
                      >
                        <MessageCircle className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs text-gray-600 dark:text-gray-400">TikTok</span>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">@{profile.tiktokUsername}</span>
                        </div>
                      </a>
                    )}
                    
                    {profile?.telegramUsername && (
                      <a 
                        href={`https://t.me/${profile.telegramUsername}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-3 bg-gradient-to-r from-blue-50 to-sky-100 dark:from-blue-900/20 dark:to-sky-800/20 rounded-lg border border-blue-200 dark:border-blue-700 hover:shadow-md transition-all duration-200 hover:scale-105"
                      >
                        <MessageCircle className="w-5 h-5 text-blue-500" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs text-gray-600 dark:text-gray-400">Telegram</span>
                          <span className="text-sm font-medium text-blue-600 dark:text-blue-400 truncate">@{profile.telegramUsername}</span>
                        </div>
                      </a>
                    )}
                    
                    {profile?.discordUsername && (
                      <a 
                        href={`https://discord.com/users/${profile.discordUsername}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-3 bg-gradient-to-r from-indigo-50 to-purple-100 dark:from-indigo-900/20 dark:to-purple-800/20 rounded-lg border border-indigo-200 dark:border-indigo-700 hover:shadow-md transition-all duration-200 hover:scale-105"
                      >
                        <MessageCircle className="w-5 h-5 text-indigo-500" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs text-gray-600 dark:text-gray-400">Discord</span>
                          <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400 truncate">{profile.discordUsername}</span>
                        </div>
                      </a>
                    )}
                    
                    {profile?.githubUsername && (
                      <a 
                        href={`https://github.com/${profile.githubUsername}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-3 bg-gradient-to-r from-gray-50 to-slate-100 dark:from-gray-900/20 dark:to-slate-800/20 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-200 hover:scale-105"
                      >
                        <Github className="w-5 h-5 text-gray-800 dark:text-gray-200" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs text-gray-600 dark:text-gray-400">GitHub</span>
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">@{profile.githubUsername}</span>
                        </div>
                      </a>
                    )}
                    
                    {profile?.twitchUsername && (
                      <a 
                        href={`https://twitch.tv/${profile.twitchUsername}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-3 bg-gradient-to-r from-purple-50 to-violet-100 dark:from-purple-900/20 dark:to-violet-800/20 rounded-lg border border-purple-200 dark:border-purple-700 hover:shadow-md transition-all duration-200 hover:scale-105"
                      >
                        <Tv className="w-5 h-5 text-purple-600" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs text-gray-600 dark:text-gray-400">Twitch</span>
                          <span className="text-sm font-medium text-purple-600 dark:text-purple-400 truncate">{profile.twitchUsername}</span>
                        </div>
                      </a>
                    )}
                  </div>
                  {profile?.createdAt && (
                    <div className="flex items-center gap-1">
                      <CalendarDays className="w-4 h-4" />
                      Joined {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </div>
                  )}
                </div>

              </>
            )}
          </div>
        </div>

        {/* Tabs Section - Enhanced Box */}
        <Tabs defaultValue="posts" className="w-full bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <TabsList className="w-full justify-start border-b dark:border-gray-700 rounded-none h-auto p-0 bg-white dark:bg-gray-800">{/* More prominent tabs */}
            <TabsTrigger 
              value="posts" 
              className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 pb-3 text-black dark:text-white data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 font-semibold"
            >
              Riddles
            </TabsTrigger>
            <TabsTrigger 
              value="replies" 
              className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 pb-3 text-black dark:text-white data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 font-semibold"
            >
              Replies
            </TabsTrigger>
            <TabsTrigger 
              value="media" 
              className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 pb-3 text-black dark:text-white data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 font-semibold"
            >
              Media
            </TabsTrigger>
            <TabsTrigger 
              value="likes" 
              className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 pb-3 text-black dark:text-white data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 font-semibold"
            >
              Likes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="mt-0">
            {/* Post Creation Form - Only show for own profile */}
            {isOwnProfile && (
              <div className="p-4 border-b dark:border-gray-700 bg-white dark:bg-gray-900">
                <div className="flex gap-3">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={profile?.profileImageUrl} />
                    <AvatarFallback className="bg-gradient-to-r from-blue-400 to-purple-500 text-white">
                      {profile?.displayName?.[0] || profile?.handle?.[0] || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <Textarea
                      placeholder="What's your riddle?"
                      value={postContent}
                      onChange={(e) => setPostContent(e.target.value)}
                      className="min-h-[100px] border-none resize-none text-xl placeholder:text-gray-500 bg-transparent text-gray-900 dark:text-gray-100 focus:outline-none"
                      maxLength={280}
                    />
                    <div className="flex justify-between items-center mt-3">
                      <span className="text-sm text-gray-500">
                        {postContent.length}/280
                      </span>
                      <Button
                        onClick={() => createPostMutation.mutate(postContent)}
                        disabled={!postContent.trim() || createPostMutation.isPending}
                        className="rounded-full bg-blue-600 hover:bg-blue-700 text-white px-6 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {createPostMutation.isPending ? 'Sharing...' : 'Share Riddle'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Posts Feed */}
            <div className="divide-y dark:divide-gray-700">
              {postsLoading ? (
                <div className="p-8 text-center text-gray-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  Loading posts...
                </div>
              ) : posts && posts.length > 0 ? (
                posts.map((post: any) => (
                  <div key={post.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 bg-white dark:bg-gray-900">
                    <div className="flex gap-3">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={profile?.profileImageUrl} />
                        <AvatarFallback className="bg-gradient-to-r from-blue-400 to-purple-500 text-white">
                          {profile?.displayName?.[0] || profile?.handle?.[0] || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 dark:text-gray-100">
                            {profile?.displayName || profile?.handle}
                          </span>
                          <span className="text-gray-500">@{profile?.handle}</span>
                          <span className="text-gray-500">·</span>
                          <span className="text-gray-500">
                            {new Date(post.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="mt-1 text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                          {post.content}
                        </p>
                        
                        {/* Quoted Post Display (Twitter-style embedded card) */}
                        {post.isQuote && post.quotedPostId && (
                          <div className="mt-3 border border-gray-200 dark:border-gray-700 rounded-xl p-3 bg-gray-50 dark:bg-gray-800/50">
                            <div className="flex gap-2">
                              <Avatar className="w-8 h-8">
                                <AvatarImage src={post.quotedPost?.author?.profileImageUrl} />
                                <AvatarFallback className="bg-gradient-to-r from-purple-400 to-pink-500 text-white text-xs">
                                  {post.quotedPost?.author?.displayName?.[0] || '?'}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1 text-sm">
                                  <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                                    {post.quotedPost?.author?.displayName || 'User'}
                                  </span>
                                  <span className="text-gray-500 truncate">
                                    @{post.quotedPost?.author?.handle || 'user'}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 break-words">
                                  {post.quotedPost?.content || 'Original post content'}
                                </p>
                                {post.quotedPost?.imageUrls?.length > 0 && (
                                  <img 
                                    src={post.quotedPost.imageUrls[0]} 
                                    alt="Quoted post image" 
                                    className="mt-2 rounded-lg max-w-full h-auto max-h-32 object-cover"
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-6 mt-3 text-gray-500">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="flex items-center gap-1 hover:bg-blue-100 dark:hover:bg-blue-900/50 hover:text-blue-700 dark:hover:text-blue-300 text-gray-600 dark:text-gray-400 transition-all duration-200 hover:scale-105"
                            onClick={() => setQuoteDialogOpen({ open: true, postId: post.id, originalPost: post })}
                          >
                            <MessageCircle className="w-4 h-4" />
                            {post.commentsCount || 0}
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="flex items-center gap-1 hover:bg-green-100 dark:hover:bg-green-900/50 hover:text-green-700 dark:hover:text-green-300 text-gray-600 dark:text-gray-400 transition-all duration-200 hover:scale-105"
                            onClick={() => retweetPostMutation.mutate(post.id)}
                            disabled={retweetPostMutation.isPending}
                          >
                            <Repeat2 className="w-4 h-4" />
                            {post.sharesCount || 0}
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="flex items-center gap-1 hover:bg-red-100 dark:hover:bg-red-900/50 hover:text-red-700 dark:hover:text-red-300 text-gray-600 dark:text-gray-400 transition-all duration-200 hover:scale-105"
                            onClick={() => likePostMutation.mutate(post.id)}
                            disabled={likePostMutation.isPending}
                          >
                            <Heart className="w-4 h-4" />
                            {post.likesCount || 0}
                          </Button>
                          <Button variant="ghost" size="sm" className="hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-gray-500 bg-white dark:bg-gray-900">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                  <p className="text-lg font-medium text-gray-700 dark:text-gray-300">No riddles yet</p>
                  <p className="text-sm">Share your first riddle with the community!</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="replies">
            <div className="divide-y dark:divide-gray-700">
              {repliesLoading ? (
                <div className="p-8 text-center text-gray-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  Loading replies...
                </div>
              ) : userReplies && userReplies.length > 0 ? (
                userReplies.map((reply: any) => (
                  <div key={reply.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 bg-white dark:bg-gray-900">
                    <div className="flex gap-3">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={profile?.profileImageUrl} />
                        <AvatarFallback className="bg-gradient-to-r from-blue-400 to-purple-500 text-white">
                          {profile?.displayName?.[0] || profile?.handle?.[0] || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 dark:text-gray-100">
                            {profile?.displayName || profile?.handle}
                          </span>
                          <span className="text-gray-500">@{profile?.handle}</span>
                          <span className="text-gray-500">·</span>
                          <span className="text-gray-500">
                            {new Date(reply.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="mt-1 text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                          {reply.content}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                  <p className="font-semibold">No replies yet</p>
                  <p className="text-sm mt-1">Your replies to posts will appear here.</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="media">
            <div className="p-4">
              {(profile?.profileImageUrl || profile?.coverImageUrl) ? (
                <div className="grid grid-cols-3 gap-1">
                  {profile?.profileImageUrl && (
                    <div className="aspect-square bg-gray-100 dark:bg-gray-800">
                      <img 
                        src={profile.profileImageUrl} 
                        alt="Profile" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  {profile?.coverImageUrl && (
                    <div className="aspect-square bg-gray-100 dark:bg-gray-800 col-span-2">
                      <img 
                        src={profile.coverImageUrl} 
                        alt="Cover" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <Camera className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                  <p className="font-semibold">No media yet</p>
                  <p className="text-sm mt-1">Photos and videos will appear here.</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="likes">
            <div className="divide-y dark:divide-gray-700">
              {likedPostsLoading ? (
                <div className="p-8 text-center text-gray-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  Loading liked posts...
                </div>
              ) : likedPosts && likedPosts.length > 0 ? (
                likedPosts.map((post: any) => (
                  <div key={post.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 bg-white dark:bg-gray-900">
                    <div className="flex gap-3">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={post.authorProfileImage} />
                        <AvatarFallback className="bg-gradient-to-r from-blue-400 to-purple-500 text-white">
                          {post.authorDisplayName?.[0] || post.authorHandle?.[0] || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 dark:text-gray-100">
                            {post.authorDisplayName || post.authorHandle}
                          </span>
                          <span className="text-gray-500">@{post.authorHandle}</span>
                          <span className="text-gray-500">·</span>
                          <span className="text-gray-500">
                            {new Date(post.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="mt-1 text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                          {post.content}
                        </p>
                        
                        {/* Show like indicator */}
                        <div className="flex items-center gap-1 mt-2 text-red-500">
                          <Heart className="w-4 h-4 fill-current" />
                          <span className="text-sm">You liked this</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <Heart className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                  <p className="font-semibold">No likes yet</p>
                  <p className="text-sm mt-1">Posts you like will appear here.</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Quote Dialog */}
      {quoteDialogOpen.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Quote Riddle</h3>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setQuoteDialogOpen({ open: false })}
                  className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  ✕
                </Button>
              </div>
              
              {/* Quote input */}
              <textarea
                value={quoteContent}
                onChange={(e) => setQuoteContent(e.target.value)}
                placeholder="Add your comment..."
                className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                rows={3}
                maxLength={280}
              />
              
              <div className="text-right text-sm text-gray-500 mb-4">
                {quoteContent.length}/280
              </div>
              
              {/* Original post preview (Twitter-style card) */}
              {quoteDialogOpen.originalPost && (
                <div className="border border-gray-200 dark:border-gray-600 rounded-xl p-3 bg-gray-50 dark:bg-gray-700/50 mb-4">
                  <div className="flex gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={profile?.profileImageUrl} />
                      <AvatarFallback className="bg-gradient-to-r from-blue-400 to-purple-500 text-white">
                        {profile?.displayName?.[0] || profile?.handle?.[0] || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {profile?.displayName || profile?.handle}
                        </span>
                        <span className="text-gray-500">@{profile?.handle}</span>
                        <span className="text-gray-500">·</span>
                        <span className="text-gray-500">
                          {quoteDialogOpen.originalPost.createdAt && new Date(quoteDialogOpen.originalPost.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                        {quoteDialogOpen.originalPost.content}
                      </p>
                      {quoteDialogOpen.originalPost.imageUrls?.length > 0 && (
                        <img 
                          src={quoteDialogOpen.originalPost.imageUrls[0]} 
                          alt="Original post image" 
                          className="mt-2 rounded-lg max-w-full h-auto max-h-48 object-cover"
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Action buttons */}
              <div className="flex gap-3 justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => setQuoteDialogOpen({ open: false })}
                  className="px-6"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleQuoteSubmit}
                  disabled={!quoteContent.trim() || quoteTweetMutation.isPending}
                  className="px-6 bg-blue-500 hover:bg-blue-600 text-white"
                >
                  {quoteTweetMutation.isPending ? 'Quoting...' : 'Quote Riddle'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
