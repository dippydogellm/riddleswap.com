import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface WalletConnectButtonProps {
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export default function WalletConnectButton({ 
  className = '', 
  variant = 'outline',
  size = 'sm' 
}: WalletConnectButtonProps) {
  
  const handleConnect = () => {
    // Open the AppKit modal
    const appKitElement = document.querySelector('appkit-button') as any;
    if (appKitElement) {
      appKitElement.click();
    } else {
      // Fallback - dispatch custom event
      const event = new CustomEvent('openWalletModal');
      window.dispatchEvent(event);
    }
  };

  return (
    <Button
      onClick={handleConnect}
      variant={variant}
      size={size}
      className={className}
    >
      Connect
    </Button>
  );
}
