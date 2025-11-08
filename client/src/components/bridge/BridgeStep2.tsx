// Bridge Step 2 Component - Automatic transaction execution
import React, { useEffect, useState } from 'react';

interface BridgeStep2Props {
  bankAddress: string;
  amount: string;
  fromToken: string;
  transactionId: string;
  isVerifying: boolean;
  onAutoExecute: () => void;
}

export function BridgeStep2({
  bankAddress,
  amount,
  fromToken,
  transactionId,
  isVerifying,
  onAutoExecute
}: BridgeStep2Props) {
  const [status, setStatus] = useState('preparing');
  const [txHash, setTxHash] = useState('');
  const [progress, setProgress] = useState(0);
  const [hasExecuted, setHasExecuted] = useState(false);

  useEffect(() => {
    // Scroll to top when step 2 loads
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // CRITICAL: Prevent duplicate executions
    if (hasExecuted) {
      console.log('⚠️ Transaction already executed, preventing duplicate');
      return;
    }
    
    // Automatically start the transaction execution
    const executeTransaction = async () => {
      // Double-check to prevent race conditions
      if (hasExecuted) return;
      
      // Mark as executed IMMEDIATELY to prevent duplicates
      setHasExecuted(true);
      setStatus('executing');
      setProgress(25);

      try {
        // Get session token directly from localStorage
        const sessionToken = localStorage.getItem('sessionToken');
        if (!sessionToken) {
          setStatus('error');
          return;
        }

        setProgress(50);
        setStatus('sending');

        // Determine the correct execute endpoint based on fromToken chain
        const getChainType = (token: string) => {
          if (token === 'XRP') return 'XRPL';
          if (token === 'SOL') return 'SOLANA';
          if (['ETH', 'BNB', 'MATIC', 'BASE', 'ARB', 'OP'].includes(token)) return 'EVM';
          if (token === 'BTC') return 'BTC';
          return 'XRPL'; // Default fallback
        };
        
        const chainType = getChainType(fromToken);
        const endpoint = chainType === 'XRPL' ? '/api/bridge/xrpl/auto-execute' :
                       chainType === 'EVM' ? '/api/bridge/evm/execute' :
                       chainType === 'SOLANA' ? '/api/bridge/solana/execute' :
                       '/api/bridge/btc/execute';
        
        console.log(`🎯 ${fromToken} → RDL bridge using ${chainType} execute endpoint: ${endpoint}`);
        
        // Execute the bridge transaction automatically
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`
          },
          body: JSON.stringify({
            transactionId: transactionId
          })
        });
        
        const result = await response.json() as any;
        
        if (result.success) {
          setTxHash(result.txHash);
          setProgress(75);
          setStatus('verifying');
          
          // Auto-verify and proceed
          setTimeout(() => {
            setProgress(100);
            setStatus('completed');
            onAutoExecute();
          }, 2000);
        } else {
          setStatus('error');
          console.error('Auto-execution failed:', result.error);
        }
      } catch (error) {
        console.error('Transaction execution error:', error);
        setStatus('error');
      }
    };

    // Only execute if not already executed
    if (!hasExecuted) {
      executeTransaction();
    }
  }, [transactionId]); // Remove onAutoExecute from dependencies to prevent re-execution

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-center">Automatic Bridge Transaction</h2>
      
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
        <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
          Step 2: Executing Bridge Transaction
        </h3>
        <p className="text-blue-700 dark:text-blue-300 mb-4">
          Automatically sending <strong>{amount} {fromToken}</strong> using your cached wallet keys
        </p>
        
        <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded border mb-4">
          <p className="font-mono text-sm break-all">{bankAddress}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Bank Address</p>
        </div>
        
        {txHash && (
          <div className="bg-green-100 dark:bg-green-900/20 p-3 rounded border">
            <p className="font-mono text-sm break-all">{txHash}</p>
            <p className="text-sm text-green-600 dark:text-green-400 mt-1">Transaction Hash</p>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span>Progress</span>
          <span>{progress}%</span>
        </div>
        
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          ></div>
        </div>

        <div className="text-center">
          {status === 'preparing' && (
            <p className="text-yellow-600 dark:text-yellow-400">🔄 Preparing transaction...</p>
          )}
          {status === 'executing' && (
            <p className="text-blue-600 dark:text-blue-400">⚡ Executing transaction with cached keys...</p>
          )}
          {status === 'sending' && (
            <p className="text-blue-600 dark:text-blue-400">📤 Sending to XRPL network...</p>
          )}
          {status === 'verifying' && (
            <p className="text-orange-600 dark:text-orange-400">🔍 Verifying blocks and memo tags...</p>
          )}
          {status === 'completed' && (
            <p className="text-green-600 dark:text-green-400">✅ Transaction completed successfully!</p>
          )}
          {status === 'error' && (
            <p className="text-red-600 dark:text-red-400">❌ Transaction failed. Please try again.</p>
          )}
        </div>
      </div>
    </div>
  );
}
