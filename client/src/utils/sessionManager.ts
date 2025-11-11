// Centralized session management for proper synchronization
// This ensures all components use the same session state
import { useEffect, useState } from 'react';
import { toast } from '@/hooks/use-toast';

// Standardized session data interface
interface SessionData {
  sessionToken: string;
  handle: string;
  username?: string;
  authenticated: boolean;
  walletData?: any;
  walletAddresses?: any;
  expiresAt?: string;
  loginTime: string;
  lastActivity: string;
  autoLogoutEnabled: boolean;
  autoLogoutMinutes: number;
}

class SessionManager {
  private sessionToken: string | null = null;
  private sessionData: SessionData | null = null;
  private listeners: Set<() => void> = new Set();
  private pollInterval: NodeJS.Timeout | null = null;
  private isChecking = false;
  private consecutiveFailures = 0;
  private maxConsecutiveFailures = 3;
  
  // Standardized storage keys
  private readonly TOKEN_KEY = 'riddle_session_token';
  private readonly SESSION_KEY = 'riddle_wallet_session';

  constructor() {
    console.log('🚀 [SessionManager] Initializing...');
    
    // Initialize from storage using priority order
    this.loadSessionFromStorage();
    
    // Only start polling if we have session data
    if (this.sessionToken || this.sessionData) {
      console.log('✅ [SessionManager] Found existing session - starting polling');
      this.startPolling();
    } else {
      console.log('⚡ [SessionManager] No existing session - polling disabled until login');
    }
    
    // Listen for storage events (login from another tab)
    window.addEventListener('storage', this.handleStorageChange);
  }

  private handleStorageChange = (e: StorageEvent) => {
    if (e.key === this.TOKEN_KEY || e.key === this.SESSION_KEY) {
      this.loadSessionFromStorage();
      this.checkSession();
    }
  };

  // Helper to read cookie value
  private getCookie(name: string): string | null {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
  }

  // Load session data from storage with consistent priority
  private loadSessionFromStorage() {
    try {
      // UNIFIED APPROACH: Check multiple possible token locations for compatibility
      const token = localStorage.getItem(this.TOKEN_KEY) || 
                   localStorage.getItem('sessionToken') || // Legacy fallback
                   localStorage.getItem('nft_session_token') || // Legacy NFT fallback
                   this.getCookie('external_wallet_session'); // External wallet session from cookie
      
      // FIX: Convert string "null" to actual null to prevent auth failures
      this.sessionToken = (token && token !== 'null' && token !== 'undefined') ? token : null;
      
      // Then check sessionStorage for full session data
      const sessionData = sessionStorage.getItem(this.SESSION_KEY) ||
                         sessionStorage.getItem('walletSession'); // Legacy fallback
                         
      if (sessionData) {
        const parsed = JSON.parse(sessionData);
        if (parsed.sessionToken && (parsed.handle || parsed.username)) {
          this.sessionData = parsed;
          this.sessionToken = parsed.sessionToken;
          // CONSISTENCY FIX: Store in ALL expected locations (but never store null as string)
          if (parsed.sessionToken && parsed.sessionToken !== 'null') {
            localStorage.setItem(this.TOKEN_KEY, parsed.sessionToken);
            localStorage.setItem('sessionToken', parsed.sessionToken); // Ensure legacy compatibility
          }
        }
      }
      
      // If we found a token but no session data, try to validate it immediately
      if (this.sessionToken && !this.sessionData) {
        console.log('🔄 Found token but no session data - will validate immediately');
        // Don't clear here, let checkSession handle validation
      }
    } catch (error) {
      console.error('Failed to load session from storage:', error);
      this.clearSession();
    }
  }

