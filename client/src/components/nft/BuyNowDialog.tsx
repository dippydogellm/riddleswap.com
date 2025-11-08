import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Wallet, Info, CheckCircle, Loader2, ShoppingCart } from 'lucide-react';

interface SellOffer {
  index: string;
  amountXRP: string;
  owner: string;
}

interface BuyNowDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<{ success: boolean; txHash?: string; error?: string }>;
  nftName: string;
  nftImage?: string;
  sellOffer: SellOffer;
  currentUserAddress?: string;
  brokerFeePercent?: number;
}

export function BuyNowDialog({
  open,
  onClose,
  onConfirm,
  nftName,
  nftImage,
  sellOffer,
  currentUserAddress,
  brokerFeePercent = 1.589
}: BuyNowDialogProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [txHash, setTxHash] = useState<string>('');

  const nftPrice = parseFloat(sellOffer.amountXRP);
  const brokerFee = (nftPrice * (brokerFeePercent / 100)).toFixed(6);
  const totalAmount = (nftPrice + parseFloat(brokerFee)).toFixed(6);

  const handleBuyNow = async () => {
    setLoading(true);

    try {
      const result = await onConfirm();
      if (result.success && result.txHash) {
        setTxHash(result.txHash);
        setSuccess(true);
      }
      setLoading(false);
    } catch (error) {
      console.error('Purchase error:', error);
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSuccess(false);
    setTxHash('');
    setLoading(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="w-[95vw] sm:w-[90%] sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <ShoppingCart className="h-6 w-6 text-green-500" />
            Buy Now
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
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 rounded-lg">
              <Wallet className="h-4 w-4 text-green-600 dark:text-green-400" />
              <div className="flex-1">
                <p className="text-xs text-green-700 dark:text-green-300 font-medium">Your Riddle Wallet</p>
                <p className="text-xs font-mono text-green-600 dark:text-green-400">
                  {currentUserAddress.slice(0, 12)}...{currentUserAddress.slice(-8)}
                </p>
              </div>
            </div>
          )}

          {/* Price Breakdown */}
          <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <Info className="h-4 w-4" />
              Payment Breakdown
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">NFT Price</span>
                <span className="font-medium">{nftPrice.toFixed(6)} XRP</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Broker Fee ({brokerFeePercent}%)</span>
                <span className="font-medium">{brokerFee} XRP</span>
              </div>
              <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                <div className="flex justify-between text-base font-bold">
                  <span>Total You Pay</span>
                  <span className="text-green-600 dark:text-green-400">{totalAmount} XRP</span>
                </div>
              </div>
            </div>
          </div>

          {/* Success Status */}
          {success && txHash && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-700 dark:text-green-300">Purchase Successful!</p>
                  <p className="text-xs text-green-600 dark:text-green-400">NFT has been transferred to your wallet</p>
                </div>
              </div>
              
              <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">Transaction Hash</p>
                </div>
                <p className="font-mono text-xs bg-blue-100 dark:bg-blue-900 p-2 rounded text-blue-800 dark:text-blue-200 break-all">
                  {txHash}
                </p>
              </div>
            </div>
          )}

          {/* Important Info */}
          {!success && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950 rounded-lg">
              <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                <strong>How it works:</strong> The broker will accept the sell offer on your behalf and transfer the NFT to your wallet. Fees are calculated and secured by the server.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {success ? (
            <Button
              onClick={handleClose}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Done
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleBuyNow}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <DollarSign className="h-4 w-4 mr-2" />
                    Confirm Purchase
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
