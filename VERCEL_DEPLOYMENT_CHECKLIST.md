# Vercel Deployment Checklist

## Pre-Deployment

### 1. Environment Variables Setup ✓
Add these to Vercel Dashboard → Project Settings → Environment Variables:

#### Database (Required)
```
DATABASE_URL="postgresql://neondb_owner:npg_qdIe1X8rkaJb@ep-broad-surf-a576s6yl.us-east-2.aws.neon.tech/neondb?sslmode=require"
PGDATABASE="neondb"
PGHOST="ep-broad-surf-a576s6yl.us-east-2.aws.neon.tech"
PGPORT="5432"
PGUSER="neondb_owner"
PGPASSWORD="npg_qdIe1X8rkaJb"
```

#### Session & Security (Required)
```
SESSION_SECRET="0kvrEZ2Yj6wxFvUkJSCNnzpddUwweAmZA6qDgFi2icV+xFArbuoiwGTx/8MWBWZy09oRx8/4N3aIBSYZJXJuyA=="
```

#### Wallet Private Keys (Required)
```
ETHEREUM_BANK_PRIVATE_KEY="0x9ef513f3b982fb1e071a6af8b7ba7167de8acb10939a4443a160d4bc6e1b16ff"
OLANA_BANK_PRIVATE_KEY="fyUv91gHPkNuTo5Ev53nWTKDgurRe9mxGx1q9Yy8pnBoPzpVWv3XpEnmmMytu9NTMo7YUdLsyjHyHccQjAYVvvr"
BANK_RDL_PRIVATE_KEY="sEdSiXZ5cAUHRvhvf263uUUCGHvtj8D"
```

#### Broker System (Required)
```
RIDDLE_BROKER_ADDRESS="rGLzXKif4ksBZe2MY6RZT9m69hdgzsXG4X"
BROKER_WALLET_SEED="sEd7B9EmH6mJ7zpxptNPeZMxmdsp8fM"
RIDDLE_BROKER_SECRET="sEd7B9EmH6mJ7zpxptNPeZMxmdsp8fM"
```

#### API Keys (Required)
```
OPENAI_PROJECT="proj_ywCVuJxaz537EZxq44wGJ5wx"
OPENAI_API_KEY="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"
ONE_INCH_API_KEY="viiZs5mppdTHlxWlaric8MmMRjufCAXp"
NFT_STORAGE_TOKEN="e82a06f9.fdf7e9cbdbc84aec8d6758ab643abcfb"
```

#### WalletConnect (Required)
```
VITE_WALLETCONNECT_PROJECT_ID="fa5ebbd9b00cc684a0662cd09406ed00"
WALLETCONNECT_PROJECT_ID="4746ae20129f1e0edd0a9d8a214cd4b1"
VITE_FEE_WALLET_EVM="0x9211346f428628d7C84CE1338C0b51FDdf2E8461"
VITE_WALLET_CONNECTION_TIMEOUT="600"
```

#### Telegram Bot (Optional)
```
TELEGRAM_BOT_TOKEN="8380829527:AAEWYuREocfgnfvZAQQ8guPC2mOv5khx5ys"
TELEGRAM_CHANNEL_ID="@TheOracleRiddleBot"
```

#### Vercel Blob Storage (CRITICAL - NEW!)
```
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_XXXXXXXXXXXXX"
```
**⚠️ GET THIS FROM**: Vercel Dashboard → Storage → Blob → Create Database

#### Optional/Placeholder (Can be added later)
```
PINATA_SECRET_KEY="..."  # Can be empty for now
BITHOMP_API_KEY="your_bithomp_api_key_here"  # Get from bithomp.com
```

---

## 2. Vercel Blob Setup (REQUIRED)

### Option A: Via Vercel Dashboard
1. Go to your project in Vercel Dashboard
2. Click **Storage** tab
3. Click **Create Database**
4. Select **Blob**
5. Name it "riddleswap-storage" or similar
6. Copy the `BLOB_READ_WRITE_TOKEN` that's generated
7. Add it to Environment Variables (Production, Preview, Development)

### Option B: Via Vercel CLI
```bash
vercel link
# Token will be automatically configured
```

---

## 3. Code Verification

### Check All Files Are Ready
- [x] `server/blob-storage.ts` - Vercel Blob implementation ✅
- [x] `server/unified-storage.ts` - Updated to use Vercel Blob ✅
- [x] `server/routes/gaming.ts` - Using unifiedStorage ✅
- [x] `server/ai-studio-routes.ts` - Using unifiedStorage ✅
- [x] `server/gaming-nft-routes.ts` - Updated to use unifiedStorage ✅
- [x] GCS files removed (gcs-storage.ts, gcs-upload.ts) ✅
- [x] `.env` updated with BLOB_READ_WRITE_TOKEN ✅
- [x] `package.json` - @vercel/blob installed, @google-cloud/storage removed ✅

