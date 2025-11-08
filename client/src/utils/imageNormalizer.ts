/**
 * Frontend Image Path Normalizer
 * Ensures all images display correctly by handling:
 * - IPFS URLs → Bithomp CDN
 * - Replit Object Storage paths
 * - External HTTP/HTTPS URLs
 * - AI-generated images
 */

/**
 * Convert IPFS URL to Bithomp CDN URL for reliable serving
 * Examples:
 * ipfs://QmXXX -> https://cdn.bithomp.com/ipfs/QmXXX
 * ipfs://bafybeiabc123/image.png -> https://cdn.bithomp.com/ipfs/bafybeiabc123/image.png
 */
export function convertIpfsToBithompCdn(ipfsUrl: string): string {
  if (!ipfsUrl.startsWith('ipfs://')) {
    return ipfsUrl;
  }
  
  const ipfsPath = ipfsUrl.replace('ipfs://', '');
  return `https://cdn.bithomp.com/ipfs/${ipfsPath}`;
}

/**
 * Normalize image path to ensure it displays correctly
 * Handles IPFS URLs, API storage paths, and external URLs
 * Matches backend logic from server/image-path-utils.ts
 */
export function normalizeImagePath(imagePath: string | null | undefined): string | null {
  if (!imagePath) return null;
  
  // Already has /api/storage/ prefix - return as is
  if (imagePath.startsWith('/api/storage/')) {
    return imagePath;
  }
  
  // Has /uploads/ prefix (with leading slash) - add /api/storage prefix
  if (imagePath.startsWith('/uploads/')) {
    return `/api/storage${imagePath}`;
  }
  
  // Has uploads/ prefix (without leading slash) - add /api/storage/ prefix
  if (imagePath.startsWith('uploads/')) {
    return `/api/storage/${imagePath}`;
  }
  
  // Missing prefixes but contains known directories - rebuild full path
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
  
  // Legacy /objects/ paths - convert to /api/storage/
  if (imagePath.startsWith('/objects/')) {
    return imagePath.replace('/objects/', '/api/storage/');
  }
  
  // Data URLs (base64) - return as is
  if (imagePath.startsWith('data:')) {
    return imagePath;
  }
  
  // Unknown format - return null to show fallback
  console.warn('⚠️ Unknown image path format:', imagePath);
  return null;
}

/**
 * Get a fallback placeholder image for broken/missing images
 */
export function getFallbackImage(): string {
  return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23334155" width="200" height="200"/%3E%3Ctext x="50%25" y="50%25" font-family="Arial" font-size="14" fill="%239CA3AF" text-anchor="middle" dominant-baseline="middle"%3ENo Image%3C/text%3E%3C/svg%3E';
}

/**
 * Normalize an NFT's image URL (handles both image_url and imageUrl fields)
 */
export function normalizeNftImage(nft: any): string {
  const imageUrl = nft?.image_url || nft?.imageUrl || nft?.image;
  return normalizeImagePath(imageUrl) || getFallbackImage();
}
