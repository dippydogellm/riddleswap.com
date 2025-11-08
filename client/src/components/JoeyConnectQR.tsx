import React, { useState, useEffect, useRef } from 'react';
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
import SignClient from '@walletconnect/sign-client';
import { getSdkError } from '@walletconnect/utils';
import QRCode from 'qrcode';
import { walletChainManager } from '@/lib/wallet-chain-manager';

interface JoeyConnectQRProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (address: string) => void;
}

export function JoeyConnectQR({ isOpen, onClose, onSuccess }: JoeyConnectQRProps) {
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
    wcUri?: string;
  } | null>(null);
  
  const signClientRef = useRef<SignClient | null>(null);
  const sessionRef = useRef<any>(null);
  
  // Initialize WalletConnect v2 SignClient and create pairing when modal opens
  useEffect(() => {
    if (!isOpen) return;
    
    const initializeWalletConnect = async () => {
      try {
        console.log('📱 [JOEY] Initializing WalletConnect v2 SignClient...');
        
        // Get project ID from environment variable
  // Centralized wallet env usage
  const { getWalletConnectProjectId, runWalletEnvDiagnostics } = await import('@/lib/wallet-env');
  const projectId = getWalletConnectProjectId();
  runWalletEnvDiagnostics();
        
        // Initialize SignClient if not already initialized
        if (!signClientRef.current) {
          signClientRef.current = await SignClient.init({
            projectId: projectId,
            relayUrl: 'wss://relay.walletconnect.com',
            metadata: {
              name: 'RiddleSwap',
              description: 'Multi-chain DEX and DeFi platform',
              url: window.location.origin,
              icons: [`${window.location.origin}/icon.png`]
            }
          });
          
          console.log('✅ [JOEY] SignClient initialized');
          
          // Set up event listeners for session events
          signClientRef.current.on('session_proposal', handleSessionProposal);
          signClientRef.current.on('session_event', handleSessionEvent);
          signClientRef.current.on('session_update', handleSessionUpdate);
          signClientRef.current.on('session_delete', handleSessionDelete);
        }
        
        // Create a new pairing with QR code
        const { uri, approval } = await signClientRef.current.connect({
          requiredNamespaces: {
            xrpl: {
              methods: [
                'xrpl_signTransaction',
                'xrpl_signMessage',
                'xrpl_getAccount'
              ],
              chains: ['xrpl:1'], // XRPL mainnet
              events: ['accountsChanged', 'chainChanged']
            }
          },
          optionalNamespaces: {
            xrpl: {
              methods: [
                'xrpl_signTransaction',
                'xrpl_signMessage',
                'xrpl_getAccount'
              ],
              chains: ['xrpl:0', 'xrpl:2'], // Also support testnet and devnet
              events: ['accountsChanged', 'chainChanged']
            }
          }
        });
        
        console.log('📱 [JOEY] WalletConnect v2 URI created:', uri);
        
        // Generate QR code using the qrcode library
        const qrCodeDataUrl = await QRCode.toDataURL(uri || '', {
          width: 200,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
        
        console.log('📱 [JOEY] QR Code generated successfully');
        
        // Create Joey wallet deep link with the WalletConnect v2 URI
        const joeyDeepLink = `https://joey.app/wc?uri=${encodeURIComponent(uri || '')}`;
        
        // Generate a UUID for this connection attempt
        const uuid = `joey_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        
        setPayload({
          uuid: uuid,
          qr: qrCodeDataUrl,
          deepLink: joeyDeepLink,
          wcUri: uri
        });
        
        setStatus('pending');
        setIsPolling(true);
        
        // Wait for approval with timeout handling
        const approvalTimeout = setTimeout(() => {
          console.log('⏰ [JOEY] Session approval timeout reached');
          setStatus('expired');
          setIsPolling(false);
        }, connectionTimeout * 1000); // Configurable timeout in milliseconds
        
        approval().then((session) => {
          clearTimeout(approvalTimeout);
          console.log('✅ [JOEY] Session approved:', session);
          sessionRef.current = session;
          
          // Extract XRPL address from the session
          const xrplAccounts = session.namespaces.xrpl?.accounts || [];
          if (xrplAccounts.length > 0) {
            // Format: "xrpl:1:rAddress" - extract the address part
            const fullAccount = xrplAccounts[0];
            const address = fullAccount.split(':')[2] || fullAccount;
            
            handleConnectionSuccess(address);
          } else {
            console.error('❌ [JOEY] No XRPL accounts in session');
            setStatus('rejected');
            setIsPolling(false);
          }
        }).catch((error) => {
          clearTimeout(approvalTimeout);
          console.error('❌ [JOEY] Session approval failed:', error);
          if (error?.message?.includes('User rejected')) {
            setStatus('rejected');
            toast({
              title: "Connection Declined",
              description: "The connection request was declined in your Joey wallet. No worries - you can try connecting again or refresh the QR code for a new session.",
              variant: "destructive"
            });
          } else if (error?.message?.includes('timeout')) {
            setStatus('expired');
            toast({
              title: "Connection Timed Out",
              description: `Your ${Math.floor(connectionTimeout / 60)}-minute connection window expired while waiting for approval. Click 'Refresh Connection' to start a new session with Joey wallet.`,
              variant: "destructive"
            });
          } else {
            setStatus('expired');
            toast({
              title: "Connection Error",
              description: "The WalletConnect session encountered an issue. This usually resolves by refreshing the connection - click 'Refresh Connection' to try again.",
              variant: "destructive"
            });
          }
          setIsPolling(false);
        });
        
      } catch (error) {
        console.error('❌ [JOEY] Failed to initialize WalletConnect:', error);
        toast({
          title: "WalletConnect Error",
          description: "Failed to initialize WalletConnect. Check console for details.",
          variant: "destructive"
        });
        setStatus('rejected');
      }
    };
    
    initializeWalletConnect();
    
    // Cleanup on unmount
    return () => {
      if (signClientRef.current) {
        signClientRef.current.removeListener('session_proposal', handleSessionProposal);
        signClientRef.current.removeListener('session_event', handleSessionEvent);
        signClientRef.current.removeListener('session_update', handleSessionUpdate);
        signClientRef.current.removeListener('session_delete', handleSessionDelete);
      }
    };
  }, [isOpen]);
  
  // Handle session proposal event
  const handleSessionProposal = async (proposal: any) => {
    console.log('📱 [JOEY] Session proposal received:', proposal);
  };
  
  // Handle session event
  const handleSessionEvent = (event: any) => {
    console.log('📱 [JOEY] Session event:', event);
  };
  
  // Handle session update
  const handleSessionUpdate = (update: any) => {
    console.log('📱 [JOEY] Session update:', update);
  };
  
  // Handle session delete
  const handleSessionDelete = (deleted: any) => {
    console.log('📱 [JOEY] Session deleted:', deleted);
    setStatus('rejected');
    setIsPolling(false);
  };
  
  // Handle successful connection
  const handleConnectionSuccess = async (address: string) => {
    setStatus('signed');
    setIsPolling(false);
    
    // CRITICAL: Store wallet connection immediately in walletChainManager
    // This ensures the connection is available for swap and other features
    console.log(`✅ Connected joey to xrp: ${address}`);
    walletChainManager.connect('joey', 'xrp', address);
    
    // Also store in localStorage for compatibility
    localStorage.setItem('xrpl_wallet_address', address);
    localStorage.setItem('xrpl_wallet_type', 'joey');
    
    try {
      // Complete authentication flow to generate session token
      console.log('🔐 [JOEY] Starting authentication flow for address:', address);
      
      // 1. Generate authentication nonce
      const nonceResponse = await fetch('/api/auth-nonce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: address,
          chain: 'xrpl',
          walletType: 'joey'
        })
      });
      
      if (!nonceResponse.ok) {
        throw new Error('Failed to generate authentication nonce');
      }
      
      const nonceData = await nonceResponse.json();
      console.log('✅ [JOEY] Authentication nonce generated');
      
      // 2. Request user to sign authentication message via WalletConnect
      if (!signClientRef.current || !sessionRef.current) {
        throw new Error('WalletConnect session not available for signing');
      }
      
      console.log('📝 [JOEY] Requesting authentication signature from Joey wallet...');
      
      const signatureResult = await signClientRef.current.request({
        topic: sessionRef.current.topic,
        chainId: 'xrpl:1',
        request: {
          method: 'xrpl_signMessage',
          params: {
            message: nonceData.message,
            address: address
          }
        }
      });
      
      console.log('✅ [JOEY] Authentication message signed');
      
      // 3. Verify signature and complete authentication
      const verifyResponse = await fetch('/api/auth-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nonce: nonceData.nonce,
          signature: signatureResult,
          walletAddress: address,
          chain: 'xrpl'
        })
      });
      
      if (!verifyResponse.ok) {
        throw new Error('Authentication verification failed');
      }
      
      const authResult = await verifyResponse.json();
      console.log('✅ [JOEY] Authentication completed successfully');
      
      // SECURITY FIX: Use server-issued token instead of client-generated token
      if (!authResult.sessionToken) {
        throw new Error('Server did not provide session token');
      }
      
      // 4. Store server-issued session token and wallet data
      const sessionData = {
        sessionToken: authResult.sessionToken, // CRITICAL: Use server-issued token
        handle: `joey_${address.slice(0, 8)}`,
        authenticated: true,
        walletData: authResult.wallet,
        walletAddresses: { xrpl: address },
        expiresAt: authResult.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        loginTime: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        autoLogoutEnabled: false,
        autoLogoutMinutes: 60
      };
      
      // Store session in multiple locations for consistency
      sessionStorage.setItem('riddle_wallet_session', JSON.stringify(sessionData));
      localStorage.setItem('riddle_session_token', sessionData.sessionToken);
      localStorage.setItem('sessionToken', sessionData.sessionToken); // Legacy compatibility
      
      console.log('💾 [JOEY] Session data stored successfully');
      
    } catch (error) {
      console.error('❌ [JOEY] Authentication flow failed:', error);
    }
    
    // Call parent's onSuccess handler which will save to database and show toast
    if (onSuccess) {
      onSuccess(address);
    }
    
    setTimeout(() => {
      onClose();
    }, 2000);
  };

  // Poll for connection status (as fallback for backend method)
  useEffect(() => {
    if (!isPolling || !payload?.uuid || signClientRef.current) return; // Skip if using SignClient
    
    const pollStatus = async () => {
      try {
        const externalSessionId = localStorage.getItem('external_session_id');
        
        const response = await fetch(`/api/external-wallets/poll/${payload.uuid}`, {
          headers: {
            'X-External-Session-ID': externalSessionId || ''
          }
        });
        
        if (response.ok) {
          const data = await response.json() as any;
          
          if (data.status === 'connected' && data.address) {
            handleConnectionSuccess(data.address);
          } else if (data.status === 'rejected') {
            setStatus('rejected');
            setIsPolling(false);
          } else if (data.status === 'expired') {
            setStatus('expired');
            setIsPolling(false);
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    };

    const interval = setInterval(pollStatus, 2000);
    return () => clearInterval(interval);
  }, [isPolling, payload?.uuid]);

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
            description: `Your ${Math.floor(connectionTimeout / 60)}-minute Joey wallet connection has timed out. This happens for security - simply click 'Refresh Connection' below to create a fresh session.`,
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
      // Try to open Joey app directly with the deep link
      window.open(payload.deepLink, '_blank');
      
      // Show help message for mobile users
      toast({
        title: "Opening Joey Wallet",
        description: "If the app doesn't open, please install Joey Wallet first"
      });
    }
  };

  const copyWCUri = () => {
    if (payload?.wcUri) {
      navigator.clipboard.writeText(payload.wcUri);
      toast({
        title: "Copied!",
        description: "WalletConnect URI copied to clipboard"
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

  const refreshConnection = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      // Reset states
      setPayload(null);
      setStatus('pending');
      setTimeLeft(connectionTimeout); // Reset to configured timeout
      setPollAttempts(0);
      setIsPolling(false);

      // Clean up existing SignClient session
      if (signClientRef.current && sessionRef.current) {
        try {
          await signClientRef.current.disconnect({
            topic: sessionRef.current.topic,
            reason: getSdkError('USER_DISCONNECTED')
          });
        } catch (error) {
          console.log('🧹 [JOEY] Session cleanup completed');
        }
      }
      sessionRef.current = null;

      // Reinitialize connection with new QR code
      console.log('🔄 [JOEY] Refreshing connection...');
      
      if (signClientRef.current) {
        // Create a new pairing with fresh QR code
        const { uri, approval } = await signClientRef.current.connect({
          requiredNamespaces: {
            xrpl: {
              methods: [
                'xrpl_signTransaction',
                'xrpl_signMessage',
                'xrpl_getAccount'
              ],
              chains: ['xrpl:1'], // XRPL mainnet
              events: ['accountsChanged', 'chainChanged']
            }
          },
          optionalNamespaces: {
            xrpl: {
              methods: [
                'xrpl_signTransaction',
                'xrpl_signMessage',
                'xrpl_getAccount'
              ],
              chains: ['xrpl:0', 'xrpl:2'], // Also support testnet and devnet
              events: ['accountsChanged', 'chainChanged']
            }
          }
        });

        console.log('🔄 [JOEY] New WalletConnect v2 URI created:', uri);

        // Generate fresh QR code
        const qrCodeDataUrl = await QRCode.toDataURL(uri || '', {
          width: 200,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });

        const joeyDeepLink = `https://joey.app/wc?uri=${encodeURIComponent(uri || '')}`;
        const uuid = `joey_refresh_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        setPayload({
          uuid: uuid,
          qr: qrCodeDataUrl,
          deepLink: joeyDeepLink,
          wcUri: uri
        });

        setStatus('pending');
        setIsPolling(true);

        // Wait for approval with timeout
        const approvalTimeout = setTimeout(() => {
          console.log('⏰ [JOEY] Refreshed session approval timeout reached');
          setStatus('expired');
          setIsPolling(false);
        }, connectionTimeout * 1000); // Configurable timeout for refreshed sessions

        approval().then((session) => {
          clearTimeout(approvalTimeout);
          console.log('✅ [JOEY] Refreshed session approved:', session);
          sessionRef.current = session;

          const xrplAccounts = session.namespaces.xrpl?.accounts || [];
          if (xrplAccounts.length > 0) {
            const fullAccount = xrplAccounts[0];
            const address = fullAccount.split(':')[2] || fullAccount;
            handleConnectionSuccess(address);
          } else {
            console.error('❌ [JOEY] No XRPL accounts in refreshed session');
            setStatus('rejected');
            setIsPolling(false);
          }
        }).catch((error) => {
          clearTimeout(approvalTimeout);
          console.error('❌ [JOEY] Refreshed session approval failed:', error);
          setStatus('expired');
          setIsPolling(false);
        });

        toast({
          title: "Connection Refreshed",
          description: "A new QR code has been generated. Please scan it in Joey wallet."
        });

      } else {
        throw new Error('SignClient not initialized');
      }

    } catch (error) {
      console.error('Failed to refresh Joey connection:', error);
      toast({
        title: "Refresh Failed",
        description: "Failed to refresh connection. Please close and try again.",
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
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
          <img src="/images/wallets/joey-logo.png" alt="Joey" className="w-6 h-6" />
          Connect Joey Wallet
        </span>
        <IconButton size="small" onClick={onClose} data-testid="button-close-joey-qr">
          <X className="h-4 w-4" />
        </IconButton>
      </DialogTitle>
      <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto" style={{ zIndex: 60 }}>
        
        <div className="space-y-6">
          {/* Status Badge */}
          <div className="flex justify-center">
            {status === 'pending' && (
              <Chip color="default" label="Waiting for connection" size="small" icon={<Clock className="w-3 h-3" />} />
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
                  alt="Joey Wallet QR Code" 
                  className="w-48 h-48 object-contain"
                  onError={(e) => {
                    console.error('🚨 Joey QR code image failed to load:', e);
                    console.error('🚨 Joey QR data URL:', payload.qr.substring(0, 100));
                  }}
                  onLoad={() => console.log('✅ Joey QR code image loaded successfully')}
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
              Scan QR code with Joey wallet app or tap "Open App" below
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
                  className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                  size="large"
                >
                  <Smartphone className="w-4 h-4 mr-2" />
                  Open Joey Wallet
                </Button>
                
                <div className="flex gap-2">
                  <Button 
                    onClick={copyWCUri}
                    variant="outlined" 
                    className="flex-1"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy URI
                  </Button>
                  <Button 
                    onClick={() => window.open('https://joey.app', '_blank')}
                    variant="outlined" 
                    className="flex-1"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Download App
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
                  onClick={refreshConnection} 
                  disabled={isRefreshing}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  data-testid="button-refresh-joey"
                >
                  {isRefreshing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Refreshing...
                    </>
                  ) : (
                    'Refresh Connection'
                  )}
                </Button>
                <Button 
                  onClick={onClose} 
                  variant="outlined" 
                  className="w-full"
                  data-testid="button-close-joey-expired"
                >
                  Close
                </Button>
              </div>
            )}
          </div>

          {/* Help Text */}
          <div className="text-xs text-gray-500 text-center p-3 bg-gray-50 dark:bg-gray-800 rounded">
            Don't have Joey Wallet? <a href="https://joey.app" target="_blank" className="text-orange-500 underline">Download here</a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
