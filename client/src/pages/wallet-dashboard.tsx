import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMetadata } from '@/hooks/use-metadata';
import '@/styles/wallet-dashboard.css';

// TypeScript declarations for wallet providers
interface CustomSolanaProvider {
  isPhantom?: boolean;
  connect: () => Promise<{ publicKey: { toString: () => string } }>;
  signMessage: (message: Uint8Array, encoding: string) => Promise<{ signature: Uint8Array }>;
}

declare global {
  interface Window {
    customPhantom?: {
      solana?: CustomSolanaProvider;
    };
    customSolana?: CustomSolanaProvider;
  }
}
import { apiRequest, queryClient } from '@/lib/queryClient';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import LinearProgress from '@mui/material/LinearProgress';
import CircularProgress from '@mui/material/CircularProgress';
import InputAdornment from '@mui/material/InputAdornment';
import { 
  Wallet, 
  TrendingUp, 
  RefreshCw, 
  Send, 
  Download,
  ArrowUpDown,
  QrCode,
  Copy,
  Check,
  Globe,
  Shield,
  Activity,
  DollarSign,
  Link,
  Search,
  Plus,
  ExternalLink,
  Settings,
  X
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { fetchChainBalance } from '@/lib/balance-fetcher';
import { QuickSwap } from '@/components/wallet/QuickSwap';
import { QuickBridge } from '@/components/wallet/QuickBridge';
import { PaymentQRCode } from '@/components/wallet/PaymentQRCode';
import { ChainLogo } from '@/components/ChainLogo';
import { PrivateKeyModal } from '@/components/wallet/PrivateKeyModal';
import { ImportWalletModal } from '@/components/wallet/ImportWalletModal';
import { WalletQRModal } from '@/components/wallet-qr-modal';
import { RDLBank } from '@/components/RDLBank';
import { SimplifiedWalletDashboard } from '@/components/wallet/SimplifiedWalletDashboard';

const CHAIN_INFO = {
  xrp: { 
    name: 'XRP Ledger', 
    icon: '/images/chains/xrp-logo.png', 
    color: 'bg-blue-500', 
    symbol: 'XRP',
    fallback: 'XRP',
    usesEthAddress: false,
    description: 'The XRP Ledger is a decentralized cryptographic ledger powered by a network of peer-to-peer servers.'
  },
  eth: { 
    name: 'Ethereum', 
    icon: '/images/chains/ethereum-logo.png', 
    color: 'bg-green-500', 
    symbol: 'ETH',
    fallback: 'ETH',
    usesEthAddress: true,
    description: 'Ethereum is a decentralized platform that runs smart contracts and decentralized applications.'
  },
  arbitrum: { 
    name: 'Arbitrum One', 
    icon: '/images/chains/arbitrum-logo.png', 
    color: 'bg-blue-600', 
    symbol: 'ETH',
    fallback: 'ARB',
    usesEthAddress: true,
    description: 'Arbitrum is a Layer 2 scaling solution that provides faster and cheaper Ethereum transactions.'
  },
  optimism: { 
    name: 'Optimism', 
    icon: '/images/chains/optimism-logo.png', 
    color: 'bg-red-500', 
    symbol: 'ETH',
    fallback: 'OP',
    usesEthAddress: true,
    description: 'Optimism is an optimistic rollup that scales Ethereum with instant transactions and low fees.'
  },
  base: { 
    name: 'Base', 
    icon: '/images/chains/base-logo.png', 
    color: 'bg-blue-600', 
    symbol: 'ETH',
    fallback: 'BASE',
    usesEthAddress: true,
    description: 'Base is a secure, low-cost, builder-friendly Ethereum L2 built by Coinbase.'
  },
  polygon: { 
    name: 'Polygon', 
    icon: '/images/chains/polygon-logo.png', 
    color: 'bg-purple-600', 
    symbol: 'MATIC',
    fallback: 'MATIC',
    usesEthAddress: true,
    description: 'Polygon is a decentralized Ethereum scaling platform that enables developers to build scalable user-friendly dApps.'
  },
  zksync: { 
    name: 'zkSync Era', 
    icon: '/images/chains/zksync-logo.png', 
    color: 'bg-gray-700', 
    symbol: 'ETH',
    fallback: 'ZK',
    usesEthAddress: true,
    description: 'zkSync Era is a Layer 2 scaling solution that uses zero-knowledge proofs to scale Ethereum.'
  },
  linea: { 
    name: 'Linea', 
    icon: '/images/chains/linea-logo.png', 
    color: 'bg-black', 
    symbol: 'ETH',
    fallback: 'LINEA',
    usesEthAddress: true,
    description: 'Linea is a developer-ready zkEVM rollup, scaling Ethereum by providing an equivalent experience to Ethereum.'
  },
  taiko: { 
    name: 'Taiko', 
    icon: '/images/chains/taiko-logo.png', 
    color: 'bg-pink-600', 
    symbol: 'ETH',
    fallback: 'TAIKO',
    usesEthAddress: true,
    description: 'Taiko is a fully decentralized, Ethereum-equivalent ZK-Rollup that scales Ethereum.'
  },
  unichain: { 
    name: 'Unichain', 
    icon: '/images/chains/unichain-logo.png', 
    color: 'bg-pink-500', 
    symbol: 'ETH',
    fallback: 'UNI',
    usesEthAddress: true,
    description: 'Unichain is a fast, low-cost Ethereum L2 designed to be the home for DeFi and liquidity.'
  },
  soneium: { 
    name: 'Soneium', 
    icon: '/images/chains/soneium-logo.png', 
    color: 'bg-blue-500', 
    symbol: 'ETH',
    fallback: 'SON',
    usesEthAddress: true,
    description: 'Soneium is Sony\'s versatile general-purpose blockchain designed for Web3 innovation.'
  },
  mantle: { 
    name: 'Mantle Network', 
    icon: '/images/chains/mantle-logo.png', 
    color: 'bg-green-600', 
    symbol: 'MNT',
    fallback: 'MNT',
    usesEthAddress: true,
    description: 'Mantle Network is a high-performance Ethereum Layer 2 network built with modular architecture.'
  },
  metis: { 
    name: 'Metis Andromeda', 
    icon: '/images/chains/metis-logo.png', 
    color: 'bg-cyan-500', 
    symbol: 'METIS',
    fallback: 'METIS',
    usesEthAddress: true,
    description: 'Metis is an Ethereum Layer 2 scaling solution focused on easy migration and fast transaction speeds.'
  },
  scroll: { 
    name: 'Scroll', 
    icon: '/images/chains/scroll-logo.png', 
    color: 'bg-orange-600', 
    symbol: 'ETH',
    fallback: 'SCROLL',
    usesEthAddress: true,
    description: 'Scroll is a zkEVM-based zkRollup on Ethereum that enables native compatibility for existing applications.'
  },
  bnb: { 
    name: 'BNB Smart Chain', 
    icon: '/images/chains/bnb-logo.png', 
    color: 'bg-yellow-500', 
    symbol: 'BNB',
    fallback: 'BNB',
    usesEthAddress: true,
    description: 'BNB Smart Chain is a blockchain network built for running smart contract-based applications.'
  },
  avax: { 
    name: 'Avalanche C-Chain', 
    icon: '/images/chains/avalanche-logo.png', 
    color: 'bg-red-500', 
    symbol: 'AVAX',
    fallback: 'AVAX',
    usesEthAddress: true,
    description: 'Avalanche is a smart contracts platform that scales infinitely and processes 4,500+ transactions per second.'
  },
  sol: { 
    name: 'Solana', 
    icon: '/images/chains/solana-logo.png', 
    color: 'bg-purple-500', 
    symbol: 'SOL',
    fallback: 'SOL',
    usesEthAddress: false,
    description: 'Solana is a high-performance blockchain supporting builders around the world creating crypto apps that scale.'
  },
  btc: { 
    name: 'Bitcoin', 
    icon: '/images/chains/bitcoin-logo.png', 
    color: 'bg-orange-500', 
    symbol: 'BTC',
    fallback: 'BTC',
    usesEthAddress: false,
    description: 'Bitcoin is a decentralized digital currency that enables instant payments to anyone, anywhere in the world.'
  }
};

// External Wallet Connections Component
const ExternalWalletConnectionsCard = () => {
  // ALL HOOKS MUST BE BEFORE ANY CONDITIONAL RETURNS
  const [showAllWallets, setShowAllWallets] = useState(false);
  
  // Fetch external wallets
  const { data: externalWalletsResponse, isLoading: isLoadingExternalWallets } = useQuery({
    queryKey: ['/api/external-wallets/list'],
  });

  // Derived state (after all hooks, before any returns)
  const externalWallets = (externalWalletsResponse as { wallets?: any[] })?.wallets || [];

  // Helper functions (no hooks here)
  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  };

  const getWalletIcon = (walletType: string) => {
    const icons: Record<string, string> = {
      metamask: '/images/wallets/metamask-logo.png',
      phantom: '/images/wallets/phantom-logo.png',
      xaman: '/images/wallets/xaman-logo.png',
      joey: '/images/wallets/joey-logo.png'
    };
    return icons[walletType] || '/images/wallets/default-wallet.png';
  };

  const getChainColor = (chain: string) => {
    const colors: Record<string, string> = {
      evm: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      eth: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', // Ethereum
      sol: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      xrp: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      btc: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200', // Bitcoin
      arbitrum: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      optimism: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      polygon: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      bsc: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
    };
    return colors[chain] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  };

  const visibleWallets = showAllWallets ? externalWallets : externalWallets.slice(0, 3);

  if (isLoadingExternalWallets) {
    return (
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-20">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!externalWallets || externalWallets.length === 0) {
    return null; // Don't show the card if no external wallets
  }

  return (
    <Card sx={{ mb: 4, background: 'linear-gradient(145deg, rgba(59, 130, 246, 0.05) 0%, rgba(147, 51, 234, 0.05) 100%)' }}>
      <CardHeader
        title={
          <Stack direction="row" alignItems="center" spacing={2}>
            <Link className="h-5 w-5 text-blue-600" />
            <Typography variant="h6">External Wallet Connections</Typography>
            <Chip 
              label={`${externalWallets.length} Active`}
              color="success"
              size="small"
            />
          </Stack>
        }
        subheader="External wallets connected for cross-chain trading and DeFi operations"
      />
      <CardContent>
        <Stack spacing={2}>
          {visibleWallets.map((wallet: any) => (
            <Paper 
              key={wallet.id} 
              elevation={2}
              sx={{ 
                p: 2, 
                borderRadius: 2,
                background: 'linear-gradient(145deg, rgba(255,255,255,0.9) 0%, rgba(243,244,246,0.9) 100%)',
                '&:hover': {
                  elevation: 4,
                  transform: 'translateY(-2px)',
                  transition: 'all 0.3s ease'
                }
              }}
              data-testid={`external-wallet-${wallet.id}`}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Box position="relative">
                    <Avatar 
                      src={getWalletIcon(wallet.wallet_type)}
                      alt={wallet.wallet_type}
                      sx={{ width: 48, height: 48 }}
                    />
                    <Box
                      sx={{
                        position: 'absolute',
                        bottom: -2,
                        right: -2,
                        width: 16,
                        height: 16,
                        bgcolor: 'success.main',
                        borderRadius: '50%',
                        border: 2,
                        borderColor: 'background.paper'
                      }}
                    />
                  </Box>
                  <Box>
                    <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
                      <Typography variant="subtitle1" fontWeight="bold" sx={{ textTransform: 'capitalize' }}>
                        {wallet.wallet_type}
                      </Typography>
                      <Chip label={wallet.chain.toUpperCase()} size="small" color="primary" />
                      {wallet.verified && (
                        <Chip label="Verified" size="small" color="success" />
                      )}
                    </Stack>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                        {formatAddress(wallet.address)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">•</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Connected {new Date(wallet.connected_at).toLocaleDateString()}
                      </Typography>
                    </Stack>
                  </Box>
                </Stack>
                <Chip 
                  icon={<Activity size={14} />}
                  label="Active"
                  color="success"
                  variant="outlined"
                />
              </Stack>
            </Paper>
          ))}
          
          {externalWallets.length > 3 && (
            <Button
              variant="outlined"
              fullWidth
              onClick={() => setShowAllWallets(!showAllWallets)}
              data-testid="button-toggle-external-wallets"
            >
              {showAllWallets ? 'Show Less' : `Show All ${externalWallets.length} Connections`}
            </Button>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default function WalletDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedChain, setSelectedChain] = useState('xrp');

  // Set wallet dashboard metadata - uses STATIC_PAGE_METADATA
  useMetadata();
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [showPrivateKeyModal, setShowPrivateKeyModal] = useState(false);
  const [showImportWalletModal, setShowImportWalletModal] = useState(false);
  const [linkedProjects, setLinkedProjects] = useState<any[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [connectingWallet, setConnectingWallet] = useState<string | null>(null);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrData, setQrData] = useState<any>(null);
  const [pollResult, setPollResult] = useState<any>(null);

  const queryClient = useQueryClient();

  // Use unified authentication to get wallet addresses - don't redirect to login
  const { authData, isLoading: authLoading, isAuthenticated, walletData, walletAddresses } = useAuth(false);
  
  const sessionToken = authData?.sessionToken;

  // Load external wallets from database
  const { data: externalWalletsData, isLoading: externalWalletsLoading, refetch: refetchExternalWallets } = useQuery({
    queryKey: ['/api/external-wallets/list'],
    enabled: !!sessionToken,
  });

  const externalWallets = (externalWalletsData as { wallets?: any[] })?.wallets || [];

  // Load linked wallets from database
  const { data: linkedWallets = [], isLoading: linkedWalletsLoading, refetch: refetchLinkedWallets } = useQuery<any[]>({
    queryKey: ['/api/linked-wallets'],
    enabled: !!sessionToken,
    staleTime: 30000
  });

  // Disconnect external wallet mutation
  const disconnectWalletMutation = useMutation({
    mutationFn: async (walletId: number) => {
      return apiRequest(`/api/external-wallets/${walletId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/external-wallets/list'] });
      toast({
        title: "Wallet Disconnected",
        description: "External wallet has been disconnected from your account",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to Disconnect",
        description: error.message || "Failed to disconnect wallet",
        variant: "destructive"
      });
    }
  });

  // Get wallet addresses from session (simplified portfolio approach) - MUST be before early returns
  const [portfolioData, setPortfolioData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Get actual user wallet addresses from session
  const xrpAddress = walletAddresses?.xrp;
  const ethAddress = walletAddresses?.eth;
  const solAddress = walletAddresses?.sol;
  const btcAddress = walletAddresses?.btc;

  // REMOVED: Authentication check is already handled by AuthGuard wrapper
  // This was causing infinite redirect loop when AuthGuard and useAuth had different states

  // Fetch linked projects for all connected wallets - MOVED BEFORE EARLY RETURN
  useEffect(() => {
    if (!sessionToken || !isAuthenticated) return;
    
    const fetchLinkedProjects = async () => {
      setProjectsLoading(true);
      try {
        const response = await fetch('/api/wallet-project-links/auto-detect-projects', {
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${sessionToken}`
          }
        });
        
        if (response.ok) {
          const data = await response.json() as any;
          setLinkedProjects(data.projects || []);
          console.log(`🔗 Found ${data.projects?.length || 0} linked projects`);
        } else {
          console.log('❌ Failed to auto-detect projects:', response.status);
        }
      } catch (error) {
        console.error('Error fetching linked projects:', error);
      } finally {
        setProjectsLoading(false);
      }
    };

    fetchLinkedProjects();
  }, [sessionToken, isAuthenticated]);

  // Simple portfolio data fetch using direct balance endpoints with real user addresses - MOVED BEFORE EARLY RETURN
  useEffect(() => {
    if (!sessionToken || !xrpAddress) return;

    const fetchPortfolioData = async () => {
      console.log('📊 [WALLET DASHBOARD] Fetching portfolio from separate endpoints...');
      console.log('🔗 [WALLET DASHBOARD] Using addresses:', { xrpAddress, ethAddress, solAddress, btcAddress });
      setIsLoading(true);
      
      try {
        // Build fetch promises for addresses that exist
        const fetchPromises: Promise<Response>[] = [];
        const chains: string[] = [];

        if (xrpAddress) {
          fetchPromises.push(fetch(`/api/wallets/xrp/balance/${xrpAddress}`, {
            headers: { 'Authorization': `Bearer ${sessionToken}` }
          }));
          chains.push('xrp');
        }

        if (ethAddress) {
          // Only fetch balances for chains with actual endpoints
          // Other EVM chains will show zero balance (no fallback to ETH)
          const workingEvmChains = ['eth', 'arbitrum', 'optimism', 'base', 'polygon', 'bnb', 'linea', 'zksync'];
          
          for (const chain of workingEvmChains) {
            fetchPromises.push(fetch(`/api/wallets/${chain}/balance/${ethAddress}`, {
              headers: { 'Authorization': `Bearer ${sessionToken}` }
            }));
            chains.push(chain);
          }
        }

        if (solAddress) {
          fetchPromises.push(fetch(`/api/wallets/sol/balance/${solAddress}`, {
            headers: { 'Authorization': `Bearer ${sessionToken}` }
          }));
          chains.push('sol');
        }

        if (btcAddress) {
          fetchPromises.push(fetch(`/api/wallets/btc/balance/${btcAddress}`, {
            headers: { 'Authorization': `Bearer ${sessionToken}` }
          }));
          chains.push('btc');
        }

        const responses = await Promise.allSettled(fetchPromises);

        const portfolio: any = { chains: {}, totalValue: 0 };
        let responseIndex = 0;

        // Process responses in the order they were added
        for (let i = 0; i < chains.length; i++) {
          const chain = chains[i];
          const response = responses[i];
          
          if (response.status === 'fulfilled' && response.value.ok) {
            try {
              const data = await response.value.json();
              // Use correct address for each chain type
              const evmChains = ['eth', 'arbitrum', 'optimism', 'base', 'polygon', 'bnb', 'zksync', 'linea', 'taiko', 'unichain', 'soneium', 'mantle', 'metis', 'scroll', 'avax'];
              const address = chain === 'xrp' ? xrpAddress : 
                            chain === 'sol' ? solAddress :
                            chain === 'btc' ? btcAddress :
                            evmChains.includes(chain) ? ethAddress : ethAddress; // All EVM chains use ETH address
              
              portfolio.chains[chain] = {
                balance: data.balance || '0',
                usdValue: data.balanceUsd || 0,
                address: address,
                // Include XRP-specific fields for proper display
                ...(chain === 'xrp' && {
                  availableBalance: data.availableBalance,
                  reservedBalance: data.reservedBalance,
                  totalBalance: data.totalBalance
                })
              };
              portfolio.totalValue += data.balanceUsd || 0;
              console.log(`✅ [${chain.toUpperCase()}] Balance: ${data.balance} | USD: $${data.balanceUsd}`);
            } catch (error) {
              console.error(`❌ [${chain.toUpperCase()}] Failed to parse response:`, error);
            }
          } else if (response.status === 'fulfilled' && !response.value.ok) {
            // Handle non-OK responses (401, 500, etc)
            const errorData = (await response.value.json() as any).catch(() => null);
            console.log(`⚠️ [${chain.toUpperCase()}] Failed with status ${response.value.status}: ${errorData?.error || 'Unknown error'}`);
            
            // Set default zero values for failed chains
            const evmChains = ['eth', 'arbitrum', 'optimism', 'base', 'polygon', 'bnb', 'zksync', 'linea', 'taiko', 'unichain', 'soneium', 'mantle', 'metis', 'scroll', 'avax'];
            const address = chain === 'xrp' ? xrpAddress : 
                          chain === 'sol' ? solAddress :
                          chain === 'btc' ? btcAddress :
                          evmChains.includes(chain) ? ethAddress : ethAddress;
                          
            portfolio.chains[chain] = {
              balance: '0.000000',
              usdValue: 0,
              address: address,
              error: true
            };
          } else {
            console.log(`⚠️ [${chain.toUpperCase()}] Request rejected or failed`);
            // Set default zero values for rejected chains
            const evmChains = ['eth', 'arbitrum', 'optimism', 'base', 'polygon', 'bnb', 'zksync', 'linea', 'taiko', 'unichain', 'soneium', 'mantle', 'metis', 'scroll', 'avax'];
            const address = chain === 'xrp' ? xrpAddress : 
                          chain === 'sol' ? solAddress :
                          chain === 'btc' ? btcAddress :
                          evmChains.includes(chain) ? ethAddress : ethAddress;
                          
            portfolio.chains[chain] = {
              balance: '0.000000',
              usdValue: 0,
              address: address,
              error: true
            };
          }
        }

        // Round the total portfolio value to 2 decimal places to fix floating point precision issues
        portfolio.totalValue = parseFloat(portfolio.totalValue.toFixed(2));

        console.log('✅ [WALLET DASHBOARD] Aggregated portfolio:', portfolio);
        setPortfolioData(portfolio);
      } catch (error) {
        console.error('❌ [WALLET DASHBOARD] Portfolio aggregation failed:', error);
        if ((error as Error).message?.includes('401')) {
          setLocation('/wallet-login');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchPortfolioData();
    // Removed auto-refresh to prevent constant page refreshing
    // Users can manually refresh using the refresh button instead
  }, [sessionToken, xrpAddress, ethAddress, solAddress, btcAddress, setLocation]);
  
  // Show login prompt if not authenticated - MUST be after all hooks
  if (!authLoading && !isAuthenticated) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Box textAlign="center">
          <Typography variant="h3" fontWeight="bold" mb={2}>
            Wallet Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary" mb={4}>
            Please log in to access your wallet dashboard
          </Typography>
          <Button 
            onClick={() => setLocation('/wallet-login')} 
            variant="contained"
            size="large"
            fullWidth
          >
            Log In to Continue
          </Button>
        </Box>
      </Container>
    );
  }

  // Handle linking wallet to RiddleSwap account
  const handleLinkWallet = async (walletAddress: string, chain: string) => {
    try {
      // Request wallet signature for verification
      const message = `Link ${chain.toUpperCase()} wallet ${walletAddress} to RiddleSwap account - ${Date.now()}`;
      
      toast({
        title: "Signature Required",
        description: `Please sign the transaction to link your ${chain.toUpperCase()} wallet`,
      });

      // This would trigger wallet signature - simplified for demo
      console.log(`🔐 Requesting signature for: ${message}`);
      
      // Simulate signature success
      toast({
        title: "Wallet Linked",
        description: `${chain.toUpperCase()} wallet successfully linked to your account`,
      });

      // Refresh linked projects - trigger a page refresh to reload data
      window.location.reload();
    } catch (error) {
      toast({
        title: "Link Failed",
        description: "Failed to link wallet. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Handle unlinking wallet from RiddleSwap account
  const handleUnlinkWallet = async (projectId: string, walletAddress: string, chain: string) => {
    try {
      // Request wallet signature for verification
      const message = `Unlink ${chain.toUpperCase()} wallet ${walletAddress} from project ${projectId} - ${Date.now()}`;
      
      toast({
        title: "Signature Required",
        description: `Please sign the transaction to unlink your ${chain.toUpperCase()} wallet`,
      });

      // This would trigger wallet signature - simplified for demo
      console.log(`🔐 Requesting signature for: ${message}`);
      
      // Simulate signature success
      toast({
        title: "Wallet Unlinked",
        description: `${chain.toUpperCase()} wallet successfully unlinked`,
      });

      // Refresh linked projects - trigger a page refresh to reload data
      window.location.reload();
    } catch (error) {
      toast({
        title: "Unlink Failed",
        description: "Failed to unlink wallet. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Search for projects connected to wallet addresses
  const handleSearchProjects = async () => {
    if (!searchQuery.trim()) return;
    
    setProjectsLoading(true);
    try {
      const response = await fetch('/api/wallet-project-links/detect-projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          walletAddresses: [searchQuery.trim()],
          chains: ['xrp', 'eth', 'sol', 'btc']
        })
      });

      if (response.ok) {
        const data = await response.json() as any;
        setSearchResults(data.projects || []);
        toast({
          title: "Search Complete",
          description: `Found ${data.projects?.length || 0} projects connected to this wallet`
        });
      } else {
        toast({
          title: "Search Failed",
          description: "Failed to search for connected projects",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: "Search Error",
        description: "An error occurred while searching",
        variant: "destructive"
      });
    } finally {
      setProjectsLoading(false);
    }
  };

  // Poll for QR code result
  const pollForResult = async (uuid: string, walletType: string) => {
    const maxAttempts = 30; // 5 minutes with 10 second intervals
    let attempts = 0;
    
    const poll = async () => {
      try {
        const response = await fetch(`/api/external-wallets/poll/${uuid}`, {
          headers: {
            'Authorization': `Bearer ${sessionToken}`
          }
        });
        
        if (response.ok) {
          const result = await response.json() as any;
          
          if (result.status === 'success') {
            // Wallet successfully connected
            const newWallet = {
              id: Date.now(),
              type: walletType,
              address: result.address,
              chain: result.chain,
              connectedAt: new Date().toISOString(),
              verified: true,
              signature: result.signature
            };
            
            // Immediately update UI and refresh from database
            await refetchExternalWallets();
            queryClient.invalidateQueries({ queryKey: ['/api/external-wallets/list'] });
            setShowQRModal(false);
            setQrData(null);
            
            toast({
              title: "Wallet Connected",
              description: `${walletType} wallet successfully linked to your account`,
            });
            
            return true;
          } else if (result.status === 'rejected') {
            throw new Error('Connection rejected by user');
          }
        }
        
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 10000); // Poll every 10 seconds
        } else {
          throw new Error('Connection timeout - please try again');
        }
        
      } catch (error) {
        setShowQRModal(false);
        setQrData(null);
        toast({
          title: "Connection Failed",
          description: (error as Error).message || 'Failed to connect wallet',
          variant: "destructive"
        });
      }
    };
    
    poll();
  };

  // Connect external wallet (MetaMask, Phantom, Xaman, Joey)
  const handleConnectExternalWallet = async (walletType: string) => {
    setConnectingWallet(walletType);
    
    try {
      let address = '';
      let chain = '';
      let signature = '';
      
      switch (walletType) {
        case 'metamask':
          // Real MetaMask connection - Check if MetaMask is available
          if (typeof window.ethereum !== 'undefined') {
            // Check if this is MetaMask (could be injected by other wallets too)
            const isMetaMask = window.ethereum.isMetaMask;
            console.log('🔍 MetaMask detection:', { available: true, isMetaMask, hasPhantom: !!window.phantom });
            
            if (isMetaMask) {
              try {
              // Request account access
              const accounts = await (window.ethereum as any).request({ 
                method: 'eth_requestAccounts' 
              }) as string[];
              address = accounts[0];
              chain = 'eth';
              
              // Request signature for verification
              const message = `Link MetaMask wallet ${address} to RiddleSwap account\nTimestamp: ${Date.now()}`;
              signature = await (window.ethereum as any).request({
                method: 'personal_sign',
                params: [message, address],
              }) as string;
              
              toast({
                title: "MetaMask Connected",
                description: address ? `Connected and verified: ${address.slice(0, 8)}...${address.slice(-6)}` : 'Connected successfully'
              });
              
              } catch (error: any) {
                if (error.code === 4001) {
                  throw new Error('User rejected the connection request');
                }
                throw error;
              }
            } else {
              throw new Error('MetaMask not available or not detected properly.');
            }
          } else {
            throw new Error('No Ethereum provider found. Please install MetaMask extension.');
          }
          break;
          
        case 'phantom':
          // Real Phantom connection - Check both window.phantom and window.solana
          const phantomProvider = (window as any).phantom?.solana || (window as any).solana;
          if (phantomProvider && phantomProvider.isPhantom) {
            try {
              // Connect to Phantom
              const response = await phantomProvider.connect();
              address = response.publicKey.toString();
              chain = 'sol';
              
              // Request signature for verification
              const message = `Link Phantom wallet ${address} to RiddleSwap account\nTimestamp: ${Date.now()}`;
              const encodedMessage = new TextEncoder().encode(message);
              const signedMessage = await phantomProvider.signMessage(encodedMessage, 'utf8');
              signature = btoa(String.fromCharCode(...Array.from(signedMessage.signature as Uint8Array)));
              
              toast({
                title: "Phantom Connected",
                description: address ? `Connected and verified: ${address.slice(0, 8)}...${address.slice(-6)}` : 'Connected successfully'
              });
              
            } catch (error: any) {
              if (error.code === 4001) {
                throw new Error('User rejected the connection request');
              }
              throw error;
            }
          } else {
            throw new Error('Phantom wallet not installed. Please install Phantom extension.');
          }
          break;
          
        case 'xaman':
          // Real Xaman connection with QR code
          try {
            const response = await fetch('/api/external-wallets/xaman/connect', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionToken}`
              },
              body: JSON.stringify({
                purpose: 'Link Xaman wallet to RiddleSwap account'
              })
            });
            
            if (!response.ok) {
              throw new Error('Failed to initiate Xaman connection');
            }
            
            const result = await response.json() as any;
            
            // Show QR code modal
            setQrData({
              qrCode: result.qrCode,
              uuid: result.uuid,
              deepLink: result.deepLink,
              walletType: 'xaman'
            });
            setShowQRModal(true);
            
            // Start polling for result
            pollForResult(result.uuid, 'xaman');
            
            toast({
              title: "Scan QR Code",
              description: "Please scan the QR code with your Xaman app to connect",
            });
            
            return; // Don't continue to wallet addition below
            
          } catch (error) {
            throw new Error('Failed to connect to Xaman: ' + (error as Error).message);
          }
          
        case 'joey':
          // Real Joey wallet connection with QR code
          try {
            const response = await fetch('/api/external-wallets/joey/connect', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionToken}`
              },
              body: JSON.stringify({
                purpose: 'Link Joey wallet to RiddleSwap account'
              })
            });
            
            if (!response.ok) {
              throw new Error('Failed to initiate Joey wallet connection');
            }
            
            const result = await response.json() as any;
            
            // Show QR code modal
            setQrData({
              qrCode: result.qrCode,
              uuid: result.uuid,
              deepLink: result.deepLink,
              walletType: 'joey'
            });
            setShowQRModal(true);
            
            // Start polling for result
            pollForResult(result.uuid, 'joey');
            
            toast({
              title: "Scan QR Code",
              description: "Please scan the QR code with your Joey wallet app to connect",
            });
            
            return; // Don't continue to wallet addition below
            
          } catch (error) {
            throw new Error('Failed to connect to Joey wallet: ' + (error as Error).message);
          }
          
        default:
          throw new Error('Unsupported wallet type');
      }
      
      if (address && signature) {
        // Verify signature on backend
        const verifyResponse = await fetch('/api/external-wallets/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`
          },
          body: JSON.stringify({
            walletType,
            address,
            chain,
            signature,
            message: `Link ${walletType} wallet ${address} to RiddleSwap account`
          })
        });
        
        if (!verifyResponse.ok) {
          throw new Error('Signature verification failed');
        }
        
        // Add to external wallets list
        const newWallet = {
          id: Date.now(),
          type: walletType,
          address,
          chain,
          connectedAt: new Date().toISOString(),
          verified: true,
          signature
        };
        
        // Immediately update UI and refresh from database  
        await refetchExternalWallets();
        queryClient.invalidateQueries({ queryKey: ['/api/external-wallets/list'] });
        
        toast({
          title: "Wallet Linked Successfully",
          description: `${walletType} wallet verified and linked to your RiddleSwap account`,
        });
      }
      
    } catch (error: any) {
      console.error(`${walletType} connection error:`, error);
      toast({
        title: "Connection Failed",
        description: error.message || `Failed to connect ${walletType}`,
        variant: "destructive"
      });
    } finally {
      setConnectingWallet(null);
    }
  };

  // Disconnect external wallet
  const handleDisconnectExternalWallet = async (walletId: number, walletType: string) => {
    disconnectWalletMutation.mutate(walletId);
  };

  const refetch = () => {
    if (sessionToken) {
      setIsLoading(true);
      // Re-trigger the useEffect by updating a dependency or create a manual refresh
      const event = new CustomEvent('refreshPortfolio');
      window.dispatchEvent(event);
    }
  };

  // Simplified prices data (included in balance responses)
  const pricesData = {};

  const handleCopyAddress = (address: string, chain: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(chain);
    toast({
      title: "Address Copied",
      description: `${chain.toUpperCase()} address copied to clipboard`
    });
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const handleRefresh = () => {
    refetch();
    toast({
      title: "Refreshing",
      description: "Updating wallet data..."
    });
  };

  if (isLoading) {
    return (
      <Box 
        display="flex" 
        alignItems="center" 
        justifyContent="center" 
        minHeight="100vh"
      >
        <Box textAlign="center">
          <CircularProgress size={48} sx={{ mb: 2 }} />
          <Typography variant="body1" color="text.secondary">
            Loading wallet data...
          </Typography>
        </Box>
      </Box>
    );
  }

  const chainData = portfolioData?.chains?.[selectedChain];
  const prices = pricesData || portfolioData?.prices || {};

  return (
    <Box sx={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(147, 51, 234, 0.05) 100%)',
      py: 4
    }}>
      <Container maxWidth="xl">
        {/* Portfolio Overview Card */}
        <Card 
          sx={{ 
            mb: 4,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            borderRadius: 3
          }}
        >
          <CardContent sx={{ p: 4 }}>
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} md={6}>
                <Typography variant="h6" sx={{ opacity: 0.9, mb: 1 }}>
                  Total Portfolio Value
                </Typography>
                <Typography variant="h2" fontWeight="bold">
                  ${portfolioData?.totalValue?.toFixed(2) || '0.00'}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.8, mt: 1 }}>
                  Across {Object.keys(portfolioData?.chains || {}).length} chains
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent={{ xs: 'flex-start', md: 'flex-end' }}>
                  <Tooltip title="Refresh Balances">
                    <IconButton 
                      onClick={handleRefresh}
                      sx={{ 
                        bgcolor: 'rgba(255,255,255,0.2)',
                        color: 'white',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' }
                      }}
                    >
                      <RefreshCw size={20} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Send Payment">
                    <IconButton 
                      onClick={() => toast({ title: "Send", description: "Send feature coming soon!" })}
                      sx={{ 
                        bgcolor: 'rgba(255,255,255,0.2)',
                        color: 'white',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' }
                      }}
                    >
                      <Send size={20} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Receive Payment">
                    <IconButton 
                      onClick={() => setShowQRModal(true)}
                      sx={{ 
                        bgcolor: 'rgba(255,255,255,0.2)',
                        color: 'white',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' }
                      }}
                    >
                      <QrCode size={20} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Security Settings">
                    <IconButton 
                      onClick={() => setShowPrivateKeyModal(true)}
                      sx={{ 
                        bgcolor: 'rgba(255,255,255,0.2)',
                        color: 'white',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' }
                      }}
                    >
                      <Shield size={20} />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Chain Balances Grid */}
        <Grid container spacing={3} mb={4}>
          {Object.entries(portfolioData?.chains || {}).map(([chain, data]: [string, any]) => {
            const chainInfo = CHAIN_INFO[chain as keyof typeof CHAIN_INFO];
            if (!chainInfo) return null;
            
            return (
              <Grid item xs={12} sm={6} md={4} lg={3} key={chain}>
                <Card 
                  sx={{ 
                    height: '100%',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 6
                    }
                  }}
                  onClick={() => setSelectedChain(chain)}
                >
                  <CardContent>
                    <Stack direction="row" alignItems="center" spacing={2} mb={2}>
                      <Avatar 
                        src={chainInfo.icon}
                        alt={chainInfo.name}
                        sx={{ width: 40, height: 40 }}
                      />
                      <Box flex={1}>
                        <Typography variant="subtitle2" color="text.secondary">
                          {chainInfo.name}
                        </Typography>
                        <Typography variant="h6" fontWeight="bold">
                          {parseFloat(data.balance || '0').toFixed(4)} {chainInfo.symbol}
                        </Typography>
                      </Box>
                    </Stack>
                    <Divider sx={{ my: 1 }} />
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" color="text.secondary">
                        USD Value
                      </Typography>
                      <Typography variant="body1" fontWeight="bold" color="primary">
                        ${data.usdValue?.toFixed(2) || '0.00'}
                      </Typography>
                    </Stack>
                    {data.error && (
                      <Chip 
                        label="Connection Error"
                        size="small"
                        color="error"
                        sx={{ mt: 1 }}
                      />
                    )}
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>

        {/* External Wallet Connections */}
        <ExternalWalletConnectionsCard />

        {/* Quick Actions */}
        <Card sx={{ mb: 4 }}>
          <CardHeader
            title="Quick Actions"
            subheader="Manage your wallet and perform common operations"
          />
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<Plus />}
                  onClick={() => setShowImportWalletModal(true)}
                >
                  Import Wallet
                </Button>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<Link />}
                  onClick={() => setShowConnectModal(true)}
                >
                  Connect External
                </Button>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<ArrowUpDown />}
                  onClick={() => setLocation('/trade-v3')}
                >
                  Swap Tokens
                </Button>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<Activity />}
                  onClick={() => setLocation('/nft-marketplace')}
                >
                  NFT Marketplace
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Container>

      {/* Modals */}
      <PrivateKeyModal
        isOpen={showPrivateKeyModal}
        onClose={() => setShowPrivateKeyModal(false)}
      />

      <ImportWalletModal
        open={showImportWalletModal}
        onOpenChange={setShowImportWalletModal}
        onImportSuccess={() => {
          toast({
            title: "Success",
            description: "Wallet imported successfully! You can now use it for transactions.",
          });
          queryClient.invalidateQueries({ queryKey: ['/api/wallets/import/imported'] });
        }}
      />

      {/* QR Code Modal */}
      {xrpAddress && (
        <WalletQRModal
          isOpen={showQRModal}
          onClose={() => setShowQRModal(false)}
          address={xrpAddress}
          title="Receive XRP"
          description="Scan this QR code to send XRP to your wallet"
          network="XRP Ledger"
        />
      )}

      {/* External Wallet Connect Modal */}
      <Dialog 
        open={showConnectModal} 
        onClose={() => setShowConnectModal(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Connect External Wallet</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<img src="/images/wallets/metamask-logo.png" alt="" style={{ width: 20, height: 20 }} />}
              onClick={() => handleConnectExternalWallet('metamask')}
              disabled={connectingWallet === 'metamask'}
            >
              {connectingWallet === 'metamask' ? 'Connecting...' : 'Connect MetaMask'}
            </Button>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<img src="/images/wallets/phantom-logo.png" alt="" style={{ width: 20, height: 20 }} />}
              onClick={() => handleConnectExternalWallet('phantom')}
              disabled={connectingWallet === 'phantom'}
            >
              {connectingWallet === 'phantom' ? 'Connecting...' : 'Connect Phantom'}
            </Button>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<img src="/images/wallets/xaman-logo.png" alt="" style={{ width: 20, height: 20 }} />}
              onClick={() => handleConnectExternalWallet('xaman')}
              disabled={connectingWallet === 'xaman'}
            >
              {connectingWallet === 'xaman' ? 'Connecting...' : 'Connect Xaman'}
            </Button>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<img src="/images/wallets/joey-logo.png" alt="" style={{ width: 20, height: 20 }} />}
              onClick={() => handleConnectExternalWallet('joey')}
              disabled={connectingWallet === 'joey'}
            >
              {connectingWallet === 'joey' ? 'Connecting...' : 'Connect Joey Wallet'}
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowConnectModal(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}
