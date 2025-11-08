# Vault Rewards System Documentation

## Overview
The vault rewards system allows users to claim and track their rewards separately from deposits. All reward claims and withdrawals are tracked in the database with full transaction history.

## Database Schema Updates

### vault_rewards Table
New fields added for claim tracking:
- `claim_status` (text) - Status: 'pending', 'claimed', 'withdrawn'
- `claimed_at` (timestamp) - When the reward was claimed
- `claim_tx_hash` (text) - Transaction hash of the claim
- `withdrawal_wallet_address` (text) - Where the reward was sent
- `withdrawal_wallet_type` (text) - Type of wallet used (riddle, xaman, metamask, phantom, joey)

Index added on `claim_status` for efficient queries.

## API Endpoints

### User Endpoints

#### GET /api/vault/rewards/my-rewards
Get all rewards for the authenticated user.

**Response:**
```json
{
  "success": true,
  "rewards": [...],
  "aggregated": [...],
  "summary": {
    "total_pending": 5,
    "total_claimed": 3,
    "total_withdrawn": 2
  }
}
```

#### GET /api/vault/rewards/summary
Get summary of rewards grouped by status and chain.

**Response:**
```json
{
  "success": true,
  "summary": [
    {
      "claim_status": "pending",
      "chain": "ethereum",
      "total_amount": "0.5",
      "total_amount_usd": "1250.00",
      "count": 3
    }
  ]
}
```

#### POST /api/vault/rewards/claim
Mark rewards as claimed (does not send funds, just tracks the claim).

**Request:**
```json
{
  "reward_ids": [1, 2, 3],
  "wallet_address": "0x...",
  "wallet_type": "metamask"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully claimed 3 rewards",
  "claimed_rewards": [...]
}
```

#### POST /api/vault/rewards/withdraw
Mark rewards as withdrawn and record transaction hash.

**Request:**
```json
{
  "reward_ids": [1, 2, 3],
  "tx_hash": "0xabc123...",
  "wallet_address": "0x...",
  "wallet_type": "metamask"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully recorded withdrawal of 3 rewards",
  "withdrawn_rewards": [...]
}
```

### Admin Endpoints (dippydoge only)

#### GET /api/vault/admin/rewards
Get all rewards with filters for claim status, chain, and user.

**Query Parameters:**
- `claim_status` - Filter by status (pending, claimed, withdrawn)
- `chain` - Filter by blockchain
- `user_handle` - Filter by user

**Response:**
```json
{
  "success": true,
  "rewards": [...],
  "summary": [
    {
      "claim_status": "pending",
      "count": 150,
      "total_amount": "25.5",
      "total_amount_usd": "50000.00"
    }
  ]
}
```

#### POST /api/vault/admin/rewards/manual-claim
Manually mark rewards as claimed (for admin payouts).

**Request:**
```json
{
  "reward_ids": [1, 2, 3],
  "tx_hash": "0xabc123...",
  "wallet_address": "0x...",
  "wallet_type": "riddle",
  "notes": "Manual payout batch #5"
}
```

## Frontend Components

### RewardsManager Component
Location: `client/src/components/vault/RewardsManager.tsx`

Features:
- View claimable rewards
- Claim individual or all pending rewards
- View claim history
- Track withdrawal status

### Vault Page Integration
The rewards manager is integrated into the vault page as a new tab:
- New Deposit
- Verify Deposit
- My Deposits
- **My Rewards** ← New tab

## User Workflows

### Claiming Rewards

1. **User visits vault page**
   - Navigate to "My Rewards" tab

2. **View pending rewards**
   - See all pending rewards grouped by chain
   - View total amounts and APY applied

3. **Claim rewards**
   - Click "Claim All Pending Rewards" or claim individually
   - System marks rewards as 'claimed'
   - No actual transaction sent (just tracking)

4. **Withdraw rewards**
   - If user actually withdraws funds, they can record the transaction hash
   - System marks rewards as 'withdrawn' with tx hash

### Admin Payout Workflow

1. **Admin reviews pending rewards**
   - Visit `/vault-admin`
   - View rewards tab
   - Filter by status, chain, or user

2. **Process manual payouts**
   - Select rewards to pay out
   - Send funds via blockchain
   - Record transaction hash
   - System marks rewards as 'withdrawn'

## Reward Status Flow

```
pending → claimed → withdrawn
   ↓
   └→ withdrawn (direct payout)
```

- **pending**: Reward calculated but not claimed
- **claimed**: User marked as claimed (tracking only)
- **withdrawn**: Actual payout completed with tx hash

## Security

### User Endpoints
- Require authentication
- Users can only claim/withdraw their own rewards
- Validates reward ownership before any action

### Admin Endpoints
- Require authentication
- Only `dippydoge` can access
- All admin actions are logged
- Unauthorized access attempts are logged

## Database Tracking

Every reward claim/withdrawal is fully tracked:
- When: `claimed_at` timestamp
- Where: `withdrawal_wallet_address`
- How: `withdrawal_wallet_type` (riddle, xaman, metamask, etc.)
- Transaction: `claim_tx_hash`
- Status: `claim_status`

This provides complete audit trail for all reward distributions.

## Example Queries

### Get all pending rewards for a user
```sql
SELECT * FROM vault_rewards 
WHERE user_handle = 'username' 
  AND claim_status = 'pending'
ORDER BY calculated_at DESC;
```

### Get total claimed rewards by chain
```sql
SELECT 
  chain,
  SUM(reward_amount) as total_amount,
  COUNT(*) as count
FROM vault_rewards
WHERE claim_status IN ('claimed', 'withdrawn')
GROUP BY chain;
```

### Get recent withdrawals with transaction hashes
```sql
SELECT 
  user_handle,
  chain,
  reward_amount,
  claim_tx_hash,
  claimed_at
FROM vault_rewards
WHERE claim_status = 'withdrawn'
  AND claim_tx_hash IS NOT NULL
ORDER BY claimed_at DESC
LIMIT 50;
```

## Next Steps

1. **Database Migration**: Run `npm run db:push --force` to apply schema changes
2. **Test Claims**: Test the claim flow with different wallet types
3. **Admin Testing**: Test admin manual claim functionality
4. **Production**: Update bank wallet addresses before going live
