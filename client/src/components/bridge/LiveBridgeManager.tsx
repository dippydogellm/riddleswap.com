// Live Bridge Manager - Real mainnet bridge interface
import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface LiveBridgeStep1Data {
  success: boolean;
  transactionId: string;
  bankWalletAddress: string;
  amount: string;
  estimatedOutput: string;
  bridgeFee: string;
  expectedMemo: string;
  instructions: string;
  message: string;
}

interface LiveBridgeStep3Data {
  success: boolean;
  txHash: string;
  amount: string;
  message: string;
  explorerUrl?: string;
}

const SUPPORTED_CHAINS = ['XRP', 'ETH', 'SOL', 'BTC', 'BNB', 'BASE', 'MATIC'];

export function LiveBridgeManager() {
  const [step, setStep] = useState(1);
  const [fromToken, setFromToken] = useState('XRP');
  const [toToken, setToToken] = useState('RDL');
  const [amount, setAmount] = useState('0.000001');
  const [fromAddress, setFromAddress] = useState('');
  const [toAddress, setToAddress] = useState('');
  const [bridgeData, setBridgeData] = useState<LiveBridgeStep1Data | null>(null);
  const [userTxHash, setUserTxHash] = useState('');
  const [step3Result, setStep3Result] = useState<LiveBridgeStep3Data | null>(null);

  // Live Bridge Step 1: Create mainnet bridge
  const createLiveBridge = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('/api/bridge/step1', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: (data: LiveBridgeStep1Data) => {
      if (data.success) {
        setBridgeData(data);
        setStep(2);
      }
    }
  });

  // Live Bridge Step 2: Verify mainnet transaction  
  const verifyLiveTransaction = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('/api/bridge/verify-transaction', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: (data: any) => {
      if (data.success && data.verified) {
        setStep(3);
      }
    }
  });

  // Live Bridge Step 3: Execute mainnet RDL distribution
  const completeLiveDistribution = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('/api/bridge/step3', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: (data: LiveBridgeStep3Data) => {
      if (data.success) {
        setStep3Result(data);
        setStep(4);
      }
    }
  });

  const handleStep1Submit = () => {
    createLiveBridge.mutate({
      fromToken,
      toToken,
      amount,
      fromAddress,
      toAddress
    });
  };

  const handleStep2Submit = () => {
    if (!bridgeData || !userTxHash) return;
    
    verifyLiveTransaction.mutate({
      transactionId: bridgeData.transactionId,
      txHash: userTxHash,
      fromToken,
      toToken
    });
  };

  const handleStep3Submit = () => {
    if (!bridgeData) return;
    
    completeLiveDistribution.mutate({
      transactionId: bridgeData.transactionId,
      fromToken,
      toToken,
      destinationAddress: toAddress,
      step1Hash: userTxHash
    });
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <h1 className="text-3xl font-bold text-center mb-8 text-gray-900 dark:text-white">
        Live Mainnet Bridge
      </h1>

      {/* Step Indicator */}
      <div className="flex justify-center mb-8">
        <div className="flex items-center space-x-4">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= s 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
              }`}>
                {s}
              </div>
              {s < 4 && <div className="w-12 h-1 bg-gray-300 dark:bg-gray-600" />}
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Setup Bridge */}
      {step === 1 && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-center">Setup Live Bridge</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">From Token</label>
              <select
                value={fromToken}
                onChange={(e) => setFromToken(e.target.value)}
                className="w-full p-3 border rounded-lg bg-white dark:bg-gray-700"
              >
                {SUPPORTED_CHAINS.filter(t => t !== toToken).map(token => (
                  <option key={token} value={token}>{token}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">To Token</label>
              <select
                value={toToken}
                onChange={(e) => setToToken(e.target.value)}
                className="w-full p-3 border rounded-lg bg-white dark:bg-gray-700"
              >
                {SUPPORTED_CHAINS.filter(t => t !== fromToken).map(token => (
                  <option key={token} value={token}>{token}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Amount</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full p-3 border rounded-lg bg-white dark:bg-gray-700"
              step="0.000001"
              min="0.000001"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Your {fromToken} Address</label>
            <input
              type="text"
              value={fromAddress}
              onChange={(e) => setFromAddress(e.target.value)}
              className="w-full p-3 border rounded-lg bg-white dark:bg-gray-700"
              placeholder={`Your ${fromToken} wallet address`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Destination {toToken} Address</label>
            <input
              type="text"
              value={toAddress}
              onChange={(e) => setToAddress(e.target.value)}
              className="w-full p-3 border rounded-lg bg-white dark:bg-gray-700"
              placeholder={`Destination ${toToken} wallet address`}
            />
          </div>

          <button
            onClick={handleStep1Submit}
            disabled={createLiveBridge.isPending || !fromAddress || !toAddress}
            className="w-full py-3 px-6 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {createLiveBridge.isPending ? 'Creating Live Bridge...' : 'Create Live Bridge'}
          </button>

          {createLiveBridge.error && (
            <div className="p-4 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-lg">
              Error: {createLiveBridge.error.message}
            </div>
          )}
        </div>
      )}

      {/* Step 2: Send Transaction */}
      {step === 2 && bridgeData && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-center">Send Mainnet Transaction</h2>
          
          <div className="p-4 bg-blue-50 dark:bg-blue-900 rounded-lg">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Live Instructions:</h3>
            <p className="text-blue-800 dark:text-blue-200">{bridgeData.instructions}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Bank Address:</span>
              <div className="break-all bg-gray-100 dark:bg-gray-700 p-2 rounded mt-1">
                {bridgeData.bankWalletAddress}
              </div>
            </div>
            <div>
              <span className="font-medium">Memo/Data:</span>
              <div className="break-all bg-gray-100 dark:bg-gray-700 p-2 rounded mt-1">
                {bridgeData.expectedMemo}
              </div>
            </div>
            <div>
              <span className="font-medium">Amount:</span>
              <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded mt-1">
                {bridgeData.amount} {fromToken}
              </div>
            </div>
            <div>
              <span className="font-medium">You'll Receive:</span>
              <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded mt-1">
                {bridgeData.estimatedOutput} {toToken}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Your Transaction Hash</label>
            <input
              type="text"
              value={userTxHash}
              onChange={(e) => setUserTxHash(e.target.value)}
              className="w-full p-3 border rounded-lg bg-white dark:bg-gray-700"
              placeholder="Paste your transaction hash here"
            />
          </div>

          <button
            onClick={handleStep2Submit}
            disabled={verifyLiveTransaction.isPending || !userTxHash}
            className="w-full py-3 px-6 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {verifyLiveTransaction.isPending ? 'Verifying Transaction...' : 'Verify Transaction'}
          </button>

          {verifyLiveTransaction.error && (
            <div className="p-4 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-lg">
              Verification Error: {verifyLiveTransaction.error.message}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Complete Distribution */}
      {step === 3 && bridgeData && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-center">Complete Live Distribution</h2>
          
          <div className="p-4 bg-green-50 dark:bg-green-900 rounded-lg">
            <p className="text-green-800 dark:text-green-200">
              ✅ Transaction verified! Ready to execute mainnet RDL distribution.
            </p>
          </div>

          <button
            onClick={handleStep3Submit}
            disabled={completeLiveDistribution.isPending}
            className="w-full py-3 px-6 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50"
          >
            {completeLiveDistribution.isPending ? 'Executing Mainnet Distribution...' : 'Execute RDL Distribution'}
          </button>

          {completeLiveDistribution.error && (
            <div className="p-4 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-lg">
              Distribution Error: {completeLiveDistribution.error.message}
            </div>
          )}
        </div>
      )}

      {/* Step 4: Success */}
      {step === 4 && step3Result && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-center text-green-600">Bridge Complete!</h2>
          
          <div className="p-6 bg-green-50 dark:bg-green-900 rounded-lg text-center">
            <div className="text-green-800 dark:text-green-200 space-y-2">
              <p className="text-lg font-semibold">✅ Mainnet Transaction Successful!</p>
              <p>{step3Result.message}</p>
              <div className="bg-green-100 dark:bg-green-800 p-3 rounded mt-4">
                <p className="font-medium">Transaction Hash:</p>
                <p className="break-all text-sm">{step3Result.txHash}</p>
              </div>
              {step3Result.explorerUrl && (
                <a
                  href={step3Result.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  View on Explorer
                </a>
              )}
            </div>
          </div>

          <button
            onClick={() => {
              setStep(1);
              setBridgeData(null);
              setStep3Result(null);
              setUserTxHash('');
            }}
            className="w-full py-3 px-6 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700"
          >
            Start New Bridge
          </button>
        </div>
      )}
    </div>
  );
}
