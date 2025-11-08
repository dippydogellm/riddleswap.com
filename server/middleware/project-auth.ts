/**
 * Project Authentication Middleware
 * Provides authentication and authorization for project-specific routes
 */

import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { getProjectSession } from '../project-auth-routes';
import { z } from 'zod';

// Extend Express Request interface for project authentication
declare global {
  namespace Express {
    interface Request {
      projectAuth?: {
        projectId: string;
        authId: string;
        walletAddress: string;
        sessionToken: string;
        loginMethod: string;
      };
    }
  }
}

// Rate limiting storage - in-memory for now, could be moved to Redis in production
const rateLimitStorage = new Map<string, {
  count: number;
  resetTime: number;
  blockedUntil?: number;
}>();

// Security configuration
const RATE_LIMIT_CONFIG = {
  maxAttempts: 10, // Max requests per window
  windowMs: 15 * 60 * 1000, // 15 minutes
  blockDurationMs: 30 * 60 * 1000, // 30 minutes block
};

// Clean up expired rate limit entries every hour
setInterval(() => {
  const now = Date.now();
  const entries = Array.from(rateLimitStorage.entries());
  for (const [key, data] of entries) {
    if (now > data.resetTime && (!data.blockedUntil || now > data.blockedUntil)) {
      rateLimitStorage.delete(key);
    }
  }
}, 60 * 60 * 1000);

// Rate limiting utility
function checkRateLimit(identifier: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const existing = rateLimitStorage.get(identifier);

  if (!existing) {
    rateLimitStorage.set(identifier, {
      count: 1,
      resetTime: now + RATE_LIMIT_CONFIG.windowMs
    });
    return { allowed: true };
  }

  // Check if currently blocked
  if (existing.blockedUntil && now < existing.blockedUntil) {
    return { 
      allowed: false, 
      retryAfter: Math.ceil((existing.blockedUntil - now) / 1000) 
    };
  }

  // Reset window if expired
  if (now > existing.resetTime) {
    existing.count = 1;
    existing.resetTime = now + RATE_LIMIT_CONFIG.windowMs;
    existing.blockedUntil = undefined;
    return { allowed: true };
  }

  // Increment count
  existing.count += 1;

  // Block if exceeded limit
  if (existing.count > RATE_LIMIT_CONFIG.maxAttempts) {
    existing.blockedUntil = now + RATE_LIMIT_CONFIG.blockDurationMs;
    return { 
      allowed: false, 
      retryAfter: Math.ceil(RATE_LIMIT_CONFIG.blockDurationMs / 1000) 
    };
  }

  return { allowed: true };
}

/**
 * Rate limiting middleware for project authentication endpoints
 */
export function projectAuthRateLimit(req: Request, res: Response, next: NextFunction) {
  const identifier = `${req.ip}:project-auth`;
  const rateCheck = checkRateLimit(identifier);

  if (!rateCheck.allowed) {
    return res.status(429).json({
      error: "Too many authentication requests",
      retryAfter: rateCheck.retryAfter,
      message: "Please try again later"
    });
  }

  next();
}

/**
 * Extract session token from request headers or body
 */
function extractSessionToken(req: Request): string | null {
  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Check custom header
  const sessionHeader = req.headers['x-project-session'] as string;
  if (sessionHeader) {
    return sessionHeader;
  }

  // Check request body (for POST requests)
  if (req.body && req.body.sessionToken) {
    return req.body.sessionToken;
  }

  // Check query parameter (last resort)
  if (req.query && req.query.sessionToken) {
    return req.query.sessionToken as string;
  }

  return null;
}

/**
 * Project authentication middleware
 * Validates session and attaches project auth info to request
 */
export function requireProjectAuth(req: Request, res: Response, next: NextFunction) {
  const sessionToken = extractSessionToken(req);

  if (!sessionToken) {
    return res.status(401).json({
      error: "Authentication required",
      message: "Please provide a valid session token"
    });
  }

  // Check memory cache for session
  const session = getProjectSession(sessionToken);
  if (!session) {
    return res.status(401).json({
      error: "Invalid or expired session",
      message: "Please log in again"
    });
  }

  // Attach auth info to request
  req.projectAuth = {
    projectId: session.projectId,
    authId: session.authId,
    walletAddress: session.walletAddress,
    sessionToken: sessionToken,
    loginMethod: 'unknown' // Will be filled by database check if needed
  };

  next();
}

/**
 * Project ownership verification middleware
 * Ensures the authenticated user owns the specified project
 */
export function requireProjectOwnership(req: Request, res: Response, next: NextFunction) {
  if (!req.projectAuth) {
    return res.status(401).json({
      error: "Authentication required",
      message: "This endpoint requires project authentication"
    });
  }

  // Extract project ID from URL parameters or body
  const urlProjectId = req.params.projectId || req.params.id;
  const bodyProjectId = req.body?.projectId;
  const targetProjectId = urlProjectId || bodyProjectId;

  if (!targetProjectId) {
    return res.status(400).json({
      error: "Project ID required",
      message: "Please specify which project you want to access"
    });
  }

  // Verify the authenticated session is for the requested project
  if (req.projectAuth.projectId !== targetProjectId) {
    return res.status(403).json({
      error: "Access denied",
      message: "You are not authorized to access this project"
    });
  }

  next();
}

/**
 * Enhanced project authentication middleware with database verification
 * Validates session against database and updates activity
 */
