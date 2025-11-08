import type { Express } from 'express';
import { XRPLTransactionService } from './xrpl-transaction-service';

export function registerXRPLTransactionRoutes(app: Express) {
  console.log('🔄 Registering XRPL transaction routes (Payment & OfferCreate)...');

  // Payment transaction endpoint (immediate swap)
  app.post('/api/xrpl/payment/instant', async (req, res) => {
    try {
      const {
        transactionType,
        account,
        amount,
        sendMax,
        destination,
        flags,
        paths,
        walletAddress,
        walletType,
        riddleWalletId,
        password
      } = req.body;

      console.log(`🔄 XRPL Payment: ${JSON.stringify(sendMax)} → ${JSON.stringify(amount)} for wallet ${riddleWalletId}`);

      if (!account || !amount || !sendMax || !destination || !password) {
        return res.status(400).json({
          success: false,
          error: 'Missing required Payment transaction parameters'
        });
      }

      // Get wallet private key (same logic as existing exchange)
      const { storage } = await import('./storage');
      const { decryptWalletData } = await import('./wallet-encryption');
      
      const walletData = await storage.getRiddleWalletByHandle(riddleWalletId);
      if (!walletData) {
        return res.status(404).json({
          success: false,
          error: 'Wallet not found'
        });
      }

      // Decrypt private key
      let privateKey: string;
      try {
        const decryptedKeysJson = decryptWalletData(walletData.encryptedPrivateKeys as any, password);
        const privateKeys = JSON.parse(decryptedKeysJson);
        
        // Handle different XRP key formats
        if (typeof privateKeys.xrp === 'string') {
          privateKey = privateKeys.xrp;
        } else if (privateKeys.xrp && typeof privateKeys.xrp === 'object') {
          privateKey = privateKeys.xrp.privateKey || privateKeys.xrp.seed;
        } else {
          privateKey = privateKeys.xrpPrivateKey || privateKeys.private_key || privateKeys.privateKey;
        }

        if (!privateKey) {
          throw new Error("XRP private key not found in wallet");
        }
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: "Failed to decrypt private key"
        });
      }

      // Execute Payment transaction
      const result = await XRPLTransactionService.executePayment(
        {
          transactionType: 'Payment',
          account,
          amount,
          sendMax,
          destination,
          flags: flags || 0x00020000, // tfPartialPayment
          paths: paths && paths.length > 0 ? paths : undefined
        },
        privateKey
      );

      if (result.success) {
        res.json({
          success: true,
          txHash: result.txHash,
          deliveredAmount: result.deliveredAmount,
          transactionType: 'Payment'
        });
      } else {
        throw new Error(result.error || 'Payment transaction failed');
      }

    } catch (error) {
      console.error('Payment transaction error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Payment transaction failed'
      });
    }
  });

  // OfferCreate transaction endpoint (limit order)
  app.post('/api/xrpl/offer/create', async (req, res) => {
    try {
      const {
        transactionType,
        account,
        takerPays,
        takerGets,
        flags,
        expiration,
        walletAddress,
        walletType,
        riddleWalletId,
        password,
        customRate
      } = req.body;

      console.log(`🔄 XRPL OfferCreate: ${JSON.stringify(takerGets)} → ${JSON.stringify(takerPays)} at rate ${customRate} for wallet ${riddleWalletId}`);

      if (!account || !takerPays || !takerGets || !password) {
        return res.status(400).json({
          success: false,
          error: 'Missing required OfferCreate transaction parameters'
        });
      }

      // Get wallet private key (same logic as Payment)
      const { storage } = await import('./storage');
      const { decryptWalletData } = await import('./wallet-encryption');
      
      const walletData = await storage.getRiddleWalletByHandle(riddleWalletId);
      if (!walletData) {
        return res.status(404).json({
          success: false,
          error: 'Wallet not found'
        });
      }

      // Decrypt private key
      let privateKey: string;
      try {
        const decryptedKeysJson = decryptWalletData(walletData.encryptedPrivateKeys as any, password);
        const privateKeys = JSON.parse(decryptedKeysJson);
        
        // Handle different XRP key formats
        if (typeof privateKeys.xrp === 'string') {
          privateKey = privateKeys.xrp;
        } else if (privateKeys.xrp && typeof privateKeys.xrp === 'object') {
          privateKey = privateKeys.xrp.privateKey || privateKeys.xrp.seed;
        } else {
          privateKey = privateKeys.xrpPrivateKey || privateKeys.private_key || privateKeys.privateKey;
        }

        if (!privateKey) {
          throw new Error("XRP private key not found in wallet");
        }
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: "Failed to decrypt private key"
        });
      }

      // Execute OfferCreate transaction
      const result = await XRPLTransactionService.executeOfferCreate(
        {
          transactionType: 'OfferCreate',
          account,
          takerPays,
          takerGets,
          flags: flags || 0x00020000, // tfPartialPayment
          expiration
        },
        privateKey
      );

      if (result.success) {
        res.json({
          success: true,
          txHash: result.txHash,
          offerId: result.offerId,
          transactionType: 'OfferCreate',
          customRate
        });
      } else {
        throw new Error(result.error || 'OfferCreate transaction failed');
      }

    } catch (error) {
      console.error('OfferCreate transaction error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'OfferCreate transaction failed'
      });
    }
  });

  // Get account offers endpoint  
  app.get('/api/xrpl/offers/:accountAddress', async (req, res) => {
    try {
      const { accountAddress } = req.params;
      
      const result = await XRPLTransactionService.getAccountOffers(accountAddress);
      
      if (result.success) {
        // Transform offers into our format
        const orders = result.offers?.map(offer => ({
          id: offer.seq || offer.offer_id,
          type: 'sell', // XRPL offers are always "sell" type
          fromToken: {
            symbol: typeof offer.taker_gets === 'string' ? 'XRP' : offer.taker_gets.currency,
            issuer: typeof offer.taker_gets === 'string' ? '' : offer.taker_gets.issuer,
            name: typeof offer.taker_gets === 'string' ? 'XRP' : offer.taker_gets.currency
          },
          toToken: {
            symbol: typeof offer.taker_pays === 'string' ? 'XRP' : offer.taker_pays.currency,
            issuer: typeof offer.taker_pays === 'string' ? '' : offer.taker_pays.issuer,
            name: typeof offer.taker_pays === 'string' ? 'XRP' : offer.taker_pays.currency
          },
          fromAmount: typeof offer.taker_gets === 'string' 
            ? (parseInt(offer.taker_gets) / 1000000).toString() 
            : offer.taker_gets.value,
          toAmount: typeof offer.taker_pays === 'string' 
            ? (parseInt(offer.taker_pays) / 1000000).toString() 
            : offer.taker_pays.value,
          rate: offer.quality || '0',
          expiration: offer.expiration ? new Date(offer.expiration * 1000).toISOString() : '',
          status: 'active',
          createdAt: new Date().toISOString()
        })) || [];

        res.json({
          success: true,
          orders
        });
      } else {
        throw new Error(result.error || 'Failed to get offers');
      }

    } catch (error) {
      console.error('Get offers error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get offers'
      });
    }
  });

  // Cancel offer endpoint
  app.post('/api/xrpl/offer/cancel', async (req, res) => {
    try {
      const {
        offerId,
        walletAddress,
        riddleWalletId,
        password
      } = req.body;

      if (!offerId || !walletAddress || !password) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters for offer cancellation'
        });
      }

      // Get wallet private key
      const { storage } = await import('./storage');
      const { decryptWalletData } = await import('./wallet-encryption');
      
      const walletData = await storage.getRiddleWalletByHandle(riddleWalletId);
      if (!walletData) {
        return res.status(404).json({
          success: false,
          error: 'Wallet not found'
        });
      }

      // Decrypt private key
      let privateKey: string;
      try {
        const decryptedKeysJson = decryptWalletData(walletData.encryptedPrivateKeys as any, password);
        const privateKeys = JSON.parse(decryptedKeysJson);
        
        privateKey = privateKeys.xrp?.privateKey || privateKeys.xrp?.seed || privateKeys.xrp || 
                    privateKeys.xrpPrivateKey || privateKeys.private_key || privateKeys.privateKey;

        if (!privateKey) {
          throw new Error("XRP private key not found in wallet");
        }
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: "Failed to decrypt private key"
        });
      }

      // Cancel the offer
      const result = await XRPLTransactionService.cancelOffer(
        walletAddress,
        parseInt(offerId),
        privateKey
      );

      if (result.success) {
        res.json({
          success: true,
          txHash: result.txHash
        });
      } else {
        throw new Error(result.error || 'Offer cancellation failed');
      }

    } catch (error) {
      console.error('Cancel offer error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Offer cancellation failed'
      });
    }
  });

  console.log('✅ XRPL transaction routes registered (Payment & OfferCreate)');
}
