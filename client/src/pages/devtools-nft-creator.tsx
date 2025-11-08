import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Image, Settings, Globe, Twitter, Send, Upload, Zap, Shield, Star, AlertCircle, CheckCircle2, Loader2, Crown, Palette } from 'lucide-react';
import { Link, useParams } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import '../styles/devtools-nft-creator.css';

const nftSchema = z.object({
  chain: z.string().min(1, 'Please select a blockchain'),
  collection_name: z.string().min(1, 'Collection name is required').max(50, 'Name too long'),
  collection_symbol: z.string().min(1, 'Symbol is required').max(10, 'Symbol too long').regex(/^[A-Z0-9]+$/, 'Only uppercase letters and numbers'),
  description: z.string().optional(),
  max_supply: z.number().min(1, 'Max supply must be at least 1').max(100000, 'Max supply too large'),
  base_uri: z.string().url().optional().or(z.literal('')),
  royalty_percentage: z.string().regex(/^\d*\.?\d*$/, 'Invalid percentage').optional(),
  royalty_address: z.string().optional(),
  mint_price: z.string().regex(/^\d*\.?\d*$/, 'Invalid price').optional(),
  is_revealed: z.boolean().default(false),
  reveal_uri: z.string().url().optional().or(z.literal(''))
});

type NFTFormData = z.infer<typeof nftSchema>;

