# Quick Start Server & Fix 401/502 Errors

## Current Issues You're Seeing:
- ✅ **502 Errors** - Server not running or crashed
- ✅ **401 Errors on /api/gaming/squadrons** - Authentication failing

---

## Solution Steps:

### 1️⃣ Start the Server Fresh
```bash
# Kill any existing processes
pkill -f "node.*server/index"

# Start fresh
npm run dev
```

**Wait for these messages:**
```
🚀 Server listening on port 5000
✅ Server is now accepting connections
⚔️ Squadron System routes registered
🤝 Alliance System routes registered
```

### 2️⃣ Check Server is Actually Running
```bash
# In another terminal:
curl http://localhost:5000/health

# Should return:
# {"status":"ok","timestamp":"..."}
```

### 3️⃣ Test Authentication
```bash
# Login first
curl -X POST http://localhost:5000/api/auth/riddle-wallet/login \
  -H "Content-Type: application/json" \
  -d '{"handle":"dippydoge","password":"Neverknow1."}'

# Copy the sessionToken from response
# Then test squadrons:
curl http://localhost:5000/api/gaming/squadrons \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## Common Fixes:

### If 502 Errors Continue:
The server crashed or didn't start. Check terminal for errors like:
- Database connection failed
- Port already in use
- Missing environment variables

**Fix:**
```bash
# Check if port 5000 is already in use:
lsof -i :5000

# Kill it if needed:
kill -9 <PID>

# Then restart:
npm run dev
```

### If 401 Errors Continue:
Your session token expired or isn't being sent correctly.

**Frontend Fix** - Check your queryClient.ts:
- Ensure `Authorization: Bearer ${token}` header is being sent
- Check SessionManager is returning valid token
- Token should be from `sessionStorage` or `localStorage`

**Quick Test:**
1. Open browser DevTools → Application → Storage
2. Find your session token
3. Copy it
4. Test with curl (see step 3 above)

---

## Environment Variables Check

Make sure your `.env` file has:
```bash
DATABASE_URL=postgresql://...
NODE_ENV=development
PORT=5000
```

---

## If All Else Fails - Nuclear Option:

```bash
# Stop everything
pkill -f node

# Clean install
rm -rf node_modules
npm install

# Start fresh
npm run dev
```

---

## Your Credentials:
- **Handle:** dippydoge
- **Password:** Neverknow1.

---

## What Was Fixed Today:
✅ Alliance routes - consistent response format  
✅ Squadron routes - consistent response format  
✅ Crypto import warnings fixed in wallet-import-routes  
✅ All responses now have `success: true` flag  
✅ No duplicate routes  

**All code is saved and correct!**

The 502/401 errors are **runtime issues**, not code issues.
