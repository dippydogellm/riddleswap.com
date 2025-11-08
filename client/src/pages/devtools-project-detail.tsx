import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoute, useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  ArrowLeft, Save, ExternalLink, Globe, Twitter, Github, 
  Image, Link, Users, Settings, Trash2, AlertTriangle,
  CheckCircle2, Upload, Copy, Crown, Network, Plus,
  Coins, Paintbrush, Rocket, Shield, Zap, Gift, Camera, BarChart3
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { DevtoolsProject, ChainConfiguration } from '@shared/schema';

const projectUpdateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  vanity_slug: z.string()
    .min(3, 'URL must be at least 3 characters')
    .max(50, 'URL must be less than 50 characters')
    .regex(/^[a-z0-9-]+$/, 'URL can only contain lowercase letters, numbers, and hyphens')
    .optional(),
  logo_url: z.string().url('Invalid logo URL').optional().or(z.literal('')),
  banner_url: z.string().url('Invalid banner URL').optional().or(z.literal('')),
  website_url: z.string().url('Invalid website URL').optional().or(z.literal('')),
  social_links: z.object({
    twitter: z.string().optional(),
    github: z.string().optional(),
    discord: z.string().optional(),
    telegram: z.string().optional(),
  }).optional()
});

type ProjectUpdateFormData = z.infer<typeof projectUpdateSchema>;

