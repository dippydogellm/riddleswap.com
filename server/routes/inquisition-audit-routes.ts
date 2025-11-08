/**
 * Inquisition NFT Audit API Routes
 * Provides access to NFT audit data for all users
 */

// @ts-nocheck
import express from "express";
import { Router } from "express";
import { db } from "../db";
import { eq, desc, and, sql, inArray } from "drizzle-orm";
import {
  inquisitionCollections,
  inquisitionNftAudit,
  inquisitionScanHistory,
  inquisitionUserOwnership,
  riddleWallets,
  gamingPlayers,
  gamingNfts,
  playerCivilizations,
} from "@shared/schema";
import { scanCollection, scanAllCollections } from "../services/inquisition-nft-scanner";
import { syncPlayerNFTs } from "../services/player-nft-sync";
import OpenAI from "openai";

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * GET /api/inquisition-audit/collections
 * Get all collections with current stats
 */
router.get("/collections", async (req, res) => {
  try {
    const collections = await db.select().from(inquisitionCollections);

    // Get NFT counts for each collection
    const collectionsWithStats = await Promise.all(
      collections.map(async (collection) => {
        const [stats] = await db.select({
          total_nfts: sql<number>`COUNT(*)`,
          total_points: sql<number>`SUM(${inquisitionNftAudit.total_points})`,
          avg_points: sql<number>`AVG(${inquisitionNftAudit.total_points})`,
        })
          .from(inquisitionNftAudit)
          .where(eq(inquisitionNftAudit.collection_id, collection.id));

        return {
          ...collection,
          stats: {
            total_nfts: parseInt(String(stats?.total_nfts || 0)),
            total_points: parseInt(String(stats?.total_points || 0)),
            avg_points: parseFloat(String(stats?.avg_points || 0)).toFixed(2),
          },
        };
      })
    );

    res.json({
      success: true,
      data: collectionsWithStats,
    });
  } catch (error) {
    console.error("Error fetching collections:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch collections",
    });
  }
});

/**
 * GET /api/inquisition-audit/nfts
 * Get all NFTs with optional filters
 */
router.get("/nfts", async (req, res) => {
  try {
    const {
      collection_id,
      wallet_address,
      min_points,
      max_points,
      limit = 100,
      offset = 0,
    } = req.query;

    let query = db.select().from(inquisitionNftAudit);

    // Apply filters
    const conditions = [];
    if (collection_id) {
      conditions.push(eq(inquisitionNftAudit.collection_id, parseInt(String(collection_id))));
    }
    if (wallet_address) {
      conditions.push(eq(inquisitionNftAudit.current_owner, String(wallet_address)));
    }
    if (min_points) {
      conditions.push(sql`${inquisitionNftAudit.total_points} >= ${parseInt(String(min_points))}`);
    }
    if (max_points) {
      conditions.push(sql`${inquisitionNftAudit.total_points} <= ${parseInt(String(max_points))}`);
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const nfts = await query
      .orderBy(desc(inquisitionNftAudit.total_points))
      .limit(parseInt(String(limit)))
      .offset(parseInt(String(offset)));

    res.json({
      success: true,
      data: nfts,
      count: nfts.length,
    });
  } catch (error) {
    console.error("Error fetching NFTs:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch NFTs",
    });
  }
});

/**
 * GET /api/inquisition-audit/nfts/:nftTokenId
 * Get single NFT by token ID
 */
router.get("/nfts/:nftTokenId", async (req, res) => {
  try {
    const { nftTokenId } = req.params;

    const nft = await db.query.inquisitionNftAudit.findFirst({
      where: eq(inquisitionNftAudit.nft_token_id, nftTokenId),
      with: {
        collection: true,
        ownerships: {
          orderBy: desc(inquisitionUserOwnership.acquired_at),
          limit: 10,
        },
      },
    });

    if (!nft) {
      return res.status(404).json({
        success: false,
        error: "NFT not found",
      });
    }

    res.json({
      success: true,
      data: nft,
    });
  } catch (error) {
    console.error("Error fetching NFT:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch NFT",
    });
  }
});

/**
 * GET /api/inquisition-audit/player/nfts
 * Get all NFTs owned by a player (by handle)
 */
