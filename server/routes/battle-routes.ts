/**
 * Battle System Routes
 * 
 * Turn-based battle system with The Oracle AI agent integration
 */

import { Router } from "express";
import { db } from "../db";
import { eq, and, desc, sql } from "drizzle-orm";
import type { InferInsertModel } from "drizzle-orm";
import { 
  battles, 
  battleMoves, 
  squadrons,
  gamingPlayers,
  playerCivilizations,
  nftPowerAttributes,
  insertBattleSchema,
  insertBattleMoveSchema,
  battleWagers,
} from "@shared/schema";
import {
  generateBattleIntroduction,
  narrateBattleTurn,
  generateStrategicOptions,
  generateBattleConclusion,
  generateBattleImage,
} from "../services/oracle-battle-agent";
import { sessionAuth } from "../middleware/session-auth";
import { payoutBattleWinner } from "../services/battle-wagering-service";

const router = Router();

// Helper to get player with civilization
async function getPlayerWithCiv(handle: string) {
  const player = await db.query.gamingPlayers.findFirst({
    where: eq(gamingPlayers.user_handle, handle),
  });

  if (!player) return null;

  const civilization = await db.query.playerCivilizations.findFirst({
    where: eq(playerCivilizations.player_id, player.id),
  });

  return { ...player, civilization };
}

// Helper to lock wagers when battle starts
async function lockWagers(battleId: string) {
  await db.update(battleWagers)
    .set({ 
      status: "locked",
      locked_at: new Date()
    } as any)
    .where(and(
      eq(battleWagers.battle_id, battleId),
      eq(battleWagers.status, "pending")
    ));
}

