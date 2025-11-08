/**
 * Scanner 4: Battle & Civilization Scanner
 * 
 * Scans all NFT battles and RiddleCity data to calculate comprehensive
 * civilization scores with detailed breakdowns:
 * - Battle performance and win rates
 * - City development and infrastructure
 * - Economic production and trade
 * - Population and happiness metrics
 * - Alliance contributions
 * - Historical achievements
 */

import { db } from "../db";
import { 
  gamingNfts, 
  gamingPlayers, 
  playerCivilizations,
  gamingEvents,
  cities,
  cityBuildings,
  scannerLogs,
  rankingHistory
} from "../../shared/schema";
import { eq, and, sql, desc, gte } from "drizzle-orm";

interface CivilizationScore {
  player_id: string;
  civilization_id: string;
  
  // Battle metrics
  battle_victories: number;
  battle_defeats: number;
  battle_win_rate: number;
  total_battle_power: number;
  battles_participated: number;
  
  // City metrics
  total_cities: number;
  total_buildings: number;
  total_population: number;
  total_wealth: number;
  infrastructure_score: number;
  
  // Economic metrics
  daily_income: number;
  trade_routes: number;
  economic_output: number;
  
  // Civilization metrics
  culture_level: number;
  research_level: number;
  happiness_average: number;
  
  // Power calculations
  military_strength: number;
  religious_influence: number;
  cultural_development: number;
  economic_power: number;
  
  // Overall score
  total_civilization_score: number;
  global_rank: number;
  regional_rank: number;
  
  // Detailed breakdown
  score_breakdown: {
    battle_contribution: number;
    city_contribution: number;
    economic_contribution: number;
    culture_contribution: number;
  };
}

interface ScanResult {
  success: boolean;
  civilizations_scanned: number;
  civilizations_updated: number;
  battles_analyzed: number;
  cities_analyzed: number;
  duration_ms: number;
  errors: string[];
}

export class BattleCivilizationScanner {
  
  /**
   * Run full civilization scan
   */
  async runFullScan(): Promise<ScanResult> {
    const startTime = Date.now();
    console.log(`\n🏛️ [CIVILIZATION SCANNER] Starting full civilization scan at ${new Date().toISOString()}`);
    
    const result: ScanResult = {
      success: false,
      civilizations_scanned: 0,
      civilizations_updated: 0,
      battles_analyzed: 0,
      cities_analyzed: 0,
      duration_ms: 0,
      errors: []
    };

    // Create scanner log entry
    const logEntry = await db.insert(scannerLogs).values({
      scanner_name: 'battle-civilization-scanner',
      scanner_type: 'civilization_analysis',
      status: 'running',
      started_at: new Date(),
      target_id: null,
      target_name: 'All Players & Civilizations'
    } as any).returning().then(rows => rows[0]);
    
    try {
      // Step 1: Get all active players
      const players = await db.query.gamingPlayers.findMany();
      console.log(`👥 [CIVILIZATION SCANNER] Found ${players.length} players`);
      
      // Step 2: Process each player's civilization
      for (const player of players) {
        try {
          console.log(`\n🎯 Processing player: ${player.user_handle}`);
          
          const civScore = await this.calculatePlayerCivilization(player);
          await this.updateCivilizationInDatabase(player, civScore);
          
          result.civilizations_scanned++;
          result.civilizations_updated++;
          
        } catch (error) {
          const errorMsg = `Failed to process player ${player.user_handle}: ${error instanceof Error ? error.message : String(error)}`;
          result.errors.push(errorMsg);
          console.error(`   ❌ ${errorMsg}`);
        }
      }
      
      // Step 3: Calculate global rankings
      console.log(`\n🏆 Calculating global rankings...`);
      await this.calculateGlobalRankings();
      
      result.success = true;
      result.duration_ms = Date.now() - startTime;
      
      // Update scanner log with success
      await db.update(scannerLogs)
        .set({
          status: 'completed',
          completed_at: new Date(),
          duration_ms: result.duration_ms,
          entities_scanned: result.civilizations_scanned,
          entities_processed: result.civilizations_updated,
          entities_failed: result.civilizations_scanned - result.civilizations_updated,
          statistics: {
            civilizations_scanned: result.civilizations_scanned,
            civilizations_updated: result.civilizations_updated,
            battles_analyzed: result.battles_analyzed,
            cities_analyzed: result.cities_analyzed
          },
          metadata: result.errors.length > 0 ? { warnings: result.errors } : {}
        } as any)
        .where(eq(scannerLogs.id, logEntry.id));
      
      console.log(`\n✅ [CIVILIZATION SCANNER] Scan completed successfully!`);
      console.log(`   🏛️ Civilizations Scanned: ${result.civilizations_scanned}`);
      console.log(`   🔄 Civilizations Updated: ${result.civilizations_updated}`);
      console.log(`   ⚔️  Battles Analyzed: ${result.battles_analyzed}`);
      console.log(`   🏙️  Cities Analyzed: ${result.cities_analyzed}`);
      console.log(`   ⏱️  Duration: ${(result.duration_ms / 1000).toFixed(2)}s`);
      
      return result;
      
    } catch (error) {
      console.error(`❌ [CIVILIZATION SCANNER] Scan failed:`, error);
      result.errors.push(error instanceof Error ? error.message : String(error));
      result.duration_ms = Date.now() - startTime;
      
      // Update scanner log with failure
      await db.update(scannerLogs)
        .set({
          status: 'failed',
          completed_at: new Date(),
          duration_ms: result.duration_ms,
          entities_scanned: result.civilizations_scanned,
          entities_failed: result.civilizations_scanned - result.civilizations_updated,
          error_message: error instanceof Error ? error.message : String(error),
          error_details: { errors: result.errors }
        } as any)
        .where(eq(scannerLogs.id, logEntry.id));
      
      return result;
    }
  }
  
