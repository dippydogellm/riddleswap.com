import React, { useState, useEffect } from 'react';
import { WalletLoginForm } from './WalletLoginForm';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SessionManagerProps {
  children: (sessionData: any, isAuthenticated: boolean) => React.ReactNode;
  onSessionChange?: (sessionData: any, isAuthenticated: boolean) => void;
}

export function SessionManager({ children, onSessionChange }: SessionManagerProps) {
  const [sessionData, setSessionData] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [error, setError] = useState('');

  // Check and validate session
  const checkSession = async (sessionToken?: string) => {
    try {
      // Get session token from storage if not provided
      if (!sessionToken) {
        sessionToken = localStorage.getItem('sessionToken') || undefined;
        
        if (!sessionToken) {
          const sessionStorageData = sessionStorage.getItem('riddle_wallet_session');
          if (sessionStorageData) {
            try {
              const parsed = JSON.parse(sessionStorageData);
              sessionToken = parsed.sessionToken || undefined;
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      if (!sessionToken) {
        setIsAuthenticated(false);
        setSessionData(null);
        setIsLoading(false);
        return false;
      }

      const response = await fetch('/api/riddle-wallet/session', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });

      if (response.ok) {
        const data = await response.json() as any;
        setSessionData(data);
        setIsAuthenticated(true);
        setSessionExpired(false);
        setError('');
        
        // Update both localStorage and sessionStorage with wallet data
        sessionStorage.setItem('riddle_wallet_session', JSON.stringify({
          sessionToken,
          handle: data.handle,
          authenticated: true,
          walletData: data.walletData || data.walletAddresses || data,
          username: data.username,
          timestamp: Date.now()
        }));
        
        if (data.walletAddresses) {
          localStorage.setItem('riddle_wallet_data', JSON.stringify({
            sessionToken,
            walletAddresses: data.walletAddresses,
            authenticated: true,
            timestamp: Date.now()
          }));
        }

        if (onSessionChange) {
          onSessionChange(data, true);
        }
        
        setIsLoading(false);
        return true;
      } else if (response.status === 401) {
        // Session expired
        setSessionExpired(true);
        setIsAuthenticated(false);
        setSessionData(null);
        
        // Clear invalid tokens
        localStorage.removeItem('sessionToken');
        sessionStorage.removeItem('riddle_wallet_session');
        
        if (onSessionChange) {
          onSessionChange(null, false);
        }
        
        setIsLoading(false);
        return false;
      } else {
        throw new Error('Session validation failed');
      }
    } catch (err) {
      setError('Unable to validate session');
      setIsAuthenticated(false);
      setSessionData(null);
      setIsLoading(false);
      return false;
    }
  };

  // Auto-login disabled - users must login manually
  const attemptAutoLogin = async () => {
    // Auto-login removed - user must provide credentials
    return false;
  };

  // Handle successful login
  const handleLoginSuccess = async (loginData: any) => {
    const { sessionToken } = loginData;
    
    // Store session token and wallet data
    localStorage.setItem('sessionToken', sessionToken);
    sessionStorage.setItem('riddle_wallet_session', JSON.stringify({
      sessionToken,
      handle: loginData.handle,
      authenticated: true,
      walletData: loginData.walletData || loginData,
      username: loginData.username,
      timestamp: Date.now()
    }));

    // Update state immediately
    setSessionData(loginData);
    setIsAuthenticated(true);
    setSessionExpired(false);
    setError('');

    if (onSessionChange) {
      onSessionChange(loginData, true);
    }

    // Validate the session to get full wallet data
    await checkSession(sessionToken);
  };

  // Initial session check
  useEffect(() => {
    const initializeSession = async () => {
      // First try to validate existing session
      const hasValidSession = await checkSession();
      
      // If no valid session, try auto-login
      if (!hasValidSession) {
        const autoLoginSuccess = await attemptAutoLogin();
        if (!autoLoginSuccess) {
          setIsLoading(false);
        }
      }
    };

    initializeSession();
  }, []);

  // Listen for session expiration events from API requests
  useEffect(() => {
    const handleSessionExpired = () => {
      console.log('🔓 SessionManager: Session expired event received');
      setSessionExpired(true);
      setIsAuthenticated(false);
      setSessionData(null);
      setIsLoading(false);
      
      if (onSessionChange) {
        onSessionChange(null, false);
      }
    };

    window.addEventListener('sessionExpired', handleSessionExpired);
    return () => window.removeEventListener('sessionExpired', handleSessionExpired);
  }, [onSessionChange]);

  // Session refresh handler
  const refreshSession = () => {
    setIsLoading(true);
    setError('');
    checkSession();
  };

  // Logout handler
  const logout = () => {
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('riddle_wallet_data');
    sessionStorage.removeItem('riddle_wallet_session');
    
    setSessionData(null);
    setIsAuthenticated(false);
    setSessionExpired(false);
    
    if (onSessionChange) {
      onSessionChange(null, false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Session expired state
  if (sessionExpired) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Your session has expired. Please sign in again to continue.
          </AlertDescription>
        </Alert>
        <WalletLoginForm onLoginSuccess={handleLoginSuccess} />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <div className="text-center">
          <Button onClick={refreshSession} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Not authenticated state
  if (!isAuthenticated) {
    return <WalletLoginForm onLoginSuccess={handleLoginSuccess} />;
  }

  // Authenticated state - render children
  return (
    <div>
      {children(sessionData, isAuthenticated)}
      
      {/* Session controls */}
      <div className="mt-4 text-center">
        <Button onClick={logout} variant="ghost" size="sm">
          Sign Out
        </Button>
      </div>
    </div>
  );
}
