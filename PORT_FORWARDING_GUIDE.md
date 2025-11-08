# Port Forwarding Guide - Access Your App on Mobile

## Current Configuration
- **Server Port**: 5000
- **Host**: 0.0.0.0 (accepts external connections)

## Step 1: Find Your Local IP Address

### On Windows (PowerShell):
```powershell
ipconfig
```
Look for "IPv4 Address" under your network adapter (usually starts with 192.168.x.x or 10.0.x.x)

Example: `192.168.1.100`

## Step 2: Test Local Network Access

From your mobile (connected to same WiFi):
```
http://YOUR_LOCAL_IP:5000
```
Example: `http://192.168.1.100:5000`

## Step 3: Port Forwarding (For Internet Access)

### Windows Firewall Rule
```powershell
# Run as Administrator
New-NetFirewallRule -DisplayName "Riddle App Port 5000" -Direction Inbound -LocalPort 5000 -Protocol TCP -Action Allow
```

### Router Port Forwarding Steps:
1. Open your router admin panel (usually http://192.168.1.1 or http://192.168.0.1)
2. Login (check router sticker for credentials)
3. Find "Port Forwarding" or "Virtual Server" section
4. Add new rule:
   - **Service Name**: Riddle App
   - **External Port**: 5000
   - **Internal Port**: 5000
   - **Internal IP**: YOUR_LOCAL_IP (e.g., 192.168.1.100)
   - **Protocol**: TCP
5. Save and enable the rule

## Step 4: Find Your Public IP

```powershell
# PowerShell
(Invoke-WebRequest -Uri "https://api.ipify.org").Content
```

Or visit: https://whatismyipaddress.com/

## Step 5: Access From Mobile (Internet)

```
http://YOUR_PUBLIC_IP:5000
```

**Example**: `http://203.0.113.45:5000`

## Security Warning ⚠️

**DO NOT expose to internet without:**
1. Strong authentication enabled
2. HTTPS/SSL certificate (use Cloudflare Tunnel or ngrok for easy setup)
3. Rate limiting (already configured)
4. Firewall rules

## Alternative: Use Cloudflare Tunnel (Recommended)

### Install Cloudflare Tunnel:
```powershell
# Download cloudflared
# Visit: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/

# Run tunnel
cloudflared tunnel --url http://localhost:5000
```

This gives you a free HTTPS URL like: `https://random-name.trycloudflare.com`

## Alternative: Use ngrok (Quick & Easy)

```powershell
# Download from https://ngrok.com/download

# Run ngrok
ngrok http 5000
```

You'll get a URL like: `https://abc123.ngrok.io`

## Current Server Status
✅ Server configured to accept external connections (0.0.0.0)
✅ Port 5000 ready for forwarding
✅ CORS enabled for external access
✅ Rate limiting enabled (2000 req/15min)

## Test Connection

### Local Network Test:
```powershell
curl http://localhost:5000/health
```

### External Test (from mobile):
```
http://YOUR_IP:5000/health
```

Should return: `{"status":"ok","timestamp":"..."}`

## Troubleshooting

### Can't access from mobile on same WiFi?
- Check Windows Firewall (run the firewall rule command above)
- Verify mobile is on same WiFi network
- Try http://YOUR_LOCAL_IP:5000

### Can't access from internet?
- Verify port forwarding is enabled in router
- Check your ISP doesn't block port 5000 (some ISPs block common ports)
- Try a different port (change PORT=5000 in .env to PORT=8080)
- Use Cloudflare Tunnel or ngrok instead

### Port already in use?
- Change PORT in .env file: `PORT=8080`
- Restart server: `npm run dev`
