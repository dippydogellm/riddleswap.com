import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, Copy, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface TransactionDetails {
  transactionId: string;
  fromToken: string;
  toToken: string;
  amount: string;
  destinationAddress: string;
  status: 'creating' | 'executing' | 'completed' | 'failed';
  inputTxHash?: string;
  outputTxHash?: string;
  explorerUrl?: string;
  note?: string;
  timestamp?: string;
}

interface TransactionDetailsDropdownProps {
  transaction: TransactionDetails | null;
  isVisible: boolean;
  onToggle: () => void;
}

export function TransactionDetailsDropdown({ 
  transaction, 
  isVisible, 
  onToggle 
}: TransactionDetailsDropdownProps) {
  const { toast } = useToast();

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: `${label} copied to clipboard`,
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'executing':
        return <Clock className="w-4 h-4 text-blue-500" />;
      case 'creating':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'executing':
        return 'bg-blue-100 text-blue-800';
      case 'creating':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!transaction) {
    return null;
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            Transaction Details
            <Badge className={getStatusColor(transaction.status)}>
              {getStatusIcon(transaction.status)}
              {transaction.status.toUpperCase()}
            </Badge>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="h-8 w-8 p-0"
          >
            {isVisible ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      
      {isVisible && (
        <CardContent className="space-y-4">
          {/* Transaction ID */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-700">Transaction ID</p>
              <p className="text-xs text-gray-500 font-mono">
                {transaction.transactionId.slice(0, 8)}...{transaction.transactionId.slice(-8)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(transaction.transactionId, 'Transaction ID')}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>

          {/* Bridge Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-700">From</p>
              <Badge variant="outline">{transaction.fromToken}</Badge>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-700">To</p>
              <Badge variant="outline">{transaction.toToken}</Badge>
            </div>
          </div>

          {/* Amount */}
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-700">Amount</p>
              <p className="text-lg font-bold text-blue-700">
                {transaction.amount} {transaction.fromToken}
              </p>
            </div>
          </div>

          {/* Destination Address */}
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700">Destination Address</p>
              <p className="text-xs text-gray-500 font-mono break-all">
                {transaction.destinationAddress}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(transaction.destinationAddress, 'Destination Address')}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>

          {/* Transaction Hashes */}
          {transaction.inputTxHash && (
            <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700">Input Transaction Hash</p>
                <p className="text-xs text-gray-500 font-mono">
                  {transaction.inputTxHash.slice(0, 16)}...{transaction.inputTxHash.slice(-16)}
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(transaction.inputTxHash!, 'Input Transaction Hash')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                {transaction.explorerUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(transaction.explorerUrl, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          )}

          {transaction.outputTxHash && (
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700">Output Transaction Hash</p>
                <p className="text-xs text-gray-500 font-mono">
                  {transaction.outputTxHash.slice(0, 16)}...{transaction.outputTxHash.slice(-16)}
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(transaction.outputTxHash!, 'Output Transaction Hash')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(`https://livenet.xrpl.org/transactions/${transaction.outputTxHash}`, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Additional Notes */}
          {transaction.note && (
            <div className="p-3 bg-yellow-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700">Note</p>
              <p className="text-sm text-gray-600">{transaction.note}</p>
            </div>
          )}

          {/* Timestamp */}
          {transaction.timestamp && (
            <div className="text-center pt-2 border-t">
              <p className="text-xs text-gray-500">
                Created: {new Date(transaction.timestamp).toLocaleString()}
              </p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
