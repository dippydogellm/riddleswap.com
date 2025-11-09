# Quick Testing Guide - Session & Xaman Integration

## 🧪 Test Session Token Handling

### **1. Open Browser Console**
```javascript
// Check session token storage
console.log('riddle_session_token:', localStorage.getItem('riddle_session_token'));
console.log('sessionToken:', localStorage.getItem('sessionToken'));
console.log('Session data:', sessionStorage.getItem('riddle_wallet_session'));

// Test transactionAuth utility
import { getSessionToken, getWalletType, hasPrivateKeyForChain } from './client/src/utils/transactionAuth';
console.log('Token:', getSessionToken());
console.log('Wallet Type:', getWalletType());
console.log('Has XRPL key:', hasPrivateKeyForChain('xrpl'));
```

---

## 🔗 Test Xaman Integration

### **Swap (Trade-V3)**
1. Go to `/trade-v3`
2. Select "XRPL" chain
3. Check wallet selector dropdown - should show "Xaman" option
4. Select Xaman wallet
5. Initiate swap
6. Should show QR code OR deeplink
7. Scan with Xaman app or click deeplink on mobile
8. Sign transaction in Xaman
9. Verify transaction success modal appears

### **Bridge**
1. Go to `/bridge`
2. Check console for session detection: `✅ [RouteSession] Session token synced`
3. Select XRP as source chain
4. Enter amount
5. If Xaman connected: Should use Xaman for signing
6. If Riddle wallet: Should use private key

### **NFT Marketplace**
1. Go to `/nft-marketplace`
2. Click favorite on any NFT
3. Should use session token from `getSessionToken()`
4. Console should show: `✅ [NFT] Session detected`

### **Gaming Dashboard**
1. Go to `/gaming-dashboard` or `/inquisition-gaming`
2. Check console for: `✅ [Gaming] Session detected: YES`
3. If no session: Should show login buttons
4. My NFTs and Battles should load if logged in

---

## 🏗️ Test Route Session Wrapper

### **Page Navigation**
1. Navigate between pages: `/trade-v3` → `/bridge` → `/nft-marketplace` → `/gaming-dashboard`
2. Console should show on each navigation:
   ```
   ✅ [RouteSession] Session token synced for route
   ```
3. If Xaman connected:
   ```
   🔗 [RouteSession] External wallet detected: Xaman
   ```

### **Session Persistence**
1. Login to Riddle wallet
2. Navigate to `/trade-v3`
3. Refresh page (F5)
4. Session should persist - no re-login needed
5. Check: `localStorage.getItem('riddle_session_token')` should still exist

---

## 🔐 Test Private Key Detection

### **Riddle Wallet**
```javascript
// In browser console on /trade-v3
const sessionData = JSON.parse(sessionStorage.getItem('riddle_wallet_session'));
console.log('Has Private Keys:', sessionData?.hasPrivateKeys);
// Should be: true
```

### **Xaman Wallet**
```javascript
// In browser console with Xaman connected
console.log('Xaman connected:', localStorage.getItem('xrpl_wallet_connected') === 'true');
console.log('Xaman address:', localStorage.getItem('xrpl_wallet_address'));

import { hasPrivateKeyForChain, getWalletType } from './client/src/utils/transactionAuth';
console.log('Wallet Type:', getWalletType()); // Should be: 'xaman'
console.log('Has Private Key:', hasPrivateKeyForChain('xrpl')); // Should be: false
```

---

## 🚨 Test Error Scenarios

### **Expired Session**
1. Login to Riddle wallet
2. In browser console:
   ```javascript
   localStorage.setItem('riddle_session_token', 'invalid_token_12345');
   ```
3. Navigate to `/trade-v3`
4. Try to swap
5. Should show error: "Session expired. Please login again"
6. AuthGuard should redirect to `/wallet-login`

### **Missing Session**
1. Clear all storage:
   ```javascript
   localStorage.clear();
   sessionStorage.clear();
   ```
2. Navigate to `/gaming-dashboard`
3. Should show: "Please connect your wallet" + login buttons
4. Should NOT crash or redirect automatically

