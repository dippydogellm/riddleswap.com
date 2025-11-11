# ✈️ PRE-FLIGHT DEPLOYMENT CHECKLIST

## 📋 Before You Deploy

### ✅ Code Ready
- [x] All TypeScript errors fixed
- [x] Database migrated to new Neon instance
- [x] NFT scanner completed (5,967 NFTs ranked)
- [x] Environment variables consolidated
- [ ] Build test passes locally

### ✅ Database Ready
- [x] New database: `ep-long-shape-adphvnz2-pooler.c-2.us-east-1.aws.neon.tech`
- [x] 5,967 NFTs with rarity ranks
- [x] 16 gaming collections
- [x] 134 wallets
- [x] 229 tokens
- [x] All migrations complete

### ✅ Environment Variables
Check these are set in Vercel Dashboard:

#### Critical (Must Have)
- [ ] `DATABASE_URL` - NEW connection string
- [ ] `SESSION_SECRET`
- [ ] `NODE_ENV=production`
- [ ] `BITHOMP_API_KEY`

#### Blockchain Wallets
- [ ] `RIDDLE_BROKER_ADDRESS`
- [ ] `BROKER_WALLET_SEED`
- [ ] `BANK_RDL_PRIVATE_KEY`
- [ ] `ETHEREUM_BANK_PRIVATE_KEY`
- [ ] `SOLANA_BANK_PRIVATE_KEY`

#### Frontend (VITE_ prefix required)
- [ ] `VITE_WALLETCONNECT_PROJECT_ID`
- [ ] `VITE_FEE_WALLET_EVM`
- [ ] `VITE_WALLET_CONNECTION_TIMEOUT`

#### API Keys
- [ ] `ONE_INCH_API_KEY`
- [ ] `WALLETCONNECT_PROJECT_ID`
- [ ] `XUMM_API_KEY`
- [ ] `XUMM_API_SECRET`
- [ ] `NFT_STORAGE_TOKEN`

#### Storage
- [ ] `USE_GCS=true`
- [ ] `GCS_BUCKET_NAME`
- [ ] `GCS_PROJECT_ID`
- [ ] `GCS_KEY_JSON`

#### Optional
- [ ] `OPENAI_API_KEY` (for AI features)
- [ ] `TELEGRAM_BOT_TOKEN` (for notifications)

## 🚀 Deployment Steps

### 1. Test Build Locally
```powershell
cd "c:\Users\E-Store\Desktop\riddlezip\riddle-main"
npm run build
```

Expected output:
- `dist/public/` folder created
- `dist/index.js` file created
- No errors

### 2. Run Pre-Deployment Script
```powershell
.\deploy-vercel.ps1
```

This will:
- ✅ Check Vercel CLI
- ✅ Run TypeScript check
- ✅ Build the project
- ✅ Show build size
- 🚀 Optionally deploy

### 3. Deploy

#### Option A: Vercel Dashboard (Recommended for first time)
1. Push code to GitHub
2. Go to vercel.com/dashboard
3. Import your repository
4. Add environment variables
5. Deploy

#### Option B: CLI Deploy
```powershell
# Preview deployment (test first)
vercel

# Production deployment
vercel --prod
```

## 📊 Post-Deployment Tests

Test these URLs after deployment:

### Health Checks
- `https://your-app.vercel.app/` - Homepage loads
- `https://your-app.vercel.app/api/health` - API health
- `https://your-app.vercel.app/api/status` - Database connection

### Core Features
- `https://your-app.vercel.app/swap` - Swap page loads
- `https://your-app.vercel.app/gaming` - Gaming page loads
- `https://your-app.vercel.app/api/gaming/nfts?limit=10` - NFT data

### Wallet Connection
- Connect wallet works
- Sign transaction works
- View NFTs works

### Trading
- Token search works
- Swap quotes work
- Execute swap works

## ⚠️ Important Notes

### Database Connection String
Make sure you're using the **NEW** database:
```
postgresql://neondb_owner:npg_Z9NCJE2Xdzet@ep-long-shape-adphvnz2-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

### VITE_ Variables
Frontend environment variables MUST have `VITE_` prefix to be available in the browser.

### Google Cloud Storage
Make sure `GCS_KEY_JSON` is properly formatted (entire JSON on one line).

### Rate Limiting
Consider enabling rate limiting in production for API endpoints.

## 🐛 Troubleshooting

### Build Fails
```powershell
# Check TypeScript errors
npm run check

# Clean build
rm -r dist
npm run build
```

### Environment Variables Not Working
1. Check spelling (case-sensitive)
2. Verify VITE_ prefix for frontend vars
3. Redeploy after changing env vars
4. Check Vercel logs: `vercel logs`

### Database Connection Errors
1. Verify DATABASE_URL is correct
2. Check Neon database status
3. Test connection locally first

### API 404 Errors
1. Check `vercel.json` routes
2. Verify server build succeeded
3. Check function logs in Vercel dashboard

## 📈 Monitoring

After deployment, monitor:
- Function logs in Vercel dashboard
- Database connections in Neon dashboard
- Error tracking
- Performance metrics

## ✅ Deployment Checklist

Before going live:
- [ ] All environment variables set
- [ ] Build test passes
- [ ] Health checks pass
- [ ] Wallet connection works
- [ ] Swap functionality works
- [ ] NFT data displays correctly
- [ ] Images load (GCS working)
- [ ] No console errors
- [ ] Mobile responsive
- [ ] Performance acceptable

## 🎯 Ready to Deploy!

Current status:
✅ Code: Ready
✅ Database: Migrated & populated
✅ Environment: Consolidated
✅ TypeScript: No errors
✅ NFT Data: 5,967 NFTs ranked

You're ready to deploy! Run:
```powershell
.\deploy-vercel.ps1
```
