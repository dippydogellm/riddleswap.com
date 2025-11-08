import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wallet, ExternalLink } from 'lucide-react';
import { walletChainManager } from '@/lib/wallet-chain-manager';

interface WalletRequiredPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onWalletSelected?: (walletType: string, address: string) => void;
}

interface ConnectedWallet {
  wallet: string;
  chain: string;
  address: string;
  name: string;
  icon: string;
}

export function WalletRequiredPopup({ isOpen, onClose, onWalletSelected }: WalletRequiredPopupProps) {
  const [connectedWallets, setConnectedWallets] = useState<ConnectedWallet[]>([]);
  const [riddleWalletConnected, setRiddleWalletConnected] = useState(false);

  const supportedWallets = [
    { id: 'xaman', name: 'Xaman', chains: ['XRP'], icon: '/images/wallets/xaman-logo.png' },
    { id: 'joey', name: 'Joey Wallet', chains: ['XRP'], icon: '/images/wallets/joey-logo.png' },
    { id: 'phantom', name: 'Phantom', chains: ['Solana'], icon: '/images/wallets/phantom-logo.png' },
    { id: 'metamask', name: 'MetaMask', chains: ['Ethereum', 'BSC', 'Polygon', 'Base', 'Arbitrum', 'Optimism'], icon: '/images/wallets/metamask-logo.png' },
  ];

  useEffect(() => {
    if (isOpen) {
      // Check for Riddle wallet
      const sessionToken = localStorage.getItem('sessionToken');
      const riddleWallet = localStorage.getItem('riddleWallet');
      setRiddleWalletConnected(!!(sessionToken && riddleWallet));

      // Check for external wallets
      const externalWallets: ConnectedWallet[] = [];
      
      supportedWallets.forEach(wallet => {
        wallet.chains.forEach(chain => {
          if (walletChainManager.isConnected(wallet.id, chain)) {
            const address = walletChainManager.getAddress(wallet.id, chain);
            if (address) {
              externalWallets.push({
                wallet: wallet.id,
                chain,
                address,
                name: wallet.name,
                icon: wallet.icon
              });
            }
          }
        });
      });
      
      setConnectedWallets(externalWallets);
    }
  }, [isOpen]);

  const handleWalletSelect = (wallet: ConnectedWallet) => {
    onWalletSelected?.(wallet.wallet, wallet.address);
    onClose();
  };

  const handleRiddleWalletSelect = () => {
    // Redirect to login or wallet connection
    window.location.href = '/wallet-login';
  };

  const hasAnyWallets = riddleWalletConnected || connectedWallets.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto bg-gray-900 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-white text-center flex items-center justify-center gap-2">
            <Wallet className="h-5 w-5" />
            {hasAnyWallets ? 'Choose Wallet' : 'Connect Wallet Required'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          {hasAnyWallets ? (
            <>
              {riddleWalletConnected && (
                <div className="border border-blue-500 rounded-lg p-3 bg-blue-500/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                        <Wallet className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <p className="text-white font-medium">Riddle Wallet</p>
                        <Badge variant="secondary" className="text-xs">Connected</Badge>
                      </div>
                    </div>
                    <Button
                      onClick={() => onWalletSelected?.('riddle', 'riddle')}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      size="sm"
                    >
                      Use
                    </Button>
                  </div>
                </div>
              )}

              {connectedWallets.map((wallet, index) => (
                <div key={index} className="border border-gray-600 rounded-lg p-3 hover:border-gray-500 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img 
                        src={wallet.icon} 
                        alt={wallet.name}
                        className="w-8 h-8 rounded-full"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTIxIDEyQzIxIDEzLjEgMjAuMSAxNCAyMCAxNEg0QzMuOSAxNCAzIDEzLjEgMyAxMlM0IDEwIDQgMTBIMjBDMjAuMSAxMCAyMSAxMS45IDIxIDEyWiIgZmlsbD0iIzk5OWNBMyIvPgo8L3N2Zz4K';
                        }}
                      />
                      <div>
                        <p className="text-white font-medium">{wallet.name}</p>
                        <p className="text-gray-400 text-xs">{wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}</p>
                        <Badge variant="outline" className="text-xs mt-1">{wallet.chain}</Badge>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleWalletSelect(wallet)}
                      className="bg-green-600 hover:bg-green-700 text-white"
                      size="sm"
                    >
                      Use
                    </Button>
                  </div>
                </div>
              ))}

              <div className="border-t border-gray-700 pt-4">
                <Button 
                  onClick={onClose}
                  variant="outline"
                  className="w-full"
                >
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-gray-300 text-center">
                You need to connect a wallet to buy NFTs or make offers
              </p>
              
              <div className="space-y-2">
                <Button 
                  onClick={handleRiddleWalletSelect}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Wallet className="mr-2 h-4 w-4" />
                  Connect Riddle Wallet
                </Button>
                
                <Button 
                  onClick={() => {
                    // You can add logic to open external wallet dashboard
                    onClose();
                  }}
                  variant="outline"
                  className="w-full"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Connect External Wallet
                </Button>
              </div>

              <div className="border-t border-gray-700 pt-4">
                <Button 
                  onClick={onClose}
                  variant="outline"
                  className="w-full"
                >
                  Cancel
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
