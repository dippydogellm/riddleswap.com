/**
 * Scanner Management API Routes
 * 
 * Provides endpoints for:
 * - Triggering manual scans
 * - Fetching scanner logs and statistics
 * - Monitoring scanner execution
 */

import { Router } from "express";
import { collectionInitialScanner } from "../scanners/collection-initial-scanner";
import { openAIMetadataScorer } from "../scanners/openai-metadata-scorer";
import { rarityScoringScanner } from "../scanners/rarity-scoring-scanner";
import { battleCivilizationScanner } from "../scanners/battle-civilization-scanner";

const router = Router();

/**
 * POST /api/scanners/collection/scan
 * Scanner 1: Scan a new collection (one-time, when adding collection)
 * Body: { issuer: string, taxon: number, collectionName?: string, gameRole?: string }
 */
router.post("/collection/scan", async (req, res) => {
  try {
    const { issuer, taxon, collectionName, gameRole } = req.body;
    
    if (!issuer || taxon === undefined) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: issuer, taxon"
      });
    }
    
    console.log(`📡 [SCANNER API] Received collection scan request for ${issuer}:${taxon}`);
    
    const result = await collectionInitialScanner.scanNewCollection(
      issuer,
      taxon,
      collectionName,
      gameRole
    );
    
    res.json({
      success: result.success,
      message: result.success 
        ? `Successfully scanned collection ${issuer}:${taxon}`
        : `Failed to scan collection ${issuer}:${taxon}`,
      data: {
        collection_id: result.collection_id,
        nfts_found: result.nfts_found,
        nfts_stored: result.nfts_stored,
        nfts_updated: result.nfts_updated,
        nfts_failed: result.nfts_failed,
        duration_ms: result.duration_ms
      },
      errors: result.errors
    });
    
  } catch (error) {
    console.error(`❌ [SCANNER API] Collection scan error:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * POST /api/scanners/ai-scoring/collection/:collectionId
 * Scanner 2: Score NFTs in a collection using OpenAI
 */
router.post("/ai-scoring/collection/:collectionId", async (req, res) => {
  try {
    const { collectionId } = req.params;
    
    console.log(`🤖 [SCANNER API] Received AI scoring request for collection ${collectionId}`);
    
    const result = await openAIMetadataScorer.scoreCollection(collectionId);
    
    res.json({
      success: result.success,
      message: result.success 
        ? `Successfully scored ${result.nfts_scored} NFTs`
        : `Failed to score collection`,
      data: {
        nfts_scanned: result.nfts_scanned,
        nfts_scored: result.nfts_scored,
        nfts_failed: result.nfts_failed,
        duration_ms: result.duration_ms
      },
      errors: result.errors
    });
    
  } catch (error) {
    console.error(`❌ [SCANNER API] AI scoring error:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * POST /api/scanners/ai-scoring/rescore-all
 * Scanner 2: Re-score all NFTs across all collections
 */
router.post("/ai-scoring/rescore-all", async (req, res) => {
  try {
    console.log(`🤖 [SCANNER API] Received re-score all request`);
    
    const result = await openAIMetadataScorer.rescoreAllNFTs();
    
    res.json({
      success: result.success,
      message: `Rescored ${result.nfts_scored} NFTs across all collections`,
      data: {
        nfts_scanned: result.nfts_scanned,
        nfts_scored: result.nfts_scored,
        nfts_failed: result.nfts_failed
      },
      errors: result.errors
    });
    
  } catch (error) {
    console.error(`❌ [SCANNER API] Re-score all error:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * POST /api/scanners/rarity/scan
 * Scanner 3: Run rarity & scoring scan (normally runs every 3 hours via cron)
 */
router.post("/rarity/scan", async (req, res) => {
  try {
    console.log(`⏰ [SCANNER API] Received manual rarity scan request`);
    
    const result = await rarityScoringScanner.runFullScan();
    
    res.json({
      success: result.success,
      message: result.success 
        ? `Rarity scan completed successfully`
        : `Rarity scan failed`,
      data: {
        collections_processed: result.collections_processed,
        nfts_rescored: result.nfts_rescored,
        nfts_failed: result.nfts_failed,
        leaderboard_updated: result.leaderboard_updated,
        duration_ms: result.duration_ms
      },
      errors: result.errors
    });
    
  } catch (error) {
    console.error(`❌ [SCANNER API] Rarity scan error:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * POST /api/scanners/civilization/scan
 * Scanner 4: Run civilization scan (battles + RiddleCity)
 */
router.post("/civilization/scan", async (req, res) => {
  try {
    console.log(`🏛️ [SCANNER API] Received civilization scan request`);
    
    const result = await battleCivilizationScanner.runFullScan();
    
    res.json({
      success: result.success,
      message: result.success 
        ? `Civilization scan completed successfully`
        : `Civilization scan failed`,
      data: {
        civilizations_scanned: result.civilizations_scanned,
        civilizations_updated: result.civilizations_updated,
        battles_analyzed: result.battles_analyzed,
        cities_analyzed: result.cities_analyzed,
        duration_ms: result.duration_ms
      },
      errors: result.errors
    });
    
  } catch (error) {
    console.error(`❌ [SCANNER API] Civilization scan error:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * GET /api/scanners/status
 * Get status of all scanners
 */
router.get("/status", async (req, res) => {
  try {
    res.json({
      success: true,
      scanners: {
        collection_scanner: {
          name: "Collection Initial Scanner",
          description: "Scans new collections (one-time, up to 100k NFTs)",
          endpoint: "POST /api/scanners/collection/scan",
          status: "active"
        },
        ai_scorer: {
          name: "OpenAI Metadata Scorer",
          description: "AI-powered power level scoring",
          endpoints: [
            "POST /api/scanners/ai-scoring/collection/:collectionId",
            "POST /api/scanners/ai-scoring/rescore-all"
          ],
          status: "active"
        },
        rarity_scanner: {
          name: "Rarity & Scoring Scanner",
          description: "Runs every 3 hours, recalculates rarity and power",
          endpoint: "POST /api/scanners/rarity/scan",
          schedule: "Every 3 hours (cron)",
          status: "active"
        },
        civilization_scanner: {
          name: "Battle & Civilization Scanner",
          description: "Scans battles and RiddleCity for civilization scores",
          endpoint: "POST /api/scanners/civilization/scan",
          status: "active"
        }
      }
    });
  } catch (error) {
    console.error(`❌ [SCANNER API] Status error:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * GET /api/scanners/logs
 * Get scanner execution logs with optional filtering
 * Query params: scanner, status, limit
 */
router.get("/logs", async (req, res) => {
  try {
    const { scanner, status, limit = '100' } = req.query;
    
    const db = await import("../db").then(m => m.db);
    const { scannerLogs } = await import("../../shared/schema");
    const { eq, desc, and } = await import("drizzle-orm");
    
    const conditions = [];
    if (scanner && scanner !== 'all') {
      conditions.push(eq(scannerLogs.scanner_name, scanner as string));
    }
    if (status && status !== 'all') {
      conditions.push(eq(scannerLogs.status, status as string));
    }
    
    let logs;
    if (conditions.length > 0) {
      logs = await db.select().from(scannerLogs)
        .where(and(...conditions) as any)
        .orderBy(desc(scannerLogs.started_at))
        .limit(parseInt(limit as string));
    } else {
      logs = await db.select().from(scannerLogs)
        .orderBy(desc(scannerLogs.started_at))
        .limit(parseInt(limit as string));
    }
    
    res.json({
      success: true,
      logs
    });
  } catch (error) {
    console.error(`❌ [SCANNER API] Logs error:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * GET /api/scanners/stats
 * Get scanner statistics
 */
router.get("/stats", async (req, res) => {
  try {
    const db = await import("../db").then(m => m.db);
    const { scannerLogs } = await import("../../shared/schema");
    const { eq, sql, count } = await import("drizzle-orm");
    
    const allLogs = await db.select().from(scannerLogs);
    
    const total_scans = allLogs.length;
    const successful_scans = allLogs.filter(l => l.status === 'completed').length;
    const failed_scans = allLogs.filter(l => l.status === 'failed').length;
    const running_scans = allLogs.filter(l => l.status === 'running').length;
    
    const completedLogs = allLogs.filter(l => l.status === 'completed' && l.duration_ms);
    const avg_duration_ms = completedLogs.length > 0
      ? completedLogs.reduce((sum, l) => sum + (l.duration_ms || 0), 0) / completedLogs.length
      : 0;
    
    const success_rate = total_scans > 0 ? (successful_scans / total_scans) * 100 : 0;
    
    // Group by scanner
    const byScannerMap = new Map<string, any>();
    allLogs.forEach(log => {
      if (!byScannerMap.has(log.scanner_name)) {
        byScannerMap.set(log.scanner_name, {
          scanner_name: log.scanner_name,
          total: 0,
          success: 0,
          failed: 0,
          durations: []
        });
      }
      const stats = byScannerMap.get(log.scanner_name)!;
      stats.total++;
      if (log.status === 'completed') stats.success++;
      if (log.status === 'failed') stats.failed++;
      if (log.duration_ms) stats.durations.push(log.duration_ms);
    });
    
    const by_scanner = Array.from(byScannerMap.values()).map(s => ({
      scanner_name: s.scanner_name,
      total: s.total,
      success: s.success,
      failed: s.failed,
      avg_duration: s.durations.length > 0 
        ? s.durations.reduce((a: number, b: number) => a + b, 0) / s.durations.length
        : 0
    }));
    
    res.json({
      success: true,
      total_scans,
      successful_scans,
      failed_scans,
      running_scans,
      avg_duration_ms,
      success_rate,
      by_scanner
    });
  } catch (error) {
    console.error(`❌ [SCANNER API] Stats error:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * GET /api/scanners/health
 * Health check endpoint
 */
router.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "healthy",
    timestamp: new Date().toISOString(),
    scanners: {
      collection: "ready",
      ai_scoring: "ready",
      rarity: "ready",
      civilization: "ready"
    }
  });
});

export default router;
