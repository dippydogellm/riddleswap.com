import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowDownUp, Settings, ChevronDown, Wallet, TrendingUp, RefreshCw, Zap, Star, Lock, Search, Loader2, AlertTriangle, CheckCircle, Clock, Send, ArrowRight, ExternalLink, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface TokenBalance {
  currency: string;
  issuer: string;
  balance: string;
  limit: string;
  logo_url?: string;
  icon_url?: string;
}

interface XRPWalletExchangeProps {
  walletAddress: string | null;
  walletHandle: string | null;
  balance: string;
  tokenBalances: TokenBalance[];
  onBalanceUpdate: () => void;
}

export default function XRPWalletExchange({ 
  walletAddress, 
  walletHandle, 
  balance,
  tokenBalances,
  onBalanceUpdate 
}: XRPWalletExchangeProps) {
  const { toast } = useToast();
  const [fromToken, setFromToken] = useState<string>('XRP');
  const [toToken, setToToken] = useState<string>('');
  const [fromAmount, setFromAmount] = useState<string>('');
  const [toAmount, setToAmount] = useState<string>('');
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [isGettingQuote, setIsGettingQuote] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [slippage, setSlippage] = useState<string>('5');

  // Available tokens from wallet balances only (no hardcoded tokens)
  const availableTokens = tokenBalances.filter(t => parseFloat(t.balance) > 0);

  const formatBalance = (bal: string): string => {
    const num = parseFloat(bal);
    if (num === 0) return '0';
    if (num < 0.001) return num.toExponential(3);
    if (num < 1) return num.toFixed(6);
    if (num < 1000) return num.toFixed(4);
    if (num < 1000000) return (num / 1000).toFixed(2) + 'K';
    return (num / 1000000).toFixed(2) + 'M';
  };

  const TokenLogo = ({ token, size = 24 }: { token: any; size?: number }) => {
    const [imageError, setImageError] = useState(false);
    const logoUrl = token.logo_url || token.icon_url;
    
    if (logoUrl && !imageError) {
      return (
        <img 
          src={logoUrl} 
          alt={token.symbol || token.currency}
          width={size}
          height={size}
          className="rounded-full object-cover bg-secondary/20"
          onError={() => setImageError(true)}
          loading="lazy"
        />
      );
    }
    
    return (
      <div 
        className="bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs rounded-full border border-border/20"
        style={{ width: size, height: size }}
      >
        {(token.symbol || token.currency).substring(0, 2).toUpperCase()}
      </div>
    );
  };

  const getQuote = async () => {
    if (!fromAmount || !fromToken || !toToken || !walletAddress) return;

    setIsGettingQuote(true);
    
    try {
      const fromTokenData = availableTokens.find(t => 
        (t.symbol || t.currency) === fromToken
      );
      const toTokenData = availableTokens.find(t => 
        (t.symbol || t.currency) === toToken
      );

      if (!fromTokenData || !toTokenData) {
        throw new Error('Token not found');
      }

      const response = await fetch('/api/xrpl-exchange/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromToken: fromTokenData.symbol || fromTokenData.currency,
          toToken: toTokenData.symbol || toTokenData.currency,
          fromIssuer: fromTokenData.issuer,
          toIssuer: toTokenData.issuer,
          amount: fromAmount
        })
      });

      const data = await response.json() as any;
      
      if (data.success) {
        setToAmount(data.quote.deliverAmount.toString());
        setExchangeRate(data.quote.exchangeRate);
      } else {
        throw new Error(data.error || 'Failed to get quote');
      }
    } catch (error) {
      console.error('Quote error:', error);
      toast({
        title: "Quote Failed",
        description: error instanceof Error ? error.message : "Failed to get exchange quote",
        variant: "destructive",
      });
    } finally {
      setIsGettingQuote(false);
    }
  };

  const executeSwap = async () => {
    if (!fromAmount || !fromToken || !toToken || !walletAddress || !walletHandle) return;

    setIsSwapping(true);
    
    try {
      const fromTokenData = availableTokens.find(t => 
        (t.symbol || t.currency) === fromToken
      );
      const toTokenData = availableTokens.find(t => 
        (t.symbol || t.currency) === toToken
      );

      if (!fromTokenData || !toTokenData) {
        throw new Error('Token not found');
      }

      const response = await fetch('/api/xrpl-exchange/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromToken: fromTokenData.symbol || fromTokenData.currency,
          toToken: toTokenData.symbol || toTokenData.currency,
          fromIssuer: fromTokenData.issuer,
          toIssuer: toTokenData.issuer,
          amount: fromAmount,
          walletHandle: walletHandle,
          slippage: parseFloat(slippage)
        })
      });

      const data = await response.json() as any;
      
      if (data.success) {
        toast({
          title: "Swap Successful!",
          description: `Swapped ${fromAmount} ${fromToken} for ${data.deliveredAmount} ${toToken}`,
          variant: "default",
        });
        
        // Reset form
        setFromAmount('');
        setToAmount('');
        setExchangeRate(null);
        
        // Refresh balances
        onBalanceUpdate();
      } else {
        throw new Error(data.error || 'Swap failed');
      }
    } catch (error) {
      console.error('Swap error:', error);
      toast({
        title: "Swap Failed",
        description: error instanceof Error ? error.message : "Failed to execute swap",
        variant: "destructive",
      });
    } finally {
      setIsSwapping(false);
    }
  };

  // Auto-quote when inputs change
  useEffect(() => {
    if (fromAmount && fromToken && toToken) {
      const timer = setTimeout(() => {
        getQuote();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [fromAmount, fromToken, toToken]);

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Exchange Tokens</CardTitle>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {showSettings && (
          <Card className="p-3 bg-secondary/20">
            <div className="space-y-2">
              <label className="text-sm font-medium">Slippage Tolerance</label>
              <div className="flex gap-2">
                {['1', '3', '5', '10'].map((val) => (
                  <Button
                    key={val}
                    variant={slippage === val ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSlippage(val)}
                  >
                    {val}%
                  </Button>
                ))}
                <Input
                  type="number"
                  value={slippage}
                  onChange={(e) => setSlippage(e.target.value)}
                  className="w-16 h-8"
                  min="0.1"
                  max="50"
                  step="0.1"
                />
              </div>
            </div>
          </Card>
        )}

        {/* From Token */}
        <div className="space-y-2">
          <label className="text-sm font-medium">From</label>
          <div className="relative">
            <Select value={fromToken} onValueChange={setFromToken}>
              <SelectTrigger>
                <SelectValue placeholder="Select token" />
              </SelectTrigger>
              <SelectContent>
                {availableTokens.map((token, index) => (
                  <SelectItem key={index} value={token.symbol || token.currency}>
                    <div className="flex items-center gap-2">
                      <TokenLogo token={token} size={20} />
                      <span>{token.symbol || token.currency}</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {formatBalance(token.balance)}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input
            type="number"
            placeholder="0.0"
            value={fromAmount}
            onChange={(e) => setFromAmount(e.target.value)}
            className="text-lg"
          />
        </div>

        {/* Swap Direction Button */}
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full w-10 h-10 p-0"
            onClick={() => {
              const temp = fromToken;
              setFromToken(toToken);
              setToToken(temp);
              const tempAmount = fromAmount;
              setFromAmount(toAmount);
              setToAmount(tempAmount);
            }}
          >
            <ArrowDownUp className="h-4 w-4" />
          </Button>
        </div>

        {/* To Token */}
        <div className="space-y-2">
          <label className="text-sm font-medium">To</label>
          <div className="relative">
            <Select value={toToken} onValueChange={setToToken}>
              <SelectTrigger>
                <SelectValue placeholder="Select token" />
              </SelectTrigger>
              <SelectContent>
                {availableTokens
                  .filter(token => (token.symbol || token.currency) !== fromToken)
                  .map((token, index) => (
                    <SelectItem key={index} value={token.symbol || token.currency}>
                      <div className="flex items-center gap-2">
                        <TokenLogo token={token} size={20} />
                        <span>{token.symbol || token.currency}</span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {formatBalance(token.balance)}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="relative">
            <Input
              type="number"
              placeholder="0.0"
              value={toAmount}
              readOnly
              className="text-lg bg-secondary/20"
            />
            {isGettingQuote && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}
          </div>
        </div>

        {/* Exchange Rate */}
        {exchangeRate && (
          <div className="text-sm text-muted-foreground text-center">
            1 {fromToken} = {exchangeRate.toFixed(6)} {toToken}
          </div>
        )}

        {/* Swap Button */}
        <Button
          onClick={executeSwap}
          disabled={!fromAmount || !toAmount || isSwapping || !walletAddress}
          className="w-full"
          size="lg"
        >
          {isSwapping ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Swapping...
            </div>
          ) : (
            'Swap Tokens'
          )}
        </Button>

        {!walletAddress && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Please connect your wallet to use the exchange
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
