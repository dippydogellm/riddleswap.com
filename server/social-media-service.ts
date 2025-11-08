import { db } from "./db";
import { socialProfiles, posts, postLikes, postComments, socialFollows, directMessages, messageConversations, voiceMessages, users, notifications } from "@shared/schema";
import { eq, desc, and, or, sql, count, ne } from "drizzle-orm";
import type { InsertSocialProfile, InsertPost, InsertPostLike, InsertPostComment, InsertSocialFollow, InsertDirectMessage, InsertVoiceMessage } from "@shared/schema";

class SocialMediaService {
  // Profile Management - Using handle instead of walletAddress to match database
  async getProfile(handle: string) {
    const [profile] = await db
      .select()
      .from(socialProfiles)
      .where(eq(socialProfiles.handle, handle));
    
    if (!profile) {
      // Create default profile if none exists
      const defaultProfile = {
        handle,
        displayName: `User ${handle.slice(0, 8)}...`,
        bio: "",
      };
      
      const [newProfile] = await db
        .insert(socialProfiles)
        .values({
          ...defaultProfile,
          followersCount: 0,
          followingCount: 0
        } as any)
        .returning();
      
      return { success: true, profile: newProfile };
    }
    
    return { success: true, profile };
  }

  async updateProfile(handle: string, updates: any) {
    console.log(`📝 Updating profile for handle: ${handle}`, updates);
    
    // Whitelist only safe fields to prevent data integrity attacks
    const safeFields = [
      'displayName', 'bio', 'location', 'website', 'profileImageUrl', 'coverImageUrl',
      'twitterUsername', 'instagramUsername', 'facebookUsername', 'linkedinUsername',
      'youtubeChannel', 'tiktokUsername', 'telegramUsername', 'discordUsername',
      'githubUsername', 'twitchUsername'
    ];
    
    const sanitizedUpdates: any = {};
    for (const field of safeFields) {
      if (updates[field] !== undefined) {
        sanitizedUpdates[field] = updates[field];
      }
    }
    
    // Log rejected fields for security audit
    const rejectedFields = Object.keys(updates).filter(key => !safeFields.includes(key));
    if (rejectedFields.length > 0) {
      console.warn(`🚨 SECURITY: Rejected server-managed fields for ${handle}:`, rejectedFields);
    }
    
    console.log(`🧹 Sanitized updates (whitelisted fields only):`, sanitizedUpdates);
    
    // First check if profile exists
    const [existingProfile] = await db
      .select()
      .from(socialProfiles)
      .where(eq(socialProfiles.handle, handle));
    
    if (!existingProfile) {
      console.log(`🆕 Profile doesn't exist for handle: ${handle}, creating new one...`);
      // Create new profile if it doesn't exist - only with safe defaults
      const [newProfile] = await db
        .insert(socialProfiles)
        .values({
          handle,
          displayName: sanitizedUpdates.displayName || `User ${handle}`,
          bio: sanitizedUpdates.bio || "",
          location: sanitizedUpdates.location || "",
          website: sanitizedUpdates.website || "",
          followersCount: 0,
          followingCount: 0,
          postsCount: 0,
          ...sanitizedUpdates
        } as any)
        .returning();
      
      console.log(`✅ New profile created:`, newProfile);
      return { success: true, profile: newProfile };
    }
    
    // Ensure we have at least one field to update
    if (Object.keys(sanitizedUpdates).length === 0) {
      console.log(`ℹ️ No valid fields to update for handle: ${handle}`);
      return { success: true, profile: existingProfile };
    }
    
    // Update existing profile with only the sanitized fields
    const [updatedProfile] = await db
      .update(socialProfiles)
      .set({  
        ...sanitizedUpdates, 
        updatedAt: new Date() 
       } as any)
      .where(eq(socialProfiles.handle, handle))
      .returning();
    
    if (!updatedProfile) {
      throw new Error('Profile update failed');
    }
    
    console.log(`✅ Profile updated successfully:`, updatedProfile);
    return { success: true, profile: updatedProfile };
  }

