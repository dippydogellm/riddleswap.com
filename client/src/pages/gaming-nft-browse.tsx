import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { 
  Box, 
  Container, 
  Typography, 
  TextField, 
  Select, 
  MenuItem, 
  FormControl, 
  InputLabel,
  Button,
  Grid,
  Card,
  CardMedia,
  CardContent,
  CardActions,
  Chip,
  Slider,
  Paper,
  IconButton,
  Collapse,
  Divider,
  CircularProgress,
  Alert,
  Stack,
  Pagination
} from "@mui/material";
import {
  FilterList as FilterIcon,
  Search as SearchIcon,
  Close as CloseIcon,
  Sort as SortIcon,
  Casino as RarityIcon,
  Bolt as PowerIcon,
  Person as OwnerIcon,
  Collections as CollectionIcon
} from "@mui/icons-material";
import { useSession } from "@/utils/sessionManager";
import { normalizeImagePath, getFallbackImage } from "@/utils/imageNormalizer";

interface NFTSearchFilters {
  owner?: string;
  collection?: string;
  minRarity?: number;
  maxRarity?: number;
  minPower?: number;
  maxPower?: number;
  rarityTier?: string;
  sortBy?: string;
  order?: string;
  limit?: number;
  offset?: number;
}

interface NFTResult {
  id: string;
  nft_id: string;
  token_id: string;
  name: string;
  description: string;
  image_url: string;
  owner_address: string;
  collection_id: string;
  collection_name: string;
  rarity_rank: number;
  rarity_score: string;
  rarity_tier: string;
  power_multiplier: string;
  power_percentile: string;
  is_genesis: boolean;
  traits: Record<string, any>;
  game_stats: Record<string, any>;
  overall_rarity_rank: number;
  collection_rarity_rank: number;
}

const rarityTiers = [
  { value: 'common', label: 'Common', color: '#9e9e9e' },
  { value: 'uncommon', label: 'Uncommon', color: '#4caf50' },
  { value: 'rare', label: 'Rare', color: '#2196f3' },
  { value: 'epic', label: 'Epic', color: '#9c27b0' },
  { value: 'legendary', label: 'Legendary', color: '#ff9800' }
];

