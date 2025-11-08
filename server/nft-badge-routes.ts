/**
 * NFT Badge API Routes
 * Endpoints for badge system
 */

import { Router, Request, Response } from "express";
import { calculateUserBadges, getAllBadges, getBadgeById } from "./nft-badge-system";

const router = Router();

/**
 * GET /api/badges
 * Get all available badges
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const badges = getAllBadges();

    res.json({
      success: true,
      badges,
      total: badges.length
    });
  } catch (error: any) {
    console.error("Error getting badges:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/badges/:badgeId
 * Get specific badge details
 */
router.get("/:badgeId", async (req: Request, res: Response) => {
  try {
    const { badgeId } = req.params;
    const badge = getBadgeById(badgeId);

    if (!badge) {
      return res.status(404).json({
        success: false,
        error: "Badge not found"
      });
    }

    res.json({
      success: true,
      badge
    });
  } catch (error: any) {
    console.error("Error getting badge:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/badges/user/:userHandle
 * Get badges earned by a user
 */
router.get("/user/:userHandle", async (req: Request, res: Response) => {
  try {
    const { userHandle } = req.params;
    const badges = await calculateUserBadges(userHandle);

    res.json({
      success: true,
      user_handle: userHandle,
      badges,
      total_earned: badges.length
    });
  } catch (error: any) {
    console.error("Error calculating user badges:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
