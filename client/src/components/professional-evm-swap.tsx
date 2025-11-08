import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumericInput } from '@/components/ui/numeric-input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowDownUp, ArrowRightLeft, Settings, ChevronDown, Wallet, TrendingUp, RefreshCw, Zap, Star, Lock, Search, Loader2, AlertTriangle, CheckCircle, Clock, Send, ArrowRight, ExternalLink, X, Smartphone, Copy, QrCode } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import SwipeConfirm from './SwipeConfirm';
import { TokenLogo } from '@/components/ui/token-logo';
import { connectMetaMask, connectPhantom, isMetaMaskInstalled, isPhantomInstalled, getStoredEVMWallet, disconnectEVMWallet, getCurrentAccount, onAccountsChanged } from '@/utils/evmWalletConnect';
import FromTokenSelector from './evm/FromTokenSelector';
import ToTokenSelector from './evm/ToTokenSelector';
import { QRCodeSVG } from 'qrcode.react';
import { generateMetaMaskDeepLink, isMobileDevice as isMetaMaskMobile } from '@/utils/metamaskDeepLink';
import { generatePhantomConnectDeepLink, isMobileDevice as isPhantomMobile } from '@/utils/phantomDeepLink';

interface EVMToken {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  logoURI?: string;
  chainId: number;
  price_usd?: number;
  volume_24h?: number;
  price_change_24h?: number;
  verified?: boolean;
  source?: string;
}

interface EVMSwapQuote {
  fromToken: EVMToken;
  toToken: EVMToken;
  fromAmount: string;
  toAmount: string;
  estimatedGas: string;
  priceImpact: number;
  slippage: number;
  route: any[];
  protocols: string[];
  dex: string;
  minimumReceived: string;
}

interface ModernEVMSwapProps {
  isWalletConnected: boolean;
  walletAddress: string | null;
  walletHandle: string | null;
  balance: string;
  totalBalance: string;
  reserve: string;
  availableTokens?: any[];
  initialTokenAddress?: string;
  initialChain?: string;
}

const formatUsd = (amount: number): string => {
  return new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2 
  }).format(amount);
};

