import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, ArrowRight, ExternalLink, Copy, ImageOff, DollarSign, Send, Trash2, Clock, User, Hash, Star, Eye, TrendingUp, Shield, Award, Layers, Calendar, Database, Gift } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { FastImage } from '@/components/fast-image';
import { NFTOfferManager } from '@/components/nft/NFTOfferManager';
import { NFTOfferModules } from '@/components/nft/NFTOfferModules';
import { BrokerOfferManager } from '@/components/nft/BrokerOfferManager';
import { WalletRequiredPopup } from '@/components/WalletRequiredPopup';
import { WalletSelectorDialog } from '@/components/nft/WalletSelectorDialog';
import { MakeOfferDialog } from '@/components/nft/MakeOfferDialog';
import { BuyNowDialog } from '@/components/nft/BuyNowDialog';
import { useUnifiedMetadata } from '@/hooks/useUnifiedMetadata';
import { VerificationBadge, ProjectVerificationBadge } from '@/components/profile';
import { sessionManager } from '@/utils/sessionManager';
import '@/styles/nft-detail.css';

interface NFTDetail {
  nft_id: string;
  name?: string;
  description?: string;
  image?: string;
  collection?: string;
  owner?: string;
  issuer?: string;
  traits?: Array<{ trait_type: string; value: string }>;
  attributes?: Array<{ trait_type: string; value: string }>;
  uri?: string;
  metadata?: any;
  nft_taxon?: number;
  transfer_fee?: number;
  flags?: number;
  rarity?: string;
  floor_price?: number;
  last_sale_price?: number;
  offers?: {
    sell: any[];
    buy: any[];
  };
  collection_stats?: {
    total_supply: number;
    floor_price: number;
    volume_24h: number;
    sales_24h: number;
    owners: number;
  };
  // Gaming-specific fields
  power_level?: number;
  game_role?: string;
  special_abilities?: Record<string, any>;
}

interface NFTTransaction {
  type: string;
  hash: string;
  date: string;
  from: string;
  to: string;
  fee?: string;
  amount?: string;
  status?: string;
  ledgerIndex?: number;
  details?: any;
}

interface NFTActionModalProps {
  action: 'sell' | 'transfer' | 'burn';
  nftId: string;
  nftName: string;
  onClose: () => void;
  onConfirm: (data: any) => void;
}

