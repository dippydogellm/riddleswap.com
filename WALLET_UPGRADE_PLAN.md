# Comprehensive Wallet & UI Upgrade Plan

## ✅ Completed

### 1. XRP Wallet - COMPLETE
- ✅ Integrated StandardWalletLayout with XRP branding
- ✅ Added TransactionSuccessModal
- ✅ Added TransactionConfirmationModal with disclaimers
- ✅ Implemented Sell Tokens feature
- ✅ Implemented Burn Dust feature (tokens < $1)
- ✅ Improved trustline management
- ✅ Added refresh button with loading state
- ✅ Summary stats cards

### 2. Reusable Components Created
- ✅ `StandardWalletLayout.tsx` - Universal wallet layout
- ✅ `TransactionSuccessModal.tsx` - Success notifications (8 tx types)
- ✅ `TransactionConfirmationModal.tsx` - Confirmation with disclaimers
- ✅ `WalletUpgradeTemplate.tsx` - Template with all 19 chain configs

## 🔄 In Progress

### 3. ETH Wallet - IN PROGRESS
**Current Status:** Converting from ShadCN to Material UI
**Location:** `client/src/pages/eth-wallet.tsx`
**Actions Needed:**
1. Replace ShadCN components with Material UI
2. Apply WalletUpgradeTemplate with ETH config
3. Add burn dust feature for ERC-20 tokens
4. Add sell tokens feature (route to trade-v3)
5. Implement proper session connection
6. Add transaction confirmations for all operations

## 📋 Pending Wallets (17 remaining)

### Main Chain Wallets (3)
**Priority: HIGH - Core chains**

#### SOL Wallet
- **File:** `client/src/pages/sol-wallet.tsx`
- **Chain Config:** CHAIN_CONFIGS.sol
- **Features Needed:**
  - Material UI conversion
  - Burn dust for SPL tokens
  - Sell tokens feature
  - Session authentication fix
  - Transaction confirmations

#### BTC Wallet
- **File:** `client/src/pages/btc-wallet.tsx`
- **Chain Config:** CHAIN_CONFIGS.btc
- **Features Needed:**
  - Material UI conversion
  - UTXO-based send with confirmation
  - Transaction confirmations
  - Session authentication fix

#### BNB Wallet
- **File:** `client/src/pages/bnb-wallet.tsx`
- **Chain Config:** CHAIN_CONFIGS.bnb
- **Features Needed:**
  - Material UI conversion
  - Burn dust for BEP-20 tokens
  - Sell tokens feature
  - Session authentication fix
  - Transaction confirmations

### L2 & Sidechain Wallets (14)
**Priority: MEDIUM - Secondary chains**

1. **Base** - `client/src/pages/base-wallet.tsx`
2. **Avalanche** - `client/src/pages/avax-wallet.tsx`
3. **Polygon** - `client/src/pages/polygon-wallet.tsx`
4. **Arbitrum** - `client/src/pages/arbitrum-wallet.tsx`
5. **Optimism** - `client/src/pages/optimism-wallet.tsx`
6. **Fantom** - `client/src/pages/fantom-wallet.tsx`
7. **zkSync** - `client/src/pages/zksync-wallet.tsx`
8. **Linea** - `client/src/pages/linea-wallet.tsx`
9. **Taiko** - `client/src/pages/taiko-wallet.tsx`
10. **Unichain** - `client/src/pages/unichain-wallet.tsx`
11. **Soneium** - `client/src/pages/soneium-wallet.tsx`
12. **Mantle** - `client/src/pages/mantle-wallet.tsx`
13. **Metis** - `client/src/pages/metis-wallet.tsx`
14. **Scroll** - `client/src/pages/scroll-wallet.tsx`

**Common Features for All L2s:**
- Material UI conversion using WalletUpgradeTemplate
- Burn dust for tokens < $1
- Sell tokens routing to trade-v3
- Session authentication (useAuth hook)
- Transaction confirmation modals
- Refresh functionality
- Network status indicator

## 🌉 Bridge Component Upgrade

### Priority: CRITICAL - User reported wallet connection issues

**Files to Update:**
- `client/src/components/bridge/BridgeMain.tsx`
- `client/src/components/bridge/BridgeStep1.tsx`
- `client/src/components/bridge/BridgeStep2.tsx`
- `client/src/components/bridge/BridgeStep3.tsx`
- `client/src/components/bridge/BridgeTransactionModal.tsx`

**Issues to Fix:**
1. ❌ Wallet not connecting from session
   - Fix: Standardize session detection across localStorage/sessionStorage
   - Check for: `sessionToken`, `riddle_session_token`, `walletSession`
   - Add proper useAuth() integration

2. ❌ Missing confirmation modals
   - Add TransactionConfirmationModal before bridge transactions
   - Include disclaimer about irreversible operations
   - Show estimated fees and output

3. ❌ Missing success notifications
   - Add TransactionSuccessModal after successful bridge
   - Show transaction hash for both chains
   - Link to both explorers

4. ❌ Convert to Material UI
   - Replace ShadCN Card/Button with MUI components
   - Use consistent styling with wallets
   - Add loading states with CircularProgress

**Bridge Transaction Flow:**
```
1. Select Tokens → 2. Confirm Details → 3. Execute → 4. Success Modal
                    (with disclaimer)          (with status)
```

## 🏗️ Land Pages Upgrade

### Priority: HIGH - Gaming ecosystem pages

**Files to Update:**
- `client/src/pages/land-marketplace.tsx`
- `client/src/pages/land-plot-detail.tsx`
- `client/src/pages/gaming-dashboard-material.tsx` (verify Material UI)
- `client/src/pages/gaming-nft-detail-material.tsx` (verify Material UI)