### Run TypeScript Check
```bash
npm run check
```

### Run Local Build Test
```bash
npm run build
```

---

## 4. Database Migration (IMPORTANT)

### Run Migration to Add `overall_score` Column
```bash
npm run db:push
```

### Verify Migration
```bash
npx tsx --env-file=.env check-migration-status.ts
```
Should show: ✅ overall_score column EXISTS

---

## Deployment Commands

### Deploy to Production
```bash
vercel --prod
```

### Or via Git Push (Recommended)
```bash
git add .
git commit -m "Migrate to Vercel Blob storage"
git push origin main
```
Vercel will auto-deploy from GitHub

---

## Post-Deployment Testing

### 1. Check Deployment Status
- Go to Vercel Dashboard
- Verify deployment succeeded
- Check build logs for errors

### 2. Test Storage Endpoints

#### Upload Profile Picture
```bash
curl -X POST https://your-domain.vercel.app/api/gaming/players/profile-picture \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@profile.png"
```
✅ Should return URL like: `https://xyz.public.blob.vercel-storage.com/profile/abc-123.png`

#### Generate Battle Image
```bash
curl -X POST https://your-domain.vercel.app/api/gaming/nfts/1/battle-image \
  -H "Authorization: Bearer YOUR_TOKEN"
```
✅ Should return Vercel Blob URL

#### AI Studio Image
```bash
curl -X POST https://your-domain.vercel.app/api/ai/studio/create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "medieval knight"}'
```
✅ Should return Vercel Blob URL

### 3. Verify Blob Storage Dashboard
- Go to Vercel Dashboard → Storage → Blob
- Check that files are appearing
- Monitor storage usage

### 4. Test Database Connection
```bash
curl https://your-domain.vercel.app/api/gaming/leaderboard
```
✅ Should return player leaderboard data

---

## Troubleshooting

### Issue: "BLOB_READ_WRITE_TOKEN is not defined"
**Fix**: 
1. Go to Vercel Dashboard → Settings → Environment Variables
2. Add `BLOB_READ_WRITE_TOKEN` with your token
3. Redeploy (or click "Redeploy" in Vercel Dashboard)

### Issue: "Failed to upload to blob storage"
**Fix**:
1. Verify token format: `vercel_blob_rw_XXXXXXXXXXXXX`
2. Check file size < 10MB
3. Verify MIME type is allowed (jpeg, png, gif, webp)
4. Check Vercel Dashboard → Storage → Blob for errors

### Issue: "overall_score column does not exist"
**Fix**:
1. Run migration via Vercel CLI:
   ```bash
   vercel env pull .env.production
   npm run db:push
   ```
2. Or manually add column to Neon database

### Issue: Build fails with TypeScript errors
**Fix**:
1. Run locally: `npm run check`
2. Fix any errors
3. Commit and redeploy

---

## Rollback Plan

If deployment fails:

### 1. Roll Back in Vercel
- Go to Vercel Dashboard → Deployments
- Find previous working deployment
- Click "Promote to Production"

### 2. Revert Code Changes (if needed)
```bash
git revert HEAD
git push origin main
```

### 3. Re-enable GCS (if absolutely necessary)
```bash
git revert <migration-commit-hash>
npm install @google-cloud/storage
# Add GCS env vars back
git push origin main
```

---

## Success Criteria ✅

- [ ] Deployment succeeded in Vercel
- [ ] No build errors in logs
- [ ] `BLOB_READ_WRITE_TOKEN` is set in Vercel environment
- [ ] Profile picture upload works
- [ ] Battle image generation works
- [ ] AI Studio image creation works
- [ ] All images return `blob.vercel-storage.com` URLs
- [ ] Database migration completed (overall_score exists)
- [ ] Leaderboard endpoint returns data
- [ ] No errors in Vercel runtime logs

---

## Post-Deployment Tasks

1. **Monitor Vercel Logs**
   - Check for runtime errors
   - Monitor storage operations

2. **Test All Features**
   - User registration
   - Wallet connection
   - NFT uploads
   - Battle system
   - Leaderboard

3. **Update Documentation**
   - Update README with new storage info
   - Document Vercel Blob token setup

4. **Set Up Monitoring**
   - Vercel Analytics
   - Error tracking (Sentry recommended)
   - Storage usage alerts

---

**Ready to Deploy?** ✅  
Run: `vercel --prod`
