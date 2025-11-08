import { Router } from 'express';
import { db } from './db';
import { 
  stakingPools, stakingPositions, feeLedger, rewardFund, riddleWallets, riddleWalletSessions,
  type StakingPool, type StakingPosition, type InsertStakingPool, type InsertStakingPosition
} from '../shared/schema';
import { eq, desc, and, sum, sql } from 'drizzle-orm';
import { z } from 'zod';
import { validateSession } from './middleware/security';
import { getActiveSession } from './riddle-wallet-auth';

const router = Router();

// Input validation schemas
const createStakingPoolSchema = z.object({
  chain: z.string().min(1),
  minStakeAmount: z.string().optional().default("100"),
  lockupDays: z.number().optional().default(0)
});

const stakingDepositSchema = z.object({
  poolId: z.string().min(1),
  amount: z.string().min(1),
  transactionHash: z.string().min(1)
});

const stakingWithdrawSchema = z.object({
  positionId: z.string().min(1),
  amount: z.string().min(1), // "full" or specific amount
  transactionHash: z.string().min(1)
});

const claimRewardsSchema = z.object({
  positionId: z.string().min(1),
  transactionHash: z.string().min(1)
});

// ============== STAKING POOLS ==============

// GET /api/staking/pools - Get all staking pools or by chain
router.get('/pools', async (req, res) => {
  try {
    const { chain } = req.query;
    console.log(`🏦 [STAKING POOLS] Fetching pools${chain ? ` for chain: ${chain}` : ' (all chains)'}`);

    // Build query without mutating builder type (avoids Drizzle select type narrowing assignment error)
    const baseQuery = db.select().from(stakingPools);
    const finalQuery = (chain && typeof chain === 'string')
      ? baseQuery.where(eq(stakingPools.chain, chain))
      : baseQuery;
    const pools = await finalQuery.orderBy(desc(stakingPools.createdAt));
    
    // Calculate APY for each pool based on recent fee distributions
    const poolsWithAPY = await Promise.all(pools.map(async (pool) => {
      // Get total fees distributed to this chain in the last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const [feeStats] = await db
        .select({
          totalFees: sum(feeLedger.feeUsdValue).as('totalFees'),
          count: sql<number>`count(*)`.as('count')
        })
        .from(feeLedger)
        .where(
          and(
            eq(feeLedger.chain, pool.chain),
            eq(feeLedger.distributedToStaking, true),
            sql`${feeLedger.createdAt} >= ${thirtyDaysAgo}`
          )
        );

      // Calculate estimated APY (10% of bridge fees distributed to stakers)
      const monthlyFeesUSD = parseFloat(feeStats?.totalFees || '0');
      const annualFeesUSD = monthlyFeesUSD * 12;
      const stakingShareUSD = annualFeesUSD * 0.1; // 10% goes to stakers
      const totalStakedUSD = parseFloat(pool.totalStaked) || 1; // Avoid division by zero
      
      const estimatedAPY = totalStakedUSD > 0 ? (stakingShareUSD / totalStakedUSD) * 100 : 0;

      return {
        ...pool,
        estimatedAPY: Math.max(0, Math.min(1000, estimatedAPY)), // Cap between 0-1000%
        monthlyFeesUSD,
        totalStakersCount: await db
          .select({ count: sql<number>`count(*)` })
          .from(stakingPositions)
          .where(
            and(
              eq(stakingPositions.poolId, pool.id),
              eq(stakingPositions.status, 'active')
            )
          )
          .then(result => result[0]?.count || 0)
      };
    }));

    console.log(`✅ [STAKING POOLS] Retrieved ${pools.length} pools`);
    res.json({
      success: true,
      pools: poolsWithAPY
    });

  } catch (error) {
    console.error('❌ [STAKING POOLS] Error fetching pools:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch staking pools'
    });
  }
});

// GET /api/staking/pools/:id - Get specific pool details
router.get('/pools/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🏦 [STAKING POOL] Fetching pool details: ${id}`);

    const [pool] = await db
      .select()
      .from(stakingPools)
      .where(eq(stakingPools.id, id));

    if (!pool) {
      return res.status(404).json({
        success: false,
        error: 'Staking pool not found'
      });
    }

    // Get pool statistics
    const [stats] = await db
      .select({
        totalPositions: sql<number>`count(*)`,
        averagePosition: sql<number>`avg(${stakingPositions.stakedAmount})`
      })
      .from(stakingPositions)
      .where(
        and(
          eq(stakingPositions.poolId, id),
          eq(stakingPositions.status, 'active')
        )
      );

    console.log(`✅ [STAKING POOL] Retrieved pool: ${pool.chain}`);
    res.json({
      success: true,
      pool: {
        ...pool,
        totalPositions: stats?.totalPositions || 0,
        averagePosition: stats?.averagePosition || '0'
      }
    });

  } catch (error) {
    console.error('❌ [STAKING POOL] Error fetching pool:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch staking pool'
    });
  }
});

