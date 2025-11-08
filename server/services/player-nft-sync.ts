/**
 * Player NFT Sync Service
 * 
 * Automatically syncs NFT ownership from inquisition_nft_audit to gaming_players
 * Runs on every login to ensure accurate NFT counts and power levels
 */

import { db } from "../db";
import { eq, and, sql } from "drizzle-orm";
import { gamingPlayers, playerNftOwnership } from "@shared/schema";
import { inquisitionNftAudit } from "@shared/inquisition-audit-schema";

interface PlayerNFTStats {
  total_nfts: number;
  total_power: number;
  army_power: number;
  bank_power: number;
  merchant_power: number;
  special_power: number;
  collections: Record<string, number>;
}

/**
 * Safely parse DECIMAL database values to numbers
 * DECIMAL columns return strings from Postgres, this prevents string concatenation bugs
 * @param value - The DECIMAL value from database (string, null, or undefined)
 * @param context - Context for logging (e.g., "power_strength for NFT abc123")
 * @returns Parsed number or 0 if invalid, with logging for malformed data
 */
function parseDecimalSafely(value: any, context: string = "unknown"): number {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return 0;
  }
  
  // Convert to string first (handles both string and number inputs)
  const strValue = String(value).trim();
  
  // Empty string check
  if (strValue === '' || strValue === 'null' || strValue === 'undefined') {
    return 0;
  }
  
  // Parse to float
  const parsed = parseFloat(strValue);
  
  // Check for NaN (malformed data)
  if (isNaN(parsed)) {
    console.warn(`⚠️ [DECIMAL-PARSE] Malformed DECIMAL value for ${context}: "${value}" → defaulting to 0`);
    return 0;
  }
  
  return parsed;
}

/**
 * Sync NFTs for a specific player based on their wallet address
 */
