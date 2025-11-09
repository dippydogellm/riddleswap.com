/**
 * Scanner Scheduler Service
 * 
 * Manages automated scanning and rarity calculation jobs:
 * - Collection Scan: Once per collection (checks if already scanned)
 * - Rarity Calculation: Every 3 hours for active collections
 * - Civilization Scan: On-demand after test completion
 */

import { rarityScoringService } from './rarity-scoring-service';
import { db } from '../db';
import { eq, sql, and, isNull } from 'drizzle-orm';
import { inquisitionCollections } from '../../shared/inquisition-audit-schema';
import { rarityCalculationHistory } from '../../shared/project-scorecard-schema';

interface SchedulerConfig {
  rarityCalculationInterval: number; // milliseconds (default: 3 hours)
  enableAutoScanning: boolean;
  maxConcurrentJobs: number;
}

class ScannerScheduler {
  private config: SchedulerConfig;
  private rarityIntervalId: NodeJS.Timeout | null = null;
  private activeJobs: Set<string> = new Set();
  private scannedCollections: Set<string> = new Set();

  constructor(config?: Partial<SchedulerConfig>) {
    this.config = {
      rarityCalculationInterval: 3 * 60 * 60 * 1000, // 3 hours
      enableAutoScanning: true,
      maxConcurrentJobs: 3,
      ...config,
    };
  }

  /**
   * Start the scheduler
   */
  async start(): Promise<void> {
    console.log('🚀 [SCHEDULER] Starting Scanner Scheduler...');
    console.log(`📊 [SCHEDULER] Rarity recalculation interval: ${this.config.rarityCalculationInterval / 1000 / 60} minutes`);

    if (this.config.enableAutoScanning) {
      // Initial scan of collections that need rarity calculation
      await this.scanCollectionsForRarityCalculation();

      // Set up recurring rarity calculation
      this.rarityIntervalId = setInterval(
        () => this.scanCollectionsForRarityCalculation(),
        this.config.rarityCalculationInterval
      );

      console.log('✅ [SCHEDULER] Scheduler started successfully');
    } else {
      console.log('⚠️ [SCHEDULER] Auto-scanning disabled');
    }
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    console.log('🛑 [SCHEDULER] Stopping Scanner Scheduler...');
    
    if (this.rarityIntervalId) {
      clearInterval(this.rarityIntervalId);
      this.rarityIntervalId = null;
    }

    console.log('✅ [SCHEDULER] Scheduler stopped');
  }

  /**
   * Check if a collection has been scanned
   */
  async hasCollectionBeenScanned(collectionId: string): Promise<boolean> {
    // Check memory cache first
    if (this.scannedCollections.has(collectionId)) {
      return true;
    }

    // Check database
    const history = await db
      .select()
      .from(rarityCalculationHistory)
      .where(and(
        eq(rarityCalculationHistory.collection_id, collectionId),
        eq(rarityCalculationHistory.status, 'success')
      ))
      .limit(1);

    const hasBeenScanned = history.length > 0;
    
    if (hasBeenScanned) {
      this.scannedCollections.add(collectionId);
    }

    return hasBeenScanned;
  }

  /**
   * Scan all collections and calculate rarity for those that need it
   */
  private async scanCollectionsForRarityCalculation(): Promise<void> {
    console.log('🔍 [SCHEDULER] Scanning collections for rarity calculation...');

    try {
      // Get all collections
      const collections = await db
        .select({
          issuer_address: inquisitionCollections.issuer_address,
          taxon: inquisitionCollections.taxon,
          collection_name: inquisitionCollections.collection_name,
        })
        .from(inquisitionCollections);

      console.log(`📊 [SCHEDULER] Found ${collections.length} collections`);

      // Filter collections that need calculation
      const collectionsToProcess = [];
      
      for (const collection of collections) {
        const collectionId = `${collection.issuer_address}:${collection.taxon}`;
        
        // Skip if already being processed
        if (this.activeJobs.has(collectionId)) {
          continue;
        }

        // Check last calculation time
        const lastCalc = await db
          .select({
            completed_at: rarityCalculationHistory.completed_at,
            status: rarityCalculationHistory.status,
          })
          .from(rarityCalculationHistory)
          .where(eq(rarityCalculationHistory.collection_id, collectionId))
          .orderBy(sql`${rarityCalculationHistory.completed_at} DESC NULLS LAST`)
          .limit(1);

        // Calculate if never calculated or last calculation was > 3 hours ago
        const shouldCalculate = 
          lastCalc.length === 0 || 
          lastCalc[0].status !== 'success' ||
          (lastCalc[0].completed_at && 
           new Date().getTime() - new Date(lastCalc[0].completed_at).getTime() > this.config.rarityCalculationInterval);

        if (shouldCalculate) {
          collectionsToProcess.push({ collectionId, collection });
        }
      }

      console.log(`🎯 [SCHEDULER] ${collectionsToProcess.length} collections need rarity calculation`);

      // Process collections in batches to avoid overload
      const batchSize = this.config.maxConcurrentJobs;
      for (let i = 0; i < collectionsToProcess.length; i += batchSize) {
        const batch = collectionsToProcess.slice(i, i + batchSize);
        await Promise.all(
          batch.map(({ collectionId, collection }) => 
            this.calculateCollectionRarity(collectionId, collection.collection_name)
          )
        );
      }

      console.log('✅ [SCHEDULER] Rarity calculation scan complete');
    } catch (error) {
      console.error('❌ [SCHEDULER] Error during collection scan:', error);
    }
  }