// POST /api/staking/pools - Create new staking pool (admin only)
router.post('/pools', validateSession, async (req, res) => {
  try {
    console.log('🏦 [CREATE POOL] Creating new staking pool');

    const validation = createStakingPoolSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid pool data',
        details: validation.error.errors
      });
    }

    const { chain, minStakeAmount, lockupDays } = validation.data;

    // Check if pool already exists for this chain
    const [existingPool] = await db
      .select()
      .from(stakingPools)
      .where(eq(stakingPools.chain, chain));

    if (existingPool) {
      return res.status(400).json({
        success: false,
        error: 'Staking pool already exists for this chain'
      });
    }

    // Create the pool
    const poolData: InsertStakingPool = {
      chain,
      minStakeAmount,
      lockupDays,
      aprMode: 'variable',
      totalStaked: '0',
      rewardPerTokenStored: '0',
      isActive: true
    };

    const [pool] = await db
      .insert(stakingPools)
      .values(poolData as any)
      .returning();

    console.log(`✅ [CREATE POOL] Created pool for chain: ${chain}`);
    res.status(201).json({
      success: true,
      pool
    });

  } catch (error) {
    console.error('❌ [CREATE POOL] Error creating pool:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create staking pool'
    });
  }
});

// ============== STAKING POSITIONS ==============

// GET /api/staking/positions - Get user's staking positions
router.get('/positions', validateSession, async (req, res) => {
  try {
    const sessionToken = req.headers.authorization?.replace('Bearer ', '');
    if (!sessionToken) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Get user handle from active session
    const activeSession = getActiveSession(sessionToken);
    if (!activeSession) {
      return res.status(401).json({ success: false, error: 'Invalid session' });
    }

    const userHandle = activeSession.handle;
    console.log(`💼 [STAKING POSITIONS] Fetching positions for user: ${userHandle}`);

    const positions = await db
      .select({
        position: stakingPositions,
        pool: stakingPools
      })
      .from(stakingPositions)
      .innerJoin(stakingPools, eq(stakingPositions.poolId, stakingPools.id))
      .where(eq(stakingPositions.userHandle, userHandle))
      .orderBy(desc(stakingPositions.createdAt));

    // Calculate pending rewards for each position
    const positionsWithRewards = positions.map(({ position, pool }) => {
      // Simple reward calculation - in production this would be more sophisticated
      const stakedAmount = parseFloat(position.stakedAmount);
      const daysSinceStaking = Math.floor(
        (Date.now() - position.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      // Estimate daily rewards based on pool's current reward rate
      const dailyRewardRate = parseFloat(pool.rewardPerTokenStored) / 365;
      const pendingRewards = (stakedAmount * dailyRewardRate * daysSinceStaking).toString();

      return {
        ...position,
        pool,
        pendingRewards,
        daysSinceStaking
      };
    });

    console.log(`✅ [STAKING POSITIONS] Retrieved ${positions.length} positions`);
    res.json({
      success: true,
      positions: positionsWithRewards
    });

  } catch (error) {
    console.error('❌ [STAKING POSITIONS] Error fetching positions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch staking positions'
    });
  }
});

// POST /api/staking/deposit - Create new staking position
router.post('/deposit', validateSession, async (req, res) => {
  try {
    const sessionToken = req.headers.authorization?.replace('Bearer ', '');
    if (!sessionToken) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    console.log('💰 [STAKING DEPOSIT] Processing staking deposit');

    const validation = stakingDepositSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid deposit data',
        details: validation.error.errors
      });
    }

    const { poolId, amount, transactionHash } = validation.data;

    // Get user handle from active session
    const activeSession = getActiveSession(sessionToken);
    if (!activeSession) {
      return res.status(401).json({ success: false, error: 'Invalid session' });
    }

    const userHandle = activeSession.handle;
    const walletAddress = activeSession.walletData?.xrpAddress || activeSession.walletData?.ethAddress || '';

    // Verify pool exists and is active
    const [pool] = await db
      .select()
      .from(stakingPools)
      .where(eq(stakingPools.id, poolId));

    if (!pool || !pool.isActive) {
      return res.status(400).json({
        success: false,
        error: 'Staking pool not found or inactive'
      });
    }

    // Check minimum stake amount
    const stakeAmount = parseFloat(amount);
    const minStake = parseFloat(pool.minStakeAmount);
    
    if (stakeAmount < minStake) {
      return res.status(400).json({
        success: false,
        error: `Minimum stake amount is ${minStake}`
      });
    }

    // Check for duplicate transaction hash
    const [existingPosition] = await db
      .select()
      .from(stakingPositions)
      .where(eq(stakingPositions.stakeTransactionHash, transactionHash));

    if (existingPosition) {
      return res.status(400).json({
        success: false,
        error: 'Transaction hash already used'
      });
    }

    // Calculate lockup end date if needed
    const lockupEndDate = pool.lockupDays > 0 
      ? new Date(Date.now() + pool.lockupDays * 24 * 60 * 60 * 1000)
      : null;

    // Create staking position
    const positionData: InsertStakingPosition = {
      poolId,
      userHandle,
      walletAddress,
      chain: pool.chain,
      stakedAmount: amount,
      rewardDebt: '0',
      pendingRewards: '0',
      status: 'active',
      lockupEndDate,
      stakeTransactionHash: transactionHash
    };

    await db.transaction(async (tx) => {
      // Create position
      const [position] = await tx
        .insert(stakingPositions)
        .values(positionData as any)
        .returning();

      // Update pool total staked
      const newTotal = (parseFloat(pool.totalStaked) + stakeAmount).toString();
      await tx
        .update(stakingPools)
        .set({ 
          totalStaked: newTotal,
          lastUpdateTime: new Date(),
          updatedAt: new Date()
         } as any)
        .where(eq(stakingPools.id, poolId));

      console.log(`✅ [STAKING DEPOSIT] Created position: ${position.id} for ${amount} ${pool.chain}`);
      return position;
    });

    res.status(201).json({
      success: true,
      message: 'Staking position created successfully'
    });

  } catch (error) {
    console.error('❌ [STAKING DEPOSIT] Error processing deposit:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process staking deposit'
    });
  }
});