// Helper to calculate and distribute payouts when battle completes
async function distributeBattlePayouts(battleId: string, winnerId: string) {
  try {
    // Get all wagers for this battle
    const wagers = await db.query.battleWagers.findMany({
      where: eq(battleWagers.battle_id, battleId),
    });

    if (!wagers || wagers.length === 0) {
      console.log(`[Wagering] No wagers to distribute for battle ${battleId}`);
      return;
    }

    // Calculate total prize pool
    const totalPool = wagers.reduce((sum, w) => {
      return sum + parseFloat(w.amount || "0");
    }, 0);

    // Apply 80% payout formula (20% platform fee)
    const winnerPayout = totalPool * 0.80;
    const platformFee = totalPool * 0.20;

    console.log(`[Wagering] Battle ${battleId} - Total pool: ${totalPool} RDL`);
    console.log(`[Wagering] Winner payout (80%): ${winnerPayout} RDL`);
    console.log(`[Wagering] Platform fee (20%): ${platformFee} RDL`);

    // Winner gets 80% of the pool
    const winnerWager = wagers.find(w => w.player_id === winnerId);

    if (!winnerWager) {
      console.warn(`⚠️ [Wagering] No wager found for winner ${winnerId}`);
      return;
    }

    // IDEMPOTENCY CHECK: Skip if already paid out
    if (winnerWager.status === "paid_out" && winnerWager.payout_tx_hash) {
      console.log(`✅ [Wagering] Battle ${battleId} already paid out (tx: ${winnerWager.payout_tx_hash}), skipping`);
      return;
    }

    // STALE LOCK RECOVERY: Check if lock is stale (older than 5 minutes)
    const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
    const now = new Date();
    
    if (winnerWager.status === "payout_in_progress") {
      const lockedAt = winnerWager.locked_at;
      if (lockedAt) {
        const lockAge = now.getTime() - new Date(lockedAt).getTime();
        if (lockAge < LOCK_TIMEOUT_MS) {
          console.log(`⏭️ [Wagering] Battle ${battleId} payout in progress (locked ${Math.round(lockAge/1000)}s ago), skipping`);
          return; // Still fresh, skip
        }
        console.warn(`⚠️ [Wagering] Battle ${battleId} has stale lock (${Math.round(lockAge/1000)}s old), reclaiming...`);
      }
    }

    // CONCURRENCY PROTECTION: Mark as in-progress to prevent duplicate payouts
    const updateResult = await db.update(battleWagers)
      .set({ 
        status: "payout_in_progress"
      } as any)
      .where(
        and(
          eq(battleWagers.id, winnerWager.id),
          sql`${battleWagers.status} != 'paid_out'` // Only if not already paid
        )
      )
      .returning({ id: battleWagers.id });

    // If update failed, another process is handling it
    if (!updateResult || updateResult.length === 0) {
      console.log(`⏭️ [Wagering] Battle ${battleId} payout already in progress by another process, skipping`);
      return;
    }

    console.log(`🔒 [Wagering] Battle ${battleId} locked for payout processing`);

    // WRAP PAYOUT IN TRY-CATCH to reset status on any error
    try {
      // CURRENCY VALIDATION: Ensure all wagers use same currency
      const currencies = new Set(wagers.map(w => w.currency));
      if (currencies.size > 1) {
        console.error(`❌ [Wagering] Mixed currencies detected in battle ${battleId}: ${Array.from(currencies).join(', ')}`);
        throw new Error('Mixed currency battles not supported');
      }

      // STEP 1: ATTEMPT XRPL PAYOUT (now that we've locked the record)
      console.log(`💸 [Wagering] Step 1: Initiating XRPL payout...`);
      
      // Get winner's wallet address
      const winner = await db.query.gamingPlayers.findFirst({
        where: eq(gamingPlayers.id, winnerId)
      });

      if (!winner || !winner.wallet_address) {
        console.error(`❌ [Wagering] Winner wallet address not found for player ${winnerId}`);
        throw new Error("Winner wallet address not found");
      }

      // Determine currency (XRP or RDL based on wager)
      const currency = winnerWager.currency === 'RDL' ? 'RDL' : 'XRP';
      
      const payoutResult = await payoutBattleWinner(
        battleId,
        winner.wallet_address,
        winnerPayout.toString(),
        currency as 'XRP' | 'RDL'
      );

      if (!payoutResult.success) {
        console.error(`❌ [Wagering] XRPL payout failed: ${payoutResult.error}`);
        throw new Error(`XRPL payout failed: ${payoutResult.error}`);
      }

      console.log(`✅ [Wagering] XRPL payout successful: ${payoutResult.txHash}`);

      // STEP 2: ONLY NOW mark as paid_out in database (XRPL transfer succeeded)
      // STEP 2: Mark winner wager as paid
      await db.update(battleWagers)
        .set({
          status: "paid_out",
          payout_amount: winnerPayout.toString(),
          payout_percentage: "80.00",
          payout_tx_hash: payoutResult.txHash,
          paid_out_at: new Date()
        } as any)
        .where(eq(battleWagers.id, winnerWager.id));

      console.log(`✅ [Wagering] Paid out ${winnerPayout} ${currency} (80%) to winner ${winnerId}`);
      console.log(`💰 [Platform] Collected ${platformFee} ${currency} (20%) as platform fee`);

      // STEP 3: Now that winner payout succeeded, mark loser wagers as complete
      const loserIds = wagers.filter(w => w.player_id !== winnerId).map(w => w.id);
      if (loserIds.length > 0) {
        await db.update(battleWagers)
          .set({ 
            status: "paid_out", 
            payout_amount: "0", 
            paid_out_at: new Date() 
          } as any)
          .where(sql`${battleWagers.id} = ANY(${loserIds})`);
        console.log(`✅ [Wagering] Marked ${loserIds.length} loser wagers as complete`);
      }

      // STEP 4: Update battle winner_prize field with actual payout (80%)
      await db.update(battles)
        .set({ winner_prize: winnerPayout.toString() } as any)
        .where(eq(battles.id, battleId));

      console.log(`✅ [Wagering] Battle ${battleId} payout flow completed successfully`);

    } catch (payoutError: any) {
      // CRITICAL: Reset status to allow retries (prevent stuck payouts)
      console.error(`❌ [Wagering] Payout error, resetting status for retry: ${payoutError.message}`);
      await db.update(battleWagers)
        .set({ 
          status: "payout_failed",
          payout_amount: winnerPayout.toString()
        } as any)
        .where(eq(battleWagers.id, winnerWager.id));
      throw payoutError; // Re-throw to propagate error
    }

  } catch (error) {
    console.error("❌ [Wagering] Failed to distribute payouts:", error);
    throw error;
  }
}

