# NFT Broker Mainnet Setup Guide
**Production Deployment - XRPL Mainnet**

## ⚠️ MAINNET ONLY - Real Funds
This guide is for **XRPL mainnet production deployment**. Your broker wallet will hold real XRP and NFTs.

---

## Step 1: Prepare Broker Wallet (MAINNET)

### Option A: Use Existing Wallet
If you already have an XRPL mainnet wallet:
1. Ensure it has at least **100 XRP** balance (200+ XRP recommended)
2. Copy your wallet address (starts with 'r')
3. Copy your wallet secret/seed (starts with 's')

### Option B: Create New Wallet
1. Go to https://xrpl.org/accounts.html
2. Generate a new wallet for mainnet
3. **Save credentials securely** - you'll need:
   - Wallet address (e.g., `rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY`)
   - Wallet secret (e.g., `sYourSecretSeedHere`)

---

## Step 2: Fund Broker Wallet

### Transfer XRP to Broker Address
1. Transfer **minimum 100 XRP** from your exchange or existing wallet
2. **Recommended: 200+ XRP** for production stability
3. Account needs **10 XRP base reserve** + **2 XRP per object**

### Verify Balance
Check your broker wallet balance on:
- https://livenet.xrpl.org (enter your broker address)
- https://bithomp.com/explorer (search your address)
- https://xrpscan.com (search your address)

✅ Confirm balance shows **100+ XRP** before proceeding

---

## Step 3: Configure Environment Variables

### Edit `.env` File
```bash
# Copy template
cp .env.broker.template .env

# Edit with your mainnet credentials
nano .env
```

### Add Your Mainnet Broker Credentials
```bash
# RiddleNFTBroker (Security-First Implementation)
RIDDLE_BROKER_ADDRESS=rYourMainnetBrokerAddress
RIDDLE_BROKER_SECRET=sYourMainnetBrokerSeed

# NFTBrokerService (Simplified Implementation)
# Use SAME seed as above for both brokers
BROKER_WALLET_SEED=sYourMainnetBrokerSeed
```

**Example:**
```bash
RIDDLE_BROKER_ADDRESS=rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY
RIDDLE_BROKER_SECRET=sEdSKaCy2JT7JaM7v95H9SxkhP9wS2r
BROKER_WALLET_SEED=sEdSKaCy2JT7JaM7v95H9SxkhP9wS2r
```

⚠️ **IMPORTANT:** Keep your `.env` file secure - it contains real mainnet credentials!

---

## Step 4: Verify Configuration

### Check Environment Variables
```bash
# Verify broker address is set
echo $RIDDLE_BROKER_ADDRESS

# Verify seed is set (will show the seed - be careful!)
echo $RIDDLE_BROKER_SECRET
```

### Expected Output
```
rYourMainnetBrokerAddress
sYourMainnetBrokerSeed
```

✅ Both should match your mainnet broker wallet

---

## Step 5: Start Server

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

---

## Step 6: Verify Broker Initialization

### Check Server Logs
You should see:

**RiddleNFTBroker:**
```
🏦 RiddleNFTBroker initialized: RiddleNFTBroker
📍 Broker Address: rYourMainnetAddress...
✅ RiddleNFTBroker connected to XRPL
💰 Broker wallet balance: 200 XRP
```

**NFTBrokerService:**
```
🏦 NFT Broker Service initialized
📍 Broker Address: rYourMainnetAddress...
✅ Broker connected to XRPL
```

✅ Both brokers should show the **same address**  
✅ Balance should show **100+ XRP**

---

## Step 7: Test Broker Endpoints

### Test Broker Info (Public)
```bash
curl http://localhost:5000/api/broker/info
```

**Expected Response:**
```json
{
  "brokerAddress": "rYourMainnetAddress...",
  "balance": "200",
  "networkConnected": true
}
```

### Test Broker NFT Inventory
```bash
curl http://localhost:5000/api/broker/nfts
```

