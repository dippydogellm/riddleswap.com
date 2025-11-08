/**
 * Rankings & Leaderboard API Routes
 * 
 * Provides endpoints for:
 * - NFT Rankings (overall, per collection)
 * - Civilization Rankings
 * - Historical ranking changes
 * - Leaderboards
 */

import { Router } from "express";
import { db } from "../db";
import {
  gamingNfts,
  gamingNftCollections,
  playerCivilizations,
  rankingHistory,
  gameLeaderboards
} from "../../shared/schema";
import { eq, desc, sql, and, gte, lte } from "drizzle-orm";

const router = Router();

/**
 * GET /api/rankings/nfts/top
 * Get top NFTs by rarity
 * Query params: limit (default: 50)
 */
router.get("/nfts/top", async (req, res) => {
  try {
    const { limit = '50' } = req.query;
    
    const topNfts = await db.select({
      id: gamingNfts.id,
      name: gamingNfts.name,
      nft_id: gamingNfts.nft_id,
      overall_rarity_rank: gamingNfts.overall_rarity_rank,
      collection_rarity_rank: gamingNfts.collection_rarity_rank,
      rank_change: gamingNfts.rank_change,
      rarity_score: gamingNfts.rarity_score,
      rarity_tier: gamingNfts.rarity_tier,
      power_percentile: gamingNfts.power_percentile,
      last_rank_update: gamingNfts.last_rank_update,
      collection_id: gamingNfts.collection_id
    })
      .from(gamingNfts)
      .orderBy(desc(sql`CAST(${gamingNfts.rarity_score} AS DECIMAL)`))
      .limit(parseInt(limit as string));
    
    // Get collection names
    const nftsWithCollections = await Promise.all(
      topNfts.map(async (nft) => {
        const collection = await db.query.gamingNftCollections.findFirst({
          where: eq(gamingNftCollections.id, nft.collection_id)
        });
        return {
          ...nft,
          collection_name: collection?.collection_name || 'Unknown'
        };
      })
    );
    
    res.json({
      success: true,
      nfts: nftsWithCollections
    });
  } catch (error) {
    console.error(`❌ [RANKINGS API] Top NFTs error:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * GET /api/rankings/civilizations/top
 * Get top civilizations by score
 * Query params: limit (default: 50)
 */
router.get("/civilizations/top", async (req, res) => {
  try {
    const { limit = '50' } = req.query;
    
    const topCivilizations = await db.select({
      id: playerCivilizations.id,
      civilization_name: playerCivilizations.civilization_name,
      global_rank: playerCivilizations.global_rank,
      previous_global_rank: playerCivilizations.previous_global_rank,
      rank_change_global: playerCivilizations.rank_change_global,
      civilization_score: playerCivilizations.civilization_score,
      civilization_tier: playerCivilizations.civilization_tier,
      rank_trend: playerCivilizations.rank_trend,
      military_strength: playerCivilizations.military_strength,
      culture_level: playerCivilizations.culture_level,
      total_population: playerCivilizations.total_population
    })
      .from(playerCivilizations)
      .orderBy(desc(sql`CAST(${playerCivilizations.civilization_score} AS DECIMAL)`))
      .limit(parseInt(limit as string));
    
    res.json({
      success: true,
      civilizations: topCivilizations
    });
  } catch (error) {
    console.error(`❌ [RANKINGS API] Top civilizations error:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * GET /api/rankings/history
 * Get ranking history with optional filtering
 * Query params: entity_type, entity_id, time_range
 */
router.get("/history", async (req, res) => {
  try {
    const { entity_type, entity_id, time_range = '7d' } = req.query;
    
    // Calculate time filter
    const now = new Date();
    let timeFilter: Date;
    switch (time_range) {
      case '24h':
        timeFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        timeFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        timeFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        timeFilter = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        timeFilter = new Date(0); // All time
    }
    
    const history = await db.select()
      .from(rankingHistory)
      .where(and(
        entity_type ? eq(rankingHistory.entity_type, entity_type as string) : undefined,
        entity_id ? eq(rankingHistory.entity_id, entity_id as string) : undefined,
        gte(rankingHistory.scan_timestamp, timeFilter)
      ))
      .orderBy(desc(rankingHistory.scan_timestamp))
      .limit(1000);
    
    res.json({
      success: true,
      history
    });
  } catch (error) {
    console.error(`❌ [RANKINGS API] History error:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * GET /api/rankings/collections
 * Get collection rankings with project rarity
 */
router.get("/collections", async (req, res) => {
  try {
    const collections = await db.select({
      id: gamingNftCollections.id,
      collection_id: gamingNftCollections.collection_id,
      collection_name: gamingNftCollections.collection_name,
      project_rarity_score: gamingNftCollections.project_rarity_score,
      project_rarity_rank: gamingNftCollections.project_rarity_rank,
      collection_tier: gamingNftCollections.collection_tier,
      total_nfts_scanned: gamingNftCollections.total_nfts_scanned,
      avg_nft_power: gamingNftCollections.avg_nft_power,
      top_nft_power: gamingNftCollections.top_nft_power,
      last_rarity_scan: gamingNftCollections.last_rarity_scan
    })
      .from(gamingNftCollections)
      .where(eq(gamingNftCollections.active_in_game, true))
      .orderBy(desc(gamingNftCollections.project_rarity_rank));
    
    res.json({
      success: true,
      collections
    });
  } catch (error) {
    console.error(`❌ [RANKINGS API] Collections error:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * GET /api/rankings/leaderboards/:type
 * Get pre-calculated leaderboard
 * Params: type (nft_power, nft_rarity, civilization_score, collection_rarity)
 */
router.get("/leaderboards/:type", async (req, res) => {
  try {
    const { type } = req.params;
    const { category } = req.query;
    
    const leaderboards = await db.select()
      .from(gameLeaderboards)
      .where(and(
        eq(gameLeaderboards.leaderboard_type, type),
        category ? eq(gameLeaderboards.category, category as string) : undefined
      ));
    
    res.json({
      success: true,
      leaderboards
    });
  } catch (error) {
    console.error(`❌ [RANKINGS API] Leaderboards error:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * GET /api/rankings/nft/:nftId
 * Get detailed ranking info for a specific NFT
 */
router.get("/nft/:nftId", async (req, res) => {
  try {
    const { nftId } = req.params;
    
    const nft = await db.query.gamingNfts.findFirst({
      where: eq(gamingNfts.nft_id, nftId)
    });
    
    if (!nft) {
      return res.status(404).json({
        success: false,
        error: "NFT not found"
      });
    }
    
    // Get collection info
    const collection = await db.query.gamingNftCollections.findFirst({
      where: eq(gamingNftCollections.id, nft.collection_id)
    });
    
    // Get ranking history
    const history = await db.select()
      .from(rankingHistory)
      .where(eq(rankingHistory.entity_id, nft.id))
      .orderBy(desc(rankingHistory.scan_timestamp))
      .limit(50);
    
    res.json({
      success: true,
      nft: {
        ...nft,
        collection_name: collection?.collection_name
      },
      history
    });
  } catch (error) {
    console.error(`❌ [RANKINGS API] NFT detail error:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export default router;
