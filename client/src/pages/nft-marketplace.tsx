// ============================================================================
// NFT MARKETPLACE - MATERIAL UI VERSION
// ============================================================================
// Multi-chain NFT marketplace with XRPL, Ethereum, and Solana support
// Features: Volume tracking, Sales monitoring, Live mints, Favorites
// ============================================================================

import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useDynamicMetadata, GAMING_METADATA } from '@/hooks/use-dynamic-metadata';

// ============================================================================
// ICONS
// ============================================================================
import { 
  Search, Eye, Grid, List, Star, BarChart3, Activity, 
  DollarSign, Heart, Sun, Moon, ExternalLink 
} from 'lucide-react';

// ============================================================================
// MATERIAL UI COMPONENTS
// ============================================================================
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import Paper from '@mui/material/Paper';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import LinearProgress from '@mui/material/LinearProgress';
import Zoom from '@mui/material/Zoom';

// ============================================================================
// ADVERTISING BANNER COMPONENT
// ============================================================================
const AdBanner = ({ isDark }: { isDark: boolean }) => {
  return (
    <Paper
      elevation={3}
      sx={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: 3,
        overflow: 'hidden',
        mb: 4,
        minHeight: '180px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'transform 0.3s ease',
        '&:hover': { transform: 'scale(1.02)' }
      }}
      onClick={() => window.open('https://riddleswap.com', '_blank')}
    >
      <Box sx={{ textAlign: 'center', p: 3, zIndex: 1 }}>
        <Typography variant="h4" sx={{ color: 'white', fontWeight: 'bold', mb: 1 }}>
          🚀 Launch Your NFT Collection
        </Typography>
        <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.9)', mb: 2 }}>
          No-code NFT minting on XRPL • Zero gas fees • Instant deployment
        </Typography>
        <Button
          variant="contained"
          size="large"
          startIcon={<ExternalLink />}
          sx={{
            bgcolor: 'white',
            color: '#667eea',
            fontWeight: 'bold',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' }
          }}
        >
          Get Started Free
        </Button>
      </Box>
    </Paper>
  );
};

