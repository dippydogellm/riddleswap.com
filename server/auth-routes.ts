import { Router } from "express";
import { z } from "zod";
import { createAuthNonce, verifyAndConsumeNonce } from "./utils/auth-nonce";
import { verifySignature, validateWalletAddress } from "./utils/signature-verification";
import { storage } from "./storage";
import { InsertExternalWallet } from "@shared/schema";
import crypto from "crypto";

const router = Router();

// External wallet session storage - SERVER SIDE ONLY
const externalWalletSessions = new Map<string, {
  sessionToken: string;
  walletAddress: string;
  chain: string;
  walletType: string;
  userId: string;
  verified: boolean;
  expiresAt: number;
  createdAt: number;
}>();

// Generate secure session token
function generateSecureSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Auto-cleanup expired external wallet sessions every 10 minutes  
setInterval(() => {
  const now = Date.now();
  const entries = Array.from(externalWalletSessions.entries());
  for (const [token, session] of entries) {
    if (now > session.expiresAt) {
      console.log('🧹 Auto-cleaning expired external wallet session');
      externalWalletSessions.delete(token);
    }
  }
}, 10 * 60 * 1000);

// Export function to validate external wallet sessions
export function getExternalWalletSession(sessionToken: string) {
  const session = externalWalletSessions.get(sessionToken);
  if (!session) return null;
  
  if (Date.now() > session.expiresAt) {
    externalWalletSessions.delete(sessionToken);
    return null;
  }
  
  return session;
}

// Validation schemas
const nonceRequestSchema = z.object({
  walletAddress: z.string().min(1, "Wallet address is required"),
  chain: z.enum(["ethereum", "eth", "xrpl", "xrp", "solana", "sol", "polygon", "matic", "bsc", "arbitrum", "optimism"]),
  walletType: z.enum(["metamask", "phantom", "xaman", "joey", "walletconnect", "coinbase", "other"])
});

const verifySignatureSchema = z.object({
  nonce: z.string().min(1, "Nonce is required"),
  signature: z.string().min(1, "Signature is required"),
  walletAddress: z.string().min(1, "Wallet address is required"),
  chain: z.string().min(1, "Chain is required"),
  userId: z.string().optional() // Optional user ID for linking to existing account
});

/**
 * POST /api/auth-nonce
 * Generate a new authentication nonce for wallet signature
 */
router.post("/auth-nonce", async (req, res) => {
  try {
    const body = nonceRequestSchema.parse(req.body);
    const { walletAddress, chain, walletType } = body;
    
    // Validate wallet address format
    if (!validateWalletAddress(walletAddress, chain)) {
      return res.status(400).json({
        error: "Invalid wallet address format for the specified chain"
      });
    }
    
    // Check if wallet is blocked due to too many failed attempts
    const existingWallet = await storage.getExternalWalletByAddress(walletAddress, chain);
    if (existingWallet?.blocked_until && new Date() < existingWallet.blocked_until) {
      const blockedUntil = existingWallet.blocked_until.toISOString();
      return res.status(429).json({
        error: "Wallet is temporarily blocked due to too many failed verification attempts",
        blockedUntil
      });
    }
    
    // Generate session ID for tracking
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create auth nonce
    const authNonce = await createAuthNonce(
      walletAddress,
      chain,
      walletType,
      sessionId,
      15 // 15 minutes expiry
    );
    
    res.json({
      success: true,
      nonce: authNonce.nonce,
      message: authNonce.message,
      expiresAt: authNonce.expires_at
    });
    
  } catch (error) {
    console.error("Error generating auth nonce:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid request data",
        details: error.errors
      });
    }
    
    res.status(500).json({
      error: "Failed to generate authentication nonce"
    });
  }
});

/**
 * POST /api/auth-verify
 * Verify wallet signature and complete authentication
 */
