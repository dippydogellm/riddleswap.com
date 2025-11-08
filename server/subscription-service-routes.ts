/**
 * Subscription Service API Routes
 * 
 * Provides comprehensive subscription management endpoints for:
 * - Subscription tier management
 * - Payment processing with cryptocurrency
 * - Verification badge system
 * - Feature gating and usage tracking
 */

import { Router } from "express";
import { z } from "zod";
import { SubscriptionService, SUBSCRIPTION_TIERS, type SubscriptionTier } from "./subscription-service";
import { storage } from "./storage";

const router = Router();

// Crypto payment processing only - no traditional payment processors

// Validation schemas
const upgradeSubscriptionSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  newTier: z.enum(['free', 'pro', 'verified', 'enterprise']),
  cryptoPaymentHash: z.string().optional()
});


const projectIdSchema = z.object({
  projectId: z.string().min(1, "Project ID is required")
});

/**
 * GET /api/subscriptions/tiers
 * Get all available subscription tiers with pricing and features
 */
router.get("/tiers", async (req, res) => {
  try {
    console.log(`📋 [SUBSCRIPTION-API] Fetching subscription tiers`);
    
    const tiers = SubscriptionService.getAvailableTiers();
    
    res.json({
      success: true,
      tiers,
      currency: 'USD',
      payment_methods: ['crypto'],
      trial_period_days: 14
    });
    
  } catch (error) {
    console.error("❌ [SUBSCRIPTION-API] Error fetching tiers:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch subscription tiers"
    });
  }
});

/**
 * GET /api/subscriptions/status/:projectId
 * Get current subscription status and details for a project
 */
router.get("/status/:projectId", async (req, res) => {
  try {
    const { projectId } = req.params;
    
    console.log(`📊 [SUBSCRIPTION-API] Fetching subscription status for project: ${projectId}`);
    
    // Validate project exists
    const project = await storage.getDevtoolsProject(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: "Project not found"
      });
    }
    
    const subscriptionDetails = await SubscriptionService.getSubscriptionDetails(projectId);
    
    res.json({
      success: true,
      project_id: projectId,
      ...subscriptionDetails,
      current_period_end: subscriptionDetails.subscription.subscription_expires_at,
      trial_end: subscriptionDetails.subscription.trial_ends_at,
      has_verification_badge: subscriptionDetails.subscription.verified_badge
    });
    
  } catch (error) {
    console.error("❌ [SUBSCRIPTION-API] Error fetching subscription status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch subscription status"
    });
  }
});

/**
 * POST /api/subscriptions/upgrade
 * Initiate subscription upgrade process
 */
router.post("/upgrade", async (req, res) => {
  try {
    const body = upgradeSubscriptionSchema.parse(req.body);
    const { projectId, newTier, cryptoPaymentHash } = body;
    
    console.log(`🚀 [SUBSCRIPTION-API] Processing upgrade for project ${projectId} to ${newTier}`);
    
    // Validate project exists and user has permission
    const project = await storage.getDevtoolsProject(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: "Project not found"
      });
    }
    
    // For now, skip auth check - in production, verify user owns the project
    
    const upgradeResult = await SubscriptionService.upgradeSubscription(
      projectId, 
      newTier, 
      cryptoPaymentHash
    );
    
    if (upgradeResult.error) {
      return res.status(400).json({
        success: false,
        error: upgradeResult.error
      });
    }
    
    if (upgradeResult.requiresPayment) {
      // Crypto payment required
      res.json({
        success: true,
        requires_payment: true,
        tier: newTier,
        payment_amount_usd: upgradeResult.paymentAmount,
        payment_method: 'crypto',
        message: `Please send crypto payment equivalent to $${upgradeResult.paymentAmount} USD to complete upgrade`
      });
    } else {
      // Free tier or subscription updated directly
      res.json({
        success: true,
        requires_payment: false,
        subscription: upgradeResult.subscription,
        message: `Successfully upgraded to ${newTier} tier`
      });
    }
    
  } catch (error) {
    console.error("❌ [SUBSCRIPTION-API] Error processing upgrade:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Invalid request data",
        details: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      error: "Failed to process subscription upgrade"
    });
  }
});

/**
 * POST /api/subscriptions/cancel
 * Cancel a subscription
 */
