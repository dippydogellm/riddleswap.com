import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Loader2, 
  Search, 
  Globe, 
  Users, 
  Trophy,
  Coins,
  Info
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';

// Form validation schema
const claimFormSchema = z.object({
  issuerWallet: z.string().min(1, "Issuer wallet address is required").regex(/^r[0-9A-Za-z]{24,34}$/, "Must be a valid XRP address"),
  nftTokenTaxon: z.coerce.number().int().min(0, "Token taxon must be a non-negative integer").optional(),
  vanitySlugRequested: z.string()
    .min(3, "Vanity slug must be at least 3 characters")
    .max(50, "Vanity slug cannot exceed 50 characters")
    .regex(/^[a-z0-9-]+$/, "Vanity slug can only contain lowercase letters, numbers, and hyphens"),
  projectDescription: z.string().max(1000, "Description cannot exceed 1000 characters").optional(),
  projectWebsite: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  projectTwitter: z.string().optional(),
  projectDiscord: z.string().optional(),
});

type ClaimFormData = z.infer<typeof claimFormSchema>;

interface ProjectClaimFormProps {
  onClaimSubmitted?: () => void;
  onCancel?: () => void;
  className?: string;
}

interface BithompCollectionData {
  name?: string;
  description?: string;
  image?: string;
  verified?: boolean;
  totalNFTs?: number;
  owners?: number;
  floorPrice?: number;
  floorPriceUsd?: number;
  volume24h?: number;
  volume24hUsd?: number;
}

