import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { 
  MessageCircle, 
  Send, 
  Users, 
  Loader2,
  Settings,
  Flag,
  Trash2,
  Crown,
  Star,
  Shield,
  Minimize2,
  Maximize2,
  MoreVertical
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatMessage {
  id: string;
  launchId: number;
  senderWallet: string;
  senderHandle?: string;
  message: string;
  messageType: 'text' | 'system' | 'join' | 'leave';
  isDeveloper: boolean;
  isNftHolder: boolean;
  isVerified: boolean;
  createdAt: string;
  editedAt?: string;
  isDeleted: boolean;
}

interface ChatUser {
  userId: string;
  userName?: string;
  isDeveloper: boolean;
  isNftHolder: boolean;
  isVerified: boolean;
  isTyping: boolean;
  joinedAt: string;
  lastActivity: string;
}

interface WebSocketMessage {
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
  onlineUsers?: ChatUser[];
  error?: string;
}

interface LaunchChatRoomProps {
  launchId: number;
  currentUser: {
    wallet: string;
    sessionToken: string;
    handle?: string;
  };
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  className?: string;
}

export default function LaunchChatRoom({ 
  launchId, 
  currentUser, 
  isCollapsed = false, 
  onToggleCollapse,
  className 
}: LaunchChatRoomProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<ChatUser[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch initial chat messages
  const { data: chatData, isLoading } = useQuery({
    queryKey: ['chat-messages', launchId],
    queryFn: async () => {
      const response = await apiRequest(`/api/chat/launch/${launchId}/messages?limit=50`);
      if (!response.ok) throw new Error('Failed to fetch messages');
      return response.json();
    },
    enabled: !!launchId && !isCollapsed,
  });

  // Fetch chat settings
  const { data: settingsData } = useQuery({
    queryKey: ['chat-settings', launchId],
    queryFn: async () => {
      const response = await apiRequest(`/api/chat/launch/${launchId}/settings`);
      if (!response.ok) throw new Error('Failed to fetch chat settings');
      return response.json();
    },
    enabled: !!launchId,
  });

  // Connect to WebSocket
  const connectWebSocket = useCallback(() => {
    if (!launchId || !currentUser.wallet || isConnecting) return;

    setIsConnecting(true);
    console.log('💬 Connecting to chat WebSocket...');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/chat?launchId=${launchId}&userId=${currentUser.wallet}&sessionToken=${currentUser.sessionToken}`;
    
    const websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
      console.log('✅ Chat WebSocket connected');
      setIsConnected(true);
      setIsConnecting(false);
      setWs(websocket);
    };

    websocket.onmessage = (event) => {
      try {
        const data: WebSocketMessage = JSON.parse(event.data);
        handleWebSocketMessage(data);
      } catch (error) {
        console.error('❌ Error parsing WebSocket message:', error);
      }
    };

    websocket.onclose = () => {
      console.log('❌ Chat WebSocket disconnected');
      setIsConnected(false);
      setIsConnecting(false);
      setWs(null);
      
      // Attempt to reconnect after 3 seconds
      setTimeout(() => {
        if (!isCollapsed) {
          connectWebSocket();
        }
      }, 3000);
    };

    websocket.onerror = (error) => {
      console.error('🚨 Chat WebSocket error:', error);
      setIsConnecting(false);
      toast({
        title: 'Connection Error',
        description: 'Failed to connect to chat. Retrying...',
        variant: 'destructive',
      });
    };
  }, [launchId, currentUser.wallet, currentUser.sessionToken, isConnecting, isCollapsed]);

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((data: WebSocketMessage) => {
    switch (data.type) {
      case 'message':
        if (data.messageId && data.message) {
          const newMsg: ChatMessage = {
            id: data.messageId,
            launchId: data.launchId,
            senderWallet: data.userId || '',
            senderHandle: data.userName,
            message: data.message,
            messageType: 'text',
            isDeveloper: data.isDeveloper || false,
            isNftHolder: data.isNftHolder || false,
            isVerified: data.isVerified || false,
            createdAt: data.timestamp || new Date().toISOString(),
            isDeleted: false
          };
          setMessages(prev => [...prev, newMsg]);
        }
        break;

      case 'join':
        if (data.userId && data.userName) {
          const joinMsg: ChatMessage = {
            id: `join-${data.userId}-${Date.now()}`,
            launchId: data.launchId,
            senderWallet: data.userId,
            senderHandle: data.userName,
            message: `${data.userName} joined the chat`,
            messageType: 'join',
            isDeveloper: data.isDeveloper || false,
            isNftHolder: data.isNftHolder || false,
            isVerified: data.isVerified || false,
            createdAt: data.timestamp || new Date().toISOString(),
            isDeleted: false
          };
          setMessages(prev => [...prev, joinMsg]);
        }
        break;

      case 'leave':
        if (data.userId && data.userName) {
          const leaveMsg: ChatMessage = {
            id: `leave-${data.userId}-${Date.now()}`,
            launchId: data.launchId,
            senderWallet: data.userId,
            senderHandle: data.userName,
            message: `${data.userName} left the chat`,
            messageType: 'leave',
            isDeveloper: data.isDeveloper || false,
            isNftHolder: data.isNftHolder || false,
            isVerified: data.isVerified || false,
            createdAt: data.timestamp || new Date().toISOString(),
            isDeleted: false
          };
          setMessages(prev => [...prev, leaveMsg]);
        }
        break;

      case 'user_list':
        if (data.onlineUsers) {
          setOnlineUsers(data.onlineUsers);
          setTypingUsers(data.onlineUsers.filter(u => u.isTyping).map(u => u.userName || u.userId));
        }
        break;

      case 'error':
        toast({
          title: 'Chat Error',
          description: data.error || 'Unknown error occurred',
          variant: 'destructive',
        });
        break;
    }
  }, [toast]);

  // Send message
  const sendMessage = useCallback(() => {
    if (!ws || !newMessage.trim() || ws.readyState !== WebSocket.OPEN) return;

    const messageData: WebSocketMessage = {
      type: 'message',
      launchId,
      message: newMessage.trim(),
    };

    ws.send(JSON.stringify(messageData));
    setNewMessage('');
    
    // Stop typing indicator
    ws.send(JSON.stringify({ type: 'stop_typing', launchId }));
  }, [ws, newMessage, launchId]);

  // Handle typing indicator
  const handleTyping = useCallback(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(JSON.stringify({ type: 'typing', launchId }));

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'stop_typing', launchId }));
      }
    }, 2000);
  }, [ws, launchId]);

  // Initialize messages from API
  useEffect(() => {
    if (chatData?.success && chatData.data?.messages) {
      setMessages(chatData.data.messages);
    }
  }, [chatData]);

  // Connect WebSocket when component mounts or launchId changes
  useEffect(() => {
    if (!isCollapsed && launchId && currentUser.wallet) {
      connectWebSocket();
    }

    return () => {
      if (ws) {
        ws.close();
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [launchId, currentUser.wallet, isCollapsed, connectWebSocket]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Get user avatar and display name
  const getUserAvatar = (wallet: string, handle?: string) => {
    const displayName = handle || `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
    return displayName.slice(0, 2).toUpperCase();
  };

  const getUserDisplayName = (wallet: string, handle?: string) => {
    return handle || `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
  };

  // Message component
  const MessageItem = ({ message }: { message: ChatMessage }) => {
    const isSystemMessage = message.messageType !== 'text';
    const isOwnMessage = message.senderWallet === currentUser.wallet;

    if (isSystemMessage) {
      return (
        <div className="flex justify-center my-2">
          <div className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-xs text-gray-600 dark:text-gray-400">
            {message.message}
          </div>
        </div>
      );
    }

    return (
      <div className={cn(
        "flex gap-3 p-2 rounded-lg",
        isOwnMessage ? "ml-8 bg-blue-50 dark:bg-blue-950/30" : "mr-8"
      )}>
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarFallback className="text-xs">
            {getUserAvatar(message.senderWallet, message.senderHandle)}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium truncate">
              {getUserDisplayName(message.senderWallet, message.senderHandle)}
            </span>
            
            {message.isDeveloper && (
              <Badge variant="outline" className="h-4 px-1 text-xs bg-purple-100 text-purple-700 border-purple-300">
                <Crown className="h-3 w-3 mr-1" />
                DEV
              </Badge>
            )}
            
            {message.isNftHolder && (
              <Badge variant="outline" className="h-4 px-1 text-xs bg-orange-100 text-orange-700 border-orange-300">
                <Star className="h-3 w-3 mr-1" />
                NFT
              </Badge>
            )}
            
            {message.isVerified && (
              <Badge variant="outline" className="h-4 px-1 text-xs bg-green-100 text-green-700 border-green-300">
                <Shield className="h-3 w-3" />
              </Badge>
            )}
            
            <span className="text-xs text-gray-500 ml-auto">
              {new Date(message.createdAt).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </span>
          </div>
          
          <p className="text-sm text-gray-900 dark:text-gray-100 break-words">
            {message.message}
          </p>
        </div>
      </div>
    );
  };

  if (isCollapsed) {
    return (
      <Card className={cn("w-80", className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Chat
            {onlineUsers.length > 0 && (
              <Badge variant="secondary" className="h-5 px-2 text-xs">
                {onlineUsers.length}
              </Badge>
            )}
          </CardTitle>
          {onToggleCollapse && (
            <Button variant="ghost" size="sm" onClick={onToggleCollapse}>
              <Maximize2 className="h-4 w-4" />
            </Button>
          )}
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className={cn("w-80 h-96 flex flex-col", className)} data-testid="chat-room">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageCircle className="h-4 w-4" />
          Chat
          {onlineUsers.length > 0 && (
            <Badge variant="secondary" className="h-5 px-2 text-xs">
              {onlineUsers.length}
            </Badge>
          )}
        </CardTitle>
        
        <div className="flex items-center gap-1">
          <div className={cn(
            "w-2 h-2 rounded-full",
            isConnected ? "bg-green-500" : isConnecting ? "bg-yellow-500" : "bg-red-500"
          )} />
          
          {onToggleCollapse && (
            <Button variant="ghost" size="sm" onClick={onToggleCollapse}>
              <Minimize2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        {/* Messages Area */}
        <ScrollArea className="flex-1 px-3">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2 text-sm text-gray-600">Loading messages...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-center">
                <MessageCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-600">No messages yet</p>
                <p className="text-xs text-gray-500">Be the first to say something!</p>
              </div>
            </div>
          ) : (
            <div className="space-y-1 py-2">
              {messages.map((message) => (
                <MessageItem key={message.id} message={message} />
              ))}
              
              {/* Typing Indicator */}
              {typingUsers.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-500">
                  <div className="flex space-x-1">
                    <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span>
                    {typingUsers.length === 1 
                      ? `${typingUsers[0]} is typing...`
                      : `${typingUsers.length} people are typing...`
                    }
                  </span>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        <Separator />

        {/* Input Area */}
        <div className="p-3">
          {!isConnected ? (
            <Alert>
              <AlertDescription className="text-sm">
                {isConnecting ? 'Connecting to chat...' : 'Disconnected from chat. Reconnecting...'}
              </AlertDescription>
            </Alert>
          ) : (
            <div className="flex gap-2">
              <Input
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(e.target.value);
                  handleTyping();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Type a message..."
                maxLength={500}
                className="flex-1"
                disabled={!isConnected}
                data-testid="input-chat-message"
              />
              <Button 
                onClick={sendMessage} 
                disabled={!newMessage.trim() || !isConnected}
                size="sm"
                data-testid="button-send-message"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
