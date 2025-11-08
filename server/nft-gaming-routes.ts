/**
 * NFT Gaming Routes - The Trolls Inquisition Multi-Chain Mayhem Edition
 * 
 * Handles NFT ownership verification, player registration, and gaming mechanics
 * for the specific collections: The Inquisition, Under the Bridge Trolls, 
 * The Lost Emporium, DANTES AURUM, and The Unknowns.
 */

import { Router } from "express";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { getBithompCollection, getBithompTokens } from "./bithomp-api-v2";
import { sessionAuth } from "./middleware/session-auth";
import { storage } from "./storage";
import { db } from "./db";
import { generateLandPlotImage } from "./openai-service";
import { mintLandPlotNFT, mintGenericNFT } from "./xrpl-nft-service";
import { sendXrplPayment } from "./xrpl/xrpl-payment";
import { updateLandPlotMetadata, addFoundingRiddleWallets } from "./nft-metadata-generator";
import { nftOwnershipScanner } from "./services/nft-ownership-scanner";
import { 
  gamingNftCollections, 
  gamingNfts, 
  gamingPlayers, 
  playerNftOwnership,
  gamingEvents,
  medievalLandPlots,
  playerCivilizations,
  allyRequests,
  activeAlliances,
  landPlotPurchases
} from "@shared/schema";

const router = Router();

// Request validation schemas
const purchasePlotSchema = z.object({
  plot_id: z.number().positive(),
  plot_number: z.number().positive().max(1000),
  coordinates: z.object({
    x: z.number(),
    y: z.number()
  }),
  terrain_type: z.string().min(1),
  xrp_price: z.number().positive(),
  yearly_yield: z.number().nonnegative(),
  yield_percentage: z.number().min(0).max(100),
  size_multiplier: z.number().positive(),
  destination_tag: z.string().regex(/^PLOT\d+$/)
});
const verifyOwnershipSchema = z.object({
  wallet_address: z.string().min(1, "Wallet address is required"),
  chain: z.string().default("xrpl")
});

const registerPlayerSchema = z.object({
  player_name: z.string().optional(),
  wallet_address: z.string().min(1, "Wallet address is required"),
  chain: z.string().default("xrpl")
});

// Add NFT verification schemas
const nftVerificationSchema = z.object({
  wallet_address: z.string().optional() // If not provided, scans all linked wallets
});

// Add civilization and ally validation schemas
const createCivilizationSchema = z.object({
  civilization_name: z.string().min(1).max(100),
  primary_color: z.string().regex(/^#[0-9A-F]{6}$/i),
  secondary_color: z.string().regex(/^#[0-9A-F]{6}$/i),
  accent_color: z.string().regex(/^#[0-9A-F]{6}$/i),
  motto: z.string().max(200).optional()
});

const createAllyRequestSchema = z.object({
  receiver_handle: z.string().min(1),
  message: z.string().max(500).optional(),
  request_type: z.enum(['alliance', 'trade_agreement', 'non_aggression']).optional().default('alliance')
});

/**
 * Get medieval land plots for treasure map (1000 plots total)
 */
router.get('/medieval-land-plots', async (req, res) => {
  try {
    console.log('🎮 [Medieval Map] Getting land plots data');
    console.log(`🛡️ [PAYLOAD SECURITY] GET request for land plots:`, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
      query: req.query,
      headers: {
        'origin': req.get('origin'),
        'referer': req.get('referer')
      }
    });
    
    // Try to get data from database, fallback to mock data if table doesn't exist
    let plots: any[] = [];
    try {
      const result = await db.execute(sql`SELECT * FROM medieval_land_plots ORDER BY plot_number LIMIT 1000`);
      plots = (result.rows || result) as any[]; // Handle both QueryResult.rows and direct array
    } catch (error) {
      console.log('🎮 [Medieval Map] Table not found, generating mock data for testing');
      // Generate mock data for 1000 plots until table is created
      plots = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        plot_number: i + 1,
        map_x: (i % 50),
        map_y: Math.floor(i / 50),
        status: Math.random() > 0.7 ? 'owned' : 'available',
        terrain_type: ['forest', 'mountain', 'plains', 'river'][Math.floor(Math.random() * 4)],
        price_xrp: 50 + Math.floor(Math.random() * 200),
        owner_id: Math.random() > 0.7 ? 'dippydoge' : null
      }));
    }
    
    // Ensure plots is always an array for filtering
    const plotsArray = Array.isArray(plots) ? plots : [];
    
    const totalPlots = plotsArray.length;
    const availablePlots = plotsArray.filter((p: any) => p.status === 'available').length;
    const ownedPlots = plotsArray.filter((p: any) => p.status === 'owned').length;
    
    const responsePayload = {
      success: true,
      total_plots: totalPlots,
      available_plots: availablePlots,
      owned_plots: ownedPlots,
      plots: plotsArray.map((plot: any) => ({
        id: plot.id,
        plot_number: plot.plot_number,
        map_x: plot.map_x,
        map_y: plot.map_y,
        grid_section: plot.grid_section,
        terrain_type: plot.terrain_type,
        terrain_subtype: plot.terrain_subtype,
        base_price: parseFloat(plot.base_price),
        current_price: parseFloat(plot.current_price),
        plot_size: plot.plot_size,
        size_multiplier: parseFloat(plot.size_multiplier),
        yield_rate: parseFloat(plot.yield_rate),
        owner_id: plot.owner_id,
        owner_handle: plot.owner_handle,
        owner_address: plot.owner_address,
        status: plot.status,
        special_features: plot.special_features || [],
        description: plot.description,
        lore: plot.lore,
        has_visual_indicators: plot.has_visual_indicators
      }))
    };
    
    console.log(`🛡️ [PAYLOAD SECURITY] Land plots response:`, {
      totalPlots: responsePayload.total_plots,
      availablePlots: responsePayload.available_plots,
      plotsCount: responsePayload.plots.length,
      samplePlot: responsePayload.plots[0] || 'no plots'
    });
    
    res.json(responsePayload);
  } catch (error) {
    console.error('❌ [Medieval Map] Error fetching land plots:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch medieval land plots' 
    });
  }
});

/**
 * Populate database with NFT data from all gaming collections
 */
