import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Search, Plus, Clock, Users, Zap, Star, ExternalLink } from 'lucide-react';

interface NFTProject {
  id: string;
  name: string;
  description: string;
  image: string;
  creator: string;
  totalSupply: number;
  mintedSupply: number;
  mintPrice: number;
  status: 'upcoming' | 'live' | 'sold-out' | 'ended';
  startTime: string;
  endTime: string;
  category: string;
  verified: boolean;
  featured: boolean;
}

export default function NFTLaunchpad() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [projects, setProjects] = useState<NFTProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = ['all', 'art', 'gaming', 'music', 'utility', 'pfp'];

  useEffect(() => {
    fetchNFTProjects();
  }, [selectedCategory]);

  const fetchNFTProjects = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/nft/launchpad/projects?category=${selectedCategory}&search=${encodeURIComponent(searchQuery)}&t=${Date.now()}`, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      
      if (response.ok) {
        const data = await response.json() as any;
        setProjects(data.projects || []);
      }
    } catch (error) {
      console.error('Error fetching NFT projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    await fetchNFTProjects();
  };

  const handleMintNFT = async (project: NFTProject) => {
    const riddleWallet = localStorage.getItem('riddleWallet');
    if (!riddleWallet) {
      toast({
        title: "Wallet Required",
        description: "Please connect your Riddle Wallet to mint NFTs",
        variant: "destructive"
      });
      return;
    }

    try {
      const walletData = JSON.parse(riddleWallet);
      
      // Calculate total with any platform fees
      const platformFee = project.mintPrice * 0.025; // 2.5% platform fee
      const totalAmount = project.mintPrice + platformFee;
      
      // Prompt for password and quantity
      const quantity = prompt(`Mint ${project.name} NFTs\n\nMint Price: ${project.mintPrice} XRP each\nPlatform Fee: ${platformFee.toFixed(6)} XRP (2.5%)\nTotal: ${totalAmount.toFixed(6)} XRP\n\nHow many NFTs would you like to mint? (1-10):`);
      
      if (!quantity || isNaN(Number(quantity)) || Number(quantity) < 1 || Number(quantity) > 10) {
        toast({
          title: "Invalid Quantity",
          description: "Please enter a valid quantity between 1 and 10",
          variant: "destructive"
        });
        return;
      }

      const password = prompt(`Confirm minting ${quantity} ${project.name} NFT(s)\n\nTotal Cost: ${(totalAmount * Number(quantity)).toFixed(6)} XRP\n\nEnter your wallet password:`);
      
      if (!password) {
        return; // User cancelled
      }

      const response = await fetch('/api/nft/launchpad/mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          walletAddress: walletData.xrpAddress,
          walletHandle: walletData.handle,
          quantity: Number(quantity),
          password: password
        })
      });

      const data = await response.json() as any;
      if (data.success) {
        toast({
          title: "Mint Successful",
          description: `Successfully minted ${quantity} ${project.name} NFT(s)! Transaction: ${data.txHash}`,
        });
        // Refresh projects to update minted count
        fetchNFTProjects();
      } else {
        toast({
          title: "Mint Failed",
          description: data.error || "Failed to mint NFT",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process mint request",
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      'upcoming': { variant: 'secondary' as const, text: 'Upcoming' },
      'live': { variant: 'default' as const, text: 'Live' },
      'sold-out': { variant: 'destructive' as const, text: 'Sold Out' },
      'ended': { variant: 'outline' as const, text: 'Ended' }
    };
    const config = variants[status as keyof typeof variants] || variants.upcoming;
    return <Badge variant={config.variant}>{config.text}</Badge>;
  };

  const getMintProgress = (project: NFTProject) => {
    return (project.mintedSupply / project.totalSupply) * 100;
  };

  const ProjectCard = ({ project }: { project: NFTProject }) => (
    <Card className="hover:shadow-xl transition-all duration-300 cursor-pointer group">
      <CardHeader className="p-0">
        <div className="relative overflow-hidden">
          <img
            src={project.image}
            alt={project.name}
            className="w-full h-64 object-cover group-hover:scale-110 transition-transform duration-300"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = '/api/placeholder/400/300?text=NFT+Project';
            }}
          />
          <div className="absolute top-2 left-2 flex gap-2">
            {project.featured && (
              <Badge variant="destructive">
                <Star className="h-3 w-3 mr-1" />
                Featured
              </Badge>
            )}
            {project.verified && (
              <Badge variant="secondary">
                <Zap className="h-3 w-3 mr-1" />
                Verified
              </Badge>
            )}
          </div>
          <div className="absolute top-2 right-2">
            {getStatusBadge(project.status)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="mb-3">
          <CardTitle className="text-lg line-clamp-1 flex items-center gap-2">
            {project.name}
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                setLocation(`/nft/project/${project.id}`);
              }}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </CardTitle>
          <p className="text-sm text-gray-600 line-clamp-2">
            {project.description}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            by {project.creator}
          </p>
        </div>

        {/* Mint Progress */}
        <div className="mb-3">
          <div className="flex justify-between text-sm mb-1">
            <span>Minted</span>
            <span>{project.mintedSupply} / {project.totalSupply}</span>
          </div>
          <Progress value={getMintProgress(project)} className="h-2" />
        </div>

        {/* Pricing and Actions */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">Mint Price</p>
            <p className="font-bold text-lg">{project.mintPrice} XRP</p>
          </div>
          
          {project.status === 'live' && project.mintedSupply < project.totalSupply ? (
            <Button 
              onClick={(e) => {
                e.stopPropagation();
                handleMintNFT(project);
              }}
              className="flex items-center gap-2"
            >
              <Zap className="h-4 w-4" />
              Mint Now
            </Button>
          ) : project.status === 'upcoming' ? (
            <Button variant="outline" disabled>
              <Clock className="h-4 w-4 mr-1" />
              Soon
            </Button>
          ) : project.status === 'sold-out' ? (
            <Button variant="destructive" disabled>
              Sold Out
            </Button>
          ) : (
            <Button variant="outline" disabled>
              Ended
            </Button>
          )}
        </div>

        {/* Time info */}
        <div className="mt-3 text-xs text-gray-500">
          {project.status === 'upcoming' && (
            <p>Starts: {new Date(project.startTime).toLocaleString()}</p>
          )}
          {project.status === 'live' && (
            <p>Ends: {new Date(project.endTime).toLocaleString()}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen relative bg-white dark:bg-gray-900">
      <main className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 mt-16 sm:mt-20 relative z-0 text-gray-900 dark:text-white">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2 text-gray-900 dark:text-white">NFT Launchpad</h1>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                Discover and mint exclusive NFT collections
              </p>
            </div>
            <Button 
              onClick={() => setLocation('/nft/launchpad/create')}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Create Project
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="flex-1 flex gap-2">
              <Input
                placeholder="Search NFT projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1"
              />
              <Button onClick={handleSearch} variant="outline">
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Category Filters */}
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className="capitalize"
              >
                {category}
              </Button>
            ))}
          </div>
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <div className="h-64 bg-gray-200"></div>
                <CardContent className="p-4">
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded mb-3"></div>
                  <div className="h-2 bg-gray-200 rounded mb-4"></div>
                  <div className="flex justify-between">
                    <div className="h-8 bg-gray-200 rounded w-20"></div>
                    <div className="h-8 bg-gray-200 rounded w-24"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Users className="h-16 w-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Projects Found</h3>
            <p className="text-gray-600 mb-6">
              {searchQuery ? 'Try adjusting your search terms.' : 'No NFT projects match your criteria.'}
            </p>
            <Button onClick={() => setLocation('/nft/launchpad/create')}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Project
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
