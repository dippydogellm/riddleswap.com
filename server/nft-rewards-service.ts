import { db } from './db';
import { nftRewards, monthlyRewardDistributions, nftRewardTransfers, riddleWallets, type InsertNftReward } from '../shared/schema';
import { eq, desc, sum, sql, and, or } from 'drizzle-orm';

/**
 * NFT collection configuration matching the specific requirements
 */
const NFT_COLLECTIONS_CONFIG = {
  issuer: 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH',
  collections: {
    1: { name: 'The Inquiry', percentage: 20.0, totalNFTs: 123 },
    2: { name: 'The Lost Emporium', percentage: 2.5, totalNFTs: 400 },
    3: { name: 'Dante Aurum', percentage: 2.5, totalNFTs: 200 }, 
    4: { name: 'Under The Bridge', percentage: 15.0, totalNFTs: 300 },
    5: { name: 'The Inquisition', percentage: 5.0, totalNFTs: 150 },
    9: { name: 'Riddle Drop', percentage: 5.0, totalNFTs: 500 }
  }
};

export class NFTRewardsService {

  /**
   * Check NFT holdings for a wallet and update rewards eligibility
   */
  async checkAndUpdateNFTHoldings(walletAddress: string, userHandle?: string): Promise<any> {
    console.log(`🔍 [NFT REWARDS] Checking holdings for wallet: ${walletAddress}`);

    try {
      // Fetch NFTs from Bithomp API for the specific issuer
      const nftResponse = await fetch(
        `https://bithomp.com/api/v2/address/${walletAddress}/nfts?limit=1000&issuer=${NFT_COLLECTIONS_CONFIG.issuer}`,
        {
          headers: {
            'x-bithomp-token': process.env.BITHOMP_API_KEY || '',
            'Accept': 'application/json'
          }
        }
      );

      if (!nftResponse.ok) {
        throw new Error(`Bithomp API error: ${nftResponse.status}`);
      }

      const nftData = await nftResponse.json();
      const holdings = new Map<number, number>(); // taxon -> count

      // Count NFTs by taxon
      if (nftData.nfts && Array.isArray(nftData.nfts)) {
        nftData.nfts.forEach((nft: any) => {
          const taxon = parseInt(nft.nftokenTaxon);
          if (NFT_COLLECTIONS_CONFIG.collections[taxon as keyof typeof NFT_COLLECTIONS_CONFIG.collections]) {
            holdings.set(taxon, (holdings.get(taxon) || 0) + 1);
          }
        });
      }

      // Update database with current holdings
      const rewardRecords = [];
      
      for (const [taxon, count] of holdings) {
        const collection = NFT_COLLECTIONS_CONFIG.collections[taxon as keyof typeof NFT_COLLECTIONS_CONFIG.collections];
        if (!collection) continue;

        const percentageShare = (count / collection.totalNFTs) * 100;
        const monthlyRewardPercentage = (count / collection.totalNFTs) * collection.percentage;

        // Upsert NFT reward record
        const [existingRecord] = await db
          .select()
          .from(nftRewards)
          .where(and(
            eq(nftRewards.wallet_address, walletAddress),
            eq(nftRewards.collection_issuer, NFT_COLLECTIONS_CONFIG.issuer),
            eq(nftRewards.collection_taxon, taxon)
          ));

        if (existingRecord) {
          // Update existing record
          await db
            .update(nftRewards)
            .set({ 
              nft_count: count,
              percentage_share: percentageShare.toString(),
              monthly_reward_percentage: monthlyRewardPercentage.toString(),
              user_handle: userHandle || existingRecord.user_handle,
              updated_at: new Date()
             } as any)
            .where(eq(nftRewards.id, existingRecord.id));

          rewardRecords.push({
            ...existingRecord,
            nft_count: count,
            percentage_share: percentageShare,
            monthly_reward_percentage: monthlyRewardPercentage
          });
        } else {
          // Create new record
          const newReward: InsertNftReward = {
            wallet_address: walletAddress,
            user_handle: userHandle,
            collection_issuer: NFT_COLLECTIONS_CONFIG.issuer,
            collection_taxon: taxon,
            collection_name: collection.name,
            nft_count: count,
            percentage_share: percentageShare.toString(),
            monthly_reward_percentage: monthlyRewardPercentage.toString(),
            status: 'active'
          };

          const [inserted] = await db
            .insert(nftRewards)
            .values(newReward as any)
            .returning();

          rewardRecords.push(inserted);
        }
      }

      console.log(`✅ [NFT REWARDS] Updated holdings for ${rewardRecords.length} collections`);
      
      return {
        success: true,
        walletAddress,
        totalCollections: rewardRecords.length,
        holdings: rewardRecords.map(record => ({
          collectionName: record.collection_name,
          taxon: record.collection_taxon,
          nftCount: record.nft_count,
          percentageShare: parseFloat(record.percentage_share || '0'),
          monthlyRewardPercentage: parseFloat(record.monthly_reward_percentage || '0')
        }))
      };

    } catch (error) {
      console.error('❌ [NFT REWARDS] Error checking NFT holdings:', error);
      throw error;
    }
  }

