import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, MapPin, Coins, Zap, Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface Plot {
  id: string;
  plotNumber: number;
  terrainType: string;
  plotSize: string;
  currentPrice: number;
  latitude?: number;
  longitude?: number;
  status: string;
}

interface PaymentOption {
  price: number;
  currency: string;
  originalPrice?: number;
  discount?: number;
  savings?: number;
  description: string;
}

interface PlotPricing {
  plotId: string;
  plotNumber: number;
  terrainType: string;
  plotSize: string;
  options: {
    XRP: PaymentOption;
    RDL: PaymentOption;
  };
  paymentAddress: string; // Direct payment address instead of bankWallet
}

interface PurchaseDetails {
  id: string;
  plotId: string;
  plotNumber: number;
  paymentMethod: string;
  amount: number;
  currency: string;
  paymentAddress: string; // Direct payment address
  discount?: {
    applied: boolean;
    percent: number;
    savings: number;
  };
  instructions: {
    message: string;
    destinationTag: string;
    memo: string;
  };
}

interface LandPlotPaymentDialogProps {
  plot: Plot | null;
  isOpen: boolean;
  onClose: () => void;
  onPurchaseComplete?: () => void;
}

export const LandPlotPaymentDialog: React.FC<LandPlotPaymentDialogProps> = ({
  plot,
  isOpen,
  onClose,
  onPurchaseComplete
}) => {
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'XRP' | 'RDL' | null>(null);
  const [purchaseDetails, setPurchaseDetails] = useState<PurchaseDetails | null>(null);
  const [transactionHash, setTransactionHash] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get pricing for the plot
  const { data: pricing, isLoading: pricingLoading } = useQuery({
    queryKey: ['/api/nft-gaming/land-plots', plot?.id, 'pricing'],
    enabled: !!plot?.id && isOpen,
  });

  // Initiate purchase mutation
  const initiatePurchase = useMutation({
    mutationFn: async (data: { plotId: string; paymentMethod: string; walletAddress: string }) => {
      const response = await apiRequest('/api/nft-gaming/land-plots/purchase', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      return await response.json();
    },
    onSuccess: (response: any) => {
      if (response.success) {
        setPurchaseDetails(response.purchase);
        toast({
          title: "Purchase Initiated!",
          description: `Send ${response.purchase.amount} ${response.purchase.currency} to complete your purchase.`,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Purchase Failed",
        description: error.message || "Failed to initiate purchase. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Verify payment mutation
  const verifyPayment = useMutation({
    mutationFn: async (data: { purchaseId: string; transactionHash: string }) => {
      const response = await apiRequest(`/api/nft-gaming/land-plots/purchase/${data.purchaseId}/verify`, {
        method: 'POST',
        body: JSON.stringify({ transactionHash: data.transactionHash })
      });
      return await response.json();
    },
    onSuccess: (response: any) => {
      if (response.success) {
        toast({
          title: "Plot Purchased Successfully! 🎉",
          description: "Ownership has been transferred to your wallet.",
        });
        queryClient.invalidateQueries({ queryKey: ['/api/nft-gaming/land-plots'] });
        onPurchaseComplete?.();
        handleClose();
      }
    },
    onError: (error: any) => {
      toast({
        title: "Verification Failed",
        description: error.message || "Failed to verify payment. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handlePaymentMethodSelect = (method: 'XRP' | 'RDL') => {
    if (!plot || !(pricing as any)?.pricing) return;
    
    setSelectedPaymentMethod(method);
    
    // Get wallet address from localStorage
    const walletAddress = localStorage.getItem('xrpl_wallet_address') || '';
    
    initiatePurchase.mutate({
      plotId: plot.id,
      paymentMethod: method,
      walletAddress
    });
  };

  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
      toast({
        title: "Copied!",
        description: `${field} copied to clipboard`,
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Please copy manually",
        variant: "destructive"
      });
    }
  };

  const handleVerifyPayment = () => {
    if (!purchaseDetails || !transactionHash.trim()) {
      toast({
        title: "Transaction Hash Required",
        description: "Please enter your transaction hash",
        variant: "destructive"
      });
      return;
    }

    verifyPayment.mutate({
      purchaseId: purchaseDetails.id,
      transactionHash: transactionHash.trim()
    });
  };

  const handleClose = () => {
    setSelectedPaymentMethod(null);
    setPurchaseDetails(null);
    setTransactionHash('');
    setCopiedField(null);
    onClose();
  };

  if (!plot) return null;

  const plotPricing = (pricing as any)?.pricing as PlotPricing | undefined;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] sm:w-[90%] sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-400" />
            Purchase Land Plot #{plot.plotNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Plot Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Plot Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-400">Plot Number:</span>
                  <p className="font-medium">#{plot.plotNumber}</p>
                </div>
                <div>
                  <span className="text-slate-400">Terrain:</span>
                  <p className="font-medium capitalize">{plot.terrainType}</p>
                </div>
                <div>
                  <span className="text-slate-400">Size:</span>
                  <p className="font-medium capitalize">{plot.plotSize}</p>
                </div>
                <div>
                  <span className="text-slate-400">Coordinates:</span>
                  <p className="font-medium">
                    {plot.latitude?.toFixed(2)}, {plot.longitude?.toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Method Selection */}
          {!purchaseDetails && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Choose Payment Method</h3>
              
              {pricingLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                </div>
              ) : plotPricing ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* XRP Option */}
                  <Card 
                    className={`cursor-pointer border-2 transition-all ${
                      selectedPaymentMethod === 'XRP' 
                        ? 'border-blue-400 bg-blue-400/10' 
                        : 'border-slate-600 hover:border-slate-500'
                    }`}
                    onClick={() => !initiatePurchase.isPending && handlePaymentMethodSelect('XRP')}
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Coins className="h-5 w-5 text-orange-400" />
                        Pay with XRP
                      </CardTitle>
                      <CardDescription>
                        {plotPricing.options.XRP.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-orange-400">
                        {plotPricing.options.XRP.price} XRP
                      </div>
                    </CardContent>
                  </Card>

                  {/* RDL Option */}
                  <Card 
                    className={`cursor-pointer border-2 transition-all relative ${
                      selectedPaymentMethod === 'RDL' 
                        ? 'border-green-400 bg-green-400/10' 
                        : 'border-slate-600 hover:border-slate-500'
                    }`}
                    onClick={() => !initiatePurchase.isPending && handlePaymentMethodSelect('RDL')}
                  >
                    <Badge className="absolute -top-2 -right-2 bg-green-600">
                      {plotPricing.options.RDL.discount}% OFF
                    </Badge>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Zap className="h-5 w-5 text-green-400" />
                        Pay with RDL
                      </CardTitle>
                      <CardDescription>
                        {plotPricing.options.RDL.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1">
                        <div className="text-2xl font-bold text-green-400">
                          {plotPricing.options.RDL.price.toFixed(8)} RDL
                        </div>
                        <div className="text-sm text-slate-400 line-through">
                          {plotPricing.options.RDL.originalPrice} XRP
                        </div>
                        <div className="text-sm text-green-400 font-medium">
                          Save {plotPricing.options.RDL.savings?.toFixed(2)} XRP!
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400">
                  Failed to load pricing information
                </div>
              )}

              {initiatePurchase.isPending && (
                <div className="flex items-center justify-center gap-2 text-blue-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Initiating purchase...</span>
                </div>
              )}
            </div>
          )}

          {/* Payment Instructions */}
          {purchaseDetails && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Payment Instructions</h3>
              
              <Card className="bg-blue-950/30 border-blue-400">
                <CardHeader>
                  <CardTitle className="text-blue-400">
                    Send Payment: {purchaseDetails.amount} {purchaseDetails.currency}
                  </CardTitle>
                  {purchaseDetails.discount && (
                    <div className="text-sm text-green-400">
                      ✨ {purchaseDetails.discount.percent}% discount applied! 
                      You saved {purchaseDetails.discount.savings.toFixed(2)} XRP
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Payment Address */}
                  <div>
                    <label className="text-sm text-slate-400">Send to Address:</label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="flex-1 p-2 bg-slate-800 rounded text-sm font-mono">
                        {purchaseDetails.paymentAddress}
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopy(purchaseDetails.paymentAddress, 'Address')}
                        data-testid="copy-address"
                      >
                        {copiedField === 'Address' ? (
                          <Check className="h-4 w-4 text-green-400" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Destination Tag */}
                  <div>
                    <label className="text-sm text-slate-400">Destination Tag:</label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="flex-1 p-2 bg-slate-800 rounded text-sm font-mono">
                        {purchaseDetails.instructions.destinationTag}
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopy(purchaseDetails.instructions.destinationTag, 'Destination Tag')}
                        data-testid="copy-destination-tag"
                      >
                        {copiedField === 'Destination Tag' ? (
                          <Check className="h-4 w-4 text-green-400" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Memo */}
                  <div>
                    <label className="text-sm text-slate-400">Memo:</label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="flex-1 p-2 bg-slate-800 rounded text-sm font-mono">
                        {purchaseDetails.instructions.memo}
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopy(purchaseDetails.instructions.memo, 'Memo')}
                        data-testid="copy-memo"
                      >
                        {copiedField === 'Memo' ? (
                          <Check className="h-4 w-4 text-green-400" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="text-sm text-slate-400 bg-slate-800/50 p-3 rounded">
                    💡 <strong>Important:</strong> Make sure to include the exact destination tag and memo 
                    to ensure your payment is processed correctly.
                  </div>
                </CardContent>
              </Card>

              {/* Transaction Hash Input */}
              <Card>
                <CardHeader>
                  <CardTitle>Verify Payment</CardTitle>
                  <CardDescription>
                    After sending the payment, enter your transaction hash to complete the purchase.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm text-slate-400">Transaction Hash:</label>
                    <input
                      type="text"
                      value={transactionHash}
                      onChange={(e) => setTransactionHash(e.target.value)}
                      placeholder="Enter your transaction hash here..."
                      className="w-full mt-1 p-2 bg-slate-800 border border-slate-600 rounded focus:border-blue-400 focus:outline-none"
                      data-testid="input-transaction-hash"
                    />
                  </div>
                  
                  <Button
                    onClick={handleVerifyPayment}
                    disabled={!transactionHash.trim() || verifyPayment.isPending}
                    className="w-full"
                    data-testid="button-verify-payment"
                  >
                    {verifyPayment.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying Payment...
                      </>
                    ) : (
                      'Verify Payment & Complete Purchase'
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Cancel Button */}
          <div className="flex justify-end">
            <Button variant="outline" onClick={handleClose} data-testid="button-cancel">
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
