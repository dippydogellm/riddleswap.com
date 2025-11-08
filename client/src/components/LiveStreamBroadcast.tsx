import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Play, 
  Square, 
  Settings, 
  Users, 
  Eye,
  Wifi,
  WifiOff,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';

interface LiveStreamBroadcastProps {
  launchId: number;
  creatorWallet: string;
  onStreamStateChange?: (isLive: boolean, streamId?: string) => void;
  className?: string;
}

interface StreamSession {
  id: string;
  streamTitle: string;
  streamDescription: string;
  status: string;
  currentViewers: number;
  peakViewers: number;
  startedAt: string;
  iceServers: RTCIceServer[];
}

interface SignalingMessage {
  type: string;
  streamId: string;
  fromWallet?: string;
  toWallet?: string;
  data?: any;
  timestamp?: string;
}

export default function LiveStreamBroadcast({ 
  launchId, 
  creatorWallet, 
  onStreamStateChange,
  className = "" 
}: LiveStreamBroadcastProps) {
  // Stream setup states
  const [streamTitle, setStreamTitle] = useState('');
  const [streamDescription, setStreamDescription] = useState('');
  const [isSettingUp, setIsSettingUp] = useState(false);
  
  // Stream session states
  const [streamSession, setStreamSession] = useState<StreamSession | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  
  // Media states
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  
  // WebRTC and signaling
  const [peerConnections, setPeerConnections] = useState<Map<string, RTCPeerConnection>>(new Map());
  const [signalingSocket, setSignalingSocket] = useState<WebSocket | null>(null);
  
  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Create stream session mutation
  const createStreamMutation = useMutation({
    mutationFn: async (streamData: { streamTitle: string; streamDescription: string }) => {
      const response = await apiRequest('/api/streaming/create', {
        method: 'POST',
        body: JSON.stringify({
          launchId,
          ...streamData,
          streamType: 'webrtc',
          maxViewers: 1000,
          allowChat: true
        })
      });
      if (!response.ok) throw new Error('Failed to create stream');
      return response.json();
    },
    onSuccess: (data) => {
      setStreamSession(data.stream);
      initializeSignaling(data.stream);
      toast({
        title: 'Stream Created',
        description: 'Your stream session has been created successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to Create Stream',
        description: error.message || 'Unable to create stream session',
        variant: 'destructive',
      });
    },
  });

  // Initialize media stream
  const initializeMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      setMediaStream(stream);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.muted = true; // Prevent echo
      }

      console.log('🎥 Media stream initialized');
      return stream;
    } catch (error) {
      console.error('❌ Error accessing media:', error);
      toast({
        title: 'Media Access Error',
        description: 'Unable to access camera and microphone. Please check permissions.',
        variant: 'destructive',
      });
      throw error;
    }
  };

  // Initialize WebSocket signaling
  const initializeSignaling = (session: StreamSession) => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/streaming?streamId=${session.id}&walletAddress=${creatorWallet}&clientType=broadcaster&sessionToken=${localStorage.getItem('sessionToken') || 'demo'}`;
    
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('🔗 Signaling connected');
      setConnectionStatus('connected');
      setSignalingSocket(ws);
    };

    ws.onmessage = async (event) => {
      try {
        const message: SignalingMessage = JSON.parse(event.data);
        await handleSignalingMessage(message);
      } catch (error) {
        console.error('❌ Error handling signaling message:', error);
      }
    };

    ws.onclose = () => {
      console.log('🔗 Signaling disconnected');
      setConnectionStatus('disconnected');
      setSignalingSocket(null);
    };

    ws.onerror = (error) => {
      console.error('🚨 Signaling error:', error);
      setConnectionStatus('disconnected');
    };
  };

  // Handle signaling messages
  const handleSignalingMessage = async (message: SignalingMessage) => {
    switch (message.type) {
      case 'answer':
        if (message.fromWallet) {
          await handleViewerAnswer(message.fromWallet, message.data);
        }
        break;
      case 'ice-candidate':
        if (message.fromWallet && message.data) {
          await handleIceCandidate(message.fromWallet, message.data);
        }
        break;
      case 'viewer-count':
        if (message.data?.viewerCount !== undefined) {
          setViewerCount(message.data.viewerCount);
        }
        break;
      case 'viewer-join':
        if (message.fromWallet) {
          await createPeerConnection(message.fromWallet);
        }
        break;
      case 'viewer-leave':
        if (message.fromWallet) {
          removePeerConnection(message.fromWallet);
        }
        break;
    }
  };

  // Create peer connection for new viewer
  const createPeerConnection = async (viewerWallet: string) => {
    if (!mediaStream || !streamSession) return;

    const pc = new RTCPeerConnection({
      iceServers: streamSession.iceServers
    });

    // Add media stream tracks
    mediaStream.getTracks().forEach(track => {
      pc.addTrack(track, mediaStream);
    });

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && signalingSocket) {
        signalingSocket.send(JSON.stringify({
          type: 'ice-candidate',
          streamId: streamSession.id,
          toWallet: viewerWallet,
          data: event.candidate
        }));
      }
    };

    // Create and send offer
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (signalingSocket) {
        signalingSocket.send(JSON.stringify({
          type: 'offer',
          streamId: streamSession.id,
          toWallet: viewerWallet,
          data: offer
        }));
      }

      setPeerConnections(prev => new Map(prev.set(viewerWallet, pc)));
      console.log(`🔗 Peer connection created for viewer ${viewerWallet.slice(0, 8)}`);
    } catch (error) {
      console.error('❌ Error creating offer:', error);
    }
  };

  // Handle viewer answer
  const handleViewerAnswer = async (viewerWallet: string, answer: RTCSessionDescriptionInit) => {
    const pc = peerConnections.get(viewerWallet);
    if (pc) {
      try {
        await pc.setRemoteDescription(answer);
        console.log(`📺 Answer received from viewer ${viewerWallet.slice(0, 8)}`);
      } catch (error) {
        console.error('❌ Error setting remote description:', error);
      }
    }
  };

  // Handle ICE candidate
  const handleIceCandidate = async (viewerWallet: string, candidate: RTCIceCandidateInit) => {
    const pc = peerConnections.get(viewerWallet);
    if (pc) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (error) {
        console.error('❌ Error adding ICE candidate:', error);
      }
    }
  };

  // Remove peer connection
  const removePeerConnection = (viewerWallet: string) => {
    const pc = peerConnections.get(viewerWallet);
    if (pc) {
      pc.close();
      setPeerConnections(prev => {
        const newMap = new Map(prev);
        newMap.delete(viewerWallet);
        return newMap;
      });
      console.log(`🔗 Peer connection removed for viewer ${viewerWallet.slice(0, 8)}`);
    }
  };

  // Start streaming
  const startStream = async () => {
    if (!streamSession) return;

    try {
      setIsSettingUp(true);
      
      // Initialize media if not already done
      if (!mediaStream) {
        await initializeMedia();
      }

      // Update stream status to live
      await apiRequest(`/api/streaming/session/${streamSession.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'live' })
      });

      // Send stream start signal
      if (signalingSocket) {
        signalingSocket.send(JSON.stringify({
          type: 'stream-start',
          streamId: streamSession.id
        }));
      }

      setIsStreaming(true);
      onStreamStateChange?.(true, streamSession.id);
      
      toast({
        title: 'Stream Started',
        description: 'You are now live!',
      });

      console.log('🔴 Stream started');
    } catch (error) {
      console.error('❌ Error starting stream:', error);
      toast({
        title: 'Failed to Start Stream',
        description: 'Unable to start the stream. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSettingUp(false);
    }
  };

  // Stop streaming
  const stopStream = async () => {
    if (!streamSession) return;

    try {
      // Update stream status to ended
      await apiRequest(`/api/streaming/session/${streamSession.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'ended' })
      });

      // Send stream end signal
      if (signalingSocket) {
        signalingSocket.send(JSON.stringify({
          type: 'stream-end',
          streamId: streamSession.id
        }));
      }

      // Close all peer connections
      peerConnections.forEach(pc => pc.close());
      setPeerConnections(new Map());

      // Stop media stream
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        setMediaStream(null);
      }

      // Close signaling
      if (signalingSocket) {
        signalingSocket.close();
        setSignalingSocket(null);
      }

      setIsStreaming(false);
      setStreamSession(null);
      setViewerCount(0);
      onStreamStateChange?.(false);

      toast({
        title: 'Stream Ended',
        description: 'Your stream has ended successfully.',
      });

      console.log('⏹️ Stream stopped');
    } catch (error) {
      console.error('❌ Error stopping stream:', error);
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (mediaStream) {
      const videoTrack = mediaStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
      }
    }
  };

  // Toggle audio
  const toggleAudio = () => {
    if (mediaStream) {
      const audioTrack = mediaStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioEnabled(audioTrack.enabled);
      }
    }
  };

  // Setup stream
  const setupStream = async () => {
    if (!streamTitle.trim()) {
      toast({
        title: 'Title Required',
        description: 'Please enter a stream title.',
        variant: 'destructive',
      });
      return;
    }

    await createStreamMutation.mutateAsync({
      streamTitle: streamTitle.trim(),
      streamDescription: streamDescription.trim()
    });
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
      if (signalingSocket) {
        signalingSocket.close();
      }
      peerConnections.forEach(pc => pc.close());
    };
  }, []);

  // Stream setup UI
  if (!streamSession) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-red-500" />
            Start Live Stream
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Stream Title *</label>
            <Input
              value={streamTitle}
              onChange={(e) => setStreamTitle(e.target.value)}
              placeholder="e.g., Token Launch Presentation"
              maxLength={100}
              data-testid="input-stream-title"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <Textarea
              value={streamDescription}
              onChange={(e) => setStreamDescription(e.target.value)}
              placeholder="Tell viewers what your stream is about..."
              rows={3}
              maxLength={500}
              data-testid="textarea-stream-description"
            />
          </div>

          <Alert>
            <Video className="h-4 w-4" />
            <AlertDescription>
              Make sure your camera and microphone are working properly before starting the stream. 
              Viewers will be able to watch and interact via chat.
            </AlertDescription>
          </Alert>

          <Button 
            onClick={setupStream}
            disabled={createStreamMutation.isPending || !streamTitle.trim()}
            className="w-full"
            data-testid="button-setup-stream"
          >
            {createStreamMutation.isPending ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Setting Up Stream...
              </div>
            ) : (
              <>
                <Settings className="h-4 w-4 mr-2" />
                Create Stream Session
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Stream control UI
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-red-500" />
            Live Stream
            {isStreaming && (
              <Badge variant="destructive" className="animate-pulse">
                LIVE
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <Eye className="h-4 w-4 text-blue-500" />
              <span>{viewerCount}</span>
            </div>
            <div className="flex items-center gap-1">
              {connectionStatus === 'connected' ? (
                <Wifi className="h-4 w-4 text-green-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-500" />
              )}
              <span className="capitalize">{connectionStatus}</span>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Video Preview */}
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          
          {!videoEnabled && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <VideoOff className="h-12 w-12 text-gray-400" />
            </div>
          )}
          
          {isStreaming && (
            <div className="absolute top-4 left-4">
              <Badge variant="destructive" className="animate-pulse">
                🔴 LIVE
              </Badge>
            </div>
          )}
          
          <div className="absolute top-4 right-4">
            <Badge variant="outline" className="bg-black/50">
              {viewerCount} viewers
            </Badge>
          </div>
        </div>

        {/* Media Controls */}
        <div className="flex items-center justify-center gap-4">
          <Button
            variant={videoEnabled ? "default" : "destructive"}
            size="sm"
            onClick={toggleVideo}
            disabled={!mediaStream}
            data-testid="button-toggle-video"
          >
            {videoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
          </Button>
          
          <Button
            variant={audioEnabled ? "default" : "destructive"}
            size="sm"
            onClick={toggleAudio}
            disabled={!mediaStream}
            data-testid="button-toggle-audio"
          >
            {audioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          </Button>
        </div>

        {/* Stream Status */}
        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h4 className="font-medium mb-1">{streamSession.streamTitle}</h4>
          {streamSession.streamDescription && (
            <p className="text-sm text-gray-600 mb-2">{streamSession.streamDescription}</p>
          )}
          
          <div className="flex items-center justify-between text-sm">
            <span>Status: {isStreaming ? 'Live' : 'Ready'}</span>
            <span>Peak viewers: {streamSession.peakViewers}</span>
          </div>
        </div>

        {/* Main Control Button */}
        {!isStreaming ? (
          <Button 
            onClick={startStream}
            disabled={isSettingUp || connectionStatus !== 'connected'}
            className="w-full bg-red-600 hover:bg-red-700"
            data-testid="button-start-stream"
          >
            {isSettingUp ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Starting Stream...
              </div>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Go Live
              </>
            )}
          </Button>
        ) : (
          <Button 
            onClick={stopStream}
            variant="destructive"
            className="w-full"
            data-testid="button-stop-stream"
          >
            <Square className="h-4 w-4 mr-2" />
            End Stream
          </Button>
        )}

        {connectionStatus !== 'connected' && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Connection issues detected. Check your internet connection.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
