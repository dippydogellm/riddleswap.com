import { useState, useEffect } from 'react';
import { useParams, useLocation, Link as WouterLink } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Avatar,
  IconButton,
  Paper,
  Divider,
  Stack,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  Tooltip
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  ContentCopy as CopyIcon,
  OpenInNew as ExternalLinkIcon,
  Refresh as RefreshIcon,
  BarChart as ChartIcon,
  SwapHoriz as SwapIcon,
  AccountBalance as PoolIcon,
  People as HoldersIcon,
  AttachMoney as MoneyIcon,
  ShowChart as VolumeIcon,
  LocalFireDepartment as FireIcon
} from '@mui/icons-material';
import SwapHubV3 from '@/components/swap-v3/SwapHub';
import DexScreenerIframe from '@/components/dexscreener-iframe';

interface TokenData {
  success: boolean;
  symbol: string;
  issuer: string;
  data?: {
    name?: string;
    logoUrl?: string;
    priceUsd: number;
    priceChange: {
      m5: number;
      h1: number;
      h24: number;
    };
    volume: {
      h24: number;
      h6: number;
      h1: number;
      m5: number;
    };
    liquidity?: {
      usd: number;
      base: number;
      quote: number;
    };
    txns: {
      m5: number;
      h1: number;
      h6: number;
      h24: number;
    };
    fdv?: number;
    marketCap?: number;
    holders?: number;
    totalTrades?: number;
    pairUrl?: string;
  };
  error?: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export default function TokenPageV3() {
  const { symbol, issuer } = useParams<{ symbol: string; issuer: string }>();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState(0);
  const [logoError, setLogoError] = useState(false);

  // Fetch token analytics data
  const { data: tokenData, isLoading, error, refetch } = useQuery<TokenData>({
    queryKey: [`/api/xrpl/analytics/${symbol}/${issuer}`],
    enabled: !!symbol && !!issuer,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const handleCopyAddress = () => {
    if (issuer) {
      navigator.clipboard.writeText(issuer);
      // Could add a toast notification here
    }
  };

  const formatNumber = (num: number | undefined, decimals = 2): string => {
    if (num === undefined || num === null) return '—';
    if (num >= 1e9) return `$${(num / 1e9).toFixed(decimals)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(decimals)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(decimals)}K`;
    return `$${num.toFixed(decimals)}`;
  };

  const formatPercent = (num: number | undefined): string => {
    if (num === undefined || num === null) return '—';
    return `${num > 0 ? '+' : ''}${num.toFixed(2)}%`;
  };

  if (isLoading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #0a0e27 0%, #1a1f3a 50%, #0f1419 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 2,
        }}
      >
        <Card sx={{ maxWidth: 400, width: '100%', textAlign: 'center', bgcolor: 'rgba(255, 255, 255, 0.05)' }}>
          <CardContent sx={{ p: 4 }}>
            <CircularProgress size={60} sx={{ color: '#00d4ff', mb: 3 }} />
            <Typography variant="h6" sx={{ color: 'white' }}>
              Loading Token Data...
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  if (error || !tokenData?.success) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #0a0e27 0%, #1a1f3a 50%, #0f1419 100%)',
          p: 3,
        }}
      >
        <Container maxWidth="lg">
          <WouterLink href="/tokens">
            <Button startIcon={<ArrowBackIcon />} sx={{ color: 'white', mb: 2 }}>
              Back to Tokens
            </Button>
          </WouterLink>
          <Alert severity="error" sx={{ mt: 2 }}>
            {tokenData?.error || 'Failed to load token data'}
          </Alert>
        </Container>
      </Box>
    );
  }

  const token = tokenData.data!;
  const priceChange24h = token.priceChange.h24;
  const isPositive = priceChange24h >= 0;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0a0e27 0%, #1a1f3a 50%, #0f1419 100%)',
        color: 'white',
        pb: 6,
      }}
    >
      <Container maxWidth="xl" sx={{ pt: 3 }}>
        {/* Back Button */}
        <WouterLink href="/tokens">
          <Button
            startIcon={<ArrowBackIcon />}
            sx={{
              color: 'white',
              mb: 2,
              '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' },
            }}
          >
            Back to Tokens
          </Button>
        </WouterLink>

        {/* Token Header */}
        <Paper
          sx={{
            bgcolor: 'rgba(0, 212, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(0, 212, 255, 0.2)',
            borderRadius: 2,
            p: 3,
            mb: 3,
          }}
        >
          <Grid container spacing={3} alignItems="center">
            <Grid item>
              <Avatar
                src={!logoError ? token.logoUrl : undefined}
                alt={symbol}
                onError={() => setLogoError(true)}
                sx={{
                  width: 80,
                  height: 80,
                  bgcolor: 'rgba(0, 212, 255, 0.2)',
                  fontSize: '2rem',
                }}
              >
                {symbol?.charAt(0) || '?'}
              </Avatar>
            </Grid>
            <Grid item xs>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Typography variant="h3" sx={{ fontWeight: 'bold' }}>
                  {token.name || symbol}
                </Typography>
                <Chip
                  label={symbol}
                  sx={{
                    bgcolor: 'rgba(0, 212, 255, 0.2)',
                    color: '#00d4ff',
                    fontWeight: 'bold',
                  }}
                />
              </Stack>
              
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1 }}>
                <Typography variant="body2" color="rgba(255, 255, 255, 0.7)">
                  {issuer?.slice(0, 8)}...{issuer?.slice(-6)}
                </Typography>
                <IconButton size="small" onClick={handleCopyAddress} sx={{ color: '#00d4ff' }}>
                  <CopyIcon fontSize="small" />
                </IconButton>
                {token.pairUrl && (
                  <IconButton
                    size="small"
                    component="a"
                    href={token.pairUrl}
                    target="_blank"
                    sx={{ color: '#00d4ff' }}
                  >
                    <ExternalLinkIcon fontSize="small" />
                  </IconButton>
                )}
              </Stack>

              <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#00d4ff' }}>
                    ${token.priceUsd.toFixed(6)}
                  </Typography>
                </Box>
                <Chip
                  icon={isPositive ? <TrendingUpIcon /> : <TrendingDownIcon />}
                  label={formatPercent(priceChange24h)}
                  sx={{
                    bgcolor: isPositive ? 'rgba(0, 255, 0, 0.1)' : 'rgba(255, 0, 0, 0.1)',
                    color: isPositive ? '#00ff00' : '#ff0000',
                    fontWeight: 'bold',
                  }}
                />
              </Stack>
            </Grid>
            <Grid item>
              <Stack spacing={1} direction="row">
                <Button
                  variant="contained"
                  startIcon={<RefreshIcon />}
                  onClick={() => refetch()}
                  sx={{
                    bgcolor: 'rgba(0, 212, 255, 0.2)',
                    color: '#00d4ff',
                    '&:hover': { bgcolor: 'rgba(0, 212, 255, 0.3)' },
                  }}
                >
                  Refresh
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </Paper>

        {/* Stats Grid */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card
              sx={{
                bgcolor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(0, 212, 255, 0.2)',
              }}
            >
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                  <VolumeIcon sx={{ color: '#00d4ff' }} />
                  <Typography variant="body2" color="rgba(255, 255, 255, 0.7)">
                    24h Volume
                  </Typography>
                </Stack>
                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                  {formatNumber(token.volume.h24)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card
              sx={{
                bgcolor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(0, 212, 255, 0.2)',
              }}
            >
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                  <PoolIcon sx={{ color: '#00d4ff' }} />
                  <Typography variant="body2" color="rgba(255, 255, 255, 0.7)">
                    Liquidity
                  </Typography>
                </Stack>
                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                  {formatNumber(token.liquidity?.usd)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card
              sx={{
                bgcolor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(0, 212, 255, 0.2)',
              }}
            >
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                  <MoneyIcon sx={{ color: '#00d4ff' }} />
                  <Typography variant="body2" color="rgba(255, 255, 255, 0.7)">
                    Market Cap
                  </Typography>
                </Stack>
                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                  {formatNumber(token.marketCap)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card
              sx={{
                bgcolor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(0, 212, 255, 0.2)',
              }}
            >
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                  <HoldersIcon sx={{ color: '#00d4ff' }} />
                  <Typography variant="body2" color="rgba(255, 255, 255, 0.7)">
                    Holders
                  </Typography>
                </Stack>
                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                  {token.holders?.toLocaleString() || '—'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Price Changes */}
        <Paper
          sx={{
            bgcolor: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(0, 212, 255, 0.2)',
            borderRadius: 2,
            p: 2,
            mb: 3,
          }}
        >
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
            Price Changes
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6} sm={3}>
              <Typography variant="body2" color="rgba(255, 255, 255, 0.7)">
                5m
              </Typography>
              <Typography
                variant="h6"
                sx={{
                  color: token.priceChange.m5 >= 0 ? '#00ff00' : '#ff0000',
                  fontWeight: 'bold',
                }}
              >
                {formatPercent(token.priceChange.m5)}
              </Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="body2" color="rgba(255, 255, 255, 0.7)">
                1h
              </Typography>
              <Typography
                variant="h6"
                sx={{
                  color: token.priceChange.h1 >= 0 ? '#00ff00' : '#ff0000',
                  fontWeight: 'bold',
                }}
              >
                {formatPercent(token.priceChange.h1)}
              </Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="body2" color="rgba(255, 255, 255, 0.7)">
                6h
              </Typography>
              <Typography
                variant="h6"
                sx={{
                  color: token.priceChange.h1 >= 0 ? '#00ff00' : '#ff0000',
                  fontWeight: 'bold',
                }}
              >
                {formatPercent(token.priceChange.h1)}
              </Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="body2" color="rgba(255, 255, 255, 0.7)">
                24h
              </Typography>
              <Typography
                variant="h6"
                sx={{
                  color: token.priceChange.h24 >= 0 ? '#00ff00' : '#ff0000',
                  fontWeight: 'bold',
                }}
              >
                {formatPercent(token.priceChange.h24)}
              </Typography>
            </Grid>
          </Grid>
        </Paper>

        {/* Main Content Tabs */}
        <Paper
          sx={{
            bgcolor: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(0, 212, 255, 0.2)',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            sx={{
              borderBottom: '1px solid rgba(0, 212, 255, 0.2)',
              '& .MuiTab-root': { color: 'rgba(255, 255, 255, 0.7)' },
              '& .Mui-selected': { color: '#00d4ff' },
            }}
          >
            <Tab icon={<SwapIcon />} label="Trade" iconPosition="start" />
            <Tab icon={<ChartIcon />} label="Chart" iconPosition="start" />
            <Tab icon={<FireIcon />} label="Activity" iconPosition="start" />
          </Tabs>

          <TabPanel value={activeTab} index={0}>
            {/* V3 Swap Component */}
            <Box sx={{ p: 2 }}>
              <SwapHubV3 />
            </Box>
          </TabPanel>

          <TabPanel value={activeTab} index={1}>
            {/* DexScreener Chart */}
            <Box sx={{ p: 2 }}>
              <DexScreenerIframe
                chain="xrpl"
                tokenSymbol={symbol}
                issuer={issuer}
              />
            </Box>
          </TabPanel>

          <TabPanel value={activeTab} index={2}>
            {/* Activity / Transactions */}
            <Box sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Recent Activity
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                        Time
                      </TableCell>
                      <TableCell sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                        Type
                      </TableCell>
                      <TableCell sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                        Amount
                      </TableCell>
                      <TableCell sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                        Price
                      </TableCell>
                      <TableCell sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                        Txn
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell colSpan={5} sx={{ textAlign: 'center', py: 4 }}>
                        <Typography color="rgba(255, 255, 255, 0.5)">
                          Transaction history coming soon...
                        </Typography>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </TabPanel>
        </Paper>

        {/* Volume Stats */}
        <Paper
          sx={{
            bgcolor: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(0, 212, 255, 0.2)',
            borderRadius: 2,
            p: 2,
            mt: 3,
          }}
        >
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
            Volume & Transactions
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" color="rgba(255, 255, 255, 0.7)" sx={{ mb: 1 }}>
                Volume
              </Typography>
              <Stack spacing={1}>
                <Box>
                  <Typography variant="caption" color="rgba(255, 255, 255, 0.5)">
                    5m: {formatNumber(token.volume.m5)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="rgba(255, 255, 255, 0.5)">
                    1h: {formatNumber(token.volume.h1)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="rgba(255, 255, 255, 0.5)">
                    6h: {formatNumber(token.volume.h6)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="rgba(255, 255, 255, 0.5)">
                    24h: {formatNumber(token.volume.h24)}
                  </Typography>
                </Box>
              </Stack>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" color="rgba(255, 255, 255, 0.7)" sx={{ mb: 1 }}>
                Transactions
              </Typography>
              <Stack spacing={1}>
                <Box>
                  <Typography variant="caption" color="rgba(255, 255, 255, 0.5)">
                    5m: {token.txns.m5.toLocaleString()} txns
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="rgba(255, 255, 255, 0.5)">
                    1h: {token.txns.h1.toLocaleString()} txns
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="rgba(255, 255, 255, 0.5)">
                    6h: {token.txns.h6.toLocaleString()} txns
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="rgba(255, 255, 255, 0.5)">
                    24h: {token.txns.h24.toLocaleString()} txns
                  </Typography>
                </Box>
              </Stack>
            </Grid>
          </Grid>
        </Paper>
      </Container>
    </Box>
  );
}
