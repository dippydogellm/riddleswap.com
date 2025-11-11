import { Router } from "express";
import { db } from "./db";
import { 
  squadrons, squadronNfts, battles, battleMoves,
  nftPowerAttributes, gamingPlayers, gamingNfts, battlePartners, playerNftOwnership
} from "@shared/schema";
import { eq, and, or, desc, sql, isNull, inArray } from "drizzle-orm";
import { scanPlayerNftPower, getPowerIcons } from "./nft-power-scanner";
import { requireAuthentication, AuthenticatedRequest } from "./middleware/session-auth";
import OpenAI from "openai";
import crypto from "crypto";
import { simulateAIMove, simulatePlayerMove, determineBattleWinner } from "./ai-battle-simulator";
import { scanAllCollections, scanPlayerNFTs } from "./comprehensive-nft-scanner";
import { notificationService } from "./notification-service";
import { updateSquadronBattleStats } from "./services/nft-battle-stats-service";

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ==========================================
// BATTLE POWER BONUS CALCULATIONS
// ==========================================

/**
 * Calculate specialization and civilization bonuses for battles
 * Returns power bonuses based on character class, battle type, and civilization stats
 */
function calculateBattlePowerBonus(
  nft: any,
  battleSpec: string | null, // army, religion, civilization, economic
  combatType: string // military, social, religious
): {
  armyBonus: number;
  religionBonus: number;
  civilizationBonus: number;
  economicBonus: number;
} {
  let armyBonus = 0;
  let religionBonus = 0;
  let civilizationBonus = 0;
  let economicBonus = 0;

  const baseArmyPower = nft.army_power || 0;
  const baseReligionPower = nft.religion_power || 0;
  const baseCivilizationPower = nft.civilization_power || 0;
  const baseEconomicPower = nft.economic_power || 0;
  
  const characterClass = nft.character_class;
  const battleSpecialization = nft.battle_specialization;

  // 1. Character class specialization bonus (20% boost if class matches battle type)
  if (battleSpec && battleSpecialization === battleSpec) {
    switch (battleSpec) {
      case 'army':
        armyBonus += Math.round(baseArmyPower * 0.20);
        break;
      case 'religion':
        religionBonus += Math.round(baseReligionPower * 0.20);
        break;
      case 'civilization':
        civilizationBonus += Math.round(baseCivilizationPower * 0.20);
        break;
      case 'economic':
        economicBonus += Math.round(baseEconomicPower * 0.20);
        break;
    }
  }

  // 2. Civilization power bonus in religion battles
  // High civilization characters (scholars, wizards) get bonus in religion battles
  if (combatType === 'religious' || battleSpec === 'religion') {
    // Add 15% of civilization power to religion power
    const civilizationAsReligionBonus = Math.round(baseCivilizationPower * 0.15);
    religionBonus += civilizationAsReligionBonus;
  }

  // 3. Combat type matching (10% general bonus)
  if (combatType === 'military' && (characterClass === 'warrior' || characterClass === 'knight')) {
    armyBonus += Math.round(baseArmyPower * 0.10);
  } else if (combatType === 'religious' && (characterClass === 'priest' || characterClass === 'monk')) {
    religionBonus += Math.round(baseReligionPower * 0.10);
  } else if (combatType === 'social' && (characterClass === 'scholar' || characterClass === 'merchant')) {
    civilizationBonus += Math.round(baseCivilizationPower * 0.10);
  }

  return {
    armyBonus,
    religionBonus,
    civilizationBonus,
    economicBonus
  };
}

// ==========================================
// ANTI-CHEAT: SERVER-SIDE HASH COMPUTATION
// ==========================================

/**
 * Compute deterministic squadron hash from canonical database state
 * This prevents client-side tampering by computing hash server-side
 */
async function computeSquadronHash(squadronId: string): Promise<string> {
  // Fetch squadron with all NFT assignments from database
  const squadron = await db.query.squadrons.findFirst({
    where: eq(squadrons.id, squadronId),
    with: {
      nfts: {
        orderBy: (squadronNftsTable: any, { asc }: any) => [asc(squadronNftsTable.position)]
      }
    }
  });
  
  if (!squadron) {
    throw new Error("Squadron not found");
  }
  
  // Create deterministic hash from squadron state
  const squadronState = {
    id: squadron.id,
    player_id: squadron.player_id,
    total_army_power: squadron.total_army_power,
    total_religion_power: squadron.total_religion_power,
    total_civilization_power: squadron.total_civilization_power,
    total_economic_power: squadron.total_economic_power,
    total_power: squadron.total_power,
    nft_count: squadron.nft_count,
    nfts: squadron.nfts?.map((nft: any) => ({
      nft_id: nft.nft_id,
      role: nft.role,
      army: nft.army_contribution,
      religion: nft.religion_contribution,
      civilization: nft.civilization_contribution,
      economic: nft.economic_contribution
    })) || []
  };
  
  // Create deterministic hash
  const stateString = JSON.stringify(squadronState);
  const hash = crypto.createHash('sha256').update(stateString).digest('hex');
  
  return hash;
}

/**
 * Verify squadron hash against stored value
 * Returns true if hash matches, false otherwise
 */
async function verifySquadronHash(squadronId: string, storedHash: string): Promise<boolean> {
  const computedHash = await computeSquadronHash(squadronId);
  return computedHash === storedHash;
}

/**
 * Unlock squadrons when battle ends
 * This allows players to modify their squadrons again
 */
async function unlockSquadrons(battleId: string): Promise<void> {
  const battle = await db.query.battles.findFirst({
    where: eq(battles.id, battleId)
  });
  
  if (!battle) return;
  
  // Unlock creator squadron
  if (battle.creator_squadron_id) {
    await db.update(squadrons)
      .set({  in_battle: false, current_battle_id: null  } as any)
      .where(eq(squadrons.id, battle.creator_squadron_id));
  }
  
  // Unlock opponent squadron
  if (battle.opponent_squadron_id) {
    await db.update(squadrons)
      .set({  in_battle: false, current_battle_id: null  } as any)
      .where(eq(squadrons.id, battle.opponent_squadron_id));
  }
}

// ==========================================
// SQUADRON MANAGEMENT ROUTES
// ==========================================

// Get all squadrons for a player
router.get("/api/squadrons/:userHandle", requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const { userHandle } = req.params;
    const authenticatedHandle = req.user?.handle || req.user?.userHandle;
    
    // Verify user can only access their own squadrons
    if (userHandle !== authenticatedHandle) {
      return res.status(403).json({ error: "Unauthorized: Cannot access other players' squadrons" });
    }
    
    // Look up gaming player
    const gamingPlayer = await db.query.gamingPlayers.findFirst({
      where: eq(gamingPlayers.user_handle, userHandle)
    });
    
    if (!gamingPlayer) {
      // No player record = no squadrons
      return res.json({ success: true, data: [] });
    }
    
    const playerSquadrons = await db.query.squadrons.findMany({
      where: eq(squadrons.player_id, gamingPlayer.id)
    });
    
    res.json({ success: true, data: playerSquadrons });
  } catch (error) {
    console.error("Error fetching squadrons:", error);
    res.status(500).json({ error: "Failed to fetch squadrons" });
  }
});