  async getProfileStats(handle: string) {
    const profileResult = await this.getProfile(handle);
    const profile = profileResult.profile;
    
    // Get actual follower/following counts
    const [followerCount] = await db
      .select({ count: count() })
      .from(socialFollows)
      .where(eq(socialFollows.followingWalletAddress, handle));
      
    const [followingCount] = await db
      .select({ count: count() })
      .from(socialFollows)
      .where(eq(socialFollows.followerWalletAddress, handle));
    
    // Get post count
    const [postCount] = await db
      .select({ count: count() })
      .from(posts)
      .where(eq(posts.authorWalletAddress, handle));
    
    return {
      totalPosts: postCount?.count || 0,
      totalFollowers: followerCount?.count || 0,
      totalFollowing: followingCount?.count || 0,
      totalLikes: 0, // Can implement if needed
      totalComments: 0, // Can implement if needed
      joinDate: profile?.createdAt?.toISOString() || new Date().toISOString(),
    };
  }

  // News Feed / Posts Management
  async getPosts(page: number = 0, limit: number = 10, authorWalletAddress?: string) {
    let query = db
      .select({
        id: posts.id,
        authorHandle: posts.authorHandle,
        authorWalletAddress: posts.authorWalletAddress,
        content: posts.content,
        imageUrls: posts.imageUrls,
        likesCount: posts.likesCount,
        commentsCount: posts.commentsCount,
        sharesCount: posts.sharesCount,
        createdAt: posts.createdAt,
        updatedAt: posts.updatedAt,
        authorDisplayName: socialProfiles.displayName,
        authorProfileImage: socialProfiles.profileImageUrl,
      })
      .from(posts)
      .leftJoin(socialProfiles, eq(posts.authorHandle, socialProfiles.handle))
      .orderBy(desc(posts.createdAt))
      .limit(limit)
      .offset(page * limit);

    if (authorWalletAddress) {
      query = query.where(eq(posts.authorWalletAddress, authorWalletAddress)) as typeof query;
    }

    const result = await query;
    return { posts: result };
  }

  async createPost(userId: number | string, postData?: any): Promise<any>;
  async createPost(postData: InsertPost): Promise<any>;
  async createPost(userIdOrPostData: number | string | InsertPost, postData?: any): Promise<any> {
    // Handle overloaded function call - if first param is a number/string, it's userId + postData
    if (typeof userIdOrPostData === 'number' || typeof userIdOrPostData === 'string') {
      const userId = userIdOrPostData;
      const { content, imageUrl, imageUrls } = postData || {};
      
      if (!content && !imageUrl && !imageUrls?.length) {
        throw new Error('Post must have content or image');
      }
      
      // Handle both single imageUrl and array imageUrls for backward compatibility
      let finalImageUrls: string[] = [];
      if (imageUrl) {
        finalImageUrls = [imageUrl];
      } else if (imageUrls && Array.isArray(imageUrls)) {
        finalImageUrls = imageUrls;
      }
      
      const insertData: InsertPost = {
        authorHandle: userId.toString(), // Use authorHandle to match database
        authorWalletAddress: userId.toString(),
        content: content || '',
        imageUrls: finalImageUrls
      };
      
      return this.createPost(insertData);
    } else if (typeof userIdOrPostData === 'object') {
      const insertPostData = userIdOrPostData as any;
      if (!insertPostData.authorWalletAddress) {
        throw new Error('authorWalletAddress is required for post creation');
      }
      const [newPost] = await db
        .insert(posts)
        .values(insertPostData as any)
        .returning();
    
      // Update author's post count if profile exists
      try {
        const updateSet = {
          updatedAt: new Date()
        } as any;
        updateSet.postsCount = sql`${socialProfiles.postsCount} + 1`;
        await db
          .update(socialProfiles)
          .set(updateSet)
          .where(eq(socialProfiles.handle, insertPostData.authorWalletAddress));
      } catch (error) {
        console.log('Profile not found for post author, skipping post count update');
      }
    
      return newPost;
    } else {
      throw new Error('Invalid parameters for createPost');
    }
  }

