# Critical Issues Action Plan
**Date:** November 9, 2025  
**Priority:** 🔥 URGENT

---

## 1. ✅ NFT Marketplace Click-Through - WORKING

**Status:** Already functional in nft-marketplace.tsx

**Current Implementation:**
```typescript
const handleCardClick = () => {
  if (collection.chain && collection.chain !== 'xrpl') {
    if (collection.contractAddress) {
      setLocation(`/nft-collection/${collection.chain}/${collection.contractAddress}`);
    }
  } else {
    if (collection.issuer && collection.taxon !== undefined) {
      setLocation(`/nft-collection/${collection.issuer}/${collection.taxon}`);
    }
  }
};
```

**No Action Needed** - Click-through is properly implemented with wouter navigation.

---

## 2. 🔄 Wallet Profile Material UI Upgrade

**File:** `client/src/pages/wallet-profile.tsx` (1306 lines)

**Current State:** Uses ShadCN components
**Target State:** Material UI with Riddle wallet links

### Required Changes:

#### A. Replace ShadCN Imports (Lines 1-20)
```typescript
// REMOVE
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

// ADD
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Skeleton from '@mui/material/Skeleton';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
```

#### B. Add Riddle Wallet Detection
```typescript
// Add after other useQuery hooks
const { data: riddleInfo } = useQuery({
  queryKey: ['/api/riddle-wallets/check', address],
  queryFn: async () => {
    const response = await apiRequest(`/api/riddle-wallets/check/${address}`);
    return await response.json();
  }
});
```

#### C. Add Profile/Messaging Buttons (After wallet metrics display)
```typescript
{/* Riddle Wallet Profile Links */}
{riddleInfo?.isRiddleWallet && riddleInfo?.handle && (
  <Paper elevation={2} sx={{ p: 3, mb: 3, bgcolor: 'primary.50' }}>
    <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
      <UserCheck size={20} />
      Riddle Wallet User
    </Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
      This is a verified Riddle Wallet user: <strong>@{riddleInfo.handle}</strong>
    </Typography>
    <Box sx={{ display: 'flex', gap: 2 }}>
      <Button
        variant="contained"
        startIcon={<User />}
        onClick={() => setLocation(`/social/profile?user=${riddleInfo.handle}`)}
      >
        View Profile
      </Button>
      <Button
        variant="outlined"
        startIcon={<MessageCircle />}
        onClick={() => setLocation(`/social/messages?user=${riddleInfo.handle}`)}
      >
        Send Message
      </Button>
    </Box>
  </Paper>
)}
```

**Estimated Time:** 2-3 hours (due to file size)

---

## 3. 🗑️ Delete Old V2 Routes

**File:** `client/src/App.tsx`

### Remove This Line (Line 436):
```typescript
{ path: '/nft-marketplace-v2', component: NFTMarketplacePage },
```

**Reason:** Duplicate route pointing to same component

---

## 4. 🐛 Fix TypeScript Errors

### Critical TS Errors to Fix:

#### A. ProjectProfileEditor.tsx (Lines 274, 590-612)
**Issue:** Type mismatches on project data

**Fix:**
```typescript
// Line 274 - Add missing status property
const subscriptionInfo: SubscriptionInfo = {
  ...existingData,
  status: 'active' // Add default status
};

// Lines 590-612 - Add type assertions
const projectData = project as any;
if (projectData?.chain) {
  // Access properties safely
}
```

#### B. ProjectLoginModal.tsx (Lines 130-229)
**Issue:** Response type not being parsed

**Fix:**
```typescript
// All API calls need JSON parsing
const response = await apiRequest('/api/project-auth/login', {
  method: 'POST',
  body: JSON.stringify(data)
});
const result = await response.json(); // ADD THIS LINE

if (result.auth) {
  // Use result.auth instead of response.auth
}
```

#### C. ProjectSessionManager.tsx (Lines 62-210)
**Issue:** Missing type definitions and JSON parsing

**Fix:**
```typescript
// Define response type
interface SessionResponse {
  expiresAt: string;
  walletAddress: string;
  loginMethod: string;
}

// Parse response
const { data: sessionData } = useQuery<SessionResponse>({
  queryKey: ['/api/project-auth/session'],
  queryFn: async () => {
    const response = await apiRequest('/api/project-auth/session');
    return await response.json() as SessionResponse;
  }
});
```

---

## 5. 🔍 Find and Delete Legacy Pages

### Commands to Run:
```powershell
# Find all potential legacy files
Get-ChildItem -Path client\src\pages -Filter "*-v2.tsx" -Recurse
Get-ChildItem -Path client\src\pages -Filter "*-old.tsx" -Recurse
Get-ChildItem -Path client\src\pages -Filter "*-legacy.tsx" -Recurse
Get-ChildItem -Path client\src\pages -Filter "*deprecated*.tsx" -Recurse
```

### Known Duplicates:
- **land-marketplace-material.tsx** - Check if this is duplicate of land-marketplace.tsx
- **nft-marketplace-v2 route** - Already identified for removal

---

## 6. 📋 Material UI Site-Wide Audit

### Pages Still Using ShadCN:

**High Priority (User-Facing):**
1. All 17 remaining wallet pages (sol, btc, bnb, etc.)
2. wallet-dashboard.tsx
3. multi-chain-dashboard.tsx
4. trade-v3.tsx
5. wallet-profile.tsx ← **STARTING HERE**

**Medium Priority (Admin/Internal):**
6. devtools pages
7. admin pages
8. gaming sub-pages

**Low Priority (Static):**
9. documentation pages
10. info pages

---

## 🎯 Execution Order (Next 4 Hours)

### Hour 1: Quick Wins
1. ✅ Remove nft-marketplace-v2 route from App.tsx (2 minutes)
2. ✅ Fix ProjectLoginModal JSON parsing (15 minutes)
3. ✅ Fix ProjectSessionManager types (15 minutes)
4. ✅ Fix ProjectProfileEditor type issues (15 minutes)

### Hour 2-3: Wallet Profile Upgrade
5. 🔄 Convert wallet-profile.tsx to Material UI (90 minutes)
6. 🔄 Add Riddle wallet detection and links (30 minutes)

### Hour 4: Cleanup
7. 🗑️ Find and delete legacy pages (30 minutes)
8. ✅ Run final TypeScript check (15 minutes)
9. ✅ Test NFT marketplace navigation (15 minutes)

---

## 📊 Current Status

- **TypeScript Errors:** ~30 errors (mostly in project-auth components)
- **Material UI Coverage:** ~50% of user-facing pages
- **Legacy Code:** Unknown amount (needs audit)

**Target by End of Session:**
- **TypeScript Errors:** 0
- **Material UI Coverage:** 60% (with wallet-profile done)
- **Legacy Code:** Identified and marked for deletion

---

## 🚨 Immediate Actions (Next 30 Minutes)

1. Remove duplicate route
2. Fix 3 TypeScript error files
3. Start wallet-profile.tsx conversion

---

**Last Updated:** Current session
**Next Review:** After wallet-profile.tsx completion
