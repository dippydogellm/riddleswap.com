# RiddleSwap Multi-Platform Deployment Guide

This guide covers deploying RiddleSwap to Android, iOS, Windows/Desktop, and web platforms with full push notification support.

## 📱 Platform Overview

RiddleSwap can be deployed to:
- **Android App** - `android.riddleswap.com`
- **iOS App** - `ios.riddleswap.com`
- **Windows/Desktop** - `windows.riddleswap.com`
- **Web** - `riddleswap.com`

All platforms support:
- ✅ Push notifications (native on mobile, browser notifications on web)
- ✅ Video/Audio calling
- ✅ Real-time messaging
- ✅ Multi-chain crypto operations
- ✅ NFT marketplace and gaming

---

## 🚀 Quick Start

### Prerequisites

1. **Node.js** 18+ and npm
2. **Android Studio** (for Android builds)
3. **Xcode** (for iOS builds, macOS only)
4. **Java JDK** 17+ (for Android)

### Initial Setup

```bash
# Install dependencies
npm install

# Initialize Capacitor (first time only)
npx cap init

# Sync web code to native platforms
npm run cap:sync
```

---

## 📦 Building for Each Platform

### Android

#### Development Build
```bash
# Build and open in Android Studio
npm run cap:android
```

#### Production Build
```bash
# Build release APK
npm run deploy:android

# The APK will be in: android/app/build/outputs/apk/release/
```

#### Android Configuration

1. **Update Signing Config** (`.env.android`):
```env
ANDROID_KEYSTORE_PATH=./android-keystore.jks
ANDROID_KEYSTORE_PASSWORD=your_password
ANDROID_KEY_ALIAS=riddleswap
ANDROID_KEY_PASSWORD=your_password
```

2. **Generate Keystore** (first time):
```bash
keytool -genkey -v -keystore android-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias riddleswap
```

3. **Firebase Cloud Messaging** (Push Notifications):
   - Create project at https://console.firebase.google.com
   - Download `google-services.json` to `android/app/`
   - Add FCM Sender ID to `.env.android`:
     ```env
     VITE_FCM_SENDER_ID=your_sender_id
     ```

4. **Deploy to Google Play**:
   - Upload APK to Google Play Console
   - Configure store listing and screenshots
   - Set subdomain: `android.riddleswap.com`

---

### iOS

#### Development Build
```bash
# Build and open in Xcode
npm run cap:ios
```

#### Production Build
```bash
# Build archive for App Store
npm run deploy:ios
```

#### iOS Configuration

1. **Update Team ID** (`.env.ios`):
```env
IOS_TEAM_ID=your_apple_team_id
IOS_BUNDLE_ID=io.riddlechain.swap
```

2. **Apple Push Notification Service (APNs)**:
   - Enable push notifications in Xcode capabilities
   - Create APNs certificate in Apple Developer Portal
   - Add credentials to `.env.ios`:
     ```env
     VITE_APNS_KEY_ID=your_key_id
     VITE_APNS_TEAM_ID=your_team_id
     ```

3. **Code Signing**:
   - Open `ios/App/App.xcworkspace` in Xcode
   - Select your team in Signing & Capabilities
   - Ensure provisioning profile is configured

4. **Deploy to App Store**:
   - Archive in Xcode
   - Upload to App Store Connect
   - Submit for review
   - Set subdomain: `ios.riddleswap.com`

---

### Windows/Desktop (PWA)

#### Build for Desktop
```bash
# Build optimized desktop version
npm run build:windows

# Start production server
npm run deploy:windows
```

#### Desktop Configuration

1. **Progressive Web App (PWA)**:
   - The app is already configured as a PWA
   - Users can install it from browser (Chrome, Edge)
   - Desktop notifications supported

2. **Deploy to Subdomain**:
   - Deploy to `windows.riddleswap.com`
   - Serve with HTTPS (required for PWA features)
   - Configure service worker for offline support

3. **Windows Store** (Optional):
   - Use PWA Builder: https://www.pwabuilder.com
   - Generate Windows MSIX package
   - Submit to Microsoft Store

---

## 🔔 Push Notifications Setup

### Backend Configuration

The notification system is already integrated. Ensure your backend supports:

1. **Device Token Registration**:
```javascript
POST /api/notifications/register-device
{
  "deviceToken": "xxx",
  "platform": "ios|android|web",
  "deviceName": "iPhone 15 Pro",
  "appVersion": "1.0.0"
}
```

2. **Send Notification**:
```javascript
POST /api/notifications/send
{
  "userId": "user_id",
  "title": "New Message",
  "body": "You have a new message from...",
  "data": { "actionUrl": "/messaging" }
}
```

### Platform-Specific Setup

#### Android (FCM)
1. Create Firebase project
2. Download `google-services.json`
3. Add to `android/app/google-services.json`
4. Configure in `capacitor.config.ts`

#### iOS (APNs)
1. Enable Push Notifications in Xcode
2. Create APNs certificate
3. Upload to Apple Developer Portal
4. Configure in `capacitor.config.ts`

