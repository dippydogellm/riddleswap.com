import { useState, useEffect, lazy, Suspense } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Shield, Wallet, Lock, Key, Loader2, CheckCircle, XCircle, ArrowLeft, Copy, Zap, ArrowLeftRight } from "lucide-react";
// CRITICAL: Using locked wallet generation module - DO NOT MODIFY
import { generateWalletKeys, verifyWalletIntegrity } from "@/lib/wallet-generation-locked";
import type { WalletKeys } from "@/lib/wallet-generation-locked";
import { ClientCrypto } from "@/lib/crypto-utils";
import { signAuthMessage, generateAuthMessage } from "@/lib/wallet-auth";
import { createAuthenticatedSession } from "@/lib/wallet-auth";
import { hashPassword } from "@/lib/password-utils";
// Lazy load heavy components for better performance
const XamanSwapQRModalEnhanced = lazy(() => import("@/components/xaman-qr-modal-swap-enhanced").then(m => ({ default: m.XamanSwapQRModalEnhanced })));
const UnifiedSuccessModal = lazy(() => import("@/components/modals/unified-success-modal").then(m => ({ default: m.UnifiedSuccessModal })));
import { getUniversalWalletState, saveWalletForChain, walletOrchestrator } from "@/lib/wallet-orchestrator";
import { useSessionPolling } from "@/hooks/useSessionPolling";
import "@/styles/global-theme.css";
import "@/styles/create-wallet.css";

type ChainType = 'ETH' | 'SOL' | 'XRP' | 'BTC';

