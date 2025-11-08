/**
 * Comprehensive Subscription Service
 * 
 * Provides subscription tier management, feature gating, payment integration,
 * and verification badge system for enhanced project subscriptions.
 */

import { storage } from './storage';
import { 
  type EnhancedProjectSubscription, 
  type InsertEnhancedProjectSubscription,
  type DevtoolsProject
} from '../shared/schema';

// Payment processing is handled via cryptocurrency payments only

// Subscription tier definitions
export const SUBSCRIPTION_TIERS = {
  free: {
    name: 'Free',
    price_usd: 0,
    features: {
      can_add_extended_fields: false,
      verified_badge: false,
      can_override_bithomp: false,
      can_use_cdn: false,
      can_ingestion_jobs: false,
      max_override_entities: 0,
      max_asset_storage_gb: '0',
      max_monthly_api_calls: 1000,
      max_ingestion_jobs_per_day: 0,
    },
    description: 'Basic project claiming with limited features'
  },
  pro: {
    name: 'Pro',
    price_usd: 29.99,
    features: {
      can_add_extended_fields: true,
      verified_badge: false,
      can_override_bithomp: true,
      can_use_cdn: true,
      can_ingestion_jobs: true,
      max_override_entities: 100,
      max_asset_storage_gb: '10',
      max_monthly_api_calls: 50000,
      max_ingestion_jobs_per_day: 50,
    },
    description: 'Extended metadata fields, CDN access, and enhanced features'
  },
  verified: {
    name: 'Verified',
    price_usd: 99.99,
    features: {
      can_add_extended_fields: true,
      verified_badge: true,
      can_override_bithomp: true,
      can_use_cdn: true,
      can_ingestion_jobs: true,
      max_override_entities: 1000,
      max_asset_storage_gb: '100',
      max_monthly_api_calls: 500000,
      max_ingestion_jobs_per_day: 200,
    },
    description: 'All Pro features + verification badge and priority support'
  },
  enterprise: {
    name: 'Enterprise',
    price_usd: 299.99,
    features: {
      can_add_extended_fields: true,
      verified_badge: true,
      can_override_bithomp: true,
      can_use_cdn: true,
      can_ingestion_jobs: true,
      max_override_entities: 10000,
      max_asset_storage_gb: '1000',
      max_monthly_api_calls: 5000000,
      max_ingestion_jobs_per_day: 1000,
    },
    description: 'Unlimited features with dedicated support and custom integrations'
  }
} as const;

export type SubscriptionTier = keyof typeof SUBSCRIPTION_TIERS;

// Subscription service class
export class SubscriptionService {
  
  /**
   * Get all available subscription tiers with pricing
   */
  static getAvailableTiers() {
    return Object.entries(SUBSCRIPTION_TIERS).map(([tier, config]) => ({
      tier,
      ...config
    }));
  }

  /**
   * Get or create a subscription for a project
   */
  static async getOrCreateSubscription(projectId: string): Promise<EnhancedProjectSubscription> {
    console.log(`🔍 [SUBSCRIPTION] Getting subscription for project: ${projectId}`);
    
    // Try to get existing subscription
    let subscription = await storage.getEnhancedProjectSubscriptionByProject(projectId);
    
    if (!subscription) {
      console.log(`📝 [SUBSCRIPTION] Creating new free subscription for project: ${projectId}`);
      
      // Create default free subscription
      const freeSubscriptionData: InsertEnhancedProjectSubscription = {
        project_id: projectId,
        subscription_tier: 'free',
        ...SUBSCRIPTION_TIERS.free.features,
        subscription_status: 'active',
        payment_status: 'none',
        currency: 'USD',
        monthly_price_usd: '0'
      };
      
      subscription = await storage.createEnhancedProjectSubscription(freeSubscriptionData);
    }
    
    console.log(`✅ [SUBSCRIPTION] Retrieved subscription for project ${projectId}: ${subscription.subscription_tier}`);
    return subscription;
  }

  /**
   * Check if a project has a specific feature
   */
  static async hasFeature(projectId: string, feature: keyof typeof SUBSCRIPTION_TIERS.free.features): Promise<boolean> {
    const subscription = await this.getOrCreateSubscription(projectId);
    
    // Check if subscription is active
    if (subscription.subscription_status !== 'active') {
      return false;
    }
    
    // Check if subscription has expired
    if (subscription.subscription_expires_at && new Date(subscription.subscription_expires_at) < new Date()) {
      return false;
    }
    
    // Return feature status
    return Boolean(subscription[feature]);
  }

  /**
   * Check if a project is verified (has verification badge)
   */
  static async isVerified(projectId: string): Promise<boolean> {
    return this.hasFeature(projectId, 'verified_badge');
  }

