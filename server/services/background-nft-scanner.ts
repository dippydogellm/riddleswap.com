/**
 * BACKGROUND NFT SCANNER SERVICE
 * Runs independently from main server
 * Handles different trait structures per collection
 * Integrates AI scoring for collection evaluation
 */

import 'dotenv/config';
import { db } from '../db';
import { gamingNftCollections, gamingNfts, inquisitionCollections } from '../../shared/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import OpenAI from 'openai';

const BITHOMP_API_KEY = process.env.BITHOMP_API_KEY || '95b64250-f24f-4654-9b4b-b155a3a6867b';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

interface NFTMetadata {
  name?: string;
  description?: string;
  image?: string;
  attributes?: Array<{
    trait_type?: string;
    value?: any;
    display_type?: string;
  }>;
  properties?: any;
  [key: string]: any;
}

interface CollectionConfig {
  id?: string;
  name: string;
  issuer: string;
  taxon: number;
  power_role: string;
  trait_parser: 'standard' | 'properties' | 'nested' | 'custom';
  ai_scoring_enabled: boolean;
}

const COLLECTION_CONFIGS: CollectionConfig[] = [
  { 
    name: 'The Inquiry', 
    issuer: 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH', 
    taxon: 0, 
    power_role: 'religion',
    trait_parser: 'standard',
    ai_scoring_enabled: true
  },
  { 
    name: 'The Inquisition', 
    issuer: 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH', 
    taxon: 2, 
    power_role: 'army',
    trait_parser: 'standard',
    ai_scoring_enabled: true
  },
  { 
    name: 'The Lost Emporium', 
    issuer: 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH', 
    taxon: 3, 
    power_role: 'economic',
    trait_parser: 'standard',
    ai_scoring_enabled: true
  },
  { 
    name: 'Inquisition Artifacts', 
    issuer: 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH', 
    taxon: 4, 
    power_role: 'balanced',
    trait_parser: 'standard',
    ai_scoring_enabled: true
  },
  { 
    name: 'Inquisition Relics', 
    issuer: 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH', 
    taxon: 5, 
    power_role: 'balanced',
    trait_parser: 'standard',
    ai_scoring_enabled: true
  },
  { 
    name: 'Inquisition Trolls', 
    issuer: 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH', 
    taxon: 9, 
    power_role: 'army',
    trait_parser: 'standard',
    ai_scoring_enabled: true
  },
  { 
    name: 'Casino Society', 
    issuer: 'rJV6oSozcXYoyWSCrZBfN2MSvjGLMpt5HK', 
    taxon: 0, 
    power_role: 'economic',
    trait_parser: 'standard',
    ai_scoring_enabled: true
  },
  { 
    name: 'BunnyX', 
    issuer: 'rw1R8cfHGMySmbj7gJ1HkiCqTY1xhLGYAs', 
    taxon: 1, 
    power_role: 'balanced',
    trait_parser: 'properties',
    ai_scoring_enabled: true
  }
];

export class BackgroundNFTScanner {
  private isRunning = false;
  private scanInterval: NodeJS.Timeout | null = null;

  /**
   * STAGE 0: Ensure all collections exist in database
   */
  async syncCollections(): Promise<void> {
    console.log('\n📚 STAGE 0: Syncing collections to database...\n');
    
    for (const config of COLLECTION_CONFIGS) {
      try {
        const existing = await db.query.inquisitionCollections.findFirst({
          where: and(
            eq(inquisitionCollections.issuer_address, config.issuer),
            eq(inquisitionCollections.taxon, config.taxon)
          )
        });

        if (existing) {
          await db.execute(sql`
            UPDATE inquisition_collections 
            SET collection_name = ${config.name}, 
                game_role = ${config.power_role},
                updated_at = NOW()
            WHERE id = ${existing.id}
          `);
          config.id = existing.id as any as string;
          console.log(`✅ Updated: ${config.name}`);
        } else {
          const result = await db.execute(sql`
            INSERT INTO inquisition_collections (
              collection_name, issuer_address, taxon, game_role, created_at, updated_at
            )
            VALUES (${config.name}, ${config.issuer}, ${config.taxon}, ${config.power_role}, NOW(), NOW())
            RETURNING id
          `);
          config.id = (result.rows[0] as any).id;
          console.log(`✅ Inserted: ${config.name}`);
        }
      } catch (error: any) {
        console.error(`❌ Failed to sync ${config.name}:`, error.message);
      }
    }
  }

