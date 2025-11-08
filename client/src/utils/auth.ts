// Simple authentication utility for NFT operations
// Now uses centralized session manager
import { sessionManager } from './sessionManager';

let sessionToken: string | null = null;

export const setSessionToken = (token: string) => {
  sessionToken = token;
  // Use standardized session token key
  localStorage.setItem('riddle_session_token', token);
  // Clear legacy keys
  localStorage.removeItem('nft_session_token');
  localStorage.removeItem('sessionToken');
};

export function getSessionToken(): string | null {
  // Use centralized session manager for consistency
  const token = sessionManager.getSessionToken();
  if (token) {
    return token;
  }
  
  // Fallback to direct localStorage access with standardized key
  return localStorage.getItem('riddle_session_token') || 
         localStorage.getItem('sessionToken') || // Legacy fallback
         sessionToken; // In-memory fallback
}

export const clearSessionToken = () => {
  sessionToken = null;
  // Use centralized session manager
  sessionManager.clearSession();
};

// Get connected wallet address from session data
const getConnectedWalletAddress = (): string | null => {
  try {
    const sessionData = sessionStorage.getItem('riddle_wallet_session');
    if (!sessionData) return null;
    
    const parsedSession = JSON.parse(sessionData);
    const walletData = parsedSession.walletData || parsedSession;
    
    // Return XRPL address if it exists
    return walletData?.xrpAddress || null;
  } catch (error) {
    console.warn('Failed to get wallet address from session:', error);
    return null;
  }
};

// Ensure session exists by calling backend
const ensureSession = async (walletAddress?: string) => {
  try {
    // Get wallet address from connected session first, then fallbacks
    const connectedAddress = getConnectedWalletAddress();
    const addressToUse = walletAddress || connectedAddress;
    
    if (!addressToUse) {
      console.warn('No wallet address available for session creation');
      return false;
    }
    
    const response = await fetch('/api/create-session', { 
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ walletAddress: addressToUse })
    });
    const result = await response.json() as any;
    if (result.success) {
      setSessionToken(result.sessionToken);
      console.log('✅ Session ensured for NFT operations');
      return true;
    } else {
      console.warn('Session creation failed:', result.error);
      return false;
    }
  } catch (error) {
    console.warn('Session creation failed:', error);
    return false;
  }
};

// Export ensureSession for manual calls
export { ensureSession };

// Clear any stale legacy tokens on page load
if (typeof window !== 'undefined') {
  // Only clear legacy tokens, let session manager handle the rest
  localStorage.removeItem('nft_session_token');
  
  // Do NOT auto-create sessions - only create when explicitly needed
  // This prevents login loops on pages that don't require authentication
}
