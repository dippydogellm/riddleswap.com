/**
 * Route Session Wrapper
 * 
 * Ensures every route has proper session context and handles external wallet detection.
 * This wrapper is applied to ALL routes to provide consistent session management.
 */

import { useEffect } from 'react';
import { useSession } from '@/utils/sessionManager';
import { syncSessionToken } from '@/utils/transactionAuth';

interface RouteSessionWrapperProps {
  children: React.ReactNode;
}

export function RouteSessionWrapper({ children }: RouteSessionWrapperProps) {
  const { sessionToken, isLoggedIn } = useSession();

  useEffect(() => {
    // Sync session token across all storage locations on every route change
    if (sessionToken && isLoggedIn) {
      syncSessionToken(sessionToken);
      console.log('✅ [RouteSession] Session token synced for route');
    }
    
    // Check for external wallet connections (Xaman, Joey)
    const xamanConnected = localStorage.getItem('xrpl_wallet_connected') === 'true';
    const joeyConnected = localStorage.getItem('joey_wallet_connected') === 'true';
    
    if (xamanConnected || joeyConnected) {
      console.log('🔗 [RouteSession] External wallet detected:', xamanConnected ? 'Xaman' : 'Joey');
    }
  }, [sessionToken, isLoggedIn]);

  return <>{children}</>;
}
