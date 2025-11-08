// Bridge Verification Modal - Separate component for transaction verification

import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';

interface BridgeVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  txHash: string;
  fromToken: string;
  toToken: string;
  amount: string;
  onVerified: () => void;
}

export function BridgeVerificationModal({
  isOpen,
  onClose,
  txHash,
  fromToken,
  toToken,
  amount,
  onVerified
}: BridgeVerificationModalProps) {
  const [verificationStatus, setVerificationStatus] = useState<'verifying' | 'verified' | 'failed'>('verifying');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('Initializing verification...');

  useEffect(() => {
    if (!isOpen || !txHash) return;

    let progressInterval: NodeJS.Timeout;
    let verificationTimeout: NodeJS.Timeout;

    const startVerification = async () => {
      setVerificationStatus('verifying');
      setProgress(0);
      setMessage('Verifying transaction on blockchain...');

      // Simulate progress
      progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev;
          return prev + 10;
        });
      }, 500);

      // Perform actual verification
      verificationTimeout = setTimeout(async () => {
        try {
          const response = await fetch('/api/bridge/verify-transaction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              transactionHash: txHash,
              expectedMemo: txHash // Use txHash as memo for verification
            })
          });

          const result = await response.json() as any;
          
          if (result.verified) {
            setProgress(100);
            setVerificationStatus('verified');
            setMessage('Transaction verified successfully!');
            
            // Auto-proceed after 2 seconds
            setTimeout(() => {
              onVerified();
              onClose();
            }, 2000);
          } else {
            setVerificationStatus('failed');
            setMessage(result.message || 'Verification failed');
          }
        } catch (error) {
          setVerificationStatus('failed');
          setMessage('Unable to verify transaction');
        }
      }, 3000);
    };

    startVerification();

    return () => {
      clearInterval(progressInterval);
      clearTimeout(verificationTimeout);
    };
  }, [isOpen, txHash, onVerified, onClose]);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {verificationStatus === 'verifying' && (
              <>
                <Clock className="h-5 w-5 animate-spin" />
                Verifying Bridge Transaction
              </>
            )}
            {verificationStatus === 'verified' && (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                Transaction Verified
              </>
            )}
            {verificationStatus === 'failed' && (
              <>
                <AlertCircle className="h-5 w-5 text-red-500" />
                Verification Failed
              </>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p>Bridging {amount} {fromToken} → {toToken}</p>
            <p className="mt-1 font-mono text-xs truncate">
              Hash: {txHash?.slice(0, 10)}...{txHash?.slice(-8)}
            </p>
          </div>

          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-center text-muted-foreground">
              {message}
            </p>
          </div>

          {verificationStatus === 'failed' && (
            <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">
                {message}
              </p>
              <p className="text-xs mt-1 text-red-500 dark:text-red-300">
                Please try again or contact support if the issue persists.
              </p>
            </div>
          )}

          {verificationStatus === 'verified' && (
            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
              <p className="text-sm text-green-600 dark:text-green-400">
                Your transaction has been confirmed on the blockchain.
              </p>
              <p className="text-xs mt-1 text-green-500 dark:text-green-300">
                Processing final steps...
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
