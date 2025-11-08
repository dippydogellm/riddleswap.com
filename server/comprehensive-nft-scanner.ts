import { db } from "./db";
import { inquisitionCollections, inquisitionNftAudit, inquisitionScanHistory } from "../shared/inquisition-audit-schema";
import { nftPowerAttributes, gamingNfts, gamingPlayers } from "../shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { PlayerActivityTracker } from "./player-activity-tracker";
import { TraitRarityAnalyzer } from "./trait-rarity-analyzer";

/**
 * Comprehensive NFT Metadata Scanner (UPGRADED FOR RIDDLECITY)
 * Scans all Inquisition collections with full trait analysis, power calculations, and RiddleCity integration
 * Features:
 * - Automatic gaming NFT collection creation
 * - Enhanced power calculations with trait rarity
 * - Real-time player power synchronization
 * - RiddleCity land plot integration
 */

interface CollectionConfig {
  id: number;
  name: string;
  issuer: string;
  taxon: number;
  role: 'army' | 'bank' | 'merchant' | 'special' | 'partner';
  basePower: number;
}

interface NFTMetadata {
  name?: string;
  description?: string;
  image?: string;
  attributes?: Array<{
    trait_type?: string;
    value?: string | number;
    display_type?: string;
  }>;
  [key: string]: any;
}

interface TraitPowerResult {
  army_power: number;
  religion_power: number;
  civilization_power: number;
  economic_power: number;
  total_power: number;
  special_powers: string[];
  materials_found: string[];
  rarities_found: string[];
  trait_mapping: Record<string, number>;
  material_multiplier: number;
  rarity_multiplier: number;
}

/**
 * Collection-Specific Power Calculators
 */
class PowerCalculators {
  /**
   * THE INQUIRY - Balanced Collection
   * Special percentage-based powers, divine attributes + TRAIT RARITY
   * REBALANCED: More realistic power levels
   */
  static calculateInquiryPower(traits: NFTMetadata, allTraits: Record<string, any>): TraitPowerResult {
    const result: TraitPowerResult = {
      army_power: 0,
      religion_power: 0,
      civilization_power: 0,
      economic_power: 0,
      total_power: 0,
      special_powers: [],
      materials_found: [],
      rarities_found: [],
      trait_mapping: {},
      material_multiplier: 1.0,
      rarity_multiplier: 1.0
    };

    const attributes = traits.attributes || [];
    const basePower = 180; // ✅ BALANCED - Similar to other collections

    const fullText = JSON.stringify(traits).toLowerCase();

    // 🎯 TRAIT RARITY BONUS - Balanced rarity power
    const rarityBonus = TraitRarityAnalyzer.calculateRarityPowerBonus("The Inquiry", allTraits);
    result.army_power += rarityBonus.totalBonus * 0.3; // ✅ Balanced
    result.religion_power += rarityBonus.totalBonus * 0.4; // ✅ Slightly higher religion focus
    result.civilization_power += rarityBonus.totalBonus * 0.2; // ✅ Balanced

    // ✅ DETECT MATERIAL - Normal material multipliers
    const material = this.detectMaterial(fullText);
    result.materials_found.push(material.name);
    result.material_multiplier = material.multiplier; // ✅ NORMAL MATERIAL BONUS

    // Detect rarity - normal rarity multipliers
    const rarity = this.detectRarity(fullText);
    result.rarities_found.push(rarity.level);
    result.rarity_multiplier = rarity.multiplier; // ✅ NORMAL rarity multiplier

    // Divine/Holy keywords give moderate religion power
    const divineKeywords = ['divine', 'holy', 'blessed', 'sacred', 'celestial', 'angelic'];
    const specialKeywords = ['inquiry', 'wisdom', 'knowledge', 'enlightenment'];
    
    for (const keyword of divineKeywords) {
      if (fullText.includes(keyword)) {
        result.religion_power += 40; // ✅ Balanced (was 150)
        result.special_powers.push(`Divine ${keyword}`);
      }
    }

    for (const keyword of specialKeywords) {
      if (fullText.includes(keyword)) {
        result.religion_power += 60; // ✅ Balanced (was 300)
        result.special_powers.push(`Special ${keyword}`);
      }
    }

    // Parse traits for special powers
    for (const attr of attributes) {
      const traitType = String(attr.trait_type || '').toLowerCase();
      const value = String(attr.value || '');
      const valueLower = value.toLowerCase();

      // Check for percentage values - Balanced percentage bonuses
      const percentMatch = value.match(/(\d+)%/);
      if (percentMatch) {
        const percentage = parseInt(percentMatch[1]);
        result.special_powers.push(`${attr.trait_type}: ${value}`);
        
        // Apply balanced percentage-based power
        if (traitType.includes('attack') || traitType.includes('strike')) {
          result.army_power += percentage * 2.5; // ✅ Balanced (was 10)
        } else if (traitType.includes('defense') || traitType.includes('shield')) {
          result.army_power += percentage * 2; // ✅ Balanced (was 8)
        } else if (traitType.includes('heal') || traitType.includes('blessing')) {
          result.religion_power += percentage * 3.5; // ✅ Balanced (was 12)
        } else {
          result.civilization_power += percentage * 2; // ✅ Balanced (was 6)
        }
      }

      // Special trait analysis - Balanced bonuses
      if (traitType.includes('power') || traitType.includes('strength')) {
        result.army_power += this.extractNumericValue(value, 70); // ✅ Balanced (was 300)
      }
      if (traitType.includes('wisdom') || traitType.includes('intelligence')) {
        result.civilization_power += this.extractNumericValue(value, 90); // ✅ Balanced (was 300)
      }
      if (traitType.includes('faith') || traitType.includes('spirit')) {
        result.religion_power += this.extractNumericValue(value, 110); // ✅ Balanced (was 450)
      }

      result.trait_mapping[attr.trait_type || 'unknown'] = this.extractNumericValue(value, 35); // ✅ Balanced (was 150)
    }

    // Calculate total power with balanced multipliers
    const rawPower = result.army_power + result.religion_power + result.civilization_power + result.economic_power;
    result.total_power = basePower + (rawPower * result.rarity_multiplier * result.material_multiplier);

    return result;
  }

