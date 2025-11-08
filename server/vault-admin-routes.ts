/**
 * Vault Admin Routes - Management and analytics dashboard
 * For RiddleSwap administrators to monitor and manage the vault system
 */

import { Router } from 'express';
import { db } from './db';
import { vaultContributions, vaultRewards, vaultChainStats } from '../shared/schema';
import { eq, and, desc, sum, sql, gte, lte, inArray } from 'drizzle-orm';
import { requireAuthentication } from './middleware/session-auth';
import { triggerManualRewardsCalculation } from './vault-rewards-calculator';

const router = Router();

// Admin authentication middleware - PRODUCTION SECURITY
const requireAdmin = async (req: any, res: any, next: any) => {
  const userHandle = req.session?.userHandle;
  
  if (!userHandle) {
    return res.status(403).json({
      success: false,
      error: 'Authentication required'
    });
  }
  
  // PRODUCTION: Only dippydoge has admin access to vault management
  const ADMIN_USERS = ['dippydoge'];
  
  if (!ADMIN_USERS.includes(userHandle.toLowerCase())) {
    console.log(`⚠️ [VAULT ADMIN] Unauthorized access attempt by: ${userHandle}`);
    return res.status(403).json({
      success: false,
      error: 'Vault admin access denied. This incident has been logged.'
    });
  }
  
  console.log(`✅ [VAULT ADMIN] Authorized admin access: ${userHandle}`);
  next();
};

/**
 * GET /api/vault/admin/dashboard
 * Get comprehensive vault analytics
 */
