import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowDownUp, ArrowRightLeft, Settings, ChevronDown, Wallet, TrendingUp, RefreshCw, Zap, Star, Lock, Search, Loader2, AlertTriangle, CheckCircle, Clock, Send, ArrowRight, ExternalLink, X, Smartphone, Copy, QrCode } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useQueryClient } from '@tanstack/react-query';
import SwipeConfirm from './SwipeConfirm';
import { getSessionToken } from '@/utils/auth';
import { connectPhantom as connectPhantomSolana, isPhantomInstalled, disconnectPhantom } from '@/utils/solanaWalletConnect';
import { QRCodeSVG } from 'qrcode.react';
import { generatePhantomConnectDeepLink, isMobileDevice as isPhantomMobile } from '@/utils/phantomDeepLink';

interface SolanaToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  chainId: number;
  price_usd?: number;
  marketCap?: number;
  volume24h?: number;
  verified?: boolean;
  source?: string;
}

interface ModernSolanaSwapProps {
  isWalletConnected: boolean;
  walletAddress: string | null;
  initialTokenAddress?: string | null;
}

const formatUsd = (amount: number): string => {
  return new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2 
  }).format(amount);
};

// Use the proper TokenLogo component - NO LOCAL FALLBACKS
import { TokenLogo } from '@/components/ui/token-logo';

