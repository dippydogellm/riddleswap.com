/**
 * NFT Rarity Scoring Service
 * 
 * Calculates trait-based rarity scores for NFT collections.
 * Each trait's rarity is determined by how often it appears in the collection.
 * 
 * Rarity Score Formula:
 * - Trait Score = 100 - (trait_count / total_nfts * 100)
 * - Total NFT Score = Sum of all trait scores
 * - Rarity Rank = Position when sorted by total score (descending)
 */

import { db } from '../db';
import { eq, sql, desc, and } from 'drizzle-orm';
import { gamingNfts, inquisitionNftAudit } from '../../shared/schema';
import { inquisitionCollections } from '../../shared/inquisition-audit-schema';
import { 
  projectTraitScores, 
  nftRarityScorecards, 
  projectCollectionStats,
  rarityCalculationHistory 
} from '../../shared/project-scorecard-schema';
import {
  projectMasterTraitCards,
  projectTraitRarityConfig
} from '../../shared/project-master-card-schema';

interface TraitData {
  trait_type: string;
  value: string;
}

interface NFTWithTraits {
  nft_id: string;
  name: string;
  traits: TraitData[];
}

interface TraitRarity {
  trait_type: string;
  trait_value: string;
  count: number;
  percentage: number;
  score: number;
}

export class RarityScoringService {
  
  /**
   * Calculate rarity scores for entire collection
   */
  async calculateCollectionRarity(collectionId: string, projectId?: number): Promise<void> {
    const startTime = Date.now();
    const historyId = crypto.randomUUID();
    
    try {
      console.log(`🎯 [RARITY] Starting rarity calculation for collection: ${collectionId}`);
      
      // Record calculation start
      await db.insert(rarityCalculationHistory).values({
        collection_id: collectionId,
        calculation_type: 'full',
        status: 'started',
        started_at: new Date(),
      });
      
      // Get collection info
      const [issuer, taxon] = collectionId.split(':');
      const collection = await db
        .select()
        .from(inquisitionCollections)
        .where(and(
          eq(inquisitionCollections.issuer_address, issuer),
          eq(inquisitionCollections.taxon, parseInt(taxon))
        ))
        .limit(1);
      
      if (collection.length === 0) {
        throw new Error(`Collection not found: ${collectionId}`);
      }
      
      const collectionName = collection[0].collection_name;
      const collectionProjectId = projectId || collection[0].project_id;
      
      // Load master trait card if project is linked
      let masterCard = null;
      let traitConfigs: Record<string, any> = {};
      
      if (collectionProjectId) {
        const cards = await db
          .select()
          .from(projectMasterTraitCards)
          .where(eq(projectMasterTraitCards.project_id, collectionProjectId))
          .limit(1);
        
        if (cards.length > 0) {
          masterCard = cards[0];
          console.log(`🎴 [RARITY] Using master trait card: ${masterCard.project_name}`);
          
          // Load trait-specific configs
          const configs = await db
            .select()
            .from(projectTraitRarityConfig)
            .where(eq(projectTraitRarityConfig.project_id, collectionProjectId));
          
          for (const config of configs) {
            const key = `${config.trait_type}:${config.trait_value || '*'}`;
            traitConfigs[key] = config;
          }
        }
      }
      
      // Get all NFTs in collection with traits
      const nfts = await db
        .select({
          nft_id: inquisitionNftAudit.nft_token_id,
          name: inquisitionNftAudit.name,
          traits: inquisitionNftAudit.traits,
        })
        .from(inquisitionNftAudit)
        .where(and(
          eq(inquisitionNftAudit.issuer_address, issuer),
          eq(inquisitionNftAudit.taxon, parseInt(taxon))
        ));
      
      if (nfts.length === 0) {
        console.log(`⚠️ [RARITY] No NFTs found for collection: ${collectionId}`);
        await db.update(rarityCalculationHistory)
          .set({ 
            status: 'failed'
          })
          .where(eq(rarityCalculationHistory.collection_id, collectionId));
        return;
      }
      
      console.log(`📊 [RARITY] Found ${nfts.length} NFTs in collection`);
      
      // Step 1: Count trait occurrences
      const traitCounts = this.countTraits(nfts);
      const totalNfts = nfts.length;
      
      console.log(`📊 [RARITY] Analyzed ${Object.keys(traitCounts).length} unique trait combinations`);
      
      // Step 2: Calculate and store trait scores
      await this.storeTraitScores(collectionId, collectionName, collectionProjectId, traitCounts, totalNfts, masterCard, traitConfigs);
      
      // Step 3: Calculate and store NFT scorecards
      const traitsAnalyzed = await this.calculateNFTScorecards(
        nfts, 
        collectionId, 
        collectionName, 
        collectionProjectId, 
        traitCounts, 
        totalNfts,
        masterCard,
        traitConfigs
      );
      
      // Step 4: Update collection stats
      await this.updateCollectionStats(collectionId, collectionName, collectionProjectId, nfts, traitCounts, masterCard);
      
      // Record success
      const duration = Date.now() - startTime;
      await db.update(rarityCalculationHistory)
        .set({ 
          status: 'success'
        })
        .where(eq(rarityCalculationHistory.collection_id, collectionId));
      
      console.log(`✅ [RARITY] Completed in ${duration}ms - ${nfts.length} NFTs, ${traitsAnalyzed} traits`);
      
    } catch (error: any) {
      console.error(`❌ [RARITY] Failed to calculate rarity:`, error);
      await db.update(rarityCalculationHistory)
        .set({ 
          status: 'failed'
        })
        .where(eq(rarityCalculationHistory.collection_id, collectionId));
      throw error;
    }
  }
  
