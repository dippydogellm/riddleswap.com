import { Express, Request, Response } from 'express';
import multer from 'multer';
import { getPinataService } from './pinata-ipfs-service';
import { requireAuthentication, AuthenticatedRequest } from './middleware/session-auth';

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
});

export function registerNFTLaunchpadIPFSRoutes(app: Express) {
  console.log('📤 Registering NFT Launchpad IPFS routes...');
  
  const pinata = getPinataService();
  console.log('✅ Pinata IPFS service initialized with secrets');

  // Test endpoint to verify Pinata connection
  app.get('/api/launchpad/ipfs/status', (req: Request, res: Response) => {
    res.json({
      status: 'operational',
      service: 'Pinata IPFS',
      configured: true,
      message: 'IPFS upload service ready'
    });
  });

  // Upload single image to IPFS
  app.post('/api/launchpad/ipfs/upload-image', 
    requireAuthentication, 
    upload.single('image'), 
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: 'No image file provided' });
        }

        // Validate image
        const validation = pinata.validateImageFile(req.file.buffer, req.file.originalname);
        if (!validation.valid) {
          return res.status(400).json({ error: validation.error });
        }

        console.log(`📤 Uploading image to IPFS: ${req.file.originalname} (${req.file.size} bytes)`);

        // Upload to IPFS
        const result = await pinata.uploadFile(req.file.buffer, req.file.originalname);

        console.log(`✅ Image uploaded to IPFS: ${result.hash}`);

        res.json({
          success: true,
          hash: result.hash,
          url: result.url,
          gateway: 'https://gateway.pinata.cloud/ipfs/',
          size: req.file.size,
          filename: req.file.originalname
        });
      } catch (error) {
        console.error('❌ Error uploading image to IPFS:', error);
        res.status(500).json({ 
          error: 'Failed to upload image to IPFS',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  // Upload multiple images (for NFT collections)
  app.post('/api/launchpad/ipfs/upload-images', 
    requireAuthentication, 
    upload.array('images', 1000), // Max 1000 images for collection
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const files = req.files as Express.Multer.File[];
        
        if (!files || files.length === 0) {
          return res.status(400).json({ error: 'No image files provided' });
        }

        console.log(`📤 Uploading ${files.length} images to IPFS...`);

        // Validate all images first
        for (const file of files) {
          const validation = pinata.validateImageFile(file.buffer, file.originalname);
          if (!validation.valid) {
            return res.status(400).json({ 
              error: `Invalid file ${file.originalname}: ${validation.error}` 
            });
          }
        }

        // Upload all images
        const uploadPromises = files.map(file => ({
          buffer: file.buffer,
          name: file.originalname
        }));

        const results = await pinata.uploadNFTImages(uploadPromises);

        console.log(`✅ Uploaded ${results.length} images to IPFS`);

        res.json({
          success: true,
          count: results.length,
          uploads: results // Frontend expects 'uploads' array
        });
      } catch (error) {
        console.error('❌ Error uploading images to IPFS:', error);
        res.status(500).json({ 
          error: 'Failed to upload images to IPFS',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  // Upload NFT metadata JSON to IPFS
  app.post('/api/launchpad/ipfs/upload-metadata', 
    requireAuthentication, 
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const metadata = req.body;

        // Validate metadata
        const validation = pinata.validateMetadata(metadata);
        if (!validation.valid) {
          return res.status(400).json({ 
            error: 'Invalid metadata',
            errors: validation.errors
          });
        }

        console.log(`📤 Uploading NFT metadata to IPFS: ${metadata.name}`);

        // Upload metadata to IPFS
        const result = await pinata.uploadNFTMetadata(metadata);

        console.log(`✅ Metadata uploaded to IPFS: ${result.hash}`);

        res.json({
          success: true,
          hash: result.hash,
          url: result.url,
          metadata: metadata
        });
      } catch (error) {
        console.error('❌ Error uploading metadata to IPFS:', error);
        res.status(500).json({ 
          error: 'Failed to upload metadata to IPFS',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  // Batch create and upload NFT metadata for entire collection
  app.post('/api/launchpad/ipfs/batch-metadata', 
    requireAuthentication, 
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { metadataArray } = req.body;

        if (!metadataArray || !Array.isArray(metadataArray)) {
          return res.status(400).json({ error: 'Invalid request body - metadataArray required' });
        }

        console.log(`📤 Uploading ${metadataArray.length} metadata files to IPFS...`);

        const uploadResults = [];

        for (let i = 0; i < metadataArray.length; i++) {
          const result = await pinata.uploadNFTMetadata(metadataArray[i]);
          uploadResults.push({
            index: i,
            name: metadataArray[i].name,
            hash: result.hash,
            url: result.url
          });
        }

        console.log(`✅ Uploaded ${uploadResults.length} metadata files`);

        res.json({
          success: true,
          count: uploadResults.length,
          uploads: uploadResults // Frontend expects 'uploads' array
        });
      } catch (error) {
        console.error('❌ Error creating batch metadata:', error);
        res.status(500).json({ 
          error: 'Failed to create batch metadata',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  // Get file info from IPFS
  app.get('/api/launchpad/ipfs/file/:hash', async (req: Request, res: Response) => {
    try {
      const { hash } = req.params;
      const fileInfo = await pinata.getFileInfo(hash);
      res.json(fileInfo);
    } catch (error) {
      console.error('❌ Error fetching file from IPFS:', error);
      res.status(500).json({ 
        error: 'Failed to fetch file from IPFS',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Delete/unpin file from IPFS (cleanup)
  app.delete('/api/launchpad/ipfs/unpin/:hash', 
    requireAuthentication, 
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { hash } = req.params;
        
        console.log(`🗑️ Unpinning file from IPFS: ${hash}`);
        
        const success = await pinata.unpinFile(hash);
        
        if (success) {
          console.log(`✅ File unpinned: ${hash}`);
          res.json({ success: true, message: 'File unpinned successfully' });
        } else {
          res.status(500).json({ success: false, error: 'Failed to unpin file' });
        }
      } catch (error) {
        console.error('❌ Error unpinning file:', error);
        res.status(500).json({ 
          error: 'Failed to unpin file',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  console.log('✅ NFT Launchpad IPFS routes registered successfully');
}
