/**
 * Scanner 3: NFT Rarity & Scoring Scanner
 * 
 * Runs every 3 hours (cron job):
 * - Scans all database fields for all NFTs
 * - Recalculates rarity rankings based on trait distribution
 * - Updates power calculations with new multipliers
 * - Adjusts scores based on ownership patterns
 * - Updates global leaderboards
 * - Tracks project rarity and overall rankings
 * - Logs all changes to ranking_history
 */

import { db } from "../db";
import { 
  gamingNfts, 
  gamingNftCollections, 
  gamingPlayers,
  rankingHistory,
  scannerLogs,
  gameLeaderboards
} from "../../shared/schema";
import { eq, sql, desc, and, not, isNull } from "drizzle-orm";

interface RarityCalculation {
  nft_id: string;
  rarity_score: number;
  rarity_rank: number;
  trait_rarity_breakdown: Record<string, number>;
  percentile: number;
}

interface PowerRecalculation {
  nft_id: string;
  army_power: number;
  religion_power: number;
  civilization_power: number;
  economic_power: number;
  total_power: number;
  adjusted_multiplier: number;
}

interface ScanResult {
  success: boolean;
  collections_processed: number;
  nfts_rescored: number;
  nfts_failed: number;
  leaderboard_updated: boolean;
  duration_ms: number;
  errors: string[];
}

export class RarityScoringScanner {
  
  /**
   * Main scan function - runs every 3 hours
   */
  async runFullScan(): Promise<ScanResult> {
    const startTime = Date.now();
    const scanId = `rarity-scan-${Date.now()}`;
    console.log(`\n⏰ [RARITY SCANNER] Starting scheduled 3-hour scan at ${new Date().toISOString()}`);
    
    const result: ScanResult = {
      success: false,
      collections_processed: 0,
      nfts_rescored: 0,
      nfts_failed: 0,
      leaderboard_updated: false,
      duration_ms: 0,
      errors: []
    };

    // Create scanner log entry
    const [logEntry] = await db.insert(scannerLogs).values({
      scanner_name: 'rarity-scoring-scanner',
      scanner_type: 'rarity_calculation',
      status: 'running',
      started_at: new Date(),
      target_id: null,
      target_name: 'All Collections'
    } as any).returning();
    
    try {
      // Step 1: Get all active collections
      const collections = await db.query.gamingNftCollections.findMany({
        where: eq(gamingNftCollections.active_in_game, true)
      });
      
      console.log(`📊 [RARITY SCANNER] Found ${collections.length} active collections`);
      
      // Step 2: Process each collection
      for (const collection of collections) {
        try {
          console.log(`\n🎯 [RARITY SCANNER] Processing: ${collection.collection_name}`);
          
          const collectionResult = await this.processCollection(collection);
          result.collections_processed++;
          result.nfts_rescored += collectionResult.nfts_updated;
          result.nfts_failed += collectionResult.nfts_failed;
          
        } catch (error) {
          const errorMsg = `Failed to process collection ${collection.collection_name}: ${error instanceof Error ? error.message : String(error)}`;
          result.errors.push(errorMsg);
          result.nfts_failed++;
          console.error(`   ❌ ${errorMsg}`);
        }
      }
      
      // Step 3: Calculate overall rankings across all NFTs
      console.log(`\n🌍 [RARITY SCANNER] Calculating overall rankings...`);
      await this.calculateOverallRankings();
      
      // Step 4: Update project rarity scores
      console.log(`\n📊 [RARITY SCANNER] Calculating project rarity scores...`);
      await this.calculateProjectRarityScores();
      
      // Step 5: Update global leaderboards
      console.log(`\n🏆 [RARITY SCANNER] Updating global leaderboards...`);
      await this.updateGlobalLeaderboards();
      result.leaderboard_updated = true;
      
      // Step 6: Update player power levels
      console.log(`\n👥 [RARITY SCANNER] Recalculating player power levels...`);
      await this.updatePlayerPowerLevels();
      
      result.success = true;
      result.duration_ms = Date.now() - startTime;
      
      // Update scanner log with success
      await db.update(scannerLogs)
        .set({
          status: 'completed',
          completed_at: new Date(),
          duration_ms: result.duration_ms,
          entities_scanned: result.collections_processed,
          entities_processed: result.nfts_rescored,
          entities_failed: result.nfts_failed,
          statistics: {
            collections_processed: result.collections_processed,
            nfts_rescored: result.nfts_rescored,
            nfts_failed: result.nfts_failed,
            leaderboard_updated: result.leaderboard_updated
          }
        } as any)
        .where(eq(scannerLogs.id, logEntry.id));
      
      console.log(`\n✅ [RARITY SCANNER] Scan completed successfully!`);
      console.log(`   📦 Collections Processed: ${result.collections_processed}`);
      console.log(`   🔄 NFTs Rescored: ${result.nfts_rescored}`);
      console.log(`   ❌ NFTs Failed: ${result.nfts_failed}`);
      console.log(`   ⏱️  Duration: ${(result.duration_ms / 1000).toFixed(2)}s`);
      
      return result;
      
    } catch (error) {
      console.error(`❌ [RARITY SCANNER] Scan failed:`, error);
      result.errors.push(error instanceof Error ? error.message : String(error));
      result.duration_ms = Date.now() - startTime;
      
      // Update scanner log with failure
      await db.update(scannerLogs)
        .set({
          status: 'failed',
          completed_at: new Date(),
          duration_ms: result.duration_ms,
          entities_scanned: result.collections_processed,
          entities_failed: result.nfts_failed,
          error_message: error instanceof Error ? error.message : String(error),
          error_details: { errors: result.errors }
        } as any)
        .where(eq(scannerLogs.id, logEntry.id));
      
      return result;
    }
  }
  