  /**
   * THE INQUISITION - Military/Army Collection
   * Weapon and armor-based power + TRAIT RARITY
   */
  static calculateInquisitionPower(traits: NFTMetadata, allTraits: Record<string, any>): TraitPowerResult {
    const result: TraitPowerResult = {
      army_power: 0,
      religion_power: 0,
      civilization_power: 0,
      economic_power: 0,
      total_power: 0,
      special_powers: [],
      materials_found: [],
      rarities_found: [],
      trait_mapping: {},
      material_multiplier: 1.0,
      rarity_multiplier: 1.0
    };

    const attributes = traits.attributes || [];
    const basePower = 200;

    // 🎯 TRAIT RARITY BONUS - Rarer traits = more power
    const rarityBonus = TraitRarityAnalyzer.calculateRarityPowerBonus("The Inquisition", allTraits);
    result.army_power += rarityBonus.totalBonus * 0.8; // 80% to army (military focused)
    result.religion_power += rarityBonus.totalBonus * 0.1; // 10% to religion
    result.civilization_power += rarityBonus.totalBonus * 0.1; // 10% to civilization

    // Weapon keywords
    const weaponKeywords = ['sword', 'axe', 'mace', 'spear', 'bow', 'crossbow', 'blade', 'hammer'];
    const armorKeywords = ['armor', 'shield', 'helmet', 'plate', 'chainmail', 'gauntlet'];
    
    const fullText = JSON.stringify(traits).toLowerCase();

    for (const weapon of weaponKeywords) {
      if (fullText.includes(weapon)) {
        result.army_power += 80;
        result.special_powers.push(`Wielding ${weapon}`);
      }
    }

    for (const armor of armorKeywords) {
      if (fullText.includes(armor)) {
        result.army_power += 60;
        result.special_powers.push(`Equipped with ${armor}`);
      }
    }

    // Check for materials and rarity
    const material = this.detectMaterial(fullText);
    result.materials_found.push(material.name);
    result.material_multiplier = material.multiplier;

    const rarity = this.detectRarity(fullText);
    result.rarities_found.push(rarity.level);
    result.rarity_multiplier = rarity.multiplier;

    // Parse attributes
    for (const attr of attributes) {
      const traitType = String(attr.trait_type || '').toLowerCase();
      const value = String(attr.value || '');

      if (traitType.includes('attack') || traitType.includes('damage')) {
        result.army_power += this.extractNumericValue(value, 50);
      }
      if (traitType.includes('defense') || traitType.includes('armor')) {
        result.army_power += this.extractNumericValue(value, 40);
      }

      result.trait_mapping[attr.trait_type || 'unknown'] = this.extractNumericValue(value, 30);
    }

    result.total_power = basePower + (result.army_power * result.material_multiplier * result.rarity_multiplier);
    return result;
  }

  /**
   * UNDER THE BRIDGE: TROLL - Economic/Banking Collection
   * Wealth and trade-based power + TRAIT RARITY
   */
  static calculateUnderBridgePower(traits: NFTMetadata, allTraits: Record<string, any>): TraitPowerResult {
    const result: TraitPowerResult = {
      army_power: 0,
      religion_power: 0,
      civilization_power: 0,
      economic_power: 0,
      total_power: 0,
      special_powers: [],
      materials_found: [],
      rarities_found: [],
      trait_mapping: {},
      material_multiplier: 1.0,
      rarity_multiplier: 1.0
    };

    const attributes = traits.attributes || [];
    const basePower = 150;

    // 🎯 TRAIT RARITY BONUS - Rarer traits = more power
    const rarityBonus = TraitRarityAnalyzer.calculateRarityPowerBonus("Under the Bridge: Troll", allTraits);
    result.economic_power += rarityBonus.totalBonus * 0.7; // 70% to economic (banking focused)
    result.civilization_power += rarityBonus.totalBonus * 0.3; // 30% to civilization

    // Economic keywords
    const wealthKeywords = ['gold', 'treasure', 'coin', 'wealth', 'rich', 'merchant', 'banker'];
    const tradeKeywords = ['trade', 'commerce', 'market', 'exchange', 'deal'];
    
    const fullText = JSON.stringify(traits).toLowerCase();

    for (const keyword of wealthKeywords) {
      if (fullText.includes(keyword)) {
        result.economic_power += 100;
        result.special_powers.push(`Economic: ${keyword}`);
      }
    }

    for (const keyword of tradeKeywords) {
      if (fullText.includes(keyword)) {
        result.economic_power += 80;
        result.civilization_power += 40;
      }
    }

    // Check for gold/wealth materials
    const material = this.detectMaterial(fullText);
    if (material.name === 'gold' || material.name === 'platinum' || material.name === 'diamond') {
      result.economic_power += 200;
    }
    result.materials_found.push(material.name);
    result.material_multiplier = material.multiplier;

    // Detect rarity
    const rarity = this.detectRarity(fullText);
    result.rarities_found.push(rarity.level);
    result.rarity_multiplier = rarity.multiplier;

    for (const attr of attributes) {
      const traitType = String(attr.trait_type || '').toLowerCase();
      const value = String(attr.value || '');

      if (traitType.includes('wealth') || traitType.includes('gold') || traitType.includes('coin')) {
        result.economic_power += this.extractNumericValue(value, 60);
      }
      if (traitType.includes('trade') || traitType.includes('merchant')) {
        result.civilization_power += this.extractNumericValue(value, 40);
      }

      result.trait_mapping[attr.trait_type || 'unknown'] = this.extractNumericValue(value, 30);
    }

    result.total_power = basePower + ((result.economic_power * 1.5 + result.civilization_power) * result.rarity_multiplier);
    return result;
  }

