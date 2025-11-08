# Developer Tools
## APIs, Webhooks & Integration Guides

**Version 1.0** | **October 2025**

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Getting Started](#getting-started)
3. [Authentication](#authentication)
4. [REST API Reference](#rest-api-reference)
5. [WebSocket API](#websocket-api)
6. [Webhook Events](#webhook-events)
7. [SDK & Libraries](#sdk-libraries)
8. [Integration Examples](#integration-examples)
9. [Rate Limiting](#rate-limiting)
10. [Best Practices](#best-practices)

---

## Executive Summary

RiddleSwap provides a comprehensive developer platform with REST APIs, WebSocket connections, and webhook integrations, enabling developers to build applications on top of our multi-chain infrastructure.

### Key Features

- **RESTful API**: Complete access to swap, bridge, NFT, and gaming features
- **WebSocket**: Real-time price updates and transaction notifications
- **Webhooks**: Event-driven integrations
- **SDKs**: JavaScript/TypeScript libraries (more coming)
- **Documentation**: Interactive API explorer
- **Sandbox**: Test environment for development

---

## Getting Started

### API Base URL

```
Production: https://api.riddleswap.com
Sandbox: https://sandbox.riddleswap.com
```

### Quick Start

**1. Create Account**

```bash
curl -X POST https://api.riddleswap.com/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "developer@example.com",
    "password": "SecurePassword123"
  }'
```

**2. Get API Token**

```bash
curl -X POST https://api.riddleswap.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "developer@example.com",
    "password": "SecurePassword123"
  }'

Response:
{
  "sessionToken": "sess_abc123...",
  "expiresAt": 1698451200
}
```

**3. Make First API Call**

```bash
curl https://api.riddleswap.com/api/swap/quote \
  -H "Authorization: Bearer sess_abc123..." \
  -d '{
    "fromChain": "ethereum",
    "toChain": "ethereum",
    "fromToken": "0x...",
    "toToken": "0x...",
    "amount": "1000000000000000000"
  }'
```

---

## Authentication

### Session-Based Auth

**Login Endpoint**

```javascript
POST /auth/login

Body:
{
  "email": "user@example.com",
  "password": "password"
}

Response:
{
  "success": true,
  "sessionToken": "sess_...",
  "handle": "user123",
  "expiresAt": 1698451200
}
```

**Using Session Token**

```javascript
const headers = {
  'Authorization': `Bearer ${sessionToken}`,
  'Content-Type': 'application/json'
};

const response = await fetch('https://api.riddleswap.com/api/endpoint', {
  headers: headers
});
```

### API Key Auth (Future)

```javascript
const headers = {
  'X-API-Key': 'rsk_live_...',
  'Content-Type': 'application/json'
};
```

---

## REST API Reference

### Swap API

#### Get Quote

```javascript
GET /api/swap/quote

Query Parameters:
- fromChain: string (required)
- toChain: string (required)
- fromToken: string (required)
- toToken: string (required)
- amount: string (required)
- slippage: number (optional, default: 1)

Response:
{
  "success": true,
  "quote": {
    "amountIn": "1000000000000000000",
    "amountOut": "1995000000",
    "priceImpact": 0.5,
    "route": ["Uniswap V3"],
    "gas": "150000",
    "fee": {
      "platform": "5000000",
      "percentage": 0.25
    }
  }
}
```

#### Execute Swap

```javascript
POST /api/swap/execute

Body:
{
  "fromChain": "ethereum",
  "fromToken": "0x...",
  "toToken": "0x...",
  "amount": "1000000000000000000",
  "slippage": 1,
  "userAddress": "0x..."
}

Response:
{
  "success": true,
  "txHash": "0x...",
  "status": "pending"
}
```

### Bridge API

#### Initiate Bridge

```javascript
POST /api/bridge/initiate

Body:
{
  "sourceChain": "xrpl",
  "destinationChain": "ethereum",
  "token": "XRP",
  "amount": "1000",
  "destinationAddress": "0x..."
}

Response:
{
  "success": true,
  "bridgeId": "bridge_abc123",
  "lockTransaction": {
    "txHash": "0x...",
    "status": "pending"
  },
  "estimatedTime": 900
}
```

#### Check Bridge Status

```javascript
GET /api/bridge/status/:bridgeId

Response:
{
  "success": true,
  "bridgeId": "bridge_abc123",
  "status": "validating",
  "progress": {
    "locked": { completed: true, txHash: "0x..." },
    "validated": { completed: false, signatures: "8/15" },
    "minted": { completed: false },
    "completed": { completed: false }
  }
}
```

### NFT Marketplace API

#### Get NFT Listings

```javascript
GET /api/nft/listings

Query Parameters:
- collection: string (optional)
- minPrice: number (optional)
- maxPrice: number (optional)
- sortBy: string (optional)
- limit: number (default: 20)
- offset: number (default: 0)

Response:
{
  "success": true,
  "listings": [
    {
      "nftTokenId": "000...",
      "name": "NFT Name",
      "imageUrl": "https://...",
      "priceXRP": 100,
      "seller": "rSeller...",
      "offerIndex": "ABC123"
    }
  ],
  "total": 1000,
  "hasMore": true
}
```

#### Create Sell Offer

```javascript
POST /api/nft/create-offer

Body:
{
  "nftTokenId": "000...",
  "priceXRP": 100,
  "expirationDays": 7
}

Response:
{
  "success": true,
  "offerIndex": "ABC123",
  "txHash": "0x..."
}
```

### Gaming API

#### Get Player Profile

```javascript
GET /api/gaming/player/:handle

Response:
{
  "success": true,
  "player": {
    "handle": "warrior123",
    "totalPower": 5000,
    "wins": 42,
    "losses": 15,
    "rank": 150,
    "squadrons": 3,
    "alliances": ["Knights"]
  }
}
```

#### Create Battle

```javascript
POST /api/gaming/battle/create

Body:
{
  "squadronId": 1,
  "wagerAmount": 10,
  "wagerCurrency": "XRP",
  "combatType": "balanced"
}

Response:
{
  "success": true,
  "battleId": 42,
  "status": "matching"
}
```

### Scanner API

#### Get Trending Tokens

```javascript
GET /api/scanner/trending/:chain

Query Parameters:
- limit: number (default: 20)
- timeframe: '1h' | '24h' | '7d'

Response:
{
  "success": true,
  "trending": [
    {
      "address": "0x...",
      "symbol": "TOKEN",
      "priceUsd": "1.23",
      "priceChange24h": 45.67,
      "volume24h": 1234567,
      "trendingScore": 89.5
    }
  ]
}
```

---

## WebSocket API

### Connection

```javascript
const ws = new WebSocket('wss://api.riddleswap.com/ws');

ws.on('open', () => {
  // Authenticate
  ws.send(JSON.stringify({
    action: 'authenticate',
    sessionToken: 'sess_...'
  }));
});
```

### Subscribe to Price Updates

```javascript
// Subscribe to token prices
ws.send(JSON.stringify({
  action: 'subscribe',
  channel: 'prices',
  chain: 'ethereum',
  tokens: ['0x...', '0x...']
}));

// Handle price updates
ws.on('message', (data) => {
  const update = JSON.parse(data);
  
  if (update.type === 'price') {
    console.log(`${update.symbol}: $${update.priceUsd}`);
  }
});
```

### Subscribe to Transaction Updates

```javascript
ws.send(JSON.stringify({
  action: 'subscribe',
  channel: 'transactions',
  userAddress: '0x...'
}));

ws.on('message', (data) => {
  const update = JSON.parse(data);
  
  if (update.type === 'transaction') {
    console.log(`TX ${update.hash}: ${update.status}`);
  }
});
```

### Subscribe to Battle Events

```javascript
ws.send(JSON.stringify({
  action: 'subscribe',
  channel: 'battles',
  playerId: 123
}));

ws.on('message', (data) => {
  const update = JSON.parse(data);
  
  if (update.type === 'battle_update') {
    console.log(`Battle ${update.battleId}: ${update.status}`);
  }
});
```

---

## Webhook Events

### Setup Webhooks

```javascript
POST /api/webhooks/create

Body:
{
  "url": "https://your-server.com/webhook",
  "events": ["swap.completed", "battle.finished"],
  "secret": "your_webhook_secret"
}

Response:
{
  "success": true,
  "webhookId": "wh_abc123",
  "url": "https://your-server.com/webhook",
  "events": ["swap.completed", "battle.finished"]
}
```

### Event Types

**Swap Events**
- `swap.initiated`
- `swap.completed`
- `swap.failed`

**Bridge Events**
- `bridge.locked`
- `bridge.validated`
- `bridge.minted`
- `bridge.completed`
- `bridge.failed`

**NFT Events**
- `nft.offer_created`
- `nft.sale_completed`
- `nft.offer_cancelled`

**Gaming Events**
- `battle.created`
- `battle.matched`
- `battle.completed`
- `tournament.started`
- `tournament.completed`

### Webhook Payload

```javascript
{
  "event": "swap.completed",
  "timestamp": 1698364800,
  "data": {
    "swapId": "swap_abc123",
    "fromToken": "ETH",
    "toToken": "USDC",
    "amountIn": "1000000000000000000",
    "amountOut": "1995000000",
    "txHash": "0x...",
    "userAddress": "0x..."
  },
  "signature": "sha256_signature..."
}
```

### Verify Webhook Signature

```javascript
const crypto = require('crypto');

const verifyWebhook = (payload, signature, secret) => {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return signature === expectedSignature;
};
```

---

## SDK & Libraries

### JavaScript/TypeScript SDK

**Installation**

```bash
npm install @riddleswap/sdk
```

**Usage**

```javascript
import { RiddleSwap } from '@riddleswap/sdk';

const client = new RiddleSwap({
  apiKey: 'rsk_live_...',
  network: 'mainnet' // or 'testnet'
});

// Get swap quote
const quote = await client.swap.getQuote({
  fromChain: 'ethereum',
  toChain: 'ethereum',
  fromToken: '0x...',
  toToken: '0x...',
  amount: '1000000000000000000'
});

// Execute swap
const swap = await client.swap.execute({
  ...quote,
  userAddress: '0x...'
});
```

### Python SDK (Coming Soon)

```python
from riddleswap import RiddleSwap

client = RiddleSwap(api_key='rsk_live_...')

quote = client.swap.get_quote(
    from_chain='ethereum',
    to_chain='ethereum',
    from_token='0x...',
    to_token='0x...',
    amount='1000000000000000000'
)
```

---

## Integration Examples

### Trading Bot

```javascript
const RiddleSwap = require('@riddleswap/sdk');
const client = new RiddleSwap({ apiKey: process.env.API_KEY });

async function arbitrageBot() {
  // Monitor price differences
  const ethPriceUniswap = await client.scanner.getPrice('ethereum', '0x...');
  const ethPriceSushiSwap = await client.scanner.getPrice('ethereum', '0x...', 'sushiswap');
  
  // If price difference > 1%, execute arbitrage
  if (Math.abs(ethPriceUniswap - ethPriceSushiSwap) / ethPriceUniswap > 0.01) {
    const quote = await client.swap.getQuote({
      fromChain: 'ethereum',
      toChain: 'ethereum',
      fromToken: '0x...',
      toToken: '0x...',
      amount: '1000000000000000000'
    });
    
    if (quote.priceImpact < 0.5) {
      await client.swap.execute(quote);
    }
  }
}

setInterval(arbitrageBot, 10000); // Run every 10 seconds
```

### Portfolio Tracker

```javascript
async function trackPortfolio(walletAddress) {
  const chains = ['ethereum', 'bsc', 'polygon', 'xrpl', 'solana'];
  
  const balances = await Promise.all(
    chains.map(chain => client.wallet.getBalance(chain, walletAddress))
  );
  
  const totalValueUSD = balances.reduce((sum, balance) => {
    return sum + balance.valueUsd;
  }, 0);
  
  return {
    walletAddress,
    totalValueUSD,
    balances
  };
}
```

### NFT Analytics Dashboard

```javascript
async function getNFTAnalytics(collection) {
  const listings = await client.nft.getListings({ collection });
  
  const floorPrice = Math.min(...listings.map(l => l.priceXRP));
  const volume24h = await client.nft.getVolume(collection, 24);
  const sales24h = await client.nft.getSalesCount(collection, 24);
  
  return {
    collection,
    floorPrice,
    volume24h,
    sales24h,
    totalListings: listings.length
  };
}
```

---

## Rate Limiting

### Limits by Plan

| Plan | Requests/Minute | Requests/Hour | Burst |
|------|-----------------|---------------|-------|
| Free | 60 | 1,000 | 10 |
| Basic | 300 | 10,000 | 50 |
| Pro | 1,000 | 50,000 | 100 |
| Enterprise | Custom | Custom | Custom |

### Rate Limit Headers

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 995
X-RateLimit-Reset: 1698364860
```

### Handling Rate Limits

```javascript
async function makeRequestWithRetry(endpoint, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(endpoint, options);
      
      if (response.status === 429) {
        // Rate limited
        const resetTime = response.headers.get('X-RateLimit-Reset');
        const waitTime = resetTime - Math.floor(Date.now() / 1000);
        
        await sleep(waitTime * 1000);
        continue;
      }
      
      return response;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
    }
  }
}
```

---

## Best Practices

### Security

**1. Never Expose API Keys**

```javascript
// ❌ Bad
const apiKey = 'rsk_live_abc123...';

// ✅ Good
const apiKey = process.env.RIDDLESWAP_API_KEY;
```

**2. Validate Webhook Signatures**

```javascript
// Always verify webhook authenticity
if (!verifyWebhook(req.body, req.headers['x-signature'], webhookSecret)) {
  return res.status(401).send('Invalid signature');
}
```

**3. Use HTTPS**

All API requests must use HTTPS. HTTP requests will be rejected.

### Error Handling

**Implement Retries**

```javascript
const retry = async (fn, maxAttempts = 3) => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      await sleep(Math.pow(2, attempt) * 1000);
    }
  }
};
```

**Handle Error Codes**

```javascript
if (response.status === 400) {
  // Bad request - check parameters
} else if (response.status === 401) {
  // Unauthorized - refresh token
} else if (response.status === 429) {
  // Rate limited - implement backoff
} else if (response.status >= 500) {
  // Server error - retry with exponential backoff
}
```

### Performance

**1. Cache When Possible**

```javascript
const cache = new Map();

async function getCachedData(key, fetchFn, ttl = 60000) {
  const cached = cache.get(key);
  
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data;
  }
  
  const data = await fetchFn();
  cache.set(key, { data, timestamp: Date.now() });
  
  return data;
}
```

**2. Use Batch Requests**

```javascript
// ❌ Bad - Multiple requests
const prices = await Promise.all([
  getPrice('0x...'),
  getPrice('0x...'),
  getPrice('0x...')
]);

// ✅ Good - Single batch request
const prices = await getBatchPrices(['0x...', '0x...', '0x...']);
```

**3. Implement Connection Pooling**

```javascript
const agent = new https.Agent({
  keepAlive: true,
  maxSockets: 50
});

const response = await fetch(url, { agent });
```

---

## Conclusion

RiddleSwap's Developer Tools provide everything needed to build powerful applications on our multi-chain platform. With comprehensive APIs, real-time WebSocket connections, and webhook integrations, developers can create innovative trading bots, portfolio trackers, NFT marketplaces, and more.

---

## Resources

- [Platform Overview](./platform-overview.md)
- [API Interactive Explorer](https://api.riddleswap.com/docs)
- [GitHub Examples](https://github.com/riddleswap/examples)
- [Discord Developer Community](https://discord.gg/riddleswap-dev)

---

**Document Version**: 1.0  
**Last Updated**: October 26, 2025  
**Author**: RiddleSwap Development Team
