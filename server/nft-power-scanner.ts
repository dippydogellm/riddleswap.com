import { db } from "./db";
import { gamingNfts, nftPowerAttributes, gamingPlayers } from "../shared/schema";
import { eq, and } from "drizzle-orm";

/**
 * NFT Power Scanner - Enhanced with Material & Rarity Scoring
 * Scans NFT metadata to determine power contributions:
 * - ⚔️ Army Power (military strength)
 * - ⛪ Religion Power (religious influence)
 * - 🏰 Civilization Power (cultural development)
 * - 💰 Economic Power (wealth and trade)
 * 
 * Enhanced Features:
 * - Material Multipliers (copper=1x, iron=2x, silver=3x, gold=5x, diamond/platinum=10x)
 * - Rarity Multipliers (common=1x, uncommon=1.5x, rare=2x, epic=3x, legendary=5x)
 */

interface PowerBreakdown {
  army_power: number;
  religion_power: number;
  civilization_power: number;
  economic_power: number;
  total_power: number;
  trait_mapping: Record<string, number>;
  character_class?: string;
  class_confidence?: number;
  special_powers?: string[];
  materials_found?: string[];
  rarities_found?: string[];
  keywords_detected?: {
    army: string[];
    religion: string[];
    civilization: string[];
    economic: string[];
  };
}

interface MaterialInfo {
  name: string;
  multiplier: number;
}

interface RarityInfo {
  level: string;
  multiplier: number;
}

/**
 * Detect material from NFT traits/metadata
 */
function detectMaterial(metadata: Record<string, any>, traits: Record<string, any>): MaterialInfo {
  const materialKeywords = {
    wood: 1,
    bronze: 1.2,
    copper: 1.5,
    iron: 2,
    steel: 2.5,
    silver: 3,
    electrum: 3.5,
    gold: 5,
    platinum: 10,
    diamond: 10,
    obsidian: 10,
    mythril: 12,
    adamantine: 15,
    celestial: 20
  };

  const fullText = `${JSON.stringify(metadata)} ${JSON.stringify(traits)}`.toLowerCase();
  
  // Check for materials in order of value (highest first)
  const sortedMaterials = Object.entries(materialKeywords)
    .sort(([, a], [, b]) => b - a);
  
  for (const [material, multiplier] of sortedMaterials) {
    if (fullText.includes(material)) {
      console.log(`🔍 Detected material: ${material} (${multiplier}x)`);
      return { name: material, multiplier };
    }
  }
  
  return { name: 'common', multiplier: 1 };
}

/**
 * Detect rarity from NFT traits/metadata
 */
function detectRarity(metadata: Record<string, any>, traits: Record<string, any>): RarityInfo {
  const rarityLevels = {
    common: 1,
    uncommon: 1.5,
    rare: 2,
    'very rare': 2.5,
    epic: 3,
    legendary: 5,
    mythic: 7,
    'ultra rare': 8,
    unique: 10,
    godly: 15
  };

  const fullText = `${JSON.stringify(metadata)} ${JSON.stringify(traits)}`.toLowerCase();
  
  // Check traits first for rarity attribute
  if (traits) {
    for (const [key, value] of Object.entries(traits)) {
      const keyLower = String(key).toLowerCase();
      const valueLower = String(value).toLowerCase();
      
      if (keyLower.includes('rarity') || keyLower === 'tier' || keyLower === 'rank') {
        for (const [level, multiplier] of Object.entries(rarityLevels).reverse()) {
          if (valueLower.includes(level)) {
            console.log(`🌟 Detected rarity from traits: ${level} (${multiplier}x)`);
            return { level, multiplier };
          }
        }
      }
    }
  }
  
  // Check metadata attributes array
  if (metadata.attributes && Array.isArray(metadata.attributes)) {
    for (const attr of metadata.attributes) {
      if (attr.trait_type?.toLowerCase() === 'rarity' || attr.trait_type?.toLowerCase() === 'tier') {
        const valueLower = String(attr.value).toLowerCase();
        for (const [level, multiplier] of Object.entries(rarityLevels).reverse()) {
          if (valueLower.includes(level)) {
            console.log(`🌟 Detected rarity from attributes: ${level} (${multiplier}x)`);
            return { level, multiplier };
          }
        }
      }
    }
  }
  
  // Fallback: scan entire text
  for (const [level, multiplier] of Object.entries(rarityLevels).reverse()) {
    if (fullText.includes(level)) {
      console.log(`🌟 Detected rarity from full scan: ${level} (${multiplier}x)`);
      return { level, multiplier };
    }
  }
  
  return { level: 'common', multiplier: 1 };
}