// Complete EVM chains
const evmChains = [
  { id: 1, name: "Ethereum", logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png" },
  { id: 42161, name: "Arbitrum", logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png" },
  { id: 10, name: "Optimism", logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/optimism/info/logo.png" },
  { id: 8453, name: "Base", logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png" },
  { id: 137, name: "Polygon", logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png" },
  { id: 56, name: "BNB Smart Chain", logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/info/logo.png" },
  { id: 43114, name: "Avalanche", logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchec/info/logo.png" },
  { id: 250, name: "Fantom", logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/fantom/info/logo.png" }
];

export default function ProfessionalEVMSwap({ 
  isWalletConnected, 
  walletAddress, 
  walletHandle, 
  balance, 
  totalBalance, 
  reserve,
  availableTokens = [],
  initialTokenAddress,
  initialChain
}: ModernEVMSwapProps) {
  const { toast } = useToast();
  
  // State - Match XRPL swap exactly
  const [fromToken, setFromToken] = useState<EVMToken | null>(null);
  const [toToken, setToToken] = useState<EVMToken | null>(null);
  
  // Handle initial token from URL parameters (from scanner)
  useEffect(() => {
    if (initialTokenAddress && !fromToken) {
      console.log('🎯 EVM Swap: Loading initial token from scanner:', { initialTokenAddress, initialChain });
      
      // Fetch token details and set as fromToken
      const loadInitialToken = async () => {
        try {
          const chainId = initialChain === 'ethereum' ? 1 : initialChain === 'bsc' ? 56 : 1;
          
          // Try to fetch token data from backend
          const response = await fetch(`/api/ethereum/token-info?address=${initialTokenAddress}&chainId=${chainId}`);
          
          if (response.ok) {
            const tokenData = await response.json() as any;
            setFromToken({
              symbol: tokenData.symbol || 'TOKEN',
              name: tokenData.name || 'Unknown Token',
              address: initialTokenAddress,
              decimals: tokenData.decimals || 18,
              logoURI: tokenData.logoURI,
              chainId: chainId,
              price_usd: tokenData.price_usd,
              verified: tokenData.verified
            });
            console.log('✅ EVM Swap: Loaded initial token:', tokenData);
          } else {
            // Fallback: set basic token info
            setFromToken({
              symbol: 'TOKEN',
              name: 'Token',
              address: initialTokenAddress,
              decimals: 18,
              chainId: chainId
            });
          }
        } catch (error) {
          console.error('Failed to load initial token:', error);
        }
      };
      
      loadInitialToken();
    }
  }, [initialTokenAddress, initialChain, fromToken]);
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [minimumReceived, setMinimumReceived] = useState("");
  const [exchangeRate, setExchangeRate] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [priceImpact, setPriceImpact] = useState("");
  const [platformFee, setPlatformFee] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [slippage, setSlippage] = useState(1); // 1% default for EVM
  const [showSettings, setShowSettings] = useState(false);
  const [currentBalance, setCurrentBalance] = useState(balance || "0.00");
  const [selectedChain, setSelectedChain] = useState(evmChains[0]); // Default to Ethereum
  
  // Token selector modals - separate for FROM and TO
  const [showFromTokenModal, setShowFromTokenModal] = useState(false);
  const [showToTokenModal, setShowToTokenModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  
  // Wallet selection
  const [selectedWallet, setSelectedWallet] = useState<'riddle' | 'metamask' | 'phantom' | null>(null);
  const [evmWalletAddress, setEvmWalletAddress] = useState<string | null>(null);
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  
  // Mobile wallet deep link modal (for MetaMask/Phantom mobile)
  const [showMobileWalletModal, setShowMobileWalletModal] = useState(false);
  const [mobileWalletDeepLink, setMobileWalletDeepLink] = useState('');
  const [mobileWalletQRData, setMobileWalletQRData] = useState('');
  const [mobileWalletName, setMobileWalletName] = useState<'MetaMask' | 'Phantom' | ''>('');
  
  // Progress tracking states - Match XRPL exactly
  const [swapStatus, setSwapStatus] = useState<'idle' | 'preparing' | 'signing' | 'submitting' | 'success' | 'error'>('idle');
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [swapProgress, setSwapProgress] = useState({
    step: 1,
    totalSteps: 4,
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


  // Get quote from 1inch
  const getQuote = async () => {
    if (!fromToken || !toToken || !fromAmount) return;

    try {
      setIsLoading(true);
      setError(null);
      
      // Calculate amount in token's smallest unit
      const amount = Math.floor(parseFloat(fromAmount) * Math.pow(10, fromToken.decimals)).toString();
      
      console.log(`🔍 Getting 1inch quote: ${fromAmount} ${fromToken.symbol} → ${toToken.symbol} on ${selectedChain.name}`);
      
      const response = await fetch('/api/ethereum/swap/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chainId: selectedChain.id,
          fromTokenAddress: fromToken.address,
          toTokenAddress: toToken.address,
          amount: amount,
          slippage: slippage
        })
      });

      const data = await response.json() as any;
      
      if (data.success && data.quote) {
        const outputAmount = (parseInt(data.quote.toAmount) / Math.pow(10, toToken.decimals)).toFixed(6);
        const rate = (parseFloat(outputAmount) / parseFloat(fromAmount)).toFixed(6);
        
        setToAmount(outputAmount);
        setExchangeRate(`1 ${fromToken.symbol} = ${rate} ${toToken.symbol}`);
        setPriceImpact(data.quote.priceImpactPct ? data.quote.priceImpactPct.toFixed(2) : "0");
        setMinimumReceived((parseFloat(outputAmount) * (1 - slippage / 100)).toFixed(6));
        
        console.log(`✅ 1inch quote: ${outputAmount} ${toToken.symbol}`);
      } else {
        throw new Error(data.error || 'Failed to get quote');
      }
    } catch (error) {
      console.error('Quote error:', error);
      setError(error instanceof Error ? error.message : 'Failed to get quote');
    } finally {
      setIsLoading(false);
    }
  };

  // Execute swap
  const executeSwap = async () => {
    if (!fromToken || !toToken || !fromAmount) return;
    if (!selectedWallet) {
      toast({
        title: "No Wallet Selected",
        description: "Please select a wallet to swap with",
        variant: "destructive"
      });
      return;
    }

    try {
      setSwapStatus('preparing');
      setShowProgressModal(true);
      setSwapProgress({
        ...swapProgress,
        step: 1,
        message: 'Preparing swap transaction...',
        fromAmount,
        toAmount,
        fromSymbol: fromToken.symbol,
        toSymbol: toToken.symbol
      });

      // Calculate amount in token's smallest unit
      const amount = Math.floor(parseFloat(fromAmount) * Math.pow(10, fromToken.decimals)).toString();
      
      console.log(`🔄 Executing swap with ${selectedWallet}: ${fromAmount} ${fromToken.symbol} → ${toToken.symbol} on ${selectedChain.name}`);
      
      // Route based on selected wallet
      if (selectedWallet === 'riddle') {
        // Use Riddle wallet (backend execution)
        const sessionData = sessionStorage.getItem('riddle_wallet_session');
        const sessionToken = sessionData ? JSON.parse(sessionData).sessionToken : null;
        
        if (!sessionToken) {
          throw new Error('Please login to your Riddle wallet first');
        }

        setSwapStatus('signing');
        setSwapProgress({
          ...swapProgress,
          step: 2,
          message: 'Signing transaction with Riddle wallet...'
        });
        
        const response = await fetch('/api/ethereum/swap/execute', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            chainId: selectedChain.id,
            fromTokenAddress: fromToken.address,
            toTokenAddress: toToken.address,
            amount: amount,
            slippage: slippage,
            sessionToken: sessionToken
          })
        });

        const data = await response.json() as any;
        
        if (data.success) {
          setSwapStatus('success');
          setSwapProgress({
            ...swapProgress,
            step: 4,
            message: 'Swap completed successfully!',
            txHash: data.txHash
          });
          
          toast({
            title: "Swap Successful!",
            description: `Swapped ${fromAmount} ${fromToken.symbol} to ${toToken.symbol} on ${selectedChain.name}`,
          });
          
          // Clear form
          setFromAmount('');
          setToAmount('');
          setExchangeRate('');
        } else {
          throw new Error(data.error || 'Swap failed');
        }
      } else if (selectedWallet === 'metamask' || selectedWallet === 'phantom') {
        // Use MetaMask or Phantom (client-side execution with ethers)
        setSwapStatus('signing');
        setSwapProgress({
          ...swapProgress,
          step: 2,
          message: `Signing transaction with ${selectedWallet === 'metamask' ? 'MetaMask' : 'Phantom'}...`
        });

        toast({
          title: `${selectedWallet === 'metamask' ? 'MetaMask' : 'Phantom'} Swap`,
          description: `Client-side swap execution coming soon. Please use Riddle wallet for now.`,
          variant: "default"
        });
        
        setSwapStatus('idle');
        setShowProgressModal(false);
        
        // TODO: Implement client-side swap execution
        throw new Error(`${selectedWallet === 'metamask' ? 'MetaMask' : 'Phantom'} swap execution coming soon`);
      }
    } catch (error) {
      console.error('Swap execution error:', error);
      setSwapStatus('error');
      setSwapProgress({
        ...swapProgress,
        error: error instanceof Error ? error.message : 'Swap failed'
      });
      
      toast({
        title: "Swap Failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive",
      });
    }
  };

  // Token selection handlers - separate for FROM and TO
  const handleSelectFromToken = (token: EVMToken) => {
    setFromToken(token);
    setFromAmount('');
    setToAmount('');
    setExchangeRate('');
  };

  const handleSelectToToken = (token: EVMToken) => {
    setToToken(token);
    setToAmount('');
    setExchangeRate('');
  };

  const swapTokens = () => {
    const tempToken = fromToken;
    const tempAmount = fromAmount;
    
    setFromToken(toToken);
    setToToken(tempToken);
    setFromAmount(toAmount);
    setToAmount(tempAmount);
    setExchangeRate('');
  };

  const handleSwapConfirm = async () => {
    setShowPasswordModal(false);
    await executeSwap();
  };

  // Get quote when tokens and amount change
  useEffect(() => {
    if (fromToken && toToken && fromAmount && parseFloat(fromAmount) > 0) {
      const timer = setTimeout(() => getQuote(), 500);
      return () => clearTimeout(timer);
    } else {
      setToAmount('');
      setExchangeRate('');
    }
  }, [fromToken, toToken, fromAmount, slippage, selectedChain]);

  // EXACT SAME UI STRUCTURE AS XRPL SWAP
  return (
    <div className="w-full max-w-md mx-auto space-y-4 px-4 sm:px-0">

      {/* Wallet Selection */}
      <Card className="border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20">
        <CardContent className="p-3">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Swap Wallet</span>
              {selectedWallet && (
                <Badge variant="outline" className="capitalize flex items-center gap-1">
                  {selectedWallet === 'riddle' && (
                    <>
                      <img src="/images/chains/xrp-logo.png" alt="Riddle" className="h-4 w-4" />
                      Riddle
                    </>
                  )}
                  {selectedWallet === 'metamask' && (
                    <>
                      <img src="/images/wallets/metamask.png" alt="MetaMask" className="h-4 w-4" />
                      MetaMask
                    </>
                  )}
                  {selectedWallet === 'phantom' && (
                    <>
                      <img src="/images/wallets/phantom.png" alt="Phantom" className="h-4 w-4" />
                      Phantom
                    </>
                  )}
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
                  setEvmWalletAddress(walletAddress);
                }}
                className="flex flex-col items-center gap-1 h-auto py-2"
              >
                <img src="/images/chains/xrp-logo.png" alt="Riddle" className="h-6 w-6" />
                <span className="text-xs">Riddle</span>
              </Button>
              
              <Button
                variant={selectedWallet === 'metamask' ? 'default' : 'outline'}
                size="sm"
                onClick={async () => {
                  if (!isMetaMaskInstalled()) {
                    toast({
                      title: "MetaMask Not Found",
                      description: "Please install MetaMask from metamask.io",
                      variant: "destructive"
                    });
                    return;
                  }
                  setIsConnectingWallet(true);
                  try {
                    const connection = await connectMetaMask(selectedChain.id);
                    setSelectedWallet('metamask');
                    setEvmWalletAddress(connection.address);
                    toast({
                      title: "MetaMask Connected",
                      description: `Connected to ${connection.address.slice(0, 6)}...${connection.address.slice(-4)}`
                    });
                  } catch (error: any) {
                    toast({
                      title: "Connection Failed",
                      description: error.message || "Failed to connect MetaMask",
                      variant: "destructive"
                    });
                  } finally {
                    setIsConnectingWallet(false);
                  }
                }}
                disabled={isConnectingWallet}
                className="flex flex-col items-center gap-1 h-auto py-2"
              >
                <img src="/images/wallets/metamask.png" alt="MetaMask" className="h-6 w-6" />
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
                    const connection = await connectPhantom(selectedChain.id);
                    setSelectedWallet('phantom');
                    setEvmWalletAddress(connection.address);
                    toast({
                      title: "Phantom Connected",
                      description: `Connected to ${connection.address.slice(0, 6)}...${connection.address.slice(-4)}`
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
                <img src="/images/wallets/phantom.png" alt="Phantom" className="h-6 w-6" />
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
                {(selectedWallet === 'riddle' && isWalletConnected && walletAddress) && (
                  <span className="text-green-600 dark:text-green-400">✓ Connected: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
                )}
                {(selectedWallet === 'metamask' && evmWalletAddress) && (
                  <span className="text-green-600 dark:text-green-400">✓ Connected: {evmWalletAddress.slice(0, 6)}...{evmWalletAddress.slice(-4)}</span>
                )}
                {(selectedWallet === 'phantom' && evmWalletAddress) && (
                  <span className="text-green-600 dark:text-green-400">✓ Connected: {evmWalletAddress.slice(0, 6)}...{evmWalletAddress.slice(-4)}</span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Chain Selection */}
      <Card className="border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src={selectedChain.logo} alt={selectedChain.name} className="w-6 h-6 rounded-full" />
              <span className="text-sm font-medium">{selectedChain.name}</span>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  Change Network
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Select Network</DialogTitle>
                </DialogHeader>
                <div className="grid gap-2">
                  {evmChains.map((chain) => (
                    <Button
                      key={chain.id}
                      variant={selectedChain.id === chain.id ? "default" : "ghost"}
                      onClick={() => {
                        setSelectedChain(chain);
                        setFromToken(null);
                        setToToken(null);
                        setFromAmount('');
                        setToAmount('');
                        setExchangeRate('');
                      }}
                      className="flex items-center gap-2 justify-start"
                    >
                      <img src={chain.logo} alt={chain.name} className="w-5 h-5 rounded-full" />
                      {chain.name}
                    </Button>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Main Swap Card */}
      <Card className="border-2 border-gradient-to-r from-blue-500/20 to-purple-500/20 bg-gradient-to-br from-background to-secondary/20">
        <CardHeader className="pb-2 sm:pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base sm:text-lg">Swap Tokens</CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-3 sm:space-y-4">
          {/* Settings Panel */}
          {showSettings && (
            <div className="border rounded-lg p-3 bg-secondary/20">
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium block mb-2">
                    Slippage Tolerance: {slippage}%
                  </label>
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
              </div>
            </div>
          )}

          {/* From Token */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs sm:text-sm text-muted-foreground">
              <span>From</span>
              {fromToken && isWalletConnected && (
                <span>Balance: {currentBalance} {fromToken.symbol}</span>
              )}
            </div>
            <div className="border rounded-lg p-3 bg-secondary/20">
              <div className="flex items-center justify-between mb-2">
                <Button
                  variant="ghost"
                  className="h-auto p-0 hover:bg-transparent"
                  onClick={() => setShowFromTokenModal(true)}
                >
                  <div className="flex items-center gap-2">
                    {fromToken ? (
                      <>
                        <TokenLogo 
                          symbol={fromToken.symbol} 
                          size="sm" 
                          className="rounded-full" 
                        />
                        <div className="text-left">
                          <div className="font-medium text-sm">{fromToken.symbol}</div>
                          <div className="text-xs text-muted-foreground">{fromToken.name}</div>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center">
                          <Search className="h-4 w-4" />
                        </div>
                        <span>Select token</span>
                      </div>
                    )}
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </div>
                </Button>
                {fromToken?.price_usd && (
                  <div className="text-right text-xs text-muted-foreground">
                    ${fromToken.price_usd.toFixed(4)}
                  </div>
                )}
              </div>
              <NumericInput
                value={fromAmount}
                onChange={(e) => setFromAmount(e.target.value)}
                placeholder="0.00"
                showDoubleZero={true}
                className="border-0 text-right text-lg font-medium bg-transparent p-0 h-auto"
                disabled={!fromToken}
              />
              {fromAmount && fromToken?.price_usd && (
                <div className="text-xs text-muted-foreground text-right mt-1">
                  ≈ ${(parseFloat(fromAmount) * fromToken.price_usd).toFixed(2)} USD
                </div>
              )}
            </div>
          </div>

          {/* Swap Button */}
          <div className="flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={swapTokens}
              className="rounded-full h-8 w-8 p-0"
              disabled={!fromToken || !toToken}
            >
              <ArrowDownUp className="h-4 w-4" />
            </Button>
          </div>

          {/* To Token */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs sm:text-sm text-muted-foreground">
              <span>To</span>
              {toToken && toAmount && (
                <span>Minimum received: {minimumReceived} {toToken.symbol}</span>
              )}
            </div>
            <div className="border rounded-lg p-3 bg-secondary/20">
              <div className="flex items-center justify-between mb-2">
                <Button
                  variant="ghost"
                  className="h-auto p-0 hover:bg-transparent"
                  onClick={() => setShowToTokenModal(true)}
                >
                  <div className="flex items-center gap-2">
                    {toToken ? (
                      <>
                        <TokenLogo 
                          symbol={toToken.symbol} 
                          size="sm" 
                          className="rounded-full" 
                        />
                        <div className="text-left">
                          <div className="font-medium text-sm">{toToken.symbol}</div>
                          <div className="text-xs text-muted-foreground">{toToken.name}</div>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center">
                          <Search className="h-4 w-4" />
                        </div>
                        <span>Select token</span>
                      </div>
                    )}
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </div>
                </Button>
                {toToken?.price_usd && (
                  <div className="text-right text-xs text-muted-foreground">
                    ${toToken.price_usd.toFixed(4)}
                  </div>
                )}
              </div>
              <div className="text-right text-lg font-medium">
                {isLoading ? (
                  <div className="flex items-center justify-end gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Getting quote...</span>
                  </div>
                ) : (
                  toAmount || "0.00"
                )}
              </div>
              {toAmount && toToken?.price_usd && (
                <div className="text-xs text-muted-foreground text-right mt-1">
                  ≈ ${(parseFloat(toAmount) * toToken.price_usd).toFixed(2)} USD
                </div>
              )}
            </div>
          </div>

          {/* Exchange Rate Display */}
          {exchangeRate && (
            <div className="space-y-2 p-3 rounded-lg bg-secondary/50">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Exchange Rate</span>
                <span className="font-medium">{exchangeRate}</span>
              </div>
              {priceImpact && parseFloat(priceImpact) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Price Impact</span>
                  <span className={`font-medium ${parseFloat(priceImpact) > 5 ? 'text-red-500' : 'text-green-500'}`}>
                    {parseFloat(priceImpact).toFixed(2)}%
                  </span>
                </div>
              )}
              {minimumReceived && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Minimum Received</span>
                  <span className="font-medium">{minimumReceived} {toToken?.symbol}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Network</span>
                <span className="font-medium">{selectedChain.name}</span>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Swap Button */}
          <Button
            onClick={() => setShowPasswordModal(true)}
            disabled={!fromToken || !toToken || !fromAmount || !toAmount || isLoading || !isWalletConnected}
            className="w-full h-12"
            size="lg"
          >
            {!isWalletConnected ? (
              'Connect Wallet'
            ) : !fromToken || !toToken ? (
              'Select Tokens'
            ) : !fromAmount ? (
              'Enter Amount'
            ) : isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Getting Quote...
              </>
            ) : (
              `Swap ${fromToken.symbol} for ${toToken.symbol}`
            )}
          </Button>
        </CardContent>
      </Card>

      {/* FROM Token Selector */}
      <FromTokenSelector
        isOpen={showFromTokenModal}
        onClose={() => setShowFromTokenModal(false)}
        onSelect={handleSelectFromToken}
        chainId={selectedChain.id}
        chainName={selectedChain.name}
        walletAddress={evmWalletAddress}
        riddleWalletAddress={walletAddress}
      />

      {/* TO Token Selector */}
      <ToTokenSelector
        isOpen={showToTokenModal}
        onClose={() => setShowToTokenModal(false)}
        onSelect={handleSelectToToken}
        chainId={selectedChain.id}
        chainName={selectedChain.name}
      />

      {/* Progress Modal */}
      <Dialog open={showProgressModal} onOpenChange={setShowProgressModal}>
        <DialogContent className="w-[85%] max-w-xs sm:max-w-md mx-auto">
          <DialogHeader className="space-y-1">
            <DialogTitle className="flex items-center gap-2 text-base">
              <ArrowRightLeft className="h-4 w-4" />
              Swap Progress
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Simple Progress Display */}
            {swapStatus === 'submitting' && (
              <div className="text-center p-6">
                <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-500" />
                <div className="text-sm font-medium mb-1">Processing Swap</div>
                <div className="text-xs text-muted-foreground">
                  {swapProgress.message}
                </div>
              </div>
            )}

            {/* Error State */}
            {swapStatus === 'error' && (
              <div className="text-center p-4 bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/20 dark:to-rose-950/20 rounded-lg border border-red-200 dark:border-red-800">
                <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                <div className="text-sm font-bold text-red-700 dark:text-red-400 mb-1">
                  Swap Failed
                </div>
                <div className="text-xs text-red-600 dark:text-red-300 mb-3">
                  {swapProgress.error}
                </div>
                <Button 
                  onClick={() => {
                    setShowProgressModal(false);
                    setSwapStatus('idle');
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white h-8 px-3 text-xs"
                >
                  Try Again
                </Button>
              </div>
            )}

            {/* Success Animation */}
            {swapStatus === 'success' && (
              <div className="text-center p-3 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-lg border border-green-200 dark:border-green-800">
                <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <div className="text-sm font-bold text-green-700 dark:text-green-400 mb-1">
                  Complete!
                </div>
                <div className="text-xs text-green-600 dark:text-green-300 mb-2 truncate">
                  {swapProgress.fromAmount} {swapProgress.fromSymbol} → {swapProgress.toAmount} {swapProgress.toSymbol}
                </div>
                <Button 
                  onClick={() => {
                    setShowProgressModal(false);
                    setSwapStatus('idle');
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white h-8 px-3 text-xs"
                >
                  Close
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Modal */}
      <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <DialogContent className="w-[85%] max-w-xs sm:max-w-md mx-auto">
          <DialogHeader className="space-y-1">
            <DialogTitle className="flex items-center gap-2 text-base">
              <ArrowRightLeft className="h-4 w-4" />
              Confirm Swap
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Review and confirm your swap transaction.
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
                <span className="font-medium">{toAmount} {toToken?.symbol}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Network:</span>
                <span className="font-medium">{selectedChain.name}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Platform Fee:</span>
                <span>{platformFee}</span>
              </div>
            </div>
            
            <div className="space-y-3">
              <SwipeConfirm
                onConfirm={handleSwapConfirm}
                disabled={false}
                text="Swipe to confirm swap"
                successText="Processing swap..."
                className="mb-2"
              />
              <div className="flex gap-2 justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowPasswordModal(false);
                  }}
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mobile Wallet QR Modal (MetaMask/Phantom Mobile) */}
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
                {mobileWalletName === 'MetaMask' && (
                  <>Open MetaMask mobile app and scan this QR code to connect your wallet</>
                )}
                {mobileWalletName === 'Phantom' && (
                  <>Open Phantom mobile app and scan this QR code to connect your wallet</>
                )}
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
