/**
 * Step 2: Player Image Generator
 * Appears after wizard completion to generate player and civilization images
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Camera, 
  Sparkles, 
  Wand2, 
  Crown, 
  Shield, 
  ArrowRight,
  Check,
  Loader2,
  Download,
  Eye
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PlayerImageGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  onContinue: () => void;
  userHandle: string;
  playerData: {
    player_name: string;
    civilization_name: string;
    primary_color: string;
    secondary_color: string;
    religion: string;
    commander_class: string;
  };
}

interface GeneratedImage {
  type: 'player_portrait' | 'civilization_crest' | 'commander_avatar';
  url: string;
  description: string;
  generated_at: string;
}

export default function PlayerImageGenerator({ 
  isOpen, 
  onClose, 
  onContinue, 
  userHandle,
  playerData 
}: PlayerImageGeneratorProps) {
  const [currentImageType, setCurrentImageType] = useState<'player_portrait' | 'civilization_crest' | 'commander_avatar'>('player_portrait');
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [customPrompts, setCustomPrompts] = useState({
    player_portrait: '',
    civilization_crest: '',
    commander_avatar: ''
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Generate images using AI (Public endpoint - NO AUTH REQUIRED)
  const generateImageMutation = useMutation({
    mutationFn: async ({ type, customPrompt }: { type: string; customPrompt?: string }) => {
      const basePrompts = {
        player_portrait: `Medieval fantasy portrait of ${playerData.player_name}, a ${playerData.religion} ${playerData.commander_class} from the civilization of ${playerData.civilization_name}. Professional character art style, detailed medieval clothing with colors ${playerData.primary_color} and ${playerData.secondary_color}. High quality, fantasy RPG character portrait.`,
        civilization_crest: `Heraldic coat of arms and crest for the medieval civilization "${playerData.civilization_name}". Colors: ${playerData.primary_color} and ${playerData.secondary_color}. Medieval heraldry style, shield design, banner, royal crest, fantasy kingdom emblem.`,
        commander_avatar: `Military commander avatar for ${playerData.player_name}, a ${playerData.commander_class} leader of ${playerData.civilization_name}. Medieval fantasy military portrait, armor and weapons, commanding presence, colors ${playerData.primary_color} and ${playerData.secondary_color}.`
      };
      
      const prompt = customPrompt || basePrompts[type as keyof typeof basePrompts];
      
      console.log('🎨 [IMAGE GEN] Using public endpoint (NO AUTH)', { type, promptLength: prompt.length });
      
      const response = await fetch('/api/public/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          size: '1024x1024',
          quality: 'standard'
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate image');
      }
      
      const result = await response.json() as any;
      console.log('✅ [IMAGE GEN] Image generated:', result);
      
      return {
        image_url: result.data.url,
        description: result.data.revisedPrompt || prompt
      };
    },
    onSuccess: (data, variables) => {
      const newImage: GeneratedImage = {
        type: variables.type as any,
        url: data.image_url,
        description: data.description || `Generated ${variables.type}`,
        generated_at: new Date().toISOString()
      };
      
      setGeneratedImages(prev => [...prev.filter(img => img.type !== variables.type), newImage]);
      
      toast({
        title: "🎨 Image Generated!",
        description: `Your ${variables.type.replace('_', ' ')} has been created and will refresh automatically.`,
        duration: 3000,
      });
      
      // Invalidate ALL queries that might contain player/profile data
      // This uses predicate matching to invalidate any query starting with these paths
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.includes('/player/profile') || 
                 key?.includes('/api/gaming/player') || 
                 key?.includes('/api/inquisition-audit/player');
        }
      });
    },
    onError: (error: any) => {
      console.error('❌ [IMAGE GEN] Generation error:', error);
      toast({
        title: "⚠️ Generation Failed",
        description: error.message || "Failed to generate image. Please check your OpenAI billing limit.",
        variant: "destructive",
        duration: 5000,
      });
    }
  });

  // Save generated images to player profile
  const saveImagesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/gaming/player/images', {
        method: 'PUT',
        body: JSON.stringify({
          commander_profile_image: generatedImages.find(img => img.type === 'player_portrait')?.url,
          crest_image: generatedImages.find(img => img.type === 'civilization_crest')?.url,
          commander_avatar: generatedImages.find(img => img.type === 'commander_avatar')?.url
        })
      });
      return await response.json() as any;
    },
    onSuccess: () => {
      toast({
        title: "💾 Images Saved!",
        description: "Your player images have been saved and your profile will refresh automatically.",
        duration: 3000,
      });
      
      // Invalidate ALL player profile queries using predicate matching
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.includes('/player/profile') || 
                 key?.includes('/api/gaming/player') || 
                 key?.includes('/api/inquisition-audit/player');
        }
      });
      
      // Force refetch after a brief delay to ensure data is updated
      setTimeout(() => {
        queryClient.refetchQueries({ 
          predicate: (query) => {
            const key = query.queryKey[0] as string;
            return key?.includes('/player/profile') || 
                   key?.includes('/api/gaming/player') || 
                   key?.includes('/api/inquisition-audit/player');
          }
        });
      }, 500);
      
      onContinue(); // Move to Step 3
    },
    onError: (error: any) => {
      console.error('❌ [IMAGE SAVE] Error:', error);
      toast({
        title: "⚠️ Save Failed",
        description: error.message || "Failed to save images",
        variant: "destructive",
        duration: 5000,
      });
    }
  });

  const imageTypes = [
    {
      id: 'player_portrait' as const,
      title: 'Player Portrait',
      description: 'Your character\'s official portrait',
      icon: Crown,
      color: 'from-purple-500 to-pink-500'
    },
    {
      id: 'civilization_crest' as const,
      title: 'Civilization Crest',
      description: 'Your kingdom\'s heraldic emblem',
      icon: Shield,
      color: 'from-blue-500 to-cyan-500'
    },
    {
      id: 'commander_avatar' as const,
      title: 'Commander Avatar',
      description: 'Your military leadership portrait',
      icon: Sparkles,
      color: 'from-orange-500 to-red-500'
    }
  ];

  const currentImage = generatedImages.find(img => img.type === currentImageType);
  const completedImages = generatedImages.length;
  const totalImages = imageTypes.length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center text-purple-600 dark:text-purple-400">
            🎨 Step 2: Generate Your Images
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Image Generation Progress</span>
              <span className="text-sm text-gray-500">{completedImages}/{totalImages} Complete</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${(completedImages / totalImages) * 100}%` }}
              ></div>
            </div>
          </div>

          {/* Image Type Selection */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {imageTypes.map((type) => {
              const Icon = type.icon;
              const isCompleted = generatedImages.some(img => img.type === type.id);
              const isActive = currentImageType === type.id;
              
              return (
                <Card 
                  key={type.id}
                  className={`cursor-pointer transition-all duration-200 ${
                    isActive ? 'ring-2 ring-purple-500 bg-purple-50 dark:bg-purple-900/20' : ''
                  } ${isCompleted ? 'border-green-500' : ''}`}
                  onClick={() => setCurrentImageType(type.id)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <Icon className="h-6 w-6" />
                      {isCompleted && <Check className="h-5 w-5 text-green-500" />}
                    </div>
                    <CardTitle className="text-lg">{type.title}</CardTitle>
                    <CardDescription className="text-sm">{type.description}</CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>

          {/* Current Image Generation */}
          <Card className="border-purple-200 dark:border-purple-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Generating: {imageTypes.find(t => t.id === currentImageType)?.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Custom Prompt Input */}
              <div className="space-y-2">
                <Label htmlFor="custom-prompt">Custom Description (Optional)</Label>
                <Textarea
                  id="custom-prompt"
                  placeholder="Describe any specific details you want in your image..."
                  value={customPrompts[currentImageType]}
                  onChange={(e) => setCustomPrompts(prev => ({ ...prev, [currentImageType]: e.target.value }))}
                  className="min-h-[80px]"
                />
              </div>

              {/* Generated Image Display */}
              {currentImage && (
                <div className="space-y-2">
                  <Label>Generated Image</Label>
                  <div className="relative">
                    <img 
                      src={currentImage.url} 
                      alt={currentImage.description}
                      className="w-full max-w-md mx-auto rounded-lg border-2 border-purple-200 dark:border-purple-800"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="absolute top-2 right-2"
                      asChild
                    >
                      <a href={currentImage.url} target="_blank" rel="noopener noreferrer">
                        <Eye className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </div>
              )}

              {/* Generate Button */}
              <Button
                className="w-full"
                onClick={() => generateImageMutation.mutate({
                  type: currentImageType,
                  customPrompt: customPrompts[currentImageType]
                })}
                disabled={generateImageMutation.isPending}
              >
                {generateImageMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4 mr-2" />
                    {currentImage ? 'Regenerate' : 'Generate'} Image
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={onClose}>
              Skip for Now
            </Button>
            
            <Button
              onClick={() => saveImagesMutation.mutate()}
              disabled={generatedImages.length === 0 || saveImagesMutation.isPending}
              className="bg-gradient-to-r from-purple-500 to-pink-500"
            >
              {saveImagesMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  Continue to Step 3: Make Allies
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