router.get("/player/nfts", async (req, res) => {
  try {
    const { handle } = req.query;

    if (!handle) {
      return res.status(400).json({
        success: false,
        error: "Handle parameter is required",
      });
    }

    console.log(`🎮 [Player NFTs] Fetching NFTs for handle: ${handle}`);

    // Get user's wallet address from handle (riddleWallets table)
    const user = await db.query.riddleWallets.findFirst({
      where: eq(riddleWallets.handle, String(handle)),
    });

    // Allow users without wallet addresses to still access the dashboard
    // They can purchase land and participate in other ways
    if (!user || !user.xrpAddress) {
      console.log(`⚠️ [Player NFTs] User ${handle} has no wallet yet - returning empty NFT list`);
      return res.json({
        success: true,
        data: [],
        message: "No NFTs found - you can still purchase land and participate in gaming!",
      });
    }

    const walletAddress = user.xrpAddress;
    console.log(`✅ [Player NFTs] Found wallet address: ${walletAddress}`);

    // AUTO-SYNC: Update gaming_players with latest NFT data
    try {
      await syncPlayerNFTs(walletAddress, String(handle));
      console.log(`🔄 [Player NFTs] Auto-synced gaming profile for ${handle}`);
    } catch (syncError: any) {
      console.error(`⚠️ [Player NFTs] Auto-sync failed (non-critical):`, syncError);
      console.error(`❌ [Player NFTs] Error stack:`, syncError?.stack);
      console.error(`❌ [Player NFTs] Error message:`, syncError?.message);
      // Continue with NFT fetch even if sync fails
    }

    // Get NFTs directly from audit table (source of truth)
    const nfts = await db.query.inquisitionNftAudit.findMany({
      where: and(
        eq(inquisitionNftAudit.current_owner, walletAddress),
        eq(inquisitionNftAudit.is_active, true)
      ),
      with: {
        collection: true,
      },
      orderBy: (nfts, { desc }) => [desc(nfts.total_points)],
    });

    console.log(`📊 [Player NFTs] Found ${nfts.length} NFTs for ${handle}`);

    // Fetch player's civilization data - use handle to get correct record
    // (avoids duplicate wallet_address issue)
    const player = await db.query.gamingPlayers.findFirst({
      where: eq(gamingPlayers.user_handle, String(handle)),
    });

    let civilizationData = null;
    if (player) {
      const [civilization] = await db
        .select()
        .from(playerCivilizations)
        .where(eq(playerCivilizations.player_id, player.id))
        .limit(1);
      
      if (civilization) {
        civilizationData = {
          name: civilization.civilization_name,
          type: civilization.civilization_type,
          motto: civilization.motto,
          crest_image: civilization.crest_image,
          color_primary: civilization.color_primary,
          color_secondary: civilization.color_secondary,
          color_accent: civilization.color_accent,
        };
      }
    }

    // Fetch AI-generated images from gaming_nfts table
    // 🔥 FIX: Direct token_id matching between ownership and gaming_nfts tables
    const nftIds = nfts.map(nft => nft.nft_token_id || '').filter(Boolean);
    
    const gamingNftsWithImages = nftIds.length > 0
      ? await db.execute<{ nft_id: string; token_id: string; ai_generated_image_url: string | null }>(sql`
          SELECT 
            nft_id,
            token_id,
            ai_generated_image_url
          FROM gaming_nfts
          WHERE ${sql.join(
            nftIds.map(shortId => sql`token_id = ${shortId}`),
            sql` OR `
          )}
        `)
      : { rows: [] };

    // Create a map for quick lookup using token_id (SHORT ID)
    const imageMap = new Map(
      gamingNftsWithImages.rows
        .filter(gn => gn.ai_generated_image_url)
        .map(gn => [gn.token_id, gn.ai_generated_image_url])
    );

    // Transform to match frontend interface
    interface AuditCollection { collection_name?: string; game_role?: string }
    interface AuditNFT {
      nft_token_id?: string;
      name?: string;
      description?: string;
      image_url?: string;
      traits?: Record<string, any>;
      first_seen_at?: Date;
      total_points?: number;
      power_strength?: number; power_defense?: number; power_magic?: number; power_speed?: number;
      material_type?: string; character_class?: string; battle_specialization?: string;
      collection?: AuditCollection;
    }
  const nftsAny: any[] = (nfts as unknown) as any[];
    const playerNFTs = nftsAny.map((nft: any) => {
      const collection: any = nft.collection;
      
      // Use actual power values from NFT audit
      const totalPower = nft.total_points || 0;
      const strength = nft.power_strength || 0;
      const defense = nft.power_defense || 0;
      const magic = nft.power_magic || 0;
      const speed = nft.power_speed || 0;
      
      // Get AI-generated image if available
      const nftTokenId = nft.nft_token_id || '';
      const aiImage = imageMap.get(nftTokenId);
      const displayImage = aiImage || nft.image_url || '';
      
      return {
        nft_id: nft.nft_token_id || '',
        name: nft.name || 'Unknown',
        description: nft.description || '',
  // @ts-ignore dynamic collection shape
  collection_name: collection?.collection_name || 'Unknown',
        image_url: displayImage,
        ai_generated_image_url: aiImage || null,
        original_image_url: nft.image_url || '',
  // @ts-ignore dynamic collection shape
  game_role: collection?.game_role || 'Unknown',
        total_power: totalPower,
        rarity_score: totalPower.toString(),
        army_power: strength,
        religion_power: magic,
        civilization_power: defense,
        economic_power: speed,
        traits: nft.traits || {},
        owned_at: nft.first_seen_at?.toISOString() || new Date().toISOString(),
        
        // NEW FIELDS: Character classification (Inquisition collection only)
        material_type: nft.material_type || null,
        character_class: nft.character_class || null,
        battle_specialization: nft.battle_specialization || null,
      };
    });

    res.json({
      success: true,
      data: playerNFTs,
      civilization: civilizationData,
      player: player ? {
        handle: player.user_handle,
        name: player.player_name,
  // @ts-ignore total_power_level may be string from DB driver
  level: typeof (player as any).total_power_level === 'number' ? Math.floor((player as any).total_power_level / 100) : 1,
        gaming_rank: player.gaming_rank, // Add actual rank field
        play_type: player.play_type,
        profile_picture: player.commander_profile_image, // 🔥 FIX: Use commander_profile_image from database
      } : null,
    });
  } catch (error: any) {
    console.error("❌ [Player NFTs] Error:", error);
    console.error("❌ [Player NFTs] Error stack:", error?.stack);
    console.error("❌ [Player NFTs] Error message:", error?.message);
    console.error("❌ [Player NFTs] Error name:", error?.name);
    res.status(500).json({
      success: false,
      error: "Failed to fetch player NFTs",
      details: error?.message || "Unknown error",
    });
  }
});