  /**
   * Calculate comprehensive civilization score for a player
   */
  private async calculatePlayerCivilization(player: any): Promise<CivilizationScore> {
    console.log(`   📊 Calculating civilization score...`);
    
    // Initialize score object
    const score: CivilizationScore = {
      player_id: player.id,
      civilization_id: '', // Will be set later
      
      battle_victories: 0,
      battle_defeats: 0,
      battle_win_rate: 0,
      total_battle_power: 0,
      battles_participated: 0,
      
      total_cities: 0,
      total_buildings: 0,
      total_population: 0,
      total_wealth: 0,
      infrastructure_score: 0,
      
      daily_income: 0,
      trade_routes: 0,
      economic_output: 0,
      
      culture_level: 0,
      research_level: 0,
      happiness_average: 0,
      
      military_strength: 0,
      religious_influence: 0,
      cultural_development: 0,
      economic_power: 0,
      
      total_civilization_score: 0,
      global_rank: 0,
      regional_rank: 0,
      
      score_breakdown: {
        battle_contribution: 0,
        city_contribution: 0,
        economic_contribution: 0,
        culture_contribution: 0
      }
    };
    
    // Step 1: Analyze battle history
    console.log(`   ⚔️  Analyzing battle history...`);
    await this.analyzeBattleHistory(player, score);
    
    // Step 2: Analyze RiddleCity data
    console.log(`   🏙️  Analyzing RiddleCity data...`);
    await this.analyzeRiddleCityData(player, score);
    
    // Step 3: Analyze NFT ownership
    console.log(`   🎴 Analyzing NFT ownership...`);
    await this.analyzeNFTOwnership(player, score);
    
    // Step 4: Calculate final scores
    console.log(`   🧮 Calculating final scores...`);
    this.calculateFinalScores(score);
    
    return score;
  }
  
  /**
   * Analyze battle history
   */
  private async analyzeBattleHistory(player: any, score: CivilizationScore): Promise<void> {
    // Get all battles where player participated
    const battles = await db.query.gamingEvents.findMany({
      where: and(
        eq(gamingEvents.event_type, 'battle'),
        sql`${gamingEvents.participants}::jsonb ? ${player.user_handle}`
      )
    });
    
    score.battles_participated = battles.length;
    
    for (const battle of battles) {
      const result = battle.event_result as any;
      
      if (result?.winner === player.user_handle) {
        score.battle_victories++;
      } else if (result?.loser === player.user_handle) {
        score.battle_defeats++;
      }
      
      // Add battle power contribution
      if (result?.power_used) {
        score.total_battle_power += result.power_used;
      }
    }
    
    // Calculate win rate
    if (score.battles_participated > 0) {
      score.battle_win_rate = (score.battle_victories / score.battles_participated) * 100;
    }
    
    // Battle contribution to civilization score (0-1000 points)
    score.score_breakdown.battle_contribution = 
      (score.battle_victories * 50) + // 50 points per victory
      (score.battles_participated * 10) + // 10 points per battle
      Math.min(score.battle_win_rate * 5, 500); // Win rate bonus (max 500)
    
    console.log(`      ⚔️  Battles: ${score.battles_participated}, Wins: ${score.battle_victories}, Win Rate: ${score.battle_win_rate.toFixed(1)}%`);
  }
  