  /**
   * THE LOST EMPORIUM - Trade & Civilization Collection
   * Cultural and artifact-based power + TRAIT RARITY
   */
  static calculateLostEmporiumPower(traits: NFTMetadata, allTraits: Record<string, any>): TraitPowerResult {
    const result: TraitPowerResult = {
      army_power: 0,
      religion_power: 0,
      civilization_power: 0,
      economic_power: 0,
      total_power: 0,
      special_powers: [],
      materials_found: [],
      rarities_found: [],
      trait_mapping: {},
      material_multiplier: 1.0,
      rarity_multiplier: 1.0
    };

    const attributes = traits.attributes || [];
    const basePower = 180;

    // 🎯 TRAIT RARITY BONUS - Rarer traits = more power
    const rarityBonus = TraitRarityAnalyzer.calculateRarityPowerBonus("The Lost Emporium", allTraits);
    result.civilization_power += rarityBonus.totalBonus * 0.6; // 60% to civilization (culture focused)
    result.economic_power += rarityBonus.totalBonus * 0.4; // 40% to economic

    // Civilization keywords
    const cultureKeywords = ['art', 'culture', 'library', 'scroll', 'knowledge', 'ancient', 'artifact'];
    const tradeKeywords = ['emporium', 'bazaar', 'market', 'trade', 'exchange'];
    
    const fullText = JSON.stringify(traits).toLowerCase();

    for (const keyword of cultureKeywords) {
      if (fullText.includes(keyword)) {
        result.civilization_power += 90;
        result.special_powers.push(`Cultural: ${keyword}`);
      }
    }

    for (const keyword of tradeKeywords) {
      if (fullText.includes(keyword)) {
        result.economic_power += 70;
        result.civilization_power += 50;
      }
    }

    // Detect rarity
    const rarity = this.detectRarity(fullText);
    result.rarities_found.push(rarity.level);
    result.rarity_multiplier = rarity.multiplier;

    for (const attr of attributes) {
      const traitType = String(attr.trait_type || '').toLowerCase();
      const value = String(attr.value || '');

      if (traitType.includes('knowledge') || traitType.includes('wisdom')) {
        result.civilization_power += this.extractNumericValue(value, 50);
      }
      if (traitType.includes('trade') || traitType.includes('commerce')) {
        result.economic_power += this.extractNumericValue(value, 45);
      }

      result.trait_mapping[attr.trait_type || 'unknown'] = this.extractNumericValue(value, 35);
    }

    result.total_power = basePower + ((result.civilization_power + result.economic_power) * result.rarity_multiplier);
    return result;
  }

