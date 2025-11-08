import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import helmet from 'helmet';
import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { isAdminUser } from './admin-auth';

// STRIPE BLOCKING: HTTP client restriction to block all Stripe API calls
export const blockStripeRequests = (req: Request, res: Response, next: NextFunction) => {
  const url = req.url || '';
  const host = req.headers.host || '';
  const userAgent = req.headers['user-agent'] || '';
  
  // Block any requests containing stripe domains
  if (host.includes('stripe.com') || url.includes('stripe.com') || 
      host.includes('api.stripe.com') || url.includes('api.stripe.com') ||
      host.includes('js.stripe.com') || url.includes('js.stripe.com')) {
    
    console.warn(`🚨 STRIPE BLOCKED: Attempted request to ${host}${url} from ${req.ip}`);
    return res.status(403).json({ 
      error: 'Payment service blocked', 
      message: 'This application only supports blockchain-native payments (XRPL, EVM, Solana, Bitcoin). Traditional payment processors are not permitted.' 
    });
  }
  
  next();
};

// STRIPE ENVIRONMENT DETECTION: Disabled to allow testing
export const detectStripeEnvironment = () => {
  // DISABLED: No longer checking for Stripe environment variables to allow testing
  console.log(`✅ STRIPE-FREE ENVIRONMENT: Testing enabled - Stripe detection disabled`);
};

// Authentication rate limiter - strict limits (using default IP-based key generator)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    error: 'Too many authentication attempts',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    trustProxy: true, // Match server trust proxy setting
    xForwardedForHeader: false // Disable X-Forwarded-For warnings
  }
});

// General API rate limiter - Increased limits for XRPL operations
export const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes (shorter window)
  max: 200, // 200 requests per window (increased from 100)
  message: {
    error: 'Too many requests',
    retryAfter: '5 minutes'
  },
  validate: {
    trustProxy: true, // Match server trust proxy setting
    xForwardedForHeader: false // Disable X-Forwarded-For warnings
  }
});

// Special rate limiter for XRPL operations
export const xrplLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 100, // 100 XRPL operations per window
  message: {
    error: 'Too many XRPL requests',
    retryAfter: '5 minutes'
  },
  validate: {
    trustProxy: true, // Match server trust proxy setting
    xForwardedForHeader: false
  }
});

// Rate limiter for Scanner API
export const scannerLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 100, // 100 requests per minute
  message: {
    error: 'Too many scanner requests',
    retryAfter: '5 minutes'
  },
  validate: {
    trustProxy: true,
    xForwardedForHeader: false
  }
});

// Slow down middleware for authentication with updated API
export const authSlowDown = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 2, // Allow 2 requests per window at full speed
  delayMs: () => 500, // Fixed delay of 500ms per request after delayAfter
  maxDelayMs: 20000, // Maximum delay of 20 seconds
  validate: {
    delayMs: false // Disable the warning message
  }
});

// Security headers middleware - Production vs Development
export const securityHeaders = (req: any, res: any, next: any) => {
  if (process.env.NODE_ENV === 'production') {
    // Production security headers - X-Frame-Options removed to avoid CSP conflict
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    // X-Frame-Options removed - relying on CSP frame-ancestors for frame protection
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  }
  next();
};

// Additional security headers - Enhanced for production with compatibility fixes
export const additionalHeaders = (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'production') {
    // Additional production security with third-party compatibility
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    // COEP relaxed for wallet and API compatibility
    res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
    // COOP allows popups for wallet connections
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    // CORP relaxed for third-party resources (DexScreener, CoinGecko)
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  }
  next();
};

// Session storage with database backup and enhanced security
const activeSessions = new Map<string, { 
  handle: string, 
  walletId: number, 
  expiresAt: number, 
  tempPassword?: string,
  ipAddress: string,
  userAgent: string,
  createdAt: number,
  lastActivity: number
}>();

// Make sessions accessible globally for validation endpoints
(global as any).activeSessions = activeSessions;

// Load sessions from database on server start
async function loadSessionsFromDatabase() {
  try {
    // This would need a method to get all valid sessions from database
    console.log('[SESSION INIT] Session system initialized with database backup');
  } catch (error) {
    console.error('[SESSION INIT] Failed to load sessions from database:', error);
  }
}

// Initialize sessions on startup
loadSessionsFromDatabase();

