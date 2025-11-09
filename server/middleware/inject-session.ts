import { Request, Response, NextFunction } from 'express';
import { getActiveSession } from '../riddle-wallet-auth';

/**
 * Middleware to inject active session data into req object
 * Makes session wallet data available to all downstream routes
 */
export function injectSessionMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const sessionToken = authHeader?.replace('Bearer ', '');
  
  if (sessionToken) {
    const session = getActiveSession(sessionToken);
    
    if (session && session.expiresAt > Date.now()) {
      // Inject full session into request
      (req as any).riddleSession = session;
      
      // Also inject specific parts for easy access
      (req as any).walletData = session.walletData;
      (req as any).cachedKeys = session.cachedKeys;
      (req as any).userHandle = session.handle;
      
      console.log(`✅ [SESSION] Injected session for @${session.handle} with all wallet data`);
    } else {
      console.log(`⚠️  [SESSION] Invalid or expired session token`);
    }
  }
  
  next();
}
