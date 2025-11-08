/**
 * XRPL NFT Brokered Offer API Routes
 * 
 * Provides endpoints for creating and managing NFT offers using XRPL's native brokered sales
 */

import express, { Request, Response } from 'express';
import { db } from './db';
import { wallets, users } from '../shared/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { 
  createSellOffer, 
  createBuyOffer, 
  acceptBrokeredOffer, 
  cancelOffer, 
  getNFTOffers,
  immediatelyBuyWithBrokerFee 
} from './xrpl/xrpl-nft-offers';

const router = express.Router();

/**
 * Decrypt wallet private key using password
 */
function decryptPrivateKey(encryptedKey: string, password: string): string {
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(password, 'salt', 32);
  
  const parts = encryptedKey.split(':');
  const iv = Buffer.from(parts.shift()!, 'hex');
  const encrypted = Buffer.from(parts.join(':'), 'hex');
  
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  
  return decrypted.toString();
}

interface AuthenticatedRequest extends Request {
  session: any & {
    userId?: number;
  };
}

/**
 * POST /api/nft/offers/create-sell
 * Create a sell offer for an NFT (seller's Riddle wallet)
 * 
 * Uses cached XRPL private keys from session (no password needed)
 * 
 * Body:
 * - nftTokenId: The NFT token ID
 * - netAmountXRP: Net amount seller wants to receive (before 1% broker fee)
 * - expirationDays: Optional expiration in days
 */
router.post('/create-sell', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { nftTokenId, netAmountXRP, expirationDays } = req.body;
    const cachedKeys = req.session?.cachedKeys;
    
    if (!cachedKeys || !cachedKeys.xrpPrivateKey) {
      return res.status(401).json({ 
        success: false, 
        error: 'Not authenticated or missing cached XRPL keys. Please log in again.' 
      });
    }
    
    if (!nftTokenId || !netAmountXRP) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: nftTokenId, netAmountXRP' 
      });
    }
    
    console.log(`📝 [API] Creating sell offer for NFT ${nftTokenId} at ${netAmountXRP} XRP`);
    console.log(`   Using cached XRPL private key from session`);
    
    // Use cached XRPL private key from session (already decrypted at login)
    const privateKey = cachedKeys.xrpPrivateKey;
    
    // Create sell offer
    const result = await createSellOffer(
      privateKey,
      nftTokenId,
      netAmountXRP,
      expirationDays
    );
    
    if (result.success) {
      // Calculate buyer's total (net + 1% fee)
      const brokerFee = netAmountXRP * 0.01;
      const buyerTotal = netAmountXRP + brokerFee;
      
      res.json({
        success: true,
        offerIndex: result.offerIndex,
        txHash: result.txHash,
        details: {
          sellerNetAmount: netAmountXRP,
          brokerFee: brokerFee,
          buyerTotalNeeded: buyerTotal
        }
      });
    } else {
      res.status(400).json(result);
    }
    
  } catch (error) {
    console.error('❌ [API] Create sell offer error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to create sell offer' 
    });
  }
});

/**
 * POST /api/nft/offers/create-buy
 * Create a buy offer for an NFT (buyer's Riddle wallet)
 * 
 * Uses cached XRPL private keys from session (no password needed)
 * 
 * Body:
 * - nftTokenId: The NFT token ID
 * - ownerAddress: Current NFT owner's address
 * - totalAmountXRP: Total amount buyer is willing to pay (includes seller net + 1% fee)
 * - expirationDays: Optional expiration in days
 */
