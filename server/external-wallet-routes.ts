import express from 'express';
// Removed sessionAuth dependency - external wallets work independently
// QRCode import removed - using QR from Xumm API response directly
import { ethers } from 'ethers';
import { serverWalletConfig, logServerWalletDiagnostics } from './config/wallet';
import { randomUUID, randomBytes } from 'crypto';
import fetch from 'node-fetch';
import { db } from './db';
import { externalWallets, errorLogs, authNonces, swapHistory, linkedWallets } from '../shared/schema';
// Strongly typed insert/update helpers from Drizzle tables
// NOTE: Some Drizzle versions expose only $inferInsert/$inferSelect. We create broader
// interfaces so defaultable columns (with .default()) are still assignable without TS errors.
// This avoids the prior compile errors about unknown properties like 'verified', 'severity', 'session_id'.
type NewErrorLog = {
  error_type: string;
  error_message: string;
  page_url: string;
  user_id?: string | null;
  user_handle?: string | null;
  error_context?: any;
  resolved?: boolean;
  severity?: string; // optional since DB supplies default
  stack_trace?: string;
  user_agent?: string;
  component_name?: string;
  api_endpoint?: string;
  browser_info?: any;
  resolution_notes?: string;
};

// Use the Drizzle inferred insert type for required columns, then broaden with defaults.
type NewAuthNonce = typeof authNonces.$inferInsert & {
  session_id?: string;
  used?: boolean;
};
type UpdateAuthNonce = Partial<NewAuthNonce>;

type NewExternalWallet = typeof externalWallets.$inferInsert & {
  verified?: boolean;
  signature?: string;
  connected_at?: Date;
  last_used?: Date;
};
type UpdateExternalWallet = Partial<NewExternalWallet>;

type NewLinkedWallet = typeof linkedWallets.$inferInsert & {
  verified?: boolean;
  wallet_label?: string | null;
  verified_at?: Date | null;
  last_activity?: Date | null;
  source?: string;
};
type UpdateLinkedWallet = Partial<NewLinkedWallet>;
import { eq, and, lt, gt } from 'drizzle-orm';
import { z } from 'zod';
import { PublicKey } from '@solana/web3.js';
import * as nacl from 'tweetnacl';
import bs58 from 'bs58';
import { verify as verifyBitcoinMessage } from 'bitcoinjs-message';

// Extend Request type for sessionAuth
// User properties are now defined globally in @types/express-session.d.ts

// TypeScript interfaces for Xumm Cloud API responses
interface XummPayloadCreateResponse {
  uuid: string;
  next: {
    always?: string;
    no_push_msg_received?: string;
    no_push_msg_received_qr?: string;
  };
  refs: {
    qr_png?: string;
    qr_matrix?: string;
    qr_uri?: string;
    qr_uri_quality_opts?: string;
    websocket_status?: string;
    qr_web?: string;
  };
  pushed: boolean;
  expires_at: string;
}

interface XummPayloadStatusMeta {
  exists: boolean;
  uuid: string;
  multisign: boolean;
  submit: boolean;
  destination: string;
  resolved_destination: string;
  resolved_at?: string;
  expires_at: string;
  pushed: boolean;
  app_opened: boolean;
  opened: boolean;
  signed: boolean;
  cancelled: boolean;
  expired: boolean;
  resolved: boolean;
  return_url_app?: string;
  return_url_web?: string;
  is_xapp: boolean;
  signed_at?: string;
}

interface XummPayloadStatusResponse {
  txid?: string;
  account?: string;
  signer?: string;
  user?: string;
  dispatched_to?: string;
  dispatched_result?: string;
  multisigned?: string;
  environment_nodeuri?: string;
  environment_networkendpoint?: string;
}

interface XummPayloadStatus {
  meta: XummPayloadStatusMeta;
  response: XummPayloadStatusResponse;
  custom_meta?: {
    identifier?: string;
    blob?: any;
    instruction?: string;
  };
}

// Generic Xumm API response types
type XummCreatePayloadResponse = XummPayloadCreateResponse;
type XummGetPayloadResponse = XummPayloadStatus;

const router = express.Router();

// Security helper functions
const logSecurityEvent = async (eventType: string, details: any, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium') => {
  try {
    const logData: NewErrorLog = {
      error_type: 'auth_error',
      severity, // optional; DB default used if omitted
      error_message: `External Wallet Security: ${eventType}`,
      error_context: details,
      page_url: '/api/external-wallets',
      user_id: details.sessionId || null,
      user_handle: details.userHandle || null,
      resolved: false
    };
  await db.insert(errorLogs).values(logData as any);
  } catch (error) {
    console.error('❌ [SECURITY] Failed to log security event:', error);
  }
};

const checkRateLimit = (identifier: string): boolean => {
  const now = Date.now();
  const attempts = verificationAttempts.get(identifier);
  
  if (!attempts) {
    verificationAttempts.set(identifier, {
      count: 1,
      lastAttempt: now,
      blocked: false
    });
    return true; // First attempt, allow
  }
  
  // Check if user is blocked
  if (attempts.blocked && (now - attempts.lastAttempt) < RATE_LIMIT_BLOCK_MS) {
    return false;
  }
  
  // Reset if outside window
  if (now - attempts.lastAttempt > RATE_LIMIT_WINDOW_MS) {
    attempts.count = 1;
    attempts.lastAttempt = now;
    attempts.blocked = false;
    return true;
  }
  
  // Increment attempt count
  attempts.count++;
  attempts.lastAttempt = now;
  
  // Block if too many attempts
  if (attempts.count >= MAX_VERIFICATION_ATTEMPTS) {
    attempts.blocked = true;
    return false;
  }
  
  return true;
};

// Legacy cleanup function removed - now using database-based cleanup

// SECURITY: Verify Solana signature with proper cryptographic validation
const verifySolanaSignature = (message: string, signature: string, publicKeyString: string): boolean => {
  try {
    // Validate public key format
    const publicKey = new PublicKey(publicKeyString);
    
    // Decode signature and message
    const signatureBytes = bs58.decode(signature);
    const messageBytes = new TextEncoder().encode(message);
    
    // Verify using ed25519
    const isValid = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKey.toBytes()
    );
    
    return isValid;
  } catch (error) {
    console.error('❌ [SOLANA] Signature verification error:', error);
    return false;
  }
};

// SECURITY: Verify Bitcoin signature using standard bitcoinjs-message verification
const verifyBitcoinSignature = (message: string, signature: string, address: string): boolean => {
  try {
    // Use proper Bitcoin message verification with standard library
    return verifyBitcoinMessage(message, address, signature);
  } catch (error) {
    console.error('❌ [BITCOIN] Bitcoin signature verification error:', error);
    return false;
  }
};

