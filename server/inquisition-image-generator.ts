/**
 * Inquisition NFT Image Generator
 * Generates army crests, logos, and NFT artwork using OpenAI DALL-E
 */

import OpenAI from 'openai';
import { ReplitObjectStorageService } from './replit-object-storage';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const replitObjectStorage = new ReplitObjectStorageService();

export interface InquisitionImageOptions {
  type: 'crest' | 'logo' | 'character' | 'weapon' | 'banner';
  armyName?: string;
  characterClass?: string;
  theme?: string;
  colors?: string[];
  style?: 'medieval' | 'fantasy' | 'dark' | 'gold' | 'royal';
  powerTypes?: string[]; // army, religion, civilization, economic
  collectionName?: string; // The Inquisition, The Inquiry, The Army, The Bank, The Merchant, The Special Forces
  materialType?: string; // gold, silver, celestial, mythril, etc.
  traits?: Record<string, any>; // Full NFT traits for detailed prompts
}

/**
 * Generate Inquisition NFT artwork
 */
export async function generateInquisitionImage(
  options: InquisitionImageOptions
): Promise<{ success: boolean; imageUrl?: string; base64?: string; error?: string }> {
  try {
    console.log(`🎨 [INQUISITION] Generating ${options.type} image...`);

    if (!process.env.OPENAI_API_KEY) {
      return {
        success: false,
        error: 'OpenAI API key not configured',
      };
    }

    const prompt = createInquisitionPrompt(options);
    console.log(`📝 [INQUISITION] Prompt: ${prompt}`);

    // Generate image with DALL-E 3
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'hd',
      style: 'vivid',
      response_format: 'b64_json',
    });

    if (!response.data || response.data.length === 0) {
      return {
        success: false,
        error: 'No image data returned from OpenAI',
      };
    }

    const imageData = response.data[0];
    const base64 = imageData.b64_json;
    const url = imageData.url || '';

    console.log(`✅ [INQUISITION] Generated ${options.type} successfully`);

    return {
      success: true,
      imageUrl: url,
      base64,
    };
  } catch (error: any) {
    console.error(`❌ [INQUISITION] Generation failed:`, error);
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Get collection-specific character details for ultra-detailed prompts
 */
function getCollectionSpecificDetails(collectionName?: string, materialType?: string, characterClass?: string) {
  const collection = collectionName || 'The Inquisition';
  
  const collectionSpecs: Record<string, any> = {
    'The Inquisition': {
      characterType: `legendary ${characterClass || 'warrior'} of The Inquisition - elite holy crusader knight with ancient battle-tested heritage`,
      armorDescription: `masterwork full gothic plate armor with sacred Inquisition medallions, intricately engraved religious scripture running along armor plates, ornate shoulder pauldrons shaped like angel wings with feather detailing`,
      defaultMaterial: `sacred consecrated steel forged in holy fires with golden filigree inlays and embedded blessed gems`,
      battleDamage: `Weathered from countless holy wars - prominent facial scars including a jagged scar across left cheek from demon blade, scarred knuckles from bare-fist combat, burn marks from dragon fire on right gauntlet`,
      weaponry: `blessed longsword with glowing holy runes etched along the blade, ornate golden crossguard shaped like wings, pommel embedded with sacred relics`,
      helmet: `ornate winged great helm with T-shaped visor partially raised`,
      facialFeatures: `stern battle-hardened eyes showing divine conviction, grey-streaked beard with battle braids, prominent facial scar telling tales of survival`,
      background: `epic medieval cathedral battlefield with shattered stained glass windows casting colorful divine light rays, burning banners, and smoking ruins of unholy forces`,
      specialEffects: `divine golden holy light emanating from armor cracks, sacred angel feathers floating in air, glowing blessed aura`,
      insignia: `The Inquisition heraldic crest featuring crossed holy swords with winged skull centerpiece, purity seals hanging from armor, sacred wax seals on parchment scrolls tucked in belt`
    },
    'The Inquiry': {
      characterType: `god-tier champion of The Inquiry - mythical legendary being radiating overwhelming divine power and ancient cosmic authority`,
      armorDescription: `impossibly ornate celestial armor forged from stardust and divine essence, featuring ethereal patterns that shift and shimmer like galaxies, cosmic energy flowing through armor seams like liquid starlight`,
      defaultMaterial: `pristine celestial platinum infused with essence of fallen stars, glowing with inner divine light, too perfect to be earthly craftsmanship`,
      battleDamage: `Minimal damage showing godly resilience - ancient cosmic scars that glow with ethereal light, faint cracks in armor revealing pure energy beneath, battle marks from fighting primordial entities that would destroy lesser beings`,
      weaponry: `legendary reality-warping weapon humming with cosmic power, blade made of solidified starlight that phases between dimensions, handle wrapped in fabric woven from aurora borealis`,
      helmet: `transcendent crowned helm featuring a halo of floating ethereal crystals, face guard made of pure light that barely conceals otherworldly features`,
      facialFeatures: `eyes glowing with divine inner light like twin stars, ageless perfect features that seem both ancient and timeless, faint cosmic patterns visible on skin like constellation maps, aura of untouchable majesty`,
      background: `floating in the void between dimensions with swirling nebulae and celestial bodies, reality itself bending around the figure's overwhelming presence, tears in space-time fabric`,
      specialEffects: `overwhelming god-level aura causing reality distortion, cosmic energy cascading off armor in waves of pure power, floating crystal shards orbiting the figure, dimensional rifts opening nearby`,
      insignia: `The Inquiry's cosmic symbol - an all-seeing eye within nested sacred geometric patterns that seem to move and shift, glowing with primordial knowledge, emanating waves of divine authority`
    },
    'The Army': {
      characterType: `elite ${characterClass || 'soldier'} of The Army - hardened military veteran and master of tactical warfare`,
      armorDescription: `battle-tested military plate armor with strategic reinforcements at vital points, practical design prioritizing protection over aesthetics, multiple armor layers showing field repairs and battlefield modifications`,
      defaultMaterial: `dense military-grade darkened steel with matte finish to avoid reflections in combat, reinforced with riveted overlapping plates and chain mail underlayer`,
      battleDamage: `Heavily battle-scarred - deep dents and gouges across chest plate from direct sword impacts, arrow scratch marks on shoulder guard, cracked visor from taking a mace to the face, entire left arm armor showing emergency field repairs with mismatched metal plates`,
      weaponry: `brutal practical warhammer with spiked head showing dried blood and dents from crushing enemy armor, wrapped leather grip worn smooth from constant use, secondary gladius strapped to hip`,
      helmet: `utilitarian bucket helm with narrow visor slit, one side dented inward from battle trauma, worn padding visible inside`,
      facialFeatures: `heavily scarred combat veteran face - broken nose set crooked, missing tip of right ear, horizontal scar across forehead, dead-serious thousand-yard stare from seeing too much war`,
      background: `muddy blood-soaked battlefield littered with broken weapons and scattered shields, smoke from burning siege equipment, distant castle walls under assault`,
      specialEffects: `red battle rage aura, blood splatter on armor glinting in firelight, heat distortion from exertion`,
      insignia: `The Army's tactical military crest featuring crossed war axes behind a fortress shield, campaign medals hanging from chest strap showing years of service, unit number branded on shoulder plate`
    },
    'The Bank': {
      characterType: `shrewd ${characterClass || 'merchant-guard'} of The Bank - elite financial enforcer blending merchant sophistication with deadly combat capability`,
      armorDescription: `opulent yet functional armor combining expensive materials with practical protection, gold-trimmed plate armor with emerald gem inlays, ornate coin-pattern engravings across surfaces, merchant guild symbols embossed on shoulder guards`,
      defaultMaterial: `lustrous polished steel gilded with pure gold leaf and platinum accents, emerald and sapphire gemstones set in strategic points both for beauty and protective enchantments`,
      battleDamage: `Calculated battle wear - precise sword cuts across forearm guard from defending merchant caravans, scorched marks from rival faction's fire magic on chest piece, cracked gemstone on shoulder from assassination attempt, repaired sections using even more expensive replacement materials`,
      weaponry: `ornate jeweled rapier with golden basket hilt encrusted with precious gems, blade etched with financial contracts in flowing script, coin-weighted throwing daggers in bandolier`,
      helmet: `elegant open-faced sallet helm with gold trim and merchant guild plume, fitted with protective face-guard that can drop`,
      facialFeatures: `sharp calculating eyes constantly assessing value, well-groomed beard with gold rings braided in, subtle scars on hands from counting coin and combat, expensive merchant tattoos on neck showing banking house allegiance`,
      background: `opulent merchant guild hall treasure vault with gold coins spilling from opened chests, exotic trade goods stacked high, account ledgers floating magically in air with glowing numbers`,
      specialEffects: `golden coin particles swirling around figure, magical contract seals glowing on armor, aura of wealth manifestation with shimmer`,
      insignia: `The Bank's official seal - balanced scales surrounded by protective coin circle, gold merchant rings on gauntlet fingers, bank house colors displayed on ornate cloak clasp, RDL coin prominently displayed`
    },
    'The Merchant': {
      characterType: `cunning ${characterClass || 'trade-master'} of The Merchant Guild - exotic goods specialist and master of commercial warfare`,
      armorDescription: `eclectic armor assembled from rare trade goods across many lands, silk-padded leather brigandine reinforced with Eastern steel plates, exotic beast hide shoulder guards, patchwork design showing pieces from different cultures and trade routes`,
      defaultMaterial: `premium imported materials - Damascus steel from the East, hardened dragon leather from northern traders, silk padding from southern kingdoms, copper and brass fittings from desert merchants`,
      battleDamage: `Road-worn and repaired many times - salt water corrosion marks from sea voyages, sand-blasted sections from desert crossings, patches of different colored leather from emergency repairs in foreign lands, faded spots from years under harsh sun`,
      weaponry: `exotic curved scimitar with mother-of-pearl handle inlay, blade showing unique foreign patterns, utility tools hanging from belt including grappling hook and merchant scales that double as weapons`,
      helmet: `practical aventail mail coif with leather merchant's cap featuring various trade route pins and badges collected from travels`,
      facialFeatures: `sun-weathered traveler's face with laugh lines from deal-making, eyepatch covering old trading dispute injury, multiple small scars from various 'business negotiations', gold tooth gleaming when grinning, knowing merchant's smile`,
      background: `bustling exotic marketplace with colorful silk canopies, merchant stalls overflowing with rare goods, caravan camels in background, multiple currency coins floating in air`,
      specialEffects: `swirling exotic spices creating colorful smoke trails, silk ribbons flowing with magical trade wind, coins and gems orbiting the figure`,
      insignia: `The Merchant Guild stamp - camel silhouette carrying treasure chests surrounded by compass rose, collection of foreign merchant seals on leather straps, trade route map tattooed on forearm showing in armor gaps`
    },
    'The Special Forces': {
      characterType: `elite shadow operative of The Special Forces - master assassin and covert operations specialist combining stealth with lethal precision`,
      armorDescription: `sleek tactical black armor designed for silent movement, matte-black finish absorbing light, segmented plates allowing maximum flexibility, hidden blade sheaths integrated throughout armor, sound-dampening leather padding`,
      defaultMaterial: `darkened blackened steel treated with sound-absorbing coating, reinforced with flexible shadow-forged metal that seems to drink in light, leather components treated with silence enchantments`,
      battleDamage: `Stealthy but battle-proven - thin precision cuts from enemy counter-attacks, burn marks from escaped traps, one cracked chest plate from failed assassination showing near-death, poison stains on gauntlets, deliberately scarred armor sections for intimidation`,
      weaponry: `dual wickedly curved assassin daggers with serrated edges dripping with poison, hidden wrist-mounted crossbow, garrote wire coiled at belt, throwing stars tucked in forearm guards`,
      helmet: `form-fitting black hood with integrated face mask showing only deadly focused eyes, built-in night vision enchantments glowing faintly`,
      facialFeatures: `cold calculating killer's eyes like a predator, facial tattoos marking confirmed kills in Special Forces code, thin scar from ear to jaw from close combat, perpetual shadow across face even in full light`,
      background: `dark urban rooftops under moonlight with smoke and fog, silhouetted city skyline, shadowy alleyways, ninja-like atmospheric setting`,
      specialEffects: `shadowy smoke tendrils wrapping around limbs, brief after-images showing movement speed, darkness manipulation creating aura of fear, silent footstep indicators`,
      insignia: `The Special Forces mark - stylized silent raven skull in flight within crescent moon, kill count notches etched into armor shoulder, covert unit identification mark visible only in moonlight, RDL shadow emblem`
    }
  };
  
  return collectionSpecs[collection] || collectionSpecs['The Inquisition'];
}

/**
 * Create ultra-detailed collection-specific prompt for Inquisition artwork
 */
function createInquisitionPrompt(options: InquisitionImageOptions): string {
  const { type, armyName, characterClass, theme, colors, style, powerTypes, collectionName, materialType, traits } = options;

  // Enhanced style descriptions for better image quality
  const styleDescriptions = {
    medieval: 'authentic medieval heraldry with intricate coat of arms craftsmanship, hand-painted illuminated manuscript quality, museum-worthy historical accuracy, ornate decorative borders',
    fantasy: 'epic AAA fantasy game artwork with mystical glowing magical elements, volumetric lighting effects, cinematic composition, trending on ArtStation quality',
    dark: 'dark gothic aesthetic with dramatic shadows and mysterious atmosphere, ominous supernatural energy, Bloodborne/Dark Souls inspired, horror fantasy art style',
    gold: 'luxurious golden ornate design with metallic sheen, royal treasure quality craftsmanship, baroque opulence, museum artifact presentation',
    royal: 'majestic royal heraldic crest with noble insignia symbolism, regal presentation worthy of kings, professional dynasty branding quality',
  };

  const baseStyle = styleDescriptions[style || 'medieval'];

  // Enhanced power type visual elements with RDL integration
  const powerVisuals = {
    army: 'legendary crossed enchanted swords with RDL runes, ornate battle shields with glowing emblems, military war banners, dramatic combat imagery',
    religion: 'sacred divine symbols radiating holy light, ethereal halos, celestial divine rays, ancient blessed artifacts, mystical religious iconography',
    civilization: 'grand architectural monuments, illuminated ancient tomes with golden pages, mystical scrolls with glowing text, symbols of knowledge and wisdom',
    economic: 'overflowing treasure chests with RDL gold coins, merchant guild symbols, trade route maps with glowing connections, prosperity and wealth imagery',
  };

  const powerElements = powerTypes
    ?.map(p => powerVisuals[p as keyof typeof powerVisuals])
    .filter(Boolean)
    .join(', ') || '';

  // Type-specific prompts
  switch (type) {
    case 'crest':
      return `
        Professional medieval heraldic crest for "${armyName || 'The Inquisition'}" army: 
        ${baseStyle}, shield-shaped emblem with ${powerElements}, 
        ${colors ? `vibrant color palette: ${colors.join(', ')} with metallic accents` : 'traditional heraldic colors: crimson red, royal gold, obsidian black, sapphire blue with metallic highlights'}, 
        ornate decorative border featuring intricate geometric patterns and flourishes, 
        ${theme ? `Theme: ${theme} with epic storytelling elements` : 'medieval warfare theme with battle-tested aesthetics'}, 
        museum-quality professional heraldry design with hand-painted illuminated manuscript attention to detail, 
        dramatic lighting with depth and shadows, no text or letters visible, 
        premium NFT collection quality artwork, 8K ultra-detailed rendering, trending on DeviantArt.
      `.trim().replace(/\s+/g, ' ');

    case 'logo':
      return `
        Premium esports team logo for "${armyName || 'The Inquisition'}" faction: 
        ${baseStyle}, circular emblem design featuring ${powerElements}, 
        ${colors ? `striking color palette: ${colors.join(', ')} with gradient effects` : 'bold contrasting colors with purple, gold, and black gradients'}, 
        modern gaming aesthetic fused with medieval fantasy elements, 
        iconic and instantly memorable design with RDL symbol integration, 
        ultra-high resolution with crisp clean vector-style lines, 
        no text or typography visible, 
        perfect for professional guild badge or team insignia, 
        League of Legends/Dota 2 quality branding, trending on Behance.
      `.trim().replace(/\s+/g, ' ');

    case 'character':
      // Collection-specific character generation with super detailed prompts
      const collectionDetails = getCollectionSpecificDetails(collectionName, materialType, characterClass);
      
      // 🔥 ENHANCED: Extract ALL NFT-specific trait details for truly unique images
      let traitSpecificDetails = '';
      if (traits && Object.keys(traits).length > 0) {
        const traitParts: string[] = [];
        
        // Extract specific trait categories
        for (const [key, value] of Object.entries(traits)) {
          const traitKey = key.toLowerCase();
          const traitValue = typeof value === 'string' ? value : (value as any).value || String(value);
          
          // Map trait categories to visual descriptions
          if (traitKey.includes('armor') || traitKey.includes('body')) {
            traitParts.push(`wearing ${traitValue} armor with distinctive markings`);
          } else if (traitKey.includes('weapon') || traitKey.includes('sword') || traitKey.includes('blade')) {
            traitParts.push(`wielding a ${traitValue} weapon with unique engravings`);
          } else if (traitKey.includes('background') || traitKey.includes('environment')) {
            traitParts.push(`set against ${traitValue} environment with dramatic atmosphere`);
          } else if (traitKey.includes('skin') || traitKey.includes('face')) {
            traitParts.push(`featuring ${traitValue} skin tone with weathered battle scars`);
          } else if (traitKey.includes('hair') || traitKey.includes('head')) {
            traitParts.push(`with ${traitValue} hairstyle flowing in the wind`);
          } else if (traitKey.includes('eyes') || traitKey.includes('gaze')) {
            traitParts.push(`piercing ${traitValue} eyes radiating intense determination`);
          } else if (traitKey.includes('special') || traitKey.includes('effect') || traitKey.includes('aura')) {
            traitParts.push(`emanating ${traitValue} magical aura with particle effects`);
          } else if (traitKey.includes('accessory') || traitKey.includes('item')) {
            traitParts.push(`adorned with ${traitValue} showing rank and prestige`);
          }
        }
        
        if (traitParts.length > 0) {
          traitSpecificDetails = ', ' + traitParts.join(', ');
        }
      }
      
      return `
        Ultra-photorealistic FULL BODY character portrait for ${collectionName || 'The Trolls Inquisition'} NFT collection: 
        ${collectionDetails.characterType}, 
        ${baseStyle}, 
        COMPLETE FIGURE FROM HEAD TO TOE standing in heroic pose showing entire body and legs, 
        ${collectionDetails.armorDescription} with ${powerElements} emblazoned on ornate chest plate featuring ${collectionName || 'Inquisition'} heraldic crest with glowing RDL emblem, 
        full body armor coverage including greaves, sabatons, and leg protection made from ${materialType ? `legendary ${materialType} metal with mystical properties` : collectionDetails.defaultMaterial}, 
        ${collectionDetails.battleDamage} - visible battle scars including deep sword gashes across shoulder pauldron, scorched blast marks from magical combat, scratched and dented plating showing years of warfare, damaged leg armor from countless battles, 
        tattered crimson war cloak flowing dramatically from shoulders down to ankles with battle-worn edges and torn fabric showing glorious combat history, 
        ${collectionDetails.weaponry} gripped in armored gauntlet with intricate knuckle guards and ${materialType || 'enchanted'} reinforcements, weapon extending from hand to ground showing full length, 
        ${collectionDetails.helmet} revealing determined battle-hardened face with ${collectionDetails.facialFeatures}, 
        full body heroic standing pose with feet planted firmly on ground, entire figure visible from head to boots, dramatic volumetric god-ray lighting illuminating entire body, rim lighting effects highlighting full silhouette, and atmospheric fog swirling around legs and feet, 
        ${collectionDetails.background}, 
        ${collectionDetails.specialEffects} with floating magical particles surrounding entire body, glowing aura effects radiating from head to toe, and ${powerElements} energy cascading down full figure from crown to ground, 
        ${collectionDetails.insignia} - ${collectionName || 'Inquisition'} faction symbols and badges of rank displayed prominently on armor with RDL runes glowing in mystical purple light${traitSpecificDetails}, 
        photorealistic AAA digital painting style like The Witcher 3, Elden Ring, or Warhammer 40K cinematic quality with extreme material detail across entire body, 
        realistic worn metal textures with scratches and weathering on all armor pieces from helmet to boots, leather straps with aged patina visible on legs and arms, fabric with realistic fiber detail flowing down full body, 
        perfect for premium NFT character card showing complete character design from head to toe with collector's edition quality, 
        8K ultra-detailed rendering with film grain, sharp focus on entire full-length figure, full body shot composition, trending on ArtStation and CGSociety, 
        CRITICAL: Show complete body including head, torso, arms, legs, and feet - full standing figure portrait.
      `.trim().replace(/\s+/g, ' ');

    case 'weapon':
      return `
        Legendary mythical weapon for ${characterClass || 'warrior'} class - premium NFT game asset: 
        ${baseStyle}, masterwork craftsmanship with ornate ${powerElements} intricately engraved along blade/shaft with glowing magical runes, 
        ${colors ? `exotic materials: ${colors.join(', ')} enchanted metals with precious gemstone inlays` : 'dark enchanted steel with flowing gold filigree and pulsing ruby power cores'}, 
        intense magical aura and energy effects with particle systems and glowing trails, 
        dramatically floating in perfect hero pose with volumetric god rays against mysterious dark background, 
        extreme detail with realistic material textures and reflections, 
        AAA fantasy RPG weapon asset quality like Destiny or Diablo 4, 
        RDL symbol subtly integrated into design, perfect for premium NFT weapon collection, 
        8K photorealistic rendering, trending on CGSociety.
      `.trim().replace(/\s+/g, ' ');

    case 'banner':
      return `
        Epic cinematic medieval war banner for "${armyName || 'The Inquisition'}" legendary army: 
        ${baseStyle}, massive battle-tested fabric war banner featuring ${powerElements} as heroic central design with RDL emblem, 
        ${colors ? `commanding banner colors: ${colors.join(', ')} with dramatic gradients` : 'deep crimson red and royal gold with obsidian black accents and purple mystical highlights'}, 
        flowing weathered silk fabric with realistic wind physics and battle damage, 
        tattered edges showing glorious combat history, mounted on ornate carved wooden pole with decorative metallic finial, 
        dramatic cinematic lighting with volumetric fog effects and atmospheric depth, 
        strong wind creating dynamic movement and motion blur, 
        medieval total war aesthetic with Game of Thrones production quality, 
        photorealistic fabric simulation and material textures, perfect for premium faction identification NFT, 
        8K cinematic quality rendering.
      `.trim().replace(/\s+/g, ' ');

    default:
      return `Medieval gaming artwork with ${baseStyle}. ${powerElements}. High detail, NFT quality.`;
  }
}

/**
 * Generate complete army branding set (crest + logo + banner)
 */
export async function generateArmyBrandingSet(
  armyName: string,
  powerTypes: string[],
  style: 'medieval' | 'fantasy' | 'dark' | 'gold' | 'royal' = 'medieval',
  colors?: string[]
): Promise<{
  crest: { success: boolean; imageUrl?: string; base64?: string };
  logo: { success: boolean; imageUrl?: string; base64?: string };
  banner: { success: boolean; imageUrl?: string; base64?: string };
}> {
  console.log(`🎨 [INQUISITION] Generating complete branding set for ${armyName}...`);

  const options = { armyName, powerTypes, style, colors };

  // Generate all three assets
  const [crest, logo, banner] = await Promise.all([
    generateInquisitionImage({ ...options, type: 'crest' }),
    generateInquisitionImage({ ...options, type: 'logo' }),
    generateInquisitionImage({ ...options, type: 'banner' }),
  ]);

  console.log(`✅ [INQUISITION] Branding set complete for ${armyName}`);

  return { crest, logo, banner };
}

/**
 * Generate collection-specific character artwork based on NFT metadata
 * ENHANCED: Includes ALL traits for truly unique images
 */
export async function generateCharacterFromNFT(nft: {
  name: string;
  collection_name?: string;
  character_class?: string;
  material_type?: string;
  army_power?: number;
  religion_power?: number;
  civilization_power?: number;
  economic_power?: number;
  traits?: Record<string, any>;
}): Promise<{ success: boolean; imageUrl?: string; base64?: string; error?: string }> {
  console.log(`🎨 [INQUISITION] Generating COMPREHENSIVE character art for NFT: ${nft.name} (${nft.collection_name || 'Unknown'})`);
  
  // Log all traits for debugging
  if (nft.traits && Object.keys(nft.traits).length > 0) {
    console.log(`📋 [INQUISITION] NFT Traits:`, JSON.stringify(nft.traits, null, 2));
  }

  // Determine dominant power types
  const powers = [
    { type: 'army', value: nft.army_power || 0 },
    { type: 'religion', value: nft.religion_power || 0 },
    { type: 'civilization', value: nft.civilization_power || 0 },
    { type: 'economic', value: nft.economic_power || 0 },
  ];

  const sortedPowers = powers.sort((a, b) => b.value - a.value);
  const powerTypes = sortedPowers.slice(0, 2).map(p => p.type);
  
  // Extract ALL trait details for comprehensive prompts
  const allTraitDetails = extractAllTraitDetails(nft.traits || {});
  
  console.log(`💪 [INQUISITION] Power Levels: Army=${nft.army_power}, Religion=${nft.religion_power}, Civilization=${nft.civilization_power}, Economic=${nft.economic_power}`);
  console.log(`🎯 [INQUISITION] Using ${allTraitDetails.length} trait details for unique image generation`);

  return await generateInquisitionImage({
    type: 'character',
    characterClass: nft.character_class || 'warrior',
    powerTypes,
    style: 'fantasy',
    collectionName: nft.collection_name,
    materialType: nft.material_type,
    traits: nft.traits,
  });
}

/**
 * Extract ALL traits into a comprehensive list for unique image generation
 * This ensures each NFT gets a truly unique image based on ALL its attributes
 */
function extractAllTraitDetails(traits: Record<string, any>): string[] {
  const details: string[] = [];
  
  // Common trait categories to look for
  const traitCategories = [
    'Armor', 'Weapon', 'Background', 'Class', 'Race', 'Element',
    'Skin', 'Hair', 'Eyes', 'Clothing', 'Accessories', 'Special',
    'Rarity', 'Type', 'Power', 'Attribute', 'Effect', 'Aura'
  ];
  
  // Extract all trait values
  for (const [key, value] of Object.entries(traits)) {
    if (value && typeof value === 'string') {
      details.push(`${key}: ${value}`);
    } else if (value && typeof value === 'object') {
      // Handle nested trait objects
      const nestedValue = (value as any).value || (value as any).trait_type || JSON.stringify(value);
      details.push(`${key}: ${nestedValue}`);
    }
  }
  
  return details;
}

/**
 * Save generated image to Replit Object Storage (persistent)
 */
export async function saveInquisitionImage(
  base64Data: string,
  fileName: string,
  folder: string = 'inquisition'
): Promise<string> {
  try {
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Use unified storage for generated images
    const { unifiedStorage } = await import('./unified-storage');
    const storagePath = await unifiedStorage.uploadFile(buffer, 'generated', 'image/png');
    
    console.log(`💾 [INQUISITION] Saved ${folder}/${fileName} to persistent storage: ${storagePath}`);
    
    return storagePath;
  } catch (error: any) {
    console.error(`❌ [INQUISITION] Failed to save image:`, error);
    throw error;
  }
}
