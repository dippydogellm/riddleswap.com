/**
 * Scanner 1: New Project Collection Scanner
 * 
 * One-time scan when adding a new collection:
 * - Takes issuer + taxon
 * - Scans all NFTs up to 100,000
 * - Parses all metadata into separate database fields
 * - Stores raw metadata + parsed values in own columns
 */

import { db } from "../db";
import { 
  gamingNftCollections, 
  gamingNfts,
  scannerLogs
} from "../../shared/schema";
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";

interface BithompNFT {
  nftokenID: string;
  issuer: string;
  nftokenTaxon: number;
  uri?: string;
  metadata?: Record<string, any>;
  owner?: string;
  transferFee?: number;
  sequence: number;
  flags?: number;
}

interface ParsedMetadata {
  // Core fields
  name: string;
  description: string;
  image: string;
  
  // Traits parsed into separate fields
  traits: Record<string, any>;
  attributes: Array<{ trait_type: string; value: any; display_type?: string }>;
  
  // Parsed special fields
  character_class?: string;
  material?: string;
  rarity?: string;
  special_powers: string[];
  weapon_type?: string;
  armor_type?: string;
  background?: string;
  
  // Additional metadata
  external_url?: string;
  animation_url?: string;
  properties?: Record<string, any>;
}

interface CollectionScanResult {
  success: boolean;
  collection_id: string;
  nfts_found: number;
  nfts_stored: number;
  nfts_updated: number;
  nfts_failed: number;
  errors: string[];
  duration_ms: number;
}

const BITHOMP_API_KEY = process.env.BITHOMP_API_KEY || '';
const MAX_NFTS_PER_COLLECTION = 100000;
const BITHOMP_PAGE_LIMIT = 1000;

export class CollectionInitialScanner {
  
  /**
   * Main entry point: Scan a new collection
   */
  async scanNewCollection(
    issuer: string,
    taxon: number,
    collectionName?: string,
    gameRole?: string
  ): Promise<CollectionScanResult> {
    const startTime = Date.now();
    const targetId = `${issuer}:${taxon}`;
    console.log(`\n🚀 [COLLECTION SCANNER] Starting scan for ${targetId}`);
    console.log(`📊 [COLLECTION SCANNER] Collection: ${collectionName || 'Unknown'}`);
    
    const result: CollectionScanResult = {
      success: false,
      collection_id: targetId,
      nfts_found: 0,
      nfts_stored: 0,
      nfts_updated: 0,
      nfts_failed: 0,
      errors: [],
      duration_ms: 0
    };

    // Create scanner log entry
    const [logEntry] = await db.insert(scannerLogs).values({
      scanner_name: 'collection-initial-scanner',
      scanner_type: 'collection_scan',
      status: 'running',
      started_at: new Date(),
      target_id: targetId,
      target_name: collectionName || 'Unknown Collection'
    } as any).returning();
    
    try {
      // Step 1: Create or get collection record
      const dbCollection = await this.ensureCollectionExists(
        issuer,
        taxon,
        collectionName,
        gameRole
      );
      
      // Step 2: Fetch all NFTs from Bithomp API
      console.log(`🔍 [COLLECTION SCANNER] Fetching NFTs from Bithomp API...`);
      const nfts = await this.fetchAllNFTs(issuer, taxon);
      result.nfts_found = nfts.length;
      
      console.log(`✅ [COLLECTION SCANNER] Found ${nfts.length} NFTs`);
      
      // Step 3: Process and store each NFT
      console.log(`💾 [COLLECTION SCANNER] Processing and storing NFTs...`);
      const processingResults = await this.processAndStoreNFTs(nfts, dbCollection.id);
      
      result.nfts_stored = processingResults.stored;
      result.nfts_updated = processingResults.updated;
      result.nfts_failed = processingResults.failed;
      result.errors = processingResults.errors;
      
      // Step 4: Update collection stats
      await this.updateCollectionStats(dbCollection.id, result.nfts_stored);
      
      result.success = true;
      result.duration_ms = Date.now() - startTime;
      
      // Update scanner log with success
      await db.update(scannerLogs)
        .set({
          status: 'completed',
          completed_at: new Date(),
          duration_ms: result.duration_ms,
          entities_scanned: result.nfts_found,
          entities_processed: result.nfts_stored + result.nfts_updated,
          entities_failed: result.nfts_failed,
          statistics: {
            nfts_found: result.nfts_found,
            nfts_stored: result.nfts_stored,
            nfts_updated: result.nfts_updated,
            nfts_failed: result.nfts_failed
          },
          warnings: result.errors.length > 0 ? result.errors : null
        } as any)
        .where(eq(scannerLogs.id, logEntry.id));
      
      console.log(`\n✅ [COLLECTION SCANNER] Scan completed successfully!`);
      console.log(`   📊 NFTs Found: ${result.nfts_found}`);
      console.log(`   💾 NFTs Stored: ${result.nfts_stored}`);
      console.log(`   🔄 NFTs Updated: ${result.nfts_updated}`);
      console.log(`   ❌ NFTs Failed: ${result.nfts_failed}`);
      console.log(`   ⏱️  Duration: ${result.duration_ms}ms`);
      
      return result;
      
    } catch (error) {
      console.error(`❌ [COLLECTION SCANNER] Scan failed:`, error);
      result.errors.push(error instanceof Error ? error.message : String(error));
      result.duration_ms = Date.now() - startTime;
      
      // Update scanner log with failure
      await db.update(scannerLogs)
        .set({
          status: 'failed',
          completed_at: new Date(),
          duration_ms: result.duration_ms,
          entities_scanned: result.nfts_found,
          entities_failed: result.nfts_failed,
          error_message: error instanceof Error ? error.message : String(error),
          error_details: { errors: result.errors }
        } as any)
        .where(eq(scannerLogs.id, logEntry.id));
      
      return result;
    }
  }
  
