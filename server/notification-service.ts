import { db } from "./db";
import { notifications, users, deviceTokens } from "../shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export interface CreateNotificationData {
  userId: string; // User handle who will receive the notification
  type: 'message' | 'mention' | 'like' | 'comment' | 'follow' | 'system';
  title: string;
  content: string;
  actionUrl?: string; // Where to navigate when clicked
  relatedId?: string; // ID of related item (message, post, etc.)
  senderHandle?: string; // Who triggered this notification
  senderName?: string;
  senderAvatar?: string;
}

class NotificationService {
  
  async createNotification(data: CreateNotificationData) {
    console.log(`🔔 [NOTIFICATIONS] Creating notification for ${data.userId}: ${data.type}`);
    
    try {
      const [notification] = await db.insert(notifications).values({
        userId: data.userId,
        type: data.type,
        title: data.title,
        content: data.content,
        actionUrl: data.actionUrl,
        relatedId: data.relatedId,
        senderHandle: data.senderHandle,
        senderName: data.senderName,
        senderAvatar: data.senderAvatar,
        isRead: false,
      } as any).returning();

      console.log(`✅ [NOTIFICATIONS] Notification created: ${notification.id}`);
      
      // TODO: Emit WebSocket event for real-time delivery
      // TODO: Send push notification if user has device tokens
      
      return notification;
    } catch (error) {
      console.error("❌ [NOTIFICATIONS] Failed to create notification:", error);
      throw error;
    }
  }

  async getNotifications(userId: string, limit: number = 50, offset: number = 0) {
    console.log(`📋 [NOTIFICATIONS] Fetching notifications for ${userId}`);
    
    try {
      const userNotifications = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt))
        .limit(limit)
        .offset(offset);

