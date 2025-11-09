# Database Migration & Session Enhancement Plan

## Overview
Complete migration to new database with enhanced session management for multi-chain wallets (XRP, SOL, BTC, ETH) accessible across Inquisition, RiddleCity, and Trading V3.

## Phase 1: Session Enhancement (Priority: CRITICAL)

### 1.1 Enhanced Session Structure
```typescript
interface EnhancedSession {
  handle: string;
  expiresAt: number;
  ipAddress: string;
  
  // Multi-chain wallet data
  walletData: {
    xrp: { address: string; balance: string; };
    sol: { address: string; balance: string; };
    btc: { address: string; balance: string; };
    eth: { address: string; balance: string; };
  };
  
  // Cached private keys (encrypted in production)
  cachedKeys: {
    xrpPrivateKey: string;
    solPrivateKey: string;
    btcPrivateKey: string;
    ethPrivateKey: string;
  };
  
  // Character data for games
  characterData?: {
    inquisition?: any;
    riddleCity?: any;
  };
}
```

### 1.2 Files to Modify
- [ ] `server/riddle-wallet-auth.ts` - Update session structure
- [ ] `server/session-check-endpoint.ts` - Return full wallet data
- [ ] `server/external-wallet-routes.ts` - Cache all chain addresses
- [ ] `client/src/utils/sessionManager.ts` - Handle multi-chain data

### 1.3 Implementation Steps
1. Update `getActiveSession()` to return enhanced session
2. Modify login endpoints to cache all wallet addresses
3. Update session middleware to inject wallet data
4. Add session refresh endpoint for wallet balance updates

## Phase 2: Trading V3 Frontend (Priority: HIGH)

### 2.1 Token Population
**File:** `client/src/pages/trading-dashboard.tsx`

Required Features:
- [ ] Token list component with live prices
- [ ] Multi-chain token support (XRP, SOL, ETH, BTC)
- [ ] Search/filter tokens
- [ ] Balance display from session

### 2.2 Limit Orders
**Files to Create:**
- `client/src/components/trading/LimitOrderPanel.tsx`
- `server/routes/limit-orders.ts`

Features:
- [ ] Buy/Sell limit order placement
- [ ] Order book display
- [ ] Active orders management
- [ ] Order history
- [ ] Price alerts

### 2.3 Liquidity Pool Management
**Files to Create:**
- `client/src/components/trading/LiquidityPanel.tsx`
- `server/routes/liquidity-pools.ts`

Features:
- [ ] Add liquidity interface
- [ ] Remove liquidity interface  
- [ ] LP token tracking
- [ ] Fee earnings display
- [ ] Impermanent loss calculator

## Phase 3: Database Schema Updates (Priority: CRITICAL)

### 3.1 New Tables Needed

```sql
-- Trading Orders
CREATE TABLE limit_orders (
  id UUID PRIMARY KEY,
  user_handle TEXT NOT NULL,
  pair TEXT NOT NULL, -- e.g., "XRP/USD"
  side TEXT NOT NULL, -- "buy" or "sell"
  price DECIMAL(30, 10) NOT NULL,
  amount DECIMAL(30, 10) NOT NULL,
  filled DECIMAL(30, 10) DEFAULT 0,
  status TEXT DEFAULT 'active', -- active, filled, cancelled
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Liquidity Pools
CREATE TABLE liquidity_pools (
  id UUID PRIMARY KEY,
  token_a TEXT NOT NULL,
  token_b TEXT NOT NULL,
  reserve_a DECIMAL(30, 10) NOT NULL,
  reserve_b DECIMAL(30, 10) NOT NULL,
  lp_token_supply DECIMAL(30, 10) NOT NULL,
  fee_rate DECIMAL(5, 4) DEFAULT 0.003,
  created_at TIMESTAMP DEFAULT NOW()
);

-- User LP Positions
CREATE TABLE lp_positions (
  id UUID PRIMARY KEY,
  user_handle TEXT NOT NULL,
  pool_id UUID REFERENCES liquidity_pools(id),
  lp_tokens DECIMAL(30, 10) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Enhanced Character Wallets
ALTER TABLE inquisition_characters ADD COLUMN IF NOT EXISTS wallet_xrp TEXT;
ALTER TABLE inquisition_characters ADD COLUMN IF NOT EXISTS wallet_sol TEXT;
ALTER TABLE inquisition_characters ADD COLUMN IF NOT EXISTS wallet_btc TEXT;
ALTER TABLE inquisition_characters ADD COLUMN IF NOT EXISTS wallet_eth TEXT;

ALTER TABLE riddlecity_citizens ADD COLUMN IF NOT EXISTS wallet_xrp TEXT;
ALTER TABLE riddlecity_citizens ADD COLUMN IF NOT EXISTS wallet_sol TEXT;
ALTER TABLE riddlecity_citizens ADD COLUMN IF NOT EXISTS wallet_btc TEXT;
ALTER TABLE riddlecity_citizens ADD COLUMN IF NOT EXISTS wallet_eth TEXT;
```