  /**
   * Analyze RiddleCity data
   */
  private async analyzeRiddleCityData(player: any, score: CivilizationScore): Promise<void> {
    // Get all cities owned by player
    const playerCities = await db.query.cities.findMany({
      where: eq(cities.userHandle, player.user_handle)
    });
    
    score.total_cities = playerCities.length;
    
    for (const city of playerCities) {
      // Sum up city metrics
      score.total_population += city.population || 0;
      score.total_wealth += parseFloat(city.credits?.toString() || '0');
      score.happiness_average += city.happiness || 0;
      score.total_buildings += city.totalBuildings || 0;
      
      // Get city buildings for detailed analysis
      const buildings = await db.query.cityBuildings.findMany({
        where: eq(cityBuildings.cityId, city.id)
      });
      
      for (const building of buildings) {
        // Calculate infrastructure score based on building types
        if (building.buildingType?.includes('factory')) {
          score.infrastructure_score += 50;
        } else if (building.buildingType?.includes('university')) {
          score.culture_level += 10;
          score.research_level += 10;
        } else if (building.buildingType?.includes('bank')) {
          score.economic_output += 100;
        } else if (building.buildingType?.includes('temple')) {
          score.religious_influence += 20;
        } else if (building.buildingType?.includes('barracks')) {
          score.military_strength += 30;
        }
      }
    }
    
    // Average happiness
    if (score.total_cities > 0) {
      score.happiness_average = score.happiness_average / score.total_cities;
    }
    
    // City contribution to civilization score (0-1000 points)
    score.score_breakdown.city_contribution = 
      (score.total_cities * 100) + // 100 points per city
      (score.total_buildings * 10) + // 10 points per building
      (score.total_population * 0.5) + // 0.5 points per citizen
      (score.happiness_average * 2) + // Happiness bonus
      (score.infrastructure_score * 0.5); // Infrastructure bonus
    
    console.log(`      🏙️  Cities: ${score.total_cities}, Buildings: ${score.total_buildings}, Population: ${score.total_population}`);
  }
  
  /**
   * Analyze NFT ownership for power
   */
  private async analyzeNFTOwnership(player: any, score: CivilizationScore): Promise<void> {
    // Get all NFTs owned by player
    const ownedNFTs = await db.query.gamingNfts.findMany({
      where: eq(gamingNfts.owner_address, player.wallet_address)
    });
    
    for (const nft of ownedNFTs) {
      const gameStats = nft.game_stats || {};
      
      // Add to power scores
      score.military_strength += gameStats.army_power || 0;
      score.religious_influence += gameStats.religion_power || 0;
      score.cultural_development += gameStats.civilization_power || 0;
      score.economic_power += gameStats.economic_power || 0;
    }
    
    console.log(`      🎴 NFTs: ${ownedNFTs.length}, Military: ${score.military_strength}, Religion: ${score.religious_influence}`);
  }
  
  /**
   * Calculate final civilization scores
   */
  private calculateFinalScores(score: CivilizationScore): void {
    // Economic contribution (0-1000 points)
    score.score_breakdown.economic_contribution = 
      Math.min(score.total_wealth / 1000, 500) + // Wealth (max 500)
      (score.economic_output * 0.1) + // Production
      (score.trade_routes * 50) + // Trade routes
      (score.economic_power * 0.1); // NFT economic power
    
    // Culture contribution (0-1000 points)
    score.score_breakdown.culture_contribution = 
      (score.culture_level * 10) + // Culture level
      (score.research_level * 10) + // Research level
      (score.cultural_development * 0.1) + // NFT culture power
      (score.religious_influence * 0.1); // Religious influence
    
    // Calculate total civilization score
    score.total_civilization_score = 
      score.score_breakdown.battle_contribution +
      score.score_breakdown.city_contribution +
      score.score_breakdown.economic_contribution +
      score.score_breakdown.culture_contribution;
    
    console.log(`      🏛️ Total Civilization Score: ${Math.round(score.total_civilization_score)}`);
    console.log(`         - Battle: ${Math.round(score.score_breakdown.battle_contribution)}`);
    console.log(`         - City: ${Math.round(score.score_breakdown.city_contribution)}`);
    console.log(`         - Economic: ${Math.round(score.score_breakdown.economic_contribution)}`);
    console.log(`         - Culture: ${Math.round(score.score_breakdown.culture_contribution)}`);
  }
  
