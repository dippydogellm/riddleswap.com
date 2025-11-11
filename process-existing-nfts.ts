/**
 * Process Existing NFTs in Database
 * Calculate rarity scores and generate AI scorecards for already-imported NFTs
 */

import 'dotenv/config';
import { db } from './server/db';
import { sql } from 'drizzle-orm';
import OpenAI from 'openai';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

interface TraitValue {
  trait_type: string;
  value: string;
  count: number;
  percentage: number;
  rarity_score: number;
}

async function processExistingNFTs() {
  console.log('🔄 PROCESSING EXISTING NFTs IN DATABASE\n');
  console.log('='.repeat(60));

  try {
    // Get all collections with NFTs
    const collections = await db.execute(sql`
      SELECT 
        c.id,
        c.collection_name,
        c.collection_id as issuer,
        c.taxon,
        COUNT(n.id) as nft_count
      FROM gaming_nft_collections c
      LEFT JOIN gaming_nfts n ON n.collection_id = c.id
      GROUP BY c.id, c.collection_name, c.collection_id, c.taxon
      HAVING COUNT(n.id) > 0
      ORDER BY COUNT(n.id) DESC;
    `);

    console.log(`\n📦 Found ${collections.rows.length} collections with NFTs\n`);

    for (const collection of collections.rows) {
      const collectionId = String(collection.id);
      const collectionName = String(collection.collection_name);
      const nftCount = Number(collection.nft_count);

      console.log(`\n${'='.repeat(60)}`);
      console.log(`📊 Processing: ${collectionName}`);
      console.log(`   NFTs: ${nftCount}`);
      console.log(`${'='.repeat(60)}\n`);

      // STEP 1: Calculate trait frequencies
      console.log('1️⃣ Calculating trait frequencies...');
      
      const nfts = await db.execute(sql`
        SELECT id, name, traits
        FROM gaming_nfts
        WHERE collection_id = ${collectionId}
        AND traits IS NOT NULL;
      `);

      const traitMap = new Map<string, Map<string, number>>();
      
      // Count trait occurrences
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

      console.log(`   Found ${traitMap.size} trait types`);

      // STEP 2: Calculate rarity scores and power values for NFTs
      console.log('2️⃣ Updating NFT rarity breakdowns and power scores...');
      
      let updatedCount = 0;
      for (const nft of nfts.rows) {
        const traits = nft.traits as any;
        if (!traits || typeof traits !== 'object') continue;

        const rarityBreakdown: Array<{
          trait_type: string;
          value: string;
          rarity_percentage: number;
          rarity_score: number;
        }> = [];

        let totalRarityScore = 0;
        
        // Calculate power scores based on collection role and traits
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
          const percentage = (count / nftCount) * 100;
          const rarityScore = percentage > 0 ? 100 / percentage : 0;

          rarityBreakdown.push({
            trait_type: traitType,
            value: valueStr,
            rarity_percentage: parseFloat(percentage.toFixed(2)),
            rarity_score: parseFloat(rarityScore.toFixed(4))
          });

          totalRarityScore += rarityScore;
          
          // Map traits to power categories
          const traitLower = traitType.toLowerCase();
          const valueLower = valueStr.toLowerCase();
          
          // Army power - combat/warrior traits
          if (traitLower.includes('class') || traitLower.includes('weapon') || traitLower.includes('armor')) {
            if (valueLower.includes('warrior') || valueLower.includes('soldier') || valueLower.includes('knight')) {
              armyPower += rarityScore * 0.5;
            }
          }
          
          // Religion power - religious/holy traits
          if (traitLower.includes('religion') || traitLower.includes('faith') || traitLower.includes('holy')) {
            religionPower += rarityScore * 0.5;
          } else if (valueLower.includes('priest') || valueLower.includes('monk') || valueLower.includes('holy')) {
            religionPower += rarityScore * 0.3;
          }
          
          // Bank/Economic power - wealth traits
          if (traitLower.includes('wealth') || traitLower.includes('gold') || traitLower.includes('bank')) {
            bankPower += rarityScore * 0.5;
          } else if (valueLower.includes('banker') || valueLower.includes('rich') || valueLower.includes('gold')) {
            bankPower += rarityScore * 0.3;
          }
          
          // Merchant power - trade traits
          if (traitLower.includes('trade') || traitLower.includes('merchant')) {
            merchantPower += rarityScore * 0.5;
          } else if (valueLower.includes('merchant') || valueLower.includes('trader')) {
            merchantPower += rarityScore * 0.3;
          }
          
          // Special power - unique/rare traits
          if (percentage < 5) {
            specialPower += rarityScore * 0.2;
          }
        }
        
        // Base power from collection total supply (scarcity bonus)
        const scarcityBonus = nftCount > 0 ? 1000 / nftCount : 1;
        armyPower = Math.round((armyPower + scarcityBonus) * 10);
        religionPower = Math.round((religionPower + scarcityBonus) * 10);
        bankPower = Math.round((bankPower + scarcityBonus) * 10);
        merchantPower = Math.round((merchantPower + scarcityBonus) * 10);
        specialPower = Math.round((specialPower + scarcityBonus) * 10);

        // Update NFT with breakdown and power scores
        await db.execute(sql`
          UPDATE gaming_nfts
          SET 
            trait_rarity_breakdown = ${JSON.stringify(rarityBreakdown)}::jsonb,
            rarity_score = ${totalRarityScore.toFixed(4)},
            game_stats = jsonb_build_object(
              'army_power', ${armyPower},
              'religion_power', ${religionPower},
              'bank_power', ${bankPower},
              'merchant_power', ${merchantPower},
              'special_power', ${specialPower},
              'total_power', ${armyPower + religionPower + bankPower + merchantPower + specialPower}
            )
          WHERE id = ${nft.id};
        `);

        updatedCount++;
        if (updatedCount % 100 === 0) {
          console.log(`   Progress: ${updatedCount}/${nftCount} NFTs`);
        }
      }

      console.log(`   ✅ Updated ${updatedCount} NFTs with rarity and power data`);

      // STEP 3: Create project master card
      console.log('3️⃣ Creating project master card...');
      
      const masterCardCheck = await db.execute(sql`
        SELECT id FROM project_master_cards
        WHERE issuer_address = ${collection.issuer}
        AND taxon = ${collection.taxon};
      `);

      let projectId;
      if (masterCardCheck.rows.length === 0) {
        const result = await db.execute(sql`
          INSERT INTO project_master_cards (
            project_name, issuer_address, taxon, total_supply, category
          ) VALUES (
            ${collectionName},
            ${collection.issuer},
            ${collection.taxon},
            ${nftCount},
            'Gaming NFT'
          )
          RETURNING id;
        `);
        projectId = result.rows[0].id;
        console.log(`   ✅ Created master card`);
      } else {
        projectId = masterCardCheck.rows[0].id;
        console.log(`   ℹ️  Master card already exists`);
      }

      // STEP 4: Generate AI scorecards for each trait
      if (openai && traitMap.size > 0) {
        console.log('4️⃣ Generating AI scorecards...');
        
        let scorecardsCreated = 0;
        for (const [traitType, valueMap] of traitMap.entries()) {
          const values = Array.from(valueMap.entries())
            .map(([value, count]) => ({
              value,
              count,
              percentage: (count / nftCount) * 100
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 20); // Top 20 values per trait

          try {
            // Process in smaller batches to avoid token limits
            const batchSize = 10;
            const valueBatches = [];
            for (let i = 0; i < values.length; i += batchSize) {
              valueBatches.push(values.slice(i, i + batchSize));
            }

            for (const batch of valueBatches) {
              const prompt = `Score these NFT traits for "${collectionName}":
Trait: ${traitType}
Values: ${batch.map(v => `"${v.value}" (${v.count} NFTs)`).join(', ')}

For EACH value, provide scores 0-100 and brief reasoning (max 50 chars).
Return as: {"values":[{"value":"exact_value","gaming_utility":70,"visual_impact":80,"synergy_potential":60,"reasoning":"short text"}]}`;

              const response = await openai.chat.completions.create({
                model: 'gpt-4-turbo-preview',
                messages: [
                  {
                    role: 'system',
                    content: 'You are an NFT analyzer. Return ONLY valid JSON. Keep reasoning under 50 characters. Match value names exactly.'
                  },
                  {
                    role: 'user',
                    content: prompt
                  }
                ],
                response_format: { type: 'json_object' },
                temperature: 0.2,
                max_tokens: 800
              });

              let analysis;
              try {
                const content = response.choices[0].message.content || '{}';
                analysis = JSON.parse(content);
              } catch (parseError) {
                console.error(`   ⚠️  JSON parse error, using defaults`);
                analysis = { values: [] };
              }
            
              // Store scorecards for this batch
              for (const v of batch) {
                // Handle very long trait values
                const traitValue = String(v.value).substring(0, 10000); // Max 10k chars
                
                const aiData = analysis.values?.find((av: any) => 
                  av.value === v.value || 
                  av.value?.toLowerCase() === v.value.toLowerCase() ||
                  av.value?.substring(0, 100) === v.value.substring(0, 100)
                ) || {};
                
                const gamingUtility = Math.min(100, Math.max(0, aiData.gaming_utility || 50));
                const visualImpact = Math.min(100, Math.max(0, aiData.visual_impact || 50));
                const rarityValue = Math.min(100, Math.round(100 / v.percentage));
                const synergy = Math.min(100, Math.max(0, aiData.synergy_potential || 50));
                const overall = Math.round((gamingUtility + visualImpact + rarityValue + synergy) / 4);
                
                // Sanitize reasoning
                let reasoning = aiData.reasoning || 'Standard trait';
                if (typeof reasoning === 'string') {
                  reasoning = reasoning.substring(0, 500).replace(/[^\x20-\x7E]/g, '');
                }

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

              // Rate limit between batches
              await new Promise(resolve => setTimeout(resolve, 300));
            }

            console.log(`   ✅ ${traitType}: ${values.length} scorecards`);

          } catch (error) {
            console.error(`   ⚠️  Skipping AI for ${traitType}, using defaults`);
            
            // Create scorecards with default scores
            for (const v of values) {
              const rarityValue = Math.min(100, Math.round(100 / v.percentage));
              const overall = Math.round((50 + 50 + rarityValue + 50) / 4);
              
              await db.execute(sql`
                INSERT INTO project_score_cards (
                  project_id, trait_category, trait_value,
                  gaming_utility_score, visual_impact_score, rarity_value_score,
                  synergy_score, overall_trait_score, ai_reasoning
                ) VALUES (
                  ${projectId}, ${traitType}, ${v.value},
                  50, 50, ${rarityValue}, 50, ${overall}, 'Default scoring (AI unavailable)'
                )
                ON CONFLICT (project_id, trait_category, trait_value) DO NOTHING;
              `);
              
              scorecardsCreated++;
            }
            
            console.log(`   ℹ️  ${traitType}: ${values.length} default scorecards`);
          }
        }

        console.log(`   ✅ Created ${scorecardsCreated} AI scorecards`);
      } else {
        console.log('   ⚠️  Skipping AI scoring (OpenAI not configured)');
      }

      console.log(`\n✅ Completed: ${collectionName}\n`);
    }

    console.log('='.repeat(60));
    console.log('✅ ALL COLLECTIONS PROCESSED\n');

  } catch (error) {
    console.error('❌ Error processing NFTs:', error);
    process.exit(1);
  }
}

processExistingNFTs();
