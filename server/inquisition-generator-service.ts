/**
 * Inquisition Member Generator Service
 * 
 * Generates AI-powered inquisition members with:
 * - Randomized material + player type combinations
 * - AI-generated character images (using existing OpenAI integration)
 * - ChatGPT-generated character stories and lore
 * - Enhanced game stats and abilities
 */

import OpenAI from 'openai';
import { db } from './db';
import { gamingInquisitionMembers, type InsertGamingInquisitionMember } from '../shared/nft-gaming-enhanced';
import { users, gamingNfts, linkedWallets } from '../shared/schema';
import { eq, desc, and } from 'drizzle-orm';
import { nftOwnershipScanner } from './services/nft-ownership-scanner';

// Character generation options
const MATERIALS = ['steel', 'iron', 'gold', 'silver', 'bronze', 'mythril', 'adamant', 'dragon_scale', 'holy', 'cursed'];
const PLAYER_TYPES = ['priest', 'knight', 'commander', 'warrior', 'mage', 'archer', 'rogue'];
const RARITIES = ['common', 'rare', 'epic', 'legendary'];

// Probability weights for rarities (common is most likely)
const RARITY_WEIGHTS = {
  common: 50,
  rare: 30,
  epic: 15,
  legendary: 5
};

interface GenerationOptions {
  seed?: string;
  material?: string;
  playerType?: string;
  rarity?: string;
}

interface GeneratedMember {
  id: string;
  name: string;
  material: string;
  player_type: string;
  role: string;
  rarity: string;
  traits: Record<string, any> | null;
  abilities: Record<string, any> | null;
  stats: {
    base_power: number;
    combat_effectiveness: number;
    leadership_value: number;
    magical_power: number;
    division_boost: number;
    religion_control: number;
  };
  image_url: string | null;
  popup_story: string | null;
  oracle_job_id?: string | null;
  created_at: Date;
}

