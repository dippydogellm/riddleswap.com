/**
 * REWARDS DASHBOARD SERVICE
 * Comprehensive reward tracking and distribution system
 * - Daily activity tracking starting from today
 * - 25% of trading fees back in RDL tokens
 * - NFT collection rewards with listing penalties
 * - 50% of monthly royalties distributed per collection
 */

import { db } from './db';
import { 
  dailyActivity, 
  userRewardsDashboard, 
  nftCollectionHoldings, 
  collectionRewardRules,
  swapHistory,
  feeTransactions,
  riddleWallets,
  walletConnections 
} from '../shared/schema';
import { eq, desc, gte, lte, sum, count, sql, and, or } from 'drizzle-orm';

export class RewardsDashboardService {
  
  // Initialize daily tracking starting from today
  async initializeDailyTracking() {
    console.log('🚀 [REWARDS] Initializing daily tracking system...');
    const today = new Date().toISOString().split('T')[0];
    
    try {
      // Check if today's tracking already exists
      const [existingToday] = await db.select()
        .from(dailyActivity)
        .where(eq(dailyActivity.date, today))
        .limit(1);
      
      if (!existingToday) {
        // Create today's tracking record
        const [newRecord] = await db.insert(dailyActivity)
          .values({
            date: today,
            total_swaps: 0,
            total_volume_usd: '0',
            total_fees_collected_usd: '0',
            total_rewards_distributed_usd: '0',
            unique_traders: 0,
            new_wallets: 0
          } as any)
          .returning();
        
        console.log('✅ [REWARDS] Daily tracking initialized for:', today);
        return newRecord;
      }
      
      console.log('📊 [REWARDS] Daily tracking already exists for:', today);
      return existingToday;
    } catch (error) {
      console.error('❌ [REWARDS] Failed to initialize daily tracking:', error);
      throw error;
    }
  }
  
  // Update daily activity with real-time data
  async updateDailyActivity() {
    console.log('📊 [REWARDS] Updating daily activity...');
    const today = new Date().toISOString().split('T')[0];
    const todayStart = new Date(today + 'T00:00:00.000Z');
    const todayEnd = new Date(today + 'T23:59:59.999Z');
    
    try {
      // Get today's swap statistics
      const [swapStats] = await db.select({
        total_swaps: count(),
        total_volume_usd: sql<string>`COALESCE(SUM(CAST(total_value_usd AS DECIMAL)), 0)`,
        unique_traders: sql<number>`COUNT(DISTINCT wallet_address)`
      }).from(swapHistory)
        .where(and(
          gte(swapHistory.created_at, todayStart),
          lte(swapHistory.created_at, todayEnd)
        ));
      
      // Get today's fee statistics  
      const [feeStats] = await db.select({
        total_fees_usd: sql<string>`COALESCE(SUM(CAST(fee_usd_value AS DECIMAL)), 0)`,
        total_rewards_usd: sql<string>`COALESCE(SUM(CAST(reward_usd_value AS DECIMAL)), 0)`
      }).from(feeTransactions)
        .where(and(
          gte(feeTransactions.created_at, todayStart),
          lte(feeTransactions.created_at, todayEnd)
        ));
      
      // Get new wallets created today
      const [walletStats] = await db.select({
        new_wallets: count()
      }).from(riddleWallets)
        .where(and(
          gte(riddleWallets.createdAt, todayStart),
          lte(riddleWallets.createdAt, todayEnd)
        ));
      
      // Update or insert today's activity
      const updateData = {
        date: today,
        total_swaps: swapStats.total_swaps,
        total_volume_usd: swapStats.total_volume_usd,
        total_fees_collected_usd: feeStats.total_fees_usd,
        total_rewards_distributed_usd: feeStats.total_rewards_usd,
        unique_traders: swapStats.unique_traders,
        new_wallets: walletStats.new_wallets
      };
      
      const [updatedRecord] = await db.insert(dailyActivity)
        .values(updateData as any)
        .onConflictDoUpdate({
          target: dailyActivity.date,
          set: updateData
        })
        .returning();
      
      console.log('✅ [REWARDS] Daily activity updated:', updatedRecord);
      return updatedRecord;
    } catch (error) {
      console.error('❌ [REWARDS] Failed to update daily activity:', error);
      throw error;
    }
  }
  
