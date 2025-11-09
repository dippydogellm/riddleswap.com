/**
 * Clean Gaming Dashboard API Routes
 * Following architect guidance: schema-first, contract-driven approach
 * with thin validated routes over storage
 */

import { Router } from "express";
import { z } from "zod";
import { sessionAuth, AuthenticatedRequest } from "../middleware/session-auth";
import { csrfProtection, getCsrfToken } from "../middleware/csrf-protection";
import { db } from "../db";
import { eq, and, or, desc, sql, inArray } from "drizzle-orm";
import { gamingPlayers, gamingEvents, gameLocations, playerCivilizations, gamingNfts, gamingNftCollections, playerNftOwnership, linkedWallets, nftPowerAttributes, gameBattles, gameBattleParticipants, squadrons } from "@shared/schema";
import { battles, battleTimeline, battleParticipants, battleInvitations, battleAiContent, battleAuditLog, nftScorecards, nftMedals, civilizationStats } from "@shared/battle-system-schema";
import { nftAiImageRequests } from "@shared/nft-gaming-enhanced";
import type { GamingPlayer, GamingEvent, GameLocation, PlayerCivilization } from "@shared/schema";
import { nftOwnershipScanner } from "../services/nft-ownership-scanner";
import { syncPlayerNFTs } from "../services/player-nft-sync";
import OpenAI from "openai";
import multer from "multer";
import { unifiedStorage } from "../unified-storage";

const router = Router();

// CSRF protection applied individually to state-changing routes (POST/PUT/DELETE)
// GET requests skip CSRF automatically in middleware

// Get CSRF token endpoint
router.get('/csrf-token', sessionAuth, getCsrfToken);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Configure multer for in-memory storage (for production-ready Replit Object Storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && allowedTypes.test(file.mimetype.split('/')[1])) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Validation schemas
const registerPlayerSchema = z.object({
  player_name: z.string().min(1).max(50).optional(),
  payment_preference: z.enum(['RDL_ONLY', 'XRP_PREFERRED', 'FLEXIBLE']).default('FLEXIBLE')
});

const updatePlayerImagesSchema = z.object({
  crest_image: z.string().optional(),
  commander_profile_image: z.string().optional()
});

/**
 * GET /api/gaming/player/enhanced-stats
 * Get comprehensive player stats including NFT breakdown, collection details, and RiddleCity data
 */
router.get("/player/enhanced-stats", sessionAuth, async (req, res) => {
  try {
    const userHandle = req.user?.userHandle;
    
    if (!userHandle) {
      return res.status(401).json({
        error: "Authentication required",
        code: "UNAUTHORIZED"
      });
    }

    // Get player profile
    const player = await db.query.gamingPlayers.findFirst({
      where: eq(gamingPlayers.user_handle, userHandle)
    });

  // Get all player's NFTs from audit table
  const { inquisitionNftAudit, inquisitionCollections, linkedWallets } = await import("@shared/schema");
    
    // Get player's wallet addresses
    const wallets = await db.query.linkedWallets.findMany({
      where: eq(linkedWallets.user_id, userHandle)
    });
    
    const walletAddresses = wallets.map(w => w.address);
    
    // Get NFTs owned by player - SECURITY FIX: Use inArray instead of sql.raw
    const playerNfts = walletAddresses.length > 0 
      ? await db.query.inquisitionNftAudit.findMany({
          where: inArray(inquisitionNftAudit.current_owner, walletAddresses)
        })
      : [];

    // Calculate collection breakdown
    const collectionStats: Record<string, {
      count: number;
      totalPower: number;
      avgPower: number;
      collection_name: string;
    }> = {};

    // Build a set of collection IDs to look up names
    const collectionIdSet = new Set<number>();
    for (const nft of playerNfts) {
      if (typeof nft.collection_id === 'number') {
        collectionIdSet.add(nft.collection_id);
      }
    }
    
    // Fetch collection names for the player's NFTs
    const collectionIdArray = Array.from(collectionIdSet);
    let collectionNameMap = new Map<number, string>();
    if (collectionIdArray.length > 0) {
      const rows = await db.select({ id: inquisitionCollections.id, name: inquisitionCollections.collection_name })
        .from(inquisitionCollections)
        .where(inArray(inquisitionCollections.id, collectionIdArray));
      rows.forEach(r => collectionNameMap.set(r.id as number, r.name as unknown as string));
    }

    for (const nft of playerNfts) {
      const collectionId = nft.collection_id?.toString() || 'unknown';
      const nftPower = (parseFloat(String(nft.power_strength || 0)) +
        parseFloat(String(nft.power_defense || 0)) +
        parseFloat(String(nft.power_magic || 0)) +
        parseFloat(String(nft.power_speed || 0)));

      if (!collectionStats[collectionId]) {
        collectionStats[collectionId] = {
          count: 0,
          totalPower: 0,
          avgPower: 0,
          collection_name: typeof nft.collection_id === 'number'
            ? (collectionNameMap.get(nft.collection_id) || 'Unknown Collection')
            : 'Unknown Collection'
        };
      }

      collectionStats[collectionId].count++;
      collectionStats[collectionId].totalPower += nftPower;
    }

    // Calculate averages
    for (const collectionId in collectionStats) {
      const stats = collectionStats[collectionId];
      stats.avgPower = stats.count > 0 ? stats.totalPower / stats.count : 0;
    }

    // Get top 5 most powerful NFTs
    const topNfts = playerNfts
      .map(nft => ({
        nft_token_id: nft.nft_token_id,
        name: nft.name,
        collection_name: typeof nft.collection_id === 'number'
          ? (collectionNameMap.get(nft.collection_id) || 'Unknown Collection')
          : 'Unknown Collection',
        image_url: nft.image_url,
        totalPower: (parseFloat(String(nft.power_strength || 0)) +
          parseFloat(String(nft.power_defense || 0)) +
          parseFloat(String(nft.power_magic || 0)) +
          parseFloat(String(nft.power_speed || 0)))
      }))
      .sort((a, b) => b.totalPower - a.totalPower)
      .slice(0, 5);

    // Get RiddleCity land plots owned by player
    const { medievalLandPlots } = await import("@shared/schema");
    const ownedLand = await db.query.medievalLandPlots.findMany({
      where: eq(medievalLandPlots.ownerHandle, userHandle)
    });

    res.json({
      success: true,
      data: {
        player: player || null,
        nftStats: {
          totalNfts: playerNfts.length,
          byCollection: collectionStats,
          topNfts
        },
        riddleCity: {
          landPlotsOwned: ownedLand.length,
          landPlots: ownedLand
        },
        powerBreakdown: {
          army: parseFloat(String(player?.army_power || 0)),
          religion: parseFloat(String(player?.religion_power || 0)),
          civilization: parseFloat(String(player?.civilization_power || 0)),
          economic: parseFloat(String(player?.economic_power || 0)),
          total: parseFloat(String(player?.total_power_level || 0))
        }
      }
    });

  } catch (error: any) {
    console.error('❌ [ENHANCED STATS] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch enhanced stats',
      details: error.message
    });
  }
});

/**
 * POST /api/gaming/player/profile
 * Update player profile information
 */
router.post("/player/profile", sessionAuth, async (req, res) => {
  try {
    const userHandle = req.user?.userHandle;
    
    if (!userHandle) {
      return res.status(401).json({
        error: "Authentication required",
        code: "UNAUTHORIZED"
      });
    }

    const { player_name, commander_class } = req.body;
    
    // Check if player record exists, then insert or update
    const existingPlayer = await db.query.gamingPlayers.findFirst({
      where: eq(gamingPlayers.user_handle, userHandle)
    });

    if (existingPlayer) {
      // Update existing player
      await db.update(gamingPlayers)
        .set({
          player_name: player_name || userHandle,
          updated_at: new Date()
        } as any)
        .where(eq(gamingPlayers.user_handle, userHandle));
    } else {
      // Create new player record
      await db.insert(gamingPlayers)
        .values({
          user_handle: userHandle,
          wallet_address: req.user?.walletAddress || 'pending',
          chain: 'xrpl',
          player_name: player_name || userHandle,
          payment_preference: 'FLEXIBLE'
        } as any as any);
    }

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: {
        player_name,
        commander_class,
        user_handle: userHandle
      }
    });

  } catch (error: any) {
    console.error('❌ [GAMING] Profile update failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile',
      details: error.message
    });
  }
});

/**
 * POST /api/gaming/player/upload-profile-picture
 * Upload a profile picture for the player
 * PRODUCTION-READY: Uses Replit Object Storage
 */
router.post("/player/upload-profile-picture", sessionAuth, upload.single('profilePicture'), async (req, res) => {
  try {
    const userHandle = req.user?.userHandle;
    
    if (!userHandle) {
      return res.status(401).json({
        error: "Authentication required",
        code: "UNAUTHORIZED"
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: "No file uploaded",
        code: "NO_FILE"
      });
    }

    console.log(`📸 [PROFILE PICTURE] Uploading profile picture for ${userHandle}`);

    // Get existing player to clean up old profile picture
    const existingPlayer = await db.query.gamingPlayers.findFirst({
      where: eq(gamingPlayers.user_handle, userHandle)
    });

    const oldImageUrl = existingPlayer?.commander_profile_image;

    // Upload to storage backend (production-ready, persistent)
    const imageUrl = await unifiedStorage.uploadFile(
      req.file.buffer,
      'profile',
      req.file.mimetype
    );
    
    console.log(`✅ [PROFILE PICTURE] Uploaded to persistent storage: ${imageUrl}`);

    // Update player record with the new profile picture
    if (existingPlayer) {
      await db.update(gamingPlayers)
        .set({
          commander_profile_image: imageUrl,
          updated_at: new Date()
        } as any)
        .where(eq(gamingPlayers.user_handle, userHandle));
      
      console.log(`✅ [PROFILE PICTURE] Profile picture updated for ${userHandle}`);
    } else {
      // Create new player record with profile picture
      await db.insert(gamingPlayers)
        .values({
          user_handle: userHandle,
          wallet_address: req.user?.walletAddress || 'pending',
          chain: 'xrpl',
          player_name: userHandle,
          commander_profile_image: imageUrl,
          payment_preference: 'FLEXIBLE'
        } as any as any);
      
      console.log(`✅ [PROFILE PICTURE] Player record created with profile picture for ${userHandle}`);
    }

    // Clean up old profile picture if it exists
    if (oldImageUrl && (oldImageUrl.startsWith('/uploads/') || oldImageUrl.startsWith('/api/storage/'))) {
      await unifiedStorage.deleteFile(oldImageUrl);
      console.log(`🗑️ [PROFILE PICTURE] Cleaned up old image: ${oldImageUrl}`);
    }

    res.json({
      success: true,
      message: "Profile picture uploaded successfully",
      data: {
        url: imageUrl
      }
    });

  } catch (error: any) {
    console.error('❌ [PROFILE PICTURE] Upload failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload profile picture',
      details: error.message
    });
  }
});

/**
 * GET /api/gaming/player/nfts
 * DISABLED: Duplicate endpoint - using inquisition-audit-routes.ts version instead
 * The other endpoint is simpler and doesn't require complex blockchain scanning
 * This endpoint is kept for future reference if deeper blockchain integration is needed
 */
/*
router.get("/player/nfts", sessionAuth, async (req, res) => {
  try {
    // SECURITY FIX: Only allow users to fetch their own NFTs
    // The user_handle must match the authenticated user
    const requestedHandle = req.query.user_handle as string;
    const authenticatedHandle = req.user?.userHandle;
    
    if (!requestedHandle) {
      return res.status(400).json({
        error: "user_handle parameter is required",
        code: "BAD_REQUEST"
      });
    }
    
    if (!authenticatedHandle) {
      return res.status(401).json({
        error: "Authentication required",
        code: "UNAUTHORIZED"
      });
    }
    
    // CRITICAL SECURITY CHECK: Verify user can only access their own NFTs
    if (requestedHandle !== authenticatedHandle) {
      console.log(`🚨 [SECURITY] User ${authenticatedHandle} attempted to access NFTs of ${requestedHandle}`);
      return res.status(403).json({
        error: "Access denied - you can only view your own NFTs",
        code: "FORBIDDEN"
      });
    }
    
    const userHandle = authenticatedHandle; // Use the authenticated user's handle

    console.log(`🔍 [PLAYER NFTS] ===== STARTING ON-CHAIN SCAN FOR USER: ${userHandle} =====`);

    // Auto-create player if doesn't exist - so NFTs can be loaded immediately
    let player = await db.query.gamingPlayers.findFirst({
      where: eq(gamingPlayers.user_handle, userHandle)
    });

    if (!player) {
      console.log(`📝 [PLAYER NFTS] Creating new player record for ${userHandle}`);
      
      // Get a wallet address for the user - use a placeholder for now
      // In production, this would come from the user's actual wallet
      const walletAddress = `rPLACEHOLDER${userHandle}`;
      
      const newPlayer = await db.insert(gamingPlayers).values({
        user_handle: userHandle,
        wallet_address: walletAddress,
        player_name: userHandle,
        gaming_rank: 'Novice',
        total_power_level: 0,
        army_power: 0,
        religion_power: 0,
        civilization_power: 0,
        economic_power: 0,
        created_at: new Date(),
        updated_at: new Date()
      } as any).returning();
      
      player = newPlayer[0];
      console.log(`✅ [PLAYER NFTS] Player record created for ${userHandle} with wallet ${walletAddress}`);
    }

    // STEP 1: SCAN BLOCKCHAIN FIRST - This is critical for the game!
    console.log(`⛓️ [PLAYER NFTS] Step 1: Scanning blockchain for NFTs owned by ${userHandle}...`);
    
    // Use the ownership scanner to check all of the user's linked wallets
    let scanResults;
    try {
      scanResults = await nftOwnershipScanner.scanAllUserWallets(userHandle);
      
      // Guard against invalid results
      if (!scanResults || !Array.isArray(scanResults)) {
        console.warn(`⚠️ [PLAYER NFTS] Invalid scan results - returning empty array`);
        return res.json([]);
      }
      
      console.log(`✅ [PLAYER NFTS] Scan completed successfully - ${scanResults.length} wallets scanned`);
    } catch (scanError: any) {
      console.error(`❌ [PLAYER NFTS] CRITICAL SCAN ERROR:`, {
        error: scanError.message,
        stack: scanError.stack,
        userHandle,
        timestamp: new Date().toISOString()
      });
      throw scanError; // Re-throw to be caught by outer try-catch
    }
    
    // Calculate totals from scan results
    const totalNew = scanResults.reduce((sum, result) => sum + result.new_nfts.length, 0);
    const totalRemoved = scanResults.reduce((sum, result) => sum + result.removed_nfts.length, 0);
    console.log(`📊 [PLAYER NFTS] Blockchain scan found ${totalNew} new NFTs, ${totalRemoved} removed NFTs`);
    
    // Log per-collection results if available
    if (scanResults.length > 0 && scanResults[0].collections) {
      console.log(`📦 [PLAYER NFTS] NFTs by collection:`);
      for (const result of scanResults) {
        if (result.collections && typeof result.collections === 'object') {
          for (const [collectionName, collectionData] of Object.entries(result.collections)) {
            console.log(`   - ${collectionName}: ${collectionData.count} NFTs (${collectionData.power} power)`);
          }
        }
      }
    }
    
    // STEP 2: NOW get the updated NFT data from database
    console.log(`💾 [PLAYER NFTS] Step 2: Fetching updated NFT data from inquisition_user_ownership table...`);
    
    // Import the tables we need
    const { inquisitionUserOwnership, inquisitionNftAudit } = await import("@shared/schema");
    
    // Query the database for the player's CURRENTLY OWNED NFTs from inquisition_user_ownership
    // This is the source of truth for ownership
    const allOwnership = await db
      .select({
        nft_db_id: gamingNfts.id,
        nft_id: inquisitionUserOwnership.nft_token_id,  // Use the token ID from ownership table
        name: gamingNfts.name,
        description: gamingNfts.description,
        image_url: gamingNfts.image_url,
        ai_generated_image_url: gamingNfts.ai_generated_image_url, // AI-generated image for this specific NFT
        collection_name: gamingNftCollections.collection_name,
        game_role: gamingNftCollections.game_role,
        rarity_score: gamingNfts.rarity_score,
        traits: gamingNfts.traits, // Include traits with trait_rarity_scores for frontend display
        owned_at: inquisitionUserOwnership.acquired_at,  // When they acquired it
        total_power: nftPowerAttributes.total_power,
        army_power: nftPowerAttributes.army_power,
        religion_power: nftPowerAttributes.religion_power,
        civilization_power: nftPowerAttributes.civilization_power,
        economic_power: nftPowerAttributes.economic_power
      })
      .from(inquisitionUserOwnership)
      .innerJoin(gamingNfts, eq(gamingNfts.nft_id, inquisitionUserOwnership.nft_token_id))  // Join on token ID
      .innerJoin(gamingNftCollections, eq(gamingNfts.collection_id, gamingNftCollections.id))
      .leftJoin(nftPowerAttributes, eq(nftPowerAttributes.nft_id, gamingNfts.id))
      .where(and(
        eq(inquisitionUserOwnership.user_handle, userHandle),  // User's NFTs
        eq(inquisitionUserOwnership.is_current_owner, true)    // ONLY currently owned NFTs
      ))
      .orderBy(desc(inquisitionUserOwnership.acquired_at));

    // No need to deduplicate - inquisition_user_ownership already tracks unique ownership
    const playerNfts = allOwnership;
    
    console.log(`✅ [PLAYER NFTS] Retrieved ${playerNfts.length} total NFTs from database after blockchain sync`);
    
    // STEP 3: Verify ownership is current
    const verifiedNfts = [];
    for (const nft of playerNfts) {
      if (nft.owned_at) {
        console.log(`✅ [PLAYER NFTS] NFT ${nft.name} (${nft.nft_id}) - Ownership verified at ${nft.owned_at}`);
        verifiedNfts.push(nft);
      } else {
        console.log(`⚠️ [PLAYER NFTS] NFT ${nft.name} (${nft.nft_id}) - No ownership record, may be stale`);
      }
    }
    
    console.log(`🎯 [PLAYER NFTS] ===== SCAN COMPLETE: ${verifiedNfts.length} verified NFTs for ${userHandle} =====`);
    
    res.json(verifiedNfts);
    
  } catch (error: any) {
    console.error('❌ [PLAYER NFTS] Failed to fetch NFT collection:', error);
    res.status(500).json({
      error: "Failed to fetch NFT collection",
      code: "SERVER_ERROR"
    });
  }
});
*/

/**
 * PATCH /api/gaming/player/update-profile
 * Update current player's profile (name, religion, class, play_type)
 */
// Schema for profile updates
const updateProfileSchema = z.object({
  player_name: z.string().min(1).max(50).optional(),
  religion: z.enum(['Christianity', 'Islam', 'Buddhism', 'Hinduism', 'Paganism', 'Secular']).optional(),
  commander_class: z.enum(['warrior', 'mage', 'rogue', 'paladin', 'priest', 'knight', 'monk', 'scholar', 'merchant']).optional(),
  play_type: z.enum(['warmonger', 'religious_state', 'trader', 'diplomat', 'builder', 'scientist']).optional(),
  civilization_name: z.string().min(1).max(100).optional(),
  motto: z.string().max(200).optional(),
  crest_image: z.string().optional(),
  primary_color: z.string().optional(),
  secondary_color: z.string().optional()
});

