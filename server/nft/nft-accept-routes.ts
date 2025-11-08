import { Router, Request, Response } from 'express';
import { sessionAuth } from '../middleware/session-auth';
import { Client as XRPLClient, Wallet } from 'xrpl';
import { decryptWalletData } from '../wallet-encryption';
import { db } from '../db';
import { riddleWallets } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { RiddleNFTBroker } from '../riddle-nft-broker';
import { RIDDLE_BROKER_CONFIG } from '../payment-payloads';

const router = Router();

// Accept NFT Offer endpoint (with broker wallet support for brokered offers)
router.post('/offers/:offerId/accept', sessionAuth, async (req: Request, res: Response) => {
  try {
    const { offerId } = req.params;
    const { responseMessage } = req.body;
    const user = (req as any).user;

    if (!offerId) {
      return res.status(400).json({
        success: false,
        error: 'Offer ID is required'
      });
    }

    if (!user?.handle) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    // Use cached private keys from sessionAuth (same as payment endpoint)
    if (!user?.cachedKeys?.xrpPrivateKey) {
      return res.status(401).json({
        success: false,
        error: 'XRP wallet not found in session'
      });
    }

    const xrpPrivateKey = user.cachedKeys.xrpPrivateKey;

    // Create XRPL client to get offer details directly
    const client = new XRPLClient('wss://s1.ripple.com');
    
    try {
      await client.connect();
      
      // Get the specific offer details from XRPL ledger
      const offerRequest = await client.request({
        command: 'ledger_entry',
        index: offerId
      });

      if (!offerRequest.result || !offerRequest.result.node) {
        return res.status(404).json({
          success: false,
          error: 'Offer not found on ledger'
        });
      }

      const offer = offerRequest.result.node as any;
      const nftokenID = offer.NFTokenID;

      // Check if this is a brokered offer (directed to broker wallet)
      const brokerAddress = process.env.RIDDLE_BROKER_ADDRESS || RIDDLE_BROKER_CONFIG.brokerWallet;
      const isBrokeredOffer = offer.Destination === brokerAddress;

      if (isBrokeredOffer) {
        console.log(`🏦 [NFT ACCEPT] Brokered offer detected - finding complementary offer for settlement`);
        
        // Ensure we only handle XRP offers (drops)
        if (typeof offer.Amount !== 'string') {
          return res.status(400).json({
            success: false,
            error: 'Only XRP offers are supported for brokered settlement'
          });
        }

        // Validate offer flags are present
        if (typeof offer.Flags !== 'number') {
          return res.status(400).json({
            success: false,
            error: 'Invalid offer: missing or invalid flags'
          });
        }

        const offerAmountDrops = BigInt(offer.Amount);
        
        // Determine offer type using proper flag checking
        const isGivenOfferSell = (offer.Flags & 1) === 1;
        let buyOfferIndex = '';
        let sellOfferIndex = '';
        
        if (isGivenOfferSell) {
          sellOfferIndex = offerId;
          // Find a complementary buy offer with higher amount (room for broker fee)
          const buyOffersRequest = await client.request({
            command: 'nft_buy_offers',
            nft_id: nftokenID
          });
          
          const validBuyOffers = buyOffersRequest.result?.offers?.filter((buyOffer: any) => 
            buyOffer.destination === brokerAddress && 
            typeof buyOffer.amount === 'string' &&
            BigInt(buyOffer.amount) > offerAmountDrops  // Buy must be higher than sell for broker fee
          ).sort((a: any, b: any) => {
            const aBig = BigInt(a.amount);
            const bBig = BigInt(b.amount);
            return aBig > bBig ? -1 : aBig < bBig ? 1 : 0; // Highest first
          });
          
          if (!validBuyOffers || validBuyOffers.length === 0) {
            return res.status(400).json({
              success: false,
              error: 'No suitable buy offer found for brokered settlement (must be higher than sell price)'
            });
          }
          
          buyOfferIndex = validBuyOffers[0].nft_offer_index;
        } else {
          // Given offer is buy offer
          buyOfferIndex = offerId;
          // Find a complementary sell offer with lower amount (room for broker fee)
          const sellOffersRequest = await client.request({
            command: 'nft_sell_offers',
            nft_id: nftokenID
          });
          
          const validSellOffers = sellOffersRequest.result?.offers?.filter((sellOffer: any) => 
            sellOffer.destination === brokerAddress && 
            typeof sellOffer.amount === 'string' &&
            BigInt(sellOffer.amount) < offerAmountDrops  // Sell must be lower than buy for broker fee
          ).sort((a: any, b: any) => {
            const aBig = BigInt(a.amount);
            const bBig = BigInt(b.amount);
            return aBig < bBig ? -1 : aBig > bBig ? 1 : 0; // Lowest first
          });
          
          if (!validSellOffers || validSellOffers.length === 0) {
            return res.status(400).json({
              success: false,
              error: 'No suitable sell offer found for brokered settlement (must be lower than buy price)'
            });
          }
          
          sellOfferIndex = validSellOffers[0].nft_offer_index;
        }

        console.log(`🔄 [NFT ACCEPT] Found both offers - Buy: ${buyOfferIndex}, Sell: ${sellOfferIndex}`);
        
        // Initialize broker for brokered acceptance
        const broker = new RiddleNFTBroker({
          address: RIDDLE_BROKER_CONFIG.brokerWallet,
          secret: RIDDLE_BROKER_CONFIG.brokerSecret,
          nickname: 'RiddleNFTBroker'
        });
        
        try {
          await broker.connect();

          if (!broker.hasValidWallet()) {
            return res.status(503).json({
              success: false,
              error: 'Broker wallet not available'
            });
          }

          // Use broker to accept both offers with proper fee handling
          const result = await broker.brokerSale(sellOfferIndex, buyOfferIndex, nftokenID);

          if (result.success) {
            console.log(`✅ [NFT ACCEPT] Brokered offers accepted successfully: ${result.txHash}`);
            
            res.json({
              success: true,
              txHash: result.txHash,
              message: 'Brokered offers accepted successfully',
              brokered: true
            });
          } else {
            throw new Error(result.error || 'Failed to accept brokered offers');
          }
        } finally {
          // Always disconnect broker to prevent connection leaks
          await broker.disconnect();
        }
      } else {
        console.log(`🔄 [NFT ACCEPT] Direct offer - accepting with user wallet using cached private key`);
        
        // Direct offer acceptance (non-brokered) - use cached private key from session
        const acceptorWallet = Wallet.fromSeed(xrpPrivateKey);
        
        // Check offer type using proper flag checking
        const isBuyOffer = (offer.Flags & 1) !== 1;

        // Create NFToken Accept Offer transaction with correct offer type
        const acceptTx: any = {
          TransactionType: 'NFTokenAcceptOffer',
          Account: acceptorWallet.address
        };

        // Set the correct offer field based on offer type
        if (isBuyOffer) {
          acceptTx.NFTokenBuyOffer = offerId;
        } else {
          acceptTx.NFTokenSellOffer = offerId;
        }

        // Add memo if provided
        if (responseMessage) {
          acceptTx.Memos = [{
            Memo: {
              MemoData: Buffer.from(responseMessage, 'utf8').toString('hex').toUpperCase()
            }
          }];
        }

        console.log(`🔄 [NFT ACCEPT] Accepting ${isBuyOffer ? 'buy' : 'sell'} offer ${offerId} for NFT ${nftokenID}`);

        // Submit and wait for validation
        const result = await client.submitAndWait(acceptTx, { wallet: acceptorWallet });

        if (result.result.meta && typeof result.result.meta === 'object' && 'TransactionResult' in result.result.meta) {
          if (result.result.meta.TransactionResult === 'tesSUCCESS') {
            console.log(`✅ [NFT ACCEPT] Offer accepted successfully: ${result.result.hash}`);
            
            res.json({
              success: true,
              txHash: result.result.hash,
              message: 'Offer accepted successfully',
              brokered: false
            });
          } else {
            throw new Error(`Transaction failed: ${result.result.meta.TransactionResult}`);
          }
        } else {
          throw new Error('Transaction result not available');
        }
      }

    } catch (error) {
      throw error;
    } finally {
      // Always disconnect XRPL client to prevent connection leaks
      if (client.isConnected()) {
        await client.disconnect();
      }
    }

  } catch (error) {
    console.error('❌ [NFT ACCEPT] Offer acceptance failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to accept offer'
    });
  }
});

// Decline NFT Offer endpoint
router.post('/offers/:offerId/decline', sessionAuth, async (req: Request, res: Response) => {
  try {
    const { offerId } = req.params;
    const { responseMessage } = req.body;

    // For declining, we just log the action (no on-chain transaction needed)
    console.log(`❌ [NFT DECLINE] Offer ${offerId} declined by user`);

    res.json({
      success: true,
      message: 'Offer declined successfully'
    });

  } catch (error) {
    console.error('❌ [NFT DECLINE] Offer decline failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to decline offer'
    });
  }
});

export default router;