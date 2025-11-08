import type { Express } from 'express';
import { db } from '../db';
import { weaponDefinitions, playerNftWeapons, weaponMarketplace, gamingPlayers } from '../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { requireAuthentication, AuthenticatedRequest } from '../middleware/session-auth';
import OpenAI from 'openai';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

// Admin handles - only these users can seed starter weapons
const ADMIN_HANDLES = ['dippydoge', 'riddlbroker'];

export function setupWeaponsArsenalRoutes(app: Express) {
  console.log('⚔️ Registering Weapons Arsenal routes...');

  // GET /api/weapons/definitions - List all available weapon types
  app.get('/api/weapons/definitions', async (req, res) => {
    try {
      const definitions = await db.select().from(weaponDefinitions).where(eq(weaponDefinitions.isActive, true));
      
      res.json({
        success: true,
        weapons: definitions
      });
    } catch (error) {
      console.error('Error fetching weapon definitions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch weapon definitions'
      });
    }
  });

  // GET /api/weapons/my-arsenal - Get player's weapons
  app.get('/api/weapons/my-arsenal', requireAuthentication, async (req: AuthenticatedRequest, res) => {
    try {
      const userHandle = req.session.handle;
      if (!userHandle) {
        return res.status(401).json({
          success: false,
          error: 'Not authenticated'
        });
      }

      // Find the gaming player by handle
      const [player] = await db
        .select()
        .from(gamingPlayers)
        .where(eq(gamingPlayers.user_handle, userHandle))
        .limit(1);

      if (!player) {
        return res.json({
          success: true,
          weapons: [],
          message: 'No gaming profile found. Complete the character wizard first.'
        });
      }

      // Fetch player's weapons with weapon definitions joined
      const weapons = await db
        .select({
          weaponId: playerNftWeapons.id,
          nftTokenId: playerNftWeapons.nftTokenId,
          color: playerNftWeapons.color,
          techLevel: playerNftWeapons.techLevel,
          customName: playerNftWeapons.customName,
          imageUrl: playerNftWeapons.imageUrl,
          finalAttack: playerNftWeapons.finalAttack,
          finalDefense: playerNftWeapons.finalDefense,
          isEquipped: playerNftWeapons.isEquipped,
          equippedToArmyId: playerNftWeapons.equippedToArmyId,
          createdAt: playerNftWeapons.createdAt,
          // Weapon definition details
          definitionId: weaponDefinitions.id,
          name: weaponDefinitions.name,
          category: weaponDefinitions.category,
          weaponType: weaponDefinitions.weaponType,
          description: weaponDefinitions.description,
          rarity: weaponDefinitions.rarity,
          baseAttack: weaponDefinitions.baseAttack,
          baseDefense: weaponDefinitions.baseDefense,
          availableColors: weaponDefinitions.availableColors,
        })
        .from(playerNftWeapons)
        .innerJoin(weaponDefinitions, eq(playerNftWeapons.weaponDefinitionId, weaponDefinitions.id))
        .where(eq(playerNftWeapons.playerId, player.id))
        .orderBy(desc(playerNftWeapons.createdAt));

      res.json({
        success: true,
        weapons,
        totalCount: weapons.length
      });
    } catch (error) {
      console.error('Error fetching player arsenal:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch arsenal'
      });
    }
  });

  // POST /api/weapons/oracle/generate - Generate weapon image with Oracle AI
  app.post('/api/weapons/oracle/generate', requireAuthentication, async (req: AuthenticatedRequest, res) => {
    try {
      if (!openai) {
        return res.status(503).json({
          success: false,
          error: 'OpenAI integration not configured'
        });
      }

      const { weaponDefinitionId, color, techLevel } = req.body;

      if (!weaponDefinitionId) {
        return res.status(400).json({
          success: false,
          error: 'weaponDefinitionId is required'
        });
      }

      // Fetch weapon definition
      const [weaponDef] = await db
        .select()
        .from(weaponDefinitions)
        .where(eq(weaponDefinitions.id, weaponDefinitionId))
        .limit(1);

      if (!weaponDef) {
        return res.status(404).json({
          success: false,
          error: 'Weapon definition not found'
        });
      }

      // Construct AI prompt for weapon image
      const selectedColor = color || 'silver';
      const selectedTechLevel = techLevel || 1;
      
      const prompt = `A highly detailed, medieval fantasy ${weaponDef.weaponType} called "${weaponDef.name}". 
Dominant color scheme: ${selectedColor}. 
Tech level: ${selectedTechLevel}/5 (${selectedTechLevel === 1 ? 'basic craftsmanship' : selectedTechLevel === 2 ? 'skilled craftsmanship' : selectedTechLevel === 3 ? 'masterwork' : selectedTechLevel === 4 ? 'legendary quality' : 'godlike artifact'}).
Rarity: ${weaponDef.rarity}.
Category: ${weaponDef.category}.
${weaponDef.description}

Style: Photorealistic 3D render on dark background, dramatic lighting, ornate medieval design with ${selectedColor} metallic finish, intricate engravings, fantasy elements. No text or watermarks. Centered composition, slightly angled view.`;

      console.log('🎨 [ORACLE] Generating weapon image:', weaponDef.name);

      // Generate image with DALL-E 3
      const imageResponse = await openai.images.generate({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard'
      });

      const imageUrl = imageResponse.data?.[0]?.url;

      if (!imageUrl) {
        throw new Error('Failed to generate weapon image');
      }

      console.log('✅ [ORACLE] Weapon image generated successfully');

      res.json({
        success: true,
        imageUrl,
        weapon: {
          name: weaponDef.name,
          type: weaponDef.weaponType,
          rarity: weaponDef.rarity,
          color: selectedColor,
          techLevel: selectedTechLevel
        }
      });

    } catch (error) {
      console.error('Error generating weapon image:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate weapon image',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /api/weapons/marketplace - List weapons for sale
  app.get('/api/weapons/marketplace', async (req, res) => {
    try {
      const { limit = 50, offset = 0, rarity, category, minPrice, maxPrice } = req.query;

      // Build query with filters
      let query = db
        .select({
          listingId: weaponMarketplace.id,
          priceDrops: weaponMarketplace.priceDrops,
          description: weaponMarketplace.description,
          listingStatus: weaponMarketplace.status,
          listedAt: weaponMarketplace.createdAt,
          // Weapon details
          weaponId: playerNftWeapons.id,
          nftTokenId: playerNftWeapons.nftTokenId,
          color: playerNftWeapons.color,
          techLevel: playerNftWeapons.techLevel,
          customName: playerNftWeapons.customName,
          imageUrl: playerNftWeapons.imageUrl,
          finalAttack: playerNftWeapons.finalAttack,
          finalDefense: playerNftWeapons.finalDefense,
          // Weapon definition
          name: weaponDefinitions.name,
          weaponType: weaponDefinitions.weaponType,
          weaponRarity: weaponDefinitions.rarity,
          weaponCategory: weaponDefinitions.category,
          baseAttack: weaponDefinitions.baseAttack,
          baseDefense: weaponDefinitions.baseDefense,
          // Seller info
          sellerHandle: gamingPlayers.user_handle,
          sellerWallet: gamingPlayers.wallet_address,
        })
        .from(weaponMarketplace)
        .innerJoin(playerNftWeapons, eq(weaponMarketplace.weaponId, playerNftWeapons.id))
        .innerJoin(weaponDefinitions, eq(playerNftWeapons.weaponDefinitionId, weaponDefinitions.id))
        .innerJoin(gamingPlayers, eq(weaponMarketplace.sellerId, gamingPlayers.id))
        .where(eq(weaponMarketplace.status, 'active'))
        .orderBy(desc(weaponMarketplace.createdAt))
        .limit(Number(limit))
        .offset(Number(offset));

      const listings = await query;

      res.json({
        success: true,
        listings,
        count: listings.length,
        limit: Number(limit),
        offset: Number(offset)
      });
    } catch (error) {
      console.error('Error fetching marketplace:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch marketplace'
      });
    }
  });

  // POST /api/weapons/seed-starters - Seed 5 starter weapons (ADMIN ONLY)
  app.post('/api/weapons/seed-starters', requireAuthentication, async (req: AuthenticatedRequest, res) => {
    try {
      const userHandle = req.session.handle;
      
      // Admin check
      if (!userHandle || !ADMIN_HANDLES.includes(userHandle)) {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized: Admin access required'
        });
      }

      // Check if weapons already exist
      const existing = await db.select().from(weaponDefinitions).limit(1);
      if (existing.length > 0) {
        return res.json({
          success: true,
          message: 'Starter weapons already seeded',
          count: existing.length
        });
      }

      // Seed 5 starter weapons
      const starterWeapons = [
        {
          name: 'Crusader\'s Blade',
          category: 'weapon',
          weaponType: 'sword',
          description: 'A reliable longsword forged in the holy fires of the Crusades. Balanced for both offense and defense.',
          rarity: 'common',
          rarityMultiplier: '1.0',
          baseAttack: 15,
          baseDefense: 5,
          baseHealth: 0,
          baseSiegeBonus: 0,
          maxTechLevel: 5,
          techLevelMultiplier: '1.2',
          basePriceDrops: 1000000, // 1 XRP
          maxSupply: 1000,
          availableColors: ['silver', 'gold', 'blue', 'red', 'black']
        },
        {
          name: 'Hunter\'s Longbow',
          category: 'weapon',
          weaponType: 'bow',
          description: 'A masterfully crafted longbow made from ancient yew wood. Deadly accurate at long range.',
          rarity: 'uncommon',
          rarityMultiplier: '1.25',
          baseAttack: 20,
          baseDefense: 0,
          baseHealth: 0,
          baseSiegeBonus: 5,
          maxTechLevel: 5,
          techLevelMultiplier: '1.2',
          basePriceDrops: 2000000, // 2 XRP
          maxSupply: 750,
          availableColors: ['brown', 'green', 'silver', 'gold']
        },
        {
          name: 'Tower Shield of the Sentinel',
          category: 'armor',
          weaponType: 'shield',
          description: 'A massive iron shield emblazoned with the crest of ancient guardians. Provides exceptional protection.',
          rarity: 'uncommon',
          rarityMultiplier: '1.25',
          baseAttack: 0,
          baseDefense: 25,
          baseHealth: 50,
          baseSiegeBonus: 0,
          maxTechLevel: 5,
          techLevelMultiplier: '1.2',
          basePriceDrops: 2500000, // 2.5 XRP
          maxSupply: 500,
          availableColors: ['silver', 'gold', 'blue', 'black']
        },
        {
          name: 'Warlord\'s Battle Axe',
          category: 'weapon',
          weaponType: 'axe',
          description: 'A devastating two-handed axe favored by northern warlords. Cleaves through armor with brutal efficiency.',
          rarity: 'rare',
          rarityMultiplier: '1.5',
          baseAttack: 30,
          baseDefense: 0,
          baseHealth: 0,
          baseSiegeBonus: 10,
          maxTechLevel: 5,
          techLevelMultiplier: '1.2',
          basePriceDrops: 5000000, // 5 XRP
          maxSupply: 250,
          availableColors: ['silver', 'gold', 'red', 'black']
        },
        {
          name: 'Arcane Staff of the Elements',
          category: 'weapon',
          weaponType: 'staff',
          description: 'A mystical staff imbued with elemental magic. Channels devastating magical attacks while providing arcane protection.',
          rarity: 'epic',
          rarityMultiplier: '2.0',
          baseAttack: 25,
          baseDefense: 15,
          baseHealth: 25,
          baseSiegeBonus: 15,
          maxTechLevel: 5,
          techLevelMultiplier: '1.2',
          basePriceDrops: 10000000, // 10 XRP
          maxSupply: 100,
          availableColors: ['blue', 'purple', 'gold', 'silver', 'red']
        }
      ];

      const inserted = await db.insert(weaponDefinitions).values(starterWeapons as any).returning();

      console.log('✅ [ADMIN] Seeded 5 starter weapons by:', userHandle);

      res.json({
        success: true,
        message: 'Successfully seeded starter weapons',
        weapons: inserted
      });

    } catch (error) {
      console.error('Error seeding starter weapons:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to seed starter weapons',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  console.log('✅ Weapons Arsenal routes registered successfully');
}
