import { useState, useRef, useCallback } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, 
  Upload, 
  Package, 
  CheckCircle, 
  Loader2,
  FileImage,
  FileJson,
  Rocket,
  AlertCircle,
  Download,
  RefreshCw
} from 'lucide-react';

interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  attributes?: Array<{ trait_type: string; value: string }>;
}

interface UploadedFile {
  file: File;
  preview?: string;
  uploaded: boolean;
  ipfsUrl?: string;
  error?: string;
}

export default function LaunchNFTCollection() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const metadataInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [collectionName, setCollectionName] = useState('');
  const [collectionDescription, setCollectionDescription] = useState('');
  const [chain, setChain] = useState('xrpl');
  const [royaltyPercent, setRoyaltyPercent] = useState('5');
  const [taxon, setTaxon] = useState('');
  const [uploadMethod, setUploadMethod] = useState<'images' | 'metadata'>('images');
  
  // Upload state
  const [images, setImages] = useState<UploadedFile[]>([]);
  const [metadataFiles, setMetadataFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  
  // Process state
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [uploadedCount, setUploadedCount] = useState(0);

  const chains = [
    { value: 'xrpl', label: 'XRPL', icon: '🔷' },
    { value: 'ethereum', label: 'Ethereum', icon: '⟠' },
    { value: 'polygon', label: 'Polygon', icon: '🟣' },
    { value: 'solana', label: 'Solana', icon: '🟣' },
    { value: 'base', label: 'Base', icon: '🔵' },
  ];

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (uploadMethod === 'images') {
      handleImageFiles(files.filter(f => f.type.startsWith('image/')));
    } else {
      handleMetadataFiles(files.filter(f => f.name.endsWith('.json')));
    }
  }, [uploadMethod]);

  const handleImageFiles = (files: File[]) => {
    const newImages = files.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      uploaded: false
    }));
    setImages(prev => [...prev, ...newImages]);
  };

  const handleMetadataFiles = (files: File[]) => {
    setMetadataFiles(prev => [...prev, ...files]);
  };

  const handleImageInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleImageFiles(Array.from(e.target.files));
    }
  };

  const handleMetadataInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleMetadataFiles(Array.from(e.target.files));
    }
  };

  const downloadMetadataTemplate = () => {
    const template = {
      name: "NFT Name #1",
      description: "Description of NFT #1",
      image: "ipfs://...", // Will be filled automatically
      attributes: [
        { trait_type: "Background", value: "Blue" },
        { trait_type: "Rarity", value: "Common" }
      ]
    };

    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nft-metadata-template.json';
    a.click();
  };

  const validateCollection = () => {
    if (!collectionName) {
      toast({ title: 'Collection name required', variant: 'destructive' });
      return false;
    }
    if (uploadMethod === 'images' && images.length === 0) {
      toast({ title: 'Upload at least one image', variant: 'destructive' });
      return false;
    }
    if (uploadMethod === 'metadata' && metadataFiles.length === 0) {
      toast({ title: 'Upload at least one metadata file', variant: 'destructive' });
      return false;
    }
    if (chain === 'xrpl' && !taxon) {
      toast({ title: 'Taxon required for XRPL', variant: 'destructive' });
      return false;
    }
    return true;
  };

  const processImageUpload = async () => {
    if (!validateCollection()) return;

    setIsProcessing(true);
    setProgress(0);
    setUploadedCount(0);

    try {
      setCurrentStep('Uploading images to IPFS...');
      
      // Upload images in batches of 10
      const batchSize = 10;
      const batches = [];
      for (let i = 0; i < images.length; i += batchSize) {
        batches.push(images.slice(i, i + batchSize));
      }

      const allIpfsUrls: string[] = [];

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const formData = new FormData();
        
        batch.forEach((img, idx) => {
          formData.append('images', img.file);
        });

        const response = await fetch('/api/launchpad/ipfs/upload-images', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          throw new Error('Failed to upload images batch');
        }

        const data = await response.json() as any;
        allIpfsUrls.push(...data.uploads.map((u: any) => u.url));
        
        setUploadedCount(prev => prev + batch.length);
        setProgress(Math.round(((batchIndex + 1) / batches.length) * 50));
      }

      // Generate and upload metadata
      setCurrentStep('Creating metadata...');
      
      const metadataArray = allIpfsUrls.map((imageUrl, index) => ({
        name: `${collectionName} #${index + 1}`,
        description: collectionDescription,
        image: imageUrl,
        attributes: []
      }));

      // Upload metadata to IPFS
      const metadataUploads = [];
      for (let i = 0; i < metadataArray.length; i++) {
        const response = await fetch('/api/launchpad/ipfs/upload-metadata', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(metadataArray[i])
        });

        const data = await response.json() as any;
        metadataUploads.push(data.url);
        
        setProgress(50 + Math.round(((i + 1) / metadataArray.length) * 30));
      }

      // Queue minting
      setCurrentStep('Queueing NFTs for minting...');
      
      const mintPayload = {
        projectName: collectionName,
        chain,
        uris: metadataUploads,
        taxon: chain === 'xrpl' ? parseInt(taxon) : undefined,
        transferFee: parseInt(royaltyPercent) * 1000
      };

      const mintResponse = await fetch('/api/nft/batch-mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mintPayload)
      });

      if (!mintResponse.ok) {
        throw new Error('Failed to queue minting');
      }

      setProgress(100);
      toast({
        title: 'Collection Created! 🎉',
        description: `${images.length} NFTs queued for minting`
      });

      setTimeout(() => {
        setLocation('/nft-marketplace');
      }, 2000);

    } catch (error) {
      console.error('Collection upload error:', error);
      toast({
        title: 'Upload Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const processMetadataUpload = async () => {
    if (!validateCollection()) return;

    setIsProcessing(true);
    setProgress(0);

    try {
      setCurrentStep('Parsing metadata files...');
      
      const metadataArray: NFTMetadata[] = [];
      
      for (const file of metadataFiles) {
        const text = await file.text();
        const json = JSON.parse(text);
        metadataArray.push(json);
      }

      setProgress(30);

      // Verify and download images from metadata
      setCurrentStep('Downloading and re-uploading images...');
      
      const imageUrls = metadataArray.map(m => m.image);
      const reuploadedUrls: string[] = [];

      for (let i = 0; i < imageUrls.length; i++) {
        const imageUrl = imageUrls[i];
        
        // Download image
        const imgResponse = await fetch(imageUrl);
        const blob = await imgResponse.blob();
        
        // Re-upload to IPFS
        const formData = new FormData();
        formData.append('image', blob, `nft-${i}.png`);

        const uploadResponse = await fetch('/api/launchpad/ipfs/upload-image', {
          method: 'POST',
          body: formData
        });

        const uploadData = await uploadResponse.json();
        reuploadedUrls.push(uploadData.url);
        
        setProgress(30 + Math.round(((i + 1) / imageUrls.length) * 40));
      }

      // Update metadata with new image URLs and upload
      setCurrentStep('Uploading metadata to IPFS...');
      
      const finalMetadataUrls: string[] = [];
      
      for (let i = 0; i < metadataArray.length; i++) {
        const metadata = { ...metadataArray[i], image: reuploadedUrls[i] };
        
        const response = await fetch('/api/launchpad/ipfs/upload-metadata', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(metadata)
        });

        const data = await response.json() as any;
        finalMetadataUrls.push(data.url);
        
        setProgress(70 + Math.round(((i + 1) / metadataArray.length) * 20));
      }

      // Queue minting
      setCurrentStep('Queueing NFTs for minting...');
      
      const mintPayload = {
        projectName: collectionName,
        chain,
        uris: finalMetadataUrls,
        taxon: chain === 'xrpl' ? parseInt(taxon) : undefined,
        transferFee: parseInt(royaltyPercent) * 1000
      };

      await fetch('/api/nft/batch-mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mintPayload)
      });

      setProgress(100);
      toast({
        title: 'Collection Created! 🎉',
        description: `${metadataFiles.length} NFTs queued for minting`
      });

      setTimeout(() => {
        setLocation('/nft-marketplace');
      }, 2000);

    } catch (error) {
      console.error('Metadata processing error:', error);
      toast({
        title: 'Processing Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 p-6">
      <div className="max-w-6xl mx-auto">
        <Button
          variant="ghost"
          className="mb-6 text-slate-400 hover:text-white"
          onClick={() => setLocation('/launch')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Launch Options
        </Button>

        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500">
                <Package className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-white text-2xl">NFT Collection Launch</CardTitle>
                <CardDescription>Upload and mint your entire NFT collection</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Collection Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-white">Collection Name *</Label>
                <Input
                  value={collectionName}
                  onChange={(e) => setCollectionName(e.target.value)}
                  placeholder="My NFT Collection"
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white">Blockchain</Label>
                <Select value={chain} onValueChange={setChain}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {chains.map(c => (
                      <SelectItem key={c.value} value={c.value} className="text-white">
                        {c.icon} {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-white">Collection Description</Label>
              <Textarea
                value={collectionDescription}
                onChange={(e) => setCollectionDescription(e.target.value)}
                placeholder="Describe your collection..."
                className="bg-slate-800 border-slate-700 text-white min-h-[80px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-white">Royalty %</Label>
                <Input
                  type="number"
                  value={royaltyPercent}
                  onChange={(e) => setRoyaltyPercent(e.target.value)}
                  min="0"
                  max="50"
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>

              {chain === 'xrpl' && (
                <div className="space-y-2">
                  <Label className="text-white">Taxon (XRPL) *</Label>
                  <Input
                    type="number"
                    value={taxon}
                    onChange={(e) => setTaxon(e.target.value)}
                    placeholder="0"
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
              )}
            </div>

            {/* Upload Method Tabs */}
            <Tabs value={uploadMethod} onValueChange={(v) => setUploadMethod(v as any)} className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-slate-800">
                <TabsTrigger value="images">
                  <FileImage className="mr-2 h-4 w-4" />
                  Upload Images
                </TabsTrigger>
                <TabsTrigger value="metadata">
                  <FileJson className="mr-2 h-4 w-4" />
                  Upload Metadata
                </TabsTrigger>
              </TabsList>

              <TabsContent value="images" className="space-y-4 mt-4">
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 hover:border-blue-500'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => imageInputRef.current?.click()}
                >
                  <Upload className="h-12 w-12 text-slate-500 mx-auto mb-2" />
                  <p className="text-slate-400">Drag & drop images or click to upload</p>
                  <p className="text-sm text-slate-500 mt-1">Supports multiple files</p>
                </div>

                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageInput}
                />

                {images.length > 0 && (
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-white font-medium">{images.length} Images Selected</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setImages([])}
                        className="border-slate-700"
                      >
                        Clear All
                      </Button>
                    </div>
                    <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                      {images.slice(0, 12).map((img, idx) => (
                        <div key={idx} className="relative aspect-square">
                          <img
                            src={img.preview}
                            alt={`NFT ${idx + 1}`}
                            className="w-full h-full object-cover rounded-lg"
                          />
                          {img.uploaded && (
                            <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center rounded-lg">
                              <CheckCircle className="h-6 w-6 text-green-400" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {images.length > 12 && (
                      <p className="text-sm text-slate-400 mt-2">
                        +{images.length - 12} more files
                      </p>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="metadata" className="space-y-4 mt-4">
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-blue-300 text-sm mb-2">
                        Metadata files should include image URLs. Images will be verified and re-uploaded to IPFS.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={downloadMetadataTemplate}
                        className="border-blue-500/30 text-blue-400"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download Template
                      </Button>
                    </div>
                  </div>
                </div>

                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 hover:border-blue-500'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => metadataInputRef.current?.click()}
                >
                  <Upload className="h-12 w-12 text-slate-500 mx-auto mb-2" />
                  <p className="text-slate-400">Drag & drop JSON files or click to upload</p>
                  <p className="text-sm text-slate-500 mt-1">One JSON file per NFT</p>
                </div>

                <input
                  ref={metadataInputRef}
                  type="file"
                  accept=".json"
                  multiple
                  className="hidden"
                  onChange={handleMetadataInput}
                />

                {metadataFiles.length > 0 && (
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-white font-medium">{metadataFiles.length} Metadata Files</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setMetadataFiles([])}
                        className="border-slate-700"
                      >
                        Clear All
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {/* Processing Progress */}
            {isProcessing && (
              <div className="space-y-2 p-4 bg-slate-800/50 rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">{currentStep}</span>
                  <span className="text-blue-400">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
                {uploadedCount > 0 && (
                  <p className="text-xs text-slate-500">
                    Uploaded: {uploadedCount} / {uploadMethod === 'images' ? images.length : metadataFiles.length}
                  </p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                className="flex-1 border-slate-700 text-slate-300"
                onClick={() => setLocation('/launch')}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
                onClick={uploadMethod === 'images' ? processImageUpload : processMetadataUpload}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Rocket className="mr-2 h-4 w-4" />
                    Launch Collection
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
