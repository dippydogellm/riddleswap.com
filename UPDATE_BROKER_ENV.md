# Update Broker Configuration - Use Funded Wallet

## Current Status
- ✅ **Funded Wallet**: `rGLzXKif4ksBZe2MY6RZT9m69hdgzsXG4X` (100 XRP)
- ✅ **NFTBrokerService**: Using funded wallet ✅
- ❌ **RiddleNFTBroker**: Using different wallet (unfunded) ❌

## Required Fix

Update your `.env` file to make **BOTH brokers use the same funded wallet**.

### Step 1: Edit .env File

```bash
nano .env
```

### Step 2: Update These Variables

You need to set:
```bash
# Make sure these THREE variables all match your funded wallet
RIDDLE_BROKER_ADDRESS=rGLzXKif4ksBZe2MY6RZT9m69hdgzsXG4X
RIDDLE_BROKER_SECRET=sYourSeedForThisFundedWallet
BROKER_WALLET_SEED=sYourSeedForThisFundedWallet
```

**Important:** 
- The **RIDDLE_BROKER_SECRET** and **BROKER_WALLET_SEED** must be the **SAME seed** that generates address `rGLzXKif4ksBZe2MY6RZT9m69hdgzsXG4X`
- You already have the correct BROKER_WALLET_SEED set (it generates the funded address)
- Copy that same seed to RIDDLE_BROKER_SECRET

### Step 3: Restart Server

```bash
# Stop server (Ctrl+C if running)
npm run dev
```

### Step 4: Verify Both Brokers

You should see:
```
🏦 RiddleNFTBroker initialized: RiddleNFTBroker
📍 Broker Address: rGLzXKif4ksBZe2MY6RZT9m69hdgzsXG4X  ✅
💰 Broker wallet balance: 100 XRP  ✅

🏦 NFT Broker Service initialized
📍 Broker Address: rGLzXKif4ksBZe2MY6RZT9m69hdgzsXG4X  ✅
```

Both addresses should be **`rGLzXKif4ksBZe2MY6RZT9m69hdgzsXG4X`** ✅

---

## Quick Summary

Your BROKER_WALLET_SEED already has the correct seed for the funded wallet. You just need to:

1. **Copy the same seed** from BROKER_WALLET_SEED 
2. **Set it as** RIDDLE_BROKER_SECRET
3. **Update** RIDDLE_BROKER_ADDRESS to `rGLzXKif4ksBZe2MY6RZT9m69hdgzsXG4X`
4. **Restart** the server

Then both brokers will use your funded 100 XRP wallet! 🚀
