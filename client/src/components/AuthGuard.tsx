import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "@/utils/sessionManager";

interface AuthGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

export function AuthGuard({ children, requireAuth = true }: AuthGuardProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isLoggedIn, isAuthenticated, sessionToken, clearSession } = useSession();
  const [isValidating, setIsValidating] = useState(false);
  const [isValidated, setIsValidated] = useState(false);

  useEffect(() => {
    if (!requireAuth) return;

    const validateAuth = async () => {
      // If we have no session token at all, just mark as not validated but DON'T redirect
      // Let the component decide what to show (login prompt, etc.)
      if (!sessionToken) {
        console.log('🛡️ AuthGuard: No session token found - user not logged in');
        setIsValidated(false);
        return;
      }

      // If we have a token but haven't validated it yet, validate with server
      if (sessionToken && !isValidated && !isValidating) {
        setIsValidating(true);
        console.log('🛡️ AuthGuard: Validating session token with server...');

        try {
          // Validate session with server
          const isValid = await validateSessionWithServer(sessionToken);

          if (isValid) {
            console.log('✅ AuthGuard: Session validated with server, allowing access');
            setIsValidated(true);
          } else {
            console.log('❌ AuthGuard: Session invalid according to server');
            clearSession();
            setLocation('/wallet-login');
            setIsValidated(false);
          }
        } catch (error) {
          console.error('🛡️ AuthGuard: Error validating session:', error);
          // On network errors, be lenient - allow staying on page
          setIsValidated(false);
        } finally {
          setIsValidating(false);
        }
      }
    };

    validateAuth();
  }, [requireAuth, sessionToken, isValidated, isValidating]);

  // Don't show loading if we don't require auth
  if (!requireAuth) {
    return <>{children}</>;
  }

  // Show loading while validating
  if (isValidating) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  // ALWAYS show the content - let components handle their own "not logged in" state
  // Components can check isLoggedIn/isAuthenticated from useSession hook
  // This prevents aggressive redirects and allows users to see the page
  return <>{children}</>;
}

// Helper function to validate session with server
async function validateSessionWithServer(token: string): Promise<boolean> {
  try {
    const response = await fetch('/api/riddle-wallet/session', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      // Short timeout to avoid hanging
      signal: AbortSignal.timeout(5000)
    });

    if (response.ok) {
      const data = await response.json() as any;
      return data.authenticated || data.valid || (data.success && data.authenticated);
    }

    // If 401/403, session is definitely invalid
    if (response.status === 401 || response.status === 403) {
      return false;
    }

    // For other errors (500, 502, network issues), treat as invalid session
    console.warn('🛡️ AuthGuard: Server returned non-auth error:', response.status);
    return false; // Don't allow access on server errors

  } catch (error) {
    console.error('🛡️ AuthGuard: Session validation failed:', error);
    // On network errors, treat as invalid session and redirect to login
    return false;
  }
}
