import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Button,
  Chip,
  IconButton
} from '@mui/material';
import { CheckCircle2, ExternalLink, Clock, Copy, AlertCircle, Smartphone, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { QRCodeSVG } from 'qrcode.react';
import { walletChainManager } from '@/lib/wallet-chain-manager';

interface XamanConnectQRProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (address: string) => void;
}

export function XamanConnectQR({ isOpen, onClose, onSuccess }: XamanConnectQRProps) {
  const { toast } = useToast();
  
  // Get configurable timeout from environment (default 10 minutes)
  const connectionTimeout = parseInt(import.meta.env.VITE_WALLET_CONNECTION_TIMEOUT || '600');
  
  const [status, setStatus] = useState<'pending' | 'signed' | 'rejected' | 'expired'>('pending');
  const [isPolling, setIsPolling] = useState(false);
  const [timeLeft, setTimeLeft] = useState(connectionTimeout); // Configurable timeout (default 10 minutes)
  const [pollAttempts, setPollAttempts] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [payload, setPayload] = useState<{
    uuid: string;
    qr: string;
    deepLink: string;
    websocket?: string;
  } | null>(null);
  
  // Create auth payload when modal opens (no authentication required)
  useEffect(() => {
    if (!isOpen) return;
    
    const createAuthPayload = async () => {
      try {
        // Get or generate external session ID
        let externalSessionId = localStorage.getItem('external_session_id');
        if (!externalSessionId) {
          externalSessionId = `ext_${crypto.randomUUID()}_${Date.now()}`;
          localStorage.setItem('external_session_id', externalSessionId);
        }

        const response = await fetch('/api/external-wallets/xaman/connect', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-External-Session-ID': externalSessionId
          },
          body: JSON.stringify({
            purpose: 'Connect to RiddleSwap XRPL trading platform'
          })
        });

        if (!response.ok) {
          throw new Error('Failed to create authentication payload');
        }

        const data = await response.json() as any;
        
        console.log('📱 [XAMAN] Received payload:', data);
        console.log('📱 [XAMAN] QR Code length:', data.qrCode ? data.qrCode.length : 'NO QR CODE');
        console.log('📱 [XAMAN] Deep link:', data.deepLink);
        
        // Use Xumm QR code URL directly (it's already a complete URL)
        const qrDataUrl = data.qrCode || '';
        console.log('📱 [XAMAN] QR Code URL:', qrDataUrl);
        
        setPayload({
          uuid: data.uuid,
          qr: qrDataUrl,
          deepLink: data.deepLink,
          websocket: undefined
        });
        
        // Store external session ID for polling
        localStorage.setItem('external_session_id', data.sessionId || externalSessionId);
        
        // Start polling for status
        setIsPolling(true);
        setStatus('pending');
        
      } catch (error) {
        console.error('Failed to create auth payload:', error);
        toast({
          title: "Connection Setup Failed",
          description: "Unable to establish connection with Xaman. Please ensure you have Xaman installed and try refreshing the page if the issue persists.",
          variant: "destructive"
        });
      }
    };
    
    createAuthPayload();
  }, [isOpen]);

  // Poll for transaction status
  useEffect(() => {
    if (!isPolling || !payload?.uuid) return;

    const pollStatus = async () => {
      try {
        // Get external session ID for polling
        const externalSessionId = localStorage.getItem('external_session_id');
        
        const response = await fetch(`/api/external-wallets/xaman/poll/${payload.uuid}`, {
          headers: {
            'X-External-Session-ID': externalSessionId || ''
          }
        });
        
        if (response.ok) {
          const data = await response.json() as any;
          
          if ((data.status === 'connected' || data.status === 'signed') && data.result?.account) {
            setStatus('signed');
            setIsPolling(false);
            
            const address = data.result.account;
            
            // CRITICAL: Store wallet connection immediately in walletChainManager
            // This ensures the connection is available for swap and other features
            console.log(`✅ Connected xaman to xrp: ${address}`);
            walletChainManager.connect('xaman', 'xrp', address);
            
            // Also store in localStorage for compatibility
            localStorage.setItem('xrpl_wallet_address', address);
            localStorage.setItem('xrpl_wallet_type', 'xaman');
            
            // Call parent's onSuccess handler which will save to database (if authenticated) and show toast
            if (onSuccess) {
              onSuccess(address);
            }
            
            setTimeout(() => {
              onClose();
            }, 2000);
          } else if (data.status === 'rejected') {
            setStatus('rejected');
            setIsPolling(false);
          } else if (data.status === 'expired') {
            setStatus('expired');
            setIsPolling(false);
            // Offer auto-refresh after short delay
            setTimeout(() => {
              if (status === 'expired') {
                toast({
                  title: "Connection Timed Out",
                  description: `Your ${Math.floor(connectionTimeout / 60)}-minute connection window has expired. Don't worry - click 'Refresh QR Code' below to get a new connection code.`,
                  variant: "destructive"
                });
              }
            }, 1000);
          }
          // Otherwise keep status as 'pending'
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    };

    // Exponential backoff polling: start at 1s, max at 5s
    const getPollingInterval = (attempts: number) => {
      return Math.min(1000 * Math.pow(1.5, attempts), 5000);
    };
    
    let timeoutId: NodeJS.Timeout;
    const schedulePoll = () => {
      const interval = getPollingInterval(pollAttempts);
      timeoutId = setTimeout(async () => {
        await pollStatus();
        setPollAttempts(prev => prev + 1);
        if (isPolling && payload?.uuid) {
          schedulePoll();
        }
      }, interval);
    };
    
    schedulePoll();
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isPolling, payload?.uuid, onSuccess, onClose]);

  // Countdown timer with auto-refresh option
  useEffect(() => {
    if (!isPolling) return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setStatus('expired');
          setIsPolling(false);
          // Show refresh option after expiry
          toast({
            title: "Connection Window Expired",
            description: `Your ${Math.floor(connectionTimeout / 60)}-minute connection session has timed out. This is normal for security - simply click 'Refresh QR Code' to create a fresh connection.`,
            variant: "destructive"
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [isPolling]);

  const handleOpenApp = () => {
    if (payload?.deepLink) {
      // Try to open Xaman app directly
      const xamanAppLink = payload.deepLink.replace('https://xumm.app/', 'xumm://');
      window.open(xamanAppLink, '_blank');
      
      // Fallback to web version
      setTimeout(() => {
        window.open(payload.deepLink, '_blank');
      }, 1000);
    }
  };

  const copyLink = () => {
    if (payload?.deepLink) {
      navigator.clipboard.writeText(payload.deepLink);
      toast({
        title: "Copied!",
        description: "Deep link copied to clipboard"
      });
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getTimeDisplay = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    if (minutes >= 1) {
      return `${minutes} minute${minutes === 1 ? '' : 's'} remaining`;
    }
    return `${seconds} second${seconds === 1 ? '' : 's'} remaining`;
  };

  const getTimeColor = (seconds: number) => {
    const percentage = (seconds / connectionTimeout) * 100;
    if (percentage > 50) return 'text-green-600 dark:text-green-400';
    if (percentage > 25) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const refreshQRCode = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      // Reset states
      setPayload(null);
      setStatus('pending');
      setTimeLeft(connectionTimeout); // Reset to configured timeout
      setPollAttempts(0);
      setIsPolling(false);

      // Get or generate external session ID
      let externalSessionId = localStorage.getItem('external_session_id');
      if (!externalSessionId) {
        externalSessionId = `ext_${crypto.randomUUID()}_${Date.now()}`;
        localStorage.setItem('external_session_id', externalSessionId);
      }

      const response = await fetch('/api/external-wallets/xaman/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-External-Session-ID': externalSessionId
        },
        body: JSON.stringify({
          purpose: 'Connect to RiddleSwap XRPL trading platform (Refreshed)'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to refresh authentication payload');
      }

      const data = await response.json() as any;
      
      console.log('🔄 [XAMAN] Refreshed payload:', data);
      
      const qrDataUrl = data.qrCode || '';
      
      setPayload({
        uuid: data.uuid,
        qr: qrDataUrl,
        deepLink: data.deepLink,
        websocket: undefined
      });
      
      localStorage.setItem('external_session_id', data.sessionId || externalSessionId);
      
      // Start polling again
      setIsPolling(true);
      setStatus('pending');
      
      toast({
        title: "QR Code Refreshed",
        description: "A new QR code has been generated. Please scan it in Xaman."
      });
      
    } catch (error) {
      console.error('Failed to refresh QR code:', error);
      toast({
        title: "Refresh Failed",
        description: "Failed to refresh QR code. Please close and try again.",
        variant: "destructive"
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!payload) {
    return (
      <Dialog open={isOpen} onClose={onClose} maxWidth="md" fullWidth>
        <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto" style={{ zIndex: 60 }}>
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-3">Creating connection...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          <Smartphone className="w-5 h-5" />
          Connect Xaman Wallet
        </span>
        <IconButton size="small" onClick={onClose} data-testid="button-close-xaman-qr">
          <X className="h-4 w-4" />
        </IconButton>
      </DialogTitle>
      <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto" style={{ zIndex: 60 }}>
        
        <div className="space-y-6">
          {/* Status Badge */}
          <div className="flex justify-center">
            {status === 'pending' && (
              <Chip color="default" label="Waiting for signature" size="small" icon={<Clock className="w-3 h-3" />} />
            )}
            {status === 'signed' && (
              <Chip color="success" label="Connected!" size="small" icon={<CheckCircle2 className="w-3 h-3" />} />
            )}
            {status === 'rejected' && (
              <Chip color="error" label="Connection rejected" size="small" icon={<AlertCircle className="w-3 h-3" />} />
            )}
            {status === 'expired' && (
              <Chip color="error" label="Connection expired" size="small" icon={<AlertCircle className="w-3 h-3" />} />
            )}
          </div>

          {/* QR Code */}
          {status === 'pending' && (
            <div className="flex justify-center p-4 bg-white rounded-lg border">
              {payload.qr ? (
                <img 
                  src={payload.qr} 
                  alt="Xaman QR Code" 
                  className="w-48 h-48 object-contain"
                  onError={(e) => {
                    console.error('🚨 QR code image failed to load:', e);
                    console.error('🚨 QR data URL:', payload.qr.substring(0, 100));
                  }}
                  onLoad={() => console.log('✅ QR code image loaded successfully')}
                />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center bg-gray-100 rounded">
                  <span className="text-gray-500">Loading QR Code...</span>
                </div>
              )}
            </div>
          )}

          {/* Instructions */}
          <div className="text-center space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Scan QR code with Xaman app or tap "Open App" below
            </p>
            
            {status === 'pending' && (
              <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Connection Timeout
                  </span>
                </div>
                <div className="text-center">
                  <div className={`text-lg font-bold ${getTimeColor(timeLeft)}`}>
                    {formatTime(timeLeft)}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {getTimeDisplay(timeLeft)}
                  </div>
                  <div className="mt-2 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        timeLeft / connectionTimeout > 0.5 ? 'bg-green-500' : 
                        timeLeft / connectionTimeout > 0.25 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.max(0, (timeLeft / connectionTimeout) * 100)}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Total: {Math.floor(connectionTimeout / 60)} minutes
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            {status === 'pending' && (
              <>
                <Button 
                  onClick={handleOpenApp}
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                  size="large"
                >
                  <Smartphone className="w-4 h-4 mr-2" />
                  Open Xaman App
                </Button>
                
                <div className="flex gap-2">
                  <Button 
                    onClick={copyLink}
                    variant="outlined" 
                    className="flex-1"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Link
                  </Button>
                  <Button 
                    onClick={() => window.open(payload.deepLink, '_blank')}
                    variant="outlined" 
                    className="flex-1"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Web Version
                  </Button>
                </div>
              </>
            )}
            
            {status === 'rejected' && (
              <Button onClick={onClose} className="w-full">
                Close
              </Button>
            )}
            
            {status === 'expired' && (
              <div className="space-y-2">
                <Button 
                  onClick={refreshQRCode} 
                  disabled={isRefreshing}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  data-testid="button-refresh-qr"
                >
                  {isRefreshing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Generating...
                    </>
                  ) : (
                    'Refresh QR Code'
                  )}
                </Button>
                <Button 
                  onClick={onClose} 
                  variant="outlined" 
                  className="w-full"
                  data-testid="button-close-expired"
                >
                  Close
                </Button>
              </div>
            )}
          </div>

          {/* Help Text */}
          <div className="text-xs text-gray-500 text-center p-3 bg-gray-50 dark:bg-gray-800 rounded">
            Don't have Xaman? <a href="https://xaman.app" target="_blank" className="text-blue-500 underline">Download here</a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
