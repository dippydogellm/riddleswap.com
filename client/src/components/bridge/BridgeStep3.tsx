// Bridge Step 3 Component - Final RDL distribution
import React from 'react';
import { useLocation } from 'wouter';
import { ExternalLink, History, Copy, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface BridgeStep3Props {
  isProcessing: boolean;
  txHash?: string;
  amount?: string;
  destinationAddress: string;
  destinationToken?: string;
  onComplete: () => void;
  // Enhanced details
  fromToken?: string;
  fromAmount?: string;
  exchangeRate?: string;
  platformFee?: string;
  usdValue?: string;
  explorerUrl?: string;
}

export function BridgeStep3({
  isProcessing,
  txHash,
  amount,
  destinationAddress,
  destinationToken = 'RDL',
  onComplete,
  fromToken,
  fromAmount,
  exchangeRate,
  platformFee,
  usdValue,
  explorerUrl
}: BridgeStep3Props) {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: `${label} copied to clipboard`,
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Unable to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const navigateToTransactions = () => {
    navigate('/transactions');
  };
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-center">Receive {destinationToken}</h2>
      
      {isProcessing ? (
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-lg">Processing {destinationToken} distribution...</p>
          <p className="text-sm text-gray-600">This may take a few moments</p>
        </div>
      ) : txHash ? (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-6">
          {/* Success Header */}
          <div className="flex items-center justify-center mb-4">
            <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400 mr-2" />
            <h3 className="text-xl font-bold text-green-800 dark:text-green-200">
              Bridge Complete!
            </h3>
          </div>
          
          {/* Transaction Summary */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-4 border">
            <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">Transaction Summary</h4>
            
            {fromToken && fromAmount && (
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">From</p>
                  <p className="font-semibold">{fromAmount} {fromToken}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">To</p>
                  <p className="font-semibold">{amount} {destinationToken}</p>
                </div>
              </div>
            )}
            
            {exchangeRate && (
              <div className="mb-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Exchange Rate</p>
                <p className="text-sm">{exchangeRate}</p>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              {platformFee && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Platform Fee</p>
                  <p className="text-sm">{platformFee}</p>
                </div>
              )}
              {usdValue && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">USD Value</p>
                  <p className="text-sm font-medium">${usdValue}</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Destination Address */}
          <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded border mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Destination Address:</p>
              <button
                onClick={() => copyToClipboard(destinationAddress, 'Destination address')}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
            <p className="font-mono text-sm break-all">{destinationAddress}</p>
          </div>
          
          {/* Transaction Hash */}
          <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded border mb-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Transaction Hash:</p>
              <div className="flex gap-2">
                <button
                  onClick={() => copyToClipboard(txHash, 'Transaction hash')}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                >
                  <Copy className="h-4 w-4" />
                </button>
                {explorerUrl && (
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>
            <p className="font-mono text-sm break-all">{txHash}</p>
          </div>
          
          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={navigateToTransactions}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 px-6 rounded-lg font-medium transition-colors flex items-center justify-center"
            >
              <History className="h-4 w-4 mr-2" />
              View Recent Transactions
            </button>
            
            <button
              onClick={onComplete}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-lg font-medium transition-colors"
            >
              Start New Bridge
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-lg mb-4">Ready to distribute {destinationToken}</p>
          <button
            onClick={onComplete}
            className="bg-purple-600 hover:bg-purple-700 text-white py-3 px-6 rounded-lg font-medium transition-colors"
          >
            Execute {destinationToken} Distribution
          </button>
        </div>
      )}
    </div>
  );
}
