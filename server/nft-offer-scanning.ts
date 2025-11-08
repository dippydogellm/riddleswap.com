// NFT Offer Scanning - Find offers for owned NFTs
import { Router } from 'express';
import { sessionAuth } from './middleware/session-auth';

const router = Router();

// CORS headers
router.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Test endpoint to validate our filtering logic (NO AUTH REQUIRED)
router.get('/test-filter', async (req: any, res) => {
  try {
    console.log('🧪 [TEST FILTER] Testing offer filtering logic...');
    
    // Simulate different types of offers we might receive from Bithomp API
    const testOffers = [
      {
        nftokenID: "00080BB84047A9C1CA01632DCBE55AE16223C3C86C3D44D2D5B3FCA905D2560D",
        offerIndex: "TEST1",
        account: "rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH", // Different from wallet
        amount: "2500000", // 2.5 XRP in drops
        flags: { sellToken: false }, // Buy offer
        valid: true,
        nftoken: { metadata: { name: "Test NFT #1" } }
      },
      {
        nftokenID: "00080BB84047A9C1CA01632DCBE55AE16223C3C86C3D44D2D5B3FCA905D2560D",
        offerIndex: "TEST2", 
        account: "rEVrTKUKSLx5nxdfV8SAFTxS9FGFrfHRLo", // Same as wallet (should be excluded)
        amount: "1000000", // 1 XRP
        flags: { sellToken: false },
        valid: true,
        nftoken: { metadata: { name: "Test NFT #2" } }
      },
      {
        nftokenID: "00080BB84047A9C1CA01632DCBE55AE16223C3C86C3D44D2D5B3FCA905D2560D",
        offerIndex: "TEST3",
        account: "rKiCet8SdvWxPXnAgYarFUXMh1zCPz432Y",
        amount: "3000000", // 3 XRP
        flags: { sellToken: true }, // Sell offer (should be excluded)
        valid: true,
        nftoken: { metadata: { name: "Test NFT #3" } }
      },
      {
        nftokenID: "00080BB84047A9C1CA01632DCBE55AE16223C3C86C3D44D2D5B3FCA905D2560D",
        offerIndex: "TEST4",
        account: "rDbkpaT4jk5F17CqL11muJzzwhZtCStyg5",
        amount: "5000000", // 5 XRP
        flags: {}, // No sellToken flag (should be included as buy offer)
        valid: false, // Invalid but should still be included for user awareness
        validationErrors: ["Insufficient funds"],
        nftoken: { metadata: { name: "Test NFT #4" } }
      }
    ];
    
    const walletAddress = "rEVrTKUKSLx5nxdfV8SAFTxS9FGFrfHRLo";
    
    // Apply our filtering logic
    const filteredOffers = testOffers.filter((offer: any) => {
      console.log(`🧪 [TEST] Checking offer ${offer.offerIndex}:`, {
        account: offer.account,
        walletAddress: walletAddress,
        flags: offer.flags,
        sellToken: offer.flags?.sellToken,
        valid: offer.valid,
        amount: offer.amount
      });
      
      const isBuyOffer = (
        offer.flags?.sellToken === false || // Explicit buy offer flag
        !offer.flags?.sellToken ||          // Missing sell flag (default buy)
        offer.flags === 0                   // Legacy format
      );
      
      const isFromOtherUser = offer.account !== walletAddress;
      const hasValidAmount = offer.amount && parseInt(offer.amount) > 0;
      
      const shouldInclude = isBuyOffer && isFromOtherUser && hasValidAmount;
      
      console.log(`🧪 [TEST] Offer ${offer.offerIndex}: ${shouldInclude ? 'INCLUDE' : 'EXCLUDE'} (buyOffer: ${isBuyOffer}, otherUser: ${isFromOtherUser}, validAmount: ${hasValidAmount})`);
      return shouldInclude;
    });
    
    return res.json({
      success: true,
      message: `Filter test completed: ${filteredOffers.length}/${testOffers.length} offers included`,
      testOffers: testOffers,
      filteredOffers: filteredOffers,
      expectedResults: {
        TEST1: "SHOULD_INCLUDE - Valid buy offer from other user",
        TEST2: "SHOULD_EXCLUDE - Offer from same wallet", 
        TEST3: "SHOULD_EXCLUDE - Sell offer",
        TEST4: "SHOULD_INCLUDE - Buy offer from other user (even if invalid funds)"
      }
    });

  } catch (error: any) {
    console.error('❌ [TEST FILTER] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Filter test failed'
    });
  }
});

// Use session authentication for protected endpoints
router.use(sessionAuth);

