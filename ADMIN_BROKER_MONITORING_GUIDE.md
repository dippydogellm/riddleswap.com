# 📊 ADMIN BROKER MONITORING SYSTEM - COMPLETE GUIDE

**Status:** ✅ ACTIVE & PRODUCTION READY  
**Admin Access:** `dippydoge` only  
**Broker Address:** Uses `RIDDLE_BROKER_ADDRESS` from secrets  
**Last Updated:** October 17, 2025

---

## 🎯 OVERVIEW

The Admin Broker Monitoring System provides comprehensive oversight of all broker escrow operations, including:
- ✅ Mint escrows (External & DevTools platforms)
- ✅ Buy/sell escrows (NFT marketplace)
- ✅ Real-time transaction monitoring
- ✅ Financial statistics & analytics
- ✅ System health checks

---

## 🔐 AUTHENTICATION

All admin endpoints require:
1. **Session authentication** (logged in as admin)
2. **Admin role:** User handle must be `dippydoge`

Requests return `403 Forbidden` for non-admin users.

---

## 📋 ADMIN API ENDPOINTS

### 1. GET /api/admin/broker/mint-escrows
**Monitor all NFT minting escrows**

**Query Parameters:**
- `status` (optional): Filter by status (`awaiting_payment`, `payment_confirmed`, `minted`, `distributed`, `failed`)
- `platformType` (optional): Filter by platform (`external`, `devtools`)
- `userHandle` (optional): Filter by buyer handle
- `search` (optional): Search by escrow ID, buyer address, NFT ID, or tx hash
- `page` (default: 1): Page number
- `limit` (default: 50): Results per page

