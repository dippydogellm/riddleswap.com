import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  InputBase,
  Badge,
  Box,
  Button,
  Menu,
  MenuItem,
  Avatar,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  useTheme,
  alpha,
  styled,
  Container,
} from '@mui/material';
import {
  Search as SearchIcon,
  Notifications as NotificationsIcon,
  AccountCircle,
  Menu as MenuIcon,
  ShoppingCart,
  Group,
  Store,
  Map,
  SwapHoriz,
  Dashboard,
  Close as CloseIcon,
  SportsEsports as GamingIcon,
  EmojiEvents as Trophy,
  SportsMartialArts as Swords,
} from '@mui/icons-material';

const StyledAppBar = styled(AppBar)(({ theme }) => ({
  background: `linear-gradient(135deg, 
    ${alpha(theme.palette.primary.dark, 0.95)} 0%, 
    ${alpha(theme.palette.secondary.dark, 0.95)} 100%
  )`,
  backdropFilter: 'blur(10px)',
  borderBottom: `2px solid ${alpha(theme.palette.primary.light, 0.3)}`,
  boxShadow: '0 4px 30px rgba(0, 0, 0, 0.5)',
}));

const Search = styled('div')(({ theme }) => ({
  position: 'relative',
  borderRadius: theme.shape.borderRadius * 3,
  backgroundColor: alpha(theme.palette.common.white, 0.15),
  border: `1px solid ${alpha(theme.palette.common.white, 0.3)}`,
  '&:hover': {
    backgroundColor: alpha(theme.palette.common.white, 0.25),
    borderColor: alpha(theme.palette.common.white, 0.5),
  },
  marginRight: theme.spacing(2),
  marginLeft: 0,
  width: '100%',
  transition: 'all 0.3s ease',
  [theme.breakpoints.up('sm')]: {
    marginLeft: theme.spacing(3),
    width: 'auto',
  },
}));

const SearchIconWrapper = styled('div')(({ theme }) => ({
  padding: theme.spacing(0, 2),
  height: '100%',
  position: 'absolute',
  pointerEvents: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: alpha(theme.palette.common.white, 0.8),
}));

const StyledInputBase = styled(InputBase)(({ theme }) => ({
  color: 'inherit',
  width: '100%',
  '& .MuiInputBase-input': {
    padding: theme.spacing(1.5, 1, 1.5, 0),
    paddingLeft: `calc(1em + ${theme.spacing(4)})`,
    transition: theme.transitions.create('width'),
    width: '100%',
    [theme.breakpoints.up('md')]: {
      width: '40ch',
      '&:focus': {
        width: '60ch',
      },
    },
  },
}));

const NavButton = styled(Button)(({ theme }) => ({
  color: 'white',
  margin: theme.spacing(0, 1),
  padding: theme.spacing(1, 2),
  borderRadius: theme.shape.borderRadius * 2,
  transition: 'all 0.3s ease',
  '&:hover': {
    background: alpha(theme.palette.common.white, 0.2),
    transform: 'translateY(-2px)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
  },
  '&.active': {
    background: alpha(theme.palette.primary.light, 0.3),
    borderBottom: '2px solid',
    borderColor: theme.palette.primary.light,
  },
}));

