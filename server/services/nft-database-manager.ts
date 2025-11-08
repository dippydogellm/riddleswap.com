/**
 * Comprehensive NFT Database Manager
 * 
 * Provides get/put functionality for NFT ownership assignment across all collections
 * Ensures all nft_id for each collection are properly tracked and stored
 */

import { db } from '../db';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { 
  gamingNfts, 
  gamingNftCollections,
  playerNftOwnership,
  nftOwnershipHistory
} from '../../shared/schema';

export interface NftDatabaseEntry {
  id: string;
  nft_id: string;
  collection_id: string;
  collection_name: string;
  issuer_address: string;
  owner_address: string | null;
  token_id: string;
  name: string | null;
  image_url: string | null;
  power_multiplier: string | null;
  metadata: Record<string, any> | null;
  last_transferred: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CollectionSummary {
  collection_id: string;
  collection_name: string;
  issuer_address: string;
  total_nfts: number;
  nft_ids: (string | null)[];
  owned_count: number;
  unassigned_count: number;
  owners: string[];
}

export interface OwnershipAssignment {
  nft_id: string;
  previous_owner: string | null;
  new_owner: string;
  change_reason: string;
  power_level?: number;
}

export class NftDatabaseManager {
  
  /**
   * GET: Retrieve all NFT IDs for a specific collection
   */
  async getAllNftIdsForCollection(collectionIssuer: string): Promise<string[]> {
    try {
      const collection = await db
        .select({ id: gamingNftCollections.id })
        .from(gamingNftCollections)
        .where(eq(gamingNftCollections.collection_id, collectionIssuer))
        .limit(1);

      if (collection.length === 0) {
        console.log(`📦 [NFT-DB] No collection found for issuer: ${collectionIssuer}`);
        return [];
      }

      const nfts = await db
        .select({ nft_id: gamingNfts.nft_id })
        .from(gamingNfts)
        .where(eq(gamingNfts.collection_id, collection[0].id))
        .orderBy(gamingNfts.created_at);

      const nftIds = nfts.map(nft => nft.nft_id);
      console.log(`📊 [NFT-DB] Found ${nftIds.length} NFT IDs for collection ${collectionIssuer}`);
      return nftIds;
    } catch (error) {
      console.error(`❌ [NFT-DB] Error getting NFT IDs for collection ${collectionIssuer}:`, error);
      throw error;
    }
  }

  /**
   * GET: Retrieve all NFTs for a specific collection with full details
   */
  async getAllNftsForCollection(collectionIssuer: string): Promise<NftDatabaseEntry[]> {
    try {
      const nfts = await db
        .select({
          id: gamingNfts.id,
          nft_id: gamingNfts.nft_id,
          collection_id: gamingNfts.collection_id,
          collection_name: gamingNftCollections.collection_name,
          issuer_address: gamingNftCollections.collection_id,
          owner_address: gamingNfts.owner_address,
          token_id: gamingNfts.token_id,
          name: gamingNfts.name,
          image_url: gamingNfts.image_url,
          power_multiplier: gamingNfts.power_multiplier,
          metadata: gamingNfts.metadata,
          last_transferred: gamingNfts.last_transferred,
          created_at: gamingNfts.created_at,
          updated_at: gamingNfts.updated_at
        })
        .from(gamingNfts)
        .innerJoin(gamingNftCollections, eq(gamingNfts.collection_id, gamingNftCollections.id))
        .where(eq(gamingNftCollections.collection_id, collectionIssuer))
        .orderBy(gamingNfts.created_at);

      console.log(`📊 [NFT-DB] Retrieved ${nfts.length} NFTs for collection ${collectionIssuer}`);
      return nfts;
    } catch (error) {
      console.error(`❌ [NFT-DB] Error getting NFTs for collection ${collectionIssuer}:`, error);
      throw error;
    }
  }

  /**
   * GET: Get collection summary with NFT counts and ownership stats
   */
  async getCollectionSummary(collectionIssuer: string): Promise<CollectionSummary | null> {
    try {
      const collection = await db
        .select({
          collection_id: gamingNftCollections.collection_id,
          collection_name: gamingNftCollections.collection_name,
          db_id: gamingNftCollections.id
        })
        .from(gamingNftCollections)
        .where(eq(gamingNftCollections.collection_id, collectionIssuer))
        .limit(1);

      if (collection.length === 0) {
        return null;
      }

      const collectionData = collection[0];

      const nfts = await db
        .select({
          nft_id: gamingNfts.nft_id,
          owner_address: gamingNfts.owner_address
        })
        .from(gamingNfts)
        .where(eq(gamingNfts.collection_id, collectionData.db_id));

      const nft_ids = nfts.map(nft => nft.nft_id).filter((id): id is string => id !== null);
      const owners = Array.from(new Set(nfts.map(nft => nft.owner_address).filter((addr): addr is string => addr !== null)));
      const owned_count = nfts.filter(nft => nft.owner_address).length;
      const unassigned_count = nfts.length - owned_count;

      return {
        collection_id: collectionData.collection_id,
        collection_name: collectionData.collection_name,
        issuer_address: collectionData.collection_id,
        total_nfts: nfts.length,
        nft_ids,
        owned_count,
        unassigned_count,
        owners
      };
    } catch (error) {
      console.error(`❌ [NFT-DB] Error getting collection summary for ${collectionIssuer}:`, error);
      throw error;
    }
  }