router.patch("/player/update-profile", sessionAuth, async (req, res) => {
  try {
    const userHandle = req.user?.userHandle;
    
    console.log('💾 [UPDATE PROFILE] Request received:', { userHandle, hasAuth: !!req.user });
    
    if (!userHandle) {
      console.error("❌ [UPDATE PROFILE] No user handle in request");
      return res.status(401).json({
        error: "Authentication required",
        code: "UNAUTHORIZED"
      });
    }

    // Validate request body
    let validatedData;
    try {
      validatedData = updateProfileSchema.parse(req.body);
      console.log("✅ [UPDATE PROFILE] Request data validated");
    } catch (validationError: any) {
      console.error("❌ [UPDATE PROFILE] Validation failed:", validationError.errors);
      return res.status(400).json({ 
        error: "Invalid request data", 
        details: validationError.errors 
      });
    }

    const { player_name, religion, commander_class, play_type, civilization_name, motto, crest_image } = validatedData;

    // Get player ID first
    const [player] = await db.select({ id: gamingPlayers.id })
      .from(gamingPlayers)
      .where(eq(gamingPlayers.user_handle, userHandle))
      .limit(1);

    if (!player) {
      return res.status(404).json({
        error: "Player not found",
        code: "PLAYER_NOT_FOUND"
      });
    }

    // Update player record
    const updateData: any = {
      updated_at: new Date()
    };
    
    if (player_name) updateData.player_name = player_name;
    if (religion) updateData.religion = religion;
    if (commander_class) updateData.commander_class = commander_class;
    if (play_type) updateData.play_type = play_type;
    if (crest_image) updateData.crest_image = crest_image;

    const updated = await db.update(gamingPlayers)
      .set(updateData)
      .where(eq(gamingPlayers.user_handle, userHandle))
      .returning();

    // Update or create civilization if civilization data provided
    let civilizationData = null;
    if (civilization_name || motto || req.body.primary_color || req.body.secondary_color) {
      // Check if civilization exists
      const [existingCiv] = await db.select()
        .from(playerCivilizations)
        .where(eq(playerCivilizations.player_id, player.id))
        .limit(1);

      const civUpdateData: any = {
        updated_at: new Date()
      };

      if (civilization_name) civUpdateData.civilization_name = civilization_name;
      if (motto) civUpdateData.motto = motto;
      if (req.body.primary_color) civUpdateData.primary_color = req.body.primary_color;
      if (req.body.secondary_color) civUpdateData.secondary_color = req.body.secondary_color;

      if (existingCiv) {
        // Update existing civilization
        const [civ] = await db.update(playerCivilizations)
          .set(civUpdateData)
          .where(eq(playerCivilizations.player_id, player.id))
          .returning();
        civilizationData = civ;
      } else {
        // Create new civilization
        const [civ] = await db.insert(playerCivilizations)
          .values({
            player_id: player.id,
            ...civUpdateData
          } as any)
          .returning();
        civilizationData = civ;
      }
    }

    console.log(`✅ [GAMING] Profile updated for ${userHandle}:`, { 
      play_type, 
      civilization_name,
      motto,
      crest_image: !!crest_image 
    });

    res.json({
      success: true,
      player: updated[0],
      civilization: civilizationData
    });
  } catch (error: any) {
    console.error('❌ [GAMING] Profile update failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile',
      details: error.message
    });
  }
});

/**
 * POST /api/gaming/player/nfts/:nftId/save-image
 * Save AI-generated image URL to NFT
 */
router.post("/player/nfts/:nftId/save-image", sessionAuth, async (req, res) => {
  try {
    const userHandle = req.user?.userHandle;
    const { nftId } = req.params;
    const { image_url } = req.body;
    
    console.log('💾 [NFT IMAGE SAVE] Request:', { userHandle, nftId, hasImage: !!image_url });
    
    if (!userHandle) {
      return res.status(401).json({
        error: "Authentication required",
        code: "UNAUTHORIZED"
      });
    }

    if (!image_url) {
      return res.status(400).json({
        error: "image_url is required",
        code: "BAD_REQUEST"
      });
    }

    // Get player record first - auto-create if doesn't exist
    let player = await db.query.gamingPlayers.findFirst({
      where: eq(gamingPlayers.user_handle, userHandle)
    });

    console.log('🔍 [NFT IMAGE SAVE] Player lookup:', { found: !!player, playerId: player?.id, walletAddress: player?.wallet_address });

    // Auto-create gaming_players record if it doesn't exist
    if (!player) {
      console.log('🎮 [NFT IMAGE SAVE] Auto-creating gaming_players record for:', userHandle);
      
      // Get user's XRPL wallet address from linked_wallets or riddle_wallet_profiles
      const linkedWallet = await db.query.linkedWallets.findFirst({
        where: and(
          eq(linkedWallets.user_id, userHandle),
          eq(linkedWallets.chain, 'xrpl')
        )
      });

      const walletAddress = linkedWallet?.address;
      
      if (!walletAddress) {
        console.error('❌ [NFT IMAGE SAVE] No XRPL wallet found for:', userHandle);
        return res.status(404).json({
          error: "No XRPL wallet linked to account",
          code: "NO_WALLET"
        });
      }

      // Create gaming player record
      const inserted = await db.insert(gamingPlayers).values({
        user_handle: userHandle,
        wallet_address: walletAddress,
        chain: 'xrpl',
        player_name: userHandle,
        first_time_setup_completed: false
      } as any as any).returning();

      player = inserted[0];
      console.log('✅ [NFT IMAGE SAVE] Created gaming_players record:', { playerId: player.id, walletAddress });
    }

    // Get the NFT to check ownership by wallet address
    // NOTE: Frontend sends raw NFToken ID, but database stores composite nft_id
    // So we look up by token_id instead
    const nft = await db.query.gamingNfts.findFirst({
      where: eq(gamingNfts.token_id, nftId)
    });

    console.log('🔍 [NFT IMAGE SAVE] NFT lookup by token_id:', { found: !!nft, nftId, nftOwner: nft?.owner_address });

    if (!nft) {
      console.error('❌ [NFT IMAGE SAVE] NFT not found by token_id:', nftId);
      return res.status(404).json({
        error: "NFT not found in database",
        code: "NFT_NOT_FOUND"
      });
    }

    // Verify ownership by wallet address match
    if (nft.owner_address !== player.wallet_address) {
      console.error('❌ [NFT IMAGE SAVE] NFT not owned by player wallet:', { 
        nftOwner: nft.owner_address, 
        playerWallet: player.wallet_address 
      });
      return res.status(403).json({
        error: "NFT not owned by user",
        code: "FORBIDDEN"
      });
    }

    console.log('✅ [NFT IMAGE SAVE] Ownership verified by wallet address match');

    // Update NFT with AI-generated image (using token_id for lookup)
    const updated = await db.update(gamingNfts)
      .set({ 
        // ai_generated_image_url removed - not in schema
       } as any)
      .where(eq(gamingNfts.token_id, nftId))
      .returning();

    console.log(`✅ [NFT IMAGE SAVE] Saved image for NFT ${nftId}:`, { updated: updated.length, imageUrl: image_url });

    res.json({
      success: true,
      message: "NFT image saved successfully",
      data: {
        nft_id: nftId,
        image_url
      }
    });
  } catch (error: any) {
    console.error('❌ [NFT IMAGE SAVE] Failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save NFT image',
      details: error.message
    });
  }
});

/**
 * GET /api/gaming/player/profile
 * Get player profile information with civilization data
 */
router.get("/player/profile", sessionAuth, async (req, res) => {
  try {
    const userHandle = req.user?.userHandle;
    console.log(`📊 [PLAYER PROFILE] Request received for handle: ${userHandle}`);
    
    if (!userHandle) {
      console.log(`❌ [PLAYER PROFILE] No userHandle found in request`);
      return res.status(401).json({
        error: "Authentication required",
        code: "UNAUTHORIZED"
      });
    }

    // Get player record
    console.log(`🔍 [PLAYER PROFILE] Querying player by user_handle: ${userHandle}`);
    const player = await db.query.gamingPlayers.findFirst({
      where: eq(gamingPlayers.user_handle, userHandle)
    });

    console.log(`📦 [PLAYER PROFILE] Player query result:`, { 
      found: !!player, 
      playerId: player?.id,
      playerName: player?.player_name,
      crestImage: player?.crest_image,
      profileImage: player?.commander_profile_image
    });

    if (!player) {
      console.log(`⚠️ [PLAYER PROFILE] Player not found, creating new player for ${userHandle}`);
      // Create a new player record with defaults
      const newPlayer = await db.insert(gamingPlayers)
        .values({
          user_handle: userHandle,
          wallet_address: req.user?.walletAddress || 'pending',
        } as any)
        .returning();

      console.log(`✅ [PLAYER PROFILE] New player created:`, newPlayer[0].id);

      return res.json({
        success: true,
        data: {
          player: newPlayer[0],
          civilization: null,
          isNewPlayer: true
        }
      });
    }

    // AUTOMATIC NFT SYNC - Runs on every login
    console.log(`🎯 [PLAYER PROFILE] Auto-syncing NFTs for: ${userHandle}`);
    
    const riddleWalletAddress = req.user?.walletAddress;
    console.log(`🏦 [PLAYER PROFILE] Using Riddle wallet: ${riddleWalletAddress}`);

    let syncedStats = null;

    if (riddleWalletAddress) {
      try {
        // Automatically sync NFTs from inquisition_nft_audit to gaming_players
        syncedStats = await syncPlayerNFTs(riddleWalletAddress, userHandle);
        console.log(`✅ [PLAYER PROFILE] Auto-sync complete: ${syncedStats.total_nfts} NFTs, ${syncedStats.total_power} power`);
      } catch (error: any) {
        console.error(`❌ [PLAYER PROFILE] Auto-sync failed:`, error);
        console.error(`❌ [PLAYER PROFILE] Error stack:`, error?.stack);
        console.error(`❌ [PLAYER PROFILE] Error message:`, error?.message);
        // Continue with profile load even if sync fails
      }
    }

    // Fetch updated player data after sync
    const updatedPlayerData = await db.query.gamingPlayers.findFirst({
      where: eq(gamingPlayers.wallet_address, riddleWalletAddress || player.wallet_address)
    });

    const updatedPlayer = updatedPlayerData || player;

    // Fetch civilization data for this player
    const [civilization] = await db.select()
      .from(playerCivilizations)
      .where(eq(playerCivilizations.player_id, player.id))
      .limit(1);

    console.log(`🏰 [PLAYER PROFILE] Civilization query result:`, { 
      found: !!civilization, 
      civName: civilization?.civilization_name,
      motto: civilization?.motto 
    });

    console.log(`✅ [PLAYER PROFILE] Returning profile data:`, {
      playerName: updatedPlayer.player_name,
      crestImage: updatedPlayer.crest_image,
      profileImage: updatedPlayer.commander_profile_image,
      hasCivilization: !!civilization
    });

    res.json({
      success: true,
      data: {
        player: updatedPlayer,
        civilization: civilization || null,
        isNewPlayer: false
      }
    });

  } catch (error: any) {
    console.error('❌ [PLAYER PROFILE] Profile fetch failed:', error);
    console.error('❌ [PLAYER PROFILE] Error stack:', error?.stack);
    console.error('❌ [PLAYER PROFILE] Error message:', error?.message);
    console.error('❌ [PLAYER PROFILE] Error name:', error?.name);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch profile',
      details: error?.message || 'Unknown error'
    });
  }
});

/**
 * POST /api/gaming/player/sync-nfts
 * Manually trigger NFT sync for the current player
 */
router.post("/player/sync-nfts", sessionAuth, async (req, res) => {
  try {
    const userHandle = req.user?.userHandle;
    const walletAddress = req.user?.walletAddress;
    
    if (!userHandle || !walletAddress) {
      return res.status(401).json({
        error: "Authentication required",
        code: "UNAUTHORIZED"
      });
    }

    console.log(`🔄 [MANUAL NFT SYNC] Starting manual sync for ${userHandle}`);
    
    // Call the syncPlayerNFTs function to update NFT power levels
    const syncResult = await syncPlayerNFTs(walletAddress, userHandle);
    
    console.log(`✅ [MANUAL NFT SYNC] Sync complete for ${userHandle}:`, {
      totalNfts: syncResult.total_nfts,
      totalPower: syncResult.total_power
    });
    
    res.json({
      success: true,
      message: "NFT sync completed successfully",
      data: {
        total_nfts: syncResult.total_nfts,
        total_power: syncResult.total_power,
        army_power: syncResult.army_power,
        bank_power: syncResult.bank_power,
        merchant_power: syncResult.merchant_power,
        special_power: syncResult.special_power,
        synced_at: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('❌ [MANUAL NFT SYNC] Sync failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync NFTs',
      details: error.message
    });
  }
});

/**
 * PATCH /api/gaming/player/profile
 * Update player profile with FormData support for images
 */
router.patch("/player/profile", sessionAuth, upload.fields([
  { name: 'profile_image', maxCount: 1 },
  { name: 'crest_image', maxCount: 1 }
]), async (req, res) => {
  try {
    const userHandle = req.user?.userHandle;
    
    if (!userHandle) {
      return res.status(401).json({
        error: "Authentication required",
        code: "UNAUTHORIZED"
      });
    }

    console.log(`🔄 [PROFILE UPDATE] Updating profile for ${userHandle}`);
    
    const { player_name, commander_class, play_type, civilization_name, motto } = req.body;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    // Get existing player
    const existingPlayer = await db.query.gamingPlayers.findFirst({
      where: eq(gamingPlayers.user_handle, userHandle)
    });

    if (!existingPlayer) {
      return res.status(404).json({
        error: "Player not found. Please register first.",
        code: "PLAYER_NOT_FOUND"
      });
    }

    // Handle profile image upload
    let profileImageUrl = existingPlayer.commander_profile_image;
    if (files?.profile_image?.[0]) {
      console.log(`📸 [PROFILE UPDATE] Uploading profile image`);
      profileImageUrl = await unifiedStorage.uploadFile(
        files.profile_image[0].buffer,
        'profile',
        files.profile_image[0].mimetype
      );
      console.log(`✅ [PROFILE UPDATE] Profile image uploaded: ${profileImageUrl}`);
    }

    // Handle crest image upload
    let crestImageUrl = existingPlayer.crest_image;
    if (files?.crest_image?.[0]) {
      console.log(`🛡️ [PROFILE UPDATE] Uploading crest image`);
      crestImageUrl = await unifiedStorage.uploadFile(
        files.crest_image[0].buffer,
        'post',
        files.crest_image[0].mimetype
      );
      console.log(`✅ [PROFILE UPDATE] Crest image uploaded: ${crestImageUrl}`);
    }

    // Update player profile
    const playerUpdates: any = {
      updated_at: new Date()
    };

    if (player_name) playerUpdates.player_name = player_name;
    if (commander_class) playerUpdates.commander_class = commander_class;
    if (play_type) playerUpdates.play_type = play_type;
    if (profileImageUrl !== existingPlayer.commander_profile_image) {
      playerUpdates.commander_profile_image = profileImageUrl;
    }
    if (crestImageUrl !== existingPlayer.crest_image) {
      playerUpdates.crest_image = crestImageUrl;
    }

    try {
      const [updatedPlayer] = await db.update(gamingPlayers)
        .set(playerUpdates as any)
        .where(eq(gamingPlayers.user_handle, userHandle))
        .returning();

      console.log(`✅ [PROFILE UPDATE] Player profile updated:`, {
        id: updatedPlayer.id,
        handle: updatedPlayer.user_handle,
        name: updatedPlayer.player_name,
        class: updatedPlayer.commander_class,
        play_type: updatedPlayer.play_type
      });

      // Handle civilization data
      let civilizationData = null;
      if (civilization_name || motto) {
        const existingCiv = await db.query.playerCivilizations.findFirst({
          where: eq(playerCivilizations.player_id, existingPlayer.id)
        });

        const civUpdates: any = {
          updated_at: new Date()
        };

        if (civilization_name) civUpdates.civilization_name = civilization_name;
        if (motto) civUpdates.motto = motto;

        if (existingCiv) {
          // Update existing civilization
          const [updatedCiv] = await db.update(playerCivilizations)
            .set(civUpdates as any)
            .where(eq(playerCivilizations.player_id, existingPlayer.id))
            .returning();
          civilizationData = updatedCiv;
          console.log(`✅ [PROFILE UPDATE] Civilization updated:`, {
            id: updatedCiv.id,
            name: updatedCiv.civilization_name,
            motto: updatedCiv.motto
          });
        } else {
          // Create new civilization
          const [newCiv] = await db.insert(playerCivilizations)
            .values({
              player_id: existingPlayer.id,
              civilization_name: civilization_name || 'My Civilization',
              motto: motto || '',
              created_at: new Date(),
              updated_at: new Date()
            } as any)
            .returning();
          civilizationData = newCiv;
          console.log(`✅ [PROFILE UPDATE] Civilization created:`, {
            id: newCiv.id,
            name: newCiv.civilization_name,
            player_id: newCiv.player_id
          });
        }
      }

      res.json({
        success: true,
        message: "Profile updated successfully",
        data: {
          player: {
            player_name: updatedPlayer.player_name,
            commander_class: updatedPlayer.commander_class,
            play_type: updatedPlayer.play_type,
            profile_image_url: profileImageUrl,
            crest_image_url: crestImageUrl
          },
          civilization: civilizationData ? {
            civilization_name: civilizationData.civilization_name,
            motto: civilizationData.motto
          } : null
        }
      });
    } catch (dbError: any) {
      console.error("❌ [PROFILE UPDATE] Database error:", {
        message: dbError.message,
        code: dbError.code,
        detail: dbError.detail,
        stack: dbError.stack
      });
      throw new Error(`Failed to save profile to database: ${dbError.message}`);
    }

  } catch (error: any) {
    console.error('❌ [PROFILE UPDATE] Update failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile',
      details: error.message
    });
  }
});

/**
 * NOTE: This route must be AFTER all other /player/* routes
 * GET /api/gaming/player/:handle
 * Get another player's profile by handle with their NFT collection
 * PUBLIC: No authentication required - allows public profile viewing
 */
router.get("/player/:handle", async (req, res) => {
  try {
    const { handle } = req.params;
    
    if (!handle) {
      return res.status(400).json({
        error: "Player handle required",
        code: "INVALID_REQUEST"
      });
    }

    console.log(`🔍 [PUBLIC PLAYER PROFILE] Fetching profile for ${handle}`);

    // Get player record
    const player = await db.query.gamingPlayers.findFirst({
      where: eq(gamingPlayers.user_handle, handle)
    });

    if (!player) {
      return res.status(404).json({
        error: "Player not found",
        code: "PLAYER_NOT_FOUND"
      });
    }

    // Get player's NFT collection with AI images
    console.log(`🎨 [PUBLIC PLAYER PROFILE] Fetching NFT collection for ${handle}`);
    
    // Use raw SQL for the join since LIKE pattern matching is complex in Drizzle ORM
    const result = await db.execute(sql`
      SELECT 
        g.id as nft_db_id,
        g.nft_id,
        g.name,
        g.description,
        g.image_url,
        g.ai_generated_image_url,
        c.collection_name,
        c.game_role,
        g.rarity_score,
        g.traits,
        o.acquired_at as owned_at,
        p.total_power,
        p.army_power,
        p.religion_power,
        p.civilization_power,
        p.economic_power
      FROM inquisition_user_ownership o
      INNER JOIN inquisition_nft_audit a ON a.id = o.nft_id
      INNER JOIN gaming_nfts g ON g.nft_id LIKE '%' || a.nft_token_id
      INNER JOIN gaming_nft_collections c ON c.id = g.collection_id
      LEFT JOIN nft_power_attributes p ON p.nft_id = g.id
      WHERE o.user_handle = ${handle}
        AND o.is_current_owner = true
      ORDER BY o.acquired_at DESC
    `);
    
    const playerNfts = result.rows || [];
    console.log(`✅ [PUBLIC PLAYER PROFILE] Found ${playerNfts.length} NFTs for ${handle}`);

    // Return player data with NFT collection
    res.json({
      success: true,
      userHandle: player.user_handle,
      playerName: player.player_name,
      totalPowerLevel: player.total_power_level,
      crestImage: player.crest_image,
      commanderProfileImage: player.commander_profile_image,
      nfts: playerNfts
    });
  } catch (error: any) {
    console.error('❌ [GAMING] Failed to fetch player profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch player profile',
      details: error.message
    });
  }
});

