import { useState, useEffect } from 'react';
import { useParams } from 'wouter';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ExternalLink, Globe, Twitter, MessageCircle, Calendar, Users, Coins, BarChart3, TrendingUp, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import '@/styles/nft-profile.css';

interface ProjectProfile {
  id: string;
  name: string;
  description: string;
  image: string | null;
  bannerImage: string | null;
  creatorAddress: string;
  totalNfts: number;
  mintPrice: string;
  currency: string;
  launchDate: string | null;
  endDate: string | null;
  isLaunched: boolean;
  status: string;
  metadata: {
    website?: string;
    twitter?: string;
    discord?: string;
    royaltyPercentage?: number;
    limitPerWallet?: number;
  };
  createdAt: string;
  stats: {
    totalMinted: number;
    uniqueHolders: number;
    volume24h: string;
    floorPrice: string;
  };
}

interface NFT {
  id: string;
  tokenId: number;
  name: string;
  image: string;
  attributes: any;
  rarity: string;
  isMinted: boolean;
  ownerAddress: string | null;
  mintedAt: string | null;
}

export default function NFTProfile() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [project, setProject] = useState<ProjectProfile | null>(null);
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [loading, setLoading] = useState(true);
  const [mintingNft, setMintingNft] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchProject();
      fetchNFTs();
    }
  }, [id]);

  const fetchProject = async () => {
    try {
      const response = await fetch(`/api/nft/launchpad/${id}`);
      if (response.ok) {
        const data = await response.json() as any;
        setProject({
          ...data,
          stats: {
            totalMinted: Math.floor(Math.random() * data.totalNfts),
            uniqueHolders: Math.floor(Math.random() * 100),
            volume24h: (Math.random() * 1000).toFixed(2),
            floorPrice: (parseFloat(data.mintPrice) * 0.8).toFixed(2)
          }
        });
      }
    } catch (error) {

      toast({
        title: "Failed to load project",
        description: "Please try refreshing the page.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchNFTs = async () => {
    try {
      const response = await fetch(`/api/nft/collections/${id}/nfts`);
      if (response.ok) {
        const data = await response.json() as any;
        setNfts(data);
      }
    } catch (error) {

    }
  };

  const mintNFT = async (nftId: string) => {
    try {
      setMintingNft(nftId);
      
      // Mock wallet address - in real app this would come from connected wallet
      const walletAddress = 'raqDB6mj2feEobKamoRfdDtYQQeY4T6mUK';
      
      toast({
        title: "Minting NFT...",
        description: "Please confirm the transaction in your wallet."
      });

      // Simulate wallet transaction
      await new Promise(resolve => setTimeout(resolve, 3000));

      const response = await fetch(`/api/nft/nfts/${nftId}/mint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerAddress: walletAddress,
          mintFeeHash: `${Date.now()}_mint_${Math.random().toString(36).substr(2, 9)}`
        })
      });

      if (response.ok) {
        toast({
          title: "🎉 NFT Minted Successfully!",
          description: "Your NFT has been transferred to your wallet."
        });
        fetchNFTs();
        fetchProject();
      }
    } catch (error) {
      toast({
        title: "Mint Failed",
        description: "Failed to mint NFT. Please try again.",
        variant: "destructive"
      });
    } finally {
      setMintingNft(null);
    }
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity?.toLowerCase()) {
      case 'legendary':
        return 'bg-yellow-500';
      case 'epic':
        return 'bg-purple-500';
      case 'rare':
        return 'bg-blue-500';
      case 'uncommon':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500';
      case 'approved':
        return 'bg-blue-500';
      case 'launched':
        return 'bg-green-500';
      case 'completed':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  const timeUntilLaunch = project?.launchDate 
    ? Math.max(0, new Date(project.launchDate).getTime() - Date.now())
    : 0;

  const isLive = project?.status === 'launched' && timeUntilLaunch <= 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-8">
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="text-center py-12">
              <div className="text-6xl mb-4">❌</div>
              <h3 className="text-xl font-semibold mb-2">Project Not Found</h3>
              <p className="text-gray-600 dark:text-gray-400">
                The NFT project you're looking for doesn't exist or has been removed.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
      
      <div className="container mx-auto px-4 py-8">
        {/* Hero Banner */}
        <div className="relative mb-8">
          <div 
            className="profile-banner"
            style={{
              backgroundImage: project.bannerImage ? `url(${project.bannerImage})` : undefined
            }}
          >
            <div className="absolute inset-0 bg-black/50 flex items-end">
              <div className="p-8 text-white">
                <div className="flex items-center gap-4 mb-4">
                  <Avatar className="w-16 h-16 border-4 border-white">
                    <AvatarImage src={project.image || ''} />
                    <AvatarFallback>{project.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h1 className="text-4xl font-bold mb-2">{project.name}</h1>
                    <div className="flex items-center gap-2">
                      <Badge className={`${getStatusColor(project.status)} text-white`}>
                        {project.status}
                      </Badge>
                      {isLive && (
                        <Badge className="bg-green-500 text-white animate-pulse">
                          🔴 LIVE NOW
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {project.stats.totalMinted} / {project.totalNfts} minted
                  </div>
                  <div className="flex items-center gap-1">
                    <Coins className="w-4 h-4" />
                    {project.mintPrice} {project.currency}
                  </div>
                  {project.launchDate && (
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {new Date(project.launchDate).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Project Info & Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>About this Project</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  {project.description}
                </p>

                <div className="flex flex-wrap gap-2 mb-6">
                  {project.metadata.website && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={project.metadata.website} target="_blank" rel="noopener noreferrer">
                        <Globe className="w-4 h-4 mr-2" />
                        Website
                      </a>
                    </Button>
                  )}
                  {project.metadata.twitter && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={`https://twitter.com/${project.metadata.twitter}`} target="_blank" rel="noopener noreferrer">
                        <Twitter className="w-4 h-4 mr-2" />
                        Twitter
                      </a>
                    </Button>
                  )}
                  {project.metadata.discord && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={project.metadata.discord} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="w-4 h-4 mr-2" />
                        Discord
                      </a>
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Creator</p>
                    <p className="font-mono text-sm">
                      {project.creatorAddress.slice(0, 6)}...{project.creatorAddress.slice(-4)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Royalties</p>
                    <p className="font-semibold">{project.metadata.royaltyPercentage || 0}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Limit per Wallet</p>
                    <p className="font-semibold">{project.metadata.limitPerWallet || 'Unlimited'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Blockchain</p>
                    <p className="font-semibold">XRPL</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            {/* Mint Progress */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Mint Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Minted</span>
                      <span>{project.stats.totalMinted} / {project.totalNfts}</span>
                    </div>
                    <Progress value={(project.stats.totalMinted / project.totalNfts) * 100} />
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {Math.round((project.stats.totalMinted / project.totalNfts) * 100)}% Complete
                    </p>
                  </div>
                  
                  {timeUntilLaunch > 0 && (
                    <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <Clock className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                      <p className="font-semibold text-blue-600">Launching Soon</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {Math.ceil(timeUntilLaunch / (1000 * 60 * 60 * 24))} days remaining
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Collection Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Collection Stats
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Floor Price</span>
                    <span className="font-semibold">{project.stats.floorPrice} XRP</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">24h Volume</span>
                    <span className="font-semibold">{project.stats.volume24h} XRP</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Unique Holders</span>
                    <span className="font-semibold">{project.stats.uniqueHolders}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Total Supply</span>
                    <span className="font-semibold">{project.totalNfts}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* NFT Collection */}
        <Tabs defaultValue="nfts" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="nfts">🖼️ NFTs ({nfts.length})</TabsTrigger>
            <TabsTrigger value="activity">⚡ Activity</TabsTrigger>
            <TabsTrigger value="analytics">📊 Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="nfts" className="space-y-6">
            {nfts.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <div className="text-6xl mb-4">🖼️</div>
                  <h3 className="text-xl font-semibold mb-2">No NFTs Available</h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    This collection hasn't been populated with NFTs yet.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {nfts.map((nft) => (
                  <Card key={nft.id} className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                    <div className="relative">
                      <img
                        src={nft.image || '/placeholder-nft.png'}
                        alt={nft.name}
                        className="w-full h-64 object-cover rounded-t-lg"
                      />
                      {nft.rarity && (
                        <Badge 
                          className={`absolute top-2 right-2 ${getRarityColor(nft.rarity)} text-white`}
                        >
                          {nft.rarity}
                        </Badge>
                      )}
                      {nft.isMinted && (
                        <Badge className="absolute top-2 left-2 bg-green-500 text-white">
                          Minted
                        </Badge>
                      )}
                    </div>
                    
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-lg mb-2">{nft.name}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        #{nft.tokenId}
                      </p>
                      
                      {nft.isMinted ? (
                        <div className="space-y-2">
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Owned by {nft.ownerAddress?.slice(0, 6)}...{nft.ownerAddress?.slice(-4)}
                          </p>
                          <Button variant="outline" className="w-full" disabled>
                            Already Minted
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Price:</span>
                            <span className="font-semibold">{project.mintPrice} {project.currency}</span>
                          </div>
                          <Button 
                            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                            onClick={() => mintNFT(nft.id)}
                            disabled={!isLive || mintingNft === nft.id}
                          >
                            {mintingNft === nft.id ? 'Minting...' : 'Mint NFT'}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="activity" className="space-y-6">
            <Card>
              <CardContent className="text-center py-12">
                <div className="text-4xl mb-4">⚡</div>
                <h3 className="text-lg font-semibold mb-2">Activity Coming Soon</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Trading activity and transaction history will be displayed here.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <Card>
              <CardContent className="text-center py-12">
                <div className="text-4xl mb-4">📊</div>
                <h3 className="text-lg font-semibold mb-2">Analytics Coming Soon</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Detailed collection analytics and insights will be available here.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      
    </div>
  );
}
