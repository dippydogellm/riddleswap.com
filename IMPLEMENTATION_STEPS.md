# IMMEDIATE ACTION PLAN - Multi-Chain Wallet Integration

## Current Status ✅
**Good News:** Session structure already supports all chains!

```typescript
// Already in riddle-wallet-auth.ts
activeSessions.set(sessionToken, {
  handle: string,
  sessionToken: string,
  expiresAt: number,
  walletData: {
    xrpAddress: string,
    ethAddress: string,
    solAddress: string,
    btcAddress: string
  },
  cachedKeys: {
    xrpPrivateKey: string,
    ethPrivateKey: string,
    solPrivateKey: string,
    btcPrivateKey: string
  }
});
```

## Problems to Fix 🔧

### 1. Session Not Accessible in Game Endpoints
**Files:** `server/routes/inquisition-player-routes.ts`, `server/routes/riddlecity.ts`

**Solution:** Create middleware to inject session data into req object

### 2. Trading V3 Missing Token List
**File:** `client/src/pages/trading-dashboard.tsx`

**Solution:** Add token fetching and display

### 3. No Limit Order System
**Missing:** Backend + Frontend for limit orders

### 4. No Liquidity Pool System  
**Missing:** Backend + Frontend for LP management

## STEP-BY-STEP IMPLEMENTATION

### STEP 1: Session Middleware (15 min) ⏰

Create: `server/middleware/inject-session.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import { getActiveSession } from '../riddle-wallet-auth';

export function injectSessionMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const sessionToken = authHeader?.replace('Bearer ', '');
  
  if (sessionToken) {
    const session = getActiveSession(sessionToken);
    if (session && session.expiresAt > Date.now()) {
      (req as any).riddleSession = session;
      (req as any).walletData = session.walletData;
      (req as any).cachedKeys = session.cachedKeys;
    }
  }
  
  next();
}
```

### STEP 2: Apply Middleware to All Routes (5 min) ⏰

**File:** `server/index.ts`

```typescript
import { injectSessionMiddleware } from './middleware/inject-session';

// Add BEFORE route registrations
app.use(injectSessionMiddleware);
```

### STEP 3: Update Inquisition Routes (10 min) ⏰

**File:** `server/routes/inquisition-player-routes.ts`

```typescript
// In character endpoint, add:
router.get('/character/:characterId', async (req, res) => {
  const session = (req as any).riddleSession;
  const character = await getCharacter(req.params.characterId);
  
  // Add wallet data to response
  res.json({
    ...character,
    wallets: session?.walletData || null
  });
});
```

### STEP 4: Update RiddleCity Routes (10 min) ⏰

**File:** `server/routes/riddlecity.ts`

```typescript
// In city endpoint, add:
router.get('/city/:cityId', async (req, res) => {
  const session = (req as any).riddleSession;
  const city = await getCity(req.params.cityId);
  
  // Add wallet data to response
  res.json({
    ...city,
    wallets: session?.walletData || null
  });
});
```

### STEP 5: Trading V3 Token List Backend (20 min) ⏰

Create: `server/routes/trading-tokens.ts`

```typescript
import { Router } from 'express';
const router = Router();

// Get all available trading tokens
router.get('/tokens', async (req, res) => {
  const session = (req as any).riddleSession;
  
  // Fetch token prices from your price feed
  const tokens = [
    {
      symbol: 'XRP',
      name: 'Ripple',
      address: session?.walletData?.xrpAddress,
      balance: await getXRPBalance(session?.walletData?.xrpAddress),
      price: await getPrice('XRP'),
      chain: 'XRPL'
    },
    {
      symbol: 'SOL',
      name: 'Solana',
      address: session?.walletData?.solAddress,
      balance: await getSOLBalance(session?.walletData?.solAddress),
      price: await getPrice('SOL'),
      chain: 'Solana'
    },
    {
      symbol: 'BTC',
      name: 'Bitcoin',
      address: session?.walletData?.btcAddress,
      balance: await getBTCBalance(session?.walletData?.btcAddress),
      price: await getPrice('BTC'),
      chain: 'Bitcoin'
    },
    {
      symbol: 'ETH',
      name: 'Ethereum',
      address: session?.walletData?.ethAddress,
      balance: await getETHBalance(session?.walletData?.ethAddress),
      price: await getPrice('ETH'),
      chain: 'Ethereum'
    }
  ];
  
  res.json({ success: true, tokens });
});

export default router;
```

### STEP 6: Trading V3 Frontend Token List (30 min) ⏰

**File:** `client/src/pages/trading-dashboard.tsx`

Add this component:

```typescript
function TokenList() {
  const [tokens, setTokens] = useState([]);
  
  useEffect(() => {
    fetch('/api/trading/tokens', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
      }
    })
    .then(res => res.json())
    .then(data => setTokens(data.tokens));
  }, []);
  
  return (
    <Card>
      <CardHeader title="Available Tokens" />
      <CardContent>
        {tokens.map(token => (
          <Box key={token.symbol} sx={{ display: 'flex', justifyContent: 'space-between', p: 2 }}>
            <Typography>{token.name} ({token.symbol})</Typography>
            <Typography>Balance: {token.balance}</Typography>
            <Typography>${token.price}</Typography>
          </Box>
        ))}
      </CardContent>
    </Card>
  );
}
```

