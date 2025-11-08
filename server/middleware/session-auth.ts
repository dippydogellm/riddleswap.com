import { Request, Response, NextFunction } from 'express';

// AuthenticatedRequest extends Request with proper user and normalizedUser types
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    handle: string;
    userHandle: string;
    walletAddress: string;
  };
  normalizedUser?: {
    handle: string;
    walletAddress: string;
    source: 'session' | 'wallet';
  };
  session?: any; // For payment endpoints and wallet operations
}

// Read-only authentication - optional, allows viewing without login but attaches user data if session exists
export const readOnlyAuth = async (req: any, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    // Authentication is OPTIONAL - allow viewing without login
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('ℹ️  [READ-ONLY AUTH] No authentication token - allowing public access');
      // Continue without authentication - endpoint can serve public data
      return next();
    }

    // If Bearer token is provided, validate it
    const sessionToken = authHeader.substring(7);
    const { getActiveSession } = await import('../riddle-wallet-auth');
    
    const sessionData = getActiveSession(sessionToken);

    if (!sessionData) {
      console.log('⚠️  [READ-ONLY AUTH] Invalid or expired session token - allowing public access anyway');
      // Still allow access even if token is invalid - just no user context
      return next();
    }

    // Check if session is expired
    const now = Date.now();
    if (now > sessionData.expiresAt) {
      console.log('⚠️  [READ-ONLY AUTH] Session expired - allowing public access, but marking for renewal');
      req.sessionExpired = true;
      // Continue without user data - client can trigger renewal
      return next();
    }

    // Session is valid - attach user info and session data
    const wallet = sessionData.walletData;
    req.user = {
      id: sessionData.handle,
      handle: sessionData.handle,
      userHandle: sessionData.handle,
      walletAddress: wallet?.xrpAddress || wallet?.ethAddress || ''
    };

    // Also set session data so endpoints can access wallet addresses
    req.session = {
      handle: sessionData.handle,
      walletData: wallet,
      cachedKeys: sessionData.cachedKeys // Private keys for signing if available
    };

    console.log('✅ [READ-ONLY AUTH] User authenticated:', sessionData.handle);
    return next();
  } catch (error) {
    console.error('❌ [READ-ONLY AUTH] Authentication error:', error);
    // Still allow public access on error
    console.log('ℹ️  [READ-ONLY AUTH] Allowing public access due to auth error');
    return next();
  }
}

