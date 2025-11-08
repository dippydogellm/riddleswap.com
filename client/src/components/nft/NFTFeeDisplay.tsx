import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  DollarSign, 
  Percent, 
  Clock, 
  AlertTriangle,
  Info,
  TrendingUp,
  Users,
  Zap
} from 'lucide-react';

export interface NFTFeeBreakdown {
  transactionType: 'buy_offer' | 'sell_offer' | 'accept_offer' | 'transfer';
  nftokenID: string;
  baseAmount: string;
  
  networkFee: string;
  brokerFee: string;
  royaltyFee: string;
  totalFees: string;
  
  grossAmount: string;
  netAmount: string;
  
  brokerFeePercentage: number;
  royaltyPercentage: number;
  
  amountXRP: string;
  feesXRP: string;
  grossAmountXRP: string;
  netAmountXRP: string;
  
  isBrokered: boolean;
  hasRoyalties: boolean;
  
  brokerAddress?: string;
  royaltyRecipient?: string;
  estimatedConfirmationTime: string;
}

interface NFTFeeDisplayProps {
  feeBreakdown: NFTFeeBreakdown;
  showDetailedBreakdown?: boolean;
  variant?: 'compact' | 'detailed';
  className?: string;
}

export function NFTFeeDisplay({ 
  feeBreakdown, 
  showDetailedBreakdown = true,
  variant = 'detailed',
  className = '' 
}: NFTFeeDisplayProps) {
  const {
    transactionType,
    amountXRP,
    feesXRP,
    grossAmountXRP,
    netAmountXRP,
    brokerFeePercentage,
    royaltyPercentage,
    isBrokered,
    hasRoyalties,
    estimatedConfirmationTime,
    brokerAddress,
    royaltyRecipient
  } = feeBreakdown;

  const getTransactionTypeLabel = () => {
    switch (transactionType) {
      case 'buy_offer': return 'Buy Offer';
      case 'sell_offer': return 'Sell Offer';
      case 'accept_offer': return 'Accept Offer';
      case 'transfer': return 'Transfer';
      default: return 'Transaction';
    }
  };

  const formatXRP = (amount: string) => {
    const num = parseFloat(amount);
    return num.toFixed(6).replace(/\.?0+$/, '');
  };

  if (variant === 'compact') {
    return (
      <Card className={`w-full ${className}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-600" />
              <span className="font-medium">Total Cost</span>
            </div>
            <div className="text-right">
              <div className="font-bold text-lg">{formatXRP(grossAmountXRP)} XRP</div>
              <div className="text-xs text-muted-foreground">
                Includes {formatXRP(feesXRP)} XRP in fees
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`w-full ${className}`} data-testid="nft-fee-display">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          {getTransactionTypeLabel()} - Fee Breakdown
          {isBrokered && (
            <Badge variant="secondary" className="ml-2">
              <Users className="w-3 h-3 mr-1" />
              Brokered
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Main Amount Display */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Base Amount</label>
              <div className="text-xl font-bold" data-testid="base-amount">
                {formatXRP(amountXRP)} XRP
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Total Cost</label>
              <div className="text-xl font-bold text-red-600" data-testid="total-cost">
                {formatXRP(grossAmountXRP)} XRP
              </div>
            </div>
          </div>
        </div>

        {showDetailedBreakdown && (
          <>
            <Separator />
            
            {/* Fee Breakdown */}
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <Percent className="w-4 h-4" />
                Fee Breakdown
              </h4>
              
              {/* Network Fee */}
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-blue-500" />
                  <span>Network Fee</span>
                  <Badge variant="outline" className="text-xs">Required</Badge>
                </div>
                <div className="font-mono" data-testid="network-fee">
                  {formatXRP((parseFloat(feeBreakdown.networkFee) / 1000000).toString())} XRP
                </div>
              </div>

              {/* Broker Fee */}
              {isBrokered && parseFloat(feeBreakdown.brokerFee) > 0 && (
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-purple-500" />
                    <span>Marketplace Fee</span>
                    <Badge variant="outline" className="text-xs">
                      {brokerFeePercentage}%
                    </Badge>
                  </div>
                  <div className="font-mono" data-testid="broker-fee">
                    {formatXRP((parseFloat(feeBreakdown.brokerFee) / 1000000).toString())} XRP
                  </div>
                </div>
              )}

              {/* Royalty Fee */}
              {hasRoyalties && parseFloat(feeBreakdown.royaltyFee) > 0 && (
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-orange-500" />
                    <span>Creator Royalty</span>
                    <Badge variant="outline" className="text-xs">
                      {royaltyPercentage.toFixed(1)}%
                    </Badge>
                  </div>
                  <div className="font-mono" data-testid="royalty-fee">
                    {formatXRP((parseFloat(feeBreakdown.royaltyFee) / 1000000).toString())} XRP
                  </div>
                </div>
              )}

              <Separator />
              
              {/* Total Fees */}
              <div className="flex items-center justify-between py-2 font-semibold">
                <span>Total Fees</span>
                <div className="font-mono text-red-600" data-testid="total-fees">
                  {formatXRP(feesXRP)} XRP
                </div>
              </div>
            </div>

            <Separator />

            {/* Net Amount */}
            {transactionType === 'accept_offer' && (
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-green-700 dark:text-green-300">
                    You Will Receive
                  </span>
                  <div className="font-bold text-green-700 dark:text-green-300" data-testid="net-amount">
                    {formatXRP(netAmountXRP)} XRP
                  </div>
                </div>
              </div>
            )}

            {/* Additional Information */}
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>Estimated confirmation: {estimatedConfirmationTime}</span>
              </div>
              
              {isBrokered && brokerAddress && (
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span>Broker: {brokerAddress.slice(0, 8)}...{brokerAddress.slice(-6)}</span>
                </div>
              )}
              
              {hasRoyalties && royaltyRecipient && (
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  <span>Royalty to: {royaltyRecipient.slice(0, 8)}...{royaltyRecipient.slice(-6)}</span>
                </div>
              )}
            </div>

            {/* Important Notice */}
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <div className="text-sm">
                  <div className="font-medium text-yellow-700 dark:text-yellow-300 mb-1">
                    Important
                  </div>
                  <div className="text-yellow-600 dark:text-yellow-400">
                    All fees are automatically deducted from your transaction. 
                    {hasRoyalties && ' Creator royalties are paid automatically by the XRPL.'}
                    {isBrokered && ' Marketplace fees ensure secure brokered transactions.'}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default NFTFeeDisplay;
