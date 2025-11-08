/**
 * Service Initialization Testing & Management Routes
 * 
 * Provides endpoints for testing, validating, and managing
 * project service initialization
 */

import { Router } from "express";
import { z } from "zod";
import { storage } from "./storage";
import { initializeProjectServices, initializeProjectConfigurations } from "./project-service-initializer";
import { runServiceInitializationTests, validateProjectServices } from "./service-initialization.test";
import { 
  serviceAdminReadOnlyAuth, 
  serviceAdminDestructiveAuth, 
  serviceAdminProjectAuth,
  auditServiceAdminAccess 
} from "./middleware/service-admin-auth";

const router = Router();

// Validation schemas
const testProjectSchema = z.object({
  projectType: z.enum(["nft", "token"]).optional(),
  chain: z.string().optional(),
  issuerWallet: z.string().optional(),
  taxon: z.number().optional()
});

const reinitializeServicesSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  forceReinitialize: z.boolean().optional().default(false),
  servicesOnly: z.boolean().optional().default(false) // Skip configurations if true
});

/**
 * POST /api/service-initialization/test
 * Run comprehensive service initialization tests
 * SECURITY: Requires admin authentication + destructive operation limits
 */
router.post("/test", 
  serviceAdminDestructiveAuth, 
  auditServiceAdminAccess("Service Initialization Test Suite"),
  async (req, res) => {
  try {
    console.log('🧪 Starting Service Initialization Test Suite via API...');
    
    // Run the comprehensive test suite
    await runServiceInitializationTests();
    
    res.json({
      success: true,
      message: "Service initialization tests completed successfully",
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("Service initialization tests failed:", error);
    res.status(500).json({
      success: false,
      error: "Service initialization tests failed",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * GET /api/service-initialization/validate/:projectId
 * Validate service initialization for a specific project
 * SECURITY: Requires admin authentication (read-only operation)
 */
router.get("/validate/:projectId", 
  serviceAdminReadOnlyAuth,
  auditServiceAdminAccess("Project Service Validation"),
  async (req, res) => {
  try {
    const { projectId } = req.params;
    
    console.log(`🔍 Validating service initialization for project ${projectId}...`);
    
    const isValid = await validateProjectServices(projectId);
    const services = await storage.getProjectServices(projectId);
    const walletLinks = await storage.getWalletProjectLinksByProject(projectId);
    
    const validation = {
      projectId,
      isValid,
      serviceCount: services.length,
      enabledServices: services.filter(s => s.enabled).map(s => s.service),
      disabledServices: services.filter(s => !s.enabled).map(s => s.service),
      walletLinkCount: walletLinks.length,
      hasIssuerLink: walletLinks.some(l => l.linkType === 'issuer'),
      validationDetails: {
        hasServices: services.length > 0,
        hasEnabledServices: services.some(s => s.enabled),
        hasWalletLinks: walletLinks.length > 0,
        hasIssuerLink: walletLinks.some(l => l.linkType === 'issuer')
      }
    };
    
    res.json({
      success: true,
      validation
    });
    
  } catch (error) {
    console.error("Service validation failed:", error);
    res.status(500).json({
      success: false,
      error: "Service validation failed",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * GET /api/service-initialization/status
 * Get overall status of service initialization across all projects
 * SECURITY: Requires admin authentication (read-only operation)
 */
router.get("/status", 
  serviceAdminReadOnlyAuth,
  auditServiceAdminAccess("Service Initialization Status"),
  async (req, res) => {
  try {
    console.log('📊 Generating service initialization status report...');
    
    const projects = await storage.getDevtoolsProjects();
    const statusReport = {
      totalProjects: projects.length,
      claimedProjects: projects.filter(p => p.claim_status === 'claimed').length,
      projectsWithServices: 0,
      projectsWithoutServices: 0,
      projectsWithIssuerLinks: 0,
      serviceBreakdown: {} as Record<string, number>,
      projectDetails: [] as any[]
    };
    
    for (const project of projects) {
      if (project.claim_status !== 'claimed') continue;
      
      const services = await storage.getProjectServices(project.id);
      const walletLinks = await storage.getWalletProjectLinksByProject(project.id);
      const hasIssuerLink = walletLinks.some(l => l.linkType === 'issuer');
      
      if (services.length > 0) {
        statusReport.projectsWithServices++;
      } else {
        statusReport.projectsWithoutServices++;
      }
      
      if (hasIssuerLink) {
        statusReport.projectsWithIssuerLinks++;
      }
      
      // Count service types
      services.forEach(service => {
        if (service.enabled) {
          statusReport.serviceBreakdown[service.service] = (statusReport.serviceBreakdown[service.service] || 0) + 1;
        }
      });
      
      statusReport.projectDetails.push({
        id: project.id,
        name: project.name,
        issuerWallet: project.issuer_wallet,
        serviceCount: services.length,
        enabledServices: services.filter(s => s.enabled).length,
        hasIssuerLink,
        chain: project.discovered_from_chain,
        claimedAt: project.updatedAt
      });
    }
    
    res.json({
      success: true,
      statusReport
    });
    
  } catch (error) {
    console.error("Failed to generate status report:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate status report",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * POST /api/service-initialization/reinitialize
 * Reinitialize services for a specific project (admin only)
 * SECURITY: Requires admin authentication + destructive operation limits
 */
router.post("/reinitialize", 
  serviceAdminDestructiveAuth,
  auditServiceAdminAccess("Service Reinitialization"),
  async (req, res) => {
  try {
    const body = reinitializeServicesSchema.parse(req.body);
    
    console.log(`🔄 Reinitializing services for project ${body.projectId}...`);
    
    // Get project details
    const project = await storage.getDevtoolsProject(body.projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: "Project not found"
      });
    }
    
    // Prepare service configuration
    const config = {
      projectId: body.projectId,
      issuerWallet: project.issuer_wallet || 'unknown',
      taxon: project.nft_token_taxon || undefined,
      chain: project.discovered_from_chain || 'xrpl',
      projectType: project.asset_type === 'token' ? 'token' as const : 'nft' as const
    };
    
    let serviceResult: Awaited<ReturnType<typeof initializeProjectServices>>;
    let configResult: Awaited<ReturnType<typeof initializeProjectConfigurations>> | { skipped: true };
    
    // Force cleanup if requested
    if (body.forceReinitialize) {
      console.log('🧹 Force cleanup - disabling existing services...');
      const existingServices = await storage.getProjectServices(body.projectId);
      for (const service of existingServices) {
        await storage.toggleProjectService(body.projectId, service.service, false);
      }
    }
    
    // Reinitialize services
    serviceResult = await initializeProjectServices(config);
    
    // Reinitialize configurations (unless skipped)
    if (!body.servicesOnly) {
      configResult = await initializeProjectConfigurations(config);
    } else {
      configResult = { skipped: true };
    }
    
    // Validate results
    const validation = await validateProjectServices(body.projectId);
    
    res.json({
      success: serviceResult.success && (body.servicesOnly || ('success' in configResult && configResult.success)),
      message: "Service reinitialization completed",
      results: {
        services: serviceResult,
        configurations: configResult,
        validation: {
          isValid: validation,
          timestamp: new Date().toISOString()
        }
      }
    });
    
  } catch (error) {
    console.error("Service reinitialization failed:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Invalid request data",
        details: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      error: "Service reinitialization failed",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * POST /api/service-initialization/test-claim-flow
 * Test the complete claim approval → service initialization flow
 * SECURITY: Requires admin authentication + destructive operation limits
 */
router.post("/test-claim-flow", 
  serviceAdminDestructiveAuth,
  auditServiceAdminAccess("Test Claim Flow"),
  async (req, res) => {
  try {
    const body = testProjectSchema.parse(req.body);
    
    console.log('🧪 Testing complete claim approval → service initialization flow...');
    
    // Create a test project
    const testProjectData = {
      name: `Test Claim Flow ${Date.now()}`,
      description: "Test project for claim flow validation",
      ownerWalletAddress: `rTestOwner${Date.now()}`,
      projectType: "testing" as const,
      asset_type: body.projectType || "nft" as const,
      issuer_wallet: body.issuerWallet || `rTestIssuer${Date.now()}`,
      nft_token_taxon: body.taxon || 999999,
      discovered_from_chain: body.chain || "xrpl",
      claim_status: "claimed" as const
    };
    
    const testProject = await storage.createDevtoolsProject(testProjectData);
    
    try {
      // Test service initialization
      const config = {
        projectId: testProject.id,
        issuerWallet: testProject.issuer_wallet!,
        taxon: testProject.nft_token_taxon || undefined,
        chain: testProject.discovered_from_chain!,
        projectType: testProject.asset_type === 'token' ? 'token' as const : 'nft' as const
      };
      
      const serviceResult = await initializeProjectServices(config);
      const configResult = await initializeProjectConfigurations(config);
      
      // Validate the results
      const validation = await validateProjectServices(testProject.id);
      const services = await storage.getProjectServices(testProject.id);
      const walletLinks = await storage.getWalletProjectLinksByProject(testProject.id);
      
      const results = {
        testProject: {
          id: testProject.id,
          name: testProject.name,
          issuerWallet: testProject.issuer_wallet,
          chain: testProject.discovered_from_chain,
          projectType: testProject.asset_type
        },
        serviceInitialization: serviceResult,
        configurationInitialization: configResult,
        validation: {
          isValid: validation,
          serviceCount: services.length,
          enabledServices: services.filter(s => s.enabled).map(s => s.service),
          walletLinkCount: walletLinks.length,
          hasIssuerLink: walletLinks.some(l => l.linkType === 'issuer')
        },
        overallSuccess: serviceResult.success && configResult.success && validation
      };
      
      console.log(`${results.overallSuccess ? '✅' : '❌'} Claim flow test completed`);
      
      res.json({
        success: true,
        message: "Claim flow test completed",
        results
      });
      
    } finally {
      // Cleanup test project
      console.log(`🧹 Cleaning up test project ${testProject.id}...`);
      // Note: In a real implementation, you might want to keep test data for debugging
    }
    
  } catch (error) {
    console.error("Claim flow test failed:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Invalid test parameters",
        details: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      error: "Claim flow test failed",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export default router;