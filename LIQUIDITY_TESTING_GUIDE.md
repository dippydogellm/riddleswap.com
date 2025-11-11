# Liquidity Pool Testing Guide - Single-Sided XRP Input

## What's Ready to Test

✅ **Single-sided XRP liquidity calculation**
- Enter XRP amount only
- Token B amount auto-calculated
- Pool share percentage displayed
- LP tokens to be received shown
- Real-time updates as you type

## Test the Endpoint Directly

### PowerShell Test (Server running on port 5000)

```powershell
# Test 10 XRP into XRP/RDL pool
$params = @{
    asset1 = "XRP"
    asset2 = "RDL.r9xvnzUWZJpDu3NA6MKHmKhKJQTRqCRgu9"
    amount = "10"
    inputAsset = "XRP"
}
$query = ($params.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join "&"
(Invoke-WebRequest -Uri "http://localhost:5000/api/tradecenter/liquidity/calculate?$query" -UseBasicParsing).Content | ConvertFrom-Json

# Test 100 XRP
$params.amount = "100"
$query = ($params.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join "&"
(Invoke-WebRequest -Uri "http://localhost:5000/api/tradecenter/liquidity/calculate?$query" -UseBasicParsing).Content | ConvertFrom-Json

# Test with different token (e.g., XRP/USD)
$params = @{
    asset1 = "XRP"
    asset2 = "USD.rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq"
    amount = "50"
    inputAsset = "XRP"
}
$query = ($params.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join "&"
(Invoke-WebRequest -Uri "http://localhost:5000/api/tradecenter/liquidity/calculate?$query" -UseBasicParsing).Content | ConvertFrom-Json
```

### Expected Response

```json
{
  "success": true,
  "input": {
    "asset": "XRP",
    "amount": "10.000000"
  },
  "required": {
    "asset": "RDL.r9xvnzUWZJpDu3NA6MKHmKhKJQTRqCRgu9",
    "amount": "1254.500000"
  },
  "poolShare": {
    "lpTokens": "23.456789",
    "percentage": "0.1234",
    "formatted": "0.1234%"
  },
  "pool": {
    "current": {
      "asset1": "15000.000000",
      "asset2": "1880000.000000",
      "tvl": "1895000.000000"
    },
    "afterDeposit": {
      "asset1": "15010.000000",
      "asset2": "1881254.500000",
      "tvl": "1896264.500000"
    }
  },
  "priceImpact": {
    "value": 0,
    "formatted": "0.00%"
  },
  "tradingFee": 500,
  "tradingFeePercent": "0.500",
  "timestamp": 1699564800000
}
```

## Test from Frontend UI

### Step 1: Start the Server
```powershell
cd C:\Users\E-Store\Desktop\riddlezip\riddle-main
npm run dev
```

### Step 2: Navigate to Trade V3
1. Open browser: http://localhost:5000/trade-v3
2. Select **XRPL** chain
3. Click **Liquidity** tab

### Step 3: Test Single-Sided Input

#### Test Case 1: XRP/RDL Pool
1. **Token A:** XRP (default)
2. **Enter Amount:** `10` XRP
3. **Token B:** Click "Select token" → Search "RDL" → Select RDL
4. **Observe:**
   - Token B amount auto-fills (e.g., `1254.50 RDL`)
   - Pool share box appears showing:
     - Pool Share: `0.1234%` (example)
     - LP Tokens: `23.456789`
     - Exchange Rate: `1 XRP = 125.45 RDL`
     - Pool TVL: Shows current and after deposit
     - Trading Fee: `0.500%`

#### Test Case 2: Different Amounts
1. Change XRP amount to `1`
   - Watch Token B and pool share update automatically
2. Change to `100`
   - Pool share percentage increases
3. Change to `0.1`
   - Should still calculate correctly

#### Test Case 3: Different Token Pairs
1. **Token A:** XRP
2. **Amount:** `50`
3. **Token B:** Search for other tokens:
   - USD (Bitstamp)
   - EUR
   - BTC
   - ETH
4. Each should auto-calculate Token B amount and pool share

### Step 4: Verify UI Behavior

