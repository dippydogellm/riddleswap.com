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
  Coins, Rocket, Shield, Zap, Gift, Camera, BarChart3,
  TrendingUp, Lock, DollarSign, Activity
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

export default function DevToolsTokenProject() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [match, params] = useRoute('/devtools/token/:id');
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
        title: "Token Project Updated",
        description: "Your token project has been successfully updated.",
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
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-purple-50 dark:from-slate-950 dark:to-slate-900">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-400">Loading token project...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !project || project.asset_type !== 'token') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-purple-50 dark:from-slate-950 dark:to-slate-900">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Token Project Not Found</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              The token project you're looking for doesn't exist or you don't have access to it.
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
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-purple-50 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Token Project Header */}
        <div className="mb-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-8 text-white">
          <div className="flex items-center justify-between mb-4">
            <Button 
              variant="secondary" 
              onClick={() => navigate('/devtools')}
              data-testid="back-to-devtools"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to DevTools
            </Button>
            <Badge className="bg-white/20 text-white border-white/30" data-testid="project-type-badge">
              <Coins className="w-3 h-3 mr-1" />
              TOKEN PROJECT
            </Badge>
          </div>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2" data-testid="token-project-title">
                {project.name}
              </h1>
              <p className="text-white/80">
                {project.description || 'A revolutionary token project on multiple blockchains'}
              </p>
              <p className="text-sm text-white/60 mt-2">
                Project ID: {project.id}
              </p>
            </div>
            <Badge className={`${getStatusColor(project.status)} !text-white !border-white/20`} data-testid="project-status">
              {project.status}
            </Badge>
          </div>
        </div>

        {/* Token Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/80 text-sm">Total Supply</p>
                  <p className="font-bold text-2xl">1B</p>
                </div>
                <DollarSign className="w-8 h-8 text-white/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/80 text-sm">Chains</p>
                  <p className="font-bold text-2xl">{chainConfigs.length}</p>
                </div>
                <Network className="w-8 h-8 text-white/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/80 text-sm">Holders</p>
                  <p className="font-bold text-2xl">12.5K</p>
                </div>
                <Users className="w-8 h-8 text-white/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/80 text-sm">Market Cap</p>
                  <p className="font-bold text-2xl">$5.2M</p>
                </div>
                <TrendingUp className="w-8 h-8 text-white/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="token-project-tabs">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="overview" data-testid="overview-tab">Overview</TabsTrigger>
            <TabsTrigger value="tokenomics" data-testid="tokenomics-tab">Tokenomics</TabsTrigger>
            <TabsTrigger value="deploy" data-testid="deploy-tab">Deploy</TabsTrigger>
            <TabsTrigger value="airdrop" data-testid="airdrop-tab">Airdrop</TabsTrigger>
            <TabsTrigger value="liquidity" data-testid="liquidity-tab">Liquidity</TabsTrigger>
            <TabsTrigger value="settings" data-testid="settings-tab">Settings</TabsTrigger>
            <TabsTrigger value="analytics" data-testid="analytics-tab">Analytics</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Token Information</CardTitle>
                  <CardDescription>Core token details and metadata</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Token Name</Label>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        {project.name}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Symbol</Label>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        TKN
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Decimals</Label>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        18
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Created</Label>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        {formatDate(project.createdAt)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                  <CardDescription>Manage your token project</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    <Button 
                      variant="outline"
                      onClick={() => navigate(`/devtools/project/${projectId}/token-creator`)}
                      data-testid="create-token-button"
                    >
                      <Rocket className="w-4 h-4 mr-2" />
                      Create Token
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => navigate(`/devtools/project/${projectId}/airdrop`)}
                      data-testid="airdrop-button"
                    >
                      <Gift className="w-4 h-4 mr-2" />
                      Airdrop
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => navigate(`/devtools/project/${projectId}/snapshot-token`)}
                      data-testid="snapshot-button"
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      Snapshot
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => navigate(`/devtools/project/${projectId}/market-maker`)}
                      data-testid="market-maker-button"
                    >
                      <Activity className="w-4 h-4 mr-2" />
                      Market Maker
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tokenomics Tab */}
          <TabsContent value="tokenomics" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Tokenomics</CardTitle>
                <CardDescription>Token distribution and allocation</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground">Team Allocation</p>
                      <p className="text-2xl font-bold">15%</p>
                      <p className="text-xs text-muted-foreground">Vested over 2 years</p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground">Community Rewards</p>
                      <p className="text-2xl font-bold">40%</p>
                      <p className="text-xs text-muted-foreground">Distributed via airdrops</p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground">Liquidity Pool</p>
                      <p className="text-2xl font-bold">30%</p>
                      <p className="text-xs text-muted-foreground">DEX liquidity provision</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Deploy Tab */}
          <TabsContent value="deploy" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Deploy Token</CardTitle>
                <CardDescription>Deploy your token to multiple blockchains</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {['Ethereum', 'BSC', 'Polygon', 'Solana', 'XRPL', 'Base'].map((chain) => (
                      <div key={chain} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-medium">{chain}</span>
                          <Badge variant="outline" className="text-xs">Not Deployed</Badge>
                        </div>
                        <Button className="w-full" size="sm">
                          Deploy on {chain}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Airdrop Tab */}
          <TabsContent value="airdrop" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Airdrop Management</CardTitle>
                <CardDescription>Distribute tokens to your community</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Gift className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Active Airdrops</h3>
                  <p className="text-muted-foreground mb-4">
                    Create an airdrop campaign to distribute tokens to your holders
                  </p>
                  <Button onClick={() => navigate(`/devtools/project/${projectId}/airdrop`)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Airdrop
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Liquidity Tab */}
          <TabsContent value="liquidity" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Liquidity Management</CardTitle>
                <CardDescription>Manage liquidity pools across DEXs</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Liquidity pool management coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Project Settings</CardTitle>
                <CardDescription>Update your token project information</CardDescription>
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
                            <FormLabel>Custom URL</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="my-token" data-testid="vanity-slug-input" />
                            </FormControl>
                            <FormDescription>
                              /project/your-custom-url
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
                            <Textarea {...field} rows={3} data-testid="description-input" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end space-x-4 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => form.reset()}
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

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Token Analytics</CardTitle>
                <CardDescription>Track your token's performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Analytics Dashboard</h3>
                  <p className="text-muted-foreground">
                    Detailed analytics and charts coming soon...
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
