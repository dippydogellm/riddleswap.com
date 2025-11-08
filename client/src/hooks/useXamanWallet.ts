import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { connectXamanWallet } from '@/lib/xaman-wallet-integration';

// Simplified Xaman wallet integration using external wallet API

export function useXamanWallet() {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [uuid, setUuid] = useState<string | null>(null);

  useEffect(() => {
    // Check if already connected via localStorage
    const saved = localStorage.getItem('xrpl_wallet_address');
    const walletType = localStorage.getItem('xrpl_wallet_type');
    
    if (saved && walletType === 'xaman') {
      setIsConnected(true);
      setAddress(saved);
    }
  }, []);

  const connect = async () => {
    try {
      setIsConnecting(true);
      
      // Use the simplified connectXamanWallet function
      const result = await connectXamanWallet();
      
      if (result.qrCode && result.deepLink && result.uuid) {
        setQrCodeUrl(result.qrCode);
        setDeepLink(result.deepLink);
        setUuid(result.uuid);
        
        return { 
          success: true, 
          qrCode: result.qrCode, 
          deepLink: result.deepLink,
          uuid: result.uuid,
          message: 'Scan QR code with Xaman app to connect'
        };
      } else {
        return { success: false, error: 'Failed to create connection request' };
      }
    } catch (error) {
      console.error('❌ Xaman connection failed:', error);
      setQrCodeUrl(null);
      setDeepLink(null);
      setUuid(null);
      return { success: false, error: error instanceof Error ? error.message : 'Connection failed' };
    } finally {
      setIsConnecting(false);
    }
  };

  // Manual verification method - user calls this after completing Xaman flow
  const verifyConnection = async (userAddress: string) => {
    if (userAddress) {
      setIsConnected(true);
      setAddress(userAddress);
      setQrCodeUrl(null);
      setDeepLink(null);
      setUuid(null);
      
      // Store in localStorage
      localStorage.setItem('xrpl_wallet_address', userAddress);
      localStorage.setItem('xrpl_wallet_type', 'xaman');
      
      return { success: true, address: userAddress };
    }
    return { success: false, error: 'Invalid address provided' };
  };

  const disconnect = () => {
    setIsConnected(false);
    setAddress(null);
    setQrCodeUrl(null);
    setDeepLink(null);
    setUuid(null);
    
    // Clear localStorage
    localStorage.removeItem('xrpl_wallet_address');
    localStorage.removeItem('xrpl_wallet_type');
  };

  return {
    isConnected,
    address,
    isConnecting,
    qrCodeUrl,
    deepLink,
    uuid,
    connect,
    verifyConnection,
    disconnect
  };
}