router.post("/populate-nft-data", async (req, res) => {
  try {
    console.log("🎮 [NFT Gaming] Starting real NFT data population from Bithomp API...");
    console.log(`🔑 [NFT Gaming] Using issuer: rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH`);
    
    // Get Bithomp API key from environment
    const BITHOMP_API_KEY = process.env.BITHOMP_API_KEY;
    if (!BITHOMP_API_KEY) {
      throw new Error("BITHOMP_API_KEY not found in environment");
    }

    // Get all gaming collections
    const collections = await db
      .select()
      .from(gamingNftCollections)
      .where(eq(gamingNftCollections.active_in_game, true));

    let totalNFTsProcessed = 0;
    const results = [];

    // Step 1: Get ALL NFTs from this issuer using the correct API endpoint
    console.log(`📡 [NFT Gaming] Fetching ALL NFTs for issuer rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH...`);
    
    const nftResponse = await fetch(`https://bithomp.com/api/v2/nfts?issuer=rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH&assets=true`, {
      headers: {
        'x-bithomp-token': BITHOMP_API_KEY,
        'User-Agent': 'RiddleSwap-NFT-Gaming/1.0',
        'Accept': 'application/json'
      }
    });

    if (!nftResponse.ok) {
      throw new Error(`Failed to fetch NFTs from Bithomp: ${nftResponse.status} ${nftResponse.statusText}`);
    }

    const nftData = await nftResponse.json();
    console.log(`✅ [NFT Gaming] Found ${nftData.nfts?.length || 0} NFTs from issuer`);
    
    if (!nftData.nfts || !Array.isArray(nftData.nfts)) {
      console.warn(`⚠️ No NFTs found for issuer rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH`);
      res.json({
        success: true,
        total_nfts_processed: 0,
        collections_processed: 0,
        results: [{ status: 'no_nfts_found', issuer: 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH' }]
      });
      return;
    }

    // Step 2: Group NFTs by taxon (collection) and process each
    const nftsByTaxon = new Map();
    for (const nft of nftData.nfts) {
      const taxon = nft.nftokenTaxon || 0;
      if (!nftsByTaxon.has(taxon)) {
        nftsByTaxon.set(taxon, []);
      }
      nftsByTaxon.get(taxon).push(nft);
    }

    console.log(`📊 [NFT Gaming] Found NFTs in ${nftsByTaxon.size} different taxons (collections)`);

    for (const collection of collections) {
      console.log(`📡 [NFT Gaming] Processing collection: ${collection.collection_name}...`);
      
      // Parse issuer and taxon from collection_id
      const [issuer, taxonStr] = collection.collection_id.split(':');
      const taxon = parseInt(taxonStr);
      
      if (!issuer || isNaN(taxon)) {
        console.error(`⚠️ Invalid collection_id format: ${collection.collection_id}`);
        continue;
      }

      const collectionNFTs = nftsByTaxon.get(taxon) || [];
      console.log(`📡 [NFT Gaming] Found ${collectionNFTs.length} NFTs for ${collection.collection_name} (taxon ${taxon})`);

      let processedCount = 0;
      
      if (collectionNFTs.length === 0) {
        results.push({
          collection: collection.collection_name,
          nfts_found: 0,
          status: 'no_nfts_in_collection'
        });
        continue;
      }

      try {
        // Process each NFT in this collection
        for (const nft of collectionNFTs) {
          try {
            // Extract metadata URL
            let metadataUrl = null;
            if (nft.url) {
              metadataUrl = nft.url;
            } else if (nft.uri) {
              // Decode hex URI
              const hexUri = nft.uri.startsWith('0x') ? nft.uri.slice(2) : nft.uri;
              const decodedUri = Buffer.from(hexUri, 'hex').toString('utf8');
              if (decodedUri.startsWith('ipfs://')) {
                metadataUrl = decodedUri.replace('ipfs://', 'https://cloudflare-ipfs.com/ipfs/');
              } else {
                metadataUrl = decodedUri;
              }
            }

            // Get NFT metadata if URL exists
            let metadata = {};
            let traits = {};
            let name = `NFT #${nft.sequence}`;
            let description = '';
            let imageUrl = nft.assets?.image || '';

            if (metadataUrl) {
              try {
                const metadataResponse = await fetch(metadataUrl, { 
                  headers: { 'User-Agent': 'RiddleSwap-NFT-Gaming/1.0' }
                });
                if (metadataResponse.ok) {
                  const metadataJson = await metadataResponse.json();
                  metadata = metadataJson;
                  name = metadataJson.name || name;
                  description = metadataJson.description || '';
                  imageUrl = metadataJson.image || imageUrl;
                  traits = metadataJson.attributes || metadataJson.traits || {};
                }
              } catch (metadataError: any) {
                console.warn(`⚠️ Failed to fetch metadata for NFT ${nft.nftokenID}:`, metadataError?.message || 'Unknown error');
              }
            }

            // Insert NFT into database
            await db.insert(gamingNfts).values({
              collection_id: collection.id, // Use the UUID from gaming_nft_collections
              token_id: nft.sequence.toString(),
              nft_id: nft.nftokenID,
              owner_address: null, // Owner would need separate API call
              metadata: metadata,
              traits: traits,
              image_url: imageUrl,
              name: name,
              description: description,
              rarity_rank: null,
              rarity_score: null,
              game_stats: {},
              is_genesis: false,
              power_multiplier: 1.0,
              last_transferred: null,
              metadata_updated: new Date(),
              created_at: new Date(),
              updated_at: new Date()
            } as any).onConflictDoUpdate({
              target: gamingNfts.id,
              set: {
                metadata: metadata,
                traits: traits,
                image_url: imageUrl,
                name: name,
                description: description,
                updated_at: new Date()
              } as any
            });

            processedCount++;
            totalNFTsProcessed++;
            
            if (processedCount % 5 === 0) {
              console.log(`📊 [NFT Gaming] Processed ${processedCount}/${collectionNFTs.length} NFTs for ${collection.collection_name}`);
            }
            
            // Small delay to avoid overwhelming external metadata APIs
            await new Promise(resolve => setTimeout(resolve, 100));
            
          } catch (nftError) {
            console.error(`Failed to process NFT ${nft.nftokenID}:`, nftError);
          }
        }

        // Update collection metadata
        await db.update(gamingNftCollections)
          .set({
            collection_verified: true,
            total_supply: collectionNFTs.length,
            metadata_ingested: true,
            updated_at: new Date()
          } as any)
          .where(eq(gamingNftCollections.id, collection.id));

        results.push({
          collection: collection.collection_name,
          nfts_found: collectionNFTs.length,
          nfts_processed: processedCount,
          status: 'success'
        });
        
        console.log(`✅ [NFT Gaming] Completed ${collection.collection_name}: ${processedCount}/${collectionNFTs.length} NFTs processed`);
        
      } catch (collectionError: any) {
        console.error(`Failed to process collection ${collection.collection_name}:`, collectionError);
        results.push({
          collection: collection.collection_name,
          error: collectionError?.message || 'Unknown error',
          status: 'error'
        });
      }
    }

    console.log(`🎉 [NFT Gaming] Population complete! Processed ${totalNFTsProcessed} NFTs total`);

    res.json({
      success: true,
      total_nfts_processed: totalNFTsProcessed,
      collections_processed: results.length,
      results
    });

  } catch (error) {
    console.error("🎮 [NFT Gaming] Failed to populate NFT data:", error);
    res.status(500).json({
      success: false,
      error: "Failed to populate NFT data"
    });
  }
});

/**
 * Get player dashboard data with comprehensive debugging
 */
router.get("/player/dashboard", sessionAuth, async (req, res) => {
  try {
    const userHandle = req.user?.userHandle;
    
    console.log(`🎮 [PLAYER DASHBOARD] Request received:`, {
      userHandle,
      hasUser: !!req.user,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
    
    if (!userHandle) {
      console.error(`❌ [PLAYER DASHBOARD] No userHandle found in session`);
      return res.status(401).json({
        success: false,
        error: "Authentication required"
      });
    }

    console.log(`🎮 [PLAYER DASHBOARD] Getting dashboard data for ${userHandle}`);

    // Get player data
    const playerData = await storage.getGamingPlayer(userHandle);
    console.log(`🎮 [PLAYER DASHBOARD] Player data query result:`, {
      found: playerData.length > 0,
      count: playerData.length,
      playerHandle: playerData[0]?.user_handle
    });

    let player = null;
    let nft_collections = {};
    let recent_events = [];
    let stats = null;

    if (playerData.length > 0) {
      player = playerData[0];
      console.log(`✅ [PLAYER DASHBOARD] Player found:`, {
        handle: player.user_handle,
        totalPower: player.total_power_level,
        rank: player.gaming_rank,
        nftsOwned: player.total_nfts_owned
      });

      // Get NFT collections for this player
      try {
        const collections = await db
          .select()
          .from(gamingNftCollections)
          .where(eq(gamingNftCollections.active_in_game, true));

        for (const collection of collections) {
          const ownedNFTs = await db
            .select()
            .from(gamingNfts)
            .where(
              and(
                eq(gamingNfts.collection_id, collection.id),
                eq(gamingNfts.owner_address, player.wallet_address)
              )
            );

          if (ownedNFTs.length > 0) {
            (nft_collections as Record<string, any>)[collection.collection_name] = {
              collection,
              nfts: ownedNFTs
            };
          }
        }

        console.log(`🏛️ [PLAYER DASHBOARD] NFT Collections found:`, {
          collectionCount: Object.keys(nft_collections).length,
          collectionNames: Object.keys(nft_collections)
        });
      } catch (collectionsError) {
        console.error(`❌ [PLAYER DASHBOARD] Error fetching collections:`, collectionsError);
      }

      // Get recent events
      try {
        recent_events = await storage.getGamingEvents(player.id, 10);
        console.log(`📰 [PLAYER DASHBOARD] Recent events found:`, recent_events.length);
      } catch (eventsError) {
        console.error(`❌ [PLAYER DASHBOARD] Error fetching events:`, eventsError);
      }

      // Calculate actual counts from nft_collections
      const collectionsArray = Object.values(nft_collections as any);
      const actualTotalNFTs = collectionsArray.reduce((sum: number, group: any) => sum + group.nfts.length, 0);
      
      // Create stats object using actual counts
      stats = {
        collections_owned: collectionsArray.length,
        total_nfts: actualTotalNFTs,
        power_breakdown: {
          army: player.army_power || 0,
          religion: player.religion_power || 0,
          civilization: player.civilization_power || 0,
          economic: player.economic_power || 0
        },
        total_power: player.total_power_level,
        rank: player.gaming_rank
      };
    } else {
      console.log(`⚠️ [PLAYER DASHBOARD] No player data found for ${userHandle}`);
    }

    const dashboardResponse = {
      success: true,
      player,
      nft_collections,
      recent_events,
      stats
    };

    console.log(`🎮 [PLAYER DASHBOARD] Response payload:`, {
      hasPlayer: !!dashboardResponse.player,
      collectionsCount: Object.keys(dashboardResponse.nft_collections).length,
      eventsCount: dashboardResponse.recent_events.length,
      hasStats: !!dashboardResponse.stats
    });

    res.json(dashboardResponse);

  } catch (error: any) {
    console.error("❌ [PLAYER DASHBOARD] Failed to get dashboard data:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get player dashboard data",
      debug_info: process.env.NODE_ENV === 'development' ? error?.message : undefined
    });
  }
});

/**
 * Get all gaming collections and their details
 */
router.get("/collections", async (req, res) => {
  try {
    console.log("🎮 [NFT Gaming] Getting gaming collections");
    
    const collections = await storage.getGamingCollections();

    res.json({
      success: true,
      collections,
      total: collections.length
    });

  } catch (error) {
    console.error("🎮 [NFT Gaming] Failed to get collections:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get gaming collections"
    });
  }
});

/**
 * Verify NFT ownership for a specific wallet
 */
router.post("/verify-ownership", async (req, res) => {
  try {
    console.log(`🛡️ [PAYLOAD SECURITY] Raw request body:`, JSON.stringify(req.body, null, 2));
    console.log(`🛡️ [PAYLOAD SECURITY] Request headers:`, {
      'content-type': req.get('content-type'),
      'user-agent': req.get('user-agent'),
      'x-forwarded-for': req.get('x-forwarded-for'),
      'origin': req.get('origin')
    });
    console.log(`🛡️ [PAYLOAD SECURITY] Request method:`, req.method);
    console.log(`🛡️ [PAYLOAD SECURITY] Request url:`, req.url);

    // Enhanced payload validation with detailed logging
    let parsedBody;
    try {
      parsedBody = verifyOwnershipSchema.parse(req.body);
      console.log(`✅ [PAYLOAD SECURITY] Schema validation passed:`, parsedBody);
    } catch (validationError) {
      console.error(`❌ [PAYLOAD SECURITY] Schema validation failed:`, validationError);
      return res.status(400).json({
        success: false,
        error: "Invalid payload format",
        validation_details: validationError
      });
    }
    
    const { wallet_address, chain } = parsedBody;
    const userHandle = req.user?.userHandle;
    
    console.log(`🔐 [AUTH DEBUG] Session user:`, {
      userHandle,
      hasUser: !!req.user,
      userKeys: req.user ? Object.keys(req.user) : 'no user'
    });
    
    if (!userHandle) {
      console.error(`❌ [AUTH DEBUG] No userHandle found in session`);
      return res.status(401).json({
        success: false,
        error: "Authentication required"
      });
    }

    console.log(`🎮 [NFT Gaming] Verifying ownership for ${userHandle} - ${wallet_address}`);

    // Get all gaming collections
    const collections = await db
      .select()
      .from(gamingNftCollections)
      .where(eq(gamingNftCollections.active_in_game, true));

    let totalVerifiedNFTs = 0;
    const powerBreakdown = {
      army_power: 0,
      bank_power: 0,
      merchant_power: 0,
      special_power: 0
    };
    const ownedCollections = [];

    // Check each collection for NFT ownership using database
    for (const collection of collections) {
      console.log(`🔍 [NFT Gaming] Checking collection: ${collection.collection_name} (Taxon ${collection.taxon})`);
      
      try {
        // Query NFTs from database for this collection and wallet
        const ownedNFTs = await db
          .select()
          .from(gamingNfts)
          .where(
            and(
              eq(gamingNfts.collection_id, collection.collection_id),
              eq(gamingNfts.owner_address, wallet_address)
            )
          );

        // If no NFTs in database for this collection, populate it first
        if (ownedNFTs.length === 0) {
          console.log(`📡 [NFT Gaming] No local data for ${collection.collection_name}, fetching from API...`);
          
          // Parse issuer and taxon from collection_id (format: "issuer:taxon")
          const [issuer, taxonStr] = collection.collection_id.split(':');
          const taxon = parseInt(taxonStr);
          
          if (issuer && !isNaN(taxon)) {
            try {
              const collectionData = await getBithompCollection(issuer, taxon);
              if (collectionData.success && collectionData.collection?.nfts) {
                const nfts = collectionData.collection.nfts;
                console.log(`✅ Found ${nfts.length} NFTs for ${collection.collection_name}, storing in database...`);
                
                // Store all NFTs from this collection in database
                for (const nft of nfts) {
                  try {
                    await db.insert(gamingNfts).values({
                      collection_id: collection.collection_id,
                      token_id: nft.nft_id || nft.id,
                      nft_id: nft.nft_id || nft.id,
                      owner_address: nft.owner,
                      metadata: nft.metadata || {},
                      traits: nft.traits || {},
                      image_url: nft.image,
                      name: nft.name,
                      description: nft.description,
                      rarity_rank: nft.rarity_rank || null,
                      rarity_score: nft.rarity_score || null,
                      game_stats: {},
                      is_genesis: false,
                      power_multiplier: 1.0,
                      last_transferred: nft.last_transferred ? new Date(nft.last_transferred as any) : null,
                      metadata_updated: new Date(),
                      created_at: new Date(),
                      updated_at: new Date()
                    } as any).onConflictDoUpdate({
                      target: gamingNfts.id,
                      set: {
                        owner_address: nft.owner,
                        metadata: nft.metadata || {},
                        traits: nft.traits || {},
                        image_url: nft.image,
                        name: nft.name,
                        description: nft.description,
                        updated_at: new Date()
                      } as any
                    });
                  } catch (insertError) {
                    console.error(`Failed to insert NFT ${nft.nft_id || nft.id}:`, insertError);
                  }
                }
                
                // Now re-query for this wallet's NFTs
                const updatedOwnedNFTs = await db
                  .select()
                  .from(gamingNfts)
                  .where(
                    and(
                      eq(gamingNfts.collection_id, collection.collection_id),
                      eq(gamingNfts.owner_address, wallet_address)
                    )
                  );
                
                ownedNFTs.push(...updatedOwnedNFTs);
              }
            } catch (error) {
              console.error(`⚠️ [NFT Gaming] Failed to populate collection ${collection.collection_name}:`, error);
            }
          }
        }

        if (ownedNFTs.length > 0) {
          console.log(`✅ [NFT Gaming] Found ${ownedNFTs.length} NFTs from ${collection.collection_name}`);
          
          // Calculate power based on role
          let powerValue = ownedNFTs.length * (collection.power_level || 0);
          
          switch (collection.game_role) {
            case 'army':
              powerBreakdown.army_power += powerValue;
              break;
            case 'bank':
              powerBreakdown.bank_power += powerValue;
              break;
            case 'merchant':
              powerBreakdown.merchant_power += powerValue;
              break;
            case 'power':
            case 'special':
              powerBreakdown.special_power += powerValue;
              break;
          }

          totalVerifiedNFTs += ownedNFTs.length;
          ownedCollections.push({
            collection: collection,
            nfts: ownedNFTs,
            count: ownedNFTs.length,
            power_contribution: powerValue
          });

          // Store/update NFTs in database
          for (const nft of ownedNFTs) {
            await storage.createGamingNFT({
              collection_id: collection.id,
              token_id: nft.token_id,
              nft_id: nft.nft_id,
              owner_address: wallet_address,
              metadata: nft.metadata || {},
              traits: nft.traits || {},
              image_url: nft.image_url || '',
              name: nft.name || `${collection.collection_name} #${nft.token_id}`,
              description: nft.description || ''
            });
          }
        }
      } catch (collectionError: any) {
        console.error(`❌ [NFT Gaming] Error checking collection ${collection.collection_name}:`, collectionError);
      }
    }

    // Create or update player profile
    const totalPowerLevel = Object.values(powerBreakdown as any).reduce((sum, power) => sum + power, 0);
    
    let gamingRank = "Novice";
    if (totalPowerLevel >= 100) gamingRank = "Legend";
    else if (totalPowerLevel >= 75) gamingRank = "Lord";
    else if (totalPowerLevel >= 50) gamingRank = "Commander";
    else if (totalPowerLevel >= 25) gamingRank = "Warrior";

    const playerData = {
      user_handle: userHandle,
      wallet_address,
      chain,
      total_nfts_owned: totalVerifiedNFTs,
      ...powerBreakdown,
      total_power_level: totalPowerLevel,
      gaming_rank: gamingRank,
      is_gaming_verified: true,
      verification_completed_at: new Date(),
      last_active: new Date()
    };

    await storage.createGamingPlayer(playerData);

    // Log the verification event
    const playerRecord = await storage.getGamingPlayer(userHandle);
    if (playerRecord.length > 0) {
      await storage.createGamingEvent({
        event_type: "nft_verification",
        player_id: playerRecord[0].id,
        event_data: {
          verified_collections: ownedCollections.length,
          total_nfts: totalVerifiedNFTs,
          power_breakdown: powerBreakdown
        },
        power_changes: powerBreakdown,
        riddleauthor_narration: `The mystical forces recognize ${userHandle} as a ${gamingRank} with ${totalVerifiedNFTs} powerful NFTs across ${ownedCollections.length} legendary collections.`,
        event_outcome: "success"
      });
    }

    res.json({
      success: true,
      verification: {
        total_nfts: totalVerifiedNFTs,
        collections_found: ownedCollections.length,
        power_breakdown: powerBreakdown,
        total_power_level: totalPowerLevel,
        gaming_rank: gamingRank,
        owned_collections: ownedCollections.map(oc => ({
          name: oc.collection.collection_name,
          role: oc.collection.game_role,
          count: oc.count,
          power: oc.power_contribution
        }))
      }
    });

  } catch (error) {
    console.error("🎮 [NFT Gaming] Failed to verify ownership:", error);
    res.status(500).json({
      success: false,
      error: "Failed to verify NFT ownership"
    });
  }
});

/**
 * Enhanced NFT Verification with Ownership Scanning
 * Comprehensive scanning of all linked wallets with diff notifications
 */
router.post("/player/verify-nfts", async (req, res) => {
  try {
    // Get user handle from session if available, otherwise allow public access
    const session = req.session as any;
    const userHandle = session?.user?.handle || session?.handle || session?.user_handle || (req as any).user?.handle || 'public_user';
    
    console.log(`🔍 [NFT-VERIFICATION] User handle: ${userHandle}`);

    console.log(`🔍 [NFT-VERIFICATION] Starting comprehensive NFT scan for user: ${userHandle}`);

    // Parse and validate request
    const validation = nftVerificationSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Invalid request", 
        details: validation.error.errors 
      });
    }

    const { wallet_address } = validation.data;

    let scanResults;
    
    if (wallet_address) {
      // Scan specific wallet
      console.log(`📱 [NFT-VERIFICATION] Scanning specific wallet: ${wallet_address}`);
      scanResults = [await nftOwnershipScanner.scanWallet(wallet_address, userHandle)];
    } else {
      // Scan all linked wallets
      console.log(`📱 [NFT-VERIFICATION] Scanning all linked wallets for: ${userHandle}`);
      scanResults = await nftOwnershipScanner.scanAllUserWallets(userHandle);
    }

    // Aggregate results across all wallets
    const aggregatedResults = {
      total_nfts: scanResults.reduce((sum, result) => sum + result.total_nfts, 0),
      total_power: scanResults.reduce((sum, result) => sum + result.total_power, 0),
      verified_nfts: scanResults.flatMap(result => 
        Object.values(result.collections as any).flatMap((collection: any) => 
          collection.nfts.map((nft: any) => ({
            name: nft.metadata?.name || 'Unknown NFT',
            collection_name: (nftOwnershipScanner as any).getCollectionName(nft.issuer),
            chain: 'xrp',
            power_level: (nftOwnershipScanner as any).calculateNftPower(nft),
            nft_id: nft.nftokenID,
            issuer: nft.issuer,
            owner: nft.owner
          }))
        )
      ),
      collections_summary: {} as Record<string, any>,
      new_nfts_found: scanResults.reduce((sum, result) => sum + result.new_nfts.length, 0),
      removed_nfts_count: scanResults.reduce((sum, result) => sum + result.removed_nfts.length, 0),
      scan_duration_ms: scanResults.reduce((sum, result) => sum + result.scan_duration_ms, 0)
    };

    // Build collections summary
    for (const result of scanResults) {
      for (const [collectionKey, collectionData] of Object.entries(result.collections)) {
        if (!aggregatedResults.collections_summary[collectionKey]) {
          aggregatedResults.collections_summary[collectionKey] = {
            count: 0,
            power: 0,
            name: (nftOwnershipScanner as any).getCollectionName(collectionKey.split(':')[0])
          };
        }
        aggregatedResults.collections_summary[collectionKey].count += (collectionData as any).count;
        aggregatedResults.collections_summary[collectionKey].power += (collectionData as any).power;
      }
    }

    console.log(`✅ [NFT-VERIFICATION] Scan complete for ${userHandle}: ${aggregatedResults.total_nfts} NFTs, ${aggregatedResults.total_power} total power`);

    res.json({
      success: true,
      verification_status: 'completed',
      total_nfts: aggregatedResults.total_nfts,
      total_power: aggregatedResults.total_power,
      verified_nfts: aggregatedResults.verified_nfts,
      collections: aggregatedResults.collections_summary,
      new_nfts_found: aggregatedResults.new_nfts_found,
      removed_nfts_count: aggregatedResults.removed_nfts_count,
      scan_results: scanResults,
      scan_timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error(`❌ [NFT-VERIFICATION] Error:`, error);
    res.status(500).json({ 
      error: "NFT verification failed", 
      details: error.message,
      verification_status: 'failed'
    });
  }
});

/**
 * Test NFT Scanner with dippydoge's wallet
 */
router.post("/test/dippydoge-nfts", async (req, res) => {
  try {
    // Get user handle from session if available, otherwise allow public access
    const session = req.session as any;
    const userHandle = session?.user?.handle || session?.handle || session?.user_handle || 'public_user';
    
    console.log(`🔍 [DIPPYDOGE-TEST] User handle: ${userHandle}`);

    console.log(`🧪 [DIPPYDOGE-TEST] Testing NFT scanner with dippydoge's wallet`);

    // Test with dippydoge's actual XRPL wallet
    const testWallet = req.body.wallet_address || 'rDippyDogeWalletAddressHere'; // Replace with actual address
    
    const scanResult = await nftOwnershipScanner.scanWallet(testWallet, userHandle);

    res.json({
      success: true,
      test_results: scanResult,
      collections_found: Object.keys(scanResult.collections).length,
      inquisition_nfts: Object.entries(scanResult.collections)
        .filter(([key, _]) => key.toLowerCase().includes('inquisition'))
        .map(([key, data]) => ({
          collection: key,
          count: data.count,
          power: data.power,
          nfts: data.nfts.map(nft => ({
            name: nft.metadata?.name || 'Unknown',
            nft_id: nft.nftokenID,
            power: (nftOwnershipScanner as any).calculateNftPower(nft)
          }))
        })),
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error(`❌ [DIPPYDOGE-TEST] Error:`, error);
    res.status(500).json({ 
      error: "Test failed", 
      details: error.message 
    });
  }
});

/**
 * Get player dashboard data
 */
router.get("/player/dashboard", sessionAuth, async (req, res) => {
  try {
    const userHandle = req.user?.userHandle;
    
    if (!userHandle) {
      return res.status(401).json({
        success: false,
        error: "Authentication required"
      });
    }

    console.log(`🎮 [NFT Gaming] Getting dashboard for ${userHandle}`);

    // Get player data
    const player = await storage.getGamingPlayer(userHandle);

    if (player.length === 0) {
      return res.json({
        success: true,
        player: null,
        message: "No gaming profile found. Please verify your NFT ownership first."
      });
    }

    const playerData = player[0];

    // Get owned NFTs by collection
    const ownedNFTs = await storage.getPlayerNFTs(playerData.wallet_address);

    // Group NFTs by collection
    const nftsByCollection = ownedNFTs.reduce((acc: Record<string, any>, item: any) => {
      const collectionName = item.collection.collection_name;
      if (!acc[collectionName]) {
        acc[collectionName] = {
          collection: item.collection,
          nfts: []
        };
      }
      acc[collectionName].nfts.push(item.nft);
      return acc;
    }, {} as Record<string, any>);

    // Get recent gaming events
    const recentEvents = await storage.getGamingEvents(playerData.id, 10);

    res.json({
      success: true,
      player: playerData,
      nft_collections: nftsByCollection,
      recent_events: recentEvents,
      stats: {
        collections_owned: Object.keys(nftsByCollection).length,
        total_nfts: playerData.total_nfts_owned,
        power_breakdown: {
          army: playerData.army_power,
          bank: playerData.bank_power,
          merchant: playerData.merchant_power,
          special: playerData.special_power
        },
        total_power: playerData.total_power_level,
        rank: playerData.gaming_rank
      }
    });

  } catch (error) {
    console.error("🎮 [NFT Gaming] Failed to get player dashboard:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get player dashboard"
    });
  }
});

/**
 * Get leaderboard of top players
 */
router.get("/leaderboard", async (req, res) => {
  try {
    console.log("🎮 [NFT Gaming] Getting leaderboard");

    const topPlayers = await storage.getGamingLeaderboard(50);

    res.json({
      success: true,
      leaderboard: topPlayers,
      total_players: topPlayers.length
    });

  } catch (error) {
    console.error("🎮 [NFT Gaming] Failed to get leaderboard:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get leaderboard"
    });
  }
});

/**
 * Trigger asset ingestion for gaming collections
 */
router.post("/ingest-collections", sessionAuth, async (req, res) => {
  try {
    const userHandle = req.user?.userHandle;
    
    if (!userHandle) {
      return res.status(401).json({
        success: false,
        error: "Authentication required"
      });
    }

    console.log(`🎮 [NFT Gaming] Triggering collection ingestion for ${userHandle}`);

    // Get collections that need ingestion - using proper Drizzle ORM
    const collections = await db
      .select()
      .from(gamingNftCollections)
      .where(eq(gamingNftCollections.metadata_ingested, false));

    // Queue ingestion jobs for each collection
    const jobs = [];
    for (const collection of collections) {
      const jobData = {
        job_type: "collection_scan" as const,
        entity_type: "collection" as const,
        status: "queued" as const,
        target_issuer: collection.collection_id,
        target_taxon: collection.taxon,
        project_handle: userHandle,
        priority: 1,
        metadata: {
          collection_name: collection.collection_name,
          game_role: collection.game_role,
          for_gaming: true
        }
      };

      try {
        await storage.createIngestionJob(jobData);
        jobs.push({
          collection: collection.collection_name,
          status: "queued"
        });
      } catch (error: any) {
        console.error(`Failed to queue job for ${collection.collection_name}:`, error);
        jobs.push({
          collection: collection.collection_name,
          status: "failed",
          error: error?.message || 'Unknown error'
        });
      }
    }

    res.json({
      success: true,
      message: `Queued ingestion for ${jobs.length} collections`,
      jobs
    });

  } catch (error) {
    console.error("🎮 [NFT Gaming] Failed to trigger ingestion:", error);
    res.status(500).json({
      success: false,
      error: "Failed to trigger collection ingestion"
    });
  }
});

/**
 * Purchase land plot with XRP or RDL payment transaction
 * Creates XRP or RDL transaction to bank wallet with plot number and destination tag
 * Includes 75% early bird discount for limited time
 */
router.post("/purchase-plot", sessionAuth, async (req, res) => {
  try {
    const userHandle = req.user?.userHandle;
    
    if (!userHandle) {
      return res.status(401).json({
        success: false,
        error: "Authentication required"
      });
    }

    // Enhanced validation schema with payment method option
    const simplePlotSchema = z.object({
      plot_number: z.number().positive().max(1000),
      destination_tag: z.string().regex(/^PLOT\d+$/),
      payment_method: z.enum(['XRP', 'RDL']).default('XRP')
    });

    const validationResult = simplePlotSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request data",
        details: validationResult.error.issues
      });
    }

    const { plot_number, destination_tag, payment_method } = validationResult.data;

    // SECURITY: Atomic reservation to prevent race conditions
    // Single atomic UPDATE that both checks availability and reserves the plot
    const result = await db.transaction(async (tx) => {
      // Single atomic operation: check availability and reserve in one statement
      const reservationExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      const updateResult = await tx.execute(sql`
        UPDATE medieval_land_plots 
        SET status = 'reserved', reserved_by = ${userHandle}, reserved_until = ${reservationExpiry.toISOString()}
        WHERE plot_number = ${plot_number} 
        AND (status = 'available' OR (status = 'reserved' AND reserved_until < NOW()))
        RETURNING *
      `);
      
      const updatedData = (updateResult.rows || updateResult) as any[];
      
      if (!updatedData || updatedData.length === 0) {
        throw new Error("Plot not available for purchase");
      }
      
      return updatedData[0];
    });

    if (!result) {
      return res.status(400).json({
        success: false,
        error: "Plot not available for purchase"
      });
    }

    const plot = result;
    
    // Server-controlled pricing and yield data
    const plot_id = plot.id;
    const coordinates = { x: plot.map_x, y: plot.map_y };
    const terrain_type = plot.terrain_type;
    
    // Calculate prices with 75% early bird discount
    const base_xrp_price = Number(plot.price_xrp || 0);
    const early_bird_discount = 0.75; // 75% discount
    const discounted_xrp_price = Math.round(base_xrp_price * (1 - early_bird_discount));
    
    // RDL pricing (1 XRP = 1000 RDL for conversion)
    const rdl_price = discounted_xrp_price * 1000;
    
    const yearly_yield = plot.yield_tokens_per_year;
    const yield_percentage = plot.yield_percentage;
    const size_multiplier = plot.size_multiplier;

    const final_price = payment_method === 'RDL' ? rdl_price : discounted_xrp_price;
    const price_currency = payment_method === 'RDL' ? 'RDL' : 'XRP';

    console.log(`🎮 [PLOT PURCHASE] ${userHandle} purchasing Plot #${plot_number} for ${final_price} ${price_currency} (75% early bird discount applied!)`);
    
    // Bank wallet address for receiving payments
    const BANK_WALLET = "rsFbZ33Zr3BCVyiVPw8pFvbtnrG1i8FwA3"; // RiddleSwap bank wallet
    const RDL_ISSUER = "rEVrTKUKSLx5nxdfV8SAFTxS9FGFrfHRLo"; // RDL token issuer
    
    // Get user's XRPL wallet from Riddle Wallet
    const riddleWallet = await storage.getRiddleWalletByHandle(userHandle);
    if (!riddleWallet?.xrpAddress) {
      return res.status(400).json({
        success: false,
        error: "XRPL wallet not found"
      });
    }

    const fromAddress = riddleWallet.xrpAddress;

    // Create payment transaction object based on payment method
    let paymentTransaction;
    
    if (payment_method === 'RDL') {
      // RDL token payment
      paymentTransaction = {
        TransactionType: "Payment",
        Account: fromAddress,
        Destination: BANK_WALLET,
        Amount: {
          currency: "RDL",
          issuer: RDL_ISSUER,
          value: String(rdl_price)
        },
        DestinationTag: parseInt(destination_tag.replace('PLOT', '')),
        Memos: [
          {
            Memo: {
              MemoType: Buffer.from("plot_purchase_rdl", "utf8").toString("hex").toUpperCase(),
              MemoData: Buffer.from(JSON.stringify({
                plot_id: plot_number,
                coordinates,
                terrain_type,
                buyer: userHandle,
                payment_method: 'RDL',
                early_bird_discount: early_bird_discount,
                purchase_time: new Date().toISOString()
              }), "utf8").toString("hex").toUpperCase()
            }
          }
        ]
      };
    } else {
      // XRP payment
      paymentTransaction = {
        TransactionType: "Payment",
        Account: fromAddress,
        Destination: BANK_WALLET,
        Amount: String(discounted_xrp_price * 1000000), // Convert XRP to drops
        DestinationTag: parseInt(destination_tag.replace('PLOT', '')),
        Memos: [
          {
            Memo: {
              MemoType: Buffer.from("plot_purchase_xrp", "utf8").toString("hex").toUpperCase(),
              MemoData: Buffer.from(JSON.stringify({
                plot_id: plot_number,
                coordinates,
                terrain_type,
                buyer: userHandle,
                payment_method: 'XRP',
                early_bird_discount: early_bird_discount,
                purchase_time: new Date().toISOString()
              }), "utf8").toString("hex").toUpperCase()
            }
          }
        ]
      };
    }

    // Generate transaction hash for tracking (would be replaced by actual signing in production)
    const transactionHash = `TXN${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Save plot purchase to database with payment method tracking
    const plotPurchase = {
      user_handle: userHandle,
      plot_id: plot_number,
      plot_coordinates: `${coordinates.x},${coordinates.y}`,
      terrain_type,
      xrp_price: payment_method === 'XRP' ? discounted_xrp_price : base_xrp_price,
      rdl_price: payment_method === 'RDL' ? rdl_price : null,
      payment_method: payment_method,
      early_bird_discount: early_bird_discount,
      original_price: base_xrp_price,
      final_price: final_price,
      yearly_yield,
      yield_percentage,
      size_multiplier,
      destination_tag,
      transaction_hash: transactionHash,
      transaction_status: 'pending',
      bank_wallet: BANK_WALLET,
      purchase_timestamp: new Date(),
      memo_data: JSON.stringify({
        plot_id: plot_number,
        coordinates,
        terrain_type,
        buyer: userHandle,
        payment_method: payment_method,
        early_bird_discount: early_bird_discount
      })
    };
    
    // Set user preference for RDL payments if they use RDL for plot purchase
    if (payment_method === 'RDL') {
      // Store user preference for RDL-only purchases
      try {
        await storage.setUserPaymentPreference(userHandle, 'RDL_ONLY');
        console.log(`🎯 [PLOT PURCHASE] ${userHandle} is now set to RDL-only payment mode`);
      } catch (error) {
        console.warn(`⚠️ [PLOT PURCHASE] Failed to set RDL preference:`, error);
      }
    }

    console.log(`🎮 [PLOT PURCHASE] Saving plot purchase to database:`, plotPurchase);
    console.log(`🎮 [PLOT PURCHASE] ${payment_method} Transaction prepared:`, {
      from: fromAddress,
      to: BANK_WALLET,
      amount: `${final_price} ${price_currency}`,
      destinationTag: destination_tag,
      hash: transactionHash,
      earlyBirdDiscount: `${early_bird_discount * 100}%`
    });

    // TODO: In production, integrate with XRPL client to actually submit the transaction
    // For now, we simulate the transaction creation
    
    res.json({
      success: true,
      message: `Plot #${plot_number} purchase initiated with 75% EARLY BIRD DISCOUNT! 🎉`,
      plot_id: plot_number,
      transaction_hash: transactionHash,
      payment_method: payment_method,
      original_price: base_xrp_price,
      final_price: final_price,
      currency: price_currency,
      early_bird_discount: `${early_bird_discount * 100}%`,
      savings: payment_method === 'XRP' ? Number(base_xrp_price) - Number(discounted_xrp_price) : (Number(base_xrp_price) * 1000) - Number(rdl_price),
      rdl_only_mode: payment_method === 'RDL' ? 'All future weapons and items must be purchased with RDL tokens' : null,
      destination_tag,
      bank_wallet: BANK_WALLET,
      yearly_yield,
      yield_percentage,
      coordinates,
      terrain_type,
      size_multiplier,
      purchase_data: plotPurchase,
      payment_transaction: paymentTransaction
    });

  } catch (error) {
    console.error("🎮 [PLOT PURCHASE] Failed to create plot purchase:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create XRP payment transaction for plot purchase"
    });
  }
});

