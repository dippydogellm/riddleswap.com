/**
 * Project Owner Authentication Routes
 * Handles secure login, session management, and authentication for claimed projects
 */

import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import { 
  InsertProjectOwnerAuth, 
  InsertProjectOwnerSession, 
  InsertProjectLoginLog,
  ProjectOwnerAuth,
  ProjectOwnerSession 
} from "@shared/schema";
import { createAuthNonce, verifyAndConsumeNonce } from "./utils/auth-nonce";
import { verifySignature, validateWalletAddress } from "./utils/signature-verification";

const router = Router();

// Project sessions storage - SERVER SIDE ONLY
const projectSessions = new Map<string, {
  sessionToken: string;
  projectId: string;
  authId: string;
  walletAddress: string;
  expiresAt: number;
  lastActivity: number;
  loginMethod: string;
}>();

// Security constants
const SALT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 30;
const DEFAULT_SESSION_TIMEOUT_MINUTES = 120;
const MAX_SESSIONS_PER_PROJECT = 3;

// Generate secure session token
function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Hash password with salt
async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  const hash = await bcrypt.hash(password, salt);
  return { hash, salt };
}

// Verify password
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Clean up expired sessions every 10 minutes
setInterval(() => {
  const now = Date.now();
  const entries = Array.from(projectSessions.entries());
  for (const [token, session] of entries) {
    if (now > session.expiresAt) {
      console.log('🧹 Auto-cleaning expired project session');
      projectSessions.delete(token);
    }
  }
}, 10 * 60 * 1000);

// Validation schemas
const registerProjectAuthSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  authType: z.enum(["password", "wallet_signature", "hybrid"]).default("hybrid"),
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
  walletSignatureRequired: z.boolean().default(true),
  allowedWalletAddresses: z.array(z.string()).default([]),
  sessionTimeoutMinutes: z.number().min(15).max(480).default(120),
  maxConcurrentSessions: z.number().min(1).max(10).default(3),
});

const loginSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  loginMethod: z.enum(["password", "wallet_signature", "hybrid"]),
  password: z.string().optional(),
  walletAddress: z.string().optional(),
  signature: z.string().optional(),
  nonce: z.string().optional(),
  chain: z.string().optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

const logoutSchema = z.object({
  sessionToken: z.string().min(1, "Session token is required"),
  projectId: z.string().min(1, "Project ID is required"),
});

const verifySessionSchema = z.object({
  sessionToken: z.string().min(1, "Session token is required"),
  projectId: z.string().min(1, "Project ID is required"),
});

// Helper: Log authentication attempt
async function logAuthAttempt(
  projectId: string,
  authId: string | null,
  walletAddress: string,
  loginMethod: string,
  result: string,
  failureReason?: string,
  sessionId?: string,
  ipAddress?: string,
  userAgent?: string
) {
  try {
    const logData: InsertProjectLoginLog = {
      project_id: projectId,
      auth_id: authId,
      wallet_address: walletAddress,
      login_method: loginMethod,
      attempt_result: result,
      failure_reason: failureReason,
      session_id: sessionId,
      ip_address: ipAddress,
      user_agent: userAgent,
    };
    await storage.createProjectLoginLog(logData);
  } catch (error) {
    console.error("Failed to log authentication attempt:", error);
  }
}

// Helper: Check if project auth is locked out
function isLockedOut(auth: ProjectOwnerAuth): boolean {
  if (!auth.lockout_until) return false;
  return new Date() < auth.lockout_until;
}

// Helper: Update failed login attempts
async function handleFailedLogin(authId: string, projectId: string, walletAddress: string) {
  try {
    const auth = await storage.getProjectOwnerAuth(authId);
    if (!auth) return;

    const failedAttempts = (auth.failed_login_attempts || 0) + 1;
    const shouldLockout = failedAttempts >= MAX_FAILED_ATTEMPTS;
    
    const updateData = {
      failed_login_attempts: failedAttempts,
      lockout_until: shouldLockout 
        ? new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000)
        : undefined,
    };

    await storage.updateProjectOwnerAuth(authId, updateData);
    
    if (shouldLockout) {
      console.log(`🔒 Project ${projectId} locked out due to failed attempts`);
    }
  } catch (error) {
    console.error("Failed to handle failed login:", error);
  }
}

