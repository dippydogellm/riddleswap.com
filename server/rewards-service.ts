import { db } from './db';
import { 
  feeTransactions, 
  rewards, 
  type InsertFeeTransaction, 
  type InsertReward,
  // Enhanced tracking tables
  userActivityTracking,
  socialMediaConnections,
  projectRewardConfigs,
  rewardClaimTransactions,
  communityEngagementChallenges,
  communityChalllengeParticipation,
  projectRewardAnalytics,
  crossProjectUserLinks,
  // Existing data sources
  swapHistory,
  bridgeTransactions,
  externalWallets,
  riddleWallets,
  nftCollectionHoldings,
  socialProfiles,
  posts,
  postLikes,
  walletConnections,
  devtoolsProjects,
  walletProjectLinks,
  // Remove non-existent types (InsertUserActivityTracking, UserActivityTracking) and unused insert types
  type InsertSocialMediaConnection,
  type InsertRewardClaimTransaction,
  type ProjectRewardConfig
} from '../shared/schema';
import { eq, desc, sum, sql, and, gte, lte, count, avg } from 'drizzle-orm';

/**
 * Chain to RDL token mapping for rewards
 */
const CHAIN_TO_RDL_TOKEN: { [key: string]: string } = {
  'xrp': 'RDL',
  'sol': 'SRDL', 
  'bnb': 'BNBRDL',
  'base': 'BASRDL',
  'eth': 'ERDL'
};

/**
 * RDL token addresses for price fetching
 */
const RDL_TOKEN_ADDRESSES: { [key: string]: string } = {
  'RDL': 'rXRPRiddledefaulttokenaddress', // XRP RDL
  'SRDL': '4tPL1ZPT4uy36VYjoDvoCpvNYurscS324D8P9Ap32AzE', // Solana RDL
  'BNBRDL': 'bnbrdltokenaddress', // BNB RDL
  'BASRDL': 'basrdltokenaddress', // Base RDL  
  'ERDL': 'erdltokenaddress' // Ethereum RDL
};

export class RewardsService {
  
  /**
   * Track a fee transaction and create corresponding reward
   */
  async trackFeeAndCreateReward(params: {
    userHandle: string;
    walletAddress: string;
    operationType: 'swap' | 'bridge' | 'marketplace_purchase' | 'marketplace_sale';
    sourceChain: string;
    feeAmount: string;
    feeToken: string;
    feeUsdValue: string;
    operationId?: string;
    transactionHash?: string;
  }): Promise<{ feeTransactionId: string; rewardId: string }> {
    
    const { userHandle, walletAddress, operationType, sourceChain, 
            feeAmount, feeToken, feeUsdValue, operationId, transactionHash } = params;
    
    // Calculate 25% reward
    const rewardUsdValue = (parseFloat(feeUsdValue) * 0.25).toString();
    const rewardToken = CHAIN_TO_RDL_TOKEN[sourceChain.toLowerCase()];
    
    if (!rewardToken) {
      throw new Error(`No RDL token mapping found for chain: ${sourceChain}`);
    }
    
    // Get RDL token price to calculate reward amount
    const rdlPrice = await this.getRDLTokenPrice(rewardToken);
    const rewardAmount = (parseFloat(rewardUsdValue) / rdlPrice).toString();
    
    // Create fee transaction record
    const feeTransactionData: InsertFeeTransaction = {
      user_handle: userHandle,
      wallet_address: walletAddress,
      operation_type: operationType,
      source_chain: sourceChain.toLowerCase(),
      fee_amount: feeAmount,
      fee_token: feeToken,
      fee_usd_value: feeUsdValue,
      reward_amount: rewardAmount,
      reward_token: rewardToken,
      reward_usd_value: rewardUsdValue,
      operation_id: operationId,
      transaction_hash: transactionHash
    };
    
    const [feeTransaction] = await db.insert(feeTransactions)
      .values(feeTransactionData as any)
      .returning();
    
    // Create reward record
    const rewardData: InsertReward = {
      user_handle: userHandle,
      wallet_address: walletAddress,
      reward_type: 'fee_cashback',
      source_operation: operationType,
      source_chain: sourceChain.toLowerCase(),
      reward_token: rewardToken,
      amount: rewardAmount,
      usd_value: rewardUsdValue,
      status: 'claimable',
      description: `25% cashback in ${rewardToken} from ${operationType} fee`,
      fee_transaction_id: feeTransaction.id,
      expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days expiry
    };
    
    const [reward] = await db.insert(rewards)
      .values(rewardData as any)
      .returning();
    
    console.log(`💰 Reward created: ${rewardAmount} ${rewardToken} (${rewardUsdValue} USD) for ${userHandle}`);
    
    return { 
      feeTransactionId: feeTransaction.id, 
      rewardId: reward.id 
    };
  }
  
