/**
 * Collection Theme Scanner
 * Scans specific NFT collections and applies thematic power bonuses
 * 
 * Collections:
 * - Under the Bridge: Banker theme (Economic Power +50%)
 * - Lost Emporium: Weapons theme (Army Power +50%)
 * - Dantes Aurum: Sacred items theme (Religion Power +50%)
 */

import { db } from "./db";
import { gamingNfts, gamingNftCollections, nftPowerAttributes } from "../shared/schema";
import { eq } from "drizzle-orm";
import { calculatePowerFromMetadata } from "./nft-power-scanner";

interface CollectionTheme {
  issuer: string;
  name: string;
  theme: 'banker' | 'weapon' | 'sacred' | 'gods';
  taxon?: number;
  powerBoost: {
    army?: number;
    religion?: number;
    civilization?: number;
    economic?: number;
  };
  keywords: string[];
}

const THEMED_COLLECTIONS: CollectionTheme[] = [
  {
    issuer: 'rp5DGDDDFZdQswWfn3sgkQznCAj9SkkCMLH',
    name: 'Under the Bridge',
    theme: 'banker',
    taxon: 9,
    powerBoost: { economic: 1.5 }, // +50% economic power
    keywords: ['banker', 'merchant', 'trader', 'gold', 'coin', 'wealth', 'financial', 'commerce']
  },
  {
    issuer: 'rp5DGDDDFZdQswWfn3sgkQznCAj9SkkCMLH',
    name: 'The Inquiry',
    theme: 'gods',
    taxon: 1,
    powerBoost: { religion: 1.8, civilization: 1.3 }, // +80% religion, +30% civilization
    keywords: ['god', 'deity', 'divine', 'celestial', 'immortal', 'supreme', 'almighty', 'eternal', 'pantheon']
  },
  {
    issuer: 'rp5DGDDDFZdQswWfn3sgkQznCAj9SkkCMLH',
    name: 'Dantes Aurum',
    theme: 'sacred',
    taxon: 3,
    powerBoost: { religion: 1.5 }, // +50% religion power
    keywords: ['sacred', 'holy', 'divine', 'blessed', 'relic', 'temple', 'prayer', 'saint']
  },
  {
    issuer: 'rp5DGDDDFZdQswWfn3sgkQznCAj9SkkCMLH',
    name: 'The Lost Emporium',
    theme: 'weapon',
    taxon: 2,
    powerBoost: { army: 1.5 }, // +50% army power
    keywords: ['weapon', 'sword', 'axe', 'bow', 'spear', 'armor', 'shield', 'blade', 'dagger']
  }
];

/**
 * Fetch NFTs from xrp.cafe collection
 */
async function fetchCollectionNFTs(collectionSlug: string): Promise<any[]> {
  try {
    console.log(`🔍 Fetching NFTs from xrp.cafe collection: ${collectionSlug}`);
    
    // xrp.cafe uses a different API - we'll need to fetch from their website
    // For now, we'll return empty array and log for manual verification
    console.log(`⚠️ Manual verification needed for: https://xrp.cafe/collection/${collectionSlug}`);
    
    return [];
  } catch (error) {
    console.error(`Error fetching collection ${collectionSlug}:`, error);
    return [];
  }
}

/**
 * Apply thematic power boost to calculated power
 */
function applyThematicBoost(
  basePower: {
    army_power: number;
    religion_power: number;
    civilization_power: number;
    economic_power: number;
  },
  theme: CollectionTheme
): {
  army_power: number;
  religion_power: number;
  civilization_power: number;
  economic_power: number;
  total_power: number;
} {
  const boosted = {
    army_power: Math.floor(basePower.army_power * (theme.powerBoost.army || 1)),
    religion_power: Math.floor(basePower.religion_power * (theme.powerBoost.religion || 1)),
    civilization_power: Math.floor(basePower.civilization_power * (theme.powerBoost.civilization || 1)),
    economic_power: Math.floor(basePower.economic_power * (theme.powerBoost.economic || 1))
  };

  const total_power = boosted.army_power + boosted.religion_power + boosted.civilization_power + boosted.economic_power;

  console.log(`🎁 Applied ${theme.name} theme boost:`);
  console.log(`   Army: ${basePower.army_power} → ${boosted.army_power}`);
  console.log(`   Religion: ${basePower.religion_power} → ${boosted.religion_power}`);
  console.log(`   Civilization: ${basePower.civilization_power} → ${boosted.civilization_power}`);
  console.log(`   Economic: ${basePower.economic_power} → ${boosted.economic_power}`);
  console.log(`   Total: ${total_power}`);

  return { ...boosted, total_power };
}

/**
 * Scan a collection and apply thematic bonuses
 */
