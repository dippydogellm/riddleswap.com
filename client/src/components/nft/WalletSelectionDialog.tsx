import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { WalletSelector, WalletOption } from "@/utils/walletSelector";
import { useState, useEffect } from "react";
import { Check } from "lucide-react";

interface WalletSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWallet: (wallet: WalletOption) => void;
  title?: string;
  description?: string;
}

export function WalletSelectionDialog({
  isOpen,
  onClose,
  onSelectWallet,
  title = "Select Wallet",
  description = "Choose which wallet to use for this action"
}: WalletSelectionDialogProps) {
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<WalletOption | null>(null);

  useEffect(() => {
    if (isOpen) {
      const availableWallets = WalletSelector.getAvailableWallets();
      const connectedWallets = availableWallets.filter(w => w.isConnected);
      setWallets(connectedWallets);

      const preferred = WalletSelector.getPreferredWallet();
      setSelectedWallet(preferred);
    }
  }, [isOpen]);

  const handleSelectWallet = (wallet: WalletOption) => {
    setSelectedWallet(wallet);
  };

  const handleConfirm = () => {
    if (selectedWallet) {
      WalletSelector.setPreferredWallet(selectedWallet.type);
      onSelectWallet(selectedWallet);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:w-[90%] sm:max-w-2xl lg:max-w-3xl xl:max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 bg-gray-900 border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-blue-400">{title}</DialogTitle>
          <DialogDescription className="text-gray-400">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {wallets.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400 mb-4">No wallets connected</p>
              <Button
                onClick={onClose}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Close
              </Button>
            </div>
          ) : (
            <>
              {wallets.map((wallet) => (
                <button
                  key={wallet.type}
                  onClick={() => handleSelectWallet(wallet)}
                  className={`w-full p-4 rounded-lg border-2 transition-all ${
                    selectedWallet?.type === wallet.type
                      ? 'border-blue-500 bg-blue-500/20'
                      : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                  }`}
                  data-testid={`wallet-option-${wallet.type}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{wallet.icon}</span>
                      <div className="text-left">
                        <p className="font-semibold">{wallet.name}</p>
                        {wallet.address && (
                          <p className="text-xs text-gray-400 font-mono">
                            {wallet.address.slice(0, 8)}...{wallet.address.slice(-6)}
                          </p>
                        )}
                      </div>
                    </div>
                    {selectedWallet?.type === wallet.type && (
                      <Check className="w-5 h-5 text-blue-400" />
                    )}
                  </div>
                </button>
              ))}

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-800"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={!selectedWallet}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                  data-testid="button-confirm-wallet"
                >
                  Confirm
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
