import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { QrCode, Copy, Check, Download, CreditCard, Smartphone } from 'lucide-react';
import QRCode from 'qrcode';
import { useToast } from '@/hooks/use-toast';
import { XamanPaymentModal } from '@/components/xaman/XamanPaymentModal';

interface PaymentQRCodeProps {
  chain: string;
  address: string;
  amount?: string;
  memo?: string;
}

export function PaymentQRCode({ chain, address, amount, memo }: PaymentQRCodeProps) {
  const { toast } = useToast();
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState(amount || '');
  const [paymentMemo, setPaymentMemo] = useState(memo || '');
  const [copied, setCopied] = useState(false);
  const [showXamanPayment, setShowXamanPayment] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('address');

  // Determine if chain supports Xaman (XRPL only)
  const supportsXaman = chain.toLowerCase() === 'xrp' || chain.toLowerCase() === 'xrpl';

  const generateAddressQRCode = async () => {
    if (!address) return;
    
    try {
      // Generate basic address QR for non-XRPL chains or backup option
      let qrData = address;
      
      // Add amount and memo for compatible formats
      if (paymentAmount) {
        if (chain.toLowerCase() === 'btc') {
          qrData = `bitcoin:${address}?amount=${paymentAmount}`;
        } else if (chain.toLowerCase() === 'eth') {
          qrData = `ethereum:${address}?value=${parseFloat(paymentAmount) * 1e18}`;
        } else {
          qrData = `${address}?amount=${paymentAmount}`;
        }
        
        if (paymentMemo) {
          qrData += `&memo=${encodeURIComponent(paymentMemo)}`;
        }
      }

      const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setQrCodeUrl(qrCodeDataUrl);
    } catch (error) {
      console.error('QR code generation failed:', error);
    }
  };

  useEffect(() => {
    if (activeTab === 'address') {
      generateAddressQRCode();
    }
  }, [address, paymentAmount, paymentMemo, activeTab]);

  const copyAddress = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    toast({
      title: "Copied!",
      description: "Address copied to clipboard"
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadQR = () => {
    if (!qrCodeUrl) return;
    
    const link = document.createElement('a');
    link.download = `payment-qr-${chain}-${Date.now()}.png`;
    link.href = qrCodeUrl;
    link.click();
    
    toast({
      title: "Downloaded",
      description: "QR code saved to downloads"
    });
  };

  const handleXamanPaymentSuccess = (data: any) => {
    toast({
      title: "Payment Successful",
      description: "Payment was successfully sent via Xaman"
    });
  };

  const handleXamanPaymentError = (error: string) => {
    toast({
      title: "Payment Failed",
      description: error,
      variant: "destructive"
    });
  };

  return (
    <Card data-testid="payment-qr-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="w-5 h-5" />
          Payment QR Code
          {supportsXaman && (
            <Badge variant="secondary" className="ml-auto">
              <Smartphone className="w-3 h-3 mr-1" />
              Xaman Ready
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {supportsXaman ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="address" data-testid="tab-address-qr">
                <QrCode className="w-4 h-4 mr-2" />
                Address QR
              </TabsTrigger>
              <TabsTrigger value="xaman" data-testid="tab-xaman-payment">
                <CreditCard className="w-4 h-4 mr-2" />
                Xaman Payment
              </TabsTrigger>
            </TabsList>

            <TabsContent value="address" className="space-y-4">
              {/* Standard Address QR Code */}
              {qrCodeUrl && (
                <div className="flex justify-center p-4 bg-white dark:bg-gray-50 rounded-lg">
                  <img 
                    src={qrCodeUrl} 
                    alt="Address QR Code" 
                    className="w-48 h-48"
                    data-testid="address-qr-image"
                  />
                </div>
              )}

              {/* Address Display */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Wallet Address</label>
                <div className="flex gap-2">
                  <Input
                    value={address}
                    readOnly
                    className="font-mono text-xs"
                    data-testid="input-wallet-address"
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={copyAddress}
                    data-testid="button-copy-address"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              {/* Amount Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Amount (Optional)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  data-testid="input-amount"
                />
              </div>

              {/* Memo Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Memo/Tag (Optional)</label>
                <Input
                  placeholder="Payment reference"
                  value={paymentMemo}
                  onChange={(e) => setPaymentMemo(e.target.value)}
                  data-testid="input-memo"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  onClick={generateAddressQRCode}
                  className="flex-1"
                  variant="outline"
                  data-testid="button-regenerate-qr"
                >
                  Regenerate QR
                </Button>
                <Button
                  onClick={downloadQR}
                  className="flex-1"
                  data-testid="button-download-qr"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </div>

              {/* Chain Info */}
              <div className="text-xs text-muted-foreground text-center p-2 bg-muted rounded">
                {chain.toUpperCase()} Network • Basic address QR code
              </div>
            </TabsContent>

            <TabsContent value="xaman" className="space-y-4">
              {/* Xaman Payment Section */}
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg">
                    <Smartphone className="w-12 h-12 mx-auto text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                
                <div>
                  <h3 className="font-semibold text-lg">Create Xaman Payment Request</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Generate a secure payment request that can be signed with the Xaman wallet app
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>XRPL native transactions</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>Secure signature verification</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>QR code & deep link support</span>
                  </div>
                </div>

                <Button 
                  onClick={() => setShowXamanPayment(true)}
                  size="lg"
                  className="w-full"
                  data-testid="button-create-xaman-payment"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Create Xaman Payment Request
                </Button>

                <div className="text-xs text-muted-foreground text-center p-2 bg-muted rounded">
                  XRPL Network • Secure Xaman wallet integration
                </div>
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          // Non-XRPL chains - basic functionality only
          <div className="space-y-4">
            {/* QR Code Display */}
            {qrCodeUrl && (
              <div className="flex justify-center p-4 bg-white dark:bg-gray-50 rounded-lg">
                <img 
                  src={qrCodeUrl} 
                  alt="Payment QR Code" 
                  className="w-48 h-48"
                  data-testid="payment-qr-image"
                />
              </div>
            )}

            {/* Address Display */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Wallet Address</label>
              <div className="flex gap-2">
                <Input
                  value={address}
                  readOnly
                  className="font-mono text-xs"
                  data-testid="input-wallet-address"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={copyAddress}
                  data-testid="button-copy-address"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Amount Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Amount (Optional)</label>
              <Input
                type="number"
                placeholder="0.00"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                data-testid="input-amount"
              />
            </div>

            {/* Memo Input */}
            {(chain === 'xrp' || chain === 'sol' || chain === 'btc') && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Memo/Tag (Optional)</label>
                <Input
                  placeholder="Payment reference"
                  value={paymentMemo}
                  onChange={(e) => setPaymentMemo(e.target.value)}
                  data-testid="input-memo"
                />
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={generateAddressQRCode}
                className="flex-1"
                variant="outline"
                data-testid="button-regenerate-qr"
              >
                Regenerate QR
              </Button>
              <Button
                onClick={downloadQR}
                className="flex-1"
                data-testid="button-download-qr"
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>

            {/* Chain Info */}
            <div className="text-xs text-muted-foreground text-center p-2 bg-muted rounded">
              {chain.toUpperCase()} Network • Scan to send payment
            </div>
          </div>
        )}
      </CardContent>

      {/* Xaman Payment Modal */}
      <XamanPaymentModal
        isOpen={showXamanPayment}
        onClose={() => setShowXamanPayment(false)}
        defaultAmount={paymentAmount}
        defaultDestination={address}
        defaultMemo={paymentMemo}
        onPaymentSuccess={handleXamanPaymentSuccess}
        onPaymentError={handleXamanPaymentError}
      />
    </Card>
  );
}
