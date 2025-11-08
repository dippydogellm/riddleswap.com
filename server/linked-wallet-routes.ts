import express from 'express';
import rateLimit from 'express-rate-limit';
import { storage } from './storage';
import { insertLinkedWalletSchema } from '../shared/schema';
// import { sessionAuth } from './middleware/session-auth';
import { z } from 'zod';

const router = express.Router();
// Use the exported storage instance

// Rate limiting for verification operations
const verificationRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5, // 5 attempts per 10 minutes per IP
  message: { error: 'Too many verification attempts. Please try again later.' }
});

// Schemas for request validation
const startVerificationSchema = z.object({
  address: z.string().min(1, 'Wallet address is required'),
  chain: z.enum(['ethereum', 'solana', 'xrpl'], { 
    required_error: 'Chain must be ethereum, solana, or xrpl' 
  }),
  walletType: z.enum(['metamask', 'phantom', 'xaman', 'joey'], {
    required_error: 'Wallet type must be metamask, phantom, xaman, or joey'
  })
});

const verifyWalletSchema = z.object({
  address: z.string().min(1, 'Wallet address is required'),
  chain: z.enum(['ethereum', 'solana', 'xrpl']),
  walletType: z.enum(['metamask', 'phantom', 'xaman', 'joey']),
  signature: z.string().min(1, 'Signature is required'),
  nonce: z.string().min(1, 'Nonce is required'),
  walletLabel: z.string().optional()
});

const saveFromSessionSchema = z.object({
  address: z.string().min(1, 'Wallet address is required'),
  chain: z.enum(['ethereum', 'solana', 'xrpl']),
  walletType: z.enum(['metamask', 'phantom', 'xaman', 'joey']),
  walletLabel: z.string().optional()
});

// Get session ID for the current user
const getSessionId = (req: any): string => {
  // Try authenticated user first (this should work for all authenticated users)
  if (req.user && req.user.handle) {
    console.log(`🔍 [SESSION ID] Using authenticated user handle: ${req.user.handle}`);
    return req.user.handle;
  }
  
  // Try authorization header only for unauthenticated requests
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const sessionToken = authHeader.replace('Bearer ', '').substring(0, 20);
    console.log(`🔍 [SESSION ID] Using bearer token session: ${sessionToken}`);
    return sessionToken;
  }
  
  // Try external session header
  const externalSessionId = req.headers['x-external-session-id'];
  if (externalSessionId) {
    console.log(`🔍 [SESSION ID] Using external session ID: ${externalSessionId}`);
    return externalSessionId;
  }
  
  // Create session for anonymous users
  const anonId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`🔍 [SESSION ID] Created anonymous session: ${anonId}`);
  return anonId;
};

