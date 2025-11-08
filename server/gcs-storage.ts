import { Storage, Bucket } from '@google-cloud/storage';
import { randomUUID } from 'crypto';
import { extractStorageKey } from './image-path-utils';

// Google Cloud Storage configuration
const GCS_PROJECT_ID = process.env.GCS_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'riddleswap';
const GCS_KEY_FILE = process.env.GCS_KEY_FILE || process.env.GOOGLE_APPLICATION_CREDENTIALS;
const GCS_KEY_JSON = process.env.GCS_KEY_JSON || process.env.GCS_SERVICE_ACCOUNT_JSON || process.env.GCP_SERVICE_ACCOUNT_JSON;

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

// Lazy initialization of GCS client
let storage: Storage | null = null;
let bucket: Bucket | null = null;

function getStorage(): { storage: Storage; bucket: Bucket } {
  if (!storage || !bucket) {
    try {
      // Initialize Storage with credentials
      const storageConfig: any = {};

      // Prefer inline JSON credentials if provided
      if (GCS_KEY_JSON) {
        try {
          let jsonStr = GCS_KEY_JSON;
          if (!jsonStr.trim().startsWith('{')) {
            // Likely base64-encoded
            jsonStr = Buffer.from(jsonStr, 'base64').toString('utf8');
          }
          const creds = JSON.parse(jsonStr);
          if (creds.client_email && creds.private_key) {
            storageConfig.credentials = {
              client_email: creds.client_email,
              private_key: creds.private_key,
            };
            if (!storageConfig.projectId && creds.project_id) {
              storageConfig.projectId = creds.project_id;
            }
            console.log('✅ [GCS] Using inline JSON credentials');
          }
        } catch (e) {
          console.warn('⚠️ [GCS] Failed to parse GCS_KEY_JSON credentials:', (e as Error).message);
        }
      }

      // Fallback to key file path
      if (!storageConfig.credentials && GCS_KEY_FILE) {
        console.log(`📁 [GCS] Using key file: ${GCS_KEY_FILE}`);
        storageConfig.keyFilename = GCS_KEY_FILE;
      }

      // If no explicit credentials, try Application Default Credentials (gcloud auth)
      if (!storageConfig.credentials && !storageConfig.keyFilename) {
        console.log('🔑 [GCS] Attempting to use Application Default Credentials (gcloud auth)');
        console.log('💡 [GCS] Run "gcloud auth application-default login" if credentials are missing');
      }

      if (GCS_PROJECT_ID) {
        storageConfig.projectId = GCS_PROJECT_ID;
      }

      storage = new Storage(storageConfig);
      bucket = storage.bucket(GCS_BUCKET_NAME);
      
      console.log(`✅ [GCS] Connected to bucket: ${GCS_BUCKET_NAME}`);
      
      // Test connection by checking if bucket exists
      bucket.exists().then(([exists]) => {
        if (exists) {
          console.log(`✅ [GCS] Bucket "${GCS_BUCKET_NAME}" verified and accessible`);
        } else {
          console.warn(`⚠️ [GCS] Bucket "${GCS_BUCKET_NAME}" does not exist or is not accessible`);
        }
      }).catch((err) => {
        console.error(`❌ [GCS] Bucket verification failed:`, err.message);
        console.log(`💡 [GCS] Make sure:
  1. Bucket "${GCS_BUCKET_NAME}" exists in your GCP project
  2. Service account has Storage Object Admin role
  3. Credentials are properly configured`);
      });
      
    } catch (error) {
      console.error('❌ [GCS] Failed to initialize:', error);
      console.log(`
⚠️ [GCS] Google Cloud Storage initialization failed!

To fix this, you need to:

1. Create a service account in Google Cloud Console
2. Grant "Storage Object Admin" role to the service account
3. Download the JSON key file

Then, set ONE of these in your .env file:

Option A - Key file path (Windows):
GCS_KEY_FILE="C:\\path\\to\\your-service-account.json"

Option B - Inline JSON (recommended for deployment):
GCS_KEY_JSON='{"type":"service_account","project_id":"your-project-id",...}'

Option C - Use gcloud CLI:
Run: gcloud auth application-default login

For now, the app will continue with limited storage functionality.
`);
      throw new Error('Google Cloud Storage service unavailable');
    }
  }
  return { storage, bucket };
}

export class GoogleCloudStorageService {
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

