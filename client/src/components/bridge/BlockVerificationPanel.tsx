// Block Verification Panel for Bridge Transactions
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Shield, CheckCircle, XCircle, Clock, Search } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface VerificationResult {
  verified: boolean;
  confirmations?: number;
  blockHeight?: number;
  timestamp?: number;
  isSafe: boolean;
  chain: string;
  minConfirmationsRequired: number;
  error?: string;
}

interface BlockVerificationPanelProps {
  transactionId?: string;
  txHash?: string;
  chain?: 'XRPL' | 'SOLANA' | 'BITCOIN';
}

export default function BlockVerificationPanel({ 
  transactionId, 
  txHash: initialTxHash, 
  chain: initialChain 
}: BlockVerificationPanelProps) {
  const [txHash, setTxHash] = useState(initialTxHash || '');
  const [chain, setChain] = useState<'XRPL' | 'SOLANA' | 'BITCOIN'>(initialChain || 'XRPL');
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verifyTransaction = async () => {
    if (!txHash) {
      setError('Please enter a transaction hash');
      return;
    }

    setIsVerifying(true);
    setError(null);
    setVerification(null);

    try {
      let response: any;
      
      if (transactionId) {
        // Verify with transaction ID for bridge transactions
        response = await apiRequest('/api/bridge/verify-transaction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transactionId,
            txHash
          })
        });
      } else {
        // Manual verification for any transaction
        response = await apiRequest('/api/bridge/verify-manual', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            txHash,
            chain
          })
        });
      }

      // Parse response if it's a Response object
      const data = response.json ? await response.json() as any : response;

      if (data.success) {
        setVerification(data.verification);
      } else {
        setError(data.error || 'Verification failed');
      }
    } catch (err: any) {
      setError(err.message || 'Network error occurred');
    } finally {
      setIsVerifying(false);
    }
  };

  const getStatusBadge = () => {
    if (!verification) return null;

    if (verification.verified && verification.isSafe) {
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
        <CheckCircle className="w-3 h-3 mr-1" />
        Verified & Safe
      </Badge>;
    } else if (verification.verified && !verification.isSafe) {
      return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
        <Clock className="w-3 h-3 mr-1" />
        Pending Confirmations
      </Badge>;
    } else {
      return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
        <XCircle className="w-3 h-3 mr-1" />
        Not Verified
      </Badge>;
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Block Verification System
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input Section */}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Transaction Hash</label>
            <Input
              placeholder="Enter transaction hash to verify..."
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
              className="font-mono text-sm"
            />
          </div>
          
          {!transactionId && (
            <div>
              <label className="block text-sm font-medium mb-1">Blockchain</label>
              <select 
                value={chain} 
                onChange={(e) => setChain(e.target.value as 'XRPL' | 'SOLANA' | 'BITCOIN')}
                className="w-full px-3 py-2 border rounded-md bg-background"
              >
                <option value="XRPL">XRPL</option>
                <option value="SOLANA">Solana</option>
                <option value="BITCOIN">Bitcoin</option>
              </select>
            </div>
          )}
          
          <Button 
            onClick={verifyTransaction} 
            disabled={isVerifying || !txHash}
            className="w-full"
          >
            {isVerifying ? (
              <>
                <Clock className="w-4 h-4 mr-2 animate-spin" />
                Verifying on Blockchain...
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                Verify Transaction
              </>
            )}
          </Button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Verification Results */}
        {verification && (
          <div className="space-y-4">
            <Separator />
            
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Verification Status</h3>
              {getStatusBadge()}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Chain:</span>
                  <Badge variant="outline">{verification.chain}</Badge>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Confirmed:</span>
                  <span className="text-sm font-medium">
                    {verification.verified ? 'Yes' : 'No'}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Confirmations:</span>
                  <span className="text-sm font-medium">
                    {verification.confirmations ?? 'N/A'}
                  </span>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Required:</span>
                  <span className="text-sm font-medium">
                    {verification.minConfirmationsRequired}+ confirmations
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Block Height:</span>
                  <span className="text-sm font-medium">
                    {verification.blockHeight ?? 'N/A'}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Safe to Process:</span>
                  <span className="text-sm font-medium">
                    {verification.isSafe ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </div>

            {/* Safety Explanation */}
            <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                {verification.isSafe ? (
                  "✅ This transaction has sufficient confirmations and is safe to process."
                ) : verification.verified ? (
                  "⏳ Transaction is confirmed but waiting for more confirmations to ensure safety."
                ) : (
                  "❌ Transaction not found or failed. Please verify the hash and chain."
                )}
              </p>
            </div>
          </div>
        )}

        {/* Information Footer */}
        <div className="pt-4 border-t">
          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong>Security:</strong> All verifications check real blockchain data</p>
            <p><strong>Requirements:</strong> XRPL: 1+, Solana: 32+, Bitcoin: 1+ confirmations</p>
            <p><strong>Purpose:</strong> Prevent fraud and ensure transaction authenticity</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
