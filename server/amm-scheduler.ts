/**
 * AMM Scheduler - Automatic Market Maker Transaction Executor
 * Processes pending AMM trades every 5 minutes
 */

import * as cron from 'node-cron';
import { processAmmTrades } from './amm-executor-service';

class AmmScheduler {
  private isSchedulerRunning = false;
  private totalProcessed = 0;
  private totalSuccessful = 0;
  private totalFailed = 0;

  /**
   * Start the AMM executor scheduler
   * Runs every 5 minutes to check for pending trades
   * DISABLED in development to prevent RAM hammering when DB connection fails
   */
  start() {
    if (this.isSchedulerRunning) {
      console.log("🤖 [AMM-SCHEDULER] AMM scheduler is already running");
      return;
    }

    // Skip AMM scheduler in development mode to prevent RAM issues
    if (process.env.NODE_ENV === 'development') {
      console.log("🤖 [AMM-SCHEDULER] Skipping AMM scheduler in development mode");
      console.log("💡 [AMM-SCHEDULER] Enable in production with NODE_ENV=production");
      return;
    }

    console.log("🤖 [AMM-SCHEDULER] Starting Automatic Market Maker scheduler...");
    console.log("🤖 [AMM-SCHEDULER] Checking for pending trades every 5 minutes");

    // Schedule AMM trades every 5 minutes
    // Cron pattern: '*/5 * * * *' = every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      await this.executeScheduledTrades();
    }, {
      timezone: "UTC"
    });

    // Also run immediately on startup (after 10 seconds)
    setTimeout(async () => {
      console.log("🤖 [AMM-SCHEDULER] Running initial AMM check...");
      await this.executeScheduledTrades();
    }, 10000);

    this.isSchedulerRunning = true;
    console.log("🤖 [AMM-SCHEDULER] AMM scheduler started successfully!");
    console.log("🤖 [AMM-SCHEDULER] Next check: in 5 minutes");
  }

  /**
   * Stop the AMM scheduler
   */
  stop() {
    if (!this.isSchedulerRunning) {
      console.log("🤖 [AMM-SCHEDULER] AMM scheduler is not running");
      return;
    }

    console.log("🤖 [AMM-SCHEDULER] Stopping AMM scheduler...");
    this.isSchedulerRunning = false;
  }

  /**
   * Execute all pending AMM trades
   */
  private async executeScheduledTrades() {
    try {
      console.log("🤖 [AMM-SCHEDULER] Checking for pending AMM trades...");

      const result = await processAmmTrades();

      this.totalProcessed += result.processed;
      this.totalSuccessful += result.successful;
      this.totalFailed += result.failed;

      if (result.processed > 0) {
        console.log(`🤖 [AMM-SCHEDULER] Processed ${result.processed} trades`);
        console.log(`✅ Successful: ${result.successful}, ❌ Failed: ${result.failed}`);
        console.log(`📊 Total stats - Processed: ${this.totalProcessed}, Success: ${this.totalSuccessful}, Failed: ${this.totalFailed}`);
      } else {
        console.log("🤖 [AMM-SCHEDULER] No pending AMM trades found");
      }

    } catch (error) {
      console.error("❌ [AMM-SCHEDULER] Error executing scheduled trades:", error);
    }
  }

  /**
   * Get scheduler statistics
   */
  getStats() {
    return {
      isRunning: this.isSchedulerRunning,
      totalProcessed: this.totalProcessed,
      totalSuccessful: this.totalSuccessful,
      totalFailed: this.totalFailed
    };
  }
}

// Export singleton instance
export const ammScheduler = new AmmScheduler();
export default ammScheduler;