/**
 * Determine character class based on dominant power types
 * Classes:
 * - Warrior: High Army power
 * - Priest: High Religion power
 * - Merchant: High Economic power
 * - Knight: Army + Civilization
 * - Sage: Religion + Civilization
 * - Lord: Civilization + Economic
 * - Champion: Balanced across all types
 */
function determineCharacterClass(
  army: number,
  religion: number,
  civilization: number,
  economic: number
): { character_class: string; class_confidence: number } {
  const powers = { army, religion, civilization, economic };
  const total = army + religion + civilization + economic;
  
  if (total === 0) {
    return { character_class: 'unknown', class_confidence: 0 };
  }
  
  // Calculate percentages
  const armyPct = (army / total) * 100;
  const religionPct = (religion / total) * 100;
  const civPct = (civilization / total) * 100;
  const economicPct = (economic / total) * 100;
  
  // Find dominant powers (>30%)
  const dominant: string[] = [];
  if (armyPct > 30) dominant.push('army');
  if (religionPct > 30) dominant.push('religion');
  if (civPct > 30) dominant.push('civilization');
  if (economicPct > 30) dominant.push('economic');
  
  // Calculate balance score (how evenly distributed the powers are)
  const avg = 25; // Perfect balance would be 25% each
  const balanceScore = 100 - Math.sqrt(
    Math.pow(armyPct - avg, 2) +
    Math.pow(religionPct - avg, 2) +
    Math.pow(civPct - avg, 2) +
    Math.pow(economicPct - avg, 2)
  ) / 2;
  
  // Determine class based on dominant powers
  let characterClass = 'unknown';
  let confidence = 0;
  
  if (dominant.length === 0 || balanceScore > 70) {
    // Balanced/Champion class - all powers roughly equal
    characterClass = 'champion';
    confidence = balanceScore;
  } else if (dominant.length === 1) {
    // Single dominant power
    const dom = dominant[0];
    const maxPct = Math.max(armyPct, religionPct, civPct, economicPct);
    confidence = Math.min(maxPct, 95);
    
    if (dom === 'army') characterClass = 'warrior';
    else if (dom === 'religion') characterClass = 'priest';
    else if (dom === 'civilization') characterClass = 'lord';
    else if (dom === 'economic') characterClass = 'merchant';
  } else if (dominant.length === 2) {
    // Dual class
    confidence = 75;
    const combo = dominant.sort().join('-');
    
    if (combo === 'army-civilization') characterClass = 'knight';
    else if (combo === 'civilization-religion') characterClass = 'sage';
    else if (combo === 'civilization-economic') characterClass = 'lord';
    else if (combo === 'army-religion') characterClass = 'paladin';
    else if (combo === 'army-economic') characterClass = 'mercenary';
    else if (combo === 'economic-religion') characterClass = 'templar';
    else characterClass = 'hybrid';
  } else if (dominant.length >= 3) {
    // Balanced across multiple powers
    characterClass = 'champion';
    confidence = 70;
  }
  
  console.log(`🎭 Character Class: ${characterClass} (${confidence.toFixed(0)}% confidence)`);
  console.log(`   Army: ${armyPct.toFixed(0)}%, Religion: ${religionPct.toFixed(0)}%, Civ: ${civPct.toFixed(0)}%, Economic: ${economicPct.toFixed(0)}%`);
  
  return { character_class: characterClass, class_confidence: confidence };
}