// Create a new squadron
router.post("/api/squadrons/create", requireAuthentication, async (req: AuthenticatedRequest, res) => {
  console.log("🎯 [SQUADRON CREATE] Route called with body:", req.body);
  
  try {
    const { name, description, squadron_type } = req.body;
    const authenticatedHandle = req.user?.handle || req.user?.userHandle;
    
    console.log("📋 [SQUADRON CREATE] Creating squadron:", { 
      name, 
      description, 
      squadron_type, 
      handle: authenticatedHandle 
    });
    
    if (!authenticatedHandle) {
      console.log("❌ [SQUADRON CREATE] No authentication found");
      return res.status(401).json({ error: "Authentication required" });
    }
    
    // Look up or create gaming_players record
    console.log("🔍 [SQUADRON CREATE] Looking up gaming player for:", authenticatedHandle);
    let gamingPlayer = await db.query.gamingPlayers.findFirst({
      where: eq(gamingPlayers.user_handle, authenticatedHandle)
    });
    
    if (!gamingPlayer) {
      console.log("👤 [SQUADRON CREATE] Creating new gaming player for:", authenticatedHandle);
      const walletAddress = req.user?.walletAddress || "unknown";
      const [newPlayer] = await db.insert(gamingPlayers).values({
        user_handle: authenticatedHandle,
        wallet_address: walletAddress,
        chain: "xrpl",
        player_name: authenticatedHandle
      } as any).returning();
      gamingPlayer = newPlayer;
      console.log("✅ [SQUADRON CREATE] Created gaming player:", gamingPlayer.id);
    } else {
      console.log("✅ [SQUADRON CREATE] Found existing player:", gamingPlayer.id);
    }
    
    // Insert squadron into database
    console.log("💾 [SQUADRON CREATE] Inserting squadron into database...");
    const newSquadron = await db.insert(squadrons).values({
      player_id: gamingPlayer.id, // Use UUID, not handle
      name,
      description,
      squadron_type
    } as any).returning();
    
    console.log("✅ [SQUADRON CREATE] Squadron created successfully:", {
      squadronId: newSquadron[0]?.id,
      name: newSquadron[0]?.name,
      playerId: newSquadron[0]?.player_id
    });
    
    res.json({ success: true, squadron: newSquadron[0] });
  } catch (error: any) {
    console.error("❌ [SQUADRON CREATE] Error creating squadron:", {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    res.status(500).json({ error: "Failed to create squadron", details: error.message });
  }
});

// Add NFT to squadron
router.post("/api/squadrons/:squadronId/add-nft", requireAuthentication, async (req: AuthenticatedRequest, res) => {
  console.log("🎯 [ADD NFT] Route called with params/body:", { 
    squadronId: req.params.squadronId, 
    body: req.body 
  });
  
  try {
    const { squadronId } = req.params;
    const { nft_id, role } = req.body;
    const authenticatedHandle = req.user?.handle || req.user?.userHandle;
    
    console.log("📋 [ADD NFT] Adding NFT to squadron:", {
      squadronId,
      nft_id,
      role,
      handle: authenticatedHandle
    });
    
    if (!authenticatedHandle) {
      console.log("❌ [ADD NFT] No authentication found");
      return res.status(401).json({ error: "Authentication required" });
    }
    
    // Look up gaming player
    console.log("🔍 [ADD NFT] Looking up gaming player for:", authenticatedHandle);
    const gamingPlayer = await db.query.gamingPlayers.findFirst({
      where: eq(gamingPlayers.user_handle, authenticatedHandle)
    });
    
    if (!gamingPlayer) {
      console.log("❌ [ADD NFT] Player profile not found for:", authenticatedHandle);
      return res.status(404).json({ error: "Player profile not found" });
    }
    console.log("✅ [ADD NFT] Found player:", gamingPlayer.id);
    
    // Verify squadron ownership before mutation
    console.log("🔍 [ADD NFT] Looking up squadron:", squadronId);
    const squad = await db.query.squadrons.findFirst({
      where: eq(squadrons.id, squadronId)
    });
    
    if (!squad) {
      console.log("❌ [ADD NFT] Squadron not found:", squadronId);
      return res.status(404).json({ error: "Squadron not found" });
    }
    console.log("✅ [ADD NFT] Found squadron:", {
      squadronId: squad.id,
      name: squad.name,
      playerId: squad.player_id,
      currentNfts: squad.nft_count
    });
    
    if (squad.player_id !== gamingPlayer.id) {
      console.log("❌ [ADD NFT] Unauthorized - Squadron owner mismatch:", {
        squadronOwner: squad.player_id,
        requestingPlayer: gamingPlayer.id
      });
      return res.status(403).json({ error: "Unauthorized: Cannot modify other players' squadrons" });
    }
    console.log("✅ [ADD NFT] Squadron ownership verified");
    
    // ANTI-CHEAT: Prevent modifications while squadron is in battle
    if (squad.in_battle) {
      console.log("❌ [ADD NFT] Squadron is in battle");
      return res.status(400).json({ 
        error: "Cannot modify squadron while it is in an active battle" 
      });
    }
    console.log("✅ [ADD NFT] Squadron not in battle");
    
    // Check squadron capacity limit
    const maxCapacity = squad.max_nft_capacity || 10;
    const currentCount = squad.nft_count || 0;
    if (currentCount >= maxCapacity) {
      return res.status(400).json({ 
        error: `Squadron is at maximum capacity (${maxCapacity} NFTs). Remove an NFT first.` 
      });
    }
    
    // Look up NFT by token_id first (frontend sends token_id, not database UUID)
    console.log("🔍 [ADD NFT] Looking up NFT by token_id:", nft_id);
    const nft = await db.query.gamingNfts.findFirst({
      where: eq(gamingNfts.token_id, nft_id)
    });
    
    if (!nft) {
      console.log("❌ [ADD NFT] NFT not found in database:", nft_id);
      return res.status(404).json({ error: "NFT not found in database. Please sync your NFTs first." });
    }
    console.log("✅ [ADD NFT] Found NFT:", {
      id: nft.id,
      token_id: nft.token_id,
      name: nft.name
    });
    
    // Get NFT power attributes using the database UUID
    console.log("🔍 [ADD NFT] Looking up NFT power attributes for UUID:", nft.id);
    const nftPower = await db.query.nftPowerAttributes.findFirst({
      where: eq(nftPowerAttributes.nft_id, nft.id)
    });
    
    if (!nftPower) {
      console.log("❌ [ADD NFT] NFT power attributes not found for UUID:", nft.id);
      return res.status(404).json({ error: "NFT power attributes not found. Please rescan this NFT to calculate power levels." });
    }
    console.log("✅ [ADD NFT] Found power attributes:", {
      army_power: nftPower.army_power,
      religion_power: nftPower.religion_power,
      civilization_power: nftPower.civilization_power,
      economic_power: nftPower.economic_power,
      total_power: nftPower.total_power
    });
    
    // Add to squadron (use database UUID, not token_id)
    // Convert decimal strings to integers
    console.log("💾 [ADD NFT] Inserting NFT assignment to squadron_nfts table...");
    const assignment = await db.insert(squadronNfts).values({
      squadron_id: squadronId,
      nft_id: nft.id, // Use database UUID instead of token_id
      role,
      army_contribution: Math.round(parseFloat(nftPower.army_power?.toString() || "0")),
      religion_contribution: Math.round(parseFloat(nftPower.religion_power?.toString() || "0")),
      civilization_contribution: Math.round(parseFloat(nftPower.civilization_power?.toString() || "0")),
      economic_contribution: Math.round(parseFloat(nftPower.economic_power?.toString() || "0"))
    } as any).returning();
    
    console.log("✅ [ADD NFT] Assignment created:", {
      assignmentId: assignment[0]?.id,
      squadronId: assignment[0]?.squadron_id,
      nftId: assignment[0]?.nft_id
    });
    
    // Update squadron totals
    console.log("💾 [ADD NFT] Updating squadron power totals...");
    const updateResult = await db.update(squadrons)
      .set({ 
        total_army_power: (Number(squad.total_army_power || 0) + Number(nftPower.army_power || 0)).toString(),
        total_religion_power: (Number(squad.total_religion_power || 0) + Number(nftPower.religion_power || 0)).toString(),
        total_civilization_power: (Number(squad.total_civilization_power || 0) + Number(nftPower.civilization_power || 0)).toString(),
        total_economic_power: (Number(squad.total_economic_power || 0) + Number(nftPower.economic_power || 0)).toString(),
        total_power: (Number(squad.total_power || 0) + Number(nftPower.total_power || 0)).toString(),
        nft_count: (squad.nft_count || 0) + 1
       } as any)
      .where(eq(squadrons.id, squadronId));
    
    console.log("✅ [ADD NFT] Squadron power totals updated");
    console.log("🎉 [ADD NFT] NFT successfully added to squadron");
    
    res.json({ success: true, assignment: assignment[0] });
  } catch (error: any) {
    console.error("Error adding NFT to squadron:", error);
    if (error?.code === '23505') {
      res.status(400).json({ error: "NFT is already in this squadron" });
    } else {
      res.status(500).json({ error: "Failed to add NFT to squadron" });
    }
  }
});

// Get squadron details with NFTs
router.get("/api/squadrons/:squadronId/details", requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const { squadronId } = req.params;
    const authenticatedHandle = req.user?.handle || req.user?.userHandle;
    
    if (!authenticatedHandle) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    // Get player ID from handle
    const player = await db.query.gamingPlayers.findFirst({
      where: eq(gamingPlayers.user_handle, authenticatedHandle)
    });
    
    if (!player) {
      return res.status(404).json({ error: "Player profile not found" });
    }
    
    const squadron = await db.query.squadrons.findFirst({
      where: eq(squadrons.id, squadronId)
    });
    
    if (!squadron) {
      return res.status(404).json({ error: "Squadron not found" });
    }
    
    // Verify squadron ownership - compare UUIDs not handle
    if (squadron.player_id !== player.id) {
      return res.status(403).json({ error: "Unauthorized: Cannot access other players' squadron details" });
    }
    
    const nfts = await db.select()
      .from(squadronNfts)
      .leftJoin(gamingNfts, eq(squadronNfts.nft_id, gamingNfts.id))
      .leftJoin(nftPowerAttributes, eq(squadronNfts.nft_id, nftPowerAttributes.nft_id))
      .where(eq(squadronNfts.squadron_id, squadronId));
    
    res.json({ success: true, squadron, nfts });
  } catch (error) {
    console.error("Error fetching squadron details:", error);
    res.status(500).json({ error: "Failed to fetch squadron details" });
  }
});

// Delete squadron
router.delete("/api/squadrons/:squadronId", requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const { squadronId } = req.params;
    const authenticatedHandle = req.user?.handle || req.user?.userHandle;
    
    if (!authenticatedHandle) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    console.log("🗑️ [DELETE SQUADRON] Route called:", { squadronId, handle: authenticatedHandle });
    
    // Get player ID
    const player = await db.query.gamingPlayers.findFirst({
      where: eq(gamingPlayers.user_handle, authenticatedHandle)
    });
    
    if (!player) {
      console.log("❌ [DELETE SQUADRON] Player not found");
      return res.status(404).json({ error: "Player not found" });
    }
    
    // Get squadron
    const squadron = await db.query.squadrons.findFirst({
      where: eq(squadrons.id, squadronId)
    });
    
    if (!squadron) {
      console.log("❌ [DELETE SQUADRON] Squadron not found");
      return res.status(404).json({ error: "Squadron not found" });
    }
    
    // Verify ownership
    if (squadron.player_id !== player.id) {
      console.log("❌ [DELETE SQUADRON] Not authorized - squadron belongs to different player");
      return res.status(403).json({ error: "Unauthorized: Cannot delete other players' squadrons" });
    }
    
    // Check if squadron is in battle
    if (squadron.in_battle) {
      console.log("❌ [DELETE SQUADRON] Cannot delete - squadron is in battle");
      return res.status(400).json({ error: "Cannot delete squadron while in battle" });
    }
    
    // Delete squadron (cascade will remove squadron_nfts)
    await db.delete(squadrons).where(eq(squadrons.id, squadronId));
    
    console.log("✅ [DELETE SQUADRON] Squadron deleted successfully");
    res.json({ success: true, message: "Squadron deleted successfully" });
  } catch (error) {
    console.error("Error deleting squadron:", error);
    res.status(500).json({ error: "Failed to delete squadron" });
  }
});

// Browse public squadrons (for joining)
router.get("/api/squadrons/browse", requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const authenticatedHandle = req.user?.handle || req.user?.userHandle;
    
    if (!authenticatedHandle) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    console.log("🔍 [BROWSE SQUADRONS] Fetching public squadrons");
    
    // Get all public squadrons that aren't full and not in battle
    const publicSquadrons = await db.query.squadrons.findMany({
      where: and(
        eq(squadrons.is_active, true),
        eq(squadrons.in_battle, false),
        sql`${squadrons.nft_count} < ${squadrons.max_nft_capacity}`
      ),
      with: {
        player: true
      },
      orderBy: (squadrons, { desc }) => [desc(squadrons.total_power)],
      limit: 50
    });
    
    console.log(`✅ [BROWSE SQUADRONS] Found ${publicSquadrons.length} available squadrons`);
    
    res.json({
      success: true,
      squadrons: publicSquadrons.map((sq: any) => ({
        id: sq.id,
        name: sq.name,
        description: sq.description,
        squadron_type: sq.squadron_type,
        owner_handle: sq.player?.user_handle || 'Unknown',
        owner_name: sq.player?.player_name || 'Unknown',
        nft_count: sq.nft_count,
        max_capacity: sq.max_nft_capacity,
        slots_available: (sq.max_nft_capacity || 10) - (sq.nft_count || 0),
        total_power: Number(sq.total_power || 0),
        total_army_power: Number(sq.total_army_power || 0),
        total_religion_power: Number(sq.total_religion_power || 0),
        total_civilization_power: Number(sq.total_civilization_power || 0),
        total_economic_power: Number(sq.total_economic_power || 0),
        battles_won: sq.battles_won || 0,
        battles_lost: sq.battles_lost || 0,
        created_at: sq.created_at
      }))
    });
  } catch (error) {
    console.error("Error browsing squadrons:", error);
    res.status(500).json({ error: "Failed to browse squadrons" });
  }
});

// Join another player's squadron
router.post("/api/squadrons/:squadronId/join", requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const { squadronId } = req.params;
    const { nft_id, role } = req.body;
    const authenticatedHandle = req.user?.handle || req.user?.userHandle;
    
    console.log("🤝 [JOIN SQUADRON] Request:", { squadronId, nft_id, role, handle: authenticatedHandle });
    
    if (!authenticatedHandle) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    // Look up gaming player
    const gamingPlayer = await db.query.gamingPlayers.findFirst({
      where: eq(gamingPlayers.user_handle, authenticatedHandle)
    });
    
    if (!gamingPlayer) {
      return res.status(404).json({ error: "Player profile not found" });
    }
    
    // Get squadron details
    const squad = await db.query.squadrons.findFirst({
      where: eq(squadrons.id, squadronId),
      with: {
        player: true
      }
    });
    
    if (!squad) {
      return res.status(404).json({ error: "Squadron not found" });
    }
    
    // Public/private flag not implemented (is_public removed from schema). All active squadrons are joinable.
    
    // Check if squadron is full
    const currentCount = squad.nft_count || 0;
    const maxCapacity = squad.max_nft_capacity || 10;
    if (currentCount >= maxCapacity) {
      return res.status(400).json({ error: "Squadron is full" });
    }
    
    // Check if squadron is in battle
    if (squad.in_battle) {
      return res.status(400).json({ error: "Cannot join squadron while it's in battle" });
    }
    
    // Verify NFT ownership
    const nft = await db.query.gamingNfts.findFirst({
      where: eq(gamingNfts.id, nft_id)
    });
    
    if (!nft) {
      return res.status(404).json({ error: "NFT not found" });
    }
    
    if (nft.owner_address !== gamingPlayer.wallet_address) {
      return res.status(403).json({ error: "You don't own this NFT" });
    }
    
    // Get NFT power attributes
    const nftPower = await db.query.nftPowerAttributes.findFirst({
      where: eq(nftPowerAttributes.nft_id, nft_id)
    });
    
    if (!nftPower) {
      return res.status(400).json({ error: "NFT power data not found. Please rescan your NFTs first." });
    }
    
    // Check if NFT is already in a squadron
    if (nftPower.assigned_to_squadron) {
      return res.status(400).json({ error: "NFT is already assigned to a squadron" });
    }
    
    // Add NFT to squadron with type conversion for DECIMAL → INTEGER
    const assignment = await db.insert(squadronNfts).values({
      squadron_id: squadronId,
      nft_id: nft_id,
      role: role || 'soldier',
      army_contribution: Math.round(parseFloat(String(nftPower.army_power || 0 as any))),
      religion_contribution: Math.round(parseFloat(String(nftPower.religion_power || 0))),
      civilization_contribution: Math.round(parseFloat(String(nftPower.civilization_power || 0))),
      economic_contribution: Math.round(parseFloat(String(nftPower.economic_power || 0)))
    } as any).returning();
    
    // Update nft_power_attributes
    await db.update(nftPowerAttributes)
      .set({ 
        assigned_to_squadron: squadronId,
        squadron_role: role || 'member'
       } as any)
      .where(eq(nftPowerAttributes.nft_id, nft_id));
    
    // Update squadron totals
    await db.update(squadrons)
      .set({ 
        total_army_power: (Number(squad.total_army_power || 0) + Number(nftPower.army_power || 0)).toString(),
        total_religion_power: (Number(squad.total_religion_power || 0) + Number(nftPower.religion_power || 0)).toString(),
        total_civilization_power: (Number(squad.total_civilization_power || 0) + Number(nftPower.civilization_power || 0)).toString(),
        total_economic_power: (Number(squad.total_economic_power || 0) + Number(nftPower.economic_power || 0)).toString(),
        total_power: (Number(squad.total_power || 0) + Number(nftPower.total_power || 0)).toString(),
        nft_count: (squad.nft_count || 0) + 1
       } as any)
      .where(eq(squadrons.id, squadronId));
    
    console.log(`✅ [JOIN SQUADRON] Player ${authenticatedHandle} joined squadron ${squad.name} with NFT ${nft_id}`);
    
    res.json({ 
      success: true, 
      message: `Successfully joined ${squad.name}!`,
      assignment: assignment[0],
      squadron: {
        id: squad.id,
        name: squad.name,
        owner: (squad as any).player?.user_handle || 'Unknown'
      }
    });
  } catch (error: any) {
    console.error("Error joining squadron:", error);
    if (error?.code === '23505') {
      res.status(400).json({ error: "NFT is already in this squadron" });
    } else {
      res.status(500).json({ error: "Failed to join squadron" });
    }
  }
});

