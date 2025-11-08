import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Shield } from 'lucide-react';
import { XamanSwapQRModalEnhanced } from './xaman-qr-modal-swap-enhanced';

interface TrustlineButtonProps {
  token: {
    symbol: string;
    currency_code: string;
    issuer: string;
    name?: string;
    icon_url?: string;
  };
  walletAddress?: string;
  className?: string;
  size?: 'default' | 'sm' | 'lg';
}

interface TrustlinePayload {
  uuid: string;
  qr: string;
  deepLink: string;
}

export function TrustlineButton({
  token,
  walletAddress,
  className = '',
  size = 'default'
}: TrustlineButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [isCreated, setIsCreated] = useState(false);
  const [trustlinePayload, setTrustlinePayload] = useState<TrustlinePayload | null>(null);

  // Skip for XRP
  if (token.symbol === 'XRP') {
    return null;
  }

  const handleCreateTrustline = async () => {
    try {

      const response = await fetch('/api/xumm/trustline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currency: token.currency_code,
          issuer: token.issuer,
          limit: '1000000000'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create trustline');
      }

      const data = await response.json() as any;

      if (data.uuid && data.refs?.qr_png) {
        const payload = {
          uuid: data.uuid,
          qr: data.refs.qr_png,
          deepLink: data.next?.always || data.refs.qr_uri || ''
        };

        setTrustlinePayload(payload);
        setShowModal(true);
      } else {

      }
    } catch (error) {

    }
  };

  const handleTrustlineSuccess = (txHash: string) => {

    setIsCreated(true);
    setShowModal(false);
    setTrustlinePayload(null);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setTrustlinePayload(null);
  };

  if (isCreated) {
    return (
      <Button
        variant="outline"
        size={size}
        className={`text-green-600 border-green-600 hover:bg-green-50 dark:text-green-400 dark:border-green-400 dark:hover:bg-green-900/20 ${className}`}
        disabled
      >
        <Shield className="h-4 w-4 mr-2" />
        Trustline Active
      </Button>
    );
  }

  return (
    <>
      <Button
        onClick={handleCreateTrustline}
        size={size}
        className={className}
      >
        <Shield className="h-4 w-4 mr-2" />
        Create Trustline
      </Button>

      {/* Use the Xaman QR modal for trustline creation */}
      {showModal && trustlinePayload && (
        <XamanSwapQRModalEnhanced
          isOpen={showModal}
          onClose={handleCloseModal}
          payload={trustlinePayload}
          fromToken={token.symbol}
          toToken="Trustline"
          fromAmount="Create"
          toAmount={token.symbol}
          onSuccess={handleTrustlineSuccess}
        />
      )}
      

    </>
  );
}