  async likePost(postId: string, walletAddress: string) {
    // Get original post info
    const [originalPost] = await db
      .select({
        authorWalletAddress: posts.authorWalletAddress,
      })
      .from(posts)
      .where(eq(posts.id, parseInt(postId)));

    if (!originalPost) {
      throw new Error('Post not found');
    }

    const { authorWalletAddress } = originalPost;

    // Check if already liked
    const [existingLike] = await db
      .select()
      .from(postLikes)
      .where(
        and(
          eq(postLikes.postId, parseInt(postId)),
          eq(postLikes.userHandle, walletAddress)
        )
      );

    if (existingLike) {
      // Unlike - remove the like
      await db
        .delete(postLikes)
        .where(
          and(
            eq(postLikes.postId, parseInt(postId)),
            eq(postLikes.userHandle, walletAddress)
          )
        );
      
      // Decrease like count
      await db
        .update(posts)
        .set({ 
          likesCount: sql`${posts.likesCount} - 1` as any,
          updatedAt: new Date()
        } as any)
        .where(eq(posts.id, parseInt(postId)));
      
      return { liked: false, likesCount: -1 };
    } else {
      // Like the post
      const likeData: InsertPostLike = {
        postId: parseInt(postId),
        userHandle: walletAddress,
      };
      
      await db.insert(postLikes).values(likeData as any);
      
      // Increase like count
      await db
        .update(posts)
        .set({ 
          likesCount: sql`${posts.likesCount} + 1` as any,
          updatedAt: new Date()
        } as any)
        .where(eq(posts.id, parseInt(postId)));

      // Create notification for post author (if not liking own post)
      if (authorWalletAddress !== walletAddress) {
        try {
          await this.createNotification(
            authorWalletAddress,
            'like',
            'New Like',
            `@${walletAddress} liked your post`,
            `/post/${postId}`,
            postId,
            walletAddress,
            walletAddress,
            ''
          );
        } catch (error) {
          console.error('Failed to create like notification:', error);
          // Don't fail the like if notification fails
        }
      }
      
      return { liked: true, likesCount: 1 };
    }
  }

  async getUserLikedPosts(walletAddress: string) {
    const likedPostsData = await db
      .select({
        id: posts.id,
        content: posts.content,
        authorWalletAddress: posts.authorWalletAddress,
        authorHandle: socialProfiles.handle,
        authorDisplayName: socialProfiles.displayName,
        authorProfileImage: socialProfiles.profileImageUrl,
        likesCount: posts.likesCount,
        commentsCount: posts.commentsCount,
        sharesCount: posts.sharesCount,
        createdAt: posts.createdAt,
        imageUrls: posts.imageUrls,
      })
      .from(postLikes)
      .innerJoin(posts, eq(postLikes.postId, posts.id))
      .leftJoin(socialProfiles, eq(posts.authorWalletAddress, socialProfiles.walletAddress))
      .where(eq(postLikes.userHandle, walletAddress))
      .orderBy(desc(postLikes.createdAt));
    
    return { posts: likedPostsData };
  }

  async getUserReplies(walletAddress: string) {
    try {
      const userComments = await db
        .select({
          id: postComments.id,
          postId: postComments.postId,
          content: postComments.content,
          createdAt: postComments.createdAt,
          likesCount: postComments.likesCount,
          repliesCount: postComments.repliesCount,
        })
        .from(postComments)
        .where(eq(postComments.authorWalletAddress, walletAddress))
        .orderBy(desc(postComments.createdAt));
      
      return { replies: userComments };
    } catch (error) {
      console.error('Error fetching user replies:', error);
      return { replies: [] };
    }
  }

