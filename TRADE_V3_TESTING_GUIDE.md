# Trade V3 Testing Guide

## Quick Test Steps

### 1. Start the Application
```powershell
# Terminal 1 - Backend
npm run dev

# Terminal 2 - Frontend (if separate)
cd client
npm run dev
```

### 2. Test Swap Function

#### Test on XRPL
1. Navigate to `/trade-v3`
2. Select chain: XRPL
3. Click Swap tab (should be selected by default)
4. Click "From" token → Select XRP
5. Enter amount: `10`
6. Click "To" token → Select any token (e.g., USD)
7. Wait for quote to load
8. Verify quote displays:
   - Rate
   - Minimum received
   - Price impact
   - Slippage
   - Fee
   - Route
9. Click "Swap" button
10. Check for success toast

#### Test on Ethereum
1. Change chain to Ethereum
2. Click "From" token → ETH selected by default
3. Enter amount: `0.1`
4. Click "To" token → Search for USDC
5. Wait for quote
6. Click "Swap"
7. Verify transaction initiated

### 3. Test Bridge Function

1. Click "Bridge" tab
2. Select "From Chain": Ethereum
3. Enter amount: `0.1`
4. Token shows ETH
5. Arrow down button visible
6. "To Chain" shows dropdown (select different chain)
7. Click "Bridge" button
8. Check for bridge initiation toast

### 4. Test Limit Orders (XRPL Only)

#### On XRPL
1. Switch to XRPL chain
2. Click "Limit" tab
3. Alert shows: "Place limit orders on XRPL DEX order book"
4. "You Sell" section:
   - Enter amount: `100`
   - Select token (XRP)
5. "You Buy" section:
   - Enter amount: `50`
   - Select token (USD)
6. "Limit Price" field appears
7. Enter limit price
8. Click "Place Limit Order"
9. If no private keys: Shows "Unlock Riddle Wallet"
10. With private keys: Order placed

#### On Non-XRPL Chain
1. Switch to Ethereum
2. Click "Limit" tab
3. Alert shows: "Limit orders are currently only available on XRPL"
4. No input fields visible

### 5. Test Liquidity (XRPL Only)

#### On XRPL
1. Switch to XRPL chain
2. Click "Liquidity" tab
3. Alert shows: "Add liquidity to XRPL AMM pools and earn fees"
4. "Token A" section:
   - Enter amount: `100`
   - Select token (XRP)
5. "+" symbol visible between sections
6. "Token B" section:
   - Enter amount: `50`
   - Select token (USD)
7. Info box shows:
   - Pool Share: ~0.1%
   - Exchange Rate: 1 XRP = X USD
8. Click "Add Liquidity"
9. If no private keys: Shows "Unlock Riddle Wallet"
10. With private keys: Liquidity added

#### On Non-XRPL Chain
1. Switch to Polygon
2. Click "Liquidity" tab
3. Alert shows: "Liquidity provision is currently only available on XRPL AMM"
4. No input fields visible

## Expected API Calls

### Swap
- `GET /api/tradecenter/swap/quote?...` - When amount changes
- `POST /api/tradecenter/swap/execute` - When swap button clicked
- `GET /api/tradecenter/swap/balances/:address` - On load and after swap

### Bridge
- `POST /api/tradecenter/bridge/execute` - When bridge button clicked

### Limit Orders
- `POST /api/tradecenter/limit/create` - When order placed
- `GET /api/tradecenter/limit/orders` - To show user orders
- `GET /api/tradecenter/limit/orderbook` - To display order book

### Liquidity
- `POST /api/tradecenter/liquidity/add` - When adding liquidity
- `GET /api/tradecenter/liquidity/pools` - To show available pools
- `GET /api/tradecenter/liquidity/positions` - To show user positions

## Testing Authentication States

### Not Logged In
1. Visit `/trade-v3` without logging in
2. All tabs visible
3. Swap/Bridge buttons show: "Connect {Chain} Wallet to Swap/Bridge"
4. Alert shows: "Connect your Riddle Wallet or external wallet..."

