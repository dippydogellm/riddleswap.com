import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, ExternalLink, Clock, Copy, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface XamanSwapQRModalEnhancedProps {
  isOpen: boolean;
  onClose: () => void;
  payload: {
    uuid: string;
    qr: string;
    deepLink: string;
  };
  fromToken?: string;
  toToken?: string;
  fromAmount?: string;
  toAmount?: string;
  onSuccess?: (result: any) => void;
}

export function XamanSwapQRModalEnhanced({
  isOpen,
  onClose,
  payload,
  fromToken = '',
  toToken = '',
  fromAmount = '',
  toAmount = '',
  onSuccess
}: XamanSwapQRModalEnhancedProps) {
  const { toast } = useToast();
  const [status, setStatus] = useState<'pending' | 'signed' | 'rejected' | 'expired'>('pending');
  const [isPolling, setIsPolling] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes default
  
  // DEBUG: Log when component renders
  console.log('🔄 XamanSwapQRModalEnhanced render:', {
    isOpen,
    payload,
    qrUrl: payload?.qr
  });

  // Poll for transaction status
  useEffect(() => {
    if (!isOpen || !payload.uuid) return;

    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/xumm/status/${payload.uuid}`);
        if (response.ok) {
          const data = await response.json() as any;
          
          if (data.meta?.signed === true) {
            setStatus('signed');
            setIsPolling(false);
            if (onSuccess) {
              onSuccess(data.response?.account || data.response?.txid || 'success');
            }
            setTimeout(() => {
              onClose();
            }, 2000);
          } else if (data.meta?.signed === false) {
            setStatus('rejected');
            setIsPolling(false);
          } else if (data.meta?.expired === true) {
            setStatus('expired');
            setIsPolling(false);
          }
        }
      } catch (error) {
        // Silently handle polling errors
      }
    };

    if (status === 'pending') {
      setIsPolling(true);
      const interval = setInterval(pollStatus, 2000);
      return () => clearInterval(interval);
    }
  }, [isOpen, payload.uuid, status, onSuccess, onClose]);

  // Countdown timer
  useEffect(() => {
    if (!isOpen || status !== 'pending') return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setStatus('expired');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, status]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Deep link copied to clipboard",
    });
  };

  const handleOpenXaman = () => {
    if (payload.deepLink) {
      // For mobile, try deep link first
      if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
        window.location.href = payload.deepLink;
        // Fallback to web after delay
        setTimeout(() => {
          window.open(payload.deepLink, '_blank');
        }, 1500);
      } else {
        window.open(payload.deepLink, '_blank');
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="unified-modal w-[95vw] max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle className="unified-modal-title text-center">
            {status === 'signed' ? 'Transaction Signed!' : 
             status === 'rejected' ? 'Transaction Rejected' :
             status === 'expired' ? 'Transaction Expired' :
             'Scan QR Code with Xaman'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 p-4">
          {/* QR Code Display - CRITICAL FOR MOBILE */}
          {status === 'pending' && payload.qr && (
            <div className="flex flex-col items-center space-y-4">
              <div className="bg-white p-4 rounded-lg border-2 border-gray-200 shadow-lg">
                <img 
                  src={payload.qr} 
                  alt="Xaman QR Code" 
                  className="w-64 h-64 max-w-full border-2 border-gray-300 rounded-lg" 
                  style={{ 
                    minWidth: '240px', 
                    minHeight: '240px',
                    maxWidth: '100%',
                    height: 'auto',
                    imageRendering: 'crisp-edges'
                  }}
                  onLoad={() => console.log('✅ QR code loaded successfully:', payload.qr)}
                  onError={(e) => {
                    console.error('❌ QR code failed to load:', payload.qr);
                  }}
                />
              </div>
              <p className="text-sm text-gray-600 text-center max-w-xs">
                Open Xaman app and scan this QR code to connect your wallet
              </p>
            </div>
          )}

          {/* Connection Buttons */}
          {status === 'pending' && (
            <div className="flex flex-col space-y-3">
              <Button onClick={handleOpenXaman} className="w-full">
                <ExternalLink className="w-4 h-4 mr-2" />
                Open Xaman App
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => copyToClipboard(payload.deepLink)}
                className="w-full"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy Deep Link
              </Button>
            </div>
          )}

          {/* Transaction details and timing info */}
          {status === 'pending' && (
            <div className="space-y-4">
              <div className="transaction-details">
                {fromToken && toToken && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Transaction:</span>
                    <span className="font-medium">
                      {fromAmount ? `${fromAmount} ` : ''}{fromToken} → {toAmount ? `${toAmount} ` : ''}{toToken}
                    </span>
                  </div>
                )}
                
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-muted-foreground">Time remaining:</span>
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTime(timeLeft)}
                  </Badge>
                </div>
              </div>
              
              <p className="text-xs text-center text-muted-foreground">
                Scan the QR code above or use the buttons below
              </p>
            </div>
          )}

          {status === 'signed' && (
            <div className="text-center">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                Transaction Signed Successfully!
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Your transaction has been submitted to the network
              </p>
            </div>
          )}

          {status === 'rejected' && (
            <div className="text-center">
              <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <p className="text-lg font-semibold text-red-600 dark:text-red-400">
                Transaction Rejected
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                The transaction was declined in Xaman
              </p>
              <Button onClick={onClose} className="mt-4">
                Close
              </Button>
            </div>
          )}

          {status === 'expired' && (
            <div className="text-center">
              <AlertCircle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
              <p className="text-lg font-semibold text-orange-600 dark:text-orange-400">
                Transaction Expired
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                The transaction request has timed out
              </p>
              <Button onClick={onClose} className="mt-4">
                Close
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
