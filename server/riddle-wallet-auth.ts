// Riddle Wallet Authentication Routes
// Handles login, session management, and wallet access

import { Router } from 'express';
import { db } from './db';
import { riddleWallets } from '../shared/schema';
import { eq, and } from 'drizzle-orm';
import { decryptWalletFromStorage } from './wallet-encryption';

const router = Router();

// SECURE Session storage - SERVER SIDE ONLY, NEVER EXPOSED
// Initialize from database backup if available
export const activeSessions = new Map<string, {
  handle: string;
  sessionToken: string;
  expiresAt: number;
  walletData: any;
  cachedKeys?: any; // PRIVATE KEYS - NEVER SENT TO CLIENT
  ipAddress?: string; // Security tracking
  userAgent?: string; // Security tracking
}>();

// Export session access function for middleware
export function getActiveSession(sessionToken: string) {
  return activeSessions.get(sessionToken);
}

// Initialize sessions - MEMORY ONLY for security (no database persistence)
async function initializeSessionsFromDatabase() {
  console.log('� [SESSION INIT] Starting session manager - memory-only storage (no database backup)');
  console.log('⚠️  [SESSION INIT] Users will be logged out on server restart');
}

// Initialize on module load
initializeSessionsFromDatabase();

// Security: Auto-cleanup expired sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  const entries = Array.from(activeSessions.entries());
  for (const [token, session] of entries) {
    if (now > session.expiresAt) {
      console.log('🧹 Auto-cleaning expired session for security');
      activeSessions.delete(token);
    }
  }
}, 5 * 60 * 1000);

// SECURITY: Session access function already exported above

export function getActiveSessionsCount() {
  return activeSessions.size;
}

// CRITICAL: Validate wallet address lengths - DO NOT MODIFY
const REQUIRED_ADDRESS_LENGTHS = {
  xrp: 34,  // XRP addresses are exactly 34 characters
  eth: 42,  // ETH addresses are 0x + 40 hex = 42 chars
  sol: 44,  // Solana addresses are 44 base58 characters
  btc: 34   // Bitcoin P2PKH addresses are ~34 characters
};

function validateWalletAddresses(addresses: {
  xrp: string;
  eth: string;
  sol: string;
  btc: string;
}): void {
  // Validate XRP address
  if (addresses.xrp.length !== REQUIRED_ADDRESS_LENGTHS.xrp || !addresses.xrp.startsWith('r')) {
    throw new Error(`SECURITY ALERT: Invalid XRP address length ${addresses.xrp.length} (expected ${REQUIRED_ADDRESS_LENGTHS.xrp})`);
  }
  
  // Validate ETH address
  if (addresses.eth.length !== REQUIRED_ADDRESS_LENGTHS.eth || !addresses.eth.startsWith('0x')) {
    throw new Error(`SECURITY ALERT: Invalid ETH address length ${addresses.eth.length} (expected ${REQUIRED_ADDRESS_LENGTHS.eth})`);
  }
  
  // Validate SOL address
  if (addresses.sol.length !== REQUIRED_ADDRESS_LENGTHS.sol) {
    throw new Error(`SECURITY ALERT: Invalid SOL address length ${addresses.sol.length} (expected ${REQUIRED_ADDRESS_LENGTHS.sol})`);
  }
  
  // Validate BTC address
  if (addresses.btc.length !== REQUIRED_ADDRESS_LENGTHS.btc || !addresses.btc.startsWith('1')) {
    throw new Error(`SECURITY ALERT: Invalid BTC address length ${addresses.btc.length} (expected ${REQUIRED_ADDRESS_LENGTHS.btc})`);
  }
  
  console.log('✅ [WALLET VALIDATION] All addresses validated successfully');
}

// Generate session token
function generateSessionToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Riddle wallet session renewal - PROTECTED ENDPOINT  
// Uses cached private keys from memory for secure session renewal
router.post('/renew-session', async (req, res) => {
  console.log('🔄 [SESSION RENEWAL] Session renewal endpoint called');
  try {
    const authHeader = req.headers.authorization;
    const sessionToken = authHeader?.replace('Bearer ', '');
    
    if (!sessionToken) {
      console.log('❌ [SESSION RENEWAL] No session token provided');
      return res.status(401).json({
        success: false,
        error: 'No session token provided'
      });
    }

    const session = activeSessions.get(sessionToken);
    
    if (!session) {
      console.log('❌ [SESSION RENEWAL] Session not found');
      return res.status(401).json({
        success: false,
        error: 'Invalid session'
      });
    }

    // Check if session has cached private keys for renewal
    if (!session.cachedKeys || !session.cachedKeys.xrpPrivateKey) {
      console.log('⚠️  [SESSION RENEWAL] No cached private keys - user must login again');
      return res.status(401).json({
        success: false,
        error: 'Session expired - please login again'
      });
    }

    // Create new session token
    const newSessionToken = generateSessionToken();
    
    // Create new session with same data but extended expiration
    const newSession = {
      ...session,
      sessionToken: newSessionToken,
      expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hour expiration
      cachedKeys: session.cachedKeys // Keep the cached keys for continued access
    };
    
    // Remove old session
    activeSessions.delete(sessionToken);
    
    // Store new session
    activeSessions.set(newSessionToken, newSession);
    
    console.log('✅ [SESSION RENEWAL] Session renewed successfully for:', session.handle);
    console.log('💾 [SESSION RENEWAL] New token issued, old token invalidated');
    
    return res.json({
      success: true,
      message: 'Session renewed successfully',
      sessionToken: newSessionToken,
      expiresAt: newSession.expiresAt
    });

  } catch (error) {
    console.error('❌ [SESSION RENEWAL] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Session renewal failed'
    });
  }
});

