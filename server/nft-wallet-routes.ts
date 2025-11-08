import { Express } from 'express';
import { requireAuthentication, AuthenticatedRequest, sessionAuth } from './middleware/session-auth';

// Simple NFT types for compatibility
interface NFTMintOptions {
  taxon?: number;
  transferFee?: number;
  flags?: number;
  uri?: string;
  issuer?: string;
}

interface NFTOfferOptions {
  nftId: string;
  amount: string;
  destination?: string;
  expiration?: number;
}

export function registerNFTWalletRoutes(app: Express) {
  console.log('🎨 Registering NFT Wallet routes...');

  // =============================================================================
  // LIVE NFT DATA ENDPOINTS - FETCH REAL DATA FROM BITHOMP API
  // =============================================================================

  // Get user's NFTs with live data from Bithomp
  app.get('/api/nft-wallet', requireAuthentication, async (req: AuthenticatedRequest, res) => {
    try {
      console.log('🎨 [NFT WALLET] Fetching live NFTs for authenticated user...');
      
      if (!req.session?.user?.walletData?.xrpAddress) {
        console.log('❌ [NFT WALLET] No XRP address found in session');
        return res.status(400).json({ 
          success: false, 
          error: 'No XRP wallet address found in session' 
        });
      }

      const xrpAddress = req.session.user.walletData.xrpAddress;
      console.log(`🔍 [NFT WALLET] Fetching NFTs for address: ${xrpAddress}`);

      // Fetch NFTs from Bithomp API with premium offer parameters including offersValidate
      const response = await fetch(`https://bithomp.com/api/v2/nfts?owner=${xrpAddress}&assets=true&buyOffers=true&sellOffers=true&offersValidate=true&limit=200`, {
        headers: {
          'x-bithomp-token': process.env.BITHOMP_API_KEY || '',
          'Accept': 'application/json',
          'User-Agent': 'RiddleSwap/1.0'
        }
      });

      if (!response.ok) {
        console.log(`❌ [NFT WALLET] Bithomp API error: ${response.status}`);
        return res.status(500).json({ 
          success: false, 
          error: `Failed to fetch NFTs: ${response.status}` 
        });
      }

      const data = await response.json() as any;
      const nfts = data.nfts || [];
      
      console.log(`✅ [NFT WALLET] Found ${nfts.length} NFTs for ${xrpAddress}`);
      
      // Transform NFT data to include offers count
      const transformedNFTs = nfts.map((nft: any) => ({
        ...nft,
        hasOffers: (nft.buyOffers?.length || 0) > 0 || (nft.sellOffers?.length || 0) > 0,
        offersCount: (nft.buyOffers?.length || 0) + (nft.sellOffers?.length || 0),
        incomingOffers: nft.buyOffers?.filter((offer: any) => offer.account !== xrpAddress) || [],
        outgoingOffers: nft.sellOffers?.filter((offer: any) => offer.account === xrpAddress) || []
      }));

      return res.json({
        success: true,
        nfts: transformedNFTs,
        owner: xrpAddress,
        count: transformedNFTs.length
      });

    } catch (error: any) {
      console.error('❌ [NFT WALLET] Error fetching NFTs:', error);
      return res.status(500).json({ 
        success: false, 
        error: error.message || 'Failed to fetch NFTs' 
      });
    }
  });

  // Get wallet settings (for frontend compatibility)
  app.get('/api/nft-wallet/wallet/:walletId/settings', requireAuthentication, async (req: AuthenticatedRequest, res) => {
    try {
      const walletId = req.params.walletId;
      console.log(`🔧 [NFT WALLET] Getting settings for wallet: ${walletId}`);
      
      // Return basic wallet settings
      return res.json({
        success: true,
        settings: {
          walletId: walletId,
          autoAcceptOffers: false,
          showTestNFTs: false,
          defaultOffer: '1000000' // 1 XRP in drops
        }
      });
    } catch (error: any) {
      console.error('❌ [NFT WALLET] Error getting settings:', error);
      return res.status(500).json({ 
        success: false, 
        error: error.message || 'Failed to get wallet settings' 
      });
    }
  });

  // =============================================================================
  // NFT OFFERS ENDPOINTS - REAL OFFER MANAGEMENT
  // =============================================================================

  // Accept an offer - robust implementation for both buy and sell offers
  app.post('/api/nft-wallet/offers/:offerId/accept', requireAuthentication, async (req: AuthenticatedRequest, res) => {
    try {
      const offerId = req.params.offerId;
      
      console.log(`💰 [NFT WALLET] Accepting offer: ${offerId}`);
      
      // Get session data with private keys
      const sessionData = req.session;
      if (!sessionData?.privateKeys?.xrp) {
        return res.status(401).json({
          success: false,
          error: 'XRP private key not found in session'
        });
      }

      const { Client, Wallet } = await import('xrpl');
      const client = new Client('wss://s1.ripple.com');
      await client.connect();

      // Create wallet from session private key
      const wallet = Wallet.fromSeed(sessionData.privateKeys.xrp);
      
      // Look up the offer to determine if it's a buy or sell offer - must be authoritative
      let offerType: 'buy' | 'sell' | null = null;
      try {
        const ledgerEntryRequest = {
          command: 'ledger_entry' as const,
          index: offerId
        };
        const ledgerResponse = await client.request(ledgerEntryRequest);
        
        if (ledgerResponse.result?.node) {
          const offer = ledgerResponse.result.node as any;
          // If the offer has Flags with tfSellNFToken (1), it's a sell offer
          // Otherwise it's a buy offer
          if (offer.Flags && (offer.Flags & 1)) {
            offerType = 'sell';
          } else {
            offerType = 'buy';
          }
        }
      } catch (lookupError) {
        console.error(`❌ [NFT WALLET] Failed to look up offer ${offerId}:`, lookupError);
        await client.disconnect();
        return res.status(502).json({
          success: false,
          error: `Could not determine offer type for ${offerId}. Please try again or check if the offer still exists.`,
          guidance: 'The offer may have been cancelled or already accepted by someone else.'
        });
      }
      
      if (!offerType) {
        await client.disconnect();
        return res.status(400).json({
          success: false,
          error: 'Could not determine if this is a buy or sell offer',
          guidance: 'The offer may be invalid or corrupted.'
        });
      }
      
      // Build accept transaction based on offer type
      const acceptOfferTransaction: any = {
        TransactionType: 'NFTokenAcceptOffer' as const,
        Account: wallet.address
      };
      
      if (offerType === 'buy') {
        acceptOfferTransaction.NFTokenBuyOffer = offerId;
      } else {
        acceptOfferTransaction.NFTokenSellOffer = offerId;
      }

      // Let XRPL.js autofill fee and sequence
      const prepared = await client.autofill(acceptOfferTransaction);
      const signed = wallet.sign(prepared);
      const response = await client.submitAndWait(signed.tx_blob);
      await client.disconnect();
      
      // Proper success validation
      const isSuccess = response.result.validated && 
                       response.result.meta && 
                       typeof response.result.meta === 'object' && 
                       'TransactionResult' in response.result.meta && 
                       response.result.meta.TransactionResult === 'tesSUCCESS';
      
      if (isSuccess) {
        console.log(`✅ [NFT WALLET] ${offerType} offer accepted successfully: ${response.result.hash}`);
        return res.json({
          success: true,
          message: `${offerType === 'buy' ? 'Buy' : 'Sell'} offer accepted successfully`,
          hash: response.result.hash,
          validated: response.result.validated,
          offerId: offerId,
          offerType: offerType
        });
      } else {
        const errorResult = response.result.meta && typeof response.result.meta === 'object' && 'TransactionResult' in response.result.meta ? response.result.meta.TransactionResult : 'Unknown error';
        return res.status(400).json({
          success: false,
          error: `Accept offer failed: ${errorResult}`
        });
      }
      
    } catch (error: any) {
      console.error('❌ [NFT WALLET] Error accepting offer:', error);
      return res.status(500).json({ 
        success: false, 
        error: error.message || 'Failed to accept offer' 
      });
    }
  });

  // Cancel an offer - only works for offers you created
  app.post('/api/nft-wallet/offers/:offerId/cancel', sessionAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const offerId = req.params.offerId;
      const user = (req as any).user;
      console.log(`❌ [NFT WALLET] Cancelling offer: ${offerId}`);
      
      // Get XRP private key from sessionAuth cached keys
      const xrpPrivateKey = user?.cachedKeys?.xrpPrivateKey;
      if (!xrpPrivateKey) {
        console.error('❌ [NFT WALLET] No XRP private key in cached keys');
        return res.status(401).json({
          success: false,
          error: 'XRP wallet not found in session'
        });
      }
      console.log(`✅ [NFT WALLET] Private key retrieved from cachedKeys`);

      const { Client, Wallet } = await import('xrpl');
      const client = new Client('wss://s1.ripple.com');
      await client.connect();

      // Create wallet from cached private key
      const wallet = Wallet.fromSeed(xrpPrivateKey);
      
      // Verify you can cancel this offer (must be the creator)
      try {
        const ledgerEntryRequest = {
          command: 'ledger_entry' as const,
          index: offerId
        };
        const ledgerResponse = await client.request(ledgerEntryRequest);
        
        if (ledgerResponse.result?.node) {
          const offer = ledgerResponse.result.node as any;
          // NFTokenOffer entries use 'Owner' field, not 'Account'
          const offerOwner = offer.Owner || offer.Account; // fallback to Account for safety
          if (offerOwner !== wallet.address) {
            await client.disconnect();
            return res.status(400).json({
              success: false,
              error: 'You can only cancel offers you created. You cannot reject incoming offers - they will expire automatically or can be ignored.',
              offerOwner: offerOwner,
              yourAddress: wallet.address
            });
          }
        }
      } catch (lookupError) {
        console.warn(`⚠️ [NFT WALLET] Could not verify offer ownership for ${offerId}:`, lookupError);
      }
      
      // Cancel the NFT offer - XRPL.js compliant structure
      const cancelOfferTransaction = {
        TransactionType: 'NFTokenCancelOffer' as const,
        Account: wallet.address,
        NFTokenOffers: [offerId] // Array of offer IDs to cancel
      };

      // Let XRPL.js autofill fee and sequence
      const prepared = await client.autofill(cancelOfferTransaction);
      const signed = wallet.sign(prepared);
      const response = await client.submitAndWait(signed.tx_blob);
      await client.disconnect();
      
      // Proper success validation
      const isSuccess = response.result.validated && 
                       response.result.meta && 
                       typeof response.result.meta === 'object' && 
                       'TransactionResult' in response.result.meta && 
                       response.result.meta.TransactionResult === 'tesSUCCESS';
      
      if (isSuccess) {
        console.log(`✅ [NFT WALLET] Offer cancelled successfully: ${response.result.hash}`);
        return res.json({
          success: true,
          message: 'Your offer was cancelled successfully',
          hash: response.result.hash,
          validated: response.result.validated,
          offerId: offerId
        });
      } else {
        const errorResult = response.result.meta && typeof response.result.meta === 'object' && 'TransactionResult' in response.result.meta ? response.result.meta.TransactionResult : 'Unknown error';
        return res.status(400).json({
          success: false,
          error: `Cancel offer failed: ${errorResult}`
        });
      }
      
    } catch (error: any) {
      console.error('❌ [NFT WALLET] Error cancelling offer:', error);
      return res.status(500).json({ 
        success: false, 
        error: error.message || 'Failed to cancel offer' 
      });
    }
  });
  
  // Legacy route - redirect to cancel
  app.post('/api/nft-wallet/offers/:offerId/reject', requireAuthentication, async (req: AuthenticatedRequest, res) => {
    return res.status(400).json({
      success: false,
      error: 'Use /cancel instead of /reject. You can only cancel offers you created, not reject incoming offers.',
      guidance: 'Call POST /api/nft-wallet/offers/:offerId/cancel to cancel your own offers'
    });
  });

  // Send/Transfer NFT - create transfer offer with correct messaging
  app.post('/api/nft-wallet/send-nft', requireAuthentication, async (req: AuthenticatedRequest, res) => {
    try {
      const { nftId, destination, destinationTag } = req.body;
      console.log(`📤 [NFT WALLET] Creating transfer offer for NFT ${nftId} to ${destination}`);
      
      if (!nftId || !destination) {
        return res.status(400).json({
          success: false,
          error: 'NFT ID and destination address are required'
        });
      }
      
      // Get session data with private keys
      const sessionData = req.session;
      if (!sessionData?.privateKeys?.xrp) {
        return res.status(401).json({
          success: false,
          error: 'XRP private key not found in session'
        });
      }

      const { Client, Wallet } = await import('xrpl');
      const client = new Client('wss://s1.ripple.com');
      await client.connect();

      // Create wallet from session private key
      const wallet = Wallet.fromSeed(sessionData.privateKeys.xrp);
      
      // Create NFT transfer offer (amount = 0 for free transfer)
      const transferTransaction = {
        TransactionType: 'NFTokenCreateOffer' as const,
        Account: wallet.address,
        NFTokenID: nftId,
        Amount: '0', // Free transfer
        Destination: destination,
        ...(destinationTag !== undefined && destinationTag !== null ? { DestinationTag: destinationTag } : {}),
        Flags: 1 // tfSellNFToken flag
      };

      // Let XRPL.js autofill fee and sequence
      const prepared = await client.autofill(transferTransaction);
      const signed = wallet.sign(prepared);
      const response = await client.submitAndWait(signed.tx_blob);
      await client.disconnect();
      
      // Proper success validation
      const isSuccess = response.result.validated && 
                       response.result.meta && 
                       typeof response.result.meta === 'object' && 
                       'TransactionResult' in response.result.meta && 
                       response.result.meta.TransactionResult === 'tesSUCCESS';
      
      if (isSuccess) {
        // Extract offer ID from transaction metadata - correct parsing
        let offerId = null;
        try {
          const meta = response.result.meta as any;
          if (meta?.AffectedNodes) {
            for (const node of meta.AffectedNodes) {
              if (node.CreatedNode && node.CreatedNode.LedgerEntryType === 'NFTokenOffer') {
                offerId = node.CreatedNode.LedgerIndex;
                break;
              }
            }
          }
        } catch (parseError) {
          console.warn('Could not parse offer ID from transaction metadata');
        }
        
        console.log(`✅ [NFT WALLET] Transfer offer created: ${response.result.hash}`);
        return res.json({
          success: true,
          message: 'Transfer offer created successfully - recipient must accept to complete transfer',
          hash: response.result.hash,
          validated: response.result.validated,
          nftId: nftId,
          destination: destination,
          offerId: offerId,
          note: 'This creates a free transfer offer. The recipient must accept it to complete the transfer.',
          acceptanceGuidance: offerId ? `The recipient can accept this offer by calling POST /api/nft-wallet/offers/${offerId}/accept` : 'Offer ID could not be extracted - recipient should check NFT offers and accept the transfer offer'
        });
      } else {
        const errorResult = response.result.meta && typeof response.result.meta === 'object' && 'TransactionResult' in response.result.meta ? response.result.meta.TransactionResult : 'Unknown error';
        return res.status(400).json({
          success: false,
          error: `Transfer offer creation failed: ${errorResult}`
        });
      }
      
    } catch (error: any) {
      console.error('❌ [NFT WALLET] Error creating transfer offer:', error);
      return res.status(500).json({ 
        success: false, 
        error: error.message || 'Failed to create transfer offer' 
      });
    }
  });

  // =============================================================================
  // LEGACY ENDPOINTS (REDIRECT TO DEVELOPER DASHBOARD)
  // =============================================================================

  // All other NFT operations redirect to developer dashboard
  const nftDashboardMessage = {
    success: false,
    error: 'NFT operations have been moved to the Developer Dashboard for better functionality',
    redirectTo: '/developer-dashboard'
  };

  // Mint new NFT
  app.post('/api/nft/mint', requireAuthentication, async (req: AuthenticatedRequest, res) => {
    try {
      const { taxon, quantity = 1, metadataUri, transferFee = 0, flags = 8 } = req.body;
      
      if (!taxon) {
        return res.status(400).json({
          success: false,
          error: 'Collection taxon is required'
        });
      }

      // Get session data with private keys
      const sessionData = req.session;
      if (!sessionData?.privateKeys?.xrp) {
        return res.status(401).json({
          success: false,
          error: 'XRP private key not found in session'
        });
      }

      console.log(`🎨 [NFT MINT] Minting ${quantity} NFT(s) for collection ${taxon}`);

      const { Client, Wallet } = await import('xrpl');
      const client = new Client('wss://s1.ripple.com');
      await client.connect();

      // Create wallet from session private key
      const wallet = Wallet.fromSeed(sessionData.privateKeys.xrp);
      
      const results = [];
      
      // Mint each NFT separately (XRPL requirement)
      for (let i = 0; i < quantity; i++) {
        const mintTransaction = {
          TransactionType: 'NFTokenMint' as const,
          Account: wallet.address,
          NFTokenTaxon: taxon,
          URI: metadataUri ? Buffer.from(metadataUri, 'utf8').toString('hex').toUpperCase() : undefined,
          TransferFee: transferFee, // In ten-thousandths (0-50000)
          Flags: flags, // tfTransferable by default
          Fee: '12'
        };

        const response = await client.submitAndWait(mintTransaction, { wallet });
        
        // Check if successful
        const isSuccess = response.result.meta && 
                         typeof response.result.meta === 'object' && 
                         'TransactionResult' in response.result.meta && 
                         response.result.meta.TransactionResult === 'tesSUCCESS';
        
        if (isSuccess) {
          // Extract NFT ID from transaction metadata
          let nftId = null;
          if (response.result.meta && typeof response.result.meta === 'object' && 'CreatedNode' in response.result.meta) {
            const meta = response.result.meta as any;
            if (meta.AffectedNodes) {
              for (const node of meta.AffectedNodes) {
                if (node.CreatedNode && node.CreatedNode.LedgerEntryType === 'NFToken') {
                  nftId = node.CreatedNode.LedgerIndex;
                  break;
                }
              }
            }
          }
          
          results.push({
            success: true,
            hash: response.result.hash,
            nftId: nftId,
            validated: response.result.validated
          });
          
          console.log(`✅ [NFT MINT] NFT ${i + 1}/${quantity} minted successfully: ${response.result.hash}`);
        } else {
          const errorResult = response.result.meta && typeof response.result.meta === 'object' && 'TransactionResult' in response.result.meta ? response.result.meta.TransactionResult : 'Unknown error';
          results.push({
            success: false,
            error: `Mint ${i + 1} failed: ${errorResult}`
          });
          console.log(`❌ [NFT MINT] NFT ${i + 1}/${quantity} failed: ${errorResult}`);
        }
      }

      await client.disconnect();

      const successCount = results.filter(r => r.success).length;
      
      return res.json({
        success: successCount > 0,
        message: `Successfully minted ${successCount}/${quantity} NFT(s)`,
        results: results,
        totalMinted: successCount
      });

    } catch (error: any) {
      console.error('❌ [NFT MINT] Error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to mint NFT'
      });
    }
  });

  // Create sell offer
  app.post('/api/nft/sell-offer', requireAuthentication, async (req: AuthenticatedRequest, res) => {
    res.json(nftDashboardMessage);
  });

  // Create buy offer
  app.post('/api/nft/buy-offer', requireAuthentication, async (req: AuthenticatedRequest, res) => {
    res.json(nftDashboardMessage);
  });

  // Accept sell offer
  app.post('/api/nft/accept-sell-offer', requireAuthentication, async (req: AuthenticatedRequest, res) => {
    res.json(nftDashboardMessage);
  });

  // Accept buy offer
  app.post('/api/nft/accept-buy-offer', requireAuthentication, async (req: AuthenticatedRequest, res) => {
    res.json(nftDashboardMessage);
  });

  // Cancel offers
  app.post('/api/nft/cancel-offers', requireAuthentication, async (req: AuthenticatedRequest, res) => {
    res.json(nftDashboardMessage);
  });

  // Burn NFT
  app.post('/api/nft/burn', requireAuthentication, async (req: AuthenticatedRequest, res) => {
    res.json(nftDashboardMessage);
  });

  // Get NFT offers
  app.get('/api/nft/offers/:nftId', requireAuthentication, async (req: AuthenticatedRequest, res) => {
    res.json({
      success: true,
      sellOffers: [],
      buyOffers: [],
      message: 'NFT trading moved to Developer Dashboard'
    });
  });

  // Get account NFTs
  app.get('/api/nft/account/:walletKey', requireAuthentication, async (req: AuthenticatedRequest, res) => {
    res.json({
      success: true,
      nfts: [],
      message: 'NFT viewing moved to Developer Dashboard'
    });
  });

  console.log('✅ NFT Wallet routes registered successfully');
}