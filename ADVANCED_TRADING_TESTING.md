# Advanced Trading Features - Complete Testing Guide

## 🎯 What's Implemented

### 1. ✅ Liquidity - Single & Double Sided
- **Single-sided:** Enter XRP amount, other token auto-calculated
- **Double-sided:** Enter both amounts manually
- **Any token pair:** Works with any XRPL token
- **Pool creation:** Automatically create new pools if they don't exist
- **Pool share calculation:** Real-time % and LP tokens

### 2. ✅ Limit Orders with TP/SL
- **Basic limit orders:** Set price for buy/sell
- **Take Profit:** Auto-sell at higher price
- **Stop Loss:** Auto-sell to limit losses
- **Multiple orders:** Creates 1-3 OfferCreate transactions

### 3. ✅ XRPL Transaction Payloads
- **AMMCreate:** For new pool creation
- **AMMDeposit:** For adding to existing pools
- **OfferCreate:** For limit orders with memos for TP/SL

---

## 🧪 Testing Liquidity Features

### Test 1: Single-Sided Liquidity (Existing Pool)

**Setup:**
1. Go to `/trade-v3`
2. Select **XRPL** chain
3. Click **Liquidity** tab
4. Click **Single-Sided** button

**Steps:**
1. **Token A:** XRP (default)
2. **Enter Amount:** `10` XRP
3. **Token B:** Search "RDL" → Select RDL
4. **Observe:**
   - "Auto-calculated" shows in Token B label
   - Token B amount fills automatically (e.g., `1254.50 RDL`)
   - Token B field is grayed out (read-only)
   - Green pool share box appears:
     - Pool Share: `0.1234%`
     - LP Tokens: `23.456789`
     - Exchange Rate: `1 XRP = 125.45 RDL`
     - Pool TVL: Current → After
     - Trading Fee: `0.500%`

**Expected API Call:**
```
GET /api/tradecenter/liquidity/calculate?
  asset1=XRP&
  asset2=RDL.r9xvnzUWZJpDu3NA6MKHmKhKJQTRqCRgu9&
  amount=10&
  inputAsset=XRP&
  mode=single
```

---

### Test 2: Double-Sided Liquidity (Existing Pool)

**Steps:**
1. Click **Double-Sided** button
2. **Token A:** XRP
3. **Enter Amount:** `10` XRP
4. **Token B:** Select RDL
5. **Enter Amount:** `1300` RDL (manually)
6. **Observe:**
   - Both fields editable
   - Pool share calculates based on your input
   - May show slight imbalance if ratio doesn't match pool

**Expected API Call:**
```
GET /api/tradecenter/liquidity/calculate?
  asset1=XRP&
  asset2=RDL.r9xvnzUWZJpDu3NA6MKHmKhKJQTRqCRgu9&
  amount1=10&
  amount2=1300&
  mode=double
```

---

### Test 3: Create New Pool

**Setup:**
1. Choose two tokens that don't have a pool yet
2. Example: RDL + RLUSD

**Steps:**
1. **Token A:** Select RDL
2. **Token B:** Select RLUSD
3. **Observe:**
   - Orange warning: "Pool doesn't exist! You'll create a new AMM pool"
4. **Single-Sided:**
   - Enter `1000` RDL
   - Token B field becomes editable
   - No auto-calculation (no pool exists yet)
   - Helper text: "Enter amount for new pool creation"
5. **Enter Token B:** `500` RLUSD
6. Click "Add Liquidity"
7. **Backend creates:**
   ```json
   {
     "TransactionType": "AMMCreate",
     "Account": "r...",
     "Amount": {
       "currency": "RDL",
       "value": "1000",
       "issuer": "r9xvnzUW..."
     },
     "Amount2": {
       "currency": "RLUSD",
       "value": "500",
       "issuer": "r..."
     },
     "TradingFee": 500
   }
   ```

**Expected:**
- Toast: "Creating New Pool"
- Transaction payload returned for signing
- After signing: New pool created on XRPL

---

### Test 4: Any Token Pair

**Test with various pairs:**

#### XRP/USD
1. Token A: XRP → `50`
2. Token B: USD (Bitstamp)
3. Should auto-calculate USD amount

#### XRP/BTC
1. Token A: XRP → `100`
2. Token B: BTC
3. Should work if pool exists

#### Custom Tokens
1. Search Bithomp for any token
2. Pair with XRP or another token
3. System checks if pool exists
4. Creates or deposits accordingly

---

## 📊 Testing Limit Orders with TP/SL

### Test 5: Basic Limit Order

**Steps:**
1. Switch to **Limit** tab
2. **You Sell:** `100` XRP
3. **You Buy:** Select RDL
4. **Limit Price:** `130` (sell XRP at 130 RDL each)
5. Click "Place Limit Order"