  /**
   * DANTES AURUM - Premium Special Collection
   * Enhanced bonuses across all power types + TRAIT RARITY
   */
  static calculateDantesAurumPower(traits: NFTMetadata, allTraits: Record<string, any>): TraitPowerResult {
    const result: TraitPowerResult = {
      army_power: 0,
      religion_power: 0,
      civilization_power: 0,
      economic_power: 0,
      total_power: 0,
      special_powers: [],
      materials_found: [],
      rarities_found: [],
      trait_mapping: {},
      material_multiplier: 1.0,
      rarity_multiplier: 1.0
    };

    const attributes = traits.attributes || [];
    const basePower = 300; // Premium collection

    const fullText = JSON.stringify(traits).toLowerCase();

    // 🎯 TRAIT RARITY BONUS - Rarer traits = more power (premium collection gets balanced distribution)
    const rarityBonus = TraitRarityAnalyzer.calculateRarityPowerBonus("DANTES AURUM", allTraits);
    result.army_power += rarityBonus.totalBonus * 0.25; // 25% to each category
    result.religion_power += rarityBonus.totalBonus * 0.25;
    result.civilization_power += rarityBonus.totalBonus * 0.25;
    result.economic_power += rarityBonus.totalBonus * 0.25;

    // DANTES AURUM gets bonuses from ALL keywords
    const allKeywords = {
      army: ['sword', 'warrior', 'battle', 'combat', 'strength'],
      religion: ['divine', 'holy', 'blessed', 'faith', 'sacred'],
      civilization: ['wisdom', 'knowledge', 'culture', 'art', 'ancient'],
      economic: ['gold', 'wealth', 'treasure', 'coin', 'rich']
    };

    for (const [category, keywords] of Object.entries(allKeywords)) {
      for (const keyword of keywords) {
        if (fullText.includes(keyword)) {
          const power = 70;
          if (category === 'army') result.army_power += power;
          else if (category === 'religion') result.religion_power += power;
          else if (category === 'civilization') result.civilization_power += power;
          else if (category === 'economic') result.economic_power += power;
          
          result.special_powers.push(`${category}: ${keyword}`);
        }
      }
    }

    // Check for premium materials
    const material = this.detectMaterial(fullText);
    result.materials_found.push(material.name);
    result.material_multiplier = material.multiplier;

    // Check for rarity
    const rarity = this.detectRarity(fullText);
    result.rarities_found.push(rarity.level);
    result.rarity_multiplier = rarity.multiplier;

    for (const attr of attributes) {
      const traitType = String(attr.trait_type || '').toLowerCase();
      const value = String(attr.value || '');

      // DANTES AURUM gets balanced power from all traits
      result.army_power += this.extractNumericValue(value, 15);
      result.religion_power += this.extractNumericValue(value, 15);
      result.civilization_power += this.extractNumericValue(value, 15);
      result.economic_power += this.extractNumericValue(value, 15);

      result.trait_mapping[attr.trait_type || 'unknown'] = this.extractNumericValue(value, 40);
    }

    // Premium multiplier
    const totalRawPower = result.army_power + result.religion_power + result.civilization_power + result.economic_power;
    result.total_power = basePower + (totalRawPower * result.material_multiplier * result.rarity_multiplier);

    return result;
  }

  /**
   * FUZZY CUBS - Partner Collection
   * Support and buff-based power + TRAIT RARITY
   */
  static calculateFuzzyCubsPower(traits: NFTMetadata, allTraits: Record<string, any>): TraitPowerResult {
    const result: TraitPowerResult = {
      army_power: 0,
      religion_power: 0,
      civilization_power: 0,
      economic_power: 0,
      total_power: 0,
      special_powers: [],
      materials_found: [],
      rarities_found: [],
      trait_mapping: {},
      material_multiplier: 1.0,
      rarity_multiplier: 1.0
    };

    const attributes = traits.attributes || [];
    const basePower = 120;

    const fullText = JSON.stringify(traits).toLowerCase();

    // 🎯 TRAIT RARITY BONUS - Rarer traits = more power (support focused)
    const rarityBonus = TraitRarityAnalyzer.calculateRarityPowerBonus("Fuzzy Cubs", allTraits);
    result.civilization_power += rarityBonus.totalBonus * 0.5; // 50% to civilization (support)
    result.religion_power += rarityBonus.totalBonus * 0.5; // 50% to religion (healing)

    // Support/buff keywords
    const supportKeywords = ['heal', 'buff', 'support', 'boost', 'aid', 'help'];
    const cuteKeywords = ['cute', 'friendly', 'happy', 'cheerful', 'kind'];
    
    for (const keyword of supportKeywords) {
      if (fullText.includes(keyword)) {
        result.civilization_power += 50;
        result.religion_power += 30;
        result.special_powers.push(`Support: ${keyword}`);
      }
    }

    for (const keyword of cuteKeywords) {
      if (fullText.includes(keyword)) {
        result.civilization_power += 40;
      }
    }

    for (const attr of attributes) {
      const traitType = String(attr.trait_type || '').toLowerCase();
      const value = String(attr.value || '');

      // Fuzzy Cubs provide balanced support
      result.civilization_power += this.extractNumericValue(value, 25);
      result.religion_power += this.extractNumericValue(value, 20);

      result.trait_mapping[attr.trait_type || 'unknown'] = this.extractNumericValue(value, 25);
    }

    // Detect rarity
    const rarity = this.detectRarity(fullText);
    result.rarities_found.push(rarity.level);
    result.rarity_multiplier = rarity.multiplier;

    result.total_power = basePower + ((result.civilization_power + result.religion_power) * result.rarity_multiplier);
    return result;
  }

  /**
   * Helper: Extract numeric value from trait
   */
  private static extractNumericValue(value: string | number, defaultValue: number = 0): number {
    if (typeof value === 'number') return value;
    
    const numMatch = String(value).match(/(\d+)/);
    return numMatch ? parseInt(numMatch[1]) : defaultValue;
  }

  /**
   * Helper: Detect material from text
   */
  static detectMaterial(text: string): { name: string; multiplier: number } {
    const materials = {
      celestial: 20,
      adamantine: 15,
      mythril: 12,
      diamond: 10,
      platinum: 10,
      obsidian: 10,
      gold: 5,
      electrum: 3.5,
      silver: 3,
      steel: 2.5,
      iron: 2,
      copper: 1.5,
      bronze: 1.2,
      wood: 1
    };

    for (const [material, multiplier] of Object.entries(materials)) {
      if (text.includes(material)) {
        return { name: material, multiplier };
      }
    }

    return { name: 'common', multiplier: 1 };
  }

