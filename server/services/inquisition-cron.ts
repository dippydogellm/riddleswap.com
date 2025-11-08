/**
 * Inquisition NFT Scanner Cron Job
 * Runs hourly with comprehensive trait rarity analysis and power recalculation
 */

import * as cron from 'node-cron';
import { scanAllCollections } from '../comprehensive-nft-scanner';

let cronJob: cron.ScheduledTask | null = null;

/**
 * Start the hourly cron job
 */
export function startInquisitionCron() {
  if (cronJob) {
    console.log('⚠️ [Inquisition Cron] Job already running');
    return;
  }

  console.log('🎯 [Inquisition Cron] Starting hourly NFT scanner...');

  // Run every hour at minute 0
  cronJob = cron.schedule('0 * * * *', async () => {
    try {
      console.log('⏰ [Inquisition Cron] Running hourly scan...');
      await scanAllCollections();
    } catch (error) {
      console.error('❌ [Inquisition Cron] Scan failed:', error);
    }
  });

  console.log('✅ [Inquisition Cron] Hourly scanner started (runs at minute 0 of every hour)');

  // PRODUCTION FIX: Skip initial scan on startup to prevent deployment crashes
  // Scanner will run on the hourly schedule instead
  console.log('⏰ [Inquisition Cron] Initial scan skipped - will run on hourly schedule');
}

/**
 * Stop the cron job
 */
export function stopInquisitionCron() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log('🛑 [Inquisition Cron] Hourly scanner stopped');
  }
}

/**
 * Run scan manually (for testing)
 */
export async function runManualScan() {
  console.log('🎮 [Inquisition Cron] Running manual scan...');
  await scanAllCollections();
}
