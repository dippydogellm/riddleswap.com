# Material UI Upgrade Status Report
**Date:** November 9, 2025  
**Status:** 🔄 IN PROGRESS

---

## ✅ COMPLETE - Material UI Upgraded

### Wallet Pages (2/19)
- ✅ **xrp-wallet-redesigned.tsx** - Full Material UI (Box, Card, Typography, Button, Tabs, Alert)
- ✅ **eth-wallet.tsx** - Full Material UI + WalletUpgradeTemplate

### Marketplace Pages
- ✅ **nft-marketplace.tsx** - Full Material UI (Card, CardMedia, Chip, Button, Typography, Skeleton)
- ✅ **nft-detail-material.tsx** - Material UI version
- ✅ **nft-detail-v3.tsx** - Latest Material UI version

### Gaming Pages
- ✅ **gaming-dashboard-material.tsx** - Full Material UI
- ✅ **gaming-nft-detail-material.tsx** - Material UI version
- ✅ **riddlecity-material.tsx** - Material UI version

---

## ⏳ NEEDS UPGRADE - Using ShadCN/Legacy UI

### High Priority Pages (User-Facing)

#### Wallet Pages (17 remaining)
- ⏳ **sol-wallet.tsx** (409 lines) - Uses ShadCN Card, Button, Tabs
- ⏳ **btc-wallet.tsx** - Uses ShadCN
- ⏳ **bnb-wallet.tsx** - Uses ShadCN
- ⏳ **base-wallet.tsx** - Uses ShadCN
- ⏳ **avax-wallet.tsx** - Uses ShadCN
- ⏳ **polygon-wallet.tsx** - Uses ShadCN
- ⏳ **arbitrum-wallet.tsx** - Uses ShadCN
- ⏳ **optimism-wallet.tsx** - Uses ShadCN
- ⏳ **fantom-wallet.tsx** - Uses ShadCN
- ⏳ **zksync-wallet.tsx** - Uses ShadCN
- ⏳ **linea-wallet.tsx** - Uses ShadCN
- ⏳ **taiko-wallet.tsx** - Uses ShadCN
- ⏳ **unichain-wallet.tsx** - Uses ShadCN
- ⏳ **soneium-wallet.tsx** - Uses ShadCN
- ⏳ **mantle-wallet.tsx** - Uses ShadCN
- ⏳ **metis-wallet.tsx** - Uses ShadCN
- ⏳ **scroll-wallet.tsx** - Uses ShadCN

#### Wallet Analytics
- 🔄 **wallet-profile.tsx** (1306 lines) - **UPGRADING NOW** - Currently uses ShadCN, needs:
  * Convert all ShadCN components to Material UI
  * Add profile link button for Riddle wallets
  * Add messaging button for Riddle wallets
  * Material UI Cards, Tabs, Buttons, Badges

#### Dashboard Pages
- ⏳ **wallet-dashboard.tsx** - Uses ShadCN, needs Material UI
- ⏳ **multi-chain-dashboard.tsx** - Uses ShadCN

---

## 🟡 MEDIUM PRIORITY - Admin/Internal Pages

### Trading Pages
- ⏳ **trade-v3.tsx** - Uses ShadCN
- ⏳ **dexscreener.tsx** - Uses mixed UI

### Bridge Pages
- ✅ **BridgeMain.tsx** - Uses Tailwind (No upgrade needed - modern utility CSS)

### NFT Pages
- ⏳ **eth-marketplace.tsx** - Check UI framework
- ⏳ **sol-marketplace.tsx** - Check UI framework

---

## 🔍 TO DELETE - Old V2/Legacy Pages

### Found in Routes but No Longer Needed
- ❌ Route `/nft-marketplace-v2` points to same component as `/nft-marketplace` - **REMOVE ROUTE**

### Files to Check for Deletion
Run search for these patterns:
- Files ending in `-v2.tsx`
- Files ending in `-old.tsx`
- Files ending in `-legacy.tsx`
- Duplicate marketplace files

---

## 📝 Upgrade Template Pattern

### For Wallet Pages
```typescript
// Replace ShadCN
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// With Material UI
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
```

### For Wallet Analytics (wallet-profile.tsx)
**Add Riddle Wallet Detection:**
```typescript
// Check if it's a Riddle wallet
const { data: riddleInfo } = useQuery({
  queryKey: ['/api/riddle-wallets/check', address],
  queryFn: async () => {
    const response = await apiRequest(`/api/riddle-wallets/check/${address}`);
    return await response.json();
  }
});

// If Riddle wallet, show profile/messaging buttons
{riddleInfo?.isRiddleWallet && (
  <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
    <Button
      variant="contained"
      startIcon={<User />}
      onClick={() => navigate(`/social/profile/${riddleInfo.handle}`)}
    >
      View Profile
    </Button>
    <Button
      variant="outlined"
      startIcon={<MessageCircle />}
      onClick={() => navigate(`/social/messages?user=${riddleInfo.handle}`)}
    >
      Send Message
    </Button>
  </Box>
)}
```

---

## 🎯 Next Steps

1. **IMMEDIATE:** Upgrade wallet-profile.tsx to Material UI + add Riddle wallet links
2. **TODAY:** Complete remaining 17 wallet pages using proven template
3. **THIS WEEK:** Upgrade trade-v3.tsx and dashboard pages
4. **CLEANUP:** Remove old v2 routes and unused pages

---

## 📊 Progress Summary

- **Complete:** 11 pages
- **In Progress:** 1 page (wallet-profile.tsx)
- **Pending:** ~20 pages
- **To Delete:** ~5 old routes/files

**Estimated Time Remaining:** 4-6 hours for all high-priority pages

---

**Last Updated:** During endpoint audit session