// ==========================================
// BATTLE SYSTEM ROUTES
// ==========================================

// Browse open battles (matchmaking)
router.get("/api/battles/browse", requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const authenticatedHandle = req.user?.handle || req.user?.userHandle;
    
    if (!authenticatedHandle) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    console.log("🔍 [BROWSE BATTLES] Fetching open battles");
    
    // Get all open battles waiting for opponents
    const openBattles = await db.query.battles.findMany({
      where: and(
        eq(battles.status, 'open'),
        eq(battles.is_ai_battle, false),
        sql`${battles.opponent_player_id} IS NULL`
      ),
      with: {
        creatorPlayer: true,
        creatorSquadron: true
      },
      orderBy: (battles, { desc }) => [desc(battles.created_at)],
      limit: 50
    });
    
    console.log(`✅ [BROWSE BATTLES] Found ${openBattles.length} open battles`);
    
    res.json({
      success: true,
      battles: openBattles.map((battle: any) => ({
        id: battle.id,
        battle_type: battle.battle_type,
        combat_type: battle.combat_type,
        land_type: battle.land_type,
        wager_amount: Number(battle.wager_amount || 0),
        is_friendly: battle.is_friendly,
  // Relations for creatorPlayer not defined in schema typings; cast to any for now
  creator_handle: (battle as any).creatorPlayer?.handle || 'Unknown',
  creator_name: (battle as any).creatorPlayer?.player_name || 'Unknown',
        squadron_name: battle.creatorSquadron?.name || 'Unknown',
        squadron_power: Number(battle.creatorSquadron?.total_power || 0),
        squadron_nfts: battle.creatorSquadron?.nft_count || 0,
        required_specialization: battle.required_specialization,
        time_limit_minutes: battle.time_limit_minutes,
        response_timeout_minutes: battle.response_timeout_minutes || 60,
        custom_prompt: battle.custom_prompt,
        created_at: battle.created_at
      }))
    });
  } catch (error) {
    console.error("Error browsing battles:", error);
    res.status(500).json({ error: "Failed to browse battles" });
  }
});

// Join an open battle
router.post("/api/battles/:battleId/join", requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const { battleId } = req.params;
    const { squadron_id } = req.body;
    const authenticatedHandle = req.user?.handle || req.user?.userHandle;
    
    console.log("⚔️ [JOIN BATTLE] Request:", { battleId, squadron_id, handle: authenticatedHandle });
    
    if (!authenticatedHandle) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    // Get player
    const player = await db.query.gamingPlayers.findFirst({
      where: eq(gamingPlayers.user_handle, authenticatedHandle)
    });
    
    if (!player) {
      return res.status(404).json({ error: "Player profile not found" });
    }
    
    // Get battle details
    const battle = await db.query.battles.findFirst({
      where: eq(battles.id, battleId),
      with: {
        creatorPlayer: true,
        creatorSquadron: true
      }
    });
    
    if (!battle) {
      return res.status(404).json({ error: "Battle not found" });
    }
    
    // Check if battle is open
    if (battle.status !== 'open') {
      return res.status(400).json({ error: "This battle is no longer open" });
    }
    
    // Check if battle already has an opponent
    if (battle.opponent_player_id) {
      return res.status(400).json({ error: "This battle already has an opponent" });
    }
    
    // Can't join your own battle
    if (battle.creator_player_id === player.id) {
      return res.status(400).json({ error: "You cannot join your own battle" });
    }
    
    // Verify squadron ownership
    const squadron = await db.query.squadrons.findFirst({
      where: eq(squadrons.id, squadron_id)
    });
    
    if (!squadron) {
      return res.status(404).json({ error: "Squadron not found" });
    }
    
    if (squadron.player_id !== player.id) {
      return res.status(403).json({ error: "You don't own this squadron" });
    }
    
    // Check squadron isn't in battle
    if (squadron.in_battle) {
      return res.status(400).json({ error: "Your squadron is already in another battle" });
    }
    
    // Validate squadron has NFTs
    const nftCount = squadron.nft_count || 0;
    if (nftCount === 0) {
      return res.status(400).json({ error: "Your squadron must have at least 1 NFT to enter battle" });
    }
    
    // For group battles, require minimum 2 NFTs
    if (battle.battle_type === "group" && nftCount < 2) {
      return res.status(400).json({ 
        error: "Group battles require at least 2 NFTs in your squadron" 
      });
    }
    
    // Generate anti-cheat hash for opponent
    const opponentHash = await computeSquadronHash(squadron_id);
    
    // Use transaction for atomic battle join
    const updatedBattle = await db.transaction(async (tx) => {
      // Double-check battle is still open (race condition protection)
      const freshBattle = await tx.query.battles.findFirst({
        where: eq(battles.id, battleId),
        with: {
          creatorPlayer: true
        }
      });
      
      if (!freshBattle || freshBattle.status !== 'open' || freshBattle.opponent_player_id) {
        throw new Error("Battle is no longer available");
      }
      
      if (!freshBattle.creator_squadron_id) {
        throw new Error("Battle has no creator squadron");
      }
      
      // Update battle with opponent
      const updateResult = await tx.update(battles)
        .set({ 
          opponent_player_id: player.id,
          opponent_squadron_id: squadron_id,
          opponent_hash: opponentHash,
          status: 'in_progress',
          started_at: new Date()
         } as any)
        .where(and(
          eq(battles.id, battleId),
          eq(battles.status, 'open'),
          sql`${battles.opponent_player_id} IS NULL`
        ))
        .returning();
      
      if (!updateResult || updateResult.length === 0) {
        throw new Error("Failed to join battle - already taken");
      }
      
      // Mark both squadrons as in battle using fresh values from transaction
      // Lock creator squadron
      const creatorSquadronUpdate = await tx.update(squadrons)
        .set({  
          in_battle: true,
          current_battle_id: battleId
         } as any)
        .where(and(
          eq(squadrons.id, freshBattle.creator_squadron_id),
          eq(squadrons.in_battle, false)
        ))
        .returning();
      
      if (!creatorSquadronUpdate.length) {
        throw new Error("Creator squadron is no longer available");
      }
      
      // Lock opponent squadron (prevent double-booking)
      const opponentSquadronUpdate = await tx.update(squadrons)
        .set({  
          in_battle: true,
          current_battle_id: battleId
         } as any)
        .where(and(
          eq(squadrons.id, squadron_id),
          eq(squadrons.in_battle, false)
        ))
        .returning();
      
      if (!opponentSquadronUpdate.length) {
        throw new Error("Your squadron is no longer available - it may have been added to another battle");
      }
      
      // Return fresh data from transaction
      return {
        battle: updateResult[0],
  creatorHandle: (freshBattle as any).creatorPlayer?.handle || 'Unknown'
      };
    });
    
    console.log(`✅ [JOIN BATTLE] Player ${authenticatedHandle} joined battle ${battleId}`);
    
    res.json({ 
      success: true, 
      message: `Battle started! Good luck!`,
      battle: {
        id: updatedBattle.battle.id,
        battle_type: updatedBattle.battle.battle_type,
        combat_type: updatedBattle.battle.combat_type,
        opponent: updatedBattle.creatorHandle
      }
    });
  } catch (error: any) {
    console.error("Error joining battle:", error);
    const msg = error.message || '';
    if (msg.includes("no longer available") || msg.includes("already taken") || msg.includes("another battle")) {
      res.status(409).json({ error: msg });
    } else {
      res.status(500).json({ error: "Failed to join battle" });
    }
  }
});

// ==========================================
// BATTLE PARTNERS / PROJECT ROUTES
// ==========================================

// Get all verified battle partners (projects that can host restricted battles)
router.get("/api/battle-partners", async (req, res) => {
  try {
    const partners = await db
      .select()
      .from(battlePartners)
      .where(and(
        eq(battlePartners.is_verified, true),
        eq(battlePartners.is_active, true)
      ))
      .orderBy(desc(battlePartners.total_battles_hosted));
    
    res.json({ success: true, data: partners });
  } catch (error) {
    console.error("❌ Error fetching battle partners:", error);
    res.status(500).json({ error: "Failed to fetch battle partners" });
  }
});

// Get battle partner details
router.get("/api/battle-partners/:partnerId", async (req, res) => {
  try {
    const { partnerId } = req.params;
    
    const partner = await db.query.battlePartners.findFirst({
      where: eq(battlePartners.id, partnerId)
    });
    
    if (!partner) {
      return res.status(404).json({ error: "Battle partner not found" });
    }
    
    res.json({ success: true, data: partner });
  } catch (error) {
    console.error("❌ Error fetching battle partner:", error);
    res.status(500).json({ error: "Failed to fetch battle partner" });
  }
});

// Verify if a player is eligible for a partner-restricted battle
router.get("/api/battles/:battleId/verify-eligibility", requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const { battleId } = req.params;
    const authenticatedHandle = req.user?.handle || req.user?.userHandle;
    
    if (!authenticatedHandle) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    // Get battle details
    const battle = await db.query.battles.findFirst({
      where: eq(battles.id, battleId)
    });
    
    if (!battle) {
      return res.status(404).json({ error: "Battle not found" });
    }
    
    // If battle is not restricted, everyone is eligible
    if (!battle.restricted_to_collection) {
      return res.json({ 
        success: true, 
        eligible: true,
        message: "Battle is open to all players"
      });
    }
    
    // Get player
    const player = await db.query.gamingPlayers.findFirst({
      where: eq(gamingPlayers.user_handle, authenticatedHandle)
    });
    
    if (!player) {
      return res.json({ 
        success: true, 
        eligible: false,
        message: "Player profile not found"
      });
    }
    
    // Check if player owns NFTs from the required collection
    const ownedNfts = await db
      .select()
      .from(gamingNfts)
      .where(and(
        eq(gamingNfts.owner_address, player.wallet_address || ''),
        eq(gamingNfts.collection_id, battle.restricted_to_collection)
      ));
    
    const requiredCount = battle.min_nfts_from_collection || 1;
    const eligible = ownedNfts.length >= requiredCount;
    
    res.json({ 
      success: true, 
      eligible,
      ownedNftsCount: ownedNfts.length,
      requiredCount,
      message: eligible 
        ? `You own ${ownedNfts.length} NFTs from the required collection` 
        : `You need at least ${requiredCount} NFTs from the required collection (you have ${ownedNfts.length})`
    });
  } catch (error) {
    console.error("❌ Error verifying battle eligibility:", error);
    res.status(500).json({ error: "Failed to verify eligibility" });
  }
});

// ==========================================
// BATTLE CREATION ROUTES
// ==========================================

