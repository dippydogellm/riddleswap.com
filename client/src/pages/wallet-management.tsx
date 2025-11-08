import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { WalletImportModal } from "@/components/wallet/wallet-import-modal";
import { Plus, Wallet, Download, Trash2, Settings, Eye } from "lucide-react";
import { type SupportedChain } from "@/lib/wallet-import-simple";

interface ImportedWallet {
  id: string;
  address: string;
  chain: string;
  wallet_name: string;
  public_key: string;
  import_method: string;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
}

const CHAIN_ICONS: Record<string, string> = {
  ethereum: '🟢',
  bitcoin: '🟠',
  solana: '🟣',
  xrpl: '🔵',
  base: '🔷',
  bsc: '🟡',
  polygon: '🟪',
};

const CHAIN_NAMES: Record<string, string> = {
  ethereum: 'Ethereum',
  bitcoin: 'Bitcoin',
  solana: 'Solana',
  xrpl: 'XRPL',
  base: 'Base',
  bsc: 'BNB Chain',
  polygon: 'Polygon',
};

export default function WalletManagementPage() {
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedChain, setSelectedChain] = useState<string>('');

  // Fetch imported wallets
  const { data: walletsData, isLoading, refetch } = useQuery({
    queryKey: ['/wallets/imported'],
    queryFn: async () => {
      const response = await fetch('/wallets/imported');
      if (!response.ok) throw new Error('Failed to fetch wallets');
      return response.json();
    }
  });

  const wallets: ImportedWallet[] = walletsData?.wallets || [];

  // Group wallets by chain
  const walletsByChain = wallets.reduce((acc, wallet) => {
    if (!acc[wallet.chain]) {
      acc[wallet.chain] = [];
    }
    acc[wallet.chain].push(wallet);
    return acc;
  }, {} as Record<string, ImportedWallet[]>);

  const handleImportSuccess = (address: string, chain: SupportedChain) => {
    refetch();
  };

  const handleDeleteWallet = async (walletId: string) => {
    const password = prompt('Enter your wallet password to confirm deletion:');
    if (!password) return;

    try {
      const response = await fetch(`/wallets/${walletId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      if (!response.ok) {
        const error = await response.json() as any;
        throw new Error(error.error || 'Failed to delete wallet');
      }

      refetch();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete wallet');
    }
  };

  const handleExportWallet = async (walletId: string) => {
    const password = prompt('Enter your wallet password to export:');
    if (!password) return;

    try {
      const response = await fetch(`/wallets/export/${walletId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      if (!response.ok) {
        const error = await response.json() as any;
        throw new Error(error.error || 'Failed to export wallet');
      }

      const data = await response.json() as any;
      const blob = new Blob([JSON.stringify(data.export_data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wallet-export-${walletId}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to export wallet');
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading wallets...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Wallet Management</h1>
          <p className="text-muted-foreground">
            Import and manage wallets for all supported blockchains
          </p>
        </div>

      </div>

      {wallets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No wallets imported</h3>
            <p className="text-muted-foreground text-center mb-6">
              Import your first wallet to get started with multi-chain trading
            </p>

          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Wallet className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Total Wallets</p>
                    <p className="text-2xl font-bold">{wallets.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">🔗</span>
                  <div>
                    <p className="text-sm font-medium">Supported Chains</p>
                    <p className="text-2xl font-bold">{Object.keys(walletsByChain).length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">✅</span>
                  <div>
                    <p className="text-sm font-medium">Active Wallets</p>
                    <p className="text-2xl font-bold">
                      {wallets.filter(w => w.is_active).length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Wallets by Chain */}
          {Object.entries(walletsByChain).map(([chain, chainWallets]) => (
            <Card key={chain}>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <span className="text-2xl">{CHAIN_ICONS[chain] || '🔗'}</span>
                  <span>{CHAIN_NAMES[chain] || chain}</span>
                  <Badge variant="secondary">{chainWallets.length} wallet{chainWallets.length !== 1 ? 's' : ''}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {chainWallets.map((wallet) => (
                    <div key={wallet.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold">{wallet.wallet_name}</h3>
                          {wallet.is_default && (
                            <Badge variant="default">Default</Badge>
                          )}
                          <Badge variant={wallet.is_active ? "default" : "secondary"}>
                            {wallet.is_active ? "Active" : "Inactive"}
                          </Badge>
                          <Badge variant="outline">{wallet.import_method.replace('_', ' ')}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p><strong>Address:</strong> {formatAddress(wallet.address)}</p>
                          <p><strong>Imported:</strong> {formatDate(wallet.created_at)}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigator.clipboard.writeText(wallet.address)}
                        >
                          Copy Address
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExportWallet(wallet.id)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteWallet(wallet.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Security Notice */}
      <Alert>
        <AlertDescription>
          <strong>Security Notice:</strong> Your private keys are encrypted and stored securely. 
          Always keep your passwords safe and never share them with anyone. 
          Consider exporting your wallets as backup files and storing them in a secure location.
        </AlertDescription>
      </Alert>

      {/* Import Modal */}
      <WalletImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={handleImportSuccess}
      />
    </div>
  );
}
