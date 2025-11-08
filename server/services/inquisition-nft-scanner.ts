/**
 * Inquisition NFT Scanner Service
 * 
 * Scans all 5 Inquisition collections hourly for new mints:
 * - The Inquiry (taxon 0)
 * - The Inquisition (taxon 2)
 * - The Lost Emporium (taxon 3)
 * - DANTES AURUM (taxon 4)
 * - Under the Bridge: Troll (taxon 9)
 * 
 * Stores all NFT data with traits and calculates points
 * Works for all users, not just specific wallets
 */

import { db } from "../db";
import { eq, sql, and } from "drizzle-orm";
import {
  inquisitionCollections,
  inquisitionNftAudit,
  inquisitionScanHistory,
  inquisitionUserOwnership,
  type InquisitionCollection,
} from "@shared/schema";

const BITHOMP_API_KEY = process.env.BITHOMP_API_KEY;
const BITHOMP_BASE_URL = 'https://bithomp.com/api/v2';

interface BithompNFT {
  nftokenID: string;
  sequence: number;
  issuer: string;
  nftokenTaxon: number;
  owner?: string;
  uri?: string;
  url?: string;
  assets?: {
    image?: string;
  };
  metadata?: {
    name?: string;
    description?: string;
    image?: string;
    attributes?: Array<{
      trait_type: string;
      value: string | number;
    }>;
  };
}

interface BithompNFTsResponse {
  nfts: BithompNFT[];
  marker?: string;
}

/**
 * Calculate individual trait rarity scores
 * Each trait gets its own rarity percentage based on value
 */
function calculateTraitRarityScores(traits: Record<string, any>): Record<string, number> {
  const rarityScores: Record<string, number> = {};
  
  for (const [traitType, traitValue] of Object.entries(traits)) {
    const value = String(traitValue).toLowerCase();
    let rarityScore = 50; // Base rarity (50% = common)
    
    // Rarity based on keyword detection
    if (value.includes('legendary') || value.includes('mythic')) {
      rarityScore = 1; // 1% = ultra rare
    } else if (value.includes('epic') || value.includes('ancient')) {
      rarityScore = 5; // 5% = very rare
    } else if (value.includes('rare') || value.includes('unique')) {
      rarityScore = 10; // 10% = rare
    } else if (value.includes('uncommon') || value.includes('special')) {
      rarityScore = 25; // 25% = uncommon
    } else if (value.includes('common') || value.includes('basic')) {
      rarityScore = 70; // 70% = common
    }
    
    // Trait-specific adjustments
    const type = String(traitType).toLowerCase();
    if (type.includes('material') || type.includes('element')) {
      // Materials are rarer
      rarityScore = Math.max(5, rarityScore * 0.5);
    }
    if (type.includes('class') || type.includes('rank')) {
      // Classes are moderately rare
      rarityScore = Math.max(10, rarityScore * 0.7);
    }
    
    rarityScores[traitType] = Math.round(rarityScore);
  }
  
  return rarityScores;
}

/**
 * Calculate points based on NFT traits
 * Different traits contribute different points
 */
