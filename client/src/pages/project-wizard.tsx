import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Link, useLocation, useRoute } from 'wouter';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, ArrowLeft, Sparkles, Package, Settings, Crown, Rocket, Wallet, AlertCircle, Clock, Image, Coins, Check } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Form schemas
const projectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100),
  description: z.string().optional(),
  assetType: z.enum(['nft', 'token'], { required_error: 'Please select asset type' }),
  projectType: z.enum(['new', 'existing', 'launchpad']),
  selectedChains: z.array(z.string()).min(1, 'Select at least one blockchain'),
  contractAddresses: z.record(z.string(), z.array(z.string())).optional(),
});

type ProjectFormData = z.infer<typeof projectSchema>;

interface ChainTemplate {
  chainId: string;
  name: string;
  networkType: string;
  rpcEndpoints: string[];
  contractFields: string[];
}

export default function ProjectWizard() {
  const [location, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);
  const [contractAddresses, setContractAddresses] = useState<Record<string, string[]>>({});
  const [showLaunchpadPayment, setShowLaunchpadPayment] = useState(false);
  const [selectedPaymentChain, setSelectedPaymentChain] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'confirming' | 'completed'>('pending');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Parse assetType from URL query parameter
  const assetTypeFromUrl = useMemo(() => {
    const searchParams = new URLSearchParams(location.split('?')[1] ?? '');
    const type = searchParams.get('type');
    return type === 'nft' || type === 'token' ? type : 'nft'; // Default to 'nft'
  }, [location]);

  // Store assetType in component state for later use
  const [assetType, setAssetType] = useState<'nft' | 'token'>(assetTypeFromUrl);

  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: '',
      description: '',
      assetType: assetTypeFromUrl,
      projectType: 'new',
      selectedChains: [],
      contractAddresses: {},
    },
  });

  // Update form when URL changes
  useEffect(() => {
    form.setValue('assetType', assetTypeFromUrl);
    setAssetType(assetTypeFromUrl);
  }, [assetTypeFromUrl, form]);

  // Fetch chain templates
  const { data: chainTemplates = [], isLoading: templatesLoading } = useQuery<ChainTemplate[]>({
    queryKey: ['/api/devtools/chains/templates'],
  });

  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: async (data: ProjectFormData) => {
      const chainConfigurations = data.selectedChains.map(chainId => {
        const template = chainTemplates.find((t: ChainTemplate) => t.chainId === chainId);
        return {
          chainId,
          networkType: template?.networkType || 'mainnet',
          rpcEndpoints: template?.rpcEndpoints || [],
          contractAddresses: contractAddresses[chainId] || [],
          monitoringEnabled: true,
          alertsEnabled: true,
        };
      });

      // Map camelCase to snake_case for backend schema compatibility
      const { assetType, ...restData } = data;
      
      return apiRequest('/api/devtools/projects', {
        method: 'POST',
        body: JSON.stringify({
          ...restData,
          asset_type: assetType, // Map to snake_case for database
          contractAddresses,
          chainConfigurations,
        }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: async (response) => {
      const project = await response.json();
      toast({
        title: 'Project Created',
        description: `Your ${assetType.toUpperCase()} project has been created successfully`,
      });
      setCreatedProjectId(project.id);
      // Navigate directly to project dashboard
      setLocation(`/devtools/project-dashboard/${project.id}`);
      queryClient.invalidateQueries({ queryKey: ['/api/devtools/projects'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Creation Failed',
        description: error.message || 'Failed to create project',
        variant: 'destructive',
      });
    },
  });

  const selectedChains = form.watch('selectedChains');
  const projectType = form.watch('projectType');

  const addContractAddress = (chainId: string, address: string) => {
    if (!address.trim()) return;
    
    setContractAddresses(prev => ({
      ...prev,
      [chainId]: [...(prev[chainId] || []), address.trim()]
    }));
  };

  const removeContractAddress = (chainId: string, index: number) => {
    setContractAddresses(prev => ({
      ...prev,
      [chainId]: prev[chainId]?.filter((_, i) => i !== index) || []
    }));
  };

  const onSubmit = (data: ProjectFormData) => {
    data.contractAddresses = contractAddresses;
    createProjectMutation.mutate(data);
  };

  const getSelectedChainTemplates = () => {
    return chainTemplates.filter((template: ChainTemplate) => 
      selectedChains.includes(template.chainId)
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/devtools">
              <Button variant="ghost" size="sm" className="text-slate-600 dark:text-slate-400">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to DevTools
              </Button>
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Create DevTools Project
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Set up blockchain development tools for your project
          </p>
        </div>

        {/* Subscription Plans Quick Access */}
        <Card className="mb-8 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
                  <Crown className="w-5 h-5 text-blue-600" />
                  Upgrade to Premium DevTools
                </h3>
                <p className="text-slate-600 dark:text-slate-400">
                  Get unlimited projects, advanced monitoring, and priority support with cryptocurrency payments
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right text-sm">
                  <div className="text-slate-900 dark:text-white font-medium">Bronze: $199.99/mo</div>
                  <div className="text-slate-900 dark:text-white font-medium">Gold: $499.99/mo</div>
                </div>
                <Link href="/devtools/subscription-plans">
                  <Button variant="outline" className="flex items-center gap-2">
                    View Plans
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Progress indicator */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step >= 1 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
            }`}>
              1
            </div>
            <div className={`w-16 h-1 ${step >= 2 ? 'bg-blue-600' : 'bg-slate-200'}`} />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step >= 2 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
            }`}>
              2
            </div>
            <div className={`w-16 h-1 ${step >= 3 ? 'bg-blue-600' : 'bg-slate-200'}`} />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step >= 3 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
            }`}>
              3
            </div>
            <div className={`w-16 h-1 ${step >= 4 ? 'bg-blue-600' : 'bg-slate-200'}`} />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step >= 4 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
            }`}>
              4
            </div>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-2xl mx-auto">
            {/* Step 1: Project Information */}
            {step === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Project Information
                  </CardTitle>
                  <CardDescription>
                    Tell us about your blockchain project
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Name</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="My DeFi Project" 
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Brief description of your project..."
                            className="min-h-[100px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="projectType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select project type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="new">
                              <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4" />
                                New Project
                              </div>
                            </SelectItem>
                            <SelectItem value="existing">
                              <div className="flex items-center gap-2">
                                <Package className="w-4 h-4" />
                                Import Existing Project
                              </div>
                            </SelectItem>
                            <SelectItem value="launchpad">
                              <div className="flex items-center gap-2">
                                <Rocket className="w-4 h-4" />
                                Launch via RiddlePad ($50 USD)
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {form.watch('projectType') === 'launchpad' && (
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                      <div className="flex items-start gap-3">
                        <Rocket className="w-5 h-5 text-yellow-600 mt-0.5" />
                        <div className="space-y-2">
                          <h4 className="font-semibold text-yellow-900 dark:text-yellow-100">RiddlePad Launchpad</h4>
                          <p className="text-sm text-yellow-800 dark:text-yellow-200">
                            Launch your project through RiddlePad with:
                          </p>
                          <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1 ml-4 list-disc">
                            <li>$50 USD launch fee (paid in native tokens)</li>
                            <li>Manual verification by RiddleSwap team</li>
                            <li>Community liquidity pool participation</li>
                            <li>Token allocation for early supporters</li>
                            <li>Graduation to full project after funding target</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button 
                      type="button" 
                      onClick={() => {
                        if (form.watch('projectType') === 'launchpad') {
                          setShowLaunchpadPayment(true);
                        } else {
                          setStep(2);
                        }
                      }}
                      disabled={!form.watch('name')}
                    >
                      {form.watch('projectType') === 'launchpad' ? 'Proceed to Payment' : 'Continue'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Launchpad Payment Interface */}
            {showLaunchpadPayment && step === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="w-5 h-5" />
                    RiddlePad Launch Payment
                  </CardTitle>
                  <CardDescription>
                    Pay $50 USD launch fee in your preferred native token
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Select your payment chain and complete the transaction to submit your project for manual verification.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-4">
                    <FormLabel>Select Payment Method</FormLabel>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {[
                        { chain: 'XRP', amount: '100 XRP', symbol: 'XRP' },
                        { chain: 'Ethereum', amount: '0.02 ETH', symbol: 'ETH' },
                        { chain: 'Solana', amount: '0.5 SOL', symbol: 'SOL' },
                        { chain: 'Bitcoin', amount: '0.001 BTC', symbol: 'BTC' },
                        { chain: 'BNB Chain', amount: '0.2 BNB', symbol: 'BNB' },
                        { chain: 'Polygon', amount: '50 MATIC', symbol: 'MATIC' }
                      ].map((option) => (
                        <div
                          key={option.chain}
                          onClick={() => setSelectedPaymentChain(option.chain)}
                          className={`p-4 border rounded-lg cursor-pointer transition-all ${
                            selectedPaymentChain === option.chain
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                              : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium">{option.chain}</p>
                              <p className="text-sm text-slate-600 dark:text-slate-400">
                                {option.amount}
                              </p>
                            </div>
                            <Badge variant="outline">{option.symbol}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {selectedPaymentChain && (
                    <div className="space-y-4">
                      <Separator />
                      <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                        <h4 className="font-medium mb-2">Payment Details</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-600 dark:text-slate-400">Amount:</span>
                            <span className="font-mono">$50.00 USD</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600 dark:text-slate-400">To Wallet:</span>
                            <span className="font-mono text-xs">
                              {selectedPaymentChain === 'XRP' ? 'rRiddlePad...' : '0x742d35...'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600 dark:text-slate-400">Status:</span>
                            <Badge variant={paymentStatus === 'completed' ? 'default' : 'secondary'}>
                              {paymentStatus === 'pending' && 'Awaiting Payment'}
                              {paymentStatus === 'confirming' && 'Confirming...'}
                              {paymentStatus === 'completed' && 'Payment Received'}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {paymentStatus === 'pending' && (
                        <Button 
                          className="w-full" 
                          onClick={() => {
                            setPaymentStatus('confirming');
                            // Simulate payment confirmation
                            setTimeout(() => {
                              setPaymentStatus('completed');
                              toast({
                                title: 'Payment Confirmed',
                                description: 'Your project has been submitted for verification',
                              });
                              // Create project with launchpad status
                              setShowLaunchpadPayment(false);
                              setStep(2);
                            }, 3000);
                          }}
                        >
                          <Wallet className="w-4 h-4 mr-2" />
                          Complete Payment
                        </Button>
                      )}

                      {paymentStatus === 'confirming' && (
                        <Button disabled className="w-full">
                          <Clock className="w-4 h-4 mr-2 animate-spin" />
                          Confirming Transaction...
                        </Button>
                      )}

                      {paymentStatus === 'completed' && (
                        <Alert className="border-green-200 bg-green-50 dark:bg-green-950">
                          <Check className="h-4 w-4 text-green-600" />
                          <AlertDescription className="text-green-800 dark:text-green-200">
                            Payment received! Your project will be reviewed within 24 hours.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  )}

                  <div className="flex justify-between">
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => {
                        setShowLaunchpadPayment(false);
                        setPaymentStatus('pending');
                        setSelectedPaymentChain('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 2: Chain Selection */}
            {step === 2 && !showLaunchpadPayment && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    Blockchain Selection
                  </CardTitle>
                  <CardDescription>
                    Choose the blockchains your project will use
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {templatesLoading ? (
                    <div className="text-center py-4">
                      <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" />
                      <p className="text-sm text-slate-600 mt-2">Loading blockchain options...</p>
                    </div>
                  ) : (
                    <FormField
                      control={form.control}
                      name="selectedChains"
                      render={() => (
                        <FormItem>
                          <FormLabel>Supported Blockchains</FormLabel>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {chainTemplates.map((chain: ChainTemplate) => (
                              <FormField
                                key={chain.chainId}
                                control={form.control}
                                name="selectedChains"
                                render={({ field }) => (
                                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value?.includes(chain.chainId)}
                                        onCheckedChange={(checked) => {
                                          return checked
                                            ? field.onChange([...field.value, chain.chainId])
                                            : field.onChange(
                                                field.value?.filter((value) => value !== chain.chainId)
                                              );
                                        }}
                                      />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                      <FormLabel className="font-medium">
                                        {chain.name}
                                      </FormLabel>
                                      <Badge variant="secondary" className="text-xs">
                                        {chain.networkType}
                                      </Badge>
                                    </div>
                                  </FormItem>
                                )}
                              />
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <div className="flex justify-between">
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => setStep(1)}
                    >
                      Back
                    </Button>
                    <Button 
                      type="button" 
                      onClick={() => setStep(3)}
                      disabled={selectedChains.length === 0}
                    >
                      Continue
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 3: Contract Addresses */}
            {step === 3 && !showLaunchpadPayment && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    Contract Addresses
                  </CardTitle>
                  <CardDescription>
                    {projectType === 'existing' 
                      ? 'Add your existing contract addresses for monitoring and integration'
                      : 'Add contract addresses as you deploy them (you can skip this step for new projects)'
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {getSelectedChainTemplates().map((chain: ChainTemplate) => (
                    <div key={chain.chainId} className="space-y-4">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-slate-900 dark:text-white">
                          {chain.name}
                        </h4>
                        <Badge variant="outline">{chain.networkType}</Badge>
                      </div>
                      
                      <div className="space-y-3">
                        {chain.contractFields.map((fieldName, fieldIndex) => (
                          <div key={fieldIndex} className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                              {fieldName}
                            </label>
                            <div className="flex gap-2">
                              <Input
                                placeholder={`Enter ${fieldName.toLowerCase()}...`}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const input = e.target as HTMLInputElement;
                                    addContractAddress(chain.chainId, input.value);
                                    input.value = '';
                                  }
                                }}
                              />
                              <Button
                                type="button"
                                size="sm"
                                onClick={(e) => {
                                  const input = (e.target as HTMLElement).parentElement?.querySelector('input') as HTMLInputElement;
                                  if (input) {
                                    addContractAddress(chain.chainId, input.value);
                                    input.value = '';
                                  }
                                }}
                              >
                                <Plus className="w-4 h-4" />
                              </Button>
                            </div>
                            
                            {/* Display added addresses */}
                            {contractAddresses[chain.chainId]?.length > 0 && (
                              <div className="space-y-2">
                                {contractAddresses[chain.chainId].map((address, index) => (
                                  <div key={index} className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2">
                                    <span className="text-sm font-mono text-slate-700 dark:text-slate-300">
                                      {address}
                                    </span>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => removeContractAddress(chain.chainId, index)}
                                    >
                                      <Trash2 className="w-4 h-4 text-red-500" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      
                      {chain !== getSelectedChainTemplates()[getSelectedChainTemplates().length - 1] && (
                        <Separator className="my-4" />
                      )}
                    </div>
                  ))}

                  <div className="flex justify-between pt-6">
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => setStep(2)}
                    >
                      Back
                    </Button>
                    <Button 
                      type="submit"
                      disabled={createProjectMutation.isPending}
                    >
                      {createProjectMutation.isPending ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                          Creating Project...
                        </div>
                      ) : (
                        'Create Project'
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 4: Choose Subscription Plan */}
            {step === 4 && !showLaunchpadPayment && (
              <Card>
                <CardHeader>
                  <CardTitle>Choose Subscription Plan</CardTitle>
                  <CardDescription>
                    Select a plan for your new project to unlock premium DevTools features
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Free Plan */}
                    <Card className="relative border-2">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                            <span className="text-sm font-bold">F</span>
                          </div>
                          Free Plan
                        </CardTitle>
                        <CardDescription>
                          Start with basic features
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold mb-4">$0/month</div>
                        <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                          <li>• Basic project monitoring</li>
                          <li>• 1 project limit</li>
                          <li>• Community support</li>
                        </ul>
                        <Button 
                          className="w-full mt-6" 
                          variant="outline"
                          onClick={() => {
                            toast({
                              title: 'Project Setup Complete',
                              description: 'Your free project is ready to use!',
                            });
                            window.location.href = '/devtools';
                          }}
                        >
                          Continue with Free
                        </Button>
                      </CardContent>
                    </Card>

                    {/* Bronze Plan */}
                    <Card className="relative border-2 border-orange-200 dark:border-orange-800">
                      <div className="absolute top-4 right-4">
                        <Badge className="bg-orange-500 text-white">Popular</Badge>
                      </div>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center">
                            <span className="text-sm font-bold text-orange-600">B</span>
                          </div>
                          Bronze Plan
                        </CardTitle>
                        <CardDescription>
                          Enhanced monitoring and analytics
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold mb-4">$199.99/month</div>
                        <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                          <li>• Advanced project analytics</li>
                          <li>• Up to 5 projects</li>
                          <li>• Real-time monitoring</li>
                          <li>• Priority support</li>
                        </ul>
                        <Button 
                          className="w-full mt-6 bg-orange-500 hover:bg-orange-600" 
                          onClick={() => setLocation(`/devtools/subscription-plans?project=${createdProjectId}&plan=bronze`)}
                        >
                          Pay with Crypto
                        </Button>
                      </CardContent>
                    </Card>

                    {/* Gold Plan */}
                    <Card className="relative border-2 border-yellow-200 dark:border-yellow-800 md:col-span-2">
                      <div className="absolute top-4 right-4">
                        <Badge className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-white">
                          <Crown className="w-3 h-3 mr-1" />
                          Premium
                        </Badge>
                      </div>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-lg flex items-center justify-center">
                            <Crown className="w-4 h-4 text-white" />
                          </div>
                          Gold Plan
                        </CardTitle>
                        <CardDescription>
                          Full enterprise features and unlimited access
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold mb-4">$499.99/month</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                            <li>• Unlimited projects</li>
                            <li>• Advanced AI analytics</li>
                            <li>• Custom integrations</li>
                            <li>• 24/7 premium support</li>
                          </ul>
                          <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                            <li>• White-label options</li>
                            <li>• API access & webhooks</li>
                            <li>• Multi-team collaboration</li>
                            <li>• Custom deployment options</li>
                          </ul>
                        </div>
                        <Button 
                          className="w-full mt-6 bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700" 
                          onClick={() => setLocation(`/devtools/subscription-plans?project=${createdProjectId}&plan=gold`)}
                        >
                          <Crown className="w-4 h-4 mr-2" />
                          Pay with Crypto
                        </Button>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="flex justify-center pt-6">
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => setStep(3)}
                    >
                      Back to Configuration
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </form>
        </Form>
      </div>
    </div>
  );
}