// Session authentication middleware
export const sessionAuth = async (req: any, res: Response, next: NextFunction) => {
  try {
    // Set CORS headers for all requests
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    
    // Whitelist for public routes that should bypass authentication
    const publicRoutes: string[] = [
      // Gaming NFT routes now require authentication for security
    ];
    
    const currentPath = req.originalUrl || req.path || req.url;
    const isPublicRoute = publicRoutes.some(route => 
      currentPath.startsWith(route) || 
      currentPath.includes(route) ||
      req.path?.startsWith(route)
    );
    
    if (isPublicRoute) {
      console.log('✅ [MIDDLEWARE] Public route bypassed auth:', req.method, currentPath);
      return next();
    }
    
    console.log('🔐 [MIDDLEWARE] sessionAuth called for:', req.method, req.path);
    
    // Check if user is already authenticated with session data
    if (req.user && req.user.userHandle && (req.user as any).walletAddress) {
      console.log('✅ [MIDDLEWARE] User already authenticated:', req.user.userHandle);
      return next();
    }
    
    // Try to get user from wallet session
    const authHeader = req.headers.authorization;
    console.log('🔍 [MIDDLEWARE] Auth header present:', !!authHeader);
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const sessionToken = authHeader.replace('Bearer ', '');
      console.log('🔑 [MIDDLEWARE] Session token extracted:', sessionToken.substring(0, 10) + '...');
      
      // FIXED: Use direct session validation instead of HTTP call to avoid circular dependency
      try {
        const { getActiveSession } = await import('../riddle-wallet-auth');
        const riddleSession = getActiveSession(sessionToken);
        
        if (riddleSession && Date.now() <= riddleSession.expiresAt) {
          console.log('✅ [MIDDLEWARE] Direct Riddle Wallet session validated:', riddleSession.handle);
          
          // Set user data from Riddle session - use any available wallet address
          const walletData = riddleSession.walletData || {};
          const primaryWalletAddress = walletData.xrpAddress || 
                                       walletData.ethAddress || 
                                       walletData.solAddress || 
                                       walletData.btcAddress ||
                                       walletData.arbitrumAddress ||
                                       walletData.baseAddress ||
                                       walletData.polygonAddress ||
                                       walletData.optimismAddress ||
                                       walletData.avalancheAddress ||
                                       walletData.fantomAddress ||
                                       walletData.lineaAddress ||
                                       walletData.mantleAddress ||
                                       walletData.metisAddress ||
                                       walletData.scrollAddress ||
                                       walletData.bscAddress;

          if (!primaryWalletAddress) {
            console.log('❌ [MIDDLEWARE] No wallet address found in direct session');
            // Fall through to try fallback method
          } else {
            // Check if private keys are missing
            if (!riddleSession.cachedKeys || !riddleSession.cachedKeys.xrpPrivateKey) {
              console.log('⚠️ [MIDDLEWARE] Session valid but private keys missing - renewal needed');
              return res.status(401).json({
                success: false,
                error: 'Private keys expired. Please renew your session.',
                errorCode: 'SESSION_EXPIRED',
                needsRenewal: true,
                authenticated: true,
                handle: riddleSession.handle,
                username: riddleSession.handle,
                walletData: riddleSession.walletData,
                walletAddresses: riddleSession.walletData
              });
            }
            
            req.user = {
              id: riddleSession.handle,
              handle: riddleSession.handle,
              userHandle: riddleSession.handle,
              walletAddress: primaryWalletAddress,
              cachedKeys: riddleSession.cachedKeys
            };
            
            // Populate req.session with cached private keys for swap routes
            if (riddleSession.cachedKeys) {
              // Initialize req.session if it doesn't exist
              if (!req.session) {
                req.session = {};
              }
              // Set private keys in the format expected by xrpl-wallet-operations
              req.session.privateKeys = {
                xrp: riddleSession.cachedKeys.xrpPrivateKey,
                eth: riddleSession.cachedKeys.ethPrivateKey,
                sol: riddleSession.cachedKeys.solPrivateKey,
                btc: riddleSession.cachedKeys.btcPrivateKey
              };
              // Also keep individual keys for backward compatibility
              Object.assign(req.session, riddleSession.cachedKeys);
              console.log('✅ [MIDDLEWARE] Session populated with cached private keys for swaps');
              console.log('🔍 [MIDDLEWARE] Session now has privateKeys.xrp:', !!req.session.privateKeys?.xrp);
              console.log('✅ [MIDDLEWARE] User also has cachedKeys.xrpPrivateKey:', !!riddleSession.cachedKeys.xrpPrivateKey);
            }
            
            return next();
          }
        } else {
          console.log('🔍 [MIDDLEWARE] Direct session validation failed, trying fallback');
        }
      } catch (riddleValidationError) {
        const errorMessage = riddleValidationError instanceof Error ? riddleValidationError.message : 'Unknown error';
        console.log('🔍 [MIDDLEWARE] Direct validation failed, trying activeSessions:', errorMessage);
      }
      
      // Fallback to original active session check
      const { getActiveSession } = await import('../riddle-wallet-auth');
      const session = getActiveSession(sessionToken);
      
      if (!session) {
        console.log('❌ [MIDDLEWARE] Session not found in both systems');
        return res.status(401).json({
          success: false,
          error: 'Session expired. Please renew your session.',
          errorCode: 'SESSION_EXPIRED'
        });
      }
      
      if (Date.now() > session.expiresAt) {
        console.log('❌ [MIDDLEWARE] Session expired');
        return res.status(401).json({
          success: false,
          error: 'Session expired. Please renew your session.',
          errorCode: 'SESSION_EXPIRED'
        });
      }
      
      // SECURITY: Use any valid wallet address from supported chains
      const walletData = session.walletData || {};
      const primaryWalletAddress = walletData.xrpAddress || 
                                   walletData.ethAddress || 
                                   walletData.solAddress || 
                                   walletData.btcAddress ||
                                   walletData.arbitrumAddress ||
                                   walletData.baseAddress ||
                                   walletData.polygonAddress ||
                                   walletData.optimismAddress ||
                                   walletData.avalancheAddress ||
                                   walletData.fantomAddress ||
                                   walletData.lineaAddress ||
                                   walletData.mantleAddress ||
                                   walletData.metisAddress ||
                                   walletData.scrollAddress ||
                                   walletData.bscAddress;

      if (!primaryWalletAddress) {
        console.log('❌ [MIDDLEWARE] No wallet address found in session data');
        return res.status(401).json({
          success: false,
          error: 'Session expired. Please renew your session.',
          errorCode: 'SESSION_EXPIRED'
        });
      }

      console.log('✅ [MIDDLEWARE] Using wallet address:', primaryWalletAddress);

      // Check if private keys are missing
      if (!session.cachedKeys || !session.cachedKeys.xrpPrivateKey) {
        console.log('⚠️ [MIDDLEWARE] Session valid but private keys missing - renewal needed');
        return res.status(401).json({
          success: false,
          error: 'Private keys expired. Please renew your session.',
          errorCode: 'SESSION_EXPIRED',
          needsRenewal: true,
          authenticated: true,
          handle: session.handle,
          username: session.handle,
          walletData: session.walletData,
          walletAddresses: session.walletData
        });
      }

      // Add user data to request with cached keys
      req.user = {
        id: session.handle, // Use handle as the user ID for consistency
        handle: session.handle, // Required by Express Request interface
        userHandle: session.handle,
        walletAddress: primaryWalletAddress,
        cachedKeys: session.cachedKeys
      };
      
      // Populate req.session with cached private keys for payment routes
      if (session.cachedKeys) {
        // Initialize req.session if it doesn't exist
        if (!req.session) {
          req.session = {};
        }
        // Set private keys in the format expected by xrpl-wallet-operations
        req.session.privateKeys = {
          xrp: session.cachedKeys.xrpPrivateKey,
          eth: session.cachedKeys.ethPrivateKey,
          sol: session.cachedKeys.solPrivateKey,
          btc: session.cachedKeys.btcPrivateKey
        };
        // Also keep individual keys for backward compatibility
        Object.assign(req.session, session.cachedKeys);
        console.log('✅ [MIDDLEWARE] User populated with cached private keys for swaps');
        console.log('🔍 [MIDDLEWARE] User has xrpPrivateKey:', !!session.cachedKeys.xrpPrivateKey);
        console.log('🔍 [MIDDLEWARE] Session now has privateKeys.xrp:', !!req.session.privateKeys?.xrp);
      }
      
      console.log('✅ [MIDDLEWARE] User authenticated:', req.user.userHandle);
      return next();
    }
    
    // Return 401 if not authenticated
    console.log('❌ [MIDDLEWARE] Authentication failed');
    return res.status(401).json({
      success: false,
      error: 'Session expired. Please renew your session.',
      errorCode: 'SESSION_EXPIRED'
    });
    
  } catch (error) {
    console.error('❌ Session auth error:', error);
    return res.status(401).json({
      success: false,
      error: 'Session expired. Please renew your session.',
      errorCode: 'SESSION_EXPIRED'
    });
  }
};

