/**
 * STAGE 2: NFT Trait Rarity Scorer
 * 
 * Purpose: Parse ALL NFT traits and calculate rarity scores based on trait percentages
 * Handles 1000s of different projects with different trait structures
 * 
 * Flow:
 * 1. Fetch all NFTs from gaming_nfts table (populated by Stage 1 scanner)
 * 2. Parse traits from metadata.attributes
 * 3. Calculate trait rarity percentages across the collection
 * 4. Generate rarity scores based on trait frequency
 * 5. Store in project_scorecards for AI scoring
 * 6. Prepare for Stage 3: Battle results integration
 */

import { db } from '../db';
import { gamingNfts, gamingNftCollections } from '../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';

interface TraitValue {
  trait_type: string;
  value: string;
  count: number;
  percentage: number;
}

interface CollectionTraits {
  [traitType: string]: {
    [value: string]: {
      count: number;
      percentage: number;
    };
  };
}

interface NFTRarityScore {
  nft_id: string;
  token_id: string;
  traits: Array<{ trait_type: string; value: string }>;
  trait_scores: Array<{ trait_type: string; value: string; rarity_percentage: number; rarity_score: number }>;
  total_rarity_score: number;
  rarity_rank: number | null;
}

export class TraitRarityScorer {
  
  /**
   * MAIN METHOD: Scan and score all NFTs in a collection
   */
  async scoreCollection(collectionId: string): Promise<{
    collection_id: string;
    total_nfts: number;
    traits_analyzed: number;
    nfts_scored: number;
    average_rarity: number;
  }> {
    console.log(`\n🎯 [TRAIT SCORER] Starting rarity calculation for collection: ${collectionId}`);
    
    try {
      // Step 1: Fetch ALL NFTs from the collection
      const nfts = await db
        .select()
        .from(gamingNfts)
        .where(eq(gamingNfts.collection_id, collectionId));

      if (nfts.length === 0) {
        console.warn(`⚠️  [TRAIT SCORER] No NFTs found for collection ${collectionId}`);
        return {
          collection_id: collectionId,
          total_nfts: 0,
          traits_analyzed: 0,
          nfts_scored: 0,
          average_rarity: 0
        };
      }

      console.log(`📊 [TRAIT SCORER] Found ${nfts.length} NFTs in collection`);

      // Step 2: Parse all traits from metadata
      const collectionTraits = this.parseAllTraits(nfts);
      const traitTypeCount = Object.keys(collectionTraits).length;
      
      console.log(`📋 [TRAIT SCORER] Analyzed ${traitTypeCount} unique trait types`);
      
      // Step 3: Calculate rarity scores for each NFT
      const scoredNfts = this.calculateRarityScores(nfts, collectionTraits);
      
      console.log(`✅ [TRAIT SCORER] Scored ${scoredNfts.length} NFTs`);

      // Step 4: Rank NFTs by rarity (1 = rarest)
      const rankedNfts = this.rankNftsByRarity(scoredNfts);
      
      // Step 5: Store rarity scores back to database
      await this.storeRarityScores(rankedNfts);
      
      console.log(`💾 [TRAIT SCORER] Stored rarity scores for ${rankedNfts.length} NFTs`);

      // Step 6: Calculate average rarity
      const totalRarity = rankedNfts.reduce((sum, nft) => sum + nft.total_rarity_score, 0);
      const avgRarity = totalRarity / rankedNfts.length;

      return {
        collection_id: collectionId,
        total_nfts: nfts.length,
        traits_analyzed: traitTypeCount,
        nfts_scored: rankedNfts.length,
        average_rarity: Math.round(avgRarity * 100) / 100
      };

    } catch (error: any) {
      console.error(`❌ [TRAIT SCORER] Failed to score collection ${collectionId}:`, error.message);
      throw error;
    }
  }

  /**
   * Parse all traits from NFT metadata
   * Handles ANY trait structure: attributes[], properties{}, traits[], etc.
   */
  private parseAllTraits(nfts: any[]): CollectionTraits {
    const collectionTraits: CollectionTraits = {};

    for (const nft of nfts) {
      let traits: Array<{ trait_type: string; value: any }> = [];

      // Try different metadata structures
      const metadata = nft.metadata || {};
      
      // Standard: metadata.attributes[]
      if (Array.isArray(metadata.attributes)) {
        traits = metadata.attributes;
      }
      // Alternative: metadata.traits[]
      else if (Array.isArray(metadata.traits)) {
        traits = metadata.traits.map((t: any) => ({
          trait_type: t.trait_type || t.name || 'Unknown',
          value: t.value
        }));
      }
      // Alternative: metadata.properties{}
      else if (metadata.properties && typeof metadata.properties === 'object') {
        traits = Object.entries(metadata.properties).map(([key, value]) => ({
          trait_type: key,
          value: value
        }));
      }
      // Direct metadata keys (rare but possible)
      else if (Object.keys(metadata).length > 0) {
        // Filter out standard metadata fields
        const excludeKeys = ['name', 'description', 'image', 'external_url', 'background_color'];
        traits = Object.entries(metadata)
          .filter(([key]) => !excludeKeys.includes(key))
          .map(([key, value]) => ({
            trait_type: key,
            value: value
          }));
      }

      // Count trait occurrences
      for (const trait of traits) {
        if (!trait.trait_type || trait.value === null || trait.value === undefined) continue;

        const traitType = String(trait.trait_type);
        const traitValue = String(trait.value);

        if (!collectionTraits[traitType]) {
          collectionTraits[traitType] = {};
        }

        if (!collectionTraits[traitType][traitValue]) {
          collectionTraits[traitType][traitValue] = { count: 0, percentage: 0 };
        }

        collectionTraits[traitType][traitValue].count++;
      }
    }

    // Calculate percentages
    const totalNfts = nfts.length;
    for (const traitType of Object.keys(collectionTraits)) {
      for (const value of Object.keys(collectionTraits[traitType])) {
        const count = collectionTraits[traitType][value].count;
        collectionTraits[traitType][value].percentage = (count / totalNfts) * 100;
      }
    }

    return collectionTraits;
  }

