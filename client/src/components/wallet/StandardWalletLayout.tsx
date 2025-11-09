import { ReactNode } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  Avatar,
  Chip,
  Grid,
  Card,
  CardContent,
  Divider,
  Stack,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Send as SendIcon,
  CallReceived as ReceiveIcon,
  SwapHoriz as SwapIcon,
  Delete as BurnIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';

interface ChainInfo {
  name: string;
  symbol: string;
  logo: string;
  color: string;
}

interface WalletAction {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
}

interface StandardWalletLayoutProps {
  chain: ChainInfo;
  address: string;
  balance: {
    native: string;
    usd: string;
  };
  isLoading?: boolean;
  onRefresh?: () => void;
  actions?: WalletAction[];
  children: ReactNode;
  showHeader?: boolean;
}

export default function StandardWalletLayout({
  chain,
  address,
  balance,
  isLoading = false,
  onRefresh,
  actions = [],
  children,
  showHeader = true
}: StandardWalletLayoutProps) {
  
  const defaultActions: WalletAction[] = [
    {
      label: 'Send',
      icon: <SendIcon />,
      onClick: () => {},
      color: 'primary'
    },
    {
      label: 'Receive',
      icon: <ReceiveIcon />,
      onClick: () => {},
      color: 'success'
    },
    {
      label: 'Swap',
      icon: <SwapIcon />,
      onClick: () => {},
      color: 'info'
    },
    {
      label: 'Burn Dust',
      icon: <BurnIcon />,
      onClick: () => {},
      color: 'warning'
    }
  ];

  const allActions = actions.length > 0 ? actions : defaultActions;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        py: 4
      }}
    >
      <Container maxWidth="xl">
        {showHeader && (
          <Paper
            elevation={3}
            sx={{
              p: 3,
              mb: 4,
              background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
              backdropFilter: 'blur(10px)',
              borderRadius: 3,
              border: '1px solid rgba(255,255,255,0.1)'
            }}
          >
            {/* Chain Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar
                  src={chain.logo}
                  alt={chain.name}
                  sx={{
                    width: 56,
                    height: 56,
                    border: `3px solid ${chain.color}`,
                    boxShadow: `0 0 20px ${chain.color}80`
                  }}
                />
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'white' }}>
                    {chain.name} Wallet
                  </Typography>
                  <Chip
                    label={chain.symbol}
                    size="small"
                    sx={{
                      bgcolor: chain.color,
                      color: 'white',
                      fontWeight: 'bold',
                      mt: 0.5
                    }}
                  />
                </Box>
              </Box>
              
              {onRefresh && (
                <Tooltip title="Refresh balances">
                  <IconButton
                    onClick={onRefresh}
                    disabled={isLoading}
                    sx={{
                      bgcolor: 'rgba(255,255,255,0.1)',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' }
                    }}
                  >
                    <RefreshIcon sx={{ color: 'white' }} />
                  </IconButton>
                </Tooltip>
              )}
            </Box>

            <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.1)' }} />

            {/* Balance Display */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} md={6}>
                <Card
                  sx={{
                    background: 'linear-gradient(135deg, rgba(96, 165, 250, 0.2) 0%, rgba(59, 130, 246, 0.1) 100%)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(96, 165, 250, 0.3)'
                  }}
                >
                  <CardContent>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 1 }}>
                      Balance
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'white', mb: 1 }}>
                      {balance.native}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                      ${balance.usd} USD
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card
                  sx={{
                    background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(139, 92, 246, 0.1) 100%)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(168, 85, 247, 0.3)'
                  }}
                >
                  <CardContent>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 1 }}>
                      Wallet Address
                    </Typography>
                    <Typography
                      variant="body1"
                      sx={{
                        fontFamily: 'monospace',
                        color: 'white',
                        wordBreak: 'break-all',
                        fontSize: '0.9rem'
                      }}
                    >
                      {address}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Action Buttons */}
            <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', gap: 1 }}>
              {allActions.map((action, index) => (
                <Chip
                  key={index}
                  label={action.label}
                  icon={action.icon as any}
                  onClick={action.onClick}
                  disabled={action.disabled || isLoading}
                  color={action.color || 'primary'}
                  sx={{
                    py: 2.5,
                    px: 2,
                    fontSize: '0.95rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: 4
                    },
                    transition: 'all 0.2s'
                  }}
                />
              ))}
            </Stack>
          </Paper>
        )}

        {/* Content Area */}
        <Box>{children}</Box>
      </Container>
    </Box>
  );
}
