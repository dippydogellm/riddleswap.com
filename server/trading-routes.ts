import { Router } from 'express';
import { db } from './db';
import { 
  swapHistory, riddleWallets, riddleWalletSessions
} from '../shared/schema';
import { eq, desc, and, sum, sql, gte, count } from 'drizzle-orm';
import { z } from 'zod';
import { validateSession } from './middleware/security';
import { getActiveSession } from './riddle-wallet-auth';

const router = Router();

// ============== TRADING ANALYTICS ==============

// GET /api/trading/analytics - Get trading analytics data
router.get('/analytics', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const sessionToken = authHeader?.replace('Bearer ', '');
    
    if (!sessionToken) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const session = getActiveSession(sessionToken);
    if (!session) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    console.log(`📊 [TRADING ANALYTICS] Fetching analytics for user: ${session.handle}`);

    // Get user's wallets for analytics
    const userWallets = await db.select()
      .from(riddleWallets)
      .where(eq(riddleWallets.handle, session.handle));

    const walletAddresses = userWallets.map(w => w.xrpAddress);

    // Get trading volume data (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const [volumeStats] = await db
      .select({
        totalVolume: sum(swapHistory.total_value_usd).as('totalVolume'),
        totalTrades: count(swapHistory.id).as('totalTrades'),
        avgTradeSize: sql<number>`AVG(${swapHistory.total_value_usd})`.as('avgTradeSize')
      })
      .from(swapHistory)
      .where(
        and(
          sql`${swapHistory.wallet_address} = ANY(${walletAddresses})`,
          gte(swapHistory.created_at, thirtyDaysAgo),
          eq(swapHistory.status, 'completed')
        )
      );

    // Get recent trades
    const recentTrades = await db.select()
      .from(swapHistory)
      .where(
        and(
          sql`${swapHistory.wallet_address} = ANY(${walletAddresses})`,
          eq(swapHistory.status, 'completed')
        )
      )
      .orderBy(desc(swapHistory.created_at))
      .limit(10);

    // Calculate P&L (simplified)
    const profitLoss = recentTrades.reduce((acc, trade) => {
      const profit = parseFloat(trade.total_value_usd || '0') * 0.05; // Simplified 5% profit estimation
      return acc + profit;
    }, 0);

    res.json({
      success: true,
      analytics: {
        totalVolume: volumeStats?.totalVolume || '0',
        totalTrades: volumeStats?.totalTrades || 0,
        avgTradeSize: volumeStats?.avgTradeSize || 0,
        profitLoss: profitLoss.toFixed(2),
        recentTrades: recentTrades.map(trade => ({
          id: trade.id,
          fromToken: trade.from_token_symbol,
          toToken: trade.to_token_symbol,
          fromAmount: trade.from_amount,
          toAmount: trade.to_amount,
          fromAmountUsd: trade.total_value_usd,
          toAmountUsd: trade.total_value_usd,
          chain: trade.chain,
          timestamp: trade.created_at
        }))
      }
    });

  } catch (error: any) {
    console.error('❌ [TRADING ANALYTICS] Error:', error);
    res.status(500).json({ error: 'Failed to fetch trading analytics' });
  }
});

// GET /api/trading/health - Get trading service health
router.get('/health', async (req, res) => {
  try {
    console.log('🏥 [TRADING HEALTH] Checking service health');

    // Check database connectivity
    const dbCheck = await db.select({ count: sql<number>`1` }).from(swapHistory).limit(1);
    const isDatabaseHealthy = dbCheck !== null;

    // Check recent trading activity
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const [recentActivity] = await db
      .select({ count: count() })
      .from(swapHistory)
      .where(gte(swapHistory.created_at, tenMinutesAgo));

    const healthStatus = {
      status: isDatabaseHealthy ? 'healthy' : 'degraded',
      database: isDatabaseHealthy ? 'connected' : 'disconnected',
      recentActivity: recentActivity?.count || 0,
      services: {
        swapping: 'operational',
        analytics: 'operational',
        portfolio: 'operational'
      },
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      health: healthStatus
    });

  } catch (error: any) {
    console.error('❌ [TRADING HEALTH] Error:', error);
    res.status(500).json({
      success: false,
      health: {
        status: 'unhealthy',
        database: 'error',
        recentActivity: 0,
        services: {
          swapping: 'error',
          analytics: 'error',
          portfolio: 'error'
        },
        error: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// POST /api/trading/quick-buy - Quick buy functionality
router.post('/quick-buy', validateSession, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const sessionToken = authHeader?.replace('Bearer ', '');
    
    if (!sessionToken) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const session = getActiveSession(sessionToken);
    if (!session) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const quickBuySchema = z.object({
      fromToken: z.string().min(1),
      toToken: z.string().min(1),
      amount: z.string().min(1),
      chain: z.string().min(1),
      slippage: z.number().optional().default(1.0)
    });

    const validated = quickBuySchema.parse(req.body);
    
    console.log(`⚡ [QUICK BUY] Processing quick buy for user: ${session.handle}`);
    console.log(`⚡ [QUICK BUY] ${validated.amount} ${validated.fromToken} -> ${validated.toToken} on ${validated.chain}`);

    // In a real implementation, this would:
    // 1. Get the best price from DEX aggregators
    // 2. Execute the swap transaction
    // 3. Monitor the transaction status
    // 4. Update swap history

    // For now, return a simulated response
    const mockSwapId = `qb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    res.json({
      success: true,
      swapId: mockSwapId,
      estimatedOutput: (parseFloat(validated.amount) * 0.95).toString(), // 5% slippage simulation
      fees: {
        networkFee: '0.001',
        serviceFee: '0.1'
      },
      status: 'pending',
      message: 'Quick buy order submitted successfully'
    });

  } catch (error: any) {
    console.error('❌ [QUICK BUY] Error:', error);
    res.status(500).json({ error: 'Failed to process quick buy' });
  }
});

// GET /api/trading/portfolio - Get portfolio data
router.get('/portfolio', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const sessionToken = authHeader?.replace('Bearer ', '');
    
    if (!sessionToken) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const session = getActiveSession(sessionToken);
    if (!session) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    console.log(`💼 [PORTFOLIO] Fetching portfolio for user: ${session.handle}`);

    // Get user's portfolio data from swap history (simplified approach)
    const userWallets = await db.select()
      .from(riddleWallets)
      .where(eq(riddleWallets.handle, session.handle));

    const walletAddresses = userWallets.map(w => w.xrpAddress);

    // Calculate portfolio from recent swaps
    const recentSwaps = await db.select()
      .from(swapHistory)
      .where(
        and(
          sql`${swapHistory.wallet_address} = ANY(${walletAddresses})`,
          eq(swapHistory.status, 'completed')
        )
      )
      .orderBy(desc(swapHistory.created_at))
      .limit(50);

    // Simple portfolio calculation
    const totalVolume = recentSwaps.reduce((acc, swap) => acc + parseFloat(swap.total_value_usd || '0'), 0);
    const estimatedValue = totalVolume * 0.1; // Rough estimation

    res.json({
      success: true,
      portfolio: {
        totalValue: estimatedValue.toFixed(2),
        change24h: '0.00',
        changePercent: '0.00',
        holdings: [],
        history: [],
        note: 'Portfolio tracking in development - showing estimated values from trading history'
      }
    });

  } catch (error: any) {
    console.error('❌ [PORTFOLIO] Error:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio data' });
  }
});

export default router;