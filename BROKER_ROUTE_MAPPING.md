# NFT Broker Route Mapping
**Last Updated:** October 14, 2025

This document maps all NFT broker routes to their respective implementations.

---

## 🔐 RiddleNFTBroker Routes (Security-First)
**Implementation:** `server/riddle-nft-broker.ts`  
**Features:** On-ledger validation, anti-griefing, server-side fee computation

### Buy Offer Routes
**File:** `server/nft/nft-buy-offer-routes.ts`

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/nft/buy-offers/create-offer` | POST | ✅ Required | Create buy offer with broker validation |

**Flow:**
1. User submits buy offer request
2. RiddleNFTBroker validates seller address exists on-ledger
3. Creates buy offer directed to seller
4. Returns offer index and transaction hash

---

### Accept Offer Routes  
**File:** `server/nft/nft-accept-routes.ts`

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/nft/accept-offers/:offerId/accept` | POST | ✅ Required | Accept buy offer via brokered flow |

**Flow:**
1. User accepts specific buy offer
2. RiddleNFTBroker fetches offer from XRPL ledger
3. Validates offer (amount, destination, expiration)
4. Creates sell offer to buyer
5. Broker matches offers automatically
6. Returns settlement details with fees

---

## 🛠️ NFTBrokerService Routes (Simplified)
**Implementation:** `server/broker-nft.ts`  
**Features:** Basic operations, admin management

### Broker Information
**File:** `server/broker-routes.ts`

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/broker/info` | GET | ❌ Public | Get broker address and balance |
| `/api/broker/nfts` | GET | ❌ Public | List all NFTs owned by broker |

---

### Admin Sell Offer Management
**File:** `server/broker-routes.ts`

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/broker/nft/:nftId/create-sell-offer` | POST | 🔒 Admin | Admin creates sell offer for broker-owned NFT |
| `/api/broker/nft/:nftId/sell-offers` | GET | ❌ Public | Get all sell offers for NFT |

**Admin Flow:**
1. Broker owns NFT in inventory
2. Admin creates sell offer with price
3. Requires password confirmation
4. Returns offer index

---

### Buy Offer Acceptance
**File:** `server/broker-routes.ts`

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/broker/buy/:nftId` | POST | 🔒 Admin | Broker accepts buy offer from buyer |
| `/api/broker/nft/:nftId/buy-offers` | GET | ❌ Public | Get all buy offers for NFT |

**Admin Flow:**
1. Buyer creates buy offer to broker
2. Admin reviews buy offers
3. Broker accepts offer (transfers NFT for payment)
4. Requires password confirmation

---

### User Buy Offer Creation
**File:** `server/broker-routes.ts`

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/broker/create-buy-offer` | POST | ✅ Required | User creates buy offer to broker |

**User Flow:**
1. User submits buy offer for NFT
2. Offer directed to broker wallet
3. No validation (trusts client data)
4. Returns offer index

---

### User Sell Offer Creation
**File:** `server/broker-routes.ts`

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/broker/create-sell-offer` | POST | ✅ Required | User creates sell offer directed to broker |

**User Flow:**
1. User owns NFT
2. Creates sell offer to broker
3. Broker can accept to acquire NFT
4. Returns offer index

---

### Seller Auto-Match Flow
**File:** `server/broker-routes.ts`

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/broker/seller-accept-offer` | POST | ✅ Required | Seller accepts buy offer with auto broker matching |

**Enhanced Flow:**
1. Seller accepts specific buy offer
2. Validates buyer price matches seller ask price
3. Creates sell offer to buyer
4. **Attempts auto-matching** (if broker brokerage is enabled)
5. Returns settlement or match failure

---

### Admin Offer Matching
**File:** `server/broker-routes.ts`

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/broker/match-offers` | POST | 🔒 Admin | Manually match buy/sell offers via broker |

**Admin Flow:**
1. Admin provides buyOfferIndex and sellOfferIndex
2. Broker executes NFTokenAcceptOffer with brokerage
3. Validates offers exist on ledger
4. Matches and settles transaction
5. Returns broker fee earned

---

### Offer Cancellation
**File:** `server/broker-routes.ts`

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/broker/offer/:offerId/cancel` | POST | ✅ Required | User cancels their own offer |

**Flow:**
1. User requests cancellation of offer
2. Validates user owns the offer on-ledger
3. Submits NFTokenCancelOffer transaction
4. Returns cancellation hash