router.post('/create-buy', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { nftTokenId, ownerAddress, totalAmountXRP, expirationDays } = req.body;
    const cachedKeys = req.session?.cachedKeys;
    
    if (!cachedKeys || !cachedKeys.xrpPrivateKey) {
      return res.status(401).json({ 
        success: false, 
        error: 'Not authenticated or missing cached XRPL keys. Please log in again.' 
      });
    }
    
    if (!nftTokenId || !ownerAddress || !totalAmountXRP) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: nftTokenId, ownerAddress, totalAmountXRP' 
      });
    }
    
    console.log(`📝 [API] Creating buy offer for NFT ${nftTokenId} at ${totalAmountXRP} XRP total`);
    console.log(`   Using cached XRPL private key from session`);
    
    // Use cached XRPL private key from session (already decrypted at login)
    const privateKey = cachedKeys.xrpPrivateKey;
    
    // Create buy offer
    const result = await createBuyOffer(
      privateKey,
      nftTokenId,
      ownerAddress,
      totalAmountXRP,
      expirationDays
    );
    
    if (result.success) {
      // Calculate breakdown (assuming 1% fee)
      const brokerFee = totalAmountXRP * 0.0099; // Approximate 1% of total
      const sellerNet = totalAmountXRP - brokerFee;
      
      res.json({
        success: true,
        offerIndex: result.offerIndex,
        txHash: result.txHash,
        details: {
          buyerTotal: totalAmountXRP,
          estimatedBrokerFee: brokerFee,
          estimatedSellerNet: sellerNet
        }
      });
    } else {
      res.status(400).json(result);
    }
    
  } catch (error) {
    console.error('❌ [API] Create buy offer error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to create buy offer' 
    });
  }
});

/**
 * POST /api/nft/offers/accept-brokered
 * Broker accepts a matched sell/buy offer pair
 * ADMIN ONLY - requires broker wallet password
 * 
 * SECURITY: Fetches authoritative offer amounts from XRPL ledger
 * to prevent fee manipulation
 * 
 * Body:
 * - sellOfferIndex: The sell offer index
 * - buyOfferIndex: The buy offer index
 * - brokerPassword: Broker wallet password
 */
router.post('/accept-brokered', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sellOfferIndex, buyOfferIndex, brokerPassword } = req.body;
    const userId = req.session.userId;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    
    if (!sellOfferIndex || !buyOfferIndex || !brokerPassword) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: sellOfferIndex, buyOfferIndex, brokerPassword' 
      });
    }
    
    console.log(`🤝 [API] User requesting brokered offer acceptance`);
    
    // Get broker wallet from riddleWallets table
    const brokerWallet = await db.query.riddleWallets.findFirst({
      where: (riddleWallets, { eq }) => eq(riddleWallets.handle, 'riddlbroker')
    });
    
    if (!brokerWallet || !brokerWallet.encryptedPrivateKeys) {
      return res.status(500).json({ success: false, error: 'Broker wallet not found' });
    }
    
    // Decrypt broker's XRPL private key
    let privateKey: string;
    try {
      privateKey = decryptPrivateKey(brokerWallet.encryptedPrivateKeys.xrp, brokerPassword);
    } catch (error) {
      return res.status(401).json({ success: false, error: 'Invalid broker password' });
    }
    
    // Accept brokered offer (amounts fetched from ledger for security)
    const result = await acceptBrokeredOffer(
      privateKey,
      sellOfferIndex,
      buyOfferIndex
    );
    
    if (result.success) {
      res.json({
        success: true,
        txHash: result.txHash,
        balanceChanges: result.balanceChanges,
        details: {
          sellAmountXRP: result.sellAmountXRP,
          brokerFeeXRP: result.brokerFeeXRP
        }
      });
    } else {
      res.status(400).json(result);
    }
    
  } catch (error) {
    console.error('❌ [API] Accept brokered offer error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to accept brokered offer' 
    });
  }
});

/**
 * POST /api/nft/offers/cancel
 * Cancel an NFT offer (sell or buy)
 * 
 * Uses cached XRPL private keys from session (no password needed)
 * 
 * Body:
 * - offerIndex: The offer index to cancel
 */