// POST /api/staking/withdraw - Withdraw from staking position
router.post('/withdraw', validateSession, async (req, res) => {
  try {
    const sessionToken = req.headers.authorization?.replace('Bearer ', '');
    if (!sessionToken) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    console.log('💸 [STAKING WITHDRAW] Processing withdrawal');

    const validation = stakingWithdrawSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid withdrawal data',
        details: validation.error.errors
      });
    }

    const { positionId, amount, transactionHash } = validation.data;

    // Get user handle from active session
    const activeSession = getActiveSession(sessionToken);
    if (!activeSession) {
      return res.status(401).json({ success: false, error: 'Invalid session' });
    }

    const userHandle = activeSession.handle;

    // Get position and verify ownership
    const [position] = await db
      .select({
        position: stakingPositions,
        pool: stakingPools
      })
      .from(stakingPositions)
      .innerJoin(stakingPools, eq(stakingPositions.poolId, stakingPools.id))
      .where(
        and(
          eq(stakingPositions.id, positionId),
          eq(stakingPositions.userHandle, userHandle),
          eq(stakingPositions.status, 'active')
        )
      );

    if (!position) {
      return res.status(404).json({
        success: false,
        error: 'Staking position not found'
      });
    }

    // Check lockup period
    if (position.position.lockupEndDate && new Date() < position.position.lockupEndDate) {
      return res.status(400).json({
        success: false,
        error: 'Position is still locked up',
        unlockDate: position.position.lockupEndDate
      });
    }

    const currentStaked = parseFloat(position.position.stakedAmount);
    const withdrawAmount = amount === 'full' ? currentStaked : parseFloat(amount);

    if (withdrawAmount > currentStaked) {
      return res.status(400).json({
        success: false,
        error: 'Withdrawal amount exceeds staked amount'
      });
    }

    await db.transaction(async (tx) => {
      if (amount === 'full' || withdrawAmount === currentStaked) {
        // Full withdrawal - mark position as withdrawn
        await tx
          .update(stakingPositions)
          .set({ 
            status: 'withdrawn',
            withdrawTransactionHash: transactionHash,
            withdrawnAt: new Date()
           } as any)
          .where(eq(stakingPositions.id, positionId));
      } else {
        // Partial withdrawal - update staked amount
        await tx
          .update(stakingPositions)
          .set({ 
            stakedAmount: (currentStaked - withdrawAmount).toString()
           } as any)
          .where(eq(stakingPositions.id, positionId));
      }

      // Update pool total staked
      const newPoolTotal = (parseFloat(position.pool.totalStaked) - withdrawAmount).toString();
      await tx
        .update(stakingPools)
        .set({ 
          totalStaked: newPoolTotal,
          lastUpdateTime: new Date(),
          updatedAt: new Date()
         } as any)
        .where(eq(stakingPools.id, position.position.poolId));
    });

    console.log(`✅ [STAKING WITHDRAW] Processed withdrawal: ${withdrawAmount} ${position.pool.chain}`);
    res.json({
      success: true,
      message: 'Withdrawal processed successfully'
    });

  } catch (error) {
    console.error('❌ [STAKING WITHDRAW] Error processing withdrawal:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process withdrawal'
    });
  }
});

