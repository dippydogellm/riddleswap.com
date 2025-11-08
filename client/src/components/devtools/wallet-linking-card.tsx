import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, Wallet, ExternalLink, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { ExternalWallet } from '@shared/schema';

interface WalletLinkingCardProps {
  wallet: ExternalWallet & {
    linkedProjectCount?: number;
    isProjectOwner?: boolean;
  };
  onWalletUnlinked?: () => void;
}

export default function WalletLinkingCard({ wallet, onWalletUnlinked }: WalletLinkingCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isUnlinking, setIsUnlinking] = useState(false);

  const unlinkWalletMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/devtools/wallets/unlink/${wallet.id}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      toast({
        title: "Wallet Unlinked",
        description: "Wallet has been successfully unlinked from your account.",
      });
      // Invalidate and refetch wallet data
      queryClient.invalidateQueries({ queryKey: ['/api/devtools/wallets'] });
      onWalletUnlinked?.();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Unlink Wallet",
        description: error.response?.data?.error || "An error occurred while unlinking the wallet.",
        variant: "destructive",
      });
    }
  });

  const handleUnlink = async () => {
    if (!confirm('Are you sure you want to unlink this wallet? This action cannot be undone.')) {
      return;
    }

    setIsUnlinking(true);
    try {
      await unlinkWalletMutation.mutateAsync();
    } finally {
      setIsUnlinking(false);
    }
  };

  const getChainDisplayName = (chain: string) => {
    const chainMap: Record<string, string> = {
      'eth': 'Ethereum',
      'ethereum': 'Ethereum',
      'bsc': 'BNB Chain',
      'polygon': 'Polygon',
      'arbitrum': 'Arbitrum',
      'optimism': 'Optimism',
      'base': 'Base',
      'xrp': 'XRP Ledger',
      'xrpl': 'XRP Ledger',
      'sol': 'Solana',
      'solana': 'Solana'
    };
    return chainMap[chain.toLowerCase()] || chain.toUpperCase();
  };

  const getWalletTypeDisplayName = (walletType: string) => {
    const walletMap: Record<string, string> = {
      'metamask': 'MetaMask',
      'phantom': 'Phantom',
      'xaman': 'Xaman (XUMM)',
      'joey': 'Joey Wallet',
      'walletconnect': 'WalletConnect',
      'coinbase': 'Coinbase Wallet'
    };
    return walletMap[walletType.toLowerCase()] || walletType;
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return 'Unknown';
    return new Date(date).toLocaleDateString();
  };

  return (
    <Card className="wallet-card" data-testid={`wallet-card-${wallet.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="wallet-icon">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">
                {getWalletTypeDisplayName(wallet.wallet_type)}
              </CardTitle>
              <CardDescription>
                {getChainDisplayName(wallet.chain)} • Connected {formatDate(wallet.connected_at)}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {wallet.verified ? (
              <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Verified
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Unverified
              </Badge>
            )}
            {wallet.isProjectOwner && (
              <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                Project Owner
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          {/* Wallet Address */}
          <div className="wallet-address-section">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Wallet Address</p>
                <p 
                  className="text-sm font-mono bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded mt-1"
                  data-testid={`wallet-address-${wallet.id}`}
                >
                  {formatAddress(wallet.address)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(wallet.address);
                  toast({
                    title: "Address Copied",
                    description: "Wallet address copied to clipboard",
                  });
                }}
                data-testid={`copy-address-${wallet.id}`}
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Project Stats */}
          {wallet.linkedProjectCount !== undefined && (
            <div className="project-stats">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">Linked Projects</span>
                <span className="font-medium" data-testid={`project-count-${wallet.id}`}>
                  {wallet.linkedProjectCount}
                </span>
              </div>
            </div>
          )}

          {/* Last Used */}
          <div className="last-used">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">Last Used</span>
              <span className="font-medium">
                {formatDate(wallet.last_used)}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="wallet-actions pt-2 border-t border-slate-200 dark:border-slate-700">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleUnlink}
              disabled={isUnlinking || unlinkWalletMutation.isPending}
              className="w-full"
              data-testid={`unlink-wallet-${wallet.id}`}
            >
              {isUnlinking || unlinkWalletMutation.isPending ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                  Unlinking...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Unlink Wallet
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
