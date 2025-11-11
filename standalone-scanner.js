/**
 * STANDALONE NFT COLLECTION SCANNER
 * Runs without requiring the server - connects directly to database
 * 
 * STAGE 1: Fetch NFTs from Bithomp
 * STAGE 2: Calculate trait rarity scores
 */

import { db } from './server/db.ts';
import { gamingNftCollections, gamingNfts, inquisitionCollections } from './shared/schema.ts';
import { eq, and, sql } from 'drizzle-orm';
import fetch from 'node-fetch';

const BITHOMP_API_KEY = '95b64250-f24f-4654-9b4b-b155a3a6867b';

const COLLECTIONS = [
  { name: 'The Inquiry', issuer: 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH', taxon: 0, power_role: 'religion' },
  { name: 'The Inquisition', issuer: 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH', taxon: 2, power_role: 'army' },
  { name: 'The Lost Emporium', issuer: 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH', taxon: 3, power_role: 'economic' },
  { name: 'Inquisition Artifacts', issuer: 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH', taxon: 4, power_role: 'balanced' },
  { name: 'Inquisition Relics', issuer: 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH', taxon: 5, power_role: 'balanced' },
  { name: 'Inquisition Trolls', issuer: 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH', taxon: 9, power_role: 'army' },
  { name: 'Casino Society', issuer: 'rJV6oSozcXYoyWSCrZBfN2MSvjGLMpt5HK', taxon: 0, power_role: 'economic' },
  { name: 'BunnyX', issuer: 'rw1R8cfHGMySmbj7gJ1HkiCqTY1xhLGYAs', taxon: 1, power_role: 'balanced' }
];

async function populateCollectionsInDB() {
  console.log('\n📚 STEP 1: Populating collections table...\n');
  
  for (const col of COLLECTIONS) {
    try {
      const existing = await db.query.inquisitionCollections.findFirst({
        where: and(
          eq(inquisitionCollections.issuer_address, col.issuer),
          eq(inquisitionCollections.taxon, col.taxon)
        )
      });

      if (existing) {
        await db.execute(sql`
          UPDATE inquisition_collections 
          SET collection_name = ${col.name}, updated_at = NOW()
          WHERE id = ${existing.id}
        `);
        console.log(`✅ Updated: ${col.name}`);
      } else {
        await db.execute(sql`
          INSERT INTO inquisition_collections (collection_name, issuer_address, taxon, game_role, created_at, updated_at)
          VALUES (${col.name}, ${col.issuer}, ${col.taxon}, ${col.power_role}, NOW(), NOW())
        `);
        console.log(`✅ Inserted: ${col.name}`);
      }
    } catch (error) {
      console.error(`❌ Failed to upsert ${col.name}:`, error.message);
    }
  }
  
  console.log('\n✅ Collections table populated!\n');
}

async function fetchNFTsFromBithomp(issuer, taxon, limit = 400) {
  const url = `https://bithomp.com/api/v2/nfts?issuer=${issuer}&taxon=${taxon}&limit=${limit}&includeDeleted=false`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'x-bithomp-token': BITHOMP_API_KEY,
        'Accept': 'application/json'
      },
      timeout: 30000
    });

    if (!response.ok) {
      console.error(`❌ Bithomp API error: ${response.status}`);
      return { nfts: [], marker: null };
    }

    const data = await response.json();
    return {
      nfts: data.nfts || [],
      marker: data.marker || null
    };
  } catch (error) {
    console.error(`❌ Fetch error:`, error.message);
    return { nfts: [], marker: null };
  }
}

async function fetchAllNFTs(issuer, taxon) {
  let allNfts = [];
  let marker = null;
  let batchNum = 0;
  
  do {
    batchNum++;
    console.log(`   Fetching batch ${batchNum}...`);
    
    const url = marker
      ? `https://bithomp.com/api/v2/nfts?issuer=${issuer}&taxon=${taxon}&limit=400&marker=${marker}&includeDeleted=false`
      : `https://bithomp.com/api/v2/nfts?issuer=${issuer}&taxon=${taxon}&limit=400&includeDeleted=false`;
    
    const response = await fetch(url, {
      headers: {
        'x-bithomp-token': BITHOMP_API_KEY,
        'Accept': 'application/json'
      },
      timeout: 30000
    });

    if (!response.ok) break;

    const data = await response.json();
    const nfts = data.nfts || [];
    
    allNfts = allNfts.concat(nfts);
    marker = data.marker || null;
    
    console.log(`   Got ${nfts.length} NFTs (Total: ${allNfts.length})`);
    
    if (marker) {
      await new Promise(resolve => setTimeout(resolve, 100)); // Rate limit
    }
  } while (marker && batchNum < 10); // Max 10 batches (4000 NFTs)
  
  return allNfts;
}

async function storeNFTsInDB(collectionName, issuer, taxon, nfts) {
  if (nfts.length === 0) {
    console.log(`   ⚠️  No NFTs to store`);
    return 0;
  }

  // Get collection from DB
  const collection = await db.query.inquisitionCollections.findFirst({
    where: and(
      eq(inquisitionCollections.issuer_address, issuer),
      eq(inquisitionCollections.taxon, taxon)
    )
  });

  if (!collection) {
    console.error(`   ❌ Collection not found in DB`);
    return 0;
  }

  let storedCount = 0;

  for (const nft of nfts) {
    try {
      // Safe metadata extraction with null checks
      const metadata = nft.metadata || {};
      const nftName = metadata.name || `${collectionName} #${nft.sequence || 'Unknown'}`;
      const imageUrl = metadata.image || '';
      const description = metadata.description || '';
      const traits = Array.isArray(metadata.attributes) ? metadata.attributes : [];

      // Check if exists
      const existing = await db.query.gamingNfts.findFirst({
        where: eq(gamingNfts.nft_id, nft.nftokenID)
      });

      if (!existing) {
        // Insert new
        await db.execute(sql`
          INSERT INTO gaming_nfts (
            id, collection_id, token_id, nft_id, owner_address, 
            metadata, traits, image_url, name, description, 
            rarity_score, created_at, updated_at
          ) VALUES (
            gen_random_uuid(), 
            ${collection.id}, 
            ${nft.sequence?.toString() || nft.nftokenID.substring(0, 16)}, 
            ${nft.nftokenID}, 
            ${nft.owner || null},
            ${JSON.stringify(metadata)}::jsonb,
            ${JSON.stringify(traits)}::jsonb,
            ${imageUrl},
            ${nftName},
            ${description},
            0,
            NOW(),
            NOW()
          )
        `);
        storedCount++;
      } else {
        // Update existing
        await db.execute(sql`
          UPDATE gaming_nfts 
          SET 
            owner_address = ${nft.owner || existing.owner_address},
            metadata = ${JSON.stringify(metadata)}::jsonb,
            traits = ${JSON.stringify(traits)}::jsonb,
            image_url = ${imageUrl},
            name = ${nftName},
            description = ${description},
            updated_at = NOW()
          WHERE nft_id = ${nft.nftokenID}
        `);
        storedCount++;
      }

      if (storedCount % 50 === 0) {
        console.log(`   💾 Stored ${storedCount}/${nfts.length} NFTs...`);
      }
    } catch (error) {
      console.error(`   ❌ Failed to store NFT ${nft.nftokenID}:`, error.message);
    }
  }

  return storedCount;
}

async function scanAllCollections() {
  console.log('\n🌐 STEP 2: Scanning all collections for NFTs...\n');
  
  let totalNfts = 0;

  for (const col of COLLECTIONS) {
    console.log(`\n📦 Scanning: ${col.name} (${col.issuer.substring(0, 10)}... taxon: ${col.taxon})`);
    
    try {
      const nfts = await fetchAllNFTs(col.issuer, col.taxon);
      console.log(`   ✅ Fetched ${nfts.length} NFTs from Bithomp`);
      
      if (nfts.length > 0) {
        const stored = await storeNFTsInDB(col.name, col.issuer, col.taxon, nfts);
        console.log(`   💾 Stored ${stored} NFTs in database`);
        totalNfts += stored;
      }
    } catch (error) {
      console.error(`   ❌ Failed to scan ${col.name}:`, error.message);
    }
    
    await new Promise(resolve => setTimeout(resolve, 500)); // Pause between collections
  }
  
  console.log(`\n✅ Scan complete! Total NFTs stored: ${totalNfts}\n`);
  return totalNfts;
}

async function calculateTraitRarity(collectionId) {
  console.log(`\n🎯 Calculating trait rarity for collection ${collectionId}...`);
  
  try {
    // Get all NFTs
    const nfts = await db.query.gamingNfts.findMany({
      where: eq(gamingNfts.collection_id, collectionId)
    });

    if (nfts.length === 0) {
      console.log(`   ⚠️  No NFTs found`);
      return;
    }

    // Count trait occurrences
    const traitCounts = {};
    
    for (const nft of nfts) {
      const traits = Array.isArray(nft.traits) ? nft.traits : [];
      
      for (const trait of traits) {
        if (!trait.trait_type || trait.value === null || trait.value === undefined) continue;
        
        const traitType = String(trait.trait_type);
        const traitValue = String(trait.value);
        
        if (!traitCounts[traitType]) {
          traitCounts[traitType] = {};
        }
        
        if (!traitCounts[traitType][traitValue]) {
          traitCounts[traitType][traitValue] = 0;
        }
        
        traitCounts[traitType][traitValue]++;
      }
    }

    // Calculate rarity scores
    const totalNfts = nfts.length;
    const scoredNfts = [];

    for (const nft of nfts) {
      const traits = Array.isArray(nft.traits) ? nft.traits : [];
      let totalScore = 0;

      for (const trait of traits) {
        if (!trait.trait_type || trait.value === null) continue;
        
        const traitType = String(trait.trait_type);
        const traitValue = String(trait.value);
        const count = traitCounts[traitType]?.[traitValue] || 1;
        const percentage = (count / totalNfts) * 100;
        const score = 100 / percentage;
        
        totalScore += score;
      }

      scoredNfts.push({ nft_id: nft.nft_id, score: totalScore });
    }

    // Sort and assign ranks
    scoredNfts.sort((a, b) => b.score - a.score);

    // Update database
    for (let i = 0; i < scoredNfts.length; i++) {
      await db.execute(sql`
        UPDATE gaming_nfts 
        SET rarity_score = ${scoredNfts[i].score.toFixed(2)}, rarity_rank = ${i + 1}
        WHERE nft_id = ${scoredNfts[i].nft_id}
      `);
    }

    console.log(`   ✅ Scored ${scoredNfts.length} NFTs`);
  } catch (error) {
    console.error(`   ❌ Failed:`, error.message);
  }
}

async function scoreAllCollections() {
  console.log('\n🎯 STEP 3: Calculating trait rarity scores...\n');
  
  const collections = await db.query.inquisitionCollections.findMany();
  
  for (const collection of collections) {
    await calculateTraitRarity(collection.id);
  }
  
  console.log('\n✅ All collections scored!\n');
}

async function main() {
  console.log('🚀 STANDALONE NFT COLLECTION SCANNER\n');
  console.log('═'.repeat(60));
  
  try {
    await populateCollectionsInDB();
    await scanAllCollections();
    await scoreAllCollections();
    
    console.log('\n✅ COMPLETE! All stages finished successfully!');
    console.log('📊 Stage 1: NFT fetching ✅');
    console.log('🎯 Stage 2: Trait rarity scoring ✅');
    console.log('\n🎮 Ready for squadron creation and gaming!\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error);
    process.exit(1);
  }
}

main();
