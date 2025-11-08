/**
 * Service Administration Authentication Middleware
 * 
 * Provides comprehensive authentication, authorization, and security
 * for service initialization management endpoints
 */

import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthenticatedRequest, sessionAuth, requireAuthentication } from './session-auth';
import { requireAdminAccess } from './admin-auth';
import { apiLimiter } from './security';

// Specialized rate limiter for service admin endpoints
export const serviceAdminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Max 20 requests per window for admin endpoints
  message: {
    error: 'Too many service administration requests',
    retryAfter: '15 minutes',
    message: 'Service administration endpoints are rate limited for security'
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    trustProxy: true,
    xForwardedForHeader: false
  },
  // Use default keyGenerator to avoid IPv6 issues
  keyGenerator: undefined,
  // Skip successful requests in rate limiting (only count failed attempts)
  skipSuccessfulRequests: false,
  // Skip failed requests in rate limiting  
  skipFailedRequests: false
});

// Ultra-strict rate limiter for destructive operations
export const destructiveServiceLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Max 5 destructive operations per hour
  message: {
    error: 'Too many destructive service operations',
    retryAfter: '1 hour',
    message: 'Destructive service operations have strict limits for security'
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    trustProxy: true,
    xForwardedForHeader: false
  },
  // Use default keyGenerator to avoid IPv6 issues
  keyGenerator: undefined
});

/**
 * Security headers specific to service administration endpoints
 */
export function serviceAdminSecurityHeaders(req: Request, res: Response, next: NextFunction) {
  // Prevent caching of sensitive administrative data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // Enhanced security headers for admin endpoints - REMOVED DUPLICATES
  // Main security headers handled by server/middleware/security.ts to prevent conflicts
  // res.setHeader('X-Content-Type-Options', 'nosniff');  // DUPLICATE - handled by main middleware
  // res.setHeader('X-Frame-Options', 'DENY');  // DUPLICATE - handled by main middleware
  res.setHeader('X-XSS-Protection', '1; mode=block');  // Admin-specific only
  // res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');  // DUPLICATE - handled by main middleware
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, nosnippet, noarchive');

  // Custom header to indicate this is an admin endpoint
  res.setHeader('X-Admin-Endpoint', 'true');

  next();
}

/**
 * Audit logging for service administration actions
 */
export function auditServiceAdminAccess(action: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    // Log the attempt immediately
    console.log(`🔒 [SERVICE ADMIN] ${action} attempted by ${req.user?.userHandle || 'unknown'} from ${req.ip}`);
    
    // Log the result after response is sent
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const success = res.statusCode < 400;
      const logLevel = success ? '✅' : '❌';
      
      console.log(`${logLevel} [SERVICE ADMIN] ${action} ${success ? 'succeeded' : 'failed'} - ` +
                  `User: ${req.user?.userHandle || 'unknown'}, ` +
                  `Status: ${res.statusCode}, ` +
                  `Duration: ${duration}ms, ` +
                  `IP: ${req.ip}, ` +
                  `UA: ${req.headers['user-agent']?.substring(0, 50) || 'unknown'}`);
      
      // Log failures with additional details
      if (!success) {
        console.warn(`🚨 [SERVICE ADMIN SECURITY] Failed ${action} attempt:`, {
          user: req.user?.userHandle,
          ip: req.ip,
          statusCode: res.statusCode,
          path: req.path,
          method: req.method,
          timestamp: new Date().toISOString()
        });
      }
    });

    next();
  };
}

/**
 * Input validation and sanitization for service admin endpoints
 */
export function validateServiceAdminInput(req: Request, res: Response, next: NextFunction) {
  // Sanitize common XSS vectors in request body
  if (req.body && typeof req.body === 'object') {
    const sanitizedBody = JSON.parse(JSON.stringify(req.body));
    
    // Remove any script tags or dangerous content
    const sanitizeString = (str: string): string => {
      if (typeof str !== 'string') return str;
      return str
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '');
    };
    
    // Recursively sanitize all string values
    const sanitizeObject = (obj: any): any => {
      if (typeof obj === 'string') {
        return sanitizeString(obj);
      } else if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      } else if (obj && typeof obj === 'object') {
        const sanitized: any = {};
        for (const [key, value] of Object.entries(obj)) {
          sanitized[key] = sanitizeObject(value);
        }
        return sanitized;
      }
      return obj;
    };
    
    req.body = sanitizeObject(sanitizedBody);
  }

  next();
}