export async function scanThemedCollection(
  collectionId: string,
  theme: CollectionTheme
): Promise<{
  collection_name: string;
  nfts_scanned: number;
  theme: string;
  total_power_allocated: number;
}> {
  try {
    console.log(`\n🎨 Scanning themed collection: ${theme.name} (${theme.theme})`);
    
    // Get all NFTs from this collection
    const nfts = await db.query.gamingNfts.findMany({
      where: eq(gamingNfts.collection_id, collectionId)
    });

    console.log(`📦 Found ${nfts.length} NFTs in collection`);

    let totalPowerAllocated = 0;
    let nftsScanned = 0;

    for (const nft of nfts) {
      try {
        // Calculate base power from metadata/traits
        const basePower = calculatePowerFromMetadata(nft.metadata || {}, nft.traits || {});

        // Apply thematic boost
        const boostedPower = applyThematicBoost(basePower, theme);

        // Update or create power attributes with theme
        const existing = await db.query.nftPowerAttributes.findFirst({
          where: eq(nftPowerAttributes.nft_id, nft.id)
        });

        const powerData = {
          nft_id: nft.id,
          collection_id: nft.collection_id,
          owner_address: nft.owner_address || '',
          army_power: boostedPower.army_power,
          religion_power: boostedPower.religion_power,
          civilization_power: boostedPower.civilization_power,
          economic_power: boostedPower.economic_power,
          total_power: boostedPower.total_power,
          character_class: basePower.character_class,
          class_confidence: basePower.class_confidence?.toFixed(2) || "0",
          special_powers: basePower.special_powers || [],
          materials_found: basePower.materials_found || [],
          rarities_found: basePower.rarities_found || [],
          keywords_detected: basePower.keywords_detected || { army: [], religion: [], civilization: [], economic: [] },
          trait_mapping: basePower.trait_mapping || {},
          last_updated: new Date()
        };

        if (existing) {
          await db.update(nftPowerAttributes)
            .set(powerData)
            .where(eq(nftPowerAttributes.nft_id, nft.id));
        } else {
          await db.insert(nftPowerAttributes).values(powerData as any);
        }

        totalPowerAllocated += boostedPower.total_power;
        nftsScanned++;

        console.log(`✅ Scanned NFT: ${nft.name || nft.token_id} - Total Power: ${boostedPower.total_power}`);
      } catch (error) {
        console.error(`❌ Error scanning NFT ${nft.id}:`, error);
      }
    }

    console.log(`\n🎉 Collection scan complete!`);
    console.log(`   NFTs scanned: ${nftsScanned}`);
    console.log(`   Total power allocated: ${totalPowerAllocated}`);

    return {
      collection_name: theme.name,
      nfts_scanned: nftsScanned,
      theme: theme.theme,
      total_power_allocated: totalPowerAllocated
    };
  } catch (error) {
    console.error(`Error scanning themed collection ${theme.name}:`, error);
    throw error;
  }
}

/**
 * Scan all themed collections
 */
export async function scanAllThemedCollections(): Promise<{
  collections_scanned: number;
  total_nfts_scanned: number;
  results: Array<{
    collection_name: string;
    nfts_scanned: number;
    theme: string;
    total_power_allocated: number;
  }>;
}> {
  console.log(`\n🚀 Starting themed collection scan...`);
  console.log(`📋 Collections to scan: ${THEMED_COLLECTIONS.length}`);
  
  const results = [];
  let totalNftsScanned = 0;

  for (const theme of THEMED_COLLECTIONS) {
    // Find collection by issuer
    const collection = await db.query.gamingNftCollections.findFirst({
      where: eq(gamingNftCollections.collection_id, theme.issuer)
    });

    if (!collection) {
      console.log(`⚠️ Collection not found: ${theme.name} (${theme.issuer})`);
      console.log(`   Please ensure this collection is registered in gaming_nft_collections`);
      continue;
    }

    const result = await scanThemedCollection(collection.id, theme);
    results.push(result);
    totalNftsScanned += result.nfts_scanned;
  }

  console.log(`\n✨ All themed collections scanned!`);
  console.log(`   Collections: ${results.length}/${THEMED_COLLECTIONS.length}`);
  console.log(`   Total NFTs: ${totalNftsScanned}`);

  return {
    collections_scanned: results.length,
    total_nfts_scanned: totalNftsScanned,
    results
  };
}

/**
 * Register a themed collection in the database
 */
export async function registerThemedCollection(
  issuer: string,
  name: string,
  theme: 'banker' | 'weapon' | 'sacred' | 'gods',
  taxon?: number
): Promise<string> {
  try {
    // Check if already exists
    const existing = await db.query.gamingNftCollections.findFirst({
      where: eq(gamingNftCollections.collection_id, issuer)
    });

    if (existing) {
      console.log(`✅ Collection already registered: ${name}`);
      return existing.id;
    }

    // Create new collection
    const roleMapping = {
      banker: 'merchant',
      weapon: 'army',
      sacred: 'power',
      gods: 'power'
    };

    const [newCollection] = await db.insert(gamingNftCollections).values({
      collection_id: issuer,
      collection_name: name,
      taxon: taxon || null,
      chain: 'xrpl',
      game_role: roleMapping[theme],
      role_description: `${name} - ${theme} themed collection`,
      power_level: 5,
      collection_verified: true,
      metadata_ingested: false,
      active_in_game: true
    } as any).returning();

    console.log(`✅ Registered new themed collection: ${name} (${newCollection.id})`);
    return newCollection.id;
  } catch (error) {
    console.error(`Error registering collection ${name}:`, error);
    throw error;
  }
}

export { THEMED_COLLECTIONS };
