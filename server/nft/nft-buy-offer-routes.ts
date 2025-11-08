import { Router, Request, Response } from 'express';
import { sessionAuth } from '../middleware/session-auth';
import { Client as XRPLClient, Wallet, xrpToDrops } from 'xrpl';
import { decryptWalletData } from '../wallet-encryption';
import { db } from '../db';
import { riddleWallets } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { RiddleNFTBroker } from '../riddle-nft-broker';
import { RIDDLE_BROKER_CONFIG } from '../payment-payloads';

const router = Router();

// Create NFT Buy Offer endpoint
router.post('/create-offer', sessionAuth, async (req: Request, res: Response) => {
  try {
    const { nftId, offerType, amount, password, walletType } = req.body;
    const user = (req as any).user;

    // Validate inputs
    if (!nftId || !offerType || !amount || !password) {
      return res.status(400).json({
        success: false,
        error: 'NFT ID, offer type, amount, and password are required'
      });
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be a valid positive number'
      });
    }

    if (!user?.handle) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    // Only support buy offers for now
    if (offerType !== 'buy') {
      return res.status(400).json({
        success: false,
        error: 'Only buy offers are currently supported'
      });
    }

    if (walletType !== 'riddle') {
      return res.status(400).json({
        success: false,
        error: 'Only Riddle Wallet is currently supported'
      });
    }

    // Get user's wallet
    const [wallet] = await db
      .select()
      .from(riddleWallets)
      .where(eq(riddleWallets.handle, user.handle));

    if (!wallet) {
      return res.status(404).json({
        success: false,
        error: 'Wallet not found'
      });
    }

    // Decrypt wallet data with password (consistent with other routes)
    let walletData;
    try {
      walletData = await decryptWalletData(wallet.encryptedSeedPhrase, password);
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: 'Invalid password'
      });
    }

    // Create buyer wallet from decrypted seed
    const buyerWallet = Wallet.fromSeed(walletData);

    // Initialize broker for brokered offers
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

      console.log(`🔄 [NFT BUY OFFER] Creating brokered buy offer for NFT ${nftId} - Amount: ${numericAmount} XRP`);

      // Use broker to create the buy offer (keep drops as string to avoid precision loss)
      const amountInDrops = xrpToDrops(numericAmount.toString());
      const result = await broker.createBuyOffer(
        buyerWallet,
        nftId,
        parseInt(amountInDrops)  // Convert to number as required by broker method
      );

      if (result.success) {
        console.log(`✅ [NFT BUY OFFER] Buy offer created successfully: ${result.buyOfferIndex}`);
        
        res.json({
          success: true,
          offerIndex: result.buyOfferIndex,
          message: `Buy offer created for ${amount} XRP`
        });
      } else {
        throw new Error(result.error || 'Failed to create buy offer');
      }
    } finally {
      // Always disconnect broker to prevent connection leaks
      await broker.disconnect();
    }

  } catch (error) {
    console.error('❌ [NFT BUY OFFER] Offer creation failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create buy offer'
    });
  }
});

export default router;