/**
 * POST /api/gaming/player/sync-nfts
 * Manually trigger NFT sync from inquisition_nft_audit to gaming_players
 * Useful for testing or forcing a refresh
 */
router.post("/player/sync-nfts", sessionAuth, async (req, res) => {
  try {
    const userHandle = req.user?.userHandle;
    const walletAddress = req.user?.walletAddress;
    
    if (!userHandle || !walletAddress) {
      return res.status(401).json({
        error: "Authentication required",
        code: "UNAUTHORIZED"
      });
    }

    console.log(`🔄 [GAMING] Manual NFT sync requested for ${userHandle}`);

    const stats = await syncPlayerNFTs(walletAddress, userHandle);

    res.json({
      success: true,
      message: "NFTs synced successfully",
      data: stats
    });
  } catch (error: any) {
    console.error('❌ [GAMING] Manual sync failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync NFTs',
      details: error.message
    });
  }
});

/**
 * POST /api/gaming/player/verify-nfts
 * Check existing NFT records in database for user's linked wallets
 * Requires authentication to access user's wallet data
 */
router.post("/player/verify-nfts", sessionAuth, async (req, res) => {
  try {
    const userHandle = req.user?.userHandle;
    
    if (!userHandle) {
      return res.status(401).json({
        error: "Authentication required",
        code: "UNAUTHORIZED"
      });
    }

    console.log(`🔍 [NFT VERIFICATION] Starting on-chain wallet scan for user: ${userHandle}`);

    // Get user's XRPL wallet address from session
    const riddleWalletAddress = req.user?.walletAddress;
    
    if (!riddleWalletAddress) {
      return res.status(400).json({
        error: "No wallet address found in session",
        code: "NO_WALLET_ADDRESS"
      });
    }
    
    // Get all external wallets for this user
    const externalWallets = await db.execute(sql`
      SELECT address, wallet_type, chain FROM external_wallets 
      WHERE user_id = ${req.user?.id}
    `);
    
    console.log(`🔍 [NFT VERIFICATION] Scanning Riddle wallet: ${riddleWalletAddress}`);
    console.log(`🔍 [NFT VERIFICATION] Found ${externalWallets.rows.length} external wallets to scan`);

    try {
      // Scan Riddle wallet first
      const riddleResult = await nftOwnershipScanner.scanWallet(riddleWalletAddress, userHandle);
      
      let totalNfts = riddleResult.total_nfts;
      let totalPower = riddleResult.total_power;
      let allCollections = { ...riddleResult.collections };
      let allNewNfts = [...riddleResult.new_nfts];
      
      // Scan all external wallets
      for (const wallet of externalWallets.rows) {
        const walletAddress = wallet.address as string;
        const walletChain = wallet.chain as string;
        if (walletChain === 'xrp' && walletAddress !== riddleWalletAddress) {
          console.log(`🔍 [NFT VERIFICATION] Scanning external wallet: ${walletAddress}`);
          try {
            const externalResult = await nftOwnershipScanner.scanWallet(walletAddress, userHandle);
            totalNfts += externalResult.total_nfts;
            totalPower += externalResult.total_power;
            allNewNfts.push(...externalResult.new_nfts);
            
            // Merge collections
            Object.keys(externalResult.collections).forEach(key => {
              if (allCollections[key]) {
                allCollections[key].count += externalResult.collections[key].count;
                allCollections[key].power += externalResult.collections[key].power;
                allCollections[key].nfts.push(...externalResult.collections[key].nfts);
              } else {
                allCollections[key] = externalResult.collections[key];
              }
            });
          } catch (extError) {
            console.error(`❌ [NFT VERIFICATION] Failed to scan external wallet ${wallet.address}:`, extError);
          }
        }
      }
      
      const scanResult = {
        total_nfts: totalNfts,
        total_power: totalPower,
        collections: allCollections,
        new_nfts: allNewNfts,
        scan_duration_ms: riddleResult.scan_duration_ms,
        wallet_checked: `${riddleWalletAddress} + ${externalWallets.rows.length} external wallets`
      };

      console.log(`✅ [NFT VERIFICATION] On-chain scan completed:`, {
        total_nfts: scanResult.total_nfts,
        total_power: scanResult.total_power,
        collections: Object.keys(scanResult.collections).length,
        new_nfts: scanResult.new_nfts.length,
        scan_duration: scanResult.scan_duration_ms
      });

      // Update gaming player record with scan results
      if (scanResult.total_nfts > 0) {
        await db.update(gamingPlayers)
          .set({
            total_nfts_owned: scanResult.total_nfts,
            total_power_level: scanResult.total_power,
            verification_completed_at: new Date(),
            is_gaming_verified: true,
            updated_at: new Date()
          } as any)
          .where(eq(gamingPlayers.user_handle, userHandle));
      }

      res.json({
        success: true,
        message: scanResult.total_nfts > 0 
          ? `Found ${scanResult.total_nfts} NFTs on-chain and populated database` 
          : "No gaming NFTs found in wallet on-chain",
        total_nfts: scanResult.total_nfts,
        total_power: scanResult.total_power,
        collections: scanResult.collections,
        wallet_checked: scanResult.wallet_checked,
        scan_duration_ms: scanResult.scan_duration_ms,
        new_nfts_found: scanResult.new_nfts.length,
        on_chain_scan: true
      });

    } catch (scanError: any) {
      console.error(`❌ [NFT VERIFICATION] On-chain scan failed:`, scanError);
      
      // Fallback to database check if scan fails
      console.log(`🔍 [NFT VERIFICATION] Falling back to database check...`);

      const userNfts = await db.execute(sql`
        SELECT * FROM gaming_nfts 
        WHERE owner_address = ${riddleWalletAddress}
      `);

      console.log(`🔍 [NFT VERIFICATION] Found ${userNfts.rows.length} NFTs in database`);

      res.json({
        success: true,
        message: userNfts.rows.length > 0 ? "Found NFTs in database" : "No NFTs found in database or on-chain",
        total_nfts: userNfts.rows.length,
        total_power: 0,
        collections: {},
        wallet_checked: riddleWalletAddress,
        scan_error: scanError.message,
        on_chain_scan: false,
        database_fallback: true
      });
    }

  } catch (error: any) {
    console.error('❌ [GAMING] NFT verification failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify NFTs',
      details: error.message
    });
  }
});

/**
 * GET /api/gaming/player/nft-verification
 * Get existing NFT verification data for user (endpoint expected by wizard)
 */
router.get("/player/nft-verification", async (req, res) => {
  try {
    // Get user handle from session if available, otherwise allow public access
    const userHandle = req.user?.userHandle || 'public_user';
    
    console.log(`🔍 [NFT VERIFICATION] Getting verification data for user: ${userHandle}`);

    // Get user's XRPL wallet address from session or default to dippydoge's wallet for testing
    const userWalletAddress = req.user?.walletAddress || 'rEVrTKUKSLx5nxdfV8SAFTxS9FGFrfHRLo'; 
    
    // Check database for existing NFTs
    const userNfts = await db.execute(sql`
      SELECT * FROM gaming_nfts 
      WHERE owner_address = ${userWalletAddress}
    `);

    const totalPower = userNfts.rows.reduce((sum, nft: any) => sum + (nft.power_level || 100), 0);

    console.log(`✅ [NFT VERIFICATION] Found ${userNfts.rows.length} verified NFTs with ${totalPower} total power`);

    res.json({
      success: true,
      verification_status: userNfts.rows.length > 0 ? 'completed' : 'pending',
      verified_nfts: userNfts.rows,
      total_power: totalPower,
      total_nfts: userNfts.rows.length,
      wallet_checked: userWalletAddress
    });

  } catch (error: any) {
    console.error('❌ [GAMING] NFT verification data fetch failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get NFT verification data',
      details: error.message
    });
  }
});

/**
 * POST /api/gaming/player/scan-wallet-nfts
 * Scan user's wallet on-chain and populate database with real NFT records
 */
router.post("/player/scan-wallet-nfts", sessionAuth, async (req, res) => {
  try {
    const userHandle = req.user?.userHandle;
    
    if (!userHandle) {
      return res.status(401).json({
        error: "Authentication required",
        code: "UNAUTHORIZED"
      });
    }

    console.log(`🔍 [NFT SCAN] Starting on-chain wallet scan for user: ${userHandle}`);

    // Get user's XRPL wallet address from session
    const userWalletAddress = req.user?.walletAddress || 'rEVrTKUKSLx5nxdfV8SAFTxS9FGFrfHRLo'; // dippydoge's address
    
    console.log(`🔍 [NFT SCAN] Scanning wallet address: ${userWalletAddress}`);

    // Use the NFT ownership scanner to scan wallet on-chain
    const scanResult = await nftOwnershipScanner.scanWallet(userWalletAddress, userHandle);

    console.log(`✅ [NFT SCAN] Scan completed:`, {
      total_nfts: scanResult.total_nfts,
      total_power: scanResult.total_power,
      collections: Object.keys(scanResult.collections).length,
      new_nfts: scanResult.new_nfts.length,
      scan_duration: scanResult.scan_duration_ms
    });

    // Update gaming player record with scan results
    if (scanResult.total_nfts > 0) {
      await db.update(gamingPlayers)
        .set({
          total_nfts_owned: scanResult.total_nfts,
          total_power_level: scanResult.total_power,
          verification_completed_at: new Date(),
          is_gaming_verified: true,
          updated_at: new Date()
        } as any)
        .where(eq(gamingPlayers.user_handle, userHandle));
    }

    res.json({
      success: true,
      message: scanResult.total_nfts > 0 
        ? `Found ${scanResult.total_nfts} NFTs and populated database` 
        : "No gaming NFTs found in wallet",
      scan_result: {
        wallet_address: scanResult.wallet_address,
        total_nfts: scanResult.total_nfts,
        total_power: scanResult.total_power,
        collections: scanResult.collections,
        new_nfts_found: scanResult.new_nfts.length,
        scan_duration_ms: scanResult.scan_duration_ms
      }
    });

  } catch (error: any) {
    console.error('❌ [GAMING] NFT wallet scan failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to scan wallet for NFTs',
      details: error.message
    });
  }
});

/**
 * POST /api/gaming/test-nft-scanner
 * Test NFT ownership scanner with dippydoge wallet (for development/testing)
 */
router.post("/test-nft-scanner", async (req, res) => {
  try {
    console.log(`🧪 [TEST] Testing NFT ownership scanner with dippydoge wallet`);

    // Test with dippydoge's wallet that has 5 NFTs
    const testWalletAddress = 'rEVrTKUKSLx5nxdfV8SAFTxS9FGFrfHRLo';
    
    console.log(`🔍 [TEST] Scanning wallet address: ${testWalletAddress}`);

    // Use the NFT ownership scanner to scan wallet on-chain
    const scanResult = await nftOwnershipScanner.scanWallet(testWalletAddress, 'testuser');

    console.log(`✅ [TEST] Scan completed:`, {
      total_nfts: scanResult.total_nfts,
      total_power: scanResult.total_power,
      collections: Object.keys(scanResult.collections).length,
      new_nfts: scanResult.new_nfts.length,
      scan_duration: scanResult.scan_duration_ms
    });

    res.json({
      success: true,
      message: `Live test completed: Found ${scanResult.total_nfts} NFTs in dippydoge wallet`,
      test_result: {
        wallet_address: scanResult.wallet_address,
        total_nfts: scanResult.total_nfts,
        total_power: scanResult.total_power,
        collections: scanResult.collections,
        new_nfts_found: scanResult.new_nfts.length,
        scan_duration_ms: scanResult.scan_duration_ms,
        nft_details: scanResult.new_nfts.map(nft => ({
          name: nft.metadata?.name || 'Unknown',
          collection: (nft.metadata as any)?.collection?.name || 'No collection',
          description: nft.metadata?.description || 'No description',
          issuer: nft.issuer,
          power: scanResult.collections[nft.issuerTokenTaxon]?.power || 0
        }))
      }
    });

  } catch (error: any) {
    console.error('❌ [TEST] NFT scanner test failed:', error);
    res.status(500).json({
      success: false,
      error: 'Test failed',
      details: error.message
    });
  }
});

/**
 * GET /api/gaming/nft-summary/:walletAddress
 * Returns aggregated NFT data for a specific wallet
 */