export default function ModernSolanaSwap({ 
  isWalletConnected, 
  walletAddress,
  initialTokenAddress
}: ModernSolanaSwapProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State
  const [fromToken, setFromToken] = useState<SolanaToken | null>(null);
  const [toToken, setToToken] = useState<SolanaToken | null>(null);
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [minimumReceived, setMinimumReceived] = useState(""); // Minimum after slippage
  const [exchangeRate, setExchangeRate] = useState("");
  
  // Handle initial token from URL parameters (from scanner)
  useEffect(() => {
    if (initialTokenAddress && !fromToken) {
      console.log('🎯 Solana Swap: Loading initial token from scanner:', initialTokenAddress);
      
      // Fetch token details and set as fromToken
      const loadInitialToken = async () => {
        try {
          // Try to fetch token data from backend
          const response = await fetch(`/api/solana/token-info?address=${initialTokenAddress}`);
          
          if (response.ok) {
            const tokenData = await response.json() as any;
            setFromToken({
              address: initialTokenAddress,
              symbol: tokenData.symbol || 'TOKEN',
              name: tokenData.name || 'Unknown Token',
              decimals: tokenData.decimals || 9,
              logoURI: tokenData.logoURI,
              chainId: 101, // Solana mainnet
              price_usd: tokenData.price_usd,
              verified: tokenData.verified
            });
            console.log('✅ Solana Swap: Loaded initial token:', tokenData);
          } else {
            // Fallback: set basic token info
            setFromToken({
              address: initialTokenAddress,
              symbol: 'TOKEN',
              name: 'Token',
              decimals: 9,
              chainId: 101
            });
          }
        } catch (error) {
          console.error('Failed to load initial token:', error);
        }
      };
      
      loadInitialToken();
    }
  }, [initialTokenAddress, fromToken]);
  const [isLoading, setIsLoading] = useState(false);

  // Format small numbers properly for exchange rates
  const formatExchangeRate = (rate: number): string => {
    if (rate === 0) return "0";
    if (rate >= 1) return rate.toLocaleString('en-US', { maximumFractionDigits: 6 });
    if (rate >= 0.000001) return rate.toFixed(8);
    if (rate >= 0.00000001) return rate.toFixed(10);
    return rate.toExponential(3);
  };
  
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [priceImpact, setPriceImpact] = useState("");
  const [platformFee, setPlatformFee] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [slippage, setSlippage] = useState(1); // Default 1% slippage tolerance for Solana
  const [actualSlippage, setActualSlippage] = useState(1); // Actual slippage used by backend
  const [showSettings, setShowSettings] = useState(false);
  const [currentBalance, setCurrentBalance] = useState("0.00");
  
  // Live token search results only
  const [allTokens, setAllTokens] = useState<SolanaToken[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [selectingFor, setSelectingFor] = useState<'from' | 'to'>('from');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  
  // Multi-DEX comparison states
  const [multiDexQuotes, setMultiDexQuotes] = useState<any[]>([]);
  const [bestPrice, setBestPrice] = useState<any>(null);
  const [showPriceComparison, setShowPriceComparison] = useState(false);
  
  // Wallet selection
  const [selectedWallet, setSelectedWallet] = useState<'riddle' | 'metamask' | 'phantom' | null>(null);
  const [solWalletAddress, setSolWalletAddress] = useState<string | null>(null);
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  
  // Mobile wallet deep link modal (for Phantom mobile)
  const [showMobileWalletModal, setShowMobileWalletModal] = useState(false);
  const [mobileWalletDeepLink, setMobileWalletDeepLink] = useState('');
  const [mobileWalletQRData, setMobileWalletQRData] = useState('');
  const [mobileWalletName, setMobileWalletName] = useState<'Phantom' | ''>('');

  // Progress tracking states
  const [swapStatus, setSwapStatus] = useState<'idle' | 'preparing' | 'signing' | 'submitting' | 'success' | 'error'>('idle');
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [swapProgress, setSwapProgress] = useState({
    step: 1,
    totalSteps: 3,
    message: '',
    txHash: '',
    error: '',
    fromAmount: '',
    toAmount: '',
    fromSymbol: '',
    toSymbol: '',
    feeDetails: null as {
      originalAmount: string;
      platformFee: string;
      actualAmount: string;
      networkFee: string;
    } | null
  });

  // Load default tokens on mount
  useEffect(() => {
    loadDefaultTokens();
  }, []);

  // Fetch balance when wallet connects or token changes
  useEffect(() => {
    if (isWalletConnected && walletAddress) {
      fetchBalance(fromToken || undefined);
    }
  }, [isWalletConnected, walletAddress, fromToken]);

  // Calculate exchange rate with debouncing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (fromToken && toToken && fromAmount && parseFloat(fromAmount) > 0) {
        calculateExchangeRate();
      } else {
        setToAmount("");
        setExchangeRate("");
        setMinimumReceived("");
        setPriceImpact("");
        setPlatformFee("");
      }
    }, 800);
    
    return () => clearTimeout(timeoutId);
  }, [fromToken, toToken, fromAmount, slippage]);

  const loadDefaultTokens = async () => {
    try {
      setIsLoadingTokens(true);
      
      // Use cached popular tokens first for better performance
      const popularTokens: SolanaToken[] = [
        {
          symbol: 'SOL',
          name: 'Solana',
          address: 'So11111111111111111111111111111111111111112',
          decimals: 9,
          logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
          chainId: 101,
          verified: true
        },
        {
          symbol: 'USDC',
          name: 'USD Coin',
          address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          decimals: 6,
          logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
          chainId: 101,
          verified: true
        },
        {
          symbol: 'USDT',
          name: 'Tether USD',
          address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
          decimals: 6,
          logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png',
          chainId: 101,
          verified: true
        }
      ];
      
      setAllTokens(popularTokens);
      
      // Set default tokens without additional API call
      const solToken = popularTokens[0]; // SOL
      const usdcToken = popularTokens[1]; // USDC
      
      if (solToken && !fromToken) {
        setFromToken(solToken);
        if (isWalletConnected && walletAddress) {
          fetchBalance(solToken);
        }
      }
      if (usdcToken && !toToken) setToToken(usdcToken);
        
    } catch (error) {
      console.error('Failed to load default tokens:', error);
    } finally {
      setIsLoadingTokens(false);
    }
  };

  // Live token search - ALWAYS make fresh API calls (includes Pump.fun tokens)
  const searchTokensLive = async (query: string) => {
    if (!query || query.trim().length < 1) {
      loadDefaultTokens();
      return;
    }

    try {
      setIsLoadingTokens(true);
      console.log(`🔍 Live API search for Solana tokens: "${query}"`);
      
      // Search both Jupiter/standard tokens and Pump.fun tokens simultaneously
      const [jupiterResponse, pumpfunResponse] = await Promise.all([
        fetch(`/api/solana/tokens/search?query=${encodeURIComponent(query.trim())}`).catch(() => null),
        fetch(`/api/pump-fun/search?q=${encodeURIComponent(query.trim())}`).catch(() => null)
      ]);
      
      let allFoundTokens: SolanaToken[] = [];
      
      // Process Jupiter/standard tokens
      if (jupiterResponse && jupiterResponse.ok) {
        const jupiterData = await jupiterResponse.json();
        if (jupiterData && jupiterData.tokens && jupiterData.tokens.length > 0) {
          const jupiterTokens = jupiterData.tokens.map((token: any) => ({
            address: token.address,
            symbol: token.symbol,
            name: token.name,
            decimals: token.decimals,
            logoURI: token.logoURI || token.logo_url || token.icon_url || 
                     `https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/${token.address}/logo.png`,
            chainId: token.chainId || 101,
            price_usd: token.price_usd || token.price || 0,
            volume24h: token.volume24h || token.volume_24h || 0,
            verified: token.verified || false,
            source: 'jupiter'
          }));
          allFoundTokens = [...allFoundTokens, ...jupiterTokens];
          console.log(`✅ Found ${jupiterTokens.length} tokens from Jupiter`);
        }
      }
      
      // Process Pump.fun tokens
      if (pumpfunResponse && pumpfunResponse.ok) {
        const pumpfunData = await pumpfunResponse.json();
        if (pumpfunData && pumpfunData.tokens && pumpfunData.tokens.length > 0) {
          const pumpfunTokens = pumpfunData.tokens.map((token: any) => ({
            address: token.mint || token.address,
            symbol: token.symbol,
            name: token.name,
            decimals: token.decimals || 6, // Default to 6 decimals for Pump.fun tokens
            logoURI: token.image_uri || token.logo_url || token.icon_url,
            chainId: 101,
            price_usd: token.price || token.price_usd || 0,
            volume24h: token.volume_24h || token.volume24h || 0,
            verified: false, // Pump.fun tokens are typically newer/unverified
            source: 'pump.fun'
          }));
          allFoundTokens = [...allFoundTokens, ...pumpfunTokens];
          console.log(`✅ Found ${pumpfunTokens.length} tokens from Pump.fun`);
        }
      }
      
      // Remove duplicates based on address and sort by source (Jupiter first, then Pump.fun)
      const uniqueTokens = allFoundTokens.filter((token, index, arr) => 
        arr.findIndex(t => t.address === token.address) === index
      ).sort((a, b) => {
        if (a.source === 'jupiter' && b.source === 'pump.fun') return -1;
        if (a.source === 'pump.fun' && b.source === 'jupiter') return 1;
        return 0;
      });
      
      setAllTokens(uniqueTokens);
      console.log(`✅ Total found: ${uniqueTokens.length} unique tokens`);
      
    } catch (error) {
      console.error('Token search API error:', error);
      setAllTokens([]);
    } finally {
      setIsLoadingTokens(false);
    }
  };

  // Fetch live balance for connected wallet
  const fetchBalance = async (token?: SolanaToken) => {
    if (!isWalletConnected || !walletAddress) return;
    
    try {
      const targetToken = token || fromToken;
      
      if (!targetToken) {
        console.log(`🔍 Fetching SOL balance for ${walletAddress}`);
        const response = await fetch(`/api/solana/balance/${walletAddress}`);
        
        if (!response.ok) {
          setCurrentBalance('0');
          return;
        }
        
        const data = await response.json() as any;
        
        if (data.success && data.balance !== undefined) {
          const walletBalance = parseFloat(data.balance).toFixed(6);
          setCurrentBalance(walletBalance);
          console.log(`✅ Updated SOL balance: ${walletBalance} SOL`);
        } else {
          setCurrentBalance('0');
        }
      } else {
        console.log(`🔍 Fetching ${targetToken.symbol} balance for ${walletAddress}`);
        
        const response = await fetch(`/api/solana/token-balance/${walletAddress}/${targetToken.address}`);
        
        if (!response.ok) {
          setCurrentBalance('0');
          return;
        }
        
        const data = await response.json() as any;
        
        if (data.success && data.balance !== undefined) {
          const tokenBalance = parseFloat(data.balance).toFixed(6);
          setCurrentBalance(tokenBalance);
          console.log(`✅ Updated ${targetToken.symbol} balance: ${tokenBalance}`);
        } else {
          setCurrentBalance('0');
        }
      }
    } catch (error) {
      console.error('Balance fetch error:', error);
      setCurrentBalance('0');
    }
  };

  const calculateExchangeRate = async () => {
    if (!fromToken || !toToken || !fromAmount || parseFloat(fromAmount) <= 0) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`🔍 Getting Jupiter quote: ${fromAmount} ${fromToken.symbol} → ${toToken.symbol}`);
      
      // Get Jupiter quote from backend for live rates
      const response = await fetch('/api/solana/swap/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputMint: fromToken.address,
          outputMint: toToken.address,
          amount: Math.floor(parseFloat(fromAmount) * Math.pow(10, fromToken.decimals)).toString(),
          slippageBps: Math.floor(slippage * 100)
        })
      });
      
      if (response.ok) {
        const data = await response.json() as any;
        if (data.success && data.quote) {
          const outputAmount = parseFloat(data.quote.outAmount) / Math.pow(10, toToken.decimals);
          const rate = outputAmount / parseFloat(fromAmount);
          
          setToAmount(outputAmount.toFixed(6));
          setExchangeRate(formatExchangeRate(rate));
          
          // Store multi-DEX comparison data
          if (data.multiDexQuotes && data.multiDexQuotes.length > 0) {
            setMultiDexQuotes(data.multiDexQuotes);
            setBestPrice(data.bestPrice);
            console.log(`🔍 Multi-DEX comparison: ${data.multiDexQuotes.length} sources checked`);
            console.log(`🏆 Best price: ${data.bestPrice?.outputAmount} from ${data.bestPrice?.dex}`);
          }
          
          // Calculate minimum received with slippage
          const minimum = outputAmount * (1 - slippage / 100);
          setMinimumReceived(minimum.toFixed(6));
          
          // Calculate price impact and fees
          if (data.quote.priceImpactPct) {
            setPriceImpact(parseFloat(data.quote.priceImpactPct).toFixed(3));
          }
          
          // Platform fee (1% in SOL)
          const swapValueUSD = parseFloat(fromAmount) * (fromToken.price_usd || 0);
          const solPrice = 200; // Should fetch live SOL price
          const solFeeAmount = (swapValueUSD * 0.01) / solPrice;
          setPlatformFee(solFeeAmount.toFixed(6));
          
          console.log(`✅ Multi-DEX Solana quote: ${fromAmount} ${fromToken.symbol} = ${outputAmount.toFixed(6)} ${toToken.symbol}`);
          if (data.bestPrice) {
            console.log(`💰 Best available rate from ${data.bestPrice.dex}`);
          }
        }
      } else {
        throw new Error('Failed to get quote');
      }
    } catch (error) {
      console.error('❌ Failed to get Solana swap quote:', error);
      setError('Failed to get swap quote. Please try again.');
      setToAmount("");
      setExchangeRate("");
      setMinimumReceived("");
      setPriceImpact("");
      setPlatformFee("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTokenSelect = (token: SolanaToken) => {
    if (selectingFor === 'from') {
      setFromToken(token);
      if (isWalletConnected && walletAddress) {
        fetchBalance(token);
      }
    } else {
      setToToken(token);
    }
    setShowTokenModal(false);
    setSearchQuery("");
  };

  const handleSwapTokens = () => {
    const tempToken = fromToken;
    const tempAmount = fromAmount;
    
    setFromToken(toToken);
    setToToken(tempToken);
    setFromAmount(toAmount);
    setToAmount(tempAmount);
    
    if (isWalletConnected && walletAddress) {
      fetchBalance(toToken || undefined);
    }
  };

  const handleSwap = async () => {
    if (!fromToken || !toToken || !fromAmount || !isWalletConnected || !walletAddress) {
      toast({
        title: "Error",
        description: !isWalletConnected || !walletAddress ? "Please login to access your Solana wallet" : "Please select tokens and enter amount",
        variant: "destructive"
      });
      return;
    }

    setSwapStatus('preparing');
    setShowProgressModal(true);
    setSwapProgress({
      step: 1,
      totalSteps: 3,
      message: 'Preparing swap transaction...',
      txHash: '',
      error: '',
      fromAmount,
      toAmount,
      fromSymbol: fromToken.symbol,
      toSymbol: toToken.symbol,
      feeDetails: {
        originalAmount: fromAmount,
        platformFee: platformFee,
        actualAmount: fromAmount,
        networkFee: '~0.001'
      }
    });

    try {
      // Step 1: Prepare
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setSwapProgress(prev => ({
        ...prev,
        step: 2,
        message: 'Executing swap via Jupiter...'
      }));
      setSwapStatus('submitting');

      // Calculate SOL fee (1% of swap value in USD, converted to SOL)
      const swapValueUSD = parseFloat(fromAmount) * (fromToken.price_usd || 0);
      const solPrice = 200; // Should fetch live SOL price
      const solFeeAmount = (swapValueUSD * 0.01) / solPrice;
      
      // Get session token from our Riddle wallet authentication system
      const sessionToken = getSessionToken();
      if (!sessionToken) {
        throw new Error('Please login to access your Solana wallet');
      }

      // Execute live Solana swap via Jupiter with SOL fee collection
      const response = await fetch('/api/solana/swap/execute', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          inputMint: fromToken.address,
          outputMint: toToken.address,
          amount: Math.floor(parseFloat(fromAmount) * Math.pow(10, fromToken.decimals)).toString(),
          slippageBps: Math.floor(slippage * 100),
          userPublicKey: walletAddress,
          solFee: {
            amount: solFeeAmount,
            wallet: "2PgtCtabd1pEjayhG1FbqqbyvfMNL3ukqE8PcU1jT8Ve" // SOL fee collection wallet
          }
        })
      });

      const result = await response.json() as any;
      
      if (result.success) {
        setSwapProgress(prev => ({
          ...prev,
          step: 3,
          message: 'Swap completed successfully!',
          txHash: result.signature
        }));
        setSwapStatus('success');

        toast({
          title: "🎉 Swap Successful!",
          description: (
            <div className="space-y-2">
              <p>Swapped {fromAmount} {fromToken.symbol} for {toToken.symbol}</p>
              <p className="text-xs text-gray-500">Transaction: {result.signature?.slice(0, 8)}...{result.signature?.slice(-8)}</p>
            </div>
          ),
        });
        
        // Refresh balances after successful swap
        fetchBalance();
        
        // Clear form
        setTimeout(() => {
          setFromAmount("");
          setToAmount("");
          setShowProgressModal(false);
          setSwapStatus('idle');
        }, 3000);
        
      } else {
        throw new Error(result.error || 'Swap failed');
      }
    } catch (error: any) {
      setSwapProgress(prev => ({
        ...prev,
        error: error.message || 'Swap failed'
      }));
      setSwapStatus('error');
      
      toast({
        title: "Swap Failed",
        description: error.message || "Failed to execute swap",
        variant: "destructive"
      });
    }
  };

  // Filter and sort tokens for display
  const filteredTokens = allTokens.filter(token => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return token.symbol.toLowerCase().includes(query) ||
           token.name.toLowerCase().includes(query) ||
           token.address.toLowerCase().includes(query);
  }).sort((a, b) => {
    // SOL first, then USDC, then by verification, then by price
    if (a.symbol === 'SOL') return -1;
    if (b.symbol === 'SOL') return 1;
    if (a.symbol === 'USDC') return -1;
    if (b.symbol === 'USDC') return 1;
    if (a.verified && !b.verified) return -1;
    if (!a.verified && b.verified) return 1;
    return (b.price_usd || 0) - (a.price_usd || 0);
  });

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      
      {/* Wallet Selection */}
      <Card className="border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20">
        <CardContent className="p-3">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Swap Wallet</span>
              {selectedWallet && (
                <Badge variant="outline" className="capitalize">
                  {selectedWallet === 'riddle' ? '🎯 Riddle' : selectedWallet === 'metamask' ? '🦊 MetaMask' : '👻 Phantom'}
                </Badge>
              )}
            </div>
            
            {/* Wallet Selector Buttons */}
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant={selectedWallet === 'riddle' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setSelectedWallet('riddle');
                  setSolWalletAddress(walletAddress);
                }}
                className="flex flex-col items-center gap-1 h-auto py-2"
              >
                <span className="text-lg">🎯</span>
                <span className="text-xs">Riddle</span>
              </Button>
              
              <Button
                variant={selectedWallet === 'metamask' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedWallet('metamask')}
                disabled
                className="flex flex-col items-center gap-1 h-auto py-2 opacity-50 cursor-not-allowed"
              >
                <span className="text-lg">🦊</span>
                <span className="text-xs">MetaMask</span>
              </Button>
              
              <Button
                variant={selectedWallet === 'phantom' ? 'default' : 'outline'}
                size="sm"
                onClick={async () => {
                  if (!isPhantomInstalled()) {
                    toast({
                      title: "Phantom Not Found",
                      description: "Please install Phantom from phantom.app",
                      variant: "destructive"
                    });
                    return;
                  }
                  setIsConnectingWallet(true);
                  try {
                    const connection = await connectPhantomSolana();
                    setSelectedWallet('phantom');
                    setSolWalletAddress(connection.publicKey.toString());
                    toast({
                      title: "Phantom Connected",
                      description: `Connected to ${connection.publicKey.toString().slice(0, 6)}...${connection.publicKey.toString().slice(-4)}`
                    });
                  } catch (error: any) {
                    toast({
                      title: "Connection Failed",
                      description: error.message || "Failed to connect Phantom",
                      variant: "destructive"
                    });
                  } finally {
                    setIsConnectingWallet(false);
                  }
                }}
                disabled={isConnectingWallet}
                className="flex flex-col items-center gap-1 h-auto py-2"
              >
                <span className="text-lg">👻</span>
                <span className="text-xs">Phantom</span>
              </Button>
            </div>

            {/* Wallet Status */}
            {isConnectingWallet && (
              <div className="text-xs text-center text-muted-foreground flex items-center justify-center gap-2">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Connecting...
              </div>
            )}
            
            {!isConnectingWallet && selectedWallet && (
              <div className="text-xs text-center">
                {(selectedWallet === 'riddle' && !isWalletConnected) && (
                  <span className="text-muted-foreground">Connect your Riddle wallet to continue</span>
                )}
                {(selectedWallet === 'riddle' && isWalletConnected && walletAddress && walletAddress !== 'No Solana wallet configured') && (
                  <span className="text-green-600 dark:text-green-400">✓ Connected: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
                )}
                {(selectedWallet === 'phantom' && solWalletAddress) && (
                  <span className="text-green-600 dark:text-green-400">✓ Connected: {solWalletAddress.slice(0, 6)}...{solWalletAddress.slice(-4)}</span>
                )}
                {(selectedWallet === 'metamask') && (
                  <span className="text-muted-foreground">MetaMask not supported for Solana</span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
        <CardHeader className="pb-4">
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">
              Swap
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Settings Panel */}
          {showSettings && (
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Slippage Tolerance</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{slippage}%</span>
                  {slippage === 1 && (
                    <Badge variant="secondary" className="text-xs">Default</Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-2 mb-2">
                {[2, 5, 10, 15].map((preset) => (
                  <Button
                    key={preset}
                    variant={slippage === preset ? "default" : "outline"}
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => setSlippage(preset)}
                  >
                    {preset}%
                  </Button>
                ))}
              </div>
              <Input
                type="number"
                placeholder="Custom %"
                value={[2, 5, 10, 15].includes(slippage) ? '' : slippage}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  if (value >= 0 && value <= 50) {
                    setSlippage(value);
                  }
                }}
                className="text-xs h-8"
                step="0.1"
                min="0"
                max="50"
              />
            </div>
          )}

          {/* From Token */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">From</span>
              {fromToken && isWalletConnected && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Balance: {currentBalance} {fromToken.symbol}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectingFor('from');
                  setShowTokenModal(true);
                }}
                className="flex items-center justify-between gap-2 h-12 px-3 min-w-[120px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center gap-2">
                  {fromToken ? (
                    <>
                      {fromToken.logoURI ? (
                        <img 
                          src={fromToken.logoURI} 
                          alt={`${fromToken.symbol} logo`}
                          className="w-6 h-6 rounded-full object-cover" 
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                          <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
                            {fromToken.symbol.charAt(0)}
                          </span>
                        </div>
                      )}
                      <span className="font-medium text-gray-900 dark:text-white">{fromToken.symbol}</span>
                    </>
                  ) : (
                    <span className="text-gray-500">Select</span>
                  )}
                </div>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </Button>
              <div className="flex-1">
                <Input
                  type="number"
                  placeholder="0.0"
                  value={fromAmount}
                  onChange={(e) => setFromAmount(e.target.value)}
                  className="h-12 text-right text-lg font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                />
              </div>
            </div>
            {fromAmount && fromToken && fromToken.price_usd && (
              <div className="text-right text-sm text-gray-500 dark:text-gray-400">
                ~{formatUsd(parseFloat(fromAmount) * fromToken.price_usd)}
              </div>
            )}
          </div>

          {/* Swap Button */}
          <div className="flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSwapTokens}
              className="h-8 w-8 p-0 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              <ArrowDownUp className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            </Button>
          </div>

          {/* To Token */}
          <div className="space-y-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">To</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectingFor('to');
                  setShowTokenModal(true);
                }}
                className="flex items-center justify-between gap-2 h-12 px-3 min-w-[120px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center gap-2">
                  {toToken ? (
                    <>
                      {toToken.logoURI ? (
                        <img 
                          src={toToken.logoURI} 
                          alt={`${toToken.symbol} logo`}
                          className="w-6 h-6 rounded-full object-cover" 
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                          <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
                            {toToken.symbol.charAt(0)}
                          </span>
                        </div>
                      )}
                      <span className="font-medium text-gray-900 dark:text-white">{toToken.symbol}</span>
                    </>
                  ) : (
                    <span className="text-gray-500">Select</span>
                  )}
                </div>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </Button>
              <div className="flex-1">
                <Input
                  type="number"
                  placeholder="0.0"
                  value={isLoading ? "..." : toAmount}
                  readOnly
                  className="h-12 text-right text-lg font-medium bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                />
              </div>
            </div>
            {toAmount && toToken && toToken.price_usd && (
              <div className="text-right text-sm text-gray-500 dark:text-gray-400">
                ~{formatUsd(parseFloat(toAmount) * toToken.price_usd)}
              </div>
            )}
          </div>

          {/* Exchange Rate and Details */}
          {exchangeRate && fromToken && toToken && (
            <div className="space-y-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex justify-between text-sm">
                <span className="text-blue-700 dark:text-blue-300">Rate</span>
                <span className="font-medium text-blue-900 dark:text-blue-100">
                  1 {fromToken.symbol} = {exchangeRate} {toToken.symbol}
                </span>
              </div>
              {minimumReceived && (
                <div className="flex justify-between text-sm">
                  <span className="text-blue-700 dark:text-blue-300">Minimum received</span>
                  <span className="font-medium text-blue-900 dark:text-blue-100">
                    {minimumReceived} {toToken.symbol}
                  </span>
                </div>
              )}
              {priceImpact && (
                <div className="flex justify-between text-sm">
                  <span className="text-blue-700 dark:text-blue-300">Price impact</span>
                  <span className="font-medium text-blue-900 dark:text-blue-100">
                    {priceImpact}%
                  </span>
                </div>
              )}
              {platformFee && (
                <div className="flex justify-between text-sm">
                  <span className="text-blue-700 dark:text-blue-300">Platform fee</span>
                  <span className="font-medium text-blue-900 dark:text-blue-100">
                    {platformFee} SOL
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Multi-DEX Price Comparison */}
          {multiDexQuotes.length > 1 && bestPrice && fromToken && toToken && (
            <div className="space-y-2 p-3 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-green-700 dark:text-green-300">
                  💰 Best Price Found ({multiDexQuotes.length} DEXs checked)
                </span>
                <button 
                  onClick={() => setShowPriceComparison(!showPriceComparison)}
                  className="text-xs text-green-600 dark:text-green-400 hover:underline"
                >
                  {showPriceComparison ? 'Hide' : 'Show'} Details
                </button>
              </div>
              
              <div className="text-sm">
                <span className="text-green-800 dark:text-green-200 font-medium">
                  🏆 {bestPrice.dex}: {(parseFloat(bestPrice.outputAmount) / Math.pow(10, toToken.decimals)).toFixed(6)} {toToken.symbol}
                </span>
              </div>

              {showPriceComparison && (
                <div className="mt-2 space-y-2 border-t border-green-200 dark:border-green-700 pt-2">
                  {multiDexQuotes.map((quote, index) => {
                    const outputAmount = parseFloat(quote.outputAmount) / Math.pow(10, toToken.decimals);
                    const isBest = quote.dex === bestPrice.dex;
                    return (
                      <div 
                        key={index}
                        className={`flex justify-between items-center p-2 rounded ${
                          isBest 
                            ? 'bg-green-100 dark:bg-green-800/30 border border-green-300 dark:border-green-600' 
                            : 'bg-gray-50 dark:bg-gray-800/50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: quote.dexColor }}
                          ></div>
                          <span className="text-sm font-medium">
                            {quote.dex}
                            {isBest && <span className="ml-1 text-green-600 dark:text-green-400">🏆</span>}
                            {quote.recommended && <span className="ml-1 text-blue-600 dark:text-blue-400">⭐</span>}
                          </span>
                          {quote.note && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              ({quote.note})
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-medium">
                          {outputAmount > 0 ? `${outputAmount.toFixed(6)} ${toToken.symbol}` : 'No quote'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Swap Button */}
          <Button
            onClick={handleSwap}
            disabled={!isWalletConnected || isLoading || !fromToken || !toToken || !fromAmount || parseFloat(fromAmount) <= 0}
            className="w-full h-12 text-lg font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:text-gray-500"
          >
            {!isWalletConnected ? "Connect Wallet" : isLoading ? "Loading..." : "Swap"}
          </Button>

          {/* Live Transaction Status */}
          {swapStatus === 'success' && swapProgress.txHash && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm font-medium">🎉 Transaction Successful!</span>
              </div>
              <div className="mt-2 text-sm text-green-600 dark:text-green-400">
                Swapped {swapProgress.fromAmount} {swapProgress.fromSymbol} for {swapProgress.toSymbol}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-green-600 dark:text-green-400 font-mono">
                  {swapProgress.txHash.slice(0, 8)}...{swapProgress.txHash.slice(-8)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`https://solscan.io/tx/${swapProgress.txHash}`, '_blank')}
                  className="h-6 px-2 text-xs text-green-600 border-green-300 hover:bg-green-100"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  View on Solscan
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Token Selection Modal */}
      <Dialog open={showTokenModal} onOpenChange={setShowTokenModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Token</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search by symbol, name or address..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  searchTokensLive(e.target.value);
                }}
                className="pl-10"
                autoFocus
              />
            </div>
            
            <div className="h-80 overflow-y-auto space-y-1">
              {isLoadingTokens ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
                  <p className="text-sm text-gray-500 mt-2">Loading tokens...</p>
                </div>
              ) : filteredTokens.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No tokens found
                </div>
              ) : (
                filteredTokens.map((token) => (
                  <button
                    key={token.address}
                    onClick={() => handleTokenSelect(token)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    {token.logoURI ? (
                      <img 
                        src={token.logoURI} 
                        alt={`${token.symbol} logo`}
                        className="w-10 h-10 rounded-full object-cover flex-shrink-0" 
                        onError={(e) => {
                          // Show fallback initial if logo fails to load
                          const fallback = document.createElement('div');
                          fallback.className = 'w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0';
                          fallback.innerHTML = `<span class="text-sm font-bold text-gray-600 dark:text-gray-300">${token.symbol.charAt(0)}</span>`;
                          (e.target as HTMLElement).parentNode?.replaceChild(fallback, e.target as HTMLElement);
                        }}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-gray-600 dark:text-gray-300">
                          {token.symbol.charAt(0)}
                        </span>
                      </div>
                    )}
                    <div className="text-left flex-1">
                      <div className="font-medium text-gray-900 dark:text-white">{token.symbol}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 truncate">{token.name}</div>
                    </div>
                    {token.verified && (
                      <Badge variant="secondary" className="text-xs">Verified</Badge>
                    )}
                    {token.price_usd && (
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {formatUsd(token.price_usd)}
                        </div>
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Progress Modal */}
      <Dialog open={showProgressModal} onOpenChange={setShowProgressModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Swap Progress</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-lg font-medium">
                {swapProgress.fromAmount} {swapProgress.fromSymbol} → {swapProgress.toSymbol}
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{swapProgress.step}/{swapProgress.totalSteps}</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${(swapProgress.step / swapProgress.totalSteps) * 100}%` }}
                />
              </div>
            </div>
            
            <div className="text-center">
              {swapStatus === 'success' ? (
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
              ) : swapStatus === 'error' ? (
                <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-2" />
              ) : (
                <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-2" />
              )}
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {swapProgress.error || swapProgress.message}
              </p>
            </div>
            
            {swapProgress.txHash && (
              <div className="text-center">
                <a 
                  href={`https://solscan.io/tx/${swapProgress.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 text-sm flex items-center justify-center gap-1"
                >
                  View Transaction <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Multi-DEX Price Comparison Box - Fixed at bottom */}
      {(multiDexQuotes.length > 0 || isLoading) && fromToken && toToken && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 w-full max-w-md mx-4 z-50">
          <Card className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border shadow-lg">
            <CardContent className="p-4">
              {isLoading ? (
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                  <div>
                    <div className="font-medium text-sm">Searching All DEXs</div>
                    <div className="text-xs text-gray-500">
                      Checking Jupiter, Raydium, Orca, Serum, Saber, Aldrin, Mercurial...
                    </div>
                  </div>
                </div>
              ) : bestPrice ? (
                <div className="space-y-3">
                  {/* Best Price Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-yellow-500" />
                      <span className="font-medium text-sm">Best Price Found</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPriceComparison(!showPriceComparison)}
                      className="h-6 px-2 text-xs"
                    >
                      {showPriceComparison ? 'Hide' : 'Show'} All ({multiDexQuotes.length})
                    </Button>
                  </div>

                  {/* Best Price Display */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 border border-green-200 dark:border-green-700">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: multiDexQuotes.find(q => q.dex === bestPrice.dex)?.dexColor || '#10B981' }}
                      />
                      <div>
                        <div className="font-medium text-sm">{bestPrice.dex}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          {((parseFloat(bestPrice.outputAmount) / Math.pow(10, toToken.decimals)) / parseFloat(fromAmount)).toFixed(8)} {toToken.symbol} per {fromToken.symbol}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-sm text-green-600 dark:text-green-400">
                        {(parseFloat(bestPrice.outputAmount) / Math.pow(10, toToken.decimals)).toFixed(6)} {toToken.symbol}
                      </div>
                      {bestPrice.priceImpact > 0 && (
                        <div className="text-xs text-gray-500">
                          {(bestPrice.priceImpact * 100).toFixed(3)}% impact
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Expanded Price Comparison */}
                  {showPriceComparison && (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      <div className="text-xs font-medium text-gray-600 dark:text-gray-400 px-1">
                        All DEX Quotes:
                      </div>
                      {multiDexQuotes
                        .sort((a, b) => parseFloat(b.outputAmount) - parseFloat(a.outputAmount))
                        .map((quote, index) => {
                          const outputAmount = parseFloat(quote.outputAmount) / Math.pow(10, toToken.decimals);
                          const isActive = outputAmount > 0;
                          const isBest = quote.dex === bestPrice.dex;
                          
                          return (
                            <div 
                              key={quote.dex}
                              className={`flex items-center justify-between p-2 rounded-md text-sm ${
                                isBest 
                                  ? 'bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-700' 
                                  : isActive 
                                    ? 'bg-gray-50 dark:bg-gray-800' 
                                    : 'bg-gray-50/50 dark:bg-gray-800/50 opacity-60'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-2 h-2 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: quote.dexColor }}
                                />
                                <span className={`font-medium ${isActive ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>
                                  {quote.dex}
                                </span>
                                {isBest && <Star className="h-3 w-3 text-yellow-500" />}
                              </div>
                              
                              <div className="text-right">
                                {isActive ? (
                                  <>
                                    <div className={`font-medium ${isBest ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>
                                      {outputAmount.toFixed(6)}
                                    </div>
                                    {quote.priceImpact > 0 && (
                                      <div className="text-xs text-gray-500">
                                        {(quote.priceImpact * 100).toFixed(3)}% impact
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <div className="text-xs text-gray-400">
                                    {quote.note || 'Unavailable'}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}

                  {/* Summary Stats */}
                  <div className="flex justify-between text-xs text-gray-500 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <span>{multiDexQuotes.filter(q => parseFloat(q.outputAmount) > 0).length} active sources</span>
                    <span>Updated {new Date().toLocaleTimeString()}</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-2">
                  <div className="text-sm text-gray-500">No quotes available</div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Mobile Wallet QR Modal (Phantom Mobile) */}
      <Dialog open={showMobileWalletModal} onOpenChange={setShowMobileWalletModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Connect {mobileWalletName} Mobile
            </DialogTitle>
            <DialogDescription>
              Scan this QR code with {mobileWalletName} mobile app
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* QR Code Display */}
            <div className="flex justify-center p-4 bg-white rounded-lg">
              <QRCodeSVG 
                value={mobileWalletQRData || mobileWalletDeepLink} 
                size={200}
                level="H"
                includeMargin={true}
              />
            </div>

            {/* Instructions */}
            <Alert>
              <Smartphone className="h-4 w-4" />
              <AlertDescription>
                Open Phantom mobile app and scan this QR code to connect your wallet
              </AlertDescription>
            </Alert>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  navigator.clipboard.writeText(mobileWalletDeepLink);
                  toast({
                    title: "Copied!",
                    description: "Deep link copied to clipboard"
                  });
                }}
                className="flex-1"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy Link
              </Button>
              <Button 
                onClick={() => {
                  window.open(mobileWalletDeepLink, '_blank');
                  toast({
                    title: `Opening ${mobileWalletName}`,
                    description: "Please complete the connection in your mobile wallet"
                  });
                }}
                className="flex-1"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open App
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