// =======================================================================================
// SCAN FOR OFFERS ON OWNED NFTS
// =======================================================================================
router.get('/scan', async (req: any, res) => {
  try {
    console.log('🔍 [OFFER SCAN] Scanning for offers on owned NFTs...');
    
    const walletAddress = req.user?.walletAddress;
    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address not found'
      });
    }

    console.log(`🔍 [OFFER SCAN] Scanning offers for wallet: ${walletAddress}`);

    // Get owned NFTs first
    const ownedNFTsResponse = await fetch(`https://api.bithomp.com/api/v2/address/${walletAddress}/nfts?objects=true`);
    
    if (!ownedNFTsResponse.ok) {
      throw new Error(`Failed to fetch owned NFTs: ${ownedNFTsResponse.status}`);
    }

    const ownedNFTsData = await ownedNFTsResponse.json();
    const ownedNFTs = ownedNFTsData.objects || [];

    console.log(`📊 [OFFER SCAN] Found ${ownedNFTs.length} owned NFTs`);

    if (ownedNFTs.length === 0) {
      return res.json({
        success: true,
        message: 'No NFTs owned by this wallet',
        offers: [],
        totalOffers: 0
      });
    }

    // Check for offers on each NFT
    const offersPromises = ownedNFTs.map(async (nft: any) => {
      try {
        const nftId = nft.NFTokenID;
        const offersResponse = await fetch(`https://api.bithomp.com/api/v2/nft/${nftId}/offers`);
        
        if (offersResponse.ok) {
          const offersData = await offersResponse.json();
          const activeOffers = offersData.offers || [];
          
          if (activeOffers.length > 0) {
            console.log(`💰 [OFFER SCAN] Found ${activeOffers.length} offers for NFT: ${nft.name || nftId}`);
            return {
              nft: {
                id: nftId,
                name: nft.name,
                image: nft.image,
                collection: nft.collection
              },
              offers: activeOffers.map((offer: any) => ({
                ...offer,
                amountXRP: offer.amount ? (parseInt(offer.amount) / 1000000).toString() : '0',
                createdDate: new Date(offer.created * 1000).toISOString()
              }))
            };
          }
        }
        return null;
      } catch (error) {
        console.error(`❌ [OFFER SCAN] Error checking offers for NFT ${nft.NFTokenID}:`, error);
        return null;
      }
    });

    const offerResults = await Promise.all(offersPromises);
    const nftsWithOffers = offerResults.filter(result => result !== null);

    const totalOffers = nftsWithOffers.reduce((sum, nft) => sum + nft.offers.length, 0);

    console.log(`✅ [OFFER SCAN] Found ${totalOffers} total offers across ${nftsWithOffers.length} NFTs`);

    return res.json({
      success: true,
      message: `Found ${totalOffers} offers on ${nftsWithOffers.length} NFTs`,
      offers: nftsWithOffers,
      totalOffers,
      scannedNFTs: ownedNFTs.length
    });

  } catch (error: any) {
    console.error('❌ [OFFER SCAN] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to scan for offers'
    });
  }
});

