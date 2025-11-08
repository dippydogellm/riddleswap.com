# NFT Broker Quick Start - Your Wallet is Funded ✅

Your broker wallet has **100 XRP on mainnet** - you're ready to go!

---

## ✅ Quick Verification Steps

### 1. Add Broker Credentials to `.env`

```bash
# Edit your .env file
nano .env
```

Add your mainnet broker wallet credentials:
```bash
RIDDLE_BROKER_ADDRESS=rYourMainnetBrokerAddress
RIDDLE_BROKER_SECRET=sYourMainnetBrokerSeed
BROKER_WALLET_SEED=sYourMainnetBrokerSeed
```

### 2. Restart Server

```bash
npm run dev
```

### 3. Check Logs for Success

You should see:
```
🏦 RiddleNFTBroker initialized: RiddleNFTBroker
📍 Broker Address: rYourAddress...
✅ RiddleNFTBroker connected to XRPL
💰 Broker wallet balance: 100 XRP

🏦 NFT Broker Service initialized
📍 Broker Address: rYourAddress...
✅ Broker connected to XRPL
```

### 4. Test Broker API

```bash
# Test broker info endpoint
curl http://localhost:5000/api/broker/info
```

**Expected Response:**
```json
{
  "brokerAddress": "rYourAddress...",
  "balance": "100",
  "networkConnected": true
}
```

---

## 🎯 Your Broker is Ready!

With 100 XRP funded, your broker can now:
- ✅ Create NFT buy/sell offers
- ✅ Match offers between buyers and sellers
- ✅ Collect broker fees (1-1.589%)
- ✅ Manage NFT inventory
- ✅ Handle brokered transactions

---

## 🚀 Next Steps

### Test NFT Operations

**1. Create a Buy Offer:**
```bash
curl -X POST http://localhost:5000/api/nft/buy-offers/create-offer \
  -H "Content-Type: application/json" \
  -d '{
    "nftId": "NFT_ID_HERE",
    "amount": "10",
    "offerType": "buy"
  }'
```

**2. Check Broker Inventory:**
```bash
curl http://localhost:5000/api/broker/nfts
```

**3. View Available Routes:**
See `BROKER_ROUTE_MAPPING.md` for all 14 broker endpoints.

---

## 💰 Broker Fee Collection

Your broker automatically collects fees on each transaction:
- **RiddleNFTBroker:** 1% per transaction
- **NFTBrokerService:** 1.589% per transaction

Fees accumulate in your broker wallet and can be withdrawn anytime.

---

## 📊 Monitor Your Broker

### Check Balance Anytime
```bash
curl http://localhost:5000/api/broker/info | jq '.balance'
```

### View on XRPL Explorer
- https://livenet.xrpl.org (enter your broker address)
- https://bithomp.com/explorer
- https://xrpscan.com

---

## ✅ You're Live on Mainnet!

Your NFT broker system is now operational on XRPL mainnet with 100 XRP funding. Start accepting NFT trades! 🚀