  /**
   * GET: Get all collections and their NFT counts
   */
  async getAllCollectionsSummary(): Promise<CollectionSummary[]> {
    try {
      const collections = await db
        .select({
          collection_id: gamingNftCollections.collection_id,
          collection_name: gamingNftCollections.collection_name,
          db_id: gamingNftCollections.id
        })
        .from(gamingNftCollections)
        .where(eq(gamingNftCollections.active_in_game, true))
        .orderBy(gamingNftCollections.collection_name);

      const summaries: CollectionSummary[] = [];

      for (const collection of collections) {
        const summary = await this.getCollectionSummary(collection.collection_id);
        if (summary) {
          summaries.push(summary);
        }
      }

      console.log(`📊 [NFT-DB] Retrieved summaries for ${summaries.length} active collections`);
      return summaries;
    } catch (error) {
      console.error(`❌ [NFT-DB] Error getting all collections summary:`, error);
      throw error;
    }
  }

  /**
   * GET: Find NFTs by owner address across all collections
   */
  async getNftsByOwner(ownerAddress: string): Promise<NftDatabaseEntry[]> {
    try {
      const nfts = await db
        .select({
          id: gamingNfts.id,
          nft_id: gamingNfts.nft_id,
          collection_id: gamingNfts.collection_id,
          collection_name: gamingNftCollections.collection_name,
          issuer_address: gamingNftCollections.collection_id,
          owner_address: gamingNfts.owner_address,
          token_id: gamingNfts.token_id,
          name: gamingNfts.name,
          image_url: gamingNfts.image_url,
          power_multiplier: gamingNfts.power_multiplier,
          metadata: gamingNfts.metadata,
          last_transferred: gamingNfts.last_transferred,
          created_at: gamingNfts.created_at,
          updated_at: gamingNfts.updated_at
        })
        .from(gamingNfts)
        .innerJoin(gamingNftCollections, eq(gamingNfts.collection_id, gamingNftCollections.id))
        .where(eq(gamingNfts.owner_address, ownerAddress))
        .orderBy(desc(gamingNfts.last_transferred));

      console.log(`👤 [NFT-DB] Found ${nfts.length} NFTs owned by ${ownerAddress}`);
      return nfts;
    } catch (error) {
      console.error(`❌ [NFT-DB] Error getting NFTs for owner ${ownerAddress}:`, error);
      throw error;
    }
  }

  /**
   * PUT: Assign NFT ownership to a new owner
   */
  async assignNftOwnership(assignment: OwnershipAssignment): Promise<boolean> {
    try {
      // Get current NFT data
      const currentNft = await db
        .select({
          id: gamingNfts.id,
          owner_address: gamingNfts.owner_address,
          collection_id: gamingNfts.collection_id,
          nft_id: gamingNfts.nft_id
        })
        .from(gamingNfts)
        .where(eq(gamingNfts.nft_id, assignment.nft_id))
        .limit(1);

      if (currentNft.length === 0) {
        console.error(`❌ [NFT-DB] NFT not found: ${assignment.nft_id}`);
        return false;
      }

      const nft = currentNft[0];
      const previousOwner = nft.owner_address;

      // Update NFT ownership
      await db
        .update(gamingNfts)
        .set({ 
          owner_address: assignment.new_owner,
          last_transferred: new Date(),
          updated_at: new Date()
         } as any)
        .where(eq(gamingNfts.id, nft.id));

      // Record ownership history
      await (db.insert(nftOwnershipHistory) as any).values({
        nft_id: assignment.nft_id,
        collection_issuer: nft.collection_id, // This is the collection DB ID, we should get the issuer
        nft_token_id: assignment.nft_id,
        previous_owner: previousOwner,
        new_owner: assignment.new_owner,
        change_reason: assignment.change_reason,
        power_level: assignment.power_level || 100,
        changed_at: new Date()
      });

      console.log(`✅ [NFT-DB] Assigned NFT ${assignment.nft_id} from ${previousOwner || 'unassigned'} to ${assignment.new_owner}`);
      return true;
    } catch (error) {
      console.error(`❌ [NFT-DB] Error assigning NFT ownership:`, error);
      throw error;
    }
  }