// Create a new battle
router.post("/api/battles/create", requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const authenticatedHandle = req.user?.handle || req.user?.userHandle;
    
    if (!authenticatedHandle) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    const { 
      creator_squadron_id, 
      battle_type, 
      combat_type,
      land_type,
      response_timeout_minutes,
      wager_amount, 
      is_friendly,
      is_ai_battle,
      ai_difficulty,
      creator_wallet_address,
      custom_prompt,
      required_specialization, // Optional: army, religion, civilization, economic - NFTs with this specialization get bonuses
      time_limit_minutes, // Optional: Time limit for battle completion
      partner_project_id, // Optional: Restrict battle to NFT holders from specific project
      min_nfts_from_collection // Optional: Minimum NFTs required from partner collection (default: 1)
    } = req.body;
    
    // Validate partner project if specified
    let partnerCollectionId = null;
    if (partner_project_id) {
      const partner = await db.query.battlePartners.findFirst({
        where: eq(battlePartners.id, partner_project_id)
      });
      
      if (!partner) {
        return res.status(404).json({ error: "Partner project not found" });
      }
      
      if (!partner.is_verified || !partner.is_active) {
        return res.status(400).json({ error: "Partner project is not active" });
      }
      
      partnerCollectionId = partner.collection_id;
    }
    
    // Resolve authenticated handle to gaming player record (use player.id for DB relations)
    let player = await db.query.gamingPlayers.findFirst({
      where: eq(gamingPlayers.user_handle, authenticatedHandle),
    });

    if (!player) {
      // Auto-create gaming player record if missing
      console.log("👤 [BATTLE CREATE] Auto-creating gaming player for:", authenticatedHandle);
      const walletAddress = req.user?.walletAddress || req.user?.walletAddress || '';
      const playerData = {
        user_handle: authenticatedHandle,
        wallet_address: walletAddress,
        chain: 'xrpl',
        player_name: authenticatedHandle
      };
      const [newPlayer] = await db.insert(gamingPlayers).values(playerData as any as any).returning();
      player = newPlayer;
      console.log("✅ [BATTLE CREATE] Created gaming player:", player.id);
    }

    // Get squadron details for hash generation and verify ownership
    const squadron = await db.query.squadrons.findFirst({
      where: eq(squadrons.id, creator_squadron_id)
    });
    
    if (!squadron) {
      return res.status(404).json({ error: "Squadron not found" });
    }
    
    // Verify squadron ownership - need to get the gaming player to compare IDs
    const creator = await db.query.gamingPlayers.findFirst({
      where: eq(gamingPlayers.user_handle, authenticatedHandle)
    });
    
    if (!creator || squadron.player_id !== creator.id) {
      return res.status(403).json({ error: "Unauthorized: Cannot create battle with other players' squadrons" });
    }
    
    // Verify creator meets partner requirements if battle is restricted
    if (partnerCollectionId) {
      const player = await db.query.gamingPlayers.findFirst({
        where: eq(gamingPlayers.user_handle, authenticatedHandle)
      });
      
      if (!player) {
        return res.status(404).json({ error: "Player profile not found" });
      }
      
      const ownedNfts = await db
        .select()
        .from(gamingNfts)
        .where(and(
          eq(gamingNfts.owner_address, player.wallet_address || ''),
          eq(gamingNfts.collection_id, partnerCollectionId)
        ));
      
      const requiredCount = min_nfts_from_collection || 1;
      if (ownedNfts.length < requiredCount) {
        return res.status(403).json({ 
          error: `You need at least ${requiredCount} NFTs from the required collection to create this battle. You have ${ownedNfts.length}.` 
        });
      }
    }
    
    // Validate squadron has NFTs for battle
    const nftCount = squadron.nft_count || 0;
    if (nftCount === 0) {
      return res.status(400).json({ error: "Squadron must have at least 1 NFT to enter battle" });
    }
    
    // Validate group battle team size (minimum 2 NFTs for group battles)
    if (battle_type === "group" && nftCount < 2) {
      return res.status(400).json({ 
        error: "Group battles require at least 2 NFTs in your squadron. Please add more NFTs first." 
      });
    }
    
    // Generate server-side anti-cheat hash from canonical squadron state
    const creatorHash = await computeSquadronHash(creator_squadron_id);
    
    // Generate AI storyline and battle map visualization (do this BEFORE locking to avoid lock on failure)
    let battle_storyline = null;
    let strategic_options = [];
    let battle_map_image_url = null;
    
    if ((is_ai_battle || custom_prompt || land_type) && process.env.OPENAI_API_KEY) {
      // Get squadron NFTs with character classes and materials for richer context
      const squadronNftResults = await db.select()
        .from(squadronNfts)
        .leftJoin(nftPowerAttributes, eq(squadronNfts.nft_id, nftPowerAttributes.nft_id))
        .leftJoin(gamingNfts, eq(squadronNfts.nft_id, gamingNfts.id))
        .where(eq(squadronNfts.squadron_id, creator_squadron_id));
      
      // Extract character composition for Oracle context
      const characterClasses = squadronNftResults
        .map((n: any) => n.gaming_nfts?.character_class)
        .filter(Boolean);
      const materials = squadronNftResults
        .map((n: any) => n.gaming_nfts?.material_type)
        .filter(Boolean);
      
      const characterContext = characterClasses.length > 0 
        ? ` The squadron includes ${characterClasses.join(', ')} warriors` 
        : '';
      const materialContext = materials.length > 0 
        ? ` wielding ${materials.join(', ')} equipment` 
        : '';
      const specializationContext = required_specialization 
        ? ` This is a specialized ${required_specialization} battle, favoring those trained in such combat.`
        : '';
      
      const userPrompt = custom_prompt 
        ? `Create an epic battle storyline based on this scenario: "${custom_prompt}". The battle is ${combat_type} type on ${land_type} terrain. The player's squadron has ${squadron.total_power} total power.${characterContext}${materialContext}${specializationContext} Weave this into a dramatic 3-4 sentence narrative.`
        : `Create an epic battle storyline for a ${combat_type} battle on ${land_type} terrain. The player's squadron has ${squadron.total_power} total power.${characterContext}${materialContext}${specializationContext} Make it dramatic and engaging in 2-3 sentences.`;
      
      const storylineResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{
          role: "system",
          content: "You are The Oracle, a mystical AI narrator for The Trolls Inquisition NFT battle game. Create immersive, dramatic battle scenarios that honor the player's vision while adding epic flair. Pay attention to character classes (warriors, priests, wizards, etc.) and materials (gold, celestial, mythril, etc.) to craft authentic medieval narratives."
        }, {
          role: "user",
          content: userPrompt
        }],
        max_tokens: 200
      });
      
      battle_storyline = storylineResponse.choices[0]?.message?.content || null;
      
      // Generate strategic options based on scenario
      const strategyPrompt = custom_prompt
        ? `For this battle scenario: "${custom_prompt}" on ${land_type} terrain, provide 3 strategic options (low/medium/high risk). Format as JSON with "options" array containing: option, risk_level, reward_potential, description, ai_analysis.`
        : `For a ${combat_type} battle on ${land_type} terrain, provide 3 strategic options (low/medium/high risk). Format as JSON with "options" array containing: option, risk_level, reward_potential, description, ai_analysis.`;
      
      const optionsResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{
          role: "system",
          content: "You are The Oracle's tactical advisor. Provide strategic battle options that fit the scenario."
        }, {
          role: "user",
          content: strategyPrompt
        }],
        max_tokens: 500,
        response_format: { type: "json_object" }
      });
      
      try {
        const optionsData = JSON.parse(optionsResponse.choices[0]?.message?.content || '{}');
        strategic_options = optionsData.options || [];
      } catch (e) {
        console.error("Error parsing strategic options:", e);
      }
      
      // Generate battle map visualization using DALL-E
      const terrainDescriptions: Record<string, string> = {
        plains: "open grasslands with golden wheat fields, rolling hills in the distance, clear blue sky",
        mountains: "towering snow-capped peaks, rocky cliffs, narrow mountain passes, dramatic elevation",
        forest: "dense ancient forest with towering trees, dappled sunlight through leaves, moss-covered ground",
        desert: "vast sand dunes under scorching sun, scattered oases, ancient ruins half-buried in sand",
        swamp: "murky wetlands with twisted trees, thick fog, moss-covered water, dangerous terrain",
        coastal: "rocky shoreline with crashing waves, cliffs overlooking the sea, sandy beaches",
        volcanic: "active volcano with lava flows, scorched earth, ash-filled sky, glowing molten rock",
        tundra: "frozen wasteland with ice and snow, blizzard winds, glaciers, harsh cold terrain"
      };
      
      const terrainDesc = terrainDescriptions[land_type] || terrainDescriptions.plains;
      const battleMapPrompt = `Epic medieval fantasy battle map showing ${terrainDesc}. Top-down tactical map view, high quality digital art, detailed terrain features, strategic landmarks visible, medieval fantasy style, vibrant colors`;
      
      try {
        const imageResponse = await openai.images.generate({
          model: "dall-e-3",
          prompt: battleMapPrompt,
          n: 1,
          size: "1024x1024",
          quality: "standard"
        });
        
        battle_map_image_url = imageResponse.data?.[0]?.url || null;
        console.log(`🗺️ [BATTLE MAP] Generated map for ${land_type} terrain: ${battle_map_image_url ? 'SUCCESS' : 'FAILED'}`);
      } catch (imageError) {
        console.error("Error generating battle map image:", imageError);
        // Continue without image if generation fails
      }
    }
    
    // Set expiration time (24 hours for open battles)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    // Lock squadron and create battle atomically (unlock on any failure)
    let newBattle;
    try {
      // Lock squadron
      await db.update(squadrons)
        .set({  in_battle: true  } as any)
        .where(eq(squadrons.id, creator_squadron_id));
      
      // Create battle with new fields including custom prompt, battle map, and partner restrictions
      newBattle = await db.insert(battles).values({
        battle_type,
        combat_type,
        land_type: land_type || 'plains',
        response_timeout_minutes: response_timeout_minutes || 60,
        wager_amount: wager_amount || "0",
        is_friendly: is_friendly || false,
    // Use the player's UUID as the creator_player_id to match gamingPlayers.id
    creator_player_id: player.id,
        creator_squadron_id,
        creator_wallet_address: creator_wallet_address || null,
        is_ai_battle: is_ai_battle || false,
        ai_difficulty: ai_difficulty || null,
        custom_prompt: custom_prompt || null,
        required_specialization: required_specialization || null,
        time_limit_minutes: time_limit_minutes || null,
        partner_project_id: partner_project_id || null,
        restricted_to_collection: partnerCollectionId || null,
        min_nfts_from_collection: min_nfts_from_collection || 1,
        creator_hash: creatorHash,
        battle_storyline,
        battle_map_image_url,
        strategic_options,
        expires_at: expiresAt
      } as any).returning();
      
      // Update creator squadron with battle ID
      await db.update(squadrons)
        .set({  current_battle_id: newBattle[0].id  } as any)
        .where(eq(squadrons.id, creator_squadron_id));
      
      // If AI battle, auto-start immediately
      if (is_ai_battle) {
        await db.update(battles)
          .set({  
            status: 'in_progress', 
            started_at: new Date(),
            opponent_player_id: 'AI_ORACLE' // AI opponent marker
           } as any)
          .where(eq(battles.id, newBattle[0].id));
        
        // Fetch updated battle
        newBattle = await db.select().from(battles).where(eq(battles.id, newBattle[0].id));
      }
        
    } catch (dbError) {
      // Unlock squadron on failure
      await db.update(squadrons)
        .set({  in_battle: false, current_battle_id: null  } as any)
        .where(eq(squadrons.id, creator_squadron_id));
      throw dbError; // Re-throw to outer catch
    }
    
    res.json({ success: true, battle: newBattle[0] });
  } catch (error) {
    console.error("Error creating battle:", error);
    res.status(500).json({ error: "Failed to create battle" });
  }
});