export default function GamingNFTBrowse() {
  const [, navigate] = useLocation();
  const { session } = useSession();
  
  const [showFilters, setShowFilters] = useState(true);
  const [filters, setFilters] = useState<NFTSearchFilters>({
    sortBy: 'rarity',
    order: 'asc',
    limit: 24,
    offset: 0
  });
  
  const [searchInput, setSearchInput] = useState({
    owner: '',
    collection: ''
  });

  const [rarityRange, setRarityRange] = useState<[number, number]>([1, 1000]);
  const [powerRange, setPowerRange] = useState<[number, number]>([0.5, 5.0]);

  // Fetch NFTs with current filters
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/gaming/nfts/search', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          params.append(key, value.toString());
        }
      });
      
      const response = await fetch(`/api/gaming/nfts/search?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch NFTs');
      }
      return response.json();
    }
  });

  const applyFilters = () => {
    setFilters(prev => ({
      ...prev,
      owner: searchInput.owner || undefined,
      collection: searchInput.collection || undefined,
      minRarity: rarityRange[0] !== 1 ? rarityRange[0] : undefined,
      maxRarity: rarityRange[1] !== 1000 ? rarityRange[1] : undefined,
      minPower: powerRange[0] !== 0.5 ? powerRange[0] : undefined,
      maxPower: powerRange[1] !== 5.0 ? powerRange[1] : undefined,
      offset: 0 // Reset to first page
    }));
  };

  const clearFilters = () => {
    setSearchInput({ owner: '', collection: '' });
    setRarityRange([1, 1000]);
    setPowerRange([0.5, 5.0]);
    setFilters({
      sortBy: 'rarity',
      order: 'asc',
      limit: 24,
      offset: 0
    });
  };

  const handlePageChange = (event: React.ChangeEvent<unknown>, page: number) => {
    setFilters(prev => ({
      ...prev,
      offset: (page - 1) * (prev.limit || 24)
    }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const totalPages = data?.total ? Math.ceil(data.total / (filters.limit || 24)) : 0;
  const currentPage = Math.floor((filters.offset || 0) / (filters.limit || 24)) + 1;

  const getRarityColor = (tier: string) => {
    return rarityTiers.find(t => t.value === tier?.toLowerCase())?.color || '#9e9e9e';
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" gutterBottom sx={{ fontWeight: 700 }}>
          NFT Collection Browser
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Search and filter gaming NFTs by owner, collection, rarity, and power level
        </Typography>
      </Box>

      {/* Filter Panel */}
      <Paper elevation={3} sx={{ mb: 3, overflow: 'hidden' }}>
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: 'primary.main', color: 'white' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FilterIcon />
            <Typography variant="h6">Search Filters</Typography>
          </Box>
          <IconButton 
            size="small" 
            onClick={() => setShowFilters(!showFilters)}
            sx={{ color: 'white' }}
          >
            {showFilters ? <CloseIcon /> : <FilterIcon />}
          </IconButton>
        </Box>
        
        <Collapse in={showFilters}>
          <Box sx={{ p: 3 }}>
            <Grid container spacing={3}>
              {/* Owner Search */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Owner (Wallet Address or Handle)"
                  placeholder="rXXXXXXX or @username"
                  value={searchInput.owner}
                  onChange={(e) => setSearchInput(prev => ({ ...prev, owner: e.target.value }))}
                  InputProps={{
                    startAdornment: <OwnerIcon sx={{ mr: 1, color: 'text.secondary' }} />
                  }}
                />
              </Grid>

              {/* Collection Search */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Collection Name or ID"
                  placeholder="The Trolls Inquisition"
                  value={searchInput.collection}
                  onChange={(e) => setSearchInput(prev => ({ ...prev, collection: e.target.value }))}
                  InputProps={{
                    startAdornment: <CollectionIcon sx={{ mr: 1, color: 'text.secondary' }} />
                  }}
                />
              </Grid>

              {/* Rarity Tier */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Rarity Tier</InputLabel>
                  <Select
                    value={filters.rarityTier || ''}
                    onChange={(e) => setFilters(prev => ({ ...prev, rarityTier: e.target.value || undefined }))}
                    label="Rarity Tier"
                  >
                    <MenuItem value="">All Tiers</MenuItem>
                    {rarityTiers.map(tier => (
                      <MenuItem key={tier.value} value={tier.value}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: tier.color }} />
                          {tier.label}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Sort By */}
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Sort By</InputLabel>
                  <Select
                    value={filters.sortBy || 'rarity'}
                    onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value }))}
                    label="Sort By"
                  >
                    <MenuItem value="rarity">Rarity Rank</MenuItem>
                    <MenuItem value="power">Power Level</MenuItem>
                    <MenuItem value="name">Name</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Sort Order */}
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Order</InputLabel>
                  <Select
                    value={filters.order || 'asc'}
                    onChange={(e) => setFilters(prev => ({ ...prev, order: e.target.value }))}
                    label="Order"
                  >
                    <MenuItem value="asc">Ascending</MenuItem>
                    <MenuItem value="desc">Descending</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Rarity Rank Range */}
              <Grid item xs={12} md={6}>
                <Box sx={{ px: 2 }}>
                  <Typography variant="body2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <RarityIcon fontSize="small" />
                    Rarity Rank Range: {rarityRange[0]} - {rarityRange[1]}
                  </Typography>
                  <Slider
                    value={rarityRange}
                    onChange={(_, newValue) => setRarityRange(newValue as [number, number])}
                    valueLabelDisplay="auto"
                    min={1}
                    max={1000}
                    step={10}
                  />
                </Box>
              </Grid>

              {/* Power Multiplier Range */}
              <Grid item xs={12} md={6}>
                <Box sx={{ px: 2 }}>
                  <Typography variant="body2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PowerIcon fontSize="small" />
                    Power Multiplier: {powerRange[0].toFixed(1)}x - {powerRange[1].toFixed(1)}x
                  </Typography>
                  <Slider
                    value={powerRange}
                    onChange={(_, newValue) => setPowerRange(newValue as [number, number])}
                    valueLabelDisplay="auto"
                    min={0.5}
                    max={5.0}
                    step={0.1}
                  />
                </Box>
              </Grid>

              {/* Action Buttons */}
              <Grid item xs={12}>
                <Stack direction="row" spacing={2} justifyContent="flex-end">
                  <Button 
                    variant="outlined" 
                    onClick={clearFilters}
                    startIcon={<CloseIcon />}
                  >
                    Clear Filters
                  </Button>
                  <Button 
                    variant="contained" 
                    onClick={applyFilters}
                    startIcon={<SearchIcon />}
                  >
                    Apply Filters
                  </Button>
                </Stack>
              </Grid>
            </Grid>
          </Box>
        </Collapse>
      </Paper>

      {/* Results Count */}
      {data && (
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            Found {data.total} NFT{data.total !== 1 ? 's' : ''}
          </Typography>
          {data.total > (filters.limit || 24) && (
            <Pagination 
              count={totalPages} 
              page={currentPage}
              onChange={handlePageChange}
              color="primary"
              showFirstButton
              showLastButton
            />
          )}
        </Box>
      )}

      {/* Loading State */}
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress size={60} />
        </Box>
      )}

      {/* Error State */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to load NFTs. Please try again.
        </Alert>
      )}

      {/* NFT Grid */}
      {data?.nfts && data.nfts.length > 0 && (
        <Grid container spacing={3}>
          {data.nfts.map((nft: NFTResult) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={nft.id}>
              <Card 
                sx={{ 
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 6
                  }
                }}
                onClick={() => navigate(`/gaming/nft/${nft.nft_id}`)}
              >
                <CardMedia
                  component="img"
                  height="200"
                  image={normalizeImagePath(nft.image_url) || getFallbackImage()}
                  alt={nft.name}
                  sx={{ objectFit: 'cover' }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = getFallbackImage();
                  }}
                />
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="h6" gutterBottom noWrap>
                    {nft.name || `NFT #${nft.token_id}`}
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary" gutterBottom noWrap>
                    {nft.collection_name}
                  </Typography>

                  <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap', gap: 1 }}>
                    {nft.rarity_tier && (
                      <Chip 
                        label={nft.rarity_tier.toUpperCase()} 
                        size="small"
                        sx={{ 
                          bgcolor: getRarityColor(nft.rarity_tier),
                          color: 'white',
                          fontWeight: 600
                        }}
                      />
                    )}
                    {nft.is_genesis && (
                      <Chip 
                        label="GENESIS" 
                        size="small"
                        color="warning"
                      />
                    )}
                  </Stack>

                  <Divider sx={{ my: 2 }} />

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Rarity Rank
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      #{nft.collection_rarity_rank || nft.rarity_rank}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="caption" color="text.secondary">
                      Power Multiplier
                    </Typography>
                    <Typography variant="body2" fontWeight={600} color="primary">
                      {parseFloat(nft.power_multiplier).toFixed(2)}x
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Empty State */}
      {data?.nfts && data.nfts.length === 0 && (
        <Paper sx={{ p: 8, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom color="text.secondary">
            No NFTs Found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Try adjusting your search filters
          </Typography>
          <Button variant="outlined" onClick={clearFilters}>
            Clear All Filters
          </Button>
        </Paper>
      )}

      {/* Bottom Pagination */}
      {data && data.total > (filters.limit || 24) && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <Pagination 
            count={totalPages} 
            page={currentPage}
            onChange={handlePageChange}
            color="primary"
            size="large"
            showFirstButton
            showLastButton
          />
        </Box>
      )}
    </Container>
  );
}
