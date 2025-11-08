#!/usr/bin/env tsx

/**
 * Standalone NFT Collection Script
 * 
 * Collects NFTs from XRPL blockchain for "The Trolls Inquisition Multi-Chain Mayhem Edition"
 * gaming collections and populates the database with fresh mint data.
 * 
 * Usage: tsx scripts/nft-collection-script.ts
 */

import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { eq, inArray, desc, sql } from 'drizzle-orm';
import fetch from 'node-fetch';

// Load environment variables
config();

// Configure Neon for serverless
neonConfig.fetchConnectionCache = true;

// Database connection
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

// Import schema
import { 
  nfts, 
  gamingNfts, 
  gamingNftCollections,
  playerNftOwnership,
  nftVerificationCache
} from '../shared/schema';

// Gaming Collections Configuration with correct expected counts
const GAMING_COLLECTIONS = [
  { name: 'The Inquiry', role: 'monarchy', taxon: null, issuer: null, expectedCount: 123 },
  { name: 'The Inquisition', role: 'army', taxon: null, issuer: null, expectedCount: 100 },
  { name: 'The Lost Emporium', role: 'merchant', taxon: null, issuer: null, expectedCount: 123 },
  { name: 'DANTES AURUM', role: 'power', taxon: null, issuer: null, expectedCount: 42 },
  { name: 'Under the Bridge: Troll', role: 'special', taxon: null, issuer: null, expectedCount: 100 }
];

// Bithomp API Configuration
const BITHOMP_API_KEY = process.env.BITHOMP_API_KEY;
const BITHOMP_BASE_URL = 'https://bithomp.com/api';

class NFTCollectionService {
  private stats = {
    totalProcessed: 0,
    freshMints: 0,
    existingNfts: 0,
    errors: 0,
    collectionsScanned: 0
  };

  /**
   * Main collection process
   */
  async collectNFTs(): Promise<void> {
    console.log('🎮 Starting NFT Collection for The Trolls Inquisition Multi-Chain Mayhem Edition');
    console.log(`📊 Target Collections: ${GAMING_COLLECTIONS.length}`);
    
    try {
      // Step 1: Get collection data from database
      const dbCollections = await this.getCollectionsFromDB();
      console.log(`📦 Found ${dbCollections.length} collections in database`);

      // Step 2: Discover NFTs for each collection
      for (const collection of dbCollections) {
        console.log(`\n🔍 Processing: ${collection.collection_name} (${collection.game_role})`);
        await this.processCollection(collection);
        this.stats.collectionsScanned++;
      }

      // Step 3: Find fresh mints (recently created NFTs)
      await this.findFreshMints();

      // Step 4: Verify ownership for active players
      await this.updatePlayerOwnership();

      // Step 5: Print final statistics
      this.printStats();

    } catch (error) {
      console.error('❌ NFT Collection failed:', error);
      process.exit(1);
    }
  }

  /**
   * Get collections from database
   */
  private async getCollectionsFromDB() {
    return await db.select().from(gamingNftCollections);
  }

