/**
 * CSRF Protection Middleware
 * Validates CSRF tokens for state-changing operations
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// In-memory token store (in production, use Redis or database)
const csrfTokens = new Map<string, { token: string; expires: number }>();

// Clean up expired tokens every hour
setInterval(() => {
  const now = Date.now();
  csrfTokens.forEach((data, sessionId) => {
    if (data.expires < now) {
      csrfTokens.delete(sessionId);
    }
  });
}, 3600000);

/**
 * Generate CSRF token for session
 */
export function generateCsrfToken(sessionId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  csrfTokens.set(sessionId, {
    token,
    expires: Date.now() + 86400000 // 24 hours
  });
  return token;
}

/**
 * Validate CSRF token
 */
export function validateCsrfToken(sessionId: string, token: string): boolean {
  const stored = csrfTokens.get(sessionId);
  if (!stored) return false;
  if (stored.expires < Date.now()) {
    csrfTokens.delete(sessionId);
    return false;
  }
  return stored.token === token;
}

/**
 * CSRF Protection Middleware
 * Checks for CSRF token in POST, PUT, DELETE, PATCH requests
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // Skip CSRF check for GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Get session ID from session or authorization header
  const sessionId = req.session?.handle || req.headers.authorization?.replace('Bearer ', '');
  
  if (!sessionId) {
    return res.status(401).json({ 
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  // Get CSRF token from header or body
  const token = req.headers['x-csrf-token'] as string || req.body?._csrf;

  if (!token) {
    return res.status(403).json({ 
      error: 'CSRF token missing',
      code: 'CSRF_MISSING'
    });
  }

  if (!validateCsrfToken(sessionId, token)) {
    return res.status(403).json({ 
      error: 'Invalid CSRF token',
      code: 'CSRF_INVALID'
    });
  }

  next();
}

/**
 * Endpoint to get CSRF token
 */
export function getCsrfToken(req: Request, res: Response) {
  const sessionId = req.session?.handle || req.headers.authorization?.replace('Bearer ', '');
  
  if (!sessionId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = generateCsrfToken(sessionId);
  res.json({ csrfToken: token });
}
