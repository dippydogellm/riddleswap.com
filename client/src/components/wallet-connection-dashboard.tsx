import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Wallet, 
  Trash2,
  Loader2,
  CheckCircle,
  Plus,
  X,
  AlertCircle
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { walletChainManager } from '@/lib/wallet-chain-manager';
import { XamanConnectQR } from './XamanConnectQR';
import { JoeyConnectQR } from './JoeyConnectQR';

interface ExternalWallet {
  id: number;
  wallet_type: string;
  address: string;
  chain: string;
  verified: boolean;
  connected_at: string;
  last_used: string;
}

interface ExternalWalletsResponse {
  wallets: ExternalWallet[];
}

interface WalletConnectionDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WalletConnectionDashboard = ({ isOpen, onClose }: WalletConnectionDashboardProps) => {
  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const [selectedChain, setSelectedChain] = useState<string>('all'); // New: Chain selection
  const [xamanQROpen, setXamanQROpen] = useState(false);
  const [joeyQROpen, setJoeyQROpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch external wallets from database
  const { data: walletsResponse, isLoading: isLoadingWallets } = useQuery({
    queryKey: ['/api/external-wallets/list'],
    enabled: isOpen,
  });
  
  const externalWallets = (walletsResponse as ExternalWalletsResponse)?.wallets || [];

  // Mutation to disconnect an external wallet
  const disconnectMutation = useMutation({
    mutationFn: async (walletId: number) => {
      return await apiRequest(`/api/external-wallets/${walletId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/external-wallets/list'] });
      toast({
        title: 'Success',
        description: 'External wallet unlinked successfully',
      });
    },
    onError: (error) => {
      console.error('❌ Failed to unlink wallet:', error);
      toast({
        title: 'Error',
        description: 'Failed to unlink external wallet',
        variant: 'destructive',
      });
    },
  });

  // Chain filter options
  const chainFilters = [
    { id: 'all', name: 'All Chains', color: 'text-gray-600' },
    { id: 'evm', name: 'Ethereum', color: 'text-green-600', description: 'Ethereum & EVM chains' },
    { id: 'sol', name: 'Solana', color: 'text-purple-600', description: 'Solana blockchain' },
    { id: 'xrp', name: 'XRPL', color: 'text-blue-600', description: 'XRP Ledger' }
  ];

  // Wallet definitions with enhanced chain mapping
  const walletTypes = [
    {
      id: 'metamask',
      name: 'MetaMask',
      icon: '/images/wallets/metamask-logo.png',
      chain: 'evm',
      chainName: 'Ethereum',
      description: 'Popular browser wallet for Ethereum & EVM chains',
      priority: 1
    },
    {
      id: 'phantom',
      name: 'Phantom',
      icon: '/images/wallets/phantom-logo.png',
      chain: 'sol',
      chainName: 'Solana',
      description: 'Leading Solana wallet with built-in dApp browser',
      priority: 1
    },
    {
      id: 'xaman',
      name: 'Xaman',
      icon: '/images/wallets/xaman-logo.png',
      chain: 'xrp',
      chainName: 'XRP Ledger',
      description: 'Professional XRPL wallet with advanced features',
      priority: 1
    },
    {
      id: 'joey',
      name: 'Joey',
      icon: '/images/wallets/joey-logo.png',
      chain: 'xrp',
      chainName: 'XRP Ledger',
      description: 'Simple and secure XRP Ledger wallet',
      priority: 2
    }
  ];

  // Filter wallets based on selected chain
  const filteredWalletTypes = selectedChain === 'all' 
    ? walletTypes.sort((a, b) => a.priority - b.priority)
    : walletTypes.filter(wallet => wallet.chain === selectedChain).sort((a, b) => a.priority - b.priority);

  // Get connected wallets organized by type (from both database AND local storage)
  const getConnectedWallets = () => {
    // Handle both response formats: ExternalWalletsResponse or ExternalWallet[]
    const dbWallets = Array.isArray(externalWallets) 
      ? externalWallets 
      : (externalWallets as ExternalWalletsResponse)?.wallets || [];
    
    const organized: { [key: string]: ExternalWallet[] } = {};
    
    // Add database wallets
    dbWallets.forEach(wallet => {
      if (wallet.verified) {
        if (!organized[wallet.wallet_type]) {
          organized[wallet.wallet_type] = [];
        }
        organized[wallet.wallet_type].push(wallet);
      }
    });
    
    // CRITICAL: Also add wallets from walletChainManager (local storage)
    // This ensures wallets appear even before database sync
    const localWallets = walletChainManager.getAllConnections();
    
    localWallets.forEach(localWallet => {
      // FIXED: Use 'wallet' not 'walletType' based on WalletChainConnection interface
      const walletType = localWallet.wallet;
      const address = localWallet.address;
      
      // Check if this wallet is already in the organized list (avoid duplicates)
      const existingWallets = organized[walletType] || [];
      const alreadyExists = existingWallets.some(w => w.address.toLowerCase() === address.toLowerCase());
      
      if (!alreadyExists) {
        // Add as a local-only wallet (not yet in database)
        if (!organized[walletType]) {
          organized[walletType] = [];
        }
        organized[walletType].push({
          id: -1, // Temporary ID for local wallets
          wallet_type: walletType,
          address: address,
          chain: localWallet.chain,
          verified: true,
          connected_at: new Date().toISOString(),
          last_used: new Date().toISOString()
        });
        console.log(`✅ Added local wallet to display: ${walletType} - ${address}`);
      }
    });
    
    return organized;
  };

  const connectedWallets = getConnectedWallets();

  const handleConnect = async (walletType: string) => {
    setIsConnecting(walletType);
    
    try {
      if (walletType === 'xaman') {
        setXamanQROpen(true);
      } else if (walletType === 'joey') {
        setJoeyQROpen(true);
      } else if (walletType === 'metamask') {
        await handleMetaMaskConnect();
      } else if (walletType === 'phantom') {
        await handlePhantomConnect();
      }
    } catch (error) {
      console.error(`Connection failed for ${walletType}:`, error);
      toast({
        title: 'Connection Failed',
        description: `Failed to connect ${walletType}`,
        variant: 'destructive',
      });
    } finally {
      setIsConnecting(null);
    }
  };

  const handleMetaMaskConnect = async () => {
    if (!window.ethereum?.isMetaMask) {
      toast({
        title: 'MetaMask Not Found',
        description: 'Please install MetaMask browser extension to continue',
        variant: 'destructive',
      });
      window.open('https://metamask.io/download/', '_blank');
      return;
    }

    try {
      const accounts = await (window.ethereum as any).request({ 
        method: 'eth_requestAccounts' 
      });
      
      if (accounts[0]) {
        console.log(`💾 Saving to database: metamask on evm with address ${accounts[0]}`);
        
        // Save to database first
        try {
          await apiRequest('/api/external-wallets/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              address: accounts[0],
              wallet_type: 'metamask',
              chain: 'evm'
            })
          });
          
          console.log(`✅ Connected metamask to evm: ${accounts[0]}`);
          
          toast({
            title: 'MetaMask Connected!',
            description: `Successfully connected ${accounts[0].slice(0, 8)}...${accounts[0].slice(-6)}`,
          });
        } catch (dbError) {
          console.error('❌ Failed to save to database:', dbError);
          toast({
            title: 'Connection Warning',
            description: 'MetaMask connected locally but failed to save to database',
            variant: 'destructive',
          });
        }
        
        // Also save locally
        walletChainManager.connect('metamask', 'evm', accounts[0]);
        
        // Refresh the wallet list
        queryClient.invalidateQueries({ queryKey: ['/api/external-wallets/list'] });
      }
    } catch (error: any) {
      console.error('MetaMask connection failed:', error);
      
      // Handle specific MetaMask errors
      let errorMessage = 'Failed to connect MetaMask wallet';
      if (error.code === -32002) {
        errorMessage = 'MetaMask is already processing a request. Please check MetaMask extension.';
      } else if (error.code === 4001) {
        errorMessage = 'Connection was rejected. Please approve the connection in MetaMask.';
      } else if (error.code === -32603) {
        errorMessage = 'Internal MetaMask error. Please try refreshing the page.';
      }
      
      toast({
        title: 'MetaMask Connection Failed',
        description: errorMessage,
        variant: 'destructive',
      });
      
      throw error;
    }
  };

  const handlePhantomConnect = async () => {
    if (!window.solana?.isPhantom) {
      window.open('https://phantom.app/', '_blank');
      return;
    }

    try {
      const response = await window.solana.connect();
      
      if (response.publicKey) {
        const address = response.publicKey.toString();
        console.log(`💾 Saving to database: phantom on sol with address ${address}`);
        
        // Save to database first
        try {
          await apiRequest('/api/external-wallets/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              address: address,
              wallet_type: 'phantom',
              chain: 'sol'
            })
          });
          
          console.log(`✅ Connected phantom to sol: ${address}`);
        } catch (dbError) {
          console.error('❌ Failed to save to database:', dbError);
          // Continue with local connection even if database fails
        }
        
        // Also save locally  
        walletChainManager.connect('phantom', 'sol', address);
        
        toast({
          title: 'Connected!',
          description: 'Phantom wallet connected successfully',
        });
        
        // Refresh the wallet list
        queryClient.invalidateQueries({ queryKey: ['/api/external-wallets/list'] });
      }
    } catch (error) {
      console.error('Phantom connection failed:', error);
      throw error;
    }
  };

  const handleUnlink = async (wallet: ExternalWallet) => {
    try {
      // If wallet is local-only (id: -1), just remove from walletChainManager
      if (wallet.id === -1) {
        console.log(`🗑️ Removing local-only wallet: ${wallet.wallet_type} - ${wallet.address}`);
        walletChainManager.disconnect(wallet.wallet_type, wallet.chain);
        toast({
          title: 'Success',
          description: 'External wallet unlinked successfully',
        });
        // Force re-render by invalidating the query
        queryClient.invalidateQueries({ queryKey: ['/api/external-wallets/list'] });
        return;
      }
      
      // For database wallets, remove from both database and walletChainManager
      await disconnectMutation.mutateAsync(wallet.id);
      walletChainManager.disconnect(wallet.wallet_type, wallet.chain);
    } catch (error) {
      console.error('❌ Failed to unlink wallet:', error);
    }
  };

  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-2xl bg-background text-foreground border flex flex-col max-h-[85vh]">
          <DialogHeader className="flex-shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <Wallet className="w-5 h-5" />
                </div>
                External Wallets
              </DialogTitle>
              <DialogClose asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
                  data-testid="button-close-wallet-dashboard"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </Button>
              </DialogClose>
            </div>
            <p className="text-muted-foreground">
              Connect external wallets for instant trading across multiple blockchains
            </p>
          </DialogHeader>

          <div className="space-y-6 overflow-y-auto scrollbar-thin flex-1 pr-2">
            {/* Connection Summary */}
            {externalWallets && externalWallets.length > 0 && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  <div>
                    <h3 className="font-semibold text-green-800 dark:text-green-200">
                      {externalWallets.length} Active Connection{externalWallets.length > 1 ? 's' : ''}
                    </h3>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      Your external wallets are connected and ready for trading
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {externalWallets.map((wallet: ExternalWallet) => (
                    <Badge key={wallet.id} variant="secondary" className="text-xs">
                      {wallet.wallet_type.charAt(0).toUpperCase() + wallet.wallet_type.slice(1)} - {wallet.chain.toUpperCase()}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Chain Selection Tabs */}
            <div className="border-b">
              <div className="flex space-x-1 overflow-x-auto pb-1">
                {chainFilters.map((chain) => {
                  const chainConnections = externalWallets?.filter((w: ExternalWallet) => w.chain === chain.id) || [];
                  return (
                    <button
                      key={chain.id}
                      onClick={() => setSelectedChain(chain.id)}
                      className={`flex-shrink-0 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        selectedChain === chain.id
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      }`}
                      data-testid={`chain-filter-${chain.id}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={chain.color}>{chain.name}</span>
                        {chain.id !== 'all' && (
                          <span className="ml-1 text-xs opacity-70">
                            ({walletTypes.filter(w => w.chain === chain.id).length})
                          </span>
                        )}
                        {chainConnections.length > 0 && (
                          <div className="w-2 h-2 bg-green-500 rounded-full" title={`${chainConnections.length} connected`} />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              {selectedChain !== 'all' && (
                <div className="mt-2 text-xs text-muted-foreground">
                  {chainFilters.find(c => c.id === selectedChain)?.description}
                </div>
              )}
            </div>

            {/* Wallet Cards */}
            {filteredWalletTypes.map((walletType) => {
              const connectedForType = connectedWallets[walletType.id] || [];
              const isConnectingThis = isConnecting === walletType.id;
              
              return (
                <Card key={walletType.id} className="border">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img 
                          src={walletType.icon} 
                          alt={walletType.name}
                          className="w-8 h-8"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="8"/></svg>')}`;
                          }}
                        />
                        <div>
                          <h3 className="text-lg font-semibold flex items-center gap-2">
                            {walletType.name}
                            <Badge variant="outline" className="text-xs">
                              {walletType.chainName}
                            </Badge>
                          </h3>
                          <p className="text-sm text-muted-foreground">{walletType.description}</p>
                        </div>
                      </div>
                      
                      {connectedForType.length === 0 && (
                        <Button
                          onClick={() => handleConnect(walletType.id)}
                          disabled={isConnectingThis}
                          className="gap-2"
                          data-testid={`button-link-${walletType.id}`}
                        >
                          {isConnectingThis ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Plus className="w-4 h-4" />
                          )}
                          Link Wallet
                        </Button>
                      )}
                    </CardTitle>
                  </CardHeader>
                  
                  <CardContent>
                    {connectedForType.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground">
                        <p className="text-sm">No {walletType.name} wallet linked</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {connectedForType.map((wallet) => (
                          <div 
                            key={wallet.id} 
                            className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <CheckCircle className="w-6 h-6 text-green-600" />
                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold text-green-800 dark:text-green-200">{formatAddress(wallet.address)}</p>
                                  <Badge variant="outline" className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                                    Active
                                  </Badge>
                                </div>
                                <p className="text-sm text-green-700 dark:text-green-300">
                                  Connected {new Date(wallet.connected_at).toLocaleDateString()}
                                  {wallet.verified && (
                                    <span className="ml-2 text-green-600">• Verified</span>
                                  )}
                                </p>
                              </div>
                            </div>
                            
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleUnlink(wallet)}
                              disabled={disconnectMutation.isPending}
                              className="gap-2"
                              data-testid={`button-unlink-${wallet.id}`}
                            >
                              {disconnectMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                              Unlink
                            </Button>
                          </div>
                        ))}
                        
                        <Button
                          variant="outline"
                          onClick={() => handleConnect(walletType.id)}
                          disabled={isConnectingThis}
                          className="w-full gap-2"
                          data-testid={`button-link-another-${walletType.id}`}
                        >
                          {isConnectingThis ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Plus className="w-4 h-4" />
                          )}
                          Link Another {walletType.name}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Wallet Connection Modals */}
      <XamanConnectQR 
        isOpen={xamanQROpen} 
        onClose={() => {
          setXamanQROpen(false);
          setIsConnecting(null);
        }}
        onSuccess={async (address: string) => {
          console.log(`💾 Saving to database: xaman on xrp with address ${address}`);
          
          // Save to database
          try {
            await apiRequest('/api/external-wallets/connect', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                wallet_type: 'xaman',
                address: address,
                chain: 'xrp'
              })
            });
            
            console.log(`✅ Connected xaman to xrp: ${address}`);
            
            // Also save locally
            walletChainManager.connect('xaman', 'xrp', address);
            
            // Refresh the wallet list
            queryClient.invalidateQueries({ queryKey: ['/api/external-wallets/list'] });
            
            toast({
              title: 'Connected!',
              description: 'Xaman wallet connected successfully',
            });
          } catch (dbError) {
            console.error('❌ Failed to save to database:', dbError);
            toast({
              title: 'Connection Warning',
              description: 'Wallet connected locally but failed to save to database',
              variant: 'destructive',
            });
          }
        }} 
      />
      
      <JoeyConnectQR 
        isOpen={joeyQROpen} 
        onClose={() => {
          setJoeyQROpen(false);
          setIsConnecting(null);
        }}
        onSuccess={async (address: string) => {
          console.log(`💾 Saving to database: joey on xrp with address ${address}`);
          
          // Save to database
          try {
            await apiRequest('/api/external-wallets/connect', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                wallet_type: 'joey',
                address: address,
                chain: 'xrp' 
              })
            });
            
            console.log(`✅ Connected joey to xrp: ${address}`);
            
            // Also save locally
            walletChainManager.connect('joey', 'xrp', address);
            
            // Refresh the wallet list
            queryClient.invalidateQueries({ queryKey: ['/api/external-wallets/list'] });
            
            toast({
              title: 'Connected!',
              description: 'Joey wallet connected successfully',
            });
          } catch (dbError) {
            console.error('❌ Failed to save to database:', dbError);
            toast({
              title: 'Connection Warning', 
              description: 'Wallet connected locally but failed to save to database',
              variant: 'destructive',
            });
          }
        }} 
      />
    </>
  );
};