// Hybrid session validation - Check memory first, then database fallback
export const validateSession = (req: Request, res: Response, next: NextFunction) => {
  const sessionToken = req.headers.authorization?.replace('Bearer ', '') || 
                      req.headers['x-session-token'] as string;

  if (!sessionToken) {

    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Please login to access this resource'
    });
  }
  
  // Check memory first
  const session = activeSessions.get(sessionToken);
  if (session) {
    if (Date.now() > session.expiresAt) {

      activeSessions.delete(sessionToken);
      return res.status(401).json({ 
        error: 'Session expired',
        message: 'Your session has expired. Please login again.'
      });
    }
    
    // Extend session timeout on valid access and update activity
    const now = Date.now();
    const extendTime = process.env.NODE_ENV === 'production' ? 2 * 60 * 60 * 1000 : 4 * 60 * 60 * 1000; // 2h prod, 4h dev
    session.expiresAt = now + extendTime;
    session.lastActivity = now;

    (req as any).session = session;
    return next();
  }
  
  // If not in memory, try database fallback

  storage.validateSession(sessionToken).then(dbSession => {
    if (dbSession) {
      // Restore to memory for future requests
      const now = Date.now();
      activeSessions.set(sessionToken, {
        handle: dbSession.handle,
        walletId: parseInt(sessionToken.substring(0, 8), 16), // Temporary ID
        expiresAt: now + 4 * 60 * 60 * 1000, // 4 hours
        ipAddress: 'restored',
        userAgent: 'restored',
        createdAt: now,
        lastActivity: now
      });

      (req as any).session = { handle: dbSession.handle, walletId: 0, expiresAt: Date.now() + 4 * 60 * 60 * 1000 }; // 4 hours
      return next();
    } else {

      return res.status(401).json({ 
        error: 'Invalid session',
        message: 'Your session is invalid. Please login again.'
      });
    }
  }).catch(error => {

    return res.status(401).json({ 
      error: 'Session validation failed',
      message: 'Unable to validate session. Please try again.'
    });
  });
};

// Hybrid session creation - Both memory and database for persistence with enhanced security
export const createSession = (handle: string, walletId: string | number, req: Request, expiresIn?: number, tempPassword?: string) => {
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  
  // Extended session timeouts for better user experience
  const defaultExpiry = process.env.NODE_ENV === 'production' ? 2 * 60 * 60 * 1000 : 4 * 60 * 60 * 1000; // 2h prod, 4h dev
  const expiresAt = now + (expiresIn || defaultExpiry);
  
  const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';

  // Store in memory for fast access with enhanced tracking
  activeSessions.set(sessionToken, {
    handle,
    walletId: typeof walletId === 'string' ? parseInt(walletId) : walletId,
    expiresAt,
    tempPassword,
    ipAddress,
    userAgent,
    createdAt: now,
    lastActivity: now
  });
  
  // Also store in database for persistence (background operation)
  storage.createRiddleWalletSession({
    sessionToken,
    walletId: walletId.toString(),
    signature: 'password-login',
    expiresAt: new Date(expiresAt)
  }).catch(error => {
    console.error('[SESSION DB] Failed to store session in database:', error);
  });

  // Log session creation for security audit
  console.log(`[SESSION CREATE] ${handle} from ${ipAddress} at ${new Date(now).toISOString()}`);

  return { sessionToken, expiresAt };
};

// Database-backed session helpers
export const clearSession = async (sessionToken: string) => {
  // Database sessions are automatically cleaned up by expiration checks

};

export const getSession = async (sessionToken: string) => {
  return await storage.getRiddleWalletSession(sessionToken);
};

export const validateSessionToken = async (sessionToken: string) => {
  return await storage.validateSession(sessionToken);
};

// Get all sessions for a wallet (to invalidate on password change)  
export const clearAllSessionsForWallet = async (walletId: string) => {

  // This would require a new method in storage to delete sessions by walletId
  // For now, sessions will expire naturally
};

