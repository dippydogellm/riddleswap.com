import { Router } from "express";
import { sessionAuth } from "../middleware/session-auth";
import {
  createTournament,
  registerForTournament,
  generateBrackets,
  distributePrizes,
  getActiveTournaments,
  getTournamentParticipants,
  type CreateTournamentOptions
} from "../services/tournament-service";

const router = Router();

/**
 * POST /api/tournaments/create
 * Create a new tournament (admin only for now)
 */
router.post("/create", sessionAuth, async (req, res) => {
  try {
    const userHandle = req.user?.userHandle;
    if (!userHandle) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const {
      name,
      description,
      tournamentType,
      combatType,
      entryFee,
      minPowerRequired,
      maxParticipants,
      totalPrizePool,
      registrationOpens,
      registrationCloses,
      startsAt,
      isAdminTournament
    } = req.body;

    // Validate required fields
    if (!name || !tournamentType || !combatType) {
      return res.status(400).json({
        error: "Missing required fields: name, tournamentType, combatType"
      });
    }

    const options: CreateTournamentOptions = {
      name,
      description: description || "",
      tournamentType,
      combatType,
      entryFee: entryFee || "0",
      minPowerRequired: minPowerRequired || 0,
      maxParticipants: maxParticipants || 16,
      totalPrizePool: totalPrizePool || "0",
      registrationOpens: registrationOpens ? new Date(registrationOpens) : new Date(),
      registrationCloses: registrationCloses ? new Date(registrationCloses) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // +7 days
      startsAt: startsAt ? new Date(startsAt) : new Date(Date.now() + 8 * 24 * 60 * 60 * 1000), // +8 days
      createdBy: userHandle,
      isAdminTournament: isAdminTournament || false
    };

    const tournament = await createTournament(options);

    res.json({
      success: true,
      message: "Tournament created successfully",
      tournament: {
        id: tournament.id,
        name: tournament.name,
        status: tournament.status,
        maxParticipants: tournament.max_participants,
        totalPrizePool: tournament.total_prize_pool,
        registrationOpens: tournament.registration_opens,
        startsAt: tournament.starts_at
      }
    });

  } catch (error: any) {
    console.error("❌ [Tournament API] Error creating tournament:", error);
    res.status(500).json({
      error: "Failed to create tournament",
      details: error.message
    });
  }
});

/**
 * POST /api/tournaments/:tournamentId/register
 * Register for a tournament
 */
router.post("/:tournamentId/register", sessionAuth, async (req, res) => {
  try {
    const userHandle = req.user?.userHandle;
    if (!userHandle) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { tournamentId } = req.params;
    const { squadronId } = req.body;

    if (!squadronId) {
      return res.status(400).json({ error: "squadronId is required" });
    }

    const participant = await registerForTournament(tournamentId, userHandle, squadronId);

    res.json({
      success: true,
      message: "Successfully registered for tournament",
      participant: {
        id: participant.id,
        tournamentId: participant.tournament_id,
        registeredAt: participant.registered_at
      }
    });

  } catch (error: any) {
    console.error("❌ [Tournament API] Error registering:", error);
    res.status(400).json({
      error: "Failed to register for tournament",
      details: error.message
    });
  }
});

/**
 * POST /api/tournaments/:tournamentId/start
 * Generate brackets and start tournament (creator or admin only)
 */
router.post("/:tournamentId/start", sessionAuth, async (req, res) => {
  try {
    const userHandle = req.user?.userHandle;
    if (!userHandle) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { tournamentId } = req.params;

    // Verify user has permission to start tournament (must be creator)
    const { db } = await import("../db");
    const { tournaments } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    
    const tournament = await db.query.tournaments.findFirst({
      where: eq(tournaments.id, tournamentId)
    });

    if (!tournament) {
      return res.status(404).json({ error: "Tournament not found" });
    }

    if (tournament.created_by !== userHandle) {
      return res.status(403).json({ 
        error: "Unauthorized: Only the tournament creator can start it"
      });
    }

    const result = await generateBrackets(tournamentId);

    res.json({
      success: true,
      message: "Tournament started, brackets generated",
      matches: result.matches.length,
      totalParticipants: result.totalParticipants
    });

  } catch (error: any) {
    console.error("❌ [Tournament API] Error starting tournament:", error);
    res.status(400).json({
      error: "Failed to start tournament",
      details: error.message
    });
  }
});

/**
 * POST /api/tournaments/:tournamentId/finish
 * Distribute prizes and complete tournament (creator or admin only)
 */
router.post("/:tournamentId/finish", sessionAuth, async (req, res) => {
  try {
    const userHandle = req.user?.userHandle;
    if (!userHandle) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { tournamentId } = req.params;

    // Verify user has permission to finish tournament (must be creator)
    const { db } = await import("../db");
    const { tournaments } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    
    const tournament = await db.query.tournaments.findFirst({
      where: eq(tournaments.id, tournamentId)
    });

    if (!tournament) {
      return res.status(404).json({ error: "Tournament not found" });
    }

    if (tournament.created_by !== userHandle) {
      return res.status(403).json({ 
        error: "Unauthorized: Only the tournament creator can finish it"
      });
    }

    const rankings = await distributePrizes(tournamentId);

    res.json({
      success: true,
      message: "Tournament completed, prizes distributed",
      rankings: rankings.map(r => ({
        rank: r.rank,
        prize: r.prize
      }))
    });

  } catch (error: any) {
    console.error("❌ [Tournament API] Error finishing tournament:", error);
    res.status(400).json({
      error: "Failed to finish tournament",
      details: error.message
    });
  }
});

/**
 * GET /api/tournaments/active
 * Get all active tournaments
 */
router.get("/active", async (req, res) => {
  try {
    const tournaments = await getActiveTournaments();

    res.json({
      success: true,
      count: tournaments.length,
      tournaments: tournaments.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        tournamentType: t.tournament_type,
        combatType: t.combat_type,
        status: t.status,
        entryFee: t.entry_fee,
        minPowerRequired: t.min_power_required,
        maxParticipants: t.max_participants,
        registeredCount: t.registered_count,
        totalPrizePool: t.total_prize_pool,
        firstPlacePrize: t.first_place_prize,
        secondPlacePrize: t.second_place_prize,
        thirdPlacePrize: t.third_place_prize,
        registrationOpens: t.registration_opens,
        registrationCloses: t.registration_closes,
        startsAt: t.starts_at,
        currentRound: t.current_round,
        totalRounds: t.total_rounds
      }))
    });

  } catch (error: any) {
    console.error("❌ [Tournament API] Error fetching tournaments:", error);
    res.status(500).json({
      error: "Failed to fetch tournaments",
      details: error.message
    });
  }
});

/**
 * GET /api/tournaments/:tournamentId/participants
 * Get tournament participants
 */
router.get("/:tournamentId/participants", async (req, res) => {
  try {
    const { tournamentId } = req.params;

    const participants = await getTournamentParticipants(tournamentId);

    res.json({
      success: true,
      count: participants.length,
      participants: participants.map(p => ({
        id: p.id,
        playerHandle: p.player_handle,
        playerName: p.player_name,
        totalPower: Number(p.total_power || 0),
        squadronName: p.squadron_name,
        currentRound: p.current_round,
        isEliminated: p.is_eliminated,
        finalRank: p.final_rank,
        battlesWon: p.battles_won,
        battlesLost: p.battles_lost,
        prizeWon: p.prize_won,
        registeredAt: p.registered_at
      }))
    });

  } catch (error: any) {
    console.error("❌ [Tournament API] Error fetching participants:", error);
    res.status(500).json({
      error: "Failed to fetch participants",
      details: error.message
    });
  }
});

export default router;