  /**
   * Count trait occurrences across all NFTs
   */
  private countTraits(nfts: any[]): Record<string, Record<string, number>> {
    const traitCounts: Record<string, Record<string, number>> = {};
    
    for (const nft of nfts) {
      const traits = Array.isArray(nft.traits) ? nft.traits : [];
      
      for (const trait of traits) {
        const traitType = trait.trait_type || 'Unknown';
        const traitValue = String(trait.value || 'None');
        
        if (!traitCounts[traitType]) {
          traitCounts[traitType] = {};
        }
        
        if (!traitCounts[traitType][traitValue]) {
          traitCounts[traitType][traitValue] = 0;
        }
        
        traitCounts[traitType][traitValue]++;
      }
    }
    
    return traitCounts;
  }
  
  /**
   * Calculate rarity score for a trait
   * Score = 100 - (count / total * 100)
   * Rarer traits get higher scores
   * 
   * With master card: applies custom weights, multipliers, and bonus points
   */
  private calculateTraitScore(
    count: number, 
    total: number, 
    traitType?: string,
    traitValue?: string,
    masterCard?: any,
    traitConfigs?: Record<string, any>
  ): number {
    // Check for custom score override
    if (traitType && traitValue && traitConfigs) {
      const specificKey = `${traitType}:${traitValue}`;
      const typeKey = `${traitType}:*`;
      
      const config = traitConfigs[specificKey] || traitConfigs[typeKey];
      
      if (config?.custom_score) {
        return config.custom_score;
      }
    }
    
    // Calculate base score
    const percentage = (count / total) * 100;
    let score = Math.max(1, Math.round(100 - percentage));
    
    // Apply trait weight from master card
    if (masterCard?.trait_weights && traitType) {
      const weight = masterCard.trait_weights[traitType] || 1.0;
      score = Math.round(score * weight);
    }
    
    // Apply custom multiplier
    if (masterCard?.custom_multipliers && traitType) {
      const multiplier = masterCard.custom_multipliers[traitType] || 1.0;
      score = Math.round(score * multiplier);
    }
    
    // Add bonus points
    if (traitType && traitValue && traitConfigs) {
      const specificKey = `${traitType}:${traitValue}`;
      const config = traitConfigs[specificKey];
      
      if (config?.is_bonus_trait && config.bonus_points) {
        score += config.bonus_points;
      }
    }
    
    return Math.max(1, score);
  }
  
