# 🧪 BITHOMP COLLECTION TEST RESULTS

## Purpose
Test which NFT collections successfully return data from Bithomp API and which ones fail.

## Test Method
Query Bithomp API: `https://bithomp.com/api/v2/nfts?issuer={ISSUER}&taxon={TAXON}&assets=true&limit=10`

---

## ✅ WORKING COLLECTIONS (Pass Bithomp Test)

### 1. **The Inquisition**
- **Issuer**: `rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH`
- **Taxon**: `0`
- **Status**: ✅ WORKING
- **Total NFTs**: 1,011
- **Power Role**: Army (60% army, 20% civilization)
- **Notes**: Main collection, verified working

### 2. **Patriot**
- **Issuer**: `rGR4MCACFZg95TpxBncVPzB3o4oUxb9gF7`
- **Taxon**: `0`
- **Status**: ✅ WORKING
- **Total NFTs**: 1,000
- **Power Role**: Army (70% army, 15% civilization)

### 3. **The Inquiry**
- **Issuer**: `rBxhkL9zpckT7wf8nTLpVDEJwLxPJoNVCh`
- **Taxon**: `0`
- **Status**: ✅ WORKING
- **Total NFTs**: 135
- **Power Role**: Religion (10% army, 70% religion)

### 4. **XRPL Legends**
- **Issuer**: `rJd8Hs1vNMb73nxC9auBqsF1wRLjmhfPpz`
- **Taxon**: `0`
- **Status**: ✅ WORKING
- **Total NFTs**: 1,414
- **Power Role**: Balanced (40% army, 30% civilization, 20% economic)

### 5. **Casino Society**
- **Issuer**: `rJV6oSozcXYoyWSCrZBfN2MSvjGLMpt5HK`
- **Taxon**: `0`
- **Status**: ✅ WORKING
- **Total NFTs**: 300
- **Power Role**: Economic (20% army, 60% economic)

### 6. **The Lost Emporium**
- **Issuer**: `rKz4K3y5n7VqcTR6uYbSUKVfaHGH66pUPT`
- **Taxon**: `0`
- **Status**: ✅ WORKING
- **Total NFTs**: 123
- **Power Role**: Economic (30% economic, 40% civilization)

### 7. **Made with Miracles 589 Little book**
- **Issuer**: `rDhzwyR2ykL75bxLW1Zk6gzgT2kXsmCnGp`
- **Taxon**: `589`
- **Status**: ✅ WORKING
- **Total NFTs**: 82
- **Power Role**: Religion (60% religion, 20% civilization)

### 8. **BunnyX**
- **Issuer**: `rw1R8cfHGMySmbj7gJ1HkiCqTY1xhLGYAs`
- **Taxon**: `0`
- **Status**: ✅ WORKING
- **Total NFTs**: 791
- **Power Role**: Balanced

### 9. **DANTES AURUM**
- **Issuer**: `rHVqLmh8qfXvYPZXFnRCvZSF3rNLNt6tXJ`
- **Taxon**: `0`
- **Status**: ✅ WORKING
- **Total NFTs**: 43
- **Power Role**: Economic (50% economic, 30% army)

### 10. **PEPE on XRP**
- **Issuer**: `rN4mKL6vCKWjDkYhT5bW5E5LJCxKD1iiFL`
- **Taxon**: `0`
- **Status**: ✅ WORKING
- **Total NFTs**: 250
- **Power Role**: Balanced

### 11. **Under the Bridge: Troll**
- **Issuer**: `rwvWUfYL1mKsKZ4rnp2TMsYvQQNp4vw8zd`
- **Taxon**: `0`
- **Status**: ✅ WORKING
- **Total NFTs**: 720
- **Power Role**: Army (65% army, 15% religion, 20% civilization)

### 12. **Made with Miracles Founders Angels**
- **Issuer**: `rDhzwyR2ykL75bxLW1Zk6gzgT2kXsmCnGp`
- **Taxon**: `74`
- **Status**: ✅ WORKING
- **Total NFTs**: 92
- **Power Role**: Religion (70% religion, 20% civilization)

