import FormData from 'form-data';
import fetch from 'node-fetch';

// Pinata IPFS Service
// Handles uploads to IPFS via Pinata API

const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY;
const PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs/';

interface PinataResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
}

export class PinataIPFSService {
  private apiKey: string | undefined;
  private secretKey: string | undefined;

  constructor() {
    if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
      console.warn('⚠️ Pinata API keys not configured - IPFS uploads will be disabled');
      this.apiKey = undefined;
      this.secretKey = undefined;
      return;
    }
    this.apiKey = PINATA_API_KEY;
    this.secretKey = PINATA_SECRET_KEY;
  }
  
  private checkConfig() {
    if (!this.apiKey || !this.secretKey) {
      throw new Error('Pinata API keys not configured');
    }
  }

  /**
   * Upload a file buffer to IPFS
   */
  async uploadFile(fileBuffer: Buffer, fileName: string): Promise<{ hash: string; url: string }> {
    this.checkConfig();
    try {
      const formData = new FormData();
      formData.append('file', fileBuffer, { filename: fileName });

      const metadata = JSON.stringify({
        name: fileName,
        keyvalues: {
          uploadedBy: 'riddleswap-launchpad',
          timestamp: new Date().toISOString()
        }
      });
      formData.append('pinataMetadata', metadata);

      const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: {
          'pinata_api_key': this.apiKey!,
          'pinata_secret_api_key': this.secretKey!,
        },
        body: formData as any,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Pinata upload failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as PinataResponse;
      
      return {
        hash: data.IpfsHash,
        url: `${PINATA_GATEWAY}${data.IpfsHash}`
      };
    } catch (error) {
      console.error('❌ Pinata file upload error:', error);
      throw error;
    }
  }

  /**
   * Upload JSON metadata to IPFS
   */
  async uploadJSON(jsonData: any, name: string): Promise<{ hash: string; url: string }> {
    this.checkConfig();
    try {
      const metadata = {
        pinataMetadata: {
          name: name,
          keyvalues: {
            uploadedBy: 'riddleswap-launchpad',
            timestamp: new Date().toISOString()
          }
        },
        pinataContent: jsonData
      };

      const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'pinata_api_key': this.apiKey!,
          'pinata_secret_api_key': this.secretKey!,
        },
        body: JSON.stringify(metadata),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Pinata JSON upload failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as PinataResponse;
      
      return {
        hash: data.IpfsHash,
        url: `${PINATA_GATEWAY}${data.IpfsHash}`
      };
    } catch (error) {
      console.error('❌ Pinata JSON upload error:', error);
      throw error;
    }
  }

  /**
   * Upload multiple images for an NFT collection
   */
  async uploadNFTImages(images: Array<{ buffer: Buffer; name: string }>): Promise<Array<{ name: string; hash: string; url: string }>> {
    const results = [];
    
    for (const image of images) {
      const result = await this.uploadFile(image.buffer, image.name);
      results.push({
        name: image.name,
        ...result
      });
    }
    
    return results;
  }

  /**
   * Create and upload NFT metadata JSON
   */
  async uploadNFTMetadata(metadata: {
    name: string;
    symbol: string;
    description: string;
    image: string;  // IPFS URL or hash
    attributes?: Array<{ trait_type: string; value: string | number }>;
    collection?: {
      name: string;
      family?: string;
    };
    properties?: Record<string, any>;
    external_url?: string;
  }): Promise<{ hash: string; url: string }> {
    return this.uploadJSON(metadata, `${metadata.name}-metadata.json`);
  }

  /**
   * Validate image file
   */
  validateImageFile(buffer: Buffer, fileName: string): { valid: boolean; error?: string } {
    // Check file size (max 10MB)
    if (buffer.length > 10 * 1024 * 1024) {
      return { valid: false, error: 'File size exceeds 10MB limit' };
    }

    // Check file extension
    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const extension = fileName.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/);
    if (!extension) {
      return { valid: false, error: 'Invalid file type. Allowed: JPG, PNG, GIF, WEBP' };
    }

    return { valid: true };
  }

  /**
   * Validate metadata JSON
   */
  validateMetadata(metadata: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!metadata.name || typeof metadata.name !== 'string') {
      errors.push('Metadata must have a name field');
    }

    if (!metadata.description || typeof metadata.description !== 'string') {
      errors.push('Metadata must have a description field');
    }

    if (!metadata.image || typeof metadata.image !== 'string') {
      errors.push('Metadata must have an image field');
    }

    if (metadata.attributes && !Array.isArray(metadata.attributes)) {
      errors.push('Attributes must be an array');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get file info from IPFS
   */
  async getFileInfo(hash: string): Promise<any> {
    try {
      const response = await fetch(`${PINATA_GATEWAY}${hash}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status}`);
      }
      return await response.json() as any;
    } catch (error) {
      console.error('❌ Error fetching file from IPFS:', error);
      throw error;
    }
  }

  /**
   * Unpin file from IPFS (cleanup)
   */
  async unpinFile(hash: string): Promise<boolean> {
    this.checkConfig();
    try {
      const response = await fetch(`https://api.pinata.cloud/pinning/unpin/${hash}`, {
        method: 'DELETE',
        headers: {
          'pinata_api_key': this.apiKey!,
          'pinata_secret_api_key': this.secretKey!,
        },
      });

      return response.ok;
    } catch (error) {
      console.error('❌ Error unpinning file:', error);
      return false;
    }
  }
}

// Singleton instance
let pinataService: PinataIPFSService | null = null;

export function getPinataService(): PinataIPFSService {
  if (!pinataService) {
    pinataService = new PinataIPFSService();
  }
  return pinataService;
}
