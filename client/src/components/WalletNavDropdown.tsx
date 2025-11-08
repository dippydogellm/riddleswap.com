import { useState } from 'react';
import { Wallet } from 'lucide-react';
import { Link } from 'wouter';
import {
  Button as MuiButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Typography,
  Box
} from '@mui/material';
import { useSession } from '@/utils/sessionManager';

interface ChainWallet {
  name: string;
  path: string;
  logo: string;
  symbol: string;
  enabled: boolean;
}

export function WalletNavDropdown() {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const session = useSession();

  const wallets: ChainWallet[] = [
    {
      name: 'XRP Ledger',
      path: '/xrp-wallet',
      logo: '/images/chains/xrp-logo.png',
      symbol: 'XRP',
      enabled: !!session.walletData?.xrpAddress
    },
    {
      name: 'Ethereum',
      path: '/eth-wallet',
      logo: '/images/chains/ethereum-logo.png',
      symbol: 'ETH',
      enabled: !!session.walletData?.ethAddress
    },
    {
      name: 'BNB Chain',
      path: '/bnb-wallet',
      logo: '/images/chains/bnb-logo.png',
      symbol: 'BNB',
      enabled: !!session.walletData?.ethAddress
    },
    {
      name: 'Polygon',
      path: '/polygon-wallet',
      logo: '/images/chains/polygon-logo.png',
      symbol: 'MATIC',
      enabled: !!session.walletData?.ethAddress
    },
    {
      name: 'Arbitrum',
      path: '/arbitrum-wallet',
      logo: '/images/chains/arbitrum-logo.png',
      symbol: 'ARB',
      enabled: !!session.walletData?.ethAddress
    },
    {
      name: 'Optimism',
      path: '/optimism-wallet',
      logo: '/images/chains/optimism-logo.png',
      symbol: 'OP',
      enabled: !!session.walletData?.ethAddress
    },
    {
      name: 'Base',
      path: '/base-wallet',
      logo: '/images/chains/base-logo.png',
      symbol: 'ETH',
      enabled: !!session.walletData?.ethAddress
    },
    {
      name: 'Avalanche',
      path: '/avalanche-wallet',
      logo: '/images/chains/avalanche-logo.png',
      symbol: 'AVAX',
      enabled: !!session.walletData?.ethAddress
    },
    {
      name: 'Solana',
      path: '/solana-swap',
      logo: '/images/chains/solana-logo.png',
      symbol: 'SOL',
      enabled: !!session.walletData?.solAddress
    },
    {
      name: 'Bitcoin',
      path: '/btc-wallet',
      logo: '/images/chains/bitcoin-logo.png',
      symbol: 'BTC',
      enabled: !!session.walletData?.btcAddress
    }
  ];

  // Only show if user has at least one wallet
  if (!session.isLoggedIn) {
    return null;
  }

  const activeWallets = wallets.filter(w => w.enabled);

  return (
    <>
      <MuiButton
        variant="outlined"
        size="small"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        startIcon={<Wallet className="h-4 w-4" />}
        sx={{
          height: 36,
          color: 'text.primary',
          borderColor: 'divider',
          '&:hover': {
            borderColor: 'primary.main',
            bgcolor: 'action.hover'
          }
        }}
      >
        Wallets
      </MuiButton>
      
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { width: 224, mt: 1 } }}
      >
        <Typography variant="subtitle2" sx={{ px: 2, py: 1, fontWeight: 600 }}>
          My Wallets
        </Typography>
        <Divider />
        
        {activeWallets.length > 0 ? (
          <>
            {activeWallets.map((wallet) => (
              <MenuItem
                key={wallet.path}
                component={Link}
                href={wallet.path}
                onClick={() => setAnchorEl(null)}
              >
                <ListItemIcon>
                  <Box
                    component="img"
                    src={wallet.logo}
                    alt={wallet.name}
                    sx={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%'
                    }}
                    onError={(e: any) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </ListItemIcon>
                <ListItemText
                  primary={wallet.name}
                  primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                />
                <Typography variant="caption" color="text.secondary">
                  {wallet.symbol}
                </Typography>
              </MenuItem>
            ))}
            <Divider />
            <MenuItem component={Link} href="/multi-chain-dashboard" onClick={() => setAnchorEl(null)}>
              <ListItemIcon>
                <Wallet className="h-4 w-4" />
              </ListItemIcon>
              <ListItemText primary="All Wallets" />
            </MenuItem>
          </>
        ) : (
          <Box sx={{ px: 2, py: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No wallets available
            </Typography>
          </Box>
        )}
      </Menu>
    </>
  );
}
