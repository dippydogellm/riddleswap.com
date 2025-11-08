import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Wallet, ExternalLink, Copy, Shield, Link as LinkIcon, 
  CheckCircle2, XCircle, Clock, Crown, Zap, Target
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

interface AllWalletsData {
  riddleWallet: {
    handle: string;
    xrpAddress: string;
    ethAddress: string;
    solAddress: string;
    btcAddress: string;
    createdAt: string;
  } | null;
  linkedWallets: Array<{
    id: string;
    address: string;
    chain: string;
    wallet_type: string;
    verified: boolean;
    source: string;
    created_at: string;
    wallet_label: string;
  }>;
  externalWallets: Array<{
    id: number;
    address: string;
    chain: string;
    wallet_type: string;
    verified: boolean;
    connected_at: string;
  }>;
  projects: Array<any>;
  walletProjectLinks: Array<any>;
  summary: {
    total_wallets: number;
    riddle_wallet: number;
    linked_wallets: number;
    external_wallets: number;
    total_projects: number;
    linked_projects: number;
  };
}

export default function AllWalletsDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  const { data, isLoading, error } = useQuery<AllWalletsData>({
    queryKey: ['/api/devtools/all-wallets'],
  });

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: `${label} copied to clipboard`,
      });
    } catch (err) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const getChainColor = (chain: string) => {
    const colors: Record<string, string> = {
      xrpl: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      ethereum: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      solana: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      bitcoin: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    };
    return colors[chain?.toLowerCase()] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  };

  const getSourceBadge = (source: string) => {
    const badges: Record<string, { label: string; className: string }> = {
      riddle_login: { label: 'Riddle Login', className: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200' },
      external: { label: 'External', className: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200' },
      manual: { label: 'Manual', className: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200' },
    };
    return badges[source] || { label: source, className: 'bg-gray-100 text-gray-800' };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">Loading wallet data...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-red-200 dark:border-red-800">
        <CardContent className="p-6 text-center">
          <p className="text-red-600 dark:text-red-400">Failed to load wallet data</p>
        </CardContent>
      </Card>
    );
  }

  const toggleProjectExpand = (projectId: string) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
    }
    setExpandedProjects(newExpanded);
  };

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-indigo-500/10 rounded-lg">
                <Wallet className="w-4 h-4 text-indigo-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.summary.total_wallets}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">Total Wallets</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Crown className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.summary.riddle_wallet}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">Riddle</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <LinkIcon className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.summary.linked_wallets}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">Linked</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-cyan-500/10 rounded-lg">
                <Clock className="w-4 h-4 text-cyan-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.summary.external_wallets}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">Session</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Target className="w-4 h-4 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.summary.total_projects}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">Projects</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-pink-500/10 rounded-lg">
                <Zap className="w-4 h-4 text-pink-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.summary.linked_projects}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">Links</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Riddle Wallet Section */}
      {data.riddleWallet && (
        <Card className="border-indigo-200 dark:border-indigo-800 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-indigo-600" />
              Riddle Wallet - {data.riddleWallet.handle}
              <Badge className="ml-2 bg-indigo-500">Primary</Badge>
            </CardTitle>
            <CardDescription>
              Multi-chain wallet created on {new Date(data.riddleWallet.createdAt).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: 'XRP', address: data.riddleWallet.xrpAddress, chain: 'xrpl' },
                { label: 'ETH', address: data.riddleWallet.ethAddress, chain: 'ethereum' },
                { label: 'SOL', address: data.riddleWallet.solAddress, chain: 'solana' },
                { label: 'BTC', address: data.riddleWallet.btcAddress, chain: 'bitcoin' },
              ].map(({ label, address, chain }) => (
                <div key={label} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800/50 rounded-lg border">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={`text-xs ${getChainColor(chain)}`}>{label}</Badge>
                    </div>
                    <code className="text-xs text-slate-600 dark:text-slate-400 truncate block">
                      {address}
                    </code>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(address, label)}
                    className="ml-2"
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Linked Wallets Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="w-5 h-5 text-green-600" />
            Linked Wallets ({data.linkedWallets.length})
            <Badge variant="secondary" className="ml-2">Permanent</Badge>
          </CardTitle>
          <CardDescription>
            Permanently linked external wallets and Riddle login addresses
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.linkedWallets.length === 0 ? (
            <p className="text-center text-slate-500 py-8">No linked wallets yet</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.linkedWallets.map((wallet) => {
                const sourceBadge = getSourceBadge(wallet.source);
                return (
                  <div 
                    key={wallet.id} 
                    className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
                          <Wallet className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-sm capitalize">{wallet.wallet_type}</p>
                          <Badge className={`text-xs ${getChainColor(wallet.chain)}`}>
                            {wallet.chain.toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                      {wallet.verified ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                      {wallet.wallet_label}
                    </p>
                    <div className="flex items-center justify-between mb-2">
                      <code className="text-xs text-slate-600 dark:text-slate-400 truncate">
                        {wallet.address.slice(0, 12)}...{wallet.address.slice(-8)}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(wallet.address, wallet.wallet_type)}
                        className="h-6 w-6 p-0"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-xs ${sourceBadge.className}`}>
                        {sourceBadge.label}
                      </Badge>
                      <span className="text-xs text-slate-500">
                        {new Date(wallet.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* External Wallets Section (Session-Only) */}
      {data.externalWallets.length > 0 && (
        <Card className="border-cyan-200 dark:border-cyan-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-cyan-600" />
              Session Wallets ({data.externalWallets.length})
              <Badge variant="secondary" className="ml-2 bg-cyan-100 text-cyan-800">Temporary</Badge>
            </CardTitle>
            <CardDescription>
              Session-only wallet connections (not saved to your account)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.externalWallets.map((wallet) => (
                <div 
                  key={wallet.id} 
                  className="p-4 bg-cyan-50 dark:bg-cyan-900/10 rounded-lg border border-cyan-200 dark:border-cyan-800"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
                        <Wallet className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="font-medium text-sm capitalize">{wallet.wallet_type}</p>
                        <Badge className={`text-xs ${getChainColor(wallet.chain)}`}>
                          {wallet.chain.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <code className="text-xs text-slate-600 dark:text-slate-400 truncate">
                      {wallet.address.slice(0, 12)}...{wallet.address.slice(-8)}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(wallet.address, wallet.wallet_type)}
                      className="h-6 w-6 p-0"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Projects Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-orange-600" />
            Your Projects ({data.projects.length})
          </CardTitle>
          <CardDescription>
            Projects owned by your connected wallets
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.projects.length === 0 ? (
            <p className="text-center text-slate-500 py-8">No projects found</p>
          ) : (
            <div className="space-y-4">
              {data.projects.map((project) => (
                <div 
                  key={project.id} 
                  className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{project.name}</h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        {project.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={
                        project.status === 'active' ? 'bg-green-100 text-green-800' :
                        project.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-slate-100 text-slate-800'
                      }>
                        {project.status}
                      </Badge>
                      <Badge variant="outline">{project.projectType || project.asset_type}</Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-600 dark:text-slate-400">Owner:</span>
                      <code className="ml-2 text-xs">
                        {project.ownerWalletAddress?.slice(0, 8)}...
                      </code>
                    </div>
                    <div>
                      <span className="text-slate-600 dark:text-slate-400">Created:</span>
                      <span className="ml-2">
                        {new Date(project.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  {project.claim_status && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          Claim Status: <Badge variant="outline">{project.claim_status}</Badge>
                        </span>
                        {project.claim_status === 'unclaimed' && (
                          <Button size="sm" variant="outline">
                            <Shield className="w-3 h-3 mr-1" />
                            Claim Project
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
