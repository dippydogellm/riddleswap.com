import 'dotenv/config';
import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function checkDatabaseStructure() {
  console.log('🔍 CHECKING DATABASE STRUCTURE\n');
  console.log('='.repeat(80) + '\n');

  try {
    // Check for gaming_nft_collections
    console.log('📦 Checking gaming_nft_collections...');
    const gamingCollections = await db.execute(sql`
      SELECT COUNT(*) as count FROM gaming_nft_collections;
    `);
    const gamingColCount = Number(gamingCollections.rows[0]?.count || 0);
    console.log(`   Found ${gamingColCount} collections`);

    if (gamingColCount > 0) {
      const sampleCols = await db.execute(sql`
        SELECT collection_name, taxon, collection_id 
        FROM gaming_nft_collections 
        LIMIT 5;
      `);
      console.log('   Samples:');
      sampleCols.rows.forEach(r => {
        console.log(`     - ${r.collection_name} (taxon: ${r.taxon})`);
      });
    }

    // Check for gaming_nfts
    console.log('\n📦 Checking gaming_nfts...');
    const gamingNfts = await db.execute(sql`
      SELECT COUNT(*) as count FROM gaming_nfts;
    `);
    const gamingNftCount = Number(gamingNfts.rows[0]?.count || 0);
    console.log(`   Found ${gamingNftCount} NFTs`);

    // Check for inquisition_collections
    console.log('\n📦 Checking inquisition_collections...');
    const inqCollections = await db.execute(sql`
      SELECT COUNT(*) as count FROM inquisition_collections;
    `);
    const inqColCount = Number(inqCollections.rows[0]?.count || 0);
    console.log(`   Found ${inqColCount} collections`);

    if (inqColCount > 0) {
      const sampleInqCols = await db.execute(sql`
        SELECT collection_name, taxon, issuer 
        FROM inquisition_collections 
        LIMIT 5;
      `);
      console.log('   Samples:');
      sampleInqCols.rows.forEach(r => {
        console.log(`     - ${r.collection_name} (taxon: ${r.taxon}, issuer: ${String(r.issuer).slice(0, 15)}...)`);
      });
    }

    // Check for inquisition_nft_audit
    console.log('\n📦 Checking inquisition_nft_audit...');
    const inqAudit = await db.execute(sql`
      SELECT COUNT(*) as count FROM inquisition_nft_audit;
    `);
    const inqAuditCount = Number(inqAudit.rows[0]?.count || 0);
    console.log(`   Found ${inqAuditCount} NFTs`);

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));
    console.log(`gaming_nft_collections:    ${gamingColCount} records`);
    console.log(`gaming_nfts:               ${gamingNftCount} records`);
    console.log(`inquisition_collections:   ${inqColCount} records`);
    console.log(`inquisition_nft_audit:     ${inqAuditCount} records`);
    console.log('='.repeat(80));

    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    if (inqColCount > 0 && gamingColCount === 0) {
      console.log('   ⚠️  Data is in inquisition_* tables, not gaming_* tables');
      console.log('   → Scanner should read from inquisition_collections & inquisition_nft_audit');
      console.log('   → May need to copy/migrate data to gaming_* tables for gaming features');
    } else if (gamingColCount > 0) {
      console.log('   ✅ Data found in gaming_* tables');
      console.log('   → Scanner should work with gaming_nft_collections & gaming_nfts');
    } else {
      console.log('   ⚠️  No data found in either table set');
      console.log('   → Need to run population script first');
    }

  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message);
  }
}

checkDatabaseStructure();