export async function requireProjectAuthWithDbCheck(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionToken = extractSessionToken(req);

    if (!sessionToken) {
      return res.status(401).json({
        error: "Authentication required",
        message: "Please provide a valid session token"
      });
    }

    // Check database for session
    const session = await storage.getProjectOwnerSessionByToken(sessionToken);
    if (!session || !session.is_active) {
      return res.status(401).json({
        error: "Invalid or expired session",
        message: "Please log in again"
      });
    }

    // Check if session has expired
    if (new Date() > session.expires_at) {
      await storage.terminateProjectOwnerSessionByToken(sessionToken, "timeout", "Session expired");
      return res.status(401).json({
        error: "Session expired",
        message: "Please log in again"
      });
    }

    // Update session activity
    await storage.updateProjectOwnerSessionActivity(sessionToken);

    // Attach auth info to request
    req.projectAuth = {
      projectId: session.project_id,
      authId: session.auth_id,
      walletAddress: session.wallet_address,
      sessionToken: sessionToken,
      loginMethod: session.login_method
    };

    next();
  } catch (error) {
    console.error('Project auth middleware error:', error);
    res.status(500).json({
      error: "Authentication error",
      message: "Failed to verify authentication"
    });
  }
}

/**
 * Wallet authorization middleware
 * Ensures the authenticated wallet matches required wallet address
 */
export function requireWalletAuth(walletAddress: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.projectAuth) {
      return res.status(401).json({
        error: "Authentication required",
        message: "This endpoint requires project authentication"
      });
    }

    if (req.projectAuth.walletAddress !== walletAddress) {
      return res.status(403).json({
        error: "Wallet authorization failed",
        message: "This action requires authorization from a different wallet"
      });
    }

    next();
  };
}

/**
 * Project manager authorization middleware
 * Checks if the authenticated wallet is a project manager
 */
export async function requireProjectManager(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.projectAuth) {
      return res.status(401).json({
        error: "Authentication required",
        message: "This endpoint requires project authentication"
      });
    }

    // Get project details
    const project = await storage.getDevtoolsProject(req.projectAuth.projectId);
    if (!project) {
      return res.status(404).json({
        error: "Project not found",
        message: "The specified project does not exist"
      });
    }

    // Check if user is owner or manager
    const isOwner = project.ownerWalletAddress === req.projectAuth.walletAddress;
    const isManager = project.project_managers?.includes(req.projectAuth.walletAddress) || false;

    if (!isOwner && !isManager) {
      return res.status(403).json({
        error: "Insufficient permissions",
        message: "This action requires project owner or manager permissions"
      });
    }

    next();
  } catch (error) {
    console.error('Project manager auth error:', error);
    res.status(500).json({
      error: "Authorization error",
      message: "Failed to verify project permissions"
    });
  }
}

/**
 * Audit logging middleware
 * Logs project access and actions for security auditing
 */
export function auditProjectAccess(action: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Log the action after response is sent
    res.on('finish', async () => {
      try {
        if (req.projectAuth) {
          const logData = {
            project_id: req.projectAuth.projectId,
            auth_id: req.projectAuth.authId,
            wallet_address: req.projectAuth.walletAddress,
            login_method: req.projectAuth.loginMethod,
            attempt_result: res.statusCode < 400 ? 'success' : 'failed',
            failure_reason: res.statusCode >= 400 ? `HTTP ${res.statusCode}` : undefined,
            ip_address: req.ip,
            user_agent: req.headers['user-agent'],
            session_id: undefined, // This is for actions, not login attempts
          };

          await storage.createProjectLoginLog(logData);
        }
      } catch (error) {
        console.error('Audit logging error:', error);
      }
    });

    next();
  };
}

/**
 * Security headers middleware for project routes
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Prevent caching of sensitive data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  next();
}

/**
 * Input validation middleware for project auth routes
 */
export function validateProjectAuthInput(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: "Invalid input",
          details: error.errors,
          message: "Please check your input data"
        });
      }
      next(error);
    }
  };
}

/**
 * Session timeout warning middleware
 * Adds session timeout information to response headers
 */
export async function addSessionInfo(req: Request, res: Response, next: NextFunction) {
  if (req.projectAuth?.sessionToken) {
    try {
      const session = await storage.getProjectOwnerSessionByToken(req.projectAuth.sessionToken);
      if (session) {
        const timeUntilExpiry = session.expires_at.getTime() - Date.now();
        res.setHeader('X-Session-Expires-In', Math.floor(timeUntilExpiry / 1000));
        res.setHeader('X-Session-Expires-At', session.expires_at.toISOString());
        
        // Warn if session expires within 10 minutes
        if (timeUntilExpiry < 10 * 60 * 1000) {
          res.setHeader('X-Session-Warning', 'Session will expire soon');
        }
      }
    } catch (error) {
      console.error('Session info middleware error:', error);
    }
  }
  next();
}

// Export all middleware functions
export const projectAuthMiddleware = {
  rateLimit: projectAuthRateLimit,
  requireAuth: requireProjectAuth,
  requireAuthWithDb: requireProjectAuthWithDbCheck,
  requireOwnership: requireProjectOwnership,
  requireManager: requireProjectManager,
  requireWallet: requireWalletAuth,
  audit: auditProjectAccess,
  security: securityHeaders,
  validate: validateProjectAuthInput,
  sessionInfo: addSessionInfo,
};

export default projectAuthMiddleware;