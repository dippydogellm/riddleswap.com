/**
 * COMPREHENSIVE MULTI-CHAIN AIRDROP TOOL
 * Advanced airdrop functionality for all supported chains
 * Features: Bulk distribution, CSV import, gas optimization, claim mechanics
 */

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  ArrowLeft, 
  Gift, 
  Upload, 
  Download,
  FileText, 
  CheckCircle2, 
  Loader2, 
  AlertCircle, 
  Users, 
  Coins, 
  Wallet,
  Settings,
  Eye,
  Send,
  Database,
  Globe,
  Activity
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';

const airdropSchema = z.object({
  chain: z.string().min(1, 'Please select a blockchain'),
  airdrop_type: z.enum(['token', 'nft', 'native']),
  token_contract: z.string().optional(),
  amount_per_address: z.string().regex(/^\d*\.?\d*$/, 'Invalid amount').optional(),
  recipients: z.string().min(1, 'Recipients list is required'),
  distribution_method: z.enum(['immediate', 'claimable', 'scheduled']),
  claim_enabled: z.boolean().default(true),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  merkle_tree: z.boolean().default(false),
  gas_optimization: z.boolean().default(true)
});

type AirdropFormData = z.infer<typeof airdropSchema>;

const ComprehensiveAirdropTool = () => {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(0);
  const [airdropStatus, setAirdropStatus] = useState<'idle' | 'processing' | 'active' | 'completed' | 'error'>('idle');
  const [airdropResult, setAirdropResult] = useState<any>(null);
  const [recipientCount, setRecipientCount] = useState(0);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [totalAmount, setTotalAmount] = useState('0');
  const [estimatedGas, setEstimatedGas] = useState('0');

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Login Required",
        description: "You need to be logged in to access the Airdrop Tool. Redirecting to login...",
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

  const form = useForm<AirdropFormData>({
    resolver: zodResolver(airdropSchema),
    defaultValues: {
      chain: '',
      airdrop_type: 'token',
      token_contract: '',
      amount_per_address: '',
      recipients: '',
      distribution_method: 'immediate',
      claim_enabled: true,
      start_date: '',
      end_date: '',
      merkle_tree: false,
      gas_optimization: true
    }
  });

  const chains = [
    { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', fee: '~$50-150', walletKey: 'ethAddress', chainId: 1, color: 'bg-blue-500' },
    { id: 'bsc', name: 'Binance Smart Chain', symbol: 'BNB', fee: '~$1-5', walletKey: 'ethAddress', chainId: 56, color: 'bg-yellow-500' },
    { id: 'polygon', name: 'Polygon', symbol: 'MATIC', fee: '~$0.01-1', walletKey: 'ethAddress', chainId: 137, color: 'bg-purple-500' },
    { id: 'base', name: 'Base', symbol: 'ETH', fee: '~$1-10', walletKey: 'ethAddress', chainId: 8453, color: 'bg-blue-600' },
    { id: 'arbitrum', name: 'Arbitrum', symbol: 'ETH', fee: '~$1-5', walletKey: 'ethAddress', chainId: 42161, color: 'bg-cyan-500' },
    { id: 'optimism', name: 'Optimism', symbol: 'ETH', fee: '~$1-5', walletKey: 'ethAddress', chainId: 10, color: 'bg-red-500' },
    { id: 'solana', name: 'Solana', symbol: 'SOL', fee: '~$0.01', walletKey: 'solAddress', chainId: 'solana-mainnet', color: 'bg-green-500' },
    { id: 'xrpl', name: 'XRP Ledger', symbol: 'XRP', fee: '~$0.001', walletKey: 'xrpAddress', chainId: 'xrpl-mainnet', color: 'bg-indigo-500' },
    { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', fee: '~$5-50', walletKey: 'btcAddress', chainId: 'bitcoin-mainnet', color: 'bg-orange-500' }
  ];

  // Get wallet balances
  const { data: walletData } = useQuery({
    queryKey: ['/api/wallet/session-data'],
    enabled: isAuthenticated,
  });

  // Parse CSV file
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      const data = lines.slice(1).map(line => {
        const [address, amount] = line.split(',');
        return { address: address?.trim(), amount: amount?.trim() || '0' };
      }).filter(row => row.address);
      
      setCsvData(data);
      setRecipientCount(data.length);
      setPreviewData(data.slice(0, 10)); // Show first 10 for preview
      
      const total = data.reduce((sum, row) => sum + parseFloat(row.amount || '0'), 0);
      setTotalAmount(total.toString());
      
      toast({
        title: "CSV Uploaded",
        description: `Loaded ${data.length} recipients with total amount: ${total}`,
      });
    };
    reader.readAsText(file);
  };

  // Create airdrop mutation
  const createAirdropMutation = useMutation({
    mutationFn: async (data: AirdropFormData) => {
      const selectedChain = chains.find(c => c.id === data.chain);
      if (!selectedChain) throw new Error('Invalid chain selected');

      const recipients = csvData.length > 0 ? csvData : 
        data.recipients.split('\n').map(line => {
          const [address, amount] = line.split(',');
          return { address: address?.trim(), amount: amount?.trim() || data.amount_per_address };
        }).filter(r => r.address);

      const airdropData = {
        ...data,
        recipients: recipients,
        chain_id: selectedChain.chainId,
        total_amount: totalAmount,
        recipient_count: recipients.length,
        estimated_gas: estimatedGas
      };

      return await apiRequest('/api/devtools/airdrops/comprehensive', {
        method: 'POST',
        body: JSON.stringify(airdropData),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: (data) => {
      setAirdropResult(data);
      setAirdropStatus('completed');
      toast({
        title: "Airdrop Created",
        description: `Successfully created airdrop with ID: ${data.airdrop_id}`,
      });
    },
    onError: (error: any) => {
      setAirdropStatus('error');
      toast({
        title: "Airdrop Failed",
        description: error?.message || 'Failed to create airdrop',
        variant: 'destructive'
      });
    }
  });

  // Preview airdrop
  const previewAirdrop = () => {
    const watchedValues = form.watch();
    const recipients = csvData.length > 0 ? csvData : 
      watchedValues.recipients.split('\n').map(line => {
        const [address, amount] = line.split(',');
        return { address: address?.trim(), amount: amount?.trim() || watchedValues.amount_per_address };
      }).filter(r => r.address);

    setPreviewData(recipients.slice(0, 10));
    setRecipientCount(recipients.length);
    
    const total = recipients.reduce((sum, r) => sum + parseFloat(r.amount || '0'), 0);
    setTotalAmount(total.toString());
    
    // Estimate gas (simplified calculation)
    const baseGas = 21000;
    const perRecipientGas = watchedValues.airdrop_type === 'token' ? 65000 : 
                           watchedValues.airdrop_type === 'nft' ? 85000 : 21000;
    const totalGas = baseGas + (recipients.length * perRecipientGas);
    setEstimatedGas(totalGas.toString());
  };

  const steps = [
    { id: 'setup', title: 'Setup', icon: Settings },
    { id: 'recipients', title: 'Recipients', icon: Users },
    { id: 'preview', title: 'Preview', icon: Eye },
    { id: 'execute', title: 'Execute', icon: Send }
  ];

  const currentStepData = steps[currentStep];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-black py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-6">
            <Link href="/devtools-dashboard">
              <Button variant="outline" size="sm" data-testid="back-to-devtools">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to DevTools
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Comprehensive Airdrop Tool
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                Distribute tokens, NFTs, and native currencies across all supported blockchains
              </p>
            </div>
          </div>

          {/* Step Progress */}
          <div className="flex items-center justify-between mb-8">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                  index <= currentStep 
                    ? 'bg-blue-600 border-blue-600 text-white' 
                    : 'border-gray-300 text-gray-400'
                }`}>
                  {index < currentStep ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <step.icon className="w-5 h-5" />
                  )}
                </div>
                <span className={`ml-2 font-medium ${
                  index <= currentStep ? 'text-blue-600' : 'text-gray-400'
                }`}>
                  {step.title}
                </span>
                {index < steps.length - 1 && (
                  <div className={`w-12 h-0.5 ml-4 ${
                    index < currentStep ? 'bg-blue-600' : 'bg-gray-300'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Supported Chains Overview */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Supported Blockchains
            </CardTitle>
            <CardDescription>
              Multi-chain airdrop support across 9 major blockchains
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-4">
              {chains.map((chain) => (
                <div key={chain.id} className="text-center">
                  <div className={`w-12 h-12 rounded-full ${chain.color} mx-auto mb-2 flex items-center justify-center`}>
                    <span className="text-white font-bold text-xs">
                      {chain.symbol}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-300">{chain.name}</p>
                  <p className="text-xs text-gray-500">{chain.fee}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Main Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <currentStepData.icon className="h-5 w-5" />
              {currentStepData.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => createAirdropMutation.mutate(data))} className="space-y-6">
                
                {/* Step 0: Setup */}
                {currentStep === 0 && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="chain"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Blockchain</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="chain-select">
                                  <SelectValue placeholder="Select blockchain" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {chains.map((chain) => (
                                  <SelectItem key={chain.id} value={chain.id}>
                                    <div className="flex items-center gap-2">
                                      <div className={`w-3 h-3 rounded-full ${chain.color}`} />
                                      <span>{chain.name} ({chain.symbol})</span>
                                      <Badge variant="outline" className="ml-auto">
                                        {chain.fee}
                                      </Badge>
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
                                <SelectTrigger data-testid="airdrop-type-select">
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="token">
                                  <div className="flex items-center gap-2">
                                    <Coins className="w-4 h-4" />
                                    Token Distribution
                                  </div>
                                </SelectItem>
                                <SelectItem value="nft">
                                  <div className="flex items-center gap-2">
                                    <Gift className="w-4 h-4" />
                                    NFT Distribution
                                  </div>
                                </SelectItem>
                                <SelectItem value="native">
                                  <div className="flex items-center gap-2">
                                    <Wallet className="w-4 h-4" />
                                    Native Currency
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {form.watch('airdrop_type') === 'token' && (
                      <FormField
                        control={form.control}
                        name="token_contract"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Token Contract Address</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="0x..." 
                                {...field} 
                                data-testid="token-contract-input"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="distribution_method"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Distribution Method</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="distribution-method-select">
                                  <SelectValue placeholder="Select method" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="immediate">Immediate Distribution</SelectItem>
                                <SelectItem value="claimable">Claimable Airdrop</SelectItem>
                                <SelectItem value="scheduled">Scheduled Release</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="amount_per_address"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Amount per Address (if uniform)</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="0.0" 
                                {...field} 
                                data-testid="amount-per-address-input"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-4">
                        <div className="flex items-center space-x-2">
                          <FormField
                            control={form.control}
                            name="gas_optimization"
                            render={({ field }) => (
                              <FormItem className="flex items-center space-x-2">
                                <FormControl>
                                  <Switch 
                                    checked={field.value} 
                                    onCheckedChange={field.onChange}
                                    data-testid="gas-optimization-switch"
                                  />
                                </FormControl>
                                <FormLabel>Gas Optimization</FormLabel>
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <FormField
                            control={form.control}
                            name="merkle_tree"
                            render={({ field }) => (
                              <FormItem className="flex items-center space-x-2">
                                <FormControl>
                                  <Switch 
                                    checked={field.value} 
                                    onCheckedChange={field.onChange}
                                    data-testid="merkle-tree-switch"
                                  />
                                </FormControl>
                                <FormLabel>Use Merkle Tree (Gas Efficient)</FormLabel>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      <Button 
                        type="button" 
                        onClick={() => setCurrentStep(1)}
                        data-testid="next-to-recipients-button"
                      >
                        Next: Recipients
                      </Button>
                    </div>
                  </div>
                )}

                {/* Step 1: Recipients */}
                {currentStep === 1 && (
                  <div className="space-y-6">
                    <Tabs defaultValue="manual" className="w-full">
                      <TabsList>
                        <TabsTrigger value="manual">Manual Input</TabsTrigger>
                        <TabsTrigger value="csv">CSV Upload</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="manual">
                        <FormField
                          control={form.control}
                          name="recipients"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Recipients (one per line: address,amount)</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="0x123...,10.5&#10;0x456...,5.0"
                                  rows={10}
                                  {...field}
                                  data-testid="recipients-textarea"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </TabsContent>
                      
                      <TabsContent value="csv">
                        <div className="space-y-4">
                          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                            <div className="text-center">
                              <Upload className="mx-auto h-12 w-12 text-gray-400" />
                              <div className="mt-4">
                                <label htmlFor="csv-upload" className="cursor-pointer">
                                  <span className="mt-2 block text-sm font-medium text-gray-900 dark:text-white">
                                    Upload CSV file
                                  </span>
                                  <span className="text-sm text-gray-500">
                                    Format: address,amount (with headers)
                                  </span>
                                  <input
                                    id="csv-upload"
                                    type="file"
                                    accept=".csv"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                    data-testid="csv-upload-input"
                                  />
                                </label>
                              </div>
                            </div>
                          </div>
                          
                          {csvData.length > 0 && (
                            <Alert>
                              <CheckCircle2 className="h-4 w-4" />
                              <AlertTitle>CSV Loaded Successfully</AlertTitle>
                              <AlertDescription>
                                Loaded {csvData.length} recipients with total amount: {totalAmount}
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      </TabsContent>
                    </Tabs>

                    <div className="flex justify-between">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setCurrentStep(0)}
                        data-testid="back-to-setup-button"
                      >
                        Back
                      </Button>
                      <Button 
                        type="button" 
                        onClick={() => {
                          previewAirdrop();
                          setCurrentStep(2);
                        }}
                        data-testid="next-to-preview-button"
                      >
                        Preview Airdrop
                      </Button>
                    </div>
                  </div>
                )}

                {/* Step 2: Preview */}
                {currentStep === 2 && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <Users className="mx-auto h-8 w-8 text-blue-600 mb-2" />
                            <div className="text-2xl font-bold" data-testid="preview-recipient-count">
                              {recipientCount}
                            </div>
                            <p className="text-sm text-gray-500">Recipients</p>
                          </div>
                        </CardContent>
                      </Card>
                      
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <Coins className="mx-auto h-8 w-8 text-green-600 mb-2" />
                            <div className="text-2xl font-bold" data-testid="preview-total-amount">
                              {totalAmount}
                            </div>
                            <p className="text-sm text-gray-500">Total Amount</p>
                          </div>
                        </CardContent>
                      </Card>
                      
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <Activity className="mx-auto h-8 w-8 text-orange-600 mb-2" />
                            <div className="text-2xl font-bold" data-testid="preview-estimated-gas">
                              {estimatedGas}
                            </div>
                            <p className="text-sm text-gray-500">Est. Gas</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Preview Table */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Recipients Preview</CardTitle>
                        <CardDescription>
                          First 10 recipients (showing {previewData.length} of {recipientCount})
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse border border-gray-200 dark:border-gray-700">
                            <thead>
                              <tr className="bg-gray-50 dark:bg-gray-800">
                                <th className="border p-3 text-left">Address</th>
                                <th className="border p-3 text-left">Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {previewData.map((recipient, index) => (
                                <tr key={index} data-testid={`preview-recipient-${index}`}>
                                  <td className="border p-3 font-mono text-sm">
                                    {recipient.address}
                                  </td>
                                  <td className="border p-3">
                                    {recipient.amount}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="flex justify-between">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setCurrentStep(1)}
                        data-testid="back-to-recipients-button"
                      >
                        Back
                      </Button>
                      <Button 
                        type="button" 
                        onClick={() => setCurrentStep(3)}
                        data-testid="next-to-execute-button"
                      >
                        Execute Airdrop
                      </Button>
                    </div>
                  </div>
                )}

                {/* Step 3: Execute */}
                {currentStep === 3 && (
                  <div className="space-y-6">
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Ready to Execute</AlertTitle>
                      <AlertDescription>
                        Review all details before executing the airdrop. This action cannot be undone.
                      </AlertDescription>
                    </Alert>

                    {airdropStatus === 'processing' && (
                      <div className="text-center py-8">
                        <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600 mb-4" />
                        <p className="text-lg font-medium">Creating airdrop...</p>
                        <p className="text-sm text-gray-500">This may take a few moments</p>
                      </div>
                    )}

                    {airdropStatus === 'completed' && airdropResult && (
                      <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700">
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <CheckCircle2 className="mx-auto h-12 w-12 text-green-600 mb-4" />
                            <h3 className="text-lg font-bold text-green-800 dark:text-green-200 mb-2">
                              Airdrop Created Successfully!
                            </h3>
                            <p className="text-sm text-green-600 dark:text-green-300 mb-4">
                              Airdrop ID: {airdropResult.airdrop_id}
                            </p>
                            <div className="space-y-2 text-sm">
                              <p>Recipients: {airdropResult.recipient_count}</p>
                              <p>Total Amount: {airdropResult.total_amount}</p>
                              <p>Status: {airdropResult.status}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {airdropStatus === 'error' && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Airdrop Failed</AlertTitle>
                        <AlertDescription>
                          Please check your inputs and try again.
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="flex justify-between">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setCurrentStep(2)}
                        disabled={airdropStatus === 'processing'}
                        data-testid="back-to-preview-button"
                      >
                        Back
                      </Button>
                      
                      {airdropStatus === 'idle' && (
                        <Button 
                          type="submit"
                          disabled={createAirdropMutation.isPending}
                          onClick={() => setAirdropStatus('processing')}
                          data-testid="execute-airdrop-button"
                        >
                          {createAirdropMutation.isPending ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Creating...
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4 mr-2" />
                              Execute Airdrop
                            </>
                          )}
                        </Button>
                      )}
                      
                      {airdropStatus === 'completed' && (
                        <Button 
                          type="button" 
                          onClick={() => {
                            setCurrentStep(0);
                            setAirdropStatus('idle');
                            setAirdropResult(null);
                            form.reset();
                          }}
                          data-testid="create-new-airdrop-button"
                        >
                          Create New Airdrop
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ComprehensiveAirdropTool;
