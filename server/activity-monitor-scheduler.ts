/**
 * Activity Monitor Scheduler
 * Runs every 15 minutes to check for new activities and tweet about them
 */

import * as cron from 'node-cron';
import { activityMonitor } from './activity-monitor-service';

class ActivityMonitorScheduler {
  private isRunning = false;

  start() {
    if (this.isRunning) {
      console.log('🔍 [ACTIVITY-SCHEDULER] Already running');
      return;
    }

    // Skip activity monitor in development mode to prevent RAM issues
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 [ACTIVITY-SCHEDULER] Skipping activity monitor in development mode');
      console.log('💡 [ACTIVITY-SCHEDULER] Enable in production with NODE_ENV=production');
      return;
    }

    console.log('🔍 [ACTIVITY-SCHEDULER] Starting activity monitor...');
    console.log('🔍 [ACTIVITY-SCHEDULER] Will check for activities every 15 minutes');

    // Run every 15 minutes
    cron.schedule('*/15 * * * *', async () => {
      await this.checkAndTweetActivities();
    }, {
      timezone: 'UTC'
    });

    // Also run initial check after 1 minute
    setTimeout(async () => {
      await this.checkAndTweetActivities();
    }, 60000);

    this.isRunning = true;
    console.log('✅ [ACTIVITY-SCHEDULER] Activity monitor started!');
  }

  private async checkAndTweetActivities() {
    try {
      console.log('🔍 [ACTIVITY-SCHEDULER] Checking for new activities...');
      
      const activities = await activityMonitor.checkForActivities();
      
      if (activities.length === 0) {
        console.log('✅ [ACTIVITY-SCHEDULER] No new activities to tweet about');
        return;
      }

      console.log(`📊 [ACTIVITY-SCHEDULER] Found ${activities.length} activities`);

      // Tweet about the most important activities (max 3 per check to avoid spam)
      const prioritizedActivities = this.prioritizeActivities(activities).slice(0, 3);

      for (const activity of prioritizedActivities) {
        await activityMonitor.tweetActivity(activity);
        // Wait 5 seconds between tweets to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      // Cleanup old events
      activityMonitor.cleanupProcessedEvents();

    } catch (error) {
      console.error('❌ [ACTIVITY-SCHEDULER] Error checking activities:', error);
    }
  }

  /**
   * Prioritize activities by importance
   */
  private prioritizeActivities(activities: any[]): any[] {
    const priorities = {
      'milestone': 1,
      'big_trade': 2,
      'battle_win': 3,
      'nft_mint': 4,
      'new_user': 5,
    };

    return activities.sort((a, b) => {
      const priorityA = priorities[a.type as keyof typeof priorities] || 999;
      const priorityB = priorities[b.type as keyof typeof priorities] || 999;
      return priorityA - priorityB;
    });
  }
}

export const activityMonitorScheduler = new ActivityMonitorScheduler();

// Auto-start the scheduler when the module loads
setTimeout(() => {
  activityMonitorScheduler.start();
}, 2000); // Wait 2 seconds after server start

export default activityMonitorScheduler;
