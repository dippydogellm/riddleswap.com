/**
 * MetaMask Mobile Deep Link Utility
 * Generates deep links and QR codes for MetaMask mobile wallet connections
 */

interface MetaMaskDeepLinkOptions {
  chainId?: number;
  transaction?: any;
  wcUri?: string; // WalletConnect URI
}

/**
 * Generate MetaMask mobile deep link
 * @param options Deep link options
 * @returns Deep link URL for MetaMask mobile
 */
export function generateMetaMaskDeepLink(options: MetaMaskDeepLinkOptions = {}): string {
  const { wcUri } = options;

  if (wcUri) {
    // WalletConnect deep link for MetaMask mobile
    // Universal link that works on both iOS and Android
    return `https://metamask.app.link/wc?uri=${encodeURIComponent(wcUri)}`;
  }

  // Fallback: Open MetaMask app
  return 'https://metamask.app.link';
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
 * Get appropriate MetaMask connection method based on device
 * @returns 'browser' | 'mobile' | 'none'
 */
export function getMetaMaskConnectionMethod(): 'browser' | 'mobile' | 'none' {
  const hasMetaMaskBrowser = typeof (window as any).ethereum !== 'undefined' && 
                              (window as any).ethereum.isMetaMask;
  
  if (hasMetaMaskBrowser) {
    return 'browser';
  }
  
  if (isMobileDevice()) {
    return 'mobile';
  }
  
  return 'none';
}

/**
 * Open MetaMask mobile app with deep link
 * @param deepLink Deep link URL
 */
export function openMetaMaskMobile(deepLink: string): void {
  // Try to open in new tab/window
  const newWindow = window.open(deepLink, '_blank');
  
  // Fallback: Navigate current window if popup blocked
  if (!newWindow) {
    window.location.href = deepLink;
  }
}

/**
 * Generate MetaMask QR code data URL
 * @param wcUri WalletConnect URI
 * @returns QR code compatible URL
 */
export function generateMetaMaskQRData(wcUri: string): string {
  return wcUri; // WalletConnect URI can be encoded directly in QR
}

/**
 * Check if MetaMask is installed (browser or mobile)
 */
export function isMetaMaskAvailable(): boolean {
  const method = getMetaMaskConnectionMethod();
  return method !== 'none';
}
