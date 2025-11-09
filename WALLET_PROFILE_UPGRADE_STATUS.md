# Wallet Profile Material UI Upgrade Status

## Overview
**File:** `client/src/pages/wallet-profile.tsx` (1305 lines)
**Status:** ✅ **RIDDLE WALLET LINKS ADDED** - Partial Material UI conversion in progress
**Date:** November 9, 2025

---

## ✅ COMPLETED: Riddle Wallet Profile & Messaging Links

### Implementation Details

**Location:** Lines 607-632 in wallet-profile.tsx

**Changes Made:**
1. ✅ **Proper Handle Detection:** Updated to use `riddleWalletInfo.handle` instead of wallet address
2. ✅ **Profile Link:** `setLocation('/social/profile?user=${handle}')` - navigates to user's social profile
3. ✅ **Messaging Link:** `setLocation('/social/messages?user=${handle}')` - opens message thread with user
4. ✅ **Material UI Conversion:** Replaced ShadCN Button with Material UI Button, used Stack for layout
5. ✅ **Conditional Display:** Only shows buttons when `riddleWalletInfo?.isRiddleWallet && riddleWalletInfo.handle` is truthy

**Code:**
```tsx
<Stack direction="row" spacing={1} flexWrap="wrap">
  {riddleWalletInfo?.isRiddleWallet && riddleWalletInfo.handle && (
    <>
      <Button
        variant="outlined"
        startIcon={<UserCheck className="h-4 w-4" />}
        onClick={() => setLocation(`/social/profile?user=${riddleWalletInfo.handle}`)}
        sx={{ textTransform: 'none' }}
      >
        View Profile
      </Button>
      <Button
        variant="outlined"
        startIcon={<MessageCircle className="h-4 w-4" />}
        onClick={() => setLocation(`/social/messages?user=${riddleWalletInfo.handle}`)}
        sx={{ textTransform: 'none' }}
      >
        Send Message
      </Button>
    </>
  )}
  <Button
    variant="outlined"
    startIcon={<ExternalLink className="h-4 w-4" />}
    onClick={() => window.open(`https://xrpl.org/accounts/${walletAddress}`, '_blank')}
    sx={{ textTransform: 'none' }}
  >
    View on XRPL
  </Button>
</Stack>
```

---

## ⏳ IN PROGRESS: Material UI Conversion

### Imports Updated
```tsx
// OLD (ShadCN):
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

