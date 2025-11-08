import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Play, 
  Pause,
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize,
  Eye,
  Wifi,
  WifiOff,
  AlertTriangle,
  Loader,
  Users,
  Video
} from 'lucide-react';

interface LiveStreamPlayerProps {
  launchId: number;
  currentUser: {
    wallet: string;
    sessionToken: string;
    handle?: string;
  };
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
  streamerWallet: string;
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

export default function LiveStreamPlayer({ 
  launchId, 
  currentUser, 
  className = "" 
}: LiveStreamPlayerProps) {
  // Stream states
  const [streamSession, setStreamSession] = useState<StreamSession | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [volume, setVolume] = useState(1);
  
  // Connection states
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [signalingSocket, setSignalingSocket] = useState<WebSocket | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch active stream for launch
  const { data: streamData, isLoading, error, refetch } = useQuery({
    queryKey: ['active-stream', launchId],
    queryFn: async () => {
      const response = await apiRequest(`/api/streaming/launch/${launchId}/active`);
      if (!response.ok) throw new Error('Failed to fetch stream');
      return response.json();
    },
    refetchInterval: 10000, // Check for new streams every 10 seconds
    enabled: true
  });

  // Initialize stream when data is available
  useEffect(() => {
    if (streamData?.stream && streamData.stream.status === 'live') {
      setStreamSession(streamData.stream);
      initializeViewing(streamData.stream);
    } else {
      setStreamSession(null);
      cleanup();
    }
  }, [streamData]);

  // Initialize viewing connection
  const initializeViewing = async (stream: StreamSession) => {
    try {
      setConnectionStatus('connecting');
      
      // Initialize WebRTC peer connection
      const pc = new RTCPeerConnection({
        iceServers: stream.iceServers
      });

      // Handle remote stream
      pc.ontrack = (event) => {
        console.log('📺 Received remote stream');
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
          setIsPlaying(true);
        }
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && signalingSocket) {
          signalingSocket.send(JSON.stringify({
            type: 'ice-candidate',
            streamId: stream.id,
            toWallet: stream.streamerWallet,
            data: event.candidate
          }));
        }
      };

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        console.log('🔗 Connection state:', pc.connectionState);
        switch (pc.connectionState) {
          case 'connected':
            setConnectionStatus('connected');
            break;
          case 'disconnected':
          case 'failed':
            setConnectionStatus('error');
            break;
          case 'connecting':
            setConnectionStatus('connecting');
            break;
        }
      };

      setPeerConnection(pc);
      