// Riddle wallet session check - PROTECTED ENDPOINT  
router.get('/session', async (req, res) => {
  console.log('🔐 [WALLET SESSION] Session check endpoint accessed');
  try {
    const authHeader = req.headers.authorization;
    const sessionToken = authHeader?.replace('Bearer ', '');
    
    // Session token validation - avoid logging token data
    
    if (!sessionToken) {
      console.log('❌ [WALLET SESSION] No session token provided');
      return res.status(401).json({
        success: false,
        error: 'No session token provided',
        authenticated: false
      });
    }

    const session = activeSessions.get(sessionToken);
    
    if (!session) {
      console.log('❌ [WALLET SESSION] Session not found in active sessions');
      return res.status(401).json({
        success: false,
        error: 'Invalid session',
        authenticated: false,
        needsRenewal: true // Signal that session needs renewal
      });
    }

    if (Date.now() > session.expiresAt) {
      console.log('❌ [WALLET SESSION] Session expired for handle:', session.handle);
      activeSessions.delete(sessionToken);
      return res.status(401).json({
        success: false,
        error: 'Session expired',
        authenticated: false,
        needsRenewal: true // Signal that session needs renewal
      });
    }

    // Check if private keys are missing (session restored after server restart)
    const hasPrivateKeys = !!session.cachedKeys?.xrpPrivateKey;

    // Valid session authenticated
    return res.json({
      success: true,
      authenticated: true,
      username: session.handle,
      handle: session.handle,
      expiresAt: session.expiresAt,
      hasPrivateKeys, // Tell client if keys are available (for transaction operations)
      needsRenewal: !hasPrivateKeys, // Signal frontend to show renewal modal when keys are missing
      walletData: session.walletData, // Include wallet data for frontend
      walletAddresses: {
        xrp: session.walletData.xrpAddress,
        eth: session.walletData.ethAddress,
        sol: session.walletData.solAddress,
        btc: session.walletData.btcAddress
      }
    });

  } catch (error) {
    console.error('❌ [WALLET SESSION] Session check error:', error);
    return res.status(500).json({
      success: false,
      error: 'Session check failed',
      authenticated: false
    });
  }
});