  /**
   * Helper: Detect rarity from text
   */
  static detectRarity(text: string): { level: string; multiplier: number } {
    const rarities = {
      godly: 15,
      unique: 10,
      'ultra rare': 8,
      mythic: 7,
      legendary: 5,
      epic: 3,
      'very rare': 2.5,
      rare: 2,
      uncommon: 1.5,
      common: 1
    };

    for (const [level, multiplier] of Object.entries(rarities)) {
      if (text.includes(level)) {
        return { level, multiplier };
      }
    }

    return { level: 'common', multiplier: 1 };
  }

  /**
   * Helper: Detect character class from traits and metadata
   * Used for battle type specialization
   */
  static detectCharacterClass(text: string, traits: Record<string, any>): string {
    const classKeywords = {
      warrior: ['warrior', 'knight', 'fighter', 'soldier', 'berserker', 'champion', 'crusader', 'gladiator'],
      priest: ['priest', 'cleric', 'paladin', 'monk', 'templar', 'friar', 'chaplain', 'holy'],
      wizard: ['wizard', 'mage', 'sorcerer', 'warlock', 'enchanter', 'magician', 'archmage'],
      scholar: ['scholar', 'sage', 'philosopher', 'scribe', 'historian', 'librarian', 'academic'],
      merchant: ['merchant', 'trader', 'banker', 'dealer', 'vendor', 'shopkeeper', 'broker'],
      assassin: ['assassin', 'rogue', 'thief', 'ninja', 'spy', 'shadow'],
      ranger: ['ranger', 'archer', 'hunter', 'scout', 'tracker', 'bowman'],
      druid: ['druid', 'shaman', 'nature', 'wild', 'forest'],
      bard: ['bard', 'minstrel', 'musician', 'performer', 'troubadour'],
      noble: ['noble', 'lord', 'king', 'queen', 'duke', 'baron', 'royal']
    };

    // Check traits first (more specific)
    const classValue = traits?.class || traits?.Class || traits?.character_class || traits?.role;
    if (classValue) {
      const classText = String(classValue).toLowerCase();
      for (const [charClass, keywords] of Object.entries(classKeywords)) {
        for (const keyword of keywords) {
          if (classText.includes(keyword)) {
            return charClass;
          }
        }
      }
    }

    // Check full text
    const lowerText = text.toLowerCase();
    for (const [charClass, keywords] of Object.entries(classKeywords)) {
      for (const keyword of keywords) {
        if (lowerText.includes(keyword)) {
          return charClass;
        }
      }
    }

    return 'fighter'; // default class
  }

  /**
   * Helper: Determine battle specialization based on character class
   * Warriors → army, Priests → religion, Scholars → civilization, Merchants → economic
   */
  static getBattleSpecialization(characterClass: string): string {
    const specializationMap: Record<string, string> = {
      warrior: 'army',
      knight: 'army',
      fighter: 'army',
      assassin: 'army',
      ranger: 'army',
      priest: 'religion',
      cleric: 'religion',
      paladin: 'religion',
      monk: 'religion',
      druid: 'religion',
      wizard: 'civilization',
      mage: 'civilization',
      sorcerer: 'civilization',
      scholar: 'civilization',
      sage: 'civilization',
      bard: 'civilization',
      merchant: 'economic',
      trader: 'economic',
      banker: 'economic',
      noble: 'civilization'
    };

    return specializationMap[characterClass] || 'army';
  }

  /**
   * Route to correct calculator based on collection
   */
  static calculatePowerForCollection(
    collectionName: string,
    traits: NFTMetadata,
    allTraits: Record<string, any>
  ): TraitPowerResult {
    switch (collectionName) {
      case 'The Inquiry':
        return this.calculateInquiryPower(traits, allTraits);
      case 'The Inquisition':
        return this.calculateInquisitionPower(traits, allTraits);
      case 'Under the Bridge: Troll':
        return this.calculateUnderBridgePower(traits, allTraits);
      case 'The Lost Emporium':
        return this.calculateLostEmporiumPower(traits, allTraits);
      case 'DANTES AURUM':
        return this.calculateDantesAurumPower(traits, allTraits);
      case 'Fuzzy Cubs':
        return this.calculateFuzzyCubsPower(traits, allTraits);
      default:
        // Default generic calculator
        return this.calculateInquisitionPower(traits, allTraits);
    }
  }
}

/**
 * Main Scanner Function
 */