// NEW (Material UI):
import { 
  Box, Card, CardContent, Typography, Button, Chip, Tabs, Tab, 
  Skeleton, IconButton, Paper, Grid, Avatar, Stack, Divider, Tooltip
} from '@mui/material';
```

### Component Mapping (1305 lines to convert)

| ShadCN Component | Material UI Replacement | Status |
|------------------|-------------------------|---------|
| `Card` | `Card` (MUI) | ⏳ In Progress |
| `CardHeader` | `CardContent` with Typography | ⏳ In Progress |
| `CardTitle` | `Typography variant="h6"` | ⏳ In Progress |
| `CardContent` | `CardContent` (MUI) | ⏳ In Progress |
| `Button` | `Button` (MUI) | ✅ Header buttons done |
| `Badge` | `Chip` (MUI) | ⏳ Pending |
| `Tabs` | `Tabs` (MUI) | ⏳ Pending |
| `TabsList` | `Tabs` with `Tab` components | ⏳ Pending |
| `TabsTrigger` | `Tab` (MUI) | ⏳ Pending |
| `TabsContent` | Conditional rendering with `{value === X}` | ⏳ Pending |
| `Skeleton` | `Skeleton` (MUI) | ⏳ Pending |

---

## 🔍 Existing Riddle Wallet Detection (Already Working)

The file ALREADY has complete Riddle wallet detection infrastructure:

### State Management
```tsx
const [isRiddleWallet, setIsRiddleWallet] = useState(false);
const [riddleWalletInfo, setRiddleWalletInfo] = useState<RiddleWalletInfo | null>(null);
```

### API Integration (Lines 258-280)
```tsx
const loadRiddleWalletInfo = async (address: string) => {
  try {
    console.log(`🔍 Loading Riddle wallet info for: ${address}`);
    const response = await fetch(`/api/linked-wallets/by-address/${address}`);
    
    if (response.ok) {
      const data: RiddleWalletInfo = await response.json();
      setRiddleWalletInfo(data);
      console.log(`📋 Riddle wallet info loaded:`, data);
    } else {
      setRiddleWalletInfo({ success: false, isRiddleWallet: false });
    }
  } catch (error) {
    console.error('❌ Failed to load Riddle wallet info:', error);
    setRiddleWalletInfo({ success: false, isRiddleWallet: false });
  }
};
```

### Linked Wallets Display (Lines 792-850)
- Shows all linked wallets for Riddle users
- Displays chain logos with ChainLogo component
- Includes verification badges
- Properly handles multi-chain wallets

**API Endpoint:** `/api/linked-wallets/by-address/${address}`

**Response Structure:**
```typescript
interface RiddleWalletInfo {
  success: boolean;
  isRiddleWallet: boolean;
  handle?: string;
  primaryWallet?: {
    address: string;
    chain: string;
  };
  linkedWallets?: LinkedWallet[];
}
```

---

## 📋 Remaining Work

### High Priority (Material UI Conversion)
1. **Profile Header Card** (Lines 565-638)
   - Convert Card → MUI Card
   - Replace CardContent → MUI CardContent
   - Update Avatar styling to use MUI Avatar
   - Convert Badge (Verified) → Chip

2. **Metrics Card** (Lines 641-780)
   - Convert Card/CardHeader/CardTitle → MUI Card with Typography
   - Replace Badges → Chips
   - Update grid layout to use Grid component

3. **Linked Wallets Section** (Lines 792-850)
   - Already has ChainLogo (keep as-is)
   - Convert outer Card → MUI Card
   - Update button styles

4. **Copy Trading Section** (Lines 610-650)
   - Convert follow/unfollow buttons to Material UI
   - Update loading states

5. **Tabs Component** (Lines 670-1200)
   - Convert Tabs/TabsList/TabsTrigger → MUI Tabs/Tab
   - Replace TabsContent with conditional rendering:
     ```tsx
     <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
       <Tab label="NFTs" value="nfts" />
       <Tab label="Tokens" value="tokens" />
     </Tabs>
     {tabValue === 'nfts' && <NFTsContent />}
     {tabValue === 'tokens' && <TokensContent />}
     ```

6. **NFT/Token Cards** (Throughout file)
   - Update all Card components to MUI
   - Replace Skeleton with MUI Skeleton
   - Convert buttons to Material UI

7. **Transaction History** (Lines 900-1100)
   - Convert table-like structure to MUI Table/TableContainer
   - Or use Card with proper styling

---

## 🎯 User Requirements Met

### Original Request
> "mae sur ethe wallet analyticsa page s material ui and if is riddle wallet address have links to profile and messaging"

### Status
1. ✅ **Material UI Imports Added** - All necessary MUI components imported
2. ✅ **Riddle Wallet Detection Working** - Already implemented with `/api/linked-wallets/by-address` endpoint
3. ✅ **Profile Link Added** - `setLocation('/social/profile?user=${handle}')`
4. ✅ **Messaging Link Added** - `setLocation('/social/messages?user=${handle}')`
5. ⏳ **Material UI Conversion** - In progress (header buttons done, ~1250 lines remaining)

---

## 🚀 Next Steps

1. **Continue Material UI Conversion** (~2 hours)
   - Systematically convert each Card section
   - Update all buttons to Material UI
   - Replace all Badges with Chips
   - Convert Tabs component

2. **Test Riddle Wallet Links** (~15 minutes)
   - Create test Riddle wallet
   - Verify profile link navigation
   - Verify messaging link navigation
   - Test with non-Riddle wallet (buttons should hide)

3. **Visual Polish** (~30 minutes)
   - Ensure consistent spacing with Material UI spacing system
   - Update colors to match Material UI theme
   - Test dark mode compatibility

---

## 📊 Progress Summary

**Total Lines:** 1305
**Lines Converted:** ~55 (header section + imports)
**Lines Remaining:** ~1250
**Estimated Time:** 2-3 hours

**Completion:** ~5% Material UI conversion, 100% Riddle wallet functionality

---

## ✅ Key Achievements

1. **Proper Handle-Based Navigation:** Now uses `riddleWalletInfo.handle` instead of wallet address
2. **Correct Social Profile Route:** `/social/profile?user=${handle}`
3. **Correct Messaging Route:** `/social/messages?user=${handle}`
4. **Material UI Buttons:** Header buttons now use MUI Button component
5. **Conditional Rendering:** Only shows when wallet is confirmed as Riddle wallet with handle

---

## 🔗 Related Files

- `client/src/pages/social-profile.tsx` - Profile page destination
- `client/src/pages/messaging-system.tsx` - Messaging page destination
- `server/routes/linkedWallets.ts` - Riddle wallet detection API
- `COMPLETE_ALL_WALLETS.md` - Template for wallet page upgrades
