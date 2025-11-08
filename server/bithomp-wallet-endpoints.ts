import express from 'express';
import { requireAuthentication, AuthenticatedRequest } from './middleware/session-auth';

const router = express.Router();

// =============================================================================
// BITHOMP WALLET ENDPOINTS - MATCH FRONTEND EXPECTED PATHS
// =============================================================================

// Get NFTs for a specific wallet - /api/bithomp/wallet/{walletId}/nfts
router.get('/wallet/:walletId/nfts', requireAuthentication, async (req: any, res) => {
  try {
    if (!req.user?.walletAddress) {
      return res.status(400).json({ 
        success: false, 
        error: 'No XRP wallet address found in user session' 
      });
    }

    const xrpAddress = (req.user as any).walletAddress;

    // Fetch NFTs from Bithomp API with premium offer parameters
    const response = await fetch(`https://bithomp.com/api/v2/nfts?owner=${xrpAddress}&limit=200&assets=true&sellOffers=true&buyOffers=true&offersValidate=true`, {
      headers: {
        'x-bithomp-token': process.env.BITHOMP_API_KEY || '',
        'Accept': 'application/json',
        'User-Agent': 'RiddleSwap/1.0'
      }
    });

    if (!response.ok) {
      // Only log non-404 errors (404 = no NFTs, which is common and not an error)
      if (response.status !== 404) {
        console.error(`❌ [BITHOMP] NFT fetch failed (${response.status}) for ${xrpAddress.substring(0, 8)}...`);
      }
      return res.json({
        success: true,
        nfts: [],
        count: 0,
        owner: xrpAddress,
        message: `API returned ${response.status} - no NFTs found`
      });
    }

    const data = await response.json() as any;
    const nfts = data.nfts || [];
    
    // Transform NFT data to match frontend expectations
    const transformedNFTs = nfts.map((nft: any) => ({
      ...nft,
      id: nft.nftokenID,
      name: nft.metadata?.name || `NFT #${nft.sequence}`,
      image: nft.metadata?.image || nft.assets?.image || null,
      description: nft.metadata?.description || '',
      collection: nft.metadata?.collection?.name || 'Unknown Collection',
      hasOffers: false, // Will be populated by offers endpoint
      offersCount: 0
    }));

    return res.json({
      success: true,
      nfts: transformedNFTs,
      count: transformedNFTs.length,
      owner: xrpAddress
    });

  } catch (error: any) {
    console.error(`❌ [BITHOMP] NFT fetch exception: ${error.message}`);
    return res.json({
      success: true,
      nfts: [],
      count: 0,
      error: error.message,
      message: 'Error fetching NFTs - returning empty list'
    });
  }
});

// Get offers for a specific wallet - /api/bithomp/wallet/{walletId}/offers
router.get('/wallet/:walletId/offers', requireAuthentication, async (req: any, res) => {
  try {
    if (!req.user?.walletAddress) {
      return res.status(400).json({ 
        success: false, 
        error: 'No XRP wallet address found in user session' 
      });
    }

    const xrpAddress = (req.user as any).walletAddress;

    // Fetch offers from Bithomp API
    const response = await fetch(`https://bithomp.com/api/v2/nft-offers/${xrpAddress}?list=counterOffers`, {
      headers: {
        'x-bithomp-token': process.env.BITHOMP_API_KEY || '',
        'Accept': 'application/json',
        'User-Agent': 'RiddleSwap/1.0'
      }
    });

    if (!response.ok) {
      // Only log non-404 errors
      if (response.status !== 404) {
        console.error(`❌ [BITHOMP] Offers fetch failed (${response.status}) for ${xrpAddress.substring(0, 8)}...`);
      }
      return res.json({
        success: true,
        offers: [],
        incomingOffers: [],
        outgoingOffers: [],
        count: 0,
        message: `API returned ${response.status} - no offers found`
      });
    }

    const data = await response.json() as any;
    const offers = data.nftOffers || [];
    
    // Transform offers data to match frontend expectations
    const transformedOffers = offers.map((offer: any) => ({
      id: offer.offerIndex,
      offer_index: offer.offerIndex,
      nft_id: offer.nftokenID,
      offer_type: offer.flags?.sellToken ? 'sell_offer' : 'buy_offer',
      amount: offer.amount,
      currency: 'XRP',
      from_address: offer.account,
      to_address: offer.destination || xrpAddress,
      expiration: offer.expiration ? new Date(offer.expiration * 1000) : null,
      status: offer.valid === false ? 'invalid' : 'active',
      nftoken: offer.nftoken
    }));

    // Separate incoming and outgoing offers
    const incomingOffers = transformedOffers.filter((offer: any) => 
      offer.offer_type === 'buy_offer' && offer.from_address !== xrpAddress
    );
    
    const outgoingOffers = transformedOffers.filter((offer: any) => 
      offer.from_address === xrpAddress
    );

    return res.json({
      success: true,
      offers: transformedOffers,
      incomingOffers: incomingOffers,
      outgoingOffers: outgoingOffers,
      count: transformedOffers.length,
      owner: xrpAddress
    });

  } catch (error: any) {
    console.error('❌ [BITHOMP OFFERS] Error fetching offers:', error);
    return res.json({
      success: true,
      offers: [],
      incomingOffers: [],
      outgoingOffers: [],
      count: 0,
      error: error.message,
      message: 'Error fetching offers - returning empty list'
    });
  }
});

