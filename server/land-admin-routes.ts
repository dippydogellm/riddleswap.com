/**
 * Land Admin Routes - Administrative endpoints for land plot management
 */

import { Router } from 'express';
import { landPlotGenerator } from './land-plot-generator';
import { landImageGenerator } from './land-image-generator';
import { landNFTMetadataGenerator } from './land-nft-metadata-generator';
import { db } from './db';
import { medievalLandPlots } from '../shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

/**
 * POST /api/admin/land/populate
 * Populate database with land plots (initial 500 or expand up to count)
 * Body: { count?: number } - defaults to 500, can go up to 10000
 */
router.post('/land/populate', async (req, res) => {
  try {
    const { count = 500 } = req.body;
    const maxCount = 10000;
    
    // Validate count
    if (count < 1 || count > maxCount) {
      return res.status(400).json({
        success: false,
        error: `Count must be between 1 and ${maxCount}`
      });
    }
    
    console.log(`🏞️ [ADMIN] Starting land plot population (count: ${count})...`);
    
    // Get current plot count
    const existingPlots = await db.select().from(medievalLandPlots);
    const existingCount = existingPlots.length;
    
    console.log(`📊 [ADMIN] Existing plots: ${existingCount}, requested total: ${count}`);
    
    if (existingCount >= count) {
      return res.json({
        success: true,
        message: 'Database already has sufficient plots',
        totalPlots: existingCount,
        requested: count,
        note: 'No new plots were generated'
      });
    }
    
    // Generate additional plots to reach the count
    const plotsToGenerate = count - existingCount;
    console.log(`➕ [ADMIN] Generating ${plotsToGenerate} additional plots...`);
    
    await landPlotGenerator.populateDatabase({ 
      startNumber: existingCount + 1,
      count: plotsToGenerate 
    });
    
    // Get updated count
    const updatedPlots = await db.select().from(medievalLandPlots);
    
    res.json({
      success: true,
      message: `Successfully generated ${plotsToGenerate} new land plots`,
      totalPlots: updatedPlots.length,
      previousCount: existingCount,
      newlyGenerated: plotsToGenerate,
      gridSize: 'Dynamic',
      region: 'Expanded fantasy realm',
      maxSupported: maxCount
    });
    
  } catch (error: any) {
    console.error('❌ [ADMIN] Error populating land plots:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/admin/land/generate-image/:plotNumber
 * Generate AI image for a specific land plot
 */
router.post('/land/generate-image/:plotNumber', async (req, res) => {
  try {
    const plotNumber = parseInt(req.params.plotNumber);
    
    console.log(`🎨 [ADMIN] Generating image for plot #${plotNumber}...`);
    
    // Get plot data
    const [plot] = await db
      .select()
      .from(medievalLandPlots)
      .where(eq(medievalLandPlots.plotNumber, plotNumber))
      .limit(1);
    
    if (!plot) {
      return res.status(404).json({
        success: false,
        error: 'Plot not found'
      });
    }
    
    // Generate image
    const imageUrl = await landImageGenerator.generatePlotImage({
      plotNumber: plot.plotNumber,
      terrainType: plot.terrainType,
      terrainSubtype: plot.terrainSubtype || '',
      specialFeatures: plot.specialFeatures || [],
      description: plot.description || ''
    });
    
    res.json({
      success: true,
      plotNumber,
      imageUrl,
      message: 'Image generated successfully'
    });
    
  } catch (error: any) {
    console.error('❌ [ADMIN] Error generating image:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/admin/land/generate-metadata/:plotNumber
 * Generate NFT metadata for a specific land plot
 */
router.post('/land/generate-metadata/:plotNumber', async (req, res) => {
  try {
    const plotNumber = parseInt(req.params.plotNumber);
    const { imageUrl } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        error: 'Image URL is required'
      });
    }
    
    console.log(`📝 [ADMIN] Generating metadata for plot #${plotNumber}...`);
    
    // Get plot data
    const [plot] = await db
      .select()
      .from(medievalLandPlots)
      .where(eq(medievalLandPlots.plotNumber, plotNumber))
      .limit(1);
    
    if (!plot) {
      return res.status(404).json({
        success: false,
        error: 'Plot not found'
      });
    }
    
    // Generate metadata
    const metadata = landNFTMetadataGenerator.generateMetadata({
      plotNumber: plot.plotNumber,
      mapX: plot.mapX,
      mapY: plot.mapY,
      gridSection: plot.gridSection,
      latitude: parseFloat(plot.latitude || '0'),
      longitude: parseFloat(plot.longitude || '0'),
      terrainType: plot.terrainType,
      terrainSubtype: plot.terrainSubtype || '',
      basePrice: parseFloat(plot.basePrice),
      plotSize: plot.plotSize,
      sizeMultiplier: parseFloat(plot.sizeMultiplier),
      yieldRate: parseFloat(plot.yieldRate),
      specialFeatures: plot.specialFeatures || [],
      resourceNodes: (plot.resourceNodes as Record<string, any>) || {},
      description: plot.description || '',
      lore: plot.lore || ''
    }, imageUrl);
    
    res.json({
      success: true,
      plotNumber,
      metadata,
      jsonString: landNFTMetadataGenerator.toJSON(metadata)
    });
    
  } catch (error: any) {
    console.error('❌ [ADMIN] Error generating metadata:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/admin/land/update-resources
 * Update all existing plots with new Inquisition-themed resources
 */
router.post('/land/update-resources', async (req, res) => {
  try {
    console.log('🔄 [ADMIN] Updating land plots with Inquisition materials...');
    
    // Get all plots
    const plots = await db.select().from(medievalLandPlots);
    
    console.log(`📊 [ADMIN] Found ${plots.length} plots to update`);
    
    let updatedCount = 0;
    
    // Update each plot with new resources
    for (const plot of plots) {
      // Regenerate resources using the new Inquisition system
      const newResources = await landPlotGenerator.regenerateResourcesForPlot(
        plot.terrainType,
        plot.plotNumber
      );
      
      // Generate new description
      const materialsList = Object.entries(newResources).map(([key, data]: [string, any]) => 
        `${data.name} (Level ${data.level})`
      ).join(', ');
      
      const newDescription = `${plot.terrainType.charAt(0).toUpperCase() + plot.terrainType.slice(1)} land with ${(plot.terrainSubtype || '').replace('_', ' ')}. ` +
        `Size: ${plot.plotSize}. Inquisition Materials: ${materialsList || 'None'}.`;
      
      // Update database
      await db.update(medievalLandPlots)
        .set({ 
          resourceNodes: newResources,
          description: newDescription,
          updatedAt: new Date()
         } as any)
        .where(eq(medievalLandPlots.id, plot.id));
      
      updatedCount++;
      
      if (updatedCount % 50 === 0) {
        console.log(`   ✅ Updated ${updatedCount}/${plots.length} plots`);
      }
    }
    
    console.log(`✅ [ADMIN] Successfully updated ${updatedCount} plots with Inquisition materials`);
    
    res.json({
      success: true,
      message: 'Land plots updated with Inquisition materials',
      updatedCount,
      totalPlots: plots.length
    });
    
  } catch (error: any) {
    console.error('❌ [ADMIN] Error updating resources:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/admin/land/stats
 * Get land plot statistics
 */
router.get('/land/stats', async (req, res) => {
  try {
    const plots = await db.select().from(medievalLandPlots);
    
    // Calculate stats
    const terrainCounts: Record<string, number> = {};
    const sizeCounts: Record<string, number> = {};
    let totalSpecialFeatures = 0;
    
    plots.forEach(plot => {
      // Terrain counts
      terrainCounts[plot.terrainType] = (terrainCounts[plot.terrainType] || 0) + 1;
      
      // Size counts
      sizeCounts[plot.plotSize] = (sizeCounts[plot.plotSize] || 0) + 1;
      
      // Special features
      totalSpecialFeatures += (plot.specialFeatures?.length || 0);
    });
    
    res.json({
      success: true,
      stats: {
        totalPlots: plots.length,
        terrainDistribution: terrainCounts,
        sizeDistribution: sizeCounts,
        totalSpecialFeatures,
        averagePrice: plots.reduce((sum, p) => sum + parseFloat(p.currentPrice), 0) / plots.length,
        available: plots.filter(p => p.status === 'available').length,
        owned: plots.filter(p => p.status === 'owned').length
      }
    });
    
  } catch (error: any) {
    console.error('❌ [ADMIN] Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
