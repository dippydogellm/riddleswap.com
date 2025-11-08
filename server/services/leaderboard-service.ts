/**
 * Leaderboard Service
 * Tracks player and alliance rankings with percentage change tracking
 */

import { db } from '../db';
import { 
  gamingPlayers, 
  gamingAlliances,
  allianceMembers,
  playerLeaderboardHistory,
  allianceLeaderboardHistory,
  nftPowerAttributes,
} from '../../shared/schema';
import { sql, desc, eq, and } from 'drizzle-orm';
import crypto from 'crypto';

// Calculate rank change percentage
function calculateRankChangePercentage(currentRank: number, previousRank: number): number {
  if (!previousRank) return 0;
  
  // Moving up in rank means LOWER number (rank 1 is better than rank 10)
  // So if we go from rank 10 to rank 5, that's a +50% improvement
  const change = ((previousRank - currentRank) / previousRank) * 100;
  return Math.round(change * 100) / 100; // Round to 2 decimal places
}

/**
 * Update player leaderboard rankings
 * Call this periodically (e.g., hourly or daily)
 */
export async function updatePlayerLeaderboard() {
  try {
    console.log('📊 [Leaderboard] Updating player rankings...');

    // Get current player rankings by total power
    const players = await db
      .select({
        player_handle: gamingPlayers.user_handle,
        // gamingPlayers does not define total_victories/total_defeats – provide zero placeholders
        total_power: gamingPlayers.total_power_level,
        // use SQL literals to keep selection object stable for downstream mapping
        total_victories: sql<number>`0`,
        total_defeats: sql<number>`0`,
      })
      .from(gamingPlayers)
      .orderBy(desc(gamingPlayers.total_power_level))
      .limit(1000); // Top 1000 players

    // Get previous rankings
    const previousRankings = await db
      .select()
      .from(playerLeaderboardHistory)
      .where(
        sql`${playerLeaderboardHistory.recorded_at} = (
          SELECT MAX(recorded_at) 
          FROM ${playerLeaderboardHistory}
        )`
      );

    const previousRankMap = new Map(
      previousRankings.map(r => [r.player_handle, r.global_rank])
    );

    // Record new rankings with rank changes
    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      const currentRank = i + 1;
      const previousRank = previousRankMap.get(player.player_handle) || null;
      const rankChange = previousRank ? previousRank - currentRank : 0; // Positive = moved up
      const rankChangePercentage = previousRank 
        ? calculateRankChangePercentage(currentRank, previousRank)
        : 0;

      const totalBattles = Number(player.total_victories) + Number(player.total_defeats);
      const winRate = totalBattles > 0 
        ? Number(((Number(player.total_victories) / totalBattles) * 100).toFixed(2))
        : 0;

      // Insert new snapshot (omit fields not in schema types)
      // Cast to any due to Drizzle inferred insert type currently narrowed (pending schema re-generation)
      await (db.insert(playerLeaderboardHistory) as any).values({
        player_handle: player.player_handle,
        global_rank: currentRank,
        previous_rank: previousRank ?? null,
        rank_change: rankChange,
        rank_change_percentage: rankChangePercentage.toString(),
        total_power: Number(player.total_power) || 0,
        total_victories: Number(player.total_victories) || 0,
        total_defeats: Number(player.total_defeats) || 0,
        win_rate: winRate.toString(),
      } as any);
    }

    console.log(`✅ [Leaderboard] Updated rankings for ${players.length} players`);
    return { success: true, playersUpdated: players.length };
  } catch (error) {
    console.error('❌ [Leaderboard] Failed to update player rankings:', error);
    throw error;
  }
}

/**
 * Update alliance leaderboard rankings
 */