  // Check session validity with server
  async checkSession(): Promise<boolean> {
    if (this.isChecking) return !!this.sessionData;
    
    this.isChecking = true;
    
    try {
      const storedToken = localStorage.getItem(this.TOKEN_KEY);
      const cookieToken = this.getCookie('external_wallet_session');
      const token = this.sessionToken || 
                   ((storedToken && storedToken !== 'null' && storedToken !== 'undefined') ? storedToken : null) ||
                   cookieToken;
      
      if (!token) {
        // Check if backend has an active session even without local token
        const backendSession = await this.checkBackendSession();
        if (backendSession) {
          return true;
        }
        // DON'T clear session aggressively - just return false
        // Let pages that don't need auth work normally
        return false;
      }

      // Determine if this is an external wallet token (Joey, Xaman, etc.)
      const isExternalWalletToken = token.startsWith('joey_') || token.startsWith('xaman_') || token.startsWith('ext_');
      
      // Define wallet info variables for scope
      let walletAddress: string | null = null;
      let walletType: string | null = null; 
      let chain: string = 'xrpl';
      let response: Response;
      
      if (isExternalWalletToken) {
        // For external wallet tokens, check if we have wallet address info to validate
        walletAddress = localStorage.getItem('xrpl_wallet_address') || 
                       localStorage.getItem('eth_wallet_address') ||
                       localStorage.getItem('sol_wallet_address');
        walletType = localStorage.getItem('xrpl_wallet_type') || 
                    localStorage.getItem('eth_wallet_type') ||
                    localStorage.getItem('sol_wallet_type');
        chain = token.startsWith('joey_') || token.startsWith('xaman_') ? 'xrpl' : 
                localStorage.getItem('eth_wallet_address') ? 'eth' : 
                localStorage.getItem('sol_wallet_address') ? 'sol' : 'xrpl';
        
        if (walletAddress && walletType) {
          // SECURITY FIX: Send Authorization header for external wallet auth check
          response = await fetch(`/api/auth-status/${walletAddress}/${chain}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}` // CRITICAL: Send Authorization header
            }
          });
        } else {
          // External wallet token without wallet info - likely stale
          console.log('⚠️ SessionManager: External wallet token without wallet info - marking as invalid');
          return false; // Don't clear, just return false
        }
      } else {
        // Check with stable Riddle wallet session endpoint
        response = await fetch('/api/riddle-wallet/session', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
      }

      if (response.ok) {
        const serverData = await response.json() as any;
        
        // Reset failure counter on successful response
        this.consecutiveFailures = 0;
        
        // Check if session needs renewal (private keys missing)
        if (serverData.needsRenewal && serverData.authenticated) {
          console.log('⚠️ SessionManager: Session needs renewal - private keys missing');
          // Signal that renewal is needed - safely handle null/undefined sessionData
          this.sessionData = {
            ...(this.sessionData ?? {}), // Safe spread with default empty object
            sessionToken: token,
            handle: serverData.handle || serverData.username,
            username: serverData.username || serverData.handle,
            authenticated: true,
            walletData: serverData.walletData || serverData.walletAddresses, // FIXED: Use actual wallet data
            walletAddresses: serverData.walletAddresses,
            expiresAt: serverData.expiresAt,
            loginTime: this.sessionData?.loginTime || new Date().toISOString(),
            lastActivity: new Date().toISOString(),
            autoLogoutEnabled: this.sessionData?.autoLogoutEnabled || false,
            autoLogoutMinutes: this.sessionData?.autoLogoutMinutes || 30,
            needsRenewal: true // Add flag for UI to show renewal modal
          } as any;
          
          // Store in localStorage and sessionStorage
          localStorage.setItem(this.TOKEN_KEY, token);
          sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(this.sessionData));
          
          this.notifyListeners();
          console.log('🔔 SessionManager: Notified listeners about session renewal needed');
          return true; // Session exists but needs renewal
        }
        
        if (serverData.valid || (serverData.success && serverData.authenticated) || serverData.authenticated) {
          console.log('✅ SessionManager: Valid session for', serverData.username || serverData.handle || `External wallet ${walletType || 'user'}`);
          
          // Handle different response formats for external vs riddle wallets
          const handle = isExternalWalletToken ? 
            `${walletType || 'external'}_${(walletAddress || '').slice(0, 8)}` : 
            serverData.handle || serverData.username;
          
          // Update session data with server response
          this.sessionToken = token;
          this.sessionData = {
            sessionToken: token,
            handle: handle,
            username: serverData.username || handle,
            authenticated: true,
            walletData: isExternalWalletToken ? { 
              walletType: walletType,
              address: walletAddress,
              chain: chain,
              ...serverData.wallet 
            } : serverData.walletData,
            walletAddresses: serverData.walletAddresses,
            expiresAt: serverData.expiresAt,
            loginTime: this.sessionData?.loginTime || new Date().toISOString(),
            lastActivity: new Date().toISOString(),
            autoLogoutEnabled: this.sessionData?.autoLogoutEnabled || false,
            autoLogoutMinutes: this.sessionData?.autoLogoutMinutes || 30
          };
          
          // Store consistently in both localStorage and sessionStorage
          localStorage.setItem(this.TOKEN_KEY, token);
          sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(this.sessionData));
          
          // Notify all listeners
          this.notifyListeners();
          return true;
        }
      } else {
        // CRITICAL FIX: Check if this is a session renewal request (401 with needsRenewal flag)
        if (response.status === 401) {
          try {
            const errorData = await response.json() as any;
            if (errorData.needsRenewal && errorData.authenticated) {
              console.log('⚠️ SessionManager: 401 but session needs renewal, not expired');
              // Keep session but mark it as needing renewal
              this.sessionData = {
                ...(this.sessionData ?? {}),
                sessionToken: token,
                handle: errorData.handle || errorData.username,
                username: errorData.username || errorData.handle,
                authenticated: true,
                walletData: errorData.walletData || errorData.walletAddresses,
                walletAddresses: errorData.walletAddresses,
                expiresAt: errorData.expiresAt,
                loginTime: this.sessionData?.loginTime || new Date().toISOString(),
                lastActivity: new Date().toISOString(),
                autoLogoutEnabled: this.sessionData?.autoLogoutEnabled || false,
                autoLogoutMinutes: this.sessionData?.autoLogoutMinutes || 30,
                needsRenewal: true
              } as any;
              
              localStorage.setItem(this.TOKEN_KEY, token);
              sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(this.sessionData));
              
              this.notifyListeners();
              console.log('🔔 SessionManager: Session marked for renewal, not clearing');
              return true; // Keep session alive but flag for renewal
            }
          } catch (jsonError) {
            console.log('⚠️ SessionManager: Could not parse 401 response JSON');
          }
        }
        
        // Increment failure counter on 401/403 only if NOT a renewal request
        if (response.status === 401 || response.status === 403) {
          this.consecutiveFailures++;
          console.log(`⚠️ SessionManager: Session check failed (${this.consecutiveFailures}/${this.maxConsecutiveFailures})`);
        }
      }
      
