import { Express } from 'express';
import { requireAuthentication, AuthenticatedRequest, sessionAuth } from './middleware/session-auth';
import { Client, Wallet, xrpToDrops } from 'xrpl';
import { z } from 'zod';

// Validation schemas for security
const walletAddressSchema = z.object({
  walletAddress: z.string().min(25).max(35).regex(/^r[a-zA-Z0-9]{24,34}$/, 'Invalid XRP wallet address format')
});

const offerIdSchema = z.string().min(64).max(64).regex(/^[A-F0-9]{64}$/i, 'Invalid offer ID format');

/**
 * Filter Bithomp response to only include actual NFT offers
 * Excludes NFTokenMint, NFTokenCancelOffer, and other non-offer transactions
 * 
 * Bithomp identifies offers by:
 * - presence of offerIndex (unique offer ID)
 * - flags object with sellToken/buyToken
 * - amount field (even if "0" for transfers)
 */
function filterOnlyOffers(offers: any[]): any[] {
  return offers.filter(item => {
    // Accept if item has offerIndex (primary offer identifier)
    if (item?.offerIndex) {
      return true;
    }
    
    // Check transaction type if available
    const txType = item?.transaction?.TransactionType || 
                   item?.specification?.type || 
                   item?.tx?.TransactionType ||
                   item?.TransactionType;
    
    // Exclude known non-offer transaction types
    const excludeTypes = ['NFTokenMint', 'NFTokenCancelOffer', 'NFTokenBurn', 'Payment', 'TrustSet'];
    if (txType && excludeTypes.includes(txType)) {
      return false;
    }
    
    // Accept if transaction type explicitly indicates offer creation
    if (txType === 'NFTokenCreateOffer') {
      return true;
    }
    
    // Accept if has typical offer structure (flags + amount)
    if (item?.flags !== undefined && item?.amount !== undefined) {
      return true;
    }
    
    // Default: exclude if we can't confirm it's an offer
    return false;
  });
}

