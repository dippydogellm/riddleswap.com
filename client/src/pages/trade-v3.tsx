import React, { useState, useEffect } from 'react';
import {
  Container,
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Tabs,
  Tab,
  InputAdornment,
  CircularProgress,
  Chip,
  Avatar,
  Alert,
  Divider,
  Paper,
  Dialog,
  DialogContent,
  DialogTitle,
  Slider,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  SwapVert,
  Settings,
  Wallet as WalletIcon,
  Search,
  TrendingUp,
  ArrowDownward,
  Close,
  Speed
} from '@mui/icons-material';
import { useToast } from '@/hooks/use-toast';
import { WalletConnectionDashboard } from '@/components/wallet-connection-dashboard';
import { useQuery } from '@tanstack/react-query';

type Chain = 'XRPL' | 'Ethereum' | 'BSC' | 'Polygon' | 'Arbitrum' | 'Optimism' | 'Base' | 'Avalanche';

interface Token {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  logoURI?: string;
  issuer?: string;
}

const CHAIN_IDS: Record<Chain, number> = {
  Ethereum: 1,
  BSC: 56,
  Polygon: 137,
  Arbitrum: 42161,
  Optimism: 10,
  Base: 8453,
  Avalanche: 43114,
  XRPL: 0
};

const NATIVE_TOKENS: Record<Chain, Token> = {
  XRPL: { symbol: 'XRP', name: 'XRP', address: 'XRP', decimals: 6 },
  Ethereum: { symbol: 'ETH', name: 'Ethereum', address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18 },
  BSC: { symbol: 'BNB', name: 'BNB', address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18 },
  Polygon: { symbol: 'MATIC', name: 'Polygon', address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18 },
  Arbitrum: { symbol: 'ETH', name: 'Ethereum', address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18 },
  Optimism: { symbol: 'ETH', name: 'Ethereum', address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18 },
  Base: { symbol: 'ETH', name: 'Ethereum', address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18 },
  Avalanche: { symbol: 'AVAX', name: 'Avalanche', address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18 }
};

