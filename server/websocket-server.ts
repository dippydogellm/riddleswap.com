import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { db } from './db';
import { notifications } from '../shared/schema';

interface CallUser {
  socket: WebSocket;
  userId: string;
  conversationId?: string;
}

const connectedUsers = new Map<string, CallUser>();

export function setupWebSocketServer(httpServer: Server) {
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws'
  });

  wss.on('connection', (socket: WebSocket, request) => {
    console.log('📞 New WebSocket connection for calls');

    socket.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        handleWebSocketMessage(socket, message);
      } catch (error) {
        console.error('❌ Failed to parse WebSocket message:', error);
      }
    });

    socket.on('close', () => {
      // Remove user from connected users
      const entries = Array.from(connectedUsers.entries());
      for (const [userId, user] of entries) {
        if (user.socket === socket) {
          connectedUsers.delete(userId);
          console.log(`📞 User ${userId} disconnected from calls`);
          break;
        }
      }
    });

    socket.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
    });
  });

  console.log('✅ WebSocket server for video/audio calls is running on /ws');
}

function handleWebSocketMessage(socket: WebSocket, message: any) {
  console.log('📞 Received WebSocket message:', message.type);

  switch (message.type) {
    case 'register-user':
      registerUser(socket, message.userId);
      break;
      
    case 'call-offer':
      handleCallOffer(socket, message);
      break;
      
    case 'call-answer':
      handleCallAnswer(socket, message);
      break;
      
    case 'ice-candidate':
      handleIceCandidate(socket, message);
      break;
      
    case 'call-end':
      handleCallEnd(socket, message);
      break;
      
    default:
      console.log('❓ Unknown WebSocket message type:', message.type);
  }
}

function registerUser(socket: WebSocket, userId: string) {
  connectedUsers.set(userId, { socket, userId });
  console.log(`📞 User ${userId} registered for calls`);
}

async function handleCallOffer(senderSocket: WebSocket, message: any) {
  const { conversationId, offer, isVideoCall, callerId } = message;
  
  // Find the other participant in the conversation
  // This is a simplified version - in production you'd look up conversation participants from DB
  const targetUser = findTargetUser(conversationId, callerId);
  
  if (targetUser && targetUser.socket.readyState === WebSocket.OPEN) {
    targetUser.socket.send(JSON.stringify({
      type: 'call-offer',
      offer,
      conversationId,
      isVideoCall,
      callerId
    }));
    
    // Create incoming call notification
    await createCallNotification({
      userId: targetUser.userId,
      type: 'call_incoming',
      callerHandle: callerId,
      isVideoCall
    });
    
    console.log(`📞 Call offer sent from ${callerId} to target user`);
  } else {
    // User not online, send busy signal and create missed call notification
    senderSocket.send(JSON.stringify({
      type: 'call-failed',
      reason: 'User not available'
    }));
    
    // Create missed call notification for offline user
    await createCallNotification({
      userId: findTargetUserId(conversationId, callerId),
      type: 'call_missed',
      callerHandle: callerId,
      isVideoCall
    });
  }
}

function handleCallAnswer(senderSocket: WebSocket, message: any) {
  const { conversationId, answer } = message;
  
  // Find the caller
  const caller = findCallerInConversation(conversationId);
  
  if (caller && caller.socket.readyState === WebSocket.OPEN) {
    caller.socket.send(JSON.stringify({
      type: 'call-answer',
      answer,
      conversationId
    }));
    
    console.log('📞 Call answer sent to caller');
  }
}

function handleIceCandidate(senderSocket: WebSocket, message: any) {
  const { conversationId, candidate } = message;
  
  // Forward ICE candidate to the other participant
  const otherUser = findOtherUserInConversation(senderSocket, conversationId);
  
  if (otherUser && otherUser.socket.readyState === WebSocket.OPEN) {
    otherUser.socket.send(JSON.stringify({
      type: 'ice-candidate',
      candidate,
      conversationId
    }));
  }
}

function handleCallEnd(senderSocket: WebSocket, message: any) {
  const { conversationId } = message;
  
  // Notify the other participant that call ended
  const otherUser = findOtherUserInConversation(senderSocket, conversationId);
  
  if (otherUser && otherUser.socket.readyState === WebSocket.OPEN) {
    otherUser.socket.send(JSON.stringify({
      type: 'call-end',
      conversationId
    }));
  }
  
  console.log('📞 Call ended');
}

// Helper functions (simplified - in production these would query the database)
function findTargetUser(conversationId: string, callerId: string): CallUser | undefined {
  // In a real implementation, you'd query the database to find conversation participants
  // For now, return the first user that's not the caller
  const users = Array.from(connectedUsers.values());
  for (const user of users) {
    if (user.userId !== callerId) {
      return user;
    }
  }
  return undefined;
}

function findCallerInConversation(conversationId: string): CallUser | undefined {
  // In a real implementation, you'd track active calls
  // For now, return the first connected user
  const users = Array.from(connectedUsers.values());
  return users[0];
}

function findOtherUserInConversation(senderSocket: WebSocket, conversationId: string): CallUser | undefined {
  // Find the other user in the conversation (not the sender)
  const users = Array.from(connectedUsers.values());
  for (const user of users) {
    if (user.socket !== senderSocket) {
      return user;
    }
  }
  return undefined;
}

// Notification helper functions
async function createCallNotification({
  userId,
  type,
  callerHandle,
  isVideoCall
}: {
  userId: string;
  type: 'call_incoming' | 'call_missed';
  callerHandle: string;
  isVideoCall: boolean;
}) {
  const callType = isVideoCall ? 'video call' : 'voice call';
  const title = type === 'call_incoming' ? `Incoming ${callType}` : `Missed ${callType}`;
  const content = type === 'call_incoming' 
    ? `${callerHandle} is calling you` 
    : `You missed a ${callType} from ${callerHandle}`;
  
  try {
    await db.insert(notifications).values({
      userId,
      type,
      title,
      content,
      actionUrl: `/messaging`,
      senderHandle: callerHandle,
      senderName: callerHandle,
      isRead: false
    } as any as any);
    
    console.log(`📞 Created ${type} notification for ${userId} from ${callerHandle}`);
  } catch (error) {
    console.error('Database error creating call notification:', error);
  }
}

function findTargetUserId(conversationId: string, callerId: string): string {
  // In a real implementation, you'd query the database to find the other participant
  // For now, returning a placeholder - this should be enhanced with actual DB lookup
  return "unknown_user";
}