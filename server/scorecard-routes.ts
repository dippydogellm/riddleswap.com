/**
 * Project Scorecard Routes
 * API endpoints for trait-based rarity scoring and NFT rankings
 */

import { Router } from 'express';
import { db } from './db';
import { rarityScoringService } from './services/rarity-scoring-service';
import { 
  projectTraitScores, 
  nftRarityScorecards, 
  projectCollectionStats,
  rarityCalculationHistory 
} from '@shared/project-scorecard-schema';
import { eq, desc, and, sql } from 'drizzle-orm';

const router = Router();

/**
 * POST /api/scorecards/calculate/:collectionId
 * Trigger rarity calculation for a collection
 * Collection ID format: issuer:taxon
 */
router.post('/scorecards/calculate/:collectionId', async (req, res) => {
  try {
    const { collectionId } = req.params;
    const { projectId } = req.body;

    console.log(`🎯 [SCORECARD API] Starting calculation for ${collectionId}`);

    // Validate collection ID format
    if (!collectionId.includes(':')) {
      return res.status(400).json({ 
        error: 'Invalid collection ID format. Expected: issuer:taxon' 
      });
    }

    // Start async calculation (don't wait for completion)
    rarityScoringService.calculateCollectionRarity(collectionId, projectId)
      .catch(error => {
        console.error(`❌ [SCORECARD API] Calculation failed:`, error);
      });

    res.json({ 
      success: true, 
      message: 'Rarity calculation started',
      collection_id: collectionId 
    });

  } catch (error: any) {
    console.error('❌ [SCORECARD API] Calculate error:', error);
    res.status(500).json({ 
      error: 'Failed to start rarity calculation', 
      details: error.message 
    });
  }
});

/**
 * GET /api/scorecards/nft/:nftId
 * Get rarity scorecard for specific NFT
 */
router.get('/scorecards/nft/:nftId', async (req, res) => {
  try {
    const { nftId } = req.params;

    const scorecard = await db
      .select()
      .from(nftRarityScorecards)
      .where(eq(nftRarityScorecards.nft_id, nftId))
      .limit(1);

    if (scorecard.length === 0) {
      return res.status(404).json({ 
        error: 'Scorecard not found. NFT may not have been scored yet.' 
      });
    }

    res.json(scorecard[0]);

  } catch (error: any) {
    console.error('❌ [SCORECARD API] Get NFT scorecard error:', error);
    res.status(500).json({ 
      error: 'Failed to get NFT scorecard', 
      details: error.message 
    });
  }
});

/**
 * GET /api/scorecards/collection/:collectionId
 * Get collection stats and rarity distribution
 */
router.get('/scorecards/collection/:collectionId', async (req, res) => {
  try {
    const { collectionId } = req.params;

    const stats = await db
      .select()
      .from(projectCollectionStats)
      .where(eq(projectCollectionStats.collection_id, collectionId))
      .limit(1);

    if (stats.length === 0) {
      return res.status(404).json({ 
        error: 'Collection stats not found. Collection may not have been scored yet.' 
      });
    }

    res.json(stats[0]);

  } catch (error: any) {
    console.error('❌ [SCORECARD API] Get collection stats error:', error);
    res.status(500).json({ 
      error: 'Failed to get collection stats', 
      details: error.message 
    });
  }
});

/**
 * GET /api/scorecards/collection/:collectionId/traits
 * Get all trait rarity scores for collection
 */
