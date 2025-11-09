/**
 * Transaction Authentication Utility
 * 
 * Provides consistent session token and private key management for all transaction pages.
 * Supports Riddle wallet, Xaman, Joey, and other external wallets.
 * 
 * Usage:
 * ```typescript
 * import { getTransactionAuth, hasPrivateKeyForChain } from '@/utils/transactionAuth';
 * 
 * const auth = await getTransactionAuth('xrpl');
 * if (!auth) {
 *   // Redirect to login or show external wallet prompt
 *   return;
 * }
 * 
 * // Use auth.sessionToken and auth.hasPrivateKey for transaction
 * ```
 */

export interface TransactionAuth {
  sessionToken: string;
  handle: string;
  walletAddress: string;
  hasPrivateKey: boolean;
  walletType: 'riddle' | 'xaman' | 'joey' | 'external';
  chain: 'xrpl' | 'eth' | 'sol' | 'btc' | 'bnb' | 'base' | 'polygon' | 'arbitrum' | 'optimism' | 'avalanche' | 'fantom' | 'zksync' | 'linea';
}

/**
 * Get session token from all possible storage locations
 */
export function getSessionToken(): string | null {
  // Priority order: riddle_session_token, sessionToken, walletSession, cookies
  const token = localStorage.getItem('riddle_session_token') ||
                localStorage.getItem('sessionToken') ||
                localStorage.getItem('nft_session_token');
  
  if (token && token !== 'null' && token !== 'undefined') {
    return token;
  }
  
  // Check sessionStorage for full session data
  try {
    const sessionData = sessionStorage.getItem('riddle_wallet_session') ||
                       sessionStorage.getItem('walletSession');
    if (sessionData) {
      const parsed = JSON.parse(sessionData);
      if (parsed.sessionToken && parsed.sessionToken !== 'null') {
        return parsed.sessionToken;
      }
    }
  } catch (error) {
    console.warn('[transactionAuth] Failed to parse session data:', error);
  }
  
  // Check cookies as last resort (external wallets)
  const cookieToken = getCookie('external_wallet_session') || getCookie('riddle_session_token');
  if (cookieToken && cookieToken !== 'null') {
    return cookieToken;
  }
  
  return null;
}

/**
 * Get cookie value by name
 */
function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    const part = parts.pop();
    return part ? part.split(';').shift() || null : null;
  }
  return null;
}

/**
 * Get wallet address for a specific chain
 */
export function getWalletAddress(chain: string): string | null {
  const chainKey = `${chain.toLowerCase()}_wallet_address`;
  return localStorage.getItem(chainKey) || localStorage.getItem('xrpl_wallet_address');
}

/**
 * Check if user has private keys stored for a specific chain
 */
export function hasPrivateKeyForChain(chain: string): boolean {
  try {
    const sessionData = sessionStorage.getItem('riddle_wallet_session') ||
                       sessionStorage.getItem('walletSession');
    if (!sessionData) return false;
    
    const parsed = JSON.parse(sessionData);
    const hasKeys = parsed?.hasPrivateKeys || false;
    
    // For Riddle wallet, check if keys are available
    if (hasKeys) {
      return true;
    }
    
    // For external wallets (Xaman, Joey), they don't store private keys
    const walletType = parsed?.walletType || 'riddle';
    if (walletType === 'xaman' || walletType === 'joey' || walletType === 'external') {
      return false; // External wallets handle signing themselves
    }
    
    return false;
  } catch (error) {
    console.warn('[transactionAuth] Failed to check private keys:', error);
    return false;
  }
}

/**
 * Detect wallet type (Riddle, Xaman, Joey, External)
 */
export function getWalletType(): 'riddle' | 'xaman' | 'joey' | 'external' {
  // Check for Xaman connection
  const xamanConnected = localStorage.getItem('xrpl_wallet_connected') === 'true';
  const xamanSession = localStorage.getItem('xaman_session_token');
  if (xamanConnected || xamanSession) {
    return 'xaman';
  }
  
  // Check for Joey Wallet
  const joeyConnected = localStorage.getItem('joey_wallet_connected') === 'true';
  if (joeyConnected) {
    return 'joey';
  }
  
  // Check for external wallet session cookie
  const externalSession = getCookie('external_wallet_session');
  if (externalSession) {
    return 'external';
  }
  
  // Check session data for wallet type
  try {
    const sessionData = sessionStorage.getItem('riddle_wallet_session') ||
                       sessionStorage.getItem('walletSession');
    if (sessionData) {
      const parsed = JSON.parse(sessionData);
      return parsed?.walletType || 'riddle';
    }
  } catch (error) {
    // Fallback to riddle
  }
  
  return 'riddle';
}

