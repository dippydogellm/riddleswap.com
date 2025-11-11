import { Router } from 'express';
import { db } from './db';
import { 
  copyTradingProfiles, copyTradingSubscriptions, copyTradingTrades,
  swapHistory, riddleWallets,
  type CopyTradingProfile, type CopyTradingSubscription, type CopyTradingTrade
} from '../shared/schema';
import { eq, desc, and, sum, sql, gte, count, ne } from 'drizzle-orm';
import { z } from 'zod';
import { validateSession } from './middleware/security';
import { getActiveSession } from './riddle-wallet-auth';

const router = Router();

// GET /api/copy-trading/trader-handle/:address - Get trader handle by wallet address
router.get('/trader-handle/:address', async (req, res) => {
  try {
    const walletAddress = req.params.address;
    
    console.log(`🔍 [COPY TRADING] Looking up trader handle for address: ${walletAddress}`);

    // Look up the user handle by wallet address
    const [wallet] = await db.select({
      handle: riddleWallets.handle,
      address: riddleWallets.linkedWalletAddress
    })
    .from(riddleWallets)
    .where(eq(riddleWallets.linkedWalletAddress, walletAddress))
    .limit(1);

    if (wallet) {
      res.json({
        success: true,
        handle: wallet.handle,
        address: wallet.address
      });
    } else {
      // If no registered Riddle wallet found, the address cannot be followed for copy trading
      res.status(404).json({ 
        success: false, 
        error: 'No registered trader found for this wallet address',
        canFollow: false
      });
    }

  } catch (error: any) {
    console.error('❌ [COPY TRADING HANDLE LOOKUP] Error:', error);
    res.status(500).json({ error: 'Failed to lookup trader handle' });
  }
});

// ============== COPY TRADING PROFILES ==============

// GET /api/copy-trading/profiles - Get all trading profiles or user's profiles
router.get('/profiles', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const sessionToken = authHeader?.replace('Bearer ', '');
    const session = sessionToken ? getActiveSession(sessionToken) : null;
    const { userOnly, sortBy = 'performance' } = req.query;

    console.log(`👥 [COPY TRADING] Fetching profiles${userOnly ? ' (user only)' : ' (public)'}`);

    let profiles;
    
    if (userOnly && session) {
      profiles = await db.select().from(copyTradingProfiles)
        .where(eq(copyTradingProfiles.userId, session.handle))
        .orderBy(
          sortBy === 'performance' ? desc(copyTradingProfiles.totalPnlUsd) :
          sortBy === 'followers' ? desc(copyTradingProfiles.followerCount) :
          desc(copyTradingProfiles.createdAt)
        );
    } else {
      // Only show public profiles
      profiles = await db.select().from(copyTradingProfiles)
        .where(eq(copyTradingProfiles.isPublic, true))
        .orderBy(
        sortBy === 'performance' ? desc(copyTradingProfiles.totalPnlUsd) :
        sortBy === 'followers' ? desc(copyTradingProfiles.followerCount) :
        desc(copyTradingProfiles.createdAt)
      );
    }

    // Enhance profiles with recent performance
    const enhancedProfiles = await Promise.all(profiles.map(async (profile) => {
      // Get recent trades performance
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      const [recentStats] = await db
        .select({
          recentTrades: count(copyTradingTrades.id).as('recentTrades'),
          recentPnl: sum(copyTradingTrades.pnlUsd).as('recentPnl')
        })
        .from(copyTradingTrades)
        .where(
          and(
            eq(copyTradingTrades.traderId, profile.userId),
            gte(copyTradingTrades.createdAt, sevenDaysAgo)
          )
        );

      return {
        ...profile,
        recentTrades: recentStats?.recentTrades || 0,
        recent7dPnl: recentStats?.recentPnl || '0',
        winRate: (profile.totalTrades || 0) > 0 ? ((profile.winningTrades || 0) / (profile.totalTrades || 0) * 100).toFixed(1) : '0'
      };
    }));

    res.json({
      success: true,
      profiles: enhancedProfiles
    });

  } catch (error: any) {
    console.error('❌ [COPY TRADING PROFILES] Error:', error);
    res.status(500).json({ error: 'Failed to fetch trading profiles' });
  }
});