### STEP 7: Limit Orders Schema (10 min) ⏰

**File:** `shared/schema.ts`

Add after existing tables:

```typescript
export const limitOrders = pgTable('limit_orders', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userHandle: text('user_handle').notNull(),
  pair: text('pair').notNull(), // e.g., "XRP/USD"
  side: text('side').notNull(), // "buy" or "sell"
  price: text('price').notNull(),
  amount: text('amount').notNull(),
  filled: text('filled').default('0'),
  status: text('status').default('active'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});
```

### STEP 8: Push Schema to Database (2 min) ⏰

```bash
npm run db:generate
npm run db:push
```

### STEP 9: Limit Orders Backend (30 min) ⏰

Create: `server/routes/limit-orders.ts`

```typescript
import { Router } from 'express';
import { db } from '../db';
import { limitOrders } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';

const router = Router();

// Create limit order
router.post('/orders', async (req, res) => {
  const session = (req as any).riddleSession;
  if (!session) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const { pair, side, price, amount } = req.body;
  
  const order = await db.insert(limitOrders).values({
    userHandle: session.handle,
    pair,
    side,
    price,
    amount
  }).returning();
  
  res.json({ success: true, order: order[0] });
});

// Get user's orders
router.get('/orders', async (req, res) => {
  const session = (req as any).riddleSession;
  if (!session) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const orders = await db.select()
    .from(limitOrders)
    .where(eq(limitOrders.userHandle, session.handle));
  
  res.json({ success: true, orders });
});

// Cancel order
router.delete('/orders/:orderId', async (req, res) => {
  const session = (req as any).riddleSession;
  if (!session) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  await db.update(limitOrders)
    .set({ status: 'cancelled' })
    .where(and(
      eq(limitOrders.id, req.params.orderId),
      eq(limitOrders.userHandle, session.handle)
    ));
  
  res.json({ success: true });
});

export default router;
```

### STEP 10: Register New Routes (5 min) ⏰

**File:** `server/index.ts`

```typescript
import tradingTokensRoutes from './routes/trading-tokens';
import limitOrdersRoutes from './routes/limit-orders';

app.use('/api/trading', tradingTokensRoutes);
app.use('/api/trading', limitOrdersRoutes);
```

### STEP 11: Limit Orders Frontend (45 min) ⏰

Create: `client/src/components/trading/LimitOrderPanel.tsx`

```typescript
import { useState } from 'react';
import { Card, CardHeader, CardContent, Button, TextField, Select, MenuItem } from '@mui/material';

export function LimitOrderPanel() {
  const [side, setSide] = useState('buy');
  const [pair, setPair] = useState('XRP/USD');
  const [price, setPrice] = useState('');
  const [amount, setAmount] = useState('');
  
  const handleSubmit = async () => {
    const res = await fetch('/api/trading/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
      },
      body: JSON.stringify({ pair, side, price, amount })
    });
    
    if (res.ok) {
      alert('Order placed!');
    }
  };
  
  return (
    <Card>
      <CardHeader title="Place Limit Order" />
      <CardContent>
        <Select value={side} onChange={e => setSide(e.target.value)}>
          <MenuItem value="buy">Buy</MenuItem>
          <MenuItem value="sell">Sell</MenuItem>
        </Select>
        
        <Select value={pair} onChange={e => setPair(e.target.value)}>
          <MenuItem value="XRP/USD">XRP/USD</MenuItem>
          <MenuItem value="SOL/USD">SOL/USD</MenuItem>
          <MenuItem value="BTC/USD">BTC/USD</MenuItem>
          <MenuItem value="ETH/USD">ETH/USD</MenuItem>
        </Select>
        
        <TextField label="Price" value={price} onChange={e => setPrice(e.target.value)} />
        <TextField label="Amount" value={amount} onChange={e => setAmount(e.target.value)} />
        
        <Button onClick={handleSubmit}>Place Order</Button>
      </CardContent>
    </Card>
  );
}
```

## TOTAL TIME: ~3 hours ⏰

## PRIORITY ORDER:
1. ✅ Session Middleware (CRITICAL - enables everything else)
2. ✅ Apply middleware globally
3. ✅ Trading tokens endpoint
4. ✅ Trading frontend token list
5. ✅ Limit orders schema
6. ✅ Limit orders backend
7. ✅ Limit orders frontend
8. ⏳ Inquisition wallet integration
9. ⏳ RiddleCity wallet integration
10. ⏳ Liquidity pools (Phase 2)

## START HERE:

```bash
# 1. Create the middleware file
# 2. Update server/index.ts
# 3. Run: npm run dev
# 4. Test session injection works
# 5. Continue with trading tokens
```

Would you like me to start implementing these files now?
