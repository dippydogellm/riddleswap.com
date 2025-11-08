import express from 'express';
import { eq, and, desc, asc, gte, lte, count } from 'drizzle-orm';
import { db } from '../db';
import { 
  launchChatMessages, 
  launchChatSessions, 
  launchChatRoomSettings,
  tokenLaunches,
  type InsertLaunchChatMessage,
  type InsertLaunchChatRoomSettings
} from '../../shared/schema';

const router = express.Router();

// Get chat messages for a launch (with pagination)
router.get('/launch/:launchId/messages', async (req, res) => {
  try {
    const launchId = parseInt(req.params.launchId);
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = (page - 1) * limit;

    if (isNaN(launchId)) {
      return res.status(400).json({ success: false, error: 'Invalid launch ID' });
    }

    // Verify launch exists
    const launch = await db.query.tokenLaunches.findFirst({
      columns: { id: true },
      where: eq(tokenLaunches.id, launchId)
    });

    if (!launch) {
      return res.status(404).json({ success: false, error: 'Launch not found' });
    }

    // Get messages with pagination
    const messages = await db.select()
      .from(launchChatMessages)
      .where(and(
        eq(launchChatMessages.launchId, launchId),
        eq(launchChatMessages.isDeleted, false)
      ))
      .orderBy(desc(launchChatMessages.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total message count for pagination
    const [{ total }] = await db.select({ 
      total: count() 
    })
    .from(launchChatMessages)
    .where(and(
      eq(launchChatMessages.launchId, launchId),
      eq(launchChatMessages.isDeleted, false)
    ));

    res.json({
      success: true,
      data: {
        messages: messages.reverse(), // Show oldest first in UI
        pagination: {
          page,
          limit,
          total: Number(total),
          pages: Math.ceil(Number(total) / limit)
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching chat messages:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch chat messages' 
    });
  }
});

// Get online users for a launch
router.get('/launch/:launchId/users', async (req, res) => {
  try {
    const launchId = parseInt(req.params.launchId);

    if (isNaN(launchId)) {
      return res.status(400).json({ success: false, error: 'Invalid launch ID' });
    }

    // Get active sessions for this launch (last 10 minutes)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    
    const activeSessions = await db.select()
      .from(launchChatSessions)
      .where(and(
        eq(launchChatSessions.launchId, launchId),
        eq(launchChatSessions.isOnline, true),
        gte(launchChatSessions.lastActivity, tenMinutesAgo)
      ));

    // Get launch details to check creator
    const launch = await db.query.tokenLaunches.findFirst({
      columns: { creatorWallet: true },
      where: eq(tokenLaunches.id, launchId)
    });

    // Enhance with verification status
    const usersWithStatus = activeSessions.map(session => ({
      userId: session.userWallet,
      userHandle: session.userHandle,
      isDeveloper: launch?.creatorWallet === session.userWallet,
      isNftHolder: false, // TODO: Implement NFT check
      isVerified: false,  // TODO: Implement verification check
      isTyping: session.isTyping,
      joinedAt: session.joinedAt,
      lastActivity: session.lastActivity
    }));

    res.json({
      success: true,
      data: {
        users: usersWithStatus,
        count: usersWithStatus.length
      }
    });

  } catch (error) {
    console.error('❌ Error fetching chat users:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch chat users' 
    });
  }
});

// Get chat room settings for a launch
router.get('/launch/:launchId/settings', async (req, res) => {
  try {
    const launchId = parseInt(req.params.launchId);

    if (isNaN(launchId)) {
      return res.status(400).json({ success: false, error: 'Invalid launch ID' });
    }

    // Get or create default settings
    let settings = await db.query.launchChatRoomSettings.findFirst({
      where: eq(launchChatRoomSettings.launchId, launchId)
    });

    if (!settings) {
      // Create default settings
      const defaultSettings: InsertLaunchChatRoomSettings = {
        launchId,
        isEnabled: true,
        isPublic: true,
        requiresNftToChat: false,
        messageRateLimit: 5,
        maxMessageLength: 500,
        allowMedia: false,
        moderationEnabled: true,
        autoModeration: true,
        bannedWords: [],
        developerOnly: false,
        mutedUsers: []
      };

      [settings] = await db.insert(launchChatRoomSettings)
        .values(defaultSettings as any)
        .returning();
    }

    res.json({
      success: true,
      data: settings
    });

  } catch (error) {
    console.error('❌ Error fetching chat settings:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch chat settings' 
    });
  }
});

// Update chat room settings (developer only)
router.put('/launch/:launchId/settings', async (req, res) => {
  try {
    const launchId = parseInt(req.params.launchId);
    const { userWallet } = req.body;

    if (isNaN(launchId)) {
      return res.status(400).json({ success: false, error: 'Invalid launch ID' });
    }

    if (!userWallet) {
      return res.status(400).json({ success: false, error: 'User wallet required' });
    }

    // Verify user is the launch creator
    const launch = await db.query.tokenLaunches.findFirst({
      columns: { creatorWallet: true },
      where: eq(tokenLaunches.id, launchId)
    });

    if (!launch || launch.creatorWallet !== userWallet) {
      return res.status(403).json({ 
        success: false, 
        error: 'Only launch creators can update chat settings' 
      });
    }

    // Update settings
    const updateData = {
      ...req.body,
      launchId, // Ensure launchId is set
      userWallet: undefined // Remove from update data
    };
    delete updateData.userWallet;

    const [updatedSettings] = await db.update(launchChatRoomSettings)
      .set(updateData)
      .where(eq(launchChatRoomSettings.launchId, launchId))
      .returning();

    res.json({
      success: true,
      data: updatedSettings
    });

  } catch (error) {
    console.error('❌ Error updating chat settings:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update chat settings' 
    });
  }
});

// Delete/moderate a message (developer or admin only)
router.delete('/message/:messageId', async (req, res) => {
  try {
    const messageId = req.params.messageId;
    const { userWallet, reason } = req.body;

    if (!userWallet) {
      return res.status(400).json({ success: false, error: 'User wallet required' });
    }

    // Get message details
    const message = await db.query.launchChatMessages.findFirst({
      where: eq(launchChatMessages.id, messageId)
    });

    if (!message) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }

    // Verify user is the launch creator or message sender
    const launch = await db.query.tokenLaunches.findFirst({
      columns: { creatorWallet: true },
      where: eq(tokenLaunches.id, message.launchId)
    });

    const canModerate = launch?.creatorWallet === userWallet || message.senderWallet === userWallet;

    if (!canModerate) {
      return res.status(403).json({ 
        success: false, 
        error: 'Not authorized to moderate this message' 
      });
    }

    // Mark message as deleted
    await db.update(launchChatMessages)
      .set({ 
        isDeleted: true,
        moderatedBy: userWallet,
        moderatedAt: new Date(),
        flagReason: reason || 'Deleted by user'
       } as any)
      .where(eq(launchChatMessages.id, messageId));

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting message:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete message' 
    });
  }
});

