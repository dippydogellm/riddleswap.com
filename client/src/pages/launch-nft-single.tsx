import { useState, useRef } from 'react';
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
import { 
  ArrowLeft, 
  Upload, 
  Image as ImageIcon, 
  CheckCircle, 
  Loader2,
  Plus,
  X,
  Rocket
} from 'lucide-react';

interface Attribute {
  trait_type: string;
  value: string;
}

export default function LaunchNFTSingle() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [nftName, setNftName] = useState('');
  const [nftDescription, setNftDescription] = useState('');
  const [chain, setChain] = useState('xrpl');
  const [royaltyPercent, setRoyaltyPercent] = useState('5');
  const [taxon, setTaxon] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  
  // Process state
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');

  const chains = [
    { value: 'xrpl', label: 'XRPL', icon: '🔷' },
    { value: 'ethereum', label: 'Ethereum', icon: '⟠' },
    { value: 'polygon', label: 'Polygon', icon: '🟣' },
    { value: 'solana', label: 'Solana', icon: '🟣' },
    { value: 'base', label: 'Base', icon: '🔵' },
    { value: 'arbitrum', label: 'Arbitrum', icon: '🔷' },
  ];

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Image must be under 10MB',
          variant: 'destructive'
        });
        return;
      }

      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const addAttribute = () => {
    setAttributes([...attributes, { trait_type: '', value: '' }]);
  };

  const updateAttribute = (index: number, field: 'trait_type' | 'value', value: string) => {
    const updated = [...attributes];
    updated[index][field] = value;
    setAttributes(updated);
  };

  const removeAttribute = (index: number) => {
    setAttributes(attributes.filter((_, i) => i !== index));
  };

  const validateForm = () => {
    if (!nftName) {
      toast({ title: 'Name required', description: 'Please enter an NFT name', variant: 'destructive' });
      return false;
    }
    if (!imageFile) {
      toast({ title: 'Image required', description: 'Please upload an image', variant: 'destructive' });
      return false;
    }
    if (chain === 'xrpl' && !taxon) {
      toast({ title: 'Taxon required', description: 'XRPL requires a taxon number', variant: 'destructive' });
      return false;
    }
    return true;
  };

  const handleMint = async () => {
    if (!validateForm()) return;

    setIsProcessing(true);
    setProgress(0);

    try {
      // Step 1: Upload image to IPFS
      setCurrentStep('Uploading image to IPFS...');
      setProgress(20);

      const imageFormData = new FormData();
      imageFormData.append('image', imageFile!);

      const imageResponse = await fetch('/api/launchpad/ipfs/upload-image', {
        method: 'POST',
        body: imageFormData
      });

      if (!imageResponse.ok) {
        throw new Error('Failed to upload image to IPFS');
      }

      const imageData = await imageResponse.json();
      setProgress(40);

      // Step 2: Upload metadata to IPFS
      setCurrentStep('Creating metadata...');

      const metadata = {
        name: nftName,
        description: nftDescription,
        image: imageData.url,
        attributes: attributes.filter(attr => attr.trait_type && attr.value)
      };

      const metadataResponse = await fetch('/api/launchpad/ipfs/upload-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metadata)
      });

      if (!metadataResponse.ok) {
        throw new Error('Failed to upload metadata to IPFS');
      }

      const metadataData = await metadataResponse.json();
      setProgress(60);

      // Step 3: Mint NFT on selected chain
      setCurrentStep('Minting NFT on blockchain...');

      const mintPayload = {
        chain,
        uri: metadataData.url,
        taxon: chain === 'xrpl' ? parseInt(taxon) : undefined,
        transferFee: parseInt(royaltyPercent) * 1000 // Convert % to basis points for XRPL
      };

      const mintResponse = await fetch('/api/nft/mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mintPayload)
      });

      if (!mintResponse.ok) {
        throw new Error('Failed to mint NFT');
      }

      const mintData = await mintResponse.json();
      setProgress(100);

      toast({
        title: 'NFT Minted Successfully! 🎉',
        description: `Your NFT has been minted on ${chain.toUpperCase()}`
      });

      // Redirect to NFT details or collection page
      setTimeout(() => {
        setLocation('/nft-marketplace');
      }, 2000);

    } catch (error) {
      console.error('Minting error:', error);
      toast({
        title: 'Minting Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
      setProgress(0);
      setCurrentStep('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 p-6">
      <div className="max-w-4xl mx-auto">
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
              <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
                <ImageIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-white text-2xl">1:1 NFT Launch</CardTitle>
                <CardDescription>Create a unique NFT with custom metadata</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Chain Selection */}
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

            {/* NFT Name */}
            <div className="space-y-2">
              <Label className="text-white">NFT Name *</Label>
              <Input
                value={nftName}
                onChange={(e) => setNftName(e.target.value)}
                placeholder="My Unique NFT"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label className="text-white">Description</Label>
              <Textarea
                value={nftDescription}
                onChange={(e) => setNftDescription(e.target.value)}
                placeholder="Describe your NFT..."
                className="bg-slate-800 border-slate-700 text-white min-h-[100px]"
              />
            </div>

            {/* Image Upload */}
            <div className="space-y-2">
              <Label className="text-white">NFT Image *</Label>
              <div
                className="border-2 border-dashed border-slate-700 rounded-lg p-8 text-center cursor-pointer hover:border-purple-500 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {imagePreview ? (
                  <div className="relative">
                    <img src={imagePreview} alt="Preview" className="max-h-64 mx-auto rounded-lg" />
                    <Button
                      size="sm"
                      variant="destructive"
                      className="absolute top-2 right-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        setImageFile(null);
                        setImagePreview('');
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div>
                    <Upload className="h-12 w-12 text-slate-500 mx-auto mb-2" />
                    <p className="text-slate-400">Click to upload image</p>
                    <p className="text-sm text-slate-500 mt-1">Max 10MB - PNG, JPG, GIF</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
            </div>

            {/* Royalty */}
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

            {/* Attributes */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-white">Attributes (Optional)</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addAttribute}
                  className="border-slate-700 text-slate-300"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Attribute
                </Button>
              </div>

              {attributes.map((attr, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder="Trait Type"
                    value={attr.trait_type}
                    onChange={(e) => updateAttribute(index, 'trait_type', e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                  <Input
                    placeholder="Value"
                    value={attr.value}
                    onChange={(e) => updateAttribute(index, 'value', e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeAttribute(index)}
                    className="text-slate-400 hover:text-red-400"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Processing Progress */}
            {isProcessing && (
              <div className="space-y-2 p-4 bg-slate-800/50 rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">{currentStep}</span>
                  <span className="text-blue-400">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
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
                className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                onClick={handleMint}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Minting...
                  </>
                ) : (
                  <>
                    <Rocket className="mr-2 h-4 w-4" />
                    Mint NFT
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