/**
 * Parse {material} {class} pattern from Inquisition NFT names
 * Example: "{Gold} {Warrior}" -> material: gold (5x), class: warrior (army power)
 */
function parseInquisitionNamePattern(nftName: string): {
  material?: MaterialInfo;
  classType?: string;
  powerType?: 'army' | 'religion' | 'civilization' | 'economic';
  classMultiplier?: number;
} {
  if (!nftName) return {};
  
  // Parse {material} {class} pattern
  const materialMatch = nftName.match(/\{([^}]+)\}/);
  const classMatch = nftName.match(/\{[^}]+\}\s*\{([^}]+)\}/);
  
  const result: any = {};
  
  // Material mapping (balanced multipliers)
  const materialMap: Record<string, number> = {
    wood: 1,
    bronze: 1.2,
    copper: 1.3,
    iron: 1.5,
    steel: 2,
    silver: 3,
    electrum: 3.5,
    gold: 5,
    platinum: 6,
    diamond: 6,
    obsidian: 6,
    mythril: 7,
    adamantine: 8,
    celestial: 10
  };
  
  // Class to power type mapping (balanced multipliers 1.2x to 1.5x)
  const classToPowerMap: Record<string, { powerType: 'army' | 'religion' | 'civilization' | 'economic'; multiplier: number }> = {
    // Army/Fighter classes
    warrior: { powerType: 'army', multiplier: 1.4 },
    fighter: { powerType: 'army', multiplier: 1.3 },
    soldier: { powerType: 'army', multiplier: 1.2 },
    knight: { powerType: 'army', multiplier: 1.4 },
    berserker: { powerType: 'army', multiplier: 1.5 },
    champion: { powerType: 'army', multiplier: 1.5 },
    gladiator: { powerType: 'army', multiplier: 1.3 },
    
    // Religious classes
    priest: { powerType: 'religion', multiplier: 1.4 },
    cleric: { powerType: 'religion', multiplier: 1.3 },
    monk: { powerType: 'religion', multiplier: 1.2 },
    bishop: { powerType: 'religion', multiplier: 1.4 },
    cardinal: { powerType: 'religion', multiplier: 1.5 },
    prophet: { powerType: 'religion', multiplier: 1.5 },
    oracle: { powerType: 'religion', multiplier: 1.4 },
    templar: { powerType: 'religion', multiplier: 1.3 },
    paladin: { powerType: 'religion', multiplier: 1.4 },
    
    // Economic/Trade classes
    merchant: { powerType: 'economic', multiplier: 1.4 },
    trader: { powerType: 'economic', multiplier: 1.3 },
    banker: { powerType: 'economic', multiplier: 1.4 },
    tycoon: { powerType: 'economic', multiplier: 1.5 },
    mogul: { powerType: 'economic', multiplier: 1.5 },
    dealer: { powerType: 'economic', multiplier: 1.2 },
    
    // Civilization/Culture classes
    scholar: { powerType: 'civilization', multiplier: 1.3 },
    sage: { powerType: 'civilization', multiplier: 1.4 },
    lord: { powerType: 'civilization', multiplier: 1.4 },
    noble: { powerType: 'civilization', multiplier: 1.3 },
    king: { powerType: 'civilization', multiplier: 1.5 },
    emperor: { powerType: 'civilization', multiplier: 1.5 },
    diplomat: { powerType: 'civilization', multiplier: 1.3 },
  };
  
  // Parse material
  if (materialMatch && materialMatch[1]) {
    const materialName = materialMatch[1].toLowerCase();
    for (const [mat, mult] of Object.entries(materialMap)) {
      if (materialName.includes(mat)) {
        result.material = { name: mat, multiplier: mult };
        console.log(`🔱 [Inquisition] Parsed material from name: ${mat} (${mult}x)`);
        break;
      }
    }
  }
  
  // Parse class
  if (classMatch && classMatch[1]) {
    const className = classMatch[1].toLowerCase();
    for (const [cls, info] of Object.entries(classToPowerMap)) {
      if (className.includes(cls)) {
        result.classType = cls;
        result.powerType = info.powerType;
        result.classMultiplier = info.multiplier;
        console.log(`⚔️ [Inquisition] Parsed class from name: ${cls} -> ${info.powerType} power (${info.multiplier}x)`);
        break;
      }
    }
  }
  
  return result;
}

