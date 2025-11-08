/**
 * NFT Collection Population Routes
 * 
 * This module populates the database with verified Riddle NFT collections
 * using Bithomp API to fetch collection and NFT metadata.
 */

import { Router } from 'express';
import { storage } from '../storage';

const router = Router();

interface BithompCollectionResponse {
  collection: {
    issuer: string;
    taxon: number;
    nfts: Array<{
      nft_id: string;
      token_id: string;
      uri?: string;
      flags?: number;
      transfer_fee?: number;
    }>;
  };
}

interface BithompNFTResponse {
  nft: {
    nft_id: string;
    token_id: string;
    issuer: string;
    taxon: number;
    sequence: number;
    uri?: string;
    metadata?: {
      name?: string;
      description?: string;
      image?: string;
      attributes?: Array<{
        trait_type: string;
        value: string | number;
      }>;
      [key: string]: any;
    };
    flags?: number;
    transfer_fee?: number;
    owner?: string;
  };
}

// Verified Riddle Collections Configuration
const RIDDLE_COLLECTIONS = [
  {
    name: 'The Inquiry',
    issuer: 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH',
    taxon: 0,
    expected_supply: 123,
    game_role: 'inquiry',
    power_level: 250
  },
  {
    name: 'The Inquisition', 
    issuer: 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH',
    taxon: 2,
    expected_supply: 916,
    game_role: 'army',
    power_level: 500
  },
  {
    name: 'Under the Bridge: Troll',
    issuer: 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH', 
    taxon: 9,
    expected_supply: 339,
    game_role: 'bank',
    power_level: 300
  },
  {
    name: 'The Lost Emporium',
    issuer: 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH',
    taxon: 3,
    expected_supply: 42,
    game_role: 'merchant',
    power_level: 400
  },
  {
    name: 'DANTES AURUM',
    issuer: 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH',
    taxon: 4, 
    expected_supply: 100,
    game_role: 'special',
    power_level: 1000
  }
];

