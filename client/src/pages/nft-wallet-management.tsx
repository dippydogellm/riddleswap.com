// NFT Wallet Management Page - XRPL NFT handling - LIVE DATA ONLY, NO CACHE
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Check, X, Send, Settings, ExternalLink, Wallet, Image, Eye, Link, Search, Plus } from 'lucide-react';
import { useLocation } from 'wouter';

interface NFTOffer {
  id?: string;
  nft_id: string;
  offer_type: 'buy_offer' | 'sell_offer';
  amount: string;
  currency: string;
  from_address: string;
  offer_index: string;
  expiration?: Date;
  status?: string;
}

interface NFTSettings {
  id: string;
  wallet_address: string;
  auto_accept_offers: boolean;
  min_auto_accept_amount?: string;
  max_auto_accept_amount?: string;
  blocked_addresses: string[];
  trusted_addresses: string[];
  notification_enabled: boolean;
}

export default function NFTWalletManagement() {
  const [selectedWallet, setSelectedWallet] = useState<string>('');
  const [walletPassword, setWalletPassword] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: string; data: any } | null>(null);
  const [sendNFTData, setSendNFTData] = useState({ toAddress: '', nftId: '' });
  const [filterAmount, setFilterAmount] = useState<number>(0);
  const [activeTab, setActiveTab] = useState('your-nfts');
  const [wallets, setWallets] = useState<any[]>([]);
  const [nftsData, setNftsData] = useState<any>(null);
  const [offersData, setOffersData] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [nftsLoading, setNftsLoading] = useState(false);
  const [offersLoading, setOffersLoading] = useState(false);
  const [linkedProjects, setLinkedProjects] = useState<any[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [autoDetectedProjects, setAutoDetectedProjects] = useState<any[]>([]);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  useEffect(() => {
    fetchWallets();
  }, []);

  useEffect(() => {
    if (selectedWallet) {
      fetchNFTsAndOffers();
      fetchSettings();
      fetchLinkedProjects();
    }
  }, [selectedWallet]);

  const fetchWallets = async () => {
    try {
      // LIVE DATA ONLY, NO CACHE
      const response = await fetch(`/api/imported-wallets?t=${Date.now()}&live=true`, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      if (response.ok) {
        const data = await response.json() as any;
        setWallets(data?.wallets?.filter((w: any) => w.chain === 'xrpl') || []);
      }
    } catch (error) {
      console.error('Failed to fetch wallets:', error);
    }
  };

  const fetchNFTsAndOffers = async () => {
    setNftsLoading(true);
    setOffersLoading(true);
    
    try {
      // LIVE DATA ONLY, NO CACHE
      const [nftsResponse, offersResponse] = await Promise.all([
        fetch(`/api/bithomp/wallet/${selectedWallet}/nfts?t=${Date.now()}&live=true`, {
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        }),
        fetch(`/api/bithomp/wallet/${selectedWallet}/offers?t=${Date.now()}&live=true`, {
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        })
      ]);

      if (nftsResponse.ok) {
        const nftsResult = await nftsResponse.json();
        setNftsData(nftsResult);
      }

      if (offersResponse.ok) {
        const offersResult = await offersResponse.json();
        setOffersData(offersResult);
      }
    } catch (error) {
      console.error('Failed to fetch NFTs and offers:', error);
    } finally {
      setNftsLoading(false);
      setOffersLoading(false);
    }
  };

  const fetchLinkedProjects = async () => {
    if (!selectedWallet) return;
    
    setProjectsLoading(true);
    try {
      // Auto-detect projects linked to this wallet
      const response = await fetch('/api/wallet-project-links/auto-detect-projects', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json() as any;
        setAutoDetectedProjects(data.projects || []);
        setLinkedProjects(data.projects || []);
        console.log(`🔗 Found ${data.projects?.length || 0} linked projects for wallet ${selectedWallet}`);
      } else {
        console.log('❌ Failed to auto-detect projects:', response.status);
      }
    } catch (error) {
      console.error('Error fetching linked projects:', error);
    } finally {
      setProjectsLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      // LIVE DATA ONLY, NO CACHE
      const response = await fetch(`/api/nft-wallet/wallet/${selectedWallet}/settings?t=${Date.now()}&live=true`, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      if (response.ok) {
        const data = await response.json() as any;
        setSettings(data);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    }
  };

  // Accept single offer function - LIVE DATA ONLY, NO CACHE
  const handleAcceptOffer = async ({ offerId, password }: { offerId: string; password: string }) => {
    try {
      const response = await fetch(`/api/nft-wallet/offers/${offerId}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify({ walletPassword: password, walletType: 'imported' })
      });

      if (response.ok) {
        toast({ title: 'Success', description: 'NFT offer accepted successfully' });
        setShowPasswordModal(false);
        setWalletPassword('');
        setPendingAction(null);
        fetchNFTsAndOffers(); // Refresh data
      } else {
        throw new Error('Failed to accept offer');
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to accept offer', variant: 'destructive' });
    }
  };

  // Reject offer function - LIVE DATA ONLY, NO CACHE
  const handleRejectOffer = async (offerId: string) => {
    try {
      const response = await fetch(`/api/nft-wallet/offers/${offerId}/reject`, {
        method: 'POST',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });

      if (response.ok) {
        toast({ title: 'Success', description: 'NFT offer rejected' });
        fetchNFTsAndOffers(); // Refresh data
      } else {
        throw new Error('Failed to reject offer');
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to reject offer', variant: 'destructive' });
    }
  };

  // Accept all offers function - LIVE DATA ONLY, NO CACHE
  const handleAcceptAllOffers = async ({ password, filterAmount }: { password: string; filterAmount?: number }) => {
    try {
      const response = await fetch(`/api/nft-wallet/wallet/${selectedWallet}/accept-all-offers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify({ walletPassword: password, walletType: 'imported', filterAmount })
      });

      if (response.ok) {
        const data = await response.json() as any;
        toast({ 
          title: 'Batch Accept Complete', 
          description: `Accepted ${data.data?.acceptedCount || 0} of ${data.data?.totalOffers || 0} offers` 
        });
        setShowPasswordModal(false);
        setWalletPassword('');
        setPendingAction(null);
        fetchNFTsAndOffers(); // Refresh data
      } else {
        throw new Error('Failed to accept all offers');
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to accept all offers', variant: 'destructive' });
    }
  };

  // Send NFT function - LIVE DATA ONLY, NO CACHE
  const handleSendNFT = async ({ fromAddress, toAddress, nftId, password }: { 
    fromAddress: string; 
    toAddress: string; 
    nftId: string; 
    password: string;
  }) => {
    try {
      const response = await fetch('/api/nft-wallet/send-nft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify({ fromAddress, toAddress, nftId, walletPassword: password })
      });

      if (response.ok) {
        toast({ title: 'Success', description: 'NFT sent successfully' });
        setSendNFTData({ toAddress: '', nftId: '' });
        setShowPasswordModal(false);
        setWalletPassword('');
        setPendingAction(null);
        fetchNFTsAndOffers(); // Refresh data
      } else {
        throw new Error('Failed to send NFT');
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to send NFT', variant: 'destructive' });
    }
  };

  // Update settings function - LIVE DATA ONLY, NO CACHE
  const handleUpdateSettings = async (newSettings: Partial<NFTSettings>) => {
    try {
      const response = await fetch(`/api/nft-wallet/wallet/${selectedWallet}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify(newSettings)
      });

      if (response.ok) {
        toast({ title: 'Success', description: 'NFT settings updated' });
        fetchSettings(); // Refresh data
      } else {
        throw new Error('Failed to update settings');
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to update settings', variant: 'destructive' });
    }
  };

  const handlePasswordSubmit = () => {
    if (!walletPassword.trim()) {
      toast({ title: 'Error', description: 'Password is required', variant: 'destructive' });
      return;
    }

    if (!pendingAction) return;

    switch (pendingAction.type) {
      case 'accept':
        handleAcceptOffer({ offerId: pendingAction.data.offerId, password: walletPassword });
        break;
      case 'acceptAll':
        handleAcceptAllOffers({ password: walletPassword, filterAmount });
        break;
      case 'sendNFT':
        handleSendNFT({
          fromAddress: selectedWallet,
          toAddress: sendNFTData.toAddress,
          nftId: sendNFTData.nftId,
          password: walletPassword
        });
        break;
    }
  };

  const ownedNFTs = (nftsData as any)?.data?.nfts || [];
  const incomingOffers = (offersData as any)?.incomingOffers || (offersData as any)?.data?.incomingOffers || [];
  const outgoingOffers = (offersData as any)?.data?.outgoingOffers || [];
  const allOffers = [...incomingOffers, ...outgoingOffers];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Wallet className="h-8 w-8 text-blue-500" />
        <div>
          <h1 className="text-2xl font-bold">XRPL NFT Wallet Management</h1>
          <p className="text-gray-600 dark:text-gray-300">Manage NFT offers and settings for your XRPL wallets</p>
        </div>
      </div>

      {/* Wallet Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Wallet</CardTitle>
          <CardDescription>Choose an XRPL wallet to manage NFT offers</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {wallets.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No XRPL wallets found. Import an XRPL wallet first.
              </div>
            ) : (
              wallets.map((wallet: any) => (
                <div
                  key={wallet.address}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedWallet === wallet.address
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedWallet(wallet.address)}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium">{wallet.label || 'Unnamed Wallet'}</div>
                      <div className="font-mono text-sm text-gray-600">{wallet.address}</div>
                    </div>
                    <Badge variant="outline">XRPL</Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {selectedWallet && (
        <>
          {/* Tabbed Interface with Assets and NFTs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="your-nfts" className="flex items-center gap-2">
                <Image className="h-4 w-4" />
                Your NFTs ({ownedNFTs.length})
              </TabsTrigger>
              <TabsTrigger value="assets" className="flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Assets & Offers ({allOffers.length})
              </TabsTrigger>
              <TabsTrigger value="projects" className="flex items-center gap-2">
                <Link className="h-4 w-4" />
                Project Links ({linkedProjects.length})
              </TabsTrigger>
            </TabsList>

            {/* Your NFTs Tab */}
            <TabsContent value="your-nfts">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Image className="h-5 w-5" />
                    Your NFT Collection
                  </CardTitle>
                  <CardDescription>Click any NFT to view details in the marketplace</CardDescription>
                </CardHeader>
                <CardContent>
                  {nftsLoading ? (
                    <div className="flex justify-center py-12">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                        <div className="text-sm text-gray-500">Loading your NFTs...</div>
                      </div>
                    </div>
                  ) : ownedNFTs.length === 0 ? (
                    <div className="text-center py-12">
                      <Image className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No NFTs Found</h3>
                      <p className="text-gray-500">This wallet doesn't currently own any NFTs</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                      {ownedNFTs.map((nft: any) => (
                        <div 
                          key={nft.nft_id} 
                          className="group border rounded-xl overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer hover:scale-105 bg-white dark:bg-gray-800"
                          onClick={() => {
                            // Navigate to NFT marketplace detail page
                            setLocation(`/nft-marketplace/${nft.nft_id}`);
                          }}
                        >
                          {/* NFT Image */}
                          <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center overflow-hidden">
                            {nft.metadata?.image ? (
                              <img 
                                src={nft.metadata.image} 
                                alt={nft.metadata?.name || 'NFT'} 
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                onError={(e) => {
                                  const target = e.currentTarget as HTMLImageElement;
                                  target.style.display = 'none';
                                  target.nextElementSibling?.classList.remove('hidden');
                                }}
                              />
                            ) : null}
                            <div className="text-gray-400 text-center p-3 hidden">
                              <Image className="h-8 w-8 mx-auto mb-2" />
                              <div className="text-xs">No Image</div>
                            </div>
                          </div>
                          
                          {/* NFT Details */}
                          <div className="p-3 space-y-1">
                            <div className="font-medium text-sm truncate">
                              {nft.metadata?.name || `NFT #${nft.sequence || 'Unknown'}`}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                              ID: {nft.nft_id.substring(0, 8)}...
                            </div>
                            {nft.metadata?.description && (
                              <div className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                                {nft.metadata.description}
                              </div>
                            )}
                            <div className="flex justify-between items-center pt-2">
                              <div className="text-xs text-blue-600 dark:text-blue-400">
                                <Eye className="h-3 w-3 inline mr-1" />
                                View Details
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation(); // Prevent navigation
                                  setSendNFTData(prev => ({ ...prev, nftId: nft.nft_id }));
                                }}
                                className="text-xs px-2 py-1 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Send className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Assets & Offers Tab */}
            <TabsContent value="assets">

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="h-5 w-5" />
                    Wallet Assets & Offers
                  </CardTitle>
                  <CardDescription>Manage incoming offers and wallet settings</CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Incoming NFT Offers */}
                  {incomingOffers.length > 0 ? (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="font-semibold">Incoming Offers ({incomingOffers.length})</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Others want to buy your NFTs</p>
                        </div>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            placeholder="Min XRP amount"
                            value={filterAmount}
                            onChange={(e) => setFilterAmount(Number(e.target.value))}
                            className="w-32"
                          />
                          <Button
                            onClick={() => {
                              setPendingAction({ type: 'acceptAll', data: {} });
                              setShowPasswordModal(true);
                            }}
                            disabled={acceptAllOffersMutation.isPending}
                          >
                            Accept All
                          </Button>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        {incomingOffers.map((offer: any, index: number) => (
                          <div key={offer.id || index} className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                            <div className="flex justify-between items-start">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <Badge variant="default">Buy Offer</Badge>
                                  <span 
                                    className="font-mono text-sm text-blue-600 dark:text-blue-400 cursor-pointer hover:underline"
                                    onClick={() => setLocation(`/nft-marketplace/${offer.nft_id}`)}
                                  >
                                    {offer.nft_id.substring(0, 16)}...
                                  </span>
                                </div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                  From: {offer.from_address}
                                </div>
                                <div className="font-semibold">
                                  {(parseFloat(offer.amount) / 1000000).toFixed(6)} XRP
                                </div>
                                {offer.expiration && (
                                  <div className="text-xs text-gray-500">
                                    Expires: {new Date(offer.expiration).toLocaleString()}
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setPendingAction({ type: 'accept', data: { offerId: offer.id } });
                                    setShowPasswordModal(true);
                                  }}
                                  disabled={acceptOfferMutation.isPending}
                                >
                                  <Check className="h-4 w-4" />
                                  Accept
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => rejectOfferMutation.mutate(offer.id)}
                                  disabled={rejectOfferMutation.isPending}
                                >
                                  <X className="h-4 w-4" />
                                  Reject
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Wallet className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No Offers</h3>
                      <p className="text-gray-500">No incoming NFT offers at this time</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Project Links Tab */}
            <TabsContent value="projects">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Link className="h-5 w-5" />
                    Linked Projects
                  </CardTitle>
                  <CardDescription>
                    DevTools projects linked to this wallet ({selectedWallet})
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {projectsLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <div className="text-center">
                        <div className="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-2" />
                        <p className="text-sm text-gray-600 dark:text-gray-400">Loading linked projects...</p>
                      </div>
                    </div>
                  ) : linkedProjects.length === 0 ? (
                    <div className="text-center py-8">
                      <Link className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No Linked Projects</h3>
                      <p className="text-gray-600 dark:text-gray-400 mb-4">
                        This wallet is not linked to any DevTools projects yet
                      </p>
                      <Button
                        onClick={() => setLocation('/devtools')}
                        className="flex items-center gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Manage Projects
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {linkedProjects.map((project) => (
                        <Card
                          key={project.id}
                          className="cursor-pointer hover:shadow-lg transition-shadow"
                          onClick={() => setLocation(`/devtools/project/${project.id}`)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h4 className="font-semibold">{project.name}</h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  {project.description || 'No description'}
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <Badge variant="secondary" className="text-xs">
                                  {project.walletLinks?.length || 0} wallets
                                </Badge>
                                {project.userRole && (
                                  <Badge 
                                    variant={project.userRole === 'owner' ? 'default' : 'secondary'} 
                                    className="text-xs"
                                  >
                                    {project.userRole}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 mb-3">
                              <Badge variant="outline" className="text-xs">
                                {project.category || 'General'}
                              </Badge>
                              <span className="text-xs text-gray-500">
                                Owner: {project.ownerWalletAddress?.slice(0, 6)}...{project.ownerWalletAddress?.slice(-4)}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {project.walletLinks?.map((link: any, index: number) => (
                                <div
                                  key={index}
                                  className={`text-xs px-2 py-1 rounded ${
                                    link.walletAddress === selectedWallet
                                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-medium'
                                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                                  }`}
                                >
                                  {link.chain?.toUpperCase() || 'Unknown'}: {link.walletAddress?.slice(0, 6)}...
                                  {link.walletAddress === selectedWallet && ' (current)'}
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      
                      <div className="text-center pt-4">
                        <Button
                          variant="outline"
                          onClick={() => setLocation('/devtools')}
                          className="flex items-center gap-2"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Manage All Projects
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>



        </>
      )}

      {/* Send NFT Modal */}
      {sendNFTData.nftId && (
        <AlertDialog open={!!sendNFTData.nftId} onOpenChange={() => setSendNFTData({ toAddress: '', nftId: '' })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Send NFT
              </AlertDialogTitle>
              <AlertDialogDescription>Transfer this NFT to another wallet</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="nft-id">NFT Token ID</Label>
                <Input
                  id="nft-id"
                  value={sendNFTData.nftId}
                  readOnly
                  className="bg-gray-50 dark:bg-gray-800"
                />
              </div>
              <div>
                <Label htmlFor="to-address">Recipient Address</Label>
                <Input
                  id="to-address"
                  placeholder="Enter XRPL address"
                  value={sendNFTData.toAddress}
                  onChange={(e) => setSendNFTData(prev => ({ ...prev, toAddress: e.target.value }))}
                />
              </div>
            </div>
            <AlertDialogFooter>
              <Button
                variant="outline"
                onClick={() => setSendNFTData({ toAddress: '', nftId: '' })}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!sendNFTData.nftId || !sendNFTData.toAddress) {
                    toast({ title: 'Error', description: 'Please fill in all fields', variant: 'destructive' });
                    return;
                  }
                  setPendingAction({ type: 'sendNFT', data: sendNFTData });
                  setShowPasswordModal(true);
                }}
                disabled={sendNFTMutation.isPending}
              >
                <Send className="h-4 w-4 mr-2" />
                Send NFT
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Password Modal */}
      <AlertDialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Wallet Password Required</AlertDialogTitle>
            <AlertDialogDescription>
              Enter your wallet password to complete this action
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter wallet password"
                value={walletPassword}
                onChange={(e) => setWalletPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handlePasswordSubmit();
                  }
                }}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPasswordModal(false);
                setWalletPassword('');
                setPendingAction(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePasswordSubmit}
              disabled={
                !walletPassword.trim() ||
                acceptOfferMutation.isPending ||
                acceptAllOffersMutation.isPending ||
                sendNFTMutation.isPending
              }
            >
              {acceptOfferMutation.isPending || acceptAllOffersMutation.isPending || sendNFTMutation.isPending
                ? 'Processing...'
                : 'Confirm'
              }
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