export default function TradeV3Page() {
  const { toast } = useToast();
  const [chain, setChain] = useState<Chain>('Ethereum');
  const [tab, setTab] = useState<'swap' | 'limit' | 'liquidity'>('swap');
  const [fromToken, setFromToken] = useState<Token>(NATIVE_TOKENS.Ethereum);
  const [toToken, setToToken] = useState<Token | null>(null);
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [slippage, setSlippage] = useState(0.5);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [tokenSearchOpen, setTokenSearchOpen] = useState<'from' | 'to' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Token[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [quoteData, setQuoteData] = useState<any>(null);
  const [apiConnectionStatus, setApiConnectionStatus] = useState<{bithomp: boolean, oneInch: boolean} | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [autoTrustline, setAutoTrustline] = useState(true);
  const [tokenBalances, setTokenBalances] = useState<Record<string, string>>({});

  // Check for Riddle Wallet session with private keys using transactionAuth utility
  const { data: sessionData } = useQuery({
    queryKey: ['/api/riddle-wallet/session'],
    refetchInterval: 30000
  });

  const isRiddleWalletConnected = (sessionData as any)?.authenticated || false;
  const riddleWalletHandle = (sessionData as any)?.handle || null;
  const hasPrivateKeys = (sessionData as any)?.hasPrivateKeys || false;
  
  // Detect Xaman/Joey external wallets
  const [externalWalletType, setExternalWalletType] = useState<'xaman' | 'joey' | null>(null);
  useEffect(() => {
    const xamanConnected = localStorage.getItem('xrpl_wallet_connected') === 'true';
    const joeyConnected = localStorage.getItem('joey_wallet_connected') === 'true';
    if (xamanConnected) setExternalWalletType('xaman');
    else if (joeyConnected) setExternalWalletType('joey');
    else setExternalWalletType(null);
  }, []);

  // Check external wallet connections
  const { data: externalWalletsData } = useQuery({
    queryKey: ['/api/external-wallets/list'],
    enabled: isRiddleWalletConnected,
    refetchInterval: 30000
  });

  const externalWallets = (externalWalletsData as any)?.wallets || [];
  
  // Get wallet for current chain
  const getWalletForChain = () => {
    if (chain === 'XRPL') {
      return externalWallets.find((w: any) => w.chain === 'xrp' || w.chain === 'xrpl');
    } else {
      return externalWallets.find((w: any) => w.chain === 'eth' || w.chain === 'evm');
    }
  };

  const chainWallet = getWalletForChain();
  const hasWalletForChain = isRiddleWalletConnected || !!chainWallet;

  // Test API connections on mount
  useEffect(() => {
    const testConnections = async () => {
      const status = { bithomp: false, oneInch: false };
      
      // Test Bithomp
      try {
        const bithompRes = await fetch('/api/bithomp/xrp');
        status.bithomp = bithompRes.ok;
      } catch (e) {
        console.error('Bithomp connection test failed:', e);
      }
      
      // Test 1inch
      try {
        const oneInchRes = await fetch('https://api.1inch.dev/swap/v6.0/1/tokens', {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_ONEINCH_API_KEY || ''}`,
            'Accept': 'application/json'
          }
        });
        status.oneInch = oneInchRes.ok;
      } catch (e) {
        console.error('1inch connection test failed:', e);
      }
      
      setApiConnectionStatus(status);
      console.log('API Connection Status:', status);
    };
    
    testConnections();
  }, []);

  // Update native token when chain changes
  useEffect(() => {
    setFromToken(NATIVE_TOKENS[chain]);
    setToToken(null);
    setFromAmount('');
    setToAmount('');
    setQuoteData(null);
  }, [chain]);

  // Read query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qChain = params.get('chain');
    const qTab = params.get('tab');

    if (qChain) {
      const normalized = qChain.toLowerCase();
      const map: Record<string, Chain> = {
        xrpl: 'XRPL', ethereum: 'Ethereum', eth: 'Ethereum',
        bsc: 'BSC', polygon: 'Polygon', arbitrum: 'Arbitrum',
        optimism: 'Optimism', base: 'Base', avalanche: 'Avalanche'
      };
      const mapped = map[normalized];
      if (mapped) setChain(mapped);
    }

    if (qTab && (qTab === 'swap' || qTab === 'limit' || qTab === 'liquidity')) {
      setTab(qTab as any);
    }
  }, []);

  // Token search using Bithomp (XRPL) and 1inch (EVM)
  const searchTokens = async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      if (chain === 'XRPL') {
        // Use Bithomp token search API
        const response = await fetch(`/api/bithomp/tokens/search?query=${encodeURIComponent(query)}&limit=20`);
        const data = await response.json();
        
        if (data.success && data.tokens) {
          const tokens: Token[] = data.tokens.map((t: any) => ({
            symbol: t.currency || t.symbol,
            name: t.name || t.currency,
            address: t.currency,
            issuer: t.issuer,
            decimals: 6,
            logoURI: t.icon || t.logo
          }));
          setSearchResults(tokens);
        } else {
          throw new Error(data.error || 'Failed to search XRPL tokens');
        }
      } else {
        const chainId = CHAIN_IDS[chain];
        const response = await fetch(`https://api.1inch.dev/token/v1.2/${chainId}`, {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_ONEINCH_API_KEY || ''}`,
            'Accept': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          const tokens: Token[] = Object.entries(data).map(([address, info]: [string, any]) => ({
            symbol: info.symbol,
            name: info.name,
            address: address,
            decimals: info.decimals,
            logoURI: info.logoURI
          })).filter((t: Token) => 
            t.symbol.toLowerCase().includes(query.toLowerCase()) ||
            t.name.toLowerCase().includes(query.toLowerCase()) ||
            t.address.toLowerCase().includes(query.toLowerCase())
          ).slice(0, 20);
          
          setSearchResults(tokens);
        }
      }
    } catch (error) {
      toast({
        title: "Search Failed",
        description: "Could not fetch tokens. Check API connections.",
        variant: "destructive"
      });
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (tokenSearchOpen) {
        searchTokens(searchQuery);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, tokenSearchOpen, chain]);

  // Fetch token balances when wallet is connected
  useEffect(() => {
    const fetchBalances = async () => {
      if (!chainWallet?.address) {
        setTokenBalances({});
        return;
      }

      try {
        const chainParam = chain === 'XRPL' ? 'xrp' : 
                          chain === 'Ethereum' ? 'eth' :
                          chain === 'BSC' ? 'eth' :
                          chain === 'Polygon' ? 'eth' : 'eth';
        
        const response = await fetch(`/api/tradecenter/swap/balances/${chainWallet.address}?chain=${chainParam}`);
        const data = await response.json();
        
        if (data.success && data.balances) {
          const balanceMap: Record<string, string> = {};
          
          if (chain === 'XRPL') {
            // Add XRP balance
            balanceMap['XRP'] = data.balances.xrp || '0';
            
            // Add token balances
            if (data.balances.tokens) {
              data.balances.tokens.forEach((token: any) => {
                const key = token.issuer ? `${token.currency}.${token.issuer}` : token.currency;
                balanceMap[key] = token.balance || '0';
              });
            }
          }
          
          setTokenBalances(balanceMap);
        }
      } catch (error) {
        console.error('Failed to fetch balances:', error);
      }
    };

    fetchBalances();
    const interval = setInterval(fetchBalances, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [chainWallet?.address, chain]);

  useEffect(() => {
    const getQuote = async () => {
      if (!fromToken || !toToken || !fromAmount || parseFloat(fromAmount) <= 0) {
        setToAmount('');
        setQuoteData(null);
        return;
      }

      setIsLoadingQuote(true);
      try {
        // Map chain to API format
        const chainParam = chain === 'XRPL' ? 'xrp' : 
                          chain === 'Ethereum' ? 'eth' :
                          chain === 'BSC' ? 'eth' :
                          chain === 'Polygon' ? 'eth' :
                          chain === 'Arbitrum' ? 'eth' : 'eth';
        
        // Format token for API
        const fromTokenParam = chain === 'XRPL' 
          ? (fromToken.issuer ? `${fromToken.address}.${fromToken.issuer}` : fromToken.address)
          : fromToken.address;
          
        const toTokenParam = chain === 'XRPL'
          ? (toToken.issuer ? `${toToken.address}.${toToken.issuer}` : toToken.address)
          : toToken.address;
        
        // Use new unified Trade Center API with slippage
        const params = new URLSearchParams({
          fromToken: fromTokenParam,
          toToken: toTokenParam,
          amount: fromAmount,
          chain: chainParam,
          slippage: slippage.toString()
        });
        
        console.log(`🔍 Getting quote from Trade Center: ${fromAmount} ${fromToken.symbol} → ${toToken.symbol} on ${chain} (${slippage}% slippage)`);
        
        const response = await fetch(`/api/tradecenter/swap/quote?${params}`);
        const data = await response.json();
        
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to get swap quote');
        }
        
        const quote = data.quote;
        setToAmount(quote.toAmount);
        setQuoteData({
          ...quote,
          priceImpact: quote.priceImpact,
          route: quote.route,
          fee: quote.fee,
          dex: quote.dex || quote.route?.[0] || 'AMM'
        });
        
        console.log(`✅ Quote received: ${quote.toAmount} ${toToken.symbol} (${quote.priceImpact}% impact)`);
        
      } catch (error: any) {
        console.error('❌ Quote error:', error);
        setToAmount('');
        setQuoteData(null);
        
        // Only show error toast if it's not a rate limit or minor issue
        if (!error.message?.includes('429') && !error.message?.includes('rate limit')) {
          toast({
            title: "Quote Failed",
            description: error.message || "Could not get exchange rate",
            variant: "destructive"
          });
        }
      } finally {
        setIsLoadingQuote(false);
      }
    };

    const timer = setTimeout(getQuote, 800);
    return () => clearTimeout(timer);
  }, [fromAmount, fromToken, toToken, chain]);

  const handleSwap = async () => {
    if (!fromToken || !toToken || !fromAmount) {
      toast({
        title: "Invalid Swap",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    if (!hasWalletForChain) {
      toast({
        title: "Wallet Required",
        description: chain === 'XRPL' 
          ? "Connect Riddle Wallet or external XRPL wallet (Xaman/Joey)" 
          : "Connect Riddle Wallet or MetaMask/Phantom",
        variant: "destructive"
      });
      return;
    }

    if (chain === 'XRPL' && !hasPrivateKeys) {
      toast({
        title: "Private Keys Required",
        description: "Please unlock your Riddle Wallet to access private keys",
        variant: "destructive"
      });
      return;
    }

    setIsSwapping(true);
    try {
      const amount = (parseFloat(fromAmount) * Math.pow(10, fromToken.decimals)).toString();

      toast({
        title: "Swap Initiated",
        description: "Processing transaction..."
      });

      // Map chain to API format
      const chainParam = chain === 'XRPL' ? 'xrp' : 
                        chain === 'Ethereum' ? 'eth' :
                        chain === 'BSC' ? 'eth' :
                        chain === 'Polygon' ? 'eth' : 'eth';
      
      // Get wallet address
      const walletAddress = chainWallet?.address || '';
      
      if (!walletAddress) {
        throw new Error('Wallet address not found');
      }
      
      // Format tokens
      const fromTokenParam = chain === 'XRPL' 
        ? (fromToken.issuer ? `${fromToken.address}.${fromToken.issuer}` : fromToken.address)
        : fromToken.address;
        
      const toTokenParam = chain === 'XRPL'
        ? (toToken.issuer ? `${toToken.address}.${toToken.issuer}` : toToken.address)
        : toToken.address;
      
      console.log(`🚀 Executing swap via Trade Center: ${fromAmount} ${fromToken.symbol} → ${toToken.symbol}`);
      
      // Use new unified Trade Center API
      const response = await fetch('/api/tradecenter/swap/execute', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
        },
        body: JSON.stringify({
          fromToken: fromTokenParam,
          toToken: toTokenParam,
          amount: fromAmount,
          chain: chainParam,
          slippage: slippage,
          walletAddress: walletAddress
        })
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Swap execution failed');
      }

      const tx = result.transaction;
      
      toast({
        title: "Swap Successful! ✅",
        description: `Swapped ${fromAmount} ${fromToken.symbol} for ~${toAmount} ${toToken.symbol}`,
      });
      
      console.log(`✅ Swap complete:`, tx);

      setFromAmount('');
      setToAmount('');
      setQuoteData(null);
    } catch (error: any) {
      console.error('Swap error:', error);
      toast({
        title: "Swap Failed",
        description: error.message || "Transaction failed",
        variant: "destructive"
      });
    } finally {
      setIsSwapping(false);
    }
  };

  const handleTokenSelect = (token: Token) => {
    if (tokenSearchOpen === 'from') {
      setFromToken(token);
    } else if (tokenSearchOpen === 'to') {
      setToToken(token);
    }
    setTokenSearchOpen(null);
    setSearchQuery('');
    setSearchResults([]);
  };

  const switchTokens = () => {
    if (toToken) {
      const temp = fromToken;
      setFromToken(toToken);
      setToToken(temp);
      setFromAmount(toAmount);
      setToAmount(fromAmount);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      {/* API Connection Status */}
      {apiConnectionStatus && (!apiConnectionStatus.bithomp || !apiConnectionStatus.oneInch) && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <strong>API Connection Issues:</strong>
          {!apiConnectionStatus.bithomp && ' Bithomp API not responding.'}
          {!apiConnectionStatus.oneInch && ' 1inch API not responding.'}
          {' '}Check environment variables: BITHOMP_API_KEY, VITE_ONEINCH_API_KEY
        </Alert>
      )}
      
      {apiConnectionStatus?.bithomp && apiConnectionStatus?.oneInch && (
        <Alert severity="success" sx={{ mb: 2 }}>
          ✅ All APIs connected: Bithomp (XRPL) & 1inch (EVM chains)
        </Alert>
      )}
      
      <Box mb={3}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          Trade Center V3
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Multi-chain trading powered by 1inch & Bithomp APIs
        </Typography>
      </Box>

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" gap={2} alignItems="center" mb={3} flexWrap="wrap">
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Chain</InputLabel>
              <Select
                value={chain}
                label="Chain"
                onChange={(e) => setChain(e.target.value as Chain)}
              >
                <MenuItem value="XRPL">XRPL</MenuItem>
                <MenuItem value="Ethereum">Ethereum</MenuItem>
                <MenuItem value="BSC">BSC</MenuItem>
                <MenuItem value="Polygon">Polygon</MenuItem>
                <MenuItem value="Arbitrum">Arbitrum</MenuItem>
                <MenuItem value="Optimism">Optimism</MenuItem>
                <MenuItem value="Base">Base</MenuItem>
                <MenuItem value="Avalanche">Avalanche</MenuItem>
              </Select>
            </FormControl>

            {chain === 'XRPL' && (
              <Tabs value={tab} onChange={(_, v) => setTab(v)}>
                <Tab value="swap" label="Swap" />
                <Tab value="limit" label="Limit" />
                <Tab value="liquidity" label="Liquidity" />
              </Tabs>
            )}

            <Box flexGrow={1} />

            <IconButton onClick={() => setSettingsOpen(true)} size="small">
              <Settings />
            </IconButton>

            <Box flex={1} />

            <Box display="flex" gap={1} alignItems="center">
              {isRiddleWalletConnected ? (
                <>
                  <Chip
                    icon={<WalletIcon />}
                    label={riddleWalletHandle}
                    color="success"
                    variant="outlined"
                    size="small"
                  />
                  {!hasPrivateKeys && chain === 'XRPL' && (
                    <Chip
                      label="Keys Locked"
                      color="warning"
                      size="small"
                      variant="outlined"
                    />
                  )}
                </>
              ) : (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => window.location.href = '/wallet-login'}
                >
                  Riddle Wallet
                </Button>
              )}
              
              {chainWallet && (
                <Chip
                  label={`${chainWallet.wallet_type} Connected`}
                  color="primary"
                  size="small"
                  variant="filled"
                />
              )}
            </Box>

            <Button
              variant="contained"
              size="small"
              startIcon={<WalletIcon />}
              onClick={() => setWalletModalOpen(true)}
            >
              External Wallets
            </Button>
          </Box>

          <Divider sx={{ my: 2 }} />

          {tab === 'swap' && (
            <Box>
              <Paper variant="outlined" sx={{ p: 2, mb: 1, bgcolor: 'background.default' }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="caption" color="text.secondary" fontWeight="bold">
                    From
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Balance: {(() => {
                      const key = fromToken.issuer ? `${fromToken.address}.${fromToken.issuer}` : fromToken.address;
                      const balance = tokenBalances[key] || tokenBalances[fromToken.address] || '0';
                      return parseFloat(balance).toFixed(4);
                    })()}
                  </Typography>
                </Box>
                
                <Box display="flex" gap={2} alignItems="center">
                  <TextField
                    fullWidth
                    placeholder="0.00"
                    type="number"
                    value={fromAmount}
                    onChange={(e) => setFromAmount(e.target.value)}
                    InputProps={{
                      sx: { fontSize: '1.5rem', fontWeight: 'bold' }
                    }}
                    variant="standard"
                  />
                  
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setTokenSearchOpen('from');
                      setSearchQuery('');
                    }}
                    sx={{ minWidth: 140, height: 48 }}
                  >
                    {fromToken.logoURI && (
                      <Avatar src={fromToken.logoURI} sx={{ width: 24, height: 24, mr: 1 }} />
                    )}
                    <Typography variant="body2" fontWeight="bold">
                      {fromToken.symbol}
                    </Typography>
                  </Button>
                </Box>
              </Paper>

              <Box display="flex" justifyContent="center" my={-1.5} position="relative" zIndex={1}>
                <IconButton
                  onClick={switchTokens}
                  disabled={!toToken}
                  sx={{
                    bgcolor: 'background.paper',
                    border: '4px solid',
                    borderColor: 'background.default',
                    '&:hover': { bgcolor: 'action.hover' }
                  }}
                >
                  <ArrowDownward />
                </IconButton>
              </Box>

              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="caption" color="text.secondary" fontWeight="bold">
                    To (estimated)
                  </Typography>
                  {isLoadingQuote ? (
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <CircularProgress size={12} />
                      <Typography variant="caption" color="text.secondary">
                        Getting quote...
                      </Typography>
                    </Box>
                  ) : toToken && (
                    <Typography variant="caption" color="text.secondary">
                      Balance: {(() => {
                        const key = toToken.issuer ? `${toToken.address}.${toToken.issuer}` : toToken.address;
                        const balance = tokenBalances[key] || tokenBalances[toToken.address] || '0';
                        return parseFloat(balance).toFixed(4);
                      })()}
                    </Typography>
                  )}
                </Box>
                
                <Box display="flex" gap={2} alignItems="center">
                  <TextField
                    fullWidth
                    placeholder="0.00"
                    type="number"
                    value={toAmount}
                    InputProps={{
                      readOnly: true,
                      sx: { fontSize: '1.5rem', fontWeight: 'bold' }
                    }}
                    variant="standard"
                  />
                  
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setTokenSearchOpen('to');
                      setSearchQuery('');
                    }}
                    sx={{ minWidth: 140, height: 48 }}
                  >
                    {toToken ? (
                      <>
                        {toToken.logoURI && (
                          <Avatar src={toToken.logoURI} sx={{ width: 24, height: 24, mr: 1 }} />
                        )}
                        <Typography variant="body2" fontWeight="bold">
                          {toToken.symbol}
                        </Typography>
                      </>
                    ) : (
                      <Typography variant="body2">Select token</Typography>
                    )}
                  </Button>
                </Box>
              </Paper>

              {quoteData && toToken && (
                <Paper variant="outlined" sx={{ p: 2, mt: 2, bgcolor: 'info.light' }}>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="caption">Rate</Typography>
                    <Typography variant="caption" fontWeight="bold">
                      1 {fromToken.symbol} ≈ {(parseFloat(toAmount) / parseFloat(fromAmount || '1')).toFixed(6)} {toToken.symbol}
                    </Typography>
                  </Box>
                  
                  {quoteData.minimumReceived && (
                    <Box display="flex" justifyContent="space-between" mb={1}>
                      <Typography variant="caption">Minimum Received</Typography>
                      <Typography variant="caption" fontWeight="bold" color="success.main">
                        {quoteData.minimumReceived} {toToken.symbol}
                      </Typography>
                    </Box>
                  )}
                  
                  {quoteData.priceImpact !== undefined && (
                    <Box display="flex" justifyContent="space-between" mb={1}>
                      <Typography variant="caption">Price Impact</Typography>
                      <Typography 
                        variant="caption" 
                        fontWeight="bold"
                        color={
                          quoteData.priceImpact < 1 ? 'success.main' :
                          quoteData.priceImpact < 3 ? 'warning.main' : 'error.main'
                        }
                      >
                        {quoteData.priceImpact.toFixed(2)}%
                      </Typography>
                    </Box>
                  )}
                  
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="caption">Slippage Tolerance</Typography>
                    <Typography variant="caption" fontWeight="bold">{slippage}%</Typography>
                  </Box>
                  
                  {quoteData.fee && (
                    <Box display="flex" justifyContent="space-between" mb={1}>
                      <Typography variant="caption">Trading Fee</Typography>
                      <Typography variant="caption" fontWeight="bold">{quoteData.fee}</Typography>
                    </Box>
                  )}
                  
                  {quoteData.dex && (
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="caption">Route</Typography>
                      <Typography variant="caption" fontWeight="bold">{quoteData.dex}</Typography>
                    </Box>
                  )}
                </Paper>
              )}

              <Button
                fullWidth
                variant="contained"
                size="large"
                onClick={handleSwap}
                disabled={!fromToken || !toToken || !fromAmount || isSwapping || isLoadingQuote || !hasWalletForChain}
                sx={{ mt: 3, py: 1.5 }}
              >
                {isSwapping ? (
                  <CircularProgress size={24} color="inherit" />
                ) : !hasWalletForChain ? (
                  `Connect ${chain} Wallet to Swap`
                ) : chain === 'XRPL' && !hasPrivateKeys ? (
                  'Unlock Riddle Wallet to Swap'
                ) : (
                  `Swap ${fromToken.symbol} for ${toToken?.symbol || '...'}`
                )}
              </Button>
              
              {!hasWalletForChain && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  {chain === 'XRPL' 
                    ? "Connect your Riddle Wallet or an external XRPL wallet (Xaman/Joey) to start trading"
                    : "Connect your Riddle Wallet or MetaMask to start trading on " + chain
                  }
                </Alert>
              )}
            </Box>
          )}

          {chain === 'XRPL' && tab === 'limit' && (
            <Alert severity="info">
              Limit orders coming soon for XRPL DEX
            </Alert>
          )}

          {chain === 'XRPL' && tab === 'liquidity' && (
            <Alert severity="info">
              Liquidity provision coming soon for XRPL AMM
            </Alert>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={tokenSearchOpen !== null}
        onClose={() => setTokenSearchOpen(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Select Token</Typography>
            <IconButton size="small" onClick={() => setTokenSearchOpen(null)}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            placeholder="Search by name, symbol, or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
              endAdornment: isSearching && (
                <InputAdornment position="end">
                  <CircularProgress size={20} />
                </InputAdornment>
              )
            }}
            sx={{ mb: 2 }}
          />

          <Box>
            <Paper
              variant="outlined"
              sx={{ p: 2, mb: 1, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
              onClick={() => handleTokenSelect(NATIVE_TOKENS[chain])}
            >
              <Box display="flex" alignItems="center" gap={2}>
                <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                  {NATIVE_TOKENS[chain].symbol[0]}
                </Avatar>
                <Box>
                  <Typography variant="body1" fontWeight="bold">
                    {NATIVE_TOKENS[chain].symbol}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {NATIVE_TOKENS[chain].name}
                  </Typography>
                </Box>
              </Box>
            </Paper>

            {searchResults.map((token, idx) => (
              <Paper
                key={idx}
                variant="outlined"
                sx={{ p: 2, mb: 1, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                onClick={() => handleTokenSelect(token)}
              >
                <Box display="flex" alignItems="center" gap={2}>
                  {token.logoURI ? (
                    <Avatar src={token.logoURI} sx={{ width: 32, height: 32 }} />
                  ) : (
                    <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
                      {token.symbol[0]}
                    </Avatar>
                  )}
                  <Box flex={1}>
                    <Typography variant="body1" fontWeight="bold">
                      {token.symbol}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {token.name}
                    </Typography>
                  </Box>
                  <Chip label={token.address.slice(0, 6)} size="small" />
                </Box>
              </Paper>
            ))}

            {searchQuery && !isSearching && searchResults.length === 0 && (
              <Alert severity="info">No tokens found for "{searchQuery}"</Alert>
            )}
          </Box>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={1}>
              <Settings />
              <Typography variant="h6">Swap Settings</Typography>
            </Box>
            <IconButton size="small" onClick={() => setSettingsOpen(false)}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box py={2}>
            <Typography variant="subtitle2" gutterBottom display="flex" alignItems="center" gap={1}>
              <Speed fontSize="small" />
              Slippage Tolerance
            </Typography>
            <Box px={2} py={3}>
              <Slider
                value={slippage}
                onChange={(_, value) => setSlippage(value as number)}
                min={0.1}
                max={5}
                step={0.1}
                marks={[
                  { value: 0.1, label: '0.1%' },
                  { value: 0.5, label: '0.5%' },
                  { value: 1, label: '1%' },
                  { value: 3, label: '3%' },
                  { value: 5, label: '5%' }
                ]}
                valueLabelDisplay="on"
                valueLabelFormat={(value) => `${value}%`}
              />
            </Box>
            <Alert severity="info" sx={{ mt: 2 }}>
              Your transaction will revert if the price changes unfavorably by more than {slippage}%
            </Alert>

            {chain === 'XRPL' && (
              <>
                <Divider sx={{ my: 3 }} />
                <FormControlLabel
                  control={
                    <Switch
                      checked={autoTrustline}
                      onChange={(e) => setAutoTrustline(e.target.checked)}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight="bold">
                        Auto-Trustline
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Automatically create trustlines for XRPL tokens before swapping
                      </Typography>
                    </Box>
                  }
                />
              </>
            )}
          </Box>
        </DialogContent>
      </Dialog>

      <WalletConnectionDashboard
        isOpen={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
      />
    </Container>
  );
}
