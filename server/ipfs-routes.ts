import { Express } from 'express';
import multer from 'multer';
import { requireAuthentication, AuthenticatedRequest } from './middleware/session-auth';
import { z } from 'zod';
import * as mime from 'mime-types';
import { FormData, File, Blob } from 'formdata-node';

// Initialize NFT.Storage client using HTTP API (no deprecated dependencies)
const nftStorageToken = process.env.NFT_STORAGE_TOKEN;
if (!nftStorageToken) {
  console.warn('⚠️ NFT_STORAGE_TOKEN not found - IPFS uploads will fail');
}

const NFT_STORAGE_API = 'https://api.nft.storage';

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 20 // Max 20 files per upload
  },
  fileFilter: (req, file, cb) => {
    // Allow images, videos, audio, and documents
    const allowedTypes = [
      'image/', 'video/', 'audio/',
      'application/json', 'text/plain'
    ];
    
    const isAllowed = allowedTypes.some(type => file.mimetype.startsWith(type));
    if (isAllowed) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  }
});

// Metadata schemas
const NFTMetadataSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  image: z.string().url().optional(),
  external_url: z.string().url().optional(),
  animation_url: z.string().url().optional(),
  attributes: z.array(z.object({
    trait_type: z.string(),
    value: z.union([z.string(), z.number()]),
    display_type: z.string().optional()
  })).optional()
});

const CollectionMetadataSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  image: z.string().url().optional(),
  external_url: z.string().url().optional(),
  symbol: z.string().max(10).optional(),
  seller_fee_basis_points: z.number().min(0).max(10000).optional(), // 0-100%
  fee_recipient: z.string().optional() // Wallet address for royalties
});