/**
 * Get complete transaction authentication context for a specific chain
 */
export async function getTransactionAuth(chain: string): Promise<TransactionAuth | null> {
  const sessionToken = getSessionToken();
  if (!sessionToken) {
    console.warn('[transactionAuth] No session token found');
    return null;
  }
  
  const walletAddress = getWalletAddress(chain);
  if (!walletAddress) {
    console.warn('[transactionAuth] No wallet address found for chain:', chain);
    return null;
  }
  
  const walletType = getWalletType();
  const hasPrivateKey = hasPrivateKeyForChain(chain);
  
  // Get handle from session
  let handle = '';
  try {
    const sessionData = sessionStorage.getItem('riddle_wallet_session') ||
                       sessionStorage.getItem('walletSession');
    if (sessionData) {
      const parsed = JSON.parse(sessionData);
      handle = parsed?.handle || parsed?.username || '';
    }
  } catch (error) {
    console.warn('[transactionAuth] Failed to get handle:', error);
  }
  
  // Validate session is still active
  try {
    const response = await fetch('/api/riddle-wallet/session', {
      headers: { 'Authorization': `Bearer ${sessionToken}` }
    });
    
    if (!response.ok) {
      console.warn('[transactionAuth] Session validation failed');
      return null;
    }
  } catch (error) {
    console.error('[transactionAuth] Session validation error:', error);
    return null;
  }
  
  return {
    sessionToken,
    handle,
    walletAddress,
    hasPrivateKey,
    walletType,
    chain: chain.toLowerCase() as any
  };
}

/**
 * Ensure session token is synced across all storage locations
 */
export function syncSessionToken(token: string) {
  if (!token || token === 'null' || token === 'undefined') {
    console.warn('[transactionAuth] Attempted to sync invalid token');
    return;
  }
  
  // Store in all expected locations
  localStorage.setItem('riddle_session_token', token);
  localStorage.setItem('sessionToken', token);
  
  // Update session storage if it exists
  try {
    const sessionData = sessionStorage.getItem('riddle_wallet_session');
    if (sessionData) {
      const parsed = JSON.parse(sessionData);
      parsed.sessionToken = token;
      sessionStorage.setItem('riddle_wallet_session', JSON.stringify(parsed));
    }
  } catch (error) {
    console.warn('[transactionAuth] Failed to update session storage:', error);
  }
  
  console.log('✅ [transactionAuth] Session token synced across all storage locations');
}

/**
 * Clear all session data
 */
export function clearSessionData() {
  // Remove all session tokens
  localStorage.removeItem('riddle_session_token');
  localStorage.removeItem('sessionToken');
  localStorage.removeItem('nft_session_token');
  localStorage.removeItem('xaman_session_token');
  
  // Remove session data
  sessionStorage.removeItem('riddle_wallet_session');
  sessionStorage.removeItem('walletSession');
  
  // Remove wallet addresses
  const chains = ['xrpl', 'eth', 'sol', 'btc', 'bnb', 'base', 'polygon', 'arbitrum', 'optimism', 'avalanche', 'fantom', 'zksync', 'linea'];
  chains.forEach(chain => {
    localStorage.removeItem(`${chain}_wallet_address`);
    localStorage.removeItem(`${chain}_wallet_connected`);
  });
  
  // Remove external wallet flags
  localStorage.removeItem('xrpl_wallet_connected');
  localStorage.removeItem('joey_wallet_connected');
  
  console.log('🧹 [transactionAuth] All session data cleared');
}

/**
 * Check if user is authenticated and session is valid
 */
export async function isAuthenticated(): Promise<boolean> {
  const token = getSessionToken();
  if (!token) return false;
  
  try {
    const response = await fetch('/api/riddle-wallet/session', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.ok;
  } catch (error) {
    console.error('[transactionAuth] Authentication check failed:', error);
    return false;
  }
}
