import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { 
  Check, 
  X, 
  Wallet, 
  Clock,
  DollarSign,
  CheckCircle,
  AlertTriangle,
  Loader2,
  ListChecks,
  Users
} from 'lucide-react';
import NFTFeeDisplay, { NFTFeeBreakdown } from './NFTFeeDisplay';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface NFTOffer {
  id: string;
  nftokenID: string;
  nftName?: string;
  nftImage?: string;
  amount: string;
  currency: string;
  fromAddress: string;
  expiresAt?: string;
  message?: string;
  createdAt: string;
}

interface NFTAcceptModuleProps {
  walletAddress: string;
  onOfferAccepted?: (offerId: string) => void;
  onOfferDeclined?: (offerId: string) => void;
}

export function NFTAcceptModule({ 
  walletAddress, 
  onOfferAccepted, 
  onOfferDeclined 
}: NFTAcceptModuleProps) {
  const [offers, setOffers] = useState<NFTOffer[]>([]);
  const [selectedOffers, setSelectedOffers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [walletPassword, setWalletPassword] = useState('');
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [showFeePreview, setShowFeePreview] = useState(false);
  const [actionType, setActionType] = useState<'accept' | 'decline'>('accept');
  const [feeBreakdowns, setFeeBreakdowns] = useState<{[key: string]: NFTFeeBreakdown}>({});
  const [calculatingFees, setCalculatingFees] = useState(false);
  const { toast } = useToast();

  // Fetch incoming offers
  useEffect(() => {
    fetchOffers();
  }, [walletAddress]);

  const fetchOffers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/nft/offers/incoming?walletAddress=${walletAddress}`);
      const data = await response.json() as any;
      
      if (data.success && data.offers) {
        setOffers(data.offers.filter((offer: any) => offer.status === 'pending'));
      }
    } catch (error) {
      console.error('Failed to fetch offers:', error);
      toast({
        title: "Error",
        description: "Failed to load NFT offers",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleOfferSelection = (offerId: string) => {
    const newSelected = new Set(selectedOffers);
    if (newSelected.has(offerId)) {
      newSelected.delete(offerId);
    } else {
      newSelected.add(offerId);
    }
    setSelectedOffers(newSelected);
  };

  const selectAllOffers = () => {
    if (selectedOffers.size === offers.length) {
      setSelectedOffers(new Set());
    } else {
      setSelectedOffers(new Set(offers.map(offer => offer.id)));
    }
  };

  const calculateFeesForOffers = async (offerIds: string[]) => {
    setCalculatingFees(true);
    try {
      const feePromises = offerIds.map(async (offerId) => {
        const offer = offers.find(o => o.id === offerId);
        if (!offer) return null;

        const response = await apiRequest('/api/nft/fees/accept-offer', {
          method: 'POST',
          body: JSON.stringify({
            nftokenID: offer.nftokenID,
            amount: parseFloat(offer.amount),
            isBrokered: false,
            isSellerAccepting: true
          })
        });

        const data = await response.json() as any;
        if (data.success) {
          return { offerId, feeBreakdown: data.feeBreakdown };
        }
        return null;
      });

      const results = await Promise.all(feePromises);
      const feeMap: {[key: string]: NFTFeeBreakdown} = {};
      
      results.forEach(result => {
        if (result) {
          feeMap[result.offerId] = result.feeBreakdown;
        }
      });

      setFeeBreakdowns(feeMap);
      return feeMap;
    } catch (error) {
      console.error('Failed to calculate fees:', error);
      toast({
        title: "Fee Calculation Failed",
        description: "Could not calculate transaction fees",
        variant: "destructive"
      });
      return {};
    } finally {
      setCalculatingFees(false);
    }
  };

  const handleBulkAction = async (action: 'accept' | 'decline') => {
    if (selectedOffers.size === 0) {
      toast({
        title: "No Selection",
        description: "Please select at least one offer",
        variant: "destructive"
      });
      return;
    }

    setActionType(action);
    
    if (action === 'accept') {
      // Calculate fees for selected offers first
      await calculateFeesForOffers(Array.from(selectedOffers));
      setShowFeePreview(true);
    } else {
      processBulkAction(action);
    }
  };

  const processBulkAction = async (action: 'accept' | 'decline') => {
    if (action === 'accept' && !walletPassword) {
      toast({
        title: "Password Required",
        description: "Please enter your wallet password to accept offers",
        variant: "destructive"
      });
      return;
    }

    setProcessing(true);
    const sessionToken = localStorage.getItem('sessionToken');
    
    try {
      const promises = Array.from(selectedOffers).map(async (offerId) => {
        const endpoint = action === 'accept' 
          ? `/api/nft/offers/${offerId}/accept`
          : `/api/nft/offers/${offerId}/decline`;

        const body: any = {
          responseMessage: action === 'accept' 
            ? 'Offer accepted via bulk action'
            : 'Offer declined via bulk action'
        };

        if (action === 'accept') {
          body.password = walletPassword;
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`
          },
          body: JSON.stringify(body)
        });

        const result = await response.json() as any;
        return { offerId, success: result.success, error: result.error };
      });

      const results = await Promise.all(promises);
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      if (successful.length > 0) {
        toast({
          title: `${action === 'accept' ? 'Accepted' : 'Declined'} ${successful.length} Offers`,
          description: `Successfully processed ${successful.length} NFT offers`
        });

        // Call callbacks for successful operations
        successful.forEach(result => {
          if (action === 'accept') {
            onOfferAccepted?.(result.offerId);
          } else {
            onOfferDeclined?.(result.offerId);
          }
        });

        // Refresh offers list
        await fetchOffers();
        setSelectedOffers(new Set());
      }

      if (failed.length > 0) {
        toast({
          title: "Some Operations Failed",
          description: `${failed.length} offers could not be processed`,
          variant: "destructive"
        });
      }

    } catch (error) {
      console.error('Bulk action failed:', error);
      toast({
        title: "Operation Failed",
        description: "Failed to process selected offers",
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
      setShowPasswordPrompt(false);
      setShowFeePreview(false);
      setWalletPassword('');
      setFeeBreakdowns({});
    }
  };

  const handleSingleAction = async (offerId: string, action: 'accept' | 'decline') => {
    setSelectedOffers(new Set([offerId]));
    handleBulkAction(action);
  };

  const formatTimeRemaining = (expiresAt?: string) => {
    if (!expiresAt) return 'No expiry';
    
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expired';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          <span>Loading offers...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              NFT Offers ({offers.length})
            </CardTitle>
            
            {offers.length > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAllOffers}
                  data-testid="button-select-all-offers"
                >
                  <ListChecks className="w-4 h-4 mr-1" />
                  {selectedOffers.size === offers.length ? 'Deselect All' : 'Select All'}
                </Button>
                
                {selectedOffers.size > 0 && (
                  <>
                    <Badge variant="secondary">
                      {selectedOffers.size} selected
                    </Badge>
                    <Button
                      size="sm"
                      onClick={() => handleBulkAction('accept')}
                      disabled={processing}
                      className="bg-green-600 hover:bg-green-700"
                      data-testid="button-bulk-accept"
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Accept Selected
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleBulkAction('decline')}
                      disabled={processing}
                      data-testid="button-bulk-decline"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Decline Selected
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-3">
          {offers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No pending offers found</p>
              <p className="text-sm">NFT offers will appear here when received</p>
            </div>
          ) : (
            offers.map((offer) => (
              <Card key={offer.id} className="border-l-4 border-l-blue-500">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selectedOffers.has(offer.id)}
                        onCheckedChange={() => toggleOfferSelection(offer.id)}
                        data-testid={`checkbox-offer-${offer.id}`}
                      />
                      
                      {offer.nftImage && (
                        <img 
                          src={offer.nftImage} 
                          alt={offer.nftName || 'NFT'} 
                          className="w-12 h-12 rounded-lg object-cover"
                          onError={(e) => e.currentTarget.style.display = 'none'}
                        />
                      )}
                      
                      <div>
                        <h4 className="font-semibold">{offer.nftName || 'Unknown NFT'}</h4>
                        <p className="text-sm text-muted-foreground">
                          From: {offer.fromAddress.slice(0, 8)}...{offer.fromAddress.slice(-6)}
                        </p>
                        <p className="text-sm font-medium text-green-600">
                          {offer.amount} {offer.currency}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div className="text-right text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTimeRemaining(offer.expiresAt)}
                        </div>
                      </div>
                      
                      <Button
                        size="sm"
                        onClick={() => handleSingleAction(offer.id, 'accept')}
                        disabled={processing}
                        className="bg-green-600 hover:bg-green-700"
                        data-testid={`button-accept-${offer.id}`}
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleSingleAction(offer.id, 'decline')}
                        disabled={processing}
                        data-testid={`button-decline-${offer.id}`}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {offer.message && (
                    <div className="mt-3 p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm">
                      <p className="italic">"{offer.message}"</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </CardContent>
      </Card>

      {/* Fee Preview Dialog */}
      <Dialog open={showFeePreview} onOpenChange={setShowFeePreview}>
        <DialogContent className="w-[95vw] sm:w-[90%] sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Review Fees & Costs</DialogTitle>
            <DialogDescription>
              Review all fees and royalties before accepting {selectedOffers.size} offer(s)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {calculatingFees ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                <span>Calculating fees for selected offers...</span>
              </div>
            ) : (
              <>
                {Array.from(selectedOffers).map(offerId => {
                  const offer = offers.find(o => o.id === offerId);
                  const feeBreakdown = feeBreakdowns[offerId];
                  
                  if (!offer || !feeBreakdown) return null;
                  
                  return (
                    <div key={offerId} className="border rounded-lg p-4">
                      <div className="flex items-center gap-3 mb-4">
                        {offer.nftImage && (
                          <img 
                            src={offer.nftImage} 
                            alt={offer.nftName || 'NFT'} 
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                        )}
                        <div>
                          <h4 className="font-semibold">{offer.nftName || 'Unknown NFT'}</h4>
                          <p className="text-sm text-muted-foreground">
                            From: {offer.fromAddress.slice(0, 8)}...{offer.fromAddress.slice(-6)}
                          </p>
                        </div>
                      </div>
                      
                      <NFTFeeDisplay 
                        feeBreakdown={feeBreakdown}
                        showDetailedBreakdown={true}
                        variant="compact"
                      />
                    </div>
                  );
                })}

                {/* Password Input */}
                <div className="space-y-2 pt-4 border-t">
                  <Label htmlFor="password">Wallet Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={walletPassword}
                    onChange={(e) => setWalletPassword(e.target.value)}
                    placeholder="Enter your wallet password"
                    data-testid="input-wallet-password"
                  />
                  <p className="text-xs text-muted-foreground">
                    Required to sign acceptance transactions
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowFeePreview(false);
                      setWalletPassword('');
                      setFeeBreakdowns({});
                    }}
                    className="flex-1"
                    disabled={processing}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      setShowFeePreview(false);
                      setShowPasswordPrompt(true);
                    }}
                    disabled={!walletPassword || processing}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    data-testid="button-proceed-to-accept"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Proceed to Accept {selectedOffers.size} Offers
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Password Prompt Modal */}
      {showPasswordPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                Confirm Acceptance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center py-4">
                <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-600" />
                <h3 className="font-semibold mb-2">Ready to Accept</h3>
                <p className="text-sm text-muted-foreground">
                  You are about to accept {selectedOffers.size} NFT offer(s). 
                  All fees have been reviewed and calculated.
                </p>
              </div>
              
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowPasswordPrompt(false);
                    setWalletPassword('');
                  }}
                  className="flex-1"
                  disabled={processing}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => processBulkAction('accept')}
                  disabled={processing || !walletPassword}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  data-testid="button-confirm-accept"
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Accept {selectedOffers.size} Offers
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
