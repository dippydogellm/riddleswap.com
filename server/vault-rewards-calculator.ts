/**
 * Vault Rewards Calculator
 * Automatically calculates and distributes rewards based on APY and time
 * Runs hourly to calculate rewards for all active vault contributions
 */

import cron from 'node-cron';
import { db } from './db';
import { vaultContributions, vaultRewards, vaultChainStats } from '../shared/schema';
import { eq, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

/**
 * Calculate rewards for a single contribution period using COMPOUND INTEREST
 * @param contributionAmount The contribution amount
 * @param apyPercent Annual percentage yield
 * @param hoursElapsed Number of hours since last calculation
 * @returns Reward amount for the period
 */
function calculateHourlyReward(
  contributionAmount: string,
  apyPercent: string,
  hoursElapsed: number
): string {
  const amount = parseFloat(contributionAmount);
  const apy = parseFloat(apyPercent);
  
  // Validate inputs are finite and non-negative
  if (!isFinite(amount) || amount < 0 || !isFinite(apy) || apy < 0 || !isFinite(hoursElapsed) || hoursElapsed < 0) {
    console.error('❌ [VAULT REWARDS] Invalid input:', { contributionAmount, apyPercent, hoursElapsed });
    return '0';
  }
  
  // Calculate hourly rate: APY / (365 days * 24 hours)
  const hourlyRate = apy / 100 / (365 * 24);
  
  // Calculate reward using COMPOUND INTEREST formula: amount * ((1 + rate)^hours - 1)
  // This ensures proper compounding over time
  const reward = amount * (Math.pow(1 + hourlyRate, hoursElapsed) - 1);
  
  return reward.toFixed(18); // Return with 18 decimal precision
}

/**
 * Process rewards for all active vault contributions
 */
export async function processVaultRewards() {
  console.log('🏦 [VAULT REWARDS] Starting rewards calculation...');
  
  const now = new Date();
  let totalProcessed = 0;
  let totalRewardsCalculated = 0;
  
  try {
    // Get all verified contributions
    const contributions = await db
      .select()
      .from(vaultContributions)
      .where(eq(vaultContributions.status, 'verified'));

    console.log(`📊 [VAULT REWARDS] Found ${contributions.length} verified contributions`);

    for (const contribution of contributions) {
      try {
        // Get chain stats for current APY
        const [chainStats] = await db
          .select()
          .from(vaultChainStats)
          .where(eq(vaultChainStats.chain, contribution.chain))
          .limit(1);

        if (!chainStats) {
          console.error(`❌ [VAULT REWARDS] Chain stats not found for: ${contribution.chain}`);
          continue;
        }

        // Calculate time since last reward or since verified
        const lastCalculationTime = contribution.last_reward_calculation || contribution.verified_at;
        
        if (!lastCalculationTime) {
          console.error(`❌ [VAULT REWARDS] No verification time for contribution: ${contribution.id}`);
          continue;
        }

        const hoursSinceLastCalculation = (now.getTime() - new Date(lastCalculationTime).getTime()) / (1000 * 60 * 60);

        // Only calculate if at least 1 hour has passed
        if (hoursSinceLastCalculation < 1) {
          continue;
        }

        // Calculate reward
        const rewardAmount = calculateHourlyReward(
          contribution.amount,
          chainStats.current_apy,
          hoursSinceLastCalculation
        );

        // Skip if reward is negligible
        if (parseFloat(rewardAmount) < 0.000001) {
          continue;
        }

        // Create reward record
        await db.insert(vaultRewards).values({
          contribution_id: contribution.id,
          user_handle: contribution.user_handle,
          chain: contribution.chain,
          reward_amount: rewardAmount,
          period_start: lastCalculationTime,
          period_end: now,
          apy_applied: chainStats.current_apy,
          claim_status: 'pending',
          calculated_at: now
        } as any as any);

        // Update contribution with accumulated rewards
        const currentRewards = parseFloat(contribution.rewards_earned || '0');
        const newTotalRewards = (currentRewards + parseFloat(rewardAmount)).toFixed(18);

        await db
          .update(vaultContributions)
          .set({
            rewards_earned: newTotalRewards,
            last_reward_calculation: now,
            updated_at: now
          } as any)
          .where(eq(vaultContributions.id, contribution.id));

        totalProcessed++;
        totalRewardsCalculated += parseFloat(rewardAmount);

        console.log(`✅ [VAULT REWARDS] ${contribution.user_handle}: +${rewardAmount} ${contribution.native_token} (${hoursSinceLastCalculation.toFixed(2)} hours)`);

      } catch (error: any) {
        console.error(`❌ [VAULT REWARDS] Error processing contribution ${contribution.id}:`, error.message);
      }
    }

    console.log(`🎉 [VAULT REWARDS] Completed! Processed ${totalProcessed} contributions, total rewards: ${totalRewardsCalculated.toFixed(6)}`);

  } catch (error: any) {
    console.error('❌ [VAULT REWARDS] Calculation error:', error);
  }
}

/**
 * Initialize the hourly rewards calculator
 * DISABLED in development to prevent RAM hammering
 */
export function initializeVaultRewardsScheduler() {
  // Skip vault rewards in development mode to prevent RAM issues
  if (process.env.NODE_ENV === 'development') {
    console.log('⏰ [VAULT REWARDS] Skipping vault rewards in development mode');
    console.log('💡 [VAULT REWARDS] Enable in production with NODE_ENV=production');
    return null;
  }

  console.log('⏰ [VAULT REWARDS] Initializing hourly rewards calculator...');
  
  // Run every hour at minute 0
  const scheduler = cron.schedule('0 * * * *', async () => {
    console.log('⏰ [VAULT REWARDS] Hourly rewards calculation triggered');
    await processVaultRewards();
  });

  // Run immediately on startup
  console.log('🚀 [VAULT REWARDS] Running initial rewards calculation...');
  processVaultRewards().then(() => {
    console.log('✅ [VAULT REWARDS] Initial calculation complete');
  }).catch((error) => {
    console.error('❌ [VAULT REWARDS] Initial calculation failed:', error);
  });

  console.log('✅ [VAULT REWARDS] Scheduler initialized - will run every hour');
  
  return scheduler;
}

/**
 * Manual trigger for admin to force rewards calculation
 */
export async function triggerManualRewardsCalculation(): Promise<{
  success: boolean;
  processed: number;
  error?: string;
}> {
  try {
    console.log('🔧 [VAULT REWARDS] Manual calculation triggered by admin');
    await processVaultRewards();
    
    return {
      success: true,
      processed: 0 // TODO: Return actual count
    };
  } catch (error: any) {
    console.error('❌ [VAULT REWARDS] Manual calculation failed:', error);
    return {
      success: false,
      processed: 0,
      error: error.message
    };
  }
}
