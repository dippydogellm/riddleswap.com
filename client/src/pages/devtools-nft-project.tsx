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
  Paintbrush, Palette, Sparkles, Package, Grid, Layers,
  Eye, Heart, ShoppingCart, Wand2, ImageIcon, FileImage
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

export default function DevToolsNFTProject() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [match, params] = useRoute<{ id: string }>('/devtools/nft/:id');
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('collection');

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
        title: "NFT Project Updated",
        description: "Your NFT collection has been successfully updated.",
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

  if (authLoading || projectLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 via-pink-50 to-indigo-50 dark:from-slate-950 dark:to-slate-900">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-400">Loading NFT collection...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !project || project.asset_type !== 'nft') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 via-pink-50 to-indigo-50 dark:from-slate-950 dark:to-slate-900">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">NFT Collection Not Found</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              The NFT collection you're looking for doesn't exist or you don't have access to it.
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
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-pink-50 to-indigo-50 dark:from-slate-950 dark:to-slate-900">
      {/* NFT Collection Hero Banner */}
      <div className="relative h-64 bg-gradient-to-br from-purple-600 via-pink-600 to-indigo-600 overflow-hidden">
        <div className="absolute inset-0 bg-black/20" />
        <div className="container mx-auto px-4 h-full flex items-center">
          <div className="relative z-10">
            <Button 
              variant="secondary" 
              size="sm"
              onClick={() => navigate('/devtools')}
              data-testid="back-to-devtools"
              className="mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to DevTools
            </Button>
            <div className="flex items-center gap-4 mb-2">
              <Badge className="bg-white/20 text-white border-white/30" data-testid="project-type-badge">
                <Paintbrush className="w-3 h-3 mr-1" />
                NFT COLLECTION
              </Badge>
              <Badge className="bg-green-500/20 text-green-300 border-green-400/30">
                ACTIVE
              </Badge>
            </div>
            <h1 className="text-5xl font-bold text-white mb-2" data-testid="nft-project-title">
              {project.name}
            </h1>
            <p className="text-white/90 text-lg">
              {project.description || 'A unique NFT collection bringing art to the blockchain'}
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* NFT Collection Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 -mt-16 mb-8 relative z-20">
          <Card className="bg-white dark:bg-slate-800 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Items</p>
                  <p className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    10,000
                  </p>
                </div>
                <Grid className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white dark:bg-slate-800 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Floor Price</p>
                  <p className="text-3xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
                    0.5 ETH
                  </p>
                </div>
                <ShoppingCart className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white dark:bg-slate-800 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Owners</p>
                  <p className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    3,542
                  </p>
                </div>
                <Users className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white dark:bg-slate-800 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Volume</p>
                  <p className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                    892 ETH
                  </p>
                </div>
                <Heart className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="nft-project-tabs">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="collection" data-testid="collection-tab">
              <Palette className="w-4 h-4 mr-1" />
              Collection
            </TabsTrigger>
            <TabsTrigger value="gallery" data-testid="gallery-tab">
              <ImageIcon className="w-4 h-4 mr-1" />
              Gallery
            </TabsTrigger>
            <TabsTrigger value="traits" data-testid="traits-tab">
              <Layers className="w-4 h-4 mr-1" />
              Traits
            </TabsTrigger>
            <TabsTrigger value="mint" data-testid="mint-tab">
              <Wand2 className="w-4 h-4 mr-1" />
              Mint
            </TabsTrigger>
            <TabsTrigger value="holders" data-testid="holders-tab">
              <Users className="w-4 h-4 mr-1" />
              Holders
            </TabsTrigger>
            <TabsTrigger value="marketplace" data-testid="marketplace-tab">
              <ShoppingCart className="w-4 h-4 mr-1" />
              Market
            </TabsTrigger>
            <TabsTrigger value="settings" data-testid="settings-tab">
              <Settings className="w-4 h-4 mr-1" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Collection Tab */}
          <TabsContent value="collection" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Collection Overview</CardTitle>
                  <CardDescription>Manage your NFT collection details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="aspect-video relative rounded-lg overflow-hidden bg-gradient-to-br from-purple-200 to-pink-200 dark:from-purple-900 dark:to-pink-900">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <FileImage className="w-16 h-16 mx-auto mb-4 text-white/50" />
                        <p className="text-white/70">Collection Banner</p>
                        <Button variant="secondary" size="sm" className="mt-2">
                          <Upload className="w-4 h-4 mr-2" />
                          Upload Banner
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Collection Name</Label>
                      <p className="text-lg font-semibold">{project.name}</p>
                    </div>
                    <div>
                      <Label>Symbol</Label>
                      <p className="text-lg font-semibold">NFT</p>
                    </div>
                    <div>
                      <Label>Total Supply</Label>
                      <p className="text-lg font-semibold">10,000</p>
                    </div>
                    <div>
                      <Label>Mint Price</Label>
                      <p className="text-lg font-semibold">0.08 ETH</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                  <CardDescription>NFT management tools</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <Button 
                      className="w-full justify-start"
                      variant="outline"
                      onClick={() => navigate(`/devtools/project/${projectId}/nft-creator`)}
                      data-testid="create-nft-button"
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Create Collection
                    </Button>
                    <Button 
                      className="w-full justify-start"
                      variant="outline"
                      onClick={() => navigate(`/devtools/project/${projectId}/nft-generator`)}
                      data-testid="generate-nft-button"
                    >
                      <Wand2 className="w-4 h-4 mr-2" />
                      Generate Art
                    </Button>
                    <Button 
                      className="w-full justify-start"
                      variant="outline"
                      onClick={() => navigate(`/devtools/project/${projectId}/snapshot-nft`)}
                      data-testid="snapshot-nft-button"
                    >
                      <Package className="w-4 h-4 mr-2" />
                      Snapshot Holders
                    </Button>
                    <Button 
                      className="w-full justify-start"
                      variant="outline"
                      onClick={() => navigate(`/devtools/project/${projectId}/whitelist`)}
                      data-testid="whitelist-button"
                    >
                      <Users className="w-4 h-4 mr-2" />
                      Manage Whitelist
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Gallery Tab */}
          <TabsContent value="gallery" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>NFT Gallery</CardTitle>
                <CardDescription>View and manage your NFT collection items</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                    <div key={i} className="group relative aspect-square rounded-lg overflow-hidden bg-gradient-to-br from-purple-400 to-pink-400 cursor-pointer hover:scale-105 transition-transform">
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-white opacity-0 group-hover:opacity-100 transition-opacity text-center">
                          <p className="font-bold">#{i}</p>
                          <p className="text-xs">View Details</p>
                        </div>
                      </div>
                      <div className="absolute top-2 right-2">
                        <Badge className="bg-white/90 text-black text-xs">
                          Rare
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-center mt-6">
                  <Button variant="outline">
                    Load More
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Traits Tab */}
          <TabsContent value="traits" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Collection Traits</CardTitle>
                <CardDescription>Manage rarity and attributes for your NFTs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {['Background', 'Body', 'Eyes', 'Mouth', 'Accessories'].map((trait) => (
                    <div key={trait} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{trait}</h4>
                        <Badge variant="outline">12 variations</Badge>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'].map((rarity) => (
                          <Badge key={rarity} variant="secondary" className="text-xs">
                            {rarity}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Mint Tab */}
          <TabsContent value="mint" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Minting Configuration</CardTitle>
                <CardDescription>Configure minting settings for your collection</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg">
                      <Label>Public Mint</Label>
                      <p className="text-2xl font-bold">0.08 ETH</p>
                      <p className="text-xs text-muted-foreground">Per NFT</p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <Label>Whitelist Mint</Label>
                      <p className="text-2xl font-bold">0.06 ETH</p>
                      <p className="text-xs text-muted-foreground">Early access price</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <Label>Max Per Wallet</Label>
                      <Input type="number" defaultValue="5" />
                    </div>
                    <div>
                      <Label>Mint Start Date</Label>
                      <Input type="datetime-local" />
                    </div>
                    <Button className="w-full">
                      <Wand2 className="w-4 h-4 mr-2" />
                      Start Minting
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Holders Tab */}
          <TabsContent value="holders" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>NFT Holders</CardTitle>
                <CardDescription>Track and manage collection holders</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500" />
                        <div>
                          <p className="font-medium">0x1234...5678</p>
                          <p className="text-sm text-muted-foreground">Owns {i * 2} NFTs</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        View Collection
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Marketplace Tab */}
          <TabsContent value="marketplace" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Marketplace Activity</CardTitle>
                <CardDescription>Recent sales and listings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 border rounded-lg">
                      <Label>Floor Price</Label>
                      <p className="text-2xl font-bold">0.5 ETH</p>
                      <p className="text-xs text-green-600">+12% this week</p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <Label>Total Volume</Label>
                      <p className="text-2xl font-bold">892 ETH</p>
                      <p className="text-xs text-muted-foreground">All time</p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <Label>Listed</Label>
                      <p className="text-2xl font-bold">324</p>
                      <p className="text-xs text-muted-foreground">Currently for sale</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Collection Settings</CardTitle>
                <CardDescription>Update your NFT collection information</CardDescription>
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
                            <FormLabel>Collection Name *</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="collection-name-input" />
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
                              <Input {...field} placeholder="my-nft-collection" data-testid="vanity-slug-input" />
                            </FormControl>
                            <FormDescription>
                              /collection/your-custom-url
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="logo_url"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Collection Logo URL</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="https://..." data-testid="logo-url-input" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="banner_url"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Collection Banner URL</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="https://..." data-testid="banner-url-input" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

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
                        data-testid="save-collection-button"
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
        </Tabs>
      </div>
    </div>
  );
}