export function registerIPFSRoutes(app: Express) {
  console.log('📁 Registering IPFS upload routes...');

  // Upload files to IPFS using NFT.Storage HTTP API
  app.post('/api/ipfs/upload', requireAuthentication, upload.array('files', 20), async (req: AuthenticatedRequest, res) => {
    try {
      if (!nftStorageToken) {
        return res.status(500).json({ 
          error: 'IPFS service not configured',
          details: 'NFT_STORAGE_TOKEN not found'
        });
      }

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files provided' });
      }

      console.log(`📤 [IPFS] Uploading ${files.length} files for user: ${req.session.user?.handle}`);

      const uploadedFiles = [];
      
      for (const file of files) {
        // Validate file
        const fileType = mime.lookup(file.originalname);
        if (!fileType) {
          return res.status(400).json({ 
            error: `Cannot determine MIME type for file: ${file.originalname}` 
          });
        }

        // Create FormData for HTTP upload
        const formData = new FormData();
        const blob = new Blob([file.buffer], { type: file.mimetype });
        formData.append('file', blob, file.originalname);

        // Upload to IPFS via HTTP API
        const response = await fetch(`${NFT_STORAGE_API}/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${nftStorageToken}`
          },
          body: formData as any
        });

        if (!response.ok) {
          throw new Error(`NFT.Storage API error: ${response.status} ${response.statusText}`);
        }

        const result = await response.json() as any;
        const cid = result.value.cid;
        
        uploadedFiles.push({
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          cid: cid,
          ipfsUrl: `ipfs://${cid}`,
          gatewayUrl: `https://nftstorage.link/ipfs/${cid}`
        });

        console.log(`✅ [IPFS] Uploaded ${file.originalname}: ${cid}`);
      }

      res.json({
        success: true,
        files: uploadedFiles,
        message: `Successfully uploaded ${files.length} files to IPFS`
      });

    } catch (error) {
      console.error('❌ [IPFS] Upload error:', error);
      res.status(500).json({ 
        error: 'Failed to upload files to IPFS',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Upload metadata JSON to IPFS
  app.post('/api/ipfs/metadata', requireAuthentication, async (req: AuthenticatedRequest, res) => {
    try {
      if (!nftStorageToken) {
        return res.status(500).json({ 
          error: 'IPFS service not configured',
          details: 'NFT_STORAGE_TOKEN not found'
        });
      }

      const { metadata, type = 'nft' } = req.body;
      
      // Validate metadata based on type
      let validatedMetadata;
      if (type === 'collection') {
        validatedMetadata = CollectionMetadataSchema.parse(metadata);
      } else {
        validatedMetadata = NFTMetadataSchema.parse(metadata);
      }

      console.log(`📋 [IPFS] Uploading ${type} metadata for user: ${req.session.user?.handle}`);

      // Convert metadata to JSON blob
      const metadataJson = JSON.stringify(validatedMetadata, null, 2);
      const formData = new FormData();
      const blob = new Blob([metadataJson], { type: 'application/json' });
      formData.append('file', blob, 'metadata.json');

      // Upload to IPFS via HTTP API
      const response = await fetch(`${NFT_STORAGE_API}/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${nftStorageToken}`
        },
        body: formData as any
      });

      if (!response.ok) {
        throw new Error(`NFT.Storage API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json() as any;
      const cid = result.value.cid;

      console.log(`✅ [IPFS] Uploaded metadata: ${cid}`);

      res.json({
        success: true,
        metadata: validatedMetadata,
        cid: cid,
        ipfsUrl: `ipfs://${cid}`,
        gatewayUrl: `https://nftstorage.link/ipfs/${cid}`,
        type
      });

    } catch (error) {
      console.error('❌ [IPFS] Metadata upload error:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid metadata format',
          details: error.errors
        });
      }

      res.status(500).json({ 
        error: 'Failed to upload metadata to IPFS',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Verify IPFS content
  app.get('/api/ipfs/verify/:cid', requireAuthentication, async (req: AuthenticatedRequest, res) => {
    try {
      const { cid } = req.params;
      
      if (!cid) {
        return res.status(400).json({ error: 'CID required' });
      }

      console.log(`🔍 [IPFS] Verifying CID: ${cid}`);

      // Try to fetch from gateway to verify
      const gatewayUrl = `https://nftstorage.link/ipfs/${cid}`;
      const response = await fetch(gatewayUrl, { method: 'HEAD' });

      const isAccessible = response.ok;
      const contentType = response.headers.get('content-type');
      const contentLength = response.headers.get('content-length');

      res.json({
        success: true,
        cid,
        isAccessible,
        contentType,
        contentLength: contentLength ? parseInt(contentLength) : null,
        ipfsUrl: `ipfs://${cid}`,
        gatewayUrl
      });

    } catch (error) {
      console.error('❌ [IPFS] Verify error:', error);
      res.status(500).json({ 
        error: 'Failed to verify IPFS content',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Batch upload for collections
  app.post('/api/ipfs/batch', requireAuthentication, upload.array('files', 100), async (req: AuthenticatedRequest, res) => {
    try {
      if (!nftStorageToken) {
        return res.status(500).json({ 
          error: 'IPFS service not configured',
          details: 'NFT_STORAGE_TOKEN not found'
        });
      }

      const files = req.files as Express.Multer.File[];
      const { metadataTemplate } = req.body;

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files provided' });
      }

      console.log(`📦 [IPFS] Batch uploading ${files.length} files for user: ${req.session.user?.handle}`);

      // Parse metadata template if provided
      let template: any = {};
      if (metadataTemplate) {
        try {
          template = JSON.parse(metadataTemplate);
        } catch (error) {
          return res.status(400).json({ error: 'Invalid metadata template JSON' });
        }
      }

      const results = [];
      
      // Upload files in batches of 10 to avoid rate limits
      for (let i = 0; i < files.length; i += 10) {
        const batch = files.slice(i, i + 10);
        
        const batchPromises = batch.map(async (file, index) => {
          const fileType = mime.lookup(file.originalname);
          if (!fileType) {
            throw new Error(`Cannot determine MIME type for file: ${file.originalname}`);
          }

          // Upload file via HTTP API
          const formData = new FormData();
          const blob = new Blob([file.buffer], { type: file.mimetype });
          formData.append('file', blob, file.originalname);

          const response = await fetch(`${NFT_STORAGE_API}/upload`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${nftStorageToken}`
            },
            body: formData as any
          });

          if (!response.ok) {
            throw new Error(`NFT.Storage API error: ${response.status}`);
          }

          const result = await response.json() as any;
          const cid = result.value.cid;
          
          // Generate metadata if template provided
          let metadata = null;
          if (metadataTemplate) {
            const fileNumber = i + index + 1;
            metadata = {
              ...template,
              name: template.name ? `${template.name} #${fileNumber}` : `NFT #${fileNumber}`,
              image: `ipfs://${cid}`,
              attributes: template.attributes || []
            };

            // Upload metadata
            const metadataJson = JSON.stringify(metadata, null, 2);
            const metadataFormData = new FormData();
            const metadataBlob = new Blob([metadataJson], { type: 'application/json' });
            metadataFormData.append('file', metadataBlob, `${fileNumber}.json`);

            const metadataResponse = await fetch(`${NFT_STORAGE_API}/upload`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${nftStorageToken}`
              },
              body: metadataFormData as any
            });

            if (!metadataResponse.ok) {
              throw new Error(`Metadata upload error: ${metadataResponse.status}`);
            }

            const metadataResult = await metadataResponse.json();
            const metadataCid = metadataResult.value.cid;

            metadata.metadataCid = metadataCid;
            metadata.metadataUrl = `ipfs://${metadataCid}`;
          }

          return {
            fileNumber: i + index + 1,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            imageCid: cid,
            imageUrl: `ipfs://${cid}`,
            metadata
          };
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Small delay between batches
        if (i + 10 < files.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`✅ [IPFS] Batch uploaded ${results.length} files`);

      res.json({
        success: true,
        totalFiles: results.length,
        results,
        message: `Successfully uploaded ${results.length} files to IPFS`
      });

    } catch (error) {
      console.error('❌ [IPFS] Batch upload error:', error);
      res.status(500).json({ 
        error: 'Failed to batch upload to IPFS',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  console.log('✅ IPFS upload routes registered successfully');
}