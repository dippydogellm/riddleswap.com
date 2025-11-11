/**
 * NFT Ownership Scanner Service
 * 
 * Comprehensive NFT scanning and ownership tracking service that:
 * - Scans all connected wallets for NFT ownership changes
 * - Tracks ownership history and generates notifications
 * - Aggregates NFTs by collection for gaming dashboard
 * - Integrates with Bithomp API for real-time XRPL data
 */

import { db } from '../db';
import { eq, and, isNull, desc, sql } from 'drizzle-orm';
import { 
  linkedWallets, 
  externalWallets,
  riddleWallets,
  gamingNfts, 
  gamingNftCollections, 
  playerNftOwnership,
  gamingPlayers,
  nftPowerAttributes
} from '../../shared/schema';
import { inquisitionCollections } from '../../shared/inquisition-audit-schema';

interface BithompNftData {
  issuer: string;
  nftokenID: string;  // Changed from nfTokenID to nftokenID to match API response
  nftokenTaxon: number; // Changed from nfTokenTaxon to nftokenTaxon to match API response
  uri?: string;
  metadata?: {
    name?: string;
    description?: string;
    image?: string;
    attributes?: Array<{ trait_type: string; value: any }>;
  };
  issuerTokenTaxon: string;
  owner: string;
  transferFee?: number;
  sequence: number;
  ledgerIndex: number;
  timestamp: string;
}

interface ScanResult {
  wallet_address: string;
  chain: string;
  wallet_source?: string; // 'linked' or 'external-xaman' to track wallet origin
  collections: Record<string, {
    count: number;
    power: number;
    nfts: BithompNftData[];
  }>;
  total_nfts: number;
  total_power: number;
  new_nfts: BithompNftData[];
  removed_nfts: string[]; // NFT IDs that are no longer owned
  scan_duration_ms: number;
}

interface NotificationData {
  user_handle: string;
  wallet_address: string;
  type: 'nft_added' | 'nft_removed' | 'collection_updated';
  title: string;
  message: string;
  nft_data?: BithompNftData;
  collection_name?: string;
}

export class NftOwnershipScanner {
  private readonly BITHOMP_BASE_URL = 'https://bithomp.com/api/v2';
  private collectionsCache: Map<string, { issuer: string, taxon: number, name: string }> | null = null;

  /**
   * Load all Inquisition collections from database
   */
  private async loadCollections(): Promise<Map<string, { issuer: string, taxon: number, name: string }>> {
    if (this.collectionsCache) {
      return this.collectionsCache;
    }

    try {
      const collections = await db
        .select({
          issuer: inquisitionCollections.issuer_address,
          taxon: inquisitionCollections.taxon,
          name: inquisitionCollections.collection_name
        })
        .from(inquisitionCollections);

      const collectionMap = new Map<string, { issuer: string, taxon: number, name: string }>();
      for (const col of collections) {
        const key = `${col.issuer}:${col.taxon}`;
        collectionMap.set(key, col);
      }

      this.collectionsCache = collectionMap;
      console.log(`📚 [NFT-SCANNER] Loaded ${collectionMap.size} collections from database`);
      return collectionMap;
    } catch (error) {
      console.error(`❌ [NFT-SCANNER] Failed to load collections:`, error);
      // Return empty map on error
      return new Map();
    }
  }

  /**
   * Resolve user_handle from wallet address by checking all wallet tables
   * This ensures EVERY wallet gets properly linked to a user
   */
  private async resolveUserHandle(walletAddress: string): Promise<string | null> {
    try {
      // Check riddleWallets first (primary source)
      const riddleWallet = await db
        .select({ handle: riddleWallets.handle })
        .from(riddleWallets)
        .where(eq(riddleWallets.xrpAddress, walletAddress))
        .limit(1);
      
      if (riddleWallet.length > 0) {
        console.log(`🔍 [USER-RESOLVE] Found user from riddleWallets: ${riddleWallet[0].handle}`);
        return riddleWallet[0].handle;
      }
      
      // Check linkedWallets (uses user_id and address columns)
      const linkedWallet = await db
        .select({ user_id: linkedWallets.user_id })
        .from(linkedWallets)
        .where(and(
          eq(linkedWallets.address, walletAddress),
          eq(linkedWallets.chain, 'xrp')
        ))
        .limit(1);
      
      if (linkedWallet.length > 0 && linkedWallet[0].user_id) {
        console.log(`🔍 [USER-RESOLVE] Found user from linkedWallets: ${linkedWallet[0].user_id}`);
        return linkedWallet[0].user_id;
      }
      
      // Check externalWallets (uses user_id and address columns)
      const externalWallet = await db
        .select({ user_id: externalWallets.user_id })
        .from(externalWallets)
        .where(and(
          eq(externalWallets.address, walletAddress),
          eq(externalWallets.chain, 'xrp')
        ))
        .limit(1);
      
      if (externalWallet.length > 0 && externalWallet[0].user_id) {
        console.log(`🔍 [USER-RESOLVE] Found user from externalWallets: ${externalWallet[0].user_id}`);
        return externalWallet[0].user_id;
      }
      
      console.warn(`⚠️ [USER-RESOLVE] Could not resolve user for wallet ${walletAddress}`);
      return null;
    } catch (error) {
      console.error(`❌ [USER-RESOLVE] Error resolving user:`, error);
      return null;
    }
  }

  /**
   * Scan a specific wallet for NFT ownership with comprehensive error handling
   * CRITICAL: Now ALWAYS resolves user_handle and creates ownership records uniformly
   */
  async scanWallet(walletAddress: string, userHandle?: string): Promise<ScanResult> {
    const startTime = Date.now();
    console.log(`🔍 [NFT-SCANNER] Starting scan for wallet: ${walletAddress}`);

    // Default empty result for error cases
    const emptyResult: ScanResult = {
      wallet_address: walletAddress,
      chain: 'xrp',
      collections: {},
      total_nfts: 0,
      total_power: 0,
      new_nfts: [],
      removed_nfts: [],
      scan_duration_ms: 0
    };

    try {
      // Validate wallet address format
      if (!walletAddress || !walletAddress.startsWith('r') || walletAddress.length < 25) {
        console.warn(`⚠️ [NFT-SCANNER] Invalid wallet address format: ${walletAddress}`);
        return emptyResult;
      }

      // CRITICAL FIX: ALWAYS resolve user_handle if not provided
      let resolvedUserHandle = userHandle;
      if (!resolvedUserHandle) {
        resolvedUserHandle = await this.resolveUserHandle(walletAddress) || undefined;
        if (resolvedUserHandle) {
          console.log(`✅ [NFT-SCANNER] Auto-resolved user_handle: ${resolvedUserHandle} for wallet ${walletAddress}`);
        } else {
          console.warn(`⚠️ [NFT-SCANNER] Could not resolve user for wallet ${walletAddress} - ownership will not be tracked`);
        }
      }

      // Fetch current NFTs from Bithomp with error handling
      let currentNfts: BithompNftData[] = [];
      try {
        currentNfts = await this.fetchWalletNftsFromBithomp(walletAddress);
      } catch (fetchError: any) {
        console.error(`❌ [NFT-SCANNER] Failed to fetch NFTs from Bithomp:`, fetchError?.message || fetchError);
        // Continue with empty NFT list rather than crashing
        currentNfts = [];
      }
      
      // Get previous ownership state from database with error handling
      let previousNfts: BithompNftData[] = [];
      try {
        previousNfts = await this.getPreviousNftOwnership(walletAddress);
      } catch (dbError: any) {
        console.warn(`⚠️ [NFT-SCANNER] Could not fetch previous ownership data:`, dbError?.message || dbError);
        // Continue with empty previous list
        previousNfts = [];
      }
      
      // Calculate differences
      const { newNfts, removedNfts } = this.calculateOwnershipDiffs(previousNfts, currentNfts);
      
      // Group by collections
      const collections = this.groupNftsByCollection(currentNfts);
      
      // Calculate total power (base 100 per NFT + collection bonuses)
      const totalPower = this.calculateTotalPower(currentNfts);
      
      // Update database with current state (with error handling)
      try {
        if (resolvedUserHandle) {
          // CRITICAL: Now ALWAYS updates ownership when user_handle is resolved
          console.log(`📝 [NFT-SCANNER] Updating ownership for ${resolvedUserHandle} (wallet: ${walletAddress}, ${currentNfts.length} NFTs)`);
          await this.updateInquisitionOwnership(walletAddress, currentNfts, resolvedUserHandle);
        } else {
          console.warn(`⚠️ [NFT-SCANNER] No userHandle available, skipping ownership update for ${walletAddress}`);
        }
      } catch (updateError: any) {
        console.error(`❌ [NFT-SCANNER] Failed to update database:`, updateError?.message || updateError);
        // Continue - scan results are still valid even if DB update fails
      }
      
      // Generate notifications for changes (with error handling)
      if (resolvedUserHandle && (newNfts.length > 0 || removedNfts.length > 0)) {
        try {
          await this.generateOwnershipNotifications(resolvedUserHandle, walletAddress, newNfts, removedNfts);
        } catch (notifError: any) {
          console.warn(`⚠️ [NFT-SCANNER] Failed to generate notifications:`, notifError?.message || notifError);
          // Continue - notifications are not critical
        }
      }
      
      const scanDuration = Date.now() - startTime;
      
      const result: ScanResult = {
        wallet_address: walletAddress,
        chain: 'xrp',
        collections,
        total_nfts: currentNfts.length,
        total_power: totalPower,
        new_nfts: newNfts,
        removed_nfts: removedNfts.map(nft => nft.nftokenID),
        scan_duration_ms: scanDuration
      };

      console.log(`✅ [NFT-SCANNER] Scan complete for ${walletAddress}: ${currentNfts.length} NFTs, ${Object.keys(collections).length} collections`);
      return result;

    } catch (error: any) {
      console.error(`❌ [NFT-SCANNER] Critical error scanning wallet ${walletAddress}:`, error?.message || error);
      // Return empty result instead of throwing error
      return {
        ...emptyResult,
        scan_duration_ms: Date.now() - startTime
      };
    }
  }

