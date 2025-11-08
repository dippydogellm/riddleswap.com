import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Clock, AlertCircle, Hash, Activity, Shield } from 'lucide-react';

interface TransactionVerificationProps {
  transactionHash: string;
  chain: string;
  fromToken: string;
  toToken: string;
  amount: string;
  onVerificationComplete?: (verified: boolean) => void;
}

interface VerificationStatus {
  memoVerified: boolean;
  blockConfirmations: number;
  requiredConfirmations: number;
  isComplete: boolean;
  error?: string;
}

export default function TransactionVerification({ 
  transactionHash, 
  chain, 
  fromToken, 
  toToken, 
  amount,
  onVerificationComplete 
}: TransactionVerificationProps) {
  const [status, setStatus] = useState<VerificationStatus>({
    memoVerified: false,
    blockConfirmations: 0,
    requiredConfirmations: getRequiredConfirmations(chain),
    isComplete: false
  });
  const [isChecking, setIsChecking] = useState(false);

  function getRequiredConfirmations(chain: string): number {
    switch (chain.toLowerCase()) {
      case 'xrp':
      case 'xrpl':
        return 1; // XRPL transactions are final immediately
      case 'eth':
      case 'ethereum':
        return 12; // Ethereum requires 12 confirmations
      case 'btc':
      case 'bitcoin':
        return 6; // Bitcoin requires 6 confirmations
      case 'sol':
      case 'solana':
        return 32; // Solana requires 32 confirmations
      case 'bnb':
      case 'bsc':
        return 3; // BSC requires 3 confirmations
      case 'base':
        return 3; // Base requires 3 confirmations
      case 'matic':
      case 'polygon':
        return 3; // Polygon requires 3 confirmations
      default:
        return 6; // Default to 6 confirmations
    }
  }

  const checkTransactionStatus = async () => {
    setIsChecking(true);
    try {
      const response = await fetch('/api/verify-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionHash,
          chain,
          fromToken,
          toToken
        })
      });

      const result = await response.json() as any;
      
      setStatus({
        memoVerified: result.memoVerified || false,
        blockConfirmations: result.blockConfirmations || 0,
        requiredConfirmations: getRequiredConfirmations(chain),
        isComplete: result.isComplete || false,
        error: result.error
      });

      if (result.isComplete && onVerificationComplete) {
        onVerificationComplete(true);
      }
    } catch (error) {
      console.error('Transaction verification failed:', error);
      setStatus(prev => ({ 
        ...prev, 
        error: 'Failed to verify transaction' 
      }));
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    if (transactionHash) {
      checkTransactionStatus();
      
      // Set up polling for incomplete transactions
      const interval = setInterval(() => {
        if (!status.isComplete) {
          checkTransactionStatus();
        }
      }, 30000); // Check every 30 seconds

      return () => clearInterval(interval);
    }
  }, [transactionHash]);

  const getStatusIcon = () => {
    if (status.error) {
      return <AlertCircle className="h-5 w-5 text-red-500" />;
    }
    if (status.isComplete) {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
    if (isChecking) {
      return <Activity className="h-5 w-5 text-blue-500 animate-spin" />;
    }
    return <Clock className="h-5 w-5 text-yellow-500" />;
  };

  const getStatusText = () => {
    if (status.error) return 'Verification Failed';
    if (status.isComplete) return 'Verified';
    if (isChecking) return 'Checking...';
    return 'Pending Verification';
  };

  const getProgressPercentage = () => {
    if (status.error) return 0;
    if (status.isComplete) return 100;
    
    let progress = 0;
    
    // Memo verification (30% of progress)
    if (status.memoVerified) {
      progress += 30;
    }
    
    // Block confirmations (70% of progress)
    const confirmationProgress = (status.blockConfirmations / status.requiredConfirmations) * 70;
    progress += Math.min(confirmationProgress, 70);
    
    return Math.min(progress, 100);
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            {getStatusIcon()}
            Transaction Verification
          </CardTitle>
          <Badge variant={status.isComplete ? 'default' : 'secondary'}>
            {getStatusText()}
          </Badge>
        </div>
        <CardDescription>
          Verifying {fromToken} → {toToken} transaction on {chain.toUpperCase()}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Transaction Hash */}
        <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
          <Hash className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-mono">
            {transactionHash.slice(0, 8)}...{transactionHash.slice(-8)}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Verification Progress</span>
            <span>{Math.round(getProgressPercentage())}%</span>
          </div>
          <Progress value={getProgressPercentage()} className="w-full" />
        </div>

        {/* Verification Steps */}
        <div className="space-y-3">
          {/* Memo Verification */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <Shield className="h-4 w-4 text-blue-500" />
              <div>
                <div className="font-medium text-sm">Memo Verification</div>
                <div className="text-xs text-muted-foreground">
                  Transaction ID match in memo
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {status.memoVerified ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <Clock className="h-4 w-4 text-yellow-500" />
              )}
            </div>
          </div>

          {/* Block Confirmations */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <Activity className="h-4 w-4 text-purple-500" />
              <div>
                <div className="font-medium text-sm">Block Confirmations</div>
                <div className="text-xs text-muted-foreground">
                  {status.blockConfirmations}/{status.requiredConfirmations} confirmations
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {status.blockConfirmations >= status.requiredConfirmations ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <Clock className="h-4 w-4 text-yellow-500" />
              )}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {status.error && (
          <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="text-sm text-red-700 dark:text-red-300">
              {status.error}
            </div>
          </div>
        )}

        {/* Manual Refresh Button */}
        <Button 
          onClick={checkTransactionStatus}
          disabled={isChecking}
          variant="outline"
          className="w-full"
        >
          {isChecking ? 'Checking...' : 'Refresh Status'}
        </Button>
      </CardContent>
    </Card>
  );
}
