import { Router, Request, Response } from "express";
import { notificationService } from "./notification-service";
import { readOnlyAuth } from "./middleware/read-only-auth";
import { sessionAuth } from "./middleware/session-auth";

const router = Router();

console.log("🔔 Setting up notification API routes...");

router.get("/notifications", readOnlyAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user.userHandle;

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const notifications = await notificationService.getNotifications(userId, limit, offset);
    return res.json(notifications);
  } catch (error: any) {
    console.error("❌ [NOTIFICATIONS API] Get notifications error:", error);
    return res.status(500).json({ error: error.message || "Failed to fetch notifications" });
  }
});

router.get("/notifications/unread-count", readOnlyAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user.userHandle;

    const count = await notificationService.getUnreadCount(userId);
    return res.json({ count });
  } catch (error: any) {
    console.error("❌ [NOTIFICATIONS API] Get unread count error:", error);
    return res.status(500).json({ error: error.message || "Failed to get unread count" });
  }
});

router.patch("/notifications/:id/read", sessionAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user.userHandle;

    const { id } = req.params;
    const notification = await notificationService.markAsRead(id, userId);
    return res.json(notification);
  } catch (error: any) {
    console.error("❌ [NOTIFICATIONS API] Mark as read error:", error);
    return res.status(500).json({ error: error.message || "Failed to mark as read" });
  }
});

router.post("/notifications/mark-all-read", sessionAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user.userHandle;

    await notificationService.markAllAsRead(userId);
    return res.json({ success: true });
  } catch (error: any) {
    console.error("❌ [NOTIFICATIONS API] Mark all as read error:", error);
    return res.status(500).json({ error: error.message || "Failed to mark all as read" });
  }
});

router.delete("/notifications/:id", sessionAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user.userHandle;

    const { id } = req.params;
    await notificationService.deleteNotification(id, userId);
    return res.json({ success: true });
  } catch (error: any) {
    console.error("❌ [NOTIFICATIONS API] Delete notification error:", error);
    return res.status(500).json({ error: error.message || "Failed to delete notification" });
  }
});

// Device token registration for push notifications
router.post("/notifications/register-device", sessionAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user.userHandle;

    const { deviceToken, platform, deviceName, appVersion } = req.body;
    
    if (!deviceToken || !platform) {
      return res.status(400).json({ error: "Device token and platform are required" });
    }

    // Generate device ID from deviceName or create a unique one
    const deviceId = deviceName || `device-${Date.now()}`;
    
    // Store device token in database
    await notificationService.registerDevice({
      userId,
      deviceToken,
      deviceType: platform,
      deviceId,
    });
    
    console.log(`📱 [NOTIFICATIONS] Device registered: ${platform} - ${deviceName || deviceId}`);
    
    return res.json({ 
      success: true,
      message: "Device registered for push notifications" 
    });
  } catch (error: any) {
    console.error("❌ [NOTIFICATIONS API] Register device error:", error);
    return res.status(500).json({ error: error.message || "Failed to register device" });
  }
});

console.log("✅ Notification API routes setup complete");

export default router;