  /**
   * Calculate rarity for a specific collection
   */
  private async calculateCollectionRarity(collectionId: string, collectionName: string): Promise<void> {
    // Check if already processing
    if (this.activeJobs.has(collectionId)) {
      console.log(`⏭️ [SCHEDULER] Skipping ${collectionName} - already processing`);
      return;
    }

    // Check concurrent job limit
    if (this.activeJobs.size >= this.config.maxConcurrentJobs) {
      console.log(`⏳ [SCHEDULER] Max concurrent jobs reached, queuing ${collectionName}`);
      return;
    }

    this.activeJobs.add(collectionId);
    console.log(`🎯 [SCHEDULER] Starting rarity calculation for ${collectionName} (${collectionId})`);

    try {
      await rarityScoringService.calculateCollectionRarity(collectionId);
      this.scannedCollections.add(collectionId);
      console.log(`✅ [SCHEDULER] Completed rarity calculation for ${collectionName}`);
    } catch (error) {
      console.error(`❌ [SCHEDULER] Failed to calculate rarity for ${collectionName}:`, error);
    } finally {
      this.activeJobs.delete(collectionId);
    }
  }

  /**
   * Manually trigger rarity calculation for a collection
   */
  async triggerRarityCalculation(collectionId: string, projectId?: number): Promise<void> {
    console.log(`🎯 [SCHEDULER] Manual trigger for ${collectionId}`);
    
    if (this.activeJobs.has(collectionId)) {
      throw new Error('Collection is already being processed');
    }

    await this.calculateCollectionRarity(collectionId, collectionId);
  }

  /**
   * Trigger civilization scan (on-demand)
   * This should be called after battle tests are completed
   */
  async triggerCivilizationScan(projectId: number): Promise<void> {
    console.log(`🏛️ [SCHEDULER] Triggering civilization scan for project ${projectId}`);
    
    try {
      // TODO: Implement civilization scoring logic
      // This will calculate civilization power scores for NFTs based on battle results
      // and send scores to leaderboards
      
      console.log(`⚠️ [SCHEDULER] Civilization scan not yet implemented for project ${projectId}`);
    } catch (error) {
      console.error(`❌ [SCHEDULER] Civilization scan failed for project ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isRunning: boolean;
    activeJobs: number;
    scannedCollections: number;
    config: SchedulerConfig;
  } {
    return {
      isRunning: this.rarityIntervalId !== null,
      activeJobs: this.activeJobs.size,
      scannedCollections: this.scannedCollections.size,
      config: this.config,
    };
  }

  /**
   * Get list of active jobs
   */
  getActiveJobs(): string[] {
    return Array.from(this.activeJobs);
  }

  /**
   * Force recalculation for all collections (admin function)
   */
  async forceRecalculateAll(): Promise<void> {
    console.log('🔄 [SCHEDULER] Force recalculating all collections...');
    
    const collections = await db
      .select({
        issuer_address: inquisitionCollections.issuer_address,
        taxon: inquisitionCollections.taxon,
        collection_name: inquisitionCollections.collection_name,
      })
      .from(inquisitionCollections);

    for (const collection of collections) {
      const collectionId = `${collection.issuer_address}:${collection.taxon}`;
      await this.calculateCollectionRarity(collectionId, collection.collection_name);
    }

    console.log('✅ [SCHEDULER] Force recalculation complete');
  }
}

// Export singleton instance
export const scannerScheduler = new ScannerScheduler();

// Export class for testing
export { ScannerScheduler };