  // Calculate and distribute trading rewards (25% of fees back in RDL)
  async calculateTradingRewards(walletAddress: string, dateRange?: { start: string; end: string }) {
    console.log(`💰 [REWARDS] Calculating trading rewards for wallet: ${walletAddress}`);
    
    const today = new Date().toISOString().split('T')[0];
    const start = dateRange?.start || today;
    const end = dateRange?.end || today;
    
    try {
      // Get user's trading activity and fees generated
      const [tradingStats] = await db.select({
        total_swaps: count(),
        total_volume_usd: sql<string>`COALESCE(SUM(CAST(total_value_usd AS DECIMAL)), 0)`,
        fees_generated_usd: sql<string>`COALESCE(SUM(CAST(platform_fee_usd AS DECIMAL)), 0)`
      }).from(swapHistory)
        .where(and(
          eq(swapHistory.wallet_address, walletAddress),
          gte(swapHistory.created_at, new Date(start + 'T00:00:00.000Z')),
          lte(swapHistory.created_at, new Date(end + 'T23:59:59.999Z'))
        ));
      
      const feesGenerated = parseFloat(tradingStats.fees_generated_usd || '0');
      
      if (feesGenerated > 0) {
        // Calculate 25% reward
        const rewardPercentage = 25;
        const rewardAmountUsd = feesGenerated * (rewardPercentage / 100);
        
        // Convert to RDL tokens (assuming 1 RDL = $1 for now, should be dynamic)
        const rdlPrice = 1.0; // TODO: Get live RDL price
        const rewardAmountRdl = rewardAmountUsd / rdlPrice;
        
        // Create/update reward record
        const rewardData = {
          wallet_address: walletAddress,
          reward_type: 'trading_fees',
          reward_period: 'daily',
          reward_date: today,
          fees_generated_usd: tradingStats.fees_generated_usd,
          reward_percentage: '25',
          reward_amount_rdl: rewardAmountRdl.toString(),
          reward_amount_usd: rewardAmountUsd.toString(),
          status: 'pending'
        };
        
        const [rewardRecord] = await db.insert(userRewardsDashboard)
          .values(rewardData as any)
          .onConflictDoUpdate({
            target: [userRewardsDashboard.wallet_address, userRewardsDashboard.reward_date, userRewardsDashboard.reward_type],
            set: rewardData
          })
          .returning();
        
        console.log('✅ [REWARDS] Trading reward calculated:', rewardRecord);
        return rewardRecord;
      }
      
      console.log('📊 [REWARDS] No fees generated for reward calculation');
      return null;
    } catch (error) {
      console.error('❌ [REWARDS] Failed to calculate trading rewards:', error);
      throw error;
    }
  }
  