/**
 * GET /api/inquisition-audit/wallet/:address
 * Get all NFTs owned by a wallet address (works for any user)
 */
router.get("/wallet/:address", async (req, res) => {
  try {
    const { address } = req.params;

    // Get current ownerships
    const ownerships = await db.query.inquisitionUserOwnership.findMany({
      where: and(
        eq(inquisitionUserOwnership.wallet_address, address),
        eq(inquisitionUserOwnership.is_current_owner, true)
      ),
      with: {
        nft: {
          with: {
            collection: true,
          },
        },
      },
    });

    // Calculate total points
    const totalPoints = ownerships.reduce((sum, ownership) => {
      const pts = (ownership as any).nft?.total_points;
      return sum + (typeof pts === 'number' ? pts : 0);
    }, 0);

    // Group by collection
    const byCollection: Record<string, any> = {};
    const ownershipsAny: any[] = ownerships as any[];
    for (const ownership of ownershipsAny) {
      const nft: any = ownership.nft;
      if (!nft) continue;
      // @ts-ignore dynamic collection shape
      const collectionName = nft.collection?.collection_name || 'Unknown';
      if (!byCollection[collectionName]) {
        byCollection[collectionName] = {
          // @ts-ignore dynamic collection shape
          collection: nft.collection,
          nfts: [],
          count: 0,
          total_points: 0,
        };
      }
      byCollection[collectionName].nfts.push(nft);
      byCollection[collectionName].count++;
      // @ts-ignore dynamic nft shape
      byCollection[collectionName].total_points += typeof nft.total_points === 'number' ? nft.total_points : 0;
    }

    // Transform NFTs to include new fields
    const transformedNfts = ownershipsAny.map((o: any) => {
      const nft: any = o.nft;
      if (!nft) return null;
      
      return {
        ...nft,
        // Ensure new fields are included
        // @ts-ignore dynamic nft shape
        material_type: nft.material_type || null,
        // @ts-ignore dynamic nft shape
        character_class: nft.character_class || null,
        // @ts-ignore dynamic nft shape
        battle_specialization: nft.battle_specialization || null,
      };
    }).filter(Boolean);

    res.json({
      success: true,
      data: {
        wallet_address: address,
        total_nfts: ownerships.length,
        total_points: totalPoints,
        by_collection: byCollection,
        nfts: transformedNfts,
      },
    });
  } catch (error) {
    console.error("Error fetching wallet NFTs:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch wallet NFTs",
    });
  }
});