### Logged In - No Private Keys
1. Log in with Riddle Wallet
2. Don't unlock wallet
3. XRPL Limit/Liquidity buttons show: "Unlock Riddle Wallet"
4. Swap works with external wallets

### Logged In - With Private Keys
1. Log in with Riddle Wallet
2. Unlock wallet (enter password)
3. All buttons enabled
4. Can execute all transactions

## Testing Error Scenarios

### Invalid Input
1. Leave amount empty → Button disabled
2. Enter negative amount → Validation error
3. Select same token for from/to → Should handle gracefully

### Network Errors
1. Disconnect internet
2. Try to swap
3. Should show error toast: "Transaction failed"

### Insufficient Balance
1. Enter amount larger than balance
2. Try to swap
3. Should show error about insufficient funds

### API Connection Issues
1. If Bithomp API down:
   - Warning banner at top: "Bithomp API not responding"
2. If 1inch API down:
   - Warning banner: "1inch API not responding"
3. Both working:
   - Success banner: "✅ All APIs connected"

## Console Logs to Check

Look for these in browser console:

### Swap Execution
```
🚀 Executing swap via Trade Center: 10 XRP → USD
✅ Swap complete: {tx details}
```

### Quote Updates
```
Quote received: {quote data}
```

### Error Handling
```
Swap error: {error message}
```

## Server Logs to Check

Look for these in server terminal:

### Route Registration
```
✅ Trade Center routes registered successfully
```

### API Calls
```
POST /api/tradecenter/swap/execute - 200
GET /api/tradecenter/swap/quote - 200
POST /api/tradecenter/limit/create - 200
POST /api/tradecenter/liquidity/add - 200
```

### Authentication
```
Session authenticated: {handle}
```

## Success Criteria

- [x] All 4 tabs visible on all chains
- [x] Swap works on XRPL and EVM chains
- [x] Bridge initiates cross-chain transfers
- [x] Limit orders work on XRPL (with private keys)
- [x] Limit orders show warning on other chains
- [x] Liquidity works on XRPL (with private keys)
- [x] Liquidity shows warning on other chains
- [x] All buttons show loading states during transactions
- [x] All buttons disabled when appropriate
- [x] Success/error toasts show for all operations
- [x] Token search works for XRPL (Bithomp) and EVM (1inch)
- [x] Balances display correctly
- [x] Quote updates in real-time
- [x] Settings dialog works (slippage adjustment)
- [x] Authentication checks work properly
- [x] No console errors
- [x] No TypeScript errors

## Quick Verification Command

Test all endpoints are registered:
```bash
curl http://localhost:5000/api/tradecenter/health
```

Expected response:
```json
{
  "success": true,
  "service": "tradecenter",
  "routes": ["swap", "liquidity", "limit", "bridge"],
  "timestamp": 1234567890
}
```

## Deployment Verification

After deploying to Vercel:

1. Check environment variables set:
   - BITHOMP_API_KEY
   - VITE_ONEINCH_API_KEY
   - DATABASE_URL
   - SESSION_SECRET

2. Test production URLs:
   - https://your-domain.vercel.app/trade-v3
   - https://your-domain.vercel.app/api/tradecenter/health

3. Verify all functions work in production

## Troubleshooting

### Buttons Disabled
- Check wallet connection
- Verify chain selected
- Check private keys (for XRPL Limit/Liquidity)
- Ensure amounts entered

### No Quote Loading
- Check API connection status banner
- Verify network connectivity
- Check browser console for errors
- Ensure tokens selected

### Transaction Fails
- Check wallet has sufficient balance
- Verify gas/fee availability
- Check network status
- Review server logs

### 401 Unauthorized
- Ensure logged in to Riddle Wallet
- Check session not expired
- Verify session token in localStorage

**All 4 functions are ready to test! 🚀**
