import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  CheckCircle,
  XCircle,
  DollarSign,
  RefreshCw
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface NFTOffer {
  offer_index: string;
  nft_id: string;
  nft_name: string;
  nft_image: string | null;
  nft_description: string | null;
  offer_type: 'buy' | 'sell';
  amount: string;
  currency: string;
  from_address: string;
  status: string;
}

interface NFTOffersManagerProps {
  address: string;
}

export function NFTOffersManager({ address }: NFTOffersManagerProps) {
  const [processingOffer, setProcessingOffer] = useState<string | null>(null);
  const { toast } = useToast();

  console.log(`🔍 Fetching NFT offers for address: ${address}`);
  const { data: offersData, isLoading, refetch } = useQuery({
    queryKey: [`/api/nft-offers/${address}`],
    enabled: !!address,
    refetchInterval: 30000, // Refresh every 30 seconds to catch new offers
  });

  const offers = (offersData as any)?.offers || [];
  console.log(`📊 Current offers in component:`, offers);

  const handleAccept = async (offer: NFTOffer) => {
    const password = prompt('Enter your wallet password to accept this NFT offer:');
    if (!password) return;

    setProcessingOffer(offer.offer_index);
    try {
      const sessionToken = sessionStorage.getItem('riddle_session_token');
      const response = await fetch(`/api/nft-offers/${offer.offer_index}/accept`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          password: password,
          offerType: offer.offer_type
        })
      });
      
      const result = await response.json() as any;
      if (result.success) {
        toast({
          title: "Success",
          description: `Successfully accepted NFT offer for ${offer.nft_name}`,
        });
        refetch();
      } else {
        throw new Error(result.error || 'Failed to accept offer');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to accept NFT offer. Please try again.",
        variant: "destructive"
      });
    } finally {
      setProcessingOffer(null);
    }
  };

  const handleReject = async (offer: NFTOffer) => {
    setProcessingOffer(offer.offer_index);
    try {
      const sessionToken = sessionStorage.getItem('riddle_session_token');
      const response = await fetch(`/api/nft-offers/${offer.offer_index}/reject`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        }
      });
      
      const result = await response.json() as any;
      if (result.success) {
        toast({
          title: "Rejected",
          description: `NFT offer for ${offer.nft_name} has been rejected`,
        });
        refetch();
      } else {
        throw new Error(result.error || 'Failed to reject offer');
      }
    } catch (error) {
      toast({
        title: "Error", 
        description: "Failed to reject NFT offer. Please try again.",
        variant: "destructive"
      });
    } finally {
      setProcessingOffer(null);
    }
  };

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Loading NFT Offers...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>NFT Offers ({offers.length})</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {offers.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No NFT offers found for this wallet.
          </p>
        ) : (
          <div className="space-y-4">
            {offers.map((offer: NFTOffer) => (
              <div key={offer.offer_index} className="border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold">{offer.nft_name}</h3>
                    {offer.nft_description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {offer.nft_description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2">
                      <Badge variant={offer.offer_type === 'buy' ? 'default' : 'secondary'}>
                        {offer.offer_type === 'buy' ? 'Buy Offer' : 'Sell Offer'}
                      </Badge>
                      <span className="font-medium flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        {offer.amount === '0' ? 'Free' : `${offer.amount} ${offer.currency}`}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      From: {offer.from_address.slice(0, 8)}...{offer.from_address.slice(-8)}
                    </p>
                  </div>
                  {offer.nft_image && (
                    <img 
                      src={offer.nft_image} 
                      alt={offer.nft_name}
                      className="w-16 h-16 object-cover rounded"
                    />
                  )}
                </div>
                <div className="flex gap-2 mt-4">
                  <Button
                    onClick={() => handleAccept(offer)}
                    disabled={processingOffer === offer.offer_index}
                    className="flex-1"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {processingOffer === offer.offer_index ? 'Processing...' : 'Accept Offer'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleReject(offer)}
                    disabled={processingOffer === offer.offer_index}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
