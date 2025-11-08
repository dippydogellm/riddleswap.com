/**
 * Twitter Scheduler - THE ORACLE Automatic Tweet System
 * Posts tweets every 2 hours using AI-generated content
 */

import * as cron from 'node-cron';
import { twitterService } from './twitter-service';

class TwitterScheduler {
  private isSchedulerRunning = false;
  private isEngagementScannerRunning = false;
  private lastTweetTime: Date | null = null;
  private lastEngagementScan: Date | null = null;
  private tweetCount = 0;
  private engagementScanCount = 0;

  /**
   * Start the automatic tweet scheduler
   * Runs every 4 hours: at minute 0 of every 4th hour
   */
  start() {
    if (this.isSchedulerRunning) {
      console.log("🐦 [SCHEDULER] Twitter scheduler is already running");
      return;
    }

    console.log("🐦 [SCHEDULER] Starting THE ORACLE automatic tweet scheduler...");
    console.log("🐦 [SCHEDULER] Tweets will be posted every 4 hours");

    // Schedule tweets every 4 hours (at :00 minutes of every 4th hour)
    // Cron pattern: '0 */4 * * *' = at minute 0 of every 4th hour
    cron.schedule('0 */4 * * *', async () => {
      await this.postAutomaticTweet();
    }, {
      timezone: "UTC"
    });

    this.isSchedulerRunning = true;
    
    const nextTweetTime = this.getNextScheduledTweetTime();
    console.log("🐦 [SCHEDULER] RiddleAuthor tweet scheduler started!");
    console.log(`🐦 [SCHEDULER] Next automatic tweet: ${nextTweetTime.toISOString()}`);

    // Start engagement scanner (runs every hour)
    this.startEngagementScanner();
  }

  /**
   * Start the engagement mention scanner
   * Runs every hour at minute 0
   */
  private startEngagementScanner() {
    if (this.isEngagementScannerRunning) {
      console.log("🔍 [ENGAGEMENT] Scanner is already running");
      return;
    }

    console.log("🔍 [ENGAGEMENT] Twitter mention scanner DISABLED per user request");
    // Disabled per user request
    // console.log("🔍 [ENGAGEMENT] Starting Twitter mention scanner...");
    // console.log("🔍 [ENGAGEMENT] Mentions will be scanned every hour");

    // // Schedule mention scans every hour (at :00 minutes)
    // cron.schedule('0 * * * *', async () => {
    //   await this.scanMentions();
    // }, {
    //   timezone: "UTC"
    // });

    // this.isEngagementScannerRunning = true;
    // console.log("✅ [ENGAGEMENT] Mention scanner started!");
  }

  /**
   * Scan for Twitter mentions and process them
   */
  private async scanMentions() {
    try {
      console.log("🔍 [ENGAGEMENT] Starting hourly mention scan...");

      const { twitterEngagementService } = await import('./twitter-engagement-service');
      await twitterEngagementService.scanMentions();

      this.lastEngagementScan = new Date();
      this.engagementScanCount++;

      console.log("✅ [ENGAGEMENT] Mention scan complete:", {
        scanNumber: this.engagementScanCount,
        timestamp: this.lastEngagementScan.toISOString(),
      });
    } catch (error) {
      console.error("❌ [ENGAGEMENT] Error in mention scanning:", error);
    }
  }

  /**
   * Stop the automatic tweet scheduler
   */
  stop() {
    if (!this.isSchedulerRunning) {
      console.log("🐦 [SCHEDULER] Twitter scheduler is not running");
      return;
    }

    // Note: node-cron doesn't have a direct way to stop specific tasks
    // In a real implementation, you'd keep references to the tasks
    console.log("🐦 [SCHEDULER] Stopping Twitter scheduler...");
    this.isSchedulerRunning = false;
  }

  /**
   * Post an automatic tweet using RiddleAuthor AI
   * Rotates between NFT collections and gaming leaderboards
   */
  private async postAutomaticTweet() {
    try {
      console.log("🐦 [AUTO-TWEET] Generating automatic tweet content...");

      // Every 3rd tweet should be a leaderboard/gaming stats tweet
      const isLeaderboardTweet = this.tweetCount % 3 === 2;

      let tweetContent: string;
      
      if (isLeaderboardTweet) {
        console.log("🏆 [AUTO-TWEET] Generating leaderboard tweet...");
        tweetContent = await this.generateLeaderboardTweet();
      } else {
        console.log("🎨 [AUTO-TWEET] Generating collection tweet...");
        tweetContent = await twitterService.generateTweetContent('automatic');
      }
      
      // Post the tweet
      const result = await twitterService.postTweet(tweetContent, 'automatic', {
        scheduled: true,
        scheduler_version: '1.0',
        tweet_number: this.tweetCount + 1,
        tweet_type: isLeaderboardTweet ? 'leaderboard' : 'collection'
      });

      if (result.success) {
        this.lastTweetTime = new Date();
        this.tweetCount++;
        
        console.log("🐦 [AUTO-TWEET] Automatic tweet posted successfully:", {
          tweetId: result.tweetId,
          tweetNumber: this.tweetCount,
          tweetType: isLeaderboardTweet ? 'leaderboard' : 'collection',
          timestamp: this.lastTweetTime.toISOString(),
          nextTweet: this.getNextScheduledTweetTime().toISOString()
        });
      } else {
        console.error("🐦 [AUTO-TWEET] Failed to post automatic tweet:", result.error);
      }

    } catch (error) {
      console.error("🐦 [AUTO-TWEET] Error in automatic tweet posting:", error);
    }
  }

