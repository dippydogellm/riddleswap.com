import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Clock, Settings, ChevronDown, Wallet, RefreshCw, Search, Loader2, AlertTriangle, Calendar, X } from 'lucide-react';
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

interface LimitOrder {
  id: string;
  type: 'buy' | 'sell';
  fromToken: TokenSearchResult;
  toToken: TokenSearchResult;
  fromAmount: string;
  toAmount: string;
  rate: string;
  expiration: string;
  status: 'active' | 'filled' | 'cancelled' | 'expired';
  createdAt: string;
}

interface XRPLLimitOrdersProps {
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
      className={`${className} bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white font-bold text-sm`}
      style={{ width: size, height: size }}
    >
      {token.symbol.substring(0, 2)}
    </div>
  );
};

export default function XRPLLimitOrders({
  isWalletConnected,
  walletAddress,
  walletHandle,
  balance,
  totalBalance,
  reserve
}: XRPLLimitOrdersProps) {
  const { toast } = useToast();
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [customRate, setCustomRate] = useState('');
  const [expiration, setExpiration] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showTokenSearch, setShowTokenSearch] = useState<'from' | 'to' | null>(null);
  const [tokenSearchQuery, setTokenSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TokenSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [orders, setOrders] = useState<LimitOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Default tokens for limit orders - NO hardcoded prices, fetch live data
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

  // Load existing orders
  const loadOrders = async () => {
    if (!isWalletConnected || !walletAddress) return;
    
    setLoadingOrders(true);
    try {
      const response = await fetch(`/api/xrpl/offers/${walletAddress}`);
      const data = await response.json() as any;
      
      if (data.success) {
        setOrders(data.orders || []);
      }
    } catch (error) {
      console.error('Failed to load orders:', error);
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    loadOrders();
    
    // Refresh orders every 30 seconds
    const interval = setInterval(loadOrders, 30000);
    return () => clearInterval(interval);
  }, [isWalletConnected, walletAddress]);

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

  useEffect(() => {
    if (tokenSearchQuery) {
      const timeoutId = setTimeout(() => searchTokens(tokenSearchQuery), 300);
      return () => clearTimeout(timeoutId);
    } else {
      setSearchResults([]);
    }
  }, [tokenSearchQuery]);

  // Auto-calculate rate or amount based on inputs
  useEffect(() => {
    if (customRate && fromAmount && !toAmount) {
      const calculatedTo = (parseFloat(fromAmount) * parseFloat(customRate)).toFixed(8);
      setToAmount(calculatedTo);
    } else if (fromAmount && toAmount && !customRate) {
      const calculatedRate = (parseFloat(toAmount) / parseFloat(fromAmount)).toFixed(8);
      setCustomRate(calculatedRate);
    }
  }, [fromAmount, toAmount, customRate]);

  const handleCreateOrder = async () => {
    if (!isWalletConnected || !walletAddress || !fromAmount || !toAmount || !customRate) {
      toast({
        title: "Missing Information",
        description: "Please connect wallet and fill all required fields",
        variant: "destructive"
      });
      return;
    }

    const password = prompt('Enter your Riddle wallet password to confirm the OfferCreate transaction:');
    if (!password) return;

    setIsLoading(true);

    try {
      console.log('🔄 Creating XRPL OfferCreate transaction (limit order)...');
      
      // Calculate expiration timestamp (default 24 hours)
      const expirationTimestamp = expiration 
        ? Math.floor(new Date(expiration).getTime() / 1000)
        : Math.floor(Date.now() / 1000) + (24 * 60 * 60); // 24 hours from now
      
      // Use OfferCreate transaction based on attached documentation
      const orderResponse = await fetch('/api/xrpl/offer/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // OfferCreate transaction payload
          transactionType: 'OfferCreate',
          account: walletAddress,
          takerPays: toToken.symbol === 'XRP' 
            ? (parseFloat(toAmount) * 1000000).toString() // Convert XRP to drops
            : {
                currency: toToken.symbol,
                issuer: toToken.issuer,
                value: toAmount
              },
          takerGets: fromToken.symbol === 'XRP' 
            ? (parseFloat(fromAmount) * 1000000).toString() // Convert XRP to drops  
            : {
                currency: fromToken.symbol,
                issuer: fromToken.issuer,
                value: fromAmount
              },
          flags: 0x00020000, // tfPartialPayment flag
          expiration: expirationTimestamp,
          walletAddress,
          walletType: 'riddle',
          riddleWalletId: walletHandle,
          password,
          customRate: customRate
        })
      });

      const orderData = await orderResponse.json();
      
      if (orderData.success) {
        toast({
          title: "Limit Order Created!",
          description: `Order placed: ${fromAmount} ${fromToken.symbol} → ${toAmount} ${toToken.symbol} at rate ${customRate}`,
        });
        
        // Reset form
        setFromAmount('');
        setToAmount('');
        setCustomRate('');
        setExpiration('');
        
        // Refresh orders
        loadOrders();
      } else {
        throw new Error(orderData.error || 'OfferCreate transaction failed');
      }
      
    } catch (error) {
      console.error('Limit order creation failed:', error);
      toast({
        title: "Order Creation Failed",
        description: error instanceof Error ? error.message : 'OfferCreate transaction failed',
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const cancelOrder = async (orderId: string) => {
    const password = prompt('Enter password to cancel this limit order:');
    if (!password) return;

    try {
      const response = await fetch(`/api/xrpl/offer/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offerId: orderId,
          walletAddress,
          riddleWalletId: walletHandle,
          password
        })
      });

      const data = await response.json() as any;
      if (data.success) {
        toast({
          title: "Order Cancelled",
          description: "Limit order has been cancelled successfully"
        });
        loadOrders();
      } else {
        throw new Error(data.error || 'Failed to cancel order');
      }
    } catch (error) {
      toast({
        title: "Cancellation Failed",
        description: error instanceof Error ? error.message : 'Failed to cancel order',
        variant: "destructive"
      });
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
    
    // Clear calculations when tokens change
    setCustomRate('');
    setToAmount('');
  };

  return (
    <>
      <div className="space-y-6">
        {/* Create Limit Order */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Create Limit Order</h3>
            <Badge variant="outline" className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              OfferCreate
            </Badge>
          </div>

          {/* From Token (TakerGets) */}
          <div className="space-y-2">
            <Label htmlFor="fromAmount">You Offer (TakerGets)</Label>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowTokenSearch('from')}
                  className="flex items-center gap-2 hover:bg-secondary/50 rounded-lg p-2 transition-colors"
                >
                  <TokenLogo token={fromToken} size={32} className="rounded-full" />
                  <div className="text-left">
                    <div className="font-semibold">{fromToken.symbol}</div>
                  </div>
                  <ChevronDown className="h-4 w-4" />
                </button>
                <Input
                  id="fromAmount"
                  type="number"
                  placeholder="0.00"
                  value={fromAmount}
                  onChange={(e) => setFromAmount(e.target.value)}
                  className="text-right text-lg font-semibold border-0 shadow-none bg-transparent"
                />
              </div>
            </Card>
          </div>

          {/* Exchange Rate */}
          <div className="space-y-2">
            <Label htmlFor="rate">Exchange Rate (1 {fromToken.symbol} = ? {toToken.symbol})</Label>
            <Input
              id="rate"
              type="number"
              placeholder="Enter custom rate"
              value={customRate}
              onChange={(e) => setCustomRate(e.target.value)}
              className="text-center font-mono"
            />
          </div>

          {/* To Token (TakerPays) */}
          <div className="space-y-2">
            <Label htmlFor="toAmount">You Want (TakerPays)</Label>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowTokenSearch('to')}
                  className="flex items-center gap-2 hover:bg-secondary/50 rounded-lg p-2 transition-colors"
                >
                  <TokenLogo token={toToken} size={32} className="rounded-full" />
                  <div className="text-left">
                    <div className="font-semibold">{toToken.symbol}</div>
                  </div>
                  <ChevronDown className="h-4 w-4" />
                </button>
                <Input
                  id="toAmount"
                  type="number"
                  placeholder="0.00"
                  value={toAmount}
                  onChange={(e) => setToAmount(e.target.value)}
                  className="text-right text-lg font-semibold border-0 shadow-none bg-transparent"
                />
              </div>
            </Card>
          </div>

          {/* Expiration */}
          <div className="space-y-2">
            <Label htmlFor="expiration">Expiration (Optional)</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="expiration"
                type="datetime-local"
                value={expiration}
                onChange={(e) => setExpiration(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className="pl-10"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Leave empty for 24-hour expiration. Orders expire automatically if not filled.
            </p>
          </div>

          {/* Create Order Button */}
          <Button 
            onClick={handleCreateOrder}
            disabled={!isWalletConnected || isLoading || !fromAmount || !toAmount || !customRate}
            className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Offer...
              </>
            ) : !isWalletConnected ? (
              'Connect Riddle Wallet'
            ) : (
              <>
                <Clock className="mr-2 h-4 w-4" />
                Create Limit Order
              </>
            )}
          </Button>
        </div>

        {/* Active Orders */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Your Limit Orders</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={loadOrders}
              disabled={loadingOrders}
            >
              {loadingOrders ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>

          {orders.length === 0 ? (
            <Card className="p-6 text-center">
              <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-muted-foreground">
                {loadingOrders ? 'Loading orders...' : 'No limit orders found'}
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <Card key={order.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <TokenLogo token={order.fromToken} size={24} className="rounded-full" />
                        <span className="font-medium">{order.fromAmount} {order.fromToken.symbol}</span>
                      </div>
                      <span className="text-muted-foreground">→</span>
                      <div className="flex items-center gap-2">
                        <TokenLogo token={order.toToken} size={24} className="rounded-full" />
                        <span className="font-medium">{order.toAmount} {order.toToken.symbol}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        order.status === 'active' ? 'default' :
                        order.status === 'filled' ? 'default' :
                        order.status === 'cancelled' ? 'secondary' : 'destructive'
                      }>
                        {order.status}
                      </Badge>
                      {order.status === 'active' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => cancelOrder(order.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    Rate: {order.rate} | Expires: {new Date(order.expiration).toLocaleString()}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {!isWalletConnected && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Connect your Riddle wallet to create and manage OfferCreate limit orders on XRPL.
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
              Search and select a token for your {showTokenSearch === 'from' ? 'offer (TakerGets)' : 'request (TakerPays)'}
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
