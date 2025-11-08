import express from 'express';
import { db } from './db';
import { externalWallets } from '../shared/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const router = express.Router();

// Simple schema for wallet saving - no complex verification
const saveWalletSchema = z.object({
  address: z.string().min(1),
  walletType: z.string().min(1), 
  chain: z.string().min(1)
});

// Get session ID (for both authenticated and external users)
const getSessionId = (req: any): string => {
  // Try authenticated user first
  if (req.user && req.user.handle) {
    return req.user.handle;
  }
  
  // Try authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.replace('Bearer ', '').substring(0, 20);
  }
  
  // Try external session header
  const externalSessionId = req.headers['x-external-session-id'];
  if (externalSessionId) {
    return externalSessionId;
  }
  
  // Create session for anonymous users
  return `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Simple save wallet endpoint
router.post('/simple-save', async (req, res) => {
  try {
    const { address, walletType, chain } = saveWalletSchema.parse(req.body);
    const sessionId = getSessionId(req);
    
    // Check if wallet already exists for this user
    const existing = await db.select().from(externalWallets)
      .where(and(
        eq(externalWallets.user_id, sessionId),
        eq(externalWallets.address, address)
      ))
      .limit(1);
    
    if (existing.length > 0) {
      return res.json({ 
        success: true, 
        message: 'Wallet already linked',
        wallet: existing[0] 
      });
    }
    
    // Save new wallet
    const newWallet = await db.insert(externalWallets).values({
      user_id: sessionId,
      wallet_type: walletType,
      address: address,
      chain: chain,
      verified: true, // Auto-verify for simplicity
      connected_at: new Date(),
      last_used: new Date()
    } as any).returning();
    
    console.log(`✅ [SIMPLE WALLET] Saved ${walletType} wallet for ${sessionId}: ${address.slice(0, 8)}...`);
    
    res.json({ 
      success: true, 
      message: 'Wallet linked successfully',
      wallet: newWallet[0] 
    });
    
  } catch (error) {
    console.error('❌ [SIMPLE WALLET] Save failed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to save wallet' 
    });
  }
});

// Simple list wallets endpoint
router.get('/simple-list', async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    
    const wallets = await db.select({
      id: externalWallets.id,
      wallet_type: externalWallets.wallet_type,
      address: externalWallets.address,
      chain: externalWallets.chain,
      connected_at: externalWallets.connected_at
    }).from(externalWallets)
      .where(eq(externalWallets.user_id, sessionId))
      .orderBy(externalWallets.connected_at);
    
    console.log(`📝 [SIMPLE WALLET] Found ${wallets.length} wallets for ${sessionId}`);
    
    res.json(wallets);
    
  } catch (error) {
    console.error('❌ [SIMPLE WALLET] List failed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to load wallets' 
    });
  }
});

// Simple remove wallet endpoint
router.delete('/simple-remove/:walletId', async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    const walletId = parseInt(req.params.walletId);
    
    if (isNaN(walletId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid wallet ID' 
      });
    }
    
    const result = await db.delete(externalWallets)
      .where(and(
        eq(externalWallets.id, walletId),
        eq(externalWallets.user_id, sessionId)
      ))
      .returning();
    
    if (result.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Wallet not found' 
      });
    }
    
    console.log(`🗑️ [SIMPLE WALLET] Removed wallet for ${sessionId}: ${result[0].address.slice(0, 8)}...`);
    
    res.json({ 
      success: true, 
      message: 'Wallet removed successfully',
      wallet: result[0] 
    });
    
  } catch (error) {
    console.error('❌ [SIMPLE WALLET] Remove failed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to remove wallet' 
    });
  }
});

// Connect endpoint for wallet-connection-dashboard.tsx
router.post('/connect', async (req, res) => {
  try {
    const { address, walletType, chain } = saveWalletSchema.parse(req.body);
    const sessionId = getSessionId(req);
    
    console.log(`💾 Saving to database: ${walletType} on ${chain} with address ${address}`);
    
    // Check if wallet already exists for this user
    const existing = await db.select().from(externalWallets)
      .where(and(
        eq(externalWallets.user_id, sessionId),
        eq(externalWallets.address, address)
      ))
      .limit(1);
    
    if (existing.length > 0) {
      console.log(`✅ Wallet already exists: ${address.slice(0, 8)}...`);
      return res.json({ 
        success: true, 
        message: 'Wallet already linked',
        wallet: existing[0] 
      });
    }
    
    // Save new wallet
    const newWallet = await db.insert(externalWallets).values({
      user_id: sessionId,
      wallet_type: walletType,
      address: address,
      chain: chain,
      verified: true, // Auto-verify for simplicity
      connected_at: new Date(),
      last_used: new Date()
    } as any).returning();
    
    console.log(`✅ Connected ${walletType} to ${chain}: ${address}`);
    
    res.json({ 
      success: true, 
      message: 'Wallet linked successfully',
      wallet: newWallet[0] 
    });
    
  } catch (error) {
    console.error('❌ Failed to save to database:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to save wallet' 
    });
  }
});

// List endpoint for wallet-connection-dashboard.tsx
router.get('/list', async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    
    const wallets = await db.select({
      id: externalWallets.id,
      wallet_type: externalWallets.wallet_type,
      address: externalWallets.address,
      chain: externalWallets.chain,
      verified: externalWallets.verified,
      connected_at: externalWallets.connected_at,
      last_used: externalWallets.last_used
    }).from(externalWallets)
      .where(eq(externalWallets.user_id, sessionId))
      .orderBy(externalWallets.connected_at);
    
    console.log(`📝 [EXTERNAL WALLETS] Found ${wallets.length} wallets for user ${sessionId}`);
    
    res.json({ wallets });
    
  } catch (error) {
    console.error('❌ [EXTERNAL WALLETS] List failed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to load wallets' 
    });
  }
});

// Delete endpoint for wallet-connection-dashboard.tsx
router.delete('/:walletId', async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    const walletId = parseInt(req.params.walletId);
    
    if (isNaN(walletId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid wallet ID' 
      });
    }
    
    const result = await db.delete(externalWallets)
      .where(and(
        eq(externalWallets.id, walletId),
        eq(externalWallets.user_id, sessionId)
      ))
      .returning();
    
    if (result.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Wallet not found' 
      });
    }
    
    console.log(`🗑️ [EXTERNAL WALLETS] Removed wallet for ${sessionId}: ${result[0].address.slice(0, 8)}...`);
    
    res.json({ 
      success: true, 
      message: 'Wallet removed successfully',
      wallet: result[0] 
    });
    
  } catch (error) {
    console.error('❌ [EXTERNAL WALLETS] Remove failed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to remove wallet' 
    });
  }
});

export default router;