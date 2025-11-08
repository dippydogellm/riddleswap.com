import { Box, Card, CardContent, Typography, Chip, Button, Grid, CircularProgress } from '@mui/material';
import { BarChart3, Zap } from 'lucide-react';

interface AlgorithmStats {
  totalPosts: number;
  uniqueAuthors: number;
  averageAgeHours: number;
  priorityPosts: number;
  priorityAccounts: string[];
  config: any;
}

interface AlgorithmStatsProps {
  stats: AlgorithmStats | null;
  presets: any;
  isLoading: boolean;
  onApplyPreset: (presetName: string) => void;
  isApplying: boolean;
}

export function AlgorithmStatsPanel({ stats, presets, isLoading, onApplyPreset, isApplying }: AlgorithmStatsProps) {
  return (
    <Card sx={{ mb: 3 }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BarChart3 style={{ width: 20, height: 20, color: '#3b82f6' }} />
            <Typography variant="h6" fontWeight="semibold">
              Algorithm Dashboard
            </Typography>
          </Box>
          <Chip label="Admin Only" variant="outlined" size="small" />
        </Box>

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : stats ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Grid container spacing={2}>
              <Grid item xs={6} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" fontWeight="bold" color="primary.main">
                    {stats.totalPosts}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Posts
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" fontWeight="bold" color="success.main">
                    {stats.uniqueAuthors}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Authors
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" fontWeight="bold" color="warning.main">
                    {stats.averageAgeHours.toFixed(1)}h
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Avg Age
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" fontWeight="bold" color="secondary.main">
                    {stats.priorityPosts}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Priority Posts
                  </Typography>
                </Box>
              </Grid>
            </Grid>
            
            <Box>
              <Typography variant="subtitle2" fontWeight="medium" gutterBottom>
                Priority Accounts:
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {stats.priorityAccounts.map(account => (
                  <Chip 
                    key={account} 
                    label={`@${account}`}
                    icon={<Zap style={{ width: 12, height: 12 }} />}
                    size="small"
                    color="warning"
                    variant="outlined"
                  />
                ))}
              </Box>
            </Box>

            {presets && (
              <Box>
                <Typography variant="subtitle2" fontWeight="medium" gutterBottom>
                  Algorithm Presets:
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {Object.keys(presets.presets).map(presetName => (
                    <Button
                      key={presetName}
                      variant="outlined"
                      size="small"
                      onClick={() => onApplyPreset(presetName)}
                      disabled={isApplying}
                      sx={{
                        background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #eff6ff 0%, #ddd6fe 100%)',
                        },
                        fontWeight: 'medium',
                        textTransform: 'none'
                      }}
                    >
                      {presetName}
                    </Button>
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        ) : (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body2" color="text.secondary">
              Failed to load stats
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
