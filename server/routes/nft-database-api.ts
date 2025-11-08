/**
 * NFT Database API Routes
 * 
 * Provides comprehensive GET/PUT endpoints for NFT ownership management
 * Allows getting all nft_id for collections and assigning ownership
 */

import { Router } from 'express';
import { nftDatabaseManager, OwnershipAssignment } from '../services/nft-database-manager';
import { z } from 'zod';

const router = Router();

// Validation schemas
const assignOwnershipSchema = z.object({
  nft_id: z.string().min(1),
  new_owner: z.string().min(1),
  change_reason: z.string().default('manual_assignment'),
  power_level: z.number().optional()
});

const batchAssignOwnershipSchema = z.object({
  assignments: z.array(assignOwnershipSchema)
});

// GET: All NFT IDs for a specific collection
router.get('/collections/:issuer/nft-ids', async (req, res) => {
  try {
    const { issuer } = req.params;
    
    if (!issuer) {
      return res.status(400).json({
        success: false,
        error: 'Collection issuer is required'
      });
    }

    const nftIds = await nftDatabaseManager.getAllNftIdsForCollection(issuer);
    
    res.json({
      success: true,
      data: {
        collection_issuer: issuer,
        nft_ids: nftIds,
        count: nftIds.length
      }
    });
  } catch (error) {
    console.error('❌ [NFT-DB-API] Error getting NFT IDs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve NFT IDs'
    });
  }
});

// GET: All NFTs for a specific collection with full details
router.get('/collections/:issuer/nfts', async (req, res) => {
  try {
    const { issuer } = req.params;
    
    if (!issuer) {
      return res.status(400).json({
        success: false,
        error: 'Collection issuer is required'
      });
    }

    const nfts = await nftDatabaseManager.getAllNftsForCollection(issuer);
    
    res.json({
      success: true,
      data: {
        collection_issuer: issuer,
        nfts: nfts,
        count: nfts.length
      }
    });
  } catch (error) {
    console.error('❌ [NFT-DB-API] Error getting NFTs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve NFTs'
    });
  }
});

// GET: Collection summary with ownership statistics
router.get('/collections/:issuer/summary', async (req, res) => {
  try {
    const { issuer } = req.params;
    
    if (!issuer) {
      return res.status(400).json({
        success: false,
        error: 'Collection issuer is required'
      });
    }

    const summary = await nftDatabaseManager.getCollectionSummary(issuer);
    
    if (!summary) {
      return res.status(404).json({
        success: false,
        error: 'Collection not found'
      });
    }

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('❌ [NFT-DB-API] Error getting collection summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve collection summary'
    });
  }
});

// GET: All collections summary
router.get('/collections/summary', async (req, res) => {
  try {
    const summaries = await nftDatabaseManager.getAllCollectionsSummary();
    
    res.json({
      success: true,
      data: {
        collections: summaries,
        total_collections: summaries.length,
        total_nfts: summaries.reduce((sum, col) => sum + col.total_nfts, 0),
        total_owned: summaries.reduce((sum, col) => sum + col.owned_count, 0),
        total_unassigned: summaries.reduce((sum, col) => sum + col.unassigned_count, 0)
      }
    });
  } catch (error) {
    console.error('❌ [NFT-DB-API] Error getting all collections summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve collections summary'
    });
  }
});

// GET: NFTs owned by a specific address
router.get('/owners/:address/nfts', async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!address) {
      return res.status(400).json({
        success: false,
        error: 'Owner address is required'
      });
    }

    const nfts = await nftDatabaseManager.getNftsByOwner(address);
    
    // Group by collection
    const collections: Record<string, any> = {};
    for (const nft of nfts) {
      if (!collections[nft.issuer_address]) {
        collections[nft.issuer_address] = {
          collection_name: nft.collection_name,
          issuer_address: nft.issuer_address,
          nfts: [],
          count: 0,
          total_power: 0
        };
      }
      collections[nft.issuer_address].nfts.push(nft);
      collections[nft.issuer_address].count++;
      collections[nft.issuer_address].total_power += parseFloat(nft.power_multiplier || '1') * 100;
    }

    res.json({
      success: true,
      data: {
        owner_address: address,
        total_nfts: nfts.length,
        collections: collections,
        nfts: nfts
      }
    });
  } catch (error) {
    console.error('❌ [NFT-DB-API] Error getting NFTs by owner:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve NFTs for owner'
    });
  }
});