      // Initialize signaling
      initializeSignaling(stream, pc);
      
    } catch (error) {
      console.error('❌ Error initializing viewing:', error);
      setConnectionStatus('error');
    }
  };

  // Initialize signaling connection
  const initializeSignaling = (stream: StreamSession, pc: RTCPeerConnection) => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/streaming?streamId=${stream.id}&walletAddress=${currentUser.wallet}&clientType=viewer&sessionToken=${currentUser.sessionToken}`;
    
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('🔗 Viewer signaling connected');
      setSignalingSocket(ws);
      
      // Signal that we want to join as viewer
      ws.send(JSON.stringify({
        type: 'viewer-join',
        streamId: stream.id,
        fromWallet: currentUser.wallet
      }));
    };

    ws.onmessage = async (event) => {
      try {
        const message: SignalingMessage = JSON.parse(event.data);
        await handleSignalingMessage(message, pc);
      } catch (error) {
        console.error('❌ Error handling signaling message:', error);
      }
    };

    ws.onclose = () => {
      console.log('🔗 Viewer signaling disconnected');
      setSignalingSocket(null);
      setConnectionStatus('disconnected');
    };

    ws.onerror = (error) => {
      console.error('🚨 Viewer signaling error:', error);
      setConnectionStatus('error');
    };
  };

  // Handle signaling messages
  const handleSignalingMessage = async (message: SignalingMessage, pc: RTCPeerConnection) => {
    switch (message.type) {
      case 'offer':
        if (message.data) {
          await handleOffer(message.data, pc);
        }
        break;
      case 'ice-candidate':
        if (message.data) {
          await handleIceCandidate(message.data, pc);
        }
        break;
      case 'viewer-count':
        if (message.data?.viewerCount !== undefined) {
          setViewerCount(message.data.viewerCount);
        }
        break;
      case 'stream-end':
        setIsPlaying(false);
        setConnectionStatus('disconnected');
        cleanup();
        break;
      case 'heartbeat':
        // Keep connection alive
        break;
    }
  };

  // Handle offer from broadcaster
  const handleOffer = async (offer: RTCSessionDescriptionInit, pc: RTCPeerConnection) => {
    try {
      await pc.setRemoteDescription(offer);
      
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (signalingSocket) {
        signalingSocket.send(JSON.stringify({
          type: 'answer',
          streamId: streamSession!.id,
          toWallet: streamSession!.streamerWallet,
          data: answer
        }));
      }

      console.log('📺 Answer sent to broadcaster');
    } catch (error) {
      console.error('❌ Error handling offer:', error);
      setConnectionStatus('error');
    }
  };

  // Handle ICE candidate
  const handleIceCandidate = async (candidate: RTCIceCandidateInit, pc: RTCPeerConnection) => {
    try {
      await pc.addIceCandidate(candidate);
    } catch (error) {
      console.error('❌ Error adding ICE candidate:', error);
    }
  };

  // Toggle play/pause
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  // Toggle mute
  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  // Toggle fullscreen
  const toggleFullscreen = async () => {
    if (!document.fullscreenElement && containerRef.current) {
      await containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Handle volume change
  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
  };

  // Cleanup connections
  const cleanup = () => {
    if (peerConnection) {
      peerConnection.close();
      setPeerConnection(null);
    }
    
    if (signalingSocket) {
      signalingSocket.close();
      setSignalingSocket(null);
    }
    
    setIsPlaying(false);
    setConnectionStatus('disconnected');
    setViewerCount(0);
  };

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, []);

  // Handle fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-4">
              <Loader className="h-8 w-8 animate-spin text-blue-500" />
              <p className="text-gray-600">Checking for live stream...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No active stream
  if (!streamSession || streamSession.status !== 'live') {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-gray-400" />
            Live Stream
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <Video className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="font-medium text-gray-600 mb-2">No Live Stream</h3>
            <p className="text-sm text-gray-500 mb-4">
              The token creator is not currently streaming. Check back later!
            </p>
            <Button 
              variant="outline" 
              onClick={() => refetch()}
              size="sm"
              data-testid="button-refresh-stream"
            >
              Check Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-red-500" />
            {streamSession.streamTitle}
            <Badge variant="destructive" className="animate-pulse">
              LIVE
            </Badge>
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
        {/* Video Player */}
        <div 
          ref={containerRef}
          className="relative aspect-video bg-black rounded-lg overflow-hidden group"
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
            onClick={togglePlay}
            data-testid="video-stream-player"
          />
          
          {/* Connection Status Overlay */}
          {connectionStatus === 'connecting' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70">
              <div className="flex flex-col items-center gap-2 text-white">
                <Loader className="h-8 w-8 animate-spin" />
                <p>Connecting to stream...</p>
              </div>
            </div>
          )}
          
          {connectionStatus === 'error' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70">
              <div className="flex flex-col items-center gap-2 text-white">
                <AlertTriangle className="h-8 w-8 text-red-400" />
                <p>Connection failed</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => refetch()}
                  className="mt-2"
                >
                  Retry
                </Button>
              </div>
            </div>
          )}
          
          {/* Live Indicator */}
          <div className="absolute top-4 left-4">
            <Badge variant="destructive" className="animate-pulse">
              🔴 LIVE
            </Badge>
          </div>
          
          {/* Viewer Count */}
          <div className="absolute top-4 right-4">
            <Badge variant="outline" className="bg-black/50 text-white">
              <Users className="h-3 w-3 mr-1" />
              {viewerCount}
            </Badge>
          </div>
          
          {/* Video Controls */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={togglePlay}
                  className="text-white hover:bg-white/20"
                  data-testid="button-toggle-play"
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleMute}
                  className="text-white hover:bg-white/20"
                  data-testid="button-toggle-mute"
                >
                  {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </Button>
                
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-20"
                />
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleFullscreen}
                className="text-white hover:bg-white/20"
                data-testid="button-toggle-fullscreen"
              >
                {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Stream Info */}
        {streamSession.streamDescription && (
          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-600">{streamSession.streamDescription}</p>
          </div>
        )}

        {/* Stream Stats */}
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>Current viewers: {viewerCount}</span>
          <span>Peak viewers: {streamSession.peakViewers}</span>
        </div>

        {/* Connection Status Alert */}
        {connectionStatus === 'error' && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Connection to the stream failed. Please check your internet connection and try again.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