  /**
   * Calculate rarity score for each NFT
   * Rarity Score Formula: Sum of (1 / trait_percentage) for each trait
   * Rare traits (low percentage) = higher score
   */
  private calculateRarityScores(nfts: any[], collectionTraits: CollectionTraits): NFTRarityScore[] {
    const scoredNfts: NFTRarityScore[] = [];

    for (const nft of nfts) {
      let traits: Array<{ trait_type: string; value: any }> = [];
      const metadata = nft.metadata || {};

      // Parse traits (same logic as above)
      if (Array.isArray(metadata.attributes)) {
        traits = metadata.attributes;
      } else if (Array.isArray(metadata.traits)) {
        traits = metadata.traits.map((t: any) => ({
          trait_type: t.trait_type || t.name || 'Unknown',
          value: t.value
        }));
      } else if (metadata.properties) {
        traits = Object.entries(metadata.properties).map(([key, value]) => ({
          trait_type: key,
          value: value
        }));
      }

      const traitScores: Array<{
        trait_type: string;
        value: string;
        rarity_percentage: number;
        rarity_score: number;
      }> = [];

      let totalScore = 0;

      for (const trait of traits) {
        if (!trait.trait_type || trait.value === null || trait.value === undefined) continue;

        const traitType = String(trait.trait_type);
        const traitValue = String(trait.value);

        // Get trait percentage
        const traitData = collectionTraits[traitType]?.[traitValue];
        if (!traitData) continue;

        const percentage = traitData.percentage;
        // Rarity score: inverse of percentage (rare = higher score)
        // Formula: 1 / (percentage / 100) = 100 / percentage
        const rarityScore = 100 / percentage;

        traitScores.push({
          trait_type: traitType,
          value: traitValue,
          rarity_percentage: Math.round(percentage * 100) / 100,
          rarity_score: Math.round(rarityScore * 100) / 100
        });

        totalScore += rarityScore;
      }

      scoredNfts.push({
        nft_id: nft.nft_id,
        token_id: nft.token_id,
        traits: traits.map(t => ({ trait_type: String(t.trait_type), value: String(t.value) })),
        trait_scores: traitScores,
        total_rarity_score: Math.round(totalScore * 100) / 100,
        rarity_rank: null // Will be set in ranking step
      });
    }

    return scoredNfts;
  }

  /**
   * Rank NFTs by rarity score (1 = rarest, highest score)
   */
  private rankNftsByRarity(scoredNfts: NFTRarityScore[]): NFTRarityScore[] {
    // Sort by total rarity score (descending - highest = rarest)
    scoredNfts.sort((a, b) => b.total_rarity_score - a.total_rarity_score);

    // Assign ranks
    scoredNfts.forEach((nft, index) => {
      nft.rarity_rank = index + 1;
    });

    return scoredNfts;
  }

  /**
   * Store rarity scores back to gaming_nfts table
   */
  private async storeRarityScores(scoredNfts: NFTRarityScore[]): Promise<void> {
    for (const nft of scoredNfts) {
      try {
        await db
          .update(gamingNfts)
          .set({
            rarity_score: nft.total_rarity_score.toString(),
            rarity_rank: nft.rarity_rank,
            trait_rarity_breakdown: nft.trait_scores as any,
            updated_at: new Date()
          } as any)
          .where(eq(gamingNfts.nft_id, nft.nft_id));
      } catch (error: any) {
        console.error(`❌ Failed to store rarity for NFT ${nft.nft_id}:`, error.message);
      }
    }
  }

  /**
   * Score ALL collections in the database
   */
  async scoreAllCollections(): Promise<{
    collections_scored: number;
    total_nfts_scored: number;
    results: Array<{
      collection_id: string;
      collection_name: string;
      nfts_scored: number;
      average_rarity: number;
    }>;
  }> {
    console.log(`\n🌐 [TRAIT SCORER] Starting rarity calculation for ALL collections...`);

    try {
      // Get all active collections
      const collections = await db
        .select()
        .from(gamingNftCollections);

      console.log(`📊 [TRAIT SCORER] Found ${collections.length} collections`);

      const results = [];
      let totalNftsScored = 0;

      for (const collection of collections) {
        try {
          const result = await this.scoreCollection(collection.id);
          
          results.push({
            collection_id: collection.id,
            collection_name: collection.collection_name || 'Unknown',
            nfts_scored: result.nfts_scored,
            average_rarity: result.average_rarity
          });

          totalNftsScored += result.nfts_scored;
        } catch (error: any) {
          console.error(`❌ Failed to score collection ${collection.id}:`, error.message);
        }
      }

      console.log(`\n✅ [TRAIT SCORER] Completed rarity calculation:`);
      console.log(`   📦 Collections scored: ${results.length}`);
      console.log(`   🎯 Total NFTs scored: ${totalNftsScored}`);

      return {
        collections_scored: results.length,
        total_nfts_scored: totalNftsScored,
        results
      };

    } catch (error: any) {
      console.error(`❌ [TRAIT SCORER] Failed to score all collections:`, error.message);
      throw error;
    }
  }
}