  async commentOnPost(postId: string, walletAddress: string, content: string, parentCommentId?: string) {
    const commentData: InsertPostComment = {
      postId: parseInt(postId),
      authorWalletAddress: walletAddress,
      content,
      parentCommentId,
    };
    
    const [newComment] = await db
      .insert(postComments)
      .values(commentData as any)
      .returning();
    
    // Update post comment count
    await db
      .update(posts)
      .set({ 
        commentsCount: sql`${posts.commentsCount} + 1` as any,
        updatedAt: new Date()
      } as any)
      .where(eq(posts.id, parseInt(postId)));
    
    // If it's a reply, update parent comment reply count
    if (parentCommentId) {
      await db
        .update(postComments)
        .set({ 
          repliesCount: sql`${postComments.repliesCount} + 1` as any,
          updatedAt: new Date()
        } as any)
        .where(eq(postComments.id, parentCommentId));
    }
    
    return newComment;
  }

  async getPostComments(postId: string, page: number = 0, limit: number = 20) {
    const comments = await db
      .select({
        id: postComments.id,
        postId: postComments.postId,
        authorWalletAddress: postComments.authorWalletAddress,
        content: postComments.content,
        parentCommentId: postComments.parentCommentId,
        likesCount: postComments.likesCount,
        repliesCount: postComments.repliesCount,
        createdAt: postComments.createdAt,
        authorDisplayName: socialProfiles.displayName,
        authorProfileImage: socialProfiles.profileImageUrl,
      })
      .from(postComments)
      .leftJoin(socialProfiles, eq(postComments.authorWalletAddress, socialProfiles.walletAddress))
      .where(
        and(
          eq(postComments.postId, parseInt(postId)),
          eq(postComments.isDeleted, false)
        )
      )
      .orderBy(desc(postComments.createdAt))
      .limit(limit)
      .offset(page * limit);

    return comments;
  }

  // Following System
  async followUser(followerWalletAddress: string, followingWalletAddress: string) {
    if (followerWalletAddress === followingWalletAddress) {
      throw new Error("Cannot follow yourself");
    }

    // Check if already following
    const [existingFollow] = await db
      .select()
      .from(socialFollows)
      .where(
        and(
          eq(socialFollows.followerWalletAddress, followerWalletAddress),
          eq(socialFollows.followingWalletAddress, followingWalletAddress)
        )
      );

    if (existingFollow) {
      // Unfollow
      await db
        .delete(socialFollows)
        .where(
          and(
            eq(socialFollows.followerWalletAddress, followerWalletAddress),
            eq(socialFollows.followingWalletAddress, followingWalletAddress)
          )
        );
      
      // Update counts
      await db
        .update(socialProfiles)
        .set({ 
          followingCount: sql`${socialProfiles.followingCount} - 1` as any,
          updatedAt: new Date()
        } as any)
        .where(eq(socialProfiles.walletAddress, followerWalletAddress));
      
      await db
        .update(socialProfiles)
        .set({ 
          followersCount: sql`${socialProfiles.followersCount} - 1` as any,
          updatedAt: new Date()
        } as any)
        .where(eq(socialProfiles.walletAddress, followingWalletAddress));
      
      return { following: false };
    } else {
      // Follow
      const followData: InsertSocialFollow = {
        followerWalletAddress,
        followingWalletAddress,
      };
      
      await db.insert(socialFollows).values(followData as any);
      
      // Update counts
      await db
        .update(socialProfiles)
        .set({ 
          followingCount: sql`${socialProfiles.followingCount} + 1` as any,
          updatedAt: new Date()
        } as any)
        .where(eq(socialProfiles.walletAddress, followerWalletAddress));
      
      await db
        .update(socialProfiles)
        .set({ 
          followersCount: sql`${socialProfiles.followersCount} + 1` as any,
          updatedAt: new Date()
        } as any)
        .where(eq(socialProfiles.walletAddress, followingWalletAddress));
      
      return { following: true };
    }
  }

