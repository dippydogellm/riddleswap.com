/**
 * Check current database state - what data exists already
 */

import 'dotenv/config';
import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function checkDatabaseState() {
  console.log('🔍 CHECKING DATABASE STATE\n');
  console.log('='.repeat(60));

  try {
    // Check gaming_nft_collections
    console.log('\n📦 GAMING_NFT_COLLECTIONS:');
    const collections = await db.execute(sql`
      SELECT 
        collection_name, 
        collection_id, 
        taxon, 
        total_supply,
        total_nfts_scanned,
        metadata_ingested,
        ai_score
      FROM gaming_nft_collections 
      ORDER BY collection_name;
    `);
    
    if (collections.rows.length === 0) {
      console.log('  ❌ No collections found');
    } else {
      console.log(`  ✅ Found ${collections.rows.length} collections:`);
      collections.rows.forEach((c: any) => {
        console.log(`     - ${c.collection_name} (taxon: ${c.taxon})`);
        console.log(`       Supply: ${c.total_supply || 0}, Scanned: ${c.total_nfts_scanned || 0}`);
        console.log(`       Ingested: ${c.metadata_ingested}, AI Score: ${c.ai_score || 'none'}`);
      });
    }

    // Check gaming_nfts
    console.log('\n🎨 GAMING_NFTS:');
    const nftCount = await db.execute(sql`
      SELECT COUNT(*) as count FROM gaming_nfts;
    `);
    const nftTotal = Number(nftCount.rows[0].count);
    console.log(`  Total NFTs: ${nftTotal}`);

    if (nftTotal > 0) {
      // Sample NFTs
      const sampleNfts = await db.execute(sql`
        SELECT 
          name, 
          collection_id,
          traits,
          image_url,
          rarity_score,
          trait_rarity_breakdown
        FROM gaming_nfts 
        LIMIT 3;
      `);
      
      console.log(`  Sample NFTs:`);
      sampleNfts.rows.forEach((nft: any, i: number) => {
        console.log(`     ${i + 1}. ${nft.name || 'Unnamed'}`);
        console.log(`        Collection: ${nft.collection_id}`);
        console.log(`        Has traits: ${nft.traits ? 'Yes' : 'No'}`);
        console.log(`        Has image: ${nft.image_url ? 'Yes' : 'No'}`);
        console.log(`        Rarity score: ${nft.rarity_score || 'none'}`);
        console.log(`        Breakdown: ${nft.trait_rarity_breakdown ? 'Yes' : 'No'}`);
      });

      // NFTs per collection
      const perCollection = await db.execute(sql`
        SELECT 
          c.collection_name,
          COUNT(n.id) as nft_count,
          COUNT(CASE WHEN n.traits IS NOT NULL THEN 1 END) as with_traits,
          COUNT(CASE WHEN n.image_url IS NOT NULL THEN 1 END) as with_images
        FROM gaming_nft_collections c
        LEFT JOIN gaming_nfts n ON n.collection_id = c.id
        GROUP BY c.collection_name
        ORDER BY nft_count DESC;
      `);

      console.log(`\n  NFTs per collection:`);
      perCollection.rows.forEach((row: any) => {
        console.log(`     ${row.collection_name}: ${row.nft_count} NFTs`);
        console.log(`       - With traits: ${row.with_traits}`);
        console.log(`       - With images: ${row.with_images}`);
      });
    }

    // Check project_master_cards
    console.log('\n📋 PROJECT_MASTER_CARDS:');
    const masterCards = await db.execute(sql`
      SELECT COUNT(*) as count FROM project_master_cards;
    `);
    const masterCardCount = Number((masterCards.rows[0] as any).count);
    console.log(`  Total projects: ${masterCardCount}`);

    if (masterCardCount > 0) {
      const projects = await db.execute(sql`
        SELECT project_name, issuer_address, taxon, total_supply
        FROM project_master_cards;
      `);
      projects.rows.forEach((p: any) => {
        console.log(`     - ${p.project_name} (taxon: ${p.taxon}, supply: ${p.total_supply})`);
      });
    }

    // Check project_score_cards
    console.log('\n🎯 PROJECT_SCORE_CARDS:');
    const scoreCards = await db.execute(sql`
      SELECT COUNT(*) as count FROM project_score_cards;
    `);
    const scoreCardCount = Number((scoreCards.rows[0] as any).count);
    console.log(`  Total trait scorecards: ${scoreCardCount}`);

    if (scoreCardCount > 0) {
      // Sample scorecards
      const samples = await db.execute(sql`
        SELECT 
          pmc.project_name,
          psc.trait_category,
          psc.trait_value,
          psc.gaming_utility_score,
          psc.visual_impact_score,
          psc.rarity_value_score,
          psc.overall_trait_score
        FROM project_score_cards psc
        JOIN project_master_cards pmc ON pmc.id = psc.project_id
        LIMIT 5;
      `);
      
      console.log(`  Sample scorecards:`);
      samples.rows.forEach((s: any) => {
        console.log(`     ${s.project_name} - ${s.trait_category}: ${s.trait_value}`);
        console.log(`       Scores: G=${s.gaming_utility_score} V=${s.visual_impact_score} R=${s.rarity_value_score} Overall=${s.overall_trait_score}`);
      });
    }

    // Check inquisition_collections (old table)
    console.log('\n📜 INQUISITION_COLLECTIONS (legacy):');
    const inqCollections = await db.execute(sql`
      SELECT COUNT(*) as count FROM inquisition_collections;
    `);
    console.log(`  Total records: ${inqCollections.rows[0].count}`);

    console.log('\n' + '='.repeat(60));
    console.log('✅ DATABASE STATE CHECK COMPLETE\n');

    // Recommendations
    console.log('💡 RECOMMENDATIONS:\n');
    
    if (collections.rows.length === 0) {
      console.log('❗ No collections found - scanner will create them');
    }
    
    if (nftTotal === 0) {
      console.log('❗ No NFTs found - need to run full scanner');
    } else {
      const needsRescan = collections.rows.some((c: any) => 
        !c.metadata_ingested || c.total_nfts_scanned === 0
      );
      if (needsRescan) {
        console.log('❗ Some collections need scanning/rescanning');
      } else {
        console.log('✅ Collections appear to be scanned');
      }
    }

    if (scoreCards.rows[0].count === 0) {
      console.log('❗ No AI scorecards generated yet');
    }

  } catch (error) {
    console.error('❌ Error checking database:', error);
    process.exit(1);
  }
}

checkDatabaseState();
