import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, Send, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { sessionManager } from '@/utils/sessionManager';

interface NFTTransferProps {
  isOpen: boolean;
  onClose: () => void;
  nft: {
    nftokenID: string;
    name: string;
    image?: string;
    description?: string;
  };
  onSuccess?: () => void;
}

export function NFTTransfer({ isOpen, onClose, nft, onSuccess }: NFTTransferProps) {
  const { toast } = useToast();
  const [recipientAddress, setRecipientAddress] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen || !nft) return null;

  const validateXRPAddress = (address: string): boolean => {
    // Basic XRPL address validation
    return /^r[a-zA-Z0-9]{24,34}$/.test(address);
  };

  const handleTransfer = async () => {
    if (!recipientAddress.trim()) {
      toast({
        title: "Recipient Required",
        description: "Please enter a recipient address",
        variant: "destructive"
      });
      return;
    }

    if (!validateXRPAddress(recipientAddress.trim())) {
      toast({
        title: "Invalid Address",
        description: "Please enter a valid XRPL address",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Get session token from SessionManager (same as burn/accept/decline)
      const managerToken = sessionManager.getSessionToken();
      const riddleToken = localStorage.getItem('riddleToken');
      const sessionToken = localStorage.getItem('sessionToken');
      const finalToken = managerToken || riddleToken || sessionToken;
      
      // Validate token (prevent 'null' string from being sent)
      const validToken = finalToken && finalToken !== 'null' && finalToken !== 'undefined' ? finalToken : null;
      
      if (!validToken) {
        throw new Error('No valid session token - please re-login');
      }

      const response = await fetch(`/api/nft/${nft.nftokenID}/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${validToken}`
        },
        body: JSON.stringify({
          destinationAddress: recipientAddress.trim()
        })
      });

      const result = await response.json() as any;

      if (result.success) {
        toast({
          title: "Transfer Offer Created",
          description: result.message || `Transfer offer created successfully. Recipient must accept to receive the NFT.`,
        });
        onSuccess?.();
        setRecipientAddress('');
        onClose();
      } else {
        throw new Error(result.error || 'Failed to create transfer offer');
      }
    } catch (error) {
      console.error('Transfer error:', error);
      toast({
        title: "Transfer Failed",
        description: error instanceof Error ? error.message : "Failed to create transfer offer",
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
              <Send className="w-5 h-5" />
              Transfer NFT
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

          {/* Recipient Address */}
          <div>
            <Label htmlFor="recipient" className="text-sm text-gray-300">Recipient Address</Label>
            <Input
              id="recipient"
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              placeholder="rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
              className="bg-gray-800 border-gray-600 text-white mt-1"
            />
            <p className="text-xs text-gray-400 mt-1">
              Enter a valid XRPL address
            </p>
          </div>

          {/* Transfer Info */}
          <div className="bg-blue-900/30 border border-blue-600/50 p-3 rounded-lg">
            <p className="text-xs text-gray-300">
              💡 This creates a <span className="font-semibold text-blue-400">free transfer offer</span> (0 XRP). 
              The recipient must accept the offer to receive the NFT.
            </p>
          </div>

          {/* Transfer Preview */}
          {recipientAddress && validateXRPAddress(recipientAddress) && (
            <div className="bg-green-900/30 border border-green-600/50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-300">Transferring to:</p>
                  <p className="font-mono text-sm">{recipientAddress.slice(0, 12)}...{recipientAddress.slice(-8)}</p>
                </div>
                <ArrowRight className="w-5 h-5 text-green-400" />
              </div>
            </div>
          )}

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
              onClick={handleTransfer}
              disabled={isProcessing || !recipientAddress.trim() || !validateXRPAddress(recipientAddress.trim())}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              data-testid="button-transfer-nft"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 mr-2 animate-spin border-2 border-white border-t-transparent rounded-full" />
                  Creating Offer...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Create Transfer Offer
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
