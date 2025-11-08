/**
 * Import Wallet Modal Component
 * Allows users to import wallets from mnemonic phrases, private keys, or XRPL seeds
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Download, Key, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ImportWalletModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportSuccess?: () => void;
}

type Chain = 'ethereum' | 'solana' | 'bitcoin' | 'xrpl';
type InputType = 'mnemonic' | 'private_key' | 'xrpl_seed';

const CHAIN_NAMES: Record<Chain, string> = {
  ethereum: 'Ethereum (EVM)',
  solana: 'Solana',
  bitcoin: 'Bitcoin',
  xrpl: 'XRP Ledger'
};

const INPUT_TYPE_LABELS: Record<InputType, { label: string; icon: any; description: string }> = {
  mnemonic: {
    label: 'Mnemonic Phrase',
    icon: FileText,
    description: '12 or 24 word recovery phrase'
  },
  private_key: {
    label: 'Private Key',
    icon: Key,
    description: 'Hexadecimal or base64 encoded key'
  },
  xrpl_seed: {
    label: 'XRPL Seed/Secret',
    icon: Key,
    description: 'XRPL family seed or secret'
  }
};

export function ImportWalletModal({ open, onOpenChange, onImportSuccess }: ImportWalletModalProps) {
  const [chain, setChain] = useState<Chain>('ethereum');
  const [inputType, setInputType] = useState<InputType>('mnemonic');
  const [input, setInput] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleImport = async () => {
    setError('');
    setSuccess(false);

    // Validation
    if (!input.trim()) {
      setError('Please enter your wallet credentials');
      return;
    }

    if (!password) {
      setError('Please enter a password to encrypt your wallet');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/wallets/import/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          chain,
          input: input.trim(),
          password,
          importType: inputType
        })
      });

      const data = await response.json() as any;

      if (!response.ok) {
        throw new Error(data.error || 'Failed to import wallet');
      }

      setSuccess(true);
      setInput('');
      setPassword('');
      setConfirmPassword('');
      
      setTimeout(() => {
        onImportSuccess?.();
        onOpenChange(false);
        setSuccess(false);
      }, 2000);

    } catch (err: any) {
      console.error('Import error:', err);
      setError(err.message || 'Failed to import wallet');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setInput('');
    setPassword('');
    setConfirmPassword('');
    setError('');
    setSuccess(false);
  };

  const handleChainChange = (value: string) => {
    setChain(value as Chain);
    resetForm();
    
    // Auto-select appropriate input type for XRPL
    if (value === 'xrpl') {
      setInputType('xrpl_seed');
    } else if (inputType === 'xrpl_seed') {
      setInputType('mnemonic');
    }
  };

  const availableInputTypes = chain === 'xrpl' 
    ? ['mnemonic', 'xrpl_seed'] as InputType[]
    : ['mnemonic', 'private_key'] as InputType[];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:w-[90%] sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[90vh] overflow-y-auto max-h-[90vh] overflow-y-auto bg-gradient-to-br from-slate-900 to-slate-800 border-blue-500/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl text-white">
            <Download className="w-6 h-6 text-blue-400" />
            Import Wallet
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Chain Selection */}
          <div className="space-y-2">
            <Label htmlFor="chain" className="text-sm font-medium text-gray-300">
              Select Blockchain
            </Label>
            <Select value={chain} onValueChange={handleChainChange}>
              <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white">
                <SelectValue placeholder="Select chain" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {Object.entries(CHAIN_NAMES).map(([value, label]) => (
                  <SelectItem 
                    key={value} 
                    value={value}
                    className="text-white hover:bg-slate-700"
                  >
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Input Type Tabs */}
          <div>
            <Label className="text-sm font-medium text-gray-300 mb-2 block">
              Import Method
            </Label>
            <Tabs value={inputType} onValueChange={(v) => setInputType(v as InputType)}>
              <TabsList className="grid w-full grid-cols-2 bg-slate-800/50">
                {availableInputTypes.map((type) => {
                  const { label, icon: Icon } = INPUT_TYPE_LABELS[type];
                  return (
                    <TabsTrigger 
                      key={type} 
                      value={type}
                      className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {label}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {availableInputTypes.map((type) => {
                const { description } = INPUT_TYPE_LABELS[type];
                return (
                  <TabsContent key={type} value={type} className="space-y-4 mt-4">
                    <p className="text-sm text-gray-400">{description}</p>
                    
                    <div className="space-y-2">
                      <Label htmlFor="input" className="text-sm font-medium text-gray-300">
                        {INPUT_TYPE_LABELS[type].label}
                      </Label>
                      <textarea
                        id="input"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={
                          type === 'mnemonic' 
                            ? 'Enter your 12 or 24 word recovery phrase...'
                            : type === 'xrpl_seed'
                            ? 'Enter your XRPL seed (sXXX...) or secret...'
                            : 'Enter your private key...'
                        }
                        className="w-full min-h-[120px] p-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
                        disabled={loading}
                      />
                    </div>

                    {/* Password Fields */}
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="password" className="text-sm font-medium text-gray-300">
                          Encryption Password
                        </Label>
                        <Input
                          id="password"
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter a strong password (min 8 characters)"
                          className="bg-slate-800/50 border-slate-700 text-white placeholder-gray-500"
                          disabled={loading}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-300">
                          Confirm Password
                        </Label>
                        <Input
                          id="confirmPassword"
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Re-enter your password"
                          className="bg-slate-800/50 border-slate-700 text-white placeholder-gray-500"
                          disabled={loading}
                        />
                      </div>
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <Alert className="bg-red-900/20 border-red-500/50 text-red-200">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="bg-green-900/20 border-green-500/50 text-green-200">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>Wallet imported successfully!</AlertDescription>
            </Alert>
          )}

          {/* Security Warning */}
          <Alert className="bg-yellow-900/20 border-yellow-500/50 text-yellow-200">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Security Notice:</strong> Your private keys will be encrypted with your password and stored securely. 
              Never share your password or private keys with anyone.
            </AlertDescription>
          </Alert>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleImport}
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Import Wallet
                </>
              )}
            </Button>
            
            <Button
              onClick={() => onOpenChange(false)}
              variant="outline"
              disabled={loading}
              className="border-slate-600 text-gray-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
