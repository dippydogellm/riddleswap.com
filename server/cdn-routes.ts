/**
 * CDN Routes for Serving Static Assets
 * 
 * Serves files from store-assets/ directory with proper:
 * - Caching headers (Cache-Control: immutable, ETag, Last-Modified)
 * - Content hashing for CDN delivery
 * - Asset variants (original, 512px, 256px, thumbnails)
 * - MIME type detection and security headers
 * - Error handling with proper HTTP status codes
 * - Security validation to prevent directory traversal
 */

import { Router, Request, Response } from "express";
import { createReadStream, statSync, existsSync } from "fs";
import { join, resolve, basename, extname } from "path";
import { createHash } from "crypto";
import mime from "mime-types";
import { z } from "zod";

const router = Router();

// CDN configuration
const CDN_CONFIG = {
  baseDir: resolve("store-assets"),
  maxAge: 31536000, // 1 year in seconds for immutable content
  variants: ["original", "512px", "256px", "thumbnails"] as const,
  buckets: ["images", "metadata", "documents", "videos"] as const,
  allowedExtensions: [
    // Images
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".ico",
    // Documents
    ".pdf", ".txt", ".md", ".json", ".xml",
    // Videos
    ".mp4", ".webm", ".mov",
    // Other
    ".css", ".js", ".woff", ".woff2", ".ttf", ".eot"
  ]
};

// Validation schemas
const cdnPathSchema = z.object({
  bucket: z.enum(CDN_CONFIG.buckets),
  hash: z.string().regex(/^[a-f0-9]{64}$/, "Invalid hash format"),
  variant: z.enum(CDN_CONFIG.variants),
  filename: z.string().min(1).regex(/^[a-zA-Z0-9._-]+$/, "Invalid filename")
});

/**
 * Security middleware to validate CDN paths and prevent directory traversal
 */
const validateCdnPath = (req: Request, res: Response, next: any) => {
  try {
    const { bucket, hash, variant, filename } = req.params;
    
    // Validate path parameters
    const validatedParams = cdnPathSchema.parse({
      bucket,
      hash,
      variant,
      filename
    });
    
    // Additional security checks
    const fileExtension = extname(filename).toLowerCase();
    if (!CDN_CONFIG.allowedExtensions.includes(fileExtension)) {
      return res.status(403).json({
        error: "File type not allowed",
        allowed_extensions: CDN_CONFIG.allowedExtensions
      });
    }
    
    // Store validated params for use in handlers
    req.cdnParams = validatedParams;
    next();
    
  } catch (error) {
    console.error('❌ [CDN] Path validation failed:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid CDN path",
        details: error.errors,
        usage: "GET /cdn/{bucket}/{hash}/{variant}/{filename}"
      });
    }
    
    res.status(400).json({
      error: "Invalid CDN request",
      usage: "GET /cdn/{bucket}/{hash}/{variant}/{filename}"
    });
  }
};

/**
 * Generate ETag for a file based on its stats
 */
const generateETag = (stats: any, filePath: string): string => {
  const hash = createHash('md5')
    .update(`${stats.mtime.getTime()}-${stats.size}-${filePath}`)
    .digest('hex');
  return `"${hash}"`;
};

/**
 * Set proper caching headers for CDN content
 */
const setCachingHeaders = (res: Response, filePath: string, stats: any) => {
  const etag = generateETag(stats, filePath);
  
  res.set({
    'Cache-Control': `public, max-age=${CDN_CONFIG.maxAge}, immutable`,
    'ETag': etag,
    'Last-Modified': stats.mtime.toUTCString(),
    'Expires': new Date(Date.now() + CDN_CONFIG.maxAge * 1000).toUTCString(),
    // Removed duplicate security headers - handled by main security middleware
    // 'X-Content-Type-Options': 'nosniff',
    // 'X-Frame-Options': 'SAMEORIGIN',
    // 'Referrer-Policy': 'strict-origin-when-cross-origin'
  });
  
  return etag;
};

/**
 * Check if request can be served from cache (304 Not Modified)
 */
const checkCacheHeaders = (req: Request, etag: string, lastModified: Date): boolean => {
  const ifNoneMatch = req.get('If-None-Match');
  const ifModifiedSince = req.get('If-Modified-Since');
  
  // Check ETag
  if (ifNoneMatch && ifNoneMatch === etag) {
    return true;
  }
  
  // Check Last-Modified
  if (ifModifiedSince) {
    const ifModifiedSinceDate = new Date(ifModifiedSince);
    if (ifModifiedSinceDate >= lastModified) {
      return true;
    }
  }
  
  return false;
};

/**
 * GET /cdn/{bucket}/{hash}/{variant}/{filename}
 * Serve files from CDN with proper caching and security
 */
