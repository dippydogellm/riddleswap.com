/**
 * ADMIN BROKER MONITORING ROUTES
 * Comprehensive dashboard for monitoring all broker escrows and trades
 */

import { Router, Response } from 'express';
import { db } from './db';
import { brokerMintEscrow, brokerEscrow } from '../shared/schema';
import { eq, desc, and, or, like, sql } from 'drizzle-orm';

const router = Router();
const BROKER_ADDRESS = process.env.RIDDLE_BROKER_ADDRESS || process.env.BROKER_WALLET_ADDRESS || 'rGLzXKif4ksBZe2MY6RZT9m69hdgzsXG4X';

// Admin authentication middleware
const requireAdmin = (req: any, res: Response, next: Function) => {
  const adminHandles = ['dippydoge']; // Admin user handles
  
  if (!req.user || !adminHandles.includes(req.user.handle)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

/**
 * Get all mint escrows with filtering and pagination
 * GET /api/admin/broker/mint-escrows
 */
router.get('/mint-escrows', requireAdmin, async (req: any, res: Response) => {
  try {
    const { 
      status, 
      platformType,
      userHandle,
      page = 1, 
      limit = 50,
      search 
    } = req.query;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Build where conditions
    const conditions: any[] = [];
    
    if (status) {
      conditions.push(eq(brokerMintEscrow.status, status));
    }
    
    if (platformType) {
      conditions.push(eq(brokerMintEscrow.platformType, platformType));
    }
    
    if (userHandle) {
      conditions.push(eq(brokerMintEscrow.buyerHandle, userHandle));
    }
    
    if (search) {
      conditions.push(
        or(
          like(brokerMintEscrow.id, `%${search}%`),
          like(brokerMintEscrow.buyerAddress, `%${search}%`),
          like(brokerMintEscrow.mintedNftId, `%${search}%`),
          like(brokerMintEscrow.paymentTxHash, `%${search}%`)
        )
      );
    }
    
    // Get escrows
    const escrows = await db
      .select()
      .from(brokerMintEscrow)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(brokerMintEscrow.createdAt))
      .limit(parseInt(limit))
      .offset(offset);
    
    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(brokerMintEscrow)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    
    res.json({
      success: true,
      escrows: escrows.map(e => ({
        ...e,
        // Don't expose private keys even to admin
        issuerPrivateKey: e.issuerPrivateKey ? '[ENCRYPTED]' : null
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / parseInt(limit))
      }
    });
    
  } catch (error) {
    console.error('❌ [ADMIN] Error fetching mint escrows:', error);
    res.status(500).json({ error: 'Failed to fetch mint escrows' });
  }
});

/**
 * Get all buy/sell escrows with filtering and pagination
 * GET /api/admin/broker/escrows
 */
router.get('/escrows', requireAdmin, async (req: any, res: Response) => {
  try {
    const { 
      status,
      page = 1, 
      limit = 50,
      search 
    } = req.query;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Build where conditions
    const conditions: any[] = [];
    
    if (status) {
      conditions.push(eq(brokerEscrow.status, status));
    }
    
    if (search) {
      conditions.push(
        or(
          like(brokerEscrow.id, `%${search}%`),
          like(brokerEscrow.nftTokenId, `%${search}%`),
          like(brokerEscrow.userAddress, `%${search}%`),
          like(brokerEscrow.nftOwner, `%${search}%`)
        )
      );
    }
    
    // Get escrows
    const escrows = await db
      .select()
      .from(brokerEscrow)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(brokerEscrow.createdAt))
      .limit(parseInt(limit))
      .offset(offset);
    
    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(brokerEscrow)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    
    res.json({
      success: true,
      escrows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / parseInt(limit))
      }
    });
    
  } catch (error) {
    console.error('❌ [ADMIN] Error fetching escrows:', error);
    res.status(500).json({ error: 'Failed to fetch escrows' });
  }
});

/**
 * Get mint escrow statistics
 * GET /api/admin/broker/mint-stats
 */
