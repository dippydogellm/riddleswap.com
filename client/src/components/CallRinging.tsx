import { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Video, X } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

interface CallRingingProps {
  callerName: string;
  callerAvatar?: string;
  isVideoCall: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export function CallRinging({ callerName, callerAvatar, isVideoCall, onAccept, onDecline }: CallRingingProps) {
  const [isRinging, setIsRinging] = useState(true);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  useEffect(() => {
    // Create ringing sound using Web Audio API
    const startRinging = () => {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        oscillatorRef.current = audioContextRef.current.createOscillator();
        gainNodeRef.current = audioContextRef.current.createGain();

        oscillatorRef.current.connect(gainNodeRef.current);
        gainNodeRef.current.connect(audioContextRef.current.destination);

        oscillatorRef.current.type = 'sine';
        oscillatorRef.current.frequency.setValueAtTime(440, audioContextRef.current.currentTime);
        gainNodeRef.current.gain.setValueAtTime(0.3, audioContextRef.current.currentTime);

        oscillatorRef.current.start();

        // Create ringing pattern (beep beep pause)
        let time = audioContextRef.current.currentTime;
        for (let i = 0; i < 10; i++) {
          gainNodeRef.current.gain.setValueAtTime(0.3, time);
          gainNodeRef.current.gain.setValueAtTime(0, time + 0.4);
          gainNodeRef.current.gain.setValueAtTime(0.3, time + 0.6);
          gainNodeRef.current.gain.setValueAtTime(0, time + 1.0);
          time += 2;
        }
      } catch (error) {
        console.error('Failed to create ringing sound:', error);
      }
    };

    startRinging();

    // Show browser notification if permission granted
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`Incoming ${isVideoCall ? 'Video' : 'Audio'} Call`, {
        body: `${callerName} is calling you...`,
        icon: callerAvatar || '/logo.png',
        tag: 'incoming-call',
        requireInteraction: true,
      });
    }

    // Cleanup function
    return () => {
      if (oscillatorRef.current) {
        oscillatorRef.current.stop();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [callerName, callerAvatar, isVideoCall]);

  const handleAccept = () => {
    setIsRinging(false);
    if (oscillatorRef.current) {
      oscillatorRef.current.stop();
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    onAccept();
  };

  const handleDecline = () => {
    setIsRinging(false);
    if (oscillatorRef.current) {
      oscillatorRef.current.stop();
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    onDecline();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <Card className="w-full max-w-md p-8 shadow-2xl border-2 animate-in zoom-in-95 duration-300">
        <div className="flex flex-col items-center space-y-6">
          {/* Caller Avatar */}
          <div className="relative">
            <Avatar className="w-32 h-32 border-4 border-blue-600 ring-4 ring-blue-600/20 animate-pulse">
              <AvatarImage src={callerAvatar} />
              <AvatarFallback className="text-4xl bg-gradient-to-br from-blue-600 to-purple-600 text-white">
                {callerName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-2 -right-2 bg-blue-600 rounded-full p-3 shadow-lg">
              {isVideoCall ? (
                <Video className="w-6 h-6 text-white" />
              ) : (
                <Phone className="w-6 h-6 text-white" />
              )}
            </div>
          </div>

          {/* Caller Info */}
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">{callerName}</h2>
            <p className="text-muted-foreground">
              Incoming {isVideoCall ? 'Video' : 'Audio'} Call...
            </p>
          </div>

          {/* Ringing Animation */}
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 w-full mt-4">
            <Button
              onClick={handleDecline}
              variant="destructive"
              size="lg"
              className="flex-1 gap-2 h-14 text-lg"
            >
              <PhoneOff className="w-5 h-5" />
              Decline
            </Button>
            <Button
              onClick={handleAccept}
              variant="default"
              size="lg"
              className="flex-1 gap-2 h-14 text-lg bg-green-600 hover:bg-green-700"
            >
              <Phone className="w-5 h-5" />
              Accept
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
