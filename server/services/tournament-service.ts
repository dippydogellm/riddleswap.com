import { db } from "../db";
import { tournaments, tournamentParticipants, squadrons, gamingPlayers, battles } from "@shared/schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { distributeTournamentPrizes } from "./battle-wagering-service";

/**
 * Tournament Service
 * 
 * Manages tournament creation, registration, bracket generation, and prize distribution
 */

export interface CreateTournamentOptions {
  name: string;
  description: string;
  tournamentType: "weekly_admin" | "player_created" | "special_event";
  combatType: "military" | "social" | "religious" | "mixed";
  entryFee: string;
  minPowerRequired: number;
  maxParticipants: number;
  totalPrizePool: string;
  registrationOpens: Date;
  registrationCloses: Date;
  startsAt: Date;
  createdBy: string;
  isAdminTournament: boolean;
}

/**
 * Create a new tournament
 */
export async function createTournament(options: CreateTournamentOptions) {
  try {
    console.log(`🏆 [Tournament] Creating tournament: ${options.name}`);

    // Calculate prize distribution (50% 1st, 30% 2nd, 20% 3rd)
    const totalPool = parseFloat(options.totalPrizePool);
    const firstPlacePrize = (totalPool * 0.5).toString();
    const secondPlacePrize = (totalPool * 0.3).toString();
    const thirdPlacePrize = (totalPool * 0.2).toString();

    // Calculate total rounds based on max participants
    const totalRounds = Math.ceil(Math.log2(options.maxParticipants));

    const [tournament] = await db.insert(tournaments).values({
      name: options.name,
      description: options.description,
      tournament_type: options.tournamentType,
      combat_type: options.combatType,
      entry_fee: options.entryFee,
      min_power_required: options.minPowerRequired,
      max_participants: options.maxParticipants,
      total_prize_pool: options.totalPrizePool,
      first_place_prize: firstPlacePrize,
      second_place_prize: secondPlacePrize,
      third_place_prize: thirdPlacePrize,
      registration_opens: options.registrationOpens,
      registration_closes: options.registrationCloses,
      starts_at: options.startsAt,
      created_by: options.createdBy,
      is_admin_tournament: options.isAdminTournament,
      status: "upcoming",
      total_rounds: totalRounds,
      registered_count: 0
    } as any).returning();

    console.log(`✅ [Tournament] Tournament created: ${tournament.id}`);
    return tournament;

  } catch (error) {
    console.error("❌ [Tournament] Error creating tournament:", error);
    throw error;
  }
}

/**
 * Register a player for a tournament
 */
export async function registerForTournament(tournamentId: string, playerHandle: string, squadronId: string) {
  try {
    console.log(`📝 [Tournament] Registering ${playerHandle} for tournament ${tournamentId}`);

    // Get tournament details
    const tournament = await db.query.tournaments.findFirst({
      where: eq(tournaments.id, tournamentId)
    });

    if (!tournament) {
      throw new Error("Tournament not found");
    }

    // Validate tournament status
    if (tournament.status !== "registration_open" && tournament.status !== "upcoming") {
      throw new Error("Tournament registration is closed");
    }

    // Check if registration is still open
    const now = new Date();
    if (now < new Date(tournament.registration_opens)) {
      throw new Error("Tournament registration has not opened yet");
    }
    if (now > new Date(tournament.registration_closes)) {
      throw new Error("Tournament registration has closed");
    }

    // Check if tournament is full (CRITICAL: Enforce capacity limit)
    const currentCount = tournament.registered_count || 0;
    if (currentCount >= tournament.max_participants) {
      throw new Error(`Tournament is full (${currentCount}/${tournament.max_participants} participants)`);
    }

    // Get player
    const player = await db.query.gamingPlayers.findFirst({
      where: eq(gamingPlayers.user_handle, playerHandle)
    });

    if (!player) {
      throw new Error("Player not found");
    }

    // Validate power requirement
    const playerPower = Number(player.total_power_level || 0);
    if (playerPower < tournament.min_power_required) {
      throw new Error(`Insufficient power. Required: ${tournament.min_power_required}, Current: ${playerPower}`);
    }

    // Check if player already registered
    const existing = await db.query.tournamentParticipants.findFirst({
      where: and(
        eq(tournamentParticipants.tournament_id, tournamentId),
        eq(tournamentParticipants.player_id, player.id)
      )
    });

    if (existing) {
      throw new Error("Player already registered for this tournament");
    }

    // Register participant
    const [participant] = await db.insert(tournamentParticipants).values({
      tournament_id: tournamentId,
      player_id: player.id,
      squadron_id: squadronId,
      entry_fee_paid: true, // For now, auto-approve
      current_round: 0,
      is_eliminated: false
    } as any).returning();

    // Update tournament registered count with capacity check (prevent race conditions)
    const updateResult = await db.update(tournaments)
      // Cast update object due to computed column expressions not matching inferred update type
      .set({ 
        registered_count: sql`${tournaments.registered_count} + 1`,
        status: "registration_open" // Ensure status is updated
      } as any)
      .where(and(
        eq(tournaments.id, tournamentId),
        sql`${tournaments.registered_count} < ${tournaments.max_participants}` // Double-check capacity
      ))
      .returning();

    if (updateResult.length === 0) {
      // Capacity was reached between our check and update (race condition)
      throw new Error("Tournament became full while processing your registration. Please try another tournament.");
    }

    console.log(`✅ [Tournament] Player registered: ${playerHandle}`);
    return participant;

  } catch (error) {
    console.error("❌ [Tournament] Error registering player:", error);
    throw error;
  }
}