// ============================================================================
// NFT COLLECTION CARD COMPONENT
// ============================================================================
const CollectionCard = ({ 
  collection, 
  activeTab, 
  onFavoriteToggle, 
  isDark 
}: { 
  collection: any; 
  activeTab: string;
  onFavoriteToggle?: (collection: any, isFavorited: boolean) => void;
  isDark: boolean;
}) => {
  const [, setLocation] = useLocation();
  const [isFavorited, setIsFavorited] = useState(collection.isFavorite || false);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);
  
  // ============================================================================
  // NAVIGATION HANDLER
  // ============================================================================
  const handleCardClick = () => {
    if (collection.chain && collection.chain !== 'xrpl') {
      // Multi-chain collection
      if (collection.contractAddress) {
        setLocation(`/nft-collection/${collection.chain}/${collection.contractAddress}`);
      }
    } else {
      // XRPL collection
      if (collection.issuer && collection.taxon !== undefined) {
        setLocation(`/nft-collection/${collection.issuer}/${collection.taxon}`);
      }
    }
  };
  
  // ============================================================================
  // FAVORITE TOGGLE HANDLER
  // ============================================================================
  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only XRPL collections support favorites
    const isXRPL = !collection.chain || collection.chain === 'xrpl';
    if (!isXRPL) {
      console.log('⚠️ Favorites not yet supported for multi-chain collections');
      return;
    }
    
    setIsTogglingFavorite(true);
    
    try {
      const sessionToken = localStorage.getItem('sessionToken') || sessionStorage.getItem('sessionToken');
      
      if (!sessionToken) {
        alert('Please login to add favorites');
        return;
      }
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-session-token': sessionToken
      };
      
      if (isFavorited) {
        // Remove from favorites
        const response = await fetch(`/api/user-favorites/${collection.issuer}/${collection.taxon}`, {
          method: 'DELETE',
          headers
        });
        
        if (response.ok) {
          setIsFavorited(false);
          onFavoriteToggle?.(collection, false);
        }
      } else {
        // Add to favorites
        const response = await fetch(`/api/user-favorites/${collection.issuer}/${collection.taxon}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name: collection.name,
            image: collection.image
          })
        });
        
        if (response.ok) {
          setIsFavorited(true);
          onFavoriteToggle?.(collection, true);
        }
      }
    } catch (error) {
      console.error('❌ Failed to toggle favorite:', error);
    } finally {
      setIsTogglingFavorite(false);
    }
  };
  
  // Check if collection has valid data
  const hasValidData = collection.chain && collection.chain !== 'xrpl' 
    ? !!collection.contractAddress 
    : (collection.issuer && collection.taxon !== undefined);
  
  // ============================================================================
  // CARD RENDER
  // ============================================================================
  return (
    <Zoom in timeout={300}>
      <Card
        elevation={isDark ? 8 : 3}
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          cursor: hasValidData ? 'pointer' : 'default',
          opacity: hasValidData ? 1 : 0.75,
          transition: 'all 0.3s ease',
          borderRadius: 2,
          overflow: 'hidden',
          background: isDark 
            ? 'linear-gradient(145deg, #1e1e1e 0%, #2d2d2d 100%)'
            : 'linear-gradient(145deg, #ffffff 0%, #f5f5f5 100%)',
          '&:hover': {
            transform: hasValidData ? 'translateY(-8px)' : 'none',
            boxShadow: isDark 
              ? '0 20px 40px rgba(139, 92, 246, 0.3)'
              : '0 20px 40px rgba(59, 130, 246, 0.2)',
          }
        }}
        onClick={handleCardClick}
      >
        {/* IMAGE SECTION */}
        <Box sx={{ position: 'relative' }}>
          <CardMedia
            component="img"
            height="240"
            image={collection.image}
            alt={collection.name}
            sx={{
              objectFit: 'cover',
              transition: 'transform 0.5s ease',
              '&:hover': { transform: 'scale(1.1)' }
            }}
            onError={(e: any) => {
              e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiM2MTYxNjEiLz48dGV4dCB4PSIxMDAiIHk9IjEwNSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5ORlQ8L3RleHQ+PC9zdmc+';
            }}
          />
          
          {/* Verified Badge */}
          {collection.verified && (
            <Chip
              icon={<Star style={{ fontSize: 14, fill: 'white' }} />}
              label="Verified"
              size="small"
              sx={{
                position: 'absolute',
                top: 12,
                left: 12,
                bgcolor: isDark ? '#3b82f6' : '#2563eb',
                color: 'white',
                fontWeight: 'bold'
              }}
            />
          )}
          
          {/* Favorite Button */}
          <IconButton
            onClick={handleFavoriteClick}
            disabled={isTogglingFavorite}
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              bgcolor: isFavorited ? '#ef4444' : (isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.9)'),
              '&:hover': {
                bgcolor: isFavorited ? '#dc2626' : (isDark ? 'rgba(0,0,0,0.8)' : 'white'),
                transform: 'scale(1.1)'
              }
            }}
          >
            <Heart 
              style={{ 
                fontSize: 18, 
                fill: isFavorited ? 'white' : 'none',
                color: isFavorited ? 'white' : (isDark ? '#d1d5db' : '#6b7280')
              }} 
            />
          </IconButton>
          
          {/* Status Badges */}
          {activeTab === 'volumes' && parseFloat(collection.volume) > 100 && (
            <Chip
              icon={<BarChart3 style={{ fontSize: 14 }} />}
              label="High Volume"
              size="small"
              sx={{
                position: 'absolute',
                top: 56,
                right: 12,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                fontWeight: 'bold'
              }}
            />
          )}
          
          {activeTab === 'sales' && collection.sales_count > 10 && (
            <Chip
              label="🔥 Hot Sales"
              size="small"
              sx={{
                position: 'absolute',
                top: 56,
                right: 12,
                background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
                color: 'white',
                fontWeight: 'bold'
              }}
            />
          )}
          
          {activeTab === 'mints' && collection.isActive && (
            <Chip
              icon={<Activity style={{ fontSize: 14 }} />}
              label="Live Mint"
              size="small"
              sx={{
                position: 'absolute',
                top: 56,
                right: 12,
                background: 'linear-gradient(135deg, #f97316 0%, #dc2626 100%)',
                color: 'white',
                fontWeight: 'bold'
              }}
            />
          )}
          
          {collection.activeOffers > 0 && (
            <Chip
              icon={<DollarSign style={{ fontSize: 14 }} />}
              label={`${collection.activeOffers} Offers`}
              size="small"
              sx={{
                position: 'absolute',
                bottom: 12,
                right: 12,
                background: 'linear-gradient(135deg, #facc15 0%, #f97316 100%)',
                color: '#1f2937',
                fontWeight: 'bold'
              }}
            />
          )}
        </Box>
        
        {/* CONTENT SECTION */}
        <CardContent sx={{ flexGrow: 1, p: 2.5 }}>
          {/* Collection Name */}
          <Typography 
            variant="h6" 
            component="h3" 
            noWrap 
            sx={{ 
              fontWeight: 'bold', 
              mb: 1,
              color: isDark ? '#ffffff' : '#111827'
            }}
          >
            {collection.name || `Collection ${collection.taxon}`}
          </Typography>
          
          {/* Collection Description */}
          {collection.description && (
            <Typography 
              variant="body2" 
              sx={{ 
                mb: 2,
                color: isDark ? '#9ca3af' : '#6b7280',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                lineHeight: 1.4
              }}
            >
              {collection.description}
            </Typography>
          )}
          
          {/* Mint Progress Bar */}
          {activeTab === 'mints' && collection.progress !== undefined && (
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" sx={{ color: isDark ? '#d1d5db' : '#374151' }}>
                  Mint Progress
                </Typography>
                <Typography variant="body2" fontWeight="bold">
                  {collection.mintedCount || 0} / {collection.totalSupply || 'Unknown'}
                </Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={collection.progress} 
                sx={{ height: 8, borderRadius: 1 }}
              />
            </Box>
          )}
          
          {/* Collection Stats */}
          <Box sx={{ mb: 2 }}>
            {/* Volume Tab Stats */}
            {activeTab === 'volumes' && (
              <>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Volume:</Typography>
                  <Typography variant="body2" fontWeight="bold" color="success.main">
                    {parseFloat(collection.volume || '0').toFixed(2)} XRP
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">USD:</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    ${parseFloat(collection.volume_usd || '0').toFixed(2)}
                  </Typography>
                </Box>
              </>
            )}
            
            {/* Sales Tab Stats */}
            {activeTab === 'sales' && (
              <>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">24h Sales:</Typography>
                  <Typography variant="body2" fontWeight="bold" color="primary">
                    {collection.day_traded || collection.sales24h || collection.sales_count || 0}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Volume:</Typography>
                  <Typography variant="body2" fontWeight="bold" color="success.main">
                    {parseFloat(collection.volume || '0').toFixed(2)} XRP
                  </Typography>
                </Box>
              </>
            )}
            
            {/* Mints Tab Stats */}
            {activeTab === 'mints' && (
              <>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Mint Price:</Typography>
                  <Typography variant="body2" fontWeight="bold" color="secondary">
                    {collection.mintPrice > 0 ? `${collection.mintPrice} XRP` : 'TBA'}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Status:</Typography>
                  <Typography 
                    variant="body2" 
                    fontWeight="bold"
                    color={collection.isActive ? 'success.main' : 'primary'}
                  >
                    {collection.isActive ? 'Live Minting' : 'Complete'}
                  </Typography>
                </Box>
              </>
            )}
            
            {/* Common Stats for All Tabs */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
              <Typography variant="body2">Floor:</Typography>
              <Typography variant="body2" fontWeight="bold">
                {collection.floorPrice > 0 ? `${collection.floorPrice} XRP` : 'Not Listed'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
              <Typography variant="body2">Items:</Typography>
              <Typography variant="body2" fontWeight="bold">
                {collection.totalNFTs || collection.totalSupply || collection.mintedCount || 0}
              </Typography>
            </Box>
          </Box>
          
          {/* View Collection Button */}
          <Button 
            variant="contained"
            fullWidth
            startIcon={<Eye />}
            sx={{
              background: activeTab === 'mints' && collection.isActive
                ? 'linear-gradient(to right, #f97316, #dc2626)'
                : 'linear-gradient(to right, #3b82f6, #8b5cf6)',
              fontWeight: 'bold',
              '&:hover': {
                background: activeTab === 'mints' && collection.isActive
                  ? 'linear-gradient(to right, #ea580c, #b91c1c)'
                  : 'linear-gradient(to right, #2563eb, #7c3aed)',
              }
            }}
          >
            {activeTab === 'mints' && collection.isActive ? 'Mint Now' : 'View Collection'}
          </Button>
        </CardContent>
      </Card>
    </Zoom>
  );
};

// ============================================================================
// MAIN NFT MARKETPLACE PAGE
// ============================================================================
export default function NFTMarketplacePage() {
  // Set SEO metadata
  useDynamicMetadata(GAMING_METADATA.marketplace);
  
  const [, setLocation] = useLocation();
  
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  const [collections, setCollections] = useState<any[]>([]);
  const [filteredCollections, setFilteredCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('volumes');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedPeriod, setSelectedPeriod] = useState('24h');
  const [volumeFilter, setVolumeFilter] = useState(0);
  const [selectedChain, setSelectedChain] = useState('XRPL');
  const [isDark, setIsDark] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCollections, setTotalCollections] = useState(0);
  
  // ============================================================================
  // SUPPORTED CHAINS
  // ============================================================================
  const supportedChains = [
    { name: 'XRPL', id: 'xrpl', logo: '/images/chains/xrp-logo.png', enabled: true },
    { name: 'Ethereum', id: 'eth', logo: '/images/chains/eth-logo.png', enabled: true },
    { name: 'Solana', id: 'sol', logo: '/images/chains/solana-logo.png', enabled: true }
  ];
  
  // ============================================================================
  // DARK MODE EFFECT
  // ============================================================================
  useEffect(() => {
    const savedTheme = localStorage.getItem('nft-marketplace-theme');
    if (savedTheme === 'dark') {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }
  }, []);
  
  const toggleDarkMode = () => {
    setIsDark(!isDark);
    if (!isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('nft-marketplace-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('nft-marketplace-theme', 'light');
    }
  };
  
  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================
  const getChainId = (chainName: string): string => {
    const chain = supportedChains.find(c => c.name === chainName);
    return chain?.id || 'xrpl';
  };
  
  const handleFavoriteToggle = (collection: any, isFavorited: boolean) => {
    // Remove from list if in favorites tab and item was unfavorited
    if (activeTab === 'favorites' && !isFavorited) {
      setCollections(prev => prev.filter(item => 
        !(item.issuer === collection.issuer && item.taxon === collection.taxon)
      ));
      setFilteredCollections(prev => prev.filter(item => 
        !(item.issuer === collection.issuer && item.taxon === collection.taxon)
      ));
    }
    
    // Update favorite status in collections
    setCollections(prev => prev.map(item => 
      (item.issuer === collection.issuer && item.taxon === collection.taxon)
        ? { ...item, isFavorite: isFavorited }
        : item
    ));
    setFilteredCollections(prev => prev.map(item => 
      (item.issuer === collection.issuer && item.taxon === collection.taxon)
        ? { ...item, isFavorite: isFavorited }
        : item
    ));
  };
  
  // ============================================================================
  // DATA FETCHING
  // ============================================================================
  const fetchMarketplaceData = async (page = 1, append = false) => {
    if (page === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    
    try {
      const chainId = getChainId(selectedChain);
      let endpoint = '';
      
      // Determine endpoint based on chain and tab
      if (chainId === 'xrpl') {
        const period = selectedPeriod === '7d' ? 'week' : selectedPeriod === '30d' ? 'month' : '24h';
        
        switch (activeTab) {
          case 'volumes':
            endpoint = `/api/nft-marketplace/volumes/${period}`;
            break;
          case 'sales':
            endpoint = `/api/nft-marketplace/sales/${period}`;
            break;
          case 'mints':
            endpoint = `/api/nft-marketplace/live-mints?period=${selectedPeriod}&page=${page}&limit=50`;
            break;
          case 'favorites':
            endpoint = '/api/user-favorites?chain=xrpl';
            break;
          default:
            endpoint = `/api/nft-marketplace/volumes/${period}`;
        }
      } else {
        // Multi-chain endpoints
        switch (activeTab) {
          case 'volumes':
            endpoint = `/api/nftscan/${chainId}/trending?limit=20`;
            break;
          case 'sales':
            endpoint = `/api/nftscan/${chainId}/top-sales?limit=20`;
            break;
          case 'mints':
            endpoint = `/api/nftscan/${chainId}/trending?limit=20`;
            break;
          case 'favorites':
            setLoading(false);
            setLoadingMore(false);
            setCollections([]);
            setFilteredCollections([]);
            return;
          default:
            endpoint = `/api/nftscan/${chainId}/trending?limit=20`;
        }
      }
      
      console.log(`🚀 [${activeTab.toUpperCase()}] [${selectedChain}] Fetching: ${endpoint}`);
      
      const headers: Record<string, string> = { 'Cache-Control': 'no-cache' };
      
      if (activeTab === 'favorites') {
        const sessionToken = localStorage.getItem('riddle_session_token') || sessionStorage.getItem('riddle_session_data');
        if (sessionToken) {
          headers['x-session-token'] = sessionToken;
        }
      }
      
      const response = await fetch(endpoint, { headers });
      
      let data = null;
      let paginationInfo = null;
      
      if (response.ok) {
        const result = await response.json() as any;
        
        if (activeTab === 'favorites') {
          const rawData = result.favorites || [];
          data = rawData.map((fav: any) => ({
            issuer: fav.issuer,
            taxon: fav.taxon,
            name: fav.name || `Collection ${fav.taxon}`,
            description: fav.description || '',
            image: fav.image || `/api/nft/image/${fav.issuer}:${fav.taxon}`,
            isFavorite: true
          }));
        } else {
          const rawData = result.collections || [];
          
          if (activeTab === 'mints' && result.hasMore !== undefined) {
            paginationInfo = {
              hasMore: result.hasMore,
              total: result.total,
              page: result.page
            };
          }
          
          data = rawData.filter((collection: any) => 
            collection.issuer && 
            collection.issuer !== null && 
            collection.issuer !== 'undefined' &&
            collection.taxon !== undefined &&
            collection.taxon !== null
          );
        }
      }
      
      if (data && data.length > 0) {
        if (append && page > 1) {
          setCollections(prev => [...prev, ...data]);
          setFilteredCollections(prev => [...prev, ...data]);
        } else {
          setCollections(data);
          setFilteredCollections(data);
        }
        
        if (paginationInfo) {
          setHasMore(paginationInfo.hasMore);
          setTotalCollections(paginationInfo.total);
          setCurrentPage(paginationInfo.page);
        } else {
          setHasMore(false);
          setTotalCollections(data.length);
        }
      } else {
        if (!append) {
          setCollections([]);
          setFilteredCollections([]);
        }
        setHasMore(false);
      }
      
    } catch (error) {
      console.error(`${activeTab} data fetch failed:`, error);
      if (!append) {
        setCollections([]);
        setFilteredCollections([]);
      }
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };
  
  const loadMoreCollections = () => {
    if (!loadingMore && hasMore && activeTab === 'mints') {
      fetchMarketplaceData(currentPage + 1, true);
    }
  };
  
  // ============================================================================
  // EFFECTS
  // ============================================================================
  useEffect(() => {
    setCurrentPage(1);
    setHasMore(true);
    fetchMarketplaceData(1, false);
  }, [activeTab, selectedPeriod, selectedChain]);
  
  useEffect(() => {
    const handleScroll = () => {
      if (activeTab !== 'mints' || !hasMore || loadingMore) return;
      
      const scrollTop = document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = document.documentElement.clientHeight;
      
      if (scrollTop + clientHeight >= scrollHeight - 1000) {
        loadMoreCollections();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeTab, hasMore, loadingMore, currentPage]);
  
  useEffect(() => {
    let filtered = [...collections];
    
    filtered = filtered.filter(item => 
      item && item.issuer && item.taxon !== undefined
    );
    
    if (searchQuery.trim()) {
      filtered = filtered.filter(item => 
        item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.collection?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.issuer?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    switch (activeTab) {
      case 'volumes':
        if (volumeFilter > 0) {
          filtered = filtered.filter(item => (parseFloat(item.volume) || 0) >= volumeFilter);
        }
        filtered = filtered.sort((a, b) => (parseFloat(b.volume) || 0) - (parseFloat(a.volume) || 0));
        break;
      case 'sales':
        filtered = filtered.sort((a, b) => {
          const bSalesCount = b.sales_count || b.sales24h || 0;
          const aSalesCount = a.sales_count || a.sales24h || 0;
          return bSalesCount - aSalesCount;
        });
        break;
      case 'mints':
        filtered = filtered.sort((a, b) => {
          if (a.isActive && !b.isActive) return -1;
          if (!a.isActive && b.isActive) return 1;
          const bPrice = parseFloat(b.floorPrice || b.mintPrice || b.volume || '0');
          const aPrice = parseFloat(a.floorPrice || a.mintPrice || a.volume || '0');
          return bPrice - aPrice;
        });
        break;
    }
    
    setFilteredCollections(filtered);
  }, [activeTab, collections, searchQuery, volumeFilter]);
  
  // ============================================================================
  // RENDER
  // ============================================================================
  return (
    <Box sx={{ 
      minHeight: '100vh',
      background: isDark 
        ? 'linear-gradient(to bottom right, #111827, #1f2937, #111827)'
        : 'linear-gradient(to bottom right, #eff6ff, #ffffff, #faf5ff)',
      py: { xs: 2, sm: 4 }
    }}>
      <Container maxWidth="xl">
        
        {/* ================================================================ */}
        {/* HEADER */}
        {/* ================================================================ */}
        <Box sx={{ textAlign: 'center', mb: 4, position: 'relative' }}>
          {/* Dark Mode Toggle */}
          <IconButton
            onClick={toggleDarkMode}
            sx={{
              position: 'absolute',
              right: 0,
              top: 0,
              bgcolor: isDark ? '#1f2937' : '#f3f4f6',
              color: isDark ? 'white' : '#1f2937',
              border: isDark ? '2px solid #374151' : '2px solid #e5e7eb',
              '&:hover': { 
                bgcolor: isDark ? '#374151' : 'white',
                borderColor: isDark ? '#4b5563' : '#d1d5db'
              }
            }}
          >
            {isDark ? <Sun size={20} color="white" /> : <Moon size={20} />}
          </IconButton>
          
          <Typography 
            variant="h3" 
            component="h1" 
            sx={{ 
              fontWeight: 'bold',
              mb: 2,
              background: isDark
                ? 'linear-gradient(to right, #60a5fa, #a78bfa, #f472b6)'
                : 'linear-gradient(to right, #2563eb, #7c3aed, #db2777)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent'
            }}
          >
            NFT Marketplace
          </Typography>
          
          <Typography variant="body1" sx={{ color: isDark ? '#d1d5db' : '#6b7280', mb: 3 }}>
            Discover, trade, and collect unique NFTs across multiple blockchains
          </Typography>
          
          {/* Advertising Banner */}
          <AdBanner isDark={isDark} />
        </Box>
        
        {/* ================================================================ */}
        {/* TABS */}
        {/* ================================================================ */}
        <Paper elevation={3} sx={{ mb: 4, borderRadius: 2 }}>
          <Tabs 
            value={activeTab} 
            onChange={(_, value) => setActiveTab(value)}
            variant="fullWidth"
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="📊 Volumes" value="volumes" />
            <Tab label="💰 Sales" value="sales" />
            <Tab label="🚀 Mints" value="mints" />
            <Tab label="⭐ Favorites" value="favorites" />
          </Tabs>
        </Paper>
        
        {/* ================================================================ */}
        {/* FILTERS */}
        {/* ================================================================ */}
        <Box sx={{ mb: 4, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {/* Period Filter */}
          {(activeTab === 'volumes' || activeTab === 'sales' || activeTab === 'mints') && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              {['24h', '7d', '30d'].map((period) => (
                <Button
                  key={period}
                  variant={selectedPeriod === period ? 'contained' : 'outlined'}
                  size="small"
                  onClick={() => setSelectedPeriod(period)}
                >
                  {period}
                </Button>
              ))}
            </Box>
          )}
          
          {/* Volume Filter */}
          {activeTab === 'volumes' && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              {[
                { label: 'All', min: 0 },
                { label: '10+', min: 10 },
                { label: '100+', min: 100 },
                { label: '1K+', min: 1000 }
              ].map((filter) => (
                <Button
                  key={filter.label}
                  variant={volumeFilter === filter.min ? 'contained' : 'outlined'}
                  size="small"
                  color="success"
                  onClick={() => setVolumeFilter(filter.min)}
                >
                  {filter.label}
                </Button>
              ))}
            </Box>
          )}
          
          {/* View Mode Toggle */}
          <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
            <IconButton
              color={viewMode === 'grid' ? 'primary' : 'default'}
              onClick={() => setViewMode('grid')}
            >
              <Grid size={20} />
            </IconButton>
            <IconButton
              color={viewMode === 'list' ? 'primary' : 'default'}
              onClick={() => setViewMode('list')}
            >
              <List size={20} />
            </IconButton>
          </Box>
        </Box>
        
        {/* ================================================================ */}
        {/* COLLECTIONS GRID */}
        {/* ================================================================ */}
        {loading ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 3 }}>
            {[...Array(12)].map((_, i) => (
              <Card key={i}>
                <Skeleton variant="rectangular" height={240} />
                <CardContent>
                  <Skeleton height={32} sx={{ mb: 2 }} />
                  <Skeleton height={20} sx={{ mb: 1 }} />
                  <Skeleton height={20} sx={{ mb: 1 }} />
                  <Skeleton height={40} />
                </CardContent>
              </Card>
            ))}
          </Box>
        ) : filteredCollections.length > 0 ? (
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: viewMode === 'grid' 
              ? 'repeat(auto-fill, minmax(280px, 1fr))' 
              : '1fr',
            gap: 3 
          }}>
            {filteredCollections.map((collection, index) => (
              <CollectionCard 
                key={collection.id || `${collection.issuer}-${collection.taxon}-${index}`} 
                collection={collection}
                activeTab={activeTab}
                onFavoriteToggle={handleFavoriteToggle}
                isDark={isDark}
              />
            ))}
          </Box>
        ) : (
          <Box sx={{ textAlign: 'center', py: 10 }}>
            <Typography variant="h2" sx={{ mb: 2 }}>🎨</Typography>
            <Typography variant="h5" fontWeight="bold" sx={{ mb: 2 }}>
              No Collections Found
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
              {searchQuery ? 'Try adjusting your search terms' : 'Collections are loading or temporarily unavailable'}
            </Typography>
            <Button 
              variant="contained" 
              onClick={() => fetchMarketplaceData(1, false)}
            >
              Refresh Collections
            </Button>
          </Box>
        )}
        
        {/* ================================================================ */}
        {/* INFINITE SCROLL */}
        {/* ================================================================ */}
        {loadingMore && activeTab === 'mints' && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <Typography variant="body1">Loading more collections...</Typography>
          </Box>
        )}
        
        {!loadingMore && hasMore && activeTab === 'mints' && filteredCollections.length > 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <Button variant="outlined" onClick={loadMoreCollections}>
              Load More Collections
            </Button>
          </Box>
        )}
        
        {!hasMore && activeTab === 'mints' && filteredCollections.length > 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <Typography variant="body2" color="text.secondary">
              You've reached the end {totalCollections > 0 && `(${totalCollections} total)`}
            </Typography>
          </Box>
        )}
        
      </Container>
    </Box>
  );
}
