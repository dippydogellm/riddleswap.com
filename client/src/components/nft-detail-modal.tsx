import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Wand2, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface NFTDetailModalProps {
  nft: {
    id: string;
    name: string;
    image_url?: string;
    owner_address: string;
    collection_name?: string;
    
    // Power attributes
    army_power?: number;
    religion_power?: number;
    civilization_power?: number;
    economic_power?: number;
    total_power?: number;
    
    // Character class
    character_class?: string;
    class_confidence?: number;
    
    // Enhanced attributes
    special_powers?: string[];
    materials_found?: string[];
    rarities_found?: string[];
    keywords_detected?: {
      army: string[];
      religion: string[];
      civilization: string[];
      economic: string[];
    };
    all_traits?: Record<string, any>;
    
    // Battle stats
    battles_participated?: number;
    battles_won?: number;
    battles_lost?: number;
    total_damage_dealt?: number;
    total_damage_taken?: number;
    
    // Metadata
    metadata?: Record<string, any>;
    traits?: Record<string, any>;
  } | null;
  open: boolean;
  onClose: () => void;
}

export function NFTDetailModal({ nft, open, onClose }: NFTDetailModalProps) {
  if (!nft) return null;

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  // Check if NFT is from Inquisition collection
  const isInquisitionNFT = nft.metadata?.issuer === 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH' || 
                           nft.collection_name?.toLowerCase().includes('inquisition');

  // Image generation mutation
  const generateImageMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/gaming/generate-player-image', {
        method: 'POST',
        body: JSON.stringify({ nft_id: nft.id }),
        headers: { 'Content-Type': 'application/json' }
      }) as unknown as { image_url: string };
      return response.image_url;
    },
    onSuccess: (imageUrl) => {
      setGeneratedImage(imageUrl);
      toast({
        title: "✨ Image Generated!",
        description: "Your NFT image has been created and will refresh automatically",
        duration: 3000,
      });
      // Invalidate ALL queries to trigger auto-refresh
      queryClient.invalidateQueries({ queryKey: ['/api/gaming/player/nfts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inquisition-audit/player/nfts'] });
      queryClient.invalidateQueries({ queryKey: ['/player/profile'] });
      
      // Force immediate refetch with a slight delay to ensure backend is updated
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ['/api/gaming/player/nfts'] });
        queryClient.refetchQueries({ queryKey: ['/api/inquisition-audit/player/nfts'] });
      }, 500);
    },
    onError: (error: any) => {
      console.error('❌ [NFT IMAGE] Generation error:', error);
      toast({
        title: "❌ Generation Failed",
        description: error.message || "Failed to generate image. Please check your OpenAI billing limit.",
        variant: "destructive",
        duration: 5000,
      });
    }
  });

  const getClassIcon = (characterClass?: string) => {
    const icons: Record<string, string> = {
      warrior: '⚔️',
      priest: '👑',
      knight: '🛡️',
      merchant: '💰',
      sage: '📚',
      lord: '🏰',
      champion: '👑',
      paladin: '✨',
      mercenary: '💸',
      templar: '⛪',
      hybrid: '🔀'
    };
    return icons[characterClass || 'unknown'] || '❓';
  };

  const winRate = nft.battles_participated 
    ? ((nft.battles_won || 0) / nft.battles_participated * 100).toFixed(1)
    : '0.0';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:w-[90%] sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-3">
            {nft.image_url && (
              <img 
                src={nft.image_url} 
                alt={nft.name}
                className="w-12 h-12 rounded-lg object-cover"
              />
            )}
            <div>
              {nft.name}
              {nft.character_class && (
                <Badge variant="outline" className="ml-2">
                  {getClassIcon(nft.character_class)} {nft.character_class.toUpperCase()}
                </Badge>
              )}
            </div>
          </DialogTitle>
          {nft.collection_name && (
            <DialogDescription>
              Collection: {nft.collection_name}
            </DialogDescription>
          )}
        </DialogHeader>

        <Tabs defaultValue="stats" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="stats">Stats</TabsTrigger>
            <TabsTrigger value="traits">Traits & Powers</TabsTrigger>
            <TabsTrigger value="battles">Battle History</TabsTrigger>
            <TabsTrigger value="owner">Owner Info</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[500px] mt-4">
            {/* Stats Tab */}
            <TabsContent value="stats" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Power Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                      <span className="text-sm font-medium">⚔️ Army</span>
                      <span className="text-xl font-bold text-red-600">{nft.army_power || 0}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                      <span className="text-sm font-medium">👑 Religion</span>
                      <span className="text-xl font-bold text-blue-600">{nft.religion_power || 0}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
                      <span className="text-sm font-medium">🏰 Civilization</span>
                      <span className="text-xl font-bold text-purple-600">{nft.civilization_power || 0}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg">
                      <span className="text-sm font-medium">⭐ Economic</span>
                      <span className="text-xl font-bold text-yellow-600">{nft.economic_power || 0}</span>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-lg">
                    <span className="text-lg font-semibold">Total Power</span>
                    <span className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                      {nft.total_power || 0}
                    </span>
                  </div>

                  {nft.character_class && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Character Class</span>
                          <Badge variant="secondary">
                            {getClassIcon(nft.character_class)} {nft.character_class.toUpperCase()}
                          </Badge>
                        </div>
                        {nft.class_confidence && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Confidence</span>
                            <span className="text-sm font-medium">{nft.class_confidence.toFixed(0)}%</span>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {nft.materials_found && nft.materials_found.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Materials & Rarity</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Materials:</span>
                      {nft.materials_found.map((material, idx) => (
                        <Badge key={idx} variant="outline">{material}</Badge>
                      ))}
                    </div>
                    {nft.rarities_found && nft.rarities_found.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Rarity:</span>
                        {nft.rarities_found.map((rarity, idx) => (
                          <Badge key={idx} variant="secondary">{rarity}</Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* AI Image Generation - Inquisition Only */}
              {isInquisitionNFT && (
                <Card className="border-purple-500/50 bg-purple-950/20">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Wand2 className="w-5 h-5 text-purple-400" />
                      AI Image Generation
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Generate a unique AI-powered character image for this Inquisition NFT using advanced image generation.
                    </p>
                    
                    {generatedImage && (
                      <div className="rounded-lg overflow-hidden border border-purple-500/50">
                        <img 
                          src={generatedImage} 
                          alt="Generated character" 
                          className="w-full h-auto"
                        />
                        <div className="p-2 bg-purple-950/50 text-xs text-center text-purple-300">
                          Recently Generated
                        </div>
                      </div>
                    )}
                    
                    <Button
                      onClick={() => generateImageMutation.mutate()}
                      disabled={generateImageMutation.isPending}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      {generateImageMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-4 h-4 mr-2" />
                          {generatedImage ? 'Regenerate Image' : 'Generate AI Image'}
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Traits & Powers Tab */}
            <TabsContent value="traits" className="space-y-4">
              {nft.special_powers && nft.special_powers.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">✨ Special Powers</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {nft.special_powers.map((power, idx) => (
                        <div key={idx} className="p-2 bg-purple-50 dark:bg-purple-950/20 rounded border border-purple-200 dark:border-purple-800">
                          <span className="text-sm font-medium">{power}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {nft.keywords_detected && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">🔍 Detected Keywords</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {nft.keywords_detected.army.length > 0 && (
                      <div>
                        <span className="text-sm font-medium text-red-600">⚔️ Army:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {nft.keywords_detected.army.map((kw, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">{kw}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {nft.keywords_detected.religion.length > 0 && (
                      <div>
                        <span className="text-sm font-medium text-blue-600">👑 Religion:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {nft.keywords_detected.religion.map((kw, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">{kw}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {nft.keywords_detected.civilization.length > 0 && (
                      <div>
                        <span className="text-sm font-medium text-purple-600">🏰 Civilization:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {nft.keywords_detected.civilization.map((kw, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">{kw}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {nft.keywords_detected.economic.length > 0 && (
                      <div>
                        <span className="text-sm font-medium text-yellow-600">⭐ Economic:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {nft.keywords_detected.economic.map((kw, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">{kw}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {nft.all_traits && Object.keys(nft.all_traits).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">🎨 All Traits</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(nft.all_traits).map(([key, value]) => (
                        <div key={key} className="p-2 bg-muted rounded">
                          <div className="text-xs text-muted-foreground">{key}</div>
                          <div className="text-sm font-medium">{String(value)}</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Battle History Tab */}
            <TabsContent value="battles" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">⚔️ Battle Statistics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-muted rounded">
                      <div className="text-sm text-muted-foreground">Battles</div>
                      <div className="text-2xl font-bold">{nft.battles_participated || 0}</div>
                    </div>
                    <div className="p-3 bg-muted rounded">
                      <div className="text-sm text-muted-foreground">Win Rate</div>
                      <div className="text-2xl font-bold text-green-600">{winRate}%</div>
                    </div>
                    <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded">
                      <div className="text-sm text-muted-foreground">Victories</div>
                      <div className="text-2xl font-bold text-green-600">{nft.battles_won || 0}</div>
                    </div>
                    <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded">
                      <div className="text-sm text-muted-foreground">Defeats</div>
                      <div className="text-2xl font-bold text-red-600">{nft.battles_lost || 0}</div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Total Damage Dealt</span>
                      <span className="text-sm font-bold text-orange-600">{nft.total_damage_dealt || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Total Damage Taken</span>
                      <span className="text-sm font-bold text-purple-600">{nft.total_damage_taken || 0}</span>
                    </div>
                  </div>

                  {(nft.battles_participated || 0) === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="text-sm">No battles yet</p>
                      <p className="text-xs mt-1">This NFT hasn't entered combat</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Owner Info Tab */}
            <TabsContent value="owner" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">👤 Owner Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Wallet Address</div>
                    <div className="p-2 bg-muted rounded font-mono text-sm break-all">
                      {nft.owner_address}
                    </div>
                  </div>

                  {nft.collection_name && (
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Collection</div>
                      <Badge variant="secondary">{nft.collection_name}</Badge>
                    </div>
                  )}

                  <Separator />

                  <div>
                    <div className="text-sm text-muted-foreground mb-2">NFT ID</div>
                    <div className="p-2 bg-muted rounded font-mono text-xs break-all">
                      {nft.id}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {nft.metadata && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">📄 Metadata</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-60">
                      {JSON.stringify(nft.metadata, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