router.get('/scorecards/collection/:collectionId/traits', async (req, res) => {
  try {
    const { collectionId } = req.params;
    const { traitType } = req.query;

    let query = db.select().from(projectTraitScores);
    const conditions = [eq(projectTraitScores.collection_id, collectionId)];
    
    if (traitType) {
      conditions.push(eq(projectTraitScores.trait_type, traitType as string));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const traits = await query.orderBy(desc(projectTraitScores.rarity_score));

    res.json({
      collection_id: collectionId,
      total_traits: traits.length,
      traits
    });

  } catch (error: any) {
    console.error('❌ [SCORECARD API] Get traits error:', error);
    res.status(500).json({ 
      error: 'Failed to get trait scores', 
      details: error.message 
    });
  }
});

/**
 * GET /api/scorecards/collection/:collectionId/leaderboard
 * Get top NFTs in collection by rarity
 */
router.get('/scorecards/collection/:collectionId/leaderboard', async (req, res) => {
  try {
    const { collectionId } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;
    const tier = req.query.tier as string;

    let query = db.select().from(nftRarityScorecards);
    const conditions = [eq(nftRarityScorecards.collection_id, collectionId)];
    
    if (tier) {
      conditions.push(eq(nftRarityScorecards.rarity_tier, tier));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const leaderboard = await query
      .orderBy(desc(nftRarityScorecards.total_rarity_score))
      .limit(limit);

    res.json({
      collection_id: collectionId,
      total_nfts: leaderboard.length,
      filter: tier || 'all',
      leaderboard
    });

  } catch (error: any) {
    console.error('❌ [SCORECARD API] Get leaderboard error:', error);
    res.status(500).json({ 
      error: 'Failed to get leaderboard', 
      details: error.message 
    });
  }
});

/**
 * GET /api/scorecards/project/:projectId
 * Get project scorecard with collection stats
 */
router.get('/scorecards/project/:projectId', async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);

    const stats = await db
      .select()
      .from(projectCollectionStats)
      .where(eq(projectCollectionStats.project_id, projectId))
      .limit(1);

    if (stats.length === 0) {
      return res.status(404).json({ 
        error: 'Project scorecard not found' 
      });
    }

    // Get trait breakdown
    const traits = await db
      .select({
        trait_type: projectTraitScores.trait_type,
        trait_count: sql<number>`count(*)::int`,
        avg_rarity: sql<number>`avg(${projectTraitScores.rarity_score})::numeric`,
      })
      .from(projectTraitScores)
      .where(eq(projectTraitScores.project_id, projectId))
      .groupBy(projectTraitScores.trait_type);

    // Get top 10 rarest NFTs
    const topNFTs = await db
      .select()
      .from(nftRarityScorecards)
      .where(eq(nftRarityScorecards.project_id, projectId))
      .orderBy(desc(nftRarityScorecards.total_rarity_score))
      .limit(10);

    res.json({
      project_id: projectId,
      collection_stats: stats[0],
      trait_breakdown: traits,
      top_nfts: topNFTs
    });

  } catch (error: any) {
    console.error('❌ [SCORECARD API] Get project scorecard error:', error);
    res.status(500).json({ 
      error: 'Failed to get project scorecard', 
      details: error.message 
    });
  }
});

/**
 * GET /api/scorecards/calculation-history/:collectionId
 * Get calculation history for collection
 */
router.get('/scorecards/calculation-history/:collectionId', async (req, res) => {
  try {
    const { collectionId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;

    const history = await db
      .select()
      .from(rarityCalculationHistory)
      .where(eq(rarityCalculationHistory.collection_id, collectionId))
      .orderBy(desc(rarityCalculationHistory.started_at))
      .limit(limit);

    res.json({
      collection_id: collectionId,
      total_calculations: history.length,
      history
    });

  } catch (error: any) {
    console.error('❌ [SCORECARD API] Get calculation history error:', error);
    res.status(500).json({ 
      error: 'Failed to get calculation history', 
      details: error.message 
    });
  }
});

/**
 * GET /api/scorecards/search
 * Search NFTs by rarity criteria
 */
router.get('/scorecards/search', async (req, res) => {
  try {
    const { collectionId, minScore, maxScore, tier, limit = 50 } = req.query;

    const conditions: any[] = [];
    if (collectionId) {
      conditions.push(eq(nftRarityScorecards.collection_id, collectionId as string));
    }
    if (tier) {
      conditions.push(eq(nftRarityScorecards.rarity_tier, tier as string));
    }
    if (minScore) {
      conditions.push(sql`${nftRarityScorecards.total_rarity_score} >= ${parseInt(minScore as string)}`);
    }
    if (maxScore) {
      conditions.push(sql`${nftRarityScorecards.total_rarity_score} <= ${parseInt(maxScore as string)}`);
    }

    let query = db.select().from(nftRarityScorecards);
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const results = await query
      .orderBy(desc(nftRarityScorecards.total_rarity_score))
      .limit(parseInt(limit as string));

    res.json({
      filters: { collectionId, minScore, maxScore, tier },
      total: results.length,
      nfts: results
    });

  } catch (error: any) {
    console.error('❌ [SCORECARD API] Search error:', error);
    res.status(500).json({ 
      error: 'Failed to search NFTs', 
      details: error.message 
    });
  }
});

export default router;
