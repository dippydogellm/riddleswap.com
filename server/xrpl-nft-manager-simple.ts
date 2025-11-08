// XRPL NFT Wallet Manager - Simplified
// Handles NFT offers, accepts/rejects, batch operations, and private key decryption for sending

import { Router } from 'express';
import { Client, Wallet as XRPLWallet, dropsToXrp } from 'xrpl';
import { db } from './db';
import { 
  walletNftOffers, 
  walletNftSettings, 
  importedWallets, 
  riddleWallets,
  insertWalletNftSettingsSchema
} from '../shared/schema';
import { eq, and } from 'drizzle-orm';
import { decryptWalletFromStorage } from './wallet-encryption';

const router = Router();

// XRPL Client
const xrplClient = new Client('wss://xrplcluster.com');
let isConnected = false;

async function connectXRPL() {
  if (!isConnected) {
    await xrplClient.connect();
    isConnected = true;
  }
}

// Get NFT offers for a wallet address - LIVE XRPL DATA ONLY
router.get('/wallet/:address/offers', async (req, res) => {
  try {
    const { address } = req.params;
    
    // NO DATABASE CACHING - LIVE XRPL DATA ONLY
    console.log(`🔥 XRPL NFT Manager: NO CACHE - LIVE DATA FOR ${address}`);

    // Get live offers from XRPL
    await connectXRPL();
    
    // Get all NFTs owned by the wallet
    const nftResponse = await xrplClient.request({
      command: 'account_nfts',
      account: address,
      limit: 400
    });

    const nfts = nftResponse.result.account_nfts || [];
    const liveOffers: Array<{
      nft_id: string;
      offer_type: 'sell_offer';
      amount: string; // XRP string
      currency: 'XRP';
      from_address: string;
      offer_index: string;
      expiration: Date | null;
    }> = [];

    // Check for buy/sell offers on each NFT
    for (const nft of nfts.slice(0, 10)) { // Limit to first 10 for performance
      try {
        // Get sell offers
        const sellOffers = await xrplClient.request({
          command: 'nft_sell_offers',
          nft_id: nft.NFTokenID,
          limit: 50
        });

        // Process sell offers (incoming offers to buy this NFT)
        for (const offer of (sellOffers.result.offers || [])) {
          try {
            if (offer.owner !== address) { // Offers from others to buy our NFT
              const amountDrops = typeof offer.amount === 'string' ? offer.amount : '0';
              liveOffers.push({
                nft_id: nft.NFTokenID,
                offer_type: 'sell_offer',
                amount: String(dropsToXrp(amountDrops)),
                currency: 'XRP',
                from_address: offer.owner,
                offer_index: offer.nft_offer_index || '',
                expiration: offer.expiration ? new Date(offer.expiration * 1000) : null
              });
            }
          } catch (e) {
            console.warn('Failed to process offer record', e);
          }
        }
      } catch (error) {
        console.error(`Error fetching offers for NFT ${nft.NFTokenID}:`, error);
      }
    }

    res.json({
      success: true,
      data: {
        dbOffers: [], // dbOffers removed in this simplified live-only manager
        liveOffers,
        totalOffers: liveOffers.length
      }
    });

  } catch (error) {
    console.error('Error fetching wallet NFT offers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch NFT offers'
    });
  }
});

// Get wallet NFT settings
router.get('/wallet/:address/settings', async (req, res) => {
  try {
    const { address } = req.params;
    
    const settings = await db
      .select()
      .from(walletNftSettings)
      .where(eq(walletNftSettings.wallet_address, address))
      .limit(1);

    if (settings.length === 0) {
      // Create default settings
      const defaultSettings = {
        wallet_address: address,
        auto_accept_offers: false,
        notification_enabled: true
      };

      const [newSettings] = await db
        .insert(walletNftSettings)
        .values(defaultSettings as any)
        .returning();

      res.json({ success: true, data: newSettings });
    } else {
      res.json({ success: true, data: settings[0] });
    }

  } catch (error) {
    console.error('Error fetching wallet NFT settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch NFT settings'
    });
  }
});

