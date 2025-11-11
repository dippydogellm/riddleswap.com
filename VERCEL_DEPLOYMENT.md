# 🚀 Vercel Deployment Guide

## Prerequisites

✅ New database migrated and working
✅ All TypeScript errors fixed
✅ Environment variables consolidated

## Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

## Step 2: Login to Vercel

```bash
vercel login
```

## Step 3: Build Test (Local)

Test the production build locally before deploying:

```bash
npm run build
```

This should create:
- `dist/public/` - Frontend assets
- `dist/index.js` - Server bundle

## Step 4: Set Environment Variables in Vercel

Go to your Vercel project settings and add these environment variables:

### 🔴 CRITICAL - Must Set These

```env
DATABASE_URL=__SET_IN_VERCEL_DASHBOARD__
SESSION_SECRET=__SET_IN_VERCEL_DASHBOARD__
NODE_ENV=production
BITHOMP_API_KEY=__SET_IN_VERCEL_DASHBOARD__
```

### 🟡 Blockchain Wallets

```env
RIDDLE_BROKER_ADDRESS=__SET_IN_VERCEL_DASHBOARD__
BROKER_WALLET_SEED=__SET_IN_VERCEL_DASHBOARD__
RIDDLE_BROKER_SECRET=__SET_IN_VERCEL_DASHBOARD__
BANK_RDL_PRIVATE_KEY=__SET_IN_VERCEL_DASHBOARD__
ETHEREUM_BANK_PRIVATE_KEY=__SET_IN_VERCEL_DASHBOARD__
SOLANA_BANK_PRIVATE_KEY=__SET_IN_VERCEL_DASHBOARD__
```

### 🟢 Frontend Variables (VITE_)

```env
VITE_WALLETCONNECT_PROJECT_ID=__SET_IN_VERCEL_DASHBOARD__
VITE_FEE_WALLET_EVM=__SET_IN_VERCEL_DASHBOARD__
VITE_WALLET_CONNECTION_TIMEOUT=600
```

### 🔵 API Keys

```env
ONE_INCH_API_KEY=__SET_IN_VERCEL_DASHBOARD__
WALLETCONNECT_PROJECT_ID=__SET_IN_VERCEL_DASHBOARD__
XUMM_API_KEY=__SET_IN_VERCEL_DASHBOARD__
XUMM_API_SECRET=__SET_IN_VERCEL_DASHBOARD__
NFT_STORAGE_TOKEN=__SET_IN_VERCEL_DASHBOARD__
TELEGRAM_BOT_TOKEN=__SET_IN_VERCEL_DASHBOARD__
TELEGRAM_CHANNEL_ID=__SET_IN_VERCEL_DASHBOARD__
```

### 🟣 Storage (Google Cloud)

```env
USE_GCS=true
STORAGE_BACKEND=gcs
GCS_BUCKET_NAME=__SET_IN_VERCEL_DASHBOARD__
GCS_PROJECT_ID=__SET_IN_VERCEL_DASHBOARD__
GCS_KEY_JSON=__SET_IN_VERCEL_DASHBOARD__
```

### 🟠 Optional - AI Features

```env
OPENAI_PROJECT=__SET_IN_VERCEL_DASHBOARD__
OPENAI_API_KEY=__SET_IN_VERCEL_DASHBOARD__
```

## Step 5: Deploy

### Option A: Deploy from GitHub (Recommended)

1. Push your code to GitHub
2. Connect your repo to Vercel
3. Vercel will auto-deploy on push

### Option B: Deploy with CLI

```bash
# First time
vercel

# Production deployment
vercel --prod
```

## Step 6: Verify Deployment

After deployment, test these endpoints:

```bash
# Health check
https://your-app.vercel.app/api/health

# Database check
https://your-app.vercel.app/api/status

# NFT data
https://your-app.vercel.app/api/gaming/nfts
```

## Quick Deploy Script

Create a file `deploy-vercel.ps1`:

```powershell
Write-Host "🚀 Starting Vercel Deployment..." -ForegroundColor Cyan

# Test build
Write-Host "📦 Building project..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Build successful!" -ForegroundColor Green

# Deploy to Vercel
Write-Host "🚀 Deploying to Vercel..." -ForegroundColor Cyan
vercel --prod

Write-Host "✅ Deployment complete!" -ForegroundColor Green
```

## Troubleshooting

### Build Fails
- Check TypeScript errors: `npm run check`
- Verify all imports are correct
- Check `vercel.json` configuration

### Environment Variables Not Working
- Make sure VITE_ prefix for frontend vars
- Check spelling (case-sensitive)
- Redeploy after changing env vars

### Database Connection Fails
- Verify DATABASE_URL is correct
- Check Neon database is accessible
- Ensure connection pooling is enabled

### API Routes 404
- Check `vercel.json` routes configuration
- Verify server/index.ts is building correctly

## Post-Deployment Checklist

- [ ] Frontend loads correctly
- [ ] API endpoints respond
- [ ] Database connection works
- [ ] Wallet connection functions
- [ ] NFT data displays
- [ ] Trading/swapping works
- [ ] Image uploads work (GCS)

## Monitoring

Set up monitoring in Vercel dashboard:
- Function logs
- Analytics
- Error tracking

## Important Notes

⚠️ **NEW DATABASE**: You're now using the new Neon instance
- Host: `ep-long-shape-adphvnz2-pooler.c-2.us-east-1.aws.neon.tech`
- 5,967 NFTs with rarity ranks
- All data migrated successfully

✅ **Ready for Production**:
- TypeScript errors: Fixed
- Database: Migrated
- NFT rankings: Complete
- Environment: Consolidated

🎯 **Performance**:
- Use edge functions where possible
- Enable caching headers
- Optimize images
- Use CDN for static assets

---

**Need help?** Check Vercel docs: https://vercel.com/docs