export function registerNFTOffersRoutes(app: Express) {
  console.log('💼 Registering NFT Offers routes...');

  // Get incoming offers for a wallet - ONLY from Bithomp CDN API
  app.get('/api/nft/offers/incoming', async (req, res) => {
    try {
      // Validate wallet address
      const validation = walletAddressSchema.safeParse(req.query);
      if (!validation.success) {
        return res.status(400).json({ 
          error: 'Invalid wallet address', 
          details: validation.error.issues 
        });
      }
      
      const { walletAddress } = validation.data;

      console.log(`🔍 [BITHOMP OFFERS] Fetching live offers for: ${walletAddress}`);

      // Use PREMIUM Bithomp v2 API with list=counterOffers (buy offers on owned NFTs)
      const bithompUrl = `https://bithomp.com/api/v2/nft-offers/${encodeURIComponent(walletAddress as string)}?list=counterOffers&offersValidate=true&nftoken=true`;
      console.log(`📡 [BITHOMP OFFERS] Premium API URL: ${bithompUrl}`);
      
      const bithompApiKey = process.env.BITHOMP_API_KEY;
      const bithompResponse = await fetch(bithompUrl, {
        headers: bithompApiKey ? { 'x-bithomp-token': bithompApiKey } : {}
      });
      
      if (!bithompResponse.ok) {
        console.error(`❌ [BITHOMP OFFERS] API error: ${bithompResponse.status}`);
        return res.json({ offers: [], success: true }); // Return empty offers instead of error
      }

      const bithompData = await bithompResponse.json();
      const rawOffers = bithompData.nftOffers || bithompData.offers || [];
      console.log(`📥 [BITHOMP OFFERS] Received ${rawOffers.length} items from Bithomp`);
      
      // Filter to only include NFTokenCreateOffer transactions (exclude NFTokenMint, etc.)
      const offers = filterOnlyOffers(rawOffers);
      console.log(`✅ [BITHOMP OFFERS] Filtered to ${offers.length} valid offers (excluded ${rawOffers.length - offers.length} non-offer transactions)`);
      
      // Return filtered live offers data
      res.json({
        offers,
        success: true,
        source: 'bithomp_cdn'
      });
      
    } catch (error) {
      console.error('❌ [BITHOMP OFFERS] Error fetching live offers:', error);
      res.json({ offers: [], success: true }); // Return empty instead of error
    }
  });

  // Get outgoing offers from a wallet (sell offers created by this wallet)
  app.get('/api/nft/offers/outgoing', async (req, res) => {
    try {
      // Validate wallet address
      const validation = walletAddressSchema.safeParse(req.query);
      if (!validation.success) {
        return res.status(400).json({ 
          error: 'Invalid wallet address', 
          details: validation.error.issues 
        });
      }
      
      const { walletAddress } = validation.data;

      console.log(`📤 [BITHOMP OUTGOING] Fetching sell offers for wallet: ${walletAddress}`);
      
      // Use Bithomp premium v2 API DEFAULT list (owned NFT offers = sell offers created by this wallet)
      const bithompUrl = `https://bithomp.com/api/v2/nft-offers/${encodeURIComponent(walletAddress as string)}?offersValidate=true&nftoken=true`;
      console.log(`📡 [BITHOMP OUTGOING] Premium API URL: ${bithompUrl}`);
      
      const bithompApiKey = process.env.BITHOMP_API_KEY;
      const bithompResponse = await fetch(bithompUrl, {
        headers: bithompApiKey ? { 'x-bithomp-token': bithompApiKey } : {}
      });
      
      if (!bithompResponse.ok) {
        console.error(`❌ [BITHOMP OUTGOING] API error: ${bithompResponse.status}`);
        return res.json({ offers: [], success: true, source: 'bithomp_cdn' });
      }

      const bithompData = await bithompResponse.json();
      const rawOffers = bithompData.nftOffers || bithompData.offers || [];
      console.log(`📥 [BITHOMP OUTGOING] Received ${rawOffers.length} items from Bithomp`);
      
      // Filter to only include NFTokenCreateOffer transactions (exclude NFTokenMint, etc.)
      const offers = filterOnlyOffers(rawOffers);
      console.log(`✅ [BITHOMP OUTGOING] Filtered to ${offers.length} valid sell offers (excluded ${rawOffers.length - offers.length} non-offer transactions)`);
      
      // Return filtered live sell offers data
      res.json({
        offers,
        success: true,
        source: 'bithomp_cdn'
      });
      
    } catch (error) {
      console.error('❌ [BITHOMP OUTGOING] Error fetching sell offers:', error);
      res.json({ offers: [], success: true, source: 'bithomp_cdn' });
    }
  });

  // Get transfers and private offers to a wallet
  app.get('/api/nft/offers/transfers', async (req, res) => {
    try {
      // Validate wallet address
      const validation = walletAddressSchema.safeParse(req.query);
      if (!validation.success) {
        return res.status(400).json({ 
          error: 'Invalid wallet address', 
          details: validation.error.issues 
        });
      }
      
      const { walletAddress } = validation.data;

      console.log(`📦 [BITHOMP TRANSFERS] Fetching transfers/private offers for: ${walletAddress}`);
      
      // Use Bithomp premium v2 API with list=privatelyOfferedToAddress (private offers & transfers)
      const bithompUrl = `https://bithomp.com/api/v2/nft-offers/${encodeURIComponent(walletAddress as string)}?list=privatelyOfferedToAddress&offersValidate=true&nftoken=true`;
      console.log(`📡 [BITHOMP TRANSFERS] Premium API URL: ${bithompUrl}`);
      
      const bithompApiKey = process.env.BITHOMP_API_KEY;
      const bithompResponse = await fetch(bithompUrl, {
        headers: bithompApiKey ? { 'x-bithomp-token': bithompApiKey } : {}
      });
      
      if (!bithompResponse.ok) {
        console.error(`❌ [BITHOMP TRANSFERS] API error: ${bithompResponse.status}`);
        return res.json({ offers: [], success: true, source: 'bithomp_cdn' });
      }

      const bithompData = await bithompResponse.json();
      const rawOffers = bithompData.nftOffers || bithompData.offers || [];
      console.log(`📥 [BITHOMP TRANSFERS] Received ${rawOffers.length} items from Bithomp`);
      
      // Filter to only include NFTokenCreateOffer transactions (exclude NFTokenMint, etc.)
      const offers = filterOnlyOffers(rawOffers);
      console.log(`✅ [BITHOMP TRANSFERS] Filtered to ${offers.length} valid transfers/private offers (excluded ${rawOffers.length - offers.length} non-offer transactions)`);
      
      // Return filtered live transfer/private offer data
      res.json({
        offers,
        success: true,
        source: 'bithomp_cdn'
      });
      
    } catch (error) {
      console.error('❌ [BITHOMP TRANSFERS] Error fetching transfers:', error);
      res.json({ offers: [], success: true, source: 'bithomp_cdn' });
    }
  });

  // Get ALL offers for a wallet (incoming, outgoing, transfers combined)
  app.get('/api/nft/offers/all', async (req, res) => {
    try {
      // Validate wallet address
      const validation = walletAddressSchema.safeParse(req.query);
      if (!validation.success) {
        return res.status(400).json({ 
          error: 'Invalid wallet address', 
          details: validation.error.issues 
        });
      }
      
      const { walletAddress } = validation.data;

      console.log(`🎯 [BITHOMP ALL] Fetching ALL offer types for: ${walletAddress}`);
      
      const bithompApiKey = process.env.BITHOMP_API_KEY;
      const headers: Record<string, string> = {};
      if (bithompApiKey) {
        headers['x-bithomp-token'] = bithompApiKey;
      }
      
      // Fetch all three types in parallel
      const [incomingRes, outgoingRes, transfersRes] = await Promise.all([
        // Incoming: Buy offers on NFTs you own (counterOffers)
        fetch(`https://bithomp.com/api/v2/nft-offers/${encodeURIComponent(walletAddress as string)}?list=counterOffers&offersValidate=true&nftoken=true`, { headers }),
        // Outgoing: Sell offers you created
        fetch(`https://bithomp.com/api/v2/nft-offers/${encodeURIComponent(walletAddress as string)}?offersValidate=true&nftoken=true`, { headers }),
        // Transfers: Private offers & NFT transfers to you
        fetch(`https://bithomp.com/api/v2/nft-offers/${encodeURIComponent(walletAddress as string)}?list=privatelyOfferedToAddress&offersValidate=true&nftoken=true`, { headers })
      ]);
      
      const incomingData = incomingRes.ok ? await incomingRes.json() : { nftOffers: [] };
      const outgoingData = outgoingRes.ok ? await outgoingRes.json() : { nftOffers: [] };
      const transfersData = transfersRes.ok ? await transfersRes.json() : { nftOffers: [] };
      
      const rawIncoming = incomingData.nftOffers || incomingData.offers || [];
      const rawOutgoing = outgoingData.nftOffers || outgoingData.offers || [];
      const rawTransfers = transfersData.nftOffers || transfersData.offers || [];
      
      console.log(`📥 [BITHOMP ALL] Received - Incoming: ${rawIncoming.length}, Outgoing: ${rawOutgoing.length}, Transfers: ${rawTransfers.length}`);
      
      // Filter to only include NFTokenCreateOffer transactions (exclude NFTokenMint, etc.)
      const incomingOffers = filterOnlyOffers(rawIncoming);
      const outgoingOffers = filterOnlyOffers(rawOutgoing);
      const transfersOffers = filterOnlyOffers(rawTransfers);
      
      const filteredCount = (rawIncoming.length - incomingOffers.length) + 
                           (rawOutgoing.length - outgoingOffers.length) + 
                           (rawTransfers.length - transfersOffers.length);
      
      console.log(`✅ [BITHOMP ALL] Filtered offers - Incoming: ${incomingOffers.length}, Outgoing: ${outgoingOffers.length}, Transfers: ${transfersOffers.length} (excluded ${filteredCount} non-offer transactions)`);
      
      res.json({
        incoming: incomingOffers,
        outgoing: outgoingOffers,
        transfers: transfersOffers,
        total: incomingOffers.length + outgoingOffers.length + transfersOffers.length,
        success: true,
        source: 'bithomp_cdn'
      });
      
    } catch (error) {
      console.error('❌ [BITHOMP ALL] Error fetching all offers:', error);
      res.json({ incoming: [], outgoing: [], transfers: [], total: 0, success: true, source: 'bithomp_cdn' });
    }
  });

  // Accept an NFT offer on XRPL blockchain
  app.post('/api/nft/offers/:offerId/accept', sessionAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { offerId } = req.params;
      const user = (req as any).user;
      
      console.log('');
      console.log('═══════════════════════════════════════════════════════════');
      console.log('🎯 [ACCEPT OFFER] Using sessionAuth');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`📋 [ACCEPT] Offer ID: ${offerId}`);
      console.log(`👤 [ACCEPT] User Handle: ${user?.handle || 'UNKNOWN'}`);
      
      // Validate offer ID format
      const offerValidation = offerIdSchema.safeParse(offerId);
      if (!offerValidation.success) {
        console.error('❌ [ACCEPT] Offer ID validation failed:', offerValidation.error.issues);
        return res.status(400).json({ 
          error: 'Invalid offer ID format',
          details: offerValidation.error.issues 
        });
      }
      console.log(`✅ [ACCEPT] Offer ID validation passed`);
      
      // Get XRP private key from sessionAuth cached keys
      const xrpPrivateKey = user?.cachedKeys?.xrpPrivateKey;
      if (!xrpPrivateKey) {
        console.error('❌ [ACCEPT] No XRP private key in cached keys');
        console.log('═══════════════════════════════════════════════════════════');
        return res.status(401).json({ error: 'XRP wallet not found in session' });
      }
      console.log(`✅ [ACCEPT] Private key retrieved from cachedKeys`);
      
      // Create XRPL wallet from private key
      const wallet = Wallet.fromSeed(xrpPrivateKey);
      console.log(`✅ [ACCEPT] Wallet created from seed`);
      console.log(`📍 [ACCEPT] Wallet Address: ${wallet.address}`);
      
      // Connect to XRPL
      const client = new Client('wss://xrplcluster.com');
      console.log(`🔌 [ACCEPT] Connecting to XRPL cluster...`);
      await client.connect();
      console.log(`✅ [ACCEPT] Connected to XRPL successfully`);
      
      // First, fetch the offer details to determine if it's a sell or buy offer
      console.log(`🔍 [ACCEPT] Fetching offer details from ledger...`);
      try {
        const offerResponse = await client.request({
          command: 'ledger_entry',
          index: offerId,
          ledger_index: 'validated'
        });
        
        console.log(`📦 [ACCEPT] Offer Details:`, JSON.stringify(offerResponse.result, null, 2));
        
        const offerNode = offerResponse.result.node as any;
        const isSellOffer = offerNode?.LedgerEntryType === 'NFTokenOffer' && offerNode?.Flags === 1;
        const isBuyOffer = offerNode?.LedgerEntryType === 'NFTokenOffer' && offerNode?.Flags === 0;
        const amount = offerNode?.Amount;
        const owner = offerNode?.Owner;
        const destination = offerNode?.Destination;
        
        console.log(`🔍 [ACCEPT] Offer Analysis:`);
        console.log(`   - Is Sell Offer: ${isSellOffer}`);
        console.log(`   - Is Buy Offer: ${isBuyOffer}`);
        console.log(`   - Amount: ${amount}`);
        console.log(`   - Owner: ${owner}`);
        console.log(`   - Destination: ${destination}`);
        console.log(`   - Is Transfer (0 XRP): ${amount === '0'}`);
        
        // Determine transaction structure based on offer type
        let tx: any;
        if (isSellOffer) {
          // This is a sell offer - use NFTokenSellOffer
          tx = {
            TransactionType: 'NFTokenAcceptOffer' as const,
            Account: wallet.address,
            NFTokenSellOffer: offerId
          };
          console.log(`📤 [ACCEPT] Prepared SELL offer acceptance transaction`);
        } else if (isBuyOffer) {
          // This is a buy offer - use NFTokenBuyOffer
          tx = {
            TransactionType: 'NFTokenAcceptOffer' as const,
            Account: wallet.address,
            NFTokenBuyOffer: offerId
          };
          console.log(`📤 [ACCEPT] Prepared BUY offer acceptance transaction`);
        } else {
          console.error('❌ [ACCEPT] Unknown offer type');
          await client.disconnect();
          return res.status(400).json({
            success: false,
            error: 'Unknown offer type'
          });
        }
        
        console.log(`📋 [ACCEPT] Final Transaction:`, JSON.stringify(tx, null, 2));
        
        // Submit and wait for validation
        console.log(`🚀 [ACCEPT] Submitting transaction to XRPL...`);
        const result = await client.submitAndWait(tx as any, { wallet });
        
        console.log(`📥 [ACCEPT] Transaction Response:`, JSON.stringify(result.result, null, 2));
        
        await client.disconnect();
        console.log(`🔌 [ACCEPT] Disconnected from XRPL`);
        
        if (result.result.meta && typeof result.result.meta === 'object' && 'TransactionResult' in result.result.meta) {
          const txResult = result.result.meta.TransactionResult;
          console.log(`📊 [ACCEPT] Transaction Result: ${txResult}`);
          
          if (txResult === 'tesSUCCESS') {
            console.log(`✅ [ACCEPT] SUCCESS! Offer accepted on blockchain`);
            console.log(`🔗 [ACCEPT] Transaction Hash: ${result.result.hash}`);
            console.log('═══════════════════════════════════════════════════════════');
            res.json({
              success: true,
              txHash: result.result.hash,
              message: 'NFT offer accepted successfully on blockchain'
            });
          } else {
            console.error(`❌ [ACCEPT] Transaction failed with code: ${txResult}`);
            console.log('═══════════════════════════════════════════════════════════');
            res.status(400).json({
              success: false,
              error: txResult,
              message: 'Transaction failed'
            });
          }
        } else {
          console.error('❌ [ACCEPT] No transaction result in response');
          console.log('═══════════════════════════════════════════════════════════');
          res.status(400).json({
            success: false,
            error: 'No transaction result',
            message: 'Transaction failed'
          });
        }
      } catch (ledgerError) {
        console.error('❌ [ACCEPT] Ledger lookup error:', ledgerError);
        console.log('═══════════════════════════════════════════════════════════');
        await client.disconnect();
        throw ledgerError;
      }
      
    } catch (error) {
      // SECURITY: Never expose private keys in error messages
      console.error('❌ [ACCEPT] Fatal Error:', error instanceof Error ? error.message : 'Unknown error');
      console.error('❌ [ACCEPT] Error Stack:', error instanceof Error ? error.stack : 'No stack');
      console.log('═══════════════════════════════════════════════════════════');
      res.status(500).json({ 
        success: false,
        error: 'Failed to accept offer. Please try again.' 
      });
    }
  });

  // Decline an NFT offer on XRPL blockchain
  app.post('/api/nft/offers/:offerId/decline', sessionAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { offerId } = req.params;
      const user = (req as any).user;
      
      console.log('');
      console.log('═══════════════════════════════════════════════════════════');
      console.log('🚫 [DECLINE OFFER] Using sessionAuth');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`📋 [DECLINE] Offer ID: ${offerId}`);
      console.log(`👤 [DECLINE] User Handle: ${user?.handle || 'UNKNOWN'}`);
      
      // Validate offer ID format
      const offerValidation = offerIdSchema.safeParse(offerId);
      if (!offerValidation.success) {
        console.error('❌ [DECLINE] Offer ID validation failed:', offerValidation.error.issues);
        return res.status(400).json({ 
          error: 'Invalid offer ID format',
          details: offerValidation.error.issues 
        });
      }
      console.log(`✅ [DECLINE] Offer ID validation passed`);
      
      // Get XRP private key from sessionAuth cached keys
      const xrpPrivateKey = user?.cachedKeys?.xrpPrivateKey;
      if (!xrpPrivateKey) {
        console.error('❌ [DECLINE] No XRP private key in cached keys');
        console.log('═══════════════════════════════════════════════════════════');
        return res.status(401).json({ error: 'XRP wallet not found in session' });
      }
      console.log(`✅ [DECLINE] Private key retrieved from cachedKeys`);
      
      // Create XRPL wallet from private key
      const wallet = Wallet.fromSeed(xrpPrivateKey);
      console.log(`✅ [DECLINE] Wallet created from seed`);
      console.log(`📍 [DECLINE] Wallet Address: ${wallet.address}`);
      
      // Connect to XRPL
      const client = new Client('wss://xrplcluster.com');
      console.log(`🔌 [DECLINE] Connecting to XRPL cluster...`);
      await client.connect();
      console.log(`✅ [DECLINE] Connected to XRPL successfully`);
      
      // Prepare NFTokenCancelOffer transaction to decline/cancel the offer
      const tx = {
        TransactionType: 'NFTokenCancelOffer' as const,
        Account: wallet.address,
        NFTokenOffers: [offerId] // Array of offer indexes to cancel
      };
      
      console.log(`📋 [DECLINE] Final Transaction:`, JSON.stringify(tx, null, 2));
      
      // Submit and wait for validation
      console.log(`🚀 [DECLINE] Submitting transaction to XRPL...`);
      const result = await client.submitAndWait(tx as any, { wallet });
      
      console.log(`📥 [DECLINE] Transaction Response:`, JSON.stringify(result.result, null, 2));
      
      await client.disconnect();
      console.log(`🔌 [DECLINE] Disconnected from XRPL`);
      
      if (result.result.meta && typeof result.result.meta === 'object' && 'TransactionResult' in result.result.meta) {
        const txResult = result.result.meta.TransactionResult;
        console.log(`📊 [DECLINE] Transaction Result: ${txResult}`);
        
        if (txResult === 'tesSUCCESS') {
          console.log(`✅ [DECLINE] SUCCESS! Offer declined on blockchain`);
          console.log(`🔗 [DECLINE] Transaction Hash: ${result.result.hash}`);
          console.log('═══════════════════════════════════════════════════════════');
          res.json({
            success: true,
            txHash: result.result.hash,
            message: 'NFT offer declined successfully on blockchain'
          });
        } else {
          console.error(`❌ [DECLINE] Transaction failed with code: ${txResult}`);
          console.log('═══════════════════════════════════════════════════════════');
          res.status(400).json({
            success: false,
            error: txResult,
            message: 'Transaction failed'
          });
        }
      } else {
        console.error('❌ [DECLINE] No transaction result in response');
        console.log('═══════════════════════════════════════════════════════════');
        res.status(400).json({
          success: false,
          error: 'No transaction result',
          message: 'Transaction failed'
        });
      }
      
    } catch (error) {
      // SECURITY: Never expose private keys in error messages
      console.error('❌ [DECLINE] Fatal Error:', error instanceof Error ? error.message : 'Unknown error');
      console.error('❌ [DECLINE] Error Stack:', error instanceof Error ? error.stack : 'No stack');
      console.log('═══════════════════════════════════════════════════════════');
      res.status(500).json({ 
        success: false,
        error: 'Failed to decline offer. Please try again.' 
      });
    }
  });

  // Transfer an NFT to another wallet on XRPL blockchain
  app.post('/api/nft/:nftTokenId/transfer', sessionAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { nftTokenId } = req.params;
      const { destinationAddress } = req.body;
      const user = (req as any).user;
      
      console.log('');
      console.log('═══════════════════════════════════════════════════════════');
      console.log('📤 [TRANSFER NFT] Using sessionAuth');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`🎨 [TRANSFER] NFT Token ID: ${nftTokenId}`);
      console.log(`📍 [TRANSFER] Destination: ${destinationAddress}`);
      console.log(`👤 [TRANSFER] User Handle: ${user?.handle || 'UNKNOWN'}`);
      
      // Validate NFT Token ID (64 hex characters)
      if (!nftTokenId || !/^[A-F0-9]{64}$/i.test(nftTokenId)) {
        console.error('❌ [TRANSFER] Invalid NFT Token ID format');
        console.log('═══════════════════════════════════════════════════════════');
        return res.status(400).json({ error: 'Invalid NFT Token ID format' });
      }
      
      // Validate destination address
      if (!destinationAddress || !/^r[a-zA-Z0-9]{24,34}$/.test(destinationAddress)) {
        console.error('❌ [TRANSFER] Invalid destination address');
        console.log('═══════════════════════════════════════════════════════════');
        return res.status(400).json({ error: 'Invalid destination wallet address' });
      }
      
      // Get XRP private key from sessionAuth cached keys
      const xrpPrivateKey = user?.cachedKeys?.xrpPrivateKey;
      if (!xrpPrivateKey) {
        console.error('❌ [TRANSFER] No XRP private key in cached keys');
        console.log('═══════════════════════════════════════════════════════════');
        return res.status(401).json({ error: 'XRP wallet not found in session' });
      }
      console.log(`✅ [TRANSFER] Private key retrieved from cachedKeys`);
      
      // Create XRPL wallet from private key
      const wallet = Wallet.fromSeed(xrpPrivateKey);
      console.log(`✅ [TRANSFER] Wallet created from seed`);
      console.log(`📍 [TRANSFER] Wallet Address: ${wallet.address}`);
      
      // Connect to XRPL
      const client = new Client('wss://xrplcluster.com');
      console.log(`🔌 [TRANSFER] Connecting to XRPL cluster...`);
      await client.connect();
      console.log(`✅ [TRANSFER] Connected to XRPL successfully`);
      
      // Create a sell offer with Amount=0 to specific destination (gift transfer)
      const transferTx = {
        TransactionType: 'NFTokenCreateOffer',
        Account: wallet.address,
        NFTokenID: nftTokenId,
        Amount: '0', // Zero amount = gift/transfer
        Destination: destinationAddress,
        Flags: 1 // tfSellNFToken flag
      };
      
      console.log(`📤 [TRANSFER] Preparing transfer transaction...`);
      console.log(`🎨 [TRANSFER] NFT: ${nftTokenId}`);
      console.log(`📍 [TRANSFER] From: ${wallet.address}`);
      console.log(`📍 [TRANSFER] To: ${destinationAddress}`);
      
      // Submit and wait for validation
      const result = await client.submitAndWait(transferTx as any, { wallet });
      console.log(`📡 [TRANSFER] Transaction submitted and validated`);
      
      await client.disconnect();
      console.log(`🔌 [TRANSFER] Disconnected from XRPL`);
      
      // Check transaction result
      const txResult = (result.result.meta as any)?.TransactionResult;
      if (txResult === 'tesSUCCESS') {
        console.log(`✅ [TRANSFER] SUCCESS! NFT transfer offer created`);
        console.log(`🔗 [TRANSFER] Transaction Hash: ${result.result.hash}`);
        console.log(`💡 [TRANSFER] Recipient must accept this offer to receive the NFT`);
        console.log('═══════════════════════════════════════════════════════════');
        res.json({
          success: true,
          txHash: result.result.hash,
          message: 'NFT transfer offer created successfully. Recipient must accept to receive the NFT.'
        });
      } else {
        console.error(`❌ [TRANSFER] Transaction failed with code: ${txResult}`);
        console.log('═══════════════════════════════════════════════════════════');
        res.status(400).json({
          success: false,
          error: txResult,
          message: 'Transfer failed'
        });
      }
      
    } catch (error) {
      console.error('❌ [TRANSFER] Fatal Error:', error instanceof Error ? error.message : 'Unknown error');
      console.error('❌ [TRANSFER] Error Stack:', error instanceof Error ? error.stack : 'No stack');
      console.log('═══════════════════════════════════════════════════════════');
      res.status(500).json({ 
        success: false,
        error: 'Failed to transfer NFT. Please try again.' 
      });
    }
  });

  // Burn (permanently destroy) an NFT on XRPL blockchain
  app.post('/api/nft/:nftTokenId/burn', requireAuthentication, async (req: AuthenticatedRequest, res) => {
    try {
      const { nftTokenId } = req.params;
      const session = req.session;
      const user = req.user;
      
      console.log('');
      console.log('═══════════════════════════════════════════════════════════');
      console.log('🔥 [BURN NFT] DEBUG SESSION STARTED');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`🎨 [BURN] NFT Token ID: ${nftTokenId}`);
      console.log(`👤 [BURN] User Handle: ${user?.handle || 'UNKNOWN'}`);
      console.log(`🔑 [BURN] Has XRP Private Key: ${!!session?.xrpPrivateKey}`);
      
      // Validate NFT Token ID (64 hex characters)
      if (!nftTokenId || !/^[A-F0-9]{64}$/i.test(nftTokenId)) {
        console.error('❌ [BURN] Invalid NFT Token ID format');
        console.log('═══════════════════════════════════════════════════════════');
        return res.status(400).json({ error: 'Invalid NFT Token ID format' });
      }
      
      // Get XRP private key from session
      const xrpPrivateKey = session?.xrpPrivateKey;
      if (!xrpPrivateKey) {
        console.error('❌ [BURN] No XRP private key in session');
        console.log('═══════════════════════════════════════════════════════════');
        return res.status(401).json({ error: 'XRP wallet not unlocked' });
      }
      console.log(`✅ [BURN] Private key retrieved from session`);
      
      // Create XRPL wallet from private key
      const wallet = Wallet.fromSeed(xrpPrivateKey);
      console.log(`✅ [BURN] Wallet created from seed`);
      console.log(`📍 [BURN] Wallet Address: ${wallet.address}`);
      
      // Connect to XRPL
      const client = new Client('wss://xrplcluster.com');
      console.log(`🔌 [BURN] Connecting to XRPL cluster...`);
      await client.connect();
      console.log(`✅ [BURN] Connected to XRPL successfully`);
      
      // Create NFTokenBurn transaction
      const burnTx = {
        TransactionType: 'NFTokenBurn',
        Account: wallet.address,
        NFTokenID: nftTokenId
      };
      
      console.log(`🔥 [BURN] Preparing burn transaction...`);
      console.log(`🎨 [BURN] NFT: ${nftTokenId}`);
      console.log(`⚠️  [BURN] WARNING: This action is PERMANENT and cannot be undone!`);
      
      // Submit and wait for validation
      const result = await client.submitAndWait(burnTx as any, { wallet });
      console.log(`📡 [BURN] Transaction submitted and validated`);
      
      await client.disconnect();
      console.log(`🔌 [BURN] Disconnected from XRPL`);
      
      // Check transaction result
      const txResult = (result.result.meta as any)?.TransactionResult;
      if (txResult === 'tesSUCCESS') {
        console.log(`✅ [BURN] SUCCESS! NFT permanently destroyed`);
        console.log(`🔗 [BURN] Transaction Hash: ${result.result.hash}`);
        console.log('═══════════════════════════════════════════════════════════');
        res.json({
          success: true,
          txHash: result.result.hash,
          message: 'NFT burned successfully. This action is permanent.'
        });
      } else {
        console.error(`❌ [BURN] Transaction failed with code: ${txResult}`);
        console.log('═══════════════════════════════════════════════════════════');
        res.status(400).json({
          success: false,
          error: txResult,
          message: 'Burn failed'
        });
      }
      
    } catch (error) {
      console.error('❌ [BURN] Fatal Error:', error instanceof Error ? error.message : 'Unknown error');
      console.error('❌ [BURN] Error Stack:', error instanceof Error ? error.stack : 'No stack');
      console.log('═══════════════════════════════════════════════════════════');
      res.status(500).json({ 
        success: false,
        error: 'Failed to burn NFT. Please try again.' 
      });
    }
  });

  // Create a sell offer for an NFT on XRPL blockchain
  app.post('/api/nft/:nftTokenId/sell', sessionAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { nftTokenId } = req.params;
      const { amount, destination } = req.body;
      const user = (req as any).user;
      
      console.log('');
      console.log('═══════════════════════════════════════════════════════════');
      console.log('💰 [SELL OFFER] Using sessionAuth');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`🎨 [SELL] NFT Token ID: ${nftTokenId}`);
      console.log(`💵 [SELL] Price: ${amount} XRP`);
      console.log(`📍 [SELL] Specific Buyer: ${destination || 'Open to anyone'}`);
      console.log(`👤 [SELL] User Handle: ${user?.handle || 'UNKNOWN'}`);
      
      // Validate NFT Token ID (64 hex characters)
      if (!nftTokenId || !/^[A-F0-9]{64}$/i.test(nftTokenId)) {
        console.error('❌ [SELL] Invalid NFT Token ID format');
        console.log('═══════════════════════════════════════════════════════════');
        return res.status(400).json({ error: 'Invalid NFT Token ID format' });
      }
      
      // Validate price
      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
        console.error('❌ [SELL] Invalid price - must be a positive number');
        console.log('═══════════════════════════════════════════════════════════');
        return res.status(400).json({ error: 'Invalid price - must be a positive number in XRP' });
      }
      
      // Validate destination address if provided
      if (destination && !/^r[a-zA-Z0-9]{24,34}$/.test(destination)) {
        console.error('❌ [SELL] Invalid destination address');
        console.log('═══════════════════════════════════════════════════════════');
        return res.status(400).json({ error: 'Invalid destination wallet address' });
      }
      
      // Get XRP private key from sessionAuth cached keys
      const xrpPrivateKey = user?.cachedKeys?.xrpPrivateKey;
      if (!xrpPrivateKey) {
        console.error('❌ [SELL] No XRP private key in cached keys');
        console.log('═══════════════════════════════════════════════════════════');
        return res.status(401).json({ error: 'XRP wallet not found in session' });
      }
      console.log(`✅ [SELL] Private key retrieved from cachedKeys`);
      
      // Create XRPL wallet from private key
      const wallet = Wallet.fromSeed(xrpPrivateKey);
      console.log(`✅ [SELL] Wallet created from seed`);
      console.log(`📍 [SELL] Wallet Address: ${wallet.address}`);
      
      // Connect to XRPL
      const client = new Client('wss://xrplcluster.com');
      console.log(`🔌 [SELL] Connecting to XRPL cluster...`);
      await client.connect();
      console.log(`✅ [SELL] Connected to XRPL successfully`);
      
      // Convert XRP to drops (1 XRP = 1,000,000 drops)
      const amountInDrops = xrpToDrops(amount);
      console.log(`💱 [SELL] Converted ${amount} XRP to ${amountInDrops} drops`);
      
      // Create sell offer transaction
      const sellOfferTx: any = {
        TransactionType: 'NFTokenCreateOffer',
        Account: wallet.address,
        NFTokenID: nftTokenId,
        Amount: amountInDrops,
        Flags: 1 // tfSellNFToken flag
      };
      
      // Add destination if specified (offer only for specific buyer)
      if (destination) {
        sellOfferTx.Destination = destination;
        console.log(`🎯 [SELL] Offer restricted to specific buyer: ${destination}`);
      } else {
        console.log(`🌐 [SELL] Offer open to anyone on the market`);
      }
      
      console.log(`💰 [SELL] Preparing sell offer transaction...`);
      console.log(`🎨 [SELL] NFT: ${nftTokenId}`);
      console.log(`💵 [SELL] Price: ${amount} XRP (${amountInDrops} drops)`);
      
      // Submit and wait for validation
      const result = await client.submitAndWait(sellOfferTx, { wallet });
      console.log(`📡 [SELL] Transaction submitted and validated`);
      
      await client.disconnect();
      console.log(`🔌 [SELL] Disconnected from XRPL`);
      
      // Check transaction result
      const txResult = (result.result.meta as any)?.TransactionResult;
      if (txResult === 'tesSUCCESS') {
        console.log(`✅ [SELL] SUCCESS! Sell offer created on blockchain`);
        console.log(`🔗 [SELL] Transaction Hash: ${result.result.hash}`);
        console.log(`💡 [SELL] Offer is now live on the XRPL marketplace`);
        console.log('═══════════════════════════════════════════════════════════');
        res.json({
          success: true,
          txHash: result.result.hash,
          message: `Sell offer created successfully for ${amount} XRP`,
          price: amount,
          destination: destination || 'Open to anyone'
        });
      } else {
        console.error(`❌ [SELL] Transaction failed with code: ${txResult}`);
        console.log('═══════════════════════════════════════════════════════════');
        res.status(400).json({
          success: false,
          error: txResult,
          message: 'Sell offer creation failed'
        });
      }
      
    } catch (error) {
      console.error('❌ [SELL] Fatal Error:', error instanceof Error ? error.message : 'Unknown error');
      console.error('❌ [SELL] Error Stack:', error instanceof Error ? error.stack : 'No stack');
      console.log('═══════════════════════════════════════════════════════════');
      res.status(500).json({ 
        success: false,
        error: 'Failed to create sell offer. Please try again.' 
      });
    }
  });

  // NOTE: Old database-based cancel/create endpoints removed
  // We now use XRPL blockchain directly for all NFT offer operations

  console.log('✅ NFT Offers routes registered successfully');
}