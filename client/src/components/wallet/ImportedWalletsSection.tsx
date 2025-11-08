/**
 * Imported Wallets Section
 * Displays and manages user's imported wallets
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, Trash2, AlertCircle, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const CHAIN_COLORS: Record<string, string> = {
  ethereum: 'bg-green-500',
  solana: 'bg-purple-500',
  bitcoin: 'bg-orange-500',
  xrpl: 'bg-blue-500',
};

const CHAIN_NAMES: Record<string, string> = {
  ethereum: 'Ethereum',
  eth: 'Ethereum',
  solana: 'Solana',
  sol: 'Solana',
  bitcoin: 'Bitcoin',
  btc: 'Bitcoin',
  xrpl: 'XRP Ledger',
  xrp: 'XRP Ledger',
};

interface ImportedWallet {
  id: string;
  chain: string;
  address: string;
  importMethod: string;
  derivationPath?: string | null;
  importedAt: string;
}

export function ImportedWalletsSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteWalletId, setDeleteWalletId] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Fetch imported wallets
  const { data: walletsData, isLoading } = useQuery({
    queryKey: ['/api/wallets/import/imported'],
  });

  const importedWallets = (walletsData as { wallets?: ImportedWallet[] })?.wallets || [];

  const handleDeleteWallet = async () => {
    if (!deleteWalletId || !deletePassword) {
      toast({
        title: 'Error',
        description: 'Password is required to delete wallet',
        variant: 'destructive',
      });
      return;
    }

    setDeleting(true);

    try {
      const response = await fetch(`/api/wallets/import/${deleteWalletId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: deletePassword }),
      });

      const data = await response.json() as any;

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete wallet');
      }

      toast({
        title: 'Wallet Deleted',
        description: 'Imported wallet has been removed successfully',
      });

      // Refresh the list
      queryClient.invalidateQueries({ queryKey: ['/api/wallets/import/imported'] });
      
      // Close dialog
      setDeleteWalletId(null);
      setDeletePassword('');
    } catch (error: any) {
      toast({
        title: 'Delete Failed',
        description: error.message || 'Failed to delete wallet',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const formatAddress = (address: string) => {
    if (address.length <= 16) return address;
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5 text-blue-500" />
            Imported Wallets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5 text-blue-500" />
            Imported Wallets
          </CardTitle>
        </CardHeader>
        <CardContent>
          {importedWallets.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No imported wallets. Use the "Import Wallet" button on the dashboard to import wallets from mnemonic phrases, private keys, or XRPL seeds.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              {importedWallets.map((wallet) => {
                const chainName = CHAIN_NAMES[wallet.chain] || wallet.chain.toUpperCase();
                const chainColor = CHAIN_COLORS[wallet.chain] || 'bg-gray-500';

                return (
                  <Card key={wallet.id} className="border-2">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <div className={`w-10 h-10 ${chainColor} rounded-full flex items-center justify-center text-white font-semibold`}>
                            {chainName.substring(0, 3).toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold">{chainName}</span>
                              <Badge variant="outline" className="text-xs">
                                {wallet.importMethod.replace('_', ' ')}
                              </Badge>
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                              {formatAddress(wallet.address)}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                              <Calendar className="w-3 h-3" />
                              Imported {formatDate(wallet.importedAt)}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeleteWalletId(wallet.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteWalletId} onOpenChange={() => {
        setDeleteWalletId(null);
        setDeletePassword('');
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Imported Wallet</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Enter your password to confirm deletion.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-2">
            <Label htmlFor="deletePassword">Password</Label>
            <Input
              id="deletePassword"
              type="password"
              placeholder="Enter your wallet password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              disabled={deleting}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteWallet}
              disabled={deleting || !deletePassword}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Deleting...' : 'Delete Wallet'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