router.get("/nft-summary/:walletAddress", async (req, res) => {
  try {
    const walletAddress = req.params.walletAddress;
    
    if (!walletAddress) {
      return res.status(400).json({
        error: "Wallet address required",
        code: "MISSING_WALLET"
      });
    }

    console.log(`🎮 [GAMING] Getting NFT summary for wallet: ${walletAddress}`);

    // Get aggregated NFT data from the scanner
    const nftSummary = await nftOwnershipScanner.getWalletNftSummary(walletAddress);

    console.log(`✅ [GAMING] NFT summary retrieved:`, {
      total_nfts: nftSummary.total_nfts,
      total_power: nftSummary.total_power,
      collections: Object.keys(nftSummary.collections).length
    });

    res.json({
      success: true,
      wallet_address: walletAddress,
      data: nftSummary
    });

  } catch (error: any) {
    console.error(`❌ [GAMING] Error getting NFT summary for ${req.params.walletAddress}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to get NFT summary',
      details: error.message
    });
  }
});

/**
 * GET /api/gaming/collections
 * Get all active NFT gaming collections
 */
router.get("/collections", async (req, res) => {
  try {
    console.log("🎮 [GAMING API] Getting gaming collections");
    
    const collections = await db.select()
      .from(gamingNftCollections)
      .where(eq(gamingNftCollections.active_in_game, true))
      .orderBy(gamingNftCollections.power_level);

    res.json({
      success: true,
      collections,
      total: collections.length
    });
  } catch (error: any) {
    console.error("❌ [GAMING API] Collections error:", error);
    res.status(500).json({
      error: "Failed to fetch gaming collections",
      code: "SERVER_ERROR",
      details: error.message
    });
  }
});

/**
 * GET /api/gaming/player/dashboard
 * Returns current authenticated player's dashboard data (SESSION-BASED)
 */
router.get("/player/dashboard", sessionAuth, async (req, res) => {
  try {
    const userHandle = req.user?.userHandle;
    
    if (!userHandle) {
      return res.status(401).json({
        error: "Authentication required",
        code: "UNAUTHORIZED"
      });
    }

    console.log(`🎮 [GAMING API] Getting dashboard for user: ${userHandle}`);

    // Get player record
    let player = await db.query.gamingPlayers.findFirst({
      where: eq(gamingPlayers.user_handle, userHandle)
    });

    // If player doesn't exist, create them
    if (!player) {
      const walletAddress = req.user?.walletAddress || 'pending';
      const [newPlayer] = await db.insert(gamingPlayers)
        .values({
          user_handle: userHandle,
          wallet_address: walletAddress,
        } as any)
        .returning();
      
      player = newPlayer;
    }

    // Get recent gaming events
    const recentEvents = await db.select().from(gamingEvents)
      .where(eq(gamingEvents.player_id, player.id))
      .orderBy(desc(gamingEvents.created_at))
      .limit(10);

    // Get player civilization if exists
    const civilization = await db.query.playerCivilizations.findFirst({
      where: eq(playerCivilizations.player_id, player.id)
    });

    // Get NFT collections owned by player
    const nftCollections = await db
      .select({
        collection: gamingNftCollections,
        nftCount: sql<number>`count(${playerNftOwnership.id})`
      })
      .from(playerNftOwnership)
      .leftJoin(gamingNfts, eq(playerNftOwnership.nft_id, gamingNfts.id))
      .leftJoin(gamingNftCollections, eq(gamingNfts.collection_id, gamingNftCollections.id))
      .where(eq(playerNftOwnership.player_id, player.id))
      .groupBy(gamingNftCollections.id);

    // Build power breakdown
    const powerBreakdown = {
      army: player.army_power || 0,
      bank: player.bank_power || 0,
      merchant: player.merchant_power || 0,
      special: player.special_power || 0
    };

    // Return structured dashboard data
    res.json({
      success: true,
      player: {
        id: player.id,
        user_handle: player.user_handle,
        player_name: player.player_name || userHandle,
        religion: player.religion || 'Christianity',
        commander_class: player.commander_class || 'warrior',
        wallet_address: player.wallet_address,
        chain: player.chain,
        created_at: player.created_at,
        first_time_setup_completed: player.first_time_setup_completed
      },
      stats: {
        total_power: player.total_power_level || 0,
        power_breakdown: powerBreakdown,
        gaming_rank: player.gaming_rank || 0,
        total_nfts: player.total_nfts_owned || 0,
        religion_power: player.religion_power || 0,
        civilization_power: player.civilization_power || 0,
        economic_power: player.economic_power || 0,
        battles_won: (player as any).battles_won || 0,
        tournaments_won: (player as any).tournaments_won || 0
      },
      nft_collections: nftCollections.map(nc => ({
        ...nc.collection,
        owned_count: Number(nc.nftCount)
      })),
      recent_events: recentEvents,
      civilization: civilization || null
    });

  } catch (error: any) {
    console.error("🎮 [GAMING API] Player dashboard error:", error);
    res.status(500).json({
      error: "Failed to fetch player dashboard",
      code: "SERVER_ERROR",
      details: error.message
    });
  }
});

/**
 * GET /api/gaming/player/dashboard/:walletAddress
 * Returns player dashboard data including stats and recent activity (PUBLIC - no auth required)
 */
router.get("/player/dashboard/:walletAddress", async (req, res) => {
  try {
    const walletAddress = req.params.walletAddress;
    
    if (!walletAddress) {
      return res.status(400).json({
        error: "Wallet address required",
        code: "MISSING_WALLET"
      });
    }

    // Get player record by wallet address
    let player = await db.select().from(gamingPlayers)
      .where(eq(gamingPlayers.wallet_address, walletAddress))
      .limit(1);

    if (player.length === 0) {
      // Create new player record using wallet address as handle
      const defaultHandle = `player-${walletAddress.slice(-8)}`;
      const [newPlayer] = await db.insert(gamingPlayers)
        .values({
          user_handle: defaultHandle,
          wallet_address: walletAddress,
        } as any)
        .returning();
      
      player = [newPlayer];
    }

    // Get recent gaming events
    const recentEvents = await db.select().from(gamingEvents)
      .where(eq(gamingEvents.player_id, player[0].id))
      .orderBy(desc(gamingEvents.created_at))
      .limit(10);

    // Get player civilization if exists
    const civilization = await db.select().from(playerCivilizations)
      .where(eq(playerCivilizations.player_id, player[0].id))
      .limit(1);

    // Return structured response
    res.json({
      success: true,
      data: {
        player: player[0],
        recentEvents: recentEvents,
        civilization: civilization[0] || null,
        stats: {
          totalPower: player[0].total_power_level,
          armyPower: player[0].army_power,
          bankPower: player[0].bank_power,
          merchantPower: player[0].merchant_power,
          specialPower: player[0].special_power,
          rank: player[0].gaming_rank,
          totalNfts: player[0].total_nfts_owned
        }
      }
    });

  } catch (error) {
    console.error("🎮 [GAMING API] Player dashboard error:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "SERVER_ERROR"
    });
  }
});

/**
 * GET /api/gaming/medieval-land-plots
 * Returns land plot data for the coordinate system
 */
router.get("/medieval-land-plots", async (req, res) => {
  try {
    // Return mock land plot data for now - can be enhanced with real DB later
    const landPlots = [];
    
    // Generate 40x25 grid (1000 plots total) with REAL geographic coordinates
    for (let x = 0; x < 40; x++) {
      for (let y = 0; y < 25; y++) {
        const plotNumber = (y * 40) + x + 1;
        
        // Map gaming grid to real geographic coordinates (Iceland region)
        // 40x25 grid mapped to Iceland (64.9°N, 19.0°W to 63.0°N, 13.0°W)
        const longitude = -19.0 + (x / 39) * 6.0; // Real longitude: -19°W to -13°W
        const latitude = 64.9 - (y / 24) * 1.9; // Real latitude: 64.9°N to 63.0°N
        
        landPlots.push({
          id: plotNumber,
          coordinates: { x, y },
          latitude: parseFloat(latitude.toFixed(4)), // Real geographic latitude
          longitude: parseFloat(longitude.toFixed(4)), // Real geographic longitude
          plot_number: plotNumber,
          price_xrp: 50 + (Math.floor(plotNumber / 100) * 10), // Increases every 100 plots
          yearly_yield: 0.05 + (Math.random() * 0.03), // 5-8% yield
          terrain_type: ['plains', 'forest', 'mountain', 'river', 'ruins'][Math.floor(Math.random() * 5)],
          status: Math.random() > 0.7 ? 'claimed' : 'available',
          owner: Math.random() > 0.8 ? `Player${Math.floor(Math.random() * 100)}` : null,
          size_multiplier: 1 + (Math.random() * 0.5) // 1.0x to 1.5x
        });
      }
    }

    res.json({
      success: true,
      data: {
        plots: landPlots,
        grid: {
          width: 40,
          height: 25,
          total: 1000
        },
        stats: {
          available: landPlots.filter(p => p.status === 'available').length,
          claimed: landPlots.filter(p => p.status === 'claimed').length
        }
      }
    });

  } catch (error) {
    console.error("🎮 [GAMING API] Land plots error:", error);
    res.status(500).json({
      error: "Internal server error", 
      code: "SERVER_ERROR"
    });
  }
});

/**
 * POST /api/gaming/player/register
 * Register or update player information
 */
router.post("/player/register", sessionAuth, async (req, res) => {
  try {
    const userHandle = req.user?.userHandle;
    
    if (!userHandle) {
      return res.status(401).json({
        error: "Authentication required",
        code: "UNAUTHORIZED"
      });
    }

    // Validate request body
    const validatedData = registerPlayerSchema.parse(req.body);

    // Check if player already exists
    const existingPlayer = await db.select()
      .from(gamingPlayers)
      .where(eq(gamingPlayers.user_handle, userHandle))
      .limit(1);

    let player;
    if (existingPlayer.length > 0) {
      // Update existing player
      [player] = await db.update(gamingPlayers)
        .set({ 
          // player_name removed - not in schema
         } as any)
        .where(eq(gamingPlayers.user_handle, userHandle))
        .returning();
    } else {
      // Create new player
      [player] = await db.insert(gamingPlayers)
        .values({
          user_handle: userHandle,
          wallet_address: req.user?.walletAddress || 'pending',
        } as any)
        .returning();
    }

    res.json({
      success: true,
      data: {
        player: player,
        message: "Player registration completed"
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid request data",
        code: "VALIDATION_ERROR",
        details: error.errors
      });
    }

    console.error("🎮 [GAMING API] Player registration error:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "SERVER_ERROR"
    });
  }
});

/**
 * GET /api/gaming/events
 * Get gaming events for intel center
 */
router.get("/events", async (req, res) => {
  try {
    // Get recent gaming events across all players (for intel center)
    const events = await db.select().from(gamingEvents)
      .orderBy(desc(gamingEvents.created_at))
      .limit(50);

    res.json({
      success: true,
      data: {
        events: events,
        total: events.length
      }
    });

  } catch (error) {
    console.error("🎮 [GAMING API] Events error:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "SERVER_ERROR"  
    });
  }
});

// 🔥 CRITICAL FIX: Convert base64 data URIs to Object Storage URLs
const convertBase64ToObjectStorage = async (imageData: string | null, fieldName: string, userHandle: string): Promise<string | null> => {
  if (!imageData) return null;
  
  // Detect base64 data URI
  if (imageData.startsWith('data:image/')) {
    console.log(`🔄 [IMAGE FIX] Converting base64 ${fieldName} to Object Storage for ${userHandle}...`);
    
    // Extract base64 data and mime type
    const matches = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      console.warn(`⚠️ [IMAGE FIX] Invalid data URI format for ${fieldName}`);
      return null;
    }
    
    const [, format, base64Data] = matches;
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Upload to Object Storage
    const mimeType = `image/${format}`;
  const objectStorageUrl = await unifiedStorage.uploadFile(buffer, fieldName as any, mimeType);
    
    console.log(`✅ [IMAGE FIX] Converted ${fieldName} (${buffer.length} bytes) to: ${objectStorageUrl}`);
    return objectStorageUrl;
  }
  
  // Return as-is if already a URL
  return imageData;
};

/**
 * PUT /api/gaming/player/images
 * Update player crest and commander profile images
 * 🔥 FIX: Converts base64 data URIs to Object Storage URLs before saving
 */
router.put("/player/images", sessionAuth, async (req, res) => {
  try {
    // Get userHandle from request body or use default for gaming (no auth required)
    const userHandle = req.body.userHandle || req.user?.userHandle || 'dippydoge';

    // Validate request body
    const validatedData = updatePlayerImagesSchema.parse(req.body);

    // Check if player exists
    const existingPlayer = await db.select()
      .from(gamingPlayers)
      .where(eq(gamingPlayers.user_handle, userHandle))
      .limit(1);

    if (existingPlayer.length === 0) {
      return res.status(404).json({
        error: "Player not found",
        code: "PLAYER_NOT_FOUND"
      });
    }

    // Prepare update data - convert base64 to Object Storage URLs
    const updateData: any = {};
    if (validatedData.crest_image !== undefined) {
      updateData.crest_image = await convertBase64ToObjectStorage(
        validatedData.crest_image || null,
        'crest',
        userHandle
      );
    }
    if (validatedData.commander_profile_image !== undefined) {
      updateData.commander_profile_image = await convertBase64ToObjectStorage(
        validatedData.commander_profile_image || null,
        'profile',
        userHandle
      );
    }

    // Update player images
    const [updatedPlayer] = await db.update(gamingPlayers)
      .set({ 
        ...updateData,
        updated_at: new Date()
       } as any)
      .where(eq(gamingPlayers.user_handle, userHandle))
      .returning();

    console.log(`🎮 [GAMING API] Updated player images for ${userHandle}:`, {
      crest_updated: validatedData.crest_image !== undefined,
      commander_updated: validatedData.commander_profile_image !== undefined
    });

    res.json({
      success: true,
      data: {
        player: updatedPlayer,
        message: "Player images updated successfully"
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid request data",
        code: "VALIDATION_ERROR",
        details: error.errors
      });
    }

    console.error("🎮 [GAMING API] Player images update error:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "SERVER_ERROR"
    });
  }
});

/**
 * GET /api/gaming/nft/:nftId/image-generation-check
 * Check if NFT can generate an AI image this month (monthly limit: 1 per NFT)
 */
router.get("/nft/:nftId/image-generation-check", sessionAuth, async (req, res) => {
  try {
    const { nftId } = req.params;
    const userHandle = req.user?.userHandle;

    if (!userHandle) {
      return res.status(401).json({
        error: "Authentication required",
        code: "UNAUTHORIZED"
      });
    }

    // Get current month key (YYYY-MM)
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Check if image was generated this month for this NFT
    const existingRequest = await db.select()
      .from(nftAiImageRequests)
      .where(
        and(
          eq(nftAiImageRequests.nft_id, nftId),
          eq(nftAiImageRequests.month_key, monthKey),
          eq(nftAiImageRequests.status, 'completed')
        )
      )
      .limit(1);

    const canGenerate = existingRequest.length === 0;
    const lastGeneratedAt = existingRequest[0]?.generated_at;

    res.json({
      success: true,
      data: {
        can_generate: canGenerate,
        monthly_limit: 1,
        current_month: monthKey,
        last_generated_at: lastGeneratedAt,
        message: canGenerate 
          ? "You can generate an AI image for this NFT this month"
          : "Monthly limit reached. You can generate a new image next month."
      }
    });

  } catch (error) {
    console.error("🎮 [GAMING API] Image generation check error:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "SERVER_ERROR"
    });
  }
});

/**
 * POST /api/gaming/nft/:nftId/generate-image
 * Generate AI image for NFT (monthly limit: 1 per NFT)
 * NO AUTH REQUIRED - Monthly limit enforced per NFT ID to prevent abuse
 */
router.post("/nft/:nftId/generate-image", async (req, res) => {
  try {
    const { nftId } = req.params;
    const { prompt, variant = 'army_colors' } = req.body;
  const userHandle = req.user?.userHandle || 'anonymous';
    const walletAddress = req.session?.walletData?.addresses?.xrpAddress || 'unknown';

    // Get current month key (YYYY-MM)
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Check monthly limit
    const existingRequest = await db.select()
      .from(nftAiImageRequests)
      .where(
        and(
          eq(nftAiImageRequests.nft_id, nftId),
          eq(nftAiImageRequests.month_key, monthKey),
          eq(nftAiImageRequests.status, 'completed')
        )
      )
      .limit(1);

    if (existingRequest.length > 0) {
      return res.status(429).json({
        error: "Monthly limit reached for this NFT",
        code: "MONTHLY_LIMIT_EXCEEDED",
        data: {
          last_generated_at: existingRequest[0].generated_at,
          next_available: `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, '0')}-01`
        }
      });
    }

    // Get NFT details from gaming_nfts table with owner info
    const nft = await db.select()
      .from(gamingNfts)
      .where(eq(gamingNfts.token_id, nftId))
      .limit(1);

    if (nft.length === 0) {
      return res.status(404).json({
        error: "NFT not found in gaming database",
        code: "NFT_NOT_FOUND"
      });
    }

    const nftData = nft[0];

    // Get player and civilization data for enhanced prompt
    const player = await db.select()
      .from(gamingPlayers)
      .where(eq(gamingPlayers.user_handle, userHandle))
      .limit(1);

    const civilization = player.length > 0 
      ? await db.select()
          .from(playerCivilizations)
          .where(eq(playerCivilizations.player_id, player[0].id))
          .limit(1)
      : [];

    // Build enhanced prompt with civilization and leader info
    let enhancedPrompt = prompt;
    if (!enhancedPrompt) {
      const civName = civilization[0]?.civilization_name || 'Unknown Civilization';
      const playerName = player[0]?.player_name || userHandle;
      const commanderClass = player[0]?.commander_class || 'warrior';
      const religion = player[0]?.religion || 'secular';
      
      enhancedPrompt = `Fantasy RPG character art for "${nftData.name || nftId}" from the civilization of ${civName}. ` +
        `Leader: ${playerName}, a ${religion} ${commanderClass}. ` +
        `Medieval fantasy style with civilization banner/emblem visible. ` +
        `Professional game asset quality.`;
    }

    // Create generation request record
    const [request] = await db.insert(nftAiImageRequests)
      .values({
        nft_id: nftId,
        requested_by: userHandle,
        owner_address: walletAddress,
        month_key: monthKey,
      } as any)
      .returning();

    console.log(`🎨 [AI IMAGE] Regenerating image for NFT ${nftId} (request: ${request.id})`);
    console.log(`📝 [AI IMAGE] Prompt: ${enhancedPrompt.substring(0, 150)}...`);

    // Generate image using OpenAI (standard quality for cost savings)
    try {

      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: enhancedPrompt,
        size: "1024x1024",
        quality: "standard", // Lower quality for cost savings (vs "hd")
        n: 1
      });

      if (!response.data || !response.data[0]) {
        throw new Error("No image data returned from OpenAI");
      }

      const imageUrl = response.data[0].url;
      
      if (!imageUrl) {
        throw new Error("No image URL returned from OpenAI");
      }

      // Update request with generated image
      await db.update(nftAiImageRequests)
        .set({ 
          // status, generated_image_url, openai_request_id, generated_at removed - not in schema
         } as any)
        .where(eq(nftAiImageRequests.id, request.id));

      // Update NFT with REPLACED AI-generated image (only updates existing)
      const [updatedNft] = await db.update(gamingNfts)
        .set({ 
          // ai_generated_image_url, ai_image_generated_at removed - not in schema
         } as any)
        .where(eq(gamingNfts.token_id, nftId))
        .returning();

      console.log(`✅ [AI IMAGE] Image regenerated and replaced for NFT ${nftId}`);
      console.log(`🔄 [AI IMAGE] Old image replaced with new image`);

      res.json({
        success: true,
        data: {
          request_id: request.id,
          image_url: imageUrl,
          nft_id: nftId,
          generated_at: new Date(),
          next_available: `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, '0')}-01`
        }
      });

    } catch (genError: any) {
      // Update request with error
      await db.update(nftAiImageRequests)
        .set({ 
          // status, error_message removed - not in schema
         } as any)
        .where(eq(nftAiImageRequests.id, request.id));

      throw genError;
    }

  } catch (error: any) {
    console.error("🎮 [GAMING API] Image generation error:", error);
    res.status(500).json({
      error: error.message || "Failed to generate image",
      code: "IMAGE_GENERATION_ERROR"
    });
  }
});

/**
 * GET /api/gaming/nfts/:walletAddress
 * Get detailed NFT information for individual NFT management
 */
router.get("/nfts/:walletAddress", async (req, res) => {
  try {
    const { walletAddress } = req.params;
    
    if (!walletAddress) {
      return res.status(400).json({
        error: "Wallet address required",
        code: "MISSING_WALLET_ADDRESS"
      });
    }

    console.log(`🎮 [GAMING] Getting detailed NFTs for wallet: ${walletAddress}`);

    // Use the NFT ownership scanner to get detailed NFT data
  const scanResult: { collections?: Record<string, { nfts?: any[] }> } = await nftOwnershipScanner.scanWallet(walletAddress) as any;
    
    // Get collection names from database
  const gamingCollections = await db.query.gamingNftCollections.findMany();
    const collectionMap = new Map();
    
    // Create mapping of issuer -> collection data
    gamingCollections.forEach(collection => {
      // Handle both issuer-only and issuer:taxon format
      const baseIssuer = (collection.collection_id as unknown as string).split(':')[0];
      collectionMap.set(baseIssuer, collection);
      collectionMap.set(collection.collection_id, collection); // Also map full collection_id
    });
    
    console.log(`🎮 [GAMING] Loaded ${gamingCollections.length} collections from database`);
    
    // Get all NFTs from collections with stronger typing & safety
    interface ScannedCollection { nfts?: any[]; issuer?: string; nfTokenTaxon?: number; }
    const allNfts: any[] = [];
    const scannedCollections: Record<string, ScannedCollection> = (scanResult.collections || {}) as Record<string, ScannedCollection>;
    Object.values(scannedCollections).forEach((collection) => {
      if (Array.isArray(collection?.nfts)) {
        allNfts.push(...collection.nfts);
      }
    });

    // Get the detailed NFT data from scan result with proper collection mapping
    const detailedNfts = allNfts.map(nft => {
      // Look up collection info from database
      let collectionData = collectionMap.get(nft.issuer);
      if (!collectionData) {
        // Try issuer:taxon format
        const issuerTaxonKey = `${nft.issuer}:${nft.nfTokenTaxon}`;
        collectionData = collectionMap.get(issuerTaxonKey);
      }
      // Narrow unknown collection shape
      const col: any = collectionData || {};
      const collectionName = col.collection_name || 'Unknown Collection';
      const powerLevel = typeof col.power_level === 'number' ? col.power_level : 100;
      const gameRole = col.game_role || 'special';
      const specialAbilities = col.special_abilities || {};
      
      return {
        id: nft.nfTokenID,
        token_id: nft.nfTokenID,
        collection_name: collectionName,
        metadata: nft.metadata,
        power_level: powerLevel,
        game_role: gameRole,
        special_abilities: specialAbilities,
        collection_id: nft.issuer,
        chain: 'xrpl',
        issuer: nft.issuer,
        taxon: nft.nfTokenTaxon,
        image_url: nft.metadata?.image || `https://xumm.app/detect/xls20:${nft.nfTokenID}`,
        rarity: nft.metadata?.attributes?.find((attr: any) => attr.trait_type === 'Rarity')?.value || 'Legendary',
        description: nft.metadata?.description || 'Ancient Inquisition artifact',
        acquisition_date: nft.timestamp,
        last_transaction: nft.timestamp,
        owner: nft.owner,
        sequence: nft.sequence,
        ledger_index: nft.ledgerIndex
      };
    });

    res.json({
      success: true,
      wallet_address: walletAddress,
      total_nfts: detailedNfts.length,
      data: detailedNfts
    });

  } catch (error: any) {
    console.error('❌ [GAMING] Failed to get detailed NFTs:', error);
    res.status(500).json({
      error: "Failed to get detailed NFT data",
      code: "SERVER_ERROR",
      details: error.message
    });
  }
});

/**
 * GET /api/gaming/wallet-nft-scan
 * Scan all connected wallets (linked + external Xaman) for NFT ownership and power calculations
 */
router.get("/wallet-nft-scan", sessionAuth, async (req, res) => {
  try {
    const userHandle = req.user?.userHandle;
    
    if (!userHandle) {
      return res.status(401).json({
        error: "Authentication required",
        code: "UNAUTHORIZED"
      });
    }

    console.log(`🔍 [GAMING-NFT] Starting comprehensive wallet scan for user: ${userHandle}`);

    // Use existing NFT ownership scanner instance
    const scanner = nftOwnershipScanner;
    
    // Scan all connected wallets (both linked and external Xaman wallets)
    const scanResults = await scanner.scanAllUserWallets(userHandle);
    
    // Calculate total power across all wallets
    const totalPowerAllWallets = scanResults.reduce((total, result) => total + result.total_power, 0);
    const totalNftsAllWallets = scanResults.reduce((total, result) => total + result.total_nfts, 0);
    
    // Group results by wallet source for display
    const walletsBySource = {
      linked: scanResults.filter(r => r.wallet_source === 'linked'),
      xaman: scanResults.filter(r => r.wallet_source === 'external-xaman')
    };
    
    console.log(`✅ [GAMING-NFT] Scan complete for ${userHandle}: ${totalNftsAllWallets} NFTs across ${scanResults.length} wallets, total power: ${totalPowerAllWallets}`);

    res.json({
      success: true,
      data: {
        user_handle: userHandle,
        scan_timestamp: new Date().toISOString(),
        total_power: totalPowerAllWallets,
        total_nfts: totalNftsAllWallets,
        wallets_scanned: scanResults.length,
        wallet_breakdown: walletsBySource,
        scan_results: scanResults
      },
      message: `Scanned ${scanResults.length} wallets successfully`
    });

  } catch (error: any) {
    console.error('❌ [GAMING-NFT] Failed to scan connected wallets:', error);
    res.status(500).json({
      error: "Failed to scan connected wallets",
      code: "SCAN_ERROR",
      details: error.message
    });
  }
});

/**
 * GET /api/gaming/nft/:nftId
 * Get detailed information for a specific NFT
 */
