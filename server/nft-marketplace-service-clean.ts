// NFT Detail Service using Bithomp API with assets=true
export async function getNFTDetail(nftId: string) {
  try {
    console.log(`🔍 [NFT DETAIL] Starting Bithomp lookup for: ${nftId.slice(-6)}`);
    
    // Use Bithomp API to get complete NFT data with assets=true
    const response = await fetch(`https://bithomp.com/api/v2/nft/${nftId}?assets=true`, {
      headers: {
        'Content-Type': 'application/json',
        'x-bithomp-token': process.env.BITHOMP_API_KEY || ''
      }
    });
    
    if (!response.ok) {
      throw new Error(`Bithomp API error: ${response.status}`);
    }
    
    const nftData = await response.json() as any;
    console.log(`✅ [NFT DETAIL] Bithomp data received for: ${nftData.name || nftId.slice(-6)}`);
    
    // Extract comprehensive data from Bithomp response
    const name = nftData.name || nftData.metadata?.name || `NFT #${nftId.slice(-6)}`;
    const description = nftData.description || nftData.metadata?.description || null;
    const traits = nftData.attributes || nftData.metadata?.attributes || [];
    
    // Use Bithomp image assets
    const imageUrl = nftData.assets?.image || 
                     nftData.assets?.preview || 
                     nftData.metadata?.image || 
                     `/api/nft/image/${nftId}`;
    
    console.log(`✅ [NFT DETAIL] Complete data loaded: ${name}`);
    
    // Fetch offers data from Bithomp API
    let offers_received = [];
    let offers_made = [];
    
    try {
      const offersResponse = await fetch(`https://bithomp.com/api/v2/nft/${nftId}/offers?offersValidate=true`, {
        headers: {
          'x-bithomp-token': process.env.BITHOMP_API_KEY || '',
          'Content-Type': 'application/json'
        }
      });
      
      if (offersResponse.ok) {
        const offersData = await offersResponse.json();
        offers_received = offersData.sell_offers || [];
        offers_made = offersData.buy_offers || [];
        console.log(`✅ [NFT OFFERS] Found ${offers_received.length} sell offers, ${offers_made.length} buy offers`);
      }
    } catch (offersError) {
      console.log(`⚠️ [NFT OFFERS] Failed to fetch offers: ${offersError.message}`);
    }
    
    return {
      nft_id: nftId,
      name,
      description,
      image: imageUrl,
      collection: nftData.collection || null,
      owner: nftData.owner || null,
      issuer: nftData.issuer || null,
      traits,
      attributes: traits,
      uri: nftData.uri || null,
      metadata: nftData.metadata || null,
      nft_taxon: nftData.nftokenTaxon || null,
      transfer_fee: nftData.transferFee || null,
      flags: nftData.flags || null,
      rarity: nftData.rarity || null,
      floor_price: nftData.floor_price || null,
      last_sale_price: nftData.last_sale_price || null,
      offers_received,
      offers_made
    };
    
  } catch (error) {
    console.error(`❌ [NFT DETAIL] Bithomp API error for ${nftId.slice(-6)}:`, error);
    
    // Return basic NFT data if API fails
    return {
      nft_id: nftId,
      name: `NFT #${nftId.slice(-6)}`,
      description: null,
      image: `/api/nft/image/${nftId}`,
      collection: null,
      owner: null,
      issuer: null,
      traits: [],
      attributes: [],
      uri: null,
      metadata: null,
      nft_taxon: null,
      transfer_fee: null,
      flags: null,
      rarity: null,
      floor_price: null,
      last_sale_price: null
    };
  }
}