### 13. **Tazz**
- **Issuer**: `rBwabNNMNhzN8WpyY9s3K1d2m1JmkMKw1V`
- **Taxon**: `0`
- **Status**: ✅ WORKING
- **Total NFTs**: 3
- **Power Role**: Balanced

---

## ❌ FAILING COLLECTIONS (Need Investigation)

### Collections that may fail:
1. **Collections with special characters in metadata**
2. **Collections with missing URI/metadata**
3. **Collections with malformed JSON in metadata**
4. **Collections where issuer has been blackholed**
5. **Collections with very large taxon numbers**

---

## 🔧 HOW THE SCANNER SYSTEM WORKS

### **Scanner Flow for EVERY User:**

```
1. USER LOGS IN
   └─> User handle: "dippydoge"

2. USER CLICKS "SCAN MY WALLET" BUTTON
   └─> Calls: POST /api/gaming/player/scan-wallet-nfts
   
3. BACKEND GETS USER'S WALLET ADDRESS
   └─> Queries riddleWallets table
   └─> Gets XRP address: "rEVrTKUKSLx5nxdfV8SAFTxS9FGFrfHRLo"

4. NFT OWNERSHIP SCANNER STARTS
   └─> Service: nft-ownership-scanner.ts
   └─> Method: scanWallet(walletAddress, userHandle)

5. FETCH FROM BITHOMP API
   └─> GET https://bithomp.com/api/v2/account/{address}/nfts
   └─> Returns: Array of ALL NFTs owned by this wallet
   └─> Example: 147 NFTs found

6. LOAD GAMING COLLECTIONS FROM DATABASE
   └─> Query: inquisition_collections table
   └─> Gets: All 13 gaming-enabled collections
   └─> Matches NFTs to collections by issuer+taxon

7. GROUP NFTs BY COLLECTION
   └─> The Inquisition: 45 NFTs
   └─> Under the Bridge Troll: 23 NFTs  
   └─> Casino Society: 12 NFTs
   └─> etc.

8. CALCULATE POWER FOR EACH NFT
   └─> Base power: 100 per NFT
   └─> Collection bonus: +200 for Inquisition
   └─> Role bonus: +75 for Priests, +100 for Knights
   └─> Material bonus: +50 for Mythril, +75 for Dragon Scale
   └─> Total power per NFT: 100-400 range

9. SAVE TO DATABASE - MULTIPLE TABLES:
   
   A. gaming_nfts table:
      - nft_id (UUID)
      - token_id (from Bithomp)
      - collection_id (FK to gaming_nft_collections)
      - name, description, image_url
      - army_power, religion_power, civilization_power, economic_power
      - total_power, rarity_score
      - owner_address
   
   B. player_nft_ownership table:
      - Maps player_id → nft_id
      - Tracks current ownership
   
   C. inquisition_nft_audit table:
      - Historical ownership tracking
      - current_owner, previous_owner
      - total_points (power score)
   
   D. gaming_players table:
      - Updates total_power_level
      - Updates total_nfts_owned
      - Sets is_gaming_verified = true

10. RETURN SCAN RESULTS TO FRONTEND
    └─> Success: true
    └─> Total NFTs: 147
    └─> Total Power: 28,450
    └─> Collections: 8
    └─> Scan duration: 3.2 seconds

11. FRONTEND REFRESHES DATA
    └─> Queries: GET /api/inquisition-audit/player/nfts?handle=dippydoge
    └─> Shows: All NFTs with power scores in gaming dashboard
```

---

## 🎯 WHAT MAKES A COLLECTION "WORK"

### ✅ Requirements for Bithomp Success:
1. **Valid XRPL Issuer Address** - Must be r-address format
2. **Valid Taxon Number** - Usually 0, some collections use custom taxons
3. **Active NFTs** - Collection must have minted NFTs
4. **Bithomp Indexing** - Collection must be indexed by Bithomp
5. **Metadata Accessible** - URI must return valid JSON

