import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Gift, Upload, Search, FileText, Database, CheckCircle2, Loader2, AlertCircle, Users, Calendar, Coins, Wallet, Shield } from 'lucide-react';
import { Link, useLocation, useParams } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CSVImport, getAddressValidator } from '@/components/csv-utils';
// Removed CSS import to prevent global conflicts

const airdropSchema = z.object({
  chain: z.string().min(1, 'Please select a blockchain'),
  airdrop_type: z.enum(['token', 'nft', 'native']),
  token_contract: z.string().optional(),
  amount_per_address: z.string().regex(/^\d*\.?\d*$/, 'Invalid amount').optional(),
  recipients: z.string().min(1, 'Recipients list is required'),
  claim_enabled: z.boolean().default(true),
  start_date: z.string().optional(),
  end_date: z.string().optional()
});

type AirdropFormData = z.infer<typeof airdropSchema>;

const AirdropTool = () => {
  const { projectId } = useParams();
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Login Required",
        description: "You need to be logged in to access DevTools. Redirecting to login...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/wallet-login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-400">Loading Airdrop Tool...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(0);
  const [airdropStatus, setAirdropStatus] = useState<'idle' | 'processing' | 'active' | 'error'>('idle');
  const [airdropResult, setAirdropResult] = useState<any>(null);
  const [recipientCount, setRecipientCount] = useState(0);
  const [riddleWalletSession, setRiddleWalletSession] = useState<any>(null);
  const [walletBalances, setWalletBalances] = useState<Record<string, string>>({});

  const form = useForm<AirdropFormData>({
    resolver: zodResolver(airdropSchema),
    defaultValues: {
      chain: '',
      airdrop_type: 'token',
      token_contract: '',
      amount_per_address: '',
      recipients: '',
      claim_enabled: true,
      start_date: '',
      end_date: ''
    }
  });

  const chains = [
    { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', fee: '~$50-150', walletKey: 'ethAddress', chainId: 1 },
    { id: 'bsc', name: 'Binance Smart Chain', symbol: 'BNB', fee: '~$1-5', walletKey: 'ethAddress', chainId: 56 },
    { id: 'polygon', name: 'Polygon', symbol: 'MATIC', fee: '~$0.01-1', walletKey: 'ethAddress', chainId: 137 },
    { id: 'base', name: 'Base', symbol: 'ETH', fee: '~$1-10', walletKey: 'ethAddress', chainId: 8453 },
    { id: 'arbitrum', name: 'Arbitrum', symbol: 'ETH', fee: '~$1-5', walletKey: 'ethAddress', chainId: 42161 },
    { id: 'optimism', name: 'Optimism', symbol: 'ETH', fee: '~$1-5', walletKey: 'ethAddress', chainId: 10 },
    { id: 'solana', name: 'Solana', symbol: 'SOL', fee: '~$0.01', walletKey: 'solAddress', chainId: 'solana-mainnet' },
    { id: 'xrpl', name: 'XRP Ledger', symbol: 'XRP', fee: '~$0.001', walletKey: 'xrpAddress', chainId: 'xrpl-mainnet' },
    { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', fee: '~$5-50', walletKey: 'btcAddress', chainId: 'bitcoin-mainnet' }
  ];

  // Check for wallet data (for getting addresses for airdrop operations)
  useEffect(() => {
    const walletData = localStorage.getItem('riddleWallet');
    if (walletData) {
      try {
        const wallet = JSON.parse(walletData);
        setRiddleWalletSession(wallet);
      } catch (error) {
        console.error('Failed to parse wallet data:', error);
      }
    }
  }, []);

  const createAirdropMutation = useMutation({
    mutationFn: async (data: AirdropFormData) => {
      if (!riddleWalletSession) {
        throw new Error('No active session');
      }

      // Get the appropriate wallet address based on the selected chain
      const selectedChain = chains.find(c => c.id === data.chain);
      const walletAddress = riddleWalletSession[selectedChain?.walletKey || 'ethAddress'];

      const response = await fetch('/api/devtools/airdrops', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${riddleWalletSession.sessionToken}`
        },
        body: JSON.stringify({
          ...data,
          creator_address: walletAddress,
          riddle_wallet_handle: riddleWalletSession.handle
        })
      });
      if (!response.ok) throw new Error('Failed to create airdrop');
      return response.json();
    },
    onSuccess: (result) => {
      setAirdropStatus('active');
      setAirdropResult(result);
      toast({
        title: 'Airdrop Created',
        description: `Successfully created airdrop for ${recipientCount} recipients.`,
      });
    },
    onError: (error) => {
      setAirdropStatus('error');
      toast({
        title: 'Airdrop Failed',
        description: error.message || 'Failed to create airdrop. Please try again.',
        variant: 'destructive'
      });
    }
  });

  const onSubmit = (data: AirdropFormData) => {
    setAirdropStatus('processing');
    
    // Parse recipients
    const addresses = data.recipients.split('\n').filter(addr => addr.trim().length > 0);
    setRecipientCount(addresses.length);
    
    // Keep recipients as string for the API, but also include processed recipients
    const processedData = {
      ...data,
      recipients: data.recipients, // Keep as string as expected by schema
    };
    
    createAirdropMutation.mutate(processedData);
  };

  const steps = [
    {
      title: 'Airdrop Type',
      description: 'Choose what to distribute'
    },
    {
      title: 'Recipients',
      description: 'Upload or enter recipient addresses'
    },
    {
      title: 'Settings',
      description: 'Configure timing and claiming'
    },
    {
      title: 'Launch',
      description: 'Review and launch your airdrop'
    }
  ];

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="airdrop-form-step">
            <FormField
              control={form.control}
              name="chain"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Blockchain</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select blockchain" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {chains.map((chain) => (
                        <SelectItem key={chain.id} value={chain.id}>
                          <div className="chain-option">
                            <span>{chain.name}</span>
                            <Badge variant="secondary">{chain.fee}</Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="airdrop_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Airdrop Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select airdrop type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="token">
                        <div className="type-option">
                          <Coins className="w-4 h-4" />
                          <span>Token Airdrop</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="nft">
                        <div className="type-option">
                          <Gift className="w-4 h-4" />
                          <span>NFT Airdrop</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="native">
                        <div className="type-option">
                          <Database className="w-4 h-4" />
                          <span>Native Token (ETH/BNB/MATIC)</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.watch('airdrop_type') === 'token' && (
              <FormField
                control={form.control}
                name="token_contract"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Token Contract Address</FormLabel>
                    <FormControl>
                      <div className="input-with-icon">
                        <Search className="w-4 h-4 input-icon" />
                        <Input placeholder="0x..." {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="amount_per_address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Amount per Address 
                    {form.watch('airdrop_type') === 'nft' ? ' (Token IDs)' : ''}
                  </FormLabel>
                  <FormControl>
                    <div className="input-with-icon">
                      <Coins className="w-4 h-4 input-icon" />
                      <Input 
                        placeholder={form.watch('airdrop_type') === 'nft' ? "1,2,3" : "100"} 
                        {...field} 
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-muted-foreground mt-1">
                    {form.watch('airdrop_type') === 'nft' 
                      ? 'Enter token IDs separated by commas' 
                      : 'Amount each recipient will receive'
                    }
                  </p>
                </FormItem>
              )}
            />
          </div>
        );

      case 1:
        return (
          <div className="airdrop-form-step">
            <FormField
              control={form.control}
              name="recipients"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recipient Addresses</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="0x1234...\n0x5678...\n0x9abc..."
                      className="recipients-textarea"
                      rows={12}
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        const addresses = e.target.value.split('\n').filter(addr => addr.trim().length > 0);
                        setRecipientCount(addresses.length);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                  <div className="recipients-info">
                    <Badge variant="outline">{recipientCount} addresses</Badge>
                    <p className="text-xs text-muted-foreground">
                      Enter one address per line
                    </p>
                  </div>
                </FormItem>
              )}
            />

            <Card className="upload-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Upload className="w-4 h-4" />
                  Bulk Upload
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!form.watch('chain') && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Please select a blockchain first to enable CSV import
                    </AlertDescription>
                  </Alert>
                )}
                {form.watch('chain') && (
                  <CSVImport
                    onImport={(addresses) => {
                      const currentRecipients = form.getValues('recipients');
                      const newRecipients = addresses.join('\n');
                      const combined = currentRecipients 
                        ? `${currentRecipients}\n${newRecipients}` 
                        : newRecipients;
                      form.setValue('recipients', combined);
                      setRecipientCount(combined.split('\n').filter(addr => addr.trim().length > 0).length);
                      toast({
                        title: 'CSV Imported',
                        description: `Successfully imported ${addresses.length} addresses`,
                      });
                    }}
                    validateAddress={getAddressValidator(form.watch('chain'))}
                    placeholder="Import from CSV"
                    acceptedFormat="CSV file with one address per line or comma-separated"
                  />
                )}
              </CardContent>
            </Card>
          </div>
        );

      case 2:
        return (
          <div className="airdrop-form-step">
            <Card className="settings-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Timing Settings
                </CardTitle>
                <CardDescription>
                  Configure when the airdrop becomes available
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="form-row">
                  <FormField
                    control={form.control}
                    name="start_date"
                    render={({ field }) => (
                      <FormItem className="form-item-flex">
                        <FormLabel>Start Date (Optional)</FormLabel>
                        <FormControl>
                          <Input 
                            type="datetime-local"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="end_date"
                    render={({ field }) => (
                      <FormItem className="form-item-flex">
                        <FormLabel>End Date (Optional)</FormLabel>
                        <FormControl>
                          <Input 
                            type="datetime-local"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="claim-settings">
              <CardHeader>
                <CardTitle>Claim Mechanism</CardTitle>
                <CardDescription>
                  Configure how recipients can claim their airdrop
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="claim_enabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-3">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div>
                        <FormLabel className="text-sm font-normal">
                          Enable claim-based distribution
                        </FormLabel>
                        <p className="text-xs text-muted-foreground">
                          Recipients must visit a claim page to receive tokens
                        </p>
                      </div>
                    </FormItem>
                  )}
                />

                <div className="claim-features">
                  <div className="feature-item">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Merkle tree verification</span>
                  </div>
                  <div className="feature-item">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Gas-efficient claiming</span>
                  </div>
                  <div className="feature-item">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Anti-sybil protection</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 3:
        const formData = form.getValues();
        const selectedChain = chains.find(c => c.id === formData.chain);
        
        return (
          <div className="airdrop-form-step review-step">
            <Card className="review-card">
              <CardHeader>
                <CardTitle>Airdrop Summary</CardTitle>
                <CardDescription>
                  Review your airdrop configuration before launching
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="review-grid">
                  <div className="review-item">
                    <span className="review-label">Blockchain:</span>
                    <span className="review-value">{selectedChain?.name}</span>
                  </div>
                  <div className="review-item">
                    <span className="review-label">Type:</span>
                    <span className="review-value capitalize">{formData.airdrop_type}</span>
                  </div>
                  <div className="review-item">
                    <span className="review-label">Recipients:</span>
                    <span className="review-value">{recipientCount} addresses</span>
                  </div>
                  <div className="review-item">
                    <span className="review-label">Amount per Address:</span>
                    <span className="review-value">{formData.amount_per_address || 'N/A'}</span>
                  </div>
                  <div className="review-item">
                    <span className="review-label">Total Distribution:</span>
                    <span className="review-value">
                      {recipientCount * (parseFloat(formData.amount_per_address || '0') || 1)}
                    </span>
                  </div>
                  <div className="review-item">
                    <span className="review-label">Claim Enabled:</span>
                    <span className="review-value">{formData.claim_enabled ? 'Yes' : 'No'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="launch-info">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Launch Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="launch-details">
                  <div className="launch-item">
                    <span>Estimated Gas:</span>
                    <span>{selectedChain?.fee}</span>
                  </div>
                  <div className="launch-item">
                    <span>Setup Time:</span>
                    <span>~5-10 minutes</span>
                  </div>
                  <div className="launch-item">
                    <span>Claim Contract:</span>
                    <span>Auto-deployed</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Link href={`/devtools/project/${projectId}`} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Project Dashboard
          </Link>
          
          <div className="flex items-center gap-4">
            <div className="bg-muted rounded-2xl p-4">
              <Gift className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Airdrop Tool</h1>
              <p className="text-lg text-muted-foreground">Distribute tokens and NFTs to multiple addresses with claim mechanics</p>
            </div>
          </div>
        </div>
      </div>

      {/* Wallet Info Card */}
      {riddleWalletSession && (
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Riddle Wallet Connected
              </CardTitle>
              <CardDescription>
                @{riddleWalletSession.handle} - Funding airdrops from your Riddle wallet
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {riddleWalletSession.ethAddress && (
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <span className="font-semibold text-muted-foreground min-w-[80px] text-sm">ETH/EVM:</span>
                    <code className="font-mono text-sm bg-background px-2 py-1 rounded border">{riddleWalletSession.ethAddress.slice(0, 6)}...{riddleWalletSession.ethAddress.slice(-4)}</code>
                  </div>
                )}
                {riddleWalletSession.xrpAddress && (
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <span className="font-semibold text-muted-foreground min-w-[80px] text-sm">XRP:</span>
                    <code className="font-mono text-sm bg-background px-2 py-1 rounded border">{riddleWalletSession.xrpAddress.slice(0, 6)}...{riddleWalletSession.xrpAddress.slice(-4)}</code>
                  </div>
                )}
                {riddleWalletSession.solAddress && (
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <span className="font-semibold text-muted-foreground min-w-[80px] text-sm">Solana:</span>
                    <code className="font-mono text-sm bg-background px-2 py-1 rounded border">{riddleWalletSession.solAddress.slice(0, 6)}...{riddleWalletSession.solAddress.slice(-4)}</code>
                  </div>
                )}
              </div>
              <Alert className="mt-4">
                <Wallet className="h-4 w-4" />
                <AlertTitle>Important</AlertTitle>
                <AlertDescription>
                  Ensure your selected chain wallet has sufficient funds to cover airdrop amounts and gas fees.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Progress Steps */}
      <div className="bg-muted py-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {steps.map((step, index) => (
              <div
                key={index}
                className={`flex items-center gap-4 p-5 bg-card border rounded-2xl transition-all ${
                  index === currentStep ? 'border-primary bg-primary/10' : index < currentStep ? 'border-green-500 bg-green-500/10' : 'border-border opacity-60'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                  index < currentStep ? 'bg-green-500 text-white' : index === currentStep ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {index < currentStep ? <CheckCircle2 className="w-4 h-4" /> : index + 1}
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{step.title}</div>
                  <div className="text-sm text-muted-foreground">{step.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="py-10">
        <div className="max-w-4xl mx-auto px-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <Card className="p-8">
                {renderStepContent()}
              </Card>
              
              {/* Navigation Buttons */}
              <div className="form-navigation">
                {currentStep > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentStep(currentStep - 1)}
                    disabled={airdropStatus === 'processing'}
                  >
                    Previous
                  </Button>
                )}
                
                {currentStep < steps.length - 1 ? (
                  <Button
                    type="button"
                    onClick={async () => {

                      // Validate current step before proceeding
                      let isValid = true;
                      
                      if (currentStep === 0) {
                        // Step 1: Check chain and airdrop type
                        const chain = form.getValues('chain');
                        const airdropType = form.getValues('airdrop_type');
                        if (!chain) {
                          form.setError('chain', { message: 'Please select a blockchain' });
                          isValid = false;
                        }
                        if (!airdropType) {
                          form.setError('airdrop_type', { message: 'Please select airdrop type' });
                          isValid = false;
                        }
                      } else if (currentStep === 1) {
                        // Step 2: Check recipients
                        const recipients = form.getValues('recipients');
                        if (!recipients || recipients.trim().length === 0) {
                          form.setError('recipients', { message: 'Please enter recipient addresses' });
                          isValid = false;
                        }
                      }
                      
                      if (isValid) {
                        setCurrentStep(currentStep + 1);
                      } else {
                        toast({
                          title: "Validation Error",
                          description: "Please complete the required fields for this step.",
                          variant: "destructive"
                        });
                      }
                    }}
                    className="ml-auto"
                  >
                    Next
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={airdropStatus === 'processing'}
                    className="ml-auto launch-button"
                  >
                    {airdropStatus === 'processing' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Launching...
                      </>
                    ) : (
                      <>
                        <Gift className="w-4 h-4 mr-2" />
                        Launch Airdrop
                      </>
                    )}
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
};

export default AirdropTool;
