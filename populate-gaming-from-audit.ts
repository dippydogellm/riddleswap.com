/**
 * POPULATE GAMING TABLES FROM INQUISITION AUDIT
 * 
 * Migrates data from inquisition_nft_audit to gaming_nft_collections and gaming_nfts
 * This ensures the gaming system works with your new database structure
 */

import 'dotenv/config';
import { db } from './server/db';
import { sql } from 'drizzle-orm';

// Collection names mapping (based on known collections)
const COLLECTION_NAMES: Record<string, string> = {
  'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH:0': 'The Inquisition',
  'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH:1': 'The Inquisition - Series 1',
  'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH:2': 'The Inquisition - Crystal',
  'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH:3': 'The Inquisition - Special',
  'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH:4': 'DANTES AURUM',
  'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH:5': 'The Inquisition - Vehicles',
  'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH:9': 'Under the Bridge: Troll',
  'r3PSkSzynXdkVoFWogW9aQkm3o9gwfZdu6:0': 'Patriot',
  'rf2Z67ZtsGADMk6q1SuJ9D4UFBtSu7DSXz:0': 'XRPL Legends',
  'rJV6oSozcXYoyWSCrZBfN2MSvjGLMpt5HK:0': 'Casino Society',
  'rU6GcvpnAg4GstRCGobgSL7XiZqiDUPEki:0': 'PEPE on XRP',
  'rH4SjkWsbNBRaecDnbFyd2nNn2bdkRJeoX:0': 'BunnyX',
  'rHUoEYCkHx17AL4gMaGzaZtkHYs5nm7Nuz:1111': 'Made with Miracles Angels',
  'rwBHJSKEvJrxrqphxh4oDnMGn9RVZVtwGA:111589': 'Made with Miracles 589',
  'rfYarEYZzgMBhscNmzAbQgmbWjgSQm17Wq:1': 'GL!TCH',
  'rINQUISITIONstarterPACKissuer:999999': 'Starter Pack'
};

async function populateGamingTables() {
  console.log('🚀 POPULATING GAMING TABLES FROM INQUISITION AUDIT\n');
  console.log('='.repeat(80) + '\n');

  try {
    // Step 1: Get unique collections from inquisition_nft_audit
    console.log('📦 Step 1: Finding collections...');
    const collections = await db.execute(sql`
      SELECT 
        issuer_address, 
        taxon, 
        COUNT(*) as nft_count,
        MIN(name) as sample_name
      FROM inquisition_nft_audit 
      WHERE is_active = true
      GROUP BY issuer_address, taxon 
      ORDER BY nft_count DESC;
    `);

    console.log(`   Found ${collections.rows.length} collections\n`);

    // Step 2: Clear existing gaming tables
    console.log('🗑️  Step 2: Clearing existing gaming tables...');
    await db.execute(sql`TRUNCATE TABLE gaming_nfts CASCADE;`);
    await db.execute(sql`TRUNCATE TABLE gaming_nft_collections CASCADE;`);
    console.log('   ✅ Tables cleared\n');

    // Step 3: Populate gaming_nft_collections
    console.log('📝 Step 3: Populating gaming_nft_collections...');
    let collectionCount = 0;
    const collectionIdMap = new Map<string, string>(); // Map issuer:taxon to collection ID

    for (const col of collections.rows) {
      const issuer = String(col.issuer_address);
      const taxon = Number(col.taxon);
      const nftCount = Number(col.nft_count);
      const sampleName = String(col.sample_name || 'Unknown Collection');
      
      const collectionKey = `${issuer}:${taxon}`;
      const collectionName = COLLECTION_NAMES[collectionKey] || sampleName.replace(/ #\d+$/, '').trim() || 'Unknown Collection';
      
      // Insert collection
      const result = await db.execute(sql`
        INSERT INTO gaming_nft_collections (
          id,
          collection_id,
          collection_name,
          taxon,
          chain,
          game_role,
          total_supply,
          created_at,
          updated_at
        ) VALUES (
          gen_random_uuid(),
          ${collectionKey},
          ${collectionName},
          ${taxon},
          'xrpl',
          'balanced',
          ${nftCount},
          NOW(),
          NOW()
        )
        RETURNING id;
      `);

      const collectionDbId = result.rows[0]?.id;
      collectionIdMap.set(collectionKey, String(collectionDbId));
      
      console.log(`   ✅ ${collectionName} (${nftCount} NFTs) - ID: ${collectionDbId}`);
      collectionCount++;
    }

    console.log(`\n   📊 Created ${collectionCount} collections\n`);

    // Step 4: Populate gaming_nfts
    console.log('📝 Step 4: Copying NFTs to gaming_nfts...');
    console.log('   This may take a moment...\n');

    let totalNfts = 0;
    for (const col of collections.rows) {
      const issuer = String(col.issuer_address);
      const taxon = Number(col.taxon);
      const collectionKey = `${issuer}:${taxon}`;
      const collectionDbId = collectionIdMap.get(collectionKey);

      if (!collectionDbId) {
        console.log(`   ⚠️  Skipping ${collectionKey} - no collection ID found`);
        continue;
      }

      // Copy NFTs for this collection
      const result = await db.execute(sql`
        INSERT INTO gaming_nfts (
          id,
          collection_id,
          token_id,
          nft_id,
          name,
          description,
          image_url,
          traits,
          rarity_score,
          rarity_rank,
          created_at,
          updated_at
        )
        SELECT
          gen_random_uuid(),
          ${collectionDbId}::uuid,
          nft_token_id,
          nft_token_id,
          name,
          COALESCE(description, ''),
          image_url,
          traits,
          COALESCE(total_points, 0)::numeric,
          NULL,
          NOW(),
          NOW()
        FROM inquisition_nft_audit
        WHERE issuer_address = ${issuer}
          AND taxon = ${taxon}
          AND is_active = true;
      `);

      const nftsCopied = result.rowCount || 0;
      totalNfts += nftsCopied;
      
      const collectionName = COLLECTION_NAMES[collectionKey] || 'Unknown';
      console.log(`   ✅ ${collectionName}: ${nftsCopied} NFTs copied`);
    }

    console.log(`\n   📊 Total NFTs copied: ${totalNfts}\n`);

    // Step 5: Summary
    console.log('='.repeat(80));
    console.log('✅ POPULATION COMPLETE!\n');
    console.log(`📦 Collections: ${collectionCount}`);
    console.log(`🎮 NFTs: ${totalNfts}`);
    console.log('\n🎉 Gaming tables are ready for use!');
    console.log('   - complete-nft-scanner.ts can now process rarity');
    console.log('   - Gaming dashboard will display NFTs');
    console.log('   - Power scoring is ready');
    console.log('='.repeat(80));

  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error);
    process.exit(1);
  }
}

populateGamingTables();
