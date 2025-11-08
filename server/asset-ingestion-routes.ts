/**
 * Asset Ingestion API Routes
 * 
 * API endpoints for manual asset ingestion triggers and monitoring
 * Integrates with the AssetIngestionService for background processing
 */

import { Router } from "express";
import { z } from "zod";
import { storage } from "./storage";
import { assetIngestionService, IngestionJobType } from "./asset-ingestion-service";

const router = Router();

// Validation schemas
const collectionIngestionSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  issuer: z.string().min(1, "Issuer address is required"),
  taxon: z.number().int().min(0, "Taxon must be a non-negative integer"),
  chain: z.string().min(1, "Chain is required").default("xrp"),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
  includeMetadata: z.boolean().default(true),
  includeAssets: z.boolean().default(true),
  assetVariants: z.array(z.enum(["thumbnail", "medium", "large", "original"])).default(["thumbnail", "medium", "original"]),
  batchSize: z.number().int().min(1).max(100).default(50),
  triggeredBy: z.string().optional()
});

const tokenIngestionSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  issuer: z.string().min(1, "Issuer address is required"),
  currencyCode: z.string().min(1, "Currency code is required"),
  chain: z.string().min(1, "Chain is required").default("xrp"),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
  includeMetadata: z.boolean().default(true),
  includeAssets: z.boolean().default(true),
  triggeredBy: z.string().optional()
});

const assetIngestionSchema = z.object({
  urls: z.array(z.string().url()).min(1, "At least one URL is required").max(50, "Maximum 50 URLs per request"),
  projectId: z.string().optional(),
  entityType: z.enum(["token", "collection", "nft"]).default("nft"),
  entityId: z.string().optional(),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
  triggeredBy: z.string().optional()
});

/**
 * POST /api/ingest/collection
 * Manually trigger collection ingestion for an NFT collection
 */
