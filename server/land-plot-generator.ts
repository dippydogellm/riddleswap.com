/**
 * Land Plot Generator - Creates 500 medieval land plots with realistic traits
 * Geographically accurate placement across Iceland region
 */

import { db } from './db';
import { medievalLandPlots } from '../shared/schema';
import { nanoid } from 'nanoid';

interface LandPlotData {
  plotNumber: number;
  mapX: number;
  mapY: number;
  gridSection: string;
  latitude: number;
  longitude: number;
  terrainType: string;
  terrainSubtype: string;
  basePrice: number;
  currentPrice: number;
  rdlPrice: number;
  plotSize: string;
  sizeMultiplier: number;
  yieldRate: number;
  specialFeatures: string[];
  resourceNodes: Record<string, any>;
  description: string;
  lore: string;
}

// Inquisition-themed resource materials (4 power categories)
const INQUISITION_MATERIALS = {
  // ARMY CATEGORY - Military power resources
  army: {
    steel: { name: 'Steel Ingots', description: 'Forged metal for weapons and armor', maxLevel: 5 },
    warhorse: { name: 'Warhorse Bloodline', description: 'Elite cavalry breeding stock', maxLevel: 5 },
    siege_timber: { name: 'Siege Timber', description: 'Reinforced wood for siege weapons', maxLevel: 5 },
    gunpowder: { name: 'Gunpowder Reserves', description: 'Explosive materials for cannons', maxLevel: 5 }
  },
  
  // RELIGION CATEGORY - Spiritual power resources
  religion: {
    sacred_relics: { name: 'Sacred Relics', description: 'Holy artifacts blessed by divine power', maxLevel: 5 },
    divine_essence: { name: 'Divine Essence', description: 'Concentrated spiritual energy', maxLevel: 5 },
    holy_scriptures: { name: 'Holy Scriptures', description: 'Ancient religious texts and wisdom', maxLevel: 5 },
    blessed_water: { name: 'Blessed Water', description: 'Purified water from sacred springs', maxLevel: 5 }
  },
  
  // CIVILIZATION CATEGORY - Cultural power resources
  civilization: {
    ancient_knowledge: { name: 'Ancient Knowledge', description: 'Scrolls of forgotten wisdom', maxLevel: 5 },
    cultural_artifacts: { name: 'Cultural Artifacts', description: 'Heritage items of great significance', maxLevel: 5 },
    architectural_mastery: { name: 'Architectural Mastery', description: 'Advanced building techniques', maxLevel: 5 },
    artisan_crafts: { name: 'Artisan Crafts', description: 'Masterwork creations by skilled craftsmen', maxLevel: 5 }
  },
  
  // ECONOMIC CATEGORY - Wealth power resources  
  economic: {
    gold_reserves: { name: 'Gold Reserves', description: 'Pure gold for trade and commerce', maxLevel: 5 },
    trade_goods: { name: 'Trade Goods', description: 'Valuable merchandise for markets', maxLevel: 5 },
    rare_gemstones: { name: 'Rare Gemstones', description: 'Precious gems of exceptional quality', maxLevel: 5 },
    merchant_routes: { name: 'Merchant Routes', description: 'Established trade network access', maxLevel: 5 }
  }
};

// Terrain types with their Inquisition material distribution
const TERRAIN_TYPES = {
  plains: {
    subtypes: ['rolling_hills', 'grassland', 'meadow', 'farmland'],
    materialCategories: ['civilization', 'economic', 'army'], // Farmland supports culture, trade, and basic military
    basePrice: 50,
    yieldRange: [8, 12]
  },
  forest: {
    subtypes: ['dense_forest', 'pine_forest', 'birch_forest', 'ancient_woods'],
    materialCategories: ['army', 'civilization', 'religion'], // Timber for siege, ancient knowledge, sacred groves
    basePrice: 75,
    yieldRange: [10, 14]
  },
  mountain: {
    subtypes: ['rocky_peaks', 'mountain_pass', 'highland', 'cliff_face'],
    materialCategories: ['army', 'economic', 'religion'], // Mining for steel, gold, and sacred sites
    basePrice: 100,
    yieldRange: [12, 16]
  },
  water: {
    subtypes: ['coastal', 'lake_shore', 'river_delta', 'fjord'],
    materialCategories: ['economic', 'religion', 'civilization'], // Trade routes, blessed water, cultural exchange
    basePrice: 90,
    yieldRange: [11, 15]
  },
  swamp: {
    subtypes: ['marshland', 'bog', 'wetland', 'fen'],
    materialCategories: ['religion', 'civilization', 'army'], // Sacred bogs, rare herbs, difficult terrain defense
    basePrice: 40,
    yieldRange: [7, 10]
  },
  desert: {
    subtypes: ['sand_dunes', 'rocky_desert', 'oasis', 'badlands'],
    materialCategories: ['economic', 'religion', 'civilization'], // Gems, ancient temples, lost knowledge
    basePrice: 60,
    yieldRange: [9, 13]
  },
  tundra: {
    subtypes: ['frozen_plains', 'ice_field', 'glacial', 'permafrost'],
    materialCategories: ['army', 'religion', 'economic'], // Warhorse breeding, ice relics, rare furs
    basePrice: 45,
    yieldRange: [8, 11]
  }
};