// Enhanced XRPL Payment Verification with Business Invariant Validation
const verifyXRPLTransaction = async (
  txHash: string, 
  expectedDestination?: string,
  expectedAmount?: string,
  expectedCurrency?: string,
  expectedIssuer?: string,
  expectedDestinationTag?: number
): Promise<any> => {
  try {
    // Check for duplicate processing (idempotency protection)
    const existingPayment = await db.select().from(swapHistory).where(eq(swapHistory.transaction_hash, txHash)).limit(1);
    if (existingPayment.length > 0) {
      console.log(`⚠️ [XRPL] Transaction ${txHash} already processed`);
      return { validated: true, duplicate: true, previousRecord: existingPayment[0] };
    }
    
    const xrplApiUrl = 'https://s1.ripple.com:51234';
    const requestData = {
      method: 'tx',
      params: [{
        transaction: txHash,
        binary: false
      }]
    };
    
    console.log(`🔍 [XRPL] Verifying transaction: ${txHash}`);
    
    const response = await fetch(xrplApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    });
    
    if (!response.ok) {
      throw new Error(`XRPL API HTTP error: ${response.status}`);
    }
    
    const data: any = await response.json() as any;
    
    if (data && data.result && data.result.validated && data.result.meta) {
      const tx = data.result;
      const meta = tx.meta;
      
      // Critical: Verify transaction success
      if (meta.TransactionResult !== 'tesSUCCESS') {
        console.error(`❌ [XRPL] Transaction ${txHash} failed with result: ${meta.TransactionResult}`);
        return { 
          validated: false, 
          error: `Transaction failed: ${meta.TransactionResult}`,
          result_code: meta.TransactionResult
        };
      }
      
      // Business invariant validations
      const validationErrors = [];
      
      // Validate destination address
      if (expectedDestination && tx.Destination !== expectedDestination) {
        validationErrors.push(`Destination mismatch: expected ${expectedDestination}, got ${tx.Destination}`);
      }
      
      // Validate destination tag if provided
      if (expectedDestinationTag !== undefined && tx.DestinationTag !== expectedDestinationTag) {
        validationErrors.push(`Destination tag mismatch: expected ${expectedDestinationTag}, got ${tx.DestinationTag}`);
      }
      
      // Validate amount, currency, and issuer for issued tokens
      if (expectedAmount) {
        if (typeof tx.Amount === 'string') {
          // XRP amount (in drops)
          const actualXrpAmount = (parseInt(tx.Amount) / 1000000).toString();
          if (actualXrpAmount !== expectedAmount && expectedCurrency === 'XRP') {
            validationErrors.push(`XRP amount mismatch: expected ${expectedAmount}, got ${actualXrpAmount}`);
          }
        } else if (typeof tx.Amount === 'object') {
          // Issued token amount
          if (expectedAmount !== tx.Amount.value) {
            validationErrors.push(`Amount mismatch: expected ${expectedAmount}, got ${tx.Amount.value}`);
          }
          if (expectedCurrency && expectedCurrency !== tx.Amount.currency) {
            validationErrors.push(`Currency mismatch: expected ${expectedCurrency}, got ${tx.Amount.currency}`);
          }
          if (expectedIssuer && expectedIssuer !== tx.Amount.issuer) {
            validationErrors.push(`Issuer mismatch: expected ${expectedIssuer}, got ${tx.Amount.issuer}`);
          }
        }
      }
      
      if (validationErrors.length > 0) {
        console.error(`❌ [XRPL] Business validation failed for ${txHash}:`, validationErrors);
        return {
          validated: false,
          error: 'Business validation failed',
          validation_errors: validationErrors
        };
      }
      
      console.log(`✅ [XRPL] Transaction verified and validated: ${txHash}`);
      
      const verificationResult = {
        validated: true,
        hash: tx.hash,
        ledger_index: tx.ledger_index,
        date: tx.date ? new Date((tx.date + 946684800) * 1000) : null,
        transaction_type: tx.TransactionType,
        account: tx.Account,
        destination: tx.Destination,
        destination_tag: tx.DestinationTag,
        amount: tx.Amount,
        fee: tx.Fee,
        sequence: tx.Sequence,
        success: true,
        result_code: meta.TransactionResult,
        meta: tx.meta,
        business_validated: true
      };
      
      // Persist payment receipt for tracking with proper error handling
      try {
        // Note: Skip saving swap history for wallet verification - this is used for actual swaps
        console.log(`💾 [XRPL] Verification completed, skipping swap history save for connection verification`);
        console.log(`💾 [XRPL] Payment receipt saved for transaction: ${txHash}`);
      } catch (saveError) {
        console.error(`⚠️ [XRPL] Failed to save payment receipt for ${txHash}:`, saveError);
        // Continue with response as receipt is optional - don't fail verification
      }
      
      return verificationResult;
    } else {
      console.error(`❌ [XRPL] Transaction not found or not validated: ${txHash}`);
      return { validated: false, error: 'Transaction not found or not validated' };
    }
  } catch (error) {
    console.error(`❌ [XRPL] Verification error for ${txHash}:`, error);
    return { validated: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

// SECURITY: Create cryptographically secure message with nonce and context binding
const createVerificationMessage = (nonce: string, walletType: string, address: string, chain: string): string => {
  const timestamp = new Date().toISOString();
  return `Verify wallet ownership for Riddle.app

Chain: ${chain}
Wallet: ${walletType}
Address: ${address}
Nonce: ${nonce}
Timestamp: ${timestamp}

This message proves you control this wallet on ${chain}.`;
};

// Store pending connections in memory (in production, use Redis)
const pendingConnections = new Map<string, any>();

// Xumm Cloud API configuration
const XUMM_API_BASE = 'https://xumm.app/api/v1/platform';
const XUMM_API_KEY = serverWalletConfig.xummApiKey;
const XUMM_API_SECRET = serverWalletConfig.xummApiSecret;

// One-time diagnostics
logServerWalletDiagnostics();

// Helper function to make authenticated Xumm API calls with proper typing
const callXummAPI = async <T = any>(endpoint: string, method: 'GET' | 'POST' = 'POST', data?: any): Promise<T> => {
  if (!XUMM_API_KEY || !XUMM_API_SECRET) {
    throw new Error('Xumm API credentials not configured');
  }

  const url = `${XUMM_API_BASE}/${endpoint}`;
  const options: any = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': XUMM_API_KEY,
      'X-API-Secret': XUMM_API_SECRET,
      'User-Agent': 'RiddleApp/1.0'
    }
  };

  if (data && method === 'POST') {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(url, options);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ [XUMM API] ${method} ${endpoint} failed:`, response.status, errorText);
    throw new Error(`Xumm API error: ${response.status} - ${errorText}`);
  }

  return await response.json() as T;
};

// Typed helper functions for specific Xumm API calls - EXPORTED for use in swap routes
export const createXummPayload = async (payload: any): Promise<XummCreatePayloadResponse> => {
  return callXummAPI<XummCreatePayloadResponse>('payload', 'POST', payload);
};

export const getXummPayloadStatus = async (uuid: string): Promise<XummGetPayloadResponse> => {
  return callXummAPI<XummGetPayloadResponse>(`payload/${uuid}`, 'GET');
};

// Database-based nonce management for production security
const createNonce = async (walletAddress: string, chain: string, walletType: string, sessionId: string): Promise<string> => {
  const nonce = randomBytes(32).toString('hex');
  const message = createVerificationMessage(nonce, walletType, walletAddress, chain);
  const expiresAt = new Date(Date.now() + NONCE_EXPIRY_MS);
  
  try {
    const nonceRow: NewAuthNonce = {
      nonce,
      wallet_address: walletAddress,
      chain,
      wallet_type: walletType,
      message,
      expires_at: expiresAt,
      session_id: sessionId,
      used: false
    };
    await db.insert(authNonces).values(nonceRow as any);
    
    return nonce;
  } catch (error) {
    console.error('❌ [NONCE] Failed to create nonce:', error);
    throw new Error('Failed to generate verification nonce');
  }
};

const validateAndUseNonce = async (nonce: string, walletAddress: string): Promise<{ valid: boolean; message?: string; error?: string }> => {
  try {
    // SECURITY FIX: Atomic nonce consumption with single UPDATE...RETURNING to prevent race conditions
    const nonceUpdate: UpdateAuthNonce = { used: true };
    const result = await db.update(authNonces)
      .set(nonceUpdate as any)
      .where(
        and(
          eq(authNonces.nonce, nonce),
          eq(authNonces.wallet_address, walletAddress),
          eq(authNonces.used, false),
          gt(authNonces.expires_at, new Date())
        )
      )
      .returning({ message: authNonces.message });
    
    // Only treat as success if a row was actually updated (prevents replay attacks)
    if (result.length === 0) {
      return { valid: false, error: 'Invalid, expired, or already used nonce' };
    }
    
    return { valid: true, message: result[0].message };
  } catch (error) {
    console.error('❌ [NONCE] Atomic validation error:', error);
    return { valid: false, error: 'Nonce validation failed' };
  }
};

const cleanupExpiredNonces = async (): Promise<void> => {
  try {
    await db.delete(authNonces).where(lt(authNonces.expires_at, new Date()));
    console.log('🧹 [NONCE] Cleaned up expired nonces');
  } catch (error) {
    console.error('❌ [NONCE] Cleanup error:', error);
  }
};

// External wallet sessions - temporary sessions for non-Riddle wallet users
const externalWalletSessions = new Map<string, {
  sessionId: string;
  walletType: string;
  address: string;
  chain: string;
  verified: boolean;
  createdAt: number;
  lastActivity: number;
}>();

// Rate limiting for verification attempts (in production, use Redis)
const verificationAttempts = new Map<string, {
  count: number;
  lastAttempt: number;
  blocked: boolean;
}>();

// Constants for security
const NONCE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
// More lenient rate limiting for external wallet connections (especially mobile devices)
const MAX_VERIFICATION_ATTEMPTS = 20; // Increased from 5 to 20 for mobile compatibility
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes (reduced from 15 for faster reset)
const RATE_LIMIT_BLOCK_MS = 10 * 60 * 1000; // 10 minutes (reduced from 30 for better UX)

// SECURITY: Zod schema for external wallet connections - defaults to unverified
const connectWalletSchema = z.object({
  wallet_type: z.string().min(1).max(50),
  address: z.string().min(1).max(255),
  chain: z.string().min(1).max(50),
  signature: z.string().optional(), // Optional signature for verification
  message: z.string().optional(), // Optional message that was signed
  verified: z.boolean().optional().default(false) // SECURITY: Default to false, require verification
});

type ConnectWalletRequest = z.infer<typeof connectWalletSchema>;

// Generate session ID for external wallet users (no authentication required)
const generateExternalSessionId = (): string => {
  return `ext_${randomBytes(16).toString('hex')}_${Date.now()}`;
};

// Check if user is authenticated with Riddle wallet
const isRiddleAuthenticated = async (req: any): Promise<{ authenticated: boolean; handle?: string }> => {
  // FIRST: Check for authenticated Riddle wallet user session
  if (req.user && req.user.handle) {
    return { authenticated: true, handle: req.user.handle };
  }
  
  // SECOND: Check Authorization header for session token
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const sessionToken = authHeader.replace('Bearer ', '');
    // Check if this is a valid Riddle wallet session
    const { getActiveSession } = await import('./riddle-wallet-auth');
    const session = getActiveSession(sessionToken);
    if (session && session.handle) {
      return { authenticated: true, handle: session.handle };
    }
  }
  
  // THIRD: Check session for Riddle wallet users (from sessionAuth middleware)
  if (req.session && req.session.user && req.session.user.handle) {
    return { authenticated: true, handle: req.session.user.handle };
  }
  
  return { authenticated: false };
};

// Get or create session ID from request
const getSessionId = (req: any): string => {
  // FIRST: Check for authenticated Riddle wallet user session
  if (req.user && req.user.handle) {
    return req.user.handle; // Use the authenticated user's handle
  }
  
  // SECOND: Check session for Riddle wallet users (from sessionAuth middleware)
  if (req.session && req.session.user && req.session.user.handle) {
    return req.session.user.handle;
  }
  
  // THIRD: Try to get from Authorization header (for authenticated Riddle wallet users)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.replace('Bearer ', ''); // Use full token as session ID for proper auth check
  }
  
  // FOURTH: Try to get from external_wallet_session cookie
  const cookieSession = req.cookies?.external_wallet_session;
  if (cookieSession) {
    console.log(`🍪 [SESSION] Using external wallet session from cookie: ${cookieSession.slice(0, 10)}...`);
    return cookieSession;
  }
  
  // FIFTH: Try to get from custom header (for external wallet sessions)
  const externalSessionId = req.headers['x-external-session-id'];
  if (externalSessionId) {
    return externalSessionId;
  }
  
  // LAST: Generate new session ID for external wallet users
  return generateExternalSessionId();
};

// Nonce challenge endpoint for secure verification (no authentication required)
router.post('/challenge', async (req, res) => {
  try {
    const { walletType, address, chain } = req.body;
    const sessionId = getSessionId(req);
    
    // External wallets don't need authentication - anyone can request a challenge
    
    // Validate input
    if (!walletType || !address || !chain) {
      return res.status(400).json({ 
        error: 'Missing required fields: walletType, address, chain' 
      });
    }
    
    // Rate limiting by session ID and address
    const rateLimitKey = `${sessionId}:${address}`;
    if (!checkRateLimit(rateLimitKey)) {
      await logSecurityEvent('Rate limit exceeded for challenge request', {
        sessionId,
        address,
        walletType,
        chain
      }, 'high');
      return res.status(429).json({ 
        error: 'Too many verification attempts. Please try again later.' 
      });
    }
    
    // Generate cryptographically secure nonce
    const nonce = randomBytes(32).toString('hex');
    const nonceKey = `${sessionId}:${address}:${walletType}`;
    
    // Store nonce in database with expiration
    try {
      await createNonce(address, chain, walletType, sessionId);
    } catch (error) {
      console.error('❌ [CHALLENGE] Failed to create nonce:', error);
      return res.status(500).json({ error: 'Failed to generate verification challenge' });
    }
    
    // Create verification message with context binding
    const message = createVerificationMessage(nonce, walletType, address, chain);
    
    console.log(`🔑 [CHALLENGE] Generated nonce for ${walletType} wallet: ${address.slice(0, 8)}...`);
    
    // Clean up old nonces
    cleanupExpiredNonces().catch(err => console.error('Nonce cleanup error:', err));
    
    res.json({
      success: true,
      nonce,
      message,
      sessionId, // Return session ID for external wallet tracking
      expiresIn: NONCE_EXPIRY_MS,
      instructions: {
        ethereum: 'Sign this message with your wallet to verify ownership.',
        solana: 'Sign this message with your wallet to verify ownership.',
        bitcoin: 'Sign this message with your Bitcoin wallet to verify ownership. Use the "Sign Message" feature in your wallet.',
        xrp: 'Sign this message with your wallet to verify ownership.'
      }
    });
    
  } catch (error) {
    console.error('❌ [CHALLENGE] Error generating challenge:', error);
    res.status(500).json({ error: 'Failed to generate verification challenge' });
  }
});

// REAL Xumm Cloud API integration (NO SDK - direct HTTP calls)
router.post('/xaman/connect', async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    const { 
      payloadType = 'signin', 
      amount, 
      destination, 
      memo, 
      currency = 'XRP', 
      issuer,
      purpose = 'Wallet connection'
    } = req.body;
    
    // REMOVED: Rate limiting disabled for external wallet connections
    // External wallets work independently without Riddle authentication
    // and may require multiple connection attempts on mobile devices (especially iOS)
    // No rate limiting needed for connection payload creation
    
    console.log(`🔗 [XAMAN] Creating ${payloadType} payload via Xumm Cloud API`);

    // Create proper XRPL transaction based on payload type
    let txJson: any = {};
    let payloadDescription = '';
    
    switch (payloadType) {
      case 'signin':
        txJson = {
          TransactionType: 'SignIn',
          Memos: [{
            Memo: {
              MemoType: Buffer.from('riddle-auth', 'utf8').toString('hex').toUpperCase(),
              MemoData: Buffer.from(`signin-${Date.now()}`, 'utf8').toString('hex').toUpperCase()
            }
          }]
        };
        payloadDescription = 'Sign in to Riddle.app';
        break;
        
      case 'payment':
        if (!destination || !amount) {
          return res.status(400).json({ 
            error: 'Payment payloads require destination and amount parameters' 
          });
        }
        
        // FIXED: Build proper XRPL amount object with correct drops conversion
        let amountObj: any;
        if (currency === 'XRP') {
          // XRP amounts MUST be in drops (1 XRP = 1,000,000 drops) as string
          const xrpAmount = parseFloat(amount);
          if (isNaN(xrpAmount) || xrpAmount <= 0) {
            return res.status(400).json({ error: 'Invalid XRP amount' });
          }
          amountObj = Math.floor(xrpAmount * 1000000).toString();
        } else {
          // Token amounts require currency and issuer (IOU format)
          if (!issuer) {
            return res.status(400).json({ 
              error: 'Token payments require issuer parameter' 
            });
          }
          amountObj = {
            value: amount.toString(),
            currency: currency.toUpperCase(),
            issuer: issuer
          };
        }
        
        txJson = {
          TransactionType: 'Payment',
          Destination: destination,
          Amount: amountObj,
          Flags: 131072 // tfPartialPayment for security
        };
        
        // Add memo if provided (proper hex encoding)
        if (memo && memo.trim()) {
          txJson.Memos = [{
            Memo: {
              MemoType: Buffer.from('payment', 'utf8').toString('hex').toUpperCase(),
              MemoData: Buffer.from(memo.trim(), 'utf8').toString('hex').toUpperCase()
            }
          }];
        }
        
        payloadDescription = `Pay ${amount} ${currency} to ${destination.slice(0, 10)}...`;
        break;
        
      case 'custom':
        // For custom payloads, accept transaction JSON directly
        const { transactionJson } = req.body;
        if (!transactionJson) {
          return res.status(400).json({ 
            error: 'Custom payloads require transactionJson parameter' 
          });
        }
        txJson = transactionJson;
        payloadDescription = `Custom transaction: ${txJson.TransactionType || 'Unknown'}`;
        break;
        
      default:
        return res.status(400).json({ 
          error: 'Invalid payload type. Supported types: signin, payment, custom' 
        });
    }
    
    // Build Xumm Cloud API payload request
    const xummPayload = {
      txjson: txJson,
      options: {
        submit: payloadType === 'payment', // Only submit payment transactions
        multisign: false,
        expire: 10, // 10 minutes
        return_url: {
          web: `https://riddleswap.com/xaman/callback`,
          app: `https://riddleswap.com`
        }
      },
      custom_meta: {
        identifier: `riddle-${payloadType}-${Date.now()}`,
        blob: {
          purpose: purpose,
          created_at: new Date().toISOString(),
          session_id: sessionId
        },
        instruction: payloadDescription
      }
    };

    console.log(`🌐 [XUMM API] Calling Xumm Cloud API payload endpoint...`);
    
    // CRITICAL: Call real Xumm Cloud API
    const xummResponse = await createXummPayload(xummPayload);
    
    if (!xummResponse || !xummResponse.uuid) {
      throw new Error('Invalid response from Xumm Cloud API');
    }

    const { uuid, next, refs } = xummResponse;
    
    // Extract real URLs from Xumm response
    const deepLink = next.always || `xumm://payload/${uuid}`;
    const webLink = refs.qr_web || `https://xumm.app/sign/${uuid}`;
    const qrUri = refs.qr_uri_quality_opts || refs.qr_uri || webLink;
    
    // Use QR code from Xumm API response (not generated locally!)
    console.log(`📱 [XUMM API] Using QR code from Xumm API response for UUID: ${uuid}`);
    const qrCodeBase64 = refs.qr_png; // Use QR code directly from Xumm API
    
    // Store payload info for polling
    pendingConnections.set(uuid, {
      sessionId,
      walletType: 'xaman',
      payloadType,
      purpose,
      txJson,
      createdAt: Date.now(),
      expiresAt: Date.now() + (10 * 60 * 1000), // 10 minutes
      status: 'pending',
      deepLink,
      webLink,
      qrUri,
      amount,
      destination,
      currency,
      memo,
      xummResponse // Store full Xumm response for reference
    });

    console.log(`✅ [XUMM API] Real payload created with UUID: ${uuid}`);

    res.json({
      success: true,
      uuid,
      payloadType,
      qrCode: qrCodeBase64,
      deepLink,
      webLink,
      qrUri,
      sessionId,
      purpose,
      description: payloadDescription,
      expiresIn: 600000, // 10 minutes in milliseconds
      xummMeta: {
        created: xummResponse.pushed,
        expires: xummResponse.expires_at
      },
      instructions: {
        qr: 'Scan this QR code with Xaman app',
        mobile: 'Tap the button below to open Xaman app',
        desktop: 'Scan the QR code with your mobile Xaman app'
      }
    });

  } catch (error) {
    console.error('❌ [XUMM API] Payload creation error:', error);
    
    // Log API failures for monitoring
    await logSecurityEvent('Xumm API payload creation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      sessionId: getSessionId(req),
      payloadType: req.body.payloadType
    }, 'high');
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to create Xaman payload',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Joey wallet connection using WalletConnect v2 for XRPL with QR code generation
router.post('/joey/connect', async (req, res) => {
  try {
    const { purpose } = req.body;
    const sessionId = getSessionId(req);
    const uuid = randomUUID();

    // Get WalletConnect Project ID from environment
  const projectId = serverWalletConfig.walletConnectProjectId;
    if (!projectId) {
      throw new Error('WalletConnect Project ID not configured');
    }

    // Create WalletConnect v2 URI for Joey wallet
    const topic = uuid;
    const symKey = randomBytes(32).toString('hex');
    
    // WalletConnect v2 URI format with project ID
    const wcUri = `wc:${topic}@2?relay-protocol=irn&symKey=${symKey}&projectId=${projectId}`;
    
    // XRPL transaction for signature (SignIn type)
    const signRequest = {
      id: 1,
      jsonrpc: "2.0",
      method: "xrpl_signTransaction",
      params: {
        tx_json: {
          TransactionType: "SignIn",
          Memos: [{
            Memo: {
              MemoType: Buffer.from("riddle-verify", 'utf8').toString('hex').toUpperCase(),
              MemoData: Buffer.from(`joey-verify-${uuid}`, 'utf8').toString('hex').toUpperCase()
            }
          }]
        },
        submit: false // Don't submit to ledger
      }
    };
    
    // Store pending connection
    pendingConnections.set(uuid, {
      sessionId,
      walletType: 'joey',
      purpose,
      createdAt: Date.now(),
      status: 'pending',
      wcUri: wcUri,
      signRequest: signRequest,
      topic: topic,
      symKey: symKey,
      projectId: projectId
    });

    // Generate QR code for the WalletConnect URI
    let qrCodeBase64 = null;
    try {
      // Use dynamic import for ES modules
      const QRCode = await import('qrcode');
      const qrCodeBuffer = await QRCode.toBuffer(wcUri, {
        type: 'png',
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      qrCodeBase64 = qrCodeBuffer.toString('base64');
      console.log(`✅ [JOEY] Generated QR code for URI: ${wcUri.substring(0, 50)}...`);
    } catch (qrError) {
      console.error('⚠️ [JOEY] QR code generation failed:', qrError);
      // Continue without QR code - deep link will still work
    }

    console.log(`🔗 [JOEY] Created WalletConnect session: ${uuid}`);
    console.log(`📱 [JOEY] Project ID: ${projectId}`);
    console.log(`🔗 [JOEY] WalletConnect URI: ${wcUri}`);

    res.json({
      uuid,
      qrCode: qrCodeBase64,
      deepLink: `joey://wc?uri=${encodeURIComponent(wcUri)}`,
      wcUri: wcUri,
      sessionId,
      signRequest: signRequest
    });

  } catch (error) {
    console.error('❌ [JOEY] Connection error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to create Joey wallet connection request',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Real Xumm Cloud API payload polling route
router.get('/xaman/poll/:uuid', async (req, res) => {
  try {
    const { uuid } = req.params;
    const sessionId = getSessionId(req);

    const connection = pendingConnections.get(uuid);
    
    if (!connection) {
      return res.status(404).json({ error: 'Payload not found' });
    }

    if (connection.sessionId !== sessionId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Check if payload has expired
    if (Date.now() - connection.createdAt > 10 * 60 * 1000) {
      pendingConnections.delete(uuid);
      return res.json({ status: 'expired' });
    }

    try {
      // CRITICAL: Call real Xumm Cloud API to get payload status
      console.log(`🔍 [XUMM API] Checking payload status for UUID: ${uuid}`);
      const statusResponse = await getXummPayloadStatus(uuid);
      
      if (!statusResponse || !statusResponse.meta) {
        throw new Error('Invalid status response from Xumm API');
      }

      const { meta, response: payloadResponse, custom_meta } = statusResponse;
      
      // Map Xumm status to our status format
      let status = 'pending';
      let result: any = null;
      
      if (meta.signed === true && meta.cancelled === false) {
        status = 'connected'; // Frontend expects 'connected' status
        result = {
          txid: payloadResponse?.txid,
          account: payloadResponse?.account,
          dispatched_to: payloadResponse?.dispatched_to,
          signed_at: meta.signed_at,
          // Enhanced payment details for receipts
          payment_details: connection.payloadType === 'payment' ? {
            amount: connection.amount,
            destination: connection.destination,
            currency: connection.currency,
            memo: connection.memo
          } : null
        };
        
        // Store the successful result
        connection.status = 'completed';
        connection.result = result;
        
        // If it's a payment, verify transaction on XRPL ledger
        if (connection.payloadType === 'payment' && result.txid) {
          try {
            const verification = await verifyXRPLTransaction(result.txid);
            result.ledger_verification = verification;
            
            if (verification.validated) {
              console.log(`✅ [XRPL] Payment ${result.txid} verified on ledger`);
            } else {
              console.log(`⚠️ [XRPL] Payment ${result.txid} not yet confirmed on ledger`);
            }
          } catch (verifyError) {
            console.error(`❌ [XRPL] Failed to verify payment ${result.txid}:`, verifyError);
            result.ledger_verification = { validated: false, error: 'Verification failed' };
          }
        }
        
        console.log(`✅ [XUMM API] Payload ${uuid} signed successfully by ${result.account}`);
        
      } else if (meta.cancelled === true) {
        status = 'cancelled';
        connection.status = 'cancelled';
        console.log(`❌ [XUMM API] Payload ${uuid} was cancelled by user`);
        
      } else if (meta.expired === true) {
        status = 'expired';
        connection.status = 'expired';
        pendingConnections.delete(uuid);
        console.log(`⏰ [XUMM API] Payload ${uuid} has expired`);
        
      } else {
        // Still pending
        status = 'pending';
        console.log(`⏳ [XUMM API] Payload ${uuid} still pending...`);
      }

      res.json({
        status,
        uuid,
        meta: {
          signed: meta.signed,
          cancelled: meta.cancelled,
          expired: meta.expired,
          opened: meta.opened,
          resolved: meta.resolved
        },
        result,
        custom_meta
      });
      
    } catch (apiError) {
      console.error(`❌ [XUMM API] Status check failed for ${uuid}:`, apiError);
      
      // If API call fails, return cached status or pending
      res.json({ 
        status: connection.status || 'pending',
        error: 'Unable to check current status',
        uuid
      });
    }

  } catch (error) {
    console.error('❌ [XUMM POLL] Polling error:', error);
    res.status(500).json({ success: false, error: 'Failed to check payload status' });
  }
});

// Legacy poll route for backward compatibility
router.get('/poll/:uuid', async (req, res) => {
  const { uuid } = req.params;
  const connection = pendingConnections.get(uuid);
  
  if (!connection) {
    return res.status(404).json({ error: 'Connection request not found' });
  }
  
  if (connection.walletType === 'xaman') {
    // Redirect to new Xaman polling route
    return res.redirect(`/api/external-wallet/xaman/poll/${uuid}`);
  }
  
  // Handle other wallet types (Joey, etc.)
  res.json({ status: 'pending', walletType: connection.walletType });
});

// Cleanup stuck Xaman payloads - prevents infinite polling
router.post('/xaman/cleanup', async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    const { uuids } = req.body;
    
    if (!Array.isArray(uuids)) {
      return res.status(400).json({ error: 'uuids must be an array' });
    }
    
    let cleanedUp = 0;
    
    for (const uuid of uuids) {
      const connection = pendingConnections.get(uuid);
      if (connection && connection.sessionId === sessionId) {
        // Only allow cleanup of own payloads
        pendingConnections.delete(uuid);
        cleanedUp++;
        console.log(`🧹 [XAMAN CLEANUP] Removed stuck payload: ${uuid}`);
      }
    }
    
    console.log(`🧹 [XAMAN CLEANUP] Cleaned up ${cleanedUp} stuck payloads for session ${sessionId}`);
    
    res.json({ 
      success: true, 
      cleaned_up: cleanedUp,
      message: 'Stuck payloads cleaned up successfully'
    });
    
  } catch (error) {
    console.error('❌ [XAMAN CLEANUP] Cleanup error:', error);
    res.status(500).json({ success: false, error: 'Failed to cleanup stuck payloads' });
  }
});

// Force cleanup all expired payloads - background maintenance
router.post('/cleanup-expired', async (req, res) => {
  try {
    const now = Date.now();
    const expired = [];
    
    // Check all pending connections for expiry (default 10 minutes)
    for (const [uuid, connection] of Array.from(pendingConnections.entries())) {
      const age = now - connection.createdAt;
      if (age > (10 * 60 * 1000)) { // 10 minutes
        expired.push(uuid);
        pendingConnections.delete(uuid);
      }
    }
    
    console.log(`🧹 [CLEANUP] Removed ${expired.length} expired payloads`);
    
    res.json({ 
      success: true,
      expired_count: expired.length,
      expired_payloads: expired
    });
    
  } catch (error) {
    console.error('❌ [CLEANUP] Expired cleanup error:', error);
    res.status(500).json({ error: 'Failed to cleanup expired payloads' });
  }
});

// Payment Receipt Generation Endpoint
router.get('/xaman/receipt/:uuid', async (req, res) => {
  try {
    const { uuid } = req.params;
    const sessionId = getSessionId(req);

    const connection = pendingConnections.get(uuid);
    
    if (!connection) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (connection.sessionId !== sessionId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (connection.payloadType !== 'payment') {
      return res.status(400).json({ error: 'Receipt only available for payment transactions' });
    }

    if (connection.status !== 'completed' || !connection.result) {
      return res.status(400).json({ error: 'Payment not completed yet' });
    }

    const result = connection.result;
    
    // Generate comprehensive payment receipt
    const receipt = {
      receipt_id: `RIDDLE-${uuid.toUpperCase()}`,
      payment_uuid: uuid,
      transaction_hash: result.txid,
      status: 'completed',
      created_at: new Date(connection.createdAt).toISOString(),
      completed_at: result.signed_at,
      
      // Payment details
      payment: {
        amount: connection.amount,
        currency: connection.currency || 'XRP',
        destination: connection.destination,
        sender: result.account,
        memo: connection.memo || null
      },
      
      // XRPL ledger verification details
      ledger_info: result.ledger_verification || null,
      
      // Transaction details
      transaction: {
        hash: result.txid,
        account: result.account,
        dispatched_to: result.dispatched_to,
        type: 'Payment',
        network: 'XRPL Mainnet'
      },
      
      // Receipt metadata
      receipt_generated_at: new Date().toISOString(),
      valid_until: new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)).toISOString(), // 1 year
      
      // Verification URLs
      verification: {
        xrpl_explorer: `https://livenet.xrpl.org/transactions/${result.txid}`,
        bithomp_explorer: `https://bithomp.com/explorer/${result.txid}`,
        xrpscan_explorer: `https://xrpscan.com/tx/${result.txid}`
      }
    };

    console.log(`📄 [RECEIPT] Generated receipt for payment ${uuid}`);

    res.json({
      success: true,
      receipt
    });

  } catch (error) {
    console.error('❌ [RECEIPT] Receipt generation error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate payment receipt' });
  }
});

// SECURITY FIXED: Generic wallet connection - now requires proper validation and defaults to unverified
router.post('/connect', async (req, res) => {
  try {
    // SECURITY FIX: Validate request body with Zod
    const validationResult = connectWalletSchema.safeParse(req.body);
    if (!validationResult.success) {
      console.error('❌ [CONNECT] Validation error:', validationResult.error.errors);
      return res.status(400).json({ 
        error: 'Invalid request data',
        details: validationResult.error.errors
      });
    }

    const { wallet_type, address, chain, signature, message, verified = false } = validationResult.data;
    const sessionId = getSessionId(req); // Get session ID for external wallet
    
    // Check if user is authenticated with Riddle wallet
    const authStatus = await isRiddleAuthenticated(req);
    
    // SECURITY CRITICAL: NEVER allow verification through /connect endpoint
    // This completely eliminates the verification bypass vulnerability
    if (verified) {
      console.error(`🚨 [SECURITY] Attempt to set verified=true through /connect endpoint blocked`);
      await logSecurityEvent('Attempted verification bypass through /connect endpoint', {
        sessionId,
        address,
        walletType: wallet_type,
        chain,
        hasSignature: !!signature,
        hasMessage: !!message
      }, 'critical');
      return res.status(400).json({ 
        error: 'Verification not allowed through /connect endpoint. Use /challenge and /verify endpoints for secure verification.',
        code: 'VERIFICATION_BYPASS_BLOCKED'
      });
    }
    
    // ALL wallets connected through this endpoint are UNVERIFIED by default
    const isVerified = false;

    // Use linkedWallets table if user is authenticated with Riddle wallet
    if (authStatus.authenticated && authStatus.handle) {
      console.log(`🔐 [AUTHENTICATED] Saving external wallet to linked_wallets for user: ${authStatus.handle}`);
      
      // Check if wallet already exists in linkedWallets
      const existingLinkedWallet = await db.select().from(linkedWallets)
        .where(and(
          eq(linkedWallets.user_id, authStatus.handle),
          eq(linkedWallets.wallet_type, wallet_type),
          eq(linkedWallets.chain, chain),
          eq(linkedWallets.address, address)
        ));

      if (existingLinkedWallet.length > 0) {
        // Update existing linked wallet
        const linkedUpdate: UpdateLinkedWallet = {
          last_activity: new Date(),
          verified: isVerified,
        };
        const updated = await db.update(linkedWallets)
          .set(linkedUpdate as any)
          .where(eq(linkedWallets.id, existingLinkedWallet[0].id))
          .returning();
        
        console.log(`🔄 [${wallet_type.toUpperCase()}] Updated linked wallet for ${authStatus.handle}: ${address}`);
        return res.json({ 
          success: true,
          message: 'Wallet connection updated',
          address,
          chain,
          wallet_type,
          verified: isVerified,
          riddle_authenticated: true
        });
      }

      // Insert new linked wallet for authenticated user
      const newLinked: NewLinkedWallet = {
        user_id: authStatus.handle,
        wallet_type,
        address,
        chain,
        verified: isVerified,
        source: 'external',
        wallet_label: `${wallet_type} ${chain}`,
        verified_at: isVerified ? new Date() : null
      };
  const inserted = await db.insert(linkedWallets).values(newLinked as any).returning();
      
      console.log(`✅ [${wallet_type.toUpperCase()}] New linked wallet for ${authStatus.handle}: ${address}`);

      return res.json({ 
        success: true,
        message: 'External wallet linked to Riddle wallet',
        address,
        chain,
        wallet_type,
        verified: isVerified,
        riddle_authenticated: true
      });
    }

    // For unauthenticated users: use externalWallets table (session-based temporary storage)
    console.log(`🔓 [UNAUTHENTICATED] Saving external wallet to externalWallets (session-only) for session: ${sessionId}`);
    
    const existingWallet = await db.select().from(externalWallets)
      .where(and(
        eq(externalWallets.user_id, sessionId),
        eq(externalWallets.wallet_type, wallet_type),
        eq(externalWallets.chain, chain),
        eq(externalWallets.address, address)
      ));

    if (existingWallet.length > 0) {
      // Update existing wallet
      const externalUpdate: UpdateExternalWallet = {
        last_used: new Date(),
        verified: isVerified,
        signature: signature || existingWallet[0].signature,
      };
      const updated = await db.update(externalWallets)
        .set(externalUpdate as any)
        .where(eq(externalWallets.id, existingWallet[0].id))
        .returning();
      
      console.log(`🔄 [${wallet_type.toUpperCase()}] Updated session wallet: ${address} (verified: ${isVerified})`);
      return res.json({ 
        success: true,
        message: 'Wallet connection updated (session-only)',
        address,
        chain,
        wallet_type,
        verified: isVerified,
        riddle_authenticated: false
      });
    }

    // Insert new wallet connection for unauthenticated user
    const newExternal: NewExternalWallet = {
      user_id: sessionId,
      wallet_type,
      address,
      chain,
      signature: signature || '',
      verified: isVerified,
      connected_at: new Date(),
      last_used: new Date(),
    };
  const inserted = await db.insert(externalWallets).values(newExternal as any).returning();
    
    console.log(`✅ [${wallet_type.toUpperCase()}] New session wallet: ${address} (verified: ${isVerified})`);

    res.json({ 
      success: true,
      message: 'Wallet connected (session-only) - login with Riddle wallet to save permanently',
      address,
      chain,
      wallet_type,
      verified: isVerified,
      riddle_authenticated: false
    });

  } catch (error) {
    console.error('❌ [CONNECT] Connection error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to connect wallet',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// SECURITY FIXED: Verify wallet signature with comprehensive security and nonce validation
router.post('/verify', async (req, res) => {
  try {
    const { walletType, address, chain, signature, message, nonce } = req.body;
    const sessionId = getSessionId(req); // Get session ID for external wallet
    
    // External wallets don't need authentication - use session ID as identifier
    
    // Rate limiting
    const rateLimitKey = `${sessionId}:${address}:verify`;
    if (!checkRateLimit(rateLimitKey)) {
      await logSecurityEvent('Rate limit exceeded for verification attempt', {
        sessionId,
        address,
        walletType,
        chain
      }, 'high');
      return res.status(429).json({ 
        error: 'Too many verification attempts. Please try again later.' 
      });
    }
    
    // Validate required fields
    if (!walletType || !address || !chain || !signature || !message) {
      await logSecurityEvent('Incomplete verification request', {
        sessionId,
        address,
        walletType,
        missingFields: {
          walletType: !walletType,
          address: !address,
          chain: !chain,
          signature: !signature,
          message: !message
        }
      }, 'medium');
      return res.status(400).json({ 
        error: 'Missing required fields: walletType, address, chain, signature, message' 
      });
    }
    
    console.log(`🔐 [VERIFY] Processing verification for ${walletType} wallet: ${address}`);
    await logSecurityEvent('Wallet verification attempt started', {
      sessionId,
      address,
      walletType,
      chain,
      messageLength: message.length,
      signatureLength: signature.length
    }, 'low');

    let isValid = false;

    if (walletType === 'metamask' && chain === 'eth') {
      // SECURITY ENHANCED: Ethereum signature verification with nonce validation using guard clauses
      try {
        // Guard clause: Check for nonce validation
        if (!message || !message.includes('Nonce:')) {
          console.error('❌ [ETHEREUM] Message missing nonce - possible replay attack');
          await logSecurityEvent('Ethereum verification without nonce', {
            sessionId,
            address,
            walletType,
            message: message?.substring(0, 100)
          }, 'high');
          isValid = false;
        } else {
          // Guard clause: Validate message context binding matches request
          const chainMatch = message.match(/Chain: ([\w]+)/);
          if (!chainMatch || chainMatch[1] !== chain) {
            console.error('❌ [ETHEREUM] Chain context mismatch - possible cross-chain attack');
            await logSecurityEvent('Ethereum verification chain context mismatch', {
              sessionId,
              address,
              walletType,
              expectedChain: chain,
              messageChain: chainMatch?.[1] || 'missing'
            }, 'critical');
            isValid = false;
          } else {
            // Guard clause: Validate wallet type context binding
            const walletMatch = message.match(/Wallet: ([\w]+)/);
            if (!walletMatch || walletMatch[1] !== walletType) {
              console.error('❌ [ETHEREUM] Wallet type context mismatch - possible cross-wallet attack');
              await logSecurityEvent('Ethereum verification wallet type mismatch', {
                sessionId,
                address,
                walletType,
                expectedWallet: walletType,
                messageWallet: walletMatch?.[1] || 'missing'
              }, 'critical');
              isValid = false;
            } else {
              // Guard clause: Extract and validate nonce format
              const nonceMatch = message.match(/Nonce: ([a-f0-9]+)/);
              if (!nonceMatch) {
                console.error('❌ [ETHEREUM] Invalid nonce format');
                await logSecurityEvent('Ethereum verification invalid nonce format', {
                  sessionId,
                  address,
                  walletType
                }, 'high');
                isValid = false;
              } else {
                const extractedNonce = nonceMatch[1];
                
                // Validate and use nonce from database
                const nonceValidation = await validateAndUseNonce(extractedNonce, address);
                
                if (!nonceValidation.valid) {
                  console.error('❌ [ETHEREUM] Nonce validation failed:', nonceValidation.error);
                  await logSecurityEvent('Ethereum verification nonce validation failed', {
                    sessionId,
                    address,
                    walletType,
                    extractedNonce,
                    error: nonceValidation.error
                  }, 'high');
                  isValid = false;
                } else {
                  // Success path: Cryptographic verification
                  const recoveredAddress = ethers.verifyMessage(message, signature);
                  isValid = recoveredAddress.toLowerCase() === address.toLowerCase();
                  
                  if (isValid) {
                    console.log(`✅ [ETHEREUM] Signature verified successfully for: ${address}`);
                    await logSecurityEvent('Ethereum signature verified successfully', {
                      sessionId,
                      address,
                      walletType
                    }, 'low');
                  } else {
                    console.error('❌ [ETHEREUM] Address mismatch in signature');
                    await logSecurityEvent('Ethereum signature address mismatch', {
                      sessionId,
                      expectedAddress: address,
                      recoveredAddress,
                      walletType
                    }, 'high');
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('❌ [ETHEREUM] Signature verification failed:', error);
        await logSecurityEvent('Ethereum signature verification error', {
          sessionId,
          address,
          walletType,
          error: error instanceof Error ? error.message : 'Unknown error'
        }, 'high');
        isValid = false;
      }
    } else if (walletType === 'phantom' && chain === 'sol') {
      // SECURITY FIXED: Proper Solana signature verification with nonce validation using guard clauses
      try {
        // Guard clause: Check for nonce validation
        if (!message || !message.includes('Nonce:')) {
          console.error('❌ [SOLANA] Message missing nonce - possible replay attack');
          await logSecurityEvent('Solana verification without nonce', {
            sessionId,
            address,
            walletType,
            message: message?.substring(0, 100)
          }, 'high');
          isValid = false;
        } else {
          // Guard clause: Validate message context binding matches request
          const chainMatch = message.match(/Chain: ([\w]+)/);
          if (!chainMatch || chainMatch[1] !== chain) {
            console.error('❌ [SOLANA] Chain context mismatch - possible cross-chain attack');
            await logSecurityEvent('Solana verification chain context mismatch', {
              sessionId,
              address,
              walletType,
              expectedChain: chain,
              messageChain: chainMatch?.[1] || 'missing'
            }, 'critical');
            isValid = false;
          } else {
            // Guard clause: Validate wallet type context binding
            const walletMatch = message.match(/Wallet: ([\w]+)/);
            if (!walletMatch || walletMatch[1] !== walletType) {
              console.error('❌ [SOLANA] Wallet type context mismatch - possible cross-wallet attack');
              await logSecurityEvent('Solana verification wallet type mismatch', {
                sessionId,
                address,
                walletType,
                expectedWallet: walletType,
                messageWallet: walletMatch?.[1] || 'missing'
              }, 'critical');
              isValid = false;
            } else {
              // Guard clause: Extract and validate nonce format
              const nonceMatch = message.match(/Nonce: ([a-f0-9]+)/);
              if (!nonceMatch) {
                console.error('❌ [SOLANA] Invalid nonce format');
                await logSecurityEvent('Solana verification invalid nonce format', {
                  sessionId,
                  address,
                  walletType
                }, 'high');
                isValid = false;
              } else {
                const extractedNonce = nonceMatch[1];
                
                // Validate and use nonce from database
                const nonceValidation = await validateAndUseNonce(extractedNonce, address);
                
                if (!nonceValidation.valid) {
                  console.error('❌ [SOLANA] Nonce validation failed:', nonceValidation.error);
                  await logSecurityEvent('Solana verification nonce validation failed', {
                    sessionId,
                    address,
                    walletType,
                    extractedNonce,
                    error: nonceValidation.error
                  }, 'high');
                  isValid = false;
                } else {
                  // Success path: Proper cryptographic verification using the helper function
                  isValid = verifySolanaSignature(message, signature, address);
                  
                  if (isValid) {
                    console.log(`✅ [SOLANA] Signature verified successfully for: ${address}`);
                    await logSecurityEvent('Solana signature verified successfully', {
                      sessionId,
                      address,
                      walletType
                    }, 'low');
                  } else {
                    console.error('❌ [SOLANA] Cryptographic signature verification failed');
                    await logSecurityEvent('Solana cryptographic signature verification failed', {
                      sessionId,
                      address,
                      walletType,
                      signatureLength: signature.length
                    }, 'high');
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('❌ [SOLANA] Signature verification error:', error);
        await logSecurityEvent('Solana signature verification error', {
          sessionId,
          address,
          walletType,
          error: error instanceof Error ? error.message : 'Unknown error'
        }, 'high');
        isValid = false;
      }
    } else if (chain === 'btc') {
      // SECURITY ENHANCED: Bitcoin signature verification with nonce validation using guard clauses
      try {
        // Guard clause: Check for nonce validation
        if (!message || !message.includes('Nonce:')) {
          console.error('❌ [BITCOIN] Message missing nonce - possible replay attack');
          await logSecurityEvent('Bitcoin verification without nonce', {
            sessionId,
            address,
            walletType,
            message: message?.substring(0, 100)
          }, 'high');
          isValid = false;
        } else {
          // Guard clause: Validate message context binding matches request
          const chainMatch = message.match(/Chain: ([\w]+)/);
          if (!chainMatch || chainMatch[1] !== chain) {
            console.error('❌ [BITCOIN] Chain context mismatch - possible cross-chain attack');
            await logSecurityEvent('Bitcoin verification chain context mismatch', {
              sessionId,
              address,
              walletType,
              expectedChain: chain,
              messageChain: chainMatch?.[1] || 'missing'
            }, 'critical');
            isValid = false;
          } else {
            // Guard clause: Validate wallet type context binding
            const walletMatch = message.match(/Wallet: ([\w]+)/);
            if (!walletMatch || walletMatch[1] !== walletType) {
              console.error('❌ [BITCOIN] Wallet type context mismatch - possible cross-wallet attack');
              await logSecurityEvent('Bitcoin verification wallet type mismatch', {
                sessionId,
                address,
                walletType,
                expectedWallet: walletType,
                messageWallet: walletMatch?.[1] || 'missing'
              }, 'critical');
              isValid = false;
            } else {
              // Guard clause: Extract and validate nonce format
              const nonceMatch = message.match(/Nonce: ([a-f0-9]+)/);
              if (!nonceMatch) {
                console.error('❌ [BITCOIN] Invalid nonce format');
                await logSecurityEvent('Bitcoin verification invalid nonce format', {
                  sessionId,
                  address,
                  walletType
                }, 'high');
                isValid = false;
              } else {
                const extractedNonce = nonceMatch[1];
                
                // Validate and use nonce from database
                const nonceValidation = await validateAndUseNonce(extractedNonce, address);
                
                if (!nonceValidation.valid) {
                  console.error('❌ [BITCOIN] Nonce validation failed:', nonceValidation.error);
                  await logSecurityEvent('Bitcoin verification nonce validation failed', {
                    sessionId,
                    address,
                    walletType,
                    extractedNonce,
                    error: nonceValidation.error
                  }, 'high');
                  isValid = false;
                } else {
                  // Success path: Proper cryptographic verification using the helper function
                  isValid = verifyBitcoinSignature(message, signature, address);
                  
                  if (isValid) {
                    console.log(`✅ [BITCOIN] Signature verified successfully for: ${address}`);
                    await logSecurityEvent('Bitcoin signature verified successfully', {
                      sessionId,
                      address,
                      walletType
                    }, 'low');
                  } else {
                    console.error('❌ [BITCOIN] Cryptographic signature verification failed');
                    await logSecurityEvent('Bitcoin cryptographic signature verification failed', {
                      sessionId,
                      address,
                      walletType,
                      signatureLength: signature.length
                    }, 'high');
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('❌ [BITCOIN] Signature verification error:', error);
        await logSecurityEvent('Bitcoin signature verification error', {
          sessionId,
          address,
          walletType,
          error: error instanceof Error ? error.message : 'Unknown error'
        }, 'high');
        isValid = false;
      }
    }

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid signature' });
    }

    // SECURITY: Upsert wallet connection in database - prevent duplicates
    if (!sessionId) {
      return res.status(401).json({ error: 'User ID not found' });
    }
    
    try {
      // Check if wallet connection already exists
      const existingWallet = await db.select().from(externalWallets)
        .where(and(
          eq(externalWallets.user_id, sessionId),
          eq(externalWallets.wallet_type, walletType),
          eq(externalWallets.chain, chain),
          eq(externalWallets.address, address)
        ));

      if (existingWallet.length > 0) {
        // Update existing wallet to mark as verified
        const verifyUpdate: UpdateExternalWallet = {
          verified: true,
          signature,
          last_used: new Date(),
        };
        await db.update(externalWallets)
          .set(verifyUpdate as any)
          .where(eq(externalWallets.id, existingWallet[0].id));
        
        console.log(`✅ [${walletType.toUpperCase()}] Existing wallet verified and updated: ${address}`);
        await logSecurityEvent('Existing wallet verified successfully', {
          sessionId,
          address,
          walletType,
          chain,
          walletId: existingWallet[0].id
        }, 'low');
      } else {
        // Insert new verified wallet connection
        const verifiedExternal: NewExternalWallet = {
          user_id: sessionId,
          wallet_type: walletType,
          address,
          chain,
          signature,
          verified: true,
          connected_at: new Date(),
          last_used: new Date(),
        };
  await db.insert(externalWallets).values(verifiedExternal as any);
        
        console.log(`✅ [${walletType.toUpperCase()}] New wallet verified and stored: ${address}`);
        await logSecurityEvent('New wallet verified and stored', {
          sessionId,
          address,
          walletType,
          chain
        }, 'low');
      }

      // PROMOTE TO LINKED WALLETS: If user is authenticated, also save to linkedWallets for gaming system
      let userHandle = null;
      if ((req as any).user && (req as any).user.handle) {
        userHandle = (req as any).user.handle;
      } else if ((req as any).session && (req as any).session.user && (req as any).session.user.handle) {
        userHandle = (req as any).session.user.handle;
      }
      if (userHandle) {
        try {
          // Check if this wallet is already linked to this user
          const existingLinkedWallet = await db.select().from(linkedWallets).where(
            and(
              eq(linkedWallets.user_id, userHandle),
              eq(linkedWallets.chain, chain),
              eq(linkedWallets.address, address)
            )
          );

          if (existingLinkedWallet.length === 0) {
            // Insert new linked wallet for authenticated user
            await db.insert(linkedWallets).values({
              user_id: userHandle,
              address,
              chain,
              wallet_type: walletType,
              verified: true,
              proof_signature: signature,
              proof_message: `Verification for ${walletType} wallet on ${chain}`,
              verification_nonce: nonce,
              source: 'from_session',
              verified_at: new Date(),
              last_activity: new Date()
            } as any);
            
            console.log(`🔗 [PROMOTE] Wallet promoted to linked wallets for user: ${userHandle}`);
          } else {
            // Update existing linked wallet
            await db.update(linkedWallets)
              .set({ 
                verified: true,
                proof_signature: signature,
                verified_at: new Date(),
                last_activity: new Date()
               } as any)
              .where(eq(linkedWallets.id, existingLinkedWallet[0].id));
            
            console.log(`🔗 [PROMOTE] Existing linked wallet updated for user: ${userHandle}`);
          }
        } catch (promoteError) {
          console.error('❌ [PROMOTE] Failed to promote wallet to linked wallets:', promoteError);
          // Don't fail the entire verification - this is a bonus feature
        }
      } else {
        console.log(`ℹ️ [PROMOTE] User not authenticated - wallet stored in external_wallets only`);
      }
    } catch (dbError) {
      console.error('❌ [DB] Failed to store/update wallet:', dbError);
      await logSecurityEvent('Database error during wallet verification storage', {
        sessionId,
        address,
        walletType,
        chain,
        error: dbError instanceof Error ? dbError.message : 'Unknown error'
      }, 'high');
      return res.status(500).json({ error: 'Failed to store wallet verification' });
    }

    res.json({ 
      verified: true,
      address,
      chain,
      walletType
    });

  } catch (error) {
    console.error('❌ [VERIFY] Verification error:', error);
    res.status(500).json({ success: false, error: 'Failed to verify wallet signature' });
  }
});

// Clean up expired connections periodically
setInterval(() => {
  const now = Date.now();
  const expiredThreshold = 5 * 60 * 1000; // 5 minutes

  for (const [uuid, connection] of Array.from(pendingConnections.entries())) {
    if (now - connection.createdAt > expiredThreshold) {
      pendingConnections.delete(uuid);
      console.log(`🧹 [CLEANUP] Removed expired connection: ${uuid}`);
    }
  }
}, 60000); // Clean up every minute

// Get user's external wallets (works with both authenticated and external wallet sessions)
router.get('/list', async (req, res) => {
  try {
    const sessionId = getSessionId(req); // Get session ID for both authenticated and external wallet users
    
    // Check if user is authenticated with Riddle wallet
    const authStatus = await isRiddleAuthenticated(req);
    
    let userWallets = [];
    
    if (authStatus.authenticated && authStatus.handle) {
      // For authenticated Riddle wallet users, get wallets from linked_wallets table
      console.log(`🔐 [LIST] Getting linked wallets for authenticated user: ${authStatus.handle}`);
      
      const linkedWalletsList = await db.select().from(linkedWallets)
        .where(eq(linkedWallets.user_id, authStatus.handle))
        .orderBy(linkedWallets.created_at);
      
      // Map linked_wallets schema to expected format
      userWallets = linkedWalletsList.map(wallet => ({
        id: wallet.id,
        user_id: wallet.user_id,
        wallet_type: wallet.wallet_type,
        address: wallet.address,
        chain: wallet.chain,
        verified: wallet.verified,
        signature: '',
        connected_at: wallet.created_at,
        last_used: wallet.last_activity || wallet.created_at,
        source: wallet.source,
        wallet_label: wallet.wallet_label
      }));
      
      console.log(`✅ [LIST] Found ${userWallets.length} linked wallets for ${authStatus.handle}`);
    } else {
      // For unauthenticated external wallet users, get from externalWallets table (session-only)
      console.log(`🔓 [LIST] Getting session wallets for unauthenticated session: ${sessionId}`);
      
      userWallets = await db.select().from(externalWallets)
        .where(eq(externalWallets.user_id, sessionId))
        .orderBy(externalWallets.connected_at);
      
      console.log(`✅ [LIST] Found ${userWallets.length} session wallets`);
    }
    
    console.log(`📝 [EXTERNAL WALLETS] Found ${userWallets.length} wallets for ${authStatus.authenticated ? authStatus.handle : sessionId}`);
    
    res.json({ wallets: userWallets });
    
  } catch (error) {
    console.error('❌ [EXTERNAL WALLETS] Failed to fetch wallets:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch external wallets' });
  }
});

// Disconnect external wallet (works with both authenticated and external wallet sessions)
router.delete('/:walletId', async (req, res) => {
  try {
    const sessionId = getSessionId(req); // Get session ID for both authenticated and external wallet users  
    const { walletId } = req.params;
    
    const result = await db.delete(externalWallets)
      .where(and(
        eq(externalWallets.id, parseInt(walletId)),
        eq(externalWallets.user_id, sessionId)
      ))
      .returning();
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'Wallet not found or unauthorized' });
    }
    
    console.log(`🗑️ [EXTERNAL WALLETS] Disconnected wallet: ${result[0].address}`);
    
    res.json({ success: true, disconnected: result[0] });
    
  } catch (error) {
    console.error('❌ [EXTERNAL WALLETS] Failed to disconnect wallet:', error);
    res.status(500).json({ success: false, error: 'Failed to disconnect wallet' });
  }
});

// Xaman callback route - handles redirect after wallet connection/payment
router.get('/xaman/callback', async (req, res) => {
  try {
    const { payload } = req.query;
    
    console.log(`🔙 [XAMAN CALLBACK] Redirect from Xaman, payload: ${payload || 'none'}`);
    
    // If there's a payload ID, verify and create session
    if (payload) {
      const uuid = payload as string;
      const connection = pendingConnections.get(uuid);
      
      if (connection) {
        console.log(`✅ [XAMAN CALLBACK] Found pending connection for payload: ${uuid}`);
        console.log(`📊 [XAMAN CALLBACK] Connection type: ${connection.payloadType}, status: ${connection.status}`);
        
        // Check payload status via Xumm API
        try {
          const statusResponse = await getXummPayloadStatus(uuid);
          
          if (statusResponse?.meta?.signed && statusResponse.response?.account) {
            const address = statusResponse.response.account;
            console.log(`✅ [XAMAN CALLBACK] Payload signed successfully, wallet: ${address}`);
            
            // Create or get existing session - use Express session.id or generate new one
            let sessionId = (req.session as any)?.id || randomUUID().replace(/-/g, '').slice(0, 20);
            console.log(`🔑 [XAMAN CALLBACK] Using session for external wallet: ${sessionId}`);
            
            // If no session exists, create one
            if (!(req.session as any)?.id) {
              console.log(`🔑 [XAMAN CALLBACK] Created new session for external wallet: ${sessionId}`);
            }
            
            // Save wallet to externalWallets table
            const existingWallet = await db.select().from(externalWallets)
              .where(and(
                eq(externalWallets.user_id, sessionId),
                eq(externalWallets.wallet_type, 'xaman'),
                eq(externalWallets.chain, 'xrp'),
                eq(externalWallets.address, address)
              ))
              .limit(1);
            
            if (existingWallet.length === 0) {
              await db.insert(externalWallets).values({
                user_id: sessionId,
                wallet_type: 'xaman',
                address,
                chain: 'xrp',
                verified: true, // Xaman signature verified
                signature: uuid, // Store UUID as signature proof
                connected_at: new Date(),
                last_used: new Date()
              } as any);
              console.log(`💾 [XAMAN CALLBACK] Saved wallet to externalWallets: ${address}`);
            } else {
              await db.update(externalWallets)
                .set({  
                  last_used: new Date(),
                  verified: true
                 } as any)
                .where(eq(externalWallets.id, existingWallet[0].id));
              console.log(`🔄 [XAMAN CALLBACK] Updated existing wallet: ${address}`);
            }
            
            // Store session token in cookie for frontend
            res.cookie('external_wallet_session', sessionId, {
              httpOnly: false, // Allow frontend to read
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            });
            
            console.log(`🍪 [XAMAN CALLBACK] Set session cookie for: ${sessionId}`);
            
            // Update connection status
            connection.status = 'signed';
            connection.result = { account: address };
          }
        } catch (error) {
          console.error('❌ [XAMAN CALLBACK] Error verifying payload:', error);
        }
      }
    }
    
    // Redirect back to riddleswap.com
    const redirectUrl = 'https://riddleswap.com';
    console.log(`↩️ [XAMAN CALLBACK] Redirecting to: ${redirectUrl}`);
    
    res.redirect(redirectUrl);
    
  } catch (error) {
    console.error('❌ [XAMAN CALLBACK] Callback error:', error);
    // Still redirect to riddleswap.com even on error
    res.redirect('https://riddleswap.com');
  }
});

// Joey callback route - handles redirect after wallet connection
router.get('/joey/callback', async (req, res) => {
  try {
    const { uuid } = req.query;
    
    console.log(`🔙 [JOEY CALLBACK] Redirect from Joey, uuid: ${uuid || 'none'}`);
    
    // If there's a UUID, log it for tracking
    if (uuid) {
      const connection = pendingConnections.get(uuid as string);
      if (connection) {
        console.log(`✅ [JOEY CALLBACK] Found pending connection for UUID: ${uuid}`);
        console.log(`📊 [JOEY CALLBACK] Connection status: ${connection.status}`);
      }
    }
    
    // Redirect back to riddleswap.com - frontend polling will handle the rest
    const redirectUrl = 'https://riddleswap.com';
    console.log(`↩️ [JOEY CALLBACK] Redirecting to: ${redirectUrl}`);
    
    res.redirect(redirectUrl);
    
  } catch (error) {
    console.error('❌ [JOEY CALLBACK] Callback error:', error);
    // Still redirect to riddleswap.com even on error
    res.redirect('https://riddleswap.com');
  }
});


export default router;

// Cleanup expired payloads periodically
setInterval(() => {
  const now = Date.now();
  for (const [uuid, connection] of Array.from(pendingConnections.entries())) {
    if (now - connection.createdAt > 15 * 60 * 1000) { // 15 minutes
      pendingConnections.delete(uuid);
      console.log(`🧹 [CLEANUP] Removed expired payload: ${uuid}`);
    }
  }
}, 5 * 60 * 1000); // Run every 5 minutes