/**
 * Unified Storage Service
 * 
 * Provides a single interface for file storage that automatically
 * switches between Google Cloud Storage (production) and Replit Object Storage (development)
 * based on environment configuration.
 */

import { GoogleCloudStorageService } from './gcs-storage';
import { ReplitObjectStorageService } from './replit-object-storage';

// Determine which storage backend to use
const USE_GCS = process.env.USE_GCS === 'true' || process.env.NODE_ENV === 'production';
const STORAGE_BACKEND = process.env.STORAGE_BACKEND || (USE_GCS ? 'gcs' : 'replit');

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
  private backend: StorageService;
  private backendName: string;

  constructor() {
    if (STORAGE_BACKEND === 'gcs') {
      this.backend = new GoogleCloudStorageService();
      this.backendName = 'Google Cloud Storage';
    } else {
      this.backend = new ReplitObjectStorageService();
      this.backendName = 'Replit Object Storage';
    }
    
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
    if (this.backend.listFiles) {
      return await this.backend.listFiles(prefix);
    }
    throw new Error('listFiles not supported by current storage backend');
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
