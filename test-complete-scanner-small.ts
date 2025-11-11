/**
 * TEST COMPLETE SCANNER ON SMALL COLLECTION
 * Tests the full scanner logic on DANTES AURUM (43 NFTs)
 */

import 'dotenv/config';
import { db } from './server/db';
import { sql } from 'drizzle-orm';
import OpenAI from 'openai';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

async function testCompleteScannerSmall() {
  console.log('🧪 TEST COMPLETE SCANNER - DANTES AURUM (43 NFTs)\n');
  console.log('='.repeat(70));

  try {
    // Get DANTES AURUM collection only
    const collections = await db.execute(sql`
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
      GROUP BY c.id, c.collection_name, c.collection_id, c.taxon, c.game_role
      HAVING COUNT(n.id) > 0;
    `);

    if (collections.rows.length === 0) {
      console.log('❌ DANTES AURUM collection not found!');
      return;
    }

    const collection = collections.rows[0];
    const collectionId = collection.id;
    const collectionNameStr = String(collection.collection_name);
    const nftCount = Number(collection.nft_count);
    const gameRoleStr = String(collection.game_role);
    const issuerStr = String(collection.issuer);
    const taxonNum = Number(collection.taxon);

    console.log(`\n✅ Found: ${collectionNameStr}`);
    console.log(`   NFTs: ${nftCount}`);
    console.log(`   Role: ${gameRoleStr}\n`);

    console.log('='.repeat(70));
    console.log('STEP 1: Get NFTs with traits\n');

    const nfts = await db.execute(sql.raw(`
      SELECT id, name, traits, token_id, nft_id
      FROM gaming_nfts
      WHERE collection_id = '${collectionId}'
      AND traits IS NOT NULL;
    `));

    console.log(`✅ Found ${nfts.rows.length} NFTs with traits\n`);

    console.log('='.repeat(70));
    console.log('STEP 2: Build trait frequency map\n');

    const traitMap = new Map<string, Map<string, number>>();

    for (const nft of nfts.rows) {
      const traits = nft.traits as any;
      if (!traits || typeof traits !== 'object') continue;

      for (const [traitType, value] of Object.entries(traits)) {
        if (!traitMap.has(traitType)) {
          traitMap.set(traitType, new Map());
        }
        const valueStr = String(value);
        const valueMap = traitMap.get(traitType)!;
        valueMap.set(valueStr, (valueMap.get(valueStr) || 0) + 1);
      }
    }

    console.log(`✅ Found ${traitMap.size} trait types:`);
    for (const [traitType, valueMap] of traitMap.entries()) {
      console.log(`   - ${traitType}: ${valueMap.size} unique values`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('STEP 3: Calculate rarity scores\n');

    const nftRarityScores: Array<{ id: string; name: string; totalScore: number }> = [];

    for (const nft of nfts.rows) {
      const nftId = String(nft.id);
      const nftName = String(nft.name || `NFT #${nft.token_id || nft.nft_id || 'Unknown'}`);
      const traits = nft.traits as any;
      if (!traits || typeof traits !== 'object') continue;

      let totalRarityScore = 0;

      for (const [traitType, value] of Object.entries(traits)) {
        const valueStr = String(value);
        const valueMap = traitMap.get(traitType);
        if (!valueMap) continue;

        const count = valueMap.get(valueStr) || 0;
        const collectionTotal = nfts.rows.length;
        const percentage = (count / collectionTotal) * 100;
        const rarityScore = percentage > 0 ? 100 / percentage : 0;

        totalRarityScore += rarityScore;
      }

      nftRarityScores.push({
        id: nftId,
        name: nftName,
        totalScore: totalRarityScore
      });
    }

    console.log(`✅ Calculated rarity for ${nftRarityScores.length} NFTs\n`);

    console.log('='.repeat(70));
    console.log('STEP 4: Assign rarity ranks\n');

    nftRarityScores.sort((a, b) => b.totalScore - a.totalScore);

    console.log('Top 5 rarest NFTs:');
    for (let i = 0; i < Math.min(5, nftRarityScores.length); i++) {
      console.log(`   ${i + 1}. ${nftRarityScores[i].name} - Score: ${nftRarityScores[i].totalScore.toFixed(2)}`);
    }

    console.log('\n📝 Updating ranks in database...');

    try {
      // Batch update using CASE statement
      const updates = nftRarityScores.map((nft, i) => `WHEN '${nft.id}' THEN ${i + 1}`).join(' ');
      
      await db.execute(sql.raw(`
        UPDATE gaming_nfts
        SET 
          rarity_rank = CASE id ${updates} END,
          collection_rarity_rank = CASE id ${updates} END
        WHERE id IN (${nftRarityScores.map(n => `'${n.id}'`).join(',')});
      `));

      console.log(`✅ Updated ${nftRarityScores.length} NFT ranks\n`);
    } catch (error) {
      console.error('❌ Error updating ranks:', error);
      throw error;
    }

    console.log('='.repeat(70));
    console.log('STEP 5: Create/Update Project Master Card\n');

    const masterCardCheck = await db.execute(sql.raw(`
      SELECT id FROM project_master_cards
      WHERE issuer_address = '${issuerStr}'
      AND taxon = ${taxonNum};
    `));

    let projectId;
    if (masterCardCheck.rows.length === 0) {
      const result = await db.execute(sql.raw(`
        INSERT INTO project_master_cards (
          project_name, issuer_address, taxon, total_supply, category
        ) VALUES (
          '${collectionNameStr.replace(/'/g, "''")}', 
          '${issuerStr}', 
          ${taxonNum},
          ${nftCount}, 
          '${gameRoleStr}'
        )
        RETURNING id;
      `));
      projectId = String(result.rows[0].id);
      console.log(`✅ Created master card\n`);
    } else {
      projectId = String(masterCardCheck.rows[0].id);
      await db.execute(sql.raw(`
        UPDATE project_master_cards
        SET total_supply = ${nftCount}, category = '${gameRoleStr}'
        WHERE id = '${projectId}';
      `));
      console.log(`✅ Updated master card\n`);
    }

    console.log('='.repeat(70));
    console.log('STEP 6: Generate AI Scorecards\n');

    if (!openai) {
      console.log('⚠️  OpenAI API key not found, skipping AI scoring\n');
    } else {
      let scorecardsCreated = 0;

      for (const [traitType, valueMap] of traitMap.entries()) {
        const values = Array.from(valueMap.entries())
          .map(([value, count]) => ({
            value,
            count,
            percentage: (count / nftCount) * 100
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 30);

        console.log(`🤖 Processing: ${traitType} (${values.length} values)`);

        for (let i = 0; i < values.length; i += 5) {
          const batch = values.slice(i, i + 5);

          try {
            const prompt = `Score NFT traits for ${collectionNameStr} (${gameRoleStr}):
${traitType}: ${batch.map(v => `${v.value} (${v.percentage.toFixed(0)}%)`).join(', ')}

Rate each 0-100: gaming_utility, visual_impact, synergy_potential

JSON: {"values":[{"value":"name","gaming_utility":70,"visual_impact":80,"synergy_potential":60,"reasoning":"2-5 words"}]}`;

            const response = await openai.chat.completions.create({
              model: 'gpt-4-turbo-preview',
              messages: [
                { role: 'system', content: 'NFT trait analyzer. Return valid JSON only. Very brief reasoning.' },
                { role: 'user', content: prompt }
              ],
              response_format: { type: 'json_object' },
              temperature: 0.2,
              max_tokens: 1000
            });

            const rawContent = response.choices[0].message.content || '{}';
            let cleanedContent = rawContent.trim();

            if (!cleanedContent.endsWith('}') && !cleanedContent.endsWith(']')) {
              throw new Error('Truncated JSON response');
            }

            const openQuotes = (cleanedContent.match(/"/g) || []).length;
            if (openQuotes % 2 !== 0) {
              throw new Error('Unbalanced quotes in JSON');
            }

            const analysis = JSON.parse(cleanedContent);

            for (const v of batch) {
              const aiData = analysis.values?.find((av: any) =>
                av.value === v.value || av.value?.toLowerCase() === v.value.toLowerCase()
              ) || {};

              const gamingUtility = Math.min(100, Math.max(0, aiData.gaming_utility || 50));
              const visualImpact = Math.min(100, Math.max(0, aiData.visual_impact || 50));
              const rarityValue = Math.min(100, Math.round(100 / v.percentage));
              const synergy = Math.min(100, Math.max(0, aiData.synergy_potential || 50));
              const overall = Math.round((gamingUtility + visualImpact + rarityValue + synergy) / 4);

              const reasoning = String(aiData.reasoning || 'Standard trait').substring(0, 200);
              const traitValue = String(v.value).substring(0, 5000);

              await db.execute(sql`
                INSERT INTO project_score_cards (
                  project_id, trait_category, trait_value,
                  gaming_utility_score, visual_impact_score, rarity_value_score,
                  synergy_score, overall_trait_score, ai_reasoning
                ) VALUES (
                  ${projectId}, ${traitType}, ${traitValue},
                  ${gamingUtility}, ${visualImpact}, ${rarityValue},
                  ${synergy}, ${overall}, ${reasoning}
                )
                ON CONFLICT (project_id, trait_category, MD5(trait_value))
                DO UPDATE SET
                  gaming_utility_score = ${gamingUtility},
                  visual_impact_score = ${visualImpact},
                  rarity_value_score = ${rarityValue},
                  synergy_score = ${synergy},
                  overall_trait_score = ${overall},
                  ai_reasoning = ${reasoning};
              `);

              scorecardsCreated++;
            }

            await new Promise(resolve => setTimeout(resolve, 500));

          } catch (error: any) {
            console.log(`   ⚠️  AI failed: ${error?.message?.substring(0, 50)}`);
            console.log(`   📝 Using default scores...`);

            for (const v of batch) {
              const rarityValue = Math.min(100, Math.round(100 / v.percentage));
              const overall = Math.round((50 + 50 + rarityValue + 50) / 4);
              const traitValue = String(v.value).substring(0, 5000);

              await db.execute(sql`
                INSERT INTO project_score_cards (
                  project_id, trait_category, trait_value,
                  gaming_utility_score, visual_impact_score, rarity_value_score,
                  synergy_score, overall_trait_score, ai_reasoning
                ) VALUES (
                  ${projectId}, ${traitType}, ${traitValue},
                  50, 50, ${rarityValue},
                  50, ${overall}, 'Default scores'
                )
                ON CONFLICT (project_id, trait_category, MD5(trait_value))
                DO UPDATE SET
                  gaming_utility_score = 50,
                  visual_impact_score = 50,
                  rarity_value_score = ${rarityValue},
                  synergy_score = 50,
                  overall_trait_score = ${overall},
                  ai_reasoning = 'Default scores';
              `);

              scorecardsCreated++;
            }
          }
        }

        console.log(`   ✅ ${traitType}: ${scorecardsCreated} scorecards`);
      }

      console.log(`\n✅ Created ${scorecardsCreated} total scorecards\n`);
    }

    console.log('='.repeat(70));
    console.log('✅ TEST COMPLETE!\n');
    console.log(`Processed: ${collectionNameStr}`);
    console.log(`NFTs: ${nftRarityScores.length}`);
    console.log(`Rarest: ${nftRarityScores[0]?.name} (${nftRarityScores[0]?.totalScore.toFixed(2)})`);
    console.log('='.repeat(70));

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    process.exit(1);
  }
}

testCompleteScannerSmall();
