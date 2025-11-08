import { useState, useEffect } from 'react';
import { Slider } from '@mui/material';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumericInput } from '@/components/ui/numeric-input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowDownUp, ArrowRightLeft, Settings, ChevronDown, Wallet, TrendingUp, RefreshCw, Zap, Star, Lock, Search, Loader2, AlertTriangle, CheckCircle, Clock, Send, ArrowRight, ExternalLink, X, Smartphone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useQueryClient } from '@tanstack/react-query';
import SwipeConfirm from './SwipeConfirm';
import { getSessionToken } from '@/utils/auth';
import { sessionManager } from '@/utils/sessionManager';
import { trustlineManager } from '@/lib/xrpl-trustline-manager';
import { QRCodeSVG } from 'qrcode.react';
import SignClient from '@walletconnect/sign-client';
import QRCode from 'qrcode';

interface TokenSearchResult {
  symbol: string;
  name: string;
  issuer: string;
  currency_code: string;
  logoURI?: string;
  logo_url?: string;
  icon_url?: string;
  price_usd?: number;
  volume_24h?: number;
  market_cap?: number;
  price_change_24h?: number;
  verified: boolean;
  source: string;
  balance?: string;
}

interface ModernXRPLSwapProps {
  isWalletConnected: boolean;
  walletAddress: string | null;
  walletHandle: string | null;
  balance: string;
  totalBalance: string;
  reserve: string;
  availableTokens?: any[];
  initialToTokenSymbol?: string;
  initialToTokenIssuer?: string;
  initialFromAmount?: string;
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

export default function ModernXRPLSwap({ 
  isWalletConnected, 
  walletAddress, 
  walletHandle, 
  balance, 
  totalBalance, 
  reserve,
  availableTokens = [],
  initialToTokenSymbol,
  initialToTokenIssuer,
  initialFromAmount
}: ModernXRPLSwapProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State
  const [fromToken, setFromToken] = useState<TokenSearchResult | null>(null);
  const [toToken, setToToken] = useState<TokenSearchResult | null>(null);
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [minimumReceived, setMinimumReceived] = useState(""); // Minimum after slippage
  const [exchangeRate, setExchangeRate] = useState("");
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
  const [slippage, setSlippage] = useState(5); // Default 5% slippage tolerance  
  const [actualSlippage, setActualSlippage] = useState(5); // Actual slippage used by backend
  const [showSettings, setShowSettings] = useState(false);
  const [currentBalance, setCurrentBalance] = useState(balance || "");
  
  // Live token search results only
  const [allTokens, setAllTokens] = useState<TokenSearchResult[]>([]);
  const [tokensWithAMMStatus, setTokensWithAMMStatus] = useState<(TokenSearchResult & { hasAMM?: boolean })[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [selectingFor, setSelectingFor] = useState<'from' | 'to'>('from');
  const [isCheckingAMM, setIsCheckingAMM] = useState(false);
  
  // Featured tokens for TO selector (admin-controlled)
  const [featuredTokens, setFeaturedTokens] = useState<TokenSearchResult[]>([]);
  const [isLoadingFeaturedTokens, setIsLoadingFeaturedTokens] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  
  // Trustline checking state
  const [trustlineStatus, setTrustlineStatus] = useState<{
    token: string;
    issuer: string;
    hasTrustline: boolean;
    isChecking: boolean;
    error?: string;
  } | null>(null);

  // Wallet selection state
  const [selectedWallet, setSelectedWallet] = useState<'riddle' | 'joey' | 'xaman'>('riddle');
  const [selectedWalletAddress, setSelectedWalletAddress] = useState<string | null>(walletAddress);
  const [connectedXamanWallets, setConnectedXamanWallets] = useState<Array<{address: string, wallet: string, balance?: string}>>([]);
  const [showWalletSelector, setShowWalletSelector] = useState(false);
  const [showDeeplinkModal, setShowDeeplinkModal] = useState(false);
  const [deeplinkUrl, setDeeplinkUrl] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState(''); // QR code from Xaman API or WalletConnect
  
  // Add Trustline Modal State
  const [showAddTrustlineModal, setShowAddTrustlineModal] = useState(false);
  const [trustlineSearchQuery, setTrustlineSearchQuery] = useState('');
  const [trustlineSearchResults, setTrustlineSearchResults] = useState<TokenSearchResult[]>([]);
  const [isCreatingTrustline, setIsCreatingTrustline] = useState(false);
  const [trustlineProgress, setTrustlineProgress] = useState({
    step: 1,
    totalSteps: 2,
    message: '',
    error: ''
  });
  
  // WalletConnect state for Joey wallet
  const [signClient, setSignClient] = useState<SignClient | null>(null);
  const [joeySession, setJoeySession] = useState<any>(null);

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
      totalFees: string;
    } | null
  });
  
  // Wallet type and credentials
  const walletType = 'riddle';

  // Owned tokens state
  const [ownedTokens, setOwnedTokens] = useState<TokenSearchResult[]>([]);
  const [isLoadingOwnedTokens, setIsLoadingOwnedTokens] = useState(false);

  // Check trustline status for a token
  const checkTrustlineStatus = async (token: TokenSearchResult) => {
    if (!token || token.symbol === 'XRP' || !selectedWalletAddress) {
      setTrustlineStatus(null);
      return;
    }

    setTrustlineStatus({
      token: token.symbol,
      issuer: token.issuer,
      hasTrustline: false,
      isChecking: true
    });

    try {
      console.log(`🔍 Checking trustline for: ${token.symbol} (${token.issuer})`);
      
      // Fix issuer format - strip currency prefix (e.g., "RDL.r9x..." -> "r9x...")
      const cleanIssuer = token.issuer?.includes('.') ? 
        token.issuer.split('.').pop() || token.issuer : 
        token.issuer;
      
      console.log(`🔧 Clean issuer format: ${token.issuer} -> ${cleanIssuer}`);
      
      const sessionToken = sessionManager.getSessionToken();
      const response = await fetch('/api/xrpl/trustline/check', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          address: selectedWalletAddress,
          currency: token.symbol,
          issuer: cleanIssuer
        })
      });

      const data = await response.json() as any;
      
      setTrustlineStatus({
        token: token.symbol,
        issuer: token.issuer,
        hasTrustline: data.hasTrustline || false,
        isChecking: false
      });
      
      console.log(`✅ Trustline status for ${token.symbol}: ${data.hasTrustline ? 'EXISTS' : 'NOT FOUND'}`);
      console.log(`🔧 Frontend trustline state updated:`, {
        token: token.symbol,
        issuer: token.issuer,
        hasTrustline: data.hasTrustline || false,
        isChecking: false
      });
      
    } catch (error) {
      console.error(`❌ Trustline check failed for ${token.symbol}:`, error);
      setTrustlineStatus({
        token: token.symbol,
        issuer: token.issuer,
        hasTrustline: false,
        isChecking: false,
        error: 'Failed to check trustline'
      });
    }
  };

  // Check AMM availability for tokens when selecting "to" token
  const checkAMMAvailabilityForTokens = async (baseToken: TokenSearchResult, tokenList: TokenSearchResult[]) => {
    if (!baseToken || tokenList.length === 0) return;
    
    try {
      setIsCheckingAMM(true);
      console.log(`🔍 Checking AMM availability for ${tokenList.length} tokens against ${baseToken.symbol}`);
      
      const tokensWithAMM = await Promise.all(
        tokenList.map(async (token) => {
          try {
            // Use Bithomp API to check AMM availability
            const response = await fetch(`/api/xrpl/amm/check/${baseToken.symbol}/${baseToken.issuer || 'none'}/${token.symbol}/${token.issuer || 'none'}`);
            const data = await response.json() as any;
            
            return {
              ...token,
              hasAMM: data.success && data.ammAvailable
            };
          } catch (error) {
            console.error(`AMM check failed for ${token.symbol}:`, error);
            return {
              ...token,
              hasAMM: false
            };
          }
        })
      );
      
      const ammCount = tokensWithAMM.filter(t => t.hasAMM).length;
      console.log(`✅ Found ${ammCount} tokens with AMM availability for ${baseToken.symbol}`);
      setTokensWithAMMStatus(tokensWithAMM);
      
    } catch (error) {
      console.error('AMM batch check error:', error);
    } finally {
      setIsCheckingAMM(false);
    }
  };

  // Live token search - ALWAYS make fresh API calls
  // Create default XRP token
  const createDefaultXRP = async (): Promise<TokenSearchResult> => {
    try {
      const xrpResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd&include_24hr_change=true');
      const xrpData = await xrpResponse.json();
      const xrpPrice = xrpData?.ripple?.usd || 0.5; // fallback price
      
      return {
        symbol: 'XRP',
        name: 'XRP',
        currency_code: 'XRP',
        issuer: '',
        logo_url: 'https://cryptologos.cc/logos/xrp-xrp-logo.png',
        price_usd: xrpPrice,
        volume_24h: 0,
        price_change_24h: xrpData?.ripple?.usd_24h_change || 0,
        verified: true,
        source: 'default'
      };
    } catch (error) {
      console.error('Failed to fetch XRP price:', error);
      return {
        symbol: 'XRP',
        name: 'XRP',
        currency_code: 'XRP',
        issuer: '',
        logo_url: 'https://cryptologos.cc/logos/xrp-xrp-logo.png',
        price_usd: 0.5,
        volume_24h: 0,
        price_change_24h: 0,
        verified: true,
        source: 'default'
      };
    }
  };

  const searchTokensLive = async (query: string) => {
    try {
      setIsLoadingTokens(true);
      
      // Always include XRP as the first option
      const defaultXRP = await createDefaultXRP();
      
      // If no query and selecting "from" token, show owned tokens
      if (!query || query.trim().length < 1) {
        if (selectingFor === 'from' && ownedTokens.length > 0) {
          setAllTokens(ownedTokens);
        } else {
          setAllTokens([defaultXRP]);
        }
        setIsLoadingTokens(false);
        return;
      }

      console.log(`🔍 Live API search for: "${query}"`);
      
      // Get session token from centralized session manager
      const sessionToken = sessionManager.getSessionToken();
      
      if (!sessionToken) {
        console.error('❌ [TOKEN SEARCH] No session token found - user not authenticated');
        setAllTokens([defaultXRP]);
        setIsLoadingTokens(false);
        return;
      }
      
      // Use authenticated API for token search
      const response = await fetch(`/api/xrpl/tokens/search?q=${encodeURIComponent(query.trim())}`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });
      const data = await response.json() as any;
      
      if (data.success && data.tokens && data.tokens.length > 0) {
        // Format tokens for UI display with proper API data mapping
        const tokensWithLogos = data.tokens.map((token: any) => ({
          symbol: token.currency || token.symbol,
          name: token.name || token.currency,
          // Keep original issuer format for display, trustline check will clean it
          issuer: token.issuer || '',
          logo_url: token.logo_url || token.icon_url || token.icon || '',
          icon_url: token.icon_url || token.logo_url || token.icon || '',
          price_usd: token.price_usd || token.price || 0,
          volume_24h: token.volume_24h || 0,
          price_change_24h: token.price_change_24h || token.change_24h || 0,
          verified: token.verified || token.verification_status === 'verified',
          source: token.source || data.source || 'api'
        }));
        
        // Advanced deduplication for tokens - prioritize native XRP and verified tokens
        const uniqueTokens = tokensWithLogos.reduce((acc: any[], token: any) => {
          const existing = acc.find((t: any) => t.symbol === token.symbol);
          
          if (!existing) {
            acc.push(token);
          } else {
            // For XRP specifically, prioritize native XRP (empty issuer)
            if (token.symbol === 'XRP') {
              if (!token.issuer && existing.issuer) {
                // Replace with native XRP
                const index = acc.indexOf(existing);
                acc[index] = token;
              }
              // Skip if existing is already native XRP or current is issued XRP
            } else {
              // For other tokens, keep highest priced or verified version
              if (token.price_usd > existing.price_usd || (token.verified && !existing.verified)) {
                const index = acc.indexOf(existing);
                acc[index] = token;
              }
            }
          }
          return acc;
        }, []);
        
        // Always ensure XRP is at the beginning (even if not specifically searched for)
        const hasXRP = uniqueTokens.some((t: any) => t.symbol === 'XRP');
        if (!hasXRP) {
          uniqueTokens.unshift(defaultXRP);
        } else {
          // Move XRP to the front if it exists
          const xrpIndex = uniqueTokens.findIndex((t: any) => t.symbol === 'XRP');
          if (xrpIndex > 0) {
            const xrpToken = uniqueTokens.splice(xrpIndex, 1)[0];
            uniqueTokens.unshift(xrpToken);
          }
        }
        
        setAllTokens(uniqueTokens);
        console.log(`✅ V2 API returned ${uniqueTokens.length} clean XRPL tokens`);
      } else {
        // If no results, try loading all tokens from working API
        console.log(`📋 Loading all available tokens...`);
        const allResponse = await fetch(`/api/xrpl/tokens/all?timestamp=${Date.now()}`);
        const allData = await allResponse.json();
        
        if (allData.success && allData.tokens) {
          const filtered = allData.tokens.filter((token: any) => 
            token.currency?.toLowerCase().includes(query.toLowerCase()) ||
            token.symbol?.toLowerCase().includes(query.toLowerCase())
          );
          
          const tokensWithLogos = filtered.map((token: any) => ({
            symbol: token.currency || token.symbol,
            name: token.name || token.currency,
            issuer: token.issuer || '',
            logo_url: token.logo_url || token.icon_url || token.icon || '',
            icon_url: token.icon_url || token.logo_url || token.icon || '',
            price_usd: token.price_usd || token.price || 0,
            volume_24h: token.volume_24h || 0,
            price_change_24h: token.price_change_24h || token.change_24h || 0,
            verified: token.verified || token.verification_status === 'verified',
            source: token.source || allData.source || 'api'
          }));
          
          // Advanced deduplication for fallback tokens
          const uniqueTokens = tokensWithLogos.reduce((acc: any[], token: any) => {
            const existing = acc.find((t: any) => t.symbol === token.symbol);
            
            if (!existing) {
              acc.push(token);
            } else {
              // For XRP, prioritize native XRP (empty issuer)
              if (token.symbol === 'XRP') {
                if (!token.issuer && existing.issuer) {
                  const index = acc.indexOf(existing);
                  acc[index] = token;
                }
              } else {
                // For other tokens, keep highest priced or verified version
                if (token.price_usd > existing.price_usd || (token.verified && !existing.verified)) {
                  const index = acc.indexOf(existing);
                  acc[index] = token;
                }
              }
            }
            return acc;
          }, []);
          
          setAllTokens(uniqueTokens);
          console.log(`✅ Filtered ${uniqueTokens.length} unique tokens from all tokens (${tokensWithLogos.length - uniqueTokens.length} duplicates removed)`);
          
          // If we're selecting "to" token and have a "from" token, check AMM availability
          if (selectingFor === 'to' && fromToken && tokensWithLogos.length > 0) {
            await checkAMMAvailabilityForTokens(fromToken, tokensWithLogos);
          }
        }
      }
    } catch (error) {
      console.error('Token search API error:', error);
      setAllTokens([]);
    } finally {
      setIsLoadingTokens(false);
    }
  };

  // Fetch live balance for connected wallet
  const fetchBalance = async (token?: TokenSearchResult) => {
    if (!isWalletConnected || !selectedWalletAddress) return;
    
    try {
      // Determine which token balance to fetch
      const targetToken = token || fromToken;
      
      if (!targetToken) {
        console.log(`🔍 Fetching XRP balance for ${selectedWalletAddress}`);
        // Use public XRP balance endpoint
        const response = await fetch(`/api/xrpl/balance/${selectedWalletAddress}`);
        
        if (!response.ok) {
          console.log(`Balance API returned ${response.status}, trying direct wallet balance...`);
          // Fallback to direct wallet balance if available
          if (balance) {
            setCurrentBalance(balance);
            console.log(`✅ Using wallet balance fallback: ${balance} XRP`);
          }
          return;
        }
        
        const data = await response.json() as any;
        
        if (data.success && data.balance !== undefined) {
          const walletBalance = parseFloat(data.balance).toFixed(6);
          setCurrentBalance(walletBalance);
          console.log(`✅ Updated XRP balance: ${walletBalance} XRP`);
        } else {
          // NO FALLBACKS - Set to 0 if API fails
          setCurrentBalance('0');
          console.log('❌ XRP balance fetch failed - no fallbacks, set to 0');
        }
      } else {
        // Fetch balance for specific token using public endpoint
        console.log(`🔍 Fetching ${targetToken.symbol} balance for ${selectedWalletAddress}`);
        
        // Handle XRP (native currency with no issuer)
        if (targetToken.symbol === 'XRP' && !targetToken.issuer) {
          console.log(`🔍 Fetching native XRP balance for ${selectedWalletAddress}`);
          const response = await fetch(`/api/xrpl/balance/${selectedWalletAddress}`);
          
          if (!response.ok) {
            console.log(`❌ XRP balance fetch failed: ${response.status}`);
            setCurrentBalance('0');
            return;
          }
          
          const data = await response.json() as any;
          
          if (data.success && data.balance !== undefined) {
            const walletBalance = parseFloat(data.balance).toFixed(6);
            setCurrentBalance(walletBalance);
            console.log(`✅ Updated native XRP balance: ${walletBalance} XRP`);
          } else {
            setCurrentBalance('0');
          }
          return;
        }
        
        if (!targetToken.issuer) {
          console.log(`❌ No issuer for ${targetToken.symbol}, setting balance to 0`);
          setCurrentBalance('0');
          return;
        }
        
        // Extract clean issuer from the complex format
        const cleanIssuer = targetToken.issuer.includes('.') ? 
          targetToken.issuer.split('.').pop() || targetToken.issuer : 
          targetToken.issuer;
        
        const endpoint = `/api/xrpl/token-balance/${selectedWalletAddress}/${targetToken.symbol}/${cleanIssuer}`;
        const response = await fetch(endpoint);
        
        if (!response.ok) {
          console.log(`❌ Token balance fetch failed: ${response.status}`);
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
      // NO FALLBACKS - Set to 0 if fetch fails
      setCurrentBalance('0');
      console.log('❌ Balance fetch failed - no fallbacks, set to 0');
    }
  };

  // Fetch live token prices from authentic APIs - PRODUCTION READY
  const fetchLiveTokenPrice = async (token: TokenSearchResult): Promise<TokenSearchResult> => {
    try {
      // Use CoinGecko API directly for live XRP pricing
      if (token.symbol === 'XRP') {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true');
        const data = await response.json() as any;
        
        if (data.ripple && data.ripple.usd > 0) {
          console.log(`🎯 Live XRP price from CoinGecko: $${data.ripple.usd}`);
          return {
            ...token,
            price_usd: data.ripple.usd,
            volume_24h: data.ripple.usd_24h_vol || 0,
            price_change_24h: data.ripple.usd_24h_change || 0
          };
        }
      }
      
      // For XRPL tokens, use DexScreener API for live pricing
      if (token.issuer) {
        const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${token.issuer}`);
        const data = await response.json() as any;
        
        if (data.pairs && data.pairs.length > 0) {
          const pair = data.pairs.find((p: any) => 
            p.baseToken?.symbol?.toLowerCase() === token.symbol.toLowerCase()
          ) || data.pairs[0];
          
          if (pair && pair.priceUsd && parseFloat(pair.priceUsd) > 0) {
            console.log(`🎯 Live ${token.symbol} price from DexScreener: $${pair.priceUsd}`);
            return {
              ...token,
              price_usd: parseFloat(pair.priceUsd),
              volume_24h: parseFloat(pair.volume?.h24 || '0'),
              price_change_24h: parseFloat(pair.priceChange?.h24 || '0')
            };
          }
        }
      }
      
    } catch (error) {
      console.error(`❌ Live price fetch failed for ${token.symbol}:`, error);
    }
    
    // CRITICAL: Return with price_usd: 0 if live fetch fails - no hardcoded fallbacks
    console.warn(`⚠️ No live price available for ${token.symbol} - using $0`);
    return { ...token, price_usd: 0 };
  };

  // Initialize swap with provided token (from token analytics page)
  useEffect(() => {
    if (initialToTokenSymbol && initialToTokenIssuer) {
      // Set XRP as FROM token
      setFromToken({
        symbol: 'XRP',
        name: 'XRP',
        currency_code: 'XRP',
        issuer: '',
        verified: true,
        source: 'native'
      });
      
      // Fetch logo from backend analytics endpoint (uses DexScreener with Bithomp fallback)
      const fetchTokenLogo = async () => {
        try {
          // Use backend analytics endpoint which already has proper DexScreener + Bithomp logic
          const response = await fetch(`/api/analytics/xrpl/token?symbol=${encodeURIComponent(initialToTokenSymbol)}&issuer=${encodeURIComponent(initialToTokenIssuer)}`);
          const data = await response.json() as any;
          
          let logoUrl = data.data?.logoUrl || null;
          
          // Fallback to Bithomp if backend doesn't return a logo
          if (!logoUrl) {
            logoUrl = `https://cdn.bithomp.com/issued-token/${initialToTokenIssuer}/${initialToTokenSymbol}`;
            console.log(`🎨 Using Bithomp fallback logo for ${initialToTokenSymbol}`);
          } else {
            console.log(`🎨 Using logo from backend (DexScreener priority) for ${initialToTokenSymbol}: ${logoUrl}`);
          }
          
          // Set the target token as TO token with fetched logo
          setToToken({
            symbol: initialToTokenSymbol,
            name: initialToTokenSymbol,
            currency_code: initialToTokenSymbol,
            issuer: initialToTokenIssuer,
            logoURI: logoUrl,
            verified: false,
            source: 'initial'
          });
        } catch (error) {
          console.error(`❌ Failed to fetch logo, using Bithomp fallback:`, error);
          // Error fallback to Bithomp
          setToToken({
            symbol: initialToTokenSymbol,
            name: initialToTokenSymbol,
            currency_code: initialToTokenSymbol,
            issuer: initialToTokenIssuer,
            logoURI: `https://cdn.bithomp.com/issued-token/${initialToTokenIssuer}/${initialToTokenSymbol}`,
            verified: false,
            source: 'initial'
          });
        }
      };
      
      fetchTokenLogo();
      
      // Set initial amount if provided
      if (initialFromAmount) {
        setFromAmount(initialFromAmount);
      }
      
      console.log(`🎯 Auto-populated swap: XRP → ${initialToTokenSymbol} (${initialToTokenIssuer})`);
    }
  }, [initialToTokenSymbol, initialToTokenIssuer, initialFromAmount]);

  // Fetch owned tokens when wallet is connected
  useEffect(() => {
    const fetchOwnedTokens = async () => {
      if (!selectedWalletAddress) return;
      
      setIsLoadingOwnedTokens(true);
      try {
        const response = await fetch(`/api/xrpl/tokens/${selectedWalletAddress}`);
        const data = await response.json() as any;
        
        if (data.success && data.tokens) {
          const formatted = data.tokens.map((token: any) => ({
            symbol: token.symbol,
            name: token.symbol,
            currency_code: token.currency,
            issuer: token.issuer || '',
            logoURI: token.logoURI || token.icon_url || token.logo_url || '',
            logo_url: token.icon_url || token.logo_url || '',
            icon_url: token.icon_url || token.logo_url || '',
            price_usd: token.price_usd || 0,  // Use price from backend (DexScreener data)
            volume_24h: token.volume_24h || 0,
            price_change_24h: token.price_change_24h || 0,
            verified: true,
            source: 'owned',
            balance: token.balance
          }));
          
          // Sort: XRP first, then alphabetically by symbol
          const sorted = formatted.sort((a, b) => {
            if (a.symbol === 'XRP') return -1;
            if (b.symbol === 'XRP') return 1;
            return a.symbol.localeCompare(b.symbol);
          });
          
          setOwnedTokens(sorted);
          console.log(`✅ Loaded ${sorted.length} owned tokens (sorted alphabetically)`);
        }
      } catch (error) {
        console.error('Failed to fetch owned tokens:', error);
      } finally {
        setIsLoadingOwnedTokens(false);
      }
    };
    
    fetchOwnedTokens();
  }, [selectedWalletAddress]);

  // Update current balance when FROM token changes
  useEffect(() => {
    if (!fromToken) {
      setCurrentBalance(balance || "0");
      return;
    }

    // For XRP, use the balance prop
    if (fromToken.symbol === 'XRP') {
      setCurrentBalance(balance || totalBalance || "0");
      console.log(`💰 [BALANCE] Set XRP balance: ${balance || totalBalance}`);
      return;
    }

    // For other tokens, find in ownedTokens list
    const ownedToken = ownedTokens.find(t => 
      t.symbol === fromToken.symbol && 
      t.issuer === fromToken.issuer
    );

    if (ownedToken && (ownedToken as any).balance) {
      setCurrentBalance((ownedToken as any).balance);
      console.log(`💰 [BALANCE] Set ${fromToken.symbol} balance from owned tokens: ${(ownedToken as any).balance}`);
    } else if ((fromToken as any).balance) {
      // Fallback: use balance from token object itself
      setCurrentBalance((fromToken as any).balance);
      console.log(`💰 [BALANCE] Set ${fromToken.symbol} balance from token object: ${(fromToken as any).balance}`);
    } else {
      // No balance found, default to "0"
      setCurrentBalance("0");
      console.log(`⚠️ [BALANCE] No balance found for ${fromToken.symbol}, defaulting to 0`);
    }
  }, [fromToken, ownedTokens, balance, totalBalance]);

  // Fetch featured tokens on mount (for TO selector)
  useEffect(() => {
    const fetchFeaturedTokens = async () => {
      setIsLoadingFeaturedTokens(true);
      try {
        const response = await fetch('/api/xrpl/featured-tokens');
        const data = await response.json() as any;
        
        if (data.success && data.tokens) {
          // Backend already provides live DexScreener prices - no need to fetch again
          setFeaturedTokens(data.tokens);
          console.log(`✅ Loaded ${data.tokens.length} featured tokens with live data from backend`);
          console.log('🔍 Featured tokens data:', JSON.stringify(data.tokens, null, 2));
          
          // Auto-populate: Set XRP as FROM token and RDL as TO token
          // Use functional updates to respect any user selections made before this resolves
          const xrpToken = data.tokens.find((t: TokenSearchResult) => t.symbol === 'XRP');
          const rdlToken = data.tokens.find((t: TokenSearchResult) => t.symbol === 'RDL');
          
          if (xrpToken) {
            setFromToken(current => {
              if (current) {
                console.log('⏭️ Skipped auto-populate FROM: user already selected', current.symbol);
                return current;
              }
              console.log('🎯 Auto-populated FROM token: XRP');
              return xrpToken;
            });
          }
          if (rdlToken) {
            setToToken(current => {
              if (current) {
                console.log('⏭️ Skipped auto-populate TO: user already selected', current.symbol);
                return current;
              }
              console.log('🎯 Auto-populated TO token: RDL');
              return rdlToken;
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch featured tokens:', error);
      } finally {
        setIsLoadingFeaturedTokens(false);
      }
    };
    
    fetchFeaturedTokens();
  }, []);

  // Load all connected wallets and their balances
  useEffect(() => {
    const loadConnectedWallets = async () => {
      const walletsData: Array<{address: string, wallet: string, balance?: string}> = [];
      
      // Add Riddle wallet if logged in
      if (isWalletConnected && walletAddress) {
        try {
          const response = await fetch(`/api/xrpl/balance/${walletAddress}`);
          const data = await response.json() as any;
          walletsData.push({
            address: walletAddress,
            wallet: 'riddle',
            balance: data.balance || '0'
          });
        } catch (e) {
          walletsData.push({
            address: walletAddress,
            wallet: 'riddle',
            balance: '0'
          });
        }
      }
      
      // Load all connected external wallets from localStorage
      const connectionsStr = localStorage.getItem('riddle_wallet_connections');
      if (connectionsStr) {
        try {
          const connections = JSON.parse(connectionsStr);
          const xrpWallets = connections.filter((c: any) => c.chain === 'xrp' && c.connected);
          
          // Fetch balance for each Xaman wallet
          for (const wallet of xrpWallets) {
            try {
              const response = await fetch(`/api/xrpl/balance/${wallet.address}`);
              const data = await response.json() as any;
              walletsData.push({
                address: wallet.address,
                wallet: wallet.wallet,
                balance: data.balance || '0'
              });
            } catch (e) {
              walletsData.push({
                address: wallet.address,
                wallet: wallet.wallet,
                balance: '0'
              });
            }
          }
        } catch (e) {
          console.error('Failed to load wallet connections:', e);
        }
      }
      
      setConnectedXamanWallets(walletsData);
    };
    
    loadConnectedWallets();
  }, [isWalletConnected, walletAddress]);
  
  // Update selected wallet address when wallet type changes
  useEffect(() => {
    if (selectedWallet === 'riddle' && isWalletConnected && walletAddress) {
      // Use Riddle wallet address
      setSelectedWalletAddress(walletAddress);
    } else if (selectedWallet === 'xaman') {
      // Use first Xaman wallet or prompt to select
      const xamanWallets = connectedXamanWallets.filter(w => w.wallet !== 'riddle');
      if (xamanWallets.length === 1) {
        setSelectedWalletAddress(xamanWallets[0].address);
      } else if (xamanWallets.length > 1) {
        // Multiple Xaman wallets - show selector
        setShowWalletSelector(true);
      }
    }
  }, [selectedWallet, connectedXamanWallets, isWalletConnected, walletAddress]);

  // Update balance when from token changes
  useEffect(() => {
    if (isWalletConnected && selectedWalletAddress) {
      fetchBalance(fromToken || undefined);
    }
  }, [isWalletConnected, selectedWalletAddress, fromToken]);

  // Check trustline status whenever toToken changes and wallet is connected
  useEffect(() => {
    if (toToken && toToken.symbol !== 'XRP' && isWalletConnected && walletAddress) {
      console.log(`🔄 Auto-checking trustline for ${toToken.symbol} after token/wallet change`);
      checkTrustlineStatus(toToken);
    } else if (!toToken || toToken.symbol === 'XRP') {
      setTrustlineStatus(null);
    }
  }, [toToken, isWalletConnected, walletAddress]);

  // Get exchange quote from backend - backend controls all pricing
  const getExchangeQuote = async (from: TokenSearchResult, to: TokenSearchResult, amount: string) => {
    if (!from || !to || !amount || parseFloat(amount) <= 0) {
      setExchangeRate("");
      setToAmount("");
      setPriceImpact("");
      setPlatformFee("");
      return;
    }

    setIsLoading(true);
    try {
      // Use the audited XRPL Swap v2 quote endpoint
      const response = await fetch('/api/xrpl/swap/v2/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromToken: from.symbol,
          toToken: to.symbol,
          amount: parseFloat(amount),
          fromIssuer: from.issuer || '',
          toIssuer: to.issuer || '',
          slippagePercent: slippage
        })
      });
      
      const quote = await response.json() as any;
      
      if (quote.success) {
        const rateNum = parseFloat(quote.rate ?? quote.exchangeRate ?? 0);
        setExchangeRate(`1 ${from.symbol} = ${formatExchangeRate(rateNum)} ${to.symbol}`);
        // Use backend-calculated amounts (v2 uses expectedOutput/minOutput)
        const expectedOut = typeof quote.expectedOutput === 'number' ? quote.expectedOutput : quote.estimatedOutput;
        const minOut = typeof quote.minOutput === 'number' ? quote.minOutput : quote.minimumReceived;
        setToAmount(expectedOut ? expectedOut.toFixed(6) : '0');
        setMinimumReceived(minOut ? minOut.toFixed(6) : '0');

        // Price impact may be missing in v2; guard against NaN
        const pi = typeof quote.priceImpact === 'number' ? `${(quote.priceImpact * 100).toFixed(1)}%` : '';
        setPriceImpact(pi);
        // Platform fee in XRP if provided by v2
        if (typeof quote.platformFeeXrp === 'number') {
          setPlatformFee(`${Number(quote.platformFeeXrp).toFixed(6)} XRP`);
        }

        // Update slippage to show actual slippage used by backend
        const backendSlippage = quote.slippagePercent ?? slippage;
        setActualSlippage(backendSlippage);
        console.log(`✅ Quote: ${amount} ${from.symbol} = ${expectedOut?.toFixed?.(6) || expectedOut} ${to.symbol} (Min: ${minOut?.toFixed?.(6) || minOut} with ${backendSlippage}% slippage)`);
      } else {
        setExchangeRate("Rate unavailable");
        setToAmount("");
        setMinimumReceived("");
      }
    } catch (error) {
      console.error('Quote error:', error);
      setExchangeRate("Error getting quote");
      setToAmount("");
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-update quotes when inputs change (including slippage)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (fromToken && toToken && fromAmount) {
        getExchangeQuote(fromToken, toToken, fromAmount);
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [fromToken, toToken, fromAmount, slippage]);

  // Handle search query changes for live search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchTokensLive(searchQuery);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filter tokens based on current search results
  const filteredTokens = allTokens;

  const handleSelectToken = async (token: TokenSearchResult) => {
    // Fetch live price for selected token
    const tokenWithLivePrice = await fetchLiveTokenPrice(token);
    console.log(`✅ ${token.symbol} live price: $${tokenWithLivePrice.price_usd}`);
    
    if (selectingFor === 'from') {
      setFromToken(tokenWithLivePrice);
      // Clear opposite token to force re-selection
      setToToken(null);
      setToAmount("");
      // Fetch balance for newly selected token
      if (token.symbol === 'XRP' && isWalletConnected) {
        fetchBalance();
      }
    } else {
      setToToken(tokenWithLivePrice);
      // Clear amounts to force recalculation
      setToAmount("");
      // Check trustline for the "to" token
      await checkTrustlineStatus(tokenWithLivePrice);
    }
    
    setShowTokenModal(false);
    setSearchQuery("");
    setAllTokens([]);
    setTokensWithAMMStatus([]);
    
    // Clear quote and error states
    setExchangeRate("");
    setPriceImpact("");
    setPlatformFee("");
    setError(null);
  };

  const swapTokens = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
    
    const tempAmount = fromAmount;
    setFromAmount(toAmount);
    setToAmount(tempAmount);
    
    // Check trustline for the new "to" token after swap
    if (temp) {
      checkTrustlineStatus(temp);
    }
  };

  const executeSwap = async () => {
    if (!fromToken || !toToken || !fromAmount || !isWalletConnected) {
      toast({
        title: "Invalid Swap",
        description: "Please select tokens and enter amount",
        variant: "destructive"
      });
      return;
    }

    // If Joey Wallet or Xaman is selected, generate deeplink
    if (selectedWallet === 'joey' || selectedWallet === 'xaman') {
      await generateDeeplink();
      return;
    }

    // For Riddle Wallet, show password modal directly
    setShowPasswordModal(true);
    return;
    
    // OLD LIQUIDITY CHECK (MOVED TO TOKEN SELECTION):
    /*
    try {
      console.log('🔍 Checking liquidity before swap...');
      const liquidityResponse = await fetch('/api/xrpl/liquidity/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          fromToken: fromToken.symbol,
          toToken: toToken.symbol,
          amount: fromAmount,
          fromIssuer: fromToken.issuer || '',
          toIssuer: toToken.issuer || ''
        })
      });

      const liquidityData = await liquidityResponse.json();
      
      if (!liquidityData.success || !liquidityData.hasLiquidity) {
        toast({
          title: "Insufficient Liquidity",
          description: liquidityData.message || "Not enough liquidity available for this swap",
          variant: "destructive"
        });
        return;
      }

      // Warn about high price impact
      if (liquidityData.estimatedImpact > 0.02) {
        toast({
          title: "High Price Impact Warning",
          description: `This swap may have ${(liquidityData.estimatedImpact * 100).toFixed(1)}% price impact`,
          variant: "default"
        });
      }
      
      console.log('✅ Liquidity check passed:', liquidityData.message);
    } catch (error) {
      console.error('Liquidity check failed:', error);
      // Continue anyway if check fails - let backend handle it
    }

    // Show password modal and return early - execution continues in handlePasswordSubmit
    setShowPasswordModal(true);
    return;
    */
  };

  // Handle Joey Wallet via WalletConnect
  const handleJoeyWalletConnect = async (transaction: any) => {
    try {
      console.log('📱 [JOEY SWAP] Initializing WalletConnect for swap...');
      
      // Get project ID from environment variable (same as login)
  const { getWalletConnectProjectId, runWalletEnvDiagnostics } = await import('@/lib/wallet-env');
  const projectId = getWalletConnectProjectId();
  runWalletEnvDiagnostics();
      
      console.log('📱 [JOEY SWAP] Using WalletConnect Project ID:', projectId);
      
      // Initialize SignClient if not already initialized
      let client = signClient;
      if (!client) {
        client = await SignClient.init({
          projectId: projectId,
          relayUrl: 'wss://relay.walletconnect.com',
          metadata: {
            name: 'RiddleSwap',
            description: 'Multi-chain DEX and DeFi platform',
            url: window.location.origin,
            icons: [`${window.location.origin}/icon.png`]
          }
        });
        
        setSignClient(client);
        console.log('✅ [JOEY SWAP] SignClient initialized');
      }
      
      // Check if we have an active session
      let session = joeySession;
      if (!session || !session.topic) {
        // Create a new pairing with QR code
        const { uri, approval } = await client.connect({
          requiredNamespaces: {
            xrpl: {
              methods: ['xrpl_signTransaction', 'xrpl_signMessage', 'xrpl_getAccount'],
              chains: ['xrpl:1'],
              events: ['accountsChanged', 'chainChanged']
            }
          }
        });
        
        console.log('📱 [JOEY SWAP] WalletConnect URI created:', uri);
        
        // Generate QR code
        const qrCodeDataUrl = await QRCode.toDataURL(uri || '', {
          width: 200,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
        
        // Create Joey deep link
        const joeyDeepLink = `https://joey.app/wc?uri=${encodeURIComponent(uri || '')}`;
        
        setDeeplinkUrl(joeyDeepLink);
        setQrCodeUrl(qrCodeDataUrl);
        setShowDeeplinkModal(true);
        
        // Wait for session approval
        session = await approval();
        setJoeySession(session);
        console.log('✅ [JOEY SWAP] Session approved:', session);
      }
      
      // Send transaction to Joey wallet
      console.log('📝 [JOEY SWAP] Requesting transaction signature from Joey wallet...');
      
      const signatureResult = await client.request({
        topic: session.topic,
        chainId: 'xrpl:1',
        request: {
          method: 'xrpl_signTransaction',
          params: {
            transaction: transaction,
            address: walletAddress
          }
        }
      });
      
      console.log('✅ [JOEY SWAP] Transaction signed:', signatureResult);
      
      // Close modal and show success
      setShowDeeplinkModal(false);
      toast({
        title: 'Swap Complete',
        description: 'Transaction signed successfully in Joey wallet',
      });
      
    } catch (error: any) {
      console.error('❌ [JOEY SWAP] WalletConnect error:', error);
      
      // Fallback to backend method (like login does)
      console.log('📱 [JOEY SWAP] Falling back to backend connection method...');
      await handleJoeyBackendMethod(transaction);
    }
  };

  // Backend fallback for Joey wallet (same as login)
  const handleJoeyBackendMethod = async (transaction: any) => {
    try {
      // Get or generate external session ID
      let externalSessionId = localStorage.getItem('external_session_id');
      if (!externalSessionId) {
        externalSessionId = `ext_${crypto.randomUUID()}_${Date.now()}`;
        localStorage.setItem('external_session_id', externalSessionId);
      }

      const response = await fetch('/api/external-wallets/joey/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-External-Session-ID': externalSessionId
        },
        body: JSON.stringify({
          purpose: 'Sign XRPL swap transaction',
          transaction: transaction
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create Joey wallet connection');
      }

      const data = await response.json() as any;
      
      const qrDataUrl = data.qrCode ? `data:image/png;base64,${data.qrCode}` : '';
      
      setDeeplinkUrl(data.deepLink || '');
      setQrCodeUrl(qrDataUrl);
      setShowDeeplinkModal(true);
      
      localStorage.setItem('external_session_id', data.sessionId || externalSessionId);
      
      toast({
        title: 'Scan QR Code',
        description: 'Scan the QR code in Joey wallet to complete the swap',
      });
      
    } catch (error: any) {
      console.error('❌ [JOEY SWAP] Backend fallback failed:', error);
      toast({
        title: 'Joey Wallet Error',
        description: error.message || 'Failed to complete transaction with Joey wallet',
        variant: 'destructive'
      });
    }
  };

  // Generate deeplink for Joey Wallet or Xaman (no SDK, only deeplinks)
  const generateDeeplink = async () => {
    if (!fromToken || !toToken || !fromAmount || !selectedWalletAddress) {
      return;
    }

    setIsLoading(true);
    try {
      // Get swap transaction deeplink (wallets collect fees automatically)
      // Pass the SAME quote values that were already shown to user
      const response = await fetch('/api/xrpl/swap/deeplink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          fromToken: fromToken.symbol,
          toToken: toToken.symbol,
          amount: fromAmount,
          fromIssuer: fromToken.issuer || '',
          toIssuer: toToken.issuer || '',
          slippage: slippage,
          walletAddress: selectedWalletAddress,
          walletType: selectedWallet,
          expectedOutput: toAmount, // Use the SAME quote value shown to user
          minOutput: minimumReceived // Use the SAME minimum shown to user
        })
      });

      const result = await response.json() as any;
      
      if (result.success) {
        // Joey wallet uses WalletConnect - handle differently
        if (result.useWalletConnect) {
          await handleJoeyWalletConnect(result.transaction);
          setIsLoading(false);
          return;
        }
        
        setDeeplinkUrl(result.deeplink);
        setQrCodeUrl(result.qrCode || ''); // Set QR code from Xaman API
        setShowDeeplinkModal(true);
        
        toast({
          title: 'Scan QR Code',
          description: `Scan the QR code or open ${selectedWallet === 'joey' ? 'Joey Wallet' : 'Xaman'} to complete the swap`,
        });
      } else {
        throw new Error(result.error || 'Failed to generate deeplink');
      }
    } catch (error: any) {
      console.error('Deeplink generation error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate deeplink",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle swap confirmation and execute
  const handleSwapConfirm = async () => {
    setShowPasswordModal(false);
    // Execute the swap without password requirement
    await handleSwapExecution();
  };

  // Search for tokens to add trustlines
  const searchTrustlineTokens = async (query: string) => {
    if (!query || query.length < 2) {
      setTrustlineSearchResults([]);
      return;
    }
    
    try {
      // Get session token for authentication
      const finalToken = sessionManager.getSessionToken() || localStorage.getItem('sessionToken') || getSessionToken();
      
      const response = await fetch(`/api/xrpl/search-tokens?query=${encodeURIComponent(query)}`, {
        headers: finalToken ? {
          'Authorization': `Bearer ${finalToken}`
        } : {}
      });
      
      if (response.ok) {
        const data = await response.json() as any;
        if (data.success && data.tokens) {
          setTrustlineSearchResults(data.tokens);
        }
      }
    } catch (error) {
      console.error('Error searching tokens:', error);
    }
  };
  
  // Handle trustline creation with progress
  const handleCreateTrustline = async (token: TokenSearchResult) => {
    if (!selectedWalletAddress) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet first",
        variant: "destructive"
      });
      return;
    }
    
    setIsCreatingTrustline(true);
    setTrustlineProgress({
      step: 1,
      totalSteps: 2,
      message: `Checking trustline for ${token.symbol}...`,
      error: ''
    });
    
    try {
      // Step 1: Check if trustline already exists
      const status = await trustlineManager.checkTrustlineStatus(
        selectedWalletAddress,
        token.currency_code,
        token.issuer
      );
      
      if (status.hasTrustline) {
        toast({
          title: "Trustline Exists",
          description: `You already have a trustline for ${token.symbol}`,
        });
        setIsCreatingTrustline(false);
        return;
      }
      
      // Step 2: Create trustline
      setTrustlineProgress({
        step: 2,
        totalSteps: 2,
        message: `Creating trustline for ${token.symbol}...`,
        error: ''
      });
      
      const result = await trustlineManager.createTrustline(
        selectedWalletAddress,
        token,
        '1000000000'
      );
      
      if (result.success) {
        toast({
          title: "Trustline Created ✅",
          description: `Successfully added ${token.symbol} to your wallet`,
        });
        
        // Refresh owned tokens
        if (selectedWalletAddress) {
          const response = await fetch(`/api/xrpl/tokens/${selectedWalletAddress}`);
          const data = await response.json() as any;
          if (data.success && data.tokens) {
            const formatted = data.tokens.map((t: any) => ({
              symbol: t.symbol,
              name: t.symbol,
              currency_code: t.currency,
              issuer: t.issuer || '',
              logoURI: t.logoURI || t.icon_url || t.logo_url || '',
              logo_url: t.icon_url || t.logo_url || '',
              icon_url: t.icon_url || t.logo_url || '',
              price_usd: t.price_usd || 0,
              volume_24h: t.volume_24h || 0,
              price_change_24h: t.price_change_24h || 0,
              verified: true,
              source: 'owned',
              balance: t.balance
            }));
            setOwnedTokens(formatted);
          }
        }
        
        setShowAddTrustlineModal(false);
        setTrustlineSearchQuery('');
        setTrustlineSearchResults([]);
      } else {
        throw new Error(result.error || 'Failed to create trustline');
      }
    } catch (error) {
      console.error('Error creating trustline:', error);
      setTrustlineProgress(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to create trustline'
      }));
      toast({
        title: "Trustline Creation Failed",
        description: error instanceof Error ? error.message : 'Failed to create trustline',
        variant: "destructive"
      });
    } finally {
      setIsCreatingTrustline(false);
    }
  };

  // Execute swap with current connected wallet
  const handleSwapExecution = async () => {
    // Check if wallet is connected and we have the necessary data
    if (!isWalletConnected || !walletAddress || !fromToken || !toToken || !fromAmount) {
      toast({
        title: "Connection Required",
        description: "Please ensure your wallet is connected and tokens are selected",
        variant: "destructive"
      });
      return;
    }

    // Prevent double processing
    if (isLoading) return;

    setShowPasswordModal(false);
    setIsLoading(true);
    setError(null);
    setSwapStatus('submitting');
    setShowProgressModal(true);

    // Enhanced progress tracking with fee details
    setSwapProgress({
      step: 1,
      totalSteps: 3,
      message: 'Preparing swap transaction...',
      txHash: '',
      error: '',
      fromAmount: fromAmount,
      toAmount: toAmount || '0',
      fromSymbol: fromToken?.symbol || '',
      toSymbol: toToken?.symbol || '',
      feeDetails: {
        originalAmount: fromAmount,
        platformFee: (parseFloat(fromAmount) * 0.01).toFixed(6), // 1% fee (paid separately in XRP)
        actualAmount: toAmount || '0', // User gets 100% of swap output
        networkFee: 'Variable',
        totalFees: (parseFloat(fromAmount) * 0.01).toFixed(6)
      }
    });

    try {
      console.log('🔄 Sending swap to backend...');
      
      // Step 1: Setting up trustlines (if needed)
      setSwapProgress(prev => ({
        ...prev,
        step: 1,
        totalSteps: 3,
        message: trustlineStatus && !trustlineStatus.hasTrustline 
          ? `🔗 Setting up trustline for ${toToken?.symbol}...` 
          : '✓ Trustline check complete'
      }));
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Step 2: Executing swap transaction
      setSwapProgress(prev => ({
        ...prev,
        step: 2,
        totalSteps: 3,
        message: `💱 Swapping ${fromAmount} ${fromToken?.symbol} → ${toAmount} ${toToken?.symbol}...`
      }));
      
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Step 3: Processing platform fee
      setSwapProgress(prev => ({
        ...prev,
        step: 3,
        totalSteps: 3,
        message: `💰 Processing platform fee (1% = ${platformFee} ${fromToken?.symbol})...`
      }));
      
      // Get session token from centralized session manager
      console.log('🔍 [SESSION DEBUG] Attempting to get session token for swap...');
      console.log('🔍 [SESSION DEBUG] Current page:', window.location.pathname);
      console.log('🔍 [SESSION DEBUG] Component wallet address:', selectedWalletAddress);
      console.log('🔍 [SESSION DEBUG] isWalletConnected:', isWalletConnected);
      
      const sessionToken = sessionManager.getSessionToken();
      
      console.log('🔍 [SESSION DEBUG] Session token from sessionManager:', sessionToken ? `Found (${sessionToken.substring(0, 10)}...)` : 'NOT FOUND');
      console.log('🔍 [SESSION DEBUG] localStorage sessionToken:', localStorage.getItem('sessionToken') ? 'Found' : 'NOT FOUND');
      console.log('🔍 [SESSION DEBUG] auth utility token:', getSessionToken() ? 'Found' : 'NOT FOUND');
      
      // Try all possible session token sources
      const finalToken = sessionToken || localStorage.getItem('sessionToken') || getSessionToken();
      
      if (!finalToken) {
        console.error('❌ [SESSION DEBUG] No session token found from any source!');
        console.error('❌ [SESSION DEBUG] sessionManager:', sessionToken);
        console.error('❌ [SESSION DEBUG] localStorage:', localStorage.getItem('sessionToken'));
        console.error('❌ [SESSION DEBUG] auth utility:', getSessionToken());
        throw new Error('No session token found. Please log in again.');
      }
      
      console.log('✅ [SESSION DEBUG] Using token for swap authentication');
      console.log('🔍 [SESSION DEBUG] Token source:', sessionToken ? 'sessionManager' : localStorage.getItem('sessionToken') ? 'localStorage' : 'authUtility');
      
      const response = await fetch('/api/xrpl/swap/v2/execute', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${finalToken}`
        },
        body: JSON.stringify({
          fromToken: fromToken!.symbol,
          toToken: toToken!.symbol,
          amount: parseFloat(fromAmount),
          fromIssuer: fromToken!.issuer || '',
          toIssuer: toToken!.issuer || '',
          slippagePercent: slippage,
          walletAddress: selectedWalletAddress,
          // Provide optional handle for decrypt fallback if no cached key is present
          riddleWalletHandle: (walletHandle as any) || undefined
        })
      });

      if (!response.ok) {
        // If 401 Unauthorized, clear stale session tokens and prompt re-login
        if (response.status === 401) {
          console.log('🧹 Session expired - clearing stale tokens');
          localStorage.removeItem('sessionToken');
          localStorage.removeItem('nft_session_token');
          sessionStorage.removeItem('riddle_wallet_session');
          throw new Error('Session expired. Please log in again to continue trading.');
        }
        throw new Error(`Swap failed: ${response.status}`);
      }

      const result = await response.json() as any;
      
      if (result.success) {
        console.log('✅ Swap successful on blockchain:', result);
        console.log('📊 Transaction hash:', result.txHash);
        console.log('💰 Actual received:', result.actualReceived);
        
        // Complete - Fee was already sent
        await new Promise(resolve => setTimeout(resolve, 800)); // Small delay for UX
        
        // Final completion
        setSwapProgress(prev => ({
          ...prev,
          step: 3,
          totalSteps: 3,
          message: `✅ Complete! Platform fee (1%) sent to bank wallet`,
          txHash: result.txHash || '',
          feeDetails: result.feeDetails || prev.feeDetails
        }));
        setSwapStatus('success');

        // CRITICAL: Refresh balances multiple times to ensure UI updates
        console.log('🔄 Refreshing balances after successful swap...');
        queryClient.invalidateQueries({ queryKey: ['/api/balance/v2'] });
        
        // Force reload owned tokens to show updated balances
        const refreshOwnedTokens = async () => {
          if (!selectedWalletAddress) return;
          
          try {
            console.log('🔄 Reloading owned tokens...');
            const response = await fetch(`/api/xrpl/tokens/${selectedWalletAddress}`);
            const data = await response.json() as any;
            
            if (data.success && data.tokens) {
              const formatted = data.tokens.map((token: any) => ({
                symbol: token.symbol,
                name: token.symbol,
                currency_code: token.currency,
                issuer: token.issuer || '',
                logoURI: token.logoURI || token.icon_url || token.logo_url || '',
                logo_url: token.icon_url || token.logo_url || '',
                icon_url: token.icon_url || token.logo_url || '',
                price_usd: token.price_usd || 0,
                volume_24h: token.volume_24h || 0,
                price_change_24h: token.price_change_24h || 0,
                verified: true,
                source: 'owned',
                balance: token.balance
              }));
              
              const sorted = formatted.sort((a, b) => {
                if (a.symbol === 'XRP') return -1;
                if (b.symbol === 'XRP') return 1;
                return a.symbol.localeCompare(b.symbol);
              });
              
              setOwnedTokens(sorted);
              console.log(`✅ Reloaded ${sorted.length} owned tokens after swap`);
            }
          } catch (error) {
            console.error('Failed to refresh owned tokens:', error);
          }
        };
        
        await refreshOwnedTokens();
        
        // Poll balance API for 10 seconds to ensure ledger updates are captured
        let pollCount = 0;
        const pollInterval = setInterval(async () => {
          pollCount++;
          console.log(`🔄 Balance poll ${pollCount}/5`);
          
          queryClient.invalidateQueries({ queryKey: ['/api/balance/v2'] });
          await refreshOwnedTokens();
          
          if (pollCount >= 5) {
            clearInterval(pollInterval);
            console.log('✅ Balance polling complete');
          }
        }, 2000); // Poll every 2 seconds for 10 seconds total
        
        // Cleanup: Store interval ID and clear it when this swap completes or fails
        // This ensures we don't have lingering intervals if component unmounts
        const cleanupPolling = () => {
          if (pollInterval) {
            clearInterval(pollInterval);
            console.log('🧹 Cleaned up balance polling interval');
          }
        };
        
        // Auto cleanup after max duration (11 seconds buffer)
        setTimeout(cleanupPolling, 11000);

        // Reset form immediately but keep modal open
        setFromAmount('');
        setToAmount('');
        
        toast({
          title: "Swap Successful ✅", 
          description: `${fromAmount} ${fromToken?.symbol} → ${toAmount} ${toToken?.symbol}. Balances updating...`,
        });
        
      } else {
        console.error('❌ Swap failed - backend returned success=false:', result);
        throw new Error(result.error || 'Swap failed');
      }
      
    } catch (error) {
      console.error('Swap failed:', error);
      
      // Update progress to show error
      setSwapProgress(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Transaction failed'
      }));
      setSwapStatus('error');
      
      // Close progress modal after 5 seconds
      setTimeout(() => {
        setShowProgressModal(false);
        setSwapStatus('idle');
      }, 8000);
      
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Main Swap Card */}
      <Card className="bg-white dark:bg-gray-900 shadow-xl border-0">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white">
              Swap Tokens
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="h-4 w-4 text-gray-500" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Settings Panel */}
          {showSettings && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Slippage Tolerance
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">{slippage}%</span>
              </div>
              <div className="flex gap-2">
                {[0.5, 1, 2].map((preset) => (
                  <Button
                    key={preset}
                    variant={slippage === preset ? "default" : "outline"}
                    size="sm"
                    className="flex-1 h-8"
                    onClick={() => setSlippage(preset)}
                  >
                    {preset}%
                  </Button>
                ))}
                <Input
                  type="number"
                  placeholder="Custom"
                  value={slippage}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || 0;
                    if (value >= 0 && value <= 50) {
                      setSlippage(value);
                    }
                  }}
                  className="w-20 h-8 text-xs"
                  step="0.1"
                  min="0"
                  max="50"
                />
              </div>
            </div>
          )}

          {/* From Token Input */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">You pay</span>
              {fromToken && isWalletConnected && currentBalance && (
                <button
                  onClick={() => setFromAmount(currentBalance)}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Balance: {parseFloat(currentBalance).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1">
                <NumericInput
                  placeholder="0.00"
                  value={fromAmount}
                  onChange={(e) => setFromAmount(e.target.value)}
                  showDoubleZero={true}
                  disabled={!isWalletConnected}
                  className="text-2xl font-bold bg-transparent border-0 p-0 h-auto text-gray-900 dark:text-white focus:ring-0"
                />
                {fromToken?.price_usd && fromAmount && parseFloat(fromAmount) > 0 && (
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    ≈ ${formatUsd(parseFloat(fromAmount) * fromToken.price_usd)}
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  if (!isWalletConnected) {
                    toast({
                      title: "Connect Wallet",
                      description: "Please connect your XRPL wallet first",
                      variant: "destructive"
                    });
                    return;
                  }
                  setSelectingFor('from');
                  setShowTokenModal(true);
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                disabled={!isWalletConnected}
              >
                {fromToken ? (
                  <>
                    <TokenLogo
                      symbol={fromToken.symbol}
                      logoURI={fromToken.logoURI || fromToken.logo_url || fromToken.icon_url}
                      size="sm"
                      className="rounded-full"
                    />
                    <span className="font-semibold text-gray-900 dark:text-white">{fromToken.symbol}</span>
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  </>
                ) : (
                  <>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Select token</span>
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Swap Arrow */}
          <div className="flex justify-center -my-2 relative z-10">
            <Button
              variant="outline"
              size="icon"
              onClick={swapTokens}
              className="rounded-full w-10 h-10 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm"
              disabled={!isWalletConnected}
            >
              <ArrowDownUp className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            </Button>
          </div>

          {/* To Token Input */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">You receive</span>
              {toToken && toToken.price_usd && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  ${toToken.price_usd.toFixed(5)}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {toAmount ? parseFloat(toAmount).toLocaleString('en-US', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 6
                  }) : '0.00'}
                </div>
                {toToken?.price_usd && toAmount && parseFloat(toAmount) > 0 && (
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    ≈ ${formatUsd(parseFloat(toAmount) * toToken.price_usd)}
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  if (!isWalletConnected) {
                    toast({
                      title: "Connect Wallet",
                      description: "Please connect your XRPL wallet first",
                      variant: "destructive"
                    });
                    return;
                  }
                  setSelectingFor('to');
                  setShowTokenModal(true);
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                disabled={!isWalletConnected}
              >
                {toToken ? (
                  <>
                    <TokenLogo
                      symbol={toToken.symbol}
                      logoURI={toToken.logoURI || toToken.logo_url || toToken.icon_url}
                      size="sm"
                      className="rounded-full"
                    />
                    <span className="font-semibold text-gray-900 dark:text-white">{toToken.symbol}</span>
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  </>
                ) : (
                  <>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Select token</span>
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Rate Information */}
          {fromToken && toToken && fromAmount && exchangeRate && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600 dark:text-gray-400">Exchange Rate</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  1 {fromToken.symbol} = {exchangeRate} {toToken.symbol}
                </span>
              </div>

              {minimumReceived && (
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600 dark:text-gray-400">Minimum Received</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {parseFloat(minimumReceived).toLocaleString()} {toToken.symbol}
                  </span>
                </div>
              )}

              {priceImpact && (
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600 dark:text-gray-400">Price Impact</span>
                  <span className="font-medium text-green-600 dark:text-green-400">{priceImpact}</span>
                </div>
              )}

              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Platform Fee</span>
                <span className="font-medium text-gray-900 dark:text-white">{platformFee} {fromToken.symbol}</span>
              </div>
            </div>
          )}

          {/* Swap Button */}
          {!isWalletConnected ? (
            <Button
              onClick={() => {
                toast({
                  title: "Connect Wallet",
                  description: "Please connect your XRPL wallet to start swapping",
                  variant: "destructive"
                });
              }}
              className="w-full h-12 text-base font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
            >
              Connect Wallet
            </Button>
          ) : (
            <Button
              onClick={executeSwap}
              disabled={!fromToken || !toToken || !fromAmount || isLoading || parseFloat(fromAmount) <= 0}
              className="w-full h-12 text-base font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-xl"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Swapping...
                </>
              ) : !fromToken || !toToken ? (
                'Select tokens'
              ) : !fromAmount || parseFloat(fromAmount) <= 0 ? (
                'Enter amount'
              ) : (
                <>
                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                  Swap Tokens
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>



      {/* Token Selection Modal - Simple & Clean */}
      {showTokenModal && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowTokenModal(false);
              setSearchQuery("");
            }
          }}
        >
          <Card className="w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden">
            <CardHeader className="pb-3 border-b">
              <div className="flex justify-between items-center mb-3">
                <CardTitle className="text-lg">Select a token</CardTitle>
                <button
                  onClick={() => {
                    setShowTokenModal(false);
                    setSearchQuery("");
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search name or symbol (e.g., XRP, SOLO, USD...)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  autoFocus
                />
              </div>
              {isLoadingTokens && (
                <div className="text-xs text-muted-foreground flex items-center mt-2">
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  Searching all XRPL tokens...
                </div>
              )}
            </CardHeader>
            
            <div className="flex-1 overflow-y-auto">
              {/* Show owned tokens first when FROM selector and no search */}
              {selectingFor === 'from' && !searchQuery && ownedTokens.length > 0 && (
                <div className="p-2">
                  <div className="px-3 py-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">Your Tokens</div>
                  {ownedTokens.map((token) => (
                    <button
                      key={`${token.symbol}_${token.issuer}`}
                      onClick={() => handleSelectToken(token)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-accent rounded-xl transition-all"
                    >
                      <TokenLogo 
                        symbol={token.symbol} 
                        logoURI={token.logoURI || token.logo_url || token.icon_url}
                        size="lg" 
                        className="rounded-full" 
                      />
                      <div className="flex-1 text-left">
                        <div className="font-bold text-base">{token.symbol}</div>
                        {token.balance && (
                          <div className="text-sm text-muted-foreground font-medium">
                            {parseFloat(token.balance).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                          </div>
                        )}
                      </div>
                      {token.price_usd && token.price_usd > 0 && (
                        <div className="text-right">
                          <div className="font-bold text-sm">${token.price_usd.toFixed(4)}</div>
                          {token.price_change_24h !== undefined && token.price_change_24h !== 0 && (
                            <div className={`text-xs font-semibold ${token.price_change_24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {token.price_change_24h >= 0 ? '+' : ''}{token.price_change_24h.toFixed(2)}%
                            </div>
                          )}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
              
              {/* Show featured tokens when TO selector and no search */}
              {selectingFor === 'to' && !searchQuery && featuredTokens.length > 0 && (
                <div className="p-2">
                  <div className="px-3 py-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">Popular Tokens</div>
                  {featuredTokens.map((token) => (
                    <button
                      key={`${token.symbol}_${token.issuer}`}
                      onClick={() => handleSelectToken(token)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-accent rounded-xl transition-all"
                    >
                      <TokenLogo 
                        symbol={token.symbol} 
                        logoURI={token.logoURI || token.logo_url || token.icon_url}
                        size="lg" 
                        className="rounded-full" 
                      />
                      <div className="flex-1 text-left">
                        <div className="font-bold text-base">{token.symbol}</div>
                        {token.name && token.name !== token.symbol && (
                          <div className="text-sm text-muted-foreground truncate font-medium">{token.name}</div>
                        )}
                      </div>
                      {token.price_usd && token.price_usd > 0 && (
                        <div className="text-right">
                          <div className="font-bold text-sm">${token.price_usd.toFixed(4)}</div>
                          {token.price_change_24h !== undefined && token.price_change_24h !== 0 && (
                            <div className={`text-xs font-semibold ${token.price_change_24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {token.price_change_24h >= 0 ? '+' : ''}{token.price_change_24h.toFixed(2)}%
                            </div>
                          )}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
              
              {/* Show search results */}
              {searchQuery && (
                <div className="p-2">
                  {allTokens.length > 0 ? (
                    <>
                      <div className="px-3 py-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        {allTokens.length} {allTokens.length === 1 ? 'Result' : 'Results'}
                      </div>
                      {allTokens.map((token) => (
                        <button
                          key={`${token.symbol}_${token.issuer}`}
                          onClick={() => handleSelectToken(token)}
                          className="w-full flex items-center gap-3 p-3 hover:bg-accent rounded-xl transition-all"
                        >
                          <TokenLogo 
                            symbol={token.symbol} 
                            logoURI={token.logoURI || token.logo_url || token.icon_url}
                            size="lg" 
                            className="rounded-full" 
                          />
                          <div className="flex-1 text-left min-w-0">
                            <div className="font-bold text-base">{token.symbol}</div>
                            {token.name && token.name !== token.symbol && (
                              <div className="text-sm text-muted-foreground truncate font-medium">{token.name}</div>
                            )}
                          </div>
                          {token.price_usd && token.price_usd > 0 ? (
                            <div className="text-right">
                              <div className="font-bold text-sm">${token.price_usd.toFixed(4)}</div>
                              {token.price_change_24h !== undefined && token.price_change_24h !== 0 && (
                                <div className={`text-xs font-semibold ${token.price_change_24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {token.price_change_24h >= 0 ? '+' : ''}{token.price_change_24h.toFixed(2)}%
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground font-medium">No price</div>
                          )}
                        </button>
                      ))}
                    </>
                  ) : isLoadingTokens ? (
                    <div className="text-center py-12">
                      <Loader2 className="h-10 w-10 animate-spin mx-auto mb-3 text-primary" />
                      <p className="text-sm font-medium text-muted-foreground">Searching DexScreener...</p>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Search className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
                      <p className="text-base font-bold">No tokens found</p>
                      <p className="text-sm text-muted-foreground mt-1">Try searching for XRP, SOLO, or USD</p>
                    </div>
                  )}
                </div>
              )}
              
              {/* Empty state for no search */}
              {!searchQuery && selectingFor === 'from' && ownedTokens.length === 0 && (
                <div className="text-center py-8 px-4">
                  {isLoadingOwnedTokens ? (
                    <>
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
                      <p className="text-sm text-muted-foreground">Loading your tokens...</p>
                    </>
                  ) : (
                    <>
                      <Wallet className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                      <p className="text-sm font-medium">No tokens in your wallet</p>
                      <p className="text-xs text-muted-foreground mt-1">Search above to find tokens</p>
                    </>
                  )}
                </div>
              )}
              
              {!searchQuery && selectingFor === 'to' && featuredTokens.length === 0 && (
                <div className="text-center py-8 px-4">
                  {isLoadingFeaturedTokens ? (
                    <>
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
                      <p className="text-sm text-muted-foreground">Loading popular tokens...</p>
                    </>
                  ) : (
                    <>
                      <TrendingUp className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                      <p className="text-sm font-medium">No featured tokens</p>
                      <p className="text-xs text-muted-foreground mt-1">Search above to find tokens</p>
                    </>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}


      {/* Progress Modal - Professional & Mobile Optimized */}
      <Dialog open={showProgressModal} onOpenChange={() => {}}>
        <DialogContent className="w-[92%] max-w-sm mx-auto p-0 gap-0 overflow-hidden">
          {/* Success State - Professional & Centered */}
          {swapStatus === 'success' && (
            <div className="flex flex-col items-center justify-center text-center py-8 px-6">
              {/* Success Icon with Animation */}
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping" />
                <div className="relative flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full">
                  <CheckCircle className="h-10 w-10 text-white" />
                </div>
              </div>

              {/* Success Message */}
              <h3 className="text-2xl font-bold text-green-600 dark:text-green-400 mb-2">
                Swap Successful!
              </h3>
              
              {/* Transaction Details */}
              <div className="w-full bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-center gap-3 text-lg font-semibold">
                  <span className="text-foreground">{swapProgress.fromAmount} {swapProgress.fromSymbol}</span>
                  <ArrowRightLeft className="h-5 w-5 text-green-600" />
                  <span className="text-green-600 dark:text-green-400">{swapProgress.toAmount} {swapProgress.toSymbol}</span>
                </div>
              </div>

              {/* Transaction Hash */}
              {swapProgress.txHash && (
                <div className="w-full mb-6">
                  <p className="text-xs text-muted-foreground mb-2">Transaction ID</p>
                  <div className="flex items-center gap-2 bg-secondary/50 rounded-lg p-2">
                    <code className="text-xs font-mono flex-1 truncate text-center">
                      {swapProgress.txHash.slice(0, 8)}...{swapProgress.txHash.slice(-8)}
                    </code>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 w-full">
                {swapProgress.txHash && (
                  <Button
                    asChild
                    variant="outline"
                    className="flex-1"
                  >
                    <a
                      href={`https://livenet.xrpl.org/transactions/${swapProgress.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2"
                    >
                      <ExternalLink className="h-4 w-4" />
                      View Details
                    </a>
                  </Button>
                )}
                <Button 
                  onClick={() => {
                    setShowProgressModal(false);
                    setSwapStatus('idle');
                  }}
                  className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                >
                  Done
                </Button>
              </div>
            </div>
          )}

          {/* Processing State */}
          {swapStatus === 'submitting' && (
            <div className="flex flex-col items-center justify-center text-center py-8 px-6">
              <div className="relative mb-6">
                <div className="flex items-center justify-center w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                  <RefreshCw className="h-10 w-10 text-blue-600 animate-spin" />
                </div>
              </div>
              
              <h3 className="text-xl font-bold mb-2">Processing Swap</h3>
              <p className="text-sm text-muted-foreground mb-6">{swapProgress.message}</p>
              
              {/* Progress Steps with Visual Indicators */}
              <div className="w-full space-y-3 mb-6">
                {/* Step 1: Trustline */}
                <div className={`flex items-center gap-3 p-2 rounded-lg transition-all ${
                  swapProgress.step > 1 
                    ? 'bg-green-100 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
                    : swapProgress.step === 1 
                    ? 'bg-blue-100 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                    : 'bg-secondary/20 border border-transparent'
                }`}>
                  {swapProgress.step > 1 ? (
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                  ) : swapProgress.step === 1 ? (
                    <RefreshCw className="h-5 w-5 text-blue-600 animate-spin flex-shrink-0" />
                  ) : (
                    <Clock className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  )}
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium">Step 1: Trustline Check</div>
                    <div className="text-xs text-muted-foreground">Setting up token trustlines</div>
                  </div>
                </div>

                {/* Step 2: Swap */}
                <div className={`flex items-center gap-3 p-2 rounded-lg transition-all ${
                  swapProgress.step > 2 
                    ? 'bg-green-100 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
                    : swapProgress.step === 2 
                    ? 'bg-blue-100 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                    : 'bg-secondary/20 border border-transparent'
                }`}>
                  {swapProgress.step > 2 ? (
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                  ) : swapProgress.step === 2 ? (
                    <RefreshCw className="h-5 w-5 text-blue-600 animate-spin flex-shrink-0" />
                  ) : (
                    <Clock className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  )}
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium">Step 2: Execute Swap</div>
                    <div className="text-xs text-muted-foreground">Swapping tokens on blockchain</div>
                  </div>
                </div>

                {/* Step 3: Fee Payment */}
                <div className={`flex items-center gap-3 p-2 rounded-lg transition-all ${
                  swapProgress.step >= 3 
                    ? 'bg-blue-100 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                    : 'bg-secondary/20 border border-transparent'
                }`}>
                  {swapProgress.step >= 3 ? (
                    <RefreshCw className="h-5 w-5 text-blue-600 animate-spin flex-shrink-0" />
                  ) : (
                    <Clock className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  )}
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium">Step 3: Platform Fee</div>
                    <div className="text-xs text-muted-foreground">Sending 1% fee to bank wallet</div>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-secondary/30 rounded-full h-2.5 mb-3 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-purple-600 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${(swapProgress.step / swapProgress.totalSteps) * 100}%` }}
                />
              </div>

              <div className="text-xs text-muted-foreground font-medium">
                {Math.round((swapProgress.step / swapProgress.totalSteps) * 100)}% Complete
              </div>
            </div>
          )}

          {/* Error State */}
          {swapStatus === 'error' && (
            <div className="flex flex-col items-center justify-center text-center py-8 px-6">
              <div className="relative mb-6">
                <div className="flex items-center justify-center w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full">
                  <AlertTriangle className="h-10 w-10 text-red-600" />
                </div>
              </div>
              
              <h3 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">
                Transaction Failed
              </h3>
              
              {swapProgress.error && (
                <div className="w-full bg-red-50 dark:bg-red-950/20 rounded-lg p-4 mb-6">
                  <p className="text-sm text-red-600 dark:text-red-300">{swapProgress.error}</p>
                </div>
              )}

              <Button 
                onClick={() => {
                  setShowProgressModal(false);
                  setSwapStatus('idle');
                }}
                variant="outline"
                className="w-full border-red-300 text-red-600 hover:bg-red-50"
              >
                Try Again
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation Modal - Enhanced with Fee Details */}
      <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <DialogContent className="w-[92%] max-w-md mx-auto">
          <DialogHeader className="space-y-1">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <ArrowRightLeft className="h-5 w-5 text-blue-600" />
              Confirm Swap
            </DialogTitle>
            <DialogDescription className="text-sm">
              Review all details carefully before confirming
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Main Swap Display */}
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
              <div className="space-y-3">
                {/* From Amount */}
                <div className="bg-white/80 dark:bg-gray-900/80 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-1">You Pay</div>
                  <div className="flex items-center gap-2">
                    {fromToken && <TokenLogo symbol={fromToken.symbol} logoURI={fromToken.logoURI || fromToken.logo_url || fromToken.icon_url} size="sm" />}
                    <div className="flex-1">
                      <div className="text-xl font-bold">{fromAmount} {fromToken?.symbol}</div>
                      {fromToken?.price_usd && parseFloat(fromAmount) > 0 && (
                        <div className="text-xs text-muted-foreground">
                          ≈ {formatUsd(parseFloat(fromAmount) * fromToken.price_usd)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex justify-center">
                  <div className="bg-blue-600 rounded-full p-2">
                    <ArrowDownUp className="h-4 w-4 text-white" />
                  </div>
                </div>

                {/* To Amount */}
                <div className="bg-white/80 dark:bg-gray-900/80 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-1">You Receive (estimated)</div>
                  <div className="flex items-center gap-2">
                    {toToken && <TokenLogo symbol={toToken.symbol} logoURI={toToken.logoURI || toToken.logo_url || toToken.icon_url} size="sm" />}
                    <div className="flex-1">
                      <div className="text-xl font-bold text-green-600 dark:text-green-400">
                        ~{toAmount} {toToken?.symbol}
                      </div>
                      {toToken?.price_usd && parseFloat(toAmount) > 0 && (
                        <div className="text-xs text-muted-foreground">
                          ≈ {formatUsd(parseFloat(toAmount) * toToken.price_usd)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Fee Breakdown */}
            <div className="bg-secondary/30 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Exchange Rate</span>
                <span className="font-medium">
                  1 {fromToken?.symbol} = {exchangeRate} {toToken?.symbol}
                </span>
              </div>
              
              {minimumReceived && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Minimum Received</span>
                  <span className="font-medium text-green-600 dark:text-green-400">
                    {minimumReceived} {toToken?.symbol}
                  </span>
                </div>
              )}
              
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Slippage Tolerance</span>
                <span className="font-medium">{slippage}%</span>
              </div>
              
              <div className="border-t border-border/50 pt-2 mt-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Platform Fee (1%)</span>
                  <span className="font-medium text-orange-600 dark:text-orange-400">
                    {platformFee} {fromToken?.symbol}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Network Fee (est.)</span>
                  <span>~0.00001 XRP</span>
                </div>
              </div>
            </div>

            {/* Trustline Warning if needed */}
            {trustlineStatus && !trustlineStatus.hasTrustline && (
              <Alert className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                <AlertTriangle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-sm">
                  A trustline will be created for {trustlineStatus.token} before swapping
                </AlertDescription>
              </Alert>
            )}
            
            {/* Action Buttons */}
            <div className="space-y-3">
              <SwipeConfirm
                onConfirm={handleSwapConfirm}
                disabled={false}
                text="Swipe to confirm swap"
                successText="Processing swap..."
                className="mb-2"
              />
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Wallet Selector Modal - Choose which Xaman wallet to use */}
      <Dialog open={showWalletSelector} onOpenChange={setShowWalletSelector}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Wallet for Swap</DialogTitle>
            <DialogDescription>
              Choose which wallet you want to use for this swap
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {connectedXamanWallets.filter(w => w.wallet !== 'riddle').map((wallet) => (
              <Button
                key={wallet.address}
                variant={selectedWalletAddress === wallet.address ? 'default' : 'outline'}
                className="w-full justify-between"
                onClick={() => {
                  setSelectedWalletAddress(wallet.address);
                  setShowWalletSelector(false);
                }}
              >
                <span className="flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  {wallet.address.slice(0, 8)}...{wallet.address.slice(-6)}
                </span>
                <Badge variant="secondary">{wallet.balance || '0'} XRP</Badge>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Trustline Modal */}
      <Dialog open={showAddTrustlineModal} onOpenChange={setShowAddTrustlineModal}>
        <DialogContent className="w-[92%] max-w-md mx-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-blue-600" />
              Add Token Trustline
            </DialogTitle>
            <DialogDescription>
              Search for a token and add it to your wallet
            </DialogDescription>
          </DialogHeader>
          
          {!isCreatingTrustline ? (
            <div className="space-y-4">
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search token name or symbol..."
                  value={trustlineSearchQuery}
                  onChange={(e) => {
                    setTrustlineSearchQuery(e.target.value);
                    searchTrustlineTokens(e.target.value);
                  }}
                  className="pl-10"
                />
              </div>

              {/* Search Results */}
              <div className="max-h-[400px] overflow-y-auto space-y-2">
                {trustlineSearchQuery.length >= 2 && trustlineSearchResults.length === 0 && (
                  <div className="text-center p-8 text-muted-foreground">
                    <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No tokens found</p>
                    <p className="text-xs mt-1">Try a different search term</p>
                  </div>
                )}
                
                {trustlineSearchResults.map((token) => (
                  <div
                    key={`${token.symbol}_${token.issuer}`}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-secondary/50 transition-all"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <TokenLogo 
                        symbol={token.symbol} 
                        issuer={token.issuer}
                        logoURI={token.logoURI || token.logo_url || token.icon_url}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{token.symbol}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {token.issuer.slice(0, 8)}...{token.issuer.slice(-6)}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleCreateTrustline(token)}
                      className="flex-shrink-0"
                    >
                      <Zap className="h-3 w-3 mr-1" />
                      Add
                    </Button>
                  </div>
                ))}
                
                {trustlineSearchQuery.length < 2 && (
                  <div className="text-center p-8 text-muted-foreground">
                    <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Enter at least 2 characters to search</p>
                  </div>
                )}
              </div>

              <Button 
                variant="outline" 
                onClick={() => {
                  setShowAddTrustlineModal(false);
                  setTrustlineSearchQuery('');
                  setTrustlineSearchResults([]);
                }}
                className="w-full"
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="space-y-4 py-6">
              {/* Creating Trustline Progress */}
              <div className="flex flex-col items-center justify-center text-center">
                <div className="relative mb-6">
                  <div className="flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                    <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
                  </div>
                </div>
                
                <h3 className="text-lg font-bold mb-2">Creating Trustline</h3>
                <p className="text-sm text-muted-foreground mb-6">{trustlineProgress.message}</p>
                
                {/* Progress Steps */}
                <div className="w-full space-y-3 mb-6">
                  {/* Step 1: Check */}
                  <div className={`flex items-center gap-3 p-2 rounded-lg transition-all ${
                    trustlineProgress.step > 1 
                      ? 'bg-green-100 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
                      : trustlineProgress.step === 1 
                      ? 'bg-blue-100 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                      : 'bg-secondary/20 border border-transparent'
                  }`}>
                    {trustlineProgress.step > 1 ? (
                      <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                    ) : trustlineProgress.step === 1 ? (
                      <RefreshCw className="h-5 w-5 text-blue-600 animate-spin flex-shrink-0" />
                    ) : (
                      <Clock className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    )}
                    <div className="flex-1 text-left">
                      <div className="text-sm font-medium">Step 1: Checking Trustline</div>
                      <div className="text-xs text-muted-foreground">Verify if trustline exists</div>
                    </div>
                  </div>

                  {/* Step 2: Create */}
                  <div className={`flex items-center gap-3 p-2 rounded-lg transition-all ${
                    trustlineProgress.step >= 2 
                      ? 'bg-blue-100 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                      : 'bg-secondary/20 border border-transparent'
                  }`}>
                    {trustlineProgress.step >= 2 ? (
                      <RefreshCw className="h-5 w-5 text-blue-600 animate-spin flex-shrink-0" />
                    ) : (
                      <Clock className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    )}
                    <div className="flex-1 text-left">
                      <div className="text-sm font-medium">Step 2: Create Trustline</div>
                      <div className="text-xs text-muted-foreground">Submit blockchain transaction</div>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-secondary/30 rounded-full h-2.5 mb-3 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-purple-600 h-2.5 rounded-full transition-all duration-500"
                    style={{ width: `${(trustlineProgress.step / trustlineProgress.totalSteps) * 100}%` }}
                  />
                </div>

                {trustlineProgress.error && (
                  <Alert className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-sm text-red-600 dark:text-red-300">
                      {trustlineProgress.error}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Deeplink Modal for Joey Wallet & Xaman */}
      <Dialog open={showDeeplinkModal} onOpenChange={setShowDeeplinkModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Sign Transaction in {selectedWallet === 'joey' ? 'Joey Wallet' : 'Xaman'}
            </DialogTitle>
            <DialogDescription>
              Scan the QR code or tap the button to open your wallet
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Swap Summary */}
            <div className="bg-secondary/20 rounded-lg p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span>From:</span>
                <span className="font-medium">{fromAmount} {fromToken?.symbol}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>To:</span>
                <span className="font-medium">~{toAmount} {toToken?.symbol}</span>
              </div>
            </div>

            {/* QR Code */}
            <div className="flex justify-center p-6 bg-white dark:bg-gray-900 rounded-lg">
              {qrCodeUrl ? (
                <img 
                  src={qrCodeUrl} 
                  alt="Xaman QR Code"
                  className="w-[200px] h-[200px]"
                />
              ) : (
                <QRCodeSVG 
                  value={deeplinkUrl} 
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              )}
            </div>

            {/* Open App Button */}
            <Button
              onClick={() => {
                window.open(deeplinkUrl, '_blank');
                toast({
                  title: "Opening Wallet",
                  description: `Launching ${selectedWallet === 'joey' ? 'Joey Wallet' : 'Xaman'}...`,
                });
              }}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
              size="lg"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in {selectedWallet === 'joey' ? 'Joey Wallet' : 'Xaman'}
            </Button>

            <Button
              variant="outline"
              onClick={() => setShowDeeplinkModal(false)}
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