#### Web (Browser Push)
- Automatically handled by service worker
- No additional configuration needed
- Users must grant permission

---

## 🌐 Subdomain Configuration

### DNS Setup

Configure DNS records for each subdomain:

```
android.riddleswap.com  → CNAME → your-app-server.com
ios.riddleswap.com      → CNAME → your-app-server.com
windows.riddleswap.com  → CNAME → your-app-server.com
```

### SSL Certificates

Ensure SSL certificates cover all subdomains:
```
*.riddleswap.com
```

### Server Configuration

Configure your server to serve different builds:

```nginx
# Android subdomain
server {
    server_name android.riddleswap.com;
    root /var/www/riddleswap/android;
    # ... SSL and other config
}

# iOS subdomain
server {
    server_name ios.riddleswap.com;
    root /var/www/riddleswap/ios;
    # ... SSL and other config
}

# Windows/Desktop subdomain
server {
    server_name windows.riddleswap.com;
    root /var/www/riddleswap/windows;
    # ... SSL and other config
}
```

---

## 📊 Testing Notifications

### Test on Each Platform

#### Android
```bash
# Send test notification via Firebase Console
# Or use the built-in test endpoint:
curl -X POST https://api.riddleswap.com/api/notifications/test \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "android",
    "deviceToken": "your_fcm_token"
  }'
```

#### iOS
```bash
# Send test notification via APNs
# Or use the built-in test endpoint:
curl -X POST https://api.riddleswap.com/api/notifications/test \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "ios",
    "deviceToken": "your_apns_token"
  }'
```

#### Web
```bash
# Test browser notification
# Visit the app and click "Enable Notifications"
# Send a test message to see notification
```

---

## 🛠️ Development Workflow

### Local Development

```bash
# Start dev server (web only)
npm run dev

# Test on Android device
npm run cap:android
# Then run from Android Studio

# Test on iOS device
npm run cap:ios
# Then run from Xcode
```

### Sync Changes

After making changes to web code:

```bash
# Sync to all platforms
npm run cap:sync

# Or sync to specific platform
npx cap sync android
npx cap sync ios
```

---

## 📋 Deployment Checklist

### Before Deploying

- [ ] Update version numbers in `package.json`
- [ ] Update build numbers in `.env.android` and `.env.ios`
- [ ] Test all features on each platform
- [ ] Test push notifications
- [ ] Test video/audio calling
- [ ] Verify all API endpoints work
- [ ] Check SSL certificates are valid
- [ ] Review app store requirements

### Android Deployment

- [ ] Generate signed APK
- [ ] Test on multiple Android devices
- [ ] Prepare screenshots (phone, tablet)
- [ ] Write store listing
- [ ] Upload to Google Play Console
- [ ] Submit for review

### iOS Deployment

- [ ] Generate app archive
- [ ] Test on multiple iOS devices
- [ ] Prepare screenshots (iPhone, iPad)
- [ ] Write App Store listing
- [ ] Upload to App Store Connect
- [ ] Submit for review

### Web/Desktop Deployment

- [ ] Build production bundle
- [ ] Test PWA installation
- [ ] Configure service worker
- [ ] Deploy to subdomains
- [ ] Test on multiple browsers
- [ ] Verify HTTPS everywhere

---

## 🔐 Security Considerations

1. **Environment Variables**: Never commit `.env` files
2. **API Keys**: Store in secure environment variables
3. **Keystores**: Keep Android keystores secure and backed up
4. **Code Signing**: Protect iOS signing certificates
5. **HTTPS**: Always use HTTPS in production
6. **CSP**: Configure Content Security Policy
7. **Secrets**: Use secret management service

---

## 📱 Platform-Specific Features

### Android Only
- Back button handling
- Android-specific notifications
- Google Play billing

### iOS Only
- Face ID / Touch ID
- iOS-specific notifications
- Apple Pay integration

### Web Only
- Browser extensions
- Desktop notifications
- Service worker updates

---

## 🐛 Troubleshooting

### Android Issues

**Build fails:**
```bash
# Clean and rebuild
cd android
./gradlew clean
cd ..
npm run cap:android
```

**Push notifications not working:**
- Check `google-services.json` is in `android/app/`
- Verify FCM sender ID in `.env.android`
- Ensure Firebase project is configured

### iOS Issues

**Code signing fails:**
- Update provisioning profiles
- Check team ID in Xcode
- Verify certificates in Keychain

**Push notifications not working:**
- Enable Push Notifications capability in Xcode
- Check APNs certificate is valid
- Verify bundle ID matches

### Web Issues

**Notifications not showing:**
- Check browser permissions
- Verify HTTPS is enabled
- Test in incognito mode

---

## 📞 Support

For deployment issues:
- Check Capacitor docs: https://capacitorjs.com
- Firebase setup: https://firebase.google.com
- Apple Developer: https://developer.apple.com

---

## 🎉 Congratulations!

Your RiddleSwap app is now ready for multi-platform deployment with full push notification support across Android, iOS, and desktop!
