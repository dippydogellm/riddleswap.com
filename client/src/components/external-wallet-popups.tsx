import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wallet, ExternalLink, Copy, Smartphone, Monitor } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ExternalWalletPopupsProps {
  onWalletSelected: (walletType: string) => void;
}

export function ExternalWalletPopups({ onWalletSelected }: ExternalWalletPopupsProps) {
  const [showWalletModal, setShowWalletModal] = useState(false);
  const { toast } = useToast();

  const wallets = [
    {
      id: 'metamask',
      name: 'MetaMask',
      description: 'Connect to your MetaMask wallet',
      icon: '🦊',
      chains: ['ETH', 'BSC', 'POLYGON', 'ARBITRUM', 'BASE', 'OPTIMISM'],
      mobile: true,
      desktop: true,
      downloadUrl: 'https://metamask.io/download/',
    },
    {
      id: 'walletconnect',
      name: 'WalletConnect',
      description: 'Scan QR code with any WalletConnect wallet',
      icon: '🔗',
      chains: ['ETH', 'BSC', 'POLYGON', 'ARBITRUM', 'BASE', 'OPTIMISM'],
      mobile: true,
      desktop: true,
    },
    {
      id: 'phantom',
      name: 'Phantom',
      description: 'Connect to your Phantom wallet',
      icon: '👻',
      chains: ['SOLANA'],
      mobile: true,
      desktop: true,
      downloadUrl: 'https://phantom.app/',
    },
    {
      id: 'solflare',
      name: 'Solflare',
      description: 'Connect to your Solflare wallet',
      icon: '🔥',
      chains: ['SOLANA'],
      mobile: true,
      desktop: true,
      downloadUrl: 'https://solflare.com/',
    },
    {
      id: 'xaman',
      name: 'Xaman (XRPL)',
      description: 'Connect to your Xaman XRPL wallet',
      icon: '✨',
      chains: ['XRP'],
      mobile: true,
      desktop: false,
      downloadUrl: 'https://xumm.app/',
    },
  ];

  const handleWalletClick = async (wallet: any) => {
    try {
      // Check if wallet is available
      const isAvailable = await checkWalletAvailability(wallet.id);
      
      if (!isAvailable) {
        // Show installation prompt
        toast({
          title: `${wallet.name} Not Found`,
          description: `Please install ${wallet.name} to continue.`,
          variant: "destructive"
        });
        
        if (wallet.downloadUrl) {
          window.open(wallet.downloadUrl, '_blank');
        }
        return;
      }

      // Close modal and trigger wallet connection
      setShowWalletModal(false);
      onWalletSelected(wallet.id);
      
      toast({
        title: "Connecting...",
        description: `Opening ${wallet.name} wallet`,
      });

    } catch (error) {
      toast({
        title: "Connection Failed",
        description: "Failed to connect to wallet. Please try again.",
        variant: "destructive"
      });
    }
  };

  const checkWalletAvailability = async (walletId: string): Promise<boolean> => {
    if (typeof window === 'undefined') return false;

    switch (walletId) {
      case 'metamask':
        return !!(window as any).ethereum?.isMetaMask;
      case 'phantom':
        return !!(window as any).phantom?.solana;
      case 'solflare':
        return !!(window as any).solflare;
      case 'walletconnect':
        return true; // WalletConnect is always available
      case 'xaman':
        return true; // Xaman uses QR/deep linking
      default:
        return false;
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Wallet address copied to clipboard",
    });
  };

  return (
    <div className="external-wallet-container">
      {/* Connect Wallet Button */}
      <Button 
        onClick={() => setShowWalletModal(true)}
        className="connect-wallet-btn w-full sm:w-auto px-6 py-3 font-semibold bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-lg shadow-lg transition-all duration-200"
      >
        <Wallet className="w-5 h-5 mr-2" />
        Connect Wallet
      </Button>

      {/* External Wallet Selection Modal */}
      <Dialog open={showWalletModal} onOpenChange={setShowWalletModal}>
        <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-center text-xl font-bold mb-2 sm:mb-4">
              Choose Your Wallet
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2 sm:space-y-3 max-h-[65vh] sm:max-h-[70vh] overflow-y-auto px-1">
            {wallets.map((wallet) => (
              <Card 
                key={wallet.id}
                className="cursor-pointer hover:shadow-lg transition-all duration-200 border-2 hover:border-blue-400"
                onClick={() => handleWalletClick(wallet)}
              >
                <CardContent className="p-3 sm:p-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                    <div className="flex items-center space-x-3 sm:space-x-4 w-full sm:w-auto">
                      <div className="text-2xl sm:text-3xl flex-shrink-0">
                        {wallet.icon}
                      </div>
                      <div className="flex-1 sm:flex-initial">
                        <h3 className="font-semibold text-base sm:text-lg">
                          {wallet.name}
                        </h3>
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 leading-tight">
                          {wallet.description}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-start sm:items-end space-y-1.5 sm:space-y-2 w-full sm:w-auto sm:ml-auto">
                      {/* Platform Support */}
                      <div className="flex flex-wrap gap-1">
                        {wallet.mobile && (
                          <Badge variant="secondary" className="text-[10px] sm:text-xs px-1.5 py-0.5">
                            <Smartphone className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-0.5 sm:mr-1" />
                            Mobile
                          </Badge>
                        )}
                        {wallet.desktop && (
                          <Badge variant="secondary" className="text-[10px] sm:text-xs px-1.5 py-0.5">
                            <Monitor className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-0.5 sm:mr-1" />
                            Desktop
                          </Badge>
                        )}
                      </div>
                      
                      {/* Supported Chains */}
                      <div className="flex flex-wrap gap-1 justify-start sm:justify-end w-full sm:w-auto">
                        {wallet.chains.slice(0, 3).map((chain) => (
                          <Badge key={chain} variant="outline" className="text-[10px] sm:text-xs px-1.5 py-0.5">
                            {chain}
                          </Badge>
                        ))}
                        {wallet.chains.length > 3 && (
                          <Badge variant="outline" className="text-[10px] sm:text-xs px-1.5 py-0.5">
                            +{wallet.chains.length - 3}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t">
            <p className="text-xs sm:text-sm text-gray-500 text-center">
              Don't have a wallet? Download one by clicking on your preferred option above.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