// Get marketplace NFTs with active sell offers - /api/bithomp/marketplace/nfts
router.get('/marketplace/nfts', async (req, res) => {
  try {
    console.log('🏪 [MARKETPLACE] Fetching NFTs with active sell offers');
    
    const limit = parseInt(req.query.limit as string) || 100;
    const marker = req.query.marker as string;
    const collection = req.query.collection as string;
    
    // Build query parameters
    const params = new URLSearchParams({
      list: 'onSale',
      assets: 'true',
      limit: limit.toString()
    });
    
    if (marker) params.append('marker', marker);
    if (collection) params.append('collection', collection);
    
    // Fetch NFTs with sell offers from Bithomp API
    const response = await fetch(`https://bithomp.com/api/v2/nfts?${params.toString()}`, {
      headers: {
        'x-bithomp-token': process.env.BITHOMP_API_KEY || '',
        'Accept': 'application/json',
        'User-Agent': 'RiddleSwap/1.0'
      }
    });

    if (!response.ok) {
      console.log(`❌ [MARKETPLACE] API error: ${response.status}`);
      return res.json({
        success: true,
        nfts: [],
        count: 0,
        hasMore: false,
        message: `API returned ${response.status} - no marketplace NFTs found`
      });
    }

    const data = await response.json() as any;
    const nfts = data.nfts || [];
    
    console.log(`✅ [MARKETPLACE] Found ${nfts.length} NFTs with sell offers`);
    
    // Transform NFT data for marketplace
    const marketplaceNFTs = nfts.map((nft: any) => ({
      ...nft,
      id: nft.nftokenID,
      name: nft.metadata?.name || `NFT #${nft.sequence}`,
      image: nft.assets?.image || nft.metadata?.image || null,
      thumbnail: nft.assets?.thumbnail || null,
      preview: nft.assets?.preview || null,
      description: nft.metadata?.description || '',
      collection: nft.metadata?.collection?.name || 'Unknown Collection',
      issuer: nft.issuer,
      hasOffers: true, // These NFTs definitely have sell offers
      forSale: true
    }));

    return res.json({
      success: true,
      nfts: marketplaceNFTs,
      count: marketplaceNFTs.length,
      hasMore: !!data.marker,
      marker: data.marker || null,
      collectionDetails: data.collectionDetails || null
    });

  } catch (error: any) {
    console.error('❌ [MARKETPLACE] Error fetching marketplace NFTs:', error);
    return res.json({
      success: true,
      nfts: [],
      count: 0,
      hasMore: false,
      error: error.message,
      message: 'Error fetching marketplace NFTs - returning empty list'
    });
  }
});

// Get individual NFT offers - /api/bithomp/nft/{nftId}/offers
router.get('/nft/:nftId/offers', async (req, res) => {
  try {
    const nftId = req.params.nftId;
    console.log(`💰 [NFT OFFERS] Fetching offers for NFT: ${nftId}`);
    
    // Fetch individual NFT offers from Bithomp API
    const response = await fetch(`https://bithomp.com/api/v2/nft-offers/${nftId}`, {
      headers: {
        'x-bithomp-token': process.env.BITHOMP_API_KEY || '',
        'Accept': 'application/json',
        'User-Agent': 'RiddleSwap/1.0'
      }
    });

    if (!response.ok) {
      console.log(`❌ [NFT OFFERS] API error: ${response.status}`);
      return res.json({
        success: true,
        offers: [],
        count: 0,
        nftId: nftId,
        message: `API returned ${response.status} - no offers found for NFT`
      });
    }

    const data = await response.json() as any;
    const offers = data.nftOffers || [];
    
    console.log(`✅ [NFT OFFERS] Found ${offers.length} offers for NFT ${nftId}`);
    
    // Transform offers data
    const transformedOffers = offers.map((offer: any) => ({
      id: offer.offerIndex,
      offer_index: offer.offerIndex,
      nft_id: nftId,
      offer_type: offer.flags?.sellToken ? 'sell_offer' : 'buy_offer',
      amount: offer.amount,
      currency: 'XRP',
      from_address: offer.account,
      to_address: offer.destination || null,
      expiration: offer.expiration ? new Date(offer.expiration * 1000) : null,
      status: offer.valid === false ? 'invalid' : 'active',
      nftoken: offer.nftoken
    }));

    return res.json({
      success: true,
      offers: transformedOffers,
      count: transformedOffers.length,
      nftId: nftId
    });

  } catch (error: any) {
    console.error('❌ [NFT OFFERS] Error fetching NFT offers:', error);
    return res.json({
      success: true,
      offers: [],
      count: 0,
      nftId: req.params.nftId,
      error: error.message,
      message: 'Error fetching NFT offers - returning empty list'
    });
  }
});

export default router;