export default function ProjectClaimForm({ onClaimSubmitted, onCancel, className }: ProjectClaimFormProps) {
  const { toast } = useToast();
  const { user, walletAddresses } = useAuth();
  const queryClient = useQueryClient();
  const [previewData, setPreviewData] = useState<BithompCollectionData | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const form = useForm<ClaimFormData>({
    resolver: zodResolver(claimFormSchema),
    defaultValues: {
      issuerWallet: '',
      nftTokenTaxon: undefined,
      vanitySlugRequested: '',
      projectDescription: '',
      projectWebsite: '',
      projectTwitter: '',
      projectDiscord: '',
    },
  });

  // Watch form values to trigger preview updates
  const watchedIssuer = form.watch('issuerWallet');
  const watchedTaxon = form.watch('nftTokenTaxon');

  // Fetch Bithomp preview data
  const fetchBithompPreview = async () => {
    if (!watchedIssuer || !watchedTaxon) return;

    setIsLoadingPreview(true);
    setPreviewError(null);
    
    try {
      const response = await fetch(`/api/bithomp/collection-preview?issuer=${watchedIssuer}&taxon=${watchedTaxon}`);
      if (!response.ok) {
        throw new Error('Failed to fetch collection data');
      }
      
      const data = await response.json() as any;
      if (data.success && data.collection) {
        setPreviewData(data.collection);
        
        // Auto-populate form fields if they're empty
        if (data.collection.name && !form.getValues('vanitySlugRequested')) {
          const suggestedSlug = data.collection.name
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .slice(0, 50);
          form.setValue('vanitySlugRequested', suggestedSlug);
        }
        
        if (data.collection.description && !form.getValues('projectDescription')) {
          form.setValue('projectDescription', data.collection.description);
        }
      } else {
        setPreviewError(data.error || 'Collection not found');
      }
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : 'Failed to fetch preview');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Submit claim mutation
  const submitClaimMutation = useMutation({
    mutationFn: async (data: ClaimFormData) => {
      const claimantWallet = walletAddresses?.xrpAddress || user?.walletAddress;
      if (!claimantWallet) {
        throw new Error('No XRP wallet address found. Please connect an XRP wallet.');
      }

      const claimData: any = {
        issuerWallet: data.issuerWallet,
        chain: 'xrp',
        nftTokenTaxon: data.nftTokenTaxon,
        claimantWallet,
        claimantChain: 'xrp',
        ownershipProofType: 'signature' as const,
        ownershipProofData: {
          method: 'wallet_verification',
          claimantWallet,
          timestamp: Date.now(),
        },
        vanitySlugRequested: data.vanitySlugRequested,
        projectDescription: data.projectDescription,
        projectWebsite: data.projectWebsite,
        projectSocialLinks: {
          ...(data.projectTwitter && { twitter: data.projectTwitter }),
          ...(data.projectDiscord && { discord: data.projectDiscord }),
        },
      };

      if (previewData?.image) {
        claimData.projectLogoUrl = previewData.image;
      }

      return await apiRequest('/api/projects/claims', {
        method: 'POST',
        body: claimData,
      });
    },
    onSuccess: () => {
      toast({
        title: "Claim Submitted Successfully",
        description: "Your project claim has been submitted and is pending review. You'll be notified once it's processed.",
      });
      form.reset();
      setPreviewData(null);
      queryClient.invalidateQueries({ queryKey: ['/api/devtools/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects/claims'] });
      onClaimSubmitted?.();
    },
    onError: (error: any) => {
      toast({
        title: "Claim Submission Failed",
        description: error.response?.data?.error || "Failed to submit project claim. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: ClaimFormData) => {
    await submitClaimMutation.mutateAsync(data);
  };

  const formatNumber = (num: number | undefined) => {
    if (!num) return 'N/A';
    return new Intl.NumberFormat().format(num);
  };

  const formatPrice = (price: number | undefined) => {
    if (!price) return 'N/A';
    return price < 0.01 ? price.toFixed(6) : price.toFixed(2);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <Card className="border-2 border-dashed border-slate-300 dark:border-slate-600">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Trophy className="w-5 h-5 text-yellow-600" />
            <span>Claim XRPL NFT Project</span>
          </CardTitle>
          <CardDescription>
            Claim ownership of your XRPL NFT collection and set up your project dashboard.
            You'll need the issuer address and token taxon of your collection.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* XRPL Collection Identification */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2 mb-4">
                  <Search className="w-4 h-4 text-blue-600" />
                  <h3 className="text-lg font-semibold">Collection Identification</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="issuerWallet"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Issuer Wallet Address *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="rNvLdpKhZGnbSDzKQE..."
                            {...field}
                            data-testid="issuer-wallet-input"
                          />
                        </FormControl>
                        <FormDescription>
                          The XRP address that issued your NFT collection
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="nftTokenTaxon"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>NFT Token Taxon</FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            placeholder="e.g., 12345"
                            {...field}
                            data-testid="nft-taxon-input"
                          />
                        </FormControl>
                        <FormDescription>
                          The unique taxon identifier for your NFT collection
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex space-x-2">
                  <Button 
                    type="button"
                    variant="outline"
                    onClick={fetchBithompPreview}
                    disabled={!watchedIssuer || isLoadingPreview}
                    data-testid="fetch-preview-button"
                  >
                    {isLoadingPreview ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Search className="w-4 h-4 mr-2" />
                    )}
                    Preview Collection
                  </Button>
                </div>
              </div>

              {/* Bithomp Collection Preview */}
              {isLoadingPreview && (
                <Alert>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <AlertDescription>
                    Fetching collection data from Bithomp...
                  </AlertDescription>
                </Alert>
              )}

              {previewError && (
                <Alert variant="destructive">
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription>
                    {previewError}
                  </AlertDescription>
                </Alert>
              )}

              {previewData && (
                <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <span>Collection Found</span>
                      {previewData.verified && (
                        <Badge className="bg-blue-500">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Verified
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        {previewData.name && (
                          <div>
                            <Label className="text-sm font-medium">Collection Name</Label>
                            <p className="text-sm bg-white dark:bg-slate-800 p-2 rounded border">
                              {previewData.name}
                            </p>
                          </div>
                        )}
                        {previewData.description && (
                          <div>
                            <Label className="text-sm font-medium">Description</Label>
                            <p className="text-sm bg-white dark:bg-slate-800 p-2 rounded border line-clamp-3">
                              {previewData.description}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="flex items-center space-x-2">
                            <Coins className="w-4 h-4 text-slate-500" />
                            <div>
                              <p className="font-medium">{formatNumber(previewData.totalNFTs)}</p>
                              <p className="text-slate-500">Total NFTs</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Users className="w-4 h-4 text-slate-500" />
                            <div>
                              <p className="font-medium">{formatNumber(previewData.owners)}</p>
                              <p className="text-slate-500">Owners</p>
                            </div>
                          </div>
                        </div>
                        {(previewData.floorPrice || previewData.volume24h) && (
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            {previewData.floorPrice && (
                              <div>
                                <p className="font-medium">{formatPrice(previewData.floorPrice)} XRP</p>
                                <p className="text-slate-500">Floor Price</p>
                              </div>
                            )}
                            {previewData.volume24h && (
                              <div>
                                <p className="font-medium">{formatPrice(previewData.volume24h)} XRP</p>
                                <p className="text-slate-500">24h Volume</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Project Details */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2 mb-4">
                  <Info className="w-4 h-4 text-purple-600" />
                  <h3 className="text-lg font-semibold">Project Details</h3>
                </div>

                <FormField
                  control={form.control}
                  name="vanitySlugRequested"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vanity URL Slug *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="my-awesome-nft-project"
                          {...field}
                          data-testid="vanity-slug-input"
                        />
                      </FormControl>
                      <FormDescription>
                        Your project will be available at: riddle.app/project/{field.value || 'your-slug'}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="projectDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Tell us about your NFT collection..."
                          rows={4}
                          {...field}
                          data-testid="project-description-input"
                        />
                      </FormControl>
                      <FormDescription>
                        Provide a detailed description of your project (optional)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="projectWebsite"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Website</FormLabel>
                        <FormControl>
                          <Input 
                            type="url"
                            placeholder="https://yourproject.com"
                            {...field}
                            data-testid="project-website-input"
                          />
                        </FormControl>
                        <FormDescription>
                          Your official project website (optional)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="projectTwitter"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Twitter/X Handle</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="@yourproject"
                            {...field}
                            data-testid="project-twitter-input"
                          />
                        </FormControl>
                        <FormDescription>
                          Your project's Twitter handle (optional)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="projectDiscord"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Discord Server</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="https://discord.gg/yourserver"
                          {...field}
                          data-testid="project-discord-input"
                        />
                      </FormControl>
                      <FormDescription>
                        Your project's Discord server link (optional)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Current User Info */}
              {walletAddresses?.xrpAddress && (
                <Alert>
                  <Info className="w-4 h-4" />
                  <AlertDescription>
                    <strong>Claiming as:</strong> {walletAddresses.xrpAddress}
                  </AlertDescription>
                </Alert>
              )}

              {/* Submit Actions */}
              <div className="flex space-x-4 pt-4 border-t">
                {onCancel && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={onCancel}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                )}
                <Button 
                  type="submit" 
                  disabled={submitClaimMutation.isPending}
                  className="flex-1"
                  data-testid="submit-claim-button"
                >
                  {submitClaimMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Submitting Claim...
                    </>
                  ) : (
                    <>
                      <Trophy className="w-4 h-4 mr-2" />
                      Submit Project Claim
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
