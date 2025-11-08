import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  CircularProgress,
  Divider
} from '@mui/material';
import { ExternalLink, CheckCircle2, XCircle, QrCode } from 'lucide-react';
// Adjust import: library provides named components, avoid default import error
import { QRCodeCanvas } from 'qrcode.react';
import { useToast } from '@/hooks/use-toast';

interface ExternalWalletSwapProps {
  userAddress: string;
  fromToken: string;
  toToken: string;
  amount: string;
  fromIssuer?: string;
  toIssuer?: string;
  slippage?: number;
  walletType: 'xaman' | 'joey';
  onSuccess?: (result: any) => void;
  onCancel?: () => void;
}

export function ExternalWalletSwap({
  userAddress,
  fromToken,
  toToken,
  amount,
  fromIssuer,
  toIssuer,
  slippage = 5,
  walletType,
  onSuccess,
  onCancel
}: ExternalWalletSwapProps) {
  const [step, setStep] = useState<'preparing' | 'signing' | 'verifying' | 'success' | 'error'>('preparing');
  const [swapId, setSwapId] = useState<string>('');
  const [payloadId, setPayloadId] = useState<string>('');
  const [qrUri, setQrUri] = useState<string>('');
  const [deepLink, setDeepLink] = useState<string>('');
  const [webLink, setWebLink] = useState<string>('');
  const [estimatedOutput, setEstimatedOutput] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [txHash, setTxHash] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    // kick off preparation when mounted
    void prepareSwap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prepareSwap = async () => {
    try {
      console.log('🔄 [EXTERNAL SWAP] Step 1: Preparing swap transaction...');
      
      const prepareResponse = await fetch('/api/xrpl/external/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress,
          fromToken,
          toToken,
          amount,
          fromIssuer,
          toIssuer,
          slippage
        })
      });

      const prepareData = await prepareResponse.json();

      if (!prepareData.success) {
        throw new Error(prepareData.error || 'Failed to prepare swap');
      }

      setSwapId(prepareData.swapId);
      setEstimatedOutput(prepareData.estimatedOutput);
      
      console.log('✅ [EXTERNAL SWAP] Swap prepared:', prepareData.swapId);

      // Step 2: Create signing payload
      await createSigningPayload(prepareData.swapId);

    } catch (err: any) {
      console.error('❌ [EXTERNAL SWAP] Prepare error:', err);
      setError(err.message || 'Failed to prepare swap');
      setStep('error');
      toast({
        title: 'Swap Preparation Failed',
        description: err.message,
        variant: 'destructive'
      });
    }
  };

  const createSigningPayload = async (swapIdParam: string) => {
    try {
      console.log('🔄 [EXTERNAL SWAP] Step 2: Creating signing payload...');
      
      const payloadResponse = await fetch('/api/xrpl/external/create-payload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          swapId: swapIdParam,
          walletType
        })
      });

      const payloadData = await payloadResponse.json();

      if (!payloadData.success) {
        throw new Error(payloadData.error || 'Failed to create signing payload');
      }

      setPayloadId(payloadData.payloadId);
      setQrUri(payloadData.qrUri);
      setDeepLink(payloadData.deepLink);
      setWebLink(payloadData.webLink);
      setStep('signing');

      console.log('✅ [EXTERNAL SWAP] Payload created:', payloadData.payloadId);

      // Start polling for signature
      startPolling(swapIdParam, payloadData.payloadId);

    } catch (err: any) {
      console.error('❌ [EXTERNAL SWAP] Payload creation error:', err);
      setError(err.message || 'Failed to create signing payload');
      setStep('error');
      toast({
        title: 'Payload Creation Failed',
        description: err.message,
        variant: 'destructive'
      });
    }
  };

  const startPolling = async (swapIdParam: string, payloadIdParam: string) => {
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max (5 seconds interval)
    const pollInterval = setInterval(async () => {
      attempts++;

      try {
        const verifyResponse = await fetch('/api/xrpl/external/verify-signature', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            swapId: swapIdParam,
            payloadId: payloadIdParam
          })
        });

        const verifyData = await verifyResponse.json();

        if (verifyData.success && (verifyData.status === 'signed' || verifyData.status === 'submitted')) {
          clearInterval(pollInterval);
          setTxHash(verifyData.txHash);
          setStep('success');
          console.log('✅ [EXTERNAL SWAP] Transaction signed and submitted!');
          
          toast({
            title: 'Swap Successful',
            description: `Swapped ${amount} ${fromToken} to ${toToken}`,
          });

          if (onSuccess) {
            onSuccess(verifyData);
          }
        } else if (verifyData.status === 'failed' || verifyData.status === 'rejected') {
          clearInterval(pollInterval);
          setError('Transaction failed on XRPL');
          setStep('error');
        }

        if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          setError('Transaction signing timeout - please try again');
          setStep('error');
        }

      } catch (err: any) {
        console.error('❌ [EXTERNAL SWAP] Polling error:', err);
      }
    }, 5000); // Poll every 5 seconds
  };

  const openDeepLink = () => {
    if (deepLink) {
      window.location.href = deepLink;
    }
  };

  const openWebLink = () => {
    if (webLink) {
      window.open(webLink, '_blank');
    }
  };

  return (
    <Dialog open onClose={() => onCancel?.()} maxWidth="sm" fullWidth>
      <DialogTitle>
        {step === 'preparing' && 'Preparing Swap...'}
        {step === 'signing' && `Sign with ${walletType === 'xaman' ? 'Xaman' : 'Joey'}`}
        {step === 'verifying' && 'Verifying Transaction...'}
        {step === 'success' && 'Swap Successful!'}
        {step === 'error' && 'Swap Failed'}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {step === 'preparing' && 'Preparing your swap transaction...'}
          {step === 'signing' && 'Scan the QR code with your wallet app to sign the transaction'}
          {step === 'verifying' && 'Waiting for transaction confirmation...'}
          {step === 'success' && `Successfully swapped ${amount} ${fromToken} to ${estimatedOutput} ${toToken}`}
          {step === 'error' && error}
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 1 }}>
          {step === 'preparing' && <CircularProgress color="primary" />}

          {step === 'signing' && qrUri && (
            <>
              <Box sx={{ bgcolor: 'background.paper', p: 2, borderRadius: 2 }}>
                <QRCodeCanvas value={qrUri} size={256} />
              </Box>
              <Box sx={{ display: 'flex', gap: 1, width: '100%' }}>
                <Button onClick={openDeepLink} variant="outlined" sx={{ flex: 1 }}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open {walletType === 'xaman' ? 'Xaman' : 'Joey'}
                </Button>
                <Button onClick={openWebLink} variant="outlined" sx={{ flex: 1 }}>
                  <QrCode className="h-4 w-4 mr-2" />
                  Web Sign
                </Button>
              </Box>
            </>
          )}

          {step === 'verifying' && <CircularProgress color="primary" />}

          {step === 'success' && (
            <>
              <CheckCircle2 className="h-16 w-16 text-green-500" />
              {txHash && (
                <Button variant="outlined" href={`https://livenet.xrpl.org/transactions/${txHash}`} target="_blank">
                  View on Explorer →
                </Button>
              )}
            </>
          )}

          {step === 'error' && (
            <>
              <XCircle className="h-16 w-16 text-red-500" />
              <Typography variant="body2" color="error">{error}</Typography>
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        {step === 'success' ? (
          <Button onClick={() => onSuccess?.({})}>Close</Button>
        ) : (
          <Button onClick={() => onCancel?.()} variant="outlined">Close</Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
