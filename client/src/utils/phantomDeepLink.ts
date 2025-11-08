/**
 * Phantom Mobile Deep Link Utility
 * Generates deep links and QR codes for Phantom mobile wallet connections
 */

interface PhantomDeepLinkOptions {
  transaction?: string; // Base64 encoded transaction
  cluster?: 'mainnet-beta' | 'testnet' | 'devnet';
  redirect?: string; // Return URL after transaction
}

/**
 * Generate Phantom mobile deep link
 * @param options Deep link options
 * @returns Deep link URL for Phantom mobile
 */
export function generatePhantomDeepLink(options: PhantomDeepLinkOptions = {}): string {
  const { transaction, redirect } = options;

  if (transaction) {
    // NOTE: Transaction deep links require proper encryption keys and session management.
    // For now, we use WalletConnect for transaction signing which handles this securely.
    // Direct transaction deep links are disabled until proper session management is implemented.
    console.warn('Direct Phantom transaction deep links require session management. Use WalletConnect instead.');
  }

  // For connection flows, delegate to the connect deep link helper
  // This will open Phantom's dApp browser pointing to our application
  return generatePhantomConnectDeepLink();
}

/**
 * Generate Phantom connect deep link (for wallet pairing)
 * @param wcUri WalletConnect URI or custom connect URL
 * @returns Phantom connect deep link
 */
export function generatePhantomConnectDeepLink(wcUri?: string): string {
  if (wcUri) {
    // WalletConnect format - FIXED: Include 'uri=' parameter
    return `https://phantom.app/ul/v1/connect?uri=${encodeURIComponent(wcUri)}`;
  }
  
  // Open Phantom browser for dApp connection
  const dappUrl = encodeURIComponent(window.location.origin);
  return `https://phantom.app/ul/browse/${dappUrl}`;
}

/**
 * Check if device is mobile
 */
export function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

/**
 * Get appropriate Phantom connection method based on device
 * @returns 'browser' | 'mobile' | 'none'
 */
export function getPhantomConnectionMethod(): 'browser' | 'mobile' | 'none' {
  const hasPhantomBrowser = !!(window as any).solana?.isPhantom;
  
  if (hasPhantomBrowser) {
    return 'browser';
  }
  
  if (isMobileDevice()) {
    return 'mobile';
  }
  
  return 'none';
}

/**
 * Open Phantom mobile app with deep link
 * @param deepLink Deep link URL
 */
export function openPhantomMobile(deepLink: string): void {
  // Try to open in new tab/window
  const newWindow = window.open(deepLink, '_blank');
  
  // Fallback: Navigate current window if popup blocked
  if (!newWindow) {
    window.location.href = deepLink;
  }
}

/**
 * Generate Phantom QR code data URL
 * @param connectUrl Connection URL or WC URI
 * @returns QR code compatible URL
 */
export function generatePhantomQRData(connectUrl: string): string {
  return connectUrl; // Can be encoded directly in QR
}

/**
 * Check if Phantom is installed (browser or mobile available)
 */
export function isPhantomAvailable(): boolean {
  const method = getPhantomConnectionMethod();
  return method !== 'none';
}

/**
 * Create Phantom universal link for both iOS and Android
 * @param action 'connect' | 'sign' | 'browse'
 * @param params Optional parameters
 */
export function createPhantomUniversalLink(
  action: 'connect' | 'sign' | 'browse' = 'browse',
  params?: Record<string, string>
): string {
  const baseUrl = 'https://phantom.app/ul';
  
  switch (action) {
    case 'connect':
      const connectParams = params ? `?${new URLSearchParams(params).toString()}` : '';
      return `${baseUrl}/v1/connect${connectParams}`;
    
    case 'sign':
      const signParams = params ? `?${new URLSearchParams(params).toString()}` : '';
      return `${baseUrl}/v1/signAndSendTransaction${signParams}`;
    
    case 'browse':
    default:
      const dappUrl = params?.dapp || window.location.origin;
      return `${baseUrl}/browse/${encodeURIComponent(dappUrl)}`;
  }
}