  /**
   * Store trait rarity scores in database
   */
  private async storeTraitScores(
    collectionId: string,
    collectionName: string,
    projectId: number | undefined | null,
    traitCounts: Record<string, Record<string, number>>,
    totalNfts: number,
    masterCard?: any,
    traitConfigs?: Record<string, any>
  ): Promise<void> {
    // Delete old trait scores for this collection
    await db.delete(projectTraitScores)
      .where(eq(projectTraitScores.collection_id, collectionId));
    
    const traitScoreRecords = [];
    
    for (const [traitType, values] of Object.entries(traitCounts)) {
      for (const [traitValue, count] of Object.entries(values)) {
        const percentage = (count / totalNfts) * 100;
        const score = this.calculateTraitScore(count, totalNfts, traitType, traitValue, masterCard, traitConfigs);
        
        traitScoreRecords.push({
          id: crypto.randomUUID(),
          project_id: projectId || null,
          collection_id: collectionId,
          collection_name: collectionName,
          trait_type: traitType,
          trait_value: traitValue,
          trait_count: count,
          total_nfts: totalNfts,
          rarity_percentage: percentage.toFixed(2),
          rarity_score: score,
          updated_at: new Date(),
        });
      }
    }
    
    // Batch insert trait scores
    if (traitScoreRecords.length > 0) {
      await db.insert(projectTraitScores).values(traitScoreRecords);
      console.log(`✅ [RARITY] Stored ${traitScoreRecords.length} trait scores`);
    }
  }
  
  /**
   * Calculate NFT scorecards with trait-based rarity
   */
  private async calculateNFTScorecards(
    nfts: any[],
    collectionId: string,
    collectionName: string,
    projectId: number | undefined | null,
    traitCounts: Record<string, Record<string, number>>,
    totalNfts: number,
    masterCard?: any,
    traitConfigs?: Record<string, any>
  ): Promise<number> {
    // Delete old scorecards for this collection
    await db.delete(nftRarityScorecards)
      .where(eq(nftRarityScorecards.collection_id, collectionId));
    
    const scorecardRecords = [];
    let totalTraitsAnalyzed = 0;
    
    for (const nft of nfts) {
      const traits = Array.isArray(nft.traits) ? nft.traits : [];
      const traitScores: Record<string, any> = {};
      let totalScore = 0;
      
      for (const trait of traits) {
        const traitType = trait.trait_type || 'Unknown';
        const traitValue = String(trait.value || 'None');
        const count = traitCounts[traitType]?.[traitValue] || 0;
        const percentage = (count / totalNfts) * 100;
        const score = this.calculateTraitScore(count, totalNfts, traitType, traitValue, masterCard, traitConfigs);
        
        traitScores[traitType] = {
          value: traitValue,
          count,
          percentage: parseFloat(percentage.toFixed(2)),
          score,
        };
        
        totalScore += score;
        totalTraitsAnalyzed++;
      }
      
      const avgScore = traits.length > 0 ? totalScore / traits.length : 0;
      
      scorecardRecords.push({
        nft_id: nft.nft_id,
        project_id: projectId || null,
        collection_id: collectionId,
        collection_name: collectionName,
        nft_name: nft.name || `NFT #${nft.nft_id.slice(-6)}`,
        trait_scores: traitScores,
        total_rarity_score: totalScore,
        average_rarity_score: avgScore.toFixed(2),
        total_traits: traits.length,
        calculated_at: new Date(),
        updated_at: new Date(),
      });
    }
    
    // Batch insert scorecards
    if (scorecardRecords.length > 0) {
      await db.insert(nftRarityScorecards).values(scorecardRecords);
      console.log(`✅ [RARITY] Stored ${scorecardRecords.length} NFT scorecards`);
    }
    
    // Calculate ranks (1 = rarest)
    await this.calculateRarityRanks(collectionId, masterCard);
    
    return totalTraitsAnalyzed;
  }
  
  /**
   * Calculate rarity ranks for all NFTs in collection
   */
  private async calculateRarityRanks(collectionId: string, masterCard?: any): Promise<void> {
    // Get all scorecards sorted by total score (descending)
    const scorecards = await db
      .select({
        id: nftRarityScorecards.id,
        total_rarity_score: nftRarityScorecards.total_rarity_score,
      })
      .from(nftRarityScorecards)
      .where(eq(nftRarityScorecards.collection_id, collectionId))
      .orderBy(desc(nftRarityScorecards.total_rarity_score));
    
    const totalCount = scorecards.length;
    
    // Get tier thresholds from master card or use defaults
    const tierThresholds = masterCard?.tier_thresholds || {
      legendary: 99,
      epic: 95,
      rare: 85,
      uncommon: 70,
      common: 0
    };
    
    // Assign ranks and tiers
    for (let i = 0; i < scorecards.length; i++) {
      const rank = i + 1;
      const score = scorecards[i].total_rarity_score;
      const percentile = (i / totalCount) * 100;
      
      let tier: string;
      
      // Use score-based thresholds if master card exists, otherwise percentile
      if (masterCard) {
        if (score >= tierThresholds.legendary) tier = 'legendary';
        else if (score >= tierThresholds.epic) tier = 'epic';
        else if (score >= tierThresholds.rare) tier = 'rare';
        else if (score >= tierThresholds.uncommon) tier = 'uncommon';
        else tier = 'common';
      } else {
        if (percentile <= 1) tier = 'legendary';
        else if (percentile <= 5) tier = 'epic';
        else if (percentile <= 15) tier = 'rare';
        else if (percentile <= 40) tier = 'uncommon';
        else tier = 'common';
      }
      
      await db.update(nftRarityScorecards)
        .set({ 
          rarity_rank: rank,
        } as any)
        .where(eq(nftRarityScorecards.id, scorecards[i].id));
    }
    
    console.log(`✅ [RARITY] Calculated ranks for ${scorecards.length} NFTs`);
  }
  
