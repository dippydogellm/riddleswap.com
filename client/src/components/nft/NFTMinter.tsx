import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { Upload, Palette, Coins, Shield, Gift, Clock } from 'lucide-react';

interface NFTMinterProps {
  onMintSuccess?: (result: any) => void;
}

export function NFTMinter({ onMintSuccess }: NFTMinterProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    metadataUri: '',
    taxon: 0,
    transferFee: 0,
    isTransferable: true,
    isBurnable: false,
    isTrustline: false,
    issuer: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const calculateFlags = () => {
    let flags = 0;
    if (formData.isTransferable) flags |= 0x00000008; // tfTransferable
    if (formData.isBurnable) flags |= 0x00000001; // tfBurnable
    if (formData.isTrustline) flags |= 0x00000002; // tfOnlyXRP
    return flags;
  };

  const handleMint = async () => {
    setIsLoading(true);
    
    try {
      // Get session token
      const sessionData = localStorage.getItem('sessionData');
      if (!sessionData) {
        throw new Error('Please log in to mint NFTs');
      }

      const session = JSON.parse(sessionData);
      const sessionToken = session.sessionToken;

      if (!sessionToken) {
        throw new Error('Authentication required');
      }

      const mintPayload = {
        metadataUri: formData.metadataUri,
        taxon: formData.taxon,
        transferFee: Math.round(formData.transferFee * 1000), // Convert percentage to basis points
        flags: calculateFlags(),
        issuer: formData.issuer || undefined
      };

      console.log('🎨 [NFT MINT] Submitting mint request:', mintPayload);

      const response = await fetch('/api/nft/mint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify(mintPayload)
      });

      const result = await response.json() as any;

      if (!response.ok) {
        throw new Error(result.details || result.error || 'Failed to mint NFT');
      }

      toast({
        title: "NFT Minted Successfully!",
        description: `NFT ID: ${result.nftId?.slice(-12)}...`,
      });

      // Reset form
      setFormData({
        name: '',
        description: '',
        metadataUri: '',
        taxon: 0,
        transferFee: 0,
        isTransferable: true,
        isBurnable: false,
        isTrustline: false,
        issuer: ''
      });

      // Callback for parent component
      if (onMintSuccess) {
        onMintSuccess(result);
      }

    } catch (error) {
      console.error('Error minting NFT:', error);
      toast({
        title: "Minting Failed",
        description: error instanceof Error ? error.message : 'Failed to mint NFT',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Mint New NFT
        </CardTitle>
        <CardDescription>
          Create a new NFT on the XRP Ledger with custom metadata and properties
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">NFT Name (optional)</Label>
            <Input
              id="name"
              placeholder="Enter NFT name..."
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="Describe your NFT..."
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="metadataUri">Metadata URI (IPFS/HTTP)</Label>
            <Input
              id="metadataUri"
              placeholder="ipfs://... or https://..."
              value={formData.metadataUri}
              onChange={(e) => handleInputChange('metadataUri', e.target.value)}
            />
            <p className="text-sm text-gray-500 mt-1">
              Link to JSON metadata containing name, description, image, and attributes
            </p>
          </div>
        </div>

        {/* Collection Settings */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Coins className="h-4 w-4" />
            Collection Settings
          </h3>
          
          <div>
            <Label htmlFor="taxon">Collection Taxon (0-4,294,967,295)</Label>
            <Input
              id="taxon"
              type="number"
              min="0"
              max="4294967295"
              value={formData.taxon}
              onChange={(e) => handleInputChange('taxon', parseInt(e.target.value) || 0)}
            />
            <p className="text-sm text-gray-500 mt-1">
              Groups NFTs into collections. Use 0 for individual NFTs
            </p>
          </div>

          <div>
            <Label htmlFor="issuer">Custom Issuer (optional)</Label>
            <Input
              id="issuer"
              placeholder="rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
              value={formData.issuer}
              onChange={(e) => handleInputChange('issuer', e.target.value)}
            />
            <p className="text-sm text-gray-500 mt-1">
              Leave blank to use your wallet as issuer
            </p>
          </div>
        </div>

        {/* Transfer Fee */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Transfer Fee (Royalty)
          </h3>
          
          <div>
            <Label>Transfer Fee: {formData.transferFee.toFixed(1)}%</Label>
            <Slider
              value={[formData.transferFee]}
              onValueChange={(value) => handleInputChange('transferFee', value[0])}
              max={50}
              min={0}
              step={0.1}
              className="mt-2"
            />
            <p className="text-sm text-gray-500 mt-1">
              Percentage fee paid to issuer on each transfer (0-50%)
            </p>
          </div>
        </div>

        {/* NFT Flags */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Gift className="h-4 w-4" />
            NFT Properties
          </h3>
          
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="transferable"
                checked={formData.isTransferable}
                onCheckedChange={(checked) => handleInputChange('isTransferable', checked)}
              />
              <Label htmlFor="transferable">Transferable</Label>
              <p className="text-sm text-gray-500">Allow NFT to be transferred to other accounts</p>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="burnable"
                checked={formData.isBurnable}
                onCheckedChange={(checked) => handleInputChange('isBurnable', checked)}
              />
              <Label htmlFor="burnable">Burnable</Label>
              <p className="text-sm text-gray-500">Allow issuer to burn the NFT</p>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="trustline"
                checked={formData.isTrustline}
                onCheckedChange={(checked) => handleInputChange('isTrustline', checked)}
              />
              <Label htmlFor="trustline">Only XRP</Label>
              <p className="text-sm text-gray-500">Only accept XRP for offers (no other tokens)</p>
            </div>
          </div>
        </div>

        {/* Mint Button */}
        <div className="pt-4">
          <Button 
            onClick={handleMint} 
            disabled={isLoading || !formData.metadataUri}
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              <>
                <Clock className="h-4 w-4 mr-2 animate-spin" />
                Minting NFT...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Mint NFT
              </>
            )}
          </Button>
          
          {!formData.metadataUri && (
            <p className="text-sm text-gray-500 text-center mt-2">
              Metadata URI is required to mint an NFT
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