  /**
   * Calculate monthly rewards based on 30-day volume/revenue
   */
  async calculateMonthlyRewards(month: string): Promise<any> {
    console.log(`💰 [NFT REWARDS] Calculating monthly rewards for ${month}`);

    try {
      // For now, use mock revenue data - in production this would be calculated from actual platform revenue
      // This should be replaced with actual 30-day volume calculations from swaps, fees, etc.
      const mockMonthlyRevenue = 50000; // $50,000 USD (example)
      
      const nftHolderAllocation = mockMonthlyRevenue * 0.5; // 50% to NFT holders

      // Calculate allocations per collection
      const allocations = {
        inquiry: nftHolderAllocation * 0.20,        // 20%
        lost_emporium: nftHolderAllocation * 0.025, // 2.5%
        dante_aurum: nftHolderAllocation * 0.025,   // 2.5%
        under_bridge: nftHolderAllocation * 0.15,   // 15%
        inquisition: nftHolderAllocation * 0.05,    // 5%
        riddle_drop: nftHolderAllocation * 0.05     // 5%
      };

      // Create monthly distribution record
      const distribution = await db
        .insert(monthlyRewardDistributions)
        .values({
          distribution_month: month,
          total_platform_revenue_usd: mockMonthlyRevenue.toString(),
          nft_holder_allocation_usd: nftHolderAllocation.toString(),
          inquiry_allocation_usd: allocations.inquiry.toString(),
          lost_emporium_allocation_usd: allocations.lost_emporium.toString(),
          dante_aurum_allocation_usd: allocations.dante_aurum.toString(),
          under_bridge_allocation_usd: allocations.under_bridge.toString(),
          inquisition_allocation_usd: allocations.inquisition.toString(),
          riddle_drop_allocation_usd: allocations.riddle_drop.toString(),
          status: 'pending'
        })
        .returning();

      console.log(`✅ [NFT REWARDS] Created distribution record for ${month}`);
      
      return {
        success: true,
        month,
        totalRevenue: mockMonthlyRevenue,
        nftHolderAllocation,
        allocations,
        distributionId: distribution[0].id
      };

    } catch (error) {
      console.error('❌ [NFT REWARDS] Error calculating monthly rewards:', error);
      throw error;
    }
  }

  /**
   * Open monthly collection window (called on 1st of each month)
   */
  async openCollectionWindow(distributionId: string): Promise<any> {
    console.log(`🕐 [NFT REWARDS] Opening 24-hour collection window for ${distributionId}`);

    try {
      // Get distribution details
      const [distribution] = await db
        .select()
        .from(monthlyRewardDistributions)
        .where(eq(monthlyRewardDistributions.id, distributionId));

      if (!distribution) {
        throw new Error('Distribution not found');
      }

      if (distribution.status !== 'pending') {
        throw new Error(`Distribution already ${distribution.status}`);
      }

      // Set collection window (24 hours from now)
      const windowStart = new Date();
      const windowEnd = new Date(windowStart.getTime() + 24 * 60 * 60 * 1000); // 24 hours later

      // Update distribution to open collection window
      await db
        .update(monthlyRewardDistributions)
        .set({  
          status: 'collection_open',
          collection_window_start: windowStart,
          collection_window_end: windowEnd,
          collection_window_open: true,
          distribution_started_at: windowStart
         } as any)
        .where(eq(monthlyRewardDistributions.id, distributionId));

      // Get all eligible NFT holders for this month
      const eligibleHolders = await db
        .select()
        .from(nftRewards)
        .where(eq(nftRewards.status, 'active'));

      let totalAvailable = 0;
      const rdlPriceUsd = 0.50; // Should fetch real price

      // Create reward collection records for each holder
      for (const holder of eligibleHolders) {
        try {
          const collection = NFT_COLLECTIONS_CONFIG.collections[holder.collection_taxon as keyof typeof NFT_COLLECTIONS_CONFIG.collections];
          if (!collection) continue;

          const collectionAllocationUsd = this.getCollectionAllocationUsd(distribution, holder.collection_taxon);
          const holderRewardUsd = (parseFloat(holder.monthly_reward_percentage || '0') / 100) * collectionAllocationUsd;
          const rdlAmount = holderRewardUsd / rdlPriceUsd;

          if (rdlAmount <= 0) continue;

          // Create available reward record
          await db
            .insert(nftRewardTransfers)
            .values({
              id: crypto.randomUUID(),
              distribution_id: distributionId,
              nft_reward_id: holder.id,
              wallet_address: holder.wallet_address,
              collection_name: holder.collection_name,
              rdl_amount: rdlAmount.toString(),
              usd_value: holderRewardUsd.toString(),
              status: 'available',
              available_until: windowEnd
            });

          totalAvailable += rdlAmount;

        } catch (error) {
          console.error(`❌ [NFT REWARDS] Failed to create collection record for ${holder.wallet_address}:`, error);
        }
      }

      // Update total available rewards
      await db
        .update(monthlyRewardDistributions)
        .set({ 
          total_rdl_available: totalAvailable.toString(),
          holders_count: eligibleHolders.length
         } as any)
        .where(eq(monthlyRewardDistributions.id, distributionId));

      console.log(`✅ [NFT REWARDS] Collection window opened: ${eligibleHolders.length} holders, ${totalAvailable.toFixed(4)} RDL available`);

      return {
        success: true,
        distributionId,
        windowStart,
        windowEnd,
        totalHolders: eligibleHolders.length,
        totalRdlAvailable: totalAvailable,
        status: 'collection_open'
      };

    } catch (error) {
      console.error(`❌ [NFT REWARDS] Failed to open collection window:`, error);
      throw error;
    }
  }

