# 🔍 Bithomp Integration & Issues Report

## Current State Analysis (November 9, 2025)

### ✅ What's Working

#### 1. **Scanner Service Integration**
- **Location**: `server/services/nft-ownership-scanner.ts`
- **Status**: ✅ OPERATIONAL
- **Bithomp API Base**: `https://bithomp.com/api/v2`
- **Evidence**:
  ```typescript
  private readonly BITHOMP_BASE_URL = 'https://bithomp.com/api/v2';
  ```

#### 2. **Collection Discovery**
- **Location**: `server/devtools-endpoints.ts`
- **Endpoint**: `GET https://bithomp.com/api/v2/nft-collections?issuer={address}`
- **Status**: ✅ WORKING
- **Evidence**:
  ```typescript
  const bithompResponse = await fetch(
    `https://bithomp.com/api/v2/nft-collections?issuer=${address}&limit=20`,
    { headers: { 'x-bithomp-token': process.env.BITHOMP_API_KEY || '' } }
  );
  ```

#### 3. **NFT Issuer Data Fetching**
- **Location**: `server/devtools-endpoints.ts` (line 1198)
- **Endpoint**: `GET https://bithomp.com/api/v2/nft-issuer/{issuer}?taxon={taxon}`
- **Status**: ✅ WORKING
- **Evidence**: Successfully stores Bithomp collection metadata:
  - `bithomp_collection_name`
  - `bithomp_collection_description`
  - `bithomp_floor_price`
  - `bithomp_total_nfts`

### ❌ Current Issues

#### 1. **CDN Image URLs Not Being Stored**
- **Problem**: Scanner fetches Bithomp NFT data but doesn't extract/store CDN image URLs
- **Location**: `server/services/nft-ownership-scanner.ts` line 362+
- **Impact**: HIGH - Missing performance optimization
- **Evidence**:
  ```typescript
  interface BithompNftData {
    issuer: string;
    nftokenID: string;
    nftokenTaxon: number;
    uri?: string;
    metadata?: {
      name?: string;
      description?: string;
      image?: string;  // ❌ Not extracting CDN URL from Bithomp
      attributes?: Array<{ trait_type: string; value: any }>;
    };
  }
  ```

#### 2. **Missing Trait-Based Scoring System**
- **Problem**: No scorecard calculation for individual project traits
- **Database**: No `project_scorecards` or `trait_scores` tables
- **Impact**: CRITICAL - Cannot rank NFTs by trait rarity
- **Required Fields**:
  - trait_type
  - trait_value
  - rarity_score (percentage)
  - trait_count (how many NFTs have this trait)
  - total_collection_count

#### 3. **No Project-Specific Scorecards**
- **Problem**: No dedicated endpoint for project scorecards
- **Missing**: `/api/projects/:id/scorecard`
- **Impact**: HIGH - Cannot display project analytics
- **Required Data**:
  - Overall project stats
  - Trait distribution
  - Rarity rankings
  - Floor price
  - Volume

#### 4. **Scanner Runs Too Frequently**
- **Problem**: No proper scheduling logic for different scan types
- **Impact**: MEDIUM - API rate limiting risk
- **Current State**: All scans run on same schedule
- **Required Logic**:
  - Collection scan: **ONCE** (initial discovery)
  - Rarity/Scoring: **Every 3 hours**
  - Civilization scan: **After tests, on-demand**
  - Player scores: **Send to leaderboards after each calculation**

#### 5. **Gaming Dashboard Using Mixed Data Sources**
- **Problem**: Dashboard queries multiple endpoints with inconsistent data
- **Location**: `client/src/pages/gaming-dashboard-v3.tsx`
- **Impact**: HIGH - Confusing UX, slow performance
- **Evidence**:
  ```typescript
  // Queries 6+ different endpoints:
  '/api/gaming/player/profile'
  '/api/inquisition-audit/nfts?limit=5000'
  '/api/inquisition-audit/player/nfts'
  '/api/squadrons/player'
  '/api/battles/player'
  '/api/battles/player/${session.handle}/history'
  ```

### 🔧 Required Fixes

