# NFT Collection Theme Scanner Guide

## Overview
The Collection Theme Scanner ensures that the three specified collections are properly scanned and their traits are registered with correct power point allocations based on their thematic roles.

## Collections & Themes

### 1. **Under the Bridge** 
- **URL**: https://xrp.cafe/collection/under-the-bridge-riddle
- **Theme**: Bankers (Economic/Financial focus)
- **Power Boost**: +50% Economic Power
- **Keywords**: banker, merchant, trader, gold, coin, wealth, financial, commerce

### 2. **Lost Emporium**
- **URL**: https://xrp.cafe/collection/the-lost-emporium
- **Theme**: Weapons (Army/Military focus)
- **Power Boost**: +50% Army Power
- **Keywords**: weapon, sword, axe, bow, spear, armor, shield, blade, dagger

### 3. **Dantes Aurum**
- **URL**: https://xrp.cafe/collection/dantesaurum
- **Theme**: Sacred Items (Religion focus)
- **Power Boost**: +50% Religion Power
- **Keywords**: sacred, holy, divine, blessed, relic, temple, prayer, saint

## API Endpoints

### 1. Get Themed Collections List
```http
GET /api/collections/themed
```

**Response:**
```json
{
  "success": true,
  "collections": [
    {
      "name": "Under the Bridge",
      "issuer": "rUTBUnderTheBridge",
      "theme": "banker",
      "powerBoost": { "economic": 1.5 },
      "keywords": ["banker", "merchant", "trader", ...]
    },
    ...
  ],
  "count": 3
}
```

### 2. Register a Themed Collection
```http
POST /api/collections/themed/register
Content-Type: application/json

{
  "issuer": "rUTBUnderTheBridge",
  "name": "Under the Bridge",
  "theme": "banker",
  "taxon": 0
}
```

**Themes:** `banker`, `weapon`, or `sacred`

**Response:**
```json
{
  "success": true,
  "message": "Registered Under the Bridge collection",
  "collectionId": "uuid-here",
  "theme": "banker"
}
```

### 3. Scan All Themed Collections
```http
POST /api/collections/themed/scan-all
```

This will:
1. Find all registered themed collections
2. Calculate base power from NFT traits/metadata
3. Apply thematic power boosts
4. Update nft_power_attributes table

**Response:**
```json
{
  "success": true,
  "message": "Themed collection scan complete",
  "collections_scanned": 3,
  "total_nfts_scanned": 150,
  "results": [
    {
      "collection_name": "Under the Bridge",
      "nfts_scanned": 50,
      "theme": "banker",
      "total_power_allocated": 75000
    },
    ...
  ]
}
```

### 4. Get Collection Statistics
```http
GET /api/collections/themed/stats
```

**Response:**
```json
{
  "success": true,
  "stats": [
    {
      "name": "Under the Bridge",
      "theme": "banker",
      "registered": true,
      "collection_id": "uuid",
      "nft_count": 50,
      "total_power": 75000,
      "power_boost": { "economic": 1.5 }
    },
    ...
  ],
  "total_collections": 3,
  "registered_collections": 3
}
```

### 5. Verify Collection Traits
```http
GET /api/collections/themed/verify/:collectionSlug
```

**Example:**
```http
GET /api/collections/themed/verify/under-the-bridge-riddle
```

**Response:**
```json
{
  "success": true,
  "collection_name": "Under the Bridge",
  "registered": true,
  "collection_id": "uuid",
  "theme": "banker",
  "power_boost": { "economic": 1.5 },
  "nft_count": 50,
  "power_records": 50,
  "sample_nfts": [
    {
      "name": "Banker #1",
      "token_id": "001",
      "traits": {
        "profession": "Banker",
        "rarity": "Epic",
        "material": "Gold"
      }
    }
  ],
  "sample_power": [
    {
      "nft_id": "uuid",
      "army": 25,
      "religion": 25,
      "civilization": 25,
      "economic": 75,
      "total": 150,
      "character_class": "merchant"
    }
  ],
  "xrp_cafe_url": "https://xrp.cafe/collection/under-the-bridge-riddle"
}
```

## Setup Process

### Step 1: Update Collection Issuers

Edit `server/collection-theme-scanner.ts` and replace placeholder issuers with actual XRPL addresses:

```typescript
const THEMED_COLLECTIONS: CollectionTheme[] = [
  {
    issuer: 'rActualIssuerAddress1', // ← Replace with real issuer
    name: 'Under the Bridge',
    theme: 'banker',
    // ...
  },
  {
    issuer: 'rActualIssuerAddress2', // ← Replace with real issuer
    name: 'Lost Emporium',
    theme: 'weapon',
    // ...
  },
  {
    issuer: 'rActualIssuerAddress3', // ← Replace with real issuer
    name: 'Dantes Aurum',
    theme: 'sacred',
    // ...
  }
];
```

### Step 2: Register Collections

For each collection, call the register endpoint:

```bash
# Under the Bridge
curl -X POST http://localhost:5000/api/collections/themed/register \
  -H "Content-Type: application/json" \
  -d '{
    "issuer": "rActualIssuerAddress1",
    "name": "Under the Bridge",
    "theme": "banker",
    "taxon": 0
  }'

# Lost Emporium
curl -X POST http://localhost:5000/api/collections/themed/register \
  -H "Content-Type: application/json" \
  -d '{
    "issuer": "rActualIssuerAddress2",
    "name": "Lost Emporium",
    "theme": "weapon"
  }'

# Dantes Aurum
curl -X POST http://localhost:5000/api/collections/themed/register \
  -H "Content-Type: application/json" \
  -d '{
    "issuer": "rActualIssuerAddress3",
    "name": "Dantes Aurum",
    "theme": "sacred"
  }'
```

### Step 3: Import NFT Data

The NFT data must already be in the `gaming_nfts` table. If not, you'll need to:

1. Fetch NFT data from xrp.cafe or Bithomp API
2. Insert into `gaming_nfts` table with proper metadata and traits
3. Ensure `collection_id` matches the registered collection

### Step 4: Scan Collections

Run the scan to calculate and apply thematic power bonuses:

```bash
curl -X POST http://localhost:5000/api/collections/themed/scan-all
```

### Step 5: Verify Results

Check that traits were registered correctly:

```bash
curl http://localhost:5000/api/collections/themed/stats
curl http://localhost:5000/api/collections/themed/verify/under-the-bridge-riddle
curl http://localhost:5000/api/collections/themed/verify/the-lost-emporium
curl http://localhost:5000/api/collections/themed/verify/dantesaurum
```

## Power Calculation System

### Base Power Calculation
1. **Keyword Detection**: Scans NFT traits and metadata for power keywords
2. **Material Multiplier**: Detects materials (wood=1x, gold=5x, diamond=10x, etc.)
3. **Rarity Multiplier**: Detects rarity (common=1x, rare=2x, legendary=5x, etc.)
4. **Base Score**: 10 points per keyword match × material × rarity

### Thematic Boost
After base calculation, the collection's theme applies an additional boost:

- **Banker Theme**: Economic Power × 1.5
- **Weapon Theme**: Army Power × 1.5  
- **Sacred Theme**: Religion Power × 1.5

### Example Calculation

**NFT**: "Golden Sword of Divine Justice"
- **Traits**: { material: "Gold", rarity: "Epic", type: "Sword" }

**Base Power**:
- Army: 10 (sword) × 5 (gold) × 3 (epic) = 150
- Religion: 10 (divine) × 5 (gold) × 3 (epic) = 150
- Civilization: 25 (base)
- Economic: 10 (gold) × 5 (gold) × 3 (epic) = 150

**If in Lost Emporium (Weapon theme)**:
- Army: 150 × 1.5 = **225** ✨
- Religion: 150
- Civilization: 25
- Economic: 150
- **Total: 550**

## Character Class Assignment

After power calculation, the system assigns a character class:

- **Warrior**: High Army power (>30%)
- **Priest**: High Religion power (>30%)
- **Merchant**: High Economic power (>30%)
- **Knight**: Army + Civilization
- **Sage**: Religion + Civilization
- **Lord**: Civilization + Economic
- **Champion**: Balanced across all types (≥70% balance score)

## Database Schema

### gaming_nft_collections
```sql
- id (uuid)
- collection_id (issuer address)
- collection_name
- game_role (merchant, army, power)
- active_in_game
```

### gaming_nfts
```sql
- id (uuid)
- collection_id (FK → gaming_nft_collections)
- token_id
- metadata (jsonb)
- traits (jsonb)
- owner_address
```

### nft_power_attributes
```sql
- nft_id (FK → gaming_nfts)
- collection_id
- owner_address
- army_power
- religion_power
- civilization_power
- economic_power
- total_power
- character_class
- special_powers (jsonb)
- materials_found (jsonb)
- rarities_found (jsonb)
- keywords_detected (jsonb)
```

## Troubleshooting

### Collection Not Found
**Error**: "Collection not found"
**Solution**: Register the collection first using `/api/collections/themed/register`

### No NFTs Scanned
**Error**: `nfts_scanned: 0`
**Solution**: 
1. Check that NFT data exists in `gaming_nfts` table
2. Verify `collection_id` matches the registered collection
3. Import NFT data if missing

### Incorrect Power Allocation
**Issue**: Power points don't match expected theme
**Solution**:
1. Check NFT traits/metadata format
2. Verify keywords are present
3. Re-run scan after fixing data

### Missing Traits
**Issue**: Traits not showing in verification endpoint
**Solution**:
1. Check `gaming_nfts.traits` column is populated
2. Ensure traits are in JSON format
3. Verify metadata structure

## Next Steps

1. **Get Real Issuer Addresses**: Visit each xrp.cafe collection page and find the actual XRPL issuer addresses
2. **Update Scanner Config**: Replace placeholder issuers in `collection-theme-scanner.ts`
3. **Import NFT Data**: Fetch and import NFT data with proper traits/metadata
4. **Register Collections**: Use the register endpoint for each collection
5. **Scan & Verify**: Run the scanner and verify all traits are registered correctly
6. **Test in Gaming Dashboard**: Check that NFTs appear with correct power levels in the gaming UI