// Update wallet NFT settings
router.put('/wallet/:address/settings', async (req, res) => {
  try {
    const { address } = req.params;
    const settingsData = insertWalletNftSettingsSchema.parse(req.body);

    const [updatedSettings] = await db
      .update(walletNftSettings)
      .set({
        ...settingsData,
        updated_at: new Date()
      } as any)
      .where(eq(walletNftSettings.wallet_address, address))
      .returning();

    res.json({ success: true, data: updatedSettings });

  } catch (error) {
    console.error('Error updating wallet NFT settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update NFT settings'
    });
  }
});

// Accept single NFT offer
router.post('/offers/:offerId/accept', async (req, res) => {
  try {
    const { offerId } = req.params;
    const { walletPassword, walletType = 'imported' } = req.body;

    if (!walletPassword) {
      return res.status(400).json({
        success: false,
        error: 'Wallet password is required'
      });
    }

    // Get the offer details
    const offer = await db
      .select()
      .from(walletNftOffers)
      .where(eq(walletNftOffers.id, offerId))
      .limit(1);

    if (offer.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Offer not found'
      });
    }

    const nftOffer = offer[0];

    // Get wallet private key - simplified for imported wallets only
    const importedWallet = await db
      .select()
      .from(importedWallets)
      .where(and(
        eq(importedWallets.address, nftOffer.wallet_address),
        eq(importedWallets.chain, 'xrpl')
      ))
      .limit(1);

    if (importedWallet.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Imported wallet not found'
      });
    }

    // Decrypt private key
    const decryptResult = await decryptWalletFromStorage(importedWallet[0].id, walletPassword);
    if (!decryptResult.privateKey) {
      return res.status(401).json({
        success: false,
        error: 'Invalid password'
      });
    }

    // Connect to XRPL and submit accept transaction
    await connectXRPL();
    const wallet = XRPLWallet.fromSeed(decryptResult.privateKey);

    let txResponse;
    if (nftOffer.offer_type === 'sell_offer') {
      // Accept a sell offer (someone wants to buy our NFT)
      txResponse = await xrplClient.submitAndWait({
        TransactionType: 'NFTokenAcceptOffer',
        Account: wallet.address,
        NFTokenSellOffer: nftOffer.offer_index
      }, { wallet });
    } else {
      // Accept a buy offer 
      txResponse = await xrplClient.submitAndWait({
        TransactionType: 'NFTokenAcceptOffer',
        Account: wallet.address,
        NFTokenBuyOffer: nftOffer.offer_index
      }, { wallet });
    }

    // Update offer status in database
    await db
      .update(walletNftOffers)
      .set({
        status: 'accepted',
        updated_at: new Date()
      } as any)
      .where(eq(walletNftOffers.id, offerId));

    res.json({
      success: true,
      data: {
        transactionHash: txResponse.result.hash,
        offer: nftOffer
      }
    });

  } catch (error) {
    console.error('Error accepting NFT offer:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to accept NFT offer'
    });
  }
});

// Reject single NFT offer
router.post('/offers/:offerId/reject', async (req, res) => {
  try {
    const { offerId } = req.params;

    // Update offer status in database
    const [updatedOffer] = await db
      .update(walletNftOffers)
      .set({
        status: 'rejected',
        updated_at: new Date()
      } as any)
      .where(eq(walletNftOffers.id, offerId))
      .returning();

    res.json({
      success: true,
      data: updatedOffer
    });

  } catch (error) {
    console.error('Error rejecting NFT offer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reject NFT offer'
    });
  }
});

