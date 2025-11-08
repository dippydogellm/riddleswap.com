import { useState, useCallback, useRef } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Upload, 
  Image as ImageIcon, 
  FileText, 
  CheckCircle, 
  XCircle, 
  Loader2,
  ArrowLeft,
  Plus,
  X,
  AlertCircle,
  Rocket
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiRequest } from '@/lib/queryClient';

interface UploadedImage {
  file: File;
  preview: string;
  name?: string;
  description?: string;
  attributes?: Array<{ trait_type: string; value: string }>;
}

interface ProjectData {
  id: number;
  name: string;
  description: string;
  category: string;
  chain: string;
  status: string;
}

interface ProcessStep {
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  message?: string;
  progress?: number;
}

export default function NFTLaunchpadCreate() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('setup');
  
  // Project Configuration
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [category, setCategory] = useState('art');
  const [royaltyPercent, setRoyaltyPercent] = useState('5');
  const [taxon, setTaxon] = useState('');
  const [taxonStatus, setTaxonStatus] = useState<'idle' | 'checking' | 'available' | 'unavailable'>('idle');
  const [taxonError, setTaxonError] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  
  // Image Upload State
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [currentMetadataIndex, setCurrentMetadataIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  
  // Attributes State
  const [attributes, setAttributes] = useState<Array<{ trait_type: string; value: string }>>([]);
  
  // Project and Process State
  const [project, setProject] = useState<ProjectData | null>(null);
  const [processSteps, setProcessSteps] = useState<ProcessStep[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);

  const updateStep = (stepName: string, updates: Partial<ProcessStep>) => {
    setProcessSteps(prev => {
      const existing = prev.find(s => s.name === stepName);
      if (existing) {
        return prev.map(s => s.name === stepName ? { ...s, ...updates } : s);
      } else {
        return [...prev, { name: stepName, status: 'pending', ...updates }];
      }
    });
  };

  const validateTaxon = async (value: string) => {
    if (!value) {
      setTaxonStatus('idle');
      setTaxonError('');
      return;
    }

    const taxonNum = parseInt(value);
    if (isNaN(taxonNum) || taxonNum < 0 || taxonNum > 4294967295) {
      setTaxonStatus('unavailable');
      setTaxonError('Taxon must be between 0 and 4,294,967,295');
      return;
    }

    setTaxonStatus('checking');
    setTaxonError('');

    try {
      const response = await fetch('/api/nft-projects/validate-taxon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taxon: taxonNum })
      });

      const data = await response.json() as any;

      if (data.available) {
        setTaxonStatus('available');
        setTaxonError('');
      } else {
        setTaxonStatus('unavailable');
        setTaxonError(data.error || 'Taxon is not available');
      }
    } catch (error) {
      setTaxonStatus('unavailable');
      setTaxonError('Failed to validate taxon');
    }
  };

  const handleTaxonChange = (value: string) => {
    setTaxon(value);
    const debounceTimer = setTimeout(() => validateTaxon(value), 500);
    return () => clearTimeout(debounceTimer);
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'File Too Large',
          description: 'Logo must be less than 5MB',
          variant: 'destructive'
        });
        return;
      }
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const validateImage = (file: File): string | null => {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      return 'Only JPG, PNG, GIF, and WEBP images are supported';
    }
    if (file.size > 10 * 1024 * 1024) {
      return 'Image must be less than 10MB';
    }
    return null;
  };

  const processFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const newImages: UploadedImage[] = [];
    
    for (const file of fileArray) {
      const error = validateImage(file);
      if (error) {
        toast({
          title: 'Invalid File',
          description: `${file.name}: ${error}`,
          variant: 'destructive'
        });
        continue;
      }
      
      const preview = URL.createObjectURL(file);
      newImages.push({ 
        file, 
        preview,
        name: `${projectName || 'NFT'} #${images.length + newImages.length + 1}`,
        description: projectDescription || ''
      });
    }
    
    setImages(prev => [...prev, ...newImages]);
    
    if (newImages.length > 0) {
      toast({
        title: 'Images Added',
        description: `${newImages.length} image(s) ready to upload`
      });
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await processFiles(files);
    }
  }, [projectName, projectDescription, images.length]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await processFiles(files);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  };

  const updateMetadata = (index: number, field: keyof UploadedImage, value: any) => {
    setImages(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addAttribute = () => {
    setAttributes(prev => [...prev, { trait_type: '', value: '' }]);
  };

  const updateAttribute = (index: number, field: 'trait_type' | 'value', value: string) => {
    setAttributes(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const removeAttribute = (index: number) => {
    setAttributes(prev => {
      const updated = [...prev];
      updated.splice(index, 1);
      return updated;
    });
  };

  const applyAttributesToCurrent = () => {
    if (attributes.length > 0) {
      updateMetadata(currentMetadataIndex, 'attributes', [...attributes]);
      toast({
        title: 'Attributes Applied',
        description: `Added ${attributes.length} attributes to ${images[currentMetadataIndex]?.name}`
      });
    }
  };

  // NEW API FLOW - Complete Launch Process
  const launchProject = async () => {
    if (!projectName || !projectDescription) {
      toast({
        title: 'Missing Information',
        description: 'Please provide project name and description',
        variant: 'destructive'
      });
      return;
    }

    if (!taxon) {
      toast({
        title: 'Missing Taxon',
        description: 'Please provide a taxon number for your XRPL collection',
        variant: 'destructive'
      });
      return;
    }

    if (taxonStatus !== 'available') {
      toast({
        title: 'Invalid Taxon',
        description: taxonError || 'Please ensure taxon is valid and available',
        variant: 'destructive'
      });
      return;
    }

    if (images.length === 0) {
      toast({
        title: 'No Images',
        description: 'Please add at least one image',
        variant: 'destructive'
      });
      return;
    }

    setIsProcessing(true);
    setProcessSteps([]);
    setOverallProgress(0);

    try {
      // STEP 1: Create Project with Logo and Taxon
      updateStep('create', { status: 'processing', message: 'Creating NFT project...' });
      
      const formData = new FormData();
      formData.append('projectName', projectName);
      formData.append('projectDescription', projectDescription);
      formData.append('collectionName', projectName);
      formData.append('collectionSymbol', category.toUpperCase().slice(0, 4));
      formData.append('chainType', 'xrpl');
      formData.append('taxon', taxon);
      formData.append('totalSupply', images.length.toString());
      formData.append('royaltyPercentage', royaltyPercent);
      
      if (logoFile) {
        formData.append('logo', logoFile);
      }

      const createRes = await fetch('/api/nft-projects', {
        method: 'POST',
        body: formData
      });

      if (!createRes.ok) {
        throw new Error('Failed to create project');
      }

      const { project: createdProject } = await createRes.json();
      setProject(createdProject);
      
      updateStep('create', { status: 'completed', message: `Project #${createdProject.id} created` });
      setOverallProgress(20);

      // STEP 2: Upload Assets (Images + Metadata)
      updateStep('upload', { status: 'processing', message: 'Uploading images and metadata...', progress: 0 });
      
      const assetsFormData = new FormData();
      
      // Add images
      images.forEach((img, index) => {
        assetsFormData.append('files', img.file);
      });

      // Add metadata files as JSON blobs
      images.forEach((img, index) => {
        const metadata = {
          name: img.name || `${projectName} #${index + 1}`,
          description: img.description || projectDescription,
          image: `image_${index}`, // Will be replaced after IPFS upload
          attributes: img.attributes || []
        };
        const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
        assetsFormData.append('files', metadataBlob, `metadata_${index}.json`);
      });

      const uploadRes = await fetch(`/api/nft-projects/${createdProject.id}/upload-assets`, {
        method: 'POST',
        body: assetsFormData
      });

      if (!uploadRes.ok) {
        throw new Error('Failed to upload assets');
      }

      const uploadData = await uploadRes.json();
      
      updateStep('upload', { 
        status: 'completed', 
        message: `Uploaded ${uploadData.imageCount} images and ${uploadData.metadataCount} metadata files`,
        progress: 100
      });
      setOverallProgress(40);

      // STEP 3: Validate Assets
      updateStep('validate', { status: 'processing', message: 'Validating all assets...' });
      
      const validateRes = await fetch(`/api/nft-projects/${createdProject.id}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assets: images.map((img, index) => ({
            name: img.name || `${projectName} #${index + 1}`,
            description: img.description || projectDescription,
            image: `placeholder_${index}`,
            attributes: img.attributes || []
          }))
        })
      });

      if (!validateRes.ok) throw new Error('Validation failed');
      const validateData = await validateRes.json();

      updateStep('validate', { 
        status: 'completed', 
        message: `${validateData.assetCount} assets validated successfully` 
      });
      setOverallProgress(60);

      // STEP 4: Pin to IPFS
      updateStep('ipfs', { status: 'processing', message: 'Pinning assets to IPFS...', progress: 0 });
      
      const pinRes = await fetch(`/api/nft-projects/${createdProject.id}/pin-ipfs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assets: uploadData.assets || []
        })
      });

      if (!pinRes.ok) throw new Error('IPFS pinning failed');
      const pinData = await pinRes.json();

      updateStep('ipfs', { 
        status: 'completed', 
        message: `${pinData.pinnedCount || 'All'} assets pinned to IPFS`,
        progress: 100
      });
      setOverallProgress(70);

      // STEP 5: Payment to Riddle Bank
      const totalSupply = images.length;
      const setupFee = 1;
      const perNftFee = 0.01 * totalSupply;
      const totalPayment = setupFee + perNftFee;

      updateStep('payment', { 
        status: 'processing', 
        message: `Processing payment: ${totalPayment} XRP to Riddle Bank...` 
      });

      const paymentRes = await fetch(`/api/nft-projects/${createdProject.id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!paymentRes.ok) {
        const errorData = await paymentRes.json();
        throw new Error(errorData.error || 'Payment failed');
      }
      const paymentData = await paymentRes.json();

      updateStep('payment', { 
        status: 'completed', 
        message: `Paid ${paymentData.amount} XRP${paymentData.txHash ? ` - TX: ${paymentData.txHash.substring(0, 8)}...` : ''}` 
      });
      setOverallProgress(85);

      // STEP 6: Mint on XRPL
      updateStep('mint', { status: 'processing', message: 'Minting NFTs on XRPL...', progress: 0 });
      
      const royaltyFee = Math.floor(parseFloat(royaltyPercent) * 100); // Convert to basis points
      
      const mintRes = await fetch(`/api/nft-projects/${createdProject.id}/launch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transferFee: royaltyFee
        })
      });

      if (!mintRes.ok) throw new Error('Minting failed');
      const mintData = await mintRes.json();

      updateStep('mint', { 
        status: 'completed', 
        message: `${mintData.mintedCount || images.length} NFTs minted successfully`,
        progress: 100
      });
      setOverallProgress(100);

      // Success!
      toast({
        title: '🎉 Launch Complete!',
        description: `Successfully minted ${mintData.mintedCount || images.length} NFTs on XRPL`
      });

      // Move to review tab after delay
      setTimeout(() => {
        setActiveTab('review');
      }, 2000);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Launch failed';
      
      updateStep('error', { 
        status: 'error', 
        message: errorMessage 
      });
      
      toast({
        title: 'Launch Failed',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const currentImage = images[currentMetadataIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/riddlepad')}
              className="mb-4"
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Launchpad
            </Button>
            <h1 className="text-4xl font-bold text-white">Create NFT Project</h1>
            <p className="text-gray-400 mt-2">Launch your NFT collection on XRPL</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-gray-800/50">
            <TabsTrigger value="setup" data-testid="tab-setup">
              1. Setup
            </TabsTrigger>
            <TabsTrigger value="images" data-testid="tab-images">
              2. Images
            </TabsTrigger>
            <TabsTrigger value="metadata" data-testid="tab-metadata">
              3. Metadata
            </TabsTrigger>
            <TabsTrigger value="launch" data-testid="tab-launch">
              4. Launch
            </TabsTrigger>
          </TabsList>

          {/* Setup Tab */}
          <TabsContent value="setup" className="space-y-6">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Project Configuration</CardTitle>
                <CardDescription>Basic information about your NFT collection</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-white">Project Name</Label>
                    <Input
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder="My Awesome NFT Collection"
                      className="bg-gray-900 border-gray-600 text-white"
                      data-testid="input-project-name"
                    />
                  </div>
                  <div>
                    <Label className="text-white">Category</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="bg-gray-900 border-gray-600 text-white" data-testid="select-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="art">Art</SelectItem>
                        <SelectItem value="gaming">Gaming</SelectItem>
                        <SelectItem value="music">Music</SelectItem>
                        <SelectItem value="utility">Utility</SelectItem>
                        <SelectItem value="pfp">PFP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-white">Description</Label>
                  <Textarea
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    placeholder="Describe your NFT collection..."
                    rows={4}
                    className="bg-gray-900 border-gray-600 text-white"
                    data-testid="textarea-description"
                  />
                </div>

                <div>
                  <Label className="text-white">Taxon Number (XRPL Collection ID)</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      min="0"
                      max="4294967295"
                      value={taxon}
                      onChange={(e) => handleTaxonChange(e.target.value)}
                      placeholder="Enter taxon number (0-4,294,967,295)"
                      className={`bg-gray-900 border-gray-600 text-white pr-10 ${
                        taxonStatus === 'available' ? 'border-green-500' : 
                        taxonStatus === 'unavailable' ? 'border-red-500' : ''
                      }`}
                      data-testid="input-taxon"
                    />
                    {taxonStatus === 'checking' && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
                    )}
                    {taxonStatus === 'available' && (
                      <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                    )}
                    {taxonStatus === 'unavailable' && (
                      <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" />
                    )}
                  </div>
                  {taxonError && (
                    <p className="text-xs text-red-400 mt-1">{taxonError}</p>
                  )}
                  {taxonStatus === 'available' && (
                    <p className="text-xs text-green-400 mt-1">✓ Taxon is available</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    Unique identifier for your NFT collection on XRPL. Will be validated against your connected wallet.
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-white">Royalty Percentage</Label>
                    <Input
                      type="number"
                      min="0"
                      max="50"
                      step="0.1"
                      value={royaltyPercent}
                      onChange={(e) => setRoyaltyPercent(e.target.value)}
                      placeholder="5"
                      className="bg-gray-900 border-gray-600 text-white"
                      data-testid="input-royalty"
                    />
                    <p className="text-xs text-gray-400 mt-1">Royalty on secondary sales (0-50%)</p>
                  </div>
                  <div>
                    <Label className="text-white">Collection Logo (Optional)</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => logoInputRef.current?.click()}
                        className="flex-1"
                        data-testid="button-upload-logo"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {logoFile ? 'Change Logo' : 'Upload Logo'}
                      </Button>
                      {logoPreview && (
                        <img src={logoPreview} alt="Logo" className="h-10 w-10 rounded object-cover" />
                      )}
                    </div>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoSelect}
                      className="hidden"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button 
                    onClick={() => setActiveTab('images')}
                    disabled={!projectName || !projectDescription || !taxon || taxonStatus !== 'available'}
                    data-testid="button-next-images"
                  >
                    Next: Add Images
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Images Tab */}
          <TabsContent value="images" className="space-y-6">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Upload Images</CardTitle>
                <CardDescription>Add your NFT artwork (Max 10MB per image)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Drop Zone */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                    isDragging
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-gray-600 bg-gray-900/50'
                  }`}
                >
                  <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-300 mb-2">Drag and drop images here</p>
                  <p className="text-sm text-gray-500 mb-4">or</p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="button-browse-files"
                  >
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Browse Files
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>

                {/* Image Grid */}
                {images.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {images.map((img, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={img.preview}
                          alt={`Upload ${index + 1}`}
                          className="w-full aspect-square object-cover rounded-lg"
                        />
                        <Button
                          size="sm"
                          variant="destructive"
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeImage(index)}
                          data-testid={`button-remove-image-${index}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <div className="absolute bottom-2 left-2 right-2 bg-black/70 rounded px-2 py-1">
                          <p className="text-xs text-white truncate">{img.name}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {images.length > 0 && (
                  <div className="flex items-center justify-between bg-gray-900/50 p-4 rounded-lg">
                    <div className="text-white">
                      <p className="font-medium">{images.length} images ready</p>
                      <p className="text-sm text-gray-400">Total collection size</p>
                    </div>
                    <Button 
                      onClick={() => setActiveTab('metadata')}
                      data-testid="button-next-metadata"
                    >
                      Next: Add Metadata
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Metadata Tab */}
          <TabsContent value="metadata" className="space-y-6">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">NFT Metadata</CardTitle>
                <CardDescription>
                  Configure name, description, and attributes for each NFT
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {images.length > 0 && currentImage ? (
                  <>
                    {/* Navigation */}
                    <div className="flex items-center justify-between mb-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentMetadataIndex(Math.max(0, currentMetadataIndex - 1))}
                        disabled={currentMetadataIndex === 0}
                        data-testid="button-prev-nft"
                      >
                        Previous
                      </Button>
                      <span className="text-white">
                        NFT {currentMetadataIndex + 1} of {images.length}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentMetadataIndex(Math.min(images.length - 1, currentMetadataIndex + 1))}
                        disabled={currentMetadataIndex === images.length - 1}
                        data-testid="button-next-nft"
                      >
                        Next
                      </Button>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <img
                          src={currentImage.preview}
                          alt="NFT Preview"
                          className="w-full rounded-lg mb-4"
                        />
                      </div>
                      <div className="space-y-4">
                        <div>
                          <Label className="text-white">NFT Name</Label>
                          <Input
                            value={currentImage.name || ''}
                            onChange={(e) => updateMetadata(currentMetadataIndex, 'name', e.target.value)}
                            placeholder="Enter NFT name"
                            className="bg-gray-900 border-gray-600 text-white"
                            data-testid="input-nft-name"
                          />
                        </div>
                        <div>
                          <Label className="text-white">Description</Label>
                          <Textarea
                            value={currentImage.description || ''}
                            onChange={(e) => updateMetadata(currentMetadataIndex, 'description', e.target.value)}
                            placeholder="Enter description"
                            rows={3}
                            className="bg-gray-900 border-gray-600 text-white"
                            data-testid="textarea-nft-description"
                          />
                        </div>

                        {/* Attributes */}
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <Label className="text-white">Attributes</Label>
                            <Button size="sm" variant="outline" onClick={addAttribute} data-testid="button-add-attribute">
                              <Plus className="h-4 w-4 mr-1" />
                              Add
                            </Button>
                          </div>
                          <div className="space-y-2">
                            {attributes.map((attr, index) => (
                              <div key={index} className="flex gap-2">
                                <Input
                                  placeholder="Trait"
                                  value={attr.trait_type}
                                  onChange={(e) => updateAttribute(index, 'trait_type', e.target.value)}
                                  className="flex-1 bg-gray-900 border-gray-600 text-white"
                                  data-testid={`input-trait-${index}`}
                                />
                                <Input
                                  placeholder="Value"
                                  value={attr.value}
                                  onChange={(e) => updateAttribute(index, 'value', e.target.value)}
                                  className="flex-1 bg-gray-900 border-gray-600 text-white"
                                  data-testid={`input-value-${index}`}
                                />
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removeAttribute(index)}
                                  data-testid={`button-remove-attribute-${index}`}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                          {attributes.length > 0 && (
                            <Button 
                              size="sm" 
                              className="mt-2 w-full" 
                              onClick={applyAttributesToCurrent}
                              data-testid="button-apply-attributes"
                            >
                              Apply to {currentImage.name}
                            </Button>
                          )}
                        </div>

                        {/* Show applied attributes */}
                        {currentImage.attributes && currentImage.attributes.length > 0 && (
                          <div className="bg-gray-900/50 p-3 rounded-lg">
                            <p className="text-sm text-gray-400 mb-2">Applied Attributes:</p>
                            <div className="flex flex-wrap gap-2">
                              {currentImage.attributes.map((attr, idx) => (
                                <Badge key={idx} variant="secondary">
                                  {attr.trait_type}: {attr.value}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button 
                        onClick={() => setActiveTab('launch')}
                        data-testid="button-next-launch"
                      >
                        Next: Launch Project
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12">
                    <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-400">No images uploaded yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Launch Tab */}
          <TabsContent value="launch" className="space-y-6">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Launch Your Collection</CardTitle>
                <CardDescription>
                  Review and launch your NFT project on XRPL
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Summary */}
                <div className="bg-gray-900/50 p-4 rounded-lg space-y-2">
                  <h3 className="text-lg font-semibold text-white mb-3">Project Summary</h3>
                  <div className="grid md:grid-cols-2 gap-2 text-sm">
                    <div className="text-gray-400">Name:</div>
                    <div className="text-white">{projectName}</div>
                    
                    <div className="text-gray-400">Description:</div>
                    <div className="text-white">{projectDescription}</div>
                    
                    <div className="text-gray-400">Category:</div>
                    <div className="text-white capitalize">{category}</div>
                    
                    <div className="text-gray-400">Total Supply:</div>
                    <div className="text-white">{images.length} NFTs</div>
                    
                    <div className="text-gray-400">Royalty:</div>
                    <div className="text-white">{royaltyPercent}%</div>
                    
                    <div className="text-gray-400">Blockchain:</div>
                    <div className="text-white">XRPL</div>
                  </div>
                </div>

                {/* Progress Steps */}
                {processSteps.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold text-white">Launch Progress</h3>
                      <span className="text-sm text-gray-400">{overallProgress}%</span>
                    </div>
                    <Progress value={overallProgress} className="h-2" />
                    
                    <div className="space-y-2">
                      {processSteps.map((step, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg">
                          {step.status === 'processing' && (
                            <Loader2 className="h-5 w-5 text-purple-500 animate-spin" />
                          )}
                          {step.status === 'completed' && (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          )}
                          {step.status === 'error' && (
                            <XCircle className="h-5 w-5 text-red-500" />
                          )}
                          {step.status === 'pending' && (
                            <div className="h-5 w-5 rounded-full border-2 border-gray-600" />
                          )}
                          <div className="flex-1">
                            <p className="text-white font-medium capitalize">{step.name}</p>
                            {step.message && (
                              <p className="text-sm text-gray-400">{step.message}</p>
                            )}
                          </div>
                          {step.progress !== undefined && step.status === 'processing' && (
                            <span className="text-sm text-gray-400">{step.progress}%</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Launch Button */}
                <div className="flex justify-end">
                  <Button
                    size="lg"
                    onClick={launchProject}
                    disabled={isProcessing || images.length === 0}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                    data-testid="button-launch"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Launching...
                      </>
                    ) : (
                      <>
                        <Rocket className="h-5 w-5 mr-2" />
                        Launch Project
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