/**
 * Extract special powers from NFT traits/metadata
 */
function extractSpecialPowers(metadata: Record<string, any>, traits: Record<string, any>): string[] {
  const specialPowers: string[] = [];
  const powerKeywords = ['power', 'ability', 'skill', 'special', 'magic', 'spell', 'talent', 'feat'];
  
  // Check traits
  if (traits) {
    for (const [key, value] of Object.entries(traits)) {
      const keyLower = String(key).toLowerCase();
      const valueLower = String(value).toLowerCase();
      
      for (const keyword of powerKeywords) {
        if (keyLower.includes(keyword) || valueLower.includes(keyword)) {
          specialPowers.push(`${key}: ${value}`);
          break;
        }
      }
    }
  }
  
  // Check metadata attributes
  if (metadata.attributes && Array.isArray(metadata.attributes)) {
    for (const attr of metadata.attributes) {
      const traitType = String(attr.trait_type || '').toLowerCase();
      for (const keyword of powerKeywords) {
        if (traitType.includes(keyword)) {
          specialPowers.push(`${attr.trait_type}: ${attr.value}`);
          break;
        }
      }
    }
  }
  
  return [...new Set(specialPowers)]; // Remove duplicates
}

/**
 * Calculate power levels from NFT metadata/traits with enhanced scoring
 */
