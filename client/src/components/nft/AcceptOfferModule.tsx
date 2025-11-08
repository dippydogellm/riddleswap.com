import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { 
  CheckCircle, 
  Shield, 
  AlertTriangle,
  Wallet,
  Lock,
  Loader2,
  DollarSign,
  User,
  Clock
} from 'lucide-react';

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

interface AcceptOfferModuleProps {
  offer: NFTOffer;
  onAccept?: () => void;
  onReject?: () => void;
  context?: 'xrp-wallet' | 'portfolio' | 'marketplace';
}

export function AcceptOfferModule({ 
  offer, 
  onAccept, 
  onReject,
  context = 'marketplace'
}: AcceptOfferModuleProps) {
  const [password, setPassword] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);
  const [canAccept, setCanAccept] = useState(false);
  const { toast } = useToast();

  // Check wallet connection and permissions
  useEffect(() => {
    const checkWalletPermissions = () => {
      const sessionToken = localStorage.getItem('sessionToken');
      const riddleWallet = localStorage.getItem('riddleWallet');
      const isRiddleConnected = !!(sessionToken && riddleWallet);
      
      setWalletConnected(isRiddleConnected);

      // Determine if user can accept offer based on context
      if (context === 'xrp-wallet') {
        // In XRP wallet context, only allow Riddle wallet
        setCanAccept(isRiddleConnected);
      } else if (context === 'portfolio') {
        // In portfolio, allow any connected wallet (Riddle or external)
        const hasExternalWallet = checkExternalWalletConnection();
        setCanAccept(isRiddleConnected || hasExternalWallet);
      } else {
        // Marketplace context - allow any connected wallet
        const hasExternalWallet = checkExternalWalletConnection();
        setCanAccept(isRiddleConnected || hasExternalWallet);
      }
    };

    checkWalletPermissions();
  }, [context]);

  const checkExternalWalletConnection = () => {
    // Check for external wallet connections (MetaMask, WalletConnect, etc.)
    // This would be implemented based on your external wallet integration
    return false; // Placeholder
  };

  const handleAcceptOffer = async () => {
    if (!canAccept) {
      toast({
        title: "Wallet Required",
        description: getWalletRequirementMessage(),
        variant: "destructive"
      });
      return;
    }

    if (!password && walletConnected) {
      toast({
        title: "Password Required",
        description: "Please enter your wallet password to accept this offer",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);

    try {
      let response;

      if (walletConnected) {
        // Use Riddle Wallet
        response = await acceptWithRiddleWallet();
      } else {
        // Use external wallet (for portfolio context)
        response = await acceptWithExternalWallet();
      }

      if (response.success) {
        toast({
          title: "Offer Accepted",
          description: `Successfully accepted ${offer.offer_type} offer for ${offer.amount} ${offer.currency}`,
        });
        
        onAccept?.();
      } else {
        throw new Error(response.error || 'Failed to accept offer');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to accept NFT offer",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const acceptWithRiddleWallet = async () => {
    const sessionToken = localStorage.getItem('sessionToken');
    
    const response = await fetch(`/api/nft-offers/${offer.offer_index}/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`
      },
      body: JSON.stringify({
        password: password,
        offerType: offer.offer_type,
        walletType: 'riddle'
      })
    });

    return await response.json() as any;
  };

  const acceptWithExternalWallet = async () => {
    // Implement external wallet acceptance
    const response = await fetch(`/api/nft-offers/${offer.offer_index}/accept-external`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        offerType: offer.offer_type,
        walletType: 'external'
      })
    });

    return await response.json() as any;
  };

  const handleRejectOffer = async () => {
    if (!canAccept) {
      toast({
        title: "Wallet Required",
        description: "You need a connected wallet to reject offers",
        variant: "destructive"
      });
      return;
    }

    try {
      const sessionToken = localStorage.getItem('sessionToken');
      
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
          title: "Offer Rejected",
          description: "The NFT offer has been rejected",
        });
        
        onReject?.();
      } else {
        throw new Error(result.error || 'Failed to reject offer');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to reject offer",
        variant: "destructive"
      });
    }
  };

  const getWalletRequirementMessage = () => {
    if (context === 'xrp-wallet') {
      return "Riddle Wallet connection required to accept offers in XRP wallet";
    } else if (context === 'portfolio') {
      return "Connect Riddle Wallet or an external wallet to accept offers";
    }
    return "Wallet connection required to accept offers";
  };

  const formatOfferAge = (created_at?: string) => {
    if (!created_at) return '';
    
    const now = new Date();
    const offerDate = new Date(created_at);
    const diffMs = now.getTime() - offerDate.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else {
      return 'Recent';
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          Accept NFT Offer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Offer Details */}
        <div className="border rounded-lg p-4 space-y-3">
          {offer.nft_image && (
            <div className="flex justify-center">
              <img 
                src={offer.nft_image} 
                alt={offer.nft_name} 
                className="w-20 h-20 rounded-lg object-cover"
              />
            </div>
          )}
          
          <div className="space-y-2">
            <h4 className="font-semibold text-center">
              {offer.nft_name || `NFT #${offer.nft_id?.slice(0, 8)}`}
            </h4>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Type:</span>
              <Badge variant={offer.offer_type === 'buy' ? 'default' : 'secondary'}>
                {offer.offer_type === 'buy' ? 'Buy Offer' : 'Sell Offer'}
              </Badge>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Amount:</span>
              <span className="font-bold flex items-center gap-1">
                <DollarSign className="w-4 h-4" />
                {offer.amount} {offer.currency}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">From:</span>
              <span className="text-sm font-mono flex items-center gap-1">
                <User className="w-3 h-3" />
                {offer.from_address.slice(0, 6)}...{offer.from_address.slice(-4)}
              </span>
            </div>
            
            {offer.created_at && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Age:</span>
                <span className="text-sm flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatOfferAge(offer.created_at)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Wallet Status */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4" />
            <span className="font-medium">Wallet Status</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant={canAccept ? 'default' : 'secondary'}>
              {canAccept ? (
                <>
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Ready
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Not Ready
                </>
              )}
            </Badge>
            
            {walletConnected && (
              <Badge variant="outline">
                <Shield className="w-3 h-3 mr-1" />
                Riddle Wallet
              </Badge>
            )}
          </div>
        </div>

        {/* Context-specific wallet requirements */}
        {!canAccept && (
          <Alert>
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              {getWalletRequirementMessage()}
            </AlertDescription>
          </Alert>
        )}

        {/* Password input for Riddle Wallet */}
        {canAccept && walletConnected && (
          <div className="space-y-2">
            <Label>Wallet Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your wallet password"
            />
          </div>
        )}

        {/* Context Info */}
        <div className="text-xs text-muted-foreground p-2 bg-muted rounded">
          {context === 'xrp-wallet' && (
            <p>• Only Riddle Wallet can accept offers in XRP wallet context</p>
          )}
          {context === 'portfolio' && (
            <p>• Any connected wallet can accept offers in portfolio view</p>
          )}
          <p>• Transaction fees will apply based on your wallet type</p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button 
            onClick={handleAcceptOffer}
            disabled={!canAccept || isProcessing || (walletConnected && !password)}
            className="flex-1"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Accept Offer
              </>
            )}
          </Button>
          
          <Button 
            variant="outline"
            onClick={handleRejectOffer}
            disabled={!canAccept || isProcessing}
            className="px-4"
          >
            Reject
          </Button>
        </div>

        {/* Security Notice */}
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Lock className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <p>
            Your private keys remain secure. Riddle Wallet transactions are processed securely on-device.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