// ==========================================
// BATTLE CREATION & MANAGEMENT
// ==========================================

/**
 * GET /api/battles/player
 * Get current player's active battles
 * REQUIRES AUTHENTICATION
 */
router.get("/player", sessionAuth, async (req, res) => {
  try {
    const handle = req.user?.userHandle;
    if (!handle) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const playerData = await getPlayerWithCiv(handle);
    if (!playerData) {
      return res.status(404).json({ error: "Gaming profile not found" });
    }

    // Get active battles where player is involved
    const activeBattles = await db
      .select()
      .from(battles)
      .where(
        and(
          sql`(${battles.creator_player_id} = ${playerData.id} OR ${battles.opponent_player_id} = ${playerData.id})`,
          sql`${battles.status} IN ('open', 'in_progress')`
        )
      )
      .orderBy(desc(battles.created_at))
      .limit(10);

    return res.json({
      activeBattles: activeBattles || [],
      totalActive: activeBattles?.length || 0,
    });
  } catch (error: any) {
    console.error("❌ Error fetching player battles:", error);
    return res.status(500).json({ error: "Failed to fetch battles" });
  }
});

/**
 * POST /api/battles/create
 * Create a new battle challenge
 * REQUIRES AUTHENTICATION
 */
router.post("/create", sessionAuth, async (req, res) => {
  try {
    const handle = req.user?.userHandle;
    if (!handle) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { squadronId, battleType, combatType, wagerAmount, isAiBattle, aiDifficulty, maxNftsLimit, team1AllianceId } = req.body;

    // Get player info with civilization first
    const playerData = await getPlayerWithCiv(handle);
    if (!playerData) {
      return res.status(404).json({ error: "Gaming profile not found" });
    }

    // Validate squadron exists AND belongs to the requesting player
    const squadron = await db.query.squadrons.findFirst({
      where: eq(squadrons.id, squadronId),
    });

    if (!squadron) {
      return res.status(404).json({ error: "Squadron not found" });
    }

    // CRITICAL SECURITY CHECK: Verify squadron ownership
    if (squadron.player_id !== playerData.id) {
      return res.status(403).json({ 
        error: "Unauthorized: You can only create battles with your own squadrons" 
      });
    }

    // Validate NFT limits based on battle type
    const nftLimit = maxNftsLimit || 1000;
    
    if (isAiBattle) {
      // 1 vs AI: 1-1000 NFTs
      if (nftLimit < 1 || nftLimit > 1000) {
        return res.status(400).json({ error: "1 vs AI battles must have 1-1000 NFTs" });
      }
    } else if (battleType === "mass_war") {
      // Mass War: 10-1000 NFTs
      if (nftLimit < 10 || nftLimit > 1000) {
        return res.status(400).json({ error: "Mass War battles must have 10-1000 NFTs" });
      }
    } else {
      // 1 vs 1: 10-1000 NFTs
      if (nftLimit < 10 || nftLimit > 1000) {
        return res.status(400).json({ error: "1 vs 1 battles must have 10-1000 NFTs" });
      }
    }

    // Validate squadron has MINIMUM required NFTs for this battle type
    const minRequired = isAiBattle ? 1 : 10; // AI battles can use 1 NFT, others need 10+
    if ((squadron.nft_count || 0) < minRequired) {
      return res.status(400).json({ 
        error: `Squadron must have at least ${minRequired} NFTs to participate. Current: ${squadron.nft_count || 0}` 
      });
    }

    // Note: If squadron has more NFTs than limit, only the first N NFTs will be used in battle

    // Create battle
    const [battle] = await db.insert(battles).values({
      battle_type: battleType,
      combat_type: combatType,
      wager_amount: wagerAmount || "0",
      max_nfts_limit: nftLimit,
      creator_player_id: playerData.id,
      creator_squadron_id: squadronId,
      team_1_alliance_id: team1AllianceId || null,
      is_ai_battle: isAiBattle || false,
      ai_difficulty: aiDifficulty,
      status: isAiBattle ? "in_progress" : "open",
      started_at: isAiBattle ? new Date() : null,
      expires_at: isAiBattle ? null : new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h expiry
    } as any).returning();

    // Create wager record if wager amount > 0
    const wagerAmountNum = parseFloat(wagerAmount || "0");
    if (wagerAmountNum > 0) {
      await db.insert(battleWagers).values({
        battle_id: battle.id,
        player_id: playerData.id,
        amount: wagerAmount,
        currency: "RDL",
        status: "pending" // Will be locked when battle starts
      } as any as any);
      console.log(`✅ [Wagering] Created wager of ${wagerAmount} RDL for battle ${battle.id}`);
    }

    // Lock wagers immediately if AI battle (starts immediately)
    if (isAiBattle && wagerAmountNum > 0) {
      await lockWagers(battle.id);
      console.log(`🔒 [Wagering] Locked wagers for AI battle ${battle.id}`);
    }

    // Generate battle introduction if AI battle
    if (isAiBattle) {
      const civName = playerData.civilization?.civilization_name || playerData.player_name || "Unknown";
      const squadronPower = Number(squadron.total_power) || 0;
      const introduction = await generateBattleIntroduction({
        battleId: battle.id,
        creatorName: civName,
        creatorCivilization: playerData.play_type || "Unknown",
        creatorPower: squadronPower,
        opponentName: `AI Opponent (${aiDifficulty})`,
        opponentCivilization: "The Oracle's Forces",
        opponentPower: squadronPower * (aiDifficulty === "easy" ? 0.8 : aiDifficulty === "hard" ? 1.2 : 1.0),
        battleType,
        combatType,
      });

      await db.update(battles)
        .set({ battle_storyline: introduction } as any)
        .where(eq(battles.id, battle.id));
    }

    res.json({
      success: true,
      battle: {
        ...battle,
        battle_storyline: isAiBattle ? await db.query.battles.findFirst({ where: eq(battles.id, battle.id) }).then(b => b?.battle_storyline) : null,
      },
    });
  } catch (error) {
    console.error("❌ [Battle] Failed to create battle:", error);
    res.status(500).json({ error: "Failed to create battle" });
  }
});

