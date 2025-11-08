import React from 'react';
import { X, Copy, Download } from 'lucide-react';
// QR generation disabled - using external wallet connections instead
// import { QRCodeSVG } from 'qrcode.react';
// Logo removed - using text branding instead

interface WalletQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  address: string;
  title?: string;
  description?: string;
  network?: string;
}

export const WalletQRModal: React.FC<WalletQRModalProps> = ({
  isOpen,
  onClose,
  address,
  title = "Wallet Address",
  description = "Scan this QR code to receive payments",
  network = "Blockchain"
}) => {

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address);
      // You can add toast notification here if needed
    } catch (error) {

    }
  };

  const downloadQR = () => {
    const canvas = document.querySelector('.wallet-qr-code canvas') as HTMLCanvasElement;
    if (canvas) {
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${network}-wallet-qr.png`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="xaman-modal-overlay" style={{
      position: 'fixed',
      inset: '0',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem'
    }}>
      <div className="xaman-qr-modal" role="dialog" aria-labelledby="wallet-qr-title">
        <div className="xaman-modal-header">
          <div className="xaman-modal-logo">
            <img 
              src="/images/logos/rdl-logo-official.png" 
              alt="RDL Official Logo" 
              className="w-6 h-6 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <div 
              className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xs" 
              style={{ display: 'none' }}
            >
              RDL
            </div>
          </div>
          <h2 id="wallet-qr-title" className="xaman-modal-title">
            {title}
          </h2>
          <button onClick={onClose} className="xaman-modal-close" aria-label="Close modal">
            <X size={20} />
          </button>
        </div>
        
        <p className="xaman-modal-description">
          {description}
        </p>
        
        <div className="xaman-modal-content">
          {/* QR Code Display */}
          <div className="xaman-qr-container">
            <div className="wallet-qr-code">
              <div className="p-8 text-center text-gray-600">
                QR generation disabled - use external wallet connections
              </div>
            </div>
          </div>
          
          {/* Address Display */}
          <div className="wallet-address-container">
            <div className="wallet-address-display">
              <code className="wallet-address-text">
                {address}
              </code>
              <div className="wallet-address-actions">
                <button
                  onClick={copyAddress}
                  className="wallet-action-button"
                  title="Copy address"
                >
                  <Copy size={16} />
                </button>
                <button
                  onClick={downloadQR}
                  className="wallet-action-button"
                  title="Download QR code"
                >
                  <Download size={16} />
                </button>
              </div>
            </div>
          </div>
          
          {/* Network Badge */}
          <div className="wallet-network-badge">
            <span className="network-label">{network} Network</span>
          </div>
        </div>
      </div>
    </div>
  );
};