export async function scanAllCollections(): Promise<{
  success: boolean;
  collections_scanned: number;
  total_nfts_found: number;
  errors: string[];
}> {
  console.log('🚀 [COMPREHENSIVE SCANNER] Starting full collection scan...');
  
  const errors: string[] = [];
  let totalNftsFound = 0;
  let collectionsScanned = 0;

  try {
    // STEP 1: Scan all NFTs and store metadata
    const collections = await db.select().from(inquisitionCollections);
    console.log(`📊 [SCANNER] Found ${collections.length} collections to scan`);

    for (const collection of collections) {
      try {
        console.log(`\n🎯 [SCANNER] Scanning: ${collection.collection_name}`);
        console.log(`   Issuer: ${collection.issuer_address}, Taxon: ${collection.taxon}`);

        const scanResult = await scanSingleCollection(collection);
        
        if (scanResult.success) {
          totalNftsFound += scanResult.nfts_found;
          collectionsScanned++;
          console.log(`✅ [SCANNER] ${collection.collection_name}: ${scanResult.nfts_found} NFTs processed`);
        } else {
          errors.push(`${collection.collection_name}: ${scanResult.error}`);
          console.error(`❌ [SCANNER] Failed to scan ${collection.collection_name}:`, scanResult.error);
        }
      } catch (collectionError: any) {
        const errorMsg = `${collection.collection_name}: ${collectionError.message}`;
        errors.push(errorMsg);
        console.error(`❌ [SCANNER] Collection error:`, collectionError);
      }
    }

    console.log(`\n🎉 [SCANNER] Scan complete! ${collectionsScanned}/${collections.length} collections scanned`);
    console.log(`📊 [SCANNER] Total NFTs found: ${totalNftsFound}`);

    // STEP 2: Analyze trait rarity AFTER all NFTs are scanned and stored
    console.log('\n🎯 [TRAIT RARITY] Step 2: Analyzing trait rarity percentages with fresh data...');
    await TraitRarityAnalyzer.analyzeAllCollections();
    console.log('✅ [TRAIT RARITY] Rarity analysis complete - power calculations now use actual trait percentages!\n');

    // STEP 3: Re-scan all NFTs with updated rarity-based power
    console.log('\n🔄 [POWER RECALCULATION] Step 3: Recalculating power for all NFTs with rarity bonuses...');
    for (const collection of collections) {
      try {
        console.log(`   🔄 Recalculating power for: ${collection.collection_name}`);
        const scanResult = await scanSingleCollection(collection);
        if (scanResult.success) {
          console.log(`   ✅ Power recalculated for ${scanResult.nfts_updated} NFTs`);
        }
      } catch (error: any) {
        console.error(`   ❌ Failed to recalculate power for ${collection.collection_name}:`, error.message);
      }
    }
    console.log('✅ [POWER RECALCULATION] All NFTs now have rarity-based power levels!\n');

    return {
      success: errors.length === 0,
      collections_scanned: collectionsScanned,
      total_nfts_found: totalNftsFound,
      errors
    };

  } catch (error: any) {
    console.error('❌ [SCANNER] Fatal error:', error);
    return {
      success: false,
      collections_scanned: 0,
      total_nfts_found: 0,
      errors: [error.message]
    };
  }
}

/**
 * Scan a single collection
 */