router.post('/cancel', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { offerIndex } = req.body;
    const cachedKeys = req.session?.cachedKeys;
    
    if (!cachedKeys || !cachedKeys.xrpPrivateKey) {
      return res.status(401).json({ 
        success: false, 
        error: 'Not authenticated or missing cached XRPL keys. Please log in again.' 
      });
    }
    
    if (!offerIndex) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required field: offerIndex' 
      });
    }
    
    console.log(`🗑️ [API] Canceling offer ${offerIndex}`);
    console.log(`   Using cached XRPL private key from session`);
    
    // Use cached XRPL private key from session (already decrypted at login)
    const privateKey = cachedKeys.xrpPrivateKey;
    
    // Cancel offer
    const result = await cancelOffer(privateKey, offerIndex);
    
    if (result.success) {
      res.json({
        success: true,
        txHash: result.txHash
      });
    } else {
      res.status(400).json(result);
    }
    
  } catch (error) {
    console.error('❌ [API] Cancel offer error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to cancel offer' 
    });
  }
});

/**
 * GET /api/nft/offers/:nftTokenId
 * Get all offers for a specific NFT
 */
router.get('/:nftTokenId', async (req: Request, res: Response) => {
  try {
    const { nftTokenId } = req.params;
    
    if (!nftTokenId) {
      return res.status(400).json({ success: false, error: 'NFT token ID required' });
    }
    
    const result = await getNFTOffers(nftTokenId);
    
    if (result.success) {
      res.json({
        success: true,
        sellOffers: result.sellOffers,
        buyOffers: result.buyOffers
      });
    } else {
      res.status(400).json(result);
    }
    
  } catch (error) {
    console.error('❌ [API] Get NFT offers error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to get NFT offers' 
    });
  }
});

/**
 * ==========================================
 * BUY NOW ROUTES (Separate from Make Offer)
 * ==========================================
 */

/**
 * POST /api/nft/offers/buy-now-brokered
 * IMMEDIATE BUY NOW for Riddle wallet users
 * 
 * When a sell offer exists, buyer can immediately purchase the NFT.
 * This is a 3-step atomic transaction:
 * 1. Fetch sell offer details from ledger
 * 2. Buyer creates buy offer for (sell amount + 1% fee)
 * 3. Broker immediately accepts both offers
 * 
 * Completes in ~5-10 seconds total
 * 
 * Uses cached XRPL private keys from session (no password needed)
 * 
 * Body:
 * - sellOfferIndex: The existing sell offer index to purchase
 * - brokerPassword: Broker wallet password (admin only)
 */
router.post('/buy-now-brokered', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sellOfferIndex, brokerPassword } = req.body;
    const cachedKeys = req.session?.cachedKeys;
    
    if (!cachedKeys || !cachedKeys.xrpPrivateKey) {
      return res.status(401).json({ 
        success: false, 
        error: 'Not authenticated or missing cached XRPL keys. Please log in again.' 
      });
    }
    
    if (!sellOfferIndex || !brokerPassword) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: sellOfferIndex, brokerPassword' 
      });
    }
    
    console.log(`🛒 [API BUY NOW] User initiating immediate purchase`);
    console.log(`   Sell Offer Index: ${sellOfferIndex}`);
    console.log(`   Using cached XRPL private key from session`);
    
    // Use cached XRPL private key from session (already decrypted at login)
    const buyerPrivateKey = cachedKeys.xrpPrivateKey;
    
    // Get broker wallet from riddleWallets table - still needs password for security
    const brokerWallet = await db.query.riddleWallets.findFirst({
      where: (riddleWallets, { eq }) => eq(riddleWallets.handle, 'riddlbroker')
    });
    
    if (!brokerWallet || !brokerWallet.encryptedPrivateKeys) {
      return res.status(500).json({ success: false, error: 'Broker wallet not found' });
    }
    
    // Decrypt broker's XRPL private key (broker still requires password for security)
    let brokerPrivateKey: string;
    try {
      brokerPrivateKey = decryptPrivateKey(brokerWallet.encryptedPrivateKeys.xrp, brokerPassword);
    } catch (error) {
      return res.status(401).json({ success: false, error: 'Invalid broker password' });
    }
    
    console.log(`✅ [API BUY NOW] Buyer cached key ready, broker key decrypted`);
    
    // Execute immediate buy with broker fee
    console.log(`🚀 [API BUY NOW] Executing atomic buy-now transaction...`);
    const result = await immediatelyBuyWithBrokerFee(
      buyerPrivateKey,
      brokerPrivateKey,
      sellOfferIndex
    );
    
    if (result.success) {
      console.log(`✅ [API BUY NOW] Purchase completed successfully!`);
      res.json({
        success: true,
        buyOfferTxHash: result.buyOfferTxHash,
        acceptTxHash: result.acceptTxHash,
        details: {
          nftTokenId: result.nftTokenId,
          sellAmountXRP: result.sellAmountXRP,
          brokerFeeXRP: result.brokerFeeXRP,
          totalPaidXRP: result.totalPaidXRP
        }
      });
    } else {
      res.status(400).json(result);
    }
    
  } catch (error) {
    console.error('❌ [API BUY NOW] Immediate buy error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Immediate buy failed' 
    });
  }
});