// Accept/Join a battle
router.post("/api/battles/:battleId/join", requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const { battleId } = req.params;
    const { opponent_squadron_id } = req.body;
    const authenticatedHandle = req.user?.handle || req.user?.userHandle;
    
    if (!authenticatedHandle) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    const battle = await db.query.battles.findFirst({
      where: eq(battles.id, battleId)
    });
    
    if (!battle) {
      return res.status(404).json({ error: "Battle not found" });
    }
    
    if (battle.status !== 'open') {
      return res.status(400).json({ error: "Battle is not open" });
    }
    
    // Prevent joining own battle
    if (battle.creator_player_id === authenticatedHandle) {
      return res.status(400).json({ error: "Cannot join your own battle" });
    }
    
    // Get opponent squadron and verify ownership
    const squadron = await db.query.squadrons.findFirst({
      where: eq(squadrons.id, opponent_squadron_id)
    });
    
    if (!squadron) {
      return res.status(404).json({ error: "Squadron not found" });
    }
    
    if (squadron.player_id !== authenticatedHandle) {
      return res.status(403).json({ error: "Unauthorized: Cannot join battle with other players' squadrons" });
    }
    
    // Generate server-side anti-cheat hash from canonical squadron state
    const opponentHash = await computeSquadronHash(opponent_squadron_id);
    
    // Verify creator's squadron hash hasn't changed
    const creatorSquadronId = battle.creator_squadron_id;
    if (creatorSquadronId && battle.creator_hash) {
      const creatorHashValid = await verifySquadronHash(creatorSquadronId, battle.creator_hash);
      if (!creatorHashValid) {
        return res.status(400).json({ 
          error: "Anti-cheat failed: Creator's squadron state has been tampered with" 
        });
      }
    }
    
    // Lock opponent squadron and update battle atomically (unlock on any failure)
    let updatedBattle;
    try {
      // Lock opponent squadron
      await db.update(squadrons)
        .set({  in_battle: true, current_battle_id: battleId  } as any)
        .where(eq(squadrons.id, opponent_squadron_id));
      
      // Update battle
      updatedBattle = await db.update(battles)
        .set({ 
          opponent_player_id: authenticatedHandle,
          opponent_squadron_id,
          opponent_hash: opponentHash,
          status: 'in_progress',
          started_at: new Date()
         } as any)
        .where(eq(battles.id, battleId))
        .returning();
        
    } catch (dbError) {
      // Unlock opponent squadron on failure
      await db.update(squadrons)
        .set({  in_battle: false, current_battle_id: null  } as any)
        .where(eq(squadrons.id, opponent_squadron_id));
      throw dbError; // Re-throw to outer catch
    }
    
    res.json({ success: true, battle: updatedBattle[0] });
  } catch (error) {
    console.error("Error joining battle:", error);
    res.status(500).json({ error: "Failed to join battle" });
  }
});

// ==========================================
// ORACLE BATTLE SCENE SETUP
// ==========================================

// Generate Oracle-guided battle scene with DALL-E image
router.post("/api/battles/:battleId/oracle/scene-setup", requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const { battleId } = req.params;
    const authenticatedHandle = req.user?.handle || req.user?.userHandle;
    
    if (!authenticatedHandle) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    const battle = await db.query.battles.findFirst({
      where: eq(battles.id, battleId)
    });
    
    if (!battle || battle.status !== 'in_progress') {
      return res.status(400).json({ error: "Battle is not in progress" });
    }
    
    // Verify player is in this battle
    if (battle.creator_player_id !== authenticatedHandle && battle.opponent_player_id !== authenticatedHandle) {
      return res.status(403).json({ error: "Unauthorized" });
    }
    
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: "Oracle AI not available" });
    }
    
    // Get current round
    const existingMoves = await db.select()
      .from(battleMoves)
      .where(eq(battleMoves.battle_id, battleId));
    const roundNumber = Math.floor(existingMoves.length / 2) + 1;
    
    // Generate scene description based on battle type and round
    const scenePrompt = `You are The Oracle, an ancient mystic guiding a medieval ${battle.combat_type || 'war'} battle.
Round ${roundNumber} is about to begin. Set the scene in 3-4 sentences describing:
- The battlefield atmosphere and environment
- The tension between the two forces
- A mystical omen or sign
- The stakes of this round

Keep it epic, mystical, and immersive.`;
    
    const sceneResponse = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{
        role: "system",
        content: "You are The Oracle, a mystical guide for medieval battles. Speak in an ancient, wise, dramatic tone."
      }, {
        role: "user",
        content: scenePrompt
      }],
      max_tokens: 200
    });
    
    const scene_description = sceneResponse.choices[0]?.message?.content || "The battlefield awaits...";
    
    // Generate DALL-E image for the battle scene
    let scene_image_url = null;
    try {
      const imagePrompt = `Epic medieval ${battle.combat_type || 'war'} battle scene, round ${roundNumber}. 
Dramatic lighting, mystical atmosphere, two armies facing each other, 
medieval fantasy art style, cinematic composition, professional digital art`;
      
      const imageResponse = await openai.images.generate({
        model: "dall-e-3",
        prompt: imagePrompt,
        n: 1,
        size: "1024x1024",
        quality: "standard"
      });
      
      scene_image_url = imageResponse.data?.[0]?.url || null;
    } catch (imageError) {
      console.error("DALL-E image generation failed:", imageError);
      // Continue without image
    }
    
    res.json({
      success: true,
      round: roundNumber,
      scene_description,
      scene_image_url,
      oracle_guidance: "Choose your strategy wisely, warrior. The Oracle watches..."
    });
    
  } catch (error) {
    console.error("Error generating battle scene:", error);
    res.status(500).json({ error: "Failed to generate battle scene" });
  }
});

// ==========================================
// ORACLE 6-POINT QUESTION SYSTEM
// ==========================================

// Generate Oracle question with 6 strategic answer options
router.post("/api/battles/:battleId/oracle/generate-question", requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const { battleId } = req.params;
    const authenticatedHandle = req.user?.handle || req.user?.userHandle;
    
    if (!authenticatedHandle) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    const battle = await db.query.battles.findFirst({
      where: eq(battles.id, battleId)
    });
    
    if (!battle || battle.status !== 'in_progress') {
      return res.status(400).json({ error: "Battle is not in progress" });
    }
    
    if (battle.creator_player_id !== authenticatedHandle && battle.opponent_player_id !== authenticatedHandle) {
      return res.status(403).json({ error: "Unauthorized" });
    }
    
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: "Oracle AI not available" });
    }
    
    // Get current round and battle context
    const existingMoves = await db.select()
      .from(battleMoves)
      .where(eq(battleMoves.battle_id, battleId));
    const roundNumber = Math.floor(existingMoves.length / 2) + 1;
    
    // Generate strategic question with 6 physics-based options
    const questionPrompt = `You are The Oracle presenting a strategic ${battle.combat_type || 'war'} challenge.
Generate a tactical question for round ${roundNumber} that tests the player's strategic thinking.

The question should:
1. Be relevant to medieval ${battle.combat_type || 'warfare'} tactics
2. Have real strategic implications
3. Test decision-making under pressure
4. Be answered with one of 6 strategic choices

Provide EXACTLY 6 answer options with different risk/reward profiles:
- 2 low-risk defensive options (safe, modest gains)
- 2 medium-risk balanced options (moderate risk/reward)
- 2 high-risk aggressive options (dangerous, high reward)

Format as JSON:
{
  "question": "The tactical scenario question",
  "options": [
    {"id": 1, "text": "Option description", "risk": "low|medium|high", "power_potential": 10-100},
    ...6 total options
  ],
  "oracle_hint": "Mystical guidance about the choice"
}`;
    
    const questionResponse = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{
        role: "system",
        content: "You are The Oracle. Generate strategic battle questions in JSON format. Always provide exactly 6 options with varying risk levels."
      }, {
        role: "user",
        content: questionPrompt
      }],
      max_tokens: 600,
      response_format: { type: "json_object" }
    });
    
    const questionData = JSON.parse(questionResponse.choices[0]?.message?.content || '{}');
    
    res.json({
      success: true,
      round: roundNumber,
      ...questionData
    });
    
  } catch (error) {
    console.error("Error generating Oracle question:", error);
    res.status(500).json({ error: "Failed to generate question" });
  }
});

// ==========================================
// ENHANCED BATTLE MOVE WITH ORACLE
// ==========================================

// Make a battle move with Oracle guidance and physics
router.post("/api/battles/:battleId/move", requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const { battleId } = req.params;
    const { strategic_choice, risk_level, move_type, chosen_option_id, oracle_question_answered } = req.body;
    const authenticatedHandle = req.user?.handle || req.user?.userHandle;
    
    if (!authenticatedHandle) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    const battle = await db.query.battles.findFirst({
      where: eq(battles.id, battleId)
    });
    
    if (!battle || battle.status !== 'in_progress') {
      return res.status(400).json({ error: "Battle is not in progress" });
    }
    
    // Verify player is in this battle
    if (battle.creator_player_id !== authenticatedHandle && battle.opponent_player_id !== authenticatedHandle) {
      return res.status(403).json({ error: "Unauthorized: You are not a participant in this battle" });
    }
    
    // ANTI-CHEAT: Verify squadron hashes before allowing moves
    if (battle.creator_squadron_id && battle.creator_hash) {
      const creatorHashValid = await verifySquadronHash(battle.creator_squadron_id, battle.creator_hash);
      if (!creatorHashValid) {
        return res.status(400).json({ 
          error: "Anti-cheat failed: Creator's squadron has been tampered with since battle start" 
        });
      }
    }
    
    if (battle.opponent_squadron_id && battle.opponent_hash) {
      const opponentHashValid = await verifySquadronHash(battle.opponent_squadron_id, battle.opponent_hash);
      if (!opponentHashValid) {
        return res.status(400).json({ 
          error: "Anti-cheat failed: Opponent's squadron has been tampered with since battle start" 
        });
      }
    }
    
    // Calculate move outcome based on risk level with physics-based calculation
    const baseSuccessChance = (risk_level === 'low' ? 0.8 : 
                          risk_level === 'medium' ? 0.6 : 
                          risk_level === 'high' ? 0.4 : 0.5);
    
    // Add randomness for physics simulation
    const randomFactor = (Math.random() - 0.5) * 0.2; // ±10% variance
    const finalSuccessChance = Math.max(0.1, Math.min(0.95, baseSuccessChance + randomFactor));
    
    const success = Math.random() < finalSuccessChance;
    
    // Power change based on 6-point question physics
    let powerChange = 0;
    if (oracle_question_answered && chosen_option_id) {
      // If Oracle question was answered, use that for power calculation
      const powerPotential = req.body.power_potential || 50;
      powerChange = success ? powerPotential : -Math.floor(powerPotential * 0.6);
    } else {
      // Standard power calculation
      powerChange = success ? 
        (risk_level === 'high' ? 50 : risk_level === 'medium' ? 30 : 15) :
        (risk_level === 'high' ? -40 : risk_level === 'medium' ? -20 : -10);
    }
    
    // Generate AI narration with Oracle voice
    let ai_narration = null;
    let ai_image_url = null;
    
    if (process.env.OPENAI_API_KEY) {
      const narrationResponse = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{
          role: "system",
          content: "You are The Oracle, narrating battle outcomes in mystical, epic medieval style with prophetic wisdom."
        }, {
          role: "user",
          content: `The warrior chose: "${strategic_choice}" (${risk_level} risk). Result: ${success ? 'SUCCESS' : 'FAILURE'}. Power change: ${powerChange > 0 ? '+' : ''}${powerChange}. 
          
Narrate this outcome as The Oracle in 2-3 dramatic sentences, speaking directly to the warrior.`
        }],
        max_tokens: 150
      });
      
      ai_narration = narrationResponse.choices[0]?.message?.content || null;
      
      // Generate outcome image with DALL-E
      try {
        const imagePrompt = `${success ? 'Victorious' : 'Defeated'} medieval warrior after ${strategic_choice}, 
${battle.combat_type || 'war'} battle scene, dramatic ${success ? 'golden' : 'dark'} lighting, 
epic fantasy art, cinematic, professional digital painting`;
        
        const imageResponse = await openai.images.generate({
          model: "dall-e-3",
          prompt: imagePrompt,
          n: 1,
          size: "1024x1024",
          quality: "standard"
        });
        
        ai_image_url = imageResponse.data?.[0]?.url || null;
      } catch (imageError) {
        console.error("DALL-E outcome image failed:", imageError);
      }
    }
    
    // Get current round number
    const existingMoves = await db.select()
      .from(battleMoves)
      .where(eq(battleMoves.battle_id, battleId));
    
    const roundNumber = Math.floor(existingMoves.length / 2) + 1;
    
    // Create move
    const move = await db.insert(battleMoves).values({
      battle_id: battleId,
      round_number: roundNumber,
      player_id: authenticatedHandle,
      move_type,
      strategic_choice,
      risk_level,
      success,
      power_change: powerChange,
      result_description: success ? 'The Oracle smiles upon your strategy!' : 'The Oracle witnesses your setback...',
      ai_narration,
      ai_image_url
    } as any).returning();
    
    // Update battle log
    const currentLog = battle.battle_log || [];
    currentLog.push({
      round: roundNumber,
      player_id: authenticatedHandle,
      action: strategic_choice,
      result: success ? 'success' : 'failure',
      power_change: powerChange,
      timestamp: new Date().toISOString()
    });
    
    await db.update(battles)
      .set({  battle_log: currentLog  } as any)
      .where(eq(battles.id, battleId));
    
    // Send push notification to opponent that it's their turn
    const opponentHandle = battle.creator_player_id === authenticatedHandle 
      ? battle.opponent_player_id 
      : battle.creator_player_id;
    
    if (opponentHandle) {
      try {
        await notificationService.createNotification({
          userId: opponentHandle,
          type: 'system',
          title: '⚔️ Your Turn in Battle!',
          content: `${authenticatedHandle} has made their move. The Oracle awaits your decision!`,
          actionUrl: `/battle-room/${battleId}`,
          relatedId: battleId,
          senderHandle: authenticatedHandle
        });
        console.log(`🔔 [BATTLE] Turn notification sent to ${opponentHandle}`);
      } catch (notifError) {
        console.error("Failed to send turn notification:", notifError);
        // Don't fail the request if notification fails
      }
    }
    
    res.json({ 
      success: true, 
      move: move[0], 
      ai_narration,
      ai_image_url,
      oracle_message: success ? "The Oracle approves of your wisdom!" : "The Oracle counsels patience and reflection..."
    });
  } catch (error) {
    console.error("Error making battle move:", error);
    res.status(500).json({ error: "Failed to make battle move" });
  }
});

