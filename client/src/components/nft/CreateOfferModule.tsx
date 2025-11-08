import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  DollarSign, 
  Wallet, 
  ExternalLink, 
  Shield,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';

interface CreateOfferModuleProps {
  nftId: string;
  nftName?: string;
  nftImage?: string;
  currentPrice?: string;
  onOfferCreated?: () => void;
  context?: 'xrp-wallet' | 'portfolio' | 'marketplace';
}

interface WalletOption {
  id: string;
  name: string;
  icon: React.ReactNode;
  supported: boolean;
  description: string;
}

export function CreateOfferModule({ 
  nftId, 
  nftName, 
  nftImage, 
  currentPrice,
  onOfferCreated,
  context = 'marketplace'
}: CreateOfferModuleProps) {
  const [offerType, setOfferType] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [selectedWallet, setSelectedWallet] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);
  const { toast } = useToast();

  const getAvailableWallets = (): WalletOption[] => {
    const baseWallets = [
      {
        id: 'riddle',
        name: 'Riddle Wallet',
        icon: <Shield className="w-4 h-4" />,
        supported: true,
        description: 'Native RiddleSwap wallet with full features'
      }
    ];

    if (context === 'xrp-wallet') {
      return [
        ...baseWallets,
        {
          id: 'xaman',
          name: 'Xaman (XUMM)',
          icon: <ExternalLink className="w-4 h-4" />,
          supported: true,
          description: 'Professional XRPL wallet for secure transactions'
        },
        {
          id: 'joey',
          name: 'Joey Wallet',
          icon: <ExternalLink className="w-4 h-4" />,
          supported: true,
          description: 'Multi-chain wallet with XRPL support'
        }
      ];
    }

    if (context === 'portfolio') {
      const connectedWallets = [];
      const sessionToken = localStorage.getItem('sessionToken');
      const riddleWallet = localStorage.getItem('riddleWallet');
      
      if (sessionToken && riddleWallet) {
        connectedWallets.push(...baseWallets);
      }
      
      return connectedWallets;
    }

    return baseWallets;
  };

  const [availableWallets] = useState<WalletOption[]>(getAvailableWallets());

  useEffect(() => {
    const checkWalletConnection = () => {
      const sessionToken = localStorage.getItem('sessionToken');
      const riddleWallet = localStorage.getItem('riddleWallet');
      setWalletConnected(!!(sessionToken && riddleWallet));
      
      if (sessionToken && riddleWallet && !selectedWallet) {
        setSelectedWallet('riddle');
      }
    };

    checkWalletConnection();
  }, [selectedWallet]);

  const handleCreateOffer = async () => {
    if (!selectedWallet) {
      toast({
        title: "Wallet Required",
        description: "Please select a wallet to create the offer",
        variant: "destructive"
      });
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid offer amount",
        variant: "destructive"
      });
      return;
    }

    setIsCreating(true);

    try {
      let response;
      
      if (selectedWallet === 'riddle') {
        response = await createOfferWithRiddleWallet();
      } else if (selectedWallet === 'xaman') {
        response = await createOfferWithXaman();
      } else if (selectedWallet === 'joey') {
        response = await createOfferWithJoey();
      } else {
        throw new Error('Unsupported wallet type');
      }

      if (response.success) {
        toast({
          title: "Offer Created",
          description: `Successfully created ${offerType} offer for ${amount} XRP`,
        });
        
        setAmount('');
        onOfferCreated?.();
      } else {
        throw new Error(response.error || 'Failed to create offer');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create NFT offer",
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  };

  const createOfferWithRiddleWallet = async () => {
    const sessionToken = localStorage.getItem('sessionToken');
    if (!sessionToken) {
      throw new Error('Riddle Wallet not connected');
    }

    const response = await fetch('/api/nft/create-offer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`
      },
      body: JSON.stringify({
        nftId,
        offerType,
        amount,
        walletType: 'riddle'
      })
    });

    return await response.json() as any;
  };

  const createOfferWithXaman = async () => {
    const response = await fetch('/api/nft/create-offer-xaman', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        nftId,
        offerType,
        amount,
        walletType: 'xaman'
      })
    });

    const result = await response.json() as any;
    
    if (result.success && result.xamanUrl) {
      window.open(result.xamanUrl, '_blank');
      return await pollTransactionStatus(result.txId);
    }

    return result;
  };

  const createOfferWithJoey = async () => {
    const response = await fetch('/api/nft/create-offer-joey', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        nftId,
        offerType,
        amount,
        walletType: 'joey'
      })
    });

    return await response.json() as any;
  };

  const pollTransactionStatus = async (txId: string) => {
    const maxAttempts = 30;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const response = await fetch(`/api/transaction-status/${txId}`);
      const result = await response.json() as any;

      if (result.status === 'completed') {
        return { success: true };
      } else if (result.status === 'failed') {
        throw new Error('Transaction failed');
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    }

    throw new Error('Transaction timeout');
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 pb-2 border-b">
        <DollarSign className="w-5 h-5" />
        <h3 className="font-semibold text-lg">Create NFT Offer</h3>
      </div>

      {/* NFT Preview */}
      <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
        {nftImage && (
          <img 
            src={nftImage} 
            alt={nftName} 
            className="w-12 h-12 rounded-lg object-cover"
          />
        )}
        <div>
          <h4 className="font-semibold text-sm">{nftName || 'NFT'}</h4>
          {currentPrice && (
            <p className="text-xs text-muted-foreground">
              Current Price: {currentPrice} XRP
            </p>
          )}
        </div>
      </div>

      {/* Offer Type */}
      <div className="space-y-2">
        <Label>Offer Type</Label>
        <Select value={offerType} onValueChange={(value: 'buy' | 'sell') => setOfferType(value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="buy">Buy Offer</SelectItem>
            <SelectItem value="sell">Sell Offer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Amount */}
      <div className="space-y-2">
        <Label>Amount (XRP)</Label>
        <Input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Enter offer amount"
          min="0"
          step="0.000001"
        />
      </div>

      {/* Wallet Selection */}
      <div className="space-y-2">
        <Label>Select Wallet</Label>
        <Select value={selectedWallet} onValueChange={setSelectedWallet}>
          <SelectTrigger>
            <SelectValue placeholder="Choose wallet" />
          </SelectTrigger>
          <SelectContent>
            {availableWallets.map((wallet) => (
              <SelectItem 
                key={wallet.id} 
                value={wallet.id}
                disabled={!wallet.supported}
              >
                <div className="flex items-center gap-2">
                  {wallet.icon}
                  <span>{wallet.name}</span>
                  {wallet.id === 'riddle' && walletConnected && (
                    <CheckCircle className="w-3 h-3 text-green-500" />
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {selectedWallet && (
          <p className="text-xs text-muted-foreground">
            {availableWallets.find(w => w.id === selectedWallet)?.description}
          </p>
        )}
      </div>

      {/* Wallet Status */}
      {context === 'xrp-wallet' && (
        <div className="flex items-center gap-2 text-sm">
          <Badge variant={walletConnected ? 'default' : 'secondary'}>
            {walletConnected ? (
              <>
                <CheckCircle className="w-3 h-3 mr-1" />
                Connected
              </>
            ) : (
              <>
                <AlertCircle className="w-3 h-3 mr-1" />
                Not Connected
              </>
            )}
          </Badge>
          <span className="text-muted-foreground">
            {walletConnected ? 'Ready to create offer' : 'Connect wallet first'}
          </span>
        </div>
      )}

      {/* Create Button */}
      <Button 
        onClick={handleCreateOffer}
        disabled={isCreating || !selectedWallet || !amount}
        className="w-full"
      >
        {isCreating ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Creating Offer...
          </>
        ) : (
          <>
            <DollarSign className="w-4 h-4 mr-2" />
            Create {offerType} Offer
          </>
        )}
      </Button>

      {/* Help Text */}
      <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
        <p>• {offerType === 'buy' ? 'Buy offers' : 'Sell offers'} will be visible to other users</p>
        <p>• Transaction fees apply based on selected wallet</p>
        {context === 'xrp-wallet' && (
          <p>• External wallets (Xaman, Joey) redirect for signing</p>
        )}
      </div>
    </div>
  );
}
