import React, { useEffect, useState } from 'react';
import { CheckCircle, Copy, ExternalLink, X, History } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

interface UnifiedSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  type?: 'swap' | 'bridge' | 'transaction';
  title?: string;
  message?: string;
  txHash?: string;
  fromToken?: string;
  toToken?: string;
  fromAmount?: string;
  toAmount?: string;
  chain?: string;
  showConfetti?: boolean;
  // Enhanced bridge details
  exchangeRate?: string;
  platformFee?: string;
  usdValue?: string;
  destinationAddress?: string;
}

export function UnifiedSuccessModal({
  isOpen,
  onClose,
  type = 'transaction',
  title = 'Transaction Successful',
  message = 'Your transaction has been completed successfully.',
  txHash,
  fromToken,
  toToken,
  fromAmount,
  toAmount,
  chain = 'xrpl',
  showConfetti = true,
  exchangeRate,
  platformFee,
  usdValue,
  destinationAddress
}: UnifiedSuccessModalProps) {
  const { toast } = useToast();
  const [showAnimation, setShowAnimation] = useState(false);
  const [, navigate] = useLocation();

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('modal-open');
      setShowAnimation(true);
      const timer = setTimeout(() => setShowAnimation(false), 3000);
      return () => {
        clearTimeout(timer);
        document.body.classList.remove('modal-open');
      };
    } else {
      document.body.classList.remove('modal-open');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: `${label} copied to clipboard`,
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Unable to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const getExplorerUrl = (hash: string) => {
    switch (chain?.toLowerCase()) {
      case 'ethereum':
      case 'eth':
        return `https://etherscan.io/tx/${hash}`;
      case 'solana':
      case 'sol':
        return `https://solscan.io/tx/${hash}`;
      case 'xrpl':
      case 'xrp':
      default:
        return `https://livenet.xrpl.org/transactions/${hash}`;
    }
  };

  const truncateHash = (hash: string) => {
    if (!hash || hash.length <= 16) return hash;
    return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
  };

  const getSuccessStateClass = () => {
    switch (type) {
      case 'swap':
        return 'success-state-swap';
      case 'bridge':
        return 'success-state-bridge';
      default:
        return 'success-state-payment';
    }
  };

  return (
    <>
      {/* Confetti Animation */}
      {showConfetti && showAnimation && (
        <div className="confetti-container" style={{ zIndex: 9992 }}>
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="confetti-piece"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
              }}
            >
              {['🎉', '✨', '🎊', '⭐', '💫'][Math.floor(Math.random() * 5)]}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <div className="unified-modal-overlay" onClick={onClose}>
        <div className="success-card" onClick={(e) => e.stopPropagation()}>
          {/* Close Button */}
          <button className="unified-modal-close" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>

          {/* Success Icon */}
          <div className={`success-icon-container ${getSuccessStateClass()}`}>
            <CheckCircle className="success-icon" />
          </div>

          {/* Title and Message */}
          <h2 className="success-title">{title}</h2>
          <p className="success-description">{message}</p>

          {/* Transaction Details */}
          {(fromToken || txHash) && (
            <div className="success-details">
              {fromToken && toToken && (
                <>
                  <div className="success-detail-row">
                    <span className="success-detail-label">From</span>
                    <span className="success-detail-value">
                      {fromAmount} {fromToken}
                    </span>
                  </div>
                  <div className="success-detail-row">
                    <span className="success-detail-label">To</span>
                    <span className="success-detail-value">
                      {toAmount} {toToken}
                    </span>
                  </div>
                </>
              )}
              
              {exchangeRate && (
                <div className="success-detail-row">
                  <span className="success-detail-label">Exchange Rate</span>
                  <span className="success-detail-value">{exchangeRate}</span>
                </div>
              )}
              
              {platformFee && (
                <div className="success-detail-row">
                  <span className="success-detail-label">Platform Fee</span>
                  <span className="success-detail-value">{platformFee}</span>
                </div>
              )}
              
              {usdValue && (
                <div className="success-detail-row">
                  <span className="success-detail-label">USD Value</span>
                  <span className="success-detail-value">${usdValue}</span>
                </div>
              )}
              
              {destinationAddress && (
                <div className="success-detail-row">
                  <span className="success-detail-label">Destination</span>
                  <div className="success-detail-value" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>{truncateHash(destinationAddress)}</span>
                    <button
                      onClick={() => copyToClipboard(destinationAddress, 'Destination address')}
                      className="unified-button-icon"
                      aria-label="Copy destination address"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
              )}
              
              {txHash && (
                <div className="success-detail-row">
                  <span className="success-detail-label">Transaction</span>
                  <div className="success-detail-value" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>{truncateHash(txHash)}</span>
                    <button
                      onClick={() => copyToClipboard(txHash, 'Transaction hash')}
                      className="unified-button-icon"
                      aria-label="Copy transaction hash"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="success-actions">
            {type === 'bridge' && (
              <button 
                onClick={() => {
                  navigate('/transactions');
                  onClose();
                }}
                className="success-action-secondary"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <History size={16} style={{ marginRight: '8px' }} />
                Recent Transactions
              </button>
            )}
            
            {txHash && (
              <a
                href={getExplorerUrl(txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="success-action-secondary"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
              >
                <ExternalLink size={16} style={{ marginRight: '8px' }} />
                View on Explorer
              </a>
            )}
            
            <button onClick={onClose} className="success-action-primary">
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
