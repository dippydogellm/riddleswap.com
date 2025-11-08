import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { DevtoolsProject, ChainConfiguration } from '@shared/schema';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// API Response Types
interface LinkedWalletsResponse {
  wallets: Array<{
    id: string;
    address: string;
    chain: string;
    name?: string;
  }>;
}

interface UsageDataResponse {
  apiCalls: number;
  dataTransfer: string;
  computeTime: string;
}

interface MetricsDataResponse {
  avgResponseTime: string;
  uptime: string;
}

// UI Components
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

// Icons
import { 
  ArrowLeft, Plus, Search, Filter, Settings, ExternalLink, 
  Wallet, Code2, Zap, Globe, Users, TrendingUp, Activity, 
  Coins, Image, Gift, Camera, Download, Monitor, ChevronRight,
  AlertCircle, CheckCircle2, Clock, Pause, Play, Eye, 
  BarChart3, DollarSign, Wrench, Link2, Star, RefreshCw,
  FolderPlus, Crown, Database, Shield, Calendar, Hash,
  Upload, FileImage, Layers, Hammer
} from 'lucide-react';

// Schemas
const projectCreateSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100, 'Name must be less than 100 characters'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  projectType: z.enum(['new', 'imported'], { required_error: 'Please select a project type' }),
  selectedChains: z.array(z.string()).min(1, 'Select at least one blockchain'),
  vanity_slug: z.string()
    .min(3, 'URL must be at least 3 characters')
    .max(50, 'URL must be less than 50 characters')
    .regex(/^[a-z0-9-]+$/, 'URL can only contain lowercase letters, numbers, and hyphens')
    .optional(),
  issuer_wallet: z.string().optional(),
  nft_token_taxon: z.number().min(0).optional(),
  website_url: z.string().url('Invalid website URL').optional().or(z.literal('')),
});

type ProjectCreateForm = z.infer<typeof projectCreateSchema>;

