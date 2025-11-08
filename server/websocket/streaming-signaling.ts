import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { Server } from 'http';
import { db } from '../db';
import { 
  streamSessions, 
  streamViewers, 
  streamSignalingMessages,
  streamAnalytics,
  type StreamSession,
  type StreamViewer,
  type InsertStreamViewer,
  type InsertStreamSignalingMessage,
  type InsertStreamAnalytics
} from '../../shared/schema';
import { eq, and, desc, count, sql } from 'drizzle-orm';

interface StreamClient {
  ws: WebSocket;
  clientId: string;
  streamId: string;
  walletAddress: string;
  clientType: 'broadcaster' | 'viewer';
  connectionId: string;
  isAuthenticated: boolean;
  lastActivity: Date;
}

interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'stream-start' | 'stream-end' | 'viewer-join' | 'viewer-leave' | 'viewer-count' | 'error' | 'heartbeat';
  streamId: string;
  fromWallet?: string;
  toWallet?: string;
  data?: any;
  timestamp?: string;
  error?: string;
}

interface StreamMetrics {
  streamId: string;
  activeViewers: number;
  totalViewers: number;
  chatMessages: number;
  connectionQuality: number;
}

export class StreamingSignalingServer {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, StreamClient> = new Map();
  private streamClients: Map<string, Set<string>> = new Map(); // streamId -> clientIds
  private broadcasters: Map<string, string> = new Map(); // streamId -> broadcasterClientId
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    console.log('🎥 StreamingSignalingServer initializing...');
  }

  public initialize(server: Server) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws/streaming',
      clientTracking: true 
    });

    this.wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      this.handleConnection(ws, request);
    });

    this.wss.on('error', (error) => {
      console.error('🚨 Streaming WebSocket server error:', error);
    });

    // Heartbeat to keep connections alive
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 30000); // Every 30 seconds

    // Cleanup inactive connections every 5 minutes
    setInterval(() => {
      this.cleanupInactiveConnections();
    }, 5 * 60 * 1000);

    console.log('🎥 Streaming signaling server initialized on /ws/streaming');
  }

  private async handleConnection(ws: WebSocket, request: IncomingMessage) {
    const url = new URL(request.url!, `http://${request.headers.host}`);
    const streamId = url.searchParams.get('streamId');
    const walletAddress = url.searchParams.get('walletAddress');
    const clientType = url.searchParams.get('clientType') as 'broadcaster' | 'viewer';
    const sessionToken = url.searchParams.get('sessionToken');

    if (!streamId || !walletAddress || !clientType) {
      ws.close(1008, 'Missing required parameters');
      return;
    }

    // Verify authentication
    const isAuthenticated = await this.verifyAuthentication(walletAddress, sessionToken);
    if (!isAuthenticated) {
      ws.close(1008, 'Authentication failed');
      return;
    }

    // Verify stream exists
    const stream = await this.getStreamSession(streamId);
    if (!stream) {
      ws.close(1008, 'Stream not found');
      return;
    }

    // For broadcasters, verify they own the stream
    if (clientType === 'broadcaster' && stream.streamerWallet !== walletAddress) {
      ws.close(1008, 'Not authorized to broadcast this stream');
      return;
    }

    // Create client
    const clientId = `${streamId}-${walletAddress}-${Date.now()}`;
    const connectionId = crypto.randomUUID();
    
    const client: StreamClient = {
      ws,
      clientId,
      streamId,
      walletAddress,
      clientType,
      connectionId,
      isAuthenticated,
      lastActivity: new Date()
    };

    this.clients.set(clientId, client);

    // Add to stream
    if (!this.streamClients.has(streamId)) {
      this.streamClients.set(streamId, new Set());
    }
    this.streamClients.get(streamId)!.add(clientId);

    // Track broadcaster
    if (clientType === 'broadcaster') {
      this.broadcasters.set(streamId, clientId);
    }

    // Track viewer in database
    if (clientType === 'viewer') {
      await this.trackViewer(streamId, walletAddress, connectionId, request);
    }

    // Handle messages
    ws.on('message', async (data: Buffer) => {
      try {
        const message: SignalingMessage = JSON.parse(data.toString());
        await this.handleSignalingMessage(clientId, message);
      } catch (error) {
        console.error('❌ Error handling signaling message:', error);
        ws.send(JSON.stringify({
          type: 'error',
          error: 'Invalid message format'
        }));
      }
    });

    // Handle disconnect
    ws.on('close', async () => {
      await this.handleDisconnect(clientId);
    });

    ws.on('error', (error) => {
      console.error('🚨 Streaming client error:', error);
    });

    // Send viewer count update
    await this.broadcastViewerCount(streamId);

    console.log(`🎥 ${clientType === 'broadcaster' ? '📡' : '👁️'} ${walletAddress.slice(0, 8)} ${clientType === 'broadcaster' ? 'broadcasting to' : 'viewing'} stream ${streamId}`);
  }

  private async handleSignalingMessage(clientId: string, message: SignalingMessage) {
    const client = this.clients.get(clientId);
    if (!client || !client.isAuthenticated) return;

    client.lastActivity = new Date();

    // Store signaling message in database for debugging/analytics
    await this.storeSignalingMessage(message, client);

    switch (message.type) {
      case 'offer':
        await this.handleOffer(client, message);
        break;
      case 'answer':
        await this.handleAnswer(client, message);
        break;
      case 'ice-candidate':
        await this.handleIceCandidate(client, message);
        break;
      case 'stream-start':
        await this.handleStreamStart(client);
        break;
      case 'stream-end':
        await this.handleStreamEnd(client);
        break;
      case 'heartbeat':
        // Just update last activity, already done above
        break;
      default:
        client.ws.send(JSON.stringify({
          type: 'error',
          error: 'Unknown message type'
        }));
    }
  }

  private async handleOffer(broadcaster: StreamClient, message: SignalingMessage) {
    if (broadcaster.clientType !== 'broadcaster') return;

    // Store offer in database
    await this.updateStreamOffer(broadcaster.streamId, message.data);

    // Broadcast offer to all viewers
    await this.broadcastToViewers(broadcaster.streamId, {
      type: 'offer',
      streamId: broadcaster.streamId,
      fromWallet: broadcaster.walletAddress,
      data: message.data,
      timestamp: new Date().toISOString()
    });

    console.log(`📡 Broadcaster offer sent to stream ${broadcaster.streamId}`);
  }

  private async handleAnswer(viewer: StreamClient, message: SignalingMessage) {
    if (viewer.clientType !== 'viewer') return;

    // Send answer to broadcaster
    const broadcasterClientId = this.broadcasters.get(viewer.streamId);
    if (broadcasterClientId) {
      const broadcaster = this.clients.get(broadcasterClientId);
      if (broadcaster && broadcaster.ws.readyState === WebSocket.OPEN) {
        broadcaster.ws.send(JSON.stringify({
          type: 'answer',
          streamId: viewer.streamId,
          fromWallet: viewer.walletAddress,
          toWallet: broadcaster.walletAddress,
          data: message.data,
          timestamp: new Date().toISOString()
        }));

        console.log(`📺 Viewer answer sent from ${viewer.walletAddress.slice(0, 8)} to broadcaster`);
      }
    }
  }

  private async handleIceCandidate(client: StreamClient, message: SignalingMessage) {
    // ICE candidates can be sent both ways
    if (client.clientType === 'broadcaster') {
      // Broadcast ICE candidate to all viewers
      await this.broadcastToViewers(client.streamId, {
        type: 'ice-candidate',
        streamId: client.streamId,
        fromWallet: client.walletAddress,
        data: message.data,
        timestamp: new Date().toISOString()
      });
    } else {
      // Send ICE candidate to broadcaster
      const broadcasterClientId = this.broadcasters.get(client.streamId);
      if (broadcasterClientId) {
        const broadcaster = this.clients.get(broadcasterClientId);
        if (broadcaster && broadcaster.ws.readyState === WebSocket.OPEN) {
          broadcaster.ws.send(JSON.stringify({
            type: 'ice-candidate',
            streamId: client.streamId,
            fromWallet: client.walletAddress,
            toWallet: broadcaster.walletAddress,
            data: message.data,
            timestamp: new Date().toISOString()
          }));
        }
      }
    }
  }

  private async handleStreamStart(broadcaster: StreamClient) {
    if (broadcaster.clientType !== 'broadcaster') return;

    // Update stream status to live
    await this.updateStreamStatus(broadcaster.streamId, 'live');

    // Notify all viewers
    await this.broadcastToViewers(broadcaster.streamId, {
      type: 'stream-start',
      streamId: broadcaster.streamId,
      fromWallet: broadcaster.walletAddress,
      timestamp: new Date().toISOString()
    });

    console.log(`🔴 Stream ${broadcaster.streamId} went live`);
  }

  private async handleStreamEnd(broadcaster: StreamClient) {
    if (broadcaster.clientType !== 'broadcaster') return;

    // Update stream status to ended
    await this.updateStreamStatus(broadcaster.streamId, 'ended');

    // Notify all viewers
    await this.broadcastToViewers(broadcaster.streamId, {
      type: 'stream-end',
      streamId: broadcaster.streamId,
      fromWallet: broadcaster.walletAddress,
      timestamp: new Date().toISOString()
    });

    console.log(`⏹️ Stream ${broadcaster.streamId} ended`);
  }

  private async handleDisconnect(clientId: string) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Remove from stream
    const streamClients = this.streamClients.get(client.streamId);
    if (streamClients) {
      streamClients.delete(clientId);
    }

    // Remove broadcaster tracking
    if (client.clientType === 'broadcaster') {
      this.broadcasters.delete(client.streamId);
      
      // Stream ended when broadcaster disconnects
      await this.updateStreamStatus(client.streamId, 'ended');
      
      // Notify all viewers
      await this.broadcastToViewers(client.streamId, {
        type: 'stream-end',
        streamId: client.streamId,
        fromWallet: client.walletAddress,
        timestamp: new Date().toISOString()
      });
    }

    // Update viewer in database
    if (client.clientType === 'viewer') {
      await this.updateViewerDisconnect(client.streamId, client.walletAddress);
    }

    // Remove client
    this.clients.delete(clientId);

    // Update viewer count
    await this.broadcastViewerCount(client.streamId);

    console.log(`🎥 ${client.clientType === 'broadcaster' ? '📡' : '👁️'} ${client.walletAddress.slice(0, 8)} disconnected from stream ${client.streamId}`);
  }

  private async broadcastToViewers(streamId: string, message: SignalingMessage) {
    const streamClients = this.streamClients.get(streamId);
    if (!streamClients) return;

    const messageStr = JSON.stringify(message);

    for (const clientId of streamClients) {
      const client = this.clients.get(clientId);
      if (client && client.clientType === 'viewer' && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(messageStr);
      }
    }
  }

  private async broadcastViewerCount(streamId: string) {
    const streamClients = this.streamClients.get(streamId) || new Set();
    const viewerCount = Array.from(streamClients).filter(clientId => {
      const client = this.clients.get(clientId);
      return client && client.clientType === 'viewer';
    }).length;

    // Update database
    await this.updateStreamViewerCount(streamId, viewerCount);

    // Broadcast to all clients
    const message: SignalingMessage = {
      type: 'viewer-count',
      streamId,
      data: { viewerCount },
      timestamp: new Date().toISOString()
    };

    const messageStr = JSON.stringify(message);
    for (const clientId of streamClients) {
      const client = this.clients.get(clientId);
      if (client && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(messageStr);
      }
    }
  }

  private sendHeartbeat() {
    const heartbeatMessage = JSON.stringify({
      type: 'heartbeat',
      timestamp: new Date().toISOString()
    });

    for (const client of this.clients.values()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(heartbeatMessage);
      }
    }
  }

  private async cleanupInactiveConnections() {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    for (const [clientId, client] of this.clients.entries()) {
      if (client.lastActivity < fiveMinutesAgo || client.ws.readyState !== WebSocket.OPEN) {
        await this.handleDisconnect(clientId);
      }
    }
  }

  // Database helper methods
  private async verifyAuthentication(walletAddress: string, sessionToken: string | null): Promise<boolean> {
    // TODO: Implement proper session verification
    return walletAddress.length > 10 && (sessionToken?.length || 0) > 0;
  }

  private async getStreamSession(streamId: string): Promise<StreamSession | null> {
    try {
      const stream = await db.query.streamSessions.findFirst({
        where: eq(streamSessions.id, streamId)
      });
      return stream || null;
    } catch (error) {
      console.error('❌ Error getting stream session:', error);
      return null;
    }
  }

  private async trackViewer(streamId: string, walletAddress: string, connectionId: string, request: IncomingMessage) {
    try {
      const viewerData: InsertStreamViewer = {
        streamId,
        viewerWallet: walletAddress,
        viewerHandle: `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
        connectionId,
        userAgent: request.headers['user-agent'] || '',
        ipAddress: request.socket.remoteAddress || '',
        connectionState: 'connecting'
      };

      await db.insert(streamViewers).values(viewerData as any as any);
    } catch (error) {
      console.error('❌ Error tracking viewer:', error);
    }
  }

  private async updateViewerDisconnect(streamId: string, walletAddress: string) {
    try {
      const now = new Date();
      await db.update(streamViewers)
        .set({
          leftAt: now,
          connectionState: 'disconnected'
        } as any)
        .where(and(
          eq(streamViewers.streamId, streamId),
          eq(streamViewers.viewerWallet, walletAddress)
        ));
    } catch (error) {
      console.error('❌ Error updating viewer disconnect:', error);
    }
  }

  private async updateStreamStatus(streamId: string, status: string) {
    try {
      const now = new Date();
      const updateData: any = { status, updatedAt: now };
      
      if (status === 'live') {
        updateData.startedAt = now;
      } else if (status === 'ended') {
        updateData.endedAt = now;
      }

      await db.update(streamSessions)
        .set(updateData)
        .where(eq(streamSessions.id, streamId));
    } catch (error) {
      console.error('❌ Error updating stream status:', error);
    }
  }

  private async updateStreamOffer(streamId: string, offer: any) {
    try {
      await db.update(streamSessions)
        .set({
          streamerOffer: offer,
          updatedAt: new Date()
        } as any)
        .where(eq(streamSessions.id, streamId));
    } catch (error) {
      console.error('❌ Error updating stream offer:', error);
    }
  }

  private async updateStreamViewerCount(streamId: string, viewerCount: number) {
    try {
      await db.update(streamSessions)
        .set({
          currentViewers: viewerCount,
          peakViewers: sql`GREATEST(${streamSessions.peakViewers}, ${viewerCount})`,
          updatedAt: new Date()
        } as any)
        .where(eq(streamSessions.id, streamId));
    } catch (error) {
      console.error('❌ Error updating stream viewer count:', error);
    }
  }

  private async storeSignalingMessage(message: SignalingMessage, client: StreamClient) {
    try {
      const signalingData: InsertStreamSignalingMessage = {
        streamId: client.streamId,
        fromWallet: client.walletAddress,
        toWallet: message.toWallet || null,
        messageType: message.type,
        messageData: message.data || {},
        processed: true
      };

      await db.insert(streamSignalingMessages).values(signalingData as any as any);
    } catch (error) {
      console.error('❌ Error storing signaling message:', error);
    }
  }

  public getStats() {
    const stats = {
      totalClients: this.clients.size,
      totalStreams: this.streamClients.size,
      totalBroadcasters: this.broadcasters.size,
      streamStats: Array.from(this.streamClients.entries()).map(([streamId, clients]) => ({
        streamId,
        totalClients: clients.size,
        viewers: Array.from(clients).filter(clientId => {
          const client = this.clients.get(clientId);
          return client && client.clientType === 'viewer';
        }).length,
        hasBroadcaster: this.broadcasters.has(streamId)
      }))
    };

    return stats;
  }

  public destroy() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    for (const client of this.clients.values()) {
      client.ws.close();
    }
    
    this.clients.clear();
    this.streamClients.clear();
    this.broadcasters.clear();
    
    if (this.wss) {
      this.wss.close();
    }
  }
}

// Create singleton instance
export const streamingSignalingServer = new StreamingSignalingServer();