export default function DevToolsProjectDetail() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [match, params] = useRoute('/devtools/project/:id');
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');

  const projectId = params?.id;

  // Redirect if not authenticated or no project ID
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/devtools');
      return;
    }
    if (!match || !projectId) {
      navigate('/devtools');
      return;
    }
  }, [authLoading, isAuthenticated, match, projectId, navigate]);

  // Fetch project details
  const { data: project, isLoading: projectLoading, error } = useQuery<DevtoolsProject>({
    queryKey: ['/api/devtools/projects', projectId],
    enabled: isAuthenticated && !!projectId,
  });

  // Redirect based on asset_type once project is loaded
  useEffect(() => {
    if (project) {
      if (project.asset_type === 'token') {
        navigate(`/devtools/token/${projectId}`, { replace: true });
      } else if (project.asset_type === 'nft') {
        navigate(`/devtools/nft/${projectId}`, { replace: true });
      }
      // If no asset_type, stay on this page as a fallback
    }
  }, [project, projectId, navigate]);

  // Fetch chain configurations
  const { data: chainConfigs = [] } = useQuery<ChainConfiguration[]>({
    queryKey: ['/api/devtools/projects', projectId, 'chains'],
    enabled: isAuthenticated && !!projectId,
  });

  // Initialize form
  const form = useForm<ProjectUpdateFormData>({
    resolver: zodResolver(projectUpdateSchema),
    defaultValues: {
      name: '',
      description: '',
      vanity_slug: '',
      logo_url: '',
      banner_url: '',
      website_url: '',
      social_links: {
        twitter: '',
        github: '',
        discord: '',
        telegram: '',
      }
    }
  });

  // Update form when project data loads
  useEffect(() => {
    if (project) {
      const socialLinks = typeof project.social_links === 'object' && project.social_links ? project.social_links : {};
      form.reset({
        name: project.name || '',
        description: project.description || '',
        vanity_slug: project.vanity_slug || '',
        logo_url: project.logo_url || '',
        banner_url: project.banner_url || '',
        website_url: project.website_url || '',
        social_links: {
          twitter: socialLinks?.twitter || '',
          github: socialLinks?.github || '',
          discord: socialLinks?.discord || '',
          telegram: socialLinks?.telegram || '',
        }
      });
    }
  }, [project, form]);

  // Update project mutation
  const updateProjectMutation = useMutation({
    mutationFn: async (data: ProjectUpdateFormData) => {
      return await apiRequest(`/api/devtools/projects/${projectId}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      toast({
        title: "Project Updated",
        description: "Your project has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/devtools/projects', projectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/devtools/projects'] });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.response?.data?.error || "Failed to update project",
        variant: "destructive",
      });
    }
  });

  const handleFormSubmit = (data: ProjectUpdateFormData) => {
    updateProjectMutation.mutate(data);
  };

  const handleCopyUrl = () => {
    if (project?.vanity_slug) {
      const url = `${window.location.origin}/project/${project.vanity_slug}`;
      navigator.clipboard.writeText(url);
      toast({
        title: "URL Copied",
        description: "Project URL copied to clipboard",
      });
    }
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return 'Unknown';
    return new Date(date).toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'inactive':
        return 'bg-red-500/10 text-red-600 border-red-500/20';
      default:
        return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
    }
  };

  if (authLoading || projectLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-400">Loading project...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Project Not Found</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              The project you're looking for doesn't exist or you don't have access to it.
            </p>
            <Button onClick={() => navigate('/devtools')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to DevTools
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <Button 
                variant="outline" 
                onClick={() => navigate('/devtools')}
                data-testid="back-to-devtools"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to DevTools
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white" data-testid="project-title">
                  {project.name}
                </h1>
                <p className="text-slate-600 dark:text-slate-400">
                  Project ID: {project.id}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Badge className={getStatusColor(project.status)} data-testid="project-status">
                {project.status}
              </Badge>
              {project.vanity_slug && (
                <Button variant="outline" onClick={handleCopyUrl} data-testid="copy-project-url">
                  <Copy className="w-4 h-4 mr-2" />
                  Copy URL
                </Button>
              )}
            </div>
          </div>

          {/* Project Quick Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Crown className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Type</p>
                    <p className="font-semibold">{project.projectType}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <Network className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Chains</p>
                    <p className="font-semibold">{chainConfigs.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <Users className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Owner</p>
                    <p className="font-semibold text-xs">
                      {project.ownerWalletAddress?.slice(0, 8)}...
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-orange-500/10 rounded-lg">
                    <CheckCircle2 className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Created</p>
                    <p className="font-semibold text-sm">{formatDate(project.createdAt)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="project-detail-tabs">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview" data-testid="overview-tab">Overview</TabsTrigger>
            <TabsTrigger value="settings" data-testid="settings-tab">Settings</TabsTrigger>
            <TabsTrigger value="chains" data-testid="chains-tab">Chains</TabsTrigger>
            {/* Conditional tabs based on project asset_type */}
            {project.asset_type === 'token' && (
              <TabsTrigger value="token-controls" data-testid="token-controls-tab">
                <Coins className="w-4 h-4 mr-1" />
                Token Controls
              </TabsTrigger>
            )}
            {project.asset_type === 'nft' && (
              <TabsTrigger value="nft-controls" data-testid="nft-controls-tab">
                <Paintbrush className="w-4 h-4 mr-1" />
                NFT Controls
              </TabsTrigger>
            )}
            <TabsTrigger value="services" data-testid="services-tab">
              <Zap className="w-4 h-4 mr-1" />
              Services
            </TabsTrigger>
            <TabsTrigger value="advanced" data-testid="advanced-tab">Advanced</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Project Information</CardTitle>
                  <CardDescription>Basic project details and metadata</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Description</Label>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      {project.description || 'No description provided'}
                    </p>
                  </div>
                  {project.vanity_slug && (
                    <div>
                      <Label className="text-sm font-medium">Public URL</Label>
                      <div className="flex items-center space-x-2 mt-1">
                        <code className="text-sm bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                          /project/{project.vanity_slug}
                        </code>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => window.open(`/project/${project.vanity_slug}`, '_blank')}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                  {project.website_url && (
                    <div>
                      <Label className="text-sm font-medium">Website</Label>
                      <div className="flex items-center space-x-2 mt-1">
                        <a 
                          href={project.website_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline"
                        >
                          {project.website_url}
                        </a>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Chain Configurations</CardTitle>
                  <CardDescription>Blockchain networks configured for this project</CardDescription>
                </CardHeader>
                <CardContent>
                  {chainConfigs.length === 0 ? (
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      No chain configurations set up yet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {chainConfigs.slice(0, 5).map((config, index: number) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded">
                          <div>
                            <p className="font-medium text-sm">{config.chainId}</p>
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                              {config.networkType}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {config.networkType}
                          </Badge>
                        </div>
                      ))}
                      {chainConfigs.length > 5 && (
                        <p className="text-xs text-slate-500">+{chainConfigs.length - 5} more chains</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Edit Project Settings</CardTitle>
                <CardDescription>Update your project information and settings</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Project Name *</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="project-name-input" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="vanity_slug"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>URL Slug</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                placeholder="my-project"
                                data-testid="vanity-slug-input"
                              />
                            </FormControl>
                            <FormDescription>
                              Will be available at: /project/{form.watch('vanity_slug') || 'your-slug'}
                            </FormDescription>
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
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea 
                              {...field} 
                              rows={3}
                              placeholder="Describe your project..."
                              data-testid="project-description-input"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="logo_url"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Logo URL</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                type="url"
                                placeholder="https://example.com/logo.png"
                                data-testid="logo-url-input"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="website_url"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Website URL</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                type="url"
                                placeholder="https://yourproject.com"
                                data-testid="website-url-input"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Social Links */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Social Links</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="social_links.twitter"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Twitter</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  placeholder="https://twitter.com/yourproject"
                                  data-testid="twitter-input"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="social_links.github"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>GitHub</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  placeholder="https://github.com/yourproject"
                                  data-testid="github-input"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => form.reset()}
                        disabled={updateProjectMutation.isPending}
                      >
                        Reset
                      </Button>
                      <Button
                        type="submit"
                        disabled={updateProjectMutation.isPending}
                        data-testid="save-project-button"
                      >
                        {updateProjectMutation.isPending ? (
                          <>
                            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            Save Changes
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Chains Tab */}
          <TabsContent value="chains" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Chain Configurations</CardTitle>
                <CardDescription>Manage blockchain network configurations for this project</CardDescription>
              </CardHeader>
              <CardContent>
                {chainConfigs.length === 0 ? (
                  <div className="text-center py-8">
                    <Network className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Chain Configurations</h3>
                    <p className="text-slate-600 dark:text-slate-400 mb-4">
                      Configure blockchain networks to deploy your project on multiple chains.
                    </p>
                    <Button data-testid="add-chain-config">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Chain Configuration
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {chainConfigs.map((config: any, index: number) => (
                      <Card key={index} className="border border-slate-200 dark:border-slate-700">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2">
                              <div className="flex items-center space-x-2">
                                <Badge variant="outline">{config.chainId}</Badge>
                                <h4 className="font-medium">{config.chainName}</h4>
                              </div>
                              <p className="text-sm text-slate-600 dark:text-slate-400">
                                Network: {config.networkType} • RPC: {config.rpcEndpoints?.[0] || 'Not configured'}
                              </p>
                            </div>
                            <Button variant="ghost" size="sm">
                              <Settings className="w-4 h-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Token Controls Tab - Only shown for token projects */}
          {project.asset_type === 'token' && (
            <TabsContent value="token-controls" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Token Management</CardTitle>
                  <CardDescription>Create and manage tokens across multiple blockchains</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Button 
                      className="h-32 flex flex-col items-center justify-center gap-3"
                      variant="outline"
                      onClick={() => navigate(`/devtools/project/${projectId}/token-creator`)}
                      data-testid="create-token-button"
                    >
                      <Rocket className="w-8 h-8" />
                      <div>
                        <p className="font-semibold">Create Token</p>
                        <p className="text-xs text-muted-foreground">Deploy on multiple chains</p>
                      </div>
                    </Button>
                    <Button 
                      className="h-32 flex flex-col items-center justify-center gap-3"
                      variant="outline"
                      onClick={() => navigate(`/devtools/project/${projectId}/airdrop`)}
                      data-testid="airdrop-tool-button"
                    >
                      <Gift className="w-8 h-8" />
                      <div>
                        <p className="font-semibold">Airdrop Tool</p>
                        <p className="text-xs text-muted-foreground">Distribute tokens</p>
                      </div>
                    </Button>
                    <Button 
                      className="h-32 flex flex-col items-center justify-center gap-3"
                      variant="outline"
                      onClick={() => navigate(`/devtools/project/${projectId}/snapshot-token`)}
                      data-testid="snapshot-token-button"
                    >
                      <Camera className="w-8 h-8" />
                      <div>
                        <p className="font-semibold">Snapshot Token</p>
                        <p className="text-xs text-muted-foreground">Capture holder data</p>
                      </div>
                    </Button>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Token Configurations</CardTitle>
                  <CardDescription>Manage your token deployments across different chains</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Token configuration management coming soon...</p>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* NFT Controls Tab - Only shown for NFT projects */}
          {project.asset_type === 'nft' && (
            <TabsContent value="nft-controls" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>NFT Collection Management</CardTitle>
                  <CardDescription>Create and manage NFT collections</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Button 
                      className="h-32 flex flex-col items-center justify-center gap-3"
                      variant="outline"
                      onClick={() => navigate(`/devtools/project/${projectId}/nft-creator`)}
                      data-testid="create-nft-button"
                    >
                      <Paintbrush className="w-8 h-8" />
                      <div>
                        <p className="font-semibold">Create NFT</p>
                        <p className="text-xs text-muted-foreground">Launch collections</p>
                      </div>
                    </Button>
                    <Button 
                      className="h-32 flex flex-col items-center justify-center gap-3"
                      variant="outline"
                      onClick={() => navigate(`/devtools/project/${projectId}/airdrop`)}
                      data-testid="nft-airdrop-button"
                    >
                      <Gift className="w-8 h-8" />
                      <div>
                        <p className="font-semibold">Airdrop NFTs</p>
                        <p className="text-xs text-muted-foreground">Distribute NFTs</p>
                      </div>
                    </Button>
                    <Button 
                      className="h-32 flex flex-col items-center justify-center gap-3"
                      variant="outline"
                      onClick={() => navigate(`/devtools/project/${projectId}/snapshot-nft`)}
                      data-testid="snapshot-nft-button"
                    >
                      <Camera className="w-8 h-8" />
                      <div>
                        <p className="font-semibold">Snapshot NFT</p>
                        <p className="text-xs text-muted-foreground">Capture holder data</p>
                      </div>
                    </Button>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>NFT Configurations</CardTitle>
                  <CardDescription>Manage your NFT collections across different chains</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">NFT configuration management coming soon...</p>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Services Tab */}
          <TabsContent value="services" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Project Services</CardTitle>
                <CardDescription>Manage services and integrations for your project</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { id: 'swap', name: 'Token Swaps', icon: Coins, description: 'Enable token trading' },
                    { id: 'staking', name: 'Staking', icon: Shield, description: 'Rewards for holders' },
                    { id: 'analytics', name: 'Analytics', icon: BarChart3, description: 'Track performance' },
                    { id: 'airdrops', name: 'Airdrops', icon: Gift, description: 'Mass distributions' },
                  ].map((service) => (
                    <div key={service.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <service.icon className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{service.name}</p>
                          <p className="text-xs text-muted-foreground">{service.description}</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        Configure
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Advanced Tab */}
          <TabsContent value="advanced" className="space-y-6">
            <Card className="border-red-200 dark:border-red-800">
              <CardHeader>
                <CardTitle className="text-red-600">Danger Zone</CardTitle>
                <CardDescription>Irreversible actions that affect your project</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                  <div>
                    <h4 className="font-medium text-red-900 dark:text-red-100">Delete Project</h4>
                    <p className="text-sm text-red-600 dark:text-red-400">
                      Permanently delete this project and all its data. This action cannot be undone.
                    </p>
                  </div>
                  <Button variant="destructive" data-testid="delete-project-button">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Project
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
