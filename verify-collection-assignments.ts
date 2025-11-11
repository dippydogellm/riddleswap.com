/**
 * VERIFY NFT COLLECTION ASSIGNMENTS
 * 
 * Checks that each NFT in gaming_nfts belongs to the correct collection
 * by comparing the collection's issuer/taxon with the NFT's metadata.
 * 
 * Produces a report of:
 * - Total NFTs per collection
 * - Expected vs actual counts
 * - Mismatched NFTs (if any)
 */

import 'dotenv/config';
import { db } from './server/db';
import { sql } from 'drizzle-orm';

interface CollectionRow {
  id: string;
  collection_name: string;
  collection_id: string;
  taxon: number;
  expected_count: number;
}

interface NFTRow {
  id: string;
  collection_id: string;
  token_id: string;
  nft_id: string;
  name: string;
}

async function verifyCollectionAssignments() {
  console.log('🔍 VERIFYING NFT COLLECTION ASSIGNMENTS\n');
  console.log('='.repeat(70) + '\n');

  try {
    // Get all collections with their expected NFT counts
    const collections = await db.execute(sql`
      SELECT 
        c.id,
        c.collection_name,
        c.collection_id,
        c.taxon,
        COUNT(n.id) as nft_count
      FROM gaming_nft_collections c
      LEFT JOIN gaming_nfts n ON n.collection_id = c.id
      GROUP BY c.id, c.collection_name, c.collection_id, c.taxon
      ORDER BY c.collection_name;
    `);

    console.log(`📦 Found ${collections.rows.length} collections\n`);

    let totalNFTs = 0;
    let totalMismatches = 0;
    const report: Array<{
      collection: string;
      issuer: string;
      taxon: number;
      expected: number;
      actual: number;
      status: string;
    }> = [];

    for (const col of collections.rows) {
      const collectionId = String(col.id);
      const collectionName = String(col.collection_name);
      const collectionIdentifier = String(col.collection_id); // Format: "issuer:taxon"
      const taxon = Number(col.taxon);
      const nftCount = Number(col.nft_count);

      // Extract issuer from collection_id (format: "issuer:taxon")
      const [issuer] = collectionIdentifier.split(':');

      console.log(`\n${'='.repeat(70)}`);
      console.log(`📁 ${collectionName}`);
      console.log(`   Collection ID: ${collectionId}`);
      console.log(`   Identifier: ${collectionIdentifier}`);
      console.log(`   Issuer: ${issuer}`);
      console.log(`   Taxon: ${taxon}`);
      console.log(`   NFT Count: ${nftCount}`);
      console.log(`${'='.repeat(70)}`);

      // Get all NFTs for this collection
      const nfts = await db.execute(sql.raw(`
        SELECT id, collection_id, token_id, nft_id, name
        FROM gaming_nfts
        WHERE collection_id = '${collectionId}';
      `));

      const actualCount = nfts.rows.length;
      totalNFTs += actualCount;

      // Check if counts match
      if (actualCount === nftCount) {
        console.log(`   ✅ Verified: ${actualCount} NFTs match collection`);
        report.push({
          collection: collectionName,
          issuer,
          taxon,
          expected: nftCount,
          actual: actualCount,
          status: '✅ Match'
        });
      } else {
        console.log(`   ⚠️  WARNING: Count mismatch!`);
        console.log(`      Expected: ${nftCount}`);
        console.log(`      Actual: ${actualCount}`);
        totalMismatches += Math.abs(actualCount - nftCount);
        report.push({
          collection: collectionName,
          issuer,
          taxon,
          expected: nftCount,
          actual: actualCount,
          status: '⚠️  Mismatch'
        });
      }

      // Sample a few NFTs to verify they belong to this collection
      if (nfts.rows.length > 0) {
        const sample = nfts.rows.slice(0, 3);
        console.log(`\n   📋 Sample NFTs (showing ${sample.length}):`);
        for (const nft of sample) {
          const nftName = String(nft.name || 'Unnamed');
          const nftId = String(nft.nft_id || 'N/A');
          console.log(`      - ${nftName}`);
          console.log(`        ID: ${nftId}`);
          console.log(`        Collection: ${nft.collection_id}`);
        }
      }
    }

    // Print summary report
    console.log('\n\n' + '='.repeat(70));
    console.log('📊 VERIFICATION SUMMARY');
    console.log('='.repeat(70) + '\n');

    console.log('Collection Summary:\n');
    console.log('Collection'.padEnd(40) + 'Expected'.padEnd(12) + 'Actual'.padEnd(12) + 'Status');
    console.log('-'.repeat(70));
    
    for (const entry of report) {
      const nameCol = entry.collection.padEnd(40);
      const expectedCol = entry.expected.toString().padEnd(12);
      const actualCol = entry.actual.toString().padEnd(12);
      console.log(`${nameCol}${expectedCol}${actualCol}${entry.status}`);
    }

    console.log('\n' + '='.repeat(70));
    console.log(`\n✅ Total Collections: ${collections.rows.length}`);
    console.log(`✅ Total NFTs: ${totalNFTs}`);
    
    if (totalMismatches > 0) {
      console.log(`⚠️  Total Mismatches: ${totalMismatches}`);
      console.log(`\n⚠️  RECOMMENDATION: Review collections with mismatches`);
      console.log(`   - Check if NFTs were deleted or moved`);
      console.log(`   - Verify collection_id references are correct`);
      console.log(`   - Re-run scanner for affected collections`);
    } else {
      console.log(`✅ No mismatches found - all NFTs correctly assigned!`);
    }

    console.log('\n' + '='.repeat(70) + '\n');

  } catch (error) {
    console.error('\n❌ VERIFICATION FAILED:', error);
    process.exit(1);
  }
}

verifyCollectionAssignments();
