/**
 * Bithomp NFT Ingestion Service
 * Fetches NFT data from Bithomp API and imports into gaming_nfts table
 */

import { db } from "./db";
import { gamingNfts, gamingNftCollections } from "@shared/schema";
import { eq } from "drizzle-orm";

const BITHOMP_API_KEY = process.env.BITHOMP_API_KEY;
const BITHOMP_BASE_URL = 'https://bithomp.com/api/v2';

interface BithompNFT {
  nftId: string;
  tokenId: string;
  issuer: string;
  taxon: number;
  sequence: number;
  owner: string;
  uri?: string;
  metadata?: {
    name?: string;
    description?: string;
    image?: string;
    attributes?: Array<{
      trait_type: string;
      value: string | number;
    }>;
  };
  flags?: {
    burnable?: boolean;
    onlyXRP?: boolean;
    trustLine?: boolean;
    transferable?: boolean;
  };
}

interface BithompNFTListResponse {
  nfts: BithompNFT[];
  marker?: string;
}

/**
 * Fetch NFTs from Bithomp API by issuer and taxon
 */
export async function fetchNFTsFromBithomp(
  issuer: string,
  taxon: number,
  limit: number = 100
): Promise<BithompNFT[]> {
  try {
    console.log(`🔍 Fetching NFTs from Bithomp: ${issuer} (taxon ${taxon})`);
    
    const url = `${BITHOMP_BASE_URL}/nft/${issuer}?taxon=${taxon}&limit=${limit}`;
    const headers: Record<string, string> = {
      'Accept': 'application/json'
    };
    
    if (BITHOMP_API_KEY) {
      headers['x-bithomp-token'] = BITHOMP_API_KEY;
    }

    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      throw new Error(`Bithomp API error: ${response.status} ${response.statusText}`);
    }

    const data: BithompNFTListResponse = await response.json() as any;
    
    console.log(`✅ Fetched ${data.nfts?.length || 0} NFTs from Bithomp`);
    return data.nfts || [];
  } catch (error) {
    console.error(`Error fetching NFTs from Bithomp:`, error);
    return [];
  }
}

/**
 * Fetch metadata from URI
 */
async function fetchMetadataFromURI(uri: string): Promise<any> {
  try {
    // Handle IPFS URIs
    if (uri.startsWith('ipfs://')) {
      const ipfsHash = uri.replace('ipfs://', '');
      uri = `https://ipfs.io/ipfs/${ipfsHash}`;
    }
    
    const response = await fetch(uri);
    if (!response.ok) {
      console.warn(`Failed to fetch metadata from ${uri}`);
      return null;
    }
    
    return await response.json() as any;
  } catch (error) {
    console.warn(`Error fetching metadata from ${uri}:`, error);
    return null;
  }
}

/**
 * Import NFTs into gaming_nfts table
 */
