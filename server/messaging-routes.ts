import { Express, Request, Response } from "express";
import { AuthenticatedRequest, requireAuthentication } from "./middleware/session-auth";
import { db } from './db';
import { sql, eq, and, or, desc, asc } from 'drizzle-orm';
import { socialProfiles, posts } from '../shared/schema';
import { notificationService } from './notification-service';

// TypeScript interfaces for messaging system
interface User {
  id: string;
  handle: string;
  walletAddress: string;
  displayName: string;
  profileImageUrl: string | null;
  lastSeen: string;
  isOnline: boolean;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  messageType: string;
  imageUrl?: string | null;
  isRead: boolean;
  isDelivered: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Conversation {
  id: string;
  participantOneId: string;
  participantTwoId: string;
  lastMessage: Message | null;
  lastMessageAt: string;
  unreadCount: number;
  isArchived: boolean;
  otherParticipant: User;
  createdAt: string;
  updatedAt: string;
}

// Messaging system database tables (using existing social infrastructure)
// We'll use social_profiles for users and create conversation logic

// Rate limiting for messaging
const messagingRateLimit = new Map<string, { count: number; resetTime: number }>();

const rateLimit = (maxRequests: number, windowMs: number) => {
  return (req: AuthenticatedRequest, res: Response, next: any) => {
    const identifier = req.user?.userHandle || req.ip || 'anonymous';
    const now = Date.now();
    
    if (!messagingRateLimit.has(identifier)) {
      messagingRateLimit.set(identifier, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    const userLimit = messagingRateLimit.get(identifier)!;
    
    if (now > userLimit.resetTime) {
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

export function setupMessagingAPI(app: Express) {
  console.log('💬 Setting up messaging API routes...');

  // Get conversations for authenticated user
  app.get("/api/messaging/conversations", requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userHandle = req.user?.userHandle;
      if (!userHandle) {
        return res.status(401).json({ error: "Authentication required" });
      }

      console.log(`💬 [CONVERSATIONS] Fetching for user: ${userHandle}`);

      // Fetch conversations from posts table (using DM prefix pattern)
      const conversationResults = await db.execute(sql`
        SELECT DISTINCT
          SPLIT_PART(REPLACE(content, '[DM:', ''), ']', 1) as conversation_id,
          author_handle as other_participant_handle,
          MAX(created_at) as last_message_at,
          COUNT(*) as message_count
        FROM posts 
        WHERE content LIKE '[DM:%]'
        AND (
          author_handle = ${userHandle} OR
          SPLIT_PART(REPLACE(content, '[DM:', ''), ']', 1) LIKE '%' || ${userHandle} || '%'
        )
        GROUP BY SPLIT_PART(REPLACE(content, '[DM:', ''), ']', 1), author_handle
        ORDER BY last_message_at DESC
        LIMIT 50
      `);

      // Get participant profiles for each conversation
      const conversations: Conversation[] = [];
      for (const row of conversationResults.rows) {
        const conversationId = String(row.conversation_id);
        const otherHandle = String(row.other_participant_handle) === userHandle 
          ? conversationId.replace(userHandle, '').replace('-', '') 
          : String(row.other_participant_handle);
        
        // Get other participant profile
        const profileResult = await db.execute(sql`
          SELECT handle, display_name, profile_picture_url, wallet_address, updated_at
          FROM social_profiles 
          WHERE handle = ${otherHandle}
          LIMIT 1
        `);

        if (profileResult.rows.length > 0) {
          const profile = profileResult.rows[0];
          conversations.push({
            id: conversationId,
            participantOneId: userHandle,
            participantTwoId: otherHandle,
            lastMessage: null, // Will be filled by frontend
            lastMessageAt: String(row.last_message_at),
            unreadCount: 0, // Simplified for now
            isArchived: false,
            otherParticipant: {
              id: String(profile.handle),
              handle: String(profile.handle),
              walletAddress: String(profile.wallet_address),
              displayName: String(profile.display_name) || String(profile.handle),
              profileImageUrl: profile.profile_picture_url ? String(profile.profile_picture_url) : null,
              lastSeen: String(profile.updated_at),
              isOnline: true
            },
            createdAt: String(row.last_message_at),
            updatedAt: String(row.last_message_at)
          });
        }
      }

      console.log(`✅ [CONVERSATIONS] Found ${conversations.length} conversations for ${userHandle}`);
      res.json(conversations);
    } catch (error) {
      console.error("❌ Error fetching conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  // Get messages for a specific conversation
  app.get("/api/messaging/messages/:conversationId", requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userHandle = req.user?.userHandle;
      const conversationId = req.params.conversationId;
      
      if (!userHandle) {
        return res.status(401).json({ error: "Authentication required" });
      }

      console.log(`💬 [MESSAGES] Fetching messages for conversation: ${conversationId}, user: ${userHandle}`);

      // Fetch messages from posts table using conversation ID pattern
      const messageResults = await db.execute(sql`
        SELECT 
          id,
          content,
          author_handle as sender_handle,
          created_at,
          updated_at,
          image_urls
        FROM posts 
        WHERE content LIKE ${`[DM:${conversationId}]%`}
        ORDER BY created_at ASC
        LIMIT 100
      `);

      const messages: Message[] = messageResults.rows.map((row: any) => {
        // Extract actual message content by removing the DM prefix
        const dmPrefix = `[DM:${conversationId}] `;
        const content = String(row.content);
        const actualContent = content.startsWith(dmPrefix) 
          ? content.substring(dmPrefix.length)
          : content;

        // Check if message has images
        const imageUrls = row.image_urls || [];
        const hasImage = imageUrls.length > 0;

        return {
          id: String(row.id),
          conversationId,
          senderId: String(row.sender_handle),
          content: actualContent,
          messageType: hasImage ? 'image' : 'text',
          imageUrl: hasImage ? imageUrls[0] : null,
          isRead: true, // Simplified for now
          isDelivered: true,
          createdAt: String(row.created_at),
          updatedAt: String(row.updated_at)
        };
      });

      console.log(`✅ [MESSAGES] Found ${messages.length} messages for conversation: ${conversationId}`);
      res.json(messages);
    } catch (error) {
      console.error("❌ Error fetching messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // Search users for messaging
  app.get("/api/messaging/search-users", requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userHandle = req.user?.userHandle;
      const query = req.query.q as string;
      
      if (!userHandle) {
        return res.status(401).json({ error: "Authentication required" });
      }

      if (!query?.trim()) {
        return res.json([]);
      }

      console.log(`🔍 [USER SEARCH] Searching for: "${query}" by user: ${userHandle}`);

      // Search users from social_profiles
      const searchResults = await db.execute(sql`
        SELECT 
          handle as id,
          wallet_address as walletAddress,
          display_name as displayName,
          profile_picture_url as profileImageUrl,
          updated_at as lastSeen,
          'true'::boolean as isOnline
        FROM social_profiles 
        WHERE (
          LOWER(handle) LIKE LOWER(${`%${query}%`}) OR 
          LOWER(display_name) LIKE LOWER(${`%${query}%`})
        )
        AND handle != ${userHandle}
        ORDER BY 
          CASE WHEN LOWER(handle) = LOWER(${query}) THEN 1 ELSE 2 END,
          display_name
        LIMIT 10
      `);

      const users: User[] = searchResults.rows.map((row: any) => ({
        id: row.id,
        handle: row.id,
        walletAddress: row.walletAddress,
        displayName: row.displayName || row.id,
        profileImageUrl: row.profileImageUrl,
        lastSeen: row.lastSeen,
        isOnline: true // Simplified for now
      }));

      console.log(`✅ [USER SEARCH] Found ${users.length} users`);
      res.json(users);
    } catch (error) {
      console.error("❌ Error searching users:", error);
      res.status(500).json({ error: "Failed to search users" });
    }
  });

  // Send message
  app.post("/api/messaging/send-message", requireAuthentication, rateLimit(30, 60000), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userHandle = req.user?.userHandle;
      const { conversationId, content, messageType = 'text', imageUrl } = req.body;
      
      if (!userHandle) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Allow empty content if there's an image
      if (!content?.trim() && !imageUrl) {
        return res.status(400).json({ error: "Message content or image is required" });
      }

      if (content && content.length > 5000) {
        return res.status(400).json({ error: "Message too long. Maximum 5000 characters allowed." });
      }

      console.log(`💬 [SEND MESSAGE] User: ${userHandle}, Conversation: ${conversationId}, Type: ${messageType}, HasImage: ${!!imageUrl}`);

      // Prepare message content with image support
      const messageContent = content?.trim() || (imageUrl ? '[Image]' : '');
      const imageUrls = imageUrl ? [imageUrl] : [];
      
      // Create a post that represents a direct message (simplified approach)
      const messageResult = await db.execute(sql`
        INSERT INTO posts (content, author_handle, author_wallet_address, image_urls)
        VALUES (${`[DM:${conversationId}] ${messageContent}`}, ${userHandle}, ${req.user?.walletAddress || ''}, ${imageUrls})
        RETURNING id, content, author_handle, created_at, image_urls
      `);

      const message = messageResult.rows[0];

      console.log(`✅ [SEND MESSAGE] Message sent with ID: ${message.id}${imageUrl ? ' (with image)' : ''}`);
      
      // Extract receiver handle from conversationId (format: conv_handle1_handle2_timestamp)
      try {
        const conversationParts = conversationId.split('_');
        if (conversationParts.length >= 3) {
          const handles = [conversationParts[1], conversationParts[2]];
          const receiverHandle = handles.find(h => h !== userHandle);
          
          if (receiverHandle) {
            // Send notification to receiver
            await notificationService.createMessageNotification(
              receiverHandle,
              userHandle,
              messageContent,
              conversationId
            );
            console.log(`🔔 [NOTIFICATION] Sent notification to ${receiverHandle}`);
          }
        }
      } catch (notifError) {
        console.error("⚠️ [NOTIFICATION] Failed to send notification:", notifError);
        // Don't fail the message send if notification fails
      }
      
      res.json({ 
        success: true,
        message: {
          id: message.id,
          conversationId,
          senderId: userHandle,
          content: messageContent,
          messageType: imageUrl ? 'image' : messageType,
          imageUrl: imageUrl || null,
          isRead: false,
          isDelivered: true,
          createdAt: message.created_at,
          updatedAt: message.created_at
        }
      });
    } catch (error) {
      console.error("❌ Error sending message:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // Start conversation
  app.post("/api/messaging/start-conversation", requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userHandle = req.user?.userHandle;
      const { participantHandle } = req.body;
      
      if (!userHandle) {
        return res.status(401).json({ error: "Authentication required" });
      }

      if (!participantHandle) {
        return res.status(400).json({ error: "Participant handle is required" });
      }

      if (participantHandle === userHandle) {
        return res.status(400).json({ error: "Cannot start conversation with yourself" });
      }

      console.log(`💬 [START CONVERSATION] User: ${userHandle}, Participant: ${participantHandle}`);

      // Verify participant exists
      const participant = await db.execute(sql`
        SELECT handle, display_name, profile_picture_url, wallet_address
        FROM social_profiles 
        WHERE handle = ${participantHandle}
      `);

      if (participant.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      const participantData = participant.rows[0];

      // Create a conversation ID (simplified approach)
      const conversationId = `conv_${[userHandle, participantHandle].sort().join('_')}_${Date.now()}`;

      console.log(`✅ [START CONVERSATION] Created conversation: ${conversationId}`);
      
      res.json({
        id: conversationId,
        participantOneId: userHandle,
        participantTwoId: participantHandle,
        lastMessage: null,
        lastMessageAt: new Date().toISOString(),
        unreadCount: 0,
        isArchived: false,
        otherParticipant: {
          id: participantData.handle,
          walletAddress: participantData.wallet_address,
          displayName: participantData.display_name || participantData.handle,
          profileImageUrl: participantData.profile_picture_url,
          lastSeen: new Date().toISOString(),
          isOnline: true
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("❌ Error starting conversation:", error);
      res.status(500).json({ error: "Failed to start conversation" });
    }
  });

  // Mark messages as read
  app.post("/api/messaging/mark-read/:conversationId", requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userHandle = req.user?.userHandle;
      const conversationId = req.params.conversationId;
      
      if (!userHandle) {
        return res.status(401).json({ error: "Authentication required" });
      }

      console.log(`✅ [MARK READ] User: ${userHandle}, Conversation: ${conversationId}`);
      
      // In a real implementation, you'd update message read status in a messages table
      res.json({ success: true });
    } catch (error) {
      console.error("❌ Error marking messages as read:", error);
      res.status(500).json({ error: "Failed to mark messages as read" });
    }
  });

  // Delete message
  app.delete("/api/messaging/delete-message/:messageId", requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userHandle = req.user?.userHandle;
      const messageId = req.params.messageId;
      
      if (!userHandle) {
        return res.status(401).json({ error: "Authentication required" });
      }

      console.log(`🗑️ [DELETE MESSAGE] User: ${userHandle}, Message: ${messageId}`);
      
      // In a real implementation, you'd mark the message as deleted
      // For now, we'll use the posts table
      await db.execute(sql`
        UPDATE posts 
        SET content = '[Message deleted]'
        WHERE id = ${messageId} AND author_handle = ${userHandle}
      `);
      
      res.json({ success: true });
    } catch (error) {
      console.error("❌ Error deleting message:", error);
      res.status(500).json({ error: "Failed to delete message" });
    }
  });

  // Archive message
  app.post("/api/messaging/archive-message/:messageId", requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userHandle = req.user?.userHandle;
      const messageId = req.params.messageId;
      
      if (!userHandle) {
        return res.status(401).json({ error: "Authentication required" });
      }

      console.log(`📦 [ARCHIVE MESSAGE] User: ${userHandle}, Message: ${messageId}`);
      
      // In a real implementation, you'd mark the message as archived
      res.json({ success: true });
    } catch (error) {
      console.error("❌ Error archiving message:", error);
      res.status(500).json({ error: "Failed to archive message" });
    }
  });

  console.log('✅ Messaging API routes setup complete!');
}