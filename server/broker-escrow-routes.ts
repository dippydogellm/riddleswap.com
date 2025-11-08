import { Express, Request, Response } from 'express';
import { requireAuthentication, AuthenticatedRequest } from './middleware/session-auth';
import { db } from './db';
import { brokerEscrow } from '../shared/nft-schema';
import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';

const BROKER_WALLET_ADDRESS = process.env.BROKER_WALLET_ADDRESS;
const BROKER_FEE_PERCENTAGE = 1.589;

export function registerBrokerEscrowRoutes(app: Express) {
  console.log('🏦 Registering Automated Broker Escrow routes...');

  /**
   * Initiate automated escrow purchase
   * Returns broker payment address and amount including fee
   */
  app.post('/api/broker/escrow/initiate', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user;
      if (!user?.handle) {
        return res.status(401).json({ error: 'Unauthorized - no session found' });
      }

      const { nftTokenId, nftOwner, buyerAddress, buyerOfferIndex, offerAmountXrp } = req.body;

      if (!nftTokenId || !nftOwner || !buyerAddress || !buyerOfferIndex || !offerAmountXrp) {
        return res.status(400).json({ 
          error: 'Missing required fields: nftTokenId, nftOwner, buyerAddress, buyerOfferIndex, offerAmountXrp' 
        });
      }

      if (!BROKER_WALLET_ADDRESS) {
        return res.status(503).json({ 
          error: 'Broker service not configured',
          message: 'Automated escrow system is temporarily unavailable'
        });
      }

      // Calculate total amount including broker fee
      const offerAmount = parseFloat(offerAmountXrp);
      const brokerFee = offerAmount * (BROKER_FEE_PERCENTAGE / 100);
      const totalAmount = offerAmount + brokerFee;

      console.log(`💰 [ESCROW INIT] Buyer ${buyerAddress} wants to purchase NFT ${nftTokenId} for ${offerAmount} XRP (total: ${totalAmount} XRP with fee)`);

      res.json({
        success: true,
        instructions: {
          step1: `Send ${totalAmount.toFixed(6)} XRP to broker wallet`,
          step2: 'Include NFT info in transaction memo',
          step3: 'Broker will automatically create offer to owner',
          step4: 'Once owner accepts, NFT transfers to you automatically'
        },
        payment: {
          brokerAddress: BROKER_WALLET_ADDRESS,
          totalAmountXrp: totalAmount.toFixed(6),
          offerAmountXrp: offerAmount.toFixed(6),
          brokerFeeXrp: brokerFee.toFixed(6),
          brokerFeePercentage: BROKER_FEE_PERCENTAGE,
          memo: JSON.stringify({
            nftTokenId,
            nftOwner,
            buyerAddress,
            buyerOfferIndex,
            buyerHandle: user.handle
          })
        },
        timeline: {
          step1: 'Your payment detected → Escrow created',
          step2: 'Broker creates offer to NFT owner',
          step3: 'Owner accepts → NFT transfers to you',
          step4: 'Seller receives payment automatically'
        },
        cancellation: {
          info: 'Cancel your offer anytime before owner accepts',
          refund: 'Full refund including broker fee if cancelled'
        }
      });

    } catch (error) {
      console.error('❌ [ESCROW INIT] Error:', error);
      res.status(500).json({ 
        error: 'Failed to initiate escrow',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Initiate SELL escrow purchase (seller has stagnant offer)
   * Returns broker payment address and amount including fee
   */
  app.post('/api/broker/escrow/initiate-sell', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user;
      if (!user?.handle) {
        return res.status(401).json({ error: 'Unauthorized - no session found' });
      }

      const { nftTokenId, nftOwner, buyerAddress, buyerOfferIndex, sellerOfferIndex, offerAmountXrp } = req.body;

      if (!nftTokenId || !nftOwner || !buyerAddress || !buyerOfferIndex || !sellerOfferIndex || !offerAmountXrp) {
        return res.status(400).json({ 
          error: 'Missing required fields: nftTokenId, nftOwner, buyerAddress, buyerOfferIndex, sellerOfferIndex, offerAmountXrp' 
        });
      }

      if (!BROKER_WALLET_ADDRESS) {
        return res.status(503).json({ 
          error: 'Broker service not configured',
          message: 'Automated escrow system is temporarily unavailable'
        });
      }

      // Calculate total amount including broker fee
      const offerAmount = parseFloat(offerAmountXrp);
      const brokerFee = offerAmount * (BROKER_FEE_PERCENTAGE / 100);
      const totalAmount = offerAmount + brokerFee;

      console.log(`🛒 [SELL ESCROW INIT] Buyer ${buyerAddress} wants to purchase NFT ${nftTokenId} for ${offerAmount} XRP (total: ${totalAmount} XRP with fee)`);

      res.json({
        success: true,
        escrowType: 'sell',
        instructions: {
          step1: `Send ${totalAmount.toFixed(6)} XRP to broker wallet`,
          step2: 'Include NFT info in transaction memo',
          step3: 'Broker will automatically accept seller offer',
          step4: 'NFT transfers to you automatically using your buy offer'
        },
        payment: {
          brokerAddress: BROKER_WALLET_ADDRESS,
          totalAmountXrp: totalAmount.toFixed(6),
          offerAmountXrp: offerAmount.toFixed(6),
          brokerFeeXrp: brokerFee.toFixed(6),
          brokerFeePercentage: BROKER_FEE_PERCENTAGE,
          memo: JSON.stringify({
            nftTokenId,
            nftOwner,
            buyerAddress,
            buyerOfferIndex,
            sellerOfferIndex, // Seller's stagnant sell offer
            buyerHandle: user.handle
          })
        },
        timeline: {
          step1: 'Your payment detected - Escrow created',
          step2: 'Broker accepts seller sell offer - NFT to broker',
          step3: 'Broker accepts your buy offer - NFT to you',
          step4: 'Seller receives payment automatically'
        }
      });

    } catch (error) {
      console.error('❌ [SELL ESCROW INIT] Error:', error);
      res.status(500).json({ 
        error: 'Failed to initiate sell escrow',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get escrow status for buyer
   */
  app.get('/api/broker/escrow/status/:nftTokenId', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user;
      if (!user?.handle) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { nftTokenId } = req.params;
      const userAddress = req.query.address as string;

      if (!userAddress) {
        return res.status(400).json({ error: 'Missing address parameter' });
      }

      // Find escrow for this NFT and buyer
      const escrows = await db.query.brokerEscrow.findMany({
        where: eq(brokerEscrow.nftTokenId, nftTokenId)
      });

      const userEscrow = escrows.find(e => e.userAddress === userAddress);

      if (!userEscrow) {
        return res.json({
          hasEscrow: false,
          status: 'none'
        });
      }

      res.json({
        hasEscrow: true,
        status: userEscrow.status,
        escrow: {
          id: userEscrow.id,
          nftTokenId: userEscrow.nftTokenId,
          escrowAmount: (parseFloat(userEscrow.escrowAmount) / 1000000).toFixed(6),
          brokerFee: (parseFloat(userEscrow.brokerFee) / 1000000).toFixed(6),
          sellerAmount: (parseFloat(userEscrow.sellerAmount) / 1000000).toFixed(6),
          status: userEscrow.status,
          createdAt: userEscrow.createdAt,
          paymentTxHash: userEscrow.paymentTxHash,
          brokerOfferIndex: userEscrow.brokerOfferIndex,
          acceptedAt: userEscrow.acceptedAt,
          nftTransferredAt: userEscrow.nftTransferredAt,
          refundedAt: userEscrow.refundedAt,
          cancellationReason: userEscrow.cancellationReason
        }
      });

    } catch (error) {
      console.error('❌ [ESCROW STATUS] Error:', error);
      res.status(500).json({ error: 'Failed to fetch escrow status' });
    }
  });

  /**
   * Get all user's escrow transactions
   */
  app.get('/api/broker/escrow/my-escrows', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user;
      if (!user?.handle) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const userAddress = req.query.address as string;

      if (!userAddress) {
        return res.status(400).json({ error: 'Missing address parameter' });
      }

      const escrows = await db.query.brokerEscrow.findMany({
        where: eq(brokerEscrow.userAddress, userAddress),
        orderBy: (brokerEscrow, { desc }) => [desc(brokerEscrow.createdAt)]
      });

      res.json({
        count: escrows.length,
        escrows: escrows.map(e => ({
          id: e.id,
          nftTokenId: e.nftTokenId,
          nftOwner: e.nftOwner,
          escrowAmount: (parseFloat(e.escrowAmount) / 1000000).toFixed(6),
          brokerFee: (parseFloat(e.brokerFee) / 1000000).toFixed(6),
          sellerAmount: (parseFloat(e.sellerAmount) / 1000000).toFixed(6),
          status: e.status,
          createdAt: e.createdAt,
          paymentTxHash: e.paymentTxHash,
          brokerOfferIndex: e.brokerOfferIndex,
          acceptedAt: e.acceptedAt,
          nftTransferredAt: e.nftTransferredAt,
          refundedAt: e.refundedAt,
          cancellationReason: e.cancellationReason
        }))
      });

    } catch (error) {
      console.error('❌ [MY ESCROWS] Error:', error);
      res.status(500).json({ error: 'Failed to fetch escrows' });
    }
  });

  /**
   * Get broker monitor status
   */
  app.get('/api/broker/monitor/status', async (req: Request, res: Response) => {
    try {
      const { getBrokerMonitorStatus } = await import('./broker-monitor');
      const status = getBrokerMonitorStatus();

      res.json({
        ...status,
        automated: status.enabled,
        message: status.enabled 
          ? 'Automated broker system is active and monitoring blockchain' 
          : 'Automated broker system is offline - manual mode only'
      });

    } catch (error) {
      res.json({
        enabled: false,
        connected: false,
        automated: false,
        message: 'Broker monitor not available'
      });
    }
  });

  console.log('✅ Automated Broker Escrow routes registered');
}
