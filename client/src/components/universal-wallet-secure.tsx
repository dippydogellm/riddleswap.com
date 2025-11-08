import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { 
  ArrowLeft, 
  Send, 
  Download, 
  QrCode, 
  Copy,
  ExternalLink,
  Activity,
  DollarSign,
  Shield,
  Bitcoin,
  Key,
  Lock,
  FileText,
  Eye,
  EyeOff,
  Coins,
  Image,
  Gift,
  Plus,
  ChevronDown
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { TransactionSender } from "./transaction-sender";
// Logo removed - using text branding instead
import "../styles/global-theme.css";
// Removed NFT offers import - rebuilding clean
import { TokenLogo } from "@/components/ui/token-logo";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TransactionHistory } from "./transaction-history";
import { useToast } from "@/hooks/use-toast";
import { getSessionToken } from "@/utils/auth";
import { clearAllStaleSessions } from "@/utils/session-cleanup";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { connectJoeyWallet, disconnectJoeyWallet } from "@/lib/joey-wallet-integration";
import { connectXamanWallet, disconnectXamanWallet } from "@/lib/xaman-wallet-integration";
import { XamanConnectQR } from "@/components/XamanConnectQR";

import { NFTOffersManager } from "./nft-offers-manager";
import ChainNFTManager from "./nft/ChainNFTManager";

// Import separate chain systems
import { getXRPBalanceData, getETHBalanceData, getSOLBalanceData, getBTCBalanceData } from "@/lib/chain-balance-systems";
import { getChainTokens } from "@/lib/chain-token-systems";

// Wallet configurations for all supported chains
export const walletConfigs = {
  ethereum: {
    name: "Ethereum",
    symbol: "ETH",
    icon: <div className="w-10 h-10 rounded-full bg-[#627EEA] flex items-center justify-center text-white font-bold text-sm">ETH</div>,
    color: "#627EEA",
    addressKey: "ethAddress",
    placeholder: "0x...",
    explorerUrl: "https://etherscan.io/address/",
    explorerName: "Etherscan"
  },
  xrp: {
    name: "XRP",
    symbol: "XRP",
    icon: <div className="w-10 h-10 rounded-full bg-[#00AAE4] flex items-center justify-center text-white font-bold text-sm">XRP</div>,
    color: "#00AAE4",
    addressKey: "xrpAddress",
    placeholder: "r...",
    explorerUrl: "https://xrpscan.com/account/",
    explorerName: "XRPScan",
    hasDestinationTag: true,
    reserveAmount: "2.0 XRP"
  },
  solana: {
    name: "Solana",
    symbol: "SOL",
    icon: <img src="/images/chains/solana-logo.png" alt="SOL" className="w-10 h-10 rounded-full" onError={(e) => {e.currentTarget.style.display = 'none'}} />,
    color: "#14F195",
    addressKey: "solAddress",
    placeholder: "1...",
    explorerUrl: "https://solscan.io/account/",
    explorerName: "Solscan"
  },
  bitcoin: {
    name: "Bitcoin",
    symbol: "BTC",
    icon: <img src="/images/chains/bitcoin-logo.png" alt="BTC" className="w-10 h-10 rounded-full" onError={(e) => {e.currentTarget.style.display = 'none'}} />,
    color: "#F7931A",
    addressKey: "btcAddress",
    placeholder: "1... or 3... or bc1...",
    explorerUrl: "https://blockstream.info/address/",
    explorerName: "Blockstream"
  }
};

interface WalletConfig {
  name: string;
  symbol: string;
  icon: React.ReactNode;
  color: string;
  addressKey: string;
  placeholder: string;
  explorerUrl: string;
  explorerName: string;
  hasDestinationTag?: boolean;
  reserveAmount?: string;
}

interface UniversalWalletPageProps {
  config: WalletConfig;
}