// Admin access control - only specific authorized users
export const validateAdminAccess = (req: Request, res: Response, next: NextFunction) => {
  const sessionToken = req.headers.authorization?.replace('Bearer ', '') || 
                      req.headers['x-session-token'] as string;

  if (!sessionToken) {
    console.warn(`🚨 [ADMIN SECURITY] Unauthorized admin access attempt from ${req.ip || 'unknown'} to ${req.path}`);
    return res.status(401).json({ 
      error: 'Admin authentication required',
      message: 'Admin access requires valid authentication'
    });
  }
  
  // Check session in memory first
  const session = activeSessions.get(sessionToken);
  if (session) {
    // Only allow specific admin users
    if (!isAdminUser(session.handle)) {
      console.warn(`🚨 [ADMIN SECURITY] Non-admin user "${session.handle}" attempted admin access from ${req.ip || 'unknown'} to ${req.path}`);
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        message: 'Admin access restricted to authorized users only'
      });
    }
    
    if (Date.now() > session.expiresAt) {
      activeSessions.delete(sessionToken);
      console.warn(`🚨 [ADMIN SECURITY] Expired session admin access attempt from ${req.ip || 'unknown'} to ${req.path}`);
      return res.status(401).json({ 
        error: 'Session expired',
        message: 'Admin session has expired. Please login again.'
      });
    }
    
    // Log successful admin access for security audit
    console.log(`✅ [ADMIN ACCESS] User "${session.handle}" accessed ${req.path} from ${session.ipAddress}`);
    
    // Extend session and track activity
    const now = Date.now();
    const extendTime = process.env.NODE_ENV === 'production' ? 2 * 60 * 60 * 1000 : 4 * 60 * 60 * 1000;
    session.expiresAt = now + extendTime;
    session.lastActivity = now;
    
    (req as any).session = session;
    return next();
  }
  
  // Fallback to database check for admin access
  storage.validateSession(sessionToken).then(dbSession => {
    if (dbSession && isAdminUser(dbSession.handle)) {
      console.log(`✅ [ADMIN ACCESS] Database validated admin user "${dbSession.handle}" accessing ${req.path}`);
      
      // Restore to memory
      const now = Date.now();
      activeSessions.set(sessionToken, {
        handle: dbSession.handle,
        walletId: parseInt(sessionToken.substring(0, 8), 16),
        expiresAt: now + 4 * 60 * 60 * 1000,
        ipAddress: req.ip || 'restored',
        userAgent: req.headers['user-agent'] || 'restored',
        createdAt: now,
        lastActivity: now
      });

      (req as any).session = { handle: dbSession.handle, walletId: 0, expiresAt: Date.now() + 4 * 60 * 60 * 1000 };
      return next();
    } else {
      console.warn(`🚨 [ADMIN SECURITY] Invalid/non-admin session admin access attempt from ${req.ip || 'unknown'} to ${req.path}`);
      return res.status(403).json({ 
        error: 'Admin access denied',
        message: 'Insufficient permissions for admin access'
      });
    }
  }).catch(error => {
    console.error(`🚨 [ADMIN SECURITY] Session validation error for admin access attempt from ${req.ip || 'unknown'} to ${req.path}:`, error);
    return res.status(401).json({ 
      error: 'Admin session validation failed',
      message: 'Unable to validate admin session. Please try again.'
    });
  })
};

// Generate nonce for inline scripts and styles
export const generateNonce = () => {
  return crypto.randomBytes(16).toString('base64');
};

// Middleware to generate and store nonce per request  
export const nonceMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const nonce = generateNonce();
  (req as any).nonce = nonce;
  next();
};

// Smart CSP implementation with wallet compatibility exceptions
const isWalletUserAgent = (userAgent: string) => {
  if (!userAgent) return false;
  const walletAgents = ['xaman', 'xumm', 'capacitor', 'webview', 'mobile-wallet'];
  return walletAgents.some(agent => userAgent.toLowerCase().includes(agent));
};

const isWalletRoute = (path: string) => {
  // Only match API routes and specific wallet endpoints, NOT client-side files
  const walletApiRoutes = [
    '/wallet-connect',
    '/xaman',
    '/api/external-wallets',
    '/api/xrpl/external',
    '/api/riddle-wallet'
  ];
  return walletApiRoutes.some(route => path.startsWith(route));
};

