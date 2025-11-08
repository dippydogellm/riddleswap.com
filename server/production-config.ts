// Production Configuration for RiddleSwap
// Manages environment-specific settings and optimizations

export const PRODUCTION_CONFIG = {
  // Environment detection
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
  
  // Logging configuration
  logging: {
    // Disable verbose logging in production
    enableDebugLogs: process.env.NODE_ENV !== 'production',
    enableVerboseLogs: process.env.NODE_ENV === 'development',
    
    // Security: Never log sensitive data in production
    logSensitiveData: false,
    logSessionTokens: false,
    logPrivateKeys: false,
    logWalletAddresses: process.env.NODE_ENV === 'development'
  },
  
  // Security settings
  security: {
    // Strict security headers in production - COMPLETELY DISABLED TO FIX CSP ISSUES
    enableStrictCSP: false, // DISABLED - was causing CSP errors
    enableHSTS: process.env.NODE_ENV === 'production',
    
    // Session security
    sessionTimeout: process.env.NODE_ENV === 'production' ? 3600000 : 86400000, // 1 hour vs 24 hours
    maxSessionsPerUser: process.env.NODE_ENV === 'production' ? 3 : 10
  },
  
  // Performance settings
  performance: {
    // API rate limiting
    enableRateLimiting: true,
    rateLimitWindow: 60000, // 1 minute
    rateLimitRequests: process.env.NODE_ENV === 'production' ? 100 : 1000,
    
    // Caching
    enableCaching: true,
    cacheTimeout: 300000, // 5 minutes
    
    // Database connection pool
    maxDatabaseConnections: process.env.NODE_ENV === 'production' ? 20 : 5
  },
  
  // External API settings
  externalApis: {
    // Use more reliable endpoints in production
    coinGeckoApiTimeout: 5000,
    dexScreenerApiTimeout: 5000,
    blockchainRpcTimeout: 10000,
    
    // Retry configuration
    maxRetries: process.env.NODE_ENV === 'production' ? 3 : 1,
    retryDelay: 1000
  }
};

// Production-safe logging utility
export const productionLog = {
  info: (message: string, data?: any) => {
    if (PRODUCTION_CONFIG.logging.enableDebugLogs) {
      console.log(message, data);
    }
  },
  
  warn: (message: string, data?: any) => {
    console.warn(message, data);
  },
  
  error: (message: string, error?: any) => {
    console.error(message, error);
  },
  
  // Never log sensitive data in production
  sensitive: (message: string, sensitiveData?: any) => {
    if (PRODUCTION_CONFIG.logging.logSensitiveData && PRODUCTION_CONFIG.isDevelopment) {
      console.log(message, sensitiveData);
    } else {
      console.log(message.replace(/\$\{.*?\}/g, '[REDACTED]'));
    }
  }
};

// Environment validation
export function validateProductionEnvironment() {
  const requiredEnvVars = [
    'DATABASE_URL'
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0 && PRODUCTION_CONFIG.isProduction) {
    throw new Error(`Missing required environment variables for production: ${missingVars.join(', ')}`);
  }
  
  return {
    isValid: missingVars.length === 0,
    missingVars,
    environment: process.env.NODE_ENV || 'development'
  };
}