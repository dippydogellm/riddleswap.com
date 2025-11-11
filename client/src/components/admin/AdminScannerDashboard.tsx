import { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  LinearProgress,
  Chip,
  Stack,
  Alert,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  useTheme,
  alpha,
  CircularProgress,
} from '@mui/material';
import {
  PlayArrow,
  Stop,
  Refresh,
  Settings,
  CheckCircle,
  Error,
  Schedule,
  Speed,
  Dashboard as DashboardIcon,
} from '@mui/icons-material';

interface ScannerStatus {
  type: string;
  name: string;
  status: 'idle' | 'running' | 'error' | 'completed';
  lastRun: string | null;
  nextRun: string | null;
  itemsProcessed: number;
  totalItems: number;
  duration: number | null;
  error: string | null;
  progress: number;
}

export default function AdminScannerDashboard() {
  const theme = useTheme();
  const [scanners, setScanners] = useState<ScannerStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [configDialog, setConfigDialog] = useState<{ open: boolean; scanner: ScannerStatus | null }>({
    open: false,
    scanner: null,
  });
  const [scanInterval, setScanInterval] = useState<number>(60);

  useEffect(() => {
    fetchScannerStatus();
    
    // Auto-refresh every 5 seconds
    const refreshInterval = setInterval(() => {
      fetchScannerStatus();
    }, 5000);
    
    return () => clearInterval(refreshInterval);
  }, []);

  const fetchScannerStatus = async () => {
    try {
      const response = await fetch('/api/admin/scanners/status');
      const data = await response.json();
      
      if (data.success) {
        setScanners(data.scanners);
      }
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch scanner status:', error);
      setLoading(false);
    }
  };

  const handleStartScanner = async (type: string) => {
    try {
      const response = await fetch(`/api/admin/scanners/start/${type}`, {
        method: 'POST',
      });
      const data = await response.json();
      
      if (data.success) {
        fetchScannerStatus();
      }
    } catch (error) {
      console.error('Failed to start scanner:', error);
    }
  };

  const handleStopScanner = async (type: string) => {
    try {
      const response = await fetch(`/api/admin/scanners/stop/${type}`, {
        method: 'POST',
      });
      const data = await response.json();
      
      if (data.success) {
        fetchScannerStatus();
      }
    } catch (error) {
      console.error('Failed to stop scanner:', error);
    }
  };

  const handleRunScanner = async (type: string) => {
    try {
      const response = await fetch(`/api/admin/scanners/run/${type}`, {
        method: 'POST',
      });
      const data = await response.json();
      
      if (data.success) {
        fetchScannerStatus();
      }
    } catch (error) {
      console.error('Failed to run scanner:', error);
    }
  };

  const handleOpenConfig = (scanner: ScannerStatus) => {
    setConfigDialog({ open: true, scanner });
    // Extract interval from nextRun calculation or default
    setScanInterval(60);
  };

  const handleCloseConfig = () => {
    setConfigDialog({ open: false, scanner: null });
  };

  const handleUpdateConfig = async () => {
    if (!configDialog.scanner) return;

    try {
      const response = await fetch(`/api/admin/scanners/config/${configDialog.scanner.type}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: true,
          interval: scanInterval,
          autoStart: true,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        fetchScannerStatus();
        handleCloseConfig();
      }
    } catch (error) {
      console.error('Failed to update config:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return theme.palette.info.main;
      case 'completed':
        return theme.palette.success.main;
      case 'error':
        return theme.palette.error.main;
      default:
        return theme.palette.grey[500];
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <CircularProgress size={20} />;
      case 'completed':
        return <CheckCircle />;
      case 'error':
        return <Error />;
      default:
        return <Schedule />;
    }
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return 'N/A';
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
          <DashboardIcon sx={{ fontSize: 40, color: theme.palette.primary.main }} />
          <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
            Scanner Control Center
          </Typography>
        </Stack>
        <Typography variant="body1" color="text.secondary">
          Monitor and control all data scanners from this centralized dashboard
        </Typography>
      </Box>

      {/* Quick Stats */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.1)} 0%, ${alpha(theme.palette.success.dark, 0.1)} 100%)` }}>
            <CardContent>
              <Typography variant="h6" color="success.main" gutterBottom>
                Active Scanners
              </Typography>
              <Typography variant="h3" sx={{ fontWeight: 'bold' }}>
                {scanners.filter(s => s.status === 'running' || s.nextRun).length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ background: `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.1)} 0%, ${alpha(theme.palette.info.dark, 0.1)} 100%)` }}>
            <CardContent>
              <Typography variant="h6" color="info.main" gutterBottom>
                Running Now
              </Typography>
              <Typography variant="h3" sx={{ fontWeight: 'bold' }}>
                {scanners.filter(s => s.status === 'running').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.1)} 0%, ${alpha(theme.palette.warning.dark, 0.1)} 100%)` }}>
            <CardContent>
              <Typography variant="h6" color="warning.main" gutterBottom>
                Items Processed
              </Typography>
              <Typography variant="h3" sx={{ fontWeight: 'bold' }}>
                {scanners.reduce((acc, s) => acc + s.itemsProcessed, 0).toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ background: `linear-gradient(135deg, ${alpha(theme.palette.error.main, 0.1)} 0%, ${alpha(theme.palette.error.dark, 0.1)} 100%)` }}>
            <CardContent>
              <Typography variant="h6" color="error.main" gutterBottom>
                Errors
              </Typography>
              <Typography variant="h3" sx={{ fontWeight: 'bold' }}>
                {scanners.filter(s => s.status === 'error').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Scanner Cards */}
      <Grid container spacing={3}>
        {scanners.map((scanner) => (
          <Grid item xs={12} md={6} key={scanner.type}>
            <Card 
              sx={{ 
                height: '100%',
                borderLeft: `4px solid ${getStatusColor(scanner.status)}`,
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 6,
                }
              }}
            >
              <CardContent>
                {/* Scanner Header */}
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Box sx={{ color: getStatusColor(scanner.status) }}>
                      {getStatusIcon(scanner.status)}
                    </Box>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                        {scanner.name}
                      </Typography>
                      <Chip 
                        label={scanner.status.toUpperCase()} 
                        size="small" 
                        sx={{ 
                          bgcolor: alpha(getStatusColor(scanner.status), 0.2),
                          color: getStatusColor(scanner.status),
                          fontWeight: 'bold'
                        }}
                      />
                    </Box>
                  </Stack>

                  {/* Action Buttons */}
                  <Stack direction="row" spacing={1}>
                    <IconButton
                      size="small"
                      onClick={() => handleRunScanner(scanner.type)}
                      disabled={scanner.status === 'running'}
                      color="primary"
                      title="Run Now"
                    >
                      <Refresh />
                    </IconButton>
                    
                    {scanner.nextRun ? (
                      <IconButton
                        size="small"
                        onClick={() => handleStopScanner(scanner.type)}
                        color="error"
                        title="Stop Scheduled Runs"
                      >
                        <Stop />
                      </IconButton>
                    ) : (
                      <IconButton
                        size="small"
                        onClick={() => handleStartScanner(scanner.type)}
                        color="success"
                        title="Start Scheduled Runs"
                      >
                        <PlayArrow />
                      </IconButton>
                    )}
                    
                    <IconButton
                      size="small"
                      onClick={() => handleOpenConfig(scanner)}
                      title="Configure"
                    >
                      <Settings />
                    </IconButton>
                  </Stack>
                </Stack>

                <Divider sx={{ my: 2 }} />

                {/* Progress Bar */}
                {scanner.status === 'running' && (
                  <Box sx={{ mb: 2 }}>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        Progress
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {scanner.itemsProcessed} / {scanner.totalItems}
                      </Typography>
                    </Stack>
                    <LinearProgress 
                      variant="determinate" 
                      value={scanner.progress} 
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      {scanner.progress}% complete
                    </Typography>
                  </Box>
                )}

                {/* Scanner Stats */}
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Last Run
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {formatDate(scanner.lastRun)}
                    </Typography>
                  </Grid>

                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Next Run
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {scanner.nextRun ? formatDate(scanner.nextRun) : 'Not scheduled'}
                    </Typography>
                  </Grid>

                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Duration
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {formatDuration(scanner.duration)}
                    </Typography>
                  </Grid>

                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Items Processed
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {scanner.itemsProcessed.toLocaleString()}
                    </Typography>
                  </Grid>
                </Grid>

                {/* Error Message */}
                {scanner.error && (
                  <Alert severity="error" sx={{ mt: 2 }}>
                    {scanner.error}
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Config Dialog */}
      <Dialog open={configDialog.open} onClose={handleCloseConfig} maxWidth="sm" fullWidth>
        <DialogTitle>
          Configure {configDialog.scanner?.name}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Scan Interval (minutes)"
              type="number"
              value={scanInterval}
              onChange={(e) => setScanInterval(Number(e.target.value))}
              helperText="How often should this scanner run automatically?"
              sx={{ mb: 2 }}
            />

            <Alert severity="info">
              The scanner will run every {scanInterval} minutes when scheduled.
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseConfig}>Cancel</Button>
          <Button variant="contained" onClick={handleUpdateConfig}>
            Save Configuration
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
