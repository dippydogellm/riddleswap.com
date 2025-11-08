import { Router } from 'express';
import { nftRarityService } from './nft-rarity-service';

const router = Router();
const BITHOMP_API_KEY = process.env.BITHOMP_API_KEY || '';

/**
 * GET /api/nft/:nftId/details
 * Get comprehensive NFT details including rarity, offers, and history
 */
router.get('/:nftId/details', async (req, res) => {
  try {
    const { nftId } = req.params;
    console.log(`🎨 [NFT DETAILS] Fetching comprehensive data for: ${nftId}`);

    // Fetch NFT data from Bithomp with metadata
    const nftResponse = await fetch(`https://bithomp.com/api/v2/nft/${nftId}?metadata=true`, {
      headers: {
        'x-bithomp-token': BITHOMP_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (!nftResponse.ok) {
      throw new Error(`Bithomp NFT API error: ${nftResponse.status}`);
    }

    const nftData = await nftResponse.json();
    
    // Get collection ID (issuer + taxon) - taxon is the collection identifier
    const collectionId = `${nftData.issuer}:${nftData.nftokenTaxon || 0}`;
    
    // Extract image URL from metadata
    let imageUrl = '';
    
    // Check if metadata contains an image field
    if (nftData.metadata?.image) {
      imageUrl = nftData.metadata.image;
      // Handle IPFS URLs
      if (imageUrl.startsWith('ipfs://')) {
        imageUrl = imageUrl.replace('ipfs://', 'https://ipfs.io/ipfs/');
      }
    }
    // Check for image_url field
    else if (nftData.metadata?.image_url) {
      imageUrl = nftData.metadata.image_url;
      if (imageUrl.startsWith('ipfs://')) {
        imageUrl = imageUrl.replace('ipfs://', 'https://ipfs.io/ipfs/');
      }
    }
    // Try Bithomp CDN
    else if (nftId) {
      // Check if Bithomp CDN has the image
      imageUrl = `https://cdn.bithomp.com/nft/${nftId}.webp`;
    }
    
    // URL-encode special characters in the filename only (preserve query strings, handle mixed encoding)
    if (imageUrl && imageUrl.includes('/')) {
      const urlParts = imageUrl.split('/');
      let lastSegment = urlParts[urlParts.length - 1];
      
      // Check if there's a query string (preserve it)
      const queryIndex = lastSegment.indexOf('?');
      
      let filename = queryIndex !== -1 ? lastSegment.substring(0, queryIndex) : lastSegment;
      const queryString = queryIndex !== -1 ? lastSegment.substring(queryIndex) : '';
      
      // Decode-then-encode approach to handle both raw and partially encoded filenames
      try {
        // Try to decode first (handles partially encoded filenames)
        const decoded = decodeURIComponent(filename);
        // Re-encode to ensure all special characters are properly encoded
        filename = encodeURIComponent(decoded);
      } catch (e) {
        // If decoding fails, the filename has invalid encoding - encode as-is
        // This handles cases where # or other special chars exist in raw form
        try {
          filename = encodeURIComponent(filename);
        } catch (e2) {
          // If encoding also fails, leave as-is
          console.warn('⚠️ [IMAGE URL] Could not encode filename:', filename);
        }
      }
      
      lastSegment = filename + queryString;
      urlParts[urlParts.length - 1] = lastSegment;
      imageUrl = urlParts.join('/');
    }
    
    // Add the image URL to the NFT data
    const enrichedNftData = {
      ...nftData,
      imageUrl: imageUrl || null
    };
    
    res.json({
      success: true,
      nft: enrichedNftData,
      collectionId
    });

  } catch (error: any) {
    console.error('❌ [NFT DETAILS] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch NFT details'
    });
  }
});

/**
 * GET /api/nft/:nftId/rarity
 * Calculate and return rarity data for an NFT
 */
router.get('/:nftId/rarity', async (req, res) => {
  try {
    const { nftId } = req.params;
    const { collectionId } = req.query;

    if (!collectionId) {
      return res.status(400).json({
        success: false,
        error: 'Collection ID required'
      });
    }

    console.log(`📊 [NFT RARITY] Calculating rarity for NFT: ${nftId} in collection: ${collectionId}`);

    // Fetch all NFTs in the collection from Bithomp using correct endpoint format
    const [issuer, taxon] = (collectionId as string).split(':');
    const collectionResponse = await fetch(
      `https://bithomp.com/api/v2/nfts?issuer=${issuer}&taxon=${taxon}&limit=10000&metadata=true`,
      {
        headers: {
          'x-bithomp-token': BITHOMP_API_KEY,
          'Accept': 'application/json'
        }
      }
    );

    if (!collectionResponse.ok) {
      throw new Error(`Bithomp collection API error: ${collectionResponse.status}`);
    }

    const collectionData = await collectionResponse.json();
    const allNFTs = collectionData.nfts || [];

    // Guard: Check if collection is empty
    if (allNFTs.length === 0) {
      console.log(`⚠️ [NFT RARITY] Empty collection - no rarity data available`);
      return res.json({
        success: true,
        rarity: null,
        traitFrequencies: {},
        totalSupply: 0,
        message: 'Collection is empty - rarity data not available'
      });
    }

    // Calculate rarity
    const rarityData = await nftRarityService.getNFTRarity(nftId, collectionId as string, allNFTs);
    const traitFrequencies = await nftRarityService.getTraitFrequencies(collectionId as string, allNFTs);

    // Convert Map to object for JSON response
    const traitFreqObject: Record<string, any[]> = {};
    traitFrequencies.forEach((value, key) => {
      traitFreqObject[key] = value;
    });

    res.json({
      success: true,
      rarity: rarityData,
      traitFrequencies: traitFreqObject,
      totalSupply: allNFTs.length
    });

  } catch (error: any) {
    console.error('❌ [NFT RARITY] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to calculate rarity'
    });
  }
});

/**
 * GET /api/nft/:nftId/offers
 * Get active buy and sell offers for an NFT
 */
router.get('/:nftId/offers', async (req, res) => {
  try {
    const { nftId } = req.params;
    console.log(`💰 [NFT OFFERS] Fetching offers for: ${nftId}`);

    const response = await fetch(`https://bithomp.com/api/v2/nft-offers/${nftId}`, {
      headers: {
        'x-bithomp-token': BITHOMP_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Bithomp offers API error: ${response.status}`);
    }

    const data = await response.json() as any;
    
    // Process offers
    const buyOffers = (data.buy || []).map((offer: any) => ({
      ...offer,
      type: 'buy',
      amountXRP: offer.amount ? (parseInt(offer.amount) / 1000000).toFixed(6) : '0',
      createdAt: offer.date ? new Date(offer.date).toISOString() : new Date().toISOString()
    }));

    const sellOffers = (data.sell || []).map((offer: any) => ({
      ...offer,
      type: 'sell',
      amountXRP: offer.amount ? (parseInt(offer.amount) / 1000000).toFixed(6) : '0',
      createdAt: offer.date ? new Date(offer.date).toISOString() : new Date().toISOString()
    }));

    res.json({
      success: true,
      offers: {
        buy: buyOffers,
        sell: sellOffers
      },
      totalOffers: buyOffers.length + sellOffers.length
    });

  } catch (error: any) {
    console.error('❌ [NFT OFFERS] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch offers'
    });
  }
});

/**
 * GET /api/nft/:nftId/history
 * Get transaction history for an NFT from Bithomp
 */
router.get('/:nftId/history', async (req, res) => {
  try {
    const { nftId } = req.params;
    
    console.log(`📜 [NFT HISTORY] Fetching transaction history for: ${nftId}`);

    // Use the main NFT endpoint with history=true parameter
    const response = await fetch(
      `https://bithomp.com/api/v2/nft/${nftId}?history=true`,
      {
        headers: {
          'x-bithomp-token': BITHOMP_API_KEY,
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Bithomp history API error: ${response.status}`);
    }

    const data = await response.json() as any;
    
    // Process transaction history from the NFT data
    const history = data.history || [];
    const transactions = history.map((tx: any) => ({
      hash: tx.txHash || tx.hash,
      type: tx.txType || tx.type || 'Unknown',
      date: tx.processedAt ? new Date(tx.processedAt).toISOString() : 
            tx.date ? new Date(tx.date * 1000).toISOString() : 
            new Date().toISOString(),
      from: tx.from || tx.account,
      to: tx.to || tx.destination,
      amount: tx.amount ? `${(parseInt(tx.amount) / 1000000).toFixed(6)} XRP` : 'N/A',
      status: tx.status || tx.result || 'tesSUCCESS',
      ledgerIndex: tx.ledgerIndex || tx.ledger
    }));

    res.json({
      success: true,
      history: transactions,
      totalTransactions: transactions.length
    });

  } catch (error: any) {
    console.error('❌ [NFT HISTORY] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch transaction history'
    });
  }
});

export default router;