// POST /api/nft-population/populate-collections - Populate all verified collections
router.post('/populate-collections', async (req, res) => {
  try {
    console.log('🔄 [NFT POPULATION] Starting collection population...');
    
    const results = {
      collections_updated: 0,
      nfts_added: 0,
      errors: [] as string[]
    };

    for (const collection of RIDDLE_COLLECTIONS) {
      try {
        console.log(`📥 [NFT POPULATION] Processing collection: ${collection.name} (taxon: ${collection.taxon})`);
        
        // Step 1: Fetch collection data from Bithomp
        const collectionUrl = `https://bithomp.com/api/v2/nft/issuer/${collection.issuer}/taxon/${collection.taxon}`;
        const collectionResponse = await fetch(collectionUrl, {
          headers: {
            'x-api-key': process.env.BITHOMP_API_KEY || ''
          }
        });

        if (!collectionResponse.ok) {
          throw new Error(`Bithomp API error: ${collectionResponse.status}`);
        }

        const collectionData: BithompCollectionResponse = await collectionResponse.json();
        const nfts = collectionData.collection?.nfts || [];
        
        console.log(`✅ [NFT POPULATION] Found ${nfts.length} NFTs in ${collection.name}`);

        // Step 2: Update collection in database
        await storage.updateGamingNftCollection(collection.issuer + '_' + collection.taxon, {
          collection_name: collection.name,
          taxon: collection.taxon,
          total_supply: nfts.length,
          collection_verified: true,
          metadata_ingested: true,
          game_role: collection.game_role,
          power_level: collection.power_level,
          active_in_game: true
        });
        
        results.collections_updated++;

        // Step 3: Process each NFT
        let nftCount = 0;
        for (const nft of nfts.slice(0, 50)) { // Limit to first 50 for initial population
          try {
            // Fetch detailed NFT metadata
            const nftUrl = `https://bithomp.com/api/v2/nft/${nft.nft_id}?assets=all`;
            const nftResponse = await fetch(nftUrl, {
              headers: {
                'x-api-key': process.env.BITHOMP_API_KEY || ''
              }
            });

            if (!nftResponse.ok) {
              console.warn(`⚠️ [NFT POPULATION] Failed to fetch NFT ${nft.nft_id}: ${nftResponse.status}`);
              continue;
            }

            const nftData: BithompNFTResponse = await nftResponse.json();
            const nftInfo = nftData.nft;

            // Calculate rarity rank based on sequence (lower sequence = higher rarity)
            const rarityRank = nftInfo.sequence || 999999;
            const rarityScore = Math.max(100 - (rarityRank / 10), 1);

            // Add NFT to database
            await storage.addGamingNft({
              id: nft.nft_id,
              collection_id: collection.issuer + '_' + collection.taxon,
              token_id: nft.token_id,
              nft_id: nft.nft_id,
              owner_address: nftInfo.owner || '',
              metadata: nftInfo.metadata || {},
              traits: nftInfo.metadata?.attributes || [],
              image_url: nftInfo.metadata?.image || '',
              name: nftInfo.metadata?.name || `${collection.name} #${nftInfo.sequence}`,
              description: nftInfo.metadata?.description || '',
              rarity_rank: rarityRank,
              rarity_score: rarityScore,
              is_genesis: nftInfo.sequence <= 10,
              power_multiplier: collection.power_level / 100
            });

            nftCount++;
            
            if (nftCount % 10 === 0) {
              console.log(`📊 [NFT POPULATION] Processed ${nftCount}/${nfts.length} NFTs for ${collection.name}`);
            }

          } catch (nftError: any) {
            console.error(`❌ [NFT POPULATION] Error processing NFT ${nft.nft_id}:`, nftError.message);
            results.errors.push(`NFT ${nft.nft_id}: ${nftError.message}`);
          }
        }

        results.nfts_added += nftCount;
        console.log(`✅ [NFT POPULATION] Completed ${collection.name}: ${nftCount} NFTs added`);

      } catch (collectionError: any) {
        console.error(`❌ [NFT POPULATION] Error processing collection ${collection.name}:`, collectionError.message);
        results.errors.push(`Collection ${collection.name}: ${collectionError.message}`);
      }
    }

    console.log('🎉 [NFT POPULATION] Population complete!', results);

    res.json({
      success: true,
      message: 'NFT collection population completed',
      results: results
    });

  } catch (error: any) {
    console.error('❌ [NFT POPULATION] Population failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to populate NFT collections',
      details: error.message
    });
  }
});

// GET /api/nft-population/status - Check population status
router.get('/status', async (req, res) => {
  try {
    console.log('📊 [NFT POPULATION] Checking population status...');
    
    const collections = await storage.getAllGamingNftCollections();
    const collectionStats = [];

    for (const collection of collections) {
      const nftCount = await storage.getGamingNftCount(collection.id);
      collectionStats.push({
        name: collection.collection_name,
        taxon: collection.taxon,
        total_supply: collection.total_supply,
        nfts_in_db: nftCount,
        verified: collection.collection_verified,
        metadata_ingested: collection.metadata_ingested
      });
    }

    res.json({
      success: true,
      collections: collectionStats,
      total_collections: collections.length,
      verified_collections: collections.filter(c => c.collection_verified).length
    });

  } catch (error: any) {
    console.error('❌ [NFT POPULATION] Status check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check population status',
      details: error.message
    });
  }
});

// GET /api/nft-population/collection/:taxon - Get specific collection data
router.get('/collection/:taxon', async (req, res) => {
  try {
    const taxon = parseInt(req.params.taxon);
    console.log(`📋 [NFT POPULATION] Getting collection data for taxon: ${taxon}`);

    const collection = await storage.getGamingNftCollectionByTaxon(taxon);
    if (!collection) {
      return res.status(404).json({
        success: false,
        error: 'Collection not found'
      });
    }

    const nfts = await storage.getGamingNftsByCollection(collection.id);

    res.json({
      success: true,
      collection: collection,
      nfts: nfts,
      total_nfts: nfts.length
    });

  } catch (error: any) {
    console.error('❌ [NFT POPULATION] Collection fetch failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch collection data',
      details: error.message
    });
  }
});

export default router;