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
import { inquisitionCollections } from "@shared/inquisition-audit-schema";
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
// NOTE: Duplicate block detected. Reuse the first updateProfileSchema declared earlier.
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

/**
 * GET /api/gaming/leaderboard
 * Get current player leaderboard (top 100 by overall_score)
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const leaderboard = await db
      .select({
        rank: sql<number>`ROW_NUMBER() OVER (ORDER BY overall_score DESC)`.as('rank'),
        user_handle: gamingPlayers.user_handle,
        player_name: gamingPlayers.player_name,
        overall_score: gamingPlayers.overall_score,
        total_power_level: gamingPlayers.total_power_level,
        total_nfts_owned: gamingPlayers.total_nfts_owned,
        gaming_rank: gamingPlayers.gaming_rank,
        wallet_address: gamingPlayers.wallet_address
      })
      .from(gamingPlayers)
      .orderBy(desc(gamingPlayers.overall_score))
      .limit(100);

    res.json({ success: true, data: leaderboard });
  } catch (error: any) {
    console.error('[LEADERBOARD] Error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch leaderboard' });
  }
});

/**
 * GET /api/gaming/player/:handle
 * Get detailed player stats by handle
 */
router.get('/player/:handle', async (req, res) => {
  try {
    const { handle } = req.params;
    const player = await db.query.gamingPlayers.findFirst({
      where: eq(gamingPlayers.user_handle, handle)
    });

    if (!player) {
      return res.status(404).json({ success: false, error: 'Player not found' });
    }

    res.json({ success: true, data: player });
  } catch (error: any) {
    console.error('[PLAYER DETAIL] Error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch player details' });
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
    const battle = await db.query.battles.findFirst({
      where: eq(battles.id, battleId)
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
        eq(battleParticipants.battle_id, battleId),
        eq(battleParticipants.player_id, player.id)
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
    
    if (!squadron || squadron.player_id !== player.id) {
      return res.status(403).json({ error: "Invalid squadron" });
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

/**
 * GET /api/gaming/nft/:collectionId
 * PUBLIC ENDPOINT - Get complete collection details with all NFTs
 * Perfect for showcasing collections to encourage army building!
 */
router.get("/nft/:collectionId", async (req, res) => {
  try {
    const { collectionId } = req.params;

    console.log(`🎮 [NFT COLLECTION] Fetching collection: ${collectionId}`);

    // Get collection details
    const collection = await db.query.gamingNftCollections.findFirst({
      where: eq(gamingNftCollections.id, collectionId)
    });

    if (!collection) {
      return res.status(404).json({
        success: false,
        error: "Collection not found"
      });
    }

    // Get ALL NFTs in this collection with full details
    const nfts = await db
      .select({
        id: gamingNfts.id,
        token_id: gamingNfts.token_id,
        nft_id: gamingNfts.nft_id,
        name: gamingNfts.name,
        description: gamingNfts.description,
        image_url: gamingNfts.image_url,
        ai_generated_image_url: gamingNfts.ai_generated_image_url,
        traits: gamingNfts.traits,
        rarity_score: gamingNfts.rarity_score,
        rarity_rank: gamingNfts.rarity_rank,
        game_stats: gamingNfts.game_stats,
      })
      .from(gamingNfts)
      .where(eq(gamingNfts.collection_id, collectionId))
      .orderBy(gamingNfts.rarity_rank);

    // Calculate collection stats
    const totalNfts = nfts.length;
    const rarityScores = nfts.map(n => parseFloat(String(n.rarity_score || 0)));
    const avgRarity = rarityScores.length > 0 
      ? rarityScores.reduce((a, b) => a + b, 0) / rarityScores.length 
      : 0;
    
    const minRarity = rarityScores.length > 0 ? Math.min(...rarityScores) : 0;
    const maxRarity = rarityScores.length > 0 ? Math.max(...rarityScores) : 0;

    // Calculate trait frequency for all NFTs
    const traitFrequency: Record<string, Record<string, number>> = {};
    nfts.forEach(nft => {
      if (nft.traits && typeof nft.traits === 'object') {
        Object.entries(nft.traits).forEach(([traitType, value]) => {
          if (!traitFrequency[traitType]) {
            traitFrequency[traitType] = {};
          }
          const val = String(value);
          traitFrequency[traitType][val] = (traitFrequency[traitType][val] || 0) + 1;
        });
      }
    });

    // Convert to percentages
    const traitRarity: Record<string, Record<string, number>> = {};
    Object.entries(traitFrequency).forEach(([traitType, values]) => {
      traitRarity[traitType] = {};
      Object.entries(values).forEach(([value, count]) => {
        traitRarity[traitType][value] = (count / totalNfts) * 100;
      });
    });

    // Rarity distribution for charts
    const rarityDistribution = {
      legendary: nfts.filter(n => (n.rarity_rank || 999) <= totalNfts * 0.01).length, // Top 1%
      epic: nfts.filter(n => {
        const rank = n.rarity_rank || 999;
        return rank > totalNfts * 0.01 && rank <= totalNfts * 0.05;
      }).length, // Top 5%
      rare: nfts.filter(n => {
        const rank = n.rarity_rank || 999;
        return rank > totalNfts * 0.05 && rank <= totalNfts * 0.15;
      }).length, // Top 15%
      uncommon: nfts.filter(n => {
        const rank = n.rarity_rank || 999;
        return rank > totalNfts * 0.15 && rank <= totalNfts * 0.50;
      }).length, // Top 50%
      common: nfts.filter(n => (n.rarity_rank || 0) > totalNfts * 0.50).length // Rest
    };

    // Mock floor price data (you can replace with real data later)
    const floorPriceHistory = [
      { date: '2025-10-01', price: 5.2 },
      { date: '2025-10-08', price: 5.5 },
      { date: '2025-10-15', price: 6.1 },
      { date: '2025-10-22', price: 5.8 },
      { date: '2025-10-29', price: 6.5 },
      { date: '2025-11-05', price: 7.2 },
      { date: '2025-11-10', price: 7.8 },
    ];

    console.log(`✅ [NFT COLLECTION] Returning ${totalNfts} NFTs from ${collection.collection_name}`);

    res.json({
      success: true,
      data: {
        collection: {
          id: collection.id,
          name: collection.collection_name,
          collection_id: collection.collection_id,
          taxon: collection.taxon,
          game_role: collection.game_role,
          total_supply: collection.total_supply,
          description: collection.role_description,
          chain: collection.chain
        },
        stats: {
          totalNfts,
          avgRarity: parseFloat(avgRarity.toFixed(4)),
          minRarity: parseFloat(minRarity.toFixed(4)),
          maxRarity: parseFloat(maxRarity.toFixed(4)),
          rarityDistribution,
          traitFrequency: traitRarity
        },
        nfts: nfts.map(nft => ({
          ...nft,
          rarity_score: parseFloat(String(nft.rarity_score || 0))
        })),
        floorPriceHistory
      }
    });

  } catch (error: any) {
    console.error('❌ [NFT COLLECTION] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch collection',
      details: error.message
    });
  }
});

/**
 * GET /api/gaming/collection/:collectionId/stats
 * PUBLIC ENDPOINT - Get detailed stats for charts and visualizations
 */
router.get("/collection/:collectionId/stats", async (req, res) => {
  try {
    const { collectionId } = req.params;

    console.log(`📊 [COLLECTION STATS] Fetching stats for: ${collectionId}`);

    // Get collection
    const collection = await db.query.gamingNftCollections.findFirst({
      where: eq(gamingNftCollections.id, collectionId)
    });

    if (!collection) {
      return res.status(404).json({
        success: false,
        error: "Collection not found"
      });
    }

    // Get all NFTs for analysis
    const nfts = await db
      .select({
        id: gamingNfts.id,
        traits: gamingNfts.traits,
        rarity_score: gamingNfts.rarity_score,
        rarity_rank: gamingNfts.rarity_rank,
        game_stats: gamingNfts.game_stats,
      })
      .from(gamingNfts)
      .where(eq(gamingNfts.collection_id, collectionId));

    const totalNfts = nfts.length;

    // Rarity score histogram (for chart)
    const rarityBuckets = Array(10).fill(0);
    const maxScore = Math.max(...nfts.map(n => parseFloat(String(n.rarity_score || 0))));
    const bucketSize = maxScore / 10;

    nfts.forEach(nft => {
      const score = parseFloat(String(nft.rarity_score || 0));
      const bucketIndex = Math.min(Math.floor(score / bucketSize), 9);
      rarityBuckets[bucketIndex]++;
    });

    const rarityHistogram = rarityBuckets.map((count, index) => ({
      range: `${(index * bucketSize).toFixed(1)}-${((index + 1) * bucketSize).toFixed(1)}`,
      count,
      percentage: (count / totalNfts) * 100
    }));

    // Trait analysis - most rare traits
    const traitRarityAnalysis: Array<{
      trait_type: string;
      value: string;
      count: number;
      percentage: number;
      rarity: 'legendary' | 'epic' | 'rare' | 'uncommon' | 'common';
    }> = [];

    const traitCounts: Record<string, Record<string, number>> = {};
    nfts.forEach(nft => {
      if (nft.traits && typeof nft.traits === 'object') {
        Object.entries(nft.traits).forEach(([type, value]) => {
          if (!traitCounts[type]) traitCounts[type] = {};
          const val = String(value);
          traitCounts[type][val] = (traitCounts[type][val] || 0) + 1;
        });
      }
    });

    Object.entries(traitCounts).forEach(([type, values]) => {
      Object.entries(values).forEach(([value, count]) => {
        const percentage = (count / totalNfts) * 100;
        let rarity: 'legendary' | 'epic' | 'rare' | 'uncommon' | 'common' = 'common';
        if (percentage <= 1) rarity = 'legendary';
        else if (percentage <= 5) rarity = 'epic';
        else if (percentage <= 15) rarity = 'rare';
        else if (percentage <= 40) rarity = 'uncommon';

        traitRarityAnalysis.push({
          trait_type: type,
          value,
          count,
          percentage: parseFloat(percentage.toFixed(2)),
          rarity
        });
      });
    });

    // Sort by rarity (lowest percentage first)
    traitRarityAnalysis.sort((a, b) => a.percentage - b.percentage);

    // Power analysis (if game_stats available)
    const powerDistribution = {
      army: [] as number[],
      religion: [] as number[],
      civilization: [] as number[],
      economic: [] as number[]
    };

    nfts.forEach(nft => {
      if (nft.game_stats && typeof nft.game_stats === 'object') {
        const stats = nft.game_stats as any;
        if (stats.army_power) powerDistribution.army.push(parseFloat(String(stats.army_power)));
        if (stats.religion_power) powerDistribution.religion.push(parseFloat(String(stats.religion_power)));
        if (stats.civilization_power) powerDistribution.civilization.push(parseFloat(String(stats.civilization_power)));
        if (stats.economic_power) powerDistribution.economic.push(parseFloat(String(stats.economic_power)));
      }
    });

    const avgPower = {
      army: powerDistribution.army.length > 0 
        ? powerDistribution.army.reduce((a, b) => a + b, 0) / powerDistribution.army.length 
        : 0,
      religion: powerDistribution.religion.length > 0 
        ? powerDistribution.religion.reduce((a, b) => a + b, 0) / powerDistribution.religion.length 
        : 0,
      civilization: powerDistribution.civilization.length > 0 
        ? powerDistribution.civilization.reduce((a, b) => a + b, 0) / powerDistribution.civilization.length 
        : 0,
      economic: powerDistribution.economic.length > 0 
        ? powerDistribution.economic.reduce((a, b) => a + b, 0) / powerDistribution.economic.length 
        : 0,
    };

    console.log(`✅ [COLLECTION STATS] Returning stats for ${collection.collection_name}`);

    res.json({
      success: true,
      data: {
        collection: {
          id: collection.id,
          name: collection.collection_name,
          total_nfts: totalNfts
        },
        rarityHistogram,
        traitRarityAnalysis: traitRarityAnalysis.slice(0, 20), // Top 20 rarest traits
        powerDistribution: avgPower,
        floorPriceHistory: [
          { date: '2025-10-01', price: 5.2, volume: 12 },
          { date: '2025-10-08', price: 5.5, volume: 18 },
          { date: '2025-10-15', price: 6.1, volume: 24 },
          { date: '2025-10-22', price: 5.8, volume: 15 },
          { date: '2025-10-29', price: 6.5, volume: 22 },
          { date: '2025-11-05', price: 7.2, volume: 28 },
          { date: '2025-11-10', price: 7.8, volume: 35 },
        ]
      }
    });

  } catch (error: any) {
    console.error('❌ [COLLECTION STATS] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stats',
      details: error.message
    });
  }
});

/**
 * GET /api/gaming/collections/all
 * PUBLIC ENDPOINT - Get all available collections for browsing
 */
router.get("/collections/all", async (req, res) => {
  try {
    console.log(`📚 [ALL COLLECTIONS] Fetching all collections`);

    const collections = await db
      .select({
        id: gamingNftCollections.id,
        name: gamingNftCollections.collection_name,
        collection_id: gamingNftCollections.collection_id,
        taxon: gamingNftCollections.taxon,
        game_role: gamingNftCollections.game_role,
        total_supply: gamingNftCollections.total_supply,
        description: gamingNftCollections.role_description,
        chain: gamingNftCollections.chain,
        total_nfts_scanned: gamingNftCollections.total_nfts_scanned,
        avg_nft_power: gamingNftCollections.avg_nft_power,
      })
      .from(gamingNftCollections)
      .where(eq(gamingNftCollections.active_in_game, true))
      .orderBy(desc(gamingNftCollections.total_supply));

    // Get NFT count for each collection
    const collectionsWithCounts = await Promise.all(
      collections.map(async (col) => {
        const nftCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(gamingNfts)
          .where(eq(gamingNftCollections.collection_id, col.id));

        return {
          ...col,
          nft_count: Number(nftCount[0]?.count || 0)
        };
      })
    );

    console.log(`✅ [ALL COLLECTIONS] Returning ${collections.length} collections`);

    res.json({
      success: true,
      data: {
        collections: collectionsWithCounts,
        total: collections.length
      }
    });

  } catch (error: any) {
    console.error('❌ [ALL COLLECTIONS] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch collections',
      details: error.message
    });
  }
});

export default router;