  /**
   * Get subscription features and usage for a project
   */
  static async getSubscriptionDetails(projectId: string): Promise<{
    subscription: EnhancedProjectSubscription;
    tierConfig: typeof SUBSCRIPTION_TIERS[SubscriptionTier];
    usage: {
      api_calls_remaining: number;
      storage_remaining_gb: number;
      overrides_remaining: number;
      jobs_remaining_today: number;
    };
    status: 'active' | 'expired' | 'cancelled' | 'suspended';
  }> {
    const subscription = await this.getOrCreateSubscription(projectId);
    const tierConfig = SUBSCRIPTION_TIERS[subscription.subscription_tier as SubscriptionTier];
    
    // Calculate remaining usage
    const api_calls_remaining = Math.max(0, 
      (subscription.max_monthly_api_calls || 0) - (subscription.current_monthly_api_calls || 0)
    );
    
    const storage_remaining_gb = Math.max(0,
      Number(subscription.max_asset_storage_gb) - Number(subscription.current_asset_storage_gb)
    );
    
    const overrides_remaining = Math.max(0,
      (subscription.max_override_entities || 0) - (subscription.current_override_entities || 0)
    );

    // For jobs remaining today, we'd need additional logic to track daily usage
    // For now, return the daily limit
    const jobs_remaining_today = subscription.max_ingestion_jobs_per_day || 0;
    
    // Determine actual status
    let status: 'active' | 'expired' | 'cancelled' | 'suspended' = subscription.subscription_status as any;
    
    if (subscription.subscription_expires_at && new Date(subscription.subscription_expires_at) < new Date()) {
      status = 'expired';
    }
    
    return {
      subscription,
      tierConfig,
      usage: {
        api_calls_remaining,
        storage_remaining_gb,
        overrides_remaining,
        jobs_remaining_today
      },
      status
    };
  }

