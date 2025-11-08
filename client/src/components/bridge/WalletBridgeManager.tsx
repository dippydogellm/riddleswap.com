// Wallet Bridge Manager - Connect Wallet Integration
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, ArrowRight, Wallet, Lock, ExternalLink } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
// Removed AppKit imports to fix initialization error
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { BridgeExchangeDisplay } from './BridgeExchangeDisplay';
// Removed SessionManager - now works without authentication
import { TransactionDetailsDropdown } from './TransactionDetailsDropdown';
import { XamanConnectQR } from '../XamanConnectQR';
import { XamanPaymentModal } from '../xaman/XamanPaymentModal';
import { BridgeTransactionModal } from './BridgeTransactionModal';

interface BridgePayload {
  success: boolean;
  transactionId: string;
  payload: any;
  amount: string;
  estimatedOutput: string;
  bridgeFee: string;
  instructions: string;
  walletType: string;
}

const CHAIN_CONFIG = {
  XRPL: { chains: ['XRP', 'RDL'], wallets: ['riddle', 'xaman', 'joey'] },
  EVM: { chains: ['ETH', 'BNB', 'BASE', 'MATIC'], wallets: ['riddle', 'walletconnect'] },
  SOLANA: { chains: ['SOL'], wallets: ['riddle', 'walletconnect'] },
  BITCOIN: { chains: ['BTC'], wallets: ['riddle'] }
};