// Complete a battle (SERVER-SIDE WINNER DETERMINATION with Oracle AI)
router.post("/api/battles/:battleId/complete", requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const { battleId } = req.params;
    const authenticatedHandle = req.user?.handle || req.user?.userHandle;
    
    if (!authenticatedHandle) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    const battle = await db.query.battles.findFirst({
      where: eq(battles.id, battleId)
    });
    
    if (!battle) {
      return res.status(404).json({ error: "Battle not found" });
    }
    
    // Verify requester is a battle participant or admin
    if (battle.creator_player_id !== authenticatedHandle && battle.opponent_player_id !== authenticatedHandle) {
      return res.status(403).json({ error: "Unauthorized: Only battle participants can complete battles" });
    }
    
    // Get both squadrons with NFT data
    const creatorSquadron = await db.query.squadrons.findFirst({
      where: eq(squadrons.id, battle.creator_squadron_id!),
      with: {
        nfts: {
          with: {
            powerAttributes: true
          }
        }
      }
    });
    
    const opponentSquadron = battle.opponent_squadron_id 
      ? await db.query.squadrons.findFirst({
          where: eq(squadrons.id, battle.opponent_squadron_id),
          with: {
            nfts: {
              with: {
                powerAttributes: true
              }
            }
          }
        })
      : null;
    
    if (!creatorSquadron || (!opponentSquadron && !battle.is_ai_battle)) {
      return res.status(400).json({ error: "Battle squadrons not found" });
    }
    
    // Calculate total power with specialization bonuses for creator
    let creatorTotalPower = 0;
    let creatorContext = '';
    
    for (const nftAssignment of (creatorSquadron.nfts as any[]) || []) {
      const nft = nftAssignment.powerAttributes;
      if (!nft) continue;
      
      const bonuses = calculateBattlePowerBonus(nft, battle.required_specialization, battle.combat_type);
      const totalNftPower = Number(nft.army_power || 0) + Number(nft.religion_power || 0) + 
                           Number(nft.civilization_power || 0) + Number(nft.economic_power || 0) +
                           bonuses.armyBonus + bonuses.religionBonus + 
                           bonuses.civilizationBonus + bonuses.economicBonus;
      creatorTotalPower += totalNftPower;
      
      if (nft.character_class) {
        creatorContext += `${nft.character_class} (${nft.material_type || 'standard'}), `;
      }
    }
    
    // Calculate total power with specialization bonuses for opponent
    let opponentTotalPower = 0;
    let opponentContext = '';
    
    if (opponentSquadron) {
      for (const nftAssignment of (opponentSquadron.nfts as any[]) || []) {
        const nft = nftAssignment.powerAttributes;
        if (!nft) continue;
        
        const bonuses = calculateBattlePowerBonus(nft, battle.required_specialization, battle.combat_type);
        const totalNftPower = Number(nft.army_power || 0) + Number(nft.religion_power || 0) + 
                             Number(nft.civilization_power || 0) + Number(nft.economic_power || 0) +
                             bonuses.armyBonus + bonuses.religionBonus + 
                             bonuses.civilizationBonus + bonuses.economicBonus;
        opponentTotalPower += totalNftPower;
        
        if (nft.character_class) {
          opponentContext += `${nft.character_class} (${nft.material_type || 'standard'}), `;
        }
      }
    } else if (battle.is_ai_battle) {
      opponentTotalPower = creatorTotalPower * 0.9; // AI at 90% of player power for balance
      opponentContext = 'Oracle\'s mystical forces';
    }
    
    // Use Oracle AI to determine winner based on power and context
    let winner_player_id = null;
    let oracle_decision = '';
    
    if (process.env.OPENAI_API_KEY) {
      const oraclePrompt = `
You are The Oracle, the supreme adjudicator of battles in The Trolls Inquisition.

BATTLE DETAILS:
- Type: ${battle.combat_type} battle on ${battle.land_type} terrain
- Specialization requirement: ${battle.required_specialization || 'none'}

CREATOR SQUADRON (${battle.creator_player_id}):
- Total Power: ${creatorTotalPower}
- Character Classes: ${creatorContext || 'standard warriors'}

OPPONENT SQUADRON (${battle.opponent_player_id || 'AI Oracle'}):
- Total Power: ${opponentTotalPower}
- Character Classes: ${opponentContext || 'standard warriors'}

BATTLE LOG: ${JSON.stringify(battle.battle_log || [])}

Based on total power (with character class and specialization bonuses applied), character composition, battle history, and the mystical will of fate, declare the winner. Respond with JSON: {"winner": "creator" or "opponent", "reasoning": "2-3 sentence epic narration of why they won"}`;

      try {
        const oracleResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{
            role: "system",
            content: "You are The Oracle, wise and fair arbiter of battles. You weigh power, strategy, character classes, and fate to declare winners."
          }, {
            role: "user",
            content: oraclePrompt
          }],
          response_format: { type: "json_object" },
          max_tokens: 300
        });
        
        const decision = JSON.parse(oracleResponse.choices[0]?.message?.content || '{}');
        oracle_decision = decision.reasoning || '';
        winner_player_id = decision.winner === 'creator' 
          ? battle.creator_player_id 
          : (battle.opponent_player_id || 'AI_ORACLE');
        
      } catch (aiError) {
        console.error("Oracle AI error, falling back to power comparison:", aiError);
        // Fallback: simple power comparison
        winner_player_id = creatorTotalPower > opponentTotalPower 
          ? battle.creator_player_id 
          : (battle.opponent_player_id || 'AI_ORACLE');
        oracle_decision = `The Oracle declares victory through raw power (${creatorTotalPower} vs ${opponentTotalPower})`;
      }
    } else {
      // No API key: simple power comparison
      winner_player_id = creatorTotalPower > opponentTotalPower 
        ? battle.creator_player_id 
        : (battle.opponent_player_id || 'AI_ORACLE');
      oracle_decision = `Victory determined by power: ${creatorTotalPower} vs ${opponentTotalPower}`;
    }
    
    // Update battle status to completed with Oracle's decision
    await db.update(battles)
      .set({ 
        status: 'completed',
        winner_player_id,
        creator_power_used: creatorTotalPower,
        opponent_power_used: opponentTotalPower,
        completed_at: new Date()
       } as any)
      .where(eq(battles.id, battleId));
    
    // Unlock squadrons
    await unlockSquadrons(battleId);

    // Update per-NFT battle stats for both squadrons (if present)
    try {
      const creatorSquadronId = battle.creator_squadron_id;
      const opponentSquadronId = battle.opponent_squadron_id;

      if (creatorSquadronId) {
        const creatorNfts = await db.select().from(squadronNfts).where(eq(squadronNfts.squadron_id, creatorSquadronId));
        const creatorNftIds = creatorNfts.map((r: any) => r.nft_id).filter(Boolean);
        await updateSquadronBattleStats({
          squadronId: creatorSquadronId,
          nftIds: creatorNftIds,
          didWin: winner_player_id === battle.creator_player_id,
          totalDamageDealt: Math.max(0, Math.round(opponentTotalPower)),
          totalDamageTaken: Math.max(0, Math.round(creatorTotalPower)),
          battleId
        });
      }

      if (opponentSquadronId) {
        const opponentNfts = await db.select().from(squadronNfts).where(eq(squadronNfts.squadron_id, opponentSquadronId));
        const opponentNftIds = opponentNfts.map((r: any) => r.nft_id).filter(Boolean);
        await updateSquadronBattleStats({
          squadronId: opponentSquadronId,
          nftIds: opponentNftIds,
          didWin: winner_player_id === battle.opponent_player_id,
          totalDamageDealt: Math.max(0, Math.round(creatorTotalPower)),
          totalDamageTaken: Math.max(0, Math.round(opponentTotalPower)),
          battleId
        });
      }
    } catch (statsError) {
      console.error('❌ Error updating NFT battle stats after completion:', statsError);
    }

    res.json({ 
      success: true, 
      message: "Battle completed and squadrons unlocked",
      winner: winner_player_id,
      oracle_decision,
      power_totals: {
        creator: creatorTotalPower,
        opponent: opponentTotalPower
      }
    });
  } catch (error) {
    console.error("Error completing battle:", error);
    res.status(500).json({ error: "Failed to complete battle" });
  }
});

// Cancel a battle (creator only, unlocks squadron)
router.post("/api/battles/:battleId/cancel", requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const { battleId } = req.params;
    const authenticatedHandle = req.user?.handle || req.user?.userHandle;
    
    if (!authenticatedHandle) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    const battle = await db.query.battles.findFirst({
      where: eq(battles.id, battleId)
    });
    
    if (!battle) {
      return res.status(404).json({ error: "Battle not found" });
    }
    
    // Only creator can cancel open battles
    if (battle.creator_player_id !== authenticatedHandle) {
      return res.status(403).json({ error: "Unauthorized: Only battle creator can cancel" });
    }
    
    if (battle.status !== 'open') {
      return res.status(400).json({ error: "Can only cancel open battles" });
    }
    
    // Update battle status to cancelled
    await db.update(battles)
      .set({ 
        status: 'cancelled',
        completed_at: new Date()
       } as any)
      .where(eq(battles.id, battleId));
    
    // Unlock squadrons
    await unlockSquadrons(battleId);
    
    res.json({ success: true, message: "Battle cancelled and squadrons unlocked" });
  } catch (error) {
    console.error("Error cancelling battle:", error);
    res.status(500).json({ error: "Failed to cancel battle" });
  }
});

// Get open battles
router.get("/api/battles/open", requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const authenticatedHandle = req.user?.handle || req.user?.userHandle;
    
    if (!authenticatedHandle) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    const openBattles = await db.select()
      .from(battles)
      .leftJoin(squadrons, eq(battles.creator_squadron_id, squadrons.id))
      .where(eq(battles.status, 'open'))
      .orderBy(desc(battles.created_at));
    
    res.json({ success: true, battles: openBattles });
  } catch (error) {
    console.error("Error fetching open battles:", error);
    res.status(500).json({ error: "Failed to fetch open battles" });
  }
});

