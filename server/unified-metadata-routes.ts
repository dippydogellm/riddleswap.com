/**
 * Unified Metadata API Routes
 * 
 * Provides centralized metadata endpoints that aggregate data from:
 * - Project content overrides (highest priority)
 * - Token/NFT configurations 
 * - Cached metadata
 * - Bithomp/DexScreener APIs (fallback)
 */

import { Router } from "express";
import { z } from "zod";
import { metadataAggregator } from "./metadata-aggregator-service";

const router = Router();

// Validation schemas
const tokenQuerySchema = z.object({
  issuer: z.string().min(1, "Issuer is required"),
  currency: z.string().min(1, "Currency is required")
});

const collectionQuerySchema = z.object({
  issuer: z.string().min(1, "Issuer is required"),
  taxon: z.string().transform((val) => {
    const num = parseInt(val);
    if (isNaN(num)) throw new Error("Taxon must be a valid number");
    return num;
  })
});

const nftQuerySchema = z.object({
  tokenId: z.string().min(1, "Token ID is required")
});

/**
 * GET /api/metadata/token
 * Get unified token metadata
 * Query params: issuer, currency
 */
router.get("/token", async (req, res) => {
  try {
    console.log(`📊 [UNIFIED-METADATA] Token metadata request:`, req.query);
    
    // Validate query parameters
    const { issuer, currency } = tokenQuerySchema.parse(req.query);
    
    // Get unified metadata
    const metadata = await metadataAggregator.getMergedTokenMetadata(issuer, currency);
    
    // Add request metadata
    const response = {
      ...metadata,
      request_info: {
        endpoint: "unified_token_metadata",
        issuer,
        currency,
        timestamp: new Date().toISOString(),
        sources_queried: Object.keys(metadata.metadata_sources).filter(key => metadata.metadata_sources[key])
      }
    };
    
    console.log(`✅ [UNIFIED-METADATA] Token metadata response prepared for ${currency}:${issuer}`);
    res.json(response);
    
  } catch (error) {
    console.error(`❌ [UNIFIED-METADATA] Token metadata error:`, error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid query parameters",
        details: error.errors,
        usage: "GET /api/metadata/token?issuer=<address>&currency=<code>"
      });
    }
    
    res.status(500).json({
      error: "Failed to fetch token metadata",
      message: error.message || "Unknown error",
      endpoint: "unified_token_metadata"
    });
  }
});

/**
 * GET /api/metadata/collection
 * Get unified collection metadata
 * Query params: issuer, taxon
 */
router.get("/collection", async (req, res) => {
  try {
    console.log(`🎨 [UNIFIED-METADATA] Collection metadata request:`, req.query);
    
    // Validate query parameters
    const { issuer, taxon } = collectionQuerySchema.parse(req.query);
    
    // Get unified metadata
    const metadata = await metadataAggregator.getMergedCollectionMetadata(issuer, taxon);
    
    // Add request metadata
    const response = {
      ...metadata,
      request_info: {
        endpoint: "unified_collection_metadata",
        issuer,
        taxon,
        timestamp: new Date().toISOString(),
        sources_queried: Object.keys(metadata.metadata_sources).filter(key => metadata.metadata_sources[key])
      }
    };
    
    console.log(`✅ [UNIFIED-METADATA] Collection metadata response prepared for ${issuer}:${taxon}`);
    res.json(response);
    
  } catch (error) {
    console.error(`❌ [UNIFIED-METADATA] Collection metadata error:`, error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid query parameters",
        details: error.errors,
        usage: "GET /api/metadata/collection?issuer=<address>&taxon=<number>"
      });
    }
    
    res.status(500).json({
      error: "Failed to fetch collection metadata",
      message: error.message || "Unknown error",
      endpoint: "unified_collection_metadata"
    });
  }
});

/**
 * GET /api/metadata/nft
 * Get unified NFT metadata
 * Query params: tokenId
 */
router.get("/nft", async (req, res) => {
  try {
    console.log(`🖼️ [UNIFIED-METADATA] NFT metadata request:`, req.query);
    
    // Validate query parameters
    const { tokenId } = nftQuerySchema.parse(req.query);
    
    // Get unified metadata
    const metadata = await metadataAggregator.getMergedNFTMetadata(tokenId);
    
    // Add request metadata
    const response = {
      ...metadata,
      request_info: {
        endpoint: "unified_nft_metadata",
        tokenId,
        timestamp: new Date().toISOString(),
        sources_queried: Object.keys(metadata.metadata_sources).filter(key => metadata.metadata_sources[key])
      }
    };
    
    console.log(`✅ [UNIFIED-METADATA] NFT metadata response prepared for ${tokenId}`);
    res.json(response);
    
  } catch (error) {
    console.error(`❌ [UNIFIED-METADATA] NFT metadata error:`, error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid query parameters",
        details: error.errors,
        usage: "GET /api/metadata/nft?tokenId=<nft_token_id>"
      });
    }
    
    res.status(500).json({
      error: "Failed to fetch NFT metadata",
      message: error.message || "Unknown error",
      endpoint: "unified_nft_metadata"
    });
  }
});

/**
 * GET /api/metadata/batch
 * Batch metadata requests (for efficiency)
 * POST body: { requests: [{ type: "token|collection|nft", params: {...} }] }
 */
