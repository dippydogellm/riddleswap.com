import { db } from "./db";
import { inquisitionCollections, inquisitionNftAudit } from "../shared/inquisition-audit-schema";
import { eq, sql } from "drizzle-orm";

/**
 * Trait Rarity Analyzer
 * Analyzes all NFTs in each collection to calculate exact trait rarity percentages
 * Rarer traits = higher power in battle system
 */

interface TraitRarityData {
  trait_type: string;
  value: string;
  count: number;
  total_supply: number;
  rarity_percentage: number;
  power_multiplier: number; // Based on rarity - rarer = higher multiplier
}

interface CollectionTraitAnalysis {
  collection_id: number;
  collection_name: string;
  total_supply: number;
  trait_rarities: Map<string, TraitRarityData[]>; // trait_type => array of values with rarity
  last_analyzed: Date;
}

export class TraitRarityAnalyzer {
  private static rarityCache: Map<string, CollectionTraitAnalysis> = new Map();

  /**
   * Analyze all traits in a collection and calculate rarity percentages
   */
  static async analyzeCollection(collectionId: number, collectionName: string): Promise<CollectionTraitAnalysis> {
    console.log(`\n🔍 [TRAIT RARITY] Analyzing collection: ${collectionName}`);
    
    // Get all NFTs in this collection
    const allNFTs = await db.query.inquisitionNftAudit.findMany({
      where: eq(inquisitionNftAudit.collection_id, collectionId)
    });

    const totalSupply = allNFTs.length;
    console.log(`📊 [TRAIT RARITY] Found ${totalSupply} NFTs in ${collectionName}`);

    // Handle empty collection - return default analysis
    if (totalSupply === 0) {
      console.log(`⚠️ [TRAIT RARITY] Collection ${collectionName} is empty - using default power multipliers`);
      const emptyAnalysis: CollectionTraitAnalysis = {
        collection_id: collectionId,
        collection_name: collectionName,
        total_supply: 0,
        trait_rarities: new Map(),
        last_analyzed: new Date()
      };
      this.rarityCache.set(collectionName, emptyAnalysis);
      return emptyAnalysis;
    }

    // Count trait occurrences
    const traitCounts: Map<string, Map<string, number>> = new Map();

    for (const nft of allNFTs) {
      const traits = nft.traits || {};
      
      for (const [traitType, value] of Object.entries(traits)) {
        if (!traitCounts.has(traitType)) {
          traitCounts.set(traitType, new Map());
        }
        
        const valueCounts = traitCounts.get(traitType)!;
        const valueStr = String(value);
        valueCounts.set(valueStr, (valueCounts.get(valueStr) || 0) + 1);
      }
    }

    // Calculate rarity percentages and power multipliers
    const traitRarities: Map<string, TraitRarityData[]> = new Map();

    for (const [traitType, valueCounts] of Array.from(traitCounts.entries())) {
      const rarityData: TraitRarityData[] = [];

      for (const [value, count] of valueCounts.entries()) {
        const rarityPercentage = (count / totalSupply) * 100;
        
        // Calculate power multiplier based on rarity
        // 1% trait = 5.0x multiplier
        // 5% trait = 3.0x multiplier
        // 10% trait = 2.0x multiplier
        // 25% trait = 1.5x multiplier
        // 50% trait = 1.0x multiplier
        const powerMultiplier = this.calculatePowerMultiplier(rarityPercentage);

        rarityData.push({
          trait_type: traitType,
          value,
          count,
          total_supply: totalSupply,
          rarity_percentage: Math.round(rarityPercentage * 100) / 100,
          power_multiplier: powerMultiplier
        });
      }

      // Sort by rarity (rarest first)
      rarityData.sort((a, b) => a.rarity_percentage - b.rarity_percentage);
      traitRarities.set(traitType, rarityData);

      // Log rarest traits
      const rarest = rarityData.slice(0, 3);
      console.log(`  🎯 ${traitType} - Rarest:`);
      for (const rare of rarest) {
        console.log(`     "${rare.value}": ${rare.rarity_percentage.toFixed(2)}% (${rare.count}/${totalSupply}) - ${rare.power_multiplier.toFixed(2)}x power`);
      }
    }

    const analysis: CollectionTraitAnalysis = {
      collection_id: collectionId,
      collection_name: collectionName,
      total_supply: totalSupply,
      trait_rarities: traitRarities,
      last_analyzed: new Date()
    };

    // Cache the analysis
    this.rarityCache.set(collectionName, analysis);

    console.log(`✅ [TRAIT RARITY] Analysis complete for ${collectionName} - ${traitCounts.size} trait types analyzed\n`);
    return analysis;
  }