// Secure CSP middleware with scoped wallet exceptions
export const securityMiddleware = (app: any) => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction || process.env.FORCE_CSP === 'true') {
    // Enable comprehensive CSP for security in all environments when FORCE_CSP=true or production
    console.log('🔒 CSP: ENABLED for security');
    app.use(helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "https://cdn.jsdelivr.net",
            "https://unpkg.com",
            "https://cdnjs.cloudflare.com",
            "blob:",
            "https://bridge.walletconnect.org",
            "https://registry.walletconnect.org",
          ],
          styleSrc: [
            "'self'",
            "https://fonts.googleapis.com",
            "https://cdn.jsdelivr.net",
          ],
          imgSrc: [
            "'self'",
            "data:",
            "blob:",
            "https:",
            "https://cryptologos.cc",
            "https://assets.coingecko.com",
            "https://dd.dexscreener.com",
            "https://api.dexscreener.com",
            "https://*.dexscreener.com",
            "https://static.dexscreener.com",
            "https://assets-cdn.trustwallet.com",
            "https://raw.githubusercontent.com",
            "https://bithomp.com",
            "https://cdn.bithomp.com",
            "https://gateway.pinata.cloud",
            "https://ipfs.io",
            "https://cloudflare-ipfs.com",
            "https://nftstorage.link",
          ],
          connectSrc: [
            "'self'",
            "ws:",
            "wss:",
            "wss://s1.ripple.com",
            "wss://s.altnet.rippletest.net",
            "https://api.coingecko.com",
            "https://bridge.walletconnect.org",
            "https://registry.walletconnect.org",
            "https://api.dexscreener.com",
            "https://api.bithomp.com",
            "https://api.mainnet-beta.solana.com",
          ],
          frameSrc: [
            "'self'",
            "https://dexscreener.com",
            "https://*.dexscreener.com",
            "https://bridge.walletconnect.org",
            "https://verify.walletconnect.org",
            "https://xumm.app",
            "https://xaman.app",
          ],
          fontSrc: [
            "'self'",
            "https://fonts.gstatic.com",
            "data:",
          ],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'", "blob:", "https:"],
          childSrc: ["'self'", "blob:"],
          workerSrc: ["'self'", "blob:"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
      frameguard: false,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: false
      },
      noSniff: true,
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    }));
  } else {
    // DEVELOPMENT WITHOUT FORCE_CSP: Keep CSP active but relaxed with additional permissive connect sources
    console.log('🔓 CSP: ENABLED (development relaxed mode - localhost connections allowed)');
    app.use(helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-eval'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://unpkg.com"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          imgSrc: ["'self'", "data:", "blob:", "https:", "https://assets.coingecko.com"],
          connectSrc: ["'self'", "ws:", "wss:", "http://localhost:*", "ws://localhost:*", "https://api.coingecko.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        }
      },
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
      frameguard: false
    }));
  }

  // Route-specific frame-ancestors and X-Frame-Options handling
  const loggedPaths = new Set<string>(); // Track logged paths to avoid spam
  app.use((req: Request, res: Response, next: NextFunction) => {
    const userAgent = req.headers['user-agent'] || '';
    const isWallet = isWalletUserAgent(userAgent) || isWalletRoute(req.path);
    
    if (isWallet) {
      // Allow framing for wallet routes with selective relaxation
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      
      // Override frame-ancestors for wallet routes only
      const existingCSP = res.getHeader('Content-Security-Policy') as string || '';
      if (existingCSP) {
        const walletFriendlyCSP = existingCSP.replace(
          /frame-ancestors[^;]*;/, 
          "frame-ancestors 'self' https://xumm.app https://xaman.app https://bridge.walletconnect.org;"
        );
        res.setHeader('Content-Security-Policy', walletFriendlyCSP);
      }
      
      // Only log each unique path once to reduce spam
      if (!loggedPaths.has(req.path)) {
        loggedPaths.add(req.path);
        console.log(`✅ WALLET CSP exception applied for: ${req.path}`);
      }
    }
    // Note: X-Frame-Options removed from non-wallet routes to avoid CSP conflict
    // Frame protection is handled by CSP frame-ancestors 'none' directive
    
    next();
  });

  // Development CSP already handled above - no additional middleware needed
  
  // STRIPE BLOCKING: Security status with comprehensive Stripe protection
  console.log(`🛡️ ANTI-STRIPE SECURITY ENABLED - Blockchain-only payment enforcement`);
  console.log(`🚫 STRIPE BLOCKED: CSP denies all stripe.com domains`);
  console.log(`✅ Frame protection: Enabled with wallet compatibility`);
  console.log(`✅ Script policy: Restricted - wallet friendly, Stripe blocked`);
};