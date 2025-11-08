import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { walletChainManager, WalletChainConnection } from '@/lib/wallet-chain-manager';
import { CheckCircle, AlertCircle, Zap } from 'lucide-react';

interface SimpleWalletIconsProps {
  onWalletConnected?: (wallet: string, chain: string, address: string) => void;
}

export function SimpleWalletIcons({ onWalletConnected }: SimpleWalletIconsProps) {
  const [connections, setConnections] = useState<WalletChainConnection[]>([]);
  const [isConnecting, setIsConnecting] = useState<string>('');
  const { toast } = useToast();

  const walletConfigs = [
    // Multi-chain wallets  
    {
      id: 'metamask',
      name: 'MetaMask',
      icon: '/images/wallets/metamask-logo.png', // Available
      fallback: '🦊',
      chains: ['ETH', 'BSC', 'POLYGON', 'ARBITRUM', 'BASE', 'OPTIMISM'],
      color: 'from-orange-500 to-orange-600',
      checkAvailability: () => !!(window as any).ethereum?.isMetaMask,
    },
    {
      id: 'walletconnect',
      name: 'WalletConnect',
      icon: '', // Use fallback - logo not available
      fallback: '🔗',
      chains: ['ETH', 'BSC', 'POLYGON', 'ARBITRUM', 'BASE', 'OPTIMISM'],
      color: 'from-blue-500 to-blue-600',
      checkAvailability: () => true, // Always available via QR
    },
    {
      id: 'coinbase',
      name: 'Coinbase',
      icon: '', // Use fallback - logo not available
      fallback: '💙',
      chains: ['ETH', 'BSC', 'POLYGON', 'ARBITRUM', 'BASE'],
      color: 'from-blue-600 to-blue-700',
      checkAvailability: () => !!(window as any).ethereum?.isCoinbaseWallet,
    },
    {
      id: 'gem',
      name: 'Gem',
      icon: '', // Use fallback - logo not available
      fallback: '💎',
      chains: ['ETH', 'BSC', 'POLYGON', 'SOLANA'],
      color: 'from-purple-500 to-purple-600',
      checkAvailability: () => !!(window as any).ethereum?.isGem,
    },
    // Solana specific
    {
      id: 'phantom',
      name: 'Phantom',
      icon: '/images/wallets/phantom-logo.png', // Available
      fallback: '👻',
      chains: ['SOLANA'],
      color: 'from-purple-600 to-purple-700',
      checkAvailability: () => !!(window as any).phantom?.solana,
    },
    {
      id: 'solflare',
      name: 'Solflare',
      icon: '', // Use fallback - logo not available
      fallback: '🔥',
      chains: ['SOLANA'],
      color: 'from-orange-500 to-red-500',
      checkAvailability: () => !!(window as any).solflare,
    },
    // XRPL specific
    {
      id: 'xaman',
      name: 'Xaman',
      icon: '/images/wallets/xaman-logo.png', // Available
      fallback: '✨',
      chains: ['XRP'],
      color: 'from-blue-500 to-cyan-500',
      checkAvailability: () => true, // Always available via QR
    },
    {
      id: 'joey',
      name: 'Joey',
      icon: '/images/wallets/joey-logo.png', // Available
      fallback: '🦘',
      chains: ['XRP'],
      color: 'from-green-500 to-green-600',
      checkAvailability: () => true, // Always available via QR
    },
  ];

  // Load connections on component mount
  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = () => {
    const allConnections = walletChainManager.getAllConnections();
    setConnections(allConnections);
  };

  const handleWalletClick = async (wallet: any, chain: string) => {
    const walletChainKey = `${wallet.id}-${chain}`;
    
    // Check if already connected
    if (walletChainManager.isConnected(wallet.id, chain)) {
      toast({
        title: "Already Connected ⚡",
        description: `${wallet.name} is already connected to ${chain}`,
      });
      return;
    }

    setIsConnecting(walletChainKey);

    try {
      const result = await connectWalletToChain(wallet.id, chain);
      
      if (result.success) {
        walletChainManager.connect(wallet.id, chain, result.address!);
        loadConnections();
        
        toast({
          title: "Connected! 🎉",
          description: `${wallet.name} connected to ${chain}`,
        });

        if (onWalletConnected) {
          onWalletConnected(wallet.id, chain, result.address!);
        }
      } else {
        throw new Error(result.error || 'Connection failed');
      }
    } catch (error: any) {
      toast({
        title: "Connection Failed ❌",
        description: error.message || "Failed to connect wallet",
        variant: "destructive"
      });
    } finally {
      setIsConnecting('');
    }
  };

  const connectWalletToChain = async (walletId: string, chain: string): Promise<{
    success: boolean;
    address?: string;
    error?: string;
  }> => {
    switch (walletId) {
      case 'metamask':
        return await connectMetaMask();
      case 'walletconnect':
        return await connectWalletConnect();
      case 'coinbase':
        return await connectCoinbaseWallet();
      case 'gem':
        return await connectGemWallet();
      case 'phantom':
        return await connectPhantom();
      case 'solflare':
        return await connectSolflare();
      case 'xaman':
        return await connectXaman();
      case 'joey':
        return await connectJoeyWallet();
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

  const connectWalletConnect = async () => {
    try {
      // Show QR modal for WalletConnect
      toast({
        title: "WalletConnect QR 📱",
        description: "Scan QR code with your mobile wallet",
      });
      return { success: false, error: 'WalletConnect QR implementation pending' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const connectCoinbaseWallet = async () => {
    try {
      const ethereum = (window as any).ethereum;
      if (!ethereum?.isCoinbaseWallet) {
        throw new Error('Coinbase Wallet not found');
      }
      
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      return { success: true, address: accounts[0] };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const connectGemWallet = async () => {
    try {
      const ethereum = (window as any).ethereum;
      if (!ethereum?.isGem) {
        throw new Error('Gem Wallet not found');
      }
      
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      return { success: true, address: accounts[0] };
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

  const connectXaman = async () => {
    // Use existing Xaman connection logic
    try {
      const response = await fetch('/api/xumm/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json() as any;
      
      if (data.uuid && data.refs?.qr_png) {
        // For mobile, open Xaman app directly
        if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
          window.location.href = `xumm://xumm.app/sign/${data.uuid}`;
        } else {
          window.open(`https://xumm.app/sign/${data.uuid}`, '_blank');
        }
        
        // For now, return pending - implement proper status checking later
        return { success: false, error: 'Please complete connection in Xaman app' };
      }
      
      return { success: false, error: 'Failed to create Xaman connection' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const connectJoeyWallet = async () => {
    try {
      // Joey Wallet connection for XRPL
      toast({
        title: "Joey Wallet 🦘",
        description: "Joey wallet connection implementation pending",
      });
      return { success: false, error: 'Joey Wallet connection implementation pending' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const disconnectWallet = (wallet: string, chain: string) => {
    walletChainManager.disconnect(wallet, chain);
    loadConnections();
    toast({
      title: "Disconnected",
      description: `${wallet} disconnected from ${chain}`,
    });
  };

  return (
    <TooltipProvider>
      <div className="simple-wallet-icons">
        <div className="wallet-rows-layout space-y-4 p-4">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
              <Zap className="w-5 h-5 mr-2 text-yellow-500" />
              External Wallet Connections
            </h3>
            <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
              {connections.length} active
            </Badge>
          </div>
          
          {/* Wallet rows */}
          <div className="space-y-3">
            {walletConfigs.map((wallet) => {
              const isAvailable = wallet.checkAvailability();
              const walletConnections = wallet.chains.filter(chain => 
                walletChainManager.isConnected(wallet.id, chain)
              );

              return (
                <div key={wallet.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  {/* Wallet header */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 flex items-center justify-center">
                          {wallet.icon ? (
                            <img 
                              src={wallet.icon} 
                              alt={wallet.name}
                              className="w-6 h-6 object-contain"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const fallback = target.nextElementSibling as HTMLElement;
                                if (fallback) fallback.style.display = 'block';
                              }}
                            />
                          ) : null}
                          <span 
                            className={`text-lg font-bold text-gray-600 dark:text-gray-400 ${wallet.icon ? 'hidden' : 'block'}`}
                            style={{ display: wallet.icon ? 'none' : 'block' }}
                          >
                            {wallet.fallback}
                          </span>
                        </div>
                        {/* Availability indicator */}
                        <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border border-white dark:border-gray-700 ${
                          isAvailable ? 'bg-green-500' : 'bg-gray-400'
                        }`} />
                      </div>
                      
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white">{wallet.name}</h4>
                        <div className="flex items-center gap-2">
                          {isAvailable ? (
                            <CheckCircle className="w-3 h-3 text-green-500" />
                          ) : (
                            <AlertCircle className="w-3 h-3 text-orange-500" />
                          )}
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {isAvailable ? 'Available' : 'Not Installed'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {walletConnections.length > 0 && (
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                        {walletConnections.length} connected
                      </Badge>
                    )}
                  </div>
                  
                  {/* Chain connections */}
                  <div className="p-4 space-y-2">
                    {wallet.chains.map((chain, index) => {
                      const isConnected = walletChainManager.isConnected(wallet.id, chain);
                      const isConnectingThis = isConnecting === `${wallet.id}-${chain}`;
                      const address = walletChainManager.getAddress(wallet.id, chain);

                      return (
                        <div 
                          key={chain} 
                          data-testid={`wallet-chain-row-${wallet.id}-${chain}`}
                          className={`flex items-center justify-between p-3 rounded-lg border ${
                            isConnected 
                              ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700' 
                              : 'bg-gray-50 border-gray-200 dark:bg-gray-700/50 dark:border-gray-600'
                          } ${index < wallet.chains.length - 1 ? 'mb-2' : ''}`}
                        >
                          {/* Left: Chain info */}
                          <div className="flex items-center gap-3 flex-1">
                            <div className="w-8 h-8 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 flex items-center justify-center">
                              <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                                {chain.slice(0, 2).toUpperCase()}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 dark:text-white">
                                {chain.toUpperCase()}
                              </div>
                              {isConnected && address ? (
                                <div className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                                  {address.slice(0, 6)}...{address.slice(-4)}
                                </div>
                              ) : (
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                  Not connected
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Right: Status and action */}
                          <div className="flex items-center gap-2">
                            {isConnected ? (
                              <>
                                <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Connected
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs px-3 h-7"
                                  onClick={() => disconnectWallet(wallet.id, chain)}
                                  data-testid={`disconnect-${wallet.id}-${chain}`}
                                >
                                  Disconnect
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs px-3 h-7"
                                onClick={() => handleWalletClick(wallet, chain)}
                                disabled={isConnectingThis || !isAvailable}
                                data-testid={`connect-${wallet.id}-${chain}`}
                              >
                                {isConnectingThis ? (
                                  <>
                                    <div className="animate-spin rounded-full h-3 w-3 border-b border-current mr-1"></div>
                                    Connecting...
                                  </>
                                ) : !isAvailable ? (
                                  'Install Wallet'
                                ) : (
                                  'Connect'
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Connection Summary */}
          {connections.length > 0 && (
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg p-4 mt-6">
              <h4 className="font-bold text-white mb-3 flex items-center">
                <CheckCircle className="w-5 h-5 mr-2" />
                Active Connections Summary
              </h4>
              <div className="space-y-2">
                {connections.map((conn, index) => (
                  <div 
                    key={index} 
                    className="flex items-center justify-between bg-white/20 rounded-lg p-3 backdrop-blur-sm"
                    data-testid={`connection-summary-${conn.wallet}-${conn.chain}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-white/30 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-bold">
                          {conn.chain.slice(0, 1).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="text-white font-semibold text-sm">{conn.wallet}</div>
                        <div className="text-white/80 text-xs">{conn.chain.toUpperCase()}</div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-200 hover:text-red-100 hover:bg-red-500/20 text-xs px-2 h-7"
                      onClick={() => disconnectWallet(conn.wallet, conn.chain)}
                      data-testid={`quick-disconnect-${conn.wallet}-${conn.chain}`}
                    >
                      Disconnect
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Empty state */}
          {connections.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Zap className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <h4 className="font-medium mb-2">No External Wallets Connected</h4>
              <p className="text-sm">Connect your favorite wallets to get started</p>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
