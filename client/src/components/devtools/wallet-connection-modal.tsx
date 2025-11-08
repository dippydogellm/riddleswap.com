import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wallet, Smartphone, QrCode, ExternalLink, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import bs58 from 'bs58';

interface WalletConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWalletConnected?: () => void;
}

interface WalletOption {
  id: string;
  name: string;
  type: string;
  chain: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  connectionMethod: 'browser' | 'mobile' | 'qr';
}

interface ConnectionState {
  step: 'select' | 'connecting' | 'signing' | 'verifying' | 'success';
  selectedWallet?: WalletOption;
  nonce?: string;
  message?: string;
  sessionId?: string;
  signature?: string;
  address?: string;
}

export default function WalletConnectionModal({ isOpen, onClose, onWalletConnected }: WalletConnectionModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [connectionState, setConnectionState] = useState<ConnectionState>({ step: 'select' });

  const walletOptions: WalletOption[] = [
    {
      id: 'metamask-eth',
      name: 'MetaMask',
      type: 'metamask',
      chain: 'ethereum',
      icon: Wallet,
      description: 'Connect with MetaMask for Ethereum and EVM chains',
      connectionMethod: 'browser'
    },
    {
      id: 'phantom-sol',
      name: 'Phantom',
      type: 'phantom',
      chain: 'solana',
      icon: Wallet,
      description: 'Connect with Phantom for Solana ecosystem',
      connectionMethod: 'browser'
    },
    {
      id: 'xaman-xrp',
      name: 'Xaman (XUMM)',
      type: 'xaman',
      chain: 'xrp',
      icon: Smartphone,
      description: 'Connect with Xaman for XRP Ledger',
      connectionMethod: 'mobile'
    }
  ];

  // Generate nonce challenge
  const challengeMutation = useMutation({
    mutationFn: async (data: { wallet: WalletOption; address: string }) => {
      const response = await apiRequest('/api/external-wallets/challenge', {
        method: 'POST',
        body: JSON.stringify({
          walletType: data.wallet.type,
          address: data.address,
          chain: data.wallet.chain
        })
      });
      return await response.json() as any;
    },
    onSuccess: (data, { wallet, address }) => {
      setConnectionState(prev => ({
        ...prev,
        step: 'signing',
        nonce: data.nonce,
        message: data.message,
        sessionId: data.sessionId,
        address: address // Ensure address is set deterministically
      }));
    },
    onError: (error: any) => {
      toast({
        title: "Challenge Failed",
        description: error.response?.data?.error || "Failed to generate verification challenge",
        variant: "destructive",
      });
      setConnectionState({ step: 'select' });
    }
  });

  // Verify wallet after signature
  const verifyWalletMutation = useMutation({
    mutationFn: async (data: {
      address: string;
      chain: string;
      walletType: string;
      signature: string;
      message: string;
    }) => {
      return await apiRequest('/api/external-wallets/verify', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      setConnectionState(prev => ({ ...prev, step: 'success' }));
      toast({
        title: "Wallet Connected",
        description: "Your wallet has been successfully linked and verified.",
      });
      // Invalidate wallet queries
      queryClient.invalidateQueries({ queryKey: ['/api/external-wallets/list'] });
      setTimeout(() => {
        onWalletConnected?.();
        handleClose();
      }, 2000);
    },
    onError: (error: any) => {
      toast({
        title: "Connection Failed",
        description: error.response?.data?.error || "Failed to link wallet",
        variant: "destructive",
      });
      setConnectionState({ step: 'select' });
    }
  });

  const handleWalletSelect = async (wallet: WalletOption) => {
    setConnectionState({ step: 'connecting', selectedWallet: wallet });

    try {
      let address = '';

      // Connect to wallet based on type
      if (wallet.type === 'metamask' && typeof window !== 'undefined' && (window as any).ethereum) {
        const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
        address = accounts[0];
      } else if (wallet.type === 'phantom' && typeof window !== 'undefined' && (window as any).solana) {
        const response = await (window as any).solana.connect();
        address = response.publicKey.toString();
      } else if (wallet.type === 'xaman') {
        // For Xaman, we'll handle through QR/mobile flow
        setConnectionState(prev => ({ ...prev, step: 'signing' }));
        return;
      } else {
        throw new Error('Wallet not available');
      }

      // Generate challenge with address directly (fixes race condition)
      challengeMutation.mutate({ wallet, address });
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: "Failed to connect to wallet. Make sure your wallet is installed and unlocked.",
        variant: "destructive",
      });
      setConnectionState({ step: 'select' });
    }
  };

  const handleSign = async () => {
    if (!connectionState.selectedWallet || !connectionState.message || !user) {
      return;
    }

    setConnectionState(prev => ({ ...prev, step: 'verifying' }));

    try {
      let signature = '';
      
      if (connectionState.selectedWallet.type === 'metamask' && (window as any).ethereum) {
        signature = await (window as any).ethereum.request({
          method: 'personal_sign',
          params: [connectionState.message, connectionState.address]
        });
      } else if (connectionState.selectedWallet.type === 'phantom' && (window as any).solana) {
        const encodedMessage = new TextEncoder().encode(connectionState.message);
        const signedMessage = await (window as any).solana.signMessage(encodedMessage, 'utf8');
        // Convert to base58 format for server compatibility (fixes signature mismatch)
        signature = bs58.encode(signedMessage.signature);
      }

      if (!signature) {
        throw new Error('Failed to get signature');
      }

      // Verify wallet
      await verifyWalletMutation.mutateAsync({
        address: connectionState.address!,
        chain: connectionState.selectedWallet.chain,
        walletType: connectionState.selectedWallet.type,
        signature,
        message: connectionState.message
      });

    } catch (error) {
      toast({
        title: "Signing Failed",
        description: "Failed to sign verification message. Please try again.",
        variant: "destructive",
      });
      setConnectionState({ step: 'select' });
    }
  };

  const handleClose = () => {
    setConnectionState({ step: 'select' });
    onClose();
  };

  const renderStepContent = () => {
    switch (connectionState.step) {
      case 'select':
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold mb-2">Connect External Wallet</h3>
              <p className="text-slate-600 dark:text-slate-400">
                Link an external wallet to discover and manage your projects
              </p>
            </div>
            <div className="grid gap-3">
              {walletOptions.map((wallet) => {
                const IconComponent = wallet.icon;
                return (
                  <Card 
                    key={wallet.id} 
                    className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:border-blue-500/50"
                    onClick={() => handleWalletSelect(wallet)}
                    data-testid={`wallet-option-${wallet.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-3">
                        <div className="wallet-icon bg-blue-500/10 p-2 rounded-lg">
                          <IconComponent className="w-6 h-6 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium">{wallet.name}</h4>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {wallet.description}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {wallet.chain.toUpperCase()}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );

      case 'connecting':
        return (
          <div className="text-center space-y-4">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
            <h3 className="text-lg font-semibold">Connecting to {connectionState.selectedWallet?.name}</h3>
            <p className="text-slate-600 dark:text-slate-400">
              Please check your wallet and approve the connection request
            </p>
          </div>
        );

      case 'signing':
        return (
          <div className="text-center space-y-6">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Sign Verification Message</h3>
              <p className="text-slate-600 dark:text-slate-400">
                Sign the message below to verify wallet ownership
              </p>
            </div>
            {connectionState.message && (
              <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg text-left">
                <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                  {connectionState.message}
                </pre>
              </div>
            )}
            <Button 
              onClick={handleSign} 
              className="w-full"
              data-testid="sign-message-button"
            >
              <QrCode className="w-4 h-4 mr-2" />
              Sign Message
            </Button>
          </div>
        );

      case 'verifying':
        return (
          <div className="text-center space-y-4">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
            <h3 className="text-lg font-semibold">Verifying Signature</h3>
            <p className="text-slate-600 dark:text-slate-400">
              Verifying your wallet ownership...
            </p>
          </div>
        );

      case 'success':
        return (
          <div className="text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto" />
            <h3 className="text-lg font-semibold text-green-600">Wallet Connected!</h3>
            <p className="text-slate-600 dark:text-slate-400">
              Your wallet has been successfully linked and verified.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" data-testid="wallet-connection-modal">
        <DialogHeader>
          <DialogTitle>Connect External Wallet</DialogTitle>
          <DialogDescription>
            Link your external wallets to discover and manage blockchain projects
          </DialogDescription>
        </DialogHeader>
        {renderStepContent()}
      </DialogContent>
    </Dialog>
  );
}