/**
 * Generate tournament brackets
 */
export async function generateBrackets(tournamentId: string) {
  try {
    console.log(`🎲 [Tournament] Generating brackets for tournament ${tournamentId}`);

    // Get all participants
    const participants = await db
      .select({
        id: tournamentParticipants.id,
        player_id: tournamentParticipants.player_id,
        squadron_id: tournamentParticipants.squadron_id,
        player_handle: gamingPlayers.user_handle,
        total_power: gamingPlayers.total_power_level
      })
      .from(tournamentParticipants)
      .innerJoin(gamingPlayers, eq(gamingPlayers.id, tournamentParticipants.player_id))
      .where(and(
        eq(tournamentParticipants.tournament_id, tournamentId),
        eq(tournamentParticipants.is_eliminated, false)
      ))
      .orderBy(desc(gamingPlayers.total_power_level)); // Seed by power

    if (participants.length < 2) {
      throw new Error("Not enough participants to generate brackets (minimum 2)");
    }

    // Pair participants for first round matches
    const matches = [];
    for (let i = 0; i < participants.length; i += 2) {
      if (i + 1 < participants.length) {
        matches.push({
          player1: participants[i],
          player2: participants[i + 1]
        });
      } else {
        // Odd number - give bye to last player
        console.log(`👤 [Tournament] Player ${participants[i].player_handle} gets a bye`);
      }
    }

    // Update tournament status
    await db.update(tournaments)
      .set({  
        status: "in_progress",
        current_round: 1
       } as any)
      .where(eq(tournaments.id, tournamentId));

    console.log(`✅ [Tournament] Generated ${matches.length} matches for round 1`);
    return { matches, totalParticipants: participants.length };

  } catch (error) {
    console.error("❌ [Tournament] Error generating brackets:", error);
    throw error;
  }
}

/**
 * Advance winner to next round
 */
export async function advanceWinner(tournamentId: string, winnerId: string, loserId: string) {
  try {
    console.log(`🏅 [Tournament] Advancing winner ${winnerId} in tournament ${tournamentId}`);

    // Mark loser as eliminated
    await db.update(tournamentParticipants)
      .set({  
        is_eliminated: true,
        eliminated_at: new Date()
       } as any)
      .where(eq(tournamentParticipants.id, loserId));

    // Increment winner's round
    await db.update(tournamentParticipants)
      .set({ 
        current_round: sql`${tournamentParticipants.current_round} + 1`,
        battles_won: sql`${tournamentParticipants.battles_won} + 1`
      } as any)
      .where(eq(tournamentParticipants.id, winnerId));

    console.log(`✅ [Tournament] Winner advanced`);

  } catch (error) {
    console.error("❌ [Tournament] Error advancing winner:", error);
    throw error;
  }
}

