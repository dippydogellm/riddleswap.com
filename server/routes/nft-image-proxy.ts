import { Router } from 'express';

const router = Router();
const BITHOMP_API_KEY = process.env.BITHOMP_API_KEY || '';

/**
 * GET /api/nft-images/:nftId
 * Proxy endpoint to fetch NFT images from Bithomp CDN with authentication
 * This solves the issue where direct CDN access requires API token
 */
router.get('/:nftId', async (req, res) => {
  try {
    const { nftId } = req.params;
    
    console.log(`🖼️ [IMAGE PROXY] Fetching image for NFT: ${nftId}`);

    // Try Bithomp CDN first with authentication
    const cdnUrl = `https://cdn.bithomp.com/nft/${nftId}.webp`;
    
    const response = await fetch(cdnUrl, {
      headers: {
        'x-bithomp-token': BITHOMP_API_KEY,
        'User-Agent': 'RiddleSwap/1.0'
      }
    });

    if (response.ok) {
      // Get the image buffer
      const imageBuffer = await response.arrayBuffer();
      
      // Set appropriate headers
      res.setHeader('Content-Type', 'image/webp');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
      res.setHeader('Access-Control-Allow-Origin', '*');
      
      console.log(`✅ [IMAGE PROXY] Image found for NFT: ${nftId}`);
      
      // Send the image
      return res.send(Buffer.from(imageBuffer));
    }

    // If CDN fails, try fetching metadata to get image URL
    console.log(`⚠️ [IMAGE PROXY] CDN failed, trying metadata for NFT: ${nftId}`);
    
    const metadataResponse = await fetch(`https://bithomp.com/api/v2/nft/${nftId}?metadata=true`, {
      headers: {
        'x-bithomp-token': BITHOMP_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (metadataResponse.ok) {
      const nftData = await metadataResponse.json();
      
      // Extract image URL from metadata
      let imageUrl = '';
      
      if (nftData.metadata?.image) {
        imageUrl = nftData.metadata.image;
      } else if (nftData.metadata?.image_url) {
        imageUrl = nftData.metadata.image_url;
      }
      
      // Handle IPFS URLs
      if (imageUrl.startsWith('ipfs://')) {
        imageUrl = imageUrl.replace('ipfs://', 'https://ipfs.io/ipfs/');
      }
      
      if (imageUrl) {
        console.log(`🔄 [IMAGE PROXY] Redirecting to metadata image: ${imageUrl}`);
        // Redirect to the actual image URL
        return res.redirect(imageUrl);
      }
    }

    // If all fails, return 404
    console.log(`❌ [IMAGE PROXY] No image found for NFT: ${nftId}`);
    res.status(404).json({
      success: false,
      error: 'NFT image not found'
    });

  } catch (error: any) {
    console.error('❌ [IMAGE PROXY] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch NFT image'
    });
  }
});

export default router;
