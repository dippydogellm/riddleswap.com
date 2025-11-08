import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, DollarSign, ShoppingCart, Users, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import NFTFeeDisplay, { NFTFeeBreakdown } from './NFTFeeDisplay';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface NFTBuyOfferModuleProps {
  nftokenID: string;
  nftData?: {
    name?: string;
    description?: string;
    image?: string;
    collection?: string;
  };
  onOfferCreated?: () => void;
  className?: string;
}

export function NFTBuyOfferModule({ 
  nftokenID, 
  nftData, 
  onOfferCreated,
  className = '' 
}: NFTBuyOfferModuleProps) {
  const [amount, setAmount] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCalculatingFees, setIsCalculatingFees] = useState(false);
  const [feeBreakdown, setFeeBreakdown] = useState<NFTFeeBreakdown | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const { toast } = useToast();

  const calculateFees = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: 'Invalid Amount',
        description: 'Please enter a valid offer amount',
        variant: 'destructive'
      });
      return;
    }

    setIsCalculatingFees(true);
    try {
      const response = await apiRequest('/api/nft/fees/buy-offer', {
        method: 'POST',
        body: JSON.stringify({
          nftokenID,
          amount: parseFloat(amount),
          isBrokered: true
        })
      });

      const data = await response.json() as any;

      if (data.success) {
        setFeeBreakdown(data.feeBreakdown);
        setShowConfirmation(true);
      } else {
        throw new Error(data.error || 'Failed to calculate fees');
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

  const handleCreateOffer = async () => {
    if (!password) {
      toast({
        title: 'Password Required',
        description: 'Please enter your wallet password to create the offer',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiRequest('/api/nft/create-offer', {
        method: 'POST',
        body: JSON.stringify({
          nftId: nftokenID,
          amount: parseFloat(amount),
          password
        })
      });

      const data = await response.json() as any;

      if (data.success) {
        toast({
          title: 'Buy Offer Created',
          description: `Successfully created buy offer for ${amount} XRP`,
        });
        
        // Reset form
        setAmount('');
        setPassword('');
        setFeeBreakdown(null);
        setShowConfirmation(false);
        
        // Callback to parent component
        onOfferCreated?.();
      } else {
        throw new Error(data.error || 'Failed to create buy offer');
      }
    } catch (error) {
      console.error('Buy offer error:', error);
      toast({
        title: 'Offer Creation Failed',
        description: error instanceof Error ? error.message : 'Could not create buy offer',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatXRP = (amount: string) => {
    const num = parseFloat(amount);
    return num.toFixed(6).replace(/\.?0+$/, '');
  };

  return (
    <Card className={`w-full ${className}`} data-testid="nft-buy-offer-module">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5" />
          Create Buy Offer
          <Badge variant="secondary" className="ml-2">
            <Users className="w-3 h-3 mr-1" />
            Brokered
          </Badge>
        </CardTitle>
        <CardDescription>
          Create a brokered buy offer for this NFT. All buy offers go through our secure broker system.
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

        {/* Amount Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Offer Amount (XRP)</label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="number"
              step="0.000001"
              min="0"
              placeholder="Enter offer amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="pl-10"
              data-testid="input-offer-amount"
            />
          </div>
          <div className="text-xs text-muted-foreground">
            Minimum: 0.000001 XRP
          </div>
        </div>

        {/* Calculate Fees Button */}
        <Button 
          onClick={calculateFees}
          disabled={!amount || parseFloat(amount) <= 0 || isCalculatingFees}
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
              <DollarSign className="w-4 h-4 mr-2" />
              Calculate Fees & Preview
            </>
          )}
        </Button>

        {/* Fee Confirmation Dialog */}
        <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
          <DialogContent className="w-[95vw] sm:w-[90%] sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[90vh] overflow-y-auto max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Confirm Buy Offer</DialogTitle>
              <DialogDescription>
                Review all fees and costs before creating your buy offer
              </DialogDescription>
            </DialogHeader>

            {feeBreakdown && (
              <div className="space-y-4">
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
                    onClick={handleCreateOffer}
                    disabled={!password || isLoading}
                    className="flex-1"
                    data-testid="button-confirm-offer"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating Offer...
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        Create Buy Offer
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Important Notice */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="text-sm">
              <div className="font-medium text-blue-700 dark:text-blue-300 mb-1">
                Brokered Buy Offers
              </div>
              <div className="text-blue-600 dark:text-blue-400">
                All buy offers are processed through our secure broker system. This ensures 
                fair fee collection and protects both buyers and sellers in the transaction.
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default NFTBuyOfferModule;
