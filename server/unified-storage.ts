/**
 * Unified Storage Service
 * 
 * Provides a single interface for file storage using Vercel Blob.
 * Automatically configured for Vercel deployment with BLOB_READ_WRITE_TOKEN.
 */

import { VercelBlobStorage } from './blob-storage';

// Vercel Blob is now the default and only storage backend
const STORAGE_BACKEND = 'vercel-blob';

console.log(`🗄️ [STORAGE] Using backend: ${STORAGE_BACKEND}`);

interface StorageService {
  uploadFile(buffer: Buffer, type: 'profile' | 'cover' | 'post' | 'generated', contentType: string, makePublic?: boolean): Promise<string>;
  downloadFile(storageKey: string): Promise<Buffer | null>;
  deleteFile(storageKey: string): Promise<boolean>;
  listFiles?(prefix: string): Promise<string[]>;
  fileExists?(storageKey: string): Promise<boolean>;
  getFileMetadata?(storageKey: string): Promise<any>;
  generateSignedUrl?(storageKey: string, expiresInMinutes?: number): Promise<string>;
  copyFile?(sourceKey: string, destinationKey: string): Promise<boolean>;
  moveFile?(sourceKey: string, destinationKey: string): Promise<boolean>;
}

class UnifiedStorageService implements StorageService {
  private backend: VercelBlobStorage;
  private backendName: string;

  constructor() {
    this.backend = new VercelBlobStorage();
    this.backendName = 'Vercel Blob Storage';
    console.log(`✅ [STORAGE] Initialized: ${this.backendName}`);
  }

  async uploadFile(
    buffer: Buffer,
    type: 'profile' | 'cover' | 'post' | 'generated',
    contentType: string,
    makePublic: boolean = true
  ): Promise<string> {
    return await this.backend.uploadFile(buffer, type, contentType, makePublic);
  }

  async downloadFile(storageKey: string): Promise<Buffer | null> {
    return await this.backend.downloadFile(storageKey);
  }

  async deleteFile(storageKey: string): Promise<boolean> {
    return await this.backend.deleteFile(storageKey);
  }

  async listFiles(prefix: string): Promise<string[]> {
    const files = await this.backend.listFiles(prefix);
    // Convert array of file objects to array of URLs for compatibility
    return files.map((file: any) => file.url || file);
  }

  async fileExists(storageKey: string): Promise<boolean> {
    if (this.backend.fileExists) {
      return await this.backend.fileExists(storageKey);
    }
    // Fallback: try to download and check if not null
    const file = await this.downloadFile(storageKey);
    return file !== null;
  }

  async getFileMetadata(storageKey: string): Promise<any> {
    if (this.backend.getFileMetadata) {
      return await this.backend.getFileMetadata(storageKey);
    }
    return null;
  }

  async generateSignedUrl(storageKey: string, expiresInMinutes: number = 60): Promise<string> {
    if (this.backend.generateSignedUrl) {
      return await this.backend.generateSignedUrl(storageKey, expiresInMinutes);
    }
    // Fallback to regular path if signed URLs not supported
    return `/api/storage/${storageKey}`;
  }

  async copyFile(sourceKey: string, destinationKey: string): Promise<boolean> {
    if (this.backend.copyFile) {
      return await this.backend.copyFile(sourceKey, destinationKey);
    }
    // Fallback: download and re-upload
    const buffer = await this.downloadFile(sourceKey);
    if (!buffer) return false;
    
    // Extract content type from source (or default to image/jpeg)
    const contentType = 'image/jpeg'; // You might want to improve this
    await this.uploadFile(buffer, 'generated', contentType);
    return true;
  }

  async moveFile(sourceKey: string, destinationKey: string): Promise<boolean> {
    if (this.backend.moveFile) {
      return await this.backend.moveFile(sourceKey, destinationKey);
    }
    // Fallback: copy then delete
    const copied = await this.copyFile(sourceKey, destinationKey);
    if (copied) {
      await this.deleteFile(sourceKey);
      return true;
    }
    return false;
  }

  getBackendName(): string {
    return this.backendName;
  }
}

// Export singleton instance
export const unifiedStorage = new UnifiedStorageService();

// Export for type checking
export type { StorageService };
