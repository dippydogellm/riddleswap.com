import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Sparkles, 
  Image as ImageIcon, 
  Video, 
  RefreshCw, 
  Download, 
  Share2, 
  Coins,
  Plus,
  CheckCircle
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface GeneratedImage {
  id: number;
  url: string;
  prompt: string;
  revisedPrompt?: string;
  created_at: string;
  selected?: boolean;
}

interface VideoProject {
  id: number;
  project_name: string;
  image_count: number;
  price_xrp: number;
  status: string;
  video_url?: string;
}

export default function AIStudio() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'generate' | 'video' | 'nft'>('generate');
  const [prompt, setPrompt] = useState('');
  const [inputImageUrl, setInputImageUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [myImages, setMyImages] = useState<GeneratedImage[]>([]);
  const [selectedImages, setSelectedImages] = useState<number[]>([]);
  const [showVideoDialog, setShowVideoDialog] = useState(false);
  const [showNFTDialog, setShowNFTDialog] = useState(false);
  const [videoProjectName, setVideoProjectName] = useState('');
  const [videoPrompt, setVideoPrompt] = useState('');
  const [nftCollectionName, setNFTCollectionName] = useState('');
  const [nftDescription, setNFTDescription] = useState('');
  const [selectedSourceId, setSelectedSourceId] = useState<number>(0);
  
  useEffect(() => {
    loadMyImages();
  }, []);

  const loadMyImages = async () => {
    try {
      const userId = localStorage.getItem('riddle_session_token') || 'anonymous';
      const response = await fetch(`/api/ai-studio/my-images?userId=${userId}`);
      const data = await response.json() as any;
      
      if (data.success) {
        setMyImages(data.images);
      }
    } catch (error) {
      console.error('Failed to load images:', error);
    }
  };

  const handleGenerateImage = async () => {
    if (!prompt.trim()) {
      toast({
        title: 'Prompt Required',
        description: 'Please enter a description for your image',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    try {
      const userId = localStorage.getItem('riddle_session_token') || 'anonymous';
      const response = await fetch('/api/ai-studio/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          prompt,
          size: '1024x1024',
          quality: 'standard',
        }),
      });

      const data = await response.json() as any;
      
      if (data.success) {
        toast({
          title: '✨ Image Generated!',
          description: 'Your AI image has been created successfully',
        });
        setPrompt('');
        loadMyImages();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({
        title: 'Generation Failed',
        description: error.message || 'Failed to generate image',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEditImage = async () => {
    if (!prompt.trim()) {
      toast({
        title: 'Prompt Required',
        description: 'Please enter a description for your edit',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    try {
      const userId = localStorage.getItem('riddle_session_token') || 'anonymous';
      const response = await fetch('/api/ai-studio/edit-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          prompt,
          inputImageUrl: inputImageUrl || undefined,
          size: '1024x1024',
          quality: 'standard',
        }),
      });

      const data = await response.json() as any;
      
      if (data.success) {
        toast({
          title: '✏️ Image Edited!',
          description: inputImageUrl 
            ? 'Your image has been upgraded successfully' 
            : 'New image created from your prompt',
        });
        setPrompt('');
        setInputImageUrl('');
        loadMyImages();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({
        title: 'Edit Failed',
        description: error.message || 'Failed to edit image',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleImageSelection = (imageId: number) => {
    setSelectedImages(prev => 
      prev.includes(imageId) 
        ? prev.filter(id => id !== imageId)
        : [...prev, imageId]
    );
  };

  const calculateVideoPrice = (imageCount: number): number => {
    if (imageCount === 10) return 1;
    if (imageCount === 100) return 9;
    return imageCount * 0.1;
  };

  const handleCreateVideoProject = async () => {
    if (selectedImages.length === 0) {
      toast({
        title: 'No Images Selected',
        description: 'Please select at least one image for your video',
        variant: 'destructive',
      });
      return;
    }

    if (!videoProjectName.trim() || !videoPrompt.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please provide a project name and video prompt',
        variant: 'destructive',
      });
      return;
    }

    try {
      const userId = localStorage.getItem('riddle_session_token') || 'anonymous';
      const response = await fetch('/api/ai-studio/create-video-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          projectName: videoProjectName,
          videoPrompt,
          imageIds: selectedImages,
        }),
      });

      const data = await response.json() as any;
      
      if (data.success) {
        toast({
          title: '🎬 Video Project Created!',
          description: `Price: ${data.project.priceXRP} XRP for ${selectedImages.length} images`,
        });
        setShowVideoDialog(false);
        setVideoProjectName('');
        setVideoPrompt('');
        setSelectedImages([]);
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({
        title: 'Failed to Create Project',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleCreateNFTCollection = async () => {
    if (!nftCollectionName.trim()) {
      toast({
        title: 'Collection Name Required',
        description: 'Please enter a name for your NFT collection',
        variant: 'destructive',
      });
      return;
    }

    try {
      const userId = localStorage.getItem('riddle_session_token') || 'anonymous';
      const response = await fetch('/api/ai-studio/create-nft-collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          sourceType: 'image',
          sourceId: selectedSourceId,
          collectionName: nftCollectionName,
          collectionDescription: nftDescription,
          chain: 'xrpl',
        }),
      });

      const data = await response.json() as any;
      
      if (data.success) {
        toast({
          title: '🎨 NFT Collection Created!',
          description: 'Ready to create project in DevTools',
        });
        setShowNFTDialog(false);
        setNFTCollectionName('');
        setNFTDescription('');
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({
        title: 'Failed to Create Collection',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const openNFTDialog = (imageId: number) => {
    setSelectedSourceId(imageId);
    setShowNFTDialog(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            ✨ AI Studio
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Generate stunning images with AI, create videos with Sora, and mint as NFTs
          </p>
        </div>

        {/* Tabs */}
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button
            onClick={() => setActiveTab('generate')}
            variant={activeTab === 'generate' ? 'default' : 'outline'}
            className="w-full sm:w-auto"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Generate Images</span>
            <span className="sm:hidden">✨ Generate</span>
          </Button>
          <Button
            onClick={() => setActiveTab('video')}
            variant={activeTab === 'video' ? 'default' : 'outline'}
            className="w-full sm:w-auto"
          >
            <Video className="w-4 h-4 mr-2" />
            Create Video
          </Button>
          <Button
            onClick={() => setActiveTab('nft')}
            variant={activeTab === 'nft' ? 'default' : 'outline'}
          >
            <ImageIcon className="w-4 h-4 mr-2" />
            NFT Collections
          </Button>
        </div>

        {/* Generate Tab */}
        {activeTab === 'generate' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Input Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  Create AI Images (FREE)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Describe Your Image</Label>
                  <Textarea
                    placeholder="A majestic dragon flying over a fantasy castle at sunset..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={4}
                  />
                </div>
                
                <div>
                  <Label>Input Image URL (Optional - for editing)</Label>
                  <Input
                    placeholder="https://... (leave empty for new generation)"
                    value={inputImageUrl}
                    onChange={(e) => setInputImageUrl(e.target.value)}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleGenerateImage}
                    disabled={isGenerating}
                    className="flex-1"
                  >
                    {isGenerating ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate New
                      </>
                    )}
                  </Button>
                  
                  <Button
                    onClick={handleEditImage}
                    disabled={isGenerating}
                    variant="outline"
                    className="flex-1"
                  >
                    {isGenerating ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Editing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Edit/Upgrade
                      </>
                    )}
                  </Button>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    ✨ <strong>Free Forever!</strong> Generate and edit unlimited images
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* My Images Gallery */}
            <Card>
              <CardHeader>
                <CardTitle>Your AI Images ({myImages.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-[600px] overflow-y-auto">
                  {myImages.map((image) => (
                    <div key={image.id} className="relative group">
                      <img
                        src={image.url}
                        alt={image.prompt}
                        className="w-full aspect-square object-cover rounded-lg"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex flex-col items-center justify-center gap-2 p-2">
                        <p className="text-white text-xs text-center line-clamp-2">
                          {image.prompt}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => toggleImageSelection(image.id)}
                          >
                            {selectedImages.includes(image.id) ? (
                              <CheckCircle className="w-4 h-4" />
                            ) : (
                              <Plus className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => openNFTDialog(image.id)}
                          >
                            <Share2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      {selectedImages.includes(image.id) && (
                        <div className="absolute top-2 right-2">
                          <Badge className="bg-green-500">Selected</Badge>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Video Tab */}
        {activeTab === 'video' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="w-5 h-5" />
                Create Videos with Sora
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  🎬 <strong>Sora API Coming Soon!</strong> Select your images now and we'll generate your video when the API launches
                </p>
              </div>

              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {myImages.map((image) => (
                  <div
                    key={image.id}
                    className={`relative cursor-pointer ${
                      selectedImages.includes(image.id) ? 'ring-2 ring-green-500' : ''
                    }`}
                    onClick={() => toggleImageSelection(image.id)}
                  >
                    <img
                      src={image.url}
                      alt={image.prompt}
                      className="w-full aspect-square object-cover rounded-lg"
                    />
                    {selectedImages.includes(image.id) && (
                      <div className="absolute top-1 right-1">
                        <Badge className="bg-green-500 text-xs">✓</Badge>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {selectedImages.length > 0 && (
                <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div>
                    <p className="font-semibold">{selectedImages.length} images selected</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Price: <span className="text-green-600 font-bold">{calculateVideoPrice(selectedImages.length)} XRP</span>
                    </p>
                  </div>
                  <Button onClick={() => setShowVideoDialog(true)}>
                    <Video className="w-4 h-4 mr-2" />
                    Create Video Project
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* NFT Tab */}
        {activeTab === 'nft' && (
          <Card>
            <CardHeader>
              <CardTitle>Convert to NFT</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Select an image and convert it to an NFT collection on XRPL
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {myImages.map((image) => (
                  <div key={image.id} className="group relative">
                    <img
                      src={image.url}
                      alt={image.prompt}
                      className="w-full aspect-square object-cover rounded-lg"
                    />
                    <Button
                      className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      size="sm"
                      onClick={() => openNFTDialog(image.id)}
                    >
                      <Coins className="w-4 h-4 mr-2" />
                      Make NFT
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Video Project Dialog */}
      <Dialog open={showVideoDialog} onOpenChange={setShowVideoDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Video Project</DialogTitle>
            <DialogDescription>
              Configure your Sora video project. You'll pay {calculateVideoPrice(selectedImages.length)} XRP for {selectedImages.length} images.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Project Name</Label>
              <Input
                placeholder="My Amazing AI Video"
                value={videoProjectName}
                onChange={(e) => setVideoProjectName(e.target.value)}
              />
            </div>
            <div>
              <Label>Video Prompt</Label>
              <Textarea
                placeholder="Describe how you want the images to be animated..."
                value={videoPrompt}
                onChange={(e) => setVideoPrompt(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVideoDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateVideoProject}>
              Create Project ({calculateVideoPrice(selectedImages.length)} XRP)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* NFT Collection Dialog */}
      <Dialog open={showNFTDialog} onOpenChange={setShowNFTDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create NFT Collection</DialogTitle>
            <DialogDescription>
              Turn your AI art into an NFT collection that can be managed in DevTools
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Collection Name</Label>
              <Input
                placeholder="My AI Art Collection"
                value={nftCollectionName}
                onChange={(e) => setNFTCollectionName(e.target.value)}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                placeholder="Describe your NFT collection..."
                value={nftDescription}
                onChange={(e) => setNFTDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNFTDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateNFTCollection}>
              Create Collection & Go to DevTools
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