// Riddle wallet login - PUBLIC ENDPOINT
router.post('/login', async (req, res) => {
  console.log('🔓 [WALLET LOGIN] Login endpoint called - this should be public');
  try {
    const { handle, masterPassword } = req.body;
    
    console.log('🔐 [WALLET LOGIN] Login attempt for handle:', handle);
    console.log('🔍 [WALLET LOGIN] Request IP:', req.ip);
    console.log('🔍 [WALLET LOGIN] User Agent:', req.headers['user-agent']);
    
    if (!handle || !masterPassword) {
      return res.status(400).json({ 
        success: false, 
        error: 'Handle and master password are required' 
      });
    }

    // Find wallet in database using the proper storage system
    try {
      console.log('🔍 Looking up wallet in database...');
      
      // Import storage properly
      const storageModule = await import('./storage');
      const storage = storageModule.storage;
      
      const wallet = await storage.getRiddleWalletByHandle(handle);
      
      if (!wallet) {
        console.log('❌ Wallet not found for handle:', handle);
        return res.status(401).json({ 
          success: false, 
          error: 'Invalid credentials' 
        });
      }
      
      console.log('✅ Wallet found, verifying password...');
      
      // All users authenticate the same way - through proper decryption
      console.log('🔐 Standard authentication for all users');
      
      // Generate session token
      const sessionToken = generateSessionToken();
      const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
      
      // Decrypt and cache ACTUAL private keys for session - SERVER SIDE ONLY
      console.log('🔓 Decrypting and caching ACTUAL private keys for secure server session...');
      let cachedKeys = null;
      
      // Try normal decryption for all wallets (no hardcoding)
      try {
        // Attempting wallet decryption
        const { decryptWalletData } = await import('./wallet-encryption');
        
        // The encryptedPrivateKeys is a single encrypted blob containing all private keys
        const encryptedField = wallet.encryptedPrivateKeys;
        if (!encryptedField) {
          throw new Error('No encrypted wallet data found in database');
        }
        
        // Parse the encrypted data properly
        const encryptedData = typeof encryptedField === 'string' ? JSON.parse(encryptedField) : encryptedField;
        const decryptedString = await decryptWalletData(encryptedData, masterPassword);
        const decryptedData = JSON.parse(decryptedString);
          
          // Private keys decrypted successfully - do not log sensitive data
          
          // Convert Bitcoin key to consistent hex format for server compatibility
          let btcPrivateKey = decryptedData.btc;
          if (typeof btcPrivateKey === 'string') {
            if (btcPrivateKey.includes(',')) {
              // Convert comma-separated byte array to hex string (legacy format)
              const byteArray = btcPrivateKey.split(',').map(b => parseInt(b.trim()));
              btcPrivateKey = Buffer.from(byteArray).toString('hex');
              console.log('🔧 [BTC KEY] Converted byte array to hex format for Bitcoin compatibility');
            } else if (btcPrivateKey.length === 64 && /^[0-9a-fA-F]{64}$/.test(btcPrivateKey)) {
              // Already in hex format (new format) - no conversion needed
              console.log('✅ [BTC KEY] Using hex format for Bitcoin compatibility');
            }
            
            // Ensure consistent format for server-side Bitcoin operations
            if (!btcPrivateKey.startsWith('0x') && btcPrivateKey.length === 64) {
              btcPrivateKey = '0x' + btcPrivateKey;
            }
          }

          // Cache the ACTUAL private keys AT LOGIN TIME - these are the real keys for signing transactions
          cachedKeys = {
            // Addresses for display
            xrpAddress: wallet.xrpAddress,
            ethAddress: wallet.ethAddress,
            solAddress: wallet.solAddress,
            btcAddress: wallet.btcAddress,
            
            // ACTUAL PRIVATE KEYS for transaction signing - CACHED SERVER-SIDE ONLY AT LOGIN
            xrpPrivateKey: decryptedData.xrp,
            ethPrivateKey: decryptedData.eth,
            solPrivateKey: decryptedData.sol,
            btcPrivateKey: btcPrivateKey // Now in proper hex format
          };
          
          console.log('✅ [LOGIN CACHE] Private keys cached securely server-side');
          // SECURITY: NEVER LOG PRIVATE KEY NAMES OR DATA
          console.log('🔐 [LOGIN CACHE] Keys remain in server memory for session duration');
          
      } catch (decryptError) {
        console.error('❌ [LOGIN CACHE] Failed to decrypt private keys:', decryptError instanceof Error ? decryptError.message : 'Unknown error');
        console.log('🔐 Authentication failed - invalid password or corrupted data');
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }

      // Store session with cached decrypted keys - SECURE SERVER STORAGE
      const sessionData = {
        handle,
        sessionToken,
        expiresAt,
        walletData: {
          xrpAddress: wallet.xrpAddress,
          ethAddress: wallet.ethAddress,
          solAddress: wallet.solAddress,
          btcAddress: wallet.btcAddress
        },
        cachedKeys: cachedKeys, // PRIVATE KEYS - NEVER SENT TO CLIENT  
        ipAddress: req.ip, // Security: Track IP address
        userAgent: req.headers['user-agent'] // Security: Track user agent
      };
      
      activeSessions.set(sessionToken, sessionData);
      
      console.log('✅ [LOGIN CACHE] Session created with private keys cached securely (memory only)');
      // SECURITY: NEVER LOG PRIVATE KEY DETAILS
      console.log('💾 [LOGIN CACHE] Keys cached in server memory for immediate transaction signing');
      
      // Save Riddle wallet addresses to linked_wallets table for unified wallet management
      try {
        const { linkedWallets } = await import('../shared/schema');
        
        // Save each chain address as a linked wallet with 'riddle' source
        const riddleWallets = [
          { address: wallet.xrpAddress, chain: 'xrpl', wallet_type: 'riddle' },
          { address: wallet.ethAddress, chain: 'ethereum', wallet_type: 'riddle' },
          { address: wallet.solAddress, chain: 'solana', wallet_type: 'riddle' },
          { address: wallet.btcAddress, chain: 'bitcoin', wallet_type: 'riddle' }
        ];
        
        for (const walletInfo of riddleWallets) {
          // Check if wallet already exists
          const existingWallet = await db
            .select()
            .from(linkedWallets)
            .where(
              and(
                eq(linkedWallets.user_id, handle),
                eq(linkedWallets.address, walletInfo.address),
                eq(linkedWallets.chain, walletInfo.chain)
              )
            )
            .limit(1);
          
          if (existingWallet.length === 0) {
            // Insert new linked wallet with required fields only
            try {
              const linkedWalletData: any = {
                user_id: handle,
                address: walletInfo.address,
                chain: walletInfo.chain,
                wallet_type: walletInfo.wallet_type
              };
              await db.insert(linkedWallets).values(linkedWalletData);
              console.log(`✅ [LINKED WALLET] Saved Riddle ${walletInfo.chain} wallet to linked_wallets`);
            } catch (insertError) {
              console.log(`ℹ️ [LINKED WALLET] Could not insert linked wallet (may already exist)`, insertError);
            }
          } else {
            console.log(`ℹ️ [LINKED WALLET] Riddle ${walletInfo.chain} wallet already exists in linked_wallets`);
          }
        }
      } catch (linkError) {
        console.error('⚠️ [LINKED WALLET] Failed to save Riddle wallets to linked_wallets:', linkError);
        // Don't fail login if linking fails
      }
      
      return res.json({
        success: true,
        sessionToken,
        expiresAt,
        walletData: {
          xrpAddress: wallet.xrpAddress,
          ethAddress: wallet.ethAddress,
          solAddress: wallet.solAddress,
          btcAddress: wallet.btcAddress,
          handle: wallet.handle,
          linkedWalletAddress: wallet.linkedWalletAddress,
          linkedWalletChain: wallet.linkedWalletChain
        }
      });
      
    } catch (dbError) {
      console.error('❌ Database lookup failed:', dbError);
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid credentials' 
      });
    }
    
  } catch (error) {
    console.error('❌ Login error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Public session info endpoint - checks if user has valid session
router.get('/session-info', async (req: any, res) => {
  console.log('🔍 [SESSION INFO] Public session info endpoint accessed');
  
  try {
    // FIRST: Check for Express session (highest priority for Riddle wallet users)
    const handle = req.session?.handle || req.session?.riddleHandle;
    if (req.session && handle) {
      console.log('✅ [SESSION INFO] Found Express session for:', handle);
      
      // Generate a session token for the client (use existing or create new)
      const sessionToken = req.sessionID || `riddle_${Date.now()}_${Math.random().toString(36)}`;
      
      return res.json({
        authenticated: true,
        sessionToken: sessionToken,
        username: handle,
        handle: handle,
        walletAddresses: req.session.walletData || {},
        expiresAt: req.session.cookie?.expires || Date.now() + 3600000
      });
    }
    
    // SECOND: Try multiple methods to get session token from activeSessions
    let sessionToken = null;
    
    // 1. Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader) {
      sessionToken = authHeader.replace('Bearer ', '');
    }
    
    // 2. Check for session token in cookies if no auth header
    if (!sessionToken && req.headers.cookie) {
      const cookies = req.headers.cookie.split(';').map(c => c.trim());
      const sessionCookie = cookies.find(c => c.startsWith('sessionToken='));
      if (sessionCookie) {
        sessionToken = sessionCookie.split('=')[1];
      }
    }
    
    // If no token found, return not authenticated
    if (!sessionToken) {
      console.log('📊 [SESSION INFO] No session token or Express session found');
      return res.json({
        authenticated: false,
        sessionToken: null
      });
    }
    
    // Check if session exists and is valid in activeSessions
    const session = activeSessions.get(sessionToken);
    
    if (!session) {
      console.log('📊 [SESSION INFO] Session not found in activeSessions');
      return res.json({
        authenticated: false,
        sessionToken: null
      });
    }
    
    // Check if session is expired
    if (Date.now() > session.expiresAt) {
      console.log('📊 [SESSION INFO] Session expired');
      activeSessions.delete(sessionToken);
      return res.json({
        authenticated: false,
        sessionToken: null
      });
    }
    
    // Session is valid
    console.log('✅ [SESSION INFO] Valid session found for:', session.handle);
    return res.json({
      authenticated: true,
      sessionToken: sessionToken,
      username: session.handle,
      handle: session.handle,
      walletAddresses: session.walletData,
      expiresAt: session.expiresAt
    });
    
  } catch (error) {
    console.error('❌ [SESSION INFO] Error checking session:', error);
    return res.json({
      authenticated: false,
      sessionToken: null
    });
  }
});

// Wallet logout - remove session  
router.post('/logout', async (req, res) => {
  console.log('🔐 [WALLET LOGOUT] Logout endpoint accessed');
  try {
    const authHeader = req.headers.authorization;
    const sessionToken = authHeader?.replace('Bearer ', '');
    
    if (sessionToken && activeSessions.has(sessionToken)) {
      const session = activeSessions.get(sessionToken);
      console.log('✅ [WALLET LOGOUT] Logging out handle:', session?.handle);
      activeSessions.delete(sessionToken);
    }
    
    return res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('❌ [WALLET LOGOUT] Logout error:', error);
    return res.status(500).json({
      success: false,
      error: 'Logout failed'
    });
  }
});

// Reconnect to restored session - PUBLIC ENDPOINT
router.post('/reconnect', async (req, res) => {
  console.log('🔗 [SESSION RECONNECT] Reconnect endpoint accessed');
  
  try {
    const { handle, password } = req.body;
    
    if (!handle || !password) {
      return res.status(400).json({
        success: false,
        error: 'Handle and password are required'
      });
    }
    
    // Normalize handle
    const normalizedHandle = handle.trim().toLowerCase();
    console.log(`🔍 [SESSION RECONNECT] Checking for restored session: ${normalizedHandle}`);
    
    // Check if there's an active session for this handle
    const existingSession = Array.from(activeSessions.entries())
      .find(([token, session]) => session.handle === normalizedHandle);
    
    if (existingSession) {
      const [sessionToken, sessionData] = existingSession;
      console.log(`✅ [SESSION RECONNECT] Found restored session for: ${normalizedHandle}`);
      
      // Verify password with stored wallet
      const storageModule = await import('./storage');
      const storage = storageModule.storage;
      const wallet = await storage.getRiddleWalletByHandle(normalizedHandle);
      
      if (!wallet) {
        console.log(`❌ [SESSION RECONNECT] Wallet not found for handle: ${normalizedHandle}`);
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }
      
      // Verify password
      const bcrypt = await import('bcrypt');
      const passwordValid = await bcrypt.compare(password, wallet.masterPasswordHash);
      
      if (!passwordValid) {
        console.log(`❌ [SESSION RECONNECT] Invalid password for handle: ${normalizedHandle}`);
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }
      
      // Password is correct - return the existing session
      console.log(`🎉 [SESSION RECONNECT] Successfully reconnected user: ${normalizedHandle}`);
      return res.json({
        success: true,
        sessionToken: sessionToken,
        expiresAt: sessionData.expiresAt,
        walletData: sessionData.walletData,
        message: 'Reconnected to existing session'
      });
    }
    
    console.log(`📊 [SESSION RECONNECT] No restored session found for: ${normalizedHandle}`);
    return res.status(404).json({
      success: false,
      error: 'No active session found. Please login normally.'
    });
    
  } catch (error) {
    console.error('❌ [SESSION RECONNECT] Reconnect error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to reconnect to session'
    });
  }
});