function calculateTraitPoints(traits: Record<string, any>, collection_name: string): {
  base_points: number;
  trait_points: number;
  rarity_multiplier: number;
  total_points: number;
  power_strength: number;
  power_defense: number;
  power_magic: number;
  power_speed: number;
} {
  let basePoints = 100;
  let traitPoints = 0;
  let rarityMultiplier = 1.0;
  let power_strength = 50;
  let power_defense = 50;
  let power_magic = 50;
  let power_speed = 50;

  // Collection-specific base points
  switch (collection_name) {
    case 'The Inquisition':
      basePoints = 500;
      break;
    case 'DANTES AURUM':
      basePoints = 1000;
      break;
    case 'The Lost Emporium':
      basePoints = 400;
      break;
    case 'Under the Bridge: Troll':
      basePoints = 300;
      break;
  }

  // Process traits for points
  const traitEntries = Object.entries(traits);
  
  // Rarity multiplier based on number of traits
  if (traitEntries.length > 15) rarityMultiplier = 2.0;
  else if (traitEntries.length > 10) rarityMultiplier = 1.5;
  else if (traitEntries.length > 5) rarityMultiplier = 1.2;

  for (const [traitType, traitValue] of traitEntries) {
    const type = String(traitType).toLowerCase();
    const value = String(traitValue).toLowerCase();

    // Trait-specific points
    if (type.includes('weapon') || type.includes('sword') || type.includes('staff')) {
      traitPoints += 100;
      power_strength += 30;
    }
    if (type.includes('armor') || type.includes('shield') || type.includes('helmet')) {
      traitPoints += 80;
      power_defense += 30;
    }
    if (type.includes('magic') || type.includes('spell') || type.includes('enchant')) {
      traitPoints += 120;
      power_magic += 40;
    }
    if (type.includes('speed') || type.includes('agility') || type.includes('swift')) {
      traitPoints += 90;
      power_speed += 35;
    }
    if (type.includes('legendary') || value.includes('legendary')) {
      traitPoints += 300;
      rarityMultiplier *= 1.5;
    }
    if (type.includes('rare') || value.includes('rare')) {
      traitPoints += 150;
      rarityMultiplier *= 1.3;
    }
    if (type.includes('epic') || value.includes('epic')) {
      traitPoints += 200;
      rarityMultiplier *= 1.4;
    }
    if (type.includes('common')) {
      traitPoints += 20;
    }

    // Background/Element points
    if (type.includes('background') || type.includes('element')) {
      if (value.includes('fire')) traitPoints += 50;
      if (value.includes('ice')) traitPoints += 50;
      if (value.includes('lightning')) traitPoints += 60;
      if (value.includes('dark')) traitPoints += 70;
      if (value.includes('light')) traitPoints += 70;
    }

    // Class/Rank points
    if (type.includes('class') || type.includes('rank')) {
      if (value.includes('master') || value.includes('lord')) traitPoints += 100;
      if (value.includes('knight') || value.includes('warrior')) traitPoints += 80;
      if (value.includes('wizard') || value.includes('mage')) traitPoints += 90;
      if (value.includes('assassin') || value.includes('rogue')) traitPoints += 85;
    }
  }

  const totalPoints = Math.floor((basePoints + traitPoints) * rarityMultiplier);

  return {
    base_points: basePoints,
    trait_points: traitPoints,
    rarity_multiplier: parseFloat(rarityMultiplier.toFixed(2)),
    total_points: totalPoints,
    power_strength: Math.min(power_strength, 999),
    power_defense: Math.min(power_defense, 999),
    power_magic: Math.min(power_magic, 999),
    power_speed: Math.min(power_speed, 999),
  };
}

/**
 * Fetch NFTs from Bithomp API for a specific collection with pagination
 */
async function fetchCollectionNFTs(issuer: string, taxon: number): Promise<BithompNFT[]> {
  try {
    console.log(`🔍 [Inquisition Scanner] Fetching NFTs for issuer ${issuer}, taxon ${taxon}...`);

    const allNfts: BithompNFT[] = [];
    const pageLimit = 1000; // NFTs per page
    const maxPages = 10; // Max 10 pages = 10,000 NFTs per collection
    let marker: string | undefined;
    let pageCount = 0;

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': 'RiddleSwap-Inquisition-Scanner/1.0',
    };

    if (BITHOMP_API_KEY) {
      headers['x-bithomp-token'] = BITHOMP_API_KEY;
    }

    do {
      let url = `${BITHOMP_BASE_URL}/nfts?issuer=${issuer}&taxon=${taxon}&assets=true&limit=${pageLimit}`;
      if (marker) {
        url += `&marker=${marker}`;
      }

      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error(`Bithomp API error: ${response.status} ${response.statusText}`);
      }

      const data: BithompNFTsResponse = await response.json() as any;
      const nftsInPage = data.nfts || [];
      
      allNfts.push(...nftsInPage);
      pageCount++;
      
      console.log(`📄 [Inquisition Scanner] Page ${pageCount}: Found ${nftsInPage.length} NFTs`);

      marker = data.marker;

      // Continue pagination if there's more data and we haven't hit the limit
      if (marker && pageCount < maxPages) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }

    } while (marker && pageCount < maxPages);

    console.log(`✅ [Inquisition Scanner] Total found: ${allNfts.length} NFTs across ${pageCount} page(s)`);

    return allNfts;
  } catch (error) {
    console.error(`❌ [Inquisition Scanner] Error fetching NFTs:`, error);
    throw error;
  }
}

/**
 * Fetch metadata from URI
 */
async function fetchMetadataFromURI(uri: string): Promise<any> {
  try {
    let url = uri;

    // Handle hex-encoded URI
    if (uri.startsWith('0x')) {
      const hexUri = uri.slice(2);
      const decodedUri = Buffer.from(hexUri, 'hex').toString('utf8');
      url = decodedUri;
    }

    // Handle IPFS URIs
    if (url.startsWith('ipfs://')) {
      const ipfsHash = url.replace('ipfs://', '');
      url = `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`;
    }

    const response = await fetch(url, {
      timeout: 10000,
      headers: { 'User-Agent': 'RiddleSwap-Inquisition-Scanner/1.0' }
    } as any);

    if (!response.ok) {
      console.warn(`⚠️ [Inquisition Scanner] Failed to fetch metadata from ${url}`);
      return null;
    }

    return await response.json() as any;
  } catch (error) {
    console.warn(`⚠️ [Inquisition Scanner] Error fetching metadata:`, error);
    return null;
  }
}

