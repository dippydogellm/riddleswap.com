# Mainnet PEPE Transaction Test

## Current Status
- ✅ Universal SPL token payment system implemented
- ✅ Session management page created at `/session`
- ✅ Mainnet Solana connection configured
- ✅ Real SPL token transfers with auto account creation
- 🔄 Login required (server restart cleared sessions)

## Test Steps

### 1. Login to dippydoge wallet
- Go to `/wallet-login`
- Handle: `dippydoge`
- Password: `test`

### 2. Check session status
- Visit `/session` to see active session
- View cached wallet addresses
- See session expiration time

### 3. Test PEPE transfer (Mainnet)
```bash
curl -X POST http://localhost:5000/api/sol/payment \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -d '{
    "handle": "dippydoge",
    "password": "test",
    "destination": "RECIPIENT_SOL_ADDRESS",
    "amount": "100000",
    "tokenMint": "HbD2SQCB5rDSf3ZYY7xqJMYRAZqR7K1Qg76KL3PqzgMY"
  }'
```

## PEPE Token Details
- **Mint**: `HbD2SQCB5rDSf3ZYY7xqJMYRAZqR7K1Qg76KL3PqzgMY`
- **Decimals**: 6
- **Network**: Solana Mainnet
- **Features**: Auto token account creation, balance validation

## Session Token Location
- Stored in localStorage: `sessionToken`
- Used in Authorization header: `Bearer {token}`
- Visible in session page for testing

## Security Features
- Private keys cached in server memory only
- Session expiration monitoring
- IP address validation
- Server restart clears all sessions