  // Follow user by handle - wrapper for handle-to-wallet conversion
  async followUserByHandle(followerHandle: string, targetHandle: string) {
    if (followerHandle === targetHandle) {
      throw new Error("Cannot follow yourself");
    }

    // Get profiles to resolve handles to wallet addresses
    const [followerProfile] = await db
      .select()
      .from(socialProfiles)
      .where(eq(socialProfiles.handle, followerHandle));

    const [targetProfile] = await db
      .select()
      .from(socialProfiles)
      .where(eq(socialProfiles.handle, targetHandle));

    if (!followerProfile) {
      throw new Error("Follower profile not found");
    }

    if (!targetProfile) {
      throw new Error("Target user not found");
    }

    // For now, use handles as wallet addresses since the system is handle-based
    // This can be updated when wallet integration is added
    return await this.followUser(followerHandle, targetHandle);
  }

  // Check if user is following another user
  async isUserFollowing(followerHandle: string, targetHandle: string): Promise<boolean> {
    const [existingFollow] = await db
      .select()
      .from(socialFollows)
      .where(
        and(
          eq(socialFollows.followerWalletAddress, followerHandle),
          eq(socialFollows.followingWalletAddress, targetHandle)
        )
      );

    return !!existingFollow;
  }

  // Messaging System
  async getOrCreateConversation(participantOneId: string, participantTwoId: string) {
    // Check if conversation exists (either direction)
    const [existingConversation] = await db
      .select()
      .from(messageConversations)
      .where(
        or(
          and(
            eq(messageConversations.participantOneId, participantOneId),
            eq(messageConversations.participantTwoId, participantTwoId)
          ),
          and(
            eq(messageConversations.participantOneId, participantTwoId),
            eq(messageConversations.participantTwoId, participantOneId)
          )
        )
      );

    if (existingConversation) {
      return existingConversation;
    }

    // Create new conversation
    const [newConversation] = await db
      .insert(messageConversations)
      .values({
        participantOneId,
        participantTwoId,
      } as any)
      .returning();

    return newConversation;
  }

  async sendMessage(conversationId: string, senderId: string, receiverId: string, content: string, messageType: string = "text") {
    // If receiverId is not provided, determine it from the conversation
    let actualReceiverId = receiverId;
    
    if (!actualReceiverId) {
      console.log(`🔍 [SEND MESSAGE] No receiver provided, determining from conversation ${conversationId}`);
      
      // Get the conversation to find the other participant
      const [conversation] = await db
        .select()
        .from(messageConversations)
        .where(eq(messageConversations.id, conversationId))
        .limit(1);
        
      if (conversation) {
        // The receiver is the other participant (not the sender)
        actualReceiverId = conversation.participantOneId === senderId 
          ? conversation.participantTwoId 
          : conversation.participantOneId;
          
        console.log(`✅ [SEND MESSAGE] Determined receiver: ${actualReceiverId}`);
      } else {
        throw new Error(`Conversation ${conversationId} not found`);
      }
    }

    const messageData: InsertDirectMessage = {
      conversationId,
      senderId,
      receiverId: actualReceiverId,
      content,
      messageType,
    };

    console.log(`💬 [SEND MESSAGE] Final message data:`, { 
      conversationId, 
      senderId, 
      receiverId: actualReceiverId, 
      content: content.substring(0, 50) + (content.length > 50 ? '...' : '')
    });

    const [newMessage] = await db
      .insert(directMessages)
      .values(messageData as any)
      .returning();

    // Update conversation last message
    await db
      .update(messageConversations)
      .set({ 
        lastMessageId: newMessage.id,
        lastMessageAt: new Date(),
        updatedAt: new Date(),
       } as any)
      .where(eq(messageConversations.id, conversationId));

    // Create notification for receiver
    try {
      await this.createMessageNotification(actualReceiverId, newMessage.id, conversationId, senderId, content);
    } catch (notificationError) {
      console.error('Failed to create notification:', notificationError);
      // Don't fail the message if notification fails
    }

    return newMessage;
  }

