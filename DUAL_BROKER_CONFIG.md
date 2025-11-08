# Dual Broker Configuration Guide
**Last Updated:** October 14, 2025

## Overview
The NFT marketplace uses TWO separate broker implementations, each serving different purposes:

---

## Broker 1: RiddleNFTBroker (Security-First)
**File:** `server/riddle-nft-broker.ts`  
**Purpose:** Advanced broker with on-ledger validation and anti-griefing protections

### Features
- ✅ On-ledger offer validation
- ✅ Server-side fee computation
- ✅ Anti-griefing attack protection
- ✅ Offer expiration checks
- ✅ Complete broker flow support

### Configuration
**Environment Variables Required:**
```bash
RIDDLE_BROKER_ADDRESS=rYourBrokerAddress...
RIDDLE_BROKER_SECRET=sYourBrokerSeed...
```

**Initialization:**
```typescript
import { RiddleNFTBroker } from './riddle-nft-broker';
import { RIDDLE_BROKER_CONFIG } from './payment-payloads';

const broker = new RiddleNFTBroker({
  address: RIDDLE_BROKER_CONFIG.brokerWallet,
  secret: RIDDLE_BROKER_CONFIG.brokerSecret,
  nickname: 'RiddleNFTBroker'
});
await broker.connect();
```

### Used By Routes:
- `/api/nft/buy-offers/create-offer` (Buy offer creation)
- `/api/nft/accept-offers/:offerId/accept` (Brokered offer acceptance)

### Fee Configuration:
- **Rate:** 1% (0.01) - Set in `RIDDLE_BROKER_CONFIG`
- **Minimum:** 0.2 XRP reserve
- **Network:** 10 drops (0.00001 XRP)

---

## Broker 2: NFTBrokerService (Simplified)
**File:** `server/broker-nft.ts`  
**Purpose:** Simplified broker for basic operations

### Features
- ✅ Basic offer creation
- ✅ Offer matching
- ✅ Buy offer acceptance
- ✅ Sell offer cancellation
- ⚠️ No on-ledger validation (trusts client data)
- ⚠️ No anti-griefing protection

### Configuration
**Environment Variables Required:**
```bash
BROKER_WALLET_SEED=sYourBrokerSeed...
```

**Initialization:**
```typescript
import { initializeBrokerService, getBrokerService } from './broker-nft';

// Initialize once at startup
const broker = initializeBrokerService();

// Get instance anywhere
const broker = getBrokerService();
```

### Used By Routes:
- `/api/broker/info` (Broker information)
- `/api/broker/nfts` (Broker NFT holdings)
- `/api/broker/nft/:nftId/create-sell-offer` (Admin sell offers)
- `/api/broker/buy/:nftId` (Accept buy offers)
- `/api/broker/create-buy-offer` (User buy offers)
- `/api/broker/create-sell-offer` (User sell offers)
- `/api/broker/seller-accept-offer` (Seller acceptance with auto-matching)
- `/api/broker/match-offers` (Admin offer matching)
- `/api/broker/nft/:nftId/sell-offers` (Get sell offers)
- `/api/broker/nft/:nftId/buy-offers` (Get buy offers)
- `/api/broker/offer/:offerId/cancel` (Cancel offers)

### Fee Configuration:
- **Rate:** 1.589% - Set in `BROKER_FEE_CONFIG`
- **Minimum:** 0.1 XRP
- **Calculation:** Dynamic based on buy/sell spread

---

## Configuration Steps

### Step 1: Set Environment Variables
Add to your `.env` file:

```bash
# RiddleNFTBroker Configuration
RIDDLE_BROKER_ADDRESS=rYourBrokerAddress123...
RIDDLE_BROKER_SECRET=sYourBrokerSeed456...

# NFTBrokerService Configuration
BROKER_WALLET_SEED=sYourBrokerSeed456...  # Can be same as RIDDLE_BROKER_SECRET
```

### Step 2: Fund Broker Wallet (MAINNET)
Both brokers use the SAME wallet address. Fund it with:
- **Minimum:** 100 XRP for mainnet operations
- **Recommended:** 200+ XRP for production stability

**Funding Instructions:**
1. Transfer XRP from your exchange or existing wallet to broker address
2. Ensure account is activated on mainnet (minimum 10 XRP reserve)
3. Verify balance on https://livenet.xrpl.org or https://bithomp.com
4. Confirm broker has sufficient XRP for NFT operations