// ==========================================
// BUILDING SYSTEM APIs
// ==========================================

/**
 * Get all available building types for construction
 */
router.get('/building-types', async (req, res) => {
  try {
    console.log('🏗️ [BUILDINGS] Getting available building types');
    
    const buildingTypes = await db.execute(sql`
      SELECT * FROM building_types
      ORDER BY category, name
    `);
    
    const buildingTypesArray = (buildingTypes.rows || buildingTypes) as any[];
    
    res.json({
      success: true,
      building_types: buildingTypesArray.map((bt: any) => ({
        id: bt.id,
        name: bt.name,
        description: bt.description,
        category: bt.category,
        icon: bt.icon,
        required_terrain_types: bt.required_terrain_types || [],
        required_resources: bt.required_resources || {},
        build_time: bt.build_time,
        max_per_plot: bt.max_per_plot,
        produces: bt.produces || [],
        production_rate: parseFloat(bt.production_rate || 0),
        storage_capacity: bt.storage_capacity,
        can_upgrade: bt.can_upgrade,
        max_level: bt.max_level,
        upgrade_multiplier: parseFloat(bt.upgrade_multiplier || 1.5)
      }))
    });
    
  } catch (error) {
    console.error("🏗️ [BUILDINGS] Failed to get building types:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch building types"
    });
  }
});

