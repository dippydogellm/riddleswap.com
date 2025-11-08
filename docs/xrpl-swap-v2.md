# XRPL Swap v2

Audited, safer XRPL swap service with quotes, transaction preparation, and execution. Uses DeliverMin with user-provided slippage, enforces trustlines, and charges a small XRP platform fee only after successful swap.

## Endpoints

- POST /api/xrpl/swap/v2/quote
  - body: { fromToken, toToken, amount, slippagePercent, fromIssuer?, toIssuer? }
  - returns: { expectedOutput, minOutput, rate, platformFeeXrp }

- POST /api/xrpl/swap/v2/prepare
  - body: { account, fromToken, toToken, amount, slippagePercent, fromIssuer?, toIssuer? }
  - returns: { payment (txjson), expectedOutput, minOutput, rate, feeXrp }
  - Use with Xumm/Xaman or any wallet for external signing.

- POST /api/xrpl/swap/v2/execute
  - body: { riddleWalletHandle, password, fromToken, toToken, amount, slippagePercent, fromIssuer?, toIssuer? }
  - returns: { txHash, deliveredAmount, expectedOutput, minOutput, platformFeeXrp, feeTxHash }

## Environment

- XRPL_WS_ENDPOINT (default wss://xrplcluster.com)
- RIDDLESWAP_BANK_XRP (platform fee recipient)
- RIDDLESWAP_PLATFORM_FEE_PCT (default 0.25)

## Notes

- Inputs validated with zod
- Issuer normalization supports `TOKEN.rXXXX...` and plain r-address
- Price source: DexScreener for tokens, CoinGecko for XRP (fallback only). Pathfinding integration can be added later.
- Trustlines created automatically for internal execution; for external wallets, check/prepare trustline separately.
