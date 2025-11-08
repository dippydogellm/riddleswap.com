import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet } from 'lucide-react';
import { WalletConnectionDashboard } from '@/components/wallet-connection-dashboard';

const ExternalWalletTest: React.FC = () => {
  const [showDashboard, setShowDashboard] = useState(false);

  return (
    <>
      <Card className="max-w-md mx-auto mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            External Wallet Test
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              Test the external wallet connection system with organized wallet-chain management.
            </p>
          </div>

          <Button 
            onClick={() => setShowDashboard(true)}
            className="w-full"
          >
            Open Wallet Dashboard
          </Button>

          <div className="text-xs text-gray-500 space-y-1">
            <p>✓ Organized wallet-chain connections</p>
            <p>✓ Support for Gem, Xaman, Joey, MetaMask, Phantom, Solflare</p>
            <p>✓ Mobile-friendly with simple icons</p>
            <p>✓ WalletConnect QR code support</p>
          </div>
        </CardContent>
      </Card>

      <WalletConnectionDashboard 
        isOpen={showDashboard}
        onClose={() => setShowDashboard(false)}
      />
    </>
  );
};

export default ExternalWalletTest;