/**
 * Get player resources and civilization stats
 */
router.get('/player-resources/:playerId', sessionAuth, async (req, res) => {
  try {
    const { playerId } = req.params;
    console.log(`🏗️ [RESOURCES] Getting resources for player: ${playerId}`);
    
    // Get or create player resources
    let resources = await db.execute(sql`
      SELECT * FROM player_resources WHERE player_id = ${playerId}
    `);
    
    const resourcesArray = (resources.rows || resources) as any[];
    
    if (resourcesArray.length === 0) {
      console.log(`🏗️ [RESOURCES] Creating initial resources for new player: ${playerId}`);
      await db.execute(sql`
        INSERT INTO player_resources (player_id) VALUES (${playerId})
      `);
      
      resources = await db.execute(sql`
        SELECT * FROM player_resources WHERE player_id = ${playerId}
      `);
    }
    
    const finalResourcesArray = resources.rows || resources;
    const playerData = finalResourcesArray[0];
    
    // Get civilization data
    let civilization = await db.execute(sql`
      SELECT * FROM player_civilizations WHERE player_id = ${playerId}
    `);
    
    const civilizationArray = (civilization.rows || civilization) as any[];
    
    if (civilizationArray.length === 0) {
      // Create initial civilization
      await db.execute(sql`
        INSERT INTO player_civilizations (player_id) VALUES (${playerId})
      `);
      
      civilization = await db.execute(sql`
        SELECT * FROM player_civilizations WHERE player_id = ${playerId}
      `);
    }
    
    const finalCivilizationArray = civilization.rows || civilization;
    const civData = finalCivilizationArray[0];
    
    res.json({
      success: true,
      resources: {
        gold: parseFloat(playerData.gold || 0),
        wood: playerData.wood || 0,
        stone: playerData.stone || 0,
        food: playerData.food || 0,
        iron: playerData.iron || 0,
        coal: playerData.coal || 0,
        gems: playerData.gems || 0,
        mithril: playerData.mithril || 0,
        magic_essence: playerData.magic_essence || 0,
        population: playerData.population || 0,
        happiness: playerData.happiness || 50,
        culture: playerData.culture || 0,
        research_points: playerData.research_points || 0,
        max_storage: playerData.max_storage || {}
      },
      civilization: {
        name: civData.civilization_name || 'New Settlement',
        type: civData.civilization_type || 'village',
        total_plots: civData.total_plots || 0,
        total_buildings: civData.total_buildings || 0,
        total_population: civData.total_population || 0,
        daily_income: civData.daily_income || {},
        total_wealth: parseFloat(civData.total_wealth || 0),
        global_rank: civData.global_rank,
        culture_level: civData.culture_level || 1,
        research_level: civData.research_level || 1
      }
    });
    
  } catch (error) {
    console.error("🏗️ [RESOURCES] Failed to get player resources:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch player resources"
    });
  }
});

/**
 * Get buildings on a specific plot
 */
router.get('/plot-buildings/:plotId', sessionAuth, async (req, res) => {
  try {
    const { plotId } = req.params;
    console.log(`🏗️ [BUILDINGS] Getting buildings for plot: ${plotId}`);
    
    const buildings = await db.execute(sql`
      SELECT pb.*, bt.name as building_name, bt.icon, bt.category, bt.produces, bt.production_rate, bt.can_upgrade, bt.max_level
      FROM plot_buildings pb
      JOIN building_types bt ON pb.building_type_id = bt.id
      WHERE pb.plot_id = ${plotId}
      ORDER BY pb.created_at
    `);
    
    const buildingsArray = (buildings.rows || buildings) as any[];
    
    res.json({
      success: true,
      buildings: buildingsArray.map((b: any) => ({
        id: b.id,
        building_type_id: b.building_type_id,
        building_name: b.building_name,
        icon: b.icon,
        category: b.category,
        level: b.level,
        position_x: b.position_x,
        position_y: b.position_y,
        status: b.status,
        construction_started: b.construction_started,
        construction_completed: b.construction_completed,
        last_harvested: b.last_harvested,
        total_produced: b.total_produced || {},
        produces: b.produces || [],
        production_rate: parseFloat(b.production_rate || 0),
        can_upgrade: b.can_upgrade,
        max_level: b.max_level,
        upgrade_started: b.upgrade_started,
        upgrade_completed: b.upgrade_completed
      }))
    });
    
  } catch (error) {
    console.error("🏗️ [BUILDINGS] Failed to get plot buildings:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch plot buildings"
    });
  }
});

/**
 * Build a new building on a plot
 */
router.post('/build-building', sessionAuth, async (req, res) => {
  try {
    const { plotId, buildingTypeId, positionX = 50, positionY = 50 } = req.body;
    const playerId = req.user?.userHandle; // Get from middleware
    
    console.log(`🏗️ [BUILD] Player ${playerId} building ${buildingTypeId} on plot ${plotId}`);
    
    // Get building type details
    const buildingType = await db.execute(sql`
      SELECT * FROM building_types WHERE id = ${buildingTypeId}
    `);
    
    const buildingTypeArray = (buildingType.rows || buildingType) as any[];
    
    if (buildingTypeArray.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid building type"
      });
    }
    
    const bt = buildingTypeArray[0];
    
    // Get player resources
    const playerResources = await db.execute(sql`
      SELECT * FROM player_resources WHERE player_id = ${playerId}
    `);
    
    const playerResourcesArray = (playerResources.rows || playerResources) as any[];
    
    if (playerResourcesArray.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Player resources not found"
      });
    }
    
    const resources = playerResourcesArray[0];
    const requiredResources = bt.required_resources || {};
    
    // Check if player has enough resources
    for (const [resource, amount] of Object.entries(requiredResources)) {
      const playerAmount = resources[resource] || 0;
      if (playerAmount < amount) {
        return res.status(400).json({
          success: false,
          error: `Insufficient ${resource}. Need ${amount}, have ${playerAmount}`
        });
      }
    }
    
    // Check if plot exists and is owned by player
    const plot = await db.execute(sql`
      SELECT * FROM medieval_land_plots WHERE id = ${plotId} AND owner_id = ${playerId}
    `);
    
    const plotArray = (plot.rows || plot) as any[];
    
    if (plotArray.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Plot not found or not owned by player"
      });
    }
    
    // Check max buildings per plot limit
    const existingBuildings = await db.execute(sql`
      SELECT COUNT(*) as count FROM plot_buildings 
      WHERE plot_id = ${plotId} AND building_type_id = ${buildingTypeId} AND status != 'destroyed'
    `);
    
    const existingBuildingsArray = existingBuildings.rows || existingBuildings;
    
    if (existingBuildingsArray[0].count >= bt.max_per_plot) {
      return res.status(400).json({
        success: false,
        error: `Maximum ${bt.max_per_plot} ${bt.name}(s) per plot`
      });
    }
    
    // Deduct resources with proper column whitelisting
    const ALLOWED_RESOURCE_COLUMNS = ['wood', 'stone', 'iron', 'gold', 'food', 'coal', 'gems', 'crystal', 'mana', 'energy'];
    const updateFields = [];
    const updateValues = [];
    let valueIndex = 1;
    
    for (const [resource, amount] of Object.entries(requiredResources)) {
      // Security: Whitelist allowed resource column names to prevent SQL injection
      if (!ALLOWED_RESOURCE_COLUMNS.includes(resource)) {
        console.error(`🚨 [SECURITY] Invalid resource column: ${resource}`);
        return res.status(400).json({
          success: false,
          error: "Invalid resource type"
        });
      }
      updateFields.push(`${resource} = ${resource} - ${amount}`);
      updateValues.push(amount);
      valueIndex++;
    }
    
    await db.execute(sql`
      UPDATE player_resources 
      SET ${sql.raw(updateFields.join(', '))}, last_updated = NOW()
      WHERE player_id = ${playerId}
    `);
    
    // Create building
    const constructionTime = bt.build_time; // seconds
    const completionTime = new Date(Date.now() + constructionTime * 1000);
    
    const newBuilding = await db.execute(sql`
      INSERT INTO plot_buildings (plot_id, building_type_id, position_x, position_y, construction_completed)
      VALUES (${plotId}, ${buildingTypeId}, ${positionX}, ${positionY}, ${completionTime})
      RETURNING *
    `);
    
    const newBuildingArray = newBuilding.rows || newBuilding;
    
    console.log(`🏗️ [BUILD] Successfully started construction of ${bt.name} on plot ${plotId}`);
    
    res.json({
      success: true,
      message: `Construction of ${bt.name} started`,
      building: {
        id: newBuildingArray[0].id,
        building_type: bt.name,
        construction_time: constructionTime,
        completion_time: completionTime,
        resources_spent: requiredResources
      }
    });
    
  } catch (error) {
    console.error("🏗️ [BUILD] Failed to build building:", error);
    res.status(500).json({
      success: false,
      error: "Failed to start building construction"
    });
  }
});

/**
 * Harvest/collect resources from buildings
 */