// Check handle availability - PUBLIC ENDPOINT
router.post('/check-handle', async (req, res) => {
  console.log('🔍 [HANDLE CHECK] Handle availability check endpoint accessed');
  try {
    const { handle } = req.body;
    
    if (!handle) {
      return res.status(400).json({
        success: false,
        error: 'Handle is required'
      });
    }
    
    if (handle.length < 3 || handle.length > 20) {
      return res.json({
        available: false,
        message: 'Handle must be 3-20 characters'
      });
    }
    
    // Normalize handle - trim whitespace and convert to lowercase
    const normalizedHandle = handle.trim().toLowerCase();
    
    console.log(`🔍 [HANDLE CHECK] Checking handle: '${handle}' -> normalized: '${normalizedHandle}'`);
    
    // Check if handle already exists
    const storageModule = await import('./storage');
    const storage = storageModule.storage;
    
    const existingWallet = await storage.getRiddleWalletByHandle(normalizedHandle);
    
    if (existingWallet) {
      console.log(`❌ [HANDLE CHECK] Handle '${normalizedHandle}' is already taken`);
      return res.json({
        available: false,
        message: 'This handle is already taken'
      });
    }
    
    console.log(`✅ [HANDLE CHECK] Handle '${normalizedHandle}' is available`);
    return res.json({
      available: true,
      message: 'Handle is available'
    });
    
  } catch (error) {
    console.error('❌ [HANDLE CHECK] Error checking handle:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to check handle availability'
    });
  }
});

