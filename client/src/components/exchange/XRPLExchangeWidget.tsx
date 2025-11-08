// XRPL Exchange Widget - Separate from Bridge
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowUpDown, TrendingUp, Zap } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface ExchangeQuote {
  success: boolean;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  outputAmount: string;
  exchangeRate: string;
  platformFee: string;
  priceImpact: string;
  route: string;
}

interface TradingPair {
  base: string;
  quote: string;
  quoteIssuer?: string;
}

export function XRPLExchangeWidget() {
  const [fromToken, setFromToken] = useState('XRP');
  const [toToken, setToToken] = useState('RDL');
  const [amount, setAmount] = useState('1');
  const [quote, setQuote] = useState<ExchangeQuote | null>(null);
  const [pairs, setPairs] = useState<TradingPair[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load trading pairs
  useEffect(() => {
    loadTradingPairs();
  }, []);

  // Get quote when inputs change
  useEffect(() => {
    if (amount && fromToken && toToken) {
      getQuote();
    }
  }, [amount, fromToken, toToken]);

  const loadTradingPairs = async () => {
    try {
      const response = await apiRequest('/api/exchange/pairs');
      const data = response.json ? await response.json() as any : response;
      if (data.success) {
        setPairs(data.pairs);
      }
    } catch (error) {
      console.error('Failed to load trading pairs:', error);
    }
  };

  const getQuote = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    
    setIsLoading(true);
    try {
      const selectedPair = pairs.find(p => 
        (p.base === fromToken && p.quote === toToken) ||
        (p.base === toToken && p.quote === fromToken)
      );

      const toIssuer = selectedPair?.quoteIssuer || 
        (toToken === 'RDL' ? 'r9xvnzUWZJpDu3NA6MKHmKhKJQTRqCRgu9' : '');

      const params = new URLSearchParams({
        fromToken,
        toToken,
        amount,
        ...(toIssuer && { toIssuer })
      });

      const response = await apiRequest(`/api/exchange/quote?${params}`);
      const data = response.json ? await response.json() as any : response;
      
      setQuote(data);
    } catch (error) {
      console.error('Failed to get quote:', error);
      setQuote(null);
    } finally {
      setIsLoading(false);
    }
  };

  const swapTokens = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
  };

  const availableTokens = ['XRP', 'RDL', 'SOLO', 'CORE'];

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5" />
          XRPL Exchange
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* From Token */}
        <div className="space-y-2">
          <label className="text-sm font-medium">From</label>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1"
            />
            <Select value={fromToken} onValueChange={setFromToken}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableTokens.map(token => (
                  <SelectItem key={token} value={token}>{token}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Swap Button */}
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={swapTokens}
            className="rounded-full p-2"
          >
            <ArrowUpDown className="w-4 h-4" />
          </Button>
        </div>

        {/* To Token */}
        <div className="space-y-2">
          <label className="text-sm font-medium">To</label>
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="0.0"
              value={quote?.outputAmount || ''}
              readOnly
              className="flex-1 bg-muted"
            />
            <Select value={toToken} onValueChange={setToToken}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableTokens.map(token => (
                  <SelectItem key={token} value={token}>{token}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Quote Details */}
        {quote && quote.success && (
          <div className="space-y-2 p-3 bg-muted/50 rounded-md">
            <div className="flex justify-between text-sm">
              <span>Exchange Rate:</span>
              <span>1 {fromToken} = {quote.exchangeRate} {toToken}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Platform Fee:</span>
              <span>{quote.platformFee} {toToken}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Route:</span>
              <span className="text-xs">{quote.route}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Price Impact:</span>
              <span className="text-green-600">{quote.priceImpact}</span>
            </div>
          </div>
        )}

        {/* Exchange Button */}
        <Button 
          className="w-full" 
          disabled={!quote?.success || isLoading}
        >
          {isLoading ? 'Getting Quote...' : 'Exchange Tokens'}
        </Button>

        {/* System Label */}
        <div className="text-xs text-center text-muted-foreground">
          XRPL Exchange System • Separate from Bridge
        </div>
      </CardContent>
    </Card>
  );
}