router.post('/harvest-building/:buildingId', sessionAuth, async (req, res) => {
  try {
    const { buildingId } = req.params;
    const playerId = req.user?.userHandle;
    
    console.log(`🏗️ [HARVEST] Player ${playerId} harvesting building ${buildingId}`);
    
    // Get building details
    const building = await db.execute(sql`
      SELECT pb.*, bt.name, bt.produces, bt.production_rate, bt.storage_capacity, mlp.owner_id
      FROM plot_buildings pb
      JOIN building_types bt ON pb.building_type_id = bt.id
      JOIN medieval_land_plots mlp ON pb.plot_id = mlp.id
      WHERE pb.id = ${buildingId} AND mlp.owner_id = ${playerId}
    `);
    
    const buildingArray = (building.rows || building) as any[];
    
    if (buildingArray.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Building not found or not owned by player"
      });
    }
    
    const b = buildingArray[0];
    
    if (b.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: `Building is ${b.status}, cannot harvest`
      });
    }
    
    const produces = b.produces || [];
    if (produces.length === 0) {
      return res.status(400).json({
        success: false,
        error: "This building does not produce resources"
      });
    }
    
    // Calculate time since last harvest
    const lastHarvest = b.last_harvested ? new Date(b.last_harvested) : new Date(b.construction_completed);
    const now = new Date();
    const hoursElapsed = Math.max(0, (now.getTime() - lastHarvest.getTime()) / (1000 * 60 * 60));
    
    if (hoursElapsed < 0.1) { // Minimum 6 minutes between harvests
      return res.status(400).json({
        success: false,
        error: "Too soon to harvest again"
      });
    }
    
    // Calculate production
    const baseRate = parseFloat(b.production_rate) * b.level; // Level multiplier
    const totalProduction = Math.min(hoursElapsed * baseRate, b.storage_capacity);
    
    if (totalProduction < 0.1) {
      return res.status(400).json({
        success: false,
        error: "No resources to harvest yet"
      });
    }
    
    // Add resources to player
    const resourceUpdates = [];
    const resourceValues = [];
    const harvestedResources = {};
    
    for (const resource of produces) {
      const amount = Math.floor(totalProduction);
      resourceUpdates.push(`${resource} = ${resource} + $${resourceUpdates.length + 1}`);
      resourceValues.push(amount);
      harvestedResources[resource] = amount;
    }
    
    // Update player resources
    await db.execute(sql`
      UPDATE player_resources 
      SET ${sql.raw(resourceUpdates.join(', '))}, last_updated = NOW()
      WHERE player_id = ${playerId}
    `);
    
    // Update building harvest time
    await db.execute(sql`
      UPDATE plot_buildings 
      SET last_harvested = NOW(),
          total_produced = COALESCE(total_produced, '{}') || ${JSON.stringify(harvestedResources)}
      WHERE id = ${buildingId}
    `);
    
    // Record production history
    for (const [resource, amount] of Object.entries(harvestedResources)) {
      await db.execute(sql`
        INSERT INTO resource_production (player_id, plot_id, building_id, resource_type, amount, production_type, source, production_hour)
        VALUES (${playerId}, ${b.plot_id}, ${buildingId}, ${resource}, ${amount}, 'building', ${`${b.name} Level ${b.level}`}, NOW())
      `);
    }
    
    console.log(`🏗️ [HARVEST] Player ${playerId} harvested:`, harvestedResources);
    
    res.json({
      success: true,
      message: "Resources harvested successfully",
      harvested: harvestedResources,
      hours_elapsed: hoursElapsed,
      next_harvest_in: 1 // 1 hour for next full harvest
    });
    
  } catch (error) {
    console.error("🏗️ [HARVEST] Failed to harvest building:", error);
    res.status(500).json({
      success: false,
      error: "Failed to harvest resources"
    });
  }
});

/**
 * Upgrade a building
 */
router.post('/upgrade-building/:buildingId', sessionAuth, async (req, res) => {
  try {
    const { buildingId } = req.params;
    const playerId = req.user?.userHandle;
    
    console.log(`🏗️ [UPGRADE] Player ${playerId} upgrading building ${buildingId}`);
    
    // Get building details
    const building = await db.execute(sql`
      SELECT pb.*, bt.name, bt.can_upgrade, bt.max_level, bt.required_resources, mlp.owner_id
      FROM plot_buildings pb
      JOIN building_types bt ON pb.building_type_id = bt.id
      JOIN medieval_land_plots mlp ON pb.plot_id = mlp.id
      WHERE pb.id = ${buildingId} AND mlp.owner_id = ${playerId}
    `);
    
    const upgradeBuildingArray = (building.rows || building) as any[];
    
    if (upgradeBuildingArray.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Building not found or not owned by player"
      });
    }
    
    const b = upgradeBuildingArray[0];
    
    if (!b.can_upgrade) {
      return res.status(400).json({
        success: false,
        error: "This building cannot be upgraded"
      });
    }
    
    if (b.level >= b.max_level) {
      return res.status(400).json({
        success: false,
        error: "Building is already at maximum level"
      });
    }
    
    if (b.status === 'upgrading') {
      return res.status(400).json({
        success: false,
        error: "Building is already being upgraded"
      });
    }
    
    // Calculate upgrade cost (double the base cost for each level)
    const baseCost = b.required_resources || {};
    const upgradeCost: any = {};
    for (const [resource, baseAmount] of Object.entries(baseCost)) {
      upgradeCost[resource] = Math.floor((baseAmount as number) * Math.pow(1.5, b.level));
    }
    
    // Check player resources
    const playerResources = await db.execute(sql`
      SELECT * FROM player_resources WHERE player_id = ${playerId}
    `);
    
    const upgradeResourcesArray = (playerResources.rows || playerResources) as any[];
    
    if (upgradeResourcesArray.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Player resources not found"
      });
    }
    
    const resources = upgradeResourcesArray[0];
    
    for (const [resource, amount] of Object.entries(upgradeCost)) {
      const playerAmount = resources[resource] || 0;
      if (playerAmount < amount) {
        return res.status(400).json({
          success: false,
          error: `Insufficient ${resource}. Need ${amount}, have ${playerAmount}`
        });
      }
    }
    
    // Deduct resources with proper column whitelisting  
    const ALLOWED_RESOURCE_COLUMNS = ['wood', 'stone', 'iron', 'gold', 'food', 'coal', 'gems', 'crystal', 'mana', 'energy'];
    const updateFields = [];
    const updateValues = [];
    let valueIndex = 1;
    
    for (const [resource, amount] of Object.entries(upgradeCost)) {
      // Security: Whitelist allowed resource column names to prevent SQL injection
      if (!ALLOWED_RESOURCE_COLUMNS.includes(resource)) {
        console.error(`🚨 [SECURITY] Invalid resource column: ${resource}`);
        return res.status(400).json({
          success: false,
          error: "Invalid resource type"
        });
      }
      updateFields.push(`${resource} = ${resource} - $${valueIndex}`);
      updateValues.push(amount);
      valueIndex++;
    }
    
    await db.execute(sql`
      UPDATE player_resources 
      SET ${sql.raw(updateFields.join(', '))}, last_updated = NOW()
      WHERE player_id = ${playerId}
    `);
    
    // Start upgrade
    const upgradeTime = 600; // 10 minutes base upgrade time
    const completionTime = new Date(Date.now() + upgradeTime * 1000);
    
    await db.execute(sql`
      UPDATE plot_buildings 
      SET status = 'upgrading', 
          upgrade_started = NOW(),
          upgrade_completed = ${completionTime}
      WHERE id = ${buildingId}
    `);
    
    console.log(`🏗️ [UPGRADE] Successfully started upgrade of ${b.name} to level ${b.level + 1}`);
    
    res.json({
      success: true,
      message: `${b.name} upgrade to level ${b.level + 1} started`,
      upgrade_cost: upgradeCost,
      completion_time: completionTime,
      upgrade_time: upgradeTime
    });
    
  } catch (error) {
    console.error("🏗️ [UPGRADE] Failed to upgrade building:", error);
    res.status(500).json({
      success: false,
      error: "Failed to start building upgrade"
    });
  }
});

// =============================================
// CIVILIZATION AND ALLIANCE SYSTEM ROUTES
// =============================================

/**
 * Create a new player civilization
 */
router.post('/civilization', sessionAuth, async (req, res) => {
  try {
    const user_handle = req.user?.userHandle;
    if (!user_handle) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const validatedData = createCivilizationSchema.parse(req.body);
    
    // Check if user already has a civilization
    const existingCivilization = await storage.getPlayerCivilization(user_handle);
    if (existingCivilization) {
      return res.status(400).json({ 
        success: false, 
        error: 'You already have a civilization' 
      });
    }

    await storage.createPlayerCivilization({
      user_handle,
      ...validatedData,
      current_round: 1 // Default to round 1
    });

    console.log(`🏰 [CIVILIZATION] ${user_handle} founded ${validatedData.civilization_name}`);

    res.json({
      success: true,
      message: `Civilization ${validatedData.civilization_name} founded successfully`
    });
  } catch (error: any) {
    console.error('❌ [CIVILIZATION] Error creating civilization:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to create civilization' 
    });
  }
});

/**
 * Get player's civilization
 */
router.get('/civilization', sessionAuth, async (req, res) => {
  try {
    const user_handle = req.user?.userHandle;
    if (!user_handle) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const civilization = await storage.getPlayerCivilization(user_handle);
    
    res.json({
      success: true,
      civilization
    });
  } catch (error: any) {
    console.error('❌ [CIVILIZATION] Error fetching civilization:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch civilization' 
    });
  }
});

/**
 * Update player's civilization
 */
router.put('/civilization', sessionAuth, async (req, res) => {
  try {
    const user_handle = req.user?.userHandle;
    if (!user_handle) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const updateData = createCivilizationSchema.partial().parse(req.body);
    
    await storage.updatePlayerCivilization(user_handle, updateData);

    console.log(`🏰 [CIVILIZATION] ${user_handle} updated their civilization`);

    res.json({
      success: true,
      message: 'Civilization updated successfully'
    });
  } catch (error: any) {
    console.error('❌ [CIVILIZATION] Error updating civilization:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to update civilization' 
    });
  }
});

/**
 * Get verified riddle wallet users for alliance requests
 */
router.get('/riddle-wallet-users', sessionAuth, async (req, res) => {
  try {
    const users = await storage.getGamingRiddleWalletUsers();
    
    // Get additional player data for each user
    const usersWithData = [];
    for (const userHandle of users) {
      const playerData = await storage.getGamingPlayer(userHandle);
      if (playerData && playerData.length > 0) {
        usersWithData.push(playerData[0]);
      }
    }
    
    res.json(usersWithData);
  } catch (error: any) {
    console.error('❌ [ALLIES] Error fetching riddle wallet users:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch users' 
    });
  }
});

/**
 * Send an ally request
 */
router.post('/ally-request', sessionAuth, async (req, res) => {
  try {
    const user_handle = req.user?.userHandle;
    if (!user_handle) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const validatedData = createAllyRequestSchema.parse(req.body);
    
    // Check if user is trying to ally with themselves
    if (validatedData.receiver_handle === user_handle) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot send alliance request to yourself' 
      });
    }

    // Check if alliance already exists
    const existingAlliances = await storage.getAlliances(user_handle);
    const alreadyAllied = existingAlliances.some((alliance: any) => 
      alliance.player1_handle === validatedData.receiver_handle || 
      alliance.player2_handle === validatedData.receiver_handle
    );
    
    if (alreadyAllied) {
      return res.status(400).json({ 
        success: false, 
        error: 'You are already allied with this player' 
      });
    }

    await storage.createAllyRequest({
      sender_handle: user_handle,
      ...validatedData,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });

    console.log(`🤝 [ALLY] ${user_handle} sent alliance request to ${validatedData.receiver_handle}`);

    res.json({
      success: true,
      message: 'Alliance request sent successfully'
    });
  } catch (error: any) {
    console.error('❌ [ALLY] Error sending ally request:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to send alliance request' 
    });
  }
});

/**
 * Get incoming ally requests
 */
router.get('/ally-requests/incoming', sessionAuth, async (req, res) => {
  try {
    const user_handle = req.user?.userHandle;
    if (!user_handle) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const requests = await storage.getIncomingAllyRequests(user_handle);
    
    res.json({
      success: true,
      requests
    });
  } catch (error: any) {
    console.error('❌ [ALLY] Error fetching incoming requests:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch alliance requests' 
    });
  }
});

/**
 * Get outgoing ally requests
 */
router.get('/ally-requests/outgoing', sessionAuth, async (req, res) => {
  try {
    const user_handle = req.user?.userHandle;
    if (!user_handle) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const requests = await storage.getOutgoingAllyRequests(user_handle);
    
    res.json({
      success: true,
      requests
    });
  } catch (error: any) {
    console.error('❌ [ALLY] Error fetching outgoing requests:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch alliance requests' 
    });
  }
});

/**
 * Respond to an ally request (accept/decline)
 */
router.post('/ally-request/:requestId/respond', sessionAuth, async (req, res) => {
  try {
    const user_handle = req.user?.userHandle;
    const { requestId } = req.params;
    const { action } = req.body; // 'accept' or 'decline'
    
    if (!user_handle) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    if (!['accept', 'decline'].includes(action)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid action. Must be accept or decline' 
      });
    }

    const request = await storage.getAllyRequest(requestId);
    if (!request) {
      return res.status(404).json({ 
        success: false, 
        error: 'Alliance request not found' 
      });
    }

    if (request.receiver_handle !== user_handle) {
      return res.status(403).json({ 
        success: false, 
        error: 'You can only respond to requests sent to you' 
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ 
        success: false, 
        error: 'This request has already been responded to' 
      });
    }

    // Update request status
    await storage.updateAllyRequestStatus(requestId, action === 'accept' ? 'accepted' : 'declined');

    // If accepted, create the alliance
    if (action === 'accept') {
      await storage.createAlliance({
        player1_handle: request.sender_handle,
        player2_handle: user_handle,
        alliance_type: request.request_type || 'mutual_defense'
      });
    }

    console.log(`🤝 [ALLY] ${user_handle} ${action}ed alliance request from ${request.sender_handle}`);

    res.json({
      success: true,
      message: `Alliance request ${action}ed successfully`
    });
  } catch (error: any) {
    console.error('❌ [ALLY] Error responding to ally request:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to respond to alliance request' 
    });
  }
});

/**
 * Get current alliances
 */
router.get('/alliances', sessionAuth, async (req, res) => {
  try {
    const user_handle = req.user?.userHandle;
    if (!user_handle) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const alliances = await storage.getAlliances(user_handle);
    
    res.json({
      success: true,
      alliances
    });
  } catch (error: any) {
    console.error('❌ [ALLY] Error fetching alliances:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch alliances' 
    });
  }
});

/**
 * Break an alliance
 */
