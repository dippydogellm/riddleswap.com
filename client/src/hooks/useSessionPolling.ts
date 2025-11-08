import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';

interface SessionPollingOptions {
  enabled?: boolean;
  interval?: number;
  onSessionFound?: (sessionData: any) => void;
  redirectOnSession?: string;
}

export function useSessionPolling({
  enabled = true,
  interval = 3000,
  onSessionFound,
  redirectOnSession
}: SessionPollingOptions = {}) {
  const [, setLocation] = useLocation();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);

  const checkSession = async () => {
    if (isPollingRef.current) return; // Prevent concurrent requests
    
    try {
      isPollingRef.current = true;
      
      // Check localStorage first for immediate response
      const localToken = localStorage.getItem('sessionToken');
      if (localToken) {
        // Validate with server
        const response = await fetch('/api/session-info', {
          headers: {
            'Authorization': `Bearer ${localToken}`
          }
        });
        
        if (response.ok) {
          const sessionData = await response.json() as any;
          if (sessionData.authenticated && sessionData.userHandle) {
            console.log('🔄 [SESSION POLLING] Session found:', sessionData.userHandle);
            
            // Store session data in sessionStorage for consistency
            const sessionInfo = {
              handle: sessionData.userHandle,
              sessionToken: localToken,
              expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
              walletData: {
                xrpAddress: sessionData.walletAddress,
                ethAddress: sessionData.walletAddress,
                solAddress: sessionData.walletAddress,
                btcAddress: sessionData.walletAddress
              },
              lastActivity: new Date().toISOString()
            };
            
            sessionStorage.setItem('riddle_wallet_session', JSON.stringify(sessionInfo));
            
            // Call callback if provided
            if (onSessionFound) {
              onSessionFound(sessionData);
            }
            
            // Force a page refresh to update all components with new session
            window.dispatchEvent(new Event('storage'));
            
            // Redirect if specified
            if (redirectOnSession) {
              console.log('🔄 [SESSION POLLING] Redirecting to:', redirectOnSession);
              setLocation(redirectOnSession);
            }
            
            // Stop polling once session is found
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            
            return true;
          }
        }
      }
    } catch (error) {
      console.log('🔄 [SESSION POLLING] No session detected yet');
    } finally {
      isPollingRef.current = false;
    }
    
    return false;
  };

  useEffect(() => {
    if (!enabled) return;

    // Check immediately
    checkSession();

    // Set up polling
    intervalRef.current = setInterval(checkSession, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, interval, redirectOnSession]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  return { checkSession };
}