router.post("/cancel", async (req, res) => {
  try {
    const { projectId } = projectIdSchema.parse(req.body);
    
    console.log(`🚫 [SUBSCRIPTION-API] Cancelling subscription for project: ${projectId}`);
    
    // Validate project exists
    const project = await storage.getDevtoolsProject(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: "Project not found"
      });
    }
    
    const cancelResult = await SubscriptionService.cancelSubscription(projectId);
    
    if (!cancelResult.success) {
      return res.status(400).json({
        success: false,
        error: cancelResult.error
      });
    }
    
    res.json({
      success: true,
      message: "Subscription cancelled successfully",
      subscription: cancelResult.subscription,
      effective_date: cancelResult.subscription?.cancelled_at
    });
    
  } catch (error) {
    console.error("❌ [SUBSCRIPTION-API] Error cancelling subscription:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Invalid request data",
        details: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      error: "Failed to cancel subscription"
    });
  }
});

/**
 * GET /api/subscriptions/features/:projectId
 * Get available features and current usage for a project
 */
router.get("/features/:projectId", async (req, res) => {
  try {
    const { projectId } = req.params;
    
    console.log(`🔍 [SUBSCRIPTION-API] Fetching features for project: ${projectId}`);
    
    // Validate project exists
    const project = await storage.getDevtoolsProject(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: "Project not found"
      });
    }
    
    const subscriptionDetails = await SubscriptionService.getSubscriptionDetails(projectId);
    const { subscription, tierConfig, usage, status } = subscriptionDetails;
    
    // Build feature status map
    const features = {
      can_add_extended_fields: {
        enabled: subscription.can_add_extended_fields,
        description: "Add custom metadata fields to your project"
      },
      verified_badge: {
        enabled: subscription.verified_badge,
        description: "Display verification badge on your project"
      },
      can_override_bithomp: {
        enabled: subscription.can_override_bithomp,
        description: "Override external API data with custom information"
      },
      can_use_cdn: {
        enabled: subscription.can_use_cdn,
        description: "Use CDN for fast asset delivery"
      },
      can_ingestion_jobs: {
        enabled: subscription.can_ingestion_jobs,
        description: "Run background data ingestion jobs"
      }
    };
    
    res.json({
      success: true,
      project_id: projectId,
      subscription_tier: subscription.subscription_tier,
      subscription_status: status,
      features,
      limits: {
        api_calls: {
          max: subscription.max_monthly_api_calls,
          used: subscription.current_monthly_api_calls,
          remaining: usage.api_calls_remaining,
          reset_date: subscription.api_calls_reset_date
        },
        storage: {
          max_gb: Number(subscription.max_asset_storage_gb),
          used_gb: Number(subscription.current_asset_storage_gb),
          remaining_gb: usage.storage_remaining_gb
        },
        overrides: {
          max: subscription.max_override_entities,
          used: subscription.current_override_entities,
          remaining: usage.overrides_remaining
        },
        daily_jobs: {
          max: subscription.max_ingestion_jobs_per_day,
          remaining: usage.jobs_remaining_today
        }
      }
    });
    
  } catch (error) {
    console.error("❌ [SUBSCRIPTION-API] Error fetching features:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch subscription features"
    });
  }
});

/**
 * GET /api/subscriptions/verification/:projectId
 * Check verification badge status for a project
 */
router.get("/verification/:projectId", async (req, res) => {
  try {
    const { projectId } = req.params;
    
    console.log(`✓ [SUBSCRIPTION-API] Checking verification status for project: ${projectId}`);
    
    const isVerified = await SubscriptionService.isVerified(projectId);
    const subscription = await SubscriptionService.getOrCreateSubscription(projectId);
    
    res.json({
      success: true,
      project_id: projectId,
      verified: isVerified,
      subscription_tier: subscription.subscription_tier,
      badge_eligible: subscription.subscription_tier === 'verified' || subscription.subscription_tier === 'enterprise'
    });
    
  } catch (error) {
    console.error("❌ [SUBSCRIPTION-API] Error checking verification:", error);
    res.status(500).json({
      success: false,
      error: "Failed to check verification status"
    });
  }
});

/**
 * POST /api/subscriptions/verification/bulk
 * Bulk check verification status for multiple projects
 */
