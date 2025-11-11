import React, { useState } from 'react';
import {
  Box,
  Container,
  Grid,
  Card,
  CardMedia,
  CardContent,
  CardActions,
  Typography,
  Button,
  Chip,
  Skeleton,
  Alert,
  Paper,
  TextField,
  InputAdornment,
  Stack,
  Divider,
  Avatar,
  LinearProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Search as SearchIcon,
  Explore as ExploreIcon,
  TrendingUp as TrendingUpIcon,
  Star as StarIcon,
  Gavel as GavelIcon,
  AccountBalanceWallet as WalletIcon,
  Rocket as RocketIcon,
  EmojiEvents as TrophyIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';

interface Collection {
  id: string;
  name: string;
  collection_id: string;
  taxon: string;
  game_role: string;
  total_supply: number;
  description?: string;
  chain: string;
  nft_count: number;
  total_nfts_scanned?: number;
  avg_nft_power?: number;
}

interface CollectionsData {
  collections: Collection[];
  total: number;
}

const AllCollectionsComponent: React.FC = () => {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading, error } = useQuery<CollectionsData>({
    queryKey: ['allCollections'],
    queryFn: async () => {
      const response = await fetch('/api/gaming/collections/all');
      if (!response.ok) throw new Error('Failed to fetch collections');
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

  const filteredCollections = React.useMemo(() => {
    if (!data) return [];
    
    if (!searchQuery) return data.collections;
    
    const query = searchQuery.toLowerCase();
    return data.collections.filter(col =>
      col.name.toLowerCase().includes(query) ||
      col.game_role?.toLowerCase().includes(query) ||
      col.description?.toLowerCase().includes(query)
    );
  }, [data, searchQuery]);

  // Get featured collections (top 3 by supply)
  const featuredCollections = React.useMemo(() => {
    if (!data) return [];
    return [...data.collections]
      .sort((a, b) => b.total_supply - a.total_supply)
      .slice(0, 3);
  }, [data]);

  const getGameRoleColor = (role: string): string => {
    const roleLower = role?.toLowerCase() || '';
    if (roleLower.includes('army') || roleLower.includes('warrior')) return '#f44336';
    if (roleLower.includes('religion') || roleLower.includes('priest')) return '#9c27b0';
    if (roleLower.includes('civilization') || roleLower.includes('builder')) return '#2196f3';
    if (roleLower.includes('economic') || roleLower.includes('trader')) return '#4caf50';
    return '#ff9800';
  };

  const getGameRoleIcon = (role: string) => {
    const roleLower = role?.toLowerCase() || '';
    if (roleLower.includes('army')) return '⚔️';
    if (roleLower.includes('religion')) return '⛪';
    if (roleLower.includes('civilization')) return '🏛️';
    if (roleLower.includes('economic')) return '💰';
    return '🎮';
  };

  if (isLoading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2, mb: 4 }} />
        <Grid container spacing={3}>
          {[...Array(9)].map((_, i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Skeleton variant="rectangular" height={350} sx={{ borderRadius: 2 }} />
            </Grid>
          ))}
        </Grid>
      </Container>
    );
  }

  if (error || !data) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="error">Failed to load collections. Please try again.</Alert>
      </Container>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      {/* Hero Section */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          py: 8,
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.05\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
          },
        }}
      >
        <Container maxWidth="xl" sx={{ position: 'relative', zIndex: 1 }}>
          <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
            <TrophyIcon sx={{ fontSize: 60 }} />
            <Typography variant="h2" fontWeight="bold">
              NFT Collections
            </Typography>
          </Stack>
          <Typography variant="h5" sx={{ mb: 4, opacity: 0.95 }}>
            Discover {data.total} epic collections. Build your army. Dominate the game! 🎯
          </Typography>

          {/* Stats Bar */}
          <Grid container spacing={3}>
            <Grid item xs={6} sm={3}>
              <Paper
                elevation={4}
                sx={{
                  p: 2,
                  textAlign: 'center',
                  bgcolor: 'rgba(255,255,255,0.15)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.2)',
                }}
              >
                <Typography variant="h4" fontWeight="bold">
                  {data.total}
                </Typography>
                <Typography variant="caption">Collections</Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Paper
                elevation={4}
                sx={{
                  p: 2,
                  textAlign: 'center',
                  bgcolor: 'rgba(255,255,255,0.15)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.2)',
                }}
              >
                <Typography variant="h4" fontWeight="bold">
                  {data.collections.reduce((sum, col) => sum + col.nft_count, 0).toLocaleString()}
                </Typography>
                <Typography variant="caption">Total NFTs</Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Paper
                elevation={4}
                sx={{
                  p: 2,
                  textAlign: 'center',
                  bgcolor: 'rgba(255,255,255,0.15)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.2)',
                }}
              >
                <Typography variant="h4" fontWeight="bold">
                  XRPL
                </Typography>
                <Typography variant="caption">Blockchain</Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Paper
                elevation={4}
                sx={{
                  p: 2,
                  textAlign: 'center',
                  bgcolor: 'rgba(255,255,255,0.15)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.2)',
                }}
              >
                <Typography variant="h4" fontWeight="bold">
                  🔥
                </Typography>
                <Typography variant="caption">Active Game</Typography>
              </Paper>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Container maxWidth="xl" sx={{ py: 4 }}>
        {/* Player snapshot (optional, only when authenticated) */}
        {playerStats?.success && playerStats.data?.powerBreakdown && (
          <Paper elevation={2} sx={{ p: 2, mb: 4 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" justifyContent="space-between">
              <Stack direction="row" spacing={2} alignItems="center">
                <Avatar sx={{ bgcolor: '#3f51b5' }}>🧑‍✈️</Avatar>
                <Box>
                  <Typography variant="subtitle1" fontWeight="bold">
                    Your Power Overview
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Army: {playerStats.data.powerBreakdown.army} · Religion: {playerStats.data.powerBreakdown.religion} · Civ: {playerStats.data.powerBreakdown.civilization} · Economic: {playerStats.data.powerBreakdown.economic}
                  </Typography>
                </Box>
              </Stack>
              <Button variant="contained" onClick={() => setLocation('/gaming/dashboard')}>Open Gaming Dashboard</Button>
            </Stack>
          </Paper>
        )}
        {/* Featured Collections */}
        {featuredCollections.length > 0 && (
          <Box sx={{ mb: 6 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
              <StarIcon sx={{ color: '#FFD700', fontSize: 32 }} />
              <Typography variant="h4" fontWeight="bold">
                Featured Collections
              </Typography>
            </Stack>
            <Grid container spacing={3}>
              {featuredCollections.map((collection) => (
                <Grid item xs={12} md={4} key={collection.id}>
                  <Card
                    sx={{
                      height: '100%',
                      position: 'relative',
                      overflow: 'visible',
                      transition: 'all 0.3s ease',
                      border: '3px solid',
                      borderColor: getGameRoleColor(collection.game_role),
                      boxShadow: `0 8px 30px ${getGameRoleColor(collection.game_role)}40`,
                      '&:hover': {
                        transform: 'translateY(-12px) scale(1.02)',
                        boxShadow: `0 12px 40px ${getGameRoleColor(collection.game_role)}60`,
                      },
                    }}
                  >
                    {/* Featured Badge */}
                    <Chip
                      icon={<StarIcon />}
                      label="FEATURED"
                      sx={{
                        position: 'absolute',
                        top: 16,
                        right: 16,
                        bgcolor: '#FFD700',
                        color: '#000',
                        fontWeight: 'bold',
                        zIndex: 10,
                      }}
                    />

                    <CardContent sx={{ p: 3 }}>
                      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
                        <Avatar
                          sx={{
                            width: 64,
                            height: 64,
                            bgcolor: getGameRoleColor(collection.game_role),
                            fontSize: 32,
                          }}
                        >
                          {getGameRoleIcon(collection.game_role)}
                        </Avatar>
                        <Box flex={1}>
                          <Typography variant="h5" fontWeight="bold" gutterBottom>
                            {collection.name}
                          </Typography>
                          <Chip
                            label={collection.game_role || 'General'}
                            size="small"
                            sx={{
                              bgcolor: getGameRoleColor(collection.game_role),
                              color: 'white',
                              fontWeight: 'bold',
                            }}
                          />
                        </Box>
                      </Stack>

                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, minHeight: 40 }}>
                        {collection.description || `An epic collection of ${collection.nft_count} unique NFTs ready for battle!`}
                      </Typography>

                      <Divider sx={{ my: 2 }} />

                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">
                            Total Supply
                          </Typography>
                          <Typography variant="h6" fontWeight="bold">
                            {collection.total_supply.toLocaleString()}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">
                            NFTs Found
                          </Typography>
                          <Typography variant="h6" fontWeight="bold">
                            {collection.nft_count.toLocaleString()}
                          </Typography>
                        </Grid>
                      </Grid>

                      {/* Progress Bar */}
                      <Box sx={{ mt: 2 }}>
                        <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">
                            Scanned Progress
                          </Typography>
                          <Typography variant="caption" fontWeight="bold">
                            {((collection.nft_count / collection.total_supply) * 100).toFixed(1)}%
                          </Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={(collection.nft_count / collection.total_supply) * 100}
                          sx={{
                            height: 8,
                            borderRadius: 4,
                            bgcolor: 'rgba(0,0,0,0.1)',
                            '& .MuiLinearProgress-bar': {
                              bgcolor: getGameRoleColor(collection.game_role),
                              borderRadius: 4,
                            },
                          }}
                        />
                      </Box>

                      {collection.avg_nft_power && (
                        <Paper
                          elevation={0}
                          sx={{
                            mt: 2,
                            p: 1.5,
                            bgcolor: `${getGameRoleColor(collection.game_role)}15`,
                            border: `1px solid ${getGameRoleColor(collection.game_role)}`,
                            textAlign: 'center',
                          }}
                        >
                          <Typography variant="body2" fontWeight="bold" color={getGameRoleColor(collection.game_role)}>
                            ⚡ Avg Power: {parseFloat(String(collection.avg_nft_power)).toFixed(0)}
                          </Typography>
                        </Paper>
                      )}
                    </CardContent>

                    <CardActions sx={{ p: 3, pt: 0 }}>
                      <Button
                        fullWidth
                        variant="contained"
                        size="large"
                        endIcon={<RocketIcon />}
                          onClick={() => setLocation(`/gaming/nft/${collection.id}`)}
                        sx={{
                          bgcolor: getGameRoleColor(collection.game_role),
                          fontWeight: 'bold',
                          fontSize: '1rem',
                          py: 1.5,
                          '&:hover': {
                            bgcolor: getGameRoleColor(collection.game_role),
                            filter: 'brightness(1.1)',
                          },
                        }}
                      >
                        Explore Collection
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {/* Search Bar */}
        <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Search collections by name, role, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                fontSize: '1.1rem',
              },
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Showing {filteredCollections.length} of {data.total} collections
          </Typography>
        </Paper>

        {/* All Collections Grid */}
        <Box sx={{ mb: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
            <ExploreIcon sx={{ color: '#2196f3', fontSize: 32 }} />
            <Typography variant="h4" fontWeight="bold">
              All Collections
            </Typography>
          </Stack>
        </Box>

        <Grid container spacing={3}>
          {filteredCollections.map((collection) => (
            <Grid item xs={12} sm={6} md={4} key={collection.id}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                  border: '2px solid',
                  borderColor: 'transparent',
                  '&:hover': {
                    transform: 'translateY(-8px)',
                    borderColor: getGameRoleColor(collection.game_role),
                    boxShadow: `0 12px 30px ${getGameRoleColor(collection.game_role)}40`,
                  },
                }}
                onClick={() => setLocation(`/gaming/nft/${collection.id}`)}
              >
                <CardContent sx={{ flexGrow: 1, p: 3 }}>
                  <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
                    <Avatar
                      sx={{
                        width: 48,
                        height: 48,
                        bgcolor: getGameRoleColor(collection.game_role),
                        fontSize: 24,
                      }}
                    >
                      {getGameRoleIcon(collection.game_role)}
                    </Avatar>
                    <Box flex={1}>
                      <Typography variant="h6" fontWeight="bold" gutterBottom>
                        {collection.name}
                      </Typography>
                      <Chip
                        label={collection.game_role || 'General'}
                        size="small"
                        sx={{
                          bgcolor: getGameRoleColor(collection.game_role),
                          color: 'white',
                          fontSize: '0.7rem',
                        }}
                      />
                    </Box>
                  </Stack>

                  <Grid container spacing={1} sx={{ mb: 2 }}>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">
                        Supply
                      </Typography>
                      <Typography variant="body1" fontWeight="bold">
                        {collection.total_supply.toLocaleString()}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">
                        NFTs
                      </Typography>
                      <Typography variant="body1" fontWeight="bold">
                        {collection.nft_count.toLocaleString()}
                      </Typography>
                    </Grid>
                  </Grid>

                  <LinearProgress
                    variant="determinate"
                    value={Math.min((collection.nft_count / collection.total_supply) * 100, 100)}
                    sx={{
                      height: 6,
                      borderRadius: 3,
                      bgcolor: 'rgba(0,0,0,0.1)',
                      '& .MuiLinearProgress-bar': {
                        bgcolor: getGameRoleColor(collection.game_role),
                        borderRadius: 3,
                      },
                    }}
                  />

                  <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                    <Chip
                      icon={<WalletIcon />}
                      label={collection.chain.toUpperCase()}
                      size="small"
                      variant="outlined"
                    />
                    {collection.avg_nft_power && (
                      <Chip
                        label={`⚡ ${parseFloat(String(collection.avg_nft_power)).toFixed(0)}`}
                        size="small"
                        sx={{
                          bgcolor: `${getGameRoleColor(collection.game_role)}15`,
                          color: getGameRoleColor(collection.game_role),
                          fontWeight: 'bold',
                        }}
                      />
                    )}
                  </Stack>
                </CardContent>

                <CardActions sx={{ p: 2, pt: 0 }}>
                  <Button
                    fullWidth
                    variant="contained"
                    endIcon={<ExploreIcon />}
                    sx={{
                      bgcolor: getGameRoleColor(collection.game_role),
                      fontWeight: 'bold',
                      '&:hover': {
                        bgcolor: getGameRoleColor(collection.game_role),
                        filter: 'brightness(1.1)',
                      },
                    }}
                  >
                    View Collection
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>

        {filteredCollections.length === 0 && (
          <Paper sx={{ p: 6, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No collections found matching "{searchQuery}"
            </Typography>
            <Button
              variant="contained"
              onClick={() => setSearchQuery('')}
              sx={{ mt: 2 }}
            >
              Clear Search
            </Button>
          </Paper>
        )}

        {/* Call to Action */}
        <Paper
          elevation={4}
          sx={{
            mt: 6,
            p: 4,
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            color: 'white',
            textAlign: 'center',
          }}
        >
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Ready to Build Your Army? ⚔️
          </Typography>
          <Typography variant="h6" sx={{ mb: 3, opacity: 0.95 }}>
            Collect NFTs from these epic collections and dominate the battlefield!
          </Typography>
          <Button
            variant="contained"
            size="large"
            endIcon={<TrophyIcon />}
            sx={{
              bgcolor: 'white',
              color: '#f5576c',
              fontWeight: 'bold',
              fontSize: '1.1rem',
              px: 4,
              py: 1.5,
              '&:hover': {
                bgcolor: '#f0f0f0',
              },
            }}
            onClick={() => {
              // Navigate to game dashboard or signup
              setLocation('/gaming/dashboard');
            }}
          >
            Start Playing Now
          </Button>
        </Paper>
      </Container>
    </Box>
  );
};

export default AllCollectionsComponent;