/**
 * Project ownership verification for project-specific service operations
 */
export async function verifyProjectOwnership(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const projectId = req.params.projectId || req.body?.projectId;
    
    if (!projectId) {
      return res.status(400).json({
        error: 'Project ID required',
        message: 'This operation requires a valid project ID'
      });
    }
    
    // For admin users, allow access to all projects
    const { isAdminUser } = await import('./admin-auth');
    if (req.user?.userHandle && isAdminUser(req.user.userHandle)) {
      console.log(`🔑 [SERVICE ADMIN] Admin ${req.user.userHandle} bypassing project ownership check for ${projectId}`);
      return next();
    }
    
    // For non-admin users, verify project ownership
    const { storage } = await import('../storage');
    const project = await storage.getDevtoolsProject(projectId);
    
    if (!project) {
      return res.status(404).json({
        error: 'Project not found',
        message: 'The specified project does not exist'
      });
    }
    
    // Check if user owns the project
    if (project.ownerWalletAddress !== req.user?.walletAddress) {
      console.warn(`🚨 [SERVICE ADMIN SECURITY] User ${req.user?.userHandle} attempted to access project ${projectId} owned by ${project.ownerWalletAddress}`);
      return res.status(403).json({
        error: 'Access denied',
        message: 'You are not authorized to manage this project'
      });
    }
    
    next();
  } catch (error) {
    console.error('❌ [SERVICE ADMIN] Project ownership verification failed:', error);
    res.status(500).json({
      error: 'Authorization error',
      message: 'Failed to verify project ownership'
    });
  }
}

/**
 * Complete service admin authentication middleware stack
 * Combines all security measures for maximum protection
 */
export const serviceAdminAuth = Router();

// Apply all security middleware in the correct order
serviceAdminAuth.use(serviceAdminSecurityHeaders);
serviceAdminAuth.use(validateServiceAdminInput);
serviceAdminAuth.use(serviceAdminLimiter);
serviceAdminAuth.use(sessionAuth);
serviceAdminAuth.use(requireAuthentication);
serviceAdminAuth.use(requireAdminAccess);

/**
 * Lightweight middleware for read-only service admin operations
 * (like status checks and validation)
 */
export const serviceAdminReadOnlyAuth = Router();

serviceAdminReadOnlyAuth.use(serviceAdminSecurityHeaders);
serviceAdminReadOnlyAuth.use(serviceAdminLimiter);
serviceAdminReadOnlyAuth.use(sessionAuth);
serviceAdminReadOnlyAuth.use(requireAuthentication);
serviceAdminReadOnlyAuth.use(requireAdminAccess);

/**
 * Maximum security middleware for destructive operations
 * (like reinitialization and system-wide tests)
 */
export const serviceAdminDestructiveAuth = Router();

serviceAdminDestructiveAuth.use(serviceAdminSecurityHeaders);
serviceAdminDestructiveAuth.use(validateServiceAdminInput);
serviceAdminDestructiveAuth.use(destructiveServiceLimiter);
serviceAdminDestructiveAuth.use(serviceAdminLimiter);
serviceAdminDestructiveAuth.use(sessionAuth);
serviceAdminDestructiveAuth.use(requireAuthentication);
serviceAdminDestructiveAuth.use(requireAdminAccess);

/**
 * Project-specific service admin middleware
 * Includes project ownership verification
 */
export const serviceAdminProjectAuth = Router();

serviceAdminProjectAuth.use(serviceAdminSecurityHeaders);
serviceAdminProjectAuth.use(validateServiceAdminInput);
serviceAdminProjectAuth.use(serviceAdminLimiter);
serviceAdminProjectAuth.use(sessionAuth);
serviceAdminProjectAuth.use(requireAuthentication);
serviceAdminProjectAuth.use(requireAdminAccess);
serviceAdminProjectAuth.use(verifyProjectOwnership);

export default {
  serviceAdminAuth,
  serviceAdminReadOnlyAuth,
  serviceAdminDestructiveAuth,
  serviceAdminProjectAuth,
  auditServiceAdminAccess,
  verifyProjectOwnership
};