/**
 * GET /api/battles/list
 * Get list of battles (public, no auth required)
 * IMPORTANT: Must be defined BEFORE /:battleId route
 */
router.get("/list", async (req, res) => {
  try {
    const { status, playerId, limit = 20 } = req.query;

    let query = db.select().from(battles);
    const conditions = [];

    if (status) {
      conditions.push(eq(battles.status, String(status)));
    }

    if (playerId) {
      conditions.push(
        sql`${battles.creator_player_id} = ${String(playerId)} OR ${battles.opponent_player_id} = ${String(playerId)}`
      );
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const battleList = await query
      .orderBy(desc(battles.created_at))
      .limit(parseInt(String(limit)));

    res.json({
      success: true,
      battles: battleList,
    });
  } catch (error) {
    console.error("❌ [Battle] Failed to list battles:", error);
    res.status(500).json({ error: "Failed to list battles" });
  }
});

// ==========================================
// SPECIFIC ROUTES - MUST COME BEFORE /:battleId
// ==========================================

/**
 * GET /api/battles/player/:handle/history
 * Get battle history for a player (public, no auth required)
 * CRITICAL: Must be defined BEFORE /:battleId route
 */
router.get("/player/:handle/history", async (req, res) => {
  try {
    const { handle } = req.params;
    const { limit = 10, offset = 0 } = req.query;

    console.log(`🔍 [Battle History] Looking for player with handle: ${handle}`);

    // Find player by handle
    const player = await db.query.gamingPlayers.findFirst({
      where: eq(gamingPlayers.user_handle, handle),
    });

    console.log(`🔍 [Battle History] Player found:`, player ? `ID ${player.id}` : 'NOT FOUND');

    if (!player) {
      return res.status(404).json({ error: "Player not found" });
    }

    // Get battle history - battles store player handles, not UUIDs
    const playerBattles = await db.select()
      .from(battles)
      .where(
        sql`${battles.creator_player_id} = ${handle} OR ${battles.opponent_player_id} = ${handle}`
      )
      .orderBy(desc(battles.created_at))
      .limit(parseInt(String(limit)))
      .offset(parseInt(String(offset)));

    // Get stats
    const stats = await db.select({
      total_battles: sql<number>`COUNT(*)`,
      battles_won: sql<number>`COUNT(CASE WHEN ${battles.winner_player_id} = ${handle} THEN 1 END)`,
      battles_lost: sql<number>`COUNT(CASE WHEN ${battles.status} = 'completed' AND ${battles.winner_player_id} != ${handle} THEN 1 END)`,
    })
      .from(battles)
      .where(
        sql`${battles.creator_player_id} = ${handle} OR ${battles.opponent_player_id} = ${handle}`
      );

    console.log(`✅ [Battle History] Retrieved ${playerBattles.length} battles for ${handle}`);

    res.json({
      success: true,
      battles: playerBattles,
      stats: stats[0] || { total_battles: 0, battles_won: 0, battles_lost: 0 }
    });
  } catch (error) {
    console.error("❌ [Battle History] Error:", error);
    res.status(500).json({ error: "Failed to fetch battle history" });
  }
});

/**
 * GET /api/battles/leaderboard
 * Get global battle leaderboard
 * CRITICAL: Must be defined BEFORE /:battleId route
 */
router.get("/leaderboard", async (req, res) => {
  try {
    const { limit = 100 } = req.query;

    // Get top players by battles won
    const leaderboard = await db.select({
      player_handle: battles.winner_player_id,
      wins: sql<number>`COUNT(*)`,
    })
      .from(battles)
      .where(eq(battles.status, 'completed'))
      .groupBy(battles.winner_player_id)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(parseInt(String(limit)));

    // Get player details for each winner
    const leaderboardWithDetails = await Promise.all(
      leaderboard.map(async (entry) => {
        if (!entry.player_handle) return null;
        
        const player = await db.query.gamingPlayers.findFirst({
          where: eq(gamingPlayers.user_handle, entry.player_handle),
        });

        return {
          ...entry,
          player_name: player?.player_name || entry.player_handle,
          player
        };
      })
    );

    res.json({
      success: true,
      leaderboard: leaderboardWithDetails.filter(entry => entry !== null)
    });
  } catch (error) {
    console.error("❌ [Leaderboard] Error:", error);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

/**
 * GET /api/battles/civilizations/leaderboard
 * Get leaderboard ranked by civilization power
 * CRITICAL: Must be defined BEFORE /:battleId route
 */
router.get("/civilizations/leaderboard", async (req, res) => {
  try {
    const { limit = 100 } = req.query;

    // Get top players by total power level
    const leaderboard = await db.select()
      .from(gamingPlayers)
      .orderBy(desc(gamingPlayers.total_power_level))
      .limit(parseInt(String(limit)));

    res.json({
      success: true,
      leaderboard
    });
  } catch (error) {
    console.error("❌ [Civilizations Leaderboard] Error:", error);
    res.status(500).json({ error: "Failed to fetch civilizations leaderboard" });
  }
});

// ==========================================
// WILDCARD ROUTE - MUST COME LAST
// ==========================================

/**
 * GET /api/battles/:battleId
 * Get battle details (public, no auth required)
 * CRITICAL: This MUST be defined AFTER all specific routes (/player, /leaderboard, etc.)
 * because Express matches routes in order and /:battleId will catch anything
 */
router.get("/:battleId", async (req, res) => {
  try {
    const { battleId } = req.params;

    const battle = await db.query.battles.findFirst({
      where: eq(battles.id, battleId),
    });

    if (!battle) {
      return res.status(404).json({ error: "Battle not found" });
    }

    // Get battle moves
    const moves = await db.query.battleMoves.findMany({
      where: eq(battleMoves.battle_id, battleId),
      orderBy: [desc(battleMoves.round_number)],
    });

    res.json({
      success: true,
      battle,
      moves,
    });
  } catch (error) {
    console.error("❌ [Battle] Failed to get battle:", error);
    res.status(500).json({ error: "Failed to get battle" });
  }
});

// ==========================================
// BATTLE GAMEPLAY
// ==========================================

/**
 * POST /api/battles/:battleId/start-turn
 * Get strategic options for the current turn
 * REQUIRES AUTHENTICATION
 */
router.post("/:battleId/start-turn", sessionAuth, async (req, res) => {
  try {
    const handle = req.user?.userHandle;
    if (!handle) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { battleId } = req.params;

    // Get battle details
    const battle = await db.query.battles.findFirst({
      where: eq(battles.id, battleId),
    });

    if (!battle) {
      return res.status(404).json({ error: "Battle not found" });
    }

    if (battle.status !== "in_progress") {
      return res.status(400).json({ error: "Battle is not in progress" });
    }

    // Get player info
    const playerData = await getPlayerWithCiv(handle);
    if (!playerData) {
      return res.status(404).json({ error: "Gaming profile not found" });
    }

    // Verify player is part of this battle
    if (battle.creator_player_id !== playerData.id && battle.opponent_player_id !== playerData.id) {
      return res.status(403).json({ error: "Not part of this battle" });
    }

    // Get previous moves
    const previousMoves = await db.query.battleMoves.findMany({
      where: and(
        eq(battleMoves.battle_id, battleId),
        eq(battleMoves.player_id, playerData.id)
      ),
      orderBy: [desc(battleMoves.round_number)],
      limit: 3,
    });

    const previousActions = previousMoves.map(m => ({
      action: m.strategic_choice,
      result: m.success ? "success" : "failure",
    }));

    // Get current round number
    const allMoves = await db.query.battleMoves.findMany({
      where: eq(battleMoves.battle_id, battleId),
    });
    const currentRound = Math.floor(allMoves.length / 2) + 1;

    const civName = playerData.civilization?.civilization_name || playerData.player_name || "Unknown";

    // Generate strategic options with The Oracle
    const options = await generateStrategicOptions({
      playerId: playerData.id,
      playerName: civName,
      currentPower: battle.creator_player_id === playerData.id ? (battle.creator_power_used || 0) : (battle.opponent_power_used || 0),
      opponentPower: battle.creator_player_id === playerData.id ? (battle.opponent_power_used || 0) : (battle.creator_power_used || 0),
      roundNumber: currentRound,
      combatType: battle.combat_type,
      previousActions,
    });

    res.json({
      success: true,
      round: currentRound,
      options,
    });
  } catch (error) {
    console.error("❌ [Battle] Failed to start turn:", error);
    res.status(500).json({ error: "Failed to start turn" });
  }
});

/**
 * POST /api/battles/:battleId/make-move
 * Execute a battle move with Oracle narration
 * REQUIRES AUTHENTICATION
 */
router.post("/:battleId/make-move", sessionAuth, async (req, res) => {
  try {
    const handle = req.user?.userHandle;
    if (!handle) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { battleId } = req.params;
    const { optionId, action, description, riskLevel } = req.body;

    // Validate risk level
    const validRisks = ["low", "medium", "high"];
    if (!validRisks.includes(riskLevel)) {
      return res.status(400).json({ error: "Invalid risk level" });
    }

    // Get battle details
    const battle = await db.query.battles.findFirst({
      where: eq(battles.id, battleId),
    });

    if (!battle) {
      return res.status(404).json({ error: "Battle not found" });
    }

    if (battle.status !== "in_progress") {
      return res.status(400).json({ error: "Battle is not in progress" });
    }

    // Get player info
    const playerData = await getPlayerWithCiv(handle);
    if (!playerData) {
      return res.status(404).json({ error: "Gaming profile not found" });
    }

    // Verify player is part of this battle
    if (battle.creator_player_id !== playerData.id && battle.opponent_player_id !== playerData.id) {
      return res.status(403).json({ error: "Not part of this battle" });
    }

    // Calculate move outcome based on risk level
    const riskLevels = { low: 0.8, medium: 0.6, high: 0.4 } as const;
    const baseSuccessRate = riskLevels[riskLevel as keyof typeof riskLevels];
    const randomRoll = Math.random();
    const success = randomRoll < baseSuccessRate;
    
    // Critical success/failure (10% chance each)
    const isCritical = randomRoll < 0.1 || randomRoll > 0.9;
    const result = success 
      ? (isCritical ? "critical_success" : "success")
      : (isCritical ? "critical_failure" : "failure");

    // Calculate power change
    const powerValues = { low: 10, medium: 20, high: 40 } as const;
    const basePower = powerValues[riskLevel as keyof typeof powerValues];
    const powerMultiplier = result === "critical_success" ? 2 : result === "critical_failure" ? -1 : (success ? 1 : -0.5);
    const powerChange = Math.round(basePower * powerMultiplier);

    // Get current round number
    const allMoves = await db.query.battleMoves.findMany({
      where: eq(battleMoves.battle_id, battleId),
    });
    const currentRound = Math.floor(allMoves.length / 2) + 1;

    const civName = playerData.civilization?.civilization_name || playerData.player_name || "Unknown";

    // Generate Oracle narration (thread ID is managed by the service)
    const { narration } = await narrateBattleTurn({
      battleId,
      playerId: playerData.id,
      playerName: civName,
      action,
      actionDescription: description,
      result,
      powerChange,
      roundNumber: currentRound,
    });

    // Create battle move
    const [move] = await db.insert(battleMoves).values({
      battle_id: battleId,
      round_number: currentRound,
      player_id: playerData.id,
      move_type: riskLevel,
      strategic_choice: action,
      risk_level: riskLevel,
      success,
      power_change: powerChange,
      result_description: description,
      ai_narration: narration
    } as any as any).returning();

    // Update battle power
    const isCreator = battle.creator_player_id === playerData.id;
    const updatedBattle = await db.update(battles)
      .set({
        creator_power_used: isCreator 
          ? (battle.creator_power_used || 0) + powerChange
          : battle.creator_power_used,
        opponent_power_used: !isCreator
          ? (battle.opponent_power_used || 0) + powerChange
          : battle.opponent_power_used,
        battle_log: sql`${battles.battle_log} || ${JSON.stringify([{
          round: currentRound,
          player_id: playerData.id,
          action,
          result,
          power_change: powerChange,
          timestamp: new Date().toISOString(),
        }])}::jsonb`
      } as any)
      .where(eq(battles.id, battleId))
      .returning();

    // Check if battle should end (e.g., after 10 rounds or if power reaches threshold)
    const shouldEnd = currentRound >= 10 || 
      Math.abs((updatedBattle[0].creator_power_used || 0) - (updatedBattle[0].opponent_power_used || 0)) > 100;

    if (shouldEnd) {
      const winnerIsCreator = (updatedBattle[0].creator_power_used || 0) > (updatedBattle[0].opponent_power_used || 0);
      const winnerId = winnerIsCreator ? battle.creator_player_id : battle.opponent_player_id;
      
      await db.update(battles)
        .set({
          status: "completed",
          winner_player_id: winnerId,
          winner_squadron_id: winnerIsCreator ? battle.creator_squadron_id : battle.opponent_squadron_id,
          completed_at: new Date()
        } as any)
        .where(eq(battles.id, battleId));

      // Distribute wager payouts to winner
      if (winnerId) {
        await distributeBattlePayouts(battleId, winnerId);
      }
    }

    res.json({
      success: true,
      move,
      narration,
      battle: updatedBattle[0],
      battleEnded: shouldEnd,
    });
  } catch (error) {
    console.error("❌ [Battle] Failed to make move:", error);
    res.status(500).json({ error: "Failed to make move" });
  }
});

// ==========================================
// DUPLICATE ROUTES REMOVED
// All routes have been moved above the /:battleId wildcard route
// to prevent route matching conflicts
// ==========================================

/**
 * GET /api/battles/leaderboard
 * Get battle leaderboard showing top warriors by wins (public, no auth required)
 */
router.get("/leaderboard", async (req, res) => {
  try {
    // Validate and sanitize limit parameter
    const limitParam = parseInt(String(req.query.limit || 50));
    const limit = isNaN(limitParam) || limitParam < 1 ? 50 : Math.min(limitParam, 100);

    // Get top players by battle wins with player data in single query
    const battleLeaderboard = await db
      .select({
        player_id: battles.winner_player_id,
        wins: sql<number>`COUNT(*)`.as('wins'),
      })
      .from(battles)
      .where(
        and(
          eq(battles.status, "completed"),
          sql`${battles.winner_player_id} IS NOT NULL`
        )
      )
      .groupBy(battles.winner_player_id)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(limit);

    // Enrich with player data
    const enrichedLeaderboard = await Promise.all(
      battleLeaderboard.map(async (entry) => {
        if (!entry.player_id) return null;

        const player = await db.query.gamingPlayers.findFirst({
          where: eq(gamingPlayers.id, entry.player_id),
          with: {
            civilization: true,
          },
        });

        if (!player) return null;

        // Get total battles for this player with proper SQL grouping
        const totalBattles = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(battles)
          .where(
            and(
              sql`(${battles.creator_player_id} = ${entry.player_id} OR ${battles.opponent_player_id} = ${entry.player_id})`,
              eq(battles.status, "completed")
            )
          );

        const totalCount = totalBattles[0]?.count || 0;
        const winRate = totalCount > 0 ? ((entry.wins / totalCount) * 100).toFixed(1) : "0.0";

        return {
          player_id: entry.player_id,
          player_handle: player.user_handle,
          player_name: player.player_name,
          civilization_name: null,
          play_type: player.play_type,
          commander_class: player.commander_class,
          wins: entry.wins,
          total_battles: totalCount,
          win_rate: winRate,
          total_power: player.total_power_level || 0,
        };
      })
    );

    // Filter out nulls and recompute ranks
    const validLeaderboard = enrichedLeaderboard
      .filter(entry => entry !== null)
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));

    res.json({
      success: true,
      data: validLeaderboard,
    });
  } catch (error) {
    console.error("❌ [Battle Leaderboard] Failed:", error);
    res.json({ 
      success: false,
      error: "Failed to fetch battle leaderboard" 
    });
  }
});

/**
 * GET /api/battles/civilizations/leaderboard
 * Get civilization leaderboard showing top civilizations by victories and power
 */
router.get("/civilizations/leaderboard", async (req, res) => {
  try {
    // Validate and sanitize limit parameter
    const limitParam = parseInt(String(req.query.limit || 50));
    const limit = isNaN(limitParam) || limitParam < 1 ? 50 : Math.min(limitParam, 100);

    // Get all civilizations with their stats
    const civilizations = await db
      .select()
      .from(playerCivilizations)
      .orderBy(
        desc(playerCivilizations.victories),
        desc(playerCivilizations.military_strength),
        desc(playerCivilizations.culture_level)
      )
      .limit(limit);

    // Enrich with player data
    const enrichedLeaderboard = await Promise.all(
      civilizations.map(async (civ) => {
        const player = await db.query.gamingPlayers.findFirst({
          where: eq(gamingPlayers.id, civ.player_id),
        });

        if (!player) return null;

        const totalBattles = (civ.victories || 0) + (civ.defeats || 0);
        const winRate = totalBattles > 0
          ? (((civ.victories || 0) / totalBattles) * 100).toFixed(1)
          : "0.0";

        return {
          civilization_id: civ.id,
          civilization_name: civ.civilization_name,
          civilization_type: civ.civilization_type,
          player_handle: player.user_handle,
          player_name: player.player_name,
          victories: civ.victories || 0,
          defeats: civ.defeats || 0,
          win_rate: winRate,
          military_strength: civ.military_strength || 0,
          culture_level: civ.culture_level || 0,
          research_level: civ.research_level || 0,
          total_wealth: civ.total_wealth || "0",
          global_rank: civ.global_rank,
          reputation: civ.reputation || 100,
          wonders_built: civ.wonders_built || 0,
          achievements: civ.achievements || [],
          crest_image: civ.crest_image,
        };
      })
    );

    // Filter out nulls and recompute ranks
    const validLeaderboard = enrichedLeaderboard
      .filter(entry => entry !== null)
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));

    res.json({
      success: true,
      data: validLeaderboard,
    });
  } catch (error) {
    console.error("❌ [Civilization Leaderboard] Failed:", error);
    res.json({ 
      success: false,
      error: "Failed to fetch civilization leaderboard" 
    });
  }
});

export default router;
