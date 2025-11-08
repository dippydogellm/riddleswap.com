import { Router, Request, Response } from 'express';
import { socialEngagementService } from './social-engagement-service';
import { sessionAuth } from './middleware/session-auth';

const router = Router();

// Apply authentication to all routes
router.use(sessionAuth);

// Record daily login
router.post('/daily-login', async (req: any, res: Response) => {
  try {
    const { userHandle, walletAddress } = req.user;
    
    if (!userHandle || !walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'User handle and wallet address required'
      });
    }
    
    const result = await socialEngagementService.recordDailyLogin(userHandle, walletAddress);
    res.json(result);
    
  } catch (error) {
    console.error('❌ Error in daily login endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record daily login'
    });
  }
});

// Record social media engagement
router.post('/engagement', async (req: any, res: Response) => {
  try {
    const { userHandle } = req.user;
    const { platform, engagementType, postUrl, contentPreview } = req.body;
    
    if (!userHandle || !platform || !engagementType) {
      return res.status(400).json({
        success: false,
        error: 'User handle, platform, and engagement type required'
      });
    }
    
    const result = await socialEngagementService.recordEngagement(
      userHandle, 
      platform, 
      engagementType, 
      postUrl, 
      contentPreview
    );
    
    res.json(result);
    
  } catch (error) {
    console.error('❌ Error in engagement endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record engagement'
    });
  }
});

// Get engagement summary
router.get('/summary', async (req: any, res: Response) => {
  try {
    const { userHandle } = req.user;
    
    if (!userHandle) {
      return res.status(400).json({
        success: false,
        error: 'User handle required'
      });
    }
    
    const result = await socialEngagementService.getEngagementSummary(userHandle);
    res.json(result);
    
  } catch (error) {
    console.error('❌ Error in engagement summary endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get engagement summary'
    });
  }
});

// Create raid campaign (admin only)
router.post('/raids', async (req: any, res: Response) => {
  try {
    const { userHandle } = req.user;
    const { title, description, targetUrl, platform, rewardPerEngagement, maxParticipants, startDate, endDate } = req.body;
    
    // Basic validation - in production, add proper admin role checking
    if (!userHandle || !title || !description || !targetUrl || !platform || !rewardPerEngagement) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }
    
    const result = await socialEngagementService.createRaidCampaign({
      title,
      description,
      targetUrl,
      platform,
      rewardPerEngagement,
      maxParticipants,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      createdBy: userHandle
    });
    
    res.json(result);
    
  } catch (error) {
    console.error('❌ Error in create raid endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create raid campaign'
    });
  }
});

// Get active raid campaigns
router.get('/raids', async (req: Request, res: Response) => {
  try {
    const result = await socialEngagementService.getActiveRaidCampaigns();
    res.json(result);
    
  } catch (error) {
    console.error('❌ Error in get raids endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get raid campaigns'
    });
  }
});

// Participate in raid campaign
router.post('/raids/:campaignId/participate', async (req: any, res: Response) => {
  try {
    const { userHandle, walletAddress } = req.user;
    const { campaignId } = req.params;
    const { engagementProof } = req.body;
    
    if (!userHandle || !walletAddress || !engagementProof) {
      return res.status(400).json({
        success: false,
        error: 'User handle, wallet address, and engagement proof required'
      });
    }
    
    const result = await socialEngagementService.participateInRaid(
      userHandle, 
      walletAddress, 
      campaignId, 
      engagementProof
    );
    
    res.json(result);
    
  } catch (error) {
    console.error('❌ Error in raid participation endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to participate in raid'
    });
  }
});

export default router;