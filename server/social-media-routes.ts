import { Express, Response } from "express";
import { AuthenticatedRequest, readOnlyAuth } from "./middleware/session-auth";

// Import extended Request interface that includes user property
type ExtendedRequest = AuthenticatedRequest;
import { socialMediaService } from "./social-media-service";
import { requireAuthentication } from "./middleware/session-auth";
import { db } from './db';
import { sql, eq } from 'drizzle-orm';
import { posts } from '../shared/schema';
import { newsfeedAlgorithm, ALGORITHM_PRESETS } from './newsfeed-algorithm';

// Unified auth middleware that normalizes user identity from any auth source
const unifiedAuth = async (req: ExtendedRequest, res: Response, next: any) => {
  try {
    // Try session-based authentication first (most secure)
    await requireAuthentication(req, res, (error?: any) => {
      if (!error && req.user?.userHandle) {
        // Session auth succeeded - normalize the identity
        req.normalizedUser = {
          handle: req.user.userHandle,
          walletAddress: (req.user as any).walletAddress,
          source: 'session'
        };
        console.log('🔐 Unified auth: Using session auth for', req.normalizedUser.handle);
        return next();
      }
      
      // Session auth failed - return 401
      console.log('❌ Unified auth: Authentication required');
      return res.status(401).json({ error: 'Authentication required' });
    });
  } catch (error) {
    console.error('❌ Unified auth error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
};

// Security middleware to enforce users can only update their own profiles
const requireSelfOrAdmin = (req: ExtendedRequest, res: Response, next: any) => {
  const requestedHandle = req.params.handle;
  const authenticatedHandle = req.user?.userHandle;
  
  if (!authenticatedHandle) {
    return res.status(401).json({ 
      error: 'Authentication required',
      code: 'NO_AUTH'
    });
  }
  
  // For now, only allow self-authorization (users can only edit their own profiles)
  // TODO: Implement proper role-based authorization when admin system is needed
  if (requestedHandle === authenticatedHandle) {
    console.log(`🔐 Authorization granted: ${authenticatedHandle} (self) editing ${requestedHandle}`);
    return next();
  }
  
  console.log(`❌ Authorization denied: ${authenticatedHandle} cannot edit ${requestedHandle}`);
  return res.status(403).json({ 
    error: 'Forbidden: You can only update your own profile',
    code: 'INSUFFICIENT_PERMISSIONS'
  });
};

// Rate limiting middleware (simple in-memory implementation)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

const rateLimit = (maxRequests: number, windowMs: number) => {
  return (req: ExtendedRequest, res: Response, next: any) => {
    const identifier = req.user?.userHandle || req.ip || 'anonymous';
    const now = Date.now();
    
    if (!rateLimitMap.has(identifier)) {
      rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    const userLimit = rateLimitMap.get(identifier)!;
    
    if (now > userLimit.resetTime) {
      // Reset window
      userLimit.count = 1;
      userLimit.resetTime = now + windowMs;
      return next();
    }
    
    if (userLimit.count >= maxRequests) {
      return res.status(429).json({ 
        error: 'Too many requests',
        retryAfter: Math.ceil((userLimit.resetTime - now) / 1000)
      });
    }
    
    userLimit.count++;
    next();
  };
};

// Utility function to enforce pagination limits
const enforcePaginationLimits = (page: number, limit: number, maxLimit = 50) => {
  const safePage = Math.max(0, Math.floor(page) || 0);
  const safeLimit = Math.min(maxLimit, Math.max(1, Math.floor(limit) || 10));
  return { page: safePage, limit: safeLimit };
};

// Input validation middleware
const validateInputSize = (maxContentLength = 5000, maxUrlLength = 2000) => {
  return (req: ExtendedRequest, res: Response, next: any) => {
    const { content, bio, displayName, location, website } = req.body;
    
    if (content && content.length > maxContentLength) {
      return res.status(400).json({ error: `Content too long. Maximum ${maxContentLength} characters allowed.` });
    }
    
    if (bio && bio.length > 500) {
      return res.status(400).json({ error: 'Bio too long. Maximum 500 characters allowed.' });
    }
    
    if (displayName && displayName.length > 100) {
      return res.status(400).json({ error: 'Display name too long. Maximum 100 characters allowed.' });
    }
    
    if (location && location.length > 100) {
      return res.status(400).json({ error: 'Location too long. Maximum 100 characters allowed.' });
    }
    
    // Auto-format website URL if provided
    if (website) {
      if (website.length > maxUrlLength) {
        return res.status(400).json({ error: 'Website URL too long.' });
      }
      
      // Automatically prepend https:// if no protocol is specified
      if (!website.match(/^https?:\/\//i)) {
        req.body.website = `https://${website}`;
        console.log(`🔗 Auto-formatted website URL: ${website} → ${req.body.website}`);
      }
    }
    
    next();
  };
};

export function setupSocialMediaAPI(app: Express) {
  // NOTE: Image uploads are now handled by photo-upload-routes.ts using local filesystem storage
  // All profile/cover/post images are stored in client/public/uploads/{profiles,covers,posts}

  // Social Profile Routes - Specific routes MUST come before parameterized routes

  // Get profile for current user
  app.get("/api/social/profile", requireAuthentication, async (req: ExtendedRequest, res: Response) => {
    try {
      const handle = req.user?.userHandle;
      
      if (!handle) {
        return res.status(401).json({
          success: false,
          error: "Session not found. Please log in again.",
          code: "NO_SESSION"
        });
      }
      
      console.log(`📝 [PROFILE GET] Fetching profile for handle: ${handle}`);
      
      const result = await socialMediaService.getProfile(handle);
      
      // Add session info to response so frontend knows user is connected
      const responseWithSession = {
        ...result,
        session: {
          handle,
          connected: true
        }
      };
      
      console.log(`✅ [PROFILE GET] Profile fetched with session:`, responseWithSession);
      res.json(responseWithSession);
    } catch (error) {
      console.error("❌ [PROFILE GET] Fetch failed:", error);
      res.status(500).json({ 
        error: "Failed to fetch profile",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Profile update endpoint for authenticated users
  app.put("/api/social/profile", requireAuthentication, validateInputSize(), async (req: ExtendedRequest, res: Response) => {
    try {
      const handle = req.user?.userHandle;
      const updates = req.body;
      
      if (!handle) {
        return res.status(401).json({
          success: false,
          error: "Session not found. Please log in again.",
          code: "NO_SESSION"
        });
      }
      
      console.log(`📝 [PROFILE UPDATE] Updating profile for handle: ${handle}`, updates);
      
      const result = await socialMediaService.updateProfile(handle, updates);
      console.log(`✅ [PROFILE UPDATE] Update successful:`, result);
      res.json(result);
    } catch (error) {
      console.error("❌ [PROFILE UPDATE] Update failed:", error);
      res.status(500).json({ 
        error: "Failed to update profile", 
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get profile by handle - MUST come after specific routes
  app.get("/api/social/profile/:handle", async (req: ExtendedRequest, res: Response) => {
    try {
      const handle = req.params.handle;
      if (!handle) {
        return res.status(400).json({ error: "Handle is required" });
      }

      const profile = await socialMediaService.getProfile(handle);
      res.json(profile);
    } catch (error) {
      console.error("❌ Failed to fetch profile:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  // Update profile by handle - SECURED
  app.put("/api/social/profile/:handle", requireAuthentication, requireSelfOrAdmin, validateInputSize(), async (req: ExtendedRequest, res: Response) => {
    try {
      const handle = req.params.handle;
      if (!handle) {
        return res.status(400).json({ error: "Handle is required" });
      }

      const profile = await socialMediaService.updateProfile(handle, req.body);
      res.json(profile);
    } catch (error) {
      console.error("❌ Failed to update profile:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  app.get("/api/social/profile/:handle/stats", async (req: ExtendedRequest, res: Response) => {
    try {
      const handle = req.params.handle;
      if (!handle) {
        return res.status(400).json({ error: "Handle is required" });
      }

      const stats = await socialMediaService.getProfileStats(handle);
      res.json(stats);
    } catch (error) {

      res.status(500).json({ error: "Failed to fetch profile stats" });
    }
  });

  // Posts/News Feed Routes - PUBLIC ACCESS (CORS handled globally)
  app.get("/api/social/posts", async (req: any, res: Response) => {
    try {
      const rawPage = parseInt(req.query.page as string) || 0;
      const rawLimit = parseInt(req.query.limit as string) || 10;
      const { page, limit } = enforcePaginationLimits(rawPage, rawLimit, 50);
      const authorHandle = req.query.author_handle as string;

      // Query directly from database using existing structure with real counts
      let query = sql`
        SELECT p.id, p.content, p.author_handle, p.created_at, p.updated_at, p.image_urls, 
               COALESCE(p.shares_count, 0)::int as shares_count,
               sp.display_name, sp.profile_picture_url,
               COALESCE(like_counts.likes_count, 0)::int as likes_count,
               COALESCE(comment_counts.comments_count, 0)::int as comments_count
        FROM posts p
        LEFT JOIN social_profiles sp ON p.author_handle = sp.handle
        LEFT JOIN (
          SELECT post_id, COUNT(*)::int as likes_count
          FROM post_likes
          GROUP BY post_id
        ) like_counts ON p.id = like_counts.post_id
        LEFT JOIN (
          SELECT post_id, COUNT(*)::int as comments_count
          FROM post_comments
          WHERE is_deleted = false
          GROUP BY post_id
        ) comment_counts ON p.id = comment_counts.post_id
        ORDER BY p.created_at DESC
        LIMIT ${limit} OFFSET ${page * limit}
      `;

      if (authorHandle) {
        query = sql`
          SELECT p.id, p.content, p.author_handle, p.created_at, p.updated_at, p.image_urls, 
                 COALESCE(p.shares_count, 0)::int as shares_count,
                 sp.display_name, sp.profile_picture_url,
                 COALESCE(like_counts.likes_count, 0)::int as likes_count,
                 COALESCE(comment_counts.comments_count, 0)::int as comments_count
          FROM posts p
          LEFT JOIN social_profiles sp ON p.author_handle = sp.handle
          LEFT JOIN (
            SELECT post_id, COUNT(*)::int as likes_count
            FROM post_likes
            GROUP BY post_id
          ) like_counts ON p.id = like_counts.post_id
          LEFT JOIN (
            SELECT post_id, COUNT(*)::int as comments_count
            FROM post_comments
            WHERE is_deleted = false
            GROUP BY post_id
          ) comment_counts ON p.id = comment_counts.post_id
          WHERE p.author_handle = ${authorHandle}
          ORDER BY p.created_at DESC
          LIMIT ${limit} OFFSET ${page * limit}
        `;
      }

      const result = await db.execute(query);
      
      const posts = result.rows.map((row: any) => ({
        id: row.id,
        content: row.content,
        authorHandle: row.author_handle,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        imageUrls: row.image_urls || [],
        authorDisplayName: row.display_name,
        authorProfileImage: row.profile_picture_url,
        likesCount: Number(row.likes_count) ?? 0,
        commentsCount: Number(row.comments_count) ?? 0,
        sharesCount: Number(row.shares_count) ?? 0
      }));

      console.log(`✅ Fetched ${posts.length} posts${authorHandle ? ` for author: ${authorHandle}` : ' (all posts)'}`);
      res.json(posts);
    } catch (error) {
      console.error("Error fetching posts:", error);
      res.status(500).json({ error: "Failed to fetch posts" });
    }
  });

  app.post("/api/social/posts", requireAuthentication, validateInputSize(5000), async (req: any, res: Response) => {
    try {
      console.log('🔐 [RIDDLE CREATE] Authenticated user attempting to create riddle');
      console.log('🔐 [RIDDLE CREATE] (req.user as any).walletAddress:', req.user?.walletAddress);
      console.log('🔐 [RIDDLE CREATE] req.user.userHandle:', req.user?.userHandle);
      console.log('🔐 [RIDDLE CREATE] req.user:', (req as any).user);
      
      // Get handle from authenticated request (middleware sets this)
      const handle = req.user?.userHandle || req.user?.walletAddress;
      if (!handle) {
        console.log('❌ [RIDDLE CREATE] No handle found in request');
        return res.status(401).json({ error: "Authentication required" });
      }

      const { content, imageUrls } = req.body;
      
      // Validate that either content or images are provided
      if (!content?.trim() && (!imageUrls || imageUrls.length === 0)) {
        return res.status(400).json({ error: "Either riddle content or images are required" });
      }

      console.log(`🎯 [RIDDLE CREATE] Creating riddle for handle: ${handle}`);
      console.log(`📝 [RIDDLE CREATE] Content: "${content}"`);
      console.log(`🖼️ [RIDDLE CREATE] Images:`, imageUrls);

      // Insert into database with proper array handling for Postgres
      const imgArray = Array.isArray(imageUrls) && imageUrls.length > 0 ? imageUrls : null;
      
      const result = await db.execute(sql`
        INSERT INTO posts (content, author_handle, author_wallet_address, image_urls)
        VALUES (
          ${content?.trim() || ''}, 
          ${handle}, 
          ${(req.user as any).walletAddress}, 
          ${imgArray ? sql`ARRAY[${sql.join(imgArray.map((url: string) => sql`${url}`), sql`, `)}]` : sql`NULL`}
        )
        RETURNING id, content, author_handle, author_wallet_address, image_urls, created_at, updated_at
      `);
      
      const newPost = result.rows[0];

      console.log('✅ Post created successfully:', newPost);
      
      res.json({ 
        success: true, 
        riddle: {
          id: newPost.id,
          content: newPost.content,
          authorHandle: newPost.author_handle,
          authorWalletAddress: newPost.author_wallet_address,
          imageUrls: newPost.image_urls,
          createdAt: newPost.created_at,
          updatedAt: newPost.updated_at
        }
      });
    } catch (error) {
      console.error('❌ Failed to create riddle:', error);
      res.status(500).json({ error: "Failed to create riddle" });
    }
  });

  // User Search Routes - PUBLIC ACCESS (CORS handled globally)
  app.get("/api/social/search/users", async (req: ExtendedRequest, res: Response) => {
    try {
      const query = req.query.q as string;
      const rawLimit = parseInt(req.query.limit as string) || 10;
      const { limit } = enforcePaginationLimits(0, rawLimit, 25);

      if (!query?.trim()) {
        return res.json([]);
      }

      // Use service method instead of raw SQL
      const result = await socialMediaService.searchUsers(query, limit);
      const users = result.users || [];

      console.log(`🔍 Found ${users.length} users for query: "${query}"`);
      res.json(users);
    } catch (error) {
      console.error("Error searching users:", error);
      res.status(500).json({ error: "Failed to search users" });
    }
  });


  // Quote tweet endpoint
  app.post("/api/social/posts/:postId/quote", requireAuthentication, validateInputSize(1000), async (req: any, res: Response) => {
    try {
      const handle = req.user?.userHandle;
      if (!handle) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const postId = req.params.postId;
      const { content } = req.body;
      
      if (!content?.trim()) {
        return res.status(400).json({ error: "Quote comment is required" });
      }
      
      console.log(`💬 User ${handle} quote tweeting post ${postId} with: "${content}"`);
      
      // Verify original post exists
      const [originalPost] = await db
        .select()
        .from(posts)
        .where(eq(posts.id, postId));
      
      if (!originalPost) {
        return res.status(404).json({ error: "Post not found" });
      }
      
      // Create quote tweet with proper schema
      const [newQuotePost] = await db
        .insert(posts)
        .values({
          content: content.trim(),
          authorWalletAddress: handle
        })
        .returning();
      
      console.log(`✅ Quote tweet created with ID: ${newQuotePost.id}`);
      
      res.json({ 
        success: true, 
        message: "Quote tweet created successfully!",
        quoteId: newQuotePost.id,
        post: newQuotePost
      });
    } catch (error) {
      console.error("Error creating quote tweet:", error);
      res.status(500).json({ error: "Failed to create quote tweet" });
    }
  });


  // Unified comment handlers that work with normalized identity
  const getCommentsHandler = async (req: any, res: any) => {
    try {
      const postId = req.params.postId;
      const rawPage = parseInt(req.query.page as string) || 0;
      const rawLimit = parseInt(req.query.limit as string) || 20;
      const { page, limit } = enforcePaginationLimits(rawPage, rawLimit, 50);
      
      const comments = await socialMediaService.getPostComments(postId, page, limit);
      res.json(comments);
    } catch (error) {
      console.error("❌ Error fetching comments:", error);
      res.status(500).json({ error: "Failed to fetch comments" });
    }
  };

  const createCommentHandler = async (req: any, res: any) => {
    try {
      const postId = req.params.postId;
      const { content, parentCommentId } = req.body;
      
      if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: "Comment content is required" });
      }
      
      if (content.length > 2000) {
        return res.status(400).json({ error: "Comment too long. Maximum 2000 characters allowed." });
      }

      if (!req.normalizedUser) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Use wallet address with commentOnPost method for consistency
      const comment = await socialMediaService.commentOnPost(
        postId, 
        req.normalizedUser.walletAddress, 
        content.trim(),
        parentCommentId
      );
      res.json(comment);
    } catch (error) {
      console.error("❌ Error creating comment:", error);
      res.status(500).json({ error: "Failed to create comment" });
    }
  };

  // Mount on BOTH endpoint paths to support different frontend pages
  app.get("/api/social/posts/:postId/comments", getCommentsHandler);
  app.post("/api/social/posts/:postId/comments", unifiedAuth, createCommentHandler);
  
  // Alternative endpoints for compatibility with social-feed.tsx
  app.get("/api/posts/:postId/comments", getCommentsHandler);
  app.post("/api/posts/:postId/comments", unifiedAuth, createCommentHandler);

  // Alternative endpoints for compatibility with social-feed.tsx - PUBLIC ACCESS (CORS handled globally)
  app.get("/api/posts", async (req: any, res: Response) => {
    try {
      const rawPage = parseInt(req.query.page as string) || 0;
      const rawLimit = parseInt(req.query.limit as string) || 10;
      const { page, limit } = enforcePaginationLimits(rawPage, rawLimit, 50);
      const userId = req.query.userId as string;

      const result = await socialMediaService.getPosts(page, limit, userId);
      res.json(result);
    } catch (error) {
      console.error("Error fetching posts:", error);
      res.status(500).json({ error: "Failed to fetch posts" });
    }
  });

  app.post("/api/posts", requireAuthentication, validateInputSize(5000), async (req: any, res: Response) => {
    try {
      const userHandle = req.user?.userHandle;
      if (!userHandle) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const post = await socialMediaService.createPost(userHandle, req.body);
      res.json(post);
    } catch (error) {
      console.error("Error creating post:", error);
      res.status(500).json({ error: "Failed to create post" });
    }
  });

  // Get user's liked posts - MUST come before /api/posts/:postId
  app.get("/api/posts/liked", requireAuthentication, async (req: ExtendedRequest, res: Response) => {
    try {
      const handle = req.user?.userHandle;
      if (!handle) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const likedPosts = await socialMediaService.getUserLikedPosts(handle);
      res.json(likedPosts);
    } catch (error) {
      console.error("Error fetching liked posts:", error);
      res.status(500).json({ error: "Failed to fetch liked posts" });
    }
  });

  // Get user's replies/comments - MUST come before /api/posts/:postId
  app.get("/api/posts/replies", requireAuthentication, async (req: ExtendedRequest, res: Response) => {
    try {
      const handle = req.user?.userHandle;
      if (!handle) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const userReplies = await socialMediaService.getUserReplies(handle);
      res.json({ replies: userReplies });
    } catch (error) {
      console.error("Error fetching user replies:", error);
      res.status(500).json({ error: "Failed to fetch user replies" });
    }
  });

  // Get individual post by ID for riddle sharing - PUBLIC ACCESS (CORS handled globally)
  // MUST come after specific routes like /api/posts/liked and /api/posts/replies
  app.get("/api/posts/:postId", async (req: any, res: Response) => {
    try {
      const postId = req.params.postId;
      const postIdNum = parseInt(postId);
      
      if (isNaN(postIdNum)) {
        return res.status(400).json({ error: "Invalid post ID" });
      }

      // Fetch the post from database
      const [post] = await db.select().from(posts).where(eq(posts.id, postIdNum));
      
      if (!post) {
        return res.status(404).json({ error: "Post not found" });
      }

      // Get author profile information
      const profileResult = post.authorHandle ? await socialMediaService.getProfile(post.authorHandle) : null;
      
      // Extract profile from result (handle both response formats)
      const profile = profileResult && 'profile' in profileResult ? profileResult.profile : profileResult;
      
      // Use safe fallbacks for profile data
      const displayName = (profile as any)?.displayName || 'Anonymous';
      const profileImage = (profile as any)?.profileImageUrl || null;
      
      res.json({
        id: post.id,
        content: post.content,
        authorHandle: post.authorHandle,
        authorDisplayName: displayName,
        authorProfileImage: profileImage,
        createdAt: post.createdAt,
        likesCount: post.likesCount || 0,
        sharesCount: post.sharesCount || 0,
        commentsCount: post.commentsCount || 0,
        imageUrls: post.imageUrls || []
      });
    } catch (error) {
      console.error("Error fetching post:", error);
      res.status(500).json({ error: "Failed to fetch post" });
    }
  });

  // Like/Unlike post endpoint (with /social/ prefix)
  app.post("/api/social/posts/:postId/like", requireAuthentication, rateLimit(60, 60000), async (req: ExtendedRequest, res: Response) => {
    try {
      const handle = req.user?.userHandle;
      if (!handle) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const result = await socialMediaService.likePost(req.params.postId, handle);
      res.json(result);
    } catch (error) {
      console.error("Error liking post:", error);
      res.status(500).json({ error: "Failed to like post" });
    }
  });

  // Legacy like endpoint (without /social/ prefix for backwards compatibility)
  app.post("/api/posts/:postId/like", requireAuthentication, rateLimit(60, 60000), async (req: ExtendedRequest, res: Response) => {
    try {
      const handle = req.user?.userHandle;
      if (!handle) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const result = await socialMediaService.likePost(req.params.postId, handle);
      res.json(result);
    } catch (error) {
      console.error("Error liking post:", error);
      res.status(500).json({ error: "Failed to like post" });
    }
  });

  app.post("/api/posts/:postId/comments", requireAuthentication, validateInputSize(2000), async (req: ExtendedRequest, res: Response) => {
    try {
      const handle = req.user?.userHandle;
      if (!handle) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const comment = await socialMediaService.createComment(
        req.params.postId, 
        handle, 
        req.body.content
      );
      res.json(comment);
    } catch (error) {
      console.error("Error creating comment:", error);
      res.status(500).json({ error: "Failed to create comment" });
    }
  });

  app.get("/api/posts/:postId/comments", async (req: ExtendedRequest, res: Response) => {
    try {
      const comments = await socialMediaService.getPostComments(req.params.postId);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching post comments:", error);
      res.status(500).json({ error: "Failed to fetch comments" });
    }
  });

  // NOTE: Object Storage uploads removed - now using local filesystem via photo-upload-routes.ts

  // Follow System Routes
  app.post("/api/social/follow", requireAuthentication, rateLimit(50, 60000), async (req: ExtendedRequest, res: Response) => {
    try {
      const currentUserHandle = req.user?.userHandle;
      const { targetHandle } = req.body;
      
      if (!currentUserHandle) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      if (!targetHandle) {
        return res.status(400).json({ error: "Target handle is required" });
      }
      
      console.log(`🔄 [FOLLOW] ${currentUserHandle} attempting to follow ${targetHandle}`);
      
      const result = await socialMediaService.followUserByHandle(currentUserHandle, targetHandle);
      console.log(`✅ [FOLLOW] Operation successful:`, result);
      res.json(result);
    } catch (error) {
      console.error('❌ [FOLLOW] Failed:', error);
      res.status(500).json({ 
        error: "Failed to follow user", 
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Check follow status endpoint
  app.get("/api/social/follow-status/:targetHandle", requireAuthentication, async (req: ExtendedRequest, res: Response) => {
    try {
      const currentUserHandle = req.user?.userHandle;
      const { targetHandle } = req.params;
      
      if (!currentUserHandle) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const isFollowing = await socialMediaService.isUserFollowing(currentUserHandle, targetHandle);
      res.json({ isFollowing });
    } catch (error) {
      console.error('❌ [FOLLOW STATUS] Failed:', error);
      res.status(500).json({ 
        error: "Failed to check follow status", 
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post("/api/social/users/:userId/follow", requireAuthentication, async (req: ExtendedRequest, res: Response) => {
    try {
      const followerId = (req.user as any)?.id;
      if (!followerId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const result = await socialMediaService.followUser(followerId.toString(), req.params.userId);
      res.json(result);
    } catch (error) {

      res.status(500).json({ error: "Failed to follow user" });
    }
  });


  // Messaging Routes
  app.get("/api/messaging/conversations", requireAuthentication, async (req: ExtendedRequest, res: Response) => {
    try {
      const currentUserHandle = req.user?.userHandle;
      if (!currentUserHandle) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const conversations = await socialMediaService.getUserConversations(currentUserHandle);
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  app.get("/api/messaging/messages/:conversationId", requireAuthentication, async (req: ExtendedRequest, res: Response) => {
    try {
      const currentUserHandle = req.user?.userHandle;
      if (!currentUserHandle) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const messages = await socialMediaService.getMessages(req.params.conversationId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/messaging/send-message", requireAuthentication, validateInputSize(5000), rateLimit(100, 60000), async (req: ExtendedRequest, res: Response) => {
    try {
      const currentUserHandle = req.user?.userHandle;
      if (!currentUserHandle) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { conversationId, content, messageType, receiverId } = req.body;
      console.log(`💬 [SEND MESSAGE] User ${currentUserHandle} sending to conversation ${conversationId}`);
      console.log(`💬 [SEND MESSAGE] Content: "${content}"`);
      console.log(`💬 [SEND MESSAGE] Receiver: ${receiverId}`);
      
      const message = await socialMediaService.sendMessage(conversationId, currentUserHandle, receiverId, content, messageType);
      res.json(message);
    } catch (error) {
      console.error("❌ [SEND MESSAGE] Error sending message:", error);
      res.status(500).json({ error: "Failed to send message", details: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/messaging/start-conversation", requireAuthentication, async (req: ExtendedRequest, res: Response) => {
    try {
      const currentUserHandle = req.user?.userHandle;
      if (!currentUserHandle) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { participantHandle } = req.body;
      if (!participantHandle) {
        return res.status(400).json({ error: "Participant handle is required" });
      }

      console.log(`💬 [MESSAGE] Starting conversation between ${currentUserHandle} and ${participantHandle}`);
      const conversation = await socialMediaService.getOrCreateConversation(currentUserHandle, participantHandle);
      console.log(`✅ [MESSAGE] Conversation created:`, conversation);
      res.json(conversation);
    } catch (error) {
      console.error('❌ [MESSAGE] Failed to start conversation:', error);
      res.status(500).json({ error: "Failed to start conversation" });
    }
  });

  app.post("/api/messaging/mark-read/:conversationId", requireAuthentication, async (req: ExtendedRequest, res: Response) => {
    try {
      const currentUserHandle = req.user?.userHandle;
      if (!currentUserHandle) {
        return res.status(401).json({ error: "Authentication required" });
      }

      await socialMediaService.markMessagesAsRead(req.params.conversationId, currentUserHandle);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking messages as read:", error);
      res.status(500).json({ error: "Failed to mark messages as read" });
    }
  });

  // Delete Message Route
  app.delete("/api/messaging/delete-message/:messageId", requireAuthentication, rateLimit(30, 60000), async (req: ExtendedRequest, res: Response) => {
    try {
      const currentUserHandle = req.user?.userHandle;
      if (!currentUserHandle) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const messageId = req.params.messageId;
      console.log(`🗑️ [DELETE MESSAGE] User ${currentUserHandle} deleting message ${messageId}`);
      
      const result = await socialMediaService.deleteMessage(messageId, currentUserHandle);
      if (!result.success) {
        return res.status(403).json({ error: result.error || "You can only delete your own messages" });
      }
      
      res.json({ success: true, message: "Message deleted successfully" });
    } catch (error) {
      console.error("❌ [DELETE MESSAGE] Error deleting message:", error);
      res.status(500).json({ error: "Failed to delete message", details: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Archive Message Route
  app.post("/api/messaging/archive-message/:messageId", requireAuthentication, async (req: ExtendedRequest, res: Response) => {
    try {
      const currentUserHandle = req.user?.userHandle;
      if (!currentUserHandle) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const messageId = req.params.messageId;
      console.log(`📦 [ARCHIVE MESSAGE] User ${currentUserHandle} archiving message ${messageId}`);
      
      const result = await socialMediaService.archiveMessage(messageId, currentUserHandle);
      if (!result.success) {
        return res.status(400).json({ error: result.error || "Failed to archive message" });
      }
      
      res.json({ success: true, message: "Message archived successfully" });
    } catch (error) {
      console.error("❌ [ARCHIVE MESSAGE] Error archiving message:", error);
      res.status(500).json({ error: "Failed to archive message", details: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Notification Routes
  app.get("/api/messaging/notifications", requireAuthentication, async (req: ExtendedRequest, res: Response) => {
    try {
      const currentUserHandle = req.user?.userHandle;
      if (!currentUserHandle) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const notifications = await socialMediaService.getUserNotifications(currentUserHandle);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.post("/api/messaging/notifications/:notificationId/read", requireAuthentication, async (req: ExtendedRequest, res: Response) => {
    try {
      const currentUserHandle = req.user?.userHandle;
      if (!currentUserHandle) {
        return res.status(401).json({ error: "Authentication required" });
      }

      await socialMediaService.markNotificationAsRead(req.params.notificationId, currentUserHandle);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  app.get("/api/messaging/search-users", requireAuthentication, async (req: ExtendedRequest, res: Response) => {
    try {
      const query = req.query.q as string;
      console.log("🔍 [USER SEARCH] Query received:", query);
      
      if (!query) {
        console.log("🔍 [USER SEARCH] Empty query, returning empty array");
        return res.json([]);
      }

      // Search real users from database
      const result = await socialMediaService.searchUsers(query, 10);
      const users = result.users || [];
      console.log("🔍 [USER SEARCH] Database results:", users.length, "users found");
      res.json(users);
    } catch (error) {
      console.error("❌ Failed to search users:", error);
      res.status(500).json({ error: "Failed to search users" });
    }
  });

  // NOTE: All file upload routes moved to photo-upload-routes.ts
  // Images are now uploaded directly to local filesystem at client/public/uploads/

  // ===== NEWSFEED ALGORITHM ENDPOINTS =====
  
  // Get algorithm-powered newsfeed
  app.get("/api/social/newsfeed", requireAuthentication, async (req: ExtendedRequest, res: Response) => {
    try {
      const handle = req.user?.userHandle;
      if (!handle) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      const posts = await newsfeedAlgorithm.generateNewsfeed(handle, limit, offset);
      
      console.log(`🔮 [NEWSFEED] Generated ${posts.length} posts for @${handle}`);
      res.json(posts);
    } catch (error) {
      console.error("❌ Failed to generate newsfeed:", error);
      res.status(500).json({ error: "Failed to generate newsfeed" });
    }
  });

  // Get algorithm statistics and performance metrics
  app.get("/api/social/newsfeed/stats", requireAuthentication, async (req: ExtendedRequest, res: Response) => {
    try {
      const stats = await newsfeedAlgorithm.getAlgorithmStats();
      console.log('📊 [NEWSFEED] Algorithm stats requested');
      res.json(stats);
    } catch (error) {
      console.error("❌ Failed to get algorithm stats:", error);
      res.status(500).json({ error: "Failed to get algorithm stats" });
    }
  });

  // Update algorithm configuration (admin only)
  app.put("/api/social/newsfeed/config", requireAuthentication, async (req: ExtendedRequest, res: Response) => {
    try {
      const handle = req.user?.userHandle;
      
      // TODO: Implement proper role-based admin authorization
      // For now, disable algorithm modification until proper admin system is implemented
      return res.status(501).json({ 
        error: "Algorithm modification temporarily disabled - proper admin system needed",
        code: "ADMIN_SYSTEM_REQUIRED"
      });

      const newConfig = req.body;
      newsfeedAlgorithm.updateConfig(newConfig);
      
      console.log(`🔧 [NEWSFEED] Algorithm config updated by @${handle}`, newConfig);
      res.json({ 
        success: true, 
        config: newsfeedAlgorithm.getConfig(),
        message: "Algorithm configuration updated successfully"
      });
    } catch (error) {
      console.error("❌ Failed to update algorithm config:", error);
      res.status(500).json({ error: "Failed to update algorithm config" });
    }
  });

  // Get available algorithm presets
  app.get("/api/social/newsfeed/presets", requireAuthentication, async (req: ExtendedRequest, res: Response) => {
    try {
      console.log('🎛️ [NEWSFEED] Algorithm presets requested');
      res.json({
        current: newsfeedAlgorithm.getConfig(),
        presets: ALGORITHM_PRESETS,
        description: {
          DEFAULT: "Balanced feed with priority accounts and engagement weighting",
          CHRONOLOGICAL: "Simple time-based feed, most recent first",
          ENGAGEMENT_HEAVY: "Heavy focus on high-engagement content"
        }
      });
    } catch (error) {
      console.error("❌ Failed to get algorithm presets:", error);
      res.status(500).json({ error: "Failed to get algorithm presets" });
    }
  });

  // Apply algorithm preset (admin only)
  app.post("/api/social/newsfeed/preset/:presetName", requireAuthentication, async (req: ExtendedRequest, res: Response) => {
    try {
      const handle = req.user?.userHandle;
      const presetName = req.params.presetName.toUpperCase();
      
      // TODO: Implement proper role-based admin authorization
      // For now, disable algorithm modification until proper admin system is implemented
      return res.status(501).json({ 
        error: "Algorithm preset changes temporarily disabled - proper admin system needed",
        code: "ADMIN_SYSTEM_REQUIRED"
      });

      if (!(presetName in ALGORITHM_PRESETS)) {
        return res.status(400).json({ error: `Invalid preset: ${presetName}` });
      }

      const presetConfig = ALGORITHM_PRESETS[presetName as keyof typeof ALGORITHM_PRESETS];
      newsfeedAlgorithm.updateConfig(presetConfig);
      
      console.log(`🎛️ [NEWSFEED] Algorithm preset '${presetName}' applied by @${handle}`);
      res.json({ 
        success: true, 
        preset: presetName,
        config: newsfeedAlgorithm.getConfig(),
        message: `Algorithm preset '${presetName}' applied successfully`
      });
    } catch (error) {
      console.error("❌ Failed to apply algorithm preset:", error);
      res.status(500).json({ error: "Failed to apply algorithm preset" });
    }
  });

  // ===== NOTIFICATION SYSTEM ENDPOINTS =====
  
  // Get user notifications
  app.get("/api/notifications", requireAuthentication, async (req: ExtendedRequest, res: Response) => {
    try {
      const handle = req.user?.userHandle;
      if (!handle) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const rawLimit = parseInt(req.query.limit as string) || 20;
      const rawOffset = parseInt(req.query.offset as string) || 0;
      const { page: offset, limit } = enforcePaginationLimits(rawOffset, rawLimit, 50);
      const unreadOnly = req.query.unreadOnly === 'true';

      const result = await socialMediaService.getUserNotifications(handle, limit, offset, unreadOnly);
      res.json(result);
    } catch (error) {
      console.error("❌ Failed to get notifications:", error);
      res.status(500).json({ error: "Failed to get notifications" });
    }
  });

  // Mark notification as read
  app.put("/api/notifications/:notificationId/read", requireAuthentication, async (req: ExtendedRequest, res: Response) => {
    try {
      const handle = req.user?.userHandle;
      if (!handle) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { notificationId } = req.params;
      const result = await socialMediaService.markNotificationAsRead(notificationId, handle);
      res.json(result);
    } catch (error) {
      console.error("❌ Failed to mark notification as read:", error);
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  // Mark all notifications as read
  app.put("/api/notifications/mark-all-read", requireAuthentication, rateLimit(10, 60000), async (req: ExtendedRequest, res: Response) => {
    try {
      const handle = req.user?.userHandle;
      if (!handle) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const result = await socialMediaService.markAllNotificationsAsRead(handle);
      res.json(result);
    } catch (error) {
      console.error("❌ Failed to mark all notifications as read:", error);
      res.status(500).json({ error: "Failed to mark all notifications as read" });
    }
  });

  // Get unread notification count - READ ONLY, no private keys needed
  app.get("/api/notifications/unread-count", readOnlyAuth, async (req: ExtendedRequest, res: Response) => {
    try {
      console.log('🔔 [NOTIFICATIONS] req.user:', req.user);
      const handle = req.user?.userHandle;
      if (!handle) {
        console.log('❌ [NOTIFICATIONS] No handle found in req.user');
        return res.status(401).json({ error: "Authentication required" });
      }

      const result = await socialMediaService.getUnreadNotificationCount(handle);
      res.json(result);
    } catch (error) {
      console.error("❌ Failed to get unread notification count:", error);
      res.status(500).json({ error: "Failed to get unread notification count" });
    }
  });

  // Search users for tagging
  app.get("/api/social/users/search", requireAuthentication, async (req: ExtendedRequest, res: Response) => {
    try {
      const query = req.query.q as string;
      if (!query || query.length < 2) {
        return res.json({ users: [] });
      }

      const result = await socialMediaService.searchUsers(query);
      res.json(result);
    } catch (error) {
      console.error("❌ Failed to search users:", error);
      res.status(500).json({ error: "Failed to search users" });
    }
  });

  // ===== ENHANCED RETWEET/LIKE ENDPOINTS =====
  
  // Retweet/Reriddle endpoint
  app.post("/api/social/posts/:postId/retweet", requireAuthentication, rateLimit(50, 60000), async (req: ExtendedRequest, res: Response) => {
    try {
      const handle = req.user?.userHandle;
      if (!handle) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const postId = parseInt(req.params.postId);
      if (isNaN(postId)) {
        return res.status(400).json({ error: "Invalid post ID" });
      }

      // Retweet by creating a reference to the original post (simple implementation)
      // In a real implementation, you'd have a separate retweets table
      const result = await socialMediaService.createPost(
        handle,
        `[RT:${postId}]` // Simple retweet marker
      );
      
      res.json({ 
        success: true, 
        message: "Post retweeted successfully",
        repostId: result.id
      });
    } catch (error) {
      console.error("Error retweeting post:", error);
      res.status(500).json({ error: "Failed to retweet post" });
    }
  });

}