// Get current authenticated player's battles
router.get("/api/battles/player", requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const authenticatedHandle = req.user?.handle || req.user?.userHandle;
    
    if (!authenticatedHandle) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    const playerBattles = await db.select()
      .from(battles)
      .where(
        or(
          eq(battles.creator_player_id, authenticatedHandle),
          eq(battles.opponent_player_id, authenticatedHandle)
        )
      )
      .orderBy(desc(battles.created_at))
      .limit(50); // Limit to prevent large responses
    
    res.json({ success: true, battles: playerBattles });
  } catch (error) {
    console.error("Error fetching current player battles:", error);
    res.status(500).json({ error: "Failed to fetch player battles" });
  }
});

// Get player's battle history
router.get("/api/battles/player/:playerHandle", requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const { playerHandle } = req.params;
    const authenticatedHandle = req.user?.handle || req.user?.userHandle;
    
    if (!authenticatedHandle) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    // Verify user can only access their own battle history
    if (playerHandle !== authenticatedHandle) {
      return res.status(403).json({ error: "Unauthorized: Cannot access other players' battle history" });
    }
    
    const playerBattles = await db.select()
      .from(battles)
      .where(
        or(
          eq(battles.creator_player_id, playerHandle),
          eq(battles.opponent_player_id, playerHandle)
        )
      )
      .orderBy(desc(battles.created_at));
    
    res.json({ success: true, battles: playerBattles });
  } catch (error) {
    console.error("Error fetching player battles:", error);
    res.status(500).json({ error: "Failed to fetch player battles" });
  }
});

// ==========================================
// SPECTATOR VIEWING ROUTES
// ==========================================

// Get active battles (in-progress battles that can be spectated) - PUBLIC
router.get("/api/battles/active", async (req, res) => {
  try {
    const activeBattles = await db.select()
      .from(battles)
      .where(eq(battles.status, 'in_progress'))
      .orderBy(desc(battles.started_at))
      .limit(20);
    
    res.json({ success: true, battles: activeBattles });
  } catch (error) {
    console.error("Error fetching active battles:", error);
    res.status(500).json({ error: "Failed to fetch active battles" });
  }
});

// Get full battle details for viewing - PUBLIC for spectators
router.get("/api/battles/:battleId/view", async (req, res) => {
  try {
    const { battleId } = req.params;
    
    // Get battle details
    const [battle] = await db.select()
      .from(battles)
      .where(eq(battles.id, battleId));
    
    if (!battle) {
      return res.status(404).json({ error: "Battle not found" });
    }
    
    // Get creator squadron details
    let creatorSquadron = null;
    if (battle.creator_squadron_id) {
      const [squad] = await db.select()
        .from(squadrons)
        .where(eq(squadrons.id, battle.creator_squadron_id));
      creatorSquadron = squad;
    }
    
    // Get opponent squadron details
    let opponentSquadron = null;
    if (battle.opponent_squadron_id) {
      const [squad] = await db.select()
        .from(squadrons)
        .where(eq(squadrons.id, battle.opponent_squadron_id));
      opponentSquadron = squad;
    }
    
    // Get all battle moves
    const moves = await db.select()
      .from(battleMoves)
      .where(eq(battleMoves.battle_id, battleId))
      .orderBy(desc(battleMoves.round_number));
    
    const currentRound = moves.length > 0 ? Math.max(...moves.map(m => m.round_number)) : 0;
    
    res.json({
      success: true,
      battle,
      creatorSquadron,
      opponentSquadron,
      moves,
      currentRound,
      spectatorCount: Math.floor(Math.random() * 50) + 10 // Placeholder - can implement real tracking later
    });
  } catch (error) {
    console.error("Error fetching battle details:", error);
    res.status(500).json({ error: "Failed to fetch battle details" });
  }
});

// Get completed battles (for browsing past battles) - PUBLIC
router.get("/api/battles/completed", async (req, res) => {
  try {
    const completedBattles = await db.select()
      .from(battles)
      .where(eq(battles.status, 'completed'))
      .orderBy(desc(battles.completed_at))
      .limit(50);
    
    res.json({ success: true, battles: completedBattles });
  } catch (error) {
    console.error("Error fetching completed battles:", error);
    res.status(500).json({ error: "Failed to fetch completed battles" });
  }
});

// ==========================================
// TOURNAMENT ROUTES
// ==========================================

// Create tournament (admin only)
router.post("/api/tournaments/create", requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const authenticatedHandle = req.user?.handle || req.user?.userHandle;
    
    if (!authenticatedHandle) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    const { 
      name, description, tournament_type, combat_type,
      entry_fee, min_power_required, max_participants,
      total_prize_pool, first_place_prize, second_place_prize, third_place_prize,
      loot_rewards, registration_opens, registration_closes, starts_at,
      is_admin_tournament
    } = req.body;
    
    // TODO: Add admin check here to verify authenticatedHandle is admin
    
    // Tournament system not implemented in current schema version; return stub
    res.json({ success: true, tournament: {
      name,
      description,
      starts_at,
      created_by: authenticatedHandle,
      status: 'stub'
    }});
  } catch (error) {
    console.error("Error creating tournament:", error);
    res.status(500).json({ error: "Failed to create tournament" });
  }
});

// Register for tournament
// Tournament system not implemented in current schema version. Stub endpoints retained.
router.post("/api/tournaments/:tournamentId/register", requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const { tournamentId } = req.params;
    const { squadron_id, payment_tx_hash } = req.body;
    const authenticatedHandle = req.user?.handle || req.user?.userHandle;
    
    if (!authenticatedHandle) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    // Stub tournament record (since tournaments table not present)
    const tournament = {
      id: tournamentId,
      status: 'registration_open',
      registered_count: 0,
      max_participants: 16,
      min_power_required: 0
    };
    
    // Verify squadron ownership
    const squadron = await db.query.squadrons.findFirst({
      where: eq(squadrons.id, squadron_id)
    });
    
    if (!squadron) {
      return res.status(404).json({ error: "Squadron not found" });
    }
    
    if (squadron.player_id !== authenticatedHandle) {
      return res.status(403).json({ error: "Unauthorized: Cannot register with other players' squadrons" });
    }
    
    // Check player power requirement
    const player = await db.query.gamingPlayers.findFirst({
      where: eq(gamingPlayers.user_handle, authenticatedHandle)
    });
    
    if (player && Number(player.total_power_level || 0) < Number(tournament.min_power_required || 0)) {
      return res.status(400).json({ error: "Player does not meet minimum power requirement" });
    }
    
    // Return stub success response
    res.json({ success: true, participant: {
      tournament_id: tournamentId,
      player_id: authenticatedHandle,
      squadron_id,
      entry_fee_paid: !!payment_tx_hash,
      payment_tx_hash: payment_tx_hash || null
    }});
  } catch (error: any) {
    console.error("Error registering for tournament:", error);
    if (error?.code === '23505') {
      res.status(400).json({ error: "Already registered for this tournament" });
    } else {
      res.status(500).json({ error: "Failed to register for tournament" });
    }
  }
});

// Get upcoming tournaments
router.get("/api/tournaments/upcoming", requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const authenticatedHandle = req.user?.handle || req.user?.userHandle;
    
    if (!authenticatedHandle) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    // Return stub list of tournaments
    res.json({ success: true, tournaments: [
      { id: 'stub-1', name: 'Arena Challenge', status: 'upcoming', starts_at: new Date(), registration_opens: new Date(), registration_closes: new Date() },
      { id: 'stub-2', name: 'Land Claim Skirmish', status: 'registration_open', starts_at: new Date(Date.now()+3600000) }
    ] });
  } catch (error) {
    console.error("Error fetching upcoming tournaments:", error);
    res.status(500).json({ error: "Failed to fetch tournaments" });
  }
});

// ==========================================
// NFT POWER SCANNER ROUTES
// ==========================================

// Scan player NFTs for power levels
router.post("/api/nft-power/scan/:userHandle", requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const { userHandle } = req.params;
    const authenticatedHandle = req.user?.handle || req.user?.userHandle;
    
    if (!authenticatedHandle) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    // Verify user can only scan their own NFTs
    if (userHandle !== authenticatedHandle) {
      return res.status(403).json({ error: "Unauthorized: Cannot scan other players' NFTs" });
    }
    
    const powerTotals = await scanPlayerNftPower(userHandle);
    const icons = getPowerIcons();
    
    res.json({ success: true, power: powerTotals, icons });
  } catch (error) {
    console.error("Error scanning NFT power:", error);
    res.status(500).json({ error: "Failed to scan NFT power" });
  }
});

// Get player's NFT power breakdown
router.get("/api/nft-power/player/:userHandle", requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const { userHandle } = req.params;
    const authenticatedHandle = req.user?.handle || req.user?.userHandle;
    
    if (!authenticatedHandle) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    // Verify user can only access their own power data
    if (userHandle !== authenticatedHandle) {
      return res.status(403).json({ error: "Unauthorized: Cannot access other players' power data" });
    }
    
    const player = await db.query.gamingPlayers.findFirst({
      where: eq(gamingPlayers.user_handle, userHandle)
    });
    
    if (!player) {
      return res.status(404).json({ error: "Player not found" });
    }
    
    const icons = getPowerIcons();
    
    res.json({ 
      success: true, 
      power: {
        army_power: player.army_power,
        religion_power: player.religion_power,
        civilization_power: player.civilization_power,
        economic_power: player.economic_power,
        total_power: player.total_power_level
      },
      icons
    });
  } catch (error) {
    console.error("Error fetching player power:", error);
    res.status(500).json({ error: "Failed to fetch player power" });
  }
});

// ==========================================
// AI BATTLE EXECUTION
// ==========================================