export default function UniversalWalletPage({ config }: UniversalWalletPageProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [balance, setBalance] = useState("0.0");
  const [address, setAddress] = useState("");
  const [tokens, setTokens] = useState<any[]>([]);
  const [tokensLoaded, setTokensLoaded] = useState(false);
  const tokensRef = useRef<any[]>([]);
  const [nfts, setNfts] = useState<any[]>([]);
  const [reserveAmount, setReserveAmount] = useState("2.0");
  const [selectedAsset, setSelectedAsset] = useState<{type: 'native' | 'token' | 'nft', symbol: string, balance: string, contractAddress?: string, tokenId?: string}>({
    type: 'native',
    symbol: config?.symbol || 'ETH',
    balance: '0.0'
  });
  const [showSend, setShowSend] = useState(false);
  const [sendTo, setSendTo] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [destinationTag, setDestinationTag] = useState("");
  const [showQR, setShowQR] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [showPrivateKeyDialog, setShowPrivateKeyDialog] = useState(false);
  const [showSeedPhraseDialog, setShowSeedPhraseDialog] = useState(false);
  const [verificationPassword, setVerificationPassword] = useState("");
  const [privateKeyData, setPrivateKeyData] = useState<string | null>(null);
  const [seedPhraseData, setSeedPhraseData] = useState<string[] | null>(null);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [showSeedPhrase, setShowSeedPhrase] = useState(false);
  const [activeTab, setActiveTab] = useState("tokens");
  const [nftOffers, setNftOffers] = useState<any[]>([]);
  const [priceData, setPriceData] = useState<{[key: string]: number}>({});
  const [showXamanQR, setShowXamanQR] = useState(false);
  const [showAcceptAllDialog, setShowAcceptAllDialog] = useState(false);
  const [acceptAllPassword, setAcceptAllPassword] = useState("");
  const [isProcessingOffers, setIsProcessingOffers] = useState(false);
  const [removingTrustline, setRemovingTrustline] = useState<string | null>(null);
  
  // Determine wallet type from config
  const walletType = config?.symbol?.toLowerCase() || 'eth';
  
  // Helper function to decode hex currency codes to readable token names
  const decodeCurrencyCode = (currencyCode: string): string => {
    // If it's a standard 3-character code, return as-is
    if (currencyCode.length <= 3 || !/^[0-9A-F]+$/i.test(currencyCode)) {
      return currencyCode;
    }
    
    // If it's a 40-character hex code, decode it
    if (currencyCode.length === 40) {
      try {
        // Convert hex to ASCII, removing null bytes and whitespace
        const decoded = Buffer.from(currencyCode, 'hex').toString('ascii').replace(/\0/g, '').trim();
        return decoded || currencyCode; // Return decoded name or original hex if decoding fails
      } catch (error) {

        return currencyCode; // Return original if decoding fails
      }
    }
    
    return currencyCode;
  };
  
  // Helper function to calculate USD value
  const calculateUsdValue = (amount: string, symbol: string): string => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return '0.00';
    
    const price = priceData[symbol] || 0;
    const usdValue = numAmount * price;
    
    // Debug logging for price issues (only log once per session to avoid spam)
    if (symbol === 'SOL' && numAmount > 0 && price > 0) {
      console.log(`💰 USD Calculation for ${symbol}: ${numAmount} × ${price} = $${usdValue.toFixed(2)}`);
    }
    
    return usdValue.toFixed(2);
  };
  
  // Helper function to format USD
  const formatUsd = (value: string): string => {
    const num = parseFloat(value);
    if (isNaN(num)) return '$0.00';
    
    // For very small amounts, show more decimal places
    if (num > 0 && num < 0.01) {
      return `$${num.toFixed(4)}`;
    }
    
    return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  
  // Handle password verification for private key and seed phrase viewing
  const handleVerifyPassword = async (isForPrivateKey: boolean) => {
    if (!verificationPassword) {
      toast({
        title: "Missing Information", 
        description: "Please enter your password",
        variant: "destructive"
      });
      return;
    }
    
    if (!session?.handle && !session?.walletData?.handle) {
      toast({
        title: "Session Error",
        description: "Please log in again",
        variant: "destructive"
      });
      setLocation('/wallet-login');
      return;
    }

    try {
      if (isForPrivateKey) {
        // Get the specific private key for this wallet type
        const chainType = walletType.toUpperCase();
        const response = await fetch('/api/riddle-wallet/get-private-key', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            handle: session.walletData?.handle || session.handle || 'demowallet',
            masterPassword: verificationPassword,
            chain: chainType
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json() as any;
        
        if (data.success && data.privateKey) {
          setPrivateKeyData(data.privateKey);
          toast({
            title: "Access Granted",
            description: "Private key retrieved successfully",
          });
        } else {
          toast({
            title: "Access Denied",
            description: data.message || "Invalid password or private key not found",
            variant: "destructive"
          });
          return;
        }
      } else {
        // Get seed phrase
        const response = await fetch('/api/riddle-wallet/get-seed-phrase', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            handle: session.walletData?.handle || session.handle || 'demowallet',
            masterPassword: verificationPassword
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json() as any;
        
        if (data.success && data.seedPhrase) {
          setSeedPhraseData(data.seedPhrase.split(' '));
          toast({
            title: "Access Granted",
            description: "Seed phrase retrieved successfully",
          });
        } else {
          toast({
            title: "Access Denied",
            description: data.message || "Invalid password or seed phrase not found",
            variant: "destructive"
          });
          return;
        }
      }
      
      setVerificationPassword("");
    } catch (error) {
      console.error('Verification error:', error);
      toast({
        title: "Verification Failed",
        description: "An error occurred during verification",
        variant: "destructive"
      });
    }
  };

  // Handle accept all offers - SEQUENTIAL PROCESSING WITH WALLET AUTHENTICATION
  const handleAcceptAll = async () => {
    if (!acceptAllPassword) {
      toast({
        title: "Error",
        description: "Please enter your wallet password",
        variant: "destructive"
      });
      return;
    }

    setIsProcessingOffers(true);
    let successCount = 0;
    let failCount = 0;

    try {
      // Ensure we have a valid session before processing offers
      const sessionCreated = await ensureSession(address);
      if (!sessionCreated) {
        throw new Error('Failed to create session');
      }

      const sessionToken = getSessionToken();
      if (!sessionToken) {
        throw new Error('No valid session token');
      }

      // Process each offer sequentially (one at a time, not parallel)
      for (let i = 0; i < nftOffers.length; i++) {
        const offer = nftOffers[i];
        console.log(`Processing offer ${i + 1}/${nftOffers.length}: ${offer.offer_index}`);
        
        try {
          const response = await fetch(`/api/nft-offers/${offer.offer_index}/accept`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${sessionToken}`
            },
            body: JSON.stringify({
              password: acceptAllPassword,
              offerType: offer.offer_type // Pass the offer type we already know
            })
          });
          
          const result = await response.json() as any;
          console.log(`Response for offer ${offer.offer_index}:`, result);
          if (result.success) {
            successCount++;
            console.log(`✅ Successfully accepted offer ${offer.offer_index}`);
          } else {
            failCount++;
            console.error(`❌ Failed to accept offer ${offer.offer_index}:`, result.error);
            console.error(`Response status: ${response.status}, Full result:`, result);
          }
        } catch (error) {
          failCount++;
          console.error(`💥 Error accepting offer ${offer.offer_index}:`, error);
        }
        
        // Add small delay between requests to prevent overwhelming the XRPL
        if (i < nftOffers.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Show results
      if (successCount > 0) {
        toast({
          title: "Accept All Complete",
          description: `Successfully processed ${successCount}/${nftOffers.length} NFT offers`,
        });
        // Refresh offers
        queryClient.invalidateQueries({ queryKey: [`/api/nft-offers/${address}`] });
      } else {
        toast({
          title: "Accept All Failed",
          description: "Failed to accept any NFT offers. Please check your password.",
          variant: "destructive"
        });
      }

    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process NFT offers",
        variant: "destructive"
      });
    } finally {
      setIsProcessingOffers(false);
      setShowAcceptAllDialog(false);
      setAcceptAllPassword("");
    }
  };

  // Ensure session for NFT operations
  const ensureSession = async (walletAddress: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/ensure-nft-session/${walletAddress}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: walletAddress })
      });
      
      const result = await response.json() as any;
      if (result.success && result.token) {
        sessionStorage.setItem('riddle_session_token', result.token);
        console.log('✅ Session ensured for NFT operations');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to ensure session:', error);
      return false;
    }
  };

  // Handle accepting a single NFT offer
  const handleAcceptOffer = async (offer: any) => {
    const password = prompt('Enter your wallet password to accept this NFT offer:');
    if (!password) return;

    setIsProcessingOffers(true);
    try {
      // Get wallet handle from session - no hardcoded fallback for deployment
      const walletHandle = session?.walletData?.handle || session?.handle;
      if (!walletHandle) {
        toast({
          title: "❌ Authentication Required",
          description: "Please log in to your wallet first",
        });
        setIsProcessingOffers(false);
        return;
      }
      
      // Use the marketplace accept offer endpoint with genuine offer validation
      const response = await fetch('/api/nft/accept-offer', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          offerId: offer.offer_index || offer.id,
          walletHandle: walletHandle,
          password: password
        })
      });
      
      const result = await response.json() as any;
      if (result.success) {
        toast({
          title: "✅ Offer Accepted",
          description: `Successfully accepted ${result.amount || offer.amount} XRP offer for ${offer.nft_name || 'NFT'}`,
        });
        // Refresh NFT offers data
        queryClient.invalidateQueries({ queryKey: [`/api/nft-offers/incoming`, address] });
        console.log(`✅ Genuine offer accepted: ${result.offerId} - ${result.amount} XRP`);
      } else {
        toast({
          title: "❌ Offer Rejected",
          description: result.error || "Failed to accept NFT offer - may not be genuine",
          variant: "destructive"
        });
        console.log(`❌ Offer rejection: ${result.error}`);
      }
    } catch (error) {
      console.error('Accept offer error:', error);
      toast({
        title: "❌ Error",
        description: "Failed to process NFT offer acceptance",
        variant: "destructive"
      });
    } finally {
      setIsProcessingOffers(false);
    }
  };

  // Calculate total portfolio value
  const calculateTotalPortfolioValue = (): string => {
    let total = 0;
    
    // Add native token value
    const nativeValue = parseFloat(calculateUsdValue(balance, config?.symbol || 'ETH'));
    if (!isNaN(nativeValue)) total += nativeValue;
    
    // Add all token values
    tokens.forEach(token => {
      const tokenValue = parseFloat(calculateUsdValue(token.balance, token.symbol));
      if (!isNaN(tokenValue)) total += tokenValue;
    });
    
    return total.toFixed(2);
  };

  useEffect(() => {
    // Clear any stale session tokens first
    localStorage.removeItem('nft_session_token');
    sessionStorage.removeItem('riddle_session_token');
    
    // Check session
    const sessionData = sessionStorage.getItem('riddle_wallet_session');
    if (!sessionData) {
      setLocation('/wallet-login');
      return;
    }

    // Check if config is provided
    if (!config || !config.addressKey) {
      setLocation('/wallet-dashboard');
      return;
    }

    try {
      const parsedSession = JSON.parse(sessionData);
      setSession(parsedSession);
      
      // Set address from session data
      const walletData = parsedSession.walletData || parsedSession;
      if (walletData && walletData[config.addressKey]) {
        setAddress(walletData[config.addressKey]);
      }
    } catch (error) {
      setLocation('/wallet-login');
    }
  }, [config?.addressKey, setLocation]);

  // Fetch price data from server-side API
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        // Use server-side prices API to avoid CORS issues
        const response = await fetch('/api/prices');
        
        if (response.ok) {
          const apiResponse = await response.json() as any;
          console.log('✅ Prices updated:', apiResponse);
          
          // Transform API response to expected format
          if (apiResponse.success && apiResponse.prices) {
            const priceMap: {[key: string]: number} = {};
            apiResponse.prices.forEach((priceItem: any) => {
              priceMap[priceItem.symbol] = priceItem.price_usd;
            });
            // Preserve existing prices when updating
            setPriceData(prev => ({ ...prev, ...priceMap }));
            console.log('💰 Price data transformed:', priceMap);
          } else {
            // Fallback if API structure is unexpected - preserve existing prices
            setPriceData(prev => ({
              ...prev,
              ETH: 0,
              XRP: 0,
              BTC: 0,
              USDC: 1,
              USDT: 1
            }));
          }
        } else {
          // Fallback prices if API fails - preserve existing SOL price
          setPriceData(prev => ({
            ...prev,
            ETH: 0,
            XRP: 0,
            BTC: 0,
            USDC: 1,
            USDT: 1,
            BCHAMP: 0,
            RLUSD: 0,
            ARMY: 0
          }));
        }
      } catch (error) {
        console.error('Error fetching prices:', error);
        // Set fallback prices - preserve existing SOL price
        setPriceData(prev => ({
          ...prev,
          ETH: 0,
          XRP: 0,
          BTC: 0,
          USDC: 1,
          USDT: 1,
          BCHAMP: 0,
          RLUSD: 0,
          ARMY: 0
        }));
      }
    };
    
    fetchPrices();
    // Only refresh prices every 5 minutes instead of 30 seconds to reduce load
    const interval = setInterval(fetchPrices, 300000);
    return () => clearInterval(interval);
  }, []);

  // Fetch XRPL token prices from DexScreener when tokens are loaded
  useEffect(() => {
    const fetchXRPLTokenPrices = async () => {
      if (tokens.length === 0 || config?.symbol !== 'XRP') return;
      
      const updatedPrices = { ...priceData };
      let hasUpdates = false;
      
      for (const token of tokens) {
        try {
          // Skip if we already have a price for this token
          if (updatedPrices[token.symbol] && updatedPrices[token.symbol] > 0) continue;
          
          // Use the raw currency code (hex) for XRPL tokens
          const currencyCode = token.rawCurrency || token.symbol;
          if (!currencyCode) continue;
          
          const searchQuery = encodeURIComponent(currencyCode);
          const dexResponse = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${searchQuery}`);
          
          if (dexResponse.ok) {
            const dexData = await dexResponse.json();
            if (dexData.pairs && dexData.pairs.length > 0) {
              // Find XRPL pair with the matching token
              const xrplPair = dexData.pairs.find((pair: any) => 
                pair.chainId === 'xrpl' && 
                (pair.baseToken.symbol === token.symbol || 
                 pair.baseToken.address.includes(currencyCode))
              );
              
              if (xrplPair && xrplPair.priceUsd) {
                const price = parseFloat(xrplPair.priceUsd);
                updatedPrices[token.symbol] = price;
                hasUpdates = true;
      
              }
            }
          }
        } catch (error) {
          // Continue with other tokens if one fails

        }
      }
      
      // Update price data only if we found new prices
      if (hasUpdates) {
        setPriceData(updatedPrices);

      }
    };

    fetchXRPLTokenPrices();
  }, [tokens, config?.symbol]);

  // NFT loading state and data - NO CACHING, LIVE DATA ONLY
  const [nftsLoading, setNftsLoading] = useState(false);
  const [nftData, setNftData] = useState<any>(null);
  const [offersLoading, setOffersLoading] = useState(false);
  const [nftOffersData, setNftOffersData] = useState<any>(null);

  // Fetch NFTs directly without any caching
  const fetchNFTsLive = async () => {
    if (!address || config?.symbol !== 'XRP') return;
    
    setNftsLoading(true);
    try {
      console.log(`🔍 Fetching LIVE NFTs for address: ${address}`);
      const response = await fetch(`/api/xrpl/nfts/${address}?t=${Date.now()}&live=true`);
      if (!response.ok) throw new Error('Failed to fetch NFTs');
      const data = await response.json() as any;
      console.log(`📊 LIVE NFT API Response:`, data);
      setNftData(data);
    } catch (error) {
      console.error('Error fetching live NFTs:', error);
      setNftData({ nfts: [] });
    } finally {
      setNftsLoading(false);
    }
  };

  // Fetch NFT offers directly without any caching
  const fetchOffersLive = async () => {
    if (!address || config?.symbol !== 'XRP') return;
    
    setOffersLoading(true);
    try {
      console.log(`🔍 Fetching LIVE NFT offers for address: ${address}`);
      const response = await fetch(`/api/nft-offers/${address}?t=${Date.now()}&live=true`);
      if (!response.ok) throw new Error('Failed to fetch offers');
      const data = await response.json() as any;
      console.log(`📊 LIVE OFFERS Response:`, data);
      setNftOffersData(data);
    } catch (error) {
      console.error('Error fetching live offers:', error);
      setNftOffersData({ offers: [] });
    } finally {
      setOffersLoading(false);
    }
  };

  // Fetch ALL token balances - no filtering
  const fetchTokenBalances = async () => {
    if (!address || (config?.symbol !== 'SOL' && config?.symbol !== 'ETH')) return;
    
    try {
      console.log(`🔍 Fetching ALL tokens for ${config.symbol} wallet: ${address}`);
      const response = await fetch(`/api/tokens/balances/${config.symbol}/${address}?t=${Date.now()}`);
      
      if (response.ok) {
        const data = await response.json() as any;
        console.log(`✅ Raw API response for ${config.symbol}:`, data);
        
        if (data.success && data.tokens) {
          // Show ALL tokens exactly as they come from the API
          const allTokens = data.tokens.map((token: any) => ({
            symbol: token.symbol || token.address,
            balance: token.balance || '0',
            currency: token.symbol || token.address,
            rawCurrency: token.address,
            issuer: token.address,
            logoURI: token.logoURI || 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
            price_usd: token.price || 0,
            name: token.name || `Token ${token.address?.substring(0, 8)}...`
          }));
          
          console.log(`📊 Setting ALL ${allTokens.length} tokens (no filtering)`);
          console.log(`🔍 Tokens being set:`, allTokens);
          
          // Force immediate update with ref
          tokensRef.current = allTokens;
          setTokens(allTokens);
          setTokensLoaded(true);
          
          console.log(`🔒 TOKENS FORCED SET:`, tokensRef.current);
        } else {
          console.log(`⚠️ No tokens in response`);
          if (tokensLoaded) {
            // Don't clear tokens if they were already loaded
            console.log(`🔒 Keeping existing tokens to prevent flashing`);
          } else {
            setTokens([]);
            setTokensLoaded(true);
          }
        }
      } else {
        console.log(`❌ Failed to fetch tokens - status: ${response.status}`);
        if (tokensLoaded) {
          console.log(`🔒 Keeping existing tokens despite fetch error`);
        } else {
          setTokens([]);
        }
      }
    } catch (error) {
      console.error(`❌ Error fetching ${config.symbol} tokens:`, error);
      if (tokensLoaded) {
        console.log(`🔒 Keeping existing tokens despite error`);
      } else {
        setTokens([]);
      }
    }
  };

  // Fetch live data when address changes - ALWAYS FETCH FRESH
  useEffect(() => {
    if (address && config?.symbol === 'XRP') {
      fetchNFTsLive();
      fetchOffersLive();
    } else if (address && (config?.symbol === 'SOL' || config?.symbol === 'ETH')) {
      // Always fetch fresh tokens
      console.log(`🔄 Fetching fresh tokens for ${config.symbol} wallet`);
      fetchTokenBalances();
    }
  }, [address, config?.symbol]);

  // Update NFTs when data changes - NO FILTERING, SHOW ALL REAL DATA
  useEffect(() => {
    if (config?.symbol === 'XRP' && nftData) {
      console.log(`🔍 Processing NFT data:`, nftData);
      
      if (nftData.nfts && Array.isArray(nftData.nfts)) {
        // Handle XRPL API response format - show ALL real NFTs
        const processedNfts = nftData.nfts.map((nft: any) => ({
          nft_id: nft.nft_id,
          name: nft.metadata?.name || nft.name || `NFT #${nft.sequence || 'Unknown'}`,
          description: nft.metadata?.description || nft.description,
          image: nft.metadata?.image || nft.image,
          metadata: nft.metadata,
          owner: nft.owner,
          minter: nft.minter,
          uri: nft.uri,
          taxon: nft.taxon,
          sequence: nft.sequence
        }));

        console.log(`✅ Displaying ${processedNfts.length} authentic NFTs from XRPL blockchain:`, processedNfts.map((n: any) => n.name));
        setNfts(processedNfts);
      } else {
        // No NFTs found - set empty array
        console.log('❌ No NFTs found in API response - setting empty array');
        setNfts([]);
      }
    }
  }, [nftData, config?.symbol]);

  // Update NFT offers when data changes and fetch images
  useEffect(() => {
    if (config?.symbol === 'XRP') {
      if (nftOffersData?.offers) {
        
        // Fetch NFT images for each offer
        const fetchOfferImages = async () => {
          const offersWithImages = await Promise.all(
            nftOffersData.offers.map(async (offer: any) => {
              try {
                if (offer.nft_id) {
                  const response = await fetch(`/api/bithomp/nft/${offer.nft_id}/image`);
                  if (response.ok) {
                    const imageData = await response.json() as any;
                    return {
                      ...offer,
                      nft_image: imageData.image,
                      nft_name: imageData.name,
                      nft_description: imageData.description
                    };
                  }
                }
                return offer;
              } catch (error) {

                return offer;
              }
            })
          );
          setNftOffers(offersWithImages);
        };
        
        fetchOfferImages();
      } else if (nftOffersData && !nftOffersData.offers) {
        console.log('NFT offers data exists but no offers array');
        setNftOffers([]);
      }
    }
  }, [nftOffersData, config?.symbol]);
  
  useEffect(() => {
    // Fetch balance and tokens for the address using new chain-specific systems
    const fetchWalletData = async () => {
      if (!address) return;
      
      try {
        const chainSymbol = config?.symbol?.toUpperCase() || '';
        
        if (chainSymbol === 'XRP') {
          // Use new XRP balance system with V2 API
          const balanceData = await getXRPBalanceData(address);
          setBalance(balanceData.balance || "0.0");
          setSelectedAsset({
            type: 'native',
            symbol: 'XRP',
            balance: balanceData.balance || "0.0"
          });
          
          // Update price data with fresh XRP price from balance data
          if (balanceData.balanceUSD > 0 && parseFloat(balanceData.balance) > 0) {
            const xrpPrice = balanceData.balanceUSD / parseFloat(balanceData.balance);
            setPriceData(prev => ({ ...prev, XRP: xrpPrice }));
          }
          
          // Use new XRP token system
          const xrpTokens = await getChainTokens('XRP', address);
          // Filter out native XRP and zero balances from tokens list
          const filteredTokens = xrpTokens.filter(t => 
            t.symbol !== 'XRP' && 
            t.balance && parseFloat(t.balance) > 0 &&
            !isNaN(parseFloat(t.balance))
          );
          setTokens(filteredTokens);
          
          // Fetch NFTs for XRP separately
          try {
            const nftResponse = await fetch(`/api/xrpl/nfts/${address}`);
            if (nftResponse.ok) {
              const nftData = await nftResponse.json();
              if (nftData.nfts) {
                setNfts(nftData.nfts);
              }
            }
          } catch (nftError) {
            console.error('Error fetching XRP NFTs:', nftError);
          }
          
        } else if (chainSymbol === 'ETH') {
          // Use new ETH balance system
          const balanceData = await getETHBalanceData(address);
          setBalance(balanceData.balance || "0.0");
          setSelectedAsset({
            type: 'native',
            symbol: 'ETH',
            balance: balanceData.balance || "0.0"
          });
          
          // Update price data with fresh ETH price from balance data
          if (balanceData.balanceUSD > 0 && parseFloat(balanceData.balance) > 0) {
            const ethPrice = balanceData.balanceUSD / parseFloat(balanceData.balance);
            setPriceData(prev => ({ ...prev, ETH: ethPrice }));
          }
          
          // Use new ETH token system
          const ethTokens = await getChainTokens('ETH', address);
          // Filter out native ETH and zero balances from tokens list
          const filteredTokens = ethTokens.filter(t => 
            t.symbol !== 'ETH' && 
            t.balance && parseFloat(t.balance) > 0 &&
            !isNaN(parseFloat(t.balance))
          );
          setTokens(filteredTokens);
          
        } else if (chainSymbol === 'SOL') {
          // Use new SOL balance system
          const balanceData = await getSOLBalanceData(address);
          setBalance(balanceData.balance || "0.0");
          setSelectedAsset({
            type: 'native',
            symbol: 'SOL',
            balance: balanceData.balance || "0.0"
          });
          
          // Update price data with fresh SOL price from balance data
          if (balanceData.balanceUSD > 0 && parseFloat(balanceData.balance) > 0) {
            const solPrice = balanceData.balanceUSD / parseFloat(balanceData.balance);
            console.log(`💰 Setting SOL price: ${solPrice} (balance: ${balanceData.balance}, USD: ${balanceData.balanceUSD})`);
            setPriceData(prev => ({ ...prev, SOL: solPrice }));
          }
          
          // Use new SOL token system
          const solTokens = await getChainTokens('SOL', address);
          // Filter out native SOL and zero balances from tokens list
          const filteredTokens = solTokens.filter(t => 
            t.symbol !== 'SOL' && 
            t.balance && parseFloat(t.balance) > 0 &&
            !isNaN(parseFloat(t.balance))
          );
          setTokens(filteredTokens);
          
        } else if (chainSymbol === 'BTC') {
          // Use new BTC balance system
          const balanceData = await getBTCBalanceData(address);
          setBalance(balanceData.balance || "0.0");
          setSelectedAsset({
            type: 'native',
            symbol: 'BTC',
            balance: balanceData.balance || "0.0"
          });
          
          // Update price data with fresh BTC price from balance data
          if (balanceData.balanceUSD > 0 && parseFloat(balanceData.balance) > 0) {
            const btcPrice = balanceData.balanceUSD / parseFloat(balanceData.balance);
            setPriceData(prev => ({ ...prev, BTC: btcPrice }));
          }
          
          // BTC has no tokens, just set empty array
          setTokens([]);
        }
      } catch (error) {

        setBalance("0.0");
      }
    };

    fetchWalletData();
  }, [address, config?.symbol]);

  const copyAddress = () => {
    if (!address) {
      toast({
        title: "No Address",
        description: "Address not available",
        variant: "destructive"
      });
      return;
    }
    
    navigator.clipboard.writeText(address);
    toast({
      title: "Copied!",
      description: `${config?.symbol} address copied to clipboard`,
    });
  };

  const handleReceive = () => {
    if (!address) {
      toast({
        title: "No Address",
        description: "Wallet address not available",
        variant: "destructive"
      });
      return;
    }
    setShowQR(true);
  };

  const handleSend = async () => {
    if (!sendTo || !sendAmount) {
      toast({
        title: "Invalid Input",
        description: "Please enter recipient and amount",
        variant: "destructive"
      });
      return;
    }

    try {
      // Validate address format based on chain
      const addressRegex = {
        ETH: /^0x[a-fA-F0-9]{40}$/,
        XRP: /^r[a-zA-Z0-9]{24,34}$/,
        SOL: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
        BTC: /^(1|3|bc1)[a-zA-Z0-9]{25,62}$/
      };

      if (config?.symbol && addressRegex[config.symbol as keyof typeof addressRegex]?.test(sendTo) === false) {
        toast({
          title: "Invalid Address",
          description: `Please enter a valid ${config.symbol} address`,
          variant: "destructive"
        });
        return;
      }

      // Validate amount
      const amount = parseFloat(sendAmount);
      if (isNaN(amount) || amount <= 0) {
        toast({
          title: "Invalid Amount",
          description: "Please enter a valid amount greater than 0",
          variant: "destructive"
        });
        return;
      }

      // Check if amount exceeds balance
      const currentBalance = parseFloat(selectedAsset.balance);
      if (amount > currentBalance) {
        toast({
          title: "Insufficient Balance",
          description: `You only have ${selectedAsset.balance} ${selectedAsset.symbol}`,
          variant: "destructive"
        });
        return;
      }

      // Show transaction prepared message
      const assetInfo = selectedAsset.type === 'native' 
        ? `${sendAmount} ${selectedAsset.symbol}` 
        : `${sendAmount} ${selectedAsset.symbol} (Token)`;
      
      toast({
        title: "Transaction Prepared",
        description: `Ready to send ${assetInfo} to ${sendTo.slice(0, 8)}...${sendTo.slice(-6)}${destinationTag ? ` (Tag: ${destinationTag})` : ''}`,
      });
      
      // In a real implementation, this would:
      // 1. Connect to the blockchain network
      // 2. For tokens: Call the token contract's transfer method
      // 3. For native: Send native currency
      // 4. Sign the transaction with the user's private key  
      // 5. Broadcast the transaction
      // 6. Return transaction hash for monitoring
      
      setShowSend(false);
      setSendTo("");
      setSendAmount("");
      setDestinationTag("");
      // Reset to native asset after sending
      setSelectedAsset({
        type: 'native',
        symbol: config?.symbol || 'ETH',
        balance: balance
      });
    } catch (error) {

      toast({
        title: "Transaction Failed",
        description: "Failed to prepare transaction. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleBackToDashboard = () => {
    setLocation('/wallet-dashboard');
  };

  // External wallet connection handler
  const handleWalletConnect = async (walletType: string) => {
    toast({
      title: "Connecting Wallet",
      description: `Initiating connection to ${walletType}...`,
    });

    try {
      switch (walletType) {
        case 'xaman':
          await initializeXamanConnection();
          break;
        case 'joey':
          await initializeJoeyWalletConnect();
          break;
        case 'walletconnect':
          await initializeWalletConnect();
          break;
      }
    } catch (error) {
      console.error(`Failed to connect to ${walletType}:`, error);
      toast({
        title: "Connection Failed",
        description: `Failed to connect to ${walletType}. Please try again.`,
        variant: "destructive"
      });
    }
  };

  // Xaman Wallet connection using QR modal
  const initializeXamanConnection = async () => {
    setShowXamanQR(true);
  };

  // Joey Wallet connection via WalletConnect
  const initializeJoeyWalletConnect = async () => {
    try {
      toast({
        title: "Joey Wallet",
        description: "Opening Joey Wallet connection...",
      });
      
      const connection = await connectJoeyWallet();
      
      if (connection && connection.isConnected) {
        toast({
          title: "Joey Wallet Connected!",
          description: `Connected to ${connection.address.substring(0, 10)}...`,
        });
        
        console.log('✅ Joey Wallet connected:', connection.address);
      } else {
        throw new Error('Failed to establish connection');
      }
    } catch (error) {
      console.error('❌ Joey Wallet connection failed:', error);
      toast({
        title: "Joey Wallet Connection Failed",
        description: "Please ensure Joey Wallet app is installed and try again.",
        variant: "destructive"
      });
    }
  };

  // Standard WalletConnect integration
  const initializeWalletConnect = async () => {
    try {
      toast({
        title: "WalletConnect",
        description: "Opening WalletConnect dialog...",
      });
      
      // For production, implement proper WalletConnect v2 integration
      console.log('🔗 Initiating WalletConnect connection');
      
      // Simulate connection for now
      setTimeout(() => {
        toast({
          title: "WalletConnect Ready",
          description: "WalletConnect session initiated!",
        });
      }, 2000);
    } catch (error) {
      console.error('❌ WalletConnect failed:', error);
      toast({
        title: "WalletConnect Failed",
        description: "Failed to initialize WalletConnect. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Trustline removal function for XRPL
  const handleRemoveTrustline = async (token: any) => {
    const password = prompt(`Remove trustline for ${token.symbol}? This will delete the token from your wallet if you have a zero balance.\n\nEnter your wallet password:`);
    if (!password) return;

    const tokenKey = `${token.rawCurrency || token.address || token.issuer}`;
    setRemovingTrustline(tokenKey);

    try {
      const sessionToken = getSessionToken();
      if (!sessionToken) {
        throw new Error('No session token available');
      }

      const response = await fetch('/api/xrpl/remove-trustline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          password: password,
          tokenSymbol: token.symbol,
          issuer: token.issuer,
          walletAddress: address
        })
      });

      const result = await response.json() as any;
      
      if (result.success) {
        toast({
          title: "Trustline Removed",
          description: `Successfully removed trustline for ${token.symbol}`,
        });
        
        // Refresh tokens
        queryClient.invalidateQueries({ queryKey: [`/api/xrpl/tokens/${address}`] });
        
        // Remove from local state
        setTokens(prev => prev.filter(t => 
          (t.rawCurrency || t.issuer) !== (token.rawCurrency || token.issuer)
        ));
      } else {
        toast({
          title: "Failed to Remove Trustline",
          description: result.error || "Could not remove trustline. Check your balance is zero.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Trustline removal error:', error);
      toast({
        title: "Error",
        description: "Failed to remove trustline. Please try again.",
        variant: "destructive"
      });
    } finally {
      setRemovingTrustline(null);
    }
  };

  return (
    <div className="wallet-page min-h-screen">
      <div className="wallet-container max-w-6xl mx-auto p-4">
        {/* Professional Header */}
        <div className="mb-6 p-6 bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <img 
                src="/attached_assets/image_1755783298420.png" 
                alt="RDL Official Logo" 
                className="w-8 h-8 object-contain"
              />
              <span className="text-lg font-semibold text-slate-900">Riddle Wallet</span>
              
              {/* External Wallet Connection Dropdown */}
              {config?.symbol === 'XRP' && (
                <div className="relative ml-4">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-3 text-xs border-blue-200 hover:bg-blue-50 text-blue-700"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Connect Wallet
                        <ChevronDown className="w-3 h-3 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48">
                      <DropdownMenuItem 
                        onClick={() => handleWalletConnect('xaman')}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <div className="w-5 h-5 rounded bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
                          X
                        </div>
                        <div>
                          <div className="font-medium">Xaman Wallet</div>
                          <div className="text-xs text-muted-foreground">XRPL Mobile Wallet</div>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleWalletConnect('joey')}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <div className="w-5 h-5 rounded bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                          J
                        </div>
                        <div>
                          <div className="font-medium">Joey Wallet</div>
                          <div className="text-xs text-muted-foreground">Self-Custodial XRPL</div>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleWalletConnect('walletconnect')}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <div className="w-5 h-5 rounded bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                          W
                        </div>
                        <div>
                          <div className="font-medium">WalletConnect</div>
                          <div className="text-xs text-muted-foreground">Universal Protocol</div>
                        </div>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBackToDashboard}
              className="h-9 px-4 text-sm border-slate-200 hover:bg-slate-50 text-slate-700"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                {config?.icon || <span className="text-white font-bold text-sm">{config?.symbol?.substring(0, 2)}</span>}
              </div>
              <div>
                <div className="text-lg font-semibold text-slate-900">{config?.symbol} Wallet</div>
                <div className="text-sm text-slate-500">{config?.name} Network</div>
              </div>
            </div>
            <div className="ml-auto text-right">
              <div className="text-sm text-slate-500">Account</div>
              <div className="text-sm font-medium text-slate-700">@{session?.handle || 'loading...'}</div>
            </div>
          </div>
        </div>

        {/* Main Grid Layout - 2x2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Balance & Portfolio Card */}
          <Card className="bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-4 bg-gradient-to-r from-slate-50 to-slate-100">
              <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
                <DollarSign className="w-5 h-5 text-blue-600" />
                Portfolio Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="text-center mb-6">
                <div className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">Total Portfolio Value</div>
                <div className="text-3xl font-bold text-slate-900 mb-2">
                  {formatUsd(calculateTotalPortfolioValue())}
                </div>
                <div className="bg-slate-50 rounded-lg p-4 mt-4">
                  <div className="text-xl font-semibold text-slate-800">{balance} {config?.symbol}</div>
                  <div className="text-sm text-slate-600 mt-1">
                    ≈ {formatUsd(calculateUsdValue(balance, config?.symbol || 'ETH'))}
                  </div>
                  {config?.symbol === 'XRP' && (
                    <div className="mt-3 pt-3 border-t border-slate-200 text-xs text-slate-600 space-y-1">
                      <div className="flex justify-between">
                        <span>Reserve Required:</span>
                        <span className="font-medium">{reserveAmount} XRP</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Available:</span>
                        <span className="font-semibold text-blue-600">
                          {Math.max(0, parseFloat(balance || '0') - parseFloat(reserveAmount)).toFixed(6)} XRP
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tokens & NFTs Tabs */}
          <Card className="bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow lg:col-span-2">
            <CardHeader className="pb-4 bg-gradient-to-r from-slate-50 to-slate-100">
              <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
                <Coins className="w-5 h-5 text-blue-600" />
                Your Assets
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="inline-flex h-12 items-center justify-center rounded-lg bg-slate-100 p-1.5 text-slate-600 w-full">
                  <TabsTrigger 
                    value="tokens" 
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm flex-1"
                  >
                    Tokens ({tokens.length})
                  </TabsTrigger>
                  <TabsTrigger 
                    value="nfts"
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm flex-1"
                  >
                    NFTs ({nfts.length})
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="tokens" className="mt-6">
                  <div className="space-y-3 max-h-80 overflow-y-auto mobile-token-list pr-2 responsive-grid">
                    {/* Native Token */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors mobile-token-item shadow-sm">
                      <div className="flex items-center gap-3 min-w-0 flex-1 w-full sm:w-auto">
                        <TokenLogo 
                          symbol={config?.symbol || 'ETH'} 
                          size="lg"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-sm text-slate-900 truncate">{config?.symbol}</div>
                          <div className="text-xs text-slate-500">Native Token</div>
                        </div>
                      </div>
                      <div className="text-left sm:text-right mt-2 sm:mt-0 ml-0 sm:ml-2 flex-shrink-0 w-full sm:w-auto">
                        <div className="font-semibold text-sm text-slate-900">{balance}</div>
                        <div className="text-xs text-slate-500">
                          ≈ {formatUsd(calculateUsdValue(balance, config?.symbol || 'ETH'))}
                        </div>
                        {config?.symbol === 'XRP' && (
                          <div className="text-xs text-blue-600 mt-1 font-medium">
                            Available: {Math.max(0, parseFloat(balance || '0') - parseFloat(reserveAmount)).toFixed(4)} XRP
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Other Tokens - Show ALL tokens with DEBUG */}
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground px-2">
                        Tokens: {tokens.length} | Ref: {tokensRef.current.length} | Loaded: {tokensLoaded ? 'Yes' : 'No'}
                      </div>
                      {(tokens.length > 0 || tokensRef.current.length > 0) ? (
                        (tokens.length > 0 ? tokens : tokensRef.current).map((token, index) => {
                          // Use full address as key
                          const tokenKey = `${token.rawCurrency || token.address || token.issuer || index}`;
                          
                          // For SOL tokens, show a shortened symbol if it's the full address
                          let displaySymbol = token.symbol || 'Unknown';
                          if (displaySymbol.length > 20) {
                            displaySymbol = 'SRDL'; // This is the RIDDLE token
                          }
                          
                          const tokenBalance = parseFloat(token.balance || '0');
                          
                          // Debug log each token render
                          console.log(`🎯 Rendering token ${index}:`, {
                            symbol: displaySymbol,
                            balance: tokenBalance,
                            address: token.rawCurrency || token.address,
                            key: tokenKey
                          });
                          
                          return (
                            <div key={tokenKey} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors mobile-token-item group shadow-sm">
                              <div className="flex items-center gap-3 min-w-0 flex-1 w-full sm:w-auto">
                                <TokenLogo 
                                  symbol={displaySymbol} 
                                  size="lg"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold text-sm text-slate-900">{displaySymbol}</div>
                                  <div className="text-xs text-slate-500">
                                    RDL Token - {config?.symbol === 'SOL' ? 'SPL' : config?.symbol === 'ETH' ? 'ERC-20' : 'Token'}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 mt-2 sm:mt-0 w-full sm:w-auto justify-between sm:justify-end">
                                <div className="text-left sm:text-right flex-shrink-0">
                                  <div className="font-semibold text-sm text-slate-900">
                                    {tokenBalance.toLocaleString('en-US', {
                                      minimumFractionDigits: 0,
                                      maximumFractionDigits: tokenBalance > 1000 ? 0 : 4
                                    })}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    ≈ ${(tokenBalance * 0.00001).toFixed(2)} USD
                                  </div>
                                </div>
                                {/* Trustline removal for XRPL tokens */}
                                {config?.symbol === 'XRP' && token.issuer && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleRemoveTrustline(token)}
                                    disabled={removingTrustline === tokenKey}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 p-0 border-red-200 hover:border-red-300 hover:bg-red-50 text-red-600"
                                    title="Remove Trustline"
                                  >
                                    {removingTrustline === tokenKey ? (
                                      <div className="animate-spin rounded-full h-3 w-3 border border-red-400 border-t-transparent"></div>
                                    ) : (
                                      "×"
                                    )}
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center py-4 text-sm">
                          {tokensLoaded ? (
                            <div className="text-red-500 font-bold">NO TOKENS FOUND (State: {tokens.length}, Ref: {tokensRef.current.length})</div>
                          ) : (
                            <div className="text-blue-500 font-bold animate-pulse">LOADING TOKENS...</div>
                          )}
                        </div>
                      )}
                    </div>
                    {tokens.length === 0 && tokensLoaded && (
                      <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-lg">
                        <Coins className="w-8 h-8 mx-auto mb-3 text-slate-400" />
                        <div className="font-medium">No tokens found</div>
                        <div className="text-xs mt-2 text-slate-400">
                          {config?.symbol === 'SOL' ? 'SPL tokens will appear here' : config?.symbol === 'ETH' ? 'ERC-20 tokens will appear here' : 'Tokens will appear here'}
                        </div>
                      </div>
                    )}
                    {!tokensLoaded && (
                      <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-lg">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-200 border-t-blue-600 mx-auto mb-3"></div>
                        <div className="font-medium">Loading tokens...</div>
                        <div className="text-xs mt-2 text-slate-400">Please wait while we fetch your assets</div>
                      </div>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="nfts" className="mt-3">
                  {config?.symbol === 'XRP' ? (
                    <div className="space-y-4">
                      {nftsLoading ? (
                        <div className="flex justify-center py-8">
                          <div className="text-center">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>
                            <div className="text-xs text-muted-foreground">Loading NFTs...</div>
                          </div>
                        </div>
                      ) : nfts && nfts.length > 0 ? (
                        <div className="space-y-3">
                          <div className="text-sm font-medium text-foreground mb-2">
                            Showing {nfts.length} NFTs
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-80 overflow-y-auto">
                            {nfts.slice(0, 50).map((nft, index) => (
                              <div 
                                key={nft.NFTokenID || nft.nftokenID || nft.nft_id || index} 
                                className="border rounded-lg overflow-hidden hover:shadow-md transition-all cursor-pointer bg-card"
                                onClick={() => setLocation(`/nft/${nft.NFTokenID || nft.nftokenID || nft.nft_id}`)}
                              >
                                <div className="aspect-square bg-muted flex items-center justify-center">
                                  {nft.image ? (
                                    <img 
                                      src={nft.image}
                                      alt={nft.name || nft.metadata?.name || 'NFT'}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        console.log('Image failed to load:', nft.image);
                                        const target = e.currentTarget as HTMLImageElement;
                                        target.style.display = 'none';
                                        target.nextElementSibling?.classList.remove('hidden');
                                      }}
                                    />
                                  ) : (
                                    <div className="text-gray-400 text-center p-2">
                                      <Image className="h-8 w-8 mx-auto mb-1" />
                                      <div className="text-xs">No Image</div>
                                    </div>
                                  )}
                                  <div className="text-gray-400 text-center p-2 hidden">
                                    <Image className="h-8 w-8 mx-auto mb-1" />
                                    <div className="text-xs">No Image</div>
                                  </div>
                                </div>
                                <div className="p-2">
                                  <div className="text-xs font-medium truncate">
                                    {nft.name || nft.metadata?.name || `NFT #${(nft.NFTokenID || nft.nftokenID || nft.nft_id || '').slice(-6)}`}
                                  </div>
                                  <div className="text-xs text-muted-foreground truncate">
                                    {nft.collection?.name || (nft.Issuer ? `${nft.Issuer.slice(0, 8)}...` : 'Collection')}
                                  </div>
                                  {nft.traits && nft.traits.length > 0 && (
                                    <div className="text-xs text-blue-400">
                                      {nft.traits.length} traits
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <Image className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                          <h5 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">No NFTs Found</h5>
                          <p className="text-xs text-gray-500">This wallet doesn't currently own any NFTs</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      NFTs not supported for this chain
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Address & Actions Card */}
          <Card className="card-enhanced">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Copy className="w-4 h-4" />
                Address & Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="flex items-center gap-2 p-2 bg-muted rounded text-sm font-mono">
                  <span className="truncate flex-1">
                    {address || 'Loading...'}
                  </span>
                  <Button size="sm" variant="ghost" onClick={copyAddress}>
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  onClick={() => setShowSend(!showSend)}
                  className="btn-primary-enhanced"
                >
                  <Send className="w-4 h-4 mr-1" />
                  Send
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleReceive}
                >
                  <Download className="w-4 h-4 mr-1" />
                  Receive
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleReceive}
                >
                  <QrCode className="w-4 h-4 mr-1" />
                  QR Code
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(`${config?.explorerUrl}${address}`, '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-1" />
                  Explorer
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Chain-Specific NFT Manager for all chains */}
          {address && (
            <ChainNFTManager 
              chain={config?.symbol?.toLowerCase() as 'xrp' | 'eth' | 'sol' | 'btc'} 
              walletAddress={address} 
            />
          )}

          {/* NFT Offers Manager for XRP - Accept genuine offers */}
          {config?.symbol === 'XRP' && address && (
            <Card className="card-enhanced">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Gift className="w-4 h-4" />
                  NFT Offers {nftOffers.length > 0 && `(${nftOffers.length})`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {offersLoading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
                    <div className="text-xs text-muted-foreground">Loading offers...</div>
                  </div>
                ) : nftOffers.length > 0 ? (
                  <div className="space-y-2">
                    {nftOffers.map((offer, index) => (
                      <div key={index} className="p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium text-sm">
                            {offer.nft_name || `NFT #${offer.nft_id?.slice(0, 8)}`}
                          </div>
                          <div className="text-sm font-medium text-blue-600">
                            {offer.amount === "0" ? 'Free' : `${offer.amount} ${offer.currency || 'XRP'}`}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground mb-2">
                          From: {offer.from_address?.slice(0, 10)}...{offer.from_address?.slice(-6)}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleAcceptOffer(offer)}
                          disabled={isProcessingOffers}
                          className="w-full"
                        >
                          Accept Offer
                        </Button>
                      </div>
                    ))}
                    {nftOffers.length > 1 && (
                      <Button
                        onClick={() => setShowAcceptAllDialog(true)}
                        disabled={isProcessingOffers}
                        className="w-full mt-2"
                      >
                        Accept All Offers
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <Gift className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No pending NFT offers</p>
                    <p className="text-xs text-muted-foreground mt-1">NFT offers will appear here when received</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Transaction History Card */}
          <TransactionHistory 
            address={address} 
            chainType={config?.symbol?.toLowerCase() as 'xrp' | 'eth' | 'btc' | 'sol'} 
            explorerUrl={config?.explorerUrl + 'tx/'}
          />

          {/* Security Card */}
          <Card className="card-enhanced">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Security
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Access your keys with your master password
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowPrivateKeyDialog(true)}
                >
                  <Key className="w-4 h-4 mr-1" />
                  Private Key
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowSeedPhraseDialog(true)}
                >
                  <FileText className="w-4 h-4 mr-1" />
                  Seed Phrase
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Send Form Card - Shows when Send is clicked */}
          {showSend && (
            <Card className="card-enhanced lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Send Assets</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Select Asset</Label>
                    <Select
                      value={`${selectedAsset.type}:${selectedAsset.symbol}:${selectedAsset.contractAddress || 'native'}`}
                      onValueChange={(value) => {
                        const [type, symbol, contractAddress] = value.split(':');
                        if (type === 'native') {
                          setSelectedAsset({
                            type: 'native',
                            symbol: config?.symbol || 'ETH',
                            balance: balance
                          });
                        } else {
                          const token = tokens.find(t => t.symbol === symbol && (t.issuer || t.contractAddress) === contractAddress);
                          if (token) {
                            setSelectedAsset({
                              type: 'token',
                              symbol: token.symbol,
                              balance: token.balance,
                              contractAddress: token.issuer || token.contractAddress
                            });
                          }
                        }
                      }}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Select asset to send" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={`native:${config?.symbol}:native`}>
                          {config?.symbol} - {balance} (Native)
                        </SelectItem>
                        {tokens.map((token, index) => (
                          <SelectItem key={index} value={`token:${token.symbol}:${token.issuer || token.contractAddress || index}`}>
                            {token.symbol} - {parseFloat(token.balance).toFixed(4)} ({token.name || 'Token'})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Recipient</Label>
                    <Input
                      placeholder={config?.placeholder}
                      value={sendTo}
                      onChange={(e) => setSendTo(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Amount</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={sendAmount}
                        onChange={(e) => setSendAmount(e.target.value)}
                        className="h-8"
                      />
                      <Button variant="outline" onClick={() => setSendAmount(selectedAsset.balance)} className="h-8 px-3 text-xs">
                        Max
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Available: {parseFloat(selectedAsset.balance).toFixed(6)} {selectedAsset.symbol} 
                      (≈ {formatUsd(calculateUsdValue(selectedAsset.balance, selectedAsset.symbol))})
                    </div>
                    {sendAmount && parseFloat(sendAmount) > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Amount to send: ≈ {formatUsd(calculateUsdValue(sendAmount, selectedAsset.symbol))} USD
                      </div>
                    )}
                  </div>
                  {config?.hasDestinationTag && selectedAsset.type === 'native' && (
                    <div>
                      <Label className="text-xs">Tag (Optional)</Label>
                      <Input
                        placeholder="Destination tag"
                        value={destinationTag}
                        onChange={(e) => setDestinationTag(e.target.value)}
                        className="h-8"
                      />
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button onClick={handleSend} className="flex-1 h-8 text-xs">
                      Send {selectedAsset.symbol}
                    </Button>
                    <Button variant="outline" onClick={() => setShowSend(false)} className="h-8 px-4 text-xs">
                      Cancel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* QR Code Dialog */}
        <Dialog open={showQR} onOpenChange={setShowQR}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Receive {config?.symbol}</DialogTitle>
              <DialogDescription>
                Scan this QR code or copy the address below
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center space-y-4">
              {address && (
                <div className="p-4 bg-white rounded-lg">
                  <QRCodeSVG 
                    value={address} 
                    size={200}
                    level="M"
                    includeMargin
                  />
                </div>
              )}
              <div className="w-full">
                <Input value={address} readOnly className="text-center text-xs font-mono" />
              </div>
              <Button onClick={copyAddress} className="w-full">
                <Copy className="w-4 h-4 mr-2" />
                Copy Address
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Private Key Dialog */}
        <Dialog open={showPrivateKeyDialog} onOpenChange={setShowPrivateKeyDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                View Private Key
              </DialogTitle>
              <DialogDescription>
                Access your {config?.symbol} private key with your master password.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {!privateKeyData ? (
                <>
                  <div className="text-sm text-muted-foreground">
                    Enter your master password to access your {config?.symbol} private key.
                  </div>
                  <div>
                    <Label htmlFor="privateKeyPassword">Master Password</Label>
                    <Input
                      id="privateKeyPassword"
                      type="password"
                      value={verificationPassword}
                      onChange={(e) => setVerificationPassword(e.target.value)}
                      placeholder="Enter your password"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleVerifyPassword(true)}
                      className="flex-1"
                    >
                      Verify & Show Key
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowPrivateKeyDialog(false);
                        setVerificationPassword("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-sm text-muted-foreground">
                    Your {config?.symbol} private key:
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        value={privateKeyData}
                        type={showPrivateKey ? "text" : "password"}
                        readOnly
                        className="font-mono text-sm"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowPrivateKey(!showPrivateKey)}
                      >
                        {showPrivateKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(privateKeyData);
                          toast({
                            title: "Copied",
                            description: "Private key copied to clipboard",
                          });
                        }}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-xs text-red-500 bg-red-50 p-2 rounded">
                    ⚠️ Never share your private key with anyone. Anyone with access to this key can control your wallet.
                  </div>
                  <Button
                    onClick={() => {
                      setShowPrivateKeyDialog(false);
                      setPrivateKeyData(null);
                      setShowPrivateKey(false);
                    }}
                    className="w-full"
                  >
                    Close
                  </Button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Seed Phrase Dialog */}
        <Dialog open={showSeedPhraseDialog} onOpenChange={setShowSeedPhraseDialog}>
          <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Recovery Seed Phrase
              </DialogTitle>
              <DialogDescription>
                Access your 12-word recovery phrase with your master password.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {!seedPhraseData ? (
                <>
                  <div className="text-sm text-muted-foreground">
                    Enter your master password to access your 12-word recovery phrase.
                  </div>
                  <div>
                    <Label htmlFor="seedPhrasePassword">Master Password</Label>
                    <Input
                      id="seedPhrasePassword"
                      type="password"
                      value={verificationPassword}
                      onChange={(e) => setVerificationPassword(e.target.value)}
                      placeholder="Enter your password"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleVerifyPassword(false)}
                      className="flex-1"
                    >
                      Verify & Show Phrase
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowSeedPhraseDialog(false);
                        setVerificationPassword("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-sm text-muted-foreground">
                    Your 12-word recovery phrase:
                  </div>
                  <div className="grid grid-cols-3 gap-2 p-4 bg-muted rounded-lg">
                    {seedPhraseData.map((word, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <span className="text-xs text-muted-foreground w-6">{index + 1}.</span>
                        <span className={`font-mono text-sm px-2 py-1 rounded ${showSeedPhrase ? 'bg-background' : 'bg-gray-300 text-gray-300 select-none'}`}>
                          {showSeedPhrase ? word : '••••••'}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowSeedPhrase(!showSeedPhrase)}
                      className="flex-1"
                    >
                      {showSeedPhrase ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                      {showSeedPhrase ? 'Hide' : 'Show'} Words
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (seedPhraseData) {
                          navigator.clipboard.writeText(seedPhraseData.join(' '));
                          toast({
                            title: "Copied",
                            description: "Seed phrase copied to clipboard",
                          });
                        }
                      }}
                      className="flex-1"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy Phrase
                    </Button>
                  </div>
                  <div className="text-xs text-red-500 bg-red-50 p-2 rounded">
                    ⚠️ Store these words safely. They can recover all your wallets. Never share them with anyone.
                  </div>
                  <Button
                    onClick={() => {
                      setShowSeedPhraseDialog(false);
                      setSeedPhraseData(null);
                      setShowSeedPhrase(false);
                    }}
                    className="w-full"
                  >
                    Close
                  </Button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Accept All NFT Offers Dialog */}
        {showAcceptAllDialog && (
          <Dialog open={showAcceptAllDialog} onOpenChange={setShowAcceptAllDialog}>
            <DialogContent className="dialog-enhanced fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 max-w-md w-full mx-4 z-50">
              <DialogHeader>
                <DialogTitle className="text-center">Accept All NFT Offers</DialogTitle>
                <DialogDescription className="text-center">
                  Enter your wallet password to accept all {nftOffers.length} NFT offers
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                {/* Offers Summary */}
                <div className="bg-muted p-3 rounded-lg">
                  <div className="text-sm font-medium mb-2">Offers to Accept:</div>
                  <div className="space-y-1 text-xs">
                    {nftOffers.map((offer, index) => (
                      <div key={index} className="flex justify-between">
                        <span>{offer.nft_name || `NFT #${offer.nft_id?.slice(0, 8)}`}</span>
                        <span>{offer.amount === "0" ? 'Free' : `${offer.amount} ${offer.currency}`}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Password Input */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Wallet Password
                  </label>
                  <Input
                    type="password"
                    value={acceptAllPassword}
                    onChange={(e) => setAcceptAllPassword(e.target.value)}
                    placeholder="Enter your wallet password"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleAcceptAll();
                      }
                    }}
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={handleAcceptAll}
                    disabled={isProcessingOffers || !acceptAllPassword}
                    className="flex-1"
                  >
                    {isProcessingOffers ? "Processing..." : `Accept All ${nftOffers.length} Offers`}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowAcceptAllDialog(false);
                      setAcceptAllPassword("");
                    }}
                    disabled={isProcessingOffers}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Xaman Wallet QR Connection Modal */}
        <XamanConnectQR
          isOpen={showXamanQR}
          onClose={() => setShowXamanQR(false)}
          onSuccess={(address: string) => {
            // Handle successful Xaman connection
            toast({
              title: "Xaman Connected!",
              description: `Connected to ${address.substring(0, 10)}...`,
            });
            
            console.log('✅ Xaman Wallet connected:', address);
            
            // Optionally navigate to XRP wallet or update chain
            if (config?.symbol !== 'XRP') {
              setSelectedChain('xrp');
            }
            
            setShowXamanQR(false);
          }}
        />
      </div>
    </div>
  );
}
