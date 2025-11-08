/**
 * ⚠️ DEPRECATED - Local Storage Service
 * 
 * WARNING: This service should NOT be used in production!
 * Local filesystem storage is not persistent across Replit deployments.
 * 
 * Use ReplitObjectStorageService instead: ./replit-object-storage.ts
 */

import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

// Local storage directory (public for serving)
const UPLOADS_DIR = path.join(process.cwd(), 'client', 'public', 'uploads');

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

export class LocalStorageService {
  constructor() {}

  // Ensure upload directories exist
  async ensureDirectories() {
    const dirs = [
      path.join(UPLOADS_DIR, 'profiles'),
      path.join(UPLOADS_DIR, 'covers'),
      path.join(UPLOADS_DIR, 'posts'),
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

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

  // Upload a file and return the public path
  async uploadFile(buffer: Buffer, type: 'profile' | 'cover' | 'post', contentType: string): Promise<string> {
    await this.ensureDirectories();

    // Security validation
    this.validateFile(buffer, contentType);

    // Generate unique filename
    const fileExtension = this.getExtensionFromContentType(contentType);
    const filename = `${randomUUID()}${fileExtension}`;
    
    // Determine subdirectory based on type
    const subdir = type === 'profile' ? 'profiles' : type === 'cover' ? 'covers' : 'posts';
    const filePath = path.join(UPLOADS_DIR, subdir, filename);
    
    // Write file to disk
    await fs.writeFile(filePath, buffer);
    
    console.log(`✅ File saved locally: /uploads/${subdir}/${filename}`);
    
    // Return public URL path
    return `/uploads/${subdir}/${filename}`;
  }

  // Delete a file
  async deleteFile(publicPath: string): Promise<void> {
    try {
      // Convert public path to filesystem path
      // e.g., /uploads/profiles/abc.jpg -> client/public/uploads/profiles/abc.jpg
      const relativePath = publicPath.replace(/^\/uploads\//, '');
      const filePath = path.join(UPLOADS_DIR, relativePath);
      
      await fs.unlink(filePath);
      console.log(`🗑️ File deleted: ${publicPath}`);
    } catch (error) {
      console.error(`Failed to delete file ${publicPath}:`, error);
      // Don't throw - file might not exist
    }
  }

  // Check if file exists
  async fileExists(publicPath: string): Promise<boolean> {
    try {
      const relativePath = publicPath.replace(/^\/uploads\//, '');
      const filePath = path.join(UPLOADS_DIR, relativePath);
      await fs.access(filePath);
      return true;
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
}

// Export singleton instance
export const localStorage = new LocalStorageService();