router.get("/:bucket/:hash/:variant/:filename", validateCdnPath, async (req: Request, res: Response) => {
  try {
    if (!req.cdnParams) {
      return res.status(400).json({ error: "Invalid CDN parameters" });
    }
    const { bucket, hash, variant, filename } = req.cdnParams;
    
    console.log(`📁 [CDN] Serving request: ${bucket}/${hash}/${variant}/${filename}`);
    
    // Construct secure file path
    const filePath = join(CDN_CONFIG.baseDir, bucket, hash, variant, filename);
    const resolvedPath = resolve(filePath);
    
    // Security check: ensure resolved path is within baseDir
    if (!resolvedPath.startsWith(CDN_CONFIG.baseDir)) {
      console.error('❌ [CDN] Directory traversal attempt blocked:', resolvedPath);
      return res.status(403).json({
        error: "Access denied",
        message: "Invalid file path"
      });
    }
    
    // Check if file exists
    if (!existsSync(resolvedPath)) {
      console.log(`⚠️ [CDN] File not found: ${resolvedPath}`);
      return res.status(404).json({
        error: "File not found",
        path: `${bucket}/${hash}/${variant}/${filename}`
      });
    }
    
    // Get file stats
    const stats = statSync(resolvedPath);
    if (!stats.isFile()) {
      console.error('❌ [CDN] Path is not a file:', resolvedPath);
      return res.status(404).json({
        error: "File not found",
        message: "Path does not point to a file"
      });
    }
    
    // Set caching headers
    const etag = setCachingHeaders(res, resolvedPath, stats);
    
    // Check if client has cached version
    if (checkCacheHeaders(req, etag, stats.mtime)) {
      console.log(`💾 [CDN] Serving 304 Not Modified for: ${filename}`);
      return res.status(304).end();
    }
    
    // Determine and set content type
    const mimeType = mime.lookup(filename) || 'application/octet-stream';
    res.type(mimeType);
    
    // Log successful serve
    console.log(`✅ [CDN] Serving file: ${filename} (${mimeType}, ${stats.size} bytes)`);
    
    // Stream the file
    const fileStream = createReadStream(resolvedPath);
    
    fileStream.on('error', (error) => {
      console.error('❌ [CDN] File stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          error: "File read error",
          message: "Failed to stream file"
        });
      }
    });
    
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('❌ [CDN] Unexpected error serving file:', error);
    
    if (!res.headersSent) {
      res.status(500).json({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Failed to serve file",
        endpoint: "cdn_file_serving"
      });
    }
  }
});

/**
 * GET /cdn/health
 * Health check endpoint for CDN service
 */
router.get("/health", (req: Request, res: Response) => {
  try {
    const healthCheck = {
      status: "healthy",
      service: "cdn_file_serving",
      timestamp: new Date().toISOString(),
      checks: {
        store_directory: existsSync(CDN_CONFIG.baseDir) ? "✅ Available" : "❌ Missing",
        supported_buckets: CDN_CONFIG.buckets,
        supported_variants: CDN_CONFIG.variants,
        allowed_extensions: CDN_CONFIG.allowedExtensions.length + " types supported"
      },
      config: {
        max_age_seconds: CDN_CONFIG.maxAge,
        base_directory: basename(CDN_CONFIG.baseDir)
      }
    };
    
    res.json(healthCheck);
    
  } catch (error) {
    console.error('❌ [CDN] Health check failed:', error);
    res.status(503).json({
      status: "unhealthy",
      service: "cdn_file_serving",
      timestamp: new Date().toISOString(),
      error: (error as Error).message || "Unknown error"
    });
  }
});

/**
 * GET /cdn/info/{bucket}/{hash}
 * Get information about available variants for a specific hash
 */
router.get("/info/:bucket/:hash", async (req: Request, res: Response) => {
  try {
    const { bucket, hash } = req.params;
    
    // Validate bucket and hash
    if (!CDN_CONFIG.buckets.includes(bucket as any)) {
      return res.status(400).json({
        error: "Invalid bucket",
        valid_buckets: CDN_CONFIG.buckets
      });
    }
    
    if (!/^[a-f0-9]{64}$/.test(hash)) {
      return res.status(400).json({
        error: "Invalid hash format",
        expected: "64-character hexadecimal string"
      });
    }
    
    console.log(`ℹ️ [CDN] Getting info for: ${bucket}/${hash}`);
    
    const hashDir = join(CDN_CONFIG.baseDir, bucket, hash);
    
    if (!existsSync(hashDir)) {
      return res.status(404).json({
        error: "Hash not found",
        bucket,
        hash
      });
    }
    
    // Scan for available variants
    const availableVariants: Record<string, any[]> = {};
    
    for (const variant of CDN_CONFIG.variants) {
      const variantDir = join(hashDir, variant);
      if (existsSync(variantDir)) {
        const { readdirSync } = await import('fs');
        const files = readdirSync(variantDir);
        
        availableVariants[variant] = files.map((filename: string) => {
          const filePath = join(variantDir, filename);
          const stats = statSync(filePath);
          const mimeType = mime.lookup(filename) || 'application/octet-stream';
          
          return {
            filename,
            size: stats.size,
            mime_type: mimeType,
            last_modified: stats.mtime.toISOString(),
            url: `/cdn/${bucket}/${hash}/${variant}/${filename}`
          };
        });
      }
    }
    
    const response = {
      bucket,
      hash,
      available_variants: availableVariants,
      total_variants: Object.keys(availableVariants).length,
      info: {
        endpoint: "cdn_asset_info",
        timestamp: new Date().toISOString()
      }
    };
    
    console.log(`✅ [CDN] Info retrieved for ${bucket}/${hash}: ${Object.keys(availableVariants).length} variants`);
    res.json(response);
    
  } catch (error) {
    console.error('❌ [CDN] Error getting asset info:', error);
    res.status(500).json({
      error: "Failed to get asset info",
      message: error instanceof Error ? error.message : "Unknown error",
      endpoint: "cdn_asset_info"
    });
  }
});

// Extend Express Request interface for TypeScript
declare global {
  namespace Express {
    interface Request {
      cdnParams?: {
        bucket: string;
        hash: string;
        variant: string;
        filename: string;
      };
    }
  }
}

export default router;