/**
 * GET /api/inquisition-audit/generated-images
 * Get all generated images from Object Storage
 */
router.get("/generated-images", async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    
    console.log(`🎨 [Generated Images] Fetching images from Replit Object Storage`);
    
    // Query all generated images from NFTs
    const nftsWithImages = await db
      .select({
        nft_token_id: inquisitionNftAudit.nft_token_id,
        name: inquisitionNftAudit.name,
        collection_name: sql<string>`${inquisitionNftAudit.id}`,
        image_url: inquisitionNftAudit.image_url,
        character_class: inquisitionNftAudit.character_class,
        material_type: inquisitionNftAudit.material_type,
        created_at: inquisitionNftAudit.first_seen_at,
      })
      .from(inquisitionNftAudit)
      .where(sql`${inquisitionNftAudit.image_url} LIKE '%/api/storage/uploads/generated-images/%'`)
      .orderBy(desc(inquisitionNftAudit.first_seen_at))
      .limit(parseInt(String(limit)))
      .offset(parseInt(String(offset)));

    console.log(`✅ [Generated Images] Found ${nftsWithImages.length} generated images`);

    res.json({
      success: true,
      data: {
        images: nftsWithImages,
        count: nftsWithImages.length,
      },
    });
  } catch (error) {
    console.error("❌ [Generated Images] Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch generated images",
    });
  }
});

/**
 * GET /api/inquisition-audit/leaderboard
 * Get top wallets by total points with player info (civilization name, handle)
 */
router.get("/leaderboard", async (req, res) => {
  try {
    const { limit = 100 } = req.query;

    // Get wallet aggregates directly from audit table
    const leaderboard = await db
      .select({
        wallet_address: inquisitionNftAudit.current_owner,
        total_nfts: sql<number>`COUNT(DISTINCT ${inquisitionNftAudit.nft_token_id})`,
        total_points: sql<number>`SUM(${inquisitionNftAudit.total_points})`,
      })
      .from(inquisitionNftAudit)
      .where(eq(inquisitionNftAudit.is_active, true))
      .groupBy(inquisitionNftAudit.current_owner)
      .orderBy(desc(sql`SUM(${inquisitionNftAudit.total_points})`))
      .limit(parseInt(String(limit)));

    // Enrich with gaming player data (civilization names and handles)
    const enrichedLeaderboard = await Promise.all(
      leaderboard.map(async (entry, index) => {
        // Look up player by wallet address
        const player = await db.query.gamingPlayers.findFirst({
          where: eq(gamingPlayers.wallet_address, entry.wallet_address),
        });

        // Look up civilization for this player
        let civilizationData = null;
        if (player) {
          const [civilization] = await db
            .select()
            .from(playerCivilizations)
            .where(eq(playerCivilizations.player_id, player.id))
            .limit(1);
          
          if (civilization) {
            civilizationData = {
              name: civilization.civilization_name,
              crest_image: civilization.crest_image,
              color_primary: civilization.color_primary,
              color_secondary: civilization.color_secondary,
            };
          }
        }

        return {
          rank: index + 1,
          wallet_address: entry.wallet_address,
          total_nfts: parseInt(String(entry.total_nfts)),
          total_points: parseInt(String(entry.total_points)),
          // Add player info if found
          player_handle: player?.user_handle || null,
          player_name: player?.player_name || null,
          player_profile_picture: (player as any)?.commander_profile_image || null,
          civilization_name: civilizationData?.name || null,
          civilization_crest: civilizationData?.crest_image || null,
          civilization_color_primary: civilizationData?.color_primary || null,
          civilization_color_secondary: civilizationData?.color_secondary || null,
          play_type: player?.play_type || null,
        };
      })
    );

    res.json({
      success: true,
      data: enrichedLeaderboard,
    });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch leaderboard",
    });
  }
});

/**
 * GET /api/inquisition-audit/scan-history
 * Get recent scan history
 */