  /**
   * Process a single collection
   */
  private async processCollection(collection: any): Promise<{ nfts_updated: number; nfts_failed: number }> {
    let nfts_updated = 0;
    let nfts_failed = 0;

    // Get all NFTs in collection
    const nfts = await db.query.gamingNfts.findMany({
      where: eq(gamingNfts.collection_id, collection.id)
    });
    
    if (nfts.length === 0) {
      console.log(`   ⚠️ No NFTs found in collection`);
      return { nfts_updated, nfts_failed };
    }
    
    console.log(`   📊 Found ${nfts.length} NFTs`);
    
    // Step 1: Calculate trait frequencies
    console.log(`   📈 Calculating trait frequencies...`);
    const traitFrequencies = this.calculateTraitFrequencies(nfts);
    
    // Step 2: Calculate rarity for each NFT
    console.log(`   🎲 Calculating rarity scores...`);
    const rarityCalculations = this.calculateRarityScores(nfts, traitFrequencies);
    
    // Step 3: Rank NFTs by rarity within collection
    console.log(`   🏅 Ranking NFTs...`);
    const rankedNFTs = rarityCalculations.sort((a, b) => b.rarity_score - a.rarity_score);
    rankedNFTs.forEach((calc, index) => {
      calc.rarity_rank = index + 1;
      calc.percentile = ((rankedNFTs.length - index) / rankedNFTs.length) * 100;
    });
    
    // Step 4: Recalculate power with updated multipliers
    console.log(`   ⚡ Recalculating power levels...`);
    const powerRecalculations = this.recalculatePowerLevels(nfts, rarityCalculations);
    
    // Step 5: Update database
    console.log(`   💾 Updating database...`);
    const updateResult = await this.updateNFTsInDatabase(rankedNFTs, powerRecalculations, collection.id);
    nfts_updated = updateResult.updated;
    nfts_failed = updateResult.failed;
    
    console.log(`   ✅ Collection processing complete: ${nfts_updated} updated, ${nfts_failed} failed`);
    
    return { nfts_updated, nfts_failed };
  }
  
  /**
   * Calculate trait frequency distribution
   */
  private calculateTraitFrequencies(nfts: any[]): Map<string, Map<string, number>> {
    const frequencies = new Map<string, Map<string, number>>();
    
    for (const nft of nfts) {
      const traits = nft.traits || {};
      
      for (const [traitType, traitValue] of Object.entries(traits)) {
        if (!frequencies.has(traitType)) {
          frequencies.set(traitType, new Map());
        }
        
        const valueMap = frequencies.get(traitType)!;
        const valueStr = String(traitValue);
        valueMap.set(valueStr, (valueMap.get(valueStr) || 0) + 1);
      }
    }
    
    return frequencies;
  }
  