  /**
   * Scan ONLY the user's Riddle wallet XRPL address (no external wallets)
   */
  async scanAllUserWallets(userHandle: string): Promise<ScanResult[]> {
    console.log(`🔍 [NFT-SCANNER] Starting wallet scan for user: ${userHandle}`);

    const scanResults: ScanResult[] = [];

    try {
      // ONLY scan Riddle wallet XRPL addresses - NO external wallets
      let riddleWalletAddresses: string[] = [];
      try {
        const riddleWalletResults = await db
          .select({ 
            xrp_address: riddleWallets.xrpAddress 
          })
          .from(riddleWallets)
          .where(eq(riddleWallets.handle, userHandle));

        riddleWalletAddresses = riddleWalletResults
          .map(w => w.xrp_address)
          .filter((addr): addr is string => !!addr && addr.startsWith('r'));

        console.log(`🏦 [NFT-SCANNER] Found ${riddleWalletAddresses.length} Riddle wallet XRPL address for ${userHandle}: ${riddleWalletAddresses.join(', ')}`);
      } catch (riddleError: any) {
        console.error(`❌ [NFT-SCANNER] Failed to get Riddle wallets:`, riddleError?.message || riddleError);
        // Return empty results if we can't get the wallet
        return scanResults;
      }

      // CRITICAL: Only scan Riddle wallets, NO external wallets
      const walletsToScan: { address: string; source: string }[] = riddleWalletAddresses.map(addr => ({ 
        address: addr, 
        source: 'riddle-wallet' 
      }));

      console.log(`📊 [NFT-SCANNER] Scanning ${walletsToScan.length} Riddle wallet address(es) only`);

      // 4. Scan each wallet with error handling and rate limiting
      for (const wallet of walletsToScan) {
        try {
          console.log(`🔍 [NFT-SCANNER] Scanning ${wallet.source}: ${wallet.address.slice(0, 8)}...`);
          
          const result = await this.scanWallet(wallet.address, userHandle);
          result.wallet_source = wallet.source;
          scanResults.push(result);
          
          console.log(`✅ [NFT-SCANNER] Scanned ${wallet.source}: ${wallet.address.slice(0, 8)}... - ${result.total_nfts} NFTs found`);
          
          // Rate limiting delay between scans
          await new Promise(resolve => setTimeout(resolve, 200));
          
        } catch (walletError: any) {
          console.error(`❌ [NFT-SCANNER] Failed to scan wallet ${wallet.address}:`, walletError?.message || walletError);
          // Add empty result for failed wallet
          scanResults.push({
            wallet_address: wallet.address,
            chain: 'xrp',
            wallet_source: wallet.source,
            collections: {},
            total_nfts: 0,
            total_power: 0,
            new_nfts: [],
            removed_nfts: [],
            scan_duration_ms: 0
          });
        }
      }

      console.log(`✅ [NFT-SCANNER] Completed scanning ${scanResults.length} wallets for user ${userHandle}`);
      return scanResults;

    } catch (error: any) {
      console.error(`❌ [NFT-SCANNER] Critical error during user wallet scan:`, error?.message || error);
      // Return any partial results we have
      return scanResults;
    }
  }

