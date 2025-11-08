/**
 * Scanner 2: OpenAI Metadata Scoring Scanner
 * 
 * Uses OpenAI to analyze NFT metadata and assign intelligent power scores:
 * - Army Power (military strength, combat effectiveness)
 * - Religion Power (religious influence, spiritual control)
 * - Civilization Power (cultural development, infrastructure)
 * - Economic Power (wealth, trade, banking)
 * 
 * Analyzes traits, names, descriptions, and attributes to create
 * contextually appropriate power levels
 */

import { db } from "../db";
import { 
  gamingNfts, 
  gamingNftCollections,
  scannerLogs
} from "../../shared/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

interface PowerScores {
  army_power: number;          // 0-1000
  religion_power: number;       // 0-1000
  civilization_power: number;   // 0-1000
  economic_power: number;       // 0-1000
  total_power: number;          // Sum of all powers
  
  // Detailed breakdowns
  power_reasoning: string;
  special_abilities: string[];
  material_multiplier: number;  // 1.0 - 5.0
  rarity_multiplier: number;    // 1.0 - 10.0
  
  // Classifications
  character_class?: string;
  role_type?: string;           // warrior, priest, trader, ruler, etc.
  strength_category: 'weak' | 'average' | 'strong' | 'elite' | 'legendary';
}

interface ScanResult {
  success: boolean;
  nfts_scanned: number;
  nfts_scored: number;
  nfts_failed: number;
  errors: string[];
  duration_ms: number;
}

export class OpenAIMetadataScorer {
  
  private readonly BATCH_SIZE = 5; // Process 5 NFTs at once
  private readonly MAX_RETRIES = 3;
  
