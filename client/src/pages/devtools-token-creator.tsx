import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Coins, Settings, Globe, Twitter, Send, Upload, Zap, Shield, Star, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Link, useParams } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import '../styles/devtools-token-creator.css';

const tokenSchema = z.object({
  chain: z.string().min(1, 'Please select a blockchain'),
  name: z.string().min(1, 'Token name is required').max(50, 'Name too long'),
  symbol: z.string().min(1, 'Symbol is required').max(10, 'Symbol too long').regex(/^[A-Z0-9]+$/, 'Only uppercase letters and numbers'),
  decimals: z.number().min(0).max(18),
  total_supply: z.string().min(1, 'Total supply is required').regex(/^\d+$/, 'Must be a valid number'),
  description: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  telegram: z.string().optional(),
  twitter: z.string().optional(),
  logo_url: z.string().url().optional().or(z.literal('')),
  is_mintable: z.boolean().default(false),
  is_burnable: z.boolean().default(false),
  tax_buy: z.string().regex(/^\d*\.?\d*$/, 'Invalid percentage').optional(),
  tax_sell: z.string().regex(/^\d*\.?\d*$/, 'Invalid percentage').optional()
});

type TokenFormData = z.infer<typeof tokenSchema>;

const TokenCreator = () => {
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
              <p className="text-slate-600 dark:text-slate-400">Loading Token Creator...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
  const [currentStep, setCurrentStep] = useState(0);
  const [deploymentStatus, setDeploymentStatus] = useState<'idle' | 'deploying' | 'success' | 'error'>('idle');

  const form = useForm<TokenFormData>({
    resolver: zodResolver(tokenSchema),
    defaultValues: {
      chain: '',
      name: '',
      symbol: '',
      decimals: 18,
      total_supply: '',
      description: '',
      website: '',
      telegram: '',
      twitter: '',
      logo_url: '',
      is_mintable: false,
      is_burnable: false,
      tax_buy: '0',
      tax_sell: '0'
    }
  });

  const chains = [
    { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', fee: '~$50-150' },
    { id: 'bsc', name: 'Binance Smart Chain', symbol: 'BNB', fee: '~$1-5' },
    { id: 'polygon', name: 'Polygon', symbol: 'MATIC', fee: '~$0.01-1' },
    { id: 'base', name: 'Base', symbol: 'ETH', fee: '~$1-10' },
    { id: 'arbitrum', name: 'Arbitrum', symbol: 'ETH', fee: '~$1-5' },
    { id: 'solana', name: 'Solana', symbol: 'SOL', fee: '~$0.01' }
  ];

  const deployTokenMutation = useMutation({
    mutationFn: async (data: TokenFormData) => {
      const response = await fetch('/api/devtools/tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to deploy token');
      return response.json();
    },
    onSuccess: (result) => {
      setDeploymentStatus('success');
      toast({
        title: 'Token Deployment Initiated',
        description: 'Your token is being deployed to the blockchain. You will receive an update soon.',
      });
    },
    onError: (error) => {
      setDeploymentStatus('error');
      toast({
        title: 'Deployment Failed',
        description: error.message || 'Failed to deploy token. Please try again.',
        variant: 'destructive'
      });
    }
  });

  const onSubmit = (data: TokenFormData) => {
    setDeploymentStatus('deploying');
    deployTokenMutation.mutate(data);
  };

  const steps = [
    {
      title: 'Basic Information',
      description: 'Define your token fundamentals'
    },
    {
      title: 'Advanced Features',
      description: 'Configure special token mechanics'
    },
    {
      title: 'Social & Branding',
      description: 'Add website and social links'
    },
    {
      title: 'Review & Deploy',
      description: 'Review and deploy your token'
    }
  ];

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="token-form-step">
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

            <div className="form-row">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="form-item-flex">
                    <FormLabel>Token Name</FormLabel>
                    <FormControl>
                      <Input placeholder="My Awesome Token" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="symbol"
                render={({ field }) => (
                  <FormItem className="form-item-flex">
                    <FormLabel>Symbol</FormLabel>
                    <FormControl>
                      <Input placeholder="MAT" {...field} style={{ textTransform: 'uppercase' }} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="form-row">
              <FormField
                control={form.control}
                name="decimals"
                render={({ field }) => (
                  <FormItem className="form-item-flex">
                    <FormLabel>Decimals</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0" 
                        max="18" 
                        {...field} 
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="total_supply"
                render={({ field }) => (
                  <FormItem className="form-item-flex">
                    <FormLabel>Total Supply</FormLabel>
                    <FormControl>
                      <Input placeholder="1000000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Describe your token's purpose and utility..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        );

      case 1:
        return (
          <div className="token-form-step">
            <div className="feature-cards">
              <Card className="feature-card">
                <CardHeader>
                  <CardTitle className="feature-title">
                    <Zap className="w-5 h-5" />
                    Mintable Token
                  </CardTitle>
                  <CardDescription>
                    Allow creating new tokens after deployment
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="is_mintable"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="text-sm font-normal">
                          Enable minting
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card className="feature-card">
                <CardHeader>
                  <CardTitle className="feature-title">
                    <Shield className="w-5 h-5" />
                    Burnable Token
                  </CardTitle>
                  <CardDescription>
                    Allow destroying tokens to reduce supply
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="is_burnable"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="text-sm font-normal">
                          Enable burning
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </div>

            <Card className="tax-settings">
              <CardHeader>
                <CardTitle>Transaction Fees (Optional)</CardTitle>
                <CardDescription>
                  Set buy and sell fees for your token (0-25%)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="form-row">
                  <FormField
                    control={form.control}
                    name="tax_buy"
                    render={({ field }) => (
                      <FormItem className="form-item-flex">
                        <FormLabel>Buy Tax (%)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="0" 
                            max="25" 
                            step="0.1"
                            placeholder="0" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tax_sell"
                    render={({ field }) => (
                      <FormItem className="form-item-flex">
                        <FormLabel>Sell Tax (%)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="0" 
                            max="25" 
                            step="0.1"
                            placeholder="0" 
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
          </div>
        );

      case 2:
        return (
          <div className="token-form-step">
            <FormField
              control={form.control}
              name="logo_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Logo URL (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://example.com/logo.png" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="website"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Website (Optional)</FormLabel>
                  <FormControl>
                    <div className="input-with-icon">
                      <Globe className="w-4 h-4 input-icon" />
                      <Input placeholder="https://mytoken.com" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="twitter"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Twitter (Optional)</FormLabel>
                  <FormControl>
                    <div className="input-with-icon">
                      <Twitter className="w-4 h-4 input-icon" />
                      <Input placeholder="@mytoken" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="telegram"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telegram (Optional)</FormLabel>
                  <FormControl>
                    <div className="input-with-icon">
                      <Send className="w-4 h-4 input-icon" />
                      <Input placeholder="t.me/mytoken" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        );

      case 3:
        const formData = form.getValues();
        const selectedChain = chains.find(c => c.id === formData.chain);
        
        return (
          <div className="token-form-step review-step">
            <Card className="review-card">
              <CardHeader>
                <CardTitle>Token Summary</CardTitle>
                <CardDescription>
                  Review your token configuration before deployment
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="review-grid">
                  <div className="review-item">
                    <span className="review-label">Blockchain:</span>
                    <span className="review-value">{selectedChain?.name}</span>
                  </div>
                  <div className="review-item">
                    <span className="review-label">Name:</span>
                    <span className="review-value">{formData.name}</span>
                  </div>
                  <div className="review-item">
                    <span className="review-label">Symbol:</span>
                    <span className="review-value">{formData.symbol}</span>
                  </div>
                  <div className="review-item">
                    <span className="review-label">Total Supply:</span>
                    <span className="review-value">{formData.total_supply}</span>
                  </div>
                  <div className="review-item">
                    <span className="review-label">Decimals:</span>
                    <span className="review-value">{formData.decimals}</span>
                  </div>
                  <div className="review-item">
                    <span className="review-label">Features:</span>
                    <div className="review-features">
                      {formData.is_mintable && <Badge>Mintable</Badge>}
                      {formData.is_burnable && <Badge>Burnable</Badge>}
                      {(!formData.is_mintable && !formData.is_burnable) && <Badge variant="secondary">Standard</Badge>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="deployment-info">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Deployment Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="deployment-details">
                  <div className="deployment-item">
                    <span>Estimated Fee:</span>
                    <span>{selectedChain?.fee}</span>
                  </div>
                  <div className="deployment-item">
                    <span>Deployment Time:</span>
                    <span>~2-5 minutes</span>
                  </div>
                  <div className="deployment-item">
                    <span>Contract Type:</span>
                    <span>ERC-20 Standard</span>
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
    <div className="token-creator">
      {/* Header */}
      <div className="token-creator-header">
        <div className="header-content">
          <Link href={`/devtools/project/${projectId}`} className="back-button">
            <ArrowLeft className="w-4 h-4" />
            Back to Project Dashboard
          </Link>
          
          <div className="header-info">
            <div className="header-icon">
              <Coins className="w-8 h-8" />
            </div>
            <div>
              <h1 className="header-title">Token Creator</h1>
              <p className="header-subtitle">Deploy professional ERC-20 tokens across multiple blockchains</p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="progress-section">
        <div className="progress-steps">
          {steps.map((step, index) => (
            <div
              key={index}
              className={`progress-step ${index <= currentStep ? 'active' : ''} ${index < currentStep ? 'completed' : ''}`}
            >
              <div className="step-number">
                {index < currentStep ? <CheckCircle2 className="w-4 h-4" /> : index + 1}
              </div>
              <div className="step-info">
                <div className="step-title">{step.title}</div>
                <div className="step-description">{step.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Form Content */}
      <div className="token-creator-content">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="token-form">
            {renderStepContent()}
            
            {/* Navigation Buttons */}
            <div className="form-navigation">
              {currentStep > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep(currentStep - 1)}
                  disabled={deploymentStatus === 'deploying'}
                >
                  Previous
                </Button>
              )}
              
              {currentStep < steps.length - 1 ? (
                <Button
                  type="button"
                  onClick={() => setCurrentStep(currentStep + 1)}
                  disabled={!form.formState.isValid}
                  className="ml-auto"
                >
                  Next
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={deploymentStatus === 'deploying'}
                  className="ml-auto deploy-button"
                >
                  {deploymentStatus === 'deploying' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Deploying...
                    </>
                  ) : (
                    <>
                      <Star className="w-4 h-4 mr-2" />
                      Deploy Token
                    </>
                  )}
                </Button>
              )}
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default TokenCreator;
