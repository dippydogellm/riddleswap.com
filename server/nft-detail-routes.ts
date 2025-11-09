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

    // First, get the on-chain NFT data from XRPL
    const { Client } = await import('xrpl');
    const client = new Client('wss://s1.ripple.com');
    
    let onChainMetadata: any = {};
    let nftData: any = {};
    
    try {
      await client.connect();
      
      // Get the NFT object from XRPL
      const nftInfo = await client.request({
        command: 'nft_info',
        nft_id: nftId
      } as any);
      
      if (nftInfo?.result) {
        onChainMetadata = nftInfo.result;
        
        // If there's a URI, fetch the metadata
        if (onChainMetadata.uri) {
          try {
            // Decode the hex URI
            const uriHex = onChainMetadata.uri;
            const uriString = Buffer.from(uriHex, 'hex').toString('utf8');
            
            console.log(`📄 [NFT DETAILS] Fetching metadata from URI: ${uriString}`);
            
            // Convert IPFS URI if needed
            let metadataUrl = uriString;
            if (uriString.startsWith('ipfs://')) {
              metadataUrl = uriString.replace('ipfs://', 'https://ipfs.io/ipfs/');
            }
            
            // Fetch the metadata JSON
            const metadataResponse = await fetch(metadataUrl);
            if (metadataResponse.ok) {
              const metadata = await metadataResponse.json();
              onChainMetadata.metadata = metadata;
              console.log(`✅ [NFT DETAILS] Fetched on-chain metadata:`, metadata);
            }
          } catch (metaError) {
            console.warn(`⚠️ [NFT DETAILS] Could not fetch metadata from URI:`, metaError);
          }
        }
      }
      
      await client.disconnect();
    } catch (xrplError) {
      console.warn(`⚠️ [NFT DETAILS] XRPL fetch failed, falling back to Bithomp:`, xrplError);
    }

    // Fetch NFT data from Bithomp for additional info (offers, floor price, etc)
    const nftResponse = await fetch(`https://bithomp.com/api/v2/nft/${nftId}?metadata=true`, {
      headers: {
        'x-bithomp-token': BITHOMP_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (nftResponse.ok) {
      nftData = await nftResponse.json();
    }
    
    // Merge on-chain metadata with Bithomp data (prioritize on-chain for data, Bithomp CDN for images)
    const metadata = onChainMetadata.metadata || nftData.metadata || {};
    const issuer = onChainMetadata.issuer || nftData.issuer;
    const taxon = onChainMetadata.nft_taxon || nftData.nftokenTaxon || 0;
    
    // Get collection ID (issuer + taxon) - taxon is the collection identifier
    const collectionId = `${issuer}:${taxon}`;
    
    // ALWAYS use Bithomp CDN for images (optimized, smaller, cached)
    // Never fetch from metadata URIs or IPFS directly
    // Use size=500 for thumbnails, remove size param for full resolution
    const imageUrl = `https://cdn.bithomp.com/nft/${nftId}.webp?size=500`;
    
    // Add the image URL and value data to the NFT data
    const enrichedNftData = {
      ...nftData,
      ...onChainMetadata, // Include on-chain data
      metadata: metadata, // Use merged metadata
      imageUrl: imageUrl || null,
      name: metadata?.name || nftData.metadata?.name || `NFT #${taxon}`,
      description: metadata?.description || nftData.metadata?.description,
      attributes: metadata?.attributes || metadata?.traits || nftData.metadata?.attributes || [],
      issuer: issuer,
      nftokenTaxon: taxon,
      floor_price: nftData.floorPrice || nftData.floor_price,
      last_sale_price: nftData.lastSalePrice || nftData.last_sale_price,
      rarity: nftData.rarity,
      // Include sell offers from Bithomp if available
      sellOffers: nftData.sellOffers || [],
      buyOffers: nftData.buyOffers || []
    };
    
    console.log(`✅ [NFT DETAILS] Enriched data - Name: ${enrichedNftData.name}, Floor: ${enrichedNftData.floor_price}, Last Sale: ${enrichedNftData.last_sale_price}`);
    
    res.json({
      success: true,
      nft: enrichedNftData,
      collectionId,
      dataSource: onChainMetadata.metadata ? 'on-chain' : 'bithomp'
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