  /**
   * Close collection window and burn uncollected rewards
   */
  async closeCollectionWindow(distributionId: string): Promise<any> {
    console.log(`🔥 [NFT REWARDS] Closing collection window and burning uncollected rewards for ${distributionId}`);

    try {
      const [distribution] = await db
        .select()
        .from(monthlyRewardDistributions)
        .where(eq(monthlyRewardDistributions.id, distributionId));

      if (!distribution || distribution.status !== 'collection_open') {
        throw new Error('Collection window is not open');
      }

      // Get all uncollected rewards
      const uncollectedRewards = await db
        .select()
        .from(nftRewardTransfers)
        .where(and(
          eq(nftRewardTransfers.distribution_id, distributionId),
          eq(nftRewardTransfers.status, 'available')
        ));

      let totalBurnt = 0;
      const now = new Date();

      // Burn all uncollected rewards
      for (const reward of uncollectedRewards) {
        await db
          .update(nftRewardTransfers)
          .set({ 
            status: 'burnt',
            burnt_at: now
           } as any)
          .where(eq(nftRewardTransfers.id, reward.id));

        totalBurnt += parseFloat(reward.rdl_amount || '0');
        console.log(`🔥 [BURN] ${reward.rdl_amount} RDL burnt from ${reward.wallet_address} (${reward.collection_name})`);
      }

      // Update distribution status
      await db
        .update(monthlyRewardDistributions)
        .set({ 
          status: 'collection_closed',
          collection_window_open: false,
          distribution_completed_at: now,
          total_rdl_burnt: totalBurnt.toString()
         } as any)
        .where(eq(monthlyRewardDistributions.id, distributionId));

      console.log(`✅ [NFT REWARDS] Collection window closed: ${totalBurnt.toFixed(4)} RDL burnt from ${uncollectedRewards.length} uncollected rewards`);

      return {
        success: true,
        distributionId,
        totalBurnt,
        uncollectedCount: uncollectedRewards.length,
        status: 'collection_closed'
      };

    } catch (error) {
      console.error(`❌ [NFT REWARDS] Failed to close collection window:`, error);
      throw error;
    }
  }

  /**
   * Collect reward for a specific wallet
   */
  async collectReward(walletAddress: string, rewardId: string): Promise<any> {
    console.log(`💰 [NFT REWARDS] Collecting reward ${rewardId} for wallet ${walletAddress}`);

    try {
      // Get reward details
      const [reward] = await db
        .select()
        .from(nftRewardTransfers)
        .where(and(
          eq(nftRewardTransfers.id, rewardId),
          eq(nftRewardTransfers.wallet_address, walletAddress),
          eq(nftRewardTransfers.status, 'available')
        ));

      if (!reward) {
        throw new Error('Reward not found or already collected');
      }

      // Check if collection window is still open
      const now = new Date();
      if (now > new Date(reward.available_until)) {
        // Mark as burnt instead of collected
        await db
          .update(nftRewardTransfers)
          .set({ 
            status: 'burnt',
            burnt_at: now
           } as any)
          .where(eq(nftRewardTransfers.id, rewardId));

        throw new Error('Collection window has expired - reward has been burnt');
      }

      // Execute RDL transfer to user's Riddle wallet
      const mockTransactionHash = `rdl_collect_${Date.now()}`;

      // Mark reward as collected
      await db
        .update(nftRewardTransfers)
        .set({ 
          status: 'collected',
          collected_at: now,
          transaction_hash: mockTransactionHash
         } as any)
        .where(eq(nftRewardTransfers.id, rewardId));

      // Update distribution statistics
      await db
        .update(monthlyRewardDistributions)
        .set({
          total_rdl_collected: sql`total_rdl_collected + ${parseFloat(reward.rdl_amount || '0')}`,
          successful_collections: sql`successful_collections + 1`
        })
        .where(eq(monthlyRewardDistributions.id, reward.distribution_id));

      console.log(`✅ [NFT REWARDS] Reward collected: ${reward.rdl_amount} RDL to ${walletAddress}`);

      return {
        success: true,
        rewardId,
        walletAddress,
        rdlAmount: parseFloat(reward.rdl_amount || '0'),
        collectionName: reward.collection_name,
        transactionHash: mockTransactionHash,
        status: 'collected'
      };

    } catch (error) {
      console.error(`❌ [NFT REWARDS] Collection failed:`, error);
      throw error;
    }
  }