// POST /api/copy-trading/profiles - Create or update trading profile
router.post('/profiles', validateSession, async (req, res) => {
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

    const profileSchema = z.object({
      name: z.string().min(1).max(50),
      description: z.string().max(500).optional(),
      isPublic: z.boolean().default(true),
      strategy: z.string().max(200).optional(),
      riskLevel: z.enum(['low', 'medium', 'high']).default('medium'),
      minCopyAmount: z.string().default('100'),
      maxCopyAmount: z.string().default('10000'),
      feePercentage: z.number().min(0).max(50).default(10)
    });

    const validated = profileSchema.parse(req.body);
    
    console.log(`👤 [COPY TRADING] Creating/updating profile for user: ${session.handle}`);

    // Check if profile already exists
    const existingProfile = await db.select()
      .from(copyTradingProfiles)
      .where(eq(copyTradingProfiles.userId, session.handle))
      .limit(1);

    if (existingProfile.length > 0) {
      // Update existing profile
      const [updatedProfile] = await db.update(copyTradingProfiles)
        .set({ 
          ...validated,
          feePercentage: validated.feePercentage.toString(),
          updatedAt: new Date()
         } as any)
        .where(eq(copyTradingProfiles.userId, session.handle))
        .returning();

      res.json({
        success: true,
        profile: updatedProfile,
        message: 'Profile updated successfully'
      });
    } else {
      // Create new profile
      const [newProfile] = await db.insert(copyTradingProfiles)
        .values({
          ...validated,
          feePercentage: validated.feePercentage.toString(),
          userId: session.handle,
          totalTrades: 0,
          winningTrades: 0,
          totalPnlUsd: '0',
          followerCount: 0,
          averageHoldTime: 0,
          maxDrawdown: '0'
        } as any)
        .returning();

      res.json({
        success: true,
        profile: newProfile,
        message: 'Profile created successfully'
      });
    }

  } catch (error: any) {
    console.error('❌ [COPY TRADING PROFILE CREATE] Error:', error);
    res.status(400).json({ error: error.message || 'Failed to create/update profile' });
  }
});

// ============== COPY TRADING SUBSCRIPTIONS ==============

