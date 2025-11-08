import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CheckCircle2, AlertCircle, DollarSign, TrendingUp, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface NFTBuyModalProps {
  isOpen: boolean;
  onClose: () => void;
  nft: {
    nftokenID: string;
    name: string;
    image?: string;
    sellPrice: number;
    sellerWallet?: string;
  };
  buyerWallet: string;
  onSuccess?: (result: any) => void;
}

interface FeeOption {
  type: string;
  name: string;
  description: string;
  fee: number | null;
  feePercentage: number | null;
  brokerWallet: string | null;
}

export function NFTBuyModal({ isOpen, onClose, nft, buyerWallet, onSuccess }: NFTBuyModalProps) {
  const { toast } = useToast();
  const [selectedFeeType, setSelectedFeeType] = useState('direct');
  const [customFeeAmount, setCustomFeeAmount] = useState(0.5);
  const [feeOptions, setFeeOptions] = useState<FeeOption[]>([]);
  const [costBreakdown, setCostBreakdown] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [buyerSeed, setBuyerSeed] = useState('');

  // Fetch fee options when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchFeeOptions();
    }
  }, [isOpen]);

  // Calculate cost when fee type or custom amount changes
  useEffect(() => {
    if (selectedFeeType && nft.sellPrice) {
      calculateCost();
    }
  }, [selectedFeeType, customFeeAmount, nft.sellPrice]);

  const fetchFeeOptions = async () => {
    try {
      const response = await apiRequest('/api/nft/fee-options');
      const data = await response.json() as any;
      setFeeOptions(data.feeOptions || []);
    } catch (error) {
      console.error('Failed to fetch fee options:', error);
    }
  };

  const calculateCost = async () => {
    try {
      const customFee = selectedFeeType === 'custom' ? customFeeAmount : 
                       selectedFeeType === 'riddleswap_low' ? 0.5 :
                       selectedFeeType === 'riddleswap_standard' ? 1.0 : 0;

      const response = await apiRequest('/api/nft/calculate-cost', {
        method: 'POST',
        body: JSON.stringify({
          sellPrice: nft.sellPrice,
          transactionType: selectedFeeType === 'direct' ? 'direct' : 'brokered',
          customFee: customFee
        })
      });

      const data = await response.json() as any;
      setCostBreakdown(data.cost);
    } catch (error) {
      console.error('Failed to calculate cost:', error);
    }
  };

  const handleBuyNFT = async () => {
    if (!buyerSeed) {
      toast({
        title: "Wallet Required",
        description: "Please enter your wallet seed to proceed",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);

    try {
      let endpoint = '/api/nft/buy-direct';
      let payload: any = {
        nftokenID: nft.nftokenID,
        buyerWallet: buyerWallet,
        sellerWallet: nft.sellerWallet || '',
        sellPrice: nft.sellPrice,
        buyerSeed: buyerSeed
      };

      if (selectedFeeType !== 'direct') {
        endpoint = '/api/nft/buy-brokered';
        const customFee = selectedFeeType === 'custom' ? customFeeAmount :
                         selectedFeeType === 'riddleswap_low' ? 0.5 :
                         selectedFeeType === 'riddleswap_standard' ? 1.0 : 0;

        const brokerWallet = feeOptions.find(opt => opt.type === selectedFeeType)?.brokerWallet;
        
        payload = {
          ...payload,
          customFee: customFee,
          brokerWallet: brokerWallet
        };
      }

      const response = await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      const data = await response.json() as any;

      if (data.success) {
        toast({
          title: "Purchase Successful!",
          description: `NFT purchased for ${data.totalCost} XRP. Transaction: ${data.transactionHash?.slice(0, 8)}...`
        });

        console.log(`✅ [NFT BUY] Purchase completed:`, data);

        if (onSuccess) {
          onSuccess(data);
        }

        setTimeout(() => {
          onClose();
          setBuyerSeed(''); // Clear sensitive data
        }, 2000);
      } else {
        throw new Error(data.error || 'Purchase failed');
      }

    } catch (error) {
      console.error('❌ [NFT BUY] Purchase failed:', error);
      toast({
        title: "Purchase Failed",
        description: error instanceof Error ? error.message : 'Failed to purchase NFT',
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedOption = feeOptions.find(opt => opt.type === selectedFeeType);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-[95vw] sm:w-[90%] sm:max-w-2xl lg:max-w-3xl xl:max-w-4xl max-h-[90vh] overflow-y-auto bg-gray-900 border-gray-700 text-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Buy NFT - {nft.name}
          </CardTitle>
        </CardHeader>
        <CardContent>
        
        <div className="space-y-6">
          {/* NFT Info */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                {nft.image && (
                  <img 
                    src={nft.image} 
                    alt={nft.name}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                )}
                <div>
                  <h3 className="font-semibold">{nft.name}</h3>
                  <p className="text-sm text-gray-500">Base Price: {nft.sellPrice} XRP</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Fee Selection */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Choose Payment Option</Label>
            <RadioGroup value={selectedFeeType} onValueChange={setSelectedFeeType}>
              {feeOptions.map((option) => (
                <div key={option.type} className="flex items-center space-x-2 p-3 border rounded-lg">
                  <RadioGroupItem value={option.type} id={option.type} />
                  <div className="flex-1">
                    <label htmlFor={option.type} className="flex items-center justify-between cursor-pointer">
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {option.name}
                          {option.type === 'direct' && <Zap className="w-4 h-4 text-green-500" />}
                          {option.type === 'riddleswap_low' && <TrendingUp className="w-4 h-4 text-blue-500" />}
                        </div>
                        <div className="text-sm text-gray-500">{option.description}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">
                          {option.fee !== null ? `+${option.fee} XRP` : 'Custom'}
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              ))}
            </RadioGroup>

            {/* Custom Fee Input */}
            {selectedFeeType === 'custom' && (
              <div className="space-y-2">
                <Label htmlFor="customFee">Custom Fee Amount (XRP)</Label>
                <Input
                  id="customFee"
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  value={customFeeAmount}
                  onChange={(e) => setCustomFeeAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0.5"
                />
              </div>
            )}
          </div>

          {/* Cost Breakdown */}
          {costBreakdown && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Cost Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span>Base Price:</span>
                  <span>{costBreakdown.basePrice.toFixed(2)} XRP</span>
                </div>
                {costBreakdown.brokerFee > 0 && (
                  <div className="flex justify-between">
                    <span>Marketplace Fee:</span>
                    <span>{costBreakdown.brokerFee.toFixed(2)} XRP</span>
                  </div>
                )}
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Network Fee:</span>
                  <span>{costBreakdown.networkFee.toFixed(6)} XRP</span>
                </div>
                <hr />
                <div className="flex justify-between font-semibold">
                  <span>Total Cost:</span>
                  <span>{costBreakdown.totalCost.toFixed(6)} XRP</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Wallet Authentication */}
          <div className="space-y-2">
            <Label htmlFor="buyerSeed">Wallet Seed (Required for Transaction)</Label>
            <Input
              id="buyerSeed"
              type="password"
              value={buyerSeed}
              onChange={(e) => setBuyerSeed(e.target.value)}
              placeholder="Enter your wallet seed phrase"
              className="font-mono"
            />
            <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-2 rounded">
              ⚠️ Your seed is used only for this transaction and never stored
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={handleBuyNFT}
              disabled={isProcessing || !buyerSeed || !costBreakdown}
              className="flex-1"
              size="lg"
            >
              {isProcessing ? (
                "Processing..."
              ) : (
                <>
                  <DollarSign className="w-4 h-4 mr-2" />
                  Buy for {costBreakdown?.totalCost?.toFixed(6) || '...'} XRP
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isProcessing}
            >
              Cancel
            </Button>
          </div>

          {/* Selected Option Summary */}
          {selectedOption && (
            <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-sm font-medium text-blue-700 dark:text-blue-300">
                {selectedOption.name}
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400">
                {selectedOption.description}
              </div>
            </div>
          )}
        </div>
        </CardContent>
      </Card>
    </div>
  );
}
