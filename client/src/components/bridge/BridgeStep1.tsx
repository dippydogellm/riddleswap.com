// Bridge Step 1 Component - Initial transaction setup
import React, { useEffect, useState } from 'react';
import { SUPPORTED_TOKENS, ALLOWED_BRIDGE_PATHS } from './constants';
// DISABLED: AppKit import - using only Riddle wallet + external wallets
// import { appKit } from '@/lib/appkit-config';
import { getAllWallets } from '@/lib/wallets';
import { trustlineManager } from '@/lib/xrpl-trustline-manager';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { XamanQRModal } from '@/components/xaman/XamanQRModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wallet, ExternalLink, Settings, User, ChevronDown } from 'lucide-react';

interface BridgeStep1Props {
  fromToken: string;
  toToken: string;
  amount: string;
  fromAddress: string;
  toAddress: string;
  isProcessing: boolean;
  onFromTokenChange: (token: string) => void;
  onToTokenChange: (token: string) => void;
  onAmountChange: (amount: string) => void;
  onFromAddressChange: (address: string) => void;
  onToAddressChange: (address: string) => void;
  onSubmit: () => void;
}

interface BridgeQuote {
  exchangeRate: string;
  platformFee: string;
  estimatedOutput: string;
  totalCost: string;
  fromTokenPrice: string;
  toTokenPrice: string;
}

interface ConnectedWallets {
  riddle: boolean;
  xaman: boolean;
  walletconnect: boolean;
  phantom: boolean;
}

interface WalletAddresses {
  xrp?: string;
  eth?: string;
  sol?: string;
  btc?: string;
  // Legacy property names for compatibility
  ethereum?: string;
  solana?: string;
  bitcoin?: string;
}

