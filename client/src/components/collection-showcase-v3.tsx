import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Box, Container, Grid, Card, CardContent, CardMedia, Typography, Button, 
  Chip, Avatar, Paper, Stack, CircularProgress, IconButton
} from '@mui/material';
import { 
  OpenInNew as ExternalLink, 
  Inventory as PackageIcon, 
  AttachMoney as DollarSignIcon, 
  People as UsersIcon, 
  TrendingUp,
  ShoppingCart,
  Paid as CoinsIcon,
  Verified as VerifiedIcon,
  Collections as LayersIcon
} from '@mui/icons-material';

interface CollectionShowcaseProps {
  collectionName: string;
  collectionSlug: string;
  description: string;
  issuerAddress: string;
  taxon: number;
  xrpCafeUrl: string;
  heroImage?: string;
  themeColors?: {
    primary: string;
    secondary: string;
  };
  additionalInfo?: {
    supply?: number;
    basePower?: number;
    role?: string;
    mintingStatus?: string;
    features?: string[];
  };
}

export function CollectionShowcaseV3({
  collectionName,
  collectionSlug,
  description,
  issuerAddress,
  taxon,
  xrpCafeUrl,
  heroImage,
  themeColors = { primary: 'from-blue-600 to-purple-600', secondary: 'blue' },
  additionalInfo
}: CollectionShowcaseProps) {
  const [logoError, setLogoError] = useState(false);

  // Fetch collection stats - CORRECTED ENDPOINT
  const { data: collectionData, isLoading } = useQuery({
    queryKey: [`/api/nft-collection/${issuerAddress}/${taxon}`],
    queryFn: async () => {
      console.log(`📊 Fetching collection data from: /api/nft-collection/${issuerAddress}/${taxon}`);
      const response = await fetch(`/api/nft-collection/${issuerAddress}/${taxon}?live=true`);
      if (!response.ok) {
        console.error('Failed to fetch collection data:', response.status);
        throw new Error('Failed to fetch collection data');
      }
      const data = await response.json();
      console.log('✅ Collection data fetched:', data);
      return data;
    },
    staleTime: 60000, // 1 minute
  });

  const stats = collectionData?.collection || {};
  const nfts = collectionData?.nfts || [];

  // Get first 6 NFTs as featured
  const featured = nfts.slice(0, 6);

  const formatNumber = (num: number | undefined, decimals = 2): string => {
    if (num === undefined || num === null) return '0';
    if (num >= 1e9) return `${(num / 1e9).toFixed(decimals)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(decimals)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(decimals)}K`;
    return num.toFixed(decimals);
  };

  return (
    <Box sx={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0e27 0%, #1a1f3a 50%, #0f1419 100%)'
    }}>
      {/* Hero Section */}
      <Box sx={{ position: 'relative', overflow: 'hidden' }}>
        <Box sx={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(135deg, rgba(0, 100, 255, 0.1) 0%, rgba(150, 0, 255, 0.1) 50%, rgba(255, 0, 150, 0.1) 100%)'
        }} />
        
        <Container maxWidth="xl" sx={{ position: 'relative', py: 8 }}>
          <Grid container spacing={6} alignItems="center">
            {/* Left: Collection Image */}
            <Grid item xs={12} md={5}>
              <Box sx={{ position: 'relative' }}>
                <Box sx={{
                  position: 'absolute',
                  inset: 0,
                  bgcolor: 'rgba(0, 212, 255, 0.2)',
                  borderRadius: 6,
                  filter: 'blur(60px)',
                  transform: 'scale(0.9)'
                }} />
                <CardMedia
                  component="img"
                  image={!logoError && (heroImage || stats.image) ? (heroImage || stats.image) : 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDQwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjQwMCIgaGVpZ2h0PSI0MDAiIGZpbGw9IiMxZTI5M2IiLz48dGV4dCB4PSIyMDAiIHk9IjIxMCIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjQiIGZpbGw9IiM5Y2EzYWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiPk5GVCBDb2xsZWN0aW9uPC90ZXh0Pjwvc3ZnPg=='}
                  alt={collectionName}
                  onError={() => setLogoError(true)}
                  sx={{
                    position: 'relative',
                    width: '100%',
                    maxWidth: 400,
                    aspectRatio: '1/1',
                    borderRadius: 6,
                    objectFit: 'cover',
                    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
                    border: '4px solid rgba(255, 255, 255, 0.1)',
                    mx: 'auto',
                    display: 'block'
                  }}
                />
              </Box>
            </Grid>

            {/* Right: Collection Info */}
            <Grid item xs={12} md={7}>
              <Stack spacing={3}>
                <Box>
                  <Chip
                    icon={<VerifiedIcon />}
                    label="Verified Collection"
                    sx={{
                      mb: 2,
                      bgcolor: 'rgba(0, 255, 0, 0.2)',
                      color: '#00ff00',
                      border: '1px solid rgba(0, 255, 0, 0.3)',
                      fontWeight: 'bold'
                    }}
                  />
                  <Typography 
                    variant="h2" 
                    sx={{ 
                      fontWeight: 'bold',
                      background: `linear-gradient(135deg, #00d4ff 0%, #00ff88 100%)`,
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      mb: 2
                    }}
                  >
                    {collectionName}
                  </Typography>
                  <Typography variant="h6" sx={{ color: 'rgba(255, 255, 255, 0.8)', lineHeight: 1.6 }}>
                    {description}
                  </Typography>
                </Box>

                {/* Stats Grid */}
                <Grid container spacing={2}>
                  <Grid item xs={6} sm={3}>
                    <Card sx={{ 
                      bgcolor: 'rgba(0, 212, 255, 0.1)', 
                      border: '1px solid rgba(0, 212, 255, 0.2)',
                      backdropFilter: 'blur(10px)'
                    }}>
                      <CardContent>
                        <Box display="flex" alignItems="center" gap={1} mb={1}>
                          <PackageIcon sx={{ fontSize: 20, color: '#00d4ff' }} />
                          <Typography variant="caption" color="rgba(255, 255, 255, 0.7)">
                            Items
                          </Typography>
                        </Box>
                        <Typography variant="h5" fontWeight="bold" color="white">
                          {isLoading ? (
                            <CircularProgress size={20} sx={{ color: '#00d4ff' }} />
                          ) : (
                            formatNumber(stats.totalNFTs || additionalInfo?.supply || 0, 0)
                          )}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={6} sm={3}>
                    <Card sx={{ 
                      bgcolor: 'rgba(0, 255, 0, 0.1)', 
                      border: '1px solid rgba(0, 255, 0, 0.2)',
                      backdropFilter: 'blur(10px)'
                    }}>
                      <CardContent>
                        <Box display="flex" alignItems="center" gap={1} mb={1}>
                          <DollarSignIcon sx={{ fontSize: 20, color: '#00ff00' }} />
                          <Typography variant="caption" color="rgba(255, 255, 255, 0.7)">
                            Floor
                          </Typography>
                        </Box>
                        <Typography variant="h5" fontWeight="bold" color="white">
                          {isLoading ? (
                            <CircularProgress size={20} sx={{ color: '#00ff00' }} />
                          ) : stats.floorPrice > 0 ? (
                            `${stats.floorPrice} XRP`
                          ) : (
                            'N/A'
                          )}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={6} sm={3}>
                    <Card sx={{ 
                      bgcolor: 'rgba(150, 0, 255, 0.1)', 
                      border: '1px solid rgba(150, 0, 255, 0.2)',
                      backdropFilter: 'blur(10px)'
                    }}>
                      <CardContent>
                        <Box display="flex" alignItems="center" gap={1} mb={1}>
                          <UsersIcon sx={{ fontSize: 20, color: '#9600ff' }} />
                          <Typography variant="caption" color="rgba(255, 255, 255, 0.7)">
                            Owners
                          </Typography>
                        </Box>
                        <Typography variant="h5" fontWeight="bold" color="white">
                          {isLoading ? (
                            <CircularProgress size={20} sx={{ color: '#9600ff' }} />
                          ) : (
                            formatNumber(stats.owners || 0, 0)
                          )}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={6} sm={3}>
                    <Card sx={{ 
                      bgcolor: 'rgba(255, 215, 0, 0.1)', 
                      border: '1px solid rgba(255, 215, 0, 0.2)',
                      backdropFilter: 'blur(10px)'
                    }}>
                      <CardContent>
                        <Box display="flex" alignItems="center" gap={1} mb={1}>
                          <CoinsIcon sx={{ fontSize: 20, color: '#ffd700' }} />
                          <Typography variant="caption" color="rgba(255, 255, 255, 0.7)">
                            Volume
                          </Typography>
                        </Box>
                        <Typography variant="h5" fontWeight="bold" color="white">
                          {isLoading ? (
                            <CircularProgress size={20} sx={{ color: '#ffd700' }} />
                          ) : (
                            `${formatNumber(stats.totalVolume || 0)} XRP`
                          )}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                {/* CTA Buttons */}
                <Stack direction="row" spacing={2} flexWrap="wrap">
                  <Button 
                    size="large"
                    variant="contained"
                    startIcon={<ShoppingCart />}
                    endIcon={<ExternalLink />}
                    href={xrpCafeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{
                      bgcolor: 'linear-gradient(135deg, #00d4ff 0%, #0088ff 100%)',
                      color: 'white',
                      fontWeight: 'bold',
                      px: 4,
                      '&:hover': {
                        bgcolor: 'linear-gradient(135deg, #00b8e6 0%, #0066cc 100%)'
                      }
                    }}
                  >
                    Buy on xrp.cafe
                  </Button>
                  
                  <Button 
                    size="large"
                    variant="outlined"
                    startIcon={<LayersIcon />}
                    href={`/collections/${collectionSlug}`}
                    sx={{
                      color: '#00d4ff',
                      borderColor: 'rgba(0, 212, 255, 0.5)',
                      px: 4,
                      '&:hover': {
                        borderColor: '#00d4ff',
                        bgcolor: 'rgba(0, 212, 255, 0.1)'
                      }
                    }}
                  >
                    View Collection
                  </Button>
                </Stack>
              </Stack>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Featured NFTs Section */}
      {featured.length > 0 && (
        <Container maxWidth="xl" sx={{ py: 8 }}>
          <Typography variant="h4" fontWeight="bold" color="white" sx={{ mb: 4 }}>
            Featured NFTs
          </Typography>
          <Grid container spacing={3}>
            {featured.map((nft: any) => (
              <Grid item xs={12} sm={6} md={4} key={nft.nftokenID}>
                <Card 
                  sx={{
                    bgcolor: 'rgba(0, 212, 255, 0.05)',
                    border: '1px solid rgba(0, 212, 255, 0.2)',
                    overflow: 'hidden',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-8px)',
                      boxShadow: '0 20px 40px rgba(0, 212, 255, 0.3)',
                      borderColor: '#00d4ff'
                    }
                  }}
                >
                  <Box sx={{ position: 'relative', overflow: 'hidden' }}>
                    <CardMedia
                      component="img"
                      image={nft.image || nft.assets?.image || `https://cdn.bithomp.com/nft/${nft.nftokenID}`}
                      alt={nft.name || 'NFT'}
                      sx={{
                        height: 300,
                        objectFit: 'cover',
                        transition: 'transform 0.5s ease',
                        '&:hover': { transform: 'scale(1.1)' }
                      }}
                      onError={(e: any) => {
                        e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiMxZTI5M2IiLz48dGV4dCB4PSIxMDAiIHk9IjEwNSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5Y2EzYWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiPk5GVDwvdGV4dD48L3N2Zz4=';
                      }}
                    />
                    {nft.forSale && nft.sellPrice && (
                      <Chip
                        label={`${nft.sellPrice} XRP`}
                        sx={{
                          position: 'absolute',
                          top: 12,
                          right: 12,
                          bgcolor: 'rgba(0, 255, 0, 0.9)',
                          color: '#000',
                          fontWeight: 'bold'
                        }}
                      />
                    )}
                  </Box>
                  <CardContent>
                    <Typography 
                      variant="h6" 
                      fontWeight="bold" 
                      color="white" 
                      noWrap
                      sx={{ mb: 2 }}
                    >
                      {nft.name || `NFT #${nft.nftokenID?.slice(-4)}`}
                    </Typography>
                    <Button 
                      fullWidth
                      variant="contained"
                      endIcon={<ExternalLink />}
                      href={`${xrpCafeUrl}/${nft.nftokenID}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{
                        bgcolor: '#00d4ff',
                        color: '#000',
                        fontWeight: 'bold',
                        '&:hover': { bgcolor: '#00b8e6' }
                      }}
                    >
                      View on xrp.cafe
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      )}

      {/* About Section */}
      <Box sx={{ borderTop: '1px solid rgba(0, 212, 255, 0.2)', py: 8 }}>
        <Container maxWidth="lg">
          <Typography variant="h4" fontWeight="bold" color="white" sx={{ mb: 4 }}>
            About This Collection
          </Typography>
          <Stack spacing={4}>
            <Typography variant="body1" color="rgba(255, 255, 255, 0.8)" sx={{ lineHeight: 1.8 }}>
              {description}
            </Typography>
            
            {/* Additional Info Grid */}
            {additionalInfo && (
              <Grid container spacing={2}>
                {additionalInfo.mintingStatus && (
                  <Grid item xs={6} sm={3}>
                    <Paper sx={{ 
                      p: 2, 
                      bgcolor: 'rgba(0, 212, 255, 0.05)', 
                      border: '1px solid rgba(0, 212, 255, 0.2)' 
                    }}>
                      <Typography variant="caption" color="rgba(255, 255, 255, 0.5)" sx={{ mb: 1, display: 'block' }}>
                        Status
                      </Typography>
                      <Typography 
                        variant="body1" 
                        fontWeight="bold" 
                        color={additionalInfo.mintingStatus.includes('MINTING') ? '#00ff00' : '#00d4ff'}
                      >
                        {additionalInfo.mintingStatus}
                      </Typography>
                    </Paper>
                  </Grid>
                )}
                {additionalInfo.supply && (
                  <Grid item xs={6} sm={3}>
                    <Paper sx={{ 
                      p: 2, 
                      bgcolor: 'rgba(0, 212, 255, 0.05)', 
                      border: '1px solid rgba(0, 212, 255, 0.2)' 
                    }}>
                      <Typography variant="caption" color="rgba(255, 255, 255, 0.5)" sx={{ mb: 1, display: 'block' }}>
                        Supply
                      </Typography>
                      <Typography variant="body1" fontWeight="bold" color="white">
                        {additionalInfo.supply.toLocaleString()}
                      </Typography>
                    </Paper>
                  </Grid>
                )}
                {additionalInfo.basePower && (
                  <Grid item xs={6} sm={3}>
                    <Paper sx={{ 
                      p: 2, 
                      bgcolor: 'rgba(0, 212, 255, 0.05)', 
                      border: '1px solid rgba(0, 212, 255, 0.2)' 
                    }}>
                      <Typography variant="caption" color="rgba(255, 255, 255, 0.5)" sx={{ mb: 1, display: 'block' }}>
                        Base Power
                      </Typography>
                      <Typography variant="body1" fontWeight="bold" color="#ffd700">
                        {additionalInfo.basePower.toLocaleString()}
                      </Typography>
                    </Paper>
                  </Grid>
                )}
                {additionalInfo.role && (
                  <Grid item xs={6} sm={3}>
                    <Paper sx={{ 
                      p: 2, 
                      bgcolor: 'rgba(0, 212, 255, 0.05)', 
                      border: '1px solid rgba(0, 212, 255, 0.2)' 
                    }}>
                      <Typography variant="caption" color="rgba(255, 255, 255, 0.5)" sx={{ mb: 1, display: 'block' }}>
                        Role
                      </Typography>
                      <Typography variant="body1" fontWeight="bold" color="#9600ff">
                        {additionalInfo.role}
                      </Typography>
                    </Paper>
                  </Grid>
                )}
              </Grid>
            )}

            {/* Features List */}
            {additionalInfo?.features && additionalInfo.features.length > 0 && (
              <Box>
                <Typography variant="h5" fontWeight="bold" color="white" sx={{ mb: 3 }}>
                  Collection Features
                </Typography>
                <Grid container spacing={2}>
                  {additionalInfo.features.map((feature, index) => (
                    <Grid item xs={12} sm={6} key={index}>
                      <Box display="flex" alignItems="flex-start" gap={2}>
                        <Typography variant="h6" color="#00ff00">✓</Typography>
                        <Typography variant="body1" color="rgba(255, 255, 255, 0.8)">
                          {feature}
                        </Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}
            
            {/* Collection Details */}
            <Paper sx={{ 
              p: 3, 
              bgcolor: 'rgba(0, 212, 255, 0.05)', 
              border: '1px solid rgba(0, 212, 255, 0.2)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 4
            }}>
              <Box>
                <Typography variant="caption" color="rgba(255, 255, 255, 0.5)" sx={{ mb: 1, display: 'block' }}>
                  Issuer
                </Typography>
                <Typography variant="body2" fontFamily="monospace" color="#00d4ff">
                  {issuerAddress}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="rgba(255, 255, 255, 0.5)" sx={{ mb: 1, display: 'block' }}>
                  Taxon
                </Typography>
                <Typography variant="body2" fontFamily="monospace" color="white">
                  {taxon}
                </Typography>
              </Box>
            </Paper>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}

// Export both as default and named export for compatibility
export default CollectionShowcaseV3;