async function scanSingleCollection(collection: any): Promise<{
  success: boolean;
  nfts_found: number;
  nfts_new: number;
  nfts_updated: number;
  error?: string;
}> {
  const startTime = Date.now();
  let nftsFound = 0;
  let nftsNew = 0;
  let nftsUpdated = 0;
  let nfts: any[] = [];

  try {
    // Use Bithomp API to fetch entire collection (same as marketplace)
    const apiUrl = `https://bithomp.com/api/v2/nfts?issuer=${collection.issuer_address}&taxon=${collection.taxon}&limit=1000&metadata=true`;
    console.log(`� [SCANNER] Fetching from Bithomp: ${collection.collection_name}`);

    // Check if we have a valid API key
    if (!process.env.BITHOMP_API_KEY || !process.env.BITHOMP_API_KEY.trim()) {
      console.log(`⚠️ [SCANNER] No Bithomp API key - skipping fetch for ${collection.collection_name}`);
      console.log(`ℹ️ [SCANNER] Using existing database records for power calculations`);
      return {
        success: true,
        nfts_found: 0,
        nfts_new: 0,
        nfts_updated: 0,
        error: 'No API key - using existing data'
      };
    }

    const headers: any = {
      'Content-Type': 'application/json',
      'x-bithomp-token': process.env.BITHOMP_API_KEY.trim()
    };

    const response = await fetch(apiUrl, { headers });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No error text');
      console.error(`❌ [SCANNER] Bithomp error ${response.status}: ${errorText}`);
      console.log(`ℹ️ [SCANNER] Continuing with existing database records`);
      return {
        success: true,
        nfts_found: 0,
        nfts_new: 0,
        nfts_updated: 0,
        error: `Bithomp API error: ${response.status}`
      };
    }

    const data = await response.json();
    nfts = data.nfts || [];
    nftsFound = nfts.length;

    console.log(`📦 [SCANNER] Found ${nftsFound} NFTs for ${collection.collection_name}`);

    // Process each NFT
    for (const nft of nfts) {
      try {
        const nftTokenId = nft.nftokenID || nft.NFTokenID;
        
        if (!nftTokenId) {
          console.warn(`⚠️ [SCANNER] Skipping NFT without token ID`);
          continue;
        }

        // Fetch full metadata
        const metadata = nft.metadata || {};
        const traits = metadata.attributes || metadata.traits || [];

        // Convert traits array to object
        const allTraits: Record<string, any> = {};
        if (Array.isArray(traits)) {
          for (const trait of traits) {
            if (trait.trait_type) {
              allTraits[trait.trait_type] = trait.value;
            }
          }
        }

        // Calculate power using collection-specific calculator
        const powerResult = PowerCalculators.calculatePowerForCollection(
          collection.collection_name,
          metadata,
          allTraits
        );

        // Extract character class and material (ALL collections)
        const fullText = JSON.stringify(metadata).toLowerCase();
        const material = PowerCalculators.detectMaterial(fullText);
        const characterClass = PowerCalculators.detectCharacterClass(fullText, allTraits);
        const battleSpec = PowerCalculators.getBattleSpecialization(characterClass);

        // Check if NFT exists
        const existing = await db.query.inquisitionNftAudit.findFirst({
          where: eq(inquisitionNftAudit.nft_token_id, nftTokenId)
        });

        if (existing) {
          // Update existing NFT
          await db.update(inquisitionNftAudit)
            .set({ 
              current_owner: nft.owner || nft.Owner,
              owner_updated_at: new Date(),
              full_metadata: metadata,
              traits: allTraits,
              trait_points: Math.round(powerResult.army_power + powerResult.religion_power + powerResult.civilization_power + powerResult.economic_power),
              total_points: Math.round(powerResult.total_power),
              power_strength: String(Math.round(powerResult.army_power)),
              power_defense: String(Math.round(powerResult.army_power)),
              power_magic: String(Math.round(powerResult.religion_power)),
              power_speed: String(Math.round(powerResult.civilization_power)),
              rarity_multiplier: String(powerResult.rarity_multiplier),
              material_type: material.name,
              character_class: characterClass,
              battle_specialization: battleSpec,
              last_updated_at: new Date()
             } as any)
            .where(eq(inquisitionNftAudit.nft_token_id, nftTokenId));
          
          nftsUpdated++;
        } else {
          // Insert new NFT
          await (db.insert(inquisitionNftAudit) as any).values({
            collection_id: collection.id,
            nft_token_id: nftTokenId,
            sequence_number: nft.sequence || 0,
            issuer_address: collection.issuer_address,
            taxon: collection.taxon,
            current_owner: nft.owner || nft.Owner,
            owner_updated_at: new Date(),
            name: metadata.name || `${collection.collection_name} #${nft.sequence}`,
            description: metadata.description,
            image_url: metadata.image,
            metadata_uri: nft.uri || nft.URI,
            full_metadata: metadata,
            traits: allTraits,
            trait_points: Math.round(powerResult.army_power + powerResult.religion_power + powerResult.civilization_power + powerResult.economic_power),
            total_points: Math.round(powerResult.total_power),
            power_strength: String(Math.round(powerResult.army_power)),
            power_defense: String(Math.round(powerResult.army_power)),
            power_magic: String(Math.round(powerResult.religion_power)),
            power_speed: String(Math.round(powerResult.civilization_power)),
            rarity_multiplier: String(powerResult.rarity_multiplier),
            material_type: material.name,
            character_class: characterClass,
            battle_specialization: battleSpec,
            scan_source: 'comprehensive_scan'
          });
          
          nftsNew++;
        }

        // Also create/update nftPowerAttributes for game integration
        const ownerAddress = nft.owner || nft.Owner || metadata.owner || '';
        await upsertPowerAttributes(nftTokenId, collection, powerResult, allTraits, metadata, ownerAddress);

      } catch (nftError: any) {
        console.error(`❌ [SCANNER] Error processing NFT:`, nftError);
      }
    }

    // Update collection stats
    await db.update(inquisitionCollections)
      .set({ 
        actual_supply: nftsFound,
        last_scanned_at: new Date(),
        scan_status: 'completed',
        total_mints_tracked: nftsFound,
        updated_at: new Date()
       } as any)
      .where(eq(inquisitionCollections.id, collection.id));

    // Record scan history
    await db.insert(inquisitionScanHistory).values({
      collection_id: collection.id,
      scan_started_at: new Date(startTime as any),
      scan_completed_at: new Date(),
      scan_status: 'completed',
      nfts_found: nftsFound,
      nfts_new: nftsNew,
      nfts_updated: nftsUpdated,
      nfts_errors: 0,
      scan_duration_ms: Date.now() - startTime,
      api_calls_made: 1
    });

    return {
      success: true,
      nfts_found: nftsFound,
      nfts_new: nftsNew,
      nfts_updated: nftsUpdated
    };

  } catch (error: any) {
    console.error(`❌ [SCANNER] Error scanning collection:`, error);
    
    // Record failed scan
    await db.insert(inquisitionScanHistory).values({
      collection_id: collection.id,
      scan_started_at: new Date(startTime as any),
      scan_completed_at: new Date(),
      scan_status: 'failed',
      nfts_found: 0,
      nfts_new: 0,
      nfts_updated: 0,
      nfts_errors: 1,
      error_message: error.message,
      error_details: { stack: error.stack },
      scan_duration_ms: Date.now() - startTime
    });

    return {
      success: false,
      nfts_found: 0,
      nfts_new: 0,
      nfts_updated: 0,
      error: error.message
    };
  }
}

/**
 * Upsert power attributes for game integration
 */