  /**
   * Calculate power multiplier based on rarity percentage
   * Exponential curve: rarer traits = significantly higher power
   */
  private static calculatePowerMultiplier(rarityPercentage: number): number {
    if (rarityPercentage <= 0.5) return 10.0;  // Ultra rare (0.5% or less) - 10x power
    if (rarityPercentage <= 1.0) return 8.0;   // Legendary (1%) - 8x power
    if (rarityPercentage <= 2.0) return 6.0;   // Epic (2%) - 6x power
    if (rarityPercentage <= 5.0) return 4.0;   // Rare (5%) - 4x power
    if (rarityPercentage <= 10.0) return 3.0;  // Uncommon (10%) - 3x power
    if (rarityPercentage <= 20.0) return 2.0;  // Less common (20%) - 2x power
    if (rarityPercentage <= 35.0) return 1.5;  // Common (35%) - 1.5x power
    return 1.0;                                 // Very common (>35%) - 1x power
  }

  /**
   * Get trait rarity data for a specific trait in a collection
   */
  static getTraitRarity(collectionName: string, traitType: string, value: string): TraitRarityData | null {
    const analysis = this.rarityCache.get(collectionName);
    if (!analysis) return null;

    const traitData = analysis.trait_rarities.get(traitType);
    if (!traitData) return null;

    return traitData.find(t => t.value === value) || null;
  }

  /**
   * Calculate total power bonus for all traits in an NFT based on rarity
   */
  static calculateRarityPowerBonus(collectionName: string, traits: Record<string, any>): {
    totalBonus: number;
    rarityMultipliers: Record<string, number>;
    rarityPercentages: Record<string, number>;
  } {
    const analysis = this.rarityCache.get(collectionName);
    if (!analysis) {
      return {
        totalBonus: 0,
        rarityMultipliers: {},
        rarityPercentages: {}
      };
    }

    let totalBonus = 0;
    const rarityMultipliers: Record<string, number> = {};
    const rarityPercentages: Record<string, number> = {};

    for (const [traitType, value] of Object.entries(traits)) {
      const rarityData = this.getTraitRarity(collectionName, traitType, String(value));
      
      if (rarityData) {
        // Base power per trait = 50
        // Multiplied by rarity multiplier
        const traitPower = 50 * rarityData.power_multiplier;
        totalBonus += traitPower;
        
        rarityMultipliers[traitType] = rarityData.power_multiplier;
        rarityPercentages[traitType] = rarityData.rarity_percentage;
      } else {
        // Unknown trait - give baseline power
        totalBonus += 50;
        rarityMultipliers[traitType] = 1.0;
        rarityPercentages[traitType] = 50.0;
      }
    }

    return {
      totalBonus,
      rarityMultipliers,
      rarityPercentages
    };
  }

  /**
   * Analyze all 6 collections
   */
  static async analyzeAllCollections(): Promise<void> {
    console.log("\n🎯 [TRAIT RARITY] Starting comprehensive trait analysis for all collections...\n");
    
    const collections = await db.query.inquisitionCollections.findMany();
    
    for (const collection of collections) {
      try {
        // Validate collection.id is a number
        const collectionId = typeof collection.id === 'number' ? collection.id : parseInt(String(collection.id));
        if (isNaN(collectionId)) {
          console.error(`❌ [TRAIT RARITY] Invalid collection ID for ${collection.collection_name}: ${collection.id}`);
          continue;
        }
        const collectionName = collection.collection_name ? String(collection.collection_name) : 'Unknown Collection';
        await this.analyzeCollection(collectionId, collectionName);
      } catch (error) {
        console.error(`❌ [TRAIT RARITY] Failed to analyze ${collection.collection_name}:`, error);
      }
    }

    console.log("✅ [TRAIT RARITY] All collections analyzed successfully!\n");
  }

  /**
   * Get rarity statistics for a collection
   */
  static getCollectionStats(collectionName: string): {
    totalSupply: number;
    traitTypes: number;
    rarestTraits: Array<{ type: string; value: string; percentage: number; multiplier: number }>;
  } | null {
    const analysis = this.rarityCache.get(collectionName);
    if (!analysis) return null;

    // Find top 10 rarest traits across all trait types
    const allRarest: Array<{ type: string; value: string; percentage: number; multiplier: number }> = [];
    
    for (const [traitType, rarityData] of Array.from(analysis.trait_rarities.entries())) {
      const topRare = rarityData.slice(0, 3);
      for (const rare of topRare) {
        allRarest.push({
          type: traitType,
          value: rare.value,
          percentage: rare.rarity_percentage,
          multiplier: rare.power_multiplier
        });
      }
    }

    // Sort by rarity percentage
    allRarest.sort((a, b) => a.percentage - b.percentage);

    return {
      totalSupply: analysis.total_supply,
      traitTypes: analysis.trait_rarities.size,
      rarestTraits: allRarest.slice(0, 10)
    };
  }

  /**
   * Export rarity data for debugging
   */
  static exportRarityData(collectionName: string): any {
    const analysis = this.rarityCache.get(collectionName);
    if (!analysis) return null;

    const export_data: any = {
      collection: collectionName,
      total_supply: analysis.total_supply,
      last_analyzed: analysis.last_analyzed,
      traits: {}
    };

    for (const [traitType, rarityData] of Array.from(analysis.trait_rarities.entries())) {
      export_data.traits[traitType] = rarityData.map((r: TraitRarityData) => ({
        value: r.value,
        count: r.count,
        percentage: r.rarity_percentage,
        multiplier: r.power_multiplier
      }));
    }

    return export_data;
  }
}