// Special features that can appear on land plots
const SPECIAL_FEATURES = [
  'river_access',
  'mountain_view',
  'ancient_ruins',
  'sacred_site',
  'trade_route',
  'defensive_walls',
  'natural_harbor',
  'hot_springs',
  'fertile_soil',
  'hidden_cave',
  'old_fortress',
  'crystal_deposit'
];

class LandPlotGenerator {
  /**
   * Generate grid section code (A1, B2, etc.)
   */
  private generateGridSection(x: number, y: number): string {
    const col = String.fromCharCode(65 + Math.floor(x / 5)); // A-D for 0-19 x
    const row = Math.floor(y / 5) + 1; // 1-5 for 0-24 y
    return `${col}${row}`;
  }

  /**
   * Determine terrain based on geographic location
   */
  private determineTerrainByLocation(lat: number, lon: number): { type: string; subtype: string } {
    // Northern regions (higher latitude) = tundra
    if (lat > 64.5) {
      return { type: 'tundra', subtype: 'frozen_plains' };
    }
    
    // Coastal regions (edges) = water/coastal
    if (lon < -18.5 || lon > -13.5) {
      return { type: 'water', subtype: 'fjord' };
    }
    
    // Central highlands = mountain
    if (lat > 63.8 && lat < 64.3 && lon > -17 && lon < -15) {
      return { type: 'mountain', subtype: 'highland' };
    }
    
    // Southern regions = varied (plains, forest, swamp)
    if (lat < 63.5) {
      const rand = Math.random();
      if (rand < 0.4) return { type: 'plains', subtype: 'rolling_hills' };
      if (rand < 0.7) return { type: 'forest', subtype: 'pine_forest' };
      return { type: 'swamp', subtype: 'marshland' };
    }
    
    // Default to forest
    return { type: 'forest', subtype: 'ancient_woods' };
  }

  /**
   * Generate Inquisition-themed resources with levels based on terrain
   */
  private generateResources(terrainType: string): Record<string, any> {
    const terrainConfig = TERRAIN_TYPES[terrainType as keyof typeof TERRAIN_TYPES];
    const resources: Record<string, any> = {};
    
    // Each plot gets 2-3 material categories from terrain's pool
    const numCategories = 2 + Math.floor(Math.random() * 2);
    const selectedCategories = this.shuffleArray(terrainConfig.materialCategories).slice(0, numCategories);
    
    selectedCategories.forEach(category => {
      const categoryMaterials = INQUISITION_MATERIALS[category as keyof typeof INQUISITION_MATERIALS];
      const materialKeys = Object.keys(categoryMaterials);
      
      // Pick 1-2 materials from this category
      const numMaterials = 1 + Math.floor(Math.random() * 2);
      const selectedMaterials = this.shuffleArray(materialKeys).slice(0, numMaterials);
      
      selectedMaterials.forEach(materialKey => {
        const material = (categoryMaterials as any)[materialKey];
        
        // Generate material level (1-5, with bias toward middle levels)
        // Distribution: Level 1 (10%), Level 2 (20%), Level 3 (40%), Level 4 (20%), Level 5 (10%)
        const levelRoll = Math.random();
        let level: number;
        if (levelRoll < 0.10) level = 1;
        else if (levelRoll < 0.30) level = 2;
        else if (levelRoll < 0.70) level = 3;
        else if (levelRoll < 0.90) level = 4;
        else level = 5;
        
        resources[materialKey] = {
          category: category,
          name: material.name,
          description: material.description,
          level: level,
          maxLevel: material.maxLevel,
          // Power bonus calculation (Level 1 = 20 power, Level 5 = 100 power)
          powerBonus: level * 20,
          // Production rate (materials per hour)
          productionRate: level * 5
        };
      });
    });
    
    return resources;
  }

