import { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Eye, 
  EyeOff, 
  Copy, 
  Check, 
  AlertTriangle, 
  Key,
  X 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ImportedWalletsSection } from './ImportedWalletsSection';

interface PrivateKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PrivateKeys {
  xrp: {
    seed: string | null;
    address: string | null;
  };
  eth: {
    privateKey: string | null;
    address: string | null;
  };
  sol: {
    privateKey: string | null;
    address: string | null;
  };
  btc: {
    privateKey: string | null;
    address: string | null;
  };
}

export function PrivateKeyModal({ isOpen, onClose }: PrivateKeyModalProps) {
  const [password, setPassword] = useState('');
  const [privateKeys, setPrivateKeys] = useState<PrivateKeys | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password) {
      setError('Password is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const sessionToken = localStorage.getItem('sessionToken') || 
                          JSON.parse(sessionStorage.getItem('riddle_wallet_session') || '{}').sessionToken;

      const response = await fetch('/api/wallet-security/private-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ password })
      });

      if (!response.ok) {
        const errorData = await response.json() as any;
        throw new Error(errorData.error || 'Failed to retrieve private keys');
      }

      const data = await response.json() as any;
      
      if (data.success) {
        setPrivateKeys(data.privateKeys);
        setPassword(''); // Clear password for security
        toast({
          title: 'Private Keys Retrieved',
          description: 'Your private keys have been successfully retrieved.',
        });
      } else {
        throw new Error(data.error || 'Unknown error occurred');
      }
    } catch (error) {
      console.error('Error retrieving private keys:', error);
      setError(error instanceof Error ? error.message : 'Failed to retrieve private keys');
    } finally {
      setLoading(false);
    }
  };

  const toggleKeyVisibility = (keyId: string) => {
    setVisibleKeys(prev => ({
      ...prev,
      [keyId]: !prev[keyId]
    }));
  };

  const copyToClipboard = async (text: string, keyName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(keyName);
      toast({
        title: 'Copied!',
        description: `${keyName} copied to clipboard`,
      });
      
      // Clear the copied state after 2 seconds
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (error) {
      toast({
        title: 'Copy Failed',
        description: 'Failed to copy to clipboard',
        variant: 'destructive'
      });
    }
  };

  const handleClose = () => {
    setPassword('');
    setPrivateKeys(null);
    setError('');
    setVisibleKeys({});
    setCopiedKey(null);
    onClose();
  };

  const renderPrivateKeyCard = (
    chain: string,
    chainName: string,
    keyData: { privateKey?: string | null; seed?: string | null; address: string | null },
    color: string
  ) => {
    const keyValue = keyData.privateKey || keyData.seed;
    const keyType = keyData.privateKey ? 'Private Key' : 'Seed Phrase';
    const keyId = `${chain}_key`;

    if (!keyValue) {
      return null;
    }

    return (
      <Card key={chain} className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <div className={`w-8 h-8 ${color} rounded-full flex items-center justify-center text-white font-semibold text-sm`}>
              {chainName.substring(0, 3).toUpperCase()}
            </div>
            <span>{chainName} {keyType}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium">Address</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input 
                  value={keyData.address || 'No address available'} 
                  readOnly 
                  className="font-mono text-sm"
                />
                {keyData.address && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(keyData.address!, `${chainName} Address`)}
                  >
                    {copiedKey === `${chainName} Address` ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                )}
              </div>
            </div>
            
            <div>
              <Label className="text-sm font-medium">{keyType}</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input 
                  type={visibleKeys[keyId] ? 'text' : 'password'}
                  value={keyValue}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => toggleKeyVisibility(keyId)}
                >
                  {visibleKeys[keyId] ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(keyValue, `${chainName} ${keyType}`)}
                >
                  {copiedKey === `${chainName} ${keyType}` ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="w-[95vw] sm:w-[90%] sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[90vh] overflow-y-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              <DialogTitle>Private Key Access</DialogTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <DialogDescription>
            Enter your wallet password to view your private keys and seed phrases. Keep this information secure and never share it with anyone.
          </DialogDescription>
        </DialogHeader>

        <Alert className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Security Warning:</strong> Never share your private keys or seed phrases with anyone. 
            RiddleSwap will never ask for your private keys. Anyone with access to these can control your funds.
          </AlertDescription>
        </Alert>

        {!privateKeys ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="password">Wallet Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your wallet password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1"
                disabled={loading}
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>
                {loading ? 'Retrieving...' : 'Access Private Keys'}
              </Button>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div>
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2">Your Private Keys</h3>
              <p className="text-sm text-gray-600">
                Use the eye icon to show/hide keys and the copy button to copy them.
              </p>
            </div>

            <div className="space-y-4">
              {renderPrivateKeyCard('xrp', 'XRP Ledger', privateKeys.xrp, 'bg-blue-500')}
              {renderPrivateKeyCard('eth', 'Ethereum', privateKeys.eth, 'bg-green-500')}
              {renderPrivateKeyCard('sol', 'Solana', privateKeys.sol, 'bg-purple-500')}
              {renderPrivateKeyCard('btc', 'Bitcoin', privateKeys.btc, 'bg-orange-500')}
            </div>

            <div className="flex gap-2 mt-6">
              <Button onClick={handleClose} variant="outline">
                Close
              </Button>
            </div>
            
            {/* Imported Wallets Section */}
            <ImportedWalletsSection />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