      console.log(`✅ [NOTIFICATIONS] Found ${userNotifications.length} notifications`);
      return userNotifications;
    } catch (error) {
      console.error("❌ [NOTIFICATIONS] Failed to fetch notifications:", error);
      throw error;
    }
  }

  async getUnreadCount(userId: string) {
    try {
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.isRead, false)
          )
        );

      const count = Number(result[0]?.count || 0);
      console.log(`📊 [NOTIFICATIONS] Unread count for ${userId}: ${count}`);
      return count;
    } catch (error) {
      console.error("❌ [NOTIFICATIONS] Failed to get unread count:", error);
      return 0;
    }
  }

  async markAsRead(notificationId: string, userId: string) {
    console.log(`✓ [NOTIFICATIONS] Marking notification as read: ${notificationId}`);
    
    try {
      const [updated] = await db
        .update(notifications)
        .set({  isRead: true  } as any)
        .where(
          and(
            eq(notifications.id, notificationId),
            eq(notifications.userId, userId)
          )
        )
        .returning();

      if (!updated) {
        throw new Error("Notification not found or access denied");
      }

      console.log(`✅ [NOTIFICATIONS] Notification marked as read`);
      return updated;
    } catch (error) {
      console.error("❌ [NOTIFICATIONS] Failed to mark as read:", error);
      throw error;
    }
  }

  async markAllAsRead(userId: string) {
    console.log(`✓✓ [NOTIFICATIONS] Marking all notifications as read for ${userId}`);
    
    try {
      await db
        .update(notifications)
        .set({  isRead: true  } as any)
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.isRead, false)
          )
        );

      console.log(`✅ [NOTIFICATIONS] All notifications marked as read`);
      return true;
    } catch (error) {
      console.error("❌ [NOTIFICATIONS] Failed to mark all as read:", error);
      throw error;
    }
  }

  async deleteNotification(notificationId: string, userId: string) {
    console.log(`🗑️ [NOTIFICATIONS] Deleting notification: ${notificationId}`);
    
    try {
      const deleted = await db
        .delete(notifications)
        .where(
          and(
            eq(notifications.id, notificationId),
            eq(notifications.userId, userId)
          )
        )
        .returning();

      if (!deleted.length) {
        throw new Error("Notification not found or access denied");
      }

      console.log(`✅ [NOTIFICATIONS] Notification deleted`);
      return true;
    } catch (error) {
      console.error("❌ [NOTIFICATIONS] Failed to delete notification:", error);
      throw error;
    }
  }

  async createMessageNotification(receiverHandle: string, senderHandle: string, messageContent: string, conversationId: string) {
    try {
      const sender = await db
        .select()
        .from(users)
        .where(eq(users.handle, senderHandle))
        .limit(1);

      if (!sender.length) {
        console.warn(`⚠️ [NOTIFICATIONS] Sender not found: ${senderHandle}`);
        return null;
      }

      const senderData = sender[0];
      const truncatedMessage = messageContent.length > 100 
        ? messageContent.substring(0, 100) + '...' 
        : messageContent;

      return await this.createNotification({
        userId: receiverHandle,
        type: 'message',
        title: `New message from ${senderData.displayName || senderHandle}`,
        content: truncatedMessage,
        actionUrl: `/messaging?conversation=${conversationId}`,
        relatedId: conversationId,
        senderHandle: senderHandle,
        senderName: senderData.displayName || senderHandle,
        senderAvatar: senderData.profileImageUrl || undefined,
      });
    } catch (error) {
      console.error("❌ [NOTIFICATIONS] Failed to create message notification:", error);
      return null;
    }
  }

  async createMentionNotification(mentionedHandle: string, mentionerHandle: string, postId: string, content: string) {
    try {
      const mentioner = await db
        .select()
        .from(users)
        .where(eq(users.handle, mentionerHandle))
        .limit(1);

      if (!mentioner.length) {
        console.warn(`⚠️ [NOTIFICATIONS] Mentioner not found: ${mentionerHandle}`);
        return null;
      }

      const mentionerData = mentioner[0];

      return await this.createNotification({
        userId: mentionedHandle,
        type: 'mention',
        title: `${mentionerData.displayName || mentionerHandle} mentioned you`,
        content: content.substring(0, 100),
        actionUrl: `/social?post=${postId}`,
        relatedId: postId,
        senderHandle: mentionerHandle,
        senderName: mentionerData.displayName || mentionerHandle,
        senderAvatar: mentionerData.profileImageUrl || undefined,
      });
    } catch (error) {
      console.error("❌ [NOTIFICATIONS] Failed to create mention notification:", error);
      return null;
    }
  }

  async registerDevice(data: {
    userId: string;
    deviceToken: string;
    deviceType: string;
    deviceId: string;
  }) {
    console.log(`📱 [NOTIFICATIONS] Registering device for ${data.userId}`);
    
    try {
      // Check if device already exists and update, or insert new
      const existingDevice = await db.query.deviceTokens.findFirst({
        where: (tokens, { and, eq }) => and(
          eq(tokens.userId, data.userId),
          eq(tokens.deviceId, data.deviceId)
        ),
      });

      if (existingDevice) {
        // Update existing device token
        await db.update(deviceTokens)
          .set({ 
            deviceToken: data.deviceToken,
            platform: data.deviceType,
            lastUsed: new Date(),
           } as any)
          .where(and(
            eq(deviceTokens.userId, data.userId),
            eq(deviceTokens.deviceId, data.deviceId)
          ));
        console.log(`📱 [NOTIFICATIONS] Updated device token for ${data.userId}`);
      } else {
        // Insert new device
        await db.insert(deviceTokens).values({
          userId: data.userId,
          deviceId: data.deviceId,
          deviceToken: data.deviceToken,
          platform: data.deviceType,
        } as any);
        console.log(`📱 [NOTIFICATIONS] Registered new device for ${data.userId}`);
      }

      return { success: true };
    } catch (error) {
      console.error("❌ [NOTIFICATIONS] Error registering device:", error);
      throw error;
    }
  }
}

export const notificationService = new NotificationService();