export default function CreateWallet() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [hasSession, setHasSession] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Poll for new sessions - but DON'T auto-redirect on create-wallet page
  useSessionPolling({
    enabled: !hasSession && !isCreating && !isRedirecting,
    interval: 3000,
    redirectOnSession: undefined, // Disable auto-redirect on create-wallet page
    onSessionFound: (sessionData) => {
      console.log('✅ [CREATE WALLET] Session detected - staying on create-wallet page');
      setHasSession(true);
      // Don't set isRedirecting - let user stay on create-wallet page
    }
  });

  // Check if user is already logged in - but allow staying on create-wallet page
  useEffect(() => {
    const sessionData = sessionStorage.getItem('riddle_wallet_session');
    const sessionToken = localStorage.getItem('sessionToken');
    
    if (sessionData || sessionToken) {
      try {
        if (sessionData) {
          const session = JSON.parse(sessionData);
          if (session.handle && session.sessionToken) {
            console.log('✅ [CREATE WALLET] Session found - staying on page for wallet management');
            setHasSession(true);
            // Don't redirect - let user manage wallets on this page
            return;
          }
        } else if (sessionToken) {
          console.log('✅ [CREATE WALLET] Token found - staying on page for wallet management');
          setHasSession(true);
          // Don't redirect - let user manage wallets on this page
          return;
        }
      } catch (error) {
        sessionStorage.removeItem('riddle_wallet_session');
      }
    }
    
    setHasSession(false);
  }, [setLocation, toast]);

  // Form state
  const [handle, setHandle] = useState('');
  const [handleStatus, setHandleStatus] = useState<{
    checking: boolean;
    available: boolean | null;
    message: string;
  }>({ checking: false, available: null, message: '' });
  const [selectedChain, setSelectedChain] = useState<ChainType>('ETH');
  const [masterPassword, setMasterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [autoLogout, setAutoLogout] = useState(true);
  const [autoLogoutMinutes, setAutoLogoutMinutes] = useState(30);
  const [availableWallets, setAvailableWallets] = useState<Array<{
    id: string;
    address: string;
    chain: string;
    chainName: string;
    provider: string;
    balance?: string;
    icon: string;
  }>>([]);
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [showSeedPhrase, setShowSeedPhrase] = useState(false);
  const [seedPhrase, setSeedPhrase] = useState('');
  const [walletKeys, setWalletKeys] = useState<any>(null);
  
  // Security backup confirmation modal
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [backupConfirmed, setBackupConfirmed] = useState(false);
  const [backupStep, setBackupStep] = useState(1); // 1: seed phrase, 2: private keys, 3: final confirmation
  
  // QR Modal states for dedicated wallet signing
  const [showXamanQR, setShowXamanQR] = useState(false);
  const [xamanPayload, setXamanPayload] = useState<{
    uuid: string;
    qr: string;
    deepLink: string;
  } | null>(null);
  const [showWalletConnectQR, setShowWalletConnectQR] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [xamanWalletAddress, setXamanWalletAddress] = useState('');
  
  // Check for existing Xaman connection on mount
  useEffect(() => {
    const checkAllWalletConnections = () => {
      // Check Xaman (XRPL) connection
      const isXamanConnected = localStorage.getItem('xrpl_wallet_connected') === 'true';
      const xamanAddress = localStorage.getItem('xrpl_wallet_address');
      
      if (isXamanConnected && xamanAddress) {

        setXamanWalletAddress(xamanAddress);
      }
      
      // Check for Reown (EVM/Solana) connections
      const walletState = getUniversalWalletState();

      // Log all localStorage items (not just wallet-related)
      const allKeys = Object.keys(localStorage);

      // Log wallet-related items specifically
      const walletKeys = allKeys.filter(key => 
        key.includes('wallet') || 
        key.includes('reown') || 
        key.includes('appkit') ||
        key.includes('evm') ||
        key.includes('solana')
      );

      walletKeys.forEach(key => {

      });
    };
    
    checkAllWalletConnections();
    
    // Listen for wallet updates
    const handleStorageChange = (e?: Event) => {
      if (e && 'key' in e && typeof (e as any).key === 'string' && !(e as any).key.includes('wallet')) {
        return; // Only respond to wallet-related changes
      }

      checkAllWalletConnections();
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('wallet-updated', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('wallet-updated', handleStorageChange);
    };
  }, []);

  // Get ALL connected wallet information
  const getAllConnectedWallets = () => {
    const wallets = [];
    
    // Check Reown AppKit connections using localStorage data
    try {
      const appkitConnectionStatus = localStorage.getItem('@appkit/connection_status');
      const appkitConnections = localStorage.getItem('@appkit/connections');
      const appkitActiveNamespace = localStorage.getItem('@appkit/active_namespace');


      if (appkitConnectionStatus === 'connected' && appkitConnections) {
        const connections = JSON.parse(appkitConnections);

        // Check EVM (Ethereum) connections
        if (connections.eip155 && connections.eip155.length > 0) {
          const evmConnection = connections.eip155[0];
          if (evmConnection.accounts && evmConnection.accounts.length > 0) {
            const address = evmConnection.accounts[0].address;
            wallets.push({
              id: 'ethereum',
              address: address,
              chain: 'ETH',
              chainName: 'Ethereum',
              provider: 'Reown AppKit',
              balance: 'Loading...',
              icon: '/images/chains/ethereum-logo.svg'
            });

          }
        }
        
        // Check Solana connections
        if (connections.solana && connections.solana.length > 0) {
          const solanaConnection = connections.solana[0];
          if (solanaConnection.accounts && solanaConnection.accounts.length > 0) {
            const address = solanaConnection.accounts[0].address;
            wallets.push({
              id: 'solana',
              address: address,
              chain: 'SOL',
              chainName: 'Solana',
              provider: 'Reown AppKit',
              balance: 'Loading...',
              icon: '/images/chains/solana-logo.png'
            });

          }
        }
      }
    } catch (error) {

    }
    
    // Fallback: Check universal wallet state
    const walletState = getUniversalWalletState();

    // Add EVM if not already added and available
    if (!wallets.find(w => w.id === 'ethereum') && walletState.evm.isConnected && walletState.evm.address) {
      wallets.push({
        id: 'ethereum',
        address: walletState.evm.address,
        chain: 'ETH',
        chainName: 'Ethereum',
        provider: 'Universal Wallet',
        balance: walletState.evm.balance || 'Loading...',
        icon: '/images/chains/ethereum-logo.svg'
      });
    }
    
    // Add Solana if not already added and available
    if (!wallets.find(w => w.id === 'solana') && walletState.solana.isConnected && walletState.solana.address) {
      wallets.push({
        id: 'solana',
        address: walletState.solana.address,
        chain: 'SOL',
        chainName: 'Solana',
        provider: 'Universal Wallet',
        balance: walletState.solana.balance || 'Loading...',
        icon: '/images/chains/solana-logo.png'
      });
    }
    
    // Check XRPL connection via Xaman
    const xamanConnected = localStorage.getItem('xrpl_wallet_connected') === 'true';
    const xamanAddress = localStorage.getItem('xrpl_wallet_address');
    if (xamanConnected && xamanAddress) {
      wallets.push({
        id: 'xrpl',
        address: xamanAddress,
        chain: 'XRP',
        chainName: 'XRP Ledger',
        provider: 'Xaman',
        icon: '/images/chains/xrp-logo.svg'
      });
    }
    
    return wallets;
  };

  // Update available wallets state based on Reown and Xaman
  useEffect(() => {
    const updateWallets = () => {
      const wallets = getAllConnectedWallets();
      setAvailableWallets(wallets);

      // Auto-select first wallet if none selected
      if (wallets.length > 0 && !selectedWallet) {
        setSelectedWallet(wallets[0].id);
      }
    };
    
    updateWallets();
  }, [selectedWallet]);

  // Listen for wallet state changes
  useEffect(() => {
    const handleWalletChange = () => {
      const wallets = getAllConnectedWallets();
      setAvailableWallets(wallets);

    };

    window.addEventListener('wallet-updated', handleWalletChange);
    window.addEventListener('storage', handleWalletChange);
    
    return () => {
      window.removeEventListener('wallet-updated', handleWalletChange);
      window.removeEventListener('storage', handleWalletChange);
    };
  }, []);

  const getConnectedWallet = () => {
    const walletState = getUniversalWalletState();
    switch (selectedChain) {
      case 'ETH':
        return walletState.evm.isConnected ? walletState.evm : null;
      case 'SOL':
        return walletState.solana.isConnected ? walletState.solana : null;
      case 'XRP':
        // Check for Xaman wallet connection
        const xamanConnected = localStorage.getItem('xrpl_wallet_connected') === 'true';
        const xamanAddress = localStorage.getItem('xrpl_wallet_address');
        if (xamanConnected && xamanAddress) {
          return { isConnected: true, address: xamanAddress };
        }
        return walletState.xrpl.isConnected ? walletState.xrpl : null;
      case 'BTC':
        return walletState.bitcoin.isConnected ? walletState.bitcoin : null;
      default:
        return null;
    }
  };

  const handleConnectXaman = async () => {
    try {

      const response = await fetch('/api/xumm/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json() as any;

      if (data.uuid && data.refs?.qr_png) {

        const payload = {
          uuid: data.uuid,
          qr: data.refs.qr_png,
          deepLink: data.next?.always || data.refs.ws || ''
        };
        setXamanPayload(payload);

        setShowXamanQR(true);
      } else {
        toast({
          title: "Connection Error",
          description: "Failed to create Xaman connection. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {

      toast({
        title: "Network Error",
        description: "Please check your connection and try again.",
        variant: "destructive"
      });
    }
  };

  const handleXamanSuccess = async (walletAddress: string) => {

    setShowXamanQR(false);
    setXamanPayload(null);
    setXamanWalletAddress(walletAddress);
    
    // Save to localStorage
    localStorage.setItem('xrpl_wallet_connected', 'true');
    localStorage.setItem('xrpl_wallet_address', walletAddress);
    
    toast({
      title: "Xaman Connected",
      description: "Now creating your @riddle wallet...",
    });

    // Continue with wallet creation process if XRP is selected
    if (selectedChain === 'XRP' && handle.trim()) {
      await completeWalletCreation();
    }
  };

  const createRiddleWallet = async (linkedWallet: any = null) => {
    console.log('🚀 [CREATE WALLET] Starting createRiddleWallet function');
    setIsCreating(true);

    try {
      console.log('✅ [CREATE WALLET] Basic validation starting...');
      // Early validation
      if (!handle.trim()) {
        throw new Error('Handle is required');
      }
      
      if (!masterPassword.trim()) {
        throw new Error('Master password is required');
      }
      console.log('✅ [CREATE WALLET] Basic validation passed');
      // Generate auth message if linking a wallet
      let signature = null;
      if (linkedWallet) {
        const authMessage = generateAuthMessage(handle, linkedWallet.address, 'create', linkedWallet.chain);
        
        if (linkedWallet.chain === 'XRP') {
          // Handle Xaman signing for XRP
          toast({
            title: "Sign with Xaman",
            description: `Please sign the message with Xaman to create @${handle}`,
          });

          const signResponse = await fetch('/api/xumm/sign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: authMessage,
              handle
            })
          });

          if (!signResponse.ok) {
            throw new Error('Failed to create signing request');
          }

          const signData = await signResponse.json();
          signature = {
            address: linkedWallet.address,
            signature: signData.signature || linkedWallet.address,
            message: authMessage,
            timestamp: Date.now(),
            chain: linkedWallet.chain
          };
        } else {
          // For EVM/Solana wallets via Reown, use address as signature
          signature = {
            address: linkedWallet.address,
            signature: linkedWallet.address, // Use address as signature for non-Xaman wallets
            message: authMessage,
            timestamp: Date.now(),
            chain: linkedWallet.chain
          };
        }
      }

      console.log('🔑 [CREATE WALLET] Generating wallet keys using locked module...');
      // Generate wallet keys from secure locked module
      const walletGeneration = await generateWalletKeys();
      
      // CRITICAL: Verify wallet integrity before proceeding
      if (!verifyWalletIntegrity(walletGeneration.wallets)) {
        throw new Error('SECURITY ALERT: Wallet integrity check failed - addresses may be corrupted');
      }
      
      console.log('✅ [CREATE WALLET] Wallet keys generated and verified:', !!walletGeneration);

      // Handle response structure properly
      const generatedKeys = walletGeneration.wallets || walletGeneration;
      const seedPhrase = walletGeneration.seedPhrase || generatedKeys.eth.mnemonic;
      
      if (!generatedKeys || !generatedKeys.eth) {
        console.error('❌ [CREATE WALLET] Failed to generate wallet keys:', { generatedKeys: !!generatedKeys, hasEth: !!(generatedKeys && generatedKeys.eth) });
        throw new Error('Failed to generate wallet keys - invalid response structure');
      }
      
      console.log('💾 [CREATE WALLET] Setting wallet data...');
      setSeedPhrase(seedPhrase);
      setWalletKeys(generatedKeys);

      console.log('🔒 [CREATE WALLET] Showing backup modal...');
      // Show secure backup modal first
      setShowBackupModal(true);
      setBackupStep(1);
      setIsCreating(false); // Allow user to interact with backup modal
      console.log('⏸️ [CREATE WALLET] Pausing for backup confirmation...');
      return; // Exit here, wallet creation continues after backup confirmation

    } catch (error: any) {
      console.error('❌ [CREATE WALLET] Error in createRiddleWallet:', error);
      toast({
        title: "Creation Failed",
        description: error.message || "Unable to create wallet. Please try again.",
        variant: "destructive"
      });
      setIsCreating(false);
    }
  };

  // Continue wallet creation after backup confirmation
  const completeWalletCreation = async () => {
    console.log('🚀 [WALLET CREATE] Starting wallet creation...');
    if (!walletKeys || !seedPhrase) {
      console.error('❌ [WALLET CREATE] Missing wallet data:', { walletKeys: !!walletKeys, seedPhrase: !!seedPhrase });
      toast({
        title: "Error",
        description: "Wallet data not available. Please try again.",
        variant: "destructive"
      });
      return;
    }

    setIsCreating(true);
    console.log('🔄 [WALLET CREATE] Set creating state to true');

    try {
      // Get selected wallet info for linking
      const linkedWallet = selectedWallet ? availableWallets.find(w => w.id === selectedWallet) : null;
      
      // Create signature for linking if wallet is selected
      let signature = null;
      if (linkedWallet) {
        const authMessage = `Creating @${handle} wallet linked to ${linkedWallet.address}`;
        signature = {
          address: linkedWallet.address,
          signature: linkedWallet.address, // Use address as signature for linking
          message: authMessage,
          timestamp: Date.now(),
          chain: linkedWallet.chain
        };
      }
      
      console.log('🔒 [WALLET CREATE] Starting password hashing...');
      // Hash the master password
      const { hash: passwordHash, salt } = await hashPassword(masterPassword);
      console.log('✅ [WALLET CREATE] Password hashed successfully');

      console.log('🔐 [WALLET CREATE] Starting encryption...');
      // Encrypt wallet keys with password using ClientCrypto
      const encryptedSeedPhrase = await ClientCrypto.encryptData(seedPhrase, masterPassword);
      const encryptedPrivateKeys = await ClientCrypto.encryptData(JSON.stringify({
        eth: walletKeys.eth.privateKey,
        xrp: walletKeys.xrp.seed || '',
        sol: walletKeys.sol.privateKey,
        btc: walletKeys.btc.privateKey
      }), masterPassword);
      console.log('✅ [WALLET CREATE] Encryption completed successfully');

      console.log('📡 [WALLET CREATE] Making API call to create wallet...');
      // Save wallet to database
      const walletCreationResponse = await fetch('/api/riddle-wallet/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle,
          masterPassword, // Include original password for auto-login
          masterPasswordHash: passwordHash, // Use the correct field name for consistency
          salt,
          encryptedSeedPhrase,
          encryptedPrivateKeys,
          walletAddresses: {
            eth: walletKeys.eth.address,
            xrp: walletKeys.xrp.address,
            sol: walletKeys.sol.address,
            btc: walletKeys.btc.address
          },
          linkedWalletAddress: linkedWallet?.address || null,
          linkedWalletChain: linkedWallet?.chain || null,
          autoLogoutEnabled: autoLogout,
          autoLogoutMinutes
        })
      });

      if (!walletCreationResponse.ok) {
        const errorData = await walletCreationResponse.json();
        
        // Handle eligibility check failures
        if (walletCreationResponse.status === 403) {
          toast({
            title: "Not Eligible",
            description: errorData.message || "You are not eligible to create a wallet at this time.",
            variant: "destructive"
          });
          setIsCreating(false);
          return;
        }
        
        // Handle constraint violations (handle exists or wallet already exists)
        if (walletCreationResponse.status === 409) {
          toast({
            title: errorData.error === "Wallet already exists" ? "Wallet Already Exists" : "Handle Already Taken",
            description: errorData.message || `Unable to create wallet. Please try again.`,
            variant: "destructive"
          });
          setIsCreating(false);
          return;
        }
        
        // Handle other errors
        throw new Error(errorData.message || 'Failed to save wallet to database');
      }

      // Get response data from wallet creation
      const creationResponse = await walletCreationResponse.json();
      console.log('✅ [WALLET CREATE] Wallet creation response:', creationResponse);

      // Handle auto-login if session token is provided
      if (creationResponse.sessionToken && creationResponse.autoLogin) {
        console.log('🔐 [AUTO-LOGIN] Processing auto-login from wallet creation');
        
        // Store session token for authentication
        localStorage.setItem('riddle_session_token', creationResponse.sessionToken);
        localStorage.setItem('riddle_session_expires', creationResponse.expiresAt.toString());
        localStorage.setItem('riddle_session_handle', creationResponse.handle);
        
        // Store wallet addresses from the response
        if (creationResponse.walletData) {
          localStorage.setItem('riddle_wallet_addresses', JSON.stringify(creationResponse.walletData));
        }
        
        console.log('✅ [AUTO-LOGIN] Session token stored, user is now logged in');
      }

      // Store wallet metadata locally as backup
      const walletMetadata = {
        handle,
        primaryChain: linkedWallet?.chain || 'NONE',
        authWalletAddress: linkedWallet?.address || null,
        authWalletChain: linkedWallet?.chain || null,
        ethAddress: walletKeys.eth.address,
        xrpAddress: walletKeys.xrp.address,
        solAddress: walletKeys.sol.address,
        btcAddress: walletKeys.btc.address,
        autoLogoutEnabled: autoLogout,
        autoLogoutMinutes,
        createdAt: new Date().toISOString(),
        creationsignature: signature?.signature || null,
        creationMessage: signature?.message || null
      };

      localStorage.setItem(`riddle_wallet_${handle}`, JSON.stringify(walletMetadata));

      // Auto-login is now handled by the server response above
      // Session management is handled automatically via the sessionToken



      setShowSeedPhrase(true);
      setShowSuccessModal(true);

      toast({
        title: "Wallet Created!",
        description: `@${handle} wallet created successfully with Xaman signing!`,
      });

    } catch (error) {



      toast({
        title: "Creation Failed",
        description: `Failed to create wallet: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Check handle availability with debouncing
  useEffect(() => {
    if (!handle || handle.length < 3) {
      setHandleStatus({ checking: false, available: null, message: '' });
      return;
    }

    const timeoutId = setTimeout(async () => {
      setHandleStatus({ checking: true, available: null, message: 'Checking availability...' });
      
      try {
        const response = await fetch('/api/riddle-wallet/check-handle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ handle: handle.trim().toLowerCase() })
        });
        
        const data = await response.json() as any;
        setHandleStatus({
          checking: false,
          available: data.available,
          message: data.message
        });
      } catch (error) {
        setHandleStatus({
          checking: false,
          available: false,
          message: 'Error checking availability'
        });
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [handle]);

  const handleCreateWallet = async () => {
    // Validation
    if (!handle.trim()) {
      toast({
        title: "Handle Required",
        description: "Please enter a @riddle handle",
        variant: "destructive"
      });
      return;
    }

    if (handle.length < 3 || handle.length > 20) {
      toast({
        title: "Invalid Handle",
        description: "Handle must be 3-20 characters",
        variant: "destructive"
      });
      return;
    }

    // Check if handle is available
    if (handleStatus.available === false) {
      toast({
        title: "Handle Not Available",
        description: handleStatus.message || "This handle is already taken. Please choose a different one.",
        variant: "destructive"
      });
      return;
    }

    // Wait for handle check to complete if still checking
    if (handleStatus.checking) {
      toast({
        title: "Please Wait",
        description: "Checking handle availability...",
        variant: "default"
      });
      return;
    }

    if (!masterPassword) {
      toast({
        title: "Password Required",
        description: "Please enter a master password",
        variant: "destructive"
      });
      return;
    }

    if (masterPassword.length < 8) {
      toast({
        title: "Password Too Short",
        description: "Master password must be at least 8 characters",
        variant: "destructive"
      });
      return;
    }

    if (masterPassword !== confirmPassword) {
      toast({
        title: "Passwords Don't Match",
        description: "Please make sure both passwords match",
        variant: "destructive"
      });
      return;
    }

    // Get selected wallet info or proceed without linking
    const selectedWalletInfo = selectedWallet ? availableWallets.find(w => w.id === selectedWallet) : null;
    
    if (selectedWalletInfo) {

      toast({
        title: "Creating Wallet",
        description: `Creating @${handle} wallet linked to ${selectedWalletInfo.chainName}`,
      });
    } else {

      toast({
        title: "Creating Wallet",
        description: `Creating standalone @${handle} wallet`,
      });
    }

    console.log('🎯 [HANDLE CREATE] Proceeding with wallet creation...');
    // Proceed with wallet creation
    await createRiddleWallet(selectedWalletInfo);
  };

  const handleContinue = () => {
    setLocation('/wallet-standalone');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Enhanced Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-primary/20 rounded-full">
              <Wallet className="w-8 h-8 text-primary" />
            </div>
            <img 
              src="/images/rdl-logo.png" 
              alt="Riddle" 
              className="w-12 h-12" 
            />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Create Your @riddle Wallet</h1>
          <p className="text-muted-foreground text-base font-medium">Secure multi-chain wallet in under 60 seconds</p>
        </div>

        {/* Enhanced Form with Clear Labels */}
        {!showBackupModal && !showSeedPhrase && (
          <div className="bg-card/50 backdrop-blur-sm rounded-xl p-6 border border-border space-y-6 shadow-lg">
            <div className="text-center mb-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 rounded-full text-blue-300 text-xs font-medium">
                <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                Step 1 of 2: Basic Information
              </div>
            </div>
            
            {/* Handle Input with Status */}
            <div className="space-y-2">
              <Label className="text-foreground font-semibold text-base">Choose Your Handle</Label>
              <div className="relative">
                <Input
                  value={handle}
                  onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                  placeholder="yourusername"
                  className="bg-background border-border text-foreground placeholder-muted-foreground pl-8 h-12 text-base font-medium"
                  disabled={isCreating}
                  data-testid="input-handle"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary font-bold text-lg">@</span>
                {handleStatus.checking && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
                )}
                {!handleStatus.checking && handle.length >= 3 && handleStatus.available === true && (
                  <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400" />
                )}
                {!handleStatus.checking && handle.length >= 3 && handleStatus.available === false && (
                  <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-400" />
                )}
              </div>
              {handleStatus.message && (
                <p className={`text-xs ${
                  handleStatus.available === true ? 'text-green-400' : 
                  handleStatus.available === false ? 'text-red-400' : 'text-gray-400'
                }`}>
                  {handleStatus.message}
                </p>
              )}
              <p className="text-xs text-gray-400">3-20 characters, letters and numbers only</p>
            </div>

            {/* Password Inputs with Strength */}
            <div className="space-y-2">
              <Label className="text-foreground font-semibold text-base">Master Password</Label>
              <Input
                type="password"
                value={masterPassword}
                onChange={(e) => setMasterPassword(e.target.value)}
                placeholder="Create a strong password"
                className="bg-background border-border text-foreground placeholder-muted-foreground h-12 text-base font-medium"
                disabled={isCreating}
                data-testid="input-password"
              />
              {masterPassword && (
                <div className="flex items-center gap-2 text-xs">
                  <div className={`w-2 h-2 rounded-full ${
                    masterPassword.length >= 8 ? 'bg-green-400' : 'bg-gray-400'
                  }`}></div>
                  <span className={masterPassword.length >= 8 ? 'text-green-400' : 'text-gray-400'}>
                    At least 8 characters
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-foreground font-semibold text-base">Confirm Password</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                className="bg-background border-border text-foreground placeholder-muted-foreground h-12 text-base font-medium"
                disabled={isCreating}
                data-testid="input-confirm-password"
              />
              {confirmPassword && (
                <div className="flex items-center gap-2 text-xs">
                  <div className={`w-2 h-2 rounded-full ${
                    masterPassword === confirmPassword ? 'bg-green-400' : 'bg-red-400'
                  }`}></div>
                  <span className={masterPassword === confirmPassword ? 'text-green-400' : 'text-red-400'}>
                    {masterPassword === confirmPassword ? 'Passwords match' : 'Passwords do not match'}
                  </span>
                </div>
              )}
            </div>

            {/* Security Notice */}
            <div className="bg-yellow-500/10 dark:bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-yellow-400" />
                <span className="text-yellow-300 text-sm font-medium">Security Notice</span>
              </div>
              <p className="text-xs text-yellow-200">
                Your wallet will be encrypted with your password. Make sure to remember it - we cannot recover lost passwords.
              </p>
            </div>

            {/* Enhanced Submit Button */}
            <Button
              onClick={createRiddleWallet}
              disabled={isCreating || !handle.trim() || !masterPassword || masterPassword !== confirmPassword || handleStatus.available === false}
              className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-lg rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              data-testid="button-create-wallet"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Creating Your Wallet...
                </>
              ) : (
                <>
                  <Wallet className="w-5 h-5 mr-2" />
                  Create My @riddle Wallet
                </>
              )}
            </Button>

            {/* Help Text */}
            <div className="text-center">
              <p className="text-xs text-gray-400">
                Already have a wallet?{' '}
                <button 
                  onClick={() => setLocation('/wallet-login')}
                  className="text-blue-400 hover:text-blue-300 underline"
                  data-testid="link-login"
                >
                  Sign in here
                </button>
              </p>
            </div>
          </div>
        )}

        {/* Seed Phrase Display - Keep existing functionality */}
        {showSeedPhrase && (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <h2 className="text-white text-xl font-bold mb-4 text-center">
              Backup Your Seed Phrase
            </h2>
            <div className="bg-black/30 rounded-lg p-4 mb-4">
              <p className="text-white font-mono text-sm break-all">{seedPhrase}</p>
            </div>
            <div className="space-y-3">
              <Button
                onClick={() => navigator.clipboard.writeText(seedPhrase)}
                variant="outline"
                className="w-full text-white border-white/30 hover:bg-white/10"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy Seed Phrase
              </Button>
              <Button
                onClick={handleContinue}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                Continue to Dashboard
              </Button>
            </div>
          </div>
        )}
        
        {/* Backup Modal */}
        {showBackupModal && (
          <Suspense fallback={<div className="flex items-center justify-center p-4"><Loader2 className="animate-spin h-8 w-8" /></div>}>
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg max-w-md w-full mx-4">
                <h2 className="text-xl font-bold mb-4">Backup Your Wallet</h2>
                <p className="mb-4">Save this seed phrase in a secure location. Never share it with anyone.</p>
                <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg mb-4">
                  <code className="text-sm break-all">{seedPhrase}</code>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => navigator.clipboard.writeText(seedPhrase)}
                    variant="outline"
                    className="flex-1"
                  >
                    Copy
                  </Button>
                  <Button
                    onClick={() => {
                      setShowBackupModal(false);
                      completeWalletCreation();
                    }}
                    className="flex-1"
                  >
                    Continue
                  </Button>
                </div>
              </div>
            </div>
          </Suspense>
        )}

        {/* Xaman QR Modal */}
        {showXamanQR && xamanPayload && (
          <Suspense fallback={<div className="flex items-center justify-center p-4"><Loader2 className="animate-spin h-8 w-8" /></div>}>
            <XamanSwapQRModalEnhanced
              isOpen={showXamanQR}
              onClose={() => {
                setShowXamanQR(false);
                setXamanPayload(null);
              }}
              payload={xamanPayload}
              onSuccess={handleXamanSuccess}
            />
          </Suspense>
        )}

        {/* Success Modal */}
        {showSuccessModal && (
          <Suspense fallback={<div className="flex items-center justify-center p-4"><Loader2 className="animate-spin h-8 w-8" /></div>}>
            <UnifiedSuccessModal
              isOpen={showSuccessModal}
              onClose={() => {
                setShowSuccessModal(false);
                setTimeout(() => {
                  const sessionToken = localStorage.getItem('sessionToken');
                  const sessionData = sessionStorage.getItem('riddle_wallet_session');
                  
                  if (sessionToken || sessionData) {
                    setLocation('/wallet-dashboard');
                  } else {
                    toast({
                      title: "Wallet Created Successfully",
                      description: "Please log in to access your wallet.",
                    });
                    setLocation('/wallet-login');
                  }
                }, 100);
              }}
              title="Riddle Wallet Created!"
              message="Your @riddle wallet has been successfully created and secured with your wallet signature. Redirecting to your dashboard..."
              type="transaction"
              showConfetti={true}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}
