// Xaman Wallet Integration for XRPL using external wallet API
// Simple deep link integration without SDK

interface XamanConnection {
  address?: string;
  isConnected: boolean;
  qrCode?: string;
  deepLink?: string;
  uuid?: string;
}

// Simple Xaman wallet integration using external wallet API
export class XamanWalletModal {
  async connect(): Promise<XamanConnection> {
    try {
      console.log('🔗 Connecting to Xaman via external wallet API...');

      // Call backend API for Xaman connection with real QR code
      const response = await fetch('/api/external-wallets/xaman/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          purpose: 'Wallet connection to RiddleSwap'
        })
      });

      if (!response.ok) {
        throw new Error(`Backend API error: ${response.status}`);
      }

      const data = await response.json() as any;
      
      console.log('✅ Xaman connection request created:', data.uuid);
      
      return {
        isConnected: false, // Will be true after user completes verification
        qrCode: data.qrCode, // Use Xumm QR URL directly
        deepLink: data.deepLink,
        uuid: data.uuid
      };
    } catch (error) {
      console.error('❌ Xaman connection error:', error);
      throw error;
    }
  }

  // Open Xaman app via deep link (in new tab only, no redirects)
  openXamanApp(deepLink: string): void {
    // Always open in new tab/window, never redirect current page
    // This keeps users on RiddleSwap
    window.open(deepLink, '_blank', 'noopener,noreferrer');
  }

  private isMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }
}

// Export utility functions
export const connectXamanWallet = async (): Promise<XamanConnection> => {
  const modal = new XamanWalletModal();
  return modal.connect();
};

export const openXamanApp = (deepLink: string): void => {
  const modal = new XamanWalletModal();
  modal.openXamanApp(deepLink);
};

// Default export for the modal
export default XamanWalletModal;