// =======================================================================================
// GET INCOMING OFFERS ON YOUR NFTS
// =======================================================================================
router.get('/incoming', async (req: any, res) => {
  try {
    console.log('📥 [INCOMING OFFERS] Getting incoming offers on owned NFTs...');
    
    const walletAddress = req.user?.walletAddress;
    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address not found'
      });
    }

    console.log(`📥 [INCOMING OFFERS] Checking incoming offers for wallet: ${walletAddress}`);

    // Use Bithomp's efficient endpoint to get all offers on owned NFTs in one call
    const offersResponse = await fetch(`https://bithomp.com/api/v2/nft-offers/${walletAddress}?list=counterOffers&offersValidate=true&nftoken=true`, {
      headers: {
        'x-bithomp-token': process.env.BITHOMP_API_KEY || '',
        'Content-Type': 'application/json'
      }
    });
    
    if (!offersResponse.ok) {
      throw new Error(`Failed to fetch incoming offers: ${offersResponse.status}`);
    }

    const offersData = await offersResponse.json();
    const incomingOffers = offersData.nftOffers || [];

    console.log(`📊 [INCOMING OFFERS] Found ${incomingOffers.length} total incoming offers`);

    if (incomingOffers.length === 0) {
      return res.json({
        success: true,
        message: 'No incoming offers found',
        offers: [],
        totalOffers: 0
      });
    }

    // Enhanced filtering - capture ALL relevant incoming offers
    console.log(`🔍 [INCOMING OFFERS] Raw API data:`, JSON.stringify(incomingOffers.slice(0, 2), null, 2));
    
    const processedOffers = incomingOffers
      .filter((offer: any) => {
        // Log each offer for debugging
        console.log(`🧪 [OFFER FILTER] Checking offer:`, {
          offerIndex: offer.offerIndex,
          account: offer.account,
          walletAddress: walletAddress,
          flags: offer.flags,
          sellToken: offer.flags?.sellToken,
          valid: offer.valid,
          validationErrors: offer.validationErrors,
          nftOwner: offer.nftoken?.owner,
          amount: offer.amount
        });
        
        // CRITICAL: Only show offers that are VALID and ACTIONABLE
        
        // 1. Must be a valid offer (Bithomp validation passed)
        // ALWAYS EXCLUDE invalid offers regardless of the reason
        if (offer.valid === false || offer.validationErrors?.length > 0) {
          console.log(`🧪 [OFFER FILTER] EXCLUDE - Invalid offer: ${offer.validationErrors?.join(', ')}`);
          return false;
        }
        
        // 2. Must be a buy offer (someone wanting to buy our NFT)
        const isBuyOffer = (
          offer.flags?.sellToken === false || // Explicit buy offer flag
          !offer.flags?.sellToken ||          // Missing sell flag (default buy)
          offer.flags === 0                   // Legacy format
        );
        
        if (!isBuyOffer) {
          console.log(`🧪 [OFFER FILTER] EXCLUDE - Not a buy offer`);
          return false;
        }
        
        // 3. Must be from a different user (not ourselves)
        const isFromOtherUser = offer.account !== walletAddress;
        if (!isFromOtherUser) {
          console.log(`🧪 [OFFER FILTER] EXCLUDE - Offer from same wallet`);
          return false;
        }
        
        // 4. Must have a valid amount
        const hasValidAmount = offer.amount && parseInt(offer.amount) > 0;
        if (!hasValidAmount) {
          console.log(`🧪 [OFFER FILTER] EXCLUDE - Invalid amount`);
          return false;
        }
        
        // 5. CRITICAL: Must be for an NFT we actually own
        const weOwnTheNFT = offer.nftoken?.owner === walletAddress;
        if (!weOwnTheNFT) {
          console.log(`🧪 [OFFER FILTER] EXCLUDE - We don't own this NFT (owner: ${offer.nftoken?.owner})`);
          return false;
        }
        
        console.log(`🧪 [OFFER FILTER] INCLUDE - Valid actionable offer`);
        return true;
      })
      .map((offer: any) => ({
        nft_id: offer.nftokenID,
        name: offer.nftoken?.metadata?.name || `NFT #${offer.nftokenID.slice(-6)}`,
        image: offer.nftoken?.metadata?.image,
        collection: offer.nftoken?.metadata?.collection?.name,
        amount: offer.amount ? (parseInt(offer.amount) / 1000000).toString() : '0',
        owner: offer.account, // The person making the offer
        destination: offer.destination,
        expiration: offer.expiration,
        offer_index: offer.offerIndex,
        created: offer.createdAt,
        valid: offer.valid,
        validationErrors: offer.validationErrors || [],
        amountXRP: offer.amount ? (parseInt(offer.amount) / 1000000) : 0,
        createdTimestamp: new Date(offer.createdAt || 0).getTime()
      }))
      .sort((a: any, b: any) => {
        // Sort incoming offers: highest price first, then newest first
        const priceA = parseFloat(a.amountXRP || '0');
        const priceB = parseFloat(b.amountXRP || '0');
        if (priceB !== priceA) return priceB - priceA; // Highest price first
        
        return b.createdTimestamp - a.createdTimestamp; // Newest first
      });

    console.log(`✅ [INCOMING OFFERS] Found ${processedOffers.length} valid incoming offers - sorted by price and date`);

    return res.json({
      success: true,
      message: `Found ${processedOffers.length} incoming offers`,
      offers: processedOffers,
      totalOffers: processedOffers.length
    });

  } catch (error: any) {
    console.error('❌ [INCOMING OFFERS] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get incoming offers'
    });
  }
});

// =======================================================================================
// GET SPECIFIC NFT OFFERS  
// =======================================================================================
router.get('/nft/:nftId', async (req, res) => {
  try {
    const { nftId } = req.params;
    console.log(`🔍 [NFT OFFERS] Getting offers for NFT: ${nftId}`);

    const response = await fetch(`https://api.bithomp.com/api/v2/nft/${nftId}/offers`);
    
    if (!response.ok) {
      throw new Error(`Bithomp API error: ${response.status}`);
    }

    const data = await response.json() as any;
    const offers = data.offers || [];

    console.log(`💰 [NFT OFFERS] Found ${offers.length} offers for NFT: ${nftId}`);

    const processedOffers = offers.map((offer: any) => ({
      ...offer,
      amountXRP: offer.amount ? (parseInt(offer.amount) / 1000000).toString() : '0',
      amountXRPNumber: offer.amount ? (parseInt(offer.amount) / 1000000) : 0,
      createdDate: new Date(offer.created * 1000).toISOString(),
      createdTimestamp: offer.created * 1000,
      expirationDate: offer.expiration ? new Date((offer.expiration + 946684800) * 1000).toISOString() : null
    }))
    .sort((a: any, b: any) => {
      // Sort NFT offers: highest price first, then newest first, then by validity
      const priceA = parseFloat(a.amountXRPNumber || '0');
      const priceB = parseFloat(b.amountXRPNumber || '0');
      if (priceB !== priceA) return priceB - priceA; // Highest price first
      
      const dateA = a.createdTimestamp || 0;
      const dateB = b.createdTimestamp || 0;
      if (dateB !== dateA) return dateB - dateA; // Newest first
      
      // Valid offers before invalid ones
      const validA = a.valid ? 1 : 0;
      const validB = b.valid ? 1 : 0;
      return validB - validA;
    });

    return res.json({
      success: true,
      nftId,
      offers: processedOffers,
      totalOffers: offers.length
    });

  } catch (error: any) {
    console.error('❌ [NFT OFFERS] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch NFT offers'
    });
  }
});

export default router;