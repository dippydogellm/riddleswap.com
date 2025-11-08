// Bridge Details Dropdown - Enhanced transaction display with all requested fields
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, ArrowRight, Wallet, Calculator, DollarSign, Target } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface BridgeDetailsData {
  // Bridge amount - chain - token
  bridgeAmount: string;
  fromChain: string;
  fromToken: string;
  
  // Bridge fee
  bridgeFee: string;
  
  // Total payment
  totalPayment: string;
  
  // USD value
  usdValue: string;
  
  // Receive amount - chain token
  receiveAmount: string;
  toChain: string;
  toToken: string;
  
  // Additional data
  exchangeRate?: number;
  priceData?: {
    fromTokenUSD: number;
    toTokenUSD: number;
  };
}

interface BridgeDetailsDropdownProps {
  isOpen: boolean;
  onToggle: () => void;
  bridgeData: BridgeDetailsData | null;
  loading?: boolean;
  onConfirm?: () => void;
  confirmText?: string;
}

export function BridgeDetailsDropdown({
  isOpen,
  onToggle,
  bridgeData,
  loading = false,
  onConfirm,
  confirmText = 'Confirm Bridge'
}: BridgeDetailsDropdownProps) {
  const [priceChange, setPriceChange] = useState<number>(0);

  // Calculate price change percentage if exchange rate data available
  useEffect(() => {
    if (bridgeData?.priceData) {
      const { fromTokenUSD, toTokenUSD } = bridgeData.priceData;
      const change = ((toTokenUSD - fromTokenUSD) / fromTokenUSD) * 100;
      setPriceChange(change);
    }
  }, [bridgeData]);

  if (!bridgeData) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Bridge Details</span>
            <Button variant="ghost" size="sm" onClick={onToggle}>
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CardTitle>
        </CardHeader>
        {isOpen && (
          <CardContent>
            <div className="text-center py-6 text-muted-foreground">
              Enter bridge amount to see details
            </div>
          </CardContent>
        )}
      </Card>
    );
  }

  return (
    <Card className="w-full border-2 border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Bridge Transaction Details
          </span>
          <Button variant="ghost" size="sm" onClick={onToggle}>
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CardTitle>
      </CardHeader>
      
      {isOpen && (
        <CardContent className="space-y-6">
          {/* Bridge Amount - Chain - Token */}
          <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900 dark:text-blue-100">Bridge Amount</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                {bridgeData.bridgeAmount}
              </span>
              <Badge variant="outline" className="bg-white dark:bg-gray-800">
                {bridgeData.fromChain}
              </Badge>
              <Badge variant="secondary">
                {bridgeData.fromToken}
              </Badge>
            </div>
          </div>

          {/* Exchange Rate Display */}
          {bridgeData.exchangeRate && (
            <div className="flex items-center justify-center gap-2 py-2">
              <Badge variant="outline" className="text-xs">
                1 {bridgeData.fromToken} = {bridgeData.exchangeRate.toFixed(6)} {bridgeData.toToken}
              </Badge>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          )}

          {/* Bridge Fee */}
          <div className="bg-orange-50 dark:bg-orange-950/20 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Calculator className="h-4 w-4 text-orange-600" />
              <span className="text-sm font-medium text-orange-900 dark:text-orange-100">Bridge Fee (1%)</span>
            </div>
            <div className="text-xl font-semibold text-orange-900 dark:text-orange-100">
              {bridgeData.bridgeFee} {bridgeData.toToken}
            </div>
          </div>

          <Separator />

          {/* Total Payment */}
          <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-900 dark:text-green-100">Total Payment</span>
            </div>
            <div className="text-2xl font-bold text-green-900 dark:text-green-100">
              {bridgeData.totalPayment} {bridgeData.fromToken}
            </div>
            <div className="text-sm text-green-700 dark:text-green-300 mt-1">
              ≈ ${bridgeData.usdValue} USD
            </div>
          </div>

          <Separator />

          {/* Receive Amount - Chain Token */}
          <div className="bg-purple-50 dark:bg-purple-950/20 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-900 dark:text-purple-100">You Will Receive</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                {bridgeData.receiveAmount}
              </span>
              <Badge variant="outline" className="bg-white dark:bg-gray-800">
                {bridgeData.toChain}
              </Badge>
              <Badge variant="secondary">
                {bridgeData.toToken}
              </Badge>
            </div>
          </div>

          {/* Price Change Indicator */}
          {priceChange !== 0 && (
            <Alert>
              <AlertDescription className="flex items-center gap-2">
                <span className={`text-sm ${priceChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  Price change: {priceChange > 0 ? '+' : ''}{priceChange.toFixed(2)}% in the last 24h
                </span>
              </AlertDescription>
            </Alert>
          )}

          {/* Confirmation Button */}
          {onConfirm && (
            <div className="pt-4">
              <Button 
                onClick={onConfirm} 
                className="w-full" 
                size="lg"
                disabled={loading}
              >
                {loading ? 'Processing...' : confirmText}
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
