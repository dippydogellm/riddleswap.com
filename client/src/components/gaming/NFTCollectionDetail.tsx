import React, { useState, useMemo } from 'react';
import {
  Box,
  Container,
  Grid,
  Card,
  CardMedia,
  CardContent,
  Typography,
  Chip,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  LinearProgress,
  Skeleton,
  Alert,
  Paper,
  Tooltip,
  IconButton,
  Divider,
  Stack,
} from '@mui/material';
import {
  SportsKabaddi as SwordIcon,
  Church as ChurchIcon,
  AccountBalance as CivilizationIcon,
  AttachMoney as EconomicIcon,
  Star as StarIcon,
  TrendingUp as TrendingUpIcon,
  FilterList as FilterIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'wouter';
import { CollectionCharts } from './CollectionCharts';

interface NFT {
  id: string;
  token_id: string;
  nft_id: string;
  name: string;
  description?: string;
  image_url?: string;
  ai_generated_image_url?: string;
  traits: Record<string, any>;
  rarity_score: number;
  rarity_rank: number;
  game_stats?: {
    army_power?: number;
    religion_power?: number;
    civilization_power?: number;
    economic_power?: number;
    total_power?: number;
  };
}

interface CollectionData {
  collection: {
    id: string;
    name: string;
    collection_id: string;
    taxon: string;
    game_role: string;
    total_supply: number;
    description?: string;
    chain: string;
  };
  stats: {
    totalNfts: number;
    avgRarity: number;
    minRarity: number;
    maxRarity: number;
    rarityDistribution: {
      legendary: number;
      epic: number;
      rare: number;
      uncommon: number;
      common: number;
    };
    traitFrequency: Record<string, Record<string, number>>;
  };
  nfts: NFT[];
  floorPriceHistory: Array<{ date: string; price: number }>;
}

const NFTCollectionDetailComponent: React.FC = () => {
  const { collectionId } = useParams<{ collectionId: string }>();
  const [sortBy, setSortBy] = useState<'rarity' | 'name' | 'power'>('rarity');
  const [filterRarity, setFilterRarity] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNFT, setSelectedNFT] = useState<NFT | null>(null);

  // Fetch collection data
  const { data, isLoading, error } = useQuery<CollectionData>({
    queryKey: ['collection', collectionId],
    queryFn: async () => {
      const response = await fetch(`/api/gaming/nft/${collectionId}`);
      if (!response.ok) throw new Error('Failed to fetch collection');
      const result = await response.json();
      return result.data;
    },
  });

  // Optional: load player stats so the page can "see the player" when logged in
  const { data: playerStats } = useQuery<{ success: boolean; data: any } | null>({
    queryKey: ['gaming', 'player', 'enhanced-stats'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/gaming/player/enhanced-stats');
        if (res.status === 401) return null; // Not logged in
        if (!res.ok) throw new Error('Failed to fetch player stats');
        return await res.json();
      } catch {
        return null;
      }
    },
    retry: false,
  });

  // Filter and sort NFTs
  const filteredNFTs = useMemo(() => {
    if (!data) return [];
    
    let filtered = data.nfts;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(nft =>
        nft.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        nft.nft_id?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply rarity filter
    if (filterRarity !== 'all') {
      const totalNfts = data.stats.totalNfts;
      filtered = filtered.filter(nft => {
        const rank = nft.rarity_rank;
        switch (filterRarity) {
          case 'legendary': return rank <= totalNfts * 0.01;
          case 'epic': return rank > totalNfts * 0.01 && rank <= totalNfts * 0.05;
          case 'rare': return rank > totalNfts * 0.05 && rank <= totalNfts * 0.15;
          case 'uncommon': return rank > totalNfts * 0.15 && rank <= totalNfts * 0.50;
          case 'common': return rank > totalNfts * 0.50;
          default: return true;
        }
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rarity':
          return (a.rarity_rank || 999) - (b.rarity_rank || 999);
        case 'name':
          return (a.name || '').localeCompare(b.name || '');
        case 'power':
          const aPower = a.game_stats?.total_power || 0;
          const bPower = b.game_stats?.total_power || 0;
          return bPower - aPower;
        default:
          return 0;
      }
    });

    return filtered;
  }, [data, searchQuery, filterRarity, sortBy]);

  const getRarityColor = (rank: number, total: number): string => {
    if (rank <= total * 0.01) return '#FFD700'; // Legendary - Gold
    if (rank <= total * 0.05) return '#9C27B0'; // Epic - Purple
    if (rank <= total * 0.15) return '#2196F3'; // Rare - Blue
    if (rank <= total * 0.50) return '#4CAF50'; // Uncommon - Green
    return '#9E9E9E'; // Common - Gray
  };

  const getRarityLabel = (rank: number, total: number): string => {
    if (rank <= total * 0.01) return 'LEGENDARY';
    if (rank <= total * 0.05) return 'EPIC';
    if (rank <= total * 0.15) return 'RARE';
    if (rank <= total * 0.50) return 'UNCOMMON';
    return 'COMMON';
  };

  const calculateTotalPower = (nft: NFT): number => {
    if (!nft.game_stats) return 0;
    return (
      (nft.game_stats.army_power || 0) +
      (nft.game_stats.religion_power || 0) +
      (nft.game_stats.civilization_power || 0) +
      (nft.game_stats.economic_power || 0)
    );
  };

  if (isLoading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Grid container spacing={3}>
          {[...Array(12)].map((_, i) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={i}>
              <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 2 }} />
            </Grid>
          ))}
        </Grid>
      </Container>
    );
  }

  if (error || !data) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="error">Failed to load collection. Please try again.</Alert>
      </Container>
    );
  }

  const { collection, stats } = data;

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Player snapshot (optional, only when authenticated) */}
      {playerStats?.success && playerStats.data?.powerBreakdown && (
        <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" justifyContent="space-between">
            <Typography variant="subtitle1" fontWeight="bold">
              Your Total Power: {playerStats.data.powerBreakdown.total}
            </Typography>
            <Stack direction="row" spacing={2}>
              <Chip label={`Army ${playerStats.data.powerBreakdown.army}`} color="error" variant="outlined" />
              <Chip label={`Religion ${playerStats.data.powerBreakdown.religion}`} color="secondary" variant="outlined" />
              <Chip label={`Civ ${playerStats.data.powerBreakdown.civilization}`} color="primary" variant="outlined" />
              <Chip label={`Economic ${playerStats.data.powerBreakdown.economic}`} color="success" variant="outlined" />
            </Stack>
          </Stack>
        </Paper>
      )}
      {/* Header Section */}
      <Paper
        elevation={3}
        sx={{
          p: 4,
          mb: 4,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
        }}
      >
        <Typography variant="h3" gutterBottom fontWeight="bold">
          {collection.name}
        </Typography>
        <Typography variant="h6" sx={{ opacity: 0.9, mb: 2 }}>
          {collection.description || `Explore ${stats.totalNfts} unique NFTs`}
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={6} sm={3}>
            <Box>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>Total NFTs</Typography>
              <Typography variant="h5" fontWeight="bold">{stats.totalNfts}</Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Box>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>Avg Rarity</Typography>
              <Typography variant="h5" fontWeight="bold">{stats.avgRarity.toFixed(2)}</Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Box>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>Collection</Typography>
              <Typography variant="body1" fontWeight="bold">{collection.taxon}</Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Box>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>Chain</Typography>
              <Typography variant="body1" fontWeight="bold">{collection.chain}</Typography>
            </Box>
          </Grid>
        </Grid>

        {/* Progress Bar */}
        <Box sx={{ mt: 3 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            🎯 Collection Progress: {stats.totalNfts} / {collection.total_supply || stats.totalNfts}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={(stats.totalNfts / (collection.total_supply || stats.totalNfts)) * 100}
            sx={{
              height: 10,
              borderRadius: 5,
              backgroundColor: 'rgba(255,255,255,0.2)',
              '& .MuiLinearProgress-bar': {
                borderRadius: 5,
                backgroundColor: '#FFD700',
              },
            }}
          />
        </Box>
      </Paper>

      {/* Charts Section */}
      <Box sx={{ mb: 4 }}>
        <CollectionCharts collectionId={collectionId!} />
      </Box>

      {/* Call to Action */}
      <Paper
        elevation={2}
        sx={{
          p: 3,
          mb: 4,
          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          color: 'white',
          textAlign: 'center',
        }}
      >
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          ⚔️ Build Your Elite Army!
        </Typography>
        <Typography variant="body1" sx={{ mb: 2 }}>
          Each NFT contributes unique power to your faction. Collect rare pieces to dominate the game!
        </Typography>
        <Button
          variant="contained"
          size="large"
          sx={{
            bgcolor: 'white',
            color: '#f5576c',
            fontWeight: 'bold',
            '&:hover': { bgcolor: '#f0f0f0' },
          }}
        >
          Start Building Your Army 🚀
        </Button>
      </Paper>

      {/* Filters and Search */}
      <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="Search NFTs"
              variant="outlined"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or ID..."
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth>
              <InputLabel>Rarity Filter</InputLabel>
              <Select
                value={filterRarity}
                onChange={(e) => setFilterRarity(e.target.value)}
                label="Rarity Filter"
              >
                <MenuItem value="all">All Rarities</MenuItem>
                <MenuItem value="legendary">🏆 Legendary</MenuItem>
                <MenuItem value="epic">💜 Epic</MenuItem>
                <MenuItem value="rare">💎 Rare</MenuItem>
                <MenuItem value="uncommon">🌟 Uncommon</MenuItem>
                <MenuItem value="common">⚪ Common</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth>
              <InputLabel>Sort By</InputLabel>
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'rarity' | 'name' | 'power')}
                label="Sort By"
              >
                <MenuItem value="rarity">Rarity Rank</MenuItem>
                <MenuItem value="name">Name (A-Z)</MenuItem>
                <MenuItem value="power">Total Power</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Showing {filteredNFTs.length} of {stats.totalNfts} NFTs
        </Typography>
      </Paper>

      {/* NFT Grid */}
      <Grid container spacing={3}>
        {filteredNFTs.map((nft) => {
          const totalPower = calculateTotalPower(nft);
          const rarityColor = getRarityColor(nft.rarity_rank, stats.totalNfts);
          const rarityLabel = getRarityLabel(nft.rarity_rank, stats.totalNfts);

          return (
            <Grid item xs={12} sm={6} md={4} lg={3} key={nft.id}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                  border: `2px solid ${rarityColor}`,
                  boxShadow: `0 0 20px ${rarityColor}40`,
                  '&:hover': {
                    transform: 'translateY(-8px) scale(1.02)',
                    boxShadow: `0 8px 30px ${rarityColor}80`,
                  },
                }}
                onClick={() => setSelectedNFT(nft)}
              >
                <CardMedia
                  component="img"
                  height="240"
                  image={nft.ai_generated_image_url || nft.image_url || '/placeholder-nft.png'}
                  alt={nft.name}
                  sx={{ objectFit: 'cover' }}
                />
                <CardContent sx={{ flexGrow: 1, p: 2 }}>
                  {/* Rarity Badge */}
                  <Chip
                    label={rarityLabel}
                    size="small"
                    sx={{
                      mb: 1,
                      bgcolor: rarityColor,
                      color: 'white',
                      fontWeight: 'bold',
                      fontSize: '0.7rem',
                    }}
                  />

                  {/* Name */}
                  <Typography variant="h6" gutterBottom fontWeight="bold" noWrap>
                    {nft.name}
                  </Typography>

                  {/* Rank */}
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Rank #{nft.rarity_rank} • Score: {nft.rarity_score.toFixed(2)}
                  </Typography>

                  <Divider sx={{ my: 1 }} />

                  {/* Power Stats */}
                  {nft.game_stats && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="caption" color="text.secondary" fontWeight="bold">
                        ⚡ POWER CONTRIBUTION
                      </Typography>
                      <Stack spacing={0.5} sx={{ mt: 1 }}>
                        {nft.game_stats.army_power && (
                          <Box display="flex" alignItems="center" gap={1}>
                            <SwordIcon sx={{ fontSize: 14, color: '#f44336' }} />
                            <Typography variant="caption">
                              Army: +{nft.game_stats.army_power}
                            </Typography>
                          </Box>
                        )}
                        {nft.game_stats.religion_power && (
                          <Box display="flex" alignItems="center" gap={1}>
                            <ChurchIcon sx={{ fontSize: 14, color: '#9c27b0' }} />
                            <Typography variant="caption">
                              Religion: +{nft.game_stats.religion_power}
                            </Typography>
                          </Box>
                        )}
                        {nft.game_stats.civilization_power && (
                          <Box display="flex" alignItems="center" gap={1}>
                            <CivilizationIcon sx={{ fontSize: 14, color: '#2196f3' }} />
                            <Typography variant="caption">
                              Civilization: +{nft.game_stats.civilization_power}
                            </Typography>
                          </Box>
                        )}
                        {nft.game_stats.economic_power && (
                          <Box display="flex" alignItems="center" gap={1}>
                            <EconomicIcon sx={{ fontSize: 14, color: '#4caf50' }} />
                            <Typography variant="caption">
                              Economic: +{nft.game_stats.economic_power}
                            </Typography>
                          </Box>
                        )}
                      </Stack>

                      {totalPower > 0 && (
                        <Box
                          sx={{
                            mt: 2,
                            p: 1,
                            bgcolor: 'primary.main',
                            color: 'white',
                            borderRadius: 1,
                            textAlign: 'center',
                          }}
                        >
                          <Typography variant="body2" fontWeight="bold">
                            Total: +{totalPower} Power 🔥
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  )}

                  {/* Add to Army Button */}
                  <Button
                    fullWidth
                    variant="contained"
                    color="success"
                    sx={{ mt: 2, fontWeight: 'bold' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      // Add to army logic here
                      alert(`Added ${nft.name} to your army! 🎖️`);
                    }}
                  >
                    Add to Army ⚔️
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {filteredNFTs.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary">
            No NFTs found matching your filters
          </Typography>
        </Paper>
      )}
    </Container>
  );
};

export default NFTCollectionDetailComponent;
