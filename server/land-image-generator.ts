/**
 * Land Plot Image Generator
 * Generates AI images for land plots using OpenAI DALL-E with permanent storage
 */

import OpenAI from 'openai';
import fetch from 'node-fetch';
import { Client } from '@replit/object-storage';
import { db } from './db';
import { medievalLandPlots } from '../shared/schema';
import { eq, sql } from 'drizzle-orm';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Initialize Replit Object Storage - lazy initialization to avoid startup failures
let storage: Client | null = null;

function getStorageClient(): Client {
  if (!storage) {
    try {
      storage = new Client();
    } catch (error) {
      console.warn('⚠️ Replit Object Storage not available, image generation will be disabled:', error);
      throw new Error('Object storage service unavailable');
    }
  }
  return storage;
}

interface LandPlotDetailed {
  plotNumber: number;
  
  // Map positioning
  mapX: number;
  mapY: number;
  gridSection: string; // A1, B2, etc.
  
  // Terrain
  terrainType: string;
  terrainSubtype?: string;
  
  // Size and dimensions
  plotSize: string; // small, standard, large, massive
  sizeMultiplier: number; // 0.5x, 1x, 1.5x, 2x
  
  // Geographic features
  elevation?: string; // low, medium, high, extreme
  climate?: string; // temperate, arid, tropical, arctic, mediterranean
  
  // Special features and resources
  specialFeatures?: string[];
  resourceNodes?: Record<string, any>;
  plotResources?: Record<string, any>; // Inquisition materials
  
  // Bonuses
  yieldRate?: number;
  defenseBonus?: number;
  productionRateBonus?: number;
  happinessModifier?: number;
  
  // Lore and description
  description?: string;
  lore?: string;
}

// Simplified interface for backward compatibility
interface LandPlot {
  plotNumber: number;
  terrainType: string;
  terrainSubtype: string;
  specialFeatures: string[];
  description: string;
}

