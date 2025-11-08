import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  MessageCircle, 
  Send, 
  Search, 
  Phone,
  Video,
  PhoneOff,
  VideoOff,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  Image as ImageIcon,
  X,
  ChevronLeft,
  Menu
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { PhotoUploader } from "@/components/PhotoUploader";
import { CallRinging } from "@/components/CallRinging";

interface User {
  id: string;
  handle: string;
  walletAddress: string;
  displayName: string;
  profileImageUrl: string;
  lastSeen: string;
  isOnline: boolean;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  messageType: 'text' | 'image' | 'file';
  imageUrl?: string;
  fileName?: string;
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

interface CallState {
  isInCall: boolean;
  isVideoCall: boolean;
  isCallIncoming: boolean;
  callerName: string;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isVideoEnabled: boolean;
  conversationId: string | null;
}

const SafeAvatar = ({ src, className = "", testId, alt = "" }: { 
  src?: string | null; 
  className?: string; 
  testId?: string; 
  alt?: string; 
}) => {
  const [show, setShow] = useState(Boolean(src));
  
  if (!src || !show) {
    return null;
  }
  
  return (
    <Avatar className={className} data-testid={testId}>
      <AvatarImage 
        src={src} 
        alt={alt}
        onError={() => setShow(false)}
        onLoad={() => setShow(true)}
      />
    </Avatar>
  );
};

export default function MessagingSystem() {
  const { authData, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // All useState hooks BEFORE useEffect
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showConversationList, setShowConversationList] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // WebRTC Call State
  const [callState, setCallState] = useState<CallState>({
    isInCall: false,
    isVideoCall: false,
    isCallIncoming: false,
    callerName: "",
    localStream: null,
    remoteStream: null,
    isMuted: false,
    isVideoEnabled: true,
    conversationId: null
  });
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  // WebRTC Functions
  const initializeWebSocket = () => {
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host || 'localhost:5000';
      const wsUrl = `${protocol}//${host}/ws`;
      
      console.log("🔌 Initializing WebSocket:", wsUrl);
      
      socketRef.current = new WebSocket(wsUrl);
      
      socketRef.current.onopen = () => {
        console.log("✅ WebSocket connected for calls");
        if (authData?.handle) {
          socketRef.current?.send(JSON.stringify({
            type: 'register-user',
            userId: authData.handle
          }));
        }
      };
      
      socketRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleSignalingMessage(data);
      };
      
      socketRef.current.onclose = () => console.log("🔌 WebSocket disconnected");
      socketRef.current.onerror = (error) => console.log("❌ WebSocket error:", error);
    } catch (error) {
      console.error("❌ Failed to initialize WebSocket:", error);
    }
  };

  const handleSignalingMessage = async (data: any) => {
    switch (data.type) {
      case 'call-offer':
        handleCallOffer(data);
        break;
      case 'call-answer':
        handleCallAnswer(data);
        break;
      case 'ice-candidate':
        handleIceCandidate(data);
        break;
      case 'call-end':
        endCall();
        break;
    }
  };

  const requestMediaPermissions = async (video: boolean = true): Promise<MediaStream | null> => {
    try {
      const constraints = {
        audio: true,
        video: video ? { width: 1280, height: 720 } : false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      toast({
        title: "Permissions Granted",
        description: `${video ? "Camera and microphone" : "Microphone"} access granted`,
      });
      
      return stream;
    } catch (error: any) {
      console.error("❌ Failed to get media permissions:", error);
      
      let errorMessage = "Failed to access camera/microphone";
      if (error.name === 'NotAllowedError') {
        errorMessage = "Please allow camera and microphone access to make calls";
      } else if (error.name === 'NotFoundError') {
        errorMessage = "No camera or microphone found";
      }
      
      toast({
        title: "Permission Denied",
        description: errorMessage,
        variant: "destructive"
      });
      
      return null;
    }
  };

  const handleCallOffer = async (data: any) => {
    setCallState(prev => ({
      ...prev,
      isCallIncoming: true,
      isVideoCall: data.isVideo,
      callerName: data.from,
      conversationId: data.conversationId
    }));
  };

  const handleCallAnswer = async (data: any) => {
    if (peerConnectionRef.current) {
      await peerConnectionRef.current.setRemoteDescription(
        new RTCSessionDescription(data.answer)
      );
    }
  };

  const handleIceCandidate = async (data: any) => {
    if (peerConnectionRef.current) {
      await peerConnectionRef.current.addIceCandidate(
        new RTCIceCandidate(data.candidate)
      );
    }
  };

  const answerCall = async () => {
    const stream = await requestMediaPermissions(callState.isVideoCall);
    if (!stream) return;

    setCallState(prev => ({ ...prev, localStream: stream, isInCall: true, isCallIncoming: false }));
    if (localVideoRef.current && callState.isVideoCall) {
      localVideoRef.current.srcObject = stream;
    }
  };

  const endCall = () => {
    if (callState.localStream) {
      callState.localStream.getTracks().forEach(track => track.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    
    socketRef.current?.send(JSON.stringify({
      type: 'call-end',
      conversationId: callState.conversationId
    }));

    setCallState({
      isInCall: false,
      isVideoCall: false,
      isCallIncoming: false,
      callerName: "",
      localStream: null,
      remoteStream: null,
      isMuted: false,
      isVideoEnabled: true,
      conversationId: null
    });
  };

  const toggleMute = () => {
    if (callState.localStream) {
      const audioTrack = callState.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !callState.isMuted;
        setCallState(prev => ({ ...prev, isMuted: !prev.isMuted }));
      }
    }
  };

  const toggleVideo = () => {
    if (callState.localStream) {
      const videoTrack = callState.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !callState.isVideoEnabled;
        setCallState(prev => ({ ...prev, isVideoEnabled: !prev.isVideoEnabled }));
      }
    }
  };

  // Initialize WebSocket on component mount
  useEffect(() => {
    if (isAuthenticated && document.visibilityState === 'visible') {
      try {
        initializeWebSocket();
      } catch (error) {
        console.error("Failed to initialize WebSocket:", error);
      }
    }
    
    return () => {
      if (socketRef.current) {
        try {
          socketRef.current.close();
        } catch (error) {
          console.log("WebSocket close error:", error);
        }
      }
    };
  }, [isAuthenticated]);

  // Handle conversation selection from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const conversationParam = urlParams.get('conversation');
    if (conversationParam) {
      setSelectedConversation(conversationParam);
      const url = new URL(window.location.href);
      url.searchParams.delete('conversation');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);
  
  // Fetch conversations
  const { data: conversations, isLoading: conversationsLoading } = useQuery<Conversation[]>({
    queryKey: ['/api/messaging/conversations'],
    refetchInterval: 10000,
    enabled: isAuthenticated
  });

  // Fetch messages
  const { data: messages, isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ['/api/messaging/messages', selectedConversation],
    queryFn: async () => {
      if (!selectedConversation) return [];
      const response = await apiRequest(`/api/messaging/messages/${selectedConversation}`, { method: 'GET' });
      return await response.json() as any;
    },
    enabled: !!selectedConversation && isAuthenticated,
    refetchInterval: 5000
  });

  // Search users
  const { data: searchUsers } = useQuery<User[]>({
    queryKey: ['/api/social/users/search', searchQuery],
    queryFn: async () => {
      if (searchQuery.length === 0) return [];
      const response = await apiRequest(`/api/social/users/search?q=${encodeURIComponent(searchQuery)}`, { method: 'GET' });
      const result = await response.json() as any;
      return Array.isArray(result) ? result : (result.users || []);
    },
    enabled: searchQuery.length > 0 && isAuthenticated
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (data: { conversationId: string; content: string; messageType: string; imageUrl?: string }) => {
      return apiRequest('/api/messaging/send-message', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      setMessageText("");
      setPendingImage(null);
      queryClient.invalidateQueries({ queryKey: ['/api/messaging/messages', selectedConversation] });
      queryClient.invalidateQueries({ queryKey: ['/api/messaging/conversations'] });
    },
    onError: (error: any) => {
      toast({
        title: "Message Failed",
        description: error.message || "Failed to send message",
        variant: "destructive"
      });
    }
  });

  // Start conversation mutation
  const startConversationMutation = useMutation<Conversation, Error, string>({
    mutationFn: async (participantHandle: string) => {
      const response = await apiRequest('/api/messaging/start-conversation', {
        method: 'POST',
        body: JSON.stringify({ participantHandle })
      });
      return await response.json() as Conversation;
    },
    onSuccess: (conversation: Conversation) => {
      setSelectedConversation(conversation.id);
      setSearchQuery("");
      setShowConversationList(false);
      queryClient.invalidateQueries({ queryKey: ['/api/messaging/conversations'] });
    }
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      return apiRequest(`/api/messaging/mark-read/${conversationId}`, {
        method: 'POST'
      });
    }
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark as read
  useEffect(() => {
    if (selectedConversation) {
      markAsReadMutation.mutate(selectedConversation);
    }
  }, [selectedConversation]);
  
  // Auto-hide conversations on mobile
  useEffect(() => {
    if (selectedConversation && window.innerWidth < 768) {
      setShowConversationList(false);
    }
  }, [selectedConversation]);
  
  // Show loading state
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading messaging...</p>
        </div>
      </div>
    );
  }
  
  // Return early if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  const handleSendMessage = async () => {
    if ((!messageText.trim() && !pendingImage) || !selectedConversation) return;

    sendMessageMutation.mutate({
      conversationId: selectedConversation,
      content: messageText.trim() || (pendingImage ? '[Image]' : ''),
      messageType: pendingImage ? 'image' : 'text',
      imageUrl: pendingImage || undefined
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleImageUpload = async (url: string) => {
    setPendingImage(url);
    setUploadingImage(false);
    toast({
      title: "Image Ready",
      description: "Image attached to message. Click send to deliver.",
    });
  };

  const filteredConversations = conversations?.filter(conv => 
    conv.otherParticipant?.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.otherParticipant?.handle?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const sortedConversations = filteredConversations.sort((a, b) => {
    if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
    if (b.unreadCount > 0 && a.unreadCount === 0) return 1;
    const timeA = new Date(a.lastMessageAt || a.createdAt).getTime();
    const timeB = new Date(b.lastMessageAt || b.createdAt).getTime();
    return timeB - timeA;
  });

  const selectedConversationData = conversations?.find(c => c.id === selectedConversation);

  return (
    <div className="h-screen flex flex-col md:flex-row bg-background">
      {/* Conversations List */}
      <div className={`${
        showConversationList ? 'flex' : 'hidden'
      } md:flex flex-col w-full md:w-96 border-r border-border bg-card`}>
        {/* Header */}
        <div className="p-4 border-b border-border bg-card">
          <h1 className="text-xl font-semibold mb-3">Messages</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Search Results */}
        {searchQuery && searchUsers && searchUsers.length > 0 && (
          <div className="border-b border-border bg-muted/30 p-2">
            <p className="text-xs text-muted-foreground px-2 mb-2">Search Results</p>
            {searchUsers.map((user) => (
              <Button
                key={user.id}
                variant="ghost"
                className="w-full justify-start p-2 h-auto"
                onClick={() => {
                  startConversationMutation.mutate(user.handle);
                }}
              >
                <SafeAvatar 
                  src={user.profileImageUrl} 
                  className="w-10 h-10 mr-3" 
                  testId={`avatar-search-${user.handle}`}
                  alt={user.displayName}
                />
                <div className="text-left">
                  <p className="font-medium">{user.displayName}</p>
                  <p className="text-xs text-muted-foreground">@{user.handle}</p>
                </div>
              </Button>
            ))}
          </div>
        )}

        {/* Conversations */}
        <ScrollArea className="flex-1">
          {conversationsLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-3"></div>
              <p className="text-muted-foreground">Loading conversations...</p>
            </div>
          ) : sortedConversations.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <MessageCircle className="w-16 h-16 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No conversations yet</p>
              <p className="text-xs mt-1">Search for users to start chatting</p>
            </div>
          ) : (
            sortedConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => {
                  setSelectedConversation(conv.id);
                  setShowConversationList(false);
                }}
                className={`w-full p-4 flex items-start gap-3 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all border-b border-border ${
                  selectedConversation === conv.id 
                    ? 'bg-blue-50 dark:bg-blue-950/40 border-l-4 border-l-blue-600' 
                    : 'border-l-4 border-l-transparent'
                }`}
              >
                <div className="relative">
                  <SafeAvatar 
                    src={conv.otherParticipant?.profileImageUrl} 
                    className="w-14 h-14 flex-shrink-0 ring-2 ring-blue-600/20" 
                    testId={`avatar-conv-${conv.otherParticipant?.handle}`}
                    alt={conv.otherParticipant?.displayName}
                  />
                  {conv.otherParticipant?.isOnline && (
                    <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-white dark:border-gray-900 rounded-full"></div>
                  )}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold text-base truncate">
                      {conv.otherParticipant?.displayName || conv.otherParticipant?.handle}
                    </h3>
                    {conv.lastMessageAt && (
                      <span className="text-xs text-blue-600 dark:text-blue-400 font-medium flex-shrink-0 ml-2">
                        {format(new Date(conv.lastMessageAt), 'MMM d')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    @{conv.otherParticipant?.handle}
                  </p>
                  {conv.lastMessage && (
                    <p className="text-xs text-muted-foreground truncate mt-1">
                      {conv.lastMessage.messageType === 'image' ? '📷 Photo' : conv.lastMessage.content}
                    </p>
                  )}
                </div>
                {conv.unreadCount > 0 && (
                  <div className="bg-blue-600 text-white text-xs rounded-full min-w-[20px] h-5 px-2 flex items-center justify-center flex-shrink-0 font-semibold animate-pulse">
                    {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                  </div>
                )}
              </button>
            ))
          )}
        </ScrollArea>
      </div>

      {/* Messages Area */}
      <div className={`${
        showConversationList ? 'hidden' : 'flex'
      } md:flex flex-col flex-1`}>
        {selectedConversation && selectedConversationData ? (
          <>
            {/* Message Header */}
            <div className="p-4 border-b-2 border-border bg-gradient-to-r from-blue-600/10 to-purple-600/10 flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                className="md:hidden hover:bg-blue-600/20"
                onClick={() => {
                  setShowConversationList(true);
                  setSelectedConversation(null);
                }}
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              
              <div className="relative">
                <SafeAvatar 
                  src={selectedConversationData.otherParticipant?.profileImageUrl} 
                  className="w-12 h-12 ring-2 ring-blue-600/30" 
                  testId={`avatar-header-${selectedConversationData.otherParticipant?.handle}`}
                  alt={selectedConversationData.otherParticipant?.displayName}
                />
                {selectedConversationData.otherParticipant?.isOnline && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-900 rounded-full"></div>
                )}
              </div>
              <div className="flex-1">
                <h2 className="font-bold text-lg">
                  {selectedConversationData.otherParticipant?.displayName}
                </h2>
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                  @{selectedConversationData.otherParticipant?.handle}
                  {selectedConversationData.otherParticipant?.isOnline && (
                    <span className="ml-2 text-green-600 dark:text-green-400">● Active now</span>
                  )}
                </p>
              </div>
              
              {/* Call Buttons */}
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    const stream = await requestMediaPermissions(false);
                    if (stream) {
                      setCallState({
                        ...callState,
                        isInCall: true,
                        isVideoCall: false,
                        localStream: stream,
                        conversationId: selectedConversation
                      });
                    }
                  }}
                >
                  <Phone className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    const stream = await requestMediaPermissions(true);
                    if (stream) {
                      setCallState({
                        ...callState,
                        isInCall: true,
                        isVideoCall: true,
                        localStream: stream,
                        conversationId: selectedConversation
                      });
                      if (localVideoRef.current) {
                        localVideoRef.current.srcObject = stream;
                      }
                    }
                  }}
                >
                  <Video className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {messagesLoading ? (
                <div className="text-center text-muted-foreground">Loading messages...</div>
              ) : messages && messages.length > 0 ? (
                <div className="space-y-4">
                  {messages.map((message) => {
                    const isOwn = message.senderId === authData?.handle;
                    return (
                      <div
                        key={message.id}
                        className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[70%] ${isOwn ? 'order-2' : 'order-1'}`}>
                          {message.messageType === 'image' && message.imageUrl && (
                            <img
                              src={message.imageUrl}
                              alt="Message attachment"
                              className="rounded-lg mb-1 max-w-full h-auto"
                              loading="lazy"
                            />
                          )}
                          {message.content && message.content !== '[Image]' && (
                            <div
                              className={`rounded-2xl px-4 py-2 ${
                                isOwn
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-muted text-foreground'
                              }`}
                            >
                              <p className="break-words">{message.content}</p>
                            </div>
                          )}
                          <p className={`text-xs text-muted-foreground mt-1 ${isOwn ? 'text-right' : 'text-left'}`}>
                            {format(new Date(message.createdAt), 'HH:mm')}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No messages yet</p>
                  <p className="text-xs">Start the conversation!</p>
                </div>
              )}
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t-2 border-border bg-gradient-to-r from-blue-600/5 to-purple-600/5">
              {pendingImage && (
                <div className="mb-3 relative inline-block">
                  <img 
                    src={pendingImage} 
                    alt="Pending upload" 
                    className="h-24 rounded-xl shadow-lg border-2 border-blue-600"
                  />
                  <Button
                    size="sm"
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-7 w-7 rounded-full p-0 shadow-lg"
                    onClick={() => setPendingImage(null)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
              <div className="flex gap-2">
                {!uploadingImage && !pendingImage && (
                  <PhotoUploader
                    type="post"
                    onUploadSuccess={handleImageUpload}
                    onUploadError={(error) => {
                      toast({
                        title: "Upload Failed",
                        description: error,
                        variant: "destructive"
                      });
                    }}
                  >
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      type="button"
                      className="hover:bg-blue-600/10"
                      title="Upload image"
                    >
                      <ImageIcon className="w-5 h-5 text-blue-600" />
                    </Button>
                  </PhotoUploader>
                )}
                <Input
                  placeholder="Type a message..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="flex-1 border-2 focus:border-blue-600 bg-white dark:bg-gray-900"
                />
                <Button 
                  onClick={handleSendMessage}
                  disabled={(!messageText.trim() && !pendingImage) || sendMessageMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 px-6 shadow-lg"
                  title="Send message"
                >
                  {sendMessageMutation.isPending ? (
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Welcome to Messages</h2>
              <p className="text-muted-foreground">
                Select a conversation to start messaging
              </p>
              <Button
                variant="outline"
                className="mt-4 md:hidden"
                onClick={() => setShowConversationList(true)}
              >
                <Menu className="w-4 h-4 mr-2" />
                View Conversations
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Call Ringing Interface - Show when incoming call */}
      {callState.isCallIncoming && !callState.isInCall && (
        <CallRinging
          callerName={callState.callerName || selectedConversationData?.otherParticipant?.displayName || 'Unknown'}
          callerAvatar={selectedConversationData?.otherParticipant?.profileImageUrl}
          isVideoCall={callState.isVideoCall}
          onAccept={answerCall}
          onDecline={endCall}
        />
      )}

      {/* Call Interface - Show when call is active */}
      {callState.isInCall && (
        <Dialog open={true} onOpenChange={() => {}}>
          <DialogContent className="max-w-4xl h-[600px] p-0">
            <DialogHeader className="p-4 border-b bg-gradient-to-r from-blue-600 to-purple-600 text-white">
              <div className="flex items-center justify-between">
                <DialogTitle className="text-white">
                  {callState.isVideoCall ? "Video" : "Audio"} Call - {selectedConversationData?.otherParticipant?.displayName}
                </DialogTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={endCall}
                  className="text-white hover:bg-white/20"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </DialogHeader>

            <div className="flex-1 relative bg-black">
              {callState.isVideoCall ? (
                <>
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    muted={false}
                    className="w-full h-full object-cover"
                  />
                  
                  <div className="absolute top-4 right-4 w-48 h-36 bg-gray-800 rounded-lg overflow-hidden border-2 border-white shadow-2xl">
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted={true}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full bg-gradient-to-b from-blue-900 to-purple-600">
                  <div className="text-center text-white">
                    <SafeAvatar 
                      src={selectedConversationData?.otherParticipant?.profileImageUrl} 
                      className="w-32 h-32 mx-auto mb-4 ring-4 ring-white shadow-2xl" 
                      testId="avatar-call-screen"
                      alt={selectedConversationData?.otherParticipant?.displayName} 
                    />
                    <h3 className="text-3xl font-bold mb-2">
                      {selectedConversationData?.otherParticipant?.displayName}
                    </h3>
                    <p className="text-blue-100 text-lg">
                      Call in progress...
                    </p>
                  </div>
                </div>
              )}

              {/* Call Controls */}
              <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
                <div className="flex justify-center items-center gap-4">
                  <Button
                    size="lg"
                    variant={callState.isMuted ? "destructive" : "secondary"}
                    className="rounded-full w-14 h-14 shadow-lg"
                    onClick={toggleMute}
                    title={callState.isMuted ? "Unmute" : "Mute"}
                  >
                    {callState.isMuted ? (
                      <MicOff className="w-5 h-5" />
                    ) : (
                      <Mic className="w-5 h-5" />
                    )}
                  </Button>

                  {callState.isVideoCall && (
                    <Button
                      size="lg"
                      variant={callState.isVideoEnabled ? "secondary" : "destructive"}
                      className="rounded-full w-14 h-14 shadow-lg"
                      onClick={toggleVideo}
                      title={callState.isVideoEnabled ? "Turn off camera" : "Turn on camera"}
                    >
                      {callState.isVideoEnabled ? (
                        <Camera className="w-5 h-5" />
                      ) : (
                        <CameraOff className="w-5 h-5" />
                      )}
                    </Button>
                  )}

                  <Button
                    size="lg"
                    variant="destructive"
                    className="rounded-full w-16 h-16 shadow-2xl"
                    onClick={endCall}
                    title="End call"
                  >
                    <PhoneOff className="w-6 h-6" />
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
