import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowDownUp, Settings, ChevronDown, Wallet, RefreshCw, Zap, Search, Loader2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface TokenSearchResult {
  symbol: string;
  name: string;
  issuer: string;
  currency_code: string;
  logo_url?: string;
  icon_url?: string;
  price_usd?: number;
  volume_24h?: number;
  market_cap?: number;
  price_change_24h?: number;
  verified: boolean;
  source: string;
}

interface XRPLInstantSwapProps {
  isWalletConnected: boolean;
  walletAddress: string | null;
  walletHandle: string | null;
  balance: string;
  totalBalance: string;
  reserve: string;
}

const formatUsd = (amount: number): string => {
  return new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2 
  }).format(amount);
};

const TokenLogo = ({ token, size = 32, className = "" }: { 
  token: TokenSearchResult; 
  size?: number; 
  className?: string; 
}) => {
  const logoUrl = token.logo_url || token.icon_url;
  
  if (logoUrl) {
    return (
      <img 
        src={logoUrl} 
        alt={token.symbol}
        width={size}
        height={size}
        className={`${className} bg-secondary`}
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
          const fallback = target.nextElementSibling as HTMLElement;
          if (fallback) fallback.style.display = 'flex';
        }}
      />
    );
  }
  
  return (
    <div 
      className={`${className} bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm`}
      style={{ width: size, height: size }}
    >
      {token.symbol.substring(0, 2)}
    </div>
  );
};