**Expected Response:**
```json
{
  "nfts": [],
  "count": 0
}
```

---

## 🔐 Security Checklist

Before going live, verify:

- [ ] ✅ Broker wallet has 100+ XRP on **MAINNET**
- [ ] ✅ `.env` file is **NOT** committed to git
- [ ] ✅ Broker credentials stored securely
- [ ] ✅ Server logs show successful initialization
- [ ] ✅ Both brokers show same mainnet address
- [ ] ✅ Balance verified on XRPL explorer
- [ ] ✅ Test endpoints return correct data
- [ ] ✅ Broker can connect to XRPL mainnet

---

## 🚨 Production Safety

### Do NOT Deploy If:
- ❌ Broker wallet has less than 100 XRP
- ❌ Using testnet credentials
- ❌ `.env` file is committed to git
- ❌ Server shows connection errors
- ❌ Balance shows 0 or unavailable

### Safe to Deploy If:
- ✅ Broker wallet funded with 100+ XRP on **mainnet**
- ✅ Environment variables set correctly
- ✅ Both brokers initialize successfully
- ✅ Test endpoints work
- ✅ Logs show mainnet connection

---

## 📊 Monitoring (Post-Deployment)

### Check Broker Balance Regularly
```bash
# Via API
curl http://localhost:5000/api/broker/info | jq '.balance'

# Via XRPL Explorer
# Visit: https://livenet.xrpl.org
# Enter: Your broker address
```

### Watch for Low Balance
- 🔴 **Alert when <50 XRP** - Broker needs funding
- ⚠️ **Warning when <100 XRP** - Plan to add more XRP
- ✅ **Safe when >100 XRP** - Normal operations

### Monitor Broker Fees
Broker collects:
- **RiddleNFTBroker:** 1% fee per transaction
- **NFTBrokerService:** 1.589% fee per transaction

Fees accumulate in broker wallet automatically.

---

## 🔄 Broker Wallet Management

### Check Broker Holdings
```bash
# Get broker NFT inventory
curl http://localhost:5000/api/broker/nfts

# View on explorer
# https://livenet.xrpl.org (enter broker address)
```

### Add More XRP
If broker balance gets low:
1. Transfer XRP from your wallet to broker address
2. Confirm transaction on explorer
3. Verify new balance via API or logs

### Withdraw Broker Fees
To withdraw accumulated fees:
1. Use XRPL wallet (e.g., Xaman, Crossmark)
2. Import broker seed securely
3. Transfer XRP to your personal wallet
4. Keep minimum 100 XRP in broker for operations

---

## ⚠️ Emergency Procedures

### If Broker Balance <10 XRP
1. ⚠️ **URGENT:** Broker cannot operate
2. Transfer XRP immediately to broker address
3. Wait for transaction confirmation
4. Restart server to reconnect

### If Broker Disconnects
1. Check server logs for error messages
2. Verify XRPL mainnet status: https://xrpl.org
3. Restart server: `npm restart`
4. Check broker initialization logs

### If Wrong Credentials
1. Stop server immediately
2. Update `.env` with correct mainnet credentials
3. Verify broker address on explorer
4. Restart server and check logs

---

## 📚 Related Documentation

- `BROKER_PRODUCTION_READY.md` - Complete production readiness guide
- `DUAL_BROKER_CONFIG.md` - Detailed broker configuration
- `BROKER_ROUTE_MAPPING.md` - All broker routes explained
- `.env.broker.template` - Environment variable template

---

## ✅ Mainnet Deployment Complete

Once you see:
- ✅ Both brokers initialized successfully
- ✅ Mainnet address confirmed
- ✅ Balance shows 100+ XRP
- ✅ Test endpoints working

**Your NFT broker system is live on XRPL mainnet!** 🎉

---

## Support

For issues or questions:
1. Check server logs for errors
2. Verify broker balance on XRPL explorer
3. Review documentation files
4. Ensure mainnet (not testnet) configuration

**Remember:** You're using real mainnet XRP - keep credentials secure!