### 3.2 Schema File Updates
**File:** `shared/schema.ts`

Add:
```typescript
export const limitOrders = pgTable('limit_orders', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userHandle: text('user_handle').notNull(),
  pair: text('pair').notNull(),
  side: text('side').notNull(),
  price: decimal('price', { precision: 30, scale: 10 }).notNull(),
  amount: decimal('amount', { precision: 30, scale: 10 }).notNull(),
  filled: decimal('filled', { precision: 30, scale: 10 }).default('0'),
  status: text('status').default('active'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const liquidityPools = pgTable('liquidity_pools', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  tokenA: text('token_a').notNull(),
  tokenB: text('token_b').notNull(),
  reserveA: decimal('reserve_a', { precision: 30, scale: 10 }).notNull(),
  reserveB: decimal('reserve_b', { precision: 30, scale: 10 }).notNull(),
  lpTokenSupply: decimal('lp_token_supply', { precision: 30, scale: 10 }).notNull(),
  feeRate: decimal('fee_rate', { precision: 5, scale: 4 }).default('0.003'),
  createdAt: timestamp('created_at').defaultNow()
});

export const lpPositions = pgTable('lp_positions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userHandle: text('user_handle').notNull(),
  poolId: text('pool_id').notNull().references(() => liquidityPools.id),
  lpTokens: decimal('lp_tokens', { precision: 30, scale: 10 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});
```

## Phase 4: Database Migration Script

### 4.1 Migration Command
```bash
# Create migration
npm run db:generate

# Apply migration
npm run db:push

# Or manually:
psql $DATABASE_URL < migration.sql
```

### 4.2 Data Migration Script
**File:** `server/scripts/migrate-to-new-db.ts`

Steps:
1. Export all data from current database
2. Transform data to new schema
3. Import to new database
4. Verify data integrity
5. Update connection strings
6. Test all endpoints

## Phase 5: Integration Points

### 5.1 Inquisition Integration
**File:** `server/routes/inquisition-player-routes.ts`

- [ ] Add wallet data to character response
- [ ] Update character creation to include wallets
- [ ] Add wallet balance endpoints

### 5.2 RiddleCity Integration  
**File:** `server/routes/riddlecity.ts`

- [ ] Add wallet data to citizen response
- [ ] Enable multi-chain transactions
- [ ] Add wallet-based resource management

### 5.3 Trading V3 Integration
**Files:** `server/routes/trading-*.ts`

- [ ] Connect to enhanced session
- [ ] Implement limit order engine
- [ ] Implement AMM liquidity pools
- [ ] Add real-time price feeds

## Phase 6: Testing Checklist

- [ ] Session persists all wallet addresses
- [ ] Inquisition characters see wallet balances
- [ ] RiddleCity citizens can use multi-chain wallets
- [ ] Trading V3 populates token list
- [ ] Limit orders can be placed/cancelled
- [ ] Liquidity can be added/removed
- [ ] Database migration successful
- [ ] All TypeScript errors resolved

## Implementation Order

1. **DAY 1:** Session enhancement + Schema updates
2. **DAY 2:** Database migration + Data transfer
3. **DAY 3:** Trading V3 frontend (token list + limit orders)
4. **DAY 4:** Liquidity pool interface
5. **DAY 5:** Integration testing + Bug fixes

## Commands to Run

```bash
# 1. Update schema
npm run db:generate

# 2. Push to database
npm run db:push

# 3. Run migration script
npm run migrate:data

# 4. Test TypeScript
npx tsc --noEmit

# 5. Start server
npm run dev
```

## Critical Files to Create/Modify

### Create:
- `server/routes/limit-orders.ts`
- `server/routes/liquidity-pools.ts`
- `server/scripts/migrate-to-new-db.ts`
- `client/src/components/trading/LimitOrderPanel.tsx`
- `client/src/components/trading/LiquidityPanel.tsx`
- `client/src/components/trading/TokenList.tsx`

### Modify:
- `server/riddle-wallet-auth.ts`
- `server/session-check-endpoint.ts`
- `server/external-wallet-routes.ts`
- `shared/schema.ts`
- `client/src/pages/trading-dashboard.tsx`
- `server/routes/inquisition-player-routes.ts`
- `server/routes/riddlecity.ts`

## Next Steps

Run this command to start:
```bash
node server/scripts/implement-migration.js
```

This will guide you through each phase interactively.