const NFTCreator = () => {
  const { projectId } = useParams();
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [mintType, setMintType] = useState<'single' | 'collection' | null>(null);

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
              <p className="text-slate-600 dark:text-slate-400">Loading NFT Creator...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  const [currentStep, setCurrentStep] = useState(0);
  const [deploymentStatus, setDeploymentStatus] = useState<'idle' | 'deploying' | 'success' | 'error'>('idle');

  const form = useForm<NFTFormData>({
    resolver: zodResolver(nftSchema),
    defaultValues: {
      chain: '',
      collection_name: '',
      collection_symbol: '',
      description: '',
      max_supply: 1000,
      base_uri: '',
      royalty_percentage: '5',
      royalty_address: '',
      mint_price: '0',
      is_revealed: false,
      reveal_uri: ''
    }
  });

  const chains = [
    { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', fee: '~$50-150', standard: 'ERC-721' },
    { id: 'bsc', name: 'Binance Smart Chain', symbol: 'BNB', fee: '~$1-5', standard: 'BEP-721' },
    { id: 'polygon', name: 'Polygon', symbol: 'MATIC', fee: '~$0.01-1', standard: 'ERC-721' },
    { id: 'base', name: 'Base', symbol: 'ETH', fee: '~$1-10', standard: 'ERC-721' },
    { id: 'arbitrum', name: 'Arbitrum', symbol: 'ETH', fee: '~$1-5', standard: 'ERC-721' },
    { id: 'solana', name: 'Solana', symbol: 'SOL', fee: '~$0.01', standard: 'SPL' }
  ];

  const deployNFTMutation = useMutation({
    mutationFn: async (data: NFTFormData) => {
      const response = await fetch('/api/devtools/nfts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to deploy NFT collection');
      return response.json();
    },
    onSuccess: (result) => {
      setDeploymentStatus('success');
      toast({
        title: 'NFT Collection Deployment Initiated',
        description: 'Your NFT collection is being deployed to the blockchain.',
      });
    },
    onError: (error) => {
      setDeploymentStatus('error');
      toast({
        title: 'Deployment Failed',
        description: error.message || 'Failed to deploy NFT collection. Please try again.',
        variant: 'destructive'
      });
    }
  });

  const onSubmit = (data: NFTFormData) => {
    setDeploymentStatus('deploying');
    deployNFTMutation.mutate(data);
  };

  const steps = [
    {
      title: 'Collection Details',
      description: 'Basic information about your NFT collection'
    },
    {
      title: 'Minting Configuration',
      description: 'Supply limits and pricing settings'
    },
    {
      title: 'Metadata & Royalties',
      description: 'URI settings and creator royalties'
    },
    {
      title: 'Review & Deploy',
      description: 'Review and deploy your collection'
    }
  ];

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="nft-form-step">
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
                            <div>
                              <span>{chain.name}</span>
                              <Badge variant="outline" className="ml-2">{chain.standard}</Badge>
                            </div>
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
                name="collection_name"
                render={({ field }) => (
                  <FormItem className="form-item-flex">
                    <FormLabel>Collection Name</FormLabel>
                    <FormControl>
                      <Input placeholder="My Awesome NFTs" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="collection_symbol"
                render={({ field }) => (
                  <FormItem className="form-item-flex">
                    <FormLabel>Symbol</FormLabel>
                    <FormControl>
                      <Input placeholder="MAN" {...field} style={{ textTransform: 'uppercase' }} />
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
                      placeholder="Describe your NFT collection, its utility, and unique features..."
                      className="resize-none"
                      rows={4}
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
          <div className="nft-form-step">
            <div className="form-row">
              <FormField
                control={form.control}
                name="max_supply"
                render={({ field }) => (
                  <FormItem className="form-item-flex">
                    <FormLabel>Maximum Supply</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="1" 
                        max="100000" 
                        placeholder="1000"
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
                name="mint_price"
                render={({ field }) => (
                  <FormItem className="form-item-flex">
                    <FormLabel>Mint Price (ETH/BNB/MATIC)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0" 
                        step="0.001"
                        placeholder="0.01"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Card className="minting-features">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="w-5 h-5" />
                  Minting Features
                </CardTitle>
                <CardDescription>
                  Advanced features for your NFT collection
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="feature-list">
                  <div className="feature-item">
                    <Crown className="w-5 h-5" />
                    <div>
                      <div className="feature-name">Owner-only Minting</div>
                      <div className="feature-desc">Only collection owner can mint</div>
                    </div>
                    <Badge>Included</Badge>
                  </div>
                  <div className="feature-item">
                    <Shield className="w-5 h-5" />
                    <div>
                      <div className="feature-name">Pausable Contract</div>
                      <div className="feature-desc">Ability to pause/unpause minting</div>
                    </div>
                    <Badge>Included</Badge>
                  </div>
                  <div className="feature-item">
                    <Zap className="w-5 h-5" />
                    <div>
                      <div className="feature-name">Batch Minting</div>
                      <div className="feature-desc">Mint multiple NFTs in one transaction</div>
                    </div>
                    <Badge>Included</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 2:
        return (
          <div className="nft-form-step">
            <FormField
              control={form.control}
              name="base_uri"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Base URI (Optional)</FormLabel>
                  <FormControl>
                    <div className="input-with-icon">
                      <Globe className="w-4 h-4 input-icon" />
                      <Input placeholder="https://api.mynfts.com/metadata/" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Card className="reveal-settings">
              <CardHeader>
                <CardTitle>Reveal Settings</CardTitle>
                <CardDescription>
                  Configure metadata reveal mechanics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="is_revealed"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-3 mb-4">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div>
                        <FormLabel className="text-sm font-normal">
                          Reveal immediately after mint
                        </FormLabel>
                        <p className="text-xs text-muted-foreground">
                          If disabled, NFTs will show placeholder until revealed
                        </p>
                      </div>
                    </FormItem>
                  )}
                />

                {!form.watch('is_revealed') && (
                  <FormField
                    control={form.control}
                    name="reveal_uri"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Placeholder URI</FormLabel>
                        <FormControl>
                          <Input placeholder="https://api.mynfts.com/placeholder.json" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </CardContent>
            </Card>

            <Card className="royalty-settings">
              <CardHeader>
                <CardTitle>Creator Royalties</CardTitle>
                <CardDescription>
                  Set up secondary sales royalties (EIP-2981 standard)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="form-row">
                  <FormField
                    control={form.control}
                    name="royalty_percentage"
                    render={({ field }) => (
                      <FormItem className="form-item-flex">
                        <FormLabel>Royalty Percentage</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="0" 
                            max="10" 
                            step="0.1"
                            placeholder="5.0"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="royalty_address"
                    render={({ field }) => (
                      <FormItem className="form-item-flex">
                        <FormLabel>Royalty Address (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="0x..." {...field} />
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

      case 3:
        const formData = form.getValues();
        const selectedChain = chains.find(c => c.id === formData.chain);
        
        return (
          <div className="nft-form-step review-step">
            <Card className="review-card">
              <CardHeader>
                <CardTitle>Collection Summary</CardTitle>
                <CardDescription>
                  Review your NFT collection configuration before deployment
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="review-grid">
                  <div className="review-item">
                    <span className="review-label">Blockchain:</span>
                    <span className="review-value">{selectedChain?.name}</span>
                  </div>
                  <div className="review-item">
                    <span className="review-label">Collection Name:</span>
                    <span className="review-value">{formData.collection_name}</span>
                  </div>
                  <div className="review-item">
                    <span className="review-label">Symbol:</span>
                    <span className="review-value">{formData.collection_symbol}</span>
                  </div>
                  <div className="review-item">
                    <span className="review-label">Max Supply:</span>
                    <span className="review-value">{formData.max_supply}</span>
                  </div>
                  <div className="review-item">
                    <span className="review-label">Mint Price:</span>
                    <span className="review-value">{formData.mint_price || 0} {selectedChain?.symbol}</span>
                  </div>
                  <div className="review-item">
                    <span className="review-label">Royalty:</span>
                    <span className="review-value">{formData.royalty_percentage || 0}%</span>
                  </div>
                  <div className="review-item">
                    <span className="review-label">Reveal:</span>
                    <span className="review-value">
                      {formData.is_revealed ? 'Immediate' : 'Manual'}
                    </span>
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
                    <span>~3-8 minutes</span>
                  </div>
                  <div className="deployment-item">
                    <span>Contract Type:</span>
                    <span>{selectedChain?.standard}</span>
                  </div>
                  <div className="deployment-item">
                    <span>Features:</span>
                    <span>Ownable, Pausable, Royalties</span>
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

  // If no mint type selected, show selection screen
  if (!mintType) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          {/* Header */}
          <div className="header-section">
            <Link href="/devtools" className="back-link">
              <ArrowLeft className="h-4 w-4" />
              Back to DevTools
            </Link>
            <div className="header-content">
              <div className="header-icon">
                <Crown className="h-8 w-8" />
              </div>
              <div>
                <h1 className="header-title">NFT Creator</h1>
                <p className="header-subtitle">Choose your NFT minting approach</p>
              </div>
            </div>
          </div>

          {/* Mint Type Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            <Card 
              className="border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-blue-500 dark:hover:border-blue-400 transition-colors cursor-pointer"
              onClick={() => setMintType('single')}
              data-testid="select-single-nft"
            >
              <CardContent className="py-12 text-center">
                <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-4">
                  <Star className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2">1/1 NFT</h3>
                <p className="text-slate-600 dark:text-slate-400 mb-6">
                  Create a single, unique piece. Perfect for digital art, special collectibles, or one-of-a-kind items.
                </p>
                <div className="space-y-2 text-sm text-left">
                  <div className="flex items-center text-green-600">
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Single unique NFT
                  </div>
                  <div className="flex items-center text-green-600">
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Lower gas fees
                  </div>
                  <div className="flex items-center text-green-600">
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Quick deployment
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card 
              className="border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-purple-500 dark:hover:border-purple-400 transition-colors cursor-pointer"
              onClick={() => setMintType('collection')}
              data-testid="select-collection-nft"
            >
              <CardContent className="py-12 text-center">
                <div className="mx-auto w-16 h-16 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mb-4">
                  <Palette className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2">NFT Collection</h3>
                <p className="text-slate-600 dark:text-slate-400 mb-6">
                  Launch a full collection with multiple NFTs. Ideal for PFP projects, utility collections, or series.
                </p>
                <div className="space-y-2 text-sm text-left">
                  <div className="flex items-center text-green-600">
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Multiple NFTs (up to 100k)
                  </div>
                  <div className="flex items-center text-green-600">
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Batch minting
                  </div>
                  <div className="flex items-center text-green-600">
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Advanced features
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="nft-creator">
      {/* Header */}
      <div className="nft-creator-header">
        <div className="header-content">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              onClick={() => setMintType(null)}
              className="back-button"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Selection
            </Button>
            <Link href="/devtools" className="back-button">
              DevTools
            </Link>
          </div>
          
          <div className="header-info">
            <div className="header-icon">
              {mintType === 'single' ? <Star className="w-8 h-8" /> : <Palette className="w-8 h-8" />}
            </div>
            <div>
              <h1 className="header-title">
                {mintType === 'single' ? '1/1 NFT Creator' : 'NFT Collection Creator'}
              </h1>
              <p className="header-subtitle">
                {mintType === 'single' 
                  ? 'Deploy a unique, one-of-a-kind NFT' 
                  : 'Deploy professional NFT collections across multiple blockchains'
                }
              </p>
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
      <div className="nft-creator-content">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="nft-form">
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
                      Deploy Collection
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

export default NFTCreator;