/**
 * Process and store a single NFT
 */
async function processNFT(
  nft: BithompNFT,
  collection: InquisitionCollection,
  scanHistoryId: number
): Promise<{ success: boolean; isNew: boolean }> {
  try {
    // Check if NFT already exists
    const existing = await db.query.inquisitionNftAudit.findFirst({
      where: eq(inquisitionNftAudit.nft_token_id, nft.nftokenID)
    });

    // Get metadata
    let metadata = nft.metadata || {};
    if (nft.uri && !metadata.name) {
      const fetchedMetadata = await fetchMetadataFromURI(nft.uri);
      if (fetchedMetadata) {
        metadata = { ...metadata, ...fetchedMetadata };
      }
    } else if (nft.url && !metadata.name) {
      const fetchedMetadata = await fetchMetadataFromURI(nft.url);
      if (fetchedMetadata) {
        metadata = { ...metadata, ...fetchedMetadata };
      }
    }

    // Extract traits
    const traits: Record<string, any> = {};
    if (metadata.attributes && Array.isArray(metadata.attributes)) {
      for (const attr of metadata.attributes) {
        traits[attr.trait_type] = attr.value;
      }
    }

    // Calculate individual trait rarity scores
    const traitRarityScores = calculateTraitRarityScores(traits);

    // Calculate points
    const points = calculateTraitPoints(traits, collection.collection_name);

    const nftData = {
      collection_id: collection.id,
      nft_token_id: nft.nftokenID,
      sequence_number: nft.sequence,
      issuer_address: nft.issuer,
      taxon: nft.nftokenTaxon,
      current_owner: nft.owner || null,
      owner_updated_at: new Date(),
      name: metadata.name || `NFT #${nft.sequence}`,
      description: metadata.description || '',
      image_url: metadata.image || nft.assets?.image || '',
      metadata_uri: nft.uri || nft.url || '',
      full_metadata: metadata,
      traits: traits,
      trait_rarity_scores: traitRarityScores, // Individual rarity score for each trait
      base_points: points.base_points,
      trait_points: points.trait_points,
      rarity_multiplier: points.rarity_multiplier.toString(),
      total_points: points.total_points,
      power_strength: points.power_strength.toString(),
      power_defense: points.power_defense.toString(),
      power_magic: points.power_magic.toString(),
      power_speed: points.power_speed.toString(),
      scan_source: 'hourly_scan',
      is_active: true,
      is_burned: false,
    };

    if (existing) {
      // Update existing NFT
      await db.update(inquisitionNftAudit)
        .set({ 
          ...nftData,
          last_updated_at: new Date(),
         } as any)
        .where(eq(inquisitionNftAudit.id, existing.id));

      // Update ownership if owner changed
      if (nft.owner && nft.owner !== existing.current_owner) {
        // Mark previous ownership as no longer current
        await db.update(inquisitionUserOwnership)
          .set({  is_current_owner: false, lost_ownership_at: new Date()  } as any)
          .where(eq(inquisitionUserOwnership.nft_id, existing.id));

        // Create new ownership record
        await db.insert(inquisitionUserOwnership).values({
          wallet_address: nft.owner,
          nft_id: existing.id,
          nft_token_id: nft.nftokenID,
          previous_owner: existing.current_owner || undefined,
          acquisition_type: 'scan',
          is_current_owner: true,
        } as any);
      }

      return { success: true, isNew: false };
    } else {
      // Insert new NFT
      const [insertedNft] = await db.insert(inquisitionNftAudit)
        .values(nftData as any)
        .returning();

      // Create ownership record if owner exists
      if (nft.owner) {
        await db.insert(inquisitionUserOwnership).values({
          wallet_address: nft.owner,
          nft_id: insertedNft.id,
          nft_token_id: nft.nftokenID,
          acquisition_type: 'scan',
          is_current_owner: true,
        } as any);
      }

      return { success: true, isNew: true };
    }
  } catch (error) {
    console.error(`❌ [Inquisition Scanner] Error processing NFT ${nft.nftokenID}:`, error);
    return { success: false, isNew: false };
  }
}

/**
 * Scan a single collection
 */