router.post("/verification/bulk", async (req, res) => {
  try {
    const { projectIds } = z.object({
      projectIds: z.array(z.string()).min(1).max(100)
    }).parse(req.body);
    
    console.log(`✓ [SUBSCRIPTION-API] Bulk verification check for ${projectIds.length} projects`);
    
    const verificationMap = await SubscriptionService.getVerificationInfo(projectIds);
    
    const verifications = Object.fromEntries(verificationMap.entries());
    
    res.json({
      success: true,
      verifications,
      count: projectIds.length
    });
    
  } catch (error) {
    console.error("❌ [SUBSCRIPTION-API] Error in bulk verification check:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Invalid request data",
        details: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      error: "Failed to check verification statuses"
    });
  }
});

/**
 * POST /api/subscriptions/usage/increment
 * Increment usage counter for a project (for internal API use)
 */
router.post("/usage/increment", async (req, res) => {
  try {
    const { projectId, type, amount = 1 } = z.object({
      projectId: z.string().min(1),
      type: z.enum(['api_calls', 'storage_gb', 'overrides', 'ingestion_jobs']),
      amount: z.number().min(0).default(1)
    }).parse(req.body);
    
    console.log(`📈 [SUBSCRIPTION-API] Incrementing ${type} usage for project ${projectId} by ${amount}`);
    
    const success = await SubscriptionService.incrementUsage(projectId, type, amount);
    
    if (success) {
      res.json({
        success: true,
        message: `Successfully incremented ${type} usage`,
        project_id: projectId,
        increment: amount
      });
    } else {
      res.status(400).json({
        success: false,
        error: "Failed to increment usage counter"
      });
    }
    
  } catch (error) {
    console.error("❌ [SUBSCRIPTION-API] Error incrementing usage:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Invalid request data",
        details: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      error: "Failed to increment usage"
    });
  }
});

/**
 * POST /api/subscriptions/crypto-payment
 * Process crypto payment confirmation
 */
router.post("/crypto-payment", async (req, res) => {
  try {
    const { projectId, subscriptionTier, cryptoPaymentHash } = z.object({
      projectId: z.string().min(1, "Project ID is required"),
      subscriptionTier: z.enum(['pro', 'verified', 'enterprise']),
      cryptoPaymentHash: z.string().min(1, "Crypto payment hash is required")
    }).parse(req.body);
    
    console.log(`💰 [SUBSCRIPTION-API] Processing crypto payment for project ${projectId}`);
    
    // Validate project exists
    const project = await storage.getDevtoolsProject(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: "Project not found"
      });
    }
    
    // Get current subscription
    const subscription = await SubscriptionService.getOrCreateSubscription(projectId);
    
    // Activate subscription with crypto payment
    const activatedSubscription = await SubscriptionService.activateSubscription(
      subscription.id,
      subscriptionTier,
      cryptoPaymentHash
    );
    
    if (activatedSubscription) {
      console.log(`🎉 [SUBSCRIPTION-API] Crypto payment processed successfully for project ${projectId}`);
      
      res.json({
        success: true,
        message: `Successfully upgraded to ${subscriptionTier} tier`,
        subscription: activatedSubscription,
        payment_hash: cryptoPaymentHash
      });
    } else {
      res.status(400).json({
        success: false,
        error: "Failed to process crypto payment"
      });
    }
    
  } catch (error) {
    console.error('❌ [SUBSCRIPTION-API] Crypto payment error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Invalid request data",
        details: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Crypto payment processing failed'
    });
  }
});

/**
 * GET /api/subscriptions/admin/expired
 * Get expired subscriptions (admin endpoint)
 */
router.get("/admin/expired", async (req, res) => {
  try {
    console.log(`👨‍💼 [SUBSCRIPTION-API] Admin: Fetching expired subscriptions`);
    
    const expiredSubscriptions = await storage.getExpiredEnhancedProjectSubscriptions();
    
    res.json({
      success: true,
      expired_subscriptions: expiredSubscriptions,
      count: expiredSubscriptions.length
    });
    
  } catch (error) {
    console.error("❌ [SUBSCRIPTION-API] Error fetching expired subscriptions:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch expired subscriptions"
    });
  }
});

/**
 * POST /api/subscriptions/admin/process-expired
 * Process all expired subscriptions (admin endpoint)
 */
router.post("/admin/process-expired", async (req, res) => {
  try {
    console.log(`👨‍💼 [SUBSCRIPTION-API] Admin: Processing expired subscriptions`);
    
    await SubscriptionService.processExpiredSubscriptions();
    
    res.json({
      success: true,
      message: "Expired subscriptions processed successfully"
    });
    
  } catch (error) {
    console.error("❌ [SUBSCRIPTION-API] Error processing expired subscriptions:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process expired subscriptions"
    });
  }
});

export default router;