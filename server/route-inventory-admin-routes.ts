import express from 'express';
import { RouteInventorySystem } from './route-inventory-system';
import { RouteAnalysisTools } from './route-analysis-tools';
import { getRouteUsageSummary } from './middleware/route-usage-tracker';
import { validateAdminAccess, apiLimiter } from './middleware/security';

const router = express.Router();

/**
 * Admin routes for route inventory and analysis system
 * Provides API endpoints to access route discovery, usage statistics, and removal recommendations
 * 
 * SECURITY: All routes require admin authentication (dippydoge user only)
 * Access is logged for security audit purposes
 */

// Apply admin authentication to ALL routes in this router
router.use(validateAdminAccess);

// Apply additional rate limiting for admin routes
router.use(apiLimiter);

// Get current route inventory
router.get('/inventory', async (req, res) => {
  try {
    const inventorySystem = RouteInventorySystem.getInstance();
    const inventory = inventorySystem.getCurrentInventory();
    
    if (!inventory) {
      return res.status(503).json({
        success: false,
        error: 'Route inventory not available',
        message: 'Server may still be initializing route discovery'
      });
    }
    
    res.json({
      success: true,
      data: inventory
    });
  } catch (error: any) {
    console.error('❌ [ADMIN] Error fetching route inventory:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch route inventory',
      details: error.message
    });
  }
});

// Get current usage statistics
router.get('/usage', async (req, res) => {
  try {
    const summary = getRouteUsageSummary();
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error: any) {
    console.error('❌ [ADMIN] Error fetching usage stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch usage statistics',
      details: error.message
    });
  }
});

// Analyze unused routes
router.get('/analysis/unused', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 14;
    const analysisTools = new RouteAnalysisTools();
    
    console.log(`🔍 [ADMIN] Starting unused route analysis for ${days} days...`);
    const analysis = await analysisTools.analyzeUnusedRoutes(days);
    
    res.json({
      success: true,
      data: analysis
    });
  } catch (error: any) {
    console.error('❌ [ADMIN] Error analyzing unused routes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze unused routes',
      details: error.message
    });
  }
});

// Analyze frontend usage patterns
router.get('/analysis/frontend', async (req, res) => {
  try {
    const analysisTools = new RouteAnalysisTools();
    
    console.log('🔍 [ADMIN] Starting frontend usage analysis...');
    const frontendUsage = await analysisTools.analyzeFrontendUsage();
    
    res.json({
      success: true,
      data: frontendUsage
    });
  } catch (error: any) {
    console.error('❌ [ADMIN] Error analyzing frontend usage:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze frontend usage',
      details: error.message
    });
  }
});

// Generate removal recommendations
router.get('/recommendations', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 14;
    const confidence = req.query.confidence as string || 'MEDIUM';
    
    const analysisTools = new RouteAnalysisTools();
    const analysis = await analysisTools.analyzeUnusedRoutes(days);
    
    // Filter by confidence level
    let filteredRecommendations = analysis.recommendations;
    if (confidence === 'HIGH') {
      filteredRecommendations = analysis.recommendations.filter(r => r.confidence === 'HIGH');
    } else if (confidence === 'SAFE') {
      filteredRecommendations = analysis.recommendations.filter(r => r.riskLevel === 'SAFE');
    }
    
    res.json({
      success: true,
      data: {
        analysisDate: analysis.analysisDate,
        analysisWindow: analysis.analysisWindow,
        totalRecommendations: analysis.recommendations.length,
        filteredRecommendations,
        summary: {
          highConfidence: analysis.recommendations.filter(r => r.confidence === 'HIGH').length,
          mediumConfidence: analysis.recommendations.filter(r => r.confidence === 'MEDIUM').length,
          lowConfidence: analysis.recommendations.filter(r => r.confidence === 'LOW').length,
          safeToRemove: analysis.recommendations.filter(r => r.riskLevel === 'SAFE').length,
          needsCaution: analysis.recommendations.filter(r => r.riskLevel === 'CAUTION').length,
          risky: analysis.recommendations.filter(r => r.riskLevel === 'RISKY').length
        }
      }
    });
  } catch (error: any) {
    console.error('❌ [ADMIN] Error generating recommendations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate recommendations',
      details: error.message
    });
  }
});

// Generate removal script
router.get('/removal-script', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 14;
    
    const analysisTools = new RouteAnalysisTools();
    const analysis = await analysisTools.analyzeUnusedRoutes(days);
    const script = await analysisTools.generateRemovalScript(analysis.recommendations);
    
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', 'attachment; filename=route-removal-script.sh');
    res.send(script);
  } catch (error: any) {
    console.error('❌ [ADMIN] Error generating removal script:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate removal script',
      details: error.message
    });
  }
});

// Force regenerate route inventory
router.post('/inventory/regenerate', async (req, res) => {
  try {
    const inventorySystem = RouteInventorySystem.getInstance();
    
    // Note: We need the Express app instance to regenerate
    // This will need to be called from the main server context
    res.json({
      success: false,
      error: 'Route regeneration not available via API',
      message: 'Use server restart to regenerate route inventory'
    });
  } catch (error: any) {
    console.error('❌ [ADMIN] Error regenerating inventory:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to regenerate inventory',
      details: error.message
    });
  }
});

// Generate daily report
router.post('/usage/daily-report', async (req, res) => {
  try {
    const inventorySystem = RouteInventorySystem.getInstance();
    const report = await inventorySystem.generateDailyReport();
    
    res.json({
      success: true,
      data: report,
      message: 'Daily usage report generated and saved'
    });
  } catch (error: any) {
    console.error('❌ [ADMIN] Error generating daily report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate daily report',
      details: error.message
    });
  }
});

// Get route categories breakdown
router.get('/categories', async (req, res) => {
  try {
    const inventorySystem = RouteInventorySystem.getInstance();
    const inventory = inventorySystem.getCurrentInventory();
    
    if (!inventory) {
      return res.status(503).json({
        success: false,
        error: 'Route inventory not available'
      });
    }
    
    const categoryDetails = Object.entries(inventory.routesByCategory).map(([category, count]) => {
      const categoryRoutes = inventory.routes.filter(r => r.category === category);
      return {
        category,
        count,
        routes: categoryRoutes.map(r => ({
          method: r.method,
          path: r.fullPath,
          authRequired: r.authRequired
        }))
      };
    });
    
    res.json({
      success: true,
      data: {
        totalCategories: Object.keys(inventory.routesByCategory).length,
        categories: categoryDetails
      }
    });
  } catch (error: any) {
    console.error('❌ [ADMIN] Error fetching categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch route categories',
      details: error.message
    });
  }
});

// Health check for route inventory system
router.get('/health', (req, res) => {
  const inventorySystem = RouteInventorySystem.getInstance();
  const inventory = inventorySystem.getCurrentInventory();
  const usage = inventorySystem.getUsageStats();
  
  res.json({
    success: true,
    data: {
      inventoryStatus: inventory ? 'available' : 'not_generated',
      totalRoutes: inventory?.totalRoutes || 0,
      trackedRoutes: Object.keys(usage).length,
      lastGenerated: inventory?.generatedAt || null,
      systemUptime: process.uptime()
    }
  });
});

export default router;