export async function importNFTsToDatabase(
  collectionId: string,
  nfts: BithompNFT[]
): Promise<{
  imported: number;
  skipped: number;
  errors: number;
}> {
  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const nft of nfts) {
    try {
      // Check if already exists
      const existing = await db.query.gamingNfts.findFirst({
        where: eq(gamingNfts.nft_id, nft.nftId)
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Fetch metadata if URI is present
      let metadata = nft.metadata || {};
      if (nft.uri && !metadata.name) {
        const fetchedMetadata = await fetchMetadataFromURI(nft.uri);
        if (fetchedMetadata) {
          metadata = { ...metadata, ...fetchedMetadata };
        }
      }

      // Convert attributes array to traits object
      const traits: Record<string, any> = {};
      if (metadata.attributes && Array.isArray(metadata.attributes)) {
        for (const attr of metadata.attributes) {
          traits[attr.trait_type] = attr.value;
        }
      }

      // Import into database
      await db.insert(gamingNfts).values({
        collection_id: collectionId,
        token_id: nft.sequence.toString(),
        nft_id: nft.nftId,
        owner_address: nft.owner,
        metadata: metadata,
        traits: traits,
        image_url: metadata.image || null,
        name: metadata.name || `NFT #${nft.sequence}`,
        description: metadata.description || null,
        game_stats: {},
        is_genesis: false,
        power_multiplier: "1.00"
      });

      imported++;
      console.log(`✅ Imported NFT: ${metadata.name || nft.nftId}`);
    } catch (error) {
      console.error(`Error importing NFT ${nft.nftId}:`, error);
      errors++;
    }
  }

  return { imported, skipped, errors };
}

/**
 * Ingest entire collection from Bithomp
 */
export async function ingestCollection(
  issuer: string,
  taxon: number,
  collectionName: string
): Promise<{
  collection_id: string;
  collection_name: string;
  nfts_fetched: number;
  nfts_imported: number;
  nfts_skipped: number;
  errors: number;
}> {
  try {
    console.log(`\n🚀 Starting collection ingestion: ${collectionName}`);
    console.log(`   Issuer: ${issuer}, Taxon: ${taxon}`);

    // Find or create collection
    let collection = await db.query.gamingNftCollections.findFirst({
      where: eq(gamingNftCollections.collection_id, `${issuer}:${taxon}`)
    });

    if (!collection) {
      console.log(`📦 Creating new collection: ${collectionName}`);
      const [newCollection] = await db.insert(gamingNftCollections).values({
        collection_id: `${issuer}:${taxon}`,
        collection_name: collectionName,
        taxon: taxon,
        chain: 'xrpl',
        game_role: 'power',
        collection_verified: true,
        metadata_ingested: false,
        active_in_game: true
      } as any).returning();
      collection = newCollection;
    }

    // Fetch NFTs from Bithomp
    const nfts = await fetchNFTsFromBithomp(issuer, taxon);
    
    if (nfts.length === 0) {
      console.log(`⚠️ No NFTs found for ${collectionName}`);
      return {
        collection_id: collection.id,
        collection_name: collectionName,
        nfts_fetched: 0,
        nfts_imported: 0,
        nfts_skipped: 0,
        errors: 0
      };
    }

    // Import into database
    const results = await importNFTsToDatabase(collection.id, nfts);

    // Update collection metadata_ingested flag
    await db.update(gamingNftCollections)
      .set({  
        metadata_ingested: true,
        total_supply: nfts.length,
        updated_at: new Date()
       } as any)
      .where(eq(gamingNftCollections.id, collection.id));

    console.log(`\n✨ Collection ingestion complete!`);
    console.log(`   Fetched: ${nfts.length}`);
    console.log(`   Imported: ${results.imported}`);
    console.log(`   Skipped: ${results.skipped}`);
    console.log(`   Errors: ${results.errors}`);

    return {
      collection_id: collection.id,
      collection_name: collectionName,
      nfts_fetched: nfts.length,
      nfts_imported: results.imported,
      nfts_skipped: results.skipped,
      errors: results.errors
    };
  } catch (error) {
    console.error(`Error ingesting collection ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Ingest all themed collections
 */
export async function ingestAllThemedCollections(): Promise<{
  total_collections: number;
  total_nfts_fetched: number;
  total_nfts_imported: number;
  results: Array<{
    collection_name: string;
    nfts_fetched: number;
    nfts_imported: number;
  }>;
}> {
  const collections = [
    { issuer: 'rp5DGDDDFZdQswWfn3sgkQznCAj9SkkCMLH', taxon: 9, name: 'Under the Bridge' },
    { issuer: 'rp5DGDDDFZdQswWfn3sgkQznCAj9SkkCMLH', taxon: 1, name: 'The Inquiry' },
    { issuer: 'rp5DGDDDFZdQswWfn3sgkQznCAj9SkkCMLH', taxon: 3, name: 'Dantes Aurum' },
    { issuer: 'rp5DGDDDFZdQswWfn3sgkQznCAj9SkkCMLH', taxon: 2, name: 'The Lost Emporium' }
  ];

  const results = [];
  let totalFetched = 0;
  let totalImported = 0;

  for (const coll of collections) {
    const result = await ingestCollection(coll.issuer, coll.taxon, coll.name);
    results.push({
      collection_name: result.collection_name,
      nfts_fetched: result.nfts_fetched,
      nfts_imported: result.nfts_imported
    });
    totalFetched += result.nfts_fetched;
    totalImported += result.nfts_imported;
  }

  console.log(`\n🎉 All collections ingested!`);
  console.log(`   Collections: ${results.length}`);
  console.log(`   Total NFTs fetched: ${totalFetched}`);
  console.log(`   Total NFTs imported: ${totalImported}`);

  return {
    total_collections: results.length,
    total_nfts_fetched: totalFetched,
    total_nfts_imported: totalImported,
    results
  };
}
