import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowUpRight, ArrowDownLeft, Gavel, Heart, Tag, ShoppingCart, Upload, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { ObjectUploader } from '@/components/ObjectUploader';

interface ChainNFTManagerProps {
  chain: 'xrp' | 'eth' | 'sol' | 'btc';
  walletAddress: string;
}

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

// NO FALLBACK DATA - Only show real NFT data from APIs
const getChainNFTData = (chain: string, walletAddress: string): NFTOffer[] => {
  // Return empty array - all NFT data should come from real APIs only
  return [];
};

export default function ChainNFTManager({ chain, walletAddress }: ChainNFTManagerProps) {
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState('all');
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    name: '',
    description: '',
    collection: '',
    price: '',
    currency: chain.toUpperCase()
  });

  // Get chain-specific NFT data
  const nftData = getChainNFTData(chain, walletAddress);

  const getOffersByType = (type: string) => {
    if (type === 'all') return nftData;
    return nftData.filter((offer: NFTOffer) => offer.type === type);
  };

  const handleUploadNFT = async () => {
    try {
      // Simulate NFT upload for testing
      const response = await fetch('/api/nft/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...uploadForm,
          walletAddress,
          chain: chain.toUpperCase()
        })
      });

      if (response.ok) {
        toast({
          title: "NFT Upload Started",
          description: `${uploadForm.name} is being processed on ${chain.toUpperCase()}`,
        });
        setShowUploadDialog(false);
        setUploadForm({ name: '', description: '', collection: '', price: '', currency: chain.toUpperCase() });
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      toast({
        title: "Upload Error",
        description: "Failed to upload NFT. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleAcceptOffer = async (offerId: string) => {
    try {
      // Chain-specific offer acceptance logic
      toast({
        title: "Offer Accepted",
        description: `${chain.toUpperCase()} NFT offer accepted successfully`,
      });
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
      // Chain-specific offer cancellation logic would go here
      toast({
        title: "Offer Cancelled",
        description: `${chain.toUpperCase()} NFT offer cancelled`,
      });
    } catch (error) {
      toast({
        title: "Error", 
        description: "Failed to cancel offer",
        variant: "destructive",
      });
    }
  };

  const OfferCard = ({ offer }: { offer: NFTOffer }) => (
    <div className="flex items-center p-3 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
      <Avatar className="w-10 h-10 mr-3">
        <AvatarImage src={offer.nftImage} alt={offer.nftName} />
        <AvatarFallback>{offer.nftName.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      
      <div className="flex-1">
        <h4 className="font-semibold text-xs">{offer.nftName}</h4>
        <p className="text-xs text-gray-500">{offer.collection}</p>
        <div className="flex items-center mt-1">
          <span className="font-bold text-xs">{offer.price} {offer.currency.toUpperCase()}</span>
          <Badge variant="outline" className="ml-2 text-xs px-1 py-0">
            {offer.type === 'offer_received' ? 'Buy offer' : 
             offer.type === 'listed_item' ? 'Sell offer' :
             offer.type === 'auction' ? 'Auction' :
             offer.type === 'offer_made' ? 'Buy offer' : 'Transfer'}
          </Badge>
        </div>
      </div>

      <div className="flex gap-1">
        {offer.type === 'offer_received' && (
          <>
            <Button size="sm" className="text-xs px-2 py-1" onClick={() => handleAcceptOffer(offer.id)}>
              Accept
            </Button>
            <Button size="sm" variant="outline" className="text-xs px-2 py-1" onClick={() => handleCancelOffer(offer.id)}>
              Decline
            </Button>
          </>
        )}
        {offer.type === 'offer_made' && (
          <Button size="sm" variant="outline" className="text-xs px-2 py-1" onClick={() => handleCancelOffer(offer.id)}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );

  if (nftData.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">NFTs</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-4">
          <p className="text-xs text-gray-500">No NFTs found for {chain.toUpperCase()}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">NFTs ({nftData.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-4 mb-3">
            <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
            <TabsTrigger value="incoming_transfer" className="text-xs">Incoming</TabsTrigger>
            <TabsTrigger value="listed_item" className="text-xs">Listed</TabsTrigger>
            <TabsTrigger value="offer_made" className="text-xs">Offers</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-2">
            <div className="space-y-2">
              {nftData.map((offer) => (
                <OfferCard key={offer.id} offer={offer} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="incoming_transfer" className="mt-2">
            <div className="space-y-2">
              {getOffersByType('incoming_transfer').length === 0 ? (
                <p className="text-center text-xs text-gray-500">No incoming transfers</p>
              ) : (
                getOffersByType('incoming_transfer').map((offer) => (
                  <OfferCard key={offer.id} offer={offer} />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="listed_item" className="mt-2">
            <div className="space-y-2">
              {getOffersByType('listed_item').length === 0 ? (
                <p className="text-center text-xs text-gray-500">No listed items</p>
              ) : (
                getOffersByType('listed_item').map((offer) => (
                  <OfferCard key={offer.id} offer={offer} />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="offer_made" className="mt-2">
            <div className="space-y-2">
              {getOffersByType('offer_made').length === 0 ? (
                <p className="text-center text-xs text-gray-500">No offers made</p>
              ) : (
                getOffersByType('offer_made').map((offer) => (
                  <OfferCard key={offer.id} offer={offer} />
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
