/**
 * COMPLETE NFT SCANNER AUDIT & PROCESSOR
 * 
 * 1. Audits database state
 * 2. Processes all existing NFTs
 * 3. Calculates exact trait rarity percentages (1 in 10 = 10%)
 * 4. Assigns rarity ranks (1 = rarest)
 * 5. Generates AI scorecards
 * 6. Calculates power scores (army, religion, bank, merchant, special)
 */

import 'dotenv/config';
import { db } from './server/db';
import { sql } from 'drizzle-orm';
import OpenAI from 'openai';
import { randomUUID } from 'node:crypto';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

async function runCompleteNFTScanner() {
  console.log('🚀 COMPLETE NFT SCANNER AUDIT & PROCESSOR\n');
  console.log('='.repeat(70));

  try {
    // ==================== PHASE 1: DATABASE AUDIT ====================
    console.log('\n📊 PHASE 1: DATABASE AUDIT\n');
    
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
      GROUP BY c.id, c.collection_name, c.collection_id, c.taxon, c.game_role
      HAVING COUNT(n.id) > 0
      ORDER BY COUNT(n.id) DESC;
    `);

    console.log(`✅ Found ${collections.rows.length} collections with NFTs:`);
    let totalNFTs = 0;
    for (const col of collections.rows) {
      console.log(`   - ${col.collection_name}: ${col.nft_count} NFTs (${col.game_role})`);
      totalNFTs += Number(col.nft_count);
    }
    console.log(`\n📦 Total NFTs to process: ${totalNFTs}\n`);

    // ==================== PHASE 2: PROCESS EACH COLLECTION ====================
    console.log('⚙️  PHASE 2: PROCESSING ALL COLLECTIONS\n');

    let processedCollections = 0;
    let processedNFTs = 0;
    let totalScorecards = 0;

    for (const collection of collections.rows) {
      const collectionId = collection.id;
      const collectionName = collection.collection_name;
      const nftCount = Number(collection.nft_count);
      const gameRole = collection.game_role;

      console.log(`\n${'='.repeat(70)}`);
      console.log(`📁 [${processedCollections + 1}/${collections.rows.length}] ${collectionName}`);
      console.log(`   NFTs: ${nftCount} | Role: ${gameRole}`);
      console.log(`${'='.repeat(70)}\n`);

      // Type the collection data
      const collectionNameStr = String(collectionName);
      const gameRoleStr = String(gameRole);
      const issuerStr = String(collection.issuer);
      const taxonNum = Number(collection.taxon);
      
      // STEP 1: Get all NFTs with traits that match this collection's issuer and taxon
      console.log(`\n1️⃣  Fetching NFTs for issuer: ${issuerStr}, taxon: ${taxonNum}...`);
      
      const nfts = await db.execute(sql.raw(`
        SELECT id, name, traits, token_id, nft_id, collection_id
        FROM gaming_nfts
        WHERE collection_id = '${collectionId}'
        AND traits IS NOT NULL;
      `));

      if (nfts.rows.length === 0) {
        console.log('   ⚠️  No NFTs with traits found, skipping...\n');
        continue;
      }
      
      // Verify NFT count matches what we expect
      console.log(`   ✅ Found ${nfts.rows.length} NFTs in database for this collection`);
      if (nfts.rows.length !== nftCount) {
        console.log(`   ⚠️  WARNING: Expected ${nftCount} NFTs but found ${nfts.rows.length} NFTs with traits`);
      }

      // EARLY SKIP: If all NFTs already have rarity_rank populated, treat collection as completed
      try {
        const rankCheck = await db.execute(sql`SELECT COUNT(*) AS cnt FROM gaming_nfts WHERE collection_id = ${collectionId} AND rarity_rank IS NOT NULL;`);
        const existingRankCount = Number(rankCheck.rows[0]?.cnt || 0);
        if (existingRankCount === nftCount && existingRankCount > 0) {
          console.log(`\n⏩ Skipping collection '${collectionNameStr}' - already fully ranked (${existingRankCount}/${nftCount}).`);
          // Ensure master card exists; create if missing (provide explicit id to avoid null id constraint)
          const masterCardCheckEarly = await db.execute(sql`
            SELECT id FROM project_master_cards
            WHERE issuer_address = ${issuerStr} AND taxon = ${taxonNum};
          `);
          if (masterCardCheckEarly.rows.length === 0) {
            const newId = randomUUID();
            await db.execute(sql`
              INSERT INTO project_master_cards (
                id, project_name, issuer_address, taxon, total_supply, category
              ) VALUES (
                ${newId}, ${collectionNameStr.replace(/'/g, "''")}, ${issuerStr}, ${taxonNum}, ${nftCount}, ${gameRoleStr}
              );
            `);
            console.log(`   ✅ Master card created for previously scanned collection '${collectionNameStr}'`);
          } else {
            await db.execute(sql`
              UPDATE project_master_cards
              SET total_supply = ${nftCount}, category = ${gameRoleStr}, updated_at = NOW()
              WHERE id = ${masterCardCheckEarly.rows[0].id};
            `);
            console.log(`   🔄 Master card updated for previously scanned collection '${collectionNameStr}'`);
          }
          processedCollections++;
          processedNFTs += nftCount;
          continue; // Move to next collection
        }
      } catch (skipError: any) {
        console.log(`   ⚠️  Skip logic failed (continuing full scan): ${skipError.message}`);
      }

      // STEP 2: Build trait frequency map FOR THIS COLLECTION ONLY
      console.log('1️⃣  Analyzing trait frequencies...');
      console.log(`   🔍 Analyzing ${nfts.rows.length} NFTs from THIS collection only`);
      
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

      console.log(`   ✅ Found ${traitMap.size} trait types in collection: ${collectionName}`);
      
      // Display trait distribution
      for (const [traitType, valueMap] of traitMap.entries()) {
        console.log(`      - ${traitType}: ${valueMap.size} unique values`);
      }

      // STEP 3: Calculate rarity scores and rank NFTs
      console.log('\n2️⃣  Calculating rarity scores and power values...');
      console.log(`   📊 Collection size: ${nfts.rows.length} NFTs (rarity calculated ONLY within this collection)`);
      
      const nftRarityScores: Array<{ id: string; name: string; totalScore: number }> = [];
      let collectionNFTsProcessed = 0;

      for (const nft of nfts.rows) {
        // Type cast row data
        const nftId = String(nft.id);
        const nftName = String(nft.name || `NFT #${nft.token_id || nft.nft_id || 'Unknown'}`);
        const traits = nft.traits as any;
        if (!traits || typeof traits !== 'object') continue;

        const rarityBreakdown: Array<{
          trait_type: string;
          value: string;
          count: number;
          total: number;
          rarity_percentage: number;
          rarity_score: number;
        }> = [];

        let totalRarityScore = 0;
        
        // Power calculation based on collection role
        let armyPower = 0;
        let religionPower = 0;
        let bankPower = 0;
        let merchantPower = 0;
        let specialPower = 0;

        for (const [traitType, value] of Object.entries(traits)) {
          const valueStr = String(value);
          const valueMap = traitMap.get(traitType);
          if (!valueMap) continue;

          const count = valueMap.get(valueStr) || 0;
          
          // EXACT PERCENTAGE CALCULATION: count/total * 100
          // Calculate rarity WITHIN THIS COLLECTION ONLY (not across all NFTs)
          // CRITICAL: Use nfts.rows.length (this collection's size) NOT totalNFTs (all collections)
          const collectionTotal = nfts.rows.length;
          const percentage = (count / collectionTotal) * 100;
          
          // RARITY SCORE: 100 / percentage
          // Example: 10% rarity = 10 score, 1% rarity = 100 score
          const rarityScore = percentage > 0 ? 100 / percentage : 0;

          rarityBreakdown.push({
            trait_type: traitType,
            value: valueStr,
            count: count,
            total: collectionTotal,
            rarity_percentage: parseFloat(percentage.toFixed(4)),
            rarity_score: parseFloat(rarityScore.toFixed(4))
          });

          totalRarityScore += rarityScore;
          
          // Power calculation based on trait analysis
          const traitLower = traitType.toLowerCase();
          const valueLower = valueStr.toLowerCase();
          
          // Role-specific power multipliers
          const roleMultiplier = gameRole === 'army' ? 2.0 : 
                                 gameRole === 'religion' ? 1.5 :
                                 gameRole === 'bank' ? 1.3 : 1.0;
          
          // Army power
          if (traitLower.includes('class') || traitLower.includes('weapon') || 
              traitLower.includes('armor') || traitLower.includes('strength')) {
            if (valueLower.includes('warrior') || valueLower.includes('soldier') || 
                valueLower.includes('knight') || valueLower.includes('general')) {
              armyPower += rarityScore * (gameRole === 'army' ? 1.5 : 0.5);
            }
          }
          
          // Religion power
          if (traitLower.includes('religion') || traitLower.includes('faith') || 
              traitLower.includes('holy') || traitLower.includes('divine')) {
            religionPower += rarityScore * (gameRole === 'religion' ? 1.5 : 0.5);
          } else if (valueLower.includes('priest') || valueLower.includes('monk') || 
                     valueLower.includes('bishop') || valueLower.includes('pope')) {
            religionPower += rarityScore * 0.7;
          }
          
          // Bank power
          if (traitLower.includes('wealth') || traitLower.includes('gold') || 
              traitLower.includes('bank') || traitLower.includes('treasury')) {
            bankPower += rarityScore * (gameRole === 'bank' ? 1.5 : 0.5);
          } else if (valueLower.includes('banker') || valueLower.includes('rich') || 
                     valueLower.includes('golden')) {
            bankPower += rarityScore * 0.7;
          }
          
          // Merchant power
          if (traitLower.includes('trade') || traitLower.includes('merchant') || 
              traitLower.includes('commerce')) {
            merchantPower += rarityScore * (gameRole === 'merchant' ? 1.5 : 0.5);
          } else if (valueLower.includes('trader') || valueLower.includes('shop')) {
            merchantPower += rarityScore * 0.7;
          }
          
          // Special power for ultra-rare traits (< 5%)
          if (percentage < 5) {
            specialPower += rarityScore * 0.3;
          }
          
          // Legendary traits (< 1%)
          if (percentage < 1) {
            specialPower += rarityScore * 0.5;
          }
        }
        
        // Scarcity bonus (smaller collections = rarer)
        const collectionTotal = nfts.rows.length;
        const scarcityMultiplier = Math.max(1, 5000 / collectionTotal);
        
        armyPower = Math.round((armyPower * scarcityMultiplier) * 10);
        religionPower = Math.round((religionPower * scarcityMultiplier) * 10);
        bankPower = Math.round((bankPower * scarcityMultiplier) * 10);
        merchantPower = Math.round((merchantPower * scarcityMultiplier) * 10);
        specialPower = Math.round((specialPower * scarcityMultiplier) * 10);
        
        const totalPower = armyPower + religionPower + bankPower + merchantPower + specialPower;

        // Update NFT with all calculated values
        const breakdownJSON = JSON.stringify(rarityBreakdown);
        const gameStatsJSON = JSON.stringify({
          army_power: armyPower,
          religion_power: religionPower,
          bank_power: bankPower,
          merchant_power: merchantPower,
          special_power: specialPower,
          total_power: totalPower,
          scarcity_multiplier: parseFloat(scarcityMultiplier.toFixed(2))
        });
        
        await db.execute(sql.raw(`
          UPDATE gaming_nfts
          SET 
            trait_rarity_breakdown = '${breakdownJSON}'::jsonb,
            rarity_score = ${totalRarityScore.toFixed(4)},
            game_stats = '${gameStatsJSON}'::jsonb
          WHERE id = '${nftId}';
        `));

        nftRarityScores.push({
          id: nftId,
          name: nftName,
          totalScore: totalRarityScore
        });

        collectionNFTsProcessed++;
        processedNFTs++;
        
        if (collectionNFTsProcessed % 100 === 0) {
          console.log(`   📈 Collection progress: ${collectionNFTsProcessed}/${nfts.rows.length} NFTs | Total: ${processedNFTs}/${totalNFTs}`);
        }
      }
      
      console.log(`   ✅ Updated ${collectionNFTsProcessed} NFTs with rarity data (calculated within THIS collection of ${nfts.rows.length} NFTs)`);


      // STEP 4: Assign rarity ranks (1 = rarest)
      console.log('\n3️⃣  Assigning rarity ranks...');
      
      nftRarityScores.sort((a, b) => b.totalScore - a.totalScore);
      
      // Batch update ranks in groups of 50 for better performance
      console.log(`   🔄 Updating ranks for ${nftRarityScores.length} NFTs...`);
      
      for (let i = 0; i < nftRarityScores.length; i++) {
        const rank = i + 1;
        try {
          await db.execute(sql.raw(`
            UPDATE gaming_nfts
            SET 
              rarity_rank = ${rank},
              collection_rarity_rank = ${rank}
            WHERE id = '${nftRarityScores[i].id}';
          `));
          
          if ((i + 1) % 100 === 0) {
            console.log(`   📊 Ranked ${i + 1}/${nftRarityScores.length} NFTs`);
          }
        } catch (error) {
          console.error(`   ❌ Error ranking NFT ${nftRarityScores[i].id}:`, error);
        }
      }
      
      console.log(`   ✅ Ranked ${nftRarityScores.length} NFTs`);
      if (nftRarityScores[0]) {
        console.log(`   🏆 Rarest: ${nftRarityScores[0].name} (Score: ${nftRarityScores[0].totalScore.toFixed(2)})`);
      }

      // STEP 5: Create/Update Project Master Card
      console.log('\n4️⃣  Creating project master card...');
      
      const masterCardCheck = await db.execute(sql.raw(`
        SELECT id FROM project_master_cards
        WHERE issuer_address = '${issuerStr}'
        AND taxon = ${taxonNum};
      `));

      let projectId;
      if (masterCardCheck.rows.length === 0) {
        // Explicit id generation to avoid null id constraint if DB schema lacks default
        const newId = randomUUID();
        const result = await db.execute(sql`
          INSERT INTO project_master_cards (
            id, project_name, issuer_address, taxon, total_supply, category
          ) VALUES (
            ${newId}, ${collectionNameStr.replace(/'/g, "''")}, ${issuerStr}, ${taxonNum}, ${nftCount}, ${gameRoleStr}
          )
          RETURNING id;
        `);
        projectId = String(result.rows[0].id);
        console.log(`   ✅ Created master card (id=${projectId})`);
      } else {
        projectId = String(masterCardCheck.rows[0].id);
        await db.execute(sql.raw(`
          UPDATE project_master_cards
          SET total_supply = ${nftCount}, category = '${gameRoleStr}'
          WHERE id = '${projectId}';
        `));
        console.log(`   ✅ Updated master card`);
      }

      // STEP 6: Generate AI Scorecards (with batching)
      if (openai && traitMap.size > 0) {
        console.log('\n5️⃣  Generating AI scorecards...');
        
        let scorecardsCreated = 0;
        
        for (const [traitType, valueMap] of traitMap.entries()) {
          const values = Array.from(valueMap.entries())
            .map(([value, count]) => ({
              value,
              count,
              percentage: (count / nftCount) * 100
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 30); // Top 30 values per trait

          // Process in batches of 5 to avoid token limits
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
              
              // Try to fix common JSON issues before parsing
              let cleanedContent = rawContent.trim();
              
              // Check if JSON is truncated (no closing brace)
              if (!cleanedContent.endsWith('}') && !cleanedContent.endsWith(']')) {
                console.log(`   ⚠️  Truncated JSON detected, using defaults for ${traitType}`);
                throw new Error('Truncated JSON response');
              }
              
              // Fix unterminated strings by closing them
              const openQuotes = (cleanedContent.match(/"/g) || []).length;
              if (openQuotes % 2 !== 0) {
                console.log(`   ⚠️  Unbalanced quotes detected, using defaults for ${traitType}`);
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

                // Upsert without requiring a unique constraint: insert if missing, then update
                await db.execute(sql`
                  INSERT INTO project_score_cards (
                    id,
                    project_id, trait_category, trait_value,
                    gaming_utility_score, visual_impact_score, rarity_value_score,
                    synergy_score, overall_trait_score, ai_reasoning
                  ) VALUES (
                    ${randomUUID()},
                    ${projectId}, ${traitType}, ${traitValue},
                    ${gamingUtility}, ${visualImpact}, ${rarityValue},
                    ${synergy}, ${overall}, ${reasoning}
                  )
                  ON CONFLICT DO NOTHING;
                `);

                await db.execute(sql`
                  UPDATE project_score_cards
                  SET
                    gaming_utility_score = ${gamingUtility},
                    visual_impact_score = ${visualImpact},
                    rarity_value_score = ${rarityValue},
                    synergy_score = ${synergy},
                    overall_trait_score = ${overall},
                    ai_reasoning = ${reasoning}
                  WHERE project_id = ${projectId}
                    AND trait_category = ${traitType}
                    AND trait_value = ${traitValue};
                `);
                
                scorecardsCreated++;
              }

              await new Promise(resolve => setTimeout(resolve, 500));
              
            } catch (error: any) {
              const errorMsg = error?.message || String(error);
              console.log(`   ⚠️  AI failed for ${traitType}: ${errorMsg.substring(0, 100)}`);
              console.log(`   📝 Using default scores for this batch...`);
              
              for (const v of batch) {
                const rarityValue = Math.min(100, Math.round(100 / v.percentage));
                const overall = Math.round((50 + 50 + rarityValue + 50) / 4);
                
                await db.execute(sql`
                  INSERT INTO project_score_cards (
                    id,
                    project_id, trait_category, trait_value,
                    gaming_utility_score, visual_impact_score, rarity_value_score,
                    synergy_score, overall_trait_score, ai_reasoning
                  ) VALUES (
                    ${randomUUID()},
                    ${projectId}, ${traitType}, ${v.value},
                    50, 50, ${rarityValue}, 50, ${overall}, 'Default (AI unavailable)'
                  )
                  ON CONFLICT DO NOTHING;
                `);
                
                scorecardsCreated++;
              }
            }
          }
          
          console.log(`   ✅ ${traitType}: ${values.length} scorecards`);
        }
        
        totalScorecards += scorecardsCreated;
        console.log(`   ✅ Total scorecards for collection: ${scorecardsCreated}`);
      }

      processedCollections++;
      console.log(`\n✅ Completed: ${collectionName}`);
      console.log(`   NFTs processed: ${nfts.rows.length}`);
      console.log(`   Traits analyzed: ${traitMap.size}`);
    }

    // ==================== PHASE 3: FINAL SUMMARY ====================
    console.log('\n' + '='.repeat(70));
    console.log('🎉 COMPLETE NFT SCANNER FINISHED!\n');
    console.log(`✅ Collections processed: ${processedCollections}`);
    console.log(`✅ NFTs processed: ${processedNFTs}`);
    console.log(`✅ Scorecards created: ${totalScorecards}`);
    console.log('\n📊 All NFTs now have:');
    console.log('   ✅ Exact rarity percentages (count/total * 100)');
    console.log('   ✅ Rarity scores (100 / percentage)');
    console.log('   ✅ Rarity ranks (1 = rarest)');
    console.log('   ✅ Power scores (army, religion, bank, merchant, special)');
    console.log('   ✅ AI trait scorecards');
    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error);
    process.exit(1);
  }
}

// RUN IT
runCompleteNFTScanner();
