import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  TrendingUp,
  Info,
  Percent,
  AlertCircle,
  Shield
} from 'lucide-react';

interface BrokerOfferManagerProps {
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

const BROKER_FEE_PERCENTAGE = 1; // 1% broker fee
const BROKER_ADDRESS = 'rGLzXKif4ksBZe2MY6RZT9m69hdgzsXG4X';

export function BrokerOfferManager({ nftId, nftName, currentOwner, onOfferUpdate }: BrokerOfferManagerProps) {
  const [sellOffers, setSellOffers] = useState<Offer[]>([]);
  const [buyOffers, setBuyOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Form state for creating offers
  const [sellPrice, setSellPrice] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [expirationDays, setExpirationDays] = useState('');
  
  const { toast } = useToast();

  const fetchOffers = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/broker/nft/offers/${nftId}`);
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
      
      const response = await fetch('/api/broker/nft/offers/create-sell-new', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          nftTokenId: nftId,
          priceXrp: parseFloat(sellPrice),
          expirationDays: expirationDays ? parseInt(expirationDays) : undefined
        })
      });

      const result = await response.json() as any;
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to create sell offer');
      }

      toast({
        title: "Sell Offer Created",
        description: `Listed ${nftName || 'NFT'} for ${sellPrice} XRP (restricted to broker)`,
      });
      
      setSellPrice('');
      setExpirationDays('');
      fetchOffers();
      onOfferUpdate?.();
      
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create sell offer",
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
        title: "Error",
        description: "Current owner address is required",
        variant: "destructive",
      });
      return;
    }

    setActionLoading('buy');
    try {
      const sessionToken = getSessionToken();
      const basePriceXrp = parseFloat(buyPrice);
      const totalWithFee = basePriceXrp * (1 + BROKER_FEE_PERCENTAGE / 100);
      
      const response = await fetch('/api/broker/nft/offers/create-buy-new', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          nftTokenId: nftId,
          ownerAddress: currentOwner,
          basePriceXrp,
          expirationDays: expirationDays ? parseInt(expirationDays) : undefined
        })
      });

      const result = await response.json() as any;
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to create buy offer');
      }

      toast({
        title: "Buy Offer Created",
        description: `Offered ${buyPrice} XRP + ${(totalWithFee - basePriceXrp).toFixed(6)} XRP broker fee (total: ${totalWithFee.toFixed(6)} XRP)`,
      });
      
      setBuyPrice('');
      setExpirationDays('');
      fetchOffers();
      onOfferUpdate?.();
      
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create buy offer",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const cancelOffer = async (offerId: string, offerType: 'sell' | 'buy') => {
    setActionLoading(offerId);
    try {
      const sessionToken = getSessionToken();
      
      const response = await fetch('/api/broker/nft/offers/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ offerId })
      });

      const result = await response.json() as any;
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to cancel offer');
      }

      toast({
        title: "Offer Cancelled",
        description: `Successfully cancelled ${offerType} offer`,
      });
      
      fetchOffers();
      onOfferUpdate?.();
      
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to cancel offer",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const buyNow = async (sellOfferId: string, amount: string) => {
    setActionLoading(sellOfferId);
    try {
      const sessionToken = getSessionToken();
      const priceXrp = parseFloat(dropsToXrp(amount));
      const brokerFee = priceXrp * (BROKER_FEE_PERCENTAGE / 100);
      const totalAmount = priceXrp + brokerFee;
      
      const confirmed = window.confirm(
        `Purchase NFT for ${priceXrp} XRP + ${brokerFee.toFixed(6)} XRP broker fee (total: ${totalAmount.toFixed(6)} XRP)?`
      );
      
      if (!confirmed) {
        setActionLoading(null);
        return;
      }
      
      const response = await fetch('/api/broker/nft/offers/buy-now-brokered', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          nftTokenId: nftId,
          sellOfferId
        })
      });

      const result = await response.json() as any;
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to complete purchase');
      }

      toast({
        title: "Purchase Successful!",
        description: `Successfully purchased ${nftName || 'NFT'} for ${totalAmount.toFixed(6)} XRP`,
      });
      
      fetchOffers();
      onOfferUpdate?.();
      
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to complete purchase",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const dropsToXrp = (drops: string | number): string => {
    const dropsNum = typeof drops === 'string' ? parseInt(drops) : drops;
    return (dropsNum / 1000000).toFixed(6);
  };

  const formatAddress = (address: string) => {
    if (!address) return 'Unknown';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const isOwnOffer = (offerOwner: string) => {
    const sessionData = localStorage.getItem('sessionData');
    if (!sessionData) return false;
    const session = JSON.parse(sessionData);
    return session.walletAddress === offerOwner;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gavel className="h-5 w-5" />
          NFT Broker Marketplace
        </CardTitle>
        <CardDescription>
          Create and manage offers with automated broker fee injection ({BROKER_FEE_PERCENTAGE}% fee)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert className="mb-4">
          <Info className="h-4 w-4" />
          <AlertDescription>
            All transactions are handled by our secure broker system ({formatAddress(BROKER_ADDRESS)}) 
            with a {BROKER_FEE_PERCENTAGE}% fee for marketplace services.
          </AlertDescription>
        </Alert>

        <Tabs defaultValue="offers" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="offers">Active Offers</TabsTrigger>
            <TabsTrigger value="sell">Create Sell</TabsTrigger>
            <TabsTrigger value="buy">Make Offer</TabsTrigger>
          </TabsList>

          <TabsContent value="offers" className="space-y-4">
            <div className="space-y-4">
              {/* Sell Offers */}
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Sell Offers ({sellOffers.length})
                </h3>
                <div className="space-y-2">
                  {loading ? (
                    <div className="text-center py-4 text-muted-foreground">
                      <RefreshCw className="h-4 w-4 animate-spin inline mr-2" />
                      Loading offers...
                    </div>
                  ) : sellOffers.length > 0 ? (
                    sellOffers.map(offer => (
                      <div key={offer.nft_offer_index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{dropsToXrp(offer.amount)} XRP</span>
                            {offer.destination === BROKER_ADDRESS && (
                              <Badge variant="secondary" className="text-xs">
                                <Shield className="h-3 w-3 mr-1" />
                                Broker
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            From: {formatAddress(offer.owner)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {isOwnOffer(offer.owner) ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => cancelOffer(offer.nft_offer_index, 'sell')}
                              disabled={actionLoading === offer.nft_offer_index}
                            >
                              {actionLoading === offer.nft_offer_index ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <X className="h-4 w-4" />
                              )}
                              Cancel
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => buyNow(offer.nft_offer_index, offer.amount)}
                              disabled={actionLoading === offer.nft_offer_index}
                            >
                              {actionLoading === offer.nft_offer_index ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <ShoppingCart className="h-4 w-4" />
                              )}
                              Buy Now
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center py-4 text-muted-foreground">No sell offers available</p>
                  )}
                </div>
              </div>

              {/* Buy Offers */}
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Gavel className="h-4 w-4" />
                  Buy Offers ({buyOffers.length})
                </h3>
                <div className="space-y-2">
                  {loading ? (
                    <div className="text-center py-4 text-muted-foreground">
                      <RefreshCw className="h-4 w-4 animate-spin inline mr-2" />
                      Loading offers...
                    </div>
                  ) : buyOffers.length > 0 ? (
                    buyOffers.map(offer => {
                      const offerAmount = parseFloat(dropsToXrp(offer.amount));
                      const sellerReceives = offerAmount / (1 + BROKER_FEE_PERCENTAGE / 100);
                      const brokerFee = offerAmount - sellerReceives;
                      
                      return (
                        <div key={offer.nft_offer_index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{sellerReceives.toFixed(6)} XRP</span>
                              <Badge variant="outline" className="text-xs">
                                <Percent className="h-3 w-3 mr-1" />
                                +{brokerFee.toFixed(6)} fee
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              From: {formatAddress(offer.owner)} · Total: {offerAmount.toFixed(6)} XRP
                            </p>
                          </div>
                          <div className="flex gap-2">
                            {isOwnOffer(offer.owner) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => cancelOffer(offer.nft_offer_index, 'buy')}
                                disabled={actionLoading === offer.nft_offer_index}
                              >
                                {actionLoading === offer.nft_offer_index ? (
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                  <X className="h-4 w-4" />
                                )}
                                Cancel
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-center py-4 text-muted-foreground">No buy offers available</p>
                  )}
                </div>
              </div>

              <Button
                onClick={fetchOffers}
                disabled={loading}
                variant="outline"
                className="w-full"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh Offers
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="sell" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="sellPrice">Sell Price (XRP)</Label>
                <Input
                  id="sellPrice"
                  type="number"
                  step="0.000001"
                  placeholder="Enter price in XRP"
                  value={sellPrice}
                  onChange={(e) => setSellPrice(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  You will receive this amount. Buyer pays {BROKER_FEE_PERCENTAGE}% extra as broker fee.
                </p>
              </div>
              <div>
                <Label htmlFor="sellExpiration">Expiration (days, optional)</Label>
                <Input
                  id="sellExpiration"
                  type="number"
                  placeholder="Days until offer expires"
                  value={expirationDays}
                  onChange={(e) => setExpirationDays(e.target.value)}
                />
              </div>
              <Button
                onClick={createSellOffer}
                disabled={actionLoading === 'sell' || !sellPrice}
                className="w-full"
              >
                {actionLoading === 'sell' ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Tag className="h-4 w-4 mr-2" />
                )}
                Create Sell Offer
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="buy" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="buyPrice">Offer Price (XRP)</Label>
                <Input
                  id="buyPrice"
                  type="number"
                  step="0.000001"
                  placeholder="Enter offer price in XRP"
                  value={buyPrice}
                  onChange={(e) => setBuyPrice(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Seller receives this amount. You pay an additional {BROKER_FEE_PERCENTAGE}% broker fee 
                  ({buyPrice ? (parseFloat(buyPrice) * BROKER_FEE_PERCENTAGE / 100).toFixed(6) : '0'} XRP).
                </p>
                {buyPrice && (
                  <p className="text-xs font-medium mt-1">
                    Total: {(parseFloat(buyPrice) * (1 + BROKER_FEE_PERCENTAGE / 100)).toFixed(6)} XRP
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="buyExpiration">Expiration (days, optional)</Label>
                <Input
                  id="buyExpiration"
                  type="number"
                  placeholder="Days until offer expires"
                  value={expirationDays}
                  onChange={(e) => setExpirationDays(e.target.value)}
                />
              </div>
              <Button
                onClick={createBuyOffer}
                disabled={actionLoading === 'buy' || !buyPrice}
                className="w-full"
              >
                {actionLoading === 'buy' ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Gavel className="h-4 w-4 mr-2" />
                )}
                Make Buy Offer
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