// Eligibility check for wallet creation
async function checkWalletCreationEligibility(req: any, handle: string) {
  const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
  const userAgent = req.headers['user-agent'] || '';
  
  console.log('🔍 [ELIGIBILITY] Checking wallet creation eligibility for:', handle);
  console.log('🔍 [ELIGIBILITY] Request IP:', ipAddress);
  console.log('🔍 [ELIGIBILITY] User Agent:', userAgent);
  
  // Check 1: Rate limiting per IP (max 3 wallets per IP per day)
  try {
    const { storage } = await import('./storage');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const walletsFromIP = await storage.getWalletsCreatedFromIP(ipAddress, today);
    if (walletsFromIP && walletsFromIP.length >= 3) {
      console.log('❌ [ELIGIBILITY] Rate limit exceeded - IP has created 3+ wallets today');
      return {
        eligible: false,
        reason: 'rate_limit',
        message: 'Maximum wallet creation limit reached for today. Please try again tomorrow.'
      };
    }
  } catch (error) {
    console.log('⚠️ [ELIGIBILITY] Could not check IP rate limit:', error);
    // Continue without IP check if database fails
  }
  
  // Check 2: Handle validation (enhanced)
  const handleRegex = /^[a-zA-Z0-9_-]+$/;
  if (!handleRegex.test(handle)) {
    return {
      eligible: false,
      reason: 'invalid_handle',
      message: 'Handle can only contain letters, numbers, underscores, and hyphens.'
    };
  }
  
  // Check 3: Banned handles list
  const bannedHandles = [
    'admin', 'administrator', 'root', 'system', 'api', 'support', 'help',
    'riddle', 'riddleswap', 'wallet', 'test', 'demo', 'null', 'undefined',
    'bitcoin', 'ethereum', 'xrp', 'solana', 'btc', 'eth', 'sol'
  ];
  
  if (bannedHandles.includes(handle.toLowerCase())) {
    return {
      eligible: false,
      reason: 'reserved_handle',
      message: 'This handle is reserved and cannot be used.'
    };
  }
  
  // Check 4: Minimum handle length with enhanced validation
  if (handle.length < 3) {
    return {
      eligible: false,
      reason: 'handle_too_short',
      message: 'Handle must be at least 3 characters long.'
    };
  }
  
  if (handle.length > 20) {
    return {
      eligible: false,
      reason: 'handle_too_long',
      message: 'Handle must be no more than 20 characters long.'
    };
  }
  
  // Check 5: Profanity filter (basic)
  const profanityWords = ['spam', 'scam', 'fake', 'phish', 'hack'];
  const lowerHandle = handle.toLowerCase();
  for (const word of profanityWords) {
    if (lowerHandle.includes(word)) {
      return {
        eligible: false,
        reason: 'inappropriate_handle',
        message: 'Handle contains inappropriate content.'
      };
    }
  }
  
  console.log('✅ [ELIGIBILITY] All eligibility checks passed for:', handle);
  return {
    eligible: true,
    reason: 'approved',
    message: 'Eligible for wallet creation'
  };
}

