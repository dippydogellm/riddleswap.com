import { useState, useEffect, useRef, useCallback } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Package, DollarSign, Users, TrendingUp, Heart, Search, Filter, Grid, List, ShoppingCart, Layers, CheckCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { WalletRequiredPopup } from '@/components/WalletRequiredPopup';
import { BuyNowDialog } from '@/components/nft/BuyNowDialog';

// Type definitions
interface NFTData {
  nftokenID: string;
  name?: string;
  assets?: { image?: string };
  image?: string;
  sellPrice?: number;
  salePrice?: number;
  topBuyOffer?: number;
  forSale?: boolean;
  isForSale?: boolean;
  owner?: string;
  sell_offer_index?: string;
  nftMetadata?: {
    attributes?: Array<{
      trait_type: string;
      value: string;
    }>;
  };
}

interface CollectionData {
  collection: {
    name?: string;
    description?: string;
    image?: string;
    nfts: NFTData[];
    totalNFTs: number;
    floorPrice: number;
    floorPriceXRP?: number;
    owners: number;
    sales24h: number;
    listedCount: number;
    verified?: boolean;
    day?: {
      tradedNfts: number;
    };
    availableTraits?: Record<string, string[]>;
  };
}

interface ApiResponse {
  collection: CollectionData['collection'];
}