---

## 📊 Route Summary

### By Implementation

**RiddleNFTBroker (2 routes):**
- Buy offer creation (validated)
- Brokered offer acceptance (on-ledger checks)

**NFTBrokerService (12 routes):**
- Broker info/status (2)
- Admin operations (4)
- User operations (5)
- Auto-matching (1)

### By Authentication

**Public (4 routes):**
- `/api/broker/info`
- `/api/broker/nfts`
- `/api/broker/nft/:nftId/sell-offers`
- `/api/broker/nft/:nftId/buy-offers`

**User Auth Required (5 routes):**
- `/api/nft/buy-offers/create-offer` (RiddleNFTBroker)
- `/api/nft/accept-offers/:offerId/accept` (RiddleNFTBroker)
- `/api/broker/create-buy-offer`
- `/api/broker/create-sell-offer`
- `/api/broker/seller-accept-offer`
- `/api/broker/offer/:offerId/cancel`

**Admin Only (4 routes):**
- `/api/broker/nft/:nftId/create-sell-offer`
- `/api/broker/buy/:nftId`
- `/api/broker/match-offers`

---

## 🔄 User Journey Flows

### Flow 1: Buyer Creates Offer (RiddleNFTBroker)
```
User → POST /api/nft/buy-offers/create-offer
     → RiddleNFTBroker validates seller on-ledger
     → Creates buy offer with server-calculated fees
     → Returns offer index
```

### Flow 2: Seller Accepts Offer (RiddleNFTBroker)
```
User → POST /api/nft/accept-offers/:offerId/accept
     → RiddleNFTBroker fetches offer from XRPL
     → Validates offer details (amount, expiration)
     → Creates sell offer to buyer
     → Auto-matches via broker brokerage
     → Returns settlement with fees
```

### Flow 3: User-to-Broker Buy Offer (NFTBrokerService)
```
User → POST /api/broker/create-buy-offer
     → NFTBrokerService creates buy offer to broker
     → Admin reviews in dashboard
     → Admin accepts via POST /api/broker/buy/:nftId
     → NFT transferred to user
```

### Flow 4: User-to-Broker Sell Offer (NFTBrokerService)
```
User → POST /api/broker/create-sell-offer
     → NFTBrokerService creates sell offer to broker
     → Broker can accept to acquire NFT
     → NFT added to broker inventory
```

### Flow 5: User-to-User Auto-Match (NFTBrokerService)
```
Buyer → POST /api/broker/create-buy-offer
Seller → POST /api/broker/seller-accept-offer
       → Validates price match
       → Creates sell offer to buyer
       → Attempts auto-matching via broker
       → Returns success or manual match required
```

---

## 🔒 Security Comparison

| Feature | RiddleNFTBroker | NFTBrokerService |
|---------|----------------|------------------|
| On-Ledger Validation | ✅ Yes | ❌ No |
| Anti-Griefing | ✅ Yes | ❌ No |
| Server Fee Calculation | ✅ Yes | ✅ Yes |
| Offer Expiration Checks | ✅ Yes | ❌ No |
| Client Data Trust | ❌ Never | ⚠️ Partial |
| Used For User Flows | ✅ Yes | ✅ Yes |
| Used For Admin Flows | ❌ No | ✅ Yes |

---

## 📝 Configuration

Both brokers use shared environment variables:

```bash
RIDDLE_BROKER_ADDRESS=rBrokerAddress...
RIDDLE_BROKER_SECRET=sBrokerSeed...
BROKER_WALLET_SEED=sBrokerSeed...  # Same as RIDDLE_BROKER_SECRET
```

See `.env.broker.template` for setup instructions.

---

## 🎯 Recommendations

### Current Production Use
- ✅ **User-facing flows** → Use RiddleNFTBroker (has validation)
- ✅ **Admin operations** → Use NFTBrokerService (simpler)
- ✅ **Both use same wallet** → Fund once

### Future Improvements
1. **Add validation to NFTBrokerService** for parity with RiddleNFTBroker
2. **Consolidate to single implementation** with feature flags
3. **Add automated testing** for both broker flows
4. **Monitor broker balance** and alert on low funds

---

## 📚 Related Documentation
- `BROKER_AUDIT_REPORT.md` - Security analysis and testing checklist
- `DUAL_BROKER_CONFIG.md` - Complete configuration guide
- `.env.broker.template` - Environment variable template
