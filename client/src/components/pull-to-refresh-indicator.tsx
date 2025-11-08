import React from 'react';
import { Loader2, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PullToRefreshIndicatorProps {
  isPulling: boolean;
  pullDistance: number;
  isRefreshing: boolean;
  threshold?: number;
}

export function PullToRefreshIndicator({
  isPulling,
  pullDistance,
  isRefreshing,
  threshold = 80
}: PullToRefreshIndicatorProps) {
  const isReady = pullDistance > threshold;
  const opacity = Math.min(pullDistance / threshold, 1);
  const scale = Math.min(pullDistance / threshold * 0.8 + 0.2, 1);

  if (!isPulling && !isRefreshing) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center pointer-events-none"
      style={{
        height: `${Math.min(pullDistance, 100)}px`,
        opacity,
        transform: `scale(${scale})`
      }}
    >
      <div className={cn(
        "flex items-center justify-center w-12 h-12 rounded-full transition-all duration-200",
        isRefreshing 
          ? "bg-blue-500/20 dark:bg-blue-400/20" 
          : isReady
          ? "bg-green-500/20 dark:bg-green-400/20"
          : "bg-gray-500/20 dark:bg-gray-400/20"
      )}>
        {isRefreshing ? (
          <Loader2 className={cn(
            "h-6 w-6 animate-spin",
            "text-blue-600 dark:text-blue-400"
          )} />
        ) : (
          <ArrowDown className={cn(
            "h-6 w-6 transition-all duration-200",
            isReady 
              ? "text-green-600 dark:text-green-400 rotate-180" 
              : "text-gray-600 dark:text-gray-400"
          )} />
        )}
      </div>
      {isRefreshing && (
        <span className="ml-3 text-sm font-medium text-blue-600 dark:text-blue-400">
          Refreshing...
        </span>
      )}
    </div>
  );
}
