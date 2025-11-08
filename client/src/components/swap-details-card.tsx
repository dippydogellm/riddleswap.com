import React from 'react';
import { Info, TrendingUp, Shield, Clock } from 'lucide-react';

interface SwapDetailsCardProps {
  exchangeRate: string;
  fromToken: any;
  toToken: any;
  slippage: string;
  fee: string;
  estimatedTime?: string;
  priceImpact?: string;
}

export const SwapDetailsCard: React.FC<SwapDetailsCardProps> = ({
  exchangeRate,
  fromToken,
  toToken,
  slippage,
  fee,
  estimatedTime = '~30 seconds',
  priceImpact = '< 0.1%'
}) => {
  if (!fromToken || !toToken) return null;

  return (
    <div className="swap-details-card">
      <div className="swap-details-header">
        <span className="swap-details-title">Transaction Details</span>
        <Info className="w-4 h-4 opacity-60" />
      </div>

      <div className="swap-details-content">
        <div className="swap-detail-row">
          <div className="swap-detail-label">
            <TrendingUp className="w-4 h-4" />
            <span>Exchange Rate</span>
          </div>
          <div className="swap-detail-value">
            {exchangeRate ? (
              <span className="exchange-rate-display">
                1 {fromToken.symbol} = {exchangeRate} {toToken.symbol}
              </span>
            ) : (
              <span className="animate-pulse">Calculating...</span>
            )}
          </div>
        </div>

        <div className="swap-detail-row">
          <div className="swap-detail-label">
            <Shield className="w-4 h-4" />
            <span>Max Slippage</span>
          </div>
          <div className="swap-detail-value">
            {slippage}%
          </div>
        </div>

        <div className="swap-detail-row">
          <div className="swap-detail-label">
            <span className="ml-6">Trading Fee</span>
          </div>
          <div className="swap-detail-value">
            {fee}
          </div>
        </div>

        <div className="swap-detail-row">
          <div className="swap-detail-label">
            <span className="ml-6">Price Impact</span>
          </div>
          <div className="swap-detail-value price-impact">
            {priceImpact}
          </div>
        </div>

        <div className="swap-detail-row">
          <div className="swap-detail-label">
            <Clock className="w-4 h-4" />
            <span>Estimated Time</span>
          </div>
          <div className="swap-detail-value">
            {estimatedTime}
          </div>
        </div>
      </div>
    </div>
  );
};
