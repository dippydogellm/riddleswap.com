import { Card, CardMedia, CardContent, Typography, Box, Chip, IconButton } from '@mui/material';
import { Visibility, EmojiEvents } from '@mui/icons-material';
import { useLocation } from 'wouter';
import RarityBadge from './RarityBadge';

interface NFTCardProps {
  nftId: string;
  name: string;
  image?: string;
  collectionName: string;
  rarityTier?: string;
  rarityScore?: number;
  rank?: number;
  totalSupply?: number;
}

export default function NFTCard({ 
  nftId, 
  name, 
  image, 
  collectionName, 
  rarityTier,
  rarityScore,
  rank,
  totalSupply
}: NFTCardProps) {
  const [, setLocation] = useLocation();

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.1)',
        transition: 'all 0.3s ease',
        cursor: 'pointer',
        '&:hover': {
          transform: 'translateY(-8px)',
          boxShadow: 8,
          borderColor: 'primary.main',
        },
      }}
      onClick={() => setLocation(`/gaming/nft/${nftId}`)}
    >
      <Box sx={{ position: 'relative' }}>
        <CardMedia
          component="img"
          height="200"
          image={image || 'https://via.placeholder.com/200x200?text=NFT'}
          alt={name}
          sx={{ 
            objectFit: 'cover',
            bgcolor: 'rgba(0,0,0,0.2)',
          }}
        />
        {rarityTier && (
          <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
            <RarityBadge tier={rarityTier} size="small" />
          </Box>
        )}
        {rank && totalSupply && (
          <Chip
            icon={<EmojiEvents sx={{ fontSize: 14 }} />}
            label={`#${rank} / ${totalSupply}`}
            size="small"
            sx={{
              position: 'absolute',
              top: 8,
              left: 8,
              bgcolor: 'rgba(0,0,0,0.7)',
              color: '#FFD700',
              fontWeight: 700,
              backdropFilter: 'blur(10px)',
            }}
          />
        )}
        <IconButton
          sx={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            bgcolor: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(10px)',
            '&:hover': {
              bgcolor: 'primary.main',
            },
          }}
          size="small"
        >
          <Visibility />
        </IconButton>
      </Box>

      <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <Typography variant="h6" sx={{ mb: 0.5, fontWeight: 600 }} noWrap>
          {name}
        </Typography>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }} noWrap>
          {collectionName}
        </Typography>
        
        {rarityScore !== undefined && (
          <Box sx={{ mt: 'auto', pt: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                Rarity Score
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 700, color: 'primary.main' }}>
                {rarityScore}
              </Typography>
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
