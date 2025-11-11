import { put, list, del, head } from '@vercel/blob';
import { randomUUID } from 'crypto';

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

/**
 * Unified Storage Service using Vercel Blob
 * 
 * Provides a consistent interface for file storage operations:
 * - uploadFile(): Upload files with automatic organization by type
 * - deleteFile(): Remove files by URL
 * - listFiles(): List files with optional prefix filtering
 * - fileExists(): Check if a file exists
 */
export class VercelBlobStorage {
  
  /**
   * Upload a file to Vercel Blob storage
   * 
   * @param buffer - File buffer data
   * @param fileType - Type of file (e.g., 'profile', 'post', 'generated', 'battle')
   * @param mimeType - MIME type of the file
   * @param isPublic - Whether the file should be publicly accessible (default: true)
   * @returns Public URL of the uploaded file
   */
  async uploadFile(
    buffer: Buffer,
    fileType: string = 'general',
    mimeType: string = 'image/png',
    isPublic: boolean = true
  ): Promise<string> {
    try {
      // Validate file size
      if (buffer.length > MAX_FILE_SIZE) {
        throw new Error(`File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`);
      }

      // Validate MIME type
      if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
        throw new Error(`Invalid MIME type: ${mimeType}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`);
      }

      // Generate unique filename with proper extension
      const extension = this.getFileExtension(mimeType);
      const filename = `${fileType}/${randomUUID()}${extension}`;

      console.log(`📤 [Blob] Uploading file: ${filename} (${buffer.length} bytes, ${mimeType})`);

      // Upload to Vercel Blob
      const blob = await put(filename, buffer, {
        access: isPublic ? 'public' : 'public', // Vercel Blob uses 'public' for accessible files
        contentType: mimeType,
      });

      console.log(`✅ [Blob] Upload successful: ${blob.url}`);
      return blob.url;

    } catch (error) {
      console.error('❌ [Blob] Upload failed:', error);
      throw new Error(`Blob upload failed: ${(error as Error).message}`);
    }
  }

  /**
   * Delete a file from Vercel Blob storage
   * 
   * @param fileUrl - Full URL or pathname of the file to delete
   * @returns True if deletion was successful
   */
  async deleteFile(fileUrl: string): Promise<boolean> {
    try {
      console.log(`🗑️ [Blob] Deleting file: ${fileUrl}`);
      
      // Extract the blob URL from the full URL if needed
      const url = this.extractBlobUrl(fileUrl);
      
      await del(url);
      
      console.log(`✅ [Blob] File deleted successfully`);
      return true;
      
    } catch (error) {
      console.error('❌ [Blob] Delete failed:', error);
      return false;
    }
  }

  /**
   * List files in Vercel Blob storage
   * 
   * @param prefix - Optional prefix to filter files (e.g., 'profile/', 'battle/')
   * @param limit - Maximum number of files to return
   * @returns Array of file metadata
   */
  async listFiles(prefix?: string, limit: number = 100): Promise<Array<{
    url: string;
    pathname: string;
    size: number;
    uploadedAt: Date;
  }>> {
    try {
      console.log(`📋 [Blob] Listing files${prefix ? ` with prefix: ${prefix}` : ''}`);
      
      const { blobs } = await list({
        prefix: prefix,
        limit: limit,
      });

      return blobs.map(blob => ({
        url: blob.url,
        pathname: blob.pathname,
        size: blob.size,
        uploadedAt: blob.uploadedAt,
      }));
      
    } catch (error) {
      console.error('❌ [Blob] List failed:', error);
      return [];
    }
  }

  /**
   * Check if a file exists in Vercel Blob storage
   * 
   * @param fileUrl - Full URL or pathname of the file
   * @returns True if file exists
   */
  async fileExists(fileUrl: string): Promise<boolean> {
    try {
      const url = this.extractBlobUrl(fileUrl);
      const metadata = await head(url);
      return !!metadata;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get file metadata from Vercel Blob storage
   * 
   * @param fileUrl - Full URL or pathname of the file
   * @returns File metadata or null if not found
   */
  async getFileMetadata(fileUrl: string): Promise<{
    url: string;
    size: number;
    uploadedAt: Date;
    pathname: string;
    contentType?: string;
  } | null> {
    try {
      const url = this.extractBlobUrl(fileUrl);
      const metadata = await head(url);
      return metadata || null;
    } catch (error) {
      console.error('❌ [Blob] Get metadata failed:', error);
      return null;
    }
  }

  /**
   * Download a file from Vercel Blob storage
   * Note: Vercel Blob files are public URLs, so this fetches the file content
   * 
   * @param fileUrl - Full URL or pathname of the file
   * @returns File buffer or null if not found
   */
  async downloadFile(fileUrl: string): Promise<Buffer | null> {
    try {
      const url = this.extractBlobUrl(fileUrl);
      const response = await fetch(url);
      if (!response.ok) {
        return null;
      }
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      console.error('❌ [Blob] Download failed:', error);
      return null;
    }
  }

  /**
   * Generate signed URL for temporary access (Vercel Blob files are already public)
   * This is a compatibility method - returns the public URL as-is
   * 
   * @param fileUrl - Full URL or pathname of the file
   * @param expiresInMinutes - Not used for Vercel Blob (files are public)
   * @returns Public URL
   */
  async generateSignedUrl(fileUrl: string, expiresInMinutes: number = 60): Promise<string> {
    // Vercel Blob files are public by default, so just return the URL
    return this.extractBlobUrl(fileUrl);
  }

  /**
   * Copy a file within Vercel Blob storage
   * 
   * @param sourceUrl - Source file URL
   * @param destinationPath - Destination path
   * @returns True if copy was successful
   */
  async copyFile(sourceUrl: string, destinationPath: string): Promise<boolean> {
    try {
      // Download the source file
      const buffer = await this.downloadFile(sourceUrl);
      if (!buffer) return false;

      // Get metadata to determine content type
      const metadata = await this.getFileMetadata(sourceUrl);
      const contentType = metadata?.contentType || 'image/png';

      // Upload to new location
      await put(destinationPath, buffer, {
        access: 'public',
        contentType: contentType,
      });

      return true;
    } catch (error) {
      console.error('❌ [Blob] Copy failed:', error);
      return false;
    }
  }

  /**
   * Move a file within Vercel Blob storage
   * 
   * @param sourceUrl - Source file URL
   * @param destinationPath - Destination path
   * @returns True if move was successful
   */
  async moveFile(sourceUrl: string, destinationPath: string): Promise<boolean> {
    try {
      const copied = await this.copyFile(sourceUrl, destinationPath);
      if (copied) {
        await this.deleteFile(sourceUrl);
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ [Blob] Move failed:', error);
      return false;
    }
  }

  /**
   * Extract Blob URL from a full URL or pathname
   * Handles both full Vercel Blob URLs and relative paths
   */
  private extractBlobUrl(fileUrl: string): string {
    // If it's already a full Vercel Blob URL, return as-is
    if (fileUrl.includes('vercel-storage.com') || fileUrl.includes('blob.vercel-storage.com')) {
      return fileUrl;
    }
    
    // If it's a pathname, return as-is (Vercel SDK handles it)
    return fileUrl;
  }

  /**
   * Get file extension from MIME type
   */
  private getFileExtension(mimeType: string): string {
    const extensions: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
    };
    
    return extensions[mimeType] || '.png';
  }

  /**
   * Validate buffer is a valid image
   */
  private isValidImage(buffer: Buffer, mimeType: string): boolean {
    // Check magic bytes for common image formats
    const magic = buffer.slice(0, 4).toString('hex');
    
    if (mimeType.includes('png') && magic.startsWith('89504e47')) return true;
    if (mimeType.includes('jpeg') && magic.startsWith('ffd8ff')) return true;
    if (mimeType.includes('gif') && magic.startsWith('47494638')) return true;
    if (mimeType.includes('webp') && buffer.slice(8, 12).toString() === 'WEBP') return true;
    
    return false;
  }
}

// Export singleton instance
export const blobStorage = new VercelBlobStorage();

// Export default
export default blobStorage;