// GET /api/linked-wallets/by-address/:address - Get linked wallets by wallet address (public endpoint for profile pages)
router.get('/by-address/:address', async (req, res) => {
  try {
    const walletAddress = req.params.address;
    
    console.log(`🔍 [LINKED WALLETS] Looking up linked wallets for address: ${walletAddress}`);

    // First, check if this address is a Riddle wallet primary address
    const db = (storage as any).db;
    const { riddleWallets, linkedWallets } = await import('../shared/schema');
    const { eq } = await import('drizzle-orm');

    const [riddleWallet] = await db.select({
      handle: riddleWallets.handle,
      linkedWalletAddress: riddleWallets.linkedWalletAddress,
      linkedWalletChain: riddleWallets.linkedWalletChain,
    })
    .from(riddleWallets)
    .where(eq(riddleWallets.linkedWalletAddress, walletAddress))
    .limit(1);

    if (!riddleWallet) {
      // Check if this address is in the linkedWallets table
      const [linkedWallet] = await db.select({
        user_id: linkedWallets.user_id
      })
      .from(linkedWallets) 
      .where(eq(linkedWallets.address, walletAddress))
      .limit(1);

      if (!linkedWallet) {
        return res.status(404).json({ 
          success: false, 
          error: 'No Riddle wallet found for this address',
          isRiddleWallet: false
        });
      }

      // Get all linked wallets for this user_id
      const userLinkedWallets = await db.select({
        id: linkedWallets.id,
        address: linkedWallets.address,
        chain: linkedWallets.chain,
        wallet_type: linkedWallets.wallet_type,
        verified: linkedWallets.verified,
        wallet_label: linkedWallets.wallet_label,
        created_at: linkedWallets.created_at
      })
      .from(linkedWallets)
      .where(eq(linkedWallets.user_id, linkedWallet.user_id));

      return res.json({
        success: true,
        isRiddleWallet: true,
        handle: linkedWallet.user_id, // user_id acts as handle in this table
        linkedWallets: userLinkedWallets
      });
    }

    // Get all linked wallets for this Riddle wallet user
    const userLinkedWallets = await db.select({
      id: linkedWallets.id,
      address: linkedWallets.address,
      chain: linkedWallets.chain,
      wallet_type: linkedWallets.wallet_type,
      verified: linkedWallets.verified,
      wallet_label: linkedWallets.wallet_label,
      created_at: linkedWallets.created_at
    })
    .from(linkedWallets)
    .where(eq(linkedWallets.user_id, riddleWallet.handle));

    // Add the primary linked wallet if it's not already in the list
    const primaryWalletExists = userLinkedWallets.some((w: any) => 
      w.address === riddleWallet.linkedWalletAddress
    );

    const result = {
      success: true,
      isRiddleWallet: true,
      handle: riddleWallet.handle,
      primaryWallet: {
        address: riddleWallet.linkedWalletAddress,
        chain: riddleWallet.linkedWalletChain?.toLowerCase()
      },
      linkedWallets: userLinkedWallets
    };

    console.log(`📋 [LINKED WALLETS] Found ${userLinkedWallets.length} linked wallets for Riddle wallet @${riddleWallet.handle}`);
    res.json(result);

  } catch (error: any) {
    console.error('❌ [LINKED WALLETS] Lookup by address failed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to lookup linked wallets' 
    });
  }
});

// GET /api/linked-wallets - List all linked wallets for current user
router.get('/', async (req, res) => {
  try {
    const userId = getSessionId(req);
    const wallets = await storage.listLinkedWallets(userId);
    
    // Return safe subset of wallet data
    const safeWallets = wallets.map(wallet => ({
      id: wallet.id,
      address: wallet.address,
      chain: wallet.chain,
      wallet_type: wallet.wallet_type,
      verified: wallet.verified,
      wallet_label: wallet.wallet_label,
      source: wallet.source,
      created_at: wallet.created_at,
      verified_at: wallet.verified_at,
      last_activity: wallet.last_activity
    }));
    
    console.log(`📋 [LINKED WALLETS] Found ${wallets.length} linked wallets for ${userId}`);
    res.json(safeWallets);
    
  } catch (error: any) {
    console.error('❌ [LINKED WALLETS] List failed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to load linked wallets' 
    });
  }
});

// POST /api/linked-wallets/start - Start wallet verification process
router.post('/start', verificationRateLimit, async (req, res) => {
  try {
    const { address, chain, walletType } = startVerificationSchema.parse(req.body);
    const userId = getSessionId(req);
    
    // Check if wallet is already linked
    const existing = await storage.getLinkedWalletByAddress(address, chain, userId);
    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'Wallet is already linked to your account'
      });
    }
    
    // Start verification process
    const verification = await storage.startLinkedWalletVerification({
      userId,
      address,
      chain,
      walletType
    });
    
    console.log(`🔐 [LINKED WALLETS] Started verification for ${userId}: ${chain}:${address.slice(0, 8)}...`);
    
    res.json({
      success: true,
      nonce: verification.nonce,
      message: verification.message,
      expiresAt: verification.expiresAt
    });
    
  } catch (error: any) {
    console.error('❌ [LINKED WALLETS] Start verification failed:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Failed to start wallet verification' 
    });
  }
});

