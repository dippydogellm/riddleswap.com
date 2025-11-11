/**
 * TEST SCANNER - DANTES AURUM Collection (43 NFTs)
 * Test rarity calculation, power scores, and schema validation
 */

import 'dotenv/config';
import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function testSmallCollection() {
  console.log('🧪 TEST SCANNER - DANTES AURUM Collection\n');
  console.log('='.repeat(60));

  try {
    // Get DANTES AURUM collection
    const collection = await db.execute(sql`
      SELECT 
        c.id,
        c.collection_name,
        c.collection_id as issuer,
        c.taxon,
        c.game_role,
        COUNT(n.id) as nft_count
      FROM gaming_nft_collections c
      LEFT JOIN gaming_nfts n ON n.collection_id = c.id
      WHERE c.collection_name = 'DANTES AURUM'
      GROUP BY c.id, c.collection_name, c.collection_id, c.taxon, c.game_role;
    `);

    if (collection.rows.length === 0) {
      console.log('❌ DANTES AURUM collection not found');
      return;
    }

    const col = collection.rows[0];
    console.log(`\n✅ Found: ${col.collection_name}`);
    console.log(`   NFTs: ${col.nft_count}`);
    console.log(`   Role: ${col.game_role}`);
    console.log(`   ID: ${col.id}\n`);

    // Get NFTs
    console.log('📋 Fetching NFTs...');
    const nfts = await db.execute(sql.raw(`
      SELECT id, name, traits, token_id, nft_id
      FROM gaming_nfts
      WHERE collection_id = '${col.id}'
      AND traits IS NOT NULL
      LIMIT 5;
    `));

    console.log(`✅ Found ${nfts.rows.length} NFTs with traits\n`);

    // Analyze first NFT
    if (nfts.rows.length > 0) {
      const testNFT = nfts.rows[0];
      console.log('🔍 Sample NFT Analysis:');
      console.log(`   Name: ${testNFT.name || 'Unknown'}`);
      console.log(`   Token: ${testNFT.token_id}`);
      console.log(`   Traits:`, testNFT.traits);
      console.log('');

      // Test rarity calculation
      console.log('⚙️  Testing rarity calculation...\n');
      
      const traits = testNFT.traits as any;
      const traitCount = Object.keys(traits).length;
      console.log(`   Trait count: ${traitCount}`);

      // Build simple frequency map
      const allNFTs = await db.execute(sql.raw(`
        SELECT traits FROM gaming_nfts 
        WHERE collection_id = '${col.id}' 
        AND traits IS NOT NULL;
      `));

      console.log(`   Total NFTs for analysis: ${allNFTs.rows.length}\n`);

      const traitMap = new Map<string, Map<string, number>>();
      
      for (const nft of allNFTs.rows) {
        const nftTraits = nft.traits as any;
        if (!nftTraits) continue;

        for (const [key, value] of Object.entries(nftTraits)) {
          if (!traitMap.has(key)) {
            traitMap.set(key, new Map());
          }
          const valueStr = String(value);
          const valueMap = traitMap.get(key)!;
          valueMap.set(valueStr, (valueMap.get(valueStr) || 0) + 1);
        }
      }

      console.log('   Trait types found:');
      for (const [traitType, valueMap] of traitMap.entries()) {
        console.log(`      - ${traitType}: ${valueMap.size} unique values`);
      }

      // Calculate rarity for test NFT
      console.log('\n📊 Calculating rarity scores...\n');
      
      const rarityBreakdown = [];
      let totalScore = 0;

      for (const [traitType, value] of Object.entries(traits)) {
        const valueStr = String(value);
        const valueMap = traitMap.get(traitType);
        if (!valueMap) continue;

        const count = valueMap.get(valueStr) || 0;
        const percentage = (count / allNFTs.rows.length) * 100;
        const rarityScore = percentage > 0 ? 100 / percentage : 0;

        rarityBreakdown.push({
          trait_type: traitType,
          value: valueStr,
          count: count,
          total: allNFTs.rows.length,
          percentage: parseFloat(percentage.toFixed(2)),
          score: parseFloat(rarityScore.toFixed(2))
        });

        totalScore += rarityScore;
      }

      console.log('   Trait Rarity Breakdown:');
      for (const trait of rarityBreakdown) {
        console.log(`      ${trait.trait_type}: "${trait.value}"`);
        console.log(`         Frequency: ${trait.count}/${trait.total} (${trait.percentage}%)`);
        console.log(`         Rarity Score: ${trait.score}`);
      }

      console.log(`\n   Total Rarity Score: ${totalScore.toFixed(2)}\n`);

      // Test power calculation
      console.log('⚡ Testing power calculation...\n');

      let armyPower = 0;
      let religionPower = 0;
      let bankPower = 0;
      let merchantPower = 0;
      let specialPower = 0;

      for (const trait of rarityBreakdown) {
        const traitLower = trait.trait_type.toLowerCase();
        const valueLower = trait.value.toLowerCase();
        
        // Check for power indicators
        if (traitLower.includes('power') || traitLower.includes('strength')) {
          specialPower += trait.score * 0.5;
        }
        
        if (trait.percentage < 5) {
          specialPower += trait.score * 0.2;
        }
      }

      const scarcityMultiplier = 5000 / allNFTs.rows.length;
      
      armyPower = Math.round((armyPower + scarcityMultiplier) * 10);
      religionPower = Math.round((religionPower + scarcityMultiplier) * 10);
      bankPower = Math.round((bankPower + scarcityMultiplier) * 10);
      merchantPower = Math.round((merchantPower + scarcityMultiplier) * 10);
      specialPower = Math.round((specialPower + scarcityMultiplier) * 10);

      console.log(`   Army Power: ${armyPower}`);
      console.log(`   Religion Power: ${religionPower}`);
      console.log(`   Bank Power: ${bankPower}`);
      console.log(`   Merchant Power: ${merchantPower}`);
      console.log(`   Special Power: ${specialPower}`);
      console.log(`   Total Power: ${armyPower + religionPower + bankPower + merchantPower + specialPower}`);
      console.log(`   Scarcity Multiplier: ${scarcityMultiplier.toFixed(2)}x\n`);

      // Test database update
      console.log('💾 Testing database update...\n');

      const breakdownJSON = JSON.stringify(rarityBreakdown);
      const gameStatsJSON = JSON.stringify({
        army_power: armyPower,
        religion_power: religionPower,
        bank_power: bankPower,
        merchant_power: merchantPower,
        special_power: specialPower,
        total_power: armyPower + religionPower + bankPower + merchantPower + specialPower,
        scarcity_multiplier: parseFloat(scarcityMultiplier.toFixed(2))
      });

      try {
        await db.execute(sql.raw(`
          UPDATE gaming_nfts
          SET 
            trait_rarity_breakdown = '${breakdownJSON.replace(/'/g, "''")}'::jsonb,
            rarity_score = ${totalScore.toFixed(4)},
            game_stats = '${gameStatsJSON.replace(/'/g, "''")}'::jsonb
          WHERE id = '${testNFT.id}';
        `));

        console.log('   ✅ Database update successful!\n');

        // Verify update
        const verification = await db.execute(sql.raw(`
          SELECT 
            name,
            rarity_score,
            trait_rarity_breakdown,
            game_stats
          FROM gaming_nfts
          WHERE id = '${testNFT.id}';
        `));

        if (verification.rows.length > 0) {
          const verified = verification.rows[0];
          console.log('✅ Verification:');
          console.log(`   Name: ${verified.name}`);
          console.log(`   Rarity Score: ${verified.rarity_score}`);
          console.log(`   Has Breakdown: ${verified.trait_rarity_breakdown ? 'Yes' : 'No'}`);
          console.log(`   Has Game Stats: ${verified.game_stats ? 'Yes' : 'No'}`);
          
          if (verified.game_stats) {
            const stats = verified.game_stats as any;
            console.log(`   Total Power: ${stats.total_power || 'N/A'}`);
          }
        }

      } catch (error) {
        console.error('   ❌ Database update failed:', error);
        throw error;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ TEST PASSED - Schema validation successful!');
    console.log('🚀 Ready to process all 5,555 NFTs\n');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    console.log('\n💡 Fix needed before running full scanner\n');
    process.exit(1);
  }
}

testSmallCollection();