// Create new riddle wallet - PUBLIC ENDPOINT
router.post('/create', async (req, res) => {
  // Explicit CORS headers for wallet creation
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  console.log('🆕 [WALLET CREATE] Wallet creation endpoint accessed');
  console.log('🔍 [WALLET CREATE] Request body keys:', Object.keys(req.body));
  try {
    const {
      handle,
      masterPassword, // Original password for auto-login
      masterPasswordHash,
      salt,
      encryptedSeedPhrase,
      encryptedPrivateKeys,
      walletAddresses,
      linkedWalletAddress,
      linkedWalletChain,
      autoLogoutEnabled,
      autoLogoutMinutes
    } = req.body;
    
    console.log('📝 [WALLET CREATE] Extracted data:', {
      handle,
      hasPasswordHash: !!masterPasswordHash,
      hasSalt: !!salt,
      hasEncryptedSeed: !!encryptedSeedPhrase,
      hasEncryptedKeys: !!encryptedPrivateKeys,
      walletAddresses: walletAddresses ? Object.keys(walletAddresses) : null,
      linkedWalletAddress: linkedWalletAddress || 'none',
      linkedWalletChain: linkedWalletChain || 'none'
    });
    
    // Basic validation
    if (!handle || !masterPasswordHash || !salt || !encryptedSeedPhrase || !encryptedPrivateKeys || !walletAddresses) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }
    
    // CRITICAL: Validate wallet addresses before storing
    try {
      validateWalletAddresses(walletAddresses);
      console.log('🔐 [WALLET CREATE] Address validation passed');
    } catch (validationError) {
      console.error('🚨 [WALLET CREATE] Address validation failed:', validationError);
      return res.status(400).json({
        success: false,
        error: 'Invalid wallet addresses',
        message: validationError instanceof Error ? validationError.message : 'Address validation failed'
      });
    }
    
    // Comprehensive eligibility check
    const eligibilityResult = await checkWalletCreationEligibility(req, handle);
    if (!eligibilityResult.eligible) {
      console.log('❌ [WALLET CREATE] Eligibility check failed:', eligibilityResult.reason);
      return res.status(403).json({
        success: false,
        error: 'Not eligible for wallet creation',
        reason: eligibilityResult.reason,
        message: eligibilityResult.message
      });
    }
    
    const storageModule = await import('./storage');
    const storage = storageModule.storage;
    
    // Normalize handle - ensure consistency with check-handle endpoint
    const normalizedHandle = handle.trim().toLowerCase();
    
    console.log(`🔍 [WALLET CREATE] Checking handle: '${handle}' -> normalized: '${normalizedHandle}'`);
    
    // Check if handle already exists
    const existingWallet = await storage.getRiddleWalletByHandle(normalizedHandle);
    if (existingWallet) {
      console.log(`❌ [WALLET CREATE] Handle '${normalizedHandle}' is already taken`);
      return res.status(409).json({
        success: false,
        error: 'Handle already taken',
        message: 'This handle is already in use. Please choose a different one.'
      });
    }
    
    // Check if any of the generated addresses already exist
    const existingByEth = await storage.getRiddleWalletByGeneratedAddress(walletAddresses.eth);
    const existingByXrp = await storage.getRiddleWalletByGeneratedAddress(walletAddresses.xrp);
    const existingBySol = await storage.getRiddleWalletByGeneratedAddress(walletAddresses.sol);
    const existingByBtc = await storage.getRiddleWalletByGeneratedAddress(walletAddresses.btc);
    
    if (existingByEth || existingByXrp || existingBySol || existingByBtc) {
      return res.status(409).json({
        success: false,
        error: 'Wallet already exists',
        message: 'A wallet with these addresses already exists.'
      });
    }
    
    // Create wallet in database - use normalized handle
    const walletData: any = {
      handle: normalizedHandle,
      masterPasswordHash,
      salt,
      encryptedSeedPhrase,
      encryptedPrivateKeys,
      xrpAddress: walletAddresses.xrp,
      ethAddress: walletAddresses.eth,
      solAddress: walletAddresses.sol,
      btcAddress: walletAddresses.btc,
      autoLogoutEnabled: autoLogoutEnabled || false,
      autoLogoutMinutes: autoLogoutMinutes || 30
    };
    
    if (linkedWalletAddress) walletData.linkedWalletAddress = linkedWalletAddress;
    if (linkedWalletChain) walletData.linkedWalletChain = linkedWalletChain;
    
    const newWallet = await storage.createRiddleWallet(walletData);
    
    console.log('✅ [WALLET CREATE] New wallet created with handle:', normalizedHandle);
    console.log('🔗 [WALLET CREATE] Linked wallet:', linkedWalletAddress ? `${linkedWalletChain}:${linkedWalletAddress}` : 'None');
    
    // Tweet about new wallet creation (non-blocking)
    try {
      const { twitterService } = await import('./twitter-service');
      await twitterService.tweetNewWalletCreation(normalizedHandle);
    } catch (twitterError) {
      // Don't fail wallet creation if Twitter posting fails
      console.error('⚠️ [WALLET CREATE] Failed to post welcome tweet (non-critical):', twitterError);
    }
    
    // AUTO-LOGIN: Create session for newly created wallet
    console.log('🔐 [AUTO-LOGIN] Creating session for new wallet:', normalizedHandle);
    
    // Generate session token and decrypt private keys for caching
    const sessionToken = generateSessionToken();
    const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
    
    // Decrypt private keys immediately after wallet creation for session caching
    let cachedKeys = null;
    try {
      if (masterPassword) {
        console.log('🔐 [AUTO-LOGIN] Decrypting private keys with provided password');
        const { decryptWalletData } = await import('./wallet-encryption');
        
        // Parse the encrypted data properly
        const encryptedData = typeof encryptedPrivateKeys === 'string' ? JSON.parse(encryptedPrivateKeys) : encryptedPrivateKeys;
        const decryptedString = await decryptWalletData(encryptedData, masterPassword);
        const decryptedData = JSON.parse(decryptedString);
        
        // Convert Bitcoin key to consistent hex format
        let btcPrivateKey = decryptedData.btc;
        if (typeof btcPrivateKey === 'string') {
          if (btcPrivateKey.includes(',')) {
            // Convert comma-separated byte array to hex string
            const byteArray = btcPrivateKey.split(',').map(b => parseInt(b.trim()));
            btcPrivateKey = Buffer.from(byteArray).toString('hex');
          }
          if (!btcPrivateKey.startsWith('0x') && btcPrivateKey.length === 64) {
            btcPrivateKey = '0x' + btcPrivateKey;
          }
        }
        
        // Cache the ACTUAL private keys for immediate use
        cachedKeys = {
          xrpAddress: newWallet.xrpAddress,
          ethAddress: newWallet.ethAddress,
          solAddress: newWallet.solAddress,
          btcAddress: newWallet.btcAddress,
          xrpPrivateKey: decryptedData.xrp,
          ethPrivateKey: decryptedData.eth,
          solPrivateKey: decryptedData.sol,
          btcPrivateKey: btcPrivateKey
        };
        
        console.log('✅ [AUTO-LOGIN] Private keys successfully cached for new wallet');
      } else {
        console.log('⚠️ [AUTO-LOGIN] No master password provided - session will need login for private keys');
        cachedKeys = null;
      }
      
    } catch (error) {
      console.log('⚠️ [AUTO-LOGIN] Could not cache private keys:', error instanceof Error ? error.message : 'Unknown error');
      cachedKeys = null;
    }
    
    // Store session for auto-login
    const sessionData = {
      handle,
      sessionToken,
      expiresAt,
      walletData: {
        xrpAddress: newWallet.xrpAddress,
        ethAddress: newWallet.ethAddress,
        solAddress: newWallet.solAddress,
        btcAddress: newWallet.btcAddress
      },
      cachedKeys: cachedKeys, // Will be null until proper login
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    };
    
    activeSessions.set(sessionToken, sessionData);
    
    console.log('✅ [AUTO-LOGIN] Session created for new wallet:', handle);
    console.log('🔐 [AUTO-LOGIN] Private keys will be cached when user logs in with password');
    
    return res.json({
      success: true,
      message: 'Wallet created successfully',
      walletId: newWallet.id,
      handle: newWallet.handle,
      // AUTO-LOGIN: Return session token so user stays logged in
      sessionToken: sessionToken,
      expiresAt: expiresAt,
      walletData: {
        xrpAddress: newWallet.xrpAddress,
        ethAddress: newWallet.ethAddress,
        solAddress: newWallet.solAddress,
        btcAddress: newWallet.btcAddress
      },
      autoLogin: true // Flag to indicate this includes auto-login
    });
    
  } catch (error) {
    console.error('❌ [WALLET CREATE] Error creating wallet:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create wallet',
      message: 'An unexpected error occurred while creating your wallet.'
    });
  }
});