// GET /api/copy-trading/subscriptions - Get user's subscriptions
router.get('/subscriptions', validateSession, async (req, res) => {
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

    console.log(`📋 [COPY TRADING] Fetching subscriptions for user: ${session.handle}`);

    const subscriptions = await db.select({
      subscription: copyTradingSubscriptions,
      traderProfile: copyTradingProfiles
    })
    .from(copyTradingSubscriptions)
    .leftJoin(
      copyTradingProfiles,
      eq(copyTradingSubscriptions.traderId, copyTradingProfiles.userId)
    )
    .where(eq(copyTradingSubscriptions.followerId, session.handle))
    .orderBy(desc(copyTradingSubscriptions.createdAt));

    res.json({
      success: true,
      subscriptions: subscriptions.map(({ subscription, traderProfile }) => ({
        ...subscription,
        traderProfile
      }))
    });

  } catch (error: any) {
    console.error('❌ [COPY TRADING SUBSCRIPTIONS] Error:', error);
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

// POST /api/copy-trading/subscriptions - Follow a trader
router.post('/subscriptions', validateSession, async (req, res) => {
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

    const subscriptionSchema = z.object({
      traderId: z.string().min(1),
      copyAmount: z.string().min(1),
      maxPercentage: z.number().min(1).max(100).default(10),
      stopLossPercentage: z.number().min(1).max(50).optional(),
      takeProfitPercentage: z.number().min(1).max(500).optional()
    });

    const validated = subscriptionSchema.parse(req.body);
    
    console.log(`➕ [COPY TRADING] User ${session.handle} following trader ${validated.traderId}`);

    // Check if already following
    const existingSubscription = await db.select()
      .from(copyTradingSubscriptions)
      .where(
        and(
          eq(copyTradingSubscriptions.followerId, session.handle),
          eq(copyTradingSubscriptions.traderId, validated.traderId)
        )
      )
      .limit(1);

    if (existingSubscription.length > 0) {
      return res.status(400).json({ error: 'Already following this trader' });
    }

    // Create subscription
    const [newSubscription] = await db.insert(copyTradingSubscriptions)
      .values({
        ...validated,
        maxPercentage: validated.maxPercentage.toString(),
        stopLossPercentage: validated.stopLossPercentage?.toString(),
        takeProfitPercentage: validated.takeProfitPercentage?.toString(),
        followerId: session.handle,
        isActive: true,
        totalCopiedTrades: 0,
        totalPnlUsd: '0'
      })
      .returning();

    // Update trader's follower count
    await db.update(copyTradingProfiles)
      .set({
        followerCount: sql`${copyTradingProfiles.followerCount} + 1`
      })
      .where(eq(copyTradingProfiles.userId, validated.traderId));

    res.json({
      success: true,
      subscription: newSubscription,
      message: 'Successfully following trader'
    });

  } catch (error: any) {
    console.error('❌ [COPY TRADING FOLLOW] Error:', error);
    res.status(400).json({ error: error.message || 'Failed to follow trader' });
  }
});

// DELETE /api/copy-trading/subscriptions/:id - Unfollow a trader
router.delete('/subscriptions/:id', validateSession, async (req, res) => {
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

    const subscriptionId = req.params.id;
    
    console.log(`❌ [COPY TRADING] User ${session.handle} unfollowing subscription ${subscriptionId}`);

    // Verify the subscription belongs to the current user
    const [subscription] = await db.select()
      .from(copyTradingSubscriptions)
      .where(
        and(
          eq(copyTradingSubscriptions.id, subscriptionId),
          eq(copyTradingSubscriptions.followerId, session.handle)
        )
      )
      .limit(1);

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    // Deactivate the subscription instead of deleting for audit trail
    const [updatedSubscription] = await db.update(copyTradingSubscriptions)
      .set({ 
        isActive: false,
        updatedAt: new Date()
       } as any)
      .where(eq(copyTradingSubscriptions.id, subscriptionId))
      .returning();

    // Update trader's follower count
    await db.update(copyTradingProfiles)
      .set({
        followerCount: sql`${copyTradingProfiles.followerCount} - 1`
      })
      .where(eq(copyTradingProfiles.userId, subscription.traderId));

    res.json({
      success: true,
      subscription: updatedSubscription,
      message: 'Successfully unfollowed trader'
    });

  } catch (error: any) {
    console.error('❌ [COPY TRADING UNFOLLOW] Error:', error);
    res.status(500).json({ error: 'Failed to unfollow trader' });
  }
});

// PATCH /api/copy-trading/subscriptions/:id - Update subscription settings
router.patch('/subscriptions/:id', validateSession, async (req, res) => {
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

    const subscriptionId = req.params.id;
    
    const updateSchema = z.object({
      copyAmount: z.string().optional(),
      maxPercentage: z.number().min(1).max(100).optional(),
      stopLossPercentage: z.number().min(1).max(50).optional(),
      takeProfitPercentage: z.number().min(1).max(500).optional(),
      isActive: z.boolean().optional()
    });

    const validated = updateSchema.parse(req.body);
    
    console.log(`🔄 [COPY TRADING] User ${session.handle} updating subscription ${subscriptionId}`);

    // Verify the subscription belongs to the current user
    const [subscription] = await db.select()
      .from(copyTradingSubscriptions)
      .where(
        and(
          eq(copyTradingSubscriptions.id, subscriptionId),
          eq(copyTradingSubscriptions.followerId, session.handle)
        )
      )
      .limit(1);

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    // Update subscription
    const updateData: any = { ...validated, updatedAt: new Date() };
    
    // Convert numbers to strings for database storage
    if (updateData.maxPercentage) updateData.maxPercentage = updateData.maxPercentage.toString();
    if (updateData.stopLossPercentage) updateData.stopLossPercentage = updateData.stopLossPercentage.toString();
    if (updateData.takeProfitPercentage) updateData.takeProfitPercentage = updateData.takeProfitPercentage.toString();

    const [updatedSubscription] = await db.update(copyTradingSubscriptions)
      .set(updateData)
      .where(eq(copyTradingSubscriptions.id, subscriptionId))
      .returning();

    res.json({
      success: true,
      subscription: updatedSubscription,
      message: 'Subscription updated successfully'
    });

  } catch (error: any) {
    console.error('❌ [COPY TRADING UPDATE SUBSCRIPTION] Error:', error);
    res.status(400).json({ error: error.message || 'Failed to update subscription' });
  }
});

