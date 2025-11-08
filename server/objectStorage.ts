import { Client } from '@replit/object-storage';
import { Response } from "express";
import { randomUUID } from "crypto";

// Initialize the official Replit Object Storage client - lazy initialization
let client: Client | null = null;

function getClient(): Client {
  if (!client) {
    try {
      client = new Client();
    } catch (error) {
      console.warn('⚠️ Replit Object Storage not available:', error);
      throw new Error('Object storage service unavailable');
    }
  }
  return client;
}

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

// The object storage service using the official Replit client
export class ObjectStorageService {
  constructor() {}

  // Upload bytes (for images) and return the object path
  async uploadBytes(buffer: Buffer, contentType: string): Promise<string> {
    const objectId = randomUUID();
    const objectPath = `uploads/${objectId}`;
    
    console.log(`📤 Uploading object: ${objectPath}`);
    
    const { ok, error } = await getClient().uploadFromBytes(objectPath, buffer);
    
    if (!ok) {
      console.error('❌ Upload failed:', error);
      throw new Error(`Failed to upload to object storage: ${error}`);
    }
    
    console.log(`✅ Object uploaded successfully: ${objectPath}`);
    
    // Return the path in /objects/... format for the frontend
    return `/objects/${objectPath}`;
  }

  // Download and stream an object to the response
  async downloadObject(objectPath: string, res: Response, cacheTtlSec: number = 3600) {
    try {
      // Remove /objects/ prefix to get the actual storage path
      const storagePath = objectPath.replace(/^\/objects\//, '');
      
      console.log(`📦 Attempting to serve object: ${objectPath} (storage: ${storagePath})`);
      
      const result = await getClient().downloadAsStream(storagePath) as any;
      
      if (!result.ok || !result.value) {
        console.error(`❌ Failed to serve object: ${objectPath}`, result.error);
        throw new ObjectNotFoundError();
      }
      
      const stream = result.value;
      
      // Set appropriate headers
      res.set({
        "Content-Type": this.getContentType(storagePath),
        "Cache-Control": `public, max-age=${cacheTtlSec}`,
      });

      // Stream the file to the response
      stream.on("error", (err: any) => {
        console.error("Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error streaming file" });
        }
      });

      stream.pipe(res);
      
    } catch (error) {
      console.error("Error downloading file:", error);
      if (error instanceof ObjectNotFoundError) {
        throw error;
      }
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  // Check if an object exists
  async exists(objectPath: string): Promise<boolean> {
    try {
      const storagePath = objectPath.replace(/^\/objects\//, '');
      const { ok, value: bytes } = await getClient().downloadAsBytes(storagePath);
      return ok && bytes !== undefined;
    } catch (error) {
      return false;
    }
  }

  // Get content type from file extension
  private getContentType(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase();
    const contentTypes: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
    };
    return contentTypes[ext || ''] || 'application/octet-stream';
  }

  // Legacy method for compatibility - now just calls uploadBytes
  async getObjectEntityUploadURL(): Promise<never> {
    throw new Error('getObjectEntityUploadURL is deprecated - use uploadBytes directly');
  }

  // Normalize object entity path (for compatibility with old code)
  normalizeObjectEntityPath(rawPath: string): string {
    // If already in /objects/ format, return as-is
    if (rawPath.startsWith("/objects/")) {
      return rawPath;
    }
    
    // If it's a storage path, add /objects/ prefix
    if (!rawPath.startsWith("http")) {
      return `/objects/${rawPath}`;
    }
    
    // Otherwise return as-is
    return rawPath;
  }
}

// Export a singleton instance for convenience
export const objectStorage = new ObjectStorageService();

// Legacy export for backwards compatibility
export const objectStorageClient = client;
