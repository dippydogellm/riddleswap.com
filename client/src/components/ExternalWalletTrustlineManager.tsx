import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  Button,
  Alert,
  AlertTitle
} from '@mui/material';
import { Loader2, CheckCircle, X, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { QRCodeSVG } from 'qrcode.react';

interface ExternalWalletTrustlineManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  operation: 'sell' | 'remove';
  currency: string;
  issuer: string;
  balance?: string;
}

export function ExternalWalletTrustlineManager({ 
  isOpen, 
  onClose, 
  onSuccess,
  operation,
  currency,
  issuer,
  balance
}: ExternalWalletTrustlineManagerProps) {
  const [step, setStep] = useState<'preparing' | 'signing' | 'verifying' | 'success' | 'error'>('preparing');
  const [operationId, setOperationId] = useState<string | null>(null);
  const [payloadData, setPayloadData] = useState<any>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Get external wallet address from session
  const getExternalWalletAddress = () => {
    const externalWalletSession = localStorage.getItem('external_wallet_session');
    if (externalWalletSession) {
      try {
        const sessionData = JSON.parse(externalWalletSession);
        return sessionData.address;
      } catch {
        return null;
      }
    }
    return null;
  };

  useEffect(() => {
    if (isOpen) {
      prepareOperation();
    }
  }, [isOpen]);

  const prepareOperation = async () => {
    try {
      setStep('preparing');
      setError(null);

      const userAddress = getExternalWalletAddress();
      console.log('🔍 [EXTERNAL TRUSTLINE] User address:', userAddress);
      
      if (!userAddress) {
        throw new Error('External wallet address not found. Please connect your wallet first.');
      }

      // Prepare the operation
      const endpoint = operation === 'sell' 
        ? '/api/xrpl/external/prepare-sell-all'
        : '/api/xrpl/external/prepare-remove-trustline';

      const payload: any = {
        userAddress,
        currency,
        issuer
      };

      if (operation === 'sell' && balance) {
        payload.balance = balance;
      }

      console.log(`📤 [EXTERNAL TRUSTLINE] Preparing ${operation} operation for ${currency}`);
      console.log('📤 [EXTERNAL TRUSTLINE] Payload:', payload);

      const prepareResponse = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!prepareResponse.ok) {
        const errorData = await prepareResponse.json();
        console.error('❌ [EXTERNAL TRUSTLINE] Prepare failed:', errorData);
        throw new Error(errorData.error || 'Failed to prepare operation');
      }

      const prepareData = await prepareResponse.json();
      console.log('✅ [EXTERNAL TRUSTLINE] Operation prepared:', prepareData.operationId);
      setOperationId(prepareData.operationId);

      // Create Xumm payload
      console.log('📱 [EXTERNAL TRUSTLINE] Creating Xumm payload...');
      const payloadResponse = await fetch('/api/xrpl/external/create-payload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operationId: prepareData.operationId })
      });

      if (!payloadResponse.ok) {
        const errorData = await payloadResponse.json();
        console.error('❌ [EXTERNAL TRUSTLINE] Payload creation failed:', errorData);
        throw new Error(errorData.error || 'Failed to create signing payload');
      }

      const payloadJson = await payloadResponse.json();
      console.log('✅ [EXTERNAL TRUSTLINE] Xumm payload created:', {
        uuid: payloadJson.payload?.uuid,
        hasQr: !!payloadJson.payload?.qr,
        hasDeepLink: !!payloadJson.payload?.deepLink
      });

      if (!payloadJson.success || !payloadJson.payload) {
        throw new Error('Invalid payload response from server');
      }

      setPayloadData(payloadJson.payload);
      setStep('signing');

      // Start polling for signature
      pollForSignature(payloadJson.payload.uuid);

    } catch (err) {
      console.error('❌ [EXTERNAL TRUSTLINE] Prepare error:', err);
      setError(err instanceof Error ? err.message : 'Failed to prepare operation');
      setStep('error');
      
      toast({
        title: "Preparation Failed",
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: "destructive",
      });
    }
  };

  const pollForSignature = async (uuid: string) => {
    const maxAttempts = 60; // 5 minutes (5 seconds interval)
    let attempts = 0;

    const interval = setInterval(async () => {
      attempts++;

      try {
        const statusResponse = await fetch(`/api/xrpl/external/payload-status/${uuid}`);
        
        if (!statusResponse.ok) {
          clearInterval(interval);
          setError('Failed to check signature status');
          setStep('error');
          return;
        }

        const statusData = await statusResponse.json();

        if (statusData.signed && statusData.txHash) {
          clearInterval(interval);
          
          // Verify transaction
          setStep('verifying');
          
          const verifyResponse = await fetch('/api/xrpl/external/verify-transaction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              operationId,
              txHash: statusData.txHash
            })
          });

          const verifyData = await verifyResponse.json();

          if (verifyData.verified) {
            setTxHash(statusData.txHash);
            setStep('success');
            
            toast({
              title: "Success!",
              description: operation === 'sell' 
                ? `Successfully sold ${currency} to XRP` 
                : `Successfully removed ${currency} trustline`,
            });

            if (onSuccess) {
              onSuccess();
            }
          } else {
            setError('Transaction verification failed');
            setStep('error');
          }
        }

        if (attempts >= maxAttempts) {
          clearInterval(interval);
          setError('Signing timeout - please try again');
          setStep('error');
        }

      } catch (err) {
        clearInterval(interval);
        setError(err instanceof Error ? err.message : 'Status check failed');
        setStep('error');
      }
    }, 5000); // Poll every 5 seconds
  };

  const handleClose = () => {
    setStep('preparing');
    setOperationId(null);
    setPayloadData(null);
    setTxHash(null);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {step === 'preparing' && (
          <>
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
            Preparing {operation === 'sell' ? 'Sale' : 'Removal'}...
          </>
        )}
        {step === 'signing' && (
          <>
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
            Waiting for Signature
          </>
        )}
        {step === 'verifying' && (
          <>
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
            Verifying Transaction...
          </>
        )}
        {step === 'success' && (
          <>
            <CheckCircle className="h-5 w-5 text-green-500" />
            {operation === 'sell' ? 'Tokens Sold!' : 'Trustline Removed!'}
          </>
        )}
        {step === 'error' && (
          <>
            <X className="h-5 w-5 text-red-500" />
            Operation Failed
          </>
        )}
      </DialogTitle>
      <DialogContent dividers className="w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="space-y-4">
          {/* Preparing State */}
          {step === 'preparing' && (
            <div className="text-center py-8">
              <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
              <p className="text-gray-600">
                Preparing {operation === 'sell' ? 'sale' : 'removal'} transaction...
              </p>
            </div>
          )}

          {/* Signing State */}
          {step === 'signing' && payloadData && (
            <div className="space-y-4">
              <Alert severity="info">
                <AlertTitle>Action required</AlertTitle>
                {operation === 'sell' 
                  ? `Scan the QR code with your wallet to sell ${balance} ${currency} to XRP`
                  : `Scan the QR code with your wallet to remove the ${currency} trustline`}
              </Alert>

              {/* QR Code */}
              <div className="flex justify-center p-4 bg-white rounded-lg">
                <QRCodeSVG value={payloadData.qr || payloadData.deepLink || ''} size={200} />
              </div>

              {/* Deep Link Button */}
              <Button
                className="w-full"
                onClick={() => window.open(payloadData.deepLink, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in Wallet App
              </Button>

              <p className="text-sm text-center text-gray-500">
                Waiting for signature... (Auto-detecting)
              </p>
            </div>
          )}

          {/* Verifying State */}
          {step === 'verifying' && (
            <div className="text-center py-8">
              <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
              <p className="text-gray-600">Verifying transaction on XRPL...</p>
            </div>
          )}

          {/* Success State */}
          {step === 'success' && txHash && (
            <div className="space-y-4">
              <Alert severity="success">
                {operation === 'sell'
                  ? `Successfully sold ${currency} to XRP!`
                  : `Successfully removed ${currency} trustline!`}
              </Alert>

              <Button
                className="w-full"
                variant="outlined"
                onClick={() => window.open(`https://livenet.xrpl.org/transactions/${txHash}`, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View on XRPL Explorer
              </Button>
            </div>
          )}

          {/* Error State */}
          {step === 'error' && error && (
            <Alert severity="error">{error}</Alert>
          )}
        </div>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={handleClose}>
          {step === 'success' ? 'Done' : 'Cancel'}
        </Button>
        {step === 'error' && (
          <Button onClick={prepareOperation}>
            Retry
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