class LandImageGenerator {
  /**
   * Generate EXTREMELY detailed image prompt based on ALL land plot characteristics
   */
  private generateEnhancedPrompt(plot: LandPlotDetailed): string {
    let prompt = "Medieval fantasy land plot artwork, highly detailed illustration. ";
    
    // 1. Grid position and size information
    prompt += `Grid section ${plot.gridSection} at coordinates (${plot.mapX}, ${plot.mapY}). `;
    
    // 2. Plot size with specific dimensions
    const sizeDescriptions: Record<string, string> = {
      'small': 'Small plot (0.5x standard size), compact territory',
      'standard': 'Standard sized plot (1x baseline), average territory',
      'large': 'Large plot (1.5x standard size), expansive territory',
      'massive': 'Massive plot (2x standard size), vast sprawling territory'
    };
    const sizeDesc = sizeDescriptions[plot.plotSize] || sizeDescriptions['standard'];
    prompt += sizeDesc + ' with ';
    
    // 3. Terrain type and subtype with rich descriptions
    const terrainDetails: Record<string, string> = {
      plains: 'rolling grasslands with golden wheat fields, wildflower meadows',
      forest: 'dense ancient woodlands with towering oaks and mystical groves',
      mountain: 'dramatic rocky peaks with snow-capped summits and alpine valleys',
      water: 'coastal waters with rocky cliffs, sandy beaches, tidal pools',
      swamp: 'misty marshlands with twisted trees, bog waters, mysterious fog',
      desert: 'endless sand dunes, rocky outcroppings, sparse oasis vegetation',
      tundra: 'frozen wasteland with permafrost, ice formations, arctic winds'
    };
    
    const baseTerrainDesc = terrainDetails[plot.terrainType] || 'natural landscape';
    prompt += baseTerrainDesc;
    
    // Add subtype details
    if (plot.terrainSubtype) {
      const subtypeClean = plot.terrainSubtype.replace(/_/g, ' ');
      prompt += ` specifically showing ${subtypeClean}`;
    }
    prompt += '. ';
    
    // 4. Elevation details
    const elevationMap: Record<string, string> = {
      'low': 'Low elevation (0-100m) with gentle slopes',
      'medium': 'Medium elevation (100-500m) with rolling hills',
      'high': 'High elevation (500-1000m) with steep terrain',
      'extreme': 'Extreme elevation (1000m+) with towering heights'
    };
    if (plot.elevation) {
      prompt += elevationMap[plot.elevation] || '';
      prompt += '. ';
    }
    
    // 5. Climate information
    const climateDescriptions: Record<string, string> = {
      temperate: 'temperate climate with four seasons, moderate weather',
      arid: 'arid climate with dry conditions, sparse rainfall',
      tropical: 'tropical climate with lush vegetation, high humidity',
      arctic: 'arctic climate with perpetual cold, ice and snow',
      mediterranean: 'mediterranean climate with warm summers, mild winters'
    };
    if (plot.climate) {
      prompt += 'The land has a ' + (climateDescriptions[plot.climate] || 'varied climate') + '. ';
    }
    
    // 6. Resource nodes (Inquisition materials)
    if (plot.resourceNodes && Object.keys(plot.resourceNodes).length > 0) {
      const resources = Object.entries(plot.resourceNodes);
      prompt += 'Visible resource deposits include: ';
      
      const resourceVisuals: Record<string, string> = {
        gold_mine: 'golden ore veins glinting in exposed rock',
        iron_deposit: 'dark iron ore formations with rust-red streaks',
        crystal_formation: 'glowing magical crystal clusters emanating ethereal light',
        sacred_grove: 'ancient blessed trees with divine energy auras',
        ancient_library: 'ruined stone library with scattered ancient tomes',
        herb_garden: 'wild medicinal herb patches with colorful flora',
        quarry: 'exposed stone quarry with quality building materials',
        timber_grove: 'dense stands of premium lumber trees',
        mana_spring: 'mystical spring bubbling with raw magical energy',
        blessed_shrine: 'holy shrine radiating divine protective light'
      };
      
      resources.forEach(([key, data]: [string, any]) => {
        const visual = resourceVisuals[key] || `${key.replace(/_/g, ' ')} deposits`;
        prompt += visual + ', ';
      });
      prompt = prompt.slice(0, -2) + '. ';
    }
    
    // 7. Inquisition plot resources with levels
    if (plot.plotResources && Object.keys(plot.plotResources).length > 0) {
      const materials = Object.entries(plot.plotResources);
      prompt += 'Inquisition materials present: ';
      
      materials.forEach(([key, data]: [string, any]) => {
        if (data.level) {
          const levelDesc = data.level === 1 ? 'basic' : data.level === 2 ? 'quality' : 'premium';
          prompt += `${levelDesc} ${data.name || key}, `;
        }
      });
      prompt = prompt.slice(0, -2) + '. ';
    }
    
    // 8. Special features with detailed visuals
    if (plot.specialFeatures && plot.specialFeatures.length > 0) {
      const featureDescriptions: Record<string, string> = {
        river_access: 'flowing river with clear blue water cutting through the land',
        mountain_view: 'breathtaking mountain vista visible in the distance',
        ancient_ruins: 'weathered ancient stone ruins with mysterious carvings',
        sacred_site: 'mystical standing stones arranged in sacred patterns glowing faintly',
        trade_route: 'well-traveled merchant path with wagon wheel tracks',
        defensive_walls: 'crumbling defensive fortification walls from ages past',
        natural_harbor: 'protected natural harbor with calm waters perfect for ships',
        hot_springs: 'steaming geothermal springs with mineral-rich waters',
        fertile_soil: 'rich dark soil perfect for abundant crop growth',
        hidden_cave: 'mysterious cave entrance partially concealed by vegetation',
        old_fortress: 'imposing weathered fortress walls on strategic high ground',
        crystal_deposit: 'exposed crystal formations sparkling with inner light'
      };
      
      prompt += 'Notable features: ';
      plot.specialFeatures.forEach(feature => {
        const desc = featureDescriptions[feature] || feature.replace(/_/g, ' ');
        prompt += desc + ', ';
      });
      prompt = prompt.slice(0, -2) + '. ';
    }
    
    // 9. Bonuses and modifiers visualization
    if (plot.yieldRate) {
      const yieldQuality = plot.yieldRate > 15 ? 'exceptionally fertile' : 
                          plot.yieldRate > 10 ? 'highly productive' : 'moderately productive';
      prompt += `The land appears ${yieldQuality}. `;
    }
    
    if (plot.defenseBonus && plot.defenseBonus > 0) {
      prompt += 'Strategic defensive advantages visible in terrain. ';
    }
    
    if (plot.productionRateBonus && plot.productionRateBonus > 0) {
      prompt += 'Signs of enhanced productivity and resource abundance. ';
    }
    
    // 10. Lore integration (if available)
    if (plot.lore) {
      // Extract key visual elements from lore
      const loreSnippet = plot.lore.slice(0, 150);
      prompt += `Historical significance: ${loreSnippet}... `;
    }
    
    // 11. Visual style directives
    prompt += 'Art style: Medieval fantasy RPG game asset, isometric perspective view, ';
    prompt += 'highly detailed painterly illustration, rich vibrant colors, ';
    prompt += 'strategic map aesthetic with clear terrain features, ';
    prompt += 'professional game art quality, magical atmosphere, epic fantasy mood. ';
    prompt += 'Include environmental details, weather effects, time of day lighting. ';
    prompt += 'Show the unique character and value of this specific plot.';
    
    // Log the full prompt for debugging
    console.log(`🎨 [LAND-IMG] Full enhanced prompt (${prompt.length} chars):`);
    console.log(`   ${prompt.slice(0, 200)}...`);
    
    return prompt;
  }
  