  /**
   * Score all unscored NFTs in a collection
   */
  async scoreCollection(collectionId: string): Promise<ScanResult> {
    const startTime = Date.now();
    console.log(`\n🤖 [AI SCORER] Starting AI scoring for collection ${collectionId}`);
    
    const result: ScanResult = {
      success: false,
      nfts_scanned: 0,
      nfts_scored: 0,
      nfts_failed: 0,
      errors: [],
      duration_ms: 0
    };

    // Get collection first to get its name
    const collection = await db.query.gamingNftCollections.findFirst({
      where: eq(gamingNftCollections.collection_id, collectionId)
    });
    
    if (!collection) {
      throw new Error(`Collection ${collectionId} not found`);
    }

    // Create scanner log entry
    const [logEntry] = await db.insert(scannerLogs).values({
      scanner_name: 'openai-metadata-scorer',
      scanner_type: 'ai_scoring',
      status: 'running',
      started_at: new Date(),
      target_id: collectionId,
      target_name: collection.collection_name
    } as any).returning();
    
    try {
      // Get all NFTs from collection that need scoring
      const nfts = await db.query.gamingNfts.findMany({
        where: eq(gamingNfts.collection_id, collection.id)
      });
      
      console.log(`📊 [AI SCORER] Found ${nfts.length} NFTs to score`);
      result.nfts_scanned = nfts.length;
      
      // Process in batches
      for (let i = 0; i < nfts.length; i += this.BATCH_SIZE) {
        const batch = nfts.slice(i, i + this.BATCH_SIZE);
        console.log(`   Processing batch ${Math.floor(i / this.BATCH_SIZE) + 1}/${Math.ceil(nfts.length / this.BATCH_SIZE)}...`);
        
        await Promise.all(
          batch.map(async (nft) => {
            try {
              await this.scoreNFT(nft, collection);
              result.nfts_scored++;
            } catch (error) {
              result.nfts_failed++;
              const errorMsg = `Failed to score NFT ${nft.nft_id}: ${error instanceof Error ? error.message : String(error)}`;
              result.errors.push(errorMsg);
              console.error(`   ❌ ${errorMsg}`);
            }
          })
        );
        
        // Rate limiting delay
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      result.success = true;
      result.duration_ms = Date.now() - startTime;
      
      // Update scanner log with success
      await db.update(scannerLogs)
        .set({
          status: 'completed',
          completed_at: new Date(),
          duration_ms: result.duration_ms,
          entities_scanned: result.nfts_scanned,
          entities_processed: result.nfts_scored,
          entities_failed: result.nfts_failed,
          statistics: {
            nfts_scanned: result.nfts_scanned,
            nfts_scored: result.nfts_scored,
            nfts_failed: result.nfts_failed,
            batches_processed: Math.ceil(nfts.length / this.BATCH_SIZE)
          },
          warnings: result.errors.length > 0 ? result.errors : null
        } as any)
        .where(eq(scannerLogs.id, logEntry.id));
      
      console.log(`\n✅ [AI SCORER] Scoring completed!`);
      console.log(`   📊 NFTs Scanned: ${result.nfts_scanned}`);
      console.log(`   ✅ NFTs Scored: ${result.nfts_scored}`);
      console.log(`   ❌ NFTs Failed: ${result.nfts_failed}`);
      console.log(`   ⏱️  Duration: ${result.duration_ms}ms`);
      
      return result;
      
    } catch (error) {
      console.error(`❌ [AI SCORER] Scoring failed:`, error);
      result.errors.push(error instanceof Error ? error.message : String(error));
      result.duration_ms = Date.now() - startTime;
      
      // Update scanner log with failure
      await db.update(scannerLogs)
        .set({
          status: 'failed',
          completed_at: new Date(),
          duration_ms: result.duration_ms,
          entities_scanned: result.nfts_scanned,
          entities_failed: result.nfts_failed,
          error_message: error instanceof Error ? error.message : String(error),
          error_details: { errors: result.errors }
        } as any)
        .where(eq(scannerLogs.id, logEntry.id));
      
      return result;
    }
  }
  
  /**
   * Score a single NFT using OpenAI
   */
  private async scoreNFT(nft: any, collection: any, retryCount = 0): Promise<void> {
    try {
      console.log(`   🤖 Scoring NFT: ${nft.name || nft.nft_id.slice(-8)}`);
      
      // Build context for AI
      const context = this.buildNFTContext(nft, collection);
      
      // Call OpenAI
      const scores = await this.getAIScores(context);
      
      // Update NFT in database with game_stats
      await db.update(gamingNfts)
        .set({
          game_stats: {
            army_power: scores.army_power,
            religion_power: scores.religion_power,
            civilization_power: scores.civilization_power,
            economic_power: scores.economic_power,
            total_power: scores.total_power,
            power_reasoning: scores.power_reasoning,
            special_abilities: scores.special_abilities,
            material_multiplier: scores.material_multiplier,
            rarity_multiplier: scores.rarity_multiplier,
            character_class: scores.character_class,
            role_type: scores.role_type,
            strength_category: scores.strength_category,
            ai_scored: true,
            ai_scored_at: new Date().toISOString()
          },
          updated_at: new Date()
        } as any)
        .where(eq(gamingNfts.id, nft.id));
      
      console.log(`   ✅ Scored: Army ${scores.army_power}, Religion ${scores.religion_power}, Civ ${scores.civilization_power}, Econ ${scores.economic_power}`);
      
    } catch (error) {
      if (retryCount < this.MAX_RETRIES) {
        console.log(`   ⚠️ Retry ${retryCount + 1}/${this.MAX_RETRIES} for ${nft.nft_id}`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return this.scoreNFT(nft, collection, retryCount + 1);
      }
      throw error;
    }
  }
  
  /**
   * Build context for AI analysis
   */
  private buildNFTContext(nft: any, collection: any): string {
    const parts = [
      `Collection: ${collection.collection_name}`,
      `Collection Role: ${collection.game_role}`,
      `NFT Name: ${nft.name || 'Unknown'}`,
      `Description: ${nft.description || 'None'}`,
    ];
    
    // Add traits
    if (nft.traits && Object.keys(nft.traits).length > 0) {
      parts.push(`Traits:`);
      for (const [key, value] of Object.entries(nft.traits)) {
        parts.push(`  - ${key}: ${value}`);
      }
    }
    
    // Add metadata attributes
    if (nft.metadata?.attributes && Array.isArray(nft.metadata.attributes)) {
      parts.push(`Attributes:`);
      for (const attr of nft.metadata.attributes) {
        parts.push(`  - ${attr.trait_type}: ${attr.value}`);
      }
    }
    
    return parts.join('\n');
  }
  
  /**
   * Get AI power scores from OpenAI
   */
  private async getAIScores(context: string): Promise<PowerScores> {
    const prompt = `You are an expert game balance designer for a medieval NFT strategy game. Analyze this NFT and assign power scores across 4 categories.

NFT Details:
${context}

Assign power scores (0-1000) for each category based on the NFT's traits, name, and description:

1. **Army Power** (0-1000): Military strength, combat effectiveness, warfare capability
   - Warriors, knights, soldiers → HIGH
   - Weapons, armor, military equipment → MEDIUM-HIGH
   - Non-combat roles → LOW

2. **Religion Power** (0-1000): Religious influence, spiritual authority, faith control
   - Priests, monks, religious leaders → HIGH
   - Holy artifacts, religious buildings → MEDIUM-HIGH
   - Secular items → LOW

3. **Civilization Power** (0-1000): Cultural development, infrastructure, governance
   - Rulers, governors, administrators → HIGH
   - Buildings, monuments, cultural items → MEDIUM-HIGH
   - Military-only items → LOW

4. **Economic Power** (0-1000): Wealth generation, trade, banking, resources
   - Merchants, bankers, traders → HIGH
   - Gold, currency, trade goods → MEDIUM-HIGH
   - Non-economic items → LOW

Also provide:
- **Material Multiplier** (1.0-5.0): Based on material quality (wood=1.0, iron=1.5, steel=2.0, gold=3.0, mythril=4.0, legendary=5.0)
- **Rarity Multiplier** (1.0-10.0): Based on rarity (common=1.0, uncommon=1.5, rare=2.0, epic=3.0, legendary=5.0, mythic=10.0)
- **Special Abilities**: List any unique powers or abilities (max 3)
- **Character Class**: The primary class/type
- **Role Type**: warrior, priest, trader, ruler, builder, mage, or other
- **Strength Category**: weak, average, strong, elite, or legendary

Respond ONLY with valid JSON in this exact format:
{
  "army_power": <number>,
  "religion_power": <number>,
  "civilization_power": <number>,
  "economic_power": <number>,
  "material_multiplier": <number>,
  "rarity_multiplier": <number>,
  "special_abilities": [<string>, ...],
  "character_class": "<string>",
  "role_type": "<string>",
  "strength_category": "<string>",
  "power_reasoning": "<brief explanation>"
}`;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a game balance expert. Respond only with valid JSON. No markdown, no explanations."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 800,
        response_format: { type: "json_object" }
      });
      
      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from OpenAI");
      }
      