export async function updateAllianceLeaderboard() {
  try {
    console.log('🏰 [Leaderboard] Updating alliance rankings...');

    // Get current alliance rankings by total power
    const alliances = await db
      .select({
        alliance_id: gamingAlliances.id,
        alliance_tag: gamingAlliances.tag,
        total_power: gamingAlliances.total_power,
        total_victories: gamingAlliances.total_victories,
        total_defeats: gamingAlliances.total_defeats,
        current_members: gamingAlliances.current_members,
      })
      .from(gamingAlliances)
      .orderBy(desc(gamingAlliances.total_power))
      .limit(500); // Top 500 alliances

    // Get previous rankings
    const previousRankings = await db
      .select()
      .from(allianceLeaderboardHistory)
      .where(
        sql`${allianceLeaderboardHistory.recorded_at} = (
          SELECT MAX(recorded_at) 
          FROM ${allianceLeaderboardHistory}
        )`
      );

    const previousRankMap = new Map(
      previousRankings.map(r => [r.alliance_id, r.global_rank])
    );

    // Record new rankings with rank changes
    for (let i = 0; i < alliances.length; i++) {
      const alliance = alliances[i];
      const currentRank = i + 1;
      const previousRank = previousRankMap.get(alliance.alliance_id) || null;
      const rankChange = previousRank ? previousRank - currentRank : 0;
      const rankChangePercentage = previousRank
        ? calculateRankChangePercentage(currentRank, previousRank)
        : 0;

      await (db.insert(allianceLeaderboardHistory) as any).values({
        alliance_id: alliance.alliance_id,
        alliance_tag: alliance.alliance_tag,
        global_rank: currentRank,
        previous_rank: previousRank ?? null,
        rank_change: rankChange,
        rank_change_percentage: rankChangePercentage.toString(),
        total_power: Number(alliance.total_power) || 0,
        total_victories: Number(alliance.total_victories) || 0,
        total_defeats: Number(alliance.total_defeats) || 0,
        member_count: Number(alliance.current_members) || 0,
      } as any);
    }

    console.log(`✅ [Leaderboard] Updated rankings for ${alliances.length} alliances`);
    return { success: true, alliancesUpdated: alliances.length };
  } catch (error) {
    console.error('❌ [Leaderboard] Failed to update alliance rankings:', error);
    throw error;
  }
}

/**
 * Get player leaderboard with rank changes
 */
export async function getPlayerLeaderboard(limit: number = 100) {
  try {
    // Get latest rankings
    const latestRankings = await db
      .select()
      .from(playerLeaderboardHistory)
      .where(
        sql`${playerLeaderboardHistory.recorded_at} = (
          SELECT MAX(recorded_at) 
          FROM ${playerLeaderboardHistory}
        )`
      )
      .orderBy(playerLeaderboardHistory.global_rank)
      .limit(limit);

    return latestRankings;
  } catch (error) {
    console.error('❌ [Leaderboard] Failed to fetch player leaderboard:', error);
    throw error;
  }
}

/**
 * Get alliance leaderboard with rank changes
 */
export async function getAllianceLeaderboard(limit: number = 100) {
  try {
    // Get latest rankings
    const latestRankings = await db
      .select()
      .from(allianceLeaderboardHistory)
      .where(
        sql`${allianceLeaderboardHistory.recorded_at} = (
          SELECT MAX(recorded_at) 
          FROM ${allianceLeaderboardHistory}
        )`
      )
      .orderBy(allianceLeaderboardHistory.global_rank)
      .limit(limit);

    return latestRankings;
  } catch (error) {
    console.error('❌ [Leaderboard] Failed to fetch alliance leaderboard:', error);
    throw error;
  }
}

/**
 * Get player rank change over time
 */
export async function getPlayerRankHistory(playerHandle: string, days: number = 7) {
  try {
    const history = await db
      .select()
      .from(playerLeaderboardHistory)
      .where(
        sql`${playerLeaderboardHistory.player_handle} = ${playerHandle} AND ${playerLeaderboardHistory.recorded_at} >= NOW() - INTERVAL '${days} days'`
      )
      .orderBy(desc(playerLeaderboardHistory.recorded_at));

    return history;
  } catch (error) {
    console.error('❌ [Leaderboard] Failed to fetch player rank history:', error);
    throw error;
  }
}

/**
 * Get alliance rank change over time
 */
export async function getAllianceRankHistory(allianceId: string, days: number = 7) {
  try {
    const history = await db
      .select()
      .from(allianceLeaderboardHistory)
      .where(
        sql`${allianceLeaderboardHistory.alliance_id} = ${allianceId} AND ${allianceLeaderboardHistory.recorded_at} >= NOW() - INTERVAL '${days} days'`
      )
      .orderBy(desc(allianceLeaderboardHistory.recorded_at));

    return history;
  } catch (error) {
    console.error('❌ [Leaderboard] Failed to fetch alliance rank history:', error);
    throw error;
  }
}
