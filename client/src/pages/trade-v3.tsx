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
import { useSession } from '@/utils/sessionManager';
import { SessionRenewalModal } from '@/components/SessionRenewalModal';
import { checkSessionForPayment } from '@/utils/sessionCheck';

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

// Add animation styles
const styles = `
  @keyframes scaleIn {
    from {
      transform: scale(0);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }
`;

export default function TradeV3Page() {
  const { toast } = useToast();
  const session = useSession();
  const [chain, setChain] = useState<Chain>('Ethereum');
  const [tab, setTab] = useState<'swap' | 'bridge' | 'limit' | 'liquidity'>('swap');
  const [fromToken, setFromToken] = useState<Token>(NATIVE_TOKENS.Ethereum);
  const [toToken, setToToken] = useState<Token | null>(null);
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [slippage, setSlippage] = useState(0.5);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [showRenewalModal, setShowRenewalModal] = useState(false);

  // Watch for session renewal needs
  useEffect(() => {
    if ((session as any).needsRenewal) {
      setShowRenewalModal(true);
    } else {
      setShowRenewalModal(false);
    }
  }, [(session as any).needsRenewal]);
  const [isSwapping, setIsSwapping] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [tokenSearchOpen, setTokenSearchOpen] = useState<'from' | 'to' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Token[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [quoteData, setQuoteData] = useState<any>(null);
  const [liquidityData, setLiquidityData] = useState<any>(null);
  const [liquidityMode, setLiquidityMode] = useState<'single' | 'double'>('single');
  const [createNewPool, setCreateNewPool] = useState(false);
  const [limitOrderPrice, setLimitOrderPrice] = useState('');
  const [takeProfitPrice, setTakeProfitPrice] = useState('');
  const [stopLossPrice, setStopLossPrice] = useState('');
  const [apiConnectionStatus, setApiConnectionStatus] = useState<{bithomp: boolean, oneInch: boolean} | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [autoTrustline, setAutoTrustline] = useState(true);
  const [tokenBalances, setTokenBalances] = useState<Record<string, string>>({});
  
  // Confirmation Dialog State
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmDialogData, setConfirmDialogData] = useState<{
    type: 'swap' | 'bridge' | 'limit' | 'liquidity';
    payload: any;
    summary: {
      from?: string;
      to?: string;
      amount?: string;
      estimatedOutput?: string;
      fee?: string;
      slippage?: string;
      price?: string;
      poolShare?: string;
      [key: string]: any;
    };
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [successDialogData, setSuccessDialogData] = useState<{
    type: 'swap' | 'bridge' | 'limit' | 'liquidity';
    txHash?: string;
    details: any;
  } | null>(null);

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

  // Fetch liquidity calculation for Liquidity tab
  useEffect(() => {
    const getLiquidityCalc = async () => {
      if (tab !== 'liquidity' || chain !== 'XRPL' || !fromToken || !toToken) {
        setLiquidityData(null);
        return;
      }

      // Check if pool exists
      try {
        const asset1 = fromToken.issuer ? `${fromToken.address}.${fromToken.issuer}` : fromToken.address;
        const asset2 = toToken.issuer ? `${toToken.address}.${toToken.issuer}` : toToken.address;
        
        // First check if pool exists
        const poolCheck = await fetch(`/api/tradecenter/liquidity/pool-exists?asset1=${asset1}&asset2=${asset2}`);
        const poolData = await poolCheck.json();
        
        if (!poolData.exists) {
          setCreateNewPool(true);
          setLiquidityData(null);
          // In double-sided mode, don't auto-fill
          if (liquidityMode === 'single') {
            setToAmount('');
          }
          return;
        }
        
        setCreateNewPool(false);
        
        // Only calculate if we have amounts
        if (liquidityMode === 'single' && fromAmount && parseFloat(fromAmount) > 0) {
          const params = new URLSearchParams({
            asset1,
            asset2,
            amount: fromAmount,
            inputAsset: asset1,
            mode: 'single'
          });
          
          console.log(`💧 Calculating single-sided liquidity for ${fromAmount} ${fromToken.symbol}`);
          
          const response = await fetch(`/api/tradecenter/liquidity/calculate?${params}`);
          const data = await response.json();
          
          if (data.success) {
            setLiquidityData(data);
            setToAmount(data.required.amount);
            console.log(`✅ Pool share: ${data.poolShare.formatted}`);
          }
        } else if (liquidityMode === 'double' && fromAmount && toAmount && parseFloat(fromAmount) > 0 && parseFloat(toAmount) > 0) {
          const params = new URLSearchParams({
            asset1,
            asset2,
            amount1: fromAmount,
            amount2: toAmount,
            mode: 'double'
          });
          
          console.log(`💧 Calculating double-sided liquidity: ${fromAmount} ${fromToken.symbol} + ${toAmount} ${toToken.symbol}`);
          
          const response = await fetch(`/api/tradecenter/liquidity/calculate?${params}`);
          const data = await response.json();
          
          if (data.success) {
            setLiquidityData(data);
            console.log(`✅ Pool share: ${data.poolShare.formatted}`);
          }
        }
      } catch (error) {
        console.error('Failed to calculate liquidity:', error);
        setLiquidityData(null);
      }
    };

    const debounce = setTimeout(getLiquidityCalc, 500);
    return () => clearTimeout(debounce);
  }, [tab, chain, fromToken, toToken, fromAmount, toAmount, liquidityMode]);

  useEffect(() => {
    const getQuote = async () => {
      if (tab !== 'swap' || !fromToken || !toToken || !fromAmount || parseFloat(fromAmount) <= 0) {
        if (tab === 'swap') {
          setToAmount('');
          setQuoteData(null);
        }
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
    // Check session before allowing swap
    const sessionCheck = checkSessionForPayment();
    if (!sessionCheck.valid) {
      if (sessionCheck.needsRenewal) {
        setShowRenewalModal(true);
        toast({
          title: "Session Renewal Required",
          description: "Please renew your session to perform swaps",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Login Required",
          description: sessionCheck.message,
          variant: "destructive"
        });
      }
      return;
    }

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

    // Prepare transaction payload
    const walletAddress = chainWallet?.address || '';
    if (!walletAddress) {
      toast({
        title: "Error",
        description: "Wallet address not found",
        variant: "destructive"
      });
      return;
    }

    const chainParam = chain === 'XRPL' ? 'xrp' : 
                      chain === 'Ethereum' ? 'eth' :
                      chain === 'BSC' ? 'eth' :
                      chain === 'Polygon' ? 'eth' : 'eth';
    
    const fromTokenParam = chain === 'XRPL' 
      ? (fromToken.issuer ? `${fromToken.address}.${fromToken.issuer}` : fromToken.address)
      : fromToken.address;
      
    const toTokenParam = chain === 'XRPL'
      ? (toToken.issuer ? `${toToken.address}.${toToken.issuer}` : toToken.address)
      : toToken.address;

    const payload = {
      fromToken: fromTokenParam,
      toToken: toTokenParam,
      amount: fromAmount,
      chain: chainParam,
      slippage: slippage,
      walletAddress: walletAddress
    };

    // Show confirmation dialog
    setConfirmDialogData({
      type: 'swap',
      payload: payload,
      summary: {
        from: `${fromAmount} ${fromToken.symbol}`,
        to: `~${toAmount} ${toToken.symbol}`,
        amount: fromAmount,
        estimatedOutput: toAmount,
        fee: quoteData?.fee || 'Unknown',
        slippage: `${slippage}%`,
        chain: chain,
        walletAddress: walletAddress
      }
    });
    setConfirmDialogOpen(true);
  };

  const executeSwap = async () => {
    if (!confirmDialogData) return;
    
    // Re-check session before execution
    const sessionCheck = checkSessionForPayment();
    if (!sessionCheck.valid) {
      if (sessionCheck.needsRenewal) {
        setShowRenewalModal(true);
      }
      setConfirmDialogOpen(false);
      return;
    }
    
    setIsProcessing(true);
    try {
      console.log(`🚀 Executing swap via Trade Center`);
      
      const response = await fetch('/api/tradecenter/swap/execute', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionToken || ''}`
        },
        body: JSON.stringify(confirmDialogData.payload)
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Swap execution failed');
      }

      const tx = result.transaction;
      
      // Close confirmation, show success
      setConfirmDialogOpen(false);
      setSuccessDialogData({
        type: 'swap',
        txHash: tx?.hash || tx?.id,
        details: {
          from: confirmDialogData.summary.from,
          to: confirmDialogData.summary.to,
          txHash: tx?.hash || tx?.id,
          timestamp: new Date().toISOString()
        }
      });
      setSuccessDialogOpen(true);
      
      console.log(`✅ Swap complete:`, tx);

      // Reset form
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
      setConfirmDialogOpen(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBridge = async () => {
    if (!fromAmount) {
      toast({
        title: "Invalid Bridge",
        description: "Please enter an amount",
        variant: "destructive"
      });
      return;
    }

    if (!hasWalletForChain) {
      toast({
        title: "Wallet Required",
        description: "Connect wallet to bridge",
        variant: "destructive"
      });
      return;
    }

    const walletAddress = chainWallet?.address || '';
    if (!walletAddress) {
      toast({
        title: "Error",
        description: "Wallet address not found",
        variant: "destructive"
      });
      return;
    }

    const payload = {
      fromChain: chain,
      toChain: 'Ethereum', // This would be dynamic in full implementation
      token: fromToken.address,
      amount: fromAmount,
      walletAddress: walletAddress
    };

    setConfirmDialogData({
      type: 'bridge',
      payload: payload,
      summary: {
        from: `${fromAmount} ${fromToken.symbol} on ${chain}`,
        to: `${fromAmount} ${fromToken.symbol} on Ethereum`,
        amount: fromAmount,
        fromChain: chain,
        toChain: 'Ethereum',
        walletAddress: walletAddress
      }
    });
    setConfirmDialogOpen(true);
  };

  const executeBridge = async () => {
    if (!confirmDialogData) return;
    
    setIsProcessing(true);
    try {
      const response = await fetch('/api/tradecenter/bridge/execute', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
        },
        body: JSON.stringify(confirmDialogData.payload)
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Bridge execution failed');
      }

      setConfirmDialogOpen(false);
      setSuccessDialogData({
        type: 'bridge',
        txHash: result.transaction?.hash,
        details: {
          from: confirmDialogData.summary.from,
          to: confirmDialogData.summary.to,
          txHash: result.transaction?.hash,
          timestamp: new Date().toISOString()
        }
      });
      setSuccessDialogOpen(true);
      
      setFromAmount('');
      setToAmount('');
    } catch (error: any) {
      console.error('Bridge error:', error);
      toast({
        title: "Bridge Failed",
        description: error.message || "Transaction failed",
        variant: "destructive"
      });
      setConfirmDialogOpen(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLimitOrder = async () => {
    if (!fromToken || !toToken || !fromAmount || !limitOrderPrice) {
      toast({
        title: "Invalid Order",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    if (!hasPrivateKeys) {
      toast({
        title: "Private Keys Required",
        description: "Unlock Riddle Wallet to place limit orders",
        variant: "destructive"
      });
      return;
    }

    const walletAddress = chainWallet?.address || '';
    if (!walletAddress) {
      toast({
        title: "Error",
        description: "Wallet address not found",
        variant: "destructive"
      });
      return;
    }

    const price = parseFloat(limitOrderPrice);
    const fromTokenParam = fromToken.issuer ? `${fromToken.address}.${fromToken.issuer}` : fromToken.address;
    const toTokenParam = toToken.issuer ? `${toToken.address}.${toToken.issuer}` : toToken.address;

    const payload = {
      baseToken: fromTokenParam,
      quoteToken: toTokenParam,
      amount: fromAmount,
      price: price,
      side: 'sell',
      walletAddress: walletAddress,
      takeProfit: takeProfitPrice ? parseFloat(takeProfitPrice) : undefined,
      stopLoss: stopLossPrice ? parseFloat(stopLossPrice) : undefined
    };

    let description = `Sell ${fromAmount} ${fromToken.symbol} at ${price.toFixed(6)}`;
    if (takeProfitPrice) description += ` | TP: ${takeProfitPrice}`;
    if (stopLossPrice) description += ` | SL: ${stopLossPrice}`;

    setConfirmDialogData({
      type: 'limit',
      payload: payload,
      summary: {
        from: `${fromAmount} ${fromToken.symbol}`,
        to: toToken.symbol,
        amount: fromAmount,
        price: price.toFixed(6),
        side: 'Sell',
        takeProfit: takeProfitPrice || 'None',
        stopLoss: stopLossPrice || 'None',
        description: description
      }
    });
    setConfirmDialogOpen(true);
  };

  const executeLimitOrder = async () => {
    if (!confirmDialogData) return;
    
    setIsProcessing(true);
    try {
      const response = await fetch('/api/tradecenter/limit/create', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
        },
        body: JSON.stringify(confirmDialogData.payload)
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Order creation failed');
      }

      setConfirmDialogOpen(false);
      setSuccessDialogData({
        type: 'limit',
        txHash: result.offerSequence,
        details: {
          description: confirmDialogData.summary.description,
          offerSequence: result.offerSequence,
          timestamp: new Date().toISOString()
        }
      });
      setSuccessDialogOpen(true);
      
      setFromAmount('');
      setToAmount('');
      setLimitOrderPrice('');
      setTakeProfitPrice('');
      setStopLossPrice('');
    } catch (error: any) {
      console.error('Limit order error:', error);
      toast({
        title: "Order Failed",
        description: error.message || "Transaction failed",
        variant: "destructive"
      });
      setConfirmDialogOpen(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLiquidity = async () => {
    if (!fromToken || !toToken || !fromAmount || !toAmount) {
      toast({
        title: "Invalid Liquidity",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    if (!hasPrivateKeys) {
      toast({
        title: "Private Keys Required",
        description: "Unlock Riddle Wallet to add liquidity",
        variant: "destructive"
      });
      return;
    }

    const walletAddress = chainWallet?.address || '';
    if (!walletAddress) {
      toast({
        title: "Error",
        description: "Wallet address not found",
        variant: "destructive"
      });
      return;
    }

    const asset1 = fromToken.issuer ? `${fromToken.address}.${fromToken.issuer}` : fromToken.address;
    const asset2 = toToken.issuer ? `${toToken.address}.${toToken.issuer}` : toToken.address;

    const payload = {
      asset1: asset1,
      asset2: asset2,
      amount1: fromAmount,
      amount2: toAmount,
      walletAddress: walletAddress,
      createNew: createNewPool,
      mode: liquidityMode
    };

    setConfirmDialogData({
      type: 'liquidity',
      payload: payload,
      summary: {
        from: `${fromAmount} ${fromToken.symbol}`,
        to: `${toAmount} ${toToken.symbol}`,
        amount: fromAmount,
        amount2: toAmount,
        poolShare: liquidityData?.poolShare || 'Unknown',
        mode: liquidityMode === 'single' ? 'Single-Sided' : 'Double-Sided',
        createNew: createNewPool,
        pool: `${fromToken.symbol}/${toToken.symbol}`
      }
    });
    setConfirmDialogOpen(true);
  };

  const executeLiquidity = async () => {
    if (!confirmDialogData) return;
    
    setIsProcessing(true);
    try {
      const response = await fetch('/api/tradecenter/liquidity/add', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
        },
        body: JSON.stringify(confirmDialogData.payload)
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Liquidity operation failed');
      }

      setConfirmDialogOpen(false);
      setSuccessDialogData({
        type: 'liquidity',
        txHash: result.transaction?.hash,
        details: {
          pool: confirmDialogData.summary.pool,
          amount1: confirmDialogData.summary.from,
          amount2: confirmDialogData.summary.to,
          poolShare: confirmDialogData.summary.poolShare,
          createNew: confirmDialogData.summary.createNew,
          txHash: result.transaction?.hash,
          timestamp: new Date().toISOString()
        }
      });
      setSuccessDialogOpen(true);
      
      setFromAmount('');
      setToAmount('');
      setLiquidityData(null);
      setCreateNewPool(false);
    } catch (error: any) {
      console.error('Liquidity error:', error);
      toast({
        title: "Operation Failed",
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
    <>
      <style>{styles}</style>
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

            <Tabs value={tab} onChange={(_, v) => setTab(v)}>
              <Tab value="swap" label="Swap" />
              <Tab value="bridge" label="Bridge" />
              <Tab value="limit" label="Limit" />
              <Tab value="liquidity" label="Liquidity" />
            </Tabs>

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

          {tab === 'bridge' && (
            <Box>
              <Alert severity="info" sx={{ mb: 3 }}>
                Cross-chain bridge powered by secure relayers
              </Alert>

              <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'background.default' }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="caption" color="text.secondary" fontWeight="bold">
                    From Chain
                  </Typography>
                </Box>
                
                <FormControl fullWidth>
                  <Select
                    value={chain}
                    onChange={(e) => {
                      setChain(e.target.value as Chain);
                      setFromToken(NATIVE_TOKENS[e.target.value as Chain]);
                    }}
                  >
                    {(Object.keys(NATIVE_TOKENS) as Chain[]).map((c) => (
                      <MenuItem key={c} value={c}>{c}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Box display="flex" gap={2} alignItems="center" mt={2}>
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
                  
                  <Button variant="outlined" sx={{ minWidth: 140, height: 48 }}>
                    {fromToken.logoURI && (
                      <Avatar src={fromToken.logoURI} sx={{ width: 24, height: 24, mr: 1 }} />
                    )}
                    <Typography variant="body2" fontWeight="bold">
                      {fromToken.symbol}
                    </Typography>
                  </Button>
                </Box>
              </Paper>

              <Box display="flex" justifyContent="center" my={-2} position="relative" zIndex={1}>
                <IconButton
                  onClick={() => {}}
                  sx={{
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    border: '4px solid',
                    borderColor: 'background.default',
                    '&:hover': { bgcolor: 'primary.dark' }
                  }}
                >
                  <ArrowDownward />
                </IconButton>
              </Box>

              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="caption" color="text.secondary" fontWeight="bold">
                    To Chain
                  </Typography>
                </Box>
                
                <FormControl fullWidth>
                  <Select value="Ethereum" onChange={() => {}}>
                    {(Object.keys(NATIVE_TOKENS) as Chain[]).filter(c => c !== chain).map((c) => (
                      <MenuItem key={c} value={c}>{c}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Box display="flex" gap={2} alignItems="center" mt={2}>
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
                  
                  <Button variant="outlined" sx={{ minWidth: 140, height: 48 }}>
                    <Typography variant="body2" fontWeight="bold">
                      {fromToken.symbol}
                    </Typography>
                  </Button>
                </Box>
              </Paper>

              <Button
                fullWidth
                variant="contained"
                size="large"
                onClick={handleBridge}
                disabled={!fromAmount || !hasWalletForChain || isSwapping}
                sx={{ mt: 3, py: 1.5 }}
              >
                {isSwapping ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  `Bridge ${fromToken.symbol}`
                )}
              </Button>
            </Box>
          )}

          {tab === 'limit' && chain !== 'XRPL' && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Limit orders are currently only available on XRPL. Switch to XRPL to place limit orders.
            </Alert>
          )}

          {chain === 'XRPL' && tab === 'limit' && (
            <Box>
              <Alert severity="info" sx={{ mb: 3 }}>
                Place limit orders on XRPL DEX order book
              </Alert>

              <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'background.default' }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="caption" color="text.secondary" fontWeight="bold">
                    You Sell
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
                    onClick={() => setTokenSearchOpen('from')}
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

              <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'background.default' }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="caption" color="text.secondary" fontWeight="bold">
                    You Buy
                  </Typography>
                </Box>
                
                <Box display="flex" gap={2} alignItems="center">
                  <TextField
                    fullWidth
                    placeholder="0.00"
                    type="number"
                    value={toAmount}
                    onChange={(e) => setToAmount(e.target.value)}
                    InputProps={{
                      sx: { fontSize: '1.5rem', fontWeight: 'bold' }
                    }}
                    variant="standard"
                  />
                  
                  <Button
                    variant="outlined"
                    onClick={() => setTokenSearchOpen('to')}
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

              <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Typography variant="caption" color="text.secondary" fontWeight="bold">Limit Price</Typography>
                <TextField
                  fullWidth
                  placeholder="0.00"
                  type="number"
                  value={limitOrderPrice}
                  onChange={(e) => setLimitOrderPrice(e.target.value)}
                  InputProps={{
                    sx: { fontSize: '1.2rem', fontWeight: 'bold' }
                  }}
                  variant="standard"
                  helperText={toToken ? `Price per ${toToken.symbol}` : 'Select tokens first'}
                />
              </Paper>

              <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'success.light' }}>
                <Typography variant="caption" color="text.primary" fontWeight="bold" gutterBottom display="block">
                  Advanced Settings (Optional)
                </Typography>
                
                <Box mt={2}>
                  <Typography variant="caption" color="text.secondary">Take Profit Price</Typography>
                  <TextField
                    fullWidth
                    placeholder="0.00"
                    type="number"
                    value={takeProfitPrice}
                    onChange={(e) => setTakeProfitPrice(e.target.value)}
                    variant="standard"
                    helperText="Auto-sell when price reaches this level"
                    sx={{ mb: 2 }}
                  />
                </Box>

                <Box>
                  <Typography variant="caption" color="text.secondary">Stop Loss Price</Typography>
                  <TextField
                    fullWidth
                    placeholder="0.00"
                    type="number"
                    value={stopLossPrice}
                    onChange={(e) => setStopLossPrice(e.target.value)}
                    variant="standard"
                    helperText="Auto-sell to limit losses"
                  />
                </Box>
              </Paper>

              <Button
                fullWidth
                variant="contained"
                size="large"
                onClick={handleLimitOrder}
                disabled={!fromToken || !toToken || !fromAmount || !toAmount || !hasPrivateKeys || isSwapping}
                sx={{ mt: 3, py: 1.5 }}
              >
                {isSwapping ? (
                  <CircularProgress size={24} color="inherit" />
                ) : !hasPrivateKeys ? (
                  'Unlock Riddle Wallet'
                ) : (
                  `Place Limit Order`
                )}
              </Button>
            </Box>
          )}

          {tab === 'liquidity' && chain !== 'XRPL' && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Liquidity provision is currently only available on XRPL AMM. Switch to XRPL to add liquidity.
            </Alert>
          )}

          {chain === 'XRPL' && tab === 'liquidity' && (
            <Box>
              {createNewPool ? (
                <Alert severity="warning" sx={{ mb: 3 }}>
                  <strong>Pool doesn't exist!</strong> You'll create a new AMM pool for {fromToken?.symbol}/{toToken?.symbol}
                </Alert>
              ) : (
                <Alert severity="info" sx={{ mb: 3 }}>
                  Add liquidity to XRPL AMM pools and earn fees
                </Alert>
              )}

              <Box display="flex" gap={1} mb={2}>
                <Button
                  variant={liquidityMode === 'single' ? 'contained' : 'outlined'}
                  onClick={() => {
                    setLiquidityMode('single');
                    setToAmount('');
                  }}
                  fullWidth
                >
                  Single-Sided
                </Button>
                <Button
                  variant={liquidityMode === 'double' ? 'contained' : 'outlined'}
                  onClick={() => setLiquidityMode('double')}
                  fullWidth
                >
                  Double-Sided
                </Button>
              </Box>

              <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'background.default' }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="caption" color="text.secondary" fontWeight="bold">
                    Token A
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
                    onClick={() => setTokenSearchOpen('from')}
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

              <Box display="flex" justifyContent="center" my={-2} position="relative" zIndex={1}>
                <Typography variant="h6" sx={{ 
                  bgcolor: 'background.paper',
                  px: 2,
                  color: 'text.secondary'
                }}>
                  +
                </Typography>
              </Box>

              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="caption" color="text.secondary" fontWeight="bold">
                    Token B {liquidityMode === 'single' ? '(Auto-calculated)' : ''}
                  </Typography>
                </Box>
                
                <Box display="flex" gap={2} alignItems="center">
                  <TextField
                    fullWidth
                    placeholder="0.00"
                    type="number"
                    value={toAmount}
                    onChange={liquidityMode === 'double' ? (e) => setToAmount(e.target.value) : undefined}
                    InputProps={{
                      readOnly: liquidityMode === 'single' && !createNewPool,
                      sx: { 
                        fontSize: '1.5rem', 
                        fontWeight: 'bold',
                        bgcolor: liquidityMode === 'single' && !createNewPool ? 'action.hover' : 'transparent'
                      }
                    }}
                    variant="standard"
                    helperText={
                      createNewPool ? "Enter amount for new pool creation" :
                      liquidityMode === 'single' && liquidityData ? "✓ Balanced for optimal pool entry" : 
                      liquidityMode === 'single' ? "Enter Token A amount first" :
                      "Enter your desired amount"
                    }
                  />
                  
                  <Button
                    variant="outlined"
                    onClick={() => setTokenSearchOpen('to')}
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

              {liquidityData && fromToken && toToken && (
                <Paper variant="outlined" sx={{ p: 2, mt: 2, bgcolor: 'success.light' }}>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="caption" color="text.primary" fontWeight="bold">
                      Pool Share
                    </Typography>
                    <Typography variant="caption" fontWeight="bold" color="success.dark">
                      {liquidityData.poolShare.formatted}
                    </Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="caption" color="text.primary">
                      LP Tokens
                    </Typography>
                    <Typography variant="caption" fontWeight="bold">
                      {liquidityData.poolShare.lpTokens}
                    </Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="caption" color="text.primary">
                      Exchange Rate
                    </Typography>
                    <Typography variant="caption" fontWeight="bold">
                      1 {fromToken.symbol} = {(parseFloat(toAmount) / parseFloat(fromAmount)).toFixed(6)} {toToken.symbol}
                    </Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="caption" color="text.primary">
                      Pool TVL
                    </Typography>
                    <Typography variant="caption" fontWeight="bold">
                      {liquidityData.pool.current.tvl} (→ {liquidityData.pool.afterDeposit.tvl})
                    </Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="caption" color="text.primary">
                      Trading Fee
                    </Typography>
                    <Typography variant="caption" fontWeight="bold">
                      {liquidityData.tradingFeePercent}%
                    </Typography>
                  </Box>
                </Paper>
              )}
              
              {!liquidityData && fromToken && toToken && fromAmount && (
                <Box sx={{ mt: 2, textAlign: 'center' }}>
                  <CircularProgress size={20} />
                  <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                    Calculating pool share...
                  </Typography>
                </Box>
              )}

              <Button
                fullWidth
                variant="contained"
                size="large"
                onClick={handleLiquidity}
                disabled={!fromToken || !toToken || !fromAmount || !toAmount || !hasPrivateKeys || isSwapping}
                sx={{ mt: 3, py: 1.5 }}
              >
                {isSwapping ? (
                  <CircularProgress size={24} color="inherit" />
                ) : !hasPrivateKeys ? (
                  'Unlock Riddle Wallet'
                ) : (
                  'Add Liquidity'
                )}
              </Button>
            </Box>
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

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialogOpen}
        onClose={() => !isProcessing && setConfirmDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box display="flex" alignItems="center" gap={1}>
            {confirmDialogData?.type === 'swap' && <SwapVert />}
            {confirmDialogData?.type === 'bridge' && <ArrowDownward />}
            {confirmDialogData?.type === 'limit' && <TrendingUp />}
            {confirmDialogData?.type === 'liquidity' && <WalletIcon />}
            <Typography variant="h6">
              Confirm {confirmDialogData?.type === 'swap' ? 'Swap' : 
                       confirmDialogData?.type === 'bridge' ? 'Bridge' : 
                       confirmDialogData?.type === 'limit' ? 'Limit Order' : 
                       'Liquidity'}
            </Typography>
          </Box>
          {!isProcessing && (
            <IconButton onClick={() => setConfirmDialogOpen(false)} sx={{ color: 'white' }}>
              <Close />
            </IconButton>
          )}
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {isProcessing ? (
            <Box display="flex" flexDirection="column" alignItems="center" gap={3} py={4}>
              <CircularProgress size={60} />
              <Typography variant="h6" color="text.secondary">
                Processing Transaction...
              </Typography>
              <Typography variant="body2" color="text.secondary" textAlign="center">
                Please wait while your transaction is being submitted to the blockchain.
                <br />
                Do not close this window.
              </Typography>
            </Box>
          ) : (
            <>
              {/* Transaction Summary */}
              <Paper elevation={0} sx={{ bgcolor: 'grey.50', p: 3, mb: 3, borderRadius: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Transaction Summary
                </Typography>
                <Divider sx={{ my: 2 }} />
                
                {confirmDialogData?.type === 'swap' && (
                  <>
                    <Box display="flex" justifyContent="space-between" mb={1.5}>
                      <Typography variant="body2" color="text.secondary">From:</Typography>
                      <Typography variant="body2" fontWeight="bold">{confirmDialogData.summary.from}</Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between" mb={1.5}>
                      <Typography variant="body2" color="text.secondary">To (Estimated):</Typography>
                      <Typography variant="body2" fontWeight="bold">{confirmDialogData.summary.to}</Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between" mb={1.5}>
                      <Typography variant="body2" color="text.secondary">Slippage Tolerance:</Typography>
                      <Typography variant="body2">{confirmDialogData.summary.slippage}</Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between" mb={1.5}>
                      <Typography variant="body2" color="text.secondary">Network Fee:</Typography>
                      <Typography variant="body2">{confirmDialogData.summary.fee}</Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Chain:</Typography>
                      <Typography variant="body2">{confirmDialogData.summary.chain}</Typography>
                    </Box>
                  </>
                )}

                {confirmDialogData?.type === 'bridge' && (
                  <>
                    <Box display="flex" justifyContent="space-between" mb={1.5}>
                      <Typography variant="body2" color="text.secondary">From:</Typography>
                      <Typography variant="body2" fontWeight="bold">{confirmDialogData.summary.from}</Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between" mb={1.5}>
                      <Typography variant="body2" color="text.secondary">To:</Typography>
                      <Typography variant="body2" fontWeight="bold">{confirmDialogData.summary.to}</Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between" mb={1.5}>
                      <Typography variant="body2" color="text.secondary">Amount:</Typography>
                      <Typography variant="body2">{confirmDialogData.summary.amount}</Typography>
                    </Box>
                  </>
                )}

                {confirmDialogData?.type === 'limit' && (
                  <>
                    <Box display="flex" justifyContent="space-between" mb={1.5}>
                      <Typography variant="body2" color="text.secondary">Order Type:</Typography>
                      <Chip label={confirmDialogData.summary.side} size="small" color="error" />
                    </Box>
                    <Box display="flex" justifyContent="space-between" mb={1.5}>
                      <Typography variant="body2" color="text.secondary">Amount:</Typography>
                      <Typography variant="body2" fontWeight="bold">{confirmDialogData.summary.from}</Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between" mb={1.5}>
                      <Typography variant="body2" color="text.secondary">Price:</Typography>
                      <Typography variant="body2" fontWeight="bold">{confirmDialogData.summary.price} {confirmDialogData.summary.to}</Typography>
                    </Box>
                    {confirmDialogData.summary.takeProfit !== 'None' && (
                      <Box display="flex" justifyContent="space-between" mb={1.5}>
                        <Typography variant="body2" color="text.secondary">Take Profit:</Typography>
                        <Typography variant="body2" color="success.main">{confirmDialogData.summary.takeProfit}</Typography>
                      </Box>
                    )}
                    {confirmDialogData.summary.stopLoss !== 'None' && (
                      <Box display="flex" justifyContent="space-between" mb={1.5}>
                        <Typography variant="body2" color="text.secondary">Stop Loss:</Typography>
                        <Typography variant="body2" color="error.main">{confirmDialogData.summary.stopLoss}</Typography>
                      </Box>
                    )}
                  </>
                )}

                {confirmDialogData?.type === 'liquidity' && (
                  <>
                    <Box display="flex" justifyContent="space-between" mb={1.5}>
                      <Typography variant="body2" color="text.secondary">Pool:</Typography>
                      <Typography variant="body2" fontWeight="bold">{confirmDialogData.summary.pool}</Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between" mb={1.5}>
                      <Typography variant="body2" color="text.secondary">Mode:</Typography>
                      <Chip label={confirmDialogData.summary.mode} size="small" color="primary" />
                    </Box>
                    {confirmDialogData.summary.createNew && (
                      <Box display="flex" justifyContent="space-between" mb={1.5}>
                        <Typography variant="body2" color="text.secondary">Action:</Typography>
                        <Chip label="Create New Pool" size="small" color="warning" />
                      </Box>
                    )}
                    <Box display="flex" justifyContent="space-between" mb={1.5}>
                      <Typography variant="body2" color="text.secondary">Token A:</Typography>
                      <Typography variant="body2" fontWeight="bold">{confirmDialogData.summary.from}</Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between" mb={1.5}>
                      <Typography variant="body2" color="text.secondary">Token B:</Typography>
                      <Typography variant="body2" fontWeight="bold">{confirmDialogData.summary.to}</Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Pool Share:</Typography>
                      <Typography variant="body2" color="success.main">{confirmDialogData.summary.poolShare}</Typography>
                    </Box>
                  </>
                )}
              </Paper>

              {/* Transaction Payload */}
              <Paper elevation={0} sx={{ bgcolor: 'grey.900', p: 2, mb: 3, borderRadius: 2 }}>
                <Typography variant="subtitle2" color="grey.400" gutterBottom>
                  Transaction Payload
                </Typography>
                <Box sx={{ maxHeight: 200, overflow: 'auto', mt: 1 }}>
                  <pre style={{ margin: 0, color: '#4ade80', fontSize: '11px', fontFamily: 'monospace' }}>
                    {JSON.stringify(confirmDialogData?.payload, null, 2)}
                  </pre>
                </Box>
              </Paper>

              {/* Disclaimer */}
              <Alert severity="warning" sx={{ mb: 3 }}>
                <Typography variant="body2" fontWeight="bold" gutterBottom>
                  ⚠️ Important Disclaimer
                </Typography>
                <Typography variant="caption" component="div" sx={{ mt: 1 }}>
                  • Please review all transaction details carefully before confirming
                  <br />
                  • Transactions on the blockchain are irreversible
                  <br />
                  • Network fees will be deducted from your wallet
                  <br />
                  • Slippage may cause final amounts to differ from estimates
                  <br />
                  • Always verify token addresses and amounts before proceeding
                </Typography>
              </Alert>

              {/* Action Buttons */}
              <Box display="flex" gap={2}>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => setConfirmDialogOpen(false)}
                  disabled={isProcessing}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={() => {
                    if (confirmDialogData?.type === 'swap') executeSwap();
                    else if (confirmDialogData?.type === 'bridge') executeBridge();
                    else if (confirmDialogData?.type === 'limit') executeLimitOrder();
                    else if (confirmDialogData?.type === 'liquidity') executeLiquidity();
                  }}
                  disabled={isProcessing}
                  sx={{ bgcolor: 'primary.main' }}
                >
                  Confirm & Sign
                </Button>
              </Box>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog
        open={successDialogOpen}
        onClose={() => setSuccessDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogContent sx={{ textAlign: 'center', py: 5 }}>
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              bgcolor: 'success.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
              animation: 'scaleIn 0.3s ease-out'
            }}
          >
            <Typography variant="h2" color="white">✓</Typography>
          </Box>
          
          <Typography variant="h5" fontWeight="bold" gutterBottom>
            Transaction Successful!
          </Typography>
          
          <Typography variant="body2" color="text.secondary" paragraph>
            {successDialogData?.type === 'swap' && 'Your swap has been completed successfully'}
            {successDialogData?.type === 'bridge' && 'Your bridge transaction has been submitted'}
            {successDialogData?.type === 'limit' && 'Your limit order has been placed on the DEX'}
            {successDialogData?.type === 'liquidity' && 'Liquidity has been added to the pool'}
          </Typography>

          <Paper elevation={0} sx={{ bgcolor: 'grey.50', p: 3, mt: 3, mb: 3, textAlign: 'left' }}>
            {successDialogData?.type === 'swap' && (
              <>
                <Box display="flex" justifyContent="space-between" mb={1.5}>
                  <Typography variant="body2" color="text.secondary">From:</Typography>
                  <Typography variant="body2" fontWeight="bold">{successDialogData.details.from}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" mb={1.5}>
                  <Typography variant="body2" color="text.secondary">To:</Typography>
                  <Typography variant="body2" fontWeight="bold">{successDialogData.details.to}</Typography>
                </Box>
              </>
            )}
            
            {successDialogData?.type === 'bridge' && (
              <>
                <Box display="flex" justifyContent="space-between" mb={1.5}>
                  <Typography variant="body2" color="text.secondary">From:</Typography>
                  <Typography variant="body2" fontWeight="bold">{successDialogData.details.from}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" mb={1.5}>
                  <Typography variant="body2" color="text.secondary">To:</Typography>
                  <Typography variant="body2" fontWeight="bold">{successDialogData.details.to}</Typography>
                </Box>
              </>
            )}
            
            {successDialogData?.type === 'limit' && (
              <>
                <Box display="flex" justifyContent="space-between" mb={1.5}>
                  <Typography variant="body2" color="text.secondary">Order:</Typography>
                  <Typography variant="body2" fontWeight="bold">{successDialogData.details.description}</Typography>
                </Box>
                {successDialogData.details.offerSequence && (
                  <Box display="flex" justifyContent="space-between" mb={1.5}>
                    <Typography variant="body2" color="text.secondary">Offer ID:</Typography>
                    <Typography variant="body2">{successDialogData.details.offerSequence}</Typography>
                  </Box>
                )}
              </>
            )}
            
            {successDialogData?.type === 'liquidity' && (
              <>
                <Box display="flex" justifyContent="space-between" mb={1.5}>
                  <Typography variant="body2" color="text.secondary">Pool:</Typography>
                  <Typography variant="body2" fontWeight="bold">{successDialogData.details.pool}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" mb={1.5}>
                  <Typography variant="body2" color="text.secondary">Added:</Typography>
                  <Typography variant="body2">{successDialogData.details.amount1} + {successDialogData.details.amount2}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" mb={1.5}>
                  <Typography variant="body2" color="text.secondary">Pool Share:</Typography>
                  <Typography variant="body2" color="success.main">{successDialogData.details.poolShare}</Typography>
                </Box>
              </>
            )}
            
            {successDialogData?.txHash && (
              <>
                <Divider sx={{ my: 2 }} />
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Transaction Hash:</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '10px' }}>
                    {successDialogData.txHash.substring(0, 8)}...{successDialogData.txHash.substring(successDialogData.txHash.length - 8)}
                  </Typography>
                </Box>
              </>
            )}
          </Paper>

          <Box display="flex" gap={2}>
            {successDialogData?.txHash && (
              <Button
                variant="outlined"
                fullWidth
                onClick={() => {
                  const explorerUrl = chain === 'XRPL' 
                    ? `https://livenet.xrpl.org/transactions/${successDialogData.txHash}`
                    : `https://etherscan.io/tx/${successDialogData.txHash}`;
                  window.open(explorerUrl, '_blank');
                }}
              >
                View on Explorer
              </Button>
            )}
            <Button
              variant="contained"
              fullWidth
              onClick={() => setSuccessDialogOpen(false)}
            >
              Done
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

      <SessionRenewalModal 
        open={showRenewalModal}
        onOpenChange={setShowRenewalModal}
      />
      </Container>
    </>
  );
}
