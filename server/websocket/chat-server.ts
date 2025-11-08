import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { Server } from 'http';
import { db } from '../db';
import { 
  launchChatMessages, 
  launchChatSessions, 
  launchChatRoomSettings,
  type LaunchChatMessage,
  type InsertLaunchChatMessage 
} from '../../shared/schema';
import { eq, and, desc, gte, sql } from 'drizzle-orm';

interface ChatClient {
  ws: WebSocket;
  userId: string;
  launchId: number;
  isAuthenticated: boolean;
  isTyping: boolean;
  lastActivity: Date;
}

interface ChatMessage {
  type: 'message' | 'join' | 'leave' | 'typing' | 'stop_typing' | 'user_list' | 'error' | 'system';
  launchId: number;
  userId?: string;
  userName?: string;
  message?: string;
  messageId?: string;
  timestamp?: string;
  isDeveloper?: boolean;
  isNftHolder?: boolean;
  isVerified?: boolean;
  onlineUsers?: Array<{
    userId: string;
    userName?: string;
    isDeveloper?: boolean;
    isNftHolder?: boolean;
    isTyping?: boolean;
  }>;
  error?: string;
}

export class ChatServer {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, ChatClient> = new Map();
  private rooms: Map<number, Set<string>> = new Map();
  private typingTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    // Initialize rooms for active launches
    this.initializeRooms();
  }

  private async initializeRooms() {
    try {
      // Get active launch IDs and initialize rooms
      const activeLaunches = await db.query.tokenLaunches.findMany({
        columns: { id: true },
        where: (launches, { eq }) => eq(launches.status, 'active')
      });

      for (const launch of activeLaunches) {
        if (!this.rooms.has(launch.id)) {
          this.rooms.set(launch.id, new Set());
        }
      }
      
      console.log(`🚀 Chat server initialized with ${activeLaunches.length} active launch rooms`);
    } catch (error) {
      console.error('❌ Error initializing chat rooms:', error);
    }
  }

  public initialize(server: Server) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws/chat',
      clientTracking: true 
    });

    this.wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      this.handleConnection(ws, request);
    });

    this.wss.on('error', (error) => {
      console.error('🚨 WebSocket server error:', error);
    });

    // Cleanup inactive sessions every 5 minutes
    setInterval(() => {
      this.cleanupInactiveSessions();
    }, 5 * 60 * 1000);

    console.log('💬 Chat WebSocket server initialized on /ws/chat');
  }

  private async handleConnection(ws: WebSocket, request: IncomingMessage) {
    const url = new URL(request.url!, `http://${request.headers.host}`);
    const launchId = parseInt(url.searchParams.get('launchId') || '0');
    const userId = url.searchParams.get('userId') || '';
    const sessionToken = url.searchParams.get('sessionToken') || '';

    if (!launchId || !userId) {
      ws.close(1008, 'Missing launchId or userId');
      return;
    }

    // Verify authentication
    const isAuthenticated = await this.verifyAuthentication(userId, sessionToken);
    if (!isAuthenticated) {
      ws.close(1008, 'Authentication failed');
      return;
    }

    // Create client
    const clientId = `${launchId}-${userId}-${Date.now()}`;
    const client: ChatClient = {
      ws,
      userId,
      launchId,
      isAuthenticated,
      isTyping: false,
      lastActivity: new Date()
    };

    this.clients.set(clientId, client);

    // Add to room
    if (!this.rooms.has(launchId)) {
      this.rooms.set(launchId, new Set());
    }
    this.rooms.get(launchId)!.add(clientId);

    // Update session in database
    await this.updateUserSession(userId, launchId, 'join');

    // Send join message to room
    await this.broadcastToRoom(launchId, {
      type: 'join',
      launchId,
      userId,
      userName: await this.getUserName(userId),
      timestamp: new Date().toISOString()
    });

    // Send current user list
    this.sendUserList(launchId);

    // Handle messages
    ws.on('message', async (data: Buffer) => {
      try {
        const message: ChatMessage = JSON.parse(data.toString());
        await this.handleMessage(clientId, message);
      } catch (error) {
        console.error('❌ Error handling message:', error);
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
      console.error('🚨 WebSocket client error:', error);
    });

    console.log(`👋 User ${userId} joined launch chat ${launchId}`);
  }

  private async handleMessage(clientId: string, message: ChatMessage) {
    const client = this.clients.get(clientId);
    if (!client || !client.isAuthenticated) return;

    client.lastActivity = new Date();

    switch (message.type) {
      case 'message':
        await this.handleChatMessage(client, message);
        break;
      case 'typing':
        await this.handleTyping(client, true);
        break;
      case 'stop_typing':
        await this.handleTyping(client, false);
        break;
      default:
        client.ws.send(JSON.stringify({
          type: 'error',
          error: 'Unknown message type'
        }));
    }
  }

  private async handleChatMessage(client: ChatClient, message: ChatMessage) {
    if (!message.message || message.message.trim().length === 0) {
      return;
    }

    // Check rate limiting
    if (await this.isRateLimited(client.userId, client.launchId)) {
      client.ws.send(JSON.stringify({
        type: 'error',
        error: 'Rate limited. Please slow down.'
      }));
      return;
    }

    // Get user info
    const userName = await this.getUserName(client.userId);
    const { isDeveloper, isNftHolder, isVerified } = await this.getUserVerificationStatus(client.userId, client.launchId);

    // Save message to database
    const chatMessage: InsertLaunchChatMessage = {
      launchId: client.launchId,
      senderWallet: client.userId,
      senderHandle: userName,
      message: message.message.slice(0, 500), // Limit length
      messageType: 'text',
      isDeveloper,
      isNftHolder,
      isVerified,
      replyToId: message.messageId || null
    };

    try {
      const [savedMessage] = await db.insert(launchChatMessages)
        .values(chatMessage as any as any)
        .returning();

      // Broadcast to room
      await this.broadcastToRoom(client.launchId, {
        type: 'message',
        launchId: client.launchId,
        userId: client.userId,
        userName,
        message: message.message,
        messageId: savedMessage.id,
        timestamp: savedMessage.createdAt.toISOString(),
        isDeveloper,
        isNftHolder,
        isVerified
      });

      console.log(`💬 Message from ${userName} in launch ${client.launchId}: ${message.message}`);
    } catch (error) {
      console.error('❌ Error saving chat message:', error);
      client.ws.send(JSON.stringify({
        type: 'error',
        error: 'Failed to send message'
      }));
    }
  }

  private async handleTyping(client: ChatClient, isTyping: boolean) {
    if (client.isTyping === isTyping) return;
    
    client.isTyping = isTyping;
    
    // Clear existing timer
    const existingTimer = this.typingTimers.get(`${client.launchId}-${client.userId}`);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    if (isTyping) {
      // Stop typing automatically after 3 seconds
      this.typingTimers.set(`${client.launchId}-${client.userId}`, 
        setTimeout(() => {
          this.handleTyping(client, false);
        }, 3000)
      );
    }

    // Update user list
    this.sendUserList(client.launchId);
  }

  private async handleDisconnect(clientId: string) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Remove from room
    const room = this.rooms.get(client.launchId);
    if (room) {
      room.delete(clientId);
    }

    // Update session in database
    await this.updateUserSession(client.userId, client.launchId, 'leave');

    // Send leave message to room
    await this.broadcastToRoom(client.launchId, {
      type: 'leave',
      launchId: client.launchId,
      userId: client.userId,
      userName: await this.getUserName(client.userId),
      timestamp: new Date().toISOString()
    });

    // Update user list
    this.sendUserList(client.launchId);

    // Remove client
    this.clients.delete(clientId);

    console.log(`👋 User ${client.userId} left launch chat ${client.launchId}`);
  }

  private async broadcastToRoom(launchId: number, message: ChatMessage) {
    const room = this.rooms.get(launchId);
    if (!room) return;

    const messageStr = JSON.stringify(message);

    for (const clientId of Array.from(room)) {
      const client = this.clients.get(clientId);
      if (client && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(messageStr);
      }
    }
  }

  private async sendUserList(launchId: number) {
    const room = this.rooms.get(launchId);
    if (!room) return;

    const onlineUsers = [];
    for (const clientId of Array.from(room)) {
      const client = this.clients.get(clientId);
      if (client) {
        const { isDeveloper, isNftHolder } = await this.getUserVerificationStatus(client.userId, launchId);
        onlineUsers.push({
          userId: client.userId,
          userName: await this.getUserName(client.userId),
          isDeveloper,
          isNftHolder,
          isTyping: client.isTyping
        });
      }
    }

    await this.broadcastToRoom(launchId, {
      type: 'user_list',
      launchId,
      onlineUsers
    });
  }

  private async verifyAuthentication(userId: string, sessionToken: string): Promise<boolean> {
    // TODO: Implement proper session verification
    // For now, basic validation
    return userId.length > 10 && sessionToken.length > 0;
  }

  private async getUserName(userId: string): Promise<string> {
    try {
      // Try to get handle from wallet sessions or profiles
      // TODO: Implement proper user lookup
      return `${userId.slice(0, 6)}...${userId.slice(-4)}`;
    } catch {
      return `${userId.slice(0, 6)}...${userId.slice(-4)}`;
    }
  }

  private async getUserVerificationStatus(userId: string, launchId: number): Promise<{
    isDeveloper: boolean;
    isNftHolder: boolean;
    isVerified: boolean;
  }> {
    try {
      // Check if user is the launch creator
      const launch = await db.query.tokenLaunches.findFirst({
        columns: { creatorWallet: true },
        where: (launches, { eq }) => eq(launches.id, launchId)
      });
      
      const isDeveloper = launch?.creatorWallet === userId;

      // TODO: Check NFT holdings and verification status
      const isNftHolder = false; // Implement NFT check
      const isVerified = false; // Implement verification check

      return { isDeveloper, isNftHolder, isVerified };
    } catch (error) {
      console.error('❌ Error getting user verification status:', error);
      return { isDeveloper: false, isNftHolder: false, isVerified: false };
    }
  }

  private async updateUserSession(userId: string, launchId: number, action: 'join' | 'leave') {
    try {
      if (action === 'join') {
        // Update or create session
        const sessionValues = {
          launchId,
          userWallet: userId,
          userHandle: await this.getUserName(userId),
          isOnline: true,
          lastActivity: new Date()
        } as const;

        await db.insert(launchChatSessions)
          .values(sessionValues as any)
          .onConflictDoUpdate({
            target: [launchChatSessions.launchId, launchChatSessions.userWallet],
            set: {
              isOnline: true,
              lastActivity: new Date(),
              connectionCount: sql`COALESCE(${launchChatSessions.connectionCount}, 0) + 1`
            } as any
          });
      } else {
        // Mark as offline
        await db.update(launchChatSessions)
          .set({
            isOnline: false,
            leftAt: new Date(),
            connectionCount: sql`GREATEST(0, COALESCE(${launchChatSessions.connectionCount}, 1) - 1)`
          } as any)
          .where(and(
            eq(launchChatSessions.launchId, launchId),
            eq(launchChatSessions.userWallet, userId)
          ));
      }
    } catch (error) {
      console.error('❌ Error updating chat session:', error);
    }
  }

  private async isRateLimited(userId: string, launchId: number): Promise<boolean> {
    try {
      // Check messages in the last minute
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
      
      const recentMessages = await db.select()
        .from(launchChatMessages)
        .where(and(
          eq(launchChatMessages.launchId, launchId),
          eq(launchChatMessages.senderWallet, userId),
          gte(launchChatMessages.createdAt, oneMinuteAgo)
        ));

      return recentMessages.length >= 5; // 5 messages per minute limit
    } catch (error) {
      console.error('❌ Error checking rate limit:', error);
      return false;
    }
  }

  private async cleanupInactiveSessions() {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    // Mark inactive sessions as offline
    try {
        await db.update(launchChatSessions)
          .set({ isOnline: false } as any)
          .where(and(
            eq(launchChatSessions.isOnline, true),
            gte(launchChatSessions.lastActivity, fiveMinutesAgo)
          ));
      console.log('✅ [CHAT] Successfully cleaned up inactive sessions');
    } catch (error: any) {
      console.error('❌ Error cleaning up inactive sessions:', error);
    }
  }

  public getStats() {
    return {
      totalClients: this.clients.size,
      totalRooms: this.rooms.size,
      roomStats: Array.from(this.rooms.entries()).map(([launchId, clients]) => ({
        launchId,
        clientCount: clients.size
      }))
    };
  }
}

// Create singleton instance
export const chatServer = new ChatServer();