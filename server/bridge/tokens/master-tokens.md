# Master Tokens Configuration

## Overview
RiddleSwap focuses on 5 master tokens across different blockchains. Users can buy other tokens through AMM routing to these master tokens.

## Master Tokens by Chain

### 1. XRPL Chain
- **RDL** - Primary master token on XRPL
- Issuer: `r9xvnzUWZJpDu3NA6MKHmKhKJQTRqCRgu9`
- Currency: `52444C0000000000000000000000000000000000`

### 2. Solana Chain  
- **RDL** - Riddle token on Solana
- Mint: `4tPL1ZPT4uy36VYjoDvoCpvNYurscS324D8P9Ap32AzE`

### 3. Ethereum Chain
- **RDL** - Riddle token on Ethereum
- Contract: `0x1819fB7F80582bC17b98264F5201192e344d76D2`

### 4. Base Chain
- **RDL** - Riddle token on Base
- Contract: `0x4B769b55f1B5b83E2fb219D66D3789Fce880934b`

### 5. BSC Chain
- **RDL** - Riddle token on BSC
- Contract: `0xbd0344A3F0158765E167aE20e0133B9cFBD14d3b`

## Router Strategy
- Users can buy any token by routing through these master tokens
- AMM integration will handle token swapping to non-master tokens
- All bridge transactions focus on these 5 master tokens for simplicity
- Each chain has its native token (XRP, SOL, ETH, BASE/ETH, BNB) plus RDL

## Adding New Tokens
To add new tokens, simply update the respective chain's JSON file:
- `xrpl-tokens.json` - For XRPL tokens
- `solana-tokens.json` - For Solana tokens  
- `evm-tokens.json` - For EVM chains (ETH, BASE, BSC)
- `bitcoin-tokens.json` - For Bitcoin ecosystem

The system automatically detects and supports new tokens without code changes.