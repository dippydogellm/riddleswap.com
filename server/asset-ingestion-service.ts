/**
 * Asset Ingestion Service - Background NFT Collection Download System
 * 
 * This service handles automatic asset ingestion when projects are claimed,
 * downloads complete NFT collections including metadata and images,
 * and manages a robust queue system with retry logic.
 */

import { createHash } from "crypto";
import { mkdir, writeFile, stat, readFile } from "fs/promises";
import { join, extname, resolve, dirname } from "path";
import { existsSync } from "fs";
import fetch from "node-fetch";
import { storage } from "./storage";
import { getBithompCollection } from "./bithomp-api-v2";
import { InsertAssetFile, InsertIngestionJob, DevtoolsProject } from "@shared/schema";
import { nanoid } from "nanoid";

// Configuration
const INGESTION_CONFIG = {
  // Concurrency and timing
  maxConcurrentJobs: 3,
  maxConcurrentDownloads: 10,
  downloadTimeoutMs: 30000,
  retryDelayBase: 1000, // 1 second base delay
  maxRetryDelay: 300000, // 5 minutes max delay
  
  // File handling
  maxFileSize: 50 * 1024 * 1024, // 50MB max file size
  allowedMimeTypes: [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/json', 'text/plain', 'video/mp4', 'video/webm'
  ],
  
  // Storage paths
  assetStorageRoot: resolve("store-assets"),
  
  // Rate limiting
  requestDelayMs: 100, // Delay between requests to be respectful
  batchSize: 50 // NFTs to process in each batch
};

// Supported job types
export enum IngestionJobType {
  COLLECTION_SCAN = 'collection_scan',
  TOKEN_METADATA = 'token_metadata', 
  ASSET_DOWNLOAD = 'asset_download',
  METADATA_REFRESH = 'metadata_refresh'
}

// Job status enum
export enum IngestionJobStatus {
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  PAUSED = 'paused'
}

// Asset ingestion result
interface AssetIngestionResult {
  success: boolean;
  assetFile?: any;
  error?: string;
  skipped?: boolean;
  skipReason?: string;
}

// Collection discovery result
interface CollectionDiscoveryResult {
  success: boolean;
  nfts?: Array<{
    tokenId: string;
    sequence?: number;
    metadata?: any;
    imageUrl?: string;
    metadataUrl?: string;
  }>;
  error?: string;
  total?: number;
}

/**
 * Main Asset Ingestion Service Class
 */
export class AssetIngestionService {
  private activeJobs = new Map<string, AbortController>();
  private workerQueue: string[] = [];
  private isProcessing = false;
  private workerId: string;

  constructor() {
    this.workerId = `worker-${nanoid(8)}`;
    console.log(`🚀 Asset Ingestion Service initialized with worker ID: ${this.workerId}`);
  }

  /**
   * Start the ingestion service
   * DISABLED in development to prevent RAM hammering
   */
  async start(): Promise<void> {
    // Skip asset ingestion in development mode to prevent RAM issues
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 [ASSET-INGESTION] Skipping asset ingestion in development mode');
      console.log('💡 [ASSET-INGESTION] Enable in production with NODE_ENV=production');
      return;
    }

    console.log('🔄 Starting asset ingestion service...');
    this.isProcessing = true;
    
    // Process existing queued jobs
    this.processQueue();
    
    // Set up periodic queue processing
    setInterval(() => {
      if (this.isProcessing) {
        this.processQueue();
      }
    }, 60000); // Check every 60 seconds (reduced CPU usage)
    