**Response:**
```json
{
  "success": true,
  "escrows": [
    {
      "id": "escrow_xxx",
      "platformType": "external",
      "buyerAddress": "rXXX...",
      "buyerHandle": "user123",
      "brokerAddress": "rGLzXKif4ksBZe2MY6RZT9m69hdgzsXG4X",
      "mintCost": "10000000",
      "brokerFee": "158900",
      "totalAmount": "10158900",
      "status": "distributed",
      "paymentTxHash": "ABC123...",
      "nftTokenId": "00081388...",
      "sellOfferIndex": "XYZ789...",
      "distributionTxHash": "DEF456...",
      "createdAt": "2025-10-17T16:00:00.000Z",
      "issuerPrivateKey": "[ENCRYPTED]"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 100,
    "pages": 2
  }
}
```

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  "https://your-domain.com/api/admin/broker/mint-escrows?status=distributed&platformType=external"
```

---

### 2. GET /api/admin/broker/escrows
**Monitor all buy/sell NFT escrows**

**Query Parameters:**
- `status` (optional): Filter by status
- `search` (optional): Search by ID, NFT token ID, user address, or NFT owner
- `page` (default: 1)
- `limit` (default: 50)

**Response:**
```json
{
  "success": true,
  "escrows": [
    {
      "id": "escrow_xxx",
      "escrowType": "buy",
      "userAddress": "rXXX...",
      "userHandle": "buyer123",
      "nftTokenId": "00081388...",
      "nftOwner": "rYYY...",
      "escrowAmount": "100000000",
      "brokerFee": "1589000",
      "sellerAmount": "98411000",
      "status": "completed",
      "createdAt": "2025-10-17T15:00:00.000Z"
    }
  ],
  "pagination": {...}
}
```

---

### 3. GET /api/admin/broker/mint-stats
**Get minting escrow statistics**

**Response:**
```json
{
  "success": true,
  "stats": {
    "byStatus": [
      {
        "status": "distributed",
        "count": 150,
        "totalXRP": "1500.5"
      },
      {
        "status": "awaiting_payment",
        "count": 25,
        "totalXRP": "250.0"
      }
    ],
    "byPlatform": [
      {
        "platform": "external",
        "count": 100,
        "totalXRP": "1000.0"
      },
      {
        "platform": "devtools",
        "count": 75,
        "totalXRP": "750.5"
      }
    ],
    "totalFeesCollected": "23.835 XRP",
    "totalDistributed": 150,
    "last24Hours": 45
  }
}
```

---

### 4. GET /api/admin/broker/mint-escrows/:id
**Get detailed mint escrow information**

**Response:**
```json
{
  "success": true,
  "escrow": {
    "id": "escrow_xxx",
    "platformType": "external",
    "buyerAddress": "rXXX...",
    "issuerAddress": "rYYY...",
    "issuerPrivateKey": "[ENCRYPTED]",
    "taxon": "12345",
    "mintCost": "10000000",
    "brokerFee": "158900",
    "nftMetadataUri": "ipfs://QmXXX...",
    "nftName": "Cool NFT",
    "status": "distributed",
    "createdAt": "2025-10-17T14:00:00.000Z",
    "updatedAt": "2025-10-17T14:05:00.000Z"
  }
}
```

---

### 5. GET /api/admin/broker/wallet-info
**Get broker wallet information**

**Response:**
```json
{
  "success": true,
  "wallet": {
    "address": "rGLzXKif4ksBZe2MY6RZT9m69hdgzsXG4X",
    "balance": "97.993857 XRP",
    "sequence": 99515646,
    "domain": null
  }
}
```

---

### 6. GET /api/admin/broker/transactions
**Get recent broker wallet transactions**

**Query Parameters:**
- `limit` (default: 20): Number of transactions

**Response:**
```json
{
  "success": true,
  "transactions": [
    {
      "hash": "ABC123...",
      "type": "Payment",
      "date": "2025-10-17T16:00:00.000Z",
      "amount": "10.1589 XRP",
      "destination": "rXXX...",
      "account": "rYYY...",
      "validated": true
    }
  ]
}
```

---

### 7. GET /api/admin/broker/health
**Get system health status**

**Response:**
```json
{
  "success": true,
  "health": {
    "status": "operational",
    "database": "connected",
    "secrets": {
      "sessionSecret": true,
      "brokerSeed": true,
      "brokerAddress": true
    },
    "brokerAddress": "rGLzXKif4ksBZe2MY6RZT9m69hdgzsXG4X",
    "pendingEscrows": 25,
    "timestamp": "2025-10-17T16:30:00.000Z"
  }
}
```

---

## 📊 KEY FEATURES

### Real-Time Monitoring
- **Live escrow tracking:** Monitor all mint and buy/sell escrows in real-time
- **Status updates:** Track escrow progression from payment to distribution
- **Transaction history:** View all broker wallet transactions

### Financial Analytics
- **Fee collection:** Track total broker fees collected (1.589%)
- **Volume tracking:** Monitor total XRP processed by platform type
- **Distribution metrics:** See successful distributions vs pending

### Search & Filter
- **Status filtering:** Find escrows by status
- **Platform filtering:** Separate external vs DevTools minting
- **Text search:** Search by address, tx hash, NFT ID, or escrow ID
- **Pagination:** Handle large datasets efficiently

### Security
- **Private key protection:** Even admins see `[ENCRYPTED]` instead of actual keys
- **Role-based access:** Only `dippydoge` can access admin routes
- **Audit trail:** All escrows logged with timestamps

---

## 🔍 MONITORING WORKFLOWS

### Daily Health Check
```bash
# 1. Check system health
curl -H "Authorization: Bearer <token>" \
  https://your-domain.com/api/admin/broker/health

# 2. Check wallet balance
curl -H "Authorization: Bearer <token>" \
  https://your-domain.com/api/admin/broker/wallet-info

# 3. View recent transactions
curl -H "Authorization: Bearer <token>" \
  https://your-domain.com/api/admin/broker/transactions?limit=50
```

### Monitor Pending Escrows
```bash
# Check awaiting payment
curl -H "Authorization: Bearer <token>" \
  "https://your-domain.com/api/admin/broker/mint-escrows?status=awaiting_payment"

# Check failed escrows
curl -H "Authorization: Bearer <token>" \
  "https://your-domain.com/api/admin/broker/mint-escrows?status=failed"
```

### Financial Reporting
```bash
# Get statistics
curl -H "Authorization: Bearer <token>" \
  https://your-domain.com/api/admin/broker/mint-stats

# Export all distributed escrows (for accounting)
curl -H "Authorization: Bearer <token>" \
  "https://your-domain.com/api/admin/broker/mint-escrows?status=distributed&limit=1000"