  /**
   * Generate a leaderboard tweet showcasing top players
   */
  private async generateLeaderboardTweet(): Promise<string> {
    try {
      const { db } = await import('./db');
      const { gamingPlayers } = await import('../shared/schema');
      const { desc, sql } = await import('drizzle-orm');

      // Get top 5 players by total power
      const topPlayers = await db.select({
        handle: gamingPlayers.user_handle,
        totalPower: sql<number>`CAST(${gamingPlayers.army_power} + ${gamingPlayers.religion_power} + ${gamingPlayers.civilization_power} + ${gamingPlayers.economic_power} AS INTEGER)`,
        playType: gamingPlayers.play_type,
        nftCount: gamingPlayers.total_nfts_owned
      })
      .from(gamingPlayers)
      .orderBy(desc(sql`CAST(${gamingPlayers.army_power} + ${gamingPlayers.religion_power} + ${gamingPlayers.civilization_power} + ${gamingPlayers.economic_power} AS INTEGER)`))
      .limit(5);

      if (topPlayers.length === 0) {
        // Fallback to collection tweet if no players
        return await twitterService.generateTweetContent('automatic');
      }

      // Format leaderboard
      const leaderboard = topPlayers.map((p, i) => {
        const rank = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][i];
        const civEmoji = this.getCivilizationEmoji(p.playType || 'warmonger');
        const totalPower = p.totalPower || 0;
        return `${rank} @${p.handle} ${civEmoji} ${totalPower.toLocaleString()} power`;
      }).join('\n');

      const totalNFTs = topPlayers.reduce((sum, p) => sum + (p.nftCount || 0), 0);

      const tweetContent = `🏆 THE TROLLS INQUISITION LEADERBOARD 🏆

⚔️ Top Warriors of the Realm:

${leaderboard}

📊 ${totalNFTs} NFTs battling across 6 collections
🎮 Power levels updated hourly with trait rarity

Join the battle: riddleswap.com/gaming

#NFTGaming #XRPL #TrollsInquisition`;

      console.log("✅ [LEADERBOARD] Generated leaderboard tweet with", topPlayers.length, "players");
      return tweetContent;

    } catch (error) {
      console.error("❌ [LEADERBOARD] Error generating leaderboard tweet:", error);
      // Fallback to regular tweet
      return await twitterService.generateTweetContent('automatic');
    }
  }

  /**
   * Get civilization emoji based on play type
   */
  private getCivilizationEmoji(playType: string): string {
    const emojiMap: Record<string, string> = {
      'warmonger': '⚔️',
      'religious_state': '🙏',
      'trader': '💰',
      'diplomat': '🤝',
      'explorer': '🧭',
      'builder': '🏗️',
      'scholar': '📚'
    };
    return emojiMap[playType] || '⚡';
  }

  /**
   * Calculate next scheduled tweet time (every 4 hours)
   */
  private getNextScheduledTweetTime(): Date {
    const now = new Date();
    const nextHour = Math.ceil(now.getUTCHours() / 4) * 4;
    const nextTweet = new Date(now);
    
    if (nextHour >= 24) {
      nextTweet.setUTCDate(nextTweet.getUTCDate() + 1);
      nextTweet.setUTCHours(0, 0, 0, 0);
    } else {
      nextTweet.setUTCHours(nextHour, 0, 0, 0);
    }
    
    return nextTweet;
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isSchedulerRunning,
      tweetCount: this.tweetCount,
      lastTweetTime: this.lastTweetTime,
      nextScheduledTweet: this.getNextScheduledTweetTime(),
      schedulerStarted: new Date().toISOString(),
      engagement: {
        scannerRunning: this.isEngagementScannerRunning,
        scanCount: this.engagementScanCount,
        lastScan: this.lastEngagementScan,
      }
    };
  }

  /**
   * Force post a tweet now (manual trigger)
   */
  async forcePostTweet() {
    console.log("🐦 [MANUAL] Manually triggering automatic tweet...");
    await this.postAutomaticTweet();
  }

  /**
   * Force scan mentions now (manual trigger)
   */
  async forceScanMentions() {
    console.log("🔍 [MANUAL] Manually triggering mention scan...");
    await this.scanMentions();
  }
}

// Global scheduler instance
export const twitterScheduler = new TwitterScheduler();

// Auto-start the scheduler when the module loads
setTimeout(() => {
  twitterScheduler.start();
}, 1000); // Wait 1 second after server start

export default twitterScheduler;