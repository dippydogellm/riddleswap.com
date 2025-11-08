# Cross-Chain Bridge
## Seamless Asset Transfers Between Blockchains

**Version 1.0** | **October 2025**

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Supported Routes](#supported-routes)
3. [Bridge Architecture](#bridge-architecture)
4. [Security Model](#security-model)
5. [Multi-Step Transactions](#multi-step-transactions)
6. [Fee Structure](#fee-structure)
7. [User Guide](#user-guide)
8. [Technical Implementation](#technical-implementation)
9. [Risk Management](#risk-management)
10. [Future Roadmap](#future-roadmap)

---

## Executive Summary

RiddleSwap's Cross-Chain Bridge enables seamless asset transfers between XRPL, EVM chains (Ethereum, BSC, Polygon, Base, Arbitrum, Optimism), and Solana. Our multi-step transaction system provides transparency and reliability for cross-chain operations.

### Key Features

- **Multi-Chain Support**: 7 major blockchains
- **Visual Progress Tracking**: Real-time transaction status updates
- **Automated Retries**: Smart retry mechanism for failed steps
- **Security First**: Multi-signature validation and time-locks
- **Competitive Fees**: 0.1-0.3% bridge fee + network costs
- **Fast Processing**: Average 5-15 minutes per bridge transaction

---

## Supported Routes

### Active Bridge Routes

#### XRPL ↔ EVM Chains

**XRPL → Ethereum/BSC/Polygon/Base/Arbitrum/Optimism**
- XRP → Wrapped XRP (wXRP)
- XRPL Tokens → ERC-20 Wrapped Tokens
- Processing Time: 10-15 minutes
- Bridge Fee: 0.25%

**EVM → XRPL**
- Wrapped tokens unwrapped to native XRPL
- Processing Time: 10-15 minutes
- Bridge Fee: 0.25%

#### EVM ↔ EVM Chains

**Ethereum ↔ BSC/Polygon/Base/Arbitrum/Optimism**
- Native token bridging
- ERC-20 token bridging
- Processing Time: 5-10 minutes
- Bridge Fee: 0.1-0.2%

#### Solana ↔ Other Chains

**Solana ↔ EVM Chains**
- SOL → Wrapped SOL (wSOL)
- SPL Tokens → ERC-20
- Processing Time: 10-15 minutes
- Bridge Fee: 0.25%

**Solana ↔ XRPL**
- SPL → XRPL tokens (via EVM intermediary)
- Processing Time: 15-20 minutes
- Bridge Fee: 0.3%

### Route Matrix

| From/To | XRPL | Ethereum | BSC | Polygon | Solana |
|---------|------|----------|-----|---------|--------|
| **XRPL** | - | ✅ | ✅ | ✅ | ✅ |
| **Ethereum** | ✅ | - | ✅ | ✅ | ✅ |
| **BSC** | ✅ | ✅ | - | ✅ | ✅ |
| **Polygon** | ✅ | ✅ | ✅ | - | ✅ |
| **Solana** | ✅ | ✅ | ✅ | ✅ | - |

---

## Bridge Architecture

### High-Level Architecture

```
┌──────────────┐
│  User Wallet │
└──────┬───────┘
       │
       ↓
┌──────────────────────┐
│  Source Chain Lock   │ ← Tokens locked in escrow
└──────┬───────────────┘
       │
       ↓
┌──────────────────────┐
│  Bridge Validators   │ ← Multi-sig verification
│  (Decentralized)     │
└──────┬───────────────┘
       │
       ↓
┌──────────────────────┐
│  Destination Chain   │ ← Wrapped tokens minted
│  Mint/Release        │
└──────────────────────┘
```

### Components

**1. Lock Contract (Source Chain)**
```solidity
// EVM example
contract BridgeLock {
  mapping(bytes32 => BridgeTransaction) public transactions;
  
  struct BridgeTransaction {
    address user;
    address token;
    uint256 amount;
    uint256 timestamp;
    string destinationChain;
    address destinationAddress;
    bool completed;
  }
  
  function lock(
    address token,
    uint256 amount,
    string calldata destinationChain,
    address destinationAddress
  ) external {
    // Transfer tokens to contract
    IERC20(token).transferFrom(msg.sender, address(this), amount);
    
    // Create transaction record
    bytes32 txId = keccak256(abi.encodePacked(
      msg.sender, token, amount, block.timestamp
    ));
    
    transactions[txId] = BridgeTransaction({
      user: msg.sender,
      token: token,
      amount: amount,
      timestamp: block.timestamp,
      destinationChain: destinationChain,
      destinationAddress: destinationAddress,
      completed: false
    });
    
    emit TokensLocked(txId, msg.sender, amount, destinationChain);
  }
}
```

**2. Validator Network**
```javascript
const validateBridgeTransaction = async (txId, sourceChain) => {
  // Get transaction from source chain
  const tx = await getSourceTransaction(txId, sourceChain);
  
  // Verify transaction
  const validations = await Promise.all(
    validators.map(v => v.validateTransaction(tx))
  );
  
  // Require 2/3 consensus
  const approvals = validations.filter(v => v.approved).length;
  const threshold = Math.ceil(validators.length * 2 / 3);
  
  return approvals >= threshold;
};
```

**3. Mint Contract (Destination Chain)**
```solidity
contract BridgeMint {
  mapping(bytes32 => bool) public processed;
  
  function mint(
    bytes32 txId,
    address user,
    address token,
    uint256 amount,
    bytes[] calldata signatures
  ) external {
    require(!processed[txId], "Already processed");
    require(verifySignatures(txId, signatures), "Invalid signatures");
    
    // Mint wrapped tokens
    IWrappedToken(token).mint(user, amount);
    
    processed[txId] = true;
    emit TokensMinted(txId, user, amount);
  }
}
```

---

## Security Model

### Multi-Signature Validation

**Validator Set**
- 15 independent validators
- 2/3 consensus required (10/15)
- Geographic distribution
- Regular rotation

**Signature Verification**

```javascript
const verifyValidatorSignatures = async (txId, signatures) => {
  // Reconstruct message hash
  const messageHash = ethers.utils.solidityKeccak256(
    ['bytes32', 'address', 'uint256'],
    [txId, user, amount]
  );
  
  // Verify each signature
  const signers = signatures.map(sig => {
    return ethers.utils.recoverAddress(messageHash, sig);
  });
  
  // Check signers are valid validators
  const validSigners = signers.filter(s => 
    validatorSet.includes(s)
  );
  
  return validSigners.length >= THRESHOLD;
};
```

### Time-Lock Mechanism

**Delay Periods**

| Amount (USD) | Time-Lock | Reason |
|--------------|-----------|--------|
| < $10,000 | None | Low risk |
| $10k-$100k | 15 min | Medium risk |
| $100k-$1M | 1 hour | High risk |
| > $1M | 24 hours | Very high risk |

**Implementation**

```solidity
function processWithTimelock(bytes32 txId, uint256 amount) internal {
  uint256 delay = calculateDelay(amount);
  uint256 unlockTime = block.timestamp + delay;
  
  timelocks[txId] = unlockTime;
  emit TimelockCreated(txId, unlockTime);
}

function executeTimelocked(bytes32 txId) external {
  require(block.timestamp >= timelocks[txId], "Still locked");
  require(!executed[txId], "Already executed");
  
  // Execute transaction
  _execute(txId);
  executed[txId] = true;
}
```

### Emergency Pause

**Circuit Breaker**

```solidity
contract BridgePausable {
  bool public paused;
  address public guardian;
  
  modifier whenNotPaused() {
    require(!paused, "Bridge is paused");
    _;
  }
  
  function pause() external onlyGuardian {
    paused = true;
    emit BridgePaused(msg.sender);
  }
  
  function unpause() external onlyGuardian {
    paused = false;
    emit BridgeUnpaused(msg.sender);
  }
}
```

---

## Multi-Step Transactions

### Transaction Flow

**Step 1: Source Chain Lock**
```
User → Approve tokens
User → Initiate bridge
Bridge → Lock tokens
Bridge → Emit event
Status: "Locked"
```

**Step 2: Validator Consensus**
```
Validators → Monitor lock event
Validators → Verify transaction
Validators → Sign approval
Status: "Validating" (10/15 signatures)
```

**Step 3: Destination Chain Mint**
```
Relayer → Submit signatures
Destination → Verify signatures
Destination → Mint wrapped tokens
Status: "Minting"
```

**Step 4: Completion**
```
User → Receives tokens
Bridge → Mark completed
Status: "Completed"
```

### Visual Progress Tracking

**UI Component**

```jsx
function BridgeProgress({ txId }) {
  const [status, setStatus] = useState('locked');
  
  const steps = [
    { id: 'locked', label: 'Tokens Locked', icon: Lock },
    { id: 'validating', label: 'Validator Approval', icon: Shield },
    { id: 'minting', label: 'Minting on Destination', icon: Coins },
    { id: 'completed', label: 'Transfer Complete', icon: CheckCircle }
  ];
  
  return (
    <div className="bridge-progress">
      {steps.map((step, index) => (
        <Step
          key={step.id}
          {...step}
          active={status === step.id}
          completed={index < getCurrentStepIndex(status)}
        />
      ))}
    </div>
  );
}
```

### Automated Retry

**Smart Retry Logic**

```javascript
const retryBridgeStep = async (txId, step, maxAttempts = 3) => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      switch(step) {
        case 'lock':
          await lockTokens(txId);
          break;
        case 'validate':
          await collectValidatorSignatures(txId);
          break;
        case 'mint':
          await mintOnDestination(txId);
          break;
      }
      return { success: true };
    } catch (error) {
      if (attempt === maxAttempts) {
        throw new Error(`Failed after ${maxAttempts} attempts`);
      }
      
      // Exponential backoff
      await sleep(Math.pow(2, attempt) * 1000);
    }
  }
};
```

---

## Fee Structure

### Bridge Fees

**Base Fees by Route**

| Route | Fee | Example (1000 USDC) |
|-------|-----|---------------------|
| XRPL → EVM | 0.25% | 2.50 USDC |
| EVM → XRPL | 0.25% | 2.50 USDC |
| EVM → EVM | 0.15% | 1.50 USDC |
| Solana → EVM | 0.25% | 2.50 USDC |
| XRPL ↔ Solana | 0.30% | 3.00 USDC |

### Network Costs

**Gas Fees (Estimated)**

| Chain | Lock | Mint | Total |
|-------|------|------|-------|
| Ethereum | $15-50 | $15-50 | $30-100 |
| BSC | $0.50 | $0.50 | $1 |
| Polygon | $0.10 | $0.10 | $0.20 |
| XRPL | $0.0001 | $0.0001 | $0.0002 |
| Solana | $0.0001 | $0.0001 | $0.0002 |

### Total Cost Example

**Bridging 1000 USDC from XRPL to Ethereum**

```
Amount: 1000 USDC
Bridge Fee (0.25%): 2.50 USDC
XRPL Lock Gas: ~$0.0001
Ethereum Mint Gas: ~$30
─────────────────────────────
Total Cost: ~$32.50
User Receives: 997.50 USDC on Ethereum
```

---

## User Guide

### How to Bridge Assets

**Step 1: Select Route**
- Choose source chain
- Choose destination chain
- Select token to bridge

**Step 2: Enter Amount**
- Input amount to bridge
- View fees and estimated receive amount
- Check estimated time

**Step 3: Initiate Bridge**
- Click "Bridge" button
- Approve token spending (if needed)
- Confirm lock transaction
- Pay gas fee

**Step 4: Monitor Progress**
- Watch real-time progress
- View transaction on block explorer
- Receive notifications on completion

**Step 5: Verify Receipt**
- Check destination wallet
- Add wrapped token to wallet (if needed)
- View transaction history

### Best Practices

**Before Bridging**
1. ✅ Verify destination address is correct
2. ✅ Check you have gas on destination chain
3. ✅ Start with small test amount
4. ✅ Understand fees and time requirements
5. ✅ Save transaction ID for tracking

**During Bridge**
1. ✅ Don't close browser window
2. ✅ Monitor progress regularly
3. ✅ Keep transaction ID safe
4. ✅ Be patient (10-20 minutes normal)

**After Completion**
1. ✅ Add wrapped token to wallet
2. ✅ Verify amount received
3. ✅ Keep record of transaction
4. ✅ Report any issues immediately

---

## Technical Implementation

### API Endpoints

**Initiate Bridge**

```javascript
POST /api/bridge/initiate

Body:
{
  "sourceChain": "xrpl",
  "destinationChain": "ethereum",
  "token": "XRP",
  "amount": "1000",
  "destinationAddress": "0x..."
}

Response:
{
  "success": true,
  "bridgeId": "bridge_abc123",
  "lockTransaction": {
    "txHash": "0x...",
    "status": "pending"
  },
  "estimatedTime": 900 // seconds
}
```

**Check Status**

```javascript
GET /api/bridge/status/:bridgeId

Response:
{
  "success": true,
  "bridgeId": "bridge_abc123",
  "status": "validating",
  "progress": {
    "locked": { completed: true, txHash: "0x..." },
    "validated": { completed: false, signatures: "8/15" },
    "minted": { completed: false },
    "completed": { completed: false }
  },
  "estimatedTimeRemaining": 600
}
```

### Smart Contract Interfaces

**XRPL Integration**

```javascript
const bridgeFromXRPL = async (amount, destinationChain, destinationAddress) => {
  const client = new xrpl.Client('wss://xrplcluster.com');
  await client.connect();
  
  // Create escrow payment
  const escrow = {
    TransactionType: 'EscrowCreate',
    Account: userWallet.address,
    Destination: bridgeWallet.address,
    Amount: String(amount * 1000000), // Convert to drops
    FinishAfter: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    Memos: [{
      Memo: {
        MemoData: Buffer.from(JSON.stringify({
          destinationChain,
          destinationAddress
        })).toString('hex')
      }
    }]
  };
  
  const result = await submitAndWait(client, escrow, userWallet);
  return result.hash;
};
```

---

## Risk Management

### Risks & Mitigation

**Smart Contract Risk**
- Risk: Contract bugs or exploits
- Mitigation: Audited contracts, bug bounties, insurance fund

**Validator Risk**
- Risk: Validator collusion or compromise
- Mitigation: 2/3 consensus, geographic distribution, regular rotation

**Network Risk**
- Risk: Chain reorganization or halts
- Mitigation: Multiple confirmations, monitoring, emergency pause

**Liquidity Risk**
- Risk: Insufficient wrapped tokens
- Mitigation: Reserve fund, liquidity incentives

### Insurance Fund

**Coverage**
- Total Value Locked (TVL): $10M
- Insurance Fund: $1M (10% of TVL)
- Coverage: Up to $100k per incident
- Replenishment: 5% of bridge fees

---

## Future Roadmap

### Q1 2026
- Additional chain support (Avalanche, Cosmos)
- Faster validation (under 5 minutes)
- Reduced fees through optimization

### Q2 2026
- NFT bridging support
- Batch bridging for gas savings
- Advanced order types

### Q3 2026
- Decentralized validator set
- DAO governance
- Cross-chain message passing

### Q4 2026
- Zero-knowledge proofs for privacy
- Instant bridging for small amounts
- Mobile SDK

---

## Conclusion

RiddleSwap's Cross-Chain Bridge provides secure, transparent, and efficient asset transfers between major blockchains. With multi-signature validation, visual progress tracking, and competitive fees, users can confidently bridge assets across the multi-chain ecosystem.

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
