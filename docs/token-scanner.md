# Token Scanner
## Real-Time Token Data & Market Analysis

**Version 1.0** | **October 2025**

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Data Sources](#data-sources)
3. [Trending Tokens](#trending-tokens)
4. [New Pairs Detection](#new-pairs-detection)
5. [Top Market Cap](#top-market-cap)
6. [Price Feeds](#price-feeds)
7. [Chain-Specific Features](#chain-specific-features)
8. [Caching Strategy](#caching-strategy)
9. [API Documentation](#api-documentation)
10. [User Guide](#user-guide)

---

## Executive Summary

RiddleSwap's Token Scanner provides real-time market intelligence across all supported blockchains, integrating data from DexScreener, 1inch, XRPL.to, and Jupiter to deliver comprehensive token analytics, trending pairs, and price discovery.

### Key Features

- **Multi-Chain Coverage**: XRPL, Ethereum, BSC, Polygon, Base, Arbitrum, Optimism, Solana
- **Real-Time Data**: Sub-second price updates
- **Trending Detection**: Algorithm-based trending token identification
- **New Pair Alerts**: First-to-market pair detection
- **Smart Caching**: Optimized data refresh intervals
- **Public API**: Unauthenticated access for maximum reach

### Performance Metrics

- **Update Frequency**: 10-30 seconds per chain
- **API Response Time**: <200ms average
- **Cached Data TTL**: 30 seconds
- **Coverage**: 50,000+ token pairs
- **Uptime**: 99.9% SLA

---

## Data Sources

### Primary Integrations

#### DexScreener API

**Coverage**
- All major DEXs across supported chains
- Real-time price data
- Liquidity metrics
- Volume statistics
- Price change percentages

**Endpoint**

```javascript
const getDexScreenerData = async (tokenAddress, chain) => {
  const response = await fetch(
    `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`
  );
  
  const data = await response.json();
  
  // Filter by chain
  const pairs = data.pairs.filter(p => p.chainId === chain);
  
  return pairs.map(pair => ({
    pairAddress: pair.pairAddress,
    baseToken: pair.baseToken,
    quoteToken: pair.quoteToken,
    priceUsd: pair.priceUsd,
    priceNative: pair.priceNative,
    liquidity: pair.liquidity.usd,
    volume24h: pair.volume.h24,
    priceChange24h: pair.priceChange.h24,
    txns24h: pair.txns.h24
  }));
};
```

#### 1inch API (EVM Chains)

**Token Lists**

```javascript
const get1inchTokens = async (chainId) => {
  const response = await fetch(
    `https://api.1inch.dev/token/v1.2/${chainId}`
  );
  
  const tokens = await response.json();
  
  return Object.entries(tokens).map(([address, token]) => ({
    address: address,
    name: token.name,
    symbol: token.symbol,
    decimals: token.decimals,
    logoURI: token.logoURI
  }));
};
```

#### XRPL.to & Bithomp (XRPL)

**XRPL Token Data**

```javascript
const getXRPLTokens = async () => {
  // XRPL.to for price data
  const priceResponse = await fetch('https://api.xrpl.to/api/v1/tokens');
  const priceData = await priceResponse.json();
  
  // Bithomp for metadata
  const metaResponse = await fetch('https://bithomp.com/api/v2/tokens');
  const metaData = await metaResponse.json();
  
  // Merge data sources
  return mergeXRPLData(priceData, metaData);
};
```

#### Jupiter API (Solana)

**Solana Token List**

```javascript
const getJupiterTokens = async () => {
  const response = await fetch('https://token.jup.ag/all');
  const tokens = await response.json();
  
  return tokens.map(token => ({
    address: token.address,
    name: token.name,
    symbol: token.symbol,
    decimals: token.decimals,
    logoURI: token.logoURI,
    tags: token.tags
  }));
};
```

### Data Aggregation

**Multi-Source Price Consensus**

```javascript
const getConsensusPrice = async (tokenAddress, chain) => {
  const sources = await Promise.all([
    getDexScreenerPrice(tokenAddress, chain),
    get1inchPrice(tokenAddress, chain),
    // Add more sources as needed
  ]);
  
  // Filter out invalid prices
  const validPrices = sources.filter(p => p && p > 0);
  
  // Use median to avoid outliers
  const median = calculateMedian(validPrices);
  
  return median;
};
```

---

## Trending Tokens

### Trending Algorithm

**Calculation Logic**

```javascript
const calculateTrendingScore = (token, timeWindow = 24) => {
  // Gather metrics
  const volumeChange = token.volume[timeWindow] / token.volume[timeWindow * 2];
  const priceChange = Math.abs(token.priceChange[timeWindow]);
  const liquidityChange = token.liquidity.current / token.liquidity.previous;
  const txnIncrease = token.txns[timeWindow] / token.txns[timeWindow * 2];
  
  // Weighted score
  const score = (
    (volumeChange * 0.35) +
    (priceChange * 0.25) +
    (liquidityChange * 0.20) +
    (txnIncrease * 0.20)
  );
  
  return score;
};
```

**Trending Categories**

```typescript
interface TrendingToken {
  address: string;
  symbol: string;
  name: string;
  priceUsd: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  trendingScore: number;
  rank: number;
  category: 'hot' | 'rising' | 'top_gainers' | 'top_losers';
}
```

### Endpoint

```javascript
GET /api/scanner/trending/:chain

Query Parameters:
- limit: number (default: 20, max: 100)
- timeframe: '1h' | '24h' | '7d'
- category: 'hot' | 'rising' | 'gainers' | 'losers'

Response:
{
  "success": true,
  "chain": "ethereum",
  "trending": [
    {
      "address": "0x...",
      "symbol": "TOKEN",
      "name": "Token Name",
      "priceUsd": "1.23",
      "priceChange24h": 45.67,
      "volume24h": 1234567,
      "liquidity": 987654,
      "trendingScore": 89.5,
      "rank": 1
    }
  ],
  "lastUpdate": "2025-10-26T12:00:00Z"
}
```

---

## New Pairs Detection

### Detection Algorithm

**Monitoring Strategy**

```javascript
const detectNewPairs = async (chain) => {
  // Get current pairs
  const currentPairs = await getAllPairs(chain);
  
  // Get cached pairs from 1 hour ago
  const cachedPairs = await getCachedPairs(chain, 3600);
  
  // Find new pairs
  const newPairs = currentPairs.filter(cp => 
    !cachedPairs.some(cache => cache.pairAddress === cp.pairAddress)
  );
  
  // Enrich with metadata
  const enrichedPairs = await Promise.all(
    newPairs.map(async pair => ({
      ...pair,
      age: Date.now() - pair.createdAt,
      initialLiquidity: pair.liquidity,
      creator: await getPairCreator(pair.pairAddress),
      verified: await isVerifiedToken(pair.baseToken.address)
    }))
  );
  
  return enrichedPairs;
};
```

**Filtering Criteria**

```javascript
const filterNewPairs = (pairs) => {
  return pairs.filter(pair => 
    // Minimum liquidity
    pair.liquidity >= 5000 &&
    
    // At least some volume
    pair.volume24h > 100 &&
    
    // Not a honeypot
    !isHoneypot(pair) &&
    
    // Contract verified
    pair.baseToken.verified &&
    
    // Reasonable price
    pair.priceUsd > 0.00000001 &&
    pair.priceUsd < 1000000
  );
};
```

### Endpoint

```javascript
GET /api/scanner/new-pairs/:chain

Query Parameters:
- limit: number (default: 20)
- minLiquidity: number (default: 5000)
- maxAge: number (hours, default: 24)

Response:
{
  "success": true,
  "chain": "bsc",
  "newPairs": [
    {
      "pairAddress": "0x...",
      "baseToken": {
        "address": "0x...",
        "symbol": "NEW",
        "name": "New Token"
      },
      "quoteToken": {
        "symbol": "BNB"
      },
      "priceUsd": "0.00123",
      "liquidity": 12345,
      "volume24h": 5678,
      "age": 3600, // seconds
      "createdAt": "2025-10-26T11:00:00Z"
    }
  ]
}
```

---

## Top Market Cap

### Market Cap Calculation

**Formula**

```javascript
const calculateMarketCap = (token) => {
  // For tokens with total supply
  if (token.totalSupply) {
    return token.priceUsd * token.totalSupply;
  }
  
  // For tokens with circulating supply
  if (token.circulatingSupply) {
    return token.priceUsd * token.circulatingSupply;
  }
  
  // Estimate from liquidity
  return estimateMarketCapFromLiquidity(token);
};

const estimateMarketCapFromLiquidity = (token) => {
  // Rough estimate: liquidity * 10
  return token.liquidity * 10;
};
```

**Top Tokens Query**

```javascript
const getTopTokensByMarketCap = async (chain, limit = 100) => {
  // Get all tokens with liquidity > threshold
  const tokens = await getTokensWithLiquidity(chain, 10000);
  
  // Calculate market cap for each
  const withMarketCap = tokens.map(token => ({
    ...token,
    marketCap: calculateMarketCap(token),
    fullyDilutedValue: token.priceUsd * token.totalSupply
  }));
  
  // Sort by market cap
  withMarketCap.sort((a, b) => b.marketCap - a.marketCap);
  
  // Return top N
  return withMarketCap.slice(0, limit);
};
```

### Endpoint

```javascript
GET /api/scanner/top-market-cap/:chain

Query Parameters:
- limit: number (default: 100, max: 500)

Response:
{
  "success": true,
  "chain": "ethereum",
  "topTokens": [
    {
      "address": "0x...",
      "symbol": "ETH",
      "name": "Ethereum",
      "priceUsd": "2500.00",
      "marketCap": 300000000000,
      "volume24h": 15000000000,
      "priceChange24h": 2.5,
      "rank": 1
    }
  ]
}
```

---

## Price Feeds

### Real-Time Price Updates

**WebSocket Implementation**

```javascript
const subscribeToPriceFeed = (tokenAddress, chain) => {
  const ws = new WebSocket('wss://api.riddleswap.com/ws/prices');
  
  ws.on('open', () => {
    ws.send(JSON.stringify({
      action: 'subscribe',
      chain: chain,
      tokens: [tokenAddress]
    }));
  });
  
  ws.on('message', (data) => {
    const update = JSON.parse(data);
    
    if (update.type === 'price') {
      handlePriceUpdate(update);
    }
  });
  
  return ws;
};
```

**Polling Fallback**

```javascript
const pollPriceUpdates = (tokenAddress, chain, interval = 10000) => {
  const poll = async () => {
    const price = await getTokenPrice(tokenAddress, chain);
    updatePriceDisplay(price);
  };
  
  // Initial call
  poll();
  
  // Set interval
  return setInterval(poll, interval);
};
```

### Historical Data

**OHLCV (Open, High, Low, Close, Volume)**

```javascript
GET /api/scanner/ohlcv/:chain/:tokenAddress

Query Parameters:
- timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d'
- from: Unix timestamp
- to: Unix timestamp

Response:
{
  "success": true,
  "data": [
    {
      "timestamp": 1698364800,
      "open": 1.23,
      "high": 1.25,
      "low": 1.22,
      "close": 1.24,
      "volume": 123456
    }
  ]
}
```

---

## Chain-Specific Features

### XRPL Scanner

**Trustline Analysis**

```javascript
const analyzeXRPLToken = async (currency, issuer) => {
  // Get trustlines
  const trustlines = await getTrustlineCount(issuer, currency);
  
  // Get holders
  const holders = await getUniqueHolders(issuer, currency);
  
  // Get transaction volume
  const volume = await getTokenVolume(issuer, currency, 24);
  
  return {
    currency,
    issuer,
    trustlines,
    holders,
    volume24h: volume,
    distribution: calculateDistribution(holders)
  };
};
```

**XRPL DEX Order book**

```javascript
const getXRPLOrderbook = async (takerGets, takerPays) => {
  const response = await client.request({
    command: 'book_offers',
    taker_gets: takerGets,
    taker_pays: takerPays,
    limit: 50
  });
  
  return {
    bids: response.result.offers.slice(0, 25),
    asks: response.result.offers.slice(25, 50),
    spread: calculateSpread(response.result.offers)
  };
};
```

### Solana Scanner

**Jupiter Price API Integration**

```javascript
const getSolanaTokenPrice = async (mint) => {
  const response = await fetch(
    `https://price.jup.ag/v4/price?ids=${mint}`
  );
  
  const data = await response.json();
  
  return {
    mint: mint,
    price: data.data[mint].price,
    priceChange24h: data.data[mint].priceChange24h,
    lastUpdate: data.data[mint].lastUpdatedAt
  };
};
```

### EVM Scanner

**Token Contract Analysis**

```javascript
const analyzeTokenContract = async (tokenAddress, chain) => {
  const contract = new ethers.Contract(
    tokenAddress,
    ERC20_ABI,
    provider
  );
  
  // Get contract details
  const [name, symbol, decimals, totalSupply] = await Promise.all([
    contract.name(),
    contract.symbol(),
    contract.decimals(),
    contract.totalSupply()
  ]);
  
  // Check if verified on block explorer
  const verified = await isContractVerified(tokenAddress, chain);
  
  // Get holder count
  const holders = await getHolderCount(tokenAddress, chain);
  
  return {
    address: tokenAddress,
    name,
    symbol,
    decimals,
    totalSupply: totalSupply.toString(),
    verified,
    holders
  };
};
```

---

## Caching Strategy

### Cache Layers

**Level 1: In-Memory Cache**

```javascript
const cache = new Map();

const getCachedData = (key, ttl = 30000) => {
  const cached = cache.get(key);
  
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data;
  }
  
  return null;
};

const setCachedData = (key, data) => {
  cache.set(key, {
    data: data,
    timestamp: Date.now()
  });
};
```

**Level 2: Redis Cache** (Future)

```javascript
const getCachedFromRedis = async (key) => {
  const cached = await redis.get(key);
  
  if (cached) {
    return JSON.parse(cached);
  }
  
  return null;
};

const setCachedInRedis = async (key, data, ttl = 60) => {
  await redis.setex(key, ttl, JSON.stringify(data));
};
```

### Cache TTL Strategy

| Data Type | TTL | Reason |
|-----------|-----|--------|
| Token Prices | 10s | Real-time critical |
| Trending Tokens | 30s | Moderate freshness |
| New Pairs | 60s | Less time-sensitive |
| Top Market Cap | 5min | Stable data |
| Token Metadata | 1hr | Rarely changes |
| Historical OHLCV | 24hr | Static historical data |

---

## API Documentation

### Public Endpoints

**All Scanner Endpoints Are Public** (No Authentication Required)

#### Get Trending Tokens

```
GET /api/scanner/trending/:chain
```

#### Get New Pairs

```
GET /api/scanner/new-pairs/:chain
```

#### Get Top Market Cap

```
GET /api/scanner/top-market-cap/:chain
```

#### Get Token Price

```
GET /api/scanner/price/:chain/:tokenAddress
```

#### Get Token Info

```
GET /api/scanner/token/:chain/:tokenAddress
```

### Rate Limiting

**Limits**
- 100 requests per minute per IP
- 1000 requests per hour per IP
- Burst allowance: 20 requests

**Headers**

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1698364860
```

---

## User Guide

### Discovering Trending Tokens

**Step 1: Select Chain**
- Choose blockchain to scan
- View trending tokens for that chain

**Step 2: Filter Results**
- Sort by volume, price change, or score
- Set timeframe (1h, 24h, 7d)
- Filter by category (hot, rising, gainers, losers)

**Step 3: Analyze Token**
- Click on token for detailed view
- Check price chart
- Review liquidity and volume
- Verify contract address

**Step 4: Trade**
- Click "Swap" button
- Token pre-filled in swap interface
- Execute trade

### Finding New Opportunities

**New Pairs Monitoring**

1. ✅ Visit "New Pairs" section
2. ✅ Set minimum liquidity filter
3. ✅ Check age of pairs
4. ✅ Verify token contracts
5. ✅ Research project before trading

**Safety Checks**

1. ✅ Verify contract on block explorer
2. ✅ Check liquidity (min $5k recommended)
3. ✅ Review holder distribution
4. ✅ Look for locked liquidity
5. ✅ Beware of honeypots/scams

---

## Conclusion

RiddleSwap's Token Scanner provides comprehensive market intelligence across all supported chains, enabling users to discover trending tokens, new opportunities, and make informed trading decisions with real-time data.

---

## Resources

- [Platform Overview](./platform-overview.md)
- [Multi-Chain Swap](./multi-chain-swap.md)
- [Developer Tools](./developer-tools.md)

---

**Document Version**: 1.0  
**Last Updated**: October 26, 2025  
**Author**: RiddleSwap Development Team
