// XRPL and Xaman integration using external wallet API
export interface XamanWallet {
  address: string;
  networkType: string;
}

// Simplified Xaman wallet connection using external wallet API
export async function connectXamanWallet(): Promise<string> {
  try {
    console.log("🔗 Initiating Xaman wallet connection via external wallet API...");
    
    // Use the external wallet API endpoint 
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
      throw new Error(`Failed to create Xaman connection: ${response.status}`);
    }

    const data = await response.json() as any;
    console.log("✅ Xaman connection request created:", data.uuid);

    // Store for tracking
    localStorage.setItem('xaman_pending_uuid', data.uuid);
    localStorage.setItem('xaman_pending_timestamp', Date.now().toString());
    
    // Emit QR ready event for components
    if (data.qrCode) {
      const qrUrl = `data:image/png;base64,${data.qrCode}`;
      localStorage.setItem('xaman_qr_url', qrUrl);
      
      window.dispatchEvent(new CustomEvent('xaman-qr-ready', { 
        detail: { 
          qrUrl,
          uuid: data.uuid,
          deepLink: data.deepLink
        }
      }));
    }

    // For now, return a promise that resolves when user manually verifies
    // In a real implementation, you'd poll for completion or use websockets
    return new Promise((resolve, reject) => {
      // Set timeout for 5 minutes
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout - please try again'));
      }, 300000);

      // Listen for manual verification (user would call this after completing Xaman flow)
      const handler = (event: CustomEvent) => {
        if (event.detail.uuid === data.uuid && event.detail.address) {
          clearTimeout(timeout);
          window.removeEventListener('xaman-connected', handler as EventListener);
          resolve(event.detail.address);
        }
      };

      window.addEventListener('xaman-connected', handler as EventListener);
    });
    
  } catch (error) {
    console.error('❌ Xaman connection failed:', error);
    throw error;
  }
}

// Function to check for pending wallet connections on page load
export async function checkPendingWalletConnection(): Promise<string | null> {
  // For simplified implementation, check localStorage only
  const pendingAddress = localStorage.getItem('xrpl_wallet_address');
  const walletType = localStorage.getItem('xrpl_wallet_type');
  
  if (pendingAddress && walletType === 'xaman') {
    return pendingAddress;
  }
  
  return null;
}

// Helper function to manually complete connection (called by user after Xaman flow)
export function completeXamanConnection(address: string, uuid: string) {
  localStorage.setItem('xrpl_wallet_address', address);
  localStorage.setItem('xrpl_wallet_type', 'xaman');
  localStorage.removeItem('xaman_pending_uuid');
  localStorage.removeItem('xaman_pending_timestamp');
  localStorage.removeItem('xaman_qr_url');
  
  // Emit connection event
  window.dispatchEvent(new CustomEvent('xaman-connected', { 
    detail: { address, uuid }
  }));
}

// Wallet state recovery for backward compatibility
export function recoverWalletState() {
  // Simple implementation for compatibility
  const address = localStorage.getItem('xrpl_wallet_address');
  const walletType = localStorage.getItem('xrpl_wallet_type');
  
  if (address && walletType === 'xaman') {
    return { address, walletType, connected: true };
  }
  
  return { connected: false };
}

export default {
  connectXamanWallet,
  checkPendingWalletConnection,
  completeXamanConnection,
  recoverWalletState
};
