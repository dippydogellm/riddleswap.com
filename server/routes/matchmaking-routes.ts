import { Router } from "express";
import { sessionAuth } from "../middleware/session-auth";
import { findMatch, getMatchmakingQueue, validateMatch, type MatchmakingCriteria } from "../services/matchmaking-service";

const router = Router();

/**
 * POST /api/matchmaking/find
 * Find a suitable opponent for a 1v1 battle
 * 
 * Body:
 * - squadronId: string (required)
 * - minNfts: number (optional, default 10)
 * - maxPowerVariance: number (optional, default 20%)
 * - preferredBattleType: "1v1" | "mass_war" (optional)
 */
router.post("/find", sessionAuth, async (req, res) => {
  try {
    const userHandle = req.user?.userHandle;
    if (!userHandle) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { squadronId, minNfts, maxPowerVariance, preferredBattleType } = req.body;

    if (!squadronId) {
      return res.status(400).json({ error: "squadronId is required" });
    }

    const criteria: MatchmakingCriteria = {
      userHandle,
      squadronId,
      minNfts: minNfts || 10,
      maxPowerVariance: maxPowerVariance || 20,
      preferredBattleType: preferredBattleType || "1v1"
    };

    const match = await findMatch(criteria);

    if (!match) {
      return res.json({
        success: false,
        message: "No suitable opponent found. Try adjusting your search criteria or check back later.",
        match: null
      });
    }

    res.json({
      success: true,
      message: `Match found: ${match.playerName} (Match quality: ${match.matchScore.toFixed(1)}/100)`,
      match: {
        userHandle: match.userHandle,
        playerName: match.playerName,
        totalPower: match.totalPower,
        level: match.level,
        experience: match.experience,
        squadronId: match.squadronId,
        squadronName: match.squadronName,
        nftCount: match.nftCount,
        winRate: match.winRate.toFixed(1),
        matchScore: match.matchScore.toFixed(1)
      }
    });

  } catch (error: any) {
    console.error("❌ [Matchmaking API] Error finding match:", error);
    res.status(500).json({
      error: "Failed to find match",
      details: error.message
    });
  }
});

/**
 * GET /api/matchmaking/queue
 * Get list of players currently looking for matches
 * 
 * Query params:
 * - battleType: "1v1" | "mass_war" (optional, default "1v1")
 */
router.get("/queue", sessionAuth, async (req, res) => {
  try {
    const battleType = (req.query.battleType as "1v1" | "mass_war") || "1v1";
    
    const queue = await getMatchmakingQueue(battleType);

    res.json({
      success: true,
      battleType,
      queueSize: queue.length,
      players: queue.map(player => ({
        userHandle: player.user_handle,
        playerName: player.player_name || player.user_handle,
        totalPower: Number(player.total_power || 0),
        level: player.level || 1,
        squadronId: player.squadron_id,
        squadronName: player.squadron_name || "Unnamed Squadron",
        nftCount: player.nft_count || 0,
        waitingSince: player.created_at
      }))
    });

  } catch (error: any) {
    console.error("❌ [Matchmaking API] Error getting queue:", error);
    res.status(500).json({
      error: "Failed to get matchmaking queue",
      details: error.message
    });
  }
});

/**
 * POST /api/matchmaking/validate
 * Validate if two players are a fair match
 * 
 * Body:
 * - player1Power: number (required)
 * - player2Power: number (required)
 * - maxVariance: number (optional, default 20%)
 */
router.post("/validate", sessionAuth, async (req, res) => {
  try {
    const { player1Power, player2Power, maxVariance } = req.body;

    if (player1Power === undefined || player2Power === undefined) {
      return res.status(400).json({
        error: "player1Power and player2Power are required"
      });
    }

    const isValid = validateMatch(
      Number(player1Power),
      Number(player2Power),
      maxVariance || 20
    );

    const powerDiff = Math.abs(Number(player1Power) - Number(player2Power));
    const avgPower = (Number(player1Power) + Number(player2Power)) / 2;
    const variancePercent = (powerDiff / avgPower) * 100;

    res.json({
      success: true,
      isValidMatch: isValid,
      powerDifference: powerDiff.toFixed(0),
      variancePercent: variancePercent.toFixed(1),
      maxAllowedVariance: maxVariance || 20,
      recommendation: isValid
        ? "Fair match - powers are well balanced"
        : "Unbalanced match - consider finding a different opponent"
    });

  } catch (error: any) {
    console.error("❌ [Matchmaking API] Error validating match:", error);
    res.status(500).json({
      error: "Failed to validate match",
      details: error.message
    });
  }
});

export default router;