  /**
   * Simple prompt generation for backward compatibility
   */
  private generatePrompt(plot: LandPlot): string {
    // Convert simple plot to detailed format and use enhanced prompt
    const detailedPlot: LandPlotDetailed = {
      plotNumber: plot.plotNumber,
      mapX: 0,
      mapY: 0,
      gridSection: 'A1',
      terrainType: plot.terrainType,
      terrainSubtype: plot.terrainSubtype,
      plotSize: 'standard',
      sizeMultiplier: 1.0,
      specialFeatures: plot.specialFeatures,
      description: plot.description
    };
    
    return this.generateEnhancedPrompt(detailedPlot);
  }
  
  /**
   * Download image from URL and store in Object Storage
   * Uses standardized /api/storage/uploads/generated-images/ path
   */
  private async storeImagePermanently(imageUrl: string, plotNumber: number): Promise<string> {
    try {
      console.log(`💾 [LAND-IMG] Downloading image for permanent storage...`);
      
      // Download the image
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }
      
      const buffer = Buffer.from(await response.arrayBuffer());
      console.log(`📦 [LAND-IMG] Downloaded ${buffer.length} bytes`);
      
      // Generate unique filename with timestamp
      const timestamp = Date.now();
      const filename = `land-plot-${plotNumber}-${timestamp}.png`;
      
      // Store in Object Storage using standardized path
      const storagePath = `uploads/generated-images/${filename}`;
      const { ok, error } = await getStorageClient().uploadFromBytes(storagePath, buffer);
      
      if (!ok) {
        throw new Error(`Failed to upload to object storage: ${error}`);
      }
      
      // Return standardized /api/storage/... path for consistency
      const publicUrl = `/api/storage/${storagePath}`;
      console.log(`✅ [LAND-IMG] Stored permanently at: ${publicUrl}`);
      
      return publicUrl;
      
    } catch (error) {
      console.error(`❌ [LAND-IMG] Error storing image permanently:`, error);
      throw error;
    }
  }

  /**
   * Generate image for a land plot with full details
   */
  async generateEnhancedPlotImage(plot: LandPlotDetailed, storePermanently: boolean = true): Promise<string> {
    try {
      const prompt = this.generateEnhancedPrompt(plot);
      
      console.log(`🎨 [LAND-IMG] Generating enhanced image for Plot #${plot.plotNumber}`);
      console.log(`   Terrain: ${plot.terrainType}/${plot.terrainSubtype || 'default'}`);
      console.log(`   Size: ${plot.plotSize} (${plot.sizeMultiplier}x)`);
      console.log(`   Position: Grid ${plot.gridSection} (${plot.mapX}, ${plot.mapY})`);
      
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1024x1024",
        quality: "standard"
      });

      const tempImageUrl = response.data?.[0]?.url;
      
      if (!tempImageUrl) {
        throw new Error('No image URL returned from OpenAI');
      }
      
      console.log(`✅ [LAND-IMG] Generated temporary image URL`);
      
      // Store permanently if requested
      if (storePermanently) {
        const permanentUrl = await this.storeImagePermanently(tempImageUrl, plot.plotNumber);
        
        // Update database with permanent URL and timestamp (using correct snake_case field names)
        await db.update(medievalLandPlots)
          .set({
            generated_image_url: permanentUrl,
            image_generated_at: new Date(),
            updated_at: new Date()
          } as any)
          .where(eq(medievalLandPlots.plotNumber, plot.plotNumber));
        
        console.log(`✅ [LAND-IMG] Updated database with permanent URL for Plot #${plot.plotNumber}`);
        return permanentUrl;
      }
      
      return tempImageUrl;
      
    } catch (error) {
      console.error(`❌ [LAND-IMG] Error generating enhanced image for Plot #${plot.plotNumber}:`, error);
      throw error;
    }
  }

  /**
   * Generate image for a single land plot (backward compatibility)
   */
  async generatePlotImage(plot: LandPlot): Promise<string> {
    try {
      const prompt = this.generatePrompt(plot);
      
      console.log(`🎨 [LAND-IMG] Generating image for Plot #${plot.plotNumber}: ${plot.terrainType}`);
      console.log(`   Prompt: ${prompt.slice(0, 100)}...`);
      
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1024x1024",
        quality: "standard"
      });

      const imageUrl = response.data?.[0]?.url;
      
      if (!imageUrl) {
        throw new Error('No image URL returned from OpenAI');
      }
      
      console.log(`✅ [LAND-IMG] Generated image for Plot #${plot.plotNumber}`);
      return imageUrl;
      
    } catch (error) {
      console.error(`❌ [LAND-IMG] Error generating image for Plot #${plot.plotNumber}:`, error);
      throw error;
    }
  }

  /**
   * Generate images for multiple plots (batch processing)
   */
  async generateBatchImages(plots: LandPlot[], delay: number = 1000): Promise<Map<number, string>> {
    const imageUrls = new Map<number, string>();
    
    console.log(`🎨 [LAND-IMG] Batch generating images for ${plots.length} plots...`);
    
    for (const plot of plots) {
      try {
        const imageUrl = await this.generatePlotImage(plot);
        imageUrls.set(plot.plotNumber, imageUrl);
        
        // Delay to avoid rate limiting
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        console.error(`❌ [LAND-IMG] Failed to generate image for Plot #${plot.plotNumber}`);
        // Continue with other plots
      }
    }
    
    console.log(`✅ [LAND-IMG] Batch complete: ${imageUrls.size}/${plots.length} images generated`);
    return imageUrls;
  }
  
  /**
   * Regenerate images for specific plots or all plots
   */
  async regenerateImages(plotNumbers?: number[], all: boolean = false): Promise<{
    success: number;
    failed: number;
    results: Array<{ plotNumber: number; success: boolean; url?: string; error?: string }>;
  }> {
    const results: Array<{ plotNumber: number; success: boolean; url?: string; error?: string }> = [];
    let successCount = 0;
    let failedCount = 0;
    
    try {
      // Get plots to regenerate
      let plots;
      if (all) {
        plots = await db.select().from(medievalLandPlots);
        console.log(`🔄 [LAND-IMG] Regenerating images for ALL ${plots.length} plots`);
      } else if (plotNumbers && plotNumbers.length > 0) {
        plots = await db
          .select()
          .from(medievalLandPlots)
          .where(sql`${medievalLandPlots.plotNumber} = ANY(${plotNumbers})`);
        console.log(`🔄 [LAND-IMG] Regenerating images for ${plots.length} specific plots`);
      } else {
        return { success: 0, failed: 0, results: [] };
      }
      
      // Process each plot
      for (const plot of plots) {
        try {
          console.log(`🎨 [LAND-IMG] Processing Plot #${plot.plotNumber}...`);
          
          // Create detailed plot object
          const detailedPlot: LandPlotDetailed = {
            plotNumber: plot.plotNumber,
            mapX: plot.mapX,
            mapY: plot.mapY,
            gridSection: plot.gridSection,
            terrainType: plot.terrainType,
            terrainSubtype: plot.terrainSubtype || undefined,
            plotSize: plot.plotSize,
            sizeMultiplier: parseFloat(plot.sizeMultiplier),
            specialFeatures: plot.specialFeatures || [],
            resourceNodes: plot.resourceNodes as Record<string, any> || {},
            plotResources: plot.plotResources as Record<string, any> || {},
            yieldRate: parseFloat(plot.yieldRate),
            description: plot.description || undefined,
            lore: plot.lore || undefined,
            // Add calculated fields
            elevation: this.calculateElevation(plot.mapY),
            climate: this.calculateClimate(plot.terrainType, plot.latitude)
          };
          
          // Generate and store image
          const imageUrl = await this.generateEnhancedPlotImage(detailedPlot, true);
          
          results.push({
            plotNumber: plot.plotNumber,
            success: true,
            url: imageUrl
          });
          successCount++;
          
          // Rate limiting delay
          await new Promise(resolve => setTimeout(resolve, 1500));
          
        } catch (error: any) {
          console.error(`❌ [LAND-IMG] Failed to regenerate image for Plot #${plot.plotNumber}:`, error);
          results.push({
            plotNumber: plot.plotNumber,
            success: false,
            error: error.message
          });
          failedCount++;
        }
      }
      
      console.log(`✅ [LAND-IMG] Regeneration complete: ${successCount} success, ${failedCount} failed`);
      return { success: successCount, failed: failedCount, results };
      
    } catch (error: any) {
      console.error(`❌ [LAND-IMG] Error in regenerateImages:`, error);
      throw error;
    }
  }
  
  /**
   * Calculate elevation based on map position
   */
  private calculateElevation(mapY: number): string {
    // Northern regions tend to be higher elevation
    if (mapY < 25) return 'extreme';
    if (mapY < 50) return 'high';
    if (mapY < 75) return 'medium';
    return 'low';
  }
  
  /**
   * Calculate climate based on terrain and latitude
   */
  private calculateClimate(terrainType: string, latitude?: string | null): string {
    const lat = latitude ? parseFloat(latitude) : 0;
    
    // Climate based on latitude and terrain
    if (terrainType === 'tundra' || lat > 60 || lat < -60) return 'arctic';
    if (terrainType === 'desert') return 'arid';
    if (terrainType === 'swamp' || (lat > -20 && lat < 20)) return 'tropical';
    if (lat > 30 && lat < 45) return 'mediterranean';
    return 'temperate';
  }
}

export const landImageGenerator = new LandImageGenerator();