/**
 * NFT Battle Statistics and Experience Service
 * 
 * Tracks which NFTs are used in battles and updates their experience levels
 */

import { db } from "../db";
import { eq, and, sql } from "drizzle-orm";
import { nftPowerAttributes, gamingNfts } from "@shared/schema";

/**
 * Calculate experience points awarded based on battle outcome
 */
function calculateExperienceReward(
  didWin: boolean,
  damageDealt: number,
  damageTaken: number
): number {
  let baseExp = 50; // Base experience for participating

  if (didWin) {
    baseExp += 100; // Bonus for winning
  } else {
    baseExp += 25; // Consolation for losing
  }

  // Bonus for performance
  const damageBonus = Math.floor(damageDealt / 10);
  const survivalBonus = Math.max(0, 50 - Math.floor(damageTaken / 10));

  return baseExp + damageBonus + survivalBonus;
}

/**
 * Calculate required experience for next level
 */
function calculateExperienceForLevel(level: number): number {
  // Exponential curve: 100 * (level ^ 1.5)
  return Math.floor(100 * Math.pow(level, 1.5));
}

/**
 * Update NFT battle statistics after a battle completes
 */
export async function updateNFTBattleStats(params: {
  nftId: string;
  didWin: boolean;
  damageDealt: number;
  damageTaken: number;
  battleId: string;
}): Promise<{
  success: boolean;
  leveledUp: boolean;
  newLevel?: number;
  experienceGained: number;
}> {
  try {
    const { nftId, didWin, damageDealt, damageTaken, battleId } = params;

    // Get current NFT power attributes
    const nftPower = await db.query.nftPowerAttributes.findFirst({
      where: eq(nftPowerAttributes.nft_id, nftId)
    });

    if (!nftPower) {
      console.error(`❌ [NFT BATTLE STATS] NFT power attributes not found for ${nftId}`);
      return {
        success: false,
        leveledUp: false,
        experienceGained: 0
      };
    }

    // Calculate experience reward
    const experienceGained = calculateExperienceReward(didWin, damageDealt, damageTaken);

    // Current stats
    const currentExp = Number(nftPower.experience_points) || 0;
    const currentLevel = Number(nftPower.level) || 1;
    const currentExpToNext = Number(nftPower.experience_to_next_level) || 100;
    const currentTotalExp = Number(nftPower.total_experience_earned) || 0;

    // Add new experience
    let newExp = currentExp + experienceGained;
    let newLevel = currentLevel;
    let leveledUp = false;

    // Check for level up (can level up multiple times)
    // IMPORTANT: Recalculate threshold after each level to prevent multi-level jumps
    let nextLevelThreshold = currentExpToNext;
    while (newExp >= nextLevelThreshold) {
      newExp -= nextLevelThreshold;
      newLevel++;
      leveledUp = true;
      
      // Recalculate threshold for the NEW level
      nextLevelThreshold = calculateExperienceForLevel(newLevel);
    }

    const newExpToNext = calculateExperienceForLevel(newLevel);

    // Update database
    await db.update(nftPowerAttributes)
      .set({
        // Battle statistics
        battles_participated: sql`${nftPowerAttributes.battles_participated} + 1`,
        battles_won: didWin ? sql`${nftPowerAttributes.battles_won} + 1` : nftPowerAttributes.battles_won,
        battles_lost: !didWin ? sql`${nftPowerAttributes.battles_lost} + 1` : nftPowerAttributes.battles_lost,
        total_damage_dealt: sql`${nftPowerAttributes.total_damage_dealt} + ${damageDealt}`,
        total_damage_taken: sql`${nftPowerAttributes.total_damage_taken} + ${damageTaken}`,
        
        // Experience and leveling
        experience_points: newExp,
        level: newLevel,
        experience_to_next_level: newExpToNext,
        total_experience_earned: currentTotalExp + experienceGained,
        
        // Battle tracking
        last_battle_id: battleId,
        last_updated: new Date(),
      })
      .where(eq(nftPowerAttributes.nft_id, nftId));

    console.log(`✅ [NFT BATTLE STATS] Updated NFT ${nftId}: ${experienceGained} exp, Level ${currentLevel} → ${newLevel}${leveledUp ? ' 🎉 LEVEL UP!' : ''}`);

    return {
      success: true,
      leveledUp,
      newLevel: leveledUp ? newLevel : undefined,
      experienceGained
    };

  } catch (error) {
    console.error(`❌ [NFT BATTLE STATS] Error updating battle stats:`, error);
    return {
      success: false,
      leveledUp: false,
      experienceGained: 0
    };
  }
}

