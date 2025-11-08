import { Router } from 'express';
import { db } from './db';
import { 
  riddleWallets, riddleWalletSessions, externalWallets,
  swapHistory
} from '../shared/schema';
import { eq, desc, and, gte, count, sql } from 'drizzle-orm';
import { validateSession } from './middleware/security';
import { getActiveSession } from './riddle-wallet-auth';

const router = Router();

// GET /api/wallet/status - Get comprehensive wallet status
router.get('/status', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const sessionToken = authHeader?.replace('Bearer ', '');
    
    if (!sessionToken) {
      return res.status(401).json({ 
        error: 'Authentication required',
        authenticated: false 
      });
    }
    
    const session = getActiveSession(sessionToken);
    if (!session) {
      return res.status(401).json({ 
        error: 'Authentication required',
        authenticated: false 
      });
    }

    console.log(`💼 [WALLET STATUS] Fetching status for user: ${session.handle}`);

    // Get user's Riddle wallets
    const riddleWallets_data = await db.select()
      .from(riddleWallets)
      .where(eq(riddleWallets.handle, session.handle));

    // Get user's external wallets
    const externalWallets_data = await db.select()
      .from(externalWallets)
      .where(eq(externalWallets.user_id, session.handle));

    // Get recent activity (last 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const [recentActivity] = await db
      .select({
        recentSwaps: count(swapHistory.id).as('recentSwaps'),
        totalVolume24h: sql<string>`COALESCE(SUM(CAST(${swapHistory.total_value_usd} AS DECIMAL)), 0)`.as('totalVolume24h')
      })
      .from(swapHistory)
      .where(
        and(
          sql`${swapHistory.wallet_address} = ANY(${riddleWallets_data.map(w => w.xrpAddress)})`,
          gte(swapHistory.created_at, twentyFourHoursAgo)
        )
      );

    // Get latest portfolio snapshot (simplified - TODO: implement proper portfolio tracking)
    const latestPortfolio: any[] = [];

    // Calculate wallet connectivity score
    const totalWallets = riddleWallets_data.length + externalWallets_data.length;
    const verifiedWallets = externalWallets_data.filter(w => w.verified).length + riddleWallets_data.length;
    const connectivityScore = totalWallets > 0 ? (verifiedWallets / totalWallets) * 100 : 0;

    // Check for any pending transactions or issues
    const pendingSwaps = await db.select()
      .from(swapHistory)
      .where(
        and(
          sql`${swapHistory.wallet_address} = ANY(${riddleWallets_data.map(w => w.xrpAddress)})`,
          eq(swapHistory.status, 'pending')
        )
      )
      .limit(10);

    // Determine overall status
    let overallStatus = 'ready';
    let statusMessage = 'All systems operational';
    
    if (totalWallets === 0) {
      overallStatus = 'no_wallets';
      statusMessage = 'No wallets connected';
    } else if (connectivityScore < 50) {
      overallStatus = 'partial';
      statusMessage = 'Some wallets need verification';
    } else if (pendingSwaps.length > 5) {
      overallStatus = 'busy';
      statusMessage = 'Multiple transactions pending';
    }

    const walletStatus = {
      authenticated: true,
      overallStatus,
      statusMessage,
      
      // Wallet counts
      riddleWallets: riddleWallets_data.length,
      externalWallets: externalWallets_data.length,
      verifiedWallets,
      totalWallets,
      connectivityScore: connectivityScore.toFixed(1),
      
      // Activity stats
      recentSwaps: recentActivity?.recentSwaps || 0,
      totalVolume24h: recentActivity?.totalVolume24h || '0',
      pendingTransactions: pendingSwaps.length,
      
      // Portfolio info
      hasPortfolio: latestPortfolio.length > 0,
      lastPortfolioUpdate: latestPortfolio[0]?.timestamp || null,
      portfolioValue: latestPortfolio[0]?.totalValueUsd || '0',
      
      // Chain connectivity
      chains: {
        xrpl: riddleWallets_data.length > 0 || externalWallets_data.some(w => w.chain === 'xrp'),
        ethereum: riddleWallets_data.length > 0 || externalWallets_data.some(w => w.chain === 'eth'),
        solana: riddleWallets_data.length > 0 || externalWallets_data.some(w => w.chain === 'sol'),
        bitcoin: riddleWallets_data.length > 0
      },
      
      // Service health
      services: {
        trading: 'operational',
        staking: 'operational',
        nft: 'operational',
        bridge: 'operational'
      },
      
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      wallet: walletStatus
    });

  } catch (error: any) {
    console.error('❌ [WALLET STATUS] Error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch wallet status',
      authenticated: false,
      overallStatus: 'error',
      statusMessage: 'Service temporarily unavailable'
    });
  }
});

// GET /api/wallet/readiness - Quick readiness check for critical flows
router.get('/readiness', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const sessionToken = authHeader?.replace('Bearer ', '');
    const session = sessionToken ? getActiveSession(sessionToken) : null;
    
    if (!session) {
      return res.json({
        success: true,
        readiness: {
          authenticated: false,
          canTrade: false,
          canStake: false,
          canUseLaunchpad: false,
          canUseNFT: false,
          message: 'Authentication required'
        }
      });
    }

    // Quick checks for service readiness
    const userWallets = await db.select()
      .from(riddleWallets)
      .where(eq(riddleWallets.handle, session.handle))
      .limit(1);

    const hasWallets = userWallets.length > 0;

    const readiness = {
      authenticated: true,
      canTrade: hasWallets,
      canStake: hasWallets,
      canUseLaunchpad: hasWallets,
      canUseNFT: hasWallets,
      message: hasWallets ? 'Ready for trading' : 'Create a wallet to get started'
    };

    res.json({
      success: true,
      readiness
    });

  } catch (error: any) {
    console.error('❌ [WALLET READINESS] Error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to check wallet readiness'
    });
  }
});

export default router;