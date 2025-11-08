import express from 'express';
import { rewardsService } from './rewards-service';
import { requireAuthentication, type AuthenticatedRequest } from './middleware/session-auth';
import { 
  insertProjectRewardConfigSchema,
  insertRewardClaimTransactionSchema,
  insertCommunityEngagementChallengeSchema,
  type ProjectRewardConfig
} from '../shared/schema';

export const router = express.Router();

// Apply authentication to all rewards routes
router.use(requireAuthentication);

/**
 * Get user's rewards summary by chain and token
 */
router.get('/summary', async (req: AuthenticatedRequest, res) => {
  try {
    const userHandle = req.user?.userHandle;
    if (!userHandle) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const summary = await rewardsService.getUserRewardsSummary(userHandle);
    
    res.json({
      success: true,
      data: summary,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching rewards summary:', error);
    res.status(500).json({ 
      error: 'Failed to fetch rewards summary',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get user's detailed rewards history
 */
router.get('/history', async (req: AuthenticatedRequest, res) => {
  try {
    const userHandle = req.user?.userHandle;
    if (!userHandle) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const history = await rewardsService.getUserRewardsHistory(userHandle, limit);
    
    res.json({
      success: true,
      data: history,
      count: history.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching rewards history:', error);
    res.status(500).json({ 
      error: 'Failed to fetch rewards history',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get user's claimable rewards
 */
router.get('/claimable', async (req: AuthenticatedRequest, res) => {
  try {
    const userHandle = req.user?.userHandle;
    if (!userHandle) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const claimableRewards = await rewardsService.getClaimableRewards(userHandle);
    
    // Group by reward token for easier display
    const groupedRewards = claimableRewards.reduce((acc, reward) => {
      const token = reward.reward_token;
      if (!acc[token]) {
        acc[token] = {
          token: token,
          chain: reward.source_chain,
          totalAmount: 0,
          totalUsdValue: 0,
          rewards: []
        };
      }
      
      acc[token].totalAmount += parseFloat(reward.amount);
      acc[token].totalUsdValue += parseFloat(reward.usd_value);
      acc[token].rewards.push(reward);
      
      return acc;
    }, {} as any);
    
    res.json({
      success: true,
      data: {
        grouped: Object.values(groupedRewards as any),
        individual: claimableRewards
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching claimable rewards:', error);
    res.status(500).json({ 
      error: 'Failed to fetch claimable rewards',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Claim a specific reward
 */
router.post('/claim/:rewardId', async (req: AuthenticatedRequest, res) => {
  try {
    const userHandle = req.user?.userHandle;
    if (!userHandle) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { rewardId } = req.params;
    
    if (!rewardId) {
      return res.status(400).json({ error: 'Reward ID required' });
    }

    const success = await rewardsService.claimReward(rewardId, userHandle);
    
    if (success) {
      console.log(`✅ Reward ${rewardId} claimed by ${userHandle}`);
      res.json({
        success: true,
        message: 'Reward claimed successfully',
        rewardId,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(404).json({ 
        error: 'Reward not found or already claimed',
        rewardId 
      });
    }

  } catch (error) {
    console.error('Error claiming reward:', error);
    res.status(500).json({ 
      error: 'Failed to claim reward',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * ENHANCED BLOCKCHAIN CLAIMING SYSTEM
 */

/**
 * Initiate reward claiming with real blockchain transaction
 */
router.post('/claim/initiate', async (req: AuthenticatedRequest, res) => {
  try {
    const userHandle = req.user?.userHandle;
    const walletAddress = req.user?.walletAddress;
    
    if (!userHandle || !walletAddress) {
      return res.status(401).json({ error: 'Authentication required with wallet' });
    }

    const { rewardIds, projectId, batchClaim } = req.body;
    
    if (!rewardIds || !Array.isArray(rewardIds) || rewardIds.length === 0) {
      return res.status(400).json({ error: 'Reward IDs array required' });
    }

    const result = await rewardsService.initiateRewardClaim({
      userHandle,
      walletAddress,
      rewardIds,
      projectId,
      batchClaim: batchClaim || false
    });
    
    res.json({
      success: true,
      data: result,
      message: 'Reward claim initiated - blockchain transaction in progress',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error initiating reward claim:', error);
    res.status(500).json({ 
      error: 'Failed to initiate reward claim',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get claim transaction status
 */
router.get('/claim/status/:claimTransactionId', async (req: AuthenticatedRequest, res) => {
  try {
    const userHandle = req.user?.userHandle;
    if (!userHandle) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // TODO: Implement claim transaction status checking
    // This would query the rewardClaimTransactions table
    
    res.json({
      success: true,
      data: {
        status: 'pending',
        transactionHash: null,
        confirmationCount: 0
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching claim status:', error);
    res.status(500).json({ 
      error: 'Failed to fetch claim status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * COMPREHENSIVE USER ACTIVITY TRACKING
 */

/**
 * Get comprehensive user dashboard data
 */
router.get('/dashboard', async (req: AuthenticatedRequest, res) => {
  try {
    const userHandle = req.user?.userHandle;
    const walletAddress = req.user?.walletAddress;
    
    if (!userHandle || !walletAddress) {
      return res.status(401).json({ error: 'Authentication required with wallet' });
    }

    const dashboardData = await rewardsService.getUserDashboardData(walletAddress, userHandle);
    
    res.json({
      success: true,
      data: dashboardData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch dashboard data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Update user activity tracking manually
 */
router.post('/activity/update', async (req: AuthenticatedRequest, res) => {
  try {
    const userHandle = req.user?.userHandle;
    const walletAddress = req.user?.walletAddress;
    
    if (!userHandle || !walletAddress) {
      return res.status(401).json({ error: 'Authentication required with wallet' });
    }

    const activityData = await rewardsService.updateUserActivityTracking(walletAddress, userHandle);
    
    res.json({
      success: true,
      data: activityData,
      message: 'Activity tracking updated successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error updating activity tracking:', error);
    res.status(500).json({ 
      error: 'Failed to update activity tracking',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PROJECT-BASED REWARDS SYSTEM
 */

/**
 * Get project reward configuration
 */
router.get('/project/:projectId/config', async (req: AuthenticatedRequest, res) => {
  try {
    const userHandle = req.user?.userHandle;
    if (!userHandle) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { projectId } = req.params;
    
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID required' });
    }

    const config = await rewardsService.getProjectRewardConfig(projectId);
    
    res.json({
      success: true,
      data: config,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching project reward config:', error);
    res.status(500).json({ 
      error: 'Failed to fetch project reward config',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Update project reward configuration
 */
router.put('/project/:projectId/config', async (req: AuthenticatedRequest, res) => {
  try {
    const userHandle = req.user?.userHandle;
    if (!userHandle) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { projectId } = req.params;
    
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID required' });
    }

    // TODO: Add project ownership validation

    const updates = req.body;
    const updatedConfig = await rewardsService.updateProjectRewardConfig(projectId, updates);
    
    res.json({
      success: true,
      data: updatedConfig,
      message: 'Project reward configuration updated',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error updating project reward config:', error);
    res.status(500).json({ 
      error: 'Failed to update project reward config',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get project analytics
 */
router.get('/project/:projectId/analytics', async (req: AuthenticatedRequest, res) => {
  try {
    const userHandle = req.user?.userHandle;
    if (!userHandle) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { projectId } = req.params;
    const { start, end } = req.query;
    
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID required' });
    }

    const dateRange = start && end ? { 
      start: start as string, 
      end: end as string 
    } : undefined;

    const analytics = await rewardsService.getProjectAnalytics(projectId, dateRange);
    
    res.json({
      success: true,
      data: analytics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching project analytics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch project analytics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * SOCIAL ENGAGEMENT TRACKING SYSTEM
 */

/**
 * Track social engagement action
 */
router.post('/social/track', async (req: AuthenticatedRequest, res) => {
  try {
    const userHandle = req.user?.userHandle;
    const walletAddress = req.user?.walletAddress;
    
    if (!userHandle || !walletAddress) {
      return res.status(401).json({ error: 'Authentication required with wallet' });
    }

    const { engagementType, projectId, referenceId, engagementData } = req.body;
    
    if (!engagementType) {
      return res.status(400).json({ error: 'Engagement type required' });
    }

    const validTypes = ['post', 'like', 'comment', 'follow', 'share', 'daily_login'];
    if (!validTypes.includes(engagementType)) {
      return res.status(400).json({ 
        error: 'Invalid engagement type',
        validTypes 
      });
    }

    const reward = await rewardsService.trackSocialEngagement({
      walletAddress,
      userHandle,
      engagementType,
      projectId,
      referenceId,
      engagementData
    });
    
    res.json({
      success: true,
      data: reward,
      message: reward ? 'Social engagement tracked and reward created' : 'Social engagement tracked',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error tracking social engagement:', error);
    res.status(500).json({ 
      error: 'Failed to track social engagement',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get available earning opportunities
 */
router.get('/opportunities', async (req: AuthenticatedRequest, res) => {
  try {
    const userHandle = req.user?.userHandle;
    if (!userHandle) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // TODO: Implement earning opportunities endpoint
    // This would show available challenges, daily login rewards, social engagement opportunities
    
    const opportunities = {
      dailyLogin: {
        available: true,
        reward: '0.5 RDL',
        description: 'Login daily to earn rewards'
      },
      socialEngagement: {
        post: { reward: '0.1 RDL', description: 'Create a post' },
        like: { reward: '0.01 RDL', description: 'Like a post' },
        comment: { reward: '0.05 RDL', description: 'Comment on a post' },
        follow: { reward: '0.2 RDL', description: 'Follow a user' },
        share: { reward: '0.15 RDL', description: 'Share a post' }
      },
      trading: {
        swap: { reward: '25% of fees', description: 'Earn cashback on swaps' },
        bridge: { reward: '25% of fees', description: 'Earn cashback on bridges' }
      }
    };
    
    res.json({
      success: true,
      data: opportunities,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching earning opportunities:', error);
    res.status(500).json({ 
      error: 'Failed to fetch earning opportunities',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * COMMUNITY ENGAGEMENT CHALLENGES
 */

/**
 * Get active challenges for user
 */
router.get('/challenges', async (req: AuthenticatedRequest, res) => {
  try {
    const userHandle = req.user?.userHandle;
    if (!userHandle) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // TODO: Implement challenges endpoint
    // This would query communityEngagementChallenges and user participation
    
    res.json({
      success: true,
      data: [],
      message: 'No active challenges at this time',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching challenges:', error);
    res.status(500).json({ 
      error: 'Failed to fetch challenges',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get platform-wide rewards statistics (admin endpoint)
 */
router.get('/stats', async (req: AuthenticatedRequest, res) => {
  try {
    const userHandle = req.user?.userHandle;
    if (!userHandle) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Add admin check here if needed
    const stats = await rewardsService.getPlatformStats();
    
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching platform stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch platform stats',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;