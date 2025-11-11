# Database Schema Ready for Background NFT Scanner ✅

**Status**: All database tables and fields are configured and ready for the AI-powered NFT scanning system.

---

## Database Tables Verified

### 1. **gaming_nfts** (31 columns)
Stores individual NFT data with traits, images, and rarity scores.

**Key Fields**:
- `id`, `collection_id`, `token_id`, `nft_id` - Core identifiers
- `metadata`, `traits` - Raw NFT metadata and parsed traits (JSONB)
- `image_url` - CDN image URL (non-IPFS)
- `name`, `description` - NFT details
- `rarity_rank`, `rarity_score` - Calculated rarity metrics
- **`trait_rarity_breakdown`** (JSONB) - Per-trait rarity analysis ✅ ADDED
- `owner_address` - Current owner
- `game_stats` - Gaming-specific stats

### 2. **gaming_nft_collections** (25 columns)
Stores collection/project metadata with AI analysis.

**Key Fields**:
- `id`, `collection_id`, `collection_name` - Collection identifiers
- `issuer`, `taxon` - XRPL collection identifiers
- `game_role` - Gaming category (army, bank, power, merchant, special)
- `total_supply` - Total NFTs in collection
- `metadata_ingested` - Whether NFTs have been scanned
- **`ai_score`** (INTEGER) - AI-generated overall score ✅ ADDED
- **`ai_analysis`** (JSONB) - Detailed AI analysis ✅ ADDED
- `project_rarity_score`, `project_rarity_rank` - Collection-level rarity

### 3. **project_master_cards** (9 columns)
Master metadata for each project/collection in the AI scorecard system.

**Fields**:
- `id` (UUID) - Primary key
- `project_name` (UNIQUE) - Collection name
- `issuer_address`, `taxon` - XRPL identifiers
- `total_supply` - Number of NFTs
- `category` - Project category
- `description` - Project description
- `created_at`, `updated_at` - Timestamps

**Indexes**:
- `idx_project_master_cards_issuer_taxon` - Fast lookups by issuer+taxon

### 4. **project_score_cards** (12 columns)
AI-generated scorecards for individual trait types and values.

**Fields**:
- `id` (UUID) - Primary key
- `project_id` (FK to project_master_cards) - Parent project
- `trait_category` - Trait type (e.g., "Background", "Element")
- `trait_value` - Specific value (e.g., "Blue", "Fire")
- **`gaming_utility_score`** (INTEGER 0-100) - AI: Game utility
- **`visual_impact_score`** (INTEGER 0-100) - AI: Visual distinctiveness
- **`rarity_value_score`** (INTEGER 0-100) - Calculated: Based on frequency
- **`synergy_score`** (INTEGER 0-100) - AI: Combination potential
- **`overall_trait_score`** (INTEGER 0-100) - Weighted average
- **`ai_reasoning`** (TEXT) - AI explanation for scores
- `created_at`, `updated_at` - Timestamps

**Indexes**:
- `idx_project_score_cards_project` - Fast project lookups
- `idx_project_score_cards_trait` - Fast trait category lookups

**Constraints**:
- UNIQUE(project_id, trait_category, trait_value) - No duplicates
- CASCADE DELETE - Scorecards deleted when project deleted

---

## Migration Status

✅ **All migrations applied successfully**:

1. ✅ `add-ai-scoring-fields.sql` - Added ai_score and ai_analysis to collections
2. ✅ `create-project-scorecards.sql` - Created master and score card tables
3. ✅ `add-missing-scanner-fields.sql` - Added trait_rarity_breakdown to gaming_nfts

---

## Data Flow

```
1. Background Scanner Fetches NFTs from Bithomp API
   ↓
2. Store in gaming_nfts table
   - Individual NFT metadata
   - Parsed traits (per-collection parser)
   - CDN images (no IPFS)
   ↓
3. Calculate Rarity Scores
   - Frequency-based rarity per trait
   - Store in trait_rarity_breakdown
   ↓
4. AI Scores Traits (OpenAI GPT-4)
   - Score each trait_type + value individually
   - Gaming utility, visual impact, synergy
   ↓
5. AI Scores Collection
   - Overall collection analysis
   - Store in gaming_nft_collections.ai_analysis
   ↓
6. Generate Project Scorecards
   - Create project_master_cards entry
   - Create project_score_cards for each trait
   - Merge AI scores with rarity scores
```