✅ **Correct Behaviors:**
- Token B field is **read-only** (grayed out)
- Helper text shows "✓ Balanced for optimal pool entry" when calculated
- "Calculating pool share..." spinner shows briefly while loading
- Green success box displays all pool information
- Pool share percentage updates in real-time
- LP tokens amount shown
- All decimals display correctly (6 places)

❌ **Error States to Check:**
- If pool doesn't exist: Shows error message
- If no Token B selected: Shows "Select token first"
- If amount is 0 or empty: No calculation shown
- If on non-XRPL chain: Warning shows "Liquidity provision is currently only available on XRPL AMM"

## What the Data Means

### Pool Share Percentage
- **0.01% - 0.1%:** Small contributor
- **0.1% - 1%:** Medium contributor  
- **1% - 5%:** Large contributor
- **5%+:** Major liquidity provider

### LP Tokens
- Your receipt for the liquidity provided
- Redeemable for your share of pool + earned fees
- Burns when you withdraw liquidity

### TVL (Total Value Locked)
- Total liquidity in the pool
- Shows current → after your deposit
- Higher TVL = better price stability

### Trading Fee
- Fee you earn from swaps in this pool
- Typical: 0.3% - 0.5%
- Distributed proportionally to LP token holders

## API Endpoint Details

### GET /api/tradecenter/liquidity/calculate

**Parameters:**
- `asset1` (required): First asset (e.g., "XRP" or "RDL.r9xvnz...")
- `asset2` (required): Second asset
- `amount` (required): Amount of input asset
- `inputAsset` (required): Which asset is being input (asset1 or asset2)

**Response Fields:**
- `input`: What you're depositing
- `required`: What you need to match it
- `poolShare`: Your percentage and LP tokens
- `pool.current`: Pool state before deposit
- `pool.afterDeposit`: Pool state after deposit
- `priceImpact`: Always 0 for balanced deposits
- `tradingFee`: Fee you'll earn from swaps

## Integration Points

### Frontend Updates:
✅ Added `liquidityData` state
✅ Added `useEffect` to fetch calculation on amount change
✅ Auto-fills Token B amount from API response
✅ Displays pool share info in success box
✅ Made Token B field read-only
✅ Shows loading state while calculating
✅ Debounced to avoid excessive API calls (500ms)

### Server Endpoint:
✅ `/api/tradecenter/liquidity/calculate` implemented
✅ Fetches real AMM pool data from XRPL
✅ Calculates LP tokens using correct formula: `sqrt(amount1 * amount2)`
✅ Computes pool share percentage
✅ Returns all necessary display data

## Common Test Scenarios

### Scenario 1: First-time Pool Entry
```
Input: 10 XRP
Pool: 10,000 XRP / 1,250,000 RDL
Expected: ~0.1% pool share, ~112 LP tokens
```

### Scenario 2: Large Deposit
```
Input: 1000 XRP  
Pool: 10,000 XRP / 1,250,000 RDL
Expected: ~9.1% pool share, ~11,200 LP tokens
```

### Scenario 3: Tiny Deposit
```
Input: 0.1 XRP
Pool: 10,000 XRP / 1,250,000 RDL
Expected: ~0.001% pool share, ~1.12 LP tokens
```

## Troubleshooting

### "Pool not found"
- Pool doesn't exist yet for this pair
- Try a different token pair
- Check if issuer address is correct

### Token B not auto-filling
- Check console for API errors
- Verify Token A amount is valid number
- Ensure both tokens are selected

### Pool share showing 0%
- Amount might be too small
- Pool might be very large
- Check if calculation succeeded

### Calculation taking too long
- Network might be slow
- Pool might be complex
- Check server logs for errors

## Next Steps After Testing

Once you verify this works:
1. Test with real wallet connection
2. Implement the actual liquidity deposit transaction
3. Add transaction signing via Riddle Wallet
4. Display transaction confirmation
5. Refresh balances after successful deposit

## Start Testing Now!

```powershell
# Make sure server is running
npm run dev

# Open browser
start http://localhost:5000/trade-v3

# Click: XRPL → Liquidity Tab → Enter 10 XRP → Select RDL
# Watch the magic happen! ✨
```

**Ready to test! Enter some XRP and watch the pool share calculate in real-time.** 🚀
