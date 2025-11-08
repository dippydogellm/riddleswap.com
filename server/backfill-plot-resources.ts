import { db } from './db';
import { medievalLandPlots } from '../shared/schema';
import { isNull, or, sql } from 'drizzle-orm';

const INQUISITION_MATERIALS = {
  army: {
    steel: { name: 'Steel Ingots', maxLevel: 5 },
    warhorse: { name: 'Warhorse Bloodline', maxLevel: 5 },
    siege_timber: { name: 'Siege Timber', maxLevel: 5 },
    gunpowder: { name: 'Gunpowder Reserves', maxLevel: 5 }
  },
  religion: {
    sacred_relics: { name: 'Sacred Relics', maxLevel: 5 },
    divine_essence: { name: 'Divine Essence', maxLevel: 5 },
    holy_scriptures: { name: 'Holy Scriptures', maxLevel: 5 },
    blessed_water: { name: 'Blessed Water', maxLevel: 5 }
  },
  civilization: {
    ancient_knowledge: { name: 'Ancient Knowledge', maxLevel: 5 },
    cultural_artifacts: { name: 'Cultural Artifacts', maxLevel: 5 },
    architectural_mastery: { name: 'Architectural Mastery', maxLevel: 5 },
    artisan_crafts: { name: 'Artisan Crafts', maxLevel: 5 }
  },
  economic: {
    gold_reserves: { name: 'Gold Reserves', maxLevel: 5 },
    trade_goods: { name: 'Trade Goods', maxLevel: 5 },
    rare_gemstones: { name: 'Rare Gemstones', maxLevel: 5 },
    merchant_routes: { name: 'Merchant Routes', maxLevel: 5 }
  }
};

const TERRAIN_CATEGORIES: Record<string, string[]> = {
  plains: ['civilization', 'economic', 'army'],
  forest: ['army', 'civilization', 'religion'],
  mountain: ['army', 'economic', 'religion'],
  water: ['economic', 'religion', 'civilization'],
  swamp: ['religion', 'civilization', 'army'],
  desert: ['economic', 'religion', 'civilization'],
  tundra: ['army', 'religion', 'economic']
};

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generateResources(terrainType: string): Record<string, any> {
  const categories = TERRAIN_CATEGORIES[terrainType] || ['civilization', 'economic'];
  const resources: Record<string, any> = {};
  
  const numCategories = 2 + Math.floor(Math.random() * 2);
  const selectedCategories = shuffleArray(categories).slice(0, numCategories);
  
  selectedCategories.forEach(category => {
    const categoryMaterials = INQUISITION_MATERIALS[category as keyof typeof INQUISITION_MATERIALS];
    const materialKeys = Object.keys(categoryMaterials);
    
    const numMaterials = 1 + Math.floor(Math.random() * 2);
    const selectedMaterials = shuffleArray(materialKeys).slice(0, numMaterials);
    
    selectedMaterials.forEach(materialKey => {
      const material = (categoryMaterials as any)[materialKey];
      
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
        level: level,
        maxLevel: material.maxLevel,
        powerBonus: level * 20,
        productionRate: level * 5
      };
    });
  });
  
  return resources;
}

async function backfillResources() {
  console.log('🔄 Starting plot resources backfill...');
  
  const plots = await db
    .select()
    .from(medievalLandPlots)
    .where(or(
      isNull(medievalLandPlots.plotResources),
      sql`${medievalLandPlots.plotResources}::text = '{}'`
    ));
  
  console.log(`📊 Found ${plots.length} plots to backfill`);
  
  let updated = 0;
  for (const plot of plots) {
    const resources = generateResources(plot.terrainType);
    
    await db
      .update(medievalLandPlots)
      .set({  plotResources: resources  } as any)
      .where(sql`id = ${plot.id}`);
    
    updated++;
    if (updated % 50 === 0) {
      console.log(`✅ Updated ${updated}/${plots.length} plots`);
    }
  }
  
  console.log(`✅ Backfill complete! Updated ${updated} plots`);
}

backfillResources().then(() => process.exit(0)).catch(err => {
  console.error('❌ Backfill error:', err);
  process.exit(1);
});