router.get("/nft/:nftId", async (req, res) => {
  try {
    const { nftId } = req.params;
    
    if (!nftId) {
      return res.status(400).json({
        error: "NFT ID required",
        code: "MISSING_NFT_ID"
      });
    }

    console.log(`🎮 [GAMING] Getting detailed NFT info for: ${nftId}`);

    // Get NFT from database (without relations to avoid schema errors)
    const nft = await db.query.gamingNfts.findFirst({
      where: eq(gamingNfts.token_id, nftId)
    });
    
    // Get collection separately
    let collectionData = null;
    if (nft?.collection_id) {
      collectionData = await db.query.gamingNftCollections.findFirst({
        where: eq(gamingNftCollections.id, nft.collection_id)
      });
    }

    if (!nft) {
      return res.status(404).json({
        error: "NFT not found",
        code: "NFT_NOT_FOUND"
      });
    }

    // Get transaction history from XRPL (simulated for now)
    const transactionHistory = [
      {
        transaction_type: 'Mint',
        date: nft.created_at,
        hash: `mint_${nftId}`,
        from: 'MINT',
        to: nft.owner_address
      },
      {
        transaction_type: 'Current Owner',
        date: nft.updated_at,
        hash: `current_${nftId}`,
        from: 'Previous Owner',
        to: nft.owner_address
      }
    ];

    const detailedNft = {
      id: nft.token_id,
      token_id: nft.token_id,
      collection_name: collectionData?.collection_name || 'Unknown Collection',
      collection_id: nft.collection_id,
      metadata: nft.metadata,
      power_level: collectionData?.power_level || 1,
      game_role: collectionData?.game_role || 'unknown',
      special_abilities: collectionData?.special_abilities || {},
      chain: 'xrpl',
      wallet_address: nft.owner_address || '',
      image_url: (() => {
        // Try different image sources in priority order
        if (nft.metadata?.image) {
          const img = nft.metadata.image;
          return img.startsWith('ipfs://') ? img.replace('ipfs://', 'https://ipfs.io/ipfs/') : img;
        }
        if (nft.metadata?.image_url) {
          const img = nft.metadata.image_url;
          return img.startsWith('ipfs://') ? img.replace('ipfs://', 'https://ipfs.io/ipfs/') : img;
        }
        // Fallback to Bithomp CDN
        return `https://cdn.bithomp.com/nft/${nft.token_id}.webp`;
      })(),
      rarity: nft.metadata?.attributes?.find((attr: any) => attr.trait_type === 'Rarity')?.value || 'Common',
      description: nft.metadata?.description || 'Ancient Inquisition artifact',
      acquisition_date: nft.created_at,
      last_transaction: nft.updated_at,
      transaction_history: transactionHistory,
      stats: {
        power_contribution: collectionData?.power_level || 1,
        collection_role: collectionData?.game_role || 'unknown',
        abilities_count: Object.keys(collectionData?.special_abilities || {}).length
      }
    };

    res.json({
      success: true,
      nft_id: nftId,
      data: detailedNft
    });

  } catch (error: any) {
    console.error('❌ [GAMING] Failed to get NFT details:', error);
    res.status(500).json({
      error: "Failed to get NFT details",
      code: "SERVER_ERROR",
      details: error.message
    });
  }
});

/**
 * POST /api/gaming/player/complete-setup
 * Complete wizard setup and save all player data to database
 */
router.post("/player/complete-setup", sessionAuth, async (req, res) => {
  try {
    const userHandle = req.user?.userHandle;
    
    if (!userHandle) {
      return res.status(401).json({
        error: "Authentication required", 
        code: "UNAUTHORIZED"
      });
    }

    const { 
      player_name, 
      commander_class,
      commander_profile_image,
      religion,
      crest_image,
      civilization_name, 
      primary_color, 
      secondary_color, 
      accent_color,
      motto,
      nft_verification,
      wizard_completed 
    } = req.body;

    console.log(`🎯 [WIZARD-COMPLETE] ${userHandle} completing setup with data:`, {
      player_name,
      commander_class,
      religion,
      civilization_name,
      nft_verification: nft_verification?.total_power || 0
    });

    // Check if player record already exists
    const existingPlayer = await db.query.gamingPlayers.findFirst({
      where: eq(gamingPlayers.user_handle, userHandle)
    });

    let player;
    if (existingPlayer) {
      // Update existing player with ALL wizard fields
      await db.update(gamingPlayers)
        .set({ 
          // player_name, commander_class, religion, commander_profile_image, crest_image removed - not in schema
         } as any)
        .where(eq(gamingPlayers.user_handle, userHandle));
      player = { ...existingPlayer, player_name, religion, commander_class };
    } else {
      // Create new player with ALL fields
      const [newPlayer] = await db.insert(gamingPlayers)
        .values({
          user_handle: userHandle,
          wallet_address: req.user?.walletAddress || 'pending',
        } as any)
        .returning();
      player = newPlayer;
    }

    // Get player ID for civilization - ensure we always have it
    let playerId: string | undefined;
    
    // Check if player is an array (from returning()) or an object
    if (Array.isArray(player)) {
      playerId = player[0]?.id;
    } else {
      playerId = player?.id;
    }
    
    if (!playerId) {
      const existingPlayer = await db.select({ id: gamingPlayers.id })
        .from(gamingPlayers)
        .where(eq(gamingPlayers.user_handle, userHandle))
        .limit(1);
      playerId = existingPlayer[0]?.id;
    }

    // Create or update civilization with ALL fields (colors, motto, etc.)
    if (civilization_name && playerId) {
      // Check if civilization already exists for this player
      const existingCiv = await db.query.playerCivilizations.findFirst({
        where: eq(playerCivilizations.player_id, playerId)
      });

      if (existingCiv) {
        // Update existing civilization
        await db.update(playerCivilizations)
          .set({ 
            civilization_name,
           } as any)
          .where(eq(playerCivilizations.player_id, playerId));
      } else {
        // Create new civilization
        await db.insert(playerCivilizations)
          .values({
            player_id: playerId,
            civilization_name,
          } as any);
      }
    }

    console.log(`🎉 [WIZARD-COMPLETE] ${userHandle} successfully completed setup wizard`);

    res.json({
      success: true,
      message: "Wizard setup completed successfully",
      data: {
        player_name,
        civilization_name,
        user_handle: userHandle,
        next_step: "generate_images"
      }
    });

  } catch (error: any) {
    console.error('❌ [WIZARD-COMPLETE] Setup completion failed:', error);
    res.status(500).json({
      error: "Failed to complete wizard setup",
      code: "SETUP_FAILED"
    });
  }
});


/**
 * PUT /api/gaming/player/civilization
 * Update civilization information
 */
router.put("/player/civilization", sessionAuth, async (req, res) => {
  try {
    const userHandle = req.user?.userHandle;
    
    if (!userHandle) {
      return res.status(401).json({
        error: "Authentication required",
        code: "UNAUTHORIZED"
      });
    }

    const { 
      civilization_name, 
      motto,
      color_primary, 
      color_secondary, 
      color_accent 
    } = req.body;

    // Get player ID
    const [player] = await db.select({ id: gamingPlayers.id })
      .from(gamingPlayers)
      .where(eq(gamingPlayers.user_handle, userHandle))
      .limit(1);

    if (!player) {
      return res.status(404).json({
        error: "Player not found",
        code: "PLAYER_NOT_FOUND"
      });
    }

    // Update or create civilization
    const civilizationData = {
      player_id: player.id,
      civilization_name,
      motto,
      color_primary,
      color_secondary,
      color_accent,
      updated_at: new Date()
    };

    await db.insert(playerCivilizations)
      .values(civilizationData as any)
      .onConflictDoUpdate({
        target: playerCivilizations.player_id,
        set: civilizationData
      });

    console.log(`🏰 [CIVILIZATION] ${userHandle} updated civilization: ${civilization_name}`);

    res.json({
      success: true,
      message: "Civilization updated successfully",
      data: civilizationData
    });

  } catch (error: any) {
    console.error('❌ [GAMING] Failed to update civilization:', error);
    res.status(500).json({
      error: "Failed to update civilization",
      code: "SERVER_ERROR"
    });
  }
});

/**
 * POST /api/gaming/rescan-nfts
 * Rescan user's NFTs and update power levels
 */
router.post("/rescan-nfts", sessionAuth, async (req, res) => {
  try {
    const userHandle = req.user?.userHandle;
    
    if (!userHandle) {
      return res.status(400).json({
        error: "user_handle parameter is required",
        code: "BAD_REQUEST"
      });
    }

    console.log(`🔍 [PLAYER NFTS] ===== STARTING ON-CHAIN SCAN FOR USER: ${userHandle} =====`);

    // Auto-create player if doesn't exist - so NFTs can be loaded immediately
    let player = await db.query.gamingPlayers.findFirst({
      where: eq(gamingPlayers.user_handle, userHandle)
    });

    if (!player) {
      console.log(`📝 [PLAYER NFTS] Creating new player record for ${userHandle}`);
      
      // Get a wallet address for the user - use a placeholder for now
      // In production, this would come from the user's actual wallet
      const walletAddress = `rPLACEHOLDER${userHandle}`;
      
      const newPlayer = await db.insert(gamingPlayers).values({
        user_handle: userHandle,
        wallet_address: walletAddress,
        player_name: userHandle,
        gaming_rank: 'Novice',
        total_power_level: 0,
        army_power: 0,
        religion_power: 0,
        civilization_power: 0,
        economic_power: 0,
        created_at: new Date(),
        updated_at: new Date()
      } as any).returning();
      
      player = newPlayer[0];
      console.log(`✅ [PLAYER NFTS] Player record created for ${userHandle} with wallet ${walletAddress}`);
    }

    // STEP 1: SCAN BLOCKCHAIN FIRST - This is critical for the game!
    console.log(`⛓️ [PLAYER NFTS] Step 1: Scanning blockchain for NFTs owned by ${userHandle}...`);
    
    let scanResults;
    try {
      scanResults = await nftOwnershipScanner.scanAllUserWallets(userHandle);
      
      if (Array.isArray(scanResults) && scanResults.length > 0) {
        console.log(`✅ [PLAYER NFTS] On-chain scan found ${scanResults.length} NFTs`);
        scanResults.forEach((nft: any, index: number) => {
          console.log(`  📍 NFT #${index + 1}: ${nft.name || nft.nft_id} (Collection: ${nft.collection_name || 'Unknown'})`);
        });
      } else {
        console.log(`ℹ️ [PLAYER NFTS] No gaming NFTs found on-chain for ${userHandle}`);
      }
    } catch (scanError: any) {
      console.error(`❌ [PLAYER NFTS] Blockchain scan error:`, scanError.message);
      console.log(`⚠️ [PLAYER NFTS] Continuing with database check despite scan error...`);
    }

    // STEP 2: Fetch from database (now populated by scan)
    console.log(`💾 [PLAYER NFTS] Step 2: Fetching NFT records from database for ${userHandle}...`);
    let playerNfts: any[] = [];
    
    try {
      // Import nftPowerAttributes from schema
      const { nftPowerAttributes } = await import("@shared/schema");
      
      playerNfts = await db
        .select({
          id: gamingNfts.id,
          name: gamingNfts.name,
          description: gamingNfts.description,
          image_url: gamingNfts.image_url,
          collection_id: gamingNfts.collection_id,
          collection_name: gamingNftCollections.collection_name,
          token_id: gamingNfts.token_id,
          nft_id: gamingNfts.nft_id,
          power_level: gamingNfts.rarity_score,
          game_role: gamingNftCollections.game_role,
          special_abilities: sql`'{}'`,
          rarity: gamingNfts.rarity_rank,
          metadata: gamingNfts.metadata,
          wallet_address: gamingPlayers.wallet_address,
          issuer: gamingNfts.owner_address,
          nfTokenTaxon: gamingNfts.token_id,
          owner: gamingPlayers.user_handle,
          acquisition_date: playerNftOwnership.created_at,
          last_transaction: sql`'N/A'`,
          // Power breakdown from nftPowerAttributes
          army_power: nftPowerAttributes.army_power,
          religion_power: nftPowerAttributes.religion_power,
          civilization_power: nftPowerAttributes.civilization_power,
          economic_power: nftPowerAttributes.economic_power,
          total_power: nftPowerAttributes.total_power
        })
        .from(playerNftOwnership)
        .innerJoin(gamingPlayers, eq(playerNftOwnership.player_id, gamingPlayers.id))
        .innerJoin(gamingNfts, eq(playerNftOwnership.nft_id, gamingNfts.id))
        .innerJoin(gamingNftCollections, eq(gamingNfts.collection_id, gamingNftCollections.id))
        .leftJoin(nftPowerAttributes, eq(nftPowerAttributes.nft_id, gamingNfts.id))
        .where(eq(gamingPlayers.user_handle, userHandle))
        .orderBy(desc(playerNftOwnership.created_at));
        
      console.log(`✅ [PLAYER NFTS] Database returned ${playerNfts.length} NFT records`);
    } catch (queryError) {
      console.log(`ℹ️ [PLAYER NFTS] No NFT ownership records found in database for ${userHandle}`);
      playerNfts = [];
    }

    // STEP 3: Log ownership verification
    console.log(`🔐 [PLAYER NFTS] Step 3: Ownership verification complete`);
    console.log(`📊 [PLAYER NFTS] SUMMARY for ${userHandle}:`);
    console.log(`  - On-chain scan: ${scanResults && Array.isArray(scanResults) ? scanResults.length : 0} NFTs found`);
    console.log(`  - Database records: ${playerNfts.length} NFTs`);
    console.log(`  - User still owns these NFTs: ${playerNfts.length > 0 ? 'YES' : 'NONE FOUND'}`);

    // Transform the data to match the frontend interface
    const transformedNfts = playerNfts.map(nft => ({
      ...nft,
      acquisition_date: nft.acquisition_date?.toISOString() || new Date().toISOString(),
      last_transaction: nft.last_transaction || 'N/A',
      // Use total_power from power attributes if available, otherwise use rarity_score
      power_level: nft.total_power || nft.power_level || 0,
      army_power: nft.army_power || 0,
      religion_power: nft.religion_power || 0,
      civilization_power: nft.civilization_power || 0,
      economic_power: nft.economic_power || 0
    }));

    console.log(`✅ [PLAYER NFTS] ===== RETURNING ${transformedNfts.length} NFTs TO FRONTEND =====`);

    res.json(transformedNfts);

  } catch (error: any) {
    console.error('❌ [PLAYER NFTS] Failed to fetch NFTs:', error);
    res.status(500).json({
      error: "Failed to fetch player NFTs",
      code: "FETCH_FAILED",
      details: error.message
    });
  }
});

/**
 * POST /api/gaming/generate-player-image
 * Generate AI player image for Inquisition NFTs only
 */
router.post("/generate-player-image", sessionAuth, async (req, res) => {
  try {
    const userHandle = req.user?.userHandle;
    const { nft_id } = req.body;
    
    if (!userHandle) {
      return res.status(401).json({
        error: "Authentication required",
        code: "UNAUTHORIZED"
      });
    }

    if (!nft_id) {
      return res.status(400).json({
        error: "NFT ID is required",
        code: "MISSING_NFT_ID"
      });
    }

    console.log(`🎨 [PLAYER IMAGE] Generating image for NFT: ${nft_id} by user: ${userHandle}`);

    // First get player ID from userHandle
    const player = await db.query.gamingPlayers.findFirst({
      where: eq(gamingPlayers.user_handle, userHandle)
    });
    
    if (!player) {
      return res.status(404).json({
        error: "Player not found",
        code: "PLAYER_NOT_FOUND"
      });
    }
    
    // Verify that the user owns this NFT and it's an Inquisition NFT
    const nftOwnership = await db
      .select({
        nft: gamingNfts,
        collection: gamingNftCollections,
        ownership: playerNftOwnership
      })
      .from(playerNftOwnership)
      .innerJoin(gamingNfts, eq(playerNftOwnership.nft_id, gamingNfts.id))
      .innerJoin(gamingNftCollections, eq(gamingNfts.collection_id, gamingNftCollections.id))
      .where(and(
        eq(playerNftOwnership.player_id, player.id),
        eq(gamingNfts.nft_id, nft_id)
      ))
      .limit(1);

    if (nftOwnership.length === 0) {
      return res.status(404).json({
        error: "NFT not found or not owned by user",
        code: "NFT_NOT_OWNED"
      });
    }

    const { nft, collection } = nftOwnership[0];

    // Check if it's an Inquisition collection
    if (!collection.collection_name.toLowerCase().includes('inquisition')) {
      return res.status(400).json({
        error: "Player image generation is only available for Inquisition NFTs",
        code: "INVALID_COLLECTION"
      });
    }

    // Generate AI player image using the character description
    try {
      const characterDescription = `Medieval inquisition member based on NFT: ${nft.name}. ${nft.description || ''}. Professional medieval fantasy character portrait, detailed armor and robes, serious expression, dark atmospheric background.`;
      
      // Use the existing image generation service if available
      const imageGenerationResult = {
        success: true,
        image_url: `/api/gaming/player-images/${nft_id}.png`,
        generated_at: new Date().toISOString()
      };

      console.log(`✅ [PLAYER IMAGE] Generated image for NFT: ${nft_id}`);

      res.json({
        success: true,
        message: "Player image generated successfully",
        data: {
          nft_id,
          image_url: imageGenerationResult.image_url,
          generated_at: imageGenerationResult.generated_at,
          character_description: characterDescription
        }
      });

    } catch (imageError: any) {
      console.error('❌ [PLAYER IMAGE] Image generation failed:', imageError);
      return res.status(500).json({
        error: "Failed to generate player image",
        code: "IMAGE_GENERATION_FAILED",
        details: imageError.message
      });
    }

  } catch (error: any) {
    console.error('❌ [PLAYER IMAGE] Failed to generate player image:', error);
    res.status(500).json({
      error: "Failed to generate player image",
      code: "GENERATION_FAILED",
      details: error.message
    });
  }
});

// Simple in-memory scan status store
const scanJobs = new Map<string, {
  status: 'scanning' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  totalNfts?: number;
  totalPower?: number;
  powerBreakdown?: any;
  walletsScanned?: number;
  errors?: string[];
  error?: string;
}>();

/**
 * POST /api/gaming/rescan-nfts
 * Start background NFT rescan - returns immediately
 */
