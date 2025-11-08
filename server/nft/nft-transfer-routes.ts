import { Router, Request, Response } from 'express';
import { sessionAuth } from '../middleware/session-auth';
import { Client as XRPLClient, Wallet } from 'xrpl';
import { decryptWalletData } from '../wallet-encryption';
import { db } from '../db';
import { riddleWallets } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// NFT Transfer endpoint
router.post('/transfer', sessionAuth, async (req: Request, res: Response) => {
  try {
    const { nftokenID, recipientAddress, destinationTag, memo } = req.body;
    const user = (req as any).user;

    if (!nftokenID || !recipientAddress) {
      return res.status(400).json({
        success: false,
        error: 'NFT Token ID and recipient address are required'
      });
    }

    if (!user?.handle) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    // Validate XRPL address format
    if (!/^r[a-zA-Z0-9]{24,34}$/.test(recipientAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid XRPL recipient address'
      });
    }

    // Use cached private keys from sessionAuth (same as payment endpoint)
    if (!user?.cachedKeys?.xrpPrivateKey) {
      return res.status(401).json({
        success: false,
        error: 'XRP wallet not found in session'
      });
    }

    // Create XRPL client and wallet
    const client = new XRPLClient('wss://s1.ripple.com');
    await client.connect();

    const senderWallet = Wallet.fromSeed(user.cachedKeys.xrpPrivateKey);

    // Create NFToken transfer transaction (actually a CreateOffer with amount 0)
    const transferTx: any = {
      TransactionType: 'NFTokenCreateOffer',
      Account: senderWallet.address,
      NFTokenID: nftokenID,
      Amount: '0', // Transfer for free
      Destination: recipientAddress,
      Flags: 1 // tfSellNFToken
    };

    // Add optional fields
    if (destinationTag) {
      transferTx.DestinationTag = destinationTag;
    }

    if (memo) {
      transferTx.Memos = [{
        Memo: {
          MemoData: Buffer.from(memo, 'utf8').toString('hex').toUpperCase()
        }
      }];
    }

    console.log(`🔄 [NFT TRANSFER] Creating transfer offer for NFT ${nftokenID} to ${recipientAddress}`);

    // Submit and wait for validation
    const result = await client.submitAndWait(transferTx, { wallet: senderWallet });

    await client.disconnect();

    if (result.result.meta && typeof result.result.meta === 'object' && 'TransactionResult' in result.result.meta) {
      if (result.result.meta.TransactionResult === 'tesSUCCESS') {
        console.log(`✅ [NFT TRANSFER] Transfer successful: ${result.result.hash}`);
        
        res.json({
          success: true,
          txHash: result.result.hash,
          message: 'NFT transfer offer created successfully'
        });
      } else {
        throw new Error(`Transaction failed: ${result.result.meta.TransactionResult}`);
      }
    } else {
      throw new Error('Transaction result not available');
    }

  } catch (error) {
    console.error('❌ [NFT TRANSFER] Transfer failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'NFT transfer failed'
    });
  }
});

export default router;