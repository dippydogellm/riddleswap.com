import { db } from "./db";
import { eq, and, desc, sql, gte } from "drizzle-orm";
import { trackRewardEarned } from "./rewards-service";

// Social engagement tracking and rewards
export class SocialEngagementService {
  
  // Record daily login and grant rewards
  async recordDailyLogin(userHandle: string, walletAddress: string) {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    try {
      // Check if already logged in today
      const existingLogin = await db.execute(sql`
        SELECT * FROM daily_logins 
        WHERE user_handle = ${userHandle} AND login_date = ${today}
      `);
      
      if (existingLogin.rows.length > 0) {
        return { success: true, message: "Already logged in today", reward: null };
      }
      
      // Get yesterday's login to calculate consecutive days
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const yesterdayLogin = await db.execute(sql`
        SELECT consecutive_days FROM daily_logins 
        WHERE user_handle = ${userHandle} AND login_date = ${yesterday}
      `);
      
      const consecutiveDays = yesterdayLogin.rows.length > 0 
        ? (yesterdayLogin.rows[0].consecutive_days as number) + 1 
        : 1;
      
      // Insert today's login
      await db.execute(sql`
        INSERT INTO daily_logins (user_handle, login_date, consecutive_days, reward_claimed, created_at)
        VALUES (${userHandle}, ${today}, ${consecutiveDays}, FALSE, CURRENT_TIMESTAMP)
      `);
      
      // Calculate reward based on consecutive days
      let rewardAmount = 10; // Base reward
      if (consecutiveDays >= 30) rewardAmount = 100;
      else if (consecutiveDays >= 7) rewardAmount = 50;
      else if (consecutiveDays >= 3) rewardAmount = 25;
      
      // Track the reward
      const reward = await trackRewardEarned({
        userHandle,
        walletAddress,
        rewardType: 'daily_login',
        sourceOperation: 'daily_login',
        sourceChain: 'xrp',
        rewardToken: 'RDL',
        amount: rewardAmount,
        usdValue: rewardAmount * 0.000008628, // RDL price
        description: `Daily login bonus - ${consecutiveDays} consecutive days`,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days expiry
      });
      
      return {
        success: true,
        consecutiveDays,
        reward: {
          amount: rewardAmount,
          token: 'RDL',
          description: `Daily login bonus - ${consecutiveDays} consecutive days`
        }
      };
      
    } catch (error) {
      console.error('❌ Error recording daily login:', error);
      return { success: false, error: 'Failed to record login' };
    }
  }
  
  // Record social media engagement
  async recordEngagement(userHandle: string, platform: string, engagementType: string, postUrl?: string, contentPreview?: string) {
    try {
      // Calculate reward points based on engagement type
      const rewardPoints = this.calculateEngagementRewards(engagementType);
      
      // Insert engagement record
      await db.execute(sql`
        INSERT INTO social_engagements (
          user_handle, platform, engagement_type, post_url, 
          content_preview, reward_points, verified, created_at
        )
        VALUES (
          ${userHandle}, ${platform}, ${engagementType}, ${postUrl || null},
          ${contentPreview || null}, ${rewardPoints}, FALSE, CURRENT_TIMESTAMP
        )
      `);
      
      return {
        success: true,
        rewardPoints,
        message: `Recorded ${engagementType} on ${platform}`
      };
      
    } catch (error) {
      console.error('❌ Error recording engagement:', error);
      return { success: false, error: 'Failed to record engagement' };
    }
  }
  
  // Calculate reward points based on engagement type
  private calculateEngagementRewards(engagementType: string): number {
    const rewards = {
      'post': 50,
      'retweet': 20,
      'like': 5,
      'comment': 15,
      'follow': 25,
      'share': 30,
      'story': 40,
      'reel': 60,
      'video': 80
    };
    
    return rewards[engagementType as keyof typeof rewards] || 10;
  }
  