async function upsertPowerAttributes(
  nftTokenId: string,
  collection: any,
  powerResult: TraitPowerResult,
  allTraits: Record<string, any>,
  metadata: any,
  ownerAddress: string
) {
  // Check if gaming NFT exists
  let gamingNft = await db.query.gamingNfts.findFirst({
    where: eq(gamingNfts.token_id, nftTokenId)
  });

  if (!gamingNft) {
    // Get or create matching gaming collection
    // gaming_nft_collections.collection_id uses format: {issuer}:{taxon}
    const { gamingNftCollections } = await import('../shared/schema');
    const collectionIdentifier = `${collection.issuer_address}:${collection.taxon}`;
    
    let gamingCollection = await db.query.gamingNftCollections.findFirst({
      where: eq(gamingNftCollections.collection_id, collectionIdentifier)
    });

    // If gaming collection doesn't exist, auto-create it from inquisition_collections
    if (!gamingCollection) {
      console.log(`📦 [SCANNER] Auto-creating gaming collection for ${collectionIdentifier}`);
      
      // Map inquisition game_role to gaming power_level
      const powerLevelMap: Record<string, number> = {
        'special': 10,
        'power': 9,
        'army': 8,
        'merchant': 4,
        'bank': 3,
        'partner': 2
      };
      
      const inserted = await db.insert(gamingNftCollections).values({
        collection_id: collectionIdentifier,
        collection_name: collection.collection_name,
        taxon: collection.taxon,
        chain: 'xrpl',
        game_role: collection.game_role || 'partner',
        role_description: `Auto-generated from ${collection.collection_name}`,
        power_level: powerLevelMap[collection.game_role] || 2,
        collection_verified: true
      } as any).returning();
      
      gamingCollection = inserted[0];
      console.log(`✅ [SCANNER] Created gaming collection: ${collection.collection_name}`);
    }

    // Create full NFT ID
    const nftId = `${collection.issuer_address}+${collection.taxon}+${nftTokenId}`;

    // Create gaming NFT entry with all required fields
    const inserted = await db.insert(gamingNfts).values({
      collection_id: gamingCollection.id, // CRITICAL: Must include collection_id
      token_id: nftTokenId,
      nft_id: nftId,
      owner_address: ownerAddress,
      name: metadata.name || `${collection.collection_name} NFT`,
      image_url: metadata.image,
      metadata: metadata,
      traits: allTraits
    } as any).returning();
    gamingNft = inserted[0];
  }

  // Upsert power attributes
  const existing = await db.query.nftPowerAttributes.findFirst({
    where: eq(nftPowerAttributes.nft_id, gamingNft.id)
  });

  const powerData = {
    nft_id: gamingNft.id,
    collection_id: collection.id.toString(),
    owner_address: ownerAddress || 'unknown',
    army_power: String(powerResult.army_power),
    religion_power: String(powerResult.religion_power),
    civilization_power: String(powerResult.civilization_power),
    economic_power: String(powerResult.economic_power),
    total_power: String(powerResult.total_power),
    all_traits: allTraits,
    special_powers: powerResult.special_powers,
    materials_found: powerResult.materials_found,
    rarities_found: powerResult.rarities_found,
    trait_mapping: powerResult.trait_mapping,
    material_multiplier: String(powerResult.material_multiplier),
    rarity_multiplier: String(powerResult.rarity_multiplier),
    last_updated: new Date()
  };

  if (existing) {
    await db.update(nftPowerAttributes)
      .set(powerData)
      .where(eq(nftPowerAttributes.id, existing.id));
  } else {
    await db.insert(nftPowerAttributes).values(powerData as any);
  }
}

/**
 * Scan single player's owned NFTs and aggregate power
 */
export async function scanPlayerNFTs(walletAddress: string, userHandle?: string): Promise<{
  success: boolean;
  total_power: number;
  nfts_owned: number;
  power_breakdown: {
    army_power: number;
    religion_power: number;
    civilization_power: number;
    economic_power: number;
  };
}> {
  console.log(`🔍 [PLAYER SCAN] Scanning NFTs for player: ${userHandle || walletAddress}`);

  try {
    // Get all NFTs owned by this player
    const ownedNfts = await db.query.inquisitionNftAudit.findMany({
      where: eq(inquisitionNftAudit.current_owner, walletAddress)
    });

    console.log(`📦 [PLAYER SCAN] Found ${ownedNfts.length} owned NFTs`);

    let totalArmyPower = 0;
    let totalReligionPower = 0;
    let totalCivilizationPower = 0;
    let totalEconomicPower = 0;

    for (const nft of ownedNfts) {
      totalArmyPower += parseFloat(String(nft.power_strength || 0));
      totalReligionPower += parseFloat(String(nft.power_magic || 0));
      totalCivilizationPower += parseFloat(String(nft.power_speed || 0));
      totalEconomicPower += parseFloat(String(nft.power_defense || 0)); // Using defense for economic
    }

    const totalPower = totalArmyPower + totalReligionPower + totalCivilizationPower + totalEconomicPower;

    // Update player's gaming profile
    if (userHandle) {
      const existingPlayer = await db.query.gamingPlayers.findFirst({
        where: eq(gamingPlayers.user_handle, userHandle)
      });

      if (existingPlayer) {
        await db.update(gamingPlayers)
          .set({ 
            army_power: String(totalArmyPower),
            religion_power: String(totalReligionPower),
            civilization_power: String(totalCivilizationPower),
            economic_power: String(totalEconomicPower),
            total_power_level: String(totalPower)
           } as any)
          .where(eq(gamingPlayers.user_handle, userHandle));
      }
    }

    return {
      success: true,
      total_power: totalPower,
      nfts_owned: ownedNfts.length,
      power_breakdown: {
        army_power: totalArmyPower,
        religion_power: totalReligionPower,
        civilization_power: totalCivilizationPower,
        economic_power: totalEconomicPower
      }
    };

  } catch (error: any) {
    console.error(`❌ [PLAYER SCAN] Error:`, error);
    return {
      success: false,
      total_power: 0,
      nfts_owned: 0,
      power_breakdown: {
        army_power: 0,
        religion_power: 0,
        civilization_power: 0,
        economic_power: 0
      }
    };
  }
}