export async function syncPlayerNFTs(walletAddress: string, userHandle: string): Promise<PlayerNFTStats> {
  console.log(`🔄 [NFT-SYNC] Syncing NFTs for ${userHandle} (${walletAddress})`);

  try {
    // Get all NFTs owned by this wallet from the audit table
    const ownedNFTs = await db
      .select({
        nft_token_id: inquisitionNftAudit.nft_token_id,
        total_points: inquisitionNftAudit.total_points,
        power_strength: inquisitionNftAudit.power_strength,
        power_defense: inquisitionNftAudit.power_defense,
        power_magic: inquisitionNftAudit.power_magic,
        power_speed: inquisitionNftAudit.power_speed,
        collection_id: inquisitionNftAudit.collection_id,
      })
      .from(inquisitionNftAudit)
      .where(
        and(
          eq(inquisitionNftAudit.current_owner, walletAddress),
          eq(inquisitionNftAudit.is_active, true)
        )
      );

    console.log(`📊 [NFT-SYNC] Found ${ownedNFTs.length} NFTs for ${userHandle}`);

    // Calculate total power (sum of all 4 power attributes)
    let totalPower = 0;
    let armyPower = 0;
    let bankPower = 0;
    let merchantPower = 0;
    let specialPower = 0;

    const collectionCounts: Record<string, number> = {};

    for (const nft of ownedNFTs) {
      // CRITICAL: Use parseDecimalSafely to prevent string concatenation bugs
      // Provides logging for malformed data instead of silent failures
      const nftIdContext = nft.nft_token_id ? ` for NFT ${nft.nft_token_id.substring(0, 8)}...` : '';
      const strength = parseDecimalSafely(nft.power_strength, `power_strength${nftIdContext}`);
      const defense = parseDecimalSafely(nft.power_defense, `power_defense${nftIdContext}`);
      const magic = parseDecimalSafely(nft.power_magic, `power_magic${nftIdContext}`);
      const speed = parseDecimalSafely(nft.power_speed, `power_speed${nftIdContext}`);
      
      // Sum all power attributes (now as validated numbers)
      const nftTotalPower = strength + defense + magic + speed;
      
      // Log per-NFT breakdown for first few NFTs (debugging)
      if (ownedNFTs.indexOf(nft) < 3) {
        console.log(`🔢 [NFT-SYNC] Sample NFT power: S=${strength}, D=${defense}, M=${magic}, Sp=${speed}, Total=${nftTotalPower}`);
      }
      
      totalPower += nftTotalPower;

      // Distribute power across categories (simplified distribution)
      armyPower += strength + defense;
      bankPower += magic;
      merchantPower += speed;
      specialPower += Math.floor(nftTotalPower * 0.1); // 10% bonus to special

      // Count by collection
      const collectionKey = `collection_${nft.collection_id}`;
      collectionCounts[collectionKey] = (collectionCounts[collectionKey] || 0) + 1;
    }

    // Get or create gaming player record
    let player = await db.query.gamingPlayers.findFirst({
      where: eq(gamingPlayers.wallet_address, walletAddress)
    });

    if (!player) {
      // Create new player record
      console.log(`➕ [NFT-SYNC] Creating new gaming player for ${userHandle}`);
      const [newPlayer] = await db.insert(gamingPlayers)
        // Cast to any to tolerate additional fields (e.g. chain) that may not be declared in schema
        .values({
          user_handle: userHandle,
          wallet_address: walletAddress,
          chain: 'xrpl',
          player_name: userHandle,
          total_nfts_owned: ownedNFTs.length,
          total_power_level: String(totalPower as any), // Convert to string for DECIMAL column
          army_power: String(armyPower), // Convert to string for DECIMAL column
          bank_power: String(bankPower), // Convert to string for DECIMAL column
          merchant_power: String(merchantPower), // Convert to string for DECIMAL column
          special_power: String(specialPower), // Convert to string for DECIMAL column
          last_active: new Date(),
        } as any)
        .returning();
      
      player = newPlayer;
    } else {
      // Update existing player
      console.log(`🔄 [NFT-SYNC] Updating gaming player ${userHandle}`);
      await db.update(gamingPlayers)
        .set({ 
          total_nfts_owned: ownedNFTs.length,
          total_power_level: String(totalPower), // Convert to string for DECIMAL column
          army_power: String(armyPower), // Convert to string for DECIMAL column
          bank_power: String(bankPower), // Convert to string for DECIMAL column
          merchant_power: String(merchantPower), // Convert to string for DECIMAL column
          special_power: String(specialPower), // Convert to string for DECIMAL column
          last_active: new Date(),
          updated_at: new Date(),
         } as any)
        .where(eq(gamingPlayers.wallet_address, walletAddress));
    }

    // Note: player_nft_ownership sync is disabled - it's designed for gaming_nfts table
    // The inquisition_nft_audit table is the source of truth for NFT ownership

    console.log(`✅ [NFT-SYNC] Synced ${ownedNFTs.length} NFTs, Total Power: ${totalPower}`);

    return {
      total_nfts: ownedNFTs.length,
      total_power: totalPower,
      army_power: armyPower,
      bank_power: bankPower,
      merchant_power: merchantPower,
      special_power: specialPower,
      collections: collectionCounts,
    };
  } catch (error) {
    console.error(`❌ [NFT-SYNC] Failed to sync NFTs for ${userHandle}:`, error);
    throw error;
  }
}

/**
 * Sync all players - useful for batch updates
 */
export async function syncAllPlayers(): Promise<{ synced: number; errors: number }> {
  console.log(`🔄 [NFT-SYNC] Starting full player sync...`);

  try {
    // Select only required columns with explicit typing to avoid any->unknown issues
    const allPlayers = await db.query.gamingPlayers.findMany({
      columns: { wallet_address: true, user_handle: true }
    });
    
    let synced = 0;
    let errors = 0;

    for (const player of allPlayers) {
      try {
  await syncPlayerNFTs(player.wallet_address as unknown as string, player.user_handle as unknown as string);
        synced++;
      } catch (error) {
        console.error(`❌ [NFT-SYNC] Failed to sync ${player.user_handle}:`, error);
        errors++;
      }

      // Small delay to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`✅ [NFT-SYNC] Full sync complete: ${synced} synced, ${errors} errors`);
    
    return { synced, errors };
  } catch (error) {
    console.error(`❌ [NFT-SYNC] Full sync failed:`, error);
    throw error;
  }
}