  /**
   * Ensure collection exists in database
   */
  private async ensureCollectionExists(
    issuer: string,
    taxon: number,
    collectionName?: string,
    gameRole?: string
  ) {
    const collectionId = `${issuer}:${taxon}`;
    
    // Check if collection exists
    const existing = await db.query.gamingNftCollections.findFirst({
      where: eq(gamingNftCollections.collection_id, collectionId)
    });
    
    if (existing) {
      console.log(`📦 [COLLECTION SCANNER] Collection already exists: ${existing.collection_name}`);
      
      // Update metadata_ingested flag
      await db.update(gamingNftCollections)
        .set({ 
          metadata_ingested: true,
          updated_at: new Date()
        } as any)
        .where(eq(gamingNftCollections.id, existing.id));
      
      return existing;
    }
    
    // Create new collection
    console.log(`📦 [COLLECTION SCANNER] Creating new collection: ${collectionName || collectionId}`);
    
    const [newCollection] = await db.insert(gamingNftCollections)
      .values({
        collection_id: collectionId,
        collection_name: collectionName || `Collection ${taxon}`,
        taxon: taxon,
        chain: 'xrpl',
        game_role: gameRole || 'army',
        power_level: 1,
        collection_verified: false,
        metadata_ingested: false,
        active_in_game: true
      } as any as any)
      .returning();
    
    return newCollection;
  }
  
  /**
   * Fetch all NFTs from Bithomp API with pagination
   */
  private async fetchAllNFTs(issuer: string, taxon: number): Promise<BithompNFT[]> {
    const allNFTs: BithompNFT[] = [];
    let marker: string | undefined;
    let pageCount = 0;
    const maxPages = Math.ceil(MAX_NFTS_PER_COLLECTION / BITHOMP_PAGE_LIMIT);
    
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': 'RiddleSwap-CollectionScanner/2.0',
    };
    
    if (BITHOMP_API_KEY) {
      headers['x-bithomp-token'] = BITHOMP_API_KEY;
    }
    
