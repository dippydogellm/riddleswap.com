import { Box, Paper, Typography, Chip, IconButton } from '@mui/material';
import { Sparkles, RefreshCw, Settings } from 'lucide-react';

interface NewsfeedHeaderProps {
  onRefresh: () => void;
  onToggleStats: () => void;
  isLoading?: boolean;
}

export function NewsfeedHeader({ onRefresh, onToggleStats, isLoading = false }: NewsfeedHeaderProps) {
  return (
    <Paper 
      sx={{ 
        position: 'sticky', 
        top: 0, 
        zIndex: 50, 
        bgcolor: 'background.paper', 
        backdropFilter: 'blur(12px)', 
        boxShadow: 1 
      }} 
      elevation={2}
    >
      <Box 
        sx={{ 
          maxWidth: '896px', 
          mx: 'auto', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          px: 2, 
          height: 64 
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Sparkles style={{ width: 24, height: 24, color: '#3b82f6' }} />
          <Typography variant="h6" fontWeight="bold">
            Smart Feed
          </Typography>
          <Chip label="AI Powered" size="small" color="primary" variant="outlined" />
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton 
            size="small"
            onClick={onRefresh}
            disabled={isLoading}
            color="primary"
          >
            <RefreshCw className={isLoading ? 'animate-spin' : ''} style={{ width: 16, height: 16 }} />
          </IconButton>
          
          <IconButton 
            size="small"
            onClick={onToggleStats}
            color="primary"
          >
            <Settings style={{ width: 16, height: 16 }} />
          </IconButton>
        </Box>
      </Box>
    </Paper>
  );
}
