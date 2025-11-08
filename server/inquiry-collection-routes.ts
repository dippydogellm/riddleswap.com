import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import { storage } from './storage';
import { 
  inquiryNftCollection, 
  inquiryNfts,
  InsertInquiryNftCollection,
  InsertInquiryNft
} from '../shared/schema';

const router = Router();

// XRPL The Inquiry Collection Constants
const INQUIRY_ISSUER = "rGDJxq11nj6gstTrUKND3NtAaLtSUGqvDY";
const INQUIRY_TAXON = 0; // Standard taxon for The Inquiry
const TOTAL_NFTS = 123;

interface XRPLNFTToken {
  NFTokenID: string;
  TokenTaxon: number;
  URI?: string;
  Flags: number;
  Sequence: number;
}

interface NFTMetadata {
  name: string;
  description?: string;
  image?: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
}

// Initialize The Inquiry collection in database
router.post('/api/inquiry-collection/initialize', async (req, res) => {
  try {
    console.log('🔍 [INQUIRY INIT] Initializing The Inquiry collection...');
    
    // Check if collection already exists
    const existingCollection = await storage.db
      .select()
      .from(inquiryNftCollection)
      .where(eq(inquiryNftCollection.issuerAddress, INQUIRY_ISSUER))
      .limit(1);

    let collectionId: string;

    if (existingCollection.length === 0) {
      // Create new collection record
      const newCollection: InsertInquiryNftCollection = {
        issuerAddress: INQUIRY_ISSUER,
        taxon: INQUIRY_TAXON,
        totalSupply: TOTAL_NFTS,
        collectionName: "The Inquiry",
        description: "What makes a riddle? What makes us ask? Explore the mystery together as we journey through a vibrantly abstract and absurdist tale of the riddle and the blockchain. 123 unique AI rendered NFTs.",
        website: "https://riddlechain.io/",
        xrpCafeUrl: "https://xrp.cafe/collection/the-inquiry",
        gameRole: "special_ops",
        baseAttackPower: 75,
        baseDefensePower: 60,
        specialAbilityType: "mystery_sight",
        verified: true,
        metadataIngested: false
      };

      const [insertedCollection] = await storage.db
        .insert(inquiryNftCollection)
        .values(newCollection as any)
        .returning();
      
      collectionId = insertedCollection.id;
      console.log('✅ [INQUIRY INIT] Created new collection record:', collectionId);
    } else {
      collectionId = existingCollection[0].id;
      console.log('ℹ️ [INQUIRY INIT] Collection already exists:', collectionId);
    }

    res.json({
      success: true,
      collectionId,
      message: 'The Inquiry collection initialized successfully',
      issuer: INQUIRY_ISSUER,
      totalSupply: TOTAL_NFTS
    });

  } catch (error) {
    console.error('❌ [INQUIRY INIT] Error initializing collection:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initialize The Inquiry collection',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Fetch NFTs from XRPL for The Inquiry collection
router.post('/api/inquiry-collection/fetch-nfts', async (req, res) => {
  try {
    console.log('🔍 [INQUIRY FETCH] Starting NFT metadata fetch from XRPL...');
    
    // Get collection ID
    const collection = await storage.db
      .select()
      .from(inquiryNftCollection)
      .where(eq(inquiryNftCollection.issuerAddress, INQUIRY_ISSUER))
      .limit(1);

    if (collection.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'The Inquiry collection not found. Please initialize first.'
      });
    }

    const collectionId = collection[0].id;

    // Fetch NFTs from XRPL using Bithomp API
    const bithompResponse = await fetch(
      `https://bithomp.com/api/v2/nfts?issuer=${INQUIRY_ISSUER}&limit=200`,
      {
        headers: {
          'x-bithomp-token': process.env.BITHOMP_API_KEY || ''
        }
      }
    );

    if (!bithompResponse.ok) {
      throw new Error(`Bithomp API error: ${bithompResponse.status}`);
    }

    const bithompData = await bithompResponse.json();
    const nftTokens: XRPLNFTToken[] = bithompData.nfts || [];

    console.log(`📊 [INQUIRY FETCH] Found ${nftTokens.length} NFTs from Bithomp API`);

    // Process each NFT
    let processedCount = 0;
    let errorCount = 0;

    for (const nftToken of nftTokens) {
      try {
        // Check if NFT already exists
        const existingNft = await storage.db
          .select()
          .from(inquiryNfts)
          .where(eq(inquiryNfts.nftTokenId, nftToken.NFTokenID))
          .limit(1);

        if (existingNft.length > 0) {
          console.log(`⏭️ [INQUIRY FETCH] NFT already exists: ${nftToken.NFTokenID}`);
          continue;
        }

        // Fetch metadata if URI exists
        let metadata: NFTMetadata = { name: `Inquiry NFT #${nftToken.Sequence}` };
        let imageUrl = '';

        if (nftToken.URI) {
          try {
            // Decode hex URI
            const decodedUri = Buffer.from(nftToken.URI, 'hex').toString('utf8');
            console.log(`🔗 [INQUIRY FETCH] Fetching metadata from: ${decodedUri}`);
            
            const metadataResponse = await fetch(decodedUri);
            if (metadataResponse.ok) {
              metadata = await metadataResponse.json();
              imageUrl = metadata.image || '';
            }
          } catch (metadataError) {
            console.warn(`⚠️ [INQUIRY FETCH] Failed to fetch metadata for ${nftToken.NFTokenID}:`, metadataError);
          }
        }

        // Calculate game stats based on rarity and traits
        const rarityRank = nftToken.Sequence; // Use sequence as rough rarity indicator
        const attackPower = Math.floor(collection[0].baseAttackPower + (Math.random() * 50));
        const defensePower = Math.floor(collection[0].baseDefensePower + (Math.random() * 40));
        const specialPower = Math.floor(50 + (Math.random() * 75)); // Mystery power
        const mysteryLevel = Math.ceil(Math.random() * 10); // 1-10 mystery level

        // Extract traits and attributes
        const traits = metadata.attributes ? 
          metadata.attributes.reduce((acc, attr) => {
            acc[attr.trait_type] = attr.value;
            return acc;
          }, {} as Record<string, any>) : {};

        // Create NFT record
        const newNft: InsertInquiryNft = {
          collectionId,
          nftTokenId: nftToken.NFTokenID,
          tokenSequence: nftToken.Sequence,
          name: metadata.name || `Inquiry NFT #${nftToken.Sequence}`,
          description: metadata.description,
          imageUrl,
          rarityRank,
          attackPower,
          defensePower,
          specialPower,
          mysteryLevel,
          traits,
          allocationStatus: 'unassigned',
          enhancementLevel: 0,
          addonSlots: 3,
          metadataLastUpdated: new Date()
        };

        await storage.db.insert(inquiryNfts).values(newNft as any);
        processedCount++;

        console.log(`✅ [INQUIRY FETCH] Processed NFT: ${metadata.name} (${nftToken.NFTokenID})`);

      } catch (nftError) {
        console.error(`❌ [INQUIRY FETCH] Error processing NFT ${nftToken.NFTokenID}:`, nftError);
        errorCount++;
      }
    }

    // Update collection metadata ingestion status
    await storage.db
      .update(inquiryNftCollection)
      .set({  
        metadataIngested: true, 
        lastScanAt: new Date() 
       } as any)
      .where(eq(inquiryNftCollection.id, collectionId));

    console.log(`🎉 [INQUIRY FETCH] Completed! Processed: ${processedCount}, Errors: ${errorCount}`);

    res.json({
      success: true,
      message: 'The Inquiry NFTs fetched successfully',
      stats: {
        totalFound: nftTokens.length,
        processed: processedCount,
        errors: errorCount,
        collectionId
      }
    });

  } catch (error) {
    console.error('❌ [INQUIRY FETCH] Error fetching NFTs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch The Inquiry NFTs',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get collection status and stats
router.get('/api/inquiry-collection/status', async (req, res) => {
  try {
    const collection = await storage.db
      .select()
      .from(inquiryNftCollection)
      .where(eq(inquiryNftCollection.issuerAddress, INQUIRY_ISSUER))
      .limit(1);

    if (collection.length === 0) {
      return res.json({
        initialized: false,
        message: 'The Inquiry collection not found'
      });
    }

    // Count NFTs in database
    const nftCount = await storage.db
      .select({ count: inquiryNfts.id })
      .from(inquiryNfts)
      .where(eq(inquiryNfts.collectionId, collection[0].id));

    // Count allocated NFTs
    const allocatedCount = await storage.db
      .select({ count: inquiryNfts.id })
      .from(inquiryNfts)
      .where(
        and(
          eq(inquiryNfts.collectionId, collection[0].id),
          eq(inquiryNfts.allocationStatus, 'assigned')
        )
      );

    res.json({
      initialized: true,
      collection: collection[0],
      stats: {
        totalNfts: nftCount.length,
        allocatedNfts: allocatedCount.length,
        availableNfts: nftCount.length - allocatedCount.length,
        metadataIngested: collection[0].metadataIngested,
        lastScanAt: collection[0].lastScanAt
      }
    });

  } catch (error) {
    console.error('❌ [INQUIRY STATUS] Error getting status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get collection status'
    });
  }
});

// Get all Inquiry NFTs with filters
router.get('/api/inquiry-collection/nfts', async (req, res) => {
  try {
    const { 
      limit = 50, 
      offset = 0, 
      allocation_status,
      min_rarity,
      max_rarity,
      assigned_army 
    } = req.query;

    const storage = getStorage();
    const collection = await storage.db
      .select()
      .from(inquiryNftCollection)
      .where(eq(inquiryNftCollection.issuerAddress, INQUIRY_ISSUER))
      .limit(1);

    if (collection.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'The Inquiry collection not found'
      });
    }

    // Build query conditions
    let whereConditions = [eq(inquiryNfts.collectionId, collection[0].id)];

    if (allocation_status) {
      whereConditions.push(eq(inquiryNfts.allocationStatus, allocation_status as string));
    }

    if (assigned_army) {
      whereConditions.push(eq(inquiryNfts.assignedToArmyId, assigned_army as string));
    }

    // Fetch NFTs
    const nfts = await storage.db
      .select()
      .from(inquiryNfts)
      .where(and(...whereConditions))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string))
      .orderBy(inquiryNfts.rarityRank);

    res.json({
      success: true,
      nfts,
      pagination: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        total: nfts.length
      }
    });

  } catch (error) {
    console.error('❌ [INQUIRY NFTS] Error fetching NFTs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Inquiry NFTs'
    });
  }
});

export default router;