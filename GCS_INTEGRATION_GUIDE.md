# GCS Integration for Social Media Images - Implementation Guide

## Current Status

### ✅ Already Implemented
1. **GCS Storage Service**: `server/gcs-storage.ts`
   - Full implementation with security validation
   - MIME type filtering (JPEG, PNG, GIF, WEBP)
   - 10MB file size limit
   - Magic byte verification
   - Public URL generation

2. **Unified Storage Service**: `server/unified-storage.ts`
   - Automatic backend switching (GCS vs Replit)
   - Single interface for all storage operations
   - Environment-based configuration

3. **Photo Upload Routes**: `server/photo-upload-routes.ts`
   - Already using `unifiedStorage` service
   - POST `/api/save-post-image` endpoint ready
   - Handles file uploads with multer

### ✅ Configuration Already Set
- **Bucket Name**: `riddleswap`
- **Service Account**: Configured via environment variables
- **Credentials**: GCS_KEY_JSON or GOOGLE_APPLICATION_CREDENTIALS

## Integration Steps

### Step 1: Enable GCS Backend
The system is already set up to use GCS! Just set the environment variable:

**Option A: Set USE_GCS flag**
```bash
USE_GCS=true
```

**Option B: Set STORAGE_BACKEND explicitly**
```bash
STORAGE_BACKEND=gcs
```

**Option C: Set NODE_ENV (automatic in production)**
```bash
NODE_ENV=production
```

### Step 2: Verify Environment Variables
Ensure these are set in your `.env` file or Replit Secrets:

```bash
# GCS Project Configuration
GCS_PROJECT_ID=your-project-id
GCS_BUCKET_NAME=riddleswap

# Credentials (choose one):
# Option 1: Service account JSON (preferred for Replit)
GCS_KEY_JSON={"type":"service_account","project_id":"...","private_key":"..."}

# Option 2: File path to service account key
GCS_KEY_FILE=/path/to/service-account-key.json
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
```

### Step 3: Test the Integration

#### A. Upload Test via API
```bash
curl -X POST http://localhost:5000/api/save-post-image \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test-image.jpg"
```

Expected response:
```json
{
  "success": true,
  "url": "https://storage.googleapis.com/riddleswap/posts/uuid-here.jpg"
}
```

#### B. Create Post with Image
1. Go to newsfeed page
2. Click image upload button in PostCreator
3. Select image file
4. Add post content
5. Click "Post Riddle"
6. Verify image appears in post

### Step 4: Verify GCS Storage
Check that files are in your GCS bucket:

**Via Google Cloud Console:**
1. Go to https://console.cloud.google.com/storage
2. Select bucket `riddleswap`
3. Check folders: `posts/`, `profiles/`, `covers/`, `generated/`
4. Verify uploaded files exist

**Via gsutil CLI:**
```bash
gsutil ls gs://riddleswap/posts/
```

## Code Flow

### Upload Flow
```
User clicks upload in PostCreator
  ↓
PhotoUploader component
  ↓ FormData with file
POST /api/save-post-image
  ↓
photo-upload-routes.ts (multer)
  ↓
unifiedStorage.uploadFile()
  ↓ (if USE_GCS=true)
gcs-storage.ts → GoogleCloudStorageService
  ↓
GCS Bucket: riddleswap/posts/uuid.jpg
  ↓ Returns public URL
https://storage.googleapis.com/riddleswap/posts/uuid.jpg
  ↓
Stored in database (posts.image_urls)
  ↓
Displayed in PostCard component
```

### Database Schema
The `posts` table already supports GCS URLs:
```sql
CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  content TEXT,
  author_handle TEXT,
  author_wallet_address TEXT,
  image_urls TEXT[],  -- Array of URLs (GCS or local)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**No schema changes needed!** The `image_urls` column accepts any URL format.

## Testing Checklist

### Unit Tests
- [ ] Upload image via PhotoUploader
- [ ] Verify GCS bucket receives file
- [ ] Check public URL is accessible
- [ ] Verify URL stored in database
- [ ] Test image display in PostCard

### Integration Tests
- [ ] Create post with image
- [ ] Edit post with new image
- [ ] Delete post (cleanup old images)
- [ ] View post in newsfeed
- [ ] View post in profile

### Error Handling Tests
- [ ] Upload oversized file (>10MB) → Error
- [ ] Upload invalid MIME type (SVG) → Error
- [ ] Upload without authentication → 401
- [ ] Network error during upload → Retry/fallback
- [ ] Missing GCS credentials → Error message

## Monitoring

### Logs to Watch
```bash
# Server startup
🗄️ [STORAGE] Using backend: gcs
✅ [STORAGE] Initialized: Google Cloud Storage

