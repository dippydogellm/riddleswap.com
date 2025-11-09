import React from 'react';
import { Card, CardContent, Grid, Typography, Chip, IconButton, Box } from '@mui/material';
import { ArrowBack, Image as ImageIcon } from '@mui/icons-material';
import type { NftItem } from './NftCollections';

interface WalletCollectionViewProps {
  collectionName: string;
  nfts: NftItem[];
  onBack: () => void;
  onSelectNFT: (nft: NftItem) => void;
}

export const WalletCollectionView: React.FC<WalletCollectionViewProps> = ({
  collectionName,
  nfts,
  onBack,
  onSelectNFT
}) => {
  // Calculate collection stats
  const totalValue = nfts.reduce((sum, nft) => {
    const price = parseFloat(nft.floor_price?.toString() || '0');
    return sum + (isNaN(price) ? 0 : price);
  }, 0);

  const avgValue = nfts.length > 0 ? totalValue / nfts.length : 0;

  return (
    <Box>
      {/* Header */}
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <IconButton onClick={onBack} size="small">
          <ArrowBack />
        </IconButton>
        <Box flex={1}>
          <Typography variant="h5" fontWeight={700}>
            {collectionName}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {nfts.length} NFT{nfts.length !== 1 ? 's' : ''} owned
          </Typography>
        </Box>
        <Box textAlign="right">
          <Typography variant="caption" color="text.secondary" display="block">
            Total Value
          </Typography>
          <Typography variant="h6" fontWeight={600} color="primary.main">
            {totalValue.toFixed(2)} XRP
          </Typography>
        </Box>
      </Box>

      {/* Stats */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={4}>
          <Card variant="outlined">
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Total NFTs
              </Typography>
              <Typography variant="h6" fontWeight={600}>
                {nfts.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={4}>
          <Card variant="outlined">
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Avg Value
              </Typography>
              <Typography variant="h6" fontWeight={600}>
                {avgValue.toFixed(2)} XRP
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={4}>
          <Card variant="outlined">
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Floor Price
              </Typography>
              <Typography variant="h6" fontWeight={600}>
                {nfts[0]?.floor_price ? parseFloat(nfts[0].floor_price.toString()).toFixed(2) : '0.00'} XRP
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* NFT Grid */}
      <Grid container spacing={2}>
        {nfts.map((nft) => {
          const nftId = nft.nftokenID || nft.NFTokenID || nft.nft_id || nft.tokenID;
          const image = nft.image;
          const name = nft.name || `NFT #${nftId?.slice(-6)}`;
          const value = nft.floor_price || nft.last_sale_price;

          return (
            <Grid item xs={6} sm={4} md={3} lg={2} key={nftId}>
              <Card
                sx={{
                  bgcolor: 'background.paper',
                  border: 1,
                  borderColor: 'divider',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    borderColor: 'primary.main',
                    transform: 'translateY(-4px)',
                    boxShadow: 3
                  }
                }}
                onClick={() => onSelectNFT(nft)}
              >
                <CardContent sx={{ p: 2 }}>
                  {/* Image */}
                  <Box
                    sx={{
                      position: 'relative',
                      width: '100%',
                      paddingBottom: '100%',
                      backgroundColor: '#f0f0f0',
                      borderRadius: 2,
                      overflow: 'hidden',
                      mb: 1.5
                    }}
                  >
                    {image ? (
                      <img
                        src={image}
                        alt={name}
                        style={{
                          position: 'absolute',
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <Box
                        sx={{
                          position: 'absolute',
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <ImageIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
                      </Box>
                    )}
                  </Box>

                  {/* Name */}
                  <Typography
                    variant="subtitle2"
                    fontWeight={600}
                    noWrap
                    sx={{ mb: 0.5 }}
                  >
                    {name}
                  </Typography>

                  {/* Value */}
                  {value && (
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">
                        Value
                      </Typography>
                      <Typography variant="body2" fontWeight={600} color="success.main">
                        {typeof value === 'number' ? value.toFixed(2) : value} XRP
                      </Typography>
                    </Box>
                  )}

                  {/* Rarity */}
                  {nft.rarity && (
                    <Chip
                      label={`Rank #${nft.rarity}`}
                      size="small"
                      sx={{ mt: 1, height: 20, fontSize: '0.7rem' }}
                    />
                  )}
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
};