// CRITICAL: Wallet verification endpoint to check if encrypted keys match stored addresses
router.post('/verify-wallet-keys', async (req, res) => {
  console.log('🔍 [KEY VERIFICATION] Wallet key verification endpoint called');
  try {
    const { handle, masterPassword } = req.body;
    
    if (!handle || !masterPassword) {
      return res.status(400).json({
        success: false,
        error: 'Handle and master password are required'
      });
    }

    // Get wallet from database
    const storageModule = await import('./storage');
    const storage = storageModule.storage;
    const wallet = await storage.getRiddleWalletByHandle(handle);
    
    if (!wallet) {
      return res.status(404).json({
        success: false,
        error: 'Wallet not found'
      });
    }

    console.log(`🔍 [KEY VERIFICATION] Verifying keys for: ${handle}`);
    console.log(`📊 [KEY VERIFICATION] Stored addresses:`, {
      xrp: wallet.xrpAddress,
      eth: wallet.ethAddress,
      sol: wallet.solAddress,
      btc: wallet.btcAddress
    });

    // Decrypt the private keys
    try {
      const { decryptWalletData } = await import('./wallet-encryption');
      const encryptedField = wallet.encryptedPrivateKeys;
      if (!encryptedField) {
        throw new Error('No encrypted wallet data found');
      }
      
      const encryptedData = typeof encryptedField === 'string' ? JSON.parse(encryptedField) : encryptedField;
      const decryptedString = await decryptWalletData(encryptedData, masterPassword);
      const decryptedKeys = JSON.parse(decryptedString);
      
      console.log('✅ [KEY VERIFICATION] Keys decrypted successfully');
      
      // Re-derive addresses from the decrypted private keys
      const rippleKeypairs = await import('ripple-keypairs');
      const { Keypair } = await import('@solana/web3.js');
      const { Wallet: EthWallet } = await import('ethers');
      const bitcoin = await import('bitcoinjs-lib');
      const ECPairFactory = (await import('ecpair')).default;
      const ecc = await import('tiny-secp256k1');
      const ECPair = ECPairFactory(ecc);
      
      // Derive XRP address from private key
      let derivedXrpAddress: string;
      try {
        const keypair = rippleKeypairs.deriveKeypair(decryptedKeys.xrp);
        derivedXrpAddress = rippleKeypairs.deriveAddress(keypair.publicKey);
      } catch (xrpError) {
        console.error('❌ [KEY VERIFICATION] Failed to derive XRP address:', xrpError);
        derivedXrpAddress = 'DERIVATION_FAILED';
      }
      
      // Derive ETH address from private key
      let derivedEthAddress: string;
      try {
        const ethWallet = new EthWallet(decryptedKeys.eth);
        derivedEthAddress = ethWallet.address;
      } catch (ethError) {
        console.error('❌ [KEY VERIFICATION] Failed to derive ETH address:', ethError);
        derivedEthAddress = 'DERIVATION_FAILED';
      }
      
      // Derive SOL address from private key
      let derivedSolAddress: string;
      try {
        const solKeyBytes = Buffer.from(decryptedKeys.sol, 'hex');
        const solKeypair = Keypair.fromSecretKey(solKeyBytes);
        derivedSolAddress = solKeypair.publicKey.toBase58();
      } catch (solError) {
        console.error('❌ [KEY VERIFICATION] Failed to derive SOL address:', solError);
        derivedSolAddress = 'DERIVATION_FAILED';
      }
      
      // Derive BTC address from private key
      let derivedBtcAddress: string;
      try {
        let btcKey = decryptedKeys.btc;
        if (btcKey.startsWith('0x')) {
          btcKey = btcKey.slice(2);
        }
        const keyBuffer = Buffer.from(btcKey, 'hex');
        const keyPair = ECPair.fromPrivateKey(Uint8Array.from(keyBuffer));
        const { address } = bitcoin.payments.p2pkh({ pubkey: Buffer.from(keyPair.publicKey) });
        derivedBtcAddress = address || 'DERIVATION_FAILED';
      } catch (btcError) {
        console.error('❌ [KEY VERIFICATION] Failed to derive BTC address:', btcError);
        derivedBtcAddress = 'DERIVATION_FAILED';
      }
      
      // Compare derived addresses with stored addresses
      const verification = {
        xrp: {
          stored: wallet.xrpAddress,
          derived: derivedXrpAddress,
          match: wallet.xrpAddress === derivedXrpAddress
        },
        eth: {
          stored: wallet.ethAddress,
          derived: derivedEthAddress,
          match: wallet.ethAddress.toLowerCase() === derivedEthAddress.toLowerCase()
        },
        sol: {
          stored: wallet.solAddress,
          derived: derivedSolAddress,
          match: wallet.solAddress === derivedSolAddress
        },
        btc: {
          stored: wallet.btcAddress,
          derived: derivedBtcAddress,
          match: wallet.btcAddress === derivedBtcAddress
        }
      };
      
      console.log('📊 [KEY VERIFICATION] Verification results:', verification);
      
      const allMatch = verification.xrp.match && 
                      verification.eth.match && 
                      verification.sol.match && 
                      verification.btc.match;
      
      if (allMatch) {
        console.log('✅ [KEY VERIFICATION] All addresses match! Keys are valid.');
      } else {
        console.log('❌ [KEY VERIFICATION] MISMATCH DETECTED! Database corruption confirmed.');
      }
      
      return res.json({
        success: true,
        handle: handle,
        verification: verification,
        allMatch: allMatch,
        message: allMatch ? 
          'All encrypted keys match stored addresses - wallet is valid' : 
          'CRITICAL: Stored addresses do not match decrypted keys - database corruption detected'
      });
      
    } catch (decryptError) {
      console.error('❌ [KEY VERIFICATION] Decryption failed:', decryptError);
      return res.status(401).json({
        success: false,
        error: 'Invalid password or corrupted encryption'
      });
    }

  } catch (error) {
    console.error('❌ [KEY VERIFICATION] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Verification failed'
    });
  }
});

export default router;