import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { 
  Search, 
  X, 
  User, 
  FolderOpen, 
  FileText, 
  Loader2,
  Hash,
  ExternalLink,
  Coins,
  Image
} from 'lucide-react';
import { debounce } from 'lodash';
import { cn } from '@/lib/utils';
// Material UI components for migration
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Fade from '@mui/material/Fade';

interface SearchResult {
  id: string;
  type: 'profile' | 'project' | 'page' | 'token' | 'nft';
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
  },
  token: {
    icon: Coins,
    label: 'Token',
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    bgColor: 'hover:bg-orange-50 dark:hover:bg-orange-950'
  },
  nft: {
    icon: Image,
    label: 'NFT',
    color: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
    bgColor: 'hover:bg-pink-50 dark:hover:bg-pink-950'
  }
};

const SearchBar: React.FC = () => {
  const [query, setQuery] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'profile' | 'project' | 'page' | 'token' | 'nft'>('all');
  const [selectedChain, setSelectedChain] = useState<string>('all');
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, navigate] = useLocation();

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce((searchQuery: string) => {
      if (searchQuery.trim()) {
        setQuery(searchQuery);
      }
    }, 300),
    []
  );

  // Real-time search query using comprehensive unified search
  const { data: searchResults, isLoading, error } = useQuery<SearchResponse>({
    queryKey: ['/api/search/unified', { q: query, type: selectedFilter, chain: selectedChain }],
    enabled: query.trim().length >= 2,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    refetchOnWindowFocus: false,
    queryFn: async () => {
      // Use comprehensive unified search for ALL types including tokens
      const chainParam = selectedChain !== 'all' ? `&chain=${selectedChain}` : '';
      const response = await fetch(`/api/search/unified?q=${encodeURIComponent(query)}&type=${selectedFilter}${chainParam}`);
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }
      
      return response.json();
    }
  });

  // Handle click outside to close search results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update dropdown position when search ref changes or window resizes/scrolls
  useEffect(() => {
    const updatePosition = () => {
      if (searchRef.current) {
        const rect = searchRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + 8,
          left: rect.left,
          width: rect.width
        });
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  // Handle search input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    
    if (value.trim().length >= 2) {
      debouncedSearch(value);
      setIsOpen(true);
    } else {
      setQuery('');
      setIsOpen(false);
    }
  };

  // Handle result click
  const handleResultClick = (result: SearchResult) => {
    // Track analytics
    if (query && result.id) {
      fetch('/api/search/analytics/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          result_id: result.id,
          result_type: result.type,
          search_session_id: `search_${Date.now()}`
        })
      }).catch(console.warn);
    }
    
    setIsOpen(false);
    if (inputRef.current) {
      inputRef.current.blur();
    }
  };

  // Clear search
  const handleClear = () => {
    setQuery('');
    setInputValue('');
    setIsOpen(false);
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.focus();
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const filterButtons = [
    { key: 'all' as const, label: 'All', icon: Hash },
    { key: 'token' as const, label: 'Tokens', icon: Coins },
    { key: 'profile' as const, label: 'Profiles', icon: User },
    { key: 'nft' as const, label: 'NFTs', icon: Image },
    { key: 'page' as const, label: 'Pages', icon: FileText }
  ];

  const chainOptions = [
    { value: 'all', label: 'All Chains', logo: null },
    { value: 'xrpl', label: 'XRPL', logo: 'https://dd.dexscreener.com/ds-data/chains/xrpl.png' },
    { value: 'ethereum', label: 'Ethereum', logo: 'https://dd.dexscreener.com/ds-data/chains/ethereum.png' },
    { value: 'bsc', label: 'BSC', logo: 'https://dd.dexscreener.com/ds-data/chains/bsc.png' },
    { value: 'polygon', label: 'Polygon', logo: 'https://dd.dexscreener.com/ds-data/chains/polygon.png' },
    { value: 'arbitrum', label: 'Arbitrum', logo: 'https://dd.dexscreener.com/ds-data/chains/arbitrum.png' },
    { value: 'optimism', label: 'Optimism', logo: 'https://dd.dexscreener.com/ds-data/chains/optimism.png' },
    { value: 'base', label: 'Base', logo: 'https://dd.dexscreener.com/ds-data/chains/base.png' },
    { value: 'avalanche', label: 'Avalanche', logo: 'https://dd.dexscreener.com/ds-data/chains/avalanche.png' },
    { value: 'fantom', label: 'Fantom', logo: 'https://dd.dexscreener.com/ds-data/chains/fantom.png' },
    { value: 'cronos', label: 'Cronos', logo: 'https://dd.dexscreener.com/ds-data/chains/cronos.png' },
    { value: 'gnosis', label: 'Gnosis', logo: 'https://dd.dexscreener.com/ds-data/chains/gnosis.png' },
    { value: 'celo', label: 'Celo', logo: 'https://dd.dexscreener.com/ds-data/chains/celo.png' },
    { value: 'moonbeam', label: 'Moonbeam', logo: 'https://dd.dexscreener.com/ds-data/chains/moonbeam.png' },
    { value: 'zksync', label: 'zkSync', logo: 'https://dd.dexscreener.com/ds-data/chains/zksync.png' },
    { value: 'linea', label: 'Linea', logo: 'https://dd.dexscreener.com/ds-data/chains/linea.png' },
    { value: 'solana', label: 'Solana', logo: 'https://dd.dexscreener.com/ds-data/chains/solana.png' },
    { value: 'bitcoin', label: 'Bitcoin', logo: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png' }
  ];

  const results = searchResults?.results || [];
  const hasResults = results.length > 0;
  const showResults = isOpen && inputValue.trim().length >= 2;

  return (
    <Box component="section" sx={{ width: '100%', borderBottom: '1px solid var(--border)', bgcolor: 'background.default' }} data-testid="search-bar-container">
      <Box sx={{ maxWidth: 1280, mx: 'auto', px: { xs: 1, lg: 2 }, py: 1.5 }}>
        <Box ref={searchRef} sx={{ position: 'relative', maxWidth: 960, mx: 'auto' }}>
          {/* Input */}
          <TextField
            inputRef={inputRef}
            placeholder="Search tokens, profiles, projects, pages..."
            fullWidth
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => { if (inputValue.trim().length >= 2) setIsOpen(true); }}
            variant="outlined"
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search className="h-4 w-4 text-muted-foreground" />
                </InputAdornment>
              ),
              endAdornment: inputValue ? (
                <InputAdornment position="end">
                  <IconButton aria-label="Clear search" onClick={handleClear} size="small" data-testid="button-clear-search">
                    <X className="h-4 w-4" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
            inputProps={{ 'data-testid': 'input-search', 'aria-label': 'Global search' }}
          />

          {/* Filters */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5 }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, flex: 1 }}>
              {filterButtons.map(({ key, label, icon: Icon }) => (
                <Chip
                  key={key}
                  label={label}
                  icon={<Icon className="h-3 w-3" />}
                  color={selectedFilter === key ? 'primary' : 'default'}
                  variant={selectedFilter === key ? 'filled' : 'outlined'}
                  size="small"
                  onClick={() => setSelectedFilter(key)}
                  data-testid={`button-filter-${key}`}
                  sx={{ fontSize: '0.65rem', height: 24 }}
                />
              ))}
            </Box>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <Select
                value={selectedChain}
                onChange={(e) => setSelectedChain(e.target.value)}
                displayEmpty
                data-testid="chain-selector"
                renderValue={(value) => {
                  if (value === 'all') return 'All Chains';
                  const chain = chainOptions.find(c => c.value === value);
                  return (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {chain?.logo && <Avatar src={chain.logo} alt={chain.label} sx={{ width: 18, height: 18 }} />}
                      <span>{chain?.label}</span>
                    </Box>
                  );
                }}
              >
                {chainOptions.map(c => (
                  <MenuItem key={c.value} value={c.value}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {c.logo && <Avatar src={c.logo} alt={c.label} sx={{ width: 18, height: 18 }} />}
                      <span>{c.label}</span>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* Results */}
          {showResults && (
            <Fade in={showResults}>
              <Paper elevation={6} sx={{ position: 'fixed', zIndex: 99999, top: dropdownPosition.top, left: dropdownPosition.left, width: dropdownPosition.width, maxHeight: 384, overflow: 'hidden', border: '2px solid var(--border)' }}>
                {isLoading ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }} data-testid="search-loading">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <Typography variant="caption" sx={{ ml: 1.5 }}>Searching...</Typography>
                  </Box>
                ) : error ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }} data-testid="search-error">
                    <Typography variant="body2" color="error">Search service unavailable</Typography>
                  </Box>
                ) : hasResults ? (
                  <Box sx={{ maxHeight: 320, overflowY: 'auto' }}>
                    <Box sx={{ px: 2, py: 1, bgcolor: 'action.hover', borderBottom: '1px solid var(--border)' }}>
                      <Typography variant="caption" color="text.secondary">
                        Found {results.length} result{results.length !== 1 ? 's' : ''} for "{query}"
                      </Typography>
                    </Box>
                    <Divider />
                    {results.map((result, index) => {
                      const config = typeConfig[result.type];
                      const Icon = config.icon;
                      return (
                        <Link
                          key={`${result.type}-${result.id}-${index}`}
                          href={result.url}
                          onClick={() => handleResultClick(result)}
                          data-testid={`search-result-${result.type}-${index}`}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, p: 1.5, cursor: 'pointer', ':hover': { bgcolor: 'action.hover' } }}>
                            {result.image ? (
                              <Avatar src={result.image} alt={result.title} sx={{ width: 40, height: 40 }} />
                            ) : (
                              <Avatar sx={{ width: 40, height: 40, bgcolor: 'action.selected' }}>
                                <Icon className="h-5 w-5" />
                              </Avatar>
                            )}
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                                <Typography variant="subtitle2" noWrap>{result.title}</Typography>
                                <Chip size="small" label={config.label} sx={{ fontSize: '0.6rem' }} />
                              </Box>
                              <Typography variant="caption" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {result.description}
                              </Typography>
                              {result.metadata && (
                                <Box sx={{ display: 'flex', gap: 0.75, mt: 0.75 }}>
                                  {result.type === 'project' && result.metadata.asset_type && (
                                    <Chip size="small" variant="outlined" label={result.metadata.asset_type} sx={{ fontSize: '0.55rem' }} />
                                  )}
                                  {result.type === 'page' && result.metadata.page_type && (
                                    <Chip size="small" variant="outlined" label={result.metadata.page_type} sx={{ fontSize: '0.55rem' }} />
                                  )}
                                </Box>
                              )}
                            </Box>
                            <Tooltip title="Open" placement="left" arrow>
                              <ExternalLink className="h-4 w-4 text-muted-foreground" />
                            </Tooltip>
                          </Box>
                        </Link>
                      );
                    })}
                    {results.length >= 10 && (
                      <Box sx={{ p: 1, borderTop: '1px solid var(--border)', bgcolor: 'action.hover' }}>
                        <Button
                          fullWidth
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            setIsOpen(false);
                            navigate(`/search?q=${encodeURIComponent(query)}&type=${selectedFilter}`);
                          }}
                          data-testid="link-view-all-results"
                        >
                          View all results for "{query}"
                        </Button>
                      </Box>
                    )}
                  </Box>
                ) : query.trim().length >= 2 ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 4 }} data-testid="search-no-results">
                    <Search className="h-8 w-8 text-muted-foreground mb-2" />
                    <Typography variant="body2" color="text.secondary" align="center">No results found for "{query}"</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>Try different keywords or check spelling</Typography>
                  </Box>
                ) : null}
              </Paper>
            </Fade>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default SearchBar;
