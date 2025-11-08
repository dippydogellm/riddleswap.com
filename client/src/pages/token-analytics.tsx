import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getQueryOptions } from '@/lib/queryClient';
import { useParams, useLocation } from 'wouter';
import { sessionManager } from '@/utils/sessionManager';
import { walletChainManager } from '@/lib/wallet-chain-manager';
import { useTheme } from '@/contexts/theme-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useBackNavigation } from '@/hooks/use-back-navigation';
import { metadataManager } from '@/lib/metadata-manager';
import ModernXRPLSwap from '@/components/modern-xrpl-swap';
import ModernSolanaSwap from '@/components/modern-solana-swap';
import EVMCleanSwap from '@/components/evm-clean-swap';
import DexScreenerIframe from '@/components/dexscreener-iframe';
// TODO: Integrate SmoothPageLoader to prevent error flashes
// import { SmoothPageLoader, TokenPageSkeleton } from '@/components/smooth-page-loader';
import {
  ArrowLeft,
  ExternalLink,
  Copy,
  TrendingUp,
  TrendingDown,
  BarChart3,
  DollarSign,
  Activity,
  Layers,
  Users,
  AlertTriangle,
  RefreshCw,
  ArrowRightLeft,
  Sun,
  Moon,
  Maximize2,
  Minimize2,
  Eye,
  EyeOff,
  CheckCircle
} from 'lucide-react';

interface TokenAnalyticsData {
  success: boolean;
  symbol: string;
  issuer: string;
  data?: {
    priceUsd: number;
    priceChange: {
      m5: number;
      h1: number;
      h24: number;
    };
    txns: {
      m5: number;
      h1: number;
      h6: number;
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
    fdv?: number;
    marketCap?: number;
    pairUrl?: string;
    name?: string;
    logoUrl?: string;
    holders?: number;
    totalTrades?: number;
  };
  error?: string;
}

export default function TokenAnalytics() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { goBackWithToast } = useBackNavigation();
  const { theme, toggleTheme } = useTheme();
  const [logoError, setLogoError] = useState(false);
  const [xrplLogoError, setXrplLogoError] = useState(false);
  const [chartExpanded, setChartExpanded] = useState(false);
  const [showChart, setShowChart] = useState(true);
  const [quickBuyAmount, setQuickBuyAmount] = useState<string>('');

  // Chain aliases and normalization - support all 17 chains
  const chainAliases: Record<string, string> = {
    eth: 'ethereum',
    bnb: 'bsc',
    avax: 'avalanche',
    ftm: 'fantom',
    matic: 'polygon',
    arb: 'arbitrum',
    op: 'optimism',
    btc: 'bitcoin',
  };

  // Determine format based on URL structure and params
  const currentPath = window.location.pathname;
  
  // All 17 supported chains (both full names and shortcodes)
  const knownChains = [
    'xrpl', 'ethereum', 'bsc', 'polygon', 'arbitrum', 'optimism', 'base', 
    'avalanche', 'fantom', 'cronos', 'gnosis', 'celo', 'moonbeam', 
    'zksync', 'linea', 'solana', 'bitcoin'
  ];
  
  const chainShortcodes = [
    // Full chain names
    'ethereum', 'bsc', 'polygon', 'arbitrum', 'optimism', 'base', 
    'avalanche', 'fantom', 'cronos', 'gnosis', 'celo', 'moonbeam', 
    'zksync', 'linea', 'solana', 'xrpl', 'bitcoin',
    // Shortcode aliases
    'eth', 'bnb', 'matic', 'arb', 'op', 'avax', 'ftm', 'btc'
  ];
  
  let chain: string, tokenSymbol: string, tokenIdentifier: string;

  console.log(`🔍 [TOKEN-ANALYTICS] Parsing URL: ${currentPath}`);
  console.log(`🔍 [TOKEN-ANALYTICS] URL params:`, params);

  const pathSegments = currentPath.split('/').filter(Boolean);
  const firstSegment = pathSegments[0];
  
  // New format: /{chain}/{address} (e.g., /eth/0x123, /bsc/0x456)
  if (chainShortcodes.includes(firstSegment) && pathSegments.length >= 2) {
    const shortcode = firstSegment;
    const normalizedChain = chainAliases[shortcode] || shortcode;
    
    if (shortcode === 'xrpl') {
      // XRPL format: /xrpl/{symbol}/{issuer}
      chain = 'xrpl';
      tokenSymbol = decodeURIComponent(pathSegments[1] || '');
      tokenIdentifier = decodeURIComponent(pathSegments[2] || '');
    } else {
      // EVM/Solana format: /{chain}/{address}
      chain = normalizedChain;
      tokenSymbol = ''; // Will be fetched from token data
      tokenIdentifier = decodeURIComponent(pathSegments[1] || '');
    }
    console.log(`✅ [TOKEN-ANALYTICS] New chain shortcode format: chain=${chain}, address=${tokenIdentifier}`);
  }
  // Check for /token-analytics/xrpl/SYMBOL.ISSUER pattern
  else if (currentPath.startsWith('/token-analytics/')) {
    const pathSegments = currentPath.split('/');
    if (pathSegments.length >= 4 && pathSegments[2] === 'xrpl') {
      chain = 'xrpl';
      const symbolIssuer = decodeURIComponent(pathSegments[3] || '');
      const lastDotIndex = symbolIssuer.lastIndexOf('.');
      if (lastDotIndex > 0) {
        tokenSymbol = symbolIssuer.substring(0, lastDotIndex);
        tokenIdentifier = symbolIssuer.substring(lastDotIndex + 1);
        console.log(`✅ [TOKEN-ANALYTICS] Parsed token-analytics URL: symbol=${tokenSymbol}, issuer=${tokenIdentifier}`);
      } else {
        tokenSymbol = symbolIssuer;
        tokenIdentifier = '';
      }
    } else {
      chain = pathSegments[2] || '';
      tokenSymbol = '';
      tokenIdentifier = decodeURIComponent(pathSegments[3] || '');
    }
  }
  // Legacy format: /token/{chain}/{address} or /token/{symbol}/{issuer}
  else if (currentPath.startsWith('/token/')) {
    const chainOrSymbol = pathSegments[1];
    const normalizedChain = chainAliases[chainOrSymbol] || chainOrSymbol;
    
    if (knownChains.includes(normalizedChain)) {
      // Multi-chain format: /token/{chain}/{address}
      chain = normalizedChain;
      tokenSymbol = '';
      tokenIdentifier = decodeURIComponent(params.address || pathSegments[2] || '');
    } else if (params.symbol && params.issuer) {
      // XRPL format: /token/{symbol}/{issuer}
      chain = 'xrpl';
      tokenSymbol = decodeURIComponent(params.symbol || '');
      tokenIdentifier = decodeURIComponent(params.issuer || '');
    } else {
      // Fallback: assume XRPL if we have two segments
      chain = 'xrpl';
      tokenSymbol = decodeURIComponent(pathSegments[1] || '');
      tokenIdentifier = decodeURIComponent(pathSegments[2] || '');
    }
  }
  // Fallback
  else {
    chain = '';
    tokenSymbol = '';
    tokenIdentifier = '';
  }

