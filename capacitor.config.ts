import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.riddlechain.swap',
  appName: 'RiddleSwap',
  webDir: 'dist/public',
  server: {
    androidScheme: 'https',
    // Support for subdomain deployment
    hostname: process.env.CAPACITOR_HOSTNAME || 'riddleswap.com',
    iosScheme: 'riddleswap',
    cleartext: true // For development
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1e3a8a', // Blue theme
      showSpinner: true,
      spinnerColor: '#ffffff',
      splashFullScreen: true,
      splashImmersive: true,
      androidSpinnerStyle: 'large',
      iosSpinnerStyle: 'large',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1e3a8a',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#1e3a8a',
      sound: 'notification_sound.wav'
    },
    App: {
      appUrlScheme: 'riddleswap'
    }
  },
  // iOS-specific configuration
  ios: {
    contentInset: 'always',
    scheme: 'RiddleSwap'
  },
  // Android-specific configuration
  android: {
    buildOptions: {
      keystorePath: process.env.ANDROID_KEYSTORE_PATH,
      keystorePassword: process.env.ANDROID_KEYSTORE_PASSWORD,
      keystoreAlias: process.env.ANDROID_KEY_ALIAS,
      keystoreAliasPassword: process.env.ANDROID_KEY_PASSWORD,
      releaseType: 'APK'
    }
  }
};

export default config;
