import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { XamanQRModal } from './XamanQRModal';
import { LogIn, LogOut, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface XamanAuthButtonProps {
  isConnected?: boolean;
  onAuthSuccess?: (data: any) => void;
  onAuthError?: (error: string) => void;
  onDisconnect?: () => void;
  className?: string;
  size?: 'default' | 'sm' | 'lg' | 'icon';
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
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

export function XamanAuthButton({
  isConnected = false,
  onAuthSuccess,
  onAuthError,
  onDisconnect,
  className,
  size = 'default',
  variant = 'default'
}: XamanAuthButtonProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [payload, setPayload] = useState<XamanPayload | null>(null);

  const handleSignIn = async () => {
    try {
      setIsLoading(true);
      
      // Get or create external session ID
      let sessionId = localStorage.getItem('externalSessionId');
      if (!sessionId) {
        sessionId = `ext_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem('externalSessionId', sessionId);
      }

      console.log('🔐 [XAMAN AUTH] Initiating sign-in...');

      const response = await fetch('/api/external-wallets/xaman/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-external-session-id': sessionId
        },
        body: JSON.stringify({
          payloadType: 'signin',
          purpose: 'Authentication for Riddle.app'
        })
      });

      if (!response.ok) {
        const errorData = await response.json() as any;
        throw new Error(errorData.error || 'Failed to create authentication request');
      }

      const data = await response.json() as any;
      console.log('✅ [XAMAN AUTH] Payload created:', data.uuid);

      setPayload(data);
      setShowModal(true);

    } catch (error) {
      console.error('❌ [XAMAN AUTH] Sign-in error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to initiate sign-in';
      onAuthError?.(errorMessage);
      toast({
        title: "Authentication Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = () => {
    // Clear external session data
    localStorage.removeItem('externalSessionId');
    localStorage.removeItem('xamanAuthData');
    
    onDisconnect?.();
    toast({
      title: "Signed Out",
      description: "You have been signed out successfully"
    });
  };

  const handleAuthSuccess = (data: any) => {
    console.log('✅ [XAMAN AUTH] Authentication successful:', data);
    
    // Store authentication data
    localStorage.setItem('xamanAuthData', JSON.stringify({
      authenticated: true,
      timestamp: Date.now(),
      payload: data
    }));

    setShowModal(false);
    onAuthSuccess?.(data);
    toast({
      title: "Authentication Successful",
      description: "You have been signed in with Xaman"
    });
  };

  const handleAuthError = (error: string) => {
    console.error('❌ [XAMAN AUTH] Authentication failed:', error);
    setShowModal(false);
    onAuthError?.(error);
    toast({
      title: "Authentication Failed",
      description: error,
      variant: "destructive"
    });
  };

  const handleModalClose = () => {
    setShowModal(false);
    setPayload(null);
  };

  const handleExpiry = () => {
    setShowModal(false);
    setPayload(null);
    toast({
      title: "Request Expired",
      description: "The authentication request has expired. Please try again.",
      variant: "destructive"
    });
  };

  if (isConnected) {
    return (
      <Button
        onClick={handleSignOut}
        variant={variant}
        size={size}
        className={className}
        data-testid="button-xaman-signout"
      >
        <LogOut className="w-4 h-4 mr-2" />
        Sign Out
      </Button>
    );
  }

  return (
    <>
      <Button
        onClick={handleSignIn}
        disabled={isLoading}
        variant={variant}
        size={size}
        className={className}
        data-testid="button-xaman-signin"
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <LogIn className="w-4 h-4 mr-2" />
        )}
        {isLoading ? 'Connecting...' : 'Sign in with Xaman'}
      </Button>

      {payload && (
        <XamanQRModal
          isOpen={showModal}
          onClose={handleModalClose}
          qrCode={payload.qrCode}
          deepLink={payload.deepLink}
          webLink={payload.webLink}
          uuid={payload.uuid}
          payloadType="signin"
          description={payload.description}
          instructions={payload.instructions}
          expiresIn={payload.expiresIn}
          onSuccess={handleAuthSuccess}
          onError={handleAuthError}
          onExpiry={handleExpiry}
        />
      )}
    </>
  );
}
