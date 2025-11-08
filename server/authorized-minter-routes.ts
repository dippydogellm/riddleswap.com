import express from 'express';
import { z } from 'zod';
import { requireAuthentication } from './middleware/session-auth';
import * as xrpl from 'xrpl';

const router = express.Router();

// Collection configurations
const COLLECTIONS = {
  'under-the-bridge': {
    name: 'Under the Bridge Riddle',
    mintPrice: 12, // XRP
    taxon: 12345, // You'll provide the actual taxon
    transferFee: 500, // 5% royalty
    issuerAddress: '', // You'll provide the actual issuer address
    nextTokenId: 333, // Starting from where you left off
    totalSupply: 1230,
    remainingToMint: 898,
    partnerType: 'riddle-partner'
  },
  'the-inquisition': {
    name: 'The Trolls Inquisition Multi-Chain Mayhem Edition',
    mintPrice: 4, // XRP
    taxon: 54321, // You'll provide the actual taxon
    transferFee: 500, // 5% royalty
    issuerAddress: '', // You'll provide the actual issuer address
    nextTokenId: 1, // Starting token ID
    totalSupply: 1000,
    remainingToMint: 1000,
    partnerType: 'riddle-partner'
  },
};

// Validation schemas
const mintRequestSchema = z.object({
  collectionId: z.enum(['under-the-bridge', 'the-inquisition']),
  paymentTxHash: z.string(),
  userAddress: z.string()
});

const authorizeMinterSchema = z.object({
  collectionId: z.enum(['under-the-bridge', 'the-inquisition']),
  minterAddress: z.string(),
  issuerSeed: z.string() // Only for initial setup
});

// Get collection information
router.get('/collections', requireAuthentication, async (req, res) => {
  try {
    const collectionsInfo = Object.entries(COLLECTIONS).map(([id, config]) => ({
      id,
      name: config.name,
      mintPrice: config.mintPrice,
      remainingToMint: config.remainingToMint,
      totalSupply: config.totalSupply,
      nextTokenId: config.nextTokenId
    }));

    res.json({
      success: true,
      collections: collectionsInfo
    });
  } catch (error) {
    console.error('❌ Error fetching collections:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch collections'
    });
  }
});

// Authorize a minter for a collection (one-time setup)
router.post('/authorize-minter', requireAuthentication, async (req, res) => {
  try {
    const { collectionId, minterAddress, issuerSeed } = authorizeMinterSchema.parse(req.body);
    
    if (!COLLECTIONS[collectionId]) {
      return res.status(400).json({
        success: false,
        error: 'Invalid collection ID'
      });
    }

    const client = new xrpl.Client('wss://xrplcluster.com');
    await client.connect();

    const issuerWallet = xrpl.Wallet.fromSeed(issuerSeed);
    
    // Create AccountSet transaction to authorize the minter
    const tx: any = {
      TransactionType: 'AccountSet',
      Account: issuerWallet.address,
      NFTokenMinter: minterAddress,
      SetFlag: 10 // asfAuthorizedNFTokenMinter
    };

    const prepared = await client.autofill(tx);
    const signed = issuerWallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    await client.disconnect();

    if (result.result.meta && typeof result.result.meta === 'object' && 'TransactionResult' in result.result.meta && result.result.meta.TransactionResult === 'tesSUCCESS') {
      // Update collection config with issuer address
      COLLECTIONS[collectionId].issuerAddress = issuerWallet.address;
      
      res.json({
        success: true,
        message: 'Minter authorized successfully',
        issuerAddress: issuerWallet.address,
        minterAddress,
        txHash: result.result.hash
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Authorization transaction failed',
        result: result.result
      });
    }
  } catch (error) {
    console.error('❌ Error authorizing minter:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to authorize minter'
    });
  }
});

