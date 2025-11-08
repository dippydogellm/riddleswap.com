// Enhanced NFT Buy Routes with Fee Injection Support
// Integrates the EnhancedNFTBuySystem with the existing marketplace

import { Express } from 'express';
import { requireAuthentication } from './middleware/session-auth';
import { 
  EnhancedNFTBuySystem, 
  createDirectBuyConfig, 
  createBrokeredBuyConfig,
  BuyTransactionConfig 
} from './nft-buy-system-enhanced';

export function registerEnhancedNFTBuyRoutes(app: Express) {
  console.log('🚀 Registering Enhanced NFT Buy routes with fee injection...');

  const buySystem = new EnhancedNFTBuySystem();

  // Create direct buy offer (no broker fee)
  app.post('/api/nft/buy-direct', requireAuthentication, async (req: any, res) => {
    try {
      const { nftokenID, buyerWallet, sellerWallet, sellPrice, buyerSeed } = req.body;

      if (!nftokenID || !buyerWallet || !sellerWallet || !sellPrice || !buyerSeed) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: nftokenID, buyerWallet, sellerWallet, sellPrice, buyerSeed'
        });
      }

      // Validate user authentication
      const userId = req.session?.passport?.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
      }

      // Create direct buy configuration
      const config = createDirectBuyConfig(nftokenID, buyerWallet, sellerWallet, parseFloat(sellPrice));

      // Create buy offer
      const result = await buySystem.createBuyOffer(config, buyerSeed);

      if (result.success) {
        console.log(`✅ [DIRECT BUY] Successfully created direct buy offer for ${nftokenID}`);
        res.json({
          success: true,
          transactionHash: result.transactionHash,
          offerID: result.offerID,
          totalCost: result.totalCost,
          breakdown: result.breakdown,
          message: result.message,
          type: 'direct'
        });
      } else {
        console.error(`❌ [DIRECT BUY] Failed to create buy offer: ${result.error}`);
        res.status(400).json({
          success: false,
          error: result.error || 'Failed to create direct buy offer'
        });
      }

    } catch (error) {
      console.error('❌ [DIRECT BUY] Route error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  });

  // Create brokered buy offer (with custom fee)
  app.post('/api/nft/buy-brokered', requireAuthentication, async (req: any, res) => {
    try {
      const { 
        nftokenID, 
        buyerWallet, 
        sellerWallet, 
        sellPrice, 
        customFee, 
        brokerWallet, 
        buyerSeed 
      } = req.body;

      if (!nftokenID || !buyerWallet || !sellerWallet || !sellPrice || !customFee || !brokerWallet || !buyerSeed) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields for brokered buy: nftokenID, buyerWallet, sellerWallet, sellPrice, customFee, brokerWallet, buyerSeed'
        });
      }

      // Validate user authentication
      const userId = req.session?.passport?.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
      }

      // Create brokered buy configuration
      const config = createBrokeredBuyConfig(
        nftokenID, 
        buyerWallet, 
        sellerWallet, 
        parseFloat(sellPrice),
        parseFloat(customFee),
        brokerWallet
      );

      // Create buy offer
      const result = await buySystem.createBuyOffer(config, buyerSeed);

      if (result.success) {
        console.log(`✅ [BROKERED BUY] Successfully created brokered buy offer for ${nftokenID} with ${customFee} XRP fee`);
        res.json({
          success: true,
          transactionHash: result.transactionHash,
          offerID: result.offerID,
          totalCost: result.totalCost,
          breakdown: result.breakdown,
          message: result.message,
          type: 'brokered'
        });
      } else {
        console.error(`❌ [BROKERED BUY] Failed to create buy offer: ${result.error}`);
        res.status(400).json({
          success: false,
          error: result.error || 'Failed to create brokered buy offer'
        });
      }

    } catch (error) {
      console.error('❌ [BROKERED BUY] Route error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  });

  // Accept buy offer (for sellers or brokers)
  app.post('/api/nft/accept-buy-offer', requireAuthentication, async (req: any, res) => {
    try {
      const {
        buyOfferID,
        sellOfferID,
        acceptorSeed,
        acceptorAddress,
        config
      } = req.body;

      if (!buyOfferID || !acceptorSeed || !acceptorAddress || !config) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: buyOfferID, acceptorSeed, acceptorAddress, config'
        });
      }

      // Validate user authentication
      const userId = req.session?.passport?.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
      }

      // Accept buy offer
      const result = await buySystem.acceptBuyOffer(
        buyOfferID,
        sellOfferID || null,
        acceptorSeed,
        acceptorAddress,
        config as BuyTransactionConfig
      );

      if (result.success) {
        console.log(`✅ [ACCEPT OFFER] Successfully accepted buy offer ${buyOfferID}`);
        res.json({
          success: true,
          transactionHash: result.transactionHash,
          totalCost: result.totalCost,
          breakdown: result.breakdown,
          message: result.message
        });
      } else {
        console.error(`❌ [ACCEPT OFFER] Failed to accept offer: ${result.error}`);
        res.status(400).json({
          success: false,
          error: result.error || 'Failed to accept buy offer'
        });
      }

    } catch (error) {
      console.error('❌ [ACCEPT OFFER] Route error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  });

  // Calculate purchase cost
  app.post('/api/nft/calculate-cost', requireAuthentication, async (req: any, res) => {
    try {
      const { sellPrice, transactionType, customFee } = req.body;

      if (!sellPrice || !transactionType) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: sellPrice, transactionType'
        });
      }

      const cost = buySystem.calculatePurchaseCost(
        parseFloat(sellPrice),
        transactionType,
        customFee ? parseFloat(customFee) : 0
      );

      res.json({
        success: true,
        cost
      });

    } catch (error) {
      console.error('❌ [CALCULATE COST] Route error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  });

  // Check existing offers for an NFT
  app.get('/api/nft/:nftokenID/offers', requireAuthentication, async (req: any, res) => {
    try {
      const { nftokenID } = req.params;

      if (!nftokenID) {
        return res.status(400).json({
          success: false,
          error: 'NFToken ID required'
        });
      }

      const [buyOffers, sellOffers] = await Promise.all([
        buySystem.checkExistingBuyOffers(nftokenID),
        buySystem.checkExistingSellOffers(nftokenID)
      ]);

      res.json({
        success: true,
        nftokenID,
        buyOffers,
        sellOffers
      });

    } catch (error) {
      console.error('❌ [CHECK OFFERS] Route error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  });

  // RiddleSwap fee configurations endpoint
  app.get('/api/nft/fee-options', requireAuthentication, async (req: any, res) => {
    try {
      const feeOptions = [
        {
          type: 'direct',
          name: 'Direct Sale',
          description: 'No marketplace fee - you receive the full selling price',
          fee: 0,
          feePercentage: 0,
          brokerWallet: null
        },
        {
          type: 'riddleswap_low',
          name: 'RiddleSwap Low Fee',
          description: 'Lower marketplace fee for RiddleSwap users',
          fee: 0.5,
          feePercentage: 0.5,
          brokerWallet: process.env.RIDDLE_BROKER_ADDRESS || 'rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY'
        },
        {
          type: 'riddleswap_standard',
          name: 'RiddleSwap Standard',
          description: 'Standard RiddleSwap marketplace fee',
          fee: 1.0,
          feePercentage: 1.0,
          brokerWallet: process.env.RIDDLE_BROKER_ADDRESS || 'rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY'
        },
        {
          type: 'custom',
          name: 'Custom Fee',
          description: 'Set your own marketplace fee',
          fee: null,
          feePercentage: null,
          brokerWallet: process.env.RIDDLE_BROKER_ADDRESS || 'rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY'
        }
      ];

      res.json({
        success: true,
        feeOptions,
        defaultBrokerWallet: process.env.RIDDLE_BROKER_ADDRESS || 'rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY'
      });

    } catch (error) {
      console.error('❌ [FEE OPTIONS] Route error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  });

  console.log('✅ Enhanced NFT Buy routes registered successfully');
}