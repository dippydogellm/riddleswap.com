// Bridge Main Component - Orchestrates the 3-step bridge process
import React, { useState, useEffect } from 'react';
import { BridgeStep1 } from './BridgeStep1';
import { BridgeStep2 } from './BridgeStep2';
import { BridgeStep3 } from './BridgeStep3';
import { SUPPORTED_TOKENS } from './constants';
import { handleBridgeAuthError } from '@/utils/sessionClear';
import { BridgeTransactionModal } from './BridgeTransactionModal';

interface BridgeState {
  currentStep: number;
  fromToken: string;
  toToken: string;
  amount: string;
  fromAddress: string;
  toAddress: string;
  transactionId?: string;
  bankAddress?: string;
  isProcessing: boolean;
  isVerifying: boolean;
  step3TxHash?: string;
  estimatedOutput?: string;
  // Transaction modal state
  showTransactionModal?: boolean;
  transactionModalStatus?: 'pending' | 'success' | 'error' | 'executing';
  transactionHash?: string;
  transactionError?: string;
}

export function BridgeMain() {
  const [state, setState] = useState<BridgeState>({
    currentStep: 1,
    fromToken: 'BTC',  // Default to BTC-from functionality
    toToken: 'XRP',    // Default to XRP-to functionality  
    amount: '0.00000001',  // 1 satoshi default
    fromAddress: '',
    toAddress: '',
    isProcessing: false,
    isVerifying: false
  });

  // Listen for session changes to refresh addresses automatically
  useEffect(() => {
    let lastSessionToken: string | null = localStorage.getItem('sessionToken');
    
    const checkSession = () => {
      const currentToken = localStorage.getItem('sessionToken');
      
      // Session changed (new login or logout)
      if (currentToken !== lastSessionToken) {
        console.log('🔄 Bridge: Session changed, refreshing addresses...');
        lastSessionToken = currentToken;
        
        // Reset addresses to trigger re-fetch
        setState(prev => ({
          ...prev,
          fromAddress: '',
          toAddress: ''
        }));
      }
    };

    // Check immediately
    checkSession();
    
    // Listen for storage events (login/logout from another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'sessionToken') {
        checkSession();
      }
    };
    
    // Listen for custom session change events
    const handleSessionChange = () => {
      checkSession();
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('riddleSessionChange', handleSessionChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('riddleSessionChange', handleSessionChange);
    };
  }, []);

  const handleStep1Submit = async () => {
    setState(prev => ({ ...prev, isProcessing: true }));
    
    // Get session token from multiple storage locations
    let sessionToken = localStorage.getItem('sessionToken');
    
    // Also check sessionStorage for walletSession (used by login)
    if (!sessionToken) {
      try {
        const sessionStorageData = sessionStorage.getItem('walletSession');
        if (sessionStorageData) {
          const parsed = JSON.parse(sessionStorageData);
          sessionToken = parsed.sessionToken;
          console.log('🔑 [BRIDGE] Found session token in walletSession storage');
        }
      } catch (error) {
        console.log('❌ [BRIDGE] Failed to parse session data:', error);
      }
    } else {
      console.log('🔑 [BRIDGE] Found session token in localStorage');
    }
    
    // Also try riddle_wallet_session as fallback
    if (!sessionToken) {
      try {
        const sessionStorageData = sessionStorage.getItem('riddle_wallet_session');
        if (sessionStorageData) {
          const parsed = JSON.parse(sessionStorageData);
          sessionToken = parsed.sessionToken;
          console.log('🔑 [BRIDGE] Found session token in riddle_wallet_session storage');
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }
    
    if (!sessionToken) {
      console.log('❌ [BRIDGE] No session token found in any storage location');
      alert('Please login to your Riddle wallet first');
      setState(prev => ({ ...prev, isProcessing: false }));
      return;
    }
    
    console.log('🔐 [BRIDGE] Using session token:', sessionToken?.slice(0, 12) + '...');
    
    // Verify session is still valid before proceeding
    try {
      const sessionCheck = await fetch('/api/riddle-wallet/session', {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });
      
      if (!sessionCheck.ok) {
        alert('Session expired. Please login to your Riddle wallet again');
        setState(prev => ({ ...prev, isProcessing: false }));
        return;
      }
    } catch (error) {
      console.error('Session validation failed:', error);
      alert('Please login to your Riddle wallet first');
      setState(prev => ({ ...prev, isProcessing: false }));
      return;
    }
    
    // Determine the correct create endpoint based on fromToken chain
    const getChainType = (token: string) => {
      if (token === 'XRP') return 'XRPL';
      if (token === 'SOL') return 'SOLANA';
      if (['ETH', 'BNB', 'MATIC', 'BASE', 'ARB', 'OP'].includes(token)) return 'EVM';
      if (token === 'BTC') return 'BTC';
      return 'XRPL'; // Default fallback
    };
    
    const chainType = getChainType(state.fromToken);
    const createEndpoint = chainType === 'XRPL' ? '/api/bridge/xrpl/create' :
                          chainType === 'SOLANA' ? '/api/bridge/solana/create' :
                          chainType === 'EVM' ? '/api/bridge/evm/create' :
                          '/api/bridge/btc/create';
    
    console.log(`🎯 ${state.fromToken} → ${state.toToken} bridge using ${chainType} create endpoint: ${createEndpoint}`);
    
    try {
      const response = await fetch(createEndpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          fromToken: state.fromToken,
          toToken: state.toToken,
          amount: state.amount,
          destinationAddress: state.toAddress,
          walletType: 'riddle'
        })
      });
      
      // Check for session expiry or missing cached keys
      if (response.status === 401 || response.status === 403) {
        console.log('🔓 Session expired or missing cached keys - redirecting to login');
        
        // Clear all session data
        localStorage.removeItem('sessionToken');
        sessionStorage.removeItem('riddle_wallet_session');
        
        // Alert user about the issue
        alert('Your session has expired. Please log in again to continue using the bridge.');
        window.location.href = '/wallet-login';
        return;
      }

      const result = await response.json() as any;
      
      if (result.success) {
        setState(prev => ({
          ...prev,
          currentStep: 2,
          transactionId: result.transactionId,
          bankAddress: result.payload?.Destination || result.bankWalletAddress,
          estimatedOutput: result.estimatedOutput,
          isProcessing: false,
          showTransactionModal: true,
          transactionModalStatus: 'executing',
          transactionHash: result.transactionId
        }));
      } else {
        // Check if error indicates missing cached keys
        if (result.error && (result.error.includes('login again') || result.error.includes('Authentication required') || result.error.includes('Private keys'))) {
          console.log('🔓 Bridge requires fresh login for security');
          handleBridgeAuthError();
          return;
        }
        setState(prev => ({ 
          ...prev, 
          isProcessing: false,
          showTransactionModal: true,
          transactionModalStatus: 'error',
          transactionError: result.error || 'Failed to start bridge'
        }));
      }
    } catch (error) {
      console.error('Step 1 error:', error);
      setState(prev => ({ 
        ...prev, 
        isProcessing: false,
        showTransactionModal: true,
        transactionModalStatus: 'error',
        transactionError: 'Failed to start bridge transaction'
      }));
    }
  };

  const handleStep2AutoExecute = async () => {
    setState(prev => ({ ...prev, isVerifying: true }));
    
    // Step 2 is now fully automated - transaction already executed
    // Just proceed to step 3 automatically
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        currentStep: 3,
        isVerifying: false
      }));
      
      // Automatically execute Step 3
      handleStep3Execute();
    }, 1000);
  };

  const handleStep3Execute = async (step1Hash?: string) => {
    setState(prev => ({ ...prev, isProcessing: true }));
    
    // Get session token for authentication
    const sessionToken = localStorage.getItem('sessionToken');
    if (!sessionToken) {
      alert('Session expired. Please login to your Riddle wallet again');
      setState(prev => ({ ...prev, isProcessing: false }));
      return;
    }
    
    // Determine completion endpoint based on destination token
    const getCompletionEndpoint = (toToken: string) => {
      if (toToken === 'XRP') return '/api/bridge/xrpl/complete';
      if (toToken === 'ETH') return '/api/bridge/evm/complete';
      if (toToken === 'SOL') return '/api/bridge/solana/complete';
      return '/api/bridge/xrpl/complete'; // Default to XRPL for RDL/SRDL
    };
    
    const completionEndpoint = getCompletionEndpoint(state.toToken);
    console.log(`🎯 Completing bridge to ${state.toToken} using endpoint: ${completionEndpoint}`);
    
    try {
      const response = await fetch(completionEndpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          transactionId: state.transactionId,
          destinationAddress: state.toAddress,
          destinationToken: state.toToken
        })
      });
      
      // Check for session expiry or missing cached keys
      if (response.status === 401 || response.status === 403) {
        console.log('🔓 Session expired or missing cached keys - redirecting to login');
        localStorage.removeItem('sessionToken');
        window.location.href = '/wallet-login';
        return;
      }

      const result = await response.json() as any;
      
      if (result.success) {
        setState(prev => ({
          ...prev,
          step3TxHash: result.txHash,
          isProcessing: false,
          showTransactionModal: true,
          transactionModalStatus: 'success',
          transactionHash: result.txHash
        }));
      } else {
        // Check if error indicates missing cached keys
        if (result.error && (result.error.includes('cached keys') || result.error.includes('Authentication required'))) {
          console.log('🔓 Missing cached keys - need to re-login for private key access');
          localStorage.removeItem('sessionToken');
          window.location.href = '/wallet-login';
          return;
        }
        // Show transaction modal with error
        setState(prev => ({ 
          ...prev, 
          isProcessing: false,
          showTransactionModal: true,
          transactionModalStatus: 'error',
          transactionError: result.error || 'Transaction verification failed. Transaction pending confirmation'
        }));
      }
    } catch (error) {
      console.error('Step 3 error:', error);
      setState(prev => ({ 
        ...prev, 
        isProcessing: false,
        showTransactionModal: true,
        transactionModalStatus: 'error',
        transactionError: 'Failed to complete RDL distribution. Please try again.'
      }));
    }
  };

  const handleReset = () => {
    setState({
      currentStep: 1,
      fromToken: 'BTC',  // Reset to BTC-from default
      toToken: 'XRP',    // Reset to XRP-to default
      amount: '0.00000001',  // 1 satoshi default
      fromAddress: '',
      toAddress: '',
      isProcessing: false,
      isVerifying: false
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6">
          {/* Progress Indicator */}
          <div className="flex justify-center mb-8">
            <div className="flex space-x-4">
              {[1, 2, 3].map((step) => (
                <div
                  key={step}
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                    step === state.currentStep
                      ? 'bg-blue-600 text-white'
                      : step < state.currentStep
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {step}
                </div>
              ))}
            </div>
          </div>

          {/* Step Content */}
          {state.currentStep === 1 && (
            <BridgeStep1
              fromToken={state.fromToken}
              toToken={state.toToken}
              amount={state.amount}
              fromAddress={state.fromAddress}
              toAddress={state.toAddress}
              isProcessing={state.isProcessing}
              onFromTokenChange={(token) => setState(prev => ({ ...prev, fromToken: token }))}
              onToTokenChange={(token) => setState(prev => ({ ...prev, toToken: token }))}
              onAmountChange={(amount) => setState(prev => ({ ...prev, amount }))}
              onFromAddressChange={(address) => setState(prev => ({ ...prev, fromAddress: address }))}
              onToAddressChange={(address) => setState(prev => ({ ...prev, toAddress: address }))}
              onSubmit={handleStep1Submit}
            />
          )}

          {state.currentStep === 2 && (
            <BridgeStep2
              bankAddress={state.bankAddress || ''}
              amount={state.amount}
              fromToken={state.fromToken}
              transactionId={state.transactionId || ''}
              isVerifying={state.isVerifying}
              onAutoExecute={handleStep2AutoExecute}
            />
          )}

          {state.currentStep === 3 && (
            <BridgeStep3
              isProcessing={state.isProcessing}
              txHash={state.step3TxHash}
              amount={state.estimatedOutput}
              destinationAddress={state.toAddress}
              destinationToken={state.toToken}
              onComplete={state.step3TxHash ? handleReset : () => handleStep3Execute()}
            />
          )}
        </div>
      </div>

      {/* Transaction Status Modal */}
      <BridgeTransactionModal
        open={state.showTransactionModal || false}
        onClose={() => {
          setState(prev => ({ 
            ...prev, 
            showTransactionModal: false,
            transactionError: undefined
          }));
        }}
        status={state.transactionModalStatus || 'pending'}
        transactionHash={state.transactionHash || state.step3TxHash}
        errorMessage={state.transactionError}
        fromChain={state.fromToken}
        toChain={state.toToken}
        amount={state.amount}
        fromAddress={state.fromAddress}
        toAddress={state.toAddress}
      />
    </div>
  );
}