router.delete('/alliance/:allyHandle', sessionAuth, async (req, res) => {
  try {
    const user_handle = req.user?.userHandle;
    const { allyHandle } = req.params;
    
    if (!user_handle) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    await storage.removeAlliance(user_handle, allyHandle);

    console.log(`💔 [ALLY] ${user_handle} broke alliance with ${allyHandle}`);

    res.json({
      success: true,
      message: 'Alliance ended successfully'
    });
  } catch (error: any) {
    console.error('❌ [ALLY] Error ending alliance:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to end alliance' 
    });
  }
});

/**
 * Complete first-time wizard setup
 */
router.post('/complete-wizard', sessionAuth, async (req, res) => {
  try {
    const user_handle = req.user?.userHandle;
    if (!user_handle) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    // Mark wizard as completed in gaming players table
    await db
      .update(gamingPlayers)
      .set({ 
        first_time_setup_completed: true,
        wizard_completed_at: new Date(),
        updated_at: new Date()
      } as any)
      .where(eq(gamingPlayers.user_handle, user_handle));

    console.log(`🎉 [WIZARD] ${user_handle} completed first-time setup wizard`);

    res.json({
      success: true,
      message: 'First-time setup completed successfully'
    });
  } catch (error: any) {
    console.error('❌ [WIZARD] Error completing wizard:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to complete wizard setup' 
    });
  }
});

/**
 * Generate AI image for land plot and mint as NFT
 * Enhanced purchase flow with AI generation and blockchain minting
 */
router.post('/purchase-plot-with-nft', sessionAuth, async (req, res) => {
  try {
    const user_handle = req.user?.userHandle;
    const { plot_id, wallet_address, payment_amount_xrp } = req.body;
    
    if (!user_handle) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    console.log(`🎨 [NFT-MINT] ${user_handle} purchasing plot ${plot_id} with AI generation and NFT minting`);

    // Load land plot metadata
    const metadataPath = path.join(process.cwd(), 'server', 'public', 'nft-metadata', 'land-plots', `${plot_id}.json`);
    
    if (!fs.existsSync(metadataPath)) {
      return res.status(404).json({ success: false, error: 'Land plot metadata not found' });
    }

    const plotMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

    // ==== SERVER-SIDE PRICING VALIDATION ====
    // Calculate the correct price server-side to prevent manipulation
    const currentDate = new Date();
    const earlyBirdCutoff = new Date('2025-12-31T23:59:59Z'); // Early bird until end of 2025
    const isEarlyBird = currentDate <= earlyBirdCutoff;
    
    // Extract canonical pricing from server-side metadata
    const basePriceXRP = plotMetadata.properties?.base_price_xrp || 10; // Default fallback
    const sizeMultiplier = plotMetadata.properties?.size_multiplier || 1;
    const rarityMultiplier = plotMetadata.properties?.rarity_score ? (plotMetadata.properties.rarity_score / 100) : 1;
    
    // Calculate expected price with early bird discount
    let expectedPriceXRP = basePriceXRP * sizeMultiplier * rarityMultiplier;
    if (isEarlyBird) {
      expectedPriceXRP *= 0.8; // 20% early bird discount
    }
    expectedPriceXRP = Math.round(expectedPriceXRP * 100) / 100; // Round to 2 decimals
    
    // Validate client payment amount against expected price (allow 1% tolerance for rounding)
    const tolerance = expectedPriceXRP * 0.01;
    const clientPaymentXRP = parseFloat(payment_amount_xrp);
    
    if (Math.abs(clientPaymentXRP - expectedPriceXRP) > tolerance) {
      console.error(`🚨 [SECURITY] Price manipulation detected!`);
      console.error(`🚨 [SECURITY] Expected: ${expectedPriceXRP} XRP, Got: ${clientPaymentXRP} XRP`);
      console.error(`🚨 [SECURITY] User: ${user_handle}, Plot: ${plot_id}`);
      return res.status(400).json({ 
        success: false, 
        error: `Invalid payment amount. Expected: ${expectedPriceXRP} XRP (${isEarlyBird ? 'with early bird discount' : 'regular price'})`,
        expected_price: expectedPriceXRP,
        early_bird_active: isEarlyBird
      });
    }
    
    console.log(`✅ [PRICING] Valid payment: ${clientPaymentXRP} XRP (expected: ${expectedPriceXRP} XRP)`);
    
    // Generate AI image for the land plot
    console.log(`🎨 [AI-GEN] Generating AI image for plot #${plot_id}...`);
    const imageResult = await generateLandPlotImage(plotMetadata);

    if (!imageResult.success) {
      console.warn(`⚠️ [AI-GEN] Image generation failed for plot #${plot_id}: ${imageResult.error}`);
      // Continue with NFT minting even if image generation fails
    }

    // Convert validated XRP amount to drops for minting
    const paymentAmountDrops = (expectedPriceXRP * 1000000).toString(); // Use server-validated amount

    // Mint NFT on XRPL
    console.log(`🪙 [NFT-MINT] Minting land plot #${plot_id} as NFT...`);
    const mintResult = await mintLandPlotNFT({
      plotId: plot_id,
      buyerAddress: wallet_address,
      paymentAmount: paymentAmountDrops,
      imageGenerated: imageResult.success
    });

    if (!mintResult.success) {
      return res.status(500).json({ 
        success: false, 
        error: `NFT minting failed: ${mintResult.error}`,
        imageGenerated: imageResult.success,
        imageUrl: imageResult.imageUrl
      });
    }

    // Update gaming database with plot ownership
    await storage.recordLandPlotPurchase({
      user_handle,
      plot_id,
      plot_number: plot_id,
      terrain_type: plotMetadata.properties.terrain_type,
      coordinates: plotMetadata.properties.coordinates,
      xrp_price: plotMetadata.properties.xrp_price,
      nft_token_id: mintResult.tokenId,
      image_url: imageResult.imageUrl,
      purchased_at: new Date()
    });

    console.log(`✅ [NFT-MINT] Successfully minted land plot NFT: ${mintResult.tokenId}`);

    res.json({
      success: true,
      message: 'Land plot purchased and minted as NFT successfully',
      data: {
        plot_id,
        nft_token_id: mintResult.tokenId,
        offer_id: mintResult.offerId,
        image_url: imageResult.imageUrl,
        image_generated: imageResult.success,
        metadata_url: plotMetadata.external_url,
        xrp_price: plotMetadata.properties.xrp_price,
        terrain_type: plotMetadata.properties.terrain_type,
        coordinates: plotMetadata.properties.coordinates,
        resources: plotMetadata.properties.resources
      }
    });
  } catch (error: any) {
    console.error('❌ [NFT-MINT] Error purchasing plot with NFT:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to purchase plot and mint NFT' 
    });
  }
});

/**
 * Create generic NFT with optional AI generation
 * For other projects wanting to use the 1 XRP NFT creation service
 */
router.post('/create-generic-nft', sessionAuth, async (req, res) => {
  try {
    const user_handle = req.user?.userHandle;
    const { 
      project_name, 
      nft_name, 
      description, 
      attributes, 
      generate_ai_image = false,
      ai_prompt,
      image_url,
      buyer_address 
    } = req.body;

    if (!user_handle) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    console.log(`🎨 [GENERIC-NFT] ${user_handle} creating NFT for project: ${project_name}`);

    let finalImageUrl = image_url;

    // Generate AI image if requested
    if (generate_ai_image && ai_prompt) {
      console.log(`🎨 [AI-GEN] Generating AI image for generic NFT...`);
      
      try {
        const { generateAIImage } = await import('./openai-service');
  const { unifiedStorage } = await import('./unified-storage');
        const imageResult = await generateAIImage(ai_prompt);
        
        if (imageResult && imageResult.url) {
          // Download and upload to Object Storage (persistent)
          const response = await fetch(imageResult.url);
          const arrayBuffer = await response.arrayBuffer();
          const imageBuffer = Buffer.from(arrayBuffer);
          
          // Upload to unified storage
          finalImageUrl = await unifiedStorage.uploadFile(
            imageBuffer,
            'generated',
            'image/png'
          );
          
          console.log(`✅ [AI-GEN] Generated and saved AI image to Object Storage: ${finalImageUrl}`);
        }
      } catch (error: any) {
        console.warn(`⚠️ [AI-GEN] Image generation failed, proceeding without AI image: ${error?.message || error}`);
      }
    }

    // Create NFT metadata
    const metadata = {
      name: nft_name,
      description: description,
      image: finalImageUrl || `https://riddleswap.replit.app/api/placeholder/400/400?text=${encodeURIComponent(nft_name)}`,
      external_url: `https://riddleswap.replit.app/nft-gaming-dashboard`,
      attributes: attributes || [],
      properties: {
        project: project_name,
        created_by: user_handle,
        created_at: new Date().toISOString(),
        ai_generated: generate_ai_image && !!finalImageUrl
      }
    };

    // Mint generic NFT
    const mintResult = await mintGenericNFT({
      projectName: project_name,
      metadata,
      imageUrl: finalImageUrl,
      buyerAddress: buyer_address
    });

    if (!mintResult.success) {
      return res.status(500).json({ 
        success: false, 
        error: `NFT minting failed: ${mintResult.error}`,
        cost_xrp: mintResult.cost
      });
    }

    console.log(`✅ [GENERIC-NFT] Successfully minted generic NFT: ${mintResult.tokenId}`);

    res.json({
      success: true,
      message: 'Generic NFT created and minted successfully',
      data: {
        project_name,
        nft_token_id: mintResult.tokenId,
        cost_xrp: mintResult.cost,
        image_url: finalImageUrl,
        ai_generated: generate_ai_image && !!finalImageUrl,
        metadata
      }
    });
  } catch (error: any) {
    console.error('❌ [GENERIC-NFT] Error creating generic NFT:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create generic NFT',
      cost_xrp: 1
    });
  }
});

/**
 * Serve NFT metadata files
 */
router.get('/nft-metadata/:collection/:tokenId', (req, res) => {
  try {
    const { collection, tokenId } = req.params;
    
    const metadataPath = path.join(
      process.cwd(), 
      'server', 
      'public', 
      'nft-metadata', 
      collection, 
      `${tokenId}`
    );

    if (!fs.existsSync(metadataPath)) {
      return res.status(404).json({ error: 'Metadata not found' });
    }

    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    
    res.set({ 
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
     } as any);
    
    res.json(metadata);
  } catch (error) {
    console.error('❌ Error serving NFT metadata:', error);
    res.status(500).json({ error: 'Failed to load metadata' });
  }
});

/**
 * Serve NFT images
 */
router.get('/nft-images/:collection/:imageFile', (req, res) => {
  try {
    const { collection, imageFile } = req.params;
    
    const imagePath = path.join(
      process.cwd(), 
      'public', 
      'nft-images', 
      collection, 
      imageFile
    );

    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ error: 'Image not found' });
    }

    res.set({ 
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
     } as any);
    
    res.sendFile(imagePath);
  } catch (error) {
    console.error('❌ Error serving NFT image:', error);
    res.status(500).json({ error: 'Failed to load image' });
  }
});

/**
 * Get land plot NFT collection summary
 */
router.get('/land-plots-collection-info', (req, res) => {
  try {
    const summaryPath = path.join(
      process.cwd(), 
      'server', 
      'public', 
      'nft-metadata', 
      'land-plots', 
      '_collection_summary.json'
    );

    if (!fs.existsSync(summaryPath)) {
      return res.status(404).json({ error: 'Collection summary not found' });
    }

    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    
    res.set({ 
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600'
     } as any);
    
    res.json(summary);
  } catch (error) {
    console.error('❌ Error serving collection info:', error);
    res.status(500).json({ error: 'Failed to load collection info' });
  }
});

// =============================================
// LAND PLOT PAYMENT SYSTEM
// =============================================

// Payment method and pricing schema
const initiatePlotPurchaseSchema = z.object({
  plotId: z.string().min(1, "Plot ID is required"),
  paymentMethod: z.enum(['XRP', 'RDL'], {
    errorMap: () => ({ message: "Payment method must be 'XRP' or 'RDL'" })
  }),
  bankWalletAddress: z.string().min(1, "Bank wallet address is required")
});

// Bank wallet configuration (to be moved to environment variables)
const BANK_WALLET_CONFIG = {
  address: "rGDJxq11nj6gstTrUKND3NtAaLtSUGqvDY", // Default to RiddleNFTBroker address
  name: "RiddleSwap Land Plot Treasury"
};

/**
 * Get plot pricing options - returns both XRP and RDL prices with discount
 */
router.get('/land-plots/:plotId/pricing', sessionAuth, async (req, res) => {
  try {
    const { plotId } = req.params;
    
    // Get plot details from database
    const plot = await db.select()
      .from(medievalLandPlots)
      .where(eq(medievalLandPlots.id, plotId))
      .limit(1);
    
    if (!plot || plot.length === 0) {
      return res.status(404).json({ 
        error: 'Plot not found',
        code: 'PLOT_NOT_FOUND'
      });
    }
    
    const plotData = plot[0];
    
    // Check if plot is available for purchase
    if (plotData.status !== 'available') {
      return res.status(400).json({
        error: 'Plot is not available for purchase',
        code: 'PLOT_UNAVAILABLE',
        status: plotData.status
      });
    }
    
    // Calculate pricing options
    const xrpPrice = Number(plotData.currentPrice);
    const rdlDiscountPercent = plotData.rdlDiscountPercent || 50;
    const rdlPrice = xrpPrice * (1 - rdlDiscountPercent / 100);
    
    const pricing = {
      plotId: plotData.id,
      plotNumber: plotData.plotNumber,
      terrainType: plotData.terrainType,
      plotSize: plotData.plotSize,
      options: {
        XRP: {
          price: xrpPrice,
          currency: 'XRP',
          description: 'Pay with XRP - Standard pricing'
        },
        RDL: {
          price: rdlPrice,
          currency: 'RDL',
          originalPrice: xrpPrice,
          discount: rdlDiscountPercent,
          savings: xrpPrice - rdlPrice,
          description: `Pay with RDL - ${rdlDiscountPercent}% discount!`
        }
      },
      bankWallet: BANK_WALLET_CONFIG
    };
    
    res.json({
      success: true,
      pricing
    });
    
  } catch (error) {
    console.error('❌ Error getting plot pricing:', error);
    res.status(500).json({ 
      error: 'Failed to get plot pricing',
      code: 'PRICING_ERROR'
    });
  }
});

