# Multi-Chain Swap System
## Advanced DEX Aggregation Across XRPL, EVM Chains & Solana

**Version 1.0** | **October 2025**

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Supported Chains & DEXs](#supported-chains-dexs)
3. [Price Discovery Engine](#price-discovery-engine)
4. [XRPL Swap System](#xrpl-swap-system)
5. [EVM Swap Aggregation](#evm-swap-aggregation)
6. [Solana Swap Integration](#solana-swap-integration)
7. [Slippage Protection](#slippage-protection)
8. [Fee Structure](#fee-structure)
9. [API Integration](#api-integration)
10. [User Guide](#user-guide)

---

## Executive Summary

RiddleSwap's multi-chain swap system aggregates liquidity from **50+ decentralized exchanges** across 7 blockchains, ensuring users always get the best possible prices for their trades. Our intelligent routing engine analyzes multiple paths and selects the optimal execution strategy.

### Key Metrics

- **Supported Chains**: 7 (XRPL, Ethereum, BSC, Polygon, Base, Arbitrum, Optimism, Solana)
- **DEX Integrations**: 50+ decentralized exchanges
- **Average Slippage**: <0.5% on most pairs
- **Platform Fee**: 0.25% on all swaps
- **Execution Speed**: <5 seconds average
- **Minimum Trade**: $10 equivalent
- **Maximum Trade**: $1,000,000+ (deep liquidity pairs)

---

## Supported Chains & DEXs

### XRPL (XRP Ledger)

**DEXs Integrated**
- XRPL DEX (native orderbook)
- Sologenic DEX
- XRP Toolkit
- Bithomp Exchange
- XRPL.to

**Data Sources**
- Bithomp API (primary)
- DexScreener (price verification)
- XRPL.to (liquidity data)

**Token Support**
- XRP (native)
- All XRPL tokens with active trustlines
- Automatic decimal precision handling
- Dust token management

### Ethereum Mainnet

**DEXs Integrated**
- Uniswap V2 & V3
- SushiSwap
- Curve Finance
- Balancer
- 1inch
- 0x Protocol
- Bancor
- Kyber Network

**Aggregators**
- 1inch API (primary router)
- Paraswap
- Matcha

### Binance Smart Chain (BSC)

**DEXs Integrated**
- PancakeSwap V2 & V3
- Biswap
- MDEX
- ApeSwap
- BakerySwap
- Venus
- 1inch (BSC)

### Polygon

**DEXs Integrated**
- QuickSwap
- SushiSwap
- Curve
- Balancer
- Uniswap V3
- 1inch (Polygon)

### Layer 2 Networks

**Base**
- Uniswap V3
- Aerodrome
- BaseSwap

**Arbitrum**
- Uniswap V3
- SushiSwap
- Camelot
- Curve

**Optimism**
- Uniswap V3
- Velodrome
- Curve

### Solana

**DEXs Integrated**
- Jupiter (primary aggregator)
- Raydium
- Orca
- Serum
- Meteora
- Phoenix
- Lifinity

---

## Price Discovery Engine

### Multi-Source Aggregation

**Data Flow**

```
User Input (Token A → Token B, Amount)
    ↓
Query All DEXs in Parallel
    ↓
┌─────────────┬─────────────┬─────────────┐
│  Source 1   │  Source 2   │  Source 3   │
│ (Uniswap)   │ (SushiSwap) │  (Curve)    │
└─────────────┴─────────────┴─────────────┘
    ↓           ↓             ↓
Aggregate Quotes
    ↓
Calculate Platform Fee (0.25%)
    ↓
Apply Slippage Protection
    ↓
Select Best Route
    ↓
Return Quote to User
```

### Price Calculation Algorithm

```javascript
const calculateBestPrice = async (tokenIn, tokenOut, amountIn, chain) => {
  // Get quotes from all sources
  const quotes = await Promise.all([
    getDexScreenerQuote(tokenIn, tokenOut, amountIn),
    get1inchQuote(tokenIn, tokenOut, amountIn),
    getJupiterQuote(tokenIn, tokenOut, amountIn), // Solana only
    getXRPLDEXQuote(tokenIn, tokenOut, amountIn), // XRPL only
  ]);
  
  // Filter valid quotes
  const validQuotes = quotes.filter(q => q && q.amountOut > 0);
  
  // Sort by output amount (best first)
  validQuotes.sort((a, b) => b.amountOut - a.amountOut);
  
  // Apply platform fee
  const bestQuote = validQuotes[0];
  const platformFee = bestQuote.amountOut * 0.0025; // 0.25%
  const finalAmount = bestQuote.amountOut - platformFee;
  
  return {
    amountOut: finalAmount,
    route: bestQuote.route,
    dex: bestQuote.dex,
    priceImpact: bestQuote.priceImpact,
    fee: platformFee
  };
};
```

### Price Impact Calculation

```javascript
const calculatePriceImpact = (spotPrice, executionPrice) => {
  return ((executionPrice - spotPrice) / spotPrice) * 100;
};
```

**Warning Thresholds**
- 🟢 <1%: Normal
- 🟡 1-3%: Moderate impact
- 🟠 3-5%: High impact
- 🔴 >5%: Very high impact (requires confirmation)

---

## XRPL Swap System

### Native XRPL DEX

**Orderbook Trading**

```javascript
const swapOnXRPL = async (fromToken, toToken, amount) => {
  const client = new xrpl.Client('wss://xrplcluster.com');
  await client.connect();
  
  // Build payment transaction
  const payment = {
    TransactionType: 'Payment',
    Account: userWallet.address,
    Destination: userWallet.address,
    Amount: {
      currency: toToken.currency,
      issuer: toToken.issuer,
      value: String(amount)
    },
    SendMax: {
      currency: fromToken.currency,
      issuer: fromToken.issuer,
      value: String(maxAmount)
    },
    Paths: await findOptimalPath(fromToken, toToken),
    Flags: xrpl.PaymentFlags.tfPartialPayment
  };
  
  // Submit transaction
  const prepared = await client.autofill(payment);
  const signed = userWallet.sign(prepared);
  const result = await client.submitAndWait(signed.tx_blob);
  
  return result;
};
```

### Trustline Management

**Auto-Trustline Creation**

```javascript
const ensureTrustline = async (token, wallet) => {
  // Check if trustline exists
  const accountLines = await client.request({
    command: 'account_lines',
    account: wallet.address
  });
  
  const hasTrustline = accountLines.result.lines.some(
    line => line.currency === token.currency && 
            line.account === token.issuer
  );
  
  if (!hasTrustline) {
    // Create trustline
    const trustSet = {
      TransactionType: 'TrustSet',
      Account: wallet.address,
      LimitAmount: {
        currency: token.currency,
        issuer: token.issuer,
        value: '999999999' // Max limit
      }
    };
    
    await submitTransaction(trustSet);
  }
};
```

### Dust Token Handling

**Automatic Dust Routing**

For tokens with problematic balances:

```javascript
const ISSUES_WALLET = 'rIssuesWalletAddress...';

const handleDustToken = async (token, amount, wallet) => {
  // Check if XRP reserve is sufficient
  const reserve = await getXRPReserve(wallet.address);
  const requiredReserve = 10 + (trustlineCount * 2); // Base + trustlines
  
  if (reserve < requiredReserve) {
    // Route dust to issues wallet
    await routeToIssuesWallet(token, amount, ISSUES_WALLET);
    
    return {
      success: true,
      routed: true,
      message: 'Token routed to issues wallet due to insufficient XRP reserve'
    };
  }
};
```

---

## EVM Swap Aggregation

### 1inch Integration

**Primary Router for EVM Chains**

```javascript
const get1inchSwap = async (chain, fromToken, toToken, amount, slippage) => {
  const chainId = getChainId(chain);
  
  // Get quote
  const quoteUrl = `https://api.1inch.dev/swap/v5.2/${chainId}/quote`;
  const quoteParams = {
    src: fromToken.address,
    dst: toToken.address,
    amount: amount,
  };
  
  const quote = await fetch(`${quoteUrl}?${new URLSearchParams(quoteParams)}`);
  
  // Get swap transaction
  const swapUrl = `https://api.1inch.dev/swap/v5.2/${chainId}/swap`;
  const swapParams = {
    src: fromToken.address,
    dst: toToken.address,
    amount: amount,
    from: userAddress,
    slippage: slippage,
    disableEstimate: false,
    allowPartialFill: false
  };
  
  const swapData = await fetch(`${swapUrl}?${new URLSearchParams(swapParams)}`);
  
  return swapData.tx;
};
```

### DexScreener Integration

**Real-Time Price Data**

```javascript
const getDexScreenerPrice = async (tokenAddress, chain) => {
  const response = await fetch(
    `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`
  );
  
  const data = await response.json();
  
  // Find pair on correct chain
  const pair = data.pairs.find(p => p.chainId === chain);
  
  return {
    priceUsd: pair.priceUsd,
    priceNative: pair.priceNative,
    liquidity: pair.liquidity.usd,
    volume24h: pair.volume.h24,
    priceChange24h: pair.priceChange.h24
  };
};
```

### Gas Optimization

**EIP-1559 Support**

```javascript
const estimateGas = async (transaction) => {
  // Get current base fee
  const block = await provider.getBlock('latest');
  const baseFee = block.baseFeePerGas;
  
  // Calculate priority fee
  const priorityFee = await provider.send('eth_maxPriorityFeePerGas', []);
  
  // Total max fee
  const maxFeePerGas = baseFee.mul(2).add(priorityFee);
  
  // Estimate gas limit
  const gasLimit = await provider.estimateGas(transaction);
  
  return {
    maxFeePerGas: maxFeePerGas,
    maxPriorityFeePerGas: priorityFee,
    gasLimit: gasLimit,
    totalCost: maxFeePerGas.mul(gasLimit)
  };
};
```

---

## Solana Swap Integration

### Jupiter Aggregation

**Best-in-Class Solana Router**

```javascript
const getJupiterQuote = async (inputMint, outputMint, amount, slippage) => {
  // Get quote
  const quoteResponse = await fetch(
    `https://quote-api.jup.ag/v6/quote?` +
    `inputMint=${inputMint}&` +
    `outputMint=${outputMint}&` +
    `amount=${amount}&` +
    `slippageBps=${slippage * 100}`
  );
  
  const quote = await quoteResponse.json();
  
  // Get swap transaction
  const swapResponse = await fetch('https://quote-api.jup.ag/v6/swap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: wallet.publicKey.toString(),
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true
    })
  });
  
  const { swapTransaction } = await swapResponse.json();
  
  return {
    transaction: swapTransaction,
    quote: quote,
    priceImpact: quote.priceImpactPct
  };
};
```

### SPL Token Handling

**Associated Token Accounts**

```javascript
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from '@solana/spl-token';

const ensureTokenAccount = async (mint, owner) => {
  const ata = await getAssociatedTokenAddress(mint, owner);
  
  // Check if account exists
  const accountInfo = await connection.getAccountInfo(ata);
  
  if (!accountInfo) {
    // Create associated token account
    const instruction = createAssociatedTokenAccountInstruction(
      owner,
      ata,
      owner,
      mint
    );
    
    return instruction;
  }
  
  return null;
};
```

---

## Slippage Protection

### Default Settings

**Slippage Tolerance Levels**

```javascript
const SLIPPAGE_PRESETS = {
  low: 0.5,      // 0.5% - Stablecoins, high liquidity
  medium: 1.0,   // 1.0% - Normal trading
  high: 3.0,     // 3.0% - Low liquidity pairs
  custom: 5.0    // User-defined max 5%
};
```

### Minimum Amount Out

**Protection Against Front-Running**

```javascript
const calculateMinAmountOut = (expectedAmount, slippage) => {
  const slippageMultiplier = 1 - (slippage / 100);
  return expectedAmount * slippageMultiplier;
};

// Example
const expectedOut = 1000; // USDC
const slippage = 1; // 1%
const minOut = calculateMinAmountOut(expectedOut, slippage);
// minOut = 990 USDC
```

### Dynamic Slippage

**Auto-Adjust Based on Liquidity**

```javascript
const recommendSlippage = (liquidityUsd, priceImpact) => {
  if (liquidityUsd > 1000000 && priceImpact < 0.5) {
    return 0.5; // Low slippage for deep liquidity
  } else if (liquidityUsd > 100000 && priceImpact < 2) {
    return 1.0; // Medium for normal pairs
  } else {
    return 3.0; // High for illiquid pairs
  }
};
```

---

## Fee Structure

### Platform Fees

**Swap Fee**: 0.25% on all trades

```javascript
const calculateFees = (amountOut) => {
  const platformFee = amountOut * 0.0025; // 0.25%
  const userReceives = amountOut - platformFee;
  
  return {
    platformFee: platformFee,
    userReceives: userReceives,
    feePercentage: 0.25
  };
};
```

### Network Fees

**Gas Costs by Chain**

| Chain | Average Gas (USD) | Speed |
|-------|------------------|-------|
| XRPL | $0.0001 | 3-5 sec |
| Ethereum | $5-50 | 12 sec |
| BSC | $0.10-0.50 | 3 sec |
| Polygon | $0.01-0.10 | 2 sec |
| Base | $0.05-0.20 | 2 sec |
| Arbitrum | $0.10-0.50 | 1 sec |
| Optimism | $0.10-0.50 | 2 sec |
| Solana | $0.0001 | 400ms |

### Fee Distribution

**Platform Fee Allocation**
- 60% - Liquidity incentives
- 20% - Development fund
- 15% - Marketing & growth
- 5% - Team

---

## API Integration

### Swap Quote Endpoint

```javascript
GET /api/swap/quote

Query Parameters:
- fromChain: string (e.g., "ethereum")
- toChain: string (e.g., "ethereum")
- fromToken: string (token address)
- toToken: string (token address)
- amount: string (in smallest unit)
- slippage: number (optional, default 1)

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

### Execute Swap Endpoint

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

---

## User Guide

### How to Swap

**Step 1: Connect Wallet**
- Choose your wallet (MetaMask, Phantom, Xaman, etc.)
- Approve connection
- Select correct network

**Step 2: Select Tokens**
- Choose input token (what you're trading)
- Choose output token (what you're receiving)
- Enter amount

**Step 3: Review Quote**
- Check exchange rate
- Verify slippage tolerance
- Review fees
- Check price impact

**Step 4: Execute Swap**
- Click "Swap" button
- Approve transaction in wallet
- Wait for confirmation
- View transaction details

### Best Practices

**For Best Prices**
1. ✅ Compare multiple chains if token available on several
2. ✅ Trade during low network congestion
3. ✅ Use limit orders for large trades (future feature)
4. ✅ Split large trades to reduce price impact

**Safety Tips**
1. ✅ Always verify token contract addresses
2. ✅ Start with small test trades
3. ✅ Set appropriate slippage (not too high)
4. ✅ Check liquidity before trading
5. ✅ Beware of honeypot/scam tokens

---

## Conclusion

RiddleSwap's multi-chain swap system provides optimal pricing through intelligent DEX aggregation, comprehensive chain support, and robust slippage protection. Whether trading on XRPL, EVM chains, or Solana, users can trust our platform for the best execution.

---

## Resources

- [Platform Overview](./platform-overview.md)
- [Wallet & WalletConnect](./wallet-walletconnect.md)
- [Cross-Chain Bridge](./cross-chain-bridge.md)
- [Developer Tools](./developer-tools.md)

---

**Document Version**: 1.0  
**Last Updated**: October 26, 2025  
**Author**: RiddleSwap Development Team
