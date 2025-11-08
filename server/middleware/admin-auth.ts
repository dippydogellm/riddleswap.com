// Admin Authentication Middleware
// Only allows authorized admin users to access admin endpoints

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './session-auth';

// List of authorized admin users
const ADMIN_USERS = ['dippydoge', 'hermesthrice589'];

export function isAdminUser(userHandle: string): boolean {
  return ADMIN_USERS.includes(userHandle);
}

export function requireAdminAccess(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userHandle = req.user?.userHandle;
    
    if (!userHandle) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'You must be logged in to access admin features'
      });
    }

    // Check if user is an authorized admin user
    if (!isAdminUser(userHandle)) {
      console.log(`❌ [ADMIN AUTH] Access denied for user: ${userHandle}`);
      return res.status(403).json({ 
        error: 'Admin access denied',
        message: 'Access restricted to authorized admin users only'
      });
    }

    console.log(`✅ [ADMIN AUTH] Admin access granted to: ${userHandle}`);
    next();
  } catch (error) {
    console.error('❌ [ADMIN AUTH] Error in admin authentication:', error);
    res.status(500).json({ 
      error: 'Authentication error',
      message: 'Failed to verify admin permissions'
    });
  }
}