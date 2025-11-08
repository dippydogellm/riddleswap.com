import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wallet, ExternalLink } from 'lucide-react';

interface WalletOption {
  id: string;
  name: string;
  type: 'riddle' | 'xaman' | 'joey';
  address: string;
  available: boolean;
}

interface WalletSelectorDialogProps {
  open: boolean;
  onClose: () => void;
  onSelectWallet: (walletType: 'riddle' | 'xaman' | 'joey', address: string) => void;
  availableWallets: WalletOption[];
}

export function WalletSelectorDialog({ 
  open, 
  onClose, 
  onSelectWallet,
  availableWallets 
}: WalletSelectorDialogProps) {
  
  const handleWalletClick = (wallet: WalletOption) => {
    if (wallet.available) {
      onSelectWallet(wallet.type, wallet.address);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:w-[90%] sm:max-w-2xl lg:max-w-3xl xl:max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-blue-500" />
            Select Wallet for Transaction
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <p className="text-sm text-muted-foreground">
            Choose which wallet to use for this NFT transaction:
          </p>

          {availableWallets.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Wallet className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No XRPL wallets connected</p>
              <p className="text-xs mt-2">Connect a wallet to continue</p>
            </div>
          )}

          {availableWallets.map((wallet) => (
            <Button
              key={wallet.id}
              variant="outline"
              className={`w-full justify-between p-4 h-auto ${
                wallet.available 
                  ? 'hover:bg-blue-50 dark:hover:bg-blue-950 hover:border-blue-500' 
                  : 'opacity-50 cursor-not-allowed'
              }`}
              onClick={() => handleWalletClick(wallet)}
              disabled={!wallet.available}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  wallet.type === 'riddle' ? 'bg-blue-100 dark:bg-blue-900' :
                  wallet.type === 'xaman' ? 'bg-purple-100 dark:bg-purple-900' :
                  'bg-green-100 dark:bg-green-900'
                }`}>
                  {wallet.type === 'riddle' && '🔐'}
                  {wallet.type === 'xaman' && <ExternalLink className="h-5 w-5 text-purple-600" />}
                  {wallet.type === 'joey' && <ExternalLink className="h-5 w-5 text-green-600" />}
                </div>
                
                <div className="text-left">
                  <div className="font-semibold capitalize flex items-center gap-2">
                    {wallet.name}
                    {wallet.type === 'riddle' && (
                      <Badge variant="secondary" className="text-xs">Built-in</Badge>
                    )}
                    {wallet.type !== 'riddle' && (
                      <Badge variant="outline" className="text-xs">External</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {wallet.address.slice(0, 12)}...{wallet.address.slice(-8)}
                  </div>
                </div>
              </div>

              {wallet.available && (
                <div className="text-xs text-blue-600 dark:text-blue-400">
                  Use →
                </div>
              )}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
          <div className="text-blue-600 dark:text-blue-400">💡</div>
          <p className="text-xs text-blue-700 dark:text-blue-300">
            <strong>Riddle Wallet:</strong> Sign with password. 
            <strong className="ml-2">External Wallets:</strong> Sign in app/extension.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
