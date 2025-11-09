import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { 
  Box, Container, Grid, Card, CardContent, CardMedia, Typography, Button, 
  Chip, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Tabs, Tab, CircularProgress, IconButton, Divider, Alert, Avatar,
  List, ListItem, ListItemText, ListItemAvatar, Paper, Stack, Badge,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip
} from '@mui/material';
import {
  ArrowBack, ContentCopy, OpenInNew, LocalOffer, Send, Delete,
  AttachMoney, Gavel, History, Layers, Person, Star, TrendingUp,
  Shield, EmojiEvents, CalendarToday, Storage, CardGiftcard, Refresh,
  Visibility, Public, VerifiedUser, Diamond, AutoAwesome
} from '@mui/icons-material';
import { useToast } from '@/hooks/use-toast';
import { sessionManager } from '@/utils/sessionManager';

interface NFTDetail {
  nft_id: string;
  name?: string;
  description?: string;
  image?: string;
  collection?: string;
  collection_name?: string;
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

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`nft-tabpanel-${index}`}
      aria-labelledby={`nft-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export default function NFTDetailV3Page() {
  const params = useParams() as { id: string };
  const [, setLocation] = useLocation();
  const [nftDetail, setNftDetail] = useState<NFTDetail | null>(null);
  const [transactions, setTransactions] = useState<NFTTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [currentTab, setCurrentTab] = useState(0);
  const [actionModal, setActionModal] = useState<'sell' | 'transfer' | 'burn' | null>(null);
  const [actionData, setActionData] = useState({ amount: '', destination: '' });
  const [currentUserAddress, setCurrentUserAddress] = useState<string | null>(null);
  const [pendingOffers, setPendingOffers] = useState<any[]>([]);
  const [sellOffers, setSellOffers] = useState<any[]>([]);
  const [buyOfferAmount, setBuyOfferAmount] = useState('');
  const [showMakeOfferDialog, setShowMakeOfferDialog] = useState(false);
  const [showBuyNowDialog, setShowBuyNowDialog] = useState(false);
  const [selectedSellOffer, setSelectedSellOffer] = useState<any>(null);
  const [rarityData, setRarityData] = useState<any>(null);
  const [logoError, setLogoError] = useState(false);
  const { toast } = useToast();
  
  const nftId = params.id;

  const getSessionToken = (): string | null => {
    const managerToken = sessionManager.getSessionToken();
    if (managerToken) return managerToken;
    
    const riddleToken = localStorage.getItem('riddleToken');
    if (riddleToken) return riddleToken;
    
    return localStorage.getItem('sessionToken');
  };

  useEffect(() => {
    if (nftId) {
      fetchNFTDetail(nftId);
      fetchNFTHistory(nftId);
      fetchPendingBuyOffers(nftId);
      fetchSellOffers(nftId);
    }
  }, [nftId]);

  useEffect(() => {
    if (nftDetail?.issuer && nftDetail?.nft_taxon !== undefined) {
      const collectionId = `${nftDetail.issuer}:${nftDetail.nft_taxon || 0}`;
      fetchRarityData(nftId!, collectionId);
    }
  }, [nftDetail?.issuer, nftDetail?.nft_taxon]);

  const fetchNFTDetail = async (id: string) => {
    setLoading(true);
    try {
      console.log(`🔍 Fetching NFT detail for: ${id}`);
      
      const session = sessionManager.getSession();
      let walletAddress: string | null = null;
      
      if (session.isLoggedIn && session.walletData) {
        walletAddress = session.walletData.xrpAddress || null;
        console.log(`🔍 Using authenticated wallet address: ${walletAddress}`);
      }

      setCurrentUserAddress(walletAddress);

      // Try gaming endpoint first
      let response = await fetch(`/api/gaming/nft/${id}?t=${Date.now()}`);
      
      if (response.ok) {
        const gamingData = await response.json() as any;
        if (gamingData.success && gamingData.data) {
          console.log(`🎮 Found GAMING NFT via gaming endpoint`);
          
          setNftDetail({
            nft_id: id,
            name: gamingData.data.metadata?.name || `Gaming NFT #${id.slice(-6)}`,
            description: gamingData.data.description,
            image: gamingData.data.image_url,
            collection: gamingData.data.collection_name,
            collection_name: gamingData.data.collection_name,
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
            power_level: gamingData.data.power_level,
            game_role: gamingData.data.game_role,
            special_abilities: gamingData.data.special_abilities
          });
          setLoading(false);
          return;
        }
      }
      
      // Try regular NFT endpoint
      console.log(`🔍 Trying regular NFT endpoint for: ${id}`);
      response = await fetch(`/api/nft/${id}/details?t=${Date.now()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch NFT detail: ${response.statusText}`);
      }
      
      const data = await response.json() as any;
      
      if (!data || !data.success || !data.nft) {
        throw new Error(`NFT ${id} not found`);
      }

      const nftData = data.nft;
      console.log(`✅ Found NFT via detail endpoint`);
      
      const mappedTraits = nftData.metadata?.attributes || 
                          nftData.metadata?.traits || 
                          nftData.attributes || 
                          nftData.traits || 
                          [];
      
      const imageUrl = nftData.imageUrl || nftData.metadata?.image || nftData.image || '';
      
      setNftDetail({
        nft_id: nftData.nftokenID || id,
        name: nftData.metadata?.name || nftData.name || `NFT #${id.slice(-6)}`,
        description: nftData.metadata?.description || nftData.description,
        image: imageUrl,
        collection: nftData.collection,
        collection_name: typeof nftData.collection === 'string' ? nftData.collection : nftData.collection?.name,
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

  const fetchRarityData = async (id: string, collectionId: string) => {
    try {
      console.log(`📊 [RARITY] Fetching rarity data for NFT: ${id}`);
      const response = await fetch(`/api/nft/${id}/rarity?collectionId=${encodeURIComponent(collectionId)}`);
      
      if (response.ok) {
        const data = await response.json() as any;
        if (data.success && data.rarity) {
          console.log(`✅ [RARITY] Rarity rank: ${data.rarity.rank}/${data.totalSupply}`);
          setRarityData(data);
        }
      }
    } catch (error) {
      console.error('❌ [RARITY] Error fetching rarity:', error);
    }
  };

  const fetchNFTHistory = async (id: string) => {
    setHistoryLoading(true);
    try {
      console.log(`📜 [HISTORY] Fetching transaction history for: ${id}`);
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
        console.log(`📬 Found ${offersWithXRP.length} pending buy offers`);
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
        console.log(`💰 Found ${offersWithXRP.length} sell offers`);
      } else {
        setSellOffers([]);
      }
    } catch (error) {
      console.error('Error fetching sell offers:', error);
      setSellOffers([]);
    }
  };

  const handleNFTAction = async () => {
    if (!actionModal) return;

    try {
      const validToken = getSessionToken();
      
      if (!validToken) {
        toast({
          title: "Authentication Required",
          description: "Please login again to perform NFT actions",
          variant: "destructive"
        });
        return;
      }
      
      let endpoint = '';
      let body = {};
      
      switch (actionModal) {
        case 'burn':
          endpoint = `/api/nft-actions/burn/${nftId}`;
          break;
        case 'transfer':
          endpoint = `/api/nft-actions/transfer/${nftId}`;
          body = { destinationAddress: actionData.destination };
          break;
        case 'sell':
          endpoint = `/api/nft-actions/sell/${nftId}`;
          body = { priceXRP: actionData.amount };
          break;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${validToken}`
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const result = await response.json() as any;

      if (result.success) {
        toast({
          title: "Success",
          description: result.message || `NFT ${actionModal} completed successfully`,
        });
        setActionModal(null);
        setActionData({ amount: '', destination: '' });
        
        if (nftId) {
          fetchNFTDetail(nftId);
          fetchNFTHistory(nftId);
        }
      } else {
        throw new Error(result.error || 'Action failed');
      }
    } catch (error: any) {
      console.error('❌ [NFT ACTION] Error:', error);
      toast({
        title: "Error",
        description: error.message || `Failed to ${actionModal} NFT`,
        variant: "destructive"
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Copied to clipboard"
    });
  };

  const handleBuyNow = async () => {
    if (!currentUserAddress || !nftDetail) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet first",
        variant: "destructive"
      });
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

    const lowestOffer = sellOffers.reduce((lowest, current) => {
      const currentPrice = parseFloat(current.amountXRP);
      const lowestPrice = parseFloat(lowest.amountXRP);
      return currentPrice < lowestPrice ? current : lowest;
    });

    setSelectedSellOffer(lowestOffer);
    setShowBuyNowDialog(true);
  };

  const confirmBuyNow = async () => {
    if (!selectedSellOffer || !nftDetail) return;

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
          buyPrice: selectedSellOffer.amountXRP,
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
        return;
      }

      toast({
        title: "Purchase Successful!",
        description: `NFT purchased successfully`,
      });

      setShowBuyNowDialog(false);
      if (nftId) {
        fetchNFTDetail(nftId);
      }

    } catch (error) {
      console.error('Buy now error:', error);
      toast({
        title: "Error",
        description: "Failed to process buy order",
        variant: "destructive"
      });
    }
  };

  const handleMakeOffer = async () => {
    if (!currentUserAddress || !nftDetail) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet first",
        variant: "destructive"
      });
      return;
    }

    setShowMakeOfferDialog(true);
  };

  const submitOffer = async () => {
    if (!nftDetail || !buyOfferAmount) return;

    const sessionData = sessionStorage.getItem('riddle_wallet_session');
    
    if (!sessionData) {
      toast({
        title: "Session Expired",
        description: "Please log in again to make an offer",
        variant: "destructive"
      });
      return;
    }

    let sessionToken: string;
    
    try {
      const parsed = JSON.parse(sessionData);
      sessionToken = parsed.sessionToken;
    } catch (e) {
      toast({
        title: "Session Error",
        description: "Please log in again",
        variant: "destructive"
      });
      return;
    }
    
    if (!sessionToken) {
      toast({
        title: "Authentication Required",
        description: "Please log in to make an offer",
        variant: "destructive"
      });
      return;
    }

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
        offerAmountXrp: buyOfferAmount,
        nftOwner: nftDetail.owner || nftDetail.issuer
      })
    });

    const data = await response.json() as any;
    
    if (data.success) {
      toast({
        title: "✅ Offer Created!",
        description: `Broker-directed offer of ${buyOfferAmount} XRP created`,
      });
      setShowMakeOfferDialog(false);
      setBuyOfferAmount('');
      fetchPendingBuyOffers(nftDetail.nft_id);
    } else {
      toast({
        title: "Error",
        description: data.error || 'Failed to create broker offer',
        variant: "destructive"
      });
    }
  };

  const handleAcceptOffer = async (buyOfferId: string, offerAmountXRP: string) => {
    if (!nftDetail) return;
    setLocation(`/nft/${nftDetail.nft_id}/accept-offer/${buyOfferId}`);
  };

  const getRarityColor = (tier: string) => {
    switch (tier) {
      case 'Legendary': return 'warning';
      case 'Epic': return 'secondary';
      case 'Rare': return 'primary';
      case 'Uncommon': return 'success';
      default: return 'default';
    }
  };

  const formatNumber = (num: number | undefined, decimals = 2): string => {
    if (num === undefined || num === null) return 'N/A';
    if (num >= 1e9) return `${(num / 1e9).toFixed(decimals)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(decimals)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(decimals)}K`;
    return num.toFixed(decimals);
  };

  if (loading) {
    return (
      <Box sx={{ 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0a0e27 0%, #1a1f3a 50%, #0f1419 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <CircularProgress size={60} sx={{ color: '#00d4ff' }} />
      </Box>
    );
  }

  if (!nftDetail) {
    return (
      <Box sx={{ 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0a0e27 0%, #1a1f3a 50%, #0f1419 100%)',
        py: 8
      }}>
        <Container maxWidth="lg">
          <Card sx={{ bgcolor: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(0, 212, 255, 0.2)' }}>
            <CardContent sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="h5" gutterBottom color="white">NFT Not Found</Typography>
              <Typography color="rgba(255, 255, 255, 0.7)" sx={{ mb: 3 }}>
                The requested NFT could not be loaded.
              </Typography>
              <Button
                variant="contained"
                startIcon={<ArrowBack />}
                onClick={() => setLocation('/nft-marketplace')}
                sx={{ bgcolor: '#00d4ff', '&:hover': { bgcolor: '#00b8e6' } }}
              >
                Back to Marketplace
              </Button>
            </CardContent>
          </Card>
        </Container>
      </Box>
    );
  }

  const isOwner = currentUserAddress && nftDetail.owner && 
                  currentUserAddress.toLowerCase().trim() === nftDetail.owner.toLowerCase().trim();

  return (
    <Box sx={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0e27 0%, #1a1f3a 50%, #0f1419 100%)',
      pb: 8
    }}>
      <Container maxWidth="xl" sx={{ pt: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button
            variant="text"
            startIcon={<ArrowBack />}
            onClick={() => setLocation('/nft-marketplace')}
            sx={{ color: '#00d4ff' }}
          >
            Back to Marketplace
          </Button>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Refresh NFT Data">
              <IconButton 
                onClick={() => nftId && fetchNFTDetail(nftId)}
                sx={{ color: '#00d4ff' }}
              >
                <Refresh />
              </IconButton>
            </Tooltip>
            <Chip
              icon={<Storage />}
              label={`#${nftDetail.nft_id.slice(-8)}`}
              sx={{ 
                bgcolor: 'rgba(0, 212, 255, 0.1)', 
                color: '#00d4ff',
                border: '1px solid rgba(0, 212, 255, 0.3)'
              }}
            />
          </Stack>
        </Box>

        <Grid container spacing={4}>
          {/* Left Column - Image and Actions */}
          <Grid item xs={12} lg={5}>
            <Card sx={{ bgcolor: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(0, 212, 255, 0.2)' }}>
              <CardMedia
                component="img"
                image={!logoError && nftDetail.image ? nftDetail.image : 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDQwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjQwMCIgaGVpZ2h0PSI0MDAiIGZpbGw9IiMyMjIiLz48dGV4dCB4PSIyMDAiIHk9IjIxMCIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTgiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiPk5GVDwvdGV4dD48L3N2Zz4='}
                alt={nftDetail.name}
                onError={() => setLogoError(true)}
                sx={{ 
                  aspectRatio: '1/1', 
                  objectFit: 'contain', 
                  bgcolor: '#000',
                  borderBottom: '1px solid rgba(0, 212, 255, 0.2)'
                }}
              />
              <CardContent>
                {/* Rarity Badge */}
                {rarityData && rarityData.rarity && (
                  <Box sx={{ mb: 2 }}>
                    <Chip
                      icon={<Diamond />}
                      label={`${rarityData.rarity.rarityTier} - Rank #${rarityData.rarity.rank}`}
                      color={getRarityColor(rarityData.rarity.rarityTier)}
                      sx={{ width: '100%', fontWeight: 'bold' }}
                    />
                  </Box>
                )}

                <Stack spacing={2}>
                  {isOwner ? (
                    <>
                      <Typography variant="subtitle2" color="rgba(255, 255, 255, 0.7)">
                        Owner Actions
                      </Typography>
                      <Grid container spacing={1}>
                        <Grid item xs={6}>
                          <Button
                            fullWidth
                            variant="outlined"
                            startIcon={<AttachMoney />}
                            onClick={() => setActionModal('sell')}
                            sx={{ 
                              color: '#00d4ff', 
                              borderColor: 'rgba(0, 212, 255, 0.3)',
                              '&:hover': { borderColor: '#00d4ff', bgcolor: 'rgba(0, 212, 255, 0.1)' }
                            }}
                          >
                            Sell
                          </Button>
                        </Grid>
                        <Grid item xs={6}>
                          <Button
                            fullWidth
                            variant="outlined"
                            startIcon={<Send />}
                            onClick={() => setActionModal('transfer')}
                            sx={{ 
                              color: '#00d4ff', 
                              borderColor: 'rgba(0, 212, 255, 0.3)',
                              '&:hover': { borderColor: '#00d4ff', bgcolor: 'rgba(0, 212, 255, 0.1)' }
                            }}
                          >
                            Transfer
                          </Button>
                        </Grid>
                        <Grid item xs={12}>
                          <Button
                            fullWidth
                            variant="outlined"
                            color="error"
                            startIcon={<Delete />}
                            onClick={() => setActionModal('burn')}
                          >
                            Burn NFT
                          </Button>
                        </Grid>
                        {(pendingOffers.length > 0) && (
                          <Grid item xs={12}>
                            <Badge badgeContent={pendingOffers.length} color="primary">
                              <Button
                                fullWidth
                                variant="contained"
                                startIcon={<CardGiftcard />}
                                onClick={() => setCurrentTab(3)}
                                sx={{ 
                                  bgcolor: '#00d4ff', 
                                  color: '#000',
                                  '&:hover': { bgcolor: '#00b8e6' } 
                                }}
                              >
                                View Offers
                              </Button>
                            </Badge>
                          </Grid>
                        )}
                      </Grid>
                    </>
                  ) : (
                    <>
                      <Typography variant="subtitle2" color="rgba(255, 255, 255, 0.7)">
                        Purchase Options
                      </Typography>
                      {sellOffers.length > 0 && (
                        <Button
                          fullWidth
                          variant="contained"
                          startIcon={<AttachMoney />}
                          onClick={handleBuyNow}
                          disabled={!currentUserAddress}
                          sx={{ 
                            bgcolor: '#00ff00', 
                            color: '#000',
                            '&:hover': { bgcolor: '#00dd00' },
                            fontWeight: 'bold'
                          }}
                        >
                          Buy Now - {Math.min(...sellOffers.map(o => parseFloat(o.amountXRP))).toFixed(2)} XRP
                        </Button>
                      )}
                      <Button
                        fullWidth
                        variant="contained"
                        startIcon={<LocalOffer />}
                        onClick={handleMakeOffer}
                        disabled={!currentUserAddress}
                        sx={{ 
                          bgcolor: '#00d4ff', 
                          color: '#000',
                          '&:hover': { bgcolor: '#00b8e6' } 
                        }}
                      >
                        Make Offer
                      </Button>
                      {!currentUserAddress && (
                        <Alert 
                          severity="info" 
                          sx={{ 
                            bgcolor: 'rgba(0, 212, 255, 0.1)', 
                            color: '#00d4ff',
                            border: '1px solid rgba(0, 212, 255, 0.3)'
                          }}
                        >
                          Connect wallet to buy or make offers
                        </Alert>
                      )}
                    </>
                  )}
                  
                  <Divider sx={{ borderColor: 'rgba(0, 212, 255, 0.2)' }} />
                  
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<OpenInNew />}
                    onClick={() => window.open(`https://xrpl.org/nft-explorer/#/nft/${nftId}`, '_blank')}
                    sx={{ 
                      color: '#00d4ff', 
                      borderColor: 'rgba(0, 212, 255, 0.3)',
                      '&:hover': { borderColor: '#00d4ff', bgcolor: 'rgba(0, 212, 255, 0.1)' }
                    }}
                  >
                    View on XRPL Explorer
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Right Column - Details */}
          <Grid item xs={12} lg={7}>
            <Card sx={{ bgcolor: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(0, 212, 255, 0.2)' }}>
              <CardContent>
                {/* NFT Header */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h4" gutterBottom sx={{ color: 'white', fontWeight: 'bold' }}>
                    {nftDetail.name || `NFT #${nftDetail.nft_id.slice(0, 8)}`}
                  </Typography>
                  
                  {(nftDetail.collection_name || nftDetail.collection) && (
                    <Chip
                      label={nftDetail.collection_name || nftDetail.collection}
                      sx={{ 
                        bgcolor: 'rgba(0, 212, 255, 0.1)', 
                        color: '#00d4ff',
                        border: '1px solid rgba(0, 212, 255, 0.3)',
                        mb: 2
                      }}
                    />
                  )}
                </Box>

                <Tabs 
                  value={currentTab} 
                  onChange={(_, val) => setCurrentTab(val)}
                  sx={{
                    borderBottom: '1px solid rgba(0, 212, 255, 0.2)',
                    '& .MuiTab-root': {
                      color: 'rgba(255, 255, 255, 0.7)',
                      '&.Mui-selected': { color: '#00d4ff' }
                    },
                    '& .MuiTabs-indicator': { bgcolor: '#00d4ff' }
                  }}
                >
                  <Tab label="Overview" icon={<Visibility />} iconPosition="start" />
                  <Tab label="Traits" icon={<AutoAwesome />} iconPosition="start" />
                  <Tab label="Collection" icon={<Layers />} iconPosition="start" />
                  <Tab 
                    label={`Offers ${pendingOffers.length > 0 ? `(${pendingOffers.length})` : ''}`} 
                    icon={<LocalOffer />} 
                    iconPosition="start"
                  />
                  <Tab label="History" icon={<History />} iconPosition="start" />
                </Tabs>

                {/* Overview Tab */}
                <TabPanel value={currentTab} index={0}>
                  <Stack spacing={3}>
                    {nftDetail.description && (
                      <Box>
                        <Typography variant="subtitle2" gutterBottom fontWeight="bold" color="white">
                          Description
                        </Typography>
                        <Typography variant="body2" color="rgba(255, 255, 255, 0.7)">
                          {nftDetail.description}
                        </Typography>
                      </Box>
                    )}

                    <Divider sx={{ borderColor: 'rgba(0, 212, 255, 0.2)' }} />

                    <List dense>
                      <ListItem sx={{ bgcolor: 'rgba(0, 212, 255, 0.05)', borderRadius: 1, mb: 1 }}>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: 'rgba(0, 212, 255, 0.2)' }}>
                            <Storage sx={{ color: '#00d4ff' }} />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={<Typography color="white">NFT ID</Typography>}
                          secondary={
                            <Box display="flex" alignItems="center" gap={1}>
                              <Typography variant="caption" fontFamily="monospace" color="rgba(255, 255, 255, 0.7)">
                                {nftDetail.nft_id.slice(0, 12)}...{nftDetail.nft_id.slice(-8)}
                              </Typography>
                              <IconButton size="small" onClick={() => copyToClipboard(nftDetail.nft_id)}>
                                <ContentCopy fontSize="small" sx={{ color: '#00d4ff' }} />
                              </IconButton>
                            </Box>
                          }
                        />
                      </ListItem>

                      {nftDetail.nft_taxon !== undefined && (
                        <ListItem sx={{ bgcolor: 'rgba(0, 212, 255, 0.05)', borderRadius: 1, mb: 1 }}>
                          <ListItemAvatar>
                            <Avatar sx={{ bgcolor: 'rgba(0, 212, 255, 0.2)' }}>
                              <Layers sx={{ color: '#00d4ff' }} />
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={<Typography color="white">NFT Taxon</Typography>}
                            secondary={<Typography color="rgba(255, 255, 255, 0.7)">{nftDetail.nft_taxon}</Typography>}
                          />
                        </ListItem>
                      )}

                      {nftDetail.owner && (
                        <ListItem sx={{ bgcolor: 'rgba(0, 212, 255, 0.05)', borderRadius: 1, mb: 1 }}>
                          <ListItemAvatar>
                            <Avatar sx={{ bgcolor: 'rgba(0, 212, 255, 0.2)' }}>
                              <Person sx={{ color: '#00d4ff' }} />
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={<Typography color="white">Owner</Typography>}
                            secondary={
                              <Box display="flex" alignItems="center" gap={1}>
                                <Typography
                                  variant="caption"
                                  fontFamily="monospace"
                                  sx={{ cursor: 'pointer', color: '#00d4ff' }}
                                  onClick={() => setLocation(`/wallet/${nftDetail.owner}`)}
                                >
                                  {nftDetail.owner.slice(0, 8)}...{nftDetail.owner.slice(-8)}
                                </Typography>
                                <IconButton size="small" onClick={() => copyToClipboard(nftDetail.owner || '')}>
                                  <ContentCopy fontSize="small" sx={{ color: '#00d4ff' }} />
                                </IconButton>
                              </Box>
                            }
                          />
                        </ListItem>
                      )}

                      {nftDetail.issuer && (
                        <ListItem sx={{ bgcolor: 'rgba(0, 212, 255, 0.05)', borderRadius: 1, mb: 1 }}>
                          <ListItemAvatar>
                            <Avatar sx={{ bgcolor: 'rgba(0, 212, 255, 0.2)' }}>
                              <EmojiEvents sx={{ color: '#00d4ff' }} />
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={<Typography color="white">Issuer</Typography>}
                            secondary={
                              <Box display="flex" alignItems="center" gap={1}>
                                <Typography
                                  variant="caption"
                                  fontFamily="monospace"
                                  sx={{ cursor: 'pointer', color: '#00d4ff' }}
                                  onClick={() => setLocation(`/wallet/${nftDetail.issuer}`)}
                                >
                                  {nftDetail.issuer.slice(0, 8)}...{nftDetail.issuer.slice(-8)}
                                </Typography>
                                <IconButton size="small" onClick={() => copyToClipboard(nftDetail.issuer || '')}>
                                  <ContentCopy fontSize="small" sx={{ color: '#00d4ff' }} />
                                </IconButton>
                              </Box>
                            }
                          />
                        </ListItem>
                      )}
                    </List>
                  </Stack>
                </TabPanel>

                {/* Traits Tab */}
                <TabPanel value={currentTab} index={1}>
                  <Stack spacing={2}>
                    {rarityData && rarityData.rarity && (
                      <Paper sx={{ p: 2, bgcolor: 'rgba(0, 212, 255, 0.1)', border: '1px solid rgba(0, 212, 255, 0.3)' }}>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                          <Typography variant="h6" color="white">Rarity Score</Typography>
                          <Chip
                            label={rarityData.rarity.rarityTier}
                            color={getRarityColor(rarityData.rarity.rarityTier)}
                          />
                        </Box>
                        <Grid container spacing={2}>
                          <Grid item xs={4}>
                            <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'rgba(0, 0, 0, 0.3)' }}>
                              <Typography variant="h5" color="#00d4ff">
                                {rarityData.rarity.rarityScore.toFixed(2)}
                              </Typography>
                              <Typography variant="caption" color="rgba(255, 255, 255, 0.7)">
                                Rarity Score
                              </Typography>
                            </Paper>
                          </Grid>
                          <Grid item xs={4}>
                            <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'rgba(0, 0, 0, 0.3)' }}>
                              <Typography variant="h5" color="#00d4ff">
                                #{rarityData.rarity.rank}
                              </Typography>
                              <Typography variant="caption" color="rgba(255, 255, 255, 0.7)">
                                Rank
                              </Typography>
                            </Paper>
                          </Grid>
                          <Grid item xs={4}>
                            <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'rgba(0, 0, 0, 0.3)' }}>
                              <Typography variant="h5" color="#00d4ff">
                                {rarityData.rarity.rarityPercentage.toFixed(1)}%
                              </Typography>
                              <Typography variant="caption" color="rgba(255, 255, 255, 0.7)">
                                Top Percentile
                              </Typography>
                            </Paper>
                          </Grid>
                        </Grid>
                      </Paper>
                    )}

                    {nftDetail.traits && nftDetail.traits.length > 0 ? (
                      <Grid container spacing={2}>
                        {nftDetail.traits.map((trait, index) => {
                          const traitRarity = rarityData?.rarity?.traitRarities?.find(
                            (tr: any) => tr.trait_type === trait.trait_type && tr.value === trait.value
                          );
                          
                          return (
                            <Grid item xs={12} sm={6} md={4} key={index}>
                              <Paper
                                sx={{
                                  p: 2,
                                  cursor: 'pointer',
                                  bgcolor: 'rgba(0, 212, 255, 0.05)',
                                  border: '1px solid rgba(0, 212, 255, 0.2)',
                                  '&:hover': { 
                                    bgcolor: 'rgba(0, 212, 255, 0.15)',
                                    borderColor: '#00d4ff'
                                  }
                                }}
                                onClick={() => {
                                  if (nftDetail.issuer && nftDetail.nft_taxon !== undefined) {
                                    setLocation(`/nft-collections/${nftDetail.issuer}/${nftDetail.nft_taxon}?trait=${encodeURIComponent(trait.trait_type)}&value=${encodeURIComponent(trait.value)}`);
                                  }
                                }}
                              >
                                <Box display="flex" justifyContent="space-between" mb={0.5}>
                                  <Typography variant="caption" color="rgba(255, 255, 255, 0.5)" textTransform="uppercase">
                                    {trait.trait_type}
                                  </Typography>
                                  {traitRarity && (
                                    <Typography variant="caption" color="#00ff00" fontWeight="bold">
                                      {traitRarity.percentage.toFixed(1)}%
                                    </Typography>
                                  )}
                                </Box>
                                <Typography variant="body2" fontWeight="medium" color="white">
                                  {trait.value}
                                </Typography>
                              </Paper>
                            </Grid>
                          );
                        })}
                      </Grid>
                    ) : (
                      <Box textAlign="center" py={4}>
                        <Star sx={{ fontSize: 48, color: 'rgba(255, 255, 255, 0.3)', mb: 1 }} />
                        <Typography color="rgba(255, 255, 255, 0.7)">
                          No traits available for this NFT
                        </Typography>
                      </Box>
                    )}
                  </Stack>
                </TabPanel>

                {/* Collection Tab */}
                <TabPanel value={currentTab} index={2}>
                  <Stack spacing={2}>
                    <Typography variant="body2" color="rgba(255, 255, 255, 0.7)">
                      Collection information coming soon...
                    </Typography>
                  </Stack>
                </TabPanel>

                {/* Offers Tab */}
                <TabPanel value={currentTab} index={3}>
                  <Stack spacing={2}>
                    {pendingOffers.length > 0 ? (
                      pendingOffers.map((offer: any) => (
                        <Paper 
                          key={offer.nft_offer_index} 
                          sx={{ 
                            p: 2,
                            bgcolor: 'rgba(0, 212, 255, 0.05)',
                            border: '1px solid rgba(0, 212, 255, 0.2)'
                          }}
                        >
                          <Box display="flex" justifyContent="space-between" alignItems="center">
                            <Box>
                              <Typography variant="h6" color="white">
                                {offer.amountXRP} XRP
                              </Typography>
                              <Typography variant="caption" color="rgba(255, 255, 255, 0.5)">
                                From: {offer.owner?.substring(0, 8)}...{offer.owner?.substring(offer.owner.length - 6)}
                              </Typography>
                              <Typography variant="caption" display="block" color="rgba(255, 255, 255, 0.5)">
                                Offer ID: {offer.nft_offer_index?.substring(0, 16)}...
                              </Typography>
                            </Box>
                            {isOwner && (
                              <Button
                                variant="contained"
                                onClick={() => handleAcceptOffer(offer.nft_offer_index, offer.amountXRP)}
                                sx={{ 
                                  bgcolor: '#00ff00', 
                                  color: '#000',
                                  '&:hover': { bgcolor: '#00dd00' } 
                                }}
                              >
                                Accept
                              </Button>
                            )}
                          </Box>
                        </Paper>
                      ))
                    ) : (
                      <Box textAlign="center" py={4}>
                        <LocalOffer sx={{ fontSize: 48, color: 'rgba(255, 255, 255, 0.3)', mb: 1 }} />
                        <Typography color="rgba(255, 255, 255, 0.7)">
                          No buy offers yet
                        </Typography>
                      </Box>
                    )}
                  </Stack>
                </TabPanel>

                {/* History Tab */}
                <TabPanel value={currentTab} index={4}>
                  <Stack spacing={2}>
                    {historyLoading ? (
                      <Box display="flex" justifyContent="center" py={4}>
                        <CircularProgress sx={{ color: '#00d4ff' }} />
                      </Box>
                    ) : transactions.length > 0 ? (
                      transactions.map((tx, index) => (
                        <Paper 
                          key={index} 
                          sx={{ 
                            p: 2,
                            bgcolor: 'rgba(0, 212, 255, 0.05)',
                            border: '1px solid rgba(0, 212, 255, 0.2)'
                          }}
                        >
                          <Box display="flex" justifyContent="space-between" mb={1}>
                            <Chip
                              label={tx.type}
                              size="small"
                              color={tx.type === 'NFTokenMint' ? 'primary' : 'default'}
                            />
                            <Typography variant="caption" color="rgba(255, 255, 255, 0.5)">
                              {new Date(tx.date).toLocaleDateString()}
                            </Typography>
                          </Box>
                          {tx.amount && tx.amount !== 'N/A' && (
                            <Typography variant="body2" color="#00ff00" sx={{ mb: 1 }}>
                              {tx.amount}
                            </Typography>
                          )}
                          <Typography
                            variant="caption"
                            fontFamily="monospace"
                            sx={{ cursor: 'pointer', color: '#00d4ff' }}
                            onClick={() => window.open(`https://livenet.xrpl.org/transactions/${tx.hash}`, '_blank')}
                          >
                            {tx.hash.slice(0, 10)}...{tx.hash.slice(-6)} <OpenInNew sx={{ fontSize: 12 }} />
                          </Typography>
                        </Paper>
                      ))
                    ) : (
                      <Box textAlign="center" py={4}>
                        <History sx={{ fontSize: 48, color: 'rgba(255, 255, 255, 0.3)', mb: 1 }} />
                        <Typography color="rgba(255, 255, 255, 0.7)">
                          No transaction history available
                        </Typography>
                      </Box>
                    )}
                  </Stack>
                </TabPanel>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>

      {/* Action Dialogs */}
      <Dialog 
        open={!!actionModal} 
        onClose={() => setActionModal(null)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: 'rgba(26, 31, 58, 0.95)',
            border: '1px solid rgba(0, 212, 255, 0.3)',
            backdropFilter: 'blur(10px)'
          }
        }}
      >
        <DialogTitle sx={{ color: 'white' }}>
          {actionModal === 'sell' && 'Sell NFT'}
          {actionModal === 'transfer' && 'Transfer NFT'}
          {actionModal === 'burn' && 'Burn NFT'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ pt: 2 }}>
            <Typography variant="body2" color="rgba(255, 255, 255, 0.7)">
              {nftDetail.name}
            </Typography>
            
            {actionModal === 'sell' && (
              <TextField
                label="Sale Price (XRP)"
                type="number"
                fullWidth
                value={actionData.amount}
                onChange={(e) => setActionData({ ...actionData, amount: e.target.value })}
                inputProps={{ step: '0.000001' }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: 'white',
                    '& fieldset': { borderColor: 'rgba(0, 212, 255, 0.3)' },
                    '&:hover fieldset': { borderColor: '#00d4ff' }
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.7)' }
                }}
              />
            )}
            
            {actionModal === 'transfer' && (
              <TextField
                label="Destination Address"
                fullWidth
                value={actionData.destination}
                onChange={(e) => setActionData({ ...actionData, destination: e.target.value })}
                placeholder="r... (XRPL address)"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: 'white',
                    '& fieldset': { borderColor: 'rgba(0, 212, 255, 0.3)' },
                    '&:hover fieldset': { borderColor: '#00d4ff' }
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.7)' }
                }}
              />
            )}
            
            {actionModal === 'burn' && (
              <Alert 
                severity="error"
                sx={{
                  bgcolor: 'rgba(255, 0, 0, 0.1)',
                  color: '#ff0000',
                  border: '1px solid rgba(255, 0, 0, 0.3)'
                }}
              >
                ⚠️ This action is permanent and cannot be undone. The NFT will be permanently destroyed.
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActionModal(null)} sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color={actionModal === 'burn' ? 'error' : 'primary'}
            onClick={handleNFTAction}
            disabled={
              (actionModal === 'sell' && !actionData.amount) ||
              (actionModal === 'transfer' && !actionData.destination)
            }
            sx={actionModal !== 'burn' ? {
              bgcolor: '#00d4ff',
              color: '#000',
              '&:hover': { bgcolor: '#00b8e6' }
            } : undefined}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      {/* Make Offer Dialog */}
      <Dialog 
        open={showMakeOfferDialog} 
        onClose={() => setShowMakeOfferDialog(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: 'rgba(26, 31, 58, 0.95)',
            border: '1px solid rgba(0, 212, 255, 0.3)',
            backdropFilter: 'blur(10px)'
          }
        }}
      >
        <DialogTitle sx={{ color: 'white' }}>Make an Offer</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ pt: 2 }}>
            <Typography variant="body2" color="rgba(255, 255, 255, 0.7)">
              {nftDetail.name}
            </Typography>
            <TextField
              label="Offer Amount (XRP)"
              type="number"
              fullWidth
              value={buyOfferAmount}
              onChange={(e) => setBuyOfferAmount(e.target.value)}
              inputProps={{ step: '0.000001', min: '0' }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: 'white',
                  '& fieldset': { borderColor: 'rgba(0, 212, 255, 0.3)' },
                  '&:hover fieldset': { borderColor: '#00d4ff' }
                },
                '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.7)' }
              }}
            />
            <Alert 
              severity="info"
              sx={{
                bgcolor: 'rgba(0, 212, 255, 0.1)',
                color: '#00d4ff',
                border: '1px solid rgba(0, 212, 255, 0.3)'
              }}
            >
              Funds will be reserved on-chain until the offer is accepted or cancelled. Broker fee: 1.589%
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowMakeOfferDialog(false)} sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={submitOffer}
            disabled={!buyOfferAmount || parseFloat(buyOfferAmount) <= 0}
            sx={{
              bgcolor: '#00d4ff',
              color: '#000',
              '&:hover': { bgcolor: '#00b8e6' }
            }}
          >
            Create Offer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Buy Now Dialog */}
      <Dialog 
        open={showBuyNowDialog} 
        onClose={() => setShowBuyNowDialog(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: 'rgba(26, 31, 58, 0.95)',
            border: '1px solid rgba(0, 212, 255, 0.3)',
            backdropFilter: 'blur(10px)'
          }
        }}
      >
        <DialogTitle sx={{ color: 'white' }}>Confirm Purchase</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ pt: 2 }}>
            <Typography variant="body2" color="rgba(255, 255, 255, 0.7)">
              {nftDetail.name}
            </Typography>
            {selectedSellOffer && (
              <>
                <Box>
                  <Typography variant="h5" color="#00d4ff">
                    {selectedSellOffer.amountXRP} XRP
                  </Typography>
                  <Typography variant="caption" color="rgba(255, 255, 255, 0.5)">
                    + 1.589% broker fee
                  </Typography>
                </Box>
                <Alert 
                  severity="info"
                  sx={{
                    bgcolor: 'rgba(0, 212, 255, 0.1)',
                    color: '#00d4ff',
                    border: '1px solid rgba(0, 212, 255, 0.3)'
                  }}
                >
                  This will purchase the NFT using the broker wallet system. The seller will receive payment minus broker fees and royalties.
                </Alert>
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowBuyNowDialog(false)} sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={confirmBuyNow}
            sx={{
              bgcolor: '#00ff00',
              color: '#000',
              '&:hover': { bgcolor: '#00dd00' }
            }}
          >
            Confirm Purchase
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
