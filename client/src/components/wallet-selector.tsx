import { useState, useEffect } from 'react';
import { ChevronDown, Wallet } from 'lucide-react';
// DISABLED: AppKit import - using only Riddle wallet + external wallets
// import { appKit } from '@/lib/appkit-config';


// Register web components
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'appkit-network-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      'appkit-connect-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      'appkit-account-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}

export default function WalletSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<'xaman' | 'walletconnect' | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // DISABLED: AppKit connection checking - using only direct wallet APIs
    // Check for existing external wallet connections
    const checkConnection = async () => {
      try {
        // Check for Xaman connection
        const xamanConnected = localStorage.getItem('xrpl_wallet_connected') === 'true';
        if (xamanConnected) {
          setIsConnected(true);
          setSelectedWallet('xaman');
        }
      } catch (error) {
        console.log('Wallet connection check failed:', error);
      }
    };

    checkConnection();
    // No subscriptions needed - using direct wallet APIs only
  }, []);

  const handleXamanConnect = () => {
    setSelectedWallet('xaman');
    setIsOpen(false);
    // TODO: Open Xaman QR modal here
  };

  const handleWalletConnectClick = () => {
    setSelectedWallet('walletconnect');
    setIsOpen(false);
    // Open AppKit modal
    setTimeout(() => {
      // DISABLED: AppKit removed - redirect to wallet login
      window.location.href = '/wallet-login';
    }, 100);
  };

  const handleWalletChange = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="wallet-selector-container">
      {selectedWallet === 'walletconnect' || isConnected ? (
        <div className="wallet-connected">
          <appkit-account-button></appkit-account-button>
          <button onClick={handleWalletChange} title="Change wallet">
            <Wallet size={16} />
          </button>
        </div>
      ) : selectedWallet === 'xaman' ? (
        <div>
          <button onClick={() => {
              // TODO: Implement Xaman QR modal connection
              alert('Xaman QR modal will be implemented here');
            }}>
            <span>X</span>
            <span>Connect Xaman</span>
          </button>
          <button onClick={handleWalletChange} title="Change wallet">
            <Wallet size={16} />
          </button>
        </div>
      ) : (
        <div className="wallet-dropdown">
          <button 
            className="wallet-button"
            onClick={() => setIsOpen(!isOpen)}
          >
            <Wallet size={16} />
            <span>Connect Wallet</span>
            <ChevronDown size={14} />
          </button>
        </div>
      )}

      {isOpen && (
        <div className="wallet-dropdown-menu">
          <button 
            className="wallet-option"
            onClick={handleXamanConnect}
          >
            <div className="wallet-option-content">
              <div className="wallet-option-icon xaman-icon">X</div>
              <div className="wallet-option-info">
                <div className="wallet-option-name">Xaman</div>
                <div className="wallet-option-desc">XRPL Wallet</div>
              </div>
            </div>
          </button>
          
          <button 
            className="wallet-option"
            onClick={handleWalletConnectClick}
          >
            <div className="wallet-option-content">
              <div className="wallet-option-icon walletconnect-icon">W</div>
              <div className="wallet-option-info">
                <div className="wallet-option-name">WalletConnect</div>
                <div className="wallet-option-desc">Multi-chain</div>
              </div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
