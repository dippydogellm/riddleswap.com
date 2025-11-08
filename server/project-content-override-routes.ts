/**
 * Project Content Override Routes
 * 
 * Subscription-aware content override system that provides tiered access to metadata
 * override features based on subscription levels. Integrates with the subscription
 * service for proper feature gating and usage tracking.
 */

import { Router } from "express";
import { z } from "zod";
import { storage } from "./storage";
import { SubscriptionService } from "./subscription-service";
import { insertProjectContentOverrideSchema } from "@shared/schema";

const router = Router();

// Validation schemas
const createOverrideSchema = insertProjectContentOverrideSchema.extend({
  project_id: z.string().min(1, "Project ID is required")
});

const updateOverrideSchema = createOverrideSchema.partial().extend({
  id: z.string().min(1, "Override ID is required")
});

const bulkOverrideSchema = z.object({
  project_id: z.string().min(1, "Project ID is required"),
  overrides: z.array(createOverrideSchema).min(1).max(100, "Maximum 100 overrides per bulk request")
});

/**
 * Check if project has permission for content overrides
 */
async function checkOverridePermissions(projectId: string, requestedCount: number = 1) {
  try {
    // Get subscription details for the project
    const subscriptionDetails = await SubscriptionService.getSubscriptionDetails(projectId);
    const { subscription, usage, status } = subscriptionDetails;
    
    // Check if subscription is active
    if (status !== 'active') {
      return {
        allowed: false,
        error: `Subscription is ${status}. Active subscription required for content overrides.`,
        current_tier: subscription.subscription_tier
      };
    }
    
    // Check if can override bithomp data (required for content overrides)
    if (!subscription.can_override_bithomp) {
      return {
        allowed: false,
        error: "Content overrides not available in your current subscription tier. Upgrade to Pro or higher.",
        current_tier: subscription.subscription_tier,
        required_feature: 'can_override_bithomp'
      };
    }
    
    // Check if would exceed override limit
    const newTotal = usage.overrides_remaining - requestedCount;
    if (newTotal < 0) {
      return {
        allowed: false,
        error: `Override limit exceeded. You have ${usage.overrides_remaining} overrides remaining, but requested ${requestedCount}.`,
        current_tier: subscription.subscription_tier,
        usage_info: {
          used: subscription.current_override_entities,
          limit: subscription.max_override_entities,
          remaining: usage.overrides_remaining
        }
      };
    }
    
    return {
      allowed: true,
      subscription_tier: subscription.subscription_tier,
      usage_info: {
        used: subscription.current_override_entities,
        limit: subscription.max_override_entities,
        remaining: usage.overrides_remaining,
        after_request: usage.overrides_remaining - requestedCount
      }
    };
    
  } catch (error) {
    console.error("❌ [OVERRIDE-PERMISSIONS] Error checking permissions:", error);
    return {
      allowed: false,
      error: "Failed to verify subscription permissions",
      current_tier: 'unknown'
    };
  }
}

/**
 * GET /api/project-overrides/:projectId
 * Get all content overrides for a project
 */
router.get("/:projectId", async (req, res) => {
  try {
    const { projectId } = req.params;
    const { entity_type, status } = req.query;
    
    console.log(`📋 [OVERRIDE-API] Fetching overrides for project: ${projectId}`);
    
    // Check basic project permissions
    const permissionCheck = await checkOverridePermissions(projectId, 0);
    if (!permissionCheck.allowed && permissionCheck.current_tier === 'free') {
      return res.status(403).json({
        success: false,
        error: permissionCheck.error,
        subscription_info: {
          current_tier: permissionCheck.current_tier,
          required_feature: permissionCheck.required_feature
        }
      });
    }
    
    // Get project overrides
    const overrides = await storage.getProjectContentOverridesByProject(projectId);
    
    // Filter by entity type and status if specified
    let filteredOverrides = overrides;
    if (entity_type) {
      filteredOverrides = filteredOverrides.filter((o: any) => o.entity_type === entity_type);
    }
    if (status) {
      filteredOverrides = filteredOverrides.filter((o: any) => o.status === status);
    }
    
    res.json({
      success: true,
      project_id: projectId,
      overrides: filteredOverrides,
      count: filteredOverrides.length,
      subscription_info: {
        tier: permissionCheck.subscription_tier,
        usage: permissionCheck.usage_info
      }
    });
    
  } catch (error) {
    console.error("❌ [OVERRIDE-API] Error fetching overrides:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch project overrides"
    });
  }
});

