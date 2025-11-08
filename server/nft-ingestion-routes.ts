/**
 * NFT Ingestion Routes
 * API endpoints for ingesting NFT data from Bithomp
 */

import { Router, Request, Response } from "express";
import { 
  ingestCollection,
  ingestAllThemedCollections,
  fetchNFTsFromBithomp
} from "./bithomp-nft-ingestion";
import { scanAllThemedCollections, scanThemedCollection, THEMED_COLLECTIONS } from "./collection-theme-scanner";
import { db } from "./db";
import { gamingNftCollections } from "@shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

/**
 * POST /api/nft-ingestion/ingest-all
 * Ingest all themed collections from Bithomp
 */
router.post("/ingest-all", async (req: Request, res: Response) => {
  try {
    console.log("🚀 Starting full collection ingestion from Bithomp...");
    
    const results = await ingestAllThemedCollections();

    res.json({
      success: true,
      message: "All collections ingested from Bithomp",
      ...results
    });
  } catch (error: any) {
    console.error("Error ingesting collections:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/nft-ingestion/ingest/:collectionName
 * Ingest a specific collection
 */
router.post("/ingest/:collectionName", async (req: Request, res: Response) => {
  try {
    const { collectionName } = req.params;
    
    // Find collection config
    const collectionMap: Record<string, { issuer: string; taxon: number; name: string }> = {
      'under-the-bridge': { 
        issuer: 'rp5DGDDDFZdQswWfn3sgkQznCAj9SkkCMLH', 
        taxon: 9, 
        name: 'Under the Bridge' 
      },
      'the-inquiry': { 
        issuer: 'rp5DGDDDFZdQswWfn3sgkQznCAj9SkkCMLH', 
        taxon: 1, 
        name: 'The Inquiry' 
      },
      'dantes-aurum': { 
        issuer: 'rp5DGDDDFZdQswWfn3sgkQznCAj9SkkCMLH', 
        taxon: 3, 
        name: 'Dantes Aurum' 
      },
      'the-lost-emporium': { 
        issuer: 'rp5DGDDDFZdQswWfn3sgkQznCAj9SkkCMLH', 
        taxon: 2, 
        name: 'The Lost Emporium' 
      }
    };

    const config = collectionMap[collectionName];
    if (!config) {
      return res.status(404).json({
        success: false,
        error: `Unknown collection: ${collectionName}`
      });
    }

    console.log(`🚀 Ingesting collection: ${config.name}...`);
    const result = await ingestCollection(config.issuer, config.taxon, config.name);

    res.json({
      success: true,
      message: `Ingested ${config.name}`,
      ...result
    });
  } catch (error: any) {
    console.error("Error ingesting collection:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/nft-ingestion/full-setup
 * Complete setup: Ingest + Scan all collections
 */
router.post("/full-setup", async (req: Request, res: Response) => {
  try {
    console.log("🚀 Starting full NFT system setup...");
    console.log("Step 1: Ingesting all collections from Bithomp...");
    
    const ingestionResults = await ingestAllThemedCollections();
    
    console.log("Step 2: Scanning and applying power boosts...");
    const scanResults = await scanAllThemedCollections();

    res.json({
      success: true,
      message: "Full NFT system setup complete!",
      ingestion: ingestionResults,
      scanning: scanResults,
      summary: {
        collections_processed: ingestionResults.total_collections,
        total_nfts: ingestionResults.total_nfts_imported,
        total_scanned: scanResults.total_nfts_scanned
      }
    });
  } catch (error: any) {
    console.error("Error in full setup:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/nft-ingestion/preview/:issuer/:taxon
 * Preview NFTs from Bithomp without importing
 */
router.get("/preview/:issuer/:taxon", async (req: Request, res: Response) => {
  try {
    const { issuer, taxon } = req.params;
    
    const nfts = await fetchNFTsFromBithomp(issuer, parseInt(taxon), 10);

    res.json({
      success: true,
      issuer,
      taxon: parseInt(taxon),
      nfts_found: nfts.length,
      sample_nfts: nfts.map(nft => ({
        nftId: nft.nftId,
        tokenId: nft.tokenId,
        owner: nft.owner,
        name: nft.metadata?.name || `NFT #${nft.sequence}`,
        image: nft.metadata?.image,
        attributes: nft.metadata?.attributes
      }))
    });
  } catch (error: any) {
    console.error("Error previewing NFTs:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/nft-ingestion/status
 * Get ingestion status for all collections
 */
router.get("/status", async (req: Request, res: Response) => {
  try {
    const collections = [
      { name: 'Under the Bridge', issuer: 'rp5DGDDDFZdQswWfn3sgkQznCAj9SkkCMLH', taxon: 9 },
      { name: 'The Inquiry', issuer: 'rp5DGDDDFZdQswWfn3sgkQznCAj9SkkCMLH', taxon: 1 },
      { name: 'Dantes Aurum', issuer: 'rp5DGDDDFZdQswWfn3sgkQznCAj9SkkCMLH', taxon: 3 },
      { name: 'The Lost Emporium', issuer: 'rp5DGDDDFZdQswWfn3sgkQznCAj9SkkCMLH', taxon: 2 }
    ];

    const status = [];

    for (const coll of collections) {
      const dbCollection = await db.query.gamingNftCollections.findFirst({
        where: eq(gamingNftCollections.collection_id, `${coll.issuer}:${coll.taxon}`)
      });

      status.push({
        name: coll.name,
        taxon: coll.taxon,
        registered: !!dbCollection,
        metadata_ingested: dbCollection?.metadata_ingested || false,
        total_supply: dbCollection?.total_supply || 0,
        collection_id: dbCollection?.id || null
      });
    }

    res.json({
      success: true,
      collections: status,
      total_registered: status.filter(s => s.registered).length,
      total_ingested: status.filter(s => s.metadata_ingested).length
    });
  } catch (error: any) {
    console.error("Error getting ingestion status:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
