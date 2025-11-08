import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import type { Express } from 'express';

// Production-specific security configuration
export const productionSecurity = (app: Express) => {
  // Strict rate limiting for production
  const productionLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: {
      error: 'Too many requests from this IP',
      retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false
  });

  // Authentication endpoints get stricter limits
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Only 5 auth attempts per window
    message: {
      error: 'Too many authentication attempts',
      retryAfter: '15 minutes'
    }
  });

  // Wallet operation limits
  const walletLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 20, // 20 wallet operations per 5 minutes
    message: {
      error: 'Too many wallet operations',
      retryAfter: '5 minutes'
    }
  });

  // Apply security middleware - HELMET COMPLETELY DISABLED FOR MOBILE WALLET COMPATIBILITY
  // app.use(helmet({
  //   contentSecurityPolicy: false, // Disabled for wallet compatibility
  //   crossOriginEmbedderPolicy: false
  // }));

  // Apply rate limiters
  app.use('/api/', productionLimiter);
  app.use('/api/riddle-wallet/login', authLimiter);
  app.use('/api/riddle-wallet/create', authLimiter);
  app.use('/api/riddle-wallet/', walletLimiter);

  // Production security headers - DISABLED to prevent conflicts with main security middleware
  // All security headers are now handled by server/middleware/security.ts
  // app.use((req, res, next) => {
  //   res.setHeader('X-Frame-Options', 'DENY');
  //   res.setHeader('X-Content-Type-Options', 'nosniff');
  //   res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  //   res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  //   res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  //   next();
  // });

  console.log('🔒 Production security measures enabled');
};

// Session security configuration
export const sessionSecurityConfig = {
  production: {
    sessionTimeout: 15 * 60 * 1000, // 15 minutes
    maxSessions: 3, // Max 3 concurrent sessions per user
    requireReauth: true, // Require re-authentication for sensitive operations
    logAllActivity: true // Log all session activity
  },
  development: {
    sessionTimeout: 4 * 60 * 60 * 1000, // 4 hours - much longer for better UX
    maxSessions: 10, // More flexible for development
    requireReauth: false,
    logAllActivity: false
  }
};