export default function GamingNavBar() {
  const theme = useTheme();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const menuItems = [
    { title: 'Dashboard', icon: <Dashboard />, path: '/' },
    { title: 'Gaming', icon: <GamingIcon />, path: '/gaming' },
    { title: 'Battles', icon: <Swords />, path: '/battles' },
    { title: 'Civilizations', icon: <Trophy />, path: '/civilizations' },
    { title: 'Squadrons', icon: <Group />, path: '/squadrons' },
    { title: 'Marketplace', icon: <Store />, path: '/nft-marketplace' },
    { title: 'Land', icon: <Map />, path: '/land' },
    { title: 'Swap', icon: <SwapHoriz />, path: '/trade-v3' },
    { title: 'Leaderboard', icon: <Trophy />, path: '/leaderboard' },
  ];

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/search?q=${encodeURIComponent(searchQuery)}`;
    }
  };

  const drawer = (
    <Box sx={{ width: 280, background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)', height: '100%' }}>
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" sx={{ color: 'white', fontWeight: 'bold' }}>
          🎮 RIDDLESWAP
        </Typography>
        <IconButton onClick={handleDrawerToggle} sx={{ color: 'white' }}>
          <CloseIcon />
        </IconButton>
      </Box>
      <List>
        {menuItems.map((item) => (
          <ListItem
            button
            key={item.title}
            onClick={() => {
              window.location.href = item.path;
              handleDrawerToggle();
            }}
            sx={{
              color: 'white',
              '&:hover': {
                background: alpha(theme.palette.primary.main, 0.2),
              },
              ...(location === item.path && {
                background: alpha(theme.palette.primary.main, 0.3),
                borderLeft: '4px solid',
                borderColor: theme.palette.primary.main,
              }),
            }}
          >
            <ListItemIcon sx={{ color: 'white' }}>{item.icon}</ListItemIcon>
            <ListItemText primary={item.title} />
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <>
      <StyledAppBar position="fixed">
        <Container maxWidth="xl">
          <Toolbar disableGutters>
            {/* Mobile Menu Icon */}
            <IconButton
              color="inherit"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2, display: { md: 'none' } }}
            >
              <MenuIcon />
            </IconButton>

            {/* Logo */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                mr: 3,
                cursor: 'pointer',
              }}
              onClick={() => window.location.href = '/'}
            >
              <GamingIcon sx={{ fontSize: 40, mr: 1, color: theme.palette.primary.light }} />
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 800,
                  background: 'linear-gradient(45deg, #FFD700 30%, #FFA500 90%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  display: { xs: 'none', sm: 'block' },
                  letterSpacing: 1,
                }}
              >
                RIDDLESWAP
              </Typography>
            </Box>

            {/* Desktop Navigation */}
            <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'flex' } }}>
              {menuItems.slice(0, 6).map((item) => (
                <NavButton
                  key={item.title}
                  onClick={() => window.location.href = item.path}
                  startIcon={item.icon}
                  className={location === item.path ? 'active' : ''}
                >
                  {item.title}
                </NavButton>
              ))}
            </Box>

            {/* Search Bar */}
            <Search>
              <SearchIconWrapper>
                <SearchIcon />
              </SearchIconWrapper>
              <form onSubmit={handleSearch}>
                <StyledInputBase
                  placeholder="Search NFTs, tokens, players..."
                  inputProps={{ 'aria-label': 'search' }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </form>
            </Search>

            {/* Right Side Icons */}
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <IconButton color="inherit" sx={{ mx: 1 }}>
                <Badge badgeContent={3} color="error">
                  <ShoppingCart />
                </Badge>
              </IconButton>

              <IconButton color="inherit" sx={{ mx: 1 }}>
                <Badge badgeContent={5} color="error">
                  <NotificationsIcon />
                </Badge>
              </IconButton>

              <IconButton
                edge="end"
                onClick={handleProfileMenuOpen}
                color="inherit"
                sx={{ ml: 1 }}
              >
                <Avatar
                  sx={{
                    width: 40,
                    height: 40,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    border: '2px solid',
                    borderColor: theme.palette.primary.light,
                  }}
                >
                  <AccountCircle />
                </Avatar>
              </IconButton>
            </Box>
          </Toolbar>
        </Container>
      </StyledAppBar>

      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        anchor="left"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{
          keepMounted: true,
        }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 280 },
        }}
      >
        {drawer}
      </Drawer>

      {/* Profile Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{
          sx: {
            mt: 1.5,
            background: alpha(theme.palette.background.paper, 0.95),
            backdropFilter: 'blur(10px)',
          },
        }}
      >
        <MenuItem onClick={() => { window.location.href = '/profile'; handleMenuClose(); }}>
          My Profile
        </MenuItem>
        <MenuItem onClick={() => { window.location.href = '/gaming'; handleMenuClose(); }}>
          My Inventory
        </MenuItem>
        <MenuItem onClick={() => { window.location.href = '/settings'; handleMenuClose(); }}>
          Settings
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>Logout</MenuItem>
      </Menu>

      {/* Spacer for fixed navbar */}
      <Toolbar />
    </>
  );
}