// POST /api/staking/claim - Claim rewards from staking position
router.post('/claim', validateSession, async (req, res) => {
  try {
    const sessionToken = req.headers.authorization?.replace('Bearer ', '');
    if (!sessionToken) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    console.log('🎁 [STAKING CLAIM] Processing reward claim');

    const validation = claimRewardsSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid claim data',
        details: validation.error.errors
      });
    }

    const { positionId, transactionHash } = validation.data;

    // Get user handle from active session
    const activeSession = getActiveSession(sessionToken);
    if (!activeSession) {
      return res.status(401).json({ success: false, error: 'Invalid session' });
    }

    const userHandle = activeSession.handle;

    // Get position and verify ownership
    const [position] = await db
      .select()
      .from(stakingPositions)
      .where(
        and(
          eq(stakingPositions.id, positionId),
          eq(stakingPositions.userHandle, userHandle),
          eq(stakingPositions.status, 'active')
        )
      );

    if (!position) {
      return res.status(404).json({
        success: false,
        error: 'Staking position not found'
      });
    }

    const pendingRewards = parseFloat(position.pendingRewards);
    if (pendingRewards <= 0) {
      return res.status(400).json({
        success: false,
        error: 'No rewards available to claim'
      });
    }

    // Reset pending rewards
    await db
      .update(stakingPositions)
      .set({ 
        pendingRewards: '0',
        rewardDebt: (parseFloat(position.rewardDebt) + pendingRewards).toString()
       } as any)
      .where(eq(stakingPositions.id, positionId));

    console.log(`✅ [STAKING CLAIM] Claimed rewards: ${pendingRewards} for position ${positionId}`);
    res.json({
      success: true,
      message: 'Rewards claimed successfully',
      rewardAmount: pendingRewards.toString()
    });

  } catch (error) {
    console.error('❌ [STAKING CLAIM] Error claiming rewards:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to claim rewards'
    });
  }
});

// GET /api/staking/stats - Get overall staking statistics
router.get('/stats', async (req, res) => {
  try {
    console.log('📊 [STAKING STATS] Fetching staking statistics');

    // Get total value locked across all chains
    const [tvlStats] = await db
      .select({
        totalPools: sql<number>`count(*)`,
        totalValueLocked: sum(stakingPools.totalStaked).as('totalValueLocked')
      })
      .from(stakingPools)
      .where(eq(stakingPools.isActive, true));

    // Get active positions count
    const [positionsStats] = await db
      .select({
        totalPositions: sql<number>`count(*)`,
        uniqueStakers: sql<number>`count(distinct ${stakingPositions.userHandle})`
      })
      .from(stakingPositions)
      .where(eq(stakingPositions.status, 'active'));

    // Get rewards distributed in the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [rewardsStats] = await db
      .select({
        totalRewards: sum(feeLedger.feeUsdValue).as('totalRewards')
      })
      .from(feeLedger)
      .where(
        and(
          eq(feeLedger.distributedToStaking, true),
          sql`${feeLedger.createdAt} >= ${thirtyDaysAgo}`
        )
      );

    const stats = {
      totalPools: tvlStats?.totalPools || 0,
      totalValueLocked: tvlStats?.totalValueLocked || '0',
      totalPositions: positionsStats?.totalPositions || 0,
      uniqueStakers: positionsStats?.uniqueStakers || 0,
      monthlyRewardsUSD: rewardsStats?.totalRewards || '0'
    };

    console.log('✅ [STAKING STATS] Retrieved statistics');
    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('❌ [STAKING STATS] Error fetching statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch staking statistics'
    });
  }
});

export default router;