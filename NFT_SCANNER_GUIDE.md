# 🎮 Background NFT Scanner System

## Overview
Independent background service that scans NFT collections, calculates trait rarity, and uses AI to score collection quality. Runs separately from the main server to avoid interruptions.

## Features

### 🔄 Multi-Stage Pipeline
1. **Stage 0**: Sync collection definitions to database
2. **Stage 1**: Fetch all NFTs from Bithomp API with pagination
3. **Stage 2**: Store NFTs with parsed traits (handles different metadata structures)
4. **Stage 3**: Calculate trait rarity scores per collection
5. **Stage 4**: AI-powered collection quality scoring

### 🎯 Per-Collection Trait Parsing
Each collection can have unique trait extraction:
- **Standard**: `attributes` array (most collections)
- **Properties**: Object-based traits (BunnyX)
- **Nested**: Multiple possible locations
- **Custom**: Try all structures

### 🤖 AI Collection Scoring
Uses OpenAI GPT-4 to analyze:
- Trait diversity and uniqueness
- Rarity distribution quality
- Gaming utility potential
- Market viability
- Overall collection quality (0-100 score)

## Usage

### Command Line

```bash
# Run scanner once
npm run scan:nfts

# Run on 24-hour schedule
npm run scan:nfts:scheduled

# Custom schedule (every 6 hours)
npm run scan:nfts:scheduled 6
```

### API Endpoints

#### Start Background Scan (All Collections)
```bash
POST /api/gaming/scan-background
```

Response:
```json
{
  "success": true,
  "message": "Background NFT scanner started",
  "status": "running"
}
```

#### Scan Single Collection
```bash
POST /api/gaming/scan-collection-background
Content-Type: application/json

{
  "collection_name": "My NFT Collection",
  "issuer": "rXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "taxon": 0,
  "power_role": "balanced",
  "trait_parser": "standard",
  "ai_scoring_enabled": true
}
```

#### Check Scanner Status
```bash
GET /api/gaming/scanner-status
```

Response:
```json
{
  "success": true,
  "is_running": false,
  "timestamp": "2025-11-10T19:00:00.000Z"
}
```

## Configuration

### Collection Config Structure
```typescript
{
  name: 'Collection Name',
  issuer: 'rXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  taxon: 0,
  power_role: 'army' | 'economic' | 'religion' | 'balanced',
  trait_parser: 'standard' | 'properties' | 'nested' | 'custom',
  ai_scoring_enabled: true
}
```

### Trait Parser Types

**standard**: Standard NFT metadata
```json
{
  "attributes": [
    { "trait_type": "Background", "value": "Blue" },
    { "trait_type": "Eyes", "value": "Laser" }
  ]
}
```

**properties**: Object-based
```json
{
  "properties": {
    "Background": "Blue",
    "Eyes": "Laser"
  }
}
```

**nested**: Multiple locations
```json
{
  "traits": [...],
  "attributes": [...],
  "properties": {...}
}
```

## Database Schema

### AI Scoring Fields Added
```sql
ALTER TABLE inquisition_collections 
ADD COLUMN ai_score INTEGER,
ADD COLUMN ai_analysis JSONB;
```

### AI Analysis Structure
```json
{
  "overall_score": 85,
  "trait_diversity_score": 90,
  "rarity_distribution_score": 80,
  "utility_score": 85,
  "market_potential_score": 88,
  "reasoning": "This collection demonstrates exceptional trait diversity...",
  "strengths": [
    "Wide variety of trait combinations",
    "Well-balanced rarity distribution"
  ],
  "weaknesses": [
    "Limited utility in current meta",
    "Small collection size may impact liquidity"
  ]
}
```

## Error Handling

### Graceful Degradation
- API failures: Skip batch, continue with next
- Missing traits: Default to empty array
- Null metadata: Use fallback values
- DB errors: Log and continue to next NFT

### Rate Limiting
- 200ms between API batches
- 2 seconds between collections
- Max 4000 NFTs per collection (10 batches)

## Migration Required

Run before using AI scoring:
```bash
psql $DATABASE_URL -f migrations/add-ai-scoring-fields.sql
```

## Environment Variables

```env
BITHOMP_API_KEY=your_api_key_here
OPENAI_API_KEY=sk-proj-xxxxx  # Optional, for AI scoring
```

## Examples

### 8 Configured Collections

1. **The Inquiry** (taxon 0) - Religion role, standard traits
2. **The Inquisition** (taxon 2) - Army role, standard traits, 1162 NFTs
3. **The Lost Emporium** (taxon 3) - Economic role
4. **Inquisition Artifacts** (taxon 4) - Balanced role
5. **Inquisition Relics** (taxon 5) - Balanced role
6. **Inquisition Trolls** (taxon 9) - Army role, 720 NFTs
7. **Casino Society** - Economic role
8. **BunnyX** - Properties-based traits, 3209 NFTs

## Output Example

```
🎮 SCANNING: The Inquisition
════════════════════════════════════════════════════════════

📦 Fetching NFTs: The Inquisition (taxon: 2)...
   Batch 1: +400 NFTs (Total: 400)
   Batch 2: +400 NFTs (Total: 800)
   Batch 3: +362 NFTs (Total: 1162)
   ✅ Fetched 1162 NFTs total

💾 Storing 1162 NFTs for The Inquisition...
   Progress: 100/1162 (0 errors)
   Progress: 200/1162 (0 errors)
   ...
   ✅ Stored 1162 NFTs (0 errors)

🎯 Calculating rarity for The Inquisition...
   ✅ Scored 1162 NFTs (Rank 1 = 1847.23 points)

🤖 AI Scoring: The Inquisition...
   ✅ AI Score: 87/100
   📊 Trait Diversity: 92/100
   🎯 Utility: 85/100
   💎 Market Potential: 84/100

✅ The Inquisition complete!
```

## Benefits

✅ **Independent Operation**: Runs separately from main server
✅ **Crash Recovery**: Each collection isolated, errors don't cascade
✅ **Flexible Scheduling**: Run on-demand or scheduled
✅ **Per-Collection Logic**: Handle unique trait structures
✅ **AI Enhancement**: Automated quality scoring
✅ **Scalable**: Handle 1000s of collections
✅ **Background Processing**: Non-blocking API responses

## Next Steps

1. Run migration: `psql $DATABASE_URL -f migrations/add-ai-scoring-fields.sql`
2. Test scanner: `npm run scan:nfts`
3. Review AI scores in database
4. Set up scheduled scanning: `npm run scan:nfts:scheduled 24`
