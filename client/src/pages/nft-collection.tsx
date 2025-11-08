import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useParams, useLocation } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { ShoppingCart, Eye, Heart, Share2, Filter, Grid, List, Zap, Clock, Coins } from 'lucide-react';
import { FastImage } from '@/components/fast-image';
import { WalletRequiredPopup } from '@/components/WalletRequiredPopup';
import { BuyNowDialog } from '@/components/nft/BuyNowDialog';
import '@/styles/nft-collection.css';

export default function NFTCollection() {
  const { taxon } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedNFT, setSelectedNFT] = useState<any>(null);
  const [showBuyDialog, setShowBuyDialog] = useState(false);
  const [showOfferDialog, setShowOfferDialog] = useState(false);
  const [showMintDialog, setShowMintDialog] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [offerAmount, setOfferAmount] = useState('');
  const [mintQuantity, setMintQuantity] = useState(1);
  const [collection, setCollection] = useState<any>(null);
  const [nfts, setNfts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showWalletRequired, setShowWalletRequired] = useState(false);
  const [isMinting, setIsMinting] = useState(false);


  useEffect(() => {
    fetchCollectionData();
  }, [taxon]);

  // Check if user is logged in
  const isLoggedIn = () => {
    const sessionToken = localStorage.getItem('sessionToken');
    const riddleWallet = localStorage.getItem('riddleWallet');
    return sessionToken && riddleWallet;
  };

  const fetchCollectionData = async () => {
    if (!taxon) return;
    
    setIsLoading(true);
    try {
      // Parse issuer:taxon format
      const [issuer, taxonNum] = taxon.includes(':') ? taxon.split(':') : [taxon, ''];
      
      // LIVE DATA ONLY, NO CACHE
      console.log(`🔍 Fetching LIVE collection data for issuer: ${issuer}, taxon: ${taxonNum}`);
      const response = await fetch(`/api/nft-collection/${issuer}/${taxonNum}?t=${Date.now()}&live=true`, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      
      if (response.ok) {
        const data = await response.json() as any;
        setCollection(data);
        setNfts(data.nfts || []);
      }
    } catch (error) {
      console.error('Failed to fetch collection data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Buy Now with broker system - session cache, no password
  const handleBuyNowConfirm = async () => {
    if (!selectedNFT) return { success: false, error: 'No NFT selected' };

    const sessionToken = localStorage.getItem('riddle_session_token');
    const sessionData = localStorage.getItem('sessionData');
    
    if (!sessionToken || !sessionData) {
      return { success: false, error: 'Not authenticated' };
    }

    const session = JSON.parse(sessionData);
    const currentUserAddress = session.wallet?.xrpAddress || session.xrpAddress;
    
    if (!currentUserAddress) {
      return { success: false, error: 'Unable to get wallet address' };
    }

    try {
      const response = await fetch('/api/broker/confirm-buy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        credentials: 'include',
        body: JSON.stringify({
          nftTokenId: selectedNFT.nft_id,
          sellOfferIndex: selectedNFT.sell_offer_index,
          buyPrice: selectedNFT.list_price,
          nftOwner: selectedNFT.owner || selectedNFT.issuer
        })
      });

      const data = await response.json() as any;
      
      if (data.success) {
        toast({
          title: "Purchase Successful!",
          description: `NFT purchased successfully. TX: ${data.txHash?.slice(0, 8)}...`
        });
        fetchCollectionData(); // Refresh
        return { success: true, txHash: data.txHash };
      } else {
        toast({
          title: "Purchase Failed",
          description: data.error || 'Failed to purchase NFT',
          variant: "destructive"
        });
        return { success: false, error: data.error };
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to purchase NFT",
        variant: "destructive"
      });
      return { success: false, error: error.message };
    }
  };

  // Create sell offer function
  const handleSellNFT = async (data: { nft_id: string; amount: string }) => {
    try {
      const sessionToken = localStorage.getItem('sessionToken');
      if (!sessionToken) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/nft/sell`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        toast({
          title: "Listed Successfully",
          description: "Your NFT has been listed for sale.",
        });
        setShowOfferDialog(false);
        fetchCollectionData(); // Refresh data
      } else {
        throw new Error('Failed to list NFT');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to list NFT",
        variant: "destructive"
      });
    }
  };

  // Mint NFT function
  const handleMintNFT = async (data: { quantity: number }) => {
    try {
      const sessionToken = localStorage.getItem('sessionToken');
      if (!sessionToken) {
        setShowWalletRequired(true);
        return;
      }

      const response = await fetch(`/api/nft/mint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
          'x-session-token': sessionToken
        },
        body: JSON.stringify({
          taxon: collection?.taxon || parseInt(taxon),
          quantity: data.quantity,
          metadataUri: collection?.baseUri || `https://api.riddleswap.com/nft-metadata/${collection?.taxon || taxon}/${Date.now()}`
        })
      });

      if (response.ok) {
        const result = await response.json() as any;
        toast({
          title: "Mint Successful!",
          description: `Successfully minted ${data.quantity} NFT(s) from ${collection?.name}`,
        });
        setShowMintDialog(false);
        fetchCollectionData(); // Refresh data
        return result;
      } else {
        const error = await response.json() as any;
        throw new Error(error.error || 'Failed to mint NFT');
      }
    } catch (error: any) {
      toast({
        title: "Mint Failed",
        description: error.message || "Failed to mint NFT",
        variant: "destructive"
      });
      throw error;
    }
  };

  // Mint NFT mutation
  const mintNFTMutation = useMutation({
    mutationFn: handleMintNFT,
    onSuccess: () => {
      setShowMintDialog(false);
      setMintQuantity(1);
      toast({
        title: "Mint Successful!",
        description: `Successfully minted ${mintQuantity} NFT(s)`,
      });
      fetchCollectionData(); // Refresh data
    },
    onError: (error) => {
      toast({
        title: "Mint Failed",
        description: error instanceof Error ? error.message : "Failed to mint NFT.",
        variant: "destructive"
      });
    }
  });

  const NFTCard = ({ nft }: { nft: any }) => (
    <Card 
      className="hover:shadow-xl transition-all duration-300 cursor-pointer"
      onClick={() => setLocation(`/nft/${nft.nft_id}`)}
    >
      <CardHeader className="p-0">
        <div className="relative group">
          {nft.image && (
            <img
              src={nft.image}
              alt={nft.name || `NFT #${nft.sequence}`}
              className="w-full h-64 object-cover rounded-t-lg"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          )}
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-300 rounded-t-lg flex items-center justify-center">
            <Button 
              variant="secondary" 
              size="sm"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                setLocation(`/nft/${nft.nft_id}`);
              }}
            >
              <Eye className="h-4 w-4 mr-1" />
              View Details
            </Button>
          </div>
          {nft.is_listed && (
            <Badge className="absolute top-2 left-2 bg-green-600">
              Listed
            </Badge>
          )}
          {nft.has_offers && (
            <Badge className="absolute top-2 right-2 bg-purple-600">
              {nft.offer_count > 0 ? `${nft.offer_count} ${nft.offer_count === 1 ? 'Offer' : 'Offers'}` : 'Has Offers'}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <CardTitle className="text-lg mb-2">
          {nft.name || `Riddle NFT #${nft.sequence}`}
        </CardTitle>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          Owned by {nft.owner.slice(0, 6)}...{nft.owner.slice(-4)}
        </p>
        {nft.list_price && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">Price</span>
            <span className="font-bold">{nft.list_price} XRP</span>
          </div>
        )}
        <div className="flex gap-2 mt-3">
          {nft.is_listed ? (
            <Button 
              size="sm" 
              className="flex-1"
              onClick={(e) => {
                e.stopPropagation();
                if (!isLoggedIn()) {
                  setShowWalletRequired(true);
                  return;
                }
                setSelectedNFT(nft);
                setShowBuyDialog(true);
              }}
            >
              <ShoppingCart className="h-4 w-4 mr-1" />
              Buy Now
            </Button>
          ) : (
            <Button 
              size="sm" 
              variant="outline" 
              className="flex-1"
              onClick={(e) => {
                e.stopPropagation();
                if (!isLoggedIn()) {
                  setShowWalletRequired(true);
                  return;
                }
                setSelectedNFT(nft);
                setShowOfferDialog(true);
              }}
            >
              Make Offer
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-gray-900 dark:text-white">
        {/* Collection Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-8 mb-8 text-white">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-2">{collection?.name || `Riddle Collection ${taxon}`}</h1>
              <p className="text-lg opacity-90 mb-4">{collection?.description}</p>
              
              {/* Mint Progress Bar for Live Collections */}
              {collection?.isActive && collection?.mintProgress !== undefined && (
                <div className="bg-white/10 rounded-lg p-4 mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Mint Progress</span>
                    <Badge className="bg-green-500">
                      <Zap className="h-3 w-3 mr-1" />
                      Live Mint
                    </Badge>
                  </div>
                  <Progress 
                    value={collection.mintProgress} 
                    className="h-3 mb-2 bg-white/20" 
                  />
                  <div className="flex justify-between text-sm">
                    <span>{collection.mintedCount || 0} / {collection.totalSupply || '∞'} minted</span>
                    <span>{collection.mintProgress?.toFixed(1)}% complete</span>
                  </div>
                </div>
              )}
              
              <div className="flex gap-6">
                <div>
                  <p className="text-sm opacity-75">Items</p>
                  <p className="text-2xl font-bold">{collection?.total_nfts || 0}</p>
                </div>
                <div>
                  <p className="text-sm opacity-75">Owners</p>
                  <p className="text-2xl font-bold">{collection?.total_owners || 0}</p>
                </div>
                <div>
                  <p className="text-sm opacity-75">Floor Price</p>
                  <p className="text-2xl font-bold">{collection?.floor_price || '---'} XRP</p>
                </div>
                <div>
                  <p className="text-sm opacity-75">Total Volume</p>
                  <p className="text-2xl font-bold">{collection?.total_volume || '0'} XRP</p>
                </div>
                {collection?.mintPrice > 0 && (
                  <div>
                    <p className="text-sm opacity-75">Mint Price</p>
                    <p className="text-2xl font-bold">{collection.mintPrice} XRP</p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2 flex-col">
              {/* Mint Button for Live Collections */}
              {collection?.isActive && (
                <Button 
                  variant="secondary" 
                  size="lg"
                  className="bg-green-500 hover:bg-green-600 text-white"
                  onClick={() => {
                    if (!isLoggedIn()) {
                      setShowWalletRequired(true);
                      return;
                    }
                    setShowMintDialog(true);
                  }}
                >
                  <Coins className="h-4 w-4 mr-2" />
                  Mint Now
                </Button>
              )}
              <div className="flex gap-2">
                <Button variant="secondary" size="icon">
                  <Heart className="h-4 w-4" />
                </Button>
                <Button variant="secondary" size="icon">
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-1" />
              Filter
            </Button>
            <Button variant="outline" size="sm">
              Price: Low to High
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setViewMode('grid')}
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* NFT Grid */}
        {isLoading ? (
          <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6" : "space-y-4"}>
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <div className="h-64 bg-gray-200 rounded-t-lg" />
                <CardContent className="p-4">
                  <div className="h-5 bg-gray-200 rounded mb-2" />
                  <div className="h-4 bg-gray-200 rounded mb-3" />
                  <div className="h-8 bg-gray-200 rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6" : "space-y-4"}>
            {nfts?.map((nft: any) => (
              <NFTCard key={nft.nft_id} nft={nft} />
            ))}
          </div>
        )}
      </div>

      {/* Buy Now Dialog - Broker System */}
      {selectedNFT && (
        <BuyNowDialog
          open={showBuyDialog}
          onClose={() => setShowBuyDialog(false)}
          onConfirm={handleBuyNowConfirm}
          nftName={selectedNFT.name || `NFT #${selectedNFT.sequence}`}
          nftImage={selectedNFT.image}
          sellOffer={{
            index: selectedNFT.sell_offer_index || '',
            amountXRP: selectedNFT.list_price || '0',
            owner: selectedNFT.owner || selectedNFT.issuer || ''
          }}
          currentUserAddress={(() => {
            try {
              const sessionData = localStorage.getItem('sessionData');
              if (sessionData) {
                const session = JSON.parse(sessionData);
                return session.wallet?.xrpAddress || session.xrpAddress;
              }
            } catch {}
            return undefined;
          })()}
          brokerFeePercent={1.589}
        />
      )}

      {/* Make Offer Dialog */}
      <Dialog open={showOfferDialog} onOpenChange={setShowOfferDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Make an Offer</DialogTitle>
            <DialogDescription>
              Submit an offer for {selectedNFT?.name || `NFT #${selectedNFT?.sequence}`}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <img
              src={selectedNFT?.image || `/api/placeholder/400/400`}
              alt={selectedNFT?.name}
              className="nft-image loading"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDQwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjQwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiNmM2Y0ZjYiLz48dGV4dCB4PSIyMDAiIHk9IjEwNSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM2YjcyODAiIHRleHQtYW5jaG9yPSJtaWRkbGUiPk5GVCBJbWFnZTwvdGV4dD48L3N2Zz4=';
                target.classList.remove('loading');
              }}
              onLoad={(e) => {
                const target = e.target as HTMLImageElement;
                target.classList.remove('loading');
              }}
            />
            <div className="space-y-4">
              <div>
                <Label htmlFor="offer-amount">Offer Amount (XRP)</Label>
                <Input
                  id="offer-amount"
                  type="number"
                  step="0.000001"
                  placeholder="Enter your offer amount"
                  value={offerAmount}
                  onChange={(e) => setOfferAmount(e.target.value)}
                />
              </div>
              {offerAmount && (
                <div className="text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Platform Fee (1%):</span>
                    <span>{(parseFloat(offerAmount) * 0.01).toFixed(6)} XRP</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Total:</span>
                    <span>{(parseFloat(offerAmount) * 1.01).toFixed(6)} XRP</span>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOfferDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (selectedNFT && offerAmount) {
                  buyNFTMutation.mutate({
                    nft_id: selectedNFT.nft_id,
                    amount: offerAmount
                  });
                }
              }}
              disabled={!offerAmount || buyNFTMutation.isPending}
            >
              {buyNFTMutation.isPending ? 'Processing...' : 'Submit Offer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mint Dialog */}
      <Dialog open={showMintDialog} onOpenChange={setShowMintDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mint NFTs</DialogTitle>
            <DialogDescription>
              Mint from {collection?.name || `Collection ${taxon}`}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="mint-quantity">Quantity</Label>
                <Input
                  id="mint-quantity"
                  type="number"
                  min="1"
                  max="10"
                  value={mintQuantity}
                  onChange={(e) => setMintQuantity(parseInt(e.target.value) || 1)}
                />
              </div>
              
              {collection?.mintPrice > 0 && (
                <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span>Price per NFT:</span>
                    <span className="font-bold">{collection.mintPrice} XRP</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Quantity:</span>
                    <span>{mintQuantity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Platform Fee (1%):</span>
                    <span>{(collection.mintPrice * mintQuantity * 0.01).toFixed(6)} XRP</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-bold">
                    <span>Total:</span>
                    <span>{(collection.mintPrice * mintQuantity * 1.01).toFixed(6)} XRP</span>
                  </div>
                </div>
              )}
              
              {collection?.mintProgress !== undefined && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Available to mint:</span>
                    <span>{(collection.totalSupply || 0) - (collection.mintedCount || 0)}</span>
                  </div>
                  <Progress value={collection.mintProgress} className="h-2" />
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMintDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                mintNFTMutation.mutate({ quantity: mintQuantity });
              }}
              disabled={mintNFTMutation.isPending || !collection?.isActive}
            >
              {mintNFTMutation.isPending ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Minting...
                </>
              ) : (
                <>
                  <Coins className="h-4 w-4 mr-2" />
                  Mint {mintQuantity} NFT{mintQuantity > 1 ? 's' : ''}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Wallet Required Popup */}
      <WalletRequiredPopup 
        isOpen={showWalletRequired}
        onClose={() => setShowWalletRequired(false)}
        onWalletSelected={(walletType, address) => {
          console.log(`Selected wallet: ${walletType} - ${address}`);
          // You can implement specific wallet handling here
          setShowWalletRequired(false);
        }}
      />
      
    </div>
  );
}
