# Environment Configuration Guide

## 📋 Overview

Your project uses **ONE main `.env` file** for all configuration. All other `.env.*` files are just templates or examples.

## ✅ Active Configuration File

**`.env`** - This is your ONLY active environment file. All settings are here.

## 📚 Template Files (Not Used)

These are example/template files only - the app doesn't load them:

- `.env.example` - Template showing what variables are needed
- `.env.android` - Example for Android builds
- `.env.ios` - Example for iOS builds  
- `.env.windows` - Example for Windows
- `.env.production` - Example production settings
- `.env.vercel.example` - Example for Vercel deployment
- `.env.broker.template` - Template for broker configuration
- `.env.gcs.example` - Template for Google Cloud Storage

## 🔑 Key Configuration Sections

### 1. Server
```env
NODE_ENV=development
PORT=5000
SESSION_SECRET="your-secret-key"
```

### 2. Database (NEW Neon Instance)
```env
DATABASE_URL=postgresql://...ep-long-shape...
```
✅ **Note**: You're now on the NEW database instance

### 3. Blockchain Wallets
```env
ETHEREUM_BANK_PRIVATE_KEY="0x..."
SOLANA_BANK_PRIVATE_KEY="..."
RIDDLE_BROKER_ADDRESS="r..."
```

### 4. API Keys
```env
OPENAI_API_KEY="sk-proj-..."
ONE_INCH_API_KEY="..."
BITHOMP_API_KEY="..."
```

### 5. Storage
```env
USE_GCS="true"
GCS_BUCKET_NAME="riddleswap"
```

## 🚀 Quick Start

1. Your `.env` file is already configured and working
2. All services are connected
3. Database migration complete
4. NFT scanner ready

## ⚠️ Important Notes

- **DO NOT** commit `.env` to Git (it's in `.gitignore`)
- Template files (`.env.*`) are safe to commit as examples
- Only `.env` is loaded by the application
- For production, copy `.env` and update sensitive values

## 📊 Database Status

✅ Connected to: **ep-long-shape-adphvnz2-pooler.c-2.us-east-1.aws.neon.tech**
✅ Contains: 5,967 NFTs, 16 collections, 134 wallets, 229 tokens
✅ NFT rarity rankings: Complete

## 🛠️ Need to Update?

Just edit `.env` directly - it's the only file that matters for running the app.