```

### Investigate Issues
```bash
# Search by transaction hash
curl -H "Authorization: Bearer <token>" \
  "https://your-domain.com/api/admin/broker/mint-escrows?search=ABC123456"

# Find specific user's escrows
curl -H "Authorization: Bearer <token>" \
  "https://your-domain.com/api/admin/broker/mint-escrows?userHandle=user123"

# Get escrow details
curl -H "Authorization: Bearer <token>" \
  https://your-domain.com/api/admin/broker/mint-escrows/escrow_xxx
```

---

## 🚨 ALERTING & TROUBLESHOOTING

### Key Metrics to Monitor

1. **Pending Escrows:** Should not grow unbounded
   - Check: `/api/admin/broker/health` → `pendingEscrows`
   - Action: If > 50, investigate broker monitor logs

2. **Failed Escrows:** Indicates system issues
   - Check: `/api/admin/broker/mint-escrows?status=failed`
   - Action: Review error messages in escrow details

3. **Wallet Balance:** Must stay funded
   - Check: `/api/admin/broker/wallet-info` → `balance`
   - Action: If < 50 XRP, fund wallet

4. **Last 24h Activity:** Track platform usage
   - Check: `/api/admin/broker/mint-stats` → `last24Hours`
   - Action: Compare to expected volume

### Common Issues

**Issue:** Escrows stuck in `awaiting_payment`
- **Cause:** Buyer hasn't sent payment yet
- **Action:** Check if escrow expired (48h default)

**Issue:** Escrows stuck in `payment_confirmed`
- **Cause:** Minting failed or broker monitor offline
- **Action:** Check broker monitor logs, restart if needed

**Issue:** High number of `failed` escrows
- **Cause:** Invalid private keys, insufficient XRP, network issues
- **Action:** Review error field in failed escrows

---

## 📈 PRODUCTION MONITORING CHECKLIST

Daily:
- [ ] Check system health (`/api/admin/broker/health`)
- [ ] Verify broker wallet balance > 50 XRP
- [ ] Review failed escrows count
- [ ] Check pending escrows < 50

Weekly:
- [ ] Generate financial reports (`/api/admin/broker/mint-stats`)
- [ ] Export distributed escrows for accounting
- [ ] Review transaction history
- [ ] Analyze platform usage by type

Monthly:
- [ ] Audit total fees collected
- [ ] Compare platform types (external vs devtools)
- [ ] Review growth trends
- [ ] Plan wallet funding schedule

---

## 🔗 INTEGRATION WITH BROKER SYSTEMS

### Broker Address Configuration
The system now uses **RIDDLE_BROKER_ADDRESS** from secrets:
```typescript
const BROKER_ADDRESS = process.env.RIDDLE_BROKER_ADDRESS 
  || process.env.BROKER_WALLET_ADDRESS 
  || 'rGLzXKif4ksBZe2MY6RZT9m69hdgzsXG4X';
```

Priority order:
1. RIDDLE_BROKER_ADDRESS (preferred)
2. BROKER_WALLET_ADDRESS (fallback)
3. Hardcoded default (last resort)

### Monitoring Stack
- **Broker Mint Monitor:** Real-time XRPL transaction listener
- **Database:** PostgreSQL with broker_mint_escrow table
- **Admin API:** Express.js routes with admin auth
- **Security:** AES-256-CBC encryption for private keys

---

## 🎯 NEXT STEPS

1. **Set up alerts:** Create scripts to monitor critical metrics
2. **Build dashboard:** Web UI for visual monitoring (optional)
3. **Automate reports:** Schedule daily/weekly summary emails
4. **Expand analytics:** Track conversion rates, average mint costs

---

## 📞 SUPPORT

For admin monitoring issues:
- Check server logs: Look for `[ADMIN]` prefix
- Verify authentication: Ensure logged in as `dippydoge`
- Database connectivity: Run health check endpoint
- Broker monitor: Check if connected to XRPL

**Admin Routes Active:** ✅  
**Monitoring Status:** 🟢 LIVE  
**Broker Address:** From RIDDLE_BROKER_ADDRESS secret