// Create XAMAN payment request for minting
router.post('/create-mint-payment', requireAuthentication, async (req, res) => {
  try {
    const { collectionId, paymentMethod } = z.object({
      collectionId: z.enum(['under-the-bridge', 'the-inquisition', 'little-books-jerusalem']),
      paymentMethod: z.enum(['riddle-wallet', 'xaman']).optional().default('riddle-wallet')
    }).parse(req.body);

    const collection = COLLECTIONS[collectionId];
    if (!collection) {
      return res.status(400).json({
        success: false,
        error: 'Invalid collection ID'
      });
    }

    if (collection.remainingToMint <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Collection is sold out'
      });
    }

    // Treasury address for collecting mint fees
    const treasuryAddress = 'rGDJxq11nj6gstTrUKND3NtAaLtSUGqvDY'; // RiddleSwap treasury
    const mintPrice = xrpl.xrpToDrops(collection.mintPrice.toString());
    
    // Create XAMAN payment payload using existing infrastructure
    const paymentData = {
      TransactionType: 'Payment',
      Destination: treasuryAddress,
      Amount: mintPrice,
      Memos: [{
        Memo: {
          MemoType: Buffer.from('authorized-mint', 'utf8').toString('hex').toUpperCase(),
          MemoData: Buffer.from(`${collectionId}:${collection.nextTokenId}`, 'utf8').toString('hex').toUpperCase()
        }
      }]
    };

    res.json({
      success: true,
      collection: {
        name: collection.name,
        mintPrice: collection.mintPrice,
        nextTokenId: collection.nextTokenId,
        partnerType: collection.partnerType
      },
      paymentData,
      treasuryAddress,
      paymentMethod,
      instructions: paymentMethod === 'riddle-wallet' 
        ? 'Complete payment with your Riddle wallet to mint your NFT'
        : 'Complete payment via XAMAN to mint your NFT'
    });
  } catch (error) {
    console.error('❌ Error creating mint payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create payment request'
    });
  }
});

// Mint NFT after payment confirmation
router.post('/mint', requireAuthentication, async (req, res) => {
  try {
    const { collectionId, paymentTxHash, userAddress } = mintRequestSchema.parse(req.body);
    
    const collection = COLLECTIONS[collectionId];
    if (!collection) {
      return res.status(400).json({
        success: false,
        error: 'Invalid collection ID'
      });
    }

    if (collection.remainingToMint <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Collection is sold out'
      });
    }

    // TODO: Verify payment transaction
    // In production, you'd verify the payment transaction here

    const client = new xrpl.Client('wss://xrplcluster.com');
    await client.connect();

    // Get the authorized minter wallet (you'll store this securely)
    const minterSeed = process.env.AUTHORIZED_MINTER_SEED; // Store securely
    if (!minterSeed) {
      throw new Error('Minter seed not configured');
    }

    const minterWallet = xrpl.Wallet.fromSeed(minterSeed);

    // Create NFT mint transaction
    const tx: any = {
      TransactionType: 'NFTokenMint',
      Account: minterWallet.address,
      Issuer: collection.issuerAddress,
      NFTokenTaxon: collection.taxon,
      TransferFee: collection.transferFee,
      Flags: 8 // Transferable
      // No URI for no metadata, as requested
    };

    const prepared = await client.autofill(tx);
    const signed = minterWallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    await client.disconnect();

    if (result.result.meta && typeof result.result.meta === 'object' && 'TransactionResult' in result.result.meta && result.result.meta.TransactionResult === 'tesSUCCESS') {
      // Extract NFToken ID from metadata
      let nftokenID = '';
      const meta = result.result.meta as any;
      if (meta?.AffectedNodes) {
        for (const node of meta.AffectedNodes) {
          if (node.CreatedNode?.LedgerEntryType === 'NFTokenPage') {
            const nftokens = node.CreatedNode.NewFields?.NFTokens || [];
            if (nftokens.length > 0) {
              nftokenID = Object.keys(nftokens[0])[0];
              break;
            }
          }
        }
      }

      // Update collection state
      collection.nextTokenId++;
      collection.remainingToMint--;

      res.json({
        success: true,
        message: 'NFT minted successfully',
        nftokenID,
        txHash: result.result.hash,
        collection: {
          name: collection.name,
          remainingToMint: collection.remainingToMint,
          mintedTokenId: collection.nextTokenId - 1
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Mint transaction failed',
        result: result.result
      });
    }
  } catch (error) {
    console.error('❌ Error minting NFT:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mint NFT'
    });
  }
});

// Get minting status for a collection
router.get('/status/:collectionId', requireAuthentication, async (req, res) => {
  try {
    const { collectionId } = z.object({
      collectionId: z.enum(['under-the-bridge', 'the-inquisition', 'little-books-jerusalem'])
    }).parse(req.params);

    const collection = COLLECTIONS[collectionId];
    if (!collection) {
      return res.status(400).json({
        success: false,
        error: 'Invalid collection ID'
      });
    }

    res.json({
      success: true,
      collection: {
        name: collection.name,
        mintPrice: collection.mintPrice,
        totalSupply: collection.totalSupply,
        remainingToMint: collection.remainingToMint,
        nextTokenId: collection.nextTokenId,
        mintedCount: collection.totalSupply - collection.remainingToMint,
        issuerAddress: collection.issuerAddress,
        partnerType: collection.partnerType
      }
    });
  } catch (error) {
    console.error('❌ Error fetching collection status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch collection status'
    });
  }
});

export function registerAuthorizedMinterRoutes(app: express.Express) {
  app.use('/api/authorized-minter', router);
}