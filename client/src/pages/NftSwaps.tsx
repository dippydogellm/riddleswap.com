import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  Repeat,
  Plus,
  Image,
  Clock,
  MessageSquare,
  Shield,
  AlertTriangle,
  Info,
  X,
  Check,
  Eye,
  ArrowRightLeft,
  Coins,
  Star,
  Timer
} from "lucide-react";
import { apiRequest } from '@/lib/queryClient';

interface NFTItem {
  chain: string;
  contract: string;
  tokenId: string;
  name?: string;
  image?: string;
  estimatedValue?: number;
}

interface WantedItem {
  chain?: string;
  contract?: string;
  tokenId?: string;
  description: string;
  minEstimatedValue?: number;
}

interface SwapOffer {
  id: string;
  makerHandle: string;
  makerWallet: string;
  offeredItems: NFTItem[];
  wantedItems: WantedItem[];
  status: string;
  expiresAt: Date | null;
  takerHandle: string | null;
  takerWallet: string | null;
  matchedAt: Date | null;
  escrowRef: string | null;
  escrowTransactionHash: string | null;
  completionTransactionHash: string | null;
  description: string | null;
  isPrivateOffer: boolean;
  privateOfferTarget: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface SwapMatch {
  id: string;
  offerId: string;
  takerHandle: string;
  takerWallet: string;
  takerItems: NFTItem[];
  status: string;
  escrowRef: string | null;
  takerEscrowTransactionHash: string | null;
  completionTransactionHash: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

export default function NftSwaps() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check authentication state
  const sessionToken = localStorage.getItem('sessionToken');
  const sessionData = sessionStorage.getItem('riddle_wallet_session');
  const isAuthenticated = !!(sessionToken || sessionData);

  // Check if user has wallet data
  const walletData = localStorage.getItem('riddleWallet');
  let userHandle = '';
  let userAddress = '';
  
  if (walletData) {
    try {
      const parsed = JSON.parse(walletData);
      userHandle = parsed.handle || '';
      userAddress = parsed.address || parsed.xrpAddress || '';
    } catch (error) {
      console.error('Error parsing wallet data:', error);
    }
  }
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [createOfferDialog, setCreateOfferDialog] = useState<boolean>(false);
  const [acceptOfferDialog, setAcceptOfferDialog] = useState<{ open: boolean; offer: SwapOffer | null }>({ open: false, offer: null });
  const [viewDetailsDialog, setViewDetailsDialog] = useState<{ open: boolean; offer: SwapOffer | null }>({ open: false, offer: null });

  // Form states for creating offers
  const [offerForm, setOfferForm] = useState({
    offeredItems: [] as NFTItem[],
    wantedItems: [] as WantedItem[],
    description: '',
    expiresAt: '',
    isPrivateOffer: false,
    privateOfferTarget: ''
  });

  const [currentOfferedItem, setCurrentOfferedItem] = useState<Partial<NFTItem>>({
    chain: 'xrp',
    contract: '',
    tokenId: '',
    name: '',
    image: '',
    estimatedValue: undefined
  });

  const [currentWantedItem, setCurrentWantedItem] = useState<Partial<WantedItem>>({
    chain: '',
    contract: '',
    tokenId: '',
    description: '',
    minEstimatedValue: undefined
  });

  const [acceptForm, setAcceptForm] = useState({
    takerItems: [] as NFTItem[],
    takerEscrowTransactionHash: ''
  });

  const [currentTakerItem, setCurrentTakerItem] = useState<Partial<NFTItem>>({
    chain: 'xrp',
    contract: '',
    tokenId: '',
    name: '',
    image: '',
    estimatedValue: undefined
  });

  // Fetch available swap offers
  const { data: offersData, isLoading: offersLoading } = useQuery<SwapOffer[]>({
    queryKey: ['/api/nft-swaps', { status: selectedStatus }],
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  // Ensure offers is always an array
  const offers = Array.isArray(offersData) ? offersData : [];

  // Fetch user's swap offers - only if authenticated
  const { data: myOffersData, isLoading: myOffersLoading } = useQuery<SwapOffer[]>({
    queryKey: ['/api/nft-swaps/mine'],
    staleTime: 1000 * 60 * 1,
    enabled: isAuthenticated // Only fetch if user is authenticated
  });

  // Ensure myOffers is always an array
  const myOffers = Array.isArray(myOffersData) ? myOffersData : [];

  // Create offer mutation
  const createOfferMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/nft-swaps', {
        method: 'POST',
        body: data,
      });
    },
    onSuccess: (response) => {
      toast({
        title: "Swap Offer Created!",
        description: `Your NFT swap offer has been posted to the marketplace.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/nft-swaps'] });
      setCreateOfferDialog(false);
      resetOfferForm();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Create Offer",
        description: error.message || "Failed to create swap offer. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Accept offer mutation
  const acceptOfferMutation = useMutation({
    mutationFn: async (data: { offerId: string; takerItems: NFTItem[]; takerEscrowTransactionHash: string }) => {
      return apiRequest(`/api/nft-swaps/${data.offerId}/accept`, {
        method: 'POST',
        body: {
          takerItems: data.takerItems,
          takerEscrowTransactionHash: data.takerEscrowTransactionHash
        },
      });
    },
    onSuccess: (response) => {
      toast({
        title: "Swap Offer Accepted!",
        description: "You've successfully accepted the swap offer. Both parties must deposit NFTs to complete the trade.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/nft-swaps'] });
      setAcceptOfferDialog({ open: false, offer: null });
      setAcceptForm({ takerItems: [], takerEscrowTransactionHash: '' });
      setCurrentTakerItem({ chain: 'xrp', contract: '', tokenId: '', name: '', image: '', estimatedValue: undefined });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Accept Offer",
        description: error.message || "Failed to accept swap offer. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Cancel offer mutation
  const cancelOfferMutation = useMutation({
    mutationFn: async (offerId: string) => {
      return apiRequest(`/api/nft-swaps/${offerId}/cancel`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      toast({
        title: "Offer Cancelled",
        description: "Your swap offer has been cancelled successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/nft-swaps'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Cancel",
        description: error.message || "Failed to cancel swap offer.",
        variant: "destructive",
      });
    },
  });

  const resetOfferForm = () => {
    setOfferForm({
      offeredItems: [],
      wantedItems: [],
      description: '',
      expiresAt: '',
      isPrivateOffer: false,
      privateOfferTarget: ''
    });
    setCurrentOfferedItem({ chain: 'xrp', contract: '', tokenId: '', name: '', image: '', estimatedValue: undefined });
    setCurrentWantedItem({ chain: '', contract: '', tokenId: '', description: '', minEstimatedValue: undefined });
  };

  const addOfferedItem = () => {
    if (!currentOfferedItem.chain || !currentOfferedItem.contract || !currentOfferedItem.tokenId) {
      toast({
        title: "Missing Information",
        description: "Please fill in chain, contract, and token ID for the NFT.",
        variant: "destructive",
      });
      return;
    }

    setOfferForm({
      ...offerForm,
      offeredItems: [...offerForm.offeredItems, currentOfferedItem as NFTItem]
    });
    setCurrentOfferedItem({ chain: 'xrp', contract: '', tokenId: '', name: '', image: '', estimatedValue: undefined });
  };

  const addWantedItem = () => {
    if (!currentWantedItem.description) {
      toast({
        title: "Missing Description",
        description: "Please provide a description of what you want in return.",
        variant: "destructive",
      });
      return;
    }

    setOfferForm({
      ...offerForm,
      wantedItems: [...offerForm.wantedItems, currentWantedItem as WantedItem]
    });
    setCurrentWantedItem({ chain: '', contract: '', tokenId: '', description: '', minEstimatedValue: undefined });
  };

  const addTakerItem = () => {
    if (!currentTakerItem.chain || !currentTakerItem.contract || !currentTakerItem.tokenId) {
      toast({
        title: "Missing Information",
        description: "Please fill in chain, contract, and token ID for the NFT.",
        variant: "destructive",
      });
      return;
    }

    setAcceptForm({
      ...acceptForm,
      takerItems: [...acceptForm.takerItems, currentTakerItem as NFTItem]
    });
    setCurrentTakerItem({ chain: 'xrp', contract: '', tokenId: '', name: '', image: '', estimatedValue: undefined });
  };

  const removeOfferedItem = (index: number) => {
    setOfferForm({
      ...offerForm,
      offeredItems: offerForm.offeredItems.filter((_, i) => i !== index)
    });
  };

  const removeWantedItem = (index: number) => {
    setOfferForm({
      ...offerForm,
      wantedItems: offerForm.wantedItems.filter((_, i) => i !== index)
    });
  };

  const removeTakerItem = (index: number) => {
    setAcceptForm({
      ...acceptForm,
      takerItems: acceptForm.takerItems.filter((_, i) => i !== index)
    });
  };

  const handleCreateOffer = () => {
    // Check authentication first
    if (!isAuthenticated) {
      toast({
        title: "Authentication Required",
        description: "Please log in to create swap offers.",
        variant: "destructive",
      });
      return;
    }

    if (!userHandle || !userAddress) {
      toast({
        title: "Wallet Not Found",
        description: "Please ensure your wallet is properly connected.",
        variant: "destructive",
      });
      return;
    }

    if (offerForm.offeredItems.length === 0) {
      toast({
        title: "No NFTs Offered",
        description: "You must offer at least one NFT for the swap.",
        variant: "destructive",
      });
      return;
    }

    if (offerForm.wantedItems.length === 0) {
      toast({
        title: "No Requirements Specified",
        description: "You must specify what you want in return for the swap.",
        variant: "destructive",
      });
      return;
    }

    console.log('🔑 Creating offer with user data:', { userHandle, userAddress, isAuthenticated });

    createOfferMutation.mutate({
      ...offerForm,
      expiresAt: offerForm.expiresAt ? new Date(offerForm.expiresAt).toISOString() : undefined
    });
  };

  const handleAcceptOffer = () => {
    if (!acceptOfferDialog.offer) return;

    if (acceptForm.takerItems.length === 0) {
      toast({
        title: "No NFTs Specified",
        description: "You must specify which NFTs you're offering in return.",
        variant: "destructive",
      });
      return;
    }

    if (!acceptForm.takerEscrowTransactionHash) {
      toast({
        title: "Missing Transaction Hash",
        description: "Please provide the escrow transaction hash.",
        variant: "destructive",
      });
      return;
    }

    acceptOfferMutation.mutate({
      offerId: acceptOfferDialog.offer.id,
      takerItems: acceptForm.takerItems,
      takerEscrowTransactionHash: acceptForm.takerEscrowTransactionHash
    });
  };

  // Filter offers by status
  const filteredOffers = offers.filter(offer => {
    if (selectedStatus === 'all') return true;
    return offer.status === selectedStatus;
  });

  const formatNumber = (num: number | undefined) => {
    if (!num) return '—';
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(2) + 'K';
    return num.toFixed(2);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'default';
      case 'matched': return 'secondary';
      case 'escrowed': return 'outline';
      case 'completed': return 'outline';
      case 'cancelled': return 'destructive';
      case 'expired': return 'destructive';
      default: return 'secondary';
    }
  };

  const isOfferExpired = (expiresAt: Date | null) => {
    if (!expiresAt) return false;
    return new Date() > new Date(expiresAt);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
            NFT Swap Marketplace
          </h1>
          <p className="text-lg text-muted-foreground">
            Trade NFTs securely across multiple blockchains with escrow protection
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800" data-testid="card-total-offers">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Total Offers</p>
                  <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                    {offers.length}
                  </p>
                </div>
                <Repeat className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800" data-testid="card-active-swaps">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Active Swaps</p>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                    {offers.filter(o => ['matched', 'escrowed'].includes(o.status)).length}
                  </p>
                </div>
                <ArrowRightLeft className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800" data-testid="card-completed">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">Completed</p>
                  <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                    {offers.filter(o => o.status === 'completed').length}
                  </p>
                </div>
                <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800" data-testid="card-my-offers">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-600 dark:text-orange-400">My Offers</p>
                  <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                    {myOffers.length}
                  </p>
                </div>
                <Star className="h-8 w-8 text-orange-600 dark:text-orange-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="marketplace" className="space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <TabsList className="grid grid-cols-2 max-w-md" data-testid="tabs-nft-swaps">
              <TabsTrigger value="marketplace" data-testid="tab-marketplace">Marketplace</TabsTrigger>
              <TabsTrigger value="my-offers" data-testid="tab-my-offers">My Offers</TabsTrigger>
            </TabsList>

            <Button onClick={() => setCreateOfferDialog(true)} className="bg-gradient-to-r from-purple-600 to-pink-600" data-testid="button-create-offer">
              <Plus className="h-4 w-4 mr-2" />
              Create Swap Offer
            </Button>
          </div>

          <TabsContent value="marketplace" className="space-y-6">
            {/* Status Filter */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="status-filter">Filter by Status:</Label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus} data-testid="select-status-filter">
                  <SelectTrigger className="w-[180px]" id="status-filter">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Offers</SelectItem>
                    <SelectItem value="open">Open Offers</SelectItem>
                    <SelectItem value="matched">Matched</SelectItem>
                    <SelectItem value="escrowed">In Escrow</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Alert className="max-w-md" data-testid="alert-swap-info">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  All NFT swaps use secure escrow. Both parties must deposit before completion.
                </AlertDescription>
              </Alert>
            </div>

            {/* Swap Offers */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {offersLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="animate-pulse" data-testid="card-offer-skeleton">
                    <CardContent className="p-6">
                      <div className="space-y-3">
                        <div className="h-4 bg-muted rounded w-3/4"></div>
                        <div className="h-6 bg-muted rounded w-1/2"></div>
                        <div className="h-4 bg-muted rounded w-full"></div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : filteredOffers.length === 0 ? (
                <Card className="col-span-full" data-testid="card-no-offers">
                  <CardContent className="text-center py-8">
                    <Repeat className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Swap Offers</h3>
                    <p className="text-muted-foreground">
                      {selectedStatus === 'all' 
                        ? 'No NFT swap offers are currently available.' 
                        : `No offers with status "${selectedStatus}" found.`}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                filteredOffers.map((offer) => {
                  const isExpired = isOfferExpired(offer.expiresAt);
                  const totalOfferedValue = offer.offeredItems.reduce((sum, item) => sum + (item.estimatedValue || 0), 0);
                  const minWantedValue = offer.wantedItems.reduce((sum, item) => sum + (item.minEstimatedValue || 0), 0);

                  return (
                    <Card key={offer.id} className="hover:shadow-lg transition-shadow duration-200 border-2 hover:border-primary/20" data-testid={`card-offer-${offer.id}`}>
                      <CardHeader className="pb-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg flex items-center gap-2">
                              {offer.makerHandle}
                              {offer.isPrivateOffer && (
                                <Badge variant="outline" className="text-xs" data-testid="badge-private">
                                  Private
                                </Badge>
                              )}
                            </CardTitle>
                            <CardDescription className="flex items-center gap-2">
                              <Image className="h-3 w-3" />
                              {offer.offeredItems.length} offered ↔ {offer.wantedItems.length} wanted
                            </CardDescription>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge variant={getStatusColor(offer.status)} className="text-xs" data-testid={`badge-offer-status-${offer.id}`}>
                              {offer.status}
                            </Badge>
                            {isExpired && (
                              <Badge variant="destructive" className="text-xs" data-testid="badge-expired">
                                Expired
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Offered Items Preview */}
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-green-600 dark:text-green-400">Offering:</p>
                          <div className="space-y-1">
                            {offer.offeredItems.slice(0, 2).map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between text-sm bg-green-50 dark:bg-green-950 rounded p-2">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs" data-testid={`badge-offered-chain-${idx}`}>
                                    {item.chain.toUpperCase()}
                                  </Badge>
                                  <span className="truncate" data-testid={`text-offered-name-${idx}`}>
                                    {item.name || `${item.contract.substring(0, 8)}...#${item.tokenId}`}
                                  </span>
                                </div>
                                {item.estimatedValue && (
                                  <span className="text-green-600 dark:text-green-400 font-medium" data-testid={`text-offered-value-${idx}`}>
                                    ${formatNumber(item.estimatedValue)}
                                  </span>
                                )}
                              </div>
                            ))}
                            {offer.offeredItems.length > 2 && (
                              <p className="text-xs text-muted-foreground">
                                +{offer.offeredItems.length - 2} more items
                              </p>
                            )}
                          </div>
                          {totalOfferedValue > 0 && (
                            <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                              Total Value: ${formatNumber(totalOfferedValue)}
                            </p>
                          )}
                        </div>

