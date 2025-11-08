# Vault System Production Deployment Notes

## ⚠️ CRITICAL: Update Bank Wallet Addresses Before Production

The vault system has been initialized with **PLACEHOLDER** bank wallet addresses. Before deploying to production, you **MUST** update the bank wallet addresses for all 17 chains with your actual production wallet addresses.

### Current Status
- ✅ All 17 chains initialized with 2.76% APY
- ✅ Database schema ready for production
- ✅ Admin panel secured (dippydoge only)
- ⚠️ **PLACEHOLDER** bank wallet addresses need updating

### How to Update Bank Wallet Addresses

1. **Prepare your production wallet addresses** for all chains:
   - Ethereum (ETH)
   - BNB Chain (BNB)
   - Polygon (MATIC)
   - Arbitrum (ETH)
   - Optimism (ETH)
   - Base (ETH)
   - Avalanche (AVAX)
   - Fantom (FTM)
   - Cronos (CRO)
   - Gnosis (xDAI)
   - Celo (CELO)
   - Moonbeam (GLMR)
   - zkSync (ETH)
   - Linea (ETH)
   - XRP Ledger (XRP) - Currently: rGLzXKif4ksBZe2MY6RZT9m69hdgzsXG4X
   - Solana (SOL)
   - Bitcoin (BTC)

2. **Update via SQL or Admin Panel:**

   Option A - Direct SQL Update:
   ```sql
   UPDATE vault_chain_stats SET bank_wallet_address = 'YOUR_PRODUCTION_ADDRESS' WHERE chain = 'ethereum';
   UPDATE vault_chain_stats SET bank_wallet_address = 'YOUR_PRODUCTION_ADDRESS' WHERE chain = 'bsc';
   -- Repeat for all 17 chains
   ```

   Option B - Run vault-init.ts with updated addresses:
   - Edit `server/vault-init.ts`
   - Replace all placeholder addresses with your production addresses
   - Run: `npx tsx server/vault-init.ts`

## Security

### Admin Access
- **ONLY** user `dippydoge` can access `/vault-admin` and `/api/vault/admin/*`
- All admin actions are logged
- Unauthorized access attempts are logged and rejected

### Wallet Type Tracking
All deposits track which wallet type was used:
- `riddle` - Riddle internal wallet
- `xaman` - Xaman XRPL wallet
- `metamask` - MetaMask EVM wallet
- `phantom` - Phantom Solana wallet
- `joey` - Joey XRPL wallet

## Features

### User Features (/vault)
- Deposit native tokens across all 17 chains
- Earn 2.76% APY
- Track rewards in real-time
- Verify deposits with transaction hash
- View contribution history

### Admin Features (/vault-admin)
- Dashboard with total liquidity and statistics
- Chain management (enable/disable chains)
- View all contributions with wallet type breakdown
- Update APY for individual chains or all chains
- Analytics: top contributors, wallet type distribution, chain breakdown
- Recent contributions monitoring with memo tracking

## Database Schema

### vault_contributions
- Tracks individual deposits
- Includes wallet_type, memo, tx_hash
- Rewards calculated automatically
- Status: pending → verified

### vault_chain_stats
- One record per chain (17 total)
- Tracks total liquidity, contributors, APY
- Bank wallet address per chain

### vault_rewards
- Reward distribution history
- Linked to contributions
- Tracks APY applied and period

## API Endpoints

### Public Endpoints
- `GET /api/vault/chains` - List all active chains
- `GET /api/vault/stats` - Overall vault statistics

### Authenticated User Endpoints
- `GET /api/vault/my-contributions` - User's vault deposits
- `POST /api/vault/prepare-deposit` - Prepare a new deposit
- `POST /api/vault/verify-deposit` - Verify deposit transaction

### Admin Endpoints (dippydoge only)
- `GET /api/vault/admin/dashboard` - Admin analytics dashboard
- `GET /api/vault/admin/contributions` - All contributions with filters
- `GET /api/vault/admin/analytics` - Detailed analytics
- `POST /api/vault/admin/update-apy` - Update APY
- `POST /api/vault/admin/toggle-chain` - Enable/disable chains

## Bridge Configuration

The bridge system has been updated to support all 17 native tokens:
- **FROM selector**: All 17 chain native tokens
- **TO selector**: Only XRP
- All tokens bridge TO XRP only (as requested)

## Next Steps Before Production

1. ✅ Database schema deployed
2. ✅ All 17 chains initialized with 2.76% APY
3. ✅ Admin panel secured
4. ⚠️ **UPDATE BANK WALLET ADDRESSES** (see above)
5. Test deposit flow with each chain
6. Test admin panel access control
7. Verify memo system works correctly
8. Test APY update functionality
9. Deploy to production