router.get('/dashboard', requireAuthentication, requireAdmin, async (req, res) => {
  try {
    // Get all chain stats
    const chains = await db
      .select()
      .from(vaultChainStats)
      .orderBy(desc(vaultChainStats.total_liquidity_usd));

    // Get total contributions
    const [totalStats] = await db
      .select({
        totalContributions: sql<number>`count(*)`,
        totalVerified: sql<number>`count(*) filter (where status = 'verified')`,
        totalPending: sql<number>`count(*) filter (where status = 'pending')`
      })
      .from(vaultContributions);

    // Get recent contributions
    const recentContributions = await db
      .select()
      .from(vaultContributions)
      .orderBy(desc(vaultContributions.created_at))
      .limit(20);

    // Get wallet type breakdown
    const walletTypeStats = await db
      .select({
        walletType: vaultContributions.wallet_type,
        count: sql<number>`count(*)`,
        totalAmount: sum(vaultContributions.amount_usd)
      })
      .from(vaultContributions)
      .where(eq(vaultContributions.status, 'verified'))
      .groupBy(vaultContributions.wallet_type);

    // Calculate total liquidity across all chains
    const [liquidityTotals] = await db
      .select({
        totalLiquidityUsd: sum(vaultChainStats.total_liquidity_usd),
        totalContributors: sum(vaultChainStats.active_contributors)
      })
      .from(vaultChainStats)
      .where(eq(vaultChainStats.is_active, true));

    res.json({
      success: true,
      dashboard: {
        totalLiquidityUsd: liquidityTotals.totalLiquidityUsd || '0',
        totalContributors: liquidityTotals.totalContributors || 0,
        totalContributions: totalStats.totalContributions || 0,
        verifiedContributions: totalStats.totalVerified || 0,
        pendingContributions: totalStats.totalPending || 0,
        chains,
        recentContributions: recentContributions.map(c => ({
          id: c.id,
          userHandle: c.user_handle,
          walletAddress: c.wallet_address,
          walletType: c.wallet_type,
          chain: c.chain,
          nativeToken: c.native_token,
          amount: c.amount,
          amountUsd: c.amount_usd,
          status: c.status,
          depositTxHash: c.deposit_tx_hash,
          memo: c.memo,
          createdAt: c.created_at
        })),
        walletTypeBreakdown: walletTypeStats
      }
    });
  } catch (error: any) {
    console.error('❌ [VAULT ADMIN] Error fetching dashboard:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/vault/admin/contributions
 * Get all contributions with filters
 */
router.get('/contributions', requireAuthentication, requireAdmin, async (req, res) => {
  try {
    const { status, chain, walletType, limit = 100 } = req.query;
    
    // Apply filters
    const conditions: any[] = [];
    if (status) conditions.push(eq(vaultContributions.status, status as string));
    if (chain) conditions.push(eq(vaultContributions.chain, chain as string));
    if (walletType) conditions.push(eq(vaultContributions.wallet_type, walletType as string));
    
    const contributions = await db
      .select()
      .from(vaultContributions)
      .where(conditions.length > 0 ? and(...conditions) : undefined as any)
      .orderBy(desc(vaultContributions.created_at))
      .limit(parseInt(limit as string));

    res.json({
      success: true,
      contributions
    });
  } catch (error: any) {
    console.error('❌ [VAULT ADMIN] Error fetching contributions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/vault/admin/update-apy
 * Update APY for a specific chain or all chains
 */
router.post('/update-apy', requireAuthentication, requireAdmin, async (req, res) => {
  try {
    const { chain, apy } = req.body;
    
    if (!apy || parseFloat(apy) < 0 || parseFloat(apy) > 100) {
      return res.status(400).json({
        success: false,
        error: 'Invalid APY. Must be between 0 and 100'
      });
    }

    if (chain) {
      // Update specific chain
      await db
        .update(vaultChainStats)
        .set({ 
          current_apy: apy,
          updated_at: new Date()
         } as any)
        .where(eq(vaultChainStats.chain, chain));
      
      console.log(`✅ [VAULT ADMIN] Updated APY for ${chain} to ${apy}%`);
    } else {
      // Update all chains
      await db
        .update(vaultChainStats)
        .set({ 
          current_apy: apy,
          updated_at: new Date()
         } as any);
      
      console.log(`✅ [VAULT ADMIN] Updated APY for all chains to ${apy}%`);
    }

    res.json({
      success: true,
      message: chain 
        ? `APY updated for ${chain} to ${apy}%`
        : `APY updated for all chains to ${apy}%`
    });
  } catch (error: any) {
    console.error('❌ [VAULT ADMIN] Error updating APY:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/vault/admin/toggle-chain
 * Enable or disable a chain
 */
router.post('/toggle-chain', requireAuthentication, requireAdmin, async (req, res) => {
  try {
    const { chain, isActive } = req.body;
    
    if (!chain) {
      return res.status(400).json({
        success: false,
        error: 'Chain is required'
      });
    }

    await db
      .update(vaultChainStats)
      .set({ 
        is_active: isActive,
        updated_at: new Date()
       } as any)
      .where(eq(vaultChainStats.chain, chain));

    console.log(`✅ [VAULT ADMIN] ${isActive ? 'Enabled' : 'Disabled'} chain: ${chain}`);

    res.json({
      success: true,
      message: `Chain ${chain} ${isActive ? 'enabled' : 'disabled'}`
    });
  } catch (error: any) {
    console.error('❌ [VAULT ADMIN] Error toggling chain:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/vault/admin/set-bank-wallet
 * Set or update bank wallet address for a chain (SECURITY CRITICAL)
 */
router.post('/set-bank-wallet', requireAuthentication, requireAdmin, async (req, res) => {
  try {
    const { chain, bankWalletAddress } = req.body;
    
    if (!chain || !bankWalletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Chain and bankWalletAddress are required'
      });
    }

    // Validate address format based on chain type
    const validation = validateBankWalletAddress(chain, bankWalletAddress);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error
      });
    }

    // Check if chain exists
    const [existingChain] = await db
      .select()
      .from(vaultChainStats)
      .where(eq(vaultChainStats.chain, chain))
      .limit(1);

    if (!existingChain) {
      return res.status(404).json({
        success: false,
        error: `Chain ${chain} not found. Initialize chains first.`
      });
    }

    // Update bank wallet address
    await db
      .update(vaultChainStats)
      .set({ 
        bank_wallet_address: bankWalletAddress,
        is_active: true, // Activate chain once bank wallet is configured
        updated_at: new Date()
       } as any)
      .where(eq(vaultChainStats.chain, chain));

    console.log(`✅ [VAULT ADMIN] Set bank wallet for ${chain}: ${bankWalletAddress}`);

    res.json({
      success: true,
      message: `Bank wallet configured for ${chain}. Chain is now active.`,
      chain: {
        chain: chain,
        bankWalletAddress: bankWalletAddress,
        nativeToken: existingChain.native_token,
        isActive: true
      }
    });
  } catch (error: any) {
    console.error('❌ [VAULT ADMIN] Error setting bank wallet:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/vault/admin/batch-set-wallets
 * Set multiple bank wallet addresses at once
 */
router.post('/batch-set-wallets', requireAuthentication, requireAdmin, async (req, res) => {
  try {
    const { wallets } = req.body; // Array of { chain, bankWalletAddress }
    
    if (!wallets || !Array.isArray(wallets) || wallets.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'wallets array is required (format: [{chain, bankWalletAddress}])'
      });
    }

    const results = {
      success: [] as any[],
      failed: [] as any[]
    };

    for (const wallet of wallets) {
      const { chain, bankWalletAddress } = wallet;
      
      // Validate
      const validation = validateBankWalletAddress(chain, bankWalletAddress);
      if (!validation.valid) {
        results.failed.push({
          chain,
          error: validation.error
        });
        continue;
      }

      // Update
      try {
        await db
          .update(vaultChainStats)
          .set({ 
            bank_wallet_address: bankWalletAddress,
            is_active: true,
            updated_at: new Date()
           } as any)
          .where(eq(vaultChainStats.chain, chain));

        results.success.push({
          chain,
          bankWalletAddress
        });

        console.log(`✅ [VAULT ADMIN] Batch set wallet for ${chain}: ${bankWalletAddress}`);
      } catch (error: any) {
        results.failed.push({
          chain,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      results: {
        total: wallets.length,
        successful: results.success.length,
        failed: results.failed.length,
        details: results
      }
    });
  } catch (error: any) {
    console.error('❌ [VAULT ADMIN] Error batch setting wallets:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/vault/admin/unconfigured-chains
 * Get list of chains that don't have bank wallet addresses configured
 */
router.get('/unconfigured-chains', requireAuthentication, requireAdmin, async (req, res) => {
  try {
    const unconfigured = await db
      .select()
      .from(vaultChainStats)
      .where(sql`${vaultChainStats.bank_wallet_address} IS NULL`);

    res.json({
      success: true,
      unconfigured: unconfigured.map(c => ({
        chain: c.chain,
        nativeToken: c.native_token,
        minDeposit: c.min_deposit,
        currentApy: c.current_apy,
        isActive: c.is_active
      })),
      count: unconfigured.length,
      message: unconfigured.length > 0 
        ? `${unconfigured.length} chain(s) need bank wallet configuration`
        : 'All chains are configured!'
    });
  } catch (error: any) {
    console.error('❌ [VAULT ADMIN] Error fetching unconfigured chains:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Helper function to validate bank wallet addresses by chain type
 */
function validateBankWalletAddress(chain: string, address: string): { valid: boolean; error?: string } {
  const trimmedAddress = address.trim();
  
  // EVM chains (Ethereum, BSC, Polygon, etc.)
  const evmChains = ['ethereum', 'bsc', 'polygon', 'arbitrum', 'optimism', 'base', 
                     'avalanche', 'fantom', 'cronos', 'gnosis', 'celo', 'moonbeam', 
                     'zksync', 'linea'];
  
  if (evmChains.includes(chain.toLowerCase())) {
    // EVM address validation: 0x + 40 hex characters
    if (!/^0x[a-fA-F0-9]{40}$/.test(trimmedAddress)) {
      return {
        valid: false,
        error: `Invalid EVM address format for ${chain}. Must be 0x followed by 40 hex characters.`
      };
    }
    return { valid: true };
  }
  
  // XRPL validation
  if (chain.toLowerCase() === 'xrpl') {
    // XRPL Classic Address starts with 'r' and is 25-35 characters
    if (!/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(trimmedAddress)) {
      return {
        valid: false,
        error: 'Invalid XRPL address format. Must start with "r" and be 25-35 characters.'
      };
    }
    return { valid: true };
  }
  
  // Solana validation
  if (chain.toLowerCase() === 'solana') {
    // Solana address is base58, typically 32-44 characters
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmedAddress)) {
      return {
        valid: false,
        error: 'Invalid Solana address format. Must be 32-44 base58 characters.'
      };
    }
    return { valid: true };
  }
  
  // Bitcoin validation
  if (chain.toLowerCase() === 'bitcoin') {
    // Bitcoin: Legacy (1...), SegWit (3...), or Bech32 (bc1...)
    if (!/^(1|3|bc1)[a-zA-HJ-NP-Z0-9]{25,62}$/.test(trimmedAddress)) {
      return {
        valid: false,
        error: 'Invalid Bitcoin address format. Must start with 1, 3, or bc1.'
      };
    }
    return { valid: true };
  }
  
  // Unknown chain
  return {
    valid: false,
    error: `Unknown chain type: ${chain}. Cannot validate address format.`
  };
}

/**
 * GET /api/vault/admin/analytics
 * Get detailed analytics with date ranges
 */
router.get('/analytics', requireAuthentication, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Build date filter
    const conditions: any[] = [eq(vaultContributions.status, 'verified')];
    if (startDate) conditions.push(gte(vaultContributions.created_at, new Date(startDate as string)));
    if (endDate) conditions.push(lte(vaultContributions.created_at, new Date(endDate as string)));

    // Get contributions by chain
    const chainBreakdown = await db
      .select({
        chain: vaultContributions.chain,
        nativeToken: vaultContributions.native_token,
        totalDeposits: sql<number>`count(*)`,
        totalAmount: sum(vaultContributions.amount_usd),
        totalRewards: sum(vaultContributions.rewards_earned_usd)
      })
      .from(vaultContributions)
      .where(and(...conditions))
      .groupBy(vaultContributions.chain, vaultContributions.native_token);

    // Get contributions by wallet type
    const walletBreakdown = await db
      .select({
        walletType: vaultContributions.wallet_type,
        totalDeposits: sql<number>`count(*)`,
        totalAmount: sum(vaultContributions.amount_usd)
      })
      .from(vaultContributions)
      .where(and(...conditions))
      .groupBy(vaultContributions.wallet_type);

    // Get top contributors
    const topContributors = await db
      .select({
        userHandle: vaultContributions.user_handle,
        totalDeposits: sql<number>`count(*)`,
        totalAmount: sum(vaultContributions.amount_usd),
        totalRewards: sum(vaultContributions.rewards_earned_usd)
      })
      .from(vaultContributions)
      .where(and(...conditions))
      .groupBy(vaultContributions.user_handle)
      .orderBy(desc(sql`sum(${vaultContributions.amount_usd})`))
      .limit(10);

    res.json({
      success: true,
      analytics: {
        chainBreakdown,
        walletBreakdown,
        topContributors
      }
    });
  } catch (error: any) {
    console.error('❌ [VAULT ADMIN] Error fetching analytics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/vault/admin/rewards
 * Get all rewards with claim status (ADMIN ONLY)
 */
router.get('/rewards', requireAuthentication, requireAdmin, async (req: any, res) => {
  try {
    const { claim_status, chain, user_handle } = req.query;
    
    const conditions = [];
    if (claim_status) {
      conditions.push(eq(vaultRewards.claim_status, claim_status));
    }
    if (chain) {
      conditions.push(eq(vaultRewards.chain, chain));
    }
    if (user_handle) {
      conditions.push(eq(vaultRewards.user_handle, user_handle));
    }

    const rewards = await db
      .select()
      .from(vaultRewards)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(vaultRewards.calculated_at))
      .limit(500);

    // Get summary stats
    const summary = await db
      .select({
        claim_status: vaultRewards.claim_status,
        count: sql<number>`count(*)`,
        total_amount: sum(vaultRewards.reward_amount),
        total_amount_usd: sum(vaultRewards.reward_amount_usd)
      })
      .from(vaultRewards)
      .groupBy(vaultRewards.claim_status);

    res.json({
      success: true,
      rewards,
      summary
    });
  } catch (error: any) {
    console.error('❌ [VAULT ADMIN] Error fetching rewards:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/vault/admin/rewards/manual-claim
 * Manually mark rewards as claimed (ADMIN ONLY - for manual payouts)
 */
router.post('/rewards/manual-claim', requireAuthentication, requireAdmin, async (req: any, res) => {
  try {
    const { reward_ids, tx_hash, wallet_address, wallet_type, notes } = req.body;

    if (!reward_ids || !Array.isArray(reward_ids)) {
      return res.status(400).json({
        success: false,
        error: 'reward_ids array is required'
      });
    }

    const updated = await db
      .update(vaultRewards)
      .set({ 
        claim_status: 'withdrawn',
        claimed_at: new Date(),
        claim_tx_hash: tx_hash || null,
        withdrawal_wallet_address: wallet_address || null,
        withdrawal_wallet_type: wallet_type || null
       } as any)
      .where(inArray(vaultRewards.id, reward_ids))
      .returning();

    console.log(`✅ [VAULT ADMIN] Admin manually claimed ${updated.length} rewards`);

    res.json({
      success: true,
      message: `Successfully claimed ${updated.length} rewards`,
      updated_rewards: updated
    });
  } catch (error: any) {
    console.error('❌ [VAULT ADMIN] Error manually claiming rewards:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/vault/admin/calculate-rewards
 * Manually trigger rewards calculation (normally runs hourly automatically)
 */
router.post('/calculate-rewards', requireAuthentication, requireAdmin, async (req, res) => {
  try {
    console.log('🔧 [VAULT ADMIN] Manual rewards calculation triggered');
    
    const result = await triggerManualRewardsCalculation();
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Rewards calculation completed successfully',
        processed: result.processed
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Rewards calculation failed'
      });
    }
  } catch (error: any) {
    console.error('❌ [VAULT ADMIN] Error triggering rewards calculation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
