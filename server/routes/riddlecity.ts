/**
 * RiddleCity API Routes
 * Complete SimCity-style city-building game backend
 */

import express from 'express';
import { db } from '../db';
import * as schema from '../../shared/schema';
import { sessionAuth } from '../middleware/session-auth';
import { readOnlyAuth } from '../middleware/read-only-auth';
import { 
  BUILDING_CATALOG_SEED, 
  FURNISHING_CATALOG_SEED,
  POLICY_DEFINITIONS_SEED,
  DEFENSE_SYSTEMS_CATALOG_SEED 
} from '../riddlecity-seed-data';
import { eq, and, desc, sql as sqlQuery } from 'drizzle-orm';

const router = express.Router();

// ============================================================================
// ADMIN: Seed Catalogs
// ============================================================================
router.post('/admin/seed-catalogs', sessionAuth, async (req, res) => {
  try {
    const { handle } = req.user;
    
    if (handle !== 'dippydoge') {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    console.log('🌱 [RIDDLECITY] Seeding catalogs...');

    for (const building of BUILDING_CATALOG_SEED) {
      await db.insert(schema.buildingCatalog).values(building as any).onConflictDoNothing();
    }

    for (const furnishing of FURNISHING_CATALOG_SEED) {
      await db.insert(schema.furnishingCatalog).values(furnishing as any).onConflictDoNothing();
    }

    for (const policy of POLICY_DEFINITIONS_SEED) {
      await db.insert(schema.policyDefinitions).values(policy as any).onConflictDoNothing();
    }

    for (const defense of DEFENSE_SYSTEMS_CATALOG_SEED) {
      await db.insert(schema.defenseSystemsCatalog).values(defense as any).onConflictDoNothing();
    }

    console.log('✅ [RIDDLECITY] Catalogs seeded successfully');
    
    res.json({ 
      success: true, 
      message: 'Catalogs seeded successfully',
      counts: {
        buildings: BUILDING_CATALOG_SEED.length,
        furnishings: FURNISHING_CATALOG_SEED.length,
        policies: POLICY_DEFINITIONS_SEED.length,
        defenses: DEFENSE_SYSTEMS_CATALOG_SEED.length
      }
    });
  } catch (error) {
    console.error('❌ [RIDDLECITY] Seed catalogs error:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ============================================================================
// ADMIN: Add Partner NFT Collections
// ============================================================================
router.post('/admin/add-partner-collections', sessionAuth, async (req, res) => {
  try {
    const { handle } = req.user;
    
    if (handle !== 'dippydoge') {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    console.log('🎨 [PARTNER NFT] Adding partner NFT collections...');

    const partnerCollections = [
      {
        collection_name: 'Tazz',
        issuer_address: 'rfYarEYZzgMBhscNmzAbQgmbWjgSQm17Wq',
        taxon: 1,
        game_role: 'partner',
        base_power_level: 150,
        expected_supply: 0
      },
      {
        collection_name: 'XRPL Legends',
        issuer_address: 'rf2Z67ZtsGADMk6q1SuJ9D4UFBtSu7DSXz',
        taxon: 0,
        game_role: 'partner',
        base_power_level: 150,
        expected_supply: 0
      },
      {
        collection_name: 'Casino Society',
        issuer_address: 'rJV6oSozcXYoyWSCrZBfN2MSvjGLMpt5HK',
        taxon: 0,
        game_role: 'partner',
        base_power_level: 150,
        expected_supply: 0
      },
      {
        collection_name: 'BunnyX',
        issuer_address: 'rH4SjkWsbNBRaecDnbFyd2nNn2bdkRJeoX',
        taxon: 0,
        game_role: 'partner',
        base_power_level: 150,
        expected_supply: 0
      },
      {
        collection_name: 'PEPE on XRP',
        issuer_address: 'rU6GcvpnAg4GstRCGobgSL7XiZqiDUPEki',
        taxon: 0,
        game_role: 'partner',
        base_power_level: 150,
        expected_supply: 0
      },
      {
        collection_name: 'Made with Miracles Founders Angels',
        issuer_address: 'rHUoEYCkHx17AL4gMaGzaZtkHYs5nm7Nuz',
        taxon: 1111,
        game_role: 'partner',
        base_power_level: 150,
        expected_supply: 0
      },
      {
        collection_name: 'Made with Miracles 589 Little book',
        issuer_address: 'rwBHJSKEvJrxrqphxh4oDnMGn9RVZVtwGA',
        taxon: 111589,
        game_role: 'partner',
        base_power_level: 150,
        expected_supply: 0
      },
      {
        collection_name: 'Patriot',
        issuer_address: 'r3PSkSzynXdkVoFWogW9aQkm3o9gwfZdu6',
        taxon: 0,
        game_role: 'partner',
        base_power_level: 150,
        expected_supply: 0
      }
    ];

    let addedCount = 0;
    let skippedCount = 0;

    for (const collection of partnerCollections) {
      const existing = await db.query.inquisitionCollections.findFirst({
        where: and(
          eq(schema.inquisitionCollections.issuer_address, collection.issuer_address),
          eq(schema.inquisitionCollections.taxon, collection.taxon)
        )
      });

      if (existing) {
        console.log(`⏭️ Skipping ${collection.collection_name} - already exists`);
        skippedCount++;
        continue;
      }

      await db.insert(schema.inquisitionCollections).values({
        collection_name: collection.collection_name,
        issuer_address: collection.issuer_address,
        taxon: collection.taxon,
        game_role: collection.game_role,
        base_power_level: collection.base_power_level,
        expected_supply: collection.expected_supply,
        scan_status: 'pending'
      } as any);

      console.log(`✅ Added ${collection.collection_name} (${collection.issuer_address}, taxon: ${collection.taxon})`);
      addedCount++;
    }

    console.log(`🎉 [PARTNER NFT] Complete! Added: ${addedCount}, Skipped: ${skippedCount}`);

    res.json({ 
      success: true, 
      message: `Successfully added ${addedCount} partner collections (${skippedCount} already existed)`,
      data: { added: addedCount, skipped: skippedCount }
    });
  } catch (error) {
    console.error('❌ [PARTNER NFT] Error adding partner collections:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ============================================================================
// CITY MANAGEMENT
// ============================================================================

router.get('/city/check-land-ownership', readOnlyAuth, async (req, res) => {
  try {
    const { handle } = req.user;

    const ownedLandPlots = await db.query.medievalLandPlots.findMany({
      where: and(
        eq(schema.medievalLandPlots.ownerHandle, handle),
        eq(schema.medievalLandPlots.status, 'owned')
      )
    });

    res.json({ 
      success: true, 
      data: {
        hasLand: ownedLandPlots.length > 0,
        landPlots: ownedLandPlots
      }
    });
  } catch (error) {
    console.error('❌ [RIDDLECITY] Check land ownership error:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/city/create', sessionAuth, async (req, res) => {
  try {
    const { handle } = req.user;
    const { cityName, landPlotId } = req.body;

    console.log(`🏗️ [RIDDLECITY] Creating city for ${handle}: ${cityName}`);

    const existingCity = await db.query.cities.findFirst({
      where: eq(schema.cities.userHandle, handle)
    });

    if (existingCity) {
      return res.status(400).json({ 
        success: false, 
        error: 'You already have a city. Only one city per player.' 
      });
    }

    if (!landPlotId) {
      return res.status(400).json({ 
        success: false, 
        error: 'You must own a land plot to build a city. Visit the Land Marketplace first!' 
      });
    }

    const landPlot = await db.query.medievalLandPlots.findFirst({
      where: eq(schema.medievalLandPlots.id, landPlotId)
    });

    if (!landPlot) {
      return res.status(404).json({ 
        success: false, 
        error: 'Land plot not found' 
      });
    }

    if (landPlot.ownerHandle !== handle) {
      return res.status(403).json({ 
        success: false, 
        error: 'You do not own this land plot' 
      });
    }

    if (landPlot.status !== 'owned') {
      return res.status(400).json({ 
        success: false, 
        error: 'Land plot is not available for development' 
      });
    }

    const [newCity] = await db.insert(schema.cities).values({
      userHandle: handle,
      cityName: cityName || `${handle}'s City`,
      landPlotId: landPlot.id,
      terrainType: landPlot.terrainType,
      plotSize: landPlot.plotSize,
      credits: '10000.00',
      materials: '500.00',
      energy: '1000.00',
      food: '500.00',
      population: 0,
      populationCapacity: 100,
      happiness: 50,
      totalBuildings: 0,
      economicValue: '0.00',
      defenseRating: 0,
      cityLevel: 1,
      experiencePoints: 0
    } as any).returning();

    console.log(`✅ [RIDDLECITY] City created on ${landPlot.terrainType} (${landPlot.plotSize}): ID ${newCity.id}`);

    res.json({ success: true, data: newCity });
  } catch (error) {
    console.error('❌ [RIDDLECITY] Create city error:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/city/my-city', readOnlyAuth, async (req, res) => {
  try {
    const { handle } = req.user;

    const city = await db.query.cities.findFirst({
      where: eq(schema.cities.userHandle, handle),
      with: {
        buildings: true
        // Temporarily disabled due to relation errors:
        // citizens: true,
        // furnishings: true,
        // shops: true,
        // defenses: true,
        // policies: true
      }
    });

    if (!city) {
      return res.status(404).json({ success: false, error: 'No city found. Create one first!' });
    }

    res.json({ success: true, data: city });
  } catch (error) {
    console.error('❌ [RIDDLECITY] Get city error:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/city/dashboard', readOnlyAuth, async (req, res) => {
  try {
    const { handle } = req.user;

    const city = await db.query.cities.findFirst({
      where: eq(schema.cities.userHandle, handle)
    });

    if (!city) {
      return res.json({ success: true, data: null });
    }

    const recentTicks = await db.query.resourceTicks.findMany({
      where: eq(schema.resourceTicks.cityId, city.id),
      orderBy: desc(schema.resourceTicks.tickedAt),
      limit: 10
    });

    const totalIncome = recentTicks
      .filter(t => parseFloat(t.creditsDelta || '0') > 0)
      .reduce((sum, t) => sum + parseFloat(t.creditsDelta || '0'), 0);

    const totalExpenses = recentTicks
      .filter(t => parseFloat(t.creditsDelta || '0') < 0)
      .reduce((sum, t) => sum + Math.abs(parseFloat(t.creditsDelta || '0')), 0);

    res.json({ 
      success: true, 
      data: {
        city,
        recentIncome: totalIncome,
        recentExpenses: totalExpenses,
        netIncome: totalIncome - totalExpenses,
        recentTicks: recentTicks.slice(0, 5)
      }
    });
  } catch (error) {
    console.error('❌ [RIDDLECITY] Dashboard error:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.patch('/city/update', sessionAuth, async (req, res) => {
  try {
    const { handle } = req.user;
    const { cityName, cityDescription, cityImage } = req.body;

    const city = await db.query.cities.findFirst({
      where: eq(schema.cities.userHandle, handle)
    });

    if (!city) {
      return res.status(404).json({ success: false, error: 'City not found' });
    }

    const [updatedCity] = await db.update(schema.cities)
      .set({ 
        cityName: cityName || city.cityName,
        cityDescription: cityDescription !== undefined ? cityDescription : city.cityDescription,
        cityImage: cityImage !== undefined ? cityImage : city.cityImage,
        updatedAt: new Date()
       } as any)
      .where(eq(schema.cities.id, city.id))
      .returning();

    res.json({ success: true, data: updatedCity });
  } catch (error) {
    console.error('❌ [RIDDLECITY] Update city error:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ============================================================================
// PUBLIC CITY PROFILES (NO AUTH REQUIRED)
// ============================================================================

router.get('/city/public/:handle', async (req, res) => {
  try {
    const { handle } = req.params;

    console.log(`🌍 [RIDDLECITY] Public city request for handle: ${handle}`);

    const city = await db.query.cities.findFirst({
      where: eq(schema.cities.userHandle, handle),
      with: {
        buildings: true
        // Temporarily disabled due to relation errors:
        // citizens: true,
        // furnishings: true,
        // shops: true,
        // defenses: true,
        // policies: true
      }
    });

    if (!city) {
      return res.status(404).json({ 
        success: false, 
        error: 'City not found',
        message: `No city found for user @${handle}` 
      });
    }

    console.log(`✅ [RIDDLECITY] Public city data sent for ${city.cityName}`);

    res.json({ success: true, data: city });
  } catch (error) {
    console.error('❌ [RIDDLECITY] Get public city error:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/city/public/id/:cityId', async (req, res) => {
  try {
    const cityId = parseInt(req.params.cityId);

    console.log(`🌍 [RIDDLECITY] Public city request for ID: ${cityId}`);

    const city = await db.query.cities.findFirst({
      where: eq(schema.cities.id, cityId),
      with: {
        buildings: true,
        furnishings: true,
        shops: true,
        defenses: true,
        policies: true,
        citizens: true
      }
    });

    if (!city) {
      return res.status(404).json({ 
        success: false, 
        error: 'City not found',
        message: `No city found with ID ${cityId}` 
      });
    }

    console.log(`✅ [RIDDLECITY] Public city data sent for ${city.cityName}`);

    res.json({ success: true, data: city });
  } catch (error) {
    console.error('❌ [RIDDLECITY] Get public city by ID error:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ============================================================================
// BUILDING CATALOG
// ============================================================================

router.get('/buildings/catalog', readOnlyAuth, async (req, res) => {
  try {
    const buildings = await db.query.buildingCatalog.findMany({
      where: eq(schema.buildingCatalog.isActive, true)
    });

    const grouped = buildings.reduce((acc, building) => {
      if (!acc[building.category]) {
        acc[building.category] = [];
      }
      acc[building.category].push(building);
      return acc;
    }, {} as Record<string, typeof buildings>);

    res.json({ success: true, data: { buildings, grouped } });
  } catch (error) {
    console.error('❌ [RIDDLECITY] Get building catalog error:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ============================================================================
// BUILDING OPERATIONS
// ============================================================================

router.post('/buildings/place', sessionAuth, async (req, res) => {
  try {
    const { handle } = req.user;
    const { buildingType, positionX, positionY, rotation = 0 } = req.body;

    const city = await db.query.cities.findFirst({
      where: eq(schema.cities.userHandle, handle)
    });

    if (!city) {
      return res.status(404).json({ success: false, error: 'City not found' });
    }

    const buildingDef = await db.query.buildingCatalog.findFirst({
      where: and(
        eq(schema.buildingCatalog.buildingType, buildingType),
        eq(schema.buildingCatalog.isActive, true)
      )
    });

    if (!buildingDef) {
      return res.status(404).json({ success: false, error: 'Building type not found' });
    }

    if (city.cityLevel < buildingDef.requiredCityLevel) {
      return res.status(400).json({ success: false, error: `Requires city level ${buildingDef.requiredCityLevel}` });
    }

    if (city.population < buildingDef.requiredPopulation) {
      return res.status(400).json({ success: false, error: `Requires ${buildingDef.requiredPopulation} population` });
    }

    const creditCost = parseFloat(buildingDef.creditCost);
    const materialCost = parseFloat(buildingDef.materialCost);
    const energyCost = parseFloat(buildingDef.energyCost);

    if (parseFloat(city.credits) < creditCost) {
      return res.status(400).json({ success: false, error: 'Not enough credits' });
    }

    if (parseFloat(city.materials) < materialCost) {
      return res.status(400).json({ success: false, error: 'Not enough materials' });
    }

    if (parseFloat(city.energy) < energyCost) {
      return res.status(400).json({ success: false, error: 'Not enough energy' });
    }

    const constructionEnds = new Date(Date.now() + buildingDef.constructionTime * 1000);

    const [newBuilding] = await db.insert(schema.cityBuildings).values({
      cityId: city.id,
      buildingType: buildingType,
      positionX: positionX,
      positionY: positionY,
      rotation: rotation,
      level: 1,
      constructionStatus: 'constructing',
      constructionStarted: new Date(),
      constructionEnds: constructionEnds,
      productionMultiplier: '1.00',
      efficiency: 100
    }).returning();

    await db.update(schema.cities).set({ 
      credits: (parseFloat(city.credits) - creditCost).toFixed(2),
      materials: (parseFloat(city.materials) - materialCost).toFixed(2),
      energy: (parseFloat(city.energy) - energyCost).toFixed(2),
      totalBuildings: city.totalBuildings + 1,
      updatedAt: new Date()
     } as any).where(eq(schema.cities.id, city.id));

    await db.insert(schema.resourceTicks).values({
      cityId: city.id,
      creditsDelta: (-creditCost as any).toFixed(2),
      materialsDelta: (-materialCost).toFixed(2),
      energyDelta: (-energyCost).toFixed(2),
      foodDelta: '0.00',
      source: 'construction',
      details: { buildingType, buildingId: newBuilding.id }
    });

    res.json({ success: true, data: newBuilding });
  } catch (error) {
    console.error('❌ [RIDDLECITY] Place building error:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/buildings/:buildingId/complete', sessionAuth, async (req, res) => {
  try {
    const { handle } = req.user;
    const buildingId = parseInt(req.params.buildingId);

    const building = await db.query.cityBuildings.findFirst({
      where: eq(schema.cityBuildings.id, buildingId)
    });

    if (!building) {
      return res.status(404).json({ success: false, error: 'Building not found' });
    }

    const city = await db.query.cities.findFirst({
      where: and(
        eq(schema.cities.id, building.cityId),
        eq(schema.cities.userHandle, handle)
      )
    });

    if (!city) {
      return res.status(403).json({ success: false, error: 'Not your city' });
    }

    if (building.constructionStatus !== 'constructing') {
      return res.status(400).json({ success: false, error: 'Building not under construction' });
    }

    if (!building.constructionEnds || new Date() < building.constructionEnds) {
      return res.status(400).json({ success: false, error: 'Construction not finished yet' });
    }

    const [updatedBuilding] = await db.update(schema.cityBuildings).set({ 
      constructionStatus: 'active',
      updatedAt: new Date()
     } as any).where(eq(schema.cityBuildings.id, buildingId)).returning();

    const buildingDef = await db.query.buildingCatalog.findFirst({
      where: eq(schema.buildingCatalog.buildingType, building.buildingType)
    });

    if (buildingDef) {
      await db.update(schema.cities).set({ 
        populationCapacity: city.populationCapacity + buildingDef.housingCapacity,
        defenseRating: city.defenseRating + buildingDef.defenseBonus,
        happiness: Math.min(100, city.happiness + buildingDef.happinessBonus),
        experiencePoints: city.experiencePoints + 100,
        updatedAt: new Date()
       } as any).where(eq(schema.cities.id, city.id));
    }

    res.json({ success: true, data: updatedBuilding });
  } catch (error) {
    console.error('❌ [RIDDLECITY] Complete building error:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/buildings/:buildingId/upgrade', sessionAuth, async (req, res) => {
  try {
    const { handle } = req.user;
    const buildingId = parseInt(req.params.buildingId);

    const building = await db.query.cityBuildings.findFirst({
      where: eq(schema.cityBuildings.id, buildingId)
    });

    if (!building) {
      return res.status(404).json({ success: false, error: 'Building not found' });
    }

    const city = await db.query.cities.findFirst({
      where: and(
        eq(schema.cities.id, building.cityId),
        eq(schema.cities.userHandle, handle)
      )
    });

    if (!city) {
      return res.status(403).json({ success: false, error: 'Not your city' });
    }

    if (building.constructionStatus !== 'active') {
      return res.status(400).json({ success: false, error: 'Building must be active to upgrade' });
    }

    const buildingDef = await db.query.buildingCatalog.findFirst({
      where: eq(schema.buildingCatalog.buildingType, building.buildingType)
    });

    if (!buildingDef || !buildingDef.canUpgrade || !buildingDef.upgradesTo) {
      return res.status(400).json({ success: false, error: 'Building cannot be upgraded' });
    }

    const upgradeDef = await db.query.buildingCatalog.findFirst({
      where: eq(schema.buildingCatalog.buildingType, buildingDef.upgradesTo)
    });

    if (!upgradeDef) {
      return res.status(404).json({ success: false, error: 'Upgrade definition not found' });
    }

    const creditCost = parseFloat(upgradeDef.creditCost) * 0.5;
    const materialCost = parseFloat(upgradeDef.materialCost) * 0.5;

    if (parseFloat(city.credits) < creditCost) {
      return res.status(400).json({ success: false, error: 'Not enough credits' });
    }

    if (parseFloat(city.materials) < materialCost) {
      return res.status(400).json({ success: false, error: 'Not enough materials' });
    }

    const constructionEnds = new Date(Date.now() + upgradeDef.constructionTime * 1000 * 0.75);

    const [updatedBuilding] = await db.update(schema.cityBuildings).set({ 
      buildingType: buildingDef.upgradesTo,
      level: building.level + 1,
      constructionStatus: 'upgrading',
      constructionEnds: constructionEnds,
      updatedAt: new Date()
     } as any).where(eq(schema.cityBuildings.id, buildingId)).returning();

    await db.update(schema.cities).set({ 
      credits: (parseFloat(city.credits) - creditCost).toFixed(2),
      materials: (parseFloat(city.materials) - materialCost).toFixed(2),
      updatedAt: new Date()
     } as any).where(eq(schema.cities.id, city.id));

    await db.insert(schema.resourceTicks).values({
      cityId: city.id,
      creditsDelta: (-creditCost as any).toFixed(2),
      materialsDelta: (-materialCost).toFixed(2),
      energyDelta: '0.00',
      foodDelta: '0.00',
      source: 'upgrade',
      details: { buildingType: buildingDef.upgradesTo, buildingId }
    });

    res.json({ success: true, data: updatedBuilding });
  } catch (error) {
    console.error('❌ [RIDDLECITY] Upgrade building error:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.delete('/buildings/:buildingId', sessionAuth, async (req, res) => {
  try {
    const { handle } = req.user;
    const buildingId = parseInt(req.params.buildingId);

    const building = await db.query.cityBuildings.findFirst({
      where: eq(schema.cityBuildings.id, buildingId)
    });

    if (!building) {
      return res.status(404).json({ success: false, error: 'Building not found' });
    }

    const city = await db.query.cities.findFirst({
      where: and(
        eq(schema.cities.id, building.cityId),
        eq(schema.cities.userHandle, handle)
      )
    });

    if (!city) {
      return res.status(403).json({ success: false, error: 'Not your city' });
    }

    await db.delete(schema.cityBuildings).where(eq(schema.cityBuildings.id, buildingId));

    await db.update(schema.cities).set({ 
      totalBuildings: Math.max(0, city.totalBuildings - 1),
      updatedAt: new Date()
     } as any).where(eq(schema.cities.id, city.id));

    res.json({ success: true, message: 'Building demolished' });
  } catch (error) {
    console.error('❌ [RIDDLECITY] Demolish building error:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ============================================================================
// FURNISHING CATALOG
// ============================================================================

router.get('/furnishings/catalog', readOnlyAuth, async (req, res) => {
  try {
    const furnishings = await db.query.furnishingCatalog.findMany({
      where: eq(schema.furnishingCatalog.isActive, true)
    });

    const grouped = furnishings.reduce((acc, furnishing) => {
      if (!acc[furnishing.category]) {
        acc[furnishing.category] = [];
      }
      acc[furnishing.category].push(furnishing);
      return acc;
    }, {} as Record<string, typeof furnishings>);

    res.json({ success: true, data: { furnishings, grouped } });
  } catch (error) {
    console.error('❌ [RIDDLECITY] Get furnishing catalog error:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ============================================================================
// FURNISHING OPERATIONS
// ============================================================================

router.post('/furnishings/place', sessionAuth, async (req, res) => {
  try {
    const { handle } = req.user;
    const { buildingId, furnishingType, positionX, positionY, rotation = 0 } = req.body;

    const building = await db.query.cityBuildings.findFirst({
      where: eq(schema.cityBuildings.id, buildingId)
    });

    if (!building) {
      return res.status(404).json({ success: false, error: 'Building not found' });
    }

    const city = await db.query.cities.findFirst({
      where: and(
        eq(schema.cities.id, building.cityId),
        eq(schema.cities.userHandle, handle)
      )
    });

    if (!city) {
      return res.status(403).json({ success: false, error: 'Not your city' });
    }

    if (building.constructionStatus !== 'active') {
      return res.status(400).json({ success: false, error: 'Building must be active' });
    }

    const furnishingDef = await db.query.furnishingCatalog.findFirst({
      where: and(
        eq(schema.furnishingCatalog.furnishingType, furnishingType),
        eq(schema.furnishingCatalog.isActive, true)
      )
    });

    if (!furnishingDef) {
      return res.status(404).json({ success: false, error: 'Furnishing type not found' });
    }

    const canPlaceIn = furnishingDef.canPlaceIn as string[] || [];
    if (!canPlaceIn.includes(building.buildingType)) {
      return res.status(400).json({ success: false, error: 'Cannot place this furnishing in this building type' });
    }

    const cost = parseFloat(furnishingDef.creditCost);
    if (parseFloat(city.credits) < cost) {
      return res.status(400).json({ success: false, error: 'Not enough credits' });
    }

    const [newFurnishing] = await db.insert(schema.cityFurnishings).values({
      cityId: city.id,
      buildingId: buildingId,
      furnishingType: furnishingType,
      positionX: positionX,
      positionY: positionY,
      rotation: rotation
    } as any).returning();

    await db.update(schema.cities).set({ 
      credits: (parseFloat(city.credits) - cost).toFixed(2),
      happiness: Math.min(100, city.happiness + furnishingDef.happinessBonus),
      updatedAt: new Date()
     } as any).where(eq(schema.cities.id, city.id));

    await db.insert(schema.resourceTicks).values({
      cityId: city.id,
      creditsDelta: (-cost as any).toFixed(2),
      materialsDelta: '0.00',
      energyDelta: '0.00',
      foodDelta: '0.00',
      source: 'furnishing',
      details: { furnishingType, buildingId }
    });

    res.json({ success: true, data: newFurnishing });
  } catch (error) {
    console.error('❌ [RIDDLECITY] Place furnishing error:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.delete('/furnishings/:furnishingId', sessionAuth, async (req, res) => {
  try {
    const { handle } = req.user;
    const furnishingId = parseInt(req.params.furnishingId);

    const furnishing = await db.query.cityFurnishings.findFirst({
      where: eq(schema.cityFurnishings.id, furnishingId)
    });

    if (!furnishing) {
      return res.status(404).json({ success: false, error: 'Furnishing not found' });
    }

    const city = await db.query.cities.findFirst({
      where: and(
        eq(schema.cities.id, furnishing.cityId),
        eq(schema.cities.userHandle, handle)
      )
    });

    if (!city) {
      return res.status(403).json({ success: false, error: 'Not your city' });
    }

    await db.delete(schema.cityFurnishings).where(eq(schema.cityFurnishings.id, furnishingId));

    res.json({ success: true, message: 'Furnishing removed' });
  } catch (error) {
    console.error('❌ [RIDDLECITY] Remove furnishing error:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ============================================================================
// SHOP OPERATIONS
// ============================================================================

router.post('/shops/create', sessionAuth, async (req, res) => {
  try {
    const { handle } = req.user;
    const { buildingId, shopName, shopType, description } = req.body;

    const building = await db.query.cityBuildings.findFirst({
      where: eq(schema.cityBuildings.id, buildingId)
    });

    if (!building) {
      return res.status(404).json({ success: false, error: 'Building not found' });
    }

    const city = await db.query.cities.findFirst({
      where: and(
        eq(schema.cities.id, building.cityId),
        eq(schema.cities.userHandle, handle)
      )
    });

    if (!city) {
      return res.status(403).json({ success: false, error: 'Not your city' });
    }

    const buildingDef = await db.query.buildingCatalog.findFirst({
      where: eq(schema.buildingCatalog.buildingType, building.buildingType)
    });

    if (!buildingDef || buildingDef.shopSlots === 0) {
      return res.status(400).json({ success: false, error: 'This building cannot have shops' });
    }

    const existingShops = await db.query.cityShops.findMany({
      where: eq(schema.cityShops.buildingId, buildingId)
    });

    if (existingShops.length >= buildingDef.shopSlots) {
      return res.status(400).json({ success: false, error: 'Building shop slots full' });
    }

    const [newShop] = await db.insert(schema.cityShops).values({
      cityId: city.id,
      buildingId: buildingId,
      shopName: shopName,
      shopType: shopType,
      description: description || null,
      dailyRevenue: '0.00',
      inventory: [],
      isOpen: true,
      customersToday: 0
    } as any).returning();

    res.json({ success: true, data: newShop });
  } catch (error) {
    console.error('❌ [RIDDLECITY] Create shop error:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.patch('/shops/:shopId', sessionAuth, async (req, res) => {
  try {
    const { handle } = req.user;
    const shopId = parseInt(req.params.shopId);
    const { shopName, description, isOpen, inventory } = req.body;

    const shop = await db.query.cityShops.findFirst({
      where: eq(schema.cityShops.id, shopId)
    });

    if (!shop) {
      return res.status(404).json({ success: false, error: 'Shop not found' });
    }

    const city = await db.query.cities.findFirst({
      where: and(
        eq(schema.cities.id, shop.cityId),
        eq(schema.cities.userHandle, handle)
      )
    });

    if (!city) {
      return res.status(403).json({ success: false, error: 'Not your city' });
    }

    const [updatedShop] = await db.update(schema.cityShops).set({ 
      shopName: shopName !== undefined ? shopName : shop.shopName,
      description: description !== undefined ? description : shop.description,
      isOpen: isOpen !== undefined ? isOpen : shop.isOpen,
      inventory: inventory !== undefined ? inventory : shop.inventory,
      updatedAt: new Date()
     } as any).where(eq(schema.cityShops.id, shopId)).returning();

    res.json({ success: true, data: updatedShop });
  } catch (error) {
    console.error('❌ [RIDDLECITY] Update shop error:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.delete('/shops/:shopId', sessionAuth, async (req, res) => {
  try {
    const { handle } = req.user;
    const shopId = parseInt(req.params.shopId);

    const shop = await db.query.cityShops.findFirst({
      where: eq(schema.cityShops.id, shopId)
    });

    if (!shop) {
      return res.status(404).json({ success: false, error: 'Shop not found' });
    }

    const city = await db.query.cities.findFirst({
      where: and(
        eq(schema.cities.id, shop.cityId),
        eq(schema.cities.userHandle, handle)
      )
    });

    if (!city) {
      return res.status(403).json({ success: false, error: 'Not your city' });
    }

    await db.delete(schema.cityShops).where(eq(schema.cityShops.id, shopId));

    res.json({ success: true, message: 'Shop closed' });
  } catch (error) {
    console.error('❌ [RIDDLECITY] Close shop error:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ============================================================================
// RESOURCE TICK SYSTEM
// ============================================================================

router.post('/resources/tick', sessionAuth, async (req, res) => {
  try {
    const { handle } = req.user;

    const city = await db.query.cities.findFirst({
      where: eq(schema.cities.userHandle, handle)
    });

    if (!city) {
      return res.status(404).json({ success: false, error: 'City not found' });
    }

    const buildings = await db.query.cityBuildings.findMany({
      where: and(
        eq(schema.cityBuildings.cityId, city.id),
        eq(schema.cityBuildings.constructionStatus, 'active')
      )
    });

    let creditsDelta = 0;
    let materialsDelta = 0;
    let energyDelta = 0;
    let foodDelta = 0;

    for (const building of buildings) {
      const buildingDef = await db.query.buildingCatalog.findFirst({
        where: eq(schema.buildingCatalog.buildingType, building.buildingType)
      });

      if (!buildingDef) continue;

      const multiplier = parseFloat(building.productionMultiplier) * (building.efficiency / 100);

      creditsDelta += parseFloat(buildingDef.producesCredits) * multiplier;
      creditsDelta -= parseFloat(buildingDef.upkeepCost);
      
      materialsDelta += parseFloat(buildingDef.producesMaterials) * multiplier;
      
      energyDelta += parseFloat(buildingDef.producesEnergy) * multiplier;
      energyDelta -= parseFloat(buildingDef.consumesEnergy);
      
      foodDelta += parseFloat(buildingDef.producesFood) * multiplier;
      foodDelta -= parseFloat(buildingDef.consumesFood);
    }

    const policies = await db.query.cityPolicies.findMany({
      where: and(
        eq(schema.cityPolicies.cityId, city.id),
        eq(schema.cityPolicies.isActive, true)
      )
    });

    for (const policy of policies) {
      const policyDef = await db.query.policyDefinitions.findFirst({
        where: eq(schema.policyDefinitions.policyType, policy.policyType)
      });

      if (!policyDef) continue;

      const prodMod = parseFloat(policyDef.productionModifier);
      const upkeepMod = parseFloat(policyDef.upkeepModifier);

      if (creditsDelta > 0) {
        creditsDelta *= (1 + prodMod);
      }
      creditsDelta *= (1 + upkeepMod);
      creditsDelta -= parseFloat(policyDef.dailyCost);
    }

    const newCredits = Math.max(0, parseFloat(city.credits) + creditsDelta);
    const newMaterials = Math.max(0, parseFloat(city.materials) + materialsDelta);
    const newEnergy = Math.max(0, parseFloat(city.energy) + energyDelta);
    const newFood = Math.max(0, parseFloat(city.food) + foodDelta);

    await db.update(schema.cities).set({ 
      credits: newCredits.toFixed(2),
      materials: newMaterials.toFixed(2),
      energy: newEnergy.toFixed(2),
      food: newFood.toFixed(2),
      lastActive: new Date(),
      updatedAt: new Date()
     } as any).where(eq(schema.cities.id, city.id));

    await db.insert(schema.resourceTicks).values({
      cityId: city.id,
      creditsDelta: creditsDelta.toFixed(2 as any),
      materialsDelta: materialsDelta.toFixed(2),
      energyDelta: energyDelta.toFixed(2),
      foodDelta: foodDelta.toFixed(2),
      source: 'production',
      details: { buildingCount: buildings.length, policyCount: policies.length }
    });

    res.json({ 
      success: true, 
      data: {
        creditsDelta: creditsDelta.toFixed(2),
        materialsDelta: materialsDelta.toFixed(2),
        energyDelta: energyDelta.toFixed(2),
        foodDelta: foodDelta.toFixed(2),
        newResources: {
          credits: newCredits.toFixed(2),
          materials: newMaterials.toFixed(2),
          energy: newEnergy.toFixed(2),
          food: newFood.toFixed(2)
        }
      }
    });
  } catch (error) {
    console.error('❌ [RIDDLECITY] Resource tick error:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ============================================================================
// POLICY DEFINITIONS
// ============================================================================

router.get('/policies/catalog', readOnlyAuth, async (req, res) => {
  try {
    const policies = await db.query.policyDefinitions.findMany({
      where: eq(schema.policyDefinitions.isActive, true)
    });

    const grouped = policies.reduce((acc, policy) => {
      if (!acc[policy.category]) {
        acc[policy.category] = [];
      }
      acc[policy.category].push(policy);
      return acc;
    }, {} as Record<string, typeof policies>);

    res.json({ success: true, data: { policies, grouped } });
  } catch (error) {
    console.error('❌ [RIDDLECITY] Get policy catalog error:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ============================================================================
// POLICY OPERATIONS
// ============================================================================

router.post('/policies/enact', sessionAuth, async (req, res) => {
  try {
    const { handle } = req.user;
    const { policyType, duration } = req.body;

    const city = await db.query.cities.findFirst({
      where: eq(schema.cities.userHandle, handle)
    });

    if (!city) {
      return res.status(404).json({ success: false, error: 'City not found' });
    }

    const policyDef = await db.query.policyDefinitions.findFirst({
      where: and(
        eq(schema.policyDefinitions.policyType, policyType),
        eq(schema.policyDefinitions.isActive, true)
      )
    });

    if (!policyDef) {
      return res.status(404).json({ success: false, error: 'Policy not found' });
    }

    if (city.cityLevel < policyDef.requiredCityLevel) {
      return res.status(400).json({ success: false, error: `Requires city level ${policyDef.requiredCityLevel}` });
    }

    const cost = parseFloat(policyDef.implementationCost);
    if (parseFloat(city.credits) < cost) {
      return res.status(400).json({ success: false, error: 'Not enough credits' });
    }

    const existingPolicy = await db.query.cityPolicies.findFirst({
      where: and(
        eq(schema.cityPolicies.cityId, city.id),
        eq(schema.cityPolicies.policyType, policyType),
        eq(schema.cityPolicies.isActive, true)
      )
    });

    if (existingPolicy) {
      return res.status(400).json({ success: false, error: 'Policy already active' });
    }

    const expiresAt = duration ? new Date(Date.now() + duration * 24 * 60 * 60 * 1000) : null;

    const [newPolicy] = await db.insert(schema.cityPolicies).values({
      cityId: city.id,
      policyType: policyType,
      enactedAt: new Date(),
      expiresAt: expiresAt,
      isActive: true
    }).returning();

    await db.update(schema.cities).set({ 
      credits: (parseFloat(city.credits) - cost).toFixed(2),
      happiness: Math.min(100, Math.max(0, city.happiness + policyDef.happinessModifier)),
      updatedAt: new Date()
     } as any).where(eq(schema.cities.id, city.id));

    await db.insert(schema.resourceTicks).values({
      cityId: city.id,
      creditsDelta: (-cost as any).toFixed(2),
      materialsDelta: '0.00',
      energyDelta: '0.00',
      foodDelta: '0.00',
      source: 'policy',
      details: { policyType, action: 'enacted' }
    });

    res.json({ success: true, data: newPolicy });
  } catch (error) {
    console.error('❌ [RIDDLECITY] Enact policy error:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.delete('/policies/:policyId', sessionAuth, async (req, res) => {
  try {
    const { handle } = req.user;
    const policyId = parseInt(req.params.policyId);

    const policy = await db.query.cityPolicies.findFirst({
      where: eq(schema.cityPolicies.id, policyId)
    });

    if (!policy) {
      return res.status(404).json({ success: false, error: 'Policy not found' });
    }

    const city = await db.query.cities.findFirst({
      where: and(
        eq(schema.cities.id, policy.cityId),
        eq(schema.cities.userHandle, handle)
      )
    });

    if (!city) {
      return res.status(403).json({ success: false, error: 'Not your city' });
    }

    await db.update(schema.cityPolicies).set({ 
      isActive: false
     } as any).where(eq(schema.cityPolicies.id, policyId));

    const policyDef = await db.query.policyDefinitions.findFirst({
      where: eq(schema.policyDefinitions.policyType, policy.policyType)
    });

    if (policyDef) {
      await db.update(schema.cities).set({ 
        happiness: Math.min(100, Math.max(0, city.happiness - policyDef.happinessModifier)),
        updatedAt: new Date()
       } as any).where(eq(schema.cities.id, city.id));
    }

    res.json({ success: true, message: 'Policy rescinded' });
  } catch (error) {
    console.error('❌ [RIDDLECITY] Rescind policy error:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ============================================================================
// DEFENSE SYSTEMS CATALOG
// ============================================================================

router.get('/defense/catalog', readOnlyAuth, async (req, res) => {
  try {
    const defenseSystems = await db.query.defenseSystemsCatalog.findMany({
      where: eq(schema.defenseSystemsCatalog.isActive, true)
    });

    res.json({ success: true, data: defenseSystems });
  } catch (error) {
    console.error('❌ [RIDDLECITY] Get defense catalog error:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ============================================================================
// DEFENSE OPERATIONS
// ============================================================================

router.post('/defense/activate', sessionAuth, async (req, res) => {
  try {
    const { handle } = req.user;
    const { systemType } = req.body;

    const city = await db.query.cities.findFirst({
      where: eq(schema.cities.userHandle, handle)
    });

    if (!city) {
      return res.status(404).json({ success: false, error: 'City not found' });
    }

    const defenseDef = await db.query.defenseSystemsCatalog.findFirst({
      where: and(
        eq(schema.defenseSystemsCatalog.systemType, systemType),
        eq(schema.defenseSystemsCatalog.isActive, true)
      )
    });

    if (!defenseDef) {
      return res.status(404).json({ success: false, error: 'Defense system not found' });
    }

    if (city.cityLevel < defenseDef.requiredCityLevel) {
      return res.status(400).json({ success: false, error: `Requires city level ${defenseDef.requiredCityLevel}` });
    }

    const creditCost = parseFloat(defenseDef.creditCost);
    const materialCost = parseFloat(defenseDef.materialCost);

    if (parseFloat(city.credits) < creditCost) {
      return res.status(400).json({ success: false, error: 'Not enough credits' });
    }

    if (parseFloat(city.materials) < materialCost) {
      return res.status(400).json({ success: false, error: 'Not enough materials' });
    }

    const [newDefense] = await db.insert(schema.cityDefenses).values({
      cityId: city.id,
      systemType: systemType,
      level: 1,
      strength: defenseDef.defenseStrength
    } as any).returning();

    await db.update(schema.cities).set({ 
      credits: (parseFloat(city.credits) - creditCost).toFixed(2),
      materials: (parseFloat(city.materials) - materialCost).toFixed(2),
      defenseRating: city.defenseRating + defenseDef.defenseStrength,
      updatedAt: new Date()
     } as any).where(eq(schema.cities.id, city.id));

    await db.insert(schema.resourceTicks).values({
      cityId: city.id,
      creditsDelta: (-creditCost as any).toFixed(2),
      materialsDelta: (-materialCost).toFixed(2),
      energyDelta: '0.00',
      foodDelta: '0.00',
      source: 'defense',
      details: { systemType, action: 'activated' }
    });

    res.json({ success: true, data: newDefense });
  } catch (error) {
    console.error('❌ [RIDDLECITY] Activate defense error:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.delete('/defense/:defenseId', sessionAuth, async (req, res) => {
  try {
    const { handle } = req.user;
    const defenseId = parseInt(req.params.defenseId);

    const defense = await db.query.cityDefenses.findFirst({
      where: eq(schema.cityDefenses.id, defenseId)
    });

    if (!defense) {
      return res.status(404).json({ success: false, error: 'Defense system not found' });
    }

    const city = await db.query.cities.findFirst({
      where: and(
        eq(schema.cities.id, defense.cityId),
        eq(schema.cities.userHandle, handle)
      )
    });

    if (!city) {
      return res.status(403).json({ success: false, error: 'Not your city' });
    }

    await db.delete(schema.cityDefenses).where(eq(schema.cityDefenses.id, defenseId));

    await db.update(schema.cities).set({ 
      defenseRating: Math.max(0, city.defenseRating - defense.strength),
      updatedAt: new Date()
     } as any).where(eq(schema.cities.id, city.id));

    res.json({ success: true, message: 'Defense system deactivated' });
  } catch (error) {
    console.error('❌ [RIDDLECITY] Deactivate defense error:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ============================================================================
// NFT CITIZEN OPERATIONS
// ============================================================================

router.post('/citizens/assign', sessionAuth, async (req, res) => {
  try {
    const { handle } = req.user;
    const { nftId, nftTokenId, nftCollection, assignedRole, assignedBuildingId } = req.body;

    const city = await db.query.cities.findFirst({
      where: eq(schema.cities.userHandle, handle)
    });

    if (!city) {
      return res.status(404).json({ success: false, error: 'City not found' });
    }

    const existingCitizen = await db.query.cityCitizens.findFirst({
      where: and(
        eq(schema.cityCitizens.cityId, city.id),
        eq(schema.cityCitizens.nftTokenId, nftTokenId)
      )
    });

    if (existingCitizen) {
      return res.status(400).json({ success: false, error: 'NFT already assigned to this city' });
    }

    const economicBonus = Math.random() * 0.15;
    const productionBonus = Math.random() * 0.15;
    const defenseBonus = Math.floor(Math.random() * 20);
    const happinessBonus = Math.floor(Math.random() * 15);

    const [newCitizen] = await db.insert(schema.cityCitizens).values({
      cityId: city.id,
      nftId: nftId,
      nftTokenId: nftTokenId,
      nftCollection: nftCollection,
      assignedRole: assignedRole || 'worker',
      assignedBuildingId: assignedBuildingId || null,
      economicBonus: economicBonus.toFixed(2 as any),
      productionBonus: productionBonus.toFixed(2),
      defenseBonus: defenseBonus,
      happinessBonus: happinessBonus
    }).returning();

    await db.update(schema.cities).set({ 
      population: city.population + 1,
      defenseRating: city.defenseRating + defenseBonus,
      happiness: Math.min(100, city.happiness + happinessBonus),
      updatedAt: new Date()
     } as any).where(eq(schema.cities.id, city.id));

    res.json({ success: true, data: newCitizen });
  } catch (error) {
    console.error('❌ [RIDDLECITY] Assign citizen error:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.patch('/citizens/:citizenId', sessionAuth, async (req, res) => {
  try {
    const { handle } = req.user;
    const citizenId = parseInt(req.params.citizenId);
    const { assignedRole, assignedBuildingId } = req.body;

    const citizen = await db.query.cityCitizens.findFirst({
      where: eq(schema.cityCitizens.id, citizenId)
    });

    if (!citizen) {
      return res.status(404).json({ success: false, error: 'Citizen not found' });
    }

    const city = await db.query.cities.findFirst({
      where: and(
        eq(schema.cities.id, citizen.cityId),
        eq(schema.cities.userHandle, handle)
      )
    });

    if (!city) {
      return res.status(403).json({ success: false, error: 'Not your city' });
    }

    const [updatedCitizen] = await db.update(schema.cityCitizens).set({ 
      assignedRole: assignedRole !== undefined ? assignedRole : citizen.assignedRole,
      assignedBuildingId: assignedBuildingId !== undefined ? assignedBuildingId : citizen.assignedBuildingId
     } as any).where(eq(schema.cityCitizens.id, citizenId)).returning();

    res.json({ success: true, data: updatedCitizen });
  } catch (error) {
    console.error('❌ [RIDDLECITY] Update citizen error:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.delete('/citizens/:citizenId', sessionAuth, async (req, res) => {
  try {
    const { handle } = req.user;
    const citizenId = parseInt(req.params.citizenId);

    const citizen = await db.query.cityCitizens.findFirst({
      where: eq(schema.cityCitizens.id, citizenId)
    });

    if (!citizen) {
      return res.status(404).json({ success: false, error: 'Citizen not found' });
    }

    const city = await db.query.cities.findFirst({
      where: and(
        eq(schema.cities.id, citizen.cityId),
        eq(schema.cities.userHandle, handle)
      )
    });

    if (!city) {
      return res.status(403).json({ success: false, error: 'Not your city' });
    }

    await db.delete(schema.cityCitizens).where(eq(schema.cityCitizens.id, citizenId));

    await db.update(schema.cities).set({ 
      population: Math.max(0, city.population - 1),
      defenseRating: Math.max(0, city.defenseRating - citizen.defenseBonus),
      happiness: Math.max(0, city.happiness - citizen.happinessBonus),
      updatedAt: new Date()
     } as any).where(eq(schema.cities.id, city.id));

    res.json({ success: true, message: 'Citizen removed' });
  } catch (error) {
    console.error('❌ [RIDDLECITY] Remove citizen error:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ============================================================================
// TRANSACTION HISTORY
// ============================================================================

router.get('/transactions', readOnlyAuth, async (req, res) => {
  try {
    const { handle } = req.user;
    const limit = parseInt(req.query.limit as string) || 50;

    const city = await db.query.cities.findFirst({
      where: eq(schema.cities.userHandle, handle)
    });

    if (!city) {
      return res.status(404).json({ success: false, error: 'City not found' });
    }

    const transactions = await db.query.cityTransactions.findMany({
      where: eq(schema.cityTransactions.cityId, city.id),
      orderBy: desc(schema.cityTransactions.createdAt),
      limit: limit
    });

    res.json({ success: true, data: transactions });
  } catch (error) {
    console.error('❌ [RIDDLECITY] Get transactions error:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ============================================================================
// GAMEPLAY STATISTICS
// ============================================================================

router.get('/stats', readOnlyAuth, async (req, res) => {
  try {
    const { handle } = req.user;

    const city = await db.query.cities.findFirst({
      where: eq(schema.cities.userHandle, handle),
      with: {
        buildings: true
        // Temporarily disabled due to relation errors:
        // citizens: true,
        // furnishings: true,
        // shops: true,
        // defenses: true,
        // policies: true
      }
    });

    if (!city) {
      return res.status(404).json({ success: false, error: 'City not found' });
    }

    const activeBuildings = city.buildings.filter(b => b.constructionStatus === 'active').length;
    const constructingBuildings = city.buildings.filter(b => b.constructionStatus === 'constructing').length;

    const totalDefenseStrength = city.defenses.reduce((sum, d) => sum + d.strength, 0);

    const citizenBonuses = city.citizens.reduce((acc, c) => {
      acc.economic += parseFloat(c.economicBonus || '0');
      acc.production += parseFloat(c.productionBonus || '0');
      acc.defense += c.defenseBonus;
      acc.happiness += c.happinessBonus;
      return acc;
    }, { economic: 0, production: 0, defense: 0, happiness: 0 });

    res.json({
      success: true,
      data: {
        city: {
          name: city.cityName,
          level: city.cityLevel,
          experience: city.experiencePoints,
          population: `${city.population}/${city.populationCapacity}`,
          happiness: city.happiness
        },
        resources: {
          credits: city.credits,
          materials: city.materials,
          energy: city.energy,
          food: city.food
        },
        buildings: {
          total: city.buildings.length,
          active: activeBuildings,
          constructing: constructingBuildings
        },
        economy: {
          furnishings: city.furnishings.length,
          shops: city.shops.length,
          economicValue: city.economicValue
        },
        defense: {
          rating: city.defenseRating,
          systems: city.defenses.length,
          totalStrength: totalDefenseStrength
        },
        politics: {
          activePolicies: city.policies.filter(p => p.isActive).length
        },
        citizens: {
          total: city.citizens.length,
          bonuses: citizenBonuses
        }
      }
    });
  } catch (error) {
    console.error('❌ [RIDDLECITY] Get stats error:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;
