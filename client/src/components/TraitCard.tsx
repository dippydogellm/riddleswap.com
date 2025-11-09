import { Card, CardContent, Typography, Box, Chip } from '@mui/material';
import { AutoAwesome } from '@mui/icons-material';

interface TraitCardProps {
  traitType: string;
  traitValue: string;
  rarityScore?: number;
  percentage?: number;
  count?: number;
  total?: number;
}

export default function TraitCard({ 
  traitType, 
  traitValue, 
  rarityScore, 
  percentage,
  count,
  total 
}: TraitCardProps) {
  const getRarityColor = (score?: number) => {
    if (!score) return '#9E9E9E';
    if (score >= 95) return '#FFD700';
    if (score >= 85) return '#9C27B0';
    if (score >= 70) return '#2196F3';
    if (score >= 50) return '#4CAF50';
    return '#9E9E9E';
  };

  return (
    <Card 
      sx={{ 
        height: '100%',
        background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.1)',
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 6,
          borderColor: getRarityColor(rarityScore),
        },
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
            {traitType}
          </Typography>
          {rarityScore && (
            <Chip
              icon={<AutoAwesome sx={{ fontSize: 14 }} />}
              label={rarityScore}
              size="small"
              sx={{
                height: 20,
                fontSize: '0.7rem',
                fontWeight: 700,
                bgcolor: `${getRarityColor(rarityScore)}20`,
                color: getRarityColor(rarityScore),
                border: `1px solid ${getRarityColor(rarityScore)}`,
              }}
            />
          )}
        </Box>
        
        <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
          {traitValue}
        </Typography>
        
        {percentage !== undefined && (
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Typography variant="body2" color="text.secondary">
              <strong>{percentage.toFixed(2)}%</strong> have this
            </Typography>
            {count !== undefined && total !== undefined && (
              <Typography variant="body2" color="text.secondary">
                {count} / {total}
              </Typography>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