**Actions Needed:**
1. Convert land marketplace to Material UI
2. Add transaction confirmations for land purchases
3. Ensure session authentication works
4. Add success modals for purchases
5. Verify gaming pages are fully Material UI

## 🔍 ShadCN Component Audit

### Find All Pages Using ShadCN Components

**Search Patterns:**
- Import from `@/components/ui/button`
- Import from `@/components/ui/card`
- Import from `@/components/ui/dialog`
- Import from `@/components/ui/tabs`
- Import from `@/components/ui/alert`

**High Priority Pages (likely using ShadCN):**
- Trading pages (`trade-v3.tsx`, `liquidity.tsx`)
- NFT marketplace pages
- Token analytics pages
- Admin pages
- DevTools pages
- Launchpad pages
- Profile/social pages

**Conversion Strategy:**
1. Search for all files importing from `@/components/ui/`
2. Prioritize user-facing transaction pages
3. Convert to Material UI equivalents:
   - Button → Button (MUI)
   - Card → Card (MUI)
   - Dialog → Dialog (MUI)
   - Tabs → Tabs (MUI)
   - Alert → Alert (MUI)

## 🔐 Session Authentication Fix

### Priority: CRITICAL - Affects all wallets

**Problem:** Wallets not connecting from session automatically

**Root Causes:**
1. Multiple session storage locations
2. Inconsistent useAuth() usage
3. Missing session refresh on page load
4. Session token not passed to components

**Solution Implementation:**

### 1. Standardize Session Detection
```typescript
// Use this pattern in ALL wallet components
const { isAuthenticated, walletData, authData } = useAuth();

// Session token locations (check in order):
1. localStorage.getItem('riddle_session_token')  // New standard
2. localStorage.getItem('sessionToken')           // Legacy
3. sessionStorage.getItem('riddle_wallet_session') // Session-only
4. sessionStorage.getItem('walletSession')        // Legacy session
```

### 2. Add Session Refresh Hook
```typescript
// Add to all wallet pages
useEffect(() => {
  const checkSession = async () => {
    const token = localStorage.getItem('riddle_session_token') || 
                  localStorage.getItem('sessionToken');
    
    if (token && !isAuthenticated) {
      // Trigger auth refresh
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    }
  };
  
  checkSession();
}, []);
```

### 3. Update useAuth Hook
**File:** `client/src/hooks/useAuth.tsx`

**Improvements:**
- Check all session token locations
- Auto-refresh expired sessions
- Emit custom events on auth state change
- Persist session across page reloads

## 📊 Progress Tracking

### Completion Metrics
- **Wallets:** 1/19 (5%) - XRP Complete
- **Bridge:** 0% - Not Started
- **Land Pages:** 0% - Not Started
- **ShadCN Audit:** 0% - Not Started
- **Session Fix:** 0% - Not Started

### Estimated Time
- **Remaining Wallets:** 18 wallets × 30 min = 9 hours
- **Bridge Upgrade:** 2 hours
- **Land Pages:** 1 hour
- **ShadCN Audit:** 3 hours
- **Session Fix:** 2 hours
- **Testing:** 3 hours
- **Total:** ~20 hours

## 🎯 Next Steps

### Immediate Actions (This Session)
1. ✅ Complete ETH wallet upgrade
2. ✅ Fix session authentication in useAuth
3. ✅ Upgrade Bridge component
4. ⏳ Start SOL wallet
5. ⏳ Start BTC wallet

### Follow-up Tasks
1. Batch process remaining 14 L2 wallets
2. Convert all ShadCN pages to Material UI
3. Test all transaction flows
4. Verify session persistence
5. Update documentation

## 🔧 Testing Checklist

### Per Wallet Testing
- [ ] Login persists on page reload
- [ ] Balance loads correctly
- [ ] Tokens display properly
- [ ] NFTs display properly
- [ ] Send transaction works with confirmation
- [ ] Receive address shows QR code
- [ ] Swap routes to trade-v3
- [ ] Burn dust feature works
- [ ] Sell tokens feature works
- [ ] Refresh button updates data
- [ ] Explorer links work
- [ ] Transaction success modal shows
- [ ] Copy address works
- [ ] Session logout clears data

### Bridge Testing
- [ ] Wallet connects from session
- [ ] Token selection works
- [ ] Amount validation works
- [ ] Confirmation modal shows disclaimer
- [ ] Transaction executes
- [ ] Success modal shows both tx hashes
- [ ] Explorer links work for both chains
- [ ] Error handling works
- [ ] Fee calculation correct
- [ ] Session persists through process

## 📝 Notes

### Design Principles
- **Consistency:** All wallets use same layout/components
- **Safety:** All transactions require confirmation + disclaimer
- **Clarity:** Clear loading states and error messages
- **Accessibility:** Material UI provides better a11y
- **Performance:** Lazy loading, query caching, optimized hooks

### Material UI Migration Benefits
- Better TypeScript support
- More comprehensive component library
- Better accessibility out of the box
- Consistent theming across all pages
- Better mobile responsiveness
- Active maintenance and updates

### Chain-Specific Considerations
- **XRPL:** Trustline management, reserve requirements
- **Bitcoin:** UTXO model, no tokens/NFTs
- **Ethereum/L2s:** Gas fees, ERC-20/721/1155 support
- **Solana:** Account rent, SPL token support

---

**Last Updated:** Current session
**Status:** In Progress - ETH Wallet conversion
**Next:** Complete ETH, then fix session authentication