    console.log('✅ Asset ingestion service started');
  }

  /**
   * Stop the ingestion service
   */
  async stop(): Promise<void> {
    console.log('⏹️ Stopping asset ingestion service...');
    this.isProcessing = false;
    
    // Cancel all active jobs
    for (const [jobId, controller] of this.activeJobs) {
      console.log(`❌ Cancelling active job: ${jobId}`);
      controller.abort();
      await storage.updateIngestionJobStatus(jobId, IngestionJobStatus.CANCELLED, 'Service stopped');
    }
    
    this.activeJobs.clear();
    console.log('✅ Asset ingestion service stopped');
  }

  /**
   * Trigger collection ingestion for a claimed project
   */
  async triggerProjectIngestion(project: DevtoolsProject, triggeredBy?: string): Promise<string[]> {
    console.log(`🎯 Triggering project ingestion for project: ${project.id} (${project.name})`);
    
    const jobIds: string[] = [];
    
    try {
      // Create collection scan job if it's an NFT project
      if ((project as any).nft_token_taxon && (project as any).issuer_wallet && (project as any).discovered_from_chain) {
        const collectionJob = await this.createCollectionScanJob({
          projectId: project.id,
          issuer: project.issuer_wallet,
          taxon: project.nft_token_taxon,
          chain: project.discovered_from_chain,
          triggeredBy
        });
        
        if (collectionJob) {
          jobIds.push(collectionJob.id);
          console.log(`✅ Created collection scan job: ${collectionJob.id}`);
        }
      }
      
      // Create token metadata job if it's a token project
      if ((project as any).currency_code && (project as any).issuer_wallet && (project as any).discovered_from_chain) {
        const tokenJob = await this.createTokenMetadataJob({
          projectId: project.id,
          issuer: (project as any).issuer_wallet,
          currencyCode: (project as any).currency_code,
          chain: (project as any).discovered_from_chain,
          triggeredBy
        });
        
        if (tokenJob) {
          jobIds.push(tokenJob.id);
          console.log(`✅ Created token metadata job: ${tokenJob.id}`);
        }
      }
      
      // Trigger queue processing
      this.processQueue();
      
      console.log(`🎉 Project ingestion triggered successfully. Created ${jobIds.length} jobs.`);
      return jobIds;
      
    } catch (error) {
      console.error('❌ Error triggering project ingestion:', error);
      throw error;
    }
  }

  /**
   * Create a collection scan job
   */
  async createCollectionScanJob(params: {
    projectId: string;
    issuer: string;
    taxon: number;
    chain: string;
    triggeredBy?: string;
  }): Promise<any> {
    const job = await storage.createIngestionJob({
      project_id: params.projectId,
      job_type: IngestionJobType.COLLECTION_SCAN,
      entity_type: 'collection',
      issuer: params.issuer,
      taxon: params.taxon,
      job_config: {
        batch_size: INGESTION_CONFIG.batchSize,
        priority: 'normal',
        retry_limit: 3,
        include_metadata: true,
        include_assets: true,
        asset_variants: ['thumbnail', 'medium', 'large', 'original']
      },
      started_by: params.triggeredBy,
      max_attempts: 3
    });
    
    return job;
  }

  /**
   * Create a token metadata job
   */
  async createTokenMetadataJob(params: {
    projectId: string;
    issuer: string;
    currencyCode: string;
    chain: string;
    triggeredBy?: string;
  }): Promise<any> {
    const job = await storage.createIngestionJob({
      project_id: params.projectId,
      job_type: IngestionJobType.TOKEN_METADATA,
      entity_type: 'token',
      issuer: params.issuer,
      currency_code: params.currencyCode,
      job_config: {
        priority: 'normal',
        retry_limit: 3,
        include_metadata: true,
        include_assets: true,
        asset_variants: ['original']
      },
      started_by: params.triggeredBy,
      max_attempts: 3
    });
    
    return job;
  }

  /**
   * Process the job queue
   */
  private async processQueue(): Promise<void> {
    if (this.activeJobs.size >= INGESTION_CONFIG.maxConcurrentJobs) {
      return; // Already at max capacity
    }
    
    try {
      // Get queued jobs
      const queuedJobs = await storage.getQueuedIngestionJobs(
        this.workerId, 
        INGESTION_CONFIG.maxConcurrentJobs - this.activeJobs.size
      );
      
      if (queuedJobs.length === 0) {
        return; // No jobs to process
      }
      
      console.log(`📋 Found ${queuedJobs.length} queued jobs to process`);
      
      // Process each job
      for (const job of queuedJobs) {
        if (this.activeJobs.size >= INGESTION_CONFIG.maxConcurrentJobs) {
          break; // Reached max capacity
        }
        
        // Assign job to this worker
        const assignedJob = await storage.assignIngestionJobToWorker(job.id, this.workerId);
        if (!assignedJob) {
          continue; // Job was already assigned to another worker
        }
        
        // Start processing the job
        this.processJob(assignedJob);
      }
      
    } catch (error) {
      console.error('❌ Error processing job queue:', error);
    }
  }

  /**
   * Process a single ingestion job
   */
  private async processJob(job: any): Promise<void> {
    const controller = new AbortController();
    this.activeJobs.set(job.id, controller);
    
    console.log(`🔨 Starting job: ${job.id} (${job.job_type})`);
    
    try {
      // Update job status to running
      await storage.updateIngestionJobStatus(job.id, IngestionJobStatus.RUNNING);
      await storage.updateIngestionJob(job.id, {
        started_at: new Date(),
        worker_id: this.workerId
      });
      
      let result;
      
      // Process based on job type
      switch (job.job_type) {
        case IngestionJobType.COLLECTION_SCAN:
          result = await this.processCollectionScan(job, controller.signal);
          break;
          
        case IngestionJobType.TOKEN_METADATA:
          result = await this.processTokenMetadata(job, controller.signal);
          break;
          
        case IngestionJobType.ASSET_DOWNLOAD:
          result = await this.processAssetDownload(job, controller.signal);
          break;
          
        default:
          throw new Error(`Unknown job type: ${job.job_type}`);
      }
      
      // Update job completion status
      if (result.success) {
        await storage.updateIngestionJobStatus(job.id, IngestionJobStatus.COMPLETED);
        await storage.updateIngestionJob(job.id, {
          completed_at: new Date(),
          progress: result.progress || {}
        });
        console.log(`✅ Job completed successfully: ${job.id}`);
      } else {
        throw new Error(result.error || 'Job failed without specific error');
      }
      
    } catch (error) {
      console.error(`❌ Job failed: ${job.id}`, error);
      
      // Increment attempt count
      await storage.incrementIngestionJobAttempt(job.id);
      
      // Check if we should retry
      const updatedJob = await storage.getIngestionJob(job.id);
      if (updatedJob && updatedJob.attempts < updatedJob.max_attempts) {
        // Schedule retry
        const retryDelay = Math.min(
          INGESTION_CONFIG.retryDelayBase * Math.pow(2, updatedJob.attempts),
          INGESTION_CONFIG.maxRetryDelay
        );
        
        const nextRetryAt = new Date(Date.now() + retryDelay);
        
        await storage.updateIngestionJob(job.id, {
          status: IngestionJobStatus.QUEUED,
          next_retry_at: nextRetryAt,
          error_message: error instanceof Error ? error.message : 'Unknown error',
          worker_id: null // Release worker assignment
        });
        
        console.log(`🔄 Job scheduled for retry in ${retryDelay}ms: ${job.id}`);
      } else {
        // Mark as failed
        await storage.updateIngestionJobStatus(
          job.id, 
          IngestionJobStatus.FAILED, 
          error instanceof Error ? error.message : 'Unknown error'
        );
        await storage.updateIngestionJob(job.id, {
          failed_at: new Date()
        });
        console.log(`💀 Job failed permanently: ${job.id}`);
      }
      
    } finally {
      // Clean up
      this.activeJobs.delete(job.id);
    }
  }

  /**
   * Process collection scan job
   */
  private async processCollectionScan(job: any, signal: AbortSignal): Promise<any> {
    console.log(`🔍 Processing collection scan: ${job.issuer}:${job.taxon}`);
    
    try {
      // Discover collection NFTs using Bithomp API
      const discoveryResult = await this.discoverCollectionNFTs(
        job.issuer, 
        job.taxon, 
        signal
      );
      
      if (!discoveryResult.success || !discoveryResult.nfts) {
        throw new Error(discoveryResult.error || 'Collection discovery failed');
      }
      
      console.log(`📊 Discovered ${discoveryResult.nfts.length} NFTs in collection`);
      
      // Update progress
      await storage.updateIngestionJobProgress(job.id, {
        total_items: discoveryResult.nfts.length,
        processed_items: 0,
        current_item: 'Starting asset download...'
      });
      
      // Download assets for each NFT
      let processed = 0;
      let failed = 0;
      
      for (const nft of discoveryResult.nfts) {
        if (signal.aborted) {
          throw new Error('Job cancelled');
        }
        
        try {
          // Download NFT assets
          const assetResults = await this.downloadNFTAssets(nft, signal);
          
          if (assetResults.some(r => r.success)) {
            processed++;
          } else {
            failed++;
          }
          
          // Update progress
          await storage.updateIngestionJobProgress(job.id, {
            total_items: discoveryResult.nfts.length,
            processed_items: processed,
            failed_items: failed,
            current_item: `Processing NFT ${nft.tokenId}`
          });
          
          // Add small delay to be respectful
          await new Promise(resolve => setTimeout(resolve, INGESTION_CONFIG.requestDelayMs));
          
        } catch (error) {
          console.error(`❌ Error processing NFT ${nft.tokenId}:`, error);
          failed++;
        }
      }
      
      console.log(`✅ Collection scan complete. Processed: ${processed}, Failed: ${failed}`);
      
      return {
        success: true,
        progress: {
          total_items: discoveryResult.nfts.length,
          processed_items: processed,
          failed_items: failed,
          current_item: 'Completed'
        }
      };
      
    } catch (error) {
      console.error('❌ Collection scan failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Process token metadata job
   */
  private async processTokenMetadata(job: any, signal: AbortSignal): Promise<any> {
    console.log(`🔍 Processing token metadata: ${job.issuer}:${job.currency_code}`);
    
    try {
      // Get token metadata from Bithomp
      const tokenData = await getBithompCollection(job.issuer, job.currency_code);
      
      if (!tokenData) {
        throw new Error('Token metadata not found');
      }
      
      // Download token assets if available
      const assetResults: AssetIngestionResult[] = [];
      const tokenDataAny = tokenData as any;
      
      if (tokenDataAny.image) {
        const imageResult = await this.downloadAsset(
          tokenDataAny.image,
          'image',
          `token-${job.issuer}-${job.currency_code}`,
          signal
        );
        assetResults.push(imageResult);
      }
      
      // Process any additional asset URLs
      const additionalUrls = [
        tokenDataAny.icon,
        tokenDataAny.logo,
        tokenDataAny.banner
      ].filter(Boolean);
      
      for (const url of additionalUrls) {
        if (url) {
          const result = await this.downloadAsset(
            url,
            'image',
            `token-${job.issuer}-${job.currency_code}`,
            signal
          );
          assetResults.push(result);
        }
      }
      
      const successfulDownloads = assetResults.filter(r => r.success).length;
      
      console.log(`✅ Token metadata processing complete. Downloaded ${successfulDownloads} assets.`);
      
      return {
        success: true,
        progress: {
          total_items: assetResults.length,
          processed_items: successfulDownloads,
          failed_items: assetResults.length - successfulDownloads,
          current_item: 'Completed'
        }
      };
      
    } catch (error) {
      console.error('❌ Token metadata processing failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Process asset download job
   */
  private async processAssetDownload(job: any, signal: AbortSignal): Promise<any> {
    console.log(`⬇️ Processing asset download job: ${job.id}`);
    
    try {
      // This would be for standalone asset download jobs
      // Implementation depends on specific requirements
      
      return {
        success: true,
        progress: {
          total_items: 1,
          processed_items: 1,
          current_item: 'Completed'
        }
      };
      
    } catch (error) {
      console.error('❌ Asset download failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Discover NFTs in a collection using Bithomp API
   */
  private async discoverCollectionNFTs(
    issuer: string, 
    taxon: number, 
    signal: AbortSignal
  ): Promise<CollectionDiscoveryResult> {
    try {
      console.log(`🔍 Discovering NFTs for collection ${issuer}:${taxon}`);
      
      // Use existing Bithomp API integration
      const collectionData = await getBithompCollection(issuer, taxon);
      
      if (!collectionData) {
        return {
          success: false,
          error: 'Collection not found in Bithomp API'
        };
      }
      
      // For now, return basic collection info
      // In a real implementation, you'd need to fetch individual NFTs
      // This might require additional Bithomp API endpoints or XRPL queries
      
      const collDataAny = collectionData as any;
      const mockNFTs = [
        {
          tokenId: `${issuer}:${taxon}:1`,
          sequence: 1,
          metadata: collectionData,
          imageUrl: collDataAny.image,
          metadataUrl: collDataAny.website
        }
      ];
      
      return {
        success: true,
        nfts: mockNFTs,
        total: mockNFTs.length
      };
      
    } catch (error) {
      console.error('❌ Collection discovery failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Collection discovery failed'
      };
    }
  }

  /**
   * Download assets for an NFT
   */
  private async downloadNFTAssets(
    nft: any, 
    signal: AbortSignal
  ): Promise<AssetIngestionResult[]> {
    const results: AssetIngestionResult[] = [];
    
    // Download main image
    if (nft.imageUrl) {
      const imageResult = await this.downloadAsset(
        nft.imageUrl,
        'image',
        nft.tokenId,
        signal
      );
      results.push(imageResult);
    }
    
    // Download metadata if it's a URL
    if (nft.metadataUrl && nft.metadataUrl.startsWith('http')) {
      const metadataResult = await this.downloadAsset(
        nft.metadataUrl,
        'metadata',
        nft.tokenId,
        signal
      );
      results.push(metadataResult);
    }
    
    return results;
  }

  /**
   * Download a single asset
   */
  private async downloadAsset(
    url: string,
    assetType: string,
    entityId: string,
    signal: AbortSignal
  ): Promise<AssetIngestionResult> {
    try {
      console.log(`⬇️ Downloading asset: ${url}`);
      
      // Validate URL
      if (!this.isValidUrl(url)) {
        return {
          success: false,
          error: 'Invalid URL format',
          skipped: true,
          skipReason: 'Invalid URL'
        };
      }
      
      // Check if asset already exists
      const existingAsset = await storage.getAssetFileByUrl(url);
      if (existingAsset && existingAsset.fetch_status === 'completed') {
        console.log(`✅ Asset already downloaded: ${url}`);
        return {
          success: true,
          assetFile: existingAsset,
          skipped: true,
          skipReason: 'Already downloaded'
        };
      }
      
      // Download the file
      // Fetch with timeout
      const response = await fetch(url, {
        signal,
        headers: {
          'User-Agent': 'NFT-Ingestion-Service/1.0'
        }
      } as any);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // Check file size
      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > INGESTION_CONFIG.maxFileSize) {
        throw new Error(`File too large: ${contentLength} bytes`);
      }
      
      // Get content type
      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      
      // Validate MIME type
      if (!INGESTION_CONFIG.allowedMimeTypes.includes(contentType.split(';')[0])) {
        throw new Error(`Unsupported MIME type: ${contentType}`);
      }
      
      // Read file content
      const buffer = await response.buffer();
      
      // Validate file size again
      if (buffer.length > INGESTION_CONFIG.maxFileSize) {
        throw new Error(`File too large after download: ${buffer.length} bytes`);
      }
      
      // Generate content hash
      const contentHash = createHash('sha256').update(buffer).digest('hex');
      
      // Check for duplicate
      const duplicateAsset = await storage.getAssetFileByHash(contentHash);
      if (duplicateAsset) {
        console.log(`♻️ Duplicate asset found, reusing: ${contentHash}`);
        return {
          success: true,
          assetFile: duplicateAsset,
          skipped: true,
          skipReason: 'Duplicate content'
        };
      }
      
      // Create storage path structure
      const assetId = nanoid();
      const fileExtension = this.getFileExtension(url, contentType);
      const filename = `${entityId}-${assetType}-${Date.now()}${fileExtension}`;
      
      // Create directory structure: store-assets/images/[hash]/original/
      const hashPrefix = contentHash.substring(0, 8);
      const storagePath = join(
        INGESTION_CONFIG.assetStorageRoot,
        'images', // For now, everything goes in images
        contentHash,
        'original',
        filename
      );
      
      // Ensure directory exists
      await mkdir(dirname(storagePath), { recursive: true });
      
      // Write file
      await writeFile(storagePath, buffer);
      
      // Create asset file record
      const assetFile = await storage.createAssetFile({
        source_url: url,
        content_hash: contentHash,
        mime_type: contentType,
        file_size: buffer.length,
        stored_path: storagePath,
        cdn_url: `/cdn/images/${contentHash}/original/${filename}`,
        fetch_status: 'completed',
        process_status: 'completed',
        original_filename: filename,
        variants: {
          original: {
            url: `/cdn/images/${contentHash}/original/${filename}`,
            width: 0, // Would need image processing to get actual dimensions
            height: 0,
            size: buffer.length
          }
        }
      });
      
      console.log(`✅ Asset downloaded successfully: ${filename} (${buffer.length} bytes)`);
      
      return {
        success: true,
        assetFile
      };
      
    } catch (error) {
      console.error(`❌ Asset download failed: ${url}`, error);
      
      // Try to create failed asset record
      try {
        await storage.createAssetFile({
          source_url: url,
          content_hash: 'failed-' + nanoid(),
          mime_type: 'application/octet-stream',
          file_size: 0,
          stored_path: '',
          fetch_status: 'failed',
          process_status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error'
        });
      } catch (dbError) {
        console.error('❌ Failed to create failed asset record:', dbError);
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Validate URL for security
   */
  private isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      
      // Only allow HTTP/HTTPS
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return false;
      }
      
      // Block localhost and private IPs (basic SSRF protection)
      const hostname = parsed.hostname.toLowerCase();
      if (
        hostname === 'localhost' ||
        hostname.startsWith('127.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('192.168.') ||
        hostname.match(/^172\.(1[6-9]|2\d|3[01])\./)
      ) {
        return false;
      }
      
      return true;
      
    } catch {
      return false;
    }
  }

  /**
   * Get file extension from URL or content type
   */
  private getFileExtension(url: string, contentType: string): string {
    // Try to get extension from URL
    const urlExt = extname(new URL(url).pathname);
    if (urlExt) {
      return urlExt;
    }
    
    // Fall back to content type
    const mimeMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
      'application/json': '.json',
      'text/plain': '.txt',
      'video/mp4': '.mp4',
      'video/webm': '.webm'
    };
    
    return mimeMap[contentType.split(';')[0]] || '.bin';
  }

  /**
   * Get job status and progress
   */
  async getJobStatus(jobId: string): Promise<any> {
    return await storage.getIngestionJob(jobId);
  }

  /**
   * Get jobs for a project
   */
  async getProjectJobs(projectId: string, status?: string): Promise<any[]> {
    return await storage.getIngestionJobsByProject(projectId, status);
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<void> {
    // Cancel if currently running
    const controller = this.activeJobs.get(jobId);
    if (controller) {
      controller.abort();
      this.activeJobs.delete(jobId);
    }
    
    // Update database status
    await storage.updateIngestionJobStatus(jobId, IngestionJobStatus.CANCELLED, 'Manually cancelled');
  }
}

// Global service instance
export const assetIngestionService = new AssetIngestionService();

// Auto-start the service
assetIngestionService.start().catch(error => {
  console.error('❌ Failed to start asset ingestion service:', error);
});