  /**
   * Calculate rarity scores for all NFTs
   */
  private calculateRarityScores(
    nfts: any[],
    traitFrequencies: Map<string, Map<string, number>>
  ): RarityCalculation[] {
    const totalNFTs = nfts.length;
    const calculations: RarityCalculation[] = [];
    
    for (const nft of nfts) {
      const traits = nft.traits || {};
      const traitRarityBreakdown: Record<string, number> = {};
      let totalRarityScore = 0;
      
      // Calculate rarity for each trait
      for (const [traitType, traitValue] of Object.entries(traits)) {
        const valueMap = traitFrequencies.get(traitType);
        if (!valueMap) continue;
        
        const valueStr = String(traitValue);
        const frequency = valueMap.get(valueStr) || 0;
        const rarityScore = (1 / (frequency / totalNFTs)) * 100;
        
        traitRarityBreakdown[traitType] = rarityScore;
        totalRarityScore += rarityScore;
      }
      
      // Average rarity across all traits
      const numTraits = Object.keys(traits).length;
      const avgRarityScore = numTraits > 0 ? totalRarityScore / numTraits : 0;
      
      calculations.push({
        nft_id: nft.id,
        rarity_score: avgRarityScore,
        rarity_rank: 0, // Will be set after sorting
        trait_rarity_breakdown: traitRarityBreakdown,
        percentile: 0 // Will be set after sorting
      });
    }
    
    return calculations;
  }
  
  /**
   * Recalculate power levels with updated multipliers
   */
  private recalculatePowerLevels(
    nfts: any[],
    rarityCalculations: RarityCalculation[]
  ): PowerRecalculation[] {
    const recalculations: PowerRecalculation[] = [];
    
    for (const nft of nfts) {
      const rarityCalc = rarityCalculations.find(r => r.nft_id === nft.id);
      if (!rarityCalc) continue;
      
      // Get existing power scores from game_stats
      const gameStats = nft.game_stats || {};
      const armyPower = gameStats.army_power || 0;
      const religionPower = gameStats.religion_power || 0;
      const civilizationPower = gameStats.civilization_power || 0;
      const economicPower = gameStats.economic_power || 0;
      
      // Calculate adjusted multiplier based on rarity
      let rarityMultiplier = 1.0;
      if (rarityCalc.percentile >= 99) {
        rarityMultiplier = 3.0; // Top 1%
      } else if (rarityCalc.percentile >= 95) {
        rarityMultiplier = 2.5; // Top 5%
      } else if (rarityCalc.percentile >= 90) {
        rarityMultiplier = 2.0; // Top 10%
      } else if (rarityCalc.percentile >= 75) {
        rarityMultiplier = 1.5; // Top 25%
      } else if (rarityCalc.percentile >= 50) {
        rarityMultiplier = 1.2; // Top 50%
      }
      
      // Apply multiplier to all powers
      const adjustedArmyPower = Math.round(armyPower * rarityMultiplier);
      const adjustedReligionPower = Math.round(religionPower * rarityMultiplier);
      const adjustedCivilizationPower = Math.round(civilizationPower * rarityMultiplier);
      const adjustedEconomicPower = Math.round(economicPower * rarityMultiplier);
      
      recalculations.push({
        nft_id: nft.id,
        army_power: adjustedArmyPower,
        religion_power: adjustedReligionPower,
        civilization_power: adjustedCivilizationPower,
        economic_power: adjustedEconomicPower,
        total_power: adjustedArmyPower + adjustedReligionPower + adjustedCivilizationPower + adjustedEconomicPower,
        adjusted_multiplier: rarityMultiplier
      });
    }
    
    return recalculations;
  }
  