  /**
   * Update collection aggregate stats
   */
  private async updateCollectionStats(
    collectionId: string,
    collectionName: string,
    projectId: number | undefined | null,
    nfts: any[],
    traitCounts: Record<string, Record<string, number>>,
    masterCard?: any
  ): Promise<void> {
    const traitDistribution: Record<string, any> = {};
    let totalTraitValues = 0;
    
    for (const [traitType, values] of Object.entries(traitCounts)) {
      traitDistribution[traitType] = {
        count: Object.keys(values).length,
        values: values,
      };
      totalTraitValues += Object.keys(values).length;
    }
    
    // Count rarity tiers
    const tiers = await db
      .select({
        tier: nftRarityScorecards.rarity_tier,
        count: sql<number>`count(*)::int`,
      })
      .from(nftRarityScorecards)
      .where(eq(nftRarityScorecards.collection_id, collectionId))
      .groupBy(nftRarityScorecards.rarity_tier);
    
    const rarityDistribution = {
      legendary: 0,
      epic: 0,
      rare: 0,
      uncommon: 0,
      common: 0,
    };
    
    for (const tier of tiers) {
      if (tier.tier && tier.tier in rarityDistribution) {
        rarityDistribution[tier.tier as keyof typeof rarityDistribution] = tier.count;
      }
    }
    
    // Upsert collection stats
    await db.insert(projectCollectionStats).values({
      collection_id: collectionId,
      collection_name: collectionName,
      total_nfts: nfts.length,
      total_traits: Object.keys(traitCounts).length,
      total_trait_values: totalTraitValues,
      trait_distribution: traitDistribution,
      rarity_distribution: rarityDistribution,
      updated_at: new Date(),
    } as any).onConflictDoUpdate({
      target: projectCollectionStats.collection_id,
      set: {
        collection_name: collectionName,
        total_nfts: nfts.length,
        total_traits: Object.keys(traitCounts).length,
        total_trait_values: totalTraitValues,
        trait_distribution: traitDistribution,
        rarity_distribution: rarityDistribution,
        updated_at: new Date(),
      } as any
    });
    
    console.log(`✅ [RARITY] Updated collection stats`);
  }
  
  /**
   * Get NFT scorecard by ID
   */
  async getNFTScorecard(nftId: string) {
    return await db
      .select()
      .from(nftRarityScorecards)
      .where(eq(nftRarityScorecards.nft_id, nftId))
      .limit(1);
  }
  
  /**
   * Get collection leaderboard (top NFTs by rarity)
   */
  async getCollectionLeaderboard(collectionId: string, limit: number = 100) {
    return await db
      .select()
      .from(nftRarityScorecards)
      .where(eq(nftRarityScorecards.collection_id, collectionId))
      .orderBy(desc(nftRarityScorecards.total_rarity_score))
      .limit(limit);
  }
  
  /**
   * Get trait rarity scores for collection
   */
  async getTraitScores(collectionId: string) {
    return await db
      .select()
      .from(projectTraitScores)
      .where(eq(projectTraitScores.collection_id, collectionId))
      .orderBy(desc(projectTraitScores.rarity_score));
  }
  
  /**
   * Get collection stats
   */
  async getCollectionStats(collectionId: string) {
    return await db
      .select()
      .from(projectCollectionStats)
      .where(eq(projectCollectionStats.collection_id, collectionId))
      .limit(1);
  }
}

export const rarityScoringService = new RarityScoringService();
