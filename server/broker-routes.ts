import { Express, Request, Response } from 'express';
import { getBrokerService, initializeBrokerService, BROKER_FEE_CONFIG } from './broker-nft';
import { requireAuthentication, AuthenticatedRequest } from './middleware/session-auth';
import { requireAdminAccess } from './middleware/admin-auth';
import { db } from './db';
import { brokerNftSales, feeTransactions, rewards } from '../shared/schema';
import { eq, desc, sql } from 'drizzle-orm';
import * as xrpl from 'xrpl';

export async function registerBrokerRoutes(app: Express) {
  console.log('🏦 Registering NFT Broker routes...');
  
  // Import broker offer service functions
  const brokerOfferService = await import('./broker-offer-service');

  try {
    const broker = initializeBrokerService();
    console.log(`✅ Broker initialized at address: ${broker.getAddress()}`);
  } catch (error) {
    console.error('❌ Failed to initialize broker:', error);
    throw error;
  }

  app.get('/api/broker/info', async (req: Request, res: Response) => {
    try {
      const broker = getBrokerService();
      
      try {
        const balance = await broker.getBrokerBalance();
        
        res.json({
          address: broker.getAddress(),
          balance: {
            xrp: balance.xrp,
            drops: balance.dropsRaw
          },
          status: 'active'
        });
      } catch (balanceError: any) {
        if (balanceError?.data?.error === 'actNotFound') {
          res.json({
            address: broker.getAddress(),
            balance: {
              xrp: '0',
              drops: '0'
            },
            status: 'unfunded',
            message: 'Broker account needs to be funded with at least 10 XRP to activate'
          });
        } else {
          throw balanceError;
        }
      }
    } catch (error) {
      console.error('❌ Error fetching broker info:', error);
      res.status(500).json({ 
        error: 'Failed to fetch broker information',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get('/api/broker/nfts', async (req: Request, res: Response) => {
    try {
      const broker = getBrokerService();
      
      try {
        const nfts = await broker.getBrokerNFTs();
        
        res.json({
          count: nfts.length,
          nfts
        });
      } catch (nftsError: any) {
        if (nftsError?.data?.error === 'actNotFound') {
          res.json({
            count: 0,
            nfts: [],
            status: 'unfunded',
            message: 'Broker account not yet activated. Fund with 10+ XRP first.'
          });
        } else {
          throw nftsError;
        }
      }
    } catch (error) {
      console.error('❌ Error fetching broker NFTs:', error);
      res.status(500).json({ 
        error: 'Failed to fetch broker NFTs',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post('/api/broker/nft/:nftId/create-sell-offer', requireAdminAccess, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { nftId } = req.params;
      const { priceXrp, destination } = req.body;

      if (!nftId || !/^[A-F0-9]{64}$/i.test(nftId)) {
        return res.status(400).json({ error: 'Invalid NFT ID format' });
      }

      if (!priceXrp || isNaN(Number(priceXrp)) || Number(priceXrp) <= 0) {
        return res.status(400).json({ error: 'Invalid price' });
      }

      if (destination && !/^r[a-zA-Z0-9]{24,34}$/.test(destination)) {
        return res.status(400).json({ error: 'Invalid destination address' });
      }

      const broker = getBrokerService();
      const offer = await broker.createSellOffer(nftId, priceXrp, destination);

      res.json({
        success: true,
        offer
      });
    } catch (error) {
      console.error('❌ Error creating sell offer:', error);
      res.status(500).json({ 
        error: 'Failed to create sell offer',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post('/api/broker/buy/:nftId', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { nftId } = req.params;
      const { buyOfferId } = req.body;

      if (!nftId || !/^[A-F0-9]{64}$/i.test(nftId)) {
        return res.status(400).json({ error: 'Invalid NFT ID format' });
      }

      if (!buyOfferId) {
        return res.status(400).json({ error: 'Buy offer ID is required' });
      }

      const broker = getBrokerService();
      const txHash = await broker.acceptBuyOffer(buyOfferId, nftId);

      res.json({
        success: true,
        txHash,
        message: 'NFT purchase successful'
      });
    } catch (error) {
      console.error('❌ Error processing purchase:', error);
      res.status(500).json({ 
        error: 'Failed to process purchase',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get('/api/broker/nft/:nftId/buy-offers', async (req: Request, res: Response) => {
    try {
      const { nftId } = req.params;

      if (!nftId || !/^[A-F0-9]{64}$/i.test(nftId)) {
        return res.status(400).json({ error: 'Invalid NFT ID format' });
      }

      const broker = getBrokerService();
      const offers = await broker.getBuyOffersForNFT(nftId);

      res.json({
        nftId,
        offers,
        count: offers.length
      });
    } catch (error) {
      console.error('❌ Error fetching buy offers:', error);
      res.status(500).json({ 
        error: 'Failed to fetch buy offers',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post('/api/broker/create-buy-offer', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { nftId, offerAmountXrp, nftOwner } = req.body;

      if (!nftId || !offerAmountXrp || !nftOwner) {
        return res.status(400).json({ error: 'Missing required fields: nftId, offerAmountXrp, nftOwner' });
      }

      const user = req.user as any;
      if (!user?.cachedKeys?.xrpPrivateKey) {
        return res.status(400).json({ error: 'XRP wallet not found. Please log in again.' });
      }

      const { Wallet } = await import('xrpl');
      const buyerWallet = Wallet.fromSeed(user.cachedKeys.xrpPrivateKey);

      const broker = getBrokerService();
      const result = await broker.createBrokerDirectedBuyOffer(
        buyerWallet,
        nftId,
        offerAmountXrp,
        nftOwner
      );

      if (result.success) {
        res.json({
          success: true,
          offerId: result.offerId,
          txHash: result.txHash,
          message: `Buy offer created for ${offerAmountXrp} XRP. Funds reserved on-chain.`,
          explorerUrl: `https://livenet.xrpl.org/transactions/${result.txHash}`
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('❌ Error creating buy offer:', error);
      res.status(500).json({ 
        error: 'Failed to create buy offer',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post('/api/broker/create-sell-offer', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { nftId, askPriceXrp } = req.body;

      if (!nftId || !askPriceXrp) {
        return res.status(400).json({ error: 'Missing required fields: nftId, askPriceXrp' });
      }

      const user = req.user as any;
      if (!user?.cachedKeys?.xrpPrivateKey) {
        return res.status(400).json({ error: 'XRP wallet not found. Please log in again.' });
      }

      const { Wallet } = await import('xrpl');
      const sellerWallet = Wallet.fromSeed(user.cachedKeys.xrpPrivateKey);

      const broker = getBrokerService();
      const result = await broker.createBrokerDirectedSellOffer(
        sellerWallet,
        nftId,
        askPriceXrp
      );

      if (result.success) {
        res.json({
          success: true,
          offerId: result.offerId,
          txHash: result.txHash,
          message: `Sell offer created for ${askPriceXrp} XRP minimum.`,
          explorerUrl: `https://livenet.xrpl.org/transactions/${result.txHash}`
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('❌ Error creating sell offer:', error);
      res.status(500).json({ 
        error: 'Failed to create sell offer',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post('/api/broker/seller-accept-offer', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { buyOfferId, nftId, askPriceXrp } = req.body;

      if (!buyOfferId || !nftId || !askPriceXrp) {
        return res.status(400).json({ error: 'Missing required fields: buyOfferId, nftId, askPriceXrp' });
      }

      const user = req.user as any;
      if (!user?.cachedKeys?.xrpPrivateKey) {
        return res.status(400).json({ error: 'XRP wallet not found. Please log in again.' });
      }

      const { Wallet } = await import('xrpl');
      const sellerWallet = Wallet.fromSeed(user.cachedKeys.xrpPrivateKey);

      const broker = getBrokerService();
      
      console.log(`🎯 [AUTO-MATCH] Seller accepting offer: ${buyOfferId}`);
      
      const buyOffers = await broker.getBuyOffersForNFT(nftId);
      const buyOffer = buyOffers.find(o => o.nft_offer_index === buyOfferId);
      
      if (!buyOffer) {
        return res.status(404).json({ error: 'Buy offer not found on XRPL' });
      }

      const { dropsToXrp } = await import('xrpl');
      const buyOfferAmount = buyOffer.amount as string | number;
      const buyOfferXrp = dropsToXrp(buyOfferAmount);
      const sellerAskPriceXrp = parseFloat(askPriceXrp);
      
      if (sellerAskPriceXrp > buyOfferXrp) {
        return res.status(400).json({ 
          error: `Your ask price (${sellerAskPriceXrp} XRP) exceeds buyer's offer (${buyOfferXrp} XRP)` 
        });
      }

      if (buyOfferXrp <= BROKER_FEE_CONFIG.minimumFeeXrp) {
        return res.status(400).json({ 
          error: `Buy offer too low. Minimum ${BROKER_FEE_CONFIG.minimumFeeXrp} XRP required to cover broker fee.` 
        });
      }

      let finalSellPrice = sellerAskPriceXrp;
      let brokerFeeXrp = 0;

      if (sellerAskPriceXrp === buyOfferXrp) {
        brokerFeeXrp = buyOfferXrp * (BROKER_FEE_CONFIG.feePercentage / 100);
        brokerFeeXrp = Math.max(brokerFeeXrp, BROKER_FEE_CONFIG.minimumFeeXrp);
        finalSellPrice = buyOfferXrp - brokerFeeXrp;
        
        console.log(`📊 [AUTO-DISCOUNT] Seller accepted at full price - auto-discounting sell offer:`);
        console.log(`   Buyer offers: ${buyOfferXrp} XRP`);
        console.log(`   Broker fee: ${brokerFeeXrp} XRP (${BROKER_FEE_CONFIG.feePercentage}%)`);
        console.log(`   Seller receives: ${finalSellPrice} XRP`);
      } else {
        brokerFeeXrp = BROKER_FEE_CONFIG.calculateBrokerFee(buyOfferXrp, sellerAskPriceXrp);
        finalSellPrice = sellerAskPriceXrp;
      }

      console.log(`💰 [AUTO-MATCH] Fee breakdown:`, {
        buyerPays: buyOfferXrp,
        sellerAsks: sellerAskPriceXrp,
        finalSellPrice,
        brokerFee: brokerFeeXrp,
        feePercentage: BROKER_FEE_CONFIG.feePercentage
      });

      const sellOfferResult = await broker.createBrokerDirectedSellOffer(
        sellerWallet,
        nftId,
        finalSellPrice.toString()
      );

      if (!sellOfferResult.success) {
        return res.status(500).json({
          success: false,
          error: `Failed to create sell offer: ${sellOfferResult.error}`
        });
      }

      const matchResult = await broker.matchBrokerOffers(
        buyOfferId,
        sellOfferResult.offerId!,
        brokerFeeXrp.toString()
      );

      if (matchResult.success) {
        res.json({
          success: true,
          sellOfferId: sellOfferResult.offerId,
          matchTxHash: matchResult.txHash,
          brokerFee: brokerFeeXrp,
          message: `Offer accepted! Broker fee: ${brokerFeeXrp} XRP (${BROKER_FEE_CONFIG.feePercentage}%). Royalties distributed automatically.`,
          explorerUrl: `https://livenet.xrpl.org/transactions/${matchResult.txHash}`
        });
      } else {
        res.status(500).json({
          success: false,
          error: matchResult.error
        });
      }
    } catch (error) {
      console.error('❌ Error in seller accept:', error);
      res.status(500).json({ 
        error: 'Failed to accept offer',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post('/api/broker/match-offers', requireAdminAccess, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { buyOfferId, sellOfferId, brokerFeeXrp } = req.body;

      if (!buyOfferId || !sellOfferId) {
        return res.status(400).json({ error: 'Both buy and sell offer IDs are required' });
      }

      if (!brokerFeeXrp || isNaN(Number(brokerFeeXrp)) || Number(brokerFeeXrp) < 0) {
        return res.status(400).json({ error: 'Valid broker fee is required' });
      }

      const broker = getBrokerService();
      const result = await broker.matchBrokerOffers(buyOfferId, sellOfferId, brokerFeeXrp);

      if (result.success) {
        res.json({
          success: true,
          txHash: result.txHash,
          message: `Offers matched successfully. Broker collected ${brokerFeeXrp} XRP`
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('❌ Error matching offers:', error);
      res.status(500).json({ 
        error: 'Failed to match offers',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get('/api/broker/nft/:nftId/sell-offers', async (req: Request, res: Response) => {
    try {
      const { nftId } = req.params;

      if (!nftId || !/^[A-F0-9]{64}$/i.test(nftId)) {
        return res.status(400).json({ error: 'Invalid NFT ID format' });
      }

      const broker = getBrokerService();
      const offers = await broker.getSellOffersForNFT(nftId);

      res.json({
        nftId,
        offers,
        count: offers.length
      });
    } catch (error) {
      console.error('❌ Error fetching sell offers:', error);
      res.status(500).json({ 
        error: 'Failed to fetch sell offers',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.delete('/api/broker/offer/:offerId/cancel', requireAdminAccess, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { offerId } = req.params;

      if (!offerId) {
        return res.status(400).json({ error: 'Offer ID is required' });
      }

      const broker = getBrokerService();
      const txHash = await broker.cancelSellOffer(offerId);

      res.json({
        success: true,
        txHash,
        message: 'Sell offer cancelled successfully'
      });
    } catch (error) {
      console.error('❌ Error cancelling offer:', error);
      res.status(500).json({ 
        error: 'Failed to cancel offer',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ====================================
  // ESCROW PAYMENT SYSTEM
  // ====================================

  // Step 1: Initiate escrow payment - prepares unsigned payment transaction to broker
  app.post('/api/broker/escrow/initiate', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { nftTokenId, offerAmountXrp, nftOwner, message } = req.body;

      if (!nftTokenId || !offerAmountXrp || !nftOwner) {
        return res.status(400).json({ error: 'Missing required fields: nftTokenId, offerAmountXrp, nftOwner' });
      }

      const user = req.user as any;
      if (!user?.address) {
        return res.status(400).json({ error: 'User address not found. Please log in again.' });
      }

      const broker = getBrokerService();
      const brokerAddress = broker.getAddress();

      // Calculate fees
      const amount = parseFloat(offerAmountXrp);
      const brokerFee = amount * (BROKER_FEE_CONFIG.feePercentage / 100);
      const finalBrokerFee = Math.max(brokerFee, BROKER_FEE_CONFIG.minimumFeeXrp);
      const sellerAmount = amount - finalBrokerFee;

      // Create escrow record
      const { storage } = await import('./storage');
      const { brokerEscrow } = await import('../shared/schema');
      const { randomUUID } = await import('crypto');
      
      const escrowId = randomUUID();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await db.insert(brokerEscrow).values({
        id: escrowId,
        userAddress: user.address,
        userHandle: user.handle,
        nftTokenId,
        nftOwner,
        escrowAmount: (amount * 1_000_000 as any).toString(), // drops
        brokerFee: (finalBrokerFee * 1_000_000).toString(),
        sellerAmount: (sellerAmount * 1_000_000).toString(),
        status: 'pending',
        message,
        expiresAt
      } as any);

      // Prepare unsigned payment transaction
      const { xrpToDrops } = await import('xrpl');
      const drops = xrpToDrops(offerAmountXrp);

      res.json({
        success: true,
        escrowId,
        brokerAddress,
        amount: offerAmountXrp,
        amountDrops: drops,
        fees: {
          brokerFee: finalBrokerFee,
          sellerReceives: sellerAmount
        },
        expiresAt,
        message: 'Escrow initiated. Please send payment to broker address.'
      });
    } catch (error) {
      console.error('❌ Error initiating escrow:', error);
      res.status(500).json({ 
        error: 'Failed to initiate escrow',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Step 2: Confirm escrow payment received and create broker offer
  app.post('/api/broker/escrow/:escrowId/confirm', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { escrowId } = req.params;
      const { txHash } = req.body;

      if (!txHash) {
        return res.status(400).json({ error: 'Transaction hash required' });
      }

      const { storage } = await import('./storage');
      const { brokerEscrow } = await import('../shared/schema');
      const { eq } = await import('drizzle-orm');

      // Get escrow record
      const [escrow] = await db.select().from(brokerEscrow).where(eq(brokerEscrow.id, escrowId));

      if (!escrow) {
        return res.status(404).json({ error: 'Escrow not found' });
      }

      if (escrow.status !== 'pending') {
        return res.status(400).json({ error: `Escrow already ${escrow.status}` });
      }

      // Verify payment on XRPL
      const { Client } = await import('xrpl');
      const client = new Client('wss://s1.ripple.com');
      await client.connect();

      try {
        const tx = await client.request({
          command: 'tx',
          transaction: txHash
        });

        // Validate payment
        const broker = getBrokerService();
        const brokerAddress = broker.getAddress();

        const txData = (tx.result.tx_json || tx.result) as any;

        if (txData['TransactionType'] !== 'Payment') {
          return res.status(400).json({ error: 'Not a payment transaction' });
        }

        if (txData['Destination'] !== brokerAddress) {
          return res.status(400).json({ error: 'Payment not sent to broker address' });
        }

        if (txData['Account'] !== escrow.userAddress) {
          return res.status(400).json({ error: 'Payment not from escrow user' });
        }

        const paidAmount = txData['Amount'] as string;
        if (paidAmount !== escrow.escrowAmount) {
          return res.status(400).json({ 
            error: `Incorrect amount. Expected ${escrow.escrowAmount} drops, received ${paidAmount} drops` 
          });
        }

        // Payment validated - update escrow
        await db.update(brokerEscrow)
          .set({ 
            paymentTxHash: txHash,
            paymentValidated: new Date(),
            status: 'escrow_received',
            updatedAt: new Date()
           } as any)
          .where(eq(brokerEscrow.id, escrowId));

        // Create broker buy offer to NFT owner
        const { dropsToXrp } = await import('xrpl');
        const offerAmountXrp = dropsToXrp(escrow.sellerAmount);
        
        const brokerOfferResult = await broker.createBuyOfferToOwner(
          escrow.nftTokenId,
          offerAmountXrp.toString(),
          escrow.nftOwner
        );

        if (!brokerOfferResult.success) {
          // Rollback escrow status
          await db.update(brokerEscrow)
            .set({  status: 'pending', updatedAt: new Date()  } as any)
            .where(eq(brokerEscrow.id, escrowId));

          return res.status(500).json({
            success: false,
            error: `Failed to create broker offer: ${brokerOfferResult.error}`
          });
        }

        // Update escrow with broker offer details
        await db.update(brokerEscrow)
          .set({ 
            brokerOfferIndex: brokerOfferResult.offerId,
            brokerOfferTxHash: brokerOfferResult.txHash,
            brokerOfferCreated: new Date(),
            status: 'offer_created',
            updatedAt: new Date()
           } as any)
          .where(eq(brokerEscrow.id, escrowId));

        res.json({
          success: true,
          paymentConfirmed: true,
          brokerOffer: {
            offerId: brokerOfferResult.offerId,
            txHash: brokerOfferResult.txHash,
            amount: offerAmountXrp
          },
          message: 'Payment confirmed. Broker offer created to NFT owner.',
          explorerUrl: `https://livenet.xrpl.org/transactions/${brokerOfferResult.txHash}`
        });

      } finally {
        await client.disconnect();
      }

    } catch (error) {
      console.error('❌ Error confirming escrow:', error);
      res.status(500).json({ 
        error: 'Failed to confirm escrow payment',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Step 3: Cancel escrow and refund (uses BROKER wallet keys only)
  app.post('/api/broker/escrow/:escrowId/cancel', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { escrowId } = req.params;
      const { reason } = req.body;

      const user = req.user as any;
      if (!user?.address) {
        return res.status(400).json({ error: 'User address not found. Please log in again.' });
      }

      const { storage } = await import('./storage');
      const { brokerEscrow } = await import('../shared/schema');
      const { eq } = await import('drizzle-orm');

      // Get escrow record
      const [escrow] = await db.select().from(brokerEscrow).where(eq(brokerEscrow.id, escrowId));

      if (!escrow) {
        return res.status(404).json({ error: 'Escrow not found' });
      }

      if (escrow.userAddress !== user.address) {
        return res.status(403).json({ error: 'Not authorized to cancel this escrow' });
      }

      if (!['pending', 'escrow_received', 'offer_created'].includes(escrow.status)) {
        return res.status(400).json({ error: `Cannot cancel escrow in ${escrow.status} status` });
      }

      const broker = getBrokerService();

      // If broker offer was created, cancel it first (uses broker wallet keys)
      if (escrow.brokerOfferIndex) {
        await broker.cancelBuyOffer(escrow.brokerOfferIndex);
      }

      // Refund escrow if payment was received (uses broker wallet keys)
      if (escrow.paymentTxHash) {
        const refundResult = await broker.refundEscrow(
          escrow.userAddress,
          escrow.escrowAmount
        );

        if (!refundResult.success) {
          return res.status(500).json({
            success: false,
            error: `Failed to refund escrow: ${refundResult.error}`
          });
        }

        // Update escrow record
        await db.update(brokerEscrow)
          .set({ 
            refundTxHash: refundResult.txHash,
            refundedAt: new Date(),
            cancellationReason: reason || 'User cancelled',
            status: 'refunded',
            updatedAt: new Date()
           } as any)
          .where(eq(brokerEscrow.id, escrowId));

        res.json({
          success: true,
          refunded: true,
          refundTxHash: refundResult.txHash,
          message: 'Escrow cancelled and funds refunded by broker.',
          explorerUrl: `https://livenet.xrpl.org/transactions/${refundResult.txHash}`
        });
      } else {
        // No payment received, just cancel
        await db.update(brokerEscrow)
          .set({ 
            cancellationReason: reason || 'User cancelled',
            status: 'cancelled',
            updatedAt: new Date()
           } as any)
          .where(eq(brokerEscrow.id, escrowId));

        res.json({
          success: true,
          message: 'Escrow cancelled.'
        });
      }

    } catch (error) {
      console.error('❌ Error cancelling escrow:', error);
      res.status(500).json({ 
        error: 'Failed to cancel escrow',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Step 4: Check escrow status and complete NFT transfer (uses BROKER wallet keys only)
  app.post('/api/broker/escrow/:escrowId/complete', async (req: Request, res: Response) => {
    try {
      const { escrowId } = req.params;

      const { storage } = await import('./storage');
      const { brokerEscrow } = await import('../shared/schema');
      const { eq } = await import('drizzle-orm');

      // Get escrow record
      const [escrow] = await db.select().from(brokerEscrow).where(eq(brokerEscrow.id, escrowId));

      if (!escrow) {
        return res.status(404).json({ error: 'Escrow not found' });
      }

      if (escrow.status !== 'offer_created') {
        return res.status(400).json({ error: `Cannot complete escrow in ${escrow.status} status` });
      }

      const broker = getBrokerService();

      // Check if broker received the NFT (owner accepted offer)
      const brokerNFTs = await broker.getBrokerNFTs();
      const receivedNFT = brokerNFTs.find((nft: any) => nft.NFTokenID === escrow.nftTokenId);

      if (!receivedNFT) {
        return res.status(400).json({ 
          error: 'NFT not yet received by broker. Owner has not accepted the offer yet.' 
        });
      }

      // Update escrow - mark as accepted
      await db.update(brokerEscrow)
        .set({ 
          acceptedAt: new Date(),
          status: 'offer_accepted',
          updatedAt: new Date()
         } as any)
        .where(eq(brokerEscrow.id, escrowId));

      // Transfer NFT from broker to original user (uses broker wallet keys)
      const transferResult = await broker.transferNFTToUser(
        escrow.nftTokenId,
        escrow.userAddress
      );

      if (!transferResult.success) {
        return res.status(500).json({
          success: false,
          error: `Failed to transfer NFT to user: ${transferResult.error}`
        });
      }

      // Update escrow - mark as completed
      await db.update(brokerEscrow)
        .set({ 
          nftTransferTxHash: transferResult.txHash,
          nftTransferredAt: new Date(),
          status: 'completed',
          updatedAt: new Date()
         } as any)
        .where(eq(brokerEscrow.id, escrowId));

      res.json({
        success: true,
        nftTransferred: true,
        transferTxHash: transferResult.txHash,
        message: 'Escrow completed! NFT transferred to buyer.',
        explorerUrl: `https://livenet.xrpl.org/transactions/${transferResult.txHash}`
      });

    } catch (error) {
      console.error('❌ Error completing escrow:', error);
      res.status(500).json({ 
        error: 'Failed to complete escrow',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get escrow status
  app.get('/api/broker/escrow/:escrowId', async (req: Request, res: Response) => {
    try {
      const { escrowId } = req.params;

      const { storage } = await import('./storage');
      const { brokerEscrow } = await import('../shared/schema');
      const { eq } = await import('drizzle-orm');

      const [escrow] = await db.select().from(brokerEscrow).where(eq(brokerEscrow.id, escrowId));

      if (!escrow) {
        return res.status(404).json({ error: 'Escrow not found' });
      }

      res.json({
        success: true,
        escrow
      });

    } catch (error) {
      console.error('❌ Error fetching escrow:', error);
      res.status(500).json({ 
        error: 'Failed to fetch escrow',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Buy Now - Buyer creates buy offer, broker matches with sell offer (session cache, no password)
  app.post('/api/broker/confirm-buy', requireAuthentication, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { nftTokenId, sellOfferIndex, buyPrice, nftOwner } = req.body;

      if (!nftTokenId || !sellOfferIndex || !buyPrice || !nftOwner) {
        return res.status(400).json({ 
          error: 'Missing required fields: nftTokenId, sellOfferIndex, buyPrice, nftOwner' 
        });
      }

      const user = req.user as any;
      if (!user?.handle) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      if (!user?.cachedKeys?.xrpPrivateKey) {
        return res.status(400).json({ error: 'XRP wallet keys not cached. Please log in again.' });
      }

      // Validate price
      const price = parseFloat(buyPrice);
      if (isNaN(price) || price <= 0) {
        return res.status(400).json({ error: 'Invalid price - must be a positive number' });
      }

      // Calculate broker fee (server-controlled, cannot be manipulated)
      const brokerFeeXrp = price * (BROKER_FEE_CONFIG.feePercentage / 100);
      const finalBrokerFee = Math.max(brokerFeeXrp, BROKER_FEE_CONFIG.minimumFeeXrp);
      
      console.log(`🛒 [BUY NOW] User ${user.handle} buying NFT ${nftTokenId}`);
      console.log(`💰 Price: ${price} XRP + ${finalBrokerFee.toFixed(6)} XRP broker fee`);
      console.log(`👤 NFT Owner: ${nftOwner}`);

      // Step 1: Buyer creates buy offer using session-cached keys
      const { Wallet } = await import('xrpl');
      const buyerWallet = Wallet.fromSeed(user.cachedKeys.xrpPrivateKey);
      
      const broker = getBrokerService();
      const buyOfferResult = await broker.createBrokerDirectedBuyOffer(
        buyerWallet,
        nftTokenId,
        buyPrice,
        nftOwner // NFT owner/seller
      );

      if (!buyOfferResult.success) {
        return res.status(500).json({
          success: false,
          error: buyOfferResult.error || 'Failed to create buy offer'
        });
      }

      console.log(`✅ [BUY NOW] Buy offer created: ${buyOfferResult.offerId}`);

      // Step 2: Broker matches buy offer with existing sell offer
      const matchResult = await broker.matchBrokerOffers(
        buyOfferResult.offerId!,
        sellOfferIndex,
        finalBrokerFee.toString()
      );

      if (matchResult.success) {
        console.log(`✅ [BUY NOW] Purchase complete - TX: ${matchResult.txHash}`);
        res.json({
          success: true,
          txHash: matchResult.txHash,
          message: `NFT purchased for ${price} XRP + ${finalBrokerFee.toFixed(6)} XRP broker fee`,
          explorerUrl: `https://livenet.xrpl.org/transactions/${matchResult.txHash}`
        });
      } else {
        console.error(`❌ [BUY NOW] Match failed: ${matchResult.error}`);
        res.status(500).json({
          success: false,
          error: matchResult.error || 'Failed to match offers'
        });
      }
    } catch (error) {
      console.error('❌ Error processing Buy Now:', error);
      res.status(500).json({ 
        error: 'Failed to process purchase',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // NEW: Create sell offer with broker restriction and fee injection
  app.post('/api/broker/nft/offers/create-sell-new',
    requireAuthentication,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { nftTokenId, priceXrp, expirationDays } = req.body;
        
        // Validate inputs
        if (!nftTokenId || !priceXrp) {
          return res.status(400).json({ 
            success: false, 
            error: 'NFT token ID and price are required' 
          });
        }
        
        // Get wallet seed from session
        const wallet = req.session.cachedXrplWallets?.find(w => w.address === req.user?.walletAddress);
        if (!wallet?.seed) {
          return res.status(400).json({ 
            success: false, 
            error: 'XRPL wallet not found. Please log in again.' 
          });
        }
        
        const result = await brokerOfferService.createBrokerSellOffer(
          wallet.seed,
          nftTokenId,
          priceXrp,
          expirationDays
        );
        
        if (result.success) {
          // Record in database
          await db.insert(brokerNftSales).values({
            nft_token_id: nftTokenId,
            seller_address: req.user!.walletAddress!,
            seller_handle: req.user!.handle!,
            sale_price: priceXrp.toString(),
            sell_offer_id: result.offerId,
            transaction_hash: result.txHash,
            status: 'listed'
          } as any);
        }
        
        res.json(result);
      } catch (error) {
        console.error('❌ Create sell offer failed:', error);
        res.status(500).json({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to create sell offer' 
        });
      }
    }
  );
  
  // NEW: Create buy offer with fee included
  app.post('/api/broker/nft/offers/create-buy-new',
    requireAuthentication,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { nftTokenId, ownerAddress, basePriceXrp, expirationDays } = req.body;
        
        // Validate inputs
        if (!nftTokenId || !ownerAddress || !basePriceXrp) {
          return res.status(400).json({ 
            success: false, 
            error: 'NFT token ID, owner address, and base price are required' 
          });
        }
        
        // Get wallet seed from session
        const wallet = req.session.cachedXrplWallets?.find(w => w.address === req.user?.walletAddress);
        if (!wallet?.seed) {
          return res.status(400).json({ 
            success: false, 
            error: 'XRPL wallet not found. Please log in again.' 
          });
        }
        
        const result = await brokerOfferService.createBrokerBuyOffer(
          wallet.seed,
          nftTokenId,
          ownerAddress,
          basePriceXrp,
          expirationDays
        );
        
        res.json(result);
      } catch (error) {
        console.error('❌ Create buy offer failed:', error);
        res.status(500).json({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to create buy offer' 
        });
      }
    }
  );
  
  // NEW: Accept brokered offers with fee injection
  app.post('/api/broker/nft/offers/accept-brokered',
    requireAdminAccess,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { 
          sellOfferId, 
          buyOfferId, 
          nftTokenId, 
          sellerAddress, 
          buyerAddress,
          sellerHandle,
          buyerHandle 
        } = req.body;
        
        // Validate inputs
        if (!sellOfferId || !buyOfferId || !nftTokenId || !sellerAddress || !buyerAddress) {
          return res.status(400).json({ 
            success: false, 
            error: 'Sell offer ID, buy offer ID, NFT token ID, and addresses are required' 
          });
        }
        
        const result = await brokerOfferService.acceptBrokeredOffers(
          sellOfferId,
          buyOfferId,
          nftTokenId,
          sellerAddress,
          buyerAddress,
          sellerHandle,
          buyerHandle
        );
        
        res.json(result);
      } catch (error) {
        console.error('❌ Accept brokered offers failed:', error);
        res.status(500).json({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to accept offers' 
        });
      }
    }
  );
  
  // NEW: Get NFT offers
  app.get('/api/broker/nft/offers/:nftTokenId',
    async (req: Request, res: Response) => {
      try {
        const { nftTokenId } = req.params;
        
        if (!nftTokenId) {
          return res.status(400).json({ 
            success: false, 
            error: 'NFT token ID is required' 
          });
        }
        
        const result = await brokerOfferService.getNFTOffers(nftTokenId);
        res.json(result);
      } catch (error) {
        console.error('❌ Get NFT offers failed:', error);
        res.status(500).json({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to get offers' 
        });
      }
    }
  );
  
  // NEW: Cancel NFT offer
  app.post('/api/broker/nft/offers/cancel',
    requireAuthentication,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { offerId } = req.body;
        
        if (!offerId) {
          return res.status(400).json({ 
            success: false, 
            error: 'Offer ID is required' 
          });
        }
        
        // Get wallet seed from session
        const wallet = req.session.cachedXrplWallets?.find(w => w.address === req.user?.walletAddress);
        if (!wallet?.seed) {
          return res.status(400).json({ 
            success: false, 
            error: 'XRPL wallet not found. Please log in again.' 
          });
        }
        
        const result = await brokerOfferService.cancelNFTOffer(wallet.seed, offerId);
        res.json(result);
      } catch (error) {
        console.error('❌ Cancel offer failed:', error);
        res.status(500).json({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to cancel offer' 
        });
      }
    }
  );
  
  // NEW: Buy Now - Immediate brokered purchase
  app.post('/api/broker/nft/offers/buy-now-brokered',
    requireAuthentication,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { nftTokenId, sellOfferId } = req.body;
        
        if (!nftTokenId || !sellOfferId) {
          return res.status(400).json({ 
            success: false, 
            error: 'NFT token ID and sell offer ID are required' 
          });
        }
        
        // Get buyer wallet from session
        const wallet = req.session.cachedXrplWallets?.find(w => w.address === req.user?.walletAddress);
        if (!wallet?.seed) {
          return res.status(400).json({ 
            success: false, 
            error: 'XRPL wallet not found. Please log in again.' 
          });
        }
        
        // Step 1: Get sell offer details
        const offers = await brokerOfferService.getNFTOffers(nftTokenId);
        const sellOffer = offers.sellOffers?.find((o: any) => o.nft_offer_index === sellOfferId);
        
        if (!sellOffer) {
          return res.status(404).json({ 
            success: false, 
            error: 'Sell offer not found' 
          });
        }
        
        const priceXrp = parseFloat(xrpl.dropsToXrp(String(sellOffer.amount)));
        
        // Step 2: Create buy offer with broker fee
        const buyOfferResult = await brokerOfferService.createBrokerBuyOffer(
          wallet.seed,
          nftTokenId,
          sellOffer.owner, // NFT owner address
          priceXrp,
          undefined // No expiration for immediate buy
        );
        
        if (!buyOfferResult.success) {
          return res.status(500).json(buyOfferResult);
        }
        
        // Step 3: Broker accepts both offers
        const brokerResult = await brokerOfferService.acceptBrokeredOffers(
          sellOfferId,
          buyOfferResult.offerId!,
          nftTokenId,
          sellOffer.owner, // Seller address
          req.user!.walletAddress!, // Buyer address
          undefined, // seller handle
          req.user!.handle // buyer handle
        );
        
        res.json(brokerResult);
      } catch (error) {
        console.error('❌ Buy now failed:', error);
        res.status(500).json({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to complete purchase' 
        });
      }
    }
  );

  // Broker transaction monitoring and reporting
  app.get('/api/broker/transactions',
    async (req: Request, res: Response) => {
      try {
        const { limit = 50, offset = 0, status } = req.query;
        
        // Build query
        let query: any = db
          .select()
          .from(brokerNftSales)
          .orderBy(desc(brokerNftSales.created_at))
          .limit(Number(limit))
          .offset(Number(offset));
        
        if (status && typeof status === 'string') {
          query = query.where(eq(brokerNftSales.status, status as any));
        }
        
        const transactions = await query;
        
        // Calculate total stats
        const stats = await db
          .select({
            total_sales: sql`count(*)::int`,
            total_volume: sql`sum(CAST(sale_price AS DECIMAL))`,
            total_fees_collected: sql`sum(CAST(broker_fee AS DECIMAL))`,
            completed_sales: sql`count(*) FILTER (WHERE status = 'completed')::int`,
            pending_sales: sql`count(*) FILTER (WHERE status = 'pending')::int`
          })
          .from(brokerNftSales);
        
        res.json({
          success: true,
          transactions,
          stats: stats[0] || {
            total_sales: 0,
            total_volume: 0,
            total_fees_collected: 0,
            completed_sales: 0,
            pending_sales: 0
          },
          pagination: {
            limit: Number(limit),
            offset: Number(offset),
            total: stats[0]?.total_sales || 0
          }
        });
      } catch (error) {
        console.error('❌ Error fetching broker transactions:', error);
        res.status(500).json({ 
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch transactions' 
        });
      }
    }
  );
  
  // Get broker stats
  app.get('/api/broker/stats',
    async (req: Request, res: Response) => {
      try {
        const timeFrame = req.query.timeFrame || '24h';
        
        let timeFilter = '';
        switch(timeFrame) {
          case '24h':
            timeFilter = "created_at > now() - interval '24 hours'";
            break;
          case '7d':
            timeFilter = "created_at > now() - interval '7 days'";
            break;
          case '30d':
            timeFilter = "created_at > now() - interval '30 days'";
            break;
          default:
            timeFilter = "1=1"; // All time
        }
        
        const stats = await db.execute(sql`
          SELECT 
            COUNT(*) as total_transactions,
            COUNT(DISTINCT nft_token_id) as unique_nfts,
            COUNT(DISTINCT seller_address) as unique_sellers,
            COUNT(DISTINCT buyer_address) as unique_buyers,
            SUM(CAST(sale_price AS DECIMAL)) as total_volume,
            SUM(CAST(broker_fee AS DECIMAL)) as total_fees,
            AVG(CAST(sale_price AS DECIMAL)) as avg_sale_price,
            MAX(CAST(sale_price AS DECIMAL)) as max_sale_price
          FROM broker_nft_sales
          WHERE ${sql.raw(timeFilter)}
        `);
        
        res.json({
          success: true,
          timeFrame,
          stats: stats.rows[0] || {
            total_transactions: 0,
            unique_nfts: 0,
            unique_sellers: 0,
            unique_buyers: 0,
            total_volume: 0,
            total_fees: 0,
            avg_sale_price: 0,
            max_sale_price: 0
          }
        });
      } catch (error) {
        console.error('❌ Error fetching broker stats:', error);
        res.status(500).json({ 
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch stats' 
        });
      }
    }
  );
  
  // Get user's broker transaction history
  app.get('/api/broker/my-transactions',
    requireAuthentication,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userAddress = req.user?.walletAddress;
        if (!userAddress) {
          return res.status(400).json({ 
            success: false, 
            error: 'User wallet address not found' 
          });
        }
        
        // Get transactions where user is buyer or seller
        const transactions = await db
          .select()
          .from(brokerNftSales)
          .where(
            sql`${brokerNftSales.seller_address} = ${userAddress} OR ${brokerNftSales.buyer_address} = ${userAddress}`
          )
          .orderBy(desc(brokerNftSales.created_at))
          .limit(100);
        
        // Calculate user stats
        const userStats = await db.execute(sql`
          SELECT 
            COUNT(*) FILTER (WHERE seller_address = ${userAddress}) as total_sales,
            COUNT(*) FILTER (WHERE buyer_address = ${userAddress}) as total_purchases,
            SUM(CASE WHEN seller_address = ${userAddress} THEN CAST(sale_price AS DECIMAL) ELSE 0 END) as total_earned,
            SUM(CASE WHEN buyer_address = ${userAddress} THEN CAST(total_amount AS DECIMAL) ELSE 0 END) as total_spent,
            SUM(CASE WHEN buyer_address = ${userAddress} THEN CAST(broker_fee AS DECIMAL) ELSE 0 END) as total_fees_paid
          FROM broker_nft_sales
          WHERE seller_address = ${userAddress} OR buyer_address = ${userAddress}
        `);
        
        res.json({
          success: true,
          transactions,
          userStats: userStats.rows[0] || {
            total_sales: 0,
            total_purchases: 0,
            total_earned: 0,
            total_spent: 0,
            total_fees_paid: 0
          }
        });
      } catch (error) {
        console.error('❌ Error fetching user transactions:', error);
        res.status(500).json({ 
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch user transactions' 
        });
      }
    }
  );

  console.log('✅ NFT Broker routes registered successfully');
}
