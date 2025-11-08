import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  X, 
  Download, 
  Copy, 
  Check,
  QrCode
} from 'lucide-react';
import QRCode from 'qrcode';
import { useToast } from '@/hooks/use-toast';

interface ReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  chain: string;
  address: string;
}

export function ReceiveModal({ isOpen, onClose, chain, address }: ReceiveModalProps) {
  const { toast } = useToast();
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const generateQRCode = async () => {
    // QR generation disabled - using external wallet connections instead
    console.log('QR generation disabled for wallet addresses');
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    toast({
      title: "Address Copied! 📋",
      description: "Wallet address copied to clipboard"
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadQR = () => {
    if (!qrCodeUrl) return;
    
    const link = document.createElement('a');
    link.download = `receive-qr-${chain}-${Date.now()}.png`;
    link.href = qrCodeUrl;
    link.click();
    
    toast({
      title: "QR Code Downloaded! 💾",
      description: "Payment QR code saved to device"
    });
  };

  // Generate QR code when modal opens
  React.useEffect(() => {
    if (isOpen) {
      generateQRCode();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5" />
              Receive {chain.toUpperCase()}
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* QR Code Display */}
          <div className="flex justify-center">
            <div className="p-4 bg-white rounded-lg shadow-lg">
              {qrCodeUrl ? (
                <img src={qrCodeUrl} alt="Payment QR Code" className="w-48 h-48" />
              ) : (
                <div className="w-48 h-48 bg-gray-200 flex items-center justify-center rounded">
                  <QrCode className="w-12 h-12 text-gray-400" />
                </div>
              )}
            </div>
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label>Wallet Address</Label>
            <div className="flex gap-2">
              <Input 
                value={address} 
                readOnly 
                className="font-mono text-xs"
              />
              <Button 
                variant="outline" 
                size="icon"
                onClick={copyAddress}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>


          {/* Actions */}
          <div className="flex gap-2">
            <Button onClick={copyAddress} variant="outline" className="flex-1">
              <Copy className="w-4 h-4 mr-2" />
              Copy Address
            </Button>
            <Button onClick={downloadQR} variant="outline" className="flex-1">
              <Download className="w-4 h-4 mr-2" />
              Download QR
            </Button>
          </div>

          <div className="text-xs text-gray-500 text-center">
            Share this QR code or address to receive {chain.toUpperCase()}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import React from 'react';