// Helper: Clear failed login attempts on successful login
async function clearFailedAttempts(authId: string) {
  try {
    await storage.updateProjectOwnerAuth(authId, {
      failed_login_attempts: 0,
      lockout_until: null,
      last_login_at: new Date(),
    });
  } catch (error) {
    console.error("Failed to clear failed attempts:", error);
  }
}

/**
 * POST /api/projects/auth/register
 * Register authentication settings for a project
 */
router.post("/register", async (req, res) => {
  try {
    const body = registerProjectAuthSchema.parse(req.body);
    const { projectId, authType, password, ...authSettings } = body;

    // Verify project exists and user has permission
    const project = await storage.getDevtoolsProject(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Check if auth already exists
    const existingAuth = await storage.getProjectOwnerAuthByProject(projectId);
    if (existingAuth) {
      return res.status(400).json({ error: "Project authentication already configured" });
    }

    // Hash password if provided
    let passwordHash: string | undefined;
    let salt: string | undefined;
    
    if (password && (authType === "password" || authType === "hybrid")) {
      const hashedData = await hashPassword(password);
      passwordHash = hashedData.hash;
      salt = hashedData.salt;
    }

    // Create authentication record
    const authData: InsertProjectOwnerAuth = {
      project_id: projectId,
      owner_wallet_address: project.ownerWalletAddress,
      auth_type: authType,
      password_hash: passwordHash,
      salt: salt,
      wallet_signature_required: authSettings.walletSignatureRequired,
      allowed_wallet_addresses: authSettings.allowedWalletAddresses,
      session_timeout_minutes: authSettings.sessionTimeoutMinutes,
      max_concurrent_sessions: authSettings.maxConcurrentSessions,
    };

    const createdAuth = await storage.createProjectOwnerAuth(authData);

    res.json({
      success: true,
      authId: createdAuth.id,
      message: "Project authentication configured successfully"
    });

  } catch (error) {
    console.error("Project auth registration error:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid request data",
        details: error.errors
      });
    }

    res.status(500).json({ error: "Failed to register project authentication" });
  }
});

/**
 * POST /api/projects/auth/login
 * Authenticate and create session for project access
 */
