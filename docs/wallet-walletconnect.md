# Wallet & WalletConnect
## Multi-Chain Wallet Management & External Integration

**Version 1.0** | **October 2025**

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Supported Blockchains](#supported-blockchains)
3. [Wallet Architecture](#wallet-architecture)
4. [Security Model](#security-model)
5. [External Wallet Integration](#external-wallet-integration)
6. [XRPL Wallet Features](#xrpl-wallet-features)
7. [EVM Wallet Features](#evm-wallet-features)
8. [Solana Wallet Features](#solana-wallet-features)
9. [Wallet Operations](#wallet-operations)
10. [Best Practices](#best-practices)

---

## Executive Summary

RiddleSwap's wallet infrastructure provides seamless multi-chain asset management across **7 major blockchains**, supporting both custodial (Riddle Wallet) and non-custodial (external wallet) approaches. Our wallet system prioritizes security, user experience, and cross-chain interoperability.

### Key Features

- **Multi-Chain Support**: XRPL, Ethereum, BSC, Polygon, Base, Arbitrum, Optimism, Solana, Bitcoin
- **Client-Side Encryption**: AES-256-GCM encryption for all private keys
- **External Wallet Integration**: MetaMask, Phantom, Xaman, Joey Wallet
- **WalletConnect Protocol**: Full support for mobile and desktop wallets
- **Secure Key Management**: No private keys exposed to backend
- **XRPL Multi-Wallet**: Support for Riddle, Joey, and Xaman wallets simultaneously

---

## Supported Blockchains

### 1. XRP Ledger (XRPL)

**Native Support**
- XRP (native currency)
- XRPL tokens with trustline management
- NFTs (XLS-20 standard)
- Multi-signature accounts (future)

**Wallet Options**
- **Riddle Wallet**: Built-in custodial wallet with browser encryption
- **Xaman (formerly Xumm)**: Mobile wallet via QR codes and deep links
- **Joey Wallet**: Mobile wallet via QR codes and deep links

**Trustline Management**
- Automated trustline creation for new tokens
- Dynamic decimal precision handling
- Dust management for problematic tokens
- Insufficient XRP reserve handling

### 2. EVM Chains

**Supported Networks**
- **Ethereum** (Mainnet)
- **Binance Smart Chain** (BSC)
- **Polygon** (MATIC)
- **Base** (Coinbase Layer 2)
- **Arbitrum** (ETH Layer 2)
- **Optimism** (ETH Layer 2)

**Token Standards**
- ERC-20 (fungible tokens)
- ERC-721 (NFTs)
- ERC-1155 (multi-token standard)

**External Wallet Support**
- MetaMask
- Coinbase Wallet
- Trust Wallet
- Rainbow Wallet
- Any WalletConnect-compatible wallet

### 3. Solana

**Features**
- SOL (native currency)
- SPL tokens
- NFTs (Metaplex standard)

**External Wallet Support**
- Phantom Wallet
- Solflare
- Slope Wallet
- Any Solana wallet adapter

### 4. Bitcoin

**Current Support**
- View-only Bitcoin addresses
- Balance checking
- Transaction history

**Future Features**
- Bitcoin transaction signing
- Lightning Network integration
- Taproot support

---

## Wallet Architecture

### Client-Side Security

**Encryption Flow**

```
User Password + Salt
    ↓
PBKDF2 Derivation
    ↓
AES-256-GCM Key
    ↓
Encrypted Private Key → Stored in Browser
```

**Key Points**
- Private keys NEVER sent to server
- Encryption happens entirely in browser
- Password never stored, only encryption key
- Seed phrases generated with BIP39
- HD wallet derivation (BIP44)

### Backend Architecture

**Session Management**

```typescript
interface WalletSession {
  handle: string;              // User identifier
  sessionToken: string;        // Encrypted session ID
  walletAddress: string;       // Public address
  chainType: 'xrpl' | 'evm' | 'solana';
  expiresAt: number;          // Unix timestamp
  ipAddress: string;          // Security tracking
  userAgent: string;          // Device validation
}
```

**Security Features**
- IP address validation
- User agent verification
- Automatic session expiry (24 hours)
- Session token rotation
- Rate limiting (100 req/15min)

### Database Schema

**Wallets Table**

```sql
CREATE TABLE wallets (
  id SERIAL PRIMARY KEY,
  user_handle VARCHAR(255) UNIQUE NOT NULL,
  wallet_address VARCHAR(255) NOT NULL,
  chain_type VARCHAR(20) NOT NULL,
  encrypted_private_key TEXT,  -- Only for Riddle Wallet
  public_key TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP,
  is_external BOOLEAN DEFAULT FALSE
);
```

**Multi-Wallet Support**

Users can have multiple wallets per chain:
- Primary XRPL wallet (Riddle, Xaman, or Joey)
- Secondary wallets for specific use cases
- External EVM wallets
- External Solana wallets

---

## Security Model

### Encryption Standards

**AES-256-GCM**
- 256-bit key length
- Galois/Counter Mode for authenticated encryption
- 96-bit initialization vector (IV)
- Authentication tag for data integrity

**Key Derivation**

```javascript
const deriveKey = async (password, salt) => {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
  
  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
};
```

### Threat Protection

**Against**
- SQL Injection ✅
- XSS Attacks ✅
- CSRF ✅
- Man-in-the-Middle ✅
- Brute Force ✅
- Session Hijacking ✅

**Security Measures**
- HTTPS enforced (TLS 1.3)
- Content Security Policy headers
- Rate limiting on all endpoints
- Session token rotation
- IP whitelist option (future)

### Password Requirements

**Minimum Requirements**
- 8 characters minimum
- Mix of uppercase and lowercase
- At least one number
- Special characters recommended

**Best Practices**
- Use unique password for wallet
- Enable 2FA (future feature)
- Regular password rotation
- Secure password manager

---

## External Wallet Integration

### MetaMask (EVM Chains)

**Connection Flow**

```javascript
// Connect MetaMask
const connectMetaMask = async () => {
  if (window.ethereum) {
    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts'
    });
    
    const chainId = await window.ethereum.request({
      method: 'eth_chainId'
    });
    
    return {
      address: accounts[0],
      chainId: chainId
    };
  }
};
```

**Supported Operations**
- Account connection
- Transaction signing
- Token approval
- Network switching
- Gas estimation

**Chain IDs**
- Ethereum: 0x1 (1)
- BSC: 0x38 (56)
- Polygon: 0x89 (137)
- Base: 0x2105 (8453)
- Arbitrum: 0xa4b1 (42161)
- Optimism: 0xa (10)

### Phantom (Solana)

**Connection Flow**

```javascript
// Connect Phantom
const connectPhantom = async () => {
  if (window.solana && window.solana.isPhantom) {
    const response = await window.solana.connect();
    return {
      publicKey: response.publicKey.toString()
    };
  }
};
```

**Supported Operations**
- Wallet connection
- Transaction signing
- Token transfers
- NFT transfers
- Message signing

### Xaman & Joey (XRPL)

**QR Code Flow**

```
1. User clicks "Connect Xaman"
2. Platform generates sign request
3. QR code displayed
4. User scans with Xaman app
5. User approves in app
6. Platform receives signed payload
7. Session established
```

**Deep Link Support**

```javascript
// Xaman deep link
const xamanLink = `xumm://tx/${payloadUUID}`;

// Joey deep link
const joeyLink = `joey://sign/${payloadData}`;
```

**Supported Operations**
- Sign-in authentication
- Payment transactions
- NFT offers
- Trustline creation
- Token swaps

### WalletConnect Protocol

**Implementation**

```javascript
import { createAppKit } from '@reown/appkit';
import { mainnet, polygon, arbitrum } from '@reown/appkit/networks';

const appKit = createAppKit({
  projectId: 'YOUR_PROJECT_ID',
  networks: [mainnet, polygon, arbitrum],
  metadata: {
    name: 'RiddleSwap',
    description: 'Multi-Chain DeFi Platform',
    url: 'https://riddleswap.com',
    icons: ['https://riddleswap.com/icon.png']
  }
});
```

**Features**
- Mobile wallet connection via QR code
- Desktop extension detection
- Multi-chain switching
- Event subscriptions
- Session persistence

---

## XRPL Wallet Features

### Trustline Management

**Automatic Trustline Creation**

When swapping a new token, the system:
1. Checks if trustline exists
2. Calculates required XRP reserve (2 XRP per trustline)
3. Prompts user to create trustline
4. Submits TrustSet transaction
5. Waits for ledger confirmation

**Dynamic Decimal Precision**

XRPL tokens can have varying decimals:
```javascript
const formatXRPLToken = (amount, decimals) => {
  return (Number(amount) / Math.pow(10, decimals)).toFixed(decimals);
};
```

**Dust Handling**

For tokens with insufficient XRP reserves:
```javascript
// Automatically route dust to issues wallet
const ISSUES_WALLET = 'rIssuesWalletAddress...';

if (xrpBalance < requiredReserve) {
  await routeDustToIssuesWallet(token, amount);
}
```

### NFT Operations

**XLS-20 Support**

```javascript
// Create NFT Sell Offer
const createSellOffer = async (nftTokenId, price) => {
  const tx = {
    TransactionType: 'NFTokenCreateOffer',
    Account: sellerAddress,
    NFTokenID: nftTokenId,
    Amount: String(price), // drops (1 XRP = 1,000,000 drops)
    Destination: brokerAddress, // Optional
    Flags: 1 // Sell offer
  };
  
  return await xrplClient.submit(tx);
};
```

**Brokered Sales**
- 1% broker fee
- Automated payment distribution
- Atomic settlement
- IOU protection (XRP only)

### Multi-Wallet XRPL Support

Users can connect multiple XRPL wallets:

```typescript
interface XRPLWalletConfig {
  primary: 'riddle' | 'xaman' | 'joey';
  riddle?: {
    address: string;
    encryptedKey: string;
  };
  xaman?: {
    address: string;
    deviceToken: string;
  };
  joey?: {
    address: string;
    sessionToken: string;
  };
}
```

---

## EVM Wallet Features

### Token Management

**ERC-20 Operations**

```javascript
// Get ERC-20 balance
const getTokenBalance = async (tokenAddress, userAddress) => {
  const contract = new ethers.Contract(
    tokenAddress,
    ['function balanceOf(address) view returns (uint256)'],
    provider
  );
  
  return await contract.balanceOf(userAddress);
};

// Approve token spending
const approveToken = async (tokenAddress, spenderAddress, amount) => {
  const contract = new ethers.Contract(
    tokenAddress,
    ['function approve(address,uint256) returns (bool)'],
    signer
  );
  
  return await contract.approve(spenderAddress, amount);
};
```

**Gas Optimization**
- EIP-1559 support (base fee + priority fee)
- Gas estimation before transactions
- Gas price recommendations (low, medium, high)
- Flashbots protection (future)

### Network Switching

```javascript
const switchNetwork = async (chainId) => {
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: `0x${chainId.toString(16)}` }],
    });
  } catch (error) {
    // Chain not added, add it
    if (error.code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [networkConfig],
      });
    }
  }
};
```

### Transaction Monitoring

**Pending Transaction Tracking**

```javascript
const trackTransaction = (txHash) => {
  return provider.waitForTransaction(txHash, 1, 300000); // 5 min timeout
};
```

**Event Subscriptions**

```javascript
// Listen for Transfer events
contract.on('Transfer', (from, to, amount, event) => {
  console.log(`${from} sent ${amount} to ${to}`);
});
```

---

## Solana Wallet Features

### SPL Token Support

**Get Token Accounts**

```javascript
import { getAssociatedTokenAddress } from '@solana/spl-token';

const getTokenAccount = async (mint, owner) => {
  return await getAssociatedTokenAddress(mint, owner);
};
```

**Token Transfers**

```javascript
import { createTransferInstruction } from '@solana/spl-token';

const transferTokens = async (from, to, mint, amount) => {
  const fromAta = await getAssociatedTokenAddress(mint, from);
  const toAta = await getAssociatedTokenAddress(mint, to);
  
  const instruction = createTransferInstruction(
    fromAta,
    toAta,
    from,
    amount
  );
  
  return instruction;
};
```

### Jupiter Aggregation

**Swap via Jupiter**

```javascript
const jupiterSwap = async (inputMint, outputMint, amount, slippage) => {
  const response = await fetch(
    `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippage * 100}`
  );
  
  const quote = await response.json();
  return quote;
};
```

---

## Wallet Operations

### Account Creation

**Riddle Wallet (XRPL)**

```javascript
const createRiddleWallet = async (password) => {
  // Generate seed
  const wallet = xrpl.Wallet.generate();
  
  // Encrypt private key
  const encrypted = await encryptPrivateKey(
    wallet.privateKey,
    password
  );
  
  // Store in database
  await db.insert(wallets).values({
    user_handle: generateHandle(),
    wallet_address: wallet.address,
    chain_type: 'xrpl',
    encrypted_private_key: encrypted,
    public_key: wallet.publicKey
  });
  
  return wallet.address;
};
```

**EVM Wallet**

```javascript
const createEVMWallet = async (password) => {
  // Generate random wallet
  const wallet = ethers.Wallet.createRandom();
  
  // Encrypt private key
  const encrypted = await encryptPrivateKey(
    wallet.privateKey,
    password
  );
  
  // Store encrypted keystore
  const keystore = await wallet.encrypt(password);
  
  return {
    address: wallet.address,
    encrypted: encrypted,
    keystore: keystore
  };
};
```

### Backup & Recovery

**Seed Phrase Export**

```javascript
const exportSeedPhrase = async (walletAddress, password) => {
  // Verify password
  const wallet = await getWallet(walletAddress);
  const privateKey = await decryptPrivateKey(
    wallet.encrypted_private_key,
    password
  );
  
  // Generate mnemonic from private key
  const mnemonic = generateMnemonic(privateKey);
  
  // Return encrypted with temporary key
  return {
    mnemonic: mnemonic,
    expiresAt: Date.now() + 300000 // 5 minutes
  };
};
```

**Wallet Import**

```javascript
const importWallet = async (seedPhrase, password) => {
  // Validate seed phrase
  if (!validateMnemonic(seedPhrase)) {
    throw new Error('Invalid seed phrase');
  }
  
  // Derive wallet
  const wallet = ethers.Wallet.fromMnemonic(seedPhrase);
  
  // Encrypt and store
  return await createWalletFromPrivateKey(
    wallet.privateKey,
    password
  );
};
```

---

## Best Practices

### For Users

**Security**
1. ✅ Use strong, unique passwords
2. ✅ Backup seed phrases offline
3. ✅ Never share private keys
4. ✅ Verify transaction details before signing
5. ✅ Use hardware wallets for large amounts (future)

**External Wallets**
1. ✅ Only connect to trusted dApps
2. ✅ Revoke unused approvals
3. ✅ Monitor transaction permissions
4. ✅ Keep software updated
5. ✅ Use multiple wallets for different purposes

**Transaction Safety**
1. ✅ Double-check recipient addresses
2. ✅ Start with small test transactions
3. ✅ Verify gas fees are reasonable
4. ✅ Wait for sufficient confirmations
5. ✅ Keep transaction records

### For Developers

**Integration**

```javascript
// Always handle errors gracefully
const connectWallet = async () => {
  try {
    const account = await requestAccount();
    return account;
  } catch (error) {
    if (error.code === 4001) {
      // User rejected
      console.log('User rejected connection');
    } else {
      // Other error
      console.error('Connection error:', error);
    }
  }
};
```

**Event Handling**

```javascript
// Listen for account changes
ethereum.on('accountsChanged', (accounts) => {
  if (accounts.length === 0) {
    // User disconnected
    handleDisconnect();
  } else {
    // Account switched
    handleAccountChange(accounts[0]);
  }
});

// Listen for chain changes
ethereum.on('chainChanged', (chainId) => {
  // Reload page or update UI
  window.location.reload();
});
```

---

## Conclusion

RiddleSwap's wallet infrastructure provides secure, flexible, and user-friendly multi-chain asset management. Whether using our built-in Riddle Wallet or connecting external wallets, users can confidently manage their crypto assets across all supported blockchains.

For technical support or integration assistance, contact our development team.

---

## Resources

- [Platform Overview](./platform-overview.md)
- [Multi-Chain Swap](./multi-chain-swap.md)
- [Developer Tools](./developer-tools.md)
- [Security Best Practices](./platform-overview.md#security-compliance)

---

**Document Version**: 1.0  
**Last Updated**: October 26, 2025  
**Author**: RiddleSwap Development Team