export default function XRPLInstantSwap({
  isWalletConnected,
  walletAddress,
  walletHandle,
  balance,
  totalBalance,
  reserve
}: XRPLInstantSwapProps) {
  const { toast } = useToast();
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showTokenSearch, setShowTokenSearch] = useState<'from' | 'to' | null>(null);
  const [tokenSearchQuery, setTokenSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TokenSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Default tokens - NO hardcoded prices, fetch live data
  const [fromToken, setFromToken] = useState<TokenSearchResult>({
    symbol: 'XRP',
    name: 'XRP',
    issuer: '',
    currency_code: 'XRP',
    verified: true,
    source: 'native',
    price_usd: 0  // Will be updated with live price
  });

  const [toToken, setToToken] = useState<TokenSearchResult>({
    symbol: 'RDL',
    name: 'RiddleSwap Token',
    issuer: 'r9xvnzUWZJpDu3NA6MKHmKhKJQTRqCRgu9',
    currency_code: 'RDL',
    verified: true,
    source: 'issuer',
    price_usd: 0  // Will be updated with live price
  });

  // Token search functionality
  const searchTokens = async (query: string) => {
    if (!query.trim()) return;
    
    setIsSearching(true);
    try {
      const response = await fetch(`/api/xrpl/tokens/search?q=${encodeURIComponent(query)}`);
      const data = await response.json() as any;
      
      if (data.success && data.tokens) {
        setSearchResults(data.tokens);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Token search failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Fetch live prices for default tokens on component mount
  useEffect(() => {
    const fetchInitialPrices = async () => {
      try {
        // Fetch live XRP price
        const xrpResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd&include_24hr_change=true');
        const xrpData = await xrpResponse.json();
        if (xrpData?.ripple?.usd) {
          setFromToken(prev => ({ ...prev, price_usd: xrpData.ripple.usd }));
          console.log(`✅ XRP live price: $${xrpData.ripple.usd}`);
        }
        
        // Fetch live RDL price from DexScreener
        const rdlResponse = await fetch('https://api.dexscreener.com/latest/dex/tokens/r9xvnzUWZJpDu3NA6MKHmKhKJQTRqCRgu9');
        const rdlData = await rdlResponse.json();
        if (rdlData?.pairs?.[0]?.priceUsd) {
          setToToken(prev => ({ ...prev, price_usd: parseFloat(rdlData.pairs[0].priceUsd) }));
          console.log(`✅ RDL live price: $${rdlData.pairs[0].priceUsd}`);
        }
      } catch (error) {
        console.warn('⚠️ Failed to fetch live prices for default tokens:', error);
      }
    };
    
    fetchInitialPrices();
  }, []);

  useEffect(() => {
    if (tokenSearchQuery) {
      const timeoutId = setTimeout(() => searchTokens(tokenSearchQuery), 300);
      return () => clearTimeout(timeoutId);
    } else {
      setSearchResults([]);
    }
  }, [tokenSearchQuery]);

  // Calculate quote for display
  const calculateQuote = async () => {
    if (!fromAmount || !fromToken || !toToken) return;

    try {
      const response = await fetch('/api/xrpl/exchange-rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromCurrency: fromToken.symbol,
          fromIssuer: fromToken.issuer,
          toCurrency: toToken.symbol,
          toIssuer: toToken.issuer,
          amount: fromAmount
        })
      });

      const data = await response.json() as any;
      if (data.success) {
        setToAmount(data.outputAmount);
      }
    } catch (error) {
      console.error('Quote calculation failed:', error);
    }
  };

  useEffect(() => {
    if (fromAmount && parseFloat(fromAmount) > 0) {
      const timeoutId = setTimeout(calculateQuote, 500);
      return () => clearTimeout(timeoutId);
    } else {
      setToAmount('');
    }
  }, [fromAmount, fromToken, toToken]);

  const handleSwap = async () => {
    if (!isWalletConnected || !walletAddress || !fromAmount || !toAmount) {
      toast({
        title: "Missing Information",
        description: "Please connect wallet and enter valid amounts",
        variant: "destructive"
      });
      return;
    }

    const password = prompt('Enter your Riddle wallet password to confirm the Payment transaction:');
    if (!password) return;

    setIsLoading(true);

    try {
      console.log('🔄 Executing XRPL Payment transaction (immediate swap)...');
      
      // Use Payment transaction with tfPartialPayment flag for immediate execution
      const swapResponse = await fetch('/api/xrpl/payment/instant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Payment transaction payload based on attached documentation
          transactionType: 'Payment',
          account: walletAddress,
          amount: {
            currency: toToken.symbol,
            issuer: toToken.issuer,
            value: toAmount
          },
          sendMax: fromToken.symbol === 'XRP' 
            ? (parseFloat(fromAmount) * 1000000).toString() // Convert XRP to drops
            : {
                currency: fromToken.symbol,
                issuer: fromToken.issuer,
                value: fromAmount
              },
          destination: walletAddress, // Self-payment for swap
          flags: 0x00020000, // tfPartialPayment flag
          walletAddress,
          walletType: 'riddle',
          riddleWalletId: walletHandle,
          password,
          paths: [{
            currency: toToken.symbol,
            issuer: toToken.issuer
          }]
        })
      });

      const swapData = await swapResponse.json();
      
      if (swapData.success) {
        toast({
          title: "Payment Swap Successful!",
          description: `Instantly swapped ${fromAmount} ${fromToken.symbol} → ${toAmount} ${toToken.symbol}`,
        });
        
        setFromAmount('');
        setToAmount('');
      } else {
        throw new Error(swapData.error || 'Payment transaction failed');
      }
      
    } catch (error) {
      console.error('Payment swap failed:', error);
      toast({
        title: "Instant Swap Failed",
        description: error instanceof Error ? error.message : 'Payment transaction failed',
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const selectToken = (token: TokenSearchResult, type: 'from' | 'to') => {
    if (type === 'from') {
      setFromToken(token);
    } else {
      setToToken(token);
    }
    setShowTokenSearch(null);
    setTokenSearchQuery('');
    setSearchResults([]);
  };

  const swapTokens = () => {
    const tempToken = fromToken;
    const tempAmount = fromAmount;
    
    setFromToken(toToken);
    setToToken(tempToken);
    setFromAmount(toAmount);
    setToAmount(tempAmount);
  };

  return (
    <>
      <div className="space-y-4">
        {/* From Token Input */}
        <div className="relative">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">You Send (Max Input)</span>
            {isWalletConnected && (
              <span className="text-xs text-muted-foreground">
                Balance: {balance} {fromToken.symbol}
              </span>
            )}
          </div>
          <Card className="p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowTokenSearch('from')}
                className="flex items-center gap-2 hover:bg-secondary/50 rounded-lg p-2 transition-colors"
              >
                <TokenLogo token={fromToken} size={32} className="rounded-full" />
                <div className="text-left">
                  <div className="font-semibold">{fromToken.symbol}</div>
                  <div className="text-xs text-muted-foreground">{fromToken.name}</div>
                </div>
                <ChevronDown className="h-4 w-4 ml-1" />
              </button>
              <Input
                type="number"
                placeholder="0.00"
                value={fromAmount}
                onChange={(e) => setFromAmount(e.target.value)}
                className="text-right text-xl font-semibold border-0 shadow-none bg-transparent"
              />
            </div>
            {fromToken.price_usd && fromAmount && (
              <div className="text-xs text-muted-foreground text-right mt-1">
                ≈ {formatUsd(parseFloat(fromAmount) * fromToken.price_usd)}
              </div>
            )}
          </Card>
        </div>

        {/* Swap Button */}
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={swapTokens}
            className="rounded-full p-2 h-8 w-8 hover:rotate-180 transition-transform duration-300"
          >
            <ArrowDownUp className="h-4 w-4" />
          </Button>
        </div>

        {/* To Token Input */}
        <div className="relative">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">You Receive (Min Output)</span>
            <Badge variant="secondary" className="text-xs">tfPartialPayment</Badge>
          </div>
          <Card className="p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowTokenSearch('to')}
                className="flex items-center gap-2 hover:bg-secondary/50 rounded-lg p-2 transition-colors"
              >
                <TokenLogo token={toToken} size={32} className="rounded-full" />
                <div className="text-left">
                  <div className="font-semibold">{toToken.symbol}</div>
                  <div className="text-xs text-muted-foreground">{toToken.name}</div>
                </div>
                <ChevronDown className="h-4 w-4 ml-1" />
              </button>
              <Input
                type="number"
                placeholder="0.00"
                value={toAmount}
                readOnly
                className="text-right text-xl font-semibold border-0 shadow-none bg-transparent"
              />
            </div>
            {toToken.price_usd && toAmount && (
              <div className="text-xs text-muted-foreground text-right mt-1">
                ≈ {formatUsd(parseFloat(toAmount) * toToken.price_usd)}
              </div>
            )}
          </Card>
        </div>

        {/* Swap Button */}
        <Button 
          onClick={handleSwap} 
          disabled={!isWalletConnected || isLoading || !fromAmount || !toAmount}
          className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing Payment...
            </>
          ) : !isWalletConnected ? (
            'Connect Riddle Wallet'
          ) : (
            <>
              <Zap className="mr-2 h-4 w-4" />
              Execute Instant Payment
            </>
          )}
        </Button>

        {!isWalletConnected && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Connect your Riddle wallet to execute Payment transactions on XRPL mainnet.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Token Search Modal */}
      <Dialog open={showTokenSearch !== null} onOpenChange={() => setShowTokenSearch(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Token</DialogTitle>
            <DialogDescription>
              Search and select a token for your {showTokenSearch === 'from' ? 'input' : 'output'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tokens (e.g., RDL, SOLO, USD)"
                value={tokenSearchQuery}
                onChange={(e) => setTokenSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="max-h-60 overflow-y-auto space-y-2">
              {isSearching ? (
                <div className="text-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Searching tokens...</p>
                </div>
              ) : searchResults.length > 0 ? (
                searchResults.map((token, index) => (
                  <button
                    key={`${token.symbol}-${token.issuer}-${index}`}
                    onClick={() => selectToken(token, showTokenSearch!)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-secondary rounded-lg transition-colors"
                  >
                    <TokenLogo token={token} size={32} className="rounded-full" />
                    <div className="flex-1 text-left">
                      <div className="font-semibold">{token.symbol}</div>
                      <div className="text-xs text-muted-foreground">
                        {token.name} • {token.verified ? 'Verified' : 'Unverified'}
                      </div>
                      {token.issuer && (
                        <div className="text-xs text-muted-foreground font-mono">
                          {token.issuer.substring(0, 8)}...{token.issuer.substring(token.issuer.length - 4)}
                        </div>
                      )}
                    </div>
                    {token.price_usd && (
                      <div className="text-right">
                        <div className="font-semibold">{formatUsd(token.price_usd)}</div>
                        {token.price_change_24h && (
                          <div className={`text-xs ${token.price_change_24h > 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {token.price_change_24h > 0 ? '+' : ''}{token.price_change_24h.toFixed(2)}%
                          </div>
                        )}
                      </div>
                    )}
                  </button>
                ))
              ) : tokenSearchQuery ? (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">No tokens found</p>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">Start typing to search tokens</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