  /**
   * STAGE 1: Fetch NFTs from Bithomp API
   */
  async fetchCollectionNFTs(config: CollectionConfig): Promise<any[]> {
    console.log(`\n📦 Fetching NFTs: ${config.name} (taxon: ${config.taxon})...`);
    
    if (!BITHOMP_API_KEY) {
      console.error(`   ❌ BITHOMP_API_KEY not set!`);
      return [];
    }
    
    let allNfts: any[] = [];
    let marker: string | null = null;
    let batchNum = 0;
    const maxBatches = 10; // Max 4000 NFTs per collection

    try {
      do {
        batchNum++;
        const url = marker
          ? `https://bithomp.com/api/v2/nfts?issuer=${config.issuer}&taxon=${config.taxon}&limit=400&marker=${marker}&includeDeleted=false`
          : `https://bithomp.com/api/v2/nfts?issuer=${config.issuer}&taxon=${config.taxon}&limit=400&includeDeleted=false`;

        const response = await fetch(url, {
          headers: {
            'x-bithomp-token': BITHOMP_API_KEY,
            'Accept': 'application/json',
            'User-Agent': 'RiddleSwap-Scanner/1.0'
          }
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unable to read error');
          console.error(`   ⚠️  Bithomp API error: ${response.status} ${response.statusText}`);
          console.error(`   ⚠️  Response: ${errorText.substring(0, 200)}`);
          console.error(`   ⚠️  Using API key: ${BITHOMP_API_KEY?.substring(0, 10)}...`);
          break;
        }

        const data = await response.json();
        const nfts = data.nfts || [];
        
        allNfts = allNfts.concat(nfts);
        marker = data.marker || null;
        
        console.log(`   Batch ${batchNum}: +${nfts.length} NFTs (Total: ${allNfts.length})`);
        
        if (marker) {
          await new Promise(resolve => setTimeout(resolve, 200)); // Rate limit
        }
      } while (marker && batchNum < maxBatches);

      console.log(`   ✅ Fetched ${allNfts.length} NFTs total`);
      return allNfts;
    } catch (error: any) {
      console.error(`   ❌ Fetch failed:`, error.message);
      return [];
    }
  }

  /**
   * Parse traits based on collection-specific structure
   */
  parseTraits(metadata: NFTMetadata, parser: string): any[] {
    if (!metadata) return [];

    switch (parser) {
      case 'standard':
        // Standard attributes array
        return Array.isArray(metadata.attributes) ? metadata.attributes : [];

      case 'properties':
        // Properties-based (BunnyX style)
        if (metadata.properties && typeof metadata.properties === 'object') {
          return Object.entries(metadata.properties).map(([key, value]) => ({
            trait_type: key,
            value: value
          }));
        }
        return [];

      case 'nested':
        // Nested structure
        if (metadata.attributes && Array.isArray(metadata.attributes)) {
          return metadata.attributes;
        }
        if (metadata.traits && Array.isArray(metadata.traits)) {
          return metadata.traits;
        }
        return [];

      case 'custom':
        // Custom parsing logic
        const traits: any[] = [];
        
        // Try all possible structures
        if (Array.isArray(metadata.attributes)) {
          traits.push(...metadata.attributes);
        }
        if (metadata.properties && typeof metadata.properties === 'object') {
          Object.entries(metadata.properties).forEach(([key, value]) => {
            traits.push({ trait_type: key, value });
          });
        }
        if (Array.isArray(metadata.traits)) {
          traits.push(...metadata.traits);
        }
        
        return traits;

      default:
        return Array.isArray(metadata.attributes) ? metadata.attributes : [];
    }
  }

  /**
   * STAGE 2A: Fetch detailed NFT data individually
   */
  async fetchNFTDetails(nftId: string): Promise<any> {
    try {
      const url = `https://bithomp.com/api/v2/nft/${nftId}?metadata=true&assets=true`;
      
      const response = await fetch(url, {
        headers: {
          'x-bithomp-token': BITHOMP_API_KEY,
          'Accept': 'application/json',
          'User-Agent': 'RiddleSwap-Scanner/1.0'
        }
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get CDN image URL (prefer Bithomp CDN over IPFS)
   */
  getCDNImageUrl(nft: any, issuer: string, taxon: number): string {
    // Priority 1: Bithomp CDN image endpoint
    if (nft.nftokenID) {
      return `https://bithomp.com/api/v2/nft/${nft.nftokenID}/image`;
    }
    
    // Priority 2: Assets image (already CDN)
    if (nft.assets?.image && !nft.assets.image.includes('ipfs://')) {
      return nft.assets.image;
    }
    
    // Priority 3: Metadata image if it's not IPFS
    if (nft.metadata?.image && !nft.metadata.image.includes('ipfs://')) {
      return nft.metadata.image;
    }
    
    // Priority 4: Collection default image
    return `https://bithomp.com/api/v2/nft/${issuer}:${taxon}/image`;
  }

  /**
   * STAGE 2B: Store NFTs in database with parsed traits
   */
  async storeCollectionNFTs(config: CollectionConfig, nfts: any[]): Promise<number> {
    if (nfts.length === 0 || !config.id) {
      console.log(`   ⚠️  No NFTs to store or invalid collection ID`);
      return 0;
    }

    console.log(`\n💾 Processing ${nfts.length} NFTs for ${config.name}...`);
    console.log(`   📥 Fetching detailed metadata for each NFT...`);
    
    let storedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < nfts.length; i++) {
      const nft = nfts[i];
      
      try {
        // Fetch detailed NFT data
        const detailedNFT = await this.fetchNFTDetails(nft.nftokenID);
        
        if (!detailedNFT) {
          skippedCount++;
          continue;
        }

        // Parse metadata from detailed response
        const metadata: NFTMetadata = detailedNFT.metadata || {};
        const traits = this.parseTraits(metadata, config.trait_parser);
        
        // Safe field extraction with fallbacks
        const nftName = metadata.name || detailedNFT.name || `${config.name} #${detailedNFT.sequence || nft.sequence || 'Unknown'}`;
        
        // Get CDN image URL (no IPFS)
        const imageUrl = this.getCDNImageUrl(detailedNFT, config.issuer, config.taxon);
        
        const description = metadata.description || detailedNFT.description || '';
        const tokenId = (detailedNFT.sequence || nft.sequence)?.toString() || nft.nftokenID?.substring(0, 16) || 'unknown';
        const owner = detailedNFT.owner || nft.owner || null;

        // Check if exists
        const existing = await db.query.gamingNfts.findFirst({
          where: eq(gamingNfts.nft_id, nft.nftokenID)
        });

        if (!existing) {
          // Insert new NFT
          await db.execute(sql`
            INSERT INTO gaming_nfts (
              id, collection_id, token_id, nft_id, owner_address,
              metadata, traits, image_url, name, description,
              rarity_score, created_at, updated_at
            ) VALUES (
              gen_random_uuid(),
              ${config.id},
              ${tokenId},
              ${nft.nftokenID},
              ${owner},
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
          // Update existing NFT with fresh data
          await db.execute(sql`
            UPDATE gaming_nfts
            SET
              owner_address = ${owner || existing.owner_address},
              metadata = ${JSON.stringify(metadata)}::jsonb,
              traits = ${JSON.stringify(traits)}::jsonb,
              image_url = ${imageUrl || existing.image_url},
              name = ${nftName || existing.name},
              description = ${description || existing.description},
              updated_at = NOW()
            WHERE nft_id = ${nft.nftokenID}
          `);
          storedCount++;
        }

        if ((i + 1) % 50 === 0) {
          console.log(`   Progress: ${i + 1}/${nfts.length} (Stored: ${storedCount}, Errors: ${errorCount}, Skipped: ${skippedCount})`);
        }

        // Rate limiting - small delay between individual NFT fetches
        if ((i + 1) % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error: any) {
        errorCount++;
        if (errorCount <= 10) {
          console.error(`   ⚠️  Error processing NFT ${nft.nftokenID}:`, error.message);
        }
      }
    }

    console.log(`   ✅ Complete: ${storedCount} stored, ${errorCount} errors, ${skippedCount} skipped`);
    return storedCount;
  }

  /**
   * STAGE 3: Calculate trait rarity scores per collection
   */
  async calculateRarityScores(config: CollectionConfig): Promise<void> {
    if (!config.id) return;

    console.log(`\n🎯 Calculating rarity for ${config.name}...`);

    try {
      // Get all NFTs for this collection
      const nfts = await db.query.gamingNfts.findMany({
        where: eq(gamingNfts.collection_id, config.id)
      });

      if (nfts.length === 0) {
        console.log(`   ⚠️  No NFTs found`);
        return;
      }

      // Build trait frequency map
      const traitCounts: Record<string, Record<string, number>> = {};
      
      for (const nft of nfts) {
        const traits = Array.isArray(nft.traits) ? nft.traits : [];
        
        for (const trait of traits) {
          if (!trait.trait_type || trait.value === null || trait.value === undefined) continue;
          
          const traitType = String(trait.trait_type);
          const traitValue = String(trait.value);
          
          if (!traitCounts[traitType]) {
            traitCounts[traitType] = {};
          }
          
          traitCounts[traitType][traitValue] = (traitCounts[traitType][traitValue] || 0) + 1;
        }
      }

      // Calculate rarity scores for each NFT
      const scoredNfts: Array<{ nft_id: string; score: number; breakdown: any[] }> = [];
      const totalNfts = nfts.length;

      for (const nft of nfts) {
        const traits = Array.isArray(nft.traits) ? nft.traits : [];
        let totalScore = 0;
        const breakdown: any[] = [];

        for (const trait of traits) {
          if (!trait.trait_type || trait.value === null) continue;
          
          const traitType = String(trait.trait_type);
          const traitValue = String(trait.value);
          const count = traitCounts[traitType]?.[traitValue] || 1;
          const percentage = (count / totalNfts) * 100;
          const score = 100 / percentage; // Rarer = higher score
          
          totalScore += score;
          breakdown.push({
            trait_type: traitType,
            value: traitValue,
            count,
            percentage: percentage.toFixed(2),
            score: score.toFixed(2)
          });
        }

        scoredNfts.push({ 
          nft_id: nft.nft_id, 
          score: totalScore,
          breakdown
        });
      }

      // Sort by score (descending) and assign ranks
      scoredNfts.sort((a, b) => b.score - a.score);

      // Update database with scores and ranks
      for (let i = 0; i < scoredNfts.length; i++) {
        const scored = scoredNfts[i];
        await db.execute(sql`
          UPDATE gaming_nfts
          SET 
            rarity_score = ${scored.score.toFixed(2)},
            rarity_rank = ${i + 1}
          WHERE nft_id = ${scored.nft_id}
        `);
      }

      console.log(`   ✅ Scored ${scoredNfts.length} NFTs (Rank 1 = ${scoredNfts[0].score.toFixed(2)} points)`);
    } catch (error: any) {
      console.error(`   ❌ Rarity calculation failed:`, error.message);
    }
  }

  /**
   * STAGE 4A: AI-powered trait scoring
   * Score each trait_type and value individually
   */
  async aiScoreTraits(config: CollectionConfig): Promise<any> {
    if (!config.id || !config.ai_scoring_enabled || !openai) {
      return null;
    }

    console.log(`\n🤖 AI Trait Scoring: ${config.name}...`);

    try {
      // Get all unique traits
      const traitsQuery = await db.execute(sql`
        SELECT DISTINCT 
          jsonb_array_elements(traits) as trait
        FROM gaming_nfts
        WHERE collection_id = ${config.id}
        AND traits IS NOT NULL
        AND jsonb_array_length(traits) > 0
        LIMIT 500
      `);

      // Build trait frequency map
      const traitMap: Record<string, Record<string, number>> = {};
      
      for (const row of traitsQuery.rows) {
        const trait = row.trait as any;
        if (trait.trait_type && trait.value !== null && trait.value !== undefined) {
          const traitType = String(trait.trait_type);
          const traitValue = String(trait.value);
          
          if (!traitMap[traitType]) {
            traitMap[traitType] = {};
          }
          traitMap[traitType][traitValue] = (traitMap[traitType][traitValue] || 0) + 1;
        }
      }

      // Build trait summary for AI
      const traitSummary = Object.entries(traitMap).map(([traitType, values]) => {
        const valueList = Object.entries(values)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 15)
          .map(([val, count]) => `${val} (${count})`)
          .join(', ');
        return `${traitType}: ${valueList}`;
      }).join('\n');

      // AI Prompt for trait scoring
      const prompt = `You are scoring NFT traits for the "${config.name}" collection (Gaming Role: ${config.power_role}).

TRAIT TYPES AND VALUES:
${traitSummary}

INSTRUCTIONS:
Score each trait_type and its values based on:
1. Gaming Utility (0-100): How useful for "${config.power_role}" role in battles/gameplay
2. Visual Impact (0-100): How distinctive and appealing
3. Rarity Value (0-100): How desirable based on scarcity
4. Synergy Potential (0-100): How well it combines with other traits

REQUIRED JSON OUTPUT FORMAT (must be valid JSON array):
[
  {
    "trait_type": "Background",
    "base_score": 75,
    "description": "Sets visual foundation",
    "values": [
      {
        "value": "Blue Sky",
        "gaming_utility": 60,
        "visual_impact": 80,
        "rarity_value": 70,
        "synergy_potential": 85,
        "overall_score": 74,
        "reasoning": "Common but versatile background"
      }
    ]
  }
]

Return ONLY the JSON array. No markdown, no explanations. Pure JSON.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          { 
            role: "system", 
            content: "You are an NFT gaming analyst. Return ONLY valid JSON array. No markdown formatting, no code blocks, no explanations." 
          },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 3000
      });

      let traitScores = completion.choices[0].message.content || '{}';
      
      // Clean up response if wrapped in markdown
      traitScores = traitScores.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      const parsed = JSON.parse(traitScores);
      const traitsArray = parsed.traits || parsed.trait_types || parsed;

      console.log(`   ✅ Scored ${Array.isArray(traitsArray) ? traitsArray.length : 0} trait types`);
      
      return traitsArray;
    } catch (error: any) {
      console.error(`   ❌ AI trait scoring failed:`, error.message);
      return null;
    }
  }

  /**
   * STAGE 4B: AI-powered collection scoring
   */
  async aiScoreCollection(config: CollectionConfig, traitScores: any): Promise<void> {
    if (!config.id || !config.ai_scoring_enabled || !openai) {
      return;
    }

    console.log(`\n🤖 AI Collection Scoring: ${config.name}...`);

    try {
      // Get collection stats
      const stats = await db.execute(sql`
        SELECT 
          COUNT(*) as total_nfts,
          AVG(rarity_score) as avg_rarity,
          MAX(rarity_score) as max_rarity,
          MIN(rarity_score) as min_rarity,
          COUNT(DISTINCT owner_address) as unique_owners
        FROM gaming_nfts
        WHERE collection_id = ${config.id}
      `);

      const collectionStats = stats.rows[0] as any;

      // Build AI prompt
      const prompt = `Score this NFT collection for gaming utility:

Collection: ${config.name}
Role: ${config.power_role}
Total NFTs: ${collectionStats.total_nfts}
Unique Owners: ${collectionStats.unique_owners}
Average Rarity: ${Number(collectionStats.avg_rarity).toFixed(2)}

Trait Scoring Summary:
${JSON.stringify(traitScores, null, 2).substring(0, 1500)}

REQUIRED JSON OUTPUT:
{
  "overall_score": 85,
  "trait_diversity_score": 90,
  "rarity_distribution_score": 80,
  "utility_score": 85,
  "market_potential_score": 88,
  "battle_effectiveness": 82,
  "holder_engagement": 75,
  "reasoning": "Detailed 2-3 sentence analysis",
  "strengths": ["strength1", "strength2", "strength3"],
  "weaknesses": ["weakness1", "weakness2"]
}

Return ONLY valid JSON. No markdown.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          { 
            role: "system", 
            content: "You are an expert NFT gaming analyst. Return ONLY valid JSON object. No markdown, no code blocks." 
          },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.4,
        max_tokens: 800
      });

      const aiAnalysis = JSON.parse(completion.choices[0].message.content || '{}');

      // Store AI scoring in collection metadata
      await db.execute(sql`
        UPDATE inquisition_collections
        SET 
          ai_score = ${aiAnalysis.overall_score},
          ai_analysis = ${JSON.stringify(aiAnalysis)}::jsonb,
          updated_at = NOW()
        WHERE id = ${config.id}
      `);

      console.log(`   ✅ Overall Score: ${aiAnalysis.overall_score}/100`);
      console.log(`   📊 Trait Diversity: ${aiAnalysis.trait_diversity_score}/100`);
      console.log(`   🎯 Utility: ${aiAnalysis.utility_score}/100`);
      console.log(`   ⚔️  Battle Effectiveness: ${aiAnalysis.battle_effectiveness}/100`);
    } catch (error: any) {
      console.error(`   ❌ AI collection scoring failed:`, error.message);
    }
  }

  /**
   * STAGE 5: Auto-generate dynamic project scorecard from rarity data + AI analysis
   */
  async createProjectScorecard(config: CollectionConfig, traitScores: any): Promise<void> {
    if (!config.id) {
      return;
    }

    console.log(`\n📋 Creating Dynamic Project Scorecard: ${config.name}...`);

    try {
      // Get all NFTs with their traits and rarity scores
      const nftsWithTraits = await db.execute(sql`
        SELECT nft_id, traits, rarity_score, rarity_rank
        FROM gaming_nfts
        WHERE collection_id = ${config.id}
        AND traits IS NOT NULL
        AND jsonb_array_length(traits) > 0
        ORDER BY rarity_rank ASC
      `);

      if (nftsWithTraits.rows.length === 0) {
        console.log(`   ⚠️  No NFTs with traits found`);
        return;
      }

      // Build comprehensive trait frequency and rarity map
      const traitMap: Record<string, Record<string, {
        count: number;
        total_rarity_score: number;
        nft_ids: string[];
      }>> = {};

      const totalNfts = nftsWithTraits.rows.length;

      for (const row of nftsWithTraits.rows) {
        const nft = row as any;
        const traits = Array.isArray(nft.traits) ? nft.traits : [];

        for (const trait of traits) {
          if (!trait.trait_type || trait.value === null || trait.value === undefined) continue;

          const traitType = String(trait.trait_type);
          const traitValue = String(trait.value);

          if (!traitMap[traitType]) {
            traitMap[traitType] = {};
          }

          if (!traitMap[traitType][traitValue]) {
            traitMap[traitType][traitValue] = {
              count: 0,
              total_rarity_score: 0,
              nft_ids: []
            };
          }

          traitMap[traitType][traitValue].count++;
          traitMap[traitType][traitValue].total_rarity_score += parseFloat(nft.rarity_score) || 0;
          traitMap[traitType][traitValue].nft_ids.push(nft.nft_id);
        }
      }

      // Check if scorecard already exists
      const existingScorecard = await db.execute(sql`
        SELECT id FROM project_master_cards
        WHERE issuer_address = ${config.issuer} AND taxon = ${config.taxon}
      `);

      let scorecardId: string;

      if (existingScorecard.rows.length > 0) {
        scorecardId = (existingScorecard.rows[0] as any).id;
        console.log(`   ℹ️  Updating existing scorecard...`);
        
        // Update master card stats
        await db.execute(sql`
          UPDATE project_master_cards
          SET
            project_name = ${config.name},
            total_supply = ${totalNfts},
            category = ${config.power_role},
            updated_at = NOW()
          WHERE id = ${scorecardId}
        `);
      } else {
        // Create new master card
        const newScorecard = await db.execute(sql`
          INSERT INTO project_master_cards (
            id, project_name, issuer_address, taxon,
            total_supply, category, created_at, updated_at
          ) VALUES (
            gen_random_uuid(),
            ${config.name},
            ${config.issuer},
            ${config.taxon},
            ${totalNfts},
            ${config.power_role},
            NOW(),
            NOW()
          )
          RETURNING id
        `);
        scorecardId = (newScorecard.rows[0] as any).id;
        console.log(`   ✅ Created new master card`);
      }

      // Delete old trait scorecards
      await db.execute(sql`
        DELETE FROM project_score_cards
        WHERE project_id = ${scorecardId}
      `);

      console.log(`   🤖 Generating AI scores for ${Object.keys(traitMap).length} trait types...`);

      // Use AI to score each trait based on rarity and collection context
      let insertedCount = 0;

      for (const [traitType, values] of Object.entries(traitMap)) {
        const valueEntries = Object.entries(values);
        
        // Prepare trait data for AI
        const traitSummary = valueEntries
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, 20) // Top 20 values
          .map(([val, data]) => ({
            value: val,
            count: data.count,
            percentage: ((data.count / totalNfts) * 100).toFixed(2),
            avg_rarity: (data.total_rarity_score / data.count).toFixed(2)
          }));

        // Get AI scores for this trait type if enabled
        let aiScores: any = {};
        if (config.ai_scoring_enabled && openai && traitScores) {
          // Find AI scores from traitScores
          const aiTraitType = Array.isArray(traitScores) 
            ? traitScores.find((t: any) => t.trait_type === traitType)
            : null;
          
          if (aiTraitType?.values) {
            aiScores = aiTraitType.values.reduce((acc: any, v: any) => {
              acc[v.value] = v;
              return acc;
            }, {});
          }
        }

        // Insert scorecard for each value
        for (const [traitValue, data] of valueEntries) {
          const percentage = (data.count / totalNfts) * 100;
          const avgRarity = data.total_rarity_score / data.count;
          
          // Calculate rarity value score (0-100, inverse of percentage)
          const rarityValueScore = Math.min(100, Math.round(100 / percentage));
          
          // Get AI scores or use defaults
          const aiScore = aiScores[traitValue] || {};
          const gamingUtility = aiScore.gaming_utility || Math.round(50 + (rarityValueScore * 0.3));
          const visualImpact = aiScore.visual_impact || Math.round(50 + (rarityValueScore * 0.2));
          const synergyScore = aiScore.synergy_potential || Math.round(50 + (rarityValueScore * 0.25));
          
          // Overall score: weighted average
          const overallScore = Math.round(
            (rarityValueScore * 0.35) +
            (gamingUtility * 0.25) +
            (visualImpact * 0.20) +
            (synergyScore * 0.20)
          );

          const reasoning = aiScore.reasoning || 
            `Appears in ${percentage.toFixed(1)}% of NFTs (${data.count}/${totalNfts}). ` +
            `Average rarity contribution: ${avgRarity.toFixed(2)}. ` +
            `${percentage < 5 ? 'Very rare trait.' : percentage < 20 ? 'Uncommon trait.' : 'Common trait.'}`;

          try {
            await db.execute(sql`
              INSERT INTO project_score_cards (
                id, project_id, trait_category, trait_value,
                gaming_utility_score, visual_impact_score,
                rarity_value_score, synergy_score,
                overall_trait_score, ai_reasoning,
                created_at, updated_at
              ) VALUES (
                gen_random_uuid(),
                ${scorecardId},
                ${traitType},
                ${traitValue},
                ${gamingUtility},
                ${visualImpact},
                ${rarityValueScore},
                ${synergyScore},
                ${overallScore},
                ${reasoning},
                NOW(),
                NOW()
              )
            `);
            insertedCount++;
          } catch (error: any) {
            // Skip duplicates silently
          }
        }
      }

      console.log(`   ✅ Created ${insertedCount} dynamic trait scorecards`);
    } catch (error: any) {
      console.error(`   ❌ Scorecard creation failed:`, error.message);
    }
  }

  /**
   * Scan single collection through all stages
   */
  async scanCollection(config: CollectionConfig): Promise<void> {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎮 SCANNING: ${config.name}`);
    console.log(`${'='.repeat(60)}`);

    try {
      // Ensure collection exists in DB
      if (!config.id) {
        const existing = await db.query.inquisitionCollections.findFirst({
          where: and(
            eq(inquisitionCollections.issuer_address, config.issuer),
            eq(inquisitionCollections.taxon, config.taxon)
          )
        });
        if (existing) {
          config.id = existing.id as any as string;
        }
      }

      // Stage 1: Fetch NFT IDs from collection
      const nfts = await this.fetchCollectionNFTs(config);
      
      if (nfts.length === 0) {
        console.log(`   ⚠️  No NFTs fetched, skipping...`);
        return;
      }

      console.log(`   📋 Collected ${nfts.length} NFT IDs`);

      // Stage 2: Fetch detailed metadata and store each NFT
      await this.storeCollectionNFTs(config, nfts);

      // Stage 3: Calculate rarity
      await this.calculateRarityScores(config);

      // Stage 4: AI scoring
      let traitScores = null;
      if (config.ai_scoring_enabled) {
        // Stage 4A: Score individual traits
        traitScores = await this.aiScoreTraits(config);
        
        // Stage 4B: Score overall collection
        await this.aiScoreCollection(config, traitScores);
        
        // Stage 5: Create project scorecard
        if (traitScores) {
          await this.createProjectScorecard(config, traitScores);
        }
      }

      console.log(`\n✅ ${config.name} complete!\n`);
    } catch (error: any) {
      console.error(`\n❌ ${config.name} failed:`, error.message, '\n');
    }
  }

  /**
   * Scan all collections
   */
  async scanAllCollections(): Promise<void> {
    console.log('\n🚀 BACKGROUND NFT SCANNER STARTED\n');
    console.log('═'.repeat(60));
    console.log(`📅 ${new Date().toISOString()}`);
    console.log(`📦 ${COLLECTION_CONFIGS.length} collections to scan`);
    console.log('═'.repeat(60));

    this.isRunning = true;

    try {
      // Stage 0: Sync collections
      await this.syncCollections();

      // Scan each collection
      for (const config of COLLECTION_CONFIGS) {
        if (!this.isRunning) break;
        await this.scanCollection(config);
        
        // Pause between collections
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      console.log('\n✅ ALL COLLECTIONS SCANNED!\n');
    } catch (error: any) {
      console.error('\n❌ SCANNER ERROR:', error.message, '\n');
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Start background scanner with interval
   */
  startScheduled(intervalHours: number = 24): void {
    console.log(`\n⏰ Starting scheduled scanner (every ${intervalHours} hours)...\n`);
    
    // Run immediately
    this.scanAllCollections();

    // Schedule recurring scans
    this.scanInterval = setInterval(() => {
      if (!this.isRunning) {
        this.scanAllCollections();
      }
    }, intervalHours * 60 * 60 * 1000);
  }

  /**
   * Stop background scanner
   */
  stop(): void {
    console.log('\n🛑 Stopping background scanner...\n');
    this.isRunning = false;
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
  }
}

// Export singleton instance
export const backgroundScanner = new BackgroundNFTScanner();