### **Multiple Storage Locations**
1. Set session in different locations:
   ```javascript
   localStorage.setItem('riddle_session_token', 'token1');
   localStorage.setItem('sessionToken', 'token2');
   sessionStorage.setItem('riddle_wallet_session', JSON.stringify({sessionToken: 'token3'}));
   ```
2. Run:
   ```javascript
   import { getSessionToken } from './client/src/utils/transactionAuth';
   console.log(getSessionToken());
   ```
3. Should return: 'token1' (priority order)

---

## 📊 Expected Console Output

### **Successful Session Load**
```
🗺️ Router: Router component is rendering
📍 Router: Current location: /trade-v3
💳 Router: Initializing wallet data state
💰 Router: Wallet data loaded from localStorage
✅ [RouteSession] Session token synced for route
✅ [Gaming] Session detected: YES isLoggedIn: true
```

### **Xaman Connected**
```
✅ [RouteSession] Session token synced for route
🔗 [RouteSession] External wallet detected: Xaman
✅ [Trade-V3] External wallet type: xaman
```

### **No Session**
```
🔓 Router: No valid session token found
📭 Router: No saved wallet data found
🎮 [Gaming] No session token found - user may need to login
```

---

## ✅ Success Criteria

### **Session Management**
- [x] Token accessible from `getSessionToken()` on all pages
- [x] Token synced across localStorage, sessionStorage
- [x] Session persists across page refreshes
- [x] Session validated with server before transactions

### **Xaman Integration**
- [x] Xaman detected via `localStorage.getItem('xrpl_wallet_connected')`
- [x] Wallet type correctly identified as 'xaman'
- [x] Swap page shows Xaman option
- [x] Bridge detects Xaman connection
- [x] NFT marketplace works with Xaman

### **Gaming Dashboard**
- [x] Session detection works on load
- [x] Login buttons appear when no session
- [x] User data loads with valid session
- [x] Queries enabled with session

### **Route Middleware**
- [x] RouteSessionWrapper applied to all routes
- [x] Session synced on every navigation
- [x] External wallets detected automatically
- [x] No aggressive redirects

---

## 🐛 Common Issues & Fixes

### **Issue: "Session expired" immediately after login**
**Fix:** Check session token is not string "null"
```javascript
const token = localStorage.getItem('riddle_session_token');
if (token === 'null' || token === 'undefined') {
  // This is the bug - clear it
  localStorage.removeItem('riddle_session_token');
}
```

### **Issue: Gaming dashboard says "no session" but I'm logged in**
**Fix:** Check useSession hook is imported
```typescript
import { useSession } from '@/utils/sessionManager';
const { isLoggedIn, sessionToken } = useSession();
```

### **Issue: Xaman not detected on swap page**
**Fix:** Verify localStorage flags
```javascript
localStorage.setItem('xrpl_wallet_connected', 'true');
localStorage.setItem('xrpl_wallet_address', 'rYourAddress');
```

### **Issue: Transaction fails with "No private key"**
**Fix:** Check wallet type - external wallets don't store private keys
```javascript
import { getWalletType } from './client/src/utils/transactionAuth';
if (getWalletType() === 'xaman') {
  // Use deeplink/QR code signing
} else {
  // Use private key signing
}
```

---

## 📝 Test Report Template

```markdown
## Test Results - [Date]

### Session Token Management
- [ ] getSessionToken() works: ___
- [ ] Token syncs across storage: ___
- [ ] Session persists on refresh: ___
- [ ] Session validation works: ___

### Xaman Integration
- [ ] Swap with Xaman: ___
- [ ] Bridge with Xaman: ___
- [ ] NFT purchase with Xaman: ___
- [ ] Xaman detection works: ___

### Gaming Dashboard
- [ ] Session detection: ___
- [ ] Login buttons show: ___
- [ ] User data loads: ___
- [ ] Queries work: ___

### Issues Found
1. ___
2. ___
3. ___

### Notes
___
```

---

**Ready to test!** 🚀 Use this guide to verify all functionality works as expected.