export function WalletBridgeManager() {
  const [fromChain, setFromChain] = useState('XRP');
  const [toChain, setToChain] = useState('RDL');
  const [amount, setAmount] = useState('0.000001');
  const [destinationAddress, setDestinationAddress] = useState('rEVrTKUKSLx5nxdfV8SAFTxS9FGFrfHRLo');
  const [walletType, setWalletType] = useState<'riddle' | 'xaman' | 'joey' | 'walletconnect' | 'linked'>('riddle');
  const [selectedRiddleWallet, setSelectedRiddleWallet] = useState<string>('');
  const [riddlePassword, setRiddlePassword] = useState('');
  const [selectedLinkedWallet, setSelectedLinkedWallet] = useState<string>('');
  const [bridgePayload, setBridgePayload] = useState<BridgePayload | null>(null);
  const [step, setStep] = useState(1);
  const [bridgeStatus, setBridgeStatus] = useState<'idle' | 'creating' | 'executing' | 'completing' | 'completed'>('idle');
  // Removed session dependency - bridge works without login
  const [completionResult, setCompletionResult] = useState<any>(null);
  const [showTransactionDetails, setShowTransactionDetails] = useState(false);
  const [showXamanConnect, setShowXamanConnect] = useState(false);
  const [showXamanPayment, setShowXamanPayment] = useState(false);
  const [xamanConnected, setXamanConnected] = useState(false);
  const [xamanAddress, setXamanAddress] = useState('');
  const [showJoeyConnect, setShowJoeyConnect] = useState(false);
  const [joeyConnected, setJoeyConnected] = useState(false);
  const [joeyAddress, setJoeyAddress] = useState('');
  
  // Transaction modal state
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactionModalStatus, setTransactionModalStatus] = useState<'pending' | 'success' | 'error' | 'executing'>('pending');
  const [transactionHash, setTransactionHash] = useState<string | undefined>();
  const [transactionError, setTransactionError] = useState<string | undefined>();

  const { toast } = useToast();
  
  // Simulated wallet connection state (replace with actual AppKit later)
  const [walletConnected, setWalletConnected] = useState(false);
  const [connectedAddress, setConnectedAddress] = useState('');

  // Session change handler
  const handleSessionChange = (newSessionData: any, isAuthenticated: boolean) => {
    console.log('🔄 WalletBridgeManager: Session change -', { newSessionData, isAuthenticated });
    
    if (!isAuthenticated) {
      // Session expired or logged out - reset all state
      console.log('🔓 WalletBridgeManager: Clearing session data due to logout/expiration');
      // External wallet disconnected
      setBridgePayload(null);
      setStep(1);
      setBridgeStatus('idle');
      // Reset form to defaults
      setDestinationAddress('rEVrTKUKSLx5nxdfV8SAFTxS9FGFrfHRLo');
      setSelectedRiddleWallet('');
      
      // Clear all cached queries that require authentication
      queryClient.invalidateQueries({ queryKey: ['/api/riddle-wallets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/riddle-wallet/session'] });
      
      return;
    }
    
    // External wallet state updated
    
    // Auto-populate addresses from session
    if (newSessionData?.walletAddresses) {
      const addresses = newSessionData.walletAddresses;
      
      // For RDL destination, always use XRP address
      if (toChain === 'RDL' && addresses.xrp) {
        setDestinationAddress(addresses.xrp);
      } else if (toChain === 'SRDL' && addresses.sol) {
        setDestinationAddress(addresses.sol);
      }
      // For other destinations, use the matching chain address
      else if (toChain === 'XRP' && addresses.xrp) {
        setDestinationAddress(addresses.xrp);
      } else if (toChain === 'ETH' && addresses.eth) {
        setDestinationAddress(addresses.eth);
      } else if (toChain === 'SOL' && addresses.sol) {
        setDestinationAddress(addresses.sol);
      } else if (toChain === 'BTC' && addresses.btc) {
        setDestinationAddress(addresses.btc);
      }
    }
  };

  // Fetch Riddle wallets
  const { data: riddleWalletsResponse = [] } = useQuery({
    queryKey: ['/api/riddle-wallets'],
    enabled: true // Enable to allow wallet selection
  });
  
  // Ensure riddleWallets is always an array
  const riddleWallets = Array.isArray(riddleWalletsResponse) ? riddleWalletsResponse : [];

  // Fetch linked wallets from database - only if session exists
  const sessionToken = localStorage.getItem('sessionToken');
  const { data: linkedWallets = [] } = useQuery<any[]>({
    queryKey: ['/api/linked-wallets'],
    enabled: !!sessionToken, // Enable only if authenticated
    staleTime: 30000
  });

  // Determine chain type based on SOURCE chain (fromChain)
  const getChainType = (chain: string) => {
    // For RDL destination, we need to determine source chain properly
    if (chain === 'XRP') return 'XRPL';
    if (chain === 'SOL') return 'SOLANA';  // SOL → RDL should use SOLANA execute
    if (['ETH', 'BNB', 'BASE', 'MATIC'].includes(chain)) return 'EVM';
    if (chain === 'BTC') return 'BITCOIN';
    
    // RDL is always destination, never source for execution
    if (chain === 'RDL') return 'XRPL'; // This should not happen for execute routing
    
    console.warn(`⚠️ Unknown chain type for: ${chain}`);
    return 'UNKNOWN';
  };

  const chainType = getChainType(fromChain);
  
  // Debug logging for SOL → RDL bridges
  console.log(`🔗 Bridge routing: ${fromChain} → ${toChain}, chainType: ${chainType}`);

  // Get available wallets for current chain
  const getAvailableWallets = (chain: string) => {
    const type = getChainType(chain);
    const baseWallets = CHAIN_CONFIG[type as keyof typeof CHAIN_CONFIG]?.wallets || [];
    
    // Check if there are compatible linked wallets for the destination chain
    // For RDL bridges, destination should be XRPL-compatible
    // For other chains, check address format compatibility
    const hasCompatibleLinkedWallets = linkedWallets.some((wallet: any) => {
      if (toChain === 'RDL') {
        // For RDL destination, need XRPL-compatible address (starts with 'r')
        return wallet.address && wallet.address.startsWith('r') && wallet.address.length >= 25;
      } else {
        // For other destinations, check chain type compatibility
        const destinationType = getChainType(toChain);
        return wallet.chain === destinationType || 
               (destinationType === 'EVM' && wallet.address && wallet.address.startsWith('0x')) ||
               (destinationType === 'XRPL' && wallet.address && wallet.address.startsWith('r')) ||
               (destinationType === 'SOLANA' && wallet.address && wallet.address.length >= 32);
      }
    });
    
    // Add linked wallet option only if there are compatible linked wallets
    if (hasCompatibleLinkedWallets) {
      return [...baseWallets, 'linked'];
    }
    
    return baseWallets;
  };

  // Create bridge payload
  const createBridge = useMutation({
    mutationFn: async (data: any): Promise<BridgePayload> => {
      const endpoint = chainType === 'XRPL' ? '/api/bridge/xrpl/create' :
                     chainType === 'EVM' ? '/api/bridge/evm/create' :
                     chainType === 'SOLANA' ? '/api/bridge/solana/create' :
                     '/api/bridge/btc/create';
      
      const response = await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(data)
      });
      return await response.json() as any;
    },
    onSuccess: (data: BridgePayload) => {
      console.log('Bridge Create Success:', data);
      if (data.success) {
        setBridgePayload(data);
        setStep(2);
        toast({
          title: "Bridge Payload Created",
          description: `Transaction ID: ${data.transactionId.slice(0, 8)}...`,
        });
      } else {
        toast({
          title: "Bridge Creation Failed",
          description: "Bridge payload creation was not successful",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      // Check if error is due to missing cached keys
      if (error.message && (error.message.includes('cached keys') || error.message.includes('Authentication required'))) {
        console.log('🔓 Missing cached keys - redirecting to re-login');
        localStorage.removeItem('sessionToken');
        toast({
          title: "Re-login Required",
          description: "Private keys not cached. Redirecting to wallet login...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = '/wallet-login';
        }, 2000);
        return;
      }
      
      toast({
        title: "Bridge Creation Failed",
        description: error.message || "Failed to create bridge payload",
        variant: "destructive",
      });
    },
  });

  // Execute bridge transaction
  const executeBridge = useMutation({
    mutationFn: async (data: any): Promise<any> => {
      const endpoint = chainType === 'XRPL' ? '/api/bridge/xrpl/execute' :
                     chainType === 'EVM' ? '/api/bridge/evm/execute' :
                     chainType === 'SOLANA' ? '/api/bridge/solana/execute' :
                     '/api/bridge/btc/execute';
      
      const response = await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(data)
      });
      return await response.json() as any;
    },
    onSuccess: (data: any) => {
      console.log('Bridge Execute Success:', data);
      if (data.success) {
        setBridgeStatus('executing');
        setTransactionHash(data.txHash);
        setTransactionModalStatus('pending');
        setShowTransactionModal(true);
        
        toast({
          title: "Payment Confirmed",
          description: `Transaction hash: ${data.txHash?.slice(0, 8)}... Bridge ready for completion`,
        });
        console.log('✅ Step 2 complete - manual completion required to prevent duplicates');
      } else {
        setBridgeStatus('idle');
        setTransactionError(data.error || 'Transaction execution failed');
        setTransactionModalStatus('error');
        setShowTransactionModal(true);
      }
    },
    onError: (error: any) => {
      setBridgeStatus('idle');
      setTransactionError(error.message || "Failed to execute bridge transaction");
      setTransactionModalStatus('error');
      setShowTransactionModal(true);
    },
  });

  // Complete bridge transaction (distribute RDL tokens)
  const completeBridge = useMutation({
    mutationFn: async (data: any): Promise<any> => {
      const endpoint = chainType === 'XRPL' ? '/api/bridge/xrpl/complete' :
                     chainType === 'EVM' ? '/api/bridge/evm/complete' :
                     chainType === 'SOLANA' ? '/api/bridge/solana/complete' :
                     '/api/bridge/btc/complete';
      
      const response = await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(data)
      });
      return await response.json() as any;
    },
    onSuccess: (data: any) => {
      console.log('Bridge Complete Success:', data);
      if (data.success) {
        setStep(3);
        setBridgeStatus('completed');
        setCompletionResult(data);
        setTransactionHash(data.txHash);
        setTransactionModalStatus('success');
        setShowTransactionModal(true);
        
        toast({
          title: "Bridge Complete!",
          description: `RDL tokens distributed successfully! Hash: ${data.txHash?.slice(0, 8) || 'N/A'}...`,
        });
      } else {
        setBridgeStatus('idle');
        setTransactionError(data.error || 'Failed to distribute RDL tokens');
        setTransactionModalStatus('error');
        setShowTransactionModal(true);
      }
    },
    onError: (error: any) => {
      setBridgeStatus('idle');
      setTransactionError(error.message || "Failed to complete bridge transaction");
      setTransactionModalStatus('error');
      setShowTransactionModal(true);
    },
  });

  // Handle wallet connection
  const handleConnectWallet = () => {
    if (walletType === 'walletconnect') {
      // Simulate wallet connection for now
      setWalletConnected(true);
      setConnectedAddress('0x1234567890123456789012345678901234567890');
      toast({
        title: "Wallet Connected",
        description: "WalletConnect wallet connected successfully",
      });
    } else if (walletType === 'xaman') {
      // Open Xaman QR modal for connection
      setShowXamanConnect(true);
    } else if (walletType === 'joey') {
      // Open Joey connection modal
      setShowJoeyConnect(true);
    }
  };

  // Handle Xaman wallet connection success
  const handleXamanConnectSuccess = (address: string) => {
    setXamanConnected(true);
    setXamanAddress(address);
    setDestinationAddress(address); // Auto-set destination to connected wallet
    setShowXamanConnect(false);
    toast({
      title: "Xaman Connected!",
      description: `Connected to ${address.slice(0, 8)}...`,
    });
  };

  // Handle Xaman payment success
  const handleXamanPaymentSuccess = (txHash: string) => {
    setShowXamanPayment(false);
    // Continue with bridge execution after payment
    toast({
      title: "Payment Confirmed!",
      description: `Transaction: ${txHash.slice(0, 8)}...`,
    });
    // Auto-complete the bridge after successful payment
    setTimeout(() => {
      if (bridgePayload) {
        handleCompleteBridge();
      }
    }, 1000);
  };

  // Handle Joey wallet connection success
  const handleJoeyConnectSuccess = (address: string) => {
    setJoeyConnected(true);
    setJoeyAddress(address);
    setDestinationAddress(address); // Auto-set destination to connected wallet
    setShowJoeyConnect(false);
    toast({
      title: "Joey Connected!",
      description: `Connected to ${address.slice(0, 8)}...`,
    });
  };

  // Handle bridge creation
  const handleCreateBridge = () => {
    if (!destinationAddress) {
      toast({
        title: "Missing Destination",
        description: "Please enter a destination address",
        variant: "destructive",
      });
      return;
    }

    console.log('Starting bridge creation with step:', step);
    setBridgeStatus('creating');

    const bridgeData = {
      fromToken: fromChain,
      toToken: toChain,
      amount,
      destinationAddress,
      walletType,
      ...(walletType === 'riddle' && { 
        riddleWalletId: typeof selectedRiddleWallet === 'object' ? (selectedRiddleWallet as any)?.handle : selectedRiddleWallet,
        password: riddlePassword 
      }),
      ...(walletType === 'linked' && { 
        linkedWalletId: String(selectedLinkedWallet),
        linkedWalletAddress: linkedWallets.find((w: any) => String(w.id) === String(selectedLinkedWallet))?.address
      }),
      ...(walletType === 'walletconnect' && { 
        connectedAddress: connectedAddress 
      })
    };

    createBridge.mutate(bridgeData);
  };

  // Handle bridge execution (Steps 2 & 3 combined)
  const handleExecuteBridge = async () => {
    if (!bridgePayload) return;

    // For Xaman wallet, show payment modal instead of auto-execution
    if (walletType === 'xaman') {
      setShowXamanPayment(true);
      return;
    }

    setBridgeStatus('executing');
    
    try {
      // Wait for session validation to complete before proceeding
      console.log('🔄 Waiting for session validation before bridge execution...');
      
      // Get session token directly from localStorage
      const sessionToken = localStorage.getItem('sessionToken');
      if (!sessionToken) {
        throw new Error('No session token available - please log in again');
      }
      
      // Validate session with server first
      const serverValidation = await fetch('/api/auth/session-check', {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });
      
      if (!serverValidation.ok) {
        throw new Error('Session validation failed - please log in again');
      }
      
      const validatedSession = await serverValidation.json();
      if (!validatedSession.success) {
        throw new Error('Session not authenticated - please log in again');
      }
      
      console.log('✅ Session validated with server, proceeding with bridge execution');

      // Determine the correct execute endpoint based on source chain
      const getChainType = (token: string) => {
        if (token === 'XRP') return 'XRPL';
        if (token === 'SOL') return 'SOLANA';
        if (['ETH', 'BNB', 'MATIC', 'BASE', 'ARB', 'OP'].includes(token)) return 'EVM';
        if (token === 'BTC') return 'BTC';
        return 'XRPL';
      };
      
      const chainType = getChainType(fromChain);
      const executeEndpoint = chainType === 'XRPL' ? '/api/bridge/xrpl/auto-execute' :
                             chainType === 'EVM' ? '/api/bridge/evm/execute' :
                             chainType === 'SOLANA' ? '/api/bridge/solana/execute' :
                             '/api/bridge/btc/execute';
      
      console.log(`🎯 ${fromChain} → ${toChain} bridge using ${chainType} execute endpoint: ${executeEndpoint}`);
      
      // Step 2: Execute the transaction
      const executeResponse = await fetch(executeEndpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          transactionId: bridgePayload.transactionId
        })
      });
      
      const executeResult = await executeResponse.json();
      
      if (!executeResult.success) {
        throw new Error(executeResult.error || 'Transaction execution failed');
      }
      
      console.log('✅ Step 2 completed:', executeResult.txHash);
      
      // Step 3: Complete the bridge (distribute RDL tokens)
      setBridgeStatus('completing');
      
      const completeEndpoint = chainType === 'SOLANA' ? '/api/bridge/solana/complete' :
                              chainType === 'EVM' ? '/api/bridge/evm/complete' :
                              chainType === 'BTC' ? '/api/bridge/btc/complete' :
                              '/api/bridge/xrpl/complete';
      
      const completeResponse = await fetch(completeEndpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          transactionId: bridgePayload.transactionId,
          destinationAddress: destinationAddress
        })
      });
      
      const completeResult = await completeResponse.json();
      
      if (!completeResult.success) {
        throw new Error(completeResult.error || 'Bridge completion failed');
      }
      
      console.log('✅ Step 3 completed:', completeResult.txHash);
      
      // Update state for Step 3 display
      setBridgeStatus('completed');
      setCompletionResult(completeResult);
      setStep(3);
      
    } catch (error) {
      console.error('Bridge execution error:', error);
      setBridgeStatus('idle');
      toast({
        title: "Bridge Error",
        description: error instanceof Error ? error.message : 'Bridge execution failed',
        variant: "destructive",
      });
    }
  };

  // Handle bridge completion (RDL distribution)
  const handleCompleteBridge = () => {
    if (!bridgePayload) return;

    console.log('Starting bridge completion for RDL distribution:', bridgePayload);

    const completeData = {
      transactionId: bridgePayload.transactionId,
      destinationAddress
    };

    completeBridge.mutate(completeData);
  };

  // Clear selected linked wallet if it becomes incompatible with destination chain
  useEffect(() => {
    if (walletType === 'linked' && selectedLinkedWallet && linkedWallets.length > 0) {
      const selectedWallet = linkedWallets.find((w: any) => String(w.id) === String(selectedLinkedWallet));
      if (selectedWallet) {
        const isCompatible = toChain === 'RDL' 
          ? selectedWallet.address && selectedWallet.address.startsWith('r') && selectedWallet.address.length >= 25
          : true; // Add more validation for other chains as needed
        
        if (!isCompatible) {
          setSelectedLinkedWallet('');
          setDestinationAddress('');
        }
      }
    }
  }, [toChain, selectedLinkedWallet, linkedWallets, walletType]);

  // Auto-set destination address based on connection
  useEffect(() => {
    if (walletType === 'walletconnect' && walletConnected && connectedAddress) {
      setDestinationAddress(connectedAddress);
    } else if (walletType === 'riddle' && typeof selectedRiddleWallet === 'object' && (selectedRiddleWallet as any)?.xrpAddress) {
      setDestinationAddress((selectedRiddleWallet as any).xrpAddress);
    } else if (walletType === 'linked' && selectedLinkedWallet) {
      const linkedWallet = linkedWallets.find((w: any) => String(w.id) === String(selectedLinkedWallet));
      if (linkedWallet?.address) {
        // Validate address is compatible with destination chain
        const isCompatible = toChain === 'RDL' 
          ? linkedWallet.address.startsWith('r') && linkedWallet.address.length >= 25
          : true; // For now, allow other chains - more validation can be added later
        
        if (isCompatible) {
          setDestinationAddress(linkedWallet.address);
        }
      }
    } else if (walletType === 'xaman' && xamanConnected && xamanAddress) {
      setDestinationAddress(xamanAddress);
    } else if (walletType === 'joey' && joeyConnected && joeyAddress) {
      setDestinationAddress(joeyAddress);
    }
  }, [walletType, walletConnected, connectedAddress, selectedRiddleWallet, selectedLinkedWallet, linkedWallets, toChain, xamanConnected, xamanAddress, joeyConnected, joeyAddress]);

  return (
    <>
      <div className="relative">
        <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRight className="w-5 h-5" />
              Multi-Chain Bridge
              {(xamanConnected || walletConnected) && <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">🔐 Connected</span>}
            </CardTitle>
          </CardHeader>
            <CardContent className="space-y-6">
          {/* Step 1: Bridge Configuration */}
          {step === 1 && (
            <>
              {/* Chain Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fromChain">From Chain</Label>
                  <Select value={fromChain} onValueChange={setFromChain}>
                    <SelectTrigger data-testid="select-from-chain">
                      <SelectValue placeholder="Select chain" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="XRP">XRP</SelectItem>
                      <SelectItem value="ETH">Ethereum</SelectItem>
                      <SelectItem value="BNB">Binance Smart Chain</SelectItem>
                      <SelectItem value="BASE">Base</SelectItem>
                      <SelectItem value="MATIC">Polygon</SelectItem>
                      <SelectItem value="SOL">Solana</SelectItem>
                      <SelectItem value="BTC">Bitcoin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="toChain">To Chain</Label>
                  <Select value={toChain} onValueChange={setToChain}>
                    <SelectTrigger data-testid="select-to-chain">
                      <SelectValue placeholder="Select chain" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RDL">RDL (XRPL)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Amount Input */}
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.000001"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.000001"
                  data-testid="input-amount"
                />
              </div>

              {/* Exchange Rate Display with 1% Fee Notice - ALWAYS SHOW */}
              <BridgeExchangeDisplay
                fromToken={fromChain}
                toToken={toChain}
                amount={parseFloat(amount) || 0.000001}
                showDetails={true}
              />

              {/* Active Wallet Display */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <img 
                      src={walletType === 'riddle' ? '/images/rdl-logo.png' :
                           walletType === 'xaman' ? '/images/wallets/xaman-logo.png' :
                           walletType === 'joey' ? '/images/wallets/joey-logo.png' :
                           '/images/wallets/metamask-logo.png'} 
                      alt={`${walletType} logo`} 
                      className="w-8 h-8 rounded-full"
                    />
                    <div>
                      <div className="font-semibold text-sm">
                        {walletType === 'riddle' ? 'Riddle Wallet' :
                         walletType === 'linked' ? 'Linked Wallet' :
                         walletType === 'xaman' ? 'Xaman Wallet' :
                         walletType === 'joey' ? 'Joey Wallet' : 'WalletConnect'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {walletType === 'riddle' && selectedRiddleWallet ? 
                          `Connected: ${typeof selectedRiddleWallet === 'object' ? (selectedRiddleWallet as any).handle : selectedRiddleWallet}` :
                         walletType === 'linked' && selectedLinkedWallet ?
                          `Connected: ${linkedWallets.find((w: any) => String(w.id) === String(selectedLinkedWallet))?.wallet_label || 'Linked Wallet'}` :
                         walletType === 'xaman' && xamanConnected ? 
                          `Connected: ${xamanAddress.slice(0, 8)}...` :
                         walletType === 'joey' && joeyConnected ? 
                          `Connected: ${joeyAddress.slice(0, 8)}...` :
                         walletType === 'walletconnect' && walletConnected ? 
                          `Connected: ${connectedAddress.slice(0, 6)}...` :
                         'Not connected'
                        }
                      </div>
                    </div>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs font-medium ${
                    (walletType === 'riddle' && selectedRiddleWallet) ||
                    (walletType === 'linked' && selectedLinkedWallet) ||
                    (walletType === 'xaman' && xamanConnected) ||
                    (walletType === 'joey' && joeyConnected) ||
                    (walletType === 'walletconnect' && walletConnected) ?
                    'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                    'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                  }`}>
                    {(walletType === 'riddle' && selectedRiddleWallet) ||
                     (walletType === 'linked' && selectedLinkedWallet) ||
                     (walletType === 'xaman' && xamanConnected) ||
                     (walletType === 'joey' && joeyConnected) ||
                     (walletType === 'walletconnect' && walletConnected) ? '🔐 Connected' : '❌ Not Connected'}
                  </div>
                </div>
              </div>

              {/* Wallet Type Selection */}
              <div className="space-y-2">
                <Label htmlFor="walletType">Change Wallet Type</Label>
                <Select value={walletType} onValueChange={(value: any) => setWalletType(value)}>
                  <SelectTrigger data-testid="select-wallet-type">
                    <SelectValue placeholder="Select wallet" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableWallets(fromChain).map(wallet => (
                      <SelectItem key={wallet} value={wallet}>
                        <div className="flex items-center space-x-2">
                          <img 
                            src={wallet === 'riddle' ? '/images/rdl-logo.png' :
                                 wallet === 'xaman' ? '/images/wallets/xaman-logo.png' :
                                 wallet === 'joey' ? '/images/wallets/joey-logo.png' :
                                 wallet === 'linked' ? '/images/rdl-logo.png' :
                                 '/images/wallets/metamask-logo.png'} 
                            alt={`${wallet} logo`} 
                            className="w-4 h-4 rounded"
                          />
                          <span>
                            {wallet === 'riddle' ? 'Riddle Wallet' :
                             wallet === 'xaman' ? 'Xaman Wallet' :
                             wallet === 'joey' ? 'Joey Wallet' :
                             wallet === 'linked' ? 'Linked Wallets' : 'WalletConnect'}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Wallet Connection */}
              {walletType === 'walletconnect' && (
                <div className="space-y-4">
                  {!walletConnected ? (
                    <Button onClick={handleConnectWallet} className="w-full" variant="outline">
                      <Wallet className="w-4 h-4 mr-2" />
                      Connect Wallet
                    </Button>
                  ) : (
                    <Alert>
                      <Wallet className="h-4 w-4" />
                      <AlertDescription>
                        Connected: {connectedAddress?.slice(0, 6)}...{connectedAddress?.slice(-4)}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              {/* Xaman Wallet Connection */}
              {walletType === 'xaman' && (
                <div className="space-y-4">
                  {!xamanConnected ? (
                    <Button onClick={handleConnectWallet} className="w-full" variant="outline" data-testid="button-connect-xaman">
                      <span className="mr-2">💳</span>
                      Connect Xaman Wallet
                    </Button>
                  ) : (
                    <Alert>
                      <Wallet className="h-4 w-4" />
                      <AlertDescription>
                        Connected Xaman: {xamanAddress?.slice(0, 8)}...{xamanAddress?.slice(-8)}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              {/* Joey Wallet Connection */}
              {walletType === 'joey' && (
                <div className="space-y-4">
                  {!joeyConnected ? (
                    <Button onClick={handleConnectWallet} className="w-full" variant="outline" data-testid="button-connect-joey">
                      <img src="/images/wallets/joey-logo.png" alt="Joey" className="w-4 h-4 mr-2" />
                      Connect Joey Wallet
                    </Button>
                  ) : (
                    <Alert>
                      <Wallet className="h-4 w-4" />
                      <AlertDescription>
                        Connected Joey: {joeyAddress?.slice(0, 8)}...{joeyAddress?.slice(-8)}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              {/* Riddle Wallet Connection */}
              {walletType === 'riddle' && (
                <div className="space-y-4">
                  {riddleWallets && riddleWallets.length > 0 ? (
                    <div className="space-y-2">
                      <Label htmlFor="riddleWallet">Select Riddle Wallet</Label>
                      <Select 
                        value={typeof selectedRiddleWallet === 'object' ? (selectedRiddleWallet as any)?.handle : selectedRiddleWallet} 
                        onValueChange={(value) => {
                          const wallet = riddleWallets.find((w: any) => w.handle === value);
                          setSelectedRiddleWallet(wallet || value);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a Riddle wallet" />
                        </SelectTrigger>
                        <SelectContent>
                          {riddleWallets.map((wallet: any) => (
                            <SelectItem key={wallet.handle} value={wallet.handle}>
                              <div className="flex items-center space-x-2">
                                <img src="/images/rdl-logo.png" alt="Riddle" className="w-4 h-4 rounded" />
                                <div>
                                  <div className="font-medium">{wallet.handle}</div>
                                  <div className="text-xs text-gray-500">
                                    {wallet.xrpAddress ? `${wallet.xrpAddress.slice(0, 8)}...` : 'No XRP address'}
                                  </div>
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      {selectedRiddleWallet && (
                        <Alert>
                          <Wallet className="h-4 w-4" />
                          <AlertDescription>
                            Selected: {typeof selectedRiddleWallet === 'object' ? (selectedRiddleWallet as any).handle : selectedRiddleWallet}
                            <br />
                            XRP Address: {typeof selectedRiddleWallet === 'object' && (selectedRiddleWallet as any).xrpAddress ? (selectedRiddleWallet as any).xrpAddress.slice(0, 8) + '...' + (selectedRiddleWallet as any).xrpAddress.slice(-8) : 'N/A'}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          No Riddle wallets found. Please login to your Riddle wallet first.
                        </AlertDescription>
                      </Alert>
                      <Button 
                        onClick={() => window.location.href = '/wallet-login'} 
                        variant="outline" 
                        className="w-full"
                      >
                        Login to Riddle Wallet
                      </Button>
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Label htmlFor="password">Wallet Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={riddlePassword}
                      onChange={(e) => setRiddlePassword(e.target.value)}
                      placeholder="Enter wallet password for transaction signing"
                    />
                  </div>
                </div>
              )}

              {/* Linked Wallet Selection */}
              {walletType === 'linked' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="linkedWallet">Select Linked Wallet</Label>
                    {linkedWallets.length > 0 ? (
                      <Select value={selectedLinkedWallet} onValueChange={setSelectedLinkedWallet}>
                        <SelectTrigger data-testid="select-linked-wallet">
                          <SelectValue placeholder="Choose a linked wallet" />
                        </SelectTrigger>
                        <SelectContent>
                          {linkedWallets.filter((wallet: any) => {
                            // Filter by destination chain compatibility
                            if (toChain === 'RDL') {
                              return wallet.address && wallet.address.startsWith('r') && wallet.address.length >= 25;
                            } else {
                              const destinationType = getChainType(toChain);
                              return wallet.chain === destinationType || 
                                     (destinationType === 'EVM' && wallet.address && wallet.address.startsWith('0x')) ||
                                     (destinationType === 'XRPL' && wallet.address && wallet.address.startsWith('r')) ||
                                     (destinationType === 'SOLANA' && wallet.address && wallet.address.length >= 32);
                            }
                          }).map((wallet) => (
                            <SelectItem key={wallet.id} value={String(wallet.id)}>
                              <div className="flex items-center space-x-2">
                                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                                <div>
                                  <div className="font-medium">
                                    {wallet.wallet_label || wallet.wallet_type || 'Linked Wallet'}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {wallet.chain?.toUpperCase()} • {wallet.address?.slice(0, 8)}...{wallet.address?.slice(-6)}
                                  </div>
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          No compatible linked wallets for {toChain} destination. 
                          {toChain === 'RDL' ? 'Link an XRPL wallet to receive RDL tokens.' : `Link a ${getChainType(toChain)} wallet for this destination.`}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </div>
              )}

              {/* Destination Address */}
              <div className="space-y-2">
                <Label htmlFor="destination">Destination Address</Label>
                <Input
                  id="destination"
                  value={destinationAddress}
                  onChange={(e) => setDestinationAddress(e.target.value)}
                  placeholder={toChain === 'RDL' ? 'rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX' : 'Destination address'}
                  readOnly={walletType === 'walletconnect' && walletConnected}
                  data-testid="input-destination-address"
                />
              </div>

              {/* Create Bridge Button */}
              <Button
                onClick={handleCreateBridge}
                disabled={createBridge.isPending || 
                         (walletType === 'walletconnect' && !walletConnected) ||
                         (walletType === 'xaman' && !xamanConnected) ||
                         (walletType === 'joey' && !joeyConnected) ||
                         (walletType === 'riddle' && !selectedRiddleWallet) ||
                         (walletType === 'linked' && !selectedLinkedWallet)}
                className="w-full"
                data-testid="button-create-bridge"
              >
                {createBridge.isPending ? 'Creating Bridge...' : 'Create Bridge'}
              </Button>
            </>
          )}

          {/* Step 2: Execute Bridge */}
          {step === 2 && bridgePayload && (
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Bridge payload created successfully. Review and execute the transaction.
                </AlertDescription>
              </Alert>

              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-2">
                <div><strong>Transaction ID:</strong> {bridgePayload.transactionId}</div>
                <div><strong>Amount:</strong> {bridgePayload.amount} {fromChain}</div>
                <div><strong>Estimated Output:</strong> {bridgePayload.estimatedOutput} {toChain}</div>
                <div><strong>Bridge Fee:</strong> {bridgePayload.bridgeFee} {fromChain}</div>
                <div><strong>Instructions:</strong> {bridgePayload.instructions}</div>
              </div>

              {/* Bridge Status Display */}
              <div className="flex items-center justify-center space-x-3 py-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <div className="flex items-center space-x-1">
                  <div className={`w-2 h-2 rounded-full ${bridgeStatus === 'creating' ? 'bg-blue-500 animate-pulse' : 'bg-blue-600'}`}></div>
                  <span className="text-xs font-medium">Create</span>
                </div>
                <div className="w-4 h-px bg-gray-300"></div>
                <div className="flex items-center space-x-1">
                  <div className={`w-2 h-2 rounded-full ${bridgeStatus === 'executing' ? 'bg-blue-500 animate-pulse' : 
                    bridgeStatus === 'completing' || bridgeStatus === 'completed' ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
                  <span className="text-xs font-medium">Payment</span>
                </div>
                <div className="w-4 h-px bg-gray-300"></div>
                <div className="flex items-center space-x-1">
                  <div className={`w-2 h-2 rounded-full ${bridgeStatus === 'completing' ? 'bg-blue-500 animate-pulse' : 
                    bridgeStatus === 'completed' ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
                  <span className="text-xs font-medium">Complete</span>
                </div>
              </div>

              <Button
                onClick={handleExecuteBridge}
                disabled={bridgeStatus === 'executing' || bridgeStatus === 'completing'}
                className="w-full"
              >
                {bridgeStatus === 'executing' ? 'Processing Payment...' : 
                 bridgeStatus === 'completing' ? 'Distributing RDL Tokens...' :
                 'Execute Bridge Transaction'}
              </Button>
            </div>
          )}

          {/* Step 3: Bridge Complete */}
          {step === 3 && completionResult && (
            <div className="space-y-6">
              <div className="text-center space-y-4 p-6 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
                <div className="text-green-600 dark:text-green-400 text-2xl font-bold">
                  ✅ Bridge Complete!
                </div>
                <div className="text-green-800 dark:text-green-200">
                  Successfully distributed <strong>{completionResult.amount} RDL</strong> tokens
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Sent to: {destinationAddress?.slice(0, 12)}...{destinationAddress?.slice(-12)}
                </div>
              </div>
              
              {/* Transaction Details */}
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-3">
                <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">Transaction Hash:</div>
                <div className="bg-white dark:bg-gray-900 p-3 rounded border font-mono text-xs break-all">
                  {completionResult.txHash}
                </div>
                {completionResult.explorerUrl && (
                  <a 
                    href={completionResult.explorerUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:underline text-sm"
                  >
                    View on Explorer ↗
                  </a>
                )}
              </div>
              
              <div className="flex gap-3">
                <Button onClick={() => {
                  setStep(1);
                  setBridgePayload(null);
                  setBridgeStatus('idle');
                  setCompletionResult(null);
                  setAmount('0.000001');
                  if (xamanAddress) {
                    setDestinationAddress(xamanAddress);
                  } else if (joeyAddress) {
                    setDestinationAddress(joeyAddress);
                  }
                }} variant="outline" className="flex-1">
                  Create Another Bridge
                </Button>
                
                <Button onClick={() => {
                  window.location.href = '/riddle-wallet';
                }} className="flex-1">
                  View Wallet
                </Button>
              </div>
            </div>
          )}
            </CardContent>
          </Card>

          {/* Transaction Details Dropdown */}
          {bridgePayload && (
            <TransactionDetailsDropdown
              transaction={{
                transactionId: bridgePayload.transactionId,
                fromToken: fromChain,
                toToken: toChain,
                amount: amount,
                destinationAddress: destinationAddress,
                status: bridgeStatus as 'executing' | 'completed' | 'creating' | 'failed',
                inputTxHash: bridgePayload.payload?.txHash || undefined,
                outputTxHash: completionResult?.txHash || undefined,
                explorerUrl: completionResult?.explorerUrl || undefined,
                note: completionResult?.note || bridgePayload.instructions,
                timestamp: new Date().toISOString()
              }}
              isVisible={showTransactionDetails}
              onToggle={() => setShowTransactionDetails(!showTransactionDetails)}
            />
          )}
        </div>
      </div>

      <XamanConnectQR
        isOpen={showXamanConnect}
        onClose={() => setShowXamanConnect(false)}
        onSuccess={handleXamanConnectSuccess}
      />

      {bridgePayload && showXamanPayment && (
        <XamanPaymentModal
          isOpen={showXamanPayment}
          onClose={() => setShowXamanPayment(false)}
          onPaymentSuccess={(data) => handleXamanPaymentSuccess(data.txHash || data.transactionId)}
          defaultAmount={amount}
          defaultCurrency={fromChain}
          defaultDestination={bridgePayload.payload?.address || destinationAddress}
          defaultMemo={`BRIDGE-${bridgePayload.transactionId}`}
        />
      )}

      <BridgeTransactionModal
        open={showTransactionModal}
        onClose={() => {
          setShowTransactionModal(false);
          setTransactionError(undefined);
        }}
        status={transactionModalStatus}
        transactionHash={transactionHash}
        errorMessage={transactionError}
        fromChain={fromChain}
        toChain={toChain}
        amount={amount}
        fromAddress={riddleWallets.find(w => w.handle === selectedRiddleWallet || w.id === selectedRiddleWallet)?.btcAddress}
        toAddress={destinationAddress}
      />
    </>
  );
}
