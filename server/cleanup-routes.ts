// Cleanup Routes - Delete unused wallets, sessions, and temporary data
import { Router } from 'express';
import { db } from './db';
import { eq, lt, isNull, and, sql } from 'drizzle-orm';
import { riddleWallets, riddleWalletSessions, swapHistory, importedWallets } from '../shared/schema';

const router = Router();

// Delete expired sessions
router.delete('/sessions/expired', async (req, res) => {
  try {
    const now = new Date();
    
    // Delete expired riddle wallet sessions
    const deletedSessions = await db
      .delete(riddleWalletSessions)
      .where(lt(riddleWalletSessions.expiresAt, now))
      .returning({ id: riddleWalletSessions.id });

    // Clean up global active sessions map
    const activeSessions = (global as any).activeSessions;
    if (activeSessions) {
      let cleanedGlobalSessions = 0;
      for (const [token, session] of activeSessions.entries()) {
        if (session.expiresAt < Date.now()) {
          activeSessions.delete(token);
          cleanedGlobalSessions++;
        }
      }
      
      res.json({
        success: true,
        message: 'Expired sessions cleaned up',
        deletedDbSessions: deletedSessions.length,
        deletedGlobalSessions: cleanedGlobalSessions
      });
    } else {
      res.json({
        success: true,
        message: 'Expired sessions cleaned up',
        deletedDbSessions: deletedSessions.length
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to clean expired sessions'
    });
  }
});

// Delete orphaned wallets (wallets without any sessions and not linked to external wallets)
router.delete('/wallets/orphaned', async (req, res) => {
  try {
    // Find riddle wallets with no active sessions and no linked external wallets
    const orphanedWallets = await db
      .select({ id: riddleWallets.id, handle: riddleWallets.handle })
      .from(riddleWallets)
      .leftJoin(riddleWalletSessions, eq(riddleWallets.id, riddleWalletSessions.walletId))
      .where(
        and(
          isNull(riddleWalletSessions.id), // No sessions
          isNull(riddleWallets.linkedWalletAddress) // No linked external wallet
        )
      );

    // Delete orphaned riddle wallets
    const deletedWallets = [];
    for (const wallet of orphanedWallets) {
      await db.delete(riddleWallets).where(eq(riddleWallets.id, wallet.id));
      deletedWallets.push(wallet.handle);
    }

    res.json({
      success: true,
      message: 'Orphaned wallets cleaned up',
      deletedWallets: deletedWallets.length,
      handles: deletedWallets
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to clean orphaned wallets'
    });
  }
});

// Delete old swap history (older than specified days, default 30 days)
router.delete('/swap-history/old', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days.toString()));

    const deletedHistory = await db
      .delete(swapHistory)
      .where(
        and(
          lt(swapHistory.created_at, cutoffDate),
          eq(swapHistory.status, 'completed') // Only delete completed swaps
        )
      )
      .returning({ id: swapHistory.id });

    res.json({
      success: true,
      message: `Old swap history cleaned up (older than ${days} days)`,
      deletedRecords: deletedHistory.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to clean old swap history'
    });
  }
});

// Delete inactive imported wallets (not accessed in specified days)
router.delete('/imported-wallets/inactive', async (req, res) => {
  try {
    const { days = 90 } = req.query;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days.toString()));

    const deletedWallets = await db
      .delete(importedWallets)
      .where(
        and(
          eq(importedWallets.is_active, false),
          lt(importedWallets.created_at, cutoffDate)
        )
      )
      .returning({ id: importedWallets.id, address: importedWallets.address });

    res.json({
      success: true,
      message: `Inactive imported wallets cleaned up (inactive for ${days} days)`,
      deletedWallets: deletedWallets.length,
      addresses: deletedWallets.map(w => w.address)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to clean inactive imported wallets'
    });
  }
});

