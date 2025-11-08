// Bridge Transaction Verification Routes
import { Router } from 'express';
import { z } from 'zod';
import { bridgeVerificationService } from '../bridge-verification';
import { db } from '../db';
import { bridge_payloads } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// Remove individual CORS middleware - rely on global configuration

// Schema for verification request
const verifyTransactionSchema = z.object({
  transactionId: z.string().uuid(),
  txHash: z.string().min(1)
});

const manualVerifySchema = z.object({
  txHash: z.string().min(1),
  chain: z.enum(['XRPL', 'SOLANA', 'BITCOIN'])
});

// Verify bridge transaction status
router.post('/verify-transaction', async (req, res) => {
  try {
    const { transactionId, txHash } = verifyTransactionSchema.parse(req.body);

    console.log(`🔍 Verifying bridge transaction: ${transactionId}`);

    // Get bridge payload from database
    const [bridgePayload] = await db
      .select()
      .from(bridge_payloads)
      .where(eq(bridge_payloads.transaction_id, transactionId));

    if (!bridgePayload) {
      return res.status(404).json({
        success: false,
        error: 'Bridge transaction not found'
      });
    }

    // Determine chain type from bridge payload
    let chain: 'XRPL' | 'SOLANA' | 'BITCOIN';
    if (bridgePayload.from_token === 'XRP') {
      chain = 'XRPL';
    } else if (bridgePayload.from_token === 'SOL') {
      chain = 'SOLANA';
    } else if (bridgePayload.from_token === 'BTC') {
      chain = 'BITCOIN';
    } else {
      return res.status(400).json({
        success: false,
        error: 'Unsupported chain for verification'
      });
    }

    // Verify on blockchain
    const verification = await bridgeVerificationService.verifyTransaction(txHash, chain);
    const confirmations = await bridgeVerificationService.getConfirmations(txHash, chain);
    const isSafe = verification.verified && confirmations >= (chain === 'SOLANA' ? 32 : 1);

    // Update database with verification result
    if (verification.verified) {
      await db
        .update(bridge_payloads)
        .set({ 
          verification_status: isSafe ? 'verified' : 'pending_confirmations',
          block_height: verification.blockNumber?.toString(),
          confirmations: confirmations,
          verified_at: new Date()
         } as any)
        .where(eq(bridge_payloads.transaction_id, transactionId));
    }

    res.json({
      success: true,
      verification: {
        ...verification,
        isSafe,
        transactionId,
        chain,
        minConfirmationsRequired: chain === 'XRPL' ? 1 : chain === 'SOLANA' ? 32 : 1
      }
    });

  } catch (error: any) {
    console.error('Transaction verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Verification failed',
      details: error.message
    });
  }
});


// Get verification status for a transaction
router.get('/status/:transactionId', async (req, res) => {
  try {
    const { transactionId } = req.params;

    const [bridgePayload] = await db
      .select()
      .from(bridge_payloads)
      .where(eq(bridge_payloads.transaction_id, transactionId));

    if (!bridgePayload) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }

    res.json({
      success: true,
      status: {
        transactionId,
        status: bridgePayload.status,
        verificationStatus: bridgePayload.verification_status,
        blockHeight: bridgePayload.block_height,
        confirmations: bridgePayload.confirmations,
        txHash: bridgePayload.tx_hash,
        verifiedAt: bridgePayload.verified_at,
        createdAt: bridgePayload.createdAt
      }
    });

  } catch (error: any) {
    console.error('Status check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get transaction status'
    });
  }
});

export { router as verificationRoutes };