router.post("/login", async (req, res) => {
  try {
    const body = loginSchema.parse(req.body);
    const { projectId, loginMethod, password, walletAddress, signature, nonce, chain, ipAddress, userAgent } = body;

    // Get project and auth configuration
    const project = await storage.getDevtoolsProject(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const auth = await storage.getProjectOwnerAuthByProject(projectId);
    if (!auth) {
      return res.status(400).json({ error: "Project authentication not configured" });
    }

    // Check if account is locked
    if (isLockedOut(auth)) {
      await logAuthAttempt(
        projectId, 
        auth.id, 
        walletAddress || auth.owner_wallet_address, 
        loginMethod, 
        "locked_out",
        "Account is temporarily locked",
        undefined,
        ipAddress,
        userAgent
      );
      return res.status(423).json({
        error: "Account is temporarily locked due to too many failed attempts",
        lockedUntil: auth.lockout_until?.toISOString()
      });
    }

    let authSuccess = false;
    let authWalletAddress = walletAddress || auth.owner_wallet_address;

    // Authenticate based on method
    if (loginMethod === "password" || (loginMethod === "hybrid" && password)) {
      if (!password || !auth.password_hash) {
        await handleFailedLogin(auth.id, projectId, authWalletAddress);
        await logAuthAttempt(projectId, auth.id, authWalletAddress, loginMethod, "failed_password", "Password required but not provided", undefined, ipAddress, userAgent);
        return res.status(401).json({ error: "Password is required" });
      }

      authSuccess = await verifyPassword(password, auth.password_hash);
      if (!authSuccess) {
        await handleFailedLogin(auth.id, projectId, authWalletAddress);
        await logAuthAttempt(projectId, auth.id, authWalletAddress, loginMethod, "failed_password", "Invalid password", undefined, ipAddress, userAgent);
        return res.status(401).json({ error: "Invalid password" });
      }
    }

    if (loginMethod === "wallet_signature" || (loginMethod === "hybrid" && auth.wallet_signature_required)) {
      if (!walletAddress || !signature || !nonce || !chain) {
        await handleFailedLogin(auth.id, projectId, authWalletAddress);
        await logAuthAttempt(projectId, auth.id, authWalletAddress, loginMethod, "failed_signature", "Wallet signature data incomplete", undefined, ipAddress, userAgent);
        return res.status(400).json({ error: "Wallet signature data required" });
      }

      // Verify wallet is allowed
      const allowedWallets = [auth.owner_wallet_address, ...auth.allowed_wallet_addresses];
      if (!allowedWallets.includes(walletAddress)) {
        await handleFailedLogin(auth.id, projectId, authWalletAddress);
        await logAuthAttempt(projectId, auth.id, authWalletAddress, loginMethod, "invalid_wallet", "Wallet not authorized", undefined, ipAddress, userAgent);
        return res.status(403).json({ error: "Wallet not authorized for this project" });
      }

      // Verify signature
      const authNonce = await verifyAndConsumeNonce(nonce);
      if (!authNonce) {
        await handleFailedLogin(auth.id, projectId, authWalletAddress);
        await logAuthAttempt(projectId, auth.id, authWalletAddress, loginMethod, "failed_signature", "Invalid or expired nonce", undefined, ipAddress, userAgent);
        return res.status(400).json({ error: "Invalid or expired nonce" });
      }

      const verificationResult = verifySignature(authNonce.message, signature, walletAddress, chain);
      if (!verificationResult.isValid) {
        await handleFailedLogin(auth.id, projectId, authWalletAddress);
        await logAuthAttempt(projectId, auth.id, authWalletAddress, loginMethod, "failed_signature", "Signature verification failed", undefined, ipAddress, userAgent);
        return res.status(401).json({ error: "Invalid signature" });
      }

      authSuccess = true;
      authWalletAddress = walletAddress;
    }

    if (!authSuccess) {
      await handleFailedLogin(auth.id, projectId, authWalletAddress);
      await logAuthAttempt(projectId, auth.id, authWalletAddress, loginMethod, "failed_password", "Authentication failed", undefined, ipAddress, userAgent);
      return res.status(401).json({ error: "Authentication failed" });
    }

    // Check session limits and cleanup old sessions
    const existingSessions = await storage.getProjectOwnerActiveSessionsByAuth(auth.id);
    if (existingSessions.length >= auth.max_concurrent_sessions) {
      // Remove oldest session
      const oldestSession = existingSessions.sort((a, b) => 
        new Date(a.last_activity_at).getTime() - new Date(b.last_activity_at).getTime()
      )[0];
      
      await storage.terminateProjectOwnerSession(oldestSession.id, "forced", "Session limit exceeded");
      projectSessions.delete(oldestSession.session_token);
    }

    // Create new session
    const sessionToken = generateSecureToken();
    const expiresAt = new Date(Date.now() + auth.session_timeout_minutes * 60 * 1000);

    const sessionData: InsertProjectOwnerSession = {
      project_id: projectId,
      auth_id: auth.id,
      session_token: sessionToken,
      wallet_address: authWalletAddress,
      ip_address: ipAddress,
      user_agent: userAgent,
      login_method: loginMethod,
      expires_at: expiresAt,
    };

    const session = await storage.createProjectOwnerSession(sessionData);

    // Store in memory cache
    projectSessions.set(sessionToken, {
      sessionToken,
      projectId,
      authId: auth.id,
      walletAddress: authWalletAddress,
      expiresAt: expiresAt.getTime(),
      lastActivity: Date.now(),
      loginMethod,
    });

    // Clear failed login attempts
    await clearFailedAttempts(auth.id);

    // Log successful login
    await logAuthAttempt(projectId, auth.id, authWalletAddress, loginMethod, "success", undefined, session.id, ipAddress, userAgent);

    res.json({
      success: true,
      sessionToken,
      projectId,
      walletAddress: authWalletAddress,
      expiresAt: expiresAt.toISOString(),
      sessionTimeoutMinutes: auth.session_timeout_minutes,
      message: "Login successful"
    });

  } catch (error) {
    console.error("Project login error:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid request data",
        details: error.errors
      });
    }

    res.status(500).json({ error: "Failed to process login" });
  }
});