  // Track NFT collection holdings for specific wallet
  async trackNftCollectionHoldings(walletAddress: string) {
    console.log(`🎨 [REWARDS] Tracking NFT collections for wallet: ${walletAddress}`);
    
    try {
      // Fetch wallet's NFT holdings from Bithomp API
      const response = await fetch(`https://api.bithomp.com/api/v2/address/${walletAddress}/nft`);
      const nftData = await response.json() as any;
      
      if (nftData && nftData.nfts) {
        const collections = new Map();
        
        // Group NFTs by collection
        for (const nft of nftData.nfts) {
          const collectionName = nft.collection || 'Unknown Collection';
          if (!collections.has(collectionName)) {
            collections.set(collectionName, []);
          }
          collections.get(collectionName).push(nft);
        }
        
        // Update holdings for each collection
        for (const [collectionName, nfts] of collections) {
          for (const nft of nfts) {
            const holdingData = {
              wallet_address: walletAddress,
              collection_name: collectionName,
              nft_token_id: nft.nftokenID || nft.id,
              nft_name: nft.name || `NFT #${nft.id?.slice(-4)}`,
              is_currently_held: true,
              is_listed_for_sale: nft.isForSale || false,
              list_price_xrp: nft.sellPrice || null,
              last_checked_at: new Date()
            };
            
            // Update or insert holding record
            await db.insert(nftCollectionHoldings)
              .values(holdingData as any)
              .onConflictDoUpdate({
                target: [nftCollectionHoldings.wallet_address, nftCollectionHoldings.nft_token_id],
                set: {
                  is_currently_held: holdingData.is_currently_held,
                  is_listed_for_sale: holdingData.is_listed_for_sale,
                  list_price_xrp: holdingData.list_price_xrp,
                  last_checked_at: holdingData.last_checked_at
                }
              });
          }
        }
        
        console.log(`✅ [REWARDS] Updated holdings for ${collections.size} collections`);
        return { collectionsTracked: collections.size, totalNfts: nftData.nfts.length };
      }
      
      console.log('📊 [REWARDS] No NFTs found for wallet');
      return { collectionsTracked: 0, totalNfts: 0 };
    } catch (error) {
      console.error('❌ [REWARDS] Failed to track NFT holdings:', error);
      throw error;
    }
  }
  
  // Calculate NFT collection rewards with listing penalties
  async calculateCollectionRewards(walletAddress: string, collectionName: string) {
    console.log(`🎨 [REWARDS] Calculating collection rewards for ${collectionName}`);
    
    const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
    
    try {
      // Get collection reward rules
      const [collectionRules] = await db.select()
        .from(collectionRewardRules)
        .where(eq(collectionRewardRules.collection_name, collectionName))
        .limit(1);
      
      if (!collectionRules) {
        console.log(`⚠️ [REWARDS] No reward rules found for collection: ${collectionName}`);
        return null;
      }
      
      // Get user's holdings for this collection
      const holdings = await db.select()
        .from(nftCollectionHoldings)
        .where(and(
          eq(nftCollectionHoldings.wallet_address, walletAddress),
          eq(nftCollectionHoldings.collection_name, collectionName),
          eq(nftCollectionHoldings.is_currently_held, true)
        ));
      
      // Check if any NFTs were listed during the month
      const listedDuringMonth = holdings.filter(holding => 
        holding.is_listed_for_sale && 
        holding.listed_at && 
        holding.listed_at.toISOString().substring(0, 7) === currentMonth
      );
      
      const penaltyApplied = listedDuringMonth.length > 0;
      
      if (penaltyApplied) {
        console.log(`⚠️ [REWARDS] Penalty applied - ${listedDuringMonth.length} NFTs listed during month`);
        return {
          collection_name: collectionName,
          nfts_held: holdings.length,
          nfts_listed: listedDuringMonth.length,
          penalty_applied: true,
          reward_amount_usd: 0,
          message: 'Rewards forfeited due to listing during reward period'
        };
      }
      
      // Calculate rewards based on holdings
      const nftsHeld = holdings.length;
      const royaltyPool = parseFloat(collectionRules.monthly_royalties_pool_usd || '0');
      const totalSupply = collectionRules.total_supply || 1;
      
      // Reward = (NFTs held / Total supply) * 50% of monthly royalties
      const rewardPercentage = parseFloat(collectionRules.royalty_percentage || '50') / 100;
      const userShare = nftsHeld / totalSupply;
      const rewardAmount = royaltyPool * rewardPercentage * userShare;
      
      // Create reward record
      const rewardData = {
        wallet_address: walletAddress,
        reward_type: 'nft_collection',
        reward_period: 'monthly',
        reward_date: new Date().toISOString().split('T')[0],
        collection_name: collectionName,
        nfts_held: nftsHeld,
        nfts_listed: listedDuringMonth.length,
        penalty_applied: false,
        royalties_earned_usd: rewardAmount.toString(),
        reward_amount_usd: rewardAmount.toString(),
        status: 'pending'
      };
      
      const [rewardRecord] = await db.insert(userRewardsDashboard)
        .values(rewardData as any)
        .onConflictDoUpdate({
          target: [userRewardsDashboard.wallet_address, userRewardsDashboard.reward_date, userRewardsDashboard.reward_type, userRewardsDashboard.collection_name],
          set: rewardData
        })
        .returning();
      
      console.log('✅ [REWARDS] Collection reward calculated:', rewardRecord);
      return rewardRecord;
    } catch (error) {
      console.error('❌ [REWARDS] Failed to calculate collection rewards:', error);
      throw error;
    }
  }
  
