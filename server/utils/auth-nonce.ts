import { randomBytes } from "crypto";
import { AuthNonce, InsertAuthNonce } from "@shared/schema";
import { storage } from "../storage";

/**
 * Generate a secure random nonce for wallet authentication
 */
export function generateNonce(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Generate a standardized verification message for wallet signature
 */
export function generateVerificationMessage(
  walletAddress: string,
  chain: string,
  nonce: string,
  timestamp: number
): string {
  const message = `Riddle.app Authentication
  
Wallet: ${walletAddress}
Chain: ${chain}
Nonce: ${nonce}
Timestamp: ${timestamp}

Please sign this message to verify ownership of your wallet.
This signature will not trigger any blockchain transaction or cost any gas fees.`;
  
  return message;
}

/**
 * Create a new authentication nonce with expiry
 */
export async function createAuthNonce(
  walletAddress: string,
  chain: string,
  walletType: string,
  sessionId?: string,
  expiryMinutes: number = 15
): Promise<AuthNonce> {
  // Clean up any existing nonces for this wallet
  await storage.deleteNoncesByWallet(walletAddress);
  
  const nonce = generateNonce();
  const timestamp = Date.now();
  const expiresAt = new Date(timestamp + expiryMinutes * 60 * 1000);
  const message = generateVerificationMessage(walletAddress, chain, nonce, timestamp);
  
  const nonceData: InsertAuthNonce = {
    nonce,
    wallet_address: walletAddress,
    chain,
    wallet_type: walletType,
    message,
    expires_at: expiresAt,
    session_id: sessionId
  };
  
  return await storage.createAuthNonce(nonceData);
}

/**
 * Verify and consume a nonce
 */
export async function verifyAndConsumeNonce(nonce: string): Promise<AuthNonce | null> {
  const authNonce = await storage.getAuthNonce(nonce);
  if (!authNonce) {
    return null;
  }
  
  // Mark nonce as used
  await storage.markNonceUsed(nonce);
  
  return authNonce;
}

/**
 * Clean up expired nonces (should be called periodically)
 */
export async function cleanupExpiredNonces(): Promise<void> {
  await storage.deleteExpiredNonces();
}