    do {
      pageCount++;
      console.log(`📄 [COLLECTION SCANNER] Fetching page ${pageCount}/${maxPages}...`);
      
      try {
        const url = new URL(`https://bithomp.com/api/v2/nft-issuer/${issuer}`);
        url.searchParams.set('taxon', taxon.toString());
        url.searchParams.set('limit', BITHOMP_PAGE_LIMIT.toString());
        if (marker) {
          url.searchParams.set('marker', marker);
        }
        
        const response = await fetch(url.toString(), { headers });
        
        if (!response.ok) {
          if (response.status === 429) {
            console.log(`⚠️ [COLLECTION SCANNER] Rate limited, waiting 5 seconds...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
            continue;
          }
          throw new Error(`Bithomp API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json() as any;
        const nfts = data.nfts || [];
        
        allNFTs.push(...nfts);
        console.log(`   ✓ Fetched ${nfts.length} NFTs (Total: ${allNFTs.length})`);
        
        marker = data.marker;
        
        // Safety limit
        if (pageCount >= maxPages) {
          console.log(`⚠️ [COLLECTION SCANNER] Reached max pages (${maxPages})`);
          break;
        }
        
        // Small delay to avoid rate limiting
        if (marker) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
      } catch (error) {
        console.error(`❌ [COLLECTION SCANNER] Error fetching page ${pageCount}:`, error);
        throw error;
      }
      
    } while (marker && allNFTs.length < MAX_NFTS_PER_COLLECTION);
    
    return allNFTs;
  }
  
  /**
   * Process and store all NFTs
   */
  private async processAndStoreNFTs(
    nfts: BithompNFT[],
    collectionDbId: string
  ): Promise<{ stored: number; updated: number; failed: number; errors: string[] }> {
    let stored = 0;
    let updated = 0;
    let failed = 0;
    const errors: string[] = [];
    
    const batchSize = 50;
    for (let i = 0; i < nfts.length; i += batchSize) {
      const batch = nfts.slice(i, i + batchSize);
      console.log(`   Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(nfts.length / batchSize)} (${batch.length} NFTs)...`);
      
      await Promise.all(
        batch.map(async (nft) => {
          try {
            const result = await this.storeNFT(nft, collectionDbId);
            if (result === 'stored') stored++;
            else if (result === 'updated') updated++;
          } catch (error) {
            failed++;
            const errorMsg = `Failed to store NFT ${nft.nftokenID}: ${error instanceof Error ? error.message : String(error)}`;
            errors.push(errorMsg);
            console.error(`   ❌ ${errorMsg}`);
          }
        })
      );
    }
    
    return { stored, updated, failed, errors };
  }
  
  /**
   * Store or update a single NFT
   */
  private async storeNFT(nft: BithompNFT, collectionDbId: string): Promise<'stored' | 'updated'> {
    // Parse metadata
    const parsedMetadata = this.parseMetadata(nft.metadata || {});
    
    // Create full NFT ID
    const nftId = nft.nftokenID;
    
    // Check if NFT exists
    const existing = await db.query.gamingNfts.findFirst({
      where: eq(gamingNfts.nft_id, nftId)
    });
    
    const nftData = {
      collection_id: collectionDbId,
      token_id: nft.sequence.toString(),
      nft_id: nftId,
      owner_address: nft.owner || null,
      metadata: nft.metadata || {},
      traits: parsedMetadata.traits,
      image_url: parsedMetadata.image,
      name: parsedMetadata.name,
      description: parsedMetadata.description,
      metadata_updated: new Date(),
      updated_at: new Date()
    };
    
    if (existing) {
      // Update existing NFT
      await db.update(gamingNfts)
        .set(nftData as any)
        .where(eq(gamingNfts.id, existing.id));
      
      return 'updated';
    } else {
      // Insert new NFT
      await db.insert(gamingNfts)
        .values({
          ...nftData,
          created_at: new Date()
        } as any);
      
      return 'stored';
    }
  }
  
  /**
   * Parse metadata into structured format
   */
  private parseMetadata(metadata: Record<string, any>): ParsedMetadata {
    const parsed: ParsedMetadata = {
      name: metadata.name || metadata.title || 'Untitled NFT',
      description: metadata.description || '',
      image: this.normalizeImageUrl(metadata.image || metadata.image_url || ''),
      traits: {},
      attributes: [],
      special_powers: []
    };
    
    // Parse attributes array
    if (Array.isArray(metadata.attributes)) {
      parsed.attributes = metadata.attributes;
      
      for (const attr of metadata.attributes) {
        const traitType = (attr.trait_type || '').toLowerCase();
        const value = attr.value;
        
        // Store in traits object
        parsed.traits[attr.trait_type || 'unknown'] = value;
        
        // Parse special fields
        if (traitType.includes('class') || traitType === 'type') {
          parsed.character_class = String(value);
        }
        if (traitType.includes('material') || traitType.includes('metal')) {
          parsed.material = String(value);
        }
        if (traitType.includes('rarity') || traitType.includes('tier')) {
          parsed.rarity = String(value);
        }
        if (traitType.includes('power') || traitType.includes('ability')) {
          parsed.special_powers.push(String(value));
        }
        if (traitType.includes('weapon')) {
          parsed.weapon_type = String(value);
        }
        if (traitType.includes('armor')) {
          parsed.armor_type = String(value);
        }
        if (traitType.includes('background')) {
          parsed.background = String(value);
        }
      }
    }
    
    // Check for traits object (alternative format)
    if (metadata.traits && typeof metadata.traits === 'object') {
      Object.assign(parsed.traits, metadata.traits);
    }
    
    // Parse additional fields
    if (metadata.external_url) parsed.external_url = metadata.external_url;
    if (metadata.animation_url) parsed.animation_url = metadata.animation_url;
    if (metadata.properties) parsed.properties = metadata.properties;
    
    return parsed;
  }
  
  /**
   * Normalize image URL (handle IPFS, etc.)
   */
  private normalizeImageUrl(url: string): string {
    if (!url) return '';
    
    // Handle IPFS URLs
    if (url.startsWith('ipfs://')) {
      return url.replace('ipfs://', 'https://ipfs.io/ipfs/');
    }
    
    // Handle ipfs.io URLs
    if (url.startsWith('ipfs/')) {
      return `https://ipfs.io/${url}`;
    }
    
    return url;
  }
  
  /**
   * Update collection statistics
   */
  private async updateCollectionStats(collectionId: string, totalNFTs: number) {
    await db.update(gamingNftCollections)
      .set({
        total_supply: totalNFTs,
        metadata_ingested: true,
        updated_at: new Date()
      } as any)
      .where(eq(gamingNftCollections.id, collectionId));
    
    console.log(`📊 [COLLECTION SCANNER] Updated collection stats: ${totalNFTs} NFTs`);
  }
}

// Export singleton instance
export const collectionInitialScanner = new CollectionInitialScanner();
