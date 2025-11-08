/**
 * MONTHLY NFT SNAPSHOT SERVICE
 * Production-ready system for monthly NFT ownership tracking
 * - Downloads all NFTs every month on snapshot day using node-cron
 * - Tracks wallet ownership for each NFT with issuer data
 * - Checks listing status to enforce rewards penalties
 * - Uses real XRP price conversion from CoinGecko
 * - Stores complete monthly ownership records
 */

import { db } from './db';
import { 
  monthlyNftSnapshots,
  monthlyNftOwnership,
  monthlyCollectionStats,
  monthlyRewardEligibility
} from '../shared/schema';
import { eq, desc, and, sql, count, sum } from 'drizzle-orm';
import fetch from 'node-fetch';
import { nanoid } from 'nanoid';
import cron from 'node-cron';

interface XrpPriceData {
  usd: number;
  lastUpdated: Date;
}

interface NftApiResponse {
  nfts?: any[];
  marker?: string;
  hasMore?: boolean;
}

export class MonthlyNftSnapshotService {
  private xrpPrice: XrpPriceData = { usd: 0.50, lastUpdated: new Date(0) };
  private readonly PRICE_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.initializeScheduler();
  }

  // Initialize monthly scheduler using node-cron
  // DISABLED in development to prevent RAM hammering
  private initializeScheduler() {
    // Skip monthly scheduler in development mode to prevent RAM issues
    if (process.env.NODE_ENV === 'development') {
      console.log('⏰ [MONTHLY-SCHEDULER] Skipping monthly NFT snapshot in development mode');
      console.log('💡 [MONTHLY-SCHEDULER] Enable in production with NODE_ENV=production');
      return;
    }

    // Run on the 1st day of every month at 2:00 AM
    cron.schedule('0 2 1 * *', async () => {
      console.log('📅 [MONTHLY-SCHEDULER] Running scheduled monthly NFT snapshot...');
      try {
        await this.runMonthlySnapshot();
        console.log('✅ [MONTHLY-SCHEDULER] Scheduled snapshot completed successfully');
      } catch (error) {
        console.error('❌ [MONTHLY-SCHEDULER] Scheduled snapshot failed:', error);
      }
    }, {
      timezone: "UTC"
    });
    
    console.log('⏰ [MONTHLY-SCHEDULER] Monthly NFT snapshot scheduler initialized (1st day of month at 2:00 AM UTC)');
  }

  // Get real-time XRP price from CoinGecko
  private async getXrpPrice(): Promise<number> {
    const now = new Date();
    
    // Return cached price if still fresh
    if (now.getTime() - this.xrpPrice.lastUpdated.getTime() < this.PRICE_CACHE_DURATION) {
      return this.xrpPrice.usd;
    }

    try {
      console.log('💰 [PRICE-SERVICE] Fetching live XRP price from CoinGecko...');
      
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'NFT-Snapshot-Service/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json() as any;
      const price = (data as any).ripple?.usd || 0.50;
      
      // Update cache
      this.xrpPrice = {
        usd: price,
        lastUpdated: now
      };

      console.log(`💰 [PRICE-SERVICE] Live XRP price: $${price.toFixed(4)}`);
      return price;
      
    } catch (error) {
      console.error('❌ [PRICE-SERVICE] Error fetching XRP price, using cached/default:', error);
      return this.xrpPrice.usd || 0.50;
    }
  }

  // Run complete monthly snapshot process
  async runMonthlySnapshot() {
    console.log('📸 [MONTHLY-SNAPSHOT] Starting comprehensive monthly NFT snapshot...');
    
    const now = new Date();
    const snapshotMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const snapshotId = `snapshot-${snapshotMonth}-${nanoid(8)}`;
    
    try {
      // Create snapshot master record
      const [snapshotRecord] = await db.insert(monthlyNftSnapshots)
        .values({
          id: snapshotId,
          snapshot_date: snapshotMonth,
          snapshot_day: now,
          processing_status: 'processing'
        } as any as any)
        .returning();

      console.log(`🚀 [MONTHLY-SNAPSHOT] Created snapshot record: ${snapshotId}`);

      // Step 1: Download all NFTs from all collections
      const allNfts = await this.downloadAllNfts();
      console.log(`📥 [MONTHLY-SNAPSHOT] Downloaded ${allNfts.length} NFTs`);

      // Step 2: Process each NFT to determine ownership and listing status
      const ownershipData = [];
      const collections = new Map();
      
      for (const nft of allNfts) {
        try {
          const ownership = await this.processNftOwnership(nft, snapshotMonth);
          if (ownership) {
            ownershipData.push(ownership);
            
            // Track collection statistics
            const collectionKey = `${ownership.collection_name}-${ownership.nft_issuer}`;
            if (!collections.has(collectionKey)) {
              collections.set(collectionKey, {
                collection_name: ownership.collection_name,
                issuer_address: ownership.nft_issuer,
                total_supply: 0,
                total_owners: new Set(),
                total_listed: 0,
                floor_price_xrp: null,
                volume_month_xrp: '0'
              });
            }
            
            const collection = collections.get(collectionKey);
            collection.total_supply++;
            collection.total_owners.add(ownership.owner_wallet);
            if (ownership.is_listed) {
              collection.total_listed++;
              if (!collection.floor_price_xrp || 
                  parseFloat(ownership.listing_price_xrp || '0') < parseFloat(collection.floor_price_xrp)) {
                collection.floor_price_xrp = ownership.listing_price_xrp;
              }
            }
          }
        } catch (error) {
          console.error(`❌ [MONTHLY-SNAPSHOT] Error processing NFT ${nft.token_id}:`, error);
        }
      }

      // Step 3: Batch insert ownership records
      if (ownershipData.length > 0) {
        const batchSize = 500;
        for (let i = 0; i < ownershipData.length; i += batchSize) {
          const batch = ownershipData.slice(i, i + batchSize);
          await db.insert(monthlyNftOwnership).values(batch as any);
          console.log(`💾 [MONTHLY-SNAPSHOT] Inserted ownership batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(ownershipData.length/batchSize)}`);
        }
      }

      // Step 4: Create collection statistics
      const collectionStats = [];
      for (const [key, stats] of collections) {
        collectionStats.push({
          id: `collection-${snapshotMonth}-${nanoid(8)}`,
          snapshot_month: snapshotMonth,
          collection_name: stats.collection_name,
          issuer_address: stats.issuer_address,
          total_supply: stats.total_supply,
          total_owners: stats.total_owners.size,
          total_listed: stats.total_listed,
          floor_price_xrp: stats.floor_price_xrp,
          floor_price_usd: stats.floor_price_xrp ? String(parseFloat(stats.floor_price_xrp) * (await this.getXrpPrice())) : '0',
          volume_month_xrp: stats.volume_month_xrp,
          volume_month_usd: String(parseFloat(stats.volume_month_xrp) * (await this.getXrpPrice())),
        });
      }

      if (collectionStats.length > 0) {
        await db.insert(monthlyCollectionStats).values(collectionStats as any);
        console.log(`📊 [MONTHLY-SNAPSHOT] Created statistics for ${collectionStats.length} collections`);
      }

      // Step 5: Calculate reward eligibility for each wallet per collection
      await this.calculateMonthlyRewardEligibility(snapshotMonth, ownershipData);

      // Step 6: Update snapshot completion
      await db.update(monthlyNftSnapshots)
        .set({
          total_nfts_tracked: ownershipData.length,
          total_collections: collections.size,
          total_owners: new Set(ownershipData.map(o => o.owner_wallet)).size,
          total_listed: ownershipData.filter(o => o.is_listed).length,
          processing_status: 'completed',
          updated_at: new Date()
        } as any)
        .where(eq(monthlyNftSnapshots.id, snapshotId));

      console.log(`✅ [MONTHLY-SNAPSHOT] Monthly snapshot completed successfully: ${snapshotId}`);
      return {
        snapshot_id: snapshotId,
        total_nfts: ownershipData.length,
        total_collections: collections.size,
        total_owners: new Set(ownershipData.map(o => o.owner_wallet)).size
      };

    } catch (error) {
      console.error('❌ [MONTHLY-SNAPSHOT] Failed to complete monthly snapshot:', error);
      
      // Mark snapshot as failed
      try {
        await db.update(monthlyNftSnapshots)
          .set({
            processing_status: 'failed',
            updated_at: new Date()
          } as any)
          .where(eq(monthlyNftSnapshots.id, snapshotId));
      } catch (updateError) {
        console.error('❌ [MONTHLY-SNAPSHOT] Failed to update snapshot status:', updateError);
      }
      
      throw error;
    }
  }

  // Download all NFTs from XRPL using corrected Bithomp API
  private async downloadAllNfts() {
    console.log('🔍 [MONTHLY-SNAPSHOT] Downloading all NFTs from XRPL...');
    
    const allNfts = [];
    let marker: string | undefined;
    const limit = 200; // Reduced for stability
    let pageCount = 0;
    const maxPages = 5000; // Safety limit

    while (pageCount < maxPages) {
      try {
        pageCount++;
        console.log(`📥 [MONTHLY-SNAPSHOT] Downloading NFT batch ${pageCount}...`);
        
        // Build query parameters
        const params = new URLSearchParams({
          limit: String(limit)
        });
        
        if (marker) {
          params.append('marker', marker);
        }
        
        // Use corrected Bithomp API endpoint
        const response = await fetch(`https://bithomp.com/api/v2/nfts?${params}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'NFT-Snapshot-Service/1.0',
            ...(process.env.BITHOMP_API_KEY && { 'X-Bithomp-Token': process.env.BITHOMP_API_KEY })
          }
        });

        if (response.status === 429) {
          console.log('⏳ [MONTHLY-SNAPSHOT] Rate limited, waiting 5 seconds...');
          await new Promise(resolve => setTimeout(resolve, 5000));
          pageCount--; // Retry this page
          continue;
        }

        if (!response.ok) {
          console.error(`❌ [MONTHLY-SNAPSHOT] Bithomp API error: ${response.status} ${response.statusText}`);
          break;
        }

        const data: NftApiResponse = await response.json() as any;
        const nfts = data.nfts || [];
        
        if (nfts.length === 0) {
          console.log('📄 [MONTHLY-SNAPSHOT] No more NFTs to download');
          break;
        }

        // Process each NFT to standardize data
        for (const nft of nfts) {
          try {
            allNfts.push({
              token_id: nft.NFTokenID || nft.nftokenID || nft.token_id,
              issuer: nft.Issuer || nft.issuer,
              owner: nft.Owner || nft.owner,
              uri: nft.URI || nft.uri,
              is_burned: Boolean(nft.burned || nft.Burned),
              flags: nft.Flags || nft.flags || 0,
              transfer_fee: nft.TransferFee || nft.transferFee || 0,
              metadata: nft.metadata || {},
              collection: nft.collection_name || nft.collection || 'Unknown',
              listing_data: nft.sell_offers || nft.sellOffers || []
            });
          } catch (nftError) {
            console.error('❌ [MONTHLY-SNAPSHOT] Error processing individual NFT:', nftError);
          }
        }

        // Check for more data
        marker = data.marker;
        if (!marker || !data.hasMore) {
          console.log('📄 [MONTHLY-SNAPSHOT] Reached end of NFT data');
          break;
        }
        
        // Rate limiting - be respectful to API
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.error(`❌ [MONTHLY-SNAPSHOT] Error downloading NFT batch ${pageCount}:`, error);
        
        // Exponential backoff for retries
        if (pageCount < 3) {
          const delay = Math.pow(2, pageCount) * 1000;
          console.log(`⏳ [MONTHLY-SNAPSHOT] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          pageCount--; // Retry this page
        } else {
          console.log('❌ [MONTHLY-SNAPSHOT] Too many errors, stopping download');
          break;
        }
      }
    }

    console.log(`✅ [MONTHLY-SNAPSHOT] Downloaded ${allNfts.length} total NFTs in ${pageCount} batches`);
    return allNfts;
  }

  // Process individual NFT to determine ownership and listing status
  private async processNftOwnership(nft: any, snapshotMonth: string) {
    try {
      // Skip burned NFTs
      if (nft.is_burned) {
        return null;
      }

      // Determine if NFT is currently listed
      const isListed = nft.listing_data && nft.listing_data.length > 0;
      let listingPrice = '0';
      let listingPriceUsd = '0';

      if (isListed && nft.listing_data[0]) {
        const listing = nft.listing_data[0];
        listingPrice = listing.Amount || '0';
        // Convert drops to XRP if needed
        if (typeof listingPrice === 'string' && listingPrice.length > 6) {
          listingPrice = String(parseFloat(listingPrice) / 1000000);
        }
        const xrpPrice = await this.getXrpPrice();
        listingPriceUsd = String(parseFloat(listingPrice) * xrpPrice);
      }

      // Extract collection name from metadata or default
      let collectionName = nft.collection || 'Unknown Collection';
      if (nft.metadata && nft.metadata.collection) {
        collectionName = nft.metadata.collection;
      }

      // Create ownership record
      const ownershipRecord = {
        id: `nft-${snapshotMonth}-${nanoid(10)}`,
        snapshot_month: snapshotMonth,
        nft_token_id: nft.token_id,
        nft_issuer: nft.issuer,
        collection_name: collectionName,
        owner_wallet: nft.owner,
        is_listed: isListed,
        listing_price_xrp: isListed ? listingPrice : null,
        listing_price_usd: isListed ? listingPriceUsd : null,
        market_value_xrp: listingPrice, // Use listing as market value approximation
        market_value_usd: listingPriceUsd,
        rarity_rank: nft.metadata?.rarity_rank || null,
        metadata_uri: nft.uri,
        image_url: nft.metadata?.image || null,
        attributes: JSON.stringify(nft.metadata?.attributes || {}),
      };

      return ownershipRecord;
      
    } catch (error) {
      console.error(`❌ [MONTHLY-SNAPSHOT] Error processing NFT ownership:`, error);
      return null;
    }
  }

  // Calculate monthly reward eligibility based on NFT holdings and listing penalties
  private async calculateMonthlyRewardEligibility(snapshotMonth: string, ownershipData: any[]) {
    console.log(`💰 [MONTHLY-SNAPSHOT] Calculating reward eligibility for ${snapshotMonth}...`);

    // Group by wallet and collection
    const walletCollections = new Map();
    
    for (const ownership of ownershipData) {
      const key = `${ownership.owner_wallet}-${ownership.collection_name}`;
      if (!walletCollections.has(key)) {
        walletCollections.set(key, {
          wallet_address: ownership.owner_wallet,
          collection_name: ownership.collection_name,
          nfts_held: 0,
          nfts_listed: 0
        });
      }
      
      const record = walletCollections.get(key);
      record.nfts_held++;
      if (ownership.is_listed) {
        record.nfts_listed++;
      }
    }

    // Create reward eligibility records
    const eligibilityRecords = [];
    for (const [key, data] of walletCollections) {
      const penaltyApplied = data.nfts_listed > 0; // Penalty if ANY NFTs are listed
      
      eligibilityRecords.push({
        id: `eligibility-${snapshotMonth}-${nanoid(10)}`,
        snapshot_month: snapshotMonth,
        wallet_address: data.wallet_address,
        collection_name: data.collection_name,
        nfts_held: data.nfts_held,
        nfts_listed: data.nfts_listed,
        penalty_applied: penaltyApplied,
        reward_percentage: penaltyApplied ? '0' : '0.5', // 50% if no penalty, 0% if penalty
        estimated_reward_usd: '0', // To be calculated based on actual royalties
        reward_status: 'pending',
        penalty_reason: penaltyApplied ? `Listed ${data.nfts_listed} NFT(s) during reward period` : null
      });
    }

    // Batch insert eligibility records
    if (eligibilityRecords.length > 0) {
      const batchSize = 500;
      for (let i = 0; i < eligibilityRecords.length; i += batchSize) {
        const batch = eligibilityRecords.slice(i, i + batchSize);
        await db.insert(monthlyRewardEligibility).values(batch as any);
      }
      
      console.log(`✅ [MONTHLY-SNAPSHOT] Created reward eligibility for ${eligibilityRecords.length} wallet-collection pairs`);
    }
  }

  // Get monthly snapshot data for dashboard
  async getMonthlySnapshot(snapshotMonth?: string) {
    const month = snapshotMonth || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    
    try {
      // Get snapshot summary
      const [snapshot] = await db.select()
        .from(monthlyNftSnapshots)
        .where(eq(monthlyNftSnapshots.snapshot_date, month))
        .orderBy(desc(monthlyNftSnapshots.created_at))
        .limit(1);

      if (!snapshot) {
        return { error: 'No snapshot found for this month' };
      }

      // Get collection statistics
      const collectionStats = await db.select()
        .from(monthlyCollectionStats)
        .where(eq(monthlyCollectionStats.snapshot_month, month));

      // Get reward eligibility summary
      const [eligibilitySummary] = await db.select({
        total_eligible_wallets: sql<number>`COUNT(CASE WHEN penalty_applied = false THEN 1 END)`,
        total_penalized_wallets: sql<number>`COUNT(CASE WHEN penalty_applied = true THEN 1 END)`,
        total_collections: sql<number>`COUNT(DISTINCT collection_name)`
      }).from(monthlyRewardEligibility)
        .where(eq(monthlyRewardEligibility.snapshot_month, month));

      return {
        snapshot,
        collections: collectionStats,
        eligibility_summary: eligibilitySummary
      };
      
    } catch (error) {
      console.error('❌ [MONTHLY-SNAPSHOT] Error getting monthly snapshot:', error);
      throw error;
    }
  }

  // Get specific wallet's monthly NFT holdings
  async getWalletMonthlyHoldings(walletAddress: string, snapshotMonth?: string) {
    const month = snapshotMonth || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    
    try {
      // Get wallet's NFT holdings for the month
      const holdings = await db.select()
        .from(monthlyNftOwnership)
        .where(and(
          eq(monthlyNftOwnership.owner_wallet, walletAddress),
          eq(monthlyNftOwnership.snapshot_month, month)
        ));

      // Get reward eligibility
      const eligibility = await db.select()
        .from(monthlyRewardEligibility)
        .where(and(
          eq(monthlyRewardEligibility.wallet_address, walletAddress),
          eq(monthlyRewardEligibility.snapshot_month, month)
        ));

      return {
        holdings,
        eligibility,
        total_nfts: holdings.length,
        total_listed: holdings.filter(h => h.is_listed).length,
        collections: [...new Set(holdings.map(h => h.collection_name))]
      };
      
    } catch (error) {
      console.error('❌ [MONTHLY-SNAPSHOT] Error getting wallet holdings:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const monthlyNftSnapshotService = new MonthlyNftSnapshotService();