// Execute a round in an AI battle
router.post("/api/battles/:battleId/ai-round", requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const { battleId } = req.params;
    const { playerStrategy } = req.body;
    const authenticatedHandle = req.user?.handle || req.user?.userHandle;
    
    if (!authenticatedHandle) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    const battle = await db.query.battles.findFirst({
      where: eq(battles.id, battleId)
    });
    
    if (!battle) {
      return res.status(404).json({ error: "Battle not found" });
    }
    
    if (!battle.is_ai_battle) {
      return res.status(400).json({ error: "This is not an AI battle" });
    }
    
    if (battle.creator_player_id !== authenticatedHandle) {
      return res.status(403).json({ error: "Not your battle" });
    }
    
    if (battle.status === 'completed') {
      return res.status(400).json({ error: "Battle already completed" });
    }
    
    // Get current battle log
    const battleLog = (battle.battle_log as any[]) || [];
    const currentRound = battleLog.length + 1;
    
    // Get squadron power
    const squadron = await db.query.squadrons.findFirst({
      where: eq(squadrons.id, battle.creator_squadron_id!)
    });
    
    if (!squadron) {
      return res.status(404).json({ error: "Squadron not found" });
    }
    
    // Calculate remaining power from previous rounds
    let creatorPowerRemaining = Number(squadron.total_power || 0);
    let aiPowerRemaining = Number(squadron.total_power || 0); // AI starts with similar power
    
    for (const logEntry of battleLog) {
      if (logEntry.player_id === authenticatedHandle) {
        aiPowerRemaining += Number(logEntry.power_change || 0); // Player's actions damage AI
      } else {
        creatorPowerRemaining += Number(logEntry.power_change || 0); // AI's actions damage player
      }
    }
    
    // Simulate player move
    const playerMove = await simulatePlayerMove({
      battleId,
      round: currentRound,
      creatorPower: creatorPowerRemaining,
      aiPower: aiPowerRemaining,
      landType: battle.land_type || 'plains',
      combatType: battle.combat_type,
      aiDifficulty: battle.ai_difficulty || 'medium',
      storyline: battle.battle_storyline || ''
    }, playerStrategy);
    
    // Apply player damage to AI
    aiPowerRemaining += Number(playerMove.powerChange || 0);
    
    // Check if AI defeated
    if (aiPowerRemaining != null && aiPowerRemaining <= 0) {
      const finalLog = [...battleLog, {
        round: currentRound,
        player_id: authenticatedHandle,
        action: playerMove.action,
        result: playerMove.result,
        power_change: playerMove.powerChange,
        timestamp: new Date().toISOString()
      }];
      
      await db.update(battles)
        .set({ 
          status: 'completed',
          completed_at: new Date(),
          winner_player_id: authenticatedHandle,
          winner_squadron_id: squadron.id,
          battle_log: finalLog
         } as any)
        .where(eq(battles.id, battleId));
      
      // Unlock squadron
      await unlockSquadrons(battleId);

      // Update NFT battle stats for creator squadron (player won vs AI)
      try {
        const creatorNfts = await db.select().from(squadronNfts).where(eq(squadronNfts.squadron_id, squadron.id));
        const creatorNftIds = creatorNfts.map((r: any) => r.nft_id).filter(Boolean);
        await updateSquadronBattleStats({
          squadronId: squadron.id,
          nftIds: creatorNftIds,
          didWin: true,
          totalDamageDealt: Math.max(0, Math.round(Number(squadron.total_power || 0))),
          totalDamageTaken: 0,
          battleId
        });
      } catch (statsErr) {
        console.error('❌ Error updating NFT stats after AI battle win:', statsErr);
      }
      
      return res.json({
        success: true,
        gameOver: true,
        winner: 'player',
        playerMove,
        finalPowers: { player: creatorPowerRemaining, ai: aiPowerRemaining }
      });
    }
    
    // Simulate AI move
    const aiMove = await simulateAIMove({
      battleId,
      round: currentRound,
      creatorPower: creatorPowerRemaining,
      aiPower: aiPowerRemaining,
      landType: battle.land_type || 'plains',
      combatType: battle.combat_type,
      aiDifficulty: battle.ai_difficulty || 'medium',
      storyline: battle.battle_storyline || ''
    });
    
    // Apply AI damage to player
    creatorPowerRemaining += Number(aiMove.powerChange || 0);
    
    // Update battle log
    const updatedLog = [
      ...battleLog,
      {
        round: currentRound,
        player_id: authenticatedHandle,
        action: playerMove.action,
        result: playerMove.result,
        power_change: playerMove.powerChange,
        timestamp: new Date().toISOString()
      },
      {
        round: currentRound,
        player_id: 'AI_ORACLE',
        action: aiMove.action,
        result: aiMove.result,
        power_change: aiMove.powerChange,
        timestamp: new Date().toISOString()
      }
    ];
    
    // Check if player defeated
    let gameOver = false;
    let winner = null;
    
    if (creatorPowerRemaining != null && creatorPowerRemaining <= 0) {
      gameOver = true;
      winner = 'ai';
      
      await db.update(battles)
        .set({ 
          status: 'completed',
          completed_at: new Date(),
          winner_player_id: 'AI_ORACLE',
          battle_log: updatedLog
         } as any)
        .where(eq(battles.id, battleId));
      
      // Unlock squadron
      await unlockSquadrons(battleId);
      // Update NFT battle stats for creator squadron (player lost to AI)
      try {
        const creatorNfts = await db.select().from(squadronNfts).where(eq(squadronNfts.squadron_id, squadron.id));
        const creatorNftIds = creatorNfts.map((r: any) => r.nft_id).filter(Boolean);
        await updateSquadronBattleStats({
          squadronId: squadron.id,
          nftIds: creatorNftIds,
          didWin: false,
          totalDamageDealt: 0,
          totalDamageTaken: Math.max(0, Math.round(Number(squadron.total_power || 0))),
          battleId
        });
      } catch (statsErr) {
        console.error('❌ Error updating NFT stats after AI battle loss:', statsErr);
      }
    } else {
      // Battle continues
      await db.update(battles)
        .set({ 
          battle_log: updatedLog
         } as any)
        .where(eq(battles.id, battleId));
    }
    
    res.json({
      success: true,
      gameOver,
      winner,
      playerMove,
      aiMove,
      currentPowers: { player: creatorPowerRemaining, ai: aiPowerRemaining },
      round: currentRound
    });
  } catch (error) {
    console.error("Error executing AI battle round:", error);
    res.status(500).json({ error: "Failed to execute AI battle round" });
  }
});

// ==========================================
// NFT COLLECTION SCANNER
// ==========================================

// Scan all NFT collections and calculate power
router.post("/api/collections/scan-all", requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const authenticatedHandle = req.user?.handle || req.user?.userHandle;
    
    if (!authenticatedHandle) {
      return res.status(401).json({ error: "Authentication required" });
    }

    console.log(`🚀 [SCANNER API] Initiating full collection scan requested by ${authenticatedHandle}`);

    const result = await scanAllCollections();

    res.json({
      success: result.success,
      message: `Scanned ${result.collections_scanned} collections with ${result.total_nfts_found} NFTs total`,
      details: {
        collections_scanned: result.collections_scanned,
        total_nfts_found: result.total_nfts_found,
        errors: result.errors
      }
    });
  } catch (error: any) {
    console.error("Error scanning collections:", error);
    res.status(500).json({ error: "Failed to scan collections" });
  }
});

// Get leaderboards - top players by power, wins, battles
router.get("/api/leaderboards", async (req, res) => {
  try {
    const { type = 'power', limit = 10 } = req.query;

    // Get top players by total power
    if (type === 'power') {
      const topPlayers = await db.select({
        user_handle: gamingPlayers.user_handle,
        total_power: gamingPlayers.total_power_level,
        army_power: gamingPlayers.army_power,
        religion_power: gamingPlayers.religion_power,
        civilization_power: gamingPlayers.civilization_power,
        economic_power: gamingPlayers.economic_power
      })
      .from(gamingPlayers)
      .orderBy(desc(gamingPlayers.total_power_level))
      .limit(Number(limit) || 10);

      return res.json({ success: true, leaderboard: topPlayers, type: 'power' });
    }

    // Get top players by battles won
    if (type === 'wins') {
      const topPlayers = await db.select({
        user_handle: squadrons.player_id,
        battles_won: sql<number>`COUNT(CASE WHEN ${battles.winner_player_id} = ${squadrons.player_id} THEN 1 END)`.as('battles_won'),
        total_battles: sql<number>`COUNT(${battles.id})`.as('total_battles')
      })
      .from(squadrons)
      .leftJoin(battles, or(
        eq(battles.creator_player_id, squadrons.player_id),
        eq(battles.opponent_player_id, squadrons.player_id)
      ))
      .groupBy(squadrons.player_id)
      .orderBy(desc(sql`COUNT(CASE WHEN ${battles.winner_player_id} = ${squadrons.player_id} THEN 1 END)`))
      .limit(Number(limit) || 10);

      return res.json({ success: true, leaderboard: topPlayers, type: 'wins' });
    }

    // Default to power leaderboard
    const topPlayers = await db.select({
      user_handle: gamingPlayers.user_handle,
      total_power: gamingPlayers.total_power_level
    })
    .from(gamingPlayers)
    .orderBy(desc(gamingPlayers.total_power_level))
    .limit(Number(limit) || 10);

    res.json({ success: true, leaderboard: topPlayers, type: 'power' });
  } catch (error: any) {
    console.error("Error fetching leaderboards:", error);
    res.status(500).json({ error: "Failed to fetch leaderboards" });
  }
});

// Get NFT detailed information with traits and power (PUBLIC + OWNER views)
router.get("/api/nfts/:tokenId/details", async (req, res) => {
  try {
    const { tokenId } = req.params;

    // Get NFT from gaming NFTs table
    const nft = await db.query.gamingNfts.findFirst({
      where: eq(gamingNfts.token_id, tokenId)
    });

    if (!nft) {
      return res.status(404).json({ error: "NFT not found" });
    }

    // Get associated gaming NFT for power attributes
    const gamingNft = await db.query.gamingNfts.findFirst({
      where: eq(gamingNfts.token_id, tokenId)
    });

    // Get power attributes
    let powerAttributes = null;
    if (gamingNft) {
      powerAttributes = await db.query.nftPowerAttributes.findFirst({
        where: eq(nftPowerAttributes.nft_id, gamingNft.id)
      });
    }

    // Check if user is owner (for enhanced data)
    // Note: Owner verification disabled as users table is not available
    // This could be implemented using wallet authentication in the future
    const isOwner = false;

    // PUBLIC data (always available)
    const nftDetail: any = {
      nft_token_id: nft.token_id,
      nft_name: nft.name || `NFT #${nft.token_id.slice(0, 8)}`,
      image_url: nft.image_url,
      current_owner: nft.owner_address,
      issuer_address: null, // Not stored in gamingNfts
      taxon: null, // Not stored in gamingNfts
      
      // Public trait data (visible to all)
      traits: nft.traits || {},
      material_type: powerAttributes?.material_type || null,
      character_class: powerAttributes?.character_class || null,
      battle_specialization: powerAttributes?.battle_specialization || null,
      
      // Public power data (visible to all)
      army_power: powerAttributes?.army_power || 0,
      religion_power: powerAttributes?.religion_power || 0,
      civilization_power: powerAttributes?.civilization_power || 0,
      economic_power: powerAttributes?.economic_power || 0,
      total_power: powerAttributes?.total_power || 0,
      material_multiplier: powerAttributes?.material_multiplier ? parseFloat(String(powerAttributes.material_multiplier)) : 1.0,
      rarity_multiplier: powerAttributes?.rarity_multiplier ? parseFloat(String(powerAttributes.rarity_multiplier)) : 1.0,
      
      is_owner: isOwner
    };

    // OWNER-ONLY data (enhanced info)
    // Note: Owner verification disabled
    // if (isOwner) {
    //   nftDetail.special_powers = powerAttributes?.special_powers || [];
    //   nftDetail.trait_mapping = powerAttributes?.trait_mapping || {};
    // }

    res.json({
      success: true,
      nft: nftDetail
    });
  } catch (error: any) {
    console.error("Error fetching NFT details:", error);
    res.status(500).json({ error: "Failed to fetch NFT details" });
  }
});

// Get player stats and history
router.get("/api/players/:handle/stats", async (req, res) => {
  try {
    const { handle } = req.params;

    // Get player data
    const player = await db.query.gamingPlayers.findFirst({
      where: eq(gamingPlayers.user_handle, handle)
    });

    if (!player) {
      return res.status(404).json({ error: "Player not found" });
    }

    // Get player's battles
    const playerBattles = await db.select()
      .from(battles)
      .where(or(
        eq(battles.creator_player_id, handle),
        eq(battles.opponent_player_id, handle)
      ))
      .orderBy(desc(battles.created_at))
      .limit(50);

    // Calculate stats
    const totalBattles = playerBattles.length;
    const battlesWon = playerBattles.filter(b => b.winner_player_id === handle).length;
    const battlesLost = playerBattles.filter(b => 
      b.status === 'completed' && b.winner_player_id && b.winner_player_id !== handle
    ).length;
    const winRate = totalBattles > 0 ? (battlesWon / totalBattles * 100).toFixed(1) : "0";

    // Get player's NFTs
    const playerNfts = await db.query.gamingNfts.findMany({
      where: eq(gamingNfts.owner_address, player.wallet_address || '')
    });

    res.json({
      success: true,
      player: {
        handle: player.user_handle,
        wallet_address: player.wallet_address,
        total_power: player.total_power_level,
        power_breakdown: {
          army_power: player.army_power,
          religion_power: player.religion_power,
          civilization_power: player.civilization_power,
          economic_power: player.economic_power
        },
        battle_stats: {
          total_battles: totalBattles,
          battles_won: battlesWon,
          battles_lost: battlesLost,
          win_rate: winRate
        },
        nfts_owned: playerNfts.length,
        recent_battles: playerBattles.slice(0, 10)
      }
    });
  } catch (error: any) {
    console.error("Error fetching player stats:", error);
    res.status(500).json({ error: "Failed to fetch player stats" });
  }
});

// Scan a specific player's NFTs and calculate their power
router.post("/api/collections/scan-player/:walletAddress", requireAuthentication, async (req: AuthenticatedRequest, res) => {
  try {
    const { walletAddress } = req.params;
    const authenticatedHandle = req.user?.handle || req.user?.userHandle;
    
    if (!authenticatedHandle) {
      return res.status(401).json({ error: "Authentication required" });
    }

    console.log(`🔍 [SCANNER API] Scanning player NFTs for ${walletAddress}`);

    const result = await scanPlayerNFTs(walletAddress, authenticatedHandle);

    res.json({
      success: result.success,
      player: authenticatedHandle,
      wallet: walletAddress,
      total_power: result.total_power,
      nfts_owned: result.nfts_owned,
      power_breakdown: result.power_breakdown
    });
  } catch (error: any) {
    console.error("Error scanning player NFTs:", error);
    res.status(500).json({ error: "Failed to scan player NFTs" });
  }
});

export default router;
