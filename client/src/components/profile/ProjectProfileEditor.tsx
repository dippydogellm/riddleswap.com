import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Save, 
  Eye, 
  Upload, 
  Globe, 
  Twitter, 
  MessageCircle,
  Crown,
  Lock,
  CheckCircle,
  AlertTriangle,
  Image as ImageIcon,
  Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { SubscriptionStatus } from './SubscriptionStatus';
import { SubscriptionInfo } from '@/hooks/useSubscription';
import { VerificationBadge } from './VerificationBadge';
import { MetadataPreview } from './MetadataPreview';

// Form validation schema
const profileEditSchema = z.object({
  title: z.string()
    .min(1, "Project title is required")
    .max(100, "Title cannot exceed 100 characters"),
  description: z.string()
    .max(1000, "Description cannot exceed 1000 characters")
    .optional(),
  website: z.string()
    .url("Must be a valid URL")
    .optional()
    .or(z.literal("")),
  logo_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  banner_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  twitter: z.string().optional(),
  discord: z.string().optional(),
  telegram: z.string().optional(),
});

type ProfileEditData = z.infer<typeof profileEditSchema>;

interface ProjectProfileEditorProps {
  projectId: string;
  onSave?: (data: any) => void;
  className?: string;
}

export function ProjectProfileEditor({ projectId, onSave, className }: ProjectProfileEditorProps) {
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("basic");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Fetch project data
  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['/api/devtools/projects', projectId],
    enabled: !!projectId && isAuthenticated,
  });

  // Fetch subscription status
  const { data: subscription } = useQuery<SubscriptionInfo>({
    queryKey: ['/api/subscriptions/status'],
    enabled: isAuthenticated,
  });

  // Fetch existing overrides
  const { data: existingOverrides } = useQuery({
    queryKey: ['/api/project-content-overrides', projectId],
    enabled: !!projectId && isAuthenticated,
  });

  const form = useForm<ProfileEditData>({
    resolver: zodResolver(profileEditSchema),
    defaultValues: {
      title: '',
      description: '',
      website: '',
      logo_url: '',
      banner_url: '',
      twitter: '',
      discord: '',
      telegram: '',
    },
  });

  // Load existing data into form
  useEffect(() => {
    const overridesData = existingOverrides as any;
    const projectData = project as any;
    
    if (overridesData && overridesData.success) {
      const overrides = overridesData.overrides;
      form.reset({
        title: overrides.title || projectData?.name || '',
        description: overrides.description || projectData?.description || '',
        website: overrides.website || '',
        logo_url: overrides.logo_url || '',
        banner_url: overrides.banner_url || '',
        twitter: overrides.social_links?.twitter || '',
        discord: overrides.social_links?.discord || '',
        telegram: overrides.social_links?.telegram || '',
      });
    } else if (projectData) {
      // Fall back to project data if no overrides exist
      form.reset({
        title: projectData.name || '',
        description: projectData.description || '',
        website: projectData.website || '',
        logo_url: projectData.logo_url || '',
        banner_url: '',
        twitter: projectData.social_links?.twitter || '',
        discord: projectData.social_links?.discord || '',
        telegram: projectData.social_links?.telegram || '',
      });
    }
  }, [existingOverrides, project, form]);

  // Save overrides mutation
  const saveOverridesMutation = useMutation({
    mutationFn: async (data: ProfileEditData) => {
      const overrideData = {
        project_id: projectId,
        title: data.title,
        description: data.description,
        website: data.website,
        logo_url: data.logo_url,
        banner_url: data.banner_url,
        social_links: {
          ...(data.twitter && { twitter: data.twitter }),
          ...(data.discord && { discord: data.discord }),
          ...(data.telegram && { telegram: data.telegram }),
        },
      };

      return await apiRequest('/api/project-content-overrides', {
        method: 'POST',
        body: JSON.stringify(overrideData),
      });
    },
    onSuccess: (response) => {
      toast({
        title: "Profile Updated",
        description: "Your project profile has been updated successfully.",
      });
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['/api/project-content-overrides', projectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/metadata', 'unified'] });
      queryClient.invalidateQueries({ queryKey: ['/api/subscriptions/status'] });
      
      onSave?.(response);
    },
    onError: (error: any) => {
      const message = error.response?.data?.error || "Failed to update project profile";
      toast({
        title: "Update Failed",
        description: message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: ProfileEditData) => {
    // Check subscription limits
    if (!subscription || subscription.tier === 'free') {
      toast({
        title: "Subscription Required",
        description: "Project overrides require a Bronze or Gold subscription.",
        variant: "destructive",
      });
      return;
    }

    if (subscription.overrideCount >= subscription.maxOverrides) {
      toast({
        title: "Override Limit Reached",
        description: `You have reached your limit of ${subscription.maxOverrides} overrides. Please upgrade your subscription.`,
        variant: "destructive",
      });
      return;
    }

    await saveOverridesMutation.mutateAsync(data);
  };

  // Check if user can access certain fields based on subscription
  const canUseAdvancedFields = subscription && subscription.tier !== 'free';
  const canPublish = subscription && subscription.verified;

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <Alert className="max-w-md mx-auto">
        <AlertTriangle className="w-4 h-4" />
        <AlertDescription>
          Project not found or you don't have access to edit this project.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-3">
            <h2 className="text-2xl font-bold">Edit Project Profile</h2>
            <VerificationBadge 
              verified={subscription?.verified || false} 
              size="sm" 
            />
          </div>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Customize how your project appears on token and NFT pages
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            onClick={() => setIsPreviewOpen(true)}
            disabled={saveOverridesMutation.isPending}
          >
            <Eye className="w-4 h-4 mr-2" />
            Preview
          </Button>
          <Button
            onClick={form.handleSubmit(onSubmit)}
            disabled={saveOverridesMutation.isPending || !form.formState.isDirty}
            data-testid="save-profile-button"
          >
            {saveOverridesMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Subscription Status */}
      <SubscriptionStatus subscription={subscription} />

      {/* Main Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Form {...form}>
            <form className="space-y-6">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="basic">Basic Info</TabsTrigger>
                  <TabsTrigger value="media" disabled={!canUseAdvancedFields}>
                    Media & Assets
                    {!canUseAdvancedFields && <Lock className="w-3 h-3 ml-2" />}
                  </TabsTrigger>
                  <TabsTrigger value="social" disabled={!canUseAdvancedFields}>
                    Social Links
                    {!canUseAdvancedFields && <Lock className="w-3 h-3 ml-2" />}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Project Information</CardTitle>
                      <CardDescription>
                        Basic information about your project that will be displayed publicly.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Project Title *</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Enter project title"
                                {...field}
                                data-testid="title-input"
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
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Describe your project..."
                                rows={4}
                                {...field}
                                data-testid="description-input"
                              />
                            </FormControl>
                            <FormDescription>
                              Tell users about your project. Max 1000 characters.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="website"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Website</FormLabel>
                            <FormControl>
                              <Input
                                type="url"
                                placeholder="https://yourproject.com"
                                {...field}
                                data-testid="website-input"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="media" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <ImageIcon className="w-5 h-5 mr-2" />
                        Media Assets
                        <Badge variant="outline" className="ml-2">
                          <Crown className="w-3 h-3 mr-1" />
                          Pro+
                        </Badge>
                      </CardTitle>
                      <CardDescription>
                        Upload custom logos and banners for your project.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {!canUseAdvancedFields && (
                        <Alert>
                          <Crown className="w-4 h-4" />
                          <AlertDescription>
                            Media asset uploads require a Bronze or Gold subscription.
                            <Button variant="link" className="ml-2 p-0">
                              Upgrade Now
                            </Button>
                          </AlertDescription>
                        </Alert>
                      )}

                      <FormField
                        control={form.control}
                        name="logo_url"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Logo URL</FormLabel>
                            <FormControl>
                              <div className="flex space-x-2">
                                <Input
                                  type="url"
                                  placeholder="https://example.com/logo.png"
                                  {...field}
                                  disabled={!canUseAdvancedFields}
                                  data-testid="logo-url-input"
                                />
                                <Button 
                                  type="button" 
                                  variant="outline" 
                                  size="sm"
                                  disabled={!canUseAdvancedFields}
                                >
                                  <Upload className="w-4 h-4" />
                                </Button>
                              </div>
                            </FormControl>
                            <FormDescription>
                              Recommended size: 400x400px or larger, square aspect ratio
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="banner_url"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Banner URL</FormLabel>
                            <FormControl>
                              <div className="flex space-x-2">
                                <Input
                                  type="url"
                                  placeholder="https://example.com/banner.jpg"
                                  {...field}
                                  disabled={!canUseAdvancedFields}
                                  data-testid="banner-url-input"
                                />
                                <Button 
                                  type="button" 
                                  variant="outline" 
                                  size="sm"
                                  disabled={!canUseAdvancedFields}
                                >
                                  <Upload className="w-4 h-4" />
                                </Button>
                              </div>
                            </FormControl>
                            <FormDescription>
                              Recommended size: 1200x400px, banner aspect ratio
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="social" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Globe className="w-5 h-5 mr-2" />
                        Social Links
                        <Badge variant="outline" className="ml-2">
                          <Crown className="w-3 h-3 mr-1" />
                          Pro+
                        </Badge>
                      </CardTitle>
                      <CardDescription>
                        Connect your social media accounts and community channels.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {!canUseAdvancedFields && (
                        <Alert>
                          <Crown className="w-4 h-4" />
                          <AlertDescription>
                            Social link customization requires a Bronze or Gold subscription.
                            <Button variant="link" className="ml-2 p-0">
                              Upgrade Now
                            </Button>
                          </AlertDescription>
                        </Alert>
                      )}

                      <FormField
                        control={form.control}
                        name="twitter"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center">
                              <Twitter className="w-4 h-4 mr-2" />
                              Twitter
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="@yourproject or twitter.com/yourproject"
                                {...field}
                                disabled={!canUseAdvancedFields}
                                data-testid="twitter-input"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="discord"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center">
                              <MessageCircle className="w-4 h-4 mr-2" />
                              Discord
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="discord.gg/yourserver"
                                {...field}
                                disabled={!canUseAdvancedFields}
                                data-testid="discord-input"
                              />
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
                            <FormLabel>Telegram</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="t.me/yourgroup"
                                {...field}
                                disabled={!canUseAdvancedFields}
                                data-testid="telegram-input"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </form>
          </Form>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Publishing Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Publishing Status</CardTitle>
            </CardHeader>
            <CardContent>
              {canPublish ? (
                <div className="flex items-center text-green-600">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  <span className="text-sm">Ready to publish</span>
                </div>
              ) : (
                <div className="flex items-center text-amber-600">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  <span className="text-sm">Verification required to publish</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Project Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Project Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Chain:</span>
                <span className="font-medium">{(project as any)?.chain?.toUpperCase()}</span>
              </div>
              {(project as any)?.issuer_wallet && (
                <div className="flex justify-between">
                  <span className="text-slate-600">Issuer:</span>
                  <span className="font-mono text-xs">{(project as any).issuer_wallet.slice(0, 8)}...</span>
                </div>
              )}
              {(project as any)?.nft_token_taxon && (
                <div className="flex justify-between">
                  <span className="text-slate-600">Token Taxon:</span>
                  <span className="font-medium">{(project as any).nft_token_taxon}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Preview Modal */}
      {isPreviewOpen && (
        <MetadataPreview
          projectData={{ ...form.getValues(), title: form.getValues().title || '' }}
          originalData={project}
          onClose={() => setIsPreviewOpen(false)}
          open={isPreviewOpen}
        />
      )}
    </div>
  );
}