  /**
   * Fetch ALL NFTs from a collection by issuer+taxon with pagination
   * Handles large collections like The Inquisition (1200 NFTs)
   */
  private async fetchCollectionNftsFromBithomp(issuer: string, taxon: number, maxNfts: number = 2000): Promise<BithompNftData[]> {
    try {
      const allNfts: any[] = [];
      let marker: string | undefined = undefined;
      const batchSize = 400; // Bithomp API limit per request
      let fetchCount = 0;

      console.log(`🌐 [COLLECTION SCANNER] Fetching all NFTs for ${issuer.slice(0, 10)}... taxon:${taxon}`);

      // Paginate through all NFTs
      while (allNfts.length < maxNfts) {
        fetchCount++;
        
        // Build URL with marker for pagination
        // Include all NFTs (not just those with metadata or images)
        let url = `${this.BITHOMP_BASE_URL}/nfts?issuer=${issuer}&taxon=${taxon}&limit=${batchSize}&includeDeleted=false`;
        if (marker) {
          url += `&marker=${marker}`;
        }
        
        console.log(`📡 [COLLECTION SCANNER] Batch ${fetchCount}: Fetching ${batchSize} NFTs from Bithomp...`);
        console.log(`   URL: ${url.replace(process.env.BITHOMP_API_KEY || '', '****')}`);
        
        const response = await fetch(url, {
          headers: {
            'x-bithomp-token': process.env.BITHOMP_API_KEY || '',
            'User-Agent': 'RiddleSwap/1.0',
            'Accept': 'application/json'
          },
          signal: AbortSignal.timeout(30000) // 30 second timeout for large collections
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ [COLLECTION SCANNER] Bithomp API failed: ${response.status}`, errorText);
          break;
        }

        const data = await response.json() as any;
        const nfts = data.nfts || [];
        
        if (nfts.length === 0) {
          console.log(`✅ [COLLECTION SCANNER] No more NFTs to fetch`);
          break;
        }

        allNfts.push(...nfts);
        console.log(`   ✅ Fetched ${nfts.length} NFTs (Total: ${allNfts.length})`);

        // Check if there's a marker for next page
        marker = data.marker;
        if (!marker) {
          console.log(`✅ [COLLECTION SCANNER] Reached end of collection (no marker)`);
          break;
        }

        // Rate limit between requests
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      console.log(`✅ [COLLECTION SCANNER] Fetched ${allNfts.length} total NFTs for ${issuer.slice(0, 10)}... taxon:${taxon}`);

      // Convert to BithompNftData format
      return allNfts.map((nft: any) => ({
        issuer: nft.issuer || issuer,
        nftokenID: nft.nftokenID || nft.NFTokenID,
        nftokenTaxon: nft.nftokenTaxon ?? nft.NFTokenTaxon ?? taxon,
        owner: nft.owner || '',
        uri: nft.uri || nft.URI,
        metadata: nft.metadata || {},
        issuerTokenTaxon: `${issuer}:${taxon}`,
        sequence: nft.sequence || 0,
        ledgerIndex: nft.ledgerIndex || 0,
        timestamp: nft.timestamp || new Date().toISOString()
      }));
    } catch (error: any) {
      console.error(`❌ [COLLECTION SCANNER] Error fetching collection:`, error?.message || error);
      return [];
    }
  }

  /**
   * Fetch NFTs from our own XRPL wallet endpoint (which uses Bithomp internally)
   */
  private async fetchWalletNftsFromBithomp(walletAddress: string): Promise<BithompNftData[]> {
    try {
      // Use proper URL for server-side fetch on Replit
      // REPLIT_DEV_DOMAIN is set automatically by Replit
      const replitDomain = process.env.REPLIT_DEV_DOMAIN;
      const baseUrl = replitDomain 
        ? `https://${replitDomain}` 
        : 'http://localhost:5000';
      const fullUrl = `${baseUrl}/api/public/wallets/xrp/nfts/${walletAddress}`;
      console.log(`🌐 [NFT SCANNER] Making request to: ${fullUrl}`);
      const response = await fetch(fullUrl);
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [NFT SCANNER] API request failed: ${response.status} ${response.statusText}`, errorText);
        throw new Error(`XRPL wallet endpoint error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;
      const nfts = data.nfts || [];
      console.log(`✅ [NFT SCANNER] Found ${nfts.length} total NFTs for wallet ${walletAddress}`);
      const issuers = Array.from(new Set(nfts.map((nft: any) => nft.issuer)));
      console.log(`📊 [NFT SCANNER] NFT Issuers found:`, issuers);

      // Load all Inquisition collections from database
      const collections = await this.loadCollections();
      
      // FILTER: All Inquisition collections (not just The Inquisition)
      const filteredNfts = nfts.filter((nft: BithompNftData) => {
        // Check both possible field names for taxon (nftTokenTaxon and nfTokenTaxon)
        const taxon = nft.nftokenTaxon ?? (nft as any).nfTokenTaxon ?? null;
        const collectionKey = `${nft.issuer}:${taxon}`;
        const isInquisitionNft = collections.has(collectionKey);
        
        if (isInquisitionNft) {
          const collection = collections.get(collectionKey);
          console.log(`✅ [NFT FILTER] NFT ${nft.nftokenID?.slice(-8)} matches collection: ${collection?.name}`);
        }
        
        return isInquisitionNft;
      });

      // Process filtered NFTs - set issuerTokenTaxon for grouping
      filteredNfts.forEach((nft: BithompNftData) => {
        const taxon = nft.nftokenTaxon ?? 0;
        const issuerTaxon = `${nft.issuer}:${taxon}`;
        nft.issuerTokenTaxon = issuerTaxon;
      });

      console.log(`✅ [NFT-SCANNER] Filtered to ${filteredNfts.length} Inquisition NFTs across ${collections.size} collections`);
      return filteredNfts;
    } catch (error) {
      console.error(`❌ [NFT-SCANNER] Bithomp API error for wallet ${walletAddress}:`, error);
      throw error;
    }
  }

  /**
   * Scan ALL NFTs from all gaming collections and POPULATE DATABASE
   * This fetches all NFTs and stores them with power scores
   */
  async scanAllCollections(): Promise<{
    collections_scanned: number;
    total_nfts_found: number;
    total_nfts_stored: number;
    nfts_by_collection: Record<string, number>;
    scan_duration_ms: number;
  }> {
    const startTime = Date.now();
    console.log(`🌐 [COLLECTION SCANNER] Starting full collection scan and database population...`);

    try {
      // Load all gaming collections
      const collections = await this.loadCollections();
      
      if (collections.size === 0) {
        console.error(`❌ [COLLECTION SCANNER] No collections found in database!`);
        return {
          collections_scanned: 0,
          total_nfts_found: 0,
          total_nfts_stored: 0,
          nfts_by_collection: {},
          scan_duration_ms: Date.now() - startTime
        };
      }

      const nftsByCollection: Record<string, number> = {};
      let totalNfts = 0;
      let totalStored = 0;

      // Scan each collection
      for (const [collectionKey, collectionInfo] of collections.entries()) {
        console.log(`\n📚 [COLLECTION SCANNER] Scanning: ${collectionInfo.name}`);
        console.log(`   Issuer: ${collectionInfo.issuer}`);
        console.log(`   Taxon: ${collectionInfo.taxon}`);

        const nfts = await this.fetchCollectionNftsFromBithomp(
          collectionInfo.issuer,
          collectionInfo.taxon,
          2000 // Fetch up to 2000 NFTs per collection
        );

        nftsByCollection[collectionInfo.name] = nfts.length;
        totalNfts += nfts.length;

        console.log(`✅ [COLLECTION SCANNER] Found ${nfts.length} NFTs in ${collectionInfo.name}`);

        // POPULATE DATABASE with all NFTs from this collection
        if (nfts.length > 0) {
          console.log(`💾 [COLLECTION SCANNER] Populating database with ${nfts.length} NFTs...`);
          const stored = await this.populateCollectionNfts(collectionKey, nfts, collectionInfo);
          totalStored += stored;
          console.log(`✅ [COLLECTION SCANNER] Stored ${stored}/${nfts.length} NFTs in database`);
        }

        // Rate limit: Wait 500ms between collection scans
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const scanDuration = Date.now() - startTime;

      console.log(`\n✅ [COLLECTION SCANNER] Full scan complete:`);
      console.log(`   Collections scanned: ${collections.size}`);
      console.log(`   Total NFTs found: ${totalNfts}`);
      console.log(`   Total NFTs stored: ${totalStored}`);
      console.log(`   Scan duration: ${scanDuration}ms`);

      return {
        collections_scanned: collections.size,
        total_nfts_found: totalNfts,
        total_nfts_stored: totalStored,
        nfts_by_collection: nftsByCollection,
        scan_duration_ms: scanDuration
      };

    } catch (error: any) {
      console.error(`❌ [COLLECTION SCANNER] Full scan failed:`, error?.message || error);
      throw error;
    }
  }

  /**
   * Populate database with all NFTs from a collection
   * Calculates power scores and stores metadata
   */
  private async populateCollectionNfts(
    collectionKey: string, 
    nfts: BithompNftData[], 
    collectionInfo: { name: string; issuer: string; taxon: number }
  ): Promise<number> {
    let storedCount = 0;

    try {
      // Get collection ID from database
      const collection = await db
        .select()
        .from(gamingNftCollections)
        .where(eq(gamingNftCollections.collection_id, collectionKey))
        .limit(1);

      if (collection.length === 0) {
        console.error(`❌ [COLLECTION SCANNER] Collection not found in database: ${collectionKey}`);
        return 0;
      }

      const collectionDbId = collection[0].id;

      // Process each NFT
      for (const nft of nfts) {
        try {
          // Calculate power score
          const powerScore = this.calculateNftPower(nft);

          // Extract metadata
          const nftName = nft.metadata?.name || `${collectionInfo.name} #${nft.sequence || 'Unknown'}`;
          const imageUrl = nft.metadata?.image || '';
          const description = nft.metadata?.description || '';

          // Check if NFT already exists
          const existing = await db
            .select()
            .from(gamingNfts)
            .where(eq(gamingNfts.nft_id, nft.nftokenID))
            .limit(1);

          if (existing.length === 0) {
            // Insert new NFT
            await (db.insert(gamingNfts) as any).values({
              collection_id: collectionDbId,
              token_id: nft.sequence?.toString() || nft.nftokenID.substring(0, 16),
              nft_id: nft.nftokenID,
              owner_address: nft.owner || null,
              metadata: nft.metadata || {},
              traits: nft.metadata?.attributes || {},
              image_url: imageUrl,
              name: nftName,
              description: description,
              rarity_score: powerScore.toString(),
              created_at: new Date(),
              updated_at: new Date()
            });
            storedCount++;
            
            if (storedCount % 10 === 0) {
              console.log(`   💾 Stored ${storedCount}/${nfts.length} NFTs...`);
            }
          } else {
            // Update existing NFT (refresh metadata and power)
            await db
              .update(gamingNfts)
              .set({
                owner_address: nft.owner || existing[0].owner_address,
                metadata: nft.metadata || {},
                traits: nft.metadata?.attributes || {},
                image_url: imageUrl,
                name: nftName,
                description: description,
                rarity_score: powerScore.toString(),
                updated_at: new Date()
              } as any)
              .where(eq(gamingNfts.nft_id, nft.nftokenID));
            storedCount++;
          }
        } catch (nftError: any) {
          console.error(`❌ [COLLECTION SCANNER] Failed to store NFT ${nft.nftokenID}:`, nftError?.message);
          // Continue with next NFT
        }
      }

      console.log(`✅ [COLLECTION SCANNER] Stored ${storedCount}/${nfts.length} NFTs for ${collectionInfo.name}`);
      return storedCount;

    } catch (error: any) {
      console.error(`❌ [COLLECTION SCANNER] Failed to populate collection ${collectionKey}:`, error?.message);
      return storedCount;
    }
  }

  /**
   * Get previous NFT ownership from database
   */
  private async getPreviousNftOwnership(walletAddress: string): Promise<BithompNftData[]> {
    try {
      const previousNfts = await db
        .select()
        .from(gamingNfts)
        .where(eq(gamingNfts.owner_address, walletAddress));

      // Convert database format to BithompNftData format
      return previousNfts.map(nft => {
        const metadata = nft.metadata as Record<string, any> || {};
        return {
          issuer: metadata.issuer || '',
          nftokenID: nft.nft_id,
          nftokenTaxon: parseInt(metadata.taxon || '0'),
          owner: nft.owner_address || '',
          metadata: metadata,
          issuerTokenTaxon: nft.collection_id,
          sequence: parseInt(metadata.sequence || '0'),
          ledgerIndex: parseInt(metadata.ledgerIndex || '0'),
          timestamp: nft.updated_at?.toISOString() || new Date().toISOString()
        };
      });
    } catch (error) {
      console.error(`❌ [NFT-SCANNER] Error fetching previous ownership:`, error);
      return [];
    }
  }

  /**
   * Calculate ownership differences
   */
  private calculateOwnershipDiffs(previous: BithompNftData[], current: BithompNftData[]) {
    const previousIds = new Set(previous.map(nft => nft.nftokenID));
    const currentIds = new Set(current.map(nft => nft.nftokenID));

    const newNfts = current.filter(nft => !previousIds.has(nft.nftokenID));
    const removedNfts = previous.filter(nft => !currentIds.has(nft.nftokenID));

    return { newNfts, removedNfts };
  }

  /**
   * Group NFTs by collection
   */
  private groupNftsByCollection(nfts: BithompNftData[]) {
    const collections: Record<string, { count: number; power: number; nfts: BithompNftData[] }> = {};

    for (const nft of nfts) {
      const collectionKey = nft.issuerTokenTaxon;
      
      if (!collections[collectionKey]) {
        collections[collectionKey] = {
          count: 0,
          power: 0,
          nfts: []
        };
      }

      collections[collectionKey].count++;
      collections[collectionKey].power += this.calculateNftPower(nft);
      collections[collectionKey].nfts.push(nft);
    }

    return collections;
  }

  /**
   * Calculate power level for an individual NFT with enhanced material + player type system
   * Caches the result on the NFT object to avoid duplicate calculations
   */
  private calculateNftPower(nft: BithompNftData & { _cachedPower?: number }): number {
    // Return cached value if already calculated
    if (nft._cachedPower !== undefined) {
      return nft._cachedPower;
    }
    
    let basePower = 100; // Base power for all NFTs

    // Collection-specific bonuses with enhanced Inquisition support
    const collectionBonuses: Record<string, number> = {
      'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH': 200, // The Inquisition Collectors Deck - Enhanced
      'rJV6oSozcXYoyWSCrZBfN2MSvjGLMpt5HK': 150, // Casino Society
      'rw1R8cfHGMySmbj7gJ1HkiCqTY1xhLGYAs': 120, // Fuzzybears
      'rXGcXx2uc2FB2LQ3BahHqUBcbgEhLA1j5': 110, // XRP Boyz
    };

    const collectionBonus = collectionBonuses[nft.issuer] || 0;
    
    // Enhanced trait-based power calculation with material + player type system
    let traitPower = 0;
    let roleMultiplier = 1.0;
    let divisionBoost = 0;
    let religionControl = 0;
    let material = 'iron'; // default material
    let playerType = 'warrior'; // default player type
    
    if (nft.metadata?.attributes) {
      const traits = nft.metadata.attributes;
      
      // Extract material from traits
      const materialTraits = ['steel', 'iron', 'gold', 'silver', 'bronze', 'mythril', 'adamant', 'dragon_scale', 'holy', 'cursed'];
      for (const trait of traits) {
        const traitValue = trait.value?.toString().toLowerCase() || '';
        for (const mat of materialTraits) {
          if (traitValue.includes(mat)) {
            material = mat;
            break;
          }
        }
      }
      
      // Material-based bonuses
      const materialBonuses: Record<string, number> = {
        'steel': 25, 'iron': 15, 'gold': 35, 'silver': 20, 'bronze': 10,
        'mythril': 50, 'adamant': 60, 'dragon_scale': 75, 'holy': 40, 'cursed': 30
      };
      traitPower += materialBonuses[material] || 0;
      
      // Enhanced role-specific power bonuses with player types
      for (const trait of traits) {
        const traitType = trait.trait_type?.toLowerCase() || '';
        const traitValue = trait.value?.toString().toLowerCase() || '';
        
        // Priest power calculation - controls religion
        if (traitType.includes('class') && traitValue.includes('priest')) {
          playerType = 'priest';
          roleMultiplier += 0.5; // 50% bonus for priests
          traitPower += 75; // Base priest power
          religionControl = 80; // High religion control
        }
        
        // Knight power calculation - provides division-wide boosts
        if (traitType.includes('class') && traitValue.includes('knight')) {
          playerType = 'knight';
          roleMultiplier += 0.8; // 80% bonus for knights
          traitPower += 100; // Base knight power
          divisionBoost = 60; // Major division-wide boost
        }
        
        // Commander power calculation - leadership focus
        if (traitType.includes('class') && traitValue.includes('commander')) {
          playerType = 'commander';
          roleMultiplier += 0.6; // 60% bonus for commanders
          traitPower += 85; // Base commander power
          divisionBoost = 40; // Moderate division boost
        }
        
        // Warrior power calculation - standard combat units
        if (traitType.includes('class') && traitValue.includes('warrior')) {
          playerType = 'warrior';
          roleMultiplier += 0.3; // 30% bonus for warriors (standard)
          traitPower += 50; // Base warrior power
        }
        
        // Mage power calculation - magical focus
        if (traitType.includes('class') && (traitValue.includes('mage') || traitValue.includes('wizard'))) {
          playerType = 'mage';
          roleMultiplier += 0.7; // 70% bonus for mages
          traitPower += 90; // Base mage power
        }
        
        // Archer power calculation - ranged combat
        if (traitType.includes('class') && (traitValue.includes('archer') || traitValue.includes('ranger'))) {
          playerType = 'archer';
          roleMultiplier += 0.4; // 40% bonus for archers
          traitPower += 60; // Base archer power
        }
        
        // Rogue power calculation - stealth and cunning
        if (traitType.includes('class') && traitValue.includes('rogue')) {
          playerType = 'rogue';
          roleMultiplier += 0.45; // 45% bonus for rogues
          traitPower += 65; // Base rogue power
        }
        
        // Rarity-based bonuses
        if (traitValue.includes('legendary')) {
          traitPower += 150;
        } else if (traitValue.includes('epic')) {
          traitPower += 100;
        } else if (traitValue.includes('rare')) {
          traitPower += 75;
        } else if (traitValue.includes('uncommon')) {
          traitPower += 50;
        }
        
        // Weapon and equipment bonuses
        if (traitType.includes('weapon')) {
          traitPower += 25;
        }
        if (traitType.includes('armor')) {
          traitPower += 20;
        }
        if (traitType.includes('magic')) {
          traitPower += 30;
        }
        
        // Special ability bonuses
        if (traitType.includes('ability') || traitType.includes('skill')) {
          traitPower += 35;
        }
      }
    }

    // Create combined name from material + player type (this is the NFT name and abilities)
    const combinedName = `${material} ${playerType}`;
    
    // Get correct gaming role based on taxon (this is the game type/category)
    const gamingRole = this.getGamingRoleByTaxon(nft.issuer, nft.nftokenTaxon || 0);  // FIXED: Use lowercase 't' to match interface
    
    // Apply gaming role power multipliers (based on taxon, not traits)
    const gamingRoleMultipliers: Record<string, number> = {
      'inquiry': 2.5,    // The Inquiry (250 base power)
      'army': 5.0,       // The Inquisition (500 base power) 
      'merchant': 4.0,   // The Lost Emporium (400 base power)
      'special': 10.0,   // DANTES AURUM (1000 base power)
      'bank': 3.0        // Under the Bridge: Troll (300 base power)
    };
    
    const finalRoleMultiplier = gamingRoleMultipliers[gamingRole] || 1.0;
    const totalPower = Math.floor((basePower + collectionBonus + traitPower) * finalRoleMultiplier);
    
    // Cache the calculated power on the NFT object
    (nft as any)._cachedPower = totalPower;
    
    console.log(`🎯 [POWER-CALC] NFT ${nft.nftokenID}: ${combinedName} (${gamingRole}) - Base(${basePower}) + Collection(${collectionBonus}) + Traits(${traitPower}) × Role(${finalRoleMultiplier}) = ${totalPower}`);
    
    return totalPower;
  }
  
  /**
   * Get NFT role based on traits for gaming mechanics with material + player type format
   */
  private getNftRole(nft: BithompNftData): string {
    if (!nft.metadata?.attributes) return 'iron warrior';
    
    let material = 'iron'; // default material
    let playerType = 'warrior'; // default player type
    
    // Extract material from traits
    const materialTraits = ['steel', 'iron', 'gold', 'silver', 'bronze', 'mythril', 'adamant', 'dragon_scale', 'holy', 'cursed'];
    for (const trait of nft.metadata.attributes) {
      const traitValue = trait.value?.toString().toLowerCase() || '';
      for (const mat of materialTraits) {
        if (traitValue.includes(mat)) {
          material = mat;
          break;
        }
      }
    }
    
    // Extract player type from traits
    for (const trait of nft.metadata.attributes) {
      const traitType = trait.trait_type?.toLowerCase() || '';
      const traitValue = trait.value?.toString().toLowerCase() || '';
      
      if (traitType.includes('class')) {
        if (traitValue.includes('priest')) playerType = 'priest';
        else if (traitValue.includes('knight')) playerType = 'knight';
        else if (traitValue.includes('commander')) playerType = 'commander';
        else if (traitValue.includes('warrior')) playerType = 'warrior';
        else if (traitValue.includes('mage') || traitValue.includes('wizard')) playerType = 'mage';
        else if (traitValue.includes('archer') || traitValue.includes('ranger')) playerType = 'archer';
        else if (traitValue.includes('rogue')) playerType = 'rogue';
        break;
      }
    }
    
    return `${material} ${playerType}`; // Combined naming convention
  }
  
  /**
   * Get special abilities for NFT based on material + player type and enhanced role system
   */
  private getNftSpecialAbilities(nft: BithompNftData): Record<string, any> {
    const fullRole = this.getNftRole(nft);
    const [material, playerType] = fullRole.split(' ');
    const abilities: Record<string, any> = {};
    
    // Player type-based abilities with enhanced specializations
    switch (playerType) {
      case 'priest':
        abilities.healing = true;
        abilities.blessings = true;
        abilities.undead_resistance = true;
        abilities.religion_control = true; // NEW: Controls religious aspects
        abilities.divine_intervention = true;
        abilities.mass_heal = true;
        abilities.turn_undead = true;
        abilities.sanctuary = true;
        break;
      case 'knight':
        abilities.division_boost = true; // NEW: Provides division-wide boosts
        abilities.heavy_armor = true;
        abilities.cavalry_charge = true;
        abilities.inspire_troops = true;
        abilities.defensive_formation = true;
        abilities.noble_leadership = true;
        abilities.battle_cry = true;
        break;
      case 'commander':
        abilities.leadership = true;
        abilities.battle_tactics = true;
        abilities.morale_boost = true;
        abilities.strategic_planning = true;
        abilities.tactical_advantage = true;
        abilities.troop_coordination = true;
        break;
      case 'mage':
        abilities.magic_attack = true;
        abilities.elemental_power = true;
        abilities.mana_regeneration = true;
        abilities.spell_mastery = true;
        abilities.arcane_knowledge = true;
        abilities.teleportation = true;
        break;
      case 'archer':
        abilities.ranged_attack = true;
        abilities.precision_strike = true;
        abilities.stealth = true;
        abilities.tracking = true;
        abilities.multi_shot = true;
        abilities.eagle_eye = true;
        break;
      case 'rogue':
        abilities.stealth = true;
        abilities.backstab = true;
        abilities.lock_picking = true;
        abilities.poison_weapons = true;
        abilities.shadow_step = true;
        abilities.critical_strike = true;
        break;
      default: // warrior - standard combat units
        abilities.melee_combat = true;
        abilities.shield_mastery = true;
        abilities.endurance = true;
        abilities.weapon_expertise = true;
        abilities.combat_training = true;
    }
    
    // Material-based ability enhancements
    const materialEnhancements: Record<string, Record<string, boolean>> = {
      'holy': { blessing_aura: true, undead_bane: true },
      'cursed': { fear_aura: true, dark_magic: true },
      'dragon_scale': { fire_resistance: true, dragon_strength: true },
      'mythril': { magic_resistance: true, enhanced_durability: true },
      'adamant': { armor_piercing: true, unbreakable: true },
      'gold': { wealth_aura: true, charm_enhancement: true },
      'steel': { sharpness: true, durability: true },
      'silver': { undead_damage: true, purification: true }
    };
    
    if (materialEnhancements[material]) {
      Object.assign(abilities, materialEnhancements[material]);
    }
    
    // Enhanced trait-based abilities
    if (nft.metadata?.attributes) {
      for (const trait of nft.metadata.attributes) {
        const traitValue = trait.value?.toString().toLowerCase() || '';
        
        if (traitValue.includes('legendary')) {
          abilities.legendary_power = true;
          abilities.aura_of_legend = true;
        }
        if (traitValue.includes('epic')) {
          abilities.epic_presence = true;
        }
        if (traitValue.includes('magic')) {
          abilities.magical_enhancement = true;
        }
        if (traitValue.includes('dragon')) {
          abilities.dragon_affinity = true;
          abilities.draconic_might = true;
        }
        if (traitValue.includes('ancient')) {
          abilities.ancient_wisdom = true;
        }
        if (traitValue.includes('blessed')) {
          abilities.divine_blessing = true;
        }
      }
    }
    
    return abilities;
  }

  /**
   * Distribute total power across 4 categories based on NFT role
   */
  private distributePowerByRole(role: string, totalPower: number): {
    army_power: number;
    religion_power: number;
    civilization_power: number;
    economic_power: number;
  } {
    const [material, playerType] = role.split(' ');
    
    // Distribution percentages based on player type
    const distributions: Record<string, { army: number; religion: number; civilization: number; economic: number }> = {
      'warrior': { army: 0.60, religion: 0.10, civilization: 0.20, economic: 0.10 },
      'knight': { army: 0.70, religion: 0.05, civilization: 0.15, economic: 0.10 },
      'priest': { army: 0.10, religion: 0.70, civilization: 0.10, economic: 0.10 },
      'mage': { army: 0.20, religion: 0.40, civilization: 0.30, economic: 0.10 },
      'commander': { army: 0.50, religion: 0.10, civilization: 0.30, economic: 0.10 },
      'merchant': { army: 0.10, religion: 0.10, civilization: 0.20, economic: 0.60 },
      'rogue': { army: 0.50, religion: 0.05, civilization: 0.15, economic: 0.30 },
      'archer': { army: 0.55, religion: 0.10, civilization: 0.20, economic: 0.15 }
    };
    
    const dist = distributions[playerType] || distributions['warrior'];
    
    return {
      army_power: Math.round(totalPower * dist.army),
      religion_power: Math.round(totalPower * dist.religion),
      civilization_power: Math.round(totalPower * dist.civilization),
      economic_power: Math.round(totalPower * dist.economic)
    };
  }

  /**
   * Calculate total power across all NFTs
   */
  private calculateTotalPower(nfts: BithompNftData[]): number {
    return nfts.reduce((total, nft) => total + this.calculateNftPower(nft), 0);
  }

  /**
   * Ensure collection exists in database, create if missing
   * Returns the database collection ID (UUID) for the NFT foreign key
   */
  private async ensureCollectionExists(nft: BithompNftData): Promise<string> {
    try {
      const issuerAddress = nft.issuer;
      const taxon = nft.nftokenTaxon || 0;  // FIXED: Use lowercase 't' to match interface
      
      // Create unique collection ID as issuer:taxon combination
      const collectionId = `${issuerAddress}:${taxon}`;
      
      // Check if collection already exists
      const existingCollection = await db
        .select()
        .from(gamingNftCollections)
        .where(eq(gamingNftCollections.collection_id, collectionId))
        .limit(1);

      if (existingCollection.length > 0) {
        return existingCollection[0].id; // Return the UUID primary key
      }

      // Get proper gaming role based on taxon
      const gamingRole = this.getGamingRoleByTaxon(issuerAddress, taxon);
      
      // Create new collection with taxon-specific details
      const newCollectionResult = await (db.insert(gamingNftCollections) as any).values({
        collection_id: collectionId,
        collection_name: `${this.getCollectionName(issuerAddress as any)} (${gamingRole})`,
        role_description: `${gamingRole} collection from ${this.getCollectionName(issuerAddress)}`,
        taxon: taxon,
        game_role: gamingRole,
        power_level: this.getCollectionPowerMultiplier(issuerAddress),
        active_in_game: true,
        created_at: new Date(),
        updated_at: new Date()
      }).returning({ id: gamingNftCollections.id });
      
      console.log(`📦 [NFT-SCANNER] Created new collection: ${this.getCollectionName(issuerAddress)} (${gamingRole}, taxon ${taxon})`);
      return newCollectionResult[0].id; // Return the new UUID primary key
    } catch (error) {
      console.error(`❌ [NFT-SCANNER] Error ensuring collection exists:`, error);
      // Return fallback - try to find existing by issuer:taxon
      const collectionId = `${nft.issuer}:${nft.nftokenTaxon || 0}`;  // FIXED: Use lowercase 't' to match interface
      const fallback = await db
        .select()
        .from(gamingNftCollections)
        .where(eq(gamingNftCollections.collection_id, collectionId))
        .limit(1);
      
      if (fallback.length > 0) {
        return fallback[0].id;
      }
      
      throw error; // Re-throw if we can't create or find collection
    }
  }

  /**
   * Ensure gaming player record exists, create if missing, and return the player ID
   * Uses the provided transaction object for atomicity
   */
  private async ensureGamingPlayerExists(userHandle: string, tx: any): Promise<string> {
    try {
      // Check if gaming player already exists
      const existingPlayer = await tx
        .select({ id: gamingPlayers.id })
        .from(gamingPlayers)
        .where(eq(gamingPlayers.user_handle, userHandle))
        .limit(1);

      if (existingPlayer.length > 0) {
        return existingPlayer[0].id; // Return the existing player ID
      }

      // Create new gaming player record and return the ID
      const newPlayer = await tx.insert(gamingPlayers).values({
        user_handle: userHandle,
        player_name: userHandle, // Use handle as default username
        wallet_address: '', // Will be updated later
        chain: 'xrpl',
        created_at: new Date(),
        updated_at: new Date()
      }).returning({ id: gamingPlayers.id });
      
      console.log(`🎮 [NFT-SCANNER] Created gaming player record for: ${userHandle}`);
      return newPlayer[0].id;
    } catch (error) {
      console.error(`❌ [NFT-SCANNER] Error ensuring gaming player exists for ${userHandle}:`, error);
      throw error;
    }
  }

  /**
   * Update NFT ownership in the inquisition_user_ownership table
   * This properly tracks current ownership by marking old NFTs as not current
   * and inserting/updating new NFTs as current
   * ALSO inserts into gamingNfts table for game queries
   */
  private async updateInquisitionOwnership(walletAddress: string, nfts: BithompNftData[], userHandle: string) {
    console.log(`📝 [NFT-SCANNER] Updating ownership for ${userHandle} wallet ${walletAddress} with ${nfts.length} NFTs`);
    
    try {
      // Get the IDs of currently owned NFTs from blockchain
      const currentNftIds = new Set(nfts.map(nft => nft.nftokenID));
      
      // Import required tables
      const { inquisitionUserOwnership, inquisitionNftAudit } = await import("@shared/schema");
      
      // Transaction to update ownership
      await db.transaction(async (tx) => {
        // Step 1: Mark all previously owned NFTs as not current if they're no longer owned
        const previousOwned = await tx
          .select({ nft_token_id: inquisitionUserOwnership.nft_token_id })
          .from(inquisitionUserOwnership)
          .where(and(
            eq(inquisitionUserOwnership.wallet_address, walletAddress),
            eq(inquisitionUserOwnership.is_current_owner, true)
          ));
        
        for (const prev of previousOwned) {
          if (!currentNftIds.has(prev.nft_token_id)) {
            console.log(`❌ [NFT-SCANNER] Marking NFT ${prev.nft_token_id} as no longer owned`);
            await tx
              .update(inquisitionUserOwnership)
              .set({  
                is_current_owner: false,
                lost_ownership_at: new Date(),
                updated_at: new Date()
               } as any)
              .where(and(
                eq(inquisitionUserOwnership.wallet_address, walletAddress),
                eq(inquisitionUserOwnership.nft_token_id, prev.nft_token_id)
              ));
          }
        }
        
        // Step 2: Insert/update currently owned NFTs
        for (const nft of nfts) {
          // Use the actual name from metadata if available
          let nftName = nft.metadata?.name || '';
          const imageUrl = nft.metadata?.image || '';
          
          // Only create a generic name if no metadata name exists
          if (!nftName) {
            // Try to extract NFT number from image URL for a fallback name
            const numberMatch = imageUrl.match(/(?:\/|%2F)(\d+)\.(?:png|jpg|jpeg|webp)/i);
            if (numberMatch) {
              nftName = `The Inquisition #${numberMatch[1]}`;
            } else {
              nftName = `NFT #${nft.sequence || 'Unknown'}`;
            }
          }
          
          console.log(`✅ [NFT-SCANNER] Upserting NFT: ${nftName} (${nft.nftokenID})`);
          
          // Try to find and insert into gamingNfts table if collection exists
          // But don't block ownership updates if collection not found
          const collectionKey = `${nft.issuer}:${nft.nftokenTaxon}`;
          const collection = await tx
            .select()
            .from(gamingNftCollections)
            .where(and(
              eq(gamingNftCollections.collection_id, collectionKey), // Use full issuer:taxon key
              eq(gamingNftCollections.taxon, nft.nftokenTaxon)
            ))
            .limit(1);
          
          if (collection.length > 0) {
            const collectionId = collection[0].id;
            
            // CRITICAL FIX: Also insert/update in gamingNfts table so the join works
            const existingGamingNft = await tx
              .select()
              .from(gamingNfts)
              .where(eq(gamingNfts.nft_id, nft.nftokenID))
              .limit(1);
            
            if (existingGamingNft.length === 0) {
              // Insert into gamingNfts
              await (tx
                .insert(gamingNfts) as any)
                .values({
                  collection_id: collectionId,
                  token_id: nft.sequence?.toString() || nft.nftokenID.substring(0, 16),
                  nft_id: nft.nftokenID,
                  owner_address: walletAddress,
                  metadata: nft.metadata || {},
                  traits: nft.metadata?.attributes || {},
                  image_url: imageUrl,
                  name: nftName,
                  description: nft.metadata?.description || '',
                  rarity_score: '100',
                  created_at: new Date(),
                  updated_at: new Date()
                });
              console.log(`🎮 [NFT-SCANNER] Inserted NFT into gamingNfts: ${nftName}`);
            } else {
              // Update existing gaming NFT
              await tx
                .update(gamingNfts)
                .set({
                  owner_address: walletAddress,
                  metadata: nft.metadata || {},
                  traits: nft.metadata?.attributes || {},
                  image_url: imageUrl,
                  name: nftName,
                  updated_at: new Date()
                } as any)
                .where(eq(gamingNfts.nft_id, nft.nftokenID));
              console.log(`🎮 [NFT-SCANNER] Updated NFT in gamingNfts: ${nftName}`);
            }
          } else {
            console.warn(`⚠️ [NFT-SCANNER] No gaming collection found for ${collectionKey} - skipping gamingNfts insert (but will still update ownership)`);
          }
          
          // ALWAYS update audit and ownership tables regardless of gaming collection
          // First ensure the NFT exists in the audit table
          const existingAudit = await tx
            .select()
            .from(inquisitionNftAudit)
            .where(eq(inquisitionNftAudit.nft_token_id, nft.nftokenID))
            .limit(1);
          
          // We don't need the nft_id for the ownership table, just the token ID
          if (existingAudit.length > 0) {
            // Update current owner in audit table
            await tx
              .update(inquisitionNftAudit)
              .set({ 
                current_owner: walletAddress,
                last_updated_at: new Date()
               } as any)
              .where(eq(inquisitionNftAudit.nft_token_id, nft.nftokenID));
          }
          
          // Upsert into ownership table
          // First get nft_id from audit table if it exists
          let nftDbId = existingAudit.length > 0 ? existingAudit[0].id : null;
          console.log(`🔍 [NFT-SCANNER] Audit check for ${nft.nftokenID}: found=${existingAudit.length}, nftDbId=${nftDbId}`);
          
          const existingOwnership = await tx
            .select()
            .from(inquisitionUserOwnership)
            .where(and(
              eq(inquisitionUserOwnership.wallet_address, walletAddress),
              eq(inquisitionUserOwnership.nft_token_id, nft.nftokenID)
            ))
            .limit(1);
          
          console.log(`🔍 [NFT-SCANNER] Ownership check: existingCount=${existingOwnership.length}, nftDbId=${nftDbId}`);
          
          if (existingOwnership.length === 0 && nftDbId) {
            console.log(`✅ [NFT-SCANNER] INSERTING ownership for ${nft.nftokenID} - wallet=${walletAddress}, handle=${userHandle}, nftDbId=${nftDbId}`);
            // Insert new ownership - only if we have an nft_id from audit table
            await (tx
              .insert(inquisitionUserOwnership) as any)
              .values({
                wallet_address: walletAddress,
                user_handle: userHandle,
                nft_id: nftDbId,
                nft_token_id: nft.nftokenID,
                is_current_owner: true,
                acquired_at: new Date(),
                acquisition_type: 'scan',
                created_at: new Date(),
                updated_at: new Date()
              });
            console.log(`🎉 [NFT-SCANNER] Successfully INSERTED ownership for ${nft.nftokenID}`);
          } else if (existingOwnership.length > 0) {
            console.log(`🔄 [NFT-SCANNER] UPDATING ownership for ${nft.nftokenID}`);
            // Update existing ownership - CRITICAL: also update user_handle in case wallet changed hands!
            await tx
              .update(inquisitionUserOwnership)
              .set({ 
                user_handle: userHandle,  // CRITICAL FIX: Update user_handle too!
                is_current_owner: true,
                lost_ownership_at: null,
                updated_at: new Date()
               } as any)
              .where(and(
                eq(inquisitionUserOwnership.wallet_address, walletAddress),
                eq(inquisitionUserOwnership.nft_token_id, nft.nftokenID)
              ));
            console.log(`🎉 [NFT-SCANNER] Successfully UPDATED ownership for ${nft.nftokenID}`);
          } else {
            console.warn(`⚠️ [NFT-SCANNER] SKIPPING ownership for ${nft.nftokenID} - no nft_id found in audit table (nftDbId=${nftDbId})`);
          }
        }
      });
      
      console.log(`✅ [NFT-SCANNER] Successfully updated ownership for ${userHandle}`);
    } catch (error: any) {
      console.error(`❌ [NFT-SCANNER] Failed to update ownership:`, error);
      throw error;
    }
  }
  
  /**
   * DEPRECATED: Old update method - keeping for backward compatibility
   * Use updateInquisitionOwnership instead
   */
  private async updateNftOwnership(walletAddress: string, nfts: BithompNftData[], userHandle?: string) {
    try {
      // Remove old ownership records for this wallet
      await db
        .delete(gamingNfts)
        .where(eq(gamingNfts.owner_address, walletAddress));

      // If userHandle is provided, also remove old ownership links
      if (userHandle) {
        // Remove old ownership records for this user from this wallet
        const existingNfts = await db
          .select({ nft_id: gamingNfts.nft_id })
          .from(gamingNfts)
          .where(eq(gamingNfts.owner_address, walletAddress));
        
        if (existingNfts.length > 0) {
          const nftIds = existingNfts.map(n => n.nft_id);
          await db
            .delete(playerNftOwnership)
            .where(and(
              eq(playerNftOwnership.player_id, userHandle),
              sql`${playerNftOwnership.nft_id} IN (${sql.join(nftIds.map(id => sql`${id}`), sql`, `)})`
            ));
        }
      }

      // Insert current NFT ownership with proper collection references in a transaction
      for (const nft of nfts) {
        await db.transaction(async (tx) => {
          // Ensure collection exists and get its database ID
          const collectionDbId = await this.ensureCollectionExists(nft);
          
          const enrichedMetadata = {
            ...nft.metadata,
            issuer: nft.issuer,
            taxon: nft.nftokenTaxon?.toString() || '0',  // FIXED: Use lowercase 't' to match interface
            sequence: nft.sequence?.toString() || '0',
            ledgerIndex: nft.ledgerIndex?.toString() || '0',
            chain: 'xrp'
          };

          const calculatedPower = this.calculateNftPower(nft);
          const nftRole = this.getNftRole(nft);
          const specialAbilities = this.getNftSpecialAbilities(nft);
          
          // Enhanced game stats with role and abilities
          const enhancedGameStats = {
            base_power: calculatedPower,
            role: nftRole,
            special_abilities: specialAbilities,
            combat_effectiveness: calculatedPower * (specialAbilities.legendary_power ? 1.5 : 1.0),
            leadership_value: nftRole === 'commander' ? calculatedPower * 1.2 : 0,
            magical_power: nftRole === 'priest' || nftRole === 'mage' ? calculatedPower * 0.8 : 0,
            calculated_at: new Date().toISOString()
          };
          
          const nftId = nft.nftokenID || 'unknown-nft';
          
          // Fetch CDN image from Bithomp assets API
          let imageUrl = nft.metadata?.image || '';
          try {
            const bithompUrl = `https://bithomp.com/api/v2/nft/${nftId}?assets=true`;
            const bithompResponse = await fetch(bithompUrl, {
              headers: {
                'x-bithomp-token': process.env.BITHOMP_API_KEY || '',
                'User-Agent': 'RiddleSwap/1.0',
                'Accept': 'application/json'
              },
              signal: AbortSignal.timeout(3000)
            });
            
            if (bithompResponse.ok) {
              const bithompData = await bithompResponse.json();
              imageUrl = bithompData.assets?.image || bithompData.assets?.preview || bithompData.assets?.thumbnail || `https://cdn.bithomp.com/nft/${nftId}.webp`;
            }
          } catch (error) {
            console.error(`⚠️ [NFT-SCANNER] Failed to fetch image for ${nftId}:`, error);
          }
          
          // Extract NFT number from image URL or metadata name
          let nftName = nft.metadata?.name;
          
          // Always try to extract from image URL for better names
          // Handle both normal slashes and URL-encoded %2F
          const numberMatch = imageUrl.match(/(?:\/|%2F)(\d+)\.(?:png|jpg|jpeg|webp)/i);
          if (numberMatch) {
            nftName = `The Inquisition #${numberMatch[1]}`;
            console.log(`📛 [NFT NAME] Extracted from URL: ${nftName} (${imageUrl})`);
          } else if (!nftName) {
            // Fallback only if no metadata name AND couldn't extract from URL
            nftName = `NFT #${nft.sequence || 'Unknown'}`;
            console.log(`📛 [NFT NAME] Using fallback: ${nftName}`);
          }
          
          // Insert NFT record first in the transaction and get the UUID primary key
          const insertResult = await (tx.insert(gamingNfts) as any).values({
            collection_id: collectionDbId, // Use the database UUID, not the issuer address
            token_id: nft.nftokenID || 'unknown-token', 
            nft_id: nftId,
            owner_address: walletAddress,
            metadata: enrichedMetadata,
            traits: nft.metadata?.attributes || {},
            game_stats: enhancedGameStats,
            image_url: imageUrl,
            name: nftName,
            description: nft.metadata?.description || '',
            rarity_rank: nft.sequence || 0,
            rarity_score: calculatedPower.toString(),
            power_multiplier: (calculatedPower / 100).toString(),
            last_transferred: new Date(),
            metadata_updated: new Date()
          }).returning({ id: gamingNfts.id });

          // Get the UUID primary key from the inserted record
          const gamingNftUuid = insertResult[0].id;

          // Create power attributes for the NFT - distribute power based on role
          const powerDistribution = this.distributePowerByRole(nftRole, calculatedPower);
          await (tx.insert(nftPowerAttributes) as any).values({
            nft_id: gamingNftUuid,
            collection_id: collectionDbId,
            owner_address: walletAddress,
            army_power: powerDistribution.army_power,
            religion_power: powerDistribution.religion_power,
            civilization_power: powerDistribution.civilization_power,
            economic_power: powerDistribution.economic_power,
            total_power: calculatedPower,
            power_source: 'blockchain_scan',
            material_multiplier: "1.00",
            rarity_multiplier: "1.00"
          }).onConflictDoUpdate({
            target: nftPowerAttributes.nft_id,
            set: {
              army_power: powerDistribution.army_power,
              religion_power: powerDistribution.religion_power,
              civilization_power: powerDistribution.civilization_power,
              economic_power: powerDistribution.economic_power,
              total_power: calculatedPower
            } as any
          });

          // If userHandle is provided, create ownership link in the same transaction
          if (userHandle) {
            // Ensure gaming player record exists first and get the player ID (using transaction)
            const playerId = await this.ensureGamingPlayerExists(userHandle, tx);
            
            await (tx.insert(playerNftOwnership) as any).values({
              player_id: playerId,
              nft_id: gamingNftUuid, // Use the UUID primary key, not the XRPL token hash
              collection_id: collectionDbId,
              ownership_verified: true,
              gaming_active: true,
              verification_method: 'blockchain_scan',
              verification_date: new Date(),
              power_contribution: calculatedPower,
              special_bonuses: specialAbilities
            });
          }
        });
      }

      console.log(`💾 [NFT-SCANNER] Updated database with ${nfts.length} NFTs for wallet ${walletAddress}`);
      if (userHandle) {
        console.log(`🔗 [NFT-SCANNER] Created ${nfts.length} ownership links for user ${userHandle}`);
      }
    } catch (error) {
      console.error(`❌ [NFT-SCANNER] Error updating database:`, error);
      throw error;
    }
  }

  /**
   * Generate notifications for ownership changes
   */
  private async generateOwnershipNotifications(
    userHandle: string, 
    walletAddress: string, 
    newNfts: BithompNftData[], 
    removedNfts: BithompNftData[]
  ) {
    const notifications: NotificationData[] = [];

    // Notifications for new NFTs
    for (const nft of newNfts) {
      notifications.push({
        user_handle: userHandle,
        wallet_address: walletAddress,
        type: 'nft_added',
        title: '🎨 New NFT Detected!',
        message: `Added: ${nft.metadata?.name || 'Unknown NFT'} from ${this.getCollectionName(nft.issuer)}`,
        nft_data: nft,
        collection_name: this.getCollectionName(nft.issuer)
      });
    }

    // Notifications for removed NFTs
    for (const nft of removedNfts) {
      notifications.push({
        user_handle: userHandle,
        wallet_address: walletAddress,
        type: 'nft_removed',
        title: '📤 NFT Transferred',
        message: `Removed: ${nft.metadata?.name || 'Unknown NFT'} from ${this.getCollectionName(nft.issuer)}`,
        nft_data: nft,
        collection_name: this.getCollectionName(nft.issuer)
      });
    }

    // Store notifications (for now just log them - will use database table when available)
    for (const notification of notifications) {
      console.log(`📢 [NFT-SCANNER] NOTIFICATION for ${userHandle}: ${notification.title} - ${notification.message}`);
    }

    console.log(`📢 [NFT-SCANNER] Generated ${notifications.length} notifications for ${userHandle}`);
  }

  /**
   * Get human-readable collection name
   */
  private getCollectionName(issuer: string): string {
    const collectionNames: Record<string, string> = {
      // Only The Inquisition Collectors Deck for gaming system
      'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH': 'The Inquisition Collectors Deck'
    };

    return collectionNames[issuer] || `Collection ${issuer.slice(0, 8)}...`;
  }

  /**
   * Get gaming role based on issuer:taxon combination
   */
  private getGamingRoleByTaxon(issuer: string, taxon: number): string {
    // Only for the main gaming issuer
    if (issuer === 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH') {
      switch (taxon) {
        case 0: return 'inquiry';    // The Inquiry (inquiry role, 250 power)
        case 2: return 'army';       // The Inquisition (army role, 500 power)
        case 3: return 'merchant';   // The Lost Emporium (merchant role, 400 power)
        case 4: return 'special';    // DANTES AURUM (special role, 1000 power)
        case 9: return 'bank';       // Under the Bridge: Troll (bank role, 300 power)
        default: return 'army';      // Fallback to army
      }
    }
    
    return 'army'; // Default for other issuers
  }

  /**
   * Get collection power level for gaming system
   */
  private getCollectionPowerMultiplier(issuer: string): number {
    const powerLevels: Record<string, number> = {
      'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH': 8 // The Inquisition Collectors Deck = high power
    };
    
    return powerLevels[issuer] || 3; // Default to moderate power
  }

  /**
   * Get aggregated NFT data for gaming dashboard
   */
  async getWalletNftSummary(walletAddress: string): Promise<{
    collections: Record<string, { count: number; power: number; name: string }>;
    total_nfts: number;
    total_power: number;
  }> {
    try {
      const nfts = await db
        .select()
        .from(gamingNfts)
        .where(eq(gamingNfts.owner_address, walletAddress));

      const collections: Record<string, { count: number; power: number; name: string }> = {};
      let totalNfts = 0;
      let totalPower = 0;

      for (const nft of nfts) {
        const metadata = nft.metadata as Record<string, any> || {};
        const collectionKey = nft.collection_id;
        const issuer = metadata.issuer || '';
        
        if (!collections[collectionKey]) {
          collections[collectionKey] = {
            count: 0,
            power: 0,
            name: this.getCollectionName(issuer)
          };
        }

        const nftPower = parseFloat(nft.power_multiplier || '1') * 100;
        collections[collectionKey].count++;
        collections[collectionKey].power += nftPower;
        totalNfts++;
        totalPower += nftPower;
      }

      return {
        collections,
        total_nfts: totalNfts,
        total_power: totalPower
      };
    } catch (error) {
      console.error(`❌ [NFT-SCANNER] Error getting wallet summary:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const nftOwnershipScanner = new NftOwnershipScanner();