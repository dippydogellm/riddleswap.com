import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { 
  generateWalletFromMnemonic, 
  generateWalletFromPrivateKey, 
  generateRandomMnemonic,
  validateMnemonic,
  validatePrivateKey,
  saveImportedWallet,
  type SupportedChain 
} from "@/lib/wallet-import-simple";
import { Eye, EyeOff, Key, FileText, Plus, Download } from "lucide-react";

interface WalletImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (address: string, chain: SupportedChain) => void;
}

const SUPPORTED_CHAINS: { value: SupportedChain; label: string; icon: string }[] = [
  { value: 'ethereum', label: 'Ethereum', icon: '🟢' },
  { value: 'bitcoin', label: 'Bitcoin', icon: '🟠' },
  { value: 'solana', label: 'Solana', icon: '🟣' },
  { value: 'xrpl', label: 'XRPL', icon: '🔵' },
  { value: 'base', label: 'Base', icon: '🔷' },
  { value: 'bsc', label: 'BNB Chain', icon: '🟡' },
  { value: 'polygon', label: 'Polygon', icon: '🟪' },
];

export function WalletImportModal({ isOpen, onClose, onSuccess }: WalletImportModalProps) {
  const [importTab, setImportTab] = useState<'private-key' | 'mnemonic' | 'generate'>('mnemonic');
  const [selectedChain, setSelectedChain] = useState<SupportedChain>('ethereum');
  const [privateKey, setPrivateKey] = useState('');
  const [mnemonic, setMnemonic] = useState('');
  const [walletName, setWalletName] = useState('');
  const [password, setPassword] = useState('');
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [generatedWallet, setGeneratedWallet] = useState<{
    address: string;
    privateKey: string;
    mnemonic: string;
  } | null>(null);
  
  const { toast } = useToast();

  const validateInput = () => {
    setValidationError('');
    
    if (!selectedChain) {
      setValidationError('Please select a blockchain');
      return false;
    }
    
    if (!password) {
      setValidationError('Password is required to encrypt your wallet');
      return false;
    }
    
    if (password.length < 8) {
      setValidationError('Password must be at least 8 characters long');
      return false;
    }
    
    if (importTab === 'private-key') {
      if (!privateKey.trim()) {
        setValidationError('Private key is required');
        return false;
      }
      
      if (!validatePrivateKey(privateKey, selectedChain)) {
        setValidationError(`Invalid private key format for ${selectedChain}`);
        return false;
      }
    }
    
    if (importTab === 'mnemonic') {
      if (!mnemonic.trim()) {
        setValidationError('Seed phrase is required');
        return false;
      }
      
      if (!validateMnemonic(mnemonic)) {
        setValidationError('Invalid seed phrase format');
        return false;
      }
    }
    
    return true;
  };

  const handleImport = async () => {
    if (!validateInput()) return;
    
    setIsImporting(true);
    
    try {
      let result;
      
      if (importTab === 'private-key') {
        result = await generateWalletFromPrivateKey(privateKey, selectedChain);
      } else if (importTab === 'mnemonic') {
        result = await generateWalletFromMnemonic(mnemonic, selectedChain);
      } else if (importTab === 'generate' && generatedWallet) {
        result = await generateWalletFromMnemonic(generatedWallet.mnemonic, selectedChain);
      } else {
        throw new Error('Invalid import method');
      }
      
      if (!result.success || !result.wallet) {
        throw new Error(result.error || 'Failed to generate wallet');
      }
      
      // Save wallet to database
      const walletData = {
        ...result.wallet,
        wallet_name: walletName || `${selectedChain} Wallet`,
        import_method: importTab === 'generate' ? 'generated' : importTab.replace('-', '_') as any
      };
      
      const saved = await saveImportedWallet(walletData, password);
      
      if (!saved) {
        throw new Error('Failed to save wallet');
      }
      
      toast({
        title: "Wallet imported successfully!",
        description: `Your ${selectedChain} wallet has been securely imported.`,
      });
      
      onSuccess(result.wallet.address, selectedChain);
      handleClose();
      
    } catch (error) {
      console.error('Import error:', error);
      setValidationError(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  const handleGenerateWallet = async () => {
    try {
      const newMnemonic = generateRandomMnemonic();
      const result = await generateWalletFromMnemonic(newMnemonic, selectedChain);
      
      if (!result.success || !result.wallet) {
        throw new Error(result.error || 'Failed to generate wallet');
      }
      
      setGeneratedWallet({
        address: result.wallet.address,
        privateKey: result.wallet.privateKey,
        mnemonic: newMnemonic
      });
      
      setMnemonic(newMnemonic);
      
    } catch (error) {
      console.error('Generation error:', error);
      setValidationError(error instanceof Error ? error.message : 'Generation failed');
    }
  };

  const handleClose = () => {
    setPrivateKey('');
    setMnemonic('');
    setWalletName('');
    setPassword('');
    setValidationError('');
    setGeneratedWallet(null);
    setIsImporting(false);
    onClose();
  };

  const downloadWalletInfo = () => {
    if (!generatedWallet) return;
    
    const walletInfo = {
      address: generatedWallet.address,
      chain: selectedChain,
      mnemonic: generatedWallet.mnemonic,
      privateKey: generatedWallet.privateKey,
      createdAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(walletInfo, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedChain}-wallet-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] sm:w-[90%] sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[90vh] overflow-y-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Import Wallet
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Chain Selection */}
          <div className="space-y-2">
            <Label>Select Blockchain</Label>
            <Select value={selectedChain} onValueChange={(value) => setSelectedChain(value as SupportedChain)}>
              <SelectTrigger>
                <SelectValue placeholder="Choose blockchain" />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_CHAINS.map((chain) => (
                  <SelectItem key={chain.value} value={chain.value}>
                    <div className="flex items-center gap-2">
                      <span>{chain.icon}</span>
                      <span>{chain.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Import Method Tabs */}
          <Tabs value={importTab} onValueChange={(value) => setImportTab(value as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="mnemonic" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Seed Phrase
              </TabsTrigger>
              <TabsTrigger value="private-key" className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                Private Key
              </TabsTrigger>
              <TabsTrigger value="generate" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Generate New
              </TabsTrigger>
            </TabsList>

            {/* Seed Phrase Import */}
            <TabsContent value="mnemonic" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Import from Seed Phrase</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Seed Phrase (12 or 24 words)</Label>
                    <div className="relative">
                      <Textarea
                        value={mnemonic}
                        onChange={(e) => setMnemonic(e.target.value)}
                        placeholder="Enter your 12 or 24 word seed phrase..."
                        className="min-h-[100px] pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-2 top-2"
                        onClick={() => setShowMnemonic(!showMnemonic)}
                      >
                        {showMnemonic ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Private Key Import */}
            <TabsContent value="private-key" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Import from Private Key</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Private Key</Label>
                    <div className="relative">
                      <Input
                        type={showPrivateKey ? "text" : "password"}
                        value={privateKey}
                        onChange={(e) => setPrivateKey(e.target.value)}
                        placeholder="Enter your private key..."
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-2 top-1/2 -translate-y-1/2"
                        onClick={() => setShowPrivateKey(!showPrivateKey)}
                      >
                        {showPrivateKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Generate New Wallet */}
            <TabsContent value="generate" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Generate New Wallet</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!generatedWallet ? (
                    <Button onClick={handleGenerateWallet} className="w-full">
                      <Plus className="h-4 w-4 mr-2" />
                      Generate New Wallet
                    </Button>
                  ) : (
                    <div className="space-y-4">
                      <Alert>
                        <AlertDescription>
                          <strong>Important:</strong> Save your seed phrase and private key securely. 
                          You'll need them to restore your wallet.
                        </AlertDescription>
                      </Alert>
                      
                      <div className="space-y-3 p-4 bg-muted rounded-lg">
                        <div>
                          <Label className="text-xs text-muted-foreground">Address</Label>
                          <p className="text-sm font-mono break-all">{generatedWallet.address}</p>
                        </div>
                        
                        <div>
                          <Label className="text-xs text-muted-foreground">Seed Phrase</Label>
                          <p className="text-sm font-mono break-all">{generatedWallet.mnemonic}</p>
                        </div>
                        
                        <div>
                          <Label className="text-xs text-muted-foreground">Private Key</Label>
                          <p className="text-sm font-mono break-all">{generatedWallet.privateKey}</p>
                        </div>
                      </div>
                      
                      <Button onClick={downloadWalletInfo} variant="outline" className="w-full">
                        <Download className="h-4 w-4 mr-2" />
                        Download Wallet Info
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Common Fields */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Wallet Name (Optional)</Label>
              <Input
                value={walletName}
                onChange={(e) => setWalletName(e.target.value)}
                placeholder={`My ${selectedChain} Wallet`}
              />
            </div>

            <div className="space-y-2">
              <Label>Encryption Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter a strong password to encrypt your wallet"
              />
              <p className="text-xs text-muted-foreground">
                This password will be used to encrypt your private key. Choose a strong password.
              </p>
            </div>
          </div>

          {/* Error Display */}
          {validationError && (
            <Alert variant="destructive">
              <AlertDescription>{validationError}</AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={handleImport}
              disabled={isImporting}
              className="flex-1"
            >
              {isImporting ? "Importing..." : "Import Wallet"}
            </Button>
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isImporting}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
