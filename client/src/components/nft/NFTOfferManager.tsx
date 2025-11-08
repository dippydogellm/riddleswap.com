import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
  DollarSign, 
  ShoppingCart, 
  Tag, 
  Check, 
  X, 
  Clock, 
  RefreshCw,
  Gavel,
  TrendingUp
} from 'lucide-react';

interface NFTOfferManagerProps {
  nftId: string;
  nftName?: string;
  currentOwner?: string;
  onOfferUpdate?: () => void;
}

interface Offer {
  nft_offer_index: string;
  owner: string;
  amount: string;
  flags?: number;
  expiration?: number;
  destination?: string;
}

export function NFTOfferManager({ nftId, nftName, currentOwner, onOfferUpdate }: NFTOfferManagerProps) {
  const [sellOffers, setSellOffers] = useState<Offer[]>([]);
  const [buyOffers, setBuyOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Form state for creating offers
  const [sellPrice, setSellPrice] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [buyDestination, setBuyDestination] = useState('');
  
  const { toast } = useToast();

  const fetchOffers = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/nft/${nftId}/offers`);
      const data = await response.json() as any;
      
      if (data.success) {
        setSellOffers(data.sellOffers || []);
        setBuyOffers(data.buyOffers || []);
      }
    } catch (error) {
      console.error('Error fetching offers:', error);
      toast({
        title: "Error",
        description: "Failed to fetch NFT offers",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (nftId) {
      fetchOffers();
    }
  }, [nftId]);

  const getSessionToken = () => {
    const sessionData = localStorage.getItem('sessionData');
    if (!sessionData) throw new Error('Please log in first');
    const session = JSON.parse(sessionData);
    return session.sessionToken;
  };

  const createSellOffer = async () => {
    if (!sellPrice || parseFloat(sellPrice) <= 0) {
      toast({
        title: "Invalid Price",
        description: "Please enter a valid sell price",
        variant: "destructive",
      });
      return;
    }

    setActionLoading('sell');
    try {
      const sessionToken = getSessionToken();
      
      const response = await fetch('/api/nft/sell-offer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          nftId,
          amount: parseFloat(sellPrice)
        })
      });

      const result = await response.json() as any;
      
      if (!response.ok) {
        throw new Error(result.details || result.error);
      }

      toast({
        title: "Sell Offer Created",
        description: `Listed ${nftName || 'NFT'} for ${sellPrice} XRP`,
      });
      
      setSellPrice('');
      fetchOffers();
      onOfferUpdate?.();
      
    } catch (error) {
      console.error('Error creating sell offer:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to create sell offer',
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const createBuyOffer = async () => {
    if (!buyPrice || parseFloat(buyPrice) <= 0) {
      toast({
        title: "Invalid Price",
        description: "Please enter a valid buy price",
        variant: "destructive",
      });
      return;
    }

    if (!currentOwner) {
      toast({
        title: "Owner Unknown",
        description: "NFT owner address is required for buy offers",
        variant: "destructive",
      });
      return;
    }

    setActionLoading('buy');
    try {
      const sessionToken = getSessionToken();
      
      const response = await fetch('/api/nft/buy-offer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          nftId,
          amount: parseFloat(buyPrice),
          ownerAddress: currentOwner,
          destination: buyDestination || undefined
        })
      });

      const result = await response.json() as any;
      
      if (!response.ok) {
        throw new Error(result.details || result.error);
      }

      toast({
        title: "Buy Offer Created",
        description: `Offered ${buyPrice} XRP for ${nftName || 'NFT'}`,
      });
      
      setBuyPrice('');
      setBuyDestination('');
      fetchOffers();
      onOfferUpdate?.();
      
    } catch (error) {
      console.error('Error creating buy offer:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to create buy offer',
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const acceptSellOffer = async (offerId: string) => {
    setActionLoading(offerId);
    try {
      const sessionToken = getSessionToken();
      
      const response = await fetch('/api/nft/accept-sell-offer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          sellOfferId: offerId
        })
      });

      const result = await response.json() as any;
      
      if (!response.ok) {
        throw new Error(result.details || result.error);
      }

      toast({
        title: "Offer Accepted",
        description: "Successfully purchased the NFT",
      });
      
      fetchOffers();
      onOfferUpdate?.();
      
    } catch (error) {
      console.error('Error accepting sell offer:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to accept offer',
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const acceptBuyOffer = async (offerId: string) => {
    setActionLoading(offerId);
    try {
      const sessionToken = getSessionToken();
      
      const response = await fetch('/api/nft/accept-buy-offer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          buyOfferId: offerId
        })
      });

      const result = await response.json() as any;
      
      if (!response.ok) {
        throw new Error(result.details || result.error);
      }

      toast({
        title: "Offer Accepted",
        description: "Successfully sold the NFT",
      });
      
      fetchOffers();
      onOfferUpdate?.();
      
    } catch (error) {
      console.error('Error accepting buy offer:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to accept offer',
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const cancelOffers = async (offerIds: string[]) => {
    if (offerIds.length === 0) return;

    setActionLoading('cancel');
    try {
      const sessionToken = getSessionToken();
      
      const response = await fetch('/api/nft/cancel-offers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          offerIds
        })
      });

      const result = await response.json() as any;
      
      if (!response.ok) {
        throw new Error(result.details || result.error);
      }

      toast({
        title: "Offers Canceled",
        description: `Canceled ${offerIds.length} offer(s)`,
      });
      
      fetchOffers();
      onOfferUpdate?.();
      
    } catch (error) {
      console.error('Error canceling offers:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to cancel offers',
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const formatXRP = (drops: string) => {
    return (parseInt(drops) / 1000000).toFixed(6);
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="space-y-6">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Gavel className="h-5 w-5" />
          NFT Offers
        </h3>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={fetchOffers}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="view" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="view">View Offers</TabsTrigger>
          <TabsTrigger value="create">Create Offers</TabsTrigger>
        </TabsList>

        {/* View Offers Tab */}
        <TabsContent value="view" className="space-y-4">
          {/* Sell Offers */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Sell Offers ({sellOffers.length})
              </CardTitle>
              <CardDescription>
                Current listings for sale
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sellOffers.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No sell offers available</p>
              ) : (
                <div className="space-y-3">
                  {sellOffers.map((offer) => (
                    <div key={offer.nft_offer_index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">
                            {formatXRP(offer.amount)} XRP
                          </Badge>
                          <span className="text-sm text-gray-500">
                            by {formatAddress(offer.owner)}
                          </span>
                        </div>
                        {offer.expiration && (
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Clock className="h-3 w-3" />
                            Expires: {new Date(offer.expiration * 1000).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => acceptSellOffer(offer.nft_offer_index)}
                        disabled={actionLoading === offer.nft_offer_index}
                      >
                        {actionLoading === offer.nft_offer_index ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Check className="h-4 w-4 mr-1" />
                            Buy
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Buy Offers */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Buy Offers ({buyOffers.length})
              </CardTitle>
              <CardDescription>
                Offers to purchase this NFT
              </CardDescription>
            </CardHeader>
            <CardContent>
              {buyOffers.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No buy offers available</p>
              ) : (
                <div className="space-y-3">
                  {buyOffers.map((offer) => (
                    <div key={offer.nft_offer_index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {formatXRP(offer.amount)} XRP
                          </Badge>
                          <span className="text-sm text-gray-500">
                            by {formatAddress(offer.owner)}
                          </span>
                        </div>
                        {offer.expiration && (
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Clock className="h-3 w-3" />
                            Expires: {new Date(offer.expiration * 1000).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => acceptBuyOffer(offer.nft_offer_index)}
                        disabled={actionLoading === offer.nft_offer_index}
                      >
                        {actionLoading === offer.nft_offer_index ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Check className="h-4 w-4 mr-1" />
                            Accept
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Create Offers Tab */}
        <TabsContent value="create" className="space-y-4">
          {/* Create Sell Offer */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                List for Sale
              </CardTitle>
              <CardDescription>
                Create a sell offer for this NFT
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="sellPrice">Sale Price (XRP)</Label>
                <Input
                  id="sellPrice"
                  type="number"
                  step="0.000001"
                  min="0"
                  placeholder="0.000000"
                  value={sellPrice}
                  onChange={(e) => setSellPrice(e.target.value)}
                />
              </div>
              <Button 
                onClick={createSellOffer}
                disabled={actionLoading === 'sell' || !sellPrice}
                className="w-full"
              >
                {actionLoading === 'sell' ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Tag className="h-4 w-4 mr-2" />
                )}
                Create Sell Offer
              </Button>
            </CardContent>
          </Card>

          {/* Create Buy Offer */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Make Offer
              </CardTitle>
              <CardDescription>
                Make a buy offer for this NFT
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="buyPrice">Offer Price (XRP)</Label>
                <Input
                  id="buyPrice"
                  type="number"
                  step="0.000001"
                  min="0"
                  placeholder="0.000000"
                  value={buyPrice}
                  onChange={(e) => setBuyPrice(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="buyDestination">Specific Seller (optional)</Label>
                <Input
                  id="buyDestination"
                  placeholder="rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                  value={buyDestination}
                  onChange={(e) => setBuyDestination(e.target.value)}
                />
              </div>
              <Button 
                onClick={createBuyOffer}
                disabled={actionLoading === 'buy' || !buyPrice}
                className="w-full"
                variant="outline"
              >
                {actionLoading === 'buy' ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ShoppingCart className="h-4 w-4 mr-2" />
                )}
                Create Buy Offer
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
