import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'wouter';
import {
  Menu, X, User, LogOut, Wallet, LogIn, Search, ChevronDown,
  ArrowLeftRight, Image, Wrench, MoreHorizontal, Home, Loader2,
  ExternalLink, Hash, FolderOpen, FileText, MessageCircle
} from 'lucide-react';
import {
  AppBar,
  Toolbar,
  IconButton,
  Button,
  Menu as MuiMenu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Drawer,
  Box,
  Typography,
  Divider,
  Paper,
  InputBase,
  Badge,
  Card,
  CardContent,
  Chip,
  Avatar,
  Fade,
  Backdrop
} from '@mui/material';
import { useThemeContext } from '@/contexts/ThemeProvider';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { useXamanWallet } from '@/hooks/useXamanWallet';
import { WalletConnectionDashboard } from '@/components/wallet-connection-dashboard';
import { useSession } from '@/utils/sessionManager';
import { ThemeToggle } from '@/components/theme-toggle';
import { TotalBalanceDisplay } from '@/components/TotalBalanceDisplay';
import { WalletNavDropdown } from '@/components/WalletNavDropdown';
// NotificationBell removed per directive to eliminate bell UI component
// If needed later, reintroduce a lightweight notifications indicator via MUI Badge
import { cn } from '@/lib/utils';
import { debounce } from 'lodash';

interface SearchResult {
  id: string;
  type: 'profile' | 'project' | 'page';
  title: string;
  description: string;
  url: string;
  image?: string;
  metadata?: Record<string, any>;
}

interface SearchResponse {
  query: string;
  results: SearchResult[];
  total: number;
  type: string;
}

const typeConfig = {
  profile: {
    icon: User,
    label: 'Profile',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    bgColor: 'hover:bg-blue-50 dark:hover:bg-blue-950'
  },
  project: {
    icon: FolderOpen,
    label: 'Project',
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    bgColor: 'hover:bg-purple-50 dark:hover:bg-purple-950'
  },
  page: {
    icon: FileText,
    label: 'Page',
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    bgColor: 'hover:bg-green-50 dark:hover:bg-green-950'
  }
};

// Navigation structure
const navigationConfig = {
  trade: [
    { label: 'Trade Center', path: '/trade-v3', icon: ArrowLeftRight },
    { label: 'Bridge', path: '/bridge', icon: ArrowLeftRight },
    { label: 'Vault', path: '/vault', icon: Wallet },
  ],
  services: [
    { label: 'NFT Marketplace', path: '/nft-marketplace', icon: Image },
    { label: 'Gaming', path: '/gaming', icon: Home },
    { label: 'DevTools', path: '/devtools', icon: Wrench },
    { label: 'RiddlePad', path: '/riddlepad', icon: Wrench },
    { label: 'AI Studio', path: '/ai-studio', icon: Wrench },
  ],
  projects: [
    { label: 'The Trolls Inquisition', path: '/trolls-inquisition', icon: Image },
    { label: 'RiddleCity', path: '/riddle-city', icon: Home },
    { label: 'The Inquiry', path: '/collections/the-inquiry', icon: Image },
    { label: 'The Lost Emporium', path: '/collections/the-lost-emporium', icon: Image },
    { label: 'Dantes Aurum', path: '/collections/dantes-aurum', icon: Image },
    { label: 'Under The Bridge', path: '/collections/under-the-bridge', icon: Image },
    { label: 'RDL Token', path: '/token/rdl', icon: Hash },
  ],
  more: [
    { label: 'Profile', path: '/profile', icon: User },
    { label: 'Messages', path: '/messaging', icon: Home },
    { label: 'Newsfeed', path: '/newsfeed', icon: Home },
    { label: 'Scanner', path: '/scanner', icon: Home },
    { label: 'Rewards', path: '/rewards', icon: Home },
    { label: 'Your Rewards', path: '/user-rewards', icon: Home },
    { label: 'THE ORACLE', path: '/riddleauthor', icon: Home },
  ]
};