// DEPLOYMENT FIX: Be more lenient with session validation failures
      // Only clear session for specific auth failures, not network errors or temporary issues
      const shouldClearSession = response.status === 401 || response.status === 403;
      
      if (shouldClearSession) {
        console.log('❌ SessionManager: Session explicitly invalid (401/403) - clearing local session');
        this.clearSession();
        return false;
      } else {
        // For other errors (network, server errors), preserve existing session but don't mark as valid
        // If we have existing session data, continue to use it (don't clear)
        if (this.sessionData) {
          return true;
        }
        
        return false;
      }
      
    } catch (error) {
      console.error('SessionManager: Check failed:', error);
      
      // DEPLOYMENT FIX: Be more forgiving with network errors
      // Only clear session if it's clearly an authentication issue
      const err = error as Error;
      const isNetworkError = error instanceof TypeError && err.message.includes('fetch');
      const isConnectionError = err.message?.includes('Failed to fetch') || 
                               err.message?.includes('network') ||
                               err.message?.includes('connection');
      
      if (isNetworkError || isConnectionError) {
        // Keep existing session data for network errors - don't clear it
        return !!this.sessionData;
      }
      
      // For other errors, still keep session data but be cautious
      return !!this.sessionData;
    } finally {
      this.isChecking = false;
    }
  }

  // Check backend session without local token (for session restore)
  private async checkBackendSession(): Promise<boolean> {
    try {
      // Check with session-info endpoint which can detect sessions via cookies
      const response = await fetch('/api/riddle-wallet/session-info', {
        method: 'GET',
        credentials: 'include', // Important: include cookies
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const sessionInfo = await response.json() as any;
        
        if (sessionInfo.authenticated && sessionInfo.sessionToken) {
          console.log('✅ SessionManager: Found backend session for user:', sessionInfo.handle);
          
          // Store the session data locally
          this.sessionToken = sessionInfo.sessionToken;
          this.sessionData = {
            sessionToken: sessionInfo.sessionToken,
            handle: sessionInfo.handle,
            username: sessionInfo.username || sessionInfo.handle,
            authenticated: true,
            walletData: sessionInfo.walletAddresses,
            walletAddresses: sessionInfo.walletAddresses,
            expiresAt: sessionInfo.expiresAt,
            loginTime: new Date().toISOString(),
            lastActivity: new Date().toISOString(),
            autoLogoutEnabled: false,
            autoLogoutMinutes: 30
          };
          
          // Store in browser storage for persistence
          localStorage.setItem(this.TOKEN_KEY, sessionInfo.sessionToken);
          sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(this.sessionData));
          
          // Notify listeners
          this.notifyListeners();
          
          return true;
        }
      }
      
      // Check if there might be a restored session that needs reconnection
      this.checkForReconnectionNeeded();
      
      return false;
      
    } catch (error) {
      console.error('❌ SessionManager: Backend session check failed:', error);
      return false;
    }
  }

  // Redirect to login page when session is not found
  private checkForReconnectionNeeded() {
    // Check if we're on a page that requires auth
    const currentPath = window.location.pathname;
    
    // NFT marketplaces (XRPL, ETH, SOL) should be public - only NFT detail pages require auth
    const isNFTDetailPage = currentPath.startsWith('/nft/') && !currentPath.startsWith('/nft-');
    const requiresAuth = currentPath.includes('/gaming') || currentPath.includes('/profile') || 
                        currentPath.includes('/wallet') || isNFTDetailPage;
    
    if (requiresAuth && currentPath !== '/wallet-login' && currentPath !== '/create-wallet') {
      console.log('🔄 SessionManager: Auth required but no session - redirecting to login');
      
      // Store the intended destination for after login
      sessionStorage.setItem('post_login_redirect', currentPath);
      
      // Redirect to login page
      window.location.href = '/wallet-login';
    }
  }

  // Method to attempt reconnection with user credentials
  async attemptReconnection(handle: string, password: string): Promise<boolean> {
    try {
      console.log(`🔗 SessionManager: Attempting reconnection for handle: ${handle}`);
      
      const response = await fetch('/api/riddle-wallet/reconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ handle, password })
      });

      if (response.ok) {
        const data = await response.json() as any;
        
        if (data.success && data.sessionToken) {
          console.log('✅ SessionManager: Reconnection successful');
          
          // Update session data
          this.sessionToken = data.sessionToken;
          this.sessionData = {
            sessionToken: data.sessionToken,
            handle: handle,
            username: handle,
            authenticated: true,
            walletData: data.walletData,
            walletAddresses: data.walletData,
            expiresAt: data.expiresAt,
            loginTime: new Date().toISOString(),
            lastActivity: new Date().toISOString(),
            autoLogoutEnabled: false,
            autoLogoutMinutes: 30
          };
          
          // Store in browser storage
          localStorage.setItem(this.TOKEN_KEY, data.sessionToken);
          sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(this.sessionData));
          
          // Clear reconnection flags
          sessionStorage.removeItem('needs_reconnection');
          localStorage.removeItem('last_auth_attempt');
          
          // Notify listeners
          this.notifyListeners();
          
          return true;
        }
      }
      
      const errorData = await response.json() as any;
      console.log('❌ SessionManager: Reconnection failed:', errorData.error);
      return false;
      
    } catch (error) {
      console.error('❌ SessionManager: Reconnection error:', error);
      return false;
    }
  }

  // Get the path to redirect to after login
  getPostLoginPath(): string {
    return sessionStorage.getItem('post_login_redirect') || '/';
  }

  // Check if reconnection is needed
  needsReconnection(): boolean {
    return sessionStorage.getItem('needs_reconnection') === 'true';
  }

  // Get the path to redirect to after reconnection
  getPostReconnectPath(): string {
    return sessionStorage.getItem('post_reconnect_redirect') || '/';
  }

  // Clear all session data
  clearSession() {
    console.log('🧹 SessionManager: Clearing session');
    this.sessionToken = null;
    this.sessionData = null;
    
    // Clear all possible session-related storage keys for cleanup
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem('sessionToken'); // Legacy
    localStorage.removeItem('nft_session_token'); // Legacy
    localStorage.removeItem('riddleWallet');
    localStorage.removeItem('cache.xrp'); // XRP blockchain cache
    localStorage.removeItem('cache.sol'); // Solana blockchain cache
    localStorage.removeItem('cache.eth'); // Ethereum blockchain cache
    sessionStorage.removeItem(this.SESSION_KEY);
    sessionStorage.removeItem('riddle_siwe_session');
    sessionStorage.removeItem('walletSession');
    
    // Notify listeners
    this.notifyListeners();
  }

  // Login detected - store session
  setSession(token: string, data: any) {
    console.log('🔐 SessionManager: New session set');
    this.sessionToken = token;
    
    // Normalize session data structure
    this.sessionData = {
      sessionToken: token,
      handle: data.handle || data.username,
      username: data.username || data.handle,
      authenticated: true,
      walletData: data.walletData,
      walletAddresses: data.walletAddresses,
      expiresAt: data.expiresAt,
      loginTime: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      autoLogoutEnabled: data.autoLogoutEnabled || false,
      autoLogoutMinutes: data.autoLogoutMinutes || 30
    };
    
    // Store in both localStorage and sessionStorage for consistency
    localStorage.setItem(this.TOKEN_KEY, token);
    sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(this.sessionData));
    
    // Reset failure counter on new session
    this.consecutiveFailures = 0;
    
    // Start polling if not already running
    if (!this.pollInterval) {
      console.log('🔄 SessionManager: Starting session polling after login');
      this.startPolling();
    }
    
    // Immediately check validity and notify listeners
    this.notifyListeners();
    this.checkSession();
  }

  // SESSION MANAGEMENT FIX: Get current session state with properly normalized wallet data
  getSession() {
    // Normalize wallet data to prevent component breaking
    const normalizeWalletData = (sessionData: SessionData | null) => {
      if (!sessionData) return null;
      
      // If we have proper walletData, use it
      if (sessionData.walletData && typeof sessionData.walletData === 'object') {
        return sessionData.walletData;
      }
      
      // If we have walletAddresses, normalize to expected walletData shape
      if (sessionData.walletAddresses && typeof sessionData.walletAddresses === 'object') {
        const addresses = sessionData.walletAddresses;
        return {
          handle: sessionData.handle,
          username: sessionData.username || sessionData.handle,
          xrpAddress: addresses.xrp || addresses.xrpAddress,
          ethAddress: addresses.eth || addresses.ethAddress,
          solAddress: addresses.sol || addresses.solAddress,
          btcAddress: addresses.btc || addresses.btcAddress,
          // Preserve original addresses object for compatibility
          addresses: addresses
        };
      }
      
      return null;
    };
    
    const normalizedWalletData = normalizeWalletData(this.sessionData);
    const hasValidWalletData = !!(normalizedWalletData && 
      (normalizedWalletData.xrpAddress || normalizedWalletData.ethAddress || 
       normalizedWalletData.solAddress || normalizedWalletData.btcAddress));
    
    const session = {
      isLoggedIn: !!this.sessionData,
      isAuthenticated: !!this.sessionData,
      token: this.sessionToken,
      sessionToken: this.sessionToken,
      handle: this.sessionData?.handle,
      username: this.sessionData?.username || this.sessionData?.handle,
      walletAddresses: this.sessionData?.walletAddresses,
      walletData: normalizedWalletData, // FIXED: Properly normalized wallet data
      hasWalletData: hasValidWalletData, // FIXED: More accurate wallet data detection
      expiresAt: this.sessionData?.expiresAt,
      authenticated: !!this.sessionData,
      needsRenewal: (this.sessionData as any)?.needsRenewal || false, // Flag for session renewal modal
      // Include full session data for compatibility
      sessionData: this.sessionData
    };
    
    return session;
  }

  // Get session token specifically
  getSessionToken(): string | null {
    return this.sessionToken;
  }

  // Set session token (used for session renewal)
  setSessionToken(token: string): void {
    console.log('🔄 [SessionManager] Updating session token (renewal)');
    this.sessionToken = token;
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem('sessionToken', token); // Legacy compatibility
    this.notifyListeners();
  }

  // Check if user is logged in
  isLoggedIn(): boolean {
    return !!this.sessionData;
  }

  // Get user handle
  getUserHandle(): string | null {
    return this.sessionData?.handle || null;
  }

  // SESSION MANAGEMENT FIX: Get wallet data with proper normalization
  getWalletData(): any {
    const session = this.getSession(); // Use the normalized version
    return session.walletData;
  }

  // Get wallet addresses specifically
  getWalletAddresses(): any {
    return this.sessionData?.walletAddresses || null;
  }

  // Force logout with cleanup
  async logout(): Promise<void> {
    try {
      const token = this.sessionToken;
      if (token) {
        // Notify server of logout
        await fetch('/api/riddle-wallet/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }).catch(() => {});
      }
    } catch (error) {
      console.warn('Failed to notify server of logout:', error);
    } finally {
      // Always clear local session
      this.clearSession();
      
      toast({
        title: "Logged Out",
        description: "You have been logged out successfully"
      });

      // Redirect after a short delay
      setTimeout(() => {
        window.location.href = '/wallet-login';
      }, 500);
    }
  }

  // Subscribe to session changes
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener());
  }

  // Start polling for session validity
  private startPolling() {
    // Check every 60 seconds for session changes (reduced frequency to prevent crashes on auth-optional pages)
    this.pollInterval = setInterval(() => {
      // Only check session if we have existing session data to avoid constant clearing
      // AND stop polling after multiple consecutive failures to prevent hammering the server
      if ((this.sessionData || this.sessionToken) && this.consecutiveFailures < this.maxConsecutiveFailures) {
        this.checkSession();
      } else if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
        console.log('⏸️ SessionManager: Pausing polling after', this.consecutiveFailures, 'consecutive failures');
        this.stopPolling();
      }
    }, 60000);
  }

  // Stop polling (cleanup)
  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }
}

// Export singleton instance
export const sessionManager = new SessionManager();

export function useSession() {
  const [session, setSession] = useState(sessionManager.getSession());

  useEffect(() => {
    // Subscribe to changes - DO NOT check session on every component mount
    // Let SessionManager's polling handle checks, or components can call refresh() manually
    const unsubscribe = sessionManager.subscribe(() => {
      setSession(sessionManager.getSession());
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return {
    ...session,
    refresh: () => sessionManager.checkSession(),
    logout: () => sessionManager.logout(),
    clearSession: () => sessionManager.clearSession()
  };
}