### Step 3: Verify Initialization
Check server logs on startup:

**RiddleNFTBroker:**
```
🏦 RiddleNFTBroker initialized: RiddleNFTBroker
📍 Broker Address: rYourBrokerAddress...
✅ RiddleNFTBroker connected to XRPL
💰 Broker wallet balance: 100 XRP
```

**NFTBrokerService:**
```
🏦 NFT Broker Service initialized
📍 Broker Address: rYourBrokerAddress...
✅ Broker connected to XRPL
```

---

## Route Mapping

### Security-Critical Routes (Use RiddleNFTBroker)
Routes that handle user funds and require validation:
- Buy offer creation
- Brokered offer acceptance
- Any flow involving automatic fee calculation

### Admin/Management Routes (Use NFTBrokerService)
Routes for admin management and information:
- Broker status and balance
- NFT inventory
- Manual offer operations
- Admin-controlled matching

---

## Fee Structure Comparison

| Feature | RiddleNFTBroker | NFTBrokerService |
|---------|----------------|------------------|
| Base Fee | 1% (0.01) | 1.589% |
| Minimum Fee | 0.2 XRP reserve | 0.1 XRP |
| Server Validation | ✅ Yes | ❌ No |
| Auto Fee Calculation | ✅ Yes | ✅ Yes |
| On-Ledger Checks | ✅ Yes | ❌ No |
| Anti-Griefing | ✅ Yes | ❌ No |

---

## Testing Checklist

### RiddleNFTBroker
- [ ] Environment variables set
- [ ] Broker wallet funded (100+ XRP)
- [ ] Initialization logs show success
- [ ] Balance query works
- [ ] Buy offer creation works
- [ ] On-ledger validation works
- [ ] Server fee calculation works

### NFTBrokerService
- [ ] Environment variables set
- [ ] Uses same wallet as RiddleNFTBroker (or separate)
- [ ] Initialization logs show success
- [ ] Balance query works
- [ ] Sell offer creation works
- [ ] Offer matching works
- [ ] Admin operations work

---

## Troubleshooting

### "Broker not connected" Error
**Cause:** Missing environment variables or invalid seed  
**Fix:** Verify `.env` has correct RIDDLE_BROKER_SECRET and BROKER_WALLET_SEED

### "actNotFound" Error
**Cause:** Broker wallet not funded  
**Fix:** Fund wallet with at least 100 XRP on the target network

### "Invalid broker credentials" Error
**Cause:** Seed doesn't match address or contains placeholders  
**Fix:** Ensure seed starts with 's' and is valid XRPL seed

### Fee Calculation Mismatch
**Cause:** Different fee percentages in two brokers  
**Fix:** Decide on single fee rate and update both:
- `RIDDLE_BROKER_CONFIG.feePercentage` in payment-payloads.ts
- `BROKER_FEE_CONFIG.feePercentage` in broker-nft.ts

---

## Production Recommendations

### Option A: Use Both Brokers (Current Setup)
- **Security routes** → RiddleNFTBroker (with validation)
- **Admin routes** → NFTBrokerService (simpler operations)
- **Same wallet** for both (funded once)

### Option B: Consolidate to Single Broker
- Migrate all routes to RiddleNFTBroker
- Remove NFTBrokerService
- Simpler maintenance, better security

### Option C: Add Validation to NFTBrokerService
- Port validation logic from RiddleNFTBroker
- Keep simpler architecture
- Maintain dual implementation

---

## Environment Variable Summary

```bash
# Required for BOTH brokers
RIDDLE_BROKER_ADDRESS=rYourAddress...     # Broker wallet address
RIDDLE_BROKER_SECRET=sYourSeed...         # Broker wallet seed
BROKER_WALLET_SEED=sYourSeed...           # Same seed (or different if using separate wallets)

# Optional - will use defaults if not set
XRPL_RPC_URL=wss://xrplcluster.com       # XRPL server endpoint
```

---

## Next Steps

1. ✅ Add broker credentials to `.env`
2. ✅ Fund broker wallet on target network
3. ✅ Restart server and verify initialization
4. ✅ Test both broker flows independently
5. ✅ Choose long-term architecture (A, B, or C above)
6. ✅ Document chosen approach for team