# Upload
📸 [PHOTO UPLOADER] Starting post image upload...
📤 [PHOTO UPLOADER] Uploading to /api/save-post-image...
✅ [GCS] File uploaded: posts/uuid.jpg
✅ [PHOTO UPLOADER] File uploaded successfully: https://storage.googleapis.com/...
```

### Error Logs
```bash
❌ [GCS] Upload failed: ...
❌ [PHOTO UPLOADER] Upload error: ...
```

## Rollback Plan

If GCS integration causes issues, instantly rollback:

### Option 1: Environment Variable
```bash
USE_GCS=false
# or
STORAGE_BACKEND=replit
```

### Option 2: Code Change
In `server/unified-storage.ts`:
```typescript
const USE_GCS = false; // Force disable GCS
```

## Performance Optimization

### Caching Strategy
GCS URLs are public and cacheable:
```
https://storage.googleapis.com/riddleswap/posts/uuid.jpg
```
- Add CDN layer (Cloudflare, Cloud CDN)
- Set cache headers: `Cache-Control: public, max-age=31536000`
- Use image optimization service

### Lazy Loading
PostCard component should use lazy loading:
```tsx
<img 
  src={post.imageUrls[0]} 
  loading="lazy"
  style={{ width: '100%', maxHeight: 384, objectFit: 'cover' }}
/>
```

## Cost Estimation

### GCS Pricing (as of 2024)
- **Storage**: $0.020 per GB/month (Standard)
- **Network**: $0.12 per GB (egress to internet)
- **Operations**: 
  - Class A (uploads): $0.05 per 10,000 operations
  - Class B (reads): $0.004 per 10,000 operations

### Example Monthly Cost
For 10,000 active users:
- 10,000 posts/month with images (avg 500KB each)
- Storage: 5 GB × $0.02 = $0.10
- Upload operations: 10,000 × $0.05/10,000 = $0.05
- Bandwidth: 50 GB viewed × $0.12 = $6.00
- **Total: ~$6.15/month**

## Security

### Already Implemented
- ✅ MIME type validation (server-side)
- ✅ File size limits (10MB)
- ✅ Magic byte verification
- ✅ No SVG support (XSS prevention)
- ✅ Authentication required
- ✅ Public read, authenticated write

### Additional Recommendations
- [ ] Add rate limiting on upload endpoint
- [ ] Implement virus scanning for uploads
- [ ] Add content moderation pipeline
- [ ] Monitor for abusive uploads

## Next Steps

1. **Set environment variable**: `USE_GCS=true`
2. **Restart server**: Changes take effect immediately
3. **Test upload**: Use PostCreator to upload image
4. **Verify GCS bucket**: Check files appear in bucket
5. **Monitor logs**: Watch for errors
6. **Update documentation**: Record any issues

## Support

### Troubleshooting
**Issue**: "GCS credentials not found"
- **Fix**: Set `GCS_KEY_JSON` in environment

**Issue**: "Permission denied"
- **Fix**: Ensure service account has `Storage Object Admin` role

**Issue**: "Bucket not found"
- **Fix**: Create bucket `riddleswap` in GCS console

**Issue**: "Files not accessible"
- **Fix**: Make bucket public or set makePublic=true in upload

### Contact
- **GCS Documentation**: https://cloud.google.com/storage/docs
- **Node.js Client**: https://googleapis.dev/nodejs/storage/latest/

---

**Status**: Ready to deploy with single environment variable change
**Complexity**: Low - all infrastructure already in place
**Risk**: Low - instant rollback available