// POST /api/linked-wallets/verify - Verify wallet ownership and save
router.post('/verify', verificationRateLimit, async (req, res) => {
  try {
    const { address, chain, walletType, signature, nonce, walletLabel } = verifyWalletSchema.parse(req.body);
    const userId = getSessionId(req);
    
    // Verify and save linked wallet
    const linkedWallet = await storage.verifyAndSaveLinkedWallet({
      userId,
      address,
      chain,
      walletType,
      signature,
      nonce,
      walletLabel,
      source: 'manual'
    });
    
    console.log(`✅ [LINKED WALLETS] Verified and saved wallet for ${userId}: ${chain}:${address.slice(0, 8)}...`);
    
    res.json({
      success: true,
      message: 'Wallet successfully linked',
      wallet: {
        id: linkedWallet.id,
        address: linkedWallet.address,
        chain: linkedWallet.chain,
        wallet_type: linkedWallet.wallet_type,
        wallet_label: linkedWallet.wallet_label,
        verified: linkedWallet.verified,
        verified_at: linkedWallet.verified_at
      }
    });
    
  } catch (error: any) {
    console.error('❌ [LINKED WALLETS] Verify failed:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      });
    }
    
    if (error.message.includes('Invalid or expired')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired verification. Please request a new verification.'
      });
    }
    
    if (error.message.includes('already linked')) {
      return res.status(400).json({
        success: false,
        error: 'Wallet is already linked to your account'
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Failed to verify wallet ownership' 
    });
  }
});

// POST /api/linked-wallets/save-from-session - Link wallet from active session
router.post('/save-from-session', async (req, res) => {
  try {
    const { address, chain, walletType, walletLabel } = saveFromSessionSchema.parse(req.body);
    const userId = getSessionId(req);
    
    // Save from active session (pre-verified)
    const linkedWallet = await storage.saveFromActiveSession({
      userId,
      address,
      chain,
      walletType,
      walletLabel
    });
    
    console.log(`💾 [LINKED WALLETS] Saved from session for ${userId}: ${chain}:${address.slice(0, 8)}...`);
    
    res.json({
      success: true,
      message: 'Wallet linked from active session',
      wallet: {
        id: linkedWallet.id,
        address: linkedWallet.address,
        chain: linkedWallet.chain,
        wallet_type: linkedWallet.wallet_type,
        wallet_label: linkedWallet.wallet_label,
        verified: linkedWallet.verified,
        source: linkedWallet.source
      }
    });
    
  } catch (error: any) {
    console.error('❌ [LINKED WALLETS] Save from session failed:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      });
    }
    
    if (error.message.includes('already linked')) {
      return res.status(400).json({
        success: false,
        error: 'Wallet is already linked to your account'
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Failed to link wallet from session' 
    });
  }
});

// DELETE /api/linked-wallets/:id - Remove linked wallet
router.delete('/:id', async (req, res) => {
  try {
    const walletId = req.params.id;
    const userId = getSessionId(req);
    
    if (!walletId) {
      return res.status(400).json({
        success: false,
        error: 'Wallet ID is required'
      });
    }
    
    // Verify wallet belongs to user before deletion
    const wallet = await storage.getLinkedWallet(walletId);
    if (!wallet) {
      return res.status(404).json({
        success: false,
        error: 'Linked wallet not found'
      });
    }
    
    if (wallet.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'You can only remove your own linked wallets'
      });
    }
    
    await storage.deleteLinkedWallet(walletId, userId);
    
    console.log(`🗑️ [LINKED WALLETS] Removed wallet ${walletId} for ${userId}`);
    
    res.json({
      success: true,
      message: 'Linked wallet removed successfully'
    });
    
  } catch (error: any) {
    console.error('❌ [LINKED WALLETS] Delete failed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to remove linked wallet' 
    });
  }
});

// GET /api/linked-wallets/list - Alias for root endpoint to match API expectations
router.get('/list', async (req, res) => {
  try {
    const userId = getSessionId(req);
    console.log(`📋 [LINKED WALLETS] Getting linked wallets for user: ${userId}`);
    
    const wallets = await storage.listLinkedWallets(userId);
    
    res.json({
      success: true,
      wallets: wallets || []
    });
    
  } catch (error: any) {
    console.error('❌ [LINKED WALLETS] List failed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get linked wallets' 
    });
  }
});

export default router;