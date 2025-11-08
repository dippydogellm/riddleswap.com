import { db } from "../db";
import { gamingPlayers, squadrons, battles, gamingNfts, nftPowerAttributes, inquisitionUserOwnership } from "@shared/schema";
import { eq, and, gte, lte, ne, isNull, sql, desc } from "drizzle-orm";

/**
 * Matchmaking Service for fair 1v1 battles
 * 
 * Matches players based on:
 * - Total power level (within 20% range)
 * - Experience/level (prefer similar levels)
 * - Squadron size (must have minimum required NFTs)
 * - Active status (players looking for match)
 */

export interface MatchmakingCriteria {
  userHandle: string;
  squadronId: string;
  minNfts?: number; // Minimum NFTs required for battle type
  maxPowerVariance?: number; // % variance allowed (default 20%)
  preferredBattleType?: "1v1" | "mass_war";
}

export interface MatchCandidate {
  userHandle: string;
  playerName: string;
  totalPower: number;
  level: number;
  experience: number;
  squadronId: string;
  squadronName: string;
  nftCount: number;
  winRate: number;
  matchScore: number; // 0-100, higher = better match
}

/**
 * Find best match for a player based on power, level, and squadron composition
 */
export async function findMatch(criteria: MatchmakingCriteria): Promise<MatchCandidate | null> {
  try {
    const { userHandle, squadronId, minNfts = 10, maxPowerVariance = 20 } = criteria;

    console.log(`🎯 [Matchmaking] Finding match for ${userHandle} with squadron ${squadronId}`);

    // Get the requesting player's stats
    const requestingPlayer = await db.query.gamingPlayers.findFirst({
      where: eq(gamingPlayers.user_handle, userHandle)
    });

    if (!requestingPlayer) {
      console.log(`❌ [Matchmaking] Player not found: ${userHandle}`);
      return null;
    }

    // Get the requesting squadron
    const requestingSquadron = await db.query.squadrons.findFirst({
      where: eq(squadrons.id, squadronId)
    });

    if (!requestingSquadron) {
      console.log(`❌ [Matchmaking] Squadron not found: ${squadronId}`);
      return null;
    }

    // Calculate power range (GUARD: Handle zero-power players)
    const requestingPower = Math.max(1, Number(requestingPlayer.total_power_level || 0)); // Minimum power of 1
    const minPower = requestingPower * (1 - maxPowerVariance / 100);
    const maxPower = requestingPower * (1 + maxPowerVariance / 100);

    console.log(`📊 [Matchmaking] Searching for opponents with power ${minPower.toFixed(0)} - ${maxPower.toFixed(0)} (base: ${requestingPower})`);

    // Find potential opponents with similar power and active squadrons
    const candidates = await db
      .select({
        user_handle: gamingPlayers.user_handle,
        player_name: gamingPlayers.player_name,
        total_power: gamingPlayers.total_power_level,
        squadron_id: squadrons.id,
        squadron_name: squadrons.name,
        nft_count: squadrons.nft_count
      })
      .from(gamingPlayers)
      .innerJoin(squadrons, eq(squadrons.player_id, gamingPlayers.id))
      .where(
        and(
          ne(gamingPlayers.user_handle, userHandle), // Not self
          gte(gamingPlayers.total_power_level, minPower.toString()),
          lte(gamingPlayers.total_power_level, maxPower.toString()),
          gte(squadrons.nft_count, minNfts), // Has enough NFTs
          eq(squadrons.is_active, true) // Squadron is active
        )
      )
      .limit(20); // Get top 20 candidates

    if (candidates.length === 0) {
      console.log(`⚠️ [Matchmaking] No suitable opponents found for ${userHandle}`);
      return null;
    }

    console.log(`🔍 [Matchmaking] Found ${candidates.length} potential opponents`);

    // Score each candidate - simplified without level/win-rate factors
    const scoredCandidates: MatchCandidate[] = candidates.map((candidate: any) => {
      const candidatePower = Math.max(1, Number(candidate.total_power || 0)); // Minimum power of 1

      // Calculate match score (0-100)
      // Factors:
      // - Power similarity (70 points max)
      // - Squadron size match (30 points max)

      // GUARD: Use safe power for division (prevents Infinity/NaN)
      const safePower = Math.max(requestingPower, candidatePower); // Use higher power to avoid division issues
      const powerDiff = Math.abs(candidatePower - requestingPower);
      const powerScore = Math.max(0, 70 - (powerDiff / safePower * 70));

      const squadronSizeDiff = Math.abs((candidate.nft_count || 0) - (requestingSquadron.nft_count || 0));
      const squadronScore = Math.max(0, 30 - squadronSizeDiff / 10);

      const matchScore = powerScore + squadronScore;

      return {
        userHandle: candidate.user_handle,
        playerName: candidate.player_name || candidate.user_handle,
        totalPower: candidatePower,
        level: 1, // Default level (not yet tracked in schema)
        experience: 0, // Default experience (not yet tracked in schema)
        squadronId: candidate.squadron_id,
        squadronName: candidate.squadron_name || "Unnamed Squadron",
        nftCount: candidate.nft_count || 0,
        winRate: 0, // Will be calculated when we add victory/defeat tracking
        matchScore
      };
    });

    // Sort by match score (best match first)
    scoredCandidates.sort((a, b) => b.matchScore - a.matchScore);

    const bestMatch = scoredCandidates[0];
    console.log(`✅ [Matchmaking] Best match found: ${bestMatch.userHandle} (score: ${bestMatch.matchScore.toFixed(1)}/100)`);

    return bestMatch;

  } catch (error) {
    console.error("❌ [Matchmaking] Error finding match:", error);
    throw error;
  }
}

/**
 * Get matchmaking queue - players waiting for a match
 */
export async function getMatchmakingQueue(battleType: "1v1" | "mass_war" = "1v1") {
  try {
    const minNfts = battleType === "1v1" ? 10 : 10;

    const queue = await db
      .select({
        user_handle: gamingPlayers.user_handle,
        player_name: gamingPlayers.player_name,
        total_power: gamingPlayers.total_power_level,
        squadron_id: squadrons.id,
        squadron_name: squadrons.name,
        nft_count: squadrons.nft_count,
        created_at: squadrons.created_at
      })
      .from(gamingPlayers)
      .innerJoin(squadrons, eq(squadrons.player_id, gamingPlayers.id))
      .where(
        and(
          gte(squadrons.nft_count, minNfts),
          eq(squadrons.is_active, true)
        )
      )
      .orderBy(desc(gamingPlayers.total_power_level))
      .limit(50);

    return queue;

  } catch (error) {
    console.error("❌ [Matchmaking] Error getting queue:", error);
    throw error;
  }
}

/**
 * Validate if two players are a good match
 */
export function validateMatch(player1Power: number, player2Power: number, maxVariance: number = 20): boolean {
  const powerDiff = Math.abs(player1Power - player2Power);
  const avgPower = (player1Power + player2Power) / 2;
  const variancePercent = (powerDiff / avgPower) * 100;

  return variancePercent <= maxVariance;
}