router.post("/auth-verify", async (req, res) => {
  try {
    const body = verifySignatureSchema.parse(req.body);
    const { nonce, signature, walletAddress, chain, userId } = body;
    
    // Verify and consume the nonce
    const authNonce = await verifyAndConsumeNonce(nonce);
    if (!authNonce) {
      return res.status(400).json({
        error: "Invalid or expired nonce"
      });
    }
    
    // Verify the nonce matches the provided wallet and chain
    if (authNonce.wallet_address !== walletAddress || authNonce.chain !== chain) {
      return res.status(400).json({
        error: "Nonce does not match provided wallet address or chain"
      });
    }
    
    // Check if wallet is blocked
    const existingWallet = await storage.getExternalWalletByAddress(walletAddress, chain);
    if (existingWallet?.blocked_until && new Date() < existingWallet.blocked_until) {
      return res.status(429).json({
        error: "Wallet is temporarily blocked due to too many failed verification attempts"
      });
    }
    
    // Verify the signature
    const verificationResult = verifySignature(
      authNonce.message,
      signature,
      walletAddress,
      chain
    );
    
    if (!verificationResult.isValid) {
      // Increment failed verification attempts
      if (existingWallet) {
        await storage.incrementVerificationAttempts(walletAddress, chain);
        
        // Block wallet if too many failed attempts (5 attempts = 1 hour block)
        const maxAttempts = 5;
        const newAttempts = (existingWallet.verification_attempts || 0) + 1;
        if (newAttempts >= maxAttempts) {
          const blockUntil = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
          await storage.blockWallet(walletAddress, chain, blockUntil);
        }
      }
      
      return res.status(400).json({
        error: "Invalid signature",
        details: verificationResult.error
      });
    }
    
    // Signature is valid - handle wallet linking/verification
    let wallet = existingWallet;
    
    if (!wallet) {
      // Create new external wallet entry
      const walletData: InsertExternalWallet = {
        user_id: userId || `wallet-${walletAddress}`, // Use provided userId or generate one
        wallet_type: authNonce.wallet_type,
        address: walletAddress,
        chain: chain,
        signature: signature,
        verified: true,
        verification_message: authNonce.message
      };
      
      wallet = await storage.createExternalWallet(walletData);
    } else {
      // Update existing wallet
      wallet = await storage.updateExternalWallet(wallet.id, {
        signature: signature,
        verified: true,
        verification_message: authNonce.message,
        user_id: userId || wallet.user_id
      });
    }
    
    // Clear the nonce data from the wallet
    await storage.clearWalletNonce(walletAddress, chain);
    
    // SECURITY FIX: Generate and return server-issued session token
    const sessionToken = generateSecureSessionToken();
    const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
    const now = Date.now();
    
    // Store session in server-side memory
    externalWalletSessions.set(sessionToken, {
      sessionToken,
      walletAddress,
      chain,
      walletType: authNonce.wallet_type,
      userId: userId || wallet?.user_id || `wallet-${walletAddress}`,
      verified: true,
      expiresAt,
      createdAt: now
    });
    
    console.log(`✅ [AUTH] Created secure session for ${authNonce.wallet_type} wallet: ${walletAddress.slice(0, 8)}...`);
    
    res.json({
      success: true,
      message: "Wallet verified successfully",
      sessionToken: sessionToken, // CRITICAL: Return server-issued token
      expiresAt: new Date(expiresAt).toISOString(),
      wallet: {
        id: wallet?.id,
        address: wallet?.address,
        chain: wallet?.chain,
        verified: wallet?.verified,
        walletType: wallet?.wallet_type
      }
    });
    
  } catch (error) {
    console.error("Error verifying signature:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid request data",
        details: error.errors
      });
    }
    
    res.status(500).json({
      error: "Failed to verify wallet signature"
    });
  }
});

/**
 * GET /api/auth-status/:walletAddress/:chain
 * Check authentication status for a wallet - REQUIRES AUTHORIZATION HEADER
 */
router.get("/auth-status/:walletAddress/:chain", async (req, res) => {
  try {
    // SECURITY FIX: Require Authorization header
    const authHeader = req.headers.authorization;
    const sessionToken = authHeader?.replace('Bearer ', '');
    
    if (!sessionToken) {
      return res.status(401).json({
        authenticated: false,
        error: "Authorization header required"
      });
    }
    
    // Validate session token
    const session = getExternalWalletSession(sessionToken);
    if (!session) {
      return res.status(401).json({
        authenticated: false,
        error: "Invalid or expired session"
      });
    }
    
    const { walletAddress, chain } = req.params;
    
    // Ensure the session matches the requested wallet
    if (session.walletAddress !== walletAddress || session.chain !== chain) {
      return res.status(403).json({
        authenticated: false,
        error: "Session does not match requested wallet"
      });
    }
    
    const wallet = await storage.getExternalWalletByAddress(walletAddress, chain);
    
    if (!wallet) {
      return res.json({
        authenticated: false,
        wallet: null
      });
    }
    
    res.json({
      authenticated: wallet.verified && session.verified,
      wallet: {
        id: wallet.id,
        address: wallet.address,
        chain: wallet.chain,
        verified: wallet.verified,
        walletType: wallet.wallet_type,
        connectedAt: wallet.connected_at,
        lastUsed: wallet.last_used
      }
    });
    
  } catch (error) {
    console.error("Error checking auth status:", error);
    res.status(500).json({
      error: "Failed to check authentication status"
    });
  }
});

/**
 * POST /api/auth-logout
 * Logout and clear wallet authentication
 */
router.post("/auth-logout", async (req, res) => {
  try {
    const { walletAddress, chain } = req.body;
    
    if (!walletAddress || !chain) {
      return res.status(400).json({
        error: "Wallet address and chain are required"
      });
    }
    
    // Clear nonce data and reset verification status
    await storage.clearWalletNonce(walletAddress, chain);
    
    const wallet = await storage.getExternalWalletByAddress(walletAddress, chain);
    if (wallet) {
      await storage.updateExternalWallet(wallet.id, {
        verified: false,
        signature: null,
        verification_message: null
      });
    }
    
    res.json({
      success: true,
      message: "Logged out successfully"
    });
    
  } catch (error) {
    console.error("Error during logout:", error);
    res.status(500).json({
      error: "Failed to logout"
    });
  }
});

export default router;