export class InquisitionGeneratorService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Generate a complete inquisition member with AI content and NFT trait bonuses
   */
  async generateInquisitionMember(userId: string, options: GenerationOptions = {}): Promise<GeneratedMember> {
    try {
      console.log(`🎭 [INQUISITION-GEN] Starting generation for user: ${userId}`);

      // Step 1: Generate character traits
      const traits = this.generateCharacterTraits(options);
      console.log(`🎭 [INQUISITION-GEN] Generated traits: ${traits.role}`);

      // Step 2: Generate character name
      const name = this.generateCharacterName(traits.material, traits.playerType, traits.rarity);

      // Step 3: Generate AI image using existing OpenAI setup
      const imageUrl = await this.generateCharacterImage(traits, name);

      // Step 4: Generate character story using ChatGPT
      const popupStory = await this.generateCharacterStory(traits, name);

      // Step 5: Calculate enhanced game stats with NFT collection bonuses
      const nftBonuses = await this.calculateNftCollectionBonuses(userId);
      const stats = this.calculateEnhancedStats(traits, nftBonuses);

      // Step 6: Generate abilities based on role
      const abilities = this.generateAbilities(traits);

      // Step 7: Create database record
      const memberData: InsertGamingInquisitionMember = {
        user_id: userId,
        chain: 'xrp',
        status: 'generated',
        name,
        material: traits.material,
        player_type: traits.playerType,
        role: traits.role,
        rarity: traits.rarity,
        traits: traits.traitDetails,
        abilities,
        stats,
        image_url: imageUrl,
        popup_story: popupStory,
        oracle_job_id: `inquisition-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
      };

      const [insertedMember] = await db.insert(gamingInquisitionMembers).values(memberData as any).returning();

      console.log(`✅ [INQUISITION-GEN] Generated member: ${name} (${insertedMember.id})`);

      return {
        ...insertedMember,
        created_at: insertedMember.created_at
      };

    } catch (error) {
      console.error('❌ [INQUISITION-GEN] Generation failed:', error);
      throw new Error(`Failed to generate inquisition member: ${error}`);
    }
  }

  /**
   * Generate character traits (material + player type + rarity)
   */
  private generateCharacterTraits(options: GenerationOptions) {
    const material = options.material || this.randomChoice(MATERIALS);
    const playerType = options.playerType || this.randomChoice(PLAYER_TYPES);
    const rarity = options.rarity || this.weightedChoice(RARITIES, RARITY_WEIGHTS);

    const role = `${material} ${playerType}`;

    // Generate detailed traits based on combinations
    const traitDetails = {
      base_material: material,
      class_type: playerType,
      rarity_tier: rarity,
      equipment_quality: rarity,
      combat_experience: this.randomChoice(['novice', 'veteran', 'elite', 'legendary']),
      personality: this.randomChoice(['stoic', 'fierce', 'wise', 'cunning', 'noble', 'mysterious']),
      origin: this.randomChoice(['royal_guard', 'temple_warrior', 'mercenary', 'academy_graduate', 'street_fighter', 'noble_born']),
      special_training: this.randomChoice(['meditation', 'combat_drill', 'magical_study', 'tactical_training', 'divine_blessing'])
    };

    return {
      material,
      playerType,
      rarity,
      role,
      traitDetails
    };
  }

  /**
   * Generate character name based on traits
   */
  private generateCharacterName(material: string, playerType: string, rarity: string): string {
    const prefixes: Record<string, string[]> = {
      steel: ['Sir', 'Dame', 'Captain', 'Lord', 'Lady'],
      iron: ['Sergeant', 'Guard', 'Defender', 'Warden'],
      gold: ['His/Her Majesty', 'Royal', 'Golden', 'Blessed'],
      silver: ['Brother', 'Sister', 'Elder', 'Sage'],
      bronze: ['Scout', 'Runner', 'Swift', 'Young'],
      mythril: ['Arcane', 'Mystic', 'Ancient', 'Ethereal'],
      adamant: ['Unbreakable', 'Eternal', 'Immortal', 'Indestructible'],
      dragon_scale: ['Dragonborn', 'Scaled', 'Fireproof', 'Wyrmkin'],
      holy: ['Saint', 'Blessed', 'Divine', 'Sacred'],
      cursed: ['Dark', 'Shadow', 'Cursed', 'Forbidden']
    };

    const names: Record<string, string[]> = {
      priest: ['Benedictus', 'Seraphina', 'Augustine', 'Celestine', 'Raphael', 'Miriam'],
      knight: ['Galahad', 'Lancelot', 'Guinevere', 'Percival', 'Gareth', 'Elaine'],
      commander: ['Alexander', 'Caesar', 'Athena', 'Marcus', 'Victoria', 'Strategius'],
      warrior: ['Ragnar', 'Brunhilde', 'Conan', 'Valkyria', 'Thor', 'Freya'],
      mage: ['Merlin', 'Morgana', 'Gandalf', 'Elara', 'Prospero', 'Circe'],
      archer: ['Robin', 'Artemis', 'Legolas', 'Diana', 'Hawkeye', 'Sylvanas'],
      rogue: ['Shadow', 'Phantom', 'Nightshade', 'Viper', 'Stealth', 'Whisper']
    };

    const prefix = this.randomChoice(prefixes[material] || ['Brave', 'Noble']);
    const baseName = this.randomChoice(names[playerType] || ['Adventurer']);
    
    return `${prefix} ${baseName}`;
  }

  /**
   * Generate character image using OpenAI DALL-E
   */
  private async generateCharacterImage(traits: any, name: string): Promise<string> {
    try {
      const prompt = this.buildImagePrompt(traits, name);
      
      console.log(`🎨 [INQUISITION-IMG] Generating image with prompt: ${prompt.substring(0, 100)}...`);

      const response = await this.openai.images.generate({
        model: "dall-e-3",
        prompt,
        size: "1024x1024",
        quality: "hd",
        n: 1,
      });

      const imageUrl = response.data?.[0]?.url;
      if (!imageUrl) {
        throw new Error('No image URL returned from OpenAI');
      }

      console.log(`✅ [INQUISITION-IMG] Image generated successfully`);
      return imageUrl;

    } catch (error) {
      console.error('❌ [INQUISITION-IMG] Image generation failed:', error);
      // Return a placeholder URL if image generation fails
      return `https://via.placeholder.com/512x512/1a1a1a/ffffff?text=${encodeURIComponent(name)}`;
    }
  }

  /**
   * Build detailed image prompt for character
   */
  private buildImagePrompt(traits: any, name: string): string {
    const { material, playerType, rarity } = traits;

    const materialDescriptions = {
      steel: 'polished steel armor with mirror finish',
      iron: 'dark iron armor with battle-worn surface',
      gold: 'gleaming golden armor with divine radiance',
      silver: 'bright silver armor with lunar glow',
      bronze: 'warm bronze armor with patina',
      mythril: 'silvery mythril armor with ethereal shimmer',
      adamant: 'dark adamantine armor with indestructible strength',
      dragon_scale: 'scaled armor with fire-resistant properties',
      holy: 'blessed armor glowing with divine light',
      cursed: 'dark armor emanating shadowy aura'
    };

    const classDescriptions = {
      priest: 'holy priest with religious symbols and healing aura',
      knight: 'noble knight with sword and shield in cavalry stance',
      commander: 'tactical commander with strategic bearing and leadership presence',
      warrior: 'battle-hardened warrior with multiple weapons',
      mage: 'mystical mage with magical staff and arcane energy',
      archer: 'skilled archer with longbow and quiver of arrows',
      rogue: 'stealthy rogue with daggers and shadowy cloak'
    };

    const rarityEffects = {
      common: 'practical design',
      rare: 'subtle magical glow',
      epic: 'pulsing energy aura',
      legendary: 'radiant divine power with floating light particles'
    };

    return `A ${rarityEffects[rarity as keyof typeof rarityEffects]} medieval fantasy ${classDescriptions[playerType as keyof typeof classDescriptions]} wearing ${materialDescriptions[material as keyof typeof materialDescriptions]}, standing heroically in an ancient stone chamber, dramatic lighting, high detail, fantasy art style, 4K quality`;
  }

  /**
   * Generate character story using ChatGPT
   */
  private async generateCharacterStory(traits: any, name: string): Promise<string> {
    try {
      const prompt = this.buildStoryPrompt(traits, name);
      
      console.log(`📖 [INQUISITION-STORY] Generating story for ${name}`);

      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are a master storyteller creating engaging character backgrounds for a medieval fantasy gaming world. Create immersive, detailed stories that bring characters to life."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 300,
        temperature: 0.8
      });

      const story = response.choices[0]?.message?.content || 'A mysterious member of the inquisition whose story remains untold...';
      
      console.log(`✅ [INQUISITION-STORY] Story generated for ${name}`);
      return story;

    } catch (error) {
      console.error('❌ [INQUISITION-STORY] Story generation failed:', error);
      return `${name} is a distinguished member of the inquisition, known for their ${traits.rarity} abilities and ${traits.material} equipment. Their dedication to the cause is unquestioned.`;
    }
  }

  /**
   * Build story prompt for character
   */
  private buildStoryPrompt(traits: any, name: string): string {
    const { material, playerType, rarity, traitDetails } = traits;

    return `Create an engaging character backstory for ${name}, a ${rarity} ${material} ${playerType} in a medieval fantasy inquisition.

Character Details:
- Name: ${name}
- Class: ${playerType} 
- Equipment Material: ${material}
- Rarity: ${rarity}
- Personality: ${traitDetails.personality}
- Origin: ${traitDetails.origin}
- Combat Experience: ${traitDetails.combat_experience}

Write a compelling 2-3 paragraph backstory that includes:
- Their origins and how they joined the inquisition
- A defining moment that shaped their character
- Their special abilities or role within the organization
- Why they are respected/feared by allies and enemies

Keep it engaging, appropriate for all ages, and focused on their heroic qualities and dedication to justice.`;
  }

  /**
   * Calculate enhanced game stats based on traits and NFT collection bonuses
   */
  private calculateEnhancedStats(traits: any, nftBonuses: any = {}) {
    const { material, playerType, rarity } = traits;

    let basePower = 100;

    // Material bonuses
    const materialBonuses: Record<string, number> = {
      steel: 25, iron: 15, gold: 35, silver: 20, bronze: 10,
      mythril: 50, adamant: 60, dragon_scale: 75, holy: 40, cursed: 30
    };
    basePower += materialBonuses[material] || 0;

    // Rarity multipliers
    const rarityMultipliers: Record<string, number> = {
      common: 1.0,
      rare: 1.3,
      epic: 1.6,
      legendary: 2.0
    };
    basePower = Math.floor(basePower * (rarityMultipliers[rarity] || 1.0));

    // Apply NFT collection bonuses to base power
    basePower += nftBonuses.powerBonus || 0;
    
    // Initialize stat values
    let combatEffectiveness = Math.floor(basePower * 0.6); // 60% base combat
    let leadershipValue = Math.floor(basePower * 0.4); // 40% base leadership
    let magicalPower = Math.floor(basePower * 0.3); // 30% base magic
    let divisionBoost = Math.floor(basePower * 0.5); // 50% base division boost
    let religionControl = Math.floor(basePower * 0.4); // 40% base religion

    // Apply NFT collection bonuses
    combatEffectiveness += nftBonuses.armyBonus || 0;
    leadershipValue += nftBonuses.civilizationBonus || 0;
    magicalPower += nftBonuses.civilizationBonus || 0;
    divisionBoost += nftBonuses.armyBonus || 0;
    religionControl += nftBonuses.religionBonus || 0;
    
    console.log(`🎭 [INQUISITION-STATS] Character stats:`);

    // Role-specific bonuses
    switch (playerType) {
      case 'priest':
        religionControl += 60;
        magicalPower += 30;
        leadershipValue += 20;
        combatEffectiveness += 10;
        break;
      case 'knight':
        combatEffectiveness += 50;
        divisionBoost += 40;
        leadershipValue += 20;
        religionControl += 25;
        break;
      case 'commander':
        leadershipValue += 60;
        divisionBoost += 50;
        combatEffectiveness += 30;
        religionControl += 10;
        break;
      case 'warrior':
        combatEffectiveness += 70;
        divisionBoost += 30;
        leadershipValue += 10;
        break;
      case 'mage':
        magicalPower += 80;
        leadershipValue += 30;
        combatEffectiveness += 20;
        religionControl += 25;
        break;
      case 'archer':
        combatEffectiveness += 60;
        divisionBoost += 20;
        leadershipValue += 15;
        break;
      case 'rogue':
        combatEffectiveness += 50;
        leadershipValue += 20;
        divisionBoost += 15;
        break;
    }
    
    console.log(`  Combat: ${combatEffectiveness}, Leadership: ${leadershipValue}`);
    console.log(`  Magic: ${magicalPower}, Division: ${divisionBoost}, Religion: ${religionControl}`);

    return {
      base_power: basePower,
      combat_effectiveness: combatEffectiveness,
      leadership_value: leadershipValue,
      magical_power: magicalPower,
      division_boost: divisionBoost,
      religion_control: religionControl
    };
  }

  /**
   * Generate abilities based on role
   */
  private generateAbilities(traits: any): Record<string, boolean> {
    const { playerType, material, rarity } = traits;
    const abilities: Record<string, boolean> = {};

    // Base abilities by player type
    switch (playerType) {
      case 'priest':
        abilities.healing = true;
        abilities.blessings = true;
        abilities.religion_control = true;
        abilities.divine_intervention = true;
        abilities.turn_undead = true;
        break;
      case 'knight':
        abilities.division_boost = true;
        abilities.heavy_armor = true;
        abilities.cavalry_charge = true;
        abilities.inspire_troops = true;
        abilities.defensive_formation = true;
        break;
      case 'commander':
        abilities.leadership = true;
        abilities.battle_tactics = true;
        abilities.strategic_planning = true;
        abilities.morale_boost = true;
        break;
      case 'warrior':
        abilities.melee_combat = true;
        abilities.shield_mastery = true;
        abilities.weapon_expertise = true;
        abilities.endurance = true;
        break;
      case 'mage':
        abilities.magic_attack = true;
        abilities.elemental_power = true;
        abilities.spell_mastery = true;
        abilities.mana_regeneration = true;
        break;
      case 'archer':
        abilities.ranged_attack = true;
        abilities.precision_strike = true;
        abilities.eagle_eye = true;
        abilities.multi_shot = true;
        break;
      case 'rogue':
        abilities.stealth = true;
        abilities.backstab = true;
        abilities.critical_strike = true;
        abilities.shadow_step = true;
        break;
    }

    // Material-based enhancements
    const materialEnhancements: Record<string, Record<string, boolean>> = {
      holy: { blessing_aura: true, undead_bane: true },
      cursed: { fear_aura: true, dark_magic: true },
      dragon_scale: { fire_resistance: true, dragon_strength: true },
      mythril: { magic_resistance: true, enhanced_durability: true },
      adamant: { armor_piercing: true, unbreakable: true }
    };

    if (materialEnhancements[material]) {
      Object.assign(abilities, materialEnhancements[material]);
    }

    // Rarity bonuses
    if (rarity === 'legendary') {
      abilities.legendary_power = true;
      abilities.aura_of_legend = true;
    } else if (rarity === 'epic') {
      abilities.epic_presence = true;
    }

    return abilities;
  }

  /**
   * Helper: Random choice from array
   */
  private randomChoice<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * Calculate NFT collection bonuses for power enhancement
   */
  private async calculateNftCollectionBonuses(userId: string): Promise<{
    powerBonus: number;
    religionBonus: number;
    armyBonus: number;
    civilizationBonus: number;
    economicBonus: number;
    collections: Record<string, any>;
  }> {
    try {
      console.log(`🎭 [INQUISITION-NFT] Calculating NFT bonuses for user: ${userId}`);

      // Get user's connected wallets by user_id (string, not users.id which is serial)
      const wallets = await db
        .select()
        .from(linkedWallets)
        .where(eq(linkedWallets.user_id, userId));

      if (!wallets.length) {
        console.log(`⚠️ [INQUISITION-NFT] No linked wallets found for user: ${userId}`);
        return this.getEmptyBonuses();
      }

      // Get NFTs from all connected wallets
      const allNfts = [];
      for (const wallet of wallets) {
        const nfts = await db
          .select()
          .from(gamingNfts)
          .where(eq(gamingNfts.owner_address, wallet.address));
        allNfts.push(...nfts);
      }

      if (!allNfts.length) {
        console.log(`⚠️ [INQUISITION-NFT] No NFTs found for user wallets`);
        return this.getEmptyBonuses();
      }

      // Calculate collection-specific bonuses
      const collectionBonuses = this.calculateCollectionSpecificBonuses(allNfts);
      const traitBonuses = this.calculateTraitSpecificBonuses(allNfts);
      
      const bonuses = {
        powerBonus: Math.floor(collectionBonuses.power * 0.1), // 10% of collection power
        religionBonus: collectionBonuses.religionPower,
        armyBonus: collectionBonuses.armyPower,
        civilizationBonus: collectionBonuses.civilizationPower,
        economicBonus: collectionBonuses.economicPower,
        collections: collectionBonuses.collections
      };

      console.log(`✅ [INQUISITION-NFT] Calculated bonuses:`, bonuses);
      return bonuses;

    } catch (error) {
      console.error(`❌ [INQUISITION-NFT] Error calculating NFT bonuses:`, error);
      return this.getEmptyBonuses();
    }
  }

  /**
   * Calculate collection-specific trait bonuses
   */
  private calculateCollectionSpecificBonuses(nfts: any[]): any {
    const collections: Record<string, { count: number; traits: any[] }> = {};
    let totalPower = 0;
    let religionPower = 0;
    let armyPower = 0;
    let civilizationPower = 0;
    let economicPower = 0;

    // Group NFTs by collection
    for (const nft of nfts) {
      const metadata = nft.metadata || {};
      const issuer = metadata.issuer || 'unknown';
      const gameStats = nft.game_stats || {};
      
      if (!collections[issuer]) {
        collections[issuer] = { count: 0, traits: [] };
      }
      
      collections[issuer].count++;
      collections[issuer].traits.push(nft.traits || {});
      
      // Add to totals using four-category system
      totalPower += gameStats.base_power || 100;
      religionPower += gameStats.religion_power || 0;
      armyPower += gameStats.army_power || 0;
      civilizationPower += gameStats.civilization_power || 0;
      economicPower += gameStats.economic_power || 0;
    }

    // Collection-specific percentage bonuses for four-category system
    const collectionPercentages: Record<string, {
      religion: number;
      army: number;
      civilization: number;
      economic: number;
    }> = {
      // The Inquisition Collectors Deck - Religious and military focus
      'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH': {
        religion: 30, // +30% religious power
        army: 25, // +25% army power
        civilization: 20, // +20% civilization power
        economic: 15 // +15% economic power
      },
      // Casino Society - Economic and social influence
      'rJV6oSozcXYoyWSCrZBfN2MSvjGLMpt5HK': {
        religion: 10,
        army: 15,
        civilization: 20, // Strategic thinking and culture
        economic: 35 // High economic influence through gambling/trade
      },
      // Fuzzybears - Peaceful civilization builders
      'rw1R8cfHGMySmbj7gJ1HkiCqTY1xhLGYAs': {
        religion: 25, // Peaceful, spiritual nature
        army: 5, // Non-violent
        civilization: 30, // Community building
        economic: 20 // Cooperative economics
      },
      // XRP Boyz - Tech-forward military and economy
      'rXGcXx2uc2FB2LQ3BahHqUBcbgEhLA1j5': {
        religion: 5,
        army: 30, // Tech warfare
        civilization: 25, // Innovation and progress
        economic: 30 // Digital economy
      }
    };

    // Apply collection percentage bonuses to four categories
    for (const [issuer, data] of Object.entries(collections)) {
      const percentages = collectionPercentages[issuer] || {
        religion: 5, army: 5, civilization: 5, economic: 5
      };
      
      const collectionMultiplier = Math.min(data.count * 0.1, 1.0); // Max 100% bonus
      
      religionPower += Math.floor(religionPower * (percentages.religion / 100) * collectionMultiplier);
      armyPower += Math.floor(armyPower * (percentages.army / 100) * collectionMultiplier);
      civilizationPower += Math.floor(civilizationPower * (percentages.civilization / 100) * collectionMultiplier);
      economicPower += Math.floor(economicPower * (percentages.economic / 100) * collectionMultiplier);
    }

    return {
      power: totalPower,
      religionPower,
      armyPower,
      civilizationPower,
      economicPower,
      collections
    };
  }

  /**
   * Calculate trait-specific bonuses
   */
  private calculateTraitSpecificBonuses(nfts: any[]): any {
    // This can be expanded to analyze specific traits within NFTs
    // For now, return empty bonuses as collection bonuses are primary
    return {};
  }

  /**
   * Get empty bonuses structure
   */
  private getEmptyBonuses() {
    return {
      powerBonus: 0,
      religionBonus: 0,
      armyBonus: 0,
      civilizationBonus: 0,
      economicBonus: 0,
      collections: {}
    };
  }

  /**
   * Helper: Weighted random choice
   */
  private weightedChoice<T extends string>(choices: T[], weights: Record<T, number>): T {
    const totalWeight = Object.values(weights as any).reduce((sum: number, weight) => {
      return typeof weight === 'number' ? sum + weight : sum;
    }, 0 as number);
    let random = Math.random() * totalWeight;
    
    for (const choice of choices) {
      random -= weights[choice];
      if (random <= 0) {
        return choice;
      }
    }
    
    return choices[0]; // fallback
  }

  /**
   * Get generated members for a user
   */
  async getUserGeneratedMembers(userId: string): Promise<GeneratedMember[]> {
    try {
      const members = await db
        .select()
        .from(gamingInquisitionMembers)
        .where(eq(gamingInquisitionMembers.user_id, userId))
        .orderBy(desc(gamingInquisitionMembers.created_at));

      return members.map(member => ({
        ...member,
        traits: member.traits || {},
        abilities: member.abilities || {},
        created_at: member.created_at
      }));

    } catch (error) {
      console.error('❌ [INQUISITION-GEN] Failed to fetch user members:', error);
      throw new Error('Failed to fetch generated members');
    }
  }
}

export const inquisitionGeneratorService = new InquisitionGeneratorService();