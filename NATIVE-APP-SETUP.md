# Native App Quick Setup Guide

Quick reference for deploying RiddleSwap as native apps on Android, iOS, and Desktop.

## ✅ Current Status

Your app is now **ready for native deployment** with:
- ✅ Capacitor configured for iOS and Android
- ✅ Push notifications ready (native + web)
- ✅ Environment configs for each platform
- ✅ Build scripts configured
- ✅ Subdomain preparation complete

---

## 🚀 One-Command Deployment

### For Android
```bash
npm run build:android
```
Then open Android Studio and run the app, or build release APK:
```bash
npm run deploy:android
```

### For iOS
```bash
npm run build:ios
```
Then open Xcode and run the app, or build archive:
```bash
npm run deploy:ios
```

### For Windows/Desktop
```bash
npm run build:windows
npm run deploy:windows
```

---

## 📱 Subdomain Mapping

| Platform | Subdomain | Purpose |
|----------|-----------|---------|
| Android | `android.riddleswap.com` | Android app download/updates |
| iOS | `ios.riddleswap.com` | iOS app download/updates |
| Windows | `windows.riddleswap.com` | Desktop PWA |
| Web | `riddleswap.com` | Main web app |

---

## 🔔 Push Notifications - How It Works

### Web (Desktop Browser)
1. User visits site
2. Permission dialog appears after 3 seconds
3. User clicks "Enable Notifications"
4. Browser notifications activated
5. Device token registered with backend

### Android (Native App)
1. User opens Android app
2. Push notification permission requested
3. User allows notifications
4. Firebase Cloud Messaging (FCM) activated
5. Device token registered with backend
6. App receives push even when closed

### iOS (Native App)
1. User opens iOS app
2. Push notification permission requested
3. User allows notifications
4. Apple Push Notification Service (APNs) activated
5. Device token registered with backend
6. App receives push even when closed

---

## 📦 Required Setup (One-Time)

### Android

1. **Firebase Setup** (for push notifications):
   - Go to https://console.firebase.google.com
   - Create project "RiddleSwap"
   - Add Android app with package: `io.riddlechain.swap`
   - Download `google-services.json`
   - Place in `android/app/google-services.json`

2. **Keystore** (for release builds):
   ```bash
   keytool -genkey -v -keystore android-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias riddleswap
   ```
   - Update `.env.android` with keystore details

3. **Google Play Console**:
   - Create app listing
   - Configure subdomain: `android.riddleswap.com`

### iOS

1. **Apple Developer Account**:
   - Enroll at https://developer.apple.com
   - Get Team ID
   - Update `.env.ios`

2. **APNs Setup** (for push notifications):
   - Enable Push Notifications in Xcode
   - Create APNs certificate
   - Download and configure

3. **App Store Connect**:
   - Create app listing
   - Configure subdomain: `ios.riddleswap.com`

### Desktop

1. **HTTPS Certificate**:
   - Get SSL for `windows.riddleswap.com`
   - PWA requires HTTPS

2. **Service Worker**:
   - Already configured
   - Enables offline mode

---

## 🧪 Testing Notifications

### Test Locally

```javascript
// In browser console or app
if ('Notification' in window) {
  Notification.requestPermission().then(permission => {
    if (permission === 'granted') {
      new Notification('Test', {
        body: 'Push notifications are working!'
      });
    }
  });
}
```

### Test From Backend

```bash
curl -X POST https://riddleswap.com/api/notifications/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "userId": "user123",
    "title": "Test Notification",
    "body": "This is a test push notification",
    "data": { "actionUrl": "/messaging" }
  }'
```

---

## 📝 Environment Variables

### Android (.env.android)
```env
VITE_PLATFORM=android
VITE_APP_NAME=RiddleSwap Android
CAPACITOR_HOSTNAME=android.riddleswap.com
VITE_FCM_SENDER_ID=your_fcm_sender_id
```

### iOS (.env.ios)
```env
VITE_PLATFORM=ios
VITE_APP_NAME=RiddleSwap iOS
CAPACITOR_HOSTNAME=ios.riddleswap.com
VITE_APNS_KEY_ID=your_apns_key_id
```

### Windows (.env.windows)
```env
VITE_PLATFORM=windows
VITE_APP_NAME=RiddleSwap Desktop
CAPACITOR_HOSTNAME=windows.riddleswap.com
VITE_ENABLE_PWA=true
```

---

## 🔄 Workflow

### Daily Development

1. Make changes to web code
2. Test in browser: `npm run dev`
3. Sync to native: `npm run cap:sync`
4. Test on device

### Before Release

1. Update version: `package.json`
2. Update build numbers: `.env.*`
3. Test on all platforms
4. Build release versions
5. Deploy to stores/servers

---

## 💡 Pro Tips

### Fast Development
- Use hot reload on web: `npm run dev`
- Live reload on native: Enable in Capacitor config
- Debug on device with Chrome DevTools

### Common Issues
- **Notifications not working?** Check permissions
- **Build fails?** Clean and rebuild
- **Can't install on device?** Check signing

### Performance
- Use production builds for testing performance
- Enable ProGuard for Android (shrinks APK)
- Optimize assets before release

---

## 📞 Quick Commands Reference

```bash
# Development
npm run dev                  # Start web dev server
npm run cap:android         # Open Android Studio
npm run cap:ios            # Open Xcode

# Building
npm run build:android      # Build for Android
npm run build:ios         # Build for iOS
npm run build:windows     # Build for Windows

# Deployment
npm run deploy:android    # Build Android APK
npm run deploy:ios       # Build iOS archive
npm run deploy:windows   # Deploy desktop

# Sync
npm run cap:sync         # Sync all platforms
npx cap sync android     # Sync Android only
npx cap sync ios        # Sync iOS only
```

---

## 🎯 Next Steps

1. **Android**:
   - Set up Firebase
   - Generate keystore
   - Build and test APK
   - Submit to Play Store

2. **iOS**:
   - Enroll in Apple Developer
   - Set up APNs
   - Build and test
   - Submit to App Store

3. **Desktop**:
   - Deploy to `windows.riddleswap.com`
   - Test PWA installation
   - Configure service worker

---

## ✅ Deployment Checklist

- [ ] Firebase project created (Android)
- [ ] Apple Developer account ready (iOS)
- [ ] Keystores/certificates generated
- [ ] Push notifications tested on all platforms
- [ ] Subdomains configured with DNS
- [ ] SSL certificates installed
- [ ] App store listings created
- [ ] Screenshots and assets prepared
- [ ] Privacy policy and terms ready
- [ ] Beta testing complete

---

**Your app is ready to deploy! 🚀**

For detailed instructions, see `DEPLOYMENT.md`.
