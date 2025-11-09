import { Card, CardContent, Typography, Box, alpha } from '@mui/material';
import { TrendingUp, TrendingDown } from '@mui/icons-material';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: string;
}

export default function StatsCard({ 
  title, 
  value, 
  subtitle, 
  icon,
  trend,
  color = '#2196F3'
}: StatsCardProps) {
  return (
    <Card
      sx={{
        height: '100%',
        background: `linear-gradient(135deg, ${alpha(color, 0.1)} 0%, ${alpha(color, 0.05)} 100%)`,
        border: `1px solid ${alpha(color, 0.2)}`,
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 6,
          borderColor: color,
        },
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
            {title}
          </Typography>
          {icon && (
            <Box sx={{ color, opacity: 0.8 }}>
              {icon}
            </Box>
          )}
        </Box>
        
        <Typography variant="h4" sx={{ mb: 1, fontWeight: 700, color }}>
          {value}
        </Typography>
        
        {subtitle && (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        )}
        
        {trend && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
            {trend.isPositive ? (
              <TrendingUp sx={{ fontSize: 16, color: '#4CAF50' }} />
            ) : (
              <TrendingDown sx={{ fontSize: 16, color: '#F44336' }} />
            )}
            <Typography 
              variant="caption" 
              sx={{ 
                color: trend.isPositive ? '#4CAF50' : '#F44336',
                fontWeight: 600 
              }}
            >
              {trend.isPositive ? '+' : ''}{trend.value}%
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
