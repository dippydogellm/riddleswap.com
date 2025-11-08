import { Express, Request, Response } from "express";
import { db } from "../db";
import { 
  streamSessions, 
  streamViewers, 
  streamAnalytics,
  streamModerationEvents,
  tokenLaunches,
  insertStreamSessionSchema,
  insertStreamAnalyticsSchema,
  insertStreamModerationEventSchema,
  type StreamSession,
  type StreamViewer,
  type StreamAnalytics
} from "@shared/schema";
import { eq, and, desc, gte, lte, count, sum, avg } from "drizzle-orm";
import { z } from "zod";
import { sessionAuth } from "../middleware/session-auth";

// ICE servers configuration for WebRTC
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

export function registerStreamingRoutes(app: Express) {
  console.log('🎥 Registering streaming routes...');

  // Create a new stream session
  app.post('/api/streaming/create', sessionAuth, async (req: Request, res: Response) => {
    try {
      const { launchId, streamTitle, streamDescription, streamType = 'webrtc', maxViewers = 1000, allowChat = true, moderatedMode = false } = req.body;
      
      if (!launchId || !streamTitle) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

  // FIX: use walletAddress property exposed on req.user instead of non-existent 'wallet'
  const userWallet = (req.user as any)?.walletAddress;
      if (!userWallet) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Verify the user owns this launch
      const launch = await db.query.tokenLaunches.findFirst({
        where: eq(tokenLaunches.id, launchId)
      });

      if (!launch || launch.creatorWallet !== userWallet) {
        return res.status(403).json({ error: 'Not authorized to create stream for this launch' });
      }

      // Check if there's already an active stream for this launch
      const existingStream = await db.query.streamSessions.findFirst({
        where: and(
          eq(streamSessions.launchId, launchId),
          eq(streamSessions.status, 'live')
        )
      });

      if (existingStream) {
        return res.status(409).json({ error: 'Stream already active for this launch' });
      }

      // Create stream session
      const streamData = insertStreamSessionSchema.parse({
        launchId,
        streamerWallet: userWallet,
        streamTitle,
        streamDescription,
        streamType,
        maxViewers,
        allowChat,
        moderatedMode,
        iceServers: ICE_SERVERS,
        status: 'preparing'
      });

      const [newStream] = await db.insert(streamSessions).values(streamData as any).returning();

      res.json({ 
        success: true, 
        stream: newStream,
        iceServers: ICE_SERVERS
      });

      console.log(`🎥 Stream created for launch ${launchId} by ${userWallet.slice(0, 8)}`);
    } catch (error) {
      console.error('❌ Error creating stream:', error);
      res.status(500).json({ error: 'Failed to create stream' });
    }
  });

  // Get stream session details
  app.get('/api/streaming/session/:streamId', async (req: Request, res: Response) => {
    try {
      const { streamId } = req.params;

      const stream = await db.query.streamSessions.findFirst({
        where: eq(streamSessions.id, streamId),
        with: {
          launch: {
            columns: {
              id: true,
              tokenName: true,
              tokenSymbol: true,
              creatorWallet: true,
              status: true
            }
          }
        }
      });

      if (!stream) {
        return res.status(404).json({ error: 'Stream not found' });
      }

      // Get current viewer count
      const viewerCount = await db.select({ count: count() })
        .from(streamViewers)
        .where(and(
          eq(streamViewers.streamId, streamId),
          eq(streamViewers.connectionState, 'connected')
        ));

      const response = {
        ...stream,
        currentViewers: viewerCount[0]?.count || 0,
        iceServers: ICE_SERVERS
      };

      res.json(response);
    } catch (error) {
      console.error('❌ Error getting stream session:', error);
      res.status(500).json({ error: 'Failed to get stream session' });
    }
  });

  // Get active stream for a launch
  app.get('/api/streaming/launch/:launchId/active', async (req: Request, res: Response) => {
    try {
      const { launchId } = req.params;

      const activeStream = await db.query.streamSessions.findFirst({
        where: and(
          eq(streamSessions.launchId, parseInt(launchId)),
          eq(streamSessions.status, 'live')
        ),
        orderBy: desc(streamSessions.startedAt)
      });

      if (!activeStream) {
        return res.json({ stream: null });
      }

      // Get current viewer count
      const viewerCount = await db.select({ count: count() })
        .from(streamViewers)
        .where(and(
          eq(streamViewers.streamId, activeStream.id),
          eq(streamViewers.connectionState, 'connected')
        ));

      const response = {
        ...activeStream,
        currentViewers: viewerCount[0]?.count || 0,
        iceServers: ICE_SERVERS
      };

      res.json({ stream: response });
    } catch (error) {
      console.error('❌ Error getting active stream:', error);
      res.status(500).json({ error: 'Failed to get active stream' });
    }
  });

  // Update stream status
  app.patch('/api/streaming/session/:streamId/status', sessionAuth, async (req: Request, res: Response) => {
    try {
      const { streamId } = req.params;
      const { status } = req.body;

      if (!['preparing', 'live', 'ended', 'error'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

  const userWallet = (req.user as any)?.walletAddress;
      if (!userWallet) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Verify the user owns this stream
      const stream = await db.query.streamSessions.findFirst({
        where: eq(streamSessions.id, streamId)
      });

      if (!stream || stream.streamerWallet !== userWallet) {
        return res.status(403).json({ error: 'Not authorized to update this stream' });
      }

      // Update stream status
      const updateData: any = { status, updatedAt: new Date() };
      
      if (status === 'live' && !stream.startedAt) {
        updateData.startedAt = new Date();
      } else if (status === 'ended' && !stream.endedAt) {
        updateData.endedAt = new Date();
        // Calculate total duration
        if (stream.startedAt) {
          updateData.totalDuration = Math.floor((Date.now() - stream.startedAt.getTime()) / 1000);
        }
      }

      await db.update(streamSessions)
        .set(updateData)
        .where(eq(streamSessions.id, streamId));

      res.json({ success: true, status });

      console.log(`🎥 Stream ${streamId} status updated to ${status}`);
    } catch (error) {
      console.error('❌ Error updating stream status:', error);
      res.status(500).json({ error: 'Failed to update stream status' });
    }
  });

  // Get stream analytics
  app.get('/api/streaming/session/:streamId/analytics', async (req: Request, res: Response) => {
    try {
      const { streamId } = req.params;
      const { timeframe = '1h' } = req.query;

      // Calculate time range
      let startTime = new Date();
      switch (timeframe) {
        case '15m':
          startTime.setMinutes(startTime.getMinutes() - 15);
          break;
        case '1h':
          startTime.setHours(startTime.getHours() - 1);
          break;
        case '24h':
          startTime.setHours(startTime.getHours() - 24);
          break;
        default:
          startTime.setHours(startTime.getHours() - 1);
      }

      // Get analytics data
      const analytics = await db.select()
        .from(streamAnalytics)
        .where(and(
          eq(streamAnalytics.streamId, streamId),
          gte(streamAnalytics.timestamp, startTime)
        ))
        .orderBy(desc(streamAnalytics.timestamp));

      // Get stream summary
      const stream = await db.query.streamSessions.findFirst({
        where: eq(streamSessions.id, streamId),
        columns: {
          currentViewers: true,
          peakViewers: true,
          totalViewers: true,
          totalDuration: true,
          status: true,
          startedAt: true
        }
      });

      // Calculate aggregate metrics
      const aggregates = analytics.length > 0 ? {
        avgViewers: analytics.reduce((sum, a) => sum + a.activeViewers, 0) / analytics.length,
        peakViewers: Math.max(...analytics.map(a => a.activeViewers)),
        totalChatMessages: analytics.reduce((sum, a) => sum + (a.chatMessages || 0), 0),
        avgConnectionQuality: analytics.reduce((sum, a) => sum + (parseFloat(a.avgConnectionQuality || '0')), 0) / analytics.length,
        totalDroppedConnections: analytics.reduce((sum, a) => sum + (a.droppedConnections || 0), 0)
      } : {
        avgViewers: 0,
        peakViewers: 0,
        totalChatMessages: 0,
        avgConnectionQuality: 0,
        totalDroppedConnections: 0
      };

      res.json({
        stream,
        analytics,
        aggregates,
        timeframe
      });
    } catch (error) {
      console.error('❌ Error getting stream analytics:', error);
      res.status(500).json({ error: 'Failed to get stream analytics' });
    }
  });

  // Record analytics data point
  app.post('/api/streaming/session/:streamId/analytics', async (req: Request, res: Response) => {
    try {
      const { streamId } = req.params;
      const { activeViewers, totalViewers, chatMessages = 0, avgConnectionQuality = 0, droppedConnections = 0, reconnections = 0 } = req.body;

      const analyticsData = insertStreamAnalyticsSchema.parse({
        streamId,
        activeViewers,
        totalViewers,
        chatMessages,
        avgConnectionQuality: avgConnectionQuality ? avgConnectionQuality.toString() : '0',
        droppedConnections,
        reconnections
      });

      await db.insert(streamAnalytics).values(analyticsData as any);

      res.json({ success: true });
    } catch (error) {
      console.error('❌ Error recording analytics:', error);
      res.status(500).json({ error: 'Failed to record analytics' });
    }
  });

  // Get all streams for a launch (history)
  app.get('/api/streaming/launch/:launchId/streams', async (req: Request, res: Response) => {
    try {
      const { launchId } = req.params;
      const { limit = 10, offset = 0 } = req.query;

      const streams = await db.select()
        .from(streamSessions)
        .where(eq(streamSessions.launchId, parseInt(launchId)))
        .orderBy(desc(streamSessions.createdAt))
        .limit(parseInt(limit as string))
        .offset(parseInt(offset as string));

      res.json({ streams });
    } catch (error) {
      console.error('❌ Error getting launch streams:', error);
      res.status(500).json({ error: 'Failed to get launch streams' });
    }
  });

  // Get live streams (for discovery)
  app.get('/api/streaming/live', async (req: Request, res: Response) => {
    try {
      const { limit = 20, offset = 0 } = req.query;

      const liveStreams = await db.select({
        id: streamSessions.id,
        launchId: streamSessions.launchId,
        streamTitle: streamSessions.streamTitle,
        streamDescription: streamSessions.streamDescription,
        currentViewers: streamSessions.currentViewers,
        peakViewers: streamSessions.peakViewers,
        startedAt: streamSessions.startedAt,
        streamerWallet: streamSessions.streamerWallet
      })
        .from(streamSessions)
        .innerJoin(tokenLaunches, eq(streamSessions.launchId, tokenLaunches.id))
        .where(eq(streamSessions.status, 'live'))
        .orderBy(desc(streamSessions.currentViewers))
        .limit(parseInt(limit as string))
        .offset(parseInt(offset as string));

      res.json({ liveStreams });
    } catch (error) {
      console.error('❌ Error getting live streams:', error);
      res.status(500).json({ error: 'Failed to get live streams' });
    }
  });

  // Moderate stream (kick viewer, etc.)
  app.post('/api/streaming/session/:streamId/moderate', sessionAuth, async (req: Request, res: Response) => {
    try {
      const { streamId } = req.params;
      const { action, targetWallet, reason } = req.body;

  const userWallet = (req.user as any)?.walletAddress;
      if (!userWallet) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Verify the user owns this stream
      const stream = await db.query.streamSessions.findFirst({
        where: eq(streamSessions.id, streamId)
      });

      if (!stream || stream.streamerWallet !== userWallet) {
        return res.status(403).json({ error: 'Not authorized to moderate this stream' });
      }

      // Record moderation event
      const moderationData = insertStreamModerationEventSchema.parse({
        streamId,
        moderatorWallet: userWallet,
        targetWallet,
        eventType: action,
        reason,
        severity: 'info',
        eventData: { action, targetWallet, reason },
        automated: false
      });

      await db.insert(streamModerationEvents).values(moderationData as any);

      // TODO: Actually implement the moderation action (kick from signaling server)

      res.json({ success: true, action, targetWallet });

      console.log(`🎥 Moderation action ${action} performed on stream ${streamId} by ${userWallet.slice(0, 8)}`);
    } catch (error) {
      console.error('❌ Error performing moderation:', error);
      res.status(500).json({ error: 'Failed to perform moderation action' });
    }
  });

  // Delete stream session
  app.delete('/api/streaming/session/:streamId', sessionAuth, async (req: Request, res: Response) => {
    try {
      const { streamId } = req.params;

  const userWallet = (req.user as any)?.walletAddress;
      if (!userWallet) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Verify the user owns this stream
      const stream = await db.query.streamSessions.findFirst({
        where: eq(streamSessions.id, streamId)
      });

      if (!stream || stream.streamerWallet !== userWallet) {
        return res.status(403).json({ error: 'Not authorized to delete this stream' });
      }

      // Delete stream (cascades to related records)
      await db.delete(streamSessions).where(eq(streamSessions.id, streamId));

      res.json({ success: true });

      console.log(`🗑️ Stream ${streamId} deleted by ${userWallet.slice(0, 8)}`);
    } catch (error) {
      console.error('❌ Error deleting stream:', error);
      res.status(500).json({ error: 'Failed to delete stream' });
    }
  });

  console.log('✅ Streaming routes registered successfully');
}