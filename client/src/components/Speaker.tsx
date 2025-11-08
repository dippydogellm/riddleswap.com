import { useState, useRef, useEffect } from "react";
import { Volume2, VolumeX, Music, MessageSquare, Settings } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface SpeakerProps {
  className?: string;
}

export function Speaker({ className = "" }: SpeakerProps) {
  const [volume, setVolume] = useState(70);
  const [isMuted, setIsMuted] = useState(false);
  const [soundEffectsEnabled, setSoundEffectsEnabled] = useState(true);
  const [oracleNarrationEnabled, setOracleNarrationEnabled] = useState(true);
  const [backgroundMusicEnabled, setBackgroundMusicEnabled] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  // Audio refs for different sound types
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);
  const sfxRef = useRef<HTMLAudioElement | null>(null);
  const oracleRef = useRef<HTMLAudioElement | null>(null);

  // Load audio settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('audio-settings');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setVolume(settings.volume || 70);
      setIsMuted(settings.isMuted || false);
      setSoundEffectsEnabled(settings.soundEffects ?? true);
      setOracleNarrationEnabled(settings.oracleNarration ?? true);
      setBackgroundMusicEnabled(settings.backgroundMusic ?? true);
    }
  }, []);

  // Save settings to localStorage
  useEffect(() => {
    const settings = {
      volume,
      isMuted,
      soundEffects: soundEffectsEnabled,
      oracleNarration: oracleNarrationEnabled,
      backgroundMusic: backgroundMusicEnabled,
    };
    localStorage.setItem('audio-settings', JSON.stringify(settings));
  }, [volume, isMuted, soundEffectsEnabled, oracleNarrationEnabled, backgroundMusicEnabled]);

  // Handle volume changes
  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
    if (value[0] > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  // Toggle mute
  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  // Get effective volume (0 if muted)
  const effectiveVolume = isMuted ? 0 : volume;

  // Play test sound using Web Audio API
  const playTestSound = () => {
    if (soundEffectsEnabled && !isMuted && effectiveVolume > 0) {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Configure test sound (pleasant beep)
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        
        // Apply user volume (0-1 scale)
        gainNode.gain.setValueAtTime(effectiveVolume / 100, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

        // Play for 300ms
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);

        // Cleanup
        setTimeout(() => {
          audioContext.close();
        }, 500);

        console.log('✅ Test sound played at volume:', effectiveVolume);
      } catch (error) {
        console.error('❌ Failed to play test sound:', error);
      }
    } else {
      console.log('🔇 Test sound blocked: muted=' + isMuted + ', volume=' + effectiveVolume + ', sfx=' + soundEffectsEnabled);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className={`relative flex items-center gap-2 p-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors ${className}`}
          aria-label="Audio Controls"
        >
          {isMuted ? (
            <VolumeX className="w-5 h-5 text-gray-400" />
          ) : (
            <Volume2 className="w-5 h-5 text-orange-400" />
          )}
          <span className="text-sm text-gray-300 hidden sm:inline">Audio</span>
          
          {/* Volume indicator bars */}
          {!isMuted && (
            <div className="flex items-center gap-0.5">
              <div className={`w-1 h-2 rounded-full ${volume > 20 ? 'bg-orange-400' : 'bg-gray-600'}`}></div>
              <div className={`w-1 h-3 rounded-full ${volume > 40 ? 'bg-orange-400' : 'bg-gray-600'}`}></div>
              <div className={`w-1 h-4 rounded-full ${volume > 60 ? 'bg-orange-400' : 'bg-gray-600'}`}></div>
              <div className={`w-1 h-5 rounded-full ${volume > 80 ? 'bg-orange-400' : 'bg-gray-600'}`}></div>
            </div>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-80 bg-slate-900 border-slate-800 text-white" side="bottom" align="end">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <Settings className="w-5 h-5 text-orange-400" />
            <h3 className="font-semibold text-white">Audio Controls</h3>
          </div>

          {/* Master Volume */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-gray-300">Master Volume</Label>
              <button
                onClick={toggleMute}
                className="p-1.5 rounded hover:bg-slate-800 transition-colors"
              >
                {isMuted ? (
                  <VolumeX className="w-4 h-4 text-gray-400" />
                ) : (
                  <Volume2 className="w-4 h-4 text-orange-400" />
                )}
              </button>
            </div>
            
            <div className="flex items-center gap-3">
              <Slider
                value={[volume]}
                onValueChange={handleVolumeChange}
                max={100}
                step={1}
                className="flex-1"
                disabled={isMuted}
              />
              <span className="text-sm text-gray-400 w-12 text-right">
                {effectiveVolume}%
              </span>
            </div>
          </div>

          {/* Audio Categories */}
          <div className="space-y-3 pt-3 border-t border-slate-800">
            {/* Background Music */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Music className="w-4 h-4 text-purple-400" />
                <Label className="text-sm text-gray-300">Background Music</Label>
              </div>
              <Switch
                checked={backgroundMusicEnabled}
                onCheckedChange={setBackgroundMusicEnabled}
                className="data-[state=checked]:bg-orange-500"
              />
            </div>

            {/* Sound Effects */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-blue-400" />
                <Label className="text-sm text-gray-300">Sound Effects</Label>
              </div>
              <Switch
                checked={soundEffectsEnabled}
                onCheckedChange={setSoundEffectsEnabled}
                className="data-[state=checked]:bg-orange-500"
              />
            </div>

            {/* Oracle Narration */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-orange-400" />
                <Label className="text-sm text-gray-300">Oracle AI Narration</Label>
              </div>
              <Switch
                checked={oracleNarrationEnabled}
                onCheckedChange={setOracleNarrationEnabled}
                className="data-[state=checked]:bg-orange-500"
              />
            </div>
          </div>

          {/* Test Sound Button */}
          <button
            onClick={playTestSound}
            disabled={isMuted || !soundEffectsEnabled}
            className="w-full py-2 px-4 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 disabled:from-gray-700 disabled:to-gray-800 disabled:text-gray-500 rounded-lg text-sm font-medium transition-all"
          >
            Test Sound
          </button>

          {/* Current Settings Summary */}
          <div className="text-xs text-gray-500 pt-2 border-t border-slate-800">
            <p>
              {isMuted ? "🔇 Audio muted" :
               effectiveVolume === 0 ? "🔇 Volume at 0%" :
               effectiveVolume < 30 ? "🔉 Low volume" :
               effectiveVolume < 70 ? "🔊 Medium volume" : "🔊 High volume"}
            </p>
            <p className="mt-1">
              {[
                backgroundMusicEnabled && "Music",
                soundEffectsEnabled && "SFX",
                oracleNarrationEnabled && "Oracle"
              ].filter(Boolean).join(" • ") || "All audio disabled"}
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
