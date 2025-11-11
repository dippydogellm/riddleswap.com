# 🚨 CRITICAL: Bithomp API Key Required

## Test Results Summary
**ALL 13 COLLECTIONS FAILED** - HTTP 403 "errors.token.required"

```
✅ Successful: 0/13
❌ Failed: 13/13
```

## Root Cause
The Bithomp API v2 **requires authentication** via API key header. All requests without valid token return HTTP 403.

## Current Environment Issue
```bash
$ echo $env:BITHOMP_API_KEY
Y
```

The current BITHOMP_API_KEY value is just "Y" which is **invalid**.

## How The System Uses Bithomp

### 1. Header Authentication
All Bithomp API calls include:
```typescript
headers: {
  'x-bithomp-token': process.env.BITHOMP_API_KEY || '',
  'User-Agent': 'RiddleSwap/1.0',
  'Accept': 'application/json'
}
```

### 2. Files Using Bithomp API (40+ locations)
- `server/services/nft-ownership-scanner.ts` - Main NFT scanner
- `server/routes.ts` - Multiple marketplace endpoints
- `server/bithomp-override-routes.ts` - Override endpoints
- `server/inquiry-collection-routes.ts` - Collection routes
- `server/lib/balance-aggregator.ts` - Balance checking
- `server/nft-marketplace-routes.ts` - Marketplace operations

### 3. API Endpoints Used
```
GET https://bithomp.com/api/v2/nfts?issuer={ISSUER}&taxon={TAXON}&assets=true&limit=10
GET https://bithomp.com/api/v2/nft/{NFTTOKEN_ID}?assets=true
GET https://bithomp.com/api/v2/nft-offers/{WALLET}?list=buy&offersValidate=true&nftoken=true
GET https://bithomp.com/api/v2/account/{ADDRESS}
```

## What Requires Valid API Key

### ✅ These Features Work Without Bithomp
- User authentication / login
- Wallet connections
- Local database queries
- Frontend rendering
- Squadron power calculations (from database)

### ❌ These Features FAIL Without Bithomp
- 🔴 **NFT Ownership Scanner** - Cannot fetch user's NFTs
- 🔴 **Gaming Dashboard** - No NFT data to display
- 🔴 **Squadron System** - Cannot populate squadrons with NFTs
- 🔴 **Collection Statistics** - Cannot update NFT counts/power
- 🔴 **Marketplace** - Cannot list/verify NFT offers
- 🔴 **Wallet Balance** - Cannot fetch XRP balances
- 🔴 **NFT Metadata** - Cannot get images/attributes

## How To Get Bithomp API Key

### Option 1: Bithomp Dashboard
1. Visit https://bithomp.com
2. Sign in or create account
3. Navigate to API section
4. Generate new API key
5. Copy the key (starts with something like `bt_...`)

### Option 2: Contact Bithomp
- Email: support@bithomp.com
- Request API access for XRPL NFT queries
- Mention you need: `/nfts`, `/nft/{id}`, `/account` endpoints

## How To Set The API Key

### Windows PowerShell (.env.windows)
```powershell
# Edit .env.windows
BITHOMP_API_KEY=your_actual_bithomp_api_key_here

# Set environment variable
$env:BITHOMP_API_KEY="your_actual_bithomp_api_key_here"
```

### Linux/Mac (env file)
```bash
export BITHOMP_API_KEY="your_actual_bithomp_api_key_here"
source ./env
```

### Vercel Production
```bash
# In Vercel dashboard: Settings → Environment Variables
BITHOMP_API_KEY=your_actual_bithomp_api_key_here
```

## Testing After Setting Key

### 1. Verify Environment Variable
```powershell
echo $env:BITHOMP_API_KEY
# Should show full API key, not just "Y"
```

### 2. Test Single Collection
```powershell
node test-bithomp-collections.js
```

### 3. Test Real Scanner
```powershell
# Start server
npm run dev

# Scan your wallet via API
curl http://localhost:5000/api/gaming/player/scan-wallet-nfts \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Impact on Current Issues

### Issue 1: dippydoge's squadrons show 0 power
**Root Cause**: No NFT data in database because scanner cannot fetch from Bithomp
**Fix**: Set valid API key → Run wallet scan → Database populated → Squadrons show power

### Issue 2: Gaming dashboard empty
**Root Cause**: Same - no NFT data without Bithomp access
**Fix**: Same as above

### Issue 3: Collection statistics wrong
**Root Cause**: Cannot verify NFT counts without Bithomp
**Fix**: Valid API key allows accurate collection stats

## Alternative Solutions (If Cannot Get API Key)

### Option A: Use XRPL Native Queries
Replace Bithomp with direct XRPL node queries:
```typescript
// Instead of Bithomp API
const xrplClient = new xrpl.Client('wss://xrplcluster.com');
await xrplClient.connect();
const nfts = await xrplClient.request({
  command: 'account_nfts',
  account: walletAddress
});
```

**Pros**: Free, no API key needed
**Cons**: More complex, requires parsing NFT metadata URIs manually

### Option B: Mock Data For Development
Create mock NFT data for testing:
```typescript
// test-data/mock-nfts.ts
export const MOCK_DIPPYDOGE_NFTS = [
  {
    nftokenID: 'mock-nft-1',
    issuer: 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH',
    taxon: 0,
    metadata: { name: 'The Inquisition #1', ... }
  }
];
```

**Pros**: Immediate testing
**Cons**: Not real data, won't work in production

### Option C: Rate-Limited Free Tier
Check if Bithomp offers free tier with rate limits:
- Might allow 100 requests/day
- Enough for development/testing
- Upgrade to paid for production

## Next Steps

1. **IMMEDIATE**: Get valid Bithomp API key
2. Set key in environment: `.env.windows` or `$env:BITHOMP_API_KEY`
3. Restart server to load new env var
4. Run test script: `node test-bithomp-collections.js`
5. Verify all 13 collections now return HTTP 200
6. Run wallet scanner for dippydoge: POST `/api/gaming/player/scan-wallet-nfts`
7. Check gaming dashboard - should now show NFTs and power scores

## Verification Checklist

- [ ] BITHOMP_API_KEY set in environment (not "Y")
- [ ] Environment variable shows full key when echoed
- [ ] Server restarted after setting key
- [ ] Test script shows HTTP 200 (not 403) for collections
- [ ] Test script reports NFTs found in collections
- [ ] Wallet scanner successfully fetches NFTs
- [ ] Database tables populated: gaming_nfts, player_nft_ownership
- [ ] Gaming dashboard displays NFTs with images/power
- [ ] Squadron detail pages show calculated power totals
- [ ] dippydoge sees their actual NFTs and squadrons

## Estimated Time to Fix

- Get API key: **5-30 minutes** (depends on Bithomp approval)
- Set environment: **1 minute**
- Test and verify: **5-10 minutes**
- Full data population: **2-5 minutes** (depends on NFT count)

**Total: ~15-45 minutes from API key acquisition**

---

**Status**: 🔴 **BLOCKED** - Cannot proceed without valid Bithomp API key
**Priority**: 🚨 **CRITICAL** - Entire NFT gaming system depends on this
**Owner**: Need Bithomp account access or alternative XRPL data source
