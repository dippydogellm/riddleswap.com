import OpenAI from 'openai';

let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

export interface WeaponImageOptions {
  weaponType: 'sword' | 'axe' | 'bow' | 'armor' | 'shield' | 'staff' | 'dagger' | 'mace' | 'spear' | 'crossbow';
  techLevel: 'primitive' | 'medieval' | 'advanced' | 'futuristic' | 'magical';
  color: 'bronze' | 'iron' | 'steel' | 'gold' | 'silver' | 'crystal' | 'obsidian' | 'mithril' | 'adamantine';
  armyColor?: 'red' | 'blue' | 'green' | 'purple' | 'orange' | 'black' | 'white' | 'cyan' | 'yellow';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  customDetails?: string;
}

export interface GeneratedWeaponImage {
  imageUrl: string;
  prompt: string;
  cost: number;
  generatedAt: Date;
}

class AIWeaponImageService {
  private buildPrompt(options: WeaponImageOptions): string {
    const {
      weaponType,
      techLevel,
      color,
      armyColor,
      rarity,
      customDetails
    } = options;

    // Base weapon descriptions
    const weaponDescriptions = {
      sword: 'elegant sword with intricate crossguard',
      axe: 'powerful battle axe with double blades',
      bow: 'curved longbow with mystical string',
      armor: 'full plate armor with detailed craftsmanship',
      shield: 'protective shield with heraldic design',
      staff: 'magical staff with crystal orb',
      dagger: 'sleek curved dagger with jeweled hilt',
      mace: 'heavy war mace with spiked head',
      spear: 'long spear with ornate spearhead',
      crossbow: 'mechanical crossbow with intricate mechanism'
    };

    // Tech level modifiers
    const techModifiers = {
      primitive: 'crude, rough-hewn, basic construction',
      medieval: 'expertly forged, traditional craftsmanship',
      advanced: 'sophisticated engineering, precision details',
      futuristic: 'high-tech materials, glowing energy effects',
      magical: 'enchanted with mystical runes, magical aura'
    };

    // Color specifications
    const colorDetails = {
      bronze: 'warm bronze metal with patina',
      iron: 'dark iron with battle-worn surface',
      steel: 'polished steel with mirror finish',
      gold: 'gleaming gold with divine radiance',
      silver: 'bright silver with lunar glow',
      crystal: 'translucent crystal with inner light',
      obsidian: 'black volcanic glass with sharp edges',
      mithril: 'silvery mithril with ethereal shimmer',
      adamantine: 'dark adamantine with indestructible strength'
    };

    // Rarity effects
    const rarityEffects = {
      common: 'practical design',
      rare: 'subtle magical glow',
      epic: 'pulsing energy aura',
      legendary: 'radiant divine power, floating particles'
    };

    let prompt = `A ${rarityEffects[rarity]} ${weaponDescriptions[weaponType]} made of ${colorDetails[color]}, ${techModifiers[techLevel]}`;

    // Add army color accents if specified
    if (armyColor) {
      prompt += `, featuring ${armyColor} military insignia and accent colors`;
    }

    // Add custom details
    if (customDetails) {
      prompt += `, ${customDetails}`;
    }

    // Style specifications
    prompt += `, fantasy medieval style, high detail, dramatic lighting, isolated on transparent background, professional game asset quality, 4K resolution`;

    return prompt;
  }

  async generateWeaponImage(options: WeaponImageOptions): Promise<GeneratedWeaponImage> {
    try {
      const prompt = this.buildPrompt(options);
      
      console.log(`🎨 [AI-WEAPON] Generating image for ${options.weaponType} (${options.techLevel} ${options.color})`);
      console.log(`🎨 [AI-WEAPON] Prompt: ${prompt.substring(0, 100)}...`);

      const response = await getOpenAI().images.generate({
        model: "dall-e-3",
        prompt: prompt,
        size: "1024x1024",
        quality: "hd",
        style: "vivid",
        n: 1,
      });

      const imageUrl = response.data?.[0]?.url;
      if (!imageUrl) {
        throw new Error('No image URL returned from OpenAI');
      }

      const result: GeneratedWeaponImage = {
        imageUrl,
        prompt,
        cost: 0.08, // DALL-E 3 HD cost
        generatedAt: new Date()
      };

      console.log(`✅ [AI-WEAPON] Image generated successfully for ${options.weaponType}`);
      return result;

    } catch (error) {
      console.error('❌ [AI-WEAPON] Image generation failed:', error);
      throw new Error(`Failed to generate weapon image: ${error}`);
    }
  }

