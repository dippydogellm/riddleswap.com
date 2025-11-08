# 🚀 GCS ACTIVATED - Ready to Deploy!

## ✅ Credentials Added Successfully

Your Google Cloud Storage credentials have been added to `.env`:

```bash
GCS_PROJECT_ID="riddleswap"
GCS_KEY_JSON='{"type":"service_account",...}'  # Full JSON added
```

---

## 🎯 Next Steps

### 1. Restart Your Server
```bash
# Stop current server (Ctrl+C in terminal)
# Then restart:
npm run dev
```

### 2. Look for Success Log
You should see:
```
🗄️ [STORAGE] Using backend: gcs
✅ [STORAGE] Initialized: Google Cloud Storage
```

### 3. Test Image Upload
1. Go to `http://localhost:5000/newsfeed`
2. Click "Post Riddle" section
3. Click image upload button (📷)
4. Select an image
5. Wait for upload
6. Add optional text
7. Click "Post Riddle"

### 4. Verify in GCS Console
1. Go to https://console.cloud.google.com/storage/browser/riddleswap
2. Navigate to `posts/` folder
3. You should see your uploaded image!

### 5. Check Database
```sql
SELECT id, content, image_urls FROM posts 
WHERE image_urls IS NOT NULL 
ORDER BY created_at DESC LIMIT 1;
```

Expected result:
```
image_urls = {"https://storage.googleapis.com/riddleswap/posts/abc123-def456.jpg"}
```

---

## 🔍 Troubleshooting

### If you see errors about GCS:

**"Permission denied"**
- Service account needs "Storage Object Admin" role
- Go to: https://console.cloud.google.com/iam-admin/iam
- Find: `riddleswap@riddleswap.iam.gserviceaccount.com`
- Add role: "Storage Object Admin"

**"Bucket not found"**
- Create bucket named `riddleswap`
- Go to: https://console.cloud.google.com/storage
- Click "Create Bucket"
- Name: `riddleswap`
- Location: Choose your region
- Access control: Uniform

**Still using Replit storage**
- Check logs for error messages
- Verify credentials in `.env` are correct
- Ensure no extra spaces or quotes in GCS_KEY_JSON

---

## 📊 What's Now Active

### All These Endpoints Use GCS:
- ✅ **Newsfeed posts** → `gs://riddleswap/posts/`
- ✅ **Profile photos** → `gs://riddleswap/profiles/`
- ✅ **Cover photos** → `gs://riddleswap/covers/`
- ✅ **AI-generated images** → `gs://riddleswap/generated/`
- ✅ **Gaming NFTs** → `gs://riddleswap/generated/`
- ✅ **Direct message images** → `gs://riddleswap/posts/`

### Public URLs Generated:
```
https://storage.googleapis.com/riddleswap/posts/{uuid}.jpg
https://storage.googleapis.com/riddleswap/profiles/{uuid}.jpg
https://storage.googleapis.com/riddleswap/covers/{uuid}.jpg
https://storage.googleapis.com/riddleswap/generated/{uuid}.png
```

---

## 💰 Cost Monitoring

Monitor your usage at:
https://console.cloud.google.com/storage/browser/riddleswap

Expected costs for 10K users/month: **~$6/month**

---

## 🔄 Rollback (If Needed)

To instantly switch back to Replit storage:

**Option 1: Disable GCS**
```bash
USE_GCS="false"
```

**Option 2: Remove credentials**
```bash
GCS_KEY_JSON=''
GCS_PROJECT_ID=''
```

Then restart server.

---

## ✅ Status

- [x] Credentials added to `.env`
- [x] Project ID: `riddleswap`
- [x] Service Account: `riddleswap@riddleswap.iam.gserviceaccount.com`
- [x] Bucket: `riddleswap`
- [ ] Server restarted (do this now!)
- [ ] Test upload completed
- [ ] Verified in GCS console

---

**🎉 You're all set! Just restart the server and start uploading!**

**Next command:**
```bash
npm run dev
```