// Comprehensive cleanup - runs all cleanup operations
router.delete('/all', async (req, res) => {
  try {
    const results = {
      expiredSessions: 0,
      orphanedWallets: 0,
      oldSwapHistory: 0,
      inactiveImportedWallets: 0,
      errors: [] as string[]
    };

    // Clean expired sessions
    try {
      const now = new Date();
      const deletedSessions = await db
        .delete(riddleWalletSessions)
        .where(lt(riddleWalletSessions.expiresAt, now))
        .returning({ id: riddleWalletSessions.id });
      results.expiredSessions = deletedSessions.length;

      // Clean global sessions
      const activeSessions = (global as any).activeSessions;
      if (activeSessions) {
        for (const [token, session] of activeSessions.entries()) {
          if (session.expiresAt < Date.now()) {
            activeSessions.delete(token);
          }
        }
      }
    } catch (error) {
      results.errors.push(`Sessions cleanup: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Clean orphaned wallets
    try {
      const orphanedWallets = await db
        .select({ id: riddleWallets.id })
        .from(riddleWallets)
        .leftJoin(riddleWalletSessions, eq(riddleWallets.id, riddleWalletSessions.walletId))
        .where(
          and(
            isNull(riddleWalletSessions.id),
            isNull(riddleWallets.linkedWalletAddress)
          )
        );

      for (const wallet of orphanedWallets) {
        await db.delete(riddleWallets).where(eq(riddleWallets.id, wallet.id));
      }
      results.orphanedWallets = orphanedWallets.length;
    } catch (error) {
      results.errors.push(`Orphaned wallets cleanup: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Clean old swap history (30 days)
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30);
      const deletedHistory = await db
        .delete(swapHistory)
        .where(
          and(
            lt(swapHistory.created_at, cutoffDate),
            eq(swapHistory.status, 'completed')
          )
        )
        .returning({ id: swapHistory.id });
      results.oldSwapHistory = deletedHistory.length;
    } catch (error) {
      results.errors.push(`Swap history cleanup: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Clean inactive imported wallets (90 days)
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90);
      const deletedWallets = await db
        .delete(importedWallets)
        .where(
          and(
            eq(importedWallets.is_active, false),
            lt(importedWallets.created_at, cutoffDate)
          )
        )
        .returning({ id: importedWallets.id });
      results.inactiveImportedWallets = deletedWallets.length;
    } catch (error) {
      results.errors.push(`Imported wallets cleanup: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    res.json({
      success: true,
      message: 'Comprehensive cleanup completed',
      results,
      totalCleaned: results.expiredSessions + results.orphanedWallets + results.oldSwapHistory + results.inactiveImportedWallets
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Comprehensive cleanup failed'
    });
  }
});

// Get cleanup statistics (what would be cleaned)
router.get('/stats', async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Count expired sessions
    const expiredSessionsCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(riddleWalletSessions)
      .where(lt(riddleWalletSessions.expiresAt, now));

    // Count orphaned wallets
    const orphanedWalletsCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(riddleWallets)
      .leftJoin(riddleWalletSessions, eq(riddleWallets.id, riddleWalletSessions.walletId))
      .where(
        and(
          isNull(riddleWalletSessions.id),
          isNull(riddleWallets.linkedWalletAddress)
        )
      );

    // Count old swap history
    const oldSwapHistoryCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(swapHistory)
      .where(
        and(
          lt(swapHistory.created_at, thirtyDaysAgo),
          eq(swapHistory.status, 'completed')
        )
      );

    // Count inactive imported wallets
    const inactiveImportedWalletsCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(importedWallets)
      .where(
        and(
          eq(importedWallets.is_active, false),
          lt(importedWallets.created_at, ninetyDaysAgo)
        )
      );

    res.json({
      success: true,
      stats: {
        expiredSessions: expiredSessionsCount[0]?.count || 0,
        orphanedWallets: orphanedWalletsCount[0]?.count || 0,
        oldSwapHistory: oldSwapHistoryCount[0]?.count || 0,
        inactiveImportedWallets: inactiveImportedWalletsCount[0]?.count || 0
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get cleanup stats'
    });
  }
});

export default router;