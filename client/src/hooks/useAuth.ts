import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/utils/sessionManager';

interface AuthData {
  sessionToken: string;
  handle: string;
  authenticated: boolean;
  username?: string;
  walletData?: any;
  walletAddresses?: any;
  expiresAt?: string;
}

/**
 * useAuth hook - Wrapper around useSession for backward compatibility
 * 
 * IMPORTANT: This hook now delegates to SessionManager (via useSession) for all authentication logic.
 * This prevents duplicate authentication checks and infinite redirect loops.
 * 
 * @param redirectToLogin - If true, redirect to login page when not authenticated (handled by AuthGuard)
 */
export function useAuth(redirectToLogin = true) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Use centralized SessionManager instead of duplicate logic
  const session = useSession();
  const [authData, setAuthData] = useState<AuthData | null>(null);

  useEffect(() => {
    // Convert session data to authData format for backward compatibility
    if (session.isLoggedIn && session.sessionToken) {
      console.log('🔍 [AUTH CHECK] Session token found:', session.sessionToken ? 'YES' : 'NO');
      console.log('✅ [AUTH CHECK] Valid session for user:', session.handle);
      
      setAuthData({
        sessionToken: session.sessionToken,
        handle: session.handle || '',
        authenticated: true,
        username: session.username,
        walletData: session.walletData,
        walletAddresses: session.walletAddresses,
        expiresAt: session.expiresAt
      });
    } else {
      console.log('❌ [AUTH CHECK] No valid session found');
      setAuthData(null);
      
      // Only redirect if explicitly requested and not already on login page
      if (redirectToLogin && window.location.pathname !== '/wallet-login') {
        toast({
          title: "Authentication Required",
          description: "Please login with your Riddle wallet to continue",
          variant: "destructive"
        });
        setLocation('/wallet-login');
      }
    }
  }, [session.isLoggedIn, session.sessionToken, session.handle, session.username, 
      session.walletData, session.walletAddresses, session.expiresAt, redirectToLogin, setLocation, toast]);

  return {
    authData,
    isLoading: false, // SessionManager handles loading internally
    isAuthenticated: session.isAuthenticated,
    sessionToken: session.sessionToken || null,
    handle: session.handle || null,
    walletData: session.walletData || null,
    walletAddresses: session.walletAddresses || null,
    // Add user object for compatibility with components expecting it
    user: {
      walletAddress: session.walletData?.xrpAddress || session.walletAddresses?.xrpAddress || null,
      handle: session.handle || null,
      xrpAddress: session.walletAddresses?.xrpAddress || session.walletData?.xrpAddress || null,
      ethAddress: session.walletAddresses?.ethAddress || session.walletData?.ethAddress || null,
      solAddress: session.walletAddresses?.solAddress || session.walletData?.solAddress || null,
      btcAddress: session.walletAddresses?.btcAddress || session.walletData?.btcAddress || null
    }
  };
}
