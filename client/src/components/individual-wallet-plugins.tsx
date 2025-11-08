import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wallet, ExternalLink, QrCode, Smartphone, Download, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface IndividualWalletPluginsProps {
  isOpen: boolean;
  onClose: () => void;
  onWalletConnected: (walletType: string, address: string) => void;
}

export function IndividualWalletPlugins({ isOpen, onClose, onWalletConnected }: IndividualWalletPluginsProps) {
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [walletStates, setWalletStates] = useState<{[key: string]: any}>({});
  const { toast } = useToast();

  const walletPlugins = [
    {
      id: 'metamask',
      name: 'MetaMask',
      description: 'Most popular Ethereum wallet',
      icon: '🦊',
      chains: ['ETH', 'BSC', 'POLYGON', 'ARBITRUM', 'BASE', 'OPTIMISM'],
      color: 'from-orange-400 to-orange-600',
      downloadUrl: 'https://metamask.io/download/',
      deepLink: 'https://metamask.app.link/dapp/',
    },
    {
      id: 'walletconnect',
      name: 'WalletConnect',
      description: 'Connect any mobile wallet via QR',
      icon: '🔗',
      chains: ['ETH', 'BSC', 'POLYGON', 'ARBITRUM', 'BASE', 'OPTIMISM'],
      color: 'from-blue-400 to-blue-600',
      qrCode: true,
    },
    {
      id: 'phantom',
      name: 'Phantom',
      description: 'Leading Solana wallet',
      icon: '👻',
      chains: ['SOLANA'],
      color: 'from-purple-400 to-purple-600',
      downloadUrl: 'https://phantom.app/',
      deepLink: 'https://phantom.app/ul/browse/',
    },
    {
      id: 'solflare',
      name: 'Solflare',
      description: 'Secure Solana wallet',
      icon: '🔥',
      chains: ['SOLANA'],
      color: 'from-yellow-400 to-orange-500',
      downloadUrl: 'https://solflare.com/',
    },
    {
      id: 'xaman',
      name: 'Xaman',
      description: 'Official XRPL mobile wallet',
      icon: '✨',
      chains: ['XRP'],
      color: 'from-green-400 to-blue-500',
      downloadUrl: 'https://xumm.app/',
      qrCode: true,
      mobileOnly: true,
    },
  ];

  // Check wallet availability on component mount
  useEffect(() => {
    const checkWallets = async () => {
      const states: {[key: string]: any} = {};
      
      for (const wallet of walletPlugins) {
        const isAvailable = await checkWalletAvailability(wallet.id);
        states[wallet.id] = {
          available: isAvailable,
          connecting: false,
          connected: false,
        };
      }
      
      setWalletStates(states);
    };

    if (isOpen) {
      checkWallets();
    }
  }, [isOpen]);

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
        return true; // Always available via QR
      case 'xaman':
        return true; // Always available via QR/deep link
      default:
        return false;
    }
  };

  const handleWalletSelect = async (wallet: any) => {
    const currentState = walletStates[wallet.id];
    
    if (!currentState?.available && !wallet.qrCode) {
      // Wallet not installed - redirect to download
      toast({
        title: `${wallet.name} Not Found`,
        description: `Install ${wallet.name} to continue`,
        variant: "destructive"
      });
      
      if (wallet.downloadUrl) {
        window.open(wallet.downloadUrl, '_blank');
      }
      return;
    }

    // Update connecting state
    setWalletStates(prev => ({
      ...prev,
      [wallet.id]: { ...prev[wallet.id], connecting: true }
    }));

    try {
      const result = await connectWallet(wallet);
      
      if (result.success) {
        setWalletStates(prev => ({
          ...prev,
          [wallet.id]: { ...prev[wallet.id], connecting: false, connected: true }
        }));
        
        toast({
          title: "Wallet Connected!",
          description: `Connected to ${wallet.name}`,
        });
        
        onWalletConnected(wallet.id, result.address || '');
        onClose();
      } else {
        throw new Error(result.error || 'Connection failed');
      }
    } catch (error: any) {
      setWalletStates(prev => ({
        ...prev,
        [wallet.id]: { ...prev[wallet.id], connecting: false }
      }));
      
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect wallet",
        variant: "destructive"
      });
    }
  };

  const connectWallet = async (wallet: any): Promise<{success: boolean, address?: string, error?: string}> => {
    switch (wallet.id) {
      case 'metamask':
        return await connectMetaMask();
      case 'phantom':
        return await connectPhantom();
      case 'walletconnect':
        return await connectWalletConnect();
      case 'xaman':
        return await connectXaman();
      case 'solflare':
        return await connectSolflare();
      default:
        return { success: false, error: 'Unsupported wallet' };
    }
  };

  const connectMetaMask = async () => {
    try {
      const ethereum = (window as any).ethereum;
      if (!ethereum?.isMetaMask) {
        throw new Error('MetaMask not found');
      }
      
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      return { success: true, address: accounts[0] };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const connectPhantom = async () => {
    try {
      const phantom = (window as any).phantom?.solana;
      if (!phantom) {
        throw new Error('Phantom not found');
      }
      
      const response = await phantom.connect();
      return { success: true, address: response.publicKey.toString() };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const connectSolflare = async () => {
    try {
      const solflare = (window as any).solflare;
      if (!solflare) {
        throw new Error('Solflare not found');
      }
      
      const response = await solflare.connect();
      return { success: true, address: response.publicKey.toString() };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const connectWalletConnect = async () => {
    // For now, return mock - implement actual WalletConnect later
    return { success: false, error: 'WalletConnect implementation pending' };
  };

  const connectXaman = async () => {
    // For now, return mock - implement actual Xaman later
    return { success: false, error: 'Xaman implementation pending' };
  };

  const isMobile = () => {
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="wallet-plugins-modal max-w-2xl w-[95vw] mx-auto max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-bold mb-2">
            Connect Your Wallet
          </DialogTitle>
          <p className="text-sm text-gray-600 text-center">
            Choose your preferred wallet to get started
          </p>
        </DialogHeader>

        <div className="wallet-plugins-grid space-y-3 overflow-y-auto max-h-[70vh] px-1">
          {walletPlugins.map((wallet) => {
            const state = walletStates[wallet.id] || {};
            const isConnecting = state.connecting;
            const isAvailable = state.available;
            const showQR = wallet.qrCode && isMobile();

            return (
              <Card 
                key={wallet.id}
                className={`wallet-plugin-card cursor-pointer transition-all duration-200 border-2 hover:shadow-xl ${
                  isConnecting ? 'border-blue-400 bg-blue-50' : 'hover:border-blue-300'
                } ${wallet.mobileOnly && !isMobile() ? 'opacity-60' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!isConnecting) {
                    handleWalletSelect(wallet);
                  }
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className={`wallet-plugin-icon text-4xl p-3 rounded-xl bg-gradient-to-br ${wallet.color} shadow-lg`}>
                        {wallet.icon}
                      </div>
                      <div>
                        <h3 className="wallet-plugin-name font-semibold text-lg flex items-center">
                          {wallet.name}
                          {!isAvailable && !wallet.qrCode && (
                            <Download className="w-4 h-4 ml-2 text-orange-500" />
                          )}
                          {wallet.mobileOnly && (
                            <Smartphone className="w-4 h-4 ml-2 text-blue-500" />
                          )}
                          {wallet.qrCode && (
                            <QrCode className="w-4 h-4 ml-2 text-green-500" />
                          )}
                        </h3>
                        <p className="wallet-plugin-description text-sm text-gray-600 dark:text-gray-400">
                          {wallet.description}
                        </p>
                        <div className="chain-support flex flex-wrap gap-1 mt-2">
                          {wallet.chains.map((chain) => (
                            <Badge key={chain} variant="outline" className="text-xs">
                              {chain}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <div className="wallet-plugin-status flex flex-col items-end space-y-2">
                      {isConnecting ? (
                        <div className="flex items-center text-blue-600">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                          <span className="text-sm">Connecting...</span>
                        </div>
                      ) : !isAvailable && !wallet.qrCode ? (
                        <div className="flex items-center text-orange-600">
                          <AlertCircle className="w-4 h-4 mr-1" />
                          <span className="text-sm">Install</span>
                        </div>
                      ) : (
                        <Button 
                          size="sm" 
                          className={`connect-btn bg-gradient-to-r ${wallet.color} text-white`}
                        >
                          Connect
                        </Button>
                      )}
                      
                      {wallet.mobileOnly && !isMobile() && (
                        <Badge variant="secondary" className="text-xs">
                          Mobile Only
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="modal-footer mt-4 pt-4 border-t text-center">
          <p className="text-xs text-gray-500">
            New to crypto? Download a wallet by clicking on any option above.
          </p>
        </div>
      </DialogContent>

      {/* Mobile-responsive CSS */}
      <style>{`
        @media (max-width: 768px) {
          .wallet-plugins-modal {
            max-height: 95vh !important;
            width: 98vw !important;
          }
          
          .wallet-plugins-grid {
            max-height: 75vh !important;
          }
          
          .wallet-plugin-card .p-4 {
            padding: 16px !important;
          }
          
          .wallet-plugin-icon {
            font-size: 28px !important;
            padding: 8px !important;
          }
          
          .wallet-plugin-name {
            font-size: 16px !important;
          }
          
          .wallet-plugin-description {
            font-size: 12px !important;
            line-height: 1.3 !important;
          }
        }
        
        @media (max-width: 480px) {
          .wallet-plugin-card .flex {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 12px !important;
          }
          
          .wallet-plugin-status {
            align-items: flex-start !important;
            flex-direction: row !important;
            width: 100% !important;
            justify-content: space-between !important;
          }
        }
      `}</style>
    </Dialog>
  );
}
