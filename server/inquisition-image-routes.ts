/**
 * Inquisition Image Generation Routes
 * API endpoints for generating army crests, logos, and NFT artwork
 */

import { Router } from 'express';
import {
  generateInquisitionImage,
  generateArmyBrandingSet,
  generateCharacterFromNFT,
  saveInquisitionImage,
  type InquisitionImageOptions,
} from './inquisition-image-generator';
import { db } from './db';
import { gamingNfts } from '../shared/schema';
import { eq } from 'drizzle-orm';

export function setupInquisitionImageRoutes(app: Router) {
  console.log('🎨 [API] Setting up Inquisition image generation routes...');

  /**
   * Generate single image (crest, logo, character, weapon, or banner)
   */
  app.post('/api/inquisition/generate-image', async (req, res) => {
    try {
      const options: InquisitionImageOptions = req.body;

      if (!options.type) {
        return res.status(400).json({
          success: false,
          error: 'Image type is required (crest, logo, character, weapon, or banner)',
        });
      }

      console.log(`🎨 [API] Generating ${options.type} image...`);
      const result = await generateInquisitionImage(options);

      if (!result.success) {
        return res.status(500).json(result);
      }

      // Always save to Object Storage for persistence (production-ready)
      if (result.base64) {
        const fileName = `${options.type}_${Date.now()}`;
        const savedPath = await saveInquisitionImage(result.base64, fileName);
        return res.json({
          success: true,
          imageUrl: savedPath, // Persistent storage URL
          savedPath,
          message: `${options.type} image generated and saved successfully`
        });
      }

      res.json(result);
    } catch (error: any) {
      console.error('❌ [API] Image generation error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate image',
      });
    }
  });

  /**
   * Generate complete army branding set (crest + logo + banner)
   */
  app.post('/api/inquisition/generate-army-branding', async (req, res) => {
    try {
      const { armyName, powerTypes, style, colors, save } = req.body;

      if (!armyName) {
        return res.status(400).json({
          success: false,
          error: 'Army name is required',
        });
      }

      console.log(`🎨 [API] Generating complete branding for army: ${armyName}`);
      const result = await generateArmyBrandingSet(armyName, powerTypes, style, colors);

      // Always save all images to Object Storage for persistence (production-ready)
      const timestamp = Date.now();
      const savedPaths: any = {};

      if (result.crest.success && result.crest.base64) {
        savedPaths.crest = await saveInquisitionImage(
          result.crest.base64,
          `${armyName.toLowerCase().replace(/\s+/g, '_')}_crest_${timestamp}`
        );
      }

      if (result.logo.success && result.logo.base64) {
        savedPaths.logo = await saveInquisitionImage(
          result.logo.base64,
          `${armyName.toLowerCase().replace(/\s+/g, '_')}_logo_${timestamp}`
        );
      }

      if (result.banner.success && result.banner.base64) {
        savedPaths.banner = await saveInquisitionImage(
          result.banner.base64,
          `${armyName.toLowerCase().replace(/\s+/g, '_')}_banner_${timestamp}`
        );
      }

      return res.json({
        ...result,
        savedPaths,
      });
    } catch (error: any) {
      console.error('❌ [API] Army branding generation error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate army branding',
      });
    }
  });

  /**
   * Generate character art from NFT metadata
   */
  app.post('/api/inquisition/generate-character-from-nft', async (req, res) => {
    try {
      const { nft, save } = req.body;

      if (!nft || !nft.name) {
        return res.status(400).json({
          success: false,
          error: 'NFT data with name is required',
        });
      }

      if (!nft.nft_id && !nft.id) {
        return res.status(400).json({
          success: false,
          error: 'NFT ID (nft_id or id) is required to save the image',
        });
      }

      console.log(`🎨 [API] Generating character art for NFT: ${nft.name} (ID: ${nft.nft_id || nft.id})`);
      const result = await generateCharacterFromNFT(nft);

      if (!result.success) {
        return res.status(500).json(result);
      }

      // Always save to Object Storage for persistence (production-ready)
      if (result.base64) {
        const fileName = `character_${nft.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
        const savedPath = await saveInquisitionImage(result.base64, fileName);
        
        // 🔥 FIX: Update database with AI-generated image URL
        const nftIdentifier = nft.nft_id || nft.id;
        console.log(`💾 [API] Saving image URL to database for NFT: ${nftIdentifier}`);
        
        try {
          await db
            .update(gamingNfts)
            .set({ 
              ai_generated_image_url: savedPath,
              ai_image_generated_at: new Date(),
              updated_at: new Date(),
             } as any)
            .where(eq(gamingNfts.nft_id, nftIdentifier));
          
          console.log(`✅ [API] Database updated successfully for NFT: ${nftIdentifier}`);
        } catch (dbError: any) {
          console.error(`❌ [API] Database update failed for NFT ${nftIdentifier}:`, dbError);
          // Continue anyway - image was saved to storage
        }
        
        return res.json({
          success: true,
          imageUrl: savedPath, // Persistent storage URL
          savedPath,
          message: `Character art generated, saved to storage, and database updated successfully`
        });
      }

      res.json(result);
    } catch (error: any) {
      console.error('❌ [API] Character generation error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate character art',
      });
    }
  });

  /**
   * Get OpenAI API status
   */
  app.get('/api/inquisition/status', (req, res) => {
    const apiKeyConfigured = !!process.env.OPENAI_API_KEY;
    res.json({
      openaiConfigured: apiKeyConfigured,
      availableTypes: ['crest', 'logo', 'character', 'weapon', 'banner'],
      availableStyles: ['medieval', 'fantasy', 'dark', 'gold', 'royal'],
      status: apiKeyConfigured ? 'ready' : 'api_key_required',
    });
  });

  /**
   * Alias endpoint for Oracle image generation (for backwards compatibility)
   */
  app.post('/api/oracle/generate-image', async (req, res) => {
    try {
      const { prompt, style, user_handle, image_type } = req.body;

      console.log(`🎨 [ORACLE] Generating image for ${user_handle}: ${image_type}`);

      // Map image types
      const typeMapping: Record<string, 'crest' | 'logo' | 'character'> = {
        'player_portrait': 'character',
        'civilization_crest': 'crest',
        'commander_avatar': 'character'
      };

      const inquisitionType = typeMapping[image_type] || 'character';

      // Use direct prompt for custom requests
      const result = await generateInquisitionImage({
        type: inquisitionType,
        style: style === 'medieval_fantasy' ? 'fantasy' : 'medieval'
      });

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: result.error || 'Failed to generate image'
        });
      }

      // Always save to Object Storage for persistence (production-ready)
      let persistentImageUrl = result.imageUrl;
      if (result.base64) {
        const fileName = `oracle_${image_type}_${user_handle}_${Date.now()}`;
        persistentImageUrl = await saveInquisitionImage(result.base64, fileName);
      }

      res.json({
        success: true,
        image_url: persistentImageUrl, // Persistent storage URL
        description: `Generated ${image_type} for ${user_handle}`
      });
    } catch (error: any) {
      console.error('❌ [ORACLE] Image generation error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate image'
      });
    }
  });

  console.log('✅ [API] Inquisition image generation routes registered successfully');
}
