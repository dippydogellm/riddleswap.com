// Dual Wallet Authentication Middleware
// Supports both Riddle wallet (sessionAuth) and external wallets (Bearer/x-external-session-id)

import { Request, Response, NextFunction } from 'express';

export interface DualWalletRequest extends Request {
  walletMode?: 'riddle' | 'external';
  walletAddress?: string;
  sessionId?: string;
}

export const getSessionId = (req: any): string => {
  if (req.user && req.user.handle) {
    return req.user.handle;
  }
  
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.replace('Bearer ', '').substring(0, 20);
  }
  
  const externalSessionId = req.headers['x-external-session-id'];
  if (externalSessionId) {
    return externalSessionId as string;
  }
  
  return `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const dualWalletAuth = (req: DualWalletRequest, res: Response, next: NextFunction) => {
  const hasRiddleAuth = req.user && req.user.cachedKeys;
  const hasExternalAuth = req.headers.authorization || req.headers['x-external-session-id'];
  
  if (hasRiddleAuth) {
    req.walletMode = 'riddle';
    req.sessionId = req.user?.handle;
    return next();
  }
  
  if (hasExternalAuth) {
    req.walletMode = 'external';
    req.sessionId = getSessionId(req);
    req.walletAddress = (req.headers['x-wallet-address'] || req.body.walletAddress) as string;
    
    if (!req.walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address required for external wallet operations. Provide x-wallet-address header or walletAddress in body.'
      });
    }
    
    return next();
  }
  
  return res.status(401).json({
    success: false,
    error: 'Authentication required. Provide Bearer token, x-external-session-id header (for external wallets), or use Riddle wallet session.'
  });
};