// Flag a message for review
router.post('/message/:messageId/flag', async (req, res) => {
  try {
    const messageId = req.params.messageId;
    const { userWallet, reason } = req.body;

    if (!userWallet || !reason) {
      return res.status(400).json({ 
        success: false, 
        error: 'User wallet and reason required' 
      });
    }

    // Update message with flag
    const [updatedMessage] = await db.update(launchChatMessages)
      .set({ 
        isFlagged: true,
        flagReason: reason,
        moderatedAt: new Date()
       } as any)
      .where(eq(launchChatMessages.id, messageId))
      .returning();

    if (!updatedMessage) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }

    res.json({
      success: true,
      message: 'Message flagged for review'
    });

  } catch (error) {
    console.error('❌ Error flagging message:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to flag message' 
    });
  }
});

// Get chat statistics for a launch
router.get('/launch/:launchId/stats', async (req, res) => {
  try {
    const launchId = parseInt(req.params.launchId);

    if (isNaN(launchId)) {
      return res.status(400).json({ success: false, error: 'Invalid launch ID' });
    }

    // Get various statistics
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const [
      totalMessages,
      messagesLast24h,
      messagesLastHour,
      uniqueUsers,
      activeNow
    ] = await Promise.all([
      // Total messages
      db.select({ count: count() })
        .from(launchChatMessages)
        .where(and(
          eq(launchChatMessages.launchId, launchId),
          eq(launchChatMessages.isDeleted, false)
        )),
      
      // Messages in last 24 hours
      db.select({ count: count() })
        .from(launchChatMessages)
        .where(and(
          eq(launchChatMessages.launchId, launchId),
          eq(launchChatMessages.isDeleted, false),
          gte(launchChatMessages.createdAt, oneDayAgo)
        )),
      
      // Messages in last hour
      db.select({ count: count() })
        .from(launchChatMessages)
        .where(and(
          eq(launchChatMessages.launchId, launchId),
          eq(launchChatMessages.isDeleted, false),
          gte(launchChatMessages.createdAt, oneHourAgo)
        )),
      
      // Unique users who have sent messages
      db.selectDistinct({ senderWallet: launchChatMessages.senderWallet })
        .from(launchChatMessages)
        .where(and(
          eq(launchChatMessages.launchId, launchId),
          eq(launchChatMessages.isDeleted, false)
        )),
      
      // Currently active users
      db.select({ count: count() })
        .from(launchChatSessions)
        .where(and(
          eq(launchChatSessions.launchId, launchId),
          eq(launchChatSessions.isOnline, true),
          gte(launchChatSessions.lastActivity, oneHourAgo)
        ))
    ]);

    res.json({
      success: true,
      data: {
        totalMessages: Number(totalMessages[0].count),
        messagesLast24h: Number(messagesLast24h[0].count),
        messagesLastHour: Number(messagesLastHour[0].count),
        uniqueUsers: uniqueUsers.length,
        activeNow: Number(activeNow[0].count)
      }
    });

  } catch (error) {
    console.error('❌ Error fetching chat stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch chat statistics' 
    });
  }
});

