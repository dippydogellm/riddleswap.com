/**
 * Image Path Utilities
 * Ensures all AI-generated images use correct Replit Object Storage paths
 * Converts IPFS URLs to Bithomp CDN for reliable NFT image serving
 */

/**
 * Convert IPFS URL to Bithomp CDN URL
 * Examples:
 * ipfs://QmXXX -> https://cdn.bithomp.com/ipfs/QmXXX
 * ipfs://bafybeiabc123/image.png -> https://cdn.bithomp.com/ipfs/bafybeiabc123/image.png
 */
export function convertIpfsToBithompCdn(ipfsUrl: string): string {
  if (!ipfsUrl.startsWith('ipfs://')) {
    return ipfsUrl;
  }
  
  // Remove ipfs:// prefix and convert to Bithomp CDN
  const ipfsPath = ipfsUrl.replace('ipfs://', '');
  return `https://cdn.bithomp.com/ipfs/${ipfsPath}`;
}

/**
 * Normalize image path to ensure it has the correct /api/storage/ prefix
 * Handles various input formats and returns a consistent path
 * Converts IPFS URLs to Bithomp CDN for reliable serving
 */
export function normalizeImagePath(imagePath: string | null | undefined): string | null {
  if (!imagePath) return null;
  
  // Already has /api/storage/ prefix - return as is
  if (imagePath.startsWith('/api/storage/')) {
    return imagePath;
  }
  
  // Has uploads/ prefix but missing /api/storage/ - add it
  if (imagePath.startsWith('uploads/')) {
    return `/api/storage/${imagePath}`;
  }
  
  // Missing both prefixes - add full path
  if (imagePath.includes('generated-images/') || 
      imagePath.includes('profiles/') || 
      imagePath.includes('covers/') || 
      imagePath.includes('posts/')) {
    // Extract the filename and rebuild path
    const parts = imagePath.split('/');
    const filename = parts[parts.length - 1];
    const type = parts[parts.length - 2];
    return `/api/storage/uploads/${type}/${filename}`;
  }
  
  // External URL (http/https) - return as is
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  
  // IPFS URLs - convert to Bithomp CDN for reliable serving
  if (imagePath.startsWith('ipfs://')) {
    return convertIpfsToBithompCdn(imagePath);
  }
  
  // Unknown format - return null to avoid serving broken images
  console.warn(`⚠️ Unknown image path format: ${imagePath}`);
  return null;
}

/**
 * Check if an image URL is an expired OpenAI/DALL-E temporary URL
 */
export function isExpiredDalleUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  
  // OpenAI DALL-E URLs contain 'oaidalleapiprodscus' and expire after ~1 hour
  return url.includes('oaidalleapiprodscus') || 
         url.includes('dalle-') ||
         url.includes('openai.com');
}

/**
 * Validate that an image path is properly formatted for object storage
 */
export function isValidStoragePath(path: string | null | undefined): boolean {
  if (!path) return false;
  
  // Valid paths must start with /api/storage/ or be external URLs
  if (path.startsWith('/api/storage/')) {
    // Check format: /api/storage/uploads/{type}/{filename}
    const pathRegex = /^\/api\/storage\/uploads\/(profiles|covers|posts|generated-images)\/[a-zA-Z0-9_\-\.]+\.(jpg|jpeg|png|gif|webp)$/;
    return pathRegex.test(path);
  }
  
  // Allow external URLs
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return true;
  }
  
  return false;
}

/**
 * Extract storage key from full path
 * Converts /api/storage/uploads/generated-images/file.png → uploads/generated-images/file.png
 */
export function extractStorageKey(fullPath: string): string {
  if (fullPath.startsWith('/api/storage/')) {
    return fullPath.replace('/api/storage/', '');
  }
  
  // Already a storage key
  if (fullPath.startsWith('uploads/')) {
    return fullPath;
  }
  
  return fullPath;
}

/**
 * Get full path from storage key
 * Converts uploads/generated-images/file.png → /api/storage/uploads/generated-images/file.png
 */
export function getFullPathFromKey(storageKey: string): string {
  if (storageKey.startsWith('/api/storage/')) {
    return storageKey; // Already full path
  }
  
  if (storageKey.startsWith('uploads/')) {
    return `/api/storage/${storageKey}`;
  }
  
  return `/api/storage/uploads/${storageKey}`;
}