// Collection Stats Component
const CollectionStats = ({ stats }: { stats: any }) => {
  if (!stats) return null;
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <Package className="h-4 w-4 text-blue-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400">Items</span>
          </div>
          <div className="text-2xl font-bold">{stats.totalNFTs || 0}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <DollarSign className="h-4 w-4 text-green-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400">Floor Price</span>
          </div>
          <div className="text-2xl font-bold">
            {(stats.floorPrice > 0 || stats.floorPriceXRP > 0) ? `${(stats.floorPriceXRP || stats.floorPrice).toLocaleString()} XRP` : 'N/A'}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <Users className="h-4 w-4 text-purple-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400">Owners</span>
          </div>
          <div className="text-2xl font-bold">{stats.owners || 0}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <TrendingUp className="h-4 w-4 text-orange-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400">24h Sales</span>
          </div>
          <div className="text-2xl font-bold">{stats.sales24h || 0}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <Heart className="h-4 w-4 text-red-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400">Listed</span>
          </div>
          <div className="text-2xl font-bold">
            {stats.totalNFTs > 0 ? 
              `${((stats.listedCount || 0) / stats.totalNFTs * 100).toFixed(1)}%` : 
              '0%'
            }
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// NFT Card Component
const NFTCard = ({ nft, onBuyNow, onMakeOffer }: { nft: NFTData; onBuyNow: (nft: NFTData) => void; onMakeOffer: (nft: NFTData) => void }) => {
  const [, setLocation] = useLocation();
  
  const formatPrice = (price: any) => {
    if (!price) return 'Not Listed';
    const num = typeof price === 'string' ? parseFloat(price) : price;
    return `${num.toLocaleString()} XRP`;
  };
  
  return (
    <Card className="group hover:shadow-2xl transition-all duration-300 overflow-hidden border-0 shadow-lg bg-white dark:bg-gray-800">
      <div 
        className="relative cursor-pointer overflow-hidden"
        onClick={() => setLocation(`/nft/${nft.nftokenID}`)}
      >
        <img
          src={nft.assets?.image || nft.image || `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiNmM2Y0ZjYiLz48dGV4dCB4PSIxMDAiIHk9IjEwNSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM2YjcyODAiIHRleHQtYW5jaG9yPSJtaWRkbGUiPk5GVDwvdGV4dD48L3N2Zz4=`}
          alt={nft.name || 'NFT'}
          className="w-full h-64 object-cover group-hover:scale-110 transition-transform duration-500"
          onError={(e) => {
            e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiNmM2Y0ZjYiLz48dGV4dCB4PSIxMDAiIHk9IjEwNSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM2YjcyODAiIHRleHQtYW5jaG9yPSJtaWRkbGUiPk5GVDwvdGV4dD48L3N2Zz4=';
          }}
        />
        
        {/* Gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* Status Badges */}
        {(nft.forSale || nft.isForSale) && ((nft.sellPrice && nft.sellPrice > 0) || (nft.salePrice && nft.salePrice > 0)) && (
          <Badge className="absolute top-3 left-3 bg-green-600 text-white shadow-lg">
            For Sale
          </Badge>
        )}
        {nft.topBuyOffer && nft.topBuyOffer > 0 && (
          <Badge className="absolute top-3 right-3 bg-blue-600 text-white shadow-lg">
            Has Offers
          </Badge>
        )}
      </div>
      
      <CardContent className="p-5">
        <h3 className="font-bold text-xl mb-3 truncate text-gray-900 dark:text-white">
          {nft.name || `NFT #${nft.nftokenID?.slice(-4)}`}
        </h3>
        
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
            <span className="text-gray-600 dark:text-gray-300 font-medium">Price</span>
            <span className="font-bold text-lg text-gray-900 dark:text-white">
              {formatPrice(nft.sellPrice || nft.salePrice)}
            </span>
          </div>
          
          {nft.topBuyOffer && nft.topBuyOffer > 0 && (
            <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-300 font-medium">Top Offer</span>
              <span className="font-bold text-lg text-blue-600 dark:text-blue-400">
                {formatPrice(nft.topBuyOffer)}
              </span>
            </div>
          )}
          
          {/* Traits */}
          {nft.nftMetadata?.attributes && (
            <div className="mt-3">
              <div className="flex flex-wrap gap-1">
                {nft.nftMetadata.attributes.slice(0, 3).map((trait: any, index: number) => (
                  <Badge key={index} variant="outline" className="text-xs dark:border-gray-600 dark:text-gray-300">
                    {trait.trait_type}: {trait.value}
                  </Badge>
                ))}
                {nft.nftMetadata.attributes.length > 3 && (
                  <Badge variant="outline" className="text-xs dark:border-gray-600 dark:text-gray-300">
                    +{nft.nftMetadata.attributes.length - 3} more
                  </Badge>
                )}
              </div>
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="flex gap-2 mt-4">
            {(nft.forSale || nft.isForSale) && ((nft.sellPrice && nft.sellPrice > 0) || (nft.salePrice && nft.salePrice > 0)) && (
              <Button 
                className="flex-1 bg-green-600 hover:bg-green-700 text-white dark:bg-green-600 dark:hover:bg-green-700"
                onClick={(e) => {
                  e.stopPropagation();
                  onBuyNow(nft);
                }}
              >
                Buy Now
              </Button>
            )}
            <Button 
              variant="outline" 
              className="flex-1 border-blue-600 text-blue-600 hover:bg-blue-50 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-900/20"
              onClick={(e) => {
                e.stopPropagation();
                onMakeOffer(nft);
              }}
            >
              Make Offer
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Trait Filter Component
const TraitFilters = ({ traits, selectedTraits, onTraitChange }: { 
  traits: Record<string, any[]>; 
  selectedTraits: Record<string, string[]>;
  onTraitChange: (category: string, value: string, checked: boolean) => void;
}) => {
  if (!traits || Object.keys(traits).length === 0) return null;

  return (
    <div className="bg-white p-6 rounded-xl border shadow-sm">
      <div className="flex items-center gap-2 mb-6">
        <Filter className="w-5 h-5 text-blue-600" />
        <h3 className="font-bold text-lg">Filter by Traits</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Object.entries(traits).map(([category, values]) => (
          <div key={category} className="space-y-3">
            <h4 className="font-semibold text-gray-800 capitalize border-b pb-2">{category}</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {values.slice(0, 15).map((trait) => (
                <label 
                  key={`${category}-${trait.value}`} 
                  className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedTraits[category]?.includes(trait.value) || false}
                    onChange={(e) => onTraitChange(category, trait.value, e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 flex-1">
                    {trait.value}
                  </span>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                    {trait.count || 0}
                  </span>
                </label>
              ))}
              {values.length > 15 && (
                <p className="text-xs text-gray-500 italic p-2">+{values.length - 15} more traits</p>
              )}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};

// Main Component
export default function NFTCollectionDetail() {
  // Try both XRPL and multi-chain routes
  const [, xrplParams] = useRoute('/nft-collection/:issuer/:taxon');
  const [, multiChainParams] = useRoute('/nft-collection/:chain/:contractAddress');
  const [, setLocation] = useLocation();
  
  // Determine if this is XRPL or multi-chain based on which route matched
  const isXRPL = !!xrplParams?.issuer && !!xrplParams?.taxon;
  const isMultiChain = !!multiChainParams?.chain && !!multiChainParams?.contractAddress;
  
  // Extract params based on route type
  const issuer = xrplParams?.issuer;
  const taxon = xrplParams?.taxon;
  const chain = multiChainParams?.chain;
  const contractAddress = multiChainParams?.contractAddress;
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('price-low');
  const [viewMode, setViewMode] = useState('grid');
  const [showTraits, setShowTraits] = useState(false);
  const [selectedTraits, setSelectedTraits] = useState<Record<string, string[]>>({});
  const [page, setPage] = useState(1);
  
  // Floor sweep state
  const [showFloorSweep, setShowFloorSweep] = useState(false);
  const [sweepQuantity, setSweepQuantity] = useState([1]);
  const [sweepLoading, setSweepLoading] = useState(false);
  const [showWalletPopup, setShowWalletPopup] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [selectedNFTForBuy, setSelectedNFTForBuy] = useState<NFTData | null>(null);
  const [allNFTs, setAllNFTs] = useState<NFTData[]>([]);
  const [hasMore, setHasMore] = useState(true);
  
  const observer = useRef<IntersectionObserver>();
  
  // Fetch collection data (XRPL)
  const { data: xrplCollectionData, isLoading: isLoadingXRPL } = useQuery<ApiResponse>({
    queryKey: [`/api/nft-collection/${issuer}/${taxon}?live=true`],
    enabled: isXRPL && !!issuer && !!taxon
  });
  
  // Fetch multi-chain collection data (Moralis) - DISABLED FOR NOW (no endpoint yet)
  const multiChainCollectionData = null;
  const isLoadingMultiChain = false;
  
  // Merge data sources
  const collectionData = isXRPL ? xrplCollectionData : multiChainCollectionData;
  const isLoading = isXRPL ? isLoadingXRPL : isLoadingMultiChain;
  
  console.log(`🔍 [NFT Collection Detail] Type: ${isXRPL ? 'XRPL' : 'Multi-Chain'}, Issuer: ${issuer}, Taxon: ${taxon}, Chain: ${chain}, Contract: ${contractAddress}`);

  // Set initial NFTs when collection data loads - show ALL NFTs now
  useEffect(() => {
    if (collectionData?.collection?.nfts) {
      // Show ALL NFTs, not just for-sale ones
      const allNfts = collectionData.collection.nfts;
      
      setAllNFTs(allNfts.slice(0, 50)); // First 50 NFTs
      setHasMore(allNfts.length > 50);
      
      // Calculate for-sale count for logging
      const forSaleCount = allNfts.filter(nft => 
        (nft.forSale || nft.isForSale) && 
        ((nft.sellPrice && nft.sellPrice > 0) || (nft.salePrice && nft.salePrice > 0))
      ).length;
      
      console.log(`📊 [COLLECTION] Total: ${allNfts.length} NFTs, ${forSaleCount} for sale, Floor: ${collectionData.collection.floorPrice} XRP`);
    }
  }, [collectionData]);

  // Load more NFTs function - load ALL NFTs
  const loadMoreNFTs = useCallback(() => {
    if (!collectionData?.collection?.nfts || !hasMore) return;
    
    // Show ALL NFTs, not just for-sale ones
    const allNfts = collectionData.collection.nfts;
    
    const nextPage = page + 1;
    const startIndex = (nextPage - 1) * 50;
    const endIndex = startIndex + 50;
    const newNFTs = allNfts.slice(startIndex, endIndex);
    
    if (newNFTs.length > 0) {
      setAllNFTs(prev => [...prev, ...newNFTs]);
      setPage(nextPage);
      setHasMore(endIndex < allNfts.length);
      console.log(`🔄 [INFINITE SCROLL] Loaded page ${nextPage}, showing ${endIndex} of ${allNfts.length} total NFTs`);
    } else {
      setHasMore(false);
      console.log('🔄 [INFINITE SCROLL] No more NFTs to load');
    }
  }, [collectionData?.collection?.nfts, page, hasMore]);

  // Infinite scroll ref
  const lastNFTElementRef = useCallback((node: any) => {
    if (isLoading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        loadMoreNFTs();
      }
    });
    if (node) observer.current.observe(node);
  }, [isLoading, hasMore, loadMoreNFTs]);

  // Filter and sort NFTs
  const filteredAndSortedNFTs = useCallback(() => {
    if (!allNFTs) return [];
    
    let filtered = allNFTs.filter(nft => {
      // Search filtering
      const searchMatch = searchTerm === '' || 
        nft.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        nft.nftokenID?.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Trait filtering - fix the logic
      const traitMatch = Object.keys(selectedTraits).length === 0 || 
        Object.entries(selectedTraits).some(([category, values]) => {
          if (values.length === 0) return true;
          const nftTraits = nft.nftMetadata?.attributes || [];
          return nftTraits.some((trait: any) => 
            trait.trait_type?.toLowerCase() === category.toLowerCase() && 
            values.includes(trait.value)
          );
        });
      
      return searchMatch && traitMatch;
    });

    // Sort NFTs
    filtered.sort((a, b) => {
      const priceA = a.sellPrice || a.salePrice || 0;
      const priceB = b.sellPrice || b.salePrice || 0;
      
      switch (sortBy) {
        case 'price-low':
          if (priceA === 0 && priceB === 0) return 0;
          if (priceA === 0) return 1;
          if (priceB === 0) return -1;
          return priceA - priceB;
        case 'price-high':
          return priceB - priceA;
        case 'name':
          return (a.name || '').localeCompare(b.name || '');
        default:
          return 0;
      }
    });

    return filtered;
  }, [allNFTs, searchTerm, selectedTraits, sortBy]);

  const handleTraitChange = (category: string, value: string, checked: boolean) => {
    setSelectedTraits(prev => {
      const newTraits = { ...prev };
      if (!newTraits[category]) newTraits[category] = [];
      
      if (checked) {
        newTraits[category] = [...newTraits[category], value];
      } else {
        newTraits[category] = newTraits[category].filter(v => v !== value);
        if (newTraits[category].length === 0) {
          delete newTraits[category];
        }
      }
      return newTraits;
    });
  };

  // Buy Now with broker system - session cache, no password
  const handleBuyNow = (nft: NFTData) => {
    console.log('🛒 [BUY NOW] Opening buy modal for NFT:', nft);
    
    // Check wallet connection
    const sessionToken = localStorage.getItem('riddle_session_token');
    const sessionData = localStorage.getItem('sessionData');
    
    if (!sessionToken || !sessionData) {
      setShowWalletPopup(true);
      return;
    }

    try {
      const session = JSON.parse(sessionData);
      const currentUserAddress = session.wallet?.xrpAddress || session.xrpAddress;
      
      if (!currentUserAddress) {
        alert('Unable to get wallet address');
        return;
      }

      // Prepare NFT data for broker buy modal
      const nftForBuy = {
        nftokenID: nft.nftokenID,
        name: nft.name || `NFT #${nft.nftokenID?.slice(-4)}`,
        image: nft.assets?.image || nft.image,
        sellPrice: nft.sellPrice || nft.salePrice || 0,
        owner: nft.owner || '',
        sell_offer_index: nft.sell_offer_index || ''
      };

      setSelectedNFTForBuy(nftForBuy);
      setShowBuyModal(true);

    } catch (error) {
      console.error('Buy modal error:', error);
      alert('Failed to open buy modal');
    }
  };

  // Broker buy confirmation handler
  const handleBuyNowConfirm = async () => {
    if (!selectedNFTForBuy) return { success: false, error: 'No NFT selected' };

    const sessionToken = localStorage.getItem('riddle_session_token');
    const sessionData = localStorage.getItem('sessionData');
    
    if (!sessionToken || !sessionData) {
      return { success: false, error: 'Not authenticated' };
    }

    const session = JSON.parse(sessionData);
    const currentUserAddress = session.wallet?.xrpAddress || session.xrpAddress;

    try {
      const response = await fetch('/api/broker/confirm-buy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        credentials: 'include',
        body: JSON.stringify({
          nftTokenId: selectedNFTForBuy.nftokenID,
          sellOfferIndex: selectedNFTForBuy.sell_offer_index,
          buyPrice: selectedNFTForBuy.sellPrice.toString(),
          nftOwner: selectedNFTForBuy.owner
        })
      });

      const data = await response.json() as any;
      
      if (data.success) {
        return { success: true, txHash: data.txHash };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const handleBuyCollection = () => {
    // Navigate to the collection's for-sale items
    const currentPath = window.location.pathname;
    window.location.href = currentPath + '?view=for-sale';
  };
  
  const handleMakeOffer = async (nft: NFTData) => {
    console.log('Make Offer clicked for:', nft);
    
    // Get current user wallet
    const sessionData = localStorage.getItem('sessionData');
    const walletData = localStorage.getItem('walletData');
    const sessionToken = localStorage.getItem('sessionToken');
    
    if (!sessionData || !walletData || !sessionToken) {
      setShowWalletPopup(true);
      return;
    }

    try {
      const session = JSON.parse(sessionData);
      const wallet = JSON.parse(walletData);
      const currentUserAddress = session.wallet?.xrpAddress || session.xrpAddress;
      
      if (!currentUserAddress) {
        alert('Unable to get wallet address');
        return;
      }

      const offerAmount = prompt('Enter your offer amount in XRP:');
      if (!offerAmount || parseFloat(offerAmount) <= 0) {
        return;
      }

      const response = await fetch('/api/nft/make-offer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          nftId: nft.nftokenID,
          fromWallet: currentUserAddress,
          toWallet: issuer, // Use issuer as default target
          offerAmount: parseFloat(offerAmount),
          walletHandle: wallet.handle || 'RiddleWallet',
          message: `Offer for NFT ${nft.name || nft.nftokenID}`
        })
      });

      const data = await response.json() as any;
      
      if (data.success) {
        alert(`Offer of ${offerAmount} XRP submitted successfully`);
      } else {
        alert(data.error || 'Failed to submit offer');
      }
    } catch (error) {
      console.error('Make offer error:', error);
      alert('Failed to submit offer');
    }
  };

  // Floor sweep functionality - Enhanced to work with Bithomp data
  const getFloorPriceNFTs = useCallback(() => {
    if (!allNFTs || allNFTs.length === 0) {
      console.log('🔍 [FLOOR SWEEP] No NFTs available in allNFTs');
      return [];
    }
    
    // Get NFTs that are for sale and sort by price - enhanced filtering
    const forSaleNFTs = allNFTs
      .filter(nft => {
        // More flexible check for NFTs with prices
        const hasPrice = (nft.sellPrice && nft.sellPrice > 0) || (nft.salePrice && nft.salePrice > 0);
        const isForSale = nft.forSale || nft.isForSale || hasPrice;
        
        console.log(`🔍 [FLOOR SWEEP] NFT ${nft.nftokenID?.slice(-6)}: forSale=${nft.forSale}, isForSale=${nft.isForSale}, sellPrice=${nft.sellPrice}, salePrice=${nft.salePrice}, hasPrice=${hasPrice}, isForSale=${isForSale}`);
        
        return isForSale && hasPrice;
      })
      .sort((a, b) => {
        const priceA = a.sellPrice || a.salePrice || 0;
        const priceB = b.sellPrice || b.salePrice || 0;
        return priceA - priceB;
      });
    
    console.log(`✅ [FLOOR SWEEP] Found ${forSaleNFTs.length} NFTs available for floor sweep`);
    return forSaleNFTs;
  }, [allNFTs]);

  const calculateSweepTotal = useCallback(() => {
    const floorNFTs = getFloorPriceNFTs();
    const quantity = sweepQuantity[0];
    let total = 0;
    
    for (let i = 0; i < Math.min(quantity, floorNFTs.length); i++) {
      const nft = floorNFTs[i];
      const price = nft.sellPrice || nft.salePrice || 0;
      total += price;
    }
    
    // Add 1.589% broker fee (matching backend RIDDLE_BROKER_CONFIG.feePercentage)
    const brokerFeeAmount = total * 0.01589;
    const networkFeeAmount = 0.000012; // Standard XRPL network fee per transaction
    const grandTotal = total + brokerFeeAmount + networkFeeAmount;
    
    return { 
      total, 
      feeAmount: brokerFeeAmount, 
      networkFee: networkFeeAmount,
      grandTotal 
    };
  }, [getFloorPriceNFTs, sweepQuantity]);

  const handleFloorSweep = async () => {
    const sessionData = localStorage.getItem('sessionData');
    const walletData = localStorage.getItem('walletData');
    
    if (!sessionData || !walletData) {
      setShowWalletPopup(true);
      return;
    }

    setSweepLoading(true);
    
    try {
      const session = JSON.parse(sessionData);
      const wallet = JSON.parse(walletData);
      const currentUserAddress = session.wallet?.xrpAddress || session.xrpAddress;
      
      if (!currentUserAddress) {
        alert('Unable to get wallet address');
        return;
      }

      const floorNFTs = getFloorPriceNFTs();
      const quantity = sweepQuantity[0];
      const nftsToBuy = floorNFTs.slice(0, quantity);
      
      if (nftsToBuy.length === 0) {
        alert('No NFTs available for floor sweep');
        return;
      }

      const { grandTotal } = calculateSweepTotal();
      
      if (!confirm(`Floor sweep ${nftsToBuy.length} NFTs for ${grandTotal.toFixed(2)} XRP total (including fees)?`)) {
        return;
      }

      // Process each NFT purchase
      let successCount = 0;
      const errors = [];

      for (const nft of nftsToBuy) {
        try {
          const response = await fetch('/api/nft/buy-now', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              nftId: nft.nftokenID,
              buyerWallet: currentUserAddress,
              price: nft.sellPrice || nft.salePrice,
              walletHandle: wallet.handle || 'RiddleWallet',
              password: 'Neverknow1.' // Demo password
            })
          });

          const data = await response.json() as any;
          
          if (data.success) {
            successCount++;
          } else {
            errors.push(`${nft.name || nft.nftokenID}: ${data.error}`);
          }
        } catch (error) {
          errors.push(`${nft.name || nft.nftokenID}: Network error`);
        }
      }

      if (successCount > 0) {
        alert(`Floor sweep completed! Successfully purchased ${successCount}/${nftsToBuy.length} NFTs`);
        setShowFloorSweep(false);
      }
      
      if (errors.length > 0) {
        console.error('Floor sweep errors:', errors);
      }
      
    } catch (error) {
      console.error('Floor sweep error:', error);
      alert('Failed to process floor sweep');
    } finally {
      setSweepLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-300 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-300 rounded w-1/2 mb-8"></div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-300 rounded"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-96 bg-gray-300 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!collectionData?.collection) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Collection Not Found</h1>
        <Button onClick={() => setLocation('/nft-marketplace')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Marketplace
        </Button>
      </div>
    );
  }

  const displayedNFTs = filteredAndSortedNFTs();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Collection Banner */}
      {collectionData?.collection && (
        <div className="relative h-64 bg-gradient-to-r from-blue-600 to-purple-600 overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 bg-black bg-opacity-30"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black opacity-60"></div>
          
          {/* Collection Header Content */}
          <div className="relative container mx-auto px-4 h-full flex items-end pb-8">
            <div className="flex items-end gap-6 w-full">
              {/* Collection Image */}
              <div className="flex-shrink-0">
                <div className="w-32 h-32 bg-white rounded-lg p-2 shadow-lg">
                  {collectionData.collection.image ? (
                    <img
                      src={collectionData.collection.image}
                      alt={collectionData.collection.name || 'Collection'}
                      className="w-full h-full object-cover rounded-md"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.setAttribute('style', 'display: flex');
                      }}
                    />
                  ) : null}
                  <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-md" style={{ display: collectionData.collection.image ? 'none' : 'flex' }}>
                    <Layers className="w-12 h-12 text-gray-400" />
                  </div>
                </div>
              </div>
              
              {/* Collection Info */}
              <div className="flex-1 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <Button 
                    variant="ghost" 
                    onClick={() => setLocation('/nft-marketplace')}
                    className="text-white hover:bg-white/20 p-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-4xl font-bold">{collectionData.collection.name || 'Unnamed Collection'}</h1>
                  {collectionData.collection.verified && (
                    <Badge variant="default" className="bg-blue-500 text-white flex items-center gap-1 px-3 py-1">
                      <CheckCircle className="w-4 h-4" />
                      Verified
                    </Badge>
                  )}
                </div>
                <p className="text-lg text-gray-200 mb-3 max-w-2xl">{collectionData.collection.description || 'No description available'}</p>
                <div className="flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    <span>{(collectionData.collection.totalNFTs || 0).toLocaleString()} items</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span>{(collectionData.collection.owners || 0).toLocaleString()} owners</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    <span>Floor: {(collectionData.collection.floorPriceXRP || collectionData.collection.floorPrice || 0).toLocaleString()} XRP</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-3 text-xs text-gray-300">
                  <span>Issuer: {issuer}</span>
                  <span>Taxon: {taxon}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Collection Links Section - Only show for taxon 2 and 9 collections */}
      {collectionData?.collection && (issuer === 'rp5DGDDFZdQswWfn3sgkQznCAj9SkkCMLH') && (taxon === '2' || taxon === '9') && (
        <div className="container mx-auto px-4 py-6 border-b border-gray-200 dark:border-gray-700">
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-6">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
              
              {/* Collection Info */}
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">
                  {taxon === '2' ? 'The Titanium/Platinum/Sapphire Collection' : 'Under the Bridge'}
                </h3>
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600 dark:text-gray-400">
                      {collectionData?.collection?.totalNFTs || 0} out of {taxon === '2' ? '3,210' : '1,230'} minted
                    </span>
                    <span className="font-medium">
                      {Math.round((((collectionData?.collection?.totalNFTs || 0) / (taxon === '2' ? 3210 : 1230)) * 100))}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                    <div 
                      className="h-3 rounded-full transition-all duration-300 bg-gradient-to-r from-blue-500 to-purple-500"
                      style={{width: `${Math.min(100, Math.round((((collectionData?.collection?.totalNFTs || 0) / (taxon === '2' ? 3210 : 1230)) * 100)))}%`}}
                    ></div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                  <span>Collection on XRP.cafe</span>
                  <span>•</span>
                  <span>Status: {((collectionData?.collection?.totalNFTs || 0) < (taxon === '2' ? 3210 : 1230)) ? 'Live Minting' : 'Fully Minted'}</span>
                </div>
              </div>

              {/* Collection Actions */}
              <div className="flex flex-col items-center gap-3">
                <Button 
                  size="lg" 
                  className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-8 py-3 text-lg font-medium"
                  onClick={() => window.open(`https://xrp.cafe/nft/${issuer}/${taxon}`, '_blank')}
                >
                  🌐 View on XRP.cafe
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  className="border-blue-500 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950 px-8 py-3 text-lg font-medium"
                  onClick={handleBuyCollection}
                >
                  🛒 Buy from Collection
                </Button>
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  {collectionData?.collection?.listedCount || 0} items available for purchase
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-8">

      {/* Stats */}
      <CollectionStats stats={{
        totalNFTs: collectionData?.collection?.totalNFTs || 0,
        floorPrice: collectionData?.collection?.floorPriceXRP || collectionData?.collection?.floorPrice || 0,
        floorPriceXRP: collectionData?.collection?.floorPriceXRP || collectionData?.collection?.floorPrice || 0,
        owners: collectionData?.collection?.owners || 0,
        sales24h: collectionData?.collection?.day?.tradedNfts || 0,
        listedCount: collectionData?.collection?.listedCount || 0
      }} />

      {/* Controls */}
      <div className="flex flex-col lg:flex-row gap-4 mb-6">
        <div className="flex-1 flex gap-4">
          <Input
            placeholder="Search NFTs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white"
          />
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="price-low">Price: Low to High</SelectItem>
              <SelectItem value="price-high">Price: High to Low</SelectItem>
              <SelectItem value="name">Name</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => setShowTraits(!showTraits)}
          >
            <Filter className="w-4 h-4 mr-2" />
            Traits
          </Button>

          {/* Floor Sweep Button */}
          <Dialog open={showFloorSweep} onOpenChange={setShowFloorSweep}>
            <DialogTrigger asChild>
              <Button
                variant="default"
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                Floor Sweep
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Floor Sweep Purchase</DialogTitle>
              </DialogHeader>
              <div className="space-y-6 flex-1 overflow-y-auto pr-2">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Buy multiple NFTs starting from the lowest price
                    </p>
                    <div className="text-lg font-semibold">
                      Floor Price: {(collectionData?.collection?.floorPriceXRP || collectionData?.collection?.floorPrice || 0).toLocaleString()} XRP
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Quantity: {sweepQuantity[0]} NFTs
                    </label>
                    <Slider
                      value={sweepQuantity}
                      onValueChange={setSweepQuantity}
                      min={1}
                      max={Math.min(getFloorPriceNFTs().length, 20)}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                      <span>1</span>
                      <span>{Math.min(getFloorPriceNFTs().length, 20)}</span>
                    </div>
                  </div>

                  {/* NFTs Preview */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium">NFTs to Purchase:</label>
                    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg max-h-60 overflow-y-auto">
                      <div className="space-y-2">
                        {getFloorPriceNFTs().slice(0, sweepQuantity[0]).map((nft, index) => (
                          <div key={nft.nftokenID} className="flex items-center gap-3 p-2 bg-white dark:bg-gray-700 rounded border">
                            <img
                              src={nft.assets?.image || nft.image || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIGZpbGw9IiNmM2Y0ZjYiLz48dGV4dCB4PSIyMCIgeT0iMjQiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjgiIGZpbGw9IiM2YjcyODAiIHRleHQtYW5jaG9yPSJtaWRkbGUiPk5GVDwvdGV4dD48L3N2Zz4='}
                              alt={nft.name || 'NFT'}
                              className="w-10 h-10 object-cover rounded"
                              onError={(e) => {
                                e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIGZpbGw9IiNmM2Y0ZjYiLz48dGV4dCB4PSIyMCIgeT0iMjQiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjgiIGZpbGw9IiM2YjcyODAiIHRleHQtYW5jaG9yPSJtaWRkbGUiPk5GVDwvdGV4dD48L3N2Zz4=';
                              }}
                            />
                            <div className="flex-1">
                              <div className="font-medium text-sm">{nft.name || `NFT #${nft.nftokenID?.slice(-4)}`}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">#{index + 1} cheapest</div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold">{(nft.sellPrice || nft.salePrice || 0).toLocaleString()} XRP</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal ({sweepQuantity[0]} NFTs):</span>
                      <span>{calculateSweepTotal().total.toFixed(2)} XRP</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Broker Fee (1.589%):</span>
                      <span>{calculateSweepTotal().feeAmount.toFixed(6)} XRP</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Network Fee:</span>
                      <span>{calculateSweepTotal().networkFee.toFixed(6)} XRP</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg border-t pt-2">
                      <span>Total Cost:</span>
                      <span>{calculateSweepTotal().grandTotal.toFixed(6)} XRP</span>
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    This will purchase the {sweepQuantity[0]} cheapest available NFTs from this collection. All transactions include RiddleSwap broker fees.
                  </div>
                </div>

              </div>
              
              {/* Fixed bottom buttons */}
              <div className="border-t pt-4 mt-4 bg-white dark:bg-gray-900">
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowFloorSweep(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleFloorSweep}
                    disabled={sweepLoading}
                    className="flex-1 bg-orange-600 hover:bg-orange-700"
                  >
                    {sweepLoading ? 'Processing...' : `Buy ${sweepQuantity[0]} NFTs Now`}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <Grid className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Trait Filters */}
      {showTraits && collectionData?.collection?.availableTraits && (
        <div className="mb-6">
          <TraitFilters 
            traits={collectionData.collection.availableTraits} 
            selectedTraits={selectedTraits}
            onTraitChange={handleTraitChange}
          />
        </div>
      )}

      {/* Results count */}
      <div className="flex justify-between items-center mb-6">
        <span className="text-gray-600 dark:text-gray-300">
          {displayedNFTs.length} of {allNFTs.length} NFTs
        </span>
      </div>

      {/* NFT Grid */}
      <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4' : 'grid-cols-1'}`}>
        {displayedNFTs.map((nft, index) => (
          <div
            key={nft.nftokenID}
            ref={index === displayedNFTs.length - 1 ? lastNFTElementRef : null}
          >
            <NFTCard 
              nft={nft} 
              onBuyNow={handleBuyNow}
              onMakeOffer={handleMakeOffer}
            />
          </div>
        ))}
      </div>

      {/* Loading more indicator */}
      {hasMore && displayedNFTs.length > 0 && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 dark:text-gray-300 mt-2">Loading more for-sale NFTs...</p>
        </div>
      )}
      
      {/* End message when no more items */}
      {!hasMore && displayedNFTs.length > 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400">You've seen all for-sale NFTs in this collection</p>
        </div>
      )}

      {displayedNFTs.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">No NFTs found matching your criteria.</p>
        </div>
      )}

      {/* Wallet Required Popup */}
      <WalletRequiredPopup
        isOpen={showWalletPopup}
        onClose={() => setShowWalletPopup(false)}
        onWalletSelected={(walletType, address) => {
          console.log('Wallet selected:', walletType, address);
          setShowWalletPopup(false);
        }}
      />

      {/* Buy Now Dialog - Broker System */}
      {selectedNFTForBuy && (
        <BuyNowDialog
          open={showBuyModal}
          onClose={() => {
            setShowBuyModal(false);
            setSelectedNFTForBuy(null);
          }}
          onConfirm={handleBuyNowConfirm}
          nftName={selectedNFTForBuy.name || `NFT #${selectedNFTForBuy.nftokenID?.slice(-8) || 'Unknown'}`}
          nftImage={selectedNFTForBuy.image}
          sellOffer={{
            index: selectedNFTForBuy.sell_offer_index || '',
            amountXRP: selectedNFTForBuy.sellPrice?.toString() || '0',
            owner: selectedNFTForBuy.owner || ''
          }}
          currentUserAddress={(() => {
            try {
              const sessionData = localStorage.getItem('sessionData');
              if (sessionData) {
                const session = JSON.parse(sessionData);
                return session.wallet?.xrpAddress || session.xrpAddress;
              }
            } catch (error) {
              console.error('Error getting buyer wallet:', error);
            }
            return undefined;
          })()}
          brokerFeePercent={1.589}
        />
      )}
    </div>
    </div>
  );
}