// Mute/unmute a user (developer only)
router.post('/launch/:launchId/mute', async (req, res) => {
  try {
    const launchId = parseInt(req.params.launchId);
    const { userWallet, targetUser, action } = req.body; // action: 'mute' or 'unmute'

    if (isNaN(launchId) || !userWallet || !targetUser || !action) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required parameters' 
      });
    }

    // Verify user is the launch creator
    const launch = await db.query.tokenLaunches.findFirst({
      columns: { creatorWallet: true },
      where: eq(tokenLaunches.id, launchId)
    });

    if (!launch || launch.creatorWallet !== userWallet) {
      return res.status(403).json({ 
        success: false, 
        error: 'Only launch creators can mute users' 
      });
    }

    // Get current settings
    const settings = await db.query.launchChatRoomSettings.findFirst({
      where: eq(launchChatRoomSettings.launchId, launchId)
    });

    if (!settings) {
      return res.status(404).json({ 
        success: false, 
        error: 'Chat room settings not found' 
      });
    }

    let mutedUsers = settings.mutedUsers || [];

    if (action === 'mute') {
      if (!mutedUsers.includes(targetUser)) {
        mutedUsers.push(targetUser);
      }
    } else if (action === 'unmute') {
      mutedUsers = mutedUsers.filter(user => user !== targetUser);
    }

    // Update settings
    await db.update(launchChatRoomSettings)
      .set({  mutedUsers  } as any)
      .where(eq(launchChatRoomSettings.launchId, launchId));

    res.json({
      success: true,
      message: `User ${action}d successfully`,
      data: { mutedUsers }
    });

  } catch (error) {
    console.error('❌ Error muting/unmuting user:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update user mute status' 
    });
  }
});

export default router;