  /**
   * Update NFTs in database with ranking history
   */
  private async updateNFTsInDatabase(
    rarityCalculations: RarityCalculation[],
    powerRecalculations: PowerRecalculation[],
    collectionId: string
  ): Promise<{ updated: number; failed: number }> {
    const batchSize = 100;
    let updated = 0;
    let failed = 0;
    
    for (let i = 0; i < rarityCalculations.length; i += batchSize) {
      const batch = rarityCalculations.slice(i, i + batchSize);
      
      const results = await Promise.allSettled(
        batch.map(async (calc) => {
          const powerCalc = powerRecalculations.find(p => p.nft_id === calc.nft_id);
          if (!powerCalc) return;
          
          // Get existing NFT data
          const nft = await db.query.gamingNfts.findFirst({
            where: eq(gamingNfts.id, calc.nft_id)
          });
          
          if (!nft) return;
          
          const existingStats = nft.game_stats || {};
          const previousCollectionRank = nft.collection_rarity_rank || null;
          const rankChange = previousCollectionRank ? previousCollectionRank - calc.rarity_rank : 0;
          
          // Determine rarity tier
          let rarityTier = 'common';
          if (calc.percentile >= 99) rarityTier = 'legendary';
          else if (calc.percentile >= 95) rarityTier = 'mythic';
          else if (calc.percentile >= 90) rarityTier = 'epic';
          else if (calc.percentile >= 75) rarityTier = 'rare';
          else if (calc.percentile >= 50) rarityTier = 'uncommon';
          
          // Update NFT
          await db.update(gamingNfts)
            .set({
              rarity_score: calc.rarity_score.toString(),
              rarity_rank: calc.rarity_rank,
              collection_rarity_rank: calc.rarity_rank,
              previous_collection_rank: previousCollectionRank,
              rank_change: rankChange,
              rarity_percentile: calc.percentile,
              rarity_tier: rarityTier,
              last_rank_update: new Date(),
              game_stats: {
                ...existingStats,
                army_power: powerCalc.army_power,
                religion_power: powerCalc.religion_power,
                civilization_power: powerCalc.civilization_power,
                economic_power: powerCalc.economic_power,
                total_power: powerCalc.total_power,
                rarity_multiplier: powerCalc.adjusted_multiplier,
                trait_rarity_breakdown: calc.trait_rarity_breakdown,
                rarity_percentile: calc.percentile,
                last_rarity_scan: new Date().toISOString()
              },
              updated_at: new Date()
            } as any)
            .where(eq(gamingNfts.id, calc.nft_id));
          
          // Record ranking history if rank changed
          if (rankChange !== 0) {
            await db.insert(rankingHistory).values({
              entity_type: 'nft',
              entity_id: calc.nft_id,
              entity_name: nft.name,
              rank_type: 'collection',
              current_rank: calc.rarity_rank,
              previous_rank: previousCollectionRank,
              rank_change: rankChange,
              current_score: calc.rarity_score,
              previous_score: parseFloat(nft.rarity_score || '0' as any),
              score_change: calc.rarity_score - parseFloat(nft.rarity_score || '0'),
              percentile: calc.percentile,
              tier: rarityTier,
              scan_timestamp: new Date()
            } as any);
          }
        })
      );
      
      // Count successes and failures
      results.forEach(result => {
        if (result.status === 'fulfilled') updated++;
        else failed++;
      });
    }
    
    return { updated, failed };
  }
  
  /**
   * Calculate overall rankings across all NFTs globally
   */
  private async calculateOverallRankings(): Promise<void> {
    // Get all NFTs sorted by rarity score
    const allNfts = await db.select({
      id: gamingNfts.id,
      name: gamingNfts.name,
      rarity_score: gamingNfts.rarity_score,
      previous_overall_rank: gamingNfts.overall_rarity_rank
    })
      .from(gamingNfts)
      .where(not(isNull(gamingNfts.rarity_score)))
      .orderBy(desc(sql`CAST(${gamingNfts.rarity_score} AS DECIMAL)`));
    
    console.log(`   🌍 Ranking ${allNfts.length} NFTs globally...`);
    
    // Update overall rankings
    const batchSize = 100;
    for (let i = 0; i < allNfts.length; i += batchSize) {
      const batch = allNfts.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(async (nft, batchIndex) => {
          const overallRank = i + batchIndex + 1;
          const percentile = ((allNfts.length - overallRank + 1) / allNfts.length) * 100;
          const previousRank = nft.previous_overall_rank;
          const rankChange = previousRank ? previousRank - overallRank : 0;
          
          await db.update(gamingNfts)
            .set({
              overall_rarity_rank: overallRank,
              previous_overall_rank: previousRank,
              power_percentile: percentile,
              last_rank_update: new Date()
            } as any)
            .where(eq(gamingNfts.id, nft.id));
          
          // Record history if rank changed
          if (rankChange !== 0) {
            await db.insert(rankingHistory).values({
              entity_type: 'nft',
              entity_id: nft.id,
              entity_name: nft.name || 'Unknown',
              rank_type: 'overall',
              current_rank: overallRank,
              previous_rank: previousRank,
              rank_change: rankChange,
              current_score: parseFloat(nft.rarity_score || '0' as any),
              percentile,
              scan_timestamp: new Date()
            } as any);
          }
        })
      );
    }
    