**Expected Backend:**
```json
{
  "transactions": [
    {
      "TransactionType": "OfferCreate",
      "Account": "r...",
      "TakerPays": "100000000",  // 100 XRP in drops
      "TakerGets": {
        "currency": "RDL",
        "value": "13000",  // 100 * 130
        "issuer": "r9xvnzUW..."
      },
      "Flags": 0
    }
  ]
}
```

---

### Test 6: Limit Order with Take Profit

**Steps:**
1. **You Sell:** `100` XRP
2. **You Buy:** RDL
3. **Limit Price:** `120`
4. **Take Profit Price:** `150`
5. Click "Place Limit Order"

**Expected:**
- Toast: "Creating order with TP/SL..."
- Backend creates **2 transactions:**
  1. Main order: Sell 100 XRP at 120 RDL
  2. TP order: Buy back at 150 RDL (with TP memo)

**TP Order Structure:**
```json
{
  "TransactionType": "OfferCreate",
  "Account": "r...",
  "TakerPays": { ... },
  "TakerGets": { ... },
  "Memos": [{
    "Memo": {
      "MemoType": "54616B6550726F666974",  // "TakeProfit"
      "MemoData": "54503A313530"  // "TP:150"
    }
  }]
}
```

---

### Test 7: Limit Order with Stop Loss

**Steps:**
1. **You Sell:** `100` XRP
2. **You Buy:** RDL  
3. **Limit Price:** `125`
4. **Stop Loss Price:** `100`
5. Click "Place Limit Order"

**Expected:**
- Backend creates **2 transactions:**
  1. Main order: Sell 100 XRP at 125 RDL
  2. SL order: Sell at 100 RDL if price drops (with SL memo)

---

### Test 8: Complete TP/SL Setup

**Steps:**
1. **You Sell:** `100` XRP
2. **You Buy:** RDL
3. **Limit Price:** `125`
4. **Take Profit:** `150` (+20%)
5. **Stop Loss:** `110` (-12%)
6. Click "Place Limit Order"

**Expected:**
- Toast: "Creating order with TP/SL..."
- Backend creates **3 transactions:**
  1. Main: Sell at 125
  2. TP: Sell at 150
  3. SL: Sell at 110
- Description: "Sell 100 XRP at 125.000000 | TP: 150 | SL: 110"

---

## 🔍 API Endpoints Overview

### Liquidity Endpoints

#### Check Pool Exists
```bash
GET /api/tradecenter/liquidity/pool-exists?
  asset1=XRP&
  asset2=RDL.r9xvnzUWZJpDu3NA6MKHmKhKJQTRqCRgu9
```

**Response:**
```json
{
  "success": true,
  "exists": true,
  "pool": {
    "ammAccount": "rE...",
    "asset1": "...",
    "asset2": "...",
    "lpToken": { ... }
  }
}
```

#### Calculate Liquidity
```bash
# Single-sided
GET /api/tradecenter/liquidity/calculate?
  asset1=XRP&
  asset2=RDL.r9xvnzUWZJpDu3NA6MKHmKhKJQTRqCRgu9&
  amount=10&
  inputAsset=XRP&
  mode=single

# Double-sided
GET /api/tradecenter/liquidity/calculate?
  asset1=XRP&
  asset2=RDL.r9xvnzUWZJpDu3NA6MKHmKhKJQTRqCRgu9&
  amount1=10&
  amount2=1254.5&
  mode=double
```

#### Add Liquidity / Create Pool
```bash
POST /api/tradecenter/liquidity/add
Content-Type: application/json

{
  "asset1": "XRP",
  "asset2": "RDL.r9xvnzUWZJpDu3NA6MKHmKhKJQTRqCRgu9",
  "amount1": "10",
  "amount2": "1254.5",
  "walletAddress": "r...",
  "createNew": false,
  "mode": "single"
}
```

### Limit Order Endpoints

#### Create Limit Order
```bash
POST /api/tradecenter/limit/create
Content-Type: application/json

{
  "baseToken": "XRP",
  "quoteToken": "RDL.r9xvnzUWZJpDu3NA6MKHmKhKJQTRqCRgu9",
  "amount": "100",
  "price": "125",
  "side": "sell",
  "walletAddress": "r...",
  "takeProfit": "150",
  "stopLoss": "110"
}
```

**Response:**
```json
{
  "success": true,
  "transactions": [
    { /* Main order */ },
    { /* TP order */ },
    { /* SL order */ }
  ],
  "requiresSigning": true,
  "details": {
    "mainOrder": { "amount": "100", "price": "125", "side": "sell" },
    "takeProfit": "150",
    "stopLoss": "110",
    "orderCount": 3
  }
}
```

---

## 🎯 UI Behavior Checklist

### Liquidity Tab

✅ **Single-Sided Mode:**
- [ ] Token B is read-only and grayed
- [ ] Token B auto-fills when Token A amount changes
- [ ] Helper text: "✓ Balanced for optimal pool entry"
- [ ] Pool share box shows all details
- [ ] Loading spinner while calculating

