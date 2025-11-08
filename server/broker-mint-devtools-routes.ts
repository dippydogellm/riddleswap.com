import { Router, Request, Response } from 'express';
import { db } from './db';
import { brokerMintEscrow, nftProjects } from '../shared/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

const router = Router();
const BROKER_FEE_PERCENTAGE = 0.01589; // 1.589% broker fee

// Use existing authenticated request type from server
const requireAuthentication = (req: any, res: Response, next: Function) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

/**
 * DEVTOOLS PLATFORM MINTING ESCROW
 * 
 * Flow:
 * 1. Project owner sets up NFT project via DevTools
 * 2. Buyer initiates mint for a project
 * 3. Buyer pays mint cost + broker fee to broker wallet
 * 4. Broker mints NFT from project configuration
 * 5. Broker creates sell offer (0 XRP) to buyer
 * 6. Buyer accepts offer to receive NFT
 * 7. Broker distributes payment to project creator
 */

/**
 * Initialize DevTools platform mint escrow
 * POST /api/broker/mint/devtools/init
 */
router.post('/init', requireAuthentication, async (req: any, res: Response) => {
  try {
    const user = req.user;
    if (!user?.handle) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      projectId,          // NFT project ID from DevTools
      buyerAddress,       // Buyer's XRPL address
      nftMetadataUri,     // IPFS URI for this specific NFT
      nftName,
      nftDescription
    } = req.body;

    // Validation
    if (!projectId || !buyerAddress) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get project details
    const [project] = await db
      .select()
      .from(nftProjects)
      .where(eq(nftProjects.id, projectId))
      .limit(1);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if project is active and has mint price configured
    if (!project.mintPrice) {
      return res.status(400).json({ error: 'Project mint price not configured' });
    }

    // Calculate fees
    const mintCostDrops = Math.floor(parseFloat(project.mintPrice || '0') * 1_000_000);
    const brokerFeeDrops = Math.floor(mintCostDrops * BROKER_FEE_PERCENTAGE);
    const platformFeeDrops = 0; // No platform fee field in schema
    const totalAmountDrops = mintCostDrops + brokerFeeDrops;

    // Create escrow record
    const escrowId = nanoid();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hour expiry

    await db.insert(brokerMintEscrow).values({
      id: escrowId,
      platformType: 'devtools',
      buyerAddress,
      buyerHandle: user.handle,
      projectId,
      nftMetadataUri: nftMetadataUri,
      nftName,
      nftDescription,
      mintCost: mintCostDrops.toString(),
      brokerFee: brokerFeeDrops.toString(),
      platformFee: platformFeeDrops.toString(),
      totalAmount: totalAmountDrops.toString(),
      status: 'pending',
      expiresAt,
    });

    const BROKER_WALLET_ADDRESS = process.env.RIDDLE_BROKER_ADDRESS || process.env.BROKER_WALLET_ADDRESS || 'rGLzXKif4ksBZe2MY6RZT9m69hdgzsXG4X';

    console.log(`🏭 [DEVTOOLS MINT ESCROW] Created escrow ${escrowId} for project ${project.projectName}`);
    console.log(`💰 [DEVTOOLS MINT ESCROW] Mint cost: ${project.mintPrice} XRP, Broker fee: ${(brokerFeeDrops / 1_000_000).toFixed(6)} XRP`);

    res.json({
      success: true,
      escrowId,
      platformType: 'devtools',
      project: {
        id: project.id,
        name: project.projectName,
        issuerAddress: project.creatorWallet,
        taxon: project.taxon
      },
      instructions: {
        step1: `Send ${(totalAmountDrops / 1_000_000).toFixed(6)} XRP to broker wallet`,
        step2: 'Include escrow ID in transaction memo',
        step3: 'Broker will mint NFT from project configuration',
        step4: 'Broker creates 0 XRP offer for you to accept',
        step5: 'NFT transfers to you automatically'
      },
      payment: {
        brokerAddress: BROKER_WALLET_ADDRESS,
        totalAmountXrp: (totalAmountDrops / 1_000_000).toFixed(6),
        mintCostXrp: (mintCostDrops / 1_000_000).toFixed(6),
        brokerFeeXrp: (brokerFeeDrops / 1_000_000).toFixed(6),
        platformFeeXrp: platformFeeDrops > 0 ? (platformFeeDrops / 1_000_000).toFixed(6) : '0',
        brokerFeePercentage: BROKER_FEE_PERCENTAGE,
        memo: JSON.stringify({
          escrowId,
          platformType: 'devtools',
          projectId,
          buyerAddress,
          buyerHandle: user.handle
        })
      },
      timeline: {
        step1: 'Your payment detected - Escrow created',
        step2: 'Broker mints NFT from project',
        step3: 'Broker creates 0 XRP sell offer to you',
        step4: 'You accept offer - NFT transferred',
        step5: 'Project creator receives payment automatically'
      }
    });

  } catch (error) {
    console.error('❌ [DEVTOOLS MINT ESCROW] Error:', error);
    res.status(500).json({ 
      error: 'Failed to initiate DevTools mint escrow',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get DevTools mint escrow status
 * GET /api/broker/mint/devtools/status/:escrowId
 */
router.get('/status/:escrowId', requireAuthentication, async (req: any, res: Response) => {
  try {
    const user = req.user;
    if (!user?.handle) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { escrowId } = req.params;

    const [escrow] = await db
      .select()
      .from(brokerMintEscrow)
      .where(eq(brokerMintEscrow.id, escrowId))
      .limit(1);

    if (!escrow) {
      return res.status(404).json({ error: 'Escrow not found' });
    }

    // Only allow buyer or admin to view status
    if (escrow.buyerHandle !== user.handle && user.handle !== 'dippydoge') {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      success: true,
      escrow: {
        id: escrow.id,
        platformType: escrow.platformType,
        status: escrow.status,
        projectId: escrow.projectId,
        buyerAddress: escrow.buyerAddress,
        mintCost: escrow.mintCost,
        brokerFee: escrow.brokerFee,
        platformFee: escrow.platformFee,
        totalAmount: escrow.totalAmount,
        paymentTxHash: escrow.paymentTxHash,
        mintTxHash: escrow.mintTxHash,
        nftTokenId: escrow.mintedNftId,
        offerTxHash: escrow.offerTxHash,
        offerIndex: escrow.offerIndex,
        acceptedTxHash: escrow.acceptedTxHash,
        creatorPaymentTxHash: escrow.creatorPaymentTxHash,
        createdAt: escrow.createdAt,
        updatedAt: escrow.updatedAt
      }
    });

  } catch (error) {
    console.error('❌ [DEVTOOLS MINT ESCROW] Status error:', error);
    res.status(500).json({ 
      error: 'Failed to get escrow status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Cancel DevTools mint escrow (before minting)
 * POST /api/broker/mint/devtools/cancel/:escrowId
 */
router.post('/cancel/:escrowId', requireAuthentication, async (req: any, res: Response) => {
  try {
    const user = req.user;
    if (!user?.handle) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { escrowId } = req.params;

    const [escrow] = await db
      .select()
      .from(brokerMintEscrow)
      .where(eq(brokerMintEscrow.id, escrowId))
      .limit(1);

    if (!escrow) {
      return res.status(404).json({ error: 'Escrow not found' });
    }

    // Only allow buyer or admin to cancel
    if (escrow.buyerHandle !== user.handle && user.handle !== 'dippydoge') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Can only cancel if not yet minted
    if (escrow.status !== 'pending' && escrow.status !== 'payment_received') {
      return res.status(400).json({ error: 'Cannot cancel at this stage' });
    }

    await db
      .update(brokerMintEscrow)
      .set({  
        status: 'refunded',
        updatedAt: new Date()
       } as any)
      .where(eq(brokerMintEscrow.id, escrowId));

    console.log(`🚫 [DEVTOOLS MINT ESCROW] Cancelled escrow ${escrowId}`);

    res.json({
      success: true,
      message: 'Escrow cancelled successfully',
      refundRequired: !!escrow.paymentTxHash
    });

  } catch (error) {
    console.error('❌ [DEVTOOLS MINT ESCROW] Cancel error:', error);
    res.status(500).json({ 
      error: 'Failed to cancel escrow',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * List all escrows for a project (admin/creator only)
 * GET /api/broker/mint/devtools/project/:projectId/escrows
 */
router.get('/project/:projectId/escrows', requireAuthentication, async (req: any, res: Response) => {
  try {
    const user = req.user;
    if (!user?.handle) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { projectId } = req.params;

    // Get project to verify ownership
    const [project] = await db
      .select()
      .from(nftProjects)
      .where(eq(nftProjects.id, projectId))
      .limit(1);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Only allow project creator or admin to view
    if (project.creatorUserId !== user.handle && user.handle !== 'dippydoge') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const escrows = await db
      .select()
      .from(brokerMintEscrow)
      .where(and(
        eq(brokerMintEscrow.projectId, projectId.toString()),
        eq(brokerMintEscrow.platformType, 'devtools')
      ))
      .orderBy(brokerMintEscrow.createdAt);

    res.json({
      success: true,
      project: {
        id: project.id,
        name: project.projectName
      },
      escrows: escrows.map(escrow => ({
        id: escrow.id,
        status: escrow.status,
        buyerAddress: escrow.buyerAddress,
        buyerHandle: escrow.buyerHandle,
        mintCost: escrow.mintCost,
        totalAmount: escrow.totalAmount,
        nftTokenId: escrow.mintedNftId,
        createdAt: escrow.createdAt,
        updatedAt: escrow.updatedAt
      }))
    });

  } catch (error) {
    console.error('❌ [DEVTOOLS MINT ESCROW] List error:', error);
    res.status(500).json({ 
      error: 'Failed to list escrows',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
