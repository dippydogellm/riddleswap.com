# Quick Vercel Deployment Commands

## ✅ Prerequisites Complete
- Vercel CLI v48.9.0 installed
- All environment variables ready in `.env.vercel.example`
- Production build tested and passing

---

## 🚀 Deploy Now

### Step 1: Login to Vercel
```powershell
vercel login
```
Follow the prompts to authenticate.

---

### Step 2: Link Project (First Time Only)
```powershell
vercel link
```
- Select scope: Your Vercel account/team
- Link to existing project? Choose "No" (or "Yes" if already created)
- Project name: Enter `riddleswap` (or your preferred name)
- Directory: Press Enter (current directory)

---

### Step 3: Set Environment Variables

**Option A: Via Vercel Dashboard (Recommended)**
1. Go to https://vercel.com/dashboard
2. Select your project
3. Go to Settings → Environment Variables
4. Copy values from `.env.vercel.example` file
5. Add each variable for "Production", "Preview", and "Development"

**Option B: Via CLI (Faster)**
```powershell
# Required variables
vercel env add DATABASE_URL production
vercel env add BITHOMP_API_KEY production
vercel env add SESSION_SECRET production
vercel env add NODE_ENV production

# Trading & Wallet
vercel env add RIDDLE_BROKER_ADDRESS production
vercel env add BROKER_WALLET_SEED production
vercel env add ONE_INCH_API_KEY production
vercel env add XUMM_API_KEY production
vercel env add XUMM_API_SECRET production

# WalletConnect
vercel env add VITE_WALLETCONNECT_PROJECT_ID production
vercel env add WALLETCONNECT_PROJECT_ID production

# Storage
vercel env add USE_GCS production
vercel env add GCS_BUCKET_NAME production
vercel env add GCS_PROJECT_ID production
vercel env add GCS_KEY_JSON production
```

When prompted, paste the values from `.env.vercel.example`.

---

### Step 4: Deploy to Production
```powershell
vercel --prod
```

This will:
1. Build your application
2. Upload to Vercel
3. Deploy to production URL
4. Give you the deployment URL

---

## 📊 Monitor Deployment

### View Build Logs
```powershell
vercel logs
```

### Check Deployment Status
```powershell
vercel ls
```

### View Production URL
After deployment completes, you'll see:
```
✅ Production: https://your-app.vercel.app
```

---

## 🧪 Test Deployment

Visit these URLs after deployment:

1. **Homepage**: `https://your-app.vercel.app`
2. **Wallet**: `https://your-app.vercel.app/wallet-login`
3. **Trading**: `https://your-app.vercel.app/trade-v3`
4. **NFT Detail**: `https://your-app.vercel.app/xrp-wallet-redesigned`

---

## ⚡ Quick Commands Reference

```powershell
# Deploy preview (test first)
vercel

# Deploy to production
vercel --prod

# View logs
vercel logs

# List deployments
vercel ls

# Open dashboard
vercel

# Add environment variable
vercel env add VARIABLE_NAME production

# List environment variables
vercel env ls

# Remove deployment
vercel rm [deployment-url]

# Open project settings
vercel settings
```

---

## 🎯 Your Deployment URL Will Be:
`https://riddleswap.vercel.app` (or your custom domain)

Make note of this URL - you'll need to update `VITE_API_URL` environment variable with it!

---

## 📝 Post-Deployment Tasks

After first deployment:
1. ✅ Update `VITE_API_URL` env var with your Vercel URL
2. ✅ Test all features (wallet, trading, NFTs)
3. ✅ Verify images load from Bithomp CDN
4. ✅ Check API endpoints are working
5. ✅ Set up custom domain (optional)

---

## 🚨 Important Notes

- **First deployment might take 2-3 minutes** (subsequent deploys are faster)
- **Preview deployments** are created automatically for all git pushes
- **Production deployments** only happen when you run `vercel --prod`
- **Environment variables** changes require redeployment
- **Free tier** includes 100GB bandwidth/month

---

## 🎉 You're Ready!

Run: `vercel --prod` when ready to deploy! 🚀
