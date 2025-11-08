import { gcsStorage } from './gcs-storage';

/**
 * Upload a buffer to Google Cloud Storage in the battle-images directory
 * @param buffer - The file buffer to upload
 * @param filename - The storage key/path for the file (e.g., "battle-images/nft-123-456.png")
 * @param contentType - MIME type (e.g., "image/png")
 * @returns The storage key
 */
export async function uploadToGCS(buffer: Buffer, filename: string, contentType: string): Promise<string> {
  try {
    // Extract just the filename from the path if it contains directory structure
    const key = filename.startsWith('uploads/') ? filename : filename;
    
    // Use the gcsStorage service to upload
    // For battle images, we store them as generated type
    const publicUrl = await gcsStorage.uploadFile(buffer, 'generated', contentType, true);
    
    console.log(`✅ [GCS-Upload] Successfully uploaded to: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error('❌ [GCS-Upload] Upload failed:', error);
    throw new Error(`Failed to upload to GCS: ${error}`);
  }
}

/**
 * Get the public URL for a GCS file
 * @param storageKey - The storage key or full path
 * @returns The public URL
 */
export function getGCSPublicUrl(storageKey: string): string {
  const bucketName = process.env.GCS_BUCKET_NAME || 'riddleswap';
  
  // If it's already a full URL, return it
  if (storageKey.startsWith('http://') || storageKey.startsWith('https://')) {
    return storageKey;
  }
  
  // Remove leading slash if present
  const key = storageKey.startsWith('/') ? storageKey.substring(1) : storageKey;
  
  // Return the public GCS URL
  return `https://storage.googleapis.com/${bucketName}/${key}`;
}
