import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowDownUp, Settings, ChevronDown, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2 } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { getSessionToken } from '@/utils/auth';
interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  chainId: number;
  price?: number;
  marketCap?: number;
  volume24h?: number;
}

// Complete EVM chains with logos from Trust Wallet and official sources
const evmChains = [
  { id: 1, name: "Ethereum", logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png" },
  { id: 42161, name: "Arbitrum", logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png" },
  { id: 10, name: "Optimism", logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/optimism/info/logo.png" },
  { id: 8453, name: "Base", logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png" },
  { id: 137, name: "Polygon", logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png" },
  { id: 56, name: "BNB Smart Chain", logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/info/logo.png" },
  { id: 43114, name: "Avalanche", logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchec/info/logo.png" },
  { id: 250, name: "Fantom", logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/fantom/info/logo.png" },
  { id: 42220, name: "Celo", logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/celo/info/logo.png" },
  { id: 534352, name: "Scroll", logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/scroll/info/logo.png" },
  { id: 59144, name: "Linea", logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/linea/info/logo.png" },
  { id: 81457, name: "Blast", logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/blast/info/logo.png" },
  { id: 34443, name: "Mode", logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/mode/info/logo.png" },
  { id: 5000, name: "Mantle", logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/mantle/info/logo.png" },
  { id: 324, name: "zkSync Era", logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/zksync/info/logo.png" },
  { id: 1101, name: "Polygon zkEVM", logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png" },
  // Additional major EVM chains
  { id: 100, name: "Gnosis Chain", logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/xdai/info/logo.png" },
  { id: 1284, name: "Moonbeam", logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/moonbeam/info/logo.png" },
  { id: 1285, name: "Moonriver", logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/moonriver/info/logo.png" },
  { id: 25, name: "Cronos", logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/cronos/info/logo.png" },
  { id: 199, name: "BitTorrent Chain", logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/bittorrent/info/logo.png" },
  { id: 122, name: "Fuse", logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/fuse/info/logo.png" },
  { id: 1666600000, name: "Harmony", logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/harmony/info/logo.png" },
  { id: 128, name: "Heco", logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/heco/info/logo.png" },
  { id: 66, name: "OKExChain", logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/okexchain/info/logo.png" },
  { id: 321, name: "KCC", logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/kcc/info/logo.png" },
  { id: 288, name: "Boba Network", logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/boba/info/logo.png" },
  { id: 1313161554, name: "Aurora", logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/aurora/info/logo.png" },
  { id: 2000, name: "Dogechain", logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/dogechain/info/logo.png" },
  { id: 1088, name: "Metis", logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/metis/info/logo.png" },
  { id: 592, name: "Astar", logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/astar/info/logo.png" },
  { id: 14, name: "Flare", logo: "https://flare.network/wp-content/uploads/flare_logo_icon_square_white-4-150x150.png" }
];

interface EVMCleanSwapProps {
  isWalletConnected: boolean;
  walletAddress: string | null;
}

export default function EVMCleanSwap({ isWalletConnected, walletAddress }: EVMCleanSwapProps) {
  const [selectedChain, setSelectedChain] = useState(evmChains[0]);
  const [fromToken, setFromToken] = useState<Token | null>(null);
  const [toToken, setToToken] = useState<Token | null>(null);
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [slippage, setSlippage] = useState("1");
  const FEE_PERCENTAGE = 0.01; // 1% fee
  const FEE_WALLET = import.meta.env.VITE_FEE_WALLET_EVM || "0x9211346f428628d7C84CE1338C0b51FDdf2E8461"; // EVM fee collection wallet
  const [showSettings, setShowSettings] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [availableTokens, setAvailableTokens] = useState<Token[]>([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);

  const [fromTokenOpen, setFromTokenOpen] = useState(false);
  const [toTokenOpen, setToTokenOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [fromSearchQuery, setFromSearchQuery] = useState("");
  const [toSearchQuery, setToSearchQuery] = useState("");
  const [showChainSelector, setShowChainSelector] = useState(false);
  const { toast } = useToast();

  // Calculate swap price using 1inch Protocol
  const calculatePrice = async () => {
    if (!fromToken || !toToken || !fromAmount || parseFloat(fromAmount) === 0) {
      setToAmount("");
      return;
    }
    
    try {
      const sellAmount = (parseFloat(fromAmount) * Math.pow(10, fromToken.decimals)).toString();
      
      const response = await fetch('/api/swap/price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sellToken: fromToken.address,
          buyToken: toToken.address,
          sellAmount,
          chainId: selectedChain.id
        })
      });
      
      if (response.ok) {
        const data = await response.json() as any;
        const buyAmount = parseFloat(data.buyAmount) / Math.pow(10, toToken.decimals);
        setToAmount(buyAmount.toFixed(6));
      } else {
        setToAmount("0");
      }
    } catch (error) {
      setToAmount("0");
    }
  };

  // Auto-calculate price when inputs change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      calculatePrice();
    }, 800); // Increased debounce to reduce bouncing
    
    return () => clearTimeout(timeoutId);
  }, [fromToken, toToken, fromAmount, selectedChain]);

  // Load tokens for selected chain
  useEffect(() => {
    loadChainTokens();
  }, [selectedChain]);

  const loadChainTokens = async () => {
    setIsLoadingTokens(true);
    try {
      const response = await fetch(`/api/tokens/evm/${selectedChain.id}`);
      if (response.ok) {
        const tokens = await response.json() as any;

        setAvailableTokens(tokens);
        
        // Set default tokens (ETH/WETH and USDC)
        const ethToken = tokens.find((t: Token) => t.symbol === 'ETH' || t.symbol === 'WETH');
        const usdcToken = tokens.find((t: Token) => t.symbol === 'USDC');
        
        if (ethToken && !fromToken) setFromToken(ethToken);
        if (usdcToken && !toToken) setToToken(usdcToken);
      } else {
        setAvailableTokens([]);
      }
    } catch (error) {
      setAvailableTokens([]);
    } finally {
      setIsLoadingTokens(false);
    }
  };

  const handleSwapTokens = () => {
    const tempFrom = fromToken;
    const tempFromAmount = fromAmount;
    
    setFromToken(toToken);
    setToToken(tempFrom);
    setFromAmount(toAmount);
    setToAmount(tempFromAmount);
  };

  const handleSwap = async () => {
    if (!fromToken || !toToken || !fromAmount || !toAmount || !isWalletConnected) {
      toast({
        title: "Error",
        description: "Please connect wallet and select tokens",
        variant: "destructive"
      });
      return;
    }

    setIsSwapping(true);
    try {
      // Get session token for Riddle wallet authentication
      const sessionToken = getSessionToken();
      if (!sessionToken) {
        throw new Error('Please login to your Riddle wallet');
      }

      console.log('🔄 [EVM SWAP] Starting swap:', {
        from: fromToken.symbol,
        to: toToken.symbol,
        amount: fromAmount,
        chain: selectedChain.name
      });
      
      // Execute swap via backend with session authentication
      const response = await fetch('/api/evm/swap/execute', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          fromTokenAddress: fromToken.address,
          toTokenAddress: toToken.address,
          amount: fromAmount,
          chainId: selectedChain.id,
          slippage: parseFloat(slippage)
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json() as any;
        throw new Error(errorData.error || 'Swap failed');
      }

      const result = await response.json() as any;
      
      console.log('✅ [EVM SWAP] Swap successful:', result);
      
      toast({
        title: "Swap Successful!",
        description: `Swapped ${fromAmount} ${fromToken.symbol} for ${toToken.symbol}`,
      });
      
      // Clear form
      setFromAmount('');
      setToAmount('');

    } catch (error) {
      console.error('❌ [EVM SWAP] Swap error:', error);
      toast({
        title: "Swap Failed",
        description: error instanceof Error ? error.message : "Failed to execute swap",
        variant: "destructive"
      });
    } finally {
      setIsSwapping(false);
    }
  };

  const filteredTokens = useMemo(() => {
    const currentSearch = fromTokenOpen ? fromSearchQuery : toSearchQuery;
    if (!currentSearch) {
      return availableTokens.slice(0, 50);
    }
    return availableTokens.filter(token =>
      token.symbol?.toLowerCase().includes(currentSearch.toLowerCase()) ||
      token.name?.toLowerCase().includes(currentSearch.toLowerCase())
    );
  }, [availableTokens, fromSearchQuery, toSearchQuery, fromTokenOpen]);

  const TokenSelector = ({ 
    selectedToken, 
    onTokenSelect, 
    placeholder, 
    isOpen, 
    setIsOpen 
  }: { 
    selectedToken: Token | null; 
    onTokenSelect: (token: Token) => void; 
    placeholder: string;
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
  }) => (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        setFromSearchQuery("");
        setToSearchQuery("");
      }
      setIsOpen(open);
    }}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-2 h-14 px-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          {selectedToken ? (
            <>
              {selectedToken.logoURI && (
                <img src={selectedToken.logoURI} alt={selectedToken.symbol} className="w-8 h-8 rounded-full" />
              )}
              <div className="text-left">
                <div className="font-semibold text-lg">{selectedToken.symbol}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{selectedToken.name}</div>
              </div>
            </>
          ) : (
            <span className="text-gray-500">{placeholder}</span>
          )}
          <ChevronDown className="w-4 h-4 ml-auto" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md w-[95vw] fixed top-[5vh] left-1/2 transform -translate-x-1/2 z-[9999]" aria-describedby="token-selector-description" style={{ position: 'fixed', top: '5vh' }}>
        <DialogHeader>
          <DialogTitle>Select Token</DialogTitle>
        </DialogHeader>
        <p id="token-selector-description" className="sr-only">
          Search and select a token from the available list
        </p>
        
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search name or paste token address..."
              value={fromTokenOpen ? fromSearchQuery : toSearchQuery}
              onChange={(e) => {
                e.stopPropagation();
                const value = e.target.value;
                if (fromTokenOpen) {
                  setFromSearchQuery(value);
                } else {
                  setToSearchQuery(value);
                }
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
              }}
              className="pl-10"
              autoFocus
            />
          </div>
          
          {/* Custom Token Input */}
          {(fromTokenOpen ? fromSearchQuery : toSearchQuery).match(/^0x[a-fA-F0-9]{40}$/) && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
                Custom token detected. Click below to use this token:
              </p>
              <button
                onClick={() => {
                  const address = fromTokenOpen ? fromSearchQuery : toSearchQuery;
                  const customToken: Token = {
                    address,
                    symbol: 'CUSTOM',
                    name: 'Custom Token',
                    decimals: 18, // Default to 18, will be fetched from contract
                    chainId: selectedChain.id,
                    logoURI: `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/${address}/logo.png`
                  };
                  onTokenSelect(customToken);
                  setIsOpen(false);
                  setFromSearchQuery("");
                  setToSearchQuery("");
                }}
                className="w-full p-3 bg-white dark:bg-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold">?</span>
                  </div>
                  <div className="text-left">
                    <div className="font-medium">Use Custom Token</div>
                    <div className="text-sm text-gray-500 font-mono truncate">
                      {(fromTokenOpen ? fromSearchQuery : toSearchQuery).slice(0, 10)}...{(fromTokenOpen ? fromSearchQuery : toSearchQuery).slice(-8)}
                    </div>
                  </div>
                </div>
              </button>
            </div>
          )}
          
          <ScrollArea className="h-80">
            <div className="space-y-2">
              {filteredTokens.length === 0 && !(fromTokenOpen ? fromSearchQuery : toSearchQuery).match(/^0x[a-fA-F0-9]{40}$/) && (
                <div className="text-center py-8 px-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    No tokens found. Try searching "ERDL" or paste any ERC20 token address.
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    1inch Protocol supports swapping ANY ERC20 token - just paste the contract address!
                  </p>
                </div>
              )}
              {filteredTokens.map((token, index) => (
                <button
                    key={token.address || `token-${index}`}
                    onClick={() => {
                      try {
                        onTokenSelect(token);
                        setIsOpen(false);
                        setFromSearchQuery("");
                        setToSearchQuery("");
                      } catch (error) {
                      }
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    {token.logoURI && (
                      <img 
                        src={token.logoURI} 
                        alt={token.symbol || 'Token'} 
                        className="w-10 h-10 rounded-full"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                    <div className="text-left">
                      <div className="font-medium">{token.symbol || 'Unknown'}</div>
                      <div className="text-sm text-gray-500">{token.name || 'Unknown Token'}</div>
                    </div>
                  </button>
                ))}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="max-w-3xl mx-auto bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 p-8 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Swap
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowSettings(!showSettings)}
          className="w-10 h-10 p-0 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <Settings className="w-4 h-4" />
        </Button>
      </div>

      {/* Chain Selector Button */}
      <div className="mb-4">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
          Select Chain
        </label>
        <Button
          variant="outline"
          onClick={() => setShowChainSelector(true)}
          className="w-full justify-between h-12 px-4 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <div className="flex items-center gap-3">
            <img src={selectedChain.logo} alt={selectedChain.name} className="w-6 h-6 rounded-full" />
            <span className="font-medium">{selectedChain.name}</span>
          </div>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Chain Selector Dialog */}
      <Dialog open={showChainSelector} onOpenChange={setShowChainSelector}>
        <DialogContent className="max-w-2xl max-h-[80vh]" aria-describedby="chain-selector-description">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Select Blockchain Network</DialogTitle>
          </DialogHeader>
          <p id="chain-selector-description" className="sr-only">
            Select a blockchain network for your EVM token swap
          </p>
          <ScrollArea className="h-[60vh] pr-4">
            <div className="grid grid-cols-2 gap-3 p-2">
              {evmChains.map((chain) => (
                <Button
                  key={chain.id}
                  variant={selectedChain.id === chain.id ? "default" : "outline"}
                  onClick={() => {
                    setSelectedChain(chain);
                    setShowChainSelector(false);
                    setFromToken(null);
                    setToToken(null);
                    setAvailableTokens([]);
                  }}
                  className="h-auto p-4 justify-start hover:scale-105 transition-transform"
                >
                  <div className="flex items-center gap-3 w-full">
                    <img 
                      src={chain.logo} 
                      alt={chain.name} 
                      className="w-10 h-10 rounded-full"
                      onError={(e) => {
                        e.currentTarget.src = '/logo.jpg';
                      }}
                    />
                    <div className="text-left">
                      <div className="font-semibold">{chain.name}</div>
                      <div className="text-xs text-gray-500">Chain ID: {chain.id}</div>
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Settings Panel */}
      {showSettings && (
        <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl space-y-4">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Slippage Tolerance</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-blue-600">{slippage}%</span>
                {parseFloat(slippage) === 5 && (
                  <Badge variant="secondary" className="text-xs">Default</Badge>
                )}
              </div>
            </div>
            <div className="flex gap-2 mb-2">
              {[2, 5, 10, 15].map((preset) => (
                <Button
                  key={preset}
                  variant={parseFloat(slippage) === preset ? "default" : "outline"}
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => setSlippage(preset.toString())}
                >
                  {preset}%
                </Button>
              ))}
            </div>
            <Input
              type="number"
              placeholder="Custom %"
              value={[2, 5, 10, 15].includes(parseFloat(slippage)) ? '' : slippage}
              onChange={(e) => {
                const value = parseFloat(e.target.value) || 0;
                if (value >= 0 && value <= 50) {
                  setSlippage(value.toString());
                }
              }}
              className="text-xs h-8"
              step="0.1"
              min="0"
              max="50"
            />
          </div>
        </div>
      )}

      {/* From Token */}
      <div className="space-y-4">
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">From</span>
          </div>
          <div className="flex gap-3">
            <TokenSelector
              selectedToken={fromToken}
              onTokenSelect={setFromToken}
              placeholder="Select token"
              isOpen={fromTokenOpen}
              setIsOpen={setFromTokenOpen}
            />
            <div className="flex-1">
              <Input
                type="number"
                placeholder="0.0"
                value={fromAmount}
                onChange={(e) => setFromAmount(e.target.value)}
                className="w-full text-right text-lg font-medium bg-transparent border-0 focus:ring-0"
              />
              {fromAmount && fromToken && (fromToken as any).priceUsd && (
                <div className="text-right text-sm text-gray-500 dark:text-gray-400 mt-1">
                  ${(parseFloat(fromAmount) * parseFloat((fromToken as any).priceUsd)).toFixed(2)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Swap Button */}
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSwapTokens}
            className="w-10 h-10 p-0 rounded-full bg-blue-50 dark:bg-blue-900/50 hover:bg-blue-100 dark:hover:bg-blue-900/70"
          >
            <ArrowDownUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </Button>
        </div>

        {/* To Token */}
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">To</span>
          </div>
          <div className="flex gap-3">
            <TokenSelector
              selectedToken={toToken}
              onTokenSelect={setToToken}
              placeholder="Select token"
              isOpen={toTokenOpen}
              setIsOpen={setToTokenOpen}
            />
            <div className="flex-1">
              <Input
                type="number"
                placeholder="0.0"
                value={toAmount}
                onChange={(e) => setToAmount(e.target.value)}
                className="w-full text-right text-lg font-medium bg-transparent border-0 focus:ring-0"
                readOnly
              />
              {toAmount && toToken && (toToken as any).priceUsd && (
                <div className="text-right text-sm text-gray-500 dark:text-gray-400 mt-1">
                  ${(parseFloat(toAmount) * parseFloat((toToken as any).priceUsd)).toFixed(2)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Fee Display */}
      {fromAmount && parseFloat(fromAmount) > 0 && (
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
          <div className="flex justify-between items-center text-sm">
            <span className="text-blue-700 dark:text-blue-300">Platform Fee (1%)</span>
            <span className="font-medium text-blue-900 dark:text-blue-100">
              {(parseFloat(fromAmount) * FEE_PERCENTAGE).toFixed(6)} {fromToken?.symbol}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm mt-1">
            <span className="text-blue-700 dark:text-blue-300">You'll send</span>
            <span className="font-medium text-blue-900 dark:text-blue-100">
              {fromAmount} {fromToken?.symbol}
            </span>
          </div>
        </div>
      )}

      {/* Action Button */}
      <Button
        onClick={handleSwap}
        disabled={!isWalletConnected || isSwapping || !fromToken || !toToken || !fromAmount}
        className="w-full mt-6 h-14 text-lg font-semibold bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200"
      >
        {isSwapping 
          ? "Swapping..." 
          : !isWalletConnected 
            ? "Connect Wallet" 
            : "Swap"
        }
      </Button>

      {isLoadingTokens && (
        <div className="mt-4 text-center text-sm text-gray-500">
          Loading tokens...
        </div>
      )}
    </div>
  );
}
