// ============================================================================
// GAMING NFTS PAGE - MATERIAL UI VERSION
// ============================================================================
// Browse all gaming NFTs with power attributes and battle-ready stats
// Features: Search, Filters, Collection selector, Trait search, Pagination
// Uses Bithomp CDN images for better performance
// ============================================================================

import { useState, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';

// ============================================================================
// MATERIAL UI COMPONENTS
// ============================================================================
import {
  Box,
  Container,
  Card,
  CardContent,
  CardMedia,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Dialog,
  DialogContent,
  Chip,
  Grid,
  Paper,
  InputAdornment,
  Skeleton,
  IconButton,
  Pagination
} from '@mui/material';

// ============================================================================
// ICONS
// ============================================================================
import { 
  Search, Filter, Sword, Shield, Sparkles, Coins,
  ChevronDown, X
} from 'lucide-react';

// ============================================================================
// CUSTOM COMPONENT
// ============================================================================
import GamingNFTDetail from '@/components/GamingNFTDetail';

// ============================================================================
// INTERFACES
// ============================================================================
interface GamingNFT {
  id: string;
  nft_token_id: string;
  nft_name: string;
  collection_name: string;
  original_image_url: string;
  cdn_image_url?: string;
  battle_image_url?: string;
  current_owner?: string;
  army_power: number;
  religion_power: number;
  civilization_power: number;
  economic_power: number;
  total_power: number;
  character_class?: string;
  rarity_score?: number;
}

interface GamingNFTResponse {
  data: GamingNFT[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  sort: string;
  direction: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function GamingNFTs() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  const [searchTerm, setSearchTerm] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [collectionFilter, setCollectionFilter] = useState('all');
  const [civilizationFilter, setCivilizationFilter] = useState('all');
  const [selectedNFT, setSelectedNFT] = useState<GamingNFT | null>(null);
  const [sortBy, setSortBy] = useState<'total_power' | 'rarity_score' | 'army_power' | 'nft_name'>('total_power');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [pageNum, setPageNum] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // ============================================================================
  // FETCH GAMING NFTS
  // ============================================================================
  const { data: response, isLoading, refetch, isFetching } = useQuery<GamingNFTResponse>({
    queryKey: ['gaming-nfts', ownerFilter, collectionFilter, civilizationFilter, sortBy, sortDir, pageNum, pageSize],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (ownerFilter) params.append('owner', ownerFilter);
      if (collectionFilter !== 'all') params.append('collection', collectionFilter);
      if (civilizationFilter !== 'all') params.append('civilization', civilizationFilter);
      params.append('sort', sortBy);
      params.append('dir', sortDir);
      params.append('page', String(pageNum));
      params.append('pageSize', String(pageSize));
      
      const res = await fetch(`/api/gaming/nfts?${params}`);
      if (!res.ok) throw new Error('Failed to fetch gaming NFTs');
      return res.json();
    },
    staleTime: 30000
  });

  // ============================================================================
  // FETCH AVAILABLE COLLECTIONS
  // ============================================================================
  const { data: collections = [] } = useQuery<string[]>({
    queryKey: ['gaming-collections'],
    queryFn: async () => {
      const res = await fetch('/api/gaming/collections');
      if (!res.ok) return [];
      const data = await res.json();
      return data.collections || [];
    },
    staleTime: 60000
  });

  // ============================================================================
  // CLIENT-SIDE SEARCH FILTER
  // ============================================================================
  const filteredNFTs = useMemo(() => {
    const list = response?.data ?? [];
    const term = searchTerm.trim().toLowerCase();
    if (!term) return list;
    
    return list.filter(nft =>
      nft.nft_name?.toLowerCase().includes(term) ||
      nft.collection_name?.toLowerCase().includes(term) ||
      nft.nft_token_id?.toLowerCase().includes(term) ||
      nft.character_class?.toLowerCase().includes(term)
    );
  }, [response, searchTerm]);

  // ============================================================================
  // HANDLE PAGE CHANGE
  // ============================================================================
  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
    setPageNum(value);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ============================================================================
  // RENDER
  // ============================================================================
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', py: 4 }}>
      <Container maxWidth="xl">
        
        {/* ================================================================ */}
        {/* HEADER */}
        {/* ================================================================ */}
        <Box sx={{ mb: 4 }}>
          <Typography 
            variant="h3" 
            component="h1" 
            fontWeight="bold" 
            gutterBottom
            sx={{
              background: 'linear-gradient(to right, #a855f7, #3b82f6)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent'
            }}
          >
            Gaming NFT Collection
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              Browse all gaming NFTs with power attributes and battle-ready stats
            </Typography>
            <Chip 
              label={`${response?.total ?? 0} NFTs`} 
              color="primary" 
              sx={{ fontWeight: 'bold', fontSize: '1rem', px: 2, py: 2.5 }}
            />
          </Box>
        </Box>

        {/* ================================================================ */}
        {/* FILTERS */}
        {/* ================================================================ */}
        <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
          <Grid container spacing={2}>
            
            {/* Search */}
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                placeholder="Search by name or token ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search size={20} />
                    </InputAdornment>
                  ),
                  endAdornment: searchTerm && (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setSearchTerm('')}>
                        <X size={16} />
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
            </Grid>

            {/* Owner Filter */}
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                placeholder="Filter by owner address..."
                value={ownerFilter}
                onChange={(e) => setOwnerFilter(e.target.value)}
                InputProps={{
                  endAdornment: ownerFilter && (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setOwnerFilter('')}>
                        <X size={16} />
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
            </Grid>

            {/* Collection Filter */}
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Collection</InputLabel>
                <Select
                  value={collectionFilter}
                  label="Collection"
                  onChange={(e) => setCollectionFilter(e.target.value)}
                >
                  <MenuItem value="all">All Collections</MenuItem>
                  {collections.map((collection) => (
                    <MenuItem key={collection} value={collection}>
                      {collection}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Character Class Filter */}
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Character Class</InputLabel>
                <Select
                  value={civilizationFilter}
                  label="Character Class"
                  onChange={(e) => setCivilizationFilter(e.target.value)}
                >
                  <MenuItem value="all">All Classes</MenuItem>
                  <MenuItem value="warrior">Warrior</MenuItem>
                  <MenuItem value="priest">Priest</MenuItem>
                  <MenuItem value="knight">Knight</MenuItem>
                  <MenuItem value="merchant">Merchant</MenuItem>
                  <MenuItem value="sage">Sage</MenuItem>
                  <MenuItem value="lord">Lord</MenuItem>
                  <MenuItem value="champion">Champion</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Sort By */}
            <Grid item xs={6} md={1}>
              <FormControl fullWidth>
                <InputLabel>Sort</InputLabel>
                <Select
                  value={sortBy}
                  label="Sort"
                  onChange={(e) => setSortBy(e.target.value as any)}
                >
                  <MenuItem value="total_power">Power</MenuItem>
                  <MenuItem value="rarity_score">Rarity</MenuItem>
                  <MenuItem value="army_power">Army</MenuItem>
                  <MenuItem value="nft_name">Name</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Sort Direction */}
            <Grid item xs={6} md={1}>
              <FormControl fullWidth>
                <InputLabel>Order</InputLabel>
                <Select
                  value={sortDir}
                  label="Order"
                  onChange={(e) => setSortDir(e.target.value as any)}
                >
                  <MenuItem value="desc">Desc</MenuItem>
                  <MenuItem value="asc">Asc</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Page Size */}
            <Grid item xs={12} md={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Per Page</InputLabel>
                  <Select
                    value={String(pageSize)}
                    label="Per Page"
                    onChange={(e) => {
                      setPageSize(parseInt(e.target.value));
                      setPageNum(1);
                    }}
                  >
                    <MenuItem value="25">25</MenuItem>
                    <MenuItem value="50">50</MenuItem>
                    <MenuItem value="100">100</MenuItem>
                    <MenuItem value="150">150</MenuItem>
                  </Select>
                </FormControl>
                {isFetching && (
                  <Typography variant="body2" color="text.secondary">
                    Loading...
                  </Typography>
                )}
              </Box>
            </Grid>
          </Grid>
        </Paper>

        {/* ================================================================ */}
        {/* NFT GRID */}
        {/* ================================================================ */}
        {isLoading ? (
          <Grid container spacing={3}>
            {[...Array(12)].map((_, i) => (
              <Grid item xs={12} sm={6} md={4} lg={3} xl={2.4} key={i}>
                <Card>
                  <Skeleton variant="rectangular" height={300} />
                  <CardContent>
                    <Skeleton height={30} />
                    <Skeleton height={20} />
                    <Skeleton height={20} />
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        ) : filteredNFTs.length > 0 ? (
          <>
            <Grid container spacing={3}>
              {filteredNFTs.map((nft) => (
                <Grid item xs={12} sm={6} md={4} lg={3} xl={2.4} key={nft.id}>
                  <Card 
                    elevation={3}
                    sx={{
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-8px)',
                        boxShadow: 6
                      }
                    }}
                    onClick={() => setSelectedNFT(nft)}
                  >
                    <Box sx={{ position: 'relative' }}>
                      <CardMedia
                        component="img"
                        height="280"
                        image={nft.cdn_image_url || nft.original_image_url}
                        alt={nft.nft_name}
                        sx={{ objectFit: 'cover' }}
                        onError={(e: any) => {
                          e.target.src = '/inquisition-card.png';
                        }}
                      />
                      <Chip
                        label={nft.collection_name}
                        size="small"
                        sx={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          bgcolor: 'rgba(0,0,0,0.7)',
                          color: 'white',
                          backdropFilter: 'blur(10px)'
                        }}
                      />
                    </Box>
                    
                    <CardContent>
                      <Typography variant="h6" fontWeight="bold" noWrap gutterBottom>
                        {nft.nft_name}
                      </Typography>
                      
                      {nft.character_class && (
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          {nft.character_class}
                        </Typography>
                      )}

                      {/* Power Stats Grid */}
                      <Grid container spacing={1} sx={{ mt: 1, mb: 2 }}>
                        <Grid item xs={6}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Sword size={14} color="#ef4444" />
                            <Typography variant="body2" fontWeight="bold">
                              {Number(nft.army_power).toFixed(0)}
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={6}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Shield size={14} color="#3b82f6" />
                            <Typography variant="body2" fontWeight="bold">
                              {Number(nft.religion_power).toFixed(0)}
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={6}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Sparkles size={14} color="#a855f7" />
                            <Typography variant="body2" fontWeight="bold">
                              {Number(nft.civilization_power).toFixed(0)}
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={6}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Coins size={14} color="#eab308" />
                            <Typography variant="body2" fontWeight="bold">
                              {Number(nft.economic_power).toFixed(0)}
                            </Typography>
                          </Box>
                        </Grid>
                      </Grid>

                      {/* Total Power */}
                      <Box sx={{ 
                        pt: 2, 
                        borderTop: '1px solid', 
                        borderColor: 'divider',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <Typography variant="body2" color="text.secondary">
                          Total Power
                        </Typography>
                        <Typography 
                          variant="h6" 
                          fontWeight="bold"
                          sx={{
                            background: 'linear-gradient(to right, #a855f7, #3b82f6)',
                            backgroundClip: 'text',
                            WebkitBackgroundClip: 'text',
                            color: 'transparent'
                          }}
                        >
                          {Number(nft.total_power).toFixed(0)}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>

            {/* Pagination */}
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Pagination 
                count={response?.totalPages ?? 1} 
                page={pageNum}
                onChange={handlePageChange}
                color="primary"
                size="large"
                showFirstButton
                showLastButton
              />
            </Box>
          </>
        ) : (
          <Paper elevation={3} sx={{ p: 8, textAlign: 'center' }}>
            <Filter size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
            <Typography variant="h5" fontWeight="bold" gutterBottom>
              No NFTs found
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Try adjusting your search filters
            </Typography>
          </Paper>
        )}
      </Container>

      {/* ================================================================ */}
      {/* NFT DETAIL DIALOG */}
      {/* ================================================================ */}
      <Dialog 
        open={!!selectedNFT} 
        onClose={() => setSelectedNFT(null)}
        maxWidth="xl"
        fullWidth
        PaperProps={{
          sx: { maxHeight: '95vh' }
        }}
      >
        <DialogContent>
          {selectedNFT && (
            <GamingNFTDetail 
              nft={selectedNFT} 
              onRefresh={refetch}
              showActions={true}
            />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