  // ===== NOTIFICATION SYSTEM FUNCTIONS =====
  
  async createNotification(
    userId: string,
    type: string,
    title: string,
    content: string,
    actionUrl?: string,
    relatedId?: string,
    senderHandle?: string,
    senderName?: string,
    senderAvatar?: string
  ) {
    try {
      const [notification] = await db
        .insert(notifications)
        .values({
          userId,
          type,
          title,
          content,
          actionUrl,
          relatedId,
          senderHandle,
          senderName,
          senderAvatar,
          isRead: false
        } as any)
        .returning();

      console.log(`🔔 Created notification for ${userId}:`, { type, title });
      return notification;
    } catch (error) {
      console.error('Failed to create notification:', error);
      throw error;
    }
  }

  async getUserNotifications(userId: string, limit: number = 20, offset: number = 0, unreadOnly: boolean = false) {
    try {
      let baseQuery = db
        .select()
        .from(notifications)
        .orderBy(desc(notifications.createdAt))
        .limit(limit)
        .offset(offset);

      let whereCondition;
      if (unreadOnly) {
        whereCondition = and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, false)
        );
      } else {
        whereCondition = eq(notifications.userId, userId);
      }

      const userNotifications = await baseQuery.where(whereCondition);
      return { notifications: userNotifications };
    } catch (error) {
      console.error('Failed to get user notifications:', error);
      throw error;
    }
  }

  async markNotificationAsRead(notificationId: string, userId: string) {
    try {
      const [updatedNotification] = await db
        .update(notifications)
        .set({  isRead: true  } as any)
        .where(and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, userId)
        ))
        .returning();

      return { success: true, notification: updatedNotification };
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      throw error;
    }
  }

  async markAllNotificationsAsRead(userId: string) {
    try {
      await db
        .update(notifications)
        .set({  isRead: true  } as any)
        .where(and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, false)
        ));

      return { success: true, message: 'All notifications marked as read' };
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      throw error;
    }
  }

  async getUnreadNotificationCount(userId: string) {
    try {
      const [result] = await db
        .select({ count: count() })
        .from(notifications)
        .where(and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, false)
        ));

      return { unreadCount: result?.count || 0 };
    } catch (error) {
      console.error('Failed to get unread notification count:', error);
      throw error;
    }
  }

  async searchUsers(query: string, limit: number = 10) {
    try {
      const users = await db
        .select({
          handle: socialProfiles.handle,
          displayName: socialProfiles.displayName,
          profileImageUrl: socialProfiles.profileImageUrl,
        })
        .from(socialProfiles)
        .where(
          or(
            sql`${socialProfiles.handle} ILIKE ${`%${query}%`}`,
            sql`${socialProfiles.displayName} ILIKE ${`%${query}%`}`
          )
        )
        .limit(limit);

      return { users };
    } catch (error) {
      console.error('Failed to search users:', error);
      throw error;
    }
  }

  // Removed retweetPost function - posts table doesn't have retweetedPostId/isRetweet columns

  // Add missing getUserConversations function with participant data
  async getUserConversations(userId: string) {
    const conversations = await db
      .select()
      .from(messageConversations)
      .where(
        or(
          eq(messageConversations.participantOneId, userId),
          eq(messageConversations.participantTwoId, userId)
        )
      )
      .orderBy(desc(messageConversations.lastMessageAt));

    // Enhance conversations with participant user data
    const enhancedConversations = [];
    
    for (const conversation of conversations) {
      // Determine the other participant ID
      const otherParticipantId = conversation.participantOneId === userId 
        ? conversation.participantTwoId 
        : conversation.participantOneId;

      // Get user data for the other participant from social_profiles
      let otherParticipant;
      try {
        console.log(`💬 [CONVERSATION] Looking up profile for participant: ${otherParticipantId}`);
        const profileResult = await db
          .select()
          .from(socialProfiles)
          .where(eq(socialProfiles.handle, otherParticipantId))
          .limit(1);

        console.log(`💬 [CONVERSATION] Profile lookup result:`, profileResult);

        if (profileResult.length > 0) {
          const profile = profileResult[0];
          console.log(`💬 [CONVERSATION] Profile found:`, profile);
          otherParticipant = {
            id: profile.handle,
            walletAddress: profile.handle,
            displayName: profile.displayName || profile.handle,
            profileImageUrl: profile.profileImageUrl,
            lastSeen: new Date().toISOString(),
            isOnline: false // Default to offline for now
          };
          console.log(`💬 [CONVERSATION] Created participant object:`, otherParticipant);
        } else {
          console.log(`💬 [CONVERSATION] No profile found for: ${otherParticipantId}, skipping conversation`);
          // Skip conversations with users who don't have profiles
          continue;
        }
      } catch (error) {
        console.error('💬 [CONVERSATION] Error fetching participant data:', error);
        // Skip conversations with database errors
        continue;
      }

      enhancedConversations.push({
        ...conversation,
        otherParticipant,
        unreadCount: 0 // Default for now
      });
    }

    return enhancedConversations;
  }

  async createMessageNotification(userId: string, messageId: string, conversationId: string, senderName: string, messagePreview: string) {
    const notification = {
      user_id: userId,
      message_id: messageId,
      conversation_id: conversationId,
      sender_name: senderName,
      message_preview: messagePreview.length > 100 ? messagePreview.substring(0, 100) + '...' : messagePreview,
      is_read: false
    };

    await db.execute(
      sql`
        INSERT INTO message_notifications (user_id, message_id, conversation_id, sender_name, message_preview, is_read)
        VALUES (${notification.user_id}, ${notification.message_id}, ${notification.conversation_id}, ${notification.sender_name}, ${notification.message_preview}, ${notification.is_read})
      `
    );
  }


  async getConversations(userId: string) {
    const conversations = await db
      .select()
      .from(messageConversations)
      .where(
        or(
          eq(messageConversations.participantOneId, userId),
          eq(messageConversations.participantTwoId, userId)
        )
      )
      .orderBy(desc(messageConversations.lastMessageAt));

    // Enhance conversations with participant user data
    const enhancedConversations = [];
    
    for (const conversation of conversations) {
      // Determine the other participant ID
      const otherParticipantId = conversation.participantOneId === userId 
        ? conversation.participantTwoId 
        : conversation.participantOneId;

      // Get the other participant's user data  
      const [otherParticipant] = await db
        .select({
          id: socialProfiles.id,
          handle: socialProfiles.walletAddress,
          displayName: socialProfiles.displayName,
          bio: socialProfiles.bio,
          profileImageUrl: socialProfiles.profileImageUrl,
          isOnline: sql<boolean>`true`.as('isOnline'),
          lastSeen: sql<string>`NOW()`.as('lastSeen')
        })
        .from(socialProfiles)
        .where(eq(socialProfiles.id, parseInt(otherParticipantId)));

      // Get last message
      const [lastMessage] = await db
        .select()
        .from(directMessages)
        .where(eq(directMessages.conversationId, conversation.id))
        .orderBy(desc(directMessages.createdAt))
        .limit(1);

      // Count unread messages for this user
      const unreadResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(directMessages)
        .where(
          and(
            eq(directMessages.conversationId, conversation.id),
            eq(directMessages.isRead, false),
            ne(directMessages.senderId, userId)
          )
        );

      enhancedConversations.push({
        ...conversation,
        otherParticipant: otherParticipant || {
          id: otherParticipantId,
          handle: `user${otherParticipantId}`,
          displayName: `User ${otherParticipantId}`,
          bio: '',
          profileImageUrl: null,
          isOnline: false,
          lastSeen: new Date().toISOString()
        },
        lastMessage: lastMessage || null,
        unreadCount: unreadResult[0]?.count || 0
      });
    }

    return enhancedConversations;
  }

  async getMessages(conversationId: string, page: number = 0, limit: number = 50) {
    const messages = await db
      .select()
      .from(directMessages)
      .where(
        and(
          eq(directMessages.conversationId, conversationId),
          eq(directMessages.isDeleted, false)
        )
      )
      .orderBy(desc(directMessages.createdAt))
      .limit(limit)
      .offset(page * limit);

    return messages.reverse(); // Return in chronological order
  }

  async addVoiceMessage(messageId: string, audioUrl: string, duration?: number, transcription?: string) {
    const voiceMessageData: InsertVoiceMessage = {
      messageId,
      audioUrl,
      duration,
      transcription,
    };

    const [newVoiceMessage] = await db
      .insert(voiceMessages)
      .values(voiceMessageData as any)
      .returning();

    return newVoiceMessage;
  }


  async markMessagesAsRead(conversationId: string, userId: string) {
    await db
      .update(directMessages)
      .set({  
        isRead: true,
        updatedAt: new Date()
       } as any)
      .where(
        and(
          eq(directMessages.conversationId, conversationId),
          eq(directMessages.receiverId, userId),
          eq(directMessages.isRead, false)
        )
      );
  }

  async deleteMessage(messageId: string, userId: string) {
    try {
      // First, check if the message exists and belongs to the user
      const message = await db
        .select()
        .from(directMessages)
        .where(
          and(
            eq(directMessages.id, messageId),
            eq(directMessages.senderId, userId)
          )
        )
        .limit(1);

      if (message.length === 0) {
        return { success: false, error: "Message not found or you don't have permission to delete it" };
      }

      // Mark the message as deleted instead of actually deleting it
      await db
        .update(directMessages)
        .set({  
          isDeleted: true,
          updatedAt: new Date()
         } as any)
        .where(eq(directMessages.id, messageId));

      console.log(`✅ [DELETE MESSAGE] Message ${messageId} marked as deleted by user ${userId}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ [DELETE MESSAGE] Error deleting message ${messageId}:`, error);
      return { success: false, error: "Failed to delete message" };
    }
  }

  async archiveMessage(messageId: string, userId: string) {
    try {
      // Check if the message exists and the user is a participant
      const message = await db
        .select()
        .from(directMessages)
        .where(eq(directMessages.id, messageId))
        .limit(1);

      if (message.length === 0) {
        return { success: false, error: "Message not found" };
      }

      const messageData = message[0];

      // Check if user is either sender or receiver
      if (messageData.senderId !== userId && messageData.receiverId !== userId) {
        return { success: false, error: "You don't have permission to archive this message" };
      }

      // Get current archived users array (handle null case)
      const currentArchivedBy = messageData.archivedByUserIds || [];
      
      // Check if already archived by this user
      if (currentArchivedBy.includes(userId)) {
        return { success: false, error: "Message already archived by this user" };
      }

      // Add user to archived list
      const updatedArchivedBy = [...currentArchivedBy, userId];

      await db
        .update(directMessages)
        .set({  
          archivedByUserIds: updatedArchivedBy,
          updatedAt: new Date()
         } as any)
        .where(eq(directMessages.id, messageId));

      console.log(`📦 [ARCHIVE MESSAGE] Message ${messageId} archived by user ${userId}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ [ARCHIVE MESSAGE] Error archiving message ${messageId}:`, error);
      return { success: false, error: "Failed to archive message" };
    }
  }

  // Alias for commentOnPost to match route expectations
  async createComment(postId: string, userId: string, content: string, parentCommentId?: string) {
    return this.commentOnPost(postId, userId, content, parentCommentId);
  }

  // Profile image update method
  async updateProfileImage(handle: string, updates: { profileImageUrl?: string; coverImageUrl?: string }) {
    return this.updateProfile(handle, updates);
  }
}

export const socialMediaService = new SocialMediaService();