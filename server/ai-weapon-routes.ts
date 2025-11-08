import express from 'express';
import { z } from 'zod';
import { aiWeaponImageService, type WeaponImageOptions } from './ai-weapon-image-service.js';
import { sessionAuth, type AuthenticatedRequest } from './middleware/session-auth.js';

const router = express.Router();

// Request validation schemas
const generateWeaponImageSchema = z.object({
  weaponType: z.enum(['sword', 'axe', 'bow', 'armor', 'shield', 'staff', 'dagger', 'mace', 'spear', 'crossbow']),
  techLevel: z.enum(['primitive', 'medieval', 'advanced', 'futuristic', 'magical']),
  color: z.enum(['bronze', 'iron', 'steel', 'gold', 'silver', 'crystal', 'obsidian', 'mithril', 'adamantine']),
  armyColor: z.enum(['red', 'blue', 'green', 'purple', 'orange', 'black', 'white', 'cyan', 'yellow']).optional(),
  rarity: z.enum(['common', 'rare', 'epic', 'legendary']),
  customDetails: z.string().max(200).optional()
});

const batchGenerateSchema = z.object({
  weapons: z.array(generateWeaponImageSchema).min(1).max(10)
});

// Generate single weapon image
router.post('/generate-weapon-image', sessionAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const validatedData = generateWeaponImageSchema.parse(req.body);
    
    // Validate options
    const validationErrors = aiWeaponImageService.validateWeaponOptions(validatedData);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid weapon options',
        details: validationErrors
      });
    }

    console.log(`🎨 [AI-WEAPON-API] User ${req.user?.userHandle || 'unknown'} generating ${validatedData.weaponType} image`);

    const result = await aiWeaponImageService.generateWeaponImage(validatedData);

    res.json({
      success: true,
      data: result,
      weapon: validatedData
    });

  } catch (error) {
    console.error('❌ [AI-WEAPON-API] Generation failed:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Image generation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Generate batch weapon images
router.post('/generate-weapon-batch', sessionAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const validatedData = batchGenerateSchema.parse(req.body);
    
    // Validate each weapon option
    const allErrors: string[] = [];
    validatedData.weapons.forEach((weapon, index) => {
      const errors = aiWeaponImageService.validateWeaponOptions(weapon);
      if (errors.length > 0) {
        allErrors.push(`Weapon ${index + 1}: ${errors.join(', ')}`);
      }
    });

    if (allErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid weapon options',
        details: allErrors
      });
    }

    console.log(`🎨 [AI-WEAPON-API] User ${req.user?.userHandle || 'unknown'} generating batch of ${validatedData.weapons.length} weapons`);

    const results = await aiWeaponImageService.generateBatchWeaponImages(validatedData.weapons);

    res.json({
      success: true,
      data: results,
      totalGenerated: results.length,
      totalRequested: validatedData.weapons.length
    });

  } catch (error) {
    console.error('❌ [AI-WEAPON-API] Batch generation failed:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Batch generation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Generate starter weapon set for marketplace
router.post('/generate-starter-weapons', sessionAuth, async (req: AuthenticatedRequest, res) => {
  try {
    // Only allow admins to generate starter weapons
    const userHandle = req.user?.userHandle;
    if (!userHandle || userHandle !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: Admin access required'
      });
    }

    console.log(`🎨 [AI-WEAPON-API] Admin generating starter weapon set`);

    const results = await aiWeaponImageService.generateStarterWeaponSet();

    res.json({
      success: true,
      data: results,
      message: 'Starter weapon set generated successfully'
    });

  } catch (error) {
    console.error('❌ [AI-WEAPON-API] Starter generation failed:', error);
    
    res.status(500).json({
      success: false,
      error: 'Starter weapon generation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get weapon generation options (for frontend dropdowns)
router.get('/weapon-options', (req, res) => {
  const options = {
    weaponTypes: ['sword', 'axe', 'bow', 'armor', 'shield', 'staff', 'dagger', 'mace', 'spear', 'crossbow'],
    techLevels: ['primitive', 'medieval', 'advanced', 'futuristic', 'magical'],
    colors: ['bronze', 'iron', 'steel', 'gold', 'silver', 'crystal', 'obsidian', 'mithril', 'adamantine'],
    armyColors: ['red', 'blue', 'green', 'purple', 'orange', 'black', 'white', 'cyan', 'yellow'],
    rarities: ['common', 'rare', 'epic', 'legendary']
  };

  res.json({
    success: true,
    data: options
  });
});

// Test endpoint to verify service is working
router.get('/test', sessionAuth, (req: AuthenticatedRequest, res) => {
  res.json({
    success: true,
    message: 'AI Weapon Image Service is operational',
    user: req.user?.userHandle || 'unknown',
    timestamp: new Date().toISOString()
  });
});

export default router;