// NFT Action Modal Component
function NFTActionModal({ action, nftId, nftName, onClose, onConfirm }: NFTActionModalProps) {
  const [amount, setAmount] = useState('');
  const [destination, setDestination] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const actionData = {
        action,
        amount: action === 'sell' ? amount : undefined,
        destination: action === 'transfer' ? destination : undefined
      };
      
      await onConfirm(actionData);
      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to ${action} NFT`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogContent className="w-[95vw] sm:w-[90%] sm:max-w-md lg:max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {action === 'sell' && <DollarSign className="h-5 w-5 text-green-500" />}
          {action === 'transfer' && <Send className="h-5 w-5 text-blue-500" />}
          {action === 'burn' && <Trash2 className="h-5 w-5 text-red-500" />}
          {action.charAt(0).toUpperCase() + action.slice(1)} NFT
        </DialogTitle>
      </DialogHeader>
      
      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium">NFT</Label>
          <p className="text-sm text-muted-foreground">{nftName}</p>
        </div>
        
        {action === 'sell' && (
          <div className="space-y-2">
            <Label htmlFor="amount">Sale Price (XRP)</Label>
            <Input
              id="amount"
              type="number"
              step="0.000001"
              placeholder="Enter price in XRP"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        )}
        
        {action === 'transfer' && (
          <div className="space-y-2">
            <Label htmlFor="destination">Destination Address</Label>
            <Input
              id="destination"
              placeholder="r... (XRPL address)"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            />
          </div>
        )}
        
        {action === 'burn' && (
          <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-700 dark:text-red-300">
              ⚠️ This action is permanent and cannot be undone. The NFT will be permanently destroyed.
            </p>
          </div>
        )}
        
        <div className="flex gap-2 pt-4">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={loading || (action === 'sell' && !amount) || (action === 'transfer' && !destination)}
            className="flex-1"
            variant={action === 'burn' ? 'destructive' : 'default'}
          >
            {loading ? 'Processing...' : `Confirm ${action.charAt(0).toUpperCase() + action.slice(1)}`}
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}

export function NFTDetailPage() {
  const params = useParams<{ id?: string; nftId?: string }>();
  const [, setLocation] = useLocation();
  const [nftDetail, setNftDetail] = useState<NFTDetail | null>(null);
  const [transactions, setTransactions] = useState<NFTTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [actionModalOpen, setActionModalOpen] = useState<'sell' | 'transfer' | 'burn' | null>(null);
  const [currentUserAddress, setCurrentUserAddress] = useState<string | null>(null);
  const [incomingOffers, setIncomingOffers] = useState<any[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [pendingOffers, setPendingOffers] = useState<any[]>([]);
  const [sellOffers, setSellOffers] = useState<any[]>([]);
  const [showOffersDialog, setShowOffersDialog] = useState(false);
  const [showWalletRequired, setShowWalletRequired] = useState(false);
  const [showWalletSelector, setShowWalletSelector] = useState(false);
  const [showMakeOfferDialog, setShowMakeOfferDialog] = useState(false);
  const [showBuyNowDialog, setShowBuyNowDialog] = useState(false);
  const [selectedSellOffer, setSelectedSellOffer] = useState<any>(null);
  const [walletAction, setWalletAction] = useState<'buy' | 'offer' | null>(null);
  const [transactionAmount, setTransactionAmount] = useState<string>('');
  const [rarityData, setRarityData] = useState<any>(null);
  const [rarityLoading, setRarityLoading] = useState(false);
  const [activeOffers, setActiveOffers] = useState<{ buy: any[]; sell: any[] }>({ buy: [], sell: [] });
  const { toast} = useToast();
  
  const nftId = params.id || params.nftId;

  // Parse NFT ID to extract issuer and taxon for unified metadata
  const parseNFTId = (id: string) => {
    // For XRPL NFTs, we need to get issuer from the NFT data
    // This is a fallback - we'll get issuer from current API first, then use unified metadata for enhanced display
    return { issuer: null, taxon: null };
  };

  const { issuer, taxon } = parseNFTId(nftId || '');
  
  // Unified metadata hook disabled - endpoint not yet implemented
  // const { data: unifiedMetadata, isLoading: metadataLoading } = useUnifiedMetadata(
  //   nftDetail?.issuer || '',
  //   nftDetail?.nft_taxon || undefined,
  //   { enabled: !!(nftDetail?.issuer) }
  // );
  const unifiedMetadata = null;
  const metadataLoading = false;

  // Helper function to get session token using robust authentication pattern
  const getSessionToken = (): string | null => {
    // Try sessionManager first (imported module)
    const managerToken = sessionManager.getSessionToken();
    if (managerToken) return managerToken;
    
    // Fallback to riddleToken
    const riddleToken = localStorage.getItem('riddleToken');
    if (riddleToken) return riddleToken;
    
    // Final fallback to sessionToken
    return localStorage.getItem('sessionToken');
  };

  useEffect(() => {
    if (nftId) {
      fetchNFTDetail(nftId);
      fetchNFTHistory(nftId);
      fetchActiveOffers(nftId);
      fetchIncomingOffers();
      fetchPendingBuyOffers(nftId);
      fetchSellOffers(nftId);
    }
  }, [nftId]);

  // Fetch rarity data once NFT detail is loaded
  useEffect(() => {
    if (nftDetail?.issuer && nftDetail?.nft_taxon !== undefined) {
      const collectionId = `${nftDetail.issuer}:${nftDetail.nft_taxon || 0}`;
      fetchRarityData(nftId!, collectionId);
    }
  }, [nftDetail?.issuer, nftDetail?.nft_taxon]);

  const fetchNFTDetail = async (id: string) => {
    setLoading(true);
    try {
      // LIVE DATA ONLY - Use authenticated server endpoint with Bithomp integration
      console.log(`🔍 Fetching LIVE NFT detail for: ${id}`);
      
      // Get wallet address from SessionManager for accurate ownership check
      const session = sessionManager.getSession();
      let walletAddress: string | null = null;
      
      if (session.isLoggedIn && session.walletData) {
        walletAddress = session.walletData.xrpAddress || null;
        console.log(`🔍 Using authenticated wallet address: ${walletAddress}`);
      } else {
        console.log(`⚠️ No authenticated wallet found - user is not logged in`);
      }

      // Set current user address (null if not logged in - this ensures correct button visibility)
      setCurrentUserAddress(walletAddress);

      // Try gaming endpoint first for enhanced gaming data
      let response = await fetch(`/api/gaming/nft/${id}?t=${Date.now()}`);
      let isGamingNFT = false;
      
      if (response.ok) {
        const gamingData = await response.json() as any;
        if (gamingData.success && gamingData.data) {
          console.log(`🎮 Found GAMING NFT via gaming endpoint: ${gamingData.data.token_id}`);
          isGamingNFT = true;
          
          setNftDetail({
            nft_id: id,
            name: gamingData.data.metadata?.name || `Gaming NFT #${id.slice(-6)}`,
            description: gamingData.data.description,
            image: gamingData.data.image_url,
            collection: gamingData.data.collection_name,
            owner: gamingData.data.wallet_address || walletAddress,
            issuer: gamingData.data.issuer,
            nft_taxon: gamingData.data.taxon,
            transfer_fee: 0,
            flags: 0,
            traits: gamingData.data.metadata?.attributes || [],
            attributes: gamingData.data.metadata?.attributes || [],
            metadata: {
              ...gamingData.data.metadata,
              power_level: gamingData.data.power_level,
              game_role: gamingData.data.game_role,
              special_abilities: gamingData.data.special_abilities,
              rarity: gamingData.data.rarity,
              gaming_stats: gamingData.data.stats
            },
            uri: gamingData.data.metadata?.uri,
            rarity: gamingData.data.rarity,
            // Gaming-specific fields
            power_level: gamingData.data.power_level,
            game_role: gamingData.data.game_role,
            special_abilities: gamingData.data.special_abilities
          });
          return; // Exit early if gaming data found
        }
      }
      
      // Fallback to regular NFT endpoint if not a gaming NFT
      console.log(`🔍 Trying regular NFT endpoint for: ${id}`);
      response = await fetch(`/api/nft/${id}/details?t=${Date.now()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch NFT detail: ${response.statusText}`);
      }
      
      const data = await response.json() as any;
      
      // Backend returns {success: true, nft: nftData, collectionId}
      if (!data || !data.success || !data.nft) {
        throw new Error(`NFT ${id} not found`);
      }

      const nftData = data.nft;
      console.log(`✅ Found NFT via detail endpoint: ${nftData.metadata?.name || nftData.name || 'Unknown'}`);
      
      // Extract traits from metadata
      const mappedTraits = nftData.metadata?.attributes || 
                          nftData.metadata?.traits || 
                          nftData.attributes || 
                          nftData.traits || 
                          [];
      
      // Use imageUrl from backend (already handles IPFS, CDN, and metadata)
      const imageUrl = nftData.imageUrl || nftData.metadata?.image || nftData.image || '';
      
      setNftDetail({
        nft_id: nftData.nftokenID || id,
        name: nftData.metadata?.name || nftData.name || `NFT #${id.slice(-6)}`,
        description: nftData.metadata?.description || nftData.description,
        image: imageUrl,
        collection: nftData.collection,
        owner: nftData.owner || walletAddress,
        issuer: nftData.issuer,
        nft_taxon: nftData.nftokenTaxon || nftData.taxon || nftData.nft_taxon,
        transfer_fee: nftData.transferFee || nftData.transfer_fee,
        flags: nftData.flags,
        traits: mappedTraits,
        attributes: mappedTraits,
        metadata: nftData.metadata,
        uri: nftData.uri
      });
      
      // Fetch rarity if collection ID is available
      if (data.collectionId) {
        fetchRarityData(id, data.collectionId);
      }
    } catch (error) {
      console.error('Error fetching NFT detail:', error);
      toast({
        title: "Error",
        description: "Failed to load NFT details",
        variant: "destructive"
      });
      setNftDetail(null);
    } finally {
      setLoading(false);
    }
  };

  // Fetch rarity data from Bithomp
  const fetchRarityData = async (id: string, collectionId: string) => {
    setRarityLoading(true);
    try {
      console.log(`📊 [RARITY] Fetching rarity data for NFT: ${id}`);
      const response = await fetch(`/api/nft/${id}/rarity?collectionId=${encodeURIComponent(collectionId)}`);
      
      if (response.ok) {
        const data = await response.json() as any;
        if (data.success && data.rarity) {
          console.log(`✅ [RARITY] Rarity rank: ${data.rarity.rank}/${data.totalSupply}, tier: ${data.rarity.rarityTier}`);
          setRarityData(data);
        }
      }
    } catch (error) {
      console.error('❌ [RARITY] Error fetching rarity:', error);
    } finally {
      setRarityLoading(false);
    }
  };

  // Fetch active offers from Bithomp
  const fetchActiveOffers = async (id: string) => {
    try {
      console.log(`💰 [OFFERS] Fetching active offers for NFT: ${id}`);
      const response = await fetch(`/api/nft/${id}/offers`);
      
      if (response.ok) {
        const data = await response.json() as any;
        if (data.success && data.offers) {
          console.log(`✅ [OFFERS] Found ${data.offers.buy.length} buy offers, ${data.offers.sell.length} sell offers`);
          setActiveOffers(data.offers);
        }
      }
    } catch (error) {
      console.error('❌ [OFFERS] Error fetching offers:', error);
    }
  };

  const fetchNFTHistory = async (id: string) => {
    setHistoryLoading(true);
    try {
      console.log(`📜 [HISTORY] Fetching transaction history from Bithomp for: ${id}`);
      const response = await fetch(`/api/nft/${id}/history?limit=50`);
      
      if (response.ok) {
        const data = await response.json() as any;
        if (data.success && data.history) {
          console.log(`✅ [HISTORY] Found ${data.history.length} transactions`);
          setTransactions(data.history);
        }
      }
    } catch (error) {
      console.error('Error fetching NFT history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleNFTAction = async (actionData: any) => {
    try {
      const validToken = getSessionToken();
      
      if (!validToken) {
        console.error('❌ [NFT ACTION] No valid session token found');
        toast({
          title: "Authentication Required",
          description: "Please login again to perform NFT actions",
          variant: "destructive"
        });
        return;
      }
      
      console.log(`🔥 [NFT ACTION] Starting ${actionData.action.toUpperCase()} action for NFT: ${nftId}`);

      // Use the correct endpoint paths for each action
      let endpoint = '';
      let body = {};
      
      switch (actionData.action) {
        case 'burn':
          endpoint = `/api/nft-actions/burn/${nftId}`;
          break;
        case 'transfer':
          endpoint = `/api/nft-actions/transfer/${nftId}`;
          body = { destinationAddress: actionData.destination };
          break;
        case 'sell':
          endpoint = `/api/nft-actions/sell/${nftId}`;
          body = { 
            priceXRP: actionData.amount,
            destination: actionData.destination,
            expiration: actionData.expiration
          };
          break;
        default:
          throw new Error(`Unknown action: ${actionData.action}`);
      }

      console.log(`🔥 [NFT ACTION] ${actionData.action.toUpperCase()} - Endpoint: ${endpoint}`, body);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${validToken}`
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [NFT ACTION] HTTP ${response.status}:`, errorText);
        throw new Error(`Request failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json() as any;
      console.log(`✅ [NFT ACTION] Response:`, result);

      if (result.success) {
        toast({
          title: "Success",
          description: result.message || `NFT ${actionData.action} completed successfully`,
        });
        setActionModalOpen(null);
        
        // Refresh NFT data after action
        if (nftId) {
          fetchNFTDetail(nftId);
          fetchNFTHistory(nftId);
        }
      } else {
        throw new Error(result.error || 'Action failed');
      }
    } catch (error: any) {
      console.error('❌ [NFT ACTION] Full error:', error);
      
      let errorMessage = `Failed to ${actionData.action} NFT`;
      if (error.message) {
        errorMessage = error.message;
      }
      if (error.message?.includes('Authentication required')) {
        errorMessage = 'Please login again to perform NFT actions';
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

  const fetchIncomingOffers = async () => {
    setOffersLoading(true);
    try {
      const sessionToken = getSessionToken();
      if (!sessionToken) {
        console.log('No session token for offers');
        return;
      }

      console.log('🔍 [INCOMING OFFERS] Fetching offers...');
      const response = await fetch('/api/nft-offers/incoming', {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json() as any;
      
      if (data.success) {
        console.log('✅ [INCOMING OFFERS] Found offers:', data.offers?.length || 0);
        setIncomingOffers(data.offers || []);
      } else {
        console.log('❌ [INCOMING OFFERS] Failed:', data.error);
        setIncomingOffers([]);
      }
    } catch (error) {
      console.error('❌ [INCOMING OFFERS] Error:', error);
      setIncomingOffers([]);
    } finally {
      setOffersLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Copied to clipboard"
    });
  };

  const openXRPLExplorer = () => {
    window.open(`https://xrpl.org/nft-explorer/#/nft/${nftId}`, '_blank');
  };

  const handleBuyNow = async () => {
    if (!currentUserAddress || !nftDetail) {
      setShowWalletRequired(true);
      return;
    }

    if (sellOffers.length === 0) {
      toast({
        title: "No Sell Offers",
        description: "This NFT has no active sell offers",
        variant: "destructive"
      });
      return;
    }

    // Find the lowest price sell offer
    const lowestOffer = sellOffers.reduce((lowest, current) => {
      const currentPrice = parseFloat(current.amountXRP);
      const lowestPrice = parseFloat(lowest.amountXRP);
      return currentPrice < lowestPrice ? current : lowest;
    });

    // Store the selected offer and open the dialog
    setSelectedSellOffer(lowestOffer);
    setShowBuyNowDialog(true);
  };

  const confirmBuyNow = async () => {
    if (!selectedSellOffer || !nftDetail) {
      throw new Error('Missing NFT or offer data');
    }

    const buyPrice = parseFloat(selectedSellOffer.amountXRP);

    try {
      const sessionToken = getSessionToken();
      
      if (!sessionToken) {
        toast({
          title: "Error",
          description: "Please authenticate your wallet",
          variant: "destructive"
        });
        throw new Error('No session token');
      }

      const session = sessionManager.getSession();
      const walletHandle = session.handle;

      // Execute Buy Now with Riddle wallet using session cache - server controls fees
      const buyResponse = await fetch('/api/broker/confirm-buy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        credentials: 'include',
        body: JSON.stringify({
          nftTokenId: nftDetail.nft_id,
          sellOfferIndex: selectedSellOffer.nft_offer_index,
          buyPrice: buyPrice.toString(),
          nftOwner: nftDetail.owner || selectedSellOffer.owner
        })
      });

      const buyData = await buyResponse.json();
      
      if (!buyData.success) {
        toast({
          title: "Error",
          description: buyData.error || 'Failed to complete purchase',
          variant: "destructive"
        });
        throw new Error(buyData.error || 'Failed to complete purchase');
      }

      // Show success message with tx hash
      if (buyData.txHash) {
        toast({
          title: "Purchase Successful!",
          description: `NFT purchased successfully`,
        });
      }

      // Return result with transaction hash
      return {
        success: true,
        txHash: buyData.txHash,
        error: buyData.error
      };

    } catch (error) {
      console.error('Buy now error:', error);
      toast({
        title: "Error",
        description: "Failed to process buy order",
        variant: "destructive"
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  };

  const handleMakeOffer = async () => {
    if (!currentUserAddress || !nftDetail) {
      setShowWalletRequired(true);
      return;
    }

    // Open professional Make Offer dialog
    setShowMakeOfferDialog(true);
  };

  const submitOffer = async (offerAmount: string) => {
    if (!nftDetail) {
      throw new Error('NFT detail not found');
    }

    // Get session data from sessionStorage (where SessionManager stores everything)
    const sessionData = sessionStorage.getItem('riddle_wallet_session');
    
    if (!sessionData) {
      toast({
        title: "Session Expired",
        description: "Please log in again to make an offer",
        variant: "destructive"
      });
      throw new Error('Session not found');
    }

    let sessionToken: string;
    let walletData: any;
    
    try {
      const parsed = JSON.parse(sessionData);
      sessionToken = parsed.sessionToken;
      
      // Extract wallet data from session object
      walletData = {
        handle: parsed.handle,
        username: parsed.username,
        xrpAddress: parsed.xrpAddress,
        ethAddress: parsed.ethAddress,
        solAddress: parsed.solAddress,
        btcAddress: parsed.btcAddress,
        addresses: parsed.addresses || {
          xrp: parsed.xrpAddress,
          eth: parsed.ethAddress,
          sol: parsed.solAddress,
          btc: parsed.btcAddress
        }
      };
      
      console.log('✅ [MAKE OFFER] Auth successful from sessionStorage');
    } catch (e) {
      console.error('Failed to parse session data:', e);
      toast({
        title: "Session Error",
        description: "Please log in again",
        variant: "destructive"
      });
      throw new Error('Invalid session data');
    }
    
    if (!sessionToken) {
      toast({
        title: "Authentication Required",
        description: "Please log in to your Riddle wallet to make an offer",
        variant: "destructive"
      });
      throw new Error('Authentication required');
    }

    const wallet = walletData;
    
    toast({
      title: "Creating Offer",
      description: "Creating broker-directed buy offer on XRPL...",
    });

    const response = await fetch('/api/broker/create-buy-offer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`
      },
      credentials: 'include',
      body: JSON.stringify({
        nftId: nftDetail.nft_id,
        offerAmountXrp: offerAmount,
        nftOwner: nftDetail.owner || nftDetail.issuer
      })
    });

    const data = await response.json() as any;
    
    if (data.success) {
      toast({
        title: "✅ Offer Created!",
        description: (
          <div className="space-y-2">
            <p>Broker-directed offer of {offerAmount} XRP created</p>
            <p className="text-xs text-gray-400">Offer ID: {data.offerId?.substring(0, 16)}...</p>
            <p className="text-xs text-blue-400">Funds reserved on-chain until accepted or cancelled</p>
            {data.explorerUrl && (
              <a 
                href={data.explorerUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline text-xs block font-semibold"
              >
                View on XRPL Explorer →
              </a>
            )}
          </div>
        ),
      });
    } else {
      toast({
        title: "Error",
        description: data.error || 'Failed to create broker offer',
        variant: "destructive"
      });
      throw new Error(data.error || 'Failed to create broker offer');
    }
  };

  const fetchPendingBuyOffers = async (nftId: string) => {
    try {
      const response = await fetch(`/api/broker/nft/${nftId}/buy-offers`);
      const data = await response.json() as any;
      
      if (data.offers) {
        const offersWithXRP = data.offers.map((offer: any) => ({
          ...offer,
          amountXRP: (parseFloat(offer.amount) / 1000000).toFixed(6)
        }));
        setPendingOffers(offersWithXRP);
        console.log(`📬 Found ${offersWithXRP.length} pending buy offers for NFT ${nftId}`);
      }
    } catch (error) {
      console.error('Error fetching buy offers:', error);
    }
  };

  const fetchSellOffers = async (nftId: string) => {
    try {
      const response = await fetch(`/api/broker/nft/${nftId}/sell-offers`);
      const data = await response.json() as any;
      
      if (data.offers) {
        const offersWithXRP = data.offers.map((offer: any) => ({
          ...offer,
          amountXRP: (parseFloat(offer.amount) / 1000000).toFixed(6)
        }));
        setSellOffers(offersWithXRP);
        console.log(`💰 Found ${offersWithXRP.length} sell offers for NFT ${nftId}`);
      } else {
        setSellOffers([]);
      }
    } catch (error) {
      console.error('Error fetching sell offers:', error);
      setSellOffers([]);
    }
  };

  // Accept direct XRPL offer (not broker-mediated)
  const handleAcceptDirectOffer = async (offerId: string, offerAmountXRP: string) => {
    if (!nftDetail) return;

    const confirmed = confirm(`Accept this offer for ${offerAmountXRP} XRP?`);
    if (!confirmed) return;

    try {
      const sessionToken = getSessionToken();
      
      if (!sessionToken) {
        toast({
          title: "Error",
          description: "Please authenticate your wallet",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Processing...",
        description: "Accepting offer on XRPL...",
      });

      const response = await fetch(`/api/nft/offers/${offerId}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        credentials: 'include'
      });

      const data = await response.json() as any;
      
      if (data.success) {
        toast({
          title: "✅ Offer Accepted!",
          description: `NFT transferred for ${offerAmountXRP} XRP`,
        });
        
        // Refresh offers and close dialog
        setShowOffersDialog(false);
        fetchIncomingOffers();
        fetchPendingBuyOffers(nftDetail.nft_id);
      } else {
        toast({
          title: "Error",
          description: data.error || 'Failed to accept offer',
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Accept direct offer error:', error);
      toast({
        title: "Error",
        description: "Failed to accept offer",
        variant: "destructive"
      });
    }
  };

  // Accept broker-mediated offer - Navigate to dedicated accept page
  const handleAcceptOffer = async (buyOfferId: string, offerAmountXRP: string) => {
    if (!nftDetail) return;

    // Navigate to dedicated accept offer page instead of using dialog
    setLocation(`/nft/${nftDetail.nft_id}/accept-offer/${buyOfferId}`);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/4 mb-6"></div>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="aspect-square bg-muted rounded-lg"></div>
            <div className="space-y-4">
              <div className="h-6 bg-muted rounded w-3/4"></div>
              <div className="h-4 bg-muted rounded w-full"></div>
              <div className="h-4 bg-muted rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!nftDetail) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold mb-2">NFT Not Found</h2>
            <p className="text-muted-foreground">The requested NFT could not be loaded.</p>
            <Button 
              onClick={() => setLocation('/nft-marketplace')} 
              className="mt-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Marketplace
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="nft-detail-container">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header with Back Button */}
        <div className="flex items-center justify-between mb-8">
          <Button 
            variant="ghost" 
            onClick={() => setLocation('/nft-marketplace')}
            className="flex items-center gap-2 text-white hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Marketplace
          </Button>
          
          {nftDetail && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-white/20 text-white">
                <Database className="mr-1 h-3 w-3" />
                {nftDetail.nft_id.slice(-6)}
              </Badge>
            </div>
          )}
        </div>

      {/* NFT Action Modals */}
      {actionModalOpen && (
        <Dialog open={true} onOpenChange={() => setActionModalOpen(null)}>
          <NFTActionModal
            action={actionModalOpen}
            nftId={nftDetail.nft_id}
            nftName={nftDetail.name || 'Unknown NFT'}
            onClose={() => setActionModalOpen(null)}
            onConfirm={handleNFTAction}
          />
        </Dialog>
      )}



        {/* Main NFT Content */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-8">
          {/* NFT Image */}
          <div className="lg:col-span-2">
            <Card className="nft-metadata-card">
              <CardContent className="p-4 sm:p-6">
                <div className="nft-image-container relative w-full aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden mb-4 lg:mb-6">
                  {nftDetail.image ? (
                    <img
                      src={nftDetail.image}
                      alt={nftDetail.name || 'NFT'}
                      className="absolute inset-0 w-full h-full object-contain"
                      loading="lazy"
                      onError={(e) => {
                        console.log('❌ NFT image failed to load:', nftDetail.image);
                        const target = e.currentTarget;
                        target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDQwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjQwMCIgaGVpZ2h0PSI0MDAiIGZpbGw9IiMyMjIiLz48dGV4dCB4PSIyMDAiIHk9IjIxMCIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTgiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiPk5GVCBJbWFnZTwvdGV4dD48L3N2Zz4=';
                      }}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <ImageOff className="h-16 w-16 text-gray-400" />
                    </div>
                  )}
                </div>
              
              {/* NFT Management Actions - Under the Image */}
              {nftDetail && (
                <div className="space-y-2 sm:space-y-3">
                  {(() => {
                    const isOwner = currentUserAddress && nftDetail.owner && 
                                    currentUserAddress.toLowerCase().trim() === nftDetail.owner.toLowerCase().trim();
                    console.log(`🔐 [OWNERSHIP CHECK] User: ${currentUserAddress}, NFT Owner: ${nftDetail.owner}, Is Owner: ${isOwner}`);
                    return null;
                  })()}
                  
                  {/* Only show sell/transfer/burn if user owns the NFT - strict ownership check */}
                  {currentUserAddress && nftDetail.owner && 
                   currentUserAddress.toLowerCase().trim() === nftDetail.owner.toLowerCase().trim() ? (
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <Button 
                        variant="outline" 
                        onClick={() => setActionModalOpen('sell')}
                        size="sm"
                        className="w-full bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <DollarSign className="mr-1 sm:mr-2 h-4 w-4" />
                        <span className="text-xs sm:text-sm">Sell</span>
                      </Button>

                      <Button 
                        variant="outline" 
                        onClick={() => setActionModalOpen('transfer')}
                        size="sm"
                        className="w-full bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <Send className="mr-1 sm:mr-2 h-4 w-4" />
                        <span className="text-xs sm:text-sm">Transfer</span>
                      </Button>

                      <Button 
                        variant="destructive" 
                        onClick={() => setActionModalOpen('burn')}
                        size="sm"
                        className="w-full col-span-2"
                      >
                        <Trash2 className="mr-1 sm:mr-2 h-4 w-4" />
                        <span className="text-xs sm:text-sm">Burn</span>
                      </Button>

                      <Button 
                        variant="outline" 
                        onClick={() => setShowOffersDialog(true)}
                        size="sm"
                        className="w-full col-span-2 bg-purple-600 hover:bg-purple-700 text-white border-purple-600"
                      >
                        <Gift className="mr-1 sm:mr-2 h-4 w-4" />
                        <span className="text-xs sm:text-sm">Offers ({incomingOffers.length + pendingOffers.length})</span>
                      </Button>
                    </div>
                  ) : (
                    /* Show buy/offer buttons if user doesn't own the NFT */
                    <div className="space-y-2 mb-2">
                      {/* Only show Buy Now if there are sell offers */}
                      {sellOffers.length > 0 && (
                        <Button 
                          variant="default" 
                          onClick={handleBuyNow}
                          size="sm"
                          className="w-full bg-green-600 hover:bg-green-700 text-white"
                          disabled={!currentUserAddress}
                        >
                          <DollarSign className="mr-1 sm:mr-2 h-4 w-4" />
                          <span className="text-xs sm:text-sm">
                            Buy - {Math.min(...sellOffers.map(o => parseFloat(o.amountXRP))).toFixed(2)} XRP
                          </span>
                        </Button>
                      )}

                      <Button 
                        variant="outline" 
                        onClick={handleMakeOffer}
                        size="sm"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
                        disabled={!currentUserAddress}
                      >
                        <Gift className="mr-1 sm:mr-2 h-4 w-4" />
                        <span className="text-xs sm:text-sm">Make Offer</span>
                      </Button>
                      
                      {!currentUserAddress && (
                        <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 text-center">
                          Connect wallet to buy or make offers
                        </p>
                      )}
                    </div>
                  )}
                  
                  <Button 
                    variant="outline" 
                    onClick={openXRPLExplorer}
                    className="w-full bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View on XRPL Explorer
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

          {/* NFT Details with Tabs */}
          <div className="lg:col-span-3">
            <Card className="nft-metadata-card">
              <CardHeader>
                <CardTitle className="text-2xl text-white">
                  {nftDetail.name || `NFT #${nftDetail.nft_id.slice(0, 8)}`}
                </CardTitle>
                {nftDetail.collection && (
                  <Badge className="nft-badge-collection">
                    {typeof nftDetail.collection === 'string' 
                      ? nftDetail.collection 
                      : (nftDetail.collection as any)?.name || 'Unknown Collection'
                    }
                  </Badge>
                )}
              </CardHeader>
            <CardContent>
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-5 h-10">
                  <TabsTrigger value="overview" className="text-xs px-2">Overview</TabsTrigger>
                  <TabsTrigger value="traits" className="text-xs px-2">Traits</TabsTrigger>
                  <TabsTrigger value="collection" className="text-xs px-2">Collection</TabsTrigger>
                  <TabsTrigger value="offers" className="text-xs px-2">
                    Offers {incomingOffers.length > 0 && `(${incomingOffers.length})`}
                  </TabsTrigger>
                  <TabsTrigger value="history" className="text-xs px-2">History</TabsTrigger>
                </TabsList>
                
                <TabsContent value="overview" className="space-y-4 mt-6">
                  {nftDetail.description && (
                    <div>
                      <h3 className="text-sm font-bold mb-2 text-gray-900 dark:text-gray-100">Description</h3>
                      <p className="text-gray-700 dark:text-gray-300">{nftDetail.description}</p>
                    </div>
                  )}

                  <Separator />

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-bold flex items-center gap-2 text-gray-900 dark:text-gray-100">
                        <Hash className="h-4 w-4" />
                        NFT ID
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-gray-700 dark:text-gray-300">{nftDetail.nft_id.slice(0, 12)}...{nftDetail.nft_id.slice(-8)}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(nftDetail.nft_id)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {nftDetail.nft_taxon !== undefined && (
                      <div className="flex justify-between items-center">
                        <span className="font-bold flex items-center gap-2 text-gray-900 dark:text-gray-100">
                          <Layers className="h-4 w-4" />
                          NFT Taxon
                        </span>
                        <Badge variant="secondary" className="dark:bg-gray-700 dark:text-gray-200">{nftDetail.nft_taxon}</Badge>
                      </div>
                    )}

                    {nftDetail.transfer_fee !== undefined && (
                      <div className="flex justify-between items-center">
                        <span className="font-bold flex items-center gap-2 text-gray-900 dark:text-gray-100">
                          <DollarSign className="h-4 w-4" />
                          Transfer Fee
                        </span>
                        <Badge variant="outline" className="dark:border-gray-600 dark:text-gray-200">{(nftDetail.transfer_fee / 1000).toFixed(1)}%</Badge>
                      </div>
                    )}

                    {nftDetail.flags !== undefined && (
                      <div className="flex justify-between items-center">
                        <span className="font-bold flex items-center gap-2 text-gray-900 dark:text-gray-100">
                          <Shield className="h-4 w-4" />
                          Flags
                        </span>
                        <div className="flex gap-1">
                          {nftDetail.flags & 1 ? <Badge variant="default">Burnable</Badge> : null}
                          {nftDetail.flags & 2 ? <Badge variant="default">Only XRP</Badge> : null}
                          {nftDetail.flags & 8 ? <Badge variant="default">Transferable</Badge> : null}
                        </div>
                      </div>
                    )}

                    {nftDetail.owner && (
                      <div className="flex justify-between items-center">
                        <span className="font-bold flex items-center gap-2 text-gray-900 dark:text-gray-100">
                          <User className="h-4 w-4" />
                          Owner
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setLocation(`/wallet/${nftDetail.owner}`)}
                            className="font-mono text-sm text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-semibold"
                          >
                            {nftDetail.owner.slice(0, 8)}...{nftDetail.owner.slice(-8)}
                          </button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(nftDetail.owner || '')}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {nftDetail.issuer && (
                      <div className="flex justify-between items-center">
                        <span className="font-medium flex items-center gap-2">
                          <Award className="h-4 w-4" />
                          Issuer
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setLocation(`/wallet/${nftDetail.issuer}`)}
                            className="font-mono text-sm text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-semibold"
                          >
                            {nftDetail.issuer.slice(0, 8)}...{nftDetail.issuer.slice(-8)}
                          </button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(nftDetail.issuer || '')}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`https://bithomp.com/nft/${nftDetail.nft_id}`, '_blank')}
                      className="flex items-center gap-2"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Bithomp Explorer
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={openXRPLExplorer}
                      className="flex items-center gap-2"
                    >
                      <ExternalLink className="h-4 w-4" />
                      XRPL Explorer
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="traits" className="space-y-4 mt-6">
                  {/* Rarity Information */}
                  {rarityData && rarityData.rarity && (
                    <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 rounded-lg border mb-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Hash className="h-6 w-6 text-purple-600" />
                          <h3 className="text-lg font-semibold">Rarity Score</h3>
                        </div>
                        <Badge 
                          variant="secondary" 
                          className={`
                            ${rarityData.rarity.rarityTier === 'Legendary' ? 'bg-yellow-500 text-white' : ''}
                            ${rarityData.rarity.rarityTier === 'Epic' ? 'bg-purple-500 text-white' : ''}
                            ${rarityData.rarity.rarityTier === 'Rare' ? 'bg-blue-500 text-white' : ''}
                            ${rarityData.rarity.rarityTier === 'Uncommon' ? 'bg-green-500 text-white' : ''}
                            ${rarityData.rarity.rarityTier === 'Common' ? 'bg-gray-500 text-white' : ''}
                          `}
                        >
                          {rarityData.rarity.rarityTier}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                          <div className="text-2xl font-bold text-purple-600">
                            {rarityData.rarity.rarityScore.toFixed(2)}
                          </div>
                          <div className="text-xs text-muted-foreground">Rarity Score</div>
                        </div>
                        <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                          <div className="text-2xl font-bold text-blue-600">
                            #{rarityData.rarity.rank}
                          </div>
                          <div className="text-xs text-muted-foreground">Rank</div>
                        </div>
                        <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                          <div className="text-2xl font-bold text-green-600">
                            {rarityData.rarity.rarityPercentage.toFixed(1)}%
                          </div>
                          <div className="text-xs text-muted-foreground">Top Percentile</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {nftDetail.traits && nftDetail.traits.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {nftDetail.traits.map((trait, index) => {
                        // Find trait rarity percentage if available
                        const traitRarity = rarityData?.rarity?.traitRarities?.find(
                          (tr: any) => tr.trait_type === trait.trait_type && tr.value === trait.value
                        );
                        
                        return (
                          <button
                            key={index}
                            onClick={() => {
                              // Navigate to collection page filtered by this trait
                              if (nftDetail.issuer && nftDetail.nft_taxon !== undefined) {
                                setLocation(`/nft-collections/${nftDetail.issuer}/${nftDetail.nft_taxon}?trait=${encodeURIComponent(trait.trait_type)}&value=${encodeURIComponent(trait.value)}`);
                              }
                            }}
                            className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer text-left"
                          >
                            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1 flex justify-between items-center">
                              <span>{trait.trait_type}</span>
                              {traitRarity && (
                                <span className="text-purple-600 font-semibold">
                                  {traitRarity.percentage.toFixed(1)}%
                                </span>
                              )}
                            </div>
                            <div className="font-medium">{trait.value}</div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Hash className="mx-auto h-8 w-8 mb-2 opacity-50" />
                      <p>No traits available for this NFT</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="collection" className="space-y-4 mt-6">
                  {nftDetail.collection || nftDetail.issuer ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 rounded-lg border">
                        <div className="flex items-center gap-3 mb-3">
                          <Layers className="h-6 w-6 text-blue-600" />
                          <h3 className="text-lg font-semibold">Collection Information</h3>
                        </div>
                        
                        {nftDetail.collection && (
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="font-medium">Collection Name</span>
                              <Badge variant="default">
                                {typeof nftDetail.collection === 'string' 
                                  ? nftDetail.collection 
                                  : (nftDetail.collection as any)?.name || 'Unknown Collection'
                                }
                              </Badge>
                            </div>
                          </div>
                        )}

                        {nftDetail.nft_taxon !== undefined && (
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="font-medium">Collection Taxon</span>
                              <Badge variant="secondary">#{nftDetail.nft_taxon}</Badge>
                            </div>
                          </div>
                        )}

                        {nftDetail.collection_stats && (
                          <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                              <div className="text-2xl font-bold text-blue-600">{nftDetail.collection_stats.total_supply}</div>
                              <div className="text-xs text-muted-foreground">Total Supply</div>
                            </div>
                            <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                              <div className="text-2xl font-bold text-green-600">{nftDetail.collection_stats.floor_price} XRP</div>
                              <div className="text-xs text-muted-foreground">Floor Price</div>
                            </div>
                            <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                              <div className="text-2xl font-bold text-purple-600">{nftDetail.collection_stats.owners}</div>
                              <div className="text-xs text-muted-foreground">Unique Owners</div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        {nftDetail.issuer && nftDetail.nft_taxon !== undefined && (
                          <Button
                            variant="default"
                            onClick={() => setLocation(`/nft-collections/${nftDetail.issuer}/${nftDetail.nft_taxon}`)}
                            className="flex items-center gap-2"
                          >
                            <Eye className="h-4 w-4" />
                            Browse Collection
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          onClick={() => window.open(`https://bithomp.com/explorer/${nftDetail.issuer}`, '_blank')}
                          className="flex items-center gap-2"
                        >
                          <ExternalLink className="h-4 w-4" />
                          View Issuer
                        </Button>
                      </div>

                      {/* Technical Information */}
                      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <Database className="h-4 w-4" />
                          Technical Details
                        </h4>
                        <div className="space-y-2 text-sm">
                          {nftDetail.uri && (
                            <div className="flex justify-between items-start">
                              <span className="font-medium">Metadata URI</span>
                              <div className="text-right max-w-xs">
                                <code className="text-xs bg-white dark:bg-gray-900 px-2 py-1 rounded">
                                  {Buffer.from(nftDetail.uri, 'hex').toString('utf8').slice(0, 40)}...
                                </code>
                              </div>
                            </div>
                          )}
                          <div className="flex justify-between items-center">
                            <span className="font-medium">XRPL Network</span>
                            <Badge variant="outline">Mainnet</Badge>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="font-medium">Standard</span>
                            <Badge variant="outline">XLS-20 NFT</Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Layers className="mx-auto h-8 w-8 mb-2 opacity-50" />
                      <p>No collection information available</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="offers" className="space-y-4 mt-6">
                  {/* New Broker-based Offer Manager */}
                  <BrokerOfferManager
                    nftId={nftDetail?.nft_id || ''}
                    nftName={nftDetail?.name || 'Unnamed NFT'}
                    currentOwner={nftDetail?.owner}
                    onOfferUpdate={() => {
                      // Refresh NFT data when offers change
                      if (nftDetail?.nft_id) {
                        fetchNFTDetail(nftDetail.nft_id);
                      }
                    }}
                  />
                </TabsContent>

                <TabsContent value="history" className="space-y-4 mt-6">
                  {historyLoading ? (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="animate-pulse p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                        </div>
                      ))}
                    </div>
                  ) : transactions.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 px-1">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          {transactions.length} Transaction{transactions.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        {transactions.map((tx, index) => (
                          <div 
                            key={index}
                            className="p-3 bg-gray-50/50 dark:bg-gray-800/50 rounded-lg border border-gray-200/60 dark:border-gray-700/60 hover:bg-gray-100/50 dark:hover:bg-gray-800/70 transition-colors"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <Badge variant={
                                tx.type === 'NFTokenMint' ? 'default' : 
                                tx.type === 'NFTokenAcceptOffer' ? 'secondary' : 
                                'outline'
                              } className="text-xs">
                                {tx.type}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(tx.date).toLocaleDateString()}
                              </span>
                            </div>
                            
                            {tx.amount && tx.amount !== 'N/A' && (
                              <div className="text-sm font-medium text-green-600 dark:text-green-400 mb-2">
                                {tx.amount}
                              </div>
                            )}
                            
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <a
                                href={`https://livenet.xrpl.org/transactions/${tx.hash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono text-blue-600 dark:text-blue-400 hover:underline transition-colors inline-flex items-center gap-1 font-semibold"
                              >
                                {tx.hash.slice(0, 10)}...{tx.hash.slice(-6)}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground border rounded-lg bg-gray-50 dark:bg-gray-900">
                      <Clock className="mx-auto h-12 w-12 mb-3 opacity-50" />
                      <p className="font-medium">No transaction history available</p>
                      <p className="text-xs mt-2">Transaction history will appear here when available from XRPL</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* All Offers Dialog - Combined Incoming + Pending */}
      <Dialog open={showOffersDialog} onOpenChange={setShowOffersDialog}>
        <DialogContent className="w-[95vw] sm:w-[90%] sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>
              All Buy Offers ({incomingOffers.length + pendingOffers.length})
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="max-h-96">
            {incomingOffers.length === 0 && pendingOffers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No buy offers yet
              </div>
            ) : (
              <div className="space-y-3">
                {/* Show Incoming Offers First (Direct XRPL Offers) */}
                {incomingOffers.map((offer: any, index: number) => (
                  <Card key={`incoming-${index}`} className="p-4 border-blue-200 dark:border-blue-800">
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-lg">{offer.amount} XRP</p>
                          <Badge variant="secondary" className="text-xs">Direct Offer</Badge>
                        </div>
                        <p className="text-xs text-gray-500">
                          From: {offer.owner?.substring(0, 8)}...{offer.owner?.substring(offer.owner.length - 6)}
                        </p>
                        <p className="text-xs text-gray-400">
                          Offer ID: {(offer.nft_offer_index || offer.offer_index)?.substring(0, 16)}...
                        </p>
                      </div>
                      <Button
                        onClick={() => handleAcceptDirectOffer(
                          offer.nft_offer_index || offer.offer_index, 
                          offer.amount
                        )}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        Accept Offer
                      </Button>
                    </div>
                  </Card>
                ))}

                {/* Show Pending Broker Offers */}
                {pendingOffers.map((offer: any) => (
                  <Card key={offer.nft_offer_index} className="p-4 border-purple-200 dark:border-purple-800">
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-lg">{offer.amountXRP} XRP</p>
                          <Badge variant="outline" className="text-xs">Broker Offer</Badge>
                        </div>
                        <p className="text-xs text-gray-500">
                          From: {offer.owner?.substring(0, 8)}...{offer.owner?.substring(offer.owner.length - 6)}
                        </p>
                        <p className="text-xs text-gray-400">
                          Offer ID: {offer.nft_offer_index?.substring(0, 16)}...
                        </p>
                      </div>
                      <Button
                        onClick={() => handleAcceptOffer(offer.nft_offer_index, offer.amountXRP)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        Accept Offer
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-xs text-blue-800 dark:text-blue-200">
              💡 <strong>How it works:</strong> Accept any offer at your desired price. 
              The broker automatically charges 1.589% fee and distributes royalties to the creator.
            </p>
          </div>
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

      {/* Multi-Wallet Selector Dialog */}
      <WalletSelectorDialog
        open={showWalletSelector}
        onClose={() => setShowWalletSelector(false)}
        onSelectWallet={async (walletType, address) => {
          console.log(`🔐 Selected wallet: ${walletType} at ${address}`);
          
          if (walletType === 'riddle') {
            toast({
              title: "Riddle Wallet Selected",
              description: "You'll be prompted for your password to sign the transaction",
            });
          } else {
            toast({
              title: `${walletType === 'xaman' ? 'Xaman' : 'Joey'} Wallet Selected`,
              description: "External wallet signing coming soon - please use Riddle wallet",
            });
          }
          
          setShowWalletSelector(false);
        }}
        availableWallets={[
          ...(localStorage.getItem('walletData') ? [{
            id: 'riddle',
            name: 'Riddle Wallet',
            type: 'riddle' as const,
            address: JSON.parse(localStorage.getItem('walletData') || '{}').xrpAddress || '',
            available: true
          }] : []),
          ...(localStorage.getItem('xaman_address') ? [{
            id: 'xaman',
            name: 'Xaman Wallet',
            type: 'xaman' as const,
            address: localStorage.getItem('xaman_address') || '',
            available: true
          }] : []),
          ...(localStorage.getItem('joey_address') ? [{
            id: 'joey',
            name: 'Joey Wallet',
            type: 'joey' as const,
            address: localStorage.getItem('joey_address') || '',
            available: true
          }] : [])
        ]}
      />

      {/* Make Offer Dialog */}
      <MakeOfferDialog
        open={showMakeOfferDialog}
        onClose={() => setShowMakeOfferDialog(false)}
        onSubmit={submitOffer}
        nftName={nftDetail?.name || 'Unknown NFT'}
        nftImage={nftDetail?.image}
        currentUserAddress={currentUserAddress || undefined}
        brokerFeePercent={1.589}
      />

      {/* Buy Now Dialog */}
      {selectedSellOffer && (
        <BuyNowDialog
          open={showBuyNowDialog}
          onClose={() => setShowBuyNowDialog(false)}
          onConfirm={confirmBuyNow}
          nftName={nftDetail?.name || 'Unknown NFT'}
          nftImage={nftDetail?.image}
          sellOffer={selectedSellOffer}
          currentUserAddress={currentUserAddress || undefined}
          brokerFeePercent={1.589}
        />
      )}
    </div>
    </div>
  );
}