export function calculatePowerFromMetadata(
  metadata: Record<string, any>, 
  traits: Record<string, any>,
  nftName?: string,
  collectionName?: string
): PowerBreakdown {
  let army_power = 0;
  let religion_power = 0;
  let civilization_power = 0;
  let economic_power = 0;
  const trait_mapping: Record<string, number> = {};
  const keywords_detected = {
    army: [] as string[],
    religion: [] as string[],
    civilization: [] as string[],
    economic: [] as string[]
  };

  // Detect material and rarity multipliers
  let material = detectMaterial(metadata, traits);
  let rarity = detectRarity(metadata, traits);
  
  // Extract special powers
  const special_powers = extractSpecialPowers(metadata, traits);
  
  // Parse Inquisition-specific {material} {class} pattern
  let inquisitionBonus = 0;
  let inquisitionParsed = null;
  
  // Safe collection name extraction
  const collStr = String(collectionName || '');
  const metaCollStr = typeof metadata.collection === 'string' 
    ? metadata.collection 
    : String((metadata.collection as any)?.name || '');
  const isInquisitionCollection = collStr.toLowerCase().includes('inquisition') || 
                                   metaCollStr.toLowerCase().includes('inquisition');
  
  if (isInquisitionCollection) {
    // Cap rarity at 5x for balanced Inquisition multipliers (max 10×5×1.5 = 75x)
    if (rarity.multiplier > 5) {
      rarity = { level: 'legendary', multiplier: 5 };
      console.log(`🔱 [Inquisition] Capping rarity to 5x for balance`);
    }
    
    // Cap material at 10x even when parsed from metadata (not name)
    if (material.multiplier > 10) {
      material = { name: material.name, multiplier: 10 };
      console.log(`🔱 [Inquisition] Capping material to 10x for balance`);
    }
    
    if (nftName) {
      inquisitionParsed = parseInquisitionNamePattern(nftName);
      
      // Override material if found in name
      if (inquisitionParsed.material) {
        material = inquisitionParsed.material;
        // Re-apply 10x cap for defense-in-depth
        if (material.multiplier > 10) {
          material = { name: material.name, multiplier: 10 };
        }
        console.log(`🔱 [Inquisition] Using material from name: ${material.name} (${material.multiplier}x)`);
      }
      
      // Apply class-specific power boost
      if (inquisitionParsed.powerType && inquisitionParsed.classMultiplier) {
        inquisitionBonus = 100 * material.multiplier * rarity.multiplier * inquisitionParsed.classMultiplier;
        // Enforce 75x ceiling: max bonus = 100 × 10 × 5 × 1.5 = 7500
        inquisitionBonus = Math.min(inquisitionBonus, 7500);
        console.log(`⚔️ [Inquisition] Applying class bonus: ${inquisitionParsed.classType} -> +${Math.floor(inquisitionBonus)} to ${inquisitionParsed.powerType}`);
      }
    }
  }
  
  console.log(`📊 Power calculation - Material: ${material.name} (${material.multiplier}x), Rarity: ${rarity.level} (${rarity.multiplier}x)`);
  if (special_powers.length > 0) {
    console.log(`✨ Special Powers Found: ${special_powers.join(', ')}`);
  }

  // Define power keywords and their contributions
  const powerKeywords = {
    army: [
      'warrior', 'knight', 'soldier', 'general', 'commander', 'military', 
      'battle', 'sword', 'armor', 'shield', 'weapon', 'army', 'legion', 
      'guard', 'fighter', 'cavalry', 'spear', 'axe', 'bow', 'archer',
      'gladiator', 'centurion', 'paladin', 'crusader', 'samurai', 'ninja',
      'barbarian', 'berserker', 'champion', 'warlord', 'veteran'
    ],
    religion: [
      'priest', 'monk', 'bishop', 'cardinal', 'holy', 'divine', 'sacred', 
      'temple', 'church', 'faith', 'prayer', 'cross', 'angel', 'saint', 
      'blessed', 'religious', 'cleric', 'zealot', 'pilgrim', 'oracle',
      'prophet', 'missionary', 'inquisitor', 'crusader', 'martyr', 'mystic',
      'shaman', 'druid', 'ritualist', 'acolyte'
    ],
    civilization: [
      'king', 'queen', 'noble', 'lord', 'duke', 'count', 'royal', 'crown', 
      'throne', 'castle', 'palace', 'civilization', 'culture', 'architect', 
      'builder', 'artisan', 'emperor', 'empress', 'prince', 'princess',
      'baron', 'viscount', 'marquis', 'magistrate', 'regent', 'sovereign',
      'scholar', 'sage', 'historian', 'scribe'
    ],
    economic: [
      'merchant', 'trader', 'banker', 'gold', 'coin', 'wealth', 'rich', 
      'treasure', 'trade', 'market', 'commerce', 'economic', 'financial', 
      'jewel', 'diamond', 'valuable', 'platinum', 'silver', 'guilder',
      'moneylender', 'investor', 'entrepreneur', 'tycoon', 'magnate',
      'collector', 'curator', 'appraiser', 'gem', 'ruby', 'sapphire'
    ]
  };

  // Scan traits for power indicators
  if (traits) {
    Object.entries(traits).forEach(([key, value]) => {
      const traitStr = `${key} ${value}`.toLowerCase();
      
      // Base score for keyword match
      const baseScore = 10;
      
      // Check for army keywords
      powerKeywords.army.forEach(keyword => {
        if (traitStr.includes(keyword)) {
          const contribution = baseScore * material.multiplier * rarity.multiplier;
          army_power += contribution;
          trait_mapping[`${key}:${value} (Army)`] = contribution;
          if (!keywords_detected.army.includes(keyword)) {
            keywords_detected.army.push(keyword);
          }
        }
      });
      
      // Check for religion keywords
      powerKeywords.religion.forEach(keyword => {
        if (traitStr.includes(keyword)) {
          const contribution = baseScore * material.multiplier * rarity.multiplier;
          religion_power += contribution;
          trait_mapping[`${key}:${value} (Religion)`] = contribution;
          if (!keywords_detected.religion.includes(keyword)) {
            keywords_detected.religion.push(keyword);
          }
        }
      });
      
      // Check for civilization keywords
      powerKeywords.civilization.forEach(keyword => {
        if (traitStr.includes(keyword)) {
          const contribution = baseScore * material.multiplier * rarity.multiplier;
          civilization_power += contribution;
          trait_mapping[`${key}:${value} (Civilization)`] = contribution;
          if (!keywords_detected.civilization.includes(keyword)) {
            keywords_detected.civilization.push(keyword);
          }
        }
      });
      
      // Check for economic keywords
      powerKeywords.economic.forEach(keyword => {
        if (traitStr.includes(keyword)) {
          const contribution = baseScore * material.multiplier * rarity.multiplier;
          economic_power += contribution;
          trait_mapping[`${key}:${value} (Economic)`] = contribution;
          if (!keywords_detected.economic.includes(keyword)) {
            keywords_detected.economic.push(keyword);
          }
        }
      });
    });
  }

  // Also scan metadata name and description
  const metadataStr = `${metadata.name || ''} ${metadata.description || ''}`.toLowerCase();
  const metadataScore = 5; // Lower base score for metadata vs traits
  
  powerKeywords.army.forEach(keyword => {
    if (metadataStr.includes(keyword)) {
      army_power += metadataScore * material.multiplier * rarity.multiplier;
    }
  });
  powerKeywords.religion.forEach(keyword => {
    if (metadataStr.includes(keyword)) {
      religion_power += metadataScore * material.multiplier * rarity.multiplier;
    }
  });
  powerKeywords.civilization.forEach(keyword => {
    if (metadataStr.includes(keyword)) {
      civilization_power += metadataScore * material.multiplier * rarity.multiplier;
    }
  });
  powerKeywords.economic.forEach(keyword => {
    if (metadataStr.includes(keyword)) {
      economic_power += metadataScore * material.multiplier * rarity.multiplier;
    }
  });

  // Apply base power with rarity scaling
  const basePower = 50 * rarity.multiplier;
  army_power = Math.max(army_power, basePower / 4);
  religion_power = Math.max(religion_power, basePower / 4);
  civilization_power = Math.max(civilization_power, basePower / 4);
  economic_power = Math.max(economic_power, basePower / 4);

  // Apply Inquisition class bonus to appropriate power type
  if (inquisitionBonus > 0 && inquisitionParsed?.powerType) {
    switch (inquisitionParsed.powerType) {
      case 'army':
        army_power += inquisitionBonus;
        trait_mapping['Inquisition Class Bonus (Army)'] = inquisitionBonus;
        break;
      case 'religion':
        religion_power += inquisitionBonus;
        trait_mapping['Inquisition Class Bonus (Religion)'] = inquisitionBonus;
        break;
      case 'civilization':
        civilization_power += inquisitionBonus;
        trait_mapping['Inquisition Class Bonus (Civilization)'] = inquisitionBonus;
        break;
      case 'economic':
        economic_power += inquisitionBonus;
        trait_mapping['Inquisition Class Bonus (Economic)'] = inquisitionBonus;
        break;
    }
  }

  const total_power = army_power + religion_power + civilization_power + economic_power;

  // Determine character class based on power distribution
  const classInfo = determineCharacterClass(
    Math.floor(army_power),
    Math.floor(religion_power),
    Math.floor(civilization_power),
    Math.floor(economic_power)
  );

  console.log(`⚡ Final power scores - Army: ${Math.floor(army_power)}, Religion: ${Math.floor(religion_power)}, Civilization: ${Math.floor(civilization_power)}, Economic: ${Math.floor(economic_power)}, Total: ${Math.floor(total_power)}`);

  return {
    army_power: Math.floor(army_power),
    religion_power: Math.floor(religion_power),
    civilization_power: Math.floor(civilization_power),
    economic_power: Math.floor(economic_power),
    total_power: Math.floor(total_power),
    trait_mapping,
    character_class: classInfo.character_class,
    class_confidence: classInfo.class_confidence,
    special_powers,
    materials_found: [material.name],
    rarities_found: [rarity.level],
    keywords_detected
  };
}

