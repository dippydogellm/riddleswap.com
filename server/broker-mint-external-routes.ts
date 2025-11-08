import { Router, Request, Response } from 'express';
import { db } from './db';
import { brokerMintEscrow } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import crypto from 'crypto';

const router = Router();
const BROKER_FEE_PERCENTAGE = 0.01589; // 1.589% broker fee

// Encryption helpers (same as wallet encryption)
if (!process.env.SESSION_SECRET) {
  throw new Error('🔴 CRITICAL: SESSION_SECRET must be configured for secure private key encryption');
}
const ENCRYPTION_KEY = process.env.SESSION_SECRET;

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(encrypted: string): string {
  const parts = encrypted.split(':');
  const iv = Buffer.from(parts.shift()!, 'hex');
  const encryptedText = Buffer.from(parts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

// Use existing authenticated request type from server
const requireAuthentication = (req: any, res: Response, next: Function) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

/**
 * EXTERNAL PLATFORM MINTING ESCROW
 * 
 * Flow:
 * 1. Creator from external platform initiates mint with private key
 * 2. Buyer pays mint cost + broker fee to broker wallet
 * 3. Broker mints NFT using creator's encrypted private key
 * 4. Broker creates sell offer (0 XRP) to buyer
 * 5. Buyer accepts offer to receive NFT
 * 6. Broker distributes payment to creator
 */

/**
 * Initialize external platform mint escrow
 * POST /api/broker/mint/external/init
 */
router.post('/init', requireAuthentication, async (req: any, res: Response) => {
  try {
    const user = req.user;
    if (!user?.handle) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      issuerAddress,      // NFT issuer address (creator wallet)
      issuerPrivateKey,   // Creator's private key (will be encrypted)
      taxon,              // NFT taxon
      buyerAddress,       // Buyer's XRPL address
      mintCost,           // Mint cost in XRP
      nftMetadataUri,     // IPFS URI for metadata
      nftName,
      nftDescription
    } = req.body;

    // Validation
    if (!issuerAddress || !issuerPrivateKey || !buyerAddress || !mintCost) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Calculate fees
    const mintCostDrops = Math.floor(parseFloat(mintCost) * 1_000_000);
    const brokerFeeDrops = Math.floor(mintCostDrops * BROKER_FEE_PERCENTAGE);
    const totalAmountDrops = mintCostDrops + brokerFeeDrops;

    // Encrypt private key before storing
    const encryptedPrivateKey = encrypt(issuerPrivateKey);

    // Create escrow record
    const escrowId = nanoid();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hour expiry

    await db.insert(brokerMintEscrow).values({
      id: escrowId,
      platformType: 'external',
      buyerAddress,
      buyerHandle: user.handle,
      issuerAddress,
      issuerPrivateKey: encryptedPrivateKey,
      taxon: taxon || '0',
      nftMetadataUri,
      nftName,
      nftDescription,
      mintCost: mintCostDrops.toString(),
      brokerFee: brokerFeeDrops.toString(),
      totalAmount: totalAmountDrops.toString(),
      status: 'pending',
      expiresAt,
    });

    const BROKER_WALLET_ADDRESS = process.env.RIDDLE_BROKER_ADDRESS || process.env.BROKER_WALLET_ADDRESS || 'rGLzXKif4ksBZe2MY6RZT9m69hdgzsXG4X';

    console.log(`🏭 [EXTERNAL MINT ESCROW] Created escrow ${escrowId} for buyer ${buyerAddress}`);
    console.log(`💰 [EXTERNAL MINT ESCROW] Mint cost: ${mintCost} XRP, Broker fee: ${(brokerFeeDrops / 1_000_000).toFixed(6)} XRP`);

    res.json({
      success: true,
      escrowId,
      platformType: 'external',
      instructions: {
        step1: `Send ${(totalAmountDrops / 1_000_000).toFixed(6)} XRP to broker wallet`,
        step2: 'Include escrow ID in transaction memo',
        step3: 'Broker will mint NFT using creator credentials',
        step4: 'Broker creates 0 XRP offer for you to accept',
        step5: 'NFT transfers to you automatically'
      },
      payment: {
        brokerAddress: BROKER_WALLET_ADDRESS,
        totalAmountXrp: (totalAmountDrops / 1_000_000).toFixed(6),
        mintCostXrp: (mintCostDrops / 1_000_000).toFixed(6),
        brokerFeeXrp: (brokerFeeDrops / 1_000_000).toFixed(6),
        brokerFeePercentage: BROKER_FEE_PERCENTAGE,
        memo: JSON.stringify({
          escrowId,
          platformType: 'external',
          buyerAddress,
          buyerHandle: user.handle
        })
      },
      timeline: {
        step1: 'Your payment detected - Escrow created',
        step2: 'Broker mints NFT using creator credentials',
        step3: 'Broker creates 0 XRP sell offer to you',
        step4: 'You accept offer - NFT transferred',
        step5: 'Creator receives payment automatically'
      }
    });

  } catch (error) {
    console.error('❌ [EXTERNAL MINT ESCROW] Error:', error);
    res.status(500).json({ 
      error: 'Failed to initiate external mint escrow',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get external mint escrow status
 * GET /api/broker/mint/external/status/:escrowId
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
        buyerAddress: escrow.buyerAddress,
        mintCost: escrow.mintCost,
        brokerFee: escrow.brokerFee,
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
    console.error('❌ [EXTERNAL MINT ESCROW] Status error:', error);
    res.status(500).json({ 
      error: 'Failed to get escrow status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Cancel external mint escrow (before minting)
 * POST /api/broker/mint/external/cancel/:escrowId
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

    console.log(`🚫 [EXTERNAL MINT ESCROW] Cancelled escrow ${escrowId}`);

    res.json({
      success: true,
      message: 'Escrow cancelled successfully',
      refundRequired: !!escrow.paymentTxHash
    });

  } catch (error) {
    console.error('❌ [EXTERNAL MINT ESCROW] Cancel error:', error);
    res.status(500).json({ 
      error: 'Failed to cancel escrow',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
