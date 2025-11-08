import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Check, X, Loader2, ImageOff } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { clearAllStaleSessions } from "@/utils/session-cleanup";

interface NFTOffer {
  offer_index: string;
  nft_id: string;
  nft_name?: string;
  nft_image?: string;
  nft_description?: string;
  nft_collection?: string;
  offer_type: 'buy' | 'sell';
  amount: string;
  currency: string;
  from_address: string;
  status: string;
}

export function NFTOffersSimple({ walletAddress }: { walletAddress: string }) {
  const [offers, setOffers] = useState<NFTOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingOffer, setProcessingOffer] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<NFTOffer | null>(null);
  const { toast } = useToast();

  // Fetch NFT offers
  const fetchOffers = async () => {
    if (!walletAddress) return;
    
    setLoading(true);
    try {
      // Add cache busting to ensure fresh data
      const timestamp = Date.now();
      const response = await fetch(`/api/nft-offers/${walletAddress}?t=${timestamp}`);
      const data = await response.json() as any;
      
      if (data.success) {
        setOffers(data.offers);
        console.log(`✅ Loaded ${data.offers.length} NFT offers (fresh data)`);
      }
    } catch (error) {
      console.error('Error fetching offers:', error);
    } finally {
      setLoading(false);
    }
  };

  // Accept NFT offer
  const acceptOffer = async (offer: NFTOffer) => {
    if (!password) {
      toast({
        title: "Password Required",
        description: "Please enter your wallet password",
        variant: "destructive"
      });
      return;
    }

    setProcessingOffer(offer.offer_index);
    
    try {
      // Clear all stale sessions comprehensively
      clearAllStaleSessions();
      
      // Create fresh NFT session for the current wallet
      const sessionResponse = await fetch('/api/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          walletAddress: walletAddress 
        })
      });
      
      if (!sessionResponse.ok) {
        throw new Error('Failed to create NFT session');
      }
      
      const sessionData = await sessionResponse.json();
      const sessionToken = sessionData.sessionToken;
      
      console.log('🔍 Frontend - Session response:', sessionData);
      console.log(`🎯 Frontend - Using NFT session token: ${sessionToken?.slice(0, 20)}...`);
      console.log(`🎯 Frontend - Full session token: ${sessionToken}`);
      
      const response = await fetch(`/api/nft-offers/${offer.offer_index}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          password,
          offerType: offer.offer_type
        })
      });

      const result = await response.json() as any;
      
      console.log('🔍 Frontend - Accept response:', result);
      console.log('🔍 Frontend - Response status:', response.status);
      
      if (result.success) {
        toast({
          title: "Success",
          description: `NFT offer accepted successfully`
        });
        
        // Remove accepted offer from list
        setOffers(offers.filter(o => o.offer_index !== offer.offer_index));
        setShowPasswordDialog(false);
        setPassword('');
      } else {
        // Check for specific "Invalid session" error - but don't show it to user anymore
        if (result.error === 'Invalid session') {
          console.log('❌ Frontend detected Invalid session error - clearing cache and retrying...');
          // Clear sessions and create fresh one instead of reloading
          clearAllStaleSessions();
          setTimeout(() => {
            // Retry the NFT acceptance with fresh session
            acceptOffer(offer);
          }, 1000);
          return;
        }
        
        toast({
          title: "Error", 
          description: result.error || "Failed to accept offer",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Accept offer error:', error);
      toast({
        title: "Error",
        description: "Failed to process offer",
        variant: "destructive"
      });
    } finally {
      setProcessingOffer(null);
    }
  };

  // Reject offer
  const rejectOffer = async (offerId: string) => {
    try {
      // Clear all stale sessions comprehensively
      clearAllStaleSessions();
      
      // Create fresh NFT session for the current wallet
      const sessionResponse = await fetch('/api/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          walletAddress: walletAddress 
        })
      });
      
      if (!sessionResponse.ok) {
        throw new Error('Failed to create NFT session');
      }
      
      const sessionData = await sessionResponse.json();
      const sessionToken = sessionData.sessionToken;
      
      await fetch(`/api/nft-offers/${offerId}/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });
      
      // Remove from UI
      setOffers(offers.filter(o => o.offer_index !== offerId));
      
      toast({
        title: "Offer Rejected",
        description: "The NFT offer has been rejected"
      });
    } catch (error) {
      console.error('Error rejecting offer:', error);
      toast({
        title: "Error",
        description: "Failed to reject offer",
        variant: "destructive"
      });
    }
  };

  // Open password dialog
  const openPasswordDialog = (offer: NFTOffer) => {
    setSelectedOffer(offer);
    setShowPasswordDialog(true);
  };

  useEffect(() => {
    // Clear any stale data and fetch fresh offers immediately
    setOffers([]);
    fetchOffers();
    // Set up polling for updates
    const interval = setInterval(fetchOffers, 30000);
    return () => clearInterval(interval);
  }, [walletAddress]);

  if (loading && offers.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading NFT offers...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (offers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>NFT Offers</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No pending NFT offers</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>NFT Offers ({offers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {offers.map((offer) => (
              <div 
                key={offer.offer_index} 
                className="border rounded-lg overflow-hidden bg-card cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => window.open(`/nft/${offer.nft_id}`, '_blank')}
              >
                {/* NFT Image - Smaller */}
                <div className="relative aspect-[4/3] bg-muted">
                  {offer.nft_image ? (
                    <img 
                      src={offer.nft_image} 
                      alt={offer.nft_name || 'NFT'} 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <div className={`absolute inset-0 flex items-center justify-center ${offer.nft_image ? 'hidden' : ''}`}>
                    <ImageOff className="h-8 w-8 text-muted-foreground" />
                  </div>
                  
                  {/* Offer Type Badge */}
                  <div className="absolute top-2 right-2">
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                      offer.offer_type === 'buy' 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                    }`}>
                      {offer.offer_type === 'buy' ? 'Buy Offer' : 'Sell Offer'}
                    </div>
                  </div>
                </div>
                
                {/* NFT Details - Compact */}
                <div className="p-3">
                  <h4 className="font-semibold text-sm truncate mb-1">
                    {offer.nft_name || `NFT #${offer.nft_id?.slice(0, 8)}`}
                  </h4>
                  
                  <div className="space-y-1 mb-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">Price</span>
                      <span className="font-bold text-sm">
                        {offer.amount} {offer.currency}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">From</span>
                      <span className="text-xs font-mono">
                        {offer.from_address.slice(0, 4)}...{offer.from_address.slice(-3)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Action Buttons - Compact */}
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        openPasswordDialog(offer);
                      }}
                      disabled={processingOffer === offer.offer_index}
                    >
                      {processingOffer === offer.offer_index ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          Processing
                        </>
                      ) : (
                        <>
                          <Check className="h-3 w-3 mr-1" />
                          Accept
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        rejectOffer(offer.offer_index);
                      }}
                      disabled={processingOffer === offer.offer_index}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter Wallet Password</DialogTitle>
            <DialogDescription>
              Enter your password to accept this NFT offer
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your wallet password"
              />
            </div>
            {selectedOffer && (
              <div className="text-sm space-y-1">
                <p>NFT: {selectedOffer.nft_name || `#${selectedOffer.nft_id?.slice(0, 8)}`}</p>
                <p>Amount: {selectedOffer.amount} {selectedOffer.currency}</p>
                <p>Type: {selectedOffer.offer_type === 'buy' ? 'Buy Offer' : 'Sell Offer'}</p>
              </div>
            )}
            <div className="flex gap-2">
              <Button 
                onClick={() => selectedOffer && acceptOffer(selectedOffer)}
                disabled={!password || processingOffer !== null}
                className="flex-1"
              >
                {processingOffer ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Processing...
                  </>
                ) : (
                  'Accept Offer'
                )}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowPasswordDialog(false);
                  setPassword('');
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
