import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { ArrowUpRight, ArrowDownLeft, Gavel, Heart, Tag, ShoppingCart, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';

interface NFTOffer {
  id: string;
  type: 'incoming_transfer' | 'outgoing_transfer' | 'auction' | 'offer_received' | 'listed_item' | 'offer_made';
  nftName: string;
  nftImage: string;
  collection: string;
  price: number;
  currency: string;
  status: 'active' | 'pending' | 'completed' | 'cancelled';
  fromAddress?: string;
  toAddress?: string;
  expiresAt?: string;
  createdAt: string;
}

export default function NFTOffers() {
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState('incoming_transfers');
  const [connectedWallet, setConnectedWallet] = useState<string>('');

  // Get connected wallet address
  useEffect(() => {
    const riddle = localStorage.getItem('riddleWallet');
    if (riddle) {
      const wallet = JSON.parse(riddle);
      setConnectedWallet(wallet.xrpAddress || '');
    }
  }, []);

  // Fetch offers for connected wallet using real XRPL API
  const { data: offersData = {}, isLoading } = useQuery({
    queryKey: [`/api/nft-offers/incoming`, connectedWallet],
    queryFn: async () => {
      if (!connectedWallet) throw new Error('Wallet address required');
      const response = await fetch(`/api/nft-offers/incoming`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch offers');
      return response.json();
    },
    enabled: !!connectedWallet,
  });
  
  // Extract offers from response
  const offers = offersData?.offers || offersData?.data?.offers || [];

  const getOffersByType = (type: string) => {
    return offers.filter((offer: NFTOffer) => offer.type === type);
  };

  const handleAcceptOffer = async (offerId: string) => {
    try {
      const response = await fetch(`/api/nft-offers/${offerId}/accept`, {
        method: 'POST',
      });
      if (response.ok) {
        toast({
          title: "Offer Accepted",
          description: "The offer has been accepted successfully",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to accept offer",
        variant: "destructive",
      });
    }
  };

  const handleCancelOffer = async (offerId: string) => {
    try {
      const response = await fetch(`/api/nft-offers/${offerId}/cancel`, {
        method: 'POST',
      });
      if (response.ok) {
        toast({
          title: "Offer Cancelled",
          description: "The offer has been cancelled",
        });
      }
    } catch (error) {
      toast({
        title: "Error", 
        description: "Failed to cancel offer",
        variant: "destructive",
      });
    }
  };

  const OfferCard = ({ offer }: { offer: NFTOffer }) => (
    <div className="flex items-center p-4 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
      <Avatar className="w-12 h-12 mr-4">
        <AvatarImage src={offer.nftImage} alt={offer.nftName} />
        <AvatarFallback>{offer.nftName.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      
      <div className="flex-1">
        <h4 className="font-semibold text-sm">{offer.nftName}</h4>
        <p className="text-xs text-gray-500">{offer.collection}</p>
        <div className="flex items-center mt-1">
          <span className="font-bold text-sm">{offer.price} {offer.currency.toUpperCase()}</span>
          <Badge variant="outline" className="ml-2 text-xs">
            {offer.type === 'offer_received' ? 'Buy offer' : 
             offer.type === 'listed_item' ? 'Sell offer' :
             offer.type === 'auction' ? 'Auction' :
             offer.type === 'offer_made' ? 'Buy offer' : 'Transfer'}
          </Badge>
        </div>
      </div>

      <div className="flex gap-2">
        {offer.type === 'offer_received' && (
          <>
            <Button size="sm" onClick={() => handleAcceptOffer(offer.id)}>
              Accept
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleCancelOffer(offer.id)}>
              Decline
            </Button>
          </>
        )}
        {offer.type === 'offer_made' && (
          <Button size="sm" variant="outline" onClick={() => handleCancelOffer(offer.id)}>
            Cancel
          </Button>
        )}
        {(offer.type === 'listed_item' || offer.type === 'auction') && (
          <Button size="sm" variant="outline">
            <ExternalLink className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );

  const TabSection = ({ type, title, icon }: { type: string; title: string; icon: React.ReactNode }) => {
    const typeOffers = getOffersByType(type);
    
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-semibold">{title}</h3>
          <Badge variant="secondary">{typeOffers.length}</Badge>
        </div>
        
        {typeOffers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No {title.toLowerCase()} found
          </div>
        ) : (
          <div className="space-y-3">
            {typeOffers.map((offer) => (
              <OfferCard key={offer.id} offer={offer} />
            ))}
          </div>
        )}
      </div>
    );
  };

  if (!connectedWallet) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-gray-500">Please connect your wallet to view NFT offers</p>
          <Button className="mt-4" onClick={() => window.location.href = '/wallet-login'}>
            Connect Wallet
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>NFT Offers & Transfers</CardTitle>
          <p className="text-sm text-gray-500">
            Manage your NFT transactions for {connectedWallet.slice(0, 6)}...{connectedWallet.slice(-4)}
          </p>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
              <TabsTrigger value="incoming_transfers" className="text-xs">Incoming</TabsTrigger>
              <TabsTrigger value="outgoing_transfers" className="text-xs">Outgoing</TabsTrigger>
              <TabsTrigger value="auctions" className="text-xs">Auctions</TabsTrigger>
              <TabsTrigger value="offers_received" className="text-xs">Offers In</TabsTrigger>
              <TabsTrigger value="listed_items" className="text-xs">Listed</TabsTrigger>
              <TabsTrigger value="offers_made" className="text-xs">Offers Out</TabsTrigger>
            </TabsList>

            <TabsContent value="incoming_transfers" className="mt-6">
              <TabSection 
                type="incoming_transfer" 
                title="Incoming transfers" 
                icon={<ArrowDownLeft className="w-4 h-4 text-blue-500" />} 
              />
            </TabsContent>

            <TabsContent value="outgoing_transfers" className="mt-6">
              <TabSection 
                type="outgoing_transfer" 
                title="Outgoing transfers" 
                icon={<ArrowUpRight className="w-4 h-4 text-orange-500" />} 
              />
            </TabsContent>

            <TabsContent value="auctions" className="mt-6">
              <TabSection 
                type="auction" 
                title="Auctions" 
                icon={<Gavel className="w-4 h-4 text-purple-500" />} 
              />
            </TabsContent>

            <TabsContent value="offers_received" className="mt-6">
              <TabSection 
                type="offer_received" 
                title="Offers received" 
                icon={<Heart className="w-4 h-4 text-red-500" />} 
              />
            </TabsContent>

            <TabsContent value="listed_items" className="mt-6">
              <TabSection 
                type="listed_item" 
                title="Listed items" 
                icon={<Tag className="w-4 h-4 text-green-500" />} 
              />
            </TabsContent>

            <TabsContent value="offers_made" className="mt-6">
              <TabSection 
                type="offer_made" 
                title="Offers made" 
                icon={<ShoppingCart className="w-4 h-4 text-indigo-500" />} 
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