/**
 * POST /api/projects/auth/logout
 * Terminate a project session
 */
router.post("/logout", async (req, res) => {
  try {
    const body = logoutSchema.parse(req.body);
    const { sessionToken, projectId } = body;

    // Remove from memory cache
    const memorySession = projectSessions.get(sessionToken);
    if (memorySession && memorySession.projectId === projectId) {
      projectSessions.delete(sessionToken);
    }

    // Update database
    await storage.terminateProjectOwnerSessionByToken(sessionToken, "logout", "User logout");

    res.json({
      success: true,
      message: "Logout successful"
    });

  } catch (error) {
    console.error("Project logout error:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid request data",
        details: error.errors
      });
    }

    res.status(500).json({ error: "Failed to process logout" });
  }
});

/**
 * POST /api/projects/auth/verify
 * Verify and refresh a project session
 */
router.post("/verify", async (req, res) => {
  try {
    const body = verifySessionSchema.parse(req.body);
    const { sessionToken, projectId } = body;

    // Check memory cache first
    const memorySession = projectSessions.get(sessionToken);
    if (!memorySession || memorySession.projectId !== projectId) {
      return res.status(401).json({ error: "Invalid session" });
    }

    // Check if session is expired
    const now = Date.now();
    if (now > memorySession.expiresAt) {
      projectSessions.delete(sessionToken);
      await storage.terminateProjectOwnerSessionByToken(sessionToken, "timeout", "Session expired");
      return res.status(401).json({ error: "Session expired" });
    }

    // Update last activity
    memorySession.lastActivity = now;
    await storage.updateProjectOwnerSessionActivity(sessionToken);

    // Get full session data
    const session = await storage.getProjectOwnerSessionByToken(sessionToken);
    if (!session || !session.is_active) {
      projectSessions.delete(sessionToken);
      return res.status(401).json({ error: "Session is no longer active" });
    }

    res.json({
      success: true,
      projectId: session.project_id,
      walletAddress: session.wallet_address,
      expiresAt: session.expires_at.toISOString(),
      lastActivity: session.last_activity_at.toISOString(),
      loginMethod: session.login_method,
      valid: true
    });

  } catch (error) {
    console.error("Project session verify error:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid request data",
        details: error.errors
      });
    }

    res.status(500).json({ error: "Failed to verify session" });
  }
});

/**
 * GET /api/projects/auth/sessions/:projectId
 * Get active sessions for a project (admin only)
 */
router.get("/sessions/:projectId", async (req, res) => {
  try {
    const { projectId } = req.params;

    // Verify project exists
    const project = await storage.getDevtoolsProject(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const sessions = await storage.getProjectOwnerActiveSessionsByProject(projectId);

    res.json({
      success: true,
      sessions: sessions.map(session => ({
        id: session.id,
        walletAddress: session.wallet_address,
        loginMethod: session.login_method,
        createdAt: session.created_at,
        lastActivity: session.last_activity_at,
        ipAddress: session.ip_address,
        userAgent: session.user_agent
      }))
    });

  } catch (error) {
    console.error("Get project sessions error:", error);
    res.status(500).json({ error: "Failed to retrieve sessions" });
  }
});

// Export the session validator for middleware use
export function getProjectSession(sessionToken: string): { projectId: string; walletAddress: string; authId: string } | null {
  const session = projectSessions.get(sessionToken);
  if (!session) return null;

  if (Date.now() > session.expiresAt) {
    projectSessions.delete(sessionToken);
    return null;
  }

  return {
    projectId: session.projectId,
    walletAddress: session.walletAddress,
    authId: session.authId
  };
}

export default router;