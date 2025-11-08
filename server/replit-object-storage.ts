import { Client } from '@replit/object-storage';
import { randomUUID } from 'crypto';
import { extractStorageKey } from './image-path-utils';

// Replit Object Storage client - lazy initialization
let objectStorage: Client | null = null;

function getObjectStorage(): Client {
  if (!objectStorage) {
    try {
      objectStorage = new Client();
    } catch (error) {
      console.warn('⚠️ Replit Object Storage not available:', error);
      throw new Error('Object storage service unavailable');
    }
  }
  return objectStorage;
}

// Maximum file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Allowed MIME types (NO SVG to prevent script injection)
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
];

export class ReplitObjectStorageService {
  constructor() {}

  // Validate file security
  private validateFile(buffer: Buffer, contentType: string): void {
    // Check file size
    if (buffer.length > MAX_FILE_SIZE) {
      throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    // Check MIME type (strict whitelist, NO SVG)
    if (!ALLOWED_MIME_TYPES.includes(contentType.toLowerCase())) {
      throw new Error(`Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`);
    }

    // Additional security: Check file signature (magic bytes)
    const magicBytes = buffer.slice(0, 12).toString('hex');
    const isValidImage =
      magicBytes.startsWith('ffd8ff') || // JPEG
      magicBytes.startsWith('89504e47') || // PNG
      magicBytes.startsWith('47494638') || // GIF
      magicBytes.startsWith('52494646'); // WEBP (starts with RIFF)

    if (!isValidImage) {
      throw new Error('File signature mismatch - possible malicious file');
    }
  }

  // Upload a file and return the storage key
  async uploadFile(buffer: Buffer, type: 'profile' | 'cover' | 'post' | 'generated', contentType: string, makePublic: boolean = true): Promise<string> {
    // Security validation
    this.validateFile(buffer, contentType);

    // Generate unique filename
    const fileExtension = this.getExtensionFromContentType(contentType);
    const filename = `${randomUUID()}${fileExtension}`;
    
    // Determine subdirectory based on type
    const subdirMap = {
      profile: 'profiles',
      cover: 'covers',
      post: 'posts',
      generated: 'generated-images'
    };
    const subdir = subdirMap[type];
    const storageKey = `uploads/${subdir}/${filename}`;
    
    // Upload to Replit Object Storage using correct API
    const { ok, error } = await getObjectStorage().uploadFromBytes(storageKey, buffer);
    
    if (!ok) {
      throw new Error(`Failed to upload file: ${error}`);
    }
    
    console.log(`✅ File saved to Replit Object Storage: ${storageKey}`);
    
    // Return storage key (we'll serve these files through a route)
    return `/api/storage/${storageKey}`;
  }

  // Download a file from storage with intelligent path normalization
  async downloadFile(storageKey: string): Promise<Buffer | null> {
    try {
      // Use utility function to properly extract storage key
      const key = extractStorageKey(storageKey);
      
      console.log(`📥 [STORAGE] Downloading: ${key}`);
      
      const { ok, value, error } = await getObjectStorage().downloadAsBytes(key);
      
      if (!ok || !value) {
        if (error) {
          console.error(`❌ [STORAGE] Failed to download file ${key}:`, error);
        } else {
          console.warn(`⚠️ [STORAGE] File not found: ${key}`);
        }
        return null;
      }
      
      // Replit Object Storage returns Buffer (handle both Buffer and array of Buffers)
      if (Buffer.isBuffer(value)) {
        console.log(`✅ [STORAGE] Successfully downloaded: ${key} (${value.length} bytes)`);
        return value;
      } else if (Array.isArray(value) && value.length > 0 && Buffer.isBuffer(value[0])) {
        console.log(`✅ [STORAGE] Successfully downloaded: ${key} (${value[0].length} bytes)`);
        return value[0];
      }
      
      console.error(`❌ [STORAGE] Invalid buffer format for: ${key}`);
      return null;
    } catch (error) {
      console.error(`❌ [STORAGE] Exception while downloading ${storageKey}:`, error);
      return null;
    }
  }

  // Delete a file from storage
  async deleteFile(storageKey: string): Promise<boolean> {
    try {
      // Normalize the key to handle both legacy and new paths
      let key = storageKey;
      
      // Remove /api/storage/ prefix if present (new format)
      if (key.startsWith('/api/storage/')) {
        key = key.replace(/^\/api\/storage\//, '');
      }
      // Convert legacy /uploads/ paths to object storage keys
      else if (key.startsWith('/uploads/')) {
        key = key.replace(/^\//, ''); // Remove leading slash for object storage
      }
      
      // Delete from Replit Object Storage
      const { ok, error } = await getObjectStorage().delete(key);
      
      if (ok) {
        console.log(`🗑️ File deleted from storage: ${key}`);
        return true;
      } else if (error) {
        console.warn(`⚠️ Could not delete file ${key}:`, error);
        return false;
      }
      return false;
    } catch (error) {
      console.error(`Failed to delete file ${storageKey}:`, error);
      return false;
    }
  }

  // List files with given prefix
  async listFiles(prefix: string): Promise<string[]> {
    try {
      const { ok, value } = await getObjectStorage().list({ prefix });
      if (ok && Array.isArray(value)) {
        const keys = value.map((obj: any) => obj.key || String(obj));
        console.log(`📋 [REPLIT] Listed ${keys.length} files with prefix: ${prefix}`);
        return keys;
      }
      return [];
    } catch (error) {
      console.error(`❌ [REPLIT] List failed for prefix ${prefix}:`, error);
      return [];
    }
  }

  // Get file metadata (limited in Replit Object Storage)
  async getFileMetadata(storageKey: string): Promise<any> {
    const key = extractStorageKey(storageKey);
    const exists = await this.fileExists(key);
    if (!exists) return null;
    
    return {
      name: key,
      exists: true,
      // Replit Object Storage doesn't provide detailed metadata
    };
  }

  // Copy file
  async copyFile(sourceKey: string, destinationKey: string): Promise<boolean> {
    try {
      const buffer = await this.downloadFile(sourceKey);
      if (!buffer) return false;
      
      const destKey = extractStorageKey(destinationKey);
      const { ok } = await getObjectStorage().uploadFromBytes(destKey, buffer);
      
      if (ok) {
        console.log(`✅ [REPLIT] Copied: ${sourceKey} -> ${destinationKey}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`❌ [REPLIT] Copy failed:`, error);
      return false;
    }
  }

  // Move file (copy + delete)
  async moveFile(sourceKey: string, destinationKey: string): Promise<boolean> {
    const copied = await this.copyFile(sourceKey, destinationKey);
    if (copied) {
      await this.deleteFile(sourceKey);
      console.log(`✅ [REPLIT] Moved: ${sourceKey} -> ${destinationKey}`);
      return true;
    }
    return false;
  }

  // Check if file exists
  async fileExists(storageKey: string): Promise<boolean> {
    try {
      // Remove /api/storage/ prefix if present
      const key = storageKey.replace(/^\/api\/storage\//, '');
      
      const { ok, value } = await getObjectStorage().exists(key);
      return ok && value === true;
    } catch {
      return false;
    }
  }

  // Get file extension from content type
  private getExtensionFromContentType(contentType: string): string {
    const extensions: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
    };
    return extensions[contentType.toLowerCase()] || '.jpg';
  }

  // Get content type from file extension
  getContentTypeFromExtension(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop();
    const contentTypes: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
    };
    return contentTypes[ext || ''] || 'application/octet-stream';
  }
}

// Export singleton instance
export const replitObjectStorage = new ReplitObjectStorageService();