router.post("/collection", async (req, res) => {
  try {
    const body = collectionIngestionSchema.parse(req.body);
    
    console.log(`🎯 Manual collection ingestion requested: ${body.issuer}:${body.taxon}`);
    
    // Verify project exists
    const project = await storage.getDevtoolsProject(body.projectId);
    if (!project) {
      return res.status(404).json({
        error: "Project not found",
        projectId: body.projectId
      });
    }
    
    // Check if there's already a running job for this collection
    const existingJobs = await storage.getIngestionJobsByProject(body.projectId, 'running');
    const collectionJob = existingJobs.find(job => 
      job.job_type === IngestionJobType.COLLECTION_SCAN &&
      job.issuer === body.issuer &&
      job.taxon === body.taxon
    );
    
    if (collectionJob) {
      return res.status(409).json({
        error: "Collection ingestion already in progress",
        existingJobId: collectionJob.id,
        status: collectionJob.status
      });
    }
    
    // Create collection scan job
    const job = await storage.createIngestionJob({
      project_id: body.projectId,
      job_type: IngestionJobType.COLLECTION_SCAN,
      entity_type: 'collection',
      issuer: body.issuer,
      taxon: body.taxon,
      job_config: {
        batch_size: body.batchSize,
        priority: body.priority,
        retry_limit: 3,
        include_metadata: body.includeMetadata,
        include_assets: body.includeAssets,
        asset_variants: body.assetVariants
      },
      started_by: body.triggeredBy || 'manual',
      max_attempts: 3
    });
    
    console.log(`✅ Collection ingestion job created: ${job.id}`);
    
    res.status(201).json({
      success: true,
      message: "Collection ingestion job created successfully",
      job: {
        id: job.id,
        type: job.job_type,
        status: job.status,
        projectId: job.project_id,
        issuer: job.issuer,
        taxon: job.taxon,
        config: job.job_config,
        createdAt: job.created_at
      }
    });
    
  } catch (error) {
    console.error("❌ Error creating collection ingestion job:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid request data",
        details: error.errors
      });
    }
    
    res.status(500).json({
      error: "Failed to create collection ingestion job",
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/ingest/token
 * Manually trigger token metadata ingestion for a fungible token
 */
router.post("/token", async (req, res) => {
  try {
    const body = tokenIngestionSchema.parse(req.body);
    
    console.log(`🎯 Manual token ingestion requested: ${body.issuer}:${body.currencyCode}`);
    
    // Verify project exists
    const project = await storage.getDevtoolsProject(body.projectId);
    if (!project) {
      return res.status(404).json({
        error: "Project not found",
        projectId: body.projectId
      });
    }
    
    // Check if there's already a running job for this token
    const existingJobs = await storage.getIngestionJobsByProject(body.projectId, 'running');
    const tokenJob = existingJobs.find(job => 
      job.job_type === IngestionJobType.TOKEN_METADATA &&
      job.issuer === body.issuer &&
      job.currency_code === body.currencyCode
    );
    
    if (tokenJob) {
      return res.status(409).json({
        error: "Token ingestion already in progress",
        existingJobId: tokenJob.id,
        status: tokenJob.status
      });
    }
    
    // Create token metadata job
    const job = await storage.createIngestionJob({
      project_id: body.projectId,
      job_type: IngestionJobType.TOKEN_METADATA,
      entity_type: 'token',
      issuer: body.issuer,
      currency_code: body.currencyCode,
      job_config: {
        priority: body.priority,
        retry_limit: 3,
        include_metadata: body.includeMetadata,
        include_assets: body.includeAssets,
        asset_variants: ['original']
      },
      started_by: body.triggeredBy || 'manual',
      max_attempts: 3
    });
    
    console.log(`✅ Token ingestion job created: ${job.id}`);
    
    res.status(201).json({
      success: true,
      message: "Token ingestion job created successfully",
      job: {
        id: job.id,
        type: job.job_type,
        status: job.status,
        projectId: job.project_id,
        issuer: job.issuer,
        currencyCode: job.currency_code,
        config: job.job_config,
        createdAt: job.created_at
      }
    });
    
  } catch (error) {
    console.error("❌ Error creating token ingestion job:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid request data",
        details: error.errors
      });
    }
    
    res.status(500).json({
      error: "Failed to create token ingestion job",
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/ingest/assets
 * Manually trigger asset download for specific URLs
 */
router.post("/assets", async (req, res) => {
  try {
    const body = assetIngestionSchema.parse(req.body);
    
    console.log(`🎯 Manual asset ingestion requested for ${body.urls.length} URLs`);
    
    // Verify project exists if provided
    if (body.projectId) {
      const project = await storage.getDevtoolsProject(body.projectId);
      if (!project) {
        return res.status(404).json({
          error: "Project not found",
          projectId: body.projectId
        });
      }
    }
    
    // Create asset download job
    const job = await storage.createIngestionJob({
      project_id: body.projectId || null,
      job_type: IngestionJobType.ASSET_DOWNLOAD,
      entity_type: body.entityType,
      token_id: body.entityId || null,
      job_config: {
        priority: body.priority,
        retry_limit: 3,
        include_metadata: true,
        include_assets: true,
        asset_variants: ['original'],
        urls: body.urls // Store URLs in job config
      },
      started_by: body.triggeredBy || 'manual',
      max_attempts: 3
    });
    
    console.log(`✅ Asset ingestion job created: ${job.id}`);
    
    res.status(201).json({
      success: true,
      message: "Asset ingestion job created successfully",
      job: {
        id: job.id,
        type: job.job_type,
        status: job.status,
        projectId: job.project_id,
        entityType: job.entity_type,
        entityId: job.token_id,
        urls: body.urls,
        config: job.job_config,
        createdAt: job.created_at
      }
    });
    
  } catch (error) {
    console.error("❌ Error creating asset ingestion job:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid request data",
        details: error.errors
      });
    }
    
    res.status(500).json({
      error: "Failed to create asset ingestion job",
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/ingest/status/:jobId
 * Check the status of a specific ingestion job
 */
router.get("/status/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const job = await storage.getIngestionJob(jobId);
    
    if (!job) {
      return res.status(404).json({
        error: "Ingestion job not found",
        jobId
      });
    }
    
    // Get project name if available
    let projectName = null;
    if (job.project_id) {
      const project = await storage.getDevtoolsProject(job.project_id);
      projectName = project?.project_name;
    }
    
    res.json({
      success: true,
      job: {
        id: job.id,
        projectId: job.project_id,
        projectName,
        type: job.job_type,
        entityType: job.entity_type,
        issuer: job.issuer,
        currencyCode: job.currency_code,
        taxon: job.taxon,
        tokenId: job.token_id,
        status: job.status,
        progress: job.progress,
        attempts: job.attempts,
        maxAttempts: job.max_attempts,
        config: job.job_config,
        errorMessage: job.error_message,
        errorDetails: job.error_details,
        workerId: job.worker_id,
        startedBy: job.started_by,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
        startedAt: job.started_at,
        completedAt: job.completed_at,
        failedAt: job.failed_at,
        nextRetryAt: job.next_retry_at
      }
    });
    
  } catch (error) {
    console.error("❌ Error fetching ingestion job status:", error);
    res.status(500).json({
      error: "Failed to fetch job status",
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/ingest/jobs
 * List ingestion jobs with optional filtering and pagination
 */
router.get("/jobs", async (req, res) => {
  try {
    const {
      projectId,
      status,
      type,
      limit = "20",
      offset = "0"
    } = req.query;
    
    let jobs = [];
    
    if (projectId && typeof projectId === "string") {
      jobs = await storage.getIngestionJobsByProject(
        projectId, 
        typeof status === "string" ? status : undefined
      );
    } else if (status && typeof status === "string") {
      jobs = await storage.getIngestionJobsByStatus(
        status,
        parseInt(limit as string) + parseInt(offset as string)
      );
    } else if (type && typeof type === "string") {
      jobs = await storage.getIngestionJobsByType(
        type,
        parseInt(limit as string) + parseInt(offset as string)
      );
    } else {
      // Get all jobs (limited)
      jobs = [
        ...(await storage.getIngestionJobsByStatus('queued', 100)),
        ...(await storage.getIngestionJobsByStatus('running', 100)),
        ...(await storage.getIngestionJobsByStatus('completed', 100)),
        ...(await storage.getIngestionJobsByStatus('failed', 100))
      ];
    }
    
    // Apply pagination
    const limitNum = Math.min(parseInt(limit as string), 100);
    const offsetNum = parseInt(offset as string);
    const paginatedJobs = jobs.slice(offsetNum, offsetNum + limitNum);
    
    // Enrich with project names
    const enrichedJobs = await Promise.all(
      paginatedJobs.map(async (job) => {
        let projectName = null;
        if (job.project_id) {
          try {
            const project = await storage.getDevtoolsProject(job.project_id);
            projectName = project?.project_name;
          } catch (error) {
            console.error(`Error fetching project name for ${job.project_id}:`, error);
          }
        }
        
        return {
          id: job.id,
          projectId: job.project_id,
          projectName,
          type: job.job_type,
          entityType: job.entity_type,
          issuer: job.issuer,
          currencyCode: job.currency_code,
          taxon: job.taxon,
          tokenId: job.token_id,
          status: job.status,
          progress: job.progress,
          attempts: job.attempts,
          maxAttempts: job.max_attempts,
          errorMessage: job.error_message,
          workerId: job.worker_id,
          startedBy: job.started_by,
          createdAt: job.created_at,
          updatedAt: job.updated_at,
          startedAt: job.started_at,
          completedAt: job.completed_at,
          failedAt: job.failed_at,
          nextRetryAt: job.next_retry_at
        };
      })
    );
    
    res.json({
      success: true,
      jobs: enrichedJobs,
      total: jobs.length,
      limit: limitNum,
      offset: offsetNum,
      filters: {
        projectId: projectId || null,
        status: status || null,
        type: type || null
      }
    });
    
  } catch (error) {
    console.error("❌ Error fetching ingestion jobs:", error);
    res.status(500).json({
      error: "Failed to fetch ingestion jobs",
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/ingest/jobs/:jobId/cancel
 * Cancel a running or queued ingestion job
 */
router.post("/jobs/:jobId/cancel", async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const job = await storage.getIngestionJob(jobId);
    
    if (!job) {
      return res.status(404).json({
        error: "Ingestion job not found",
        jobId
      });
    }
    
    if (!['queued', 'running'].includes(job.status)) {
      return res.status(400).json({
        error: "Job cannot be cancelled",
        status: job.status,
        message: "Only queued or running jobs can be cancelled"
      });
    }
    
    // Cancel the job
    await assetIngestionService.cancelJob(jobId);
    
    console.log(`✅ Ingestion job cancelled: ${jobId}`);
    
    res.json({
      success: true,
      message: "Ingestion job cancelled successfully",
      jobId,
      previousStatus: job.status
    });
    
  } catch (error) {
    console.error("❌ Error cancelling ingestion job:", error);
    res.status(500).json({
      error: "Failed to cancel ingestion job",
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/ingest/jobs/:jobId/retry
 * Retry a failed ingestion job
 */
router.post("/jobs/:jobId/retry", async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const job = await storage.getIngestionJob(jobId);
    
    if (!job) {
      return res.status(404).json({
        error: "Ingestion job not found",
        jobId
      });
    }
    
    if (job.status !== 'failed') {
      return res.status(400).json({
        error: "Job cannot be retried",
        status: job.status,
        message: "Only failed jobs can be retried"
      });
    }
    
    // Reset job for retry
    await storage.updateIngestionJob(jobId, {
      status: 'queued',
      error_message: null,
      error_details: null,
      worker_id: null,
      next_retry_at: null,
      failed_at: null
    });
    
    console.log(`🔄 Ingestion job queued for retry: ${jobId}`);
    
    res.json({
      success: true,
      message: "Ingestion job queued for retry",
      jobId
    });
    
  } catch (error) {
    console.error("❌ Error retrying ingestion job:", error);
    res.status(500).json({
      error: "Failed to retry ingestion job",
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/ingest/stats
 * Get ingestion statistics and service health
 */
router.get("/stats", async (req, res) => {
  try {
    // Get job counts by status
    const statuses = ['queued', 'running', 'completed', 'failed', 'cancelled'];
    const statusCounts = {};
    
    for (const status of statuses) {
      const jobs = await storage.getIngestionJobsByStatus(status, 1000);
      statusCounts[status] = jobs.length;
    }
    
    // Get recent activity (last 24 hours)
    const recentJobs = [
      ...(await storage.getIngestionJobsByStatus('completed', 100)),
      ...(await storage.getIngestionJobsByStatus('failed', 100))
    ].filter(job => {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return job.updated_at && new Date(job.updated_at) > oneDayAgo;
    });
    
    // Calculate success rate
    const recentCompleted = recentJobs.filter(job => job.status === 'completed').length;
    const recentFailed = recentJobs.filter(job => job.status === 'failed').length;
    const successRate = recentCompleted + recentFailed > 0 
      ? (recentCompleted / (recentCompleted + recentFailed) * 100).toFixed(1)
      : 0;
    
    res.json({
      success: true,
      stats: {
        statusCounts,
        recentActivity: {
          last24Hours: recentJobs.length,
          completed: recentCompleted,
          failed: recentFailed,
          successRate: `${successRate}%`
        },
        service: {
          isRunning: true, // assetIngestionService is always running
          workerId: 'worker-service', // Could get from service
          uptime: process.uptime()
        }
      }
    });
    
  } catch (error) {
    console.error("❌ Error fetching ingestion stats:", error);
    res.status(500).json({
      error: "Failed to fetch ingestion statistics",
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;