/**
 * POST /api/project-overrides
 * Create a new content override (subscription-gated)
 */
router.post("/", async (req, res) => {
  try {
    const body = createOverrideSchema.parse(req.body);
    const { project_id } = body;
    
    console.log(`📝 [OVERRIDE-API] Creating override for project: ${project_id}`);
    
    // Check subscription permissions
    const permissionCheck = await checkOverridePermissions(project_id, 1);
    if (!permissionCheck.allowed) {
      return res.status(403).json({
        success: false,
        error: permissionCheck.error,
        subscription_info: {
          current_tier: permissionCheck.current_tier,
          required_feature: permissionCheck.required_feature,
          usage: permissionCheck.usage_info
        }
      });
    }
    
    // Validate project exists
    const project = await storage.getDevtoolsProject(project_id);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: "Project not found"
      });
    }
    
    // Create the override
    const override = await storage.createProjectContentOverride(body);
    
    // Update usage counter
    await SubscriptionService.incrementUsage(project_id, 'overrides', 1);
    
    console.log(`✅ [OVERRIDE-API] Created override ${override.id} for project ${project_id}`);
    
    res.status(201).json({
      success: true,
      message: "Content override created successfully",
      override,
      subscription_info: {
        tier: permissionCheck.subscription_tier,
        usage_after: permissionCheck.usage_info?.after_request
      }
    });
    
  } catch (error) {
    console.error("❌ [OVERRIDE-API] Error creating override:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Invalid request data",
        details: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      error: "Failed to create content override"
    });
  }
});

/**
 * PUT /api/project-overrides/:id
 * Update an existing content override
 */
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const body = updateOverrideSchema.parse({ ...req.body, id });
    
    console.log(`📝 [OVERRIDE-API] Updating override: ${id}`);
    
    // Get existing override
    const existingOverride = await storage.getProjectContentOverride(id);
    if (!existingOverride) {
      return res.status(404).json({
        success: false,
        error: "Content override not found"
      });
    }
    
    // Check subscription permissions for the project
    const permissionCheck = await checkOverridePermissions(existingOverride.project_id || '', 0);
    if (!permissionCheck.allowed) {
      return res.status(403).json({
        success: false,
        error: permissionCheck.error,
        subscription_info: {
          current_tier: permissionCheck.current_tier,
          required_feature: permissionCheck.required_feature
        }
      });
    }
    
    // Update the override
    const updatedOverride = await storage.updateProjectContentOverride(id, body);
    
    if (!updatedOverride) {
      return res.status(404).json({
        success: false,
        error: "Failed to update content override"
      });
    }
    
    console.log(`✅ [OVERRIDE-API] Updated override ${id}`);
    
    res.json({
      success: true,
      message: "Content override updated successfully",
      override: updatedOverride,
      subscription_info: {
        tier: permissionCheck.subscription_tier
      }
    });
    
  } catch (error) {
    console.error("❌ [OVERRIDE-API] Error updating override:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Invalid request data",
        details: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      error: "Failed to update content override"
    });
  }
});