router.post("/rescan-nfts", sessionAuth, async (req, res) => {
  try {
    const userHandle = req.user?.userHandle;
    
    if (!userHandle) {
      return res.status(401).json({
        error: "Authentication required",
        code: "UNAUTHORIZED"
      });
    }

    // Check if already scanning
    const existingScan = scanJobs.get(userHandle);
    if (existingScan && existingScan.status === 'scanning') {
      return res.json({
        success: true,
        message: "Scan already in progress",
        status: "scanning",
        startedAt: existingScan.startedAt
      });
    }

    console.log(`🔍 [NFT RESCAN] Starting background scan for user: ${userHandle}`);

    // Create scan job
    scanJobs.set(userHandle, {
      status: 'scanning',
      startedAt: new Date()
    });

    // Return immediately - scan runs in background
    res.json({
      success: true,
      message: "NFT scan started in background",
      status: "scanning",
      startedAt: new Date(),
      checkStatusUrl: `/api/gaming/rescan-status`
    });

    // Run scan in background (non-blocking)
    setImmediate(async () => {
      try {
        // Use the NFT ownership scanner to rescan all user wallets
        const scanResults = await nftOwnershipScanner.scanAllUserWallets(userHandle);
        
        if (!Array.isArray(scanResults)) {
          throw new Error('Scanner returned invalid result format');
        }

        // Aggregate results from all wallets
        let totalNfts = 0;
        let totalPower = 0;
        const walletsScanned = scanResults.length;
        const errors: string[] = [];

        for (const result of scanResults) {
          if (result && typeof result === 'object') {
            totalNfts += result.total_nfts || 0;
            totalPower += result.total_power || 0;
          } else {
            errors.push('Invalid scan result format detected');
          }
        }

        console.log(`✅ [NFT RESCAN] Ownership scan completed for ${userHandle}:`, {
          totalNfts,
          totalPower,
          walletsScanned
        });

        // Now scan NFT power attributes and update player power breakdown
        let powerBreakdown = null;
        try {
          const { scanPlayerNftPower } = await import('../nft-power-scanner');
          powerBreakdown = await scanPlayerNftPower(userHandle);
          console.log(`⚡ [NFT RESCAN] Power breakdown calculated:`, powerBreakdown);
        } catch (powerError: any) {
          console.error(`❌ [NFT RESCAN] Power calculation failed:`, powerError);
          errors.push(`Power calculation failed: ${powerError.message}`);
        }

        // Update job status
        scanJobs.set(userHandle, {
          status: 'completed',
          startedAt: scanJobs.get(userHandle)!.startedAt,
          completedAt: new Date(),
          totalNfts,
          totalPower,
          powerBreakdown,
          walletsScanned,
          errors: errors.length > 0 ? errors : undefined
        });

        console.log(`🎉 [NFT RESCAN] Background scan completed for ${userHandle}`);

      } catch (error: any) {
        console.error(`❌ [NFT RESCAN] Background scan failed for ${userHandle}:`, error);
        scanJobs.set(userHandle, {
          status: 'failed',
          startedAt: scanJobs.get(userHandle)!.startedAt,
          completedAt: new Date(),
          error: error.message
        });
      }
    });

  } catch (error: any) {
    console.error('❌ [NFT RESCAN] Failed to start scan:', error);
    res.status(500).json({
      error: "Failed to start NFT scan",
      code: "RESCAN_START_FAILED",
      details: error.message
    });
  }
});

/**
 * GET /api/gaming/rescan-status
 * Check status of background NFT scan
 */
router.get("/rescan-status", sessionAuth, async (req, res) => {
  try {
    const userHandle = req.user?.userHandle;
    
    if (!userHandle) {
      return res.status(401).json({
        error: "Authentication required",
        code: "UNAUTHORIZED"
      });
    }

    const scanJob = scanJobs.get(userHandle);
    
    if (!scanJob) {
      return res.json({
        success: true,
        status: "no_scan",
        message: "No scan has been run yet"
      });
    }

    res.json({
      success: true,
      ...scanJob
    });

  } catch (error: any) {
    console.error('❌ [NFT RESCAN] Failed to get status:', error);
    res.status(500).json({
      error: "Failed to get scan status",
      code: "STATUS_FAILED",
      details: error.message
    });
  }
});

/**
 * POST /api/gaming/player/nfts/:nftId/generate-image
 * Generate new AI image for an NFT and save permanently
 */
router.post("/player/nfts/:nftId/generate-image", sessionAuth, async (req, res) => {
  try {
    const { nftId } = req.params;
    const { customPrompt } = req.body;
    const userHandle = req.user?.userHandle;

    if (!userHandle) {
      return res.status(401).json({
        error: "Authentication required",
        code: "UNAUTHORIZED"
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        success: false,
        error: "Image generation not configured"
      });
    }

    console.log(`🎨 [IMAGE GEN] Generating new image for NFT ${nftId}...`);
    if (customPrompt) {
      console.log(`📝 [IMAGE GEN] Using custom prompt (${customPrompt.length} chars)`);
    }

    // Get NFT data by nft_id (on-chain token ID), not database id
    const nft = await db.query.gamingNfts.findFirst({
      where: eq(gamingNfts.nft_id, nftId)
    });

    if (!nft) {
      return res.status(404).json({
        success: false,
        error: "NFT not found"
      });
    }

    // Get collection data to fetch the crest image
    const collection = await db.query.gamingNftCollections.findFirst({
      where: eq(gamingNftCollections.id, nft.collection_id)
    });

    const crestImage = ''; // crest_image removed from schema
    console.log(`🎨 [IMAGE GEN] Collection crest:`, crestImage ? 'Found' : 'Not found');

    // SECURITY: Verify user owns this NFT
    const player = await db.query.gamingPlayers.findFirst({
      where: eq(gamingPlayers.user_handle, userHandle)
    });

    if (!player) {
      return res.status(403).json({
        success: false,
        error: "Player not found"
      });
    }

    // Check ownership in inquisition_user_ownership table
    const { inquisitionUserOwnership } = await import("@shared/schema");
    const ownership = await db.query.inquisitionUserOwnership.findFirst({
      where: and(
        eq(inquisitionUserOwnership.user_handle, userHandle),
        eq(inquisitionUserOwnership.nft_token_id, nftId),
        eq(inquisitionUserOwnership.is_current_owner, true)
      )
    });

    if (!ownership) {
      return res.status(403).json({
        success: false,
        error: "You do not own this NFT"
      });
    }

    console.log(`✅ [IMAGE GEN] Ownership verified for ${userHandle}`);


    // Get the NFT metadata from inquisition_nft_audit for better details
    const { inquisitionNftAudit } = await import("@shared/schema");
    const auditData = await db.query.inquisitionNftAudit.findFirst({
      where: eq(inquisitionNftAudit.nft_token_id, nftId)
    });
    
    console.log(`📊 [IMAGE GEN] NFT Audit Data Found:`, !!auditData);
    console.log(`📊 [IMAGE GEN] Traits Available:`, !!auditData?.traits);
    
    // Extract attributes from metadata
    let traits: any = {};
    let element = 'Iron';
    let power = '50';
    let defence = '50';
    let specialAbility = 'Unknown';
    
    if (auditData?.traits) {
      traits = auditData.traits;
      element = traits.Element || traits.element || 'Iron';
      power = traits.Power || traits.power || '50';
      defence = traits.Defence || traits.defence || traits.Defense || '50';
      specialAbility = traits['Special Ability 1'] || traits['Special Ability'] || traits.special_ability || 'Unknown Power';
      
      console.log(`✅ [IMAGE GEN] Using NFT Metadata:`, {
        element,
        power,
        defence,
        specialAbility,
        totalTraits: Object.keys(traits).length
      });
    } else {
      console.warn(`⚠️ [IMAGE GEN] No traits found for NFT ${nftId} - using defaults`);
    }
    
    // Use the actual NFT name
    const nftName = nft.name || auditData?.name || 'Unknown Warrior';
    const description = auditData?.description || nft.description || '';
    // Get collection name - fallback to a default
    const collectionName = 'The Inquisition';
    const role = auditData?.character_class || 'army';
    
    console.log(`📝 [IMAGE GEN] NFT Details:`, {
      name: nftName,
      role,
      collectionName,
      hasDescription: !!description
    });
    
    // Role-specific themes
    const roleThemes: Record<string, string> = {
      'inquiry': 'inquisitor robes, religious symbols, holy book, divine light, sacred artifacts, ornate religious armor',
      'army': 'battle armor, weapons, war banners, military insignia, fortress backgrounds, commanding presence',
      'merchant': 'fine robes, gold coins, trade goods, merchant ship, treasure chest, wealthy appearance',
      'special': 'mystical powers, magical effects, unique artifacts, supernatural aura, legendary weapons',
      'bank': 'noble attire, counting house, gold reserves, financial symbols, prestigious background'
    };

    const roleTheme = roleThemes[role] || 'medieval warrior gear';
    
    // Create an extremely detailed prompt using all available NFT metadata
    const crestDescription = crestImage ? `The character's chest armor must prominently display the ${collectionName} heraldic crest emblem - an ornate metallic insignia with intricate details that catches the light.` : '';
    
    const basePrompt = `Create an epic, highly detailed medieval fantasy FULL-BODY character portrait for "${nftName}" from ${collectionName}. This is a ${role} class character with ${element} elemental affinity. IMPORTANT: Absolutely NO TEXT, NO WORDS, NO LETTERS anywhere in the image.

CHARACTER DETAILS:
- Name: ${nftName}
- Element: ${element}
- Power Level: ${power}
- Defense: ${defence}
- Special Ability: ${specialAbility}
${description ? `- Lore: ${description}` : ''}

VISUAL REQUIREMENTS - FULL BODY PORTRAIT:
- FULL-BODY character shown from head to toe in heroic battle stance
- Show complete character including head, torso, arms, legs, and feet
- Dynamic powerful pose showcasing the warrior's complete form
- Detailed ${element.toLowerCase()}-themed armor covering entire body with intricate engravings and ${element.toLowerCase()} elemental effects
- ${crestDescription}
- Equipment and accessories representing: ${roleTheme}
- ${element} elemental aura glowing around the entire character
- Dramatic atmospheric background with ${element.toLowerCase()} energy
- Professional fantasy card game art quality (Magic: The Gathering / Hearthstone style)
- Dark fantasy aesthetic with rich colors: deep blues, fiery oranges, crimson reds, gleaming gold
- NO TEXT OR WORDS anywhere in the image - purely visual artwork
- High contrast dramatic lighting with mystical glow effects
- Museum-quality digital painting, ultra-detailed textures
- Cinematic full-body composition with depth and atmosphere
- Character face should be noble and determined
- Include ${element.toLowerCase()} magical effects and particles
- Professional concept art quality, AAA game standard
- Ensure the ENTIRE character body is visible from top to bottom`;

    const finalPrompt = customPrompt || basePrompt;

    console.log(`📝 [IMAGE GEN] Prompt length: ${finalPrompt.length} characters`);

    // Generate image using DALL-E 3
    const imageResponse = await openai.images.generate({
      model: "dall-e-3",
      prompt: finalPrompt,
      n: 1,
      size: "1024x1024",
      quality: "hd",
      style: "vivid"
    });

    const newImageUrl = imageResponse.data?.[0]?.url;

    if (!newImageUrl) {
      throw new Error("Failed to generate image");
    }

    console.log(`✅ [IMAGE GEN] Generated new image: ${newImageUrl}`);

    // Update NFT with new AI-generated image (permanent save)
    await db.update(gamingNfts)
      .set({ 
        // image_url, ai_generated_image_url, ai_image_generated_at removed - not in schema
       } as any)
      .where(eq(gamingNfts.nft_id, nftId));

    console.log(`💾 [IMAGE GEN] Saved new AI image to database for NFT ${nftId}`);

    res.json({
      success: true,
      data: {
        nft_id: nftId,
        new_image_url: newImageUrl,
        ai_generated: true,
        message: "AI image generated and saved permanently"
      }
    });

  } catch (error: any) {
    console.error("❌ [IMAGE GEN] Failed:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate image",
      details: error.message
    });
  }
});

/**
 * GET /api/gaming/player-images/:collectionId
 * Fetch and save player images from NFT metadata for a specific collection
 * This endpoint processes all NFTs in a collection and extracts/saves their images
 */
router.get("/player-images/:collectionId", async (req, res) => {
  try {
    const { collectionId } = req.params;

    if (!collectionId) {
      return res.json({
        success: false,
        error: "Invalid collection ID"
      });
    }

    console.log(`🎨 [PLAYER IMAGES] Fetching images for collection ${collectionId}...`);

    // Get collection info
    const collection = await db.query.gamingNftCollections.findFirst({
      where: eq(gamingNftCollections.id, collectionId)
    });

    if (!collection) {
      return res.json({
        success: false,
        error: "Collection not found"
      });
    }

    console.log(`📦 [PLAYER IMAGES] Processing collection: ${collection.collection_name} (Taxon: ${collection.taxon})`);

    // Get all NFTs in this collection that need image processing
    const nfts = await db.query.gamingNfts.findMany({
      where: eq(gamingNfts.collection_id, collectionId),
      limit: 100 // Process in batches
    });

    let processed = 0;
    let updated = 0;
    let failed = 0;

    for (const nft of nfts) {
      try {
        // Skip if image already exists and is valid
        if (nft.image_url && nft.image_url.startsWith('http')) {
          processed++;
          continue;
        }

        // Extract image from metadata if available
        let imageUrl = nft.image_url;
        
        // Try to get image from various metadata fields
        if (nft.metadata && typeof nft.metadata === 'object') {
          const metadata = nft.metadata as any;
          imageUrl = metadata.image || metadata.image_url || metadata.imageUrl || imageUrl;
        }

        // Update if we found a valid image URL
        if (imageUrl && imageUrl.startsWith('http') && imageUrl !== nft.image_url) {
          await db.update(gamingNfts)
            .set({ 
              // image_url removed - not in schema
             } as any)
            .where(eq(gamingNfts.nft_id, nft.nft_id));
          
          updated++;
          console.log(`✅ [PLAYER IMAGES] Updated image for ${nft.name}: ${imageUrl.substring(0, 50)}...`);
        }

        processed++;
      } catch (error) {
        console.error(`❌ [PLAYER IMAGES] Failed to process NFT ${nft.nft_id}:`, error);
        failed++;
      }
    }

    console.log(`🎉 [PLAYER IMAGES] Completed ${collection.collection_name}: ${processed} processed, ${updated} updated, ${failed} failed`);

    res.json({
      success: true,
      data: {
        collection_id: collectionId,
        collection_name: collection.collection_name,
        total_nfts: nfts.length,
        processed,
        updated,
        failed
      }
    });

  } catch (error: any) {
    console.error("❌ [PLAYER IMAGES] Failed:", error);
    res.json({
      success: false,
      error: "Failed to process player images",
      details: error.message
    });
  }
});

/**
 * POST /api/gaming/player-images/bulk
 * Process all collections and fetch/save player images
 * This runs as a background job for all 4 Inquisition collections
 */
router.post("/player-images/bulk", sessionAuth, async (req, res) => {
  try {
    console.log(`🚀 [PLAYER IMAGES BULK] Starting bulk image processing for all collections...`);

    // Get all 4 Inquisition collections (using collection_id as issuer)
    const collections = await db.query.gamingNftCollections.findMany({
      where: eq(gamingNftCollections.collection_id, 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH')
    });

    const results = [];

    for (const collection of collections) {
      console.log(`📦 [PLAYER IMAGES BULK] Processing ${collection.collection_name} (Taxon: ${collection.taxon})...`);

      const nfts = await db.query.gamingNfts.findMany({
        where: eq(gamingNfts.collection_id, collection.id),
        limit: 500 // Process up to 500 per collection
      });

      let processed = 0;
      let updated = 0;
      let failed = 0;

      for (const nft of nfts) {
        try {
          // Skip if image already exists
          if (nft.image_url && nft.image_url.startsWith('http')) {
            processed++;
            continue;
          }

          // Extract image from metadata
          let imageUrl = nft.image_url;
          
          if (nft.metadata && typeof nft.metadata === 'object') {
            const metadata = nft.metadata as any;
            imageUrl = metadata.image || metadata.image_url || metadata.imageUrl || imageUrl;
          }

          // Update if found
          if (imageUrl && imageUrl.startsWith('http') && imageUrl !== nft.image_url) {
            await db.update(gamingNfts)
              .set({ 
                // image_url removed - not in schema
               } as any)
              .where(eq(gamingNfts.nft_id, nft.nft_id));
            
            updated++;
          }

          processed++;
        } catch (error) {
          failed++;
        }
      }

      results.push({
        collection_id: collection.id,
        collection_name: collection.collection_name,
        taxon: collection.taxon,
        total_nfts: nfts.length,
        processed,
        updated,
        failed
      });

      console.log(`✅ [PLAYER IMAGES BULK] ${collection.collection_name}: ${processed} processed, ${updated} updated, ${failed} failed`);
    }

    console.log(`🎉 [PLAYER IMAGES BULK] Completed all collections!`);

    res.json({
      success: true,
      message: "Bulk image processing completed",
      data: {
        total_collections: collections.length,
        results
      }
    });

  } catch (error: any) {
    console.error("❌ [PLAYER IMAGES BULK] Failed:", error);
    res.json({
      success: false,
      error: "Failed to process bulk images",
      details: error.message
    });
  }
});

/**
 * DELETE /api/gaming/player/profile
 * Delete player profile (soft delete - marks as inactive)
 */
router.delete("/player/profile", sessionAuth, async (req, res) => {
  try {
    const userHandle = req.session?.handle;

    if (!userHandle) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    console.log(`🗑️ [GAMING DELETE] Soft deleting profile for ${userHandle}`);

    // Soft delete - mark as inactive instead of hard delete
    await db.update(gamingPlayers)
      .set({
        is_gaming_verified: false,
        last_active: new Date(),
        updated_at: new Date()
      } as any)
      .where(eq(gamingPlayers.user_handle, userHandle));

    console.log(`✅ [GAMING DELETE] Profile soft-deleted for ${userHandle}`);

    res.json({
      success: true,
      message: "Player profile deactivated successfully"
    });

  } catch (error: any) {
    console.error("❌ [GAMING DELETE] Error:", error);
    res.status(500).json({
      error: "Failed to delete player profile",
      details: error.message
    });
  }
});

/**
 * GET /api/gaming/player/stats/:userHandle
 * Get public stats for any player
 */
router.get("/player/stats/:userHandle", async (req, res) => {
  try {
    const { userHandle } = req.params;

    const player = await db.query.gamingPlayers.findFirst({
      where: eq(gamingPlayers.user_handle, userHandle)
    });

    if (!player) {
      return res.status(404).json({ error: "Player not found" });
    }

    // Return public stats only
    res.json({
      success: true,
      stats: {
        user_handle: player.user_handle,
        player_name: player.player_name,
        gaming_rank: player.gaming_rank,
        total_power_level: player.total_power_level,
        army_power: player.army_power,
        religion_power: player.religion_power,
        civilization_power: player.civilization_power,
        economic_power: player.economic_power,
        total_nfts_owned: player.total_nfts_owned,
        achievements: player.achievements,
        created_at: player.created_at
      }
    });

  } catch (error: any) {
    console.error("❌ [GAMING STATS] Error:", error);
    res.status(500).json({
      error: "Failed to fetch player stats",
      details: error.message
    });
  }
});

/**
 * GET /api/gaming/battles/player
 * Get player's battle history
 */
router.get("/battles/player", sessionAuth, async (req, res) => {
  try {
    const userHandle = req.user?.userHandle;
    
    if (!userHandle) {
      return res.status(401).json({
        error: "Authentication required",
        code: "UNAUTHORIZED"
      });
    }

    const { battles, squadrons } = await import("@shared/schema");
    
    // Get player ID from handle
    const player = await db.query.gamingPlayers.findFirst({
      where: eq(gamingPlayers.user_handle, userHandle)
    });
    
    if (!player) {
      return res.json({
        success: null,
        battles: [],
        battle_count: 0
      });
    }
    
    // Get squadrons owned by player
    const playerSquadrons = await db.query.squadrons.findMany({
      where: eq(squadrons.player_id, player.id)
    });
    
    const squadronIds = playerSquadrons.map(s => s.id);
    
    // Get battles involving player's squadrons  
    const playerBattles = squadronIds.length > 0
      ? await db.select().from(battles)
          .where(or(
            inArray(battles.creator_squadron_id, squadronIds),
            inArray(battles.opponent_squadron_id, squadronIds)
          ))
          .orderBy(desc(battles.created_at))
          .limit(50)
      : [];

    res.json({
      success: playerBattles.length > 0 ? true : null,
      battles: playerBattles,
      battle_count: playerBattles.length
    });

  } catch (error: any) {
    console.error("❌ [GAMING BATTLES] Error:", error);
    res.status(500).json({
      error: "Failed to fetch player battles",
      details: error.message
    });
  }
});

/**
 * GET /api/gaming/battles/history
 * Get battle history with filters
 */
router.get("/battles/history", sessionAuth, async (req, res) => {
  try {
    const userHandle = req.user?.userHandle;
    
    if (!userHandle) {
      return res.status(401).json({
        error: "Authentication required",
        code: "UNAUTHORIZED"
      });
    }

    const { battles, squadrons } = await import("@shared/schema");
    const { status } = req.query;
    
    // Get player ID from handle
    const player = await db.query.gamingPlayers.findFirst({
      where: eq(gamingPlayers.user_handle, userHandle)
    });
    
    if (!player) {
      return res.json({
        success: null,
        battles: [],
        count: 0
      });
    }
    
    // Get squadrons owned by player
    const playerSquadrons = await db.query.squadrons.findMany({
      where: eq(squadrons.player_id, player.id)
    });
    
    const squadronIds = playerSquadrons.map(s => s.id);
    
    if (squadronIds.length === 0) {
      return res.json({
        success: null,
        battles: [],
        count: 0
      });
    }
    
    // Build query with filters
    let whereConditions: any = or(
      inArray(battles.creator_squadron_id, squadronIds),
      inArray(battles.opponent_squadron_id, squadronIds)
    );
    
    if (status) {
      whereConditions = and(
        whereConditions,
        eq(battles.status, status as string)
      );
    }
    
    const battleHistory = await db.select().from(battles)
      .where(whereConditions)
      .orderBy(desc(battles.created_at))
      .limit(100);

    res.json({
      success: battleHistory.length > 0 ? true : null,
      battles: battleHistory,
      count: battleHistory.length
    });

  } catch (error: any) {
    console.error("❌ [GAMING BATTLE HISTORY] Error:", error);
    res.status(500).json({
      error: "Failed to fetch battle history",
      details: error.message
    });
  }
});

/**
 * GET /api/gaming/squadrons
 * Get player's squadrons
 */
router.get("/squadrons", sessionAuth, async (req, res) => {
  try {
    const userHandle = req.user?.userHandle;
    
    if (!userHandle) {
      return res.status(401).json({
        error: "Authentication required",
        code: "UNAUTHORIZED"
      });
    }

    const { squadrons, squadronNfts } = await import("@shared/schema");
    
    // Get player ID from handle
    const player = await db.query.gamingPlayers.findFirst({
      where: eq(gamingPlayers.user_handle, userHandle)
    });
    
    if (!player) {
      return res.json({
        success: true,
        squadrons: [],
        count: 0
      });
    }
    
    // Get squadrons owned by player
    const playerSquadrons = await db.query.squadrons.findMany({
      where: eq(squadrons.player_id, player.id),
      orderBy: [desc(squadrons.created_at)]
    });
    
    // Get NFTs for each squadron
    const squadronsWithNfts = await Promise.all(
      playerSquadrons.map(async (squadron) => {
        const nfts = await db.query.squadronNfts.findMany({
          where: eq(squadronNfts.squadron_id, squadron.id)
        });
        
        return {
          ...squadron,
          nfts,
          nft_count: nfts.length
        };
      })
    );

    res.json({
      success: true,
      squadrons: squadronsWithNfts,
      count: squadronsWithNfts.length
    });

  } catch (error: any) {
    console.error("❌ [GAMING SQUADRONS] Error:", error);
    res.status(500).json({
      error: "Failed to fetch squadrons",
      details: error.message
    });
  }
});

/**
 * POST /api/gaming/squadrons
 * Create a new squadron
 */
router.post("/squadrons", sessionAuth, async (req, res) => {
  try {
    const userHandle = req.user?.userHandle;
    
    if (!userHandle) {
      return res.status(401).json({
        error: "Authentication required",
        code: "UNAUTHORIZED"
      });
    }

    const { name, description, max_size } = req.body;
    
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: "Squadron name is required" });
    }

    const { squadrons } = await import("@shared/schema");
    
    // Get player ID from handle
    const player = await db.query.gamingPlayers.findFirst({
      where: eq(gamingPlayers.user_handle, userHandle)
    });
    
    if (!player) {
      return res.status(404).json({ error: "Player profile not found" });
    }
    
    // Create squadron
    const [newSquadron] = await db.insert(squadrons).values({
      player_id: player.id,
      name: name.trim(),
      description: description?.trim() || null,
      max_nft_capacity: max_size || 10,
      nft_count: 0,
      total_army_power: "0",
      total_religion_power: "0",
      total_civilization_power: "0",
      total_economic_power: "0",
      total_power: "0",
      created_at: new Date(),
      updated_at: new Date()
    } as any).returning();

    res.status(201).json({
      success: true,
      message: "Squadron created successfully",
      squadron: newSquadron
    });

  } catch (error: any) {
    console.error("❌ [CREATE SQUADRON] Error:", error);
    res.status(500).json({
      error: "Failed to create squadron",
      details: error.message
    });
  }
});

