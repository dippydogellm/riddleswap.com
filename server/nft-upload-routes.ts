import type { Express } from "express";

export function registerNFTUploadRoutes(app: Express) {
  console.log('🎨 Registering NFT upload routes...');

  // NFT upload endpoint for testing
  app.post('/api/nft/upload', async (req, res) => {
    try {
      const { name, description, collection, price, currency, walletAddress, chain } = req.body;
      
      if (!name || !description || !walletAddress || !chain) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required fields: name, description, walletAddress, chain' 
        });
      }

      // Simulate NFT upload processing for authenticated users
      const nftId = `${chain.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      console.log(`🎨 NFT Upload Request:`, {
        id: nftId,
        name,
        description,
        collection: collection || 'User Collection',
        price: price || '0',
        currency: currency || chain,
        wallet: walletAddress,
        chain: chain.toUpperCase()
      });

      // Check if user is authenticated with valid session
      if (req.session && req.session.walletHandle && walletAddress) {
        // Simulate storage in database (could implement later)
        const uploadData = {
          id: nftId,
          name,
          description,
          collection: collection || 'User Collection',
          price: parseFloat(price) || 0,
          currency: currency || chain,
          walletAddress,
          chain: chain.toUpperCase(),
          status: 'processing',
          imageUrl: `https://bithomp.com/api/v2/nft/${walletAddress}/${nftId}/image`,
          createdAt: new Date().toISOString()
        };

        console.log(`✅ NFT upload accepted for ${req.session.walletHandle}: ${name} on ${chain.toUpperCase()}`);
        
        res.json({
          success: true,
          nftId,
          message: `NFT "${name}" upload started on ${chain.toUpperCase()}`,
          data: uploadData
        });
      } else {
        res.status(403).json({
          success: false,
          error: 'NFT uploads require user authentication. Please log in to continue.'
        });
      }
      
    } catch (error) {
      console.error('NFT upload error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to process NFT upload' 
      });
    }
  });

  // Get NFT upload status
  app.get('/api/nft/upload/:nftId', async (req, res) => {
    try {
      const { nftId } = req.params;
      
      // Simulate status check
      res.json({
        success: true,
        nftId,
        status: 'completed',
        message: 'NFT upload completed successfully',
        imageUrl: `https://bithomp.com/api/v2/nft/demo/${nftId}/image`,
        marketplaceUrl: `/nft/${nftId}`
      });
      
    } catch (error) {
      console.error('NFT status check error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to check NFT status' 
      });
    }
  });

  console.log('✅ NFT upload routes registered successfully');
}