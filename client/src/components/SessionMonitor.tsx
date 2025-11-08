import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { clearAllWalletData } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { SessionExtensionModal } from './SessionExtensionModal';

export function SessionMonitor() {
  // DISABLED: SessionMonitor is now replaced by SessionManager to prevent conflicts
  // All session management is handled by the unified SessionManager
  console.log('🚫 SessionMonitor: DISABLED - Using unified SessionManager instead');
  
  return null;
  
  // OLD CODE DISABLED TO PREVENT CONFLICTS:
  /*
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const hasShownExpiredToast = useRef(false);
  const [showExtensionModal, setShowExtensionModal] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const hasShownExtensionModal = useRef(false);

  useEffect(() => {
    let sessionCheckInterval: NodeJS.Timeout | null = null;
    let hasCheckedOnce = false;
    
    const checkSession = async () => {
      // Check session validity
      const sessionToken = localStorage.getItem('sessionToken');
      const sessionData = sessionStorage.getItem('riddle_wallet_session');
      
      if (!sessionToken && !sessionData) {
        // No session exists - only clear once and stop checking
        if (!hasCheckedOnce) {
          console.log('🔍 SessionMonitor: No session found - clearing any stale data');
          clearAllWalletData();
          hasCheckedOnce = true;
        }
        
        // Stop interval when no session
        if (sessionCheckInterval) {
          clearInterval(sessionCheckInterval);
          sessionCheckInterval = null;
        }
        return;
      }

      // Check local session expiry first (from sessionStorage)
      if (sessionData) {
        try {
          const session = JSON.parse(sessionData);
          if (session.expiresAt) {
            const now = Date.now();
            const timeUntilExpiry = session.expiresAt - now;
            const fiveMinutes = 5 * 60 * 1000; // 5 minutes in ms
            
            // Show extension modal if session expires in 5 minutes or less
            if (timeUntilExpiry <= fiveMinutes && timeUntilExpiry > 0 && !hasShownExtensionModal.current) {
              console.log('⏰ Session expiring soon - showing extension modal');
              hasShownExtensionModal.current = true;
              setTimeRemaining(Math.floor(timeUntilExpiry / 1000));
              setShowExtensionModal(true);
              return;
            }
            
            // Session already expired
            if (timeUntilExpiry <= 0) {
              console.log('❌ Session has expired - clearing all data');
              handleSessionExpired();
              return;
            }
          }
        } catch (error) {
          console.error('Error parsing session data:', error);
        }
      }

      // Verify session with server
      if (sessionToken) {
        try {
          const response = await fetch('/api/riddle-wallet/session', {
            headers: {
              'Authorization': `Bearer ${sessionToken}`
            }
          });

          if (!response.ok) {
            // Session expired or invalid
            console.log('❌ Session invalid or expired - clearing all data');
            handleSessionExpired();
          } else {
            // Session is valid - reset the flags
            hasShownExpiredToast.current = false;
            hasShownExtensionModal.current = false;
            hasCheckedOnce = true;
          }
        } catch (error) {
          console.error('Session check failed:', error);
        }
      }
    };

    const handleSessionExpired = () => {
      clearAllWalletData();
      setShowExtensionModal(false);
      
      // Stop checking after session expires
      if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
        sessionCheckInterval = null;
      }
      
      // Show toast only once
      if (!hasShownExpiredToast.current) {
        hasShownExpiredToast.current = true;
        toast({
          title: "Session Expired",
          description: "Please login again to continue",
          variant: "destructive"
        });
        
        // Redirect to login after a short delay
        setTimeout(() => {
          setLocation('/wallet-login');
        }, 2000);
      }
    };

    // Check session immediately
    checkSession();

    // Only check periodically if we have a session
    const sessionToken = localStorage.getItem('sessionToken');
    const sessionData = sessionStorage.getItem('riddle_wallet_session');
    
    if (sessionToken || sessionData) {
      // Check session every 2 minutes (much less aggressive)
      sessionCheckInterval = setInterval(checkSession, 120000);
    }

    // Listen for storage events (logout from another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'sessionToken') {
        if (!e.newValue) {
          // Session was cleared in another tab
          console.log('🔄 Session cleared in another tab - syncing...');
          clearAllWalletData();
          if (sessionCheckInterval) {
            clearInterval(sessionCheckInterval);
            sessionCheckInterval = null;
          }
          window.location.href = '/';
        } else {
          // New session - restart checking
          checkSession();
          if (!sessionCheckInterval) {
            sessionCheckInterval = setInterval(checkSession, 120000);
          }
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
      }
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [toast]);

  // Handle session extension
  const handleExtendSession = async (): Promise<boolean> => {
    try {
      const sessionToken = localStorage.getItem('sessionToken');
      if (!sessionToken) {
        return false;
      }

      const response = await fetch('/api/session/extend', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json() as any;
        console.log('✅ Session extended successfully:', data);
        
        // Update session data in sessionStorage
        const sessionData = sessionStorage.getItem('riddle_wallet_session');
        if (sessionData) {
          const session = JSON.parse(sessionData);
          session.expiresAt = data.expiresAt;
          session.lastActivity = new Date().toISOString();
          sessionStorage.setItem('riddle_wallet_session', JSON.stringify(session));
        }
        
        // Reset extension modal flag so it can show again later
        hasShownExtensionModal.current = false;
        setShowExtensionModal(false);
        
        return true;
      } else {
        console.error('Failed to extend session:', response.statusText);
        return false;
      }
    } catch (error) {
      console.error('Error extending session:', error);
      return false;
    }
  };

  // Handle logout
  const handleLogout = () => {
    console.log('🔐 User chose to logout');
    clearAllWalletData();
    setShowExtensionModal(false);
    setLocation('/wallet-login');
  };

  return (
    <>
      <SessionExtensionModal
        isOpen={showExtensionModal}
        onExtend={handleExtendSession}
        onLogout={handleLogout}
        timeRemaining={timeRemaining}
      />
    </>
  );
  */
}