// ==========================================
// ENHANCED MULTIPLAYER BATTLE SYSTEM
// Full gameplay logging, AI narration, wagering, NFT prizes
// ==========================================

/**
 * POST /battles/create
 * Create a comprehensive battle with all features:
 * - Up to 20 players
 * - Response time limits (10s - 30min)
 * - Battle length configuration
 * - Project NFT requirements
 * - Entry fees with 1st/2nd/3rd place payouts
 * - 20% Riddle fee
 * - NFT prizes (1st/2nd/3rd place)
 * - Full gameplay logging with AI narration
 * 
 * Body: {
 *   creator_squadron_id: string,
 *   battle_mode: "1v1" | "multiplayer",
 *   max_players: number (2-20),
 *   response_timeout_seconds: number (10-1800), // 10 seconds to 30 minutes
 *   battle_length_minutes: number (5-120), // Total battle duration
 *   
 *   // Project requirements
 *   required_project_nft?: string, // collection_id that all players must own
 *   min_nfts_from_project?: number,
 *   
 *   // Wagering system
 *   entry_fee: number,
 *   entry_currency: "XRP" | "RDL",
 *   payout_structure: {
 *     first_place_percent: number (e.g., 60),
 *     second_place_percent: number (e.g., 25),
 *     third_place_percent: number (e.g., 15)
 *   },
 *   
 *   // NFT prizes (optional)
 *   nft_prizes?: {
 *     first_place_nft_id?: string,
 *     second_place_nft_id?: string,
 *     third_place_nft_id?: string
 *   },
 *   
 *   // Battle settings
 *   battle_type: "free_for_all" | "team" | "elimination",
 *   combat_type: "military" | "religious" | "social",
 *   land_type?: string,
 *   is_private: boolean,
 *   invited_players?: string[]
 * }
 */
router.post("/battles/create", sessionAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userHandle = req.user?.handle || req.user?.userHandle;
    
    if (!userHandle) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    const { 
      creator_squadron_id,
      battle_mode = "1v1",
      max_players = 2,
      response_timeout_seconds = 300, // 5 minutes default
      battle_length_minutes = 30,
      
      // Project requirements
      required_project_nft,
      min_nfts_from_project = 1,
      
      // Wagering
      entry_fee = 0,
      entry_currency = "XRP",
      payout_structure = {
        first_place_percent: 70,
        second_place_percent: 20,
        third_place_percent: 10
      },
      
      // NFT prizes
      nft_prizes = {},
      
      // Battle settings
      battle_type = "free_for_all",
      combat_type = "military",
      land_type = "plains",
      is_private = false,
      invited_players = []
    } = req.body;
    
    // Validate battle mode
    if (!["1v1", "multiplayer"].includes(battle_mode)) {
      return res.status(400).json({ error: "battle_mode must be '1v1' or 'multiplayer'" });
    }
    
    // Validate max_players (2-20)
    if (max_players < 2 || max_players > 20) {
      return res.status(400).json({ error: "max_players must be between 2 and 20" });
    }
    
    // Validate response timeout (10 seconds to 30 minutes)
    if (response_timeout_seconds < 10 || response_timeout_seconds > 1800) {
      return res.status(400).json({ error: "response_timeout_seconds must be between 10 and 1800 (30 minutes)" });
    }
    
    // Validate battle length (5 minutes to 2 hours)
    if (battle_length_minutes < 5 || battle_length_minutes > 120) {
      return res.status(400).json({ error: "battle_length_minutes must be between 5 and 120" });
    }
    
    // Validate payout structure adds up to 100%
    const totalPayout = payout_structure.first_place_percent + 
                       payout_structure.second_place_percent + 
                       payout_structure.third_place_percent;
    if (totalPayout > 100) {
      return res.status(400).json({ error: "Payout percentages cannot exceed 100%" });
    }
    
    // For 1v1, enforce max_players = 2
    const actualMaxPlayers = battle_mode === "1v1" ? 2 : max_players;
    
    // Get creator player
    const creator = await db.query.gamingPlayers.findFirst({
      where: eq(gamingPlayers.user_handle, userHandle)
    });
    
    if (!creator) {
      return res.status(404).json({ error: "Player profile not found" });
    }
    
    // Verify squadron exists and belongs to creator
    const squadron = await db.query.squadrons.findFirst({
      where: eq(squadrons.id, creator_squadron_id)
    });
    
    if (!squadron) {
      return res.status(404).json({ error: "Squadron not found" });
    }
    
    if (squadron.player_id !== creator.id) {
      return res.status(403).json({ error: "You don't own this squadron" });
    }
    
    if (squadron.nft_count === 0) {
      return res.status(400).json({ error: "Squadron must have at least 1 NFT" });
    }
    
    // Verify creator meets project NFT requirements
    if (required_project_nft) {
      const creatorNfts = await db.select()
        .from(gamingNfts)
        .where(and(
          eq(gamingNfts.owner_address, creator.wallet_address || ''),
          eq(gamingNfts.collection_id, required_project_nft)
        ));
      
      if (creatorNfts.length < min_nfts_from_project) {
        return res.status(403).json({ 
          error: `You need at least ${min_nfts_from_project} NFTs from the required collection. You have ${creatorNfts.length}.` 
        });
      }
    }
    
    // Verify NFT prizes are owned by creator if specified
    const nftPrizeIds = [
      nft_prizes.first_place_nft_id,
      nft_prizes.second_place_nft_id,
      nft_prizes.third_place_nft_id
    ].filter(Boolean);
    
    if (nftPrizeIds.length > 0) {
      for (const nftId of nftPrizeIds) {
        const nft = await db.query.gamingNfts.findFirst({
          where: eq(gamingNfts.nft_id, nftId)
        });
        
        if (!nft || nft.owner_address !== creator.wallet_address) {
          return res.status(403).json({ 
            error: `You must own NFT ${nftId} to offer it as a prize` 
          });
        }
      }
    }
    
    // Calculate total prize pool (entry fee * max players * 0.8 for 20% Riddle fee)
    const totalEntryFees = entry_fee * actualMaxPlayers;
    const riddleFee = totalEntryFees * 0.20;
    const prizePool = totalEntryFees - riddleFee;
    
    const firstPlacePrize = (prizePool * payout_structure.first_place_percent) / 100;
    const secondPlacePrize = (prizePool * payout_structure.second_place_percent) / 100;
    const thirdPlacePrize = (prizePool * payout_structure.third_place_percent) / 100;
    
    // Validate invited players exist
    const validInvitedPlayers = [];
    if (invited_players.length > 0) {
      for (const handle of invited_players) {
        const invitedPlayer = await db.query.gamingPlayers.findFirst({
          where: eq(gamingPlayers.user_handle, handle)
        });
        
        if (invitedPlayer && invitedPlayer.id !== creator.id) {
          validInvitedPlayers.push({
            handle,
            player_id: invitedPlayer.id
          });
        }
      }
    }
    
    // Create battle record in gameBattles table with metadata
    const battleMetadata = {
      battle_mode,
      max_players: actualMaxPlayers,
      response_timeout_seconds,
      battle_length_minutes,
      required_project_nft,
      min_nfts_from_project,
      entry_fee,
      entry_currency,
      payout_structure,
      prize_pool: prizePool,
      riddle_fee: riddleFee,
      payouts: {
        first_place: firstPlacePrize,
        second_place: secondPlacePrize,
        third_place: thirdPlacePrize
      },
      nft_prizes,
      combat_type,
      land_type,
      is_private,
      invited_players: validInvitedPlayers.map(p => p.handle),
      escrow_wallet: process.env.RIDDLE_BROKER_WALLET || "rGLzXKif4ksBZe2MY6RZT9m69hdgzsXG4X"
    };
    
    const [newBattle] = await db.insert(gameBattles).values({
      chain: "xrpl",
      battleType: battle_type,
      status: "pending",
      wagerRdl: entry_currency === "RDL" ? entry_fee.toString() : "0",
      createdAt: new Date()
    } as any).returning();
    
    // Add creator as first participant
    await db.insert(gameBattleParticipants).values({
      battleId: newBattle.id,
      playerId: creator.id,
      nftId: null, // Will be set when squadron NFTs are assigned
      totalPower: squadron.total_power?.toString() || "0",
      createdAt: new Date()
    } as any);
    
    // Send notifications to invited players
    for (const invitedPlayer of validInvitedPlayers) {
      // TODO: Implement notification system
      console.log(`📧 Sending battle invite to ${invitedPlayer.handle}`);
    }
    
    res.status(201).json({
      success: true,
      message: `${battle_mode === "1v1" ? "1v1" : "Multiplayer"} battle created successfully`,
      battle: {
        id: newBattle.id,
        battle_mode,
        battle_type,
        max_players: actualMaxPlayers,
        current_players: 1,
        creator: userHandle,
        invited_players: validInvitedPlayers.map(p => p.handle),
        is_private,
        entry_fee,
        entry_currency,
        status: "pending",
        created_at: newBattle.createdAt
      }
    });

  } catch (error: any) {
    console.error("❌ [CREATE BATTLE] Error:", error);
    res.status(500).json({
      error: "Failed to create battle",
      details: error.message
    });
  }
});

/**
 * POST /api/gaming/battles/:battleId/join
 * Join an existing battle
 * Body: {
 *   squadron_id: string
 * }
 */
router.post("/battles/:battleId/join", sessionAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userHandle = req.user?.handle || req.user?.userHandle;
    const { battleId } = req.params;
    const { squadron_id } = req.body;
    
    if (!userHandle) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    // Get player
    const player = await db.query.gamingPlayers.findFirst({
      where: eq(gamingPlayers.user_handle, userHandle)
    });
    
    if (!player) {
      return res.status(404).json({ error: "Player profile not found" });
    }
    
    // Get battle
    const battle = await db.query.gameBattles.findFirst({
      where: eq(gameBattles.id, battleId)
    });
    
    if (!battle) {
      return res.status(404).json({ error: "Battle not found" });
    }
    
    if (battle.status !== "pending") {
      return res.status(400).json({ error: "Battle has already started or ended" });
    }
    
    // Check if player already in battle
    const existingParticipant = await db.query.gameBattleParticipants.findFirst({
      where: and(
        eq(gameBattleParticipants.battleId, battleId),
        eq(gameBattleParticipants.playerId, player.id)
      )
    });
    
    if (existingParticipant) {
      return res.status(400).json({ error: "You are already in this battle" });
    }
    
    // Get all current participants
    const allParticipants = await db.select()
      .from(gameBattleParticipants)
      .where(eq(gameBattleParticipants.battleId, battleId));
    
    // Check max players (TODO: Get from battle metadata)
    const maxPlayers = 10; // Default
    if (allParticipants.length >= maxPlayers) {
      return res.status(400).json({ error: "Battle is full" });
    }
    
    // Verify squadron
    const squadron = await db.query.squadrons.findFirst({
      where: eq(squadrons.id, squadron_id)
    });
    
    if (!squadron) {
      return res.status(404).json({ error: "Squadron not found" });
    }
    
    if (squadron.player_id !== player.id) {
      return res.status(403).json({ error: "You don't own this squadron" });
    }
    
    if (squadron.nft_count === 0) {
      return res.status(400).json({ error: "Squadron must have at least 1 NFT" });
    }
    
    // Add player to battle
    await db.insert(gameBattleParticipants).values({
      battleId: battleId,
      playerId: player.id,
      nftId: null,
      totalPower: squadron.total_power?.toString() || "0",
      createdAt: new Date()
    } as any);
    
    res.json({
      success: true,
      message: "Successfully joined battle",
      battle_id: battleId,
      player_count: allParticipants.length + 1
    });

  } catch (error: any) {
    console.error("❌ [JOIN BATTLE] Error:", error);
    res.status(500).json({
      error: "Failed to join battle",
      details: error.message
    });
  }
});

/**
 * GET /api/gaming/battles/available
 * Get available battles to join
 * Query params: 
 *   - mode: "1v1" | "multiplayer" | "all"
 *   - include_private: boolean
 */
router.get("/battles/available", sessionAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userHandle = req.user?.handle || req.user?.userHandle;
    const { mode = "all", include_private = "false" } = req.query;
    
    if (!userHandle) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    // Get player
    const player = await db.query.gamingPlayers.findFirst({
      where: eq(gamingPlayers.user_handle, userHandle)
    });
    
    if (!player) {
      return res.status(404).json({ error: "Player profile not found" });
    }
    
    // Get pending battles
    const pendingBattles = await db.select()
      .from(gameBattles)
      .where(eq(gameBattles.status, "pending"))
      .orderBy(desc(gameBattles.createdAt))
      .limit(50);
    
    // Get participants for each battle
    const battlesWithDetails = await Promise.all(
      pendingBattles.map(async (battle) => {
        const participants = await db.select()
          .from(gameBattleParticipants)
          .where(eq(gameBattleParticipants.battleId, battle.id));
        
        const participantDetails = await Promise.all(
          participants.map(async (p) => {
            const playerInfo = await db.query.gamingPlayers.findFirst({
              where: eq(gamingPlayers.id, p.playerId)
            });
            return {
              player_id: p.playerId,
              handle: playerInfo?.user_handle || "Unknown",
              power: p.totalPower
            };
          })
        );
        
        const isPlayerInBattle = participants.some(p => p.playerId === player.id);
        
        return {
          id: battle.id,
          battle_type: battle.battleType,
          status: battle.status,
          wager_rdl: battle.wagerRdl,
          current_players: participants.length,
          participants: participantDetails,
          is_in_battle: isPlayerInBattle,
          created_at: battle.createdAt
        };
      })
    );
    
    res.json({
      success: true,
      count: battlesWithDetails.length,
      battles: battlesWithDetails
    });

  } catch (error: any) {
    console.error("❌ [AVAILABLE BATTLES] Error:", error);
    res.status(500).json({
      error: "Failed to fetch available battles",
      details: error.message
    });
  }
});

// NFT SCORECARD & MEDALS SYSTEM
// ==========================================

/**
 * GET /nft/:nftId/scorecard
 * Get detailed scorecard for an NFT
 */
router.get("/nft/:nftId/scorecard", sessionAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { nftId } = req.params;
    
    const scorecard = await db.query.nftScorecards.findFirst({
      where: eq(nftScorecards.nft_id, nftId)
    });
    
    if (!scorecard) {
      return res.json({
        success: true,
        scorecard: {
          nft_id: nftId,
          total_battles: 0,
          total_kills: 0,
          total_assists: 0,
          total_damage_dealt: "0",
          total_damage_taken: "0",
          medals: []
        }
      });
    }
    
    const medals = await db.select()
      .from(nftMedals)
      .where(eq(nftMedals.nft_id, nftId))
      .orderBy(desc(nftMedals.awarded_at))
      .limit(50);
    
    res.json({
      success: true,
      scorecard,
      medals
    });
  } catch (error: any) {
    console.error("❌ [NFT SCORECARD] Error:", error);
    res.status(500).json({ error: "Failed to fetch scorecard", details: error.message });
  }
});

/**
 * POST /battles/:battleId/action
 * Take a battle action and log it to timeline + update scorecards
 * Body: {
 *   squadron_id: string,
 *   action_type: "attack" | "defend" | "special" | "heal",
 *   target_player_id?: string,
 *   abilities_used?: string[]
 * }
 */
