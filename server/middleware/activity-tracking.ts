// User Activity Tracking Middleware
// Tracks time spent on site for leaderboard functionality

import type { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { userActivityTracking } from '../../shared/schema';
import { sql, eq } from 'drizzle-orm';
import type { AuthenticatedRequest } from './session-auth';

interface TimedRequest extends AuthenticatedRequest {
  sessionStartTime?: Date;
}

/**
 * Middleware to track user activity time on site
 */
export function trackUserActivity() {
  return async (req: TimedRequest, res: Response, next: NextFunction) => {
    try {
      // Only track authenticated users
      if (!req.user?.userHandle) {
        return next();
      }

      const userHandle = req.user.userHandle;
      
      // Skip API calls and internal requests
      if (req.path.startsWith('/api/') || req.path.startsWith('/_vite')) {
        return next();
      }

      // Track session start time
      req.sessionStartTime = new Date();

      // Add response finish handler to track time spent
      res.on('finish', async () => {
        if (req.sessionStartTime) {
          const timeSpentMs = Date.now() - req.sessionStartTime.getTime();
          const timeSpentMinutes = Math.ceil(timeSpentMs / (1000 * 60)); // Round up to at least 1 minute
          
          if (timeSpentMinutes >= 1) {
            try {
              await updateUserActivityTime(userHandle, timeSpentMinutes);
            } catch (error) {
              console.error('⚠️ [ACTIVITY TRACKING] Error updating user time:', error);
            }
          }
        }
      });

      next();
    } catch (error) {
      console.error('⚠️ [ACTIVITY TRACKING] Error in activity tracking middleware:', error);
      next(); // Continue without tracking
    }
  };
}

/**
 * Updates user's total time spent on site
 */
async function updateUserActivityTime(userHandle: string, timeMinutes: number) {
  try {
    console.log(`⏱️ [ACTIVITY TRACKING] Adding ${timeMinutes} minutes for user: ${userHandle}`);
    
    await db
      .insert(userActivityTracking)
      .values({
        userHandle,
        totalTimeMinutes: timeMinutes,
        sessionCount: 1,
        lastActive: new Date(),
      })
      .onConflictDoUpdate({
        target: userActivityTracking.userHandle,
        set: {
          totalTimeMinutes: sql`${userActivityTracking.totalTimeMinutes} + ${timeMinutes}`,
          sessionCount: sql`${userActivityTracking.sessionCount} + 1`,
          lastActive: new Date(),
          updatedAt: new Date(),
        },
      });
      
  } catch (error) {
    console.error('❌ [ACTIVITY TRACKING] Database error updating user time:', error);
    throw error;
  }
}

/**
 * Manual function to track user page visit (for specific events)
 */
export async function trackPageVisit(userHandle: string, durationMinutes = 1) {
  try {
    await updateUserActivityTime(userHandle, durationMinutes);
  } catch (error) {
    console.error('❌ [ACTIVITY TRACKING] Error tracking page visit:', error);
  }
}

/**
 * Get user's activity stats
 */
export async function getUserActivityStats(userHandle: string) {
  try {
    const [activity] = await db
      .select()
      .from(userActivityTracking)
      .where(eq(userActivityTracking.userHandle, userHandle))
      .limit(1);
      
    return activity || null;
  } catch (error) {
    console.error('❌ [ACTIVITY TRACKING] Error fetching user activity:', error);
    return null;
  }
}