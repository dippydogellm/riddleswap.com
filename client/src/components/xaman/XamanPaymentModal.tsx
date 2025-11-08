import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { XamanQRModal } from './XamanQRModal';
import { Send, Loader2, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface XamanPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultAmount?: string;
  defaultDestination?: string;
  defaultCurrency?: string;
  defaultMemo?: string;
  onPaymentSuccess?: (data: any) => void;
  onPaymentError?: (error: string) => void;
}

interface XamanPayload {
  success: boolean;
  uuid: string;
  payloadType: string;
  qrCode: string;
  deepLink: string;
  webLink: string;
  sessionId: string;
  description: string;
  expiresIn: number;
  instructions: {
    qr: string;
    mobile: string;
    desktop: string;
  };
}

export function XamanPaymentModal({
  isOpen,
  onClose,
  defaultAmount = '',
  defaultDestination = '',
  defaultCurrency = 'XRP',
  defaultMemo = '',
  onPaymentSuccess,
  onPaymentError
}: XamanPaymentModalProps) {
  const { toast } = useToast();
  const [amount, setAmount] = useState(defaultAmount);
  const [destination, setDestination] = useState(defaultDestination);
  const [currency, setCurrency] = useState(defaultCurrency);
  const [issuer, setIssuer] = useState('');
  const [memo, setMemo] = useState(defaultMemo);
  const [isLoading, setIsLoading] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [payload, setPayload] = useState<XamanPayload | null>(null);

  // Common XRPL token presets
  const commonTokens = [
    { currency: 'XRP', issuer: '', name: 'XRP' },
    { currency: 'USD', issuer: 'rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq', name: 'USD (Gatehub)' },
    { currency: 'EUR', issuer: 'rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq', name: 'EUR (Gatehub)' },
    { currency: 'BTC', issuer: 'rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B', name: 'BTC (Bitstamp)' },
    { currency: 'ETH', issuer: 'rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B', name: 'ETH (Bitstamp)' },
  ];

  const validateForm = () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount greater than 0",
        variant: "destructive"
      });
      return false;
    }

    if (!destination || destination.length < 25) {
      toast({
        title: "Invalid Destination",
        description: "Please enter a valid XRPL address",
        variant: "destructive"
      });
      return false;
    }

    if (currency !== 'XRP' && !issuer) {
      toast({
        title: "Missing Issuer",
        description: "Token payments require an issuer address",
        variant: "destructive"
      });
      return false;
    }

    return true;
  };

  const handleCreatePayment = async () => {
    if (!validateForm()) return;

    try {
      setIsLoading(true);
      
      // Get or create external session ID
      let sessionId = localStorage.getItem('externalSessionId');
      if (!sessionId) {
        sessionId = `ext_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem('externalSessionId', sessionId);
      }

      console.log('💳 [XAMAN PAYMENT] Creating payment payload...');

      const requestBody: any = {
        payloadType: 'payment',
        amount: amount,
        destination: destination,
        currency: currency,
        purpose: `Payment of ${amount} ${currency}`
      };

      // Add issuer for non-XRP tokens
      if (currency !== 'XRP' && issuer) {
        requestBody.issuer = issuer;
      }

      // Add memo if provided
      if (memo.trim()) {
        requestBody.memo = memo.trim();
      }

      const response = await fetch('/api/external-wallets/xaman/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-external-session-id': sessionId
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json() as any;
        throw new Error(errorData.error || 'Failed to create payment request');
      }

      const data = await response.json() as any;
      console.log('✅ [XAMAN PAYMENT] Payload created:', data.uuid);

      setPayload(data);
      setShowQRModal(true);

    } catch (error) {
      console.error('❌ [XAMAN PAYMENT] Payment creation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create payment request';
      onPaymentError?.(errorMessage);
      toast({
        title: "Payment Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentSuccess = (data: any) => {
    console.log('✅ [XAMAN PAYMENT] Payment successful:', data);
    setShowQRModal(false);
    onClose();
    onPaymentSuccess?.(data);
    toast({
      title: "Payment Sent",
      description: `Successfully sent ${amount} ${currency}`
    });
  };

  const handlePaymentError = (error: string) => {
    console.error('❌ [XAMAN PAYMENT] Payment failed:', error);
    setShowQRModal(false);
    onPaymentError?.(error);
    toast({
      title: "Payment Failed",
      description: error,
      variant: "destructive"
    });
  };

  const handleQRModalClose = () => {
    setShowQRModal(false);
    setPayload(null);
  };

  const handleExpiry = () => {
    setShowQRModal(false);
    setPayload(null);
    toast({
      title: "Payment Request Expired",
      description: "The payment request has expired. Please try again.",
      variant: "destructive"
    });
  };

  const handleCurrencyChange = (newCurrency: string) => {
    setCurrency(newCurrency);
    
    // Auto-fill issuer for common tokens
    const token = commonTokens.find(t => t.currency === newCurrency);
    if (token) {
      setIssuer(token.issuer);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md" data-testid="xaman-payment-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              Xaman Payment Request
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Amount and Currency */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  step="0.000001"
                  min="0"
                  data-testid="input-payment-amount"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select value={currency} onValueChange={handleCurrencyChange}>
                  <SelectTrigger data-testid="select-payment-currency">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {commonTokens.map((token) => (
                      <SelectItem key={`${token.currency}-${token.issuer}`} value={token.currency}>
                        {token.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Issuer field for non-XRP tokens */}
            {currency !== 'XRP' && (
              <div className="space-y-2">
                <Label htmlFor="issuer">Token Issuer Address</Label>
                <Input
                  id="issuer"
                  placeholder="rTokenIssuerAddress..."
                  value={issuer}
                  onChange={(e) => setIssuer(e.target.value)}
                  className="font-mono text-xs"
                  data-testid="input-payment-issuer"
                />
              </div>
            )}

            {/* Destination */}
            <div className="space-y-2">
              <Label htmlFor="destination">Destination Address</Label>
              <Input
                id="destination"
                placeholder="rDestinationAddress..."
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="font-mono text-xs"
                data-testid="input-payment-destination"
              />
            </div>

            {/* Memo */}
            <div className="space-y-2">
              <Label htmlFor="memo">Memo (Optional)</Label>
              <Textarea
                id="memo"
                placeholder="Payment reference or note..."
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                rows={2}
                maxLength={1000}
                data-testid="textarea-payment-memo"
              />
            </div>

            <Separator />

            {/* Payment Summary */}
            <div className="p-3 bg-muted rounded-lg space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Payment Summary
              </h4>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Amount:</span>
                  <span className="font-mono">{amount || '0'} {currency}</span>
                </div>
                <div className="flex justify-between">
                  <span>To:</span>
                  <span className="font-mono text-xs">{destination || 'Not specified'}</span>
                </div>
                {memo && (
                  <div className="flex justify-between">
                    <span>Memo:</span>
                    <span className="text-xs">{memo}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={onClose} 
                className="flex-1"
                data-testid="button-payment-cancel"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleCreatePayment}
                disabled={isLoading}
                className="flex-1"
                data-testid="button-payment-create"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                {isLoading ? 'Creating...' : 'Create Payment'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {payload && (
        <XamanQRModal
          isOpen={showQRModal}
          onClose={handleQRModalClose}
          qrCode={payload.qrCode}
          deepLink={payload.deepLink}
          webLink={payload.webLink}
          uuid={payload.uuid}
          payloadType="payment"
          description={payload.description}
          instructions={payload.instructions}
          expiresIn={payload.expiresIn}
          onSuccess={handlePaymentSuccess}
          onError={handlePaymentError}
          onExpiry={handleExpiry}
        />
      )}
    </>
  );
}
