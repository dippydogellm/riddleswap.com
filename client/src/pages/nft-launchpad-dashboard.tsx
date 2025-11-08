import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Users, 
  DollarSign, 
  TrendingUp, 
  Eye,
  Settings,
  Calendar,
  Image,
  Zap,
  BarChart3
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface NFTProject {
  id: string;
  name: string;
  description: string;
  image: string;
  creator: string;
  creatorWallet: string;
  totalSupply: number;
  mintedSupply: number;
  mintPrice: number;
  status: 'upcoming' | 'live' | 'sold-out' | 'ended';
  startTime: string;
  endTime: string;
  category: string;
  verified: boolean;
  featured: boolean;
  royaltyPercentage: number;
  createdAt: string;
  revenue: number;
  uniqueHolders: number;
}

interface MintTransaction {
  id: string;
  projectId: string;
  walletAddress: string;
  quantity: number;
  totalPaid: number;
  txHash: string;
  timestamp: string;
  status: string;
}

export default function NFTLaunchpadDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [projects, setProjects] = useState<NFTProject[]>([]);
  const [mintTransactions, setMintTransactions] = useState<MintTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<NFTProject | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Form state for creating/editing projects
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    image: '',
    totalSupply: 1000,
    mintPrice: 10,
    category: 'art',
    startTime: '',
    endTime: '',
    royaltyPercentage: 5
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const riddleWallet = localStorage.getItem('riddleWallet');
      if (!riddleWallet) {
        toast({
          title: "Authentication Required",
          description: "Please connect your Riddle Wallet to access dashboard",
          variant: "destructive"
        });
        setLocation('/wallet-connect');
        return;
      }

      const walletData = JSON.parse(riddleWallet);
      
      // Fetch projects created by this wallet
      const projectsResponse = await fetch(`/api/nft/launchpad/dashboard/projects?walletAddress=${walletData.xrpAddress}`, {
        cache: 'no-cache'
      });
      
      if (projectsResponse.ok) {
        const projectsData = await projectsResponse.json();
        setProjects(projectsData.projects || []);
      }

      // Fetch mint transactions
      const transactionsResponse = await fetch(`/api/nft/launchpad/dashboard/transactions?walletAddress=${walletData.xrpAddress}`, {
        cache: 'no-cache'
      });
      
      if (transactionsResponse.ok) {
        const transactionsData = await transactionsResponse.json();
        setMintTransactions(transactionsData.transactions || []);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async () => {
    const riddleWallet = localStorage.getItem('riddleWallet');
    if (!riddleWallet) return;

    try {
      const walletData = JSON.parse(riddleWallet);
      
      const password = prompt('Enter your wallet password to create NFT project:');
      if (!password) return;

      const response = await fetch('/api/nft/launchpad/dashboard/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          creatorWallet: walletData.xrpAddress,
          password: password
        })
      });

      const data = await response.json() as any;
      if (data.success) {
        toast({
          title: "Project Created",
          description: `${formData.name} has been created successfully!`,
        });
        setIsCreateDialogOpen(false);
        setFormData({
          name: '',
          description: '',
          image: '',
          totalSupply: 1000,
          mintPrice: 10,
          category: 'art',
          startTime: '',
          endTime: '',
          royaltyPercentage: 5
        });
        fetchDashboardData();
      } else {
        toast({
          title: "Creation Failed",
          description: data.error || "Failed to create project",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create project",
        variant: "destructive"
      });
    }
  };

  const handleUpdateProject = async (projectId: string, updates: Partial<NFTProject>) => {
    const riddleWallet = localStorage.getItem('riddleWallet');
    if (!riddleWallet) return;

    try {
      const walletData = JSON.parse(riddleWallet);
      
      const password = prompt('Enter your wallet password to update project:');
      if (!password) return;

      const response = await fetch(`/api/nft/launchpad/dashboard/update/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...updates,
          walletAddress: walletData.xrpAddress,
          password: password
        })
      });

      const data = await response.json() as any;
      if (data.success) {
        toast({
          title: "Project Updated",
          description: "Project has been updated successfully!",
        });
        fetchDashboardData();
      } else {
        toast({
          title: "Update Failed",
          description: data.error || "Failed to update project",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update project",
        variant: "destructive"
      });
    }
  };

  const getTotalRevenue = () => {
    return Array.isArray(projects) ? projects.reduce((total, project) => total + (project.revenue || 0), 0) : 0;
  };

  const getTotalMints = () => {
    return Array.isArray(projects) ? projects.reduce((total, project) => total + project.mintedSupply, 0) : 0;
  };

  const getRecentTransactions = () => {
    return mintTransactions.slice(0, 5);
  };

  const ProjectCard = ({ project }: { project: NFTProject }) => (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">{project.name}</CardTitle>
            <p className="text-sm text-gray-600 mt-1">{project.category}</p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSelectedProject(project);
                setFormData({
                  name: project.name,
                  description: project.description,
                  image: project.image,
                  totalSupply: project.totalSupply,
                  mintPrice: project.mintPrice,
                  category: project.category,
                  startTime: project.startTime,
                  endTime: project.endTime,
                  royaltyPercentage: project.royaltyPercentage
                });
                setIsEditDialogOpen(true);
              }}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Badge variant={project.status === 'live' ? 'default' : 'secondary'}>
              {project.status}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Progress */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Minted</span>
              <span>{project.mintedSupply} / {project.totalSupply}</span>
            </div>
            <Progress value={(project.mintedSupply / project.totalSupply) * 100} />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Revenue</p>
              <p className="font-semibold">{(project.revenue || 0).toFixed(2)} XRP</p>
            </div>
            <div>
              <p className="text-gray-600">Mint Price</p>
              <p className="font-semibold">{project.mintPrice} XRP</p>
            </div>
            <div>
              <p className="text-gray-600">Holders</p>
              <p className="font-semibold">{project.uniqueHolders || 0}</p>
            </div>
            <div>
              <p className="text-gray-600">Royalty</p>
              <p className="font-semibold">{project.royaltyPercentage}%</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={() => setLocation(`/nft/project/${project.id}`)}
            >
              <Eye className="h-4 w-4 mr-1" />
              View
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={() => setLocation(`/nft/launchpad/analytics/${project.id}`)}
            >
              <BarChart3 className="h-4 w-4 mr-1" />
              Analytics
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen relative">
      <main className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 mt-16 sm:mt-20 relative z-0">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">Developer Dashboard</h1>
              <p className="text-gray-600">Manage your NFT projects and monitor performance</p>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Create Project
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New NFT Project</DialogTitle>
                  <DialogDescription>
                    Set up your NFT collection with minting parameters
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Project Name</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="My NFT Collection"
                      />
                    </div>
                    <div>
                      <Label htmlFor="category">Category</Label>
                      <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="art">Art</SelectItem>
                          <SelectItem value="gaming">Gaming</SelectItem>
                          <SelectItem value="music">Music</SelectItem>
                          <SelectItem value="utility">Utility</SelectItem>
                          <SelectItem value="pfp">PFP</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Describe your NFT collection..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="image">Collection Image URL</Label>
                    <Input
                      id="image"
                      value={formData.image}
                      onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                      placeholder="https://example.com/collection-image.jpg"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="totalSupply">Total Supply</Label>
                      <Input
                        id="totalSupply"
                        type="number"
                        value={formData.totalSupply}
                        onChange={(e) => setFormData({ ...formData, totalSupply: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="mintPrice">Mint Price (XRP)</Label>
                      <Input
                        id="mintPrice"
                        type="number"
                        step="0.1"
                        value={formData.mintPrice}
                        onChange={(e) => setFormData({ ...formData, mintPrice: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="startTime">Start Time</Label>
                      <Input
                        id="startTime"
                        type="datetime-local"
                        value={formData.startTime}
                        onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="endTime">End Time</Label>
                      <Input
                        id="endTime"
                        type="datetime-local"
                        value={formData.endTime}
                        onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="royalty">Royalty Percentage</Label>
                    <Input
                      id="royalty"
                      type="number"
                      min="0"
                      max="20"
                      step="0.5"
                      value={formData.royaltyPercentage}
                      onChange={(e) => setFormData({ ...formData, royaltyPercentage: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateProject}>Create Project</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Projects</p>
                    <p className="text-2xl font-bold">{projects.length}</p>
                  </div>
                  <Zap className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Mints</p>
                    <p className="text-2xl font-bold">{getTotalMints()}</p>
                  </div>
                  <Users className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Revenue</p>
                    <p className="text-2xl font-bold">{getTotalRevenue().toFixed(2)} XRP</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-yellow-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Active Projects</p>
                    <p className="text-2xl font-bold">{projects.filter(p => p.status === 'live').length}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Projects Grid */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Your Projects</h2>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="h-2 bg-gray-200 rounded"></div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="h-8 bg-gray-200 rounded"></div>
                        <div className="h-8 bg-gray-200 rounded"></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : projects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Zap className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Projects Yet</h3>
              <p className="text-gray-600 mb-6">Create your first NFT project to get started</p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Project
              </Button>
            </div>
          )}
        </div>

        {/* Recent Transactions */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Recent Mints</h2>
          <Card>
            <CardContent className="p-0">
              {getRecentTransactions().length > 0 ? (
                <div className="divide-y">
                  {getRecentTransactions().map((transaction) => (
                    <div key={transaction.id} className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium">
                          {projects.find(p => p.id === transaction.projectId)?.name || 'Unknown Project'}
                        </p>
                        <p className="text-sm text-gray-600">
                          {transaction.quantity} NFT(s) minted by {transaction.walletAddress.slice(0, 8)}...
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{transaction.totalPaid} XRP</p>
                        <p className="text-sm text-gray-600">
                          {new Date(transaction.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500">
                  No mint transactions yet
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Edit Project Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Project</DialogTitle>
              <DialogDescription>
                Update your NFT project settings
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {/* Same form fields as create dialog */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-name">Project Name</Label>
                  <Input
                    id="edit-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-category">Category</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="art">Art</SelectItem>
                      <SelectItem value="gaming">Gaming</SelectItem>
                      <SelectItem value="music">Music</SelectItem>
                      <SelectItem value="utility">Utility</SelectItem>
                      <SelectItem value="pfp">PFP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-mintPrice">Mint Price (XRP)</Label>
                  <Input
                    id="edit-mintPrice"
                    type="number"
                    step="0.1"
                    value={formData.mintPrice}
                    onChange={(e) => setFormData({ ...formData, mintPrice: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-royalty">Royalty Percentage</Label>
                  <Input
                    id="edit-royalty"
                    type="number"
                    min="0"
                    max="20"
                    step="0.5"
                    value={formData.royaltyPercentage}
                    onChange={(e) => setFormData({ ...formData, royaltyPercentage: Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => {
                if (selectedProject) {
                  handleUpdateProject(selectedProject.id, formData);
                  setIsEditDialogOpen(false);
                }
              }}>
                Update Project
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
