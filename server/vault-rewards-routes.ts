/**
 * Vault Rewards Claim System
 * Handles reward claiming, withdrawal tracking, and admin management
 */

import { Router } from 'express';
import { db } from './db';
import { vaultRewards, vaultContributions } from '../shared/schema';
import { eq, and, sql, desc, inArray } from 'drizzle-orm';
import { requireAuthentication } from './middleware/session-auth';

const router = Router();

/**
 * GET /api/vault/rewards/my-rewards
 * Get user's claimable and claimed rewards
 */
router.get('/my-rewards', requireAuthentication, async (req: any, res) => {
  try {
    const userHandle = req.session.userHandle;

    const rewards = await db
      .select({
        id: vaultRewards.id,
        contribution_id: vaultRewards.contribution_id,
        chain: vaultRewards.chain,
        reward_amount: vaultRewards.reward_amount,
        reward_amount_usd: vaultRewards.reward_amount_usd,
        period_start: vaultRewards.period_start,
        period_end: vaultRewards.period_end,
        apy_applied: vaultRewards.apy_applied,
        claim_status: vaultRewards.claim_status,
        claimed_at: vaultRewards.claimed_at,
        claim_tx_hash: vaultRewards.claim_tx_hash,
        withdrawal_wallet_address: vaultRewards.withdrawal_wallet_address,
        withdrawal_wallet_type: vaultRewards.withdrawal_wallet_type,
        calculated_at: vaultRewards.calculated_at,
      })
      .from(vaultRewards)
      .where(eq(vaultRewards.user_handle, userHandle))
      .orderBy(desc(vaultRewards.calculated_at));

    // Aggregate by chain and status
    const aggregated = rewards.reduce((acc: any, reward: any) => {
      const key = `${reward.chain}_${reward.claim_status}`;
      if (!acc[key]) {
        acc[key] = {
          chain: reward.chain,
          claim_status: reward.claim_status,
          total_amount: '0',
          total_amount_usd: '0',
          count: 0,
          rewards: []
        };
      }
      
      acc[key].total_amount = (parseFloat(acc[key].total_amount) + parseFloat(reward.reward_amount || '0')).toString();
      acc[key].total_amount_usd = (parseFloat(acc[key].total_amount_usd) + parseFloat(reward.reward_amount_usd || '0')).toString();
      acc[key].count++;
      acc[key].rewards.push(reward);
      
      return acc;
    }, {});

    res.json({
      success: true,
      rewards,
      aggregated: Object.values(aggregated as any),
      summary: {
        total_pending: rewards.filter((r: any) => r.claim_status === 'pending').length,
        total_claimed: rewards.filter((r: any) => r.claim_status === 'claimed').length,
        total_withdrawn: rewards.filter((r: any) => r.claim_status === 'withdrawn').length,
      }
    });
  } catch (error: any) {
    console.error('❌ Error fetching user rewards:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/vault/rewards/claim
 * Mark rewards as claimed (does not send funds, just tracks the claim)
 */
router.post('/claim', requireAuthentication, async (req: any, res) => {
  try {
    const userHandle = req.session.userHandle;
    const { reward_ids, wallet_address, wallet_type } = req.body;

    if (!reward_ids || !Array.isArray(reward_ids) || reward_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'reward_ids array is required'
      });
    }

    // Verify all rewards belong to this user and are pending
    const rewardsToCheck = await db
      .select()
      .from(vaultRewards)
      .where(
        and(
          eq(vaultRewards.user_handle, userHandle),
          inArray(vaultRewards.id, reward_ids)
        )
      );

    if (rewardsToCheck.length !== reward_ids.length) {
      return res.status(403).json({
        success: false,
        error: 'Some rewards not found or do not belong to you'
      });
    }

    const notPending = rewardsToCheck.filter(r => r.claim_status !== 'pending');
    if (notPending.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Some rewards have already been claimed'
      });
    }

    // Update rewards to claimed status
    const updated = await db
      .update(vaultRewards)
      .set({ 
        claim_status: 'claimed',
        claimed_at: new Date(),
        withdrawal_wallet_address: wallet_address || null,
        withdrawal_wallet_type: wallet_type || null,
       } as any)
      .where(
        and(
          eq(vaultRewards.user_handle, userHandle),
          inArray(vaultRewards.id, reward_ids)
        )
      )
      .returning();

    console.log(`✅ User ${userHandle} claimed ${updated.length} rewards`);

    res.json({
      success: true,
      message: `Successfully claimed ${updated.length} rewards`,
      claimed_rewards: updated
    });
  } catch (error: any) {
    console.error('❌ Error claiming rewards:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/vault/rewards/withdraw
 * Mark rewards as withdrawn and record transaction hash
 */
router.post('/withdraw', requireAuthentication, async (req: any, res) => {
  try {
    const userHandle = req.session.userHandle;
    const { reward_ids, tx_hash, wallet_address, wallet_type } = req.body;

    if (!reward_ids || !Array.isArray(reward_ids) || reward_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'reward_ids array is required'
      });
    }

    if (!tx_hash) {
      return res.status(400).json({
        success: false,
        error: 'tx_hash is required for withdrawal'
      });
    }

    // Verify all rewards belong to this user
    const rewardsToCheck = await db
      .select()
      .from(vaultRewards)
      .where(
        and(
          eq(vaultRewards.user_handle, userHandle),
          inArray(vaultRewards.id, reward_ids)
        )
      );

    if (rewardsToCheck.length !== reward_ids.length) {
      return res.status(403).json({
        success: false,
        error: 'Some rewards not found or do not belong to you'
      });
    }

    // Update rewards to withdrawn status
    const updated = await db
      .update(vaultRewards)
      .set({ 
        claim_status: 'withdrawn',
        claimed_at: new Date(),
        claim_tx_hash: tx_hash,
        withdrawal_wallet_address: wallet_address || null,
        withdrawal_wallet_type: wallet_type || null,
       } as any)
      .where(
        and(
          eq(vaultRewards.user_handle, userHandle),
          inArray(vaultRewards.id, reward_ids)
        )
      )
      .returning();

    console.log(`✅ User ${userHandle} withdrew ${updated.length} rewards (tx: ${tx_hash})`);

    res.json({
      success: true,
      message: `Successfully recorded withdrawal of ${updated.length} rewards`,
      withdrawn_rewards: updated
    });
  } catch (error: any) {
    console.error('❌ Error withdrawing rewards:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/vault/rewards/summary
 * Get summary of user's rewards by status
 */
router.get('/summary', requireAuthentication, async (req: any, res) => {
  try {
    const userHandle = req.session.userHandle;

    const summary = await db
      .select({
        claim_status: vaultRewards.claim_status,
        chain: vaultRewards.chain,
        total_amount: sql<string>`SUM(${vaultRewards.reward_amount})`,
        total_amount_usd: sql<string>`SUM(${vaultRewards.reward_amount_usd})`,
        count: sql<number>`COUNT(*)`,
      })
      .from(vaultRewards)
      .where(eq(vaultRewards.user_handle, userHandle))
      .groupBy(vaultRewards.claim_status, vaultRewards.chain);

    res.json({
      success: true,
      summary
    });
  } catch (error: any) {
    console.error('❌ Error fetching rewards summary:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