/**
 * Initiate plot purchase - creates payment transaction record
 */
router.post('/land-plots/purchase/initiate', sessionAuth, async (req, res) => {
  try {
    const validation = initiatePlotPurchaseSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validation.error.format(),
        code: 'VALIDATION_ERROR'
      });
    }
    
    const { plotId, paymentMethod, bankWalletAddress } = validation.data;
    const userHandle = req.user?.handle || (req.session as any)?.handle;
    const userAddress = req.user?.walletAddress || (req.session as any)?.walletAddress;
    
    if (!userHandle || !userAddress) {
      return res.status(401).json({
        error: 'User authentication required',
        code: 'AUTH_REQUIRED'
      });
    }
    
    // Get plot details
    const plot = await db.select()
      .from(medievalLandPlots)
      .where(eq(medievalLandPlots.id, plotId))
      .limit(1);
    
    if (!plot || plot.length === 0) {
      return res.status(404).json({
        error: 'Plot not found',
        code: 'PLOT_NOT_FOUND'
      });
    }
    
    const plotData = plot[0];
    
    // Verify plot availability
    if (plotData.status !== 'available') {
      return res.status(400).json({
        error: 'Plot is not available for purchase',
        code: 'PLOT_UNAVAILABLE',
        status: plotData.status
      });
    }
    
    // Calculate payment amount based on method
    const xrpPrice = Number(plotData.currentPrice);
    let paymentAmount: number;
    let rdlDiscountApplied = false;
    let discountPercent = 0;
    
    if (paymentMethod === 'RDL') {
      discountPercent = plotData.rdlDiscountPercent || 50;
      paymentAmount = xrpPrice * (1 - discountPercent / 100);
      rdlDiscountApplied = true;
    } else {
      paymentAmount = xrpPrice;
    }
    
    // Create purchase transaction record
    try {
      const purchaseRecord = await db.insert(landPlotPurchases).values({
        plotId: plotData.id,
        buyerHandle: userHandle,
        buyerAddress: userAddress,
        paymentMethod,
        paidAmount: paymentAmount.toString(),
        originalXrpPrice: xrpPrice.toString(),
        rdlDiscountApplied,
        discountPercent,
        bankWalletAddress,
        status: 'pending',
        transactionData: {
          plotNumber: plotData.plotNumber,
          terrainType: plotData.terrainType,
          plotSize: plotData.plotSize,
          initiatedAt: new Date().toISOString()
        }
      } as any).returning();
      
      // Reserve the plot temporarily
      await db.update(medievalLandPlots)
        .set({ 
          status: 'reserved',
          updatedAt: new Date()
        } as any)
        .where(eq(medievalLandPlots.id, plotId));
      
      res.json({
        success: true,
        purchase: {
          id: purchaseRecord[0].id,
          plotId: plotData.id,
          plotNumber: plotData.plotNumber,
          paymentMethod,
          amount: paymentAmount,
          currency: paymentMethod,
          bankWallet: {
            address: bankWalletAddress,
            name: BANK_WALLET_CONFIG.name
          },
          discount: rdlDiscountApplied ? {
            applied: true,
            percent: discountPercent,
            savings: xrpPrice - paymentAmount
          } : null,
          instructions: {
            message: `Send exactly ${paymentAmount} ${paymentMethod} to complete your land plot purchase`,
            destinationTag: `PLOT${plotData.plotNumber}`,
            memo: `Plot Purchase - ${userHandle}`
          }
        }
      });
      
    } catch (dbError) {
      console.error('❌ Database error creating purchase record:', dbError);
      
      // Check if it's a table doesn't exist error and create it
      if (dbError.message?.includes('relation "land_plot_purchases" does not exist')) {
        // Table doesn't exist yet, create it with SQL
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS land_plot_purchases (
            id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
            plot_id TEXT NOT NULL REFERENCES medieval_land_plots(id) ON DELETE CASCADE,
            buyer_handle TEXT NOT NULL,
            buyer_address TEXT NOT NULL,
            buyer_wallet_id TEXT,
            payment_method TEXT NOT NULL,
            paid_amount DECIMAL(20,8) NOT NULL,
            original_xrp_price DECIMAL(20,8) NOT NULL,
            rdl_discount_applied BOOLEAN DEFAULT false,
            discount_percent INTEGER DEFAULT 0,
            bank_wallet_address TEXT NOT NULL,
            treasury_transaction_hash TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            payment_verified BOOLEAN DEFAULT false,
            ownership_transferred BOOLEAN DEFAULT false,
            transaction_data JSONB DEFAULT '{}',
            verification_attempts INTEGER DEFAULT 0,
            last_verification_attempt TIMESTAMP,
            purchase_initiated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            payment_received TIMESTAMP,
            ownership_transferred_at TIMESTAMP,
            completed_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        
        // Create indexes
        await db.execute(sql`
          CREATE INDEX IF NOT EXISTS idx_land_purchases_plot ON land_plot_purchases(plot_id);
          CREATE INDEX IF NOT EXISTS idx_land_purchases_buyer ON land_plot_purchases(buyer_handle);
          CREATE INDEX IF NOT EXISTS idx_land_purchases_status ON land_plot_purchases(status);
          CREATE INDEX IF NOT EXISTS idx_land_purchases_method ON land_plot_purchases(payment_method);
          CREATE INDEX IF NOT EXISTS idx_land_purchases_bank ON land_plot_purchases(bank_wallet_address);
          CREATE INDEX IF NOT EXISTS idx_land_purchases_created ON land_plot_purchases(created_at);
        `);
        
        // Now retry the insert with raw SQL
        const insertResult = await db.execute(sql`
          INSERT INTO land_plot_purchases (
            plot_id, buyer_handle, buyer_address, payment_method,
            paid_amount, original_xrp_price, rdl_discount_applied,
            discount_percent, bank_wallet_address, transaction_data
          ) VALUES (
            ${plotData.id}, ${userHandle}, ${userAddress}, ${paymentMethod},
            ${paymentAmount.toString()}, ${xrpPrice.toString()}, ${rdlDiscountApplied},
            ${discountPercent}, ${bankWalletAddress}, ${JSON.stringify({
              plotNumber: plotData.plotNumber,
              terrainType: plotData.terrainType,
              plotSize: plotData.plotSize,
              initiatedAt: new Date().toISOString()
            })}
          ) RETURNING id
        `);
        
        const purchaseId = insertResult.rows[0]?.id;
        
        res.json({
          success: true,
          purchase: {
            id: purchaseId,
            plotId: plotData.id,
            plotNumber: plotData.plotNumber,
            paymentMethod,
            amount: paymentAmount,
            currency: paymentMethod,
            bankWallet: {
              address: bankWalletAddress,
              name: BANK_WALLET_CONFIG.name
            },
            discount: rdlDiscountApplied ? {
              applied: true,
              percent: discountPercent,
              savings: xrpPrice - paymentAmount
            } : null,
            instructions: {
              message: `Send exactly ${paymentAmount} ${paymentMethod} to complete your land plot purchase`,
              destinationTag: `PLOT${plotData.plotNumber}`,
              memo: `Plot Purchase - ${userHandle}`
            }
          }
        });
      } else {
        throw dbError;
      }
    }
    
  } catch (error) {
    console.error('❌ Error initiating plot purchase:', error);
    res.status(500).json({
      error: 'Failed to initiate purchase',
      code: 'PURCHASE_INITIATION_ERROR'
    });
  }
});

/**
 * Verify payment and transfer ownership with automatic bank payment routing
 */