export default function ProfessionalHeader() {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showWalletDashboard, setShowWalletDashboard] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'profile' | 'project' | 'page'>('all');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [currentMenu, setCurrentMenu] = useState<string | null>(null);
  
  const { toast } = useToast();
  const xaman = useXamanWallet();
  
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const session = useSession();
  const isLoggedIn = session.isLoggedIn;
  const userHandle = session.handle || session.username;

  // Debounced search
  const debouncedSearch = useCallback(
    debounce((searchQuery: string) => {
      try {
        if (searchQuery.trim()) {
          setSearchQuery(searchQuery);
        }
      } catch (error) {
        console.error('Search debounce error:', error);
      }
    }, 300),
    []
  );

  const { data: searchResults, isLoading: searchLoading, error: searchError } = useQuery<SearchResponse>({
    queryKey: ['/api/search/unified', { q: searchQuery, type: selectedFilter }],
    enabled: searchQuery.trim().length >= 2,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    retry: 1,
    retryDelay: 1000
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, menu: string) => {
    setAnchorEl(event.currentTarget);
    setCurrentMenu(menu);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setCurrentMenu(null);
  };

  const handleLogout = async () => {
    try {
      if (xaman) await xaman.disconnect();
      if ((window as any).appkit) {
        try {
          await (window as any).appkit.disconnect();
        } catch (e) {
          console.log('AppKit disconnect warning:', e);
        }
      }
      await session.logout();
    } catch (error) {
      console.error('Logout error:', error);
      toast({
        title: "Logout Warning",
        description: "Some connections may still be active. Please refresh the page.",
        variant: "destructive"
      });
    }
  };

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const value = e.target.value;
      if (value.trim().length >= 2) {
        debouncedSearch(value);
      } else {
        setSearchQuery('');
      }
    } catch (error) {
      console.error('Search input change error:', error);
    }
  };

  const handleSearchResultClick = (result: SearchResult) => {
    try {
      if (searchQuery && result.id) {
        fetch('/api/search/analytics/click', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: searchQuery,
            result_id: result.id,
            result_type: result.type,
            search_session_id: `search_${Date.now()}`
          })
        }).catch(console.warn);
      }
      setIsSearchOpen(false);
      if (searchInputRef.current) {
        searchInputRef.current.blur();
        searchInputRef.current.value = '';
      }
      setSearchQuery('');
    } catch (error) {
      console.error('Search result click error:', error);
      setIsSearchOpen(false);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    if (searchInputRef.current) {
      searchInputRef.current.value = '';
      searchInputRef.current.focus();
    }
  };

  const filterButtons = [
    { key: 'all' as const, label: 'All', icon: Hash },
    { key: 'profile' as const, label: 'Profiles', icon: User },
    { key: 'project' as const, label: 'Projects', icon: FolderOpen },
    { key: 'page' as const, label: 'Pages', icon: FileText }
  ];

  const results = searchResults?.results || [];
  const hasResults = results.length > 0;
  const showSearchResults = isSearchOpen && searchQuery.trim().length >= 2;
  const hasSearchError = searchError && !searchLoading;

  return (
    <>
      <AppBar position="sticky" sx={{ zIndex: 100 }}>
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', marginRight: 16 }}>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
              <img
                src="/images/logos/rdl-logo-official.png"
                alt="RDL"
                style={{ width: 32, height: 32, objectFit: 'contain' }}
                onError={(e) => {
                  const target = e.currentTarget as HTMLImageElement;
                  target.style.display = 'none';
                  const nextEl = target.nextElementSibling as HTMLElement;
                  if (nextEl) nextEl.style.display = 'flex';
                }}
              />
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 4,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Typography variant="body2" sx={{ color: 'white', fontWeight: 'bold' }}>
                  RDL
                </Typography>
              </div>
            </Link>
          </div>          {/* Desktop Navigation - Hidden, using mobile sidebar instead */}
          <div style={{ display: 'none', alignItems: 'center', gap: 8, flex: 1 }} className="md:flex">
            {/* Home */}
            <Button
              component={Link}
              href="/"
              startIcon={<Home />}
              sx={{ height: 36 }}
            >
              Home
            </Button>

            <Button
              onClick={(e) => handleMenuOpen(e, 'trade')}
              endIcon={<ChevronDown />}
              sx={{ height: 36 }}
            >
              <ArrowLeftRight />
              Trade
            </Button>

            {/* Services Dropdown */}
            <Button
              onClick={(e) => handleMenuOpen(e, 'services')}
              endIcon={<ChevronDown />}
              sx={{ height: 36 }}
            >
              <Wrench />
              Services
            </Button>

            {/* Our Projects Dropdown */}
            <Button
              onClick={(e) => handleMenuOpen(e, 'projects')}
              endIcon={<ChevronDown />}
              sx={{ height: 36 }}
            >
              <FolderOpen />
              Our Projects
            </Button>

            {/* More Dropdown */}
            <Button
              onClick={(e) => handleMenuOpen(e, 'more')}
              endIcon={<ChevronDown />}
              sx={{ height: 36 }}
            >
              <MoreHorizontal />
              More
            </Button>
          </div>

          {/* Right Side - Balance + Actions */}
          <div className="hidden md:flex items-center gap-3 ml-auto">
            {/* Total Balance */}
            <TotalBalanceDisplay compact />

            {/* Search button is provided in the unified Actions bar below; avoid duplication here */}

            {/* Messenger Icon */}
            {isLoggedIn && (
              <IconButton
                component={Link}
                href="/messaging"
                sx={{ border: 1, borderColor: 'divider' }}
                title="Messages"
              >
                <MessageCircle />
              </IconButton>
            )}

            {/* Notifications Bell removed: preserving layout spacing with ThemeToggle + WalletNavDropdown */}

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Wallet Navigation Dropdown (logged in users) */}
            {isLoggedIn && <WalletNavDropdown />}

            {/* External Wallets */}
            <Button
              variant="outlined"
              onClick={() => setShowWalletDashboard(true)}
              sx={{ 
                height: 36,
                borderColor: 'primary.main',
                color: 'primary.main',
                '&:hover': {
                  borderColor: 'primary.dark',
                  backgroundColor: 'primary.main',
                  color: 'primary.contrastText'
                }
              }}
            >
              <Wallet />
              External Wallets
            </Button>

            {/* Riddle Wallet */}
            {isLoggedIn ? (
              <Button
                onClick={(e) => handleMenuOpen(e, 'profile')}
                variant="outlined"
                sx={{ 
                  height: 36,
                  borderColor: 'primary.main',
                  color: 'primary.main',
                  '&:hover': {
                    borderColor: 'primary.dark',
                    backgroundColor: 'primary.main',
                    color: 'primary.contrastText'
                  }
                }}
              >
                <User />
                {userHandle || 'Profile'}
              </Button>
            ) : (
              <Button
                component={Link}
                href="/login"
                variant="outlined"
                sx={{ 
                  height: 36,
                  borderColor: 'primary.main',
                  color: 'primary.main',
                  '&:hover': {
                    borderColor: 'primary.dark',
                    backgroundColor: 'primary.main',
                    color: 'primary.contrastText'
                  }
                }}
              >
                <LogIn />
                Riddle Wallet
              </Button>
            )}
          </div>

          {/* Right Side Actions - Desktop & Mobile */}
          <div className="flex items-center gap-1 ml-auto">
            {/* Search Bar */}
            <Button
              variant="outlined"
              onClick={() => {
                setIsSearchOpen(!isSearchOpen);
                if (!isSearchOpen && searchInputRef.current) {
                  setTimeout(() => searchInputRef.current?.focus(), 100);
                }
              }}
              sx={{ height: 36 }}
              className="md:hidden"
            >
              <Search />
              Search
            </Button>

            {/* Menu Button - Now on Desktop & Mobile */}
            <IconButton
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              sx={{ border: 1, borderColor: 'divider' }}
            >
              {isMobileMenuOpen ? <X /> : <Menu />}
            </IconButton>
          </div>
        </Toolbar>
      </AppBar>

      {/* MUI Menus */}
      <MuiMenu
        anchorEl={anchorEl}
        open={Boolean(anchorEl) && currentMenu === 'trade'}
        onClose={handleMenuClose}
      >
        <Typography variant="subtitle2" sx={{ px: 2, py: 1, fontWeight: 'bold' }}>Trading</Typography>
        <Divider />
        {navigationConfig.trade.map((item) => (
          <MenuItem key={item.path} component={Link} href={item.path} onClick={handleMenuClose}>
            <ListItemIcon>
              <item.icon />
            </ListItemIcon>
            <ListItemText primary={item.label} />
          </MenuItem>
        ))}
      </MuiMenu>

      <MuiMenu
        anchorEl={anchorEl}
        open={Boolean(anchorEl) && currentMenu === 'services'}
        onClose={handleMenuClose}
      >
        <Typography variant="subtitle2" sx={{ px: 2, py: 1, fontWeight: 'bold' }}>Services</Typography>
        <Divider />
        {navigationConfig.services.map((item) => (
          <MenuItem key={item.path} component={Link} href={item.path} onClick={handleMenuClose}>
            <ListItemIcon>
              <item.icon />
            </ListItemIcon>
            <ListItemText primary={item.label} />
          </MenuItem>
        ))}
      </MuiMenu>

      <MuiMenu
        anchorEl={anchorEl}
        open={Boolean(anchorEl) && currentMenu === 'projects'}
        onClose={handleMenuClose}
      >
        <Typography variant="subtitle2" sx={{ px: 2, py: 1, fontWeight: 'bold' }}>Collections & Tokens</Typography>
        <Divider />
        {navigationConfig.projects.map((item) => (
          <MenuItem key={item.path} component={Link} href={item.path} onClick={handleMenuClose}>
            <ListItemIcon>
              <item.icon />
            </ListItemIcon>
            <ListItemText primary={item.label} />
          </MenuItem>
        ))}
      </MuiMenu>

      <MuiMenu
        anchorEl={anchorEl}
        open={Boolean(anchorEl) && currentMenu === 'more'}
        onClose={handleMenuClose}
      >
        <Typography variant="subtitle2" sx={{ px: 2, py: 1, fontWeight: 'bold' }}>More Features</Typography>
        <Divider />
        {navigationConfig.more.map((item) => (
          <MenuItem key={item.path} component={Link} href={item.path} onClick={handleMenuClose}>
            <ListItemIcon>
              <item.icon />
            </ListItemIcon>
            <ListItemText primary={item.label} />
          </MenuItem>
        ))}
      </MuiMenu>

      <MuiMenu
        anchorEl={anchorEl}
        open={Boolean(anchorEl) && currentMenu === 'profile'}
        onClose={handleMenuClose}
      >
        <Typography variant="subtitle2" sx={{ px: 2, py: 1, fontWeight: 'bold' }}>Riddle Wallet</Typography>
        <Divider />
        <MenuItem component={Link} href="/profile" onClick={handleMenuClose}>
          <ListItemIcon>
            <User />
          </ListItemIcon>
          <ListItemText primary="Profile" />
        </MenuItem>
        <MenuItem component={Link} href="/multi-chain-dashboard" onClick={handleMenuClose}>
          <ListItemIcon>
            <Wallet />
          </ListItemIcon>
          <ListItemText primary="Wallet Dashboard" />
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => { handleLogout(); handleMenuClose(); }} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <LogOut />
          </ListItemIcon>
          <ListItemText primary="Logout" />
        </MenuItem>
      </MuiMenu>

      {/* Unified Sidebar Menu - Desktop & Mobile */}
      <Drawer
        open={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        sx={{
          '& .MuiDrawer-paper': {
            width: { xs: '85vw', sm: 320 },
            maxWidth: 320
          }
        }}
      >
        <div className="p-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <Typography variant="h6">Menu</Typography>
            <IconButton onClick={() => setIsMobileMenuOpen(false)}>
              <X />
            </IconButton>
          </div>
        </div>

        <div className="p-4 flex flex-col gap-3 overflow-y-auto">
          {/* Balance Display */}
          <TotalBalanceDisplay />

          {/* Quick Actions */}
          <div className="flex flex-col gap-1">
            <Button
              variant="outlined"
              fullWidth
              startIcon={<Search />}
              onClick={() => {
                setIsSearchOpen(true);
                setIsMobileMenuOpen(false);
              }}
            >
              Search
            </Button>
            <div className="flex justify-center">
              <ThemeToggle />
            </div>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<Wallet />}
              onClick={() => {
                setShowWalletDashboard(true);
                setIsMobileMenuOpen(false);
              }}
            >
              External Wallets
            </Button>
            {isLoggedIn ? (
              <>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<User />}
                  component={Link}
                  href="/profile"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {userHandle || 'Profile'}
                </Button>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<Wallet />}
                  component={Link}
                  href="/multi-chain-dashboard"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Wallet Dashboard
                </Button>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<LogOut />}
                  onClick={() => {
                    handleLogout();
                    setIsMobileMenuOpen(false);
                  }}
                  sx={{ color: 'error.main' }}
                >
                  Logout
                </Button>
              </>
            ) : (
              <Button
                variant="outlined"
                fullWidth
                startIcon={<LogIn />}
                component={Link}
                href="/login"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Riddle Wallet Login
              </Button>
            )}
          </div>

          {/* Navigation Sections */}
          <div className="flex flex-col gap-2">
            {/* My Wallets Section (for logged in users) */}
            {isLoggedIn && session.walletData && (
              <div>
                <Typography variant="overline" sx={{ fontWeight: 'bold', letterSpacing: 1, mb: 1 }}>
                  My Wallets
                </Typography>
                <div className="flex flex-col gap-1">
                  {session.walletData.xrpAddress && (
                    <Button
                      variant="text"
                      fullWidth
                      startIcon={
                        <Avatar
                          src="/images/chains/xrp-logo.png"
                          sx={{ width: 16, height: 16 }}
                        >
                          XRP
                        </Avatar>
                      }
                      component={Link}
                      href="/xrp-wallet"
                      onClick={() => setIsMobileMenuOpen(false)}
                      sx={{ justifyContent: 'flex-start' }}
                    >
                      XRP Ledger
                    </Button>
                  )}
                  {session.walletData.ethAddress && (
                    <>
                      <Button
                        variant="text"
                        fullWidth
                        startIcon={
                          <Avatar
                            src="/images/chains/ethereum-logo.png"
                            sx={{ width: 16, height: 16 }}
                          >
                            ETH
                          </Avatar>
                        }
                        component={Link}
                        href="/eth-wallet"
                        onClick={() => setIsMobileMenuOpen(false)}
                        sx={{ justifyContent: 'flex-start' }}
                      >
                        Ethereum
                      </Button>
                      <Button
                        variant="text"
                        fullWidth
                        startIcon={
                          <Avatar
                            src="/images/chains/bnb-logo.png"
                            sx={{ width: 16, height: 16 }}
                          >
                            BNB
                          </Avatar>
                        }
                        component={Link}
                        href="/bnb-wallet"
                        onClick={() => setIsMobileMenuOpen(false)}
                        sx={{ justifyContent: 'flex-start' }}
                      >
                        BNB Chain
                      </Button>
                      <Button
                        variant="text"
                        fullWidth
                        startIcon={
                          <Avatar
                            src="/images/chains/polygon-logo.png"
                            sx={{ width: 16, height: 16 }}
                          >
                            POL
                          </Avatar>
                        }
                        component={Link}
                        href="/polygon-wallet"
                        onClick={() => setIsMobileMenuOpen(false)}
                        sx={{ justifyContent: 'flex-start' }}
                      >
                        Polygon
                      </Button>
                    </>
                  )}
                  {session.walletData.solAddress && (
                    <Button
                      variant="text"
                      fullWidth
                      startIcon={
                        <Avatar
                          src="/images/chains/solana-logo.png"
                          sx={{ width: 16, height: 16 }}
                        >
                          SOL
                        </Avatar>
                      }
                      component={Link}
                      href="/trade-v3"
                      onClick={() => setIsMobileMenuOpen(false)}
                      sx={{ justifyContent: 'flex-start' }}
                    >
                      Solana
                    </Button>
                  )}
                  {session.walletData.btcAddress && (
                    <Button
                      variant="text"
                      fullWidth
                      startIcon={
                        <Avatar
                          src="/images/chains/bitcoin-logo.png"
                          sx={{ width: 16, height: 16 }}
                        >
                          BTC
                        </Avatar>
                      }
                      component={Link}
                      href="/btc-wallet"
                      onClick={() => setIsMobileMenuOpen(false)}
                      sx={{ justifyContent: 'flex-start' }}
                    >
                      Bitcoin
                    </Button>
                  )}
                  <Divider sx={{ my: 1 }} />
                  <Button
                    variant="text"
                    fullWidth
                    startIcon={<Wallet />}
                    component={Link}
                    href="/multi-chain-dashboard"
                    onClick={() => setIsMobileMenuOpen(false)}
                    sx={{ justifyContent: 'flex-start', borderTop: 1, borderColor: 'divider', pt: 1, mt: 1 }}
                  >
                    All Wallets
                  </Button>
                </div>
              </div>
            )}

            {/* Home */}
            <div>
              <Typography variant="overline" sx={{ fontWeight: 'bold', letterSpacing: 1, mb: 1 }}>
                Home
              </Typography>
              <Button
                variant="text"
                fullWidth
                startIcon={<Home />}
                component={Link}
                href="/"
                onClick={() => setIsMobileMenuOpen(false)}
                sx={{ justifyContent: 'flex-start' }}
              >
                Home
              </Button>
            </div>

            {/* Trading */}
            <div>
              <Typography variant="overline" sx={{ fontWeight: 'bold', letterSpacing: 1, mb: 1 }}>
                Trading
              </Typography>
              <div className="flex flex-col gap-1">
                {navigationConfig.trade.map((item) => (
                  <Button
                    key={item.path}
                    variant="text"
                    fullWidth
                    startIcon={<item.icon />}
                    component={Link}
                    href={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    sx={{
                      justifyContent: 'flex-start',
                      backgroundColor: location === item.path ? 'action.selected' : 'transparent'
                    }}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Services */}
            <div>
              <Typography variant="overline" sx={{ fontWeight: 'bold', letterSpacing: 1, mb: 1 }}>
                Services
              </Typography>
              <div className="flex flex-col gap-1">
                {navigationConfig.services.map((item) => (
                  <Button
                    key={item.path}
                    variant="text"
                    fullWidth
                    startIcon={<item.icon />}
                    component={Link}
                    href={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    sx={{
                      justifyContent: 'flex-start',
                      backgroundColor: location === item.path ? 'action.selected' : 'transparent'
                    }}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Our Projects */}
            <div>
              <Typography variant="overline" sx={{ fontWeight: 'bold', letterSpacing: 1, mb: 1 }}>
                Our Projects
              </Typography>
              <div className="flex flex-col gap-1">
                {navigationConfig.projects.map((item) => (
                  <Button
                    key={item.path}
                    variant="text"
                    fullWidth
                    startIcon={<item.icon />}
                    component={Link}
                    href={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    sx={{
                      justifyContent: 'flex-start',
                      backgroundColor: location === item.path ? 'action.selected' : 'transparent'
                    }}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* More */}
            <div>
              <Typography variant="overline" sx={{ fontWeight: 'bold', letterSpacing: 1, mb: 1 }}>
                More
              </Typography>
              <div className="flex flex-col gap-1">
                {navigationConfig.more.map((item) => (
                  <Button
                    key={item.path}
                    variant="text"
                    fullWidth
                    startIcon={<item.icon />}
                    component={Link}
                    href={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    sx={{
                      justifyContent: 'flex-start',
                      backgroundColor: location === item.path ? 'action.selected' : 'transparent'
                    }}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Drawer>

      {/* Search Modal */}
      <Backdrop
        open={isSearchOpen}
        onClick={() => setIsSearchOpen(false)}
        sx={{ zIndex: 150 }}
      />
      <Fade in={isSearchOpen}>
        <Paper
          ref={searchRef}
          sx={{
            position: 'fixed',
            top: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '100%',
            maxWidth: 400,
            mx: 2,
            zIndex: 200,
            boxShadow: 3,
            border: 2,
            borderColor: 'divider',
            maxHeight: 384,
            overflow: 'hidden'
          }}
        >
          <div className="p-4">
            <div className="relative mb-1.5">
              <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: 'text.secondary' }} />
              {/* Converted to MUI TextField for better accessibility and theming */}
              <Box sx={{ position: 'relative' }}>
                <Box component="input"
                  ref={searchInputRef as any}
                  placeholder="Search profiles, projects, pages..."
                  onChange={handleSearchInputChange}
                  onKeyDown={(e: any) => { if (e.key === 'Escape') setIsSearchOpen(false); }}
                  style={{
                    paddingLeft: 32,
                    paddingRight: 36,
                    height: 40,
                    width: '100%',
                    border: '1px solid',
                    borderColor: 'var(--mui-palette-divider)',
                    borderRadius: 4,
                    fontSize: 14,
                  }}
                  className="mui-textfield-reset"
                />
                {searchQuery && (
                  <IconButton
                    size="small"
                    onClick={handleClearSearch}
                    sx={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', p: 0.5 }}
                  >
                    <X />
                  </IconButton>
                )}
              </Box>
            </div>

            <div className="flex flex-wrap gap-1 mb-2">
              {filterButtons.map(({ key, label, icon: Icon }) => (
                <Chip
                  key={key}
                  icon={<Icon />}
                  label={label}
                  variant={selectedFilter === key ? "filled" : "outlined"}
                  size="small"
                  onClick={() => setSelectedFilter(key)}
                  sx={{ fontSize: 12, height: 28 }}
                />
              ))}
            </div>

            {showSearchResults && (
              <div className="max-h-64 overflow-y-auto">
                {searchLoading ? (
                  <div className="flex items-center justify-center py-2">
                    <Loader2 style={{ fontSize: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />
                    <Typography variant="body2" color="text.secondary">Searching...</Typography>
                  </div>
                ) : hasSearchError ? (
                  <div className="flex items-center justify-center py-2">
                    <div className="text-center">
                      <X style={{ fontSize: 24, color: 'error.main', marginBottom: 8 }} />
                      <Typography variant="body2" color="error.main">Search temporarily unavailable</Typography>
                    </div>
                  </div>
                ) : hasResults ? (
                  <div>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
                      Found {results.length} result{results.length !== 1 ? 's' : ''}
                    </Typography>
                    <div className="flex flex-col gap-1">
                      {results.slice(0, 8).map((result, index) => {
                        try {
                          const config = typeConfig[result.type] || typeConfig.page;
                          const Icon = config.icon;

                          return (
                            <Link
                              key={`${result.type}-${result.id}-${index}`}
                              href={result.url || '#'}
                              onClick={() => handleSearchResultClick(result)}
                              style={{ textDecoration: 'none' }}
                            >
                              <div className="flex items-start gap-1 p-1 rounded cursor-pointer transition-colors hover:bg-gray-100">
                                <Avatar
                                  src={result.image}
                                  sx={{ width: 32, height: 32 }}
                                  onError={(e) => {
                                    const target = e.currentTarget;
                                    target.style.display = 'none';
                                    target.nextElementSibling?.classList.remove('hidden');
                                  }}
                                >
                                  <Icon />
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1 mb-1">
                                    <Typography variant="body2" fontWeight="medium" sx={{ fontSize: 12 }}>
                                      {result.title || 'Untitled'}
                                    </Typography>
                                    <Chip
                                      label={config.label}
                                      size="small"
                                      sx={{
                                        fontSize: 10,
                                        height: 16,
                                        backgroundColor: config.color.split(' ')[0].replace('bg-', ''),
                                        color: config.color.split(' ')[1].replace('text-', '')
                                      }}
                                    />
                                  </div>
                                  <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                                    {result.description || 'No description available'}
                                  </Typography>
                                </div>
                                <ExternalLink style={{ fontSize: 12, color: 'text.secondary', flexShrink: 0 }} />
                              </div>
                            </Link>
                          );
                        } catch (error) {
                          console.error('Error rendering search result:', error);
                          return null;
                        }
                      }).filter(Boolean)}
                    </div>
                  </div>
                ) : searchQuery.trim().length >= 2 ? (
                  <div className="flex flex-col items-center justify-center py-2">
                    <Search style={{ fontSize: 24, color: 'text.secondary', marginBottom: 4 }} />
                    <Typography variant="caption" color="text.secondary" textAlign="center">
                      No results found
                    </Typography>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </Paper>
      </Fade>      {/* External Wallets Modal */}
      <WalletConnectionDashboard 
        isOpen={showWalletDashboard}
        onClose={() => setShowWalletDashboard(false)} 
      />
    </>
  );
}
