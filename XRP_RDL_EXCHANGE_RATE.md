# XRP to RDL Exchange Rate - Quick Reference

## Live Exchange Rate Endpoint

### Get Current Rate
```bash
GET /api/exchange-rate/xrp-rdl
```

**Example Response:**
```json
{
  "success": true,
  "rate": 125.45,
  "formatted": "1 XRP = 125.45 RDL",
  "inverse": "1 RDL = 0.007971 XRP",
  "source": "XRPL DEX Order Book",
  "timestamp": 1699564800000,
  "orderBookDepth": 10
}
```

### Calculate Exchange for Specific Amount
```bash
GET /api/exchange-rate/calculate?amount=10&from=XRP&to=RDL
```

**Example Response:**
```json
{
  "success": true,
  "input": "10 XRP",
  "output": "1254.50 RDL",
  "rate": 125.45,
  "formatted": "10 XRP = 1254.50 RDL",
  "source": "XRPL DEX Order Book"
}
```

## RDL Token Information

- **Currency Code:** RDL
- **Issuer:** r9xvnzUWZJpDu3NA6MKHmKhKJQTRqCRgu9
- **Network:** XRPL (XRP Ledger)
- **Type:** Issued Token

## How the Rate is Calculated

The exchange rate is fetched from two sources (in order of priority):

1. **XRPL DEX Order Book**
   - Real-time offers from the decentralized exchange
   - Most accurate for current market price
   - Shows best available rate from active orders

2. **XRPL AMM Pool** (fallback)
   - If no order book offers exist
   - Uses Automated Market Maker liquidity pool
   - Calculates rate from pool ratio: RDL Amount / XRP Amount

## Testing the Endpoint

### PowerShell
```powershell
# Get current rate
(Invoke-WebRequest -Uri "http://localhost:5000/api/exchange-rate/xrp-rdl" -UseBasicParsing).Content | ConvertFrom-Json

# Calculate 1 XRP to RDL
(Invoke-WebRequest -Uri "http://localhost:5000/api/exchange-rate/calculate?amount=1&from=XRP&to=RDL" -UseBasicParsing).Content | ConvertFrom-Json

# Calculate 100 XRP to RDL
(Invoke-WebRequest -Uri "http://localhost:5000/api/exchange-rate/calculate?amount=100&from=XRP&to=RDL" -UseBasicParsing).Content | ConvertFrom-Json

# Calculate 1000 RDL to XRP (reverse)
(Invoke-WebRequest -Uri "http://localhost:5000/api/exchange-rate/calculate?amount=1000&from=RDL&to=XRP" -UseBasicParsing).Content | ConvertFrom-Json
```

### Browser
Open these URLs:
- http://localhost:5000/api/exchange-rate/xrp-rdl
- http://localhost:5000/api/exchange-rate/calculate?amount=1&from=XRP&to=RDL

### curl (if available)
```bash
curl http://localhost:5000/api/exchange-rate/xrp-rdl
curl "http://localhost:5000/api/exchange-rate/calculate?amount=1&from=XRP&to=RDL"
```

## Usage in Frontend

```typescript
// Fetch current rate
const response = await fetch('/api/exchange-rate/xrp-rdl');
const data = await response.json();
console.log(data.formatted); // "1 XRP = 125.45 RDL"

// Calculate exchange
const calcResponse = await fetch('/api/exchange-rate/calculate?amount=10&from=XRP&to=RDL');
const calcData = await calcResponse.json();
console.log(calcData.formatted); // "10 XRP = 1254.50 RDL"
```

## Integration with Trade V3

You can now add this to the trade-v3.tsx page to show live rates:

```typescript
// Add to trade-v3.tsx
const { data: xrpRdlRate } = useQuery({
  queryKey: ['/api/exchange-rate/xrp-rdl'],
  refetchInterval: 30000, // Refresh every 30 seconds
  enabled: chain === 'XRPL' && (fromToken.symbol === 'XRP' || toToken?.symbol === 'RDL')
});

// Display in UI
{xrpRdlRate?.success && (
  <Chip 
    label={xrpRdlRate.formatted}
    color="primary"
    size="small"
  />
)}
```

## Error Handling

### No Liquidity
```json
{
  "success": false,
  "error": "No liquidity found for XRP/RDL pair",
  "message": "No active order book or AMM pool for this pair"
}
```

### Missing Parameters
```json
{
  "success": false,
  "error": "Missing parameters: amount, from, to required"
}
```

### Invalid Pair
```json
{
  "success": false,
  "error": "Invalid currency pair. Supported: XRP/RDL, RDL/XRP"
}
```

## Rate Update Frequency

- **Order Book:** Real-time, changes with each new offer
- **AMM Pool:** Changes with each swap/liquidity action
- **Recommended Refresh:** Every 30-60 seconds for live trading UI

## Start the Server

```powershell
# Make sure you're in the project directory
cd C:\Users\E-Store\Desktop\riddlezip\riddle-main

# Start the development server
npm run dev
```

Once the server is running, the endpoints will be available at:
- http://localhost:5000/api/exchange-rate/xrp-rdl
- http://localhost:5000/api/exchange-rate/calculate

---

**Ready to use! Start your server and test the endpoints.** 🚀