/**
 * POST /api/nft/offers/external/buy-now-prepare
 * Prepare unsigned buy-now transaction for external wallets (Xaman, Joey)
 * 
 * Returns unsigned transaction blob for user to sign with their external wallet
 * 
 * Body:
 * - sellOfferIndex: The existing sell offer index
 * - buyerAddress: External wallet address
 */
router.post('/external/buy-now-prepare', async (req: Request, res: Response) => {
  try {
    const { sellOfferIndex, buyerAddress } = req.body;
    
    if (!sellOfferIndex || !buyerAddress) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: sellOfferIndex, buyerAddress' 
      });
    }
    
    console.log(`📝 [API EXTERNAL BUY NOW] Preparing unsigned buy offer transaction`);
    console.log(`   Sell Offer: ${sellOfferIndex}`);
    console.log(`   Buyer: ${buyerAddress}`);
    
    // Import xrpl module for transaction preparation
    const xrpl = await import('xrpl');
    const { getXrplClient, disconnectClient } = await import('./xrpl/xrpl-wallet');
    
    let client: any = null;
    
    try {
      client = await getXrplClient();
      
      // Fetch sell offer details from ledger
      const sellOfferResponse = await client.request({
        command: 'ledger_entry',
        index: sellOfferIndex,
        ledger_index: 'validated'
      });
      
      const sellOfferData = sellOfferResponse.result.node;
      
      // Validate XRP only
      if (typeof sellOfferData.Amount !== 'string') {
        throw new Error('Non-XRP offers not supported for external wallets');
      }
      
      const sellAmountDrops = sellOfferData.Amount;
      const sellAmountXRP = parseFloat(xrpl.dropsToXrp(sellAmountDrops));
      
      // Calculate total with 1% fee
      const brokerFeeXRP = sellAmountXRP * 0.01;
      const totalAmountXRP = sellAmountXRP + brokerFeeXRP;
      const totalAmountDrops = xrpl.xrpToDrops(totalAmountXRP);
      
      // Prepare unsigned buy offer transaction
      const buyOffer = {
        TransactionType: 'NFTokenCreateOffer',
        Account: buyerAddress,
        NFTokenID: sellOfferData.NFTokenID,
        Amount: totalAmountDrops,
        Owner: sellOfferData.Owner
      };
      
      const prepared = await client.autofill(buyOffer);
      
      res.json({
        success: true,
        unsignedTransaction: prepared,
        details: {
          nftTokenId: sellOfferData.NFTokenID,
          sellAmountXRP: sellAmountXRP,
          brokerFeeXRP: brokerFeeXRP,
          totalAmountXRP: totalAmountXRP,
          note: 'Sign this transaction with your external wallet (Xaman/Joey), then contact support to complete the brokered acceptance'
        }
      });
      
    } finally {
      if (client) {
        await disconnectClient(client);
      }
    }
    
  } catch (error) {
    console.error('❌ [API EXTERNAL BUY NOW] Prepare error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to prepare buy-now transaction' 
    });
  }
});

export default router;
