# 🚀 QUICK START: Enable GCS for Social Media Images

## TL;DR
Your system is already set up for Google Cloud Storage! Just set one environment variable and restart.

---

## Step 1: Set Environment Variable

### Option A: Replit Secrets (Recommended)
1. Click "🔒 Secrets" in left sidebar
2. Add new secret:
   - Key: `USE_GCS`
   - Value: `true`
3. Click "Add secret"

### Option B: .env File
```bash
# Add to your .env file
USE_GCS=true
```

---

## Step 2: Configure GCS Credentials

### Required Secrets
```bash
GCS_PROJECT_ID=your-google-cloud-project-id
GCS_BUCKET_NAME=riddleswap
GCS_KEY_JSON={"type":"service_account","project_id":"...","private_key":"..."}
```

### Get Service Account JSON:
1. Go to https://console.cloud.google.com/iam-admin/serviceaccounts
2. Select your service account
3. Click "Keys" → "Add Key" → "Create New Key" → JSON
4. Copy entire JSON content
5. Paste as value for `GCS_KEY_JSON` secret

---

## Step 3: Restart Server

```bash
# Stop current server (Ctrl+C)
# Start again
npm run dev
```

---

## Step 4: Verify It's Working

### Check Server Logs
You should see:
```
🗄️ [STORAGE] Using backend: gcs
✅ [STORAGE] Initialized: Google Cloud Storage
```

### Test Upload
1. Go to `/newsfeed` page
2. Click "Post Riddle" section
3. Click image upload button (📷)
4. Select an image
5. Add post text
6. Click "Post Riddle"

### Verify in GCS Bucket
1. Go to https://console.cloud.google.com/storage
2. Click bucket `riddleswap`
3. Check `posts/` folder
4. You should see your uploaded image!

---

## Troubleshooting

### "GCS credentials not found"
- Make sure `GCS_KEY_JSON` secret is set
- Verify JSON is valid (no extra quotes/escaping)

### "Permission denied"
- Service account needs "Storage Object Admin" role
- Go to: Cloud Console → IAM → Grant role

### "Bucket not found"
- Create bucket named `riddleswap`
- Location: Choose closest region
- Access: Uniform

### "Files not accessible"
- Make bucket public:
  - Go to bucket settings
  - Click "Permissions"
  - Add "allUsers" with "Storage Object Viewer" role

---

## Rollback (If Needed)

To instantly switch back to local storage:
```bash
USE_GCS=false
```
Or remove the `USE_GCS` secret entirely.

---

## That's It! 🎉

Your social media images are now stored in Google Cloud Storage with:
- ✅ 99.99% uptime SLA
- ✅ Global CDN capabilities
- ✅ Automatic backups
- ✅ Scalable storage
- ✅ ~$6/month for 10K users

**For detailed documentation, see:**
- `GCS_INTEGRATION_GUIDE.md`
- `PROJECT_COMPLETE_SUMMARY.md`