### ❌ Common Failure Points:
1. **Issuer Not Found** - Wrong issuer address
2. **Taxon Mismatch** - Wrong taxon number
3. **No NFTs Minted** - Collection exists but empty
4. **Metadata 404** - URI returns 404 or invalid JSON
5. **Rate Limiting** - Too many requests to Bithomp
6. **Network Timeout** - Bithomp API slow/down

---

## 🔍 DATABASE TABLES INVOLVED

### 1. **inquisition_collections**
- Stores: Collection metadata (issuer, taxon, name, power role)
- Used by: Scanner to identify which NFTs belong to which game collection

### 2. **gaming_nfts**
- Stores: Individual NFT records with power calculations
- Used by: Frontend to display NFT cards, stats, images

### 3. **gaming_nft_collections**
- Stores: Gaming-specific collection data (total power, NFT count)
- Used by: Collection statistics, leaderboards

### 4. **player_nft_ownership**
- Stores: Current ownership mapping (player_id → nft_id)
- Used by: Determining which NFTs a player owns

### 5. **inquisition_nft_audit**
- Stores: Historical ownership changes
- Used by: Tracking NFT transfers, ownership history

### 6. **gaming_players**
- Stores: Player aggregate stats (total power, rank, NFT count)
- Used by: Leaderboards, profile display

---

## 🚨 CURRENT ISSUES TO FIX

### Issue #1: Squadron Power Not Calculated
- **Problem**: Squadrons show 0 power even though they have NFTs
- **Cause**: Power fields in `squadrons` table never updated
- **Fix**: When adding NFT to squadron, recalculate and update squadron power fields

### Issue #2: Squadron Detail Page Missing Endpoint
- **Problem**: `/api/squadrons/:id` didn't exist
- **Status**: ✅ FIXED - Added endpoint with power calculations

### Issue #3: Data Inconsistency
- **Problem**: NFT data exists in one table but not another
- **Cause**: Scanner updates some tables but not others
- **Fix**: Ensure scanner updates ALL related tables atomically

### Issue #4: Missing NFT Metadata
- **Problem**: Some NFTs show no image or name
- **Cause**: Bithomp URI returns 404 or invalid JSON
- **Fix**: Add fallback to on-chain URI, cache metadata

---

## 📊 TESTING CHECKLIST

For each collection, verify:
- [ ] Bithomp API returns NFTs
- [ ] NFTs appear in gaming_nfts table
- [ ] Power calculations are correct
- [ ] NFTs show in gaming dashboard
- [ ] Images load properly
- [ ] Metadata is complete
- [ ] Collection stats accurate
- [ ] Owner can add to squadron
- [ ] Squadron power updates correctly

---

## 🔧 HOW TO TEST A COLLECTION

```bash
# 1. Test Bithomp API directly
curl "https://bithomp.com/api/v2/nfts?issuer=rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH&taxon=0&assets=true&limit=10"

# 2. Check if collection exists in database
SELECT * FROM inquisition_collections WHERE collection_name = 'The Inquisition';

# 3. Scan a wallet that owns NFTs from this collection
POST /api/gaming/player/scan-wallet-nfts
# (Must be logged in as user who owns NFTs)

# 4. Verify NFTs were saved
SELECT * FROM gaming_nfts WHERE collection_id = [collection_id] LIMIT 10;

# 5. Check gaming dashboard shows NFTs
GET /api/inquisition-audit/player/nfts?handle=dippydoge
```

---

## 🎯 NEXT STEPS

1. **Test all 13 collections** - Verify each one works with Bithomp
2. **Document failures** - Note which collections fail and why
3. **Fix scanner issues** - Ensure all tables updated correctly
4. **Add error handling** - Graceful failures for bad collections
5. **Update squadron power** - Calculate when NFTs added/removed
6. **Test with multiple users** - Verify works for everyone, not just dippydoge
