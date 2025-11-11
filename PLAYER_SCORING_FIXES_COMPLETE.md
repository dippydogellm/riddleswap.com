# Player Scoring System - Complete Fixes Applied

## Issues Identified & Resolved

### 1. ✅ NFT Join Mismatch (CRITICAL)
**Problem**: `gaming_nfts.nft_id` contains issuer+taxon+sequence format, but `inquisition_user_ownership.nft_token_id` is just the token hash.
- **Diagnostic**: 4,144 out of 4,544 ownership entries had no matching gaming_nfts record (91% missing!)
- **Fix**: Changed join from `gaming_nfts.nft_id` to `gaming_nfts.token_id` to match ownership table format
- **Location**: `player-scoring-scanner.ts` line ~199

### 2. ✅ Wallet-Only Players Excluded
**Problem**: Only 15 players with `user_handle` were scored, but 590 wallet addresses had no handle mapping.
- **Fix**: Added wallet address resolution logic mapping addresses to `riddle_wallets` handles
- **Fix**: Created synthetic handles for unmatched wallets (`wallet:xxxxx…xxxx`)
- **Location**: `player-scoring-scanner.ts` lines ~75-110

### 3. ✅ Duplicate Player Records
**Problem**: `dippydoge` had 2 entries in `gaming_players`
- **Fix**: Switched from separate insert/update logic to Postgres upsert with `ON CONFLICT DO UPDATE`
- **Fix**: Created deduplication script to clean existing duplicates
- **Location**: `player-scoring-scanner.ts` line ~397, `scripts/dedupe-gaming-players.ts`

### 4. ✅ Missing overall_score Field
**Problem**: Calculated scores weren't being persisted to database
- **Fix**: Added `overall_score: integer` field to `gaming_players` schema
- **Fix**: Updated upsert to save `Math.round(entry.overall_score)`
- **Location**: `shared/schema.ts` line ~376, `player-scoring-scanner.ts` line ~412

### 5. ✅ Wallet Address Linkage
**Problem**: Players weren't linked to their primary wallet addresses
- **Fix**: Resolve primary wallet from `riddle_wallets` (linked > xrp > eth > sol > btc priority)
- **Fix**: Always save `wallet_address` during upsert
- **Location**: `player-scoring-scanner.ts` lines ~222-230, ~410

### 6. ✅ Missing API Endpoints
**Problem**: No frontend endpoints for leaderboard or player stats
- **Fix**: Added `GET /api/gaming/leaderboard` with pagination and Twitter handles
- **Fix**: Added `GET /api/gaming/player/:handle` with rank calculation
- **Location**: `server/routes/gaming.ts` new endpoints before `/collections/all`

## Database Schema Changes Required

```sql
-- Add overall_score field
ALTER TABLE gaming_players 
ADD COLUMN overall_score INTEGER DEFAULT 0;

-- Create index for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_gaming_players_score 
ON gaming_players(overall_score DESC, total_power_level DESC);
```

## Scripts Created

### `scripts/diagnose-player-scoring.ts`
- Counts distinct owners by handle vs wallet-only
- Reports missing `gaming_nfts` joins
- Identifies duplicate handles
- Checks for missing wallet addresses

### `scripts/dedupe-gaming-players.ts`
- Removes duplicate `user_handle` entries
- Keeps most recent `updated_at` record per handle

### `scripts/query-duplicates.ts`
- Quick query to check for duplicate handles

## Current State (Before Re-run)

**From Diagnostics**:
- 15 players with handles
- 590 wallet-only addresses 
- **Expected after fix**: ~605 total participants
- 4,144 ownership entries had missing NFT joins (now fixed with token_id join)

**From Database**:
- 237 total `gaming_players` rows (many outdated/incomplete)
- Top player: `bowser` (282,860 power, 76 NFTs)
- 1 duplicate handle resolved

## Ready to Run

### Step 1: Apply Schema Migration
```bash
npm run db:push
```

### Step 2: Deduplicate Existing Records
```bash
npx tsx --env-file=.env -r tsconfig-paths/register scripts/dedupe-gaming-players.ts
```

### Step 3: Run Player Scoring Scanner
```bash
npm run scan:players
```

### Step 4: Verify Results
```bash
# Check player count
npx tsx --env-file=.env -r tsconfig-paths/register -e "import { db } from './server/db'; import { gamingPlayers } from './shared/schema'; (async()=>{ const count = await db.select({c: gamingPlayers.id}).from(gamingPlayers); console.log('Total players:', count.length); process.exit(0); })();"

# Check top 10 leaderboard
npx tsx --env-file=.env -r tsconfig-paths/register -e "import { db } from './server/db'; import { gamingPlayers } from './shared/schema'; import { desc } from 'drizzle-orm'; (async()=>{ const rows = await db.select().from(gamingPlayers).orderBy(desc(gamingPlayers.overall_score)).limit(10); console.log(rows.map(r=>({handle:r.user_handle, score:r.overall_score, power:r.total_power_level, nfts:r.total_nfts_owned}))); process.exit(0); })();"
```

## API Endpoints Available

### GET /api/gaming/leaderboard
**Query Parameters**:
- `limit` (default: 100, max: 500)
- `offset` (default: 0)

**Response**:
```json
{
  "success": true,
  "data": {
    "leaderboard": [
      {
        "rank": 1,
        "user_handle": "bowser",
        "player_name": "Bowser",
        "wallet_address": "rXXX...",
        "total_nfts": 76,
        "total_power": "282860.00",
        "overall_score": 2850,
        "gaming_rank": "Champion",
        "twitter_handle": "@bowser_xrpl",
        "riddle_profile_url": "https://riddleswap.com/@bowser"
      }
    ],
    "total": 100,
    "limit": 100,
    "offset": 0
  }
}
```

### GET /api/gaming/player/:handle
**Response**:
```json
{
  "success": true,
  "data": {
    "user_handle": "bowser",
    "rank": 1,
    "total_nfts_owned": 76,
    "total_power_level": "282860.00",
    "overall_score": 2850,
    "twitter_handle": "@bowser_xrpl",
    "riddle_profile_url": "https://riddleswap.com/@bowser"
  }
}
```

## System is Ready

All critical fixes applied:
✅ Join corrected (token_id vs nft_id)
✅ Wallet resolution implemented
✅ Upsert enforces uniqueness
✅ overall_score field added
✅ Wallet addresses linked
✅ API endpoints created
✅ Diagnostics & deduplication scripts ready

**DO NOT RUN** `npm run scan:players` until after running `npm run db:push` to apply schema changes.
