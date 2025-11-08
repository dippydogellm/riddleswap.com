import { useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { 
  CheckCircle, 
  X,
  Shield, 
  AlertTriangle,
  Wallet,
  ArrowLeft,
  DollarSign,
  User,
  Clock,
  TrendingUp,
  Info,
  ExternalLink
} from 'lucide-react';

interface OfferDetails {
  nftId: string;
  nftName: string;
  nftImage?: string;
  buyerOfferId: string;
  buyerAddress: string;
  offerAmountXRP: string;
  createdAt?: string;
}

export default function AcceptOfferPage() {
  const [, params] = useRoute('/nft/:nftId/accept-offer/:offerId');
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [offer, setOffer] = useState<OfferDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [askPrice, setAskPrice] = useState('');
  const [password, setPassword] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);

  const brokerFeePercent = 1.589;

  useEffect(() => {
    const fetchOfferDetails = async () => {
      if (!params?.nftId || !params?.offerId) {
        toast({
          title: "Error",
          description: "Invalid offer URL",
          variant: "destructive"
        });
        setLocation('/marketplace');
        return;
      }

      try {
        // Fetch NFT details
        const nftResponse = await fetch(`/api/nfts/${params.nftId}`);
        const nftData = await nftResponse.json();

        // Fetch buy offers
        const offersResponse = await fetch(`/api/broker/nft/${params.nftId}/buy-offers`);
        const offersData = await offersResponse.json();

        const buyOffer = offersData.offers?.find((o: any) => o.nft_offer_index === params.offerId);

        if (!buyOffer) {
          toast({
            title: "Offer Not Found",
            description: "This offer may have been cancelled or accepted",
            variant: "destructive"
          });
          setLocation(`/nft/${params.nftId}`);
          return;
        }

        const offerAmountXRP = (parseFloat(buyOffer.amount) / 1_000_000).toFixed(6);

        setOffer({
          nftId: params.nftId,
          nftName: nftData.nft?.name || `NFT #${params.nftId.slice(0, 8)}`,
          nftImage: nftData.nft?.image,
          buyerOfferId: params.offerId,
          buyerAddress: buyOffer.owner,
          offerAmountXRP,
          createdAt: buyOffer.created_at
        });

        // Set initial ask price to match offer
        setAskPrice(offerAmountXRP);

      } catch (error) {
        console.error('Error fetching offer:', error);
        toast({
          title: "Error",
          description: "Failed to load offer details",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    // Check wallet connection
    const sessionToken = localStorage.getItem('riddle_session_token');
    setWalletConnected(!!sessionToken);

    fetchOfferDetails();
  }, [params]);

  const brokerFee = askPrice ? (parseFloat(askPrice) * (brokerFeePercent / 100)).toFixed(6) : '0';
  const youReceive = askPrice ? (parseFloat(askPrice) - parseFloat(brokerFee)).toFixed(6) : '0';

  const handleAcceptOffer = async () => {
    if (!offer) return;

    if (!walletConnected) {
      toast({
        title: "Wallet Required",
        description: "Please connect your Riddle Wallet to accept offers",
        variant: "destructive"
      });
      return;
    }

    if (!askPrice || parseFloat(askPrice) <= 0) {
      toast({
        title: "Invalid Price",
        description: "Please enter a valid ask price",
        variant: "destructive"
      });
      return;
    }

    if (parseFloat(askPrice) > parseFloat(offer.offerAmountXRP)) {
      toast({
        title: "Price Too High",
        description: `Your ask price cannot exceed buyer's offer of ${offer.offerAmountXRP} XRP`,
        variant: "destructive"
      });
      return;
    }

    if (!password) {
      toast({
        title: "Password Required",
        description: "Please enter your wallet password",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);

    try {
      const sessionToken = localStorage.getItem('riddle_session_token');

      const response = await fetch('/api/broker/seller-accept-offer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          buyOfferId: offer.buyerOfferId,
          nftId: offer.nftId,
          askPriceXrp: askPrice,
          password: password
        })
      });

      const data = await response.json() as any;

      if (data.success) {
        toast({
          title: "✅ Offer Accepted!",
          description: (
            <div className="space-y-2">
              <p>Successfully matched with buyer's offer</p>
              <p className="text-xs">Transaction ID: {data.txHash?.substring(0, 16)}...</p>
            </div>
          ),
        });

        // Redirect to NFT detail page after 2 seconds
        setTimeout(() => {
          setLocation(`/nft/${offer.nftId}`);
        }, 2000);

      } else {
        toast({
          title: "Error",
          description: data.error || 'Failed to accept offer',
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Accept offer error:', error);
      toast({
        title: "Error",
        description: "Failed to accept offer. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    if (offer) {
      setLocation(`/nft/${offer.nftId}`);
    } else {
      setLocation('/marketplace');
    }
  };

  const formatOfferAge = (created_at?: string) => {
    if (!created_at) return 'Recent';
    
    const now = new Date();
    const offerDate = new Date(created_at);
    const diffMs = now.getTime() - offerDate.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!offer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-amber-500" />
            <h2 className="text-xl font-bold mb-2">Offer Not Found</h2>
            <p className="text-muted-foreground mb-4">This offer may have been cancelled or already accepted</p>
            <Button onClick={() => setLocation('/marketplace')}>
              Back to Marketplace
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={handleCancel}
            className="text-white hover:bg-white/10 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to NFT
          </Button>
          <h1 className="text-3xl font-bold text-white mb-2">Accept Buy Offer</h1>
          <p className="text-blue-200">Review and accept the buyer's offer for your NFT</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Left Column - NFT & Offer Details */}
          <div className="space-y-6">
            {/* NFT Preview Card */}
            <Card className="bg-white/10 backdrop-blur-lg border-white/20">
              <CardContent className="p-6">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  NFT Details
                </h3>
                
                {offer.nftImage && (
                  <div className="mb-4 rounded-lg overflow-hidden">
                    <img 
                      src={offer.nftImage} 
                      alt={offer.nftName} 
                      className="w-full h-64 object-cover"
                    />
                  </div>
                )}
                
                <h4 className="text-xl font-bold text-white mb-2">{offer.nftName}</h4>
                <p className="text-sm text-blue-200 font-mono break-all">
                  {offer.nftId}
                </p>
              </CardContent>
            </Card>

            {/* Buyer Offer Card */}
            <Card className="bg-white/10 backdrop-blur-lg border-white/20">
              <CardContent className="p-6 space-y-4">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Buyer's Offer
                </h3>

                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-blue-500/20 rounded-lg">
                    <span className="text-blue-200">Offer Amount</span>
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-blue-400" />
                      <span className="text-2xl font-bold text-white">{offer.offerAmountXRP}</span>
                      <Badge variant="secondary">XRP</Badge>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-blue-200 text-sm">From Address</span>
                    <span className="text-white text-sm font-mono">
                      {offer.buyerAddress.slice(0, 8)}...{offer.buyerAddress.slice(-6)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-blue-200 text-sm">Offer Age</span>
                    <span className="text-white text-sm flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatOfferAge(offer.createdAt)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-blue-200 text-sm">Offer ID</span>
                    <span className="text-white text-xs font-mono">
                      {offer.buyerOfferId.slice(0, 12)}...
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Accept Form */}
          <div className="space-y-6">
            {/* Wallet Status */}
            {!walletConnected && (
              <Alert className="bg-amber-500/20 border-amber-500/50">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <AlertDescription className="text-amber-200">
                  Please connect your Riddle Wallet to accept this offer
                </AlertDescription>
              </Alert>
            )}

            {walletConnected && (
              <Card className="bg-white/10 backdrop-blur-lg border-white/20">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-2 text-white">
                    <Wallet className="w-5 h-5" />
                    <span className="font-semibold">Wallet Connected</span>
                    <Badge variant="outline" className="ml-auto">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Riddle Wallet
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Price Input */}
            <Card className="bg-white/10 backdrop-blur-lg border-white/20">
              <CardContent className="p-6 space-y-4">
                <div>
                  <Label className="text-white text-base font-semibold mb-2 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Your Ask Price
                  </Label>
                  <p className="text-sm text-blue-200 mb-3">
                    Enter amount ≤ {offer.offerAmountXRP} XRP (buyer's max offer)
                  </p>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.000001"
                      value={askPrice}
                      onChange={(e) => setAskPrice(e.target.value)}
                      max={offer.offerAmountXRP}
                      className="text-lg pr-16 bg-white/5 border-white/20 text-white"
                      placeholder="0.00"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Badge variant="secondary" className="font-semibold">XRP</Badge>
                    </div>
                  </div>
                </div>

                {/* Fee Breakdown */}
                {askPrice && parseFloat(askPrice) > 0 && (
                  <div className="space-y-3 p-4 bg-slate-950/50 rounded-lg border border-blue-500/30">
                    <div className="flex items-center gap-2 text-sm font-medium text-blue-200">
                      <Info className="h-4 w-4" />
                      Payment Breakdown
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-blue-200">
                        <span>Ask Price</span>
                        <span className="text-white font-medium">{parseFloat(askPrice).toFixed(6)} XRP</span>
                      </div>
                      <div className="flex justify-between text-blue-200">
                        <span>Broker Fee ({brokerFeePercent}%)</span>
                        <span className="text-red-400 font-medium">-{brokerFee} XRP</span>
                      </div>
                      <div className="border-t border-blue-500/30 pt-2 mt-2">
                        <div className="flex justify-between text-base font-bold">
                          <span className="text-white">You Receive</span>
                          <span className="text-green-400">{youReceive} XRP</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Password Input */}
                <div>
                  <Label className="text-white text-base font-semibold mb-2 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Wallet Password
                  </Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your wallet password"
                    className="bg-white/5 border-white/20 text-white"
                  />
                </div>

                {/* Info Alert */}
                <Alert className="bg-blue-500/20 border-blue-500/50">
                  <Info className="w-4 h-4 text-blue-400" />
                  <AlertDescription className="text-blue-200 text-xs">
                    <strong>How it works:</strong> You create a sell offer for your ask price, directed to the broker. 
                    The broker accepts both offers and automatically distributes the payment.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <Button 
                variant="outline"
                onClick={handleCancel}
                disabled={isProcessing}
                className="flex-1 bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              
              <Button 
                onClick={handleAcceptOffer}
                disabled={!walletConnected || !askPrice || !password || isProcessing || parseFloat(askPrice) <= 0}
                className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Accept Offer
                  </>
                )}
              </Button>
            </div>

            {/* Security Notice */}
            <div className="flex items-start gap-2 text-xs text-blue-200/70 bg-slate-950/30 p-3 rounded-lg">
              <Shield className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <p>
                Your transaction is processed securely on XRPL. The broker automatically handles the exchange 
                and distributes funds according to the fee structure.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
