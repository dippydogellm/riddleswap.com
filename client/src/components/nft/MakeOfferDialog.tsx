import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Wallet, Info } from 'lucide-react';

interface MakeOfferDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (offerAmount: string) => void;
  nftName: string;
  nftImage?: string;
  currentUserAddress?: string;
  brokerFeePercent?: number;
}

export function MakeOfferDialog({
  open,
  onClose,
  onSubmit,
  nftName,
  nftImage,
  currentUserAddress,
  brokerFeePercent = 1.589
}: MakeOfferDialogProps) {
  const [offerAmount, setOfferAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const brokerFee = offerAmount ? (parseFloat(offerAmount) * (brokerFeePercent / 100)).toFixed(6) : '0';
  const totalAmount = offerAmount ? (parseFloat(offerAmount) + parseFloat(brokerFee)).toFixed(6) : '0';

  const handleSubmit = async () => {
    if (!offerAmount || parseFloat(offerAmount) <= 0) {
      return;
    }

    setLoading(true);
    try {
      await onSubmit(offerAmount);
      onClose();
      setOfferAmount('');
    } catch (error) {
      console.error('Offer submission error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:w-[90%] sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <DollarSign className="h-6 w-6 text-blue-500" />
            Make Offer
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* NFT Preview */}
          <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
            {nftImage && (
              <img
                src={nftImage}
                alt={nftName}
                className="w-16 h-16 rounded-lg object-cover"
              />
            )}
            <div className="flex-1">
              <h3 className="font-semibold">{nftName}</h3>
              <p className="text-sm text-muted-foreground">XRPL NFT</p>
            </div>
          </div>

          {/* Wallet Info */}
          {currentUserAddress && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <Wallet className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <div className="flex-1">
                <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">Your Riddle Wallet</p>
                <p className="text-xs font-mono text-blue-600 dark:text-blue-400">
                  {currentUserAddress.slice(0, 12)}...{currentUserAddress.slice(-8)}
                </p>
              </div>
            </div>
          )}

          {/* Offer Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="offerAmount" className="text-base font-semibold">
              Your Offer Amount
            </Label>
            <div className="relative">
              <Input
                id="offerAmount"
                type="number"
                step="0.000001"
                placeholder="0.00"
                value={offerAmount}
                onChange={(e) => setOfferAmount(e.target.value)}
                className="text-lg pr-16"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Badge variant="secondary" className="font-semibold">XRP</Badge>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Enter the amount you're willing to pay for this NFT
            </p>
          </div>

          {/* Fee Breakdown */}
          {offerAmount && parseFloat(offerAmount) > 0 && (
            <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <Info className="h-4 w-4" />
                Payment Breakdown
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">NFT Price</span>
                  <span className="font-medium">{parseFloat(offerAmount).toFixed(6)} XRP</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Broker Fee ({brokerFeePercent}%)</span>
                  <span className="font-medium">{brokerFee} XRP</span>
                </div>
                <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                  <div className="flex justify-between text-base font-bold">
                    <span>Total You Pay</span>
                    <span className="text-blue-600 dark:text-blue-400">{totalAmount} XRP</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Important Info */}
          <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950 rounded-lg">
            <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              <strong>How it works:</strong> Your offer will be submitted to the blockchain. If the seller accepts, 
              the broker will automatically process the transaction and distribute royalties.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!offerAmount || parseFloat(offerAmount) <= 0 || loading}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Submitting...
              </>
            ) : (
              <>
                <DollarSign className="h-4 w-4 mr-2" />
                Submit Offer
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
