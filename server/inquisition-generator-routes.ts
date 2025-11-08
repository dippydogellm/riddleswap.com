/**
 * Inquisition Member Generator API Routes
 * 
 * Provides endpoints for generating AI-powered inquisition members
 */

import express from 'express';
import { z } from 'zod';
import { sessionAuth, type AuthenticatedRequest } from './middleware/session-auth';
import { inquisitionGeneratorService } from './inquisition-generator-service';

const router = express.Router();

// Request validation schemas
const generateMemberSchema = z.object({
  seed: z.string().optional(),
  material: z.enum(['steel', 'iron', 'gold', 'silver', 'bronze', 'mythril', 'adamant', 'dragon_scale', 'holy', 'cursed']).optional(),
  playerType: z.enum(['priest', 'knight', 'commander', 'warrior', 'mage', 'archer', 'rogue']).optional(),
  rarity: z.enum(['common', 'rare', 'epic', 'legendary']).optional()
});

/**
 * POST /api/gaming/inquisition-members/generate
 * Generate a new inquisition member with AI-generated content
 */
router.post('/generate', sessionAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userHandle = req.user?.userHandle;
    if (!userHandle) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Rate limiting - max 3 generations per hour per user
    // TODO: Implement proper rate limiting in production
    
    const validatedData = generateMemberSchema.parse(req.body);
    
    console.log(`🎭 [INQUISITION-API] User ${userHandle} generating inquisition member`);

    const member = await inquisitionGeneratorService.generateInquisitionMember(
      userHandle,
      validatedData
    );

    res.json({
      success: true,
      data: member,
      message: 'Inquisition member generated successfully'
    });

  } catch (error) {
    console.error('❌ [INQUISITION-API] Generation failed:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to generate inquisition member',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/gaming/inquisition-members/my-members
 * Get all generated members for the current user
 */
router.get('/my-members', sessionAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userHandle = req.user?.userHandle;
    if (!userHandle) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const members = await inquisitionGeneratorService.getUserGeneratedMembers(userHandle);

    res.json({
      success: true,
      data: members,
      count: members.length
    });

  } catch (error) {
    console.error('❌ [INQUISITION-API] Failed to fetch members:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch generated members'
    });
  }
});

/**
 * GET /api/gaming/inquisition-members/generation-options
 * Get available options for character generation (PUBLIC - no auth required)
 */
router.get('/generation-options', (req, res) => {
  const options = {
    materials: ['steel', 'iron', 'gold', 'silver', 'bronze', 'mythril', 'adamant', 'dragon_scale', 'holy', 'cursed'],
    playerTypes: ['priest', 'knight', 'commander', 'warrior', 'mage', 'archer', 'rogue'],
    rarities: ['common', 'rare', 'epic', 'legendary']
  };

  res.json({
    success: true,
    data: options
  });
});

/**
 * GET /api/gaming/inquisition-members/:id
 * Get a specific generated member by ID
 * IMPORTANT: This route must come AFTER all specific routes (my-members, generation-options)
 */
router.get('/:id', sessionAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userHandle = req.user?.userHandle;
    if (!userHandle) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const { id } = req.params;
    
    // For now, get all user members and find the specific one
    // In production, you'd want a more efficient query
    const members = await inquisitionGeneratorService.getUserGeneratedMembers(userHandle);
    const member = members.find(m => m.id === id);

    if (!member) {
      return res.status(404).json({
        success: false,
        error: 'Member not found'
      });
    }

    res.json({
      success: true,
      data: member
    });

  } catch (error) {
    console.error('❌ [INQUISITION-API] Failed to fetch member:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch member'
    });
  }
});

/**
 * POST /api/gaming/inquisition-members/:id/regenerate-story
 * Regenerate just the story for an existing member
 */
router.post('/:id/regenerate-story', sessionAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userHandle = req.user?.userHandle;
    if (!userHandle) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // This would require extending the service to support story regeneration
    // For now, return a placeholder response
    res.status(501).json({
      success: false,
      error: 'Story regeneration not yet implemented'
    });

  } catch (error) {
    console.error('❌ [INQUISITION-API] Failed to regenerate story:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to regenerate story'
    });
  }
});

/**
 * POST /api/gaming/inquisition-members/:id/mint
 * Mint a generated member as an NFT (future feature)
 */
router.post('/:id/mint', sessionAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userHandle = req.user?.userHandle;
    if (!userHandle) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Future feature - mint the generated member as an actual NFT
    res.status(501).json({
      success: false,
      error: 'NFT minting not yet implemented',
      message: 'This feature will allow you to mint your generated member as an actual NFT'
    });

  } catch (error) {
    console.error('❌ [INQUISITION-API] Failed to mint member:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to mint member'
    });
  }
});

export default router;