---

## Scorecard Score Calculation

Each trait value gets scored on 4 dimensions:

1. **Gaming Utility Score** (0-100)
   - AI-powered: How useful is this trait in gameplay?
   - Example: "Warrior" class = 85, "Merchant" class = 70

2. **Visual Impact Score** (0-100)
   - AI-powered: How visually distinctive/appealing?
   - Example: "Golden" = 90, "Gray" = 60

3. **Rarity Value Score** (0-100)
   - Calculated: 100 / rarity_percentage
   - Example: 1% rarity = score 100, 50% rarity = score 2

4. **Synergy Score** (0-100)
   - AI-powered: How well does it combine with other traits?
   - Example: "Fire Element" + "Warrior" = high synergy

5. **Overall Trait Score** (0-100)
   - Weighted average: `(G + V + R + S) / 4`
   - Used for filtering/sorting traits by value

---

## OpenAI Integration

**Model**: `gpt-4-turbo-preview`

**API Format**:
```json
{
  "model": "gpt-4-turbo-preview",
  "messages": [
    {
      "role": "system",
      "content": "You are an NFT trait analyzer..."
    },
    {
      "role": "user",
      "content": "Score these traits..."
    }
  ],
  "response_format": { "type": "json_object" },
  "temperature": 0.3
}
```

**Response Example**:
```json
{
  "trait_type": "Background",
  "values": [
    {
      "value": "Blue Sky",
      "gaming_utility": 65,
      "visual_impact": 80,
      "rarity_value": 45,
      "synergy_potential": 70,
      "overall_score": 65,
      "reasoning": "Common but versatile background..."
    }
  ]
}
```

---

## Scanner Configuration

**8 Collections Configured**:

1. **The Inquisition** (taxon 2)
   - Issuer: `rPUpXwiW4wwcx4AooftCZUBMh1NmzHBjtu`
   - NFTs: ~1,162
   - Parser: Standard

2. **BunnyX** (taxon 1)
   - Issuer: `rQHhpAxeRjajAdcHuqkYGVmL4xgvHZKmJd`
   - NFTs: ~3,209
   - Parser: Properties

3-8. [6 more collections configured in scanner]

---

## Ready to Run! 🚀

### Run Scanner Once:
```bash
npm run scan:nfts
```

### Run Scanner on Schedule (every 24 hours):
```bash
npm run scan:nfts:scheduled 24
```

### Via API Endpoint:
```bash
POST /api/gaming/scan-background
```

---

## What Happens When You Run the Scanner

1. ✅ **Stage 0**: Sync collection definitions to `gaming_nft_collections`
2. ✅ **Stage 1**: Fetch NFT IDs from Bithomp (bulk, 400/batch, max 4000)
3. ✅ **Stage 2A**: Fetch each NFT individually with full metadata
4. ✅ **Stage 2B**: Parse traits and store in `gaming_nfts` with CDN images
5. ✅ **Stage 3**: Calculate rarity scores (frequency-based)
6. ✅ **Stage 4A**: AI scores individual traits → OpenAI API
7. ✅ **Stage 4B**: AI scores overall collection
8. ✅ **Stage 5**: Generate dynamic scorecards → `project_master_cards` + `project_score_cards`

---

## Expected Output

After successful scan, you'll have:

- **8 entries** in `gaming_nft_collections` (one per collection)
- **~10,000+ entries** in `gaming_nfts` (all NFTs with traits)
- **8 entries** in `project_master_cards` (project metadata)
- **~200-400 entries** in `project_score_cards` (all trait scorecards)

Each NFT will have:
- ✅ Parsed traits in JSONB format
- ✅ CDN image URL (no IPFS)
- ✅ Rarity score and rank
- ✅ Trait rarity breakdown

Each trait will have:
- ✅ AI-powered gaming utility score
- ✅ AI-powered visual impact score
- ✅ Calculated rarity value score
- ✅ AI-powered synergy score
- ✅ AI-generated reasoning text

---

## Database is Ready ✅

All tables created, all fields present, all migrations applied.

**Run the scanner now**: `npm run scan:nfts`
