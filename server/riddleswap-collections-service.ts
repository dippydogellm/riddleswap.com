/**
 * RIDDLESWAP COLLECTIONS SERVICE
 * Comprehensive NFT collection management for specific issuer and taxons
 * Target: rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH with taxons 0,1,2,3,9
 * Features: Volume-based rewards, NFT ownership tracking, monthly RDL allocation
 */

import { db } from './db';
import { 
  monthlyNftOwnership,
  monthlyCollectionStats,
  monthlyRewardEligibility,
  swapHistory 
} from '../shared/schema';
import { eq, desc, and, sql, count, sum, gte, lte, inArray } from 'drizzle-orm';
import fetch from 'node-fetch';
import { nanoid } from 'nanoid';

interface NFTCollectionData {
  issuer: string;
  taxon: number;
  collection_name: string;
  total_supply: number;
  holders: string[];
  volume_30d_xrp: string;
  volume_30d_usd: string;
}

interface WalletRewardData {
  wallet_address: string;
  total_nfts_held: number;
  volume_percentage: number;
  rdl_reward_amount: string;
  reward_basis: string;
}

export class RiddleSwapCollectionsService {
  
  private readonly TARGET_ISSUER = 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH';
  private readonly TARGET_TAXONS = [0, 1, 2, 3, 9];
  
  // Download and process NFTs for specific issuer and taxons
  async downloadRiddleSwapCollections() {
    console.log(`🎨 [RIDDLESWAP-COLLECTIONS] Downloading NFTs for issuer: ${this.TARGET_ISSUER}`);
    
    try {
      const allCollectionNFTs = [];
      
      // Download NFTs for each taxon
      for (const taxon of this.TARGET_TAXONS) {
        console.log(`📥 [RIDDLESWAP-COLLECTIONS] Processing taxon ${taxon}...`);
        
        const nfts = await this.downloadNFTsByIssuerAndTaxon(this.TARGET_ISSUER, taxon);
        
        if (nfts.length > 0) {
          const collectionData = {
            issuer: this.TARGET_ISSUER,
            taxon: taxon,
            collection_name: `RiddleSwap Collection Taxon ${taxon}`,
            nfts: nfts
          };
          
          allCollectionNFTs.push(collectionData);
          console.log(`✅ [RIDDLESWAP-COLLECTIONS] Found ${nfts.length} NFTs for taxon ${taxon}`);
        }
      }
      
      // Save collections to database
      await this.saveCollectionsToDatabase(allCollectionNFTs);
      
      console.log(`🎯 [RIDDLESWAP-COLLECTIONS] Successfully processed ${allCollectionNFTs.length} collections`);
      return allCollectionNFTs;
      
    } catch (error) {
      console.error('❌ [RIDDLESWAP-COLLECTIONS] Error downloading collections:', error);
      throw error;
    }
  }
  
  // Download NFTs for specific issuer and taxon using Bithomp API
  private async downloadNFTsByIssuerAndTaxon(issuer: string, taxon: number) {
    const nfts = [];
    let marker = '';
    let hasMore = true;
    const limit = 200;
    let pageCount = 0;
    const maxPages = 50; // Safety limit
    
    try {
      while (hasMore && pageCount < maxPages) {
        console.log(`🔍 [RIDDLESWAP-COLLECTIONS] Fetching NFTs page ${pageCount + 1} for taxon ${taxon}...`);
        
        let url = `https://bithomp.com/api/v2/nfts?issuer=${issuer}&taxon=${taxon}&limit=${limit}`;
        if (marker) {
          url += `&marker=${marker}`;
        }
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-bithomp-token': process.env.BITHOMP_API_KEY || ''
          }
        });
        
