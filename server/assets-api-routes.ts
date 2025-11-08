/**
 * Assets API Routes - Comprehensive Asset Access System
 * 
 * Provides unified access to all assets across the platform:
 * - NFT Collection assets from Bithomp
 * - Stored local assets from ingestion jobs
 * - Token assets and metadata
 */

import { Router } from "express";
import { z } from "zod";
import { storage } from "./storage";

const router = Router();

// Validation schemas
const getAllAssetsSchema = z.object({
  type: z.enum(["all", "nft", "token", "collection"]).default("all"),
  limit: z.number().int().min(1).max(1000).default(100),
  offset: z.number().int().min(0).default(0),
  includeAssets: z.boolean().default(true),
  floorPrice: z.boolean().default(true),
  statistics: z.boolean().default(true),
  search: z.string().optional(),
  issuer: z.string().optional(),
  projectId: z.string().optional()
});

/**
 * GET /api/assets/all
 * Get all assets across the platform with unified response format
 * Matches Bithomp API structure you provided
 */
router.get("/all", async (req, res) => {
  try {
    const query = getAllAssetsSchema.parse({
      type: req.query.type,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
      includeAssets: req.query.assets === "true",
      floorPrice: req.query.floorPrice === "true", 
      statistics: req.query.statistics === "true",
      search: req.query.search,
      issuer: req.query.issuer,
      projectId: req.query.projectId
    });
    
    console.log(`🎯 [ASSETS API] Get all assets request:`, query);
    
    let collections = [];
    let totalResults = 0;
    
    // Build Bithomp API URL based on your documentation
    let bithompUrl = "https://bithomp.com/api/v2/nft-collections?";
    const params = new URLSearchParams();
    
    // Add required parameters
    params.append("limit", query.limit.toString());
    params.append("order", "createdNew");
    
    // Add optional parameters from your API docs
    if (query.includeAssets) {
      params.append("assets", "true");
    }
    if (query.floorPrice) {
      params.append("floorPrice", "true");  
    }
    if (query.search) {
      params.append("search", query.search);
    }
    if (query.issuer) {
      params.append("issuer", query.issuer);
    }
    
    bithompUrl += params.toString();
    
    console.log(`🔍 [ASSETS API] Fetching from Bithomp: ${bithompUrl}`);
    
    // Fetch from Bithomp API
    try {
      const response = await fetch(bithompUrl, {
        headers: {
          'x-bithomp-token': process.env.BITHOMP_API_KEY || '',
          'Accept': 'application/json',
          'User-Agent': 'RiddleSwap/1.0'
        }
      });
      
      if (response.ok) {
        const data = await response.json() as any;
        collections = data.collections || [];
        totalResults = collections.length;
        
        console.log(`✅ [ASSETS API] Found ${totalResults} collections from Bithomp`);
      } else {
        console.error(`❌ [ASSETS API] Bithomp API error: ${response.status}`);
      }
    } catch (bithompError) {
      console.error(`❌ [ASSETS API] Bithomp fetch error:`, bithompError);
    }
    
    // Get local ingested assets if requested
    let localAssets = [];
    if (query.projectId) {
      try {
        const jobs = await storage.getIngestionJobsByProject(query.projectId, 'completed');
        localAssets = jobs.filter(job => job.job_type === 'collection_scan');
        console.log(`📁 [ASSETS API] Found ${localAssets.length} local asset jobs for project ${query.projectId}`);
      } catch (localError) {
        console.error(`❌ [ASSETS API] Local assets fetch error:`, localError);
      }
    }
    
    // Apply pagination
    const startIndex = query.offset;
    const endIndex = startIndex + query.limit;
    const paginatedCollections = collections.slice(startIndex, endIndex);
    
    // Format response to match your Bithomp API structure
    const response_data = {
      type: "xls20",
      order: "createdNew", 
      search: query.search || null,
      limit: query.limit,
      offset: query.offset,
      total: totalResults,
      collections: paginatedCollections.map((col: any) => ({
        collection: col.collection,
        name: col.name,
        family: col.family,
        description: col.description,
        image: col.image,
        issuer: col.issuer,
        issuerDetails: col.issuerDetails,
        taxon: col.taxon,
        floorPrices: col.floorPrices || [],
        assets: col.assets ? {
          image: col.assets.image,
          preview: col.assets.preview, 
          thumbnail: col.assets.thumbnail
        } : null,
        statistics: query.statistics ? {
          nfts: col.statistics?.nfts || 0,
          owners: col.statistics?.owners || 0,
          tradedNfts: col.statistics?.tradedNfts || 0,
          buyers: col.statistics?.buyers || 0
        } : undefined
      })),
      localIngestionJobs: query.projectId ? localAssets.length : undefined,
      meta: {
        timestamp: new Date().toISOString(),
        source: "RiddleSwap Assets API",
        bithompSource: true,
        localSource: !!query.projectId
      }
    };
    
    console.log(`✅ [ASSETS API] Returning ${paginatedCollections.length} collections`);
    
    res.json(response_data);
    
  } catch (error) {
    console.error("❌ [ASSETS API] Error in get all assets:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid request parameters",
        details: error.errors
      });
    }
    
    res.status(500).json({
      error: "Failed to fetch assets",
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/assets/collection/:issuer/:taxon
 * Get specific collection assets with all variants
 */
router.get("/collection/:issuer/:taxon", async (req, res) => {
  try {
    const { issuer, taxon } = req.params;
    const includeAssets = req.query.assets === "true";
    const includeNFTs = req.query.nfts === "true";
    
    console.log(`🎯 [ASSETS API] Get collection assets: ${issuer}:${taxon}`);
    
    // Fetch from Bithomp API
    const collectionUrl = `https://bithomp.com/api/v2/nft-collection/${issuer}:${taxon}?floorPrice=true&statistics=true&assets=${includeAssets}`;
    
    const response = await fetch(collectionUrl, {
      headers: {
        'x-bithomp-token': process.env.BITHOMP_API_KEY || '',
        'Accept': 'application/json', 
        'User-Agent': 'RiddleSwap/1.0'
      }
    });
    
    if (!response.ok) {
      return res.status(404).json({
        error: "Collection not found",
        issuer,
        taxon: parseInt(taxon)
      });
    }
    
    const data = await response.json() as any;
    
    // Get individual NFTs if requested
    let nfts = [];
    if (includeNFTs) {
      const nftsUrl = `https://bithomp.com/api/v2/nfts?issuer=${issuer}&taxon=${taxon}&limit=50&assets=${includeAssets}`;
      
      try {
        const nftsResponse = await fetch(nftsUrl, {
          headers: {
            'x-bithomp-token': process.env.BITHOMP_API_KEY || '',
            'Accept': 'application/json',
            'User-Agent': 'RiddleSwap/1.0'
          }
        });
        
        if (nftsResponse.ok) {
          const nftsData = await nftsResponse.json();
          nfts = nftsData.nfts || [];
        }
      } catch (nftsError) {
        console.error(`⚠️ [ASSETS API] Failed to fetch NFTs:`, nftsError);
      }
    }
    
    console.log(`✅ [ASSETS API] Collection found with ${nfts.length} NFTs`);
    
    res.json({
      success: true,
      collection: data.collection,
      nfts: includeNFTs ? nfts : undefined,
      meta: {
        timestamp: new Date().toISOString(),
        source: "RiddleSwap Assets API",
        includeAssets,
        includeNFTs
      }
    });
    
  } catch (error) {
    console.error("❌ [ASSETS API] Error fetching collection assets:", error);
    res.status(500).json({
      error: "Failed to fetch collection assets",
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/assets/stats
 * Get comprehensive asset statistics
 */
router.get("/stats", async (req, res) => {
  try {
    console.log(`📊 [ASSETS API] Getting asset statistics`);
    
    // Get ingestion job statistics
    const jobStats: { [key: string]: number } = {};
    const statuses = ['queued', 'running', 'completed', 'failed'];
    
    for (const status of statuses) {
      const jobs = await storage.getIngestionJobsByStatus(status, 1000);
      jobStats[status] = jobs.length;
    }
    
    // Get recent activity
    const recentJobs = await storage.getIngestionJobsByStatus('completed', 100);
    const last24Hours = recentJobs.filter(job => {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return job.completed_at && new Date(job.completed_at) > oneDayAgo;
    });
    
    res.json({
      success: true,
      stats: {
        ingestionJobs: jobStats,
        recentActivity: {
          last24Hours: last24Hours.length,
          totalCompleted: jobStats['completed'] || 0,
          totalFailed: jobStats['failed'] || 0
        },
        service: {
          uptime: process.uptime(),
          timestamp: new Date().toISOString()
        }
      }
    });
    
  } catch (error) {
    console.error("❌ [ASSETS API] Error fetching stats:", error);
    res.status(500).json({
      error: "Failed to fetch asset statistics",
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;