  async generateBatchWeaponImages(optionsArray: WeaponImageOptions[]): Promise<GeneratedWeaponImage[]> {
    console.log(`🎨 [AI-WEAPON] Starting batch generation of ${optionsArray.length} weapon images`);
    
    const results: GeneratedWeaponImage[] = [];
    const errors: string[] = [];

    // Process sequentially to respect API limits
    for (const options of optionsArray) {
      try {
        const result = await this.generateWeaponImage(options);
        results.push(result);
        
        // Small delay to respect API limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        const errorMsg = `Failed to generate ${options.weaponType}: ${error}`;
        errors.push(errorMsg);
        console.error(`❌ [AI-WEAPON] ${errorMsg}`);
      }
    }

    console.log(`✅ [AI-WEAPON] Batch complete: ${results.length} successful, ${errors.length} failed`);
    
    if (errors.length > 0) {
      console.warn(`⚠️ [AI-WEAPON] Errors encountered:`, errors);
    }

    return results;
  }

  // Generate starter weapon set for marketplace
  async generateStarterWeaponSet(): Promise<GeneratedWeaponImage[]> {
    const starterWeapons: WeaponImageOptions[] = [
      { weaponType: 'sword', techLevel: 'medieval', color: 'steel', rarity: 'common' },
      { weaponType: 'bow', techLevel: 'medieval', color: 'bronze', rarity: 'common' },
      { weaponType: 'axe', techLevel: 'medieval', color: 'iron', rarity: 'rare' },
      { weaponType: 'shield', techLevel: 'medieval', color: 'steel', rarity: 'common', armyColor: 'red' },
      { weaponType: 'armor', techLevel: 'advanced', color: 'mithril', rarity: 'epic' },
      { weaponType: 'staff', techLevel: 'magical', color: 'crystal', rarity: 'rare' },
      { weaponType: 'dagger', techLevel: 'medieval', color: 'obsidian', rarity: 'rare' },
      { weaponType: 'mace', techLevel: 'primitive', color: 'bronze', rarity: 'common' },
      { weaponType: 'spear', techLevel: 'advanced', color: 'adamantine', rarity: 'legendary' },
      { weaponType: 'crossbow', techLevel: 'futuristic', color: 'crystal', rarity: 'epic' }
    ];

    return this.generateBatchWeaponImages(starterWeapons);
  }

  // Validate weapon image options
  validateWeaponOptions(options: WeaponImageOptions): string[] {
    const errors: string[] = [];

    const validWeaponTypes = ['sword', 'axe', 'bow', 'armor', 'shield', 'staff', 'dagger', 'mace', 'spear', 'crossbow'];
    const validTechLevels = ['primitive', 'medieval', 'advanced', 'futuristic', 'magical'];
    const validColors = ['bronze', 'iron', 'steel', 'gold', 'silver', 'crystal', 'obsidian', 'mithril', 'adamantine'];
    const validArmyColors = ['red', 'blue', 'green', 'purple', 'orange', 'black', 'white', 'cyan', 'yellow'];
    const validRarities = ['common', 'rare', 'epic', 'legendary'];

    if (!validWeaponTypes.includes(options.weaponType)) {
      errors.push(`Invalid weapon type: ${options.weaponType}`);
    }

    if (!validTechLevels.includes(options.techLevel)) {
      errors.push(`Invalid tech level: ${options.techLevel}`);
    }

    if (!validColors.includes(options.color)) {
      errors.push(`Invalid color: ${options.color}`);
    }

    if (options.armyColor && !validArmyColors.includes(options.armyColor)) {
      errors.push(`Invalid army color: ${options.armyColor}`);
    }

    if (!validRarities.includes(options.rarity)) {
      errors.push(`Invalid rarity: ${options.rarity}`);
    }

    if (options.customDetails && options.customDetails.length > 200) {
      errors.push('Custom details too long (max 200 characters)');
    }

    return errors;
  }
}

export const aiWeaponImageService = new AIWeaponImageService();