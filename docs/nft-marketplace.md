# NFT Marketplace
## XRPL XLS-20 Brokered Sales & Project Launchpad

**Version 1.0** | **October 2025**

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [XLS-20 Brokered Sales](#xls-20-brokered-sales)
3. [Marketplace Features](#marketplace-features)
4. [NFT Minting System](#nft-minting-system)
5. [Project Launchpad](#project-launchpad)
6. [Offer System](#offer-system)
7. [Fee Structure](#fee-structure)
8. [Marketing & Promotion](#marketing-promotion)
9. [Airdrop & Snapshot Tools](#airdrop-snapshot-tools)
10. [User Guide](#user-guide)

---

## Executive Summary

RiddleSwap's NFT Marketplace leverages XRPL's native XLS-20 standard with an innovative brokered sales system for atomic, trustless NFT trading. Our platform combines marketplace functionality with a comprehensive project launchpad for creators.

### Key Features

- **XLS-20 Native**: Built on XRPL's NFT standard
- **Brokered Sales**: Automated atomic settlements with 1% broker fee
- **Project Launchpad**: Complete NFT project creation and management
- **IPFS Integration**: Decentralized metadata and image storage via Pinata
- **Vanity URLs**: Custom SEO-optimized project pages
- **Airdrop Tools**: Automated token and NFT distribution
- **Snapshot System**: Holder and trader analytics

---

## XLS-20 Brokered Sales

### What is XLS-20?

**XRPL Native NFT Standard**

XLS-20 is the native NFT standard on the XRP Ledger, offering:
- On-ledger NFT creation (no smart contracts)
- Atomic offer/accept transactions
- Built-in royalty support
- Lower costs than EVM NFTs
- Faster transaction finality (3-5 seconds)

### Brokered Sales Model

**Traditional vs. Brokered**

```
Traditional NFT Sale:
Seller → Creates offer → Buyer accepts
Problem: Manual payment distribution, no platform fees

Brokered Sale (RiddleSwap):
Seller → Creates offer with broker → Broker accepts on buyer's behalf
Result: Automatic fee distribution, seamless UX
```

### How Brokered Sales Work

**Step 1: Seller Creates Sell Offer**

```javascript
const createBrokeredSellOffer = async (nftTokenId, priceXRP, brokerAddress) => {
  const tx = {
    TransactionType: 'NFTokenCreateOffer',
    Account: sellerAddress,
    NFTokenID: nftTokenId,
    Amount: String(priceXRP * 1_000_000), // Convert to drops
    Destination: brokerAddress, // RiddleSwap broker wallet
    Flags: 1 // tfSellToken
  };
  
  const result = await client.submit(tx);
  return result.hash;
};
```

**Step 2: Buyer Initiates Purchase**

```javascript
const initiatePurchase = async (offerIndex, buyerAddress) => {
  // Buyer approves purchase on frontend
  // Backend broker wallet accepts offer
  
  const acceptTx = {
    TransactionType: 'NFTokenAcceptOffer',
    Account: brokerWalletAddress,
    NFTokenSellOffer: offerIndex
  };
  
  // Broker wallet automatically distributes:
  // 99% to seller
  // 1% to platform
  
  return await submitBrokeredAccept(acceptTx);
};
```

**Step 3: Automatic Payment Distribution**

```javascript
const distributeBrokeredPayment = (totalAmount) => {
  const platformFee = totalAmount * 0.01; // 1%
  const sellerAmount = totalAmount * 0.99; // 99%
  
  return {
    seller: sellerAmount,
    platform: platformFee
  };
};
```

### Security Features

**IOU Protection**

```javascript
const validateOffer = async (offerIndex) => {
  const offer = await getOffer(offerIndex);
  
  // CRITICAL: Only accept XRP offers, not IOUs
  if (typeof offer.Amount === 'object') {
    throw new Error('IOU offers not supported. XRP only.');
  }
  
  // Validate offer hasn't expired
  if (offer.Expiration && offer.Expiration < Date.now()) {
    throw new Error('Offer has expired');
  }
  
  return true;
};
```

**Password-Protected Operations**

```javascript
const acceptBrokeredOffer = async (offerIndex, password) => {
  // Decrypt broker wallet private key
  const brokerKey = await decryptBrokerWallet(password);
  
  // Submit accept transaction
  const tx = {
    TransactionType: 'NFTokenAcceptOffer',
    Account: brokerWalletAddress,
    NFTokenSellOffer: offerIndex
  };
  
  const signed = brokerKey.sign(tx);
  return await client.submitAndWait(signed);
};
```

---

## Marketplace Features

### Browse & Discovery

**Search & Filters**

```typescript
interface MarketplaceFilters {
  collections?: string[];      // Filter by collection
  minPrice?: number;           // Minimum price in XRP
  maxPrice?: number;           // Maximum price in XRP
  traits?: Record<string, string[]>; // Trait filters
  sortBy?: 'price_asc' | 'price_desc' | 'newest' | 'ending_soon';
}
```

**Collection View**

```sql
-- Get all NFTs in a collection
SELECT 
  n.nft_token_id,
  n.image_url,
  n.metadata,
  o.price_xrp,
  o.offer_index,
  o.expires_at
FROM nft_marketplace n
LEFT JOIN nft_offers o ON n.id = o.nft_id
WHERE n.issuer = 'rCollectionIssuer...'
  AND o.status = 'active'
ORDER BY o.price_xrp ASC;
```

### Trending & Featured

**Trending Algorithm**

```javascript
const calculateTrendingScore = (nft) => {
  const recentSales = getRecentSales(nft.tokenId, 24); // Last 24h
  const views = getNFTViews(nft.tokenId, 24);
  const offers = getActiveOffers(nft.tokenId);
  
  // Weighted score
  return (
    (recentSales.length * 10) +
    (views * 0.1) +
    (offers.length * 5)
  );
};
```

**Featured Collections**

```typescript
interface FeaturedCollection {
  issuer: string;
  name: string;
  floorPrice: number;
  volume24h: number;
  sales24h: number;
  totalSupply: number;
  verified: boolean;
}
```

---

## NFT Minting System

### Minting Escrow

**Automated Broker-Based Minting**

```javascript
const mintNFTWithEscrow = async (metadata, imageUrl, issuerAddress) => {
  // 1. Upload to IPFS
  const ipfsHash = await pinToPinata({
    image: imageUrl,
    metadata: metadata
  });
  
  // 2. Create mint transaction
  const mintTx = {
    TransactionType: 'NFTokenMint',
    Account: brokerWalletAddress, // Broker mints on behalf
    URI: Buffer.from(ipfsHash).toString('hex'),
    Flags: 8, // tfTransferable
    TransferFee: metadata.royaltyBps || 0, // e.g., 500 = 5%
    NFTokenTaxon: 0
  };
  
  // 3. Submit mint
  const result = await submitBrokeredMint(mintTx);
  
  // 4. Transfer to issuer
  await transferNFT(result.nftTokenId, issuerAddress);
  
  return result.nftTokenId;
};
```

### IPFS Integration (Pinata)

**Upload Metadata**

```javascript
const pinJSONToPinata = async (metadata) => {
  const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${PINATA_JWT}`
    },
    body: JSON.stringify({
      pinataContent: metadata,
      pinataMetadata: {
        name: metadata.name
      }
    })
  });
  
  const data = await response.json();
  return data.IpfsHash; // e.g., QmX...
};
```

**Upload Image**

```javascript
const pinImageToPinata = async (imageFile) => {
  const formData = new FormData();
  formData.append('file', imageFile);
  
  const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PINATA_JWT}`
    },
    body: formData
  });
  
  const data = await response.json();
  return `ipfs://${data.IpfsHash}`;
};
```

### Royalty Support

**On-Chain Royalties**

```javascript
const mintWithRoyalties = async (metadata, royaltyPercentage) => {
  // Convert percentage to basis points (5% = 500)
  const transferFee = royaltyPercentage * 100;
  
  const mintTx = {
    TransactionType: 'NFTokenMint',
    Account: creatorAddress,
    URI: metadataURI,
    TransferFee: transferFee, // Max 50% (50000 basis points)
    Flags: 8 // tfTransferable
  };
  
  return await client.submit(mintTx);
};
```

---

## Project Launchpad

### Project Creation

**Create NFT Project**

```typescript
interface NFTProject {
  name: string;
  description: string;
  issuerAddress: string;
  totalSupply: number;
  mintPrice: number; // XRP
  royaltyPercentage: number;
  vanityUrl: string; // e.g., "riddletrolls"
  bannerImage: string;
  logoImage: string;
  socialLinks: {
    twitter?: string;
    discord?: string;
    website?: string;
  };
}
```

**Database Schema**

```sql
CREATE TABLE nft_projects (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  vanity_url VARCHAR(100) UNIQUE,
  issuer_address VARCHAR(255) NOT NULL,
  total_supply INTEGER,
  minted_count INTEGER DEFAULT 0,
  floor_price NUMERIC(20, 6),
  volume_total NUMERIC(20, 6),
  verified BOOLEAN DEFAULT FALSE,
  featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Auto-Detection

**Detect Projects from Issuer**

```javascript
const detectNFTProject = async (issuerAddress) => {
  // Query XRPL for NFTs minted by issuer
  const response = await client.request({
    command: 'account_nfts',
    account: issuerAddress,
    ledger_index: 'validated'
  });
  
  const nfts = response.result.account_nfts;
  
  // Analyze NFTs to create project
  const project = {
    issuer: issuerAddress,
    totalSupply: nfts.length,
    nftTokenIds: nfts.map(n => n.NFTokenID),
    commonTraits: extractCommonTraits(nfts)
  };
  
  return project;
};
```

### Vanity URLs & SEO

**Custom Project Pages**

```
https://riddleswap.com/collection/riddletrolls
https://riddleswap.com/collection/galactictrolls
https://riddleswap.com/collection/luxurytrolls
```

**SEO Optimization**

```html
<head>
  <title>{{projectName}} | RiddleSwap NFT Marketplace</title>
  <meta name="description" content="{{projectDescription}}">
  <meta property="og:title" content="{{projectName}} on RiddleSwap">
  <meta property="og:image" content="{{projectBanner}}">
  <meta property="og:url" content="https://riddleswap.com/collection/{{vanityUrl}}">
  <meta name="twitter:card" content="summary_large_image">
</head>
```

**Auto-Generated Sitemap**

```xml
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://riddleswap.com/collection/riddletrolls</loc>
    <lastmod>2025-10-26</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>
```

---

## Offer System

### Sell Offers

**Create Sell Offer**

```javascript
const createSellOffer = async (nftTokenId, priceXRP, expirationDays) => {
  const expiration = Math.floor(Date.now() / 1000) + (expirationDays * 86400);
  
  const tx = {
    TransactionType: 'NFTokenCreateOffer',
    Account: sellerAddress,
    NFTokenID: nftTokenId,
    Amount: String(priceXRP * 1_000_000),
    Destination: BROKER_ADDRESS,
    Expiration: expiration,
    Flags: 1 // Sell offer
  };
  
  return await submitTransaction(tx);
};
```

### Buy Offers

**Create Buy Offer**

```javascript
const createBuyOffer = async (nftTokenId, offerPriceXRP, owner) => {
  const tx = {
    TransactionType: 'NFTokenCreateOffer',
    Account: buyerAddress,
    Owner: owner,
    NFTokenID: nftTokenId,
    Amount: String(offerPriceXRP * 1_000_000),
    Flags: 0 // Buy offer
  };
  
  return await submitTransaction(tx);
};
```

### Offer Management

**View Active Offers**

```javascript
const getActiveOffers = async (nftTokenId) => {
  const response = await client.request({
    command: 'nft_sell_offers',
    nft_id: nftTokenId
  });
  
  const sellOffers = response.result.offers;
  
  const buyResponse = await client.request({
    command: 'nft_buy_offers',
    nft_id: nftTokenId
  });
  
  const buyOffers = buyResponse.result.offers;
  
  return {
    sellOffers: sellOffers.map(formatOffer),
    buyOffers: buyOffers.map(formatOffer)
  };
};
```

**Cancel Offer**

```javascript
const cancelOffer = async (offerIndex) => {
  const tx = {
    TransactionType: 'NFTokenCancelOffer',
    Account: userAddress,
    NFTokenOffers: [offerIndex]
  };
  
  return await submitTransaction(tx);
};
```

---

## Fee Structure

### Marketplace Fees

**Brokered Sales**
- Platform Fee: **1%** of sale price
- Distribution: 99% to seller, 1% to platform
- No additional listing fees
- No buyer fees

**Direct Sales** (non-brokered)
- No platform fees
- Users handle transactions themselves

### Minting Fees

**XRPL Network Fees**
- NFT Mint: ~0.0001 XRP per NFT
- Offer Creation: ~0.0001 XRP
- Offer Accept: ~0.0001 XRP

**Platform Minting Services**
- Basic Minting: Free (user pays network fee)
- Bulk Minting: 0.1 XRP per NFT
- IPFS Hosting: Included free

### Launchpad Fees

**Project Listing**
- Free Project Page
- Vanity URL: Free
- Featured Placement: 100 XRP/month
- Homepage Banner: 500 XRP/week

---

## Marketing & Promotion

### Paid Advertising

**Placement Options**

1. **Featured Collection** (Homepage)
   - Cost: 100 XRP/month
   - Position: Top 3 featured slots
   - Includes: Banner, description, stats

2. **Trending Boost**
   - Cost: 50 XRP/week
   - Position: Trending section
   - Visibility: 7 days

3. **Homepage Banner**
   - Cost: 500 XRP/week
   - Position: Hero section
   - Format: Custom 1200x400 banner

**Analytics Dashboard**

```typescript
interface ProjectAnalytics {
  views: number;
  uniqueVisitors: number;
  clicks: number;
  sales: number;
  revenue: number;
  conversionRate: number;
  averageSalePrice: number;
  topReferrers: string[];
}
```

### Custom Branding

**Customization Options**
- Custom banner image
- Custom logo
- Brand colors
- Custom CSS (premium)
- Custom domain (premium)

---

## Airdrop & Snapshot Tools

### Airdrop System

**Token Airdrop**

```javascript
const airdropTokens = async (recipients, tokenAmount, token) => {
  const batchSize = 100; // Process in batches
  
  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);
    
    const payments = batch.map(recipient => ({
      TransactionType: 'Payment',
      Account: airdropWallet,
      Destination: recipient.address,
      Amount: {
        currency: token.currency,
        issuer: token.issuer,
        value: String(tokenAmount)
      }
    }));
    
    await Promise.all(payments.map(submitTransaction));
  }
};
```

**NFT Airdrop**

```javascript
const airdropNFTs = async (recipients, nftTokenIds) => {
  for (let i = 0; i < recipients.length; i++) {
    const tx = {
      TransactionType: 'NFTokenCreateOffer',
      Account: airdropWallet,
      NFTokenID: nftTokenIds[i],
      Amount: '0', // Free
      Destination: recipients[i].address,
      Flags: 1
    };
    
    await submitTransaction(tx);
  }
};
```

### Snapshot Tool

**Holder Snapshot**

```javascript
const snapshotHolders = async (issuerAddress, timestamp) => {
  // Get all NFTs from issuer
  const nfts = await getNFTsByIssuer(issuerAddress);
  
  // Get current holders
  const holders = await Promise.all(
    nfts.map(async nft => {
      const owner = await getNFTOwner(nft.NFTokenID, timestamp);
      return {
        address: owner,
        nftTokenId: nft.NFTokenID,
        metadata: nft.metadata
      };
    })
  );
  
  // Aggregate by holder
  const holderMap = holders.reduce((acc, h) => {
    if (!acc[h.address]) {
      acc[h.address] = [];
    }
    acc[h.address].push(h.nftTokenId);
    return acc;
  }, {});
  
  return holderMap;
};
```

**Trader Snapshot**

```javascript
const snapshotTraders = async (issuerAddress, startTime, endTime) => {
  // Get all transactions involving NFTs from this issuer
  const transactions = await getTransactions(issuerAddress, startTime, endTime);
  
  // Analyze trading activity
  const traders = {};
  
  transactions.forEach(tx => {
    const { buyer, seller, amount, nftTokenId } = tx;
    
    if (!traders[buyer]) {
      traders[buyer] = { bought: 0, sold: 0, volume: 0 };
    }
    if (!traders[seller]) {
      traders[seller] = { bought: 0, sold: 0, volume: 0 };
    }
    
    traders[buyer].bought++;
    traders[buyer].volume += amount;
    traders[seller].sold++;
    traders[seller].volume += amount;
  });
  
  return traders;
};
```

---

## User Guide

### For Buyers

**How to Purchase NFT**

1. ✅ Browse marketplace or collection
2. ✅ Click on NFT you want
3. ✅ Click "Buy Now" button
4. ✅ Confirm purchase
5. ✅ Approve transaction in wallet
6. ✅ Wait for confirmation (3-5 seconds)
7. ✅ NFT appears in your wallet

**Making Offers**

1. ✅ View NFT detail page
2. ✅ Click "Make Offer"
3. ✅ Enter offer amount
4. ✅ Submit offer
5. ✅ Wait for seller response

### For Sellers

**Listing NFT for Sale**

1. ✅ Go to "My NFTs"
2. ✅ Select NFT to sell
3. ✅ Click "List for Sale"
4. ✅ Set price in XRP
5. ✅ Set expiration (optional)
6. ✅ Confirm listing
7. ✅ NFT appears on marketplace

**Accepting Offers**

1. ✅ View offers on your NFT
2. ✅ Review offer details
3. ✅ Click "Accept Offer"
4. ✅ Confirm transaction
5. ✅ Receive payment automatically

### For Creators

**Launching NFT Project**

1. ✅ Prepare artwork and metadata
2. ✅ Create project on launchpad
3. ✅ Upload images to IPFS
4. ✅ Set royalty percentage
5. ✅ Mint NFTs
6. ✅ List on marketplace
7. ✅ Promote your project

---

## Conclusion

RiddleSwap's NFT Marketplace provides a comprehensive platform for NFT trading and project launches on the XRP Ledger. With brokered sales ensuring atomic settlements, IPFS integration for decentralized storage, and powerful creator tools, we're building the premier XRPL NFT ecosystem.

---

## Resources

- [Platform Overview](./platform-overview.md)
- [Developer Tools](./developer-tools.md)
- [Oracle Social Media](./oracle-social-media.md)

---

**Document Version**: 1.0  
**Last Updated**: October 26, 2025  
**Author**: RiddleSwap Development Team