      const parsed = JSON.parse(content);
      
      // Calculate total power
      const totalPower = 
        (parsed.army_power || 0) + 
        (parsed.religion_power || 0) + 
        (parsed.civilization_power || 0) + 
        (parsed.economic_power || 0);
      
      return {
        army_power: Math.round(parsed.army_power || 0),
        religion_power: Math.round(parsed.religion_power || 0),
        civilization_power: Math.round(parsed.civilization_power || 0),
        economic_power: Math.round(parsed.economic_power || 0),
        total_power: Math.round(totalPower),
        power_reasoning: parsed.power_reasoning || 'AI-scored based on metadata',
        special_abilities: parsed.special_abilities || [],
        material_multiplier: parsed.material_multiplier || 1.0,
        rarity_multiplier: parsed.rarity_multiplier || 1.0,
        character_class: parsed.character_class,
        role_type: parsed.role_type,
        strength_category: parsed.strength_category || 'average'
      };
      
    } catch (error) {
      console.error(`❌ OpenAI API error:`, error);
      
      // Fallback to basic scoring
      return this.getFallbackScores(context);
    }
  }
  
  /**
   * Fallback scoring when AI fails
   */
  private getFallbackScores(context: string): PowerScores {
    const lowerContext = context.toLowerCase();
    
    let army = 100;
    let religion = 100;
    let civilization = 100;
    let economic = 100;
    
    // Simple keyword-based scoring
    if (lowerContext.includes('warrior') || lowerContext.includes('knight') || lowerContext.includes('soldier')) {
      army = 500;
    }
    if (lowerContext.includes('priest') || lowerContext.includes('monk') || lowerContext.includes('holy')) {
      religion = 500;
    }
    if (lowerContext.includes('king') || lowerContext.includes('ruler') || lowerContext.includes('lord')) {
      civilization = 500;
    }
    if (lowerContext.includes('merchant') || lowerContext.includes('banker') || lowerContext.includes('gold')) {
      economic = 500;
    }
    
    return {
      army_power: army,
      religion_power: religion,
      civilization_power: civilization,
      economic_power: economic,
      total_power: army + religion + civilization + economic,
      power_reasoning: 'Fallback keyword-based scoring',
      special_abilities: [],
      material_multiplier: 1.0,
      rarity_multiplier: 1.0,
      strength_category: 'average'
    };
  }
  
  /**
   * Re-score all NFTs (full rescan)
   */
  async rescoreAllNFTs(): Promise<ScanResult> {
    console.log(`\n🔄 [AI SCORER] Re-scoring all NFTs...`);
    
    const collections = await db.select({
      id: gamingNftCollections.id,
      collection_name: gamingNftCollections.collection_name
    }).from(gamingNftCollections);
    
    let totalScanned = 0;
    let totalScored = 0;
    let totalFailed = 0;
    const allErrors: string[] = [];
    
    for (const collection of collections) {
      console.log(`\n📦 Processing collection: ${collection.collection_name}`);
      const result = await this.scoreCollection(collection.id);
      
      totalScanned += result.nfts_scanned;
      totalScored += result.nfts_scored;
      totalFailed += result.nfts_failed;
      allErrors.push(...result.errors);
    }
    
    return {
      success: true,
      nfts_scanned: totalScanned,
      nfts_scored: totalScored,
      nfts_failed: totalFailed,
      errors: allErrors,
      duration_ms: 0
    };
  }
}

// Export singleton instance
export const openAIMetadataScorer = new OpenAIMetadataScorer();
