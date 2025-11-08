import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, RefreshCw, Eye, EyeOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSession } from '@/utils/sessionManager';

interface ChainBalance {
  chain: string;
  balance: string;
  usdValue: number;
  nativeSymbol: string;
}

interface BalanceResponse {
  totalUsd: number;
  chains: ChainBalance[];
}

interface TotalBalanceDisplayProps {
  compact?: boolean;
  className?: string;
}

export function TotalBalanceDisplay({ compact = false, className }: TotalBalanceDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const session = useSession();

  const { data, isLoading, refetch, isFetching } = useQuery<BalanceResponse>({
    queryKey: ['/api/wallet/total-balance'],
    enabled: session.isLoggedIn && session.hasWalletData,
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 10000,
  });

  const formatUSD = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatCompactUSD = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    }
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}K`;
    }
    return formatUSD(amount);
  };

  // If not logged in, don't show anything
  if (!session.isLoggedIn || !session.hasWalletData) {
    return null;
  }

  const totalBalance = data?.totalUsd || 0;
  const displayBalance = compact ? formatCompactUSD(totalBalance) : formatUSD(totalBalance);

  return (
    <div className={cn("relative", className)}>
      {/* Main Balance Display */}
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all",
          "bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30",
          "border border-blue-200 dark:border-blue-800",
          "hover:border-blue-300 dark:hover:border-blue-700",
          "group"
        )}
      >
        {/* Balance Text */}
        <div 
          className="flex items-center gap-1.5 cursor-pointer flex-1" 
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
            {compact ? "Balance" : "Total Balance"}:
          </span>
          <span className="text-sm font-bold text-gray-900 dark:text-white">
            {isHidden ? '••••••' : displayBalance}
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1">
          {/* Hide/Show Toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsHidden(!isHidden);
            }}
            className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
          >
            {isHidden ? (
              <EyeOff className="h-3 w-3 text-gray-500 dark:text-gray-400" />
            ) : (
              <Eye className="h-3 w-3 text-gray-500 dark:text-gray-400" />
            )}
          </button>

          {/* Refresh Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              refetch();
            }}
            disabled={isFetching}
            className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn(
              "h-3 w-3 text-gray-500 dark:text-gray-400",
              isFetching && "animate-spin"
            )} />
          </button>

          {/* Expand/Collapse */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
          >
            {isExpanded ? (
              <ChevronUp className="h-3 w-3 text-gray-500 dark:text-gray-400" />
            ) : (
              <ChevronDown className="h-3 w-3 text-gray-500 dark:text-gray-400" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded Breakdown */}
      {isExpanded && (
        <div className="fixed top-20 right-4 z-[200] w-80 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Balance Breakdown
              </h3>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {data?.chains?.length || 0} chains
              </span>
            </div>

            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            )}

            {/* Chain Balances */}
            {!isLoading && data?.chains && (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {data.chains
                  .filter(chain => chain.usdValue > 0.01) // Only show chains with balance > $0.01
                  .sort((a, b) => b.usdValue - a.usdValue) // Sort by value
                  .map((chain) => (
                    <div
                      key={chain.chain}
                      className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50"
                    >
                      <div className="flex items-center gap-2">
                        <img
                          src={`/images/chains/${chain.chain === 'xrp' ? 'xrp-logo' : chain.chain.toLowerCase()}-logo.png`}
                          alt={chain.chain}
                          className="w-6 h-6 rounded-full"
                          onError={(e) => {
                            const target = e.currentTarget as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                        />
                        <div>
                          <div className="text-xs font-medium text-gray-900 dark:text-white">
                            {chain.chain.toUpperCase()}
                          </div>
                          <div className="text-[10px] text-gray-500 dark:text-gray-400">
                            {chain.balance} {chain.nativeSymbol}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs font-bold text-gray-900 dark:text-white">
                        {isHidden ? '••••' : formatUSD(chain.usdValue)}
                      </div>
                    </div>
                  ))}

                {/* Empty State */}
                {data.chains.length === 0 && (
                  <div className="text-center py-6 text-sm text-gray-500 dark:text-gray-400">
                    No balances found
                  </div>
                )}
              </div>
            )}

            {/* Total Footer */}
            {!isLoading && data && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    Total Value
                  </span>
                  <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    {isHidden ? '••••••••' : formatUSD(totalBalance)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
