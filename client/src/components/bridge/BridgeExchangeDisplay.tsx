// Bridge Exchange Rate Display Component with clear fee visibility
import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, ArrowRight, Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface ExchangeRate {
  fromToken: string;
  toToken: string;
  rate: number;
  usdPrice: {
    from: number;
    to: number;
  };
  platformFee: number;
  totalFee: number;
  outputAmount: number;
  feeAmount: number;
  paymentAmount?: number;
  displayText?: string;
  source: string;
  timestamp: number;
}

interface BridgeExchangeDisplayProps {
  fromToken: string;
  toToken: string;
  amount: number;
  onRateUpdate?: (rate: ExchangeRate) => void;
  showDetails?: boolean;
}

export function BridgeExchangeDisplay({
  fromToken,
  toToken,
  amount,
  onRateUpdate,
  showDetails = true
}: BridgeExchangeDisplayProps) {
  const [exchangeRate, setExchangeRate] = useState<ExchangeRate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Fetch exchange rate with simplified fee structure
  const fetchExchangeRate = async () => {
    if (!fromToken || !toToken || amount <= 0) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `/api/bridge/exchange-rate?from=${fromToken}&to=${toToken}&amount=${amount}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch exchange rate');
      }
      
      const data = await response.json() as any;
      
      if (data.success !== false) {
        // Transform data for simplified XRP bridge structure
        const isXRPBridge = fromToken === 'XRP';
        const feeAmount = isXRPBridge ? amount * 0.01 : data.feeAmount;
        const paymentAmount = isXRPBridge ? amount + feeAmount : amount;
        
        const transformedData = {
          ...data,
          paymentAmount,
          feeAmount,
          displayText: isXRPBridge 
            ? `Pay ${paymentAmount.toFixed(6)} ${fromToken} (${amount} + ${feeAmount.toFixed(6)} fee)`
            : `${amount} ${fromToken} → ${data.outputAmount || (amount * data.rate).toFixed(6)} ${toToken}`
        };
        setExchangeRate(transformedData);
        setLastUpdate(new Date());
        onRateUpdate?.(transformedData);
      } else {
        throw new Error(data.error || 'Failed to get exchange rate');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch exchange rate');
      console.error('Exchange rate error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh every 30 seconds
  useEffect(() => {
    fetchExchangeRate();
    const interval = setInterval(fetchExchangeRate, 30000);
    return () => clearInterval(interval);
  }, [fromToken, toToken, amount]);

  // Format numbers for display
  const formatNumber = (num: number, decimals: number = 6) => {
    if (num < 0.000001) return num.toExponential(2);
    if (num < 1) return num.toFixed(decimals);
    if (num < 1000) return num.toFixed(4);
    return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
  };

  const formatUSD = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: num < 0.01 ? 6 : 2
    }).format(num);
  };

  if (loading && !exchangeRate) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>Fetching live exchange rates...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!exchangeRate) return null;

  return (
    <Card className="w-full">
      <CardContent className="pt-6 space-y-4">
        {/* Main Exchange Display */}
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="text-sm text-muted-foreground">
              {fromToken === 'XRP' ? 'Total You Pay' : 'You Send'}
            </div>
            <div className="text-2xl font-bold">
              {fromToken === 'XRP' 
                ? `${formatNumber(exchangeRate.paymentAmount || (amount + amount * 0.01))} ${fromToken}`
                : `${formatNumber(amount)} ${fromToken}`
              }
            </div>
            <div className="text-sm text-muted-foreground">
              {fromToken === 'XRP'
                ? formatUSD((exchangeRate.paymentAmount || (amount + amount * 0.01)) * exchangeRate.usdPrice.from)
                : formatUSD(amount * exchangeRate.usdPrice.from)
              }
            </div>
          </div>
          
          <ArrowRight className="h-6 w-6 mx-4 text-muted-foreground" />
          
          <div className="flex-1 text-right">
            <div className="text-sm text-muted-foreground">Total You Get</div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatNumber(exchangeRate.outputAmount)} {toToken}
            </div>
            <div className="text-sm text-muted-foreground">
              {formatUSD(exchangeRate.outputAmount * exchangeRate.usdPrice.to)}
            </div>
            {fromToken === 'XRP' && (
              <div className="text-xs text-green-700 dark:text-green-300 mt-1">
                Full output amount (no deduction)
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Simplified XRP Bridge Fee Display */}
        <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800 dark:text-orange-200">
            <div className="font-semibold mb-1">1% Platform Fee</div>
            {fromToken === 'XRP' ? (
              <div className="text-sm space-y-1">
                <div>Base Amount: {formatNumber(amount)} {fromToken} = {formatUSD(amount * exchangeRate.usdPrice.from)}</div>
                <div>Platform Fee: {formatNumber(exchangeRate.feeAmount || amount * 0.01)} {fromToken} = {formatUSD((exchangeRate.feeAmount || amount * 0.01) * exchangeRate.usdPrice.from)}</div>
                <div className="font-medium text-orange-900 dark:text-orange-100">
                  Total Payment: {formatNumber(exchangeRate.paymentAmount || (amount + amount * 0.01))} {fromToken} = {formatUSD((exchangeRate.paymentAmount || (amount + amount * 0.01)) * exchangeRate.usdPrice.from)}
                </div>
              </div>
            ) : (
              <div className="text-sm space-y-1">
                <div>Fee Amount: {formatNumber(exchangeRate.feeAmount)} {toToken}</div>
                <div>Fee Value: {formatUSD(exchangeRate.feeAmount * exchangeRate.usdPrice.to)}</div>
              </div>
            )}
          </AlertDescription>
        </Alert>

        {showDetails && (
          <>
            <Separator />
            
            {/* Exchange Rate Details */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Exchange Rate</span>
                <span className="font-medium">
                  1 {fromToken} = {formatNumber(exchangeRate.rate)} {toToken}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-muted-foreground">{fromToken} Price</span>
                <span className="font-medium flex items-center gap-1">
                  {formatUSD(exchangeRate.usdPrice.from)}
                  {exchangeRate.usdPrice.from > 0 && (
                    exchangeRate.usdPrice.from > exchangeRate.usdPrice.to ? 
                      <TrendingUp className="h-3 w-3 text-green-500" /> : 
                      <TrendingDown className="h-3 w-3 text-red-500" />
                  )}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-muted-foreground">{toToken} Price</span>
                <span className="font-medium">
                  {formatUSD(exchangeRate.usdPrice.to)}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-muted-foreground">Price Source</span>
                <Badge variant="outline" className="text-xs">
                  {exchangeRate.source}
                </Badge>
              </div>
              
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Updated</span>
                <span className="text-xs">
                  {lastUpdate.toLocaleTimeString()}
                </span>
              </div>
            </div>
          </>
        )}

        {/* Total Summary - XRP Simplified Structure */}
        <Separator />
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="flex justify-between items-center">
            <span className="font-medium">Total You Pay</span>
            <div className="text-right">
              <div className="font-bold text-lg">
                {fromToken === 'XRP' 
                  ? `${formatNumber(exchangeRate.paymentAmount || (amount + amount * 0.01))} ${fromToken}`
                  : `${formatNumber(amount)} ${fromToken}`
                }
              </div>
              <div className="text-sm text-muted-foreground">
                {fromToken === 'XRP'
                  ? formatUSD((exchangeRate.paymentAmount || (amount + amount * 0.01)) * exchangeRate.usdPrice.from)
                  : formatUSD(amount * exchangeRate.usdPrice.from)
                }
              </div>
              {fromToken === 'XRP' && (
                <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                  Includes {formatNumber(exchangeRate.feeAmount || amount * 0.01)} {fromToken} fee
                </div>
              )}
            </div>
          </div>
          
          <div className="flex justify-between items-center mt-2 pt-2 border-t">
            <span className="font-medium">Total You Get</span>
            <div className="text-right">
              <div className="font-bold text-lg text-green-600 dark:text-green-400">
                {formatNumber(exchangeRate.outputAmount)} {toToken}
              </div>
              <div className="text-sm text-muted-foreground">
                {formatUSD(exchangeRate.outputAmount * exchangeRate.usdPrice.to)}
              </div>
              {fromToken === 'XRP' && (
                <div className="text-xs text-green-700 dark:text-green-300 mt-1">
                  Full amount (no deduction from output)
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