  // Decode URL parameters in case they contain special characters
  const decodedSymbol = tokenSymbol;
  const decodedIssuer = tokenIdentifier;

  // Check if this is an NFT collection for XRPL tokens
  const {
    data: collectionLookupData,
    isLoading: isCollectionLookupLoading,
  } = useQuery<{success: boolean; isNFTCollection: boolean; taxon?: number; collectionName?: string}>(
    getQueryOptions(
      [`/api/collection-lookup/${encodeURIComponent(decodedSymbol)}/${encodeURIComponent(decodedIssuer)}`],
      {
        enabled: !!(chain === 'xrpl' && decodedSymbol && decodedIssuer),
      }
    )
  );

  // Get taxon for NFT collections
  const taxon = collectionLookupData?.isNFTCollection ? collectionLookupData.taxon : undefined;

  // Fetch token analytics data (include taxon for NFT collections)
  const {
    data: analyticsData,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery<TokenAnalyticsData>(
    getQueryOptions(
      chain === 'xrpl' 
        ? taxon 
          ? [`/api/analytics/xrpl/token?symbol=${encodeURIComponent(decodedSymbol)}&issuer=${encodeURIComponent(decodedIssuer)}&taxon=${taxon}`]
          : [`/api/analytics/xrpl/token?symbol=${encodeURIComponent(decodedSymbol)}&issuer=${encodeURIComponent(decodedIssuer)}`]
        : [`/api/analytics/token?address=${encodeURIComponent(tokenIdentifier)}&chain=${encodeURIComponent(chain)}`],
      {
        enabled: !!(
          (chain === 'xrpl' && decodedSymbol && decodedIssuer && !isCollectionLookupLoading) ||
          (chain !== 'xrpl' && chain && tokenIdentifier)
        ),
        staleTime: 30000, // 30 seconds
        refetchInterval: 60000, // 1 minute
        refetchOnWindowFocus: false,
      }
    )
  );

  // Fetch multi-chain token data for SEO (include taxon for NFT collections)
  const {
    data: multiChainTokenData,
    isLoading: isMultiChainLoading
  } = useQuery<{success: boolean; tokens?: Array<{symbol: string; name: string; logo?: string; address: string; priceUsd?: number}>}>(
    getQueryOptions(
      chain === 'xrpl' 
        ? taxon
          ? [`/api/search/tokens?q=${encodeURIComponent(decodedIssuer)}&chain=${chain}&type=token&limit=1&taxon=${taxon}`]
          : [`/api/search/tokens?q=${encodeURIComponent(decodedIssuer)}&chain=${chain}&type=token&limit=1`]
        : [`/api/search/tokens?q=${encodeURIComponent(tokenIdentifier)}&chain=${chain}&type=token&limit=1`],
      {
        enabled: !!(
          (chain === 'xrpl' && decodedIssuer && !isCollectionLookupLoading) ||
          (chain !== 'xrpl' && chain && tokenIdentifier)
        ),
      }
    )
  );

  // Fetch unified metadata for verified status (XRPL only for now)
  const {
    data: unifiedMetadata
  } = useQuery<{verified?: boolean; vanity_slug?: string}>(
    getQueryOptions(
      [`/api/metadata/token?issuer=${encodeURIComponent(decodedIssuer)}&currency=${encodeURIComponent(decodedSymbol)}`],
      {
        enabled: chain === 'xrpl' && !!decodedIssuer && !!decodedSymbol,
        staleTime: 300000, // 5 minutes
      }
    )
  );

  // Get user wallet data for swap components
  const [riddleWalletData, setRiddleWalletData] = useState<{
    isConnected: boolean;
    address: string | null;
    xrpAddress: string | null;
    solanaAddress: string | null;
    ethAddress: string | null;
    balance: string;
    totalBalance: string;
    reserve: string;
    handle: string | null;
    tokens: any[];
  }>({
    isConnected: false,
    address: null,
    xrpAddress: null,
    solanaAddress: null,
    ethAddress: null,
    balance: '0',
    totalBalance: '0',
    reserve: '10.00',
    handle: null,
    tokens: []
  });

  useEffect(() => {
    const loadWalletData = async () => {
      try {
        const session = sessionManager.getSession();
        
        console.log('🔍 [TOKEN-ANALYTICS] Session data:', {
          isLoggedIn: session.isLoggedIn,
          handle: session.handle,
          hasWalletData: session.hasWalletData,
          walletData: session.walletData ? 'present' : 'missing'
        });

        // Check for external wallet if no Riddle login
        if (!session.isLoggedIn || !session.walletData) {
          console.log('🔍 [TOKEN-ANALYTICS] No Riddle login, checking for external wallet...');
          
          // Check for external wallets using walletChainManager
          const allConnections = walletChainManager.getAllConnections();
          const xrpWallets = allConnections.filter(w => w.chain.toLowerCase() === 'xrp');
          
          if (xrpWallets.length > 0) {
            const externalWallet = xrpWallets[0];
            console.log('🔓 [TOKEN-ANALYTICS] Found external XRP wallet:', externalWallet.wallet, externalWallet.address);
            
            let balanceData = { balance: '0.00', totalBalance: '0.00', reserve: '10.00' };
            let walletTokens: any[] = [];
            
            try {
              const balanceResponse = await fetch(`/api/xrpl/balance/${externalWallet.address}`);
              if (balanceResponse.ok) {
                const data = await balanceResponse.json();
                if (data.success && data.balance) {
                  balanceData = {
                    balance: data.balance,
                    totalBalance: data.balance,
                    reserve: '10.00'
                  };
                }
              }
            } catch (error) {
              console.error('External wallet balance fetch error:', error);
            }

            try {
              const tokensResponse = await fetch(`/api/xrpl/tokens/${externalWallet.address}`);
              if (tokensResponse.ok) {
                const data = await tokensResponse.json();
                if (data.success && data.tokens) {
                  walletTokens = data.tokens;
                }
              }
            } catch (error) {
              console.error('External wallet tokens fetch error:', error);
            }

            setRiddleWalletData({
              isConnected: true,
              address: externalWallet.address,
              xrpAddress: externalWallet.address,
              solanaAddress: null,
              ethAddress: null,
              balance: balanceData.balance,
              totalBalance: balanceData.totalBalance,
              reserve: balanceData.reserve,
              handle: externalWallet.wallet || 'External Wallet',
              tokens: walletTokens
            });
            return;
          }
          
          // No wallet connected
          setRiddleWalletData({
            isConnected: false,
            address: null,
            xrpAddress: null,
            solanaAddress: null,
            ethAddress: null,
            balance: '0',
            totalBalance: '0',
            reserve: '10.00',
            handle: null,
            tokens: []
          });
          return;
        }

        // Get addresses from Riddle wallet data
        const xrpAddress = session.walletData.xrpAddress || session.walletData.addresses?.xrp;
        const solAddress = session.walletData.solAddress || session.walletData.addresses?.solana;
        const ethAddress = session.walletData.ethAddress || session.walletData.addresses?.ethereum;
                          
        console.log('🔍 [TOKEN-ANALYTICS] Riddle wallet addresses:', { xrpAddress, solAddress, ethAddress });

        if (!xrpAddress) {
          setRiddleWalletData({
            isConnected: false,
            address: null,
            xrpAddress: null,
            solanaAddress: solAddress,
            ethAddress: ethAddress,
            balance: '0',
            totalBalance: '0',
            reserve: '10.00',
            handle: session.handle || null,
            tokens: []
          });
          return;
        }

        // Fetch XRPL wallet balance and tokens
        let balanceData = { balance: '0.00', totalBalance: '0.00', reserve: '10.00' };
        let walletTokens: any[] = [];
        
        try {
          const balanceResponse = await fetch(`/api/xrpl/balance/${xrpAddress}`);
          if (balanceResponse.ok) {
            const data = await balanceResponse.json();
            if (data.success && data.balance) {
              balanceData = {
                balance: data.balance,
                totalBalance: data.balance,
                reserve: '10.00'
              };
            }
          }
        } catch (error) {
          console.error('Balance fetch error:', error);
        }

        try {
          const tokensResponse = await fetch(`/api/xrpl/tokens/${xrpAddress}`);
          if (tokensResponse.ok) {
            const data = await tokensResponse.json();
            if (data.success && data.tokens) {
              walletTokens = data.tokens;
              console.log('✅ [TOKEN-ANALYTICS] Loaded tokens:', walletTokens.length);
            }
          }
        } catch (error) {
          console.error('Tokens fetch error:', error);
        }

        setRiddleWalletData({
          isConnected: true,
          address: xrpAddress,
          xrpAddress: xrpAddress,
          solanaAddress: solAddress,
          ethAddress: ethAddress,
          balance: balanceData.balance,
          totalBalance: balanceData.totalBalance,
          reserve: balanceData.reserve,
          handle: session.handle || null,
          tokens: walletTokens
        });

      } catch (error) {
        console.error('❌ [TOKEN-ANALYTICS] Load wallet error:', error);
        setRiddleWalletData({
          isConnected: false,
          address: null,
          xrpAddress: null,
          solanaAddress: null,
          ethAddress: null,
          balance: '0',
          totalBalance: '0',
          reserve: '10.00',
          handle: null,
          tokens: []
        });
      }
    };

    loadWalletData();

    // Subscribe to session changes
    const unsubscribe = sessionManager.subscribe(() => {
      console.log('🔔 [TOKEN-ANALYTICS] Session changed, reloading wallet');
      loadWalletData();
    });
    
    return () => {
      unsubscribe();
    };
  }, []);

  // Reset logo error state when token data changes
  useEffect(() => {
    setLogoError(false);
  }, [multiChainTokenData]);

  // Reset XRPL logo error state when analytics data changes
  useEffect(() => {
    setXrplLogoError(false);
  }, [analyticsData]);

  // Set dynamic SEO metadata based on token data
  useEffect(() => {
    if (analyticsData?.data && decodedSymbol) {
      // For XRPL tokens with analytics data
      const tokenName = analyticsData.data.name || `${decodedSymbol} Token`;
      const description = `Trade ${tokenName} (${decodedSymbol}) with real-time analytics on ${getChainDisplayName(chain)}. Current price: $${analyticsData.data.priceUsd?.toFixed(6) || 'N/A'}. 24h volume: $${analyticsData.data.volume?.h24?.toLocaleString() || 'N/A'}.`;
      
      metadataManager.setMetadata(
        metadataManager.generateTokenMetadata(
          tokenName,
          decodedSymbol,
          description,
          analyticsData.data.logoUrl,
          decodedIssuer, // contract address (XRPL issuer)
          getChainDisplayName(chain),
          analyticsData.data.priceUsd,
          analyticsData.data.volume?.h24
        )
      );
    } else if (multiChainTokenData?.success && multiChainTokenData.tokens?.[0]) {
      // For multi-chain tokens with search data
      const tokenData = multiChainTokenData.tokens[0];
      const tokenName = tokenData.name || `${tokenData.symbol} Token`;
      const symbol = tokenData.symbol || 'TOKEN';
      const priceInfo = tokenData.priceUsd ? `$${tokenData.priceUsd.toFixed(6)}` : 'N/A';
      const shortAddress = `${tokenData.address.slice(0, 6)}...${tokenData.address.slice(-4)}`;
      
      const description = `Trade ${tokenName} (${symbol}) on ${getChainDisplayName(chain)}. Contract: ${shortAddress}. Current price: ${priceInfo}. Advanced multi-chain DeFi trading with real-time analytics.`;
      
      metadataManager.setMetadata(
        metadataManager.generateTokenMetadata(
          tokenName,
          symbol,
          description,
          tokenData.logo,
          tokenData.address, // full contract address
          getChainDisplayName(chain),
          tokenData.priceUsd
        )
      );
    } else if (chain && tokenIdentifier) {
      // For multi-chain tokens without search data or loading states
      const shortAddress = tokenIdentifier.length > 10 ? 
        `${tokenIdentifier.slice(0, 6)}...${tokenIdentifier.slice(-4)}` : 
        tokenIdentifier;
      
      const tokenName = chain === 'xrpl' ? 
        (decodedSymbol ? `${decodedSymbol} Token` : 'XRPL Token') :
        `${getChainDisplayName(chain)} Token`;
      
      const symbol = chain === 'xrpl' ? (decodedSymbol || 'TOKEN') : 'TOKEN';
      const description = `Trade ${tokenName} on ${getChainDisplayName(chain)}. Contract: ${shortAddress}. Advanced analytics and secure multi-chain swaps with professional trading tools.`;
      
      metadataManager.setMetadata(
        metadataManager.generateTokenMetadata(
          tokenName,
          symbol,
          description,
          undefined, // no logo available
          tokenIdentifier, // contract address or identifier
          getChainDisplayName(chain)
        )
      );
    } else {
      // Fallback metadata for invalid/loading states
      metadataManager.setMetadata({
        title: 'Token Analytics | Multi-Chain Trading Platform',
        description: 'Advanced token analytics and trading across 19+ blockchains. Real-time price data, comprehensive charts, and secure multi-chain swaps.',
        keywords: ['Token Analytics', 'Multi-chain Trading', 'DeFi', 'Crypto Trading', 'Price Analysis'],
        url: window.location.href,
        type: 'website'
      });
    }
  }, [analyticsData, multiChainTokenData, chain, decodedSymbol, tokenIdentifier]);

  // Handle back navigation with toast
  const handleBack = () => {
    let destination = '/wallet-dashboard';
    let chainName = getChainDisplayName(chain);
    
    if (chain === 'xrpl') {
      destination = '/xrp-wallet';
    } else if (chain === 'solana') {
      destination = '/sol-wallet';
    } else {
      // For EVM chains, go to appropriate wallet
      const chainRoutes: Record<string, string> = {
        ethereum: '/eth-wallet',
        bsc: '/bnb-wallet',
        polygon: '/polygon-wallet',
        arbitrum: '/arbitrum-wallet',
        optimism: '/optimism-wallet',
        base: '/base-wallet',
        avalanche: '/avax-wallet',
        fantom: '/fantom-wallet'
      };
      destination = chainRoutes[chain] || '/wallet-dashboard';
    }
    
    goBackWithToast(destination, `← Returning to ${chainName} wallet`);
  };

  // Get chain display name with fallback - all 17 chains
  const getChainDisplayName = (chainKey: string): string => {
    const chainNames: Record<string, string> = {
      xrpl: 'XRP Ledger',
      solana: 'Solana',
      ethereum: 'Ethereum',
      bsc: 'BNB Smart Chain',
      polygon: 'Polygon',
      arbitrum: 'Arbitrum',
      optimism: 'Optimism',
      base: 'Base',
      avalanche: 'Avalanche',
      fantom: 'Fantom',
      cronos: 'Cronos',
      gnosis: 'Gnosis Chain',
      celo: 'Celo',
      moonbeam: 'Moonbeam',
      zksync: 'zkSync Era',
      linea: 'Linea',
      bitcoin: 'Bitcoin'
    };
    return chainNames[chainKey] || (chainKey ? chainKey.charAt(0).toUpperCase() + chainKey.slice(1) : 'Unknown Chain');
  };

  // Render appropriate swap component
  const renderSwapComponent = () => {
    if (!riddleWalletData.isConnected) {
      return (
        <Card className="bg-white/10 dark:bg-gray-800/50 backdrop-blur-sm border-white/20">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Connect Wallet Required</h3>
            <p className="text-gray-300 mb-4">Connect your Riddle Wallet to start trading this token</p>
            <Button onClick={() => setLocation('/wallet-login')} className="bg-blue-600 hover:bg-blue-700">
              Connect Wallet
            </Button>
          </CardContent>
        </Card>
      );
    }

    switch (chain) {
      case 'xrpl':
        return (
          <Card className="bg-white/10 dark:bg-gray-800/50 backdrop-blur-sm border-white/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <ArrowRightLeft className="h-5 w-5" />
                Trade {decodedSymbol || 'Token'}
              </CardTitle>
              {/* Quick Buy Buttons */}
              <div className="grid grid-cols-3 gap-2 mt-3">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => {
                    setQuickBuyAmount('10');
                    setTimeout(() => {
                      const swapCard = document.querySelector('[data-swap-card]');
                      if (swapCard) swapCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 100);
                  }}
                  className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border-blue-500/30 text-xs sm:text-sm"
                >
                  <span className="hidden sm:inline">Buy with </span>10 XRP
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => {
                    setQuickBuyAmount('20');
                    setTimeout(() => {
                      const swapCard = document.querySelector('[data-swap-card]');
                      if (swapCard) swapCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 100);
                  }}
                  className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border-blue-500/30 text-xs sm:text-sm"
                >
                  <span className="hidden sm:inline">Buy with </span>20 XRP
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => {
                    setQuickBuyAmount('100');
                    setTimeout(() => {
                      const swapCard = document.querySelector('[data-swap-card]');
                      if (swapCard) swapCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 100);
                  }}
                  className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border-blue-500/30 text-xs sm:text-sm"
                >
                  <span className="hidden sm:inline">Buy with </span>100 XRP
                </Button>
              </div>
            </CardHeader>
            <CardContent data-swap-card>
              <ModernXRPLSwap
                isWalletConnected={riddleWalletData.isConnected}
                walletAddress={riddleWalletData.xrpAddress}
                walletHandle={riddleWalletData.handle}
                balance={riddleWalletData.balance}
                totalBalance={riddleWalletData.totalBalance}
                reserve={riddleWalletData.reserve}
                availableTokens={riddleWalletData.tokens}
                initialToTokenSymbol={decodedSymbol}
                initialToTokenIssuer={decodedIssuer}
                initialFromAmount={quickBuyAmount}
              />
            </CardContent>
          </Card>
        );
      
      case 'solana':
        return (
          <Card className="bg-white/10 dark:bg-gray-800/50 backdrop-blur-sm border-white/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <ArrowRightLeft className="h-5 w-5" />
                Trade Token
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ModernSolanaSwap
                isWalletConnected={riddleWalletData.isConnected}
                walletAddress={riddleWalletData.solanaAddress}
              />
            </CardContent>
          </Card>
        );
      
      default:
        // EVM chains
        return (
          <Card className="bg-white/10 dark:bg-gray-800/50 backdrop-blur-sm border-white/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <ArrowRightLeft className="h-5 w-5" />
                Trade Token on {getChainDisplayName(chain)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EVMCleanSwap
                isWalletConnected={riddleWalletData.isConnected}
                walletAddress={riddleWalletData.ethAddress}
              />
            </CardContent>
          </Card>
        );
    }
  };

  // Handle copy functionality
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: `${label} copied to clipboard`,
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Unable to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  // Format currency values
  const formatCurrency = (value?: number, compact = true) => {
    if (!value || value === 0) return '$0.00';
    
    if (compact) {
      if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
      if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
      if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    }
    
    if (value < 0.01) return `$${value.toFixed(6)}`;
    return `$${value.toFixed(2)}`;
  };

  // Format percentage with color
  const formatPercentage = (value?: number) => {
    if (value === undefined || value === null) return null;
    
    const isPositive = value >= 0;
    const colorClass = isPositive 
      ? 'text-green-600 dark:text-green-400' 
      : 'text-red-600 dark:text-red-400';
    
    return {
      value: `${isPositive ? '+' : ''}${value.toFixed(2)}%`,
      colorClass,
      icon: isPositive ? TrendingUp : TrendingDown
    };
  };

  // Format large numbers
  const formatNumber = (value?: number) => {
    if (!value || value === 0) return '0';
    
    if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
    return value.toFixed(0);
  };

  // Compact Metric Tile Component
  const CompactMetricTile = ({ label, value, change, icon: Icon, testId }: {
    label: string;
    value: string;
    change?: { value: string; colorClass: string; icon: any } | null;
    icon: any;
    testId?: string;
  }) => (
    <Card className="bg-card/50 border-border/50 backdrop-blur-sm transition-all hover:bg-card/70">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {change && (
            <div className={`flex items-center gap-1 text-xs font-medium ${change.colorClass}`}>
              <change.icon className="h-3 w-3" />
              {change.value}
            </div>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground leading-none">{label}</p>
          <p className="text-lg font-bold text-foreground leading-none" data-testid={testId}>
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  );

  // Toggle chart visibility
  const toggleChart = useCallback(() => {
    setShowChart(prev => !prev);
  }, []);

  // Memoized chart component with size control
  const ChartComponent = useMemo(() => {
    if (!showChart) return null;
    
    return (
      <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-foreground">
              <BarChart3 className="h-5 w-5" />
              DexScreener Chart
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setChartExpanded(!chartExpanded)}
                className="h-8 w-8 p-0"
                data-testid="button-toggle-chart-size"
              >
                {chartExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowChart(false)}
                className="h-8 w-8 p-0"
                data-testid="button-hide-chart"
              >
                <EyeOff className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className={`transition-all ${
            chartExpanded 
              ? 'h-[500px] sm:h-[600px] lg:h-[700px]' 
              : 'h-[350px] sm:h-[400px] lg:h-[450px]'
          } overflow-hidden`}>
            <DexScreenerIframe 
              tokenSymbol={chain === 'xrpl' ? decodedSymbol : 'TOKEN'}
              tokenAddress={chain === 'xrpl' ? decodedIssuer : tokenIdentifier}
              chain={chain}
              className="w-full h-full"
            />
          </div>
        </CardContent>
      </Card>
    );
  }, [showChart, chartExpanded, chain, decodedSymbol, decodedIssuer, tokenIdentifier, theme]);

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 p-6">
        <div className="container mx-auto max-w-6xl">
          {/* Header skeleton */}
          <div className="mb-6">
            <Skeleton className="h-10 w-32 mb-4" />
            <Card className="bg-white/10 dark:bg-gray-800/50 backdrop-blur-sm border-white/20">
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <Skeleton className="h-16 w-16 rounded-full" />
                  <div>
                    <Skeleton className="h-8 w-32 mb-2" />
                    <Skeleton className="h-6 w-48" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-20" />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Analytics skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Loading state for non-XRPL chains
  if (chain !== 'xrpl' && isMultiChainLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 p-6">
        <div className="container mx-auto max-w-6xl">
          {/* Header skeleton */}
          <div className="mb-6">
            <Skeleton className="h-10 w-32 mb-4" />
            <Card className="bg-white/10 dark:bg-gray-800/50 backdrop-blur-sm border-white/20">
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <Skeleton className="h-16 w-16 rounded-full" />
                  <div>
                    <Skeleton className="h-8 w-32 mb-2" />
                    <Skeleton className="h-6 w-48" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Content skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Skeleton className="h-64" />
            </div>
            <div>
              <Skeleton className="h-64 mb-6" />
              <Skeleton className="h-32" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // For non-XRPL chains without analytics data, show unified layout with available data
  if (chain !== 'xrpl' && (!analyticsData?.success && !isLoading)) {
    // Use the same comprehensive layout but with multiChainTokenData
    const tokenData = multiChainTokenData?.tokens?.[0];
    const displaySymbol = tokenData?.symbol || 'Token';
    const displayName = tokenData?.name || `${displaySymbol} Token`;
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 p-6">
        <div className="container mx-auto max-w-6xl">
          {/* Navigation */}
          <div className="mb-6">
            <Button 
              variant="ghost" 
              onClick={handleBack}
              className="text-white hover:bg-white/10 mb-4"
              data-testid="button-back-to-wallet"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to {getChainDisplayName(chain)} Wallet
            </Button>

            {/* Banner Section - Unified Design */}
            <Card className="bg-white/10 dark:bg-gray-800/50 backdrop-blur-sm border-white/20 overflow-hidden">
              <div className="relative h-32 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-blue-800/20 border-b border-white/10">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/30 to-purple-500/30" />
                <div className="absolute bottom-4 right-4 text-white/60 text-sm">
                  get your dev to update this
                </div>
              </div>
              
              <CardContent className="p-6 -mt-8 relative">
                <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
                  <div className="flex items-end gap-4">
                    {/* Profile Picture - Same as XRPL design */}
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border-4 border-white/20 flex items-center justify-center relative overflow-hidden shadow-xl">
                      {tokenData?.logo && !logoError ? (
                        <img 
                          src={tokenData.logo} 
                          alt={displaySymbol}
                          className="w-full h-full object-cover rounded-full"
                          data-testid="img-token-profile-pic"
                          onError={() => setLogoError(true)}
                        />
                      ) : (
                        <div className="text-3xl font-bold text-white" data-testid="text-token-profile-fallback">
                          {displaySymbol?.charAt(0) || '?'}
                        </div>
                      )}
                    </div>
                    <div className="pb-2">
                      <div className="flex items-center gap-3 mb-1">
                        <h1 className="text-4xl font-bold text-white" data-testid="text-token-symbol">
                          {displaySymbol}
                        </h1>
                        {unifiedMetadata?.verified && (
                          <Badge variant="default" className="bg-blue-500 text-white flex items-center gap-1 px-3 py-1">
                            <CheckCircle className="w-4 h-4" />
                            Verified
                          </Badge>
                        )}
                      </div>
                      <p className="text-gray-300 text-lg" data-testid="text-token-name">{displayName}</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button 
                      onClick={handleBack}
                      className="bg-blue-600 hover:bg-blue-700"
                      data-testid="button-back-wallet"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back to Wallet
                    </Button>
                  </div>
                </div>
                
                {/* Project Description Section */}
                <div className="mt-6 p-4 bg-white/5 rounded-lg border border-white/10">
                  <h3 className="text-lg font-semibold text-white mb-2">Project Description</h3>
                  <p className="text-gray-300 leading-relaxed" data-testid="text-project-description">
                    {displayName} is a {getChainDisplayName(chain)} token. This description can be customized through DevTools once the project is claimed.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm border border-blue-500/30">
                      {getChainDisplayName(chain)}
                    </span>
                    <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm border border-purple-500/30">
                      Claimable in DevTools
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>


            {/* Price and Key Metrics - Show available data */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
              <Card className="bg-white/5 border-white/10">
                <CardContent className="p-4">
                  <div className="text-sm text-gray-400 mb-1">Current Price</div>
                  <div className="text-2xl font-bold text-white" data-testid="text-current-price">
                    {tokenData?.priceUsd ? formatCurrency(tokenData.priceUsd, false) : 'N/A'}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/5 border-white/10">
                <CardContent className="p-4">
                  <div className="text-sm text-gray-400 mb-1">Market Cap</div>
                  <div className="text-2xl font-bold text-white" data-testid="text-market-cap">
                    N/A
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/5 border-white/10">
                <CardContent className="p-4">
                  <div className="text-sm text-gray-400 mb-1">FDV</div>
                  <div className="text-2xl font-bold text-white" data-testid="text-fdv">
                    N/A
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/5 border-white/10">
                <CardContent className="p-4">
                  <div className="text-sm text-gray-400 mb-1">24h Volume</div>
                  <div className="text-2xl font-bold text-white" data-testid="text-volume-24h">
                    N/A
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Main Content Grid - Same layout as XRPL */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Swap Component */}
              {renderSwapComponent()}

              {/* Analytics Grid - Show placeholder cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-white/10 dark:bg-gray-800/50 backdrop-blur-sm border-white/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <TrendingUp className="h-5 w-5" />
                      Price Changes
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {[
                      { label: '5 minutes', key: 'm5' },
                      { label: '1 hour', key: 'h1' },
                      { label: '24 hours', key: 'h24' },
                    ].map(({ label, key }) => (
                      <div key={key} className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                        <span className="text-gray-300">{label}</span>
                        <span className="text-gray-500">-</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="bg-white/10 dark:bg-gray-800/50 backdrop-blur-sm border-white/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <Activity className="h-5 w-5" />
                      Transaction Counts
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {[
                      { label: '5 minutes', key: 'm5' },
                      { label: '1 hour', key: 'h1' },
                      { label: '24 hours', key: 'h24' },
                    ].map(({ label, key }) => (
                      <div key={key} className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                        <span className="text-gray-300">{label}</span>
                        <span className="text-gray-500">-</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <Card className="bg-white/10 dark:bg-gray-800/50 backdrop-blur-sm border-white/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Layers className="h-5 w-5" />
                    Token Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-3 bg-white/5 rounded-lg">
                    <div className="text-sm text-gray-400 mb-1">Chain</div>
                    <div className="text-white font-semibold">
                      {getChainDisplayName(chain)}
                    </div>
                  </div>
                  
                  <div className="p-3 bg-white/5 rounded-lg">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-400 mb-1">Contract Address</div>
                        <code className="text-sm text-white break-all font-mono" data-testid="text-contract-address">
                          {tokenIdentifier}
                        </code>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(tokenIdentifier, 'Contract address')}
                        className="text-gray-400 hover:text-white hover:bg-white/10"
                        data-testid="button-copy-address"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="p-3 bg-white/5 rounded-lg">
                    <div className="text-sm text-gray-400 mb-1">Token Symbol</div>
                    <div className="text-white font-semibold" data-testid="text-token-symbol-info">
                      {displaySymbol}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state - only show after initial loading attempt (prevent flash)
  if ((isError || !analyticsData?.success) && !isLoading) {
    const errorMessage = analyticsData?.error || error?.message || 'Failed to load token data';
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 p-6">
        <div className="container mx-auto max-w-4xl">
          <div className="mb-6">
            <Button 
              variant="ghost" 
              onClick={handleBack}
              className="text-white hover:bg-white/10 mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Wallet
            </Button>
          </div>

          <Card className="bg-white/10 dark:bg-gray-800/50 backdrop-blur-sm border-white/20">
            <CardContent className="p-12 text-center">
              <AlertTriangle className="mx-auto h-16 w-16 text-yellow-500 mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">Token Not Found</h2>
              <p className="text-gray-300 mb-6">{errorMessage}</p>
              <div className="space-x-4">
                <Button onClick={handleBack} className="bg-blue-600 hover:bg-blue-700">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Wallet
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => refetch()}
                  className="border-white/20 text-white hover:bg-white/10"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const { data } = analyticsData;
  const tokenName = data?.name || `${decodedSymbol} Token`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 p-3 sm:p-4 md:p-6">
      <div className="container mx-auto max-w-6xl">
        {/* Navigation */}
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={handleBack}
            className="text-white hover:bg-white/10 mb-4"
            data-testid="button-back-to-wallet"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Wallet
          </Button>

          {/* Banner Section - Customizable through DevTools */}
          <Card className="bg-white/10 dark:bg-gray-800/50 backdrop-blur-sm border-white/20 overflow-hidden">
            <div className="relative h-24 sm:h-32 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-blue-800/20 border-b border-white/10">
              {/* Placeholder banner - can be customized in DevTools */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/30 to-purple-500/30" />
              <div className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4 text-white/60 text-xs sm:text-sm">
                Banner customizable in DevTools
              </div>
            </div>
            
            <CardContent className="p-4 sm:p-6 -mt-6 sm:-mt-8 relative">
              <div className="flex flex-col gap-4">
                <div className="flex items-end gap-3 sm:gap-4">
                  {/* Profile Picture from API */}
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border-4 border-white/20 flex items-center justify-center relative overflow-hidden shadow-xl flex-shrink-0">
                    {data?.logoUrl && !xrplLogoError ? (
                      <img 
                        src={data.logoUrl} 
                        alt={decodedSymbol}
                        className="w-full h-full object-cover rounded-full"
                        data-testid="img-token-profile-pic"
                        onError={() => setXrplLogoError(true)}
                      />
                    ) : (
                      <div className="text-2xl sm:text-3xl font-bold text-white" data-testid="text-token-profile-fallback">
                        {decodedSymbol?.charAt(0) || '?'}
                      </div>
                    )}
                  </div>
                  <div className="pb-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 sm:gap-3 mb-1 flex-wrap">
                      <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white truncate" data-testid="text-token-symbol">
                        {decodedSymbol}
                      </h1>
                      {unifiedMetadata?.verified && (
                        <Badge variant="default" className="bg-blue-500 text-white flex items-center gap-1 px-2 py-0.5 sm:px-3 sm:py-1">
                          <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                          Verified
                        </Badge>
                      )}
                    </div>
                    <p className="text-gray-300 text-sm sm:text-base lg:text-lg truncate" data-testid="text-token-name">{tokenName}</p>
                  </div>
                </div>

                <div className="flex gap-2 sm:gap-3">
                  <Button 
                    onClick={handleBack}
                    className="bg-blue-600 hover:bg-blue-700 text-sm sm:text-base"
                    size="sm"
                    data-testid="button-back-wallet"
                  >
                    <ArrowLeft className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Back to Wallet</span>
                    <span className="sm:hidden">Back</span>
                  </Button>
                </div>
              </div>
              
              {/* Project Description Section - Editable in DevTools */}
              <div className="mt-6 p-4 bg-white/5 rounded-lg border border-white/10">
                <h3 className="text-lg font-semibold text-white mb-2">Project Description</h3>
                <p className="text-gray-300 leading-relaxed" data-testid="text-project-description">
                  {(data as any)?.description || `${tokenName} is a blockchain token. This description can be customized through DevTools once the project is claimed.`}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm border border-blue-500/30">
                    {chain?.toUpperCase() || 'XRPL'}
                  </span>
                  {(data as any)?.website && (
                    <span className="px-3 py-1 bg-green-500/20 text-green-300 rounded-full text-sm border border-green-500/30">
                      Website Available
                    </span>
                  )}
                  <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm border border-purple-500/30">
                    Claimable in DevTools
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>


          {/* Theme Toggle Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-primary/10 text-primary font-medium">
                {getChainDisplayName(chain)}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleTheme}
                className="flex items-center gap-2 bg-card/50 border-border/50"
                data-testid="button-theme-toggle"
              >
                {theme === 'dark' || theme === 'night' ? (
                  <>
                    <Sun className="h-4 w-4" />
                    Light
                  </>
                ) : (
                  <>
                    <Moon className="h-4 w-4" />
                    Dark
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Compact Stats Grid - Desktop: 8 columns, Mobile: 2 columns */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-3 mt-6">
            <CompactMetricTile
              label="Price"
              value={formatCurrency(data?.priceUsd, false)}
              change={formatPercentage(data?.priceChange?.h24)}
              icon={DollarSign}
              testId="text-current-price"
            />
            <CompactMetricTile
              label="Market Cap"
              value={formatCurrency(data?.marketCap)}
              icon={Layers}
              testId="text-market-cap"
            />
            <CompactMetricTile
              label="FDV"
              value={formatCurrency(data?.fdv)}
              icon={TrendingUp}
              testId="text-fdv"
            />
            <CompactMetricTile
              label="24h Volume"
              value={formatCurrency(data?.volume?.h24)}
              icon={BarChart3}
              testId="text-volume-24h"
            />
            <CompactMetricTile
              label="24h Txns"
              value={formatNumber(data?.txns?.h24)}
              icon={Activity}
              testId="text-txns-24h"
            />
            <CompactMetricTile
              label="Liquidity"
              value={formatCurrency(data?.liquidity?.usd)}
              icon={Layers}
              testId="text-liquidity-usd"
            />
            <CompactMetricTile
              label="Holders"
              value={formatNumber(data?.holders)}
              icon={Users}
              testId="text-holders-count"
            />
            <CompactMetricTile
              label="Total Trades"
              value={formatNumber(data?.totalTrades)}
              icon={ArrowRightLeft}
              testId="text-total-trades"
            />
          </div>
        </div>

        {/* Key Metrics Row - Like DexScreener */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 p-4 bg-card/30 border-border/50 rounded-lg backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="bg-primary/10 text-primary font-medium">
              {getChainDisplayName(chain)}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              className="flex items-center gap-2 bg-card/50 border-border/50 h-8 px-3"
              data-testid="button-theme-toggle"
            >
              {theme === 'dark' || theme === 'night' ? (
                <Sun className="h-3 w-3" />
              ) : (
                <Moon className="h-3 w-3" />
              )}
            </Button>
          </div>
          
          <div className="flex items-center gap-6 flex-wrap">
            <div className="text-center">
              <div className="text-xs text-muted-foreground">Price USD</div>
              <div className="font-semibold text-foreground">{formatCurrency(data?.priceUsd, false)}</div>
              <div className={`text-xs ${
                data?.priceChange?.h24 && data.priceChange.h24 > 0 ? 'text-green-400' : 
                data?.priceChange?.h24 && data.priceChange.h24 < 0 ? 'text-red-400' : 'text-muted-foreground'
              }`}>
                {formatPercentage(data?.priceChange?.h24)?.value || '-'}
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-xs text-muted-foreground">Liquidity</div>
              <div className="font-semibold text-foreground">{formatCurrency(data?.liquidity?.usd)}</div>
            </div>
            
            <div className="text-center">
              <div className="text-xs text-muted-foreground">FDV</div>
              <div className="font-semibold text-foreground">{formatCurrency(data?.fdv)}</div>
            </div>
            
            <div className="text-center">
              <div className="text-xs text-muted-foreground">Mkt Cap</div>
              <div className="font-semibold text-foreground">{formatCurrency(data?.marketCap)}</div>
            </div>
            
            <div className="text-center">
              <div className="text-xs text-muted-foreground">24h Volume</div>
              <div className="font-semibold text-foreground">{formatCurrency(data?.volume?.h24)}</div>
            </div>
            
            <div className="text-center">
              <div className="text-xs text-muted-foreground">24h Txns</div>
              <div className="font-semibold text-foreground">{formatNumber(data?.txns?.h24)}</div>
            </div>
            
            <div className="text-center">
              <div className="text-xs text-muted-foreground">Holders</div>
              <div className="font-semibold text-foreground">{formatNumber(data?.holders)}</div>
            </div>
            
            <div className="text-center">
              <div className="text-xs text-muted-foreground">Total Trades</div>
              <div className="font-semibold text-foreground">{formatNumber(data?.totalTrades)}</div>
            </div>
          </div>
        </div>

        {/* Main Content Grid - Chart and Trading Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart Section */}
          <div className="lg:col-span-2 space-y-6">
            {/* Compact Chart */}
            {ChartComponent}
            
            {/* Show Chart Button (when hidden) */}
            {!showChart && (
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  onClick={toggleChart}
                  className="bg-card/50 backdrop-blur-sm border-border/50"
                  data-testid="button-show-chart"
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Show Chart
                </Button>
              </div>
            )}
          </div>

          {/* Trading & Analytics Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Swap Component */}
            {renderSwapComponent()}
            {/* Price Changes */}
            <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground text-base">
                  <TrendingUp className="h-4 w-4" />
                  Price Changes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                {[
                  { label: '5 min', key: 'm5', value: data?.priceChange?.m5 },
                  { label: '1 hour', key: 'h1', value: data?.priceChange?.h1 },
                  { label: '24 hours', key: 'h24', value: data?.priceChange?.h24 },
                ].map(({ label, key, value }) => {
                  const formatted = formatPercentage(value);
                  return (
                    <div key={key} className="flex justify-between items-center py-2 px-3 bg-muted/50 rounded-md">
                      <span className="text-sm text-muted-foreground">{label}</span>
                      {formatted ? (
                        <div className={`flex items-center gap-1 font-medium text-sm ${formatted.colorClass}`} data-testid={`text-price-change-${key}`}>
                          <formatted.icon className="h-3 w-3" />
                          {formatted.value}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Transaction Activity */}
            <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground text-base">
                  <Activity className="h-4 w-4" />
                  Transaction Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                {[
                  { label: '5 min', key: 'm5', value: data?.txns?.m5 },
                  { label: '1 hour', key: 'h1', value: data?.txns?.h1 },
                  { label: '24 hours', key: 'h24', value: data?.txns?.h24 },
                ].map(({ label, key, value }) => (
                  <div key={key} className="flex justify-between items-center py-2 px-3 bg-muted/50 rounded-md">
                    <span className="text-sm text-muted-foreground">{label}</span>
                    <span className="font-medium text-sm text-foreground" data-testid={`text-txns-${key}`}>
                      {formatNumber(value)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Token Information */}
            <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground text-base">
                  <Layers className="h-4 w-4" />
                  Token Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                {/* Token Symbol */}
                <div className="p-3 bg-muted/50 rounded-md">
                  <div className="text-xs text-muted-foreground mb-1">Symbol</div>
                  <div className="text-sm font-semibold text-foreground" data-testid="text-token-symbol-info">
                    {decodedSymbol}
                  </div>
                </div>

                {/* Token Address/Issuer */}
                <div className="p-3 bg-muted/50 rounded-md">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted-foreground mb-1">
                        {chain === 'xrpl' ? 'Issuer' : 'Contract'}
                      </div>
                      <code className="text-xs text-foreground break-all font-mono" data-testid="text-issuer-address">
                        {decodedIssuer.length > 20 ? 
                          `${decodedIssuer.slice(0, 10)}...${decodedIssuer.slice(-8)}` : 
                          decodedIssuer
                        }
                      </code>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(decodedIssuer, 'Address')}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                      data-testid="button-copy-issuer"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