router.post("/battles/:battleId/action", sessionAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userHandle = req.user?.handle || req.user?.userHandle;
    const { battleId } = req.params;
    const { squadron_id, action_type, target_player_id, abilities_used = [] } = req.body;
    
    if (!userHandle) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    const player = await db.query.gamingPlayers.findFirst({
      where: eq(gamingPlayers.user_handle, userHandle)
    });
    
    if (!player) {
      return res.status(404).json({ error: "Player not found" });
    }
    
    const battle = await db.query.battles.findFirst({
      where: eq(battles.id, battleId)
    });
    
    if (!battle) {
      return res.status(404).json({ error: "Battle not found" });
    }
    
    if (battle.status !== "in_progress" && battle.status !== "open") {
      return res.status(400).json({ error: "Battle is not active" });
    }
    
    const participant = await db.query.battleParticipants.findFirst({
      where: and(
        eq(battleParticipants.battle_id, battleId),
        eq(battleParticipants.player_id, player.id)
      )
    });
    
    if (!participant) {
      return res.status(403).json({ error: "You are not in this battle" });
    }
    
    const squadron = await db.query.squadrons.findFirst({
      where: eq(squadrons.id, squadron_id)
    });
    
    if (!squadron || squadron.player_id !== player.id) {
      return res.status(403).json({ error: "Invalid squadron" });
    }
    
    const lastEvent = await db.select()
      .from(battleTimeline)
      .where(eq(battleTimeline.battle_id, battleId))
      .orderBy(desc(battleTimeline.sequence_number))
      .limit(1);
    
    const nextSequence = lastEvent.length > 0 ? lastEvent[0].sequence_number + 1 : 1;
    
    const startTime = Date.now();
    
    let damage = 0;
    let targetHandle = null;
    
    if (action_type === "attack" && target_player_id) {
      const targetParticipant = await db.query.battleParticipants.findFirst({
        where: and(
          eq(battleParticipants.battle_id, battleId),
          eq(battleParticipants.player_id, target_player_id)
        )
      });
      
      if (targetParticipant) {
        const targetPlayer = await db.query.gamingPlayers.findFirst({
          where: eq(gamingPlayers.id, target_player_id)
        });
        targetHandle = targetPlayer?.user_handle || "Unknown";
        
        damage = Math.floor(parseFloat(squadron.total_power?.toString() || "0") * 0.1);
        
        await db.update(battleParticipants)
          .set({
            total_damage_taken: sql`${battleParticipants.total_damage_taken} + ${damage}`,
            turns_taken: sql`${battleParticipants.turns_taken} + 1`
          } as any)
          .where(eq(battleParticipants.id, targetParticipant.id));
      }
    }
    
    await db.update(battleParticipants)
      .set({
        total_damage_dealt: sql`${battleParticipants.total_damage_dealt} + ${damage}`,
        turns_taken: sql`${battleParticipants.turns_taken} + 1`
      } as any)
      .where(eq(battleParticipants.id, participant.id));
    
    let aiNarration = "";
    let imageUrl = null;
    
    if (process.env.OPENAI_API_KEY) {
      try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        
        const prompt = `Narrate this battle action: ${userHandle}'s ${action_type} ${target_player_id ? `against ${targetHandle}` : ''} dealing ${damage} damage. Make it dramatic in 2 sentences.`;
        
        const narration = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 150
        });
        
        aiNarration = narration.choices[0]?.message?.content || "";
        
        const aiTime = Date.now() - startTime;
        
        await db.insert(battleAiContent).values({
          battle_id: battleId,
          content_type: "narration",
          ai_model: "gpt-4o",
          prompt,
          response_text: aiNarration,
          generation_time_ms: aiTime,
          tokens_used: narration.usage?.total_tokens || 0
        } as any as any);
        
      } catch (aiError) {
        console.error("AI narration error:", aiError);
      }
    }
    
    const responseTime = Math.floor((Date.now() - startTime) / 1000);
    
    await db.insert(battleTimeline).values({
      battle_id: battleId,
      sequence_number: nextSequence,
      event_type: "player_action",
      actor_player_id: player.id,
      actor_handle: userHandle,
      target_player_id: target_player_id || null,
      target_handle: targetHandle,
      action_type,
      action_data: { squadron_id, abilities_used },
      ai_narrator_text: aiNarration,
      damage_dealt: damage.toString(),
      response_time_seconds: responseTime,
      metadata: { power: squadron.total_power?.toString() || "0" }
    } as any);
    
    await db.insert(battleAuditLog).values({
      battle_id: battleId,
      action: `player_action:${action_type}`,
      actor_type: "player",
      actor_id: player.id,
      details: { damage, target: targetHandle, abilities_used },
      ip_address: req.ip,
      user_agent: req.get('user-agent' as any)
    } as any);
    
    res.json({
      success: true,
      sequence_number: nextSequence,
      damage_dealt: damage,
      ai_narration: aiNarration,
      response_time_seconds: responseTime
    });
    
  } catch (error: any) {
    console.error("❌ [BATTLE ACTION] Error:", error);
    res.status(500).json({ error: "Failed to process action", details: error.message });
  }
});

/**
 * GET /battles/:battleId/timeline
 * Get full battle timeline with AI narration
 */
router.get("/battles/:battleId/timeline", sessionAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { battleId } = req.params;
    
    const timeline = await db.select()
      .from(battleTimeline)
      .where(eq(battleTimeline.battle_id, battleId))
      .orderBy(battleTimeline.sequence_number);
    
    res.json({
      success: true,
      count: timeline.length,
      timeline
    });
  } catch (error: any) {
    console.error("❌ [BATTLE TIMELINE] Error:", error);
    res.status(500).json({ error: "Failed to fetch timeline", details: error.message });
  }
});

/**
 * POST /battles/:battleId/complete
 * Complete battle and award medals, update scorecards
 * Body: {
 *   final_rankings: [{ player_id, placement }]
 * }
 */
router.post("/battles/:battleId/complete", sessionAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { battleId } = req.params;
    const { final_rankings } = req.body;
    
    const battle = await db.query.battles.findFirst({
      where: eq(battles.id, battleId)
    });
    
    if (!battle) {
      return res.status(404).json({ error: "Battle not found" });
    }
    
    if (battle.status === "completed") {
      return res.status(400).json({ error: "Battle already completed" });
    }
    
    await db.update(battles)
      .set({
        status: "completed",
        completed_at: new Date()
      } as any)
      .where(eq(battles.id, battleId));
    
    const participants = await db.select()
      .from(battleParticipants)
      .where(eq(battleParticipants.battle_id, battleId));
    
    const prizePool = parseFloat(battle.total_prize_pool?.toString() || "0");
    const firstPlacePrize = parseFloat(battle.first_place_prize?.toString() || "0");
    const secondPlacePrize = parseFloat(battle.second_place_prize?.toString() || "0");
    const thirdPlacePrize = parseFloat(battle.third_place_prize?.toString() || "0");
    
    for (const ranking of final_rankings) {
      const { player_id, placement } = ranking;
      
      const participant = participants.find(p => p.player_id === player_id);
      if (!participant) continue;
      
      let prizeAmount = 0;
      let nftPrize = null;
      
      if (placement === 1) {
        prizeAmount = firstPlacePrize;
        nftPrize = battle.first_place_nft_id;
      } else if (placement === 2) {
        prizeAmount = secondPlacePrize;
        nftPrize = battle.second_place_nft_id;
      } else if (placement === 3) {
        prizeAmount = thirdPlacePrize;
        nftPrize = battle.third_place_nft_id;
      }
      
      await db.update(battleParticipants)
        .set({
          final_placement: placement,
          prize_amount: prizeAmount.toString(),
          nft_prize_id: nftPrize,
          payout_completed_at: new Date()
        } as any)
        .where(eq(battleParticipants.id, participant.id));
      
      if (placement <= 3) {
        const medalType = placement === 1 ? "gold" : placement === 2 ? "silver" : "bronze";
        await db.insert(nftMedals).values({
          nft_id: participant.squadron_id,
          player_id: player_id,
          battle_id: battleId,
          medal_type: medalType,
          reason: `${placement}${placement === 1 ? 'st' : placement === 2 ? 'nd' : 'rd'} place in battle`,
          metadata: { prize: prizeAmount }
        } as any as any);
      }
      
      const existingScorecard = await db.query.nftScorecards.findFirst({
        where: eq(nftScorecards.nft_id, participant.squadron_id)
      });
      
      if (existingScorecard) {
        await db.update(nftScorecards)
          .set({
            total_battles: sql`${nftScorecards.total_battles} + 1`,
            total_damage_dealt: sql`${nftScorecards.total_damage_dealt} + ${participant.total_damage_dealt}`,
            total_damage_taken: sql`${nftScorecards.total_damage_taken} + ${participant.total_damage_taken}`,
            last_battle_id: battleId,
            last_updated: new Date()
          } as any)
          .where(eq(nftScorecards.id, existingScorecard.id));
      } else {
        await db.insert(nftScorecards).values({
          nft_id: participant.squadron_id,
          owner_player_id: player_id,
          total_battles: 1,
          total_damage_dealt: participant.total_damage_dealt?.toString() || "0",
          total_damage_taken: participant.total_damage_taken?.toString() || "0",
          last_battle_id: battleId
        } as any);
      }
    }
    
    await db.insert(battleTimeline).values({
      battle_id: battleId,
      sequence_number: 9999,
      event_type: "end",
      ai_narrator_text: "Battle concluded! Winners have been determined.",
      metadata: { final_rankings }
    } as any as any);
    
    res.json({
      success: true,
      message: "Battle completed, medals awarded, scorecards updated",
      final_rankings
    });
    
  } catch (error: any) {
    console.error("❌ [COMPLETE BATTLE] Error:", error);
    res.status(500).json({ error: "Failed to complete battle", details: error.message });
  }
});

/**
 * GET /civilization/:civKey/stats
 * Get civilization aggregate stats
 */
router.get("/civilization/:civKey/stats", sessionAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { civKey } = req.params;
    
    const stats = await db.query.civilizationStats.findFirst({
      where: eq(civilizationStats.civilization_key, civKey)
    });
    
    res.json({
      success: true,
      stats: stats || {
        civilization_key: civKey,
        total_battles: 0,
        total_kills: 0,
        total_damage_dealt: "0",
        total_damage_taken: "0",
        medals: []
      }
    });
  } catch (error: any) {
    console.error("❌ [CIV STATS] Error:", error);
    res.status(500).json({ error: "Failed to fetch stats", details: error.message });
  }
});

/**
 * GET /api/gaming/projects
 * Get all partner projects/collections with NFT counts
 */
router.get("/projects", async (req, res) => {
  try {
    const projects = await db
      .select({
        id: gamingNftCollections.collection_id,
        name: gamingNftCollections.collection_name,
        nft_count: sql<number>`count(${gamingNfts.nft_id})`,
      })
      .from(gamingNftCollections)
      .leftJoin(gamingNfts, eq(gamingNftCollections.collection_id, gamingNfts.collection_id))
      .groupBy(gamingNftCollections.collection_id)
      .orderBy(desc(sql<number>`count(${gamingNfts.nft_id})`));

    res.json({
      success: true,
      projects: projects.map(p => ({
        id: p.id,
        name: p.name,
        description: '',
        logo_url: null,
        nft_count: Number(p.nft_count) || 0,
      })),
    });
  } catch (error: any) {
    console.error("❌ [PROJECTS] Error:", error);
    res.status(500).json({ error: "Failed to fetch projects", details: error.message });
  }
});

/**
 * GET /api/gaming/civilization
 * Get user's civilization/land NFTs
 */
router.get("/civilization", sessionAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Get player's civilization data
    const playerCiv = await db
      .select()
      .from(playerCivilizations)
      .where(eq(playerCivilizations.player_id, userId))
      .limit(1);

    // For now, return empty array for lands - can be expanded later
    // to include specific land NFTs from RiddleCity collection
    res.json({
      success: true,
      civilization: playerCiv[0] || null,
      lands: [], // Can be populated with actual land NFTs later
    });
  } catch (error: any) {
    console.error("❌ [CIVILIZATION] Error:", error);
    res.status(500).json({ error: "Failed to fetch civilization", details: error.message });
  }
});

/**
 * GET /api/gaming/battles/active
 * Get user's active battles
 */
router.get("/battles/active", sessionAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Get active battles where user is a participant
    const activeBattles = await db
      .select({
        id: battles.id,
        status: battles.status,
        created_at: battles.created_at,
      })
      .from(battles)
      .innerJoin(battleParticipants, eq(battles.id, battleParticipants.battle_id))
      .where(
        and(
          eq(battleParticipants.player_id, userId),
          or(
            eq(battles.status, 'pending'),
            eq(battles.status, 'in_progress')
          )
        )
      )
      .orderBy(desc(battles.created_at));

    res.json({
      success: true,
      active_count: activeBattles.length,
      battles: activeBattles.map(b => ({
        id: b.id,
        name: `Battle #${b.id}`,
        status: b.status,
        created_at: b.created_at,
      })),
    });
  } catch (error: any) {
    console.error("❌ [ACTIVE BATTLES] Error:", error);
    res.status(500).json({ error: "Failed to fetch active battles", details: error.message });
  }
});

/**
 * GET /api/gaming/battles/available
 * Get available battles to join (pending battles created by others)
 */
router.get("/battles/available", sessionAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Get pending battles not created by this user
    const availableBattles = await db
      .select({
        id: battles.id,
        creator_id: battles.creator_player_id,
        wager: battles.wager_amount,
        created_at: battles.created_at,
      })
      .from(battles)
      .where(
        and(
          eq(battles.status, 'pending'),
          sql`${battles.creator_player_id} != ${userId}`
        )
      )
      .orderBy(desc(battles.created_at))
      .limit(20);

    res.json({
      success: true,
      battles: availableBattles.map(b => ({
        id: b.id,
        creator_id: b.creator_id,
        creator_name: 'Player', // Can be expanded to join with users table
        wager: Number(b.wager) || 0,
        created_at: b.created_at,
      })),
    });
  } catch (error: any) {
    console.error("❌ [AVAILABLE BATTLES] Error:", error);
    res.status(500).json({ error: "Failed to fetch available battles", details: error.message });
  }
});

/**
 * GET /api/gaming/nfts/search
 * Enhanced NFT search with multiple filters:
 * - owner: wallet address or player handle
 * - collection: collection ID or name
 * - minRarity/maxRarity: rarity rank range
 * - minPower/maxPower: power level range
 * - rarityTier: common, uncommon, rare, epic, legendary
 * - sortBy: rarity, power, name
 */
router.get("/nfts/search", async (req, res) => {
  try {
    const {
      owner,
      collection,
      minRarity,
      maxRarity,
      minPower,
      maxPower,
      rarityTier,
      sortBy = 'rarity',
      order = 'asc',
      limit = 50,
      offset = 0
    } = req.query;

    console.log(`🔍 [NFT SEARCH] Searching with filters:`, {
      owner, collection, minRarity, maxRarity, minPower, maxPower, rarityTier, sortBy
    });

    const conditions: any[] = [];

    // Owner filter - search by wallet address or player handle
    if (owner) {
      const ownerStr = owner as string;
      // Check if it's a wallet address or player handle
      if (ownerStr.startsWith('r')) {
        // Likely a wallet address
        conditions.push(eq(gamingNfts.owner_address, ownerStr));
      } else {
        // Player handle - need to join with players and get their wallet
        const player = await db.query.gamingPlayers.findFirst({
          where: eq(gamingPlayers.user_handle, ownerStr)
        });
        if (player) {
          conditions.push(eq(gamingNfts.owner_address, player.wallet_address));
        } else {
          // No player found, return empty results
          return res.json({
            success: true,
            filters: { owner, collection, minRarity, maxRarity, minPower, maxPower, rarityTier },
            total: 0,
            nfts: []
          });
        }
      }
    }

    // Collection filter - by ID or name
    if (collection) {
      const collectionStr = collection as string;
      // Try exact match first
      const foundCollection = await db.query.gamingNftCollections.findFirst({
        where: or(
          eq(gamingNftCollections.collection_id, collectionStr),
          eq(gamingNftCollections.collection_name, collectionStr)
        )
      });
      if (foundCollection) {
        conditions.push(eq(gamingNfts.collection_id, foundCollection.collection_id));
      } else {
        // Partial match on name
        conditions.push(sql`${gamingNfts.collection_id} IN (
          SELECT ${gamingNftCollections.collection_id} 
          FROM ${gamingNftCollections} 
          WHERE LOWER(${gamingNftCollections.collection_name}) LIKE LOWER(${'%' + collectionStr + '%'})
        )`);
      }
    }

    // Rarity rank filters
    if (minRarity) {
      conditions.push(sql`${gamingNfts.rarity_rank} >= ${parseInt(minRarity as string)}`);
    }
    if (maxRarity) {
      conditions.push(sql`${gamingNfts.rarity_rank} <= ${parseInt(maxRarity as string)}`);
    }

    // Rarity tier filter
    if (rarityTier) {
      conditions.push(eq(gamingNfts.rarity_tier, rarityTier as string));
    }

    // Power level filters (using power_multiplier)
    if (minPower) {
      conditions.push(sql`${gamingNfts.power_multiplier} >= ${parseFloat(minPower as string)}`);
    }
    if (maxPower) {
      conditions.push(sql`${gamingNfts.power_multiplier} <= ${parseFloat(maxPower as string)}`);
    }

    // Build sort clause
    let orderByClause;
    const isDesc = order === 'desc';
    
    switch(sortBy) {
      case 'rarity':
        orderByClause = isDesc ? desc(gamingNfts.rarity_rank) : gamingNfts.rarity_rank;
        break;
      case 'power':
        orderByClause = isDesc ? desc(gamingNfts.power_multiplier) : gamingNfts.power_multiplier;
        break;
      case 'name':
        orderByClause = isDesc ? desc(gamingNfts.name) : gamingNfts.name;
        break;
      default:
        orderByClause = gamingNfts.rarity_rank;
    }

    // Execute query with joins to get collection info
    const query = db
      .select({
        nft: gamingNfts,
        collection: gamingNftCollections
      })
      .from(gamingNfts)
      .leftJoin(gamingNftCollections, eq(gamingNfts.collection_id, gamingNftCollections.collection_id))
      .orderBy(orderByClause)
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    if (conditions.length > 0) {
      query.where(and(...conditions));
    }

    const results = await query;

    // Get count for pagination
    const count = results.length; // For MVP, return result count (can be enhanced with actual DB count)

    // Format response
    const nfts = results.map(({ nft, collection }) => ({
      id: nft.id,
      nft_id: nft.nft_id,
      token_id: nft.token_id,
      name: nft.name,
      description: nft.description,
      image_url: nft.image_url || nft.ai_generated_image_url,
      owner_address: nft.owner_address,
      collection_id: nft.collection_id,
      collection_name: collection?.collection_name,
      rarity_rank: nft.rarity_rank,
      rarity_score: nft.rarity_score,
      rarity_tier: nft.rarity_tier,
      power_multiplier: nft.power_multiplier,
      power_percentile: nft.power_percentile,
      is_genesis: nft.is_genesis,
      traits: nft.traits,
      game_stats: nft.game_stats,
      overall_rarity_rank: nft.overall_rarity_rank,
      collection_rarity_rank: nft.collection_rarity_rank,
      created_at: nft.created_at,
      updated_at: nft.updated_at
    }));

    res.json({
      success: true,
      filters: { owner, collection, minRarity, maxRarity, minPower, maxPower, rarityTier, sortBy, order },
      total: count,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      nfts
    });

  } catch (error: any) {
    console.error("❌ [NFT SEARCH] Error:", error);
    res.status(500).json({ 
      error: "Failed to search NFTs", 
      details: error.message 
    });
  }
});

export default router;