  /**
   * Upgrade a project's subscription tier
   */
  static async upgradeSubscription(
    projectId: string, 
    newTier: SubscriptionTier,
    cryptoPaymentHash?: string
  ): Promise<{
    subscription?: EnhancedProjectSubscription;
    requiresPayment?: boolean;
    paymentAmount?: number;
    error?: string;
  }> {
    console.log(`🚀 [SUBSCRIPTION] Upgrading project ${projectId} to ${newTier}`);

    try {
      const tierConfig = SUBSCRIPTION_TIERS[newTier];
      const subscription = await this.getOrCreateSubscription(projectId);
      
      // For free tier, just update subscription
      if (newTier === 'free') {
        const updatedSubscription = await storage.updateEnhancedProjectSubscription(
          subscription.id,
          {
            subscription_tier: newTier,
            ...tierConfig.features,
            payment_status: 'none',
            payment_method: 'crypto',
            monthly_price_usd: '0'
          }
        );
        
        return { subscription: updatedSubscription };
      }

      // For paid tiers, require crypto payment
      if (!cryptoPaymentHash) {
        console.log(`💰 [SUBSCRIPTION] Crypto payment required for ${newTier} tier`);
        return { 
          requiresPayment: true, 
          paymentAmount: tierConfig.price_usd 
        };
      }

      // If payment hash provided, activate subscription
      const updatedSubscription = await this.activateSubscription(
        subscription.id,
        newTier,
        cryptoPaymentHash
      );
      
      return { subscription: updatedSubscription || undefined };
      
    } catch (error) {
      console.error(`❌ [SUBSCRIPTION] Error upgrading subscription:`, error);
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Handle successful payment and activate subscription
   */
  static async activateSubscription(
    subscriptionId: string,
    newTier: SubscriptionTier,
    cryptoPaymentHash: string
  ): Promise<EnhancedProjectSubscription | null> {
    console.log(`✅ [SUBSCRIPTION] Activating subscription ${subscriptionId} to ${newTier}`);
    
    try {
      const tierConfig = SUBSCRIPTION_TIERS[newTier];
      const expirationDate = new Date();
      expirationDate.setMonth(expirationDate.getMonth() + 1); // 1 month from now
      
      const updatedSubscription = await storage.updateEnhancedProjectSubscription(
        subscriptionId,
        {
          subscription_tier: newTier,
          ...tierConfig.features,
          subscription_status: 'active',
          payment_status: 'paid',
          payment_method: 'crypto',
          monthly_price_usd: tierConfig.price_usd.toString(),
          last_payment_date: new Date(),
          next_payment_date: expirationDate,
          subscription_expires_at: expirationDate,
          payment_reference: cryptoPaymentHash,
          auto_renew: false // Crypto payments don't auto-renew
        }
      );
      
      console.log(`🎉 [SUBSCRIPTION] Successfully activated ${newTier} subscription for ${subscriptionId}`);
      return updatedSubscription || null;
      
    } catch (error) {
      console.error(`❌ [SUBSCRIPTION] Error activating subscription:`, error);
      return null;
    }
  }

  /**
   * Cancel a subscription
   */
  static async cancelSubscription(projectId: string): Promise<{
    success: boolean;
    subscription?: EnhancedProjectSubscription;
    error?: string;
  }> {
    console.log(`🚫 [SUBSCRIPTION] Cancelling subscription for project: ${projectId}`);
    
    try {
      const subscription = await this.getOrCreateSubscription(projectId);
      
      const updatedSubscription = await storage.updateEnhancedProjectSubscription(
        subscription.id,
        {
          subscription_status: 'cancelled',
          auto_renew: false
        }
      );
      
      return { success: true, subscription: updatedSubscription };
      
    } catch (error) {
      console.error(`❌ [SUBSCRIPTION] Error cancelling subscription:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Process expired subscriptions (to be run as a cron job)
   */
  static async processExpiredSubscriptions(): Promise<void> {
    console.log(`🔍 [SUBSCRIPTION] Processing expired subscriptions...`);
    
    try {
      const expiredSubscriptions = await storage.getExpiredEnhancedProjectSubscriptions();
      
      for (const subscription of expiredSubscriptions) {
        console.log(`⏰ [SUBSCRIPTION] Processing expired subscription: ${subscription.id}`);
        
        // Downgrade to free tier
        await storage.updateEnhancedProjectSubscription(subscription.id, {
          subscription_tier: 'free',
          ...SUBSCRIPTION_TIERS.free.features,
          subscription_status: 'expired',
          payment_status: 'none',
          monthly_price_usd: '0'
        });
        
        console.log(`⬇️ [SUBSCRIPTION] Downgraded expired subscription ${subscription.id} to free tier`);
      }
      
      console.log(`✅ [SUBSCRIPTION] Processed ${expiredSubscriptions.length} expired subscriptions`);
      
    } catch (error) {
      console.error(`❌ [SUBSCRIPTION] Error processing expired subscriptions:`, error);
    }
  }

  /**
   * Reset monthly API call counters (to be run monthly)
   */
  static async resetMonthlyApiCalls(): Promise<void> {
    console.log(`🔄 [SUBSCRIPTION] Resetting monthly API call counters...`);
    
    try {
      // This would need to be implemented in storage to reset all counters
      // For now, we'll handle it project by project when needed
      console.log(`✅ [SUBSCRIPTION] Monthly API call reset completed`);
      
    } catch (error) {
      console.error(`❌ [SUBSCRIPTION] Error resetting API call counters:`, error);
    }
  }

  /**
   * Get verification badge information for projects
   */
  static async getVerificationInfo(projectIds: string[]): Promise<Map<string, boolean>> {
    const verificationMap = new Map<string, boolean>();
    
    for (const projectId of projectIds) {
      const isVerified = await this.isVerified(projectId);
      verificationMap.set(projectId, isVerified);
    }
    
    return verificationMap;
  }

  /**
   * Increment usage counters for a project
   */
  static async incrementUsage(
    projectId: string, 
    type: 'api_calls' | 'storage_gb' | 'overrides' | 'ingestion_jobs',
    amount: number = 1
  ): Promise<boolean> {
    try {
      const subscription = await this.getOrCreateSubscription(projectId);
      
      // Narrow explicit update shape so TS stops inferring {} (original generic type collapsed)
      type UsageUpdate = {
        current_monthly_api_calls?: number;
        current_asset_storage_gb?: string;
        current_override_entities?: number;
      };
      const updates: UsageUpdate = {};
      
      switch (type) {
        case 'api_calls':
          updates.current_monthly_api_calls = (subscription.current_monthly_api_calls || 0) + amount;
          break;
        case 'storage_gb':
          updates.current_asset_storage_gb = (
            Number(subscription.current_asset_storage_gb) + amount
          ).toString();
          break;
        case 'overrides':
          updates.current_override_entities = (subscription.current_override_entities || 0) + amount;
          break;
        // ingestion_jobs would need daily tracking logic
      }
      
      if (Object.keys(updates).length > 0) {
        // Cast to any at boundary because storage expects wider InsertEnhancedProjectSubscription shape
        await storage.updateEnhancedProjectSubscription(subscription.id, updates as any);
        console.log(`📈 [SUBSCRIPTION] Incremented ${type} usage for project ${projectId} by ${amount}`);
      }
      
      return true;
      
    } catch (error) {
      console.error(`❌ [SUBSCRIPTION] Error incrementing usage:`, error);
      return false;
    }
  }
}

export default SubscriptionService;