  // Get file extension from content type
  private getExtensionFromContentType(contentType: string): string {
    const typeMap: { [key: string]: string } = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
    };
    return typeMap[contentType.toLowerCase()] || '';
  }

  // Upload a file and return the public URL or storage path
  async uploadFile(
    buffer: Buffer,
    type: 'profile' | 'cover' | 'post' | 'generated',
    contentType: string,
    makePublic: boolean = true
  ): Promise<string> {
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
    
    try {
      const { bucket } = getStorage();
      const file = bucket.file(storageKey);
      
      // Upload file
      await file.save(buffer, {
        contentType,
        metadata: {
          cacheControl: 'public, max-age=31536000', // Cache for 1 year
          contentType,
        },
        resumable: false, // For small files, resumable is not needed
      });
      
      // Make file public if requested
      if (makePublic) {
        await file.makePublic();
        const publicUrl = `https://storage.googleapis.com/${GCS_BUCKET_NAME}/${storageKey}`;
        console.log(`✅ [GCS] File uploaded (public): ${publicUrl}`);
        return publicUrl;
      } else {
        console.log(`✅ [GCS] File uploaded (private): ${storageKey}`);
        return `/api/storage/${storageKey}`;
      }
    } catch (error) {
      console.error('❌ [GCS] Upload failed:', error);
      throw new Error(`Failed to upload file to GCS: ${error}`);
    }
  }

  // Download a file from storage with intelligent path normalization
  async downloadFile(storageKey: string): Promise<Buffer | null> {
    try {
      // Use utility function to properly extract storage key
      const key = extractStorageKey(storageKey);
      
      console.log(`📥 [GCS] Downloading: ${key}`);
      
      const { bucket } = getStorage();
      const file = bucket.file(key);
      
      // Check if file exists
      const [exists] = await file.exists();
      if (!exists) {
        console.log(`❌ [GCS] File not found: ${key}`);
        return null;
      }
      
      // Download file
      const [buffer] = await file.download();
      console.log(`✅ [GCS] Downloaded: ${key} (${buffer.length} bytes)`);
      
      return buffer;
    } catch (error) {
      console.error(`❌ [GCS] Download failed for ${storageKey}:`, error);
      return null;
    }
  }

  // Delete a file from storage
  async deleteFile(storageKey: string): Promise<boolean> {
    try {
      const key = extractStorageKey(storageKey);
      
      console.log(`🗑️ [GCS] Deleting: ${key}`);
      
      const { bucket } = getStorage();
      const file = bucket.file(key);
      
      await file.delete();
      console.log(`✅ [GCS] Deleted: ${key}`);
      
      return true;
    } catch (error) {
      console.error(`❌ [GCS] Delete failed for ${storageKey}:`, error);
      return false;
    }
  }

  // List files in a directory
  async listFiles(prefix: string): Promise<string[]> {
    try {
      const { bucket } = getStorage();
      const [files] = await bucket.getFiles({ prefix });
      
      const fileNames = files.map(file => file.name);
      console.log(`📋 [GCS] Listed ${fileNames.length} files with prefix: ${prefix}`);
      
      return fileNames;
    } catch (error) {
      console.error(`❌ [GCS] List failed for prefix ${prefix}:`, error);
      return [];
    }
  }

  // Get file metadata
  async getFileMetadata(storageKey: string): Promise<any> {
    try {
      const key = extractStorageKey(storageKey);
      const { bucket } = getStorage();
      const file = bucket.file(key);
      
      const [metadata] = await file.getMetadata();
      return metadata;
    } catch (error) {
      console.error(`❌ [GCS] Get metadata failed for ${storageKey}:`, error);
      return null;
    }
  }

  // Generate a signed URL for temporary access (for private files)
  async generateSignedUrl(storageKey: string, expiresInMinutes: number = 60): Promise<string> {
    try {
      const key = extractStorageKey(storageKey);
      const { bucket } = getStorage();
      const file = bucket.file(key);
      
      const [signedUrl] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + expiresInMinutes * 60 * 1000,
      });
      
      console.log(`🔗 [GCS] Generated signed URL for: ${key} (expires in ${expiresInMinutes}min)`);
      return signedUrl;
    } catch (error) {
      console.error(`❌ [GCS] Signed URL generation failed for ${storageKey}:`, error);
      throw error;
    }
  }

  // Copy file from one location to another
  async copyFile(sourceKey: string, destinationKey: string): Promise<boolean> {
    try {
      const { bucket } = getStorage();
      const sourceFile = bucket.file(extractStorageKey(sourceKey));
      const destFile = bucket.file(extractStorageKey(destinationKey));
      
      await sourceFile.copy(destFile);
      console.log(`✅ [GCS] Copied: ${sourceKey} -> ${destinationKey}`);
      
      return true;
    } catch (error) {
      console.error(`❌ [GCS] Copy failed:`, error);
      return false;
    }
  }

  // Move file (copy + delete original)
  async moveFile(sourceKey: string, destinationKey: string): Promise<boolean> {
    try {
      const copied = await this.copyFile(sourceKey, destinationKey);
      if (copied) {
        await this.deleteFile(sourceKey);
        console.log(`✅ [GCS] Moved: ${sourceKey} -> ${destinationKey}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`❌ [GCS] Move failed:`, error);
      return false;
    }
  }

  // Check if file exists
  async fileExists(storageKey: string): Promise<boolean> {
    try {
      const key = extractStorageKey(storageKey);
      const { bucket } = getStorage();
      const file = bucket.file(key);
      
      const [exists] = await file.exists();
      return exists;
    } catch (error) {
      console.error(`❌ [GCS] Exists check failed for ${storageKey}:`, error);
      return false;
    }
  }
}

// Export singleton instance
export const gcsStorage = new GoogleCloudStorageService();