export async function scanCollection(collectionId: number): Promise<{
  success: boolean;
  nftsFound: number;
  nftsNew: number;
  nftsUpdated: number;
  nftsErrors: number;
}> {
  const startTime = Date.now();
  
  // Get collection details
  const collection = await db.query.inquisitionCollections.findFirst({
    where: eq(inquisitionCollections.id, collectionId)
  });

  if (!collection) {
    throw new Error(`Collection not found: ${collectionId}`);
  }

  console.log(`🎯 [Inquisition Scanner] Scanning collection: ${collection.collection_name}`);

  // Create scan history record
  const [scanRecord] = await db.insert(inquisitionScanHistory)
    .values({
      collection_id: collectionId,
      scan_status: 'started',
    } as any)
    .returning();

  try {
    // Update collection scan status
    await db.update(inquisitionCollections)
      .set({  scan_status: 'scanning'  } as any)
      .where(eq(inquisitionCollections.id, collectionId));

    // Fetch NFTs from Bithomp
    const nfts = await fetchCollectionNFTs(collection.issuer_address, collection.taxon);

    let nftsNew = 0;
    let nftsUpdated = 0;
    let nftsErrors = 0;

    // Process each NFT with progress tracking
    let processedCount = 0;
    for (const nft of nfts) {
      const result = await processNFT(nft, collection, scanRecord.id);
      
      if (result.success) {
        if (result.isNew) nftsNew++;
        else nftsUpdated++;
      } else {
        nftsErrors++;
      }

      processedCount++;
      
      // Progress logging every 100 NFTs
      if (processedCount % 100 === 0) {
        console.log(`📊 [Inquisition Scanner] Progress: ${processedCount}/${nfts.length} NFTs processed for ${collection.collection_name}`);
      }

      // Reduced delay to speed up scanning (10ms instead of 50ms)
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    const scanDuration = Date.now() - startTime;

    // Update scan history with results
    await db.update(inquisitionScanHistory)
      .set({ 
        scan_completed_at: new Date(),
        scan_status: 'completed',
        nfts_found: nfts.length,
        nfts_new: nftsNew,
        nfts_updated: nftsUpdated,
        nfts_errors: nftsErrors,
        scan_duration_ms: scanDuration,
        api_calls_made: nfts.length + 1, // 1 for collection fetch + 1 per NFT metadata
       } as any)
      .where(eq(inquisitionScanHistory.id, scanRecord.id));

    // Update collection
    await db.update(inquisitionCollections)
      .set({ 
        scan_status: 'completed',
        actual_supply: nfts.length,
        total_mints_tracked: nfts.length,
        last_scanned_at: new Date(),
        updated_at: new Date(),
       } as any)
      .where(eq(inquisitionCollections.id, collectionId));

    console.log(`✅ [Inquisition Scanner] Completed ${collection.collection_name}: ${nftsNew} new, ${nftsUpdated} updated, ${nftsErrors} errors in ${scanDuration}ms`);

    return {
      success: true,
      nftsFound: nfts.length,
      nftsNew,
      nftsUpdated,
      nftsErrors,
    };
  } catch (error) {
    console.error(`❌ [Inquisition Scanner] Scan failed for ${collection.collection_name}:`, error);

    // Update scan history with error
    await db.update(inquisitionScanHistory)
      .set({ 
        scan_completed_at: new Date(),
        scan_status: 'failed',
        error_message: error instanceof Error ? error.message : String(error),
        scan_duration_ms: Date.now() - startTime,
       } as any)
      .where(eq(inquisitionScanHistory.id, scanRecord.id));

    // Update collection status
    await db.update(inquisitionCollections)
      .set({  scan_status: 'error'  } as any)
      .where(eq(inquisitionCollections.id, collectionId));

    throw error;
  }
}

/**
 * Scan all collections (called by cron job hourly)
 */
export async function scanAllCollections(): Promise<void> {
  const startTime = Date.now();
  console.log(`🚀 [Inquisition Scanner] Starting hourly scan of all collections...`);

  // Get ALL Inquisition collections (all taxons, all issuers)
  const collections = await db.select()
    .from(inquisitionCollections);

  console.log(`📊 [Inquisition Scanner] Found ${collections.length} collections to scan across all taxons`);

  let successCount = 0;
  let failCount = 0;
  let totalNFTsScanned = 0;

  for (const collection of collections) {
    try {
      const result = await scanCollection(collection.id);
      successCount++;
      totalNFTsScanned += result.nftsFound;
    } catch (error) {
      failCount++;
      console.error(`❌ [Inquisition Scanner] Failed to scan ${collection.collection_name}:`, error);
      // Continue with next collection even if this one fails
    }
  }

  const scanDuration = Date.now() - startTime;
  console.log(`\n✅ [Inquisition Scanner] ===== SCAN COMPLETE =====`);
  console.log(`📊 Collections Scanned: ${successCount}/${collections.length} successful`);
  console.log(`🎯 Total NFTs Processed: ${totalNFTsScanned}`);
  console.log(`❌ Failed Collections: ${failCount}`);
  console.log(`⏱️ Total Duration: ${(scanDuration / 1000).toFixed(2)}s`);
  console.log(`✅ [Inquisition Scanner] ===== SCAN COMPLETE =====\n`);
}