// PUT: Assign NFT ownership to a new owner
router.put('/nfts/:nft_id/assign', async (req, res) => {
  try {
    const { nft_id } = req.params;
    const body = assignOwnershipSchema.parse(req.body);
    
    const assignment: OwnershipAssignment = {
      nft_id: nft_id,
      previous_owner: null, // Will be determined by the service
      new_owner: body.new_owner,
      change_reason: body.change_reason,
      power_level: body.power_level
    };

    const success = await nftDatabaseManager.assignNftOwnership(assignment);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'NFT not found or assignment failed'
      });
    }

    res.json({
      success: true,
      message: `NFT ${nft_id} assigned to ${body.new_owner}`,
      data: {
        nft_id: nft_id,
        new_owner: body.new_owner,
        change_reason: body.change_reason
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      });
    }

    console.error('❌ [NFT-DB-API] Error assigning NFT ownership:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assign NFT ownership'
    });
  }
});

// PUT: Batch assign multiple NFTs to owners
router.put('/nfts/batch-assign', async (req, res) => {
  try {
    const body = batchAssignOwnershipSchema.parse(req.body);
    
    const assignments: OwnershipAssignment[] = body.assignments.map(assignment => ({
      nft_id: assignment.nft_id,
      previous_owner: null, // Will be determined by the service
      new_owner: assignment.new_owner,
      change_reason: assignment.change_reason,
      power_level: assignment.power_level
    }));

    const result = await nftDatabaseManager.batchAssignNftOwnership(assignments);
    
    res.json({
      success: true,
      message: `Batch assignment complete: ${result.success} successful, ${result.failed} failed`,
      data: {
        total_assignments: assignments.length,
        successful: result.success,
        failed: result.failed,
        success_rate: ((result.success / assignments.length) * 100).toFixed(2) + '%'
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      });
    }

    console.error('❌ [NFT-DB-API] Error in batch assignment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process batch assignment'
    });
  }
});

// DELETE: Remove NFT ownership (set to unassigned)
router.delete('/nfts/:nft_id/ownership', async (req, res) => {
  try {
    const { nft_id } = req.params;
    const { reason = 'manual_removal' } = req.body;
    
    const success = await nftDatabaseManager.removeNftOwnership(nft_id, reason);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'NFT not found or removal failed'
      });
    }

    res.json({
      success: true,
      message: `Ownership removed for NFT ${nft_id}`,
      data: {
        nft_id: nft_id,
        action: 'ownership_removed',
        reason: reason
      }
    });
  } catch (error) {
    console.error('❌ [NFT-DB-API] Error removing NFT ownership:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove NFT ownership'
    });
  }
});

// GET: NFT ownership history
router.get('/nfts/:nft_id/history', async (req, res) => {
  try {
    const { nft_id } = req.params;
    
    const history = await nftDatabaseManager.getNftOwnershipHistory(nft_id);
    
    res.json({
      success: true,
      data: {
        nft_id: nft_id,
        ownership_history: history,
        total_changes: history.length
      }
    });
  } catch (error) {
    console.error('❌ [NFT-DB-API] Error getting NFT history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve NFT ownership history'
    });
  }
});

// GET: Database consistency check
router.get('/system/consistency-check', async (req, res) => {
  try {
    const consistency = await nftDatabaseManager.verifyDatabaseConsistency();
    
    res.json({
      success: true,
      data: consistency,
      status: consistency.consistency_issues.length === 0 ? 'healthy' : 'issues_found'
    });
  } catch (error) {
    console.error('❌ [NFT-DB-API] Error checking consistency:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform consistency check'
    });
  }
});

export default router;