  // Get user's engagement summary
  async getEngagementSummary(userHandle: string) {
    try {
      const summary = await db.execute(sql`
        SELECT 
          platform,
          engagement_type,
          COUNT(*) as count,
          SUM(reward_points) as total_points
        FROM social_engagements 
        WHERE user_handle = ${userHandle}
        GROUP BY platform, engagement_type
        ORDER BY total_points DESC
      `);
      
      const dailyLogins = await db.execute(sql`
        SELECT COUNT(*) as total_logins, MAX(consecutive_days) as max_streak
        FROM daily_logins 
        WHERE user_handle = ${userHandle}
      `);
      
      return {
        success: true,
        engagements: summary.rows,
        loginStats: dailyLogins.rows[0] || { total_logins: 0, max_streak: 0 }
      };
      
    } catch (error) {
      console.error('❌ Error getting engagement summary:', error);
      return { success: false, error: 'Failed to get summary' };
    }
  }
  
  // Create raid campaign
  async createRaidCampaign(data: {
    title: string;
    description: string;
    targetUrl: string;
    platform: string;
    rewardPerEngagement: number;
    maxParticipants?: number;
    startDate: Date;
    endDate: Date;
    createdBy: string;
  }) {
    try {
      const result = await db.execute(sql`
        INSERT INTO raid_campaigns (
          title, description, target_url, platform, reward_per_engagement,
          max_participants, start_date, end_date, is_active, created_by, created_at
        )
        VALUES (
          ${data.title}, ${data.description}, ${data.targetUrl}, ${data.platform},
          ${data.rewardPerEngagement}, ${data.maxParticipants || null}, 
          ${data.startDate.toISOString()}, ${data.endDate.toISOString()},
          TRUE, ${data.createdBy}, CURRENT_TIMESTAMP
        )
        RETURNING id
      `);
      
      return {
        success: true,
        campaignId: result.rows[0]?.id,
        message: 'Raid campaign created successfully'
      };
      
    } catch (error) {
      console.error('❌ Error creating raid campaign:', error);
      return { success: false, error: 'Failed to create campaign' };
    }
  }
  
  // Get active raid campaigns
  async getActiveRaidCampaigns() {
    try {
      const campaigns = await db.execute(sql`
        SELECT * FROM raid_campaigns 
        WHERE is_active = TRUE 
        AND start_date <= CURRENT_TIMESTAMP 
        AND end_date >= CURRENT_TIMESTAMP
        ORDER BY created_at DESC
      `);
      
      return {
        success: true,
        campaigns: campaigns.rows
      };
      
    } catch (error) {
      console.error('❌ Error getting raid campaigns:', error);
      return { success: false, error: 'Failed to get campaigns' };
    }
  }
  
  // Participate in raid campaign
  async participateInRaid(userHandle: string, walletAddress: string, campaignId: string, engagementProof: string) {
    try {
      // Get campaign details
      const campaign = await db.execute(sql`
        SELECT * FROM raid_campaigns WHERE id = ${campaignId} AND is_active = TRUE
      `);
      
      if (campaign.rows.length === 0) {
        return { success: false, error: 'Campaign not found or inactive' };
      }
      
      const campaignData = campaign.rows[0];
      
      // Record the engagement with raid reference
      await this.recordEngagement(
        userHandle, 
        campaignData.platform as string, 
        'raid_participation', 
        engagementProof,
        `Raid: ${campaignData.title}`
      );
      
      // Award raid rewards
      const reward = await trackRewardEarned({
        userHandle,
        walletAddress,
        rewardType: 'raid_participation',
        sourceOperation: 'raid',
        sourceChain: 'xrp',
        rewardToken: 'RDL',
        amount: campaignData.reward_per_engagement as number,
        usdValue: (campaignData.reward_per_engagement as number) * 0.000008628,
        description: `Raid participation: ${campaignData.title}`,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days expiry
      });
      
      return {
        success: true,
        reward: {
          amount: campaignData.reward_per_engagement,
          token: 'RDL',
          description: `Raid participation: ${campaignData.title}`
        }
      };
      
    } catch (error) {
      console.error('❌ Error participating in raid:', error);
      return { success: false, error: 'Failed to participate in raid' };
    }
  }
}

export const socialEngagementService = new SocialEngagementService();