# Google Cloud Storage Setup Guide

## Bucket Information
- **Bucket Name**: `riddleswap`
- **Location**: `us (multiple regions in United States)`
- **Storage Class**: Standard
- **Access Control**: Uniform
- **Console URL**: https://console.cloud.google.com/storage/browser/riddleswap
- **gsutil URI**: gs://riddleswap

## Setup Steps

### 1. Create Service Account Credentials

You need to create a service account with access to the `riddleswap` bucket:

1. Go to: https://console.cloud.google.com/iam-admin/serviceaccounts
2. Click **"CREATE SERVICE ACCOUNT"**
3. Fill in details:
   - Name: `riddleswap-storage-service`
   - Description: `Service account for RiddleSwap storage operations`
4. Click **"CREATE AND CONTINUE"**
5. Grant role: **Storage Object Admin** (for full bucket access) or **Storage Admin**
6. Click **"CONTINUE"** and then **"DONE"**

### 2. Generate JSON Key

1. Click on the service account you just created
2. Go to the **"KEYS"** tab
3. Click **"ADD KEY"** → **"Create new key"**
4. Select **JSON** format
5. Click **"CREATE"**
6. Save the downloaded JSON file securely (e.g., `riddleswap-service-account.json`)

### 3. Configure Environment Variables

Add these to your `.env` file:

```bash
# Google Cloud Storage Configuration
USE_GCS=true
STORAGE_BACKEND=gcs
GCS_BUCKET_NAME=riddleswap
GCS_PROJECT_ID=<your-gcp-project-id>

# Option 1: Use JSON key file path
GCS_KEY_FILE=/path/to/riddleswap-service-account.json

# Option 2: Use inline JSON (recommended for cloud environments)
# GCS_KEY_JSON='<paste-entire-json-content-here>'

# Option 3: Use base64-encoded JSON (for environment variables)
# GCS_KEY_JSON=<base64-encoded-json>
```

### 4. Verify Bucket Permissions

Make sure your service account has these permissions on the `riddleswap` bucket:
- `storage.objects.create`
- `storage.objects.delete`
- `storage.objects.get`
- `storage.objects.list`

You can verify this at:
https://console.cloud.google.com/storage/browser/riddleswap?tab=permissions

### 5. Test the Connection

Run the test script:

```bash
npm run test:gcs
```

Or use the test file:

```bash
node test-gcs-connection.js
```

## Security Best Practices

1. **Never commit service account JSON files** to version control
2. Add `*-service-account.json` to `.gitignore`
3. Use environment variables or secret managers in production
4. Rotate service account keys regularly
5. Use least-privilege permissions (Object Admin is better than full Admin)
6. Enable bucket logging for audit trails

## Troubleshooting

### Error: "Storage service unavailable"
- Check if service account JSON is valid
- Verify the service account has proper permissions
- Ensure the bucket name is correct (`riddleswap`)

### Error: "Access Denied"
- Grant the service account **Storage Object Admin** role
- Check bucket-level IAM permissions
- Verify the service account email in the IAM console

### Error: "Bucket not found"
- Verify bucket name is exactly `riddleswap`
- Ensure you're using the correct GCP project
- Check if the bucket exists at: https://console.cloud.google.com/storage/browser

## Current Bucket Configuration

Based on your bucket info:
- ✅ Bucket exists: `riddleswap`
- ✅ Location: US multi-region (good for performance)
- ✅ Storage class: Standard (appropriate for active data)
- ✅ Access control: Uniform (IAM-based, modern approach)
- ⚠️ Public access: Not public (ensure service account has access)
- ✅ Soft delete: 7 days (good for recovery)
- ℹ️ Versioning: Off (enable if you need file history)

## Next Steps

1. Create service account (if not already done)
2. Download JSON key file
3. Set environment variables in `.env`
4. Run test script to verify connection
5. Deploy to production with secure credentials