✅ **Double-Sided Mode:**
- [ ] Both Token A and B are editable
- [ ] Pool share calculates from both amounts
- [ ] Helper text: "Enter your desired amount"

✅ **New Pool Creation:**
- [ ] Orange warning banner appears
- [ ] Both fields become editable
- [ ] No auto-calculation
- [ ] Helper text: "Enter amount for new pool creation"
- [ ] Button says "Add Liquidity"
- [ ] Toast says "Creating New Pool"

✅ **Pool Share Display:**
- [ ] Green success box with all info
- [ ] Pool Share % prominently displayed
- [ ] LP Tokens amount shown
- [ ] Exchange rate calculated
- [ ] TVL before → after
- [ ] Trading fee percentage

### Limit Orders Tab

✅ **Basic UI:**
- [ ] You Sell / You Buy sections
- [ ] Limit Price field (required)
- [ ] Advanced Settings section (green box)
- [ ] Take Profit field (optional)
- [ ] Stop Loss field (optional)
- [ ] Helper text for each field

✅ **Validation:**
- [ ] Button disabled if limit price empty
- [ ] Button disabled if no private keys
- [ ] Shows "Unlock Riddle Wallet" when needed

✅ **Toast Messages:**
- [ ] No TP/SL: "Creating Limit Order"
- [ ] With TP/SL: "Creating order with TP/SL..."
- [ ] Success shows all details: "Sell X at Y | TP: Z | SL: W"

---

## 🚀 Quick Test Script

### PowerShell Commands

```powershell
# Start server
npm run dev

# Test pool existence
$base = "http://localhost:5000/api/tradecenter/liquidity"
(Invoke-WebRequest -Uri "$base/pool-exists?asset1=XRP&asset2=RDL.r9xvnzUWZJpDu3NA6MKHmKhKJQTRqCRgu9" -UseBasicParsing).Content | ConvertFrom-Json

# Test single-sided calculation
(Invoke-WebRequest -Uri "$base/calculate?asset1=XRP&asset2=RDL.r9xvnzUWZJpDu3NA6MKHmKhKJQTRqCRgu9&amount=10&inputAsset=XRP&mode=single" -UseBasicParsing).Content | ConvertFrom-Json

# Test double-sided calculation
(Invoke-WebRequest -Uri "$base/calculate?asset1=XRP&asset2=RDL.r9xvnzUWZJpDu3NA6MKHmKhKJQTRqCRgu9&amount1=10&amount2=1254.5&mode=double" -UseBasicParsing).Content | ConvertFrom-Json
```

### Browser Testing
1. Open: http://localhost:5000/trade-v3
2. Select XRPL chain
3. Test each tab:
   - **Swap:** Already tested ✅
   - **Bridge:** Already tested ✅
   - **Limit:** Test TP/SL fields
   - **Liquidity:** Test single/double modes

---

## 📝 Expected Transaction Payloads

### New Pool (AMMCreate)
```json
{
  "TransactionType": "AMMCreate",
  "Account": "rYourWallet...",
  "Amount": "10000000",  // 10 XRP in drops
  "Amount2": {
    "currency": "RDL",
    "value": "1254.5",
    "issuer": "r9xvnzUWZJpDu3NA6MKHmKhKJQTRqCRgu9"
  },
  "TradingFee": 500  // 0.5%
}
```

### Add Liquidity (AMMDeposit)
```json
{
  "TransactionType": "AMMDeposit",
  "Account": "rYourWallet...",
  "Asset": { "currency": "XRP" },
  "Asset2": {
    "currency": "RDL",
    "issuer": "r9xvnzUWZJpDu3NA6MKHmKhKJQTRqCRgu9"
  },
  "Amount": "10000000",
  "Amount2": {
    "currency": "RDL",
    "value": "1254.5",
    "issuer": "r9xvnzUWZJpDu3NA6MKHmKhKJQTRqCRgu9"
  }
}
```

### Limit Order (OfferCreate)
```json
{
  "TransactionType": "OfferCreate",
  "Account": "rYourWallet...",
  "TakerPays": "100000000",  // What you give
  "TakerGets": {
    "currency": "RDL",
    "value": "12500",  // What you get
    "issuer": "r9xvnzUWZJpDu3NA6MKHmKhKJQTRqCRgu9"
  },
  "Flags": 0
}
```

---

## ✅ Complete Feature Set

**Now Available:**
1. ✅ Single-sided liquidity with auto-calculation
2. ✅ Double-sided liquidity with manual input
3. ✅ Any token pair support
4. ✅ New pool creation (AMMCreate)
5. ✅ Add to existing pools (AMMDeposit)
6. ✅ Pool existence checking
7. ✅ Real-time pool share calculation
8. ✅ Limit orders with custom prices
9. ✅ Take Profit orders
10. ✅ Stop Loss orders
11. ✅ Combined TP/SL orders
12. ✅ Proper XRPL transaction payloads
13. ✅ Memo support for order types

**Ready to test from frontend!** 🎉