router.get('/mint-stats', requireAdmin, async (req: any, res: Response) => {
  try {
    // Status distribution
    const statusStats = await db
      .select({
        status: brokerMintEscrow.status,
        count: sql<number>`count(*)`,
        totalAmount: sql<string>`sum(CAST(${brokerMintEscrow.totalAmount} AS BIGINT))`
      })
      .from(brokerMintEscrow)
      .groupBy(brokerMintEscrow.status);
    
    // Platform type distribution
    const platformStats = await db
      .select({
        platformType: brokerMintEscrow.platformType,
        count: sql<number>`count(*)`,
        totalAmount: sql<string>`sum(CAST(${brokerMintEscrow.totalAmount} AS BIGINT))`
      })
      .from(brokerMintEscrow)
      .groupBy(brokerMintEscrow.platformType);
    
    // Total fees collected
    const [feeStats] = await db
      .select({
        totalFees: sql<string>`sum(CAST(${brokerMintEscrow.brokerFee} AS BIGINT))`,
        count: sql<number>`count(*)`
      })
      .from(brokerMintEscrow)
      .where(eq(brokerMintEscrow.status, 'distributed'));
    
    // Recent activity (last 24 hours)
    const [recentActivity] = await db
      .select({
        count: sql<number>`count(*)`
      })
      .from(brokerMintEscrow)
      .where(sql`${brokerMintEscrow.createdAt} > NOW() - INTERVAL '24 hours'`);
    
    res.json({
      success: true,
      stats: {
        byStatus: statusStats.map(s => ({
          status: s.status,
          count: s.count,
          totalXRP: s.totalAmount ? (BigInt(s.totalAmount) / BigInt(1_000_000)).toString() : '0'
        })),
        byPlatform: platformStats.map(p => ({
          platform: p.platformType,
          count: p.count,
          totalXRP: p.totalAmount ? (BigInt(p.totalAmount) / BigInt(1_000_000)).toString() : '0'
        })),
        totalFeesCollected: feeStats.totalFees ? (BigInt(feeStats.totalFees) / BigInt(1_000_000)).toString() + ' XRP' : '0 XRP',
        totalDistributed: feeStats.count || 0,
        last24Hours: recentActivity.count || 0
      }
    });
    
  } catch (error) {
    console.error('❌ [ADMIN] Error fetching mint stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

/**
 * Get single mint escrow details
 * GET /api/admin/broker/mint-escrows/:id
 */
router.get('/mint-escrows/:id', requireAdmin, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    
    const [escrow] = await db
      .select()
      .from(brokerMintEscrow)
      .where(eq(brokerMintEscrow.id, id));
    
    if (!escrow) {
      return res.status(404).json({ error: 'Escrow not found' });
    }
    
    res.json({
      success: true,
      escrow: {
        ...escrow,
        // Don't expose private keys even to admin
        issuerPrivateKey: escrow.issuerPrivateKey ? '[ENCRYPTED]' : null
      }
    });
    
  } catch (error) {
    console.error('❌ [ADMIN] Error fetching escrow:', error);
    res.status(500).json({ error: 'Failed to fetch escrow details' });
  }
});

/**
 * Get broker wallet information
 * GET /api/admin/broker/wallet-info
 */
router.get('/wallet-info', requireAdmin, async (req: any, res: Response) => {
  try {
    const { Client } = await import('xrpl');
    
    const client = new Client(process.env.XRPL_RPC_URL || 'wss://s1.ripple.com');
    await client.connect();
    
    const accountInfo = await client.request({
      command: 'account_info',
      account: BROKER_ADDRESS,
      ledger_index: 'validated'
    });
    
    const balance = Number(accountInfo.result.account_data.Balance) / 1_000_000;
    
    await client.disconnect();
    
    res.json({
      success: true,
      wallet: {
        address: BROKER_ADDRESS,
        balance: balance.toFixed(6) + ' XRP',
        sequence: accountInfo.result.account_data.Sequence,
        domain: accountInfo.result.account_data.Domain || null
      }
    });
    
  } catch (error) {
    console.error('❌ [ADMIN] Error fetching wallet info:', error);
    res.status(500).json({ error: 'Failed to fetch wallet information' });
  }
});

/**
 * Get recent transactions on broker wallet
 * GET /api/admin/broker/transactions
 */
router.get('/transactions', requireAdmin, async (req: any, res: Response) => {
  try {
    const { limit = 20 } = req.query;
    const { Client } = await import('xrpl');
    
    const client = new Client(process.env.XRPL_RPC_URL || 'wss://s1.ripple.com');
    await client.connect();
    
    const txHistory = await client.request({
      command: 'account_tx',
      account: BROKER_ADDRESS,
      limit: parseInt(limit as string)
    });
    
    await client.disconnect();
    
    const transactions = txHistory.result.transactions.map((tx: any) => ({
      hash: tx.tx?.hash,
      type: tx.tx?.TransactionType,
      date: tx.tx?.date ? new Date((tx.tx.date + 946684800) * 1000).toISOString() : null,
      amount: tx.tx?.Amount ? (typeof tx.tx.Amount === 'string' ? (Number(tx.tx.Amount) / 1_000_000) + ' XRP' : tx.tx.Amount) : null,
      destination: tx.tx?.Destination,
      account: tx.tx?.Account,
      validated: tx.validated
    }));
    
    res.json({
      success: true,
      transactions
    });
    
  } catch (error) {
    console.error('❌ [ADMIN] Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

/**
 * Get system health status
 * GET /api/admin/broker/health
 */
router.get('/health', requireAdmin, async (req: any, res: Response) => {
  try {
    const hasSessionSecret = !!process.env.SESSION_SECRET;
    const hasBrokerSeed = !!process.env.BROKER_WALLET_SEED;
    const hasBrokerAddress = !!process.env.RIDDLE_BROKER_ADDRESS;
    
    // Check database connectivity
    const dbCheck = await db.execute(sql`SELECT 1 as alive`);
    
    // Count pending escrows
    const [{ pendingMints }] = await db
      .select({ pendingMints: sql<number>`count(*)` })
      .from(brokerMintEscrow)
      .where(eq(brokerMintEscrow.status, 'awaiting_payment'));
    
    res.json({
      success: true,
      health: {
        status: 'operational',
        database: dbCheck ? 'connected' : 'disconnected',
        secrets: {
          sessionSecret: hasSessionSecret,
          brokerSeed: hasBrokerSeed,
          brokerAddress: hasBrokerAddress
        },
        brokerAddress: BROKER_ADDRESS,
        pendingEscrows: pendingMints || 0,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ [ADMIN] Error checking health:', error);
    res.status(500).json({ 
      success: false,
      health: {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

export default router;