  /**
   * PUT: Batch assign multiple NFTs to new owners
   */
  async batchAssignNftOwnership(assignments: OwnershipAssignment[]): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    console.log(`🔄 [NFT-DB] Starting batch assignment of ${assignments.length} NFTs`);

    for (const assignment of assignments) {
      try {
        const result = await this.assignNftOwnership(assignment);
        if (result) {
          success++;
        } else {
          failed++;
        }
        
        // Small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 10));
      } catch (error) {
        console.error(`❌ [NFT-DB] Failed to assign ${assignment.nft_id}:`, error);
        failed++;
      }
    }

    console.log(`✅ [NFT-DB] Batch assignment complete: ${success} success, ${failed} failed`);
    return { success, failed };
  }

  /**
   * PUT: Remove NFT ownership (set owner to null)
   */
  async removeNftOwnership(nft_id: string, reason: string = 'manual_removal'): Promise<boolean> {
    try {
      const currentNft = await db
        .select({
          id: gamingNfts.id,
          owner_address: gamingNfts.owner_address,
          collection_id: gamingNfts.collection_id
        })
        .from(gamingNfts)
        .where(eq(gamingNfts.nft_id, nft_id))
        .limit(1);

      if (currentNft.length === 0) {
        console.error(`❌ [NFT-DB] NFT not found: ${nft_id}`);
        return false;
      }

      const nft = currentNft[0];
      const previousOwner = nft.owner_address;

      // Update NFT to remove ownership
      await db
        .update(gamingNfts)
        .set({ 
          owner_address: null,
          last_transferred: new Date(),
          updated_at: new Date()
         } as any)
        .where(eq(gamingNfts.id, nft.id));

      // Record ownership history
      if (previousOwner) {
        await (db.insert(nftOwnershipHistory) as any).values({
          nft_id: nft_id,
          collection_issuer: nft.collection_id,
          nft_token_id: nft_id,
          previous_owner: previousOwner,
          new_owner: '', // Empty string indicates removal
          change_reason: reason,
          power_level: 0,
          changed_at: new Date()
        });
      }

      console.log(`🗑️ [NFT-DB] Removed ownership of NFT ${nft_id} from ${previousOwner || 'unassigned'}`);
      return true;
    } catch (error) {
      console.error(`❌ [NFT-DB] Error removing NFT ownership:`, error);
      throw error;
    }
  }

  /**
   * UTILITY: Get ownership history for an NFT
   */
  async getNftOwnershipHistory(nft_id: string): Promise<any[]> {
    try {
      const history = await db
        .select()
        .from(nftOwnershipHistory)
        .where(eq(nftOwnershipHistory.nft_id, nft_id))
        .orderBy(desc(nftOwnershipHistory.changed_at));

      return history;
    } catch (error) {
      console.error(`❌ [NFT-DB] Error getting ownership history for ${nft_id}:`, error);
      throw error;
    }
  }

  /**
   * UTILITY: Verify database consistency for all collections
   */
  async verifyDatabaseConsistency(): Promise<{
    total_collections: number;
    total_nfts: number;
    owned_nfts: number;
    unassigned_nfts: number;
    consistency_issues: string[];
  }> {
    try {
      const collections = await db.select().from(gamingNftCollections);
      const nfts = await db.select().from(gamingNfts);
      
      const owned_nfts = nfts.filter(nft => nft.owner_address).length;
      const unassigned_nfts = nfts.length - owned_nfts;
      const consistency_issues: string[] = [];

      // Check for NFTs without valid collections
      const collectionIds = new Set(collections.map(c => c.id));
      for (const nft of nfts) {
        if (!collectionIds.has(nft.collection_id)) {
          consistency_issues.push(`NFT ${nft.nft_id} references non-existent collection ${nft.collection_id}`);
        }
      }

      // Check for duplicate NFT IDs
      const nftIds = nfts.map(n => n.nft_id);
      const uniqueNftIds = new Set(nftIds);
      if (nftIds.length !== uniqueNftIds.size) {
        consistency_issues.push('Duplicate NFT IDs found in database');
      }

      const result = {
        total_collections: collections.length,
        total_nfts: nfts.length,
        owned_nfts,
        unassigned_nfts,
        consistency_issues
      };

      console.log(`🔍 [NFT-DB] Database consistency check complete:`, result);
      return result;
    } catch (error) {
      console.error(`❌ [NFT-DB] Error verifying database consistency:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const nftDatabaseManager = new NftDatabaseManager();