// Alias for compatibility with existing code (requires private keys)
export const requireAuthentication = sessionAuth;

// Read-only authentication - only validates session token, doesn't require private keys
export const requireAuthenticationReadOnly = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const sessionToken = authHeader?.replace('Bearer ', '');
    
    if (!sessionToken) {
      console.log('❌ [READ-ONLY AUTH] No session token provided');
      return res.status(401).json({ 
        success: false, 
        error: 'Not authenticated',
        errorCode: 'NO_SESSION'
      });
    }
    
    const { getActiveSession } = await import('../riddle-wallet-auth');
    const session = getActiveSession(sessionToken);
    
    if (!session || Date.now() > session.expiresAt) {
      console.log('❌ [READ-ONLY AUTH] Session expired or invalid');
      return res.status(401).json({ 
        success: false, 
        error: 'Session expired',
        errorCode: 'SESSION_EXPIRED',
        needsRenewal: true
      });
    }
    
    // For read-only operations, we only need the handle and wallet address
    const walletData = session.walletData || {};
    const primaryWalletAddress = walletData.xrpAddress || 
                                 walletData.ethAddress || 
                                 walletData.solAddress || 
                                 walletData.btcAddress ||
                                 'unknown';
    
    req.user = {
      id: session.handle,
      handle: session.handle,
      userHandle: session.handle,
      walletAddress: primaryWalletAddress
    };
    
    console.log('✅ [READ-ONLY AUTH] Session validated for:', session.handle);
    return next();
    
  } catch (error) {
    console.error('❌ [READ-ONLY AUTH] Error:', error);
    return res.status(401).json({ 
      success: false, 
      error: 'Authentication failed',
      errorCode: 'AUTH_ERROR'
    });
  }
};