        if (!response.ok) {
          if (response.status === 429) {
            console.log('⏳ [RIDDLESWAP-COLLECTIONS] Rate limited, waiting 2 seconds...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }
          throw new Error(`Bithomp API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json() as any;
        const pageNfts = data.nfts || [];
        
        if (pageNfts.length === 0) {
          hasMore = false;
          break;
        }
        
        // Process each NFT
        for (const nft of pageNfts) {
          if (!nft.is_burned && nft.Owner) {
            nfts.push({
              token_id: nft.NFTokenID,
              issuer: nft.Issuer,
              taxon: nft.Taxon,
              owner: nft.Owner,
              uri: nft.URI,
              metadata: nft.metadata || {},
              sequence: nft.Sequence,
              transfer_fee: nft.TransferFee || 0,
              flags: nft.Flags || 0
            });
          }
        }
        
        // Update marker for next page
        marker = data.marker || '';
        if (!marker || pageNfts.length < limit) {
          hasMore = false;
        }
        
        pageCount++;
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log(`✅ [RIDDLESWAP-COLLECTIONS] Downloaded ${nfts.length} NFTs for issuer ${issuer} taxon ${taxon}`);
      return nfts;
      
    } catch (error) {
      console.error(`❌ [RIDDLESWAP-COLLECTIONS] Error downloading NFTs for taxon ${taxon}:`, error);
      return [];
    }
  }
  
  // Save collections to database for monthly tracking
  private async saveCollectionsToDatabase(collections: any[]) {
    const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    
    try {
      for (const collection of collections) {
        console.log(`💾 [RIDDLESWAP-COLLECTIONS] Saving collection: ${collection.collection_name}`);
        
        // Create ownership records for each NFT
        const ownershipRecords = collection.nfts.map((nft: any) => ({
          id: `riddleswap-${currentMonth}-${nanoid(8)}`,
          snapshot_month: currentMonth,
          nft_token_id: nft.token_id,
          nft_issuer: nft.issuer,
          collection_name: collection.collection_name,
          owner_wallet: nft.owner,
          is_listed: false, // Will be updated with real listing data
          market_value_xrp: '0',
          market_value_usd: '0',
          metadata_uri: nft.uri,
          attributes: JSON.stringify(nft.metadata)
        }));
        
        // Batch insert ownership records
        if (ownershipRecords.length > 0) {
          const batchSize = 100;
          for (let i = 0; i < ownershipRecords.length; i += batchSize) {
            const batch = ownershipRecords.slice(i, i + batchSize);
            await db.insert(monthlyNftOwnership)
              .values(batch as any)
              .onConflictDoNothing(); // Avoid duplicates
          }
        }
        
        // Create collection statistics
        const uniqueOwners = [...new Set(collection.nfts.map((nft: any) => nft.owner))];
        await db.insert(monthlyCollectionStats)
          .values({
            id: `riddleswap-stats-${currentMonth}-${collection.taxon}`,
            snapshot_month: currentMonth,
            collection_name: collection.collection_name,
            issuer_address: collection.issuer,
            total_supply: collection.nfts.length,
            total_owners: uniqueOwners.length,
            total_listed: 0,
            volume_month_xrp: '0',
            volume_month_usd: '0'
          } as any)
          .onConflictDoNothing();
        
        console.log(`✅ [RIDDLESWAP-COLLECTIONS] Saved ${collection.nfts.length} NFTs for ${collection.collection_name}`);
      }
      
    } catch (error) {
      console.error('❌ [RIDDLESWAP-COLLECTIONS] Error saving collections to database:', error);
      throw error;
    }
  }
  
  // Calculate volume-based rewards for last 30 days
  async calculateVolumeBasedRewards(targetWallet?: string) {
    console.log('💰 [RIDDLESWAP-COLLECTIONS] Calculating volume-based rewards for last 30 days...');
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    try {
      // Get total platform volume in last 30 days
      const [totalVolumeResult] = await db.select({
        total_volume_usd: sql<string>`COALESCE(SUM(CAST(total_value_usd AS DECIMAL)), 0)`,
        total_swaps: count()
      }).from(swapHistory)
        .where(gte(swapHistory.created_at, thirtyDaysAgo));
      
      const totalVolumeUsd = parseFloat(totalVolumeResult.total_volume_usd || '0');
      
      console.log(`📊 [RIDDLESWAP-COLLECTIONS] Total 30-day volume: $${totalVolumeUsd.toFixed(2)}`);
      
      // Get NFT holders for each collection
      const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      
      const nftHolders = await db.select({
        owner_wallet: monthlyNftOwnership.owner_wallet,
        collection_name: monthlyNftOwnership.collection_name,
        nft_count: sql<number>`COUNT(*)`
      }).from(monthlyNftOwnership)
        .where(and(
          eq(monthlyNftOwnership.snapshot_month, currentMonth),
          eq(monthlyNftOwnership.nft_issuer, this.TARGET_ISSUER)
        ))
        .groupBy(monthlyNftOwnership.owner_wallet, monthlyNftOwnership.collection_name);
      
      // Calculate rewards for each holder
      const rewardData: WalletRewardData[] = [];
      const rewardPercentage = 0.05; // 5% of total volume distributed as rewards
      const totalRewardPool = totalVolumeUsd * rewardPercentage;
      
      // Get total NFTs across all collections
      const totalNFTs = nftHolders.reduce((sum, holder) => sum + holder.nft_count, 0);
      
      for (const holder of nftHolders) {
        const holdingPercentage = holder.nft_count / totalNFTs;
        const rdlReward = totalRewardPool * holdingPercentage;
        
        // Only process if wallet matches target or no target specified
        if (!targetWallet || holder.owner_wallet === targetWallet) {
          rewardData.push({
            wallet_address: holder.owner_wallet,
            total_nfts_held: holder.nft_count,
            volume_percentage: holdingPercentage * 100,
            rdl_reward_amount: rdlReward.toFixed(6),
            reward_basis: '30-day platform volume percentage'
          });
        }
      }
      
      console.log(`✅ [RIDDLESWAP-COLLECTIONS] Calculated rewards for ${rewardData.length} wallets`);
      return {
        total_volume_usd: totalVolumeUsd,
        total_reward_pool: totalRewardPool,
        reward_data: rewardData
      };
      
    } catch (error) {
      console.error('❌ [RIDDLESWAP-COLLECTIONS] Error calculating volume-based rewards:', error);
      throw error;
    }
  }
  
  // Generate monthly RDL allocation report
  async generateMonthlyRDLReport(month?: string) {
    const reportMonth = month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    
    console.log(`📋 [RIDDLESWAP-COLLECTIONS] Generating RDL allocation report for ${reportMonth}...`);
    
    try {
      // Get volume-based rewards
      const volumeRewards = await this.calculateVolumeBasedRewards();
      
      // Get collection statistics
      const collectionStats = await db.select()
        .from(monthlyCollectionStats)
        .where(and(
          eq(monthlyCollectionStats.snapshot_month, reportMonth),
          eq(monthlyCollectionStats.issuer_address, this.TARGET_ISSUER)
        ));
      
      // Get holder distribution
      const holderDistribution = await db.select({
        collection_name: monthlyNftOwnership.collection_name,
        owner_wallet: monthlyNftOwnership.owner_wallet,
        nft_count: sql<number>`COUNT(*)`
      }).from(monthlyNftOwnership)
        .where(and(
          eq(monthlyNftOwnership.snapshot_month, reportMonth),
          eq(monthlyNftOwnership.nft_issuer, this.TARGET_ISSUER)
        ))
        .groupBy(monthlyNftOwnership.collection_name, monthlyNftOwnership.owner_wallet);
      
      const report = {
        report_id: `riddleswap-rdl-${reportMonth}-${nanoid(8)}`,
        month: reportMonth,
        issuer: this.TARGET_ISSUER,
        collections: collectionStats,
        volume_data: {
          total_volume_usd: volumeRewards.total_volume_usd,
          total_reward_pool: volumeRewards.total_reward_pool,
          reward_percentage: '5%'
        },
        allocation_data: volumeRewards.reward_data,
        holder_distribution: holderDistribution,
        total_wallets: volumeRewards.reward_data.length,
        total_rdl_allocated: volumeRewards.reward_data.reduce((sum, r) => sum + parseFloat(r.rdl_reward_amount), 0),
        generated_at: new Date().toISOString()
      };
      
      console.log(`✅ [RIDDLESWAP-COLLECTIONS] Generated report: ${report.report_id}`);
      return report;
      
    } catch (error) {
      console.error('❌ [RIDDLESWAP-COLLECTIONS] Error generating monthly report:', error);
      throw error;
    }
  }
  
  // Get rewards data for specific wallet
  async getWalletRewardsData(walletAddress: string) {
    console.log(`🔍 [RIDDLESWAP-COLLECTIONS] Getting rewards data for wallet: ${walletAddress}`);
    
    try {
      const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      
      // Get NFT holdings
      const holdings = await db.select()
        .from(monthlyNftOwnership)
        .where(and(
          eq(monthlyNftOwnership.owner_wallet, walletAddress),
          eq(monthlyNftOwnership.snapshot_month, currentMonth),
          eq(monthlyNftOwnership.nft_issuer, this.TARGET_ISSUER)
        ));
      
      // Calculate rewards
      const volumeRewards = await this.calculateVolumeBasedRewards(walletAddress);
      const walletReward = volumeRewards.reward_data.find(r => r.wallet_address === walletAddress);
      
      return {
        wallet_address: walletAddress,
        nft_holdings: holdings,
        total_nfts: holdings.length,
        collections: [...new Set(holdings.map(h => h.collection_name))],
        reward_data: walletReward || null,
        volume_data: {
          total_platform_volume: volumeRewards.total_volume_usd,
          reward_pool: volumeRewards.total_reward_pool
        }
      };
      
    } catch (error) {
      console.error('❌ [RIDDLESWAP-COLLECTIONS] Error getting wallet rewards data:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const riddleSwapCollectionsService = new RiddleSwapCollectionsService();