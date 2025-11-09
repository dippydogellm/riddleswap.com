import { useState, useEffect } from 'react';
// DISABLED: AppKit import - using direct wallet APIs only
import { appKit } from '@/lib/appkit-config';
import { XamanSwapQRModalEnhanced } from './xaman-qr-modal-swap-enhanced';
import { UnifiedSuccessModal } from './modals';
const xrpLogo = '/images/chains/xrp-logo.png';

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

export default function WalletButtons() {
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  
  // Xaman connection states
  const [showXamanQR, setShowXamanQR] = useState(false);
  const [xamanPayload, setXamanPayload] = useState<{
    payloadUuid: string;
    qrCodeUrl: string;
    deepLinkUrl?: string;
  } | null>(null);
  const [showXamanSuccess, setShowXamanSuccess] = useState(false);
  const [xamanWalletAddress, setXamanWalletAddress] = useState('');
  const [xamanBalance, setXamanBalance] = useState('');
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(0);

  // Check for existing Xaman connection and fetch balance
  useEffect(() => {
    const checkXamanConnection = () => {
      const isXamanConnected = localStorage.getItem('xrpl_wallet_connected') === 'true';
      const savedAddress = localStorage.getItem('xrpl_wallet_address');

      if (isXamanConnected && savedAddress) {

        setXamanWalletAddress(savedAddress);
        fetchXamanBalance(savedAddress);
        setForceUpdate(prev => prev + 1);
      }
    };

    // Check immediately and also on storage events
    checkXamanConnection();
    
    const handleStorageChange = () => {
      checkXamanConnection();
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('wallet-updated', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('wallet-updated', handleStorageChange);
    };
  }, []);

  // Fetch XRP balance for Xaman wallet
  const fetchXamanBalance = async (address: string) => {
    if (!address) return;

    setIsLoadingBalance(true);
    try {
      const response = await fetch(`/api/xrpl/balance/${address}`);
      if (response.ok) {
        const data = await response.json() as any;

        const balance = parseFloat(data.balance);
        setXamanBalance(balance.toFixed(2));

      } else {

        setXamanBalance('0.00');
      }
    } catch (error) {

      setXamanBalance('0.00');
    } finally {
      setIsLoadingBalance(false);
    }
  };

  // Disconnect Xaman wallet
  const handleXamanDisconnect = async (e?: React.MouseEvent) => {

    // Prevent any default behaviors
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    try {
      // Clear Xaman/XRPL storage
      localStorage.removeItem('xrpl_wallet_connected');
      localStorage.removeItem('xrpl_wallet_address');
      localStorage.removeItem('xrpl_wallet_state');
      localStorage.removeItem('xaman_wallet_address');
      localStorage.removeItem('xaman_wallet_balance');
      
      // Clear AppKit connections if present
      if (typeof window !== 'undefined' && (window as any).appkit) {
        try {
          await (window as any).appkit.disconnect();
        } catch (error) {

        }
      }
      
      // Update component state
      setXamanWalletAddress('');
      setXamanBalance('');
      setForceUpdate(prev => prev + 1);

      // Trigger storage event to update other components
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new Event('wallet-updated'));
      
    } catch (error) {

    }
  };

  useEffect(() => {
    // Check if wallet is already connected on load
    const checkConnection = async () => {
      try {
        // Delay to ensure AppKit is fully initialized
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // DISABLED: AppKit removed - using direct wallet connections
        const state = null;

        // Try to get provider and address from multiple sources
        let actualAddress = state?.address;
        
        // Extract address from CAIP format if available
        if (!actualAddress && state?.caipAddress) {
          const caipAddress = state.caipAddress;
          if (typeof caipAddress === 'string' && caipAddress.includes(':')) {
            const parts = caipAddress.split(':');
            if (parts.length >= 3) {
              actualAddress = parts[2]; // Extract address from caip format like "eip155:137:0x..."

            }
          }
        }
        
        // If no address in state, try to get from AppKit instance
        if (!actualAddress && appKit) {
          try {
            // Try getting account info from AppKit
            const accountInfo = appKit.getAccount?.();
            if (accountInfo?.address) {
              actualAddress = accountInfo.address;

            }
          } catch (error) {

          }
        }
        
        // Try provider as fallback
        if (!actualAddress && state?.selectedNetworkId) {
          try {
            const provider = appKit.getProvider();
            if (provider && provider.request) {
              // Try to get accounts for connected wallet
              const accounts = await provider.request({ method: 'eth_accounts' }).catch(() => null) ||
                              await provider.request({ method: 'solana_accounts' }).catch(() => null);
              if (accounts && accounts.length > 0) {
                actualAddress = accounts[0];

              }
            }
          } catch (providerError) {

          }
        }
        
        // Check if wallet is actually connected through multiple properties
        const isWalletConnected = !!(
          actualAddress || 
          state?.isConnected ||
          (state?.activeChain && state?.selectedNetworkId)
        );
        
        if (isWalletConnected && actualAddress) {
          setIsConnected(true);
          setWalletAddress(actualAddress);

        } else if (isWalletConnected && !actualAddress) {
          // Connected but no address - keep showing connected state
          setIsConnected(true);

        } else {
          setIsConnected(false);
          setWalletAddress('');

        }
      } catch (error) {

      }
    };

    checkConnection();

    // Subscribe to connection changes with better error handling
    let unsubscribe: (() => void) | undefined;
    
    try {
      unsubscribe = appKit.subscribeState((newState: any) => {

        const isWalletConnected = !!(
          newState?.address || 
          newState?.caipAddress || 
          newState?.isConnected ||
          (newState?.activeChain && newState?.selectedNetworkId)
        );
        setIsConnected(isWalletConnected);
        if (isWalletConnected) {

        }
      });
    } catch (error) {

    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const handleXamanConnect = async (e?: React.MouseEvent) => {
    // Prevent any default behaviors
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    try {
      // Add visual feedback

      // Create Xaman auth payload
      const response = await fetch('/api/xumm/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json() as any;

      if (data.uuid && data.refs?.qr_png) {
        const payload = {
          payloadUuid: data.uuid,
          qrCodeUrl: data.refs.qr_png,
          deepLinkUrl: data.next?.always
        };
        
        console.log('✅ QR payload created:', {
          uuid: data.uuid,
          qrUrl: data.refs.qr_png,
          deepLink: data.next?.always
        });

        setXamanPayload(payload);
        setShowXamanQR(true);
        
        console.log('🔄 QR modal should be showing now!');

      } else {
        console.error('❌ Invalid Xaman response:', data);
        alert('Failed to create Xaman connection. Please try again.');
      }
    } catch (error) {

      alert('Network error. Please check your connection and try again.');
    }
  };

  const handleXamanSuccess = (walletAddress: string) => {
    try {

      setShowXamanQR(false);

      setXamanWalletAddress(walletAddress);

      // Save wallet connection to localStorage
      localStorage.setItem('xrpl_wallet_connected', 'true');
      localStorage.setItem('xrpl_wallet_address', walletAddress);

      // Fetch balance for connected wallet immediately
      fetchXamanBalance(walletAddress);

      // Show success modal
      setShowXamanSuccess(true);

      // Refresh balance after a short delay to ensure it's updated
      setTimeout(() => {
        fetchXamanBalance(walletAddress);
      }, 2000);
    } catch (error) {

      // Still try to save the wallet connection even if there's an error
      setShowXamanQR(false);
      setXamanWalletAddress(walletAddress);
      localStorage.setItem('xrpl_wallet_connected', 'true');
      localStorage.setItem('xrpl_wallet_address', walletAddress);
    }
  };

  const handleXamanSuccessClose = () => {
    setShowXamanSuccess(false);
    // Force component re-render to show connected state
    const savedAddress = localStorage.getItem('xrpl_wallet_address');
    if (savedAddress) {
      setXamanWalletAddress(savedAddress);
      fetchXamanBalance(savedAddress);
      setForceUpdate(prev => prev + 1);
    }
    // Trigger storage event to update other components
    window.dispatchEvent(new Event('storage'));
  };

  const handleWalletConnectClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      // Open AppKit modal

      appKit.open();
    } catch (error) {

      // Fallback: try to trigger the appkit button
      const appkitButton = document.querySelector('appkit-connect-button');
      if (appkitButton) {
        (appkitButton as any).click();
      }
    }
  };

  return (
    <div className="wallet-connection-section">
      {/* Section Header - Compact */}
      <div className="wallet-section-header">
        <h3 className="wallet-section-title">Wallets</h3>
        <p className="wallet-section-subtitle">Connect wallets for trading</p>
      </div>

      {/* Wallet Connection Grid */}
      <div className="wallet-connections-grid">
        {/* Multi-Chain Wallet (AppKit) */}
        <div className="wallet-connection-card">
          <div className="wallet-card-header">
            <div className="wallet-card-icon multi-chain-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
                <path d="M2 17L12 22L22 17"/>
                <path d="M2 12L12 17L22 12"/>
              </svg>
            </div>
            <div className="wallet-card-info">
              <span className="wallet-name">Multi-Chain</span>
              <div className="supported-chains">
                <span className="chain-badge ethereum">ETH</span>
                <span className="chain-badge solana">SOL</span>
                <span className="chain-badge polygon">MATIC</span>
              </div>
            </div>
          </div>
          <div className="wallet-card-content">
            {isConnected ? (
              <div className="wallet-connected-state">
                <appkit-account-button />
                <appkit-network-button />
              </div>
            ) : (
              <appkit-connect-button />
            )}
          </div>
        </div>

        {/* XRPL Wallet (Xaman) */}
        <div className="wallet-connection-card">
          <div className="wallet-card-header">
            <div className="wallet-card-icon xrpl-icon">
              <img src={xrpLogo} alt="XRP" className="chain-logo chain-logo-xrp" />
            </div>
            <div className="wallet-card-info">
              <span className="wallet-name">XRPL</span>
              <div className="supported-chains">
                <span className="chain-badge xrpl">XRP</span>
              </div>
            </div>
          </div>
          <div className="wallet-card-content">
            {xamanWalletAddress ? (
              <div className="wallet-connected-state xrpl-connected">
                <div className="wallet-info">
                  <div className="wallet-details">
                    <span className="wallet-address">
                      {xamanWalletAddress.slice(0, 6)}...{xamanWalletAddress.slice(-4)}
                    </span>
                    <span className="wallet-balance" onClick={() => fetchXamanBalance(xamanWalletAddress)} style={{ cursor: 'pointer' }} title="Click to refresh balance">
                      {isLoadingBalance ? '...' : `${xamanBalance} XRP`}
                    </span>
                  </div>
                  <button 
                    onClick={(e) => handleXamanDisconnect(e)}
                    className="disconnect-button"
                    title="Disconnect Xaman wallet"
                    type="button"
                  >
                    ×
                  </button>
                </div>
              </div>
            ) : (
              <button 
                onClick={(e) => handleXamanConnect(e)}
                className="wallet-connect-button xaman-connect compact-connect-btn visible-connect-btn"
                type="button"
              >
                <span>Connect Xaman</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Debug info */}
      {(() => {

        return null;
      })()}

      {/* Debug state */}
      {(() => {

        return null;
      })()}
      
      {/* Xaman QR Modal for Wallet Connection */}
      {showXamanQR && xamanPayload && (
        <div key="xaman-qr-modal-wrapper">
          {(() => {
            try {
              return (
                <XamanSwapQRModalEnhanced
                  isOpen={showXamanQR}
                  onClose={() => {
                    setShowXamanQR(false);
                    setXamanPayload(null);
                  }}
                  payload={{
                    uuid: xamanPayload.payloadUuid,
                    qr: xamanPayload.qrCodeUrl,
                    deepLink: xamanPayload.deepLinkUrl || ''
                  }}
                  fromToken="Wallet Connection"
                  toToken="Xaman"
                  onSuccess={(result) => {
                    try {

                      setShowXamanQR(false);
                      setXamanPayload(null);
                      
                      // For wallet connections, result should be the wallet address
                      // Check if it looks like a valid XRPL address (starts with 'r' and is about 25-34 chars)
                      if (typeof result === 'string' && result.startsWith('r') && result.length >= 25 && result.length <= 34) {
                        handleXamanSuccess(result);
                      } else {
                        // If we don't get a clear address, we still show success but user will need to reconnect

                        setShowXamanSuccess(true);
                      }
                    } catch (error) {

                      setShowXamanQR(false);
                      setXamanPayload(null);
                    }
                  }}
                />
              );
            } catch (error) {

              setShowXamanQR(false);
              setXamanPayload(null);
              return null;
            }
          })()}
        </div>
      )}

      {/* Xaman Success Modal */}
      <UnifiedSuccessModal
        isOpen={showXamanSuccess}
        onClose={handleXamanSuccessClose}
        title="Welcome to RiddleSwap!"
        message={`Your Xaman wallet has been successfully connected. You can now start trading on the XRPL!`}
        type="transaction"
        showConfetti={true}
      />
    </div>
  );
}
