import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Send, Loader2, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import NFTFeeDisplay, { NFTFeeBreakdown } from './NFTFeeDisplay';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface NFTTransferModuleProps {
  nftokenID: string;
  nftData?: {
    name?: string;
    description?: string;
    image?: string;
    collection?: string;
  };
  onTransferComplete?: () => void;
  className?: string;
}

export function NFTTransferModule({ 
  nftokenID, 
  nftData, 
  onTransferComplete,
  className = '' 
}: NFTTransferModuleProps) {
  const [recipientAddress, setRecipientAddress] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCalculatingFees, setIsCalculatingFees] = useState(false);
  const [feeBreakdown, setFeeBreakdown] = useState<NFTFeeBreakdown | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const { toast } = useToast();

  const validateXRPLAddress = (address: string): boolean => {
    // Basic XRPL address validation
    return address.length >= 25 && address.length <= 34 && address.startsWith('r');
  };

  const calculateTransferFees = async () => {
    if (!recipientAddress) {
      toast({
        title: 'Recipient Required',
        description: 'Please enter a recipient address',
        variant: 'destructive'
      });
      return;
    }

    if (!validateXRPLAddress(recipientAddress)) {
      toast({
        title: 'Invalid Address',
        description: 'Please enter a valid XRPL address',
        variant: 'destructive'
      });
      return;
    }

    setIsCalculatingFees(true);
    try {
      const response = await apiRequest('/api/nft/fees/transfer', {
        method: 'POST',
        body: JSON.stringify({
          nftokenID
        })
      });

      const data = await response.json() as any;

      if (data.success) {
        setFeeBreakdown(data.feeBreakdown);
        setShowConfirmation(true);
      } else {
        throw new Error(data.error || 'Failed to calculate transfer fees');
      }
    } catch (error) {
      console.error('Fee calculation error:', error);
      toast({
        title: 'Fee Calculation Failed',
        description: error instanceof Error ? error.message : 'Could not calculate transaction fees',
        variant: 'destructive'
      });
    } finally {
      setIsCalculatingFees(false);
    }
  };

  const handleTransfer = async () => {
    if (!password) {
      toast({
        title: 'Password Required',
        description: 'Please enter your wallet password to transfer the NFT',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiRequest('/api/nft/transfer', {
        method: 'POST',
        body: JSON.stringify({
          nftokenID,
          recipientAddress,
          password
        })
      });

      const data = await response.json() as any;

      if (data.success) {
        toast({
          title: 'NFT Transferred',
          description: `Successfully transferred NFT to ${recipientAddress.slice(0, 8)}...${recipientAddress.slice(-6)}`,
        });
        
        // Reset form
        setRecipientAddress('');
        setPassword('');
        setFeeBreakdown(null);
        setShowConfirmation(false);
        
        // Callback to parent component
        onTransferComplete?.();
      } else {
        throw new Error(data.error || 'Failed to transfer NFT');
      }
    } catch (error) {
      console.error('Transfer error:', error);
      toast({
        title: 'Transfer Failed',
        description: error instanceof Error ? error.message : 'Could not transfer NFT',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className={`w-full ${className}`} data-testid="nft-transfer-module">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="w-5 h-5" />
          Transfer NFT
          <Badge variant="outline" className="ml-2">
            <User className="w-3 h-3 mr-1" />
            Direct Transfer
          </Badge>
        </CardTitle>
        <CardDescription>
          Transfer this NFT to another XRPL address. Network fees apply.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* NFT Information */}
        {nftData && (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
            <div className="flex items-center gap-3">
              {nftData.image && (
                <img 
                  src={nftData.image} 
                  alt={nftData.name || 'NFT'} 
                  className="w-12 h-12 rounded-md object-cover"
                />
              )}
              <div>
                <div className="font-medium">{nftData.name || 'Unknown NFT'}</div>
                {nftData.collection && (
                  <div className="text-sm text-muted-foreground">{nftData.collection}</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Recipient Address Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Recipient Address</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Enter XRPL address (e.g., rABC...)"
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              className="pl-10"
              data-testid="input-recipient-address"
            />
          </div>
          <div className="text-xs text-muted-foreground">
            Must be a valid XRPL address starting with 'r'
          </div>
        </div>

        {/* Calculate Fees Button */}
        <Button 
          onClick={calculateTransferFees}
          disabled={!recipientAddress || !validateXRPLAddress(recipientAddress) || isCalculatingFees}
          className="w-full"
          variant="outline"
          data-testid="button-calculate-fees"
        >
          {isCalculatingFees ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Calculating Fees...
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Calculate Transfer Fees
            </>
          )}
        </Button>

        {/* Fee Confirmation Dialog */}
        <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
          <DialogContent className="w-[95vw] sm:w-[90%] sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[90vh] overflow-y-auto max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Confirm NFT Transfer</DialogTitle>
              <DialogDescription>
                Review transfer details and fees before proceeding
              </DialogDescription>
            </DialogHeader>

            {feeBreakdown && (
              <div className="space-y-4">
                {/* Transfer Details */}
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <h4 className="font-semibold mb-2">Transfer Details</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>NFT:</span>
                      <span>{nftData?.name || 'Unknown NFT'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>To:</span>
                      <span className="font-mono">
                        {recipientAddress.slice(0, 8)}...{recipientAddress.slice(-6)}
                      </span>
                    </div>
                  </div>
                </div>

                <NFTFeeDisplay 
                  feeBreakdown={feeBreakdown}
                  showDetailedBreakdown={true}
                  variant="detailed"
                />

                {/* Password Input */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Wallet Password</label>
                  <Input
                    type="password"
                    placeholder="Enter your wallet password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    data-testid="input-password"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowConfirmation(false)}
                    className="flex-1"
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleTransfer}
                    disabled={!password || isLoading}
                    className="flex-1"
                    data-testid="button-confirm-transfer"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Transferring...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Transfer NFT
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Important Notice */}
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
            <div className="text-sm">
              <div className="font-medium text-yellow-700 dark:text-yellow-300 mb-1">
                Transfer Warning
              </div>
              <div className="text-yellow-600 dark:text-yellow-400">
                NFT transfers are permanent and cannot be undone. Please verify the 
                recipient address carefully before confirming the transfer.
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default NFTTransferModule;