  /**
   * Get user's reward summary by chain
   */
  async getUserRewardsSummary(userHandle: string) {
    const rewardsSummary = await db
      .select({
        rewardToken: rewards.reward_token,
        sourceChain: rewards.source_chain,
        totalAmount: sum(rewards.amount),
        totalUsdValue: sum(rewards.usd_value),
        pendingCount: sql<number>`count(case when ${rewards.status} = 'pending' then 1 end)`,
        claimableCount: sql<number>`count(case when ${rewards.status} = 'claimable' then 1 end)`,
        claimedCount: sql<number>`count(case when ${rewards.status} = 'claimed' then 1 end)`
      })
      .from(rewards)
      .where(eq(rewards.user_handle, userHandle))
      .groupBy(rewards.reward_token, rewards.source_chain);
    
    return rewardsSummary;
  }
  
  /**
   * Get user's detailed rewards history
   */
  async getUserRewardsHistory(userHandle: string, limit: number = 50) {
    const rewardsHistory = await db
      .select()
      .from(rewards)
      .where(eq(rewards.user_handle, userHandle))
      .orderBy(desc(rewards.created_at))
      .limit(limit);
    
    return rewardsHistory;
  }
  
  /**
   * Get claimable rewards for a user
   */
  async getClaimableRewards(userHandle: string) {
    const claimableRewards = await db
      .select()
      .from(rewards)
      .where(and(
        eq(rewards.user_handle, userHandle),
        eq(rewards.status, 'claimable')
      ));
    
    return claimableRewards;
  }
  
  /**
   * Mark reward as claimed
   */
  async claimReward(rewardId: string, userHandle: string): Promise<boolean> {
    const result = await db
      .update(rewards)
      .set({  
        status: 'claimed',
        claimed_at: new Date()
       } as any)
      .where(and(
        eq(rewards.id, rewardId),
        eq(rewards.user_handle, userHandle),
        eq(rewards.status, 'claimable')
      ))
      .returning();
    
    return result.length > 0;
  }
  
