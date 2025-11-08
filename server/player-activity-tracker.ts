/**
 * Player Activity Tracker & Power Multiplier System
 * 
 * Tracks comprehensive player activity and calculates power multipliers based on:
 * - RDL balance
 * - NFT count
 * - Swap volume
 * - Bridge usage
 * - Site time
 * - Social media posts
 * - Oracle interactions
 */

import { db } from "../server/db";
import { gamingPlayers, inquisitionNftAudit, swapFees } from "../shared/schema";
import { eq, and, sql, gte, desc } from "drizzle-orm";
import Decimal from "decimal.js";

export class PlayerActivityTracker {
  
  /**
   * Calculate comprehensive activity multiplier for a player
   * Factors in all platform engagement metrics
   */
  static async calculateActivityMultiplier(userHandle: string): Promise<number> {
    try {
      // Get player record
      const player = await db.query.gamingPlayers.findFirst({
        where: eq(gamingPlayers.user_handle, userHandle)
      });

      if (!player || !player.wallet_address) {
        return 1.0; // Base multiplier if no player data
      }

      let multiplier = 1.0;

      // 1. RDL Balance Bonus (up to +50% at 1M RDL)
      const rdlBalance = new Decimal(player.rdl_balance || 0);
      if (rdlBalance.greaterThan(0)) {
        const rdlBonus = Math.min(rdlBalance.dividedBy(1000000).toNumber() * 0.5, 0.5);
        multiplier += rdlBonus;
      }

      // 2. NFT Count Bonus (up to +30% at 50+ NFTs)
      const nftCount = player.total_nfts_owned || 0;
      if (nftCount > 0) {
        const nftBonus = Math.min((nftCount / 50) * 0.3, 0.3);
        multiplier += nftBonus;
      }

      // 3. Trading Volume Bonus (up to +40% at $100k volume)
      const totalVolume = new Decimal(player.total_swap_volume_usd || 0).plus(player.total_bridge_volume_usd || 0);
      if (totalVolume.greaterThan(0)) {
        const volumeBonus = Math.min(totalVolume.dividedBy(100000).toNumber() * 0.4, 0.4);
        multiplier += volumeBonus;
      }

      // 4. Daily Activity Bonus (up to +20% for 10+ daily swaps)
      const dailyActivity = (player.daily_swap_count || 0) + (player.daily_bridge_count || 0);
      if (dailyActivity > 0) {
        const activityBonus = Math.min((dailyActivity / 10) * 0.2, 0.2);
        multiplier += activityBonus;
      }

      // 5. Site Engagement Bonus (up to +25% for 500+ minutes)
      const siteTime = player.total_site_time_minutes || 0;
      if (siteTime > 0) {
        const timeBonus = Math.min((siteTime / 500) * 0.25, 0.25);
        multiplier += timeBonus;
      }

      // 6. Social Media Bonus (up to +15% for 20+ posts)
      const socialPosts = player.social_posts_count || 0;
      if (socialPosts > 0) {
        const socialBonus = Math.min((socialPosts / 20) * 0.15, 0.15);
        multiplier += socialBonus;
      }

      // 7. Oracle Interaction Bonus (up to +35% for 50+ interactions)
      const oracleInteractions = player.oracle_interactions || 0;
      if (oracleInteractions > 0) {
        const oracleBonus = Math.min((oracleInteractions / 50) * 0.35, 0.35);
        multiplier += oracleBonus;
      }

      // 8. Recent Activity Bonus (+10% if interacted with Oracle in last 24h)
      if (player.last_oracle_interaction) {
        const hoursSinceOracle = (Date.now() - new Date(player.last_oracle_interaction).getTime()) / (1000 * 60 * 60);
        if (hoursSinceOracle < 24) {
          multiplier += 0.10;
        }
      }

      // Cap total multiplier at 3.0x (200% bonus)
      return Math.min(multiplier, 3.0);

    } catch (error) {
      console.error(`Error calculating activity multiplier for ${userHandle}:`, error);
      return 1.0;
    }
  }