// ============== COPY TRADING TRADES ==============

// GET /api/copy-trading/trades - Get copy trading activity
router.get('/trades', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const sessionToken = authHeader?.replace('Bearer ', '');
    const session = sessionToken ? getActiveSession(sessionToken) : null;
    const { traderId, followerId, status, limit = '50' } = req.query;

    console.log(`📊 [COPY TRADING TRADES] Fetching trades`);

    const conditions = [];

    if (traderId) {
      conditions.push(eq(copyTradingTrades.traderId, traderId as string));
    }
    
    if (followerId) {
      conditions.push(eq(copyTradingTrades.followerId, followerId as string));
    }
    
    if (status) {
      conditions.push(eq(copyTradingTrades.status, status as string));
    }

    let trades;
    if (conditions.length > 0) {
      trades = await db.select().from(copyTradingTrades)
        .where(and(...conditions))
        .orderBy(desc(copyTradingTrades.createdAt))
        .limit(parseInt(limit as string));
    } else {
      trades = await db.select().from(copyTradingTrades)
        .orderBy(desc(copyTradingTrades.createdAt))
        .limit(parseInt(limit as string));
    }

    res.json({
      success: true,
      trades
    });

  } catch (error: any) {
    console.error('❌ [COPY TRADING TRADES] Error:', error);
    res.status(500).json({ error: 'Failed to fetch copy trading trades' });
  }
});

// ============== COPY TRADING ANALYTICS ==============

// GET /api/copy-trading/analytics - Get copy trading analytics
router.get('/analytics', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const sessionToken = authHeader?.replace('Bearer ', '');
    const session = sessionToken ? getActiveSession(sessionToken) : null;
    const { traderId, timeframe = '30d' } = req.query;

    console.log(`📈 [COPY TRADING ANALYTICS] Fetching analytics`);

    let timeframeDays = 30;
    if (timeframe === '7d') timeframeDays = 7;
    else if (timeframe === '90d') timeframeDays = 90;

    const startDate = new Date(Date.now() - timeframeDays * 24 * 60 * 60 * 1000);

    // Get overall statistics
    const [overallStats] = await db
      .select({
        totalTrades: count(copyTradingTrades.id).as('totalTrades'),
        totalVolume: sum(copyTradingTrades.copyAmountUsd).as('totalVolume'),
        totalPnl: sum(copyTradingTrades.pnlUsd).as('totalPnl'),
        activeTraders: sql<number>`COUNT(DISTINCT ${copyTradingTrades.traderId})`.as('activeTraders'),
        activeFollowers: sql<number>`COUNT(DISTINCT ${copyTradingTrades.followerId})`.as('activeFollowers')
      })
      .from(copyTradingTrades)
      .where(gte(copyTradingTrades.createdAt, startDate));

    // Get top performers
    const topTraders = await db
      .select({
        traderId: copyTradingTrades.traderId,
        totalPnl: sum(copyTradingTrades.pnlUsd).as('totalPnl'),
        totalTrades: count(copyTradingTrades.id).as('totalTrades'),
        winRate: sql<number>`
          COUNT(CASE WHEN ${copyTradingTrades.pnlUsd} > 0 THEN 1 END) * 100.0 / COUNT(*)
        `.as('winRate')
      })
      .from(copyTradingTrades)
      .where(gte(copyTradingTrades.createdAt, startDate))
      .groupBy(copyTradingTrades.traderId)
      .orderBy(desc(sql`sum(${copyTradingTrades.pnlUsd})`))
      .limit(10);

    res.json({
      success: true,
      analytics: {
        overview: {
          totalTrades: overallStats?.totalTrades || 0,
          totalVolume: overallStats?.totalVolume || '0',
          totalPnl: overallStats?.totalPnl || '0',
          activeTraders: overallStats?.activeTraders || 0,
          activeFollowers: overallStats?.activeFollowers || 0
        },
        topTraders,
        timeframe
      }
    });

  } catch (error: any) {
    console.error('❌ [COPY TRADING ANALYTICS] Error:', error);
    res.status(500).json({ error: 'Failed to fetch copy trading analytics' });
  }
});

export default router;