  /**
   * Update civilization in database
   */
  private async updateCivilizationInDatabase(player: any, score: CivilizationScore): Promise<void> {
    // Get or create civilization record
    let civilization = await db.query.playerCivilizations.findFirst({
      where: eq(playerCivilizations.player_id, player.id)
    });
    
    if (!civilization) {
      // Create new civilization
      [civilization] = await db.insert(playerCivilizations)
        .values({
          player_id: player.id,
          civilization_name: `${player.player_name || player.user_handle}'s Civilization`,
          civilization_type: player.play_type || 'balanced',
          total_plots: score.total_cities,
          total_buildings: score.total_buildings,
          total_population: score.total_population,
          total_wealth: score.total_wealth.toString(),
          trade_routes: score.trade_routes,
          military_strength: score.military_strength,
          victories: score.battle_victories,
          defeats: score.battle_defeats,
          culture_level: score.culture_level,
          research_level: score.research_level
        } as any)
        .returning();
    } else {
      // Update existing civilization
      await db.update(playerCivilizations)
        .set({ 
          total_plots: score.total_cities,
          total_buildings: score.total_buildings,
          total_population: score.total_population,
          total_wealth: score.total_wealth.toString(),
          trade_routes: score.trade_routes,
          military_strength: score.military_strength,
          victories: score.battle_victories,
          defeats: score.battle_defeats,
          culture_level: score.culture_level,
          research_level: score.research_level,
          last_calculated: new Date(),
          updated_at: new Date()
         } as any)
        .where(eq(playerCivilizations.id, civilization.id));
    }
    
    score.civilization_id = civilization.id;
    
    console.log(`   ✅ Civilization updated in database`);
  }
  
  /**
   * Calculate global rankings with tier assignment and history tracking
   */
  private async calculateGlobalRankings(): Promise<void> {
    // Get all civilizations with current ranks
    const allCivs = await db.select({
      id: playerCivilizations.id,
      name: playerCivilizations.civilization_name,
      military: playerCivilizations.military_strength,
      culture: playerCivilizations.culture_level,
      population: playerCivilizations.total_population,
      previous_global_rank: playerCivilizations.previous_global_rank,
      current_global_rank: playerCivilizations.global_rank,
      civilization_score: playerCivilizations.civilization_score
    })
      .from(playerCivilizations)
      .orderBy(
        desc(sql`CAST(${playerCivilizations.civilization_score} AS DECIMAL)`),
        desc(playerCivilizations.military_strength),
        desc(playerCivilizations.culture_level),
        desc(playerCivilizations.total_population)
      );
    
    // Update rankings with tier assignment
    for (let i = 0; i < allCivs.length; i++) {
      const civ = allCivs[i];
      const newRank = i + 1;
      const previousRank = civ.current_global_rank || null;
      const rankChange = previousRank ? previousRank - newRank : 0;
      const percentile = ((allCivs.length - newRank + 1) / allCivs.length) * 100;
      
      // Determine civilization tier
      let tier = 'peasant';
      if (percentile >= 99) tier = 'god_emperor';
      else if (percentile >= 95) tier = 'emperor';
      else if (percentile >= 85) tier = 'king';
      else if (percentile >= 70) tier = 'lord';
      else if (percentile >= 50) tier = 'knight';
      
      // Determine rank trend
      let rankTrend = 'stable';
      if (rankChange > 0) rankTrend = 'rising';
      else if (rankChange < 0) rankTrend = 'falling';
      
      // Update civilization
      await db.update(playerCivilizations)
        .set({ 
          global_rank: newRank,
          previous_global_rank: previousRank,
          rank_change_global: rankChange,
          civilization_tier: tier,
          rank_trend: rankTrend,
          updated_at: new Date()
         } as any)
        .where(eq(playerCivilizations.id, civ.id));
      
      // Record ranking history if rank changed
      if (rankChange !== 0 && previousRank) {
        await (db.insert(rankingHistory) as any).values({
          entity_type: 'civilization',
          entity_id: civ.id,
          entity_name: civ.name || 'Unknown Civilization',
          previous_rank: previousRank,
          new_rank: newRank,
          rank_change: rankChange,
          score_value: parseFloat(civ.civilization_score || '0'),
          scan_timestamp: new Date(),
          metadata: {
            tier,
            percentile
          }
        });
      }
    }
    
    console.log(`   ✅ Updated rankings for ${allCivs.length} civilizations`);
  }
}

// Export singleton instance
export const battleCivilizationScanner = new BattleCivilizationScanner();