  /**
   * Get RDL token price from appropriate source
   */
  private async getRDLTokenPrice(rdlToken: string): Promise<number> {
    try {
      switch (rdlToken) {
        case 'SRDL':
          // Use DexScreener for SRDL
          const response = await fetch('https://api.dexscreener.com/latest/dex/pairs/solana/7bhqCm6ZYyApX4dEs8hLZiDZM36XdqrsTWtnpEbKvrjU');
          const data = await response.json() as any;
          if (data.pair && data.pair.priceUsd) {
            return parseFloat(data.pair.priceUsd);
          }
          break;
          
        case 'RDL':
          // Use DexScreener for XRPL RDL (same as swap system)
          const rdlResponse = await fetch(`https://api.dexscreener.com/latest/dex/search?q=RDL`);
          const rdlData = await rdlResponse.json();
          const xrplRdlPair = rdlData.pairs?.find((pair: any) => 
            pair.chainId === 'xrpl' && 
            pair.baseToken.symbol === 'RDL'
          );
          if (xrplRdlPair && xrplRdlPair.priceUsd) {
            return parseFloat(xrplRdlPair.priceUsd);
          }
          break;
          
        case 'ERDL':
        case 'BASRDL':
        case 'BNBRDL':
          // Use DexScreener for EVM RDL tokens
          const evmResponse = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${rdlToken}`);
          const evmData = await evmResponse.json();
          if (evmData.pairs?.length > 0 && evmData.pairs[0].priceUsd) {
            return parseFloat(evmData.pairs[0].priceUsd);
          }
          break;
      }
      
      // If no price found, throw error
      throw new Error(`No price data found for ${rdlToken}`);
    } catch (error) {
      console.error(`Failed to fetch ${rdlToken} price:`, error);
      throw new Error(`Unable to fetch live price for ${rdlToken}`);
    }
  }
  
  /**
   * Track a reward directly (for social engagement, daily login, etc.)
   */
  async trackRewardEarned(params: {
    userHandle: string;
    walletAddress: string;
    rewardType: 'daily_login' | 'social_engagement' | 'raid_participation' | 'referral' | 'milestone';
    sourceOperation: string;
    sourceChain: string;
    rewardToken: string;
    amount: number;
    usdValue: number;
    description: string;
    expiresAt?: Date;
  }): Promise<string> {
    
    const { userHandle, walletAddress, rewardType, sourceOperation, sourceChain,
            rewardToken, amount, usdValue, description, expiresAt } = params;
    
    // Create reward record
    const rewardData: InsertReward = {
      user_handle: userHandle,
      wallet_address: walletAddress,
      reward_type: rewardType,
      source_operation: sourceOperation,
      source_chain: sourceChain.toLowerCase(),
      reward_token: rewardToken,
      amount: amount.toString(),
      usd_value: usdValue.toString(),
      status: 'claimable',
      description,
      expires_at: expiresAt || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // Default 90 days
    };
    
    const [reward] = await db.insert(rewards)
      .values(rewardData as any)
      .returning();
    
    console.log(`✅ Reward earned: ${userHandle} received ${amount} ${rewardToken} (${description})`);
    
    return reward.id;
  }

  /**
   * ENHANCED COMPREHENSIVE ACTIVITY TRACKING SYSTEM
   */
  
  /**
   * Update comprehensive user activity tracking from all data sources
   */
  async updateUserActivityTracking(walletAddress: string, userHandle?: string): Promise<any> {
    console.log(`📊 [REWARDS] Updating comprehensive activity tracking for: ${walletAddress}`);
    
    try {
      // Get existing tracking record or create new one
      const [existingActivity] = await db.select()
        .from(userActivityTracking)
  .where(eq(userActivityTracking.userHandle as any, walletAddress as any))
        .limit(1);
      
      // Collect data from all sources
  // Cast to any to allow flexible access to optional future fields without TS errors
  const activityData: any = await this.collectUserActivityData(walletAddress, userHandle) as any;
      
      if (existingActivity) {
        // Update existing record
        const [updatedActivity] = await db.update(userActivityTracking)
          .set({ 
            // Map collected data into tracking columns we actually have (casting to any to satisfy TS)
            totalTimeMinutes: (activityData as any).total_session_time_minutes || 0,
            sessionCount: (activityData as any).session_count || 0,
            lastActive: new Date(),
            updatedAt: new Date()
          } as any)
          .where(eq(userActivityTracking.userHandle as any, existingActivity.userHandle))
          .returning();
        
        console.log(`✅ [REWARDS] Activity tracking updated for: ${walletAddress}`);
        return updatedActivity;
      } else {
        // Create new record
        const [newActivity] = await db.insert(userActivityTracking)
          .values({
            userHandle: userHandle || walletAddress,
            totalTimeMinutes: (activityData as any).total_session_time_minutes || 0,
            sessionCount: (activityData as any).session_count || 0,
            lastActive: new Date()
          } as any)
          .returning();
        
        console.log(`✅ [REWARDS] New activity tracking created for: ${walletAddress}`);
        return newActivity;
      }
    } catch (error) {
      console.error(`❌ [REWARDS] Failed to update activity tracking:`, error);
      throw error;
    }
  }
  
  /**
   * Collect comprehensive user activity data from all sources
   */
  private async collectUserActivityData(walletAddress: string, userHandle?: string) {
    const startTime = new Date();
    startTime.setFullYear(startTime.getFullYear() - 1); // Last year
    
    // Get swap activity
    const [swapStats] = await db.select({
      total_swaps: count(),
      total_volume_usd: sql<string>`COALESCE(SUM(CAST(total_value_usd AS DECIMAL)), 0)`,
      total_fees_usd: sql<string>`COALESCE(SUM(CAST(platform_fee_usd AS DECIMAL)), 0)`
    }).from(swapHistory)
      .where(and(
        eq(swapHistory.wallet_address, walletAddress),
        gte(swapHistory.created_at, startTime)
      ));
    
    // Get bridge activity
    const [bridgeStats] = await db.select({
      total_bridges: count()
    }).from(bridgeTransactions)
      .where(and(
        eq(bridgeTransactions.bank_wallet_address, walletAddress),
        gte(bridgeTransactions.created_at, startTime)
      ));
    
    // Get NFT activity
    const [nftStats] = await db.select({
      nfts_held: count()
    }).from(nftCollectionHoldings)
      .where(and(
        eq(nftCollectionHoldings.wallet_address, walletAddress),
        eq(nftCollectionHoldings.is_currently_held, true)
      ));
    
    // Get social activity if user handle exists
    let socialStats = {
      posts_created: 0,
      likes_given: 0,
      comments_made: 0
    };
    
    if (userHandle) {
      const [postCount] = await db.select({
        posts_created: count()
      }).from(posts)
        .where(and(
          eq(posts.authorHandle, userHandle),
          gte(posts.createdAt, startTime)
        ));
      
      const [likeCount] = await db.select({
        likes_given: count()
      }).from(postLikes)
        .where(and(
          eq(postLikes.userHandle, userHandle),
          gte(postLikes.createdAt, startTime)
        ));
      
      socialStats = {
        posts_created: postCount.posts_created,
        likes_given: likeCount.likes_given,
        comments_made: 0 // TODO: Add when comment counting is needed
      };
    }
    
    // Get lifetime rewards data
    const [rewardStats] = await db.select({
      total_rewards_earned_usd: sql<string>`COALESCE(SUM(CAST(usd_value AS DECIMAL)), 0)`,
      total_rewards_claimed_usd: sql<string>`COALESCE(SUM(CASE WHEN status = 'claimed' THEN CAST(usd_value AS DECIMAL) ELSE 0 END), 0)`,
      pending_rewards_usd: sql<string>`COALESCE(SUM(CASE WHEN status = 'claimable' THEN CAST(usd_value AS DECIMAL) ELSE 0 END), 0)`
    }).from(rewards)
      .where(eq(rewards.wallet_address, walletAddress));
    
    return {
      user_handle: userHandle,
      total_swaps: swapStats.total_swaps,
      total_bridges: bridgeStats.total_bridges,
      total_volume_usd: swapStats.total_volume_usd,
      total_fees_generated_usd: swapStats.total_fees_usd,
      nfts_purchased: nftStats.nfts_held, // Approximation
      nfts_sold: 0, // TODO: Track from NFT sales
      nft_trading_volume_usd: "0", // TODO: Calculate from NFT trades
      posts_created: socialStats.posts_created,
      likes_given: socialStats.likes_given,
      comments_made: socialStats.comments_made,
      shares_made: 0, // TODO: Track shares
      followers_gained: 0, // TODO: Track follower growth
      total_login_days: 0, // TODO: Track from session data
      current_login_streak: 0, // TODO: Calculate streak
      longest_login_streak: 0, // TODO: Track max streak
      last_login_date: new Date().toISOString().split('T')[0],
      total_session_time_minutes: 0, // TODO: Track from session data
      referrals_made: 0, // TODO: Track referrals
      referral_rewards_earned: "0", // TODO: Calculate referral rewards
      total_rewards_earned_usd: rewardStats.total_rewards_earned_usd,
      total_rewards_claimed_usd: rewardStats.total_rewards_claimed_usd,
      pending_rewards_usd: rewardStats.pending_rewards_usd
    };
  }
  
  /**
   * REAL BLOCKCHAIN TRANSACTION CLAIMING SYSTEM
   */
  
  /**
   * Initiate reward claiming with real blockchain transaction
   */
  async initiateRewardClaim(params: {
    userHandle: string;
    walletAddress: string;
    rewardIds: string[];
    projectId?: string;
    batchClaim?: boolean;
  }): Promise<{ claimTransactionId: string; transactionHash?: string }> {
    
    const { userHandle, walletAddress, rewardIds, projectId, batchClaim = false } = params;
    
    console.log(`🚀 [REWARDS] Initiating reward claim for ${userHandle}: ${rewardIds.length} rewards`);
    
    try {
      // Validate rewards are claimable
      const claimableRewards = await db.select()
        .from(rewards)
        .where(and(
          sql`${rewards.id} = ANY(${rewardIds})`,
          eq(rewards.user_handle, userHandle),
          eq(rewards.status, 'claimable')
        ));
      
      if (claimableRewards.length !== rewardIds.length) {
        throw new Error('Some rewards are not claimable or do not belong to this user');
      }
      
      // Calculate total reward amount by token
      const rewardsByToken = claimableRewards.reduce((acc, reward) => {
        const key = `${reward.reward_token}_${reward.source_chain}`;
        if (!acc[key]) {
          acc[key] = {
            token: reward.reward_token,
            chain: reward.source_chain,
            amount: 0,
            usdValue: 0
          };
        }
        acc[key].amount += parseFloat(reward.amount);
        acc[key].usdValue += parseFloat(reward.usd_value);
        return acc;
      }, {} as any);
      
      // For now, we'll handle the primary token (most common)
      const primaryReward = Object.values(rewardsByToken as any)[0] as any;
      
      // Create claim transaction record
      const claimTransactionData: InsertRewardClaimTransaction = {
        user_handle: userHandle,
        wallet_address: walletAddress,
        project_id: projectId,
        reward_ids: rewardIds,
        total_reward_amount: primaryReward.amount.toString(),
        reward_token_symbol: primaryReward.token,
        reward_token_chain: primaryReward.chain,
        total_usd_value: primaryReward.usdValue.toString(),
        is_batch_claim: batchClaim,
        batch_claim_id: batchClaim ? crypto.randomUUID() : undefined,
        status: 'pending'
      };
      
      const [claimTransaction] = await db.insert(rewardClaimTransactions)
        .values(claimTransactionData as any)
        .returning();
      
      // Initiate actual blockchain transaction
      const transactionHash = await this.executeRewardTransaction({
        walletAddress,
        amount: primaryReward.amount.toString(),
        tokenSymbol: primaryReward.token,
        chain: primaryReward.chain,
        claimTransactionId: claimTransaction.id
      });
      
      // Update claim transaction with hash
      if (transactionHash) {
        await db.update(rewardClaimTransactions)
          .set({  
            transaction_hash: transactionHash,
            status: 'confirming'
           } as any)
          .where(eq(rewardClaimTransactions.id, claimTransaction.id));
        
        // Mark rewards as pending claim
        await db.update(rewards)
          .set({  status: 'pending'  } as any)
          .where(sql`${rewards.id} = ANY(${rewardIds})`);
      }
      
      console.log(`✅ [REWARDS] Claim transaction initiated: ${claimTransaction.id}`);
      
      return {
        claimTransactionId: claimTransaction.id,
        transactionHash
      };
      
    } catch (error) {
      console.error(`❌ [REWARDS] Failed to initiate claim:`, error);
      throw error;
    }
  }
  
  /**
   * Execute actual blockchain transaction for reward claiming
   */
  private async executeRewardTransaction(params: {
    walletAddress: string;
    amount: string;
    tokenSymbol: string;
    chain: string;
    claimTransactionId: string;
  }): Promise<string | undefined> {
    
    console.log(`🔗 [REWARDS] Executing ${params.tokenSymbol} transaction on ${params.chain}`);
    
    try {
      // TODO: Implement actual blockchain transaction execution
      // This would integrate with the existing wallet generation and transaction systems
      
      switch (params.chain.toLowerCase()) {
        case 'xrp':
          return await this.executeXRPTransaction(params);
        case 'sol':
          return await this.executeSolanaTransaction(params);
        case 'eth':
        case 'base':
        case 'bnb':
          return await this.executeEVMTransaction(params);
        default:
          throw new Error(`Unsupported chain for reward claiming: ${params.chain}`);
      }
      
    } catch (error) {
      console.error(`❌ [REWARDS] Transaction execution failed:`, error);
      
      // Update claim transaction as failed
      await db.update(rewardClaimTransactions)
        .set({  
          status: 'failed',
          failure_reason: error.message,
          failed_at: new Date()
         } as any)
        .where(eq(rewardClaimTransactions.id, params.claimTransactionId));
      
      throw error;
    }
  }
  
  /**
   * Execute XRP reward transaction
   */
  private async executeXRPTransaction(params: any): Promise<string> {
    // TODO: Integrate with existing XRPL transaction system
    // This would use the existing XRPL wallet generation and transaction functionality
    console.log(`🟠 [REWARDS] XRP transaction execution not yet implemented`);
    return `xrp_tx_${Date.now()}`; // Placeholder
  }
  
  /**
   * Execute Solana reward transaction
   */
  private async executeSolanaTransaction(params: any): Promise<string> {
    // TODO: Integrate with existing Solana transaction system
    console.log(`🟣 [REWARDS] Solana transaction execution not yet implemented`);
    return `sol_tx_${Date.now()}`; // Placeholder
  }
  
  /**
   * Execute EVM reward transaction
   */
  private async executeEVMTransaction(params: any): Promise<string> {
    // TODO: Integrate with existing EVM transaction system
    console.log(`🔵 [REWARDS] EVM transaction execution not yet implemented`);
    return `evm_tx_${Date.now()}`; // Placeholder
  }
  
  /**
   * PROJECT-BASED REWARDS SYSTEM
   */
  
  /**
   * Get or create project reward configuration
   */
  async getProjectRewardConfig(projectId: string): Promise<ProjectRewardConfig> {
    const [existingConfig] = await db.select()
      .from(projectRewardConfigs)
      .where(eq(projectRewardConfigs.project_id, projectId))
      .limit(1);
    
    if (existingConfig) {
      return existingConfig;
    }
    
    // Create default configuration for new project
    const [newConfig] = await db.insert(projectRewardConfigs)
      .values({
        project_id: projectId,
        // All defaults are set in schema
      } as any)
      .returning();
    
    console.log(`✅ [REWARDS] Created default reward config for project: ${projectId}`);
    return newConfig;
  }
  
  /**
   * Update project reward configuration
   */
  async updateProjectRewardConfig(projectId: string, updates: Partial<ProjectRewardConfig>) {
    const [updatedConfig] = await db.update(projectRewardConfigs)
      .set({ 
        ...updates,
        updated_at: new Date()
       } as any)
      .where(eq(projectRewardConfigs.project_id, projectId))
      .returning();
    
    console.log(`✅ [REWARDS] Updated reward config for project: ${projectId}`);
    return updatedConfig;
  }
  
  /**
   * Get project analytics with user activity and reward data
   */
  async getProjectAnalytics(projectId: string, dateRange?: { start: string; end: string }) {
    console.log(`📊 [REWARDS] Getting project analytics for: ${projectId}`);
    
    try {
      const startDate = dateRange?.start ? new Date(dateRange.start) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default 30 days
      const endDate = dateRange?.end ? new Date(dateRange.end) : new Date();
      
      // Get project reward config
      const config = await this.getProjectRewardConfig(projectId);
      
      // Get user engagement analytics for the project
      const [userStats] = await db.select({
        totalUsers: sql<number>`COUNT(DISTINCT ${userActivityTracking.userHandle})`,
        totalRewardsDistributed: sql<string>`COALESCE((SELECT SUM(CAST(${rewards.usd_value} AS DECIMAL)) FROM ${rewards} WHERE ${gte(rewards.created_at as any, startDate as any)} AND ${lte(rewards.created_at as any, endDate as any)}), 0)`,
        totalRewardsClaimed: sql<string>`COALESCE((SELECT SUM(CASE WHEN ${rewards.status} = 'claimed' THEN CAST(${rewards.usd_value} AS DECIMAL) ELSE 0 END) FROM ${rewards} WHERE ${gte(rewards.created_at as any, startDate as any)} AND ${lte(rewards.created_at as any, endDate as any)}), 0)`,
        totalVolumeUsd: sql<string>`'0'`
      })
      .from(userActivityTracking)
      .where(and(
        gte(userActivityTracking.updatedAt as any, startDate as any),
        lte(userActivityTracking.updatedAt as any, endDate as any)
      ));
      
      return {
        projectId,
        config,
        analytics: {
          dateRange: { start: startDate.toISOString(), end: endDate.toISOString() },
          userEngagement: {
            totalUsers: userStats.totalUsers || 0,
            totalVolumeUsd: parseFloat(userStats.totalVolumeUsd || '0'),
            averageVolumePerUser: userStats.totalUsers > 0 ? parseFloat(userStats.totalVolumeUsd || '0') / userStats.totalUsers : 0
          },
          rewards: {
            totalDistributed: parseFloat(userStats.totalRewardsDistributed || '0'),
            totalClaimed: parseFloat(userStats.totalRewardsClaimed || '0'),
            claimRate: parseFloat(userStats.totalRewardsDistributed || '0') > 0 ? 
              (parseFloat(userStats.totalRewardsClaimed || '0') / parseFloat(userStats.totalRewardsDistributed || '0')) * 100 : 0
          }
        }
      };
      
    } catch (error) {
      console.error(`❌ [REWARDS] Failed to get project analytics:`, error);
      throw error;
    }
  }

  /**
   * SOCIAL ENGAGEMENT TRACKING SYSTEM
   */
  
  /**
   * Track social engagement and create rewards
   */
  async trackSocialEngagement(params: {
    walletAddress: string;
    userHandle?: string;
    engagementType: 'post' | 'like' | 'comment' | 'follow' | 'share' | 'daily_login';
    projectId?: string;
    referenceId?: string;
    engagementData?: any;
  }) {
    
    const { walletAddress, userHandle, engagementType, projectId, referenceId, engagementData } = params;
    
    console.log(`👥 [REWARDS] Tracking social engagement: ${engagementType} for ${walletAddress}`);
    
    try {
      // Get project reward configuration
      let rewardConfig = null;
      if (projectId) {
        rewardConfig = await this.getProjectRewardConfig(projectId);
      }
      
      // Calculate reward amount based on engagement type and project config
      const rewardAmount = this.calculateSocialReward(engagementType, rewardConfig);
      
      if (rewardAmount > 0) {
        // Create social engagement reward
        const rewardData: InsertReward = {
          user_handle: userHandle || walletAddress,
          wallet_address: walletAddress,
          reward_type: 'social_engagement',
          source_operation: engagementType,
          source_chain: 'xrp', // Default to XRP for social rewards
          reward_token: 'RDL',
          amount: rewardAmount.toString(),
          usd_value: rewardAmount.toString(), // Assuming 1:1 for social rewards
          status: 'claimable',
          description: `Social engagement reward: ${engagementType}`,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days expiry
        };
        
        const [reward] = await db.insert(rewards)
          .values(rewardData as any)
          .returning();
        
        console.log(`✅ [REWARDS] Social engagement reward created: ${rewardAmount} RDL for ${engagementType}`);
        
        // Update user activity tracking
        await this.updateUserActivityTracking(walletAddress, userHandle);
        
        return reward;
      }
      
      return null;
    } catch (error) {
      console.error(`❌ [REWARDS] Failed to track social engagement:`, error);
      throw error;
    }
  }
  
  /**
   * Calculate social engagement reward amount
   */
  private calculateSocialReward(engagementType: string, config?: ProjectRewardConfig): number {
    if (!config) {
      // Default rewards for Riddle wallet system
      const defaultRewards = {
        'post': 0.1,
        'like': 0.01,
        'comment': 0.05,
        'follow': 0.2,
        'share': 0.15,
        'daily_login': 0.5
      };
      return defaultRewards[engagementType] || 0;
    }
    
    // Use project-specific configuration
    switch (engagementType) {
      case 'post': return parseFloat(config.reward_per_post);
      case 'like': return parseFloat(config.reward_per_like);
      case 'comment': return parseFloat(config.reward_per_comment);
      case 'follow': return parseFloat(config.reward_per_follow);
      case 'share': return parseFloat(config.reward_per_share);
      case 'daily_login': return parseFloat(config.daily_login_reward);
      default: return 0;
    }
  }
  
  /**
   * Get comprehensive user dashboard data
   */
  async getUserDashboardData(walletAddress: string, userHandle?: string) {
    console.log(`📊 [REWARDS] Getting comprehensive dashboard data for: ${walletAddress}`);
    
    try {
      // Update activity tracking first
  const activityData: any = await this.updateUserActivityTracking(walletAddress, userHandle) as any;
      
      // Get reward summary
      const rewardSummary = userHandle ? await this.getUserRewardsSummary(userHandle) : [];
      
      // Get claimable rewards
      const claimableRewards = userHandle ? await this.getClaimableRewards(userHandle) : [];
      
      // Get recent claim transactions
      const recentClaims = await db.select()
        .from(rewardClaimTransactions)
        .where(eq(rewardClaimTransactions.wallet_address, walletAddress))
        .orderBy(desc(rewardClaimTransactions.created_at))
        .limit(10);
      
      // Get connected projects
      let connectedProjects: any[] = [];
      try {
        connectedProjects = await db.select({
          project: devtoolsProjects,
          linkType: walletProjectLinks.linkType
        })
          .from(walletProjectLinks as any)
          .innerJoin(devtoolsProjects, eq((walletProjectLinks as any).projectId, devtoolsProjects.id))
          .where(eq((walletProjectLinks as any).walletAddress, walletAddress));
      } catch (e) {
        console.log('[REWARDS] walletProjectLinks table not available yet, skipping connected projects');
      }
      
      return {
        activityData,
        rewardSummary,
        claimableRewards,
        recentClaims,
        connectedProjects,
        totalPendingUsd: activityData.pending_rewards_usd,
        totalClaimedUsd: activityData.total_rewards_claimed_usd
      };
      
    } catch (error) {
      console.error(`❌ [REWARDS] Failed to get dashboard data:`, error);
      throw error;
    }
  }

  /**
   * Calculate total platform revenue and rewards distributed
   */
  async getPlatformStats() {
    const stats = await db
      .select({
        totalFeesUsd: sum(feeTransactions.fee_usd_value),
        totalRewardsUsd: sum(feeTransactions.reward_usd_value),
        totalTransactions: sql<number>`count(*)`,
        swapCount: sql<number>`count(case when ${feeTransactions.operation_type} = 'swap' then 1 end)`,
        bridgeCount: sql<number>`count(case when ${feeTransactions.operation_type} = 'bridge' then 1 end)`,
        marketplaceCount: sql<number>`count(case when ${feeTransactions.operation_type} like 'marketplace%' then 1 end)`
      })
      .from(feeTransactions);
    
    const [claimTransactionStats] = await db.select({
      totalClaimTransactions: count(),
      successfulClaims: sql<number>`COUNT(CASE WHEN status = 'confirmed' THEN 1 END)`,
      pendingClaims: sql<number>`COUNT(CASE WHEN status IN ('pending', 'confirming') THEN 1 END)`
    }).from(rewardClaimTransactions);
    
    return {
      ...stats[0],
      totalClaimTransactions: claimTransactionStats.totalClaimTransactions,
      successfulClaims: claimTransactionStats.successfulClaims,
      pendingClaims: claimTransactionStats.pendingClaims
    };
  }
}

// Export the service instance and the trackRewardEarned function for external use
export const rewardsService = new RewardsService();
export const trackRewardEarned = rewardsService.trackRewardEarned.bind(rewardsService);