// Accept all NFT offers for a wallet
router.post('/wallet/:address/accept-all-offers', async (req, res) => {
  try {
    const { address } = req.params;
    const { walletPassword, filterAmount } = req.body;

    if (!walletPassword) {
      return res.status(400).json({
        success: false,
        error: 'Wallet password is required'
      });
    }

    // Get all pending offers
    const offers = await db
      .select()
      .from(walletNftOffers)
      .where(and(
        eq(walletNftOffers.wallet_address, address),
        eq(walletNftOffers.status, 'pending')
      ));

    if (offers.length === 0) {
      return res.json({
        success: true,
        message: 'No pending offers to accept',
        acceptedCount: 0
      });
    }

    // Filter by amount if specified
    const filteredOffers = filterAmount 
      ? offers.filter(offer => parseFloat(offer.amount || '0') >= filterAmount)
      : offers;

    // Get wallet private key
    const importedWallet = await db
      .select()
      .from(importedWallets)
      .where(and(
        eq(importedWallets.address, address),
        eq(importedWallets.chain, 'xrpl')
      ))
      .limit(1);

    if (importedWallet.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Imported wallet not found'
      });
    }

    const decryptResult = await decryptWalletFromStorage(importedWallet[0].id, walletPassword);
    if (!decryptResult.privateKey) {
      return res.status(401).json({
        success: false,
        error: 'Invalid password'
      });
    }

    // Connect to XRPL and process all offers
    await connectXRPL();
    const wallet = XRPLWallet.fromSeed(decryptResult.privateKey);

    const results = [];
    let acceptedCount = 0;

    for (const offer of filteredOffers) {
      try {
        let txResponse;
        if (offer.offer_type === 'sell_offer') {
          txResponse = await xrplClient.submitAndWait({
            TransactionType: 'NFTokenAcceptOffer',
            Account: wallet.address,
            NFTokenSellOffer: offer.offer_index
          }, { wallet });
        } else {
          txResponse = await xrplClient.submitAndWait({
            TransactionType: 'NFTokenAcceptOffer',
            Account: wallet.address,
            NFTokenBuyOffer: offer.offer_index
          }, { wallet });
        }

        // Update offer status
        await db
          .update(walletNftOffers)
          .set({
            status: 'accepted',
            updated_at: new Date()
          } as any)
          .where(eq(walletNftOffers.id, offer.id));

        results.push({
          offerId: offer.id,
          success: true,
          transactionHash: txResponse.result.hash
        });
        acceptedCount++;

      } catch (error) {
        results.push({
          offerId: offer.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    res.json({
      success: true,
      data: {
        totalOffers: filteredOffers.length,
        acceptedCount,
        results
      }
    });

  } catch (error) {
    console.error('Error accepting all NFT offers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to accept all NFT offers'
    });
  }
});

// Send NFT to address
router.post('/send-nft', async (req, res) => {
  try {
    const { 
      fromAddress, 
      toAddress, 
      nftId, 
      walletPassword 
    } = req.body;

    if (!fromAddress || !toAddress || !nftId || !walletPassword) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: fromAddress, toAddress, nftId, walletPassword'
      });
    }

    // Get wallet private key
    const importedWallet = await db
      .select()
      .from(importedWallets)
      .where(and(
        eq(importedWallets.address, fromAddress),
        eq(importedWallets.chain, 'xrpl')
      ))
      .limit(1);

    if (importedWallet.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Imported wallet not found'
      });
    }

    const decryptResult = await decryptWalletFromStorage(importedWallet[0].id, walletPassword);
    if (!decryptResult.privateKey) {
      return res.status(401).json({
        success: false,
        error: 'Invalid password'
      });
    }

    // Connect to XRPL and send NFT
    await connectXRPL();
    const wallet = XRPLWallet.fromSeed(decryptResult.privateKey);

    const txResponse = await xrplClient.submitAndWait({
      TransactionType: 'NFTokenCreateOffer',
      Account: wallet.address,
      NFTokenID: nftId,
      Amount: '0', // Free transfer
      Destination: toAddress,
      Flags: 1 // tfSellNFToken flag
    }, { wallet });

    res.json({
      success: true,
      data: {
        transactionHash: txResponse.result.hash,
        fromAddress,
        toAddress,
        nftId
      }
    });

  } catch (error) {
    console.error('Error sending NFT:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send NFT'
    });
  }
});

export default router;