/**
 * Scan and update power for a single NFT
 */
export async function scanNftPower(nftId: string): Promise<PowerBreakdown | null> {
  try {
    // Get NFT data with collection info
    const nft = await db.query.gamingNfts.findFirst({
      where: eq(gamingNfts.id, nftId),
      with: {
        collection: true
      }
    });

    if (!nft) {
      console.error(`NFT not found: ${nftId}`);
      return null;
    }

    // Get collection name for Inquisition parsing
    const collectionName = (nft as any).collection?.name || nft.metadata?.collection || undefined;

    // Calculate power from metadata with NFT name and collection for Inquisition parsing
    const power = calculatePowerFromMetadata(
      nft.metadata || {}, 
      nft.traits || {},
      nft.name || nft.metadata?.name || undefined,
      collectionName
    );

    // Update or create power attributes
    const existing = await db.query.nftPowerAttributes.findFirst({
      where: eq(nftPowerAttributes.nft_id, nftId)
    });

    if (existing) {
      await db.update(nftPowerAttributes)
        .set({ 
          ...power,
          owner_address: nft.owner_address || '',
          collection_id: nft.collection_id,
          last_updated: new Date()
         } as any)
        .where(eq(nftPowerAttributes.nft_id, nftId));
    } else {
      await db.insert(nftPowerAttributes).values({
        nft_id: nftId,
        collection_id: nft.collection_id,
        owner_address: nft.owner_address || '',
        ...power
      } as any);
    }

    console.log(`✅ Scanned power for NFT ${nftId}:`, power);
    return power;
  } catch (error) {
    console.error(`Error scanning NFT power for ${nftId}:`, error);
    return null;
  }
}