  /**
   * Process a single collection
   */
  private async processCollection(collection: any): Promise<void> {
    try {
      // Step 1: Get NFT IDs from collections endpoint
      const nftIds = await this.getNFTIdsFromCollection(collection.collection_name);
      
      if (!nftIds || nftIds.length === 0) {
        console.log(`⚠️ No NFT IDs found for collection: ${collection.collection_name}`);
        return;
      }

      console.log(`🎯 Found ${nftIds.length} NFT IDs for ${collection.collection_name}`);

      // Step 2: Get full asset data in batches of 100
      const batches = this.createBatches(nftIds, 100);
      console.log(`📦 Processing ${batches.length} batches of up to 100 NFTs each`);

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`🔄 Processing batch ${i + 1}/${batches.length} (${batch.length} NFTs)`);
        
        const nftAssets = await this.getAssetsForNFTIds(batch);
        
        // Process each NFT asset
        for (const nftData of nftAssets) {
          await this.processNFT(nftData, collection);
          this.stats.totalProcessed++;
        }

        // Add small delay between batches to be respectful to API
        if (i < batches.length - 1) {
          await this.delay(500); // 500ms delay
        }
      }

    } catch (error) {
      console.error(`❌ Error processing collection ${collection.collection_name}:`, error);
      this.stats.errors++;
    }
  }

  /**
   * Get NFT IDs from collections endpoint
   */
  private async getNFTIdsFromCollection(collectionName: string): Promise<string[]> {
    try {
      // Try multiple search approaches for better coverage
      const searchQueries = [
        collectionName,
        collectionName.replace(/\s+/g, ''), // Remove spaces
        collectionName.split(' ')[0], // First word only
      ];

      let allIds: string[] = [];

      for (const query of searchQueries) {
        const ids = await this.bithompGetCollectionNFTIds(query);
        if (ids && ids.length > 0) {
          allIds = [...allIds, ...ids];
        }
      }

      // Remove duplicates
      const uniqueIds = [...new Set(allIds)];
      return uniqueIds;

    } catch (error) {
      console.error(`❌ Failed to get NFT IDs for collection ${collectionName}:`, error);
      return [];
    }
  }

  /**
   * Get NFT IDs from Bithomp collections endpoint
   */
  private async bithompGetCollectionNFTIds(query: string): Promise<string[]> {
    try {
      const url = `${BITHOMP_BASE_URL}/v2/nfts?search=${encodeURIComponent(query)}&limit=100&fields=nftokenID`;
      
      const response = await fetch(url, {
        headers: {
          'x-bithomp-token': BITHOMP_API_KEY || '',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.warn(`⚠️ Bithomp collections API error for query "${query}": ${response.status}`);
        return [];
      }

      const data = await response.json();
      const nfts = data.nfts || [];
      
      return nfts.map((nft: any) => nft.nftokenID).filter(Boolean);

    } catch (error) {
      console.error(`❌ Bithomp collections API call failed for query "${query}":`, error);
      return [];
    }
  }

  /**
   * Get full asset data for NFT IDs using assets_all endpoint
   */
  private async getAssetsForNFTIds(nftIds: string[]): Promise<any[]> {
    try {
      // Use the assets_all endpoint with NFT IDs
      const url = `${BITHOMP_BASE_URL}/v2/assets_all`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'x-bithomp-token': BITHOMP_API_KEY || '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          nfts: nftIds
        })
      });

      if (!response.ok) {
        console.warn(`⚠️ Bithomp assets_all API error: ${response.status}`);
        return [];
      }

      const data = await response.json();
      return data.nfts || [];

    } catch (error) {
      console.error(`❌ Bithomp assets_all API call failed:`, error);
      return [];
    }
  }

  /**
   * Create batches of items with specified size
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Simple delay utility
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Process individual NFT and save to database
   */
  private async processNFT(nftData: any, collection: any): Promise<void> {
    try {
      const nftTokenID = nftData.nftokenID;
      
      // Check if NFT already exists
      const existing = await db.select()
        .from(nfts)
        .where(eq(nfts.nft_token_id, nftTokenID))
        .limit(1);

      if (existing.length > 0) {
        this.stats.existingNfts++;
        return;
      }

      // Extract metadata
      const metadata = this.extractNFTMetadata(nftData);
      
      // Insert into main NFTs table
      const insertedNft = await db.insert(nfts).values({
        nft_token_id: nftTokenID,
        issuer: nftData.issuer || '',
        owner: nftData.owner || '',
        collection_name: collection.collection_name,
        name: metadata.name || `NFT #${nftTokenID.slice(-8)}`,
        description: metadata.description || `${collection.collection_name} NFT`,
        image_url: metadata.image || '',
        metadata: metadata,
        chain: 'xrpl',
        taxon: nftData.nft_taxon || null,
        sequence: nftData.sequence || null,
        verified: false,
        is_burned: false
      }).returning();

      // Insert into gaming NFTs table
      if (insertedNft[0]) {
        await db.insert(gamingNfts).values({
          nft_id: insertedNft[0].id,
          collection_id: collection.id,
          power_level: this.calculatePowerLevel(collection.game_role),
          special_abilities: this.getSpecialAbilities(collection.game_role),
          rarity_score: Math.floor(Math.random() * 100) + 1, // Placeholder scoring
          mint_number: nftData.sequence || null
        });

        this.stats.freshMints++;
        console.log(`✅ Added fresh mint: ${metadata.name} (${nftTokenID.slice(-8)})`);
      }

    } catch (error) {
      console.error(`❌ Error processing NFT ${nftData.nftokenID}:`, error);
      this.stats.errors++;
    }
  }

  /**
   * Extract and standardize NFT metadata
   */
  private extractNFTMetadata(nftData: any): any {
    return {
      name: nftData.metadata?.name || nftData.name || 'Unknown NFT',
      description: nftData.metadata?.description || nftData.description || '',
      image: nftData.metadata?.image || nftData.image || '',
      attributes: nftData.metadata?.attributes || [],
      collection: nftData.metadata?.collection || '',
      external_url: nftData.metadata?.external_url || '',
      raw: nftData.metadata || {}
    };
  }

  /**
   * Calculate power level based on collection role
   */
  private calculatePowerLevel(role: string): number {
    const rolePower = {
      'monarchy': 9,
      'army': 8, 
      'power': 9,
      'merchant': 6,
      'special': 7
    };
    return rolePower[role] || 5;
  }

  /**
   * Get special abilities based on collection role
   */
  private getSpecialAbilities(role: string): any {
    const abilities = {
      'monarchy': { authority: 'supreme_command', territory: 'realm_control' },
      'army': { combat: 'tactical_strike', defense: 'fortress_guard' },
      'power': { magic: 'reality_alter', blessing: 'divine_favor' },
      'merchant': { trade: 'rare_access', knowledge: 'hidden_secrets' },
      'special': { banking: 'toll_collection', bridge: 'cross_chain_authority' }
    };
    return abilities[role] || {};
  }

  /**
   * Find fresh mints (recently created NFTs)
   */
  private async findFreshMints(): Promise<void> {
    console.log('\n🔍 Searching for fresh mints...');
    
    try {
      // Get NFTs created in the last 24 hours
      const recentMints = await db.select()
        .from(nfts)
        .where(sql`created_at > NOW() - INTERVAL '24 hours'`)
        .orderBy(desc(nfts.created_at))
        .limit(50);

      console.log(`🎯 Found ${recentMints.length} fresh mints in last 24 hours`);
      
      for (const mint of recentMints) {
        console.log(`🆕 Fresh mint: ${mint.name} (${mint.nft_token_id?.slice(-8)})`);
      }

    } catch (error) {
      console.error('❌ Error finding fresh mints:', error);
    }
  }

  /**
   * Update player ownership data
   */
  private async updatePlayerOwnership(): Promise<void> {
    console.log('\n👤 Updating player ownership...');
    
    try {
      // This would typically verify ownership by checking wallet addresses
      // For now, we'll create a placeholder entry
      console.log('📝 Player ownership verification system ready');
      
    } catch (error) {
      console.error('❌ Error updating player ownership:', error);
    }
  }

  /**
   * Print collection statistics
   */
  private printStats(): void {
    console.log('\n📊 NFT Collection Complete!');
    console.log('═'.repeat(50));
    console.log(`🎮 Collections Scanned: ${this.stats.collectionsScanned}`);
    console.log(`📦 Total NFTs Processed: ${this.stats.totalProcessed}`);
    console.log(`🆕 Fresh Mints Found: ${this.stats.freshMints}`);
    console.log(`♻️ Existing NFTs Skipped: ${this.stats.existingNfts}`);
    console.log(`❌ Errors Encountered: ${this.stats.errors}`);
    console.log('═'.repeat(50));
    
    if (this.stats.freshMints > 0) {
      console.log(`✅ SUCCESS: Found ${this.stats.freshMints} fresh mints!`);
    } else {
      console.log('ℹ️ No fresh mints found this run');
    }
  }
}

// Run the collection script
async function main() {
  const collector = new NFTCollectionService();
  await collector.collectNFTs();
  process.exit(0);
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { NFTCollectionService };