/**
 * DELETE /api/project-overrides/:id
 * Delete a content override
 */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🗑️ [OVERRIDE-API] Deleting override: ${id}`);
    
    // Get existing override
    const existingOverride = await storage.getProjectContentOverride(id);
    if (!existingOverride) {
      return res.status(404).json({
        success: false,
        error: "Content override not found"
      });
    }
    
    // Check subscription permissions
    const permissionCheck = await checkOverridePermissions(existingOverride.project_id || '', 0);
    if (!permissionCheck.allowed) {
      return res.status(403).json({
        success: false,
        error: permissionCheck.error,
        subscription_info: {
          current_tier: permissionCheck.current_tier
        }
      });
    }
    
    // Delete the override
    await storage.deleteProjectContentOverride(id);
    
    // Decrement usage counter (free up one override slot)
    await SubscriptionService.incrementUsage(existingOverride.project_id, 'overrides', -1);
    
    console.log(`✅ [OVERRIDE-API] Deleted override ${id}`);
    
    res.json({
      success: true,
      message: "Content override deleted successfully",
      freed_slot: true
    });
    
  } catch (error) {
    console.error("❌ [OVERRIDE-API] Error deleting override:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete content override"
    });
  }
});

/**
 * POST /api/project-overrides/bulk
 * Create multiple content overrides in bulk (subscription-gated)
 */
router.post("/bulk", async (req, res) => {
  try {
    const { project_id, overrides } = bulkOverrideSchema.parse(req.body);
    
    console.log(`📦 [OVERRIDE-API] Creating ${overrides.length} bulk overrides for project: ${project_id}`);
    
    // Check subscription permissions for bulk request
    const permissionCheck = await checkOverridePermissions(project_id, overrides.length);
    if (!permissionCheck.allowed) {
      return res.status(403).json({
        success: false,
        error: permissionCheck.error,
        subscription_info: {
          current_tier: permissionCheck.current_tier,
          required_count: overrides.length,
          usage: permissionCheck.usage_info
        }
      });
    }
    
    // Validate project exists
    const project = await storage.getDevtoolsProject(project_id);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: "Project not found"
      });
    }
    
    // Create all overrides
    const createdOverrides = [];
    const errors = [];
    
    for (let i = 0; i < overrides.length; i++) {
      try {
        const overrideData = { ...overrides[i], project_id };
        const createdOverride = await storage.createProjectContentOverride(overrideData);
        createdOverrides.push(createdOverride);
      } catch (error) {
        errors.push({
          index: i,
          data: overrides[i],
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    // Update usage counter for successfully created overrides
    if (createdOverrides.length > 0) {
      await SubscriptionService.incrementUsage(project_id, 'overrides', createdOverrides.length);
    }
    
    console.log(`✅ [OVERRIDE-API] Created ${createdOverrides.length}/${overrides.length} bulk overrides for project ${project_id}`);
    
    res.status(201).json({
      success: true,
      message: `Successfully created ${createdOverrides.length} of ${overrides.length} overrides`,
      created_overrides: createdOverrides,
      errors: errors.length > 0 ? errors : undefined,
      statistics: {
        requested: overrides.length,
        created: createdOverrides.length,
        failed: errors.length
      },
      subscription_info: {
        tier: permissionCheck.subscription_tier,
        usage_after: permissionCheck.usage_info?.after_request
      }
    });
    
  } catch (error) {
    console.error("❌ [OVERRIDE-API] Error creating bulk overrides:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Invalid request data",
        details: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      error: "Failed to create bulk overrides"
    });
  }
});

/**
 * POST /api/project-overrides/publish/:id
 * Publish a content override (verified tier only)
 */
router.post("/publish/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🚀 [OVERRIDE-API] Publishing override: ${id}`);
    
    // Get existing override
    const existingOverride = await storage.getProjectContentOverride(id);
    if (!existingOverride) {
      return res.status(404).json({
        success: false,
        error: "Content override not found"
      });
    }
    
    // Check if project has verified badge (required for publishing)
    const isVerified = await SubscriptionService.isVerified(existingOverride.project_id || '');
    if (!isVerified) {
      return res.status(403).json({
        success: false,
        error: "Publishing content overrides requires verified tier subscription",
        current_status: "not_verified",
        required_feature: "verified_badge"
      });
    }
    
    // Update to published status
    const publishedOverride = await storage.updateProjectContentOverride(id, {
      status: 'published'
    });
    
    console.log(`✅ [OVERRIDE-API] Published override ${id}`);
    
    res.json({
      success: true,
      message: "Content override published successfully",
      override: publishedOverride
    });
    
  } catch (error) {
    console.error("❌ [OVERRIDE-API] Error publishing override:", error);
    res.status(500).json({
      success: false,
      error: "Failed to publish content override"
    });
  }
});

/**
 * GET /api/project-overrides/usage/:projectId
 * Get subscription usage information for content overrides
 */
router.get("/usage/:projectId", async (req, res) => {
  try {
    const { projectId } = req.params;
    
    console.log(`📊 [OVERRIDE-API] Fetching usage info for project: ${projectId}`);
    
    const subscriptionDetails = await SubscriptionService.getSubscriptionDetails(projectId);
    const { subscription, usage, tierConfig } = subscriptionDetails;
    
    res.json({
      success: true,
      project_id: projectId,
      subscription_tier: subscription.subscription_tier,
      features: {
        can_override_bithomp: subscription.can_override_bithomp,
        can_add_extended_fields: subscription.can_add_extended_fields,
        verified_badge: subscription.verified_badge
      },
      limits: {
        max_overrides: subscription.max_override_entities,
        used_overrides: subscription.current_override_entities,
        remaining_overrides: usage.overrides_remaining
      },
      tier_info: {
        name: tierConfig.name,
        description: tierConfig.description,
        price_usd: tierConfig.price_usd
      }
    });
    
  } catch (error) {
    console.error("❌ [OVERRIDE-API] Error fetching usage info:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch usage information"
    });
  }
});

export default router;