/**
 * Scan all NFTs for a player and update their total power
 */
export async function scanPlayerNftPower(userHandle: string): Promise<{
  nfts_scanned: number;
  total_army_power: number;
  total_religion_power: number;
  total_civilization_power: number;
  total_economic_power: number;
  total_power: number;
}> {
  try {
    // Get player
    const player = await db.query.gamingPlayers.findFirst({
      where: eq(gamingPlayers.user_handle, userHandle)
    });

    if (!player) {
      throw new Error(`Player not found: ${userHandle}`);
    }

    // Get all NFTs owned by this player
    const playerNfts = await db.query.gamingNfts.findMany({
      where: eq(gamingNfts.owner_address, player.wallet_address)
    });

    console.log(`🔍 Scanning ${playerNfts.length} NFTs for player ${userHandle}...`);

    // Scan each NFT
    const powerResults = await Promise.all(
      playerNfts.map((nft: any) => scanNftPower(nft.id))
    );

    // Calculate total power
    const totals = powerResults.reduce((acc: any, power: PowerBreakdown | null) => {
      if (power) {
        acc.total_army_power += power.army_power;
        acc.total_religion_power += power.religion_power;
        acc.total_civilization_power += power.civilization_power;
        acc.total_economic_power += power.economic_power;
        acc.total_power += power.total_power;
      }
      return acc;
    }, {
      nfts_scanned: playerNfts.length,
      total_army_power: 0,
      total_religion_power: 0,
      total_civilization_power: 0,
      total_economic_power: 0,
      total_power: 0
    });

    // Update player power levels
    await db.update(gamingPlayers)
      .set({ 
        army_power: totals.total_army_power,
        religion_power: totals.total_religion_power,
        civilization_power: totals.total_civilization_power,
        economic_power: totals.total_economic_power,
        total_power_level: totals.total_power,
        updated_at: new Date()
       } as any)
      .where(eq(gamingPlayers.user_handle, userHandle));

    console.log(`✅ Updated player ${userHandle} power:`, totals);
    return totals;
  } catch (error) {
    console.error(`Error scanning player NFT power for ${userHandle}:`, error);
    throw error;
  }
}

/**
 * Get power display icons
 */
export function getPowerIcons(): {
  army: string;
  religion: string;
  civilization: string;
  economic: string;
} {
  return {
    army: '⚔️',
    religion: '⛪',
    civilization: '🏰',
    economic: '💰'
  };
}
