import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Box, CircularProgress } from "@mui/material";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { NewsfeedHeader } from "@/components/newsfeed/NewsfeedHeader";
import { PostCreator } from "@/components/newsfeed/PostCreator";
import { PostCard, NewsfeedPost, PostComment } from "@/components/newsfeed/PostCard";
import { AlgorithmStatsPanel } from "@/components/newsfeed/AlgorithmStatsPanel";

interface AlgorithmStats {
  totalPosts: number;
  uniqueAuthors: number;
  averageAgeHours: number;
  priorityPosts: number;
  priorityAccounts: string[];
  config: any;
}

export default function NewsfeedPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { authData, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [showStats, setShowStats] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [allPosts, setAllPosts] = useState<NewsfeedPost[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Fetch initial newsfeed posts
  const { data: posts, isLoading: postsLoading, refetch: refetchPosts } = useQuery<NewsfeedPost[]>({
    queryKey: ["/api/social/newsfeed", refreshKey],
    queryFn: async () => {
      const response = await apiRequest("/api/social/newsfeed?limit=20&offset=0", { method: "GET" });
      const data = await response.json() as any;
      setAllPosts(data);
      setHasMore(data.length === 20);
      return data;
    },
    enabled: isAuthenticated,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Load more posts function
  const loadMorePosts = async () => {
    if (isLoadingMore || !hasMore) return;
    
    setIsLoadingMore(true);
    try {
      const response = await apiRequest(`/api/social/newsfeed?limit=20&offset=${allPosts.length}`, { method: "GET" });
      const newPosts = await response.json() as any;
      
      if (newPosts.length === 0) {
        setHasMore(false);
      } else {
        setAllPosts(prev => [...prev, ...newPosts]);
        setHasMore(newPosts.length === 20);
      }
    } catch (error) {
      console.error("Failed to load more posts:", error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadMorePosts();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, allPosts.length]);

  // Fetch algorithm stats
  const { data: stats, isLoading: statsLoading } = useQuery<AlgorithmStats>({
    queryKey: ["/api/social/newsfeed/stats"],
    queryFn: async () => {
      const response = await apiRequest("/api/social/newsfeed/stats", { method: "GET" });
      return response.json();
    },
    enabled: isAuthenticated && showStats,
  });

  // Fetch user's liked posts
  const { data: likedPostIds, isLoading: likedPostsLoading, refetch: refetchLikedPosts } = useQuery<number[]>({
    queryKey: ["/api/posts/liked"],
    queryFn: async () => {
      const response = await apiRequest("/api/posts/liked", { method: "GET" });
      const data = await response.json() as any;
      return Array.isArray(data) ? data : (data?.likedPostIds || []);
    },
    enabled: isAuthenticated,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Fetch algorithm presets
  const { data: presets } = useQuery({
    queryKey: ["/api/social/newsfeed/presets"],
    queryFn: async () => {
      const response = await apiRequest("/api/social/newsfeed/presets", { method: "GET" });
      return response.json();
    },
    enabled: isAuthenticated && showStats,
  });

  // Apply preset mutation
  const applyPresetMutation = useMutation({
    mutationFn: async (presetName: string) => {
      const response = await apiRequest(`/api/social/newsfeed/preset/${presetName}`, {
        method: "POST",
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Algorithm Updated",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/social/newsfeed"] });
      setRefreshKey(prev => prev + 1);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Update Algorithm",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Create post mutation
  const createPostMutation = useMutation({
    mutationFn: async ({ content, imageUrl }: { content: string; imageUrl?: string }) => {
      const response = await apiRequest("/api/social/posts", {
        method: "POST",
        body: JSON.stringify({ 
          content, 
          imageUrls: imageUrl ? [imageUrl] : undefined 
        }),
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Post Created",
        description: "Your riddle has been shared!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/social/newsfeed"] });
      setRefreshKey(prev => prev + 1);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Create Post",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Like post mutation
  const likePostMutation = useMutation({
    mutationFn: async (postId: number) => {
      const response = await apiRequest(`/api/social/posts/${postId}/like`, {
        method: "POST",
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social/newsfeed"] });
      refetchLikedPosts();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Like Post",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Retweet mutation
  const retweetMutation = useMutation({
    mutationFn: async (postId: number) => {
      const response = await apiRequest(`/api/social/posts/${postId}/retweet`, {
        method: "POST",
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Retweeted",
        description: "Riddle shared to your followers!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/social/newsfeed"] });
      setRefreshKey(prev => prev + 1);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Retweet",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Quote mutation
  const quoteMutation = useMutation({
    mutationFn: async ({ postId, content }: { postId: number; content: string }) => {
      const response = await apiRequest(`/api/social/posts/${postId}/quote`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Quote Posted",
        description: "Your quote has been shared!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/social/newsfeed"] });
      setRefreshKey(prev => prev + 1);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Quote",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: async ({ postId, content }: { postId: number; content: string }) => {
      const response = await apiRequest(`/api/social/posts/${postId}/comments`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Comment Added",
        description: "Your comment has been posted!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/social/newsfeed"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Add Comment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    setAllPosts([]);
    setHasMore(true);
  };

  const handleCreatePost = (content: string, imageUrl?: string) => {
    createPostMutation.mutate({ content, imageUrl });
  };

  const handleLikePost = (postId: number) => {
    likePostMutation.mutate(postId);
  };

  const handleRetweet = (postId: number) => {
    retweetMutation.mutate(postId);
  };

  const handleQuote = (postId: number, content: string) => {
    quoteMutation.mutate({ postId, content });
  };

  const handleAddComment = (postId: number, content: string) => {
    addCommentMutation.mutate({ postId, content });
  };

  const handleProfileClick = (handle: string) => {
    setLocation(`/profile/${handle}`);
  };

  if (!isAuthenticated) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <NewsfeedHeader 
        onRefresh={handleRefresh}
        onToggleStats={() => setShowStats(!showStats)}
      />

      <Box sx={{ maxWidth: '800px', mx: 'auto', p: 3 }}>
        {showStats && (
          <AlgorithmStatsPanel
            stats={stats || null}
            presets={presets}
            isLoading={statsLoading}
            onApplyPreset={(presetName) => applyPresetMutation.mutate(presetName)}
            isApplying={applyPresetMutation.isPending}
          />
        )}

        <PostCreator
          onSubmit={handleCreatePost}
          isSubmitting={createPostMutation.isPending}
        />

        {postsLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : allPosts.length > 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {allPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                isLiked={likedPostIds?.includes(post.id) || false}
                onLike={() => handleLikePost(post.id)}
                onRetweet={() => handleRetweet(post.id)}
                onQuote={(content) => handleQuote(post.id, content)}
                onComment={(content) => handleAddComment(post.id, content)}
                onProfileClick={handleProfileClick}
              />
            ))}

            {/* Infinite scroll trigger */}
            <div ref={loadMoreRef} style={{ height: '1px' }} />

            {isLoadingMore && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={24} />
              </Box>
            )}

            {!hasMore && allPosts.length > 0 && (
              <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                You've reached the end of the feed
              </Box>
            )}
          </Box>
        ) : (
          <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
            <p>No posts yet. Be the first to share a riddle!</p>
          </Box>
        )}
      </Box>
    </Box>
  );
}