/**
 * Update battle stats for all NFTs in a squadron after battle
 */
export async function updateSquadronBattleStats(params: {
  squadronId: string;
  nftIds: string[];
  didWin: boolean;
  totalDamageDealt: number;
  totalDamageTaken: number;
  battleId: string;
}): Promise<{
  success: boolean;
  nftsUpdated: number;
  nftsLeveledUp: number;
  results: Array<{ nftId: string; leveledUp: boolean; newLevel?: number; experienceGained: number }>;
}> {
  try {
    const { squadronId, nftIds, didWin, totalDamageDealt, totalDamageTaken, battleId } = params;

    console.log(`📊 [NFT BATTLE STATS] Updating ${nftIds.length} NFTs from squadron ${squadronId}`);

    // Distribute damage across NFTs
    const damagePerNFT = Math.floor(totalDamageDealt / nftIds.length);
    const damageTakenPerNFT = Math.floor(totalDamageTaken / nftIds.length);

    const results = [];
    let nftsUpdated = 0;
    let nftsLeveledUp = 0;

    // Update each NFT
    for (const nftId of nftIds) {
      const result = await updateNFTBattleStats({
        nftId,
        didWin,
        damageDealt: damagePerNFT,
        damageTaken: damageTakenPerNFT,
        battleId
      });

      if (result.success) {
        nftsUpdated++;
        if (result.leveledUp) {
          nftsLeveledUp++;
        }
        results.push({ nftId, ...result });
      }
    }

    console.log(`✅ [NFT BATTLE STATS] Squadron update complete: ${nftsUpdated}/${nftIds.length} NFTs updated, ${nftsLeveledUp} leveled up`);

    return {
      success: true,
      nftsUpdated,
      nftsLeveledUp,
      results
    };

  } catch (error) {
    console.error(`❌ [NFT BATTLE STATS] Error updating squadron battle stats:`, error);
    return {
      success: false,
      nftsUpdated: 0,
      nftsLeveledUp: 0,
      results: []
    };
  }
}

/**
 * Get NFT battle statistics
 */
export async function getNFTBattleStats(nftId: string) {
  try {
    const nftPower = await db.query.nftPowerAttributes.findFirst({
      where: eq(nftPowerAttributes.nft_id, nftId)
    });

    if (!nftPower) {
      return null;
    }

    return {
      nftId,
      level: Number(nftPower.level) || 1,
      experiencePoints: Number(nftPower.experience_points) || 0,
      experienceToNextLevel: Number(nftPower.experience_to_next_level) || 100,
      totalExperienceEarned: Number(nftPower.total_experience_earned) || 0,
      battlesParticipated: Number(nftPower.battles_participated) || 0,
      battlesWon: Number(nftPower.battles_won) || 0,
      battlesLost: Number(nftPower.battles_lost) || 0,
      winRate: Number(nftPower.battles_participated) > 0 
        ? ((Number(nftPower.battles_won) / Number(nftPower.battles_participated)) * 100).toFixed(1)
        : '0.0',
      totalDamageDealt: Number(nftPower.total_damage_dealt) || 0,
      totalDamageTaken: Number(nftPower.total_damage_taken) || 0,
      lastBattleId: nftPower.last_battle_id,
    };

  } catch (error) {
    console.error(`❌ [NFT BATTLE STATS] Error getting battle stats:`, error);
    return null;
  }
}