router.post('/land-plots/purchase/:purchaseId/verify', sessionAuth, async (req, res) => {
  try {
    const { purchaseId } = req.params;
    const { transactionHash, password } = req.body;
    const userHandle = req.user?.userHandle;
    
    if (!userHandle) {
      return res.status(401).json({
        error: 'User authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    if (!password) {
      return res.status(400).json({
        error: 'Password required for payment authorization',
        code: 'PASSWORD_REQUIRED'
      });
    }
    
    // Get purchase record
    const purchase = await db.execute(sql`
      SELECT * FROM land_plot_purchases WHERE id = ${purchaseId} AND buyer_handle = ${userHandle}
    `);
    
    if (!purchase.rows || purchase.rows.length === 0) {
      return res.status(404).json({
        error: 'Purchase record not found',
        code: 'PURCHASE_NOT_FOUND'
      });
    }
    
    const purchaseData = purchase.rows[0];
    
    if (purchaseData.status === 'completed') {
      return res.status(400).json({
        error: 'Purchase already completed',
        code: 'ALREADY_COMPLETED'
      });
    }

    // Bank wallet address for automatic payment routing
    const BANK_WALLET = "rsFbZ33Zr3BCVyiVPw8pFvbtnrG1i8FwA3"; // RiddleSwap bank wallet
    const RDL_ISSUER = "rEVrTKUKSLx5nxdfV8SAFTxS9FGFrfHRLo"; // RDL token issuer
    
    console.log(`🏦 [BANK PAYMENT] Auto-routing payment to bank wallet for Plot #${purchaseData.plot_number}`);
    
    // Step 1: Automatically route payment to bank wallet using logged-in private key
    let bankPaymentResult;
    const paymentAmount = (purchaseData as any).paid_amount.toString();
    const paymentCurrency = (purchaseData as any).payment_method;
    const destinationTag = parseInt((purchaseData as any).destination_tag as string);
    
    try {
      if (paymentCurrency === 'RDL') {
        // Send RDL token payment to bank wallet
        bankPaymentResult = await sendXrplPayment(
          userHandle,
          password,
          BANK_WALLET,
          paymentAmount,
          'RDL',
          RDL_ISSUER,
          destinationTag,
          false, // usePartialPayment
          0.02   // 2% slippage for token payments
        );
      } else {
        // Send XRP payment to bank wallet
        bankPaymentResult = await sendXrplPayment(
          userHandle,
          password,
          BANK_WALLET,
          paymentAmount,
          'XRP',
          undefined,
          destinationTag,
          false, // usePartialPayment
          0.01   // 1% slippage for XRP payments
        );
      }
      
      if (!bankPaymentResult.success) {
        throw new Error(`Bank payment failed: ${bankPaymentResult.error}`);
      }
      
      console.log(`✅ [BANK PAYMENT] Successfully routed ${paymentAmount} ${paymentCurrency} to bank wallet`);
      console.log(`💳 [BANK PAYMENT] Transaction Hash: ${bankPaymentResult.txHash}`);
      
    } catch (paymentError) {
      console.error('❌ [BANK PAYMENT] Failed to route payment to bank wallet:', paymentError);
      return res.status(500).json({
        error: 'Failed to process payment to bank wallet',
        code: 'BANK_PAYMENT_FAILED',
        details: paymentError.message
      });
    }

    // Step 2: Generate AI image for the land plot
    let aiImageUrl;
    try {
      console.log(`🎨 [AI IMAGE] Generating land plot image for Plot #${(purchaseData as any).plot_number}`);
      const plotCoordinates = JSON.parse((purchaseData as any).coordinates || '{"x": 0, "y": 0}');
      aiImageUrl = await generateLandPlotImage((purchaseData as any).plot_number);
      console.log(`✅ [AI IMAGE] Generated image: ${aiImageUrl}`);
    } catch (imageError: any) {
      console.warn('⚠️ [AI IMAGE] Failed to generate image, continuing without:', imageError.message);
      aiImageUrl = null;
    }

    // Step 3: Update NFT metadata with founding riddle wallets
    try {
      console.log(`📝 [METADATA] Updating metadata for Plot #${(purchaseData as any).plot_number}`);
      const metadata = addFoundingRiddleWallets(
        (purchaseData as any).plot_number as number, 
        (purchaseData as any).buyer_address
      );
      
      // Update metadata with AI image if generated
      if (aiImageUrl) {
        const metadataUpdates = { image: aiImageUrl };
        updateLandPlotMetadata((purchaseData as any).plot_number as number, metadataUpdates);
      }
      
      console.log(`✅ [METADATA] Updated metadata with founding wallets and image`);
    } catch (metadataError) {
      console.warn('⚠️ [METADATA] Failed to update metadata, continuing:', metadataError.message);
    }
    
    // Step 4: Update purchase record with bank payment details
    await db.execute(sql`
      UPDATE land_plot_purchases 
      SET 
        treasury_transaction_hash = ${bankPaymentResult.txHash},
        bank_payment_hash = ${bankPaymentResult.txHash},
        bank_wallet_address = ${BANK_WALLET},
        ai_image_url = ${aiImageUrl},
        status = 'processing',
        payment_received = CURRENT_TIMESTAMP,
        bank_payment_completed = CURRENT_TIMESTAMP,
        verification_attempts = verification_attempts + 1,
        last_verification_attempt = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${purchaseId}
    `);
    
    // Step 5: Transfer ownership to buyer
    await db.update(medievalLandPlots)
      .set({
        ownerId: null, // Will link to player ID when available
        ownerHandle: userHandle,
        ownerAddress: (purchaseData as any).buyer_address,
        status: 'owned',
        purchasePrice: (purchaseData as any).paid_amount,
        purchaseCurrency: (purchaseData as any).payment_method,
        purchaseDate: new Date(),
        purchaseTransaction: bankPaymentResult.txHash,
        imageUrl: aiImageUrl,
        updatedAt: new Date()
      } as any)
      .where(eq(medievalLandPlots.id, (purchaseData as any).plot_id as string));
    
    // Step 6: Complete the purchase
    await db.execute(sql`
      UPDATE land_plot_purchases 
      SET 
        status = 'completed',
        payment_verified = true,
        ownership_transferred = true,
        ownership_transferred_at = CURRENT_TIMESTAMP,
        completed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${purchaseId}
    `);
    
    res.json({
      success: true,
      message: 'Payment routed to bank wallet and plot ownership transferred successfully!',
      purchase: {
        id: purchaseId,
        status: 'completed',
        bankTransactionHash: bankPaymentResult.txHash,
        bankWallet: BANK_WALLET,
        aiImageGenerated: !!aiImageUrl,
        aiImageUrl,
        transferredAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Error verifying payment:', error);
    res.status(500).json({
      error: 'Failed to verify payment',
      code: 'VERIFICATION_ERROR'
    });
  }
});

/**
 * Get user's purchase history
 */
router.get('/land-plots/my-purchases', sessionAuth, async (req, res) => {
  try {
    const userHandle = req.user?.userHandle;
    
    if (!userHandle) {
      return res.status(401).json({
        error: 'User authentication required',
        code: 'AUTH_REQUIRED'
      });
    }
    
    // Get user's purchase history
    const purchases = await db.execute(sql`
      SELECT 
        lpp.*,
        mlp.plot_number,
        mlp.terrain_type,
        mlp.plot_size,
        mlp.latitude,
        mlp.longitude
      FROM land_plot_purchases lpp
      LEFT JOIN medieval_land_plots mlp ON lpp.plot_id = mlp.id
      WHERE lpp.buyer_handle = ${userHandle}
      ORDER BY lpp.created_at DESC
    `);
    
    res.json({
      success: true,
      purchases: purchases.rows || []
    });
    
  } catch (error) {
    console.error('❌ Error fetching purchase history:', error);
    
    // If table doesn't exist, return empty array
    if (error.message?.includes('relation "land_plot_purchases" does not exist')) {
      return res.json({
        success: true,
        purchases: []
      });
    }
    
    res.status(500).json({
      error: 'Failed to fetch purchase history',
      code: 'FETCH_ERROR'
    });
  }
});

/**
 * Purchase weapon with simple payment to bank wallet - auto-mint NFT
 * Simple payment flow: XRP/RDL to bank wallet → automatic weapon NFT minting
 */
router.post("/purchase-weapon", sessionAuth, async (req, res) => {
  try {
    const userHandle = req.user?.userHandle;
    if (!userHandle) {
      return res.status(401).json({
        error: 'User authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const { listing_id } = req.body;

    if (!listing_id) {
      return res.status(400).json({
        error: 'Missing required field: listing_id',
        code: 'MISSING_FIELDS'
      });
    }

    // SECURITY: Validate listing server-side - NEVER trust client-supplied price
    console.log(`🗡️ [WEAPON PURCHASE] ${userHandle} requesting purchase of listing ${listing_id}`);
    
    const listingResult = await db.execute(sql`
      SELECT 
        wm.*,
        wd.name as weapon_name,
        wd.weapon_type,
        wd.rarity,
        wd.category
      FROM weapon_marketplace wm
      LEFT JOIN weapon_definitions wd ON wm.weapon_id = wd.id
      WHERE wm.id = ${listing_id} 
        AND wm.status = 'active'
        AND wm.expires_at > NOW()
    `);

    const listingRows = (listingResult.rows || listingResult) as any[];
    if (!listingRows || listingRows.length === 0) {
      return res.status(404).json({
        error: 'Weapon listing not found or expired',
        code: 'LISTING_NOT_FOUND'
      });
    }

    const listing = listingResult.rows[0];
    const authoritative_price = listing.price_drops; // Use server-side price
    const weapon_name = listing.weapon_name;
    const weapon_type = listing.weapon_type;
    const rarity = listing.rarity;

    console.log(`🗡️ [WEAPON PURCHASE] ${userHandle} purchasing ${weapon_name} for ${authoritative_price} XRP (server-verified price)`);

    // Bank wallet for payments - same as land plots
    const BANK_WALLET = "rsFbZ33Zr3BCVyiVPw8pFvbtnrG1i8FwA3";

    // Get password from request body
    const password = req.body.password;
    if (!password) {
      return res.status(400).json({
        error: 'Password required for transaction signing',
        code: 'PASSWORD_REQUIRED'
      });
    }

    // Step 1: Process payment to bank wallet using server-verified price
    console.log(`🏦 [WEAPON PAYMENT] Auto-routing ${authoritative_price} XRP to bank wallet (server-verified)`);
    
    const bankPaymentResult = await sendXrplPayment(
      userHandle,
      password,
      BANK_WALLET,
      authoritative_price.toString(),
      'XRP',
      undefined, // no issuer for XRP
      undefined, // no destination tag
      false, // not partial payment
      0.05 // 5% slippage protection
    );

    if (!bankPaymentResult.success) {
      console.error('❌ [WEAPON PAYMENT] Failed to process payment to bank wallet:', bankPaymentResult.error);
      return res.status(500).json({
        error: 'Failed to process payment to bank wallet',
        code: 'PAYMENT_FAILED',
        details: bankPaymentResult.error
      });
    }

    console.log(`✅ [WEAPON PAYMENT] Payment successful: ${bankPaymentResult.txHash}`);

    // Step 2: Queue weapon NFT minting
    console.log(`🎨 [WEAPON MINT] Queuing NFT mint for ${weapon_name}`);
    
    // Import weapon minting service
    const { nftWeaponMintingService } = await import('./nft-weapon-minting-service');
    
    const mintRequest: any = {
      playerHandle: userHandle,
      weaponType: String(weapon_type).toLowerCase(),
      rarity: rarity || 'common',
      customName: weapon_name,
      techLevel: 'standard',
      purchasePrice: authoritative_price,
      purchaseTransaction: bankPaymentResult.txHash,
      listingId: listing_id, // For idempotency tracking
      color: 'default' // Add required field
    };

    const mintQueueId = await nftWeaponMintingService.queueWeaponMint(mintRequest);
    console.log(`✅ [WEAPON MINT] Queued for minting: ${mintQueueId}`);

    res.json({
      success: true,
      message: `Payment processed! ${weapon_name} is being minted to your wallet.`,
      txHash: bankPaymentResult.txHash,
      bankWallet: BANK_WALLET,
      mintQueueId: mintQueueId,
      weapon: {
        name: weapon_name,
        type: weapon_type,
        rarity: rarity,
        price: authoritative_price
      },
      listing: {
        id: listing_id,
        verified_price: authoritative_price
      }
    });

  } catch (error) {
    console.error("🗡️ [WEAPON PURCHASE] Failed:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process weapon purchase",
      code: 'PURCHASE_FAILED'
    });
  }
});

/**
 * Get weapon definitions for marketplace
 */
router.get('/weapons/definitions', async (req, res) => {
  try {
    console.log('🗡️ [Weapons] Getting weapon definitions for marketplace');
    
    // Get all active weapon definitions
    const weaponDefs = await db.execute(sql`
      SELECT * FROM weapon_definitions 
      WHERE is_active = true 
      ORDER BY category, weapon_type, rarity, current_supply ASC
    `);
    
    const definitionsArray = (weaponDefs.rows || weaponDefs) as any[];
    
    res.json({
      success: true,
      total: definitionsArray.length,
      weapons: definitionsArray.map((weapon: any) => ({
        id: weapon.id,
        name: weapon.name,
        category: weapon.category,
        weaponType: weapon.weapon_type,
        rarity: weapon.rarity,
        description: weapon.description,
        baseImageUrl: weapon.base_image_url,
        baseDamage: weapon.base_damage,
        baseDefense: weapon.base_defense,
        baseSpeed: weapon.base_speed,
        baseDurability: weapon.base_durability,
        maxSupply: weapon.max_supply,
        currentSupply: weapon.current_supply,
        isActive: weapon.is_active,
        techLevels: weapon.tech_levels
      }))
    });
    
  } catch (error) {
    console.error('❌ Error fetching weapon definitions:', error);
    
    // If table doesn't exist, return mock weapon data
    if (error.message?.includes('relation "weapon_definitions" does not exist')) {
      console.log('🗡️ [Weapons] Table not found, returning mock weapon data');
      
      const mockWeapons = [
        {
          id: 'weapon_1',
          name: 'Iron Sword',
          category: 'weapon',
          weaponType: 'sword',
          rarity: 'common',
          description: 'A sturdy iron sword forged in the fires of battle',
          baseImageUrl: '/images/weapons/iron-sword.png',
          baseDamage: 25,
          baseDefense: 5,
          baseSpeed: 15,
          baseDurability: 100,
          maxSupply: 1000,
          currentSupply: 350,
          isActive: true,
          techLevels: ['medieval', 'advanced']
        },
        {
          id: 'weapon_2',
          name: 'Elven Bow',
          category: 'weapon',
          weaponType: 'bow',
          rarity: 'rare',
          description: 'An enchanted bow crafted by master elven artisans',
          baseImageUrl: '/images/weapons/elven-bow.png',
          baseDamage: 30,
          baseDefense: 2,
          baseSpeed: 25,
          baseDurability: 150,
          maxSupply: 500,
          currentSupply: 125,
          isActive: true,
          techLevels: ['magical', 'advanced']
        },
        {
          id: 'weapon_3',
          name: 'Dragon Scale Armor',
          category: 'armor',
          weaponType: 'armor',
          rarity: 'legendary',
          description: 'Legendary armor forged from ancient dragon scales',
          baseImageUrl: '/images/weapons/dragon-armor.png',
          baseDamage: 0,
          baseDefense: 50,
          baseSpeed: -5,
          baseDurability: 300,
          maxSupply: 100,
          currentSupply: 25,
          isActive: true,
          techLevels: ['magical', 'legendary']
        },
        {
          id: 'weapon_4',
          name: 'Steel Axe',
          category: 'weapon',
          weaponType: 'axe',
          rarity: 'common',
          description: 'A powerful steel axe capable of cleaving through enemies',
          baseImageUrl: '/images/weapons/steel-axe.png',
          baseDamage: 35,
          baseDefense: 8,
          baseSpeed: 10,
          baseDurability: 120,
          maxSupply: 800,
          currentSupply: 275,
          isActive: true,
          techLevels: ['medieval', 'advanced']
        },
        {
          id: 'weapon_5',
          name: 'Mystic Staff',
          category: 'weapon',
          weaponType: 'staff',
          rarity: 'epic',
          description: 'A magical staff imbued with ancient mystical powers',
          baseImageUrl: '/images/weapons/mystic-staff.png',
          baseDamage: 40,
          baseDefense: 15,
          baseSpeed: 20,
          baseDurability: 200,
          maxSupply: 200,
          currentSupply: 50,
          isActive: true,
          techLevels: ['magical', 'futuristic']
        }
      ];
      
      return res.json({
        success: true,
        total: mockWeapons.length,
        weapons: mockWeapons
      });
    }
    
    res.status(500).json({
      error: 'Failed to fetch weapon definitions',
      code: 'FETCH_ERROR'
    });
  }
});

/**
 * Get weapon marketplace listings
 */
router.get('/weapons/marketplace', async (req, res) => {
  try {
    console.log('🗡️ [Weapons] Getting marketplace weapon listings');
    
    // Get active weapon marketplace listings
    const listings = await db.execute(sql`
      SELECT 
        wm.*,
        wd.name,
        wd.category,
        wd.weapon_type,
        wd.rarity,
        wd.description,
        wd.base_image_url,
        wd.base_damage,
        wd.base_defense,
        pnw.image_url as weapon_image,
        pnw.tech_level,
        pnw.color_scheme
      FROM weapon_marketplace wm
      JOIN player_nft_weapons pnw ON wm.weapon_id = pnw.id
      JOIN weapon_definitions wd ON pnw.weapon_definition_id = wd.id
      WHERE wm.status = 'active' AND wm.expires_at > CURRENT_TIMESTAMP
      ORDER BY wm.created_at DESC
    `);
    
    const marketplaceListings = (listings.rows || listings) as any[];
    
    res.json({
      success: true,
      total: marketplaceListings.length,
      listings: marketplaceListings.map((listing: any) => ({
        id: listing.id,
        weaponId: listing.weapon_id,
        sellerId: listing.seller_id,
        priceDrops: listing.price_drops,
        originalPrice: listing.original_price,
        status: listing.status,
        expiresAt: listing.expires_at,
        weapon: {
          name: listing.name,
          category: listing.category,
          weaponType: listing.weapon_type,
          rarity: listing.rarity,
          description: listing.description,
          imageUrl: listing.weapon_image || listing.base_image_url,
          techLevel: listing.tech_level,
          colorScheme: listing.color_scheme,
          baseDamage: listing.base_damage,
          baseDefense: listing.base_defense
        }
      }))
    });
    
  } catch (error) {
    console.error('❌ Error fetching weapon marketplace:', error);
    
    // If table doesn't exist, return mock marketplace data
    if (error.message?.includes('does not exist')) {
      console.log('🗡️ [Weapons] Marketplace table not found, returning mock data');
      
      const mockListings = [
        {
          id: 'listing_1',
          weaponId: 'weapon_1',
          sellerId: 'player_123',
          priceDrops: 50,
          originalPrice: 75,
          status: 'active',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          weapon: {
            name: 'Iron Sword +1',
            category: 'weapon',
            weaponType: 'sword',
            rarity: 'common',
            description: 'An enhanced iron sword with +1 attack bonus',
            imageUrl: '/images/weapons/iron-sword-enhanced.png',
            techLevel: 'medieval',
            colorScheme: 'steel',
            baseDamage: 28,
            baseDefense: 5
          }
        },
        {
          id: 'listing_2',
          weaponId: 'weapon_2',
          sellerId: 'player_456',
          priceDrops: 150,
          originalPrice: 200,
          status: 'active',
          expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          weapon: {
            name: 'Enchanted Elven Bow',
            category: 'weapon',
            weaponType: 'bow',
            rarity: 'rare',
            description: 'A mystical bow with enhanced accuracy and range',
            imageUrl: '/images/weapons/elven-bow-enchanted.png',
            techLevel: 'magical',
            colorScheme: 'mithril',
            baseDamage: 35,
            baseDefense: 2
          }
        }
      ];
      
      return res.json({
        success: true,
        total: mockListings.length,
        listings: mockListings
      });
    }
    
    res.status(500).json({
      error: 'Failed to fetch weapon marketplace',
      code: 'FETCH_ERROR'
    });
  }
});

export default router;