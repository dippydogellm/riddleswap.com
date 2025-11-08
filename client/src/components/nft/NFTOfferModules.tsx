import React, { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { CreateOfferModule } from './CreateOfferModule';
import { AcceptOfferModule } from './AcceptOfferModule';
import { Plus, Check } from 'lucide-react';

interface NFTOffer {
  offer_index: string;
  nft_id: string;
  nft_name?: string;
  nft_image?: string;
  offer_type: 'buy' | 'sell';
  amount: string;
  currency: string;
  from_address: string;
  status: string;
  created_at?: string;
}

interface NFTOfferModulesProps {
  nftId: string;
  nftName?: string;
  nftImage?: string;
  currentPrice?: string;
  offers?: NFTOffer[];
  context?: 'xrp-wallet' | 'portfolio' | 'marketplace';
  onOfferUpdate?: () => void;
}

export function NFTOfferModules({
  nftId,
  nftName,
  nftImage,
  currentPrice,
  offers = [],
  context = 'marketplace',
  onOfferUpdate
}: NFTOfferModulesProps) {
  const [showCreateOffer, setShowCreateOffer] = useState(false);
  const [showAcceptOffer, setShowAcceptOffer] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<NFTOffer | null>(null);

  const handleOfferCreated = () => {
    setShowCreateOffer(false);
    onOfferUpdate?.();
  };

  const handleOfferAccepted = () => {
    setShowAcceptOffer(false);
    setSelectedOffer(null);
    onOfferUpdate?.();
  };

  const handleOfferRejected = () => {
    setShowAcceptOffer(false);
    setSelectedOffer(null);
    onOfferUpdate?.();
  };

  const openAcceptOffer = (offer: NFTOffer) => {
    setSelectedOffer(offer);
    setShowAcceptOffer(true);
  };

  return (
    <div className="space-y-4">
      {/* Create Offer Popover */}
      <Popover open={showCreateOffer} onOpenChange={setShowCreateOffer}>
        <PopoverTrigger asChild>
          <Button 
            className="w-full"
            variant="outline"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Offer
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-[420px] max-h-[600px] overflow-y-auto p-0" 
          align="center"
          side="top"
        >
          <CreateOfferModule
            nftId={nftId}
            nftName={nftName}
            nftImage={nftImage}
            currentPrice={currentPrice}
            onOfferCreated={handleOfferCreated}
            context={context}
          />
        </PopoverContent>
      </Popover>

      {/* Offers List */}
      {offers.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-semibold">Available Offers</h4>
          {offers.map((offer) => (
            <div 
              key={offer.offer_index} 
              className="border rounded-lg p-3 flex justify-between items-center"
            >
              <div>
                <p className="font-medium">
                  {offer.amount} {offer.currency}
                </p>
                <p className="text-sm text-muted-foreground">
                  {offer.offer_type === 'buy' ? 'Buy' : 'Sell'} offer
                </p>
              </div>
              <Popover open={showAcceptOffer && selectedOffer?.offer_index === offer.offer_index} onOpenChange={(open) => {
                if (!open) {
                  setShowAcceptOffer(false);
                  setSelectedOffer(null);
                }
              }}>
                <PopoverTrigger asChild>
                  <Button 
                    size="sm"
                    onClick={() => openAcceptOffer(offer)}
                  >
                    <Check className="w-3 h-3 mr-1" />
                    Accept
                  </Button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-[420px] max-h-[600px] overflow-y-auto p-4" 
                  align="center"
                >
                  {selectedOffer && (
                    <AcceptOfferModule
                      offer={selectedOffer}
                      onAccept={handleOfferAccepted}
                      onReject={handleOfferRejected}
                      context={context}
                    />
                  )}
                </PopoverContent>
              </Popover>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
