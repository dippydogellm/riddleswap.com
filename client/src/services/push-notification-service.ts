import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { apiRequest } from '@/lib/queryClient';

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  actionUrl?: string;
}

class PushNotificationService {
  private isInitialized = false;
  private deviceToken: string | null = null;

  /**
   * Dispatch a global browser event so UI can react (invalidate queries, show toasts, etc.)
   */
  private dispatchReceivedEvent(detail: any) {
    try {
      const evt = new CustomEvent('push:received', { detail });
      window.dispatchEvent(evt);
    } catch (err) {
      console.warn('⚠️ Failed to dispatch push:received event', err);
    }
  }

  /**
   * Initialize push notifications for the current platform
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('📱 Push notifications already initialized');
      return;
    }

    const platform = Capacitor.getPlatform();
    console.log(`📱 Initializing push notifications for platform: ${platform}`);

    if (platform === 'web') {
      await this.initializeWebNotifications();
    } else {
      await this.initializeNativeNotifications();
    }

    this.isInitialized = true;
  }

  /**
   * Initialize web (browser) push notifications
   */
  private async initializeWebNotifications(): Promise<void> {
    if (!('Notification' in window)) {
      console.warn('⚠️ Browser does not support notifications');
      return;
    }

    console.log('🌐 Initializing web notifications');
    
    // Request permission if not already granted
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      console.log(`🔔 Notification permission: ${permission}`);
    }

    if (Notification.permission === 'granted') {
      // Register browser device token
      const browserToken = `browser-${navigator.userAgent}-${Date.now()}`;
      await this.registerDevice(browserToken, 'web');
    }
  }

  /**
   * Initialize native (iOS/Android) push notifications
   */
  private async initializeNativeNotifications(): Promise<void> {
    console.log('📱 Initializing native push notifications');

    // Request permission
    let permStatus = await PushNotifications.checkPermissions();
    console.log('📱 Current permission status:', permStatus.receive);

    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
      console.log('📱 Permission request result:', permStatus.receive);
    }

    if (permStatus.receive !== 'granted') {
      console.warn('⚠️ Push notification permission not granted');
      return;
    }

    // Register with Apple/Google to receive push notifications
    await PushNotifications.register();

    // Listen for registration success
    await PushNotifications.addListener('registration', async (token: Token) => {
      console.log('✅ Push registration success, token: ' + token.value);
      this.deviceToken = token.value;
      await this.registerDevice(token.value, Capacitor.getPlatform());
    });

    // Listen for registration errors
    await PushNotifications.addListener('registrationError', (error: any) => {
      console.error('❌ Push registration error:', error);
    });

    // Listen for push notifications received
    await PushNotifications.addListener('pushNotificationReceived', async (notification: PushNotificationSchema) => {
      console.log('📩 Push notification received:', notification);
      
      // Show local notification when app is in foreground
      await this.showLocalNotification({
        title: notification.title || 'New Notification',
        body: notification.body || '',
        data: notification.data
      });

      // Dispatch event for UI (query invalidation, toasts, etc.)
      this.dispatchReceivedEvent({
        title: notification.title,
        body: notification.body,
        data: notification.data,
        source: 'push'
      });
    });

    // Listen for push notification actions
    await PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
      console.log('🔔 Push notification action performed:', action);
      
      // Navigate to action URL if provided
      if (action.notification.data?.actionUrl) {
        window.location.href = action.notification.data.actionUrl;
      }
    });

    // Also initialize local notifications
    await this.initializeLocalNotifications();
  }

  /**
   * Initialize local notifications (works on all platforms)
   */
  private async initializeLocalNotifications(): Promise<void> {
    const platform = Capacitor.getPlatform();
    
    if (platform === 'web') {
      console.log('🌐 Local notifications use browser API on web');
      return;
    }

    console.log('📱 Initializing local notifications');

    // Request permission for local notifications
    const permStatus = await LocalNotifications.checkPermissions();
    if (permStatus.display === 'prompt') {
      await LocalNotifications.requestPermissions();
    }

    // Listen for local notification actions
    await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      console.log('🔔 Local notification action performed:', action);
      
      if (action.notification.extra?.actionUrl) {
        window.location.href = action.notification.extra.actionUrl;
      }
    });
  }

  /**
   * Register device token with backend
   */
  private async registerDevice(token: string, platform: string): Promise<void> {
    try {
      console.log(`📝 Registering device token with backend (${platform})`);
      
      await apiRequest('/api/notifications/register-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceToken: token,
          platform: platform,
          deviceName: navigator.userAgent,
          appVersion: '1.0.0'
        }),
      });

      console.log('✅ Device token registered successfully');
    } catch (error) {
      console.error('❌ Failed to register device token:', error);
    }
  }

  /**
   * Show a local notification (works on all platforms)
   */
  async showLocalNotification(payload: NotificationPayload): Promise<void> {
    const platform = Capacitor.getPlatform();

    if (platform === 'web') {
      // Use browser notification API
      if (Notification.permission === 'granted') {
        const notification = new Notification(payload.title, {
          body: payload.body,
          icon: '/logo.png',
          badge: '/logo.png',
          data: payload.data,
          tag: 'riddleswap-notification',
          requireInteraction: false,
        });

        notification.onclick = () => {
          if (payload.actionUrl) {
            window.location.href = payload.actionUrl;
          }
          notification.close();
        };
      }

      // Always notify UI layer as well
      this.dispatchReceivedEvent({ ...payload, source: 'local-web' });
    } else {
      // Use Capacitor local notifications
      await LocalNotifications.schedule({
        notifications: [{
          title: payload.title,
          body: payload.body,
          id: Date.now(),
          schedule: { at: new Date(Date.now() + 100) }, // Show immediately
          sound: 'notification_sound.wav',
          attachments: undefined,
          actionTypeId: '',
          extra: {
            ...payload.data,
            actionUrl: payload.actionUrl
          }
        }]
      });

      // Dispatch UI event
      this.dispatchReceivedEvent({ ...payload, source: 'local-native' });
    }
  }

  /**
   * Request notification permission from user
   */
  async requestPermission(): Promise<boolean> {
    const platform = Capacitor.getPlatform();

    if (platform === 'web') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } else {
      const permStatus = await PushNotifications.requestPermissions();
      return permStatus.receive === 'granted';
    }
  }

  /**
   * Check if notifications are enabled
   */
  async areNotificationsEnabled(): Promise<boolean> {
    const platform = Capacitor.getPlatform();

    if (platform === 'web') {
      return Notification.permission === 'granted';
    } else {
      const permStatus = await PushNotifications.checkPermissions();
      return permStatus.receive === 'granted';
    }
  }

  /**
   * Get current device token
   */
  getDeviceToken(): string | null {
    return this.deviceToken;
  }

  /**
   * Get current platform
   */
  getPlatform(): string {
    return Capacitor.getPlatform();
  }

  /**
   * Check if running as native app
   */
  isNativeApp(): boolean {
    return Capacitor.isNativePlatform();
  }
}

// Export singleton instance
export const pushNotificationService = new PushNotificationService();
