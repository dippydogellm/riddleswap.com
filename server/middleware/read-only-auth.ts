import { Request, Response, NextFunction } from 'express';

/**
 * Read-Only Authentication Middleware
 * - Allows GET requests to proceed even without private keys (read-only access)
 * - Requires private keys for POST/PUT/DELETE/PATCH requests (write operations)
 * 
 * This enables users to view their data without needing to renew their session,
 * but they'll need to renew for any transactions or modifications.
 */
export const readOnlyAuth = async (req: any, res: Response, next: NextFunction) => {
  try {
    // Set CORS headers for all requests
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    
    console.log('🔐 [READ-ONLY-AUTH] Called for:', req.method, req.path);
    
    // Try to get user from wallet session
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ [READ-ONLY-AUTH] No auth header found');
      return res.status(401).json({
        success: false,
        error: 'Session expired. Please renew your session.',
        errorCode: 'SESSION_EXPIRED'
      });
    }
    
    const sessionToken = authHeader.replace('Bearer ', '');
    console.log('🔑 [READ-ONLY-AUTH] Session token extracted');
    
    // Get session from riddle-wallet-auth
    const { getActiveSession } = await import('../riddle-wallet-auth');
    const session = getActiveSession(sessionToken);
    
    if (!session) {
      console.log('❌ [READ-ONLY-AUTH] Session not found');
      return res.status(401).json({
        success: false,
        error: 'Session expired. Please renew your session.',
        errorCode: 'SESSION_EXPIRED'
      });
    }
    
    if (Date.now() > session.expiresAt) {
      console.log('❌ [READ-ONLY-AUTH] Session expired');
      return res.status(401).json({
        success: false,
        error: 'Session expired. Please renew your session.',
        errorCode: 'SESSION_EXPIRED'
      });
    }
    
    // Get wallet address
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
      console.log('❌ [READ-ONLY-AUTH] No wallet address found');
      return res.status(401).json({
        success: false,
        error: 'Session expired. Please renew your session.',
        errorCode: 'SESSION_EXPIRED'
      });
    }
    
    // Check if this is a write operation (requires private keys)
    const isWriteOperation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);
    
    if (isWriteOperation) {
      // Write operations require private keys - check if they exist
      const hasCachedKeys = session.cachedKeys && 
        (session.cachedKeys.xrpPrivateKey || 
         session.cachedKeys.ethPrivateKey || 
         session.cachedKeys.solPrivateKey || 
         session.cachedKeys.btcPrivateKey);
      
      if (!hasCachedKeys) {
        console.log('⚠️ [READ-ONLY-AUTH] Write operation requires private keys - renewal needed');
        return res.status(401).json({
          success: false,
          error: 'Private keys expired. Please renew your session to perform this action.',
          errorCode: 'SESSION_EXPIRED',
          needsRenewal: true,
          authenticated: true,
          handle: session.handle,
          username: session.handle,
          walletData: session.walletData,
          walletAddresses: session.walletData
        });
      }
      
      // Populate req.session with cached private keys for write operations
      if (!req.session) {
        req.session = {};
      }
      Object.assign(req.session, session.cachedKeys);
      console.log('✅ [READ-ONLY-AUTH] Write operation - private keys populated from cache');
    } else {
      // Read operations (GET) don't require private keys
      console.log('✅ [READ-ONLY-AUTH] Read operation - allowing access without private keys');
    }
    
    // Set user data for both read and write operations
    req.user = {
      id: session.handle,
      handle: session.handle,
      userHandle: session.handle,
      walletAddress: primaryWalletAddress,
      cachedKeys: session.cachedKeys
    };
    
    console.log('✅ [READ-ONLY-AUTH] User authenticated:', req.user.userHandle, 'Method:', req.method);
    return next();
    
  } catch (error) {
    console.error('❌ [READ-ONLY-AUTH] Error:', error);
    return res.status(401).json({
      success: false,
      error: 'Session expired. Please renew your session.',
      errorCode: 'SESSION_EXPIRED'
    });
  }
};