router.get("/scan-history", async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const history = await db
      .select()
      .from(inquisitionScanHistory)
      .orderBy(desc(inquisitionScanHistory.scan_started_at))
      .limit(parseInt(String(limit)));

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error("Error fetching scan history:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch scan history",
    });
  }
});

/**
 * POST /api/inquisition-audit/scan/:collectionId
 * Manually trigger a scan for a specific collection (admin/testing)
 */
router.post("/scan/:collectionId", async (req, res) => {
  try {
    const { collectionId } = req.params;

    console.log(`🎮 [Inquisition Audit] Manual scan requested for collection ${collectionId}`);

    const result = await scanCollection(parseInt(collectionId));

    res.json({
      success: true,
      message: "Scan completed successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error running manual scan:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to run scan",
    });
  }
});

/**
 * POST /api/inquisition-audit/scan-all
 * Manually trigger a scan for all collections (admin/testing)
 */
router.post("/scan-all", async (req, res) => {
  try {
    console.log(`🎮 [Inquisition Audit] Manual scan requested for all collections`);

    // Run scan asynchronously
    scanAllCollections().catch(error => {
      console.error("Error in background scan:", error);
    });

    res.json({
      success: true,
      message: "Scan started in background",
    });
  } catch (error) {
    console.error("Error starting scan:", error);
    res.status(500).json({
      success: false,
      error: "Failed to start scan",
    });
  }
});

/**
 * GET /api/inquisition-audit/stats
 * Get overall statistics
 */
router.get("/stats", async (req, res) => {
  try {
    const [stats] = await db.select({
      total_collections: sql<number>`COUNT(DISTINCT ${inquisitionCollections.id})`,
      total_nfts: sql<number>`COUNT(${inquisitionNftAudit.id})`,
      total_owners: sql<number>`COUNT(DISTINCT ${inquisitionUserOwnership.wallet_address})`,
      total_points: sql<number>`SUM(${inquisitionNftAudit.total_points})`,
      avg_points_per_nft: sql<number>`AVG(${inquisitionNftAudit.total_points})`,
    })
      .from(inquisitionCollections)
      .leftJoin(inquisitionNftAudit, eq(inquisitionCollections.id, inquisitionNftAudit.collection_id))
      .leftJoin(
        inquisitionUserOwnership,
        and(
          eq(inquisitionNftAudit.id, inquisitionUserOwnership.nft_id),
          eq(inquisitionUserOwnership.is_current_owner, true)
        )
      );

    res.json({
      success: true,
      data: {
        total_collections: parseInt(String(stats?.total_collections || 0)),
        total_nfts: parseInt(String(stats?.total_nfts || 0)),
        total_owners: parseInt(String(stats?.total_owners || 0)),
        total_points: parseInt(String(stats?.total_points || 0)),
        avg_points_per_nft: parseFloat(String(stats?.avg_points_per_nft || 0)).toFixed(2),
      },
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch stats",
    });
  }
});

/**
 * POST /api/inquisition-audit/regenerate-image/:nftTokenId
 * Regenerate the image for an NFT using DALL-E
 */
router.post("/regenerate-image/:nftTokenId", async (req, res) => {
  try {
    const { nftTokenId } = req.params;

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        success: false,
        error: "OpenAI API key not configured",
      });
    }

    // Get NFT data
    const nft = await db.query.inquisitionNftAudit.findFirst({
      where: eq(inquisitionNftAudit.nft_token_id, nftTokenId),
    });

    if (!nft) {
      return res.status(404).json({
        success: false,
        error: "NFT not found",
      });
    }

    // Generate image using DALL-E
    const prompt = `Epic medieval fantasy NFT character card: ${nft.name}. ${nft.description}. High quality digital art, detailed armor and weapons, mystical background, game character portrait style.`;

    const imageResponse = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
    });

    const newImageUrl = imageResponse.data?.[0]?.url;

    if (!newImageUrl) {
      throw new Error("Failed to generate image");
    }

    // Update NFT with new image
    await db.update(inquisitionNftAudit)
      .set({ 
        image_url: newImageUrl,
        last_updated_at: new Date(),
       } as any)
      .where(eq(inquisitionNftAudit.nft_token_id, nftTokenId));

    res.json({
      success: true,
      data: {
        nft_token_id: nftTokenId,
        new_image_url: newImageUrl,
      },
    });
  } catch (error) {
    console.error("Error regenerating image:", error);
    res.status(500).json({
      success: false,
      error: "Failed to regenerate image",
    });
  }
});

export default router;
