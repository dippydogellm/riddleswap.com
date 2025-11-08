/**
 * Collection Theme Scanner Routes
 * API endpoints for managing themed NFT collections
 */

import { Router, Request, Response } from "express";
import { 
  scanAllThemedCollections, 
  scanThemedCollection,
  registerThemedCollection,
  THEMED_COLLECTIONS 
} from "./collection-theme-scanner";
import { db } from "./db";
import { gamingNftCollections, gamingNfts, nftPowerAttributes } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

const router = Router();

/**
 * GET /api/collections/themed
 * Get list of themed collections
 */
router.get("/themed", async (req: Request, res: Response) => {
  try {
    const collections = THEMED_COLLECTIONS.map(c => ({
      name: c.name,
      issuer: c.issuer,
      theme: c.theme,
      powerBoost: c.powerBoost,
      keywords: c.keywords
    }));

    res.json({
      success: true,
      collections,
      count: collections.length
    });
  } catch (error: any) {
    console.error("Error getting themed collections:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/collections/themed/register
 * Register a new themed collection
 */
router.post("/themed/register", async (req: Request, res: Response) => {
  try {
    const { issuer, name, theme, taxon } = req.body;

    if (!issuer || !name || !theme) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: issuer, name, theme"
      });
    }

    if (!['banker', 'weapon', 'sacred', 'gods'].includes(theme)) {
      return res.status(400).json({
        success: false,
        error: "Invalid theme. Must be: banker, weapon, sacred, or gods"
      });
    }

    const collectionId = await registerThemedCollection(issuer, name, theme, taxon);

    res.json({
      success: true,
      message: `Registered ${name} collection`,
      collectionId,
      theme
    });
  } catch (error: any) {
    console.error("Error registering themed collection:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/collections/themed/scan-all
 * Scan all themed collections and apply power bonuses
 */
router.post("/themed/scan-all", async (req: Request, res: Response) => {
  try {
    console.log("🚀 Starting themed collection scan...");
    
    const results = await scanAllThemedCollections();

    res.json({
      success: true,
      message: "Themed collection scan complete",
      ...results
    });
  } catch (error: any) {
    console.error("Error scanning themed collections:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/collections/themed/stats
 * Get statistics for themed collections
 */
router.get("/themed/stats", async (req: Request, res: Response) => {
  try {
    const stats = [];

    for (const theme of THEMED_COLLECTIONS) {
      // Find collection
      const collection = await db.query.gamingNftCollections.findFirst({
        where: eq(gamingNftCollections.collection_id, theme.issuer)
      });

      if (!collection) {
        stats.push({
          name: theme.name,
          theme: theme.theme,
          registered: false,
          nft_count: 0,
          total_power: 0
        });
        continue;
      }

      // Count NFTs
      const nftCount = await db.select({ count: sql<number>`count(*)` })
        .from(gamingNfts)
        .where(eq(gamingNfts.collection_id, collection.id));

      // Sum power
      const powerSum = await db.select({ 
        total: sql<number>`COALESCE(SUM(total_power), 0)` 
      })
        .from(nftPowerAttributes)
        .where(eq(nftPowerAttributes.collection_id, collection.id));

      stats.push({
        name: theme.name,
        theme: theme.theme,
        registered: true,
        collection_id: collection.id,
        nft_count: Number(nftCount[0]?.count || 0),
        total_power: Number(powerSum[0]?.total || 0),
        power_boost: theme.powerBoost
      });
    }

    res.json({
      success: true,
      stats,
      total_collections: stats.length,
      registered_collections: stats.filter(s => s.registered).length
    });
  } catch (error: any) {
    console.error("Error getting themed collection stats:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/collections/themed/verify/:collectionSlug
 * Verify collection traits and power allocation
 */
router.get("/themed/verify/:collectionSlug", async (req: Request, res: Response) => {
  try {
    const { collectionSlug } = req.params;
    
    // Map slug to theme
    const themeMap: Record<string, string> = {
      'under-the-bridge-riddle': 'Under the Bridge',
      'the-lost-emporium': 'The Lost Emporium',
      'dantesaurum': 'Dantes Aurum',
      'the-inquiry': 'The Inquiry'
    };

    const collectionName = themeMap[collectionSlug];
    if (!collectionName) {
      return res.status(404).json({
        success: false,
        error: "Unknown collection slug"
      });
    }

    const theme = THEMED_COLLECTIONS.find(c => c.name === collectionName);
    if (!theme) {
      return res.status(404).json({
        success: false,
        error: "Theme configuration not found"
      });
    }

    // Find collection in database
    const collection = await db.query.gamingNftCollections.findFirst({
      where: eq(gamingNftCollections.collection_id, theme.issuer)
    });

    if (!collection) {
      return res.json({
        success: true,
        collection_name: collectionName,
        registered: false,
        message: `Collection not registered. Use POST /api/collections/themed/register to add it.`,
        xrp_cafe_url: `https://xrp.cafe/collection/${collectionSlug}`,
        theme: theme.theme,
        suggested_issuer: theme.issuer
      });
    }

    // Get NFTs and power stats
    const nfts = await db.query.gamingNfts.findMany({
      where: eq(gamingNfts.collection_id, collection.id),
      limit: 10
    });

    const powerAttrs = await db.query.nftPowerAttributes.findMany({
      where: eq(nftPowerAttributes.collection_id, collection.id),
      limit: 10
    });

    res.json({
      success: true,
      collection_name: collectionName,
      registered: true,
      collection_id: collection.id,
      theme: theme.theme,
      power_boost: theme.powerBoost,
      nft_count: nfts.length,
      power_records: powerAttrs.length,
      sample_nfts: nfts.map(n => ({
        name: n.name,
        token_id: n.token_id,
        traits: n.traits
      })),
      sample_power: powerAttrs.map(p => ({
        nft_id: p.nft_id,
        army: p.army_power,
        religion: p.religion_power,
        civilization: p.civilization_power,
        economic: p.economic_power,
        total: p.total_power,
        character_class: p.character_class
      })),
      xrp_cafe_url: `https://xrp.cafe/collection/${collectionSlug}`
    });
  } catch (error: any) {
    console.error("Error verifying collection:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
