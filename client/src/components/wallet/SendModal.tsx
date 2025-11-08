import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumericInput } from '@/components/ui/numeric-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  X, 
  Send, 
  Camera, 
  Scan,
  Check,
  AlertCircle,
  Loader2,
  ChevronDown,
  Coins
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SendModalProps {
  isOpen: boolean;
  onClose: () => void;
  chain: string;
  fromAddress: string;
  tokens?: any[]; // Available tokens for sending
  xrpBalance?: string; // XRP balance for display
  sessionToken?: string; // Session token for authentication
  onSendComplete?: () => void;
}

export function SendModal({ isOpen, onClose, chain, fromAddress, tokens = [], xrpBalance = '0', sessionToken, onSendComplete }: SendModalProps) {
  const { toast } = useToast();
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [destinationTag, setDestinationTag] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [selectedToken, setSelectedToken] = useState<any>(null);
  const [showTokenSelector, setShowTokenSelector] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Prepare available assets (native + tokens)
  const availableAssets = [
    {
      currency: chain.toUpperCase(),
      name: `${chain.toUpperCase()} (Native)`,
      balance: xrpBalance,
      logo: chain === 'xrp' ? 'https://cryptologos.cc/logos/xrp-xrp-logo.png' : null,
      isNative: true
    },
    ...tokens.filter(token => parseFloat(token.balance) > 0).map(token => ({
      ...token,
      // Ensure RDL gets its proper logo, not XRP logo
      logo: token.currency === 'RDL' || token.symbol === 'RDL' ? 
        'https://dd.dexscreener.com/ds-data/tokens/xrpl/rdl.r9xvnzuwzjpdu3na6mkhmkhkjqtrqcrgu9.png?key=7c1c6a' : 
        token.logo
    }))
  ];

  // Initialize selected token to native asset
  useEffect(() => {
    if (!selectedToken && availableAssets.length > 0) {
      setSelectedToken(availableAssets[0]); // Default to native
    }
  }, [availableAssets.length]);

  const startCamera = async () => {
    try {
      setScanning(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (error) {
      console.error('Camera error:', error);
      toast({
        title: "Camera Error",
        description: "Unable to access camera for QR scanning",
        variant: "destructive"
      });
      setScanning(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setScanning(false);
  };

  const scanQRCode = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    try {
      // Use jsQR library for QR code detection
      // This would need to be imported if available
      // For now, we'll simulate QR detection
      
      // Simulate QR code detection
      setTimeout(() => {
        // SECURITY: No mock addresses - real QR code scanning would be implemented here
        // For now, just show that QR scanning is not yet implemented
        toast({
          title: "QR Scanner",
          description: "QR code scanning not yet implemented. Please enter address manually.",
          variant: "destructive"
        });
        // No mock address set
      }, 1000);
    } catch (error) {
      console.error('QR scan error:', error);
    }
  };

  const handleSend = async () => {
    if (!recipientAddress || !amount) {
      toast({
        title: "Missing Information",
        description: "Please provide recipient address and amount",
        variant: "destructive"
      });
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    try {
      if (!sessionToken) {
        throw new Error('Session token not found');
      }
      
      // Use the generic payment endpoint
      const requestBody: any = {
        toAddress: recipientAddress,
        amount: amount,
        chain: chain,
        asset: selectedToken?.isNative ? 'native' : 'token'
      };

      // Add token-specific fields for non-native assets
      if (!selectedToken?.isNative) {
        requestBody.tokenCurrency = selectedToken?.currencyCode || selectedToken?.currency;
        requestBody.tokenIssuer = selectedToken?.issuer;
      }
      
      // Add XRP-specific fields
      if (chain === 'xrp') {
        if (destinationTag) {
          requestBody.destinationTag = parseInt(destinationTag);
        }
        if (memo) {
          requestBody.memo = memo;
        }
      } else {
        // For non-XRP chains, just include memo if present
        if (memo) {
          requestBody.memo = memo;
        }
      }
      
      const response = await fetch('/api/payment/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify(requestBody)
      });

      const result = await response.json() as any;

      if (result.success) {
        // Show prominent success notification
        toast({
          title: "✅ Transaction Successful!",
          description: `Successfully sent ${amount} ${selectedToken?.currency || chain.toUpperCase()} to ${recipientAddress.slice(0, 8)}...${recipientAddress.slice(-4)}`,
          duration: 5000, // Show for 5 seconds
        });
        
        // Clear form
        setRecipientAddress('');
        setAmount('');
        setMemo('');
        setDestinationTag('');
        
        // Small delay to ensure user sees the success message
        setTimeout(() => {
          // Call completion callback 
          onSendComplete?.();
          onClose();
        }, 1500); // Close modal after 1.5 seconds
      } else {
        throw new Error(result.error || 'Transaction failed');
      }
    } catch (error) {
      console.error('Send error:', error);
      toast({
        title: "Transaction Failed",
        description: error instanceof Error ? error.message : "Failed to send transaction",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const validateAddress = (address: string) => {
    // Chain-specific address validation
    if (chain === 'xrp') {
      return address.length >= 25 && address.length <= 34 && address.startsWith('r');
    } else if (chain === 'sol') {
      // Solana address validation - 32-44 characters, base58 encoded
      return address.length >= 32 && address.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(address);
    } else if (chain === 'eth') {
      // Ethereum address validation - 42 characters, starts with 0x
      return address.length === 42 && address.startsWith('0x');
    } else if (chain === 'btc') {
      // Bitcoin address validation - basic check
      return address.length >= 26 && address.length <= 35;
    }
    return address.length > 0;
  };

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
    }
    
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              Send {chain.toUpperCase()}
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {scanning ? (
            <div className="space-y-4">
              <div className="relative">
                <video
                  ref={videoRef}
                  className="w-full rounded-lg"
                  style={{ maxHeight: '300px' }}
                  playsInline
                />
                <canvas ref={canvasRef} className="hidden" />
                
                <div className="absolute inset-4 border-2 border-blue-500 rounded-lg">
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-blue-500"></div>
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-blue-500"></div>
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-blue-500"></div>
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-blue-500"></div>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button onClick={scanQRCode} className="flex-1">
                  <Scan className="w-4 h-4 mr-2" />
                  Scan QR Code
                </Button>
                <Button onClick={stopCamera} variant="outline">
                  Stop Camera
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="recipient">Recipient Address</Label>
                <div className="flex gap-2">
                  <Input
                    id="recipient"
                    value={recipientAddress}
                    onChange={(e) => setRecipientAddress(e.target.value)}
                    placeholder={`Enter ${chain.toUpperCase()} address`}
                    className="flex-1"
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={startCamera}
                    title="Scan QR Code"
                  >
                    <Camera className="w-4 h-4" />
                  </Button>
                </div>
                {recipientAddress && !validateAddress(recipientAddress) && (
                  <div className="flex items-center gap-2 text-red-500 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    Invalid {chain.toUpperCase()} address format
                  </div>
                )}
                {recipientAddress && validateAddress(recipientAddress) && (
                  <div className="flex items-center gap-2 text-green-500 text-sm">
                    <Check className="w-4 h-4" />
                    Valid address
                  </div>
                )}
              </div>

              {/* Token Selection */}
              <div className="space-y-2">
                <Label>Select Asset</Label>
                <div className="relative">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between"
                    onClick={() => setShowTokenSelector(!showTokenSelector)}
                  >
                    <div className="flex items-center gap-2">
                      {selectedToken?.logo ? (
                        <img 
                          src={selectedToken.logo} 
                          alt={selectedToken.currency}
                          className="w-5 h-5 rounded-full"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const nextElement = e.currentTarget.nextElementSibling as HTMLElement;
                            if (nextElement) nextElement.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div 
                        className="w-5 h-5 bg-gray-300 rounded-full flex items-center justify-center"
                        style={{ display: selectedToken?.logo ? 'none' : 'flex' }}
                      >
                        <Coins className="w-3 h-3" />
                      </div>
                      <span>{selectedToken?.currency || 'Select Asset'}</span>
                      <span className="text-sm text-gray-500">
                        Balance: {selectedToken?.balance || '0'}
                      </span>
                    </div>
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                  
                  {showTokenSelector && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {availableAssets.map((asset, index) => (
                        <button
                          key={index}
                          type="button"
                          className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                          onClick={() => {
                            setSelectedToken(asset);
                            setShowTokenSelector(false);
                          }}
                        >
                          {asset.logo ? (
                            <img 
                              src={asset.logo} 
                              alt={asset.currency}
                              className="w-5 h-5 rounded-full"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const nextElement = e.currentTarget.nextElementSibling as HTMLElement;
                                if (nextElement) nextElement.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div 
                            className="w-5 h-5 bg-gray-300 rounded-full flex items-center justify-center"
                            style={{ display: asset.logo ? 'none' : 'flex' }}
                          >
                            <Coins className="w-3 h-3" />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">{asset.currency}</div>
                            <div className="text-xs text-gray-500">Balance: {asset.balance}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount ({selectedToken?.currency || chain.toUpperCase()})</Label>
                <NumericInput
                  id="amount"
                  step="0.000001"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  showDoubleZero={true}
                />
                {selectedToken && (
                  <p className="text-xs text-gray-500">
                    Available: {selectedToken.balance} {selectedToken.currency}
                  </p>
                )}
              </div>

              {/* Destination Tag field - XRP only */}
              {chain === 'xrp' && (
                <div className="space-y-2">
                  <Label htmlFor="destinationTag">
                    Destination Tag (Optional)
                  </Label>
                  <Input
                    id="destinationTag"
                    type="number"
                    value={destinationTag}
                    onChange={(e) => setDestinationTag(e.target.value)}
                    placeholder="Enter numeric tag (e.g. 12345)"
                  />
                  <p className="text-xs text-gray-500">
                    Required for some exchanges like Binance, Coinbase, Kraken
                  </p>
                </div>
              )}
              
              {/* Memo field - separate from destination tag */}
              <div className="space-y-2">
                <Label htmlFor="memo">
                  Memo (Optional)
                </Label>
                <Textarea
                  id="memo"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="Add a note or message for this transaction"
                  rows={2}
                />
                {chain === 'xrp' && (
                  <p className="text-xs text-gray-500">
                    For personal notes or transaction references
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <Button onClick={onClose} variant="outline" className="flex-1">
                  Cancel
                </Button>
                <Button 
                  onClick={handleSend} 
                  disabled={loading || !recipientAddress || !amount || !validateAddress(recipientAddress)}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send {amount} {selectedToken?.currency || chain.toUpperCase()}
                    </>
                  )}
                </Button>
              </div>

              <div className="text-xs text-gray-500 text-center">
                From: {fromAddress}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
