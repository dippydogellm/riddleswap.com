import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { QrCode, Smartphone, Clock, ExternalLink, Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface XamanQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  qrCode: string;
  deepLink: string;
  webLink: string;
  uuid: string;
  payloadType: 'signin' | 'payment' | 'custom';
  description: string;
  instructions: {
    qr: string;
    mobile: string;
    desktop: string;
  };
  expiresIn: number; // milliseconds
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
  onExpiry?: () => void;
}

export function XamanQRModal({
  isOpen,
  onClose,
  qrCode,
  deepLink,
  webLink,
  uuid,
  payloadType,
  description,
  instructions,
  expiresIn,
  onSuccess,
  onError,
  onExpiry
}: XamanQRModalProps) {
  const { toast } = useToast();
  const [timeLeft, setTimeLeft] = useState(Math.floor(expiresIn / 1000));
  const [copied, setCopied] = useState(false);
  const [polling, setPolling] = useState(false);

  // Countdown timer
  useEffect(() => {
    if (!isOpen) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          onExpiry?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, onExpiry]);

  // Poll for result
  useEffect(() => {
    if (!isOpen || polling) return;

    setPolling(true);
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/external-wallets/poll/${uuid}`, {
          headers: {
            'x-external-session-id': localStorage.getItem('externalSessionId') || ''
          }
        });
        
        if (!response.ok) {
          if (response.status === 404) {
            clearInterval(pollInterval);
            onError?.('Payload expired or not found');
            return;
          }
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json() as any;
        
        if (data.status === 'completed') {
          clearInterval(pollInterval);
          onSuccess?.(data);
          toast({
            title: "Success!",
            description: "Transaction completed successfully"
          });
        } else if (data.status === 'rejected') {
          clearInterval(pollInterval);
          onError?.('Transaction was rejected by user');
        } else if (data.status === 'expired') {
          clearInterval(pollInterval);
          onExpiry?.();
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 2000);

    return () => {
      clearInterval(pollInterval);
      setPolling(false);
    };
  }, [isOpen, uuid, onSuccess, onError, onExpiry, polling, toast]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const copyLink = (link: string, type: string) => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast({
      title: "Copied!",
      description: `${type} link copied to clipboard`
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const openDeepLink = () => {
    window.open(deepLink, '_self');
  };

  const openWebLink = () => {
    window.open(webLink, '_blank', 'noopener,noreferrer');
  };

  const getPayloadTypeColor = () => {
    switch (payloadType) {
      case 'signin': return 'bg-blue-500 hover:bg-blue-600';
      case 'payment': return 'bg-green-500 hover:bg-green-600';
      case 'custom': return 'bg-purple-500 hover:bg-purple-600';
      default: return 'bg-gray-500 hover:bg-gray-600';
    }
  };

  const getPayloadTypeIcon = () => {
    switch (payloadType) {
      case 'signin': return '🔐';
      case 'payment': return '💳';
      case 'custom': return '⚙️';
      default: return '📋';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" data-testid="xaman-qr-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            Xaman {payloadType === 'signin' ? 'Authentication' : payloadType === 'payment' ? 'Payment' : 'Request'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Payload Info */}
          <div className="flex items-center gap-2">
            <Badge className={getPayloadTypeColor()}>
              <span className="mr-1">{getPayloadTypeIcon()}</span>
              {payloadType.charAt(0).toUpperCase() + payloadType.slice(1)}
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTime(timeLeft)}
            </Badge>
          </div>

          {/* Description */}
          <p className="text-sm text-muted-foreground">{description}</p>

          {/* QR Code */}
          <div className="flex justify-center p-4 bg-white dark:bg-gray-50 rounded-lg">
            <img 
              src={`data:image/png;base64,${qrCode}`}
              alt="Xaman QR Code"
              className="w-48 h-48"
              data-testid="qr-code-image"
            />
          </div>

          {/* Instructions */}
          <div className="text-center space-y-2">
            <p className="text-sm font-medium">{instructions.qr}</p>
            <p className="text-xs text-muted-foreground hidden sm:block">
              {instructions.desktop}
            </p>
            <p className="text-xs text-muted-foreground sm:hidden">
              {instructions.mobile}
            </p>
          </div>

          <Separator />

          {/* Action Buttons */}
          <div className="space-y-3">
            {/* Mobile Deep Link Button */}
            <Button 
              onClick={openDeepLink}
              className="w-full" 
              size="lg"
              data-testid="button-open-xaman"
            >
              <Smartphone className="w-4 h-4 mr-2" />
              Open in Xaman App
            </Button>

            {/* Web Link and Copy Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button 
                variant="outline" 
                onClick={openWebLink}
                data-testid="button-open-web"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open in Browser
              </Button>
              <Button 
                variant="outline" 
                onClick={() => copyLink(deepLink, 'Deep')}
                data-testid="button-copy-deeplink"
              >
                {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                Copy Link
              </Button>
            </div>

            {/* Advanced Options */}
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                Advanced Options
              </summary>
              <div className="mt-2 space-y-2 pl-4 border-l-2 border-muted">
                <div className="flex items-center justify-between">
                  <span>UUID:</span>
                  <code className="text-xs bg-muted px-2 py-1 rounded">{uuid}</code>
                </div>
                <div className="flex items-center justify-between">
                  <span>Web Link:</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => copyLink(webLink, 'Web')}
                    data-testid="button-copy-weblink"
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </details>
          </div>

          {/* Warning for expired payload */}
          {timeLeft <= 0 && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive font-medium">
                ⚠️ This request has expired. Please create a new one.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