  // Get comprehensive rewards dashboard data
  async getRewardsDashboard(walletAddress: string) {
    console.log(`📊 [REWARDS] Fetching dashboard data for: ${walletAddress}`);
    
    try {
      // Get daily activity for last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const dailyStats = await db.select()
        .from(dailyActivity)
        .where(gte(dailyActivity.date, thirtyDaysAgo.toISOString().split('T')[0]))
        .orderBy(desc(dailyActivity.date))
        .limit(30);
      
      // Get user's trading rewards
      const tradingRewards = await db.select()
        .from(userRewardsDashboard)
        .where(and(
          eq(userRewardsDashboard.wallet_address, walletAddress),
          eq(userRewardsDashboard.reward_type, 'trading_fees')
        ))
        .orderBy(desc(userRewardsDashboard.reward_date))
        .limit(30);
      
      // Get user's NFT collection rewards
      const collectionRewards = await db.select()
        .from(userRewardsDashboard)
        .where(and(
          eq(userRewardsDashboard.wallet_address, walletAddress),
          eq(userRewardsDashboard.reward_type, 'nft_collection')
        ))
        .orderBy(desc(userRewardsDashboard.reward_date))
        .limit(10);
      
      // Get user's NFT holdings by collection
      const nftHoldings = await db.select()
        .from(nftCollectionHoldings)
        .where(and(
          eq(nftCollectionHoldings.wallet_address, walletAddress),
          eq(nftCollectionHoldings.is_currently_held, true)
        ))
        .orderBy(nftCollectionHoldings.collection_name);
      
      // Group holdings by collection
      const holdingsByCollection = nftHoldings.reduce((acc, holding) => {
        const collection = holding.collection_name;
        if (!acc[collection]) {
          acc[collection] = { total: 0, listed: 0, nfts: [] };
        }
        acc[collection].total++;
        if (holding.is_listed_for_sale) {
          acc[collection].listed++;
        }
        acc[collection].nfts.push(holding);
        return acc;
      }, {} as any);
      
      // Calculate total rewards pending
      const [totalRewards] = await db.select({
        trading_rewards_usd: sql<string>`COALESCE(SUM(CASE WHEN reward_type = 'trading_fees' THEN CAST(reward_amount_usd AS DECIMAL) ELSE 0 END), 0)`,
        collection_rewards_usd: sql<string>`COALESCE(SUM(CASE WHEN reward_type = 'nft_collection' THEN CAST(reward_amount_usd AS DECIMAL) ELSE 0 END), 0)`,
        total_pending_usd: sql<string>`COALESCE(SUM(CAST(reward_amount_usd AS DECIMAL)), 0)`
      }).from(userRewardsDashboard)
        .where(and(
          eq(userRewardsDashboard.wallet_address, walletAddress),
          eq(userRewardsDashboard.status, 'pending')
        ));
      
      return {
        wallet_address: walletAddress,
        daily_activity: dailyStats,
        trading_rewards: tradingRewards,
        collection_rewards: collectionRewards,
        nft_holdings_by_collection: holdingsByCollection,
        total_rewards_pending: {
          trading_rewards_usd: parseFloat(totalRewards.trading_rewards_usd || '0'),
          collection_rewards_usd: parseFloat(totalRewards.collection_rewards_usd || '0'),
          total_pending_usd: parseFloat(totalRewards.total_pending_usd || '0')
        }
      };
    } catch (error) {
      console.error('❌ [REWARDS] Failed to fetch dashboard data:', error);
      throw error;
    }
  }
}

export const rewardsDashboardService = new RewardsDashboardService();