// ============================================================================
// EXTERNAL WALLETS - ACTIVE SESSION MANAGER
// ============================================================================
// Manages temporary wallet sessions for immediate trading
// Supports: Xaman, Joey, MetaMask, Phantom
// Features: Connect wallets, View balances, Link to permanent ownership
// ============================================================================

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

// ============================================================================
// ICONS
// ============================================================================
import { 
  Shield, Wallet, Home, ArrowLeft, Trash2, Plus, 
  Link, DollarSign 
} from "lucide-react";

// ============================================================================
// MATERIAL UI COMPONENTS
// ============================================================================
import { 
  Button, Card, CardContent, Typography, 
  Grid, Box, IconButton 
} from "@mui/material";

// ============================================================================
// CUSTOM COMPONENTS
// ============================================================================
import { XamanConnectQR } from "@/components/XamanConnectQR";
import { JoeyConnectQR } from "@/components/JoeyConnectQR";

// ============================================================================
// WALLET BALANCE COMPONENT
// ============================================================================
// Fetches and displays real-time balance for a connected wallet
const WalletBalance = ({ wallet }: { wallet: any }) => {
  const { data: balanceData, isLoading: balanceLoading } = useQuery<{ 
    success?: boolean; 
    balance?: string | number 
  }>({
    queryKey: [`/api/wallets/${wallet.chain}/balance/${wallet.address}`],
    staleTime: 30000, // Cache for 30 seconds
    enabled: !!wallet.address && !!wallet.chain
  });

  // Show loading state
  if (balanceLoading) {
    return <div className="text-xs text-gray-400">Loading...</div>;
  }

  // Show balance if available
  if (balanceData?.success && balanceData?.balance !== undefined) {
    const balance = parseFloat(String(balanceData.balance));
    const symbol = wallet.chain?.toUpperCase() || 'TOKEN';
    return (
      <div className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-1">
        <DollarSign className="w-3 h-3" />
        {balance.toFixed(4)} {symbol}
      </div>
    );
  }

  // Fallback if balance unavailable
  return <div className="text-xs text-gray-400">Balance: --</div>;
};

// ============================================================================
// MAIN EXTERNAL WALLETS PAGE
// ============================================================================
export default function ExternalWallets() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  const [xamanModalOpen, setXamanModalOpen] = useState(false);
  const [joeyModalOpen, setJoeyModalOpen] = useState(false);
  const [showWalletGrid, setShowWalletGrid] = useState(false);
  
  // ============================================================================
  // RETURN URL HANDLING
  // ============================================================================
  // Store return URL for navigation after wallet connection
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const returnUrl = params.get('returnUrl');
    
    if (returnUrl) {
      // Validate returnUrl is safe internal route
      if (isValidInternalRoute(returnUrl)) {
        sessionStorage.setItem('wallet_connect_return_url', returnUrl);
      } else {
        sessionStorage.removeItem('wallet_connect_return_url');
      }
    } else {
      // Clear stale returnUrl
      sessionStorage.removeItem('wallet_connect_return_url');
    }
  }, []);
  
  // ============================================================================
  // SECURITY: VALIDATE RETURN URL
  // ============================================================================
  // Prevents open redirect vulnerabilities
  const isValidInternalRoute = (url: string): boolean => {
    // Must start with / and not contain scheme or host
    if (!url.startsWith('/')) return false;
    if (url.includes('://')) return false;
    if (url.includes('//')) return false;
    
    // Whitelist of allowed routes
    const allowedRoutes = [
      '/', '/home', '/swap', '/bridge', '/xrpl-swap', '/solana-swap',
      '/wallet-dashboard', '/multi-chain-dashboard', '/nft-marketplace',
      '/portfolio', '/send', '/receive'
    ];
    
    // Check if URL starts with any allowed route
    return allowedRoutes.some(route => 
      url === route || url.startsWith(route + '/') || url.startsWith(route + '?')
    );
  };

  // ============================================================================
  // LOAD LINKED WALLETS (ACTIVE SESSIONS)
  // ============================================================================
  const { data: externalWalletsResponse, isLoading } = useQuery<{ wallets: any[] }>({
    queryKey: ['/api/external-wallets/list'],
    staleTime: 30000 // Cache for 30 seconds
  });
  
  const linkedWallets = externalWalletsResponse?.wallets || [];

  // ============================================================================
  // CHALLENGE MUTATION (STEP 1 OF WALLET VERIFICATION)
  // ============================================================================
  // Generates a challenge message for wallet signature verification
  const challengeMutation = useMutation({
    mutationFn: async (walletData: { 
      address: string; 
      walletType: string; 
      chain: string 
    }) => {
      const response = await apiRequest('/api/external-wallets/challenge', {
        method: 'POST',
        body: JSON.stringify({
          walletType: walletData.walletType,
          address: walletData.address,
          chain: walletData.chain
        })
      });
      return await response.json() as any;
    }
  });

  // ============================================================================
  // VERIFY MUTATION (STEP 2 OF WALLET VERIFICATION)
  // ============================================================================
  // Verifies wallet signature and saves to database
  const verifyWalletMutation = useMutation({
    mutationFn: async (data: {
      address: string;
      chain: string;
      walletType: string;
      signature: string;
      message: string;
    }) => {
      return await apiRequest('/api/external-wallets/verify', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      // Refresh wallet list
      queryClient.invalidateQueries({ queryKey: ['/api/external-wallets/list'] });
      toast({
        title: "Wallet Verified!",
        description: "Your wallet has been securely linked and verified."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Verification Failed",
        description: error.message || "Failed to verify wallet signature",
        variant: "destructive"
      });
    }
  });

  // ============================================================================
  // REMOVE WALLET MUTATION
  // ============================================================================
  // Ends an active wallet session
  const removeWalletMutation = useMutation({
    mutationFn: async (walletId: number) => {
      return apiRequest(`/api/external-wallets/${walletId}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      // Refresh wallet list
      queryClient.invalidateQueries({ queryKey: ['/api/external-wallets/list'] });
      toast({
        title: "Session Ended",
        description: "Active wallet session has been removed"
      });
    }
  });

  // ============================================================================
  // LINK FROM SESSION MUTATION
  // ============================================================================
  // Converts temporary session to permanent ownership
  const linkFromSessionMutation = useMutation({
    mutationFn: async (payload: { 
      address: string; 
      chain: string; 
      walletType: string 
    }) => {
      return apiRequest('/api/linked-wallets/save-from-session', {
        method: 'POST',
        body: JSON.stringify({
          address: payload.address,
          chain: payload.chain,
          walletType: payload.walletType,
          walletLabel: `${payload.walletType} Wallet`
        })
      });
    },
    onSuccess: () => {
      toast({
        title: "Wallet Linked!",
        description: "Active session wallet has been permanently linked to your account"
      });
    },
    onError: (error: any) => {
      if (error.error?.includes('already linked')) {
        toast({
          title: "Already Linked",
          description: "This wallet is already linked to your account",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Link Failed",
          description: error.error || "Failed to link wallet from session",
          variant: "destructive"
        });
      }
    }
  });

  // ============================================================================
  // METAMASK CONNECTION HANDLER
  // ============================================================================
  const connectMetaMask = async () => {
    try {
      if (typeof window.ethereum !== 'undefined') {
        // Request account access
        const accounts = await (window.ethereum as any).request({ 
          method: 'eth_requestAccounts' 
        });
        
        if (accounts.length > 0) {
          const address = accounts[0];
          
          // Step 1: Generate challenge
          const challengeData = await challengeMutation.mutateAsync({
            walletType: 'metamask',
            address: address,
            chain: 'eth'
          });
          
          // Step 2: Sign verification message
          const signature = await (window.ethereum as any).request({
            method: 'personal_sign',
            params: [challengeData.message, address]
          });
          
          // Step 3: Verify signature and save wallet
          await verifyWalletMutation.mutateAsync({
            address: address,
            chain: 'eth',
            walletType: 'metamask',
            signature,
            message: challengeData.message
          });
          
          // Keep localStorage for compatibility
          localStorage.setItem('eth_wallet_address', address);
          localStorage.setItem('eth_wallet_type', 'metamask');
        }
      } else {
        // MetaMask not installed
        toast({
          title: "MetaMask Not Found",
          description: "Please install MetaMask browser extension",
          variant: "destructive"
        });
        window.open('https://metamask.io/download/', '_blank');
      }
    } catch (error) {
      console.error('MetaMask connection error:', error);
      toast({
        title: "Connection Failed",
        description: "Failed to connect MetaMask wallet",
        variant: "destructive"
      });
    }
  };

  // ============================================================================
  // PHANTOM CONNECTION HANDLER
  // ============================================================================
  const connectPhantom = async () => {
    try {
      if (typeof window.solana !== 'undefined' && window.solana.isPhantom) {
        // Connect to Phantom
        const response = await window.solana.connect();
        
        if (response.publicKey) {
          const address = response.publicKey.toString();
          
          // Step 1: Generate challenge
          const challengeData = await challengeMutation.mutateAsync({
            walletType: 'phantom',
            address: address,
            chain: 'sol'
          });
          
          // Step 2: Sign verification message
          const encodedMessage = new TextEncoder().encode(challengeData.message);
          const signedMessage = await (window.solana as any).signMessage(encodedMessage, 'utf8');
          
          // Convert to base58 format
          const bs58 = await import('bs58');
          const signature = bs58.default.encode(signedMessage.signature);
          
          // Step 3: Verify signature and save wallet
          await verifyWalletMutation.mutateAsync({
            address: address,
            chain: 'sol',
            walletType: 'phantom',
            signature,
            message: challengeData.message
          });
          
          // Keep localStorage for compatibility
          localStorage.setItem('sol_wallet_address', address);
          localStorage.setItem('sol_wallet_type', 'phantom');
        }
      } else {
        // Phantom not installed
        toast({
          title: "Phantom Not Found",
          description: "Please install Phantom browser extension",
          variant: "destructive"
        });
        window.open('https://phantom.app/', '_blank');
      }
    } catch (error) {
      console.error('Phantom connection error:', error);
      toast({
        title: "Connection Failed",
        description: "Failed to connect Phantom wallet",
        variant: "destructive"
      });
    }
  };

  // ============================================================================
  // EXTERNAL WALLET SUCCESS HANDLER (XAMAN/JOEY)
  // ============================================================================
  // Handles successful connection from QR-based wallets
  const handleExternalWalletSuccess = async (address: string, walletType: string) => {
    try {
      // Link wallet from session
      await linkFromSessionMutation.mutateAsync({
        address,
        walletType: walletType.toLowerCase(),
        chain: 'xrpl'
      });
      
      // Check for return URL and redirect
      const returnUrl = sessionStorage.getItem('wallet_connect_return_url');
      if (returnUrl) {
        console.log('✅ Returning to original page:', returnUrl);
        sessionStorage.removeItem('wallet_connect_return_url');
        setTimeout(() => {
          setLocation(returnUrl);
        }, 1500); // Delay to show success message
      }
    } catch (error) {
      console.error('Wallet save error:', error);
      toast({
        title: "Save Failed",
        description: "Wallet connected but failed to save",
        variant: "destructive"
      });
    }
  };

  // ============================================================================
  // HELPER: GET WALLET LOGO
  // ============================================================================
  const getWalletLogo = (walletType: string) => {
    const logos: Record<string, string> = {
      xaman: '/images/wallets/xaman-logo.png',
      joey: '/images/wallets/joey-logo.png', 
      metamask: '/images/wallets/metamask-logo.png',
      phantom: '/images/wallets/phantom-logo.png'
    };
    return logos[walletType.toLowerCase()] || '/images/wallets/xaman-logo.png';
  };

  // ============================================================================
  // HELPER: GET WALLET COLORS
  // ============================================================================
  const getWalletColors = (walletType: string) => {
    const colors: Record<string, { bg: string; border: string; text: string }> = {
      xaman: { 
        bg: 'bg-blue-50 dark:bg-blue-900/20', 
        border: 'border-blue-200 dark:border-blue-700', 
        text: 'text-blue-600 dark:text-blue-400' 
      },
      joey: { 
        bg: 'bg-orange-50 dark:bg-orange-900/20', 
        border: 'border-orange-200 dark:border-orange-700', 
        text: 'text-orange-600 dark:text-orange-400' 
      },
      metamask: { 
        bg: 'bg-purple-50 dark:bg-purple-900/20', 
        border: 'border-purple-200 dark:border-purple-700', 
        text: 'text-purple-600 dark:text-purple-400' 
      },
      phantom: { 
        bg: 'bg-indigo-50 dark:bg-indigo-900/20', 
        border: 'border-indigo-200 dark:border-indigo-700', 
        text: 'text-indigo-600 dark:text-indigo-400' 
      }
    };
    return colors[walletType.toLowerCase()] || colors.xaman;
  };

  // ============================================================================
  // RENDER
  // ============================================================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 sm:p-8">
          
          {/* ================================================================ */}
          {/* HEADER NAVIGATION */}
          {/* ================================================================ */}
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <Button
              variant="outlined"
              size="small"
              onClick={() => setLocation('/wallet-login')}
              className="h-7 sm:h-8 text-xs px-2 sm:px-3"
            >
              <ArrowLeft className="w-3 h-3 mr-1" />
              <span className="hidden sm:inline">Back</span>
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setLocation('/')}
              className="h-7 sm:h-8 text-xs px-2 sm:px-3"
            >
              <Home className="w-3 h-3 mr-1" />
              <span className="hidden sm:inline">Home</span>
            </Button>
          </div>

          {/* ================================================================ */}
          {/* PAGE TITLE */}
          {/* ================================================================ */}
          <div className="text-center mb-4 sm:mb-8">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Active Wallet Sessions
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 px-2">
              Connect external wallets for immediate trading • <button 
                onClick={() => setLocation('/linked-wallets')} 
                className="text-blue-500 hover:text-blue-600 underline"
                data-testid="link-manage-ownership"
              >
                Manage Permanent Ownership →
              </button>
            </p>
          </div>

          {/* ================================================================ */}
          {/* ACTIVE SESSIONS LIST */}
          {/* ================================================================ */}
          {!isLoading && linkedWallets.length > 0 && (
            <div className="mb-4 sm:mb-6">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h3 className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                  Active Sessions ({linkedWallets.length})
                </h3>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setLocation('/linked-wallets')}
                    className="text-xs h-7 px-2 text-blue-600 border-blue-200 hover:bg-blue-50"
                    data-testid="button-view-linked-wallets"
                  >
                    <Link className="w-3 h-3 mr-1" />
                    <span className="hidden sm:inline">Ownership</span>
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setShowWalletGrid(!showWalletGrid)}
                    className="text-xs h-7 px-2"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    <span className="hidden sm:inline">{showWalletGrid ? 'Hide' : 'Add New'}</span>
                    <span className="sm:hidden">+</span>
                  </Button>
                </div>
              </div>
              
              {/* Wallet Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 max-h-48 sm:max-h-64 overflow-y-auto">
                {linkedWallets.map((wallet: any) => {
                  const colors = getWalletColors(wallet.wallet_type || 'xaman');
                  return (
                    <div 
                      key={wallet.id} 
                      className={`relative p-3 ${colors.bg} border-2 ${colors.border} rounded-lg transition-all hover:shadow-md group`}
                    >
                      {/* Remove Session Button */}
                      <Button
                        variant="text"
                        size="small"
                        onClick={() => removeWalletMutation.mutate(wallet.id)}
                        className="absolute top-1 right-1 h-5 w-5 p-0 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        data-testid={`button-end-session-${wallet.id}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                      
                      {/* Wallet Info */}
                      <div className="flex items-center space-x-3">
                        <img 
                          src={getWalletLogo(wallet.wallet_type || 'xaman')} 
                          alt={wallet.wallet_type} 
                          className="w-8 h-8 object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            const parent = (e.target as HTMLElement).parentElement;
                            if (parent) {
                              const fallback = document.createElement('div');
                              fallback.className = 'w-8 h-8 rounded bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center';
                              fallback.innerHTML = `<span class="text-xs text-white font-bold">${(wallet.wallet_type?.charAt(0) || 'W').toUpperCase()}</span>`;
                              parent.insertBefore(fallback, e.target as HTMLElement);
                            }
                          }}
                        />
                        <div className="flex-1">
                          <div className={`text-sm font-medium ${colors.text} capitalize`}>
                            {wallet.wallet_type}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                            {wallet.chain}
                          </div>
                          <div className="text-xs text-gray-400 dark:text-gray-500 mt-1 font-mono">
                            {wallet.address?.slice(0, 8)}...{wallet.address?.slice(-6)}
                          </div>
                          <WalletBalance wallet={wallet} />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => linkFromSessionMutation.mutate({
                              address: wallet.address,
                              chain: wallet.chain,
                              walletType: wallet.wallet_type
                            })}
                            disabled={linkFromSessionMutation.isPending}
                            className="text-xs h-6 px-2 bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100"
                            data-testid={`button-link-wallet-${wallet.id}`}
                          >
                            <Link className="w-3 h-3 mr-1" />
                            <span className="hidden sm:inline">
                              {linkFromSessionMutation.isPending ? 'Linking...' : 'Link'}
                            </span>
                            <span className="sm:hidden">Link</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* EMPTY STATE */}
          {/* ================================================================ */}
          {!isLoading && linkedWallets.length === 0 && (
            <div className="text-center mb-4 sm:mb-6 p-4 sm:p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-gray-500 dark:text-gray-400 mb-4">
                <Wallet className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 opacity-50" />
                <h3 className="text-sm font-medium mb-1">No Active Wallet Sessions</h3>
                <p className="text-xs px-2">Connect external wallets like Xaman, Joey, MetaMask, or Phantom for immediate trading</p>
              </div>
              <div className="space-y-2">
                <Button
                  onClick={() => setShowWalletGrid(true)}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-xs sm:text-sm h-8 sm:h-10"
                  data-testid="button-connect-first-wallet"
                >
                  <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                  Connect First Wallet
                </Button>
                <div className="text-xs text-gray-400">
                  <button 
                    onClick={() => setLocation('/linked-wallets')} 
                    className="text-blue-500 hover:text-blue-600 underline"
                  >
                    Or manage permanent wallet ownership →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* BENEFITS NOTICE */}
          {/* ================================================================ */}
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
            <div className="flex items-center justify-center space-x-2 text-blue-600 dark:text-blue-400 text-xs sm:text-sm">
              <Shield className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
              <span className="text-center">Live sessions • Use "Link" to save for permanent ownership</span>
            </div>
          </div>

          {/* ================================================================ */}
          {/* WALLET CONNECTION GRID */}
          {/* ================================================================ */}
          {(showWalletGrid || linkedWallets.length === 0) && (
            <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-4 sm:mb-6">
              
              {/* Xaman XRPL */}
              <button 
                onClick={() => setXamanModalOpen(true)}
                className="h-16 sm:h-20 flex flex-col items-center justify-center space-y-1 sm:space-y-2 border-2 border-blue-200 dark:border-blue-700 rounded-xl bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-all hover:border-blue-300 dark:hover:border-blue-600 cursor-pointer group"
                data-testid="button-connect-xaman"
              >
                <img 
                  src="/images/wallets/xaman-logo.png" 
                  alt="Xaman" 
                  className="w-6 h-6 sm:w-8 sm:h-8 group-hover:scale-110 transition-transform object-contain" 
                />
                <span className="text-xs sm:text-sm font-medium text-blue-600 dark:text-blue-400">Xaman</span>
                <span className="text-xs text-blue-500 dark:text-blue-500">XRPL</span>
              </button>

              {/* Joey XRPL */}
              <button 
                onClick={() => setJoeyModalOpen(true)}
                className="h-16 sm:h-20 flex flex-col items-center justify-center space-y-1 sm:space-y-2 border-2 border-orange-200 dark:border-orange-700 rounded-xl bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/40 transition-all hover:border-orange-300 dark:hover:border-orange-600 cursor-pointer group"
                data-testid="button-connect-joey"
              >
                <img 
                  src="/images/wallets/joey-logo.png" 
                  alt="Joey" 
                  className="w-6 h-6 sm:w-8 sm:h-8 group-hover:scale-110 transition-transform object-contain" 
                />
                <span className="text-xs sm:text-sm font-medium text-orange-600 dark:text-orange-400">Joey</span>
                <span className="text-xs text-orange-500 dark:text-orange-500">XRPL</span>
              </button>

              {/* MetaMask */}
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  connectMetaMask();
                }}
                className="h-16 sm:h-20 flex flex-col items-center justify-center space-y-1 sm:space-y-2 border-2 border-purple-200 dark:border-purple-700 rounded-xl bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-all hover:border-purple-300 dark:hover:border-purple-600 cursor-pointer group"
                data-testid="button-connect-metamask"
                type="button"
              >
                <img 
                  src="/images/wallets/metamask-logo.png" 
                  alt="MetaMask" 
                  className="w-6 h-6 sm:w-8 sm:h-8 group-hover:scale-110 transition-transform object-contain" 
                />
                <span className="text-xs sm:text-sm font-medium text-purple-600 dark:text-purple-400">MetaMask</span>
                <span className="text-xs text-purple-500 dark:text-purple-500">EVM</span>
              </button>

              {/* Phantom */}
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  connectPhantom();
                }}
                className="h-16 sm:h-20 flex flex-col items-center justify-center space-y-1 sm:space-y-2 border-2 border-indigo-200 dark:border-indigo-700 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all hover:border-indigo-300 dark:hover:border-indigo-600 cursor-pointer group"
                data-testid="button-connect-phantom"
                type="button"
              >
                <img 
                  src="/images/wallets/phantom-logo.png" 
                  alt="Phantom" 
                  className="w-6 h-6 sm:w-8 sm:h-8 group-hover:scale-110 transition-transform object-contain" 
                />
                <span className="text-xs sm:text-sm font-medium text-indigo-600 dark:text-indigo-400">Phantom</span>
                <span className="text-xs text-indigo-500 dark:text-indigo-500">Solana</span>
              </button>
            </div>
          )}

          {/* ================================================================ */}
          {/* HELP TEXT */}
          {/* ================================================================ */}
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 px-2">
              Connect any external wallet for immediate trading access
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mb-4 px-2">
              💡 Tip: Use "Link" button to save wallets for permanent ownership verification
            </p>
            <div className="text-xs text-gray-400 dark:text-gray-500 px-2">
              Need a Riddle Wallet? <button 
                onClick={() => setLocation('/wallet-login')} 
                className="text-blue-500 hover:text-blue-600 underline"
              >
                Sign in here
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* ================================================================ */}
      {/* WALLET CONNECTION MODALS */}
      {/* ================================================================ */}
      <XamanConnectQR 
        isOpen={xamanModalOpen}
        onClose={() => setXamanModalOpen(false)}
        onSuccess={(address) => handleExternalWalletSuccess(address, 'Xaman')}
      />
      
      <JoeyConnectQR 
        isOpen={joeyModalOpen}
        onClose={() => setJoeyModalOpen(false)}
        onSuccess={(address) => handleExternalWalletSuccess(address, 'Joey')}
      />
    </div>
  );
}