  /**
   * Generate special features for a plot
   */
  private generateSpecialFeatures(terrainType: string): string[] {
    const features: string[] = [];
    
    // 30% chance of having 1 special feature
    // 10% chance of having 2 special features
    const featureCount = Math.random() < 0.3 ? (Math.random() < 0.33 ? 2 : 1) : 0;
    
    if (featureCount > 0) {
      const shuffled = this.shuffleArray([...SPECIAL_FEATURES]);
      features.push(...shuffled.slice(0, featureCount));
    }
    
    return features;
  }

  /**
   * Generate lore for a land plot
   */
  private generateLore(terrainType: string, specialFeatures: string[], plotNumber: number): string {
    const loreTemplates = {
      plains: [
        `These rolling hills once witnessed the great Battle of ${plotNumber}, where brave knights defended the realm.`,
        `Fertile farmland that has fed the kingdom for centuries, blessed by ancient druids.`,
        `A peaceful meadow where legendary heroes once gathered to plan their quests.`
      ],
      forest: [
        `An ancient forest rumored to be inhabited by mystical creatures and hidden treasures.`,
        `Dense woods that served as sanctuary for rebels during the dark times.`,
        `Sacred groves where druids performed rituals under the full moon.`
      ],
      mountain: [
        `Towering peaks that guard the northern passes, home to forgotten dwarven mines.`,
        `A strategic highland fortress commanding views of the entire region.`,
        `Treacherous cliffs where mountain dragons once nested.`
      ],
      water: [
        `A natural harbor that made this location a vital trading post for centuries.`,
        `Crystal-clear waters said to have healing properties by the ancient healers.`,
        `A fjord where Viking longships once anchored during their expeditions.`
      ],
      swamp: [
        `Mysterious marshlands where alchemists search for rare ingredients.`,
        `A treacherous bog that has claimed many unwary travelers over the ages.`,
        `Wetlands rumored to hide entrance to underground catacombs.`
      ],
      desert: [
        `Harsh desert terrain concealing ancient temples beneath the sand.`,
        `An oasis that served as a crucial rest stop for caravans.`,
        `Rocky badlands where outlaws once hid their stolen treasures.`
      ],
      tundra: [
        `Frozen wastes where only the hardiest warriors dare to venture.`,
        `Icy plains rumored to contain preserved artifacts from a lost civilization.`,
        `Permafrost concealing secrets from the age of ice.`
      ]
    };
    
    const templates = loreTemplates[terrainType as keyof typeof loreTemplates] || loreTemplates.plains;
    let lore = templates[Math.floor(Math.random() * templates.length)];
    
    // Add special feature lore
    if (specialFeatures.includes('ancient_ruins')) {
      lore += ' Ancient ruins dot the landscape, whispering tales of forgotten empires.';
    }
    if (specialFeatures.includes('sacred_site')) {
      lore += ' A sacred site blessed by the gods themselves.';
    }
    
    return lore;
  }

