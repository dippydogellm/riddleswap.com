import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { X, Link, Save, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface NFTURIEditorProps {
  isOpen: boolean;
  onClose: () => void;
  nft: {
    nftokenID: string;
    name: string;
    image?: string;
    description?: string;
    uri?: string;
  };
  onSuccess?: () => void;
}

export function NFTURIEditor({ isOpen, onClose, nft, onSuccess }: NFTURIEditorProps) {
  const { toast } = useToast();
  const [newURI, setNewURI] = useState(() => nft?.uri || '');
  const [walletSeed, setWalletSeed] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen || !nft) return null;

  const handleUpdateURI = async () => {
    if (!newURI.trim()) {
      toast({
        title: "URI Required",
        description: "Please enter a valid URI",
        variant: "destructive"
      });
      return;
    }

    if (!walletSeed) {
      toast({
        title: "Wallet Required",
        description: "Please provide your wallet seed to update URI",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);

    try {
      const response = await apiRequest('/api/nft/update-uri', {
        method: 'POST',
        body: JSON.stringify({
          nftokenID: nft.nftokenID,
          newURI: newURI.trim(),
          walletSeed
        })
      });

      const result = await response.json() as any;

      if (result.success) {
        toast({
          title: "URI Updated",
          description: `NFT URI updated successfully. Transaction: ${result.txHash}`,
        });
        onSuccess?.();
        setWalletSeed(''); // Clear sensitive data
        onClose();
      } else {
        throw new Error(result.message || 'Failed to update URI');
      }
    } catch (error) {
      console.error('URI update error:', error);
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update NFT URI",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-lg w-full bg-gray-900 border-gray-700 text-white">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Link className="w-5 h-5" />
              Edit NFT URI
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* NFT Info */}
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="flex items-center gap-3">
              {nft.image && (
                <img 
                  src={nft.image} 
                  alt={nft.name} 
                  className="w-12 h-12 rounded object-cover" 
                  onError={(e) => e.currentTarget.style.display = 'none'}
                />
              )}
              <div>
                <p className="font-semibold">{nft.name}</p>
                <p className="text-xs text-gray-400">ID: {nft.nftokenID.slice(-8)}</p>
              </div>
            </div>
          </div>

          {/* Current URI */}
          {nft.uri && (
            <div>
              <Label className="text-sm text-gray-300">Current URI:</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input 
                  value={nft.uri} 
                  readOnly 
                  className="bg-gray-800 border-gray-600 text-gray-300 text-xs"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(nft.uri, '_blank')}
                  className="border-gray-600 text-gray-300 hover:bg-gray-800"
                >
                  <ExternalLink className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}

          {/* Wallet Seed Input */}
          <div>
            <Label htmlFor="walletSeed" className="text-sm text-gray-300">Wallet Seed Phrase *</Label>
            <Input
              id="walletSeed"
              type="password"
              value={walletSeed}
              onChange={(e) => setWalletSeed(e.target.value)}
              placeholder="Enter your wallet seed phrase"
              className="bg-gray-800 border-gray-600 text-white mt-1"
            />
            <p className="text-xs text-gray-400 mt-1">
              Required to sign the URI update transaction
            </p>
          </div>

          {/* New URI Input */}
          <div>
            <Label htmlFor="newURI" className="text-sm text-gray-300">New URI:</Label>
            <Textarea
              id="newURI"
              value={newURI}
              onChange={(e) => setNewURI(e.target.value)}
              placeholder="https://example.com/metadata.json or ipfs://..."
              className="bg-gray-800 border-gray-600 text-white mt-1"
              rows={3}
            />
            <p className="text-xs text-gray-400 mt-1">
              Enter the new URI for your NFT metadata
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-800"
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateURI}
              disabled={isProcessing || !newURI.trim()}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="button-update-uri"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 mr-2 animate-spin border-2 border-white border-t-transparent rounded-full" />
                  Updating...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Update URI
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
