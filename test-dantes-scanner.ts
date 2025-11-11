/**
 * TEST SCANNER ON DANTES AURUM (43 NFTs)
 * Small collection test to verify per-collection rarity works with new database
 */

import 'dotenv/config';
import { db } from './server/db';
import { sql } from 'drizzle-orm';
import OpenAI from 'openai';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

async function testDantesAurum() {
  console.log('🎯 TESTING SCANNER ON DANTES AURUM\n');
  console.log('='.repeat(80) + '\n');

  try {
    // Get DANTES AURUM collection
    const collection = await db.execute(sql`
      SELECT id, collection_name, taxon
      FROM gaming_nft_collections
      WHERE collection_name = 'DANTES AURUM'
      LIMIT 1;
    `);

    if (collection.rows.length === 0) {
      console.error('❌ DANTES AURUM collection not found!');
      return;
    }

    const collectionId = String(collection.rows[0].id);
    const collectionName = String(collection.rows[0].collection_name);

    console.log(`📦 Collection: ${collectionName}`);
    console.log(`   ID: ${collectionId}\n`);

    // Get all NFTs from this collection
    const nfts = await db.execute(sql`
      SELECT id, name, traits, rarity_score
      FROM gaming_nfts
      WHERE collection_id = ${collectionId}
      ORDER BY name;
    `);

    console.log(`📊 Found ${nfts.rows.length} NFTs in collection\n`);

    if (nfts.rows.length === 0) {
      console.error('❌ No NFTs found in collection!');
      return;
    }

    // STEP 1: Calculate trait frequencies (PER COLLECTION)
    console.log('🔍 Step 1: Analyzing trait frequencies...\n');
    
    const traitFrequency: Record<string, Record<string, number>> = {};
    const collectionTotal = nfts.rows.length;

    for (const nft of nfts.rows) {
      const traits = nft.traits as Record<string, any> || {};
      
      for (const [traitType, traitValue] of Object.entries(traits)) {
        if (!traitFrequency[traitType]) {
          traitFrequency[traitType] = {};
        }
        const value = String(traitValue);
        traitFrequency[traitType][value] = (traitFrequency[traitType][value] || 0) + 1;
      }
    }

    console.log('Trait Frequency Map:');
    for (const [traitType, values] of Object.entries(traitFrequency)) {
      console.log(`\n  ${traitType}:`);
      for (const [value, count] of Object.entries(values)) {
        const percentage = ((count / collectionTotal) * 100).toFixed(2);
        console.log(`    - ${value}: ${count}/${collectionTotal} (${percentage}%)`);
      }
    }

    // STEP 2: Calculate rarity scores (PER COLLECTION)
    console.log('\n\n🎲 Step 2: Calculating rarity scores...\n');

    const nftRarityData: Array<{
      id: string;
      name: string;
      rarityScore: number;
      traits: Record<string, any>;
    }> = [];

    for (const nft of nfts.rows) {
      const traits = nft.traits as Record<string, any> || {};
      let totalRarityScore = 0;
      let traitCount = 0;

      for (const [traitType, traitValue] of Object.entries(traits)) {
        const value = String(traitValue);
        const count = traitFrequency[traitType]?.[value] || 0;
        
        if (count > 0) {
          const percentage = (count / collectionTotal) * 100;
          const rarityScore = 100 / percentage; // Higher score = rarer
          totalRarityScore += rarityScore;
          traitCount++;
        }
      }

      const avgRarityScore = traitCount > 0 ? totalRarityScore : 0;

      nftRarityData.push({
        id: String(nft.id),
        name: String(nft.name),
        rarityScore: avgRarityScore,
        traits
      });
    }

    // Sort by rarity score (highest first = rarest)
    nftRarityData.sort((a, b) => b.rarityScore - a.rarityScore);

    // STEP 3: Assign rarity ranks
    console.log('📊 Step 3: Assigning rarity ranks...\n');

    for (let i = 0; i < nftRarityData.length; i++) {
      const nft = nftRarityData[i];
      const rank = i + 1; // 1 = rarest

      await db.execute(sql`
        UPDATE gaming_nfts
        SET 
          rarity_score = ${nft.rarityScore},
          rarity_rank = ${rank},
          updated_at = NOW()
        WHERE id = ${nft.id};
      `);

      console.log(`   ${rank}. ${nft.name} - Score: ${nft.rarityScore.toFixed(2)}`);
    }

    // STEP 4: Test AI scoring on top 3 rarest (skip if no API key)
    console.log('\n\n🤖 Step 4: Testing AI scoring on top 3 rarest NFTs...\n');
    if (!openai) {
      console.log('   ℹ️  Skipping AI scoring (no OPENAI_API_KEY set).');
    } else {
      for (let i = 0; i < Math.min(3, nftRarityData.length); i++) {
        const nft = nftRarityData[i];
        
        console.log(`\n   Scoring: ${nft.name}`);
        console.log(`   Traits: ${JSON.stringify(nft.traits, null, 2)}`);

        try {
          const prompt = `Score these NFT traits from DANTES AURUM collection for gaming power (1-100 scale). Return ONLY valid JSON array format: [{"trait_type":"<type>","value":"<value>","power_score":<number>}]. Traits: ${JSON.stringify(nft.traits)}`;

          const completion = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 500,
          });

          const content = completion.choices[0]?.message?.content || '[]';
          console.log(`   Raw AI Response: ${content.substring(0, 200)}...`);

          // Validate JSON
          const scores = JSON.parse(content);
          console.log(`   ✅ AI Scores parsed successfully: ${scores.length} traits scored`);

        } catch (error: any) {
          console.log(`   ⚠️  AI scoring failed: ${error.message}`);
        }
      }
    }

    // Summary
    console.log('\n\n' + '='.repeat(80));
    console.log('✅ DANTES AURUM TEST COMPLETE!\n');
    console.log(`📦 Collection: ${collectionName}`);
    console.log(`🎮 NFTs Processed: ${nftRarityData.length}`);
    console.log(`🏆 Rarest NFT: ${nftRarityData[0]?.name} (Score: ${nftRarityData[0]?.rarityScore.toFixed(2)})`);
    console.log(`📉 Most Common NFT: ${nftRarityData[nftRarityData.length - 1]?.name} (Score: ${nftRarityData[nftRarityData.length - 1]?.rarityScore.toFixed(2)})`);
    console.log('='.repeat(80));

    // Explicit success exit to avoid non-zero code on some runtimes
    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testDantesAurum();