  /**
   * Sync player activity data from various sources
   */
  static async syncPlayerActivity(userHandle: string, walletAddress: string): Promise<void> {
    try {
      // Get TOTAL swap volume in USD (all time)
      const totalSwapData = await db.select({
        totalVolume: sql<number>`COALESCE(SUM(CAST(${swapFees.feeInUsd} AS NUMERIC)), 0)`
      })
      .from(swapFees)
      .where(eq(swapFees.walletAddress, walletAddress))
      .then((res: any) => res[0]);

      // Get TODAY's swap count (last 24 hours) for daily activity bonus
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const dailySwapData = await db.select({
        dailyCount: sql<number>`COUNT(*)`.as('daily_count')
      })
      .from(swapFees)
      .where(and(
        eq(swapFees.walletAddress, walletAddress),
        gte(swapFees.createdAt, oneDayAgo)
      ))
      .then((res: any) => res[0]);

      // Count NFTs owned
      const nftCount = await db.select({ count: sql<number>`COUNT(*)` })
        .from(inquisitionNftAudit)
        .where(eq(inquisitionNftAudit.current_owner, walletAddress))
        .then((res: any) => res[0]?.count || 0);

      // Calculate new activity multiplier
      const activityMultiplier = await this.calculateActivityMultiplier(userHandle);

      // Update player record
      await db.update(gamingPlayers)
        .set({ 
          total_swap_volume_usd: totalSwapData?.totalVolume?.toString() || "0",
          daily_swap_count: dailySwapData?.dailyCount || 0,
          total_nfts_owned: nftCount,
          last_activity_sync: new Date(),
          updated_at: new Date()
         } as any)
        .where(eq(gamingPlayers.user_handle, userHandle));

      // Recalculate multiplier AFTER updating the data
      const finalMultiplier = await this.calculateActivityMultiplier(userHandle);
      
      await db.update(gamingPlayers)
        .set({ 
          activity_multiplier: finalMultiplier.toFixed(2)
         } as any)
        .where(eq(gamingPlayers.user_handle, userHandle));

      console.log(`✅ Synced activity for ${userHandle}: ${nftCount} NFTs, ${dailySwapData?.dailyCount || 0} daily swaps, ${finalMultiplier.toFixed(2)}x multiplier`);

    } catch (error) {
      console.error(`Error syncing player activity for ${userHandle}:`, error);
    }
  }

  /**
   * Track Oracle interaction and update player
   */
  static async trackOracleInteraction(userHandle: string): Promise<void> {
    try {
      await db.update(gamingPlayers)
        .set({
          oracle_interactions: sql`${gamingPlayers.oracle_interactions} + 1`,
          last_oracle_interaction: new Date(),
          updated_at: new Date()
        })
        .where(eq(gamingPlayers.user_handle, userHandle));

      console.log(`🔮 Oracle interaction tracked for ${userHandle}`);
    } catch (error) {
      console.error(`Error tracking Oracle interaction:`, error);
    }
  }

  /**
   * Track social media post
   */
  static async trackSocialPost(userHandle: string): Promise<void> {
    try {
      await db.update(gamingPlayers)
        .set({
          social_posts_count: sql`${gamingPlayers.social_posts_count} + 1`,
          updated_at: new Date()
        })
        .where(eq(gamingPlayers.user_handle, userHandle));

      console.log(`📱 Social post tracked for ${userHandle}`);
    } catch (error) {
      console.error(`Error tracking social post:`, error);
    }
  }

  /**
   * Track site session time (in minutes)
   */
  static async trackSiteTime(userHandle: string, minutes: number): Promise<void> {
    try {
      await db.update(gamingPlayers)
        .set({
          total_site_time_minutes: sql`${gamingPlayers.total_site_time_minutes} + ${minutes}`,
          last_active: new Date(),
          updated_at: new Date()
        })
        .where(eq(gamingPlayers.user_handle, userHandle));

    } catch (error) {
      console.error(`Error tracking site time:`, error);
    }
  }

  /**
   * Get active Oracle users (interacted in last 24 hours)
   */
  static async getActiveOracleUsers(): Promise<string[]> {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const activePlayers = await db.select({
        user_handle: gamingPlayers.user_handle
      })
      .from(gamingPlayers)
      .where(gte(gamingPlayers.last_oracle_interaction, oneDayAgo))
      .orderBy(desc(gamingPlayers.last_oracle_interaction));

      return activePlayers.map((p: any) => p.user_handle);
    } catch (error) {
      console.error("Error getting active Oracle users:", error);
      return [];
    }
  }

  /**
   * Calculate final battle power with all modifiers
   */
  static async calculateFinalBattlePower(userHandle: string): Promise<number> {
    try {
      const player = await db.query.gamingPlayers.findFirst({
        where: eq(gamingPlayers.user_handle, userHandle)
      });

      if (!player) return 0;

      // Base power from NFTs
      const basePower = player.total_power_level || 0;

      // Activity multiplier
      const activityMult = parseFloat(player.activity_multiplier?.toString() || "1.0");

      // Calculate final power
      const finalPower = Math.floor(basePower * activityMult);

      return finalPower;

    } catch (error) {
      console.error(`Error calculating final battle power for ${userHandle}:`, error);
      return 0;
    }
  }
}