  /**
   * Get available rewards for a wallet
   */
  async getAvailableRewards(walletAddress: string): Promise<any> {
    console.log(`📋 [NFT REWARDS] Getting available rewards for ${walletAddress}`);

    try {
      const availableRewards = await db
        .select()
        .from(nftRewardTransfers)
        .where(and(
          eq(nftRewardTransfers.wallet_address, walletAddress),
          eq(nftRewardTransfers.status, 'available')
        ));

      // Filter out expired rewards
      const now = new Date();
      const validRewards = availableRewards.filter(reward => 
        new Date(reward.available_until) > now
      );

      const totalRdl = validRewards.reduce((sum, reward) => 
        sum + parseFloat(reward.rdl_amount || '0'), 0
      );

      return {
        success: true,
        walletAddress,
        availableRewards: validRewards,
        totalRdlAmount: totalRdl,
        rewardCount: validRewards.length
      };

    } catch (error) {
      console.error(`❌ [NFT REWARDS] Failed to get available rewards:`, error);
      throw error;
    }
  }

  /**
   * Get rewards summary for a wallet
   */
  async getWalletRewardsSummary(walletAddress: string): Promise<any> {
    try {
      const rewards = await db
        .select()
        .from(nftRewards)
        .where(and(
          eq(nftRewards.wallet_address, walletAddress),
          eq(nftRewards.status, 'active')
        ));

      const transfers = await db
        .select()
        .from(nftRewardTransfers)
        .where(eq(nftRewardTransfers.wallet_address, walletAddress))
        .orderBy(desc(nftRewardTransfers.created_at))
        .limit(10);

      const totalEarned = rewards.reduce((sum, reward) => 
        sum + parseFloat(reward.total_rdl_earned || '0'), 0
      );

      return {
        success: true,
        walletAddress,
        collections: rewards.map(reward => ({
          collectionName: reward.collection_name,
          nftCount: reward.nft_count,
          percentageShare: parseFloat(reward.percentage_share || '0'),
          monthlyRewardPercentage: parseFloat(reward.monthly_reward_percentage || '0'),
          totalRdlEarned: parseFloat(reward.total_rdl_earned || '0'),
          lastDistribution: reward.last_distribution_month
        })),
        totalRdlEarned: totalEarned,
        recentTransfers: transfers
      };

    } catch (error) {
      console.error('❌ [NFT REWARDS] Error getting rewards summary:', error);
      throw error;
    }
  }

  /**
   * Get all holders for admin review
   */
  async getAllHoldersForAdmin(): Promise<any> {
    try {
      const holders = await db
        .select()
        .from(nftRewards)
        .where(eq(nftRewards.collection_issuer, NFT_COLLECTIONS_CONFIG.issuer))
        .orderBy(desc(nftRewards.updated_at));

      const distributions = await db
        .select()
        .from(monthlyRewardDistributions)
        .orderBy(desc(monthlyRewardDistributions.created_at))
        .limit(6);

      return {
        success: true,
        totalHolders: holders.length,
        holders: holders.map(holder => ({
          id: holder.id,
          walletAddress: holder.wallet_address,
          userHandle: holder.user_handle,
          collectionName: holder.collection_name,
          nftCount: holder.nft_count,
          percentageShare: parseFloat(holder.percentage_share || '0'),
          totalRdlEarned: parseFloat(holder.total_rdl_earned || '0'),
          status: holder.status,
          lastUpdated: holder.updated_at
        })),
        recentDistributions: distributions
      };

    } catch (error) {
      console.error('❌ [NFT REWARDS] Error getting holders for admin:', error);
      throw error;
    }
  }
}

export const nftRewardsService = new NFTRewardsService();