// XRPL NFT Launch Wizard Component
function XRPLNFTLaunchWizard() {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [metadataTemplate, setMetadataTemplate] = useState({
    name: '',
    description: '',
    image: '',
    external_url: '',
    attributes: []
  });
  const [mintingJob, setMintingJob] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isMinting, setIsMinting] = useState(false);

  const handleFileUpload = async (files: FileList) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append('files', file);
      });

      const response = await fetch('/api/ipfs/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to upload files');
      }

      const result = await response.json() as any;
      setUploadedFiles(result.files);
      
      toast({
        title: "Files uploaded successfully!",
        description: `Uploaded ${result.files.length} files to IPFS`,
      });

      setCurrentStep(2);
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload files",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleMetadataSubmit = async () => {
    try {
      // Upload metadata template
      const response = await fetch('/api/ipfs/metadata', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
        },
        body: JSON.stringify({
          metadata: metadataTemplate,
          type: 'collection'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to upload metadata');
      }

      const result = await response.json() as any;
      
      toast({
        title: "Metadata uploaded!",
        description: "Collection metadata stored on IPFS",
      });

      setCurrentStep(3);
    } catch (error) {
      toast({
        title: "Metadata upload failed",
        description: error instanceof Error ? error.message : "Failed to upload metadata",
        variant: "destructive",
      });
    }
  };

  const handleStartMinting = async () => {
    setIsMinting(true);
    try {
      // Create batch mint job
      const mintItems = uploadedFiles.map((file, index) => ({
        uri: file.ipfsUrl,
        name: `${metadataTemplate.name} #${index + 1}`
      }));

      const response = await fetch('/api/xrpl/nft/mint/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
        },
        body: JSON.stringify({
          items: mintItems,
          taxon: Math.floor(Math.random() * 0xFFFFFFFF), // Random taxon for demo
          flags: 8, // Transferable
          transferFee: 500, // 5% royalty
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create mint job');
      }

      const result = await response.json() as any;
      setMintingJob(result);
      
      toast({
        title: "Mint job created!",
        description: `Ready to mint ${mintItems.length} NFTs`,
      });

      setCurrentStep(4);
    } catch (error) {
      toast({
        title: "Minting failed",
        description: error instanceof Error ? error.message : "Failed to start minting",
        variant: "destructive",
      });
    } finally {
      setIsMinting(false);
    }
  };

  const WizardStep = ({ stepNumber, title, isActive, isCompleted }: {
    stepNumber: number;
    title: string;
    isActive: boolean;
    isCompleted: boolean;
  }) => (
    <div className={`flex items-center space-x-3 ${isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-400'}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
        isActive ? 'border-blue-600 bg-blue-50' : 
        isCompleted ? 'border-green-600 bg-green-50' : 
        'border-gray-300 bg-gray-50'
      }`}>
        {isCompleted ? (
          <CheckCircle2 className="w-4 h-4" />
        ) : (
          <span className="text-sm font-medium">{stepNumber}</span>
        )}
      </div>
      <span className="font-medium">{title}</span>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto">
          <Image className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          XRPL NFT Launch Wizard
        </h1>
        <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
          Launch your NFT collection on the XRPL network with built-in IPFS storage, metadata management, and seamless minting.
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex justify-center">
        <div className="flex space-x-8">
          <WizardStep stepNumber={1} title="Upload Assets" isActive={currentStep === 1} isCompleted={currentStep > 1} />
          <WizardStep stepNumber={2} title="Configure Metadata" isActive={currentStep === 2} isCompleted={currentStep > 2} />
          <WizardStep stepNumber={3} title="Review & Mint" isActive={currentStep === 3} isCompleted={currentStep > 3} />
          <WizardStep stepNumber={4} title="Deploy Collection" isActive={currentStep === 4} isCompleted={currentStep > 4} />
        </div>
      </div>

      {/* Step Content */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Upload className="w-5 h-5 mr-2" />
              Upload Your NFT Assets
            </CardTitle>
            <CardDescription>
              Upload images, videos, or other media files for your NFT collection. Each file will become an individual NFT.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <FileImage className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <div className="space-y-2">
                <p className="text-lg font-medium">Drop your files here</p>
                <p className="text-gray-500">Or click to browse and select files</p>
              </div>
              <Input
                type="file"
                multiple
                accept="image/*,video/*,audio/*"
                onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                className="mt-4 cursor-pointer"
                disabled={isUploading}
                data-testid="file-upload-input"
              />
            </div>
            
            {isUploading && (
              <div className="flex items-center justify-center space-x-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Uploading to IPFS...</span>
              </div>
            )}

            {uploadedFiles.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-medium">Uploaded Files ({uploadedFiles.length})</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {uploadedFiles.slice(0, 8).map((file, index) => (
                    <div key={index} className="border rounded-lg p-3 space-y-2">
                      <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
                        <FileImage className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="text-xs text-gray-600 truncate">{file.originalName}</p>
                      <Badge variant="outline" className="text-xs">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </Badge>
                    </div>
                  ))}
                  {uploadedFiles.length > 8 && (
                    <div className="border rounded-lg p-3 flex items-center justify-center">
                      <span className="text-sm text-gray-500">+{uploadedFiles.length - 8} more</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Layers className="w-5 h-5 mr-2" />
              Configure Collection Metadata
            </CardTitle>
            <CardDescription>
              Set up the metadata template for your NFT collection. This will be applied to all NFTs with individual variations.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="collection-name">Collection Name</Label>
                  <Input
                    id="collection-name"
                    placeholder="My Amazing Collection"
                    value={metadataTemplate.name}
                    onChange={(e) => setMetadataTemplate(prev => ({ ...prev, name: e.target.value }))}
                    data-testid="collection-name-input"
                  />
                </div>
                
                <div>
                  <Label htmlFor="collection-description">Description</Label>
                  <Textarea
                    id="collection-description"
                    placeholder="Describe your collection..."
                    value={metadataTemplate.description}
                    onChange={(e) => setMetadataTemplate(prev => ({ ...prev, description: e.target.value }))}
                    data-testid="collection-description-input"
                  />
                </div>
                
                <div>
                  <Label htmlFor="external-url">Website URL (Optional)</Label>
                  <Input
                    id="external-url"
                    placeholder="https://myproject.com"
                    value={metadataTemplate.external_url}
                    onChange={(e) => setMetadataTemplate(prev => ({ ...prev, external_url: e.target.value }))}
                    data-testid="external-url-input"
                  />
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="border rounded-lg p-4 bg-slate-50 dark:bg-slate-800">
                  <h3 className="font-medium mb-2">Preview</h3>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium">Name:</span> {metadataTemplate.name || 'Untitled Collection'}</p>
                    <p><span className="font-medium">Description:</span> {metadataTemplate.description || 'No description'}</p>
                    <p><span className="font-medium">Total NFTs:</span> {uploadedFiles.length}</p>
                    <p><span className="font-medium">Network:</span> XRPL</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3">
              <Button onClick={() => setCurrentStep(1)} variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button 
                onClick={handleMetadataSubmit}
                disabled={!metadataTemplate.name}
                data-testid="next-to-review-button"
              >
                Next: Review & Mint
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Eye className="w-5 h-5 mr-2" />
              Review & Start Minting
            </CardTitle>
            <CardDescription>
              Review your collection details and start the minting process on XRPL.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="font-semibold">Collection Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Collection Name:</span>
                    <span className="font-medium">{metadataTemplate.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total NFTs:</span>
                    <span className="font-medium">{uploadedFiles.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Network:</span>
                    <span className="font-medium">XRPL</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Royalty Fee:</span>
                    <span className="font-medium">5%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Transferable:</span>
                    <span className="font-medium">Yes</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <h3 className="font-semibold">Estimated Costs</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>IPFS Storage:</span>
                    <span className="font-medium text-green-600">Free</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Minting Fees:</span>
                    <span className="font-medium">~{(uploadedFiles.length * 0.0001).toFixed(4)} XRP</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Reserve (0.2 XRP/NFT):</span>
                    <span className="font-medium">{(uploadedFiles.length * 0.2).toFixed(1)} XRP</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-medium">
                    <span>Total Estimated:</span>
                    <span>~{(uploadedFiles.length * 0.2001).toFixed(1)} XRP</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Important Notes</p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    • This will create NFTs on XRPL mainnet
                    • Each NFT requires a 0.2 XRP reserve that gets locked
                    • You'll need to sign transactions using your XRPL wallet
                    • The process cannot be reversed once started
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3">
              <Button onClick={() => setCurrentStep(2)} variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button 
                onClick={handleStartMinting}
                disabled={isMinting}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                data-testid="start-minting-button"
              >
                {isMinting ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Preparing Mint...
                  </>
                ) : (
                  <>
                    <Hammer className="w-4 h-4 mr-2" />
                    Start Minting Process
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 4 && mintingJob && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CheckCircle2 className="w-5 h-5 mr-2 text-green-600" />
              Minting Job Ready
            </CardTitle>
            <CardDescription>
              Your NFT collection is ready for deployment. Connect your XRPL wallet to sign and submit transactions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-200">Mint Job Created Successfully!</p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Job ID: {mintingJob.jobId} • {mintingJob.total} NFTs ready for minting
                  </p>
                </div>
              </div>
            </div>

            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center mx-auto">
                <Hammer className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold">Ready to Deploy!</h3>
              <p className="text-slate-600 dark:text-slate-400">
                Connect your XRPL wallet to sign and submit the {mintingJob.total} minting transactions.
              </p>
            </div>

            <div className="flex gap-3 justify-center">
              <Button 
                onClick={() => window.open('/xrp-wallet', '_blank')}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                data-testid="connect-wallet-button"
              >
                <Wallet className="w-4 h-4 mr-2" />
                Connect XRPL Wallet
              </Button>
              <Button 
                onClick={() => {
                  setCurrentStep(1);
                  setUploadedFiles([]);
                  setMetadataTemplate({ name: '', description: '', image: '', external_url: '', attributes: [] });
                  setMintingJob(null);
                }}
                variant="outline"
                data-testid="start-new-collection-button"
              >
                Start New Collection
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function DeveloperDashboard() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoading, user } = useAuth();
  const queryClient = useQueryClient();
  
  // State management
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<DevtoolsProject | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Form setup
  const projectForm = useForm<ProjectCreateForm>({
    resolver: zodResolver(projectCreateSchema),
    defaultValues: {
      projectType: 'new',
      selectedChains: [],
      description: '',
      vanity_slug: '',
      website_url: '',
    }
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Authentication Required",
        description: "You need to be logged in to access the Developer Dashboard. Redirecting to login...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/wallet-login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  // Available blockchains
  const supportedChains = [
    { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', icon: '⟠', color: 'bg-gray-700' },
    { id: 'bsc', name: 'BSC', symbol: 'BNB', icon: '🟡', color: 'bg-yellow-500' },
    { id: 'polygon', name: 'Polygon', symbol: 'MATIC', icon: '🟣', color: 'bg-purple-600' },
    { id: 'base', name: 'Base', symbol: 'ETH', icon: '🔵', color: 'bg-blue-600' },
    { id: 'arbitrum', name: 'Arbitrum', symbol: 'ETH', icon: '🔷', color: 'bg-blue-500' },
    { id: 'optimism', name: 'Optimism', symbol: 'ETH', icon: '🔴', color: 'bg-red-500' },
    { id: 'solana', name: 'Solana', symbol: 'SOL', icon: '🟢', color: 'bg-purple-500' },
    { id: 'xrpl', name: 'XRPL', symbol: 'XRP', icon: '🌊', color: 'bg-blue-400' },
    { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', icon: '₿', color: 'bg-orange-500' }
  ];

  // Data fetching
  const { data: projects = [], isLoading: projectsLoading, refetch: refetchProjects } = useQuery<DevtoolsProject[]>({
    queryKey: ['/api/devtools/projects'],
    enabled: isAuthenticated,
  });

  const { data: linkedWalletsData, refetch: refetchWallets } = useQuery<LinkedWalletsResponse>({
    queryKey: ['/api/devtools/wallets'],
    enabled: isAuthenticated && !!user?.walletAddress,
  });

  const { data: metricsData } = useQuery<MetricsDataResponse>({
    queryKey: ['/api/devtools/metrics'],
    enabled: isAuthenticated,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: usageData } = useQuery<UsageDataResponse>({
    queryKey: ['/api/devtools/usage'],
    enabled: isAuthenticated,
  });

  // Project creation mutation
  const createProjectMutation = useMutation({
    mutationFn: async (data: ProjectCreateForm): Promise<DevtoolsProject> => {
      const response = await apiRequest('/api/devtools/projects', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        throw new Error('Failed to create project');
      }
      return response.json();
    },
    onSuccess: (result: DevtoolsProject) => {
      toast({
        title: 'Project Created Successfully',
        description: `Project "${result.name}" has been created and is ready for development.`,
      });
      setIsCreateModalOpen(false);
      projectForm.reset();
      refetchProjects();
      // Navigate to project detail page
      navigate(`/devtools/project/${result.id}`);
    },
    onError: (error: any) => {
      toast({
        title: 'Project Creation Failed',
        description: error?.message || 'Failed to create project. Please try again.',
        variant: 'destructive'
      });
    }
  });

  // Show loading state
  if (isLoading || projectsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-400">Loading Developer Dashboard...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Filter projects
  const linkedWallets = linkedWalletsData?.wallets || [];
  const filteredProjects = projects.filter(project => {
    const matchesSearch = !searchQuery || 
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || project.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  // Helper functions
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'paused':
        return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'suspended':
        return 'bg-red-500/10 text-red-600 border-red-500/20';
      default:
        return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'paused':
        return <Pause className="w-4 h-4" />;
      case 'suspended':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return 'Unknown';
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        
        {/* Header Section */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/devtools')}
              className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to DevTools
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white" data-testid="dashboard-title">
                Developer Dashboard
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                Project Control Center - Manage your blockchain development projects
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <Button variant="outline" onClick={() => navigate('/devtools-dashboard')}>
              <Wrench className="w-4 h-4 mr-2" />
              Tools
            </Button>
            <Button onClick={() => setIsCreateModalOpen(true)} data-testid="create-project-button">
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
          </div>
        </div>

        {/* Dashboard Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <FolderPlus className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="total-projects">{projects.length}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Total Projects</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="active-projects">
                    {projects.filter(p => p.status === 'active').length}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Active Projects</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-purple-500/10 rounded-lg">
                  <Wallet className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="linked-wallets">{linkedWallets.length}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Linked Wallets</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-orange-500/10 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{usageData?.apiCalls || 0}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">API Calls</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" data-testid="overview-tab">
              <BarChart3 className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="projects" data-testid="projects-tab">
              <FolderPlus className="w-4 h-4 mr-2" />
              Projects
            </TabsTrigger>
            <TabsTrigger value="tools" data-testid="tools-tab">
              <Wrench className="w-4 h-4 mr-2" />
              Development Tools
            </TabsTrigger>
            <TabsTrigger value="analytics" data-testid="analytics-tab">
              <Activity className="w-4 h-4 mr-2" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="xrpl-nft" data-testid="xrpl-nft-tab" className="text-blue-600 dark:text-blue-400">
              <Image className="w-4 h-4 mr-2" />
              XRPL NFT Launch
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Recent Projects */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Clock className="w-5 h-5 mr-2" />
                    Recent Projects
                  </CardTitle>
                  <CardDescription>Your most recently updated projects</CardDescription>
                </CardHeader>
                <CardContent>
                  {projects.slice(0, 3).map((project) => (
                    <div 
                      key={project.id}
                      className="flex items-center justify-between py-3 border-b last:border-0 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 rounded px-2 -mx-2"
                      onClick={() => navigate(`/devtools/project/${project.id}`)}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-500/10 rounded flex items-center justify-center">
                          <FolderPlus className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium">{project.name}</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {project.selectedChains?.length || 0} chains
                          </p>
                        </div>
                      </div>
                      <Badge className={getStatusColor(project.status)}>
                        {getStatusIcon(project.status)}
                        <span className="ml-1">{project.status}</span>
                      </Badge>
                    </div>
                  ))}
                  {projects.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-slate-600 dark:text-slate-400 mb-4">No projects yet</p>
                      <Button onClick={() => setIsCreateModalOpen(true)} size="sm">
                        <Plus className="w-4 h-4 mr-2" />
                        Create Your First Project
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Zap className="w-5 h-5 mr-2" />
                    Quick Actions
                  </CardTitle>
                  <CardDescription>Common development tasks</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => navigate('/devtools/token-creator')}
                  >
                    <Coins className="w-4 h-4 mr-3" />
                    Create Token
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => navigate('/devtools/nft-creator')}
                  >
                    <Image className="w-4 h-4 mr-3" />
                    Deploy NFT Collection
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => navigate('/devtools/comprehensive-airdrop')}
                  >
                    <Gift className="w-4 h-4 mr-3" />
                    Launch Airdrop
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => navigate('/devtools/snapshot-token')}
                  >
                    <Camera className="w-4 h-4 mr-3" />
                    Take Snapshot
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-blue-200 dark:border-blue-700"
                    onClick={() => setActiveTab('xrpl-nft')}
                  >
                    <Image className="w-4 h-4 mr-3 text-blue-600" />
                    Launch XRPL NFT Collection
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* System Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Monitor className="w-5 h-5 mr-2" />
                  System Status
                </CardTitle>
                <CardDescription>Platform health and performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-sm">All Systems Operational</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-sm">API Response: {metricsData?.avgResponseTime || '~50ms'}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-sm">Uptime: {metricsData?.uptime || '99.9%'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Projects Tab */}
          <TabsContent value="projects" className="space-y-6">
            
            {/* Project Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search projects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-64"
                    data-testid="search-projects"
                  />
                </div>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-40">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => setIsCreateModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                New Project
              </Button>
            </div>

            {/* Projects Grid */}
            {filteredProjects.length === 0 ? (
              <Card className="border-2 border-dashed border-slate-300 dark:border-slate-600">
                <CardContent className="py-12 text-center">
                  <div className="mx-auto w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
                    <FolderPlus className="w-8 h-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">
                    {searchQuery || filterStatus !== 'all' ? 'No projects found' : 'No projects yet'}
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 mb-6">
                    {searchQuery || filterStatus !== 'all' 
                      ? 'No projects match your current filters.' 
                      : 'Create your first DevTools project to start building on blockchain.'
                    }
                  </p>
                  {!searchQuery && filterStatus === 'all' && (
                    <Button onClick={() => setIsCreateModalOpen(true)} data-testid="create-first-project">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Your First Project
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProjects.map((project) => (
                  <Card 
                    key={project.id}
                    className="hover:shadow-lg transition-all duration-200 cursor-pointer border hover:border-blue-500/50"
                    onClick={() => navigate(`/devtools/project/${project.id}`)}
                    data-testid={`project-card-${project.id}`}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg truncate flex items-center">
                            {project.logo_url ? (
                              <img src={project.logo_url} alt="" className="w-6 h-6 rounded mr-2" />
                            ) : (
                              <div className="w-6 h-6 bg-blue-500/10 rounded mr-2 flex items-center justify-center">
                                <FolderPlus className="w-3 h-3 text-blue-600" />
                              </div>
                            )}
                            {project.name}
                          </CardTitle>
                          {project.description && (
                            <CardDescription className="mt-1 line-clamp-2">{project.description}</CardDescription>
                          )}
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0 ml-2" />
                      </div>
                      
                      <div className="flex items-center space-x-2 mt-3">
                        <Badge variant="secondary" className="text-xs">
                          {project.projectType}
                        </Badge>
                        <Badge className={getStatusColor(project.status)}>
                          {getStatusIcon(project.status)}
                          <span className="ml-1">{project.status}</span>
                        </Badge>
                      </div>
                    </CardHeader>
                    
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-400">Blockchains</span>
                          <div className="flex items-center space-x-1">
                            {project.selectedChains?.slice(0, 3).map((chainId) => {
                              const chain = supportedChains.find(c => c.id === chainId);
                              return chain ? (
                                <div
                                  key={chainId}
                                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs text-white ${chain.color}`}
                                  title={chain.name}
                                >
                                  {chain.icon}
                                </div>
                              ) : null;
                            })}
                            {(project.selectedChains?.length || 0) > 3 && (
                              <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs">
                                +{(project.selectedChains?.length || 0) - 3}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-400">Created</span>
                          <span className="font-medium">{formatDate(project.createdAt)}</span>
                        </div>
                        
                        {project.vanity_slug && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-600 dark:text-slate-400">URL</span>
                            <code className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                              /{project.vanity_slug}
                            </code>
                          </div>
                        )}
                        
                        {project.website_url && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-600 dark:text-slate-400">Website</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-auto p-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (project.website_url) {
                                  window.open(project.website_url, '_blank');
                                }
                              }}
                            >
                              <ExternalLink className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Development Tools Tab */}
          <TabsContent value="tools" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Development Tools</CardTitle>
                <CardDescription>Access blockchain development tools for your projects</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { 
                      title: 'Token Creator', 
                      description: 'Deploy tokens across multiple blockchains',
                      icon: Coins,
                      route: '/devtools/token-creator',
                      color: 'blue'
                    },
                    { 
                      title: 'NFT Creator', 
                      description: 'Launch NFT collections with metadata',
                      icon: Image,
                      route: '/devtools/nft-creator',
                      color: 'purple'
                    },
                    { 
                      title: 'Airdrop Tool', 
                      description: 'Distribute tokens and NFTs efficiently',
                      icon: Gift,
                      route: '/devtools/comprehensive-airdrop',
                      color: 'green'
                    },
                    { 
                      title: 'Token Snapshot', 
                      description: 'Capture holder data for governance',
                      icon: Camera,
                      route: '/devtools/snapshot-token',
                      color: 'orange'
                    },
                    { 
                      title: 'NFT Snapshot', 
                      description: 'Track NFT ownership data',
                      icon: Download,
                      route: '/devtools/snapshot-nft',
                      color: 'red'
                    },
                    { 
                      title: 'Tools Dashboard', 
                      description: 'Access all development tools',
                      icon: Wrench,
                      route: '/devtools-dashboard',
                      color: 'gray'
                    }
                  ].map((tool) => {
                    const IconComponent = tool.icon;
                    return (
                      <Card 
                        key={tool.title}
                        className="hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => navigate(tool.route)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-3 mb-3">
                            <div className={`p-2 bg-${tool.color}-500/10 rounded-lg`}>
                              <IconComponent className={`w-5 h-5 text-${tool.color}-600`} />
                            </div>
                            <div>
                              <h3 className="font-semibold">{tool.title}</h3>
                            </div>
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400">{tool.description}</p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <BarChart3 className="w-5 h-5 mr-2" />
                    Usage Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span>API Calls This Month</span>
                      <span className="font-semibold">{usageData?.apiCalls || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Data Transfer</span>
                      <span className="font-semibold">{usageData?.dataTransfer || '0 MB'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Compute Time</span>
                      <span className="font-semibold">{usageData?.computeTime || '0 ms'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <TrendingUp className="w-5 h-5 mr-2" />
                    Project Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span>Projects Created This Month</span>
                      <span className="font-semibold">{projects.filter(p => {
                        const createdDate = new Date(p.createdAt || '');
                        const thisMonth = new Date();
                        return createdDate.getMonth() === thisMonth.getMonth() && 
                               createdDate.getFullYear() === thisMonth.getFullYear();
                      }).length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Most Active Chain</span>
                      <span className="font-semibold">
                        {(() => {
                          const chainCounts: Record<string, number> = {};
                          projects.forEach(p => {
                            p.selectedChains?.forEach(chain => {
                              chainCounts[chain] = (chainCounts[chain] || 0) + 1;
                            });
                          });
                          const mostActive = Object.entries(chainCounts).sort(([,a], [,b]) => b - a)[0];
                          return mostActive ? supportedChains.find(c => c.id === mostActive[0])?.name || mostActive[0] : 'None';
                        })()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Deployments</span>
                      <span className="font-semibold">{projects.reduce((acc, p) => acc + (p.selectedChains?.length || 0), 0)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* XRPL NFT Launch Tab */}
          <TabsContent value="xrpl-nft" className="space-y-6">
            <XRPLNFTLaunchWizard />
          </TabsContent>
        </Tabs>

        {/* Create Project Modal */}
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
              <DialogDescription>
                Set up a new blockchain development project with multi-chain support
              </DialogDescription>
            </DialogHeader>
            
            <Form {...projectForm}>
              <form onSubmit={projectForm.handleSubmit((data) => createProjectMutation.mutate(data))} className="space-y-6">
                
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Basic Information</h3>
                  
                  <FormField
                    control={projectForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Name</FormLabel>
                        <FormControl>
                          <Input placeholder="My Awesome Project" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={projectForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Describe your project..."
                            className="resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Optional description of your project (max 500 characters)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={projectForm.control}
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
                            <SelectItem value="new">New Project</SelectItem>
                            <SelectItem value="imported">Import Existing</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Choose whether to create a new project or import an existing one
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Blockchain Selection */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Blockchain Networks</h3>
                  
                  <FormField
                    control={projectForm.control}
                    name="selectedChains"
                    render={() => (
                      <FormItem>
                        <FormLabel>Select Blockchains</FormLabel>
                        <FormDescription>
                          Choose which blockchain networks your project will support
                        </FormDescription>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {supportedChains.map((chain) => (
                            <FormField
                              key={chain.id}
                              control={projectForm.control}
                              name="selectedChains"
                              render={({ field }) => {
                                return (
                                  <FormItem
                                    key={chain.id}
                                    className="flex flex-row items-start space-x-3 space-y-0"
                                  >
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value?.includes(chain.id)}
                                        onCheckedChange={(checked) => {
                                          return checked
                                            ? field.onChange([...field.value, chain.id])
                                            : field.onChange(
                                                field.value?.filter(
                                                  (value) => value !== chain.id
                                                )
                                              )
                                        }}
                                      />
                                    </FormControl>
                                    <FormLabel className="text-sm font-normal cursor-pointer">
                                      <div className="flex items-center space-x-2">
                                        <span className="text-lg">{chain.icon}</span>
                                        <div>
                                          <div className="font-medium">{chain.name}</div>
                                          <div className="text-xs text-slate-500">{chain.symbol}</div>
                                        </div>
                                      </div>
                                    </FormLabel>
                                  </FormItem>
                                )
                              }}
                            />
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Advanced Settings */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Advanced Settings</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={projectForm.control}
                      name="vanity_slug"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Custom URL</FormLabel>
                          <FormControl>
                            <div className="flex">
                              <span className="inline-flex items-center px-3 text-sm text-slate-500 bg-slate-50 border border-r-0 border-slate-300 rounded-l-md dark:bg-slate-800 dark:border-slate-600">
                                riddle.app/
                              </span>
                              <Input 
                                placeholder="my-project"
                                className="rounded-l-none"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormDescription>
                            Custom URL for your project (lowercase, numbers, hyphens only)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={projectForm.control}
                      name="website_url"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Website URL</FormLabel>
                          <FormControl>
                            <Input placeholder="https://yourproject.com" {...field} />
                          </FormControl>
                          <FormDescription>
                            Official website for your project
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {projectForm.watch('projectType') === 'imported' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={projectForm.control}
                        name="issuer_wallet"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Issuer Wallet Address</FormLabel>
                            <FormControl>
                              <Input placeholder="Wallet address that issued the tokens/NFTs" {...field} />
                            </FormControl>
                            <FormDescription>
                              The wallet address that controls this project
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={projectForm.control}
                        name="nft_token_taxon"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>NFT Token Taxon (XRPL)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number"
                                placeholder="0"
                                {...field}
                                onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                              />
                            </FormControl>
                            <FormDescription>
                              For XRPL NFT projects, specify the token taxon
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <Button 
                    type="submit" 
                    disabled={createProjectMutation.isPending}
                    className="flex-1"
                  >
                    {createProjectMutation.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Creating Project...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Project
                      </>
                    )}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsCreateModalOpen(false)}
                    disabled={createProjectMutation.isPending}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
