# Dynamic Token Management System

## Overview
RiddleSwap now uses a JSON-based token management system that supports all XRPL tokens dynamically. Users can easily add new tokens by updating JSON configuration files.

## Master Token Configuration ✅

### Real Contract Addresses (Deployed)
- **RDL** (XRPL): `r9xvnzUWZJpDu3NA6MKHmKhKJQTRqCRgu9` ✅
- **SRDL** (Solana): `4tPL1ZPT4uy36VYjoDvoCpvNYurscS324D8P9Ap32AzE` ✅
- **ERDL** (Ethereum): `0x1819fB7F80582bC17b98264F5201192e344d76D2` ✅
- **BASRDL** (Base): `0x4B769b55f1B5b83E2fb219D66D3789Fce880934b` ✅
- **BNBRDL** (BSC): `0xbd0344A3F0158765E167aE20e0133B9cFBD14d3b` ✅

## System Features
✅ **Dynamic Detection**: Automatically detects XRPL tokens with issuer/currency pairs
✅ **Direct API Calls**: Uses correct DexScreener pair endpoints for accurate pricing
✅ **Real-time Rates**: XRP→RDL showing ~26,514 RDL per XRP with $0.0001139 RDL price
✅ **Chain-specific Files**: Separate JSON files for each blockchain
✅ **Easy Expansion**: Add tokens without code changes
✅ **Master Token Routing**: Ready for AMM integration to buy other tokens

## File Structure
```
server/bridge/tokens/
├── xrpl-tokens.json      # XRPL tokens including RDL
├── solana-tokens.json    # Solana tokens including SRDL  
├── evm-tokens.json       # EVM tokens (ETH, Base, BSC)
├── bitcoin-tokens.json   # Bitcoin ecosystem tokens
├── token-loader.ts       # Dynamic token loading system
└── master-tokens.md      # Documentation
```

## Adding New Tokens
1. Edit the appropriate chain JSON file
2. Add token configuration with contract/issuer details
3. System automatically detects and supports new token
4. No server restart or code changes needed

## Testing Results
- ✅ RDL pricing: $0.0001139 (authentic API data)
- ✅ Exchange rates: 26,514 RDL per XRP (accurate)
- ✅ Dynamic token loading working
- ✅ All 5 master tokens configured with real addresses
- ✅ System ready for AMM router integration