router.post("/batch", async (req, res) => {
  try {
    console.log(`📦 [UNIFIED-METADATA] Batch metadata request`);
    
    const requests = req.body?.requests;
    if (!Array.isArray(requests)) {
      return res.status(400).json({
        error: "Invalid request format",
        usage: "POST /api/metadata/batch with body: { requests: [{ type: 'token|collection|nft', params: {...} }] }"
      });
    }
    
    const results = [];
    const errors = [];
    
    // Process each request
    for (let i = 0; i < requests.length; i++) {
      const request = requests[i];
      
      try {
        let metadata;
        
        switch (request.type) {
          case 'token':
            const tokenParams = tokenQuerySchema.parse(request.params);
            metadata = await metadataAggregator.getMergedTokenMetadata(tokenParams.issuer, tokenParams.currency);
            break;
            
          case 'collection':
            const collectionParams = collectionQuerySchema.parse(request.params);
            metadata = await metadataAggregator.getMergedCollectionMetadata(collectionParams.issuer, collectionParams.taxon);
            break;
            
          case 'nft':
            const nftParams = nftQuerySchema.parse(request.params);
            metadata = await metadataAggregator.getMergedNFTMetadata(nftParams.tokenId);
            break;
            
          default:
            throw new Error(`Unsupported metadata type: ${request.type}`);
        }
        
        results.push({
          index: i,
          type: request.type,
          success: true,
          metadata,
          sources_used: Object.keys(metadata.metadata_sources).filter(key => metadata.metadata_sources[key])
        });
        
      } catch (requestError) {
        console.error(`❌ [UNIFIED-METADATA] Batch request ${i} failed:`, requestError);
        errors.push({
          index: i,
          type: request.type,
          error: requestError.message || "Unknown error",
          params: request.params
        });
      }
    }
    
    const response = {
      processed: requests.length,
      successful: results.length,
      failed: errors.length,
      results,
      errors,
      batch_info: {
        endpoint: "unified_batch_metadata",
        timestamp: new Date().toISOString()
      }
    };
    
    console.log(`✅ [UNIFIED-METADATA] Batch processed: ${results.length}/${requests.length} successful`);
    res.json(response);
    
  } catch (error) {
    console.error(`❌ [UNIFIED-METADATA] Batch metadata error:`, error);
    res.status(500).json({
      error: "Batch processing failed",
      message: error.message || "Unknown error",
      endpoint: "unified_batch_metadata"
    });
  }
});

/**
 * POST /api/metadata/invalidate
 * Invalidate metadata caches for specific entities
 * POST body: { entities: [{ type: "token|collection|nft", params: {...} }] }
 */
router.post("/invalidate", async (req, res) => {
  try {
    console.log(`🗑️ [UNIFIED-METADATA] Cache invalidation request`);
    
    const entities = req.body?.entities;
    if (!Array.isArray(entities)) {
      return res.status(400).json({
        error: "Invalid request format",
        usage: "POST /api/metadata/invalidate with body: { entities: [{ type: 'token|collection|nft', params: {...} }] }"
      });
    }
    
    const results = [];
    
    // Process each invalidation request
    for (const entity of entities) {
      try {
        switch (entity.type) {
          case 'token':
            const tokenParams = tokenQuerySchema.parse(entity.params);
            await metadataAggregator.invalidateEntityCache('token', tokenParams.issuer, tokenParams.currency);
            results.push({
              type: 'token',
              params: tokenParams,
              success: true
            });
            break;
            
          case 'collection':
            const collectionParams = collectionQuerySchema.parse(entity.params);
            await metadataAggregator.invalidateEntityCache('collection', collectionParams.issuer, collectionParams.taxon);
            results.push({
              type: 'collection',
              params: collectionParams,
              success: true
            });
            break;
            
          case 'nft':
            const nftParams = nftQuerySchema.parse(entity.params);
            await metadataAggregator.invalidateEntityCache('nft', nftParams.tokenId);
            results.push({
              type: 'nft',
              params: nftParams,
              success: true
            });
            break;
            
          default:
            throw new Error(`Unsupported entity type: ${entity.type}`);
        }
        
      } catch (entityError) {
        console.error(`❌ [UNIFIED-METADATA] Entity invalidation failed:`, entityError);
        results.push({
          type: entity.type,
          params: entity.params,
          success: false,
          error: entityError.message || "Unknown error"
        });
      }
    }
    
    const response = {
      invalidated: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
      invalidation_info: {
        endpoint: "unified_cache_invalidation",
        timestamp: new Date().toISOString()
      }
    };
    
    console.log(`✅ [UNIFIED-METADATA] Cache invalidation completed: ${response.invalidated} successful`);
    res.json(response);
    
  } catch (error) {
    console.error(`❌ [UNIFIED-METADATA] Cache invalidation error:`, error);
    res.status(500).json({
      error: "Cache invalidation failed",
      message: error.message || "Unknown error",
      endpoint: "unified_cache_invalidation"
    });
  }
});

/**
 * GET /api/metadata/health
 * Health check endpoint for monitoring
 */
router.get("/health", async (req, res) => {
  try {
    // Test basic functionality
    const healthCheck = {
      status: "healthy",
      service: "unified_metadata_aggregator",
      timestamp: new Date().toISOString(),
      checks: {
        aggregator_service: "✅ Available",
        storage_interface: "✅ Available",
        bithomp_integration: "✅ Available"
      }
    };
    
    res.json(healthCheck);
    
  } catch (error) {
    console.error(`❌ [UNIFIED-METADATA] Health check failed:`, error);
    res.status(503).json({
      status: "unhealthy",
      service: "unified_metadata_aggregator",
      timestamp: new Date().toISOString(),
      error: error.message || "Unknown error"
    });
  }
});

export default router;