import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  Wallet, 
  Shield, 
  ExternalLink, 
  CheckCircle,
  AlertTriangle,
  Loader2,
  LogIn
} from 'lucide-react';

interface WalletOption {
  id: string;
  name: string;
  icon: React.ReactNode;
  connected: boolean;
  description: string;
  connectionMethod: () => Promise<void>;
}

interface WalletConnectionModuleProps {
  onWalletConnected?: (walletType: string) => void;
  onClose?: () => void;
  context?: 'collection' | 'marketplace' | 'nft-detail';
  requireConnection?: boolean;
}

export function WalletConnectionModule({ 
  onWalletConnected, 
  onClose,
  context = 'marketplace',
  requireConnection = true
}: WalletConnectionModuleProps) {
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [showLoginPopup, setShowLoginPopup] = useState(false);
  const [loginHandle, setLoginHandle] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    initializeWallets();
  }, []);

  const initializeWallets = () => {
    const sessionToken = localStorage.getItem('sessionToken');
    const riddleWallet = localStorage.getItem('riddleWallet');
    const isRiddleConnected = !!(sessionToken && riddleWallet);

    const walletOptions: WalletOption[] = [
      {
        id: 'riddle',
        name: 'Riddle Wallet',
        icon: <Shield className="w-5 h-5" />,
        connected: isRiddleConnected,
        description: 'Native RiddleSwap wallet with full NFT trading features',
        connectionMethod: connectRiddleWallet
      },
      {
        id: 'xaman',
        name: 'Xaman (XUMM)',
        icon: <ExternalLink className="w-5 h-5" />,
        connected: false, // TODO: Check Xaman connection
        description: 'Professional XRPL wallet for secure NFT transactions',
        connectionMethod: connectXamanWallet
      },
      {
        id: 'joey',
        name: 'Joey Wallet', 
        icon: <ExternalLink className="w-5 h-5" />,
        connected: false, // TODO: Check Joey connection
        description: 'Multi-chain wallet with XRPL NFT support',
        connectionMethod: connectJoeyWallet
      }
    ];

    setWallets(walletOptions);
  };

  const connectRiddleWallet = async () => {
    const sessionToken = localStorage.getItem('sessionToken');
    const riddleWallet = localStorage.getItem('riddleWallet');
    
    if (sessionToken && riddleWallet) {
      toast({
        title: "Already Connected",
        description: "Riddle Wallet is already connected",
      });
      onWalletConnected?.('riddle');
      return;
    }

    // Show login popup instead of redirect
    setShowLoginPopup(true);
  };

  const connectXamanWallet = async () => {
    try {
      // Implementation for Xaman wallet connection
      const response = await fetch('/api/wallet/connect/xaman', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json() as any;
      
      if (result.success) {
        toast({
          title: "Xaman Connected",
          description: "Successfully connected to Xaman wallet",
        });
        onWalletConnected?.('xaman');
        updateWalletStatus('xaman', true);
      } else {
        throw new Error(result.error || 'Failed to connect');
      }
    } catch (error: any) {
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect Xaman wallet",
        variant: "destructive"
      });
    }
  };

  const connectJoeyWallet = async () => {
    try {
      // Implementation for Joey wallet connection
      const response = await fetch('/api/wallet/connect/joey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json() as any;
      
      if (result.success) {
        toast({
          title: "Joey Wallet Connected",
          description: "Successfully connected to Joey wallet",
        });
        onWalletConnected?.('joey');
        updateWalletStatus('joey', true);
      } else {
        throw new Error(result.error || 'Failed to connect');
      }
    } catch (error: any) {
      toast({
        title: "Connection Failed", 
        description: error.message || "Failed to connect Joey wallet",
        variant: "destructive"
      });
    }
  };

  const updateWalletStatus = (walletId: string, connected: boolean) => {
    setWallets(prev => prev.map(wallet => 
      wallet.id === walletId ? { ...wallet, connected } : wallet
    ));
  };

  const handleConnect = async (wallet: WalletOption) => {
    if (wallet.connected) {
      onWalletConnected?.(wallet.id);
      return;
    }

    setConnecting(wallet.id);
    try {
      await wallet.connectionMethod();
    } catch (error) {
      console.error(`Failed to connect ${wallet.name}:`, error);
    } finally {
      setConnecting(null);
    }
  };

  const connectedWallet = wallets.find(w => w.connected);
  const hasConnectedWallet = !!connectedWallet;

  const WalletConnectionContent = () => (
    <div className="space-y-4">
      {!hasConnectedWallet && requireConnection && (
        <Alert>
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>
            Please connect a wallet to buy NFTs or make offers
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-3">
        {wallets.map((wallet) => (
          <Card 
            key={wallet.id} 
            className={`cursor-pointer transition-all ${
              wallet.connected 
                ? 'border-green-500 bg-green-50 dark:bg-green-900/20' 
                : 'hover:border-blue-500'
            }`}
            onClick={() => handleConnect(wallet)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {wallet.icon}
                  <div>
                    <h4 className="font-semibold">{wallet.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {wallet.description}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {wallet.connected ? (
                    <Badge className="bg-green-600">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Connected
                    </Badge>
                  ) : (
                    <Button 
                      variant="outline" 
                      size="sm"
                      disabled={connecting === wallet.id}
                    >
                      {connecting === wallet.id ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          <LogIn className="w-3 h-3 mr-1" />
                          Connect
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {hasConnectedWallet && (
        <div className="flex justify-end">
          <Button onClick={() => onWalletConnected?.(connectedWallet.id)}>
            Continue with {connectedWallet.name}
          </Button>
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        <p>• Wallet connections are secure and encrypted</p>
        <p>• Your private keys never leave your device</p>
        <p>• {context === 'collection' ? 'Collection' : 'Marketplace'} transactions require wallet authentication</p>
      </div>
    </div>
  );

  // Inline component for non-dialog usage
  if (!showDialog && onClose) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Connect Wallet
          </CardTitle>
        </CardHeader>
        <CardContent>
          <WalletConnectionContent />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Trigger button */}
      <Button onClick={() => setShowDialog(true)} className="w-full">
        <Wallet className="w-4 h-4 mr-2" />
        {hasConnectedWallet ? `Connected: ${connectedWallet.name}` : 'Connect Wallet'}
      </Button>

      {/* Connection dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="w-[95vw] sm:w-[90%] sm:max-w-2xl lg:max-w-3xl xl:max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Connect Wallet to Continue
            </DialogTitle>
          </DialogHeader>
          <WalletConnectionContent />
        </DialogContent>
      </Dialog>
    </>
  );
}

// Quick connection status component
export function WalletConnectionStatus() {
  const [isConnected, setIsConnected] = useState(false);
  const [walletType, setWalletType] = useState<string>('');

  useEffect(() => {
    const checkConnection = () => {
      const sessionToken = localStorage.getItem('sessionToken');
      const riddleWallet = localStorage.getItem('riddleWallet');
      
      if (sessionToken && riddleWallet) {
        setIsConnected(true);
        setWalletType('Riddle Wallet');
      } else {
        setIsConnected(false);
        setWalletType('');
      }
    };

    checkConnection();
    
    // Listen for storage changes
    window.addEventListener('storage', checkConnection);
    return () => window.removeEventListener('storage', checkConnection);
  }, []);

  return (
    <div className="flex items-center gap-2">
      <Badge variant={isConnected ? 'default' : 'secondary'}>
        {isConnected ? (
          <>
            <CheckCircle className="w-3 h-3 mr-1" />
            {walletType}
          </>
        ) : (
          <>
            <AlertTriangle className="w-3 h-3 mr-1" />
            Not Connected
          </>
        )}
      </Badge>
    </div>
  );
}