    console.log(`   ✅ Overall rankings updated`);
  }

  /**
   * Calculate project-wide rarity scores for collections
   */
  private async calculateProjectRarityScores(): Promise<void> {
    const collections = await db.query.gamingNftCollections.findMany({
      where: eq(gamingNftCollections.active_in_game, true)
    });
    
    const collectionScores: Array<{
      id: string;
      name: string;
      score: number;
      totalNfts: number;
      avgPower: number;
      topPower: number;
    }> = [];
    
    for (const collection of collections) {
      // Get all NFTs in collection
      const nfts = await db.query.gamingNfts.findMany({
        where: eq(gamingNfts.collection_id, collection.id)
      });
      
      if (nfts.length === 0) continue;
      
      // Calculate aggregate statistics
      const rarityScores = nfts.map(n => parseFloat(n.rarity_score || '0'));
      const powers = nfts.map(n => {
        const stats = n.game_stats || {};
        return stats.total_power || 0;
      });
      
      const avgRarity = rarityScores.reduce((a, b) => a + b, 0) / rarityScores.length;
      const avgPower = powers.reduce((a, b) => a + b, 0) / powers.length;
      const topPower = Math.max(...powers);
      
      // Project rarity score combines avg rarity, collection size, and power
      const projectRarityScore = (avgRarity * 0.6) + (Math.log10(nfts.length) * 10 * 0.2) + ((avgPower / 100) * 0.2);
      
      collectionScores.push({
        id: collection.id,
        name: collection.collection_name,
        score: projectRarityScore,
        totalNfts: nfts.length,
        avgPower,
        topPower
      });
    }
    
    // Sort and rank collections
    collectionScores.sort((a, b) => b.score - a.score);
    
    for (let i = 0; i < collectionScores.length; i++) {
      const collData = collectionScores[i];
      const rank = i + 1;
      
      // Determine collection tier
      let tier = 'unranked';
      const percentile = ((collectionScores.length - rank + 1) / collectionScores.length) * 100;
      if (percentile >= 95) tier = 'legendary';
      else if (percentile >= 85) tier = 'mythic';
      else if (percentile >= 70) tier = 'epic';
      else if (percentile >= 50) tier = 'rare';
      else if (percentile >= 25) tier = 'common';
      
      await db.update(gamingNftCollections)
        .set({
          project_rarity_score: collData.score,
          project_rarity_rank: rank,
          total_nfts_scanned: collData.totalNfts,
          avg_nft_power: collData.avgPower,
          top_nft_power: collData.topPower,
          collection_tier: tier,
          last_rarity_scan: new Date()
        } as any)
        .where(eq(gamingNftCollections.id, collData.id));
    }
    
    console.log(`   📊 Project rarity calculated for ${collectionScores.length} collections`);
  }

  /**
   * Update global leaderboards
   */
  private async updateGlobalLeaderboards(): Promise<void> {
    // Get top NFTs by total power
    const topNFTsByPower = await db.select({
      id: gamingNfts.id,
      name: gamingNfts.name,
      total_power: sql<number>`CAST((${gamingNfts.game_stats}->>'total_power') AS INTEGER)`,
      rarity_score: gamingNfts.rarity_score,
      owner_address: gamingNfts.owner_address
    })
      .from(gamingNfts)
      .orderBy(desc(sql`CAST((${gamingNfts.game_stats}->>'total_power') AS INTEGER)`))
      .limit(100);
    
    // Get top NFTs by rarity
    const topNFTsByRarity = await db.select({
      id: gamingNfts.id,
      name: gamingNfts.name,
      rarity_score: gamingNfts.rarity_score,
      overall_rarity_rank: gamingNfts.overall_rarity_rank
    })
      .from(gamingNfts)
      .where(not(isNull(gamingNfts.rarity_score)))
      .orderBy(desc(sql`CAST(${gamingNfts.rarity_score} AS DECIMAL)`))
      .limit(100);
    
    // Update leaderboards table
    await db.insert(gameLeaderboards).values([
      {
        leaderboard_type: 'nft_power',
        category: null,
        rankings: topNFTsByPower,
        total_entries: topNFTsByPower.length,
        last_updated: new Date()
      },
      {
        leaderboard_type: 'nft_rarity',
        category: null,
        rankings: topNFTsByRarity,
        total_entries: topNFTsByRarity.length,
        last_updated: new Date()
      }
    ] as any).onConflictDoUpdate({
      target: [gameLeaderboards.leaderboard_type, gameLeaderboards.category],
      set: {
        rankings: sql`excluded.rankings`,
        total_entries: sql`excluded.total_entries`,
        last_updated: sql`excluded.last_updated`
      } as any
    });
    
    console.log(`   🏆 Top NFT by power: ${topNFTsByPower[0]?.name} (${topNFTsByPower[0]?.total_power})`);
    console.log(`   💎 Top NFT by rarity: ${topNFTsByRarity[0]?.name} (${topNFTsByRarity[0]?.rarity_score})`);
  }
  
  /**
   * Update player power levels based on owned NFTs
   */
  private async updatePlayerPowerLevels(): Promise<void> {
    const players = await db.query.gamingPlayers.findMany();
    
    for (const player of players) {
      // Get all NFTs owned by player
      const ownedNFTs = await db.query.gamingNfts.findMany({
        where: eq(gamingNfts.owner_address, (player as any).wallet_address)
      });
      
      if (ownedNFTs.length === 0) continue;
      
      // Sum up all power levels
      let totalArmyPower = 0;
      let totalReligionPower = 0;
      let totalCivilizationPower = 0;
      let totalEconomicPower = 0;
      
      for (const nft of ownedNFTs) {
        const gameStats = nft.game_stats || {};
        totalArmyPower += gameStats.army_power || 0;
        totalReligionPower += gameStats.religion_power || 0;
        totalCivilizationPower += gameStats.civilization_power || 0;
        totalEconomicPower += gameStats.economic_power || 0;
      }
      
      const totalPower = totalArmyPower + totalReligionPower + totalCivilizationPower + totalEconomicPower;
      
      // Update player
      await (db.update(gamingPlayers) as any)
        .set({
          army_power: totalArmyPower.toString(),
          religion_power: totalReligionPower.toString(),
          civilization_power: totalCivilizationPower.toString(),
          economic_power: totalEconomicPower.toString(),
          total_power_level: totalPower.toString(),
          total_nfts_owned: ownedNFTs.length,
          updated_at: new Date()
        } as any)
        .where(eq(gamingPlayers.id, (player as any).id));
    }
    
    console.log(`   ✅ Updated ${players.length} player power levels`);
  }
}

// Export singleton instance
export const rarityScoringScanner = new RarityScoringScanner();

/**
 * Cron job setup - runs every 3 hours
 * DISABLED in development to prevent RAM hammering
 */
export function setupRarityScannerCron() {
  // Skip rarity scanner in development mode to prevent RAM issues
  if (process.env.NODE_ENV === 'development') {
    console.log('⏰ [RARITY SCANNER] Skipping rarity scanner in development mode');
    console.log('💡 [RARITY SCANNER] Enable in production with NODE_ENV=production');
    return;
  }

  const THREE_HOURS = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
  
  console.log(`⏰ [RARITY SCANNER] Cron job scheduled to run every 3 hours (first run in 3 hours)`);
  
  // DISABLED: Don't run immediately on startup to prevent blocking server initialization
  // rarityScoringScanner.runFullScan().catch(error => {
  //   console.error(`❌ [RARITY SCANNER] Initial scan failed:`, error);
  // });
  
  // Run every 3 hours
  setInterval(async () => {
    try {
      await rarityScoringScanner.runFullScan();
    } catch (error) {
      console.error(`❌ [RARITY SCANNER] Scheduled scan failed:`, error);
    }
  }, THREE_HOURS);
}
