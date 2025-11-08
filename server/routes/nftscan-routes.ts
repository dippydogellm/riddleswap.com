import express from 'express';
import { moralisNFTService, MORALIS_CHAINS, MoralisChainId } from '../services/moralis-nft-service';

const router = express.Router();

// Get available chains
router.get('/chains', async (req, res) => {
  try {
    res.json({
      success: true,
      chains: Object.entries(MORALIS_CHAINS).map(([id, metadata]) => ({
        id,
        ...metadata
      }))
    });
  } catch (error) {
    console.error('❌ Error fetching chains:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch chains' });
  }
});

// Get all collections for a specific chain (NO AUTH REQUIRED - PUBLIC ENDPOINT)
router.get('/:chain/collections', async (req, res) => {
  try {
    const { chain } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    
    console.log(`📊 [API] Fetching all collections for ${chain}...`);
    
    // Get trending collections as our main collections list
    const collections = await moralisNFTService.getTrendingCollections(chain as MoralisChainId, limit);
    
    // Transform collections for marketplace display
    const marketplaceCollections = collections.map(collection => ({
      address: collection.contractAddress || collection.token_address || collection.address,
      name: collection.name || 'Unnamed Collection',
      symbol: collection.symbol,
      image: collection.image || 
              collection.contract_metadata?.image || 
              collection.contract_metadata?.image_url || 
              collection.contract_metadata?.logo ||
              collection.contract_metadata?.banner_image,
      logo: collection.logo || collection.contract_metadata?.logo,
      banner_image: collection.banner_image || collection.contract_metadata?.banner_image,
      description: collection.description || collection.contract_metadata?.description,
      floor_price: collection.floor_price,
      floor_price_usd: collection.floor_price_usd,
      volume_24h: collection.volume_24h,
      verified: collection.verified || collection.verified_collection || false,
      items_total: collection.total_tokens || collection.items_total,
      owners_total: collection.owner_count || collection.owners_total,
      market_cap: collection.market_cap_usd,
      sales_24h: collection.sales_24h,
      average_price_24h: collection.average_price_24h,
      chain
    }));
    
    res.json({
      success: true,
      collections: marketplaceCollections,
      count: marketplaceCollections.length
    });
  } catch (error) {
    console.error(`❌ Error fetching ${req.params.chain} collections:`, error);
    res.status(500).json({ success: false, error: 'Failed to fetch collections' });
  }
});

// Get trending collections (by volume)
router.get('/:chain/trending', async (req, res) => {
  try {
    const { chain } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;

    console.log(`📊 [API] Fetching trending collections for ${chain}...`);
    
    const collections = await moralisNFTService.getTrendingCollections(chain as MoralisChainId, limit);
    
    res.json({
      success: true,
      collections,
      count: collections.length
    });
  } catch (error) {
    console.error(`❌ Error fetching trending collections:`, error);
    res.status(500).json({ success: false, error: 'Failed to fetch trending collections' });
  }
});

// Get top sales collections (uses trending for now)
router.get('/:chain/top-sales', async (req, res) => {
  try {
    const { chain } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;

    console.log(`📈 [API] Fetching top sales collections for ${chain}...`);
    
    const collections = await moralisNFTService.getTrendingCollections(chain as MoralisChainId, limit);
    
    res.json({
      success: true,
      collections,
      count: collections.length
    });
  } catch (error) {
    console.error(`❌ Error fetching top sales collections:`, error);
    res.status(500).json({ success: false, error: 'Failed to fetch top sales collections' });
  }
});

// Search collections
router.get('/:chain/search', async (req, res) => {
  try {
    const { chain } = req.params;
    const query = req.query.q as string;
    const limit = parseInt(req.query.limit as string) || 10;

    if (!query) {
      return res.status(400).json({ success: false, error: 'Search query required' });
    }

    console.log(`🔍 [API] Searching collections for "${query}" on ${chain}...`);
    
    const collections = await moralisNFTService.searchCollections(chain as MoralisChainId, query, limit);
    
    res.json({
      success: true,
      collections,
      count: collections.length,
      query
    });
  } catch (error) {
    console.error(`❌ Error searching collections:`, error);
    res.status(500).json({ success: false, error: 'Failed to search collections' });
  }
});

// Get collection details
router.get('/:chain/collection/:contractAddress', async (req, res) => {
  try {
    const { chain, contractAddress } = req.params;

    console.log(`📖 [API] Fetching collection details for ${contractAddress} on ${chain}...`);
    
    const collection = await moralisNFTService.getCollectionMetadata(chain as MoralisChainId, contractAddress);
    
    if (!collection) {
      return res.status(404).json({ success: false, error: 'Collection not found' });
    }
    
    res.json({
      success: true,
      collection
    });
  } catch (error) {
    console.error(`❌ Error fetching collection details:`, error);
    res.status(500).json({ success: false, error: 'Failed to fetch collection details' });
  }
});

// Get NFTs from collection
router.get('/:chain/collection/:contractAddress/nfts', async (req, res) => {
  try {
    const { chain, contractAddress } = req.params;
    const cursor = req.query.cursor as string;
    const limit = parseInt(req.query.limit as string) || 20;

    console.log(`🎨 [API] Fetching NFTs for collection ${contractAddress} on ${chain}...`);
    
    const result = await moralisNFTService.getCollectionNFTs(chain as MoralisChainId, contractAddress, cursor, limit);
    
    res.json({
      success: true,
      nfts: result.nfts,
      cursor: result.cursor,
      count: result.nfts.length
    });
  } catch (error) {
    console.error(`❌ Error fetching collection NFTs:`, error);
    res.status(500).json({ success: false, error: 'Failed to fetch collection NFTs' });
  }
});

// Get account NFTs
router.get('/:chain/account/:accountAddress/nfts', async (req, res) => {
  try {
    const { chain, accountAddress } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;

    console.log(`👤 [API] Fetching NFTs for account ${accountAddress} on ${chain}...`);
    
    const nfts = await moralisNFTService.getWalletNFTs(chain as MoralisChainId, accountAddress, limit);
    
    res.json({
      success: true,
      nfts,
      count: nfts.length
    });
  } catch (error) {
    console.error(`❌ Error fetching account NFTs:`, error);
    res.status(500).json({ success: false, error: 'Failed to fetch account NFTs' });
  }
});

export default router;