/**
 * Distribute prizes to tournament winners
 */
export async function distributePrizes(tournamentId: string) {
  try {
    console.log(`💰 [Tournament] Distributing prizes for tournament ${tournamentId}`);

    const tournament = await db.query.tournaments.findFirst({
      where: eq(tournaments.id, tournamentId)
    });

    if (!tournament) {
      throw new Error("Tournament not found");
    }

    // Get final standings (by elimination order - last eliminated = highest rank)
    const participants = await db
      .select()
      .from(tournamentParticipants)
      .where(eq(tournamentParticipants.tournament_id, tournamentId))
      .orderBy(desc(tournamentParticipants.eliminated_at));

    if (participants.length === 0) {
      throw new Error("No participants found");
    }

    // Assign ranks and prizes
    const rankings = participants.map((p, index) => ({
      participantId: p.id,
      rank: index + 1,
      prize: index === 0 ? tournament.first_place_prize : 
             index === 1 ? tournament.second_place_prize :
             index === 2 ? tournament.third_place_prize : "0"
    }));

    // Update participants with final ranks and prizes
    for (const ranking of rankings) {
      await db.update(tournamentParticipants)
        .set({  
          final_rank: ranking.rank,
          prize_won: ranking.prize
         } as any)
        .where(eq(tournamentParticipants.id, ranking.participantId));

      console.log(`🏆 [Tournament] Rank ${ranking.rank}: ${ranking.participantId} - Prize: ${ranking.prize} XRP`);
    }

    // Mark tournament as completed
    await db.update(tournaments)
      .set({  
        status: "completed",
        ends_at: new Date()
       } as any)
      .where(eq(tournaments.id, tournamentId));

    // AUTOMATIC PAYOUT: Send XRP to winners using broker wallet
    console.log(`💸 [Tournament] Initiating automatic payouts...`);
    const payoutResult = await distributeTournamentPrizes(tournamentId);
    
    if (payoutResult.success) {
      console.log(`✅ [Tournament] Automatic payouts completed: ${payoutResult.transactions.length} transactions`);
    } else {
      console.error(`❌ [Tournament] Payout failed: ${payoutResult.error}`);
    }

    console.log(`✅ [Tournament] Prizes distributed`);
    return rankings;

  } catch (error) {
    console.error("❌ [Tournament] Error distributing prizes:", error);
    throw error;
  }
}

/**
 * Get active tournaments
 */
export async function getActiveTournaments() {
  try {
    const activeTournaments = await db.query.tournaments.findMany({
      where: sql`${tournaments.status} IN ('upcoming', 'registration_open', 'in_progress')`,
      orderBy: [desc(tournaments.starts_at)]
    });

    return activeTournaments;

  } catch (error) {
    console.error("❌ [Tournament] Error fetching active tournaments:", error);
    throw error;
  }
}

/**
 * Get tournament participants with details
 */
export async function getTournamentParticipants(tournamentId: string) {
  try {
    const participants = await db
      .select({
        id: tournamentParticipants.id,
        player_handle: gamingPlayers.user_handle,
        player_name: gamingPlayers.player_name,
        total_power: gamingPlayers.total_power_level,
  squadron_name: squadrons.name,
        current_round: tournamentParticipants.current_round,
        is_eliminated: tournamentParticipants.is_eliminated,
        final_rank: tournamentParticipants.final_rank,
        battles_won: tournamentParticipants.battles_won,
        battles_lost: tournamentParticipants.battles_lost,
        prize_won: tournamentParticipants.prize_won,
        registered_at: tournamentParticipants.registered_at
      })
      .from(tournamentParticipants)
      .innerJoin(gamingPlayers, eq(gamingPlayers.id, tournamentParticipants.player_id))
      .innerJoin(squadrons, eq(squadrons.id, tournamentParticipants.squadron_id))
      .where(eq(tournamentParticipants.tournament_id, tournamentId))
      .orderBy(desc(gamingPlayers.total_power_level));

    return participants;

  } catch (error) {
    console.error("❌ [Tournament] Error fetching participants:", error);
    throw error;
  }
}