  /**
   * Shuffle array helper
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Generate all 500 land plots
   */
  async generate500Plots(): Promise<LandPlotData[]> {
    console.log('🏞️ [LAND-GEN] Generating 500 land plots with realistic traits...');
    
    const plots: LandPlotData[] = [];
    
    // Generate 500 plots in a 25x20 grid (instead of 40x25 = 1000)
    const gridWidth = 25;
    const gridHeight = 20;
    
    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        const plotNumber = (y * gridWidth) + x + 1;
        
        // Map to Iceland coordinates (64.9°N to 63.0°N, -19°W to -13°W)
        const longitude = -19.0 + (x / (gridWidth - 1)) * 6.0;
        const latitude = 64.9 - (y / (gridHeight - 1)) * 1.9;
        
        // Determine terrain based on location
        const { type: terrainType, subtype } = this.determineTerrainByLocation(latitude, longitude);
        const terrainConfig = TERRAIN_TYPES[terrainType as keyof typeof TERRAIN_TYPES];
        
        // Generate resources
        const resourceNodes = this.generateResources(terrainType);
        
        // Generate special features
        const specialFeatures = this.generateSpecialFeatures(terrainType);
        
        // Determine plot size (90% standard, 8% large, 2% massive)
        const sizeRoll = Math.random();
        const plotSize = sizeRoll < 0.90 ? 'standard' : (sizeRoll < 0.98 ? 'large' : 'massive');
        const sizeMultiplier = plotSize === 'standard' ? 1.0 : (plotSize === 'large' ? 2.0 : 3.0);
        
        // Calculate pricing
        const basePrice = terrainConfig.basePrice * sizeMultiplier;
        const currentPrice = basePrice * (0.9 + Math.random() * 0.2); // ±10% variance
        const rdlPrice = currentPrice * 0.5; // 50% discount for RDL
        
        // Calculate yield
        const yieldRate = terrainConfig.yieldRange[0] + 
          Math.random() * (terrainConfig.yieldRange[1] - terrainConfig.yieldRange[0]);
        
        // Generate lore
        const lore = this.generateLore(terrainType, specialFeatures, plotNumber);
        
        // Generate description with Inquisition materials
        const materialsList = Object.entries(resourceNodes).map(([key, data]: [string, any]) => 
          `${data.name} (Level ${data.level})`
        ).join(', ');
        
        const description = `${terrainType.charAt(0).toUpperCase() + terrainType.slice(1)} land with ${subtype.replace('_', ' ')}. ` +
          `Size: ${plotSize}. Inquisition Materials: ${materialsList || 'None'}.`;
        
        plots.push({
          plotNumber,
          mapX: x,
          mapY: y,
          gridSection: this.generateGridSection(x, y),
          latitude: parseFloat(latitude.toFixed(6)),
          longitude: parseFloat(longitude.toFixed(6)),
          terrainType,
          terrainSubtype: subtype,
          basePrice: parseFloat(basePrice.toFixed(2)),
          currentPrice: parseFloat(currentPrice.toFixed(2)),
          rdlPrice: parseFloat(rdlPrice.toFixed(8)),
          plotSize,
          sizeMultiplier,
          yieldRate: parseFloat(yieldRate.toFixed(2)),
          specialFeatures,
          resourceNodes,
          description,
          lore
        });
      }
    }
    
    console.log(`✅ [LAND-GEN] Generated ${plots.length} land plots with geographic accuracy`);
    return plots;
  }

  /**
   * Regenerate resources for a single plot (for updating existing plots)
   */
  async regenerateResourcesForPlot(terrainType: string, plotNumber: number): Promise<Record<string, any>> {
    return this.generateResources(terrainType);
  }

  /**
   * Populate database with generated plots
   * @param options.startNumber - Starting plot number (for incremental expansion)
   * @param options.count - Number of plots to generate
   * @param options.clearExisting - Whether to clear existing plots first (default: false)
   */
  async populateDatabase(options?: { startNumber?: number; count?: number; clearExisting?: boolean }): Promise<void> {
    try {
      const { startNumber = 1, count = 500, clearExisting = false } = options || {};
      
      if (clearExisting) {
        console.log('🗄️ [LAND-GEN] Clearing existing land plots...');
        await db.delete(medievalLandPlots);
      }
      
      console.log(`📝 [LAND-GEN] Generating ${count} land plots starting from #${startNumber}...`);
      
      // Generate plots with custom start number
      const plots: LandPlotData[] = [];
      const gridWidth = 25;
      const gridHeight = 20;
      
      for (let i = 0; i < count; i++) {
        const plotNumber = startNumber + i;
        const x = (plotNumber - 1) % gridWidth;
        const y = Math.floor((plotNumber - 1) / gridWidth);
        
        // Get terrain and other plot data
        const terrainTypes = Object.keys(TERRAIN_TYPES);
        const terrainType = terrainTypes[Math.floor(Math.random() * terrainTypes.length)];
        const terrainData = TERRAIN_TYPES[terrainType as keyof typeof TERRAIN_TYPES];
        const subtype = terrainData.subtypes[Math.floor(Math.random() * terrainData.subtypes.length)];
        
        const latitude = 64.9 - (y / gridHeight) * 1.9;
        const longitude = -19 + (x / gridWidth) * 6;
        
        const plotSizeRoll = Math.random();
        let plotSize = 'standard';
        let sizeMultiplier = 1.0;
        if (plotSizeRoll > 0.95) {
          plotSize = 'massive';
          sizeMultiplier = 2.0;
        } else if (plotSizeRoll > 0.75) {
          plotSize = 'large';
          sizeMultiplier = 1.5;
        }
        
        const basePrice = terrainData.basePrice * sizeMultiplier;
        const currentPrice = basePrice * (0.9 + Math.random() * 0.2);
        const rdlPrice = currentPrice * 0.75;
        const yieldRate = (terrainData.yieldRange[0] + Math.random() * (terrainData.yieldRange[1] - terrainData.yieldRange[0])) * sizeMultiplier;
        
        const specialFeatures: string[] = [];
        if (Math.random() > 0.7) {
          const feature = SPECIAL_FEATURES[Math.floor(Math.random() * SPECIAL_FEATURES.length)];
          specialFeatures.push(feature);
        }
        
        const resourceNodes = this.generateResources(terrainType);
        
        // Generate description with Inquisition materials
        const materialsList = Object.entries(resourceNodes).map(([key, data]: [string, any]) => 
          `${data.name} (Level ${data.level})`
        ).join(', ');
        
        const description = `${terrainType.charAt(0).toUpperCase() + terrainType.slice(1)} land with ${subtype.replace('_', ' ')}. ` +
          `Size: ${plotSize}. Inquisition Materials: ${materialsList || 'None'}.`;
        
        const lore = this.generateLore(terrainType, specialFeatures, plotNumber);
        
        plots.push({
          plotNumber,
          mapX: x,
          mapY: y,
          gridSection: `${String.fromCharCode(65 + Math.floor(y / 5))}-${Math.floor(x / 5) + 1}`,
          latitude: parseFloat(latitude.toFixed(6)),
          longitude: parseFloat(longitude.toFixed(6)),
          terrainType,
          terrainSubtype: subtype,
          basePrice: parseFloat(basePrice.toFixed(2)),
          currentPrice: parseFloat(currentPrice.toFixed(2)),
          rdlPrice: parseFloat(rdlPrice.toFixed(8)),
          plotSize,
          sizeMultiplier,
          yieldRate: parseFloat(yieldRate.toFixed(2)),
          specialFeatures,
          resourceNodes,
          description,
          lore
        });
      }
      
      console.log('💾 [LAND-GEN] Inserting into database...');
      
      // Insert in batches of 50
      const batchSize = 50;
      for (let i = 0; i < plots.length; i += batchSize) {
        const batch = plots.slice(i, i + batchSize);
        
        await db.insert(medievalLandPlots).values(
          batch.map(plot => ({
            id: nanoid(),
            plotNumber: plot.plotNumber,
            mapX: plot.mapX,
            mapY: plot.mapY,
            gridSection: plot.gridSection,
            latitude: plot.latitude.toString(),
            longitude: plot.longitude.toString(),
            terrainType: plot.terrainType,
            terrainSubtype: plot.terrainSubtype,
            basePrice: plot.basePrice.toString(),
            currentPrice: plot.currentPrice.toString(),
            rdlPrice: plot.rdlPrice.toString(),
            plotSize: plot.plotSize,
            sizeMultiplier: plot.sizeMultiplier.toString(),
            yieldRate: plot.yieldRate.toString(),
            specialFeatures: plot.specialFeatures,
            resourceNodes: plot.resourceNodes,
            description: plot.description,
            lore: plot.lore,
            status: 'available'
          }))
        );
        
        console.log(`   📦 Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(plots.length / batchSize)} inserted`);
      }
      
      console.log('✅ [LAND-GEN] Database population complete!');
      console.log(`📊 [LAND-GEN] Summary:`);
      console.log(`   Plots Generated: ${plots.length}`);
      console.log(`   Plot Range: #${startNumber} to #${startNumber + count - 1}`);
      console.log(`   Terrain Types: ${Object.keys(TERRAIN_TYPES).join(', ')}`);
      
    } catch (error) {
      console.error('❌ [LAND-GEN] Error populating database:', error);
      throw error;
    }
  }
}

export const landPlotGenerator = new LandPlotGenerator();
