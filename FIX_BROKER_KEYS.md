# Fix Broker Private Keys - Step by Step

## Problem
Your two brokers are using **different wallets**. Only one has 100 XRP.

**Current Status:**
- ❌ RiddleNFTBroker: `rGDJxq11nj6gstTrUKND3NtAaLtSUGqvDY` (UNFUNDED)
- ✅ NFTBrokerService: `rGLzXKif4ksBZe2MY6RZT9m69hdgzsXG4X` (100 XRP ✅)

## Solution
Update your `.env` file so **BOTH brokers use the funded wallet**.

---

## Step 1: Open Your .env File

```bash
nano .env
```

---

## Step 2: Find Your BROKER_WALLET_SEED

Look for this line in your `.env`:
```bash
BROKER_WALLET_SEED=sYourSecretSeedHere
```

This seed generates the **funded wallet** `rGLzXKif4ksBZe2MY6RZT9m69hdgzsXG4X` ✅

---

## Step 3: Copy the SAME Seed to RiddleNFTBroker

Update these lines in your `.env`:

```bash
# CHANGE THIS - Update to funded wallet address
RIDDLE_BROKER_ADDRESS=rGLzXKif4ksBZe2MY6RZT9m69hdgzsXG4X

# CHANGE THIS - Use the SAME seed as BROKER_WALLET_SEED
RIDDLE_BROKER_SECRET=sYourSecretSeedHere

# KEEP THIS - Already correct
BROKER_WALLET_SEED=sYourSecretSeedHere
```

**Important:** All three values must match:
- `RIDDLE_BROKER_ADDRESS` = `rGLzXKif4ksBZe2MY6RZT9m69hdgzsXG4X`
- `RIDDLE_BROKER_SECRET` = Same seed as BROKER_WALLET_SEED
- `BROKER_WALLET_SEED` = (already set correctly)

---

## Step 4: Save and Close

Press `Ctrl+O` to save, then `Ctrl+X` to exit.

---

## Step 5: Server Will Auto-Restart

The server will automatically restart when you save `.env`.

---

## Step 6: Verify Both Brokers

Watch the logs - you should see:

```
🏦 RiddleNFTBroker initialized
📍 Broker Address: rGLzXKif4ksBZe2MY6RZT9m69hdgzsXG4X ✅
💰 Broker wallet balance: 100 XRP ✅

🏦 NFT Broker Service initialized
📍 Broker Address: rGLzXKif4ksBZe2MY6RZT9m69hdgzsXG4X ✅
```

Both should show:
- ✅ Same address: `rGLzXKif4ksBZe2MY6RZT9m69hdgzsXG4X`
- ✅ Balance: 100 XRP

---

## Quick Check

To verify your wallet seed is correct, you can use XRPL tools to confirm the seed generates address `rGLzXKif4ksBZe2MY6RZT9m69hdgzsXG4X`.

---

## Summary

1. Open `.env`
2. Copy your BROKER_WALLET_SEED value
3. Set RIDDLE_BROKER_SECRET to the same seed
4. Set RIDDLE_BROKER_ADDRESS to `rGLzXKif4ksBZe2MY6RZT9m69hdgzsXG4X`
5. Save (server auto-restarts)
6. Check logs - both brokers should show same funded address

✅ Done! Both brokers will now use your 100 XRP funded wallet!