                        {/* Wanted Items Preview */}
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Wants:</p>
                          <div className="space-y-1">
                            {offer.wantedItems.slice(0, 2).map((item, idx) => (
                              <div key={idx} className="text-sm bg-blue-50 dark:bg-blue-950 rounded p-2">
                                <p className="truncate" data-testid={`text-wanted-desc-${idx}`}>
                                  {item.description}
                                </p>
                                {item.minEstimatedValue && (
                                  <p className="text-blue-600 dark:text-blue-400 text-xs mt-1">
                                    Min value: ${formatNumber(item.minEstimatedValue)}
                                  </p>
                                )}
                              </div>
                            ))}
                            {offer.wantedItems.length > 2 && (
                              <p className="text-xs text-muted-foreground">
                                +{offer.wantedItems.length - 2} more requirements
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Description */}
                        {offer.description && (
                          <div className="space-y-1">
                            <p className="text-sm font-medium">Description</p>
                            <p className="text-sm text-muted-foreground" data-testid={`text-offer-description-${offer.id}`}>
                              {offer.description.length > 100 
                                ? `${offer.description.substring(0, 100)}...` 
                                : offer.description}
                            </p>
                          </div>
                        )}

                        {/* Expiration */}
                        {offer.expiresAt && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span data-testid={`text-expires-${offer.id}`}>
                              Expires {new Date(offer.expiresAt).toLocaleDateString()}
                            </span>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setViewDetailsDialog({ open: true, offer })}
                            data-testid={`button-view-details-${offer.id}`}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Button>
                          {offer.status === 'open' && !isExpired && (
                            <Button
                              size="sm"
                              onClick={() => setAcceptOfferDialog({ open: true, offer })}
                              data-testid={`button-accept-${offer.id}`}
                            >
                              <Check className="h-4 w-4 mr-2" />
                              Accept Offer
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {/* TODO: Open messaging */}}
                            data-testid={`button-message-${offer.id}`}
                          >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Message
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>

          <TabsContent value="my-offers" className="space-y-6">
            {/* My Offers */}
            <div className="space-y-4">
              {myOffersLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i} className="animate-pulse" data-testid="card-my-offer-skeleton">
                    <CardContent className="p-6">
                      <div className="space-y-3">
                        <div className="h-4 bg-muted rounded w-1/4"></div>
                        <div className="h-6 bg-muted rounded w-1/2"></div>
                        <div className="h-4 bg-muted rounded w-full"></div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : myOffers.length === 0 ? (
                <Card data-testid="card-no-my-offers">
                  <CardContent className="text-center py-8">
                    <Star className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Swap Offers</h3>
                    <p className="text-muted-foreground mb-4">
                      You haven't created any NFT swap offers yet. Create your first offer to start trading!
                    </p>
                    <Button onClick={() => setCreateOfferDialog(true)} data-testid="button-create-first-offer">
                      Create Your First Offer
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                myOffers.map((offer) => {
                  const isExpired = isOfferExpired(offer.expiresAt);
                  
                  return (
                    <Card key={offer.id} className="hover:shadow-lg transition-shadow duration-200" data-testid={`card-my-offer-${offer.id}`}>
                      <CardHeader className="pb-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                              My Swap Offer
                              <Badge variant={getStatusColor(offer.status)} className="text-xs" data-testid={`badge-my-offer-status-${offer.id}`}>
                                {offer.status}
                              </Badge>
                              {offer.isPrivateOffer && (
                                <Badge variant="outline" className="text-xs" data-testid="badge-my-offer-private">
                                  Private
                                </Badge>
                              )}
                            </CardTitle>
                            <CardDescription>
                              Created {new Date(offer.createdAt).toLocaleDateString()}
                              {offer.takerHandle && ` • Matched with ${offer.takerHandle}`}
                            </CardDescription>
                          </div>
                          {isExpired && (
                            <Badge variant="destructive" className="text-xs flex items-center gap-1" data-testid="badge-my-offer-expired">
                              <Timer className="h-3 w-3" />
                              Expired
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-medium mb-2">Offering ({offer.offeredItems.length} items)</p>
                            <div className="space-y-1">
                              {offer.offeredItems.map((item, idx) => (
                                <div key={idx} className="text-sm bg-muted rounded p-2">
                                  <div className="flex items-center justify-between">
                                    <span>{item.name || `Token #${item.tokenId}`}</span>
                                    <Badge variant="outline" className="text-xs">
                                      {item.chain.toUpperCase()}
                                    </Badge>
                                  </div>
                                  {item.estimatedValue && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Value: ${formatNumber(item.estimatedValue)}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          <div>
                            <p className="text-sm font-medium mb-2">Wanting ({offer.wantedItems.length} requirements)</p>
                            <div className="space-y-1">
                              {offer.wantedItems.map((item, idx) => (
                                <div key={idx} className="text-sm bg-muted rounded p-2">
                                  <p>{item.description}</p>
                                  {item.minEstimatedValue && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Min value: ${formatNumber(item.minEstimatedValue)}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {offer.status === 'matched' && (
                          <Alert data-testid={`alert-matched-${offer.id}`}>
                            <Check className="h-4 w-4" />
                            <AlertDescription>
                              Your offer has been accepted by {offer.takerHandle}! Both parties must deposit NFTs to escrow to complete the trade.
                            </AlertDescription>
                          </Alert>
                        )}

                        <div className="flex gap-2">
                          {offer.status === 'open' && !isExpired && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => cancelOfferMutation.mutate(offer.id)}
                              disabled={cancelOfferMutation.isPending}
                              data-testid={`button-cancel-${offer.id}`}
                            >
                              <X className="h-4 w-4 mr-2" />
                              {cancelOfferMutation.isPending ? 'Cancelling...' : 'Cancel Offer'}
                            </Button>
                          )}
                          {offer.takerHandle && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {/* TODO: Open messaging with taker */}}
                              data-testid={`button-message-taker-${offer.id}`}
                            >
                              <MessageSquare className="h-4 w-4 mr-2" />
                              Message {offer.takerHandle}
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setViewDetailsDialog({ open: true, offer })}
                            data-testid={`button-view-my-details-${offer.id}`}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Create Offer Dialog */}
        <Dialog open={createOfferDialog} onOpenChange={setCreateOfferDialog}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-create-offer">
            <DialogHeader>
              <DialogTitle>Create NFT Swap Offer</DialogTitle>
              <DialogDescription>
                Specify the NFTs you want to trade and what you're looking for in return. All swaps use secure escrow.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              <Alert data-testid="alert-create-offer-security">
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  <strong>Security:</strong> Your NFTs will be held in secure escrow until both parties complete the trade. 
                  You maintain ownership until the swap is finalized.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Offered Items Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-green-600 dark:text-green-400">What You're Offering</h3>
                  
                  {/* Current Offered Items */}
                  {offerForm.offeredItems.length > 0 && (
                    <div className="space-y-2">
                      {offerForm.offeredItems.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-green-50 dark:bg-green-950 rounded p-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs">{item.chain.toUpperCase()}</Badge>
                              <span className="font-medium">{item.name || `Token #${item.tokenId}`}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {item.contract.substring(0, 20)}...#{item.tokenId}
                              {item.estimatedValue && ` • $${formatNumber(item.estimatedValue)}`}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeOfferedItem(idx)}
                            data-testid={`button-remove-offered-${idx}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Separator />
                    </div>
                  )}

                  {/* Add Offered Item Form */}
                  <div className="space-y-3 border rounded-lg p-4">
                    <h4 className="font-medium">Add NFT to Offer</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="offered-chain">Chain</Label>
                        <Select 
                          value={currentOfferedItem.chain} 
                          onValueChange={(value) => setCurrentOfferedItem({...currentOfferedItem, chain: value})}
                          data-testid="select-offered-chain"
                        >
                          <SelectTrigger id="offered-chain">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="xrp">XRP Ledger</SelectItem>
                            <SelectItem value="eth">Ethereum</SelectItem>
                            <SelectItem value="sol">Solana</SelectItem>
                            <SelectItem value="bnb">BNB Chain</SelectItem>
                            <SelectItem value="base">Base</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="offered-value">Est. Value ($)</Label>
                        <Input
                          id="offered-value"
                          type="number"
                          placeholder="1000"
                          value={currentOfferedItem.estimatedValue || ''}
                          onChange={(e) => setCurrentOfferedItem({
                            ...currentOfferedItem, 
                            estimatedValue: parseFloat(e.target.value) || undefined
                          })}
                          data-testid="input-offered-value"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="offered-contract">Contract Address / Issuer</Label>
                      <Input
                        id="offered-contract"
                        placeholder="Contract address or NFT issuer"
                        value={currentOfferedItem.contract}
                        onChange={(e) => setCurrentOfferedItem({...currentOfferedItem, contract: e.target.value})}
                        data-testid="input-offered-contract"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="offered-token-id">Token ID</Label>
                        <Input
                          id="offered-token-id"
                          placeholder="Token ID"
                          value={currentOfferedItem.tokenId}
                          onChange={(e) => setCurrentOfferedItem({...currentOfferedItem, tokenId: e.target.value})}
                          data-testid="input-offered-token-id"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="offered-name">Name (Optional)</Label>
                        <Input
                          id="offered-name"
                          placeholder="NFT Name"
                          value={currentOfferedItem.name}
                          onChange={(e) => setCurrentOfferedItem({...currentOfferedItem, name: e.target.value})}
                          data-testid="input-offered-name"
                        />
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={addOfferedItem} 
                      className="w-full"
                      data-testid="button-add-offered"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add to Offer
                    </Button>
                  </div>
                </div>

                {/* Wanted Items Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400">What You Want in Return</h3>
                  
                  {/* Current Wanted Items */}
                  {offerForm.wantedItems.length > 0 && (
                    <div className="space-y-2">
                      {offerForm.wantedItems.map((item, idx) => (
                        <div key={idx} className="flex items-start justify-between bg-blue-50 dark:bg-blue-950 rounded p-3">
                          <div className="flex-1">
                            <p className="font-medium text-sm mb-1">{item.description}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {item.chain && <Badge variant="outline" className="text-xs">{item.chain.toUpperCase()}</Badge>}
                              {item.minEstimatedValue && <span>Min: ${formatNumber(item.minEstimatedValue)}</span>}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeWantedItem(idx)}
                            data-testid={`button-remove-wanted-${idx}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Separator />
                    </div>
                  )}

                  {/* Add Wanted Item Form */}
                  <div className="space-y-3 border rounded-lg p-4">
                    <h4 className="font-medium">Add Requirement</h4>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label htmlFor="wanted-description">Description *</Label>
                        <Textarea
                          id="wanted-description"
                          placeholder="Describe what you want (e.g., 'Any CryptoPunk', 'Bored Ape with rare traits', 'Blue-chip NFT worth $5k+')"
                          value={currentWantedItem.description}
                          onChange={(e) => setCurrentWantedItem({...currentWantedItem, description: e.target.value})}
                          rows={2}
                          data-testid="textarea-wanted-description"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label htmlFor="wanted-chain">Chain (Optional)</Label>
                          <Select 
                            value={currentWantedItem.chain || ''} 
                            onValueChange={(value) => setCurrentWantedItem({...currentWantedItem, chain: value || undefined})}
                            data-testid="select-wanted-chain"
                          >
                            <SelectTrigger id="wanted-chain">
                              <SelectValue placeholder="Any chain" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">Any Chain</SelectItem>
                              <SelectItem value="xrp">XRP Ledger</SelectItem>
                              <SelectItem value="eth">Ethereum</SelectItem>
                              <SelectItem value="sol">Solana</SelectItem>
                              <SelectItem value="bnb">BNB Chain</SelectItem>
                              <SelectItem value="base">Base</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="wanted-min-value">Min Value ($)</Label>
                          <Input
                            id="wanted-min-value"
                            type="number"
                            placeholder="1000"
                            value={currentWantedItem.minEstimatedValue || ''}
                            onChange={(e) => setCurrentWantedItem({
                              ...currentWantedItem, 
                              minEstimatedValue: parseFloat(e.target.value) || undefined
                            })}
                            data-testid="input-wanted-min-value"
                          />
                        </div>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={addWantedItem} 
                      className="w-full"
                      data-testid="button-add-wanted"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Requirement
                    </Button>
                  </div>
                </div>
              </div>

              {/* Additional Options */}
              <div className="space-y-4">
                <Separator />
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="offer-description">Description (Optional)</Label>
                    <Textarea
                      id="offer-description"
                      placeholder="Add any additional details about your swap offer..."
                      value={offerForm.description}
                      onChange={(e) => setOfferForm({...offerForm, description: e.target.value})}
                      rows={2}
                      data-testid="textarea-offer-description"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="expires-at">Expires At (Optional)</Label>
                      <Input
                        id="expires-at"
                        type="datetime-local"
                        value={offerForm.expiresAt}
                        onChange={(e) => setOfferForm({...offerForm, expiresAt: e.target.value})}
                        min={new Date().toISOString().slice(0, 16)}
                        data-testid="input-expires-at"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="private-target">Private Offer Target (Optional)</Label>
                      <Input
                        id="private-target"
                        placeholder="@username"
                        value={offerForm.privateOfferTarget}
                        onChange={(e) => setOfferForm({
                          ...offerForm, 
                          privateOfferTarget: e.target.value,
                          isPrivateOffer: e.target.value.length > 0
                        })}
                        data-testid="input-private-target"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setCreateOfferDialog(false)}
                data-testid="button-cancel-create-offer"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateOffer}
                disabled={createOfferMutation.isPending}
                data-testid="button-confirm-create-offer"
              >
                {createOfferMutation.isPending ? 'Creating...' : 'Create Swap Offer'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Accept Offer Dialog */}
        <Dialog open={acceptOfferDialog.open} onOpenChange={(open) => setAcceptOfferDialog({ open, offer: acceptOfferDialog.offer })}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-accept-offer">
            <DialogHeader>
              <DialogTitle>Accept Swap Offer</DialogTitle>
              <DialogDescription>
                Review the offer details and specify which NFTs you'll provide in return.
              </DialogDescription>
            </DialogHeader>
            
            {acceptOfferDialog.offer && (
              <div className="space-y-6">
                {/* Offer Summary */}
                <Alert data-testid="alert-accept-offer-summary">
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{acceptOfferDialog.offer.makerHandle}</strong> is offering {acceptOfferDialog.offer.offeredItems.length} NFT(s) 
                    and wants {acceptOfferDialog.offer.wantedItems.length} requirement(s) in return.
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* What They're Offering */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-green-600 dark:text-green-400">They're Offering:</h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {acceptOfferDialog.offer.offeredItems.map((item, idx) => (
                        <div key={idx} className="bg-green-50 dark:bg-green-950 rounded p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">{item.chain.toUpperCase()}</Badge>
                            <span className="font-medium">{item.name || `Token #${item.tokenId}`}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {item.contract}#{item.tokenId}
                            {item.estimatedValue && ` • Value: $${formatNumber(item.estimatedValue)}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* What They Want */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-blue-600 dark:text-blue-400">They Want:</h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {acceptOfferDialog.offer.wantedItems.map((item, idx) => (
                        <div key={idx} className="bg-blue-50 dark:bg-blue-950 rounded p-3">
                          <p className="font-medium text-sm">{item.description}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            {item.chain && <Badge variant="outline" className="text-xs">{item.chain.toUpperCase()}</Badge>}
                            {item.minEstimatedValue && <span>Min: ${formatNumber(item.minEstimatedValue)}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Your Offer */}
                <div className="space-y-4">
                  <h3 className="font-semibold">Your NFTs to Trade</h3>
                  
                  {/* Current Taker Items */}
                  {acceptForm.takerItems.length > 0 && (
                    <div className="space-y-2">
                      {acceptForm.takerItems.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-muted rounded p-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs">{item.chain.toUpperCase()}</Badge>
                              <span className="font-medium">{item.name || `Token #${item.tokenId}`}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {item.contract.substring(0, 20)}...#{item.tokenId}
                              {item.estimatedValue && ` • $${formatNumber(item.estimatedValue)}`}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeTakerItem(idx)}
                            data-testid={`button-remove-taker-${idx}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Separator />
                    </div>
                  )}

                  {/* Add Taker Item Form */}
                  <div className="space-y-3 border rounded-lg p-4">
                    <h4 className="font-medium">Add Your NFT</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="taker-chain">Chain</Label>
                        <Select 
                          value={currentTakerItem.chain} 
                          onValueChange={(value) => setCurrentTakerItem({...currentTakerItem, chain: value})}
                          data-testid="select-taker-chain"
                        >
                          <SelectTrigger id="taker-chain">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="xrp">XRP Ledger</SelectItem>
                            <SelectItem value="eth">Ethereum</SelectItem>
                            <SelectItem value="sol">Solana</SelectItem>
                            <SelectItem value="bnb">BNB Chain</SelectItem>
                            <SelectItem value="base">Base</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="taker-value">Est. Value ($)</Label>
                        <Input
                          id="taker-value"
                          type="number"
                          placeholder="1000"
                          value={currentTakerItem.estimatedValue || ''}
                          onChange={(e) => setCurrentTakerItem({
                            ...currentTakerItem, 
                            estimatedValue: parseFloat(e.target.value) || undefined
                          })}
                          data-testid="input-taker-value"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="taker-contract">Contract Address / Issuer</Label>
                      <Input
                        id="taker-contract"
                        placeholder="Contract address or NFT issuer"
                        value={currentTakerItem.contract}
                        onChange={(e) => setCurrentTakerItem({...currentTakerItem, contract: e.target.value})}
                        data-testid="input-taker-contract"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="taker-token-id">Token ID</Label>
                        <Input
                          id="taker-token-id"
                          placeholder="Token ID"
                          value={currentTakerItem.tokenId}
                          onChange={(e) => setCurrentTakerItem({...currentTakerItem, tokenId: e.target.value})}
                          data-testid="input-taker-token-id"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="taker-name">Name (Optional)</Label>
                        <Input
                          id="taker-name"
                          placeholder="NFT Name"
                          value={currentTakerItem.name}
                          onChange={(e) => setCurrentTakerItem({...currentTakerItem, name: e.target.value})}
                          data-testid="input-taker-name"
                        />
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={addTakerItem} 
                      className="w-full"
                      data-testid="button-add-taker"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add NFT
                    </Button>
                  </div>

                  {/* Escrow Transaction Hash */}
                  <div className="space-y-2">
                    <Label htmlFor="escrow-tx">Escrow Transaction Hash</Label>
                    <Input
                      id="escrow-tx"
                      placeholder="Transaction hash from depositing NFTs to escrow"
                      value={acceptForm.takerEscrowTransactionHash}
                      onChange={(e) => setAcceptForm({...acceptForm, takerEscrowTransactionHash: e.target.value})}
                      data-testid="input-escrow-tx"
                    />
                    <p className="text-xs text-muted-foreground">
                      You must deposit your NFTs to the escrow address before accepting the offer.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setAcceptOfferDialog({ open: false, offer: null })}
                data-testid="button-cancel-accept-offer"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAcceptOffer}
                disabled={acceptOfferMutation.isPending}
                data-testid="button-confirm-accept-offer"
              >
                {acceptOfferMutation.isPending ? 'Accepting...' : 'Accept Swap Offer'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Details Dialog */}
        <Dialog open={viewDetailsDialog.open} onOpenChange={(open) => setViewDetailsDialog({ open, offer: viewDetailsDialog.offer })}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-view-details">
            <DialogHeader>
              <DialogTitle>Swap Offer Details</DialogTitle>
              <DialogDescription>
                Complete details for this NFT swap offer
              </DialogDescription>
            </DialogHeader>
            
            {viewDetailsDialog.offer && (
              <div className="space-y-6">
                {/* Offer Info */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">From: {viewDetailsDialog.offer.makerHandle}</h3>
                    <p className="text-sm text-muted-foreground">
                      Created {new Date(viewDetailsDialog.offer.createdAt).toLocaleDateString()}
                      {viewDetailsDialog.offer.expiresAt && 
                        ` • Expires ${new Date(viewDetailsDialog.offer.expiresAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  <Badge variant={getStatusColor(viewDetailsDialog.offer.status)} data-testid="badge-details-status">
                    {viewDetailsDialog.offer.status}
                  </Badge>
                </div>

                {viewDetailsDialog.offer.description && (
                  <div>
                    <h4 className="font-medium mb-2">Description</h4>
                    <p className="text-sm text-muted-foreground bg-muted rounded p-3">
                      {viewDetailsDialog.offer.description}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Offered Items */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-green-600 dark:text-green-400">
                      Offering ({viewDetailsDialog.offer.offeredItems.length} items)
                    </h4>
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {viewDetailsDialog.offer.offeredItems.map((item, idx) => (
                        <Card key={idx} className="bg-green-50 dark:bg-green-950" data-testid={`card-details-offered-${idx}`}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <Badge variant="outline" className="text-xs">{item.chain.toUpperCase()}</Badge>
                              {item.estimatedValue && (
                                <span className="text-green-600 dark:text-green-400 font-semibold">
                                  ${formatNumber(item.estimatedValue)}
                                </span>
                              )}
                            </div>
                            <h5 className="font-medium">{item.name || `Token #${item.tokenId}`}</h5>
                            <div className="text-xs text-muted-foreground space-y-1 mt-2">
                              <p>Contract: {item.contract}</p>
                              <p>Token ID: {item.tokenId}</p>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>

                  {/* Wanted Items */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-blue-600 dark:text-blue-400">
                      Wants ({viewDetailsDialog.offer.wantedItems.length} requirements)
                    </h4>
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {viewDetailsDialog.offer.wantedItems.map((item, idx) => (
                        <Card key={idx} className="bg-blue-50 dark:bg-blue-950" data-testid={`card-details-wanted-${idx}`}>
                          <CardContent className="p-4">
                            <p className="font-medium mb-2">{item.description}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {item.chain && <Badge variant="outline" className="text-xs">{item.chain.toUpperCase()}</Badge>}
                              {item.contract && <span>Contract: {item.contract}</span>}
                              {item.tokenId && <span>Token ID: {item.tokenId}</span>}
                              {item.minEstimatedValue && (
                                <span className="text-blue-600 dark:text-blue-400 font-medium">
                                  Min: ${formatNumber(item.minEstimatedValue)}
                                </span>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Match Info */}
                {viewDetailsDialog.offer.status !== 'open' && viewDetailsDialog.offer.takerHandle && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Match Details</h4>
                    <div className="bg-muted rounded p-3 text-sm">
                      <div className="flex justify-between items-center">
                        <span>Matched with: <strong>{viewDetailsDialog.offer.takerHandle}</strong></span>
                        <span>{viewDetailsDialog.offer.matchedAt && new Date(viewDetailsDialog.offer.matchedAt).toLocaleDateString()}</span>
                      </div>
                      {viewDetailsDialog.offer.escrowTransactionHash && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Escrow TX: {viewDetailsDialog.offer.escrowTransactionHash}
                        </p>
                      )}
                      {viewDetailsDialog.offer.completionTransactionHash && (
                        <p className="text-xs text-muted-foreground">
                          Completion TX: {viewDetailsDialog.offer.completionTransactionHash}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setViewDetailsDialog({ open: false, offer: null })}
                data-testid="button-close-details"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
