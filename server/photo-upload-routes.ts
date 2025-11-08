import type { Express } from "express";
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { unifiedStorage } from "./unified-storage";
import { requireAuthentication, AuthenticatedRequest } from "./middleware/session-auth";
import { socialMediaService } from "./social-media-service";
import { normalizeImagePath } from "./image-path-utils";

// Configure multer for in-memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

export function registerPhotoUploadRoutes(app: Express) {
  
  // Serve files from storage backend with intelligent path handling
  app.get('/api/storage/uploads/:type/:filename', async (req, res) => {
    try {
      const { type, filename } = req.params;
      
      // Validate type - allow all image directories
      const validTypes = ['profiles', 'covers', 'posts', 'generated-images'];
      if (!validTypes.includes(type)) {
        console.warn(`⚠️ [STORAGE SERVE] Invalid file type requested: ${type}`);
        return res.status(400).json({ error: 'Invalid file type' });
      }
      
  const storageKey = `uploads/${type}/${filename}`;
      console.log(`📥 [STORAGE SERVE] Request for: ${storageKey}`);
      
  // Download file from storage (uses automatic path normalization)
  const fileBuffer = await unifiedStorage.downloadFile(storageKey);
      
      if (!fileBuffer) {
        console.error(`❌ [STORAGE SERVE] File not found: ${storageKey}`);
        return res.status(404).json({ 
          error: 'File not found',
          path: `/api/storage/${storageKey}`,
          hint: 'This image may have expired. AI-generated images are now permanently stored.'
        });
      }
      
      // Determine content type from filename (simple mapping)
      const ext = (filename.split('.').pop() || '').toLowerCase();
      const contentTypeMap: Record<string, string> = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp',
      };
      const contentType = contentTypeMap[ext] || 'application/octet-stream';
      
      // Set appropriate headers for permanent caching
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // Cache for 1 year, immutable
  res.setHeader('X-Storage-Backend', unifiedStorage.getBackendName()); // Debug header
      
      console.log(`✅ [STORAGE SERVE] Successfully served: ${storageKey} (${fileBuffer.length} bytes)`);
      
      // Send the file
      res.send(fileBuffer);
      
    } catch (error: any) {
      console.error('❌ [STORAGE SERVE] Error serving file:', error);
      res.status(500).json({ error: 'Failed to serve file' });
    }
  });
  
  // Photo upload endpoint
  app.post('/api/upload-photo', requireAuthentication, upload.single('file'), async (req: AuthenticatedRequest, res) => {
    try {
      console.log('📸 [UPLOAD-PHOTO] Request received');
      console.log('📸 [UPLOAD-PHOTO] File present:', !!req.file);
      console.log('📸 [UPLOAD-PHOTO] Body:', req.body);
      
      if (!req.file) {
        console.log('❌ [UPLOAD-PHOTO] No file in request');
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }

      const { type } = req.body; // 'profile' or 'cover'
      
      console.log('📸 [UPLOAD-PHOTO] Upload type:', type);
      
      if (!type || !['profile', 'cover'].includes(type)) {
        console.log('❌ [UPLOAD-PHOTO] Invalid type:', type);
        return res.status(400).json({
          success: false,
          message: 'Invalid photo type. Must be "profile" or "cover"'
        });
      }

      const userHandle = req.user?.userHandle;
      if (!userHandle) {
        return res.status(401).json({
          success: false,
          message: 'User session not found'
        });
      }

      console.log(`📸 Processing ${type} photo upload for user: ${userHandle}`);

      // Get existing profile to clean up old files
      const existingProfileData = await socialMediaService.getProfile(userHandle);
      const existingProfile = existingProfileData?.profile;
      const oldImageUrl = type === 'profile' 
        ? existingProfile?.profileImageUrl
        : existingProfile?.coverImageUrl;

      // Upload new file to Replit Object Storage (persistent)
      const publicPath = await unifiedStorage.uploadFile(
        req.file.buffer,
        type as 'profile' | 'cover',
        req.file.mimetype
      );

      console.log(`✅ ${type} photo uploaded successfully to persistent storage:`, publicPath);

      // Update the user's social profile with the new photo
      const updateData = type === 'profile' 
        ? { profileImageUrl: publicPath }
        : { coverImageUrl: publicPath };
      
      await socialMediaService.updateProfile(userHandle, updateData);

      // Clean up old file if it exists (supports both old local and new storage paths)
      if (oldImageUrl && (oldImageUrl.startsWith('/uploads/') || oldImageUrl.startsWith('/api/storage/'))) {
        await unifiedStorage.deleteFile(oldImageUrl);
        console.log(`🗑️ Cleaned up old ${type} image: ${oldImageUrl}`);
      }

      res.json({
        success: true,
        url: publicPath,
        message: `${type === 'profile' ? 'Profile' : 'Cover'} photo uploaded successfully!`
      });

    } catch (error: any) {
      console.error('❌ [UPLOAD-PHOTO] Error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to upload photo'
      });
    }
  });

  // Add error handler for multer
  app.use((error: any, req: any, res: any, next: any) => {
    if (error && req.path === '/api/upload-photo') {
      console.error('❌ [UPLOAD-PHOTO] Multer error:', error.message);
      return res.status(400).json({
        success: false,
        message: error.message || 'File upload error'
      });
    }
    next(error);
  });

  // Get presigned URL for direct upload (DEPRECATED - use /api/upload-photo instead)
  app.post('/api/get-upload-url', requireAuthentication, async (req: AuthenticatedRequest, res) => {
    try {
      return res.status(410).json({
        success: false,
        message: 'This endpoint is deprecated. Please use /api/upload-photo with multipart/form-data instead.'
      });

    } catch (error: any) {
      console.error('Upload URL generation error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to generate upload URL'
      });
    }
  });

  // Save post image (for newsfeed posts)
  app.post('/api/save-post-image', requireAuthentication, upload.single('file'), async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }

      // Upload file to Replit Object Storage as post image
      const publicPath = await unifiedStorage.uploadFile(
        req.file.buffer,
        'post',
        req.file.mimetype
      );

      res.json({
        success: true,
        url: publicPath
      });

    } catch (error: any) {
      console.error('Post image upload error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to upload image'
      });
    }
  });

  // Save message image (for direct messages)
  app.post('/api/upload-message-image', requireAuthentication, upload.single('file'), async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }

      const userHandle = req.user?.userHandle;
      if (!userHandle) {
        return res.status(401).json({
          success: false,
          message: 'User session not found'
        });
      }

      console.log(`📨 Processing message image upload for user: ${userHandle}`);

      // Upload file to Replit Object Storage as post image (messages share the post directory)
      const publicPath = await unifiedStorage.uploadFile(
        req.file.buffer,
        'post',
        req.file.mimetype
      );

      console.log(`✅ Message image uploaded successfully:`, publicPath);

      res.json({
        success: true,
        url: publicPath,
        message: 'Message image uploaded successfully!'
      });

    } catch (error: any) {
      console.error('Message image upload error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to upload message image'
      });
    }
  });
}