export function BridgeStep1({
  fromToken,
  toToken,
  amount,
  fromAddress,
  toAddress,
  isProcessing,
  onFromTokenChange,
  onToTokenChange,
  onAmountChange,
  onFromAddressChange,
  onToAddressChange,
  onSubmit
}: BridgeStep1Props) {
  const { toast } = useToast();
  
  // 🔧 Unified token-to-chain mapping helper for consistency
  const getTokenChain = (token: string): string => {
    // XRP chain tokens
    if (token === 'XRP' || token === 'RDL') return 'xrp';
    
    // EVM chain tokens (Ethereum, BNB Chain, Polygon, Base, etc.)
    if (token === 'ETH' || token === 'USDT' || token === 'USDC' || 
        token === 'BNB' || token === 'MATIC' || token === 'BASE') return 'eth';
    
    // Solana chain tokens
    if (token === 'SOL' || token === 'SRDL') return 'sol';
    
    // Bitcoin chain tokens
    if (token === 'BTC') return 'btc';
    
    // Default fallback (shouldn't happen)
    return '';
  };
  const [connectedWallets, setConnectedWallets] = useState<ConnectedWallets>({
    riddle: false,
    xaman: false,
    walletconnect: false,
    phantom: false
  });
  const [walletAddresses, setWalletAddresses] = useState<WalletAddresses>({});
  const [isLoadingWallet, setIsLoadingWallet] = useState(true);
  const [bridgeQuote, setBridgeQuote] = useState<BridgeQuote | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [trustlineStatus, setTrustlineStatus] = useState<{
    token: string;
    issuer: string;
    hasTrustline: boolean;
    isChecking: boolean;
    error?: string;
  } | null>(null);
  
  // Wallet connection states
  const [showXamanModal, setShowXamanModal] = useState(false);
  const [showManageWalletsModal, setShowManageWalletsModal] = useState(false);
  const [xamanModalData, setXamanModalData] = useState<any>(null);
  const [isConnecting, setIsConnecting] = useState<{[key: string]: boolean}>({});
  
  // Query for external/linked wallets
  const { data: externalWalletsResponse } = useQuery<{ wallets: any[] }>({
    queryKey: ['/api/external-wallets/list'],
    staleTime: 30000
  });
  
  const linkedWallets = externalWalletsResponse?.wallets || [];
  
  // Wallet selection for each chain (when multiple wallets available)
  const [selectedWallets, setSelectedWallets] = useState<{[chain: string]: string}>(() => {
    // Try to restore from localStorage
    try {
      const stored = localStorage.getItem('bridge_selected_wallets');
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          xrp: parsed.xrp || 'riddle',
          eth: parsed.eth || 'riddle',
          sol: parsed.sol || 'riddle', 
          btc: parsed.btc || 'riddle'
        };
      }
    } catch (error) {
      console.log('Failed to restore wallet selections:', error);
    }
    
    // Default selections
    return {
      xrp: 'riddle', // Default to riddle for XRP
      eth: 'riddle', // Default to riddle for ETH  
      sol: 'riddle', // Default to riddle for SOL
      btc: 'riddle'  // Default to riddle for BTC
    };
  });

  // Auto-load wallet info from session - run once on mount and when tokens change
  useEffect(() => {
    const loadAllWalletInfo = async () => {
      console.log('🔧 [BRIDGE] Loading all wallet connections...');
      
      const walletStates: ConnectedWallets = {
        riddle: false,
        xaman: false,
        walletconnect: false,
        phantom: false
      };
      
      const allAddresses: WalletAddresses = {};

      try {
        // 1. Check Riddle Wallet session
        console.log('🔐 [BRIDGE] Checking Riddle wallet session...');
        let sessionToken = localStorage.getItem('sessionToken');
        
        // Check backup wallet data
        const backupWalletData = localStorage.getItem('riddle_wallet_data');
        if (backupWalletData) {
          try {
            const walletInfo = JSON.parse(backupWalletData);
            if (walletInfo.timestamp && Date.now() - walletInfo.timestamp < 86400000) {
              if (walletInfo.walletAddresses) {
                allAddresses.xrp = walletInfo.walletAddresses.xrp;
                allAddresses.eth = walletInfo.walletAddresses.eth;
                allAddresses.sol = walletInfo.walletAddresses.sol;
                allAddresses.btc = walletInfo.walletAddresses.btc;
              }
              if (walletInfo.sessionToken && !sessionToken) {
                sessionToken = walletInfo.sessionToken;
                if (sessionToken) {
                  localStorage.setItem('sessionToken', sessionToken);
                }
              }
            }
          } catch (error) {
            console.error('Error parsing backup wallet data:', error);
          }
        }
        
        // Check sessionStorage
        if (!sessionToken) {
          try {
            const sessionStorageData = sessionStorage.getItem('riddle_wallet_session');
            if (sessionStorageData) {
              const parsed = JSON.parse(sessionStorageData);
              sessionToken = parsed.sessionToken;
              if (sessionToken) {
                localStorage.setItem('sessionToken', sessionToken);
              }
            }
          } catch (error) {
            // Ignore
          }
        }

        // Validate session with server
        if (sessionToken) {
          try {
            const response = await fetch('/api/riddle-wallet/session', {
              method: 'GET',
              headers: { 'Authorization': `Bearer ${sessionToken}` }
            });
            
            if (response.ok) {
              const data = await response.json() as any;
              walletStates.riddle = true;
              
              if (data.walletAddresses) {
                allAddresses.xrp = data.walletAddresses.xrp;
                allAddresses.eth = data.walletAddresses.eth;
                allAddresses.sol = data.walletAddresses.sol;
                allAddresses.btc = data.walletAddresses.btc;
                
                localStorage.setItem('riddle_wallet_data', JSON.stringify({
                  sessionToken,
                  walletAddresses: data.walletAddresses,
                  authenticated: true,
                  timestamp: Date.now()
                }));
              }
              console.log('✅ [BRIDGE] Riddle wallet connected');
            } else if (response.status === 401) {
              localStorage.removeItem('sessionToken');
              walletStates.riddle = false;
              console.log('❌ [BRIDGE] Riddle session expired');
            }
          } catch (error) {
            walletStates.riddle = false;
            console.error('❌ [BRIDGE] Riddle connection check failed:', error);
          }
        }

        // 2. Check Xaman wallet connection (multiple storage checks)
        console.log('🟠 [BRIDGE] Checking Xaman wallet...');
        const isXamanConnected = localStorage.getItem('xrpl_wallet_connected') === 'true';
        let xamanAddress = localStorage.getItem('xrpl_wallet_address');
        
        // Also check alternative storage locations
        if (!xamanAddress) {
          xamanAddress = localStorage.getItem('xamanAddress') || 
                        localStorage.getItem('xaman_address') ||
                        sessionStorage.getItem('xrpl_wallet_address');
        }
        
        // Validate the Xaman connection is still active
        if (isXamanConnected && xamanAddress) {
          try {
            // Additional validation could be added here
            walletStates.xaman = true;
            if (!allAddresses.xrp) { // Don't override Riddle address
              allAddresses.xrp = xamanAddress;
            }
            console.log('✅ [BRIDGE] Xaman wallet connected:', xamanAddress);
          } catch (error) {
            console.log('❌ [BRIDGE] Xaman validation failed:', error);
            // Clear invalid connection
            localStorage.removeItem('xrpl_wallet_connected');
            localStorage.removeItem('xrpl_wallet_address');
          }
        }

        // 3. Check MetaMask/WalletConnect (enhanced detection)
        console.log('🦊 [BRIDGE] Checking MetaMask...');
        try {
          const ethereum = (window as any).ethereum;
          let ethConnected = false;
          let ethAddress = null;
          
          // First check localStorage for existing connection
          const storedEthConnected = localStorage.getItem('ethereum_wallet_connected') === 'true';
          const storedEthAddress = localStorage.getItem('ethereum_wallet_address');
          
          if (storedEthConnected && storedEthAddress) {
            // Verify the stored connection is still valid
            if (ethereum?.isMetaMask) {
              try {
                const accounts = await ethereum.request({ method: 'eth_accounts' });
                if (accounts && accounts.length > 0 && accounts.includes(storedEthAddress)) {
                  ethConnected = true;
                  ethAddress = storedEthAddress;
                  console.log('✅ [BRIDGE] MetaMask restored from storage:', ethAddress);
                } else {
                  // Connection changed, get current accounts
                  if (accounts && accounts.length > 0) {
                    ethConnected = true;
                    ethAddress = accounts[0];
                    localStorage.setItem('ethereum_wallet_address', accounts[0]);
                    console.log('✅ [BRIDGE] MetaMask updated address:', ethAddress);
                  } else {
                    // No longer connected, clear storage
                    localStorage.removeItem('ethereum_wallet_connected');
                    localStorage.removeItem('ethereum_wallet_address');
                    console.log('❌ [BRIDGE] MetaMask connection lost');
                  }
                }
              } catch (error) {
                console.log('❌ [BRIDGE] MetaMask validation failed:', error);
                // Clear invalid connection
                localStorage.removeItem('ethereum_wallet_connected');
                localStorage.removeItem('ethereum_wallet_address');
              }
            }
          } else if (ethereum?.isMetaMask) {
            // Check for new connection
            try {
              const accounts = await ethereum.request({ method: 'eth_accounts' });
              if (accounts && accounts.length > 0) {
                ethConnected = true;
                ethAddress = accounts[0];
                localStorage.setItem('ethereum_wallet_connected', 'true');
                localStorage.setItem('ethereum_wallet_address', accounts[0]);
                console.log('✅ [BRIDGE] MetaMask newly detected:', ethAddress);
              }
            } catch (error) {
              console.log('❌ [BRIDGE] MetaMask detection failed:', error);
            }
          }
          
          if (ethConnected && ethAddress) {
            walletStates.walletconnect = true;
            if (!allAddresses.eth) { // Don't override Riddle address
              allAddresses.eth = ethAddress;
            }
          }
        } catch (error) {
          console.log('❌ [BRIDGE] MetaMask check failed:', error);
        }

        // 4. Check Phantom wallet (enhanced detection)
        console.log('👻 [BRIDGE] Checking Phantom...');
        try {
          const phantom = (window as any).phantom?.solana;
          let phantomConnected = false;
          let phantomAddress = null;
          
          // First check localStorage for existing connection
          const storedPhantomConnected = localStorage.getItem('solana_wallet_connected') === 'true';
          const storedPhantomAddress = localStorage.getItem('solana_wallet_address');
          
          if (storedPhantomConnected && storedPhantomAddress) {
            // Verify the stored connection is still valid
            if (phantom && phantom.isConnected && phantom.publicKey) {
              const currentAddress = phantom.publicKey.toString();
              if (currentAddress === storedPhantomAddress) {
                phantomConnected = true;
                phantomAddress = storedPhantomAddress;
                console.log('✅ [BRIDGE] Phantom restored from storage:', phantomAddress);
              } else {
                // Address changed, update storage
                phantomConnected = true;
                phantomAddress = currentAddress;
                localStorage.setItem('solana_wallet_address', currentAddress);
                console.log('✅ [BRIDGE] Phantom updated address:', phantomAddress);
              }
            } else {
              // No longer connected, clear storage
              localStorage.removeItem('solana_wallet_connected');
              localStorage.removeItem('solana_wallet_address');
              console.log('❌ [BRIDGE] Phantom connection lost');
            }
          } else if (phantom && phantom.isConnected && phantom.publicKey) {
            // Check for new connection
            phantomConnected = true;
            phantomAddress = phantom.publicKey.toString();
            localStorage.setItem('solana_wallet_connected', 'true');
            localStorage.setItem('solana_wallet_address', phantomAddress);
            console.log('✅ [BRIDGE] Phantom newly detected:', phantomAddress);
          }
          
          if (phantomConnected && phantomAddress) {
            walletStates.phantom = true;
            if (!allAddresses.sol) { // Don't override Riddle address
              allAddresses.sol = phantomAddress;
            }
          }
        } catch (error) {
          console.log('❌ [BRIDGE] Phantom check failed:', error);
        }

        // Update states
        setConnectedWallets(walletStates);
        setWalletAddresses(allAddresses);
        
        console.log('🔧 [BRIDGE] Final wallet state:', {
          connectedWallets: walletStates,
          addresses: allAddresses
        });
        
        // Auto-populate FROM and TO addresses based on selected tokens
        const populateAddresses = () => {
          // Populate FROM address
          if (fromToken) {
            console.log('📤 [BRIDGE] Auto-populating FROM address for:', fromToken);
            if (fromToken === 'XRP' || fromToken === 'RDL') {
              if (allAddresses.xrp) {
                onFromAddressChange(allAddresses.xrp);
              }
            } else {
              // Use unified chain mapping for consistent address population
              const fromChain = getTokenChain(fromToken);
              if (fromChain === 'eth' && allAddresses.eth) {
                onFromAddressChange(allAddresses.eth);
              } else if (fromChain === 'sol' && allAddresses.sol) {
                onFromAddressChange(allAddresses.sol);
              } else if (fromChain === 'btc' && allAddresses.btc) {
                onFromAddressChange(allAddresses.btc);
              }
            }
          }

          // Populate TO address based on destination token
          if (toToken) {
            console.log('🎯 [BRIDGE] Auto-populating TO address for:', toToken);
            const toChain = getTokenChain(toToken);
            
            if (toChain === 'xrp' && allAddresses.xrp) {
              onToAddressChange(allAddresses.xrp);
              // Check trustline for RDL
              if (toToken === 'RDL') {
                console.log('🔍 [BRIDGE] Checking RDL trustline for address:', allAddresses.xrp);
                checkRDLTrustline(allAddresses.xrp);
              }
            } else if (toChain === 'eth' && allAddresses.eth) {
              onToAddressChange(allAddresses.eth);
            } else if (toChain === 'sol' && allAddresses.sol) {
              onToAddressChange(allAddresses.sol);
            } else if (toChain === 'btc' && allAddresses.btc) {
              onToAddressChange(allAddresses.btc);
            }
          }
        };

        populateAddresses();

      } catch (error) {
        console.error('❌ Failed to load wallet info:', error);
        setConnectedWallets({
          riddle: false,
          xaman: false,
          walletconnect: false,
          phantom: false
        });
        setWalletAddresses({});
      }
      
      console.log('🔧 Bridge Step 1 loading complete');
      setIsLoadingWallet(false);
    };

    loadAllWalletInfo();

    // Fallback timeout - ensure loading doesn't get stuck
    const timeoutId = setTimeout(() => {
      if (isLoadingWallet) {
        console.log('⏰ Wallet loading timeout - setting to false');
        setIsLoadingWallet(false);
      }
    }, 10000); // 10 second timeout

    return () => clearTimeout(timeoutId);
  }, []); // Run only once on mount

  // Periodic wallet status check for live detection
  useEffect(() => {
    if (isLoadingWallet) return; // Don't run while initial loading
    
    const recheckWalletConnections = async () => {
      console.log('🔄 [BRIDGE] Periodic wallet recheck...');
      
      try {
        // Quick check for external wallets without full reload
        const updates: Partial<ConnectedWallets> = {};
        const addressUpdates: Partial<WalletAddresses> = {};
        
        // Check MetaMask status change
        const ethereum = (window as any).ethereum;
        if (ethereum?.isMetaMask) {
          try {
            const accounts = await ethereum.request({ method: 'eth_accounts' });
            const wasConnected = connectedWallets.walletconnect;
            const isNowConnected = accounts && accounts.length > 0;
            
            if (wasConnected !== isNowConnected) {
              updates.walletconnect = isNowConnected;
              if (isNowConnected && accounts[0]) {
                addressUpdates.eth = accounts[0];
                localStorage.setItem('ethereum_wallet_connected', 'true');
                localStorage.setItem('ethereum_wallet_address', accounts[0]);
                console.log('🔄 [BRIDGE] MetaMask connection status changed: connected');
              } else {
                localStorage.removeItem('ethereum_wallet_connected');
                localStorage.removeItem('ethereum_wallet_address');
                console.log('🔄 [BRIDGE] MetaMask connection status changed: disconnected');
              }
            }
          } catch (error) {
            // Silent fail for periodic check
          }
        }
        
        // Check Phantom status change
        const phantom = (window as any).phantom?.solana;
        if (phantom) {
          const wasConnected = connectedWallets.phantom;
          const isNowConnected = phantom.isConnected && phantom.publicKey;
          
          if (wasConnected !== isNowConnected) {
            updates.phantom = isNowConnected;
            if (isNowConnected && phantom.publicKey) {
              addressUpdates.sol = phantom.publicKey.toString();
              localStorage.setItem('solana_wallet_connected', 'true');
              localStorage.setItem('solana_wallet_address', phantom.publicKey.toString());
              console.log('🔄 [BRIDGE] Phantom connection status changed: connected');
            } else {
              localStorage.removeItem('solana_wallet_connected');
              localStorage.removeItem('solana_wallet_address');
              console.log('🔄 [BRIDGE] Phantom connection status changed: disconnected');
            }
          }
        }
        
        // Apply updates if any changes detected
        if (Object.keys(updates).length > 0) {
          setConnectedWallets((prev: ConnectedWallets) => ({ ...prev, ...updates }));
        }
        if (Object.keys(addressUpdates).length > 0) {
          setWalletAddresses((prev: WalletAddresses) => ({ ...prev, ...addressUpdates }));
        }
        
      } catch (error) {
        console.error('🔄 [BRIDGE] Periodic wallet check failed:', error);
      }
    };
    
    // Check every 5 seconds for wallet status changes
    const recheckInterval = setInterval(recheckWalletConnections, 5000);
    
    return () => clearInterval(recheckInterval);
  }, [isLoadingWallet, connectedWallets.walletconnect, connectedWallets.phantom]); // Re-run when loading state or specific wallet states change

  // Fetch bridge quote when amount or tokens change
  useEffect(() => {
    const fetchBridgeQuote = async () => {
      if (!amount || parseFloat(amount) <= 0 || !fromToken || !toToken) {
        setBridgeQuote(null);
        return;
      }

      setIsLoadingQuote(true);
      try {
        const response = await fetch(`/api/bridge/quote?fromToken=${fromToken}&toToken=${toToken}&amount=${amount}`);
        if (response.ok) {
          const quote = await response.json() as any;
          setBridgeQuote({
            exchangeRate: quote.exchangeRate || 'N/A',
            platformFee: quote.platformFee || 'N/A',
            estimatedOutput: quote.estimatedOutput || 'N/A',
            totalCost: quote.totalCost || amount,
            fromTokenPrice: quote.fromTokenPrice || 'N/A',
            toTokenPrice: quote.toTokenPrice || 'N/A'
          });
        } else {
          setBridgeQuote(null);
        }
      } catch (error) {
        console.error('Failed to fetch bridge quote:', error);
        setBridgeQuote(null);
      }
      setIsLoadingQuote(false);
    };

    // Debounce the quote fetching
    const timeoutId = setTimeout(fetchBridgeQuote, 500);
    return () => clearTimeout(timeoutId);
  }, [amount, fromToken, toToken]);

  // Handle default wallet selection (moved from render to avoid setState during render)
  useEffect(() => {
    if (!connectedWallets || !walletAddresses || Object.keys(connectedWallets).length === 0) {
      return;
    }

    // Use the unified getAvailableWalletsForChain function defined below

    // Set default selections for chains that don't have a valid selection
    const updateDefaultSelections = () => {
      const chains = ['xrp', 'eth', 'sol', 'btc'];
      const updates: any = {};
      
      chains.forEach(chain => {
        const availableWallets = getAvailableWalletsForChain(chain);
        const currentSelection = selectedWallets[chain];
        
        // Check if current selection is valid
        const isCurrentSelectionValid = availableWallets.find(w => w.id === currentSelection);
        
        if (!isCurrentSelectionValid && availableWallets.length > 0) {
          // Set to first available wallet
          updates[chain] = availableWallets[0].id;
          console.log(`🔧 [BRIDGE] Setting default wallet for ${chain}: ${availableWallets[0].id}`);
        }
      });
      
      if (Object.keys(updates).length > 0) {
        const newSelectedWallets = { ...selectedWallets, ...updates };
        setSelectedWallets(newSelectedWallets);
        // Persist to localStorage
        localStorage.setItem('bridge_selected_wallets', JSON.stringify(newSelectedWallets));
      }
    };
    
    updateDefaultSelections();
  }, [connectedWallets, walletAddresses, linkedWallets]); // Run when wallet connections or linked wallets change

  // Sync addresses when selectedWallets changes
  useEffect(() => {
    if (!connectedWallets || !walletAddresses || !selectedWallets) {
      return;
    }

    console.log('🔄 [BRIDGE] Selected wallets changed, syncing addresses...', selectedWallets);
    
    // Helper to get address for active wallet on a chain
    const getActiveWalletAddress = (chain: string): string | null => {
      const selectedId = selectedWallets[chain];
      const availableWallets = getAvailableWalletsForChain(chain);
      const selectedWallet = availableWallets.find(w => w.id === selectedId);
      
      if (selectedWallet) {
        return selectedWallet.address;
      }
      
      // Fallback to first available wallet if selected wallet is not found
      if (availableWallets.length > 0) {
        return availableWallets[0].address;
      }
      
      return null;
    };

    // Update FROM address based on fromToken using unified mapping
    if (fromToken) {
      const fromChain = getTokenChain(fromToken);
      
      if (fromChain) {
        const activeAddress = getActiveWalletAddress(fromChain);
        if (activeAddress && activeAddress !== fromAddress) {
          console.log(`📤 [BRIDGE] Updating FROM address for ${fromToken} (${fromChain}):`, activeAddress);
          onFromAddressChange(activeAddress);
        }
      }
    }

    // Update TO address based on toToken using unified mapping
    if (toToken) {
      const toChain = getTokenChain(toToken);
      
      if (toChain) {
        const activeAddress = getActiveWalletAddress(toChain);
        if (activeAddress && activeAddress !== toAddress) {
          console.log(`🎯 [BRIDGE] Updating TO address for ${toToken} (${toChain}):`, activeAddress);
          onToAddressChange(activeAddress);
          
          // Re-run trustline check for RDL if needed
          if (toToken === 'RDL') {
            console.log(`🔍 [BRIDGE] Re-checking RDL trustline for selected wallet:`, activeAddress);
            checkRDLTrustline(activeAddress);
          }
        }
      }
    }
  }, [selectedWallets, fromToken, toToken, walletAddresses, connectedWallets]); // Trigger when wallet selection, tokens, or wallet data change

  // Helper function to normalize chain names
  const normalizeChain = (chain: string): string => {
    const mapping: {[key: string]: string} = {
      'xrpl': 'xrp',
      'ethereum': 'eth', 
      'solana': 'sol',
      'bitcoin': 'btc'
    };
    return mapping[chain] || chain;
  };

  // Helper function to get available wallets for a specific chain
  const getAvailableWalletsForChain = (chain: string) => {
    const wallets: Array<{id: string, name: string, address: string, type: 'connected' | 'linked'}> = [];

    // Add connected session wallets
    if (chain === 'xrp') {
      if (connectedWallets.riddle && walletAddresses.xrp) {
        wallets.push({
          id: 'riddle',
          name: `Riddle (${walletAddresses.xrp.slice(0, 8)}...${walletAddresses.xrp.slice(-6)})`,
          address: walletAddresses.xrp,
          type: 'connected'
        });
      }
      if (connectedWallets.xaman) {
        const xamanAddr = localStorage.getItem('xrpl_wallet_address');
        if (xamanAddr) {
          wallets.push({
            id: 'xaman',
            name: `Xaman (${xamanAddr.slice(0, 8)}...${xamanAddr.slice(-6)})`,
            address: xamanAddr,
            type: 'connected'
          });
        }
      }
    } else if (chain === 'eth') {
      if (connectedWallets.riddle && walletAddresses.eth) {
        wallets.push({
          id: 'riddle',
          name: `Riddle (${walletAddresses.eth.slice(0, 8)}...${walletAddresses.eth.slice(-6)})`,
          address: walletAddresses.eth,
          type: 'connected'
        });
      }
      if (connectedWallets.walletconnect) {
        const ethAddr = localStorage.getItem('ethereum_wallet_address');
        if (ethAddr) {
          wallets.push({
            id: 'walletconnect',
            name: `MetaMask (${ethAddr.slice(0, 8)}...${ethAddr.slice(-6)})`,
            address: ethAddr,
            type: 'connected'
          });
        }
      }
    } else if (chain === 'sol') {
      if (connectedWallets.riddle && walletAddresses.sol) {
        wallets.push({
          id: 'riddle',
          name: `Riddle (${walletAddresses.sol.slice(0, 8)}...${walletAddresses.sol.slice(-6)})`,
          address: walletAddresses.sol,
          type: 'connected'
        });
      }
      if (connectedWallets.phantom) {
        const phantomAddr = localStorage.getItem('solana_wallet_address');
        if (phantomAddr) {
          wallets.push({
            id: 'phantom',
            name: `Phantom (${phantomAddr.slice(0, 8)}...${phantomAddr.slice(-6)})`,
            address: phantomAddr,
            type: 'connected'
          });
        }
      }
    } else if (chain === 'btc') {
      if (connectedWallets.riddle && walletAddresses.btc) {
        wallets.push({
          id: 'riddle',
          name: `Riddle (${walletAddresses.btc.slice(0, 8)}...${walletAddresses.btc.slice(-6)})`,
          address: walletAddresses.btc,
          type: 'connected'
        });
      }
    }

    // Add linked external wallets
    linkedWallets.forEach((wallet: any) => {
      const normalizedChain = normalizeChain(wallet.chain);
      if (normalizedChain === chain && wallet.address && wallet.isVerified) {
        // Avoid duplicates by address
        const existingWallet = wallets.find(w => w.address === wallet.address);
        if (!existingWallet) {
          wallets.push({
            id: `linked-${wallet.id}`,
            name: `${wallet.walletType} (${wallet.address.slice(0, 8)}...${wallet.address.slice(-6)})`,
            address: wallet.address,
            type: 'linked'
          });
        }
      }
    });

    return wallets;
  };

  // Handle wallet selection change
  const handleWalletSelectionChange = (chain: string, walletId: string) => {
    const newSelectedWallets = {
      ...selectedWallets,
      [chain]: walletId
    };
    
    setSelectedWallets(newSelectedWallets);
    
    // Persist selection to localStorage
    localStorage.setItem('bridge_selected_wallets', JSON.stringify(newSelectedWallets));
  };

  // Check RDL trustline status when needed
  const checkRDLTrustline = async (xrpAddress: string) => {
    if (!xrpAddress) {
      setTrustlineStatus(null);
      return;
    }

    setTrustlineStatus({
      token: 'RDL',
      issuer: 'r9xvnzUWZJpDu3NA6MKHmKhKJQTRqCRgu9', // RDL issuer
      hasTrustline: false,
      isChecking: true
    });

    try {
      console.log(`🔍 [BRIDGE] Checking RDL trustline for: ${xrpAddress}`);
      
      const response = await fetch('/api/xrpl/trustline/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: xrpAddress,
          currency: 'RDL',
          issuer: 'r9xvnzUWZJpDu3NA6MKHmKhKJQTRqCRgu9'
        })
      });

      const data = await response.json() as any;
      
      setTrustlineStatus({
        token: 'RDL',
        issuer: 'r9xvnzUWZJpDu3NA6MKHmKhKJQTRqCRgu9',
        hasTrustline: data.hasTrustline || false,
        isChecking: false
      });
      
      console.log(`✅ [BRIDGE] RDL trustline status: ${data.hasTrustline ? 'EXISTS' : 'NOT FOUND'}`);
      
    } catch (error) {
      console.error(`❌ [BRIDGE] RDL trustline check failed:`, error);
      setTrustlineStatus({
        token: 'RDL',
        issuer: 'r9xvnzUWZJpDu3NA6MKHmKhKJQTRqCRgu9',
        hasTrustline: false,
        isChecking: false,
        error: 'Failed to check trustline'
      });
    }
  };
  
  // Auto-populate FROM address based on selected token (DEPRECATED - now handled by selectedWallets sync)
  // This effect is kept for initial loading but the selectedWallets sync effect above handles updates
  useEffect(() => {
    if (walletAddresses && !selectedWallets) {
      console.log('📤 [LEGACY] Initial FROM address setup for token:', fromToken);
      
      if (fromToken === 'XRP') {
        if (walletAddresses.xrp) {
          console.log('✅ [LEGACY] Setting XRP FROM address:', walletAddresses.xrp);
          onFromAddressChange(walletAddresses.xrp);
        }
      } else if (fromToken === 'ETH') {
        if (walletAddresses.eth) {
          console.log('✅ [LEGACY] Setting ETH FROM address:', walletAddresses.eth);
          onFromAddressChange(walletAddresses.eth);
        }
      } else if (fromToken === 'SOL') {
        if (walletAddresses.sol) {
          console.log('✅ [LEGACY] Setting SOL FROM address:', walletAddresses.sol);
          onFromAddressChange(walletAddresses.sol);
        }
      } else if (fromToken === 'BTC') {
        if (walletAddresses.btc) {
          console.log('✅ [LEGACY] Setting BTC FROM address:', walletAddresses.btc);
          onFromAddressChange(walletAddresses.btc);
        }
      }
    }
  }, [fromToken, walletAddresses]);

  // Auto-populate destination address based on target token (DEPRECATED - now handled by selectedWallets sync)
  // This effect is kept for initial loading but the selectedWallets sync effect above handles updates
  useEffect(() => {
    if (walletAddresses && !selectedWallets) {
      const populateDestinationAddress = () => {
        console.log('🎯 [LEGACY] Initial destination address setup for token:', toToken);
        console.log('📍 [LEGACY] Available addresses:', walletAddresses);
        
        // Map RDL token variants to their respective chain addresses
        if (toToken === 'RDL') {
          // RDL is on XRPL, use XRP address
          if (walletAddresses.xrp) {
            console.log('✅ [LEGACY] Setting XRP address for RDL:', walletAddresses.xrp);
            onToAddressChange(walletAddresses.xrp);
            // Note: trustline check now handled in selectedWallets sync effect
          }
        } else if (toToken === 'SRDL') {
          // SRDL is on Solana, use SOL address  
          const solAddress = walletAddresses.sol || walletAddresses.solana;
          if (solAddress) {
            console.log('✅ [LEGACY] Setting SOL address for SRDL:', solAddress);
            onToAddressChange(solAddress);
          }
        } else if (toToken === 'XRP') {
          if (walletAddresses.xrp) {
            onToAddressChange(walletAddresses.xrp);
          }
        } else if (toToken === 'ETH') {
          const ethAddress = walletAddresses.eth || walletAddresses.ethereum;
          if (ethAddress) {
            onToAddressChange(ethAddress);
          }
        } else if (toToken === 'SOL') {
          const solAddress = walletAddresses.sol || walletAddresses.solana;
          if (solAddress) {
            onToAddressChange(solAddress);
          }
        } else if (toToken === 'BTC') {
          const btcAddress = walletAddresses.btc || walletAddresses.bitcoin;
          if (btcAddress) {
            onToAddressChange(btcAddress);
          }
        }
        
        // Clear trustline status if not dealing with RDL
        if (toToken !== 'RDL') {
          setTrustlineStatus(null);
        }
      };

      populateDestinationAddress();
    }
  }, [toToken, walletAddresses]); // Initial setup only

  // Wallet connection functions
  const connectRiddleWallet = async () => {
    setIsConnecting((prev: {[key: string]: boolean}) => ({ ...prev, riddle: true }));
    try {
      // Redirect to Riddle wallet login page
      window.location.href = '/wallet-login';
    } catch (error) {
      console.error('❌ Failed to connect Riddle wallet:', error);
      toast({
        title: "Connection Failed",
        description: "Failed to connect Riddle wallet. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsConnecting((prev: {[key: string]: boolean}) => ({ ...prev, riddle: false }));
    }
  };

  const connectXamanWallet = async () => {
    setIsConnecting((prev: {[key: string]: boolean}) => ({ ...prev, xaman: true }));
    try {
      console.log('🟠 [BRIDGE] Initiating Xaman connection...');
      
      // Create Xaman signin payload
      const response = await fetch('/api/external-wallets/xaman/signin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-external-session-id': localStorage.getItem('externalSessionId') || ''
        },
        body: JSON.stringify({
          purpose: 'Bridge wallet connection',
          return_url: window.location.origin + '/bridge'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create Xaman signin request');
      }

      const data = await response.json() as any;
      
      setXamanModalData({
        qrCode: data.qr_png,
        deepLink: data.next.always,
        webLink: data.refs.websocket_status,
        uuid: data.uuid,
        payloadType: 'signin',
        description: 'Connect your Xaman wallet to the bridge',
        instructions: {
          qr: 'Scan this QR code with your Xaman app',
          mobile: 'Tap to open in Xaman app',
          desktop: 'Scan with your phone or click to open web version'
        },
        expiresIn: 300000 // 5 minutes
      });
      
      setShowXamanModal(true);
      
    } catch (error) {
      console.error('❌ Failed to connect Xaman wallet:', error);
      toast({
        title: "Connection Failed",
        description: "Failed to connect Xaman wallet. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsConnecting((prev: {[key: string]: boolean}) => ({ ...prev, xaman: false }));
    }
  };

  const connectMetaMaskWallet = async () => {
    setIsConnecting((prev: {[key: string]: boolean}) => ({ ...prev, walletconnect: true }));
    try {
      console.log('🦊 [BRIDGE] Connecting MetaMask...');
      
      const ethereum = (window as any).ethereum;
      if (!ethereum?.isMetaMask) {
        toast({
          title: "MetaMask Not Found",
          description: "Please install MetaMask to continue.",
          variant: "destructive"
        });
        window.open('https://metamask.io/download/', '_blank');
        return;
      }
      
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      
      if (accounts && accounts.length > 0) {
        setConnectedWallets((prev: ConnectedWallets) => ({ ...prev, walletconnect: true }));
        setWalletAddresses((prev: WalletAddresses) => ({ ...prev, eth: accounts[0] }));
        
        // Store connection in localStorage
        localStorage.setItem('ethereum_wallet_connected', 'true');
        localStorage.setItem('ethereum_wallet_address', accounts[0]);
        
        toast({
          title: "MetaMask Connected!",
          description: `Connected to ${accounts[0].substring(0, 12)}...`,
        });
        
        console.log('✅ [BRIDGE] MetaMask connected:', accounts[0]);
      }
      
    } catch (error: any) {
      console.error('❌ Failed to connect MetaMask:', error);
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect MetaMask. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsConnecting((prev: {[key: string]: boolean}) => ({ ...prev, walletconnect: false }));
    }
  };

  const connectPhantomWallet = async () => {
    setIsConnecting((prev: {[key: string]: boolean}) => ({ ...prev, phantom: true }));
    try {
      console.log('👻 [BRIDGE] Connecting Phantom...');
      
      const phantom = (window as any).phantom?.solana;
      if (!phantom) {
        toast({
          title: "Phantom Not Found",
          description: "Please install Phantom to continue.",
          variant: "destructive"
        });
        window.open('https://phantom.app/', '_blank');
        return;
      }
      
      const response = await phantom.connect();
      
      if (response && response.publicKey) {
        const address = response.publicKey.toString();
        
        setConnectedWallets((prev: ConnectedWallets) => ({ ...prev, phantom: true }));
        setWalletAddresses((prev: WalletAddresses) => ({ ...prev, sol: address }));
        
        // Store connection in localStorage
        localStorage.setItem('solana_wallet_connected', 'true');
        localStorage.setItem('solana_wallet_address', address);
        
        toast({
          title: "Phantom Connected!",
          description: `Connected to ${address.substring(0, 12)}...`,
        });
        
        console.log('✅ [BRIDGE] Phantom connected:', address);
      }
      
    } catch (error: any) {
      console.error('❌ Failed to connect Phantom:', error);
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect Phantom. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsConnecting((prev: {[key: string]: boolean}) => ({ ...prev, phantom: false }));
    }
  };

  // Handle Xaman modal events
  const handleXamanSuccess = (data: any) => {
    console.log('✅ [BRIDGE] Xaman connection successful:', data);
    
    // Update connection state
    setConnectedWallets((prev: ConnectedWallets) => ({ ...prev, xaman: true }));
    
    if (data.account) {
      setWalletAddresses((prev: WalletAddresses) => ({ ...prev, xrp: data.account }));
      
      // Store connection in localStorage
      localStorage.setItem('xrpl_wallet_connected', 'true');
      localStorage.setItem('xrpl_wallet_address', data.account);
    }
    
    setShowXamanModal(false);
    toast({
      title: "Xaman Connected!",
      description: "Successfully connected your Xaman wallet",
    });
  };

  const handleXamanError = (error: string) => {
    console.error('❌ [BRIDGE] Xaman connection failed:', error);
    setShowXamanModal(false);
    toast({
      title: "Connection Failed",
      description: error,
      variant: "destructive"
    });
  };

  const handleXamanExpiry = () => {
    console.log('⏰ [BRIDGE] Xaman connection expired');
    setShowXamanModal(false);
    toast({
      title: "Connection Expired",
      description: "The connection request has expired. Please try again.",
      variant: "destructive"
    });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-center">Bridge Tokens</h2>
      
      {/* Compact Wallet Status Bar */}
      <div className="border rounded-lg p-3 bg-gray-50 dark:bg-gray-800">
        {fromToken && (() => {
          // Use the unified getAvailableWalletsForChain function

          // Helper function to determine active wallet for token based on user selection
          const getWalletForToken = (token: string) => {
            const tokenLower = token.toLowerCase();
            let chain = '';
            
            // Map token to chain
            if (tokenLower === 'xrp' || tokenLower === 'rdl') chain = 'xrp';
            else if (tokenLower === 'eth' || tokenLower === 'usdt' || tokenLower === 'usdc') chain = 'eth';
            else if (tokenLower === 'sol' || tokenLower === 'srdl') chain = 'sol';
            else if (tokenLower === 'btc') chain = 'btc';
            
            const availableWallets = getAvailableWalletsForChain(chain);
            const selectedWalletId = selectedWallets[chain];
            
            // Try to use selected wallet first
            const selectedWallet = availableWallets.find(w => w.id === selectedWalletId);
            if (selectedWallet) {
              return {
                type: selectedWallet.name,
                status: 'active',
                address: selectedWallet.address,
                availableWallets,
                chain
              };
            }
            
            // Fall back to first available wallet (without setState during render)
            if (availableWallets.length > 0) {
              const firstWallet = availableWallets[0];
              // Note: We don't call setState here during render
              // The useEffect below will handle the default selection
              return {
                type: firstWallet.name,
                status: 'active',
                address: firstWallet.address,
                availableWallets,
                chain,
                needsDefaultSelection: true // Flag to indicate default is needed
              };
            }
            
            // No wallets available
            let neededWallet = '';
            if (chain === 'xrp') neededWallet = 'XRP wallet needed';
            else if (chain === 'eth') neededWallet = 'Ethereum wallet needed';
            else if (chain === 'sol') neededWallet = 'Solana wallet needed';
            else if (chain === 'btc') neededWallet = 'Bitcoin wallet needed';
            else neededWallet = 'Wallet needed';
            
            return { type: neededWallet, status: 'missing', availableWallets: [], chain };
          };
          
          const activeWallet = getWalletForToken(fromToken);
          
          return (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {/* Active wallet status */}
                <div className="flex items-center space-x-2">
                  {activeWallet.status === 'active' ? (
                    <>
                      <span className="text-green-600">✅</span>
                      <span className="font-medium text-sm">{activeWallet.type}</span>
                      {activeWallet.address && (
                        <span className="font-mono text-xs text-gray-600 dark:text-gray-400">
                          {activeWallet.address.substring(0, 12)}...
                        </span>
                      )}
                      
                      {/* Wallet Switcher - show if multiple wallets available */}
                      {activeWallet.availableWallets && activeWallet.availableWallets.length > 1 && (
                        <select
                          value={selectedWallets[activeWallet.chain] || ''}
                          onChange={(e) => {
                            setSelectedWallets(prev => ({
                              ...prev,
                              [activeWallet.chain]: e.target.value
                            }));
                          }}
                          className="ml-2 text-xs border rounded px-1 py-0.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                          data-testid={`wallet-switcher-${activeWallet.chain}`}
                        >
                          {activeWallet.availableWallets.map((wallet: any) => (
                            <option key={wallet.id} value={wallet.id}>
                              {wallet.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="text-orange-500">⚠️</span>
                      <span className="font-medium text-sm">{activeWallet.type}</span>
                      <button
                        onClick={() => {
                          const fromChain = getTokenChain(fromToken);
                          if (fromChain === 'xrp') {
                            connectRiddleWallet();
                          } else if (fromChain === 'eth') {
                            connectMetaMaskWallet();
                          } else if (fromChain === 'sol') {
                            connectPhantomWallet();
                          } else if (fromChain === 'btc') {
                            connectRiddleWallet(); // Bitcoin uses Riddle wallet
                          }
                        }}
                        className="text-blue-600 hover:text-blue-800 text-sm underline"
                        disabled={(() => {
                          const fromChain = getTokenChain(fromToken);
                          if (fromChain === 'xrp' || fromChain === 'btc') return isConnecting.riddle;
                          if (fromChain === 'eth') return isConnecting.walletconnect;
                          if (fromChain === 'sol') return isConnecting.phantom;
                          return false;
                        })()}
                      >
                        {(() => {
                          const fromChain = getTokenChain(fromToken);
                          if (fromChain === 'xrp' || fromChain === 'btc') {
                            return isConnecting.riddle ? 'Connecting...' : 'Connect';
                          }
                          if (fromChain === 'eth') {
                            return isConnecting.walletconnect ? 'Connecting...' : 'Connect';
                          }
                          if (fromChain === 'sol') {
                            return isConnecting.phantom ? 'Connecting...' : 'Connect';
                          }
                          return 'Connect';
                        })()}
                      </button>
                    </>
                  )}
                </div>
              </div>
              
              {/* Wallet type pills */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowManageWalletsModal(true)}
                  className="px-2 py-1 rounded text-xs text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  data-testid="manage-wallets-button"
                >
                  <Settings className="w-3 h-3" />
                </button>
                {/* Riddle */}
                <button
                  onClick={connectRiddleWallet}
                  disabled={isConnecting.riddle}
                  className={`relative px-2 py-1 rounded-full text-xs font-medium border transition-colors ${
                    connectedWallets.riddle
                      ? 'bg-green-100 border-green-300 text-green-700 dark:bg-green-900/30 dark:border-green-600 dark:text-green-300'
                      : 'bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400'
                  } ${isConnecting.riddle ? 'opacity-50 cursor-not-allowed' : ''}`}
                  data-testid="wallet-pill-riddle"
                >
                  {isConnecting.riddle ? '⏳' : '🔐'}
                  {connectedWallets.riddle && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800"></div>
                  )}
                </button>
                
                {/* Xaman */}
                <button
                  onClick={connectXamanWallet}
                  disabled={isConnecting.xaman}
                  className={`relative px-2 py-1 rounded-full text-xs font-medium border transition-colors ${
                    connectedWallets.xaman
                      ? 'bg-orange-100 border-orange-300 text-orange-700 dark:bg-orange-900/30 dark:border-orange-600 dark:text-orange-300'
                      : 'bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400'
                  } ${isConnecting.xaman ? 'opacity-50 cursor-not-allowed' : ''}`}
                  data-testid="wallet-pill-xaman"
                >
                  {isConnecting.xaman ? '⏳' : '🟠'}
                  {connectedWallets.xaman && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full border-2 border-white dark:border-gray-800"></div>
                  )}
                </button>
                
                {/* MetaMask */}
                <button
                  onClick={connectMetaMaskWallet}
                  disabled={isConnecting.walletconnect}
                  className={`relative px-2 py-1 rounded-full text-xs font-medium border transition-colors ${
                    connectedWallets.walletconnect
                      ? 'bg-purple-100 border-purple-300 text-purple-700 dark:bg-purple-900/30 dark:border-purple-600 dark:text-purple-300'
                      : 'bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400'
                  } ${isConnecting.walletconnect ? 'opacity-50 cursor-not-allowed' : ''}`}
                  data-testid="wallet-pill-metamask"
                >
                  {isConnecting.walletconnect ? '⏳' : '🦊'}
                  {connectedWallets.walletconnect && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-purple-500 rounded-full border-2 border-white dark:border-gray-800"></div>
                  )}
                </button>
                
                {/* Phantom */}
                <button
                  onClick={connectPhantomWallet}
                  disabled={isConnecting.phantom}
                  className={`relative px-2 py-1 rounded-full text-xs font-medium border transition-colors ${
                    connectedWallets.phantom
                      ? 'bg-indigo-100 border-indigo-300 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-600 dark:text-indigo-300'
                      : 'bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400'
                  } ${isConnecting.phantom ? 'opacity-50 cursor-not-allowed' : ''}`}
                  data-testid="wallet-pill-phantom"
                >
                  {isConnecting.phantom ? '⏳' : '👻'}
                  {connectedWallets.phantom && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-500 rounded-full border-2 border-white dark:border-gray-800"></div>
                  )}
                </button>
              </div>
            </div>
          );
        })()}
        
        {/* Simple loading state */}
        {!fromToken && isLoadingWallet && (
          <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
            <span>🔄</span>
            <span>Loading wallets...</span>
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* From Token */}
        <div>
          <label className="block text-sm font-medium mb-2">From Token</label>
          <select
            value={fromToken}
            onChange={(e) => onFromTokenChange(e.target.value)}
            className="w-full p-3 border rounded-lg bg-white dark:bg-gray-800"
            disabled={isProcessing}
          >
            {SUPPORTED_TOKENS.filter((token: string) => {
              // Only show tokens that have valid bridge paths
              const allowedDestinations = ALLOWED_BRIDGE_PATHS[token];
              return allowedDestinations && allowedDestinations.length > 0;
            }).map((token: string) => (
              <option key={token} value={token}>{token}</option>
            ))}
          </select>
        </div>

        {/* To Token */}
        <div>
          <label className="block text-sm font-medium mb-2">To Token</label>
          <select
            value={toToken}
            onChange={(e) => onToTokenChange(e.target.value)}
            className="w-full p-3 border rounded-lg bg-white dark:bg-gray-800"
            disabled={isProcessing}
          >
            {(() => {
              // Get allowed destination tokens based on selected source token
              const allowedDestinations = ALLOWED_BRIDGE_PATHS[fromToken] || [];
              return allowedDestinations.map((token: string) => (
                <option key={token} value={token}>{token}</option>
              ));
            })()}
          </select>
        </div>
      </div>

      {/* Amount */}
      <div>
        <label className="block text-sm font-medium mb-2">Amount</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          placeholder="0.000001"
          step="0.000001"
          className="w-full p-3 border rounded-lg bg-white dark:bg-gray-800"
          disabled={isProcessing}
        />
      </div>

      {/* From Address */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium">From Address</label>
          {fromToken && (() => {
            const fromChain = getTokenChain(fromToken);
            const availableWallets = getAvailableWalletsForChain(fromChain);
            return availableWallets.length > 1 && (
              <Select
                value={selectedWallets[fromChain] || ''}
                onValueChange={(value) => handleWalletSelectionChange(fromChain, value)}
                data-testid={`select-wallet-from-${fromChain}`}
              >
                <SelectTrigger className="w-48 h-8 text-xs">
                  <SelectValue placeholder="Select wallet" />
                </SelectTrigger>
                <SelectContent>
                  {availableWallets.map((wallet) => (
                    <SelectItem 
                      key={wallet.id} 
                      value={wallet.id}
                      data-testid={`option-wallet-${wallet.id}`}
                    >
                      <div className="flex items-center gap-2">
                        <Wallet className="h-3 w-3" />
                        <span>{wallet.name}</span>
                        {wallet.type === 'linked' && (
                          <Badge variant="outline" className="text-xs">Linked</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            );
          })()}
        </div>
        <input
          type="text"
          value={fromAddress}
          onChange={(e) => onFromAddressChange(e.target.value)}
          placeholder={isLoadingWallet ? "Loading..." : "Wallet address will auto-populate"}
          className="w-full p-3 border rounded-lg bg-white dark:bg-gray-800"
          disabled={isProcessing}
          readOnly={(() => {
            const fromChain = getTokenChain(fromToken);
            const availableWallets = getAvailableWalletsForChain(fromChain);
            return availableWallets.length > 0;
          })()}
        />
        {(() => {
          const fromChain = getTokenChain(fromToken);
          const availableWallets = getAvailableWalletsForChain(fromChain);
          const selectedWalletId = selectedWallets[fromChain];
          const selectedWallet = availableWallets.find(w => w.id === selectedWalletId);
          
          if (selectedWallet && fromAddress) {
            return (
              <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                ✅ Using your {selectedWallet.type === 'linked' ? 'linked' : 'connected'} {fromToken} wallet
              </p>
            );
          }
          
          if (availableWallets.length === 0 && fromToken) {
            return (
              <div className="mt-2 flex items-center gap-2">
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  ⚠️ No {fromToken} wallet connected
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowManageWalletsModal(true)}
                  data-testid="button-manage-wallets"
                >
                  Connect Wallet
                </Button>
              </div>
            );
          }
          
          return null;
        })()}
      </div>

      {/* To Address */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium">Destination Address</label>
          {toToken && (toToken === 'RDL' || toToken === 'SRDL') && (() => {
            const toChain = getTokenChain(toToken);
            const availableWallets = getAvailableWalletsForChain(toChain);
            return availableWallets.length > 1 && (
              <Select
                value={selectedWallets[toChain] || ''}
                onValueChange={(value) => handleWalletSelectionChange(toChain, value)}
                data-testid={`select-wallet-to-${toChain}`}
              >
                <SelectTrigger className="w-48 h-8 text-xs">
                  <SelectValue placeholder="Select destination wallet" />
                </SelectTrigger>
                <SelectContent>
                  {availableWallets.map((wallet) => (
                    <SelectItem 
                      key={wallet.id} 
                      value={wallet.id}
                      data-testid={`option-dest-wallet-${wallet.id}`}
                    >
                      <div className="flex items-center gap-2">
                        <Wallet className="h-3 w-3" />
                        <span>{wallet.name}</span>
                        {wallet.type === 'linked' && (
                          <Badge variant="outline" className="text-xs">Linked</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            );
          })()}
        </div>
        <input
          type="text"
          value={toAddress}
          onChange={(e) => onToAddressChange(e.target.value)}
          placeholder={
            toToken === 'RDL' ? "Will use your XRP address for RDL" : 
            toToken === 'SRDL' ? "Will use your SOL address for SRDL" :
            "Destination wallet address"
          }
          className="w-full p-3 border rounded-lg bg-white dark:bg-gray-800"
          disabled={isProcessing}
          readOnly={(() => {
            if (toToken === 'RDL' || toToken === 'SRDL') {
              const toChain = getTokenChain(toToken);
              const availableWallets = getAvailableWalletsForChain(toChain);
              return availableWallets.length > 0;
            }
            return false;
          })()}
        />
        {(() => {
          if (toToken === 'RDL' || toToken === 'SRDL') {
            const toChain = getTokenChain(toToken);
            const availableWallets = getAvailableWalletsForChain(toChain);
            const selectedWalletId = selectedWallets[toChain];
            const selectedWallet = availableWallets.find(w => w.id === selectedWalletId);
            
            if (selectedWallet && toAddress) {
              return (
                <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                  ✅ {toToken} will be sent to your {selectedWallet.type === 'linked' ? 'linked' : 'connected'} {toToken === 'RDL' ? 'XRP' : 'SOL'} wallet
                </p>
              );
            }
            
            if (availableWallets.length === 0) {
              return (
                <div className="mt-2 flex items-center gap-2">
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    ⚠️ No {toToken === 'RDL' ? 'XRP' : 'SOL'} wallet connected for {toToken}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowManageWalletsModal(true)}
                    data-testid="button-manage-dest-wallets"
                  >
                    Connect Wallet
                  </Button>
                </div>
              );
            }
          }
          
          return null;
        })()}
        
        {/* RDL Trustline Status */}
        {toToken === 'RDL' && toAddress && (
          <div className="mt-2">
            {trustlineStatus?.isChecking ? (
              <div className="flex items-center text-sm text-blue-600 dark:text-blue-400">
                <div className="animate-spin mr-2">⏳</div>
                Checking RDL trustline...
              </div>
            ) : trustlineStatus?.hasTrustline ? (
              <div className="flex items-center text-sm text-green-600 dark:text-green-400">
                <span className="mr-2">✅</span>
                RDL trustline exists - ready to receive tokens
              </div>
            ) : trustlineStatus && !trustlineStatus.hasTrustline ? (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3">
                <div className="flex items-center text-sm text-yellow-800 dark:text-yellow-200">
                  <span className="mr-2">⚠️</span>
                  <span className="font-medium">RDL trustline required</span>
                </div>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                  You need to create a trustline for RDL token before receiving it. Please create the trustline first.
                </p>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Bridge Details Summary */}
      {amount && parseFloat(amount) > 0 && fromToken && toToken && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border">
          <h3 className="font-semibold text-lg mb-3 flex items-center">
            📊 Bridge Details
            {isLoadingQuote && <span className="ml-2 text-sm text-blue-600">Loading...</span>}
          </h3>
          
          {isLoadingQuote ? (
            <div className="animate-pulse space-y-2">
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-2/3"></div>
            </div>
          ) : bridgeQuote ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Bridge Path:</span>
                    <span className="text-sm font-medium">{fromToken} → {toToken}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">You Send:</span>
                    <span className="text-sm font-medium">{amount} {fromToken}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Estimated Output:</span>
                    <span className="text-sm font-medium text-green-600">{bridgeQuote.estimatedOutput} {toToken}</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Exchange Rate:</span>
                    <span className="text-sm font-medium">{bridgeQuote.exchangeRate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Platform Fee (1%):</span>
                    <span className="text-sm font-medium">{bridgeQuote.platformFee}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Total Cost:</span>
                    <span className="text-sm font-medium">{bridgeQuote.totalCost} {fromToken}</span>
                  </div>
                </div>
              </div>

              {/* Price Information */}
              <div className="border-t pt-3 mt-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-500">{fromToken} Price:</span>
                    <span className="text-xs">${bridgeQuote.fromTokenPrice}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-500">{toToken} Price:</span>
                    <span className="text-xs">${bridgeQuote.toTokenPrice}</span>
                  </div>
                </div>
              </div>

              {/* Bridge Process Summary */}
              <div className="border-t pt-3 mt-3">
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                  <strong>Bridge Process:</strong> Your {fromToken} will be sent to the bridge contract, and {toToken} will be automatically distributed to your destination address. The process typically completes within 1-2 minutes.
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500">Enter amount to see bridge details</p>
            </div>
          )}
        </div>
      )}

      {/* Submit Button */}
      <button
        onClick={onSubmit}
        disabled={
          isProcessing || 
          !amount || 
          !fromAddress || 
          !toAddress || 
          parseFloat(amount) <= 0 ||
          !Object.keys(walletAddresses).length ||
          (toToken === 'RDL' && trustlineStatus && !trustlineStatus.hasTrustline) ||
          (toToken === 'RDL' && trustlineStatus?.isChecking)
        }
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-3 px-6 rounded-lg font-medium transition-colors"
      >
        {isProcessing 
          ? 'Processing Bridge Transaction...' 
          : !Object.keys(walletAddresses).length
            ? 'Connect Riddle Wallet Required' 
            : !amount || parseFloat(amount) <= 0
              ? 'Enter Valid Amount'
              : !fromAddress
                ? 'From Address Required'
                : !toAddress
                  ? 'Destination Address Required'
                  : (toToken === 'RDL' && trustlineStatus?.isChecking)
                    ? 'Checking RDL Trustline...'
                    : (toToken === 'RDL' && trustlineStatus && !trustlineStatus.hasTrustline)
                      ? 'RDL Trustline Required'
                      : `Bridge ${amount} ${fromToken} → ${toToken}`
        }
      </button>

      {/* Xaman QR Modal */}
      {showXamanModal && xamanModalData && (
        <XamanQRModal
          isOpen={showXamanModal}
          onClose={() => setShowXamanModal(false)}
          onSuccess={handleXamanSuccess}
          onError={handleXamanError}
          onExpiry={handleXamanExpiry}
          qrCode={xamanModalData.qrCode}
          deepLink={xamanModalData.deepLink}
          webLink={xamanModalData.webLink}
          uuid={xamanModalData.uuid}
          payloadType={xamanModalData.payloadType}
          description={xamanModalData.description}
          instructions={xamanModalData.instructions}
          expiresIn={xamanModalData.expiresIn}
        />
      )}

      {/* Manage Wallets Modal */}
      <Dialog open={showManageWalletsModal} onOpenChange={setShowManageWalletsModal}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Wallet className="w-5 h-5" />
              <span>Manage Linked Wallets</span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Riddle Wallet */}
            <Card className="border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="text-2xl">🔐</div>
                    <div>
                      <h3 className="font-medium">Riddle Wallet</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Multi-chain support (XRP, ETH, SOL, BTC)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {connectedWallets.riddle ? (
                      <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                        Linked
                      </Badge>
                    ) : (
                      <Button 
                        size="sm" 
                        onClick={connectRiddleWallet}
                        disabled={isConnecting.riddle}
                      >
                        {isConnecting.riddle ? 'Linking...' : 'Link'}
                      </Button>
                    )}
                  </div>
                </div>
                
                {connectedWallets.riddle && (
                  <div className="mt-3 space-y-2 text-sm">
                    {walletAddresses.xrp && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 dark:text-gray-400">XRP:</span>
                        <div className="flex items-center space-x-2">
                          <code className="font-mono">{walletAddresses.xrp.substring(0, 20)}...</code>
                          {selectedWallets.xrp === 'riddle' && (
                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">Active</Badge>
                          )}
                        </div>
                      </div>
                    )}
                    {walletAddresses.eth && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 dark:text-gray-400">ETH:</span>
                        <div className="flex items-center space-x-2">
                          <code className="font-mono">{walletAddresses.eth.substring(0, 20)}...</code>
                          {selectedWallets.eth === 'riddle' && (
                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">Active</Badge>
                          )}
                        </div>
                      </div>
                    )}
                    {walletAddresses.sol && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 dark:text-gray-400">SOL:</span>
                        <div className="flex items-center space-x-2">
                          <code className="font-mono">{walletAddresses.sol.substring(0, 20)}...</code>
                          {selectedWallets.sol === 'riddle' && (
                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">Active</Badge>
                          )}
                        </div>
                      </div>
                    )}
                    {walletAddresses.btc && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 dark:text-gray-400">BTC:</span>
                        <div className="flex items-center space-x-2">
                          <code className="font-mono">{walletAddresses.btc.substring(0, 20)}...</code>
                          {selectedWallets.btc === 'riddle' && (
                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">Active</Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Xaman Wallet */}
            <Card className="border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="text-2xl">🟠</div>
                    <div>
                      <h3 className="font-medium">Xaman</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        XRPL native wallet
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {connectedWallets.xaman ? (
                      <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                        Linked
                      </Badge>
                    ) : (
                      <Button 
                        size="sm" 
                        onClick={connectXamanWallet}
                        disabled={isConnecting.xaman}
                      >
                        {isConnecting.xaman ? 'Connecting...' : 'Connect'}
                      </Button>
                    )}
                  </div>
                </div>
                
                {connectedWallets.xaman && (
                  <div className="mt-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">XRP Address:</span>
                      <div className="flex items-center space-x-2">
                        <code className="font-mono">{localStorage.getItem('xrpl_wallet_address')?.substring(0, 20) || 'N/A'}...</code>
                        <div className="flex items-center space-x-1">
                          {selectedWallets.xrp === 'xaman' && (
                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">Active</Badge>
                          )}
                          {connectedWallets.riddle && walletAddresses.xrp && selectedWallets.xrp !== 'xaman' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-6 px-2"
                              onClick={() => {
                                setSelectedWallets(prev => ({ ...prev, xrp: 'xaman' }));
                                toast({ title: "Wallet Switched", description: "Xaman is now active for XRP transactions" });
                              }}
                            >
                              Set Active
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* MetaMask Wallet */}
            <Card className="border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="text-2xl">🦊</div>
                    <div>
                      <h3 className="font-medium">MetaMask</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Ethereum & EVM chains
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {connectedWallets.walletconnect ? (
                      <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                        Linked
                      </Badge>
                    ) : (
                      <Button 
                        size="sm" 
                        onClick={connectMetaMaskWallet}
                        disabled={isConnecting.walletconnect}
                      >
                        {isConnecting.walletconnect ? 'Connecting...' : 'Connect'}
                      </Button>
                    )}
                  </div>
                </div>
                
                {connectedWallets.walletconnect && (
                  <div className="mt-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">ETH Address:</span>
                      <div className="flex items-center space-x-2">
                        <code className="font-mono">{localStorage.getItem('ethereum_wallet_address')?.substring(0, 20) || 'N/A'}...</code>
                        <div className="flex items-center space-x-1">
                          {selectedWallets.eth === 'metamask' && (
                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">Active</Badge>
                          )}
                          {connectedWallets.riddle && walletAddresses.eth && selectedWallets.eth !== 'metamask' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-6 px-2"
                              onClick={() => {
                                setSelectedWallets(prev => ({ ...prev, eth: 'metamask' }));
                                toast({ title: "Wallet Switched", description: "MetaMask is now active for EVM transactions" });
                              }}
                            >
                              Set Active
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Phantom Wallet */}
            <Card className="border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="text-2xl">👻</div>
                    <div>
                      <h3 className="font-medium">Phantom</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Solana ecosystem wallet
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {connectedWallets.phantom ? (
                      <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                        Linked
                      </Badge>
                    ) : (
                      <Button 
                        size="sm" 
                        onClick={connectPhantomWallet}
                        disabled={isConnecting.phantom}
                      >
                        {isConnecting.phantom ? 'Connecting...' : 'Connect'}
                      </Button>
                    )}
                  </div>
                </div>
                
                {connectedWallets.phantom && (
                  <div className="mt-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">SOL Address:</span>
                      <div className="flex items-center space-x-2">
                        <code className="font-mono">{localStorage.getItem('solana_wallet_address')?.substring(0, 20) || 'N/A'}...</code>
                        <div className="flex items-center space-x-1">
                          {selectedWallets.sol === 'phantom' && (
                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">Active</Badge>
                          )}
                          {connectedWallets.riddle && walletAddresses.sol && selectedWallets.sol !== 'phantom' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-6 px-2"
                              onClick={() => {
                                setSelectedWallets(prev => ({ ...prev, sol: 'phantom' }));
                                toast({ title: "Wallet Switched", description: "Phantom is now active for Solana transactions" });
                              }}
                            >
                              Set Active
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
          <div className="flex justify-between items-center mt-6 pt-4 border-t">
            <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
              <Settings className="w-4 h-4" />
              <span>Manage wallets • Active wallets are used for transactions</span>
            </div>
            <Button 
              variant="outline" 
              onClick={() => setShowManageWalletsModal(false)}
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
