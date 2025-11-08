import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, ExternalLink, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface BridgeTransactionModalProps {
  open: boolean;
  onClose: () => void;
  status: 'pending' | 'success' | 'error' | 'executing';
  transactionHash?: string;
  errorMessage?: string;
  fromChain: string;
  toChain: string;
  amount: string;
  fromAddress?: string;
  toAddress?: string;
}

const getExplorerUrl = (chain: string, txHash: string) => {
  const explorers: Record<string, string> = {
    BTC: `https://blockstream.info/tx/${txHash}`,
    ETH: `https://etherscan.io/tx/${txHash}`,
    XRP: `https://livenet.xrpl.org/transactions/${txHash}`,
    SOL: `https://solscan.io/tx/${txHash}`,
    BNB: `https://bscscan.com/tx/${txHash}`,
    MATIC: `https://polygonscan.com/tx/${txHash}`,
    BASE: `https://basescan.org/tx/${txHash}`,
  };
  return explorers[chain] || '#';
};

export function BridgeTransactionModal({
  open,
  onClose,
  status,
  transactionHash,
  errorMessage,
  fromChain,
  toChain,
  amount,
  fromAddress,
  toAddress
}: BridgeTransactionModalProps) {
  
  const getStatusIcon = () => {
    switch (status) {
      case 'pending':
      case 'executing':
        return <Loader2 className="h-12 w-12 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle2 className="h-12 w-12 text-green-500" />;
      case 'error':
        return <XCircle className="h-12 w-12 text-red-500" />;
      default:
        return <Clock className="h-12 w-12 text-gray-500" />;
    }
  };

  const getStatusTitle = () => {
    switch (status) {
      case 'pending':
        return 'Transaction Pending';
      case 'executing':
        return 'Broadcasting Transaction...';
      case 'success':
        return 'Transaction Successful!';
      case 'error':
        return 'Transaction Failed';
      default:
        return 'Processing...';
    }
  };

  const getStatusDescription = () => {
    switch (status) {
      case 'pending':
        return 'Your transaction is waiting for network confirmation. This may take a few moments.';
      case 'executing':
        return 'Broadcasting your transaction to the network. Please wait...';
      case 'success':
        return `Successfully bridged ${amount} ${fromChain} to ${toChain}!`;
      case 'error':
        return errorMessage || 'An error occurred while processing your transaction.';
      default:
        return 'Processing your bridge transaction...';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            {getStatusIcon()}
          </div>
          <DialogTitle className="text-center text-xl">
            {getStatusTitle()}
          </DialogTitle>
          <DialogDescription className="text-center">
            {getStatusDescription()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {status === 'pending' && (
            <Alert className="bg-blue-50 border-blue-200">
              <Clock className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                Transaction submitted and awaiting confirmation on the {fromChain} network.
              </AlertDescription>
            </Alert>
          )}

          {status === 'error' && errorMessage && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                {errorMessage}
              </AlertDescription>
            </Alert>
          )}

          {transactionHash && transactionHash.length > 40 && !transactionHash.includes('-') && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Transaction Hash:</p>
              <div className="flex items-center gap-2 p-2 bg-gray-100 rounded-md">
                <code className="text-xs flex-1 overflow-hidden text-ellipsis">
                  {transactionHash}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const explorerUrl = getExplorerUrl(fromChain, transactionHash);
                    window.open(explorerUrl, '_blank');
                  }}
                  className="shrink-0"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <div className="text-xs text-gray-500 space-y-2">
            <div className="flex justify-between">
              <span>From Chain:</span>
              <span className="font-medium">{fromChain}</span>
            </div>
            <div className="flex justify-between">
              <span>To Chain:</span>
              <span className="font-medium">{toChain}</span>
            </div>
            <div className="flex justify-between">
              <span>Amount:</span>
              <span className="font-medium">{amount} {fromChain}</span>
            </div>
            {fromAddress && (
              <div className="flex flex-col gap-1">
                <span>From Address:</span>
                <code className="text-xs bg-gray-100 p-1 rounded break-all">
                  {fromAddress}
                </code>
              </div>
            )}
            {toAddress && (
              <div className="flex flex-col gap-1">
                <span>To Address:</span>
                <code className="text-xs bg-gray-100 p-1 rounded break-all">
                  {toAddress}
                </code>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="sm:justify-center">
          {transactionHash && transactionHash.length > 40 && !transactionHash.includes('-') && status !== 'executing' && (
            <Button
              variant="outline"
              onClick={() => {
                const explorerUrl = getExplorerUrl(fromChain, transactionHash);
                window.open(explorerUrl, '_blank');
              }}
              className="w-full sm:w-auto"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              View on Explorer
            </Button>
          )}
          <Button
            onClick={onClose}
            className="w-full sm:w-auto"
            disabled={status === 'executing'}
          >
            {status === 'executing' ? 'Please Wait...' : 'Close'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