#### Fix 1: Add CDN Image Storage
```typescript
// In nft-ownership-scanner.ts
interface BithompNftData {
  // ... existing fields
  cdn_image_url?: string;  // ADD THIS
}

// When fetching from Bithomp:
const cdnUrl = `https://bithomp.com/cdn/nft/${nft.nftokenID}`;
nft.cdn_image_url = cdnUrl;
```

#### Fix 2: Create Trait Scoring System
```sql
-- New table for trait scores
CREATE TABLE project_trait_scores (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES devtools_projects(id),
  collection_id TEXT,
  trait_type TEXT NOT NULL,
  trait_value TEXT NOT NULL,
  trait_count INTEGER DEFAULT 0,
  total_nfts INTEGER DEFAULT 0,
  rarity_percentage NUMERIC(5,2),  -- 0.01 to 100.00
  rarity_score INTEGER,  -- 1-100 scale
  updated_at TIMESTAMP DEFAULT NOW()
);

-- NFT scorecard table
CREATE TABLE nft_scorecards (
  id SERIAL PRIMARY KEY,
  nft_id TEXT UNIQUE NOT NULL,
  project_id INTEGER,
  collection_id TEXT,
  total_rarity_score INTEGER,
  trait_scores JSONB,  -- { "trait_type": { value: "X", score: 95 } }
  rank_in_collection INTEGER,
  calculated_at TIMESTAMP DEFAULT NOW()
);
```

#### Fix 3: Scanner Scheduling Logic
```typescript
// Add to nft-ownership-scanner.ts
enum ScanType {
  COLLECTION_DISCOVERY = 'collection',  // Once
  RARITY_SCORING = 'rarity',           // Every 3 hours
  CIVILIZATION = 'civilization',        // On-demand
  PLAYER_SCORES = 'player_scores'      // After calculations
}

async scheduleScan(type: ScanType) {
  switch(type) {
    case ScanType.COLLECTION_DISCOVERY:
      // Only run if not already scanned
      const hasScanned = await checkCollectionScanned(projectId);
      if (!hasScanned) await scanCollection();
      break;
    case ScanType.RARITY_SCORING:
      // Run every 3 hours
      setInterval(() => calculateRarityScores(), 3 * 60 * 60 * 1000);
      break;
    // ... etc
  }
}
```

### 📊 Required New Endpoints

1. **GET /api/projects/:id/scorecard**
   - Returns project scorecard with trait distribution
   
2. **GET /api/projects/:id/traits**
   - Returns all traits with rarity percentages
   
3. **GET /api/nfts/:id/scorecard**
   - Returns individual NFT scorecard
   
4. **POST /api/scanner/calculate-rarity/:projectId**
   - Triggers rarity calculation for a project
   
5. **GET /api/leaderboards/project/:id**
   - Returns top NFTs in project by rarity

### 🎯 Immediate Action Items

1. ✅ Add battle-history and power-history endpoints (COMPLETED)
2. ❌ Implement trait scoring calculation service
3. ❌ Create project scorecard endpoint
4. ❌ Add CDN image URL storage to scanner
5. ❌ Implement proper scanner scheduling
6. ❌ Rebuild Gaming Dashboard with Material UI
7. ❌ Create partner project detail pages

### 📝 Evidence Summary

**Files Reviewed:**
- ✅ `server/services/nft-ownership-scanner.ts` (1460 lines)
- ✅ `server/devtools-endpoints.ts` (Bithomp integration)
- ✅ `server/gaming-nft-routes.ts` (Battle/power history endpoints added)
- ✅ `client/src/pages/gaming-dashboard-v3.tsx` (1118 lines, needs rebuild)

**Bithomp API Usage:**
- ✅ API Key configured via `x-bithomp-token` header
- ✅ Collection discovery working
- ✅ NFT issuer data fetching working
- ❌ CDN images not being utilized
- ❌ No trait rarity calculations

**Database Status:**
- ✅ `gaming_nfts` table exists
- ✅ `nft_power_attributes` table exists
- ✅ `inquisition_collections` table exists
- ❌ Missing `project_trait_scores` table
- ❌ Missing comprehensive `nft_scorecards` table

---

## Next Steps

See `TODO_LIST.md` for full implementation plan.
