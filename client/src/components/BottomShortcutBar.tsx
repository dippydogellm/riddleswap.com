import { useState } from 'react';
import { Home, ArrowLeftRight, Image, Lock, MoreHorizontal, X, User, MessageSquare, Flame, Gift, Swords, Building, Settings } from 'lucide-react';
import { useLocation } from 'wouter';
import {
  Paper,
  BottomNavigation,
  BottomNavigationAction,
  Dialog,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  useTheme
} from '@mui/material';

export default function BottomShortcutBar() {
  const [, navigate] = useLocation();
  const [showTradePopup, setShowTradePopup] = useState(false);
  const [showMorePopup, setShowMorePopup] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const theme = useTheme();

  const tradeOptions = [
    { name: 'XRPL Swap', path: '/xrpl-swap', icon: ArrowLeftRight },
    { name: 'EVM Swap', path: '/swap', icon: ArrowLeftRight },
    { name: 'Solana Swap', path: '/solana-swap', icon: ArrowLeftRight },
    { name: 'Bridge', path: '/bridge', icon: ArrowLeftRight },
  ];

  const moreOptions = [
    { name: 'Profile', path: '/profile', icon: User },
    { name: 'Messages', path: '/messaging', icon: MessageSquare },
    { name: 'Scanner', path: '/scanner', icon: Flame },
    { name: 'Rewards', path: '/rewards', icon: Gift },
    { name: 'Trolls Inquisition', path: '/gaming', icon: Swords },
    { name: 'RiddleCity', path: '/riddlecity', icon: Building },
    { name: 'DevTools', path: '/devtools', icon: Gift },
    { name: 'Admin', path: '/admin', icon: Settings },
  ];

  return (
    <>
      {/* Trade Popup */}
      <Dialog
        open={showTradePopup}
        onClose={() => setShowTradePopup(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: 'background.paper',
            backgroundImage: 'none'
          }
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Select Trading Option
          <IconButton onClick={() => setShowTradePopup(false)} size="small">
            <X size={20} />
          </IconButton>
        </DialogTitle>
        <List sx={{ px: 2, pb: 2 }}>
          {tradeOptions.map((option, index) => (
            <ListItem key={index} disablePadding sx={{ mb: 1 }}>
              <ListItemButton
                onClick={() => {
                  navigate(option.path);
                  setShowTradePopup(false);
                }}
                sx={{
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: 'action.hover'
                  }
                }}
              >
                <ListItemIcon>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      bgcolor: 'action.selected',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <option.icon size={24} color={theme.palette.primary.main} />
                  </Box>
                </ListItemIcon>
                <ListItemText primary={option.name} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Dialog>

      {/* More Popup */}
      <Dialog
        open={showMorePopup}
        onClose={() => setShowMorePopup(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: 'background.paper',
            backgroundImage: 'none'
          }
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          More Features
          <IconButton onClick={() => setShowMorePopup(false)} size="small">
            <X size={20} />
          </IconButton>
        </DialogTitle>
        <List sx={{ px: 2, pb: 2, maxHeight: 400, overflowY: 'auto' }}>
          {moreOptions.map((option, index) => (
            <ListItem key={index} disablePadding sx={{ mb: 1 }}>
              <ListItemButton
                onClick={() => {
                  navigate(option.path);
                  setShowMorePopup(false);
                }}
                sx={{
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: 'action.hover'
                  }
                }}
              >
                <ListItemIcon>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      bgcolor: 'action.selected',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <option.icon size={24} color={theme.palette.primary.main} />
                  </Box>
                </ListItemIcon>
                <ListItemText primary={option.name} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Dialog>

      {/* Bottom Shortcut Bar */}
      <Paper
        elevation={8}
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1100,
          borderTop: 1,
          borderColor: 'divider'
        }}
      >
        <BottomNavigation
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          showLabels
          sx={{
            bgcolor: 'background.paper',
            '& .MuiBottomNavigationAction-root': {
              minWidth: 'auto',
              padding: '6px 12px',
              '&.Mui-selected': {
                color: 'primary.main'
              }
            },
            '& .MuiBottomNavigationAction-label': {
              fontSize: '0.625rem',
              '&.Mui-selected': {
                fontSize: '0.625rem'
              }
            }
          }}
        >
          <BottomNavigationAction
            label="Home"
            icon={<Home size={20} />}
            onClick={() => navigate('/')}
          />
          <BottomNavigationAction
            label="Trade"
            icon={<ArrowLeftRight size={20} />}
            onClick={() => setShowTradePopup(true)}
          />
          <BottomNavigationAction
            label="NFTs"
            icon={<Image size={20} />}
            onClick={() => navigate('/nft-marketplace')}
          />
          <BottomNavigationAction
            label="Vault"
            icon={<Lock size={20} />}
            onClick={() => navigate('/vault')}
          />
          <BottomNavigationAction
            label="More"
            icon={<MoreHorizontal size={20} />}
            onClick={() => setShowMorePopup(true)}
          />
        </BottomNavigation>
      </Paper>

      {/* Spacer to prevent content from being